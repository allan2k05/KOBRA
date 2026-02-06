// ── Chain IDs ──
export const CHAIN_MAINNET = 1
export const CHAIN_BASE = 8453
export const CHAIN_BASE_SEPOLIA = 84532
export const CHAIN_POLYGON = 137
export const CHAIN_ARBITRUM = 42161

// ── ClearNode ──
// Sandbox for dev. Production: wss://clearnet.yellow.com/ws
export const CLEARNODE_URL = process.env.NEXT_PUBLIC_CLEARNODE_URL
    || 'wss://clearnet-sandbox.yellow.com/ws'

// ── Contracts ──
export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS
    || '0x0000000000000000000000000000000000000001') as `0x${string}`

export const USDC_BASE_SEPOLIA = (process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA
    || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`

// ── Stake tiers (USDC, 6 decimals) ──
export const STAKE_TIERS = {
    low: { label: '$1', amount: '1000000', amountNum: 1 },
    mid: { label: '$5', amount: '5000000', amountNum: 5 },
    high: { label: '$25', amount: '25000000', amountNum: 25 },
} as const
export type StakeTier = keyof typeof STAKE_TIERS

// ── Gas oracle constants ──
// Estimate: 21 000 gas per state update × 1 gwei base gas price on Base × ETH price
export const GAS_PER_UPDATE = 21000
export const BASE_GAS_GWEI = 1
export const ETH_USD = 3200
export const GWEI_TO_ETH = 1e-9
export const USD_PER_UPDATE = GAS_PER_UPDATE * BASE_GAS_GWEI * GWEI_TO_ETH * ETH_USD
// ≈ $0.0672 per update at these numbers. 340 updates ≈ $22.85.
// Adjust ETH_USD upward if you want a bigger number in the demo.

// ── Yellow protocol constant ──
// From official Yellow docs: PROTOCOLS.GAMING = 'gaming-app-v1'
export const YELLOW_PROTOCOL = 'gaming-app-v1'
