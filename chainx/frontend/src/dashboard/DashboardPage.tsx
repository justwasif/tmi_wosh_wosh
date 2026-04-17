import { useAccount, useReadContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { type Address, keccak256, toBytes } from 'viem'
import { useState } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────

const STAKEHOLDER_REGISTRY_ADDRESS = (
  import.meta.env.VITE_STAKEHOLDER_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

// ── Role constants (match Solidity keccak256) ─────────────────────────────────

const ROLES = {
  MANUFACTURER:   keccak256(toBytes('MANUFACTURER')),
  DISTRIBUTOR:    keccak256(toBytes('DISTRIBUTOR')),
  RETAILER:       keccak256(toBytes('RETAILER')),
  DELIVERY_AGENT: keccak256(toBytes('DELIVERY_AGENT')),
} as const

const REGISTRY_ABI = [
  {
    name: 'hasRole',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [
      { name: 'stakeholder', type: 'address' },
      { name: 'role',        type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// ── Role hook ─────────────────────────────────────────────────────────────────
// FIX: removed the broken `useStakeholderRole` function that called useReadContract
// inside a plain helper function (`check`). React hooks must only be called at the
// top level of a React function — not inside nested functions.
// Each role now gets its own top-level hook call (useRole) called from the component.

function useRole(address: Address | undefined, role: `0x${string}`) {
  const { data } = useReadContract({
    address: STAKEHOLDER_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'hasRole',
    args: address ? [address, role] : undefined,
    query: { enabled: !!address },
  })
  return data as boolean | undefined
}

// ── Panel components ──────────────────────────────────────────────────────────

function ManufacturerPanel() {
  const [metadata, setMetadata] = useState('')
  const [origin, setOrigin]     = useState('')

  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">🏭</span> Manufacturer
      </h2>
      <p className="panel-desc">Mint new products onto the blockchain.</p>

      <div className="form-group">
        <label className="form-label">Metadata (IPFS CID)</label>
        <input
          className="form-input"
          placeholder="ipfs://Qm..."
          value={metadata}
          onChange={e => setMetadata(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Origin Hash (factory/batch)</label>
        <input
          className="form-input mono"
          placeholder="0x..."
          value={origin}
          onChange={e => setOrigin(e.target.value)}
        />
      </div>
      <button className="action-btn primary">Mint Product</button>
      <p className="form-hint">Connect wagmi writeContract to ProductRegistry.mintProduct()</p>
    </div>
  )
}

function DistributorPanel() {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">🚚</span> Distributor
      </h2>
      <p className="panel-desc">Accept and forward incoming transfers.</p>

      <div className="transfer-list">
        <div className="empty-transfers">
          <span className="empty-icon">📦</span>
          <span>No pending transfers</span>
          <span className="empty-sub">Products assigned to you will appear here</span>
        </div>
      </div>
      <p className="form-hint">Reads CustodyTransferred events where to == your address</p>
    </div>
  )
}

function RetailerPanel() {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">🏪</span> Retailer
      </h2>
      <p className="panel-desc">Manage inbound stock and dispatch to agents.</p>

      <div className="transfer-list">
        <div className="empty-transfers">
          <span className="empty-icon">📦</span>
          <span>No pending stock</span>
          <span className="empty-sub">Products in your custody appear here</span>
        </div>
      </div>
      <p className="form-hint">Reads ProductRegistry.currentHolder() == your address</p>
    </div>
  )
}

function DeliveryAgentPanel() {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">🛵</span> Delivery Agent
      </h2>
      <p className="panel-desc">Submit ZK proofs to release delivery escrows.</p>

      <div className="escrow-list">
        <div className="empty-transfers">
          <span className="empty-icon">🔒</span>
          <span>No active escrows</span>
          <span className="empty-sub">Escrows assigned to your address appear here</span>
        </div>
      </div>

      <div className="proof-hint">
        <div className="hint-row">
          <span className="hint-key">1</span>
          <span>Collect agent GPS + customer OTP</span>
        </div>
        <div className="hint-row">
          <span className="hint-key">2</span>
          <span>Generate ZK proof via useDeliveryProof hook</span>
        </div>
        <div className="hint-row">
          <span className="hint-key">3</span>
          <span>Submit proof → funds auto-released</span>
        </div>
      </div>
      <p className="form-hint">Link to /escrow/:id for proof submission UI</p>
    </div>
  )
}

function CustomerPanel() {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <span className="panel-icon">👤</span> Customer
      </h2>
      <p className="panel-desc">Track your orders and manage escrows.</p>

      <div className="order-list">
        <div className="empty-transfers">
          <span className="empty-icon">📋</span>
          <span>No orders found</span>
          <span className="empty-sub">Escrows where buyer == your address appear here</span>
        </div>
      </div>
      <p className="form-hint">Reads Escrow events filtered by buyer == your address</p>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, isConnected } = useAccount()

  // FIX: four separate top-level hook calls (was previously routed through a
  // helper that called hooks inside a nested function — a Rules of Hooks violation
  // that causes React to crash or silently produce wrong values).
  const isManufacturer  = useRole(address, ROLES.MANUFACTURER   as `0x${string}`)
  const isDistributor   = useRole(address, ROLES.DISTRIBUTOR    as `0x${string}`)
  const isRetailer      = useRole(address, ROLES.RETAILER       as `0x${string}`)
  const isDeliveryAgent = useRole(address, ROLES.DELIVERY_AGENT as `0x${string}`)

  const hasRole = isManufacturer || isDistributor || isRetailer || isDeliveryAgent

  return (
    <div className="dashboard">
      {/* ── Nav ── */}
      <nav className="dash-nav">
        <div className="nav-brand">
          <span className="brand-hex">⬡</span>
          <span className="brand-name">ChainX</span>
        </div>
        <ConnectButton />
      </nav>

      {/* ── Body ── */}
      <main className="dash-main">
        {!isConnected ? (
          <div className="connect-prompt">
            <div className="prompt-icon">⬡</div>
            <h2>Connect your wallet</h2>
            <p>Use the button above to connect and see your role-gated dashboard.</p>
          </div>
        ) : !hasRole ? (
          <div className="connect-prompt">
            <div className="prompt-icon">🔑</div>
            <h2>No role assigned</h2>
            <p>Your address <code>{address}</code> has no role in the StakeholderRegistry.</p>
            <p>Contact the contract owner to be granted a role.</p>
          </div>
        ) : (
          <div className="panels-grid">
            {isManufacturer  && <ManufacturerPanel />}
            {isDistributor   && <DistributorPanel />}
            {isRetailer      && <RetailerPanel />}
            {isDeliveryAgent && <DeliveryAgentPanel />}
            <CustomerPanel />
          </div>
        )}
      </main>

      <style>{`
        :root {
          --ink: #0a0a0f;
          --paper: #f4f1eb;
          --accent: #c8401a;
          --accent2: #1a6ec8;
          --muted: #6b6b7a;
          --border: #d4cfc4;
          --card: #ffffff;
          --mono: 'Courier New', monospace;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .dashboard {
          min-height: 100vh;
          background: var(--paper);
          font-family: 'Georgia', serif;
          color: var(--ink);
        }

        .dash-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          background: var(--ink);
          color: var(--paper);
          border-bottom: 3px solid var(--accent);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .brand-hex {
          font-size: 1.5rem;
          color: var(--accent);
        }

        .brand-name {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .dash-main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2.5rem 2rem;
        }

        .connect-prompt {
          text-align: center;
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .prompt-icon {
          font-size: 3rem;
          color: var(--accent);
          margin-bottom: 0.5rem;
        }

        .connect-prompt h2 { font-size: 1.5rem; }
        .connect-prompt p  { color: var(--muted); max-width: 400px; font-size: 0.9rem; }
        .connect-prompt code {
          font-family: var(--mono);
          font-size: 0.75rem;
          background: var(--border);
          padding: 0.1rem 0.3rem;
          border-radius: 2px;
        }

        .panels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .panel {
          background: var(--card);
          border: 1.5px solid var(--border);
          border-radius: 4px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .panel-title {
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          letter-spacing: -0.01em;
        }

        .panel-icon { font-size: 1.2rem; }

        .panel-desc {
          font-size: 0.85rem;
          color: var(--muted);
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.75rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-label {
          font-family: var(--mono);
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .form-input {
          border: 1.5px solid var(--border);
          border-radius: 3px;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          font-family: 'Georgia', serif;
          color: var(--ink);
          background: var(--paper);
          outline: none;
          transition: border-color 0.15s;
        }

        .form-input:focus { border-color: var(--ink); }
        .form-input.mono  { font-family: var(--mono); font-size: 0.78rem; }

        .action-btn {
          padding: 0.6rem 1.25rem;
          border-radius: 3px;
          border: 1.5px solid;
          cursor: pointer;
          font-family: var(--mono);
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          transition: background 0.15s, color 0.15s;
          align-self: flex-start;
        }

        .action-btn.primary {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }

        .action-btn.primary:hover {
          background: var(--accent);
          border-color: var(--accent);
        }

        .form-hint {
          font-family: var(--mono);
          font-size: 0.65rem;
          color: var(--muted);
          font-style: italic;
          opacity: 0.7;
          margin-top: auto;
        }

        .empty-transfers {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 2rem 1rem;
          color: var(--muted);
          font-size: 0.85rem;
          border: 1.5px dashed var(--border);
          border-radius: 3px;
          text-align: center;
        }

        .empty-icon { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .empty-sub  { font-size: 0.72rem; opacity: 0.7; }

        .proof-hint {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #f8f6f2;
          border-left: 3px solid var(--accent2);
          border-radius: 0 3px 3px 0;
        }

        .hint-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
        }

        .hint-key {
          font-family: var(--mono);
          font-size: 0.65rem;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
