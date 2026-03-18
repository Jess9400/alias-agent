/**
 * ALIAS - Soulbound Identity for AI Agents
 * =========================================
 * Main JavaScript for the ALIAS dashboard
 * 
 * @author Jessica Nascimento
 * @version 1.1.0
 * @license MIT
 * @see https://github.com/Jess9400/alias-agent
 * 
 * Security Features:
 * - XSS protection via HTML escaping
 * - Input sanitization for all user inputs
 * - Safe DOM manipulation (textContent over innerHTML)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    CONTRACT_ADDRESS: "0x0F2f94281F87793ee086a2B6517B6db450192874",
    RPC_URL: "https://base.publicnode.com",
    CHAIN_ID: 8453,
    ENS_API: "https://api.ensdata.net",
    BASESCAN_URL: "https://basescan.org",
    VERIFICATION_REGISTRY: "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715",
    API_URL: "https://api.alias-protocol.xyz",
    PLATFORM_WALLET: "0x7F66dFcD8e9e4e7Ec435D0631C5d723fFaDdb211",
    JOB_REGISTRY: "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8",
    ESCROW_REGISTRY: "0xfE97854DF19d0d20185EFE4ACc9EE477797FA0a0",
    STAKE_REGISTRY: "0x2de431772062817EEB799c42Dbb5083F607BA6Ce",
    REPUTATION_ENGINE: "0x37eD5C32f40D9404f6c875381fD15CAa040Ab720"
};

// Dynamic rate calculation based on on-chain reputation/actions
function getAgentRate(agent) {
    var actions = agent.actions || 0;
    if (actions >= 20) return 0.0008;
    if (actions >= 10) return 0.0005;
    if (actions >= 5) return 0.0003;
    return 0.0001;
}

const SELECTORS = {
    hasSoul: "0xbdd75202",
    agentToSoul: "0xf7c3328c",
    totalSouls: "0x4879a9a6"
};

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} - Safely escaped text
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Sanitize user input
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
    if (!input) return '';
    return String(input).replace(/<[^>]*>/g, '').replace(/[<>\"'&]/g, '').trim();
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate ENS name format
 */
function isValidENS(name) {
    return /^[a-zA-Z0-9-]+\.eth$/.test(name);
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 5000;
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.onclick = function() { removeToast(toast); };
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    var timer = setTimeout(function() { removeToast(toast); }, duration);
    toast.onclick = function() { clearTimeout(timer); removeToast(toast); };
}

function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
}

// Loading overlay for long-running jobs
function showJobLoading(agentName) {
    var existing = document.getElementById('jobLoadingOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'job-loading-overlay';
    overlay.id = 'jobLoadingOverlay';

    var box = document.createElement('div');
    box.className = 'job-loading-box';

    var spinner = document.createElement('div');
    spinner.className = 'job-loading-spinner';
    box.appendChild(spinner);

    var text = document.createElement('div');
    text.className = 'job-loading-text';
    text.id = 'jobLoadingText';
    text.textContent = agentName + ' is working on your job...';
    box.appendChild(text);

    var sub = document.createElement('div');
    sub.className = 'job-loading-sub';
    sub.textContent = 'AI processing via Venice - this may take 10-30 seconds';
    box.appendChild(sub);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function hideJobLoading() {
    var overlay = document.getElementById('jobLoadingOverlay');
    if (overlay) overlay.remove();
}

function updateJobLoadingText(text) {
    var el = document.getElementById('jobLoadingText');
    if (el) el.textContent = text;
}

// =============================================================================
// AGENT REGISTRY
// =============================================================================

var agents = []; // Populated from chain by loadAgentsFromChain()
var selectedAgent = null;

var allSkills = ["general", "coordination", "autonomous", "verification", "risk-assessment", "collaboration", "data-analysis", "forecasting", "reporting", "code-audit", "vulnerability-detection", "security-review", "writing", "marketing", "documentation", "defi-analysis", "yield-farming", "protocol-review", "research", "due-diligence", "report-writing"];

// =============================================================================
// DYNAMIC AGENT LOADING WITH ETHERS.JS
// =============================================================================
const SOUL_ABI = [
    "function mintSoul(address agent, string name, string metadataURI, string skills) returns (uint256)",
    "function totalSouls() view returns (uint256)",
    "function actionCount(uint256 tokenId) view returns (uint256)",
    "function souls(uint256 tokenId) view returns (string name, string metadataURI, address creator, uint256 createdAt, string skills, bool active)"
];

const VERIFICATION_ABI = [
    "function verify(uint256 tokenId, string message) external",
    "function getVerificationCount(uint256 tokenId) external view returns (uint256)",
    "function getVerifications(uint256 tokenId) external view returns (tuple(address verifier, uint256 timestamp, string message)[])",
    "function isVerifiedBy(address verifier, uint256 tokenId) external view returns (bool)"
];

const JOB_REGISTRY_ABI = [
    "function recordJob(uint256 tokenId, string escrowId, string message) external",
    "function getJobCount(uint256 tokenId) external view returns (uint256)",
    "function getJobs(uint256 tokenId, uint256 offset, uint256 limit) external view returns (tuple(address recorder, uint256 timestamp, string escrowId, string message)[])"
];

const STAKE_REGISTRY_ABI = [
    "function stake(uint256 tokenId) external payable",
    "function requestUnstake(uint256 tokenId, uint256 amount) external",
    "function unstake(uint256 tokenId) external",
    "function getStakeInfo(uint256 tokenId) external view returns (uint256 amount, uint256 stakedAt, address stakedBy, uint8 tier)",
    "function getTier(uint256 tokenId) external view returns (uint8)",
    "function getStake(uint256 tokenId) external view returns (uint256)",
    "function isEligible(uint256 tokenId, uint8 required) external view returns (bool)"
];

const ESCROW_REGISTRY_ABI = [
    "function createEscrow(uint256 clientTokenId, uint256 agentTokenId, string jobDescription, uint256 deadline) external payable returns (uint256)",
    "function startJob(uint256 escrowId) external",
    "function completeJob(uint256 escrowId, string resultHash) external",
    "function approveAndRelease(uint256 escrowId) external",
    "function disputeJob(uint256 escrowId, string reason) external",
    "function cancelEscrow(uint256 escrowId) external",
    "function getEscrow(uint256 escrowId) external view returns (tuple(uint256 id, uint256 clientTokenId, uint256 agentTokenId, address client, address agent, uint256 amount, uint256 createdAt, uint256 deadline, string jobDescription, string resultHash, string disputeReason, uint8 state))",
    "function nextEscrowId() external view returns (uint256)",
    "function activeEscrowCount() external view returns (uint256)"
];

const REPUTATION_ENGINE_ABI = [
    "function calculateReputation(uint256 tokenId) view returns (uint256)"
];

const STAKE_TIERS = ["None", "Bronze", "Silver", "Gold", "Platinum"];
const STAKE_TIER_COLORS = { None: "#666", Bronze: "#cd7f32", Silver: "#c0c0c0", Gold: "#ffd700", Platinum: "#e5e4e2" };

// Fetch with timeout — prevents demo from hanging if Venice/API is slow
function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    return Promise.race([
        fetch(url, options),
        new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error("Request timed out after " + (timeoutMs/1000) + "s — API may be busy, try again")); }, timeoutMs);
        })
    ]);
}

// Create a provider that skips network detection (avoids SES lockdown issues)
function getStaticProvider() {
    return new ethers.JsonRpcProvider(CONFIG.RPC_URL, 8453, { staticNetwork: true });
}

async function loadAgentsFromChain() {
    var list = document.getElementById("agentList");
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)"><span class="loading-spinner"></span> Loading from blockchain...</div>';

    try {
        var provider = getStaticProvider();
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
        
        var totalSouls = await contract.totalSouls();
        var count = Number(totalSouls);
        
        // Clear agents array and rebuild from chain
        agents = [];
        var newSkills = [];
        
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        var jobContract = new ethers.Contract(CONFIG.JOB_REGISTRY, JOB_REGISTRY_ABI, provider);
        var repContract = new ethers.Contract(CONFIG.REPUTATION_ENGINE, REPUTATION_ENGINE_ABI, provider);

        for (var i = 1; i <= count; i++) {
            await new Promise(function(r) { setTimeout(r, 200); });
            try {
                var soul = await contract.souls(i);

                if (soul.active) {
                    var skillsArray = extractSkills(soul.skills);

                    // Fetch on-chain activity data
                    var actions = 0;
                    var verifications = 0;
                    var jobCount = 0;
                    try {
                        actions = Number(await contract.actionCount(i));
                    } catch (e) {}
                    try {
                        verifications = Number(await verifyContract.getVerificationCount(i));
                    } catch (e) {}
                    try {
                        jobCount = Number(await jobContract.getJobCount(i));
                    } catch (e) {}

                    // Try on-chain ReputationEngine first, fall back to local calculation
                    var rep = 0;
                    try {
                        rep = Number(await repContract.calculateReputation(i));
                    } catch (e) {
                        // Fallback: local reputation calc — age + actions (20pts) + verifications (15pts) + jobs (25pts)
                        var age = Math.floor(Date.now() / 1000) - Number(soul.createdAt);
                        var ageRep = Math.min(Math.floor(age / 600), 100);
                        var actionRep = actions * 20;
                        var verifyRep = verifications * 15;
                        var jobRep = jobCount * 25;
                        rep = Math.max(0, ageRep + actionRep + verifyRep + jobRep);
                    }

                    var tier = "NEWCOMER";
                    if (rep >= 500) tier = "LEGENDARY";
                    else if (rep >= 200) tier = "ELITE";
                    else if (rep >= 100) tier = "TRUSTED";
                    else if (rep >= 50) tier = "VERIFIED";

                    var addr = soul.creator;
                    agents.push({
                        name: soul.name,
                        address: addr.slice(0, 6) + "..." + addr.slice(-3),
                        fullAddress: addr,
                        skills: skillsArray,
                        rep: rep,
                        tier: tier,
                        tokenId: i,
                        active: soul.active,
                        description: soul.skills,
                        actions: actions,
                        verifications: verifications,
                        jobCount: jobCount,
                        createdAt: Number(soul.createdAt),
                        metadataURI: soul.metadataURI || ""
                    });

                    // Collect skills
                    skillsArray.forEach(function(s) {
                        if (newSkills.indexOf(s) === -1) newSkills.push(s);
                    });
                }
            } catch (e) {
                console.log("Failed to load soul #" + i, e);
            }
        }
        
        if (newSkills.length > 0) allSkills = newSkills;
        
        populateAgents();
        populateSkillsWithSearch(); populateTrustNetwork();
        typeInTerminal("[CHAIN] Loaded " + agents.length + " agents from blockchain", "success");
        
    } catch (error) {
        console.error("Failed to load from chain:", error);
        typeInTerminal("[WARN] Could not load agents from blockchain — check RPC connection", "warning");
        var list = document.getElementById("agentList");
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">Failed to load agents from chain. Please refresh to retry.</div>';
    }
}

function extractSkills(skillsField) {
    if (!skillsField || typeof skillsField !== 'string' || skillsField.trim() === '') {
        return ["general"];
    }
    // Parse the on-chain comma-separated skills field directly
    var parsed = skillsField.split(",").map(function(s) {
        return s.trim().toLowerCase();
    }).filter(function(s) {
        return s.length > 0;
    });
    return parsed.length > 0 ? parsed : ["general"];
}

// =============================================================================
// UI HELPER FUNCTIONS
// =============================================================================

/**
 * Show loading skeleton in stats
 */
function showStatsSkeleton() {
    ["totalSouls", "networkRep", "totalVerifications", "totalVolume"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<span class="skeleton-loader"></span>';
    });
}

/**
 * Display search result safely (no XSS)
 */
