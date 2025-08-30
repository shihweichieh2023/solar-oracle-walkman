import pkg from 'hardhat';
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy the IVFakeChainOracle contract
  const IVFakeChainOracle = await ethers.getContractFactory("IVFakeChainOracle");
  
  // Use deployer as oracle signer for demo (in production, use a dedicated oracle key)
  const oracle = await IVFakeChainOracle.deploy(deployer.address);
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  console.log("IVFakeChainOracle deployed to:", oracleAddress);
  console.log("Oracle signer set to:", deployer.address);

  // Verify deployment
  const totalRecords = await oracle.totalRecords();
  console.log("Initial total records:", totalRecords.toString());

  return oracleAddress;
}

main()
  .then((address) => {
    console.log("\n🎉 Deployment successful!");
    console.log("Contract address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
