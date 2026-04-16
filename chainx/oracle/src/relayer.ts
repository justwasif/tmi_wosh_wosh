/**
 * oracle/src/relayer.ts
 *
 * GPS Oracle Relayer — reads GPS hashes from GpsTracker and submits them
 * on-chain via ProductRegistry.logLocation(productId, gpsHash).
 *
 * Configuration via .env:
 *   ORACLE_RPC_URL          RPC endpoint (default: http://127.0.0.1:8545)
 *   ORACLE_PRIVATE_KEY      Private key of oracle wallet (registered stakeholder)
 *   ORACLE_PRODUCT_IDS      Comma-separated product IDs to track
 *   ORACLE_INTERVAL_MS      Poll interval in ms (default: 30000)
 *   PRODUCT_REGISTRY_ADDRESS On-chain address of ProductRegistry
 */

import 'dotenv/config'
import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry, sepolia } from 'viem/chains'
import { GpsTracker, type GpsReading } from './tracker.js'

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = process.env.ORACLE_RPC_URL ?? 'http://127.0.0.1:8545'
const PRIVATE_KEY  = process.env.ORACLE_PRIVATE_KEY as `0x${string}` | undefined
const PRODUCT_IDS  = (process.env.ORACLE_PRODUCT_IDS ?? '1').split(',').map(s => s.trim())
const INTERVAL_MS  = parseInt(process.env.ORACLE_INTERVAL_MS ?? '30000', 10)
const REGISTRY_ADDR = process.env.PRODUCT_REGISTRY_ADDRESS as Address | undefined

if (!PRIVATE_KEY) {
  console.error('❌  ORACLE_PRIVATE_KEY not set')
  process.exit(1)
}

if (!REGISTRY_ADDR) {
  console.error('❌  PRODUCT_REGISTRY_ADDRESS not set')
  process.exit(1)
}

// ── ABI ───────────────────────────────────────────────────────────────────────

const PRODUCT_REGISTRY_ABI = [
  {
    name: 'logLocation',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'productId', type: 'uint256' },
      { name: 'gpsHash',   type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

// ── Viem clients ──────────────────────────────────────────────────────────────

const chain  = RPC_URL.includes('127.0.0.1') || RPC_URL.includes('localhost') ? foundry : sepolia
const account = privateKeyToAccount(PRIVATE_KEY)

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(RPC_URL),
})

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
})

console.log(`[Relayer] Oracle wallet: ${account.address}`)
console.log(`[Relayer] RPC:           ${RPC_URL}`)
console.log(`[Relayer] Registry:      ${REGISTRY_ADDR}`)
console.log(`[Relayer] Products:      ${PRODUCT_IDS.join(', ')}`)

// ── On-chain submission ───────────────────────────────────────────────────────

async function submitLocation(reading: GpsReading): Promise<void> {
  try {
    const productIdBigInt = BigInt(reading.productId)

    const txHash = await walletClient.writeContract({
      address: REGISTRY_ADDR!,
      abi: PRODUCT_REGISTRY_ABI,
      functionName: 'logLocation',
      args: [productIdBigInt, reading.hash as `0x${string}`],
    })

    console.log(`[Relayer] ✓ logLocation tx submitted: ${txHash}`)

    // Optionally wait for receipt (blocking — remove for fire-and-forget)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    console.log(`[Relayer] ✓ confirmed in block ${receipt.blockNumber}`)
  } catch (err) {
    console.error(`[Relayer] ✗ Failed to submit GPS hash for product ${reading.productId}:`, err)
  }
}

// ── Start trackers ────────────────────────────────────────────────────────────

async function main() {
  // Quick connectivity check
  try {
    const blockNumber = await publicClient.getBlockNumber()
    console.log(`[Relayer] Connected — current block: ${blockNumber}`)
  } catch {
    console.error('[Relayer] ❌  Cannot connect to RPC. Check ORACLE_RPC_URL.')
    process.exit(1)
  }

  for (const productId of PRODUCT_IDS) {
    const tracker = new GpsTracker({
      productId,
      intervalMs: INTERVAL_MS,
    })

    tracker.on('reading', (reading: GpsReading) => {
      submitLocation(reading)
    })

    tracker.start()
  }

  console.log(`[Relayer] 🟢 Relayer running. Tracking ${PRODUCT_IDS.length} product(s).`)
  console.log(`[Relayer] Press Ctrl+C to stop.`)

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n[Relayer] Shutting down...')
    process.exit(0)
  })
}

main()