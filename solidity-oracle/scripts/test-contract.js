import pkg from 'hardhat';
const { ethers } = pkg;

// Contract address on Sepolia testnet
const CONTRACT_ADDRESS = "0x38608A02e888D6E60919FF1fCe1cce31F01465d5";

// EIP-712 domain and types for signing - will be set dynamically
let DOMAIN;

const TYPES = {
  IVReport: [
    { name: "identity", type: "string" },
    { name: "pubkey", type: "bytes32" },
    { name: "ivHash", type: "bytes32" },
    { name: "iv7Data", type: "uint256[7]" },
    { name: "timestamp", type: "uint256" }
  ]
};

function generateFake7DVoiceprint() {
  // Generate 7 values with very precise variance targeting ~100-200 range
  // Need to be extremely careful with variance calculation
  
  return [
    1000,  // 1.0
    1020,  // 1.02 (+20)
    980,   // 0.98 (-40 from 1020, non-monotonic)
    1015,  // 1.015 (+35)
    985,   // 0.985 (-30)
    1025,  // 1.025 (+40)
    990    // 0.99 (-35)
  ];
  
  // Analysis:
  // - Range: 980-1025 = 45 (well under 2500 limit) ✓
  // - All values 10-3000 ✓ 
  // - Non-monotonic pattern ✓
  // - 7 unique values ✓
  // - Small differences (20-40) ✓
  // - Mean ≈ 1002, variance should be much smaller ✓
}

function generateBadVoiceprint() {
  // Generate bad voiceprint with values outside valid range
  return [
    50,    // 0.05 - too low
    3500,  // 3.5 - too high
    10,    // 0.01 - at minimum boundary
    4000,  // 4.0 - way too high
    80,    // 0.08 - low
    5000,  // 5.0 - extremely high
    30     // 0.03 - too low
  ];
}

function generateMonotonicVoiceprint() {
  // Generate monotonic increasing pattern (should be rejected)
  return [100, 200, 300, 400, 500, 600, 700];
}

async function signIVReport(signer, report) {
  // Create the exact hash that the contract expects
  const TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes("IVReport(string identity,bytes32 pubkey,bytes32 ivHash,uint256[7] iv7Data,uint256 timestamp)"));
  
  // Create struct hash exactly as contract does: abi.encode with abi.encodePacked for iv7Data
  const structHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "uint256"],
    [
      TYPEHASH,
      ethers.keccak256(ethers.toUtf8Bytes(report.identity)),
      report.pubkey,
      report.ivHash,
      ethers.keccak256(ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], report.iv7Data)),
      report.timestamp
    ]
  ));
  
  // Use the contract's _hashTypedDataV4 equivalent
  const domainSeparator = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      ethers.keccak256(ethers.toUtf8Bytes(DOMAIN.name)),
      ethers.keccak256(ethers.toUtf8Bytes(DOMAIN.version)),
      DOMAIN.chainId,
      DOMAIN.verifyingContract
    ]
  ));
  
  const digest = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19\x01"),
    domainSeparator,
    structHash
  ]));
  
  return await signer.signMessage(ethers.getBytes(digest));
}

