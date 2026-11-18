import * as THREE from 'three';
import { SensoryAudio } from './audio.js';
const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let MATS = { vinyl: { name: 'PVC vinyl', c: .5, lin: .02, color: '#e8478b' } };
try { const r = await fetch('data/materials.json'); if (r.ok) MATS = await r.json(); } catch (e) { console.warn('Using built-in material', e); }
for (const k in MATS) $('mat').add(new Option(MATS[k].name, k));

// ---- scene
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement); const cv = renderer.domElement;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fd0ea); scene.fog = new THREE.Fog(0x9fd0ea, 30, 90);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .05, 200); camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f6a, 2.2)); const sun = new THREE.DirectionalLight(0xfff2d0, 2); sun.position.set(-6, 14, 8); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x5c9a55 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const wallMat = new THREE.MeshStandardMaterial({ color: MATS.vinyl?.color || '#e8478b', roughness: .55 });
const bedMat = new THREE.MeshStandardMaterial({ color: 0x2f86d6, roughness: .5, side: THREE.DoubleSide });
const N = 48, G = N + 1, CELL = 8 / N;
const bed = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, N, N).rotateX(-Math.PI / 2), bedMat); bed.frustumCulled = false; scene.add(bed);
const bp = bed.geometry.attributes.position, gi = new Int16Array(bp.count), gx = new Float32Array(bp.count), gz = new Float32Array(bp.count);
for (let i = 0; i < bp.count; i++) { const ix = Math.round((bp.getX(i) + 4) / CELL), iz = Math.round((bp.getZ(i) + 4) / CELL); gi[i] = iz * G + ix; gx[i] = bp.getX(i); gz[i] = bp.getZ(i); }
function ridge(z) { const u = ((z + 4) % 1 + 1) % 1; return Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)); }
// Eight tubes stacked with 20 cm overlap: the overlapping fabric becomes the baffle. Top and bottom skins mirror each other.
const R_ = .5875, PITCH = .975, SEG = 28, CRc = 1.0, CO = 4 - (CRc + R_);
const sheetMat = new THREE.MeshStandardMaterial({ color: 0x2a78c4, roughness: .55, side: THREE.DoubleSide });
const innerMat = new THREE.MeshStandardMaterial({ color: 0x9fd0f5, roughness: .7, side: THREE.DoubleSide });
const webMat = new THREE.MeshStandardMaterial({ color: 0x14405f, roughness: .8, side: THREE.DoubleSide });
const mkSheet = (g, m) => { const o = new THREE.Mesh(g, m); o.frustumCulled = false; scene.add(o); return o; };
const bedBot = mkSheet(new THREE.PlaneGeometry(8, 8, N, N).rotateX(-Math.PI / 2), sheetMat), bb = bedBot.geometry.attributes.position;
// Plan outline: rounded corners. Vertices outside the outline slide onto it, where top and bottom skins meet at the tube's widest point.
for (let i = 0; i < bp.count; i++) { let x = bp.getX(i), z = bp.getZ(i); const ax = Math.abs(x), az = Math.abs(z);
  if (ax > CO && az > CO) { const dx = ax - CO, dz = az - CO, l = Math.hypot(dx, dz), r = CRc + R_;
    if (l > r) { x = Math.sign(x) * (CO + dx * r / l); z = Math.sign(z) * (CO + dz * r / l); bp.setX(i, x); bp.setZ(i, z); bb.setX(i, x); bb.setZ(i, z); } } }
const SEAMS = [0, 1, 2, 3, 4, 5, 6].map(k => -2.925 + k * PITCH);
// Thin sheets with airflow slots, kept clear of the end tubes so air can pass round their ends.
function holeyGeo() { const g = new THREE.PlaneGeometry(5.6, 1, SEG, 3), idx = g.index.array, keep = [];
  for (let q = 0; q < SEG * 3; q++) { if ((q / SEG | 0) === 1) { const ix = q % SEG; if (ix >= 2 && ix < SEG - 2 && (ix - 2) % 6 < 3) continue; } for (let k = 0; k < 6; k++) keep.push(idx[q * 6 + k]); } g.setIndex(keep); return g; }
