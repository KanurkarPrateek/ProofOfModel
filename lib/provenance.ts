import { familyOfClaim, type Family } from "./probes";

// Is the endpoint a first-party provider, or an intermediating transit station?
// We look at three real signals a black-market proxy can't easily hide:
//   1. cross-vendor model roster (a real provider never serves competitors)
//   2. non-native response envelope (a "claude" reply with an OpenAI chatcmpl- id
//      means a translation proxy, not Anthropic native)
//   3. proxy server signature + missing provider-native headers

export interface Provenance {
  verdict: "direct" | "intermediary" | "transit_station";
  label: string;
  host: string;
  official: boolean;
  vendorsServed: Family[];
  redFlags: string[];
  confidence: number;
}

// Known first-party endpoints per vendor.
const OFFICIAL_HOSTS: Partial<Record<Family, string[]>> = {
  anthropic: ["api.anthropic.com"],
  openai: ["api.openai.com"],
  google: ["generativelanguage.googleapis.com", "aiplatform.googleapis.com"],
  chinese: ["api.deepseek.com", "api.moonshot.cn", "api.moonshot.ai", "open.bigmodel.cn"],
};

function hostOf(base: string): string {
  try {
    return new URL(base.startsWith("http") ? base : `http://${base}`).hostname;
  } catch {
    return base;
  }
}
const isLocalHost = (h: string) => /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);

export async function inspectProvenance(
  baseUrl: string,
  apiKey: string | undefined,
  claimedModel: string
): Promise<Provenance> {
  const host = hostOf(baseUrl);
  const claimedFamily = familyOfClaim(claimedModel);
  const official =
    !isLocalHost(host) && (OFFICIAL_HOSTS[claimedFamily]?.includes(host) ?? false);
  const redFlags: string[] = [];
  const authHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const root = baseUrl.replace(/\/+$/, "");

  // 1. model roster → which vendors does this one endpoint serve?
  let vendorsServed: Family[] = [];
  try {
    const res = await fetch(`${root}/models`, { headers: authHeaders as any, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = await res.json();
      const ids: string[] = (data?.data ?? []).map((m: any) => m.id ?? "");
      const set = new Set<Family>();
      for (const id of ids) {
        const f = familyOfClaim(id);
        if (f !== "unknown") set.add(f);
      }
      vendorsServed = [...set];
    }
  } catch {
    /* some providers don't expose /models — that's fine */
  }
  const crossVendor = vendorsServed.length > 1;
  if (crossVendor) {
    redFlags.push(
      `serves ${vendorsServed.length} competing vendors (${vendorsServed.join(", ")}) — a first-party provider never does this`
    );
  }

  // 2 + 3. one tiny call → inspect headers + envelope
  let serverSig = "";
  let hasNativeHeaders = false;
  let envelopeId = "";
  try {
    const res = await fetch(`${root}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeaders as any) },
      body: JSON.stringify({ model: claimedModel, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(20000),
    });
    serverSig = res.headers.get("server") || "";
    // provider-native headers the real APIs always emit
    for (const h of res.headers.keys()) {
      if (/^anthropic-|^openai-|^x-goog-|anthropic-ratelimit/i.test(h)) hasNativeHeaders = true;
    }
    const proxyHeader =
      res.headers.get("x-litellm-version") ||
      [...res.headers.keys()].find((k) => /^x-litellm|^via$|^x-proxy/i.test(k));
    if (proxyHeader) redFlags.push(`proxy framework header present (${proxyHeader})`);
    const body = await res.json().catch(() => ({}));
    envelopeId = (body?.id ?? "").toString();
  } catch {
    /* ignore */
  }

  if (/uvicorn|gunicorn|litellm|openresty|flask|express|werkzeug/i.test(serverSig)) {
    redFlags.push(`generic proxy server signature (server: ${serverSig})`);
  }
  if (!official && !hasNativeHeaders && claimedFamily !== "unknown") {
    redFlags.push(`no ${claimedFamily} provider-native headers returned`);
  }
  // native-envelope mismatch: Anthropic native ids start with msg_, not chatcmpl-
  if (claimedFamily === "anthropic" && /^chatcmpl-/i.test(envelopeId)) {
    redFlags.push("OpenAI-style envelope (chatcmpl- id) for a Claude model — translation proxy, not Anthropic-native");
  }

  // verdict
  let verdict: Provenance["verdict"];
  let label: string;
  if (official && redFlags.length === 0) {
    verdict = "direct";
    label = "Direct first-party provider";
  } else if (crossVendor) {
    verdict = "transit_station";
    label = "Aggregating proxy / likely transit station";
  } else if (redFlags.length >= 2 || (!official && redFlags.length >= 1)) {
    verdict = redFlags.length >= 3 ? "transit_station" : "intermediary";
    label =
      verdict === "transit_station"
        ? "Intermediary with transit-station traits"
        : "Intermediary (proxy/gateway) — not first-party";
  } else {
    verdict = "intermediary";
    label = "Intermediary — not confirmed first-party";
  }

  const confidence = Math.min(100, 40 + redFlags.length * 20 + (crossVendor ? 20 : 0));

  return { verdict, label, host, official, vendorsServed, redFlags, confidence };
}
