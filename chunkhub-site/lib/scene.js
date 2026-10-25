// Home page background: a blocky sky with drifting clouds and a day/night cycle, above a cut-away
// of the ground (grass, dirt, stone, deepslate, caves, water, lava, ores, bedrock). All drawn in code.
(function () {
  const B = 16, T = 8; // CSS pixels per block, texture pixels per block (shown at 2x, pixelated)
  const HALF_DAY = 10 * 60 * 1000; // day to night takes 10 minutes, night back to day another 10
  const scene = document.querySelector('.scene'), sky = document.getElementById('skyCv'), world = document.getElementById('worldCv'), pcv = document.getElementById('playerCv');
  const hero = document.querySelector('[data-scene-hero]') || document.querySelector('.hero'), main = document.querySelector('main') || document.body;
  // data-mode="fixed": the world stays put behind the page (tool pages); otherwise it scrolls with the home page
  const FIXED = scene && scene.dataset.mode === 'fixed', AMP = scene && scene.dataset.amp != null ? +scene.dataset.amp : 1, TREES = scene ? scene.dataset.trees || 'all' : 'all';
  if (!scene || !sky || !world || !hero || !main) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), darkQ = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : darkQ.matches; };

  // ---- deterministic noise, so the world looks the same on every visit and when resizing ----
  function h2(x, y, s) { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function vn(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, s, o = 3) { let t = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f, y * f, s + i * 17); n += a; a *= .5; f *= 2; } return t / n; }

  const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, DEEP = 4, BED = 5, CAVE = 6, CAVED = 7, WATER = 8, LAVA = 9, LOG = 10, LEAF = 11, TUFT = 12, POPPY = 13, DANDY = 14, GRANITE = 15, DIORITE = 16;
  // ore: [spot colour, highlight, depth from (0 = surface, 1 = bottom), depth to, noise scale, threshold]
  const ORES = [
    [[38, 38, 40], [70, 70, 72], .02, .5, .5, .85],      // coal
    [[214, 170, 140], [240, 210, 186], .08, .7, .55, .885], // iron
    [[214, 116, 74], [110, 184, 150], .05, .45, .55, .88], // copper
    [[250, 222, 60], [255, 248, 170], .5, 1, .6, .915],       // gold
    [[214, 24, 20], [255, 100, 90], .62, 1, .55, .91],      // redstone
    [[38, 78, 200], [96, 136, 236], .38, .85, .6, .915],      // lapis
    [[80, 222, 226], [200, 252, 255], .74, 1, .65, .925],    // diamond
  ];

  function generate(cols, rows, base) {
    const N = cols * rows, cell = new Uint8Array(N), ore = new Uint8Array(N), surf = new Int16Array(cols);
    const at = (x, y) => y * cols + x, inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
    // ground follows the sketch: a hill on the left, a dip in the middle, a taller hill on the right
    const g = (t, c, w) => Math.exp(-(((t - c) / w) ** 2)), amp = (.6 + .4 * Math.min(1, cols / 80)) * AMP;
    for (let x = 0; x < cols; x++) {
      const t = cols > 1 ? x / (cols - 1) : .5;
      const h = amp * (2.4 * g(t, .15, .17) + 3.2 * g(t, .84, .16) - 2.2 * g(t, .49, .15)) + (fbm(x * .1, 0, 7) - .5) * 2.2 * Math.min(1, AMP + .4);
      surf[x] = Math.max(2, base - Math.round(h));
    }
    // even out single-block spikes and pits so the hills read as smooth steps
    for (let x = 1; x < cols - 1; x++) { const l = surf[x - 1], r = surf[x + 1]; if (surf[x] < l && surf[x] < r) surf[x] = Math.min(l, r); if (surf[x] > l && surf[x] > r) surf[x] = Math.max(l, r); }
    const under = rows - base;
    for (let x = 0; x < cols; x++) {
      const dirt = 3 + (fbm(x * .2, 1, 3) > .5 ? 1 : 0), deepY = Math.round(base + under * .56 + (fbm(x * .08, 3, 9) - .5) * 5);
      for (let y = 0; y < rows; y++) {
        let m;
        if (y < surf[x]) m = AIR; else if (y === surf[x]) m = GRASS; else if (y <= surf[x] + dirt) m = DIRT;
        else { const band = y - deepY; m = band >= 2 ? DEEP : band <= -2 ? STONE : (h2(x, y, 4) < (band + 2) / 4 ? DEEP : STONE); }
                if (y === rows - 1 || (y === rows - 2 && h2(x, y, 5) > .35) || (y === rows - 3 && h2(x, y, 6) > .8)) m = BED;
        cell[at(x, y)] = m;
      }
    }
    // caves: a few winding tunnels and open pockets, smoothed so the edges look natural
    let cave = new Uint8Array(N);
    for (let x = 0; x < cols; x++) for (let y = surf[x] + 8; y < rows - 4; y++) {
      const worm = Math.abs(fbm(x * .06, y * .09, 21) - .5) < .03, room = fbm(x * .05, y * .07, 33) > .74;
      if (worm || room) cave[at(x, y)] = 1;
    }
    for (let pass = 0; pass < 3; pass++) {
      const nx = new Uint8Array(N);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inb(x + dx, y + dy) && cave[at(x + dx, y + dy)]) c++;
        const i = at(x, y), ok = y >= surf[x] + 8 && y < rows - 4;
        nx[i] = ok && (cave[i] ? c >= 3 : c >= 5) ? 1 : 0;
      }
      cave = nx;
    }
    // drop tiny pockets; fill some caves with water (higher up) or lava (deeper down)
    const seen = new Uint8Array(N), stack = [];
    for (let i = 0; i < N; i++) {
      if (seen[i] || !cave[i]) continue;
      const comp = []; stack.push(i); seen[i] = 1;
      while (stack.length) { const j = stack.pop(); comp.push(j); const x = j % cols, y = (j / cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const k = at(nx, ny); if (!seen[k] && cave[k]) { seen[k] = 1; stack.push(k); } } }
      if (comp.length < 16) continue;
      let maxY = 0, deepish = 0; for (const j of comp) { maxY = Math.max(maxY, (j / cols) | 0); if (cell[j] === DEEP) deepish++; }
      const isDeep = deepish > comp.length / 2;
      for (const j of comp) cell[j] = isDeep ? CAVED : CAVE;
      const fx = comp[0] % cols, fy = (comp[0] / cols) | 0;
      if (h2(fx, fy, 55) > .45) continue;
      const level = maxY - 1 - Math.floor(h2(fx, fy, 56) * 2), fluid = isDeep ? LAVA : WATER;
      for (const j of comp) { const y = (j / cols) | 0, x = j % cols; if (y >= level) cell[j] = fluid; }
      // fluid only sits where there is a floor or more fluid beneath it
      for (let pass = 0; pass < 3; pass++) for (const j of comp) { if (cell[j] !== fluid) continue; const x = j % cols, y = (j / cols) | 0, below = cell[at(x, Math.min(rows - 1, y + 1))]; if (below === CAVE || below === CAVED) cell[j] = isDeep ? CAVED : CAVE; }
    }
    // ores, as small veins in stone and deepslate
    for (let x = 0; x < cols; x++) for (let y = surf[x] + 3; y < rows; y++) {
      const i = at(x, y); if (cell[i] !== STONE && cell[i] !== DEEP) continue;
      const d = (y - surf[x]) / Math.max(1, rows - surf[x]);
      for (let k = 0; k < ORES.length; k++) { const o = ORES[k]; if (d < o[2] || d > o[3]) continue; if (vn(x * o[4], y * o[4], 100 + k) > o[5]) { ore[i] = k + 1; break; } }
    }
    // oak trees on the hills: a short trunk under a rounded canopy
    const spots = []; if (TREES === 'all' && cols >= 24) spots.push(.16); if (TREES !== 'none' && cols >= 24) spots.push(.8); if (TREES !== 'none' && cols >= 70) spots.push(.9);
    for (const s of spots) {
      let tx = Math.round(cols * s); if (tx < 3 || tx > cols - 4) continue;
      for (const dx of [0, 1, -1, 2, -2]) { const x = tx + dx; if (x > 2 && x < cols - 3 && surf[x - 1] === surf[x] && surf[x + 1] === surf[x]) { tx = x; break; } }
      const ground = surf[tx], trunk = 6 + (h2(tx, 1, 8) > .5 ? 1 : 0), top = ground - trunk; // top = highest trunk block
      for (let y = top; y < ground; y++) if (y >= 0) cell[at(tx, y)] = LOG;
      const layers = [[-1, 1], [0, 1], [1, 2], [2, 2]], trimL = h2(tx, 2, 9) < .5; // [row offset from trunk top, half width]
      for (const [dy, w] of layers) for (let dx = -w; dx <= w; dx++) {
        const x = tx + dx, y = top + dy; if (!inb(x, y)) continue;
        if (dy === 2 && dx === (trimL ? -2 : 2)) continue; // trim one lower corner so the canopy isn't a perfect box
        if (dy === -1 && dx === (trimL ? 1 : -1)) continue;
        if (cell[at(x, y)] === AIR || cell[at(x, y)] === LOG) cell[at(x, y)] = LEAF;
      }
    }
    for (let x = 0; x < cols; x++) { const y = surf[x] - 1; if (y < 0 || cell[at(x, y)] !== AIR) continue; const r = h2(x, y, 12); if (r < .14) cell[at(x, y)] = TUFT; else if (r < .17) cell[at(x, y)] = POPPY; else if (r < .2) cell[at(x, y)] = DANDY; }
    return { cols, rows, cell, ore };
  }

  // gentle, low-contrast textures: a base colour with soft clumps of lighter and darker pixels
  const tone = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  function speck(c, X, Y, s, amt) { const v = (h2(X >> 1, Y >> 1, s) - .5) * amt + (h2(X, Y, s + 1) - .5) * amt * .5; return tone(c, 1 + v); }
  const C = { stone: [126, 126, 128], deep: [76, 76, 82], dirt: [134, 96, 66], grass: [96, 160, 58], granite: [152, 108, 90], diorite: [142, 144, 142], bed: [70, 70, 70],
    water: [48, 96, 210], lava: [226, 110, 24], log: [106, 82, 50], leaf: [62, 126, 44] };
  function paint(gr) {
    const { cols, rows, cell, ore } = gr, W = cols * T, H = rows * T, img = new ImageData(W, H), d = img.data;
    const put = (x, y, c) => { const o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
    const get = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? STONE : cell[y * cols + x];
    const open = m => m === CAVE || m === CAVED || m === AIR;
    for (let by = 0; by < rows; by++) for (let bx = 0; bx < cols; bx++) {
      const m = cell[by * cols + bx]; if (m === AIR) continue;
      const above = get(bx, by - 1), left = get(bx - 1, by), right = get(bx + 1, by);
      for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
        const X = bx * T + px, Y = by * T + py;
        let c;
        switch (m) {
          case GRASS: c = py < 2 || (py === 2 && h2(X, 0, 2) < .4) ? speck(C.grass, X, Y, 2, .16) : speck(C.dirt, X, Y, 3, .18); break;
          case DIRT: c = speck(C.dirt, X, Y, 3, .18); break;
          case STONE: c = speck(C.stone, X, Y, 4, .12); break;
          case GRANITE: c = speck(C.granite, X, Y, 5, .14); break;
          case DIORITE: c = speck(C.diorite, X, Y, 6, .1); break;
          case DEEP: c = tone(speck(C.deep, X, Y, 7, .12), py % 4 === 0 ? .92 : 1); break;
          case BED: c = speck(C.bed, X, Y, 8, .7); break;
          case CAVE: case CAVED: { // dark back wall, darker near the ceiling for a little depth
            const base = m === CAVE ? tone(C.stone, .44) : tone(C.deep, .58); let f = 1;
            if (!open(above) && above !== WATER && above !== LAVA) f -= (T - py) / T * .25;
            c = speck(tone(base, f), X, Y, 9, .1); break; }
          case WATER: c = above !== WATER && py < 1 ? [110, 160, 245] : speck(C.water, X >> 1, Y, 10, .12); break;
          case LAVA: c = above !== LAVA && py < 1 ? [255, 210, 90] : speck(C.lava, X, Y >> 1, 11, .3); break;
          case LOG: c = tone(C.log, (px === 2 || px === 5) ? .82 : 1 + (h2(px, Y >> 1, 12) - .5) * .12); if (px === 0 || px === T - 1) c = tone(C.log, .72); break;
          case LEAF: { let f = 1 + (h2(X >> 1, Y >> 1, 13) - .5) * .3; if (get(bx, by + 1) !== LEAF && py >= T - 2) f *= .82; if (above !== LEAF && py < 2) f *= 1.1; c = tone(C.leaf, f); break; }
          case TUFT: { const on = py >= 4 && ((px === 1 && py >= 5) || (px === 3 && py >= 3) || (px === 5 && py >= 4) || (px === 6 && py >= 6)); if (!on) continue; c = tone(C.grass, .9 + (px % 3) * .08); break; }
          case POPPY: case DANDY: { const stem = px === 4 && py >= 4, head = px >= 3 && px <= 5 && py >= 2 && py <= 3; if (!stem && !head) continue; c = stem ? [70, 136, 40] : m === POPPY ? [214, 38, 36] : [246, 214, 50]; break; }
        }
        // a thin dark line where solid ground meets an open cave, so cave edges read cleanly
        if ((m === STONE || m === DEEP || m === GRANITE || m === DIORITE || m === DIRT) && ((py === 0 && open(above) && above !== AIR) || (px === 0 && open(left) && left !== AIR) || (px === T - 1 && open(right) && right !== AIR))) c = tone(c, .7);
        put(X, Y, c);
      }
      const o = ore[by * cols + bx];
      if (o) { // four small clumps with a highlight pixel
        const [col, hi] = ORES[o - 1];
        for (let k = 0; k < 4; k++) { const cx = 1 + Math.floor(h2(bx, by, 40 + k) * (T - 3)), cy = 1 + Math.floor(h2(bx, by, 50 + k) * (T - 3)), X = bx * T + cx, Y = by * T + cy;
          put(X, Y, col); put(X + 1, Y, col); put(X, Y + 1, tone(col, .85)); put(X + 1, Y + 1, k % 2 ? hi : col); }
      }
    }
    world.width = W; world.height = H; world.getContext('2d').putImageData(img, 0, 0);
  }

  // ---- sky: gradient, sun and moon on an arc, stars, clouds ----
  let W = 0, skyH = 0, dpr = 1, clouds = [], stars = [], last = 0, running = false, visible = true, lastShade = -1;
  // starts at midday on the first page, then carries on as you move between pages (same browser tab)
  let start = Date.now(); try { const v = +sessionStorage.getItem('ch.sky0'); if (v && Date.now() - v < 6 * 3600e3) start = v; else sessionStorage.setItem('ch.sky0', String(start)); } catch {}
  const t0 = performance.now() - (Date.now() - start);
  const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f), rgb = c => `rgb(${c.map(Math.round).join(',')})`;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function makeCloud(layer, x) {
    const c = [8, 11, 15][layer], gw = 6 + Math.floor(Math.random() * 9), gh = 2 + Math.floor(Math.random() * 3), cells = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const edge = j === 0 ? Math.random() < .35 || i === 0 || i === gw - 1 : (i === 0 || i === gw - 1) && Math.random() < .5;
      if (!edge) cells.push([i, j]);
    }
    const y = 18 + Math.random() * Math.max(40, skyH * .5 - 40) * (layer === 0 ? .7 : 1);
    return { layer, c, gw, gh, cells, x: x ?? Math.random() * W, y, v: [7, 13, 22][layer] * (.85 + Math.random() * .3) };
  }
  function layoutSky() {
    dpr = Math.min(2, devicePixelRatio || 1);
    sky.width = Math.round(W * dpr); sky.height = Math.round(skyH * dpr);
    const n = Math.max(4, Math.round(W / 210));
    clouds = Array.from({ length: n }, (_, i) => makeCloud(i % 3)).sort((a, b) => a.layer - b.layer);
    stars = Array.from({ length: Math.round(W * skyH / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * skyH * .7, s: Math.random() < .2 ? 3 : 2, p: Math.random() * 6.28 }));
  }
  function phase(now) { // 0 = midday ... 0.5 = midnight ... 1 = midday again
    if (reduce.matches) return 0;
    return ((now - t0) / (2 * HALF_DAY)) % 1;
  }
  function drawSky(now) {
    const g = sky.getContext('2d'), p = phase(now), ang = p * Math.PI * 2;
    // darkness eases in over the first 10 minutes and out over the next 10; the sunset glow follows the sun
    const elev = Math.cos(ang), night = (1 - Math.cos(p * Math.PI * 2)) / 2, dusk = Math.max(0, 1 - Math.abs(elev) / .5) ** 1.5;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky gradient: blue day, warm sunset or sunrise, deep blue night
    const top = mix(mix([111, 189, 227], [7, 13, 31], night), [70, 80, 140], dusk * .25);
    const mid = mix(mix([166, 220, 239], [21, 35, 74], night), [214, 140, 150], dusk * .45);
    const bot = mix(mix([196, 233, 244], [35, 51, 92], night), [246, 168, 92], dusk * .75);
    const gr = g.createLinearGradient(0, 0, 0, skyH); gr.addColorStop(0, rgb(top)); gr.addColorStop(.6, rgb(mid)); gr.addColorStop(.9, rgb(bot));
    g.fillStyle = gr; g.fillRect(0, 0, W, skyH);
    if (night > .02) for (const s of stars) { g.globalAlpha = night * (.5 + .4 * Math.sin(now / 900 + s.p)); g.fillStyle = '#e8eeff'; g.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s); }
    g.globalAlpha = 1;
    // sun and moon ride opposite sides of a wide arc; they set behind the hills
    const S = Math.max(40, Math.min(64, W * .05)), cx = W * .6, cy = skyH, rx = W * .42, ry = skyH - 96;
    const body = (a, draw) => { const x = cx + rx * Math.sin(a) - S / 2, y = cy - ry * Math.cos(a) - S / 2; if (y < skyH) draw(Math.round(x), Math.round(y)); };
    body(ang, (x, y) => { g.fillStyle = `rgba(255,${Math.round(240 - dusk * 60)},${Math.round(200 - dusk * 110)},.3)`; g.fillRect(x - S * .25, y - S * .25, S * 1.5, S * 1.5);
      g.fillStyle = rgb(mix([255, 246, 184], [255, 196, 110], dusk)); g.fillRect(x, y, S, S); g.fillStyle = rgb(mix([255, 230, 107], [255, 150, 70], dusk)); g.fillRect(x + S * .15, y + S * .15, S * .7, S * .7); });
    body(ang + Math.PI, (x, y) => { g.fillStyle = 'rgba(220,228,255,.08)'; g.fillRect(x - S * .25, y - S * .25, S * 1.5, S * 1.5); g.fillStyle = '#dfe5f2'; g.fillRect(x, y, S, S);
      g.fillStyle = '#b9c2d6'; const q = S / 8; [[1, 1, 2], [5, 2, 1], [3, 5, 2], [6, 6, 1]].forEach(([i, j, s]) => g.fillRect(x + i * q, y + j * q, s * q, s * q)); });
    // clouds pick up the light: white by day, peach at sunset, grey-blue at night
    const cTop = mix(mix([255, 255, 255], [120, 132, 168], night), [255, 200, 170], dusk * .6), cBot = mix(mix([227, 237, 243], [92, 104, 140], night), [236, 160, 140], dusk * .6);
    for (const cl of clouds) {
      const c = cl.c; g.globalAlpha = [.55, .75, .92][cl.layer] * (1 - night * .55);
      g.fillStyle = rgb(cTop); for (const [i, j] of cl.cells) if (j < cl.gh - 1) g.fillRect(Math.round(cl.x + i * c), Math.round(cl.y + j * c), c, c);
      g.fillStyle = rgb(cBot); for (const [i, j] of cl.cells) if (j === cl.gh - 1) g.fillRect(Math.round(cl.x + i * c), Math.round(cl.y + j * c), c, c);
    }
    g.globalAlpha = 1;
    // the ground and the headline follow the light
    const shade = Math.round((1 - night * .42) * 100) / 100;
    if (shade !== lastShade) { lastShade = shade; world.style.filter = shade < 1 ? `brightness(${shade}) saturate(${Math.round((1 - night * .12) * 100) / 100})` : ''; if (pcv) pcv.style.filter = world.style.filter; }
    hero.classList.toggle('night', night > .42);
  }
  function tick(now) {
    if (!running) return;
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    if (!reduce.matches) for (let k = 0; k < clouds.length; k++) { const cl = clouds[k]; cl.x += cl.v * dt; if (cl.x > W + 10) clouds[k] = makeCloud(cl.layer, -cl.gw * cl.c - Math.random() * 120); }
    drawSky(now); stepPlayer(dt); drawPlayer(); requestAnimationFrame(tick);
  }
  function setRunning() {
    const want = visible && !document.hidden;
    if (want && !running) { running = true; last = 0; requestAnimationFrame(tick); }
    else if (!want) { running = false; drawSky(performance.now()); }
  }

  // ---- the explorer: a small original character you can run and jump with the arrow keys ----
  let grid = null;
  const P = { x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 34, face: 1, ground: false, step: 0, placed: false };
  const keys = { left: false, right: false, jump: false };
  const SOLID = new Set([GRASS, DIRT, STONE, DEEP, BED]);
  const solidAt = (px, py) => { if (!grid) return false; const bx = Math.floor(px / B), by = Math.floor(py / B);
    if (by < 0) return false; if (bx < 0 || bx >= grid.cols || by >= grid.rows) return true; return SOLID.has(grid.cell[by * grid.cols + bx]); };
  const hits = (x, y) => { // does a player box with feet at (x, y) overlap ground?
    const l = x - P.w / 2 + .5, r = x + P.w / 2 - .5, t = y - P.h + .5, b = y - .5;
    for (let yy = t; yy <= b + B; yy += B) { const cy = Math.min(yy, b); if (solidAt(l, cy) || solidAt(r, cy)) return true; if (cy === b) break; }
    return false; };
  function surfaceY(x) { for (let y = 0; y < (grid ? grid.rows * B : 0); y += B) if (solidAt(x, y + 1)) return y; return skyH - B * 4; }
  function placePlayer() {
    if (!grid) return;
    if (!P.placed) { P.x = Math.round(W * .36); P.y = surfaceY(P.x); P.placed = true; }
    P.x = Math.max(P.w / 2, Math.min(W - P.w / 2, P.x));
    let guard = 0; while (hits(P.x, P.y) && guard++ < 200) P.y -= 1; // pushed out if the ground moved
  }
  function stepPlayer(dt) {
    if (!grid || !P.placed) return;
    const RUN = 120, ACC = 900, GRAV = 1500, JUMP = 360;
    const want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (want) { P.vx += want * ACC * dt; P.vx = Math.max(-RUN, Math.min(RUN, P.vx)); P.face = want; }
    else { const f = ACC * 1.4 * dt; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f; }
    if (keys.jump && P.ground) { P.vy = -JUMP; P.ground = false; }
    P.vy = Math.min(900, P.vy + GRAV * dt);
    // move one axis at a time, a pixel at a time, so blocks stop you cleanly
    let dx = P.vx * dt; const sx = Math.sign(dx);
    while (dx !== 0) { const st = Math.abs(dx) > 1 ? sx : dx; if (hits(P.x + st, P.y) || P.x + st < P.w / 2 || P.x + st > W - P.w / 2) { P.vx = 0; break; } P.x += st; dx -= st; }
    let dy = P.vy * dt; const sy = Math.sign(dy); P.ground = false;
    while (dy !== 0) { const st = Math.abs(dy) > 1 ? sy : dy; if (hits(P.x, P.y + st)) { if (sy > 0) P.ground = true; P.vy = 0; break; } P.y += st; dy -= st; }
    if (!P.ground && P.vy >= 0 && hits(P.x, P.y + 1)) P.ground = true;
    P.step = P.ground && P.vx !== 0 ? P.step + Math.abs(P.vx) * dt : 0;
  }
  function drawPlayer() {
    if (!pcv) return;
    const g = pcv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, skyH);
    if (!P.placed) return;
    const u = 2, fx = Math.round(P.x), fy = Math.round(P.y), f = P.face;
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? fx + x * u : fx - (x + w) * u, fy + y * u, w * u, h * u); };
    const swing = P.ground ? Math.round(Math.sin(P.step / 7) * 2) : 1, air = !P.ground;
    // back arm and leg, then body, then front arm and leg (side view, facing f)
    R(-1 - swing, -6, 2, 6, '#3b3027');
    R(-1 - swing, -1, 2, 1, '#5a3b22');
    R(-1 + swing - (air ? 1 : 0), -11, 2, 5, '#3f6b3a');
    R(-2, -12, 4, 7, '#4e8a47'); R(-2, -7, 4, 1, '#6b4a2b'); // jacket, belt
    R(-1 + swing, -6, 2, 6, '#4a3c30'); R(-1 + swing, -1, 2, 1, '#6b4426');
    R(-1 - swing + (air ? 2 : 0), -11, 2, 5, '#5a9a52'); R(-1 - swing + (air ? 2 : 0), -7, 2, 1, '#e0b48c');
    R(-2, -16, 4, 4, '#e0b48c'); R(1, -15, 1, 1, '#1d2328'); // head, eye
    R(-3, -17, 7, 1, '#7a5230'); R(-2, -19, 4, 2, '#8d6038'); R(-2, -18, 4, 1, '#b3261e'); // hat with a red band
  }
  const typing = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump' };
  addEventListener('keydown', e => { const k = map[e.key]; if (!k || typing(e) || e.altKey || e.ctrlKey || e.metaKey || !visible || !pcv) return; keys[k] = true; e.preventDefault(); });
  addEventListener('keyup', e => { const k = map[e.key]; if (k) keys[k] = false; });
  addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });

  // ---- layout: size everything to the page ----
  let key = '';
  function layout() {
    const w = document.documentElement.clientWidth;
    const heroBottom = FIXED ? Math.min(Math.round(hero.getBoundingClientRect().bottom + scrollY), Math.round(innerHeight * .62)) : hero.offsetTop + hero.offsetHeight;
    const docH = FIXED ? Math.max(innerHeight, (screen && screen.height) || 0) : main.offsetTop + main.offsetHeight;
    const cols = Math.ceil(w / B), rows = Math.ceil(docH / B), base = Math.round(heroBottom / B) - 1;
    if (!FIXED) scene.style.height = docH + 'px';
    if (w !== W || skyH !== heroBottom + B * 4) { W = w; skyH = heroBottom + B * 4; sky.style.height = skyH + 'px'; layoutSky(); drawSky(performance.now());
      if (pcv) { pcv.width = Math.round(W * dpr); pcv.height = Math.round(skyH * dpr); pcv.style.height = skyH + 'px'; } }
    const k = cols + 'x' + rows + '@' + base; if (k === key) return; key = k;
    grid = generate(cols, rows, base); paint(grid); placePlayer();
    world.style.width = cols * B + 'px'; world.style.height = rows * B + 'px';
  }
  let pending = 0; const soon = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(layout); };
  layout();
  new ResizeObserver(soon).observe(main); addEventListener('resize', soon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; setRunning(); }).observe(sky);
  document.addEventListener('visibilitychange', setRunning);
  reduce.addEventListener('change', setRunning); darkQ.addEventListener('change', () => drawSky(performance.now()));
  // preview hook for testing: ?sky=0.25 freezes the cycle at that point (0 midday, 0.5 midnight)
  const fix = new URLSearchParams(location.search).get('sky'); if (fix !== null && !isNaN(+fix)) { const f = +fix; phase = () => f; }
  setRunning();
})();
