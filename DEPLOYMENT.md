# Deployment Guide

This project is a monorepo with separate frontend and game server that should be deployed independently.

## Frontend Deployment (Vercel)

### Setup Steps:
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New..." → "Project"
3. Select the `KOBRA` repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
5. Add Environment Variables:
   - Key: `NEXT_PUBLIC_SOCKET_URL`
   - Value: `https://your-render-server-url.onrender.com` (set after server is deployed)
6. Click "Deploy"

### After deployment:
- Note your Vercel URL (e.g., `https://kobra.vercel.app`)
- Update environment variable once server is live

---

## Game Server Deployment (Render)

### Setup Steps:
1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click "New+" → "Web Service"
3. Select the `KOBRA` repository
4. Configure service:
   - **Name**: `kobra-game-server`
   - **Environment**: `Node`
   - **Build Command**: `npm run build --workspace=apps/server`
   - **Start Command**: `npm start --workspace=apps/server`
   - **Root Directory**: `apps/server` (if Render asks)
5. Environment Variables (click "Add Environment Variable"):
   - `NODE_ENV`: `production`
   - `PORT`: `3005` (Render will override this, but good to set)
6. Click "Create Web Service"

### After deployment:
- Note your Render URL (e.g., `https://kobra-game-server.onrender.com`)
- Go back to Vercel and update `NEXT_PUBLIC_SOCKET_URL` to this URL
- Redeploy Vercel frontend so it connects to the new server URL

---

## Manual Deployment (if not using render.yaml)

### For Render (via UI):
1. Build command: `npm install && npm run build --workspace=apps/server`
2. Start command: `npm start --workspace=apps/server`
3. Note: Render assigns a PORT automatically; the server reads it from `process.env.PORT`

### For Vercel (via UI):
1. Points to `apps/web` as the root directory
2. Build settings should auto-detect Next.js
3. Vercel will run `next build` and `next start`

---

## Environment Variables Summary

### Vercel (Frontend)
- `NEXT_PUBLIC_SOCKET_URL`: Game server URL (e.g., `https://kobra-game-server.onrender.com`)

### Render (Server)
- `NODE_ENV`: `production`
- `PORT`: (auto-assigned by Render; server respects it)

---

## Monitoring & Debugging

### Vercel Logs:
- View in Vercel Dashboard → Project → Deployments → Logs

### Render Logs:
- View in Render Dashboard → Service → Logs

---

## Local Development

To run both services locally:
```bash
npm run dev
```

This runs `apps/web` on http://localhost:3003 and `apps/server` on http://localhost:3005.

---

## Troubleshooting

**Issue**: Frontend shows "connection refused" or 404 errors
- **Solution**: Verify `NEXT_PUBLIC_SOCKET_URL` is set to your Render server URL in Vercel
- **Check**: Open browser console and inspect socket connection URL

**Issue**: Socket.IO connection times out
- **Solution**: Ensure Render server is running (check Render logs)
- **Check**: curl/ping `https://kobra-game-server.onrender.com` to verify server is responding

**Issue**: Build fails on Render
- **Solution**: Ensure monorepo `package.json` has correct workspace configuration
- **Check**: Run locally: `npm run build --workspace=apps/server`
