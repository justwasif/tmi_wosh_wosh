import { useState, useCallback, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import { generateDeliveryProof, proofToCalldata, type DeliveryCircuitInput } from '@/lib/snarkjs'

const WASM_URL = '/circuits/delivery_proof.wasm'
const ZKEY_URL = '/circuits/delivery_final.zkey'

// ── Minimal ABI stub until wagmi generate runs ──────────────────────────────
// FIX: moved above the hook that references it (was defined after — ReferenceError at runtime)
const ESCROW_ABI_STUB = [
  {
    name: 'submitProof',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'escrowId',   type: 'uint256' },
      { name: 'pA',         type: 'uint256[2]' },
      { name: 'pB',         type: 'uint256[2][2]' },
      { name: 'pC',         type: 'uint256[2]' },
      { name: 'pubSignals', type: 'uint256[4]' },
    ],
    outputs: [],
  },
] as const

export type ProofStep =
  | 'idle'
  | 'generating'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'error'

export interface UseDeliveryProofOptions {
  escrowAddress: Address
  escrowId: bigint
}

export interface UseDeliveryProofReturn {
  step: ProofStep
  txHash: `0x${string}` | undefined
  error: Error | null
  submit: (input: DeliveryCircuitInput) => Promise<void>
  reset: () => void
}

export function useDeliveryProof({
  escrowAddress,
  escrowId,
}: UseDeliveryProofOptions): UseDeliveryProofReturn {
  const [step, setStep] = useState<ProofStep>('idle')
  const [error, setError] = useState<Error | null>(null)

  const { writeContractAsync, data: txHash } = useWriteContract()

  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // FIX: calling setState directly in the render body causes an infinite re-render loop.
  // Use useEffect to react to isConfirmed changing.
  useEffect(() => {
    if (isConfirmed && step === 'confirming') {
      setStep('confirmed')
    }
  }, [isConfirmed, step])

  const submit = useCallback(
    async (input: DeliveryCircuitInput) => {
      try {
        setError(null)

        // Step 1 — Generate proof in-browser
        setStep('generating')
        const proofOutput = await generateDeliveryProof(input, WASM_URL, ZKEY_URL)
        const { pA, pB, pC, pubSignals } = proofToCalldata(proofOutput)

        // Step 2 — Submit proof on-chain
        setStep('submitting')
        await writeContractAsync({
          address: escrowAddress,
          abi: ESCROW_ABI_STUB,
          functionName: 'submitProof',
          args: [
            escrowId,
            [pA[0], pA[1]] as const,
            [[pB[0][0], pB[0][1]], [pB[1][0], pB[1][1]]] as const,
            [pC[0], pC[1]] as const,
            [pubSignals[0], pubSignals[1], pubSignals[2], pubSignals[3]] as const,
          ],
        })

        // Step 3 — Wait for confirmation
        setStep('confirming')
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setStep('error')
      }
    },
    [escrowAddress, escrowId, writeContractAsync]
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
  }, [])

  return { step, txHash, error, submit, reset }
}
