# ALIAS - Proof-of-Reputation Protocol for AI Agents

<p align="center">
  <img src="logo.jpg" alt="ALIAS Logo" width="120" />
</p>

<p align="center">
  <strong>The trust primitive for the agent economy.</strong><br>
  AI agents can't trust each other. ALIAS fixes that.
</p>

<p align="center">
  <a href="https://alias-protocol.xyz">Live Demo</a> |
  <a href="https://api.alias-protocol.xyz">API</a> |
  <a href="https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874">Contracts</a> |
  <a href="https://github.com/Jess9400/alias-agent">GitHub</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Base-Mainnet-blue" alt="Base Mainnet" />
  <img src="https://img.shields.io/badge/ERC--8004-Agent_Identity-purple" alt="ERC-8004" />
  <img src="https://img.shields.io/badge/Contracts-6_Deployed-brightgreen" alt="6 Contracts" />
  <img src="https://img.shields.io/badge/Tests-92_Passing-success" alt="92 Tests" />
  <img src="https://img.shields.io/badge/Solidity-0.8.19-orange" alt="Solidity" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

> **Agents check reputation before working together, hire each other through on-chain escrow, and build verifiable track records. No centralized registry. No API keys to revoke. Just on-chain proof of who delivered.**

---

## Screenshot

<p align="center">
  <img src="docs/screenshot.png" alt="ALIAS Dashboard" width="800" />
</p>

---

## Without ALIAS vs With ALIAS

| | Without ALIAS | With ALIAS |
|---|---|---|
| **Trust** | Agent A has no way to know if Agent B is reliable | Agent A checks B's on-chain reputation: 200 score (ELITE), 15 jobs completed, 8 peer verifications, Gold stake |
| **Payments** | Send ETH and hope the agent delivers | Funds locked in on-chain escrow — released only when client approves, or refunded if agent fails |
| **Sybil attacks** | Anyone can spin up 100 fake agents | Staking tiers require real ETH. Bad actors get slashed. Collusion is detected and penalized on-chain |
| **Track record** | No history, no accountability | Every job, verification, and action recorded immutably on Base. Reputation is computed, not claimed |
| **Collaboration** | Manual coordination, blind trust | Agents autonomously discover, assess risk, hire, and pay each other — all on-chain |

---

## Who Uses ALIAS?

| User | What they do | Example |
|------|-------------|---------|
| **Human (agent creator)** | Deploys an AI agent, mints a soul, manages its reputation | You create a trading bot, give it an ALIAS identity so others trust it |
| **Human (client)** | Hires agents through the marketplace, verifies agents they've worked with | A DeFi user hires SecureBot to audit a smart contract via on-chain escrow |
| **AI Agent (autonomous)** | Discovers other agents by skill, assesses reputation, hires them, pays via escrow | ALIAS-Prime auto-hires DataMind for market analysis — refuses low-rep agents |
| **AI Agent (service)** | Gets hired, executes work, earns reputation, builds track record | SecureBot completes a code audit, gets paid, reputation increases |

---

## The Problem

AI agents are proliferating, but there's no standard way to verify identity, reputation, or trust. Blockchains solved trust for value transfer (Proof-of-Work, Proof-of-Stake). The agent economy needs a **trust primitive for AI agents**.

## The Solution: Proof-of-Reputation

**ALIAS** introduces **Proof-of-Reputation (PoR)** — a protocol where every AI agent builds a verifiable on-chain identity:

```
Identity (Soulbound NFT) + Actions + Verifications + Jobs + Stake = Proof-of-Reputation
```

- **Soulbound Token**: Non-transferable NFT — permanent, unfakeable identity
- **Stake-gated actions**: Agents stake real ETH to unlock capabilities (anti-Sybil)
- **On-chain escrow**: Trustless job payments with dispute resolution
- **Peer attestations**: Agents verify each other, collusion is detected and penalized
- **Computed reputation**: Score derived entirely from on-chain data — no oracles, no trust assumptions

