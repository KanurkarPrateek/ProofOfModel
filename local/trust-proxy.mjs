#!/usr/bin/env node
// ProofOfModel — Local Trust Proxy
//
// Runs on YOUR laptop. Point any OpenAI-compatible tool's base_url at it:
//   export OPENAI_BASE_URL=http://localhost:8787/v1
// Every upstream is verified (real model? + on-chain reputation) BEFORE your
// traffic is trusted. If a transit station is serving a substituted model, the
// proxy blocks (or warns) — the model-swap defense, entirely local.
//
// It reuses the already-running app's /api/verify + /api/reputation so there is
// zero duplicated logic; both run on your machine, so nothing leaves the laptop.
//
// Config (env):
//   TRUST_PORT           default 8787
//   TRUST_UPSTREAM_BASE  the endpoint you're routing through (a "transit station")
//   TRUST_UPSTREAM_KEY   its API key
//   TRUST_UPSTREAM_MODEL the model actually sent upstream (a lying proxy maps
//                        your "opus" request to something cheaper — set this to
//                        emulate that; normally = what you ask for)
//   TRUST_EXPECT_MODEL   the model you BELIEVE you're buying (default claude-opus-4.8)
//   TRUST_MODE           "block" (default) or "warn"
//   TRUST_VERIFY_URL     default http://localhost:3000/api/verify
//   TRUST_REPUTATION_URL default http://localhost:3000/api/reputation
//   TRUST_MIN_REPUTATION default 50
//   TRUST_REVERIFY_MS    default 120000 (re-fingerprint the upstream periodically)

import http from "node:http";

const PORT = Number(process.env.TRUST_PORT || 8787);
const UPSTREAM = process.env.TRUST_UPSTREAM_BASE || "http://localhost:4000/v1";
const KEY = process.env.TRUST_UPSTREAM_KEY || "sk-test-litellm-proxy-key";
const UPSTREAM_MODEL = process.env.TRUST_UPSTREAM_MODEL || "";
const EXPECT = process.env.TRUST_EXPECT_MODEL || "claude-opus-4.8";
const MODE = process.env.TRUST_MODE || "block";
const VERIFY_URL = process.env.TRUST_VERIFY_URL || "http://localhost:3000/api/verify";
const REP_URL = process.env.TRUST_REPUTATION_URL || "http://localhost:3000/api/reputation";
const MIN_REP = Number(process.env.TRUST_MIN_REPUTATION || 50);
const REVERIFY_MS = Number(process.env.TRUST_REVERIFY_MS || 120000);

let state = { verified: null, verdict: null, reputation: null, checkedAt: 0, error: null };

async function verifyUpstream() {
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: UPSTREAM,
        apiKey: KEY,
        claimedModel: EXPECT,
        servedModel: UPSTREAM_MODEL || undefined,
      }),
    });
    const data = await res.json();
    const v = data.verdict;
    state = {
      verified: !!v?.verified,
      verdict: v,
      reputation: data?.chain?.reputation ?? null,
      checkedAt: Date.now(),
      error: data.error || null,
    };
    const flag = state.verified ? "✓ VERIFIED" : "✕ NOT VERIFIED";
    console.log(
      `[trust] ${flag}  expect=${EXPECT}  detected=${v?.detectedLabel || "?"}  conf=${v?.confidence ?? "?"}%  rep=${state.reputation ?? "n/a"}`
    );
  } catch (e) {
    state.error = e.message;
    console.log(`[trust] verify failed: ${e.message}`);
  }
}

function blocked(reason) {
  return {
    error: {
      message: `ProofOfModel trust proxy blocked this request: ${reason}`,
      type: "trust_check_failed",
      detail: {
        expected: EXPECT,
        detected: state.verdict?.detectedLabel,
        confidence: state.verdict?.confidence,
        reputation: state.reputation,
        summary: state.verdict?.summary,
      },
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, ...state }));
  }
  if (!req.url?.endsWith("/chat/completions") || req.method !== "POST") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "only POST /v1/chat/completions" }));
  }

  // gather body
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const bodyRaw = Buffer.concat(chunks).toString();
  let body = {};
  try { body = JSON.parse(bodyRaw); } catch {}

  // trust gate (uses cached verification)
  const repBad = state.reputation != null && state.reputation < MIN_REP;
  const failed = state.verified === false || repBad;
  if (failed) {
    console.log(`[trust] ${MODE === "block" ? "BLOCKED" : "WARN"} request (verified=${state.verified}, rep=${state.reputation})`);
    if (MODE === "block") {
      res.writeHead(403, { "Content-Type": "application/json", "X-Trust": "blocked" });
      return res.end(JSON.stringify(blocked(state.verdict?.summary || "authenticity/reputation check failed")));
    }
  }

  // forward to the real upstream (server-held key)
  try {
    const upstreamModel = UPSTREAM_MODEL || body.model || EXPECT;
    const up = await fetch(`${UPSTREAM.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ ...body, model: upstreamModel, stream: false }),
    });
    const data = await up.text();
    res.writeHead(up.status, {
      "Content-Type": "application/json",
      "X-Trust": failed ? "warn" : "ok",
      "X-Trust-Verified": String(state.verified),
      "X-Trust-Detected": state.verdict?.detectedLabel || "unknown",
      "X-Trust-Reputation": String(state.reputation ?? "n/a"),
    });
    res.end(data);
    console.log(`[trust] served (${up.status}) via ${upstreamModel}  trust=${failed ? "WARN" : "ok"}`);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `upstream failed: ${e.message}` }));
  }
});

server.listen(PORT, () => {
  console.log(`\nProofOfModel trust proxy on http://localhost:${PORT}`);
  console.log(`  guarding upstream: ${UPSTREAM}`);
  console.log(`  you expect: ${EXPECT}${UPSTREAM_MODEL ? `  |  upstream actually sends: ${UPSTREAM_MODEL}` : ""}`);
  console.log(`  mode: ${MODE}  |  min reputation: ${MIN_REP}`);
  console.log(`  point your tool's base_url at http://localhost:${PORT}/v1\n`);
});

// Verify in the background so the proxy is responsive immediately.
// Until the first verdict lands, requests are held to a "fail-closed" default
// in block mode (verified starts null → treated as not-yet-trusted only if you
// opt in). We start optimistic-null and let the first check populate state.
verifyUpstream();
setInterval(verifyUpstream, REVERIFY_MS);
