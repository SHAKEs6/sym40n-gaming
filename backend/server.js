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
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';

// paths inside backend
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'music');
const CONFIG_FILE = path.join(DATA_DIR, 'server-config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// serve frontend from project root
app.use(express.static(ROOT));
// serve music from backend/public/music at /music
app.use('/music', express.static(MUSIC_DIR));

// ensure folders exist
fs.mkdirSync(MUSIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, JSON.stringify({ subs: [] }, null, 2));

// load or initialize config
let config = { decoration: null, currentMusic: null, vapidKeys: null };
try {
  if (fs.existsSync(CONFIG_FILE)) config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (err) { console.error('Failed reading config, using defaults', err); }

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch (err) { console.error('Failed to save config', err); }
}

// sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ensure VAPID keys
if (!config.vapidKeys) {
  config.vapidKeys = webpush.generateVAPIDKeys();
  saveConfig();
}
webpush.setVapidDetails('mailto:admin@localhost', config.vapidKeys.publicKey, config.vapidKeys.privateKey);

// user helpers
function loadUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return { users: [] }; } }
function saveUsers(data) { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); }

// ensure at least one admin user (created from ADMIN_PASS)
(() => {
  const u = loadUsers();
  if (!u.users || u.users.length === 0) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    u.users = [{ username: 'admin', passwordHash: hash, role: 'admin' }];
    saveUsers(u);
    console.log('Created default admin user (username: admin)');
  }
})();

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

// multer setup for music uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, MUSIC_DIR); },
  filename: function (req, file, cb) {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-_]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage });

// Subscriptions helpers
function loadSubs() { try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { return { subs: [] }; } }
function saveSubs(data) { fs.writeFileSync(SUBS_FILE, JSON.stringify(data, null, 2)); }

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const u = loadUsers();
  const user = (u.users || []).find(x => x.username === username);
  if (!user) return res.status(401).json({ ok: false });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ ok: false });
  req.session.user = { username: user.username, role: user.role };
  return res.json({ ok: true, user: req.session.user });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/vapidPublicKey', (req, res) => {
  return res.json({ publicKey: config.vapidKeys.publicKey });
});

app.post('/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ ok: false });
  const s = loadSubs();
  s.subs = s.subs || [];
  if (!s.subs.find(x => x.endpoint === subscription.endpoint)) {
    s.subs.push(subscription);
    saveSubs(s);
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
  return res.json({ ok: true, results });
});

app.post('/admin/upload-music', ensureAdmin, upload.single('music'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'no file' });
  const url = `/music/${req.file.filename}`;
  return res.json({ ok: true, filename: req.file.filename, url });
});

app.post('/admin/set-decoration', ensureAdmin, (req, res) => {
  const { decoration } = req.body;
  config.decoration = decoration || null;
  saveConfig();
  io.emit('decoration', config.decoration);
  return res.json({ ok: true, decoration: config.decoration });
});

app.post('/admin/play-music', ensureAdmin, (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ ok: false, error: 'missing filename' });
  config.currentMusic = filename;
  saveConfig();
  const url = `/music/${filename}`;
  console.log(`Broadcasting play-music event with url: ${url}`);
  io.emit('play-music', { url, filename });
  return res.json({ ok: true, url });
});

app.post('/admin/notify', ensureAdmin, (req, res) => {
  const { title, message } = req.body;
  const payload = { title: title || 'Notification', message: message || '' };
  io.emit('notification', payload);
  return res.json({ ok: true });
});

app.get('/admin/config', ensureAdmin, (req, res) => {
  return res.json({ ok: true, config });
});

io.on('connection', (socket) => {
  socket.emit('config', config);
  console.log('client connected', socket.id);
  socket.on('disconnect', () => { console.log('client disconnected', socket.id); });
});

server.listen(PORT, () => { console.log(`Backend server listening on port ${PORT}`); });
