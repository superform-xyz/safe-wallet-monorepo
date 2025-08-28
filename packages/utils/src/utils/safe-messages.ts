import type { MessageItem, TypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import { hashMessage, type TypedDataDomain, type JsonRpcSigner } from 'ethers'
import { gte } from 'semver'
import { adjustVInSignature } from '@safe-global/protocol-kit/dist/src/utils/signatures'

import { hashTypedData } from '@safe-global/utils/utils/web3'
import { isValidAddress } from '@safe-global/utils/utils/validation'
import { type ChainInfo } from '@safe-global/safe-gateway-typescript-sdk'
import { type SafeState } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import { FEATURES } from '@safe-global/utils/utils/chains'

import { hasFeature } from '@safe-global/utils/utils/chains'
import { SigningMethod } from '@safe-global/protocol-kit'

/**
 * Superform's custom domain constants for cross-chain signature compatibility
 * These must match the constants in ChainAgnosticSafeSignatureValidation.sol
 */
export const SUPERFORM_DOMAIN_CONSTANTS = {
  DOMAIN_NAME: 'SuperformSafe',
  DOMAIN_VERSION: '1.0.0',
  FIXED_CHAIN_ID: 1,
  // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
  CHAIN_AGNOSTIC_DOMAIN_TYPEHASH: '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f',
} as const

/*
 * From v1.3.0, EIP-1271 support was moved to the CompatibilityFallbackHandler.
 * Also 1.3.0 introduces the chainId in the domain part of the SafeMessage
 */
const EIP1271_FALLBACK_HANDLER_SUPPORTED_SAFE_VERSION = '1.3.0'

const EIP1271_SUPPORTED_SAFE_VERSION = '1.0.0'

const EIP1271_OFFCHAIN_SUPPORTED_SAFE_APPS_SDK_VERSION = '7.11.0'

const isHash = (payload: string) => /^0x[a-f0-9]+$/i.test(payload)

/*
 * Typeguard for EIP712TypedData
 *
 */
export const isEIP712TypedData = (obj: any): obj is TypedData => {
  return typeof obj === 'object' && obj != null && 'domain' in obj && 'types' in obj && 'message' in obj
}

export const isBlindSigningPayload = (obj: TypedData | string): boolean => !isEIP712TypedData(obj) && isHash(obj)

export const generateSafeMessageMessage = (message: MessageItem['message']): string => {
  return typeof message === 'string' ? hashMessage(message) : hashTypedData(message)
}

/**
 * Detects if an app requires Superform's custom signature domain
 * @param appInfo Application information
 * @returns true if app should use Superform signatures
 */
export const requiresSuperformSignature = (appInfo?: { name?: string; url?: string }): boolean => {
  if (!appInfo) return false

  // Detect Superform app based on origin or name
  if (appInfo.url?.includes('superform') ||
    appInfo.url?.includes('test-superform') ||
    appInfo.name?.toLowerCase().includes('superform')) {
    return true
  }

  // For testing: also detect our test app
  if (appInfo.url?.includes('localhost:8080/test-superform')) {
    return true
  }

  return false
}

/**
 * Generates `SafeMessage` typed data for Superform's cross-chain validation
 * Uses custom "SuperformSafe" domain with fixed chainId=1 for cross-chain compatibility
 */
export const generateSuperformSafeMessageTypedData = (
  safeAddress: string,
  message: MessageItem['message'],
): TypedData => {
  return {
    domain: {
      name: SUPERFORM_DOMAIN_CONSTANTS.DOMAIN_NAME,
      version: SUPERFORM_DOMAIN_CONSTANTS.DOMAIN_VERSION,
      chainId: SUPERFORM_DOMAIN_CONSTANTS.FIXED_CHAIN_ID,
      verifyingContract: safeAddress,
    },
    types: {
      SafeMessage: [{ name: 'message', type: 'bytes' }],
    },
    message: {
      message: generateSafeMessageMessage(message),
    },
    primaryType: 'SafeMessage',
  }
}

/**
 * Generates `SafeMessage` typed data for EIP-712
 * https://github.com/safe-global/safe-contracts/blob/main/contracts/handler/CompatibilityFallbackHandler.sol#L12
 * @param safe Safe which will sign the message
 * @param message Message to sign
 * @param appInfo Application information for conditional Superform domain usage
 * @returns `SafeMessage` types for signing
 */
export const generateSafeMessageTypedData = (
  { version, chainId, address }: SafeState,
  message: MessageItem['message'],
  appInfo?: { name?: string; url?: string },
): TypedData => {
  // Use Superform domain if app requires it
  if (requiresSuperformSignature(appInfo)) {
    return generateSuperformSafeMessageTypedData(address.value, message)
  }

  // Original Safe logic
  if (!version) {
    throw Error('Cannot create SafeMessage without version information')
  }
  const isHandledByFallbackHandler = gte(version, EIP1271_FALLBACK_HANDLER_SUPPORTED_SAFE_VERSION)

  return {
    domain: isHandledByFallbackHandler
      ? {
        chainId: Number(chainId),
        verifyingContract: address.value,
      }
      : { verifyingContract: address.value },
    types: {
      SafeMessage: [{ name: 'message', type: 'bytes' }],
    },
    message: {
      message: generateSafeMessageMessage(message),
    },
    primaryType: 'SafeMessage',
  }
}

export const generateSafeMessageHash = (
  safe: SafeState,
  message: MessageItem['message'],
  appInfo?: { name?: string; url?: string }
): string => {
  const typedData = generateSafeMessageTypedData(safe, message, appInfo)
  return hashTypedData(typedData)
}

/**
 * Generates the message hash for Superform's cross-chain validation
 */
export const generateSuperformSafeMessageHash = (
  safeAddress: string,
  message: MessageItem['message']
): string => {
  const typedData = generateSuperformSafeMessageTypedData(safeAddress, message)
  return hashTypedData(typedData)
}

export const isOffchainEIP1271Supported = (
  { version, fallbackHandler }: SafeState,
  chain: ChainInfo | undefined,
  sdkVersion?: string,
): boolean => {
  if (!version) {
    return false
  }

  // check feature toggle
  if (!chain || !hasFeature(chain, FEATURES.EIP1271)) {
    return false
  }

  // If the Safe apps sdk does not support off-chain signing yet
  if (sdkVersion && !gte(sdkVersion, EIP1271_OFFCHAIN_SUPPORTED_SAFE_APPS_SDK_VERSION)) {
    return false
  }

  // Check if Safe has fallback handler
  const isHandledByFallbackHandler = gte(version, EIP1271_FALLBACK_HANDLER_SUPPORTED_SAFE_VERSION)
  if (isHandledByFallbackHandler) {
    // We only check if any fallback Handler is set as we expect / assume that users who overwrite the fallback handler by a custom one know what they are doing
    return fallbackHandler !== null && typeof fallbackHandler !== 'undefined' && isValidAddress(fallbackHandler.value)
  }

  // check if Safe version supports EIP-1271
  return gte(version, EIP1271_SUPPORTED_SAFE_VERSION)
}

export const tryOffChainMsgSigning = async (
  signer: JsonRpcSigner,
  safe: SafeState,
  message: MessageItem['message'],
): Promise<string> => {
  const typedData = generateSafeMessageTypedData(safe, message)
  const signature = await signer.signTypedData(typedData.domain as TypedDataDomain, typedData.types, typedData.message)

  // V needs adjustment when signing with ledger / trezor through metamask
  return adjustVInSignature(SigningMethod.ETH_SIGN_TYPED_DATA, signature)
}
