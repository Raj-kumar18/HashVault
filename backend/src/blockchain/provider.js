import { ethers } from 'ethers';
import { getBlockchainConfig } from './config.js';
import { CHECKPOINT_REGISTRY_ABI } from './contractAbi.js';

let cachedProvider = null;
let cachedProviderUrl = null;

export function resetProviderCache() {
  cachedProvider = null;
  cachedProviderUrl = null;
}

export function getProvider() {
  const config = getBlockchainConfig();
  if (cachedProvider && cachedProviderUrl === config.rpcUrl) {
    return cachedProvider;
  }
  const network = ethers.Network.from(config.expectedChainId || 31337);
  cachedProvider = new ethers.JsonRpcProvider(config.rpcUrl, network, {
    staticNetwork: network,
  });
  cachedProviderUrl = config.rpcUrl;
  return cachedProvider;
}

export function getSigner() {
  const config = getBlockchainConfig();
  if (!config.privateKey) {
    throw new Error('Signer private key is not configured (BLOCKCHAIN_PRIVATE_KEY missing).');
  }
  const provider = getProvider();
  return new ethers.Wallet(config.privateKey, provider);
}

export function getContract(signerOrProvider = null) {
  const config = getBlockchainConfig();
  if (!config.contractAddress || !ethers.isAddress(config.contractAddress)) {
    throw new Error(`Invalid or missing contract address: ${config.contractAddress}`);
  }
  const runner = signerOrProvider || getProvider();
  return new ethers.Contract(config.contractAddress, CHECKPOINT_REGISTRY_ABI, runner);
}

/**
 * Probes connected RPC network, validates chain ID, contract deployment, and signer balance.
 */
export async function checkBlockchainHealth() {
  const config = getBlockchainConfig();
  const startTime = performance.now();

  if (!config.enabled) {
    return {
      connected: false,
      status: 'DISABLED',
      message: 'Blockchain anchoring is disabled via configuration.',
      networkName: config.networkName,
      expectedChainId: config.expectedChainId,
    };
  }

  try {
    const provider = getProvider();
    const rpcChainIdHex = await provider.send('eth_chainId', []);
    const connectedChainId = parseInt(rpcChainIdHex, 16);
    const latency = Math.round(performance.now() - startTime);

    const chainIdMatch = connectedChainId === config.expectedChainId;

    // Check if contract is deployed at configured address
    let contractDeployed = false;
    let contractCodeLength = 0;
    if (config.contractAddress && ethers.isAddress(config.contractAddress)) {
      try {
        const code = await provider.getCode(config.contractAddress);
        contractDeployed = code && code !== '0x' && code !== '0x0';
        contractCodeLength = code ? (code.length - 2) / 2 : 0;
      } catch {
        contractDeployed = false;
      }
    }

    // Check signer address and balance
    let signerAddress = null;
    let signerBalanceEth = '0.0';
    try {
      const signer = getSigner();
      signerAddress = signer.address;
      const balance = await provider.getBalance(signer.address);
      signerBalanceEth = ethers.formatEther(balance);
    } catch {
      // Signer check failed
    }

    return {
      connected: true,
      status: chainIdMatch && contractDeployed ? 'READY' : 'MISCONFIGURED',
      latency,
      networkName: config.networkName,
      connectedChainId,
      expectedChainId: config.expectedChainId,
      chainIdMatch,
      contractAddress: config.contractAddress,
      contractDeployed,
      contractBytecodeBytes: contractCodeLength,
      signerAddress,
      signerBalanceEth,
      requiredConfirmations: config.requiredConfirmations,
      applicationId: config.applicationId,
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      connected: false,
      status: 'UNAVAILABLE',
      latency,
      message: `Blockchain RPC connection failed: ${error.message}`,
      networkName: config.networkName,
      expectedChainId: config.expectedChainId,
      contractAddress: config.contractAddress,
    };
  }
}