function showSearchResult(data, isSuccess) {
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = isSuccess ? "var(--success)" : "var(--warning)";
    box.style.background = isSuccess ? "rgba(0,255,136,0.1)" : "rgba(255,170,0,0.1)";
    box.innerHTML = '';
    box.style.position = 'relative';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;color:var(--text-dim);font-size:1.2rem;cursor:pointer;padding:4px 8px;border-radius:6px;transition:color 0.2s;';
    closeBtn.onmouseover = function() { closeBtn.style.color = 'var(--text)'; };
    closeBtn.onmouseout = function() { closeBtn.style.color = 'var(--text-dim)'; };
    closeBtn.onclick = function() { hideSearchResult(); };
    box.appendChild(closeBtn);

    if (data.title) {
        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'font-size:1.2rem;margin-bottom:10px;color:' + (isSuccess ? 'var(--success)' : 'var(--warning)');
        titleDiv.textContent = data.title;
        box.appendChild(titleDiv);
    }
    
    if (data.name) {
        var nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-size:1.3rem;font-weight:bold';
        nameDiv.textContent = data.name;
        box.appendChild(nameDiv);
    }
    
    if (data.address) {
        var addrDiv = document.createElement('div');
        addrDiv.style.cssText = 'color:var(--text-dim);font-family:monospace;margin-top:5px';
        addrDiv.textContent = data.address;
        box.appendChild(addrDiv);
    }
    
    if (data.tokenId !== undefined) {
        var tokenDiv = document.createElement('div');
        tokenDiv.style.cssText = 'margin-top:15px';
        var tokenSpan = document.createElement('span');
        tokenSpan.style.cssText = 'color:var(--primary);font-size:2rem;font-weight:bold';
        tokenSpan.textContent = '#' + data.tokenId;
        tokenDiv.appendChild(tokenSpan);
        var labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'color:var(--text-dim);margin-left:10px';
        labelSpan.textContent = 'TOKEN ID';
        tokenDiv.appendChild(labelSpan);
        box.appendChild(tokenDiv);
    }
    
    if (data.rep !== undefined) {
        var repDiv = document.createElement('div');
        repDiv.style.cssText = 'margin-top:10px';
        var repSpan = document.createElement('span');
        repSpan.style.cssText = 'color:var(--success);font-size:1.5rem;font-weight:bold';
        repSpan.textContent = data.rep;
        repDiv.appendChild(repSpan);
        var repLabel = document.createElement('span');
        repLabel.style.cssText = 'color:var(--text-dim);margin-left:5px';
        repLabel.textContent = ' REP';
        repDiv.appendChild(repLabel);
        if (data.tier) {
            var tierSpan = document.createElement('span');
            tierSpan.style.cssText = 'background:rgba(0,212,255,0.2);padding:3px 10px;border-radius:10px;margin-left:10px';
            tierSpan.textContent = data.tier;
            repDiv.appendChild(tierSpan);
        }
        box.appendChild(repDiv);
    }
    
    if (data.skills && data.skills.length > 0) {
        var skillsDiv = document.createElement('div');
        skillsDiv.style.cssText = 'color:var(--primary);margin-top:10px';
        skillsDiv.textContent = data.skills.join(' • ');
        box.appendChild(skillsDiv);
    }
    
    if (data.metadataURI && data.metadataURI.startsWith("ipfs://")) {
        var ipfsDiv = document.createElement('div');
        ipfsDiv.style.cssText = 'margin-top:8px';
        var ipfsLink = document.createElement('a');
        var cid = data.metadataURI.replace("ipfs://", "");
        ipfsLink.href = "https://gateway.pinata.cloud/ipfs/" + cid;
        ipfsLink.target = '_blank';
        ipfsLink.rel = 'noopener noreferrer';
        ipfsLink.style.cssText = 'color:var(--secondary);font-size:0.85rem;text-decoration:none;';
        ipfsLink.textContent = 'IPFS Metadata: ' + cid.slice(0, 12) + '...';
        ipfsDiv.appendChild(ipfsLink);
        box.appendChild(ipfsDiv);
    }

    if (data.link) {
        var linkDiv = document.createElement('div');
        linkDiv.style.cssText = 'margin-top:15px';
        var link = document.createElement('a');
        link.href = data.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color:var(--primary)';
        link.textContent = 'View on BaseScan →';
        linkDiv.appendChild(link);
        box.appendChild(linkDiv);
    }
    
    if (isSuccess && data.name && data.rep !== undefined) {
        var verifyDiv = document.createElement("div");
        verifyDiv.style.cssText = "margin-top:15px;";
        var verifyBtn = document.createElement("button");
        verifyBtn.style.cssText = "background:var(--secondary);color:#000;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;";
        verifyBtn.textContent = "✓ Sign Verification";
        verifyBtn.onclick = function() { signVerification(selectedAgent); };
        verifyDiv.appendChild(verifyBtn);
        box.appendChild(verifyDiv);
        // Payment buttons
        if (selectedAgent) { addPaymentButtons(box, selectedAgent); }
    }

    if (data.message) {
        var msgDiv = document.createElement('div');
        msgDiv.style.cssText = 'margin-top:10px;color:var(--text-dim)';
        msgDiv.textContent = data.message;
        box.appendChild(msgDiv);
    }
}

function showSearchLoading(message) {
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = "var(--primary)";
    box.style.background = "rgba(0,212,255,0.1)";
    box.innerHTML = '';
    var spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    box.appendChild(spinner);
    box.appendChild(document.createTextNode(' ' + escapeHtml(message)));
}

function hideSearchResult() {
    document.getElementById("searchResult").style.display = "none";
}

function typeInTerminal(text, cls) {
    var terminal = document.getElementById("terminal");
    var line = document.createElement("div");
    line.className = "terminal-line " + (cls || "");
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    document.getElementById("terminal").innerHTML = "";
}

// =============================================================================
// BLOCKCHAIN FUNCTIONS
// =============================================================================

function loadStats() {
    showStatsSkeleton();

    // Load all stats from actual on-chain data
    var provider = getStaticProvider();
    var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
    var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
    var jobContract = new ethers.Contract(CONFIG.JOB_REGISTRY, JOB_REGISTRY_ABI, provider);

    contract.totalSouls().then(function(totalSouls) {
        var count = Number(totalSouls);
        document.getElementById("totalSouls").textContent = count;

        // Calculate real network rep + total verifications + jobs from chain
        var totalRep = 0;
        var totalVerifications = 0;
        var totalJobs = 0;
        var loaded = 0;

        for (var i = 1; i <= count; i++) {
            (function(tokenId) {
                var agentActions = 0, agentVerifies = 0, agentJobs = 0, agentAge = 0;

                Promise.all([
                    contract.souls(tokenId).catch(function() { return null; }),
                    contract.actionCount(tokenId).catch(function() { return 0; }),
                    verifyContract.getVerificationCount(tokenId).catch(function() { return 0; }),
                    jobContract.getJobCount(tokenId).catch(function() { return 0; })
                ]).then(function(results) {
                    var soul = results[0];
                    agentActions = Number(results[1]);
                    agentVerifies = Number(results[2]);
                    agentJobs = Number(results[3]);

                    if (soul && soul.active) {
                        agentAge = Math.floor(Date.now() / 1000) - Number(soul.createdAt);
                        var ageRep = Math.min(Math.floor(agentAge / 600), 100);
                        totalRep += ageRep + (agentActions * 20) + (agentVerifies * 15) + (agentJobs * 25);
                    }
                    totalVerifications += agentVerifies;
                    totalJobs += agentJobs;

                    loaded++;
                    if (loaded === count) {
                        document.getElementById("networkRep").textContent = totalRep;
                        document.getElementById("totalVerifications").textContent = totalVerifications + totalJobs;
                        document.getElementById("totalVolume").textContent = totalJobs;
                    }
                });
            })(i);
        }
    }).catch(function() {
        document.getElementById("totalSouls").textContent = "--";
        document.getElementById("networkRep").textContent = "--";
        document.getElementById("totalVerifications").textContent = "--";
        document.getElementById("totalVolume").textContent = "--";
    });
}

function checkSoulOnchain(address, ensName) {
    if (!isValidAddress(address)) {
        typeInTerminal("[ERROR] Invalid address format", "warning");
        showSearchResult({ title: "✗ Invalid address format", message: "Please enter a valid Ethereum address" }, false);
        return;
    }
    
    var callData = SELECTORS.hasSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(CONFIG.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"], id: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var hasSoul = data.result && data.result !== "0x0000000000000000000000000000000000000000000000000000000000000000";
        if (hasSoul) {
            typeInTerminal("[SOUL] ✓ Soul found!", "success");
            getTokenId(address, ensName);
        } else {
            typeInTerminal("[SOUL] ✗ No soul found", "warning");
            var displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult({ title: "✗ NO SOUL FOUND", name: displayName, address: address, message: "This address does not have an ALIAS identity yet." }, false);
        }
    })
    .catch(function() {
        typeInTerminal("[ERROR] Chain lookup failed", "warning");
        showSearchResult({ title: "✗ Chain lookup failed", message: "Please try again" }, false);
    });
}

function getTokenId(address, ensName) {
    var callData = SELECTORS.agentToSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(CONFIG.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"], id: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.result) {
            var tokenId = parseInt(data.result, 16);
            typeInTerminal("[TOKEN] ID: #" + tokenId, "agent");
            var displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult({ title: "✓ SOUL VERIFIED", name: displayName, address: address, tokenId: tokenId, link: CONFIG.BASESCAN_URL + "/token/" + CONFIG.CONTRACT_ADDRESS + "?a=" + tokenId, message: "See Agent Activity for logs" }, true);
        }
    })
    .catch(function(e) { console.log("Token ID lookup failed:", e.message); });
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

function searchAgent() {
    var rawInput = document.getElementById("searchInput").value;
    var q = sanitizeInput(rawInput);
    var qLower = q.toLowerCase();
    
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Looking for: " + q, "system");
    
    if (!q) {
        typeInTerminal("[ERROR] Please enter a search term", "warning");
        return;
    }
    
    if (q.endsWith(".eth")) {
        if (!isValidENS(q)) {
            typeInTerminal("[ERROR] Invalid ENS format", "warning");
            showSearchResult({ title: "✗ Invalid ENS format" }, false);
            return;
        }
        showSearchLoading("Resolving " + q + "...");
        typeInTerminal("[ENS] Resolving " + q + "...", "warning");
        
        fetch(CONFIG.ENS_API + "/" + encodeURIComponent(q))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.address && isValidAddress(data.address)) {
                    typeInTerminal("[ENS] Resolved!", "success");
                    showSearchResult({ title: "✓ ENS RESOLVED", name: q, address: data.address, message: "Checking for ALIAS soul..." }, true);
                    checkSoulOnchain(data.address, q);
                } else {
                    typeInTerminal("[ERROR] ENS name not found", "warning");
                    showSearchResult({ title: "✗ ENS name not found" }, false);
                }
            })
            .catch(function() {
                typeInTerminal("[ERROR] ENS lookup failed", "warning");
                showSearchResult({ title: "✗ ENS lookup failed" }, false);
            });
        return;
    }
    
    if (q.startsWith("0x") && q.length === 42) {
        if (!isValidAddress(q)) {
            showSearchResult({ title: "✗ Invalid address format" }, false);
            return;
        }
        showSearchLoading("Checking onchain...");
        checkSoulOnchain(q, null);
        return;
    }
    
    var found = null;
    for (var i = 0; i < agents.length; i++) {
        if (agents[i].name.toLowerCase().indexOf(qLower) !== -1) {
            found = agents[i];
            break;
        }
    }
    
    if (found) {
        typeInTerminal("[FOUND] " + found.name, "success");
        showSearchResult({ title: "✓ AGENT FOUND", name: found.name, address: found.address, rep: found.rep, tier: found.tier, skills: found.skills, message: "See Agent Activity for details" }, true);
    } else {
        typeInTerminal("[ERROR] Agent not found", "warning");
        showSearchResult({ title: "✗ Agent not found", message: "Try a wallet address (0x...) or ENS name (.eth)" }, false);
    }
}

function searchSkill(skill) {
    console.log("Searching for skill:", skill);
    console.log("All agents:", agents.map(function(a) { return { name: a.name, skills: a.skills }; }));
    var sanitizedSkill = sanitizeInput(skill);
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Skill: " + sanitizedSkill, "system");
    
    var matches = agents.filter(function(a) { return a.skills.indexOf(sanitizedSkill) !== -1; });
    console.log("Found matches:", matches.length, matches.map(function(m) { return m.name; }));
    
    if (matches.length > 0) {
        var box = document.getElementById("skillSearchResults");
        box.style.display = "block";
        box.style.borderColor = "var(--success)";
        box.style.background = "rgba(0,255,136,0.1)";
        box.innerHTML = '';
        
        var headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';

        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'color:var(--success);font-size:1.2rem';
        titleDiv.textContent = '✓ ' + matches.length + ' AGENT(S) WITH SKILL: ' + sanitizedSkill;
        headerDiv.appendChild(titleDiv);

        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:none;border:1px solid var(--text-dim);color:var(--text);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.onclick = function() { box.style.display = 'none'; box.innerHTML = ''; };
        headerDiv.appendChild(closeBtn);

        box.appendChild(headerDiv);
        
        matches.forEach(function(agent) {
            var agentDiv = document.createElement('div');
            agentDiv.style.cssText = 'padding:10px;background:rgba(0,212,255,0.05);border-radius:8px;margin-top:8px;cursor:pointer;transition:background 0.2s';
            agentDiv.textContent = agent.name + ' - Rep: ' + agent.rep + ' (' + agent.tier + ')';
            agentDiv.onmouseover = function() { this.style.background = 'rgba(0,212,255,0.15)'; };
            agentDiv.onmouseout = function() { this.style.background = 'rgba(0,212,255,0.05)'; };
            agentDiv.onclick = function() { selectAgent(agent.name); window.scrollTo({ top: 0, behavior: 'smooth' }); };
            box.appendChild(agentDiv);
        });
    } else {
        typeInTerminal("[INFO] No agents found with skill: " + sanitizedSkill, "warning");
    }
}

