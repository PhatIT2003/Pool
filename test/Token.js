const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BLOCH Pool System", function () {
  let BlochToken, USDTToken, USDQToken, BLOCHPool;
  let blochToken, usdtToken, usdqToken, blochPool;
  let owner, user1, user2;
  const oneDay = 24 * 60 * 60;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    BlochToken = await ethers.getContractFactory("BlochToken");
    blochToken = await BlochToken.deploy();

    USDTToken = await ethers.getContractFactory("USDTToken");
    usdtToken = await USDTToken.deploy();

    USDQToken = await ethers.getContractFactory("USDQToken");
    usdqToken = await USDQToken.deploy();

    BLOCHPool = await ethers.getContractFactory("BLOCHPool");
    blochPool = await BLOCHPool.deploy(
      await blochToken.getAddress(),
      await usdtToken.getAddress(),
      await usdqToken.getAddress()
    );

    // Setup initial states
    await usdqToken.setBlochPool(await blochPool.getAddress());
    
    // Transfer BLOCH tokens to pool
    const initialSupply = ethers.parseEther("240000000"); // 240M tokens
    await blochToken.transfer(await blochPool.getAddress(), initialSupply);

    // Mint some USDT to users for testing
    const usdtAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
    await usdtToken.mint(user1.address, usdtAmount);
    await usdtToken.mint(user2.address, usdtAmount);
  });

  describe("Initialization", function () {
    it("Should initialize with correct token addresses", async function () {
      expect(await blochPool.blochToken()).to.equal(blochToken.address);
      expect(await blochPool.usdtToken()).to.equal(usdtToken.address);
      expect(await blochPool.usdqToken()).to.equal(usdqToken.address);
    });

    it("Should initialize phases with correct values", async function () {
      const phase0 = await blochPool.phases(0);
      expect(phase0.price).to.equal(1000000); // $1
      expect(phase0.allocation).to.equal(ethers.utils.parseEther("60000000")); // 60M tokens
    });
  });

  describe("Phase Management", function () {
    it("Should set phase timings correctly", async function () {
      const currentTime = await time.latest();
      const phase0Start = currentTime + oneDay;
      const phase0End = phase0Start + 30 * oneDay;

      await blochPool.setPhaseTimings(0, phase0Start, phase0End);
      
      const phase = await blochPool.phases(0);
      expect(phase.startTime).to.equal(phase0Start);
      expect(phase.endTime).to.equal(phase0End);
    });

    it("Should prevent overlapping phases", async function () {
      const currentTime = await time.latest();
      const phase0Start = currentTime + oneDay;
      const phase0End = phase0Start + 30 * oneDay;
      const phase1Start = phase0Start; // Overlapping start

      await blochPool.setPhaseTimings(0, phase0Start, phase0End);
      await expect(
        blochPool.setPhaseTimings(1, phase1Start, phase1Start + 30 * oneDay)
      ).to.be.revertedWith("Overlaps with previous phase");
    });
  });

  describe("Purchase Functionality", function () {
    beforeEach(async function () {
      // Setup phase timing
      const currentTime = await time.latest();
      const phase0Start = currentTime + 2; // Small buffer
      const phase0End = phase0Start + 30 * oneDay;
      await blochPool.setPhaseTimings(0, phase0Start, phase0End);

      // Set purchase limits
      const minPurchase = ethers.parseEther("100"); // 100 BLOCH
      const maxPurchase = ethers.parseEther("10000"); // 10,000 BLOCH
      await blochPool.setPurchaseLimits(minPurchase, maxPurchase);

      // Increase time to active phase
      await time.increase(3); // Move past phase start
    });

    it("Should allow purchase within phase", async function () {
      // Approve USDT spending
      const purchaseAmount = ethers.parseEther("1000"); // 1,000 BLOCH
      const usdtAmount = ethers.parseUnits("1000", 6); // 1,000 USDT (price is $1)
      await usdtToken.connect(user1).approve(await blochPool.getAddress(), usdtAmount);

      // Make purchase
      await blochPool.connect(user1).purchase(purchaseAmount);

      // Verify balances
      expect(await blochToken.balanceOf(user1.address)).to.equal(purchaseAmount);
      expect(await usdqToken.balanceOf(owner.address)).to.equal(usdtAmount);
    });

    it("Should fail purchase outside phase", async function () {
      await time.increase(31 * oneDay); // Move past phase end
      const purchaseAmount = ethers.parseEther("1000");
      await expect(
        blochPool.connect(user1).purchase(purchaseAmount)
      ).to.be.revertedWith("No active phase");
    });

    it("Should respect purchase limits", async function () {
      // Try to purchase below minimum
      const smallAmount = ethers.parseEther("50"); // 50 BLOCH
      await expect(
        blochPool.connect(user1).purchase(smallAmount)
      ).to.be.revertedWith("Below minimum purchase");

      // Try to purchase above maximum
      const largeAmount = ethers.parseEther("20000"); // 20,000 BLOCH
      await expect(
        blochPool.connect(user1).purchase(largeAmount)
      ).to.be.revertedWith("Exceeds maximum purchase");
    });
  });

  describe("Reward System", function () {
    beforeEach(async function () {
      // Enable rewards
      await blochPool.setRewardParameters(true, 500, oneDay); // 5% reward rate, 1 day interval

      // Setup phase timing
      const currentTime = await time.latest();
      const phase0Start = currentTime + 2;
      const phase0End = phase0Start + 30 * oneDay;
      await blochPool.setPhaseTimings(0, phase0Start, phase0End);
      
      // Move to active phase
      await time.increase(3);
    });

    it("Should allow reward claims after purchase", async function () {
      // Make purchase
      const purchaseAmount = ethers.parseEther("1000");
      const usdtAmount = ethers.parseUnits("1000", 6);
      await usdtToken.connect(user1).approve(await blochPool.getAddress(), usdtAmount);
      await blochPool.connect(user1).purchase(purchaseAmount);

      // Move time forward
      await time.increase(oneDay + 1);

      // Claim reward
      await blochPool.connect(user1).claimReward();

      // Verify reward
      const expectedReward = ethers.parseUnits("50", 6); // 5% of 1000 USDT
      expect(await usdqToken.balanceOf(user1.address)).to.equal(expectedReward);
    });

    it("Should prevent early reward claims", async function () {
      // Make purchase
      const purchaseAmount = ethers.parseEther("1000");
      const usdtAmount = ethers.parseUnits("1000", 6);
      await usdtToken.connect(user1).approve(await blochPool.getAddress(), usdtAmount);
      await blochPool.connect(user1).purchase(purchaseAmount);

      // Try to claim immediately
      await expect(
        blochPool.connect(user1).claimReward()
      ).to.be.revertedWith("Reward interval not met");
    });
  });

  describe("Admin Functions", function () {
    beforeEach(async function () {
      // Setup phase timing
      const currentTime = await time.latest();
      const phase0Start = currentTime + 2;
      const phase0End = phase0Start + 30 * oneDay;
      await blochPool.setPhaseTimings(0, phase0Start, phase0End);
      
      // Move to active phase
      await time.increase(3);
    });

    it("Should allow owner to withdraw USDT", async function () {
      // Make a purchase first
      const purchaseAmount = ethers.parseEther("1000");
      const usdtAmount = ethers.parseUnits("1000", 6);
      await usdtToken.connect(user1).approve(await blochPool.getAddress(), usdtAmount);
      await blochPool.connect(user1).purchase(purchaseAmount);

      // Withdraw USDT
      const withdrawAmount = ethers.parseUnits("500", 6);
      await blochPool.withdrawUSDT(withdrawAmount);
      
      expect(await usdtToken.balanceOf(owner.address)).to.equal(withdrawAmount);
    });

    it("Should allow owner to recover unsold BLOCH", async function () {
      // Move time past phase end
      await time.increase(31 * oneDay);

      // Recover unsold tokens
      await blochPool.recoverUnsoldBLOCH(0);

      // Verify recovered amount
      const phase0 = await blochPool.phases(0);
      const expectedRecovered = phase0.allocation;
      expect(await blochToken.balanceOf(owner.address)).to.equal(expectedRecovered);
    });
  });
});