# 🔗 Solar Oracle Walkman - IV Voiceprint Smart Contract

A blockchain-based smart contract that validates and stores IV voiceprint data securely on the Ethereum network. Think of it as a digital notary that checks if voice data is genuine and keeps permanent records.

## 🔒 Features

- **Comprehensive IV Validation**: Advanced security validation for voiceprint data
- **EIP-712 Signatures**: Secure oracle signature verification
- **On-chain Storage**: Immutable IV voiceprint records
- **Chain Integrity**: Oracle verification of entire chain validity
- **Access Control**: Owner-managed oracle signer updates

## 📁 Project Structure

```
solar-oracle-walkman/
├── contracts/
│   └── SolarOracleWalkman.sol    # The main smart contract code
├── scripts/
│   ├── deploy.js                # Script to deploy contract to blockchain
│   ├── test-contract.js         # Script to test the contract works
│   └── verify-testnet.js        # Script to verify deployment
├── test/
│   └── SolarOracleWalkman.test.js # Comprehensive test suite
├── hardhat.config.cjs           # Configuration for development tools
├── package.json                 # List of required software packages
├── .nvmrc                       # Node.js version specification
├── DEPLOYMENT_GUIDE.md          # Detailed deployment instructions
└── README.md                    # This file
```

## 🛡️ Security Validation Rules

1. **Range Validation**: Values must be between 0.01-3.0 (scaled by 1000 in contract)
2. **Statistical Analysis**: Variance checks for realistic IV curves
3. **Pattern Detection**: Blocks monotonic sequences
4. **Duplicate Detection**: Ensures sufficient unique values
5. **Alternation Limits**: Prevents extreme value jumps

## 🚀 Installation & Setup

### Step 1: Install Dependencies
```bash
# Install dependencies (requires Node.js 18+)
npm install
```

### Step 2: Compile the Smart Contract
```bash
# This converts the Solidity code into bytecode that can run on blockchain
npx hardhat compile
```
**What this does**: Translates human-readable contract code into machine code

### Step 3: Set up Environment Variables
Create a `.env` file in the project root:
```bash
INFURA_API_KEY=your_infura_project_id
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Step 4: Deploy Contract to Sepolia Testnet
```bash
# Deploy to the live Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```
**What this does**: Puts your smart contract onto the real Sepolia blockchain and gives it an address

### Step 5: Test the Contract
```bash
# Run the comprehensive test suite on Sepolia testnet
npx hardhat run scripts/test-contract.js --network sepolia
```

## 📋 Usage

### Deploy Contract
```javascript
const oracle = await SolarOracleWalkman.deploy(oracleSignerAddress);
```

### Validate IV Data
```javascript
const [isValid, reason] = await oracle.validateIV7Data([1200, 800, 1500, 900, 1100, 1300, 1000]);
```

### Store IV Record
```javascript
const report = {
    identity: "user_123",
    pubkey: "0x...",
    ivHash: "0x...",
    iv7Data: [1200, 800, 1500, 900, 1100, 1300, 1000],
    timestamp: Math.floor(Date.now() / 1000)
};

const signature = await signer.signTypedData(domain, types, report);
const txId = await oracle.verifyAndStore(report, signature);
```

### Verify Chain Integrity
```javascript
const [isValid, invalidCount, status] = await oracle.verifyChainIntegrity();
```

## 🔧 Configuration

- **Oracle Signer**: Address authorized to sign IV reports
- **Max Staleness**: Maximum age of reports (default: 10 minutes)
- **Validation Parameters**: All thresholds configurable via constants

## 🧪 Testing

The test suite covers:
- ✅ Valid IV data acceptance
- ❌ Invalid data rejection (6 attack scenarios)
- 🔐 Signature verification
- 📊 Chain integrity verification
- 🛡️ Access control

Run tests: `npx hardhat test`

## 🌐 Deployment Networks

Configure in `hardhat.config.cjs`:
- **Hardhat**: Local testing
- **Localhost**: Local node
- **Mainnet/Testnet**: Add network configs

## 🔐 Security Features

1. **EIP-712 Typed Signatures**: Prevents signature replay attacks
2. **Nonce Protection**: Each IV hash can only be used once
3. **Timestamp Validation**: Prevents stale data submission
4. **Comprehensive Validation**: Advanced security rules implemented
5. **Owner Controls**: Upgradeable oracle signer

## 📊 Gas Optimization

- Scaled integers (×1000) for precision without floating point
- Efficient validation algorithms
- Minimal storage patterns
- Event-based indexing

## 🌐 Live Deployment

The SolarOracleWalkman contract is currently deployed on Sepolia testnet:

- **Contract Address**: `0xeF19a90e5786dd0e89264F38f52CF81102db938e`
- **Network**: Sepolia Testnet (Chain ID: 11155111)
- **Etherscan**: https://sepolia.etherscan.io/address/0xeF19a90e5786dd0e89264F38f52CF81102db938e
- **Status**: ✅ Active and verified

## 🎯 Next Steps

1. **Run the tests** to see everything working
2. **Try modifying test data** to see security in action
3. **Deploy to testnet** for real blockchain experience
4. **Integrate with your application** using the contract address

The contract is now ready to validate and store IV voiceprint data securely on the blockchain!
