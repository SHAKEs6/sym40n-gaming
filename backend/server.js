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
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin@2025';

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
webpush.setVapidDetails('mailto:admin@localhost', config.vapidKeys.publicKey, config.vapidKeys.privateKey);

// ========================================
// User Management Functions
// ========================================

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return { users: [] };
  }
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// Ensure at least one admin user
(() => {
  const u = loadUsers();
  if (!u.users || u.users.length === 0) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    u.users = [{ username: 'admin', passwordHash: hash, role: 'admin' }];
    saveUsers(u);
    console.log('✓ Created default admin user (username: admin, password: see ADMIN_PASS env var)');
  }
})();

// ========================================
// Authentication Middleware
// ========================================

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

function ensureAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'] || req.body.password || req.query.password;
  if (pass && pass === ADMIN_PASS) return next();
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

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
// API Routes - Authentication
// ========================================

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const u = loadUsers();
  const user = (u.users || []).find(x => x.username === username);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
  req.session.user = { username: user.username, role: user.role };
  return res.json({ ok: true, user: req.session.user });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.json({ ok: false, error: err.message });
    return res.json({ ok: true });
  });
});

// ========================================
// API Routes - Music Management
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

app.post('/admin/upload-music', ensureAdmin, upload.single('music'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file provided' });
  }
  const url = `/music/${req.file.filename}`;
  console.log(`✓ Music uploaded: ${req.file.filename}`);
  return res.json({ ok: true, filename: req.file.filename, url });
});

app.delete('/admin/remove-music/:filename', ensureAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(MUSIC_DIR, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(MUSIC_DIR)) {
      return res.status(400).json({ ok: false, error: 'Invalid filename' });
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✓ Music removed: ${filename}`);
      return res.json({ ok: true });
    } else {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ========================================
// API Routes - Admin Controls
// ========================================

app.post('/admin/play-music', ensureAdmin, (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ ok: false, error: 'Missing filename' });
  }
  config.currentMusic = filename;
  saveConfig();
  const url = `/music/${filename}`;
  console.log(`Broadcasting play-music event with url: ${url}`);
  io.emit('play-music', { url, filename });
  return res.json({ ok: true, url, filename });
});

app.post('/admin/set-decoration', ensureAdmin, (req, res) => {
  const { decoration } = req.body;
  config.decoration = decoration || null;
  saveConfig();
  io.emit('decoration', config.decoration);
  console.log(`✓ Decoration set: ${decoration || 'none'}`);
  return res.json({ ok: true, decoration: config.decoration });
});

app.post('/admin/notify', ensureAdmin, (req, res) => {
  const { title, message } = req.body;
  const payload = { title: title || 'Notification', message: message || '' };
  io.emit('notification', payload);
  console.log(`✓ Notification sent: ${title}`);
  return res.json({ ok: true });
});

app.get('/admin/config', ensureAdmin, (req, res) => {
  return res.json({ ok: true, config });
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

app.post('/admin/send-push', ensureAdmin, async (req, res) => {
  const { title, message } = req.body;
  const payload = JSON.stringify({ title: title || 'Push', message: message || '' });
  const s = loadSubs();
  const results = [];
  for (const sub of (s.subs || [])) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, ok: true });
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        s.subs = s.subs.filter(x => x.endpoint !== sub.endpoint);
      }
      results.push({ endpoint: sub.endpoint, ok: false, error: err.message });
    }
  }
  saveSubs(s);
  console.log(`✓ Push notification sent to ${results.filter(r => r.ok).length} devices`);
  return res.json({ ok: true, results });
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
