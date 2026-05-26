const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=================================================");
  console.log("Starting SafeKosh Contract Deployment Sequence...");
  console.log("=================================================");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} MATIC`);

  // 1. Deploy ChitEscrow
  console.log("\n--- Deploying ChitEscrow ---");
  const ChitEscrow = await hre.ethers.getContractFactory("ChitEscrow");
  const chitEscrow = await ChitEscrow.deploy();
  await chitEscrow.waitForDeployment();
  const chitEscrowAddress = await chitEscrow.getAddress();
  console.log(`✓ ChitEscrow deployed to: ${chitEscrowAddress}`);

  // 2. Deploy CertificateRegistry
  console.log("\n--- Deploying CertificateRegistry ---");
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const certificateRegistry = await CertificateRegistry.deploy();
  await certificateRegistry.waitForDeployment();
  const certificateRegistryAddress = await certificateRegistry.getAddress();
  console.log(`✓ CertificateRegistry deployed to: ${certificateRegistryAddress}`);

  // 3. Save Deployment Addresses
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const networkName = hre.network.name;
  const filename = networkName === "polygonMumbai" ? "mumbai.json" : `${networkName}.json`;
  const deploymentPath = path.join(deploymentsDir, filename);
  const deploymentData = {
    network: networkName,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    contracts: {
      ChitEscrow: chitEscrowAddress,
      CertificateRegistry: certificateRegistryAddress
    },
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n✓ Saved deployment data to: ${deploymentPath}`);

  // 4. Verification on Block Explorer (if not on local network)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\nWaiting for 6 block confirmations before verifying contracts on Etherscan/Polygonscan...");
    
    // Wait for 6 blocks to ensure the bytecodes are indexed
    const deployTx1 = chitEscrow.deploymentTransaction();
    if (deployTx1) await deployTx1.wait(6);
    
    console.log("Proceeding with contract verification...");

    try {
      await hre.run("verify:verify", {
        address: chitEscrowAddress,
        constructorArguments: []
      });
      console.log("✓ ChitEscrow verified successfully!");
    } catch (error) {
      console.warn("✗ ChitEscrow verification failed or already verified:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: certificateRegistryAddress,
        constructorArguments: []
      });
      console.log("✓ CertificateRegistry verified successfully!");
    } catch (error) {
      console.warn("✗ CertificateRegistry verification failed or already verified:", error.message);
    }
  }

  console.log("\n=================================================");
  console.log("SafeKosh Deployment Sequence Completed Successfully!");
  console.log("=================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("✗ Deployment failed with error:", error);
    process.exit(1);
  });
