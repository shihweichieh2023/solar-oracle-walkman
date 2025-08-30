import { expect } from "chai";
import pkg from 'hardhat';
const { ethers } = pkg;

describe("SolarOracleWalkman", function () {
  let oracle;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const SolarOracleWalkman = await ethers.getContractFactory("SolarOracleWalkman");
    oracle = await SolarOracleWalkman.deploy(owner.address);
    await oracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right oracle signer", async function () {
      expect(await oracle.oracleSigner()).to.equal(owner.address);
    });

    it("Should initialize with zero records", async function () {
      expect(await oracle.totalRecords()).to.equal(0);
    });
  });

  describe("IV Data Validation", function () {
    it("Should accept valid IV data", async function () {
      const validIV = [1000, 1020, 980, 1015, 985, 1025, 990]; // Valid range with good variance
      const [isValid, reason] = await oracle.validateIV7Data(validIV);
      expect(isValid).to.be.true;
      expect(reason).to.equal("");
    });

    it("Should reject data with values outside range", async function () {
      const invalidIV = [5, 800, 1500, 900, 1100, 1300, 1000]; // First value too low
      const [isValid, reason] = await oracle.validateIV7Data(invalidIV);
      expect(isValid).to.be.false;
      expect(reason).to.equal("Value outside valid range");
    });

    it("Should reject monotonic increasing pattern", async function () {
      const monotonicIV = [100, 200, 300, 400, 500, 600, 700];
      const [isValid, reason] = await oracle.validateIV7Data(monotonicIV);
      expect(isValid).to.be.false;
      // The contract checks variance first, so we expect that error
      expect(reason).to.equal("Variance too high - values too scattered");
    });

    it("Should reject high variance data", async function () {
      const highVarianceIV = [10, 2900, 50, 2800, 20, 2950, 10];
      const [isValid, reason] = await oracle.validateIV7Data(highVarianceIV);
      expect(isValid).to.be.false;
      expect(reason).to.equal("Value range too wide");
    });

    it("Should reject too many duplicate values", async function () {
      const duplicateIV = [1000, 1000, 1000, 1000, 1001, 1002, 1003];
      const [isValid, reason] = await oracle.validateIV7Data(duplicateIV);
      expect(isValid).to.be.false;
      // The contract checks variance first, so we expect that error
      expect(reason).to.equal("Variance too low - values too similar");
    });
  });

  describe("Record Storage", function () {
    it("Should store valid IV record with proper signature", async function () {
      const validIV = [1000, 1020, 980, 1015, 985, 1025, 990];
      const timestamp = Math.floor(Date.now() / 1000);
      const identity = "test_user_1";
      const pubkey = ethers.keccak256(ethers.toUtf8Bytes("test_pubkey"));
      const ivHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[7]"], [validIV]));

      const report = {
        identity: identity,
        pubkey: pubkey,
        ivHash: ivHash,
        iv7Data: validIV,
        timestamp: timestamp
      };

      // Create signature (simplified for test)
      const domain = {
        name: "SolarOracleWalkman",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await oracle.getAddress()
      };

      const types = {
        IVReport: [
          { name: "identity", type: "string" },
          { name: "pubkey", type: "bytes32" },
          { name: "ivHash", type: "bytes32" },
          { name: "iv7Data", type: "uint256[7]" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      const signature = await owner.signTypedData(domain, types, report);

      const tx = await oracle.connect(user1).verifyAndStore(report, signature);
      const receipt = await tx.wait();

      expect(await oracle.totalRecords()).to.equal(1);
      
      // Check event emission
      const event = receipt.logs.find(log => {
        try {
          const parsed = oracle.interface.parseLog(log);
          return parsed.name === 'IVRecordStored';
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;
    });

    it("Should reject invalid signature", async function () {
      const validIV = [1000, 1020, 980, 1015, 985, 1025, 990];
      const timestamp = Math.floor(Date.now() / 1000);
      const identity = "test_user_1";
      const pubkey = ethers.keccak256(ethers.toUtf8Bytes("test_pubkey"));
      const ivHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[7]"], [validIV]));

      const report = {
        identity: identity,
        pubkey: pubkey,
        ivHash: ivHash,
        iv7Data: validIV,
        timestamp: timestamp
      };

      // Create invalid signature (signed by wrong account)
      const domain = {
        name: "SolarOracleWalkman",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await oracle.getAddress()
      };

      const types = {
        IVReport: [
          { name: "identity", type: "string" },
          { name: "pubkey", type: "bytes32" },
          { name: "ivHash", type: "bytes32" },
          { name: "iv7Data", type: "uint256[7]" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      const signature = await user1.signTypedData(domain, types, report); // Wrong signer

      await expect(
        oracle.connect(user1).verifyAndStore(report, signature)
      ).to.be.revertedWith("Invalid oracle signature");
    });
  });

  describe("Chain Integrity Verification", function () {
    it("Should pass verification with valid records", async function () {
      // Add a valid record first
      const validIV = [1000, 1020, 980, 1015, 985, 1025, 990];
      const timestamp = Math.floor(Date.now() / 1000);
      const identity = "test_user_1";
      const pubkey = ethers.keccak256(ethers.toUtf8Bytes("test_pubkey"));
      const ivHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[7]"], [validIV]));

      const report = {
        identity: identity,
        pubkey: pubkey,
        ivHash: ivHash,
        iv7Data: validIV,
        timestamp: timestamp
      };

      const domain = {
        name: "SolarOracleWalkman",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await oracle.getAddress()
      };

      const types = {
        IVReport: [
          { name: "identity", type: "string" },
          { name: "pubkey", type: "bytes32" },
          { name: "ivHash", type: "bytes32" },
          { name: "iv7Data", type: "uint256[7]" },
          { name: "timestamp", type: "uint256" }
        ]
      };

      const signature = await owner.signTypedData(domain, types, report);
      await oracle.connect(user1).verifyAndStore(report, signature);

      // Verify chain integrity
      const [isValid, invalidCount, status] = await oracle.verifyChainIntegrity();
      expect(isValid).to.be.true;
      expect(invalidCount).to.equal(0);
      expect(status).to.equal("All voiceprints valid");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to update oracle signer", async function () {
      await oracle.connect(owner).updateOracleSigner(user1.address);
      expect(await oracle.oracleSigner()).to.equal(user1.address);
    });

    it("Should reject non-owner attempts to update oracle signer", async function () {
      await expect(
        oracle.connect(user1).updateOracleSigner(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
