import { useCallback, useEffect, useState } from 'react'
import { keccak256, AbiCoder } from 'ethers'
import { dispatchSafeMsgProposal } from '@/services/safe-messages/safeMsgSender'
import { generateSuperformSafeMessageTypedData } from '@safe-global/utils/utils/safe-messages'
import { hashTypedData } from '@safe-global/utils/utils/web3'
import useSafeInfo from '@/hooks/useSafeInfo'
import useWallet from '@/hooks/wallets/useWallet'
import { useRouter } from 'next/router'
import { useSafeAppContext } from '@/components/safe-apps/SafeAppWrapper'

/**
 * Hook for signing messages with Superform's custom domain within Safe app context
 * This bypasses the external wallet provider and uses Safe's internal signing mechanisms
 */
export const useSuperformInternalSigning = () => {
  const { safe, safeAddress } = useSafeInfo()
  const wallet = useWallet()
  const router = useRouter()
  const [fallbackSafeAddress, setFallbackSafeAddress] = useState<string>('')

  // Use Safe App SDK context when running in iframe
  const { safeAddress: sdkSafeAddress, isInSafeApp, loading: sdkLoading } = useSafeAppContext()

  // Try to get Safe address from multiple sources
  useEffect(() => {
    let effectiveAddress = ''

    // Priority: SDK address (when in Safe app) > context address > URL address
    if (sdkSafeAddress) {
      effectiveAddress = sdkSafeAddress
      console.log('🔍 Using Safe address from SDK:', sdkSafeAddress)
    } else if (safeAddress) {
      effectiveAddress = safeAddress
      console.log('🔍 Using Safe address from context:', safeAddress)
    } else if (router.query.safe) {
      effectiveAddress = Array.isArray(router.query.safe) ? router.query.safe[0] : router.query.safe
      console.log('🔍 Using Safe address from URL:', effectiveAddress)
    }

    setFallbackSafeAddress(effectiveAddress)
  }, [safeAddress, router.query.safe, sdkSafeAddress])

  const effectiveSafeAddress = sdkSafeAddress || safeAddress || fallbackSafeAddress

  const signSuperformMessage = useCallback(
    async (merkleRoot: string): Promise<{ signature: string }> => {
      if (!effectiveSafeAddress) {
        throw new Error('Safe address not available - please add ?safe=0x... to URL or run inside Safe app')
      }

      const abiCoder = AbiCoder.defaultAbiCoder()

      // 1. Create rawHash exactly like AllAccountTypesTest.t.sol
      const namespace = 'SuperValidator'
      const rawHash = keccak256(abiCoder.encode(['string', 'bytes32'], [namespace, merkleRoot]))

      console.log('🔗 Using Safe Internal Superform Signing:')
      console.log('- Raw hash:', rawHash)
      console.log('- Safe address:', effectiveSafeAddress)
      console.log('- Namespace:', namespace)
      console.log('- Merkle root:', merkleRoot)

      // 2. Create Superform-compatible typed data
      const superformTypedData = generateSuperformSafeMessageTypedData(effectiveSafeAddress, rawHash)

      console.log('📝 Generated Superform typed data:')
      console.log('- Domain name:', superformTypedData.domain.name)
      console.log('- Domain version:', superformTypedData.domain.version)
      console.log('- Domain chainId:', superformTypedData.domain.chainId)
      console.log('- Verifying contract:', superformTypedData.domain.verifyingContract)

      // Check if we have wallet and safe for internal signing
      if (wallet?.provider && safe) {
        try {
          // 3. Direct Superform signing using the custom typed data
          console.log('🔄 Attempting direct Superform signing...')

          // Get signer from wallet provider using ethers BrowserProvider
          const { BrowserProvider } = await import('ethers')
          const provider = new BrowserProvider(wallet.provider)
          const signer = await provider.getSigner()

          // Calculate the EIP-712 hash manually to match Solidity exactly
          const { keccak256: ethersKeccak256, concat, getBytes, toUtf8Bytes, AbiCoder } = await import('ethers')

          // Step 1: Calculate domain separator exactly like Solidity
          const CHAIN_AGNOSTIC_DOMAIN_TYPEHASH = '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f'
          const DOMAIN_NAME = 'SuperformSafe'
          const DOMAIN_VERSION = '1.0.0'
          const FIXED_CHAIN_ID = 1

          const abiCoder = AbiCoder.defaultAbiCoder()
          const domainSeparator = ethersKeccak256(
            abiCoder.encode(
              ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
              [
                CHAIN_AGNOSTIC_DOMAIN_TYPEHASH,
                ethersKeccak256(toUtf8Bytes(DOMAIN_NAME)),
                ethersKeccak256(toUtf8Bytes(DOMAIN_VERSION)),
                FIXED_CHAIN_ID,
                effectiveSafeAddress,
              ],
            ),
          )

          // Step 2: Calculate SafeMessage struct hash exactly like Solidity
          const SAFE_MESSAGE_TYPEHASH = ethersKeccak256(toUtf8Bytes('SafeMessage(bytes message)'))
          const messageStructHash = ethersKeccak256(
            abiCoder.encode(
              ['bytes32', 'bytes32'],
              [SAFE_MESSAGE_TYPEHASH, ethersKeccak256(abiCoder.encode(['bytes32'], [rawHash]))],
            ),
          )

          // Step 3: Calculate final chain-agnostic hash exactly like Solidity
          const chainAgnosticHash = ethersKeccak256(concat(['0x19', '0x01', domainSeparator, messageStructHash]))

          console.log('🔍 JavaScript EIP-712 calculation:')
          console.log('- CHAIN_AGNOSTIC_DOMAIN_TYPEHASH:', CHAIN_AGNOSTIC_DOMAIN_TYPEHASH)
          console.log('- Domain name hash:', ethersKeccak256(toUtf8Bytes(DOMAIN_NAME)))
          console.log('- Domain version hash:', ethersKeccak256(toUtf8Bytes(DOMAIN_VERSION)))
          console.log('- Fixed chain ID:', FIXED_CHAIN_ID)
          console.log('- Safe address:', effectiveSafeAddress)
          console.log('- Domain separator:', domainSeparator)
          console.log('- SAFE_MESSAGE_TYPEHASH:', SAFE_MESSAGE_TYPEHASH)
          console.log('- Raw hash:', rawHash)
          console.log('- Raw hash encoded:', ethersKeccak256(abiCoder.encode(['bytes32'], [rawHash])))
          console.log('- Message struct hash:', messageStructHash)
          console.log('- Final chain-agnostic hash:', chainAgnosticHash)

          console.log('\n🔍 Solidity expected values:')
          console.log('- Expected domain name hash: 0xe2c6934fb785b5f60008275f0609066361e48bc175bda8e1160d2680b4c1849d')
          console.log(
            '- Expected domain version hash: 0x06c015bd22b4c69690933c1058878ebdfef31f9aaae40bbe86d8a09fe1b2972c',
          )
          console.log('- Expected domain separator: 0xe2a57673a90a5249a54ad193fcf6d43011544289b478a45fa06d50e652c6e57c')
          console.log(
            '- Expected SafeMessage typehash: 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca',
          )
          console.log('- Expected raw hash encoded: 0x6d1876619d20b1cca9881226c33bbb9545858a37bc2a83aa52123c9f8b0732ec')
          console.log(
            '- Expected message struct hash: 0x449d8419a2844b7bdeedf8cb9506ab3a29d129e92cdcd46c9d923c2991ff961f',
          )
          console.log('- Expected final hash: 0x01a4bda7a68f6669f85afc69998565ecf6241009c616a607bba50e3a8fae9a3c')

          const eip712Hash = chainAgnosticHash

          // Use personal_sign (prefixed signing) and adjust v value for Safe compatibility
          const signature = await provider.send('personal_sign', [eip712Hash, await signer.getAddress()])
          console.log('✅ Used personal_sign for prefixed ECDSA')

          // Parse signature components and adjust v value for Safe compatibility
          const { Signature } = await import('ethers')
          const sig = Signature.from(signature)

          console.log('🔍 JavaScript signature components (before adjustment):')
          console.log('- Full signature:', signature)
          console.log('- Signature length:', signature.length)
          console.log('- v (original):', sig.v)
          console.log('- r:', sig.r)
          console.log('- s:', sig.s)

          // Adjust v value by +4 for Safe's prefixed signing detection (v > 30)
          const adjustedV = sig.v + 4
          console.log('- v (adjusted for Safe):', adjustedV)

          // Manually construct signature bytes since ethers.js doesn't accept v=31/32
          const { hexlify, concat: concatBytes, toBeHex } = await import('ethers')
          const adjustedSignature = hexlify(
            concatBytes([
              sig.r,
              sig.s,
              toBeHex(adjustedV, 1), // Convert v to single byte
            ]),
          )

          console.log('🔍 Adjusted signature for Safe:')
          console.log('- Adjusted signature:', adjustedSignature)

          // Verify signature recovery in JavaScript using direct ECDSA (like Solidity)
          const { recoverAddress } = await import('ethers')
          const recoveredSignerDirect = recoverAddress(eip712Hash, signature)
          console.log('- Recovered signer (direct ECDSA):', recoveredSignerDirect)

          // Also test with eth_sign format (what verifyMessage uses internally)
          const { verifyMessage } = await import('ethers')
          const recoveredSignerEthSign = verifyMessage(getBytes(eip712Hash), signature)
          console.log('- Recovered signer (eth_sign format):', recoveredSignerEthSign)
          console.log('- Expected signer:', await signer.getAddress())

          console.log('🔍 Recovery comparison:')
          console.log('- Solidity expects:', recoveredSignerDirect)
          console.log('- JavaScript eth_sign:', recoveredSignerEthSign)

          const result = {
            signature: adjustedSignature, // Use the adjusted signature with v+4
            messageHash: chainAgnosticHash, // Use the correct Solidity-matching hash
            rawHash,
            superformTypedData,
            messageDetails: {
              rawHash,
              safeAddress: effectiveSafeAddress,
              domain: superformTypedData.domain,
              message: superformTypedData.message,
              note: 'Signed with Superform domain for cross-chain compatibility',
            },
          }

          console.log('✅ Direct Superform signing completed:', result)
          console.log('🎯 Signature:', signature)
          console.log('📝 Message hash:', result.messageHash)

          return result
        } catch (error) {
          console.error('Direct Superform signing failed:', error)
          throw error
        }
      } else {
        // No wallet context available - return the message hash that needs to be signed
        // This matches the exact flow from AllAccountTypesTest.t.sol _getSafeSignature
        const messageHash = hashTypedData(superformTypedData)

        const result = {
          signature: `Cannot generate signature without wallet context. Message hash to sign: ${messageHash}`,
          messageHash,
          rawHash,
          superformTypedData,
          messageDetails: {
            namespace,
            merkleRoot,
            safeAddress: effectiveSafeAddress,
            domain: superformTypedData.domain,
            message: superformTypedData.message,
            note: 'Run inside Safe app or with wallet connected to generate actual signature.',
          },
        }

        console.log('⚠️ No wallet context - cannot generate signature')
        console.log('📝 Message hash that needs signing:', messageHash)
        console.log('🔍 This matches the messageHash from AllAccountTypesTest.t.sol line 1870-1877')
        console.log('🔍 Full details:', result)
        return result
      }
    },
    [safe, wallet, effectiveSafeAddress],
  )

  const signRawMessage = useCallback(
    async (rawHash: string): Promise<{ signature: string }> => {
      if (!effectiveSafeAddress) {
        throw new Error('Safe address not available - please add ?safe=0x... to URL or run inside Safe app')
      }

      console.log('🔗 Using Safe Internal Superform Signing (Raw Hash):')
      console.log('- Raw hash:', rawHash)
      console.log('- Safe address:', effectiveSafeAddress)

      // Create Superform-compatible typed data directly from raw hash
      const superformTypedData = generateSuperformSafeMessageTypedData(effectiveSafeAddress, rawHash)

      console.log('📝 Generated Superform typed data:')
      console.log('- Domain name:', superformTypedData.domain.name)
      console.log('- Domain version:', superformTypedData.domain.version)
      console.log('- Domain chainId:', superformTypedData.domain.chainId)

      // Check if we have wallet and safe for internal signing
      if (wallet?.provider && safe) {
        try {
          // Use Safe's internal message proposal system
          await dispatchSafeMsgProposal({
            provider: wallet.provider,
            safe,
            message: superformTypedData,
            origin: window.location.origin,
          })

          const result = {
            signature: 'Raw message signed successfully with Superform domain - check Safe message list',
          }

          console.log('✅ Safe internal signing completed:', result)
          return result
        } catch (error) {
          console.error('Safe internal signing failed:', error)
          throw error
        }
      } else {
        // No wallet context available - return the message hash that needs to be signed
        const messageHash = hashTypedData(superformTypedData)

        const result = {
          signature: `Cannot generate signature without wallet context. Message hash to sign: ${messageHash}`,
          messageHash,
          rawHash,
          superformTypedData,
          messageDetails: {
            rawHash,
            safeAddress: effectiveSafeAddress,
            domain: superformTypedData.domain,
            message: superformTypedData.message,
            note: 'Run inside Safe app or with wallet connected to generate actual signature.',
          },
        }

        console.log('⚠️ No wallet context - cannot generate signature')
        console.log('📝 Message hash that needs signing:', messageHash)
        console.log('🔍 This matches the messageHash from AllAccountTypesTest.t.sol line 1870-1877')
        console.log('🔍 Full details:', result)
        return result
      }
    },
    [safe, wallet, effectiveSafeAddress],
  )

  return {
    signSuperformMessage,
    signRawMessage,
    isReady: !!effectiveSafeAddress && !sdkLoading,
    safeAddress: effectiveSafeAddress,
    isInSafeApp,
    sdkLoading,
  }
}

export default useSuperformInternalSigning
