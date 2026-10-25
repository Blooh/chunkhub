// Ore Finder worker: biome tiles and ore vein predictions from the WebAssembly engine.
let E = null, mem = null;
const ready = (async () => {
  const wasi = { fd_close: () => 0, fd_fdstat_get: () => 0, fd_seek: () => 0, fd_write: () => 0, proc_exit: () => {} };
  const buf = await (await fetch('ore.wasm')).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buf, { wasi_snapshot_preview1: wasi });
  E = instance.exports; mem = E.memory; E._initialize();
})();

const cstr = p => { const b = new Uint8Array(mem.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; };
let cur = null;
function ensure(p) {
  const k = [p.mc, p.era, p.dim, p.hi, p.lo].join(',');
  if (k === cur) return;
  E.sm_init(p.mc, p.dim, p.hi >>> 0, p.lo >>> 0, 0);
  E.or_init(p.mc, p.era, p.dim, p.hi >>> 0, p.lo >>> 0);
  cur = k;
}

onmessage = async (ev) => {
  await ready;
  const m = ev.data;
  try {
    ensure(m.p);
    if (m.type === 'tile') {
      const n = 128;
      const rc = E.sm_gen(m.x, m.z, n, n, m.s, m.y);
      const ids = new Int32Array(n * n);
      if (rc === 0) ids.set(new Int32Array(mem.buffer, E.sm_biomes(), n * n)); else ids.fill(-1);
      postMessage({ job: m.job, type: 'tile', ids }, [ids.buffer]);
    } else if (m.type === 'ores') {
      // a block of chunks: returns Int32Array of veins (10 ints each)
      const parts = []; let total = 0;
      for (let cz = m.cz; cz < m.cz + m.n; cz++) for (let cx = m.cx; cx < m.cx + m.n; cx++) {
        const k = E.or_chunk(cx, cz, m.mask);
        if (k > 0) { parts.push(new Int32Array(mem.buffer, E.or_out(), k * 10).slice()); total += k; }
      }
      const veins = new Int32Array(total * 10); let o = 0;
      for (const p of parts) { veins.set(p, o); o += p.length; }
      postMessage({ job: m.job, type: 'ores', veins }, [veins.buffer]);
    } else if (m.type === 'meta') {
      const col = new Uint8Array(mem.buffer, E.sm_colors(), 256 * 3).slice();
      const names = [];
      for (let i = 0; i < 256; i++) names.push(cstr(E.sm_biome_name(m.p.mc, i)));
      const nd = E.or_init(m.p.mc, m.p.era, m.p.dim, m.p.hi >>> 0, m.p.lo >>> 0);
      const defs = [];
      for (let i = 0; i < nd; i++) defs.push({ name: cstr(E.or_def_name(i)), group: E.or_def_group(i), dim: E.or_def_dim(i) });
      postMessage({ job: m.job, type: 'meta', col, names, defs });
    }
  } catch (err) {
    postMessage({ job: m.job, type: 'error', message: String(err) });
  }
};