function selectAgent(name) {
    var agent = agents.find(function(a) { return a.name === name; }); selectedAgent = agent;
    if (!agent) return;

    clearTerminal();
    typeInTerminal("[SELECT] " + agent.name, "system");
    showSearchResult({ title: "\u2713 AGENT SELECTED", name: agent.name, address: agent.address, rep: agent.rep, tier: agent.tier, skills: agent.skills, tokenId: agent.tokenId, metadataURI: agent.metadataURI, message: "Loading activity..." }, true);
    showToast("Selected: " + agent.name + " (" + agent.tier + ")", "info", 3000);
    showAgentActivity(agent);

    // Scroll activity panel into view
    var activityCard = document.getElementById("activityCard");
    if (activityCard) {
        activityCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

// =============================================================================
// UI POPULATION (XSS-safe)
// =============================================================================

function populateAgents() {
    var list = document.getElementById("agentList");
    list.innerHTML = '';
    
    agents.forEach(function(a) {
        var item = document.createElement('div');
        item.className = 'agent-item';
        item.onclick = function() { selectAgent(a.name); };
        
        var icon = document.createElement('div');
        icon.className = 'agent-icon';
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 00-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 00-9-9z"/></svg>';
        item.appendChild(icon);
        
        var info = document.createElement('div');
        info.className = 'agent-info';
        
        var nameDiv = document.createElement('div');
        nameDiv.className = 'agent-name';
        nameDiv.textContent = a.name;
        info.appendChild(nameDiv);
        
        var addrDiv = document.createElement('div');
        addrDiv.className = 'agent-addr';
        addrDiv.textContent = a.address;
        info.appendChild(addrDiv);
        
        var skillsDiv = document.createElement('div');
        skillsDiv.className = 'agent-skills';
        skillsDiv.textContent = a.skills.join(' • ');
        info.appendChild(skillsDiv);
        
        item.appendChild(info);
        
        var rep = document.createElement('div');
        rep.className = 'agent-rep';
        
        var repValue = document.createElement('div');
        repValue.className = 'rep-value';
        repValue.textContent = a.rep;
        rep.appendChild(repValue);
        
        var repTier = document.createElement('div');
        repTier.className = 'rep-tier';
        repTier.textContent = a.tier;
        rep.appendChild(repTier);

        var stakeBadge = document.createElement('div');
        stakeBadge.className = 'stake-badge';
        stakeBadge.id = 'stake-badge-' + a.tokenId;
        stakeBadge.style.fontSize = '10px';
        stakeBadge.style.marginTop = '2px';
        rep.appendChild(stakeBadge);

        item.appendChild(rep);
        list.appendChild(item);
    });
    loadStakeTiers();
}

async function loadStakeTiers() {
    try {
        var provider = getStaticProvider();
        var stakeContract = new ethers.Contract(CONFIG.STAKE_REGISTRY, STAKE_REGISTRY_ABI, provider);
        var promises = agents.map(function(a) {
            return stakeContract.getTier(a.tokenId).then(function(tier) {
                return { tokenId: a.tokenId, tier: Number(tier) };
            }).catch(function() { return { tokenId: a.tokenId, tier: 0 }; });
        });
        var results = await Promise.all(promises);
        results.forEach(function(r) {
            var badge = document.getElementById('stake-badge-' + r.tokenId);
            if (badge && r.tier > 0) {
                var tierName = STAKE_TIERS[r.tier] || "None";
                badge.textContent = tierName;
                badge.style.color = STAKE_TIER_COLORS[tierName] || "#666";
            }
        });
    } catch (e) {
        console.log("Stake tier load skipped:", e.message);
    }
}

// =============================================================================
// DEMO FUNCTIONS
// =============================================================================

function runVerifyDemo() {
    clearTerminal();
    hideSearchResult();
    var agent = selectedAgent || agents[0];
    typeInTerminal("[SYSTEM] Initiating verification...", "system");
    setTimeout(function() { typeInTerminal("[TARGET] " + agent.name + " (" + agent.address + ")", "system"); }, 400);
    setTimeout(function() { typeInTerminal("[CHECK] Onchain identity...", "warning"); }, 800);
    setTimeout(function() { typeInTerminal("[OK] Soul found: Token #" + agent.tokenId, "success"); }, 1200);
    setTimeout(function() { typeInTerminal("[OK] Reputation: " + agent.rep + " (" + agent.tier + ")", "success"); }, 1600);
    setTimeout(function() { typeInTerminal("[OK] Risk: " + Math.max(10, 100 - agent.rep) + "% - APPROVED", "success"); }, 2000);
    setTimeout(function() { typeInTerminal("[CHAIN] Recording verification...", "warning"); }, 2400);
    setTimeout(function() { typeInTerminal("[TX] 0x" + Math.random().toString(16).slice(2,6) + "..." + Math.random().toString(16).slice(2,6), "system"); }, 2800);
    setTimeout(function() { typeInTerminal("[DONE] Verification complete!", "success"); }, 3200);
}

function runChainDemo() {
    clearTerminal();
    hideSearchResult();
    
    // Get top 4 agents by reputation (from blockchain data)
    var topAgents = agents.slice().sort(function(a, b) {
        return b.rep - a.rep;
    }).slice(0, 4);
    
    typeInTerminal("[SYSTEM] === TRUST CHAIN (Live from Blockchain) ===", "system");
    
    var delay = 300;
    topAgents.forEach(function(agent, index) {
        setTimeout(function() {
            typeInTerminal(agent.name + " (" + agent.tier + ", " + agent.rep + " REP)", "agent");
        }, delay);
        delay += 200;
        
        if (index < topAgents.length - 1) {
            var action = ["verified", "trusted", "hired"][index % 3];
            setTimeout(function() {
                typeInTerminal("  |-- " + action + " -->", "success");
            }, delay);
            delay += 200;
        }
    });
    
    setTimeout(function() {
        typeInTerminal("[INFO] Chain depth: " + (topAgents.length - 1) + " levels", "system");
    }, delay + 200);
    setTimeout(function() {
        typeInTerminal("[INFO] Total network agents: " + agents.length, "success");
    }, delay + 500);
}

function runFullDemo() {
    var modal = document.getElementById("howItWorksModal");
    modal.style.display = "flex";
    modal.innerHTML = "";

    var box = document.createElement("div");
    box.className = "how-modal";

    // Title
    var h2 = document.createElement("h2");
    h2.textContent = "How ALIAS Works";
    box.appendChild(h2);

    var subtitle = document.createElement("p");
    subtitle.style.cssText = "text-align:center;color:var(--text-dim);margin:-10px 0 20px;font-size:0.85rem;";
    subtitle.textContent = "A Proof-of-Reputation protocol — the trust primitive for autonomous AI agents";
    box.appendChild(subtitle);

    // Proof-of-Reputation formula
    var porBox = document.createElement("div");
    porBox.style.cssText = "background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.3);border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;";
    porBox.innerHTML = '<div style="font-family:Orbitron,monospace;font-size:0.85rem;color:var(--primary);margin-bottom:8px;">PROOF-OF-REPUTATION</div>' +
        '<div style="font-size:0.8rem;color:var(--text);line-height:1.8;">' +
        '<span style="color:var(--success);">Identity</span> (Soulbound NFT) + ' +
        '<span style="color:var(--warning);">Actions</span> (on-chain history) + ' +
        '<span style="color:#7b2cbf;">Verifications</span> (peer attestations) + ' +
        '<span style="color:var(--primary);">Jobs</span> (work completed)<br>' +
        '<span style="font-family:Orbitron;font-size:0.75rem;color:var(--text-dim);margin-top:4px;display:inline-block;">= Provable Trust Score for Any Agent</span></div>';
    box.appendChild(porBox);

    // Contract diagram
    var diagram = document.createElement("div");
    diagram.className = "contract-diagram";

    var contracts = [
        {
            icon: "\u{1F9EC}",
            name: "Soul Contract",
            addr: CONFIG.CONTRACT_ADDRESS,
            funcs: ["mintSoul()", "totalSouls()", "actionCount()", "souls()"],
            desc: "Identity & Registration"
        },
        {
            icon: "\u2705",
            name: "Verification Registry",
            addr: CONFIG.VERIFICATION_REGISTRY,
            funcs: ["verify()", "getVerifications()", "getVerificationCount()"],
            desc: "Trust & Attestations"
        },
        {
            icon: "\u{1F4BC}",
            name: "Job Registry",
            addr: CONFIG.JOB_REGISTRY,
            funcs: ["recordJob()", "getJobs()", "getJobCount()"],
            desc: "Work & Reputation"
        }
    ];

    contracts.forEach(function(c) {
        var cbox = document.createElement("div");
        cbox.className = "contract-box";

        var iconEl = document.createElement("div");
        iconEl.className = "contract-box-icon";
        iconEl.textContent = c.icon;
        cbox.appendChild(iconEl);

        var nameEl = document.createElement("div");
        nameEl.className = "contract-box-name";
        nameEl.textContent = c.name;
        cbox.appendChild(nameEl);

        var descEl = document.createElement("div");
        descEl.style.cssText = "color:var(--text);font-size:0.75rem;margin-bottom:6px;";
        descEl.textContent = c.desc;
        cbox.appendChild(descEl);

        var addrLink = document.createElement("a");
        addrLink.className = "contract-box-addr";
        addrLink.href = "https://basescan.org/address/" + c.addr;
        addrLink.target = "_blank";
        addrLink.rel = "noopener noreferrer";
        addrLink.textContent = c.addr.slice(0, 8) + "..." + c.addr.slice(-6);
        addrLink.style.color = "var(--primary)";
        cbox.appendChild(addrLink);

        var funcsDiv = document.createElement("div");
        funcsDiv.className = "contract-box-funcs";
        c.funcs.forEach(function(fn) {
            var fEl = document.createElement("div");
            fEl.className = "contract-box-func";
            fEl.textContent = fn;
            funcsDiv.appendChild(fEl);
        });
        cbox.appendChild(funcsDiv);

        diagram.appendChild(cbox);
    });
    box.appendChild(diagram);

    // Flow steps
    var flowTitle = document.createElement("h3");
    flowTitle.style.cssText = "color:var(--text);font-size:1rem;margin:20px 0 12px;";
    flowTitle.textContent = "Agent Lifecycle";
    box.appendChild(flowTitle);

    var steps = [
        { label: "Register", text: "An AI agent mints a Soulbound Token (non-transferable NFT) on Base, creating a permanent on-chain identity." },
        { label: "Build Trust", text: "Other agents and users verify the agent on-chain via the Verification Registry, building a trust network." },
        { label: "Get Hired", text: "Clients discover agents by skills, hire them for jobs. Venice AI executes the work, and results are delivered." },
        { label: "Earn Reputation", text: "Completed jobs are recorded on the Job Registry. Reputation grows from actions, verifications, jobs, and age." },
        { label: "Self-Sustaining", text: "95% of payment goes to the agent operator, 5% platform fee covers gas + AI costs. The network funds itself." }
    ];

    var ol = document.createElement("ol");
    ol.className = "flow-steps";
    steps.forEach(function(s) {
        var li = document.createElement("li");
        li.className = "flow-step";
        var label = document.createElement("span");
        label.className = "flow-step-label";
        label.textContent = s.label + ": ";
        li.appendChild(label);
        li.appendChild(document.createTextNode(s.text));
        ol.appendChild(li);
    });
    box.appendChild(ol);

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "display:block;width:100%;margin-top:20px;padding:12px;background:var(--primary);border:none;border-radius:10px;color:#000;font-weight:700;cursor:pointer;font-size:0.95rem;";
    closeBtn.textContent = "Close";
    closeBtn.onclick = function() { modal.style.display = "none"; };
    box.appendChild(closeBtn);

    modal.appendChild(box);

    // Click outside to close
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = "none"; };
}

// =============================================================================
// WALLET CONNECTION
// =============================================================================

function connectWallet() {
    connectWalletEnhanced();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener("DOMContentLoaded", function() {
    loadStats();
    loadAgentsFromChain();
    populateSkillsWithSearch(); populateTrustNetwork();
    
    typeInTerminal("[SYSTEM] ALIAS Protocol v1.1 — Proof-of-Reputation for AI Agents", "system");
    typeInTerminal("[NETWORK] Base Mainnet (Chain 8453)", "system");
    typeInTerminal("[INFO] Loading on-chain data...", "warning");

    document.getElementById("connectBtn").addEventListener("click", connectWalletEnhanced);
    autoReconnectWallet();
    document.getElementById("searchBtn").addEventListener("click", searchAgent);
    document.getElementById("verifyBtn").addEventListener("click", function() { if (selectedAgent) { signVerification(selectedAgent); } else { showToast("Please select an agent first!", "warning"); } });
    document.getElementById("chainBtn").addEventListener("click", runChainDemo);
    document.getElementById("demoBtn").addEventListener("click", runFullDemo);
    document.getElementById("autoHireBtn").addEventListener("click", runAutoHireDemo);
    document.getElementById("collabBtn").addEventListener("click", runCollabDemo);
    document.getElementById("jobsBtn").addEventListener("click", showJobHistory);
    
    document.getElementById("searchInput").addEventListener("keypress", function(e) {
        if (e.key === "Enter") searchAgent();
    });

    // Activity feed toggle
    document.getElementById("activityFeedToggle").addEventListener("click", function() {
        var list = document.getElementById("activityFeedList");
        var toggle = document.getElementById("activityFeedToggle");
        if (list.style.display === "none") {
            list.style.display = "block";
            toggle.classList.add("open");
        } else {
            list.style.display = "none";
            toggle.classList.remove("open");
        }
    });

    // Close activity panel
    document.getElementById("closeActivityBtn").addEventListener("click", function() {
        clearTerminal();
        hideSearchResult();
        selectedAgent = null;
        document.getElementById("activityFeedSection").style.display = "none";
        showToast("Agent deselected", "info", 2000);
    });
});

// =============================================================================
// DYNAMIC TRUST NETWORK & SKILLS
// =============================================================================

function populateTrustNetwork() {
    var container = document.getElementById("trustNetwork");
    if (!container || agents.length === 0) return;

    var topAgents = agents.slice().sort(function(a, b) {
        return b.rep - a.rep;
    }).slice(0, 4);

    container.innerHTML = '';
    var arrows = ['verified', 'trusted', 'hired'];

    topAgents.forEach(function(agent, index) {
        var tierClass = agent.tier.toLowerCase();
        var node = document.createElement('div');
        node.className = 'network-node ' + tierClass;

        var nameDiv = document.createElement('div');
        nameDiv.className = 'node-name';
        nameDiv.textContent = agent.name;
        node.appendChild(nameDiv);

        var repDiv = document.createElement('div');
        repDiv.className = 'node-rep';
        repDiv.textContent = agent.rep;
        node.appendChild(repDiv);

        var tierDiv = document.createElement('div');
        tierDiv.className = 'node-tier tier-' + tierClass;
        tierDiv.textContent = agent.tier;
        node.appendChild(tierDiv);

        container.appendChild(node);

        if (index < topAgents.length - 1) {
            var arrowDiv = document.createElement('div');
            arrowDiv.className = 'arrow';
            arrowDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
            arrowDiv.appendChild(document.createTextNode(arrows[index % arrows.length]));
            container.appendChild(arrowDiv);
        }
    });
}

function populateSkillsWithSearch() {
    var grid = document.getElementById("skillsGrid");
    var searchInput = document.getElementById("skillSearchInput");
    if (!grid) return;
    
    // Count skills across all agents
    var skillCounts = {};
    agents.forEach(function(agent) {
        agent.skills.forEach(function(skill) {
            skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
    });
    
    // Sort by count (most used first)
    var sortedSkills = Object.keys(skillCounts).sort(function(a, b) {
        return skillCounts[b] - skillCounts[a];
    });
    
    function renderSkills(filter) {
        grid.innerHTML = '';
        var filterLower = (filter || '').toLowerCase();
        var displayed = 0;
        var maxDisplay = filter ? sortedSkills.length : 10; // Show all when searching, top 10 otherwise
        
        sortedSkills.forEach(function(skill) {
            if (displayed >= maxDisplay) return;
            if (filterLower && skill.toLowerCase().indexOf(filterLower) === -1) return;
            
            var tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.textContent = '';
            tag.appendChild(document.createTextNode(skill + ' '));
            var countSpan = document.createElement('span');
            countSpan.style.cssText = 'opacity:0.6;font-size:0.8em;';
            countSpan.textContent = '(' + skillCounts[skill] + ')';
            tag.appendChild(countSpan);
            tag.onclick = function() { searchSkill(skill); };
            grid.appendChild(tag);
            displayed++;
        });
        
        if (displayed === 0) {
            grid.innerHTML = '<span style="color:var(--text-dim);">No skills found</span>';
        }
    }
    
    // Initial render
    renderSkills('');
    
    // Search listener
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderSkills(this.value);
        });
    }
}

// =============================================================================
// WALLET FEATURES: MINT, MY AGENTS, VERIFY
// =============================================================================

var connectedWallet = null;
var showingMyAgents = false;

// EIP-6963: Discover all available wallets
var discoveredWallets = [];
var activeProvider = null;

window.addEventListener("eip6963:announceProvider", function(event) {
    var info = event.detail.info || {};
    var exists = discoveredWallets.some(function(w) { return w.info.rdns === info.rdns; });
    if (!exists) {
        discoveredWallets.push({ info: info, provider: event.detail.provider });
        console.log("Wallet discovered:", info.name || "unknown", info.rdns || "");
    }
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

// Create a safe wrapper that only exposes request() - avoids MetaMask SES proxy
// traps on selectedAddress getter that cause infinite recursion
function createSafeProvider(raw) {
    return {
        request: function(args) { return raw.request(args); },
        on: function(evt, fn) { if (raw.on) raw.on(evt, fn); },
        removeListener: function(evt, fn) { if (raw.removeListener) raw.removeListener(evt, fn); },
        removeAllListeners: function(evt) { if (raw.removeAllListeners) raw.removeAllListeners(evt); },
        _raw: raw
    };
}

// Get the active safe provider (set after wallet selection)
function getWalletProvider() {
    return activeProvider;
}

// Set active provider from a raw provider
function setActiveProvider(raw) {
    activeProvider = createSafeProvider(raw);
}

// Show wallet picker if multiple wallets, or connect directly if only one
function connectWalletEnhanced() {
    // If already connected, disconnect
    if (connectedWallet) {
        disconnectWallet();
        return;
    }

    // Re-discover wallets (some inject late)
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Build wallet list: EIP-6963 wallets + fallback to window.ethereum
    var wallets = discoveredWallets.slice();
    if (wallets.length === 0 && typeof window.ethereum !== "undefined") {
        wallets.push({
            info: { name: window.ethereum.isMetaMask ? "MetaMask" : "Browser Wallet", icon: "" },
            provider: window.ethereum
        });
    }

    if (wallets.length === 0) {
        showToast("No wallet found! Please install MetaMask or Coinbase Wallet.", "error");
        return;
    }

    if (wallets.length === 1) {
        // Only one wallet - connect directly
        connectWithProvider(wallets[0].provider, wallets[0].info.rdns);
    } else {
        // Multiple wallets - show picker
        showWalletPicker(wallets);
    }
}

// Show wallet selection modal
function showWalletPicker(wallets) {
    // Remove existing picker if any
    var old = document.getElementById("walletPickerOverlay");
    if (old) old.remove();

    var overlay = document.createElement("div");
    overlay.id = "walletPickerOverlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;";

    var box = document.createElement("div");
    box.style.cssText = "background:#1a1a2e;border:1px solid #00d4ff;border-radius:12px;padding:24px;min-width:280px;max-width:360px;";

    var title = document.createElement("h3");
    title.textContent = "Select Wallet";
    title.style.cssText = "color:#00d4ff;margin:0 0 16px 0;text-align:center;font-size:16px;";
    box.appendChild(title);

    wallets.forEach(function(w) {
        var btn = document.createElement("button");
        btn.style.cssText = "display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;margin-bottom:8px;background:#0d0d1a;border:1px solid #333;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;transition:border-color 0.2s;";
        btn.onmouseover = function() { btn.style.borderColor = "#00d4ff"; };
        btn.onmouseout = function() { btn.style.borderColor = "#333"; };

        if (w.info.icon) {
            var img = document.createElement("img");
            img.src = w.info.icon;
            img.style.cssText = "width:28px;height:28px;border-radius:6px;";
            btn.appendChild(img);
        }

        var label = document.createElement("span");
        label.textContent = w.info.name || "Wallet";
        btn.appendChild(label);

        btn.onclick = function() {
            overlay.remove();
            connectWithProvider(w.provider, w.info.rdns);
        };
        box.appendChild(btn);
    });

    // Cancel button
    var cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText = "width:100%;padding:10px;margin-top:8px;background:transparent;border:1px solid #555;border-radius:8px;color:#888;cursor:pointer;font-size:13px;";
    cancel.onclick = function() { overlay.remove(); };
    box.appendChild(cancel);

    overlay.appendChild(box);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// Connect using a specific provider
function connectWithProvider(rawProvider, walletRdns) {
    setActiveProvider(rawProvider);
    var provider = getWalletProvider();
    var isMetaMask = walletRdns === "io.metamask" || rawProvider.isMetaMask;

    localStorage.removeItem("alias_disconnected");

    // MetaMask: use wallet_requestPermissions to force account picker
    // Other wallets: use standard eth_requestAccounts
    var accountPromise;
    if (isMetaMask) {
        accountPromise = provider.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }]
        }).then(function(permissions) {
            var account = null;
            if (permissions && permissions.length > 0) {
                for (var i = 0; i < permissions.length; i++) {
                    var perm = permissions[i];
                    if (perm.caveats && perm.caveats.length > 0) {
                        for (var j = 0; j < perm.caveats.length; j++) {
                            var caveat = perm.caveats[j];
                            if (caveat.value && caveat.value.length > 0) {
                                account = caveat.value[0];
                                break;
                            }
                        }
                    }
                    if (account) break;
                }
            }
            if (!account) {
                return provider.request({ method: "eth_accounts" }).then(function(accts) {
                    return accts && accts.length > 0 ? accts[0] : null;
                });
            }
            return account;
        });
    } else {
        accountPromise = provider.request({ method: "eth_requestAccounts" }).then(function(accounts) {
            return accounts && accounts.length > 0 ? accounts[0] : null;
        });
    }

    accountPromise.then(function(account) {
        if (account) {
            setConnectedWallet(account);
            // Switch to Base
            return provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x2105" }]
            }).catch(function(switchError) {
                if (switchError.code === 4902) {
                    return provider.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0x2105",
                            chainName: "Base",
                            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                            rpcUrls: ["https://mainnet.base.org"],
                            blockExplorerUrls: ["https://basescan.org"]
                        }]
                    });
                }
            });
        }
    }).catch(function(err) {
        console.error("Wallet connection error:", err);
        typeInTerminal("[ERROR] Connection failed", "warning");
    });
}

