// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Verification Registry V2
 * @notice Allows anyone to verify AI agents on-chain
 * @dev Improvements over V1:
 *   - Token existence validation via ALIAS contract
 *   - Message length limit to prevent storage bloat
 *   - Paginated getVerifications to avoid OOG on popular agents
 *   - Token ID 0 guard
 */

interface IALIASSoulBound {
    function hasSoul(address agent) external view returns (bool);
    function totalSouls() external view returns (uint256);
}

contract VerificationRegistryV2 {
    // Main ALIAS contract
    address public immutable aliasContract;

    // Max verification message length (280 chars, like a tweet)
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    // Verification record
    struct Verification {
        address verifier;
        uint256 timestamp;
        string message;
    }

    // tokenId => array of verifications
    mapping(uint256 => Verification[]) public verifications;

    // verifier => tokenId => hasVerified (prevent duplicates)
    mapping(address => mapping(uint256 => bool)) public hasVerified;

    // Events
    event AgentVerified(uint256 indexed tokenId, address indexed verifier, uint256 timestamp, string message);

    constructor(address _aliasContract) {
        require(_aliasContract != address(0), "Invalid ALIAS contract address");
        aliasContract = _aliasContract;
    }

    /**
     * @notice Verify an AI agent
     * @param tokenId The ALIAS token ID to verify (must exist)
     * @param message Verification message (max 280 chars)
     */
    function verify(uint256 tokenId, string calldata message) external {
        require(tokenId > 0, "Invalid token ID");
        require(tokenId <= IALIASSoulBound(aliasContract).totalSouls(), "Token does not exist");
        require(!hasVerified[msg.sender][tokenId], "Already verified this agent");
        require(bytes(message).length <= MAX_MESSAGE_LENGTH, "Message too long");

        hasVerified[msg.sender][tokenId] = true;

        verifications[tokenId].push(Verification({verifier: msg.sender, timestamp: block.timestamp, message: message}));

        emit AgentVerified(tokenId, msg.sender, block.timestamp, message);
    }

    /**
     * @notice Get verification count for an agent
     * @param tokenId The ALIAS token ID
     */
    function getVerificationCount(uint256 tokenId) external view returns (uint256) {
        return verifications[tokenId].length;
    }

    /**
     * @notice Get verifications with pagination to avoid OOG
     * @param tokenId The ALIAS token ID
     * @param offset Start index
     * @param limit Max number of results
     */
    function getVerifications(uint256 tokenId, uint256 offset, uint256 limit)
        external
        view
        returns (Verification[] memory)
    {
        Verification[] storage allVerifications = verifications[tokenId];
        uint256 total = allVerifications.length;

        if (offset >= total) {
            return new Verification[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 resultLength = end - offset;
        Verification[] memory result = new Verification[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allVerifications[offset + i];
        }
        return result;
    }

    /**
     * @notice Get all verifications (kept for backward compatibility, use paginated version for large sets)
     * @param tokenId The ALIAS token ID
     */
    function getAllVerifications(uint256 tokenId) external view returns (Verification[] memory) {
        return verifications[tokenId];
    }

    /**
     * @notice Check if address has verified an agent
     * @param verifier The verifier address
     * @param tokenId The ALIAS token ID
     */
    function isVerifiedBy(address verifier, uint256 tokenId) external view returns (bool) {
        return hasVerified[verifier][tokenId];
    }
}
