import { defineConfig } from '@wagmi/cli'
import { react } from '@wagmi/cli/plugins'
import { foundry } from '@wagmi/cli/plugins'

/**
 * wagmi CLI config.
 * Run: pnpm wagmi generate
 * Reads ABIs from forge out/ and generates typed React hooks into src/generated.ts
 */
export default defineConfig({
  out: 'src/generated.ts',
  plugins: [
    foundry({
      project: '../contracts',
      include: [
        'StakeholderRegistry.sol/**',
        'ProductRegistry.sol/**',
        'ZKVerifier.sol/**',
        'Escrow.sol/**',
      ],
    }),
    react(),
  ],
})