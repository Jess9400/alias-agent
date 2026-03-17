// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/VerificationRegistryV2.sol";

contract MockALIASSoulBound is IALIASSoulBound {
    uint256 public _totalSouls = 10;
    mapping(address => bool) public _hasSoul;

    function hasSoul(address agent) external view returns (bool) {
        return _hasSoul[agent];
    }

    function totalSouls() external view returns (uint256) {
        return _totalSouls;
    }

    function setTotalSouls(uint256 n) external {
        _totalSouls = n;
    }
}

contract VerificationRegistryV2Test is Test {
    VerificationRegistryV2 public registry;
    MockALIASSoulBound public mockSoul;
    address alice = address(0xA);
    address bob = address(0xB);
    address charlie = address(0xC);

    function setUp() public {
        mockSoul = new MockALIASSoulBound();
        registry = new VerificationRegistryV2(address(mockSoul));
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert("Invalid ALIAS contract address");
        new VerificationRegistryV2(address(0));
    }

    function test_Verify_Success() public {
        vm.prank(alice);
        registry.verify(1, "Good agent");
        assertEq(registry.getVerificationCount(1), 1);
    }

    function test_Verify_RevertsOnTokenIdZero() public {
        vm.expectRevert("Invalid token ID");
        registry.verify(0, "Test");
    }

    function test_Verify_RevertsOnNonExistentToken() public {
        vm.expectRevert("Token does not exist");
        registry.verify(11, "Test"); // totalSouls is 10
    }

    function test_Verify_RevertsOnDuplicate() public {
        vm.prank(alice);
        registry.verify(1, "First");
        vm.prank(alice);
        vm.expectRevert("Already verified this agent");
        registry.verify(1, "Second");
    }

    function test_Verify_RevertsOnLongMessage() public {
        bytes memory longMsg = new bytes(281);
        for (uint i = 0; i < 281; i++) longMsg[i] = "x";
        vm.expectRevert("Message too long");
        registry.verify(1, string(longMsg));
    }

    function test_Verify_AllowsMaxLengthMessage() public {
        bytes memory msg280 = new bytes(280);
        for (uint i = 0; i < 280; i++) msg280[i] = "y";
        registry.verify(1, string(msg280));
        assertEq(registry.getVerificationCount(1), 1);
    }

    function test_Verify_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit VerificationRegistryV2.AgentVerified(1, alice, block.timestamp, "Verified");
        registry.verify(1, "Verified");
    }

    function test_GetVerifications_Paginated() public {
        // Add 5 verifications
        address[5] memory verifiers = [address(0x1), address(0x2), address(0x3), address(0x4), address(0x5)];
        for (uint i = 0; i < 5; i++) {
            vm.prank(verifiers[i]);
            registry.verify(1, string(abi.encodePacked("V", vm.toString(i))));
        }

        // Page 1
        VerificationRegistryV2.Verification[] memory p1 = registry.getVerifications(1, 0, 2);
        assertEq(p1.length, 2);
        assertEq(p1[0].verifier, verifiers[0]);

        // Page 2
        VerificationRegistryV2.Verification[] memory p2 = registry.getVerifications(1, 2, 2);
        assertEq(p2.length, 2);

        // Last page
        VerificationRegistryV2.Verification[] memory p3 = registry.getVerifications(1, 4, 10);
        assertEq(p3.length, 1);
    }

    function test_GetVerifications_OffsetBeyondLength() public {
        vm.prank(alice);
        registry.verify(1, "Test");
        VerificationRegistryV2.Verification[] memory result = registry.getVerifications(1, 100, 10);
        assertEq(result.length, 0);
    }

    function test_GetAllVerifications_BackwardCompatible() public {
        vm.prank(alice);
        registry.verify(1, "A");
        vm.prank(bob);
        registry.verify(1, "B");

        VerificationRegistryV2.Verification[] memory all = registry.getAllVerifications(1);
        assertEq(all.length, 2);
    }

    function test_IsVerifiedBy() public {
        assertFalse(registry.isVerifiedBy(alice, 1));
        vm.prank(alice);
        registry.verify(1, "Test");
        assertTrue(registry.isVerifiedBy(alice, 1));
    }

    function test_Verify_BoundaryTokenId() public {
        // Token 10 (totalSouls) should work
        vm.prank(alice);
        registry.verify(10, "Boundary");
        assertEq(registry.getVerificationCount(10), 1);
    }

    function test_Verify_UpdatedTotalSouls() public {
        // Token 11 doesn't exist yet
        vm.expectRevert("Token does not exist");
        registry.verify(11, "Test");

        // Increase totalSouls
        mockSoul.setTotalSouls(15);

        // Now token 11 should work
        registry.verify(11, "Now exists");
        assertEq(registry.getVerificationCount(11), 1);
    }

    function test_MaxMessageLength_Constant() public view {
        assertEq(registry.MAX_MESSAGE_LENGTH(), 280);
    }
}
