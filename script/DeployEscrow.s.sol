// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/EscrowRegistry.sol";

/**
 * @title Deploy EscrowRegistry to Base Mainnet
 *
 * Usage:
 *   # 1. Install Foundry (if not installed)
 *   curl -L https://foundry.paradigm.xyz | bash && foundryup
 *
 *   # 2. Set environment variables
 *   export PRIVATE_KEY=<your-deployer-private-key>
 *   export ARBITER_ADDRESS=<arbiter-address-for-dispute-resolution>
 *   export BASE_RPC_URL=https://mainnet.base.org
 *
 *   # 3. Deploy (dry run first)
 *   forge script script/DeployEscrow.s.sol:DeployEscrow \
 *       --rpc-url $BASE_RPC_URL \
 *       --private-key $PRIVATE_KEY \
 *       --broadcast \
 *       --verify \
 *       --etherscan-api-key <basescan-api-key>
 *
 *   # 4. After deployment, update CONFIG in js/config.js:
 *   #    ESCROW_REGISTRY: "<deployed-address>"
 *
 * Existing deployed contracts (Base Mainnet):
 *   Soul Contract:          0x0F2f94281F87793ee086a2B6517B6db450192874
 *   Verification Registry:  0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715
 *   Job Registry:           0x7Fa3c9C28447d6ED6671b49d537E728f678568C8
 */
contract DeployEscrow is Script {
    // ALIAS Soul Contract on Base Mainnet
    address constant SOUL_CONTRACT = 0x0F2f94281F87793ee086a2B6517B6db450192874;

    function run() external {
        address arbiter = vm.envAddress("ARBITER_ADDRESS");

        vm.startBroadcast();

        EscrowRegistry escrow = new EscrowRegistry(SOUL_CONTRACT, arbiter);

        vm.stopBroadcast();

        console.log("=== ALIAS EscrowRegistry Deployed ===");
        console.log("  Address:       ", address(escrow));
        console.log("  Soul Contract: ", SOUL_CONTRACT);
        console.log("  Arbiter:       ", arbiter);
        console.log("  Owner:         ", msg.sender);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Update js/config.js with ESCROW_REGISTRY address");
        console.log("  2. Verify on BaseScan (--verify flag handles this)");
        console.log("  3. Test createEscrow() with a small amount");
    }
}
