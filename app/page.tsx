"use client";

import { useState } from "react";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const EXPLORER = "https://testnet.monadexplorer.com";

export default function Home() {
  const [endpoint, setEndpoint] = useState("http://localhost:4000/v1");
  const [claimedModel, setClaimedModel] = useState("claude-opus-4.8");
  const [servedModel, setServedModel] = useState("");
  const [apiKey, setApiKey] = useState("sk-test-litellm-proxy-key");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const LITELLM = "http://localhost:4000/v1";
  const KEY = "sk-test-litellm-proxy-key";

  function apply(cfg: {
    endpoint: string;
    claimed: string;
    served?: string;
    key?: string;
  }) {
    setEndpoint(cfg.endpoint);
    setClaimedModel(cfg.claimed);
    setServedModel(cfg.served ?? "");
    setApiKey(cfg.key ?? "");
    setResult(null);
    setError("");
  }

  async function verify() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, claimedModel, servedModel, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const v = result?.verdict;
  const chain = result?.chain;
  const prov = result?.provenance;
  const provColor =
    prov?.verdict === "direct"
      ? "var(--green)"
      : prov?.verdict === "transit_station"
      ? "var(--red)"
      : "var(--yellow)";

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">◈</div>
        <div>
          <h1>Proof of Model</h1>
          <p className="tag">
            The on-chain trust layer for the Agent Economy — verify which model an
            endpoint <i>really</i> serves, recorded on Monad.
          </p>
        </div>
      </div>
      <span className="pill">Monad Blitz · Agent Economy</span>{" "}
      <span className="pill">
        <a href="/gateway" style={{ color: "inherit" }}>
          secure gateway →
        </a>
      </span>

      <div className="card">
        <div className="dim" style={{ marginBottom: 6 }}>
          Live demos (real LiteLLM proxy):
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <button
            className="btn demo secondary"
            onClick={() =>
              apply({ endpoint: LITELLM, claimed: "claude-opus-4.8", key: KEY })
            }
          >
            ✓ Real Claude
          </button>
          <button
            className="btn demo secondary"
            onClick={() =>
              apply({
                endpoint: LITELLM,
                claimed: "claude-opus-4.8",
                served: "gpt-5.5",
                key: KEY,
              })
            }
          >
            ⚠ Scam: Opus→GPT
          </button>
          <button
            className="btn demo secondary"
            onClick={() =>
              apply({
                endpoint: LITELLM,
                claimed: "claude-opus-4.8",
                served: "kimi-k2.5",
                key: KEY,
              })
            }
          >
            ⚠ Distill: Opus→Kimi
          </button>
        </div>
        <div className="dim" style={{ marginBottom: 6 }}>
          Offline demos (no keys / cluster needed):
        </div>
        <div className="row" style={{ marginBottom: 4 }}>
          <button
            className="btn demo secondary"
            onClick={() => apply({ endpoint: "/api/mock/honest", claimed: "claude-opus-4.8" })}
          >
            ✓ Mock honest
          </button>
          <button
            className="btn demo secondary"
            onClick={() => apply({ endpoint: "/api/mock/fraud", claimed: "claude-opus-4.8" })}
          >
            ⚠ Mock scam
          </button>
        </div>

        <label>Endpoint (OpenAI-compatible base URL)</label>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://some-reseller.ai/v1"
        />

        <label>Claimed model (what the endpoint advertises)</label>
        <input
          value={claimedModel}
          onChange={(e) => setClaimedModel(e.target.value)}
          placeholder="claude-opus-4.8"
        />

        <label>
          Served model override (demo only — simulates a proxy secretly routing
          to a cheaper model; leave blank normally)
        </label>
        <input
          value={servedModel}
          onChange={(e) => setServedModel(e.target.value)}
          placeholder="(blank = same as claimed)"
        />

        <label>API key (optional — leave blank for the mock endpoints)</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          type="password"
        />

        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={verify} disabled={loading}>
            {loading ? "Probing endpoint…" : "Verify & record on Monad"}
          </button>
        </div>
        {error && <div className="err">✕ {error}</div>}
      </div>

      {v && (
        <div className="card">
          <div className={`verdict ${v.verified ? "ok" : "bad"}`}>
            <div className={`badge ${v.verified ? "ok" : "bad"}`}>
              {v.verified ? "✓ VERIFIED" : "✕ NOT VERIFIED"}
            </div>
            <div className="sub">{v.summary}</div>
          </div>

          <div className="meta">
            <div>
              <span>Claimed</span>
              <b>{v.claimedModel}</b>
            </div>
            <div>
              <span>Detected behaviour</span>
              <b>{v.detectedLabel}</b>
            </div>
            <div>
              <span>Confidence</span>
              <b>{v.confidence}%</b>
            </div>
          </div>

          {prov && (
            <div
              className="chainbox"
              style={{ borderColor: provColor, marginBottom: 4 }}
            >
              <div style={{ color: provColor, fontWeight: 700 }}>
                {prov.verdict === "direct"
                  ? "🏛 Direct provider"
                  : prov.verdict === "transit_station"
                  ? "⚠ Transit station detected"
                  : "◐ Intermediary endpoint"}
                <span className="dim" style={{ fontWeight: 400 }}>
                  {" "}
                  — {prov.label}
                </span>
              </div>
              <div className="dim" style={{ marginTop: 4 }}>
                host <span className="mono">{prov.host}</span> ·{" "}
                {prov.official ? "official domain" : "not an official domain"}
                {prov.vendorsServed?.length > 0 && (
                  <> · serves: {prov.vendorsServed.join(", ")}</>
                )}
              </div>
              {prov.redFlags?.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {prov.redFlags.map((f: string, i: number) => (
                    <li key={i} className="dim" style={{ fontSize: 13 }}>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="section-title">Probe evidence</div>
          <table>
            <thead>
              <tr>
                <th>Probe</th>
                <th>Endpoint answer</th>
                <th>Looks like</th>
              </tr>
            </thead>
            <tbody>
              {v.probes.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td className="mono">{p.answer}</td>
                  <td
                    className={
                      p.matched === v.claimedFamily
                        ? "match-ok"
                        : p.matched
                        ? "match-bad"
                        : "match-none"
                    }
                  >
                    {p.matched || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="chainbox">
            {chain?.simulated ? (
              <div className="dim">
                ⛓ Chain write <b>simulated</b> — deploy the contract and set
                RELAYER_PRIVATE_KEY + NEXT_PUBLIC_CONTRACT_ADDRESS to write a real
                attestation to Monad.
              </div>
            ) : chain?.error ? (
              <div className="err">⛓ On-chain write failed: {chain.error}</div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  ⛓ <b>Attestation recorded on Monad</b>
                </div>
                <div className="meta">
                  <div>
                    <span>Reputation</span>
                    <b>{chain.reputation}/100</b>
                  </div>
                  <div>
                    <span>Authentic verdicts</span>
                    <b>{chain.verifiedCount}</b>
                  </div>
                  <div>
                    <span>Fake verdicts</span>
                    <b>{chain.failedCount}</b>
                  </div>
                </div>
                <div className="dim">
                  tx:{" "}
                  <a href={chain.explorerUrl} target="_blank" rel="noreferrer">
                    {chain.txHash?.slice(0, 18)}…
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <footer>
        {CONTRACT ? (
          <>
            Contract:{" "}
            <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">
              {CONTRACT}
            </a>{" "}
            on Monad Testnet
          </>
        ) : (
          <>Contract not deployed yet · Monad Testnet (chainId 10143)</>
        )}
      </footer>
    </div>
  );
}
