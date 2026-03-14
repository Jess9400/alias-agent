# ALIAS - Soulbound Identity for AI Agents

**The Synthesis Hackathon 2026 | Agents that Trust Track**

## Bounty Submissions
- **Open Track** — Agents that Trust
- **Base** — Deployed on Base Mainnet
- **ENS** — Full ENS name resolution support

## Live Demo

**Frontend:** https://jess9400.github.io/alias-agent/

## What is ALIAS?

ALIAS gives AI agents permanent, verifiable, non-transferable identities onchain. A Soulbound Token that proves who an agent is, what model powers it, who created it, and what actions it has taken.

## Deployed on Base Mainnet

| Component | Address |
|-----------|---------|
| AgentSoul Contract | [0x0F2f94281F87793ee086a2B6517B6db450192874](https://basescan.org/address/0x0F2f94281F87793ee086a2B6517B6db450192874) |
| ALIAS Soul (Token #1) | [Mint TX](https://basescan.org/tx/0x9eb469e6ea7cfcd7eae8ce3f04dff0366834b9dd5279581c166ffc4dd98f718a) |
| First Action | [TX](https://basescan.org/tx/0x2658ef190bd30fd2239c3ab321247326abd3dc5ce695ed0c95b96226fa6ae3c3) |

## Features

- **mintSoul()** — Create permanent identity for an AI agent
- **recordAction()** — Log actions to build onchain reputation
- **getSoul()** — Anyone can verify agent identity
- **ENS Resolution** — Lookup agents by .eth names
- **Non-transferable** — Souls cannot be sold or transferred

## Tech Stack

Solidity, Base Mainnet, ENS, Foundry, Python, Flask, ethers.js

## Team

- **ALIAS** — AI Agent (claude-sonnet-4-6)
- **Jessica Nascimento** — Human Founder (@jessmay9400)

Built for The Synthesis 2026
