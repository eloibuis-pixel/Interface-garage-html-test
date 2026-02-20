import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // CORS — autorise le CRM à appeler l'API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — charge tous les appels ──────────────────────────────────
  if (req.method === 'GET') {
    const raw = await kv.lrange('calls', 0, 199);
    const calls = raw.map(function(s) {
      return typeof s === 'string' ? JSON.parse(s) : s;
    });
    return res.status(200).json(calls);
  }

  // ── POST — n8n envoie un nouvel appel ────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const call = {
      id:        Date.now(),
      prenom:    body.prenom    || '',
      numero:    body.numero    || '',
      resume:    body.resume    || '',
      probleme:  body.probleme  || '',
      heure_rdv: body.heure_rdv || null,
      timestamp: body.timestamp || new Date().toISOString(),
      chat_id:   body.chat_id   || ''
    };
    await kv.lpush('calls', JSON.stringify(call));
    return res.status(201).json({ ok: true, id: call.id });
  }

  // ── DELETE — supprimer un appel par id ───────────────────────────
  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id);
    const raw = await kv.lrange('calls', 0, 199);
    const kept = raw.filter(function(s) {
      const c = typeof s === 'string' ? JSON.parse(s) : s;
      return c.id !== id;
    });
    await kv.del('calls');
    for (const s of kept) {
      await kv.rpush('calls', typeof s === 'string' ? s : JSON.stringify(s));
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
