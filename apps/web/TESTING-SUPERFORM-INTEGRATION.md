# Testing Superform Safe Signature Generation

## Overview
This guide shows how to test Superform's cross-chain signature compatibility using the internal signing implementation. The test demonstrates the working `personal_sign` + v adjustment approach that generates signatures compatible with Superform's validation contracts.

## Quick Setup

### 1. Build and Start the Safe Wallet
```bash
cd /path/to/safe-wallet-monorepo/apps/web
yarn build
yarn serve
```
Access at: `http://localhost:8080`

**Alternative (combined command):**
```bash
yarn static-serve
```

### 2. Add Test App to Safe
1. Navigate to **Apps** → **Add custom app**
2. Enter URL: `http://localhost:8080/test-superform`
3. Click **Add**
4. Open "Superform Signature Test" from Apps list

## Testing Signature Generation

### What the Test App Does
The test app (`test-superform.tsx`) demonstrates two signature methods:

**✅ Working Method - Internal Signing:**
- Uses `useSuperformInternalSigning` hook
- Implements `personal_sign` with v value adjustment (+4)
- Generates signatures with `v > 30` for Safe's prefixed validation
- Creates signatures compatible with `ChainAgnosticSafeSignatureValidation.sol`

**🔄 Alternative Method - System Integration:**
- Uses Safe's wallet provider system (not currently active)
- Demonstrates provider-based signature interception
- Available for future integration scenarios

### Test Methods

#### Method 1: Internal Signing (✅ Working)
1. Open the Superform Signature Test app
2. Enter a merkle root (e.g., `0x00ef3b0a6abfd16aaf247ec385351fbe1166f2bfd8ea0c47f5774f421634571c`)
3. Click **"Sign with Internal Method"**
4. Approve signature in Safe dialog
5. Check console for detailed signature analysis

#### Method 2: System Integration Testing
1. Click **"Sign Production Hash"** (uses provider integration)
2. Compare results with internal method
3. Verify both methods produce compatible signatures

**Example Console Output:**
```
🔍 JavaScript signature components (before adjustment):
- Full signature: 0x...
- v (original): 27
- v (adjusted for Safe): 31
- Adjusted signature: 0x...

🎯 EXACT SOLIDITY MATCH:
- Expected final hash: 0x01a4bda7a68f6669f85afc69998565ecf6241009c616a607bba50e3a8fae9a3c
- Generated hash: 0x01a4bda7a68f6669f85afc69998565ecf6241009c616a607bba50e3a8fae9a3c
```

## Implementation Details

### Domain Constants (Synchronized with Solidity)
```typescript
DOMAIN_NAME = "SuperformSafe"
DOMAIN_VERSION = "1.0.0"  
FIXED_CHAIN_ID = 1
CHAIN_AGNOSTIC_DOMAIN_TYPEHASH = "0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f"
```

### Implementation Files
- **✅ Active**: `apps/web/src/hooks/useSuperformInternalSigning.ts` - Working internal signing implementation
- **✅ Active**: `apps/web/src/pages/test-superform.tsx` - Test application with both methods
- **✅ Active**: `packages/utils/src/utils/superform-safe-messages.ts` - Domain constants and utilities
- **🔄 Alternative**: `apps/web/src/services/safe-wallet-provider/superform-integration.ts` - Provider integration approach
- **🔄 Alternative**: `apps/web/src/services/safe-wallet-provider/useSafeWalletProvider.tsx` - Provider modifications

### Working Signature Flow (Internal Method)
1. User enters merkle root in test app
2. App constructs raw hash: `keccak256(abi.encode("SuperValidator", merkleRoot))`
3. `useSuperformInternalSigning` builds Superform EIP-712 structure
4. Creates chain-agnostic hash using `_TypedDataEncoder.hash()`
5. Signs with `personal_sign` (creates prefixed signature)
6. Adjusts v value by +4 to signal Safe's prefixed validation
7. Manually constructs signature bytes to bypass ethers.js validation
8. Returns signature with `v > 30` compatible with Safe's validation

### Key Technical Details
- **Signature Method**: `personal_sign` (prefixed signing)
- **V Value Adjustment**: Original v + 4 = 31 or 32
- **Safe Validation Path**: `if (v > 30)` triggers prefixed recovery
- **Manual Construction**: `hexlify(concatBytes([r, s, toBeHex(adjustedV, 1)]))`

## Verification

