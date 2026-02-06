/**
 * LI.FI SDK init. Call initLiFi() once in layout.tsx.
 * The widget itself is configured in DepositModal.tsx.
 *
 * Real LI.FI SDK: import { createConfig } from '@lifi/sdk'
 * Real LI.FI Widget: <LiFiWidget integrator="..." config={...} />
 * Real widget config props (from docs.li.fi/widget/configure-widget):
 *   fromChain, fromToken, fromAmount, toChain, toToken, toAddress
 */

import { createConfig } from '@lifi/sdk'

let initialized = false

export function initLiFi() {
    if (initialized) return
    createConfig({
        integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || 'KOBRA',
    })
    initialized = true
}
