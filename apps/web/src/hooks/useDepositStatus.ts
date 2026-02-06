/**
 * Tracks LI.FI deposit completion status.
 * In a production app, this would listen to blockchain events.
 * For the demo, simplified tracking.
 */

import { useState, useCallback } from 'react'

export function useDepositStatus() {
    const [deposited, setDeposited] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)

    const markDeposited = useCallback((hash: string) => {
        setTxHash(hash)
        setDeposited(true)
    }, [])

    return { deposited, txHash, markDeposited }
}