const baffles = SEAMS.map(z => { const m = mkSheet(holeyGeo(), innerMat); m.position.z = z; return { z, m }; });
// Cyan line in the sketch: not a baffle, but a stitched seam where the front/back tube skin is sewn to the adjacent middle tubes.
const seamLines = [-2.925, 2.925].map(x => { const m = mkSheet(new THREE.PlaneGeometry(.08, 5.85, 1, SEG).rotateX(-Math.PI / 2), webMat); m.position.x = x; return { x, m }; });
const webs = SEAMS.map(z => { const m = mkSheet(new THREE.PlaneGeometry(5.85, .08, SEG, 1).rotateX(-Math.PI / 2), webMat); m.position.z = z; return { z, m }; });
const stepTopM = mkSheet(new THREE.PlaneGeometry(1.4, 5.4, 14, 36).rotateX(-Math.PI / 2), sheetMat), stepBotM = mkSheet(new THREE.PlaneGeometry(1.4, 5.4, 14, 36).rotateX(-Math.PI / 2), sheetMat);
stepTopM.position.x = stepBotM.position.x = -4.7;
const stepBaffles = [-4.5, -4.9].map(x => { const m = mkSheet(holeyGeo().rotateY(Math.PI / 2), innerMat); m.position.x = x; m.scale.z = 4.4 / 5.6; return { x, m }; });
function updateInner() {
  const set = (p, i, x, z) => { const t = topH(x, z, 1) + wSample(x, z), bt = botH(x, z); for (let r = 0; r < 4; r++) p.setY(r * (SEG + 1) + i, t + (bt - t) * r / 3); };
  for (const b of baffles) { const p = b.m.geometry.attributes.position; for (let i = 0; i <= SEG; i++) set(p, i, p.getX(i), b.z); p.needsUpdate = true; }
  for (const c of seamLines) { const p = c.m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, topH(c.x, p.getZ(i), 1) + wSample(c.x, p.getZ(i)) + .012); p.needsUpdate = true; }
  for (const wb of webs) { const p = wb.m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, topH(p.getX(i), wb.z, 1) + wSample(p.getX(i), wb.z) + .012); p.needsUpdate = true; }
  for (const T of [stepTopM, stepBotM]) { const p = T.geometry.attributes.position, top = T === stepTopM; for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 4.7, z = p.getZ(i); p.setY(i, top ? stepTop(x, z, 1) : stepBot(x, z)); } p.needsUpdate = true; T.geometry.computeVertexNormals(); }
  for (const b of stepBaffles) { const p = b.m.geometry.attributes.position; for (let i = 0; i <= SEG; i++) { const z = p.getZ(i) * b.m.scale.z, t = stepTop(b.x, z, 1), bt = stepBot(b.x, z); for (let r = 0; r < 4; r++) p.setY(r * (SEG + 1) + i, t + (bt - t) * r / 3); } p.needsUpdate = true; }
}
// Fabric does not stretch: each wall/pillar is a stack of fixed-size tubes that flatten, widen and slump (pile) as air is lost.
const tubes = [];
function addTube(kind, i, x, z, nx, nz, len) {
  const g = kind === 'p' ? new THREE.CylinderGeometry(.5, .5, .8, 24) : new THREE.CylinderGeometry(.4, .4, len, 20);
  if (kind === 'x') g.rotateZ(Math.PI / 2); if (kind === 'z') g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, wallMat); scene.add(m); tubes.push({ m, kind, i, x, z, nx, nz, th: .15 + i * .17, f: 1 });
}
for (let i = 0; i < 3; i++) { addTube('x', i, 0, -3.45, 0, 1, 4.8); addTube('x', i, 0, 3.45, 0, -1, 4.8); addTube('z', i, 3.45, 0, -1, 0, 4.8); }
// Pillars: one fixed-length tube each. Deflated, they topple inward and lie on the bed; their base follows the bed surface.
const HP = 2.4, PJ = 10; wallMat.side = THREE.DoubleSide;
const pillars = [[-3, -3], [-3, 3], [3, -3], [3, 3]].map(([x, z]) => { const g = new THREE.CylinderGeometry(.5, .5, HP, 24, PJ).translate(0, HP / 2, 0); const m = new THREE.Mesh(g, wallMat); m.frustumCulled = false; scene.add(m);
  return { m, x, z, dx: -Math.sign(x) * Math.SQRT1_2, dz: -Math.sign(z) * Math.SQRT1_2, rest: new Float32Array(g.attributes.position.array), f: 1, ey: 0, ev: 0, yb: 0, cx: new Float32Array(PJ + 1), cy: new Float32Array(PJ + 1), th: new Float32Array(PJ + 1) }; });
