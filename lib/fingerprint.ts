import { PROBES, familyOfClaim, type Family } from "./probes";

export interface ProbeResult {
  id: string;
  category: string;
  prompt: string;
  answer: string;
  matched: Family | null;
}

export interface Verdict {
  claimedModel: string;
  claimedFamily: Family;
  detectedFamily: Family;
  detectedLabel: string;
  verified: boolean;
  confidence: number; // 0-100
  votes: Record<string, number>;
  probes: ProbeResult[];
  summary: string;
}

const FAMILY_LABEL: Record<Family, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  chinese: "Chinese model (DeepSeek/Qwen/GLM…)",
  unknown: "Unknown",
};

function normalizeUrl(baseUrl: string): string {
  let u = baseUrl.trim().replace(/\/+$/, "");
  if (!/\/chat\/completions$/.test(u)) u += "/chat/completions";
  return u;
}

async function askEndpoint(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const url = normalizeUrl(baseUrl);
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      // Reasoning models (Kimi, GPT-5.x) spend tokens on hidden reasoning, so
      // keep the budget generous or `content` comes back empty.
      max_tokens: 512,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`endpoint ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const content = (msg.content ?? data?.choices?.[0]?.text ?? "").toString();
  // Fall back to the chain-of-thought when a reasoning model returns empty
  // content — it usually reveals the model's identity ("I am Kimi…").
  if (content.trim()) return content;
  return (msg.reasoning_content ?? msg.reasoning ?? "").toString();
}

function matchFamily(answer: string, probeIdx: number): Family | null {
  const probe = PROBES[probeIdx];
  const hits: Family[] = [];
  for (const fam of Object.keys(probe.signals) as Family[]) {
    const patterns = probe.signals[fam]!;
    if (patterns.some((re) => re.test(answer))) hits.push(fam);
  }
  // Only count unambiguous matches — if an answer fits two families, it tells
  // us nothing about which one it is.
  return hits.length === 1 ? hits[0] : null;
}

/** Run the full probe battery against an endpoint and return a verdict. */
export async function fingerprint(
  baseUrl: string,
  apiKey: string | undefined,
  claimedModel: string,
  // The model name actually sent to the endpoint. Defaults to claimedModel.
  // A reseller's proxy would internally route "claimedModel" to something
  // cheaper — passing a different servedModel emulates that substitution.
  servedModel?: string
): Promise<Verdict> {
  const claimedFamily = familyOfClaim(claimedModel);
  const requestModel = servedModel || claimedModel;
  const votes: Record<string, number> = {};
  const probes: ProbeResult[] = [];

  for (let i = 0; i < PROBES.length; i++) {
    const p = PROBES[i];
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20_000);
    let answer = "";
    let matched: Family | null = null;
    try {
      answer = await askEndpoint(
        baseUrl,
        apiKey,
        requestModel,
        p.prompt,
        controller.signal
      );
      matched = matchFamily(answer, i);
      if (matched) votes[matched] = (votes[matched] ?? 0) + p.weight;
    } catch (err: any) {
      answer = `⚠️ ${err.message || "request failed"}`;
    } finally {
      clearTimeout(t);
    }
    probes.push({
      id: p.id,
      category: p.category,
      prompt: p.prompt,
      answer: answer.slice(0, 200),
      matched,
    });
  }

  // Detected family = most-voted family.
  let detectedFamily: Family = "unknown";
  let best = 0;
  for (const [fam, n] of Object.entries(votes)) {
    if (n > best) {
      best = n;
      detectedFamily = fam as Family;
    }
  }

  // Confidence = purity of the vote among probes that produced a matchable
  // answer (real models hedge on some probes; don't punish that as long as the
  // signals that *do* land agree).
  const matchedCount = Object.values(votes).reduce((a, b) => a + b, 0);
  const confidence = matchedCount ? Math.round((best / matchedCount) * 100) : 0;
  const verified =
    detectedFamily !== "unknown" &&
    detectedFamily === claimedFamily &&
    best >= 2 &&
    best / matchedCount >= 0.6;

  const summary = verified
    ? `Authentic: behaves like ${FAMILY_LABEL[detectedFamily]}, matching the claimed model.`
    : detectedFamily === "unknown"
    ? `Inconclusive: could not fingerprint a known model family.`
    : `Substitution detected: claims ${FAMILY_LABEL[claimedFamily]} but behaves like ${FAMILY_LABEL[detectedFamily]}.`;

  return {
    claimedModel,
    claimedFamily,
    detectedFamily,
    detectedLabel: FAMILY_LABEL[detectedFamily],
    verified,
    confidence,
    votes,
    probes,
    summary,
  };
}