function setConnectedWallet(account) {
    connectedWallet = account.toLowerCase();
    localStorage.setItem("alias_wallet", connectedWallet);
    var btn = document.getElementById("connectBtn");
    btn.textContent = connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4) + " \u2715";
    btn.title = "Click to disconnect";
    btn.classList.remove("wallet-cta");
    typeInTerminal("[WALLET] Connected: " + connectedWallet, "success");
    typeInTerminal("[NETWORK] Base Mainnet (Chain 8453)", "system");

    // Load saved jobs
    loadJobHistory();

    var myCount = agents.filter(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet;
    }).length;
    if (myCount > 0) {
        typeInTerminal("[INFO] You own " + myCount + " agent(s)!", "success");
    }
}

function disconnectWallet() {
    connectedWallet = null;
    activeProvider = null;
    localStorage.setItem("alias_disconnected", "true");
    localStorage.removeItem("alias_wallet");
    var btn = document.getElementById("connectBtn");
    btn.textContent = "Connect Wallet";
    btn.title = "";
    btn.classList.add("wallet-cta");
    typeInTerminal("[WALLET] Disconnected", "system");
    showToast("Wallet disconnected", "info", 3000);

    if (showingMyAgents) {
        showingMyAgents = false;
        var myBtn = document.getElementById("myAgentsBtn");
        if (myBtn) {
            myBtn.style.background = "transparent";
            myBtn.style.color = "var(--secondary)";
            myBtn.textContent = "My Agents";
        }
        populateAgents();
    }
}

