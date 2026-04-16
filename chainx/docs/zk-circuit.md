# ZK Delivery Circuit

## Overview

The `DeliveryProof` circuit proves that a delivery was completed by **both** the delivery agent and the customer — without revealing either party's raw inputs to the chain.

## Circuit file

```
circuits/delivery/delivery_proof.circom
```

Uses **Circom 2.1.6** + **circomlib** (Poseidon hash, GreaterEqThan, LessEqThan).

---

## Inputs

| Signal | Visibility | Description |
|---|---|---|
| `agentGpsLat` | **private** | Latitude × 1 000 000 (integer) |
| `agentGpsLon` | **private** | Longitude × 1 000 000 (integer) |
| `agentTimestamp` | **private** | Unix timestamp of GPS reading |
| `customerOtp` | **private** | 6-digit OTP shown to customer |
| `customerSigHash` | **private** | Poseidon(customerAddress, productId, nonce) |
| `productId` | **public** | On-chain product token ID |
| `windowStart` | **public** | Delivery window open (Unix timestamp) |
| `windowEnd` | **public** | Delivery window close (Unix timestamp) |
| `committedHash` | **public** | Poseidon of all private inputs + productId — stored in escrow at creation |

---

## Constraints

### 1 — Timestamp in window

```
windowStart ≤ agentTimestamp ≤ windowEnd
```

Implemented with `GreaterEqThan(64)` and `LessEqThan(64)` from circomlib.

### 2 — Hash pre-image check

```
Poseidon(agentGpsLat, agentGpsLon, agentTimestamp,
         customerOtp, customerSigHash, productId)
  == committedHash
```

The `committedHash` is stored on-chain when the buyer creates the escrow.  
Both parties derive it off-chain and agree before any delivery starts.

---

## Threat model

| Attack | Mitigation |
|---|---|
| Agent submits fake GPS | GPS hash is in the committed pre-image; wrong coords → proof fails |
| Customer refuses OTP | OTP hash is in the committed pre-image; escrow times out → refund |
| Replay attack | `nonce` inside `customerSigHash` is unique per escrow |
| Proof forgery | Groth16 soundness (trusted setup via Powers of Tau) |

---

## Trusted setup

```bash
# 1. Download Powers of Tau (phase 1, 2^16 constraints)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau \
  -O circuits/keys/pot16_final.ptau

# 2. Compile circuit
circom circuits/delivery/delivery_proof.circom \
  --r1cs --wasm --sym \
  -o circuits/build/

# 3. Phase 2 ceremony
snarkjs groth16 setup \
  circuits/build/delivery_proof.r1cs \
  circuits/keys/pot16_final.ptau \
  circuits/keys/delivery_0000.zkey

snarkjs zkey contribute \
  circuits/keys/delivery_0000.zkey \
  circuits/keys/delivery_final.zkey \
  --name "ChainX contributor 1" -v

# 4. Export verification key
snarkjs zkey export verificationkey \
  circuits/keys/delivery_final.zkey \
  circuits/keys/verification_key.json

# 5. Export Solidity verifier
snarkjs zkey export solidityverifier \
  circuits/keys/delivery_final.zkey \
  contracts/src/ZKVerifier.sol
```

---

## Proof generation (Node.js / browser)

See `circuits/scripts/generate_proof.ts` for the Node.js helper and  
`frontend/src/hooks/useDeliveryProof.ts` for the in-browser snarkjs flow.

Input format (`delivery_proof.json`):

```json
{
  "agentGpsLat":    "28613900",
  "agentGpsLon":    "77209000",
  "agentTimestamp": "1713340800",
  "customerOtp":    "483921",
  "customerSigHash": "<poseidon hash as decimal string>",
  "productId":      "1",
  "windowStart":    "1713340000",
  "windowEnd":      "1713344400",
  "committedHash":  "<poseidon hash as decimal string>"
}
```