import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import QrScanner from 'qr-scanner'

// ── Types ────────────────────────────────────────────────────────────────────

type ScanMode = 'camera' | 'file'
type ScanStatus = 'idle' | 'scanning' | 'success' | 'error'

function extractProductId(raw: string): string | null {
  const urlMatch = raw.match(/\/product\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  if (/^\d+$/.test(raw.trim())) return raw.trim()
  return null
}

// ── QR Generation helper ──────────────────────────────────────────────────────

export async function generateQRDataUrl(productId: string | number): Promise<string> {
  const QRCode = await import('qrcode')
  const url = `${window.location.origin}/product/${productId}`
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: '#0a0a0f', light: '#f4f1eb' },
  })
}

// ── Scan page ─────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ScanMode>('camera')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [scannedId, setScannedId] = useState<string | null>(null)
  const [camActive, setCamActive] = useState(false)

  // FIX: wrapped handleScanResult in useCallback so it has a stable reference.
  // Previously it was a plain function recreated on every render, which meant the
  // useEffect below could capture a stale closure and the ESLint exhaustive-deps
  // rule (and React's runtime) would warn about the missing dependency.
  const handleScanResult = useCallback((raw: string) => {
    const pid = extractProductId(raw)
    if (!pid) {
      setStatus('error')
      setErrorMsg(`QR does not encode a valid product ID: "${raw}"`)
      return
    }
    setScannedId(pid)
    setStatus('success')
    scannerRef.current?.stop()
    setTimeout(() => navigate(`/product/${pid}`), 900)
  }, [navigate])

  // ── Camera scanner ──────────────────────────────────────────────────────────
  // FIX: added handleScanResult to the dependency array. It was missing before,
  // meaning the effect captured a stale version of the function after re-renders.

  useEffect(() => {
    if (mode !== 'camera' || !videoRef.current) return

    const scanner = new QrScanner(
      videoRef.current,
      (result) => handleScanResult(result.data),
      { highlightScanRegion: true, highlightCodeOutline: true }
    )

    scannerRef.current = scanner
    scanner.start().then(() => setCamActive(true)).catch(() => {
      setStatus('error')
      setErrorMsg('Camera access denied. Try file upload instead.')
    })

    return () => {
      scanner.stop()
      scanner.destroy()
      setCamActive(false)
    }
  }, [mode, handleScanResult])

  // ── File upload ─────────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('scanning')
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      handleScanResult(result.data)
    } catch {
      setStatus('error')
      setErrorMsg('No QR code found in image.')
    }
  }

  function resetScan() {
    setStatus('idle')
    setErrorMsg('')
    setScannedId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="scan-page">
      <div className="scan-container">
        {/* Header */}
        <header className="scan-header">
          <div className="scan-icon">⬡</div>
          <h1 className="scan-title">Scan Product</h1>
          <p className="scan-sub">Point camera at a ChainX QR code or upload an image</p>
        </header>

        {/* Mode toggle */}
        <div className="mode-toggle">
          <button
            className={`toggle-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => { setMode('camera'); resetScan() }}
          >
            📷 Camera
          </button>
          <button
            className={`toggle-btn ${mode === 'file' ? 'active' : ''}`}
            onClick={() => { setMode('file'); resetScan() }}
          >
            🖼 Upload
          </button>
        </div>

        {/* Scan area */}
        <div className="scan-area">
          {mode === 'camera' ? (
            <div className="camera-box">
              <video ref={videoRef} className="camera-feed" />
              {!camActive && status !== 'error' && (
                <div className="camera-placeholder">
                  <div className="cam-spinner" />
                  <span>Initialising camera…</span>
                </div>
              )}
              <div className="corner tl" /><div className="corner tr" />
              <div className="corner bl" /><div className="corner br" />
            </div>
          ) : (
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  fileInputRef.current.files = dt.files
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }}
            >
              {status === 'scanning' ? (
                <><div className="cam-spinner" /><span>Scanning…</span></>
              ) : (
                <>
                  <div className="upload-icon">⬆</div>
                  <span className="upload-label">Drop image or click to browse</span>
                  <span className="upload-hint">PNG, JPG, WebP</span>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>

        {/* Status feedback */}
        {status === 'success' && scannedId && (
          <div className="feedback success-feedback">
            <div className="feedback-icon">✓</div>
            <div>
              <strong>Product #{scannedId} found</strong>
              <p>Redirecting to timeline…</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="feedback error-feedback">
            <div className="feedback-icon">✗</div>
            <div>
              <strong>Scan failed</strong>
              <p>{errorMsg}</p>
            </div>
            <button className="retry-btn" onClick={resetScan}>Try again</button>
          </div>
        )}

        {mode === 'camera' && status === 'idle' && camActive && (
          <p className="scan-hint">Hold steady — scanning automatically</p>
        )}
      </div>

      <style>{`
        :root {
          --ink: #0a0a0f;
          --paper: #f4f1eb;
          --accent: #c8401a;
          --accent2: #1a6ec8;
          --muted: #6b6b7a;
          --border: #d4cfc4;
          --success: #2a7a2a;
          --error: #c8401a;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .scan-page {
          min-height: 100vh;
          background: var(--paper);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Georgia', serif;
        }

        .scan-container {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .scan-header { text-align: center; }

        .scan-icon {
          font-size: 3rem;
          color: var(--accent);
          margin-bottom: 0.5rem;
          display: block;
        }

        .scan-title {
          font-size: 2rem;
          letter-spacing: -0.03em;
          margin-bottom: 0.35rem;
        }

        .scan-sub {
          color: var(--muted);
          font-size: 0.9rem;
        }

        .mode-toggle {
          display: flex;
          border: 1.5px solid var(--ink);
          border-radius: 3px;
          overflow: hidden;
        }

        .toggle-btn {
          flex: 1;
          padding: 0.6rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.05em;
          color: var(--muted);
          transition: background 0.15s, color 0.15s;
        }

        .toggle-btn:first-child { border-right: 1.5px solid var(--ink); }
        .toggle-btn.active { background: var(--ink); color: var(--paper); }

        .scan-area {
          position: relative;
        }

        .camera-box {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          border: 2px solid var(--ink);
          border-radius: 4px;
          background: #111;
        }

        .camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          color: #888;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
        }

        .corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: var(--accent);
          border-style: solid;
          pointer-events: none;
        }
        .tl { top: 12px; left: 12px; border-width: 3px 0 0 3px; }
        .tr { top: 12px; right: 12px; border-width: 3px 3px 0 0; }
        .bl { bottom: 12px; left: 12px; border-width: 0 0 3px 3px; }
        .br { bottom: 12px; right: 12px; border-width: 0 3px 3px 0; }

        .upload-zone {
          width: 100%;
          aspect-ratio: 1;
          border: 2px dashed var(--border);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          background: #faf9f6;
        }

        .upload-zone:hover {
          border-color: var(--ink);
          background: #f4f1eb;
        }

        .upload-icon {
          font-size: 2.5rem;
          color: var(--muted);
        }

        .upload-label {
          font-size: 0.9rem;
          color: var(--ink);
        }

        .upload-hint {
          font-family: 'Courier New', monospace;
          font-size: 0.7rem;
          color: var(--muted);
          letter-spacing: 0.08em;
        }

        .cam-spinner {
          width: 28px; height: 28px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .feedback {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-radius: 3px;
          border: 1.5px solid;
        }

        .success-feedback {
          border-color: var(--success);
          background: #f0faf0;
          color: var(--success);
        }

        .error-feedback {
          border-color: var(--error);
          background: #fdf0ee;
          color: var(--error);
        }

        .feedback-icon {
          font-size: 1.5rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .feedback p {
          font-size: 0.8rem;
          opacity: 0.8;
          margin-top: 0.15rem;
        }

        .retry-btn {
          margin-left: auto;
          background: none;
          border: 1.5px solid currentColor;
          color: inherit;
          padding: 0.3rem 0.75rem;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          border-radius: 2px;
        }

        .scan-hint {
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          color: var(--muted);
          letter-spacing: 0.05em;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </div>
  )
}
