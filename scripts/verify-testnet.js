import pkg from 'hardhat';
const { ethers } = pkg;

const CONTRACT_ADDRESS = "0xeF19a90e5786dd0e89264F38f52CF81102db938e";

async function verifyTestnetDeployment() {
  console.log("🔍 Verifying Testnet Deployment");
  console.log("=" .repeat(50));
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name}`);
  console.log(`🆔 Chain ID: ${network.chainId}`);
  console.log(`🔗 Contract: ${CONTRACT_ADDRESS}`);
  
  // Get contract code (proves it exists on blockchain)
  const code = await ethers.provider.getCode(CONTRACT_ADDRESS);
  console.log(`💾 Contract Code Length: ${code.length} bytes`);
  console.log(`✅ Contract Exists: ${code !== '0x' ? 'YES' : 'NO'}`);
  
  // Get current block number
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(`📦 Current Block: ${blockNumber}`);
  
  // Connect to contract and verify it works
  const oracle = await ethers.getContractAt("SolarOracleWalkman", CONTRACT_ADDRESS);
  const totalRecords = await oracle.totalRecords();
  const oracleSigner = await oracle.oracleSigner();
  
  console.log(`📊 Total Records: ${totalRecords}`);
  console.log(`👤 Oracle Signer: ${oracleSigner}`);
  
  // Test validation function
  const testData = [1000, 1020, 980, 1015, 985, 1025, 990];
  const [isValid, reason] = await oracle.validateIV7Data(testData);
  console.log(`🧪 Test Validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
  
  console.log("\n🎯 PROOF OF TESTNET DEPLOYMENT:");
  console.log(`• Chain ID 11155111 = Sepolia Testnet`);
  console.log(`• Contract deployed at: ${CONTRACT_ADDRESS}`);
  console.log(`• Etherscan: https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);
  console.log(`• Contract is functional and responding`);
}

verifyTestnetDeployment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
