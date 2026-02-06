# KŌBRA

KŌBRA is a competitive real-money multiplayer Snake game focused on fast gameplay and secure, trustless settlement.

Players stake USDC, play instantly off-chain with no gas during gameplay, and settle the final outcome on-chain with cryptographic proof.

## Overview

KŌBRA is built to feel like a normal real-time game while remaining trustless. Gameplay runs off-chain for speed using Yellow Network state channels; only staking, settlement, and proof are performed on-chain.

## How It Works

- When two players enter a match, a Yellow state channel session is opened between them. The session defines participants and stake allocation.
- The game runs entirely off-chain once the session is active.
- Each game tick produces a signed state update representing the current game state. These updates are exchanged through Yellow’s ClearNode, allowing instant gameplay without block confirmations or gas fees.
- Because all states are signed, neither the server nor any relay can alter scores or outcomes.
- When the match ends, the final state is signed and finalized; that final signed state is used to settle the match on-chain in a single transaction. The winner is determined by cryptographic proof rather than server logic.

## Fast Transactions with Yellow Network

- Gameplay runs off-chain using state channels.
- No gas fees are required during the match.
- State updates are signed and verifiable.
- Only the final result is settled on-chain.

This approach supports real-time gameplay while maintaining trustless settlement.

## Staking and Payments

- Players stake USDC before entering a match.
- LI.FI is used for deposits to keep the entry flow simple: players can fund matches using tokens from different chains while ensuring funds arrive at the escrow contract.
- After settlement, the escrow contract distributes the pooled stake to the winner, minus a small platform fee.

## Identity and UX

- Wallet addresses are resolved to ENS names and avatars where available for readability in lobbies, matches, and leaderboards.
- ENS is used purely for identity display and does not affect game logic or settlement.
- ENS is used purely for identity display and does not affect game logic or settlement.
