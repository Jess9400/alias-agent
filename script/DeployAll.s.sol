// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/EscrowRegistry.sol";
import "../contracts/StakeRegistry.sol";
import "../contracts/ReputationEngine.sol";

/**
 * @title Deploy all Phase 2 contracts to Base Mainnet
 *
 * Deploys: StakeRegistry, EscrowRegistry, ReputationEngine
 *
 * Usage:
 *   # 1. Install Foundry
 *   curl -L https://foundry.paradigm.xyz | bash && foundryup
 *
 *   # 2. Set environment variables
 *   export PRIVATE_KEY=<deployer-private-key>
 *   export ARBITER_ADDRESS=<arbiter-for-dispute-resolution>
 *   export BASE_RPC_URL=https://mainnet.base.org
 *
 *   # 3. Deploy
 *   forge script script/DeployAll.s.sol:DeployAll \
 *       --rpc-url $BASE_RPC_URL \
 *       --private-key $PRIVATE_KEY \
 *       --broadcast \
 *       --verify \
 *       --etherscan-api-key <basescan-api-key>
 *
 * Existing contracts (Base Mainnet):
 *   Soul:          0x0F2f94281F87793ee086a2B6517B6db450192874
 *   Verification:  0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715
 *   Job Registry:  0x7Fa3c9C28447d6ED6671b49d537E728f678568C8
 */
contract DeployAll is Script {
    address constant SOUL = 0x0F2f94281F87793ee086a2B6517B6db450192874;
    address constant VERIFY = 0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715;
    address constant JOB = 0x7Fa3c9C28447d6ED6671b49d537E728f678568C8;

    function run() external {
        address arbiter = vm.envAddress("ARBITER_ADDRESS");

        vm.startBroadcast();

        // 1. StakeRegistry — depends only on Soul contract
        StakeRegistry stake = new StakeRegistry(SOUL);

        // 2. EscrowRegistry — depends on Soul contract + arbiter
        EscrowRegistry escrow = new EscrowRegistry(SOUL, arbiter);

        // 3. ReputationEngine — depends on Soul, Verification, Job, Stake
        ReputationEngine reputation = new ReputationEngine(SOUL, VERIFY, JOB, address(stake));

        vm.stopBroadcast();

        console.log("=== ALIAS Phase 2 Deployment Complete ===");
        console.log("");
        console.log("StakeRegistry:     ", address(stake));
        console.log("EscrowRegistry:    ", address(escrow));
        console.log("ReputationEngine:  ", address(reputation));
        console.log("");
        console.log("Arbiter:           ", arbiter);
        console.log("");
        console.log("Update js/config.js with these addresses.");
    }
}
