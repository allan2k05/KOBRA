/**
 * LI.FI Widget drop-in.
 *
 * Real widget config props (verified from docs.li.fi):
 *   toChain:   locks destination chain
 *   toToken:   locks destination token
 *   toAddress: locks the receiving address (our escrow)
 *   fromAmount: pre-fills the amount
 *
 * Player can come from ANY chain with ANY token.
 * LI.FI routes it. Destination is locked to Base Sepolia escrow + USDC.
 */

'use client'
import { LiFiWidget, ChainType } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { ESCROW_ADDRESS, USDC_BASE_SEPOLIA, CHAIN_BASE_SEPOLIA } from '../lib/constants'

interface Props {
    stakeAmount: string   // raw USDC units (6 decimals)
    onClose: () => void
    onComplete: () => void
}

export function DepositModal({ stakeAmount, onClose, onComplete }: Props) {
    // WidgetConfig shape — all props are from the real LI.FI widget docs
    const config: WidgetConfig = {
        toChain: CHAIN_BASE_SEPOLIA,       // destination locked
        toToken: USDC_BASE_SEPOLIA,        // USDC on Base Sepolia
        toAddress: {
            address: ESCROW_ADDRESS,
            chainType: ChainType.EVM,
        },
        fromAmount: Number(stakeAmount) / 1e6, // convert raw units to display amount
        integrator: 'KOBRA',
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-mono font-bold text-lg">Deposit Stake</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>
                <p className="text-gray-500 text-sm font-mono mb-4">
                    Pay from any chain. LI.FI routes it to Base.
                </p>
                <LiFiWidget integrator="KOBRA" config={config} />
                <button 
                    onClick={onComplete}
                    className="w-full mt-4 bg-green-500 hover:bg-green-600 text-black font-bold py-2 px-4 rounded font-mono"
                >
                    Skip Deposit (Testing)
                </button>
            </div>
        </div>
    )
}
