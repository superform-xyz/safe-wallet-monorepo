# Superform Cross-Chain Safe Signature Integration

This document explains the complete implementation for Superform's cross-chain signature validation within the Safe wallet ecosystem. The integration provides direct signature generation compatible with Superform's custom EIP-712 domain structure and Solidity validation contracts.

## Architecture Overview

### The Problem
Superform requires cross-chain signature validation where signatures created on one chain can be validated on any other chain. Standard Safe signatures use the current chain's `chainId` in their EIP-712 domain, making them chain-specific and incompatible with cross-chain validation.

### The Solution
A **direct signature generation system** that creates signatures compatible with Superform's validation contracts:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Superform App  │───▶│ Internal Signing │───▶│  personal_sign +    │
│                 │    │     Hook         │    │   v adjustment      │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │
                                ▼
                       ┌─────────────────────┐
                       │ Cross-Chain Valid   │
                       │ Signature (v>30)    │
                       └─────────────────────┘
```

## Core Implementation Architecture

### 1. Direct Internal Signing Hook
**File**: `apps/web/src/hooks/useSuperformInternalSigning.ts`

The primary implementation uses a direct signing approach that bypasses Safe's standard signature flow:

```typescript
export const useSuperformInternalSigning = () => {
  return {
    async signSuperformMessage(rawHash: string, safeAddress: string) {
      // 1. Build Superform EIP-712 structure
      const superformTypedData = generateSuperformSafeMessageTypedData(safeAddress, rawHash)
      
      // 2. Generate chain-agnostic hash (matching Solidity)
      const chainAgnosticHash = _TypedDataEncoder.hash(
        superformTypedData.domain,
        superformTypedData.types,
        superformTypedData.message
      )
      
      // 3. Sign with personal_sign (prefixed signing)
      const signature = await provider.send('personal_sign', [chainAgnosticHash, await signer.getAddress()])
      
      // 4. Adjust v value for Safe compatibility (v > 30)
      const adjustedSignature = adjustVForSafeCompatibility(signature)
      
      return { signature: adjustedSignature, messageHash: chainAgnosticHash }
    }
  }
}
```

### 2. Signature Method Selection
**File**: `apps/web/src/hooks/useSuperformInternalSigning.ts`

The implementation uses `personal_sign` with v value adjustment for Safe's signature validation:

```typescript
// Use personal_sign (prefixed signing) and adjust v value for Safe compatibility
const signature = await provider.send('personal_sign', [eip712Hash, await signer.getAddress()])

// Parse signature components and adjust v value for Safe compatibility
const sig = Signature.from(signature)
const adjustedV = sig.v + 4  // v = 31 or 32 for Safe's prefixed detection

// Manually construct signature bytes since ethers.js doesn't accept v=31/32
const adjustedSignature = hexlify(concatBytes([
  sig.r,
  sig.s,
  toBeHex(adjustedV, 1)
]))
```

### 3. Domain Structure Generation
**File**: `packages/utils/src/utils/superform-safe-messages.ts`

The system generates Superform's exact EIP-712 structure:

```typescript
export const generateSuperformSafeMessageTypedData = (
  safeAddress: string,
  rawHash: string,
): TypedData => {
  return {
    domain: {
      name: 'SuperformSafe',           // ← Custom domain name
      version: '1.0.0',
      chainId: 1,                      // ← Fixed for cross-chain compatibility
      verifyingContract: safeAddress,
    },
    types: {
      SafeMessage: [{ name: 'message', type: 'bytes' }],
    },
    message: {
      message: keccak256(abiCoder.encode(['bytes32'], [rawHash])),  // ← Encoded raw hash
    },
    primaryType: 'SafeMessage',
  }
}
```

### 4. Safe Signature Validation Compatibility
**Critical Implementation Detail**: The signature must have `v > 30` to trigger Safe's prefixed signing validation:

```solidity
// In Safe's signature validation (recoverNSignatures)
if (v > 30) {
    _signer = ECDSA.tryRecover({ 
        hash: ECDSA.toEthSignedMessageHash(dataHash), 
        v: v - 4, r: r, s: s 
    });
}
```

This matches our `personal_sign` + v adjustment approach:
- `personal_sign` creates prefixed signatures
- Adding +4 to v signals Safe to use prefixed recovery
- Safe subtracts 4 and applies eth_sign prefix during validation

## Cross-Chain Compatibility Implementation

### Domain Constants Synchronization
These constants are **identical** between frontend and Solidity:

**Frontend** (`superform-safe-messages.ts`):
```typescript
export const SUPERFORM_DOMAIN_CONSTANTS = {
  DOMAIN_NAME: 'SuperformSafe',
  DOMAIN_VERSION: '1.0.0',
  FIXED_CHAIN_ID: 1,
  CHAIN_AGNOSTIC_DOMAIN_TYPEHASH: '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f',
}
```

**Solidity** (`ChainAgnosticSafeSignatureValidation.sol`):
```solidity
bytes32 private constant CHAIN_AGNOSTIC_DOMAIN_TYPEHASH = 
    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