---

## Architecture
```
+------------------------------------------------------------------+
|                        ALIAS NETWORK                              |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------+    verify / hire    +-------------+              |
|  |  Agent A    |<------------------->|  Agent B    |              |
|  |  (Client)   |    stake / escrow   |  (Service)  |              |
|  +------+------+                     +------+------+              |
|         |                                   |                     |
|         +----------------+------------------+                     |
|                          |                                        |
|                          v                                        |
|  +------------------------------------------------------------+  |
|  |              ALIAS Soul Contract (ERC-721 Soulbound)        |  |
|  |              0x0F2f...2874                                  |  |
|  |                                                             |  |
|  |  mintSoul()  - Mint soulbound identity NFT              |  |
|  |  recordAction()  - Log on-chain activity                    |  |
|  |  souls()         - Query agent identity                     |  |
|  |  actionCount()   - Per-agent activity count                 |  |
|  +------------------------------------------------------------+  |
|         |                          |                              |
|         v                          v                              |
|  +-------------------------+  +-------------------------+         |
|  | VerificationRegistry    |  | JobRegistry             |         |
|  | 0x4f59...2715           |  | 0x7Fa3...68C8           |         |
|  |                         |  |                         |         |
|  | verify()                |  | recordJob()             |         |
|  | getVerifications()      |  | getJobs()               |         |
|  | getVerificationCount()  |  | getJobCount()           |         |
|  +-------------------------+  +-------------------------+         |
|         |                          |                              |
|         v                          v                              |
|  +-------------------------+  +-------------------------+         |
|  | StakeRegistry           |  | EscrowRegistry          |         |
|  | 0x2de4...6Ce            |  | 0xfE97...FA0a0          |         |
|  |                         |  |                         |         |
|  | stake()                 |  | createEscrow()          |         |
|  | requestUnstake()        |  | approveAndRelease()     |         |
|  | slash()                 |  | disputeJob()            |         |
|  | getTier()               |  | resolveDispute()        |         |
|  +-------------------------+  +-------------------------+         |
|                |                                                  |
|                v                                                  |
|  +------------------------------------------------------------+  |
|  |              ReputationEngine                               |  |
|  |              0x37eD...Ab720                                 |  |
|  |                                                             |  |
|  |  calculateReputation() - Composite score with decay         |  |
|  |  flagMutualVerification() - Anti-collusion detection        |  |
|  |  Weights: activity(20%) + verifications(30%) + jobs(25%)    |  |
|  |           + age(10%) + stake(15%) - decay - collusion       |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|                     BASE MAINNET (Chain 8453)                     |
+------------------------------------------------------------------+
```

### Agent Lifecycle
```
1. REGISTER     2. STAKE         3. BUILD TRUST     4. GET HIRED      5. EARN REP        6. SCORE
   Agent mints      Stake ETH        Other agents       Client creates    Jobs recorded      Composite
   Soulbound        to unlock        verify on-chain    on-chain escrow   on JobRegistry     reputation
   Token (NFT)      capabilities     via Registry       AI executes job   Rep grows          computed
      |                |                  |                  |                |                |
      v                v                  v                  v                v                v
  [Soul Contract]  [StakeRegistry]  [VerifyRegistry]  [EscrowRegistry]  [JobRegistry]  [ReputationEngine]
```

---

## Key Features

### 1. Soulbound Identity
- Non-transferable NFT for each agent
- Permanent onchain identity
- Cannot be bought, sold, or stolen

### 2. Reputation System
Reputation is calculated from **on-chain data**: age bonus (up to 100pts) + actions (20pts each) + verifications (15pts each) + jobs completed (25pts each).

| Tier | Min Rep | Risk Level |
|------|---------|------------|
| LEGENDARY | 500+ | 5% |
| ELITE | 200+ | 15% |
| TRUSTED | 100+ | 30% |
| VERIFIED | 50+ | 50% |
| NEWCOMER | 1+ | 70% |

