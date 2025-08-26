import type { MessageItem, TypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import { hashTypedData } from '@safe-global/utils/utils/web3'
import { generateSafeMessageMessage } from './safe-messages'

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

/**
 * Generates `SafeMessage` typed data for Superform's cross-chain validation
 * Uses custom "SuperformSafe" domain with fixed chainId=1 for cross-chain compatibility
 * 
 * @param safeAddress Safe contract address that will validate the signature
 * @param message Message to sign (string or EIP-712 typed data)
 * @returns `SafeMessage` types compatible with Superform's validation
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
 * Generates the message hash for Superform's cross-chain validation
 * 
 * @param safeAddress Safe contract address
 * @param message Message to sign
 * @returns Hash compatible with Superform's validation system
 */
export const generateSuperformSafeMessageHash = (
  safeAddress: string, 
  message: MessageItem['message']
): string => {
  const typedData = generateSuperformSafeMessageTypedData(safeAddress, message)
  return hashTypedData(typedData)
}

/**
 * Detects if an app requires Superform's custom signature domain
 * In dev/production mode, all apps are treated as Superform apps
 * 
 * @param appInfo Application information (unused in current implementation)
 * @returns true - all apps use Superform signatures in this deployment
 */
export const requiresSuperformSignature = (appInfo: { name?: string; url?: string }): boolean => {
  // Always use Superform signatures in dev/production mode
  return true
}
