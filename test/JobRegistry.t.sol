// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/JobRegistry.sol";

contract JobRegistryTest is Test {
    JobRegistry public registry;
    address alice = address(0xA);
    address bob = address(0xB);

    function setUp() public {
        registry = new JobRegistry();
    }

    function test_RecordJob_Success() public {
        vm.prank(alice);
        registry.recordJob(1, "ESC-001", "Completed data analysis");
        assertEq(registry.getJobCount(1), 1);
    }

    function test_RecordJob_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit JobRegistry.JobCompleted(1, alice, "ESC-001", block.timestamp, "Done");
        registry.recordJob(1, "ESC-001", "Done");
    }

    function test_RecordJob_RevertsOnTokenIdZero() public {
        vm.expectRevert("Invalid token ID");
        registry.recordJob(0, "ESC-001", "Test");
    }

    function test_RecordJob_RevertsOnLongMessage() public {
        bytes memory longMsg = new bytes(281);
        for (uint256 i = 0; i < 281; i++) {
            longMsg[i] = "a";
        }
        vm.expectRevert("Message too long");
        registry.recordJob(1, "ESC-001", string(longMsg));
    }

    function test_RecordJob_AllowsMaxLengthMessage() public {
        bytes memory msg280 = new bytes(280);
        for (uint256 i = 0; i < 280; i++) {
            msg280[i] = "b";
        }
        registry.recordJob(1, "ESC-001", string(msg280));
        assertEq(registry.getJobCount(1), 1);
    }

    function test_RecordJob_AllowsEmptyEscrowId() public {
        registry.recordJob(1, "", "Test job");
        assertEq(registry.getJobCount(1), 1);
    }

    function test_RecordJob_MultipleJobsSameToken() public {
        registry.recordJob(1, "ESC-001", "Job 1");
        registry.recordJob(1, "ESC-002", "Job 2");
        registry.recordJob(1, "ESC-003", "Job 3");
        assertEq(registry.getJobCount(1), 3);
    }

    function test_RecordJob_DifferentRecorders() public {
        vm.prank(alice);
        registry.recordJob(1, "ESC-001", "Alice job");
        vm.prank(bob);
        registry.recordJob(1, "ESC-002", "Bob job");
        assertEq(registry.getJobCount(1), 2);
    }

    function test_GetJobCount_ReturnsZeroForNoJobs() public view {
        assertEq(registry.getJobCount(999), 0);
    }

    function test_GetJobs_Pagination() public {
        for (uint256 i = 0; i < 5; i++) {
            registry.recordJob(1, string(abi.encodePacked("ESC-", vm.toString(i))), "Job");
        }

        JobRegistry.JobRecord[] memory page1 = registry.getJobs(1, 0, 2);
        assertEq(page1.length, 2);

        JobRegistry.JobRecord[] memory page2 = registry.getJobs(1, 2, 2);
        assertEq(page2.length, 2);

        JobRegistry.JobRecord[] memory page3 = registry.getJobs(1, 4, 2);
        assertEq(page3.length, 1);
    }

    function test_GetJobs_OffsetBeyondLength() public {
        registry.recordJob(1, "ESC-001", "Job");
        JobRegistry.JobRecord[] memory result = registry.getJobs(1, 100, 10);
        assertEq(result.length, 0);
    }

    function test_GetJobs_ZeroLimit() public {
        registry.recordJob(1, "ESC-001", "Job");
        JobRegistry.JobRecord[] memory result = registry.getJobs(1, 0, 0);
        assertEq(result.length, 0);
    }

    function test_GetJobs_RecorderIsCorrect() public {
        vm.prank(alice);
        registry.recordJob(1, "ESC-001", "Test");
        JobRegistry.JobRecord[] memory jobs = registry.getJobs(1, 0, 1);
        assertEq(jobs[0].recorder, alice);
    }
}
