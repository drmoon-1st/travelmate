/*
 * Simple HTTP server for the TravelMate application.
 *
 * This server serves the static files in the project directory and exposes
 * a JSON-based REST API backed by a file-based database stored in db.json.
 *
 * Since external dependencies are unavailable in this environment, the
 * server is implemented solely with Node's built‑in modules (http, fs,
 * url and path). All data persistence uses synchronous file operations
 * for simplicity. In a real production environment you would likely
 * replace this with a proper database such as SQLite or MySQL and
 * incorporate authentication tokens.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'db.json');

// Utility to read the database from disk. If the file does not exist
// (for example on first run), a default structure is created.
function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Initialise a fresh database if none exists
    const fresh = {
      users: [],
      destinations: [],
      matches: [],
      requests: [],
      bookings: [],
      reviews: [],
      messages: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

// Utility to write the database to disk. Note that writes are
// synchronous for simplicity; because writes are infrequent and the
// database is small, this is acceptable for a demo.
function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Read request body and parse JSON
function readRequestBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    // To prevent denial of service via large payloads, limit body size
    if (body.length > 1e6) {
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    if (!body) return callback(null);
    try {
      const parsed = JSON.parse(body);
      callback(parsed);
    } catch (e) {
      callback(null);
    }
  });
}

// Send a JSON response
function sendJson(res, statusCode, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(data);
}

// Serve static files from the project directory. When no file is
// specified, index.html is returned. Unknown files result in a 404.
function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/plain';
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// API handler function. Routes all requests beginning with /api/.
function handleApi(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const db = readDb();
  // Preflight for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Login
  if (pathname === '/api/login' && req.method === 'POST') {
    return readRequestBody(req, body => {
      if (!body || !body.id || !body.pw) {
        return sendJson(res, 400, { success: false, message: 'Invalid request' });
      }
      const user = db.users.find(u => u.id === body.id);
      if (!user || user.pw !== body.pw) {
        return sendJson(res, 401, { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }
      // Return basic user info
      sendJson(res, 200, { success: true, user: { id: user.id, name: user.name, age: user.age } });
    });
  }
  // Signup
  if (pathname === '/api/signup' && req.method === 'POST') {
    return readRequestBody(req, body => {
      if (!body || !body.id || !body.pw || !body.name) {
        return sendJson(res, 400, { success: false, message: '모든 정보를 입력해주세요.' });
      }
      if (db.users.some(u => u.id === body.id)) {
        return sendJson(res, 409, { success: false, message: '이미 존재하는 아이디입니다.' });
      }
      db.users.push({ id: body.id, pw: body.pw, name: body.name, age: body.age || '' });
      writeDb(db);
      sendJson(res, 201, { success: true, message: '회원가입이 완료되었습니다.' });
    });
  }
  // Get destinations
  if (pathname === '/api/destinations' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, destinations: db.destinations });
  }
  // Add new destination (optional)
  if (pathname === '/api/destinations' && req.method === 'POST') {
    return readRequestBody(req, body => {
      if (!body || !body.name || !body.description || !body.baseCost || !body.image) {
        return sendJson(res, 400, { success: false, message: '모든 정보를 입력해주세요.' });
      }
      // Check for duplicate by name
      if (db.destinations.some(d => d.name === body.name)) {
        return sendJson(res, 409, { success: false, message: '이미 존재하는 여행지입니다.' });
      }
      db.destinations.push({ name: body.name, description: body.description, baseCost: body.baseCost, image: body.image });
      writeDb(db);
      sendJson(res, 201, { success: true });
    });
  }
  // Match request
  if (pathname === '/api/match' && req.method === 'POST') {
    return readRequestBody(req, body => {
      const { userId, destination, style, peopleCount } = body || {};
      if (!userId || !destination || !style || !peopleCount) {
        return sendJson(res, 400, { success: false, message: '모든 필드를 입력하세요.' });
      }
      // Check if user already has a request for this combination
      let reqItem = db.requests.find(r => r.userId === userId && r.destination === destination && r.style === style);
      if (reqItem) {
        // Find the group and return its status
        const group = db.matches.find(g => g.groupId === reqItem.groupId);
        return sendJson(res, 200, { success: true, group });
      }
      // Try to find an existing group to join
      let groupToJoin = null;
      for (const g of db.matches) {
        if (g.destination === destination && g.style === style && g.peopleCount === peopleCount && g.members.length < g.peopleCount) {
          groupToJoin = g;
          break;
        }
      }
      if (groupToJoin) {
        groupToJoin.members.push(userId);
        db.requests.push({ userId, destination, style, peopleCount, groupId: groupToJoin.groupId, status: 'matched' });
        writeDb(db);
        // Include memberNames array for convenience
        const memberNames = groupToJoin.members.map(uid => {
          const u = db.users.find(u => u.id === uid);
          return u ? (u.name || u.id) : uid;
        });
        const enriched = { ...groupToJoin, memberNames };
        return sendJson(res, 200, { success: true, group: enriched });
      }
      // Else create new group
      const groupId = 'group-' + Date.now();
      const newGroup = { groupId, destination, style, peopleCount, members: [userId] };
      db.matches.push(newGroup);
      db.requests.push({ userId, destination, style, peopleCount, groupId, status: 'waiting' });
      writeDb(db);
      // Include member names for new group
      const memberNamesNew = newGroup.members.map(uid => {
        const u = db.users.find(u => u.id === uid);
        return u ? (u.name || u.id) : uid;
      });
      return sendJson(res, 201, { success: true, group: { ...newGroup, memberNames: memberNamesNew } });
    });
  }
  // Check match status for a user
  if (pathname === '/api/match/status' && req.method === 'GET') {
    const userId = parsed.query.userId;
    if (!userId) return sendJson(res, 400, { success: false, message: 'userId is required' });
    const reqItem = db.requests.find(r => r.userId === userId);
    if (!reqItem) return sendJson(res, 200, { success: true, group: null });
    const group = db.matches.find(g => g.groupId === reqItem.groupId) || null;
    if (group) {
      // attach member names
      const memberNames = group.members.map(uid => {
        const u = db.users.find(u => u.id === uid);
        return u ? (u.name || u.id) : uid;
      });
      return sendJson(res, 200, { success: true, group: { ...group, memberNames } });
    }
    return sendJson(res, 200, { success: true, group: null });
  }

  // List all groups that a user belongs to
  // Example: GET /api/match/groups?userId=user1
  if (pathname === '/api/match/groups' && req.method === 'GET') {
    const userId = parsed.query.userId;
    if (!userId) {
      return sendJson(res, 400, { success: false, message: 'userId is required' });
    }
    // Find all groups containing the user
    const groupsRaw = db.matches.filter(g => g.members.includes(userId));
    // Add member names for each group
    const groups = groupsRaw.map(g => {
      const memberNames = g.members.map(uid => {
        const u = db.users.find(u => u.id === uid);
        return u ? (u.name || u.id) : uid;
      });
      return { ...g, memberNames };
    });
    return sendJson(res, 200, { success: true, groups });
  }
  // Bookings
  if (pathname === '/api/bookings' && req.method === 'GET') {
    const userId = parsed.query.userId;
    if (!userId) return sendJson(res, 400, { success: false, message: 'userId is required' });
    const userBookings = db.bookings.filter(b => b.userId === userId);
    return sendJson(res, 200, { success: true, bookings: userBookings });
  }
  if (pathname === '/api/bookings' && req.method === 'POST') {
    return readRequestBody(req, body => {
      const { userId, destination, startDate, endDate, travelers, cost } = body || {};
      if (!userId || !destination || !startDate || !endDate || !travelers || !cost) {
        return sendJson(res, 400, { success: false, message: '모든 필드를 입력하세요.' });
      }
      db.bookings.push({ userId, destination, startDate, endDate, travelers, cost });
      writeDb(db);
      return sendJson(res, 201, { success: true });
    });
  }
  // Reviews
  if (pathname === '/api/reviews' && req.method === 'GET') {
    const dest = parsed.query.destination;
    const list = dest && dest !== 'all' ? db.reviews.filter(r => r.destination === dest) : db.reviews.slice();
    return sendJson(res, 200, { success: true, reviews: list });
  }
  if (pathname === '/api/reviews' && req.method === 'POST') {
    return readRequestBody(req, body => {
      const { userId, destination, rating, comment } = body || {};
      if (!userId || !destination || !rating || !comment) {
        return sendJson(res, 400, { success: false, message: '모든 필드를 입력하세요.' });
      }
      db.reviews.push({ userId, destination, rating, comment, timestamp: Date.now() });
      writeDb(db);
      return sendJson(res, 201, { success: true });
    });
  }
  // Messages
  if (pathname === '/api/messages' && req.method === 'GET') {
    const groupId = parsed.query.groupId;
    if (!groupId) return sendJson(res, 400, { success: false, message: 'groupId is required' });
    const msgs = db.messages[groupId] || [];
    return sendJson(res, 200, { success: true, messages: msgs });
  }
  if (pathname === '/api/messages' && req.method === 'POST') {
    return readRequestBody(req, body => {
      const { userId, groupId, text } = body || {};
      if (!userId || !groupId || !text) {
        return sendJson(res, 400, { success: false, message: '모든 필드를 입력하세요.' });
      }
      if (!db.messages[groupId]) db.messages[groupId] = [];
      db.messages[groupId].push({ userId, text, timestamp: Date.now() });
      writeDb(db);
      return sendJson(res, 201, { success: true });
    });
  }
  // If we reach here, no API route matched
  sendJson(res, 404, { success: false, message: 'API not found' });
}

// Create the HTTP server
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('TravelMate server running at http://localhost:' + PORT);
});