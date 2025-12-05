# Deployment Ready for Render

## Files Added/Changed
- `backend/` — Node/Express backend server
- `backend/server.js` — Main backend (auth, music upload, decorations, web-push)
- `backend/package.json` — Backend dependencies
- `render.yaml` — Render deployment config
- `Procfile` — Process file for Render
- `.gitignore` — Excludes node_modules and runtime data
- `admin-login.html` — Admin login page
- `sw.js` — Service worker for web-push notifications
- `index.html` — Updated with Socket.IO, client unlock flow, web-push
- `admin.html` — Updated admin dashboard with server integration
- `package.json` — Root config with postinstall script

## Quick Deployment Steps (Render)

1. **Push to GitHub** (after you provide credentials):
   ```bash
   git add .
   git commit -m "Add backend with admin, music, decorations, web-push"
   git push origin main
   ```

2. **Connect Render**:
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Select your GitHub repo `sym40n-gaming`
   - Render will auto-detect `render.yaml`
   - Set environment variables in Render dashboard:
     - `ADMIN_PASS` — set a strong admin password (default: `changeme`)
     - `SESSION_SECRET` — set a random secret (default: `change-this-session-secret`)
   - Deploy

3. **After Deploy**:
   - Admin login: `https://<your-render-url>/admin-login.html`
   - Username: `admin`
   - Password: whatever you set for `ADMIN_PASS`

## Key Features Ready
✓ Admin authentication (username/password)
✓ Music upload & playback (server-side storage)
✓ Seasonal decorations (snow/winter/christmas)
✓ In-page notifications (Socket.IO)
✓ Web Push notifications (with service worker)
✓ Audio unlock flow (modal on first visit)
✓ Session-based auth with bcrypt

## Important Notes
- Backend stores data in `backend/data/` (configs, users, subscriptions)
- Uploaded music files go to `backend/public/music/`
- On fresh Render deploy, a default admin user is created with `ADMIN_PASS`
- Web-push requires users to subscribe (button on main page)
- Music playback requires user gesture first (click "Enable Sound")

## API Endpoints (Protected)
- `POST /auth/login` — login
- `POST /auth/logout` — logout
- `POST /admin/upload-music` — upload music file
- `POST /admin/set-decoration` — set seasonal decoration
- `POST /admin/play-music` — play uploaded music to all clients
- `POST /admin/notify` — send in-page notification
- `POST /admin/send-push` — send web-push to subscribed users
- `GET /vapidPublicKey` — public key for web-push subscription
- `POST /subscribe` — subscribe client to web-push

## Next Steps (Post-Deploy)
- Monitor logs on Render dashboard
- Test admin login and features
- Upload a test music file and broadcast it
- Get users to subscribe to push notifications
- Set admin password to something secure (requires server restart)
