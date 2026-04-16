/**
 * oracle/src/tracker.ts
 *
 * GPS Tracker — polls a mock GPS feed at a configurable interval,
 * hashes coordinates + timestamp, and emits GpsReading events.
 *
 * In production, replace mockGpsFeed() with a real IoT/GPS data source.
 */

import { createHash } from 'crypto'
import { EventEmitter } from 'events'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GpsCoords {
  lat: number   // decimal degrees
  lon: number   // decimal degrees
}

export interface GpsReading {
  productId: string
  lat: number
  lon: number
  timestamp: number    // Unix seconds
  hash: `0x${string}` // keccak256(lat_int, lon_int, timestamp)
}

export interface TrackerConfig {
  productId: string
  intervalMs: number
  /** Optional: fixed coords for mock mode. If absent, uses random walk. */
  mockCoords?: GpsCoords
}

// ── Mock GPS feed ─────────────────────────────────────────────────────────────

let _walk = { lat: 28.613900, lon: 77.209000 } // Delhi default

function mockGpsFeed(fixed?: GpsCoords): GpsCoords {
  if (fixed) return fixed
  // Simulate a slow random walk
  _walk = {
    lat: _walk.lat + (Math.random() - 0.5) * 0.001,
    lon: _walk.lon + (Math.random() - 0.5) * 0.001,
  }
  return { ..._walk }
}

// ── Hash ──────────────────────────────────────────────────────────────────────

/**
 * Hash GPS coords + timestamp into a bytes32 hex string.
 * Integers: lat/lon multiplied by 1e6 (matches Circom circuit convention).
 */
export function hashGps(lat: number, lon: number, timestamp: number): `0x${string}` {
  const latInt = Math.round(lat * 1e6)
  const lonInt = Math.round(lon * 1e6)
  const data   = `${latInt}:${lonInt}:${timestamp}`
  const hash   = createHash('sha256').update(data).digest('hex')
  return `0x${hash}` as `0x${string}`
}

// ── GpsTracker class ──────────────────────────────────────────────────────────

export class GpsTracker extends EventEmitter {
  private config: TrackerConfig
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(config: TrackerConfig) {
    super()
    this.config = config
  }

  start() {
    if (this.running) return
    this.running = true
    console.log(`[Tracker] Starting GPS poll for product ${this.config.productId} every ${this.config.intervalMs}ms`)

    this.timer = setInterval(() => this.poll(), this.config.intervalMs)
    this.poll() // immediate first reading
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.running = false
    console.log(`[Tracker] Stopped GPS poll for product ${this.config.productId}`)
  }

  private poll() {
    const coords = mockGpsFeed(this.config.mockCoords)
    const timestamp = Math.floor(Date.now() / 1000)
    const hash = hashGps(coords.lat, coords.lon, timestamp)

    const reading: GpsReading = {
      productId: this.config.productId,
      lat:       coords.lat,
      lon:       coords.lon,
      timestamp,
      hash,
    }

    console.log(`[Tracker] GPS reading: product=${reading.productId} lat=${reading.lat.toFixed(6)} lon=${reading.lon.toFixed(6)} hash=${reading.hash}`)
    this.emit('reading', reading)
  }
}