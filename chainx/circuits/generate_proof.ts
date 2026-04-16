#!/usr/bin/env tsx
/**
 * circuits/scripts/generate_proof.ts
 *
 * Node.js helper: accepts delivery circuit inputs and outputs
 * a proof + public signals JSON, plus Solidity calldata.
 *
 * Usage:
 *   npx tsx circuits/scripts/generate_proof.ts \
 *     --input circuits/delivery/delivery_proof.json \
 *     --wasm  circuits/build/delivery_proof_js/delivery_proof.wasm \
 *     --zkey  circuits/keys/delivery_proof_final.zkey \
 *     --out   circuits/build/
 *
 * Or pipe JSON directly:
 *   echo '{"agentGpsLat":"28613900",...}' | \
 *     npx tsx circuits/scripts/generate_proof.ts --stdin
 */

import { groth16 } from 'snarkjs'
import * as fs from 'fs'
import * as path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryCircuitInput {
  agentGpsLat: string
  agentGpsLon: string
  agentTimestamp: string
  customerOtp: string
  customerSigHash: string
  productId: string
  windowStart: string
  windowEnd: string
  committedHash: string
}

interface ProofCalldata {
  pA: [string, string]
  pB: [[string, string], [string, string]]
  pC: [string, string]
  pubSignals: [string, string, string, string]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs(): {
  inputFile: string | null
  wasmFile: string
  zkeyFile: string
  outDir: string
  stdin: boolean
} {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : null
  }

  return {
    inputFile: get('--input'),
    wasmFile: get('--wasm') ?? 'circuits/build/delivery_proof_js/delivery_proof.wasm',
    zkeyFile: get('--zkey') ?? 'circuits/keys/delivery_proof_final.zkey',
    outDir: get('--out') ?? 'circuits/build',
    stdin: args.includes('--stdin'),
  }
}

function proofToCalldata(proof: any, publicSignals: string[]): ProofCalldata {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      // snarkjs returns G2 in opposite order from Solidity
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
    pubSignals: [
      publicSignals[0],
      publicSignals[1],
      publicSignals[2],
      publicSignals[3],
    ],
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { inputFile, wasmFile, zkeyFile, outDir, stdin } = parseArgs()

  // Load input
  let input: DeliveryCircuitInput

  if (stdin) {
    const raw = fs.readFileSync('/dev/stdin', 'utf-8')
    input = JSON.parse(raw)
  } else if (inputFile) {
    input = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } else {
    // Use example values for smoke-testing
    console.warn('⚠  No --input or --stdin; using example values')
    input = {
      agentGpsLat:    '28613900',
      agentGpsLon:    '77209000',
      agentTimestamp: '1713340800',
      customerOtp:    '483921',
      customerSigHash: '12345678901234567890123456789012345678901234567890123456789012',
      productId:      '1',
      windowStart:    '1713340000',
      windowEnd:      '1713344400',
      committedHash:  '98765432109876543210987654321098765432109876543210987654321098',
    }
  }

  // Validate files exist
  for (const [label, file] of [['wasm', wasmFile], ['zkey', zkeyFile]] as const) {
    if (!fs.existsSync(file)) {
      console.error(`✗ ${label} file not found: ${file}`)
      console.error('  Run circuits/scripts/trusted-setup.sh first.')
      process.exit(1)
    }
  }

  console.log('▶ Generating Groth16 proof...')
  console.log('  Input:', JSON.stringify(input, null, 2))

  const { proof, publicSignals } = await groth16.fullProve(input, wasmFile, zkeyFile)

  console.log('▶ Proof generated successfully.')
  console.log('  Public signals:', publicSignals)

  // Convert to Solidity calldata
  const calldata = proofToCalldata(proof, publicSignals)

  // Write outputs
  fs.mkdirSync(outDir, { recursive: true })

  const proofPath   = path.join(outDir, 'proof.json')
  const publicPath  = path.join(outDir, 'public.json')
  const calldataPath = path.join(outDir, 'calldata.json')

  fs.writeFileSync(proofPath,    JSON.stringify(proof, null, 2))
  fs.writeFileSync(publicPath,   JSON.stringify(publicSignals, null, 2))
  fs.writeFileSync(calldataPath, JSON.stringify(calldata, null, 2))

  console.log('')
  console.log('✅ Output written:')
  console.log('   proof.json    :', proofPath)
  console.log('   public.json   :', publicPath)
  console.log('   calldata.json :', calldataPath)

  // Print Solidity calldata for easy copy-paste
  console.log('')
  console.log('── Solidity calldata ─────────────────────────────────────────────')
  console.log('pA         :', calldata.pA)
  console.log('pB         :', calldata.pB)
  console.log('pC         :', calldata.pC)
  console.log('pubSignals :', calldata.pubSignals)

  // Verify proof locally against verification key
  const vkeyPath = zkeyFile.replace('_final.zkey', '').replace(/\/[^/]+$/, '') 
    + '/verification_key.json'
    
  if (fs.existsSync(vkeyPath)) {
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'))
    const isValid = await groth16.verify(vkey, publicSignals, proof)
    console.log('')
    console.log('▶ Local proof verification:', isValid ? '✅ VALID' : '❌ INVALID')
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})