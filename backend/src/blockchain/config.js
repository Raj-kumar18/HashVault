import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Well-known default Hardhat test key (Account #0) for local zero-config offline testing
const DEFAULT_LOCAL_DEV_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/**
 * Attempts to load deployed contract address from local deployment artifact
 */
function resolveDeployedContractAddress() {
  try {
    const deploymentPath = path.resolve(__dirname, '../../../blockchain/deployments/localhost.json');
    if (fs.existsSync(deploymentPath)) {
      const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      if (data && data.contractAddress) {
        return data.contractAddress;
      }
    }
  } catch {
    // Ignore fallback failure
  }
  return null;
}

export function getBlockchainConfig() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const expectedChainId = parseInt(process.env.BLOCKCHAIN_CHAIN_ID || '31337', 10);
  const contractAddress =
    process.env.BLOCKCHAIN_CONTRACT_ADDRESS ||
    resolveDeployedContractAddress() ||
    '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Standard Hardhat first deployment address
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || DEFAULT_LOCAL_DEV_KEY;
  const applicationId =
    process.env.LOGSENTINEL_APPLICATION_ID ||
    process.env.APPLICATION_INSTANCE_ID ||
    'logsentinel-default-app';
  const requiredConfirmations = Math.max(
    1,
    parseInt(
      process.env.BLOCKCHAIN_CONFIRMATIONS ||
        process.env.BLOCKCHAIN_REQUIRED_CONFIRMATIONS ||
        '1',
      10
    )
  );
  const networkName = process.env.BLOCKCHAIN_NETWORK_NAME || 'Hardhat Localhost';
  const enabled = process.env.BLOCKCHAIN_ENABLED !== 'false';

  return {
    rpcUrl,
    expectedChainId,
    contractAddress,
    privateKey,
    applicationId,
    requiredConfirmations,
    networkName,
    enabled,
  };
}

/**
 * Returns safe status summary without exposing private keys or credentials.
 */
export function getSafeBlockchainConfigSummary() {
  const cfg = getBlockchainConfig();
  return {
    enabled: cfg.enabled,
    rpcUrl: cfg.rpcUrl.replace(/\/\/[^@]+@/, '//***@'), // Mask HTTP basic auth if present
    expectedChainId: cfg.expectedChainId,
    contractAddress: cfg.contractAddress,
    networkName: cfg.networkName,
    requiredConfirmations: cfg.requiredConfirmations,
    applicationId: cfg.applicationId,
    hasConfiguredSigner: !!cfg.privateKey,
  };
}
