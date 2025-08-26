import { zeroPadValue } from 'ethers'
import {
  generateSuperformSafeMessageTypedData,
  generateSuperformSafeMessageHash,
  requiresSuperformSignature,
  SUPERFORM_DOMAIN_CONSTANTS,
} from '../superform-safe-messages'

const MOCK_SAFE_ADDRESS = zeroPadValue('0x0123', 20)

describe('superform-safe-messages', () => {
  describe('generateSuperformSafeMessageTypedData', () => {
    it('should generate correct typed data for string message with Superform domain', () => {
      const message = 'Hello Superform!'
      const result = generateSuperformSafeMessageTypedData(MOCK_SAFE_ADDRESS, message)

      expect(result).toEqual({
        domain: {
          name: 'SuperformSafe',
          version: '1.0.0',
          chainId: 1, // Fixed chainId for cross-chain compatibility
          verifyingContract: MOCK_SAFE_ADDRESS,
        },
        types: {
          SafeMessage: [{ name: 'message', type: 'bytes' }],
        },
        primaryType: 'SafeMessage',
        message: {
          message: expect.any(String), // Hash of the message
        },
      })
    })

    it('should generate correct typed data for EIP-712 message with Superform domain', () => {
      const eip712Message = {
        domain: {
          chainId: 1,
          name: 'Ether Mail',
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
          version: '1',
        },
        message: {
          contents: 'Hello, Bob!',
          from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
        },
        primaryType: 'Mail',
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
        },
      }

      const result = generateSuperformSafeMessageTypedData(MOCK_SAFE_ADDRESS, eip712Message)

      expect(result.domain).toEqual({
        name: 'SuperformSafe',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: MOCK_SAFE_ADDRESS,
      })
      expect(result.primaryType).toBe('SafeMessage')
      expect(result.types.SafeMessage).toEqual([{ name: 'message', type: 'bytes' }])
    })

    it('should use fixed chainId regardless of input message chainId', () => {
      const messageWithDifferentChainId = {
        domain: { chainId: 137 }, // Polygon chainId
        message: { test: 'data' },
        primaryType: 'TestMessage',
        types: { TestMessage: [{ name: 'test', type: 'string' }] },
      }

      const result = generateSuperformSafeMessageTypedData(MOCK_SAFE_ADDRESS, messageWithDifferentChainId)

      // Should always use fixed chainId=1 for cross-chain compatibility
      expect(result.domain.chainId).toBe(1)
    })
  })

  describe('generateSuperformSafeMessageHash', () => {
    it('should generate consistent hash for same message and safe address', () => {
      const message = 'Test message'
      const hash1 = generateSuperformSafeMessageHash(MOCK_SAFE_ADDRESS, message)
      const hash2 = generateSuperformSafeMessageHash(MOCK_SAFE_ADDRESS, message)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/) // Valid hex hash
    })

    it('should generate different hashes for different safe addresses', () => {
      const message = 'Test message'
      const address1 = zeroPadValue('0x0123', 20)
      const address2 = zeroPadValue('0x0456', 20)

      const hash1 = generateSuperformSafeMessageHash(address1, message)
      const hash2 = generateSuperformSafeMessageHash(address2, message)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('requiresSuperformSignature', () => {
    it('should detect Superform apps by name', () => {
      expect(requiresSuperformSignature({ name: 'Superform App' })).toBe(true)
      expect(requiresSuperformSignature({ name: 'superform-dapp' })).toBe(true)
      expect(requiresSuperformSignature({ name: 'My Superform Integration' })).toBe(true)
    })

    it('should detect Superform apps by URL', () => {
      expect(requiresSuperformSignature({ url: 'https://superform.xyz' })).toBe(true)
      expect(requiresSuperformSignature({ url: 'https://app.superform.xyz/vaults' })).toBe(true)
      expect(requiresSuperformSignature({ url: 'https://staging-superform.vercel.app' })).toBe(true)
    })

    it('should not detect non-Superform apps', () => {
      expect(requiresSuperformSignature({ name: 'Uniswap' })).toBe(false)
      expect(requiresSuperformSignature({ url: 'https://app.uniswap.org' })).toBe(false)
      expect(requiresSuperformSignature({ name: 'Safe App', url: 'https://safe.global' })).toBe(false)
    })

    it('should handle missing name/url gracefully', () => {
      expect(requiresSuperformSignature({})).toBe(false)
      expect(requiresSuperformSignature({ name: undefined, url: undefined })).toBe(false)
    })
  })

  describe('SUPERFORM_DOMAIN_CONSTANTS', () => {
    it('should match Solidity contract constants', () => {
      // These must match ChainAgnosticSafeSignatureValidation.sol
      expect(SUPERFORM_DOMAIN_CONSTANTS.DOMAIN_NAME).toBe('SuperformSafe')
      expect(SUPERFORM_DOMAIN_CONSTANTS.DOMAIN_VERSION).toBe('1.0.0')
      expect(SUPERFORM_DOMAIN_CONSTANTS.FIXED_CHAIN_ID).toBe(1)
      expect(SUPERFORM_DOMAIN_CONSTANTS.CHAIN_AGNOSTIC_DOMAIN_TYPEHASH).toBe(
        '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f'
      )
    })
  })
})
