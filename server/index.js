const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── In-Memory Store ────────────────────────────────────────────────────────
const store = {
  boards: {},      // boardId -> board
  pages: {},       // pageId -> page
  elements: {},    // pageId -> [elements]
  thumbnails: {},  // boardId -> dataURL
};

function createBoard(name, ownerNick) {
  const boardId = uuidv4();
  const firstPageId = uuidv4();
  store.boards[boardId] = {
    id: boardId,
    name,
    owner: ownerNick,
    createdAt: Date.now(),
    pageIds: [firstPageId],
    permissions: {
      // nick -> 'owner' | 'editor' | 'viewer'
    },
    isPublic: true,
  };
  store.boards[boardId].permissions[ownerNick] = 'owner';
  store.pages[firstPageId] = {
    id: firstPageId,
    boardId,
    name: 'Page 1',
    order: 0,
    createdAt: Date.now(),
  };
  store.elements[firstPageId] = [];
  return store.boards[boardId];
}

function getBoard(boardId) { return store.boards[boardId]; }
function getPage(pageId) { return store.pages[pageId]; }
function getElements(pageId) { return store.elements[pageId] || []; }

function getUserRole(board, nick) {
  if (!board) return null;
  if (board.isPublic && !board.permissions[nick]) return 'editor';
  return board.permissions[nick] || null;
}

// ─── REST API ────────────────────────────────────────────────────────────────
// Get all boards
app.get('/api/boards', (req, res) => {
  const boards = Object.values(store.boards).map(b => ({
    id: b.id,
    name: b.name,
    owner: b.owner,
    createdAt: b.createdAt,
    pageCount: b.pageIds.length,
    thumbnail: store.thumbnails[b.id] || null,
  }));
  boards.sort((a, b) => b.createdAt - a.createdAt);
  res.json(boards);
});

// Create board
app.post('/api/boards', (req, res) => {
  const { name, nick } = req.body;
  if (!name || !nick) return res.status(400).json({ error: 'name and nick required' });
  const board = createBoard(name.trim(), nick.trim());
  res.json(board);
});

// Get board details + pages
app.get('/api/boards/:boardId', (req, res) => {
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const pages = board.pageIds.map(pid => store.pages[pid]).filter(Boolean);
  res.json({ ...board, pages });
});

// Delete board
app.delete('/api/boards/:boardId', (req, res) => {
  const { nick } = req.body;
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Not found' });
  if (getUserRole(board, nick) !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  board.pageIds.forEach(pid => {
    delete store.pages[pid];
    delete store.elements[pid];
  });
  delete store.boards[req.params.boardId];
  delete store.thumbnails[req.params.boardId];
  res.json({ ok: true });
});

// Get page elements
app.get('/api/pages/:pageId/elements', (req, res) => {
  res.json(getElements(req.params.pageId));
});

// Add page
app.post('/api/boards/:boardId/pages', (req, res) => {
  const { nick } = req.body;
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Not found' });
  const role = getUserRole(board, nick);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'Forbidden' });
  const pageId = uuidv4();
  const order = board.pageIds.length;
  store.pages[pageId] = {
    id: pageId,
    boardId: req.params.boardId,
    name: `Page ${order + 1}`,
    order,
    createdAt: Date.now(),
  };
  store.elements[pageId] = [];
  board.pageIds.push(pageId);
  broadcast(req.params.boardId, { type: 'page_added', page: store.pages[pageId] });
  res.json(store.pages[pageId]);
});

// Delete page
app.delete('/api/boards/:boardId/pages/:pageId', (req, res) => {
  const { nick } = req.body;
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Not found' });
  const role = getUserRole(board, nick);
  if (!role || role === 'viewer' || role === 'editor') return res.status(403).json({ error: 'Forbidden' });
  if (board.pageIds.length <= 1) return res.status(400).json({ error: 'Cannot delete last page' });
  board.pageIds = board.pageIds.filter(p => p !== req.params.pageId);
  delete store.pages[req.params.pageId];
  delete store.elements[req.params.pageId];
  broadcast(req.params.boardId, { type: 'page_removed', pageId: req.params.pageId });
  res.json({ ok: true });
});

