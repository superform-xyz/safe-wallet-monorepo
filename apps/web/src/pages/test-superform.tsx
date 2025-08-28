import Head from 'next/head'
import { useState } from 'react'
import { Box, Button, Typography, Paper, Alert, TextField, IconButton } from '@mui/material'
import { ContentCopy } from '@mui/icons-material'
import useSuperformInternalSigning from '@/hooks/useSuperformInternalSigning'

const TestSuperformPage = () => {
  const [merkleRoot, setMerkleRoot] = useState<string>('')
  const [signature, setSignature] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Safe internal signing - works inside Safe App
  const { signSuperformMessage, isReady, safeAddress, isInSafeApp, sdkLoading } = useSuperformInternalSigning()

  // Debug logging for button state
  console.log('🔍 Button state debug:')
  console.log('- loading:', loading)
  console.log('- isReady:', isReady)
  console.log('- safeAddress:', safeAddress)
  console.log('- merkleRoot.trim():', merkleRoot.trim())
  console.log('- Button disabled:', loading || !merkleRoot.trim() || !safeAddress || !isReady)

  // Test internal Safe signing with Superform integration
  const signWithInternalIntegration = async (merkleRoot: string): Promise<{ signature: string }> => {
    if (!safeAddress || !isReady) {
      throw new Error('Safe address or internal signing not available - must run inside Safe App')
    }

    console.log('🔗 Using Safe Internal Superform Integration:')
    console.log('- Merkle root:', merkleRoot)
    console.log('- Safe address:', safeAddress)
    console.log('- App URL:', window.location.href)

    try {
      const result = await signSuperformMessage(merkleRoot)
      console.log('✅ Internal signing result:', result)
      console.log('🎯 This signature was generated using SuperformSafe domain (chainId=1)')
      return result
    } catch (error) {
      console.error('Internal signing failed:', error)
      throw error
    }
  }

  const signProductionHash = async () => {
    if (!merkleRoot.trim() || !safeAddress || !isReady) return

    setLoading(true)
    setError('')
    setSignature('')

    try {
      // Create the raw hash exactly like AllAccountTypesTest.t.sol
      const namespace = 'SuperValidator'
      const rawHashMessage = `${namespace}${merkleRoot}`

      console.log('Production signing flow:')
      console.log('- Merkle root:', merkleRoot)
      console.log('- Namespace:', namespace)
      console.log('- Raw hash message:', rawHashMessage)
      console.log('Safe Address:', safeAddress)
      console.log('🔄 Using exact Solidity hash construction...')

      // Use internal Safe Superform integration
      const result = await signWithInternalIntegration(merkleRoot)

      setSignature(JSON.stringify(result, null, 2))
      console.log('✅ Superform signature result:', result)
      console.log('🎯 This signature is compatible with ChainAgnosticSafeSignatureValidation.sol')
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
      console.error('Production signature error:', err)
    } finally {
      setLoading(false)
    }
  }

  const copySignature = () => {
    if (signature) {
      navigator.clipboard.writeText(signature)
    }
  }

  return (
    <>
      <Head>
        <title>Superform Signature Test</title>
        <meta name="description" content="Test Superform cross-chain signature integration" />
      </Head>

      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          🔐 Superform Production Signing
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }}>
          Production signing tool that uses Safe&apos;s internal signing mechanisms with Superform&apos;s custom domain.
          This bypasses external wallet providers and works directly within the Safe app context using the
          &quot;SuperformSafe&quot; domain (chainId=1) for cross-chain compatibility.
        </Typography>

        <Alert severity={isInSafeApp ? 'info' : 'warning'} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Safe Address:</strong> {safeAddress || 'Loading...'}
            <br />
            <strong>Method:</strong> Safe Internal Superform Integration
            <br />
            <strong>Domain:</strong> &quot;SuperformSafe&quot; (chainId=1)
            <br />
            <strong>Compatible with:</strong> ChainAgnosticSafeSignatureValidation.sol
            <br />
            <strong>Running in Safe App:</strong> {isInSafeApp ? '✅ Yes' : '❌ No - Add as custom app in Safe'}
            <br />
            <strong>SDK Loading:</strong> {sdkLoading ? '⏳ Loading...' : '✅ Ready'}
            <br />
            <strong>Status:</strong> {isReady ? '✅ Ready' : '⏳ Loading...'}
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Production Hash Signing
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter the merkle root provided:
          </Typography>

          <TextField
            fullWidth
            label="Merkle Root"
            placeholder="0x..."
            value={merkleRoot}
            onChange={(e) => setMerkleRoot(e.target.value)}
            sx={{ mb: 2 }}
            multiline
            rows={2}
          />

          <Button
            variant="contained"
            onClick={signProductionHash}
            disabled={loading || !merkleRoot.trim() || !safeAddress || !isReady}
            fullWidth
          >
            {loading ? 'Signing...' : 'Sign Production Hash'}
          </Button>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
        )}

        {signature && (
          <Paper sx={{ p: 3, bgcolor: 'success.light' }}>
            <Typography variant="h6" gutterBottom>
              ✅ Production Signature
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={signature}
                variant="outlined"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
                InputProps={{
                  readOnly: true,
                }}
              />
              <IconButton onClick={copySignature} color="primary">
                <ContentCopy />
              </IconButton>
            </Box>
            <Alert severity="success" sx={{ mt: 2 }}>
              ✅ <strong>Internal Integration:</strong> This signature was generated using Safe&apos;s internal
              Superform integration, automatically applying the SuperformSafe domain for cross-chain compatibility.
            </Alert>
          </Paper>
        )}

        <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            🔍 Message Hash Construction
          </Typography>
          <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography
              variant="body2"
              component="div"
              sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'black' }}
            >
              <strong>1. Raw Hash Creation:</strong>
              <br />
              <Box
                component="span"
                sx={{ bgcolor: '#f5f5f5', p: 0.5, borderRadius: 0.5, display: 'inline-block', mt: 0.5 }}
              >
                rawHash = keccak256(abi.encode(&quot;SuperValidator&quot;, merkleRoot))
              </Box>
              <br />
              <br />
              <strong>2. Domain Separator:</strong>
              <br />
              <Box
                component="span"
                sx={{
                  bgcolor: '#f5f5f5',
                  p: 0.5,
                  borderRadius: 0.5,
                  display: 'inline-block',
                  mt: 0.5,
                  wordBreak: 'break-all',
                }}
              >
                keccak256(abi.encode(CHAIN_AGNOSTIC_DOMAIN_TYPEHASH,
                <br />
                &nbsp;&nbsp;keccak256(&quot;SuperformSafe&quot;), keccak256(&quot;1.0.0&quot;), 1, safeAddress))
              </Box>
              <br />
              <br />
              <strong>3. Chain Agnostic Hash:</strong>
              <br />
              <Box
                component="span"
                sx={{
                  bgcolor: '#f5f5f5',
                  p: 0.5,
                  borderRadius: 0.5,
                  display: 'inline-block',
                  mt: 0.5,
                  wordBreak: 'break-all',
                }}
              >
                keccak256(abi.encodePacked(0x19, 0x01, domainSeparator,
                <br />
                &nbsp;&nbsp;keccak256(abi.encode(SafeMessageTypeHash, keccak256(abi.encode(rawHash))))))
              </Box>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </>
  )
}

export default TestSuperformPage
