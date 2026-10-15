// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title LogSentinelCheckpointRegistry
 * @notice Cryptographic checkpoint registry for LogSentinel's tamper-evident SHA-256 log chains.
 * @dev Anchors immutable, timestamped commitments of contiguous log sequences.
 * Does NOT store raw logs, canonical payloads, server names, hostnames, or PII on-chain.
 */
contract LogSentinelCheckpointRegistry {
    struct Checkpoint {
        bytes32 checkpointId;
        bytes32 applicationId;
        bytes32 serverCommitment;
        uint64 startSequence;
        uint64 endSequence;
        bytes32 checkpointRoot;
        uint64 createdAt;
        address submitter;
    }

    address public owner;
    mapping(address => bool) public authorizedSubmitters;

    // checkpointId => Checkpoint record
    mapping(bytes32 => Checkpoint) private _checkpoints;

    // serverCommitment => latest checkpointId
    mapping(bytes32 => bytes32) private _latestCheckpointByServer;

    // keccak256(abi.encodePacked(serverCommitment, startSequence, endSequence)) => checkpointRoot
    // Prevents conflicting commitments for the exact same logical range
    mapping(bytes32 => bytes32) private _rangeRoots;

    // --- Custom Errors ---
    error UnauthorizedCaller(address caller);
    error InvalidZeroAddress();
    error InvalidZeroCommitment(string paramName);
    error InvalidSequenceRange(uint64 startSequence, uint64 endSequence);
    error CheckpointAlreadyExists(bytes32 checkpointId);
    error ConflictingRangeCommitment(bytes32 existingRoot, bytes32 attemptedRoot);
    error CheckpointNotFound(bytes32 checkpointId);

    // --- Events ---
    event CheckpointAnchored(
        bytes32 indexed checkpointId,
        bytes32 indexed serverCommitment,
        uint64 startSequence,
        uint64 endSequence,
        bytes32 checkpointRoot,
        uint64 createdAt,
        address indexed submitter
    );

    event SubmitterAuthorized(address indexed account, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    modifier onlyAuthorizedSubmitter() {
        if (msg.sender != owner && !authorizedSubmitters[msg.sender]) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    /**
     * @param initialSubmitter Optional initial backend submitter account to authorize.
     */
    constructor(address initialSubmitter) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        if (initialSubmitter != address(0)) {
            authorizedSubmitters[initialSubmitter] = true;
            emit SubmitterAuthorized(initialSubmitter, true);
        }
    }

    /**
     * @notice Authorizes or revokes a backend signer account for checkpoint anchoring.
     */
    function setAuthorizedSubmitter(address account, bool authorized) external onlyOwner {
        if (account == address(0)) revert InvalidZeroAddress();
        authorizedSubmitters[account] = authorized;
        emit SubmitterAuthorized(account, authorized);
    }

    /**
     * @notice Transfers contract ownership to a new administrator address.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Anchors a cryptographic checkpoint commitment for a contiguous log sequence.
     * @param checkpointId Deterministic identifier derived from domain-separated parameters.
     * @param applicationId Public application instance identifier.
     * @param serverCommitment Privacy-safe HMAC/hash of server identifier.
     * @param startSequence First sequence number in the anchored range (>= 1).
     * @param endSequence Last sequence number in the anchored range (>= startSequence).
     * @param checkpointRoot SHA-256 commitment of the verified sequence range and boundaries.
     */
    function anchorCheckpoint(
        bytes32 checkpointId,
        bytes32 applicationId,
        bytes32 serverCommitment,
        uint64 startSequence,
        uint64 endSequence,
        bytes32 checkpointRoot
    ) external onlyAuthorizedSubmitter returns (Checkpoint memory) {
        if (checkpointId == bytes32(0)) revert InvalidZeroCommitment("checkpointId");
        if (applicationId == bytes32(0)) revert InvalidZeroCommitment("applicationId");
        if (serverCommitment == bytes32(0)) revert InvalidZeroCommitment("serverCommitment");
        if (checkpointRoot == bytes32(0)) revert InvalidZeroCommitment("checkpointRoot");

        if (startSequence == 0 || endSequence < startSequence) {
            revert InvalidSequenceRange(startSequence, endSequence);
        }

        if (_checkpoints[checkpointId].checkpointId != bytes32(0)) {
            revert CheckpointAlreadyExists(checkpointId);
        }

        bytes32 rangeKey = keccak256(abi.encodePacked(serverCommitment, startSequence, endSequence));
        bytes32 existingRoot = _rangeRoots[rangeKey];
        if (existingRoot != bytes32(0)) {
            if (existingRoot != checkpointRoot) {
                revert ConflictingRangeCommitment(existingRoot, checkpointRoot);
            }
        } else {
            _rangeRoots[rangeKey] = checkpointRoot;
        }

        uint64 timestamp = uint64(block.timestamp);

        Checkpoint memory cp = Checkpoint({
            checkpointId: checkpointId,
            applicationId: applicationId,
            serverCommitment: serverCommitment,
            startSequence: startSequence,
            endSequence: endSequence,
            checkpointRoot: checkpointRoot,
            createdAt: timestamp,
            submitter: msg.sender
        });

        _checkpoints[checkpointId] = cp;
        _latestCheckpointByServer[serverCommitment] = checkpointId;

        emit CheckpointAnchored(
            checkpointId,
            serverCommitment,
            startSequence,
            endSequence,
            checkpointRoot,
            timestamp,
            msg.sender
        );

        return cp;
    }

    /**
     * @notice Checks whether a checkpoint identifier has been anchored.
     */
    function checkpointExists(bytes32 checkpointId) external view returns (bool) {
        return _checkpoints[checkpointId].checkpointId != bytes32(0);
    }

    /**
     * @notice Returns the full checkpoint record by ID.
     */
    function getCheckpoint(bytes32 checkpointId) external view returns (Checkpoint memory) {
        Checkpoint memory cp = _checkpoints[checkpointId];
        if (cp.checkpointId == bytes32(0)) {
            revert CheckpointNotFound(checkpointId);
        }
        return cp;
    }

    /**
     * @notice Returns the latest registered checkpoint ID for a given server commitment.
     */
    function getLatestCheckpointId(bytes32 serverCommitment) external view returns (bytes32) {
        return _latestCheckpointByServer[serverCommitment];
    }

    /**
     * @notice Returns the latest registered checkpoint record for a given server commitment.
     */
    function getLatestCheckpoint(bytes32 serverCommitment) external view returns (Checkpoint memory) {
        bytes32 latestId = _latestCheckpointByServer[serverCommitment];
        if (latestId == bytes32(0)) {
            revert CheckpointNotFound(bytes32(0));
        }
        return _checkpoints[latestId];
    }
}
