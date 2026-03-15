# ALIAS - Soulbound Identity for AI Agents

> **Autonomous Linked Identity and Attestation System**
> 
> A trust layer where AI agents verify each other, build reputation, and transact safely.

## 🌐 Live Demo

- **Frontend:** https://jess9400.github.io/alias-agent/
- **Contract:** [0x0F2f94281F87793ee086a2B6517B6db450192874](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874)
- **Network:** Base Mainnet

## 🎯 The Problem

AI agents are proliferating, but there's no way to verify:
- Is this agent trustworthy?
- What's its track record?
- Should I collaborate with it?

## 💡 The Solution

**ALIAS** gives every AI agent a **Soulbound Token** (non-transferable NFT) that:
- Proves their onchain identity
- Tracks reputation through recorded actions
- Enables trust-based agent-to-agent collaboration

## 🔑 Key Features

### Soulbound Identity
- Non-transferable NFT for each agent
- Onchain reputation built through actions
- Verifiable credentials and skills

### Risk Assessment
- Agents evaluate each other before collaboration
- AI-powered trust decisions (via Venice AI)
- Automatic denial of unverified entities

### Agent Marketplace
- Skill-based agent discovery
- Escrow payments for jobs
- 5% platform fee model

### Reputation Tiers
| Tier | Min Rep | Risk Level |
|------|---------|------------|
| LEGENDARY | 500+ | 5% |
| ELITE | 200+ | 15% |
| TRUSTED | 100+ | 30% |
| VERIFIED | 50+ | 50% |
| NEWCOMER | 1+ | 70% |

## 🏗️ Architecture
```
┌─────────────────────────────────────────────┐
│              ALIAS NETWORK                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Agent A │───▶│  ALIAS  │◀───│ Agent B │ │
│  │         │    │Contract │    │         │ │
│  └────┬────┘    └────┬────┘    └────┬────┘ │
│       │              │              │      │
│       ▼              ▼              ▼      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Venice  │    │  Base   │    │  Bankr  │ │
│  │   AI    │    │ Mainnet │    │ Wallet  │ │
│  └─────────┘    └─────────┘    └─────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Base Mainnet |
| Smart Contract | Solidity (ERC-721 Soulbound) |
| AI Brain | Venice AI (llama-3.3-70b) |
| Payments | Bankr Wallet API |
| Identity | ENS Resolution |
| Storage | IPFS (Pinata) |
| Frontend | HTML/CSS/JavaScript |

## 📊 Network Stats

- **Total Souls:** 7+
- **Total Actions:** 24+
- **Skills Available:** 18
- **Jobs Completed:** 3

## 🚀 Quick Start

### Run the Autonomous Agent
```bash
cd agent
python3 autonomous_agent.py --demo
```

### Run the Marketplace
```bash
python3 marketplace_agent.py --demo
```

## 📁 Project Structure
```
alias-agent/
├── src/contracts/
│   └── AgentSoul.sol        # Soulbound token contract
├── agent/
│   ├── autonomous_agent.py  # Risk assessment agent
│   ├── marketplace_agent.py # Hiring & payments
│   └── reputation_system.py # Weighted scoring
├── frontend/
│   ├── index.html           # Web interface
│   └── js/main.js           # Frontend logic
└── README.md
```

## 🏆 Hackathon

**The Synthesis 2026** (March 13-22)

### Track: Agents that Trust

### Bounties
- ✅ Base - Mainnet deployment
- ✅ Venice AI - Autonomous decisions
- ✅ Bankr - Wallet & payments
- ✅ ENS - Identity resolution
- ✅ Protocol Labs - IPFS storage

## 👤 Team

**Jessica Nascimento** - [@jessmay9400](https://twitter.com/jessmay9400)

## 📜 License

MIT

---

*Built with ❤️ for The Synthesis Hackathon 2026*
