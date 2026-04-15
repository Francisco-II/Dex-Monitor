const hre = require("hardhat");

async function main() {
  console.log("Deploying DexMonitor contract...");

  const DexMonitor = await hre.ethers.getContractFactory("DexMonitor");
  const dexMonitor = await DexMonitor.deploy();

  await dexMonitor.waitForDeployment();

  const address = await dexMonitor.getAddress();
  console.log(`DexMonitor deployed to: ${address}`);
  console.log("Copy this address into your .env file as CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});