const wEls = [{ x: 0, z: -3.45 }, { x: 0, z: 3.45 }, { x: 3.45, z: 0 }].map(o => ({ ...o, ey: 0, ev: 0 }));
for (const t of tubes) t.el = wEls.find(e => e.x === t.x && e.z === t.z);
const els = [...wEls, ...pillars], HN = 256, hist = new Float32Array(HN); let hi = 0; // one air chamber: pressure history lets waves reach each element after a delay
const webs3 = [['x', -3.45, -2.4, 0], ['x', -3.45, 2.4, 2], ['x', 3.45, -2.4, 1], ['x', 3.45, 2.4, 3], ['z', 3.45, -2.4, 2], ['z', 3.45, 2.4, 3]].map(([kind, fix, e, pi]) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 3), wallMat); m.frustumCulled = false; scene.add(m);
  return { m, kind, e, pi, tl: tubes.filter(t => t.kind === kind && (kind === 'x' ? t.z : t.x) === fix) }; });

// ---- simulation state (reduced-order: one air chamber + membrane wave grid + player spring)
const TARGET = 3400, SHUT = 4500, Q0 = 400; // Pa gauge target, fan shut-off pressure, fan rate Pa/s
const S = {}; let mat = MATS[Object.keys(MATS)[0]];
const w = new Float32Array(G * G), wv = new Float32Array(G * G);
const P0 = { x: -7, z: 0, y: 0, vy: 0, yaw: -Math.PI / 2, pitch: 0 }; const pl = { ...P0 };
function reset() { Object.assign(S, { P: TARGET, bump: 0, on: true, vent: false, spin: 1, bedF: 1, wallF: 1, wob: 0, wobV: 0, leak: 0, dP: 0, bulge: 0, pd: 0, pdS: 0 }); Object.assign(pl, P0); w.fill(0); wv.fill(0); contact = false; for (const t of tubes) t.f = 1; for (const e of els) e.ey = e.ev = 0; for (const p of pillars) p.f = 1; hist.fill(0);
  $('blower').textContent = 'Blower: ON'; $('vent').textContent = 'Vent: CLOSED'; }
let contact = false; reset();
function setMat(k) { mat = MATS[k]; wallMat.color.set(mat.color); } setMat(Object.keys(MATS)[0]);
const wSample = (x, z) => { const fx = clamp((x + 4) / CELL, 0, N - .001), fz = clamp((z + 4) / CELL, 0, N - .001), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
  return w[iz * G + ix] * (1 - tx) * (1 - tz) + w[iz * G + ix + 1] * tx * (1 - tz) + w[(iz + 1) * G + ix] * (1 - tx) * tz + w[(iz + 1) * G + ix + 1] * tx * tz; };
const fp = () => .05 + .95 * S.bedF; // fabric is fixed length: deflating flattens the tubes, it does not shrink them
function laneS(z) { const k = clamp(Math.round((z + 4 - R_) / PITCH), 0, 7), dz = z - (-4 + R_ + k * PITCH); return Math.sqrt(Math.max(0, R_ * R_ - dz * dz)); }
function ringS(x, z) { const qx = Math.abs(x) - (3.4125 - CRc), qz = Math.abs(z) - (3.4125 - CRc);
  const d = Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - CRc); return Math.sqrt(Math.max(0, R_ * R_ - d * d)); }
// Outer ring (side tubes 1 and 8 + front and back tubes) is one tube bent round rounded corners; the six middle tubes sit inside it.
function tubeS(x, z) { const ax = Math.abs(x); if (Math.abs(z) >= 2.925) return ringS(x, z); const wR = sstep(2.925, 3.4, ax); return laneS(z) * (1 - wR) + ringS(x, z) * wR; }
const topH = (x, z, k) => fp() * (R_ + k * tubeS(x, z) + S.bulge) + (1 - S.bedF) * .08 * Math.sin(x * 3.1 + z * 2.3) * Math.sin(z * 4.3 - x * 1.7);
const botH = (x, z) => Math.max(.02, fp() * (R_ - tubeS(x, z)) + Math.min(0, wSample(x, z)) * .5);
const baseH = () => fp() * (R_ + laneS(3.45)), bedY = (x, z) => topH(x, z, 1) + wSample(x, z) - .03;
// Front step: three small tubes (20 cm overlap) running side to side, narrower than the castle, with domed ends.
const RS = .3, SP = .4;
const stepS = (x, z) => { const k = clamp(Math.round((-4.3 - x) / SP), 0, 2), dx = x + 4.3 + k * SP, e = Math.max(0, Math.abs(z) - 2.2); return Math.sqrt(Math.max(0, RS * RS - dx * dx - e * e)); };
const stepTop = (x, z, k) => fp() * (RS + k * stepS(x, z)), stepBot = (x, z) => Math.max(.02, fp() * (RS - stepS(x, z)));
const surface = (x, z) => x < -4 ? (x > -5.4 && Math.abs(z) < 2.7 ? stepTop(x, z, .6) : 0) : topH(x, z, .6) + wSample(x, z);
const audio = new SensoryAudio(), keys = new Set(); let jx = 0, jy = 0, jumpQ = 0;

