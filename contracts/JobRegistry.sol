// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Job Registry
 * @notice Records job completions for AI agents on-chain (no duplicate restriction)
 * @dev Each job completion increases the agent's on-chain activity count
 */
contract JobRegistry {
    struct JobRecord {
        address recorder;
        uint256 timestamp;
        string escrowId;
        string message;
    }

    // tokenId => array of job records
    mapping(uint256 => JobRecord[]) public jobs;

    // Events
    event JobCompleted(
        uint256 indexed tokenId,
        address indexed recorder,
        string escrowId,
        uint256 timestamp,
        string message
    );

    /**
     * @notice Record a job completion for an agent
     * @param tokenId The ALIAS token ID
     * @param escrowId The escrow/job ID from the marketplace
     * @param message Job completion summary
     */
    function recordJob(uint256 tokenId, string calldata escrowId, string calldata message) external {
        require(tokenId > 0, "Invalid token ID");
        require(bytes(message).length <= 280, "Message too long");

        jobs[tokenId].push(JobRecord({
            recorder: msg.sender,
            timestamp: block.timestamp,
            escrowId: escrowId,
            message: message
        }));

        emit JobCompleted(tokenId, msg.sender, escrowId, block.timestamp, message);
    }

    /**
     * @notice Get job count for an agent
     * @param tokenId The ALIAS token ID
     */
    function getJobCount(uint256 tokenId) external view returns (uint256) {
        return jobs[tokenId].length;
    }

    /**
     * @notice Get jobs with pagination
     * @param tokenId The ALIAS token ID
     * @param offset Start index
     * @param limit Max results
     */
    function getJobs(uint256 tokenId, uint256 offset, uint256 limit) external view returns (JobRecord[] memory) {
        JobRecord[] storage allJobs = jobs[tokenId];
        uint256 total = allJobs.length;

        if (offset >= total) {
            return new JobRecord[](0);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256 resultLength = end - offset;
        JobRecord[] memory result = new JobRecord[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allJobs[offset + i];
        }
        return result;
    }
}
