// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ALIAS Escrow Registry
 * @notice On-chain escrow for agent-to-agent job payments with dispute resolution
 * @dev Lifecycle: CREATE → FUND → START → COMPLETE → APPROVE/DISPUTE → RESOLVE/EXPIRE
 */

interface IALIASSoul {
    function totalSouls() external view returns (uint256);
    function hasSoul(address agent) external view returns (bool);
}

contract EscrowRegistry {
    // ======================== TYPES ========================

    enum EscrowState {
        Funded, // Client created + funded escrow
        InProgress, // Agent accepted and started work
        Completed, // Agent submitted result, awaiting approval
        Disputed, // Either party raised a dispute
        Resolved, // Arbiter resolved the dispute
        Expired, // Deadline passed, client can reclaim
        Cancelled // Client cancelled before agent started
    }

    struct Escrow {
        uint256 id;
        uint256 clientTokenId;
        uint256 agentTokenId;
        address client;
        address agent;
        uint256 amount;
        uint256 createdAt;
        uint256 deadline;
        string jobDescription;
        string resultHash; // IPFS hash of completed work
        string disputeReason;
        EscrowState state;
    }

    // ======================== STATE ========================

    IALIASSoul public immutable soulContract;
    address public owner;
    address public arbiter;
    address public feeRecipient;

    uint256 public protocolFeeBps = 500; // 5% default (basis points)
    uint256 public constant MAX_FEE_BPS = 1000; // 10% cap
    uint256 public gracePeriod = 3 days;
    uint256 public minEscrowAmount = 0.0001 ether;

    uint256 public nextEscrowId = 1;
    uint256 public totalFees;
    uint256 public activeEscrowCount;

    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => uint256[]) public clientEscrows; // clientTokenId => escrowIds
    mapping(uint256 => uint256[]) public agentEscrows; // agentTokenId => escrowIds

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ======================== EVENTS ========================

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed clientTokenId,
        uint256 indexed agentTokenId,
        uint256 amount,
        uint256 deadline
    );
    event JobStarted(uint256 indexed escrowId, uint256 indexed agentTokenId, uint256 timestamp);
    event JobCompleted(uint256 indexed escrowId, string resultHash, uint256 timestamp);
    event EscrowReleased(uint256 indexed escrowId, uint256 agentAmount, uint256 feeAmount);
    event EscrowDisputed(uint256 indexed escrowId, address disputedBy, string reason);
    event DisputeResolved(uint256 indexed escrowId, uint256 clientAmount, uint256 agentAmount);
    event EscrowExpired(uint256 indexed escrowId, uint256 refundAmount);
    event EscrowCancelled(uint256 indexed escrowId, uint256 refundAmount);

    // ======================== MODIFIERS ========================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    modifier escrowExists(uint256 escrowId) {
        require(escrowId > 0 && escrowId < nextEscrowId, "Escrow not found");
        _;
    }

    modifier validToken(uint256 tokenId) {
        require(tokenId > 0 && tokenId <= soulContract.totalSouls(), "Invalid token");
        _;
    }

    // ======================== CONSTRUCTOR ========================

    constructor(address _soulContract, address _arbiter) {
        require(_soulContract != address(0), "Invalid soul contract");
        require(_arbiter != address(0), "Invalid arbiter");
        soulContract = IALIASSoul(_soulContract);
        owner = msg.sender;
        arbiter = _arbiter;
        feeRecipient = msg.sender;
    }

    // ======================== CORE FUNCTIONS ========================

    /**
     * @notice Create and fund an escrow for a job
     * @param clientTokenId Client's ALIAS token ID
     * @param agentTokenId Agent's ALIAS token ID to hire
     * @param jobDescription Description of the job
     * @param deadline Unix timestamp for job deadline
     */
    function createEscrow(uint256 clientTokenId, uint256 agentTokenId, string calldata jobDescription, uint256 deadline)
        external
        payable
        nonReentrant
        validToken(clientTokenId)
        validToken(agentTokenId)
        returns (uint256)
    {
        require(msg.value >= minEscrowAmount, "Below minimum");
        require(deadline > block.timestamp, "Deadline in past");
        require(clientTokenId != agentTokenId, "Cannot hire self");
        require(bytes(jobDescription).length > 0 && bytes(jobDescription).length <= 1000, "Invalid description");

        uint256 escrowId = nextEscrowId++;

        escrows[escrowId] = Escrow({
            id: escrowId,
            clientTokenId: clientTokenId,
            agentTokenId: agentTokenId,
            client: msg.sender,
            agent: address(0), // Set when agent starts
            amount: msg.value,
            createdAt: block.timestamp,
            deadline: deadline,
            jobDescription: jobDescription,
            resultHash: "",
            disputeReason: "",
            state: EscrowState.Funded
        });

        clientEscrows[clientTokenId].push(escrowId);
        agentEscrows[agentTokenId].push(escrowId);
        activeEscrowCount++;

        emit EscrowCreated(escrowId, clientTokenId, agentTokenId, msg.value, deadline);
        return escrowId;
    }

    /**
     * @notice Agent accepts and starts the job
     * @param escrowId The escrow ID to accept
     */
    function startJob(uint256 escrowId) external escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Funded, "Not in Funded state");
        require(block.timestamp < e.deadline, "Deadline passed");

        e.agent = msg.sender;
        e.state = EscrowState.InProgress;

        emit JobStarted(escrowId, e.agentTokenId, block.timestamp);
    }

    /**
     * @notice Agent submits completed work
     * @param escrowId The escrow ID
     * @param resultHash IPFS hash of the result
     */
    function completeJob(uint256 escrowId, string calldata resultHash) external escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.InProgress, "Not in progress");
        require(msg.sender == e.agent, "Not the agent");
        require(bytes(resultHash).length > 0, "Empty result");

        e.resultHash = resultHash;
        e.state = EscrowState.Completed;

        emit JobCompleted(escrowId, resultHash, block.timestamp);
    }

    /**
     * @notice Client approves work and releases payment
     * @param escrowId The escrow ID
     */
    function approveAndRelease(uint256 escrowId) external nonReentrant escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Completed, "Not completed");
        require(msg.sender == e.client, "Not client");

        uint256 fee = (e.amount * protocolFeeBps) / 10000;
        uint256 agentAmount = e.amount - fee;

        e.state = EscrowState.Resolved;
        totalFees += fee;
        activeEscrowCount--;

        (bool sent,) = payable(e.agent).call{value: agentAmount}("");
        require(sent, "Agent payment failed");

        if (fee > 0) {
            (bool feeSent,) = payable(feeRecipient).call{value: fee}("");
            require(feeSent, "Fee transfer failed");
        }

        emit EscrowReleased(escrowId, agentAmount, fee);
    }

    /**
     * @notice Either party can raise a dispute
     * @param escrowId The escrow ID
     * @param reason Reason for dispute
     */
    function disputeJob(uint256 escrowId, string calldata reason) external escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.InProgress || e.state == EscrowState.Completed, "Cannot dispute in this state");
        require(msg.sender == e.client || msg.sender == e.agent, "Not a party to this escrow");
        require(bytes(reason).length > 0 && bytes(reason).length <= 280, "Invalid reason");

        e.disputeReason = reason;
        e.state = EscrowState.Disputed;

        emit EscrowDisputed(escrowId, msg.sender, reason);
    }

    /**
     * @notice Arbiter resolves a dispute by splitting funds
     * @param escrowId The escrow ID
     * @param clientBps Basis points (0-10000) to return to client
     * @param agentBps Basis points (0-10000) to send to agent
     */
    function resolveDispute(uint256 escrowId, uint256 clientBps, uint256 agentBps)
        external
        nonReentrant
        onlyArbiter
        escrowExists(escrowId)
    {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Disputed, "Not disputed");
        require(clientBps + agentBps == 10000, "Must total 100%");

        e.state = EscrowState.Resolved;
        activeEscrowCount--;

        uint256 clientAmount = (e.amount * clientBps) / 10000;
        uint256 agentAmount = e.amount - clientAmount;

        if (clientAmount > 0) {
            (bool clientSent,) = payable(e.client).call{value: clientAmount}("");
            require(clientSent, "Client refund failed");
        }
        if (agentAmount > 0) {
            (bool agentSent,) = payable(e.agent).call{value: agentAmount}("");
            require(agentSent, "Agent payment failed");
        }

        emit DisputeResolved(escrowId, clientAmount, agentAmount);
    }

    /**
     * @notice Client reclaims funds after deadline + grace period
     * @param escrowId The escrow ID
     */
    function claimExpired(uint256 escrowId) external nonReentrant escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Funded || e.state == EscrowState.InProgress, "Cannot expire in this state");
        require(block.timestamp > e.deadline + gracePeriod, "Not yet expired");
        require(msg.sender == e.client, "Not client");

        e.state = EscrowState.Expired;
        activeEscrowCount--;

        (bool sent,) = payable(e.client).call{value: e.amount}("");
        require(sent, "Refund failed");

        emit EscrowExpired(escrowId, e.amount);
    }

    /**
     * @notice Client cancels before agent starts — full refund
     * @param escrowId The escrow ID
     */
    function cancelEscrow(uint256 escrowId) external nonReentrant escrowExists(escrowId) {
        Escrow storage e = escrows[escrowId];
        require(e.state == EscrowState.Funded, "Can only cancel before start");
        require(msg.sender == e.client, "Not client");

        e.state = EscrowState.Cancelled;
        activeEscrowCount--;

        (bool sent,) = payable(e.client).call{value: e.amount}("");
        require(sent, "Refund failed");

        emit EscrowCancelled(escrowId, e.amount);
    }

    // ======================== VIEW FUNCTIONS ========================

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        require(escrowId > 0 && escrowId < nextEscrowId, "Escrow not found");
        return escrows[escrowId];
    }

    function getEscrowsByClient(uint256 clientTokenId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _paginate(clientEscrows[clientTokenId], offset, limit);
    }

    function getEscrowsByAgent(uint256 agentTokenId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _paginate(agentEscrows[agentTokenId], offset, limit);
    }

    function getActiveEscrowCount() external view returns (uint256) {
        return activeEscrowCount;
    }

    // ======================== ADMIN FUNCTIONS ========================

    function setProtocolFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        protocolFeeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
    }

    function setArbiter(address _arbiter) external onlyOwner {
        require(_arbiter != address(0), "Zero address");
        arbiter = _arbiter;
    }

    function setGracePeriod(uint256 _period) external onlyOwner {
        gracePeriod = _period;
    }

    function setMinEscrowAmount(uint256 _min) external onlyOwner {
        minEscrowAmount = _min;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ======================== INTERNAL ========================

    function _paginate(uint256[] storage arr, uint256 offset, uint256 limit) internal view returns (uint256[] memory) {
        uint256 total = arr.length;
        if (offset >= total) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256 len = end - offset;
        uint256[] memory result = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = arr[offset + i];
        }
        return result;
    }
}
