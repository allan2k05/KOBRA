/**
 * Calculates what the game WOULD have cost if every state update
 * hit the blockchain. This number drives the gas oracle panel.
 * It is the single most important number in the demo.
 */
import { USD_PER_UPDATE } from './constants'

export function calculateOnChainCostUSD(stateCount: number): number {
    return stateCount * USD_PER_UPDATE
}

export function formatGasComparison(stateCount: number) {
    return {
        wouldCostUSD: `$${calculateOnChainCostUSD(stateCount).toFixed(2)}`,
        actuallyPaidUSD: '$0.00',   // always zero during state channel gameplay
        stateCount,
    }
}