uint256 private constant FIXED_CHAIN_ID = 1;
string private constant DOMAIN_NAME = "SuperformSafe";
string private constant DOMAIN_VERSION = "1.0.0";
```

### Signature Method Compatibility

**Working Method**: `personal_sign` with v adjustment
- ✅ **personal_sign**: Creates prefixed signatures compatible with Safe's validation
- ✅ **v adjustment (+4)**: Signals Safe to use prefixed recovery path
- ✅ **Manual signature construction**: Bypasses ethers.js v validation

**Alternative Methods** (for future investigation):
- ❓ **eth_signTypedData_v4**: May work with proper configuration
- ❌ **eth_sign**: Often disabled by wallets for security
- ❌ **Standard signTypedMessage**: Uses wrong domain structure

### Hash Construction Compatibility

**Frontend generates**:
```
EIP-712 Hash = keccak256(
  0x1901 + 
  domainSeparator(name="SuperformSafe", version="1.0.0", chainId=1, verifyingContract=safeAddress) +
  structHash(SafeMessage(message=keccak256(abi.encode(rawHash))))
)
```

**Solidity validates** (lines 65-72):
```solidity
bytes32 chainAgnosticHash = keccak256(
    abi.encodePacked(
        bytes1(0x19), bytes1(0x01),
        domainSeparator,  // ← Same domain structure
        keccak256(abi.encode(keccak256("SafeMessage(bytes message)"), keccak256(abi.encode(rawHash))))
    )
);
```

## Implementation Files

### Core Implementation
- **`apps/web/src/hooks/useSuperformInternalSigning.ts`** - Main signing implementation with personal_sign + v adjustment
- **`packages/utils/src/utils/superform-safe-messages.ts`** - Domain constants and typed data generation
- **`apps/web/src/pages/test-superform.tsx`** - Complete testing interface

### Alternative Implementations (Not Currently Used)
- **`apps/web/src/services/safe-wallet-provider/superform-integration.ts`** - Integration layer approach
- **`apps/web/src/services/safe-wallet-provider/useSafeWalletProvider.tsx`** - Provider modification approach

### Solidity Validation
- **`v2-core/src/libraries/ChainAgnosticSafeSignatureValidation.sol`** - Cross-chain signature validation logic
- **`v2-core/test/unit/libraries/ChainAgnosticHashDebug.t.sol`** - Test contract for hash verification

## Usage Examples

### For App Developers
Use the internal signing hook for Superform-compatible signatures:

```typescript
// Import the hook
import { useSuperformInternalSigning } from '@/hooks/useSuperformInternalSigning'

// In your component
const { signSuperformMessage } = useSuperformInternalSigning()

// Sign a raw hash (e.g., merkle root hash)
const rawHash = '0x00ef3b0a6abfd16aaf247ec385351fbe1166f2bfd8ea0c47f5774f421634571c'
const result = await signSuperformMessage(rawHash, safeAddress)

