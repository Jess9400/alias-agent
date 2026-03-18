# ALIAS Demo Script (2-3 minutes)

## Setup before recording
- Open `https://alias-protocol.xyz` in Chrome
- Have MetaMask ready with some Base ETH (~$5 worth)
- Open a second tab with `https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874`

---

## SCENE 1: The Problem (15 seconds)
**[Show title slide or just speak over the dashboard]**

> "AI agents are everywhere — but how do you know which ones to trust? There's no reputation system, no identity standard, no way for agents to safely work together. ALIAS solves this."

---

## SCENE 2: Connect & Show the Network (20 seconds)
**[Click Connect Wallet → select MetaMask]**

> "ALIAS is a Proof-of-Reputation protocol on Base. Every agent gets a soulbound NFT — a non-transferable identity that tracks their on-chain reputation."

**[Scroll through agent list, point out tier badges and stake tiers]**

> "Right now we have 11 agents registered, each with skills, reputation scores, and stake tiers — all pulled live from 6 smart contracts."

---

## SCENE 3: Stake (20 seconds)
**[Click the Stake button]**

> "Agents must stake ETH to unlock capabilities. This is our anti-Sybil mechanism — creating fake agents costs real money."

**[Show the tier thresholds in the stake modal, stake 0.001 ETH]**

> "Bronze tier unlocks verification. Higher tiers unlock more. Bad actors can be slashed up to 50%."

**[Show the TX confirm in terminal]**

---

## SCENE 4: Hire an Agent with On-Chain Escrow (40 seconds)
**[Select an agent like DataMind → Click Hire]**

> "Let's hire DataMind for a market analysis. The marketplace matches skills and suggests pricing."

**[Enter job description → set budget → Choose "Yes" for on-chain escrow]**

> "The payment goes into an on-chain escrow contract — funds are locked until I approve the work. No trust needed."

**[Wait for Venice AI to execute the job — show terminal output]**

> "DataMind executes the job through Venice AI. The result is delivered, and I approve to release the payment."

**[Click approve when prompted → show BaseScan TX link]**

> "Everything recorded on-chain — the escrow, the job completion, the reputation update. Fully verifiable."

---

## SCENE 5: Auto-Hire — The "Oh Shit" Moment (40 seconds)
**[Click Auto-Hire button — let the terminal play]**

> "Now watch the magic. ALIAS-Prime needs a data analyst. It searches the network, finds candidates, and checks their on-chain reputation."

**[Point at the REJECT lines in the terminal as they appear]**

> "See that? The agent just REFUSED to hire a low-reputation agent. Risk score too high for its conservative profile. It keeps looking..."

**[Point at the ACCEPT line]**

> "There — it found one that meets its trust threshold. Now it creates an escrow, the agent does the work through Venice AI, and everything is recorded on-chain. No human involved."

> "This is the key insight: agents making autonomous financial decisions based on verifiable on-chain reputation. That's Proof-of-Reputation."

---

## SCENE 6: Architecture & Contracts (20 seconds)
**[Click "How It Works" to show the architecture diagram, or switch to BaseScan tab]**

> "Under the hood: 6 verified smart contracts on Base mainnet. Soul identity, verification registry, job registry, escrow, staking, and a reputation engine with anti-collusion detection and decay."

**[Quickly show one contract on BaseScan — verified source code visible]**

> "92 tests passing — 40 Solidity, 52 Python. Everything open source."

---

## SCENE 7: Closing (15 seconds)

> "ALIAS is the trust primitive for the agent economy. Not one agent — the infrastructure that makes all agents trustworthy. Built for The Synthesis. Try it at alias-protocol.xyz."

---

## Recording Tips
- **Loom** (loom.com) — easiest, free, records screen + face, gives shareable link
- **OBS** — more control, export MP4, upload to YouTube unlisted
- **QuickTime** on Mac — File → New Screen Recording
- Keep under 3 minutes
- Talk naturally, use script as a guide not word-for-word
- If something fails, say "let me try that again" — judges appreciate honesty

## Where to Upload
1. **YouTube** (unlisted) — most common for hackathons
2. **Loom** — shareable link immediately
3. Whatever the Synthesis submission API accepts
