import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

// Vercel WebSocket room relay cho trò Quét Thẻ QR.
// Không dùng Firebase, Firestore hay database để chuyển đáp án.
// Mỗi sessionId là một phòng riêng; dữ liệu chỉ tồn tại trong RAM của Function instance.

const server = createServer((req, res) => {
  res.statusCode = 426;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: false, message: 'WebSocket upgrade required' }));
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const meta = new WeakMap();

function cleanSession(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
}

function getRoom(sessionId) {
  let room = rooms.get(sessionId);
  if (!room) {
    room = new Set();
    rooms.set(sessionId, room);
  }
  return room;
}

function send(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try { ws.send(JSON.stringify(data)); } catch {}
}

function broadcast(sessionId, sender, data) {
  const room = rooms.get(sessionId);
  if (!room) return;
  const text = JSON.stringify(data);
  for (const client of room) {
    if (client === sender || client.readyState !== WebSocket.OPEN) continue;
    try { client.send(text); } catch {}
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', 'https://vercel.local');
  const sessionId = cleanSession(url.searchParams.get('session'));
  const role = url.searchParams.get('role') === 'mobile' ? 'mobile' : 'desktop';

  if (!sessionId) {
    send(ws, { type: 'error', message: 'Missing QR session' });
    ws.close(1008, 'Missing session');
    return;
  }

  const room = getRoom(sessionId);
  room.add(ws);
  meta.set(ws, { sessionId, role });

  send(ws, { type: 'server_ready', sessionId, role, at: Date.now() });
  broadcast(sessionId, ws, {
    type: 'presence', action: 'open', role, sessionId, at: Date.now()
  });

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'ping') {
      send(ws, { type: 'pong', sessionId, at: Date.now() });
      return;
    }

    broadcast(sessionId, ws, {
      ...data,
      sessionId,
      senderRole: role,
      serverAt: Date.now(),
    });
  });

  const cleanup = () => {
    const info = meta.get(ws);
    if (!info) return;
    meta.delete(ws);
    const activeRoom = rooms.get(info.sessionId);
    if (activeRoom) {
      activeRoom.delete(ws);
      if (activeRoom.size === 0) rooms.delete(info.sessionId);
    }
    broadcast(info.sessionId, ws, {
      type: 'presence', action: 'close', role: info.role,
      sessionId: info.sessionId, at: Date.now()
    });
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

export default server;
