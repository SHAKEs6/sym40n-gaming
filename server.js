const express = require('express');
const http = require('http');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Server } = require('socket.io');
const crypto = require('crypto');

const APP_PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Admin@1234';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());

// serve static site files
// Serve static files. In production serve the built frontend from /dist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
} else {
  app.use(express.static(path.join(__dirname)));
}

// Setup Postgres DB (POOL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI || 'postgres://postgres:postgres@localhost:5432/sym40n'
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  )`);

  const r = await pool.query('SELECT id FROM admin WHERE username = $1', ['admin']);
  if (r.rowCount === 0) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    const defaultSettings = { siteName: 'Sym40n Gaming', liveEnabled: true };
    await pool.query('INSERT INTO admin (username, password, settings) VALUES ($1,$2,$3)', ['admin', hash, defaultSettings]);
    console.log('Seeded admin user with default password (or set ADMIN_PASSWORD env var)');
  }
}

initDb().catch((e) => console.error('DB init error', e));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Login - returns access token and refresh token
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const r = await pool.query('SELECT * FROM admin WHERE username = $1', [username]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });
    const row = r.rows[0];
    if (!bcrypt.compareSync(password, row.password)) return res.status(401).json({ error: 'invalid credentials' });
    const accessToken = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '15m' });

    // create refresh token: return format <id>.<token>
    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = bcrypt.hashSync(token, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
    const insert = await pool.query('INSERT INTO refresh_tokens (admin_id, token_hash, expires_at) VALUES ($1,$2,$3) RETURNING id', [row.id, tokenHash, expiresAt]);
    const refreshId = insert.rows[0].id;
    const refreshToken = `${refreshId}.${token}`;

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Refresh access token using refresh token
app.post('/api/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  const parts = refreshToken.split('.');
  if (parts.length < 2) return res.status(400).json({ error: 'invalid refresh token format' });
  const id = parseInt(parts[0], 10);
  const token = parts.slice(1).join('.');
  try {
    const r = await pool.query('SELECT * FROM refresh_tokens WHERE id = $1 AND expires_at > NOW()', [id]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid or expired refresh token' });
    const row = r.rows[0];
    if (!bcrypt.compareSync(token, row.token_hash)) return res.status(401).json({ error: 'invalid refresh token' });

    // get admin to issue new access token
    const admin = await pool.query('SELECT id, username FROM admin WHERE id = $1', [row.admin_id]);
    if (admin.rowCount === 0) return res.status(401).json({ error: 'invalid token' });
    const adminRow = admin.rows[0];
    const accessToken = jwt.sign({ id: adminRow.id, username: adminRow.username }, JWT_SECRET, { expiresIn: '15m' });

    // rotate refresh token: issue new token and replace
    const newToken = crypto.randomBytes(48).toString('hex');
    const newHash = bcrypt.hashSync(newToken, 10);
    const newExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await pool.query('UPDATE refresh_tokens SET token_hash=$1, expires_at=$2 WHERE id=$3', [newHash, newExpires, id]);
    const newRefreshToken = `${id}.${newToken}`;

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Logout - revoke refresh token
app.post('/api/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  const parts = refreshToken.split('.');
  const id = parseInt(parts[0], 10);
  try {
    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/settings', authMiddleware, (req, res) => {
  pool.query('SELECT settings FROM admin WHERE id = $1', [req.user.id])
    .then(r => {
      if (r.rowCount === 0) return res.status(404).json({ error: 'admin not found' });
      const settings = r.rows[0].settings || {};
      res.json({ settings });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'db error' });
    });
});

app.post('/api/admin/settings', authMiddleware, (req, res) => {
  const settings = req.body || {};
  pool.query('UPDATE admin SET settings = $1 WHERE id = $2', [settings, req.user.id])
    .then(() => res.json({ ok: true }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'db error' });
    });
});

app.post('/api/admin/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
  (async () => {
    try {
      const r = await pool.query('SELECT password FROM admin WHERE id = $1', [req.user.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'admin not found' });
      const row = r.rows[0];
      if (!bcrypt.compareSync(oldPassword, row.password)) return res.status(401).json({ error: 'old password incorrect' });
      const hash = bcrypt.hashSync(newPassword, 10);
      await pool.query('UPDATE admin SET password = $1 WHERE id = $2', [hash, req.user.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'db error' });
    }
  })();
});

// Socket.IO signaling for WebRTC streaming
let adminSocketId = null;
const peerConnections = {}; // map viewerId -> placeholder

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    const role = data && data.role;
    if (role === 'admin') {
      adminSocketId = socket.id;
      console.log('Admin connected', socket.id);
    } else {
      console.log('Viewer connected', socket.id);
      // inform admin if present
      if (adminSocketId) io.to(adminSocketId).emit('viewer-join', { viewerId: socket.id });
    }
  });

  socket.on('offer', ({ target, sdp }) => {
    if (!target) return;
    io.to(target).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ target, sdp }) => {
    if (!target) return;
    io.to(target).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice', ({ target, candidate }) => {
    if (!target) return;
    io.to(target).emit('ice', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      console.log('Admin disconnected');
    } else {
      // notify admin that a viewer left
      if (adminSocketId) io.to(adminSocketId).emit('viewer-left', { viewerId: socket.id });
      console.log('Viewer disconnected', socket.id);
    }
  });
});

// Serve admin page at /admin for convenience
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

server.listen(APP_PORT, () => console.log(`Server listening on port ${APP_PORT}`));
