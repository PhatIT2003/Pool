// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// BLOCH Pool Contract
contract BLOCHPool is Ownable, Pausable, ReentrancyGuard {
    IERC20 public blochToken;
    IERC20 public usdtToken;
    USDQToken public usdqToken;

    struct Phase {
        uint256 startTime;
        uint256 endTime;
        uint256 price;       
        uint256 allocation;   
        uint256 sold;         
    }

    struct UserInfo {
        uint256 blochPurchased;
        uint256 usdtSpent;
        uint256 lastPurchaseTime;
    }

    Phase[4] public phases;
    mapping(address => UserInfo) public userInfo;
    
    uint256 public minPurchaseAmount;
    uint256 public maxPurchaseAmount;
    bool public rewardsEnabled;
    uint256 public rewardRate;
    uint256 public rewardInterval;

    event Purchase(address indexed user, uint256 blochAmount, uint256 usdtAmount);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(
        address _blochToken,
        address _usdtToken,
        address _usdqToken,
        address initialOwner // Add initialOwner to constructor
    ) Ownable() {
        blochToken = IERC20(_blochToken);
        usdtToken = IERC20(_usdtToken);
        usdqToken = USDQToken(_usdqToken);
        transferOwnership(initialOwner); // Set the initial owner

        // Initialize phases with specific start and end times
        phases[0] = Phase(1735689600, 1738291200, 1000000, 60_000_000 * 10**18, 0); // 1/1/2024 to 1/4/2024
        phases[1] = Phase(1738291200, 1740902400, 2000000, 60_000_000 * 10**18, 0); // 1/4/2024 to 1/7/2024
        phases[2] = Phase(1740902400, 1743580800, 3000000, 60_000_000 * 10**18, 0); // 1/7/2024 to 1/10/2024
        phases[3] = Phase(1743580800, 1746096000, 4000000, 60_000_000 * 10**18, 0); // 1/10/2024 to 1/1/2025
    }

    // Set timings for a given phase
    function setPhaseTimings(
        uint256 phaseIndex,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        require(phaseIndex < 4, "Invalid phase index");
        require(endTime > startTime, "Invalid time range");

        // Check overlap with previous phase
        if(phaseIndex > 0) {
            require(startTime > phases[phaseIndex-1].endTime, "Overlaps with previous phase");
        }

        // Check overlap with next phase
        if(phaseIndex < 3) {
            require(phases[phaseIndex+1].startTime == 0 || 
                    endTime < phases[phaseIndex+1].startTime, 
                    "Overlaps with next phase");
        }

        phases[phaseIndex].startTime = startTime;
        phases[phaseIndex].endTime = endTime;
    }

    // Set purchase limits for users
    function setPurchaseLimits(
        uint256 _minAmount,
        uint256 _maxAmount
    ) external onlyOwner {
        minPurchaseAmount = _minAmount;
        maxPurchaseAmount = _maxAmount;
    }

    // Get the index of the current active phase
    function getCurrentPhase() public view returns (uint256) {
        for (uint256 i = 0; i < 4; i++) {
            if (block.timestamp >= phases[i].startTime && 
                block.timestamp <= phases[i].endTime) {
                return i;
            }
        }
        revert("No active phase");
    }

    // Purchase BLOCH token with USDT
    function purchase(uint256 blochAmount) external nonReentrant whenNotPaused {
        uint256 currentPhase = getCurrentPhase();
        Phase storage phase = phases[currentPhase];
        
        require(blochAmount > 0, "Amount must be greater than 0");
        require(phase.sold + blochAmount <= phase.allocation, "Exceeds phase allocation");
        
        if (minPurchaseAmount > 0) {
            require(blochAmount >= minPurchaseAmount, "Below minimum purchase");
        }
        if (maxPurchaseAmount > 0) {
            require(blochAmount <= maxPurchaseAmount, "Exceeds maximum purchase");
        }

        uint256 usdtAmount = (blochAmount * phase.price) / 10**6; // Adjust for decimal difference
        
        // Check USDT allowance
        require(usdtToken.allowance(msg.sender, address(this)) >= usdtAmount, 
                "Insufficient USDT allowance");

        // Check USDT balance
        require(usdtToken.balanceOf(msg.sender) >= usdtAmount,
                "Insufficient USDT balance");

        // Check BLOCH balance
        require(blochToken.balanceOf(address(this)) >= blochAmount,
                "Insufficient BLOCH in pool");

        // Transfer USDT from user to pool
        require(usdtToken.transferFrom(msg.sender, address(this), usdtAmount), 
                "USDT transfer failed");

        // Transfer BLOCH to user
        require(blochToken.transfer(msg.sender, blochAmount), 
                "BLOCH transfer failed");

        // Mint equivalent USDQ to admin
        usdqToken.mint(owner(), usdtAmount);

        // Update phase and user info
        phase.sold += blochAmount;
        userInfo[msg.sender].blochPurchased += blochAmount;
        userInfo[msg.sender].usdtSpent += usdtAmount;
        userInfo[msg.sender].lastPurchaseTime = block.timestamp;

        emit Purchase(msg.sender, blochAmount, usdtAmount);
    }

    // Admin functions for withdrawing and recovering tokens
    function withdrawUSDT(uint256 amount) external onlyOwner {
        require(usdtToken.transfer(owner(), amount), "USDT transfer failed");
    }

    function recoverUnsoldBLOCH(uint256 phaseIndex) external onlyOwner {
        require(phaseIndex < 4, "Invalid phase index");
        require(block.timestamp > phases[phaseIndex].endTime, "Phase not ended");

        Phase storage phase = phases[phaseIndex];
        uint256 unsoldAmount = phase.allocation - phase.sold;
        if (unsoldAmount > 0) {
            require(blochToken.transfer(owner(), unsoldAmount), 
                    "BLOCH transfer failed");
        }
    }

    // Update price for a given phase
    function updatePhasePrice(uint256 phaseIndex, uint256 newPrice) external onlyOwner {
        require(phaseIndex < 4, "Invalid phase index");
        require(block.timestamp < phases[phaseIndex].startTime, "Phase already started");
        phases[phaseIndex].price = newPrice;
    }

    // Reward system functions
    function setRewardParameters(
        bool _enabled,
        uint256 _rate,
        uint256 _interval
    ) external onlyOwner {
        rewardsEnabled = _enabled;
        rewardRate = _rate;
        rewardInterval = _interval;
    }

    function claimReward() external nonReentrant whenNotPaused {
        require(rewardsEnabled, "Rewards not enabled");
        UserInfo storage user = userInfo[msg.sender];
        require(user.blochPurchased > 0, "No BLOCH purchased");
        
        uint256 timeSinceLastPurchase = block.timestamp - user.lastPurchaseTime;
        require(timeSinceLastPurchase >= rewardInterval, "Too soon to claim reward");
        
        uint256 reward = (user.blochPurchased * rewardRate) / 10**6;
        
        require(blochToken.balanceOf(address(this)) >= reward, "Insufficient balance");
        
        user.blochPurchased = 0;  // Reset after claiming reward
        require(blochToken.transfer(msg.sender, reward), "Reward transfer failed");
        
        emit RewardClaimed(msg.sender, reward);
    }

    // Pause and unpause the contract
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