function step(dt) {
  S.spin += ((S.on ? 1 : 0) - S.spin) * (1 - Math.exp(-dt / (S.on ? .8 : 2.4)));
  const fan = S.spin * Q0 * Math.max(0, 1 - S.P / SHUT);
  S.leak = mat.c * Math.sqrt(Math.max(S.P, 0)) + mat.lin * S.P + (S.vent ? .25 * S.P : 0);
  S.dP = fan - S.leak; S.P = clamp(S.P + S.dP * dt, 0, SHUT);
  S.bump *= Math.exp(-dt * 4);
  { const pf0 = clamp((S.P + S.bump) / TARGET, 0, 1.3);
    for (const p of pillars) { const tg = sstep(.25, .7, pf0); p.f += (tg - p.f) * (1 - Math.exp(-dt * (tg > p.f ? .9 : 1.6))); }
    let dv = 0; for (let i = 0; i < w.length; i++) dv -= w[i]; dv *= CELL * CELL; if (contact) dv += Math.max(0, surface(pl.x, pl.z) - pl.y) * .35;
    S.pd = 1800 * dv; S.pdS += (S.pd - S.pdS) * (1 - Math.exp(-dt * 20)); S.bulge = clamp(S.pdS * .00007, -.05, .08);
    hist[hi] = S.pd; hi = (hi + 1) % HN;
    for (const e of els) { const dl = Math.round(Math.hypot(e.x - pl.x, e.z - pl.z) / 22 * 120), pdel = hist[(hi - 1 - dl + HN * 2) % HN];
      e.ev += (-340 * (e.ey - pdel * .0003) - 2.2 * e.ev) * dt; e.ey = clamp(e.ey + e.ev * dt, -.4, .4); } }
  const pf = clamp((S.P + S.bump) / TARGET, 0, 1.3); S.pf = pf;
  S.bedF += (Math.pow(Math.min(pf, 1.05), .6) - S.bedF) * (1 - Math.exp(-dt * 3));
  for (const t of tubes) { const tg = sstep(t.th, t.th + .35, pf); t.f += (tg - t.f) * (1 - Math.exp(-dt * (tg > t.f ? 1.2 : 2.2))); }
  S.wobV += (-30 * S.wob - 2.5 * S.wobV) * dt; S.wob += S.wobV * dt;
  // membrane waves
  for (let z = 1; z < N; z++) for (let x = 1; x < N; x++) { const i = z * G + x; wv[i] += (220 * (w[i - 1] + w[i + 1] + w[i - G] + w[i + G] - 4 * w[i]) - 7 * w[i] - 2.4 * wv[i]) * dt; }
  for (let z = 1; z < N; z++) for (let x = 1; x < N; x++) { const i = z * G + x; w[i] = clamp(w[i] + wv[i] * dt, -.5, .4); }
  // player
  const fw = -jy + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const rt = jx + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const l = Math.hypot(fw, rt) || 1, sp = 3.2 * Math.min(1, Math.hypot(fw, rt));
  pl.x += (-Math.sin(pl.yaw) * fw + Math.cos(pl.yaw) * rt) / l * sp * dt; pl.z += (-Math.cos(pl.yaw) * fw - Math.sin(pl.yaw) * rt) / l * sp * dt;
  pl.x = clamp(pl.x, -9, 3.45); pl.z = clamp(pl.z, -3.5, 3.5);
  { const ax = Math.abs(pl.x), az = Math.abs(pl.z); if (pl.x > -4 && ax > CO && az > CO) { const dx = ax - CO, dz = az - CO, l = Math.hypot(dx, dz); if (l > 1.3) { pl.x = Math.sign(pl.x) * (CO + dx * 1.3 / l); pl.z = Math.sign(pl.z) * (CO + dz * 1.3 / l); } } }
  const h = surface(pl.x, pl.z), d = h - pl.y, kk = 40 + 700 * Math.pow(Math.min(pf, 1), 1.3);
  if (d > 0) {
    if (!contact) { const v = Math.max(0, -pl.vy); contact = true; if (v > .8 && h > .2) landing(v, pf); }
    pl.vy += (kk * d - 6 * pl.vy - 9.81) * dt;
    if (jumpQ > 0 && Math.abs(pl.vy) < 3) { pl.vy = 4.3; jumpQ = 0; }
  } else { contact = false; pl.vy -= 9.81 * dt; }
  jumpQ = Math.max(0, jumpQ - dt); pl.y += pl.vy * dt; if (pl.y < 0) { pl.y = 0; pl.vy = Math.max(0, pl.vy); }
}
function landing(v, pf) {
  const amp = Math.min(.25, v * .04) * pf; if (Math.abs(pl.x) < 4) for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
    const dx = x * CELL - 4 - pl.x, dz = z * CELL - 4 - pl.z; wv[z * G + x] -= amp * 30 * Math.exp(-(dx * dx + dz * dz) / .9); }
  S.wobV += v * .08 * pf; S.bump = Math.min(600, S.bump + v * 60 * pf); audio.thump(v * (.4 + .6 * pf));
}