// Result contains:
// - signature: Cross-chain compatible signature with v > 30
// - messageHash: The EIP-712 hash that was signed
// - rawHash: Original input hash
// - superformTypedData: Complete EIP-712 structure
```

### Testing the Integration

1. **Start the Safe wallet**:
   ```bash
   cd apps/web
   yarn build && yarn serve
   # Access at: http://localhost:8080
   ```

2. **Add test app to Safe**:
   - Navigate to **Apps** → **Add custom app**
   - Enter URL: `http://localhost:8080/test-superform`
   - Click **Add** and open the app

3. **Test signature flow**:
   - Enter a merkle root (e.g., `0x00ef3b0a6abfd16aaf247ec385351fbe1166f2bfd8ea0c47f5774f421634571c`)
   - Click "Sign with Internal Method"
   - Approve the signature request
   - Signature is compatible with `ChainAgnosticSafeSignatureValidation.sol`

### Message Hash Construction

The system creates hashes exactly matching the Solidity test pattern:

```typescript
// 1. Create raw hash (same as AllAccountTypesTest.t.sol)
const namespace = 'SuperValidator'
const rawHash = keccak256(abiCoder.encode(['string', 'bytes32'], [namespace, merkleRoot]))

// 2. System automatically wraps in SuperformSafe domain
// 3. Generates cross-chain compatible signature
```

## Key Benefits

### 🔧 **Direct Implementation**
- Direct signing without Safe SDK interception
- Full control over signature generation process
- Compatible with Safe's signature validation logic

### 🌐 **Cross-Chain Compatible**
- Fixed `chainId=1` in domain for multi-chain validation
- Signatures work across all supported networks
- Compatible with Superform's validation contracts

### 🔒 **Safe Integration**
- Uses `personal_sign` with proper v adjustment
- Triggers Safe's prefixed signature validation path
- Maintains compatibility with Safe's security model

### 🎯 **Solidity Synchronized**
- Identical constants between frontend and contracts
- Hash construction matches validation logic exactly
- Tested compatibility with `recoverNSignatures()`

### ✅ **Production Ready**
- Working implementation with proper error handling
- Comprehensive logging for debugging
- Manual signature construction bypasses ethers.js limitations

## Technical Deep Dive

### Direct Signing Flow

```mermaid
graph TD
    A[App calls signSuperformMessage] --> B[useSuperformInternalSigning]
    B --> C[Generate Superform EIP-712 structure]
    C --> D[Create chain-agnostic hash]
    D --> E[Sign with personal_sign]
    E --> F[Parse signature components]
    F --> G[Adjust v value (+4)]
    G --> H[Manually construct signature]
    H --> I[Return signature with v > 30]
```

### Signature Method Analysis

**Why personal_sign + v adjustment works:**
1. `personal_sign` creates prefixed signatures (adds "\x19Ethereum Signed Message:\n32")
2. Safe's validation checks `if (v > 30)` to detect prefixed signatures
3. When v > 30, Safe uses `ECDSA.toEthSignedMessageHash(dataHash)` for recovery
4. This matches exactly what `personal_sign` produces
5. Safe subtracts 4 from v to get the original recovery value

**Why eth_signTypedData_v4 may not work:**
- May double-hash the data through EIP-712 structured signing
- Could produce different signature format than expected
- Requires further investigation to determine exact behavior

### Domain Separator Construction

**Frontend**:
```typescript
const domainSeparator = keccak256(
  abiCoder.encode(
    ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
    [
      CHAIN_AGNOSTIC_DOMAIN_TYPEHASH,
      keccak256(bytes(DOMAIN_NAME)),      // "SuperformSafe"
      keccak256(bytes(DOMAIN_VERSION)),   // "1.0.0"
      FIXED_CHAIN_ID,                     // 1
      safeAddress
    ]
  )
)
```

**Solidity** (lines 56-64):
```solidity
bytes32 domainSeparator = keccak256(
    abi.encode(
        CHAIN_AGNOSTIC_DOMAIN_TYPEHASH,
        keccak256(bytes(DOMAIN_NAME)),      // "SuperformSafe"
        keccak256(bytes(DOMAIN_VERSION)),   // "1.0.0"
        FIXED_CHAIN_ID,                     // 1
        safe                                // safeAddress
    )
);
```