// Auto-reconnect on page load - restore from localStorage only
function autoReconnectWallet() {
    if (localStorage.getItem("alias_disconnected") === "true") return;

    var savedWallet = localStorage.getItem("alias_wallet");
    if (savedWallet) {
        connectedWallet = savedWallet;
        var btn = document.getElementById("connectBtn");
        btn.textContent = savedWallet.slice(0, 6) + "..." + savedWallet.slice(-4) + " \u2715";
        btn.title = "Click to disconnect";
        typeInTerminal("[WALLET] Restored: " + savedWallet, "success");
        loadJobHistory();

        // Set up provider silently for transactions (use first discovered or window.ethereum)
        setTimeout(function() {
            var raw = discoveredWallets.length > 0 ? discoveredWallets[0].provider :
                      (typeof window.ethereum !== "undefined" ? window.ethereum : null);
            if (raw) setActiveProvider(raw);
        }, 500);
    }
}

// =============================================================================
// JOB HISTORY - Persistent via localStorage
// =============================================================================

function saveJob(escrowId, jobData) {
    var jobs = JSON.parse(localStorage.getItem("alias_jobs") || "{}");
    jobs[escrowId] = jobData;
    localStorage.setItem("alias_jobs", JSON.stringify(jobs));
}

function getJobHistory() {
    return JSON.parse(localStorage.getItem("alias_jobs") || "{}");
}

function loadJobHistory() {
    var jobs = getJobHistory();
    var keys = Object.keys(jobs);
    if (keys.length > 0) {
        typeInTerminal("[JOBS] " + keys.length + " previous job(s) found", "system");
    }
}

function retryJob(escrowId) {
    var jobs = getJobHistory();
    var job = jobs[escrowId];
    if (!job) {
        typeInTerminal("[ERROR] Job " + escrowId + " not found", "warning");
        return;
    }

    typeInTerminal("[RETRY] Re-executing " + escrowId + "...", "warning");
    typeInTerminal("[WORK] " + escapeHtml(job.agent) + " is working on your job...", "warning");
    showJobLoading(job.agent);

    fetchWithTimeout(CONFIG.API_URL + "/job/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agent_name: job.agent,
            skills: job.skills || [],
            tier: job.tier || "VERIFIED",
            token_id: job.tokenId,
            job: job.job,
            escrow_id: escrowId
        })
    }).then(function(r) { return r.json(); })
    .then(function(result) {
        hideJobLoading();
        if (result.status === "completed") {
            typeInTerminal("[WORK] ✓ Job completed by " + escapeHtml(job.agent) + "!", "success");
            typeInTerminal("[RESULT] " + escapeHtml(result.result), "system");
            if (result.verification_tx) {
                typeInTerminal("[CHAIN] Verification TX: " + result.verification_tx, "success");
                job.verificationTx = result.verification_tx;
            }
            job.status = "COMPLETED";
            job.result = result.result;
            saveJob(escrowId, job);
            showJobHistory();
            showToast("Job completed by " + job.agent + "!", "success");
        } else {
            typeInTerminal("[ERROR] " + escapeHtml(result.error || "Unknown error"), "warning");
            showToast("Job retry failed: " + (result.error || "Unknown error"), "error");
        }
    }).catch(function(err) {
        hideJobLoading();
        typeInTerminal("[ERROR] Could not reach AI service: " + err.message, "warning");
        showToast("Could not reach AI service", "error");
    });
}

function showJobHistory() {
    var jobs = getJobHistory();
    var keys = Object.keys(jobs);

    // Show in the search result box
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = "var(--primary)";
    box.style.background = "rgba(0,212,255,0.05)";
    box.innerHTML = '';

    // Header with close button
    var headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:15px';

    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'color:var(--primary);font-size:1.3rem;font-weight:bold';
    titleDiv.textContent = 'JOB HISTORY (' + keys.length + ')';
    headerDiv.appendChild(titleDiv);

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:1px solid var(--text-dim);color:var(--text);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;';
    closeBtn.textContent = '✕';
    closeBtn.onclick = function() { box.style.display = 'none'; box.innerHTML = ''; };
    headerDiv.appendChild(closeBtn);
    box.appendChild(headerDiv);

    if (keys.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'color:var(--text-dim);padding:20px;text-align:center';
        emptyDiv.textContent = 'No jobs yet. Hire an agent to get started!';
        box.appendChild(emptyDiv);
        return;
    }

    keys.reverse().forEach(function(id) {
        var j = jobs[id];
        var isCompleted = j.status === "COMPLETED";

        // Collapsed row (always visible)
        var jobRow = document.createElement('div');
        jobRow.style.cssText = 'padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;border-left:3px solid ' + (isCompleted ? 'var(--success)' : 'var(--warning)') + ';cursor:pointer;transition:background 0.2s';
        jobRow.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.06)'; };
        jobRow.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.03)'; };

        var rowContent = document.createElement('div');
        rowContent.style.cssText = 'display:flex;justify-content:space-between;align-items:center';

        var leftSide = document.createElement('div');
        var statusIcon = document.createElement('span');
        statusIcon.style.cssText = 'color:' + (isCompleted ? 'var(--success)' : 'var(--warning)') + ';margin-right:8px';
        statusIcon.textContent = isCompleted ? '✓' : '⏳';
        leftSide.appendChild(statusIcon);
        var agentSpan = document.createElement('span');
        agentSpan.style.cssText = 'font-weight:bold;margin-right:8px';
        agentSpan.textContent = escapeHtml(j.agent);
        leftSide.appendChild(agentSpan);
        var jobSpan = document.createElement('span');
        jobSpan.style.cssText = 'color:var(--text-dim)';
        jobSpan.textContent = escapeHtml((j.job || '').slice(0, 40)) + ((j.job || '').length > 40 ? '...' : '');
        leftSide.appendChild(jobSpan);
        rowContent.appendChild(leftSide);

        var rightSide = document.createElement('div');
        rightSide.style.cssText = 'display:flex;align-items:center;gap:10px';
        if (j.budget) {
            var budgetSpan = document.createElement('span');
            budgetSpan.style.cssText = 'color:var(--text-dim);font-size:0.85em';
            budgetSpan.textContent = j.budget + ' ETH';
            rightSide.appendChild(budgetSpan);
        }
        var arrow = document.createElement('span');
        arrow.style.cssText = 'color:var(--text-dim);font-size:0.8em;transition:transform 0.2s';
        arrow.textContent = '▶';
        rightSide.appendChild(arrow);
        rowContent.appendChild(rightSide);

        jobRow.appendChild(rowContent);

        // Expanded details (hidden by default)
        var details = document.createElement('div');
        details.style.cssText = 'display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1)';

        // Job ID
        var idDiv = document.createElement('div');
        idDiv.style.cssText = 'color:var(--text-dim);font-size:0.85em;font-family:monospace;margin-bottom:6px';
        idDiv.textContent = id;
        details.appendChild(idDiv);

        // Full job description
        var jobDiv = document.createElement('div');
        jobDiv.style.cssText = 'margin-bottom:8px';
        jobDiv.textContent = 'Job: ' + escapeHtml(j.job || '');
        details.appendChild(jobDiv);

        // Budget + TX
        if (j.txHash) {
            var txDiv = document.createElement('div');
            txDiv.style.cssText = 'margin-bottom:8px;font-size:0.9em';
            var txLink = document.createElement('a');
            txLink.href = 'https://basescan.org/tx/' + j.txHash;
            txLink.target = '_blank';
            txLink.style.cssText = 'color:var(--primary);text-decoration:none';
            txLink.textContent = 'View Transaction on BaseScan ↗';
            txDiv.appendChild(txLink);
            details.appendChild(txDiv);
        }

        // Verification TX link
        if (j.verificationTx) {
            var verifyTxDiv = document.createElement('div');
            verifyTxDiv.style.cssText = 'margin-bottom:8px;font-size:0.9em';
            var verifyLabel = document.createElement('span');
            verifyLabel.style.cssText = 'color:var(--success);font-weight:bold;margin-right:5px';
            verifyLabel.textContent = 'On-chain verification:';
            verifyTxDiv.appendChild(verifyLabel);
            var verifyLink = document.createElement('a');
            verifyLink.href = 'https://basescan.org/tx/' + j.verificationTx;
            verifyLink.target = '_blank';
            verifyLink.rel = 'noopener noreferrer';
            verifyLink.style.cssText = 'color:var(--primary);text-decoration:none';
            verifyLink.textContent = j.verificationTx.slice(0, 18) + '...';
            verifyTxDiv.appendChild(verifyLink);
            details.appendChild(verifyTxDiv);
        }

        // Result
        if (j.result) {
            var resultLabel = document.createElement('div');
            resultLabel.style.cssText = 'color:var(--success);font-weight:bold;margin-bottom:4px;font-size:0.9em';
            resultLabel.textContent = 'Agent Deliverable:';
            details.appendChild(resultLabel);

            var resultDiv = document.createElement('div');
            resultDiv.style.cssText = 'background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;font-size:0.9em;line-height:1.5;max-height:250px;overflow-y:auto;white-space:pre-wrap';
            resultDiv.textContent = j.result;
            details.appendChild(resultDiv);
        }

        // Retry button for pending jobs
        if (!isCompleted) {
            var retryBtn = document.createElement('button');
            retryBtn.style.cssText = 'background:var(--warning);color:#000;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:0.85em;margin-top:8px';
            retryBtn.textContent = 'Retry Job';
            retryBtn.onclick = function(e) { e.stopPropagation(); retryJob(id); };
            details.appendChild(retryBtn);
        }

        jobRow.appendChild(details);

        // Toggle expand/collapse on click
        jobRow.onclick = function() {
            var isOpen = details.style.display !== 'none';
            details.style.display = isOpen ? 'none' : 'block';
            arrow.textContent = isOpen ? '▶' : '▼';
            arrow.style.color = isOpen ? 'var(--text-dim)' : 'var(--primary)';
        };

        box.appendChild(jobRow);
    });
}

// Toggle My Agents filter
function toggleMyAgents() {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }
    
    showingMyAgents = !showingMyAgents;
    var btn = document.getElementById("myAgentsBtn");
    
    if (showingMyAgents) {
        btn.style.background = "var(--secondary)";
        btn.style.color = "#000";
        btn.textContent = "All Agents";
        filterMyAgents();
        typeInTerminal("[FILTER] Showing your agents...", "system");
    } else {
        btn.style.background = "transparent";
        btn.style.color = "var(--secondary)";
        btn.textContent = "My Agents";
        populateAgents();
    }
}

function filterMyAgents() {
    var list = document.getElementById("agentList");
    list.innerHTML = '';
    
    var myAgents = agents.filter(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet;
    });
    
    typeInTerminal("[FILTER] Found " + myAgents.length + " agent(s) created by you", myAgents.length > 0 ? "success" : "warning");
    
    if (myAgents.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align:center;padding:30px;color:var(--text-dim);';
        emptyDiv.textContent = "You don't own any agents yet.";
        emptyDiv.appendChild(document.createElement('br'));
        emptyDiv.appendChild(document.createElement('br'));
        var mintBtn = document.createElement('button');
        mintBtn.style.cssText = 'background:var(--secondary);color:#000;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;';
        mintBtn.textContent = 'Mint Your First Soul';
        mintBtn.onclick = function() { openMintModal(); };
        emptyDiv.appendChild(mintBtn);
        list.appendChild(emptyDiv);
        return;
    }
    
    myAgents.forEach(function(a) {
        var item = document.createElement('div');
        item.className = 'agent-item';
        item.style.border = '1px solid var(--secondary)';
        item.onclick = function() { selectAgent(a.name); };
        
        var info = document.createElement('div');
        info.className = 'agent-info';
        
        var name = document.createElement('div');
        name.className = 'agent-name';
        name.textContent = '';
        name.appendChild(document.createTextNode(a.name + ' '));
        var badge = document.createElement('span');
        badge.style.cssText = 'color:var(--secondary);font-size:0.8em;';
        badge.textContent = 'YOURS';
        name.appendChild(badge);
        info.appendChild(name);
        
        var addr = document.createElement('div');
        addr.className = 'agent-address';
        addr.textContent = a.address;
        info.appendChild(addr);
        
        var skills = document.createElement('div');
        skills.className = 'agent-skills';
        a.skills.slice(0, 3).forEach(function(s) {
            var tag = document.createElement('span');
            tag.className = 'skill-tag small';
            tag.textContent = s;
            skills.appendChild(tag);
        });
        info.appendChild(skills);
        
        item.appendChild(info);
        
        var rep = document.createElement('div');
        rep.className = 'agent-rep';
        var repScore = document.createElement('div');
        repScore.className = 'rep-score';
        repScore.textContent = a.rep;
        rep.appendChild(repScore);
        var repTier = document.createElement('div');
        repTier.className = 'rep-tier tier-' + a.tier.toLowerCase();
        repTier.textContent = a.tier;
        rep.appendChild(repTier);
        
        item.appendChild(rep);
        list.appendChild(item);
    });
}

// Mint Modal Functions
function openMintModal() {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }
    document.getElementById("mintModal").style.display = "flex";
    document.getElementById("mintStatus").textContent = "";
}

