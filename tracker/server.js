'use strict';
/**
 * Family Money Tracker — zero-dependency Node server.
 *
 * - Serves a single-page web UI from ./public
 * - JSON API with CRUD for members, categories and transactions
 * - Shared-password auth (sensible when exposed over a public tunnel)
 * - Data persisted to ./data/db.json with atomic writes
 *
 * Config via env:
 *   PORT              (default 4000)
 *   TRACKER_PASSWORD  shared family password (default "family")
 *   TRACKER_SECRET    HMAC secret for the session cookie (auto-generated if unset)
 *   TRACKER_CURRENCY  currency symbol for the UI (default "$")
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '4000', 10);
// Two roles: admin (full control) and family (add + view only).
// TRACKER_PASSWORD is a convenient fallback for both if the specific ones are unset.
const ADMIN_PASSWORD = process.env.TRACKER_ADMIN_PASSWORD || process.env.TRACKER_PASSWORD || 'admin';
const FAMILY_PASSWORD = process.env.TRACKER_FAMILY_PASSWORD || process.env.TRACKER_PASSWORD || 'family';
const SECRET = process.env.TRACKER_SECRET || crypto.randomBytes(32).toString('hex');
const CURRENCY = process.env.TRACKER_CURRENCY || '$';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function defaultDb() {
  return {
    members: [
      { id: id(), name: 'Me', color: '#6366f1' },
    ],
    categories: [
      { id: id(), name: 'Salary', type: 'income', budget: 0 },
      { id: id(), name: 'Groceries', type: 'expense', budget: 600 },
      { id: id(), name: 'Rent', type: 'expense', budget: 1500 },
      { id: id(), name: 'Utilities', type: 'expense', budget: 300 },
      { id: id(), name: 'Transport', type: 'expense', budget: 200 },
      { id: id(), name: 'Dining', type: 'expense', budget: 250 },
      { id: id(), name: 'Fun', type: 'expense', budget: 150 },
    ],
    transactions: [],
    chat: [],
    bills: [],
    goals: [],
  };
}

function id() {
  return crypto.randomBytes(9).toString('base64url');
}

let db;
function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // basic shape guard
    db.members ||= [];
    db.categories ||= [];
    db.transactions ||= [];
    db.chat ||= [];
    db.bills ||= [];
    db.goals ||= [];
  } catch {
    db = defaultDb();
    saveDb();
  }
}

let saveQueued = false;
function saveDb() {
  // debounce bursts of writes into a single flush
  if (saveQueued) return;
  saveQueued = true;
  setImmediate(() => {
    saveQueued = false;
    const tmp = DB_FILE + '.' + process.pid + '.tmp';
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE); // atomic on same filesystem
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function makeToken(role) {
  // token = base64("expiry|role").hmac  — expiry 30 days
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${exp}|${role}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

// Returns the role string ("admin" | "family") if valid, otherwise null.
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  let payload;
  try {
    payload = Buffer.from(b64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [expStr, role] = payload.split('|');
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() >= exp) return null;
  return role === 'admin' || role === 'family' ? role : null;
}

function constantEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Returns the caller's role ("admin" | "family") or null if unauthenticated.
function roleOf(req) {
  return verifyToken(parseCookies(req).ftoken);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      raw += c;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function str(v, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function pick(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method;

  try {
    // ---- public endpoints -------------------------------------------------
    if (p === '/api/session' && method === 'GET') {
      return send(res, 200, { role: roleOf(req), authenticated: !!roleOf(req), currency: CURRENCY });
    }

    if (p === '/api/login' && method === 'POST') {
      const body = await readBody(req);
      const pw = str(body.password, 300);
      // Check admin first so a shared fallback password grants admin.
      let role = null;
      if (constantEquals(pw, ADMIN_PASSWORD)) role = 'admin';
      else if (constantEquals(pw, FAMILY_PASSWORD)) role = 'family';
      if (role) {
        const cookie = `ftoken=${makeToken(role)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;
        return send(res, 200, { ok: true, role, currency: CURRENCY }, { 'Set-Cookie': cookie });
      }
      return send(res, 401, { error: 'Wrong password' });
    }

    if (p === '/api/logout' && method === 'POST') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'ftoken=; HttpOnly; Path=/; Max-Age=0' });
    }

    // ---- static assets ----------------------------------------------------
    if (!p.startsWith('/api/')) {
      return serveStatic(res, p);
    }

    // ---- everything below requires auth ----------------------------------
    const role = roleOf(req);
    if (!role) return send(res, 401, { error: 'unauthorized' });
    // Family can read data and add transactions; everything else is admin-only.
    const isAdmin = role === 'admin';
    const familyAllowed =
      (p === '/api/data' && method === 'GET') ||
      (p === '/api/transactions' && method === 'POST') ||
      (p === '/api/chat' && method !== 'DELETE') ||          // read/post chat, but not clear-all
      (p === '/api/export.csv' && method === 'GET') ||       // export is shared data
      (p.startsWith('/api/bills/') && p.endsWith('/pay') && method === 'POST') ||       // log a bill payment
      (p.startsWith('/api/goals/') && p.endsWith('/contribute') && method === 'POST');  // add to a goal
    if (!isAdmin && !familyAllowed) {
      return send(res, 403, { error: 'Admin access required for this action' });
    }

    if (p === '/api/data' && method === 'GET') {
      return send(res, 200, db);
    }

    // ---- chat (admin + family) -------------------------------------------
    if (p === '/api/chat' && method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
      const messages = db.chat.filter((m) => m.createdAt > since);
      return send(res, 200, { messages, now: Date.now() });
    }
    if (p === '/api/chat' && method === 'POST') {
      const b = await readBody(req);
      const text = str(b.text, 2000);
      if (!text) return send(res, 400, { error: 'empty message' });
      const m = {
        id: id(),
        role,
        name: str(b.name, 40) || (role === 'admin' ? 'Admin' : 'Family'),
        text,
        createdAt: Date.now(),
      };
      db.chat.push(m);
      if (db.chat.length > 1000) db.chat = db.chat.slice(-1000); // cap history
      saveDb();
      return send(res, 200, m);
    }
    if (p === '/api/chat' && method === 'DELETE') { // admin only (guarded above)
      db.chat = [];
      saveDb();
      return send(res, 200, { ok: true });
    }

    // ---- CSV export (admin + family) -------------------------------------
    if (p === '/api/export.csv' && method === 'GET') {
      const esc = (v) => {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const rows = [['Date', 'Type', 'Amount', 'Category', 'Member', 'Note']];
      db.transactions
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .forEach((t) => {
          const cat = db.categories.find((c) => c.id === t.categoryId);
          const mem = db.members.find((m) => m.id === t.memberId);
          rows.push([t.date, t.type, t.amount, cat ? cat.name : '', mem ? mem.name : '', t.note || '']);
        });
      const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
      return send(res, 200, csv, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="family-money.csv"',
      });
    }

    // ---- recurring bills --------------------------------------------------
    if (p === '/api/bills' && method === 'POST') {
      const b = await readBody(req);
      const name = str(b.name, 60);
      if (!name) return send(res, 400, { error: 'name required' });
      const bill = {
        id: id(),
        name,
        amount: Math.abs(num(b.amount)),
        categoryId: str(b.categoryId, 40),
        memberId: str(b.memberId, 40),
        dayOfMonth: Math.min(31, Math.max(1, Math.round(num(b.dayOfMonth)) || 1)),
      };
      db.bills.push(bill);
      saveDb();
      return send(res, 200, bill);
    }
    if (p.startsWith('/api/bills/') && p.endsWith('/pay') && method === 'POST') {
      const bid = p.split('/')[3];
      const bill = db.bills.find((x) => x.id === bid);
      if (!bill) return send(res, 404, { error: 'not found' });
      const t = {
        id: id(),
        date: new Date().toISOString().slice(0, 10),
        amount: bill.amount,
        type: 'expense',
        memberId: bill.memberId,
        categoryId: bill.categoryId,
        note: bill.name + ' (bill)',
        createdAt: Date.now(),
      };
      db.transactions.push(t);
      saveDb();
      return send(res, 200, t);
    }
    if (p.startsWith('/api/bills/') && method === 'PUT') {
      const bid = p.split('/')[3];
      const bill = db.bills.find((x) => x.id === bid);
      if (!bill) return send(res, 404, { error: 'not found' });
      const b = await readBody(req);
      if (b.name !== undefined) bill.name = str(b.name, 60) || bill.name;
      if (b.amount !== undefined) bill.amount = Math.abs(num(b.amount));
      if (b.categoryId !== undefined) bill.categoryId = str(b.categoryId, 40);
      if (b.memberId !== undefined) bill.memberId = str(b.memberId, 40);
      if (b.dayOfMonth !== undefined) bill.dayOfMonth = Math.min(31, Math.max(1, Math.round(num(b.dayOfMonth)) || 1));
      saveDb();
      return send(res, 200, bill);
    }
    if (p.startsWith('/api/bills/') && method === 'DELETE') {
      const bid = p.split('/')[3];
      db.bills = db.bills.filter((x) => x.id !== bid);
      saveDb();
      return send(res, 200, { ok: true });
    }

    // ---- savings goals ----------------------------------------------------
    if (p === '/api/goals' && method === 'POST') {
      const b = await readBody(req);
      const name = str(b.name, 60);
      if (!name) return send(res, 400, { error: 'name required' });
      const g = {
        id: id(),
        name,
        target: Math.max(0, num(b.target)),
        saved: Math.max(0, num(b.saved)),
        color: str(b.color, 20) || randomColor(),
      };
      db.goals.push(g);
      saveDb();
      return send(res, 200, g);
    }
    if (p.startsWith('/api/goals/') && p.endsWith('/contribute') && method === 'POST') {
      const gid = p.split('/')[3];
      const g = db.goals.find((x) => x.id === gid);
      if (!g) return send(res, 404, { error: 'not found' });
      const b = await readBody(req);
      g.saved = Math.max(0, (g.saved || 0) + num(b.amount));
      saveDb();
      return send(res, 200, g);
    }
    if (p.startsWith('/api/goals/') && method === 'PUT') {
      const gid = p.split('/')[3];
      const g = db.goals.find((x) => x.id === gid);
      if (!g) return send(res, 404, { error: 'not found' });
      const b = await readBody(req);
      if (b.name !== undefined) g.name = str(b.name, 60) || g.name;
      if (b.target !== undefined) g.target = Math.max(0, num(b.target));
      if (b.saved !== undefined) g.saved = Math.max(0, num(b.saved));
      if (b.color !== undefined) g.color = str(b.color, 20) || g.color;
      saveDb();
      return send(res, 200, g);
    }
    if (p.startsWith('/api/goals/') && method === 'DELETE') {
      const gid = p.split('/')[3];
      db.goals = db.goals.filter((x) => x.id !== gid);
      saveDb();
      return send(res, 200, { ok: true });
    }

    // ---- members ----------------------------------------------------------
    if (p === '/api/members' && method === 'POST') {
      const b = await readBody(req);
      const name = str(b.name, 60);
      if (!name) return send(res, 400, { error: 'name required' });
      const m = { id: id(), name, color: str(b.color, 20) || randomColor() };
      db.members.push(m);
      saveDb();
      return send(res, 200, m);
    }
    if (p.startsWith('/api/members/') && method === 'DELETE') {
      const mid = p.split('/')[3];
      db.members = db.members.filter((m) => m.id !== mid);
      db.transactions = db.transactions.filter((t) => t.memberId !== mid);
      saveDb();
      return send(res, 200, { ok: true });
    }

    // ---- categories -------------------------------------------------------
    if (p === '/api/categories' && method === 'POST') {
      const b = await readBody(req);
      const name = str(b.name, 60);
      if (!name) return send(res, 400, { error: 'name required' });
      const c = {
        id: id(),
        name,
        type: pick(b.type, ['income', 'expense'], 'expense'),
        budget: Math.max(0, num(b.budget)),
      };
      db.categories.push(c);
      saveDb();
      return send(res, 200, c);
    }
    if (p.startsWith('/api/categories/') && method === 'PUT') {
      const cid = p.split('/')[3];
      const c = db.categories.find((x) => x.id === cid);
      if (!c) return send(res, 404, { error: 'not found' });
      const b = await readBody(req);
      if (b.name !== undefined) c.name = str(b.name, 60) || c.name;
      if (b.type !== undefined) c.type = pick(b.type, ['income', 'expense'], c.type);
      if (b.budget !== undefined) c.budget = Math.max(0, num(b.budget));
      saveDb();
      return send(res, 200, c);
    }
    if (p.startsWith('/api/categories/') && method === 'DELETE') {
      const cid = p.split('/')[3];
      db.categories = db.categories.filter((x) => x.id !== cid);
      db.transactions = db.transactions.filter((t) => t.categoryId !== cid);
      saveDb();
      return send(res, 200, { ok: true });
    }

    // ---- transactions -----------------------------------------------------
    if (p === '/api/transactions' && method === 'POST') {
      const b = await readBody(req);
      const amount = Math.abs(num(b.amount));
      if (!amount) return send(res, 400, { error: 'amount required' });
      const t = {
        id: id(),
        date: str(b.date, 10) || new Date().toISOString().slice(0, 10),
        amount,
        type: pick(b.type, ['income', 'expense'], 'expense'),
        memberId: str(b.memberId, 40),
        categoryId: str(b.categoryId, 40),
        note: str(b.note, 300),
        createdAt: Date.now(),
      };
      db.transactions.push(t);
      saveDb();
      return send(res, 200, t);
    }
    if (p.startsWith('/api/transactions/') && method === 'PUT') {
      const tid = p.split('/')[3];
      const t = db.transactions.find((x) => x.id === tid);
      if (!t) return send(res, 404, { error: 'not found' });
      const b = await readBody(req);
      if (b.date !== undefined) t.date = str(b.date, 10) || t.date;
      if (b.amount !== undefined) t.amount = Math.abs(num(b.amount)) || t.amount;
      if (b.type !== undefined) t.type = pick(b.type, ['income', 'expense'], t.type);
      if (b.memberId !== undefined) t.memberId = str(b.memberId, 40);
      if (b.categoryId !== undefined) t.categoryId = str(b.categoryId, 40);
      if (b.note !== undefined) t.note = str(b.note, 300);
      saveDb();
      return send(res, 200, t);
    }
    if (p.startsWith('/api/transactions/') && method === 'DELETE') {
      const tid = p.split('/')[3];
      db.transactions = db.transactions.filter((x) => x.id !== tid);
      saveDb();
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 400, { error: err.message || 'bad request' });
  }
});

function randomColor() {
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

loadDb();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Family Money Tracker running at http://localhost:${PORT}`);
  console.log(`  Admin password:  ${ADMIN_PASSWORD}`);
  console.log(`  Family password: ${FAMILY_PASSWORD}`);
  console.log(`  Data file: ${DB_FILE}\n`);
});
