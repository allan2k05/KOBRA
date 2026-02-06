/**
 * ENS resolution hook.
 *
 * Real wagmi hooks used (from wagmi docs):
 *   useEnsName({ address, chainId })    → string | null
 *   useEnsAvatar({ name, chainId })     → string (URL) | null
 *
 * ENS ALWAYS resolves from chainId 1 (Ethereum mainnet),
 * regardless of what chain the user's wallet is connected to.
 * Falls back to truncated hex if no ENS name exists.
 */

import { useEnsName, useEnsAvatar } from 'wagmi'
import { mainnet } from 'wagmi/chains'

export function usePlayerIdentity(address: string | undefined) {
    const { data: ensName, isLoading: nameLoading } = useEnsName({
        address: address as `0x${string}` | undefined,
        chainId: mainnet.id,     // always L1 mainnet for ENS
    })

    const { data: avatar, isLoading: avatarLoading } = useEnsAvatar({
        name: ensName ?? undefined,
        chainId: mainnet.id,
    })

    const displayName = ensName
        || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—')

    return { ensName, displayName, avatar, isLoading: nameLoading || avatarLoading }
}
