import type { AppInfo } from '.'
import type { TypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import { Methods } from '@safe-global/safe-apps-sdk'
import {
  generateSuperformSafeMessageTypedData,
  requiresSuperformSignature,
} from '@safe-global/utils/utils/superform-safe-messages'

/**
 * Extended WalletSDK interface for Superform cross-chain signature support
 */
export interface SuperformWalletSDK {
  /**
   * Sign a message using Superform's custom domain for cross-chain compatibility
   * @param message Message to sign (string or EIP-712 typed data)
   * @param appInfo Application requesting the signature
   * @returns Promise resolving to signature
   */
  signSuperformMessage(message: string | TypedData, appInfo: AppInfo): Promise<{ signature: string }>

  /**
   * Sign typed data using Superform's custom domain
   * @param typedData EIP-712 typed data to sign
   * @param appInfo Application requesting the signature
   * @returns Promise resolving to signature
   */
  signSuperformTypedMessage(typedData: TypedData, appInfo: AppInfo): Promise<{ signature: string }>
}

/**
 * Creates Superform-compatible signature methods for the Safe wallet provider
 *
 * @param safeAddress Safe contract address
 * @param signMessage Original Safe signMessage function
 * @returns Object with Superform signature methods
 */
export const createSuperformSignatureMethods = (
  safeAddress: string,
  signMessage: (
    message: string | TypedData,
    appInfo: AppInfo,
    method: Methods.signMessage | Methods.signTypedMessage,
  ) => Promise<{ signature: string }>,
): SuperformWalletSDK => {
  return {
    async signSuperformMessage(message: string | TypedData, appInfo: AppInfo) {
      // Convert to Superform-compatible typed data
      const superformTypedData = generateSuperformSafeMessageTypedData(safeAddress, message)
      return await signMessage(superformTypedData, appInfo, Methods.signTypedMessage)
    },

    async signSuperformTypedMessage(typedData: TypedData, appInfo: AppInfo) {
      // For typed data, we need to hash it first then wrap in Superform domain
      const superformTypedData = generateSuperformSafeMessageTypedData(safeAddress, typedData)
      return await signMessage(superformTypedData, appInfo, Methods.signTypedMessage)
    },
  }
}

/**
 * Determines which signature method to use based on the requesting application
 *
 * @param appInfo Application information
 * @param standardSignMethod Standard Safe signature method
 * @param superformSignMethod Superform signature method
 * @returns Appropriate signature method
 */
export const selectSignatureMethod = <T extends (...args: any[]) => any>(
  appInfo: AppInfo,
  standardSignMethod: T,
  superformSignMethod: T,
): T => {
  return requiresSuperformSignature(appInfo) ? superformSignMethod : standardSignMethod
}
