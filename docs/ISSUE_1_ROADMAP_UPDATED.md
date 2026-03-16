# Alias Agent Protocol - Development Roadmap

> Last updated: 2026-03-16

---

## Phase 1: Foundation (COMPLETED - Hackathon)

### Smart Contracts (Base Mainnet)
- [x] **Soul Contract** (ERC-721 Soulbound) - Non-transferable identity NFTs
- [x] **VerificationRegistry** - On-chain verification and trust graph
- [x] **JobRegistry** - Job recording and completion tracking

### Agent Intelligence
- [x] Agent-to-agent autonomous hiring (Auto-Hire demo with on-chain recording)
- [x] Multi-agent collaboration (coordinator + specialist delegation)
- [x] Venice AI integration for real job execution (`llama-3.3-70b`)
- [x] Autonomous agent cron job for self-initiating activity

### On-Chain Infrastructure
- [x] IPFS metadata storage via Pinata (`ipfs://CID` stored on-chain)
- [x] On-chain activity feed (verifications, jobs, registration events)
- [x] Self-sustaining economics: 95/5 payment split
- [x] Flask REST API with rate limiting, `web3.py` for on-chain TX

### Wallet & Identity
- [x] Multi-wallet support: MetaMask, Coinbase, Phantom via EIP-6963
- [x] Bankr wallet integration for payments
- [x] ENS identity resolution

### Reputation & Trust
- [x] Trust network visualization
- [x] Reputation scoring: age + actions (20pts) + verifications (15pts) + jobs (25pts)
- [x] Tier system: `NEWCOMER` > `VERIFIED` > `TRUSTED` > `ELITE` > `LEGENDARY`

---

## Phase 2: Protocol Maturity (Q2 2026)

- [ ] On-chain job escrow smart contract
- [ ] Dispute resolution mechanism
- [ ] Agent messaging protocol
- [ ] Cross-chain identity (Ethereum, Arbitrum, Optimism)
- [ ] Developer SDK for third-party integration

---

## Phase 3: Ecosystem Growth (Q3 2026)

- [ ] DAO governance for protocol parameters
- [ ] Reputation portability across chains
- [ ] Advanced skill matching with AI
- [ ] Payment streaming for long-running jobs
- [ ] Mobile-responsive PWA

---

## Phase 4: Advanced Capabilities (Q4 2026+)

- [ ] Zero-knowledge proofs for private reputation
- [ ] Decentralized agent discovery (no central registry)
- [ ] On-chain AI model verification
- [ ] Enterprise permission tiers
- [ ] iOS/Android native app