### Signature Recovery Compatibility

The generated signatures are fully compatible with Superform's `recoverNSignatures()` function:

```solidity
function recoverNSignatures(
    bytes32 dataHash,           // ← The chainAgnosticHash
    bytes memory signatures,    // ← Frontend-generated signatures
    uint256 requiredSignatures
) internal view returns (uint256 validSigCount, address[] memory recoveredSigners)
```

The function supports:
- **ECDSA signatures** (v=27,28)
- **eth_sign signatures** (v>30, with message prefix)
- **Contract signatures** (v=0, EIP-1271 validation)

## Deployment Configuration

### Production Implementation
The current implementation uses **direct internal signing**:

```typescript
// In your Superform app
const { signSuperformMessage } = useSuperformInternalSigning()

// Sign raw hashes directly
const result = await signSuperformMessage(rawHash, safeAddress)
```

### Integration Options
For different deployment scenarios:

```typescript
// Option 1: Direct hook usage (current implementation)
const { signSuperformMessage } = useSuperformInternalSigning()

// Option 2: Provider integration (alternative approach)
const signature = await walletProvider.signSuperformMessage(rawHash, appInfo)

// Option 3: Automatic detection (future enhancement)
const signature = await walletProvider.signMessage(rawHash, {
  superform: true,  // Flag to use Superform domain
  appInfo
})
```

## Troubleshooting

### Common Issues

**1. Signature Validation Fails**
- Verify domain constants match between frontend and Solidity exactly
- Check that `chainId=1` is used consistently
- Ensure message hash construction follows the same pattern
- Confirm signature has `v > 30` for Safe's prefixed validation

**2. ethers.js Signature Errors**
- Error: "invalid v (argument="v", value=31)" - Use manual signature construction
- Use `hexlify(concatBytes([r, s, toBeHex(adjustedV, 1)]))` instead of `Signature.from()`
- Ensure proper import aliasing to avoid variable conflicts

**3. Safe Signature Recovery Issues**
- Verify `personal_sign` is used (not `eth_sign` or `signTypedMessage`)
- Check that v value is adjusted by +4 before returning
- Ensure Safe's validation logic receives the adjusted signature

**4. Cross-Chain Validation Issues**
- Ensure the Safe address is the same across chains
- Verify the Superform validation contract is deployed correctly
- Check that the signature format matches expected structure (65 bytes with v > 30)

### Debug Information

The implementation includes comprehensive logging:

```typescript
console.log('🔍 JavaScript signature components (before adjustment):')
console.log('- Full signature:', signature)
console.log('- v (original):', sig.v)
console.log('- v (adjusted for Safe):', adjustedV)
console.log('- Adjusted signature:', adjustedSignature)

// Hash verification
console.log('🎯 EXACT SOLIDITY MATCH:')
console.log('- Expected final hash: 0x01a4bda7a68f6669f85afc69998565ecf6241009c616a607bba50e3a8fae9a3c')
console.log('- Generated hash:', chainAgnosticHash)

// Recovery verification
console.log('🔍 Recovery comparison:')
console.log('- Solidity expects:', recoveredSignerDirect)
console.log('- JavaScript eth_sign:', recoveredSignerEthSign)
```

## Future Enhancements

### Potential Improvements
1. **eth_signTypedData_v4 Investigation**: Determine if this method can work with proper configuration
2. **Provider Integration**: Seamless integration with Safe's wallet provider system
3. **UI Indicators**: Visual feedback when Superform domain is active
4. **Signature Verification**: Built-in tools to verify cross-chain compatibility
5. **Performance Optimization**: Caching of domain separators and typed data structures

### Alternative Signing Methods
**For Investigation**:
- **eth_signTypedData_v4**: May work with minimal typed data structure
- **eth_sign**: Direct ECDSA signing (often disabled by wallets)
- **Hybrid approaches**: Combining multiple methods for maximum compatibility

### Migration Path
The current direct signing approach provides:
- ✅ Working implementation with Safe compatibility
- ✅ Full control over signature generation
- ✅ Comprehensive error handling and logging
- 🔄 Foundation for future provider integration