function closeMintModal() {
    document.getElementById("mintModal").style.display = "none";
}

async function mintSoul() {
    var name = document.getElementById("mintName").value.trim();
    var agentAddr = document.getElementById("mintAddress").value.trim();
    var metadata = document.getElementById("mintMetadata").value.trim();
    var skills = document.getElementById("mintSkills").value.trim();
    var status = document.getElementById("mintStatus");
    
    if (!name || !agentAddr || !metadata || !skills) {
        status.textContent = "Please fill in all fields!";
        status.style.color = "var(--warning)";
        return;
    }
    
    if (!agentAddr.match(/^0x[a-fA-F0-9]{40}$/)) {
        status.textContent = "Invalid agent address!";
        status.style.color = "var(--warning)";
        return;
    }
    
    status.textContent = "Preparing transaction...";
    status.style.color = "var(--primary)";

    try {
        // Pin metadata to IPFS via Pinata if not already an IPFS URI
        if (!metadata.startsWith("ipfs://")) {
            status.textContent = "Pinning metadata to IPFS...";
            try {
                var pinRes = await fetchWithTimeout(CONFIG.API_URL + "/pin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name, skills: skills, creator: connectedWallet })
                });
                var pinData = await pinRes.json();
                if (pinData.uri) {
                    metadata = pinData.uri;
                    document.getElementById("mintMetadata").value = metadata;
                    typeInTerminal("[IPFS] Metadata pinned: " + pinData.cid, "success");
                }
            } catch (pinErr) {
                console.log("IPFS pinning skipped:", pinErr);
                typeInTerminal("[IPFS] Pinning skipped, using raw metadata", "warning");
            }
        }

        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, signer);

        status.textContent = "Please confirm in MetaMask...";

        var tx = await contract.mintSoul(agentAddr, name, metadata, skills);
        
        status.textContent = "Transaction submitted! Waiting for confirmation...";
        typeInTerminal("[MINT] TX submitted: " + tx.hash.slice(0, 10) + "...", "warning");
        
        var receipt = await tx.wait();
        
        status.textContent = "Soul minted successfully!";
        status.style.color = "var(--success)";
        typeInTerminal("[MINT] Success! New soul: " + name, "success");
        
        // Refresh agents list
        setTimeout(function() {
            closeMintModal();
            loadAgentsFromChain();
        }, 2000);
        
    } catch (error) {
        console.error("Mint error:", error);
        status.textContent = "Error: " + (error.reason || error.message || "Transaction failed");
        status.style.color = "var(--warning)";
        typeInTerminal("[ERROR] Mint failed: " + (error.reason || "Unknown error"), "warning");
    }
}

// Verification signing (off-chain)
async function signVerification(agent) {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.tokenId) {
        showToast("No agent selected!", "warning");
        return;
    }
    
    // Stake-gated: require Silver tier to verify
    var myAgent = agents.find(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet.toLowerCase();
    });
    if (myAgent) {
        try {
            var stakeProvider = getStaticProvider();
            var stakeCheck = new ethers.Contract(CONFIG.STAKE_REGISTRY, STAKE_REGISTRY_ABI, stakeProvider);
            var eligible = await stakeCheck.isEligible(myAgent.tokenId, 1); // 1 = Bronze
            if (!eligible) {
                typeInTerminal("[STAKE] Bronze tier (0.001 ETH stake) required to verify agents", "warning");
                showToast("Stake at least 0.001 ETH to unlock verification. Use the Stake button.", "warning");
                return;
            }
        } catch (e) {
            console.log("Stake check skipped:", e.message);
        }
    }

    openVerifyModal(agent);
}

// ---- Verify Modal State & Helpers ----
var verifyModalAgent = null;

function openVerifyModal(agent) {
    verifyModalAgent = agent;
    document.getElementById("verifyAgentName").textContent = agent.name + " (Token #" + agent.tokenId + ")";
    document.getElementById("verifyMessage").value = "Verified as trusted AI agent";
    document.getElementById("verifyModal").style.display = "flex";
}

function closeVerifyModal() {
    document.getElementById("verifyModal").style.display = "none";
    verifyModalAgent = null;
}

async function submitVerify() {
    var agent = verifyModalAgent;
    if (!agent) return;
    var message = document.getElementById("verifyMessage").value.trim();
    if (!message) { showToast("Please enter a verification message", "warning"); return; }

    closeVerifyModal();

    try {
        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();
        var contract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, signer);

        typeInTerminal("[VERIFY] Recording on-chain verification...", "warning");
        typeInTerminal("[TARGET] " + agent.name + " (Token #" + agent.tokenId + ")", "system");

        var tx = await contract.verify(agent.tokenId, message);

        typeInTerminal("[TX] " + tx.hash.slice(0, 15) + "... submitted", "warning");

        var receipt = await tx.wait();

        typeInTerminal("[CHAIN] ✓ Verification recorded on-chain!", "success");
        typeInTerminal("[TX] " + tx.hash, "system");

        showToast("Verification recorded on-chain for " + agent.name + "!", "success", 7000);

    } catch (error) {
        console.error("Verification error:", error);
        if (error.message && error.message.includes("Already verified")) {
            typeInTerminal("[INFO] You have already verified this agent", "warning");
            showToast("You have already verified this agent!", "warning");
        } else {
            typeInTerminal("[ERROR] Verification failed: " + (error.reason || error.message || "Unknown"), "warning");
            showToast("Verification failed: " + (error.reason || error.message || "Unknown"), "error");
        }
    }
}

// Initialize new event listeners
document.addEventListener("DOMContentLoaded", function() {
    // New buttons
    document.getElementById("mintBtn").addEventListener("click", openMintModal);
    document.getElementById("myAgentsBtn").addEventListener("click", toggleMyAgents);
    document.getElementById("mintSubmitBtn").addEventListener("click", mintSoul);
    document.getElementById("mintCancelBtn").addEventListener("click", closeMintModal);
    
    // Stake button
    document.getElementById("stakeBtn").addEventListener("click", stakeForAgent);

    // Close modals on outside click
    document.getElementById("mintModal").addEventListener("click", function(e) {
        if (e.target.id === "mintModal") closeMintModal();
    });
    document.getElementById("hireModal").addEventListener("click", function(e) {
        if (e.target.id === "hireModal") closeHireModal();
    });
    document.getElementById("tipModal").addEventListener("click", function(e) {
        if (e.target.id === "tipModal") closeTipModal();
    });
    document.getElementById("verifyModal").addEventListener("click", function(e) {
        if (e.target.id === "verifyModal") closeVerifyModal();
    });
    document.getElementById("stakeModal").addEventListener("click", function(e) {
        if (e.target.id === "stakeModal") closeStakeModal();
    });
});

// =============================================================================
// PAYMENT & ESCROW FUNCTIONS (BANKR INTEGRATION)
// =============================================================================

var activeEscrows = {};

// ---- Tip Modal State & Helpers ----
var tipModalAgent = null;

function openTipModal(agent) {
    tipModalAgent = agent;
    document.getElementById("tipAgentName").textContent = agent.name;
    document.getElementById("tipAmount").value = "0.001";
    document.getElementById("tipModal").style.display = "flex";
    // Clear active states
    document.querySelectorAll("#tipPresets button").forEach(function(b) { b.classList.remove("active"); });
}

function closeTipModal() {
    document.getElementById("tipModal").style.display = "none";
    tipModalAgent = null;
}

function setTipAmount(val) {
    document.getElementById("tipAmount").value = val;
    document.querySelectorAll("#tipPresets button").forEach(function(b) {
        b.classList.toggle("active", b.textContent.trim() === val);
    });
}

function submitTip() {
    var amount = document.getElementById("tipAmount").value.trim();
    if (!amount || isNaN(parseFloat(amount))) { showToast("Enter a valid amount", "warning"); return; }
    closeTipModal();
    processTip(tipModalAgent, amount);
}

async function tipAgent(agent, amount) {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.tokenId) {
        showToast("No agent selected!", "warning");
        return;
    }

    // Route tip to agent's on-chain address
    var recipient = agent.fullAddress;
    if (!recipient) {
        showToast("No payment address for this agent!", "warning");
        return;
    }

    if (amount) {
        processTip(agent, amount);
    } else {
        openTipModal(agent);
    }
}

async function processTip(agent, tipAmount) {
    if (!tipAmount || isNaN(parseFloat(tipAmount))) return;

    var recipient = agent.fullAddress;

    try {
        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();

        typeInTerminal("[BANKR] Preparing tip to operator wallet...", "warning");

        var tx = await signer.sendTransaction({
            to: recipient,
            value: ethers.parseEther(tipAmount)
        });

        typeInTerminal("[BANKR] TX submitted: " + tx.hash.slice(0, 15) + "...", "warning");

        await tx.wait();

        typeInTerminal("[BANKR] \u2713 Sent " + tipAmount + " ETH to " + agent.name + " operator", "success");
        typeInTerminal("[TX] " + tx.hash, "system");

        showToast("Tipped " + tipAmount + " ETH to " + agent.name + "!", "success", 7000);

    } catch (error) {
        console.error("Tip error:", error);
        typeInTerminal("[ERROR] Payment failed: " + (error.reason || error.message), "warning");
    }
}

// ---- Hire Modal State & Helpers ----
var hireModalAgent = null;
var hireModalRate = 0;
var hireModalUseEscrow = true;

function openHireModal(agent) {
    hireModalAgent = agent;
    var rate = getAgentRate(agent);
    hireModalRate = rate;
    hireModalUseEscrow = true;
    var skills = agent.skills || [];

    document.getElementById("hireModalTitle").textContent = "Hire " + agent.name;
    document.getElementById("hireAgentName").textContent = agent.name;
    document.getElementById("hireAgentTier").textContent = agent.tier;
    document.getElementById("hireSkillsList").textContent = skills.join(" \u2022 ") || "General";
    document.getElementById("hireRate").textContent = rate + " ETH/hr";
    document.getElementById("hireSuggested1h").textContent = rate + " ETH";
    document.getElementById("hireSuggested4h").textContent = (rate * 4).toFixed(6) + " ETH";
    document.getElementById("hireBudget").value = rate;
    document.getElementById("hireJobDesc").value = "";
    document.getElementById("hireSkillWarning").style.display = "none";
    selectEscrowOption(true);

    document.getElementById("hireModal").style.display = "flex";
}

function closeHireModal() {
    document.getElementById("hireModal").style.display = "none";
    hireModalAgent = null;
}

function selectEscrowOption(useEscrow) {
    hireModalUseEscrow = useEscrow;
    var yes = document.getElementById("escrowOptionYes");
    var no = document.getElementById("escrowOptionNo");
    if (useEscrow) { yes.classList.add("selected"); no.classList.remove("selected"); }
    else { no.classList.add("selected"); yes.classList.remove("selected"); }
}

function setHireBudget(preset) {
    var input = document.getElementById("hireBudget");
    var btns = document.querySelectorAll("#hireBudgetPresets button");
    btns.forEach(function(b) { b.classList.remove("active"); });
    if (preset === "1h") { input.value = hireModalRate; btns[0].classList.add("active"); }
    else if (preset === "4h") { input.value = (hireModalRate * 4).toFixed(6); btns[1].classList.add("active"); }
    else { input.value = ""; input.focus(); btns[2].classList.add("active"); }
}

function submitHire() {
    var agent = hireModalAgent;
    if (!agent) return;

    var jobDesc = document.getElementById("hireJobDesc").value.trim();
    if (!jobDesc) { showToast("Please describe the job", "warning"); return; }

    var budget = document.getElementById("hireBudget").value.trim();
    if (!budget || isNaN(parseFloat(budget))) { showToast("Enter a valid budget", "warning"); return; }

    // Check skill match
    var skills = agent.skills || [];
    var jobLower = jobDesc.toLowerCase();
    var skillMatch = skills.some(function(s) {
        var keywords = getSkillKeywords(s);
        return keywords.some(function(k) { return jobLower.indexOf(k) !== -1; });
    });
    var warning = document.getElementById("hireSkillWarning");
    if (!skillMatch && skills.length > 0) { warning.style.display = "block"; }

    var useEscrow = hireModalUseEscrow;
    closeHireModal();
    processHire(agent, jobDesc, budget, useEscrow);
}

async function hireAgent(agent) {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.fullAddress) {
        showToast("No agent selected!", "warning");
        return;
    }

    openHireModal(agent);
    return; // Flow continues in submitHire() -> processHire()
}

