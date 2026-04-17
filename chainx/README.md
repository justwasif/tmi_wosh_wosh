# ChainX - Supply Chain Tracking with ZK Proofs

A decentralized supply chain tracking system using zero-knowledge proofs for delivery verification and GPS oracle services.

## Architecture

- **Frontend**: React + Vite + RainbowKit + Wagmi (Web3 integration)
- **Smart Contracts**: Solidity contracts deployed on local Foundry network
- **Oracle**: GPS tracking service that submits location data on-chain
- **ZK Circuits**: Circom circuits for delivery proof verification

## Quick Start

### Prerequisites

- Node.js 18+
- Foundry (for smart contracts)
- Docker (optional, for containerized deployment)

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend && npm install

# Install oracle dependencies
cd ../oracle && npm install

# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Start Local Blockchain

```bash
# Start Anvil (local Ethereum network)
anvil --host 0.0.0.0 --port 8545 --block-time 2
```

### 3. Deploy Smart Contracts

```bash
cd contracts
forge install foundry-rs/forge-std
forge build
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### 4. Start Services

```bash
# Terminal 1: Start Frontend
cd frontend && npm run dev

# Terminal 2: Start Oracle Service
cd oracle && ORACLE_RPC_URL=http://127.0.0.1:8545 ORACLE_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 ORACLE_PRODUCT_IDS=1,2,3 ORACLE_INTERVAL_MS=30000 PRODUCT_REGISTRY_ADDRESS=0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496 npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Local Blockchain**: http://localhost:8545
- **Contracts**:
  - StakeholderRegistry: `0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519`
  - ProductRegistry: `0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496`
  - ZKVerifier: `0x34A1D3fff3958843C43aD80F30b94c510645C316`
  - Escrow: `0x90193C961A926261B756D1E5bb255e67ff9498A1`

## Docker Deployment (Alternative)

```bash
# Build and run all services
docker-compose up --build
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Frontend
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
VITE_STAKEHOLDER_REGISTRY_ADDRESS=0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519
VITE_PRODUCT_REGISTRY_ADDRESS=0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496
VITE_ESCROW_ADDRESS=0x90193C961A926261B756D1E5bb255e67ff9498A1

# Oracle
ORACLE_RPC_URL=http://127.0.0.1:8545
ORACLE_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ORACLE_PRODUCT_IDS=1,2,3
ORACLE_INTERVAL_MS=30000
PRODUCT_REGISTRY_ADDRESS=0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496
```

## Development

### Testing Contracts

```bash
cd contracts && forge test
```

### Building Frontend

```bash
cd frontend && npm run build
```

### Generating ZK Proofs

```bash
cd circuits
# Setup ceremony and generate keys
npm run setup
# Generate proof for delivery
npm run prove
```

## Features

- **Multi-stakeholder supply chain**: Manufacturers, distributors, retailers, and delivery agents
- **GPS tracking**: Real-time location monitoring via oracle service
- **ZK proofs**: Privacy-preserving delivery verification
- **Escrow system**: Secure payment holding and release
- **Web3 integration**: Wallet connection and transaction management

## Project Structure

```
chainx/
├── frontend/          # React frontend
├── contracts/         # Solidity smart contracts
├── oracle/           # GPS tracking service
├── circuits/         # ZK proof circuits
├── docker-compose.yml # Container orchestration
└── .env              # Environment configuration
```