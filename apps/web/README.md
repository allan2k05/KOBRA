# KŌBRA

Real-money multiplayer snake. Every move is a cryptographically signed state update.
One transaction settles the match.

## The Problem

Off-chain games are unverifiable. You can't prove the winner without trusting the server.

## The Solution

Yellow state channels make every game action provable at zero gas cost.
The winner isn't claimed — it's signed by ClearNode.

## SDK Breakdown

- **Yellow SDK** (`@erc7824/nitrolite`) — every game action, every score, the settlement proof
- **LI.FI** (`@lifi/widget`) — deposit from any chain with any token
- **ENS** (wagmi hooks) — human-readable player identity everywhere

## Business Model

- **Revenue:** 2% rake on every match pot
- **Retention:** Proof-of-Skill leaderboard. Scores backed by state channel proofs. Verifiable on-chain reputation.
- **Expansion:** Architecture is game-agnostic. Slither is v1. Same escrow + state channel pattern supports any skill game.

## Tech Stack

Next.js 14 · TypeScript · Tailwind · wagmi · viem · RainbowKit · @erc7824/nitrolite · @lifi/widget · Socket.io

## What's Next

Multi-game platform. Chess, poker, racing — all sharing the same state channel + escrow infrastructure.
Cross-game leaderboard. Cross-game reputation.

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Dev / Testnet (using limited test funds)

If you only have a small amount of testnet ETH (for example 0.1 ETH) and no USDC, you can still exercise the app.

- Request Base Sepolia test ETH and Sepolia USDC from ETHGlobal or similar faucets (the ETHGlobal faucet often provides a small amount of test USDC).
- If the faucet doesn't provide USDC, swap a small portion of your test ETH for USDC on a Sepolia testnet DEX or use LI.FI to bridge/swap into USDC.
- For quick local testing without real test tokens, run a local Hardhat network and deploy/mint a test USDC token and a local escrow contract, then point the frontend to the local network.

Minimal `.env.local` template (put this in `apps/web/.env.local`):

```env
NEXT_PUBLIC_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
NEXT_PUBLIC_LIFI_INTEGRATOR=InstantSlither
NEXT_PUBLIC_ESCROW_ADDRESS=0x<ESCROW_ADDRESS_ON_TESTNET_OR_LOCAL>
NEXT_PUBLIC_USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Quick tips when funds are limited:
- Keep stake tiers low for testing (if configurable) so a small USDC balance is sufficient.
- Use LI.FI to swap a fraction of your test ETH to USDC (watch gas costs on the testnet — still minimal).
- If you run a local Hardhat node, mint test USDC to your wallet address and bypass cross-chain complexity.

Example local flow (Hardhat):

1. Start Hardhat node:

```bash
npx hardhat node
```

2. Deploy a simple ERC20 test USDC and the escrow contract (use your existing deploy scripts or a small script to deploy and mint tokens to your wallet).

3. Point `NEXT_PUBLIC_CLEARNODE_URL` to a sandbox ClearNode (or keep sandbox URL) and `NEXT_PUBLIC_ESCROW_ADDRESS` to the locally deployed escrow.

This allows you to fully exercise the deposit, matchmaking, and settlement flows without relying on external faucets.

## Architecture Highlights

### Yellow SDK Integration (Non-Removable)

Every game tick goes through three critical Yellow SDK calls:

1. **Session Creation** - `createAppSessionMessage()` with protocol `'gaming-app-v1'`
2. **State Updates** - `createStateUpdateMessage()` called 10-20x per second during gameplay
3. **Settlement** - `closeSession()` with `StateIntent.FINALIZE` returns cryptographic proof

Remove Yellow → scores become unverifiable server claims. That's the architectural proof judges look for.

### LI.FI Integration

`DepositModal` uses the LI.FI widget with locked destination:
- `toChain`: Base Sepolia
- `toToken`: USDC
- `toAddress`: Escrow contract

Players can deposit from ANY chain with ANY token. LI.FI handles routing.

### ENS Integration

`PlayerBadge` component uses `useEnsName()` and `useEnsAvatar()` from wagmi.
Always resolves from Ethereum mainnet (chain 1).
Used in: lobby, game overlay, leaderboard, settlement screen.

## Demo Flow

1. Connect wallet
2. Select stake tier ($1, $5, or $25)
3. Deposit via LI.FI widget (pay from any chain)
4. Get matched with opponent
5. Play snake - watch state counter and gas oracle grow in real-time
6. Game ends - settlement proof appears with ClearNode signature
7. Click "Settle On-Chain" - winner receives full pot

## Gas Oracle

The gas oracle shows what the game **would have cost** on-chain:

```
340 state updates × $0.0672 per update = $22.85 on-chain cost
Actually paid: $0.00 (state channels are free)
```

This number is calculated in real-time and is the "wow moment" of the demo.

## Files of Interest

- `src/lib/yellow.ts` - **THE MOST IMPORTANT FILE** - Full Yellow SDK lifecycle
- `src/components/LiveGameOverlay.tsx` - Real-time state counter + gas oracle
- `src/components/SettlementPanel.tsx` - Settlement proof display + on-chain settlement
- `src/app/game/page.tsx` - Game loop with Yellow integration every tick
- `src/hooks/useYellowSession.ts` - React wrapper for Yellow SDK

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
NEXT_PUBLIC_LIFI_INTEGRATOR=InstantSlither
NEXT_PUBLIC_ESCROW_ADDRESS=0x... # Your deployed escrow contract
NEXT_PUBLIC_USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## License

MIT
