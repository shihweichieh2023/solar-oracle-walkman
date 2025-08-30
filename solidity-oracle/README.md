# IV FakeChain Oracle - Solidity Smart Contract

This is the Solidity smart contract version of the Python FakeChain IV server, converted to run on-chain with enhanced security validation.

## 🔒 Features

- **Comprehensive IV Validation**: All Python validation logic converted to Solidity
- **EIP-712 Signatures**: Secure oracle signature verification
- **On-chain Storage**: Immutable IV voiceprint records
- **Chain Integrity**: Oracle verification of entire chain validity
- **Access Control**: Owner-managed oracle signer updates

## 📁 Project Structure

```
solidity-oracle/
├── contracts/
│   └── IVFakeChainOracle.sol    # Main oracle contract
├── scripts/
│   └── deploy.js                # Deployment script
├── test/
│   └── IVFakeChainOracle.test.js # Test suite
├── hardhat.config.js            # Hardhat configuration
└── package.json                 # Dependencies
```

## 🛡️ Validation Rules (Converted from Python)

1. **Range Validation**: Values must be between 0.01-3.0 (scaled by 1000 in contract)
2. **Statistical Analysis**: Variance checks for realistic IV curves
3. **Pattern Detection**: Blocks monotonic sequences
4. **Duplicate Detection**: Ensures sufficient unique values
5. **Alternation Limits**: Prevents extreme value jumps

## 🚀 Installation & Setup

```bash
cd solidity-oracle

# Install dependencies (requires Node.js 18+)
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy### Step 1: Test the Contract
```bash
# Run the comprehensive test suite on Sepolia testnet
npx hardhat run scripts/test-contract.js --network sepolia
```

## 📋 Usage

### Deploy Contract
```javascript
const oracle = await IVFakeChainOracle.deploy(oracleSignerAddress);
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

const signature = await signer._signTypedData(domain, types, report);
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

Configure in `hardhat.config.js`:
- **Hardhat**: Local testing
- **Localhost**: Local node
- **Mainnet/Testnet**: Add network configs

## 🔐 Security Features

1. **EIP-712 Typed Signatures**: Prevents signature replay attacks
2. **Nonce Protection**: Each IV hash can only be used once
3. **Timestamp Validation**: Prevents stale data submission
4. **Comprehensive Validation**: All Python security rules implemented
5. **Owner Controls**: Upgradeable oracle signer

## 📊 Gas Optimization

- Scaled integers (×1000) for precision without floating point
- Efficient validation algorithms
- Minimal storage patterns
- Event-based indexing

## 🔄 Migration from Python

The Solidity contract maintains full compatibility with the Python server's validation logic while adding blockchain-native features:

- **Same validation rules** as Python implementation
- **Enhanced security** with cryptographic signatures
- **Immutable storage** on blockchain
- **Decentralized verification** via smart contract
