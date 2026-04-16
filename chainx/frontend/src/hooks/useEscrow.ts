import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EscrowState = 0 | 1 | 2 // Active | Released | Refunded

export interface EscrowRecord {
  productId:     bigint
  buyer:         Address
  agent:         Address
  amount:        bigint
  deadline:      bigint
  committedHash: `0x${string}`
  windowStart:   bigint
  windowEnd:     bigint
  state:         EscrowState
}

// ── ABI ───────────────────────────────────────────────────────────────────────

export const ESCROW_ABI = [
  {
    name: 'getEscrow',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'productId',     type: 'uint256' },
          { name: 'buyer',         type: 'address' },
          { name: 'agent',         type: 'address' },
          { name: 'amount',        type: 'uint256' },
          { name: 'deadline',      type: 'uint256' },
          { name: 'committedHash', type: 'bytes32' },
          { name: 'windowStart',   type: 'uint256' },
          { name: 'windowEnd',     type: 'uint256' },
          { name: 'state',         type: 'uint8'   },
        ],
      },
    ],
  },
  {
    name: 'totalEscrows',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'cancelEscrow',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [],
  },
] as const

// ── Hook: useEscrow ───────────────────────────────────────────────────────────

export function useEscrow(escrowAddress: Address | undefined, escrowId: bigint | undefined) {
  const enabled = !!escrowAddress && escrowId !== undefined

  const { data, isLoading, error, refetch } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: 'getEscrow',
    args: escrowId !== undefined ? [escrowId] : undefined,
    query: { enabled },
  })

  return {
    escrow: data as EscrowRecord | undefined,
    isLoading,
    error,
    refetch,
  }
}

// ── Hook: useTotalEscrows ─────────────────────────────────────────────────────

export function useTotalEscrows(escrowAddress: Address | undefined) {
  const { data, isLoading } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: 'totalEscrows',
    query: { enabled: !!escrowAddress },
  })
  return { total: data as bigint | undefined, isLoading }
}

// ── Hook: useCancelEscrow ─────────────────────────────────────────────────────

export function useCancelEscrow() {
  const { writeContractAsync, data: txHash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  async function cancel(escrowAddress: Address, escrowId: bigint) {
    return writeContractAsync({
      address: escrowAddress,
      abi: ESCROW_ABI,
      functionName: 'cancelEscrow',
      args: [escrowId],
    })
  }

  return { cancel, isPending, isSuccess, txHash }
}