# 🚀 How to Deploy IVFakeChainOracle.sol On-Chain

## Method 1: Remix IDE (Easiest - No Local Setup)

### Step 1: Open Remix IDE
1. Go to https://remix.ethereum.org/
2. Create a new file: `IVFakeChainOracle.sol`
3. Copy the entire contract code from our file

### Step 2: Install Dependencies
1. In Remix, go to "File Explorer" → ".deps" → "npm"
2. Install OpenZeppelin contracts:
   - Click "+" next to npm
   - Add: `@openzeppelin/contracts@4.9.0`

### Step 3: Compile
1. Go to "Solidity Compiler" tab
2. Select compiler version: `0.8.20`
3. Click "Compile IVFakeChainOracle.sol"

### Step 4: Deploy
1. Go to "Deploy & Run Transactions" tab
2. Select environment:
   - **Remix VM**: For testing (free, local simulation)
   - **Injected Provider**: For MetaMask (real networks)
3. Select contract: `IVFakeChainOracle`
4. Enter constructor parameter: Your oracle signer address
5. Click "Deploy"

### Step 5: Interact
- Use the deployed contract interface to call functions
- Test `validateIV7Data` with sample data
- Store IV records with `verifyAndStore`

---

## Method 2: Using Hardhat (Local Development)

### Prerequisites
```bash
# Update Node.js to version 18+ first
nvm install 18
nvm use 18
```

### Installation
```bash
cd solidity-oracle
npm install
```

### Compile
```bash
npx hardhat compile
```

### Deploy to Local Network
```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Terminal 2: Deploy contract
npx hardhat run scripts/deploy.js --network localhost
```

### Run Tests
```bash
npx hardhat test
```

---

## Method 3: Deploy to Testnets (Sepolia, Goerli)

### Setup Network Configuration
Add to `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY]
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

### Create .env file
```bash
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_wallet_private_key
```

### Deploy to Testnet
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Method 4: Deploy to Mainnet

### Production Configuration
```javascript
mainnet: {
  url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
  accounts: [process.env.PRIVATE_KEY],
  gasPrice: 20000000000, // 20 gwei
}
```

### Deploy to Mainnet
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

---

## 🧪 Testing Your Deployed Contract

### Sample IV Data for Testing

**Valid IV Data** (scaled by 1000):
```javascript
[1200, 800, 1500, 900, 1100, 1300, 1000]
```

**Invalid IV Data** (will be rejected):
```javascript
[5, 800, 1500, 900, 1100, 1300, 1000]  // Too low
[15000, 800, 1500, 900, 1100, 1300, 1000]  // Too high
[100, 300, 500, 700, 900, 1100, 1300]  // Monotonic
```

### Contract Interaction Examples

```javascript
// Validate IV data
const [isValid, reason] = await contract.validateIV7Data([1200, 800, 1500, 900, 1100, 1300, 1000]);

// Check total records
const totalRecords = await contract.totalRecords();

// Verify chain integrity
const [chainValid, invalidCount, status] = await contract.verifyChainIntegrity();
```

---

## 📊 Gas Costs (Approximate)

- **Deployment**: ~2,500,000 gas
- **validateIV7Data**: ~50,000 gas
- **verifyAndStore**: ~150,000 gas
- **verifyChainIntegrity**: ~100,000 gas per record

---

## 🔧 Troubleshooting

### Common Issues:

1. **"Insufficient funds"**: Ensure wallet has enough ETH for gas
2. **"Invalid signature"**: Check oracle signer address matches
3. **"Validation failed"**: IV data doesn't meet validation criteria
4. **"Contract not deployed"**: Verify deployment transaction succeeded

### Verification on Etherscan:
```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS ORACLE_SIGNER_ADDRESS
```

---

## 🎯 Quick Start (Remix Method)

1. **Copy contract code** → Remix IDE
2. **Install @openzeppelin/contracts@4.9.0**
3. **Compile with Solidity 0.8.20**
4. **Deploy with your address as oracle signer**
5. **Test with sample IV data**

This gets you running on-chain in under 10 minutes! 🚀
