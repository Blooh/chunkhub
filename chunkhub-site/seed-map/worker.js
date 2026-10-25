// Seed Map worker: runs the cubiomes WebAssembly build off the main thread.
let E = null, mem = null;
const ready = (async () => {
  const wasi = { fd_close: () => 0, fd_fdstat_get: () => 0, fd_seek: () => 0, fd_write: () => 0, proc_exit: () => {} };
  const res = await fetch('cubiomes.wasm');
  const buf = await res.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buf, { wasi_snapshot_preview1: wasi });
  E = instance.exports; mem = E.memory; E._initialize();
})();

const cstr = p => { const b = new Uint8Array(mem.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; };
let cur = null; // current init params (string key)

function ensure(p) {
  const k = [p.mc, p.dim, p.hi, p.lo, p.large].join(',');
  if (k !== cur) { E.sm_init(p.mc, p.dim, p.hi >>> 0, p.lo >>> 0, p.large ? 1 : 0); cur = k; }
}

const ALL_TYPES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,18,19,20,23,24];

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
    } else if (m.type === 'structs') {
      const out = {};
      for (const st of m.types) {
        const n = st === 100 ? E.sm_camps(m.bx0, m.bz0, m.bx1, m.bz1) : E.sm_structs(st, m.bx0, m.bz0, m.bx1, m.bz1, 200000);
        out[st] = n > 0 ? Array.from(new Int32Array(mem.buffer, E.sm_out(), 2 * n)) : [];
        if (st === 20) out.ships = out[st].filter((_, i) => i % 2 === 0).map((x, i) => E.sm_endship(x, out[st][2 * i + 1]));
      }
      postMessage({ job: m.job, type: 'structs', out });
    } else if (m.type === 'slime') {
      E.sm_slime(m.cx, m.cz, m.w, m.h, m.bedrock ? 1 : 0);
      const bits = new Uint8Array(m.w * m.h);
      bits.set(new Uint8Array(mem.buffer, E.sm_slimebuf(), m.w * m.h));
      postMessage({ job: m.job, type: 'slime', bits }, [bits.buffer]);
    } else if (m.type === 'meta') {
      // names, colors, supported structures, strongholds and spawn for this world
      const col = new Uint8Array(mem.buffer, E.sm_colors(), 256 * 3).slice();
      const names = [];
      for (let i = 0; i < 256; i++) names.push(cstr(E.sm_biome_name(m.p.mc, i)));
      const supported = ALL_TYPES.filter(st => E.sm_structs(st, 0, 0, 0, 0, 10) >= 0);
      let spawn = null;
      if (m.p.dim === 0 && m.p.mc >= 3 && !m.bedrock) {
        E.sm_spawn();
        spawn = Array.from(new Int32Array(mem.buffer, E.sm_out(), 2));
      }
      postMessage({ job: m.job, type: 'meta', col, names, supported, spawn });
    } else if (m.type === 'strongholds') {
      const n = E.sm_strongholds(m.p.mc >= 12 ? 128 : 3);
      postMessage({ job: m.job, type: 'strongholds', list: Array.from(new Int32Array(mem.buffer, E.sm_out(), 2 * n)) });
    }
  } catch (err) {
    postMessage({ job: m.job, type: 'error', message: String(err) });
  }
};