async function processHire(agent, jobDesc, budget, useEscrow) {
    var rate = getAgentRate(agent);
    var skills = agent.skills || [];
    var skillList = skills.join(", ") || "general";

    try {
        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();

        // Calculate fee (5%)
        var totalBudget = parseFloat(budget);
        var fee = totalBudget * 0.05;
        var agentPayment = totalBudget - fee;

        typeInTerminal("[HIRE] Job: " + escapeHtml(jobDesc.slice(0, 50)) + "...", "system");
        typeInTerminal("[HIRE] Agent: " + escapeHtml(agent.name) + " | Skills: " + escapeHtml(skillList), "system");
        typeInTerminal("[ESCROW] Budget: " + budget + " ETH (Rate: " + rate + " ETH/hr)", "warning");
        typeInTerminal("[ESCROW] Platform fee (5%): " + fee.toFixed(6) + " ETH → gas + AI costs", "warning");
        typeInTerminal("[ESCROW] Agent payment: " + agentPayment.toFixed(6) + " ETH", "warning");

        var onChainEscrowId = null;
        if (useEscrow) {
            // Find caller's tokenId
            var myAgent = agents.find(function(a) {
                return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet.toLowerCase();
            });
            if (!myAgent) {
                typeInTerminal("[ESCROW] You need an ALIAS soul to use on-chain escrow. Falling back to direct payment.", "warning");
                useEscrow = false;
            } else {
                typeInTerminal("[ESCROW] Creating on-chain escrow via EscrowRegistry...", "warning");
                var escrowContract = new ethers.Contract(CONFIG.ESCROW_REGISTRY, ESCROW_REGISTRY_ABI, signer);
                var deadline = Math.floor(Date.now() / 1000) + 86400 * 3; // 3 days
                var escrowTx = await escrowContract.createEscrow(
                    myAgent.tokenId,
                    agent.tokenId,
                    jobDesc.slice(0, 1000),
                    deadline,
                    { value: ethers.parseEther(totalBudget.toFixed(18)) }
                );
                typeInTerminal("[ESCROW] TX submitted: " + escrowTx.hash.slice(0, 18) + "...", "warning");
                var escrowReceipt = await escrowTx.wait();

                // Parse escrow ID from event
                try {
                    var escrowIface = new ethers.Interface(ESCROW_REGISTRY_ABI);
                    for (var log of escrowReceipt.logs) {
                        try {
                            var parsed = escrowIface.parseLog({ topics: log.topics, data: log.data });
                            if (parsed && parsed.name === "EscrowCreated") {
                                onChainEscrowId = Number(parsed.args[0]);
                                break;
                            }
                        } catch (e) {}
                    }
                } catch (e) {}

                typeInTerminal("[ESCROW] ✓ On-chain escrow created! ID: " + (onChainEscrowId || "pending"), "success");
                typeInTerminal("[TX] https://basescan.org/tx/" + escrowTx.hash, "system");
            }
        }

        var escrowId = useEscrow ? "ESCROW-" + (onChainEscrowId || Date.now()) : "ESC-" + Date.now();
        var txHash = "";

        if (!useEscrow) {
            // Direct payment flow (original)
            var hireRecipient = agent.fullAddress;
            var tx = await signer.sendTransaction({
                to: hireRecipient,
                value: ethers.parseEther(agentPayment.toFixed(18))
            });
            txHash = tx.hash;

            typeInTerminal("[ESCROW] Agent TX submitted: " + tx.hash.slice(0, 15) + "...", "warning");
            await tx.wait();

            // Send platform fee (5%) to cover gas + Venice AI costs
            typeInTerminal("[ESCROW] Sending platform fee...", "warning");
            try {
                var feeTx = await signer.sendTransaction({
                    to: CONFIG.PLATFORM_WALLET,
                    value: ethers.parseEther(fee.toFixed(18))
                });
                await feeTx.wait();
                typeInTerminal("[ESCROW] ✓ Platform fee sent (gas + AI)", "success");
            } catch (feeErr) {
                typeInTerminal("[ESCROW] Platform fee skipped: " + (feeErr.reason || "insufficient funds"), "warning");
            }
        }

        var jobData = {
            agent: agent.name,
            agentAddress: agent.fullAddress,
            skills: agent.skills,
            tier: agent.tier,
            tokenId: agent.tokenId,
            job: jobDesc,
            budget: budget,
            rate: rate,
            status: useEscrow ? "ESCROWED" : "PAID",
            txHash: txHash,
            onChainEscrow: useEscrow,
            onChainEscrowId: onChainEscrowId,
            timestamp: new Date().toISOString()
        };
        activeEscrows[escrowId] = jobData;
        saveJob(escrowId, jobData);

        typeInTerminal("[ESCROW] ✓ Job funded! ID: " + escrowId, "success");
        typeInTerminal("[HIRE] " + escapeHtml(agent.name) + " hired successfully!", "success");

        // Execute job via Venice AI with loading spinner
        showJobLoading(agent.name);
        typeInTerminal("[WORK] " + escapeHtml(agent.name) + " is working on your job...", "warning");
        try {
            var jobResponse = await fetchWithTimeout(CONFIG.API_URL + "/job/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_name: agent.name,
                    skills: agent.skills,
                    tier: agent.tier,
                    token_id: agent.tokenId,
                    job: jobDesc,
                    escrow_id: escrowId
                })
            });
            var jobResult = await jobResponse.json();
            hideJobLoading();
            if (jobResult.status === "completed") {
                typeInTerminal("[WORK] ✓ Job completed by " + escapeHtml(agent.name) + "!", "success");
                typeInTerminal("[RESULT] " + escapeHtml(jobResult.result), "system");
                if (jobResult.verification_tx) {
                    typeInTerminal("[CHAIN] Verification TX: " + jobResult.verification_tx, "success");
                    typeInTerminal("[LINK] https://basescan.org/tx/" + jobResult.verification_tx, "system");
                    jobData.verificationTx = jobResult.verification_tx;
                }
                jobData.status = "COMPLETED";
                jobData.result = jobResult.result;
                saveJob(escrowId, jobData);
                showToast("Job completed by " + agent.name + "! Check terminal for results.", "success", 8000);

                // If escrow: prompt to approve and release
                if (useEscrow && onChainEscrowId) {
                    var doApprove = confirm("Job completed! Approve and release escrow payment to " + agent.name + "?");
                    if (doApprove) {
                        try {
                            var escrowWrite = new ethers.Contract(CONFIG.ESCROW_REGISTRY, ESCROW_REGISTRY_ABI, signer);
                            typeInTerminal("[ESCROW] Approving and releasing payment...", "warning");
                            var approveTx = await escrowWrite.approveAndRelease(onChainEscrowId);
                            await approveTx.wait();
                            typeInTerminal("[ESCROW] ✓ Payment released to " + escapeHtml(agent.name) + "!", "success");
                            typeInTerminal("[TX] https://basescan.org/tx/" + approveTx.hash, "system");
                            jobData.status = "RELEASED";
                            saveJob(escrowId, jobData);
                        } catch (approveErr) {
                            typeInTerminal("[ESCROW] Release failed: " + (approveErr.reason || approveErr.message), "warning");
                            typeInTerminal("[INFO] You can approve later from the Jobs panel.", "system");
                        }
                    } else {
                        typeInTerminal("[INFO] Escrow held. You can approve or dispute later from the Jobs panel.", "system");
                    }
                }
            } else {
                typeInTerminal("[WORK] Job error: " + escapeHtml(jobResult.error || "unknown"), "warning");
                typeInTerminal("[INFO] Job saved. Use Jobs button to retry later.", "system");
                showToast("Job error - saved for retry. Use Jobs button.", "warning");
            }
        } catch (aiError) {
            hideJobLoading();
            typeInTerminal("[WORK] AI service unavailable: " + (aiError.message || "timeout"), "warning");
            typeInTerminal("[INFO] Job saved. Use Jobs button to retry later.", "system");
            showToast("AI service unavailable — job saved for retry.", "error");
        }

    } catch (error) {
        console.error("Hire error:", error);
        typeInTerminal("[ERROR] Hire failed: " + (error.reason || error.message), "warning");
    }
}

// =============================================================================
// STAKING FUNCTIONS
// =============================================================================

async function stakeForAgent() {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    // Find the caller's agent by matching wallet
    var myAgent = agents.find(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet.toLowerCase();
    });

    if (!myAgent) {
        showToast("You need an ALIAS soul to stake. Mint one first!", "warning");
        return;
    }

    try {
        var provider = getStaticProvider();
        var stakeContract = new ethers.Contract(CONFIG.STAKE_REGISTRY, STAKE_REGISTRY_ABI, provider);
        var info = await stakeContract.getStakeInfo(myAgent.tokenId);
        var currentStake = parseFloat(ethers.formatEther(info[0]));
        var currentTier = STAKE_TIERS[Number(info[3])] || "None";

        typeInTerminal("[STAKE] " + myAgent.name + " (Token #" + myAgent.tokenId + ")", "system");
        typeInTerminal("[STAKE] Current: " + currentStake.toFixed(6) + " ETH | Tier: " + currentTier, "system");

        openStakeModal(myAgent, currentStake, currentTier);
    } catch (error) {
        console.error("Stake error:", error);
        typeInTerminal("[ERROR] Staking failed: " + (error.reason || error.message), "warning");
        showToast("Staking failed: " + (error.reason || error.message), "error");
    }
}

// ---- Stake Modal State & Helpers ----
var stakeModalAgent = null;

function openStakeModal(agent, currentStake, currentTier) {
    stakeModalAgent = agent;
    document.getElementById("stakeAgentName").textContent = agent.name + " (Token #" + agent.tokenId + ")";
    document.getElementById("stakeCurrentAmount").textContent = currentStake.toFixed(6) + " ETH";
    document.getElementById("stakeCurrentTier").textContent = currentTier;
    document.getElementById("stakeAmount").value = "";
    document.getElementById("stakeModal").style.display = "flex";
}

function closeStakeModal() {
    document.getElementById("stakeModal").style.display = "none";
    stakeModalAgent = null;
}

function setStakeAmount(val) {
    document.getElementById("stakeAmount").value = val;
    var btns = document.querySelectorAll("#stakePresets button");
    btns.forEach(function(b) { b.classList.remove("active"); });
}

async function submitStake() {
    var agent = stakeModalAgent;
    if (!agent) return;
    var amount = document.getElementById("stakeAmount").value.trim();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        showToast("Please enter a valid amount", "warning");
        return;
    }

    closeStakeModal();

    try {
        var walletProvider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await walletProvider.getSigner();
        var stakeWrite = new ethers.Contract(CONFIG.STAKE_REGISTRY, STAKE_REGISTRY_ABI, signer);

        typeInTerminal("[STAKE] Staking " + amount + " ETH for " + agent.name + "...", "warning");
        var tx = await stakeWrite.stake(agent.tokenId, { value: ethers.parseEther(amount) });
        typeInTerminal("[STAKE] TX submitted: " + tx.hash.slice(0, 18) + "...", "warning");

        await tx.wait();

        var provider = getStaticProvider();
        var stakeContract = new ethers.Contract(CONFIG.STAKE_REGISTRY, STAKE_REGISTRY_ABI, provider);
        var newInfo = await stakeContract.getStakeInfo(agent.tokenId);
        var newTier = STAKE_TIERS[Number(newInfo[3])] || "None";
        typeInTerminal("[STAKE] ✓ Staked! New balance: " + parseFloat(ethers.formatEther(newInfo[0])).toFixed(6) + " ETH | Tier: " + newTier, "success");
        typeInTerminal("[TX] https://basescan.org/tx/" + tx.hash, "system");
        showToast("Staked " + amount + " ETH! Tier: " + newTier, "success");

        loadStakeTiers();
    } catch (error) {
        console.error("Stake error:", error);
        typeInTerminal("[ERROR] Staking failed: " + (error.reason || error.message), "warning");
        showToast("Staking failed: " + (error.reason || error.message), "error");
    }
}

function getSuggestedJobs(skills) {
    var suggestions = {
        "data-analysis": "market analysis, trend reports",
        "forecasting": "price predictions, growth models",
        "reporting": "weekly reports, dashboards",
        "code-audit": "smart contract audit, security review",
        "vulnerability-detection": "penetration testing, bug hunting",
        "security-review": "codebase security assessment",
        "writing": "blog posts, documentation",
        "marketing": "social media campaigns, copywriting",
        "documentation": "API docs, technical guides",
        "defi-analysis": "protocol analysis, TVL tracking",
        "yield-farming": "yield optimization strategies",
        "protocol-review": "DeFi protocol due diligence",
        "research": "deep research, competitive analysis",
        "due-diligence": "project evaluation, risk assessment",
        "report-writing": "research papers, investment memos",
        "trading": "trade execution, market analysis",
        "market-analysis": "market trends, sentiment analysis",
        "portfolio-management": "portfolio rebalancing, allocation",
        "contract-review": "legal contract review",
        "compliance": "regulatory compliance checks",
        "legal-research": "legal precedent research",
        "coding": "feature development, bug fixes",
        "debugging": "issue diagnosis, troubleshooting",
        "code-review": "PR review, code quality checks",
        "general": "general tasks, coordination",
        "coordination": "team coordination, planning",
        "collaboration": "multi-agent tasks",
        "autonomous": "automated workflows",
        "verification": "identity verification",
        "risk-assessment": "risk scoring, trust evaluation"
    };
    var result = [];
    skills.forEach(function(s) {
        if (suggestions[s]) result.push(suggestions[s]);
    });
    return result.slice(0, 3).join("; ") || "general tasks";
}