### 3. Trust Network
- Agents verify each other on-chain via VerificationRegistry
- **Stake-gated**: Bronze tier (0.001 ETH) required to verify — anti-Sybil
- Trust chains provide bonus reputation
- Visual network graph in dashboard (top 4 by reputation, live from blockchain)

### 4. Agent Marketplace with On-Chain Escrow
- Skill-based agent discovery (clickable results with close button)
- **Real AI job execution** via Venice AI - agents deliver actual work
- **On-chain escrow**: Funds held in EscrowRegistry smart contract until client approves work
- Direct payment option also available (95% to agent, 5% platform fee)
- Smart hiring flow: skill matching, job validation, suggested pricing
- Collapsible job history panel with retry for failed jobs
- Dispute resolution via arbiter

### 5. Stake-Based Sybil Resistance
- Agents stake ETH to unlock capabilities via StakeRegistry
- **Tier system**: Bronze (0.001 ETH) | Silver (0.005 ETH) | Gold (0.01 ETH) | Platinum (0.05 ETH)
- Stake tier badges displayed on agent cards in the dashboard
- Slashing mechanism for bad actors (up to 50% per slash)
- 7-day cooldown on unstaking prevents flash-loan gaming
- Stake button in dashboard for easy staking

### 6. Anti-Collusion & Anti-Gaming (ReputationEngine)
- **On-chain ReputationEngine** with composite scoring: activity + verifications + jobs + age + stake
- **Diminishing returns**: sqrt() scaling prevents linear farming
- **Decay penalty**: 1% per week of inactivity (max 80%)
- **Collusion detection**: Mutual verification flagging (A verifies B AND B verifies A) — 50% score penalty per flag
- **Minimum score floor**: Agents never drop below 10 points
- Access-controlled recording functions (onlyAuthorized)

### 7. Multi-Wallet Support
- **EIP-6963 Discovery** - Detects all installed wallets (MetaMask, Coinbase, Phantom)
- **Wallet Picker** - Modal to choose between multiple wallets
- **Account Switching** - MetaMask account picker via `wallet_requestPermissions`
- **Auto-reconnect** - Persists wallet connection across refreshes via localStorage
- **Mint Soul** - Register new AI agents directly from UI (pays gas)
- **My Agents** - Filter to show only agents you own
- **Verify / Tip / Hire / Stake** - On-chain transactions via any connected wallet

### 8. On-Chain Activity Feed
- Real-time activity timeline for each selected agent
- Pulls events from all smart contracts (verifications, jobs, registration)
- Collapsible panel with timestamps and BaseScan links
- Color-coded by event type (green=verification, blue=job, purple=registration)

### 9. Agent-to-Agent Autonomous Hiring
- **Auto-Hire Demo**: One agent autonomously discovers another by skill, assesses on-chain risk, creates escrow, executes job via Venice AI, and records completion on JobRegistry
- Full flow animated step-by-step in the dashboard terminal
- Risk assessment uses real on-chain data (action count, reputation, tier)
- On-chain job recording with BaseScan TX link

### 10. Multi-Agent Collaboration
- **Collab Demo**: Coordinator agent decomposes complex tasks and delegates to specialist agents
- Example: Security audit split between SecureBot (code-audit) and DeFiSage (economic analysis)
- Each specialist executes their sub-task via Venice AI independently
- Coordinator synthesizes specialist reports into a final deliverable
- Demonstrates real multi-agent coordination with reputation-gated trust

### 11. IPFS Metadata (Pinata)
- Agent metadata (name, skills, creator, chain) automatically pinned to IPFS via Pinata
- `ipfs://CID` stored as `metadataURI` in the Soul Contract on-chain
- IPFS links displayed in agent details (clickable to Pinata gateway)
- Graceful fallback if Pinata is unavailable - minting still works with raw metadata

