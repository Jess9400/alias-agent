// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Reputation Engine
 * @notice On-chain anti-gaming reputation with weighted scoring, decay, and anti-collusion
 * @dev Reads from Soul, Verification, Job, and Stake contracts for composite scoring
 */

interface IAliasSoulRep {
    function totalSouls() external view returns (uint256);
    function actionCount(uint256 tokenId) external view returns (uint256);
}

interface IVerificationRegistryRep {
    function getVerificationCount(uint256 tokenId) external view returns (uint256);
    function isVerifiedBy(address verifier, uint256 tokenId) external view returns (bool);
}

interface IJobRegistryRep {
    function getJobCount(uint256 tokenId) external view returns (uint256);
}

interface IStakeRegistryRep {
    function getStake(uint256 tokenId) external view returns (uint256);
}

contract ReputationEngine {
    // ======================== TYPES ========================

    enum Tier {
        NO_SOUL,
        NEWCOMER,
        VERIFIED,
        TRUSTED,
        ELITE,
        LEGENDARY
    }

    struct ReputationBreakdown {
        uint256 activityScore; // From on-chain actions (diminishing returns)
        uint256 verificationScore; // From verifications (weighted)
        uint256 jobScore; // From job completions
        uint256 ageScore; // From time since registration
        uint256 stakeBonus; // Multiplier from staking
        uint256 decayPenalty; // Reduction from inactivity
        uint256 collusionPenalty; // Reduction from suspicious patterns
        uint256 totalScore;
        Tier tier;
    }

    // ======================== STATE ========================

    IAliasSoulRep public soulContract;
    IVerificationRegistryRep public verificationRegistry;
    IJobRegistryRep public jobRegistry;
    IStakeRegistryRep public stakeRegistry;

    address public owner;

    // Authorized callers for recording functions
    mapping(address => bool) public authorizedCallers;

    // tokenId => last activity timestamp
    mapping(uint256 => uint256) public lastActivity;
    // tokenId => registration timestamp
    mapping(uint256 => uint256) public registeredAt;
    // tokenId => total escrow value of completed jobs (in wei)
    mapping(uint256 => uint256) public jobValue;
    // Mutual verification tracking: keccak256(tokenA, tokenB) => true
    mapping(bytes32 => bool) public mutualVerifications;
    // tokenId => count of mutual verifications flagged
    mapping(uint256 => uint256) public mutualVerifyCount;

    // Scoring weights (basis points, total flexible)
    uint256 public constant ACTIVITY_WEIGHT = 2000; // 20%
    uint256 public constant VERIFICATION_WEIGHT = 3000; // 30%
    uint256 public constant JOB_WEIGHT = 2500; // 25%
    uint256 public constant AGE_WEIGHT = 1000; // 10%
    uint256 public constant STAKE_WEIGHT = 1500; // 15%

    // Decay: ~1% per week of inactivity (represented as seconds)
    uint256 public constant DECAY_PERIOD = 7 days;
    uint256 public constant DECAY_BPS_PER_PERIOD = 100; // 1% per period
    uint256 public constant MAX_DECAY_BPS = 8000; // Max 80% decay
    uint256 public constant MIN_SCORE_FLOOR = 10; // Never below this

    // Anti-collusion
    uint256 public constant MUTUAL_VERIFY_PENALTY_BPS = 5000; // 50% reduction
    uint256 public constant MAX_VERIFICATIONS_PER_DAY = 10;

    // Tier thresholds
    uint256 public constant LEGENDARY_THRESHOLD = 500;
    uint256 public constant ELITE_THRESHOLD = 200;
    uint256 public constant TRUSTED_THRESHOLD = 100;
    uint256 public constant VERIFIED_THRESHOLD = 50;
    uint256 public constant NEWCOMER_THRESHOLD = 1;

    // ======================== EVENTS ========================

    event ActivityRecorded(uint256 indexed tokenId, uint256 timestamp);
    event AgentRegistered(uint256 indexed tokenId, uint256 timestamp);
    event JobValueRecorded(uint256 indexed tokenId, uint256 value);
    event MutualVerificationFlagged(uint256 indexed tokenA, uint256 indexed tokenB);
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // ======================== MODIFIERS ========================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedCallers[msg.sender], "Not authorized");
        _;
    }

    modifier validToken(uint256 tokenId) {
        require(tokenId > 0 && tokenId <= soulContract.totalSouls(), "Invalid token");
        _;
    }

    // ======================== CONSTRUCTOR ========================

    constructor(address _soul, address _verification, address _job, address _stake) {
        require(_soul != address(0), "Invalid soul");
        soulContract = IAliasSoulRep(_soul);
        verificationRegistry = IVerificationRegistryRep(_verification);
        jobRegistry = IJobRegistryRep(_job);
        stakeRegistry = IStakeRegistryRep(_stake);
        owner = msg.sender;
    }

    // ======================== RECORDING FUNCTIONS ========================

    /**
     * @notice Record activity to reset decay timer (only authorized contracts/owner)
     */
    function recordActivity(uint256 tokenId) external onlyAuthorized validToken(tokenId) {
        lastActivity[tokenId] = block.timestamp;
        emit ActivityRecorded(tokenId, block.timestamp);
    }

    /**
     * @notice Register an agent's creation time (called once at mint)
     */
    function registerAgent(uint256 tokenId) external onlyAuthorized validToken(tokenId) {
        require(registeredAt[tokenId] == 0, "Already registered");
        registeredAt[tokenId] = block.timestamp;
        lastActivity[tokenId] = block.timestamp;
        emit AgentRegistered(tokenId, block.timestamp);
    }

    /**
     * @notice Record escrow value for a completed job (called by escrow contract)
     */
    function recordJobValue(uint256 tokenId, uint256 value) external onlyAuthorized validToken(tokenId) {
        jobValue[tokenId] += value;
        lastActivity[tokenId] = block.timestamp;
        emit JobValueRecorded(tokenId, value);
    }

    /**
     * @notice Flag mutual verification between two agents — penalizes both
     */
    function flagMutualVerification(uint256 tokenA, uint256 tokenB) external onlyAuthorized {
        require(tokenA != tokenB, "Same token");
        bytes32 key = _mutualKey(tokenA, tokenB);
        if (!mutualVerifications[key]) {
            mutualVerifications[key] = true;
            mutualVerifyCount[tokenA]++;
            mutualVerifyCount[tokenB]++;
            emit MutualVerificationFlagged(tokenA, tokenB);
        }
    }

    // ======================== CALCULATION FUNCTIONS ========================

    /**
     * @notice Calculate full reputation score for an agent
     */
    function calculateReputation(uint256 tokenId) external view validToken(tokenId) returns (uint256) {
        ReputationBreakdown memory b = _calculateBreakdown(tokenId);
        return b.totalScore;
    }

    /**
     * @notice Get detailed reputation breakdown
     */
    function getReputationBreakdown(uint256 tokenId)
        external
        view
        validToken(tokenId)
        returns (ReputationBreakdown memory)
    {
        return _calculateBreakdown(tokenId);
    }

    /**
     * @notice Get current decay multiplier (10000 = no decay, 0 = max decay)
     */
    function getDecayMultiplier(uint256 tokenId) external view returns (uint256) {
        return _decayMultiplier(tokenId);
    }

    /**
     * @notice Get tier based on current reputation
     */
    function getTier(uint256 tokenId) external view validToken(tokenId) returns (Tier) {
        uint256 score = this.calculateReputation(tokenId);
        return _getTier(score);
    }

    // ======================== INTERNAL ========================

    function _calculateBreakdown(uint256 tokenId) internal view returns (ReputationBreakdown memory b) {
        // 1. Activity score with diminishing returns: sqrt(actions) * 20
        uint256 actions = soulContract.actionCount(tokenId);
        b.activityScore = _sqrt(actions) * 20;

        // 2. Verification score (weighted, with collusion check)
        uint256 verifications = verificationRegistry.getVerificationCount(tokenId);
        b.verificationScore = _sqrt(verifications) * 30;

        // 3. Job score: sqrt(jobs) * 25 + bonus for high-value jobs
        uint256 jobs = jobRegistry.getJobCount(tokenId);
        uint256 valueBonus = _sqrt(jobValue[tokenId] / 1e14); // Scale down from wei
        b.jobScore = _sqrt(jobs) * 25 + valueBonus;

        // 4. Age score: logarithmic (fast early, plateaus)
        uint256 regTime = registeredAt[tokenId];
        if (regTime > 0 && block.timestamp > regTime) {
            uint256 ageDays = (block.timestamp - regTime) / 1 days;
            b.ageScore = _sqrt(ageDays) * 15; // sqrt scaling
            if (b.ageScore > 150) b.ageScore = 150; // Cap at 150
        }

        // 5. Stake bonus: percentage increase based on stake amount
        uint256 stakeAmount = stakeRegistry.getStake(tokenId);
        if (stakeAmount >= 0.05 ether) {
            b.stakeBonus = 200; // Platinum: +200%  (applied as bonus points)
        } else if (stakeAmount >= 0.01 ether) {
            b.stakeBonus = 100; // Gold: +100%
        } else if (stakeAmount >= 0.005 ether) {
            b.stakeBonus = 50; // Silver: +50%
        } else if (stakeAmount >= 0.001 ether) {
            b.stakeBonus = 25; // Bronze: +25%
        }

        // Raw score before modifiers
        uint256 rawScore = b.activityScore + b.verificationScore + b.jobScore + b.ageScore;

        // Apply stake bonus
        rawScore = rawScore + (rawScore * b.stakeBonus / 100);

        // 6. Decay penalty
        uint256 decayMul = _decayMultiplier(tokenId);
        b.decayPenalty = rawScore - (rawScore * decayMul / 10000);
        rawScore = rawScore * decayMul / 10000;

        // 7. Collusion penalty — 50% of verification score per flagged mutual verification
        uint256 mutualCount = mutualVerifyCount[tokenId];
        if (mutualCount > 0) {
            uint256 penaltyBps = mutualCount * MUTUAL_VERIFY_PENALTY_BPS;
            if (penaltyBps > 10000) penaltyBps = 10000; // Cap at 100%
            b.collusionPenalty = rawScore * penaltyBps / 10000;
            rawScore -= b.collusionPenalty;
        }

        // Floor
        b.totalScore = rawScore < MIN_SCORE_FLOOR && rawScore > 0 ? MIN_SCORE_FLOOR : rawScore;
        b.tier = _getTier(b.totalScore);

        return b;
    }

    function _decayMultiplier(uint256 tokenId) internal view returns (uint256) {
        uint256 last = lastActivity[tokenId];
        if (last == 0) return 10000; // No activity recorded — no decay yet

        uint256 elapsed = block.timestamp - last;
        uint256 periods = elapsed / DECAY_PERIOD;

        if (periods == 0) return 10000; // No decay

        uint256 decayBps = periods * DECAY_BPS_PER_PERIOD;
        if (decayBps > MAX_DECAY_BPS) decayBps = MAX_DECAY_BPS;

        return 10000 - decayBps;
    }

    function _getTier(uint256 score) internal pure returns (Tier) {
        if (score >= LEGENDARY_THRESHOLD) return Tier.LEGENDARY;
        if (score >= ELITE_THRESHOLD) return Tier.ELITE;
        if (score >= TRUSTED_THRESHOLD) return Tier.TRUSTED;
        if (score >= VERIFIED_THRESHOLD) return Tier.VERIFIED;
        if (score >= NEWCOMER_THRESHOLD) return Tier.NEWCOMER;
        return Tier.NO_SOUL;
    }

    /// @dev Integer square root (Babylonian method)
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _mutualKey(uint256 a, uint256 b) internal pure returns (bytes32) {
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(lo, hi));
    }

    // ======================== ADMIN ========================

    function addAuthorizedCaller(address caller) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }

    function updateContracts(address _soul, address _verification, address _job, address _stake) external onlyOwner {
        if (_soul != address(0)) soulContract = IAliasSoulRep(_soul);
        if (_verification != address(0)) verificationRegistry = IVerificationRegistryRep(_verification);
        if (_job != address(0)) jobRegistry = IJobRegistryRep(_job);
        if (_stake != address(0)) stakeRegistry = IStakeRegistryRep(_stake);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
