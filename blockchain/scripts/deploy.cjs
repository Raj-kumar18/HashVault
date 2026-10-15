const fs = require("node:fs");
const path = require("node:path");
const { ethers, network } = require("hardhat");

async function main() {
  console.log(`[Deploy] Deploying LogSentinelCheckpointRegistry on network: ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log(`[Deploy] Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`[Deploy] Deployer balance: ${ethers.formatEther(balance)} ETH`);

  // Authorize deployer as initial submitter
  const RegistryFactory = await ethers.getContractFactory("LogSentinelCheckpointRegistry");
  const registry = await RegistryFactory.deploy(deployer.address);
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  const deploymentTx = registry.deploymentTransaction();
  const receipt = await deploymentTx.wait(1);

  console.log(`[Deploy] LogSentinelCheckpointRegistry deployed successfully!`);
  console.log(`[Deploy] Contract Address: ${contractAddress}`);
  console.log(`[Deploy] Transaction Hash: ${deploymentTx.hash}`);
  console.log(`[Deploy] Block Number: ${receipt.blockNumber}`);

  // Save deployment artifact for backend consumption
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const networkName = network.name === "hardhat" ? "localhost" : network.name;
  const artifactPath = path.join(deploymentsDir, `${networkName}.json`);

  const deploymentData = {
    network: networkName,
    chainId: Number(network.config.chainId || 31337),
    contractAddress,
    deployer: deployer.address,
    initialSubmitter: deployer.address,
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(artifactPath, JSON.stringify(deploymentData, null, 2), "utf8");
  console.log(`[Deploy] Saved deployment metadata to: ${artifactPath}`);

  return deploymentData;
}

main().catch((error) => {
  console.error("[Deploy] Deployment failed:", error);
  process.exit(1);
});
