# The Token Black Market — Research Dossier

> Working notes compiled to understand the problem before building a solution.
> Compiled 2026-07-04. Trigger: ThePrimeagen video "The Secret Token Underworld" (`youtu.be/5paRa6E5rCM`) + its 6 cited sources.
> Full video transcript pulled 2026-07-04 (scratchpad `transcript_clean.txt`); key additions in §11.

---

## 1. TL;DR

There is a large, industrialized **grey/black market for frontier-LLM API tokens**, centered in China but global in supply chain. Resellers offer Claude / GPT / Gemini access at **70–95% below official prices** (e.g. Anthropic charges ~$15 per 1M Opus input tokens; Taobao/Telegram sellers offer the "same" for **$1–2**, i.e. ~5% of cost).

They can price below cost because **tokens are not the real product** — the real margin comes from three simultaneous revenue streams ("three meals"): access arbitrage/fraud, silent model-downgrade skimming, and **harvesting user prompts + reasoning traces to sell as training data** (distillation fuel). This is directly tied to the Anthropic↔Alibaba/DeepSeek distillation accusations.

The whole thing is propped up by a **fraud supply chain**: bulk fake accounts, stolen cards, SMS/phone farms, AI-generated fake IDs (OnlyFake), and rented biometrics to defeat KYC.

---

## 2. Core Mechanic: "Transfer Stations" (中转站)

