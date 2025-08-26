# Testing Superform Safe Integration - Backend Engineer Guide

## Overview
This guide shows how to test the Superform cross-chain signature integration with Safe wallets. All signature requests are automatically converted to use the custom "SuperformSafe" domain for cross-chain compatibility.

## Quick Setup

### 1. Start the Safe Wallet
```bash
cd /path/to/safe-wallet-monorepo/apps/web
yarn dev
```
Access at: `http://localhost:8080`

### 2. Add Test App to Safe
1. Navigate to **Apps** → **Add custom app**
2. Enter URL: `http://localhost:8080/test-superform`
3. Click **Add**
4. Open "Superform Signature Test" from Apps list

## Testing Signature Integration

### Expected Behavior
When any app requests a signature, the Safe wallet automatically:
- Converts domain to `"SuperformSafe"`
- Sets version to `"1.0.0"`
- Forces chainId to `1` (for cross-chain compatibility)
- Uses domain typehash: `0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f`

### Test Methods

#### Method 1: Test App Interface
1. Open the Superform Signature Test app
2. Click **"Sign Typed Message"** or **"Sign Message"**
3. Approve signature in Safe dialog
4. Verify result shows converted signature

#### Method 2: Console Testing (Any Safe App)
1. Open any Safe App (e.g., Transaction Builder)
2. Open browser console (F12)
3. Paste test code:
```javascript
// Test signature conversion
window.parent.postMessage({
  messageId: 'test-' + Date.now(),
  method: 'signTypedMessage',
  params: {
    typedData: {
      domain: { 
        name: 'TestApp',        // Gets converted to 'SuperformSafe'
        version: '1.0.0', 
        chainId: 42            // Gets converted to chainId=1
      },
      types: { Message: [{ name: 'content', type: 'string' }] },
      message: { content: 'Testing Superform integration!' }
    }
  }
}, '*')
```

## Integration Details

### Domain Constants (Automatically Applied)
```typescript
DOMAIN_NAME = "SuperformSafe"
DOMAIN_VERSION = "1.0.0"  
FIXED_CHAIN_ID = 1
CHAIN_AGNOSTIC_DOMAIN_TYPEHASH = "0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f"
```

### Implementation Files
- **Core Logic**: `packages/utils/src/utils/superform-safe-messages.ts`
- **Integration**: `apps/web/src/services/safe-wallet-provider/superform-integration.ts`
- **Provider**: `apps/web/src/services/safe-wallet-provider/useSafeWalletProvider.tsx`

### Signature Flow
1. App requests signature with any domain
2. Safe wallet provider intercepts request
3. Converts to SuperformSafe domain (chainId=1)
4. User signs in Safe interface
5. Returns signature compatible with `ChainAgnosticSafeSignatureValidation.sol`

## Verification

### What to Check
1. **Domain Conversion**: Original domain → "SuperformSafe"
2. **Chain ID**: Any chainId → 1 (fixed)
3. **Compatibility**: Signature validates in Solidity contract
4. **Cross-chain**: Same signature works on any chain

### Debug Information
- Open browser dev tools → Console
- Look for logs showing domain conversion
- Verify signature format matches expected structure

## Backend Integration

### Expected Signature Format
All signatures from Safe will use:
- **Domain**: `"SuperformSafe"`
- **Version**: `"1.0.0"`
- **ChainId**: `1`
- **VerifyingContract**: Safe address

### Validation
Use `ChainAgnosticSafeSignatureValidation.sol` with these exact domain parameters for signature verification.

## Troubleshooting

### Common Issues
1. **"Signing..." hangs**: App must run inside Safe's iframe context
2. **404 manifest**: Ensure `public/test-superform/manifest.json` exists
3. **No signature dialog**: Check Safe Apps SDK is properly initialized

### Support
- Check console for error messages
- Verify Safe wallet is connected
- Ensure app runs at correct URL: `http://localhost:8080/test-superform`