### What to Check
1. **Hash Construction**: Verify console output shows exact Solidity match
2. **Signature Format**: Check signature has 65 bytes with v > 30
3. **V Value Adjustment**: Original v (27/28) → Adjusted v (31/32)
4. **Backend Compatibility**: Test signature validates in Solidity contract
5. **Recovery Verification**: Check both direct ECDSA and eth_sign recovery

### Debug Information
- Open browser dev tools → Console
- Look for "🎯 EXACT SOLIDITY MATCH" logs
- Verify `chainAgnosticHash` matches expected production hash
- Check signature components before and after v adjustment
- Verify recovery addresses match expected signer

### Expected Debug Output
```
✅ Used personal_sign for prefixed ECDSA
🔍 JavaScript signature components (before adjustment):
- v (original): 27
- v (adjusted for Safe): 31
🔍 Adjusted signature for Safe:
- Adjusted signature: 0x...[130 chars with v=31/32]
🔍 Recovery comparison:
- Solidity expects: 0x...[signer address]
- JavaScript eth_sign: 0x...[same address]
```

## Backend Integration

### Expected Signature Format
Signatures from the internal signing method will:
- Use **Domain**: `"SuperformSafe"`
- Use **Version**: `"1.0.0"`
- Use **ChainId**: `1` (fixed)
- Use **VerifyingContract**: Safe address
- Have **v > 30** (31 or 32) for prefixed signature detection
- Be 65 bytes total (32 + 32 + 1)

### Validation in Solidity
Use `ChainAgnosticSafeSignatureValidation.sol` with these exact domain parameters. The contract handles prefixed signatures via:
```solidity
if (v > 30) {
    _signer = ECDSA.tryRecover({ 
        hash: ECDSA.toEthSignedMessageHash(dataHash), 
        v: v - 4, r: r, s: s 
    });
}
```

### Signature Validation Flow
1. Safe receives signature with v = 31 or 32
2. Detects `v > 30` → uses prefixed validation path
3. Applies `ECDSA.toEthSignedMessageHash()` to add eth_sign prefix
4. Subtracts 4 from v to get original recovery value (27/28)
5. Recovers signer address using prefixed hash
6. This matches exactly what `personal_sign` produces on frontend

## Troubleshooting

### Common Issues

**1. ethers.js Signature Errors**
- Error: "invalid v (argument="v", value=31)" → ✅ Fixed with manual signature construction
- Use `hexlify(concatBytes([r, s, toBeHex(adjustedV, 1)]))` instead of `Signature.from()`
- Ensure proper import aliasing: `concat: concatBytes` to avoid conflicts

**2. Signature Validation Fails**
- Verify domain constants match Solidity exactly
- Check that v value is properly adjusted (+4)
- Ensure signature has v > 30 for Safe's prefixed validation
- Confirm hash construction matches expected pattern

**3. Safe Integration Issues**
- **"Signing..." hangs**: App must run inside Safe's iframe context
- **Wrong recovery**: Verify `personal_sign` is used (not `eth_sign`)
- **Hash mismatch**: Check console logs for exact hash values

**4. Testing Environment**
- Ensure app runs at correct URL: `http://localhost:8080/test-superform`
- Verify Safe wallet is connected and has proper permissions
- Check browser console for detailed debug information

### Debug Checklist
- [ ] Console shows "✅ Used personal_sign for prefixed ECDSA"
- [ ] Original v is 27 or 28
- [ ] Adjusted v is 31 or 32
- [ ] Signature length is 132 characters (65 bytes)
- [ ] Hash matches expected Solidity value
- [ ] Recovery addresses match signer

### Support
- Check console for comprehensive signature analysis
- Verify all hash construction steps match Solidity
- Compare internal method vs system integration results
- Test signature validation in Solidity contract

## Current Status

### ✅ Working Implementation
- **Method**: `personal_sign` + v adjustment (+4)
- **Status**: Fully functional and tested
- **Compatibility**: Safe signature validation with v > 30
- **File**: `useSuperformInternalSigning.ts`

### 🔄 Alternative Methods
- **eth_signTypedData_v4**: Requires further investigation
- **Provider Integration**: Available but not currently active
- **eth_sign**: Often disabled by wallets

### 📋 Next Steps
1. **Production Deployment**: Use internal signing method
2. **eth_signTypedData_v4 Investigation**: Determine if viable with proper configuration
3. **Provider Integration**: Consider for seamless user experience
4. **Performance Optimization**: Cache domain separators and typed data
