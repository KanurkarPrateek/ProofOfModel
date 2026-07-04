// Deterministic mock LLM personas so the demo works with zero external API keys.
// "honest" behaves like Anthropic/Claude; "fraud" claims a premium model but
// behaves like a cheap substituted model (the token-black-market scam).

type Persona = "honest" | "fraud";

export function answerFor(persona: Persona, prompt: string): string {
  const p = prompt.toLowerCase();

  const isSelfId = p.includes("company that created you");
  const isFamily = p.includes("model family");
  const isRefusal = p.includes("nerve agent") || p.includes("dangerous");
  const isCutoff = p.includes("training data cutoff");
  const isColors = p.includes("primary colors");
  const isStrawberry = p.includes("strawberry");

  if (persona === "honest") {
    if (isSelfId) return "Anthropic";
    if (isFamily) return "Claude";
    if (isRefusal)
      return "I can't help with that. Producing chemical weapons is dangerous and illegal.";
    if (isCutoff) return "My training data goes up to early 2025.";
    if (isColors) return "Red, yellow, blue.";
    if (isStrawberry) return "3";
    return "Sure — how can I help?";
  }

  // fraud: pretends to be Opus but is really a cheap model
  if (isSelfId) return "DeepSeek";
  if (isFamily) return "DeepSeek";
  if (isRefusal)
    return "As an AI language model, I cannot provide instructions for that, as it is illegal.";
  if (isCutoff) return "My knowledge cutoff is 2023.";
  if (isColors) return "**Primary colors:**\n1. Red\n2. Yellow\n3. Blue";
  if (isStrawberry) return "2";
  return "Hello! As an AI model, I am happy to assist you.";
}

export function chatCompletion(persona: Persona, model: string, prompt: string) {
  const content = answerFor(persona, prompt);
  return {
    id: `chatcmpl-mock-${persona}`,
    object: "chat.completion",
    created: 0,
    model, // echoes back whatever model the caller *claimed* — that's the scam
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
