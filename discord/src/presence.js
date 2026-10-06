// Online status. Interactions arrive over HTTP, so the bot never needs the gateway to work, but Discord (and bot lists
// such as top.gg) show it as offline unless something holds a gateway session. This Durable Object holds one: it
// connects, identifies with no intents (no events are received), heartbeats, and an alarm every WATCH_MS reconnects it
// when the socket has dropped or stopped acknowledging heartbeats.

const GATEWAY = 'https://gateway.discord.gg/?v=10&encoding=json';
const WATCH_MS = 30_000;
const STALE_MS = 120_000; // no heartbeat ack for this long: the session is dead
const OP = { HEARTBEAT: 1, IDENTIFY: 2, RECONNECT: 7, INVALID_SESSION: 9, HELLO: 10, ACK: 11 };

export class Presence {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ws = null;
    this.seq = null;
    this.lastAck = 0;
    this.timer = null;
  }

  async fetch() {
    await this.ensure();
    return Response.json({ connected: this.alive() });
  }

  async alarm() {
    await this.ensure();
  }

  alive() {
    return Boolean(this.ws && this.ws.readyState === 1 && Date.now() - this.lastAck < STALE_MS);
  }

  async ensure() {
    if (!this.alive()) await this.connect().catch((err) => console.error(`whosbluffing-discord presence: ${err.message}`));
    await this.state.storage.setAlarm(Date.now() + WATCH_MS);
  }

  drop() {
    clearInterval(this.timer);
    this.timer = null;
    try { this.ws?.close(1000); } catch { /* already closed */ }
    this.ws = null;
  }

  async connect() {
    this.drop();
    const res = await fetch(GATEWAY, { headers: { Upgrade: 'websocket' } });
    const ws = res.webSocket;
    if (!ws) throw new Error(`gateway upgrade refused (${res.status})`);
    ws.accept();
    this.ws = ws;
    this.lastAck = Date.now();
    ws.addEventListener('message', (e) => {
      try { this.onMessage(ws, JSON.parse(e.data)); } catch (err) { console.error(`whosbluffing-discord presence: ${err.message}`); }
    });
    ws.addEventListener('close', () => { if (this.ws === ws) this.drop(); });
  }

  send(ws, op, d) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ op, d }));
  }

  onMessage(ws, m) {
    if (m.s != null) this.seq = m.s;
    if (m.op === OP.HELLO) {
      this.timer = setInterval(() => this.send(ws, OP.HEARTBEAT, this.seq), m.d.heartbeat_interval);
      this.send(ws, OP.IDENTIFY, {
        token: this.env.DISCORD_BOT_TOKEN,
        intents: 0,
        properties: { os: 'linux', browser: 'whosbluffing', device: 'whosbluffing' },
        presence: { status: 'online', since: null, afk: false, activities: [{ name: '/bluff play', type: 0 }] },
      });
    } else if (m.op === OP.ACK) {
      this.lastAck = Date.now();
    } else if (m.op === OP.HEARTBEAT) {
      this.send(ws, OP.HEARTBEAT, this.seq);
    } else if (m.op === OP.RECONNECT || m.op === OP.INVALID_SESSION) {
      this.drop(); // the next alarm identifies again
    }
  }
}
