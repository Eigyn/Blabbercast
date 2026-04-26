const { WebSocketServer } = require('ws');

function createWebSocket(server, allowedOrigins) {
  const wss = new WebSocketServer({
    server,
    verifyClient: ({ origin }) => {
      // Allow connections with no origin (non-browser clients)
      if (!origin) return true;
      return allowedOrigins.has(origin);
    }
  });

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    }
  }

  wss.on('connection', (ws) => {
    // Broadcast-only — no client commands accepted
    ws.on('message', () => {
      // Intentionally ignored
    });
  });

  return { wss, broadcast };
}

module.exports = createWebSocket;
