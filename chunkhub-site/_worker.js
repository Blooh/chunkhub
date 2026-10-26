// Password gate for the whole site while it's being tested (Cloudflare Pages "advanced mode").
// Everything is locked until the visitor enters the password. The password is NOT in this file:
// set it in Cloudflare under the project's Settings -> Variables and Secrets as SITE_PASSWORD (type: Secret),
// then redeploy. To open the site to everyone on launch day, add a variable PUBLIC = true and redeploy
// (or delete this file and redeploy).

const COOKIE = 'ch_pass';
const MAX_AGE = 60 * 60 * 24 * 30; // stay signed in for 30 days

async function token(password) {
  const data = new TextEncoder().encode('chunkhub-gate:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function sameText(a, b) { // compares without leaking where they differ
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function readCookie(req, name) {
  const all = req.headers.get('Cookie') || '';
  for (const part of all.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return v.join('='); }
  return '';
}
function noIndex(res) { // keep search engines out while the site is private
  const r = new Response(res.body, res);
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}

function page(message, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Chunk Hub · Private preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; font-family: Calibri, Carlito, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e4e4e7; background: linear-gradient(#0b1430, #1d2c4f 60%, #3a2f2a 60.2%, #2a2421); }
  .card { width: 100%; max-width: 380px; background: rgba(16,16,18,.88); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px; color: #fff; margin-bottom: 18px; }
  h1 { margin: 0 0 6px; font-size: 22px; color: #fff; }
  p { margin: 0 0 18px; color: #a1a1aa; line-height: 1.45; }
  label { display: block; font-size: 13px; color: #a1a1aa; margin-bottom: 6px; }
  input { width: 100%; font: inherit; font-size: 16px; color: #fff; background: #1b1b1f; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; padding: 11px 12px; }
  input:focus { outline: 2px solid #ff3b30; outline-offset: 1px; }
  button { width: 100%; margin-top: 14px; font: inherit; font-weight: 700; font-size: 16px; color: #fff; background: #d32f2f; border: 0; border-radius: 10px; padding: 11px; cursor: pointer; }
  button:hover { background: #e53935; }
  .err { color: #ff8a80; font-size: 14px; margin: 10px 0 0; min-height: 1em; }
</style></head>
<body><form class="card" method="post" action="/__login">
  <div class="brand"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 20.5 7.2 12 12 3.5 7.2z" fill="#ff3b30"/><path d="M3.5 7.2 12 12v9.5l-8.5-4.8z" fill="#f4f4f5"/><path d="M20.5 7.2 12 12v9.5l8.5-4.8z" fill="#a1a1aa"/></svg>Chunk Hub</div>
  <h1>Private preview</h1>
  <p>This site isn't open yet. Enter the password to continue.</p>
  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
  <button type="submit">Enter</button>
  <p class="err" role="alert">${message}</p>
</form></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
}


// ---------------------------------------------------------------- Player Search API
// The browser can't call Mojang's servers directly (they block other websites), so the site asks this worker,
// which looks the player up, caches the answer briefly, and (if Supabase is set up) records what it saw so the
// site can show name and skin history over time.
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const dash = u => u.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
async function cached(key, ttl, make) {
  const cache = caches.default, req = new Request('https://cache.chunkhub.internal/' + key);
  const hit = await cache.match(req); if (hit) return hit.json();
  const val = await make();
  if (val) await cache.put(req, new Response(JSON.stringify(val), { headers: { 'Cache-Control': 'max-age=' + ttl } }));
  return val;
}
async function supa(env, fn, args) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_KEY, ...(env.SUPABASE_SERVICE_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  return r.ok ? r.json() : null;
}
function fromTextures(uuid, name, b64) {
  let skin = null, cape = null, slim = false;
  if (b64) {
    const t = JSON.parse(atob(b64)).textures || {};
    if (t.SKIN && t.SKIN.url) { skin = t.SKIN.url.replace(/^http:/, 'https:'); slim = !!(t.SKIN.metadata && t.SKIN.metadata.model === 'slim'); }
    if (t.CAPE && t.CAPE.url) cape = t.CAPE.url.replace(/^http:/, 'https:');
  }
  return { uuid: uuid.replace(/-/g, ''), name, skin, slim, cape };
}
const UA = { 'User-Agent': 'ChunkHub/1.0 (+https://chunkhub.net)', Accept: 'application/json' };
// 1) Mojang directly. Mojang often refuses requests coming from Cloudflare, so 2) and 3) are public mirrors of the same data.
async function viaMojang(q, isUuid) {
  let uuid = isUuid ? q : null;
  if (!uuid) {
    const r = await fetch('https://api.minecraftservices.com/minecraft/profile/lookup/name/' + encodeURIComponent(q), { headers: UA });
    if (r.status === 404 || r.status === 204) return { missing: true };
    if (!r.ok) throw new Error('mojang name ' + r.status);
    uuid = (await r.json()).id; if (!uuid) return { missing: true };
  }
  const r = await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid + '?unsigned=true', { headers: UA });
  if (r.status === 204 || r.status === 404) return { missing: true };
  if (!r.ok) throw new Error('mojang profile ' + r.status);
  const p = await r.json(); const tex = (p.properties || []).find(x => x.name === 'textures');
  return fromTextures(p.id, p.name, tex && tex.value);
}
async function viaPlayerDB(q) {
  const r = await fetch('https://playerdb.co/api/player/minecraft/' + encodeURIComponent(q), { headers: UA });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('playerdb ' + r.status);
  if (!j.success) { if (/invalid|not.?found|unknown/i.test(String(j.code || '') + String(j.message || ''))) return { missing: true }; throw new Error('playerdb ' + j.code); }
  const p = j.data.player; const tex = (p.properties || []).find(x => x.name === 'textures');
  return fromTextures(p.raw_id || p.id, p.username, tex && tex.value);
}
async function viaAshcon(q) {
  const r = await fetch('https://api.ashcon.app/mojang/v2/user/' + encodeURIComponent(q), { headers: UA });
  if (r.status === 404 || r.status === 204) return { missing: true };
  if (!r.ok) throw new Error('ashcon ' + r.status);
  const j = await r.json(); const t = j.textures || {};
  return { uuid: j.uuid.replace(/-/g, ''), name: j.username, skin: t.skin && t.skin.url ? t.skin.url.replace(/^http:/, 'https:') : null, slim: !!t.slim, cape: t.cape && t.cape.url ? t.cape.url.replace(/^http:/, 'https:') : null };
}
async function resolvePlayer(q, isUuid) {
  const errors = [];
  for (const f of [() => viaMojang(q, isUuid), () => viaPlayerDB(q), () => viaAshcon(q)]) {
    try { return await f(); } catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join('; '));
}
async function handleApi(url, env) {
  const path = url.pathname.slice('/api/mc/'.length);
  try {
    if (path === 'lookup') {
      const q = (url.searchParams.get('q') || '').trim();
      const id = q.replace(/-/g, '').toLowerCase(), isUuid = /^[0-9a-f]{32}$/.test(id);
      if (!isUuid && !/^[A-Za-z0-9_]{1,16}$/.test(q)) return json({ found: false, query: q, valid: false, invalid: true });
      const prof = await cached('p/' + (isUuid ? id : q.toLowerCase()), 120, () => resolvePlayer(isUuid ? id : q, isUuid));
      if (!prof || prof.missing) return json({ found: false, query: q, valid: isUuid || q.length >= 3 });
      const hash = prof.skin ? prof.skin.split('/').pop() : null, capeHash = prof.cape ? prof.cape.split('/').pop() : null;
      const history = await supa(env, 'mc_record', { p_uuid: prof.uuid, p_name: prof.name, p_skin: hash, p_slim: prof.slim, p_cape: capeHash }).catch(() => null);
      return json({ found: true, uuid: dash(prof.uuid), uuidPlain: prof.uuid, name: prof.name, skin: hash, slim: prof.slim, cape: capeHash, history });
    }
    if (path === 'texture') {
      const h = url.searchParams.get('h') || '';
      if (!/^[0-9a-f]{20,80}$/.test(h)) return json({ error: 'bad texture' }, 400);
      const r = await fetch('https://textures.minecraft.net/texture/' + h, { cf: { cacheTtl: 31536000, cacheEverything: true } });
      if (!r.ok) return json({ error: 'not found' }, 404);
      return new Response(r.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
    }
    if (path === 'trending') {
      const list = await cached('trending', 300, async () => ({ list: (await supa(env, 'mc_trending', {}).catch(() => null)) || [] }));
      return json(list, 200, { 'Cache-Control': 'public, max-age=120' });
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    // status 200 on purpose: Cloudflare swaps 502 responses for its own error page
    return json({ error: 'The Minecraft servers didn’t answer. Please try again in a moment.', detail: String(e && e.message || e) });
  }
}

// ---------------------------------------------------------------- World Stats: the Chunk Hub mod talks to these
// The mod can't sign in to the password gate, so these stay reachable; each request is checked by its code or token instead.
async function sha256hex(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const MAX_BODY = 4 * 1024 * 1024;
async function readJson(request) {
  const len = +(request.headers.get('content-length') || 0); if (len > MAX_BODY) throw new Error('too big');
  const text = await request.text(); if (text.length > MAX_BODY) throw new Error('too big');
  return JSON.parse(text);
}
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
async function handleMod(request, url, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'The website isn’t finished setting up yet (Supabase keys missing).' });
  let body; try { body = await readJson(request); } catch { return json({ ok: false, error: 'Bad or oversized request.' }, 400); }
  const path = url.pathname.slice('/api/mod/'.length);
  if (path === 'link') {
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) return json({ ok: false, error: 'That code doesn’t look right. It should look like ABCD-1234.' });
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
    const r = await supa(env, 'mod_link', { p_code: code.slice(0, 4) + '-' + code.slice(4), p_token_hash: await sha256hex(token), p_world: clip(body.world, 120) || 'World', p_uuid: clip(body.uuid, 40) || '', p_name: clip(body.name, 32) || '', p_mc: clip(body.mc, 40), p_mod: clip(body.mod, 40) });
    if (!r) return json({ ok: false, error: 'The website couldn’t save the link. Please try again.' });
    if (!r.ok) return json({ ok: false, error: 'That code has expired or was already used. Get a new one on the World Stats page.' });
    return json({ ok: true, token, world_id: r.world_id });
  }
  const token = String(body.token || ''); if (!/^[0-9a-f]{64}$/.test(token)) return json({ ok: false, error: 'unlinked' });
  const hash = await sha256hex(token);
  if (path === 'sync') {
    const r = await supa(env, 'mod_sync', { p_token_hash: hash, p_stats: body.stats || null, p_adv: body.advancements || null, p_extra: body.extra || null, p_name: clip(body.name, 32), p_mc: clip(body.mc, 40), p_mod: clip(body.mod, 40) });
    if (!r) return json({ ok: false, error: 'The website couldn’t save this sync. It will try again later.' });
    return json(r);
  }
  if (path === 'ping') { const r = await supa(env, 'mod_ping', { p_token_hash: hash }); return json(r || { ok: false }); }
  if (path === 'unlink') { const r = await supa(env, 'mod_unlink', { p_token_hash: hash }); return json(r || { ok: false }); }
  return json({ ok: false, error: 'not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith('/api/mc/');
    if (url.pathname.startsWith('/api/mod/')) return handleMod(request, url, env).catch(() => json({ ok: false, error: 'Something went wrong on the website.' }));
    if (String(env.PUBLIC).toLowerCase() === 'true') return isApi ? handleApi(url, env) : env.ASSETS.fetch(request); // launched: no password
    const password = env.SITE_PASSWORD;
    if (!password) return page('The site password hasn’t been set up yet (SITE_PASSWORD).', 503);
    const good = await token(password);

    if (url.pathname === '/__logout') {
      return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (url.pathname === '/__login' && request.method === 'POST') {
      const form = await request.formData().catch(() => null);
      const tried = form ? String(form.get('password') || '') : '';
      if (sameText(await token(tried), good)) {
        return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=${good}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
      }
      await new Promise(r => setTimeout(r, 700)); // slow down guessing
      return page('That password isn’t right. Try again.', 401);
    }
    if (sameText(readCookie(request, COOKIE), good)) return isApi ? handleApi(url, env) : noIndex(await env.ASSETS.fetch(request));
    if (isApi) return json({ error: 'locked' }, 401);
    return page('', 401);
  },
};
