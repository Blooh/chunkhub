// Chunk Hub seed engine worker (cubiomes, MIT licence): spawn, nearest structures, slime chunks, seed search.
let E = null, mem = null;
const ready = (async () => {
  const wasi = { fd_close: () => 0, fd_fdstat_get: () => 0, fd_seek: () => 0, fd_write: () => 0, proc_exit: () => {} };
  const buf = await (await fetch('cubiomes.wasm')).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buf, { wasi_snapshot_preview1: wasi });
  E = instance.exports; mem = E.memory; E._initialize();
})();
const cstr = p => { const b = new Uint8Array(mem.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; };
const i32 = (p, n) => new Int32Array(mem.buffer, p, n);
let cur = '';
function init(mc, dim, hi, lo) { const k = [mc, dim, hi, lo].join(','); if (k !== cur) { E.sm_init(mc, dim, hi >>> 0, lo >>> 0, 0); cur = k; } }
function biomeAt(mc, x, z, y = 320) { if (E.sm_gen(x >> 2, z >> 2, 1, 1, 4, mc >= 22 ? y : 64) !== 0) return -1; return i32(E.sm_biomes(), 1)[0]; }
// nearest viable structure of a type to (x, z) within r blocks, searched in growing rings so close hits return fast
function nearest(st, x, z, r) {
  let best = null;
  for (let step = Math.min(r, 1024); ; step = Math.min(r, step * 2)) {
    const n = E.sm_structs(st, x - step, z - step, x + step, z + step, 400000);
    if (n < 0) return null;
    const o = i32(E.sm_out(), 2 * n);
    for (let i = 0; i < n; i++) { const d = Math.hypot(o[2 * i] - x, o[2 * i + 1] - z); if (d <= step && (!best || d < best.d)) best = { x: o[2 * i], z: o[2 * i + 1], d }; }
    if (best || step >= r) return best;
  }
}
const OVER = [5, 11, 1, 2, 3, 4, 6, 7, 8, 9, 10, 13, 14, 23, 24];
const NETHER = [18, 19];

onmessage = async ev => {
  await ready;
  const m = ev.data;
  try {
    if (m.type === 'analyse') {
      init(m.mc, 0, m.hi, m.lo);
      E.sm_spawn(); const sp = [...i32(E.sm_out(), 2)];
      const names = []; for (let i = 0; i < 256; i++) names.push(cstr(E.sm_biome_name(m.mc, i)));
      const spawnBiome = names[biomeAt(m.mc, sp[0], sp[1])] || '';
      const structs = {};
      for (const st of OVER) structs[st] = nearest(st, sp[0], sp[1], m.radius || 4000);
      const sh = E.sm_strongholds(3), so = i32(E.sm_out(), 2 * sh);
      let stronghold = null;
      for (let i = 0; i < sh; i++) { const d = Math.hypot(so[2 * i] - sp[0], so[2 * i + 1] - sp[1]); if (!stronghold || d < stronghold.d) stronghold = { x: so[2 * i], z: so[2 * i + 1], d }; }
      init(m.mc, -1, m.hi, m.lo);
      const nx = Math.floor(sp[0] / 8), nz = Math.floor(sp[1] / 8);
      for (const st of NETHER) structs[st] = nearest(st, nx, nz, 1500);
      postMessage({ job: m.job, spawn: sp, spawnBiome, structs, stronghold });
    } else if (m.type === 'slime') {
      init(m.mc || 28, 0, m.hi, m.lo);
      E.sm_slime(m.cx, m.cz, m.w, m.h, m.bedrock ? 1 : 0);
      postMessage({ job: m.job, bits: new Uint8Array(mem.buffer, E.sm_slimebuf(), m.w * m.h).slice() });
    } else if (m.type === 'search') {
      // try seeds start, start+step, ... and report the ones that meet every condition
      const found = []; let s = BigInt.asIntN(64, BigInt(m.start)); const step = BigInt(m.step);
      for (let k = 0; k < m.count; k++, s = BigInt.asIntN(64, s + step)) {
        const u = BigInt.asUintN(64, s), hi = Number(u >> 32n), lo = Number(u & 0xffffffffn);
        init(m.mc, 0, hi, lo);
        let ox = 0, oz = 0, ok = true, hits = [];
        if (m.fromSpawn || m.spawnBiomes.length) { E.sm_spawn(); const sp = i32(E.sm_out(), 2); ox = sp[0]; oz = sp[1]; }
        if (m.spawnBiomes.length) { const b = cstr(E.sm_biome_name(m.mc, biomeAt(m.mc, ox, oz))); if (!m.spawnBiomes.includes(b)) ok = false; }
        if (!m.fromSpawn) { ox = 0; oz = 0; }
        for (const c of m.conds) {
          if (!ok) break;
          if (c.dim === -1) init(m.mc, -1, hi, lo); else init(m.mc, 0, hi, lo);
          const px = c.dim === -1 ? Math.floor(ox / 8) : ox, pz = c.dim === -1 ? Math.floor(oz / 8) : oz;
          const h = nearest(c.st, px, pz, c.dist);
          if (!h) ok = false; else hits.push({ st: c.st, x: h.x, z: h.z, d: Math.round(h.d) });
        }
        if (ok) found.push({ seed: s.toString(), origin: [ox, oz], hits });
      }
      postMessage({ job: m.job, found, next: s.toString(), done: m.count });
    }
  } catch (err) { postMessage({ job: m.job, error: String(err) }); }
};