// Get permissions
app.get('/api/boards/:boardId/permissions', (req, res) => {
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Not found' });
  res.json(board.permissions);
});

// Set permission
app.put('/api/boards/:boardId/permissions', (req, res) => {
  const { nick, targetNick, role } = req.body;
  const board = getBoard(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Not found' });
  if (getUserRole(board, nick) !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  if (role === null || role === undefined) {
    delete board.permissions[targetNick];
  } else {
    board.permissions[targetNick] = role;
  }
  broadcast(req.params.boardId, { type: 'permissions_updated', permissions: board.permissions });
  res.json(board.permissions);
});

// Save thumbnail
app.post('/api/boards/:boardId/thumbnail', (req, res) => {
  const { thumbnail } = req.body;
  store.thumbnails[req.params.boardId] = thumbnail;
  res.json({ ok: true });
});

// Export page elements (for JPEG export)
app.get('/api/pages/:pageId/export', (req, res) => {
  res.json(getElements(req.params.pageId));
});

// Serve client build
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('<html><body style="background:#0e0e10;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div>Building... please wait and refresh</div></body></html>');
  }
});

// ─── WebSocket ───────────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// boardId -> Set<ws>
const boardRooms = {};

function broadcast(boardId, message, exceptWs = null) {
  const room = boardRooms[boardId];
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach(ws => {
    if (ws !== exceptWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function broadcastPresence(boardId) {
  const room = boardRooms[boardId];
  if (!room) return;
  const users = [];
  room.forEach(ws => {
    if (ws.nick) users.push({ nick: ws.nick, color: ws.color, cursor: ws.cursor });
  });
  broadcast(boardId, { type: 'presence', users });
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        ws.boardId = msg.boardId;
        ws.nick = msg.nick;
        ws.color = msg.color || '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
        if (!boardRooms[msg.boardId]) boardRooms[msg.boardId] = new Set();
        boardRooms[msg.boardId].add(ws);
        broadcastPresence(msg.boardId);
        break;
      }
      case 'cursor': {
        ws.cursor = msg.cursor;
        broadcastPresence(ws.boardId);
        break;
      }
      case 'draw_element': {
        // msg.element: { id, pageId, type, data, nick, color }
        const board = getBoard(ws.boardId);
        const role = getUserRole(board, ws.nick);
        if (!role || role === 'viewer') break;
        if (!store.elements[msg.element.pageId]) store.elements[msg.element.pageId] = [];
        // Upsert
        const arr = store.elements[msg.element.pageId];
        const idx = arr.findIndex(e => e.id === msg.element.id);
        if (idx >= 0) arr[idx] = msg.element;
        else arr.push(msg.element);
        broadcast(ws.boardId, { type: 'draw_element', element: msg.element }, ws);
        break;
      }
      case 'delete_element': {
        const board = getBoard(ws.boardId);
        const role = getUserRole(board, ws.nick);
        if (!role || role === 'viewer') break;
        const arr = store.elements[msg.pageId] || [];
        store.elements[msg.pageId] = arr.filter(e => e.id !== msg.elementId);
        broadcast(ws.boardId, { type: 'delete_element', pageId: msg.pageId, elementId: msg.elementId }, ws);
        break;
      }
      case 'clear_page': {
        const board = getBoard(ws.boardId);
        const role = getUserRole(board, ws.nick);
        if (role !== 'owner') break;
        store.elements[msg.pageId] = [];
        broadcast(ws.boardId, { type: 'clear_page', pageId: msg.pageId }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.boardId && boardRooms[ws.boardId]) {
      boardRooms[ws.boardId].delete(ws);
      if (boardRooms[ws.boardId].size === 0) delete boardRooms[ws.boardId];
      else broadcastPresence(ws.boardId);
    }
  });
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`DrawBoard server on :${PORT}`));
