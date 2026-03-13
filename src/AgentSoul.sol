// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentSoul
 * @notice Soulbound Token (SBT) for AI Agent Identity
 * @dev Non-transferable NFT that represents an agent's permanent onchain identity
 */
contract AgentSoul {
    
    struct Soul {
        string name;           // Agent name (e.g., "ALIAS")
        string model;          // AI model (e.g., "claude-sonnet-4-6")
        address creator;       // Human who created the agent
        uint256 birthBlock;    // Block when soul was minted
        string description;    // What the agent does
        bool exists;           // Whether this soul exists
    }
    
    // Mapping from token ID to Soul
    mapping(uint256 => Soul) public souls;
    
    // Mapping from agent address to token ID
    mapping(address => uint256) public agentToSoul;
    
    // Mapping from token ID to action count (reputation)
    mapping(uint256 => uint256) public actionCount;
    
    // Total souls minted
    uint256 public totalSouls;
    
    // Events
    event SoulMinted(uint256 indexed tokenId, address indexed agent, string name, address creator);
    event ActionRecorded(uint256 indexed tokenId, string actionType, string actionHash);
    
    /**
     * @notice Mint a new Soulbound Token for an AI agent
     * @param agent The address representing the agent
     * @param name The agent's name
     * @param model The AI model powering the agent
     * @param description What the agent does
     */
    function mintSoul(
        address agent,
        string memory name,
        string memory model,
        string memory description
    ) external returns (uint256) {
        require(agentToSoul[agent] == 0, "Agent already has a soul");
        require(agent != address(0), "Invalid agent address");
        
        totalSouls++;
        uint256 tokenId = totalSouls;
        
        souls[tokenId] = Soul({
            name: name,
            model: model,
            creator: msg.sender,
            birthBlock: block.number,
            description: description,
            exists: true
        });
        
        agentToSoul[agent] = tokenId;
        
        emit SoulMinted(tokenId, agent, name, msg.sender);
        
        return tokenId;
    }
    
    /**
     * @notice Record an action to build reputation
     * @param tokenId The soul's token ID
     * @param actionType Type of action (e.g., "verification", "attestation")
     * @param actionHash IPFS hash or proof of the action
     */
    function recordAction(
        uint256 tokenId,
        string memory actionType,
        string memory actionHash
    ) external {
        require(souls[tokenId].exists, "Soul does not exist");
        require(souls[tokenId].creator == msg.sender, "Only creator can record actions");
        
        actionCount[tokenId]++;
        
        emit ActionRecorded(tokenId, actionType, actionHash);
    }
    
    /**
     * @notice Get full soul data for an agent
     * @param agent The agent's address
     */
    function getSoul(address agent) external view returns (
        string memory name,
        string memory model,
        address creator,
        uint256 birthBlock,
        string memory description,
        uint256 actions
    ) {
        uint256 tokenId = agentToSoul[agent];
        require(tokenId != 0, "Agent has no soul");
        
        Soul memory soul = souls[tokenId];
        return (
            soul.name,
            soul.model,
            soul.creator,
            soul.birthBlock,
            soul.description,
            actionCount[tokenId]
        );
    }
    
    /**
     * @notice Check if an agent has a soul
     */
    function hasSoul(address agent) external view returns (bool) {
        return agentToSoul[agent] != 0;
    }
    
    /**
     * @notice SOULBOUND: Transfers are disabled
     */
    function transfer(address, uint256) external pure {
        revert("Soulbound: transfers disabled");
    }
}
