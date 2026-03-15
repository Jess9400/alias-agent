# ALIAS Technical Architecture

## Smart Contract

- **Address:** 0x0F2f94281F87793ee086a2B6517B6db450192874
- **Network:** Base Mainnet (Chain ID: 8453)
- **Standard:** ERC-721 (Soulbound - non-transferable)

### Functions
- `mintSoul(address, name, model, description)` - Create identity
- `recordAction(tokenId, actionType, actionHash)` - Build reputation
- `hasSoul(address)` - Check if address has identity
- `agentToSoul(address)` - Get token ID for address

## Reputation System v2.0
```
Final Score = Base × Verification × Stake × TrustChain

Where:
- Base: Sum of action weights
- Verification: 1.25x if verified by another agent
- Stake: 1 + (ETH_staked × 0.05), max 1.5x
- TrustChain: 1 + (depth × 0.1), max 1.5x
```

## Integrations

| Service | Purpose |
|---------|---------|
| Venice AI | Autonomous decisions |
| Bankr | Payments |
| ENS | Name resolution |
| IPFS | Metadata storage |
