const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LogSentinelCheckpointRegistry Smart Contract Suite", function () {
  let registry;
  let owner;
  let submitter;
  let unauthorizedAccount;
  let otherAccount;

  const testAppId = ethers.keccak256(ethers.toUtf8Bytes("logsentinel-default-app"));
  const testServerCommitment = ethers.keccak256(ethers.toUtf8Bytes("server:srv_test_server_01"));
  const testCheckpointRoot = ethers.keccak256(ethers.toUtf8Bytes("root:seq_1_to_10"));
  const testCheckpointId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "uint64", "uint64", "bytes32"],
      [testAppId, testServerCommitment, 1, 10, testCheckpointRoot]
    )
  );

  beforeEach(async function () {
    [owner, submitter, unauthorizedAccount, otherAccount] = await ethers.getSigners();

    const RegistryFactory = await ethers.getContractFactory("LogSentinelCheckpointRegistry");
    registry = await RegistryFactory.deploy(submitter.address);
    await registry.waitForDeployment();
  });

  describe("1. Deployment & Access Control", function () {
    it("should set deployer as owner and authorize initial submitter", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.authorizedSubmitters(submitter.address)).to.equal(true);
      expect(await registry.authorizedSubmitters(unauthorizedAccount.address)).to.equal(false);
    });

    it("should allow owner to authorize and revoke submitters", async function () {
      await expect(registry.connect(owner).setAuthorizedSubmitter(otherAccount.address, true))
        .to.emit(registry, "SubmitterAuthorized")
        .withArgs(otherAccount.address, true);

      expect(await registry.authorizedSubmitters(otherAccount.address)).to.equal(true);

      await expect(registry.connect(owner).setAuthorizedSubmitter(otherAccount.address, false))
        .to.emit(registry, "SubmitterAuthorized")
        .withArgs(otherAccount.address, false);

      expect(await registry.authorizedSubmitters(otherAccount.address)).to.equal(false);
    });

    it("should revert if non-owner attempts to authorize submitters", async function () {
      await expect(
        registry.connect(unauthorizedAccount).setAuthorizedSubmitter(otherAccount.address, true)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller");
    });

    it("should transfer ownership properly", async function () {
      await expect(registry.connect(owner).transferOwnership(otherAccount.address))
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, otherAccount.address);

      expect(await registry.owner()).to.equal(otherAccount.address);
    });
  });

  describe("2. Checkpoint Anchoring & Validation", function () {
    it("should allow authorized submitter to anchor valid checkpoint", async function () {
      const tx = await registry
        .connect(submitter)
        .anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, testCheckpointRoot);

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      // Verify event emission
      await expect(tx)
        .to.emit(registry, "CheckpointAnchored")
        .withArgs(
          testCheckpointId,
          testServerCommitment,
          1,
          10,
          testCheckpointRoot,
          (await ethers.provider.getBlock(receipt.blockNumber)).timestamp,
          submitter.address
        );

      // Verify retrieval
      expect(await registry.checkpointExists(testCheckpointId)).to.equal(true);
      const cp = await registry.getCheckpoint(testCheckpointId);
      expect(cp.checkpointId).to.equal(testCheckpointId);
      expect(cp.applicationId).to.equal(testAppId);
      expect(cp.serverCommitment).to.equal(testServerCommitment);
      expect(cp.startSequence).to.equal(1n);
      expect(cp.endSequence).to.equal(10n);
      expect(cp.checkpointRoot).to.equal(testCheckpointRoot);
      expect(cp.submitter).to.equal(submitter.address);

      // Verify latest checkpoint by server
      expect(await registry.getLatestCheckpointId(testServerCommitment)).to.equal(testCheckpointId);
      const latestCp = await registry.getLatestCheckpoint(testServerCommitment);
      expect(latestCp.checkpointId).to.equal(testCheckpointId);
    });

    it("should reject unauthorized account from anchoring checkpoints", async function () {
      await expect(
        registry
          .connect(unauthorizedAccount)
          .anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller");
    });

    it("should reject zero-valued commitments", async function () {
      const zero = ethers.ZeroHash;
      await expect(
        registry.connect(submitter).anchorCheckpoint(zero, testAppId, testServerCommitment, 1, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "InvalidZeroCommitment");

      await expect(
        registry.connect(submitter).anchorCheckpoint(testCheckpointId, zero, testServerCommitment, 1, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "InvalidZeroCommitment");

      await expect(
        registry.connect(submitter).anchorCheckpoint(testCheckpointId, testAppId, zero, 1, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "InvalidZeroCommitment");

      await expect(
        registry.connect(submitter).anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, zero)
      ).to.be.revertedWithCustomError(registry, "InvalidZeroCommitment");
    });

    it("should reject invalid sequence ranges (startSequence == 0 or endSequence < startSequence)", async function () {
      await expect(
        registry.connect(submitter).anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 0, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "InvalidSequenceRange");

      await expect(
        registry.connect(submitter).anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 10, 5, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "InvalidSequenceRange");
    });

    it("should reject duplicate checkpoint ID", async function () {
      await registry
        .connect(submitter)
        .anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, testCheckpointRoot);

      await expect(
        registry
          .connect(submitter)
          .anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, testCheckpointRoot)
      ).to.be.revertedWithCustomError(registry, "CheckpointAlreadyExists");
    });

    it("should reject conflicting root commitment for the exact same sequence range", async function () {
      await registry
        .connect(submitter)
        .anchorCheckpoint(testCheckpointId, testAppId, testServerCommitment, 1, 10, testCheckpointRoot);

      const conflictingRoot = ethers.keccak256(ethers.toUtf8Bytes("conflicting_root_payload"));
      const anotherCheckpointId = ethers.keccak256(ethers.toUtf8Bytes("checkpoint_attempt_2"));

      await expect(
        registry
          .connect(submitter)
          .anchorCheckpoint(anotherCheckpointId, testAppId, testServerCommitment, 1, 10, conflictingRoot)
      ).to.be.revertedWithCustomError(registry, "ConflictingRangeCommitment");
    });

    it("should revert when querying non-existent checkpoint", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("random_id"));
      await expect(registry.getCheckpoint(nonExistentId)).to.be.revertedWithCustomError(
        registry,
        "CheckpointNotFound"
      );
    });
  });
});
