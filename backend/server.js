const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// ========================================
// Path Configuration
// ========================================

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const MUSIC_DIR = path.join(ROOT, 'music');
const VIDEOS_DIR = path.join(ROOT, 'videos');
const IMG_DIR = path.join(ROOT, 'img');
const CONFIG_FILE = path.join(DATA_DIR, 'server-config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// ========================================
// Middleware Setup
// ========================================

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure music and videos directories exist
if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, JSON.stringify({ subs: [] }, null, 2));

// ========================================
// Configuration Management
// ========================================

let config = { decoration: null, currentMusic: null, vapidKeys: null };
try {
  if (fs.existsSync(CONFIG_FILE)) config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (err) { console.error('Failed reading config, using defaults', err); }

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (err) { console.error('Failed to save config', err); }
}

// ========================================
// Sessions
// ========================================

app.use(session({
  secret: process.env.SESSION_SECRET || 'sym40n-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ========================================
// VAPID Keys for Web Push
// ========================================

if (!config.vapidKeys) {
  config.vapidKeys = webpush.generateVAPIDKeys();
  saveConfig();
}
webpush.setVapidDetails('mailto:support@sym40n.com', config.vapidKeys.publicKey, config.vapidKeys.privateKey);

// ========================================
// Authentication Middleware (Removed Admin)
// ========================================

// Authentication middleware removed - no longer needed

// ========================================
// File Upload Configuration
// ========================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, MUSIC_DIR);
  },
  filename: function (req, file, cb) {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-_]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage: storage });

// ========================================
// Subscription Management
// ========================================

function loadSubs() {
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
  } catch (e) {
    return { subs: [] };
  }
}

function saveSubs(data) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(data, null, 2));
}

// ========================================
// API Routes - Music Management (Read-Only)
// ========================================

app.get('/api/music-files', (req, res) => {
  try {
    const files = fs.readdirSync(MUSIC_DIR)
      .filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f))
      .sort();
    return res.json({ ok: true, files, count: files.length });
  } catch (e) {
    console.error('Error reading music directory:', e);
    return res.json({ ok: false, files: [], error: e.message });
  }
});

// ========================================
// API Routes - Push Notifications
// ========================================

app.get('/vapidPublicKey', (req, res) => {
  return res.json({ publicKey: config.vapidKeys.publicKey });
});

app.post('/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription' });
  }
  const s = loadSubs();
  s.subs = s.subs || [];
  if (!s.subs.find(x => x.endpoint === subscription.endpoint)) {
    s.subs.push(subscription);
    saveSubs(s);
    console.log(`✓ New subscription added`);
  }
  return res.json({ ok: true });
});

// ========================================
// WebSocket (Socket.io) Events
// ========================================

io.on('connection', (socket) => {
  console.log(`✓ Client connected: ${socket.id}`);
  
  // Send current config to newly connected client
  socket.emit('config', config);

  socket.on('disconnect', () => {
    console.log(`✗ Client disconnected: ${socket.id}`);
  });

  // Handle any custom events from client
  socket.on('status', (data) => {
    console.log(`Status from ${socket.id}:`, data);
  });
});

// ========================================
// Health Check Endpoint
// ========================================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    musicFilesCount: fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f)).length
  });
});

// ========================================
// 404 Handler
// ========================================

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ========================================
// Error Handler
// ========================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

// ========================================
// Start Server
// ========================================

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  SYM40N Gaming Backend Server          ║`);
  console.log(`║  Port: ${PORT}${' '.repeat(34 - String(PORT).length)}║`);
  console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}${' '.repeat(21 - (process.env.NODE_ENV || 'development').length)}║`);
  console.log(`║  Music Files: ${fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f)).length}${' '.repeat(29)}║`);
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nServer is ready at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`Music API: GET http://localhost:${PORT}/api/music-files`);
  console.log(`\n[${new Date().toISOString()}] Server started successfully\n`);
});

module.exports = server;
