import { useReadContract, usePublicClient } from 'wagmi'
import { useEffect, useState } from 'react'
import { type Address, parseAbiItem, type Log } from 'viem'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: bigint
  metadata: string
  originHash: `0x${string}`
  manufacturer: Address
  currentHolder: Address
  mintedAt: bigint
  exists: boolean
}

export interface CustodyRecord {
  from: Address
  to: Address
  timestamp: bigint
  gpsHash: `0x${string}`
}

export interface CustodyEvent {
  from: Address
  to: Address
  timestamp: bigint
  gpsHash: `0x${string}`
  blockNumber: bigint
  txHash: `0x${string}`
}

// ── ABI fragments ────────────────────────────────────────────────────────────

const PRODUCT_REGISTRY_ABI = [
  {
    name: 'getProduct',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'productId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id',            type: 'uint256' },
          { name: 'metadata',      type: 'string'  },
          { name: 'originHash',    type: 'bytes32' },
          { name: 'manufacturer',  type: 'address' },
          { name: 'currentHolder', type: 'address' },
          { name: 'mintedAt',      type: 'uint256' },
          { name: 'exists',        type: 'bool'    },
        ],
      },
    ],
  },
  {
    name: 'getCustodyLog',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'productId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'from',      type: 'address' },
          { name: 'to',        type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'gpsHash',   type: 'bytes32' },
        ],
      },
    ],
  },
] as const

const CUSTODY_TRANSFERRED_EVENT = parseAbiItem(
  'event CustodyTransferred(uint256 indexed productId, address indexed from, address indexed to, uint256 timestamp, bytes32 gpsHash)'
)

// ── Hook: useProductData ─────────────────────────────────────────────────────

export function useProductData(
  productRegistryAddress: Address | undefined,
  productId: bigint | undefined
) {
  const enabled = !!productRegistryAddress && productId !== undefined

  const { data: product, isLoading: productLoading, error: productError } =
    useReadContract({
      address: productRegistryAddress,
      abi: PRODUCT_REGISTRY_ABI,
      functionName: 'getProduct',
      args: productId !== undefined ? [productId] : undefined,
      query: { enabled },
    })

  const { data: custodyLog, isLoading: custodyLoading, error: custodyError } =
    useReadContract({
      address: productRegistryAddress,
      abi: PRODUCT_REGISTRY_ABI,
      functionName: 'getCustodyLog',
      args: productId !== undefined ? [productId] : undefined,
      query: { enabled },
    })

  return {
    product: product as Product | undefined,
    custodyLog: custodyLog as CustodyRecord[] | undefined,
    isLoading: productLoading || custodyLoading,
    error: productError ?? custodyError,
  }
}

// ── Hook: useCustodyEvents (via viem getLogs) ────────────────────────────────

export function useCustodyEvents(
  productRegistryAddress: Address | undefined,
  productId: bigint | undefined
) {
  const client = usePublicClient()
  const [events, setEvents] = useState<CustodyEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!client || !productRegistryAddress || productId === undefined) return

    let cancelled = false

    async function fetchLogs() {
      setIsLoading(true)
      setError(null)
      try {
        const logs = await client!.getLogs({
          address: productRegistryAddress,
          event: CUSTODY_TRANSFERRED_EVENT,
          args: { productId },
          fromBlock: 0n,
          toBlock: 'latest',
        })

        if (cancelled) return

        const parsed: CustodyEvent[] = (logs as Log[]).map((log: any) => ({
          from:        log.args.from      as Address,
          to:          log.args.to        as Address,
          timestamp:   log.args.timestamp as bigint,
          gpsHash:     log.args.gpsHash   as `0x${string}`,
          blockNumber: log.blockNumber    ?? 0n,
          txHash:      log.transactionHash as `0x${string}`,
        }))

        setEvents(parsed)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchLogs()
    return () => { cancelled = true }
  }, [client, productRegistryAddress, productId])

  return { events, isLoading, error }
}