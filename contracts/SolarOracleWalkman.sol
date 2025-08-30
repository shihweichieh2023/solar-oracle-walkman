// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SolarOracleWalkman
 * @dev Enhanced IV curve voiceprint oracle with comprehensive validation
 * Converts Python FakeChain server logic to on-chain smart contract
 */
contract SolarOracleWalkman is EIP712, Ownable {
    using ECDSA for bytes32;

    // Oracle configuration
    address public oracleSigner;
    uint256 public maxStaleness = 10 minutes;
    
    // Validation parameters (scaled by 1000 for precision)
    uint256 public constant MIN_VALUE = 10;    // 0.01 * 1000
    uint256 public constant MAX_VALUE = 3000;  // 3.0 * 1000
    uint256 public constant MIN_VARIANCE = 50;  // 0.05 * 1000
    uint256 public constant MAX_VARIANCE = 1200; // 1.2 * 1000
    uint256 public constant MAX_RANGE = 2500;   // 2.5 * 1000
    uint256 public constant MAX_ALTERNATIONS = 3;
    uint256 public constant MIN_UNIQUE_VALUES = 4;

    // Storage
    mapping(bytes32 => bool) public usedIvHash;
    mapping(bytes32 => IVRecord) public ivRecords;
    mapping(address => bytes32[]) public userRecords;
    
    uint256 public totalRecords;
    bytes32[] public allRecords;

    struct IVRecord {
        string identity;
        bytes32 pubkey;
        bytes32 ivHash;
        uint256[7] iv7Data;      // Scaled by 1000 for precision
        uint256 timestamp;
        uint256 blockNumber;
        bool isValid;
    }

    struct IVReport {
        string identity;
        bytes32 pubkey;
        bytes32 ivHash;
        uint256[7] iv7Data;      // Raw IV data scaled by 1000
        uint256 timestamp;
    }

    // Events
    event IVRecordStored(
        bytes32 indexed txId,
        bytes32 indexed ivHash,
        string identity,
        bytes32 pubkey,
        address caller
    );
    
    event ValidationFailed(
        bytes32 indexed ivHash,
        string reason,
        address caller
    );

    bytes32 private constant TYPEHASH =
        keccak256("IVReport(string identity,bytes32 pubkey,bytes32 ivHash,uint256[7] iv7Data,uint256 timestamp)");

    constructor(address _signer) EIP712("SolarOracleWalkman", "1") {
        oracleSigner = _signer;
    }

    /**
     * @dev Validate 7-D IV voiceprint data with comprehensive checks
     * @param iv7Data Array of 7 IV values (scaled by 1000)
     * @return isValid Whether the data passes validation
     * @return reason Reason for validation failure (if any)
     */
    function validateIV7Data(uint256[7] memory iv7Data) 
        public 
        pure 
        returns (bool isValid, string memory reason) 
    {
        // Range validation
        for (uint i = 0; i < 7; i++) {
            if (iv7Data[i] < MIN_VALUE || iv7Data[i] > MAX_VALUE) {
                return (false, "Value outside valid range");
            }
        }

        // Calculate statistics
        uint256 sum = 0;
        uint256 min = iv7Data[0];
        uint256 max = iv7Data[0];
        
        for (uint i = 0; i < 7; i++) {
            sum += iv7Data[i];
            if (iv7Data[i] < min) min = iv7Data[i];
            if (iv7Data[i] > max) max = iv7Data[i];
        }
        
        uint256 mean = sum / 7;
        uint256 range = max - min;

        // Range check
        if (range > MAX_RANGE) {
            return (false, "Value range too wide");
        }

        // Calculate variance (simplified)
        uint256 varianceSum = 0;
        for (uint i = 0; i < 7; i++) {
            uint256 diff = iv7Data[i] > mean ? iv7Data[i] - mean : mean - iv7Data[i];
            varianceSum += diff * diff;
        }
        uint256 variance = varianceSum / 7;

        // Variance checks
        if (variance < MIN_VARIANCE) {
            return (false, "Variance too low - values too similar");
        }
        if (variance > MAX_VARIANCE) {
            return (false, "Variance too high - values too scattered");
        }

        // Monotonic pattern check
        bool isIncreasing = true;
        bool isDecreasing = true;
        
        for (uint i = 0; i < 6; i++) {
            if (iv7Data[i] > iv7Data[i + 1]) isIncreasing = false;
            if (iv7Data[i] < iv7Data[i + 1]) isDecreasing = false;
        }
        
        if (isIncreasing) {
            return (false, "Monotonic increasing pattern detected");
        }
        if (isDecreasing) {
            return (false, "Monotonic decreasing pattern detected");
        }

        // Count unique values (simplified check)
        uint256 uniqueCount = 0;
        bool[7] memory counted;
        
        for (uint i = 0; i < 7; i++) {
            if (!counted[i]) {
                uniqueCount++;
                for (uint j = i + 1; j < 7; j++) {
                    if (iv7Data[i] == iv7Data[j]) {
                        counted[j] = true;
                    }
                }
            }
        }
        
        if (uniqueCount < MIN_UNIQUE_VALUES) {
            return (false, "Too many duplicate values");
        }

        // Check for extreme alternations
        uint256 alternations = 0;
        for (uint i = 0; i < 6; i++) {
            uint256 diff = iv7Data[i] > iv7Data[i + 1] ? 
                iv7Data[i] - iv7Data[i + 1] : 
                iv7Data[i + 1] - iv7Data[i];
            if (diff > 1500) { // 1.5 * 1000
                alternations++;
            }
        }
        
        if (alternations > MAX_ALTERNATIONS) {
            return (false, "Too many extreme value alternations");
        }

        return (true, "");
    }

    /**
     * @dev Verify signature and store IV record on-chain
     * @param report The IV report data
     * @param signature Oracle signature
     * @return txId Transaction ID for tracking
     */
    function verifyAndStore(IVReport calldata report, bytes calldata signature) 
        external 
        returns (bytes32 txId) 
    {
        // Freshness check
        require(
            block.timestamp >= report.timestamp && 
            block.timestamp - report.timestamp <= maxStaleness, 
            "Report too stale"
        );
        
        // Duplicate check
        require(!usedIvHash[report.ivHash], "IV hash already used");

        // Validate IV data
        (bool isValid, string memory reason) = validateIV7Data(report.iv7Data);
        if (!isValid) {
            emit ValidationFailed(report.ivHash, reason, msg.sender);
            revert(string(abi.encodePacked("Validation failed: ", reason)));
        }

        // Verify signature
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                TYPEHASH,
                keccak256(bytes(report.identity)),
                report.pubkey,
                report.ivHash,
                keccak256(abi.encodePacked(report.iv7Data)),
                report.timestamp
            ))
        );

        address signer = ECDSA.recover(digest, signature);
        require(signer == oracleSigner, "Invalid oracle signature");

        // Generate transaction ID
        txId = keccak256(abi.encodePacked(
            report.ivHash, 
            block.number, 
            block.timestamp,
            msg.sender
        ));

        // Store record
        usedIvHash[report.ivHash] = true;
        ivRecords[txId] = IVRecord({
            identity: report.identity,
            pubkey: report.pubkey,
            ivHash: report.ivHash,
            iv7Data: report.iv7Data,
            timestamp: report.timestamp,
            blockNumber: block.number,
            isValid: true
        });

        // Update indexes
        userRecords[msg.sender].push(txId);
        allRecords.push(txId);
        totalRecords++;

        emit IVRecordStored(txId, report.ivHash, report.identity, report.pubkey, msg.sender);
        
        return txId;
    }

    /**
     * @dev Verify chain integrity (oracle function)
     * @return isValid Whether the entire chain is valid
     * @return invalidCount Number of invalid records found
     */
    function verifyChainIntegrity() 
        external 
        view 
        returns (bool isValid, uint256 invalidCount, string memory status) 
    {
        invalidCount = 0;
        
        for (uint i = 0; i < allRecords.length; i++) {
            bytes32 txId = allRecords[i];
            IVRecord memory record = ivRecords[txId];
            
            // Re-validate stored data
            (bool recordValid,) = validateIV7Data(record.iv7Data);
            if (!recordValid) {
                invalidCount++;
            }
        }

        if (invalidCount > 0) {
            return (false, invalidCount, "Invalid voiceprints detected in chain");
        }
        
        return (true, 0, "All voiceprints valid");
    }

    /**
     * @dev Get IV record by transaction ID
     */
    function getRecord(bytes32 txId) 
        external 
        view 
        returns (IVRecord memory) 
    {
        return ivRecords[txId];
    }

    /**
     * @dev Get user's records
     */
    function getUserRecords(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userRecords[user];
    }

    /**
     * @dev Update oracle signer (owner only)
     */
    function updateOracleSigner(address newSigner) external onlyOwner {
        oracleSigner = newSigner;
    }

    /**
     * @dev Update staleness limit (owner only)
     */
    function updateMaxStaleness(uint256 newStaleness) external onlyOwner {
        maxStaleness = newStaleness;
    }
}
