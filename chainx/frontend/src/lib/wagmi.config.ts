import { http, createConfig } from 'wagmi'
import { sepolia, foundry } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

/**
 * wagmi v2 config.
 * Chains: local Anvil (foundry) + Sepolia testnet.
 * Connectors: injected (MetaMask, Rabby, etc.) + explicit MetaMask.
 */
export const wagmiConfig = createConfig({
  chains: [foundry, sepolia],
  transports: {
    [foundry.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(
      import.meta.env.VITE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'
    ),
  },
  connectors: [injected(), metaMask()],
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}