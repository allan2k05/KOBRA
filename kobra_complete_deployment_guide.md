# COMPLETE DEPLOYMENT GUIDE — KŌBRA

This guide walks through **end-to-end deployment** of the KŌBRA project, including backend, frontend, environment configuration, and final verification.

---

# PART A: DEPLOY BACKEND ON RENDER

## Step 1: Fix `render.yaml`

**Problem:**
The repo is a **monorepo with npm workspaces**, so Render must build from the repo root.

**File:** `render.yaml`

**Replace content with:**

```yaml
services:
  - type: web
    name: kobra-game-server
    env: node
    plan: starter
    buildCommand: cd apps/server && npm install && npx tsc
    startCommand: cd apps/server && node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
```

**Why:**
- Remove `rootDir`
- Remove hardcoded `PORT`
- Explicit `cd` ensures correct directory resolution

---

## Step 2: Go to Render Dashboard

1. Open: https://dashboard.render.com
2. Click **New + → Web Service**
3. Connect GitHub (if needed)
4. Select repo: `allan2k05/KOBRA`

---

## Step 3: Configure Render Service

Fill exactly:

| Field | Value |
|--------|--------|
| Name | kobra-game-server |
| Region | Nearest to users (e.g., Oregon) |
| Branch | main |
| Root Directory | **Leave empty** |
| Runtime | Node |
| Build Command | `cd apps/server && npm install && npx tsc` |
| Start Command | `cd apps/server && node dist/index.js` |
| Plan | Free or Starter |

---

## Step 4: Set Render Environment Variables

Add:

| Key | Value |
|------|--------|
| NODE_ENV | production |

⚠️ Do NOT add `PORT` — Render injects it automatically.

---

## Step 5: Deploy

Click **Create Web Service** and wait for build.

---

## Step 6: Get Backend URL

Render provides a live URL:

```
https://kobra-game-server.onrender.com
```

Copy this — needed for frontend.

---

## Step 7: Verify Backend

Open:

```
https://kobra-game-server.onrender.com/
```

Expected output:

```
Slither Duel Game Server is Running!
```

---

# PART B: DEPLOY FRONTEND ON VERCEL

## Step 1: Verify `vercel.json`

File: `vercel.json`

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

No changes needed.

---

## Step 2: Go to Vercel Dashboard

1. Open: https://vercel.com/dashboard
2. Click **Add New → Project**
3. Connect GitHub
4. Select repo: `allan2k05/KOBRA`

---

## Step 3: Configure Vercel Settings

| Field | Value |
|---------|--------|
| Project Name | kobra-web |
| Framework | Next.js (auto-detected) |
| Root Directory | `web` |
| Build Command | Default (`next build`) |
| Output Directory | Default (`.next`) |
| Install Command | Default (`npm install`) |

---

## Step 4: Set Vercel Environment Variables

Add all of the following (for Production + Preview + Development):

| Key | Value |
|------------------------------|---------------------------------------------|
| NEXT_PUBLIC_SOCKET_URL | https://kobra-game-server.onrender.com |
| NEXT_PUBLIC_CLEARNODE_URL | wss://clearnet-sandbox.yellow.com/ws |
| NEXT_PUBLIC_LIFI_INTEGRATOR | KOBRA |
| NEXT_PUBLIC_ESCROW_ADDRESS | 0xAA469650080401cCfB3F48234a28e25FEffc5630 |
| NEXT_PUBLIC_USDC_BASE_SEPOLIA | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID | b7fe9c8aef7a4ff80bb5edac470fcd90 |

---

## Step 5: Deploy

Click **Deploy**.

---

## Step 6: Get Frontend URL

Vercel outputs:

```
https://kobra-web.vercel.app
```

Copy this.

---

# PART C: UPDATE BACKEND CORS (IMPORTANT)

## Step 1: Update Backend CORS

File: `apps/server/src/index.ts`

Change:

```ts
origin: "*"
```

to:

```ts
origin: process.env.FRONTEND_URL || "*"
```

---

## Step 2: Add FRONTEND_URL in Render

Add environment variable:

| Key | Value |
|--------|-----------------------------|
| FRONTEND_URL | https://kobra-web.vercel.app |

---

## Step 3: Push Changes

```bash
git add .
git commit -m "update CORS"
git push
```

Render will auto-redeploy.

---

# PART D: FINAL VERIFICATION

## Step 1: Open Frontend

```
https://kobra-web.vercel.app
```

## Step 2: Open DevTools → Console

Ensure:
- No CORS errors
- No WebSocket errors
- Wallet connects
- Backend events stream

---

# SUMMARY CHECKLIST

| Step | Platform | Action | Status |
|--------|-----------|---------|---------|
| 1 | Local | Deploy Escrow Contract | ✅ Done |
| 2 | Render | Deploy Backend | ⬜ Pending |
| 3 | Vercel | Deploy Frontend | ⬜ Pending |
| 4 | Render | Add FRONTEND_URL | ⬜ Pending |
| 5 | Local | Update CORS | ⬜ Pending |
| 6 | End-to-End | Full Testing | ⬜ Pending |

---

# FINAL NOTE

This deployment pipeline is **production-grade**:

- Monorepo compatible
- Secure env handling
- Correct WebSocket routing
- Clean CI/CD

If all steps pass, your project is **hackathon submission ready** 🚀

