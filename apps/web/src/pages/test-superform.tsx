import Head from 'next/head'
import { useEffect, useState } from 'react'
import { Box, Button, Typography, Paper, Alert } from '@mui/material'
import SafeAppsSDK from '@safe-global/safe-apps-sdk'
import type { EIP712TypedData } from '@safe-global/safe-apps-sdk'

const TestSuperformPage = () => {
  const [sdk, setSdk] = useState<SafeAppsSDK | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const safeAppsSDK = new SafeAppsSDK({
      allowedDomains: [/localhost/, /app\.safe\.global/],
      debug: true,
    })
    setSdk(safeAppsSDK)
  }, [])

  const testSuperformSignature = async () => {
    if (!sdk) return

    setLoading(true)
    setError('')
    setResult('')

    try {
      // This will be automatically converted to use SuperformSafe domain by your integration
      const typedData: EIP712TypedData = {
        domain: {
          name: 'TestApp', // This gets converted to 'SuperformSafe' automatically
          version: '1.0.0',
          chainId: 42, // This gets converted to chainId=1 automatically
          verifyingContract: '0x1234567890123456789012345678901234567890',
        },
        types: {
          TestMessage: [
            { name: 'content', type: 'string' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        message: {
          content: 'Testing Superform cross-chain signature!',
          timestamp: Math.floor(Date.now() / 1000),
          nonce: Math.floor(Math.random() * 1000000),
        },
      }

      console.log('Original typed data (will be converted):', typedData)

      // Your integration automatically converts this to use SuperformSafe domain
      const signature = await sdk.txs.signTypedMessage(typedData)

      setResult(`Signature: ${JSON.stringify(signature)}`)
      console.log('Received signature (using SuperformSafe domain):', signature)
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
      console.error('Signature error:', err)
    } finally {
      setLoading(false)
    }
  }

  const testSimpleMessage = async () => {
    if (!sdk) return

    setLoading(true)
    setError('')
    setResult('')

    try {
      const message = 'Hello from Superform! This should use the custom domain.'

      console.log('Requesting message signature:', message)

      // Use the SDK's txs.signMessage method
      const signature = await sdk.txs.signMessage(message)

      setResult(`Message Signature: ${JSON.stringify(signature)}`)
      console.log('Received message signature:', signature)
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
      console.error('Message signature error:', err)
    } finally {
      setLoading(false)
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
          🔐 Superform Signature Test
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }}>
          This app tests the Superform cross-chain signature integration. Any signature request is automatically
          converted to use the &quot;SuperformSafe&quot; domain with chainId=1 for cross-chain compatibility.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Integration Status:</strong> Your Safe wallet provider automatically converts ALL signature requests
            to use:
            <br />• Domain: &quot;SuperformSafe&quot;
            <br />• Version: &quot;1.0.0&quot;
            <br />• Chain ID: 1 (fixed for cross-chain)
            <br />• Compatible with ChainAgnosticSafeSignatureValidation.sol
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Test Typed Message Signature
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Tests EIP-712 typed data signature with Superform domain
          </Typography>
          <Button variant="contained" onClick={testSuperformSignature} disabled={loading || !sdk} sx={{ mr: 2 }}>
            {loading ? 'Signing...' : 'Sign Typed Message'}
          </Button>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Test Simple Message Signature
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Tests simple string message signature with Superform domain
          </Typography>
          <Button variant="contained" color="secondary" onClick={testSimpleMessage} disabled={loading || !sdk}>
            {loading ? 'Signing...' : 'Sign Message'}
          </Button>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
        )}

        {result && (
          <Paper sx={{ p: 3, bgcolor: 'success.light' }}>
            <Typography variant="h6" gutterBottom>
              ✅ Signature Result
            </Typography>
            <Typography
              variant="body2"
              sx={{
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            >
              {result}
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              This signature was generated using the SuperformSafe domain (chainId=1) and is compatible with
              ChainAgnosticSafeSignatureValidation.sol
            </Alert>
          </Paper>
        )}

        <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            🔍 Technical Details
          </Typography>
          <Typography variant="body2" component="div">
            <strong>Domain:</strong> &quot;SuperformSafe&quot;
            <br />
            <strong>Version:</strong> &quot;1.0.0&quot;
            <br />
            <strong>Chain ID:</strong> 1 (fixed for cross-chain compatibility)
            <br />
            <strong>Integration:</strong> All signatures automatically use Superform domain
            <br />
            <strong>Compatibility:</strong> Works with ChainAgnosticSafeSignatureValidation.sol
          </Typography>
        </Paper>
      </Box>
    </>
  )
}

export default TestSuperformPage
