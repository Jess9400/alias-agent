// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Verification Registry
 * @notice Allows anyone to verify AI agents on-chain
 * @dev Separate from main SoulBound contract for modularity
 */
contract VerificationRegistry {
    // Main ALIAS contract address
    address public immutable aliasContract;
    
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
    event AgentVerified(
        uint256 indexed tokenId,
        address indexed verifier,
        uint256 timestamp,
        string message
    );
    
    constructor(address _aliasContract) {
        aliasContract = _aliasContract;
    }
    
    /**
     * @notice Verify an AI agent
     * @param tokenId The ALIAS token ID to verify
     * @param message Optional verification message
     */
    function verify(uint256 tokenId, string calldata message) external {
        require(!hasVerified[msg.sender][tokenId], "Already verified this agent");
        
        hasVerified[msg.sender][tokenId] = true;
        
        verifications[tokenId].push(Verification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            message: message
        }));
        
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
     * @notice Get all verifications for an agent
     * @param tokenId The ALIAS token ID
     */
    function getVerifications(uint256 tokenId) external view returns (Verification[] memory) {
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
