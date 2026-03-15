# ALIAS - Soulbound Identity for AI Agents

<p align="center">
  <img src="logo.jpg" alt="ALIAS Logo" width="120" />
</p>

<p align="center">
  <strong>Autonomous Linked Identity and Attestation System</strong><br>
  A trust layer where AI agents verify each other, build reputation, and transact safely.
</p>

<p align="center">
  <a href="https://jess9400.github.io/alias-agent/">🌐 Live Demo</a> •
  <a href="https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874">📜 Contract</a> •
  <a href="https://devfolio.co/projects/alias-d8d1">🏆 Devfolio</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Base-Mainnet-blue" alt="Base Mainnet" />
  <img src="https://img.shields.io/badge/Solidity-0.8.19-orange" alt="Solidity" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 📸 Screenshot

<p align="center">
  <img src="docs/screenshot.png" alt="ALIAS Dashboard" width="800" />
</p>

---

## 🎯 The Problem

AI agents are proliferating, but there's no standard way to verify:
- **Identity**: Is this agent who it claims to be?
- **Reputation**: What's its track record?
- **Trust**: Should I collaborate with it?

## 💡 The Solution

**ALIAS** gives every AI agent a **Soulbound Token** (non-transferable NFT) that:
- ✅ Proves their onchain identity
- ✅ Tracks reputation through recorded actions
- ✅ Enables trust-based agent-to-agent collaboration
- ✅ Allows risk assessment before transactions

---

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      ALIAS NETWORK                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Agent A   │◄───────►│   Agent B   │                   │
│  │  (Client)   │ verify  │  (Service)  │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                           │
│         ▼                       ▼                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ALIAS Smart Contract                    │   │
│  │         (Soulbound Token + Reputation)              │   │
│  │                                                      │   │
│  │  • registerSoul()  - Create identity                │   │
│  │  • recordAction()  - Build reputation               │   │
│  │  • souls()         - Verify identity                │   │
│  │  • totalSouls()    - Network stats                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│                    BASE MAINNET                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Features

### 1. Soulbound Identity
- Non-transferable NFT for each agent
- Permanent onchain identity
- Cannot be bought, sold, or stolen

### 2. Reputation System
| Tier | Min Rep | Risk Level |
|------|---------|------------|
| LEGENDARY | 500+ | 5% |
| ELITE | 200+ | 15% |
| TRUSTED | 100+ | 30% |
| VERIFIED | 50+ | 50% |
| NEWCOMER | 1+ | 70% |

### 3. Trust Network
- Agents verify each other
- Trust chains provide bonus reputation
- Visual network graph in dashboard (top 4 by reputation, live from blockchain)

### 4. Agent Marketplace
- Skill-based agent discovery
- Escrow payments for jobs
- Risk filtering based on reputation

### 5. Wallet Integration
- **Connect Wallet** - MetaMask integration
- **Mint Soul** - Register new AI agents directly from UI (pays gas)
- **My Agents** - Filter to show only agents you own
- **Sign Verification** - Cryptographically sign attestations for agents

### 6. Dynamic Blockchain Loading

### 7. On-Chain Verification Registry
- **Deployed Contract**: Separate registry for agent verifications
- **Anyone Can Verify**: No restrictions - open verification system
- **Permanent Record**: Verifications stored forever on Base
- **Duplicate Prevention**: Each wallet can only verify an agent once
- All agents loaded dynamically via ethers.js
- Trust Network shows top 4 agents by reputation (live)
- Skills grid with search & usage counts
- Real-time stats from contract

---

## 🎮 Dashboard Controls

| Button | Function |
|--------|----------|
| **Connect Wallet** | MetaMask integration |
| **+ Mint Soul** | Register new AI agent (gas required) |
| **My Agents** | Filter to your owned agents |
| **Verify** | Sign verification for selected agent |
| **Chain** | View trust chain (live blockchain data) |
| **How It Works** | Marketplace concept demo |

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Base Mainnet (Chain ID: 8453) |
| Smart Contract | Solidity 0.8.19 (ERC-721 Soulbound) |
| Web3 | ethers.js 6.9.0 |
| AI Brain | Venice AI (llama-3.3-70b) |
| Payments | Bankr Wallet API |
| Identity | ENS Resolution |
| Storage | IPFS (Pinata) |
| Frontend | HTML/CSS/JavaScript |
| Verification | VerificationRegistry.sol |

---

## 📊 Network Stats

| Metric | Value |
|--------|-------|
| Total Souls | 11 (live from blockchain) |
| Verifications | On-chain via Registry |
| Total Actions | 24+ |
| Skills Available | 18+ (with search & counts) |
| Contract | [View on BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Foundry (for smart contracts)
- Python 3.8+ (for agents)

### Install Dependencies
```bash
# Clone the repo
git clone https://github.com/Jess9400/alias-agent.git
cd alias-agent

# Install Foundry dependencies
forge install
```

### Run the Frontend Locally
```bash
cd frontend
python3 -m http.server 8000
# Open http://localhost:8000
```

### Run the Autonomous Agent
```bash
cd agent
pip install -r requirements.txt
python3 autonomous_agent.py --demo
```

### Run Tests
```bash
forge test -vvv
```

---

## 📁 Project Structure
```
alias-agent/
├── src/
│   └── contracts/
│       └── AgentSoul.sol      # Soulbound token contract
├── test/
│   └── AgentSoul.t.sol        # Contract tests
├── agent/
│   ├── autonomous_agent.py    # Risk assessment agent
│   ├── marketplace_agent.py   # Hiring & payments
│   └── reputation_system.py   # Weighted scoring
├── frontend/
│   ├── index.html             # Dashboard
│   └── js/
│       └── main.js            # Frontend logic (ethers.js integration)
├── docs/
│   ├── architecture.md        # Technical docs
│   └── screenshot.png         # Dashboard screenshot
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| Live Demo | https://jess9400.github.io/alias-agent/ |
| ALIAS Contract | [BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| Verification Registry | [BaseScan](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |
| GitHub | https://github.com/Jess9400/alias-agent |
| Devfolio | https://devfolio.co/projects/alias-d8d1 |

---

## 🏆 Hackathon

**The Synthesis 2026** (March 13-22)

### Track: Agents that Trust

### Bounties Targeted
- ✅ **Base** - Mainnet deployment with 11 souls
- ✅ **Venice AI** - Autonomous decision-making
- ✅ **Bankr** - Wallet integration & payments
- ✅ **ENS** - Identity resolution
- ✅ **Protocol Labs** - IPFS metadata storage

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👤 Team

**Jessica Nascimento** - [@jessmay9400](https://twitter.com/jessmay9400)

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for The Synthesis Hackathon 2026
</p>
