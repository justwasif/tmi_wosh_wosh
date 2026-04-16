import { getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import { sepolia, foundry } from 'wagmi/chains'

/**
 * RainbowKit v2 config.
 * Uses getDefaultConfig which merges wagmi createConfig internally.
 * Import `rainbowConfig` into WagmiProvider instead of wagmiConfig
 * when you want the full RainbowKit wallet list (MetaMask, Coinbase, etc.)
 */
export const rainbowConfig = getDefaultConfig({
  appName: 'ChainX',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [foundry, sepolia],
  ssr: false,
})

export const rainbowTheme = darkTheme({
  accentColor: '#3b82f6',      // blue-500
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})