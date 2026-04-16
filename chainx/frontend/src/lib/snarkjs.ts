/**
 * snarkjs browser helper.
 * Wraps snarkjs.groth16.fullProve with typed inputs for the delivery circuit.
 */
import { groth16 } from 'snarkjs'

export interface DeliveryCircuitInput {
  // Private
  agentGpsLat: string
  agentGpsLon: string
  agentTimestamp: string
  customerOtp: string
  customerSigHash: string
  // Public
  productId: string
  windowStart: string
  windowEnd: string
  committedHash: string
}

export interface Groth16Proof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
  protocol: string
  curve: string
}

export interface ProofOutput {
  proof: Groth16Proof
  publicSignals: string[]
}

/**
 * Generate a Groth16 proof in-browser using snarkjs.
 * @param input    Full circuit input object.
 * @param wasmUrl  URL to delivery_proof.wasm (in /public or CDN).
 * @param zkeyUrl  URL to delivery_final.zkey (in /public or CDN).
 */
export async function generateDeliveryProof(
  input: DeliveryCircuitInput,
  wasmUrl: string,
  zkeyUrl: string
): Promise<ProofOutput> {
  const { proof, publicSignals } = await groth16.fullProve(input, wasmUrl, zkeyUrl)
  return { proof: proof as Groth16Proof, publicSignals }
}

/**
 * Convert snarkjs proof output to Solidity calldata format.
 * Returns the [pA, pB, pC, pubSignals] tuple expected by ZKVerifier.verifyProof.
 */
export function proofToCalldata(output: ProofOutput): {
  pA: [bigint, bigint]
  pB: [[bigint, bigint], [bigint, bigint]]
  pC: [bigint, bigint]
  pubSignals: [bigint, bigint, bigint, bigint]
} {
  const { proof, publicSignals } = output

  return {
    pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    pB: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
    pubSignals: [
      BigInt(publicSignals[0]),
      BigInt(publicSignals[1]),
      BigInt(publicSignals[2]),
      BigInt(publicSignals[3]),
    ],
  }
}