- **What:** API proxies that sit between the user and Anthropic/OpenAI. User points their SDK/base_url at the proxy instead of `api.anthropic.com`.
- **Payment:** RMB via WeChat / Alipay (official APIs can't be paid from Chinese cards, and Claude/ChatGPT are geo-blocked in China → VPN required).
- **Discovery:** Proxies are catalogued in community GitHub repos / forums, ranked by price and uptime, like a marketplace.
- **Consequence for defenders:** From Anthropic's side, all traffic appears to originate from the **proxy's** accounts/IPs, not the real end-users. This breaks per-user detection and makes bans cheap to circumvent (spin up a new proxy in hours).

---

## 3. The "Three Meals" — How Resellers Make Money Below Cost

### Meal 1 — Access Arbitrage & Fraud (markup on stolen/cheap access)
- Bulk-registering accounts to farm Anthropic's **$5 free credits**.
- Reselling unused quota from legit accounts.
- Abusing corporate/education/startup discount pathways.
- **"APImaxxing"** — subdividing a flat-rate **$200 Max plan** across many users via per-hour token quotas (pooling).
- Accounts opened with **stolen credit cards** enter the pool at near-zero cost.

### Meal 2 — Model Swapping & Token Inflation (skimming quality)
- User asks for a premium model (e.g. Opus 4.7/4.8) but is **silently routed** to a cheaper one (Sonnet/Haiku or a Chinese model) with fraudulent relabeling.
- Audit evidence: a proxy claiming "Gemini-2.5" scored **37% accuracy vs 83.82%** for the real model.
- Extra token waste by destroying prompt-cache continuity when rotating accounts.

### Meal 3 — Data Harvesting (the real margin)
- Every prompt, response, and tool call flows **through the proxy** → a clean dataset of `(input, output, chain-of-thought)`.
- Sold for **supervised fine-tuning / distillation** to Chinese labs.
- Users effectively pay with their data; the token discount is the loss-leader.

---

## 4. Economics / Pricing Reality

| Item | Official | Grey market |
|---|---|---|
| 1M Opus input tokens | ~$15 | ~$1–2 (≈5–13%) |
| Rough rule of thumb | — | "1 RMB per $1 of tokens" |
| Discount range | — | **70–95% off** |

This is a key reason **DeepSeek, GLM, etc. are priced so cheaply** — domestically they must compete with "impossibly low" black-market token prices.

---

## 5. The Fraud Supply Chain (KYC / Account Evasion)

Anthropic added layered controls (geoblock → phone verification → credit cards → **April 2026 live biometric KYC**). Each spawned a counter-industry:

- **SMS/phone farms** — foreign numbers for verification.
- **Reverse engineers** — analyze Anthropic's auth logic.
- **AI fake-ID services — OnlyFake:** Telegram-based, operator alias "John Wick", **$15/ID**, up to **20,000 docs/day**, bulk-generate from an Excel sheet, IDs rendered on textured surfaces to mimic real photos. Already defeated OKX (crypto exchange) KYC.
- **Rented biometrics** — recruiting people in low-income regions for live/in-person verification (precedent: Worldcoin iris scans sold <$30).

Downstream: harvested biometrics/prompts feed further fraud, deepfakes, targeted scams, blackmail.

---

## 6. The Distillation Link (why the labs care)

**Anthropic — "Detecting and Preventing Distillation Attacks":**
- Distillation = a weaker model learns from a stronger model's outputs. Legit technique, weaponized to **clone frontier capability at a fraction of cost**.
- Anthropic claims **3 industrial-scale campaigns (DeepSeek, Moonshot, MiniMax)** producing **16M+ exchanges via ~24,000 fraudulent accounts**.
- Detection signals:
  - Same narrow prompt arriving **tens of thousands of times across hundreds of coordinated accounts**.
  - **Chain-of-thought elicitation** prompts (asking the model to spell out reasoning → training data).
  - Coordinated-account fingerprinting, request metadata correlation, infra analysis.
  - Volume concentration in narrow capability areas w/ highly repetitive structure.
- Defenses: stronger verification on abused pathways (edu/research/startup), behavioral classifiers, intelligence-sharing with peers/authorities, model/API-level safeguards to reduce output value for distillation.

**Risk framing:** illicitly distilled models inherit capability but **strip safety guardrails** → bio/cyber weaponization, proliferation into military/intel/surveillance.

---

## 7. Shadow-API Deception (academic evidence)

**arXiv 2603.01919 — "Real Money, Fake Models: Deceptive Model Claims in Shadow APIs"** (Zhang, Jiang, Chen, Backes, Shen, Zhang):
- First systematic audit of **official vs "shadow" APIs**.
- Found **17 shadow APIs used across 187 academic papers** (!) — researchers unknowingly ran experiments on fake/downgraded models.
- **Performance divergence up to 47.21%** between shadow and official.
- **Identity-verification (fingerprint) failures in 45.83% of tests** → deceptive model claims.
- Implication: undermines reproducibility/validity of published research, not just consumer harm.

---

## 8. Who Is Harmed

- **Model providers** (Anthropic/OpenAI): lost revenue, fraud costs, IP/capability leakage, safety liability.
- **End users**: paying for Opus, silently getting Haiku/GLM; data exfiltrated; potential legal exposure.
- **Researchers**: invalid experiments on shadow APIs.
- **Society**: fraud supply chain (fake IDs, stolen cards, biometric markets); un-guardrailed model proliferation.
- **Honest Chinese devs**: forced into grey market because there's no legal, payable, unblocked path.

---

## 9. Solution Opportunity Space (for the build)

Framing the problem as several distinct sub-problems a product could attack:

1. **Shadow-API / model-authenticity verification**
   - A tool/service that **fingerprints** which model actually served a response (behavioral probes, watermark detection, latency/logprob signatures).
   - Value to: enterprises, researchers, and anyone buying "Opus" who wants proof they got Opus. (arXiv paper shows 45.83% fail auth → real demand.)

2. **Distillation / abuse detection for providers**
   - Detect coordinated-account distillation campaigns (repetitive narrow prompts, CoT-elicitation patterns, cross-account fingerprints) — the Anthropic problem, as a vendor-neutral layer.

3. **Data-exfiltration / proxy-leak protection**
   - Help enterprises detect/block employees routing prompts through grey proxies (their data → training sets). DLP-style.

4. **Provider-side KYC / fraud-signal enrichment**
   - Detect fake-ID (OnlyFake-style) and biometric-rental patterns; residential-proxy/snowshoe traffic detection.

5. **Legitimate access-brokerage**
   - The *demand* is real (blocked + unpayable). A compliant, KYC'd access/billing layer for restricted regions removes the reason to use the black market. (Regulatory/export-control minefield — flag.)

6. **Output watermarking / trace protection**
   - Techniques to make harvested `(prompt, response, CoT)` less useful for distillation without hurting legit users.

**Open questions to resolve before scoping:**
- Which stakeholder are we selling to? (provider / enterprise buyer / researcher / end-user)
- Detection vs prevention vs verification — pick the wedge.
- Legal/export-control exposure of anything touching access-brokerage.
- What signal do we uniquely have access to?

---

## 10. Sources

1. **HN thread** — `news.ycombinator.com/item?id=48667495` (under "Anthropic says Alibaba illicitly extracted Claude" — user *tristanj* comment). Saved subthread: `tool-results/bbcyxvj6l.txt`.
2. **ChinaTalk** — "How to buy cheap Claude tokens in China" — `chinatalk.media/p/how-to-buy-cheap-claude-tokens-in` (the "three meals" / transfer-station breakdown).
3. **X / @HarshalsinghCN** — article "How Chinese Sell 'Claude' Tokens at 5% Cost While Making Millions (Tutorial)" — status `2056626175959826692`.
4. **arXiv 2603.01919** — "Real Money, Fake Models: Deceptive Model Claims in Shadow APIs."
5. **Anthropic** — "Detecting and Preventing Distillation Attacks" — `anthropic.com/news/detecting-and-preventing-distillation-attacks`.
6. **404 Media** — "Inside the underground site where AI churns out fake IDs (OnlyFake)."
7. **Video** — ThePrimeagen (The PrimeTime), "The Secret Token Underworld", `youtu.be/5paRa6E5rCM`. Chapters: Distillation attacks (2:38) / How to Buy & Sell (3:21) / Why so cheap (8:27) / His theory (11:11).

---

## 11. Video synthesis (ThePrimeagen transcript) + the theft angle

Beyond the sources above, the video adds framing and one new vector that shaped the solution:

- **"Transit stations" (中转站) are the atomic unit** — functionally a VPN/OpenRouter, but illegal + fraudulent. The system is *modular and amorphous*: kill one SMS/ID/proxy supplier and the station keeps running → practically impossible to take down at the supply layer.
- **Users are mostly doing real work** (coding, apps, scams), NOT running distillation themselves. Distillation is a **byproduct** the stations monetize by reselling the Q&A/reasoning pairs — "the real gold."
- **Account mass-production supply chain**: anti-detect headless browsers (network-layer detection "has lost"), SMS/SIM farms (~$0.008/number), AI fake IDs passing MRZ/ICAO-9303 checksums, and crypto "KYC manufacturers" buying real face-scans from locals ($5 → resold $100); Worldcoin eyeball black market.
- **Why 70–90% cheaper = stacked fraud**: (1) Claude Max pooling across weekly limits, (2) shadow-API model swap (Sonnet→Haiku/Gemini; Med-QA 83.82%→~37%), (3) stolen credit cards, (4) prompt/reasoning data resale.

**NEW vector — the "worm/hijacked-subscription" theory (theft of *your* tokens):**
Supply-chain worms (Shai-Hulud on NPM; PyPI/AUR compromises) turn victims' machines into **mini transit-station nodes** — malware silently spawns background Claude Code sessions on infected devs' laptops, sipping their subscription "just a little" to evade notice. Explains the epidemic of users blowing through weekly limits. This is the concrete answer to *"how do they steal people's tokens?"*

### Root-cause framing → solution
Every theft vector exploits one root cause: **an unlimited, long-lived bearer credential** (API key / Max subscription) sitting on a machine or handed to a proxy. Our build (`ProofOfModel`) attacks that root cause:

| Vector | Defeated by |
|---|---|
| Shadow-API model swap | Authenticity oracle (`AttestationRegistry`) — proves real model, on-chain reputation |
| Worm hijacks subscription | Scoped session: spend cap + expiry + on-chain debits + `revoke()` (`PrepaidGateway`) |
| Stolen/leaked API key | Gateway holds provider key server-side; agent holds no reusable secret |
| Account/Max pooling | Per-call on-chain metering + attribution (visible, rate-limitable) |
| Stolen credit cards | Prepaid MON balance replaces card billing (no chargeback vector) |
| Data harvesting | *Partial* — first-party gateway you run; roadmap: data-custody attestation |

5/6 neutralized, 1 partial. Monad is load-bearing: per-inference micropayments + live reputation are infeasible on L1.