// ---- render
function render() {
  for (let i = 0; i < bp.count; i++) { const x = gx[i], z = gz[i], wi = w[gi[i]]; bp.setY(i, topH(x, z, 1) + wi); bb.setY(i, botH(x, z)); }
  bp.needsUpdate = true; bb.needsUpdate = true; bed.geometry.computeVertexNormals(); bedBot.geometry.computeVertexNormals(); const base = baseH(); updateInner();
  const ys = {};
  for (const t of tubes) { const k = t.kind + t.x + t.z, y0 = ys[k] === undefined ? base : ys[k], hh = .8 * (.3 + .7 * t.f); ys[k] = y0 + hh;
    const lat = 1 + .7 * (1 - t.f), lean = (1 - t.f) * (.5 + .15 * t.i) + (S.wob * .08 + t.el.ey * .3) * (t.i + 1), sy = hh / .8 * (1 + t.el.ey * .4);
    t.m.position.set(t.x + t.nx * lean, y0 + hh / 2, t.z + t.nz * lean);
    if (t.kind === 'x') t.m.scale.set(1, sy, lat); else if (t.kind === 'z') t.m.scale.set(lat, sy, 1); else t.m.scale.set(lat, sy, lat); }
  for (const p of pillars) {
    const pos = p.m.geometry.attributes.position, ds = HP / PJ, thm = (1 - p.f) * 1.5 + p.ey * .35; p.yb = bedY(p.x, p.z);
    for (let j = 0; j <= PJ; j++) { p.th[j] = thm * Math.sqrt(j / PJ); if (j) { const tm = (p.th[j - 1] + p.th[j]) / 2; p.cx[j] = p.cx[j - 1] + Math.sin(tm) * ds; p.cy[j] = p.cy[j - 1] + Math.cos(tm) * ds; } }
    for (let i = 0; i < pos.count; i++) { const k = i * 3, rx = p.rest[k], ry = p.rest[k + 1], rz = p.rest[k + 2], j = Math.round(ry / HP * PJ), c = Math.cos(p.th[j]), sn = Math.sin(p.th[j]);
      const u = rx * p.dx + rz * p.dz, v = -rx * p.dz + rz * p.dx, h = p.cx[j] + u * c, X = p.x + p.dx * h - p.dz * v, Z = p.z + p.dz * h + p.dx * v;
      pos.setXYZ(i, X, p.yb + p.cy[j] - u * sn + .5 * sn + (bedY(X, Z) - p.yb) * (1 - sstep(0, .3, ry / HP)), Z); }
    pos.needsUpdate = true; p.m.geometry.computeVertexNormals(); }
  for (const wb of webs3) { const P = pillars[wb.pi], pos = wb.m.geometry.attributes.position, tl = wb.tl, droop = (1 - tl[0].f) * .25;
    for (let r = 0; r < 4; r++) { const t = tl[Math.max(0, r - 1)], ax = t.m.position.x + (wb.kind === 'x' ? wb.e : 0), az = t.m.position.z + (wb.kind === 'z' ? wb.e : 0), ay = r ? t.m.position.y + t.m.scale.y * .4 : 0;
      const tp = r ? clamp((ay - P.yb) / Math.max(.2, P.cy[PJ]), 0, 1) : 0, jj = Math.round(tp * PJ), pcx = P.x + P.dx * P.cx[jj], pcz = P.z + P.dz * P.cx[jj];
      const dx = ax - pcx, dz = az - pcz, l = Math.hypot(dx, dz) || 1, bx = pcx + dx / l * .5, bz = pcz + dz / l * .5;
      for (let i = 0; i <= 8; i++) { const q = i / 8, x = ax + (bx - ax) * q, z = az + (bz - az) * q; pos.setXYZ(r * 9 + i, x, r ? ay - droop * Math.sin(Math.PI * q) : bedY(x, z), z); } }
    pos.needsUpdate = true; wb.m.geometry.computeVertexNormals(); }
  camera.position.set(pl.x, pl.y + 1.6, pl.z); camera.rotation.set(pl.pitch, pl.yaw, 0);
  $('read').innerHTML = `<b>v3.3</b> · Pressure ${((S.P + S.bump) / 1000).toFixed(2)} kPa · ${Math.round(S.pf * 100)}%<br>${S.dP > 5 ? 'Inflating' : S.dP < -5 ? 'Losing air' : 'Holding'} · ${mat.name}`;
  renderer.render(scene, camera);
}
let acc = 0, last = performance.now();
(function frame(t) { requestAnimationFrame(frame); acc += Math.min(.05, (t - last) / 1000); last = t;
  for (let n = 0; acc >= 1 / 120 && n < 8; n++, acc -= 1 / 120) step(1 / 120);
  audio.update({ spin: S.spin, leak: S.leak, pf: S.pf, deflating: S.dP < -5 }); render(); })(last);