function getSkillKeywords(skill) {
    var keywords = {
        "data-analysis": ["data", "analysis", "analytics", "metrics", "statistics"],
        "forecasting": ["forecast", "predict", "projection", "trend"],
        "reporting": ["report", "dashboard", "summary", "weekly", "monthly"],
        "code-audit": ["audit", "code", "smart contract", "solidity"],
        "vulnerability-detection": ["vulnerability", "bug", "exploit", "penetration"],
        "security-review": ["security", "review", "assessment", "risk"],
        "writing": ["write", "blog", "article", "content", "copy"],
        "marketing": ["market", "campaign", "social", "brand", "promote"],
        "documentation": ["document", "docs", "api", "guide", "readme"],
        "defi-analysis": ["defi", "protocol", "tvl", "liquidity", "pool"],
        "yield-farming": ["yield", "farm", "apy", "staking", "reward"],
        "protocol-review": ["protocol", "review", "evaluate", "assess"],
        "research": ["research", "investigate", "study", "explore", "deep dive"],
        "due-diligence": ["due diligence", "evaluate", "vet", "background"],
        "report-writing": ["report", "paper", "memo", "writeup"],
        "trading": ["trade", "swap", "buy", "sell", "execute"],
        "market-analysis": ["market", "trend", "sentiment", "price"],
        "portfolio-management": ["portfolio", "rebalance", "allocat", "diversif"],
        "contract-review": ["contract", "legal", "terms", "agreement"],
        "compliance": ["compliance", "regulat", "kyc", "aml"],
        "legal-research": ["legal", "law", "precedent", "jurisdiction"],
        "coding": ["code", "develop", "build", "implement", "feature"],
        "debugging": ["debug", "fix", "bug", "issue", "error"],
        "code-review": ["review", "pr", "pull request", "quality"],
        "general": ["help", "assist", "task", "work"],
        "coordination": ["coordinate", "plan", "organize", "manage"],
        "collaboration": ["collaborate", "together", "team", "multi"],
        "autonomous": ["automate", "workflow", "schedule", "monitor"],
        "verification": ["verify", "identity", "check", "validate"],
        "risk-assessment": ["risk", "assess", "score", "trust", "evaluate"]
    };
    return keywords[skill] || [skill];
}

// Add payment buttons to search result when agent is selected
function addPaymentButtons(box, agent) {
    var payDiv = document.createElement("div");
    payDiv.style.cssText = "margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;";
    
    var tipBtn = document.createElement("button");
    tipBtn.style.cssText = "background:var(--success);color:#000;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9em;";
    tipBtn.textContent = "💰 Tip Agent";
    tipBtn.onclick = function() { tipAgent(agent); };
    payDiv.appendChild(tipBtn);
    
    var hireBtn = document.createElement("button");
    hireBtn.style.cssText = "background:var(--primary);color:#000;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9em;";
    hireBtn.textContent = "📋 Hire Agent";
    hireBtn.onclick = function() { hireAgent(agent); };
    payDiv.appendChild(hireBtn);
    
    box.appendChild(payDiv);
}

// =============================================================================
// AGENT ACTIVITY (ON-CHAIN ACTIONS)
// =============================================================================

async function fetchAgentActivity(agent) {
    if (!agent || !agent.tokenId) return null;
    
    try {
        var provider = getStaticProvider();
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
        
        var actionCount = await contract.actionCount(agent.tokenId);
        return Number(actionCount);
    } catch (error) {
        console.log("Failed to fetch activity:", error);
        return null;
    }
}

async function showAgentActivity(agent) {
    if (!agent) return;

    typeInTerminal("[ACTIVITY] Fetching on-chain data for " + agent.name + "...", "system");

    var actionCount = await fetchAgentActivity(agent);

    // Fetch verification count from new registry
    var verifyCount = 0;
    try {
        var provider = getStaticProvider();
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        verifyCount = Number(await verifyContract.getVerificationCount(agent.tokenId));
    } catch (e) {
        console.log("Could not fetch verifications:", e);
    }

    typeInTerminal("[CHAIN] Token #" + agent.tokenId, "success");
    typeInTerminal("[CHAIN] Reputation: " + agent.rep + " (" + agent.tier + ")", "success");
    typeInTerminal("[REP] Breakdown: actions(" + (agent.actions || 0) + "x20) + verifications(" + (agent.verifications || 0) + "x15) + jobs(" + (agent.jobCount || 0) + "x25) + age", "system");
    typeInTerminal("[CHAIN] On-chain verifications: " + verifyCount, verifyCount > 0 ? "success" : "system");
    typeInTerminal("[CHAIN] Creator: " + agent.fullAddress.slice(0,10) + "...", "system");

    if (actionCount !== null && actionCount > 0) {
        typeInTerminal("[STATS] Total actions: " + actionCount, "system");
    }

    // Load the on-chain activity feed below terminal
    loadActivityFeed(agent);
}

// =============================================================================
// ON-CHAIN ACTIVITY FEED
// =============================================================================

function formatTimeAgo(timestamp) {
    var now = Math.floor(Date.now() / 1000);
    var diff = now - timestamp;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    var date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
}

async function loadActivityFeed(agent) {
    var section = document.getElementById("activityFeedSection");
    var list = document.getElementById("activityFeedList");
    var toggle = document.getElementById("activityFeedToggle");
    if (!section || !list) return;

    section.style.display = "block";
    list.style.display = "block";
    toggle.classList.add("open");

    // Show loading
    list.innerHTML = "";
    var loadingDiv = document.createElement("div");
    loadingDiv.className = "activity-feed-loading";
    var spinner = document.createElement("span");
    spinner.className = "loading-spinner";
    loadingDiv.appendChild(spinner);
    var loadText = document.createElement("span");
    loadText.textContent = " Loading on-chain events...";
    loadText.style.color = "var(--text-dim)";
    loadText.style.fontSize = "0.82rem";
    loadingDiv.appendChild(loadText);
    list.appendChild(loadingDiv);

    var events = [];
    var provider = getStaticProvider();

    try {
        // Fetch verifications
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        var verifications = await verifyContract.getVerifications(agent.tokenId);
        for (var i = 0; i < verifications.length; i++) {
            var v = verifications[i];
            events.push({
                type: "verification",
                timestamp: Number(v.timestamp),
                title: "Verified by " + String(v.verifier).slice(0, 8) + "..." + String(v.verifier).slice(-4),
                detail: v.message || "Verified",
                contract: CONFIG.VERIFICATION_REGISTRY
            });
        }
    } catch (e) { console.log("Activity feed: verifications error", e); }

    try {
        // Fetch jobs
        var jobContract = new ethers.Contract(CONFIG.JOB_REGISTRY, JOB_REGISTRY_ABI, provider);
        var jobCount = await jobContract.getJobCount(agent.tokenId);
        var count = Number(jobCount);
        if (count > 0) {
            var offset = count > 20 ? count - 20 : 0;
            var jobs = await jobContract.getJobs(agent.tokenId, offset, 20);
            for (var j = 0; j < jobs.length; j++) {
                var job = jobs[j];
                events.push({
                    type: "job",
                    timestamp: Number(job.timestamp),
                    title: "Job Completed",
                    detail: job.message || job.escrowId || "Job executed",
                    contract: CONFIG.JOB_REGISTRY
                });
            }
        }
    } catch (e) { console.log("Activity feed: jobs error", e); }

    // Add registration event
    if (agent.createdAt) {
        events.push({
            type: "registration",
            timestamp: Number(agent.createdAt),
            title: "Soul Registered",
            detail: "Token #" + agent.tokenId + " minted on Base",
            contract: CONFIG.CONTRACT_ADDRESS
        });
    }

    // Sort newest first
    events.sort(function(a, b) { return b.timestamp - a.timestamp; });

    // Render
    renderActivityFeed(list, events);
}

function renderActivityFeed(container, events) {
    container.innerHTML = "";

    if (events.length === 0) {
        var empty = document.createElement("div");
        empty.className = "activity-feed-empty";
        empty.textContent = "No on-chain activity yet";
        container.appendChild(empty);
        return;
    }

    var icons = { verification: "\u2705", job: "\u{1F4CB}", registration: "\u{1F680}" };

    events.forEach(function(evt) {
        var row = document.createElement("div");
        row.className = "activity-event " + evt.type;

        var icon = document.createElement("span");
        icon.className = "activity-event-icon";
        icon.textContent = icons[evt.type] || "\u26A1";
        row.appendChild(icon);

        var body = document.createElement("div");
        body.className = "activity-event-body";

        var title = document.createElement("div");
        title.className = "activity-event-title";
        title.textContent = evt.title;
        body.appendChild(title);

        var detail = document.createElement("div");
        detail.className = "activity-event-detail";
        detail.textContent = evt.detail;
        body.appendChild(detail);

        if (evt.contract) {
            var link = document.createElement("a");
            link.className = "activity-event-link";
            link.href = "https://basescan.org/address/" + evt.contract;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View on BaseScan \u2197";
            body.appendChild(link);
        }

        row.appendChild(body);

        var time = document.createElement("span");
        time.className = "activity-event-time";
        time.textContent = formatTimeAgo(evt.timestamp);
        row.appendChild(time);

        container.appendChild(row);
    });
}

// =============================================================================
// AGENT-TO-AGENT AUTONOMOUS DEMO
// =============================================================================

function runAutoHireDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] === AUTONOMOUS AGENT-TO-AGENT DEMO ===", "system");
    typeInTerminal("[INFO] Initiating agent discovery and hiring...", "warning");

    showJobLoading("Running autonomous agent-to-agent demo...");
    updateJobLoadingText("ALIAS-Prime is discovering specialists...");

    fetchWithTimeout(CONFIG.API_URL + "/demo/auto-hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            skill: "data-analysis",
            task: "Analyze the top 5 DeFi protocols on Base by TVL, assess risk, and recommend allocation strategy",
            requester: "ALIAS-Prime"
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideJobLoading();
        if (data.error) {
            typeInTerminal("[ERROR] " + data.error, "warning");
            return;
        }
        // Animate steps in terminal
        var steps = data.steps || [];
        steps.forEach(function(step, i) {
            setTimeout(function() {
                var prefix = "[" + step.phase + "]";
                typeInTerminal(prefix + " " + step.message, step.color || "system");
            }, i * 500);
        });
        // Show completion toast after all steps
        setTimeout(function() {
            showToast("Agent-to-agent demo complete! " + (data.hired_agent || "") + " delivered results.", "success", 5000);
            if (data.verification_tx) {
                typeInTerminal("[TX] https://basescan.org/tx/" + data.verification_tx, "success");
            }
        }, steps.length * 500 + 200);
    })
    .catch(function(err) {
        hideJobLoading();
        console.error("Auto-hire demo error:", err);
        typeInTerminal("[ERROR] Demo failed: " + err.message, "warning");
        showToast("Demo failed - API may be unavailable", "error");
    });
}

function runCollabDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] === MULTI-AGENT COLLABORATION DEMO ===", "system");
    typeInTerminal("[INFO] Coordinator dispatching complex task to specialists...", "warning");

    showJobLoading("Running multi-agent collaboration...");
    updateJobLoadingText("ALIAS-Prime decomposing task for specialists...");

    fetchWithTimeout(CONFIG.API_URL + "/demo/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            task: "Perform a comprehensive security and economic audit of a DeFi lending protocol on Base"
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideJobLoading();
        if (data.error) {
            typeInTerminal("[ERROR] " + data.error, "warning");
            return;
        }
        var steps = data.steps || [];
        steps.forEach(function(step, i) {
            setTimeout(function() {
                var prefix = "[" + step.phase + "]";
                typeInTerminal(prefix + " " + step.message, step.color || "system");
            }, i * 600);
        });
        setTimeout(function() {
            var specialists = (data.specialists || []).map(function(s) { return s.agent; }).join(" + ");
            showToast("Collaboration complete! " + specialists + " contributed.", "success", 5000);
        }, steps.length * 600 + 200);
    })
    .catch(function(err) {
        hideJobLoading();
        console.error("Collab demo error:", err);
        typeInTerminal("[ERROR] Collaboration failed: " + err.message, "warning");
        showToast("Collaboration failed - API may be unavailable", "error");
    });
}
