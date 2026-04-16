pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/**
 * DeliveryProof
 * =============
 * Proves that a delivery was completed by both the delivery agent AND the
 * customer, without revealing either party's raw inputs to the other.
 *
 * Private inputs
 * ──────────────
 * agentGpsLat       : latitude  × 1e6  (integer, e.g. 28613900)
 * agentGpsLon       : longitude × 1e6
 * agentTimestamp    : Unix timestamp of GPS reading
 * customerOtp       : 6-digit OTP provided by customer
 * customerSigHash   : Poseidon hash of (customerAddress, productId, nonce)
 *
 * Public inputs / outputs
 * ───────────────────────
 * productId         : on-chain product token ID
 * windowStart       : delivery window open  (Unix timestamp)
 * windowEnd         : delivery window close (Unix timestamp)
 * committedHash     : Poseidon(agentGpsLat, agentGpsLon, agentTimestamp,
 *                              customerOtp, customerSigHash, productId)
 *                     stored on-chain when escrow is created
 *
 * The circuit asserts:
 *   1. agentTimestamp ∈ [windowStart, windowEnd]
 *   2. Poseidon(all private inputs, productId) == committedHash
 */
template DeliveryProof() {
    // ── Private inputs ───────────────────────────────────────────────────────
    signal input agentGpsLat;
    signal input agentGpsLon;
    signal input agentTimestamp;
    signal input customerOtp;
    signal input customerSigHash;

    // ── Public inputs ────────────────────────────────────────────────────────
    signal input productId;
    signal input windowStart;
    signal input windowEnd;
    signal input committedHash;   // stored in escrow at creation time

    // ── Constraint 1: timestamp inside delivery window ───────────────────────
    //   windowStart <= agentTimestamp  (ts - windowStart >= 0)
    component geStart = GreaterEqThan(64);
    geStart.in[0] <== agentTimestamp;
    geStart.in[1] <== windowStart;
    geStart.out === 1;

    //   agentTimestamp <= windowEnd
    component leEnd = LessEqThan(64);
    leEnd.in[0] <== agentTimestamp;
    leEnd.in[1] <== windowEnd;
    leEnd.out === 1;

    // ── Constraint 2: hash of all private inputs matches committedHash ────────
    //   We use Poseidon(6 inputs) for gas-efficient on-chain verification.
    component h = Poseidon(6);
    h.inputs[0] <== agentGpsLat;
    h.inputs[1] <== agentGpsLon;
    h.inputs[2] <== agentTimestamp;
    h.inputs[3] <== customerOtp;
    h.inputs[4] <== customerSigHash;
    h.inputs[5] <== productId;

    committedHash === h.out;
}

component main { public [productId, windowStart, windowEnd, committedHash] } = DeliveryProof();