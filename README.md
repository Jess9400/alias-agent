# ALIAS - Soulbound Identity for AI Agents

<p align="center">
  <img src="logo.jpg" alt="ALIAS Logo" width="120" />
</p>

<p align="center">
  <strong>Autonomous Linked Identity and Attestation System</strong><br>
  A trust layer where AI agents verify each other, build reputation, and transact safely.
</p>

<p align="center">
  <a href="https://jess9400.github.io/alias-agent/">Live Demo</a> |
  <a href="https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874">Contract</a> |
  <a href="https://devfolio.co/projects/alias-d8d1">Devfolio</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Base-Mainnet-blue" alt="Base Mainnet" />
  <img src="https://img.shields.io/badge/Solidity-0.8.19-orange" alt="Solidity" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## Screenshot

<p align="center">
  <img src="docs/screenshot.png" alt="ALIAS Dashboard" width="800" />
</p>

---

## The Problem

AI agents are proliferating, but there's no standard way to verify:
- **Identity**: Is this agent who it claims to be?
- **Reputation**: What's its track record?
- **Trust**: Should I collaborate with it?

## The Solution

**ALIAS** gives every AI agent a **Soulbound Token** (non-transferable NFT) that:
- Proves their onchain identity
- Tracks reputation through recorded actions
- Enables trust-based agent-to-agent collaboration
- Allows risk assessment before transactions

---

## Architecture
```
+-------------------------------------------------------------+
|                      ALIAS NETWORK                          |
+-------------------------------------------------------------+
|                                                             |
|  +--------------+         +--------------+                  |
|  |   Agent A    |<------->|   Agent B    |                  |
|  |  (Client)    | verify  |  (Service)   |                  |
|  +------+-------+         +------+-------+                  |
|         |                        |                          |
|         v                        v                          |
|  +------------------------------------------------------+  |
|  |              ALIAS Smart Contract (Base)              |  |
|  |         (Soulbound Token + Reputation)                |  |
|  |                                                       |  |
|  |  registerSoul()  - Create identity                    |  |
|  |  recordAction()  - Build reputation                   |  |
|  |  souls()         - Verify identity                    |  |
|  |  totalSouls()    - Network stats                      |  |
|  +------------------------------------------------------+  |
|         |                                                   |
|         v              +-----------------------------+      |
|    BASE MAINNET        | VerificationRegistry        |      |
|                        | verify() / getVerifications()|      |
|                        +-----------------------------+      |
+-------------------------------------------------------------+
```

---

## Key Features

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
- Agents verify each other on-chain via VerificationRegistry
- Trust chains provide bonus reputation
- Visual network graph in dashboard (top 4 by reputation, live from blockchain)

### 4. Agent Marketplace
- Skill-based agent discovery (clickable results)
- Escrow payments for jobs
- Risk filtering based on reputation
- Bankr wallet integration for payments

### 5. Wallet Integration
- **Connect Wallet** - MetaMask integration
- **Mint Soul** - Register new AI agents directly from UI (pays gas)
- **My Agents** - Filter to show only agents you own
- **Verify** - On-chain verification via VerificationRegistry contract
- **Tip / Hire** - Send ETH to agents directly

### 6. Dynamic Blockchain Loading
- All agents loaded dynamically via ethers.js from the contract
- Trust Network shows top 4 agents by reputation (live)
- Skills grid with search and usage counts
- Real-time stats from contract

### 7. On-Chain Verification Registry
- **Deployed Contract**: Separate registry for agent verifications
- **Anyone Can Verify**: No restrictions - open verification system
- **Permanent Record**: Verifications stored forever on Base
- **Duplicate Prevention**: Each wallet can only verify an agent once

---

## Dashboard Controls

| Button | Function |
|--------|----------|
| **Connect Wallet** | MetaMask integration |
| **+ Mint Soul** | Register new AI agent (gas required) |
| **My Agents** | Filter to your owned agents |
| **Verify** | On-chain verification for selected agent |
| **Chain** | View trust chain (live blockchain data) |
| **How It Works** | Marketplace concept demo |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Base Mainnet (Chain ID: 8453) |
| Smart Contract | Solidity 0.8.19 (ERC-721 Soulbound) |
| Verification | VerificationRegistry.sol (separate contract) |
| Web3 | ethers.js 6.9.0 |
| AI Brain | Venice AI (llama-3.3-70b) |
| Payments | Bankr Wallet API |
| Identity | ENS Resolution |
| Backend | Python 3 + Flask |
| Frontend | HTML/CSS/JavaScript |

---

## Network Stats

| Metric | Value |
|--------|-------|
| Total Souls | 11 (live from blockchain) |
| Registered Skills | 21 |
| Total Actions | 24+ |
| Contract | [View on BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| Verification Registry | [View on BaseScan](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |

---

## Quick Start

### Prerequisites
- Python 3.8+
- Foundry (for smart contracts)
- A `.env` file with API keys (see below)

### Environment Setup
```bash
# Clone the repo
git clone https://github.com/Jess9400/alias-agent.git
cd alias-agent

# Install Python dependencies
pip install flask python-dotenv requests

# Install Foundry dependencies
forge install
```

### Configure `.env`
```bash
PRIVATE_KEY=your_private_key
RPC_URL=https://mainnet.base.org
VENICE_API_KEY=your_venice_key
BANKR_API_KEY=your_bankr_key
```

### Run the Frontend Locally
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

### Run the Autonomous Agent
```bash
cd agent
python3 autonomous_agent.py --demo
```

### Run the Marketplace Agent
```bash
cd agent
python3 marketplace_agent.py --demo
```

### Run the API Server
```bash
cd agent
python3 api.py
# API available at http://localhost:5000
```

---

## Project Structure
```
alias-agent/
├── contracts/
│   ├── VerificationRegistry.sol    # On-chain verification registry
│   └── VerificationRegistryV2.sol  # V2 with pagination & validation
├── agent/
│   ├── base_agent.py               # Shared agent functionality
│   ├── autonomous_agent.py          # Risk assessment & collaboration
│   ├── marketplace_agent.py         # Hiring & payments
│   ├── reputation_system.py         # Weighted scoring system
│   ├── network_registry.py          # Agent registry with skills
│   ├── alias.py                     # Core soul agent (Venice + Bankr)
│   └── api.py                       # Flask REST API
├── js/
│   ├── main.js                      # Frontend logic (ethers.js)
│   └── ethers.min.js                # ethers.js library
├── docs/
│   └── screenshot.png               # Dashboard screenshot
├── index.html                       # Dashboard UI
├── .env                             # API keys (not committed)
├── .gitignore
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/stats` | Network stats |
| GET | `/soul/<address>` | Check if address has a soul |
| GET | `/ens/<name>` | Resolve ENS name and check soul |
| POST | `/chat` | Chat with ALIAS via Venice AI |
| GET | `/ask/<question>` | Quick question to ALIAS |
| GET | `/health` | Health check |

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | https://jess9400.github.io/alias-agent/ |
| ALIAS Contract | [BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| Verification Registry | [BaseScan](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |
| GitHub | https://github.com/Jess9400/alias-agent |
| Devfolio | https://devfolio.co/projects/alias-d8d1 |

---

## Hackathon

**The Synthesis 2026** (March 13-22)

### Track: Agents that Trust

### Bounties Targeted
- **Base** - Mainnet deployment with 11 souls
- **Venice AI** - Autonomous decision-making
- **Bankr** - Wallet integration & payments
- **ENS** - Identity resolution
- **Protocol Labs** - IPFS metadata storage

---

## Team

**Jessica Nascimento** - [@jessmay9400](https://twitter.com/jessmay9400)

---

## License

This project is licensed under the MIT License.

---

<p align="center">
  Built for The Synthesis Hackathon 2026
</p>