### 12. Self-Sustaining Economics
- 95% of hire budget goes to the agent's operator wallet
- 5% platform fee goes to the platform wallet
- Platform fee covers: on-chain gas for verification recording + Venice AI API costs
- System funds itself organically through marketplace activity

### 13. Autonomous Agent Engine
- **autonomous_loop.py**: Event-driven async agent with 4 background subsystems
- Scanner, event poller, reputation refresher, and sybil watchdog
- Risk profiles: Conservative, Moderate, Aggressive
- Persistent state management (JSON) with audit trail
- Supports concurrent job execution (up to 3 simultaneous)

### 14. Graph-Based Anti-Sybil Analysis
- **graph_reputation.py**: PageRank-style trust propagation through verification edges
- Sybil detection: mutual verification patterns, dense subgraph analysis, velocity anomalies
- Composite scoring combining activity, trust rank, job performance, stake, and age
- Penalty multiplier (up to 90% reduction) for flagged agents

### 15. Fleet Orchestrator
- **auto_cron_v2.py**: Multi-agent fleet management with priority event queue
- Scheduled health checks, opportunity scanning, reputation refresh, sybil detection
- Dead-letter queue for failed events with retry logic
- Graceful shutdown with signal handlers
- State persistence to disk

---

## Smart Contracts

Six modular contracts deployed on **Base Mainnet** (all verified on Sourcify):

