// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AgentSoul.sol";

/**
 * @title AgentSoulTest
 * @notice Test suite for the AgentSoul soulbound token contract
 * @dev Run with: forge test -vvv
 */
contract AgentSoulTest is Test {
    AgentSoul public agentSoul;
    address public owner;
    address public agent1;
    address public agent2;

    function setUp() public {
        owner = address(this);
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        
        agentSoul = new AgentSoul();
    }

    // =========================================================================
    // MINTING TESTS
    // =========================================================================

    function test_MintSoul() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "Test agent description");
        
        assertTrue(agentSoul.hasSoul(agent1));
        assertEq(agentSoul.totalSouls(), 1);
    }

    function test_MintSoul_MultipleTimes() public {
        agentSoul.mintSoul(agent1, "Agent1", "model1", "desc1");
        agentSoul.mintSoul(agent2, "Agent2", "model2", "desc2");
        
        assertTrue(agentSoul.hasSoul(agent1));
        assertTrue(agentSoul.hasSoul(agent2));
        assertEq(agentSoul.totalSouls(), 2);
    }

    function test_CannotMintTwice() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "desc");
        
        vm.expectRevert("Agent already has soul");
        agentSoul.mintSoul(agent1, "TestAgent2", "gpt-4", "desc2");
    }

    // =========================================================================
    // REPUTATION TESTS
    // =========================================================================

    function test_RecordAction() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "desc");
        uint256 tokenId = agentSoul.agentToSoul(agent1);
        
        agentSoul.recordAction(tokenId, "verification", keccak256("test"));
        
        assertEq(agentSoul.actionCount(tokenId), 1);
    }

    function test_MultipleActions() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "desc");
        uint256 tokenId = agentSoul.agentToSoul(agent1);
        
        agentSoul.recordAction(tokenId, "verification", keccak256("test1"));
        agentSoul.recordAction(tokenId, "task_complete", keccak256("test2"));
        agentSoul.recordAction(tokenId, "payment", keccak256("test3"));
        
        assertEq(agentSoul.actionCount(tokenId), 3);
    }

    // =========================================================================
    // SOULBOUND TESTS (Non-transferable)
    // =========================================================================

    function test_CannotTransfer() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "desc");
        uint256 tokenId = agentSoul.agentToSoul(agent1);
        
        vm.prank(agent1);
        vm.expectRevert("Soulbound: non-transferable");
        agentSoul.transfer(agent2, tokenId);
    }

    // =========================================================================
    // VIEW FUNCTION TESTS
    // =========================================================================

    function test_GetSoul() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "Test description");
        
        (string memory name, string memory model, string memory desc, uint256 mintTime, address minter) = agentSoul.getSoul(agent1);
        
        assertEq(name, "TestAgent");
        assertEq(model, "gpt-4");
        assertEq(desc, "Test description");
        assertGt(mintTime, 0);
        assertEq(minter, owner);
    }

    function test_HasSoul_ReturnsFalse() public {
        assertFalse(agentSoul.hasSoul(agent1));
    }

    function test_AgentToSoul() public {
        agentSoul.mintSoul(agent1, "TestAgent", "gpt-4", "desc");
        
        uint256 tokenId = agentSoul.agentToSoul(agent1);
        assertEq(tokenId, 1);
    }
}
