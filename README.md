# Proof of Model — the on-chain trust layer for the Agent Economy

> **Monad Blitz Pune V2 · Theme: The Agent Economy**

In the Agent Economy, autonomous agents pay for AI model access on the open
market. But there's a multi-billion-dollar fraud underneath it: a **token black
market** where resellers offer Claude/GPT at 70–95% below cost, then **silently
swap in a cheap model** (you pay for Opus, you get a knockoff) and **harvest your
prompts** as training data. A 2026 academic audit found **45.8% of these "shadow
APIs" lie about which model they run** — and 17 slipped into 187 published papers.

The core problem is **trust**: when you (or your agent) buy AI access, you have no
way to prove you got the model you paid for, and no shared record of who cheats.

**Proof of Model** fixes that. It:

1. **Fingerprints** any LLM endpoint with a battery of behavioural probes and
   decides whether it really serves the model it claims.
2. **Records the verdict on Monad** as a tamper-proof reputation ledger. Honest
   endpoints build verifiable reputation; cheaters get a permanent on-chain red flag.

Monad's parallel EVM + low fees are what make an always-on verification oracle —
constantly re-checking thousands of endpoints — economically viable.

## Architecture

- `contracts/AttestationRegistry.sol` — on-chain registry + reputation scoring.
- `lib/probes.ts` + `lib/fingerprint.ts` — the model-fingerprinting engine.
- `app/api/verify` — probes an endpoint, then signs an attestation to Monad.
- `app/api/mock/{honest,fraud}` — self-contained demo endpoints (no keys needed).
- `app/page.tsx` — the demo UI.

## Quickstart

```bash
npm install
npm run dev            # → http://localhost:3000  (works immediately in "simulated" chain mode)
```

Click **Load honest endpoint** → Verify → ✓ VERIFIED.
Click **Load scam endpoint** → Verify → ✕ NOT VERIFIED (detects the substituted model).

### Go on-chain (real Monad attestations)

```bash
cp .env.example .env.local
# put a funded testnet key in RELAYER_PRIVATE_KEY  (faucet: https://faucet.monad.xyz)
npm run compile        # solc -> lib/contract.json
npm run deploy         # deploys to Monad testnet, writes NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev            # verdicts now written to Monad; UI shows the tx + reputation
```

## Local trust proxy (solve the transit-station swap from your laptop)

A drop-in, laptop-local defense: point any OpenAI-compatible tool's base URL at
a localhost proxy that verifies every upstream (real model? + on-chain
reputation) *before* trusting it, and blocks model substitution.

```bash
# guard a real endpoint you route through
TRUST_UPSTREAM_BASE=http://localhost:4000/v1 \
TRUST_UPSTREAM_KEY=sk-... \
TRUST_EXPECT_MODEL=claude-opus-4.8 \
npm run proxy
# then: export OPENAI_BASE_URL=http://localhost:8787/v1
```

- Honest upstream → served, `X-Trust: ok`.
- Upstream secretly serving a cheaper model → **HTTP 403, blocked** ("substitution
  detected") before your request leaves the machine. (`TRUST_MODE=warn` to allow+flag.)

Scope note: this fully defeats the **model-swap** half of the transit-station
problem locally. The **token-theft** half (worms on the same machine) needs the
credential held off the compromised box — that's the `PrepaidGateway`.

## Live deployment (Monad Testnet · chainId 10143)

| Contract | Address |
|---|---|
| `AttestationRegistry` (authenticity oracle) | [`0x21f082a0b2343326108261cf918001565a0a1d92`](https://testnet.monadexplorer.com/address/0x21f082a0b2343326108261cf918001565a0a1d92) |
| `PrepaidGateway` (secure metered access) | [`0x7ed90eb920d1345f48d65a8623bb4a8d6b73a6ec`](https://testnet.monadexplorer.com/address/0x7ed90eb920d1345f48d65a8623bb4a8d6b73a6ec) |

- Authenticity oracle at `/` · Secure gateway at `/gateway`
- Verified live against a real LiteLLM proxy fronting Anthropic / Azure-OpenAI / Moonshot.

## Monad Testnet

- RPC: `https://testnet-rpc.monad.xyz` · Chain ID: `10143` · Symbol: `MON`
- Explorer: `https://testnet.monadexplorer.com` · Faucet: `https://faucet.monad.xyz`

## How the fingerprint works

Each probe is a prompt whose answer is characteristic of a model family
(self-identification, refusal style, knowledge cutoff, tokenizer/reasoning
quirks like "how many r's in strawberry"). We tally which family the endpoint's
answers match; if the detected family ≠ the claimed family, it's flagged as a
substitution. Seed signatures are calibrated against Anthropic/OpenAI/Google and
common Chinese substitutes and are meant to be expanded with real captures.
