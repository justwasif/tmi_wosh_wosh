import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { type Address } from 'viem'
import { useProductData } from '../hooks/useProduct'

// ── Config ───────────────────────────────────────────────────────────────────

const PRODUCT_REGISTRY_ADDRESS = (
  import.meta.env.VITE_PRODUCT_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as Address

// ── Role label map ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Origin',
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTs(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleString()
}

function stepLabel(index: number, total: number): string {
  if (index === 0) return 'Manufactured'
  if (index === total - 1) return 'Delivered'
  const labels = ['Distributed', 'Inspected', 'Stocked', 'Dispatched']
  return labels[Math.min(index - 1, labels.length - 1)]
}

// ── Timeline node ─────────────────────────────────────────────────────────────

interface TimelineNodeProps {
  label: string
  from: string
  to: string
  timestamp: bigint
  gpsHash: string
  index: number
  total: number
  isLast: boolean
}

function TimelineNode({ label, from, to, timestamp, gpsHash, index, total, isLast }: TimelineNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const hasGps = gpsHash !== '0x' + '0'.repeat(64)

  return (
    <div className="timeline-node">
      <div className="node-track">
        <div className={`node-dot ${index === 0 ? 'dot-start' : index === total - 1 ? 'dot-end' : 'dot-mid'}`} />
        {!isLast && <div className="node-line" />}
      </div>

      <div className="node-card" onClick={() => setExpanded(!expanded)}>
        <div className="node-header">
          <div className="node-step-badge">{String(index + 1).padStart(2, '0')}</div>
          <div className="node-info">
            <h3 className="node-label">{label}</h3>
            <div className="node-addresses">
              {from !== '0x' + '0'.repeat(40) && (
                <span className="addr-chip from-chip">
                  <span className="addr-prefix">from</span> {shortAddr(from)}
                </span>
              )}
              <span className="addr-chip to-chip">
                <span className="addr-prefix">to</span> {shortAddr(to)}
              </span>
            </div>
          </div>
          <div className="node-meta">
            <time className="node-time">{formatTs(timestamp)}</time>
            {hasGps && <span className="gps-badge">📍 GPS</span>}
          </div>
          <button className="expand-btn">{expanded ? '▲' : '▼'}</button>
        </div>

        {expanded && (
          <div className="node-details">
            <div className="detail-row">
              <span className="detail-key">From</span>
              <span className="detail-val mono">{from}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">To</span>
              <span className="detail-val mono">{to}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Timestamp</span>
              <span className="detail-val">{formatTs(timestamp)}</span>
            </div>
            {hasGps && (
              <div className="detail-row">
                <span className="detail-key">GPS Hash</span>
                <span className="detail-val mono small">{gpsHash}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductTimelinePage() {
  const { id } = useParams<{ id: string }>()
  const productId = id ? BigInt(id) : undefined

  const { product, custodyLog, isLoading, error } = useProductData(
    PRODUCT_REGISTRY_ADDRESS,
    productId
  )

  if (isLoading) {
    return (
      <div className="page-center">
        <div className="spinner" />
        <p className="loading-text">Loading product timeline…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="page-center">
        <div className="error-box">
          <h2>Product not found</h2>
          <p>{error?.message ?? 'No product with this ID exists on-chain.'}</p>
        </div>
      </div>
    )
  }

  const log = custodyLog ?? []

  return (
    <div className="timeline-page">
      {/* ── Header ── */}
      <header className="product-header">
        <div className="header-inner">
          <div className="product-id-badge">
            <span className="badge-label">Product</span>
            <span className="badge-id">#{product.id.toString()}</span>
          </div>
          <div className="product-meta-grid">
            <div className="meta-cell">
              <span className="meta-key">Metadata</span>
              <span className="meta-val">{product.metadata}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-key">Manufacturer</span>
              <span className="meta-val mono">{shortAddr(product.manufacturer)}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-key">Current Holder</span>
              <span className="meta-val mono">{shortAddr(product.currentHolder)}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-key">Minted</span>
              <span className="meta-val">{formatTs(product.mintedAt)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Timeline ── */}
      <main className="timeline-main">
        <h2 className="timeline-title">
          Custody Chain <span className="custody-count">({log.length} events)</span>
        </h2>

        {log.length === 0 ? (
          <p className="empty-state">No custody events recorded yet.</p>
        ) : (
          <div className="timeline">
            {log.map((record, i) => (
              <TimelineNode
                key={i}
                label={stepLabel(i, log.length)}
                from={record.from}
                to={record.to}
                timestamp={record.timestamp}
                gpsHash={record.gpsHash}
                index={i}
                total={log.length}
                isLast={i === log.length - 1}
              />
            ))}
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
          --card-bg: #ffffff;
          --mono: 'Courier New', monospace;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .timeline-page {
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Georgia', serif;
        }

        .product-header {
          background: var(--ink);
          color: var(--paper);
          padding: 2.5rem 0;
          border-bottom: 4px solid var(--accent);
        }

        .header-inner {
          max-width: 860px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .product-id-badge {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .badge-label {
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.6;
          font-family: var(--mono);
        }

        .badge-id {
          font-size: 2.5rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--accent);
        }

        .product-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }

        .meta-cell {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .meta-key {
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.5;
          font-family: var(--mono);
        }

        .meta-val {
          font-size: 0.9rem;
          word-break: break-all;
        }

        .meta-val.mono { font-family: var(--mono); font-size: 0.8rem; }

        .timeline-main {
          max-width: 860px;
          margin: 0 auto;
          padding: 3rem 2rem 4rem;
        }

        .timeline-title {
          font-size: 1.1rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 2.5rem;
          color: var(--muted);
          font-weight: 400;
          font-family: var(--mono);
        }

        .custody-count {
          font-size: 0.85em;
          opacity: 0.7;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .timeline-node {
          display: flex;
          gap: 1.5rem;
          min-height: 80px;
        }

        .node-track {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 28px;
          padding-top: 1.25rem;
        }

        .node-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2.5px solid var(--ink);
          background: var(--paper);
          flex-shrink: 0;
          z-index: 1;
        }

        .dot-start { background: var(--accent); border-color: var(--accent); }
        .dot-end   { background: var(--accent2); border-color: var(--accent2); }
        .dot-mid   { background: var(--paper); }

        .node-line {
          width: 2px;
          flex: 1;
          background: var(--border);
          margin-top: 4px;
          min-height: 40px;
        }

        .node-card {
          flex: 1;
          border: 1.5px solid var(--border);
          border-radius: 4px;
          margin-bottom: 1rem;
          background: var(--card-bg);
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          overflow: hidden;
        }

        .node-card:hover {
          border-color: var(--ink);
          box-shadow: 3px 3px 0 var(--ink);
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
        }

        .node-step-badge {
          font-family: var(--mono);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--muted);
          letter-spacing: -0.04em;
          flex-shrink: 0;
          width: 2.5rem;
        }

        .node-info { flex: 1; min-width: 0; }

        .node-label {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          margin-bottom: 0.35rem;
        }

        .node-addresses {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .addr-chip {
          font-family: var(--mono);
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem;
          border-radius: 2px;
          border: 1px solid;
        }

        .from-chip { color: var(--muted); border-color: var(--border); }
        .to-chip   { color: var(--accent2); border-color: var(--accent2); }

        .addr-prefix { opacity: 0.5; margin-right: 0.25rem; }

        .node-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.3rem;
        }

        .node-time {
          font-family: var(--mono);
          font-size: 0.7rem;
          color: var(--muted);
          white-space: nowrap;
        }

        .gps-badge {
          font-size: 0.65rem;
          padding: 0.1rem 0.3rem;
          background: #e8f4e8;
          border-radius: 2px;
          color: #2a6b2a;
        }

        .expand-btn {
          background: none;
          border: none;
          font-size: 0.7rem;
          color: var(--muted);
          cursor: pointer;
          padding: 0.25rem;
        }

        .node-details {
          border-top: 1px solid var(--border);
          padding: 1rem 1.25rem;
          background: #faf9f6;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .detail-row {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .detail-key {
          font-family: var(--mono);
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          flex-shrink: 0;
          width: 80px;
          padding-top: 0.1rem;
        }

        .detail-val {
          font-size: 0.8rem;
          word-break: break-all;
        }

        .detail-val.mono { font-family: var(--mono); }
        .detail-val.small { font-size: 0.7rem; }

        .page-center {
          min-height: 60vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .loading-text { color: var(--muted); font-family: var(--mono); font-size: 0.85rem; }

        .error-box {
          max-width: 400px;
          padding: 2rem;
          border: 2px solid var(--accent);
          text-align: center;
        }

        .error-box h2 { margin-bottom: 0.5rem; }
        .error-box p  { color: var(--muted); font-size: 0.9rem; }

        .empty-state {
          color: var(--muted);
          font-family: var(--mono);
          font-size: 0.9rem;
          padding: 2rem 0;
        }
      `}</style>
    </div>
  )
}