// ---- input + UI
let joy = null; const ptr = new Map();
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); if (e.pointerType === 'touch' && e.clientX < innerWidth * .4 && !joy) joy = { id: e.pointerId, x: e.clientX, y: e.clientY }; else ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
cv.addEventListener('pointermove', e => { if (joy && e.pointerId === joy.id) { jx = clamp((e.clientX - joy.x) / 50, -1, 1); jy = clamp((e.clientY - joy.y) / 50, -1, 1); }
  else { const p = ptr.get(e.pointerId); if (p) { pl.yaw -= (e.clientX - p.x) * .005; pl.pitch = clamp(pl.pitch - (e.clientY - p.y) * .005, -1.4, 1.4); p.x = e.clientX; p.y = e.clientY; } } });
const up = e => { if (joy && e.pointerId === joy.id) { joy = null; jx = jy = 0; } ptr.delete(e.pointerId); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if (e.target.matches('input,select')) return; keys.add(e.code); if (e.code === 'Space') { jumpQ = .25; e.preventDefault(); } });
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
$('jump').addEventListener('pointerdown', e => { e.preventDefault(); jumpQ = .25; });
$('go').onclick = () => { audio.start(); $('start').style.display = 'none'; };
$('blower').onclick = () => { S.on = !S.on; $('blower').textContent = 'Blower: ' + (S.on ? 'ON' : 'OFF'); };
$('vent').onclick = () => { S.vent = !S.vent; $('vent').textContent = 'Vent: ' + (S.vent ? 'OPEN' : 'CLOSED'); };
$('mat').onchange = e => setMat(e.target.value); $('xray').onclick = () => { const on = !bedMat.transparent; bedMat.transparent = on; bedMat.opacity = on ? .25 : 1; bedMat.depthWrite = !on; bedMat.needsUpdate = true; $('xray').textContent = 'X-ray: ' + (on ? 'ON' : 'OFF'); };
$('reset').onclick = reset; $('gear').onclick = () => $('panel').classList.toggle('open');
$('inten').oninput = e => { audio.intensity = +e.target.value; audio.apply(); };
$('calm').onchange = e => { audio.calm = e.target.checked; audio.apply(); };
$('hap').onchange = e => { audio.haptics = e.target.checked; };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
