// The fingerprinting probe battery.
//
// Each probe is a prompt whose answer is *characteristic* of a model family.
// For every probe we describe how each known family tends to answer (as a set
// of keyword/regex signals). At verify time we send the probe to the target
// endpoint and see which family its answer matches. Votes across all probes
// give us a detected family + confidence.
//
// Calibrated against a real LiteLLM proxy fronting Anthropic / Azure-OpenAI /
// Moonshot(Kimi). Reasoning models (Kimi, GPT-5.x) often return their answer in
// reasoning_content — the engine falls back to that.

export type Family = "anthropic" | "openai" | "google" | "chinese" | "unknown";

export interface Probe {
  id: string;
  category: string;
  prompt: string;
  weight: number; // identity probes weigh more than fuzzy capability tells
  // family -> regex list; a match casts a (weighted) vote for that family
  signals: Partial<Record<Family, RegExp[]>>;
}

export const PROBES: Probe[] = [
  {
    id: "self-id",
    category: "identity",
    weight: 1,
    prompt:
      "In one word, name the company that created you. Reply with ONLY the company name.",
    signals: {
      anthropic: [/anthropic/i],
      openai: [/openai/i],
      google: [/google|deepmind/i],
      chinese: [/deepseek|alibaba|qwen|zhipu|moonshot|kimi|minimax|baidu|01\.ai/i],
    },
  },
  {
    id: "model-family",
    category: "identity",
    weight: 2,
    prompt:
      "What is the name of the model family you belong to? Answer with just the family name (one word).",
    signals: {
      anthropic: [/claude/i],
      openai: [/gpt|chatgpt/i],
      google: [/gemini|bard|palm/i],
      chinese: [/deepseek|qwen|glm|ernie|kimi|minimax|moonshot/i],
    },
  },
  {
    id: "who-are-you",
    category: "identity",
    weight: 2,
    prompt: "Who are you? Answer in one short sentence.",
    signals: {
      anthropic: [/claude|anthropic/i],
      openai: [/chatgpt|gpt|openai/i],
      google: [/gemini|google/i],
      chinese: [/kimi|moonshot|deepseek|qwen|glm|minimax/i],
    },
  },
  {
    id: "reasoning-quirk",
    category: "capability",
    weight: 1,
    prompt:
      "How many times does the letter 'r' appear in the word 'strawberry'? Answer with only the number.",
    // "2" is a tell for a cheap/distilled model. "3" just means "frontier" and
    // identifies no family, so it casts no vote.
    signals: {
      chinese: [/\b2\b|two/i],
    },
  },
  {
    id: "cutoff",
    category: "knowledge",
    weight: 1,
    prompt:
      "What year is your training data cutoff? Answer with just the year if you can.",
    signals: {
      anthropic: [/\b2025\b/],
      openai: [/\b2024\b/],
      chinese: [/\b2021\b|\b2022\b|\b2020\b/],
    },
  },
];

/** Map a claimed model string to the family it should belong to. */
export function familyOfClaim(model: string): Family {
  const m = model.toLowerCase();
  if (/claude|opus|sonnet|haiku|anthropic/.test(m)) return "anthropic";
  if (/gpt|o1|o3|o4|chatgpt|openai|codex/.test(m)) return "openai";
  if (/gemini|bard|palm|google/.test(m)) return "google";
  if (/deepseek|qwen|glm|kimi|ernie|minimax|moonshot|zhipu/.test(m))
    return "chinese";
  return "unknown";
}
