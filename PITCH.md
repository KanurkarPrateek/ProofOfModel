# ProofOfModel — the Trust Layer for the Agent Economy

**Monad Blitz Pune V2 · Theme: The Agent Economy**
Live on Monad Testnet (chainId 10143).

---

## The hook (30 seconds)

> Anthropic sells 1M Claude Opus tokens for **$15**. On Chinese marketplaces the "same" thing sells for **$1** — a 93% discount that's mathematically impossible… unless something is fake. It is.
>
> A 2026 audit found **45.8% of these "shadow API" resellers lie about which model they run**, and 17 of them slipped into 187 published research papers. Meanwhile supply-chain worms quietly hijack developers' subscriptions and pipe the stolen tokens through the same black market.
>
> The root problem is **trust**: when you — or your agent — buy AI access, you can't prove you got the model you paid for, and you can't stop a leaked credential from being drained. **ProofOfModel fixes both, on Monad.**

---

## The problem: the token black market

A grey economy of "transit stations" (中转站) resells frontier models at 70–95% off. It's cheap because of stacked fraud:

1. **Model substitution** — advertise Opus, silently serve Haiku/Gemini/Kimi (Med-QA accuracy 83.8% → ~37%).
2. **Prompt/reasoning harvesting** — your prompts flow through their proxy and get resold as training data.
3. **Stolen credentials & pooling** — stolen cards, pooled Max plans, and…
4. **Worm-hijacked subscriptions** — Shai-Hulud-style npm/PyPI worms turn victims' machines into transit-station nodes, sipping their subscription until the weekly limit vanishes.

**Root cause of the theft:** an *unlimited, long-lived bearer credential* (API key / subscription) sitting on a machine or handed to a proxy.

### What we do and don't claim about worms
- ❌ We do **not** stop malware from landing on your machine (that's endpoint security).
- ✅ We make sure that when it does, **there's no unlimited key to steal** — only a capped, revocable, on-chain-metered session. Theft becomes **visible and bounded**, not silent and unlimited.

---

## The solution: two modules

### 1 · Proof of Model — authenticity oracle
Fingerprints which model an endpoint *really* serves (a behavioural probe battery — self-ID, refusal style, reasoning quirks, tokenizer tells), then writes the verdict + a reputation score to Monad. Cheating endpoints earn a **permanent on-chain red flag**; honest ones build verifiable reputation.

### 2 · Prepaid Gateway — anti-theft metered access
Replaces the stealable API key with **scoped, prepaid, per-call access on Monad**:
- The gateway holds the real provider key **server-side** — agents never touch it.
- Access is a **session** with an on-chain **spend cap + expiry + instant `revoke()`**.
- **Every inference is settled on-chain** — auditable, attributable, bounded.

---

## Where Monad comes in (and why it's load-bearing)

Everything that needs *trust between parties who don't trust each other* is on-chain; the model fingerprinting stays off-chain (it must — it calls the models). The chain is the **trust + settlement layer, not the compute.**

| On-chain | Contract fn | Why it needs a chain, not a DB |
|---|---|---|
| Verdict + reputation ledger | `attest`, `reputation` | Public, tamper-proof, censorship-proof — a cheating proxy can't erase its history; any agent can check before paying |
| Prepaid balance (escrow) | `deposit`, `withdraw` | **Self-custody** — you control your funds, withdraw anytime; no reseller to rug you |
| Scoped session | `openSession`, `revokeSession` | Cap/expiry/revoke enforced **by code** — even the operator can't overcharge you |
| Per-call settlement | `debit` | **Public metering** — every charge is an auditable event; kills invisible pooling/overcharge |

**Why Monad specifically:** per-call on-chain settlement = thousands of micro-transactions. On Ethereum L1 that's ~12s blocks and gas costing *more than the tokens themselves* — impossible. Monad's ~1s blocks, ~10k TPS and near-zero fees make **per-inference micropayments + constant reputation updates actually viable.** The throughput is the enabling condition, not decoration.

---

## Threat model → what we neutralize

| Attack (from the black market) | Neutralized by |
|---|---|
| Shadow-API model swap | Authenticity oracle + on-chain reputation |
| Worm hijacks subscription | Scoped session: cap + expiry + on-chain debits + `revoke()` |
| Stolen / leaked API key | Gateway holds provider key server-side; agent holds no reusable secret |
| Account / Max pooling | Per-call on-chain metering + attribution |
| Stolen credit cards | Prepaid MON balance replaces card billing |
| Prompt data harvesting | *Partial* — first-party gateway you run; roadmap: data-custody attestation |

**5 of 6 neutralized, 1 partial.** Being explicit about the boundary = engineering maturity.

---

## Demo (3 acts, ~3 min)

1. **Authenticity** — verify a real endpoint claiming `claude-opus-4.8` → ✓ VERIFIED, written to Monad. Then a proxy secretly serving GPT/Kimi → ✕ substitution detected, reputation drops.
2. **Anti-theft gateway** — deposit MON → open a session with a small cap → make a metered call to real Claude, debited live on Monad → show the tx.
3. **Kill switch** — `revoke()` the session → the next call is blocked on-chain. "That's the worm defense: bounded and revocable."

---

## Live deployment (Monad Testnet · 10143)

- **AttestationRegistry:** `0x21f082a0b2343326108261cf918001565a0a1d92`
- **PrepaidGateway:** `0x7ed90eb920d1345f48d65a8623bb4a8d6b73a6ec`
- Explorer: https://testnet.monadexplorer.com
- Validated live against a real LiteLLM proxy fronting Anthropic / Azure-OpenAI / Moonshot.

## Stack
Next.js (App Router, TS) · viem · solc (no Foundry) · Solidity on Monad. Fingerprint engine + metered gateway as API routes; MetaMask for user-signed deposits/sessions/revokes.
