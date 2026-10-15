/**
 * ABI for LogSentinelCheckpointRegistry smart contract
 */
export const CHECKPOINT_REGISTRY_ABI = [
  "constructor(address initialSubmitter)",
  "error CheckpointAlreadyExists(bytes32 checkpointId)",
  "error CheckpointNotFound(bytes32 checkpointId)",
  "error ConflictingRangeCommitment(bytes32 existingRoot, bytes32 attemptedRoot)",
  "error InvalidSequenceRange(uint64 startSequence, uint64 endSequence)",
  "error InvalidZeroAddress()",
  "error InvalidZeroCommitment(string paramName)",
  "error UnauthorizedCaller(address caller)",
  "event CheckpointAnchored(bytes32 indexed checkpointId, bytes32 indexed serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot, uint64 createdAt, address indexed submitter)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event SubmitterAuthorized(address indexed account, bool authorized)",
  "function anchorCheckpoint(bytes32 checkpointId, bytes32 applicationId, bytes32 serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot) returns ((bytes32 checkpointId, bytes32 applicationId, bytes32 serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot, uint64 createdAt, address submitter))",
  "function authorizedSubmitters(address) view returns (bool)",
  "function checkpointExists(bytes32 checkpointId) view returns (bool)",
  "function getCheckpoint(bytes32 checkpointId) view returns ((bytes32 checkpointId, bytes32 applicationId, bytes32 serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot, uint64 createdAt, address submitter))",
  "function getLatestCheckpoint(bytes32 serverCommitment) view returns ((bytes32 checkpointId, bytes32 applicationId, bytes32 serverCommitment, uint64 startSequence, uint64 endSequence, bytes32 checkpointRoot, uint64 createdAt, address submitter))",
  "function getLatestCheckpointId(bytes32 serverCommitment) view returns (bytes32)",
  "function owner() view returns (address)",
  "function setAuthorizedSubmitter(address account, bool authorized)",
  "function transferOwnership(address newOwner)"
];
