#!/usr/bin/env bash
# circuits/scripts/trusted-setup.sh
# Full trusted setup for the DeliveryProof circuit.
# Run once from repo root: bash circuits/scripts/trusted-setup.sh
#
# Requirements:
#   circom   >= 2.1.6  (https://docs.circom.io/getting-started/installation/)
#   snarkjs  >= 0.7    (npm i -g snarkjs)
#   jq, wget

set -euo pipefail

CIRCUITS_DIR="chainx/circuits"
BUILD_DIR="$CIRCUITS_DIR/build"
KEYS_DIR="$CIRCUITS_DIR/keys"
CIRCOM_FILE="$CIRCUITS_DIR/delivery/delivery_proof.circom"
CIRCUIT_NAME="delivery_proof"

# Powers of Tau file — 2^16 constraints (enough for Poseidon 6-input)
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau"
PTAU_FILE="$KEYS_DIR/pot16_final.ptau"

mkdir -p "$BUILD_DIR" "$KEYS_DIR"

# ── Step 1: Download Powers of Tau ────────────────────────────────────────────
if [[ ! -f "$PTAU_FILE" ]]; then
  echo "▶ Downloading Powers of Tau (phase 1)..."
  wget -q --show-progress "$PTAU_URL" -O "$PTAU_FILE"
else
  echo "▶ Powers of Tau already present, skipping download."
fi

# ── Step 2: Compile circuit ───────────────────────────────────────────────────
echo "▶ Compiling circuit..."
circom "$CIRCOM_FILE" \
  --r1cs \
  --wasm \
  --sym \
  -o "$BUILD_DIR"

echo "  Constraints: $(snarkjs r1cs info "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" 2>/dev/null | grep 'Constraints' || echo 'see r1cs info')"

# ── Step 3: Phase 2 ceremony ──────────────────────────────────────────────────
echo "▶ Running phase 2 setup (groth16)..."
snarkjs groth16 setup \
  "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" \
  "$PTAU_FILE" \
  "$KEYS_DIR/${CIRCUIT_NAME}_0000.zkey"

echo "▶ Contributing to ceremony..."
echo "ChainX contributor entropy $(date)" | snarkjs zkey contribute \
  "$KEYS_DIR/${CIRCUIT_NAME}_0000.zkey" \
  "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  --name "ChainX contributor 1" -v -e "$(openssl rand -hex 32)"

# ── Step 4: Export verification key ──────────────────────────────────────────
echo "▶ Exporting verification key..."
snarkjs zkey export verificationkey \
  "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  "$KEYS_DIR/verification_key.json"

# ── Step 5: Export Solidity verifier ─────────────────────────────────────────
echo "▶ Exporting Solidity verifier..."
snarkjs zkey export solidityverifier \
  "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  "chainx/contracts/src/ZKVerifier.sol"

# ── Step 6: Copy WASM to frontend public ─────────────────────────────────────
echo "▶ Copying wasm + zkey to frontend/public/circuits/ ..."
mkdir -p chainx/frontend/public/circuits
cp "$BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" \
   chainx/frontend/public/circuits/delivery_proof.wasm
cp "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
   chainx/frontend/public/circuits/delivery_final.zkey

echo ""
echo "✅ Trusted setup complete."
echo "   Verification key : $KEYS_DIR/verification_key.json"
echo "   Final zkey        : $KEYS_DIR/${CIRCUIT_NAME}_final.zkey"
echo "   Solidity verifier : chainx/contracts/src/ZKVerifier.sol"
echo "   Frontend wasm     : chainx/frontend/public/circuits/delivery_proof.wasm"