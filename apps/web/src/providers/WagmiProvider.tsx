'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { WagmiProvider as Wagmi } from 'wagmi'
import { mainnet, base, baseSepolia, polygon, arbitrum } from 'wagmi/chains'
import { http } from 'wagmi'
import { ReactNode } from 'react'
import '@rainbow-me/rainbowkit/styles.css'

const config = getDefaultConfig({
    appName: 'KŌBRA',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'b7fe9c8aef7a4ff80bb5edac470fcd90', // Fallback for dev
    chains: [mainnet, base, baseSepolia, polygon, arbitrum],
    transports: {
        [mainnet.id]: http('https://eth.llamarpc.com'),
        [base.id]: http('https://mainnet.base.org'),
        [baseSepolia.id]: http('https://sepolia.base.org'),
        [polygon.id]: http('https://polygon-rpc.com'),
        [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    },
})

const qc = new QueryClient()

export function WagmiProvider({ children }: { children: ReactNode }) {
    return (
        <Wagmi config={config}>
            <QueryClientProvider client={qc}>
                <RainbowKitProvider>{children}</RainbowKitProvider>
            </QueryClientProvider>
        </Wagmi>
    )
}
