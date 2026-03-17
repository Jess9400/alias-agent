// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/VerificationRegistry.sol";

contract VerificationRegistryTest is Test {
    VerificationRegistry public registry;
    address aliasContract = address(0xDEAD);
    address alice = address(0xA);
    address bob = address(0xB);
    address charlie = address(0xC);

    function setUp() public {
        registry = new VerificationRegistry(aliasContract);
    }

    function test_Constructor_SetsAliasContract() public view {
        assertEq(registry.aliasContract(), aliasContract);
    }

    function test_Verify_Success() public {
        vm.prank(alice);
        registry.verify(1, "Great agent!");
        assertEq(registry.getVerificationCount(1), 1);
    }

    function test_Verify_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit VerificationRegistry.AgentVerified(1, alice, block.timestamp, "Test");
        registry.verify(1, "Test");
    }

    function test_Verify_PreventsDuplicate() public {
        vm.prank(alice);
        registry.verify(1, "First");

        vm.prank(alice);
        vm.expectRevert("Already verified this agent");
        registry.verify(1, "Second");
    }

    function test_Verify_DifferentVerifiersSameAgent() public {
        vm.prank(alice);
        registry.verify(1, "From Alice");
        vm.prank(bob);
        registry.verify(1, "From Bob");
        assertEq(registry.getVerificationCount(1), 2);
    }

    function test_Verify_SameVerifierDifferentAgents() public {
        vm.prank(alice);
        registry.verify(1, "Agent 1");
        vm.prank(alice);
        registry.verify(2, "Agent 2");
        assertEq(registry.getVerificationCount(1), 1);
        assertEq(registry.getVerificationCount(2), 1);
    }

    function test_Verify_EmptyMessage() public {
        vm.prank(alice);
        registry.verify(1, "");
        assertEq(registry.getVerificationCount(1), 1);
    }

    function test_GetVerificationCount_Zero() public view {
        assertEq(registry.getVerificationCount(999), 0);
    }

    function test_GetVerifications_ReturnsCorrectData() public {
        vm.prank(alice);
        registry.verify(1, "Trusted");
        VerificationRegistry.Verification[] memory v = registry.getVerifications(1);
        assertEq(v.length, 1);
        assertEq(v[0].verifier, alice);
        assertEq(v[0].message, "Trusted");
    }

    function test_IsVerifiedBy_True() public {
        vm.prank(alice);
        registry.verify(1, "Yes");
        assertTrue(registry.isVerifiedBy(alice, 1));
    }

    function test_IsVerifiedBy_False() public view {
        assertFalse(registry.isVerifiedBy(alice, 1));
    }

    function test_MultipleVerifiers() public {
        vm.prank(alice);
        registry.verify(1, "A");
        vm.prank(bob);
        registry.verify(1, "B");
        vm.prank(charlie);
        registry.verify(1, "C");

        assertEq(registry.getVerificationCount(1), 3);
        assertTrue(registry.isVerifiedBy(alice, 1));
        assertTrue(registry.isVerifiedBy(bob, 1));
        assertTrue(registry.isVerifiedBy(charlie, 1));
    }
}
