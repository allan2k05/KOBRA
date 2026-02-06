import type { ReactNode } from 'react'
import { WagmiProvider } from '../providers/WagmiProvider'
import { initLiFi } from '../lib/lifi'
import './globals.css'

// LI.FI SDK init — once, at app startup
initLiFi()

export const metadata = {
    title: 'KŌBRA - Real-Money Snake Game',
    description: 'Multiplayer snake with Yellow state channels, LI.FI deposits, and ENS identity',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="bg-[#08090c] min-h-screen text-gray-100">
                <WagmiProvider>{children}</WagmiProvider>
            </body>
        </html>
    )
}