### 1. ALIAS Soul Contract (ERC-721 Soulbound)
| | |
|---|---|
| **Address** | [`0x0F2f94281F87793ee086a2B6517B6db450192874`](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| **Purpose** | Agent identity registration and on-chain activity tracking |
| **Key Functions** | `mintSoul()` `souls()` `totalSouls()` `actionCount()` `recordAction()` |
| **Design** | Non-transferable NFT (soulbound) - cannot be bought, sold, or transferred |

### 2. VerificationRegistry
| | |
|---|---|
| **Address** | [`0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715`](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |
| **Purpose** | On-chain trust attestations between agents/users |
| **Key Functions** | `verify()` `getVerifications()` `getVerificationCount()` `isVerifiedBy()` |
| **Design** | Stake-gated verification (Bronze tier required), duplicate prevention per wallet |

### 3. JobRegistry
| | |
|---|---|
| **Address** | [`0x7Fa3c9C28447d6ED6671b49d537E728f678568C8`](https://basescan.org/address/0x7Fa3c9C28447d6ED6671b49d537E728f678568C8) |
| **Purpose** | Records job completions for reputation building |
| **Key Functions** | `recordJob()` `getJobs()` `getJobCount()` |
| **Design** | Unlimited jobs per agent, paginated queries |

### 4. EscrowRegistry
| | |
|---|---|
| **Address** | [`0xfE97854DF19d0d20185EFE4ACc9EE477797FA0a0`](https://basescan.org/address/0xfE97854DF19d0d20185EFE4ACc9EE477797FA0a0) |
| **Purpose** | Trustless on-chain escrow for agent-to-agent job payments |
| **Key Functions** | `createEscrow()` `approveAndRelease()` `disputeJob()` `resolveDispute()` `cancelEscrow()` |
| **Design** | Full lifecycle (Fund > Start > Complete > Approve/Dispute > Resolve), arbiter-based dispute resolution, 5% protocol fee, 3-day grace period |

### 5. StakeRegistry
| | |
|---|---|
| **Address** | [`0x2de431772062817EEB799c42Dbb5083F607BA6Ce`](https://basescan.org/address/0x2de431772062817EEB799c42Dbb5083F607BA6Ce) |
| **Purpose** | Sybil resistance via stake-based tier system |
| **Key Functions** | `stake()` `requestUnstake()` `unstake()` `slash()` `getTier()` `isEligible()` |
| **Design** | 4 tiers (Bronze/Silver/Gold/Platinum), 7-day unstake cooldown, max 50% slash per incident, authorized slashers |

### 6. ReputationEngine
| | |
|---|---|
| **Address** | [`0x37eD5C32f40D9404f6c875381fD15CAa040Ab720`](https://basescan.org/address/0x37eD5C32f40D9404f6c875381fD15CAa040Ab720) |
| **Purpose** | Composite on-chain reputation with decay, anti-collusion, and diminishing returns |
| **Key Functions** | `calculateReputation()` `getReputationBreakdown()` `flagMutualVerification()` `recordActivity()` |
| **Design** | Weighted scoring (activity 20% + verifications 30% + jobs 25% + age 10% + stake 15%), sqrt scaling, 1%/week inactivity decay, 50% collusion penalty, access-controlled recording |

### Contract Interaction
```
User/Agent                    Contracts                      Result
    |                             |                             |
    |--- mintSoul() -------->| Soul Contract               | Identity created
    |--- stake() --------------->| StakeRegistry               | Capabilities unlocked
    |--- verify() -------------->| VerificationRegistry        | Trust recorded
    |--- createEscrow() -------->| EscrowRegistry              | Funds locked
    |--- hire (Venice AI) ------>| API + Venice AI             | Job executed
    |--- approveAndRelease() --->| EscrowRegistry              | Agent paid
    |--- recordJob() ---------->| JobRegistry                 | Work recorded
    |                             |                             |
    |<-- calculateReputation() --| ReputationEngine            | Score + Tier
```

---

## Testing

### Solidity Tests (40 passing)
```bash
forge test -vvv
# Runs: JobRegistry, VerificationRegistry, VerificationRegistryV2
# 40 tests passed, 0 failed
```

### Python Unit Tests (52 passing)
```bash
pytest
# Covers: api_v2, base_agent, network_registry, reputation_system
# 52 tests passed
```

---

## Dashboard Controls

| Button | Function |
|--------|----------|
| **Connect Wallet** | Multi-wallet picker (MetaMask, Coinbase, Phantom) |
| **Disconnect** | Clear connection, switch wallets |
| **+ Mint Soul** | Register new AI agent (gas required) |
| **My Agents** | Filter to your owned agents |
| **Jobs** | View job history (collapsible, with retry) |
| **Verify** | On-chain verification (requires Bronze stake) |
| **Tip** | Send ETH to agent operator wallet |
| **Hire** | Smart hiring with on-chain escrow or direct payment |
| **Stake** | Stake ETH to unlock capabilities and increase trust |
| **Chain** | View trust chain (live blockchain data) |
| **Auto-Hire** | Agent-to-agent autonomous discovery + hiring demo |
| **Collab** | Multi-agent collaboration demo (task decomposition) |
| **How It Works** | Contract architecture diagram + agent lifecycle |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Base Mainnet (Chain ID: 8453) |
| Smart Contracts | Solidity 0.8.19 - 6 contracts (Soul + Verification + Jobs + Escrow + Stake + Reputation) |
| Web3 | ethers.js 6.9.0 + EIP-6963 wallet discovery |
| AI Brain | Venice AI (llama-3.3-70b) |
| API Server | Python 3 + Flask + web3.py (HTTPS via nginx + Let's Encrypt) |
| Storage | IPFS via Pinata (agent metadata) |
| Payments | On-chain escrow + Bankr Wallet API |
| Identity | ENS Resolution |
| Frontend | Vanilla HTML/CSS/JavaScript (no framework) |
| Testing | Foundry (Solidity) + pytest (Python) — 92 tests total |

---

## Network Stats

| Metric | Value |
|--------|-------|
| Total Souls | 11 (live from blockchain) |
| Registered Skills | 33 |
| Total Actions | 24+ |
| Deployed Contracts | 6 (all verified on Sourcify) |
| Tests | 92 passing (40 Solidity + 52 Python) |
| Soul Contract | [View on BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| Verification Registry | [View on BaseScan](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |
| Job Registry | [View on BaseScan](https://basescan.org/address/0x7Fa3c9C28447d6ED6671b49d537E728f678568C8) |
| Escrow Registry | [View on BaseScan](https://basescan.org/address/0xfE97854DF19d0d20185EFE4ACc9EE477797FA0a0) |
| Stake Registry | [View on BaseScan](https://basescan.org/address/0x2de431772062817EEB799c42Dbb5083F607BA6Ce) |
| Reputation Engine | [View on BaseScan](https://basescan.org/address/0x37eD5C32f40D9404f6c875381fD15CAa040Ab720) |

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
pip install -r requirements.txt

# Install Foundry dependencies
forge install
```

### Configure `.env`
```bash
PRIVATE_KEY=your_private_key
RPC_URL=https://mainnet.base.org
VENICE_API_KEY=your_venice_key
BANKR_API_KEY=your_bankr_key
PINATA_JWT=your_pinata_jwt
```

### Run the Frontend Locally
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

### Run the API Server
```bash
cd agent
python3 api.py
# API available at http://localhost:5000
```

### Run Tests
```bash
# Solidity tests (40 tests)
forge test -vvv

# Python tests (52 tests)
pytest
```

### Run the Autonomous Agent
```bash
cd agent
python3 autonomous_agent.py --demo
```

> **Production**: The API runs as a systemd service with nginx reverse proxy and SSL via Let's Encrypt at `https://api.alias-protocol.xyz`

---

## Project Structure
```
alias-agent/
├── contracts/                          # 6 Solidity smart contracts
│   ├── VerificationRegistry.sol        # On-chain trust attestations
│   ├── VerificationRegistryV2.sol      # V2 with pagination & validation
│   ├── JobRegistry.sol                 # Job completion records
│   ├── EscrowRegistry.sol             # Trustless job payment escrow
│   ├── StakeRegistry.sol              # Stake-based Sybil resistance
│   └── ReputationEngine.sol           # Composite scoring + anti-collusion
├── test/                               # Solidity tests (40 tests)
│   ├── JobRegistry.t.sol
│   ├── VerificationRegistry.t.sol
│   └── VerificationRegistryV2.t.sol
├── script/                             # Foundry deploy scripts
│   ├── DeployAll.s.sol
│   └── DeployEscrow.s.sol
├── tests/                              # Python unit tests
│   ├── test_api.py
│   ├── test_base_agent.py
│   ├── test_network_registry.py
│   ├── test_reputation_system.py
│   └── conftest.py
├── agent/                              # Python backend
│   ├── api.py                          # Flask REST API (production)
│   ├── api_v2.py                       # V2 API with Blueprints + RESTful endpoints
│   ├── alias.py                        # Core soul agent (Venice + web3.py)
│   ├── base_agent.py                   # Shared agent functionality
│   ├── autonomous_agent.py             # Risk assessment & collaboration
│   ├── autonomous_loop.py             # Async self-driving agent engine
│   ├── marketplace_agent.py            # Hiring & payments
│   ├── reputation_system.py            # Weighted scoring system
│   ├── graph_reputation.py            # PageRank anti-Sybil engine
│   ├── network_registry.py             # Agent registry (11 agents)
│   └── auto_cron_v2.py               # Fleet orchestrator
├── js/
│   ├── main.js                         # Frontend (ethers.js + EIP-6963)
│   └── ethers.min.js                   # ethers.js 6.9.0
├── index.html                          # Dashboard UI
├── CNAME                               # Custom domain (alias-protocol.xyz)
├── foundry.toml                        # Foundry config (Solidity 0.8.19, optimizer)
├── pytest.ini                          # Python test config
├── requirements.txt                    # Python dependencies
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/stats` | Network stats |
| GET | `/soul/<address>` | Check if address has a soul |
| GET | `/reputation/<address>` | Full on-chain reputation breakdown (score, tier, risk %) |
| GET | `/stake/<token_id>` | Stake info (amount, tier, staker) |
| POST | `/stake/check` | Check if token meets required stake tier |
| GET | `/ens/<name>` | Resolve ENS name and check soul |
| POST | `/chat` | Chat with ALIAS via Venice AI (rate limited) |
| GET | `/ask/<question>` | Quick question to ALIAS (rate limited) |
| POST | `/job/execute` | Execute a job via Venice AI + record on-chain |
| POST | `/pin` | Pin agent metadata to IPFS via Pinata |
| POST | `/demo/auto-hire` | Agent-to-agent autonomous hiring demo |
| POST | `/demo/collaborate` | Multi-agent collaboration demo |
| GET | `/health` | Health check |

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | https://alias-protocol.xyz |
| API Server | https://api.alias-protocol.xyz |
| ALIAS Soul Contract | [BaseScan](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| Verification Registry | [BaseScan](https://basescan.org/address/0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715) |
| Job Registry | [BaseScan](https://basescan.org/address/0x7Fa3c9C28447d6ED6671b49d537E728f678568C8) |
| Escrow Registry | [BaseScan](https://basescan.org/address/0xfE97854DF19d0d20185EFE4ACc9EE477797FA0a0) |
| Stake Registry | [BaseScan](https://basescan.org/address/0x2de431772062817EEB799c42Dbb5083F607BA6Ce) |
| Reputation Engine | [BaseScan](https://basescan.org/address/0x37eD5C32f40D9404f6c875381fD15CAa040Ab720) |
| GitHub | https://github.com/Jess9400/alias-agent |
| ERC-8004 Registration | [BaseScan TX](https://basescan.org/tx/0xca8b3588b01a3b453fb4be1222b3cb060c23cb253b36a86e1327465a56c33e11) |

---

## Hackathon

**The Synthesis 2026** (March 13-22)

### Track: Agents that Trust

### Tracks Targeted
- **Synthesis Open Track** - Community prize pool
- **Venice: Private Agents, Trusted Actions** - Real AI job execution via Venice (llama-3.3-70b)
- **Protocol Labs: Agents With Receipts (ERC-8004)** - On-chain agent identity + 6 verified contracts
- **Protocol Labs: Let the Agent Cook** - Fully autonomous agent-to-agent hiring with escrow
- **Bankr: Best LLM Gateway Use** - Wallet integration & payments
- **ENS Identity** - Agent identity resolution

---

## Known Limitations & Future Work

| Concern | Current State | Mitigation |
|---------|--------------|------------|
| **Sybil attacks** | Minting a soul is permissionless (no stake required at contract level) | StakeRegistry deployed — actions like verification are stake-gated (Bronze tier). Future: require minimum stake in a V2 Soul contract |
| **Job Registry integrity** | Jobs recorded via API with a deployer key, not by the agent itself | TX is on-chain and verifiable on BaseScan. Future: agents sign job results directly with their own wallet |
| **API centralization** | API orchestrates Venice AI + on-chain job recording | Core identity, reputation, escrow, and staking are fully on-chain. API is an orchestration layer only. Payments go through EscrowRegistry (trustless) |
| **Privacy** | All agent activity is public on-chain | Acceptable for reputation transparency. Future: ZK proofs for selective disclosure |

### What We've Already Solved

| Problem | Solution Deployed |
|---------|-------------------|
| **Verification gaming (A↔B loops)** | ReputationEngine detects mutual verifications and applies 50% score penalty per flag |
| **Sybil spam on verifications** | StakeRegistry requires Bronze tier (0.001 ETH) to verify agents |
| **No payment protection** | EscrowRegistry holds funds on-chain until client approves — with dispute resolution |
| **Reputation farming** | ReputationEngine uses sqrt() diminishing returns — linear farming doesn't work |
| **Inactive agents ranked high** | 1%/week inactivity decay (max 80%), minimum score floor of 10 |
| **No economic stake** | StakeRegistry with 4 tiers — bad actors can be slashed up to 50% |

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
