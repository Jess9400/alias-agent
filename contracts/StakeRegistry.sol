// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Stake Registry
 * @notice Stake-based Sybil resistance for the ALIAS agent network
 * @dev Stake tiers gate capabilities: minting, verifying, arbitrating, governance
 */

interface IALIASSoulStake {
    function totalSouls() external view returns (uint256);
    function souls(uint256 tokenId) external view returns (
        string memory name, string memory model, address creator,
        uint256 birthBlock, string memory description, bool exists
    );
}

contract StakeRegistry {
    // ======================== TYPES ========================

    enum StakeTier {
        None, // 0 ETH — no capabilities
        Bronze, // 0.001 ETH — can register, take jobs
        Silver, // 0.005 ETH — can verify others
        Gold, // 0.01 ETH — can be arbiter
        Platinum // 0.05 ETH — can slash, governance
    }

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        address stakedBy;
        StakeTier tier;
    }

    struct UnstakeRequest {
        uint256 amount;
        uint256 requestedAt;
        bool pending;
    }

    struct SlashRecord {
        address slasher;
        uint256 amount;
        uint256 timestamp;
        string reason;
    }

    // ======================== STATE ========================

    IALIASSoulStake public immutable soulContract;
    address public owner;

    uint256 public constant BRONZE_THRESHOLD = 0.001 ether;
    uint256 public constant SILVER_THRESHOLD = 0.005 ether;
    uint256 public constant GOLD_THRESHOLD = 0.01 ether;
    uint256 public constant PLATINUM_THRESHOLD = 0.05 ether;
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;
    uint256 public constant MAX_SLASH_BPS = 5000; // Max 50% per slash

    mapping(uint256 => StakeInfo) public stakes; // tokenId => stake
    mapping(uint256 => UnstakeRequest) public unstakeRequests; // tokenId => pending unstake
    mapping(uint256 => SlashRecord[]) public slashHistory; // tokenId => slashes
    mapping(address => bool) public authorizedSlashers;

    uint256 public totalStaked;
    uint256 public slashedFundsBalance;

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ======================== EVENTS ========================

    event Staked(uint256 indexed tokenId, uint256 amount, StakeTier newTier);
    event UnstakeRequested(uint256 indexed tokenId, uint256 amount, uint256 unlockTime);
    event Unstaked(uint256 indexed tokenId, uint256 amount, StakeTier newTier);
    event Slashed(uint256 indexed tokenId, address indexed slasher, uint256 amount, string reason);
    event TierChanged(uint256 indexed tokenId, StakeTier oldTier, StakeTier newTier);
    event SlasherAdded(address indexed slasher);
    event SlasherRemoved(address indexed slasher);

    // ======================== MODIFIERS ========================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier validToken(uint256 tokenId) {
        require(tokenId > 0 && tokenId <= soulContract.totalSouls(), "Invalid token");
        _;
    }

    // ======================== CONSTRUCTOR ========================

    constructor(address _soulContract) {
        require(_soulContract != address(0), "Invalid soul contract");
        soulContract = IALIASSoulStake(_soulContract);
        owner = msg.sender;
    }

    // ======================== CORE FUNCTIONS ========================

    /**
     * @notice Stake ETH for an agent to unlock capabilities
     * @param tokenId The ALIAS token ID
     */
    function stake(uint256 tokenId) external payable nonReentrant validToken(tokenId) {
        require(msg.value > 0, "Must stake > 0");

        // Verify caller is the token's creator (owner)
        (, , address creator, , , ) = soulContract.souls(tokenId);
        require(msg.sender == creator, "Not token owner");

        StakeInfo storage s = stakes[tokenId];
        StakeTier oldTier = s.tier;

        s.amount += msg.value;
        s.stakedBy = msg.sender; // Always update to current caller (verified owner)
        if (s.stakedAt == 0) {
            s.stakedAt = block.timestamp;
        }
        s.tier = _calculateTier(s.amount);

        totalStaked += msg.value;

        emit Staked(tokenId, msg.value, s.tier);
        if (s.tier != oldTier) {
            emit TierChanged(tokenId, oldTier, s.tier);
        }
    }

    /**
     * @notice Request to unstake (starts cooldown period)
     * @param tokenId The ALIAS token ID
     * @param amount Amount to unstake
     */
    function requestUnstake(uint256 tokenId, uint256 amount) external validToken(tokenId) {
        require(msg.sender == stakes[tokenId].stakedBy, "Not staker");
        StakeInfo storage s = stakes[tokenId];
        require(s.amount >= amount, "Insufficient stake");
        require(amount > 0, "Must unstake > 0");
        require(!unstakeRequests[tokenId].pending, "Unstake already pending");

        unstakeRequests[tokenId] = UnstakeRequest({amount: amount, requestedAt: block.timestamp, pending: true});

        emit UnstakeRequested(tokenId, amount, block.timestamp + UNSTAKE_COOLDOWN);
    }

    /**
     * @notice Complete unstaking after cooldown period
     * @param tokenId The ALIAS token ID
     */
    function unstake(uint256 tokenId) external nonReentrant validToken(tokenId) {
        require(msg.sender == stakes[tokenId].stakedBy, "Not staker");
        UnstakeRequest storage req = unstakeRequests[tokenId];
        require(req.pending, "No pending unstake");
        require(block.timestamp >= req.requestedAt + UNSTAKE_COOLDOWN, "Cooldown not elapsed");

        StakeInfo storage s = stakes[tokenId];

        // If stake was slashed during cooldown, adjust
        uint256 withdrawAmount = req.amount;
        if (withdrawAmount > s.amount) {
            withdrawAmount = s.amount;
        }

        StakeTier oldTier = s.tier;
        s.amount -= withdrawAmount;
        s.tier = _calculateTier(s.amount);
        totalStaked -= withdrawAmount;

        // Reset stakedBy when fully withdrawn to prevent sticky permission
        if (s.amount == 0) {
            s.stakedBy = address(0);
            s.stakedAt = 0;
        }

        req.pending = false;

        (bool sent,) = payable(msg.sender).call{value: withdrawAmount}("");
        require(sent, "Transfer failed");

        emit Unstaked(tokenId, withdrawAmount, s.tier);
        if (s.tier != oldTier) {
            emit TierChanged(tokenId, oldTier, s.tier);
        }
    }

    /**
     * @notice Slash a bad actor's stake
     * @param tokenId Token to slash
     * @param bps Basis points to slash (max 5000 = 50%)
     * @param reason Reason for slashing
     */
    function slash(uint256 tokenId, uint256 bps, string calldata reason) external validToken(tokenId) {
        require(authorizedSlashers[msg.sender] || msg.sender == owner, "Not authorized");
        require(bps > 0 && bps <= MAX_SLASH_BPS, "Invalid slash amount");
        require(bytes(reason).length > 0 && bytes(reason).length <= 280, "Invalid reason");

        StakeInfo storage s = stakes[tokenId];
        require(s.amount > 0, "Nothing to slash");

        uint256 slashAmount = (s.amount * bps) / 10000;
        StakeTier oldTier = s.tier;

        s.amount -= slashAmount;
        s.tier = _calculateTier(s.amount);
        totalStaked -= slashAmount;
        slashedFundsBalance += slashAmount;

        slashHistory[tokenId].push(
            SlashRecord({slasher: msg.sender, amount: slashAmount, timestamp: block.timestamp, reason: reason})
        );

        emit Slashed(tokenId, msg.sender, slashAmount, reason);
        if (s.tier != oldTier) {
            emit TierChanged(tokenId, oldTier, s.tier);
        }
    }

    // ======================== VIEW FUNCTIONS ========================

    function getStake(uint256 tokenId) external view returns (uint256) {
        return stakes[tokenId].amount;
    }

    function getTier(uint256 tokenId) external view returns (StakeTier) {
        return stakes[tokenId].tier;
    }

    function getStakeInfo(uint256 tokenId) external view returns (StakeInfo memory) {
        return stakes[tokenId];
    }

    function getUnstakeRequest(uint256 tokenId) external view returns (UnstakeRequest memory) {
        return unstakeRequests[tokenId];
    }

    function isEligible(uint256 tokenId, StakeTier required) external view returns (bool) {
        return uint8(stakes[tokenId].tier) >= uint8(required);
    }

    function getSlashCount(uint256 tokenId) external view returns (uint256) {
        return slashHistory[tokenId].length;
    }

    function getSlashHistory(uint256 tokenId, uint256 offset, uint256 limit)
        external
        view
        returns (SlashRecord[] memory)
    {
        SlashRecord[] storage all = slashHistory[tokenId];
        uint256 total = all.length;
        if (offset >= total) return new SlashRecord[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256 len = end - offset;
        SlashRecord[] memory result = new SlashRecord[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = all[offset + i];
        }
        return result;
    }

    // ======================== ADMIN ========================

    function addSlasher(address slasher) external onlyOwner {
        require(slasher != address(0), "Zero address");
        authorizedSlashers[slasher] = true;
        emit SlasherAdded(slasher);
    }

    function removeSlasher(address slasher) external onlyOwner {
        authorizedSlashers[slasher] = false;
        emit SlasherRemoved(slasher);
    }

    function withdrawSlashedFunds(address to) external nonReentrant onlyOwner {
        require(to != address(0), "Zero address");
        uint256 amount = slashedFundsBalance;
        require(amount > 0, "No slashed funds");
        slashedFundsBalance = 0;

        (bool sent,) = payable(to).call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ======================== INTERNAL ========================

    function _calculateTier(uint256 amount) internal pure returns (StakeTier) {
        if (amount >= PLATINUM_THRESHOLD) return StakeTier.Platinum;
        if (amount >= GOLD_THRESHOLD) return StakeTier.Gold;
        if (amount >= SILVER_THRESHOLD) return StakeTier.Silver;
        if (amount >= BRONZE_THRESHOLD) return StakeTier.Bronze;
        return StakeTier.None;
    }
}