async function testValidVoiceprint(contract, signer) {
  console.log("\n🧪 Testing VALID voiceprint...");
  
  const identity = `test_user_${Date.now()}`;
  const pubkey = ethers.keccak256(ethers.toUtf8Bytes(identity));
  const iv7Data = generateFake7DVoiceprint();
  const ivHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[7]"], [iv7Data]));
  // Use current timestamp to avoid staleness issues
  const timestamp = Math.floor(Date.now() / 1000);
  
  console.log(`   Identity: ${identity}`);
  console.log(`   7-D data: ${iv7Data.map(v => (v/1000).toFixed(3))}`);
  
  const report = {
    identity,
    pubkey,
    ivHash,
    iv7Data,
    timestamp
  };
  
  try {
    // First validate the data
    const [isValid, reason] = await contract.validateIV7Data(iv7Data);
    console.log(`   Validation: ${isValid ? '✅ VALID' : '❌ INVALID'} ${reason || ''}`);
    
    if (!isValid) {
      return false;
    }
    
    // Sign the report
    const signature = await signIVReport(signer, report);
    console.log(`   Signature: ${signature.slice(0, 20)}...`);
    
    // Debug: Check contract state before transaction
    const oracleSigner = await contract.oracleSigner();
    console.log(`   Oracle signer: ${oracleSigner}`);
    console.log(`   Actual signer: ${signer.address}`);
    
    // Submit to contract with better error handling
    try {
      const tx = await contract.verifyAndStore(report, signature);
      const receipt = await tx.wait();
      
      console.log(`   ✅ Transaction successful!`);
      console.log(`   TX Hash: ${receipt.hash}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
      // Get the transaction ID from events
      const event = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'IVRecordStored';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsed = contract.interface.parseLog(event);
        console.log(`   Record ID: ${parsed.args.txId}`);
        return parsed.args.txId;
      }
      
      return true;
      
    } catch (txError) {
      // Try to get more detailed error information
      console.log(`   ❌ Transaction failed: ${txError.message}`);
      
      // Try calling the function statically to get the revert reason
      try {
        await contract.verifyAndStore.staticCall(report, signature);
      } catch (staticError) {
        console.log(`   📋 Revert reason: ${staticError.message}`);
      }
      
      return false;
    }
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function testInvalidVoiceprint(contract, signer, testType = "bad_range") {
  console.log(`\n🧪 Testing INVALID voiceprint (${testType})...`);
  
  const identity = `bad_user_${Date.now()}`;
  const pubkey = ethers.keccak256(ethers.toUtf8Bytes(identity));
  
  let iv7Data;
  switch (testType) {
    case "bad_range":
      iv7Data = generateBadVoiceprint();
      break;
    case "monotonic":
      iv7Data = generateMonotonicVoiceprint();
      break;
    default:
      iv7Data = generateBadVoiceprint();
  }
  
  const ivHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[7]"], [iv7Data]));
  const timestamp = Math.floor(Date.now() / 1000);
  
  console.log(`   Identity: ${identity}`);
  console.log(`   7-D data: ${iv7Data.map(v => (v/1000).toFixed(3))}`);
  
  try {
    // First validate the data
    const [isValid, reason] = await contract.validateIV7Data(iv7Data);
    console.log(`   Validation: ${isValid ? '✅ VALID' : '❌ INVALID'} - ${reason}`);
    
    if (isValid) {
      console.log(`   ⚠️  Unexpected: This should have been invalid!`);
      return false;
    } else {
      console.log(`   ✅ Correctly rejected invalid voiceprint`);
      return true;
    }
    
  } catch (error) {
    console.log(`   ❌ Error during validation: ${error.message}`);
    return false;
  }
}

async function verifyChainIntegrity(contract) {
  console.log("\n🔍 Verifying chain integrity...");
  
  try {
    const [isValid, invalidCount, status] = await contract.verifyChainIntegrity();
    console.log(`   Chain valid: ${isValid ? '✅ YES' : '❌ NO'}`);
    console.log(`   Invalid records: ${invalidCount.toString()}`);
    console.log(`   Status: ${status}`);
    
    const totalRecords = await contract.totalRecords();
    console.log(`   Total records: ${totalRecords.toString()}`);
    
    return isValid;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function getRecordDetails(contract, txId) {
  console.log(`\n📋 Retrieving record details...`);
  
  try {
    const record = await contract.getRecord(txId);
    console.log(`   Identity: ${record.identity}`);
    console.log(`   Public key: ${record.pubkey}`);
    console.log(`   IV hash: ${record.ivHash}`);
    console.log(`   7-D data: ${record.iv7Data.map(v => (Number(v)/1000).toFixed(3))}`);
    console.log(`   Timestamp: ${new Date(Number(record.timestamp) * 1000).toISOString()}`);
    console.log(`   Block: ${record.blockNumber.toString()}`);
    console.log(`   Valid: ${record.isValid ? '✅' : '❌'}`);
    
    return record;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("🚀 FakeChain IV Oracle Contract Test - Sepolia Testnet");
  console.log("=".repeat(60));
  
  // Get network info and verify we're on Sepolia
  const network = await ethers.provider.getNetwork();
  
  if (network.chainId !== 11155111n) {
    throw new Error(`This test only works on Sepolia testnet (Chain ID: 11155111). Current network: ${network.chainId}. Use: --network sepolia`);
  }
  
  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer/Oracle signer: ${deployer.address}`);
  console.log(`Network: Sepolia Testnet (Chain ID: ${network.chainId})`);
  console.log(`Contract address: ${CONTRACT_ADDRESS}`);
  
  // Connect to deployed contract
  const IVFakeChainOracle = await ethers.getContractFactory("IVFakeChainOracle");
  const contract = IVFakeChainOracle.attach(CONTRACT_ADDRESS);
  
  // Set up EIP-712 domain with correct chain ID
  DOMAIN = {
    name: "IVFakeChainOracle",
    version: "1",
    chainId: Number(network.chainId),
    verifyingContract: CONTRACT_ADDRESS
  };
  
  // Verify contract is working
  const totalRecords = await contract.totalRecords();
  console.log(`Initial total records: ${totalRecords.toString()}`);
  
  let testResults = {
    validTest: false,
    invalidRangeTest: false,
    invalidMonotonicTest: false,
    chainIntegrityTest: false
  };
  
  // Test 1: Valid voiceprint
  const validResult = await testValidVoiceprint(contract, deployer);
  testResults.validTest = !!validResult;
  
  // Test 2: Invalid voiceprint (bad range)
  testResults.invalidRangeTest = await testInvalidVoiceprint(contract, deployer, "bad_range");
  
  // Test 3: Invalid voiceprint (monotonic)
  testResults.invalidMonotonicTest = await testInvalidVoiceprint(contract, deployer, "monotonic");
  
  // Test 4: Chain integrity
  testResults.chainIntegrityTest = await verifyChainIntegrity(contract);
  
  // Get record details if we have a valid transaction
  if (validResult && typeof validResult === 'string') {
    await getRecordDetails(contract, validResult);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Valid voiceprint test: ${testResults.validTest ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Invalid range test: ${testResults.invalidRangeTest ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Invalid monotonic test: ${testResults.invalidMonotonicTest ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Chain integrity test: ${testResults.chainIntegrityTest ? 'PASSED' : 'FAILED'}`);
  
  const allPassed = Object.values(testResults).every(result => result);
  console.log(`\n🎉 Overall result: ${allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED'}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
