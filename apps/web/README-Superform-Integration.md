# Superform Cross-Chain Safe Signature Integration

This integration configures Safe wallets to always produce signatures compatible with Superform's cross-chain validation system. All signature requests use Superform's custom domain for cross-chain compatibility.

## Overview

Superform uses a custom EIP-712 domain structure for cross-chain signature compatibility:
- **Domain Name**: `SuperformSafe` (instead of Safe's standard `GnosisSafe`)
- **Domain Version**: `1.0.0`
- **Chain ID**: Fixed at `1` (for cross-chain compatibility)
- **Verification Contract**: The Safe address

## Key Files

### Core Implementation
- `packages/utils/src/utils/superform-safe-messages.ts` - Superform message generation utilities
- `apps/web/src/services/safe-wallet-provider/superform-integration.ts` - Integration layer
- `apps/web/src/services/safe-wallet-provider/useSafeWalletProvider.tsx` - Modified provider

### Tests
- `packages/utils/src/utils/__tests__/superform-safe-messages.test.ts` - Comprehensive test suite

## How It Works

### 1. Universal Superform Mode
All apps are treated as Superform apps in this deployment:
```typescript
// Always returns true - all signatures use Superform domain
const isSuperformApp = requiresSuperformSignature(appInfo)
```

### 2. Domain Adaptation
All signatures use Superform's custom domain:
```typescript
const superformTypedData = {
  domain: {
    name: "SuperformSafe",
    version: "1.0.0", 
    chainId: 1, // Fixed for cross-chain compatibility
    verifyingContract: safeAddress,
  },
  // ... rest of SafeMessage structure
}
```

### 3. Signature Flow
```
User Request → Superform Domain → Signature Generation → Cross-chain Validation
     ↓              ↓                    ↓                      ↓
All Apps → SuperformSafe Domain → Superform EIP-712 → Cross-chain Compatible
```

## Usage Examples

### All Apps Use Superform Signatures
```typescript
// All signature requests automatically use Superform's custom domain
const signature = await safeWalletProvider.signTypedMessage(typedData, appInfo)

// Whether it's a DeFi app, NFT marketplace, or any other dApp:
const uniswapSig = await safeWalletProvider.signTypedMessage(data, { name: 'Uniswap' })
const openSeaSig = await safeWalletProvider.signTypedMessage(data, { name: 'OpenSea' })
// Both use SuperformSafe domain with chainId: 1
```

## Validation Compatibility

The generated signatures are compatible with Superform's validation system:

### Solidity Side (ChainAgnosticSafeSignatureValidation.sol)
```solidity
// Domain separator creation
bytes32 domainSeparator = keccak256(
    abi.encode(
        CHAIN_AGNOSTIC_DOMAIN_TYPEHASH,
        keccak256(bytes("SuperformSafe")),
        keccak256(bytes("1.0.0")),
        1, // Fixed chain ID
        safe
    )
);

// Final hash for validation
bytes32 chainAgnosticHash = keccak256(
    abi.encodePacked(
        bytes1(0x19),
        bytes1(0x01),
        domainSeparator,
        keccak256(abi.encode(keccak256("SafeMessage(bytes message)"), keccak256(abi.encode(rawHash))))
    )
);
```

### Frontend Side
The integration automatically generates compatible signatures that will validate successfully against the Solidity implementation.

## Testing

Run the test suite to verify integration:
```bash
cd packages/utils
npm test superform-safe-messages.test.ts
```

## Migration Notes

- **Universal Superform Mode**: All apps now use Superform's custom domain by default
- **Cross-Chain Compatible**: All signatures work across different chains with fixed chainId=1
- **No App-Specific Configuration**: No need to detect or configure individual apps

## Constants Synchronization

Ensure these constants match between frontend and Solidity:
- `DOMAIN_NAME = "SuperformSafe"`
- `DOMAIN_VERSION = "1.0.0"`
- `FIXED_CHAIN_ID = 1`
- `CHAIN_AGNOSTIC_DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f`
