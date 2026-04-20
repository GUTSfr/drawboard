# DrawBoard 🎨

A production-ready real-time collaborative drawing canvas. Draw together with friends, colleagues, or the whole world — no account required.

## Features

- ✦ **Real-time collaboration** via WebSockets — see others draw as it happens
- ✦ **Live cursors** — see where everyone is pointing
- ✦ **Multiple pages** per board (add/remove/navigate)
- ✦ **User permissions** — owner / editor / viewer roles
- ✦ **Full tool suite** — Pen, Line, Rectangle, Circle, Text, Eraser, Select
- ✦ **16-color palette** + 4 stroke widths
- ✦ **Erase elements** — click to remove individual drawn elements
- ✦ **Export to JPEG** — save your canvas as an image
- ✦ **Thumbnail previews** in the boards list
- ✦ **Infinite canvas** — zoom (scroll) + pan (Alt+drag) with grid
- ✦ **Persistent boards** — everything saved server-side forever
- ✦ No registration needed — just pick a nickname

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, HTML Canvas API |
| Backend | Node.js, Express, ws (WebSocket) |
| Storage | In-memory (upgrade to Redis/DB for production) |
| Fonts | Syne + JetBrains Mono (Google Fonts) |

---

## Local Development

### Prerequisites
- Node.js 18+ installed

### 1. Clone and install

```bash
git clone <your-repo-url>
cd drawboard

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Run in development

Terminal 1 — Start the backend:
```bash
cd server
node index.js
# Server running on :3001
```

Terminal 2 — Start the frontend dev server:
```bash
cd client
npm run dev
# Open http://localhost:5173
```

---

## Production Build & Deploy

### Option A: Build and serve from Node

```bash
# Build the frontend
cd client
npm run build
# This outputs to client/dist/

# Run the server (it serves the built frontend too)
cd ../server
node index.js
# Open http://localhost:3001
```

### Option B: Deploy to Railway (recommended, free tier available)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Set these settings:
   - **Root directory**: `server`
   - **Build command**: `cd ../client && npm install && npm run build`
   - **Start command**: `node index.js`
   - **Port**: `3001`
5. Done! Railway gives you a public URL.

### Option C: Deploy to Render (free tier)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory**: `/`
   - **Build Command**: `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command**: `cd server && node index.js`
5. Set environment variable: `PORT=10000`

### Option D: Deploy to a VPS (Ubuntu)

```bash
# On your server:
git clone <your-repo-url> /var/www/drawboard
cd /var/www/drawboard

# Build frontend
cd client && npm install && npm run build

# Install server deps
cd ../server && npm install

# Install PM2 (process manager)
npm install -g pm2

# Start the server
pm2 start index.js --name drawboard
pm2 save
pm2 startup

# Optional: nginx reverse proxy
# Point your domain to localhost:3001
```

### Nginx config example (optional):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |

---

## Architecture

```
client/                  # React frontend (Vite)
  src/
    App.jsx              # Main router (landing → boards → editor)
    components/
      LandingPage.jsx    # Nickname entry screen
      BoardsPage.jsx     # Boards list with thumbnails
      BoardEditor.jsx    # Main editor (toolbar, pages, WS)
      Canvas.jsx         # HTML Canvas drawing engine
      PermissionsModal.jsx  # Manage access control
      ToastProvider.jsx  # Global notifications
    styles.css           # Global design system

server/
  index.js               # Express + WebSocket server
```

---

## How It Works

1. User enters a nickname → stored in localStorage
2. Boards list loads from REST API, auto-refreshes every 10s
3. Opening a board: connects via WebSocket, loads page elements
4. Drawing: events go Canvas → BoardEditor → WebSocket → server → all other clients
5. Thumbnails: auto-saved every 30s from the canvas
6. Permissions: owner can set viewer/editor/owner roles per nickname

---

## Upgrading Storage

Currently uses in-memory storage (resets on server restart). To persist data:

**SQLite** (simplest):
```bash
npm install better-sqlite3
```
Replace the `store` object with SQLite tables.

**Redis** (for multi-server):
```bash
npm install ioredis
```

**PostgreSQL** (full production):
```bash
npm install pg
```

---

## License

MIT — free for any use.
