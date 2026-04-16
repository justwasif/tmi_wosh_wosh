# ⛓️ ChainX — ZK-Powered L2 Supply Chain Protocol

> **Trustless. Transparent. Tamper-proof.**  
> A Zero-Knowledge rollup system for end-to-end supply chain integrity — from factory floor to final delivery.

---

## 🧭 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Smart Contracts](#smart-contracts)
- [ZK Circuit](#zk-circuit)
- [Product Traceability](#product-traceability)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 📌 Overview

ChainX is a ZK-powered Layer 2 supply chain protocol that brings cryptographic guarantees to every step of a product's journey. By combining custom rollup infrastructure with Zero-Knowledge proofs and on-chain escrow logic, ChainX eliminates fraud, disputes, and opacity across the supply chain — without requiring any party to trust another.

**Core Problems Solved:**
- ❌ Counterfeit goods entering the supply chain
- ❌ Disputed deliveries with no verifiable proof
- ❌ Opaque custody transfers between stakeholders
- ❌ Delayed payments due to manual verification

**ChainX Guarantees:**
- ✅ Cryptographic proof of delivery (ZK fair delivery circuit)
- ✅ Tamper-proof custody trail from manufacture to doorstep
- ✅ Automatic escrow release upon verified delivery
- ✅ Public product traceability via NFT-based ledger

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Ethereum L1 (Finality)              │
│              Anchored State Roots / Batches          │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              ChainX L2 Rollup Layer                  │
│  (Polygon CDK / OP Stack / Tendermint Sovereign)     │
│                                                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │Manufacturer│  │ Distributor │  │   Retailer   │  │
│  │    Node    │  │    Node     │  │     Node     │  │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  │
│        │                │                │           │
│        └────────────────▼────────────────┘           │
│                  Product Ledger                      │
│         (Custody Transfers + Signed Events)          │
└─────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              ZK Fair Delivery Layer                  │
│                                                      │
│   Agent Input:          Customer Input:              │
│   GPS + Timestamp  ──►  OTP + Signature              │
│   + Product Hash        │                            │
│          │              │                            │
│          └──── ZK Circuit ────► Verifier Contract    │
│                                        │             │
│                               Escrow Auto-Release    │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ How It Works

### 1. 🏭 Product Minting at Manufacture
When a product is manufactured, it is minted as an NFT/token on the ChainX L2 chain. Each product gets a unique on-chain identity with a hash representing its metadata (origin, batch, specifications).

### 2. 🚚 Custody Transfer & State Updates
As the product moves through the supply chain (manufacturer → distributor → retailer → delivery), each handoff appends a **signed custody event** to the product's on-chain ledger. State changes include:
- `MANUFACTURED` → `SHIPPED` → `IN_TRANSIT` → `RECEIVED` → `INSPECTED` → `DELIVERED`

### 3. 🔐 ZK Fair Delivery Circuit
The centerpiece of ChainX. When a delivery occurs:

| Party | Private Input |
|-------|--------------|
| Delivery Agent | GPS coordinates + Timestamp + Product Hash |
| Customer | OTP (One-Time Password) + Digital Signature |

The **Circom/Noir circuit** verifies both inputs match expected delivery conditions and outputs a single proof. The **Escrow Verifier Contract** checks this proof and automatically releases payment — no intermediary, no disputes.

> Neither party sees the other's raw input. Only the proof is revealed.

### 4. 📦 Public Traceability
Anyone with a product ID (via QR code or NFC scan) can query the full chain of custody on the L2 ledger — verified all the way up to Ethereum L1 anchoring.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **L2 Rollup** | Polygon CDK / OP Stack / Tendermint (Sovereign) |
| **ZK Circuit** | Circom + snarkjs **or** Noir (recommended for readability) |
| **Smart Contracts** | Solidity — Escrow, Verifier, Product Registry |
| **Oracle / IoT Bridge** | Chainlink or Custom Relayer |
| **Frontend** | Next.js + ethers.js / wagmi |
| **L1 Anchoring** | Ethereum Mainnet |

---

## 📜 Smart Contracts

### `ProductRegistry.sol`
Handles product lifecycle on-chain:
- `mintProduct(bytes32 productHash, address manufacturer)` — Creates product NFT
- `transferCustody(uint256 tokenId, address to, bytes32 stateHash)` — Records custody handoff
- `getProductHistory(uint256 tokenId)` — Returns full chain of custody

### `EscrowManager.sol`
Holds payment in escrow until ZK proof is verified:
- `createEscrow(uint256 tokenId, address payable agent)` — Locks payment
- `releasePayment(uint256 tokenId, bytes calldata proof)` — Verifies proof → releases funds
- `raiseDispute(uint256 tokenId)` — Escalates unresolved delivery issues

### `DeliveryVerifier.sol`
Auto-generated from ZK circuit using snarkjs/Noir:
- `verifyProof(bytes calldata proof, uint256[] calldata publicInputs)` — Returns `bool`

---

## 🔮 ZK Circuit

The **Fair Delivery Circuit** is built in Circom (or Noir):

```
Inputs (Private):
  - agentGPS[2]       // latitude, longitude
  - agentTimestamp    // Unix timestamp
  - productHash       // keccak256 of product metadata
  - customerOTP       // One-time password
  - customerSig[2]    // r, s components of ECDSA signature

Public Inputs:
  - expectedDeliveryWindow  // [startTime, endTime]
  - expectedLocationHash    // Hash of delivery address coords
  - expectedProductHash     // Registry-stored product hash

Circuit Logic:
  1. Verify GPS falls within expected delivery geofence
  2. Verify timestamp is within delivery window
  3. Verify productHash matches registry
  4. Verify OTP is valid (poseidon hash check)
  5. Verify customer signature is authentic
  → Output: 1 proof (valid delivery) | 0 (invalid)
```

---

## 🔍 Product Traceability

Each product on ChainX is traceable via:

- **QR Code / NFC Tag** — Embedded at manufacture, links to product ID
- **On-chain Ledger** — Full signed event history on ChainX L2
- **L1 Anchored Roots** — Periodic batch proofs anchored to Ethereum for finality
- **Public Explorer UI** — Dashboard for real-time product journey visualization

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- Rust (for Noir, if used)
- Foundry (for smart contracts)
- snarkjs / Noir CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/chainx.git
cd chainx

# Install dependencies
npm install

# Install Foundry (smart contracts)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Compile ZK Circuit

```bash
# Using Circom
cd circuits/
circom delivery_proof.circom --r1cs --wasm --sym

# Generate proving/verification keys
snarkjs groth16 setup delivery_proof.r1cs pot12_final.ptau circuit_final.zkey
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

### Deploy Contracts

```bash
cd contracts/
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $L2_RPC_URL --broadcast
```

### Run Frontend

```bash
cd frontend/
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
chainx/
├── circuits/
│   ├── delivery_proof.circom       # ZK fair delivery circuit
│   ├── inputs/                     # Test input files
│   └── build/                      # Compiled artifacts
│
├── contracts/
│   ├── src/
│   │   ├── ProductRegistry.sol     # NFT + custody tracking
│   │   ├── EscrowManager.sol       # Payment escrow logic
│   │   └── DeliveryVerifier.sol    # ZK proof verifier (auto-generated)
│   ├── test/                       # Foundry tests
│   └── script/                     # Deployment scripts
│
├── frontend/
│   ├── pages/                      # Next.js routes
│   ├── components/                 # React UI components
│   │   ├── ProductJourney.tsx      # Live product trace dashboard
│   │   └── DeliveryProof.tsx       # ZK proof submission UI
│   └── lib/
│       ├── contracts.ts            # Contract ABIs + addresses
│       └── zkproof.ts              # Proof generation helpers
│
├── relayer/
│   └── oracle-bridge.ts            # Chainlink / IoT data relay
│
└── docs/
    └── architecture.md             # Detailed system design
```

---

## 🗺️ Roadmap

- [x] System architecture design
- [ ] ZK fair delivery circuit (Circom/Noir)
- [ ] Smart contract suite (Registry + Escrow + Verifier)
- [ ] L2 rollup node setup (Polygon CDK)
- [ ] Frontend dashboard (product journey)
- [ ] Oracle/IoT bridge integration
- [ ] L1 state anchoring
- [ ] Testnet deployment
- [ ] Audit & mainnet launch

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request. For major changes, discuss them in an issue first.

```bash
git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature
```

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

<div align="center">
  <b>Built with ⛓️ ZK proofs, 🔐 cryptographic guarantees, and 🚀 L2 scalability.</b>
</div>
