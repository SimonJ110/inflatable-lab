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
const N = 24, G = N + 1, CELL = 8 / N;
const bed = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, N, N).rotateX(-Math.PI / 2), bedMat); bed.frustumCulled = false; scene.add(bed);
const side = new THREE.Mesh(new THREE.BoxGeometry(7.96, 1, 7.96).translate(0, .5, 0), bedMat); scene.add(side);
const bp = bed.geometry.attributes.position, gi = new Int16Array(bp.count), gx = new Float32Array(bp.count);
for (let i = 0; i < bp.count; i++) { const ix = Math.round((bp.getX(i) + 4) / CELL), iz = Math.round((bp.getZ(i) + 4) / CELL); gi[i] = iz * G + ix; gx[i] = bp.getX(i); }
const mkWall = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d).translate(0, 1.2, 0), wallMat); m.position.set(x, 0, z); scene.add(m); return m; };
const wN = mkWall(8, .5, 0, -3.75), wS = mkWall(8, .5, 0, 3.75), wE = mkWall(.5, 8, 3.75, 0);
const pillars = [[-3.8, -3.8], [-3.8, 3.8], [3.8, -3.8], [3.8, 3.8]].map(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.45, .5, 3, 24).translate(0, 1.5, 0), wallMat); m.position.set(x, 0, z); scene.add(m); return m; });

// ---- simulation state (reduced-order: one air chamber + membrane wave grid + player spring)
const TARGET = 3400, SHUT = 4500, Q0 = 400; // Pa gauge target, fan shut-off pressure, fan rate Pa/s
const S = {}; let mat = MATS[Object.keys(MATS)[0]];
const w = new Float32Array(G * G), wv = new Float32Array(G * G);
const P0 = { x: -7, z: 0, y: 0, vy: 0, yaw: -Math.PI / 2, pitch: 0 }; const pl = { ...P0 };
function reset() { Object.assign(S, { P: TARGET, bump: 0, on: true, vent: false, spin: 1, bedF: 1, wallF: 1, wob: 0, wobV: 0, leak: 0, dP: 0 }); Object.assign(pl, P0); w.fill(0); wv.fill(0); contact = false;
  $('blower').textContent = 'Blower: ON'; $('vent').textContent = 'Vent: CLOSED'; }
let contact = false; reset();
function setMat(k) { mat = MATS[k]; wallMat.color.set(mat.color); } setMat(Object.keys(MATS)[0]);
const wSample = (x, z) => { const fx = clamp((x + 4) / CELL, 0, N - .001), fz = clamp((z + 4) / CELL, 0, N - .001), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
  return w[iz * G + ix] * (1 - tx) * (1 - tz) + w[iz * G + ix + 1] * tx * (1 - tz) + w[(iz + 1) * G + ix] * (1 - tx) * tz + w[(iz + 1) * G + ix + 1] * tx * tz; };
const bedH = () => .12 + .8 * S.bedF, wallH = () => 2.4 * (.05 + .95 * S.wallF), entry = x => sstep(-4.5, -3.8, x);
function surface(x, z) { return bedH() * entry(x) + (Math.abs(x) < 4 && Math.abs(z) < 4 ? wSample(x, z) : 0); }
const audio = new SensoryAudio(), keys = new Set(); let jx = 0, jy = 0, jumpQ = 0;

function step(dt) {
  S.spin += ((S.on ? 1 : 0) - S.spin) * (1 - Math.exp(-dt / (S.on ? .8 : 2.4)));
  const fan = S.spin * Q0 * Math.max(0, 1 - S.P / SHUT);
  S.leak = mat.c * Math.sqrt(Math.max(S.P, 0)) + mat.lin * S.P + (S.vent ? .25 * S.P : 0);
  S.dP = fan - S.leak; S.P = clamp(S.P + S.dP * dt, 0, SHUT);
  S.bump *= Math.exp(-dt * 4);
  const pf = clamp((S.P + S.bump) / TARGET, 0, 1.3); S.pf = pf;
  S.bedF += (Math.pow(Math.min(pf, 1.05), .6) - S.bedF) * (1 - Math.exp(-dt * 3));
  S.wallF += (sstep(.2, .85, pf) - S.wallF) * (1 - Math.exp(-dt * 1.2));
  S.wobV += (-30 * S.wob - 2.5 * S.wobV) * dt; S.wob += S.wobV * dt;
  // membrane waves
  for (let z = 1; z < N; z++) for (let x = 1; x < N; x++) { const i = z * G + x; wv[i] += (55 * (w[i - 1] + w[i + 1] + w[i - G] + w[i + G] - 4 * w[i]) - 7 * w[i] - 2.4 * wv[i]) * dt; }
  for (let z = 1; z < N; z++) for (let x = 1; x < N; x++) { const i = z * G + x; w[i] = clamp(w[i] + wv[i] * dt, -.5, .4); }
  // player
  const fw = -jy + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const rt = jx + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const l = Math.hypot(fw, rt) || 1, sp = 3.2 * Math.min(1, Math.hypot(fw, rt));
  pl.x += (-Math.sin(pl.yaw) * fw + Math.cos(pl.yaw) * rt) / l * sp * dt; pl.z += (-Math.cos(pl.yaw) * fw - Math.sin(pl.yaw) * rt) / l * sp * dt;
  pl.x = clamp(pl.x, -9, 3.45); pl.z = clamp(pl.z, -3.5, 3.5);
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
  const bh = bedH(), wh = wallH(), lean = Math.pow(1 - S.wallF, 1.5) * .9 + S.wob * .08;
  for (let i = 0; i < bp.count; i++) bp.setY(i, bh * entry(gx[i]) + w[gi[i]]);
  bp.needsUpdate = true; bed.geometry.computeVertexNormals(); side.scale.y = Math.max(.01, bh);
  const sc = wh / 2.4; for (const m of [wN, wS, wE]) { m.position.y = bh; m.scale.y = sc; }
  wN.rotation.x = lean; wS.rotation.x = -lean; wE.rotation.z = lean;
  for (const p of pillars) { p.position.y = bh; p.scale.y = .05 + .95 * S.wallF; }
  camera.position.set(pl.x, pl.y + 1.6, pl.z); camera.rotation.set(pl.pitch, pl.yaw, 0);
  $('read').innerHTML = `Pressure ${((S.P + S.bump) / 1000).toFixed(2)} kPa · ${Math.round(S.pf * 100)}%<br>${S.dP > 5 ? 'Inflating' : S.dP < -5 ? 'Losing air' : 'Holding'} · ${mat.name}`;
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
addEventListener('keydown', e => { if (e.target.matches('input,select')) return; keys.add(e.code); if (e.code === 'Space') { jumpQ = .25; e.preventDefault(); } });
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
$('jump').addEventListener('pointerdown', e => { e.preventDefault(); jumpQ = .25; });
$('go').onclick = () => { audio.start(); $('start').style.display = 'none'; };
$('blower').onclick = () => { S.on = !S.on; $('blower').textContent = 'Blower: ' + (S.on ? 'ON' : 'OFF'); };
$('vent').onclick = () => { S.vent = !S.vent; $('vent').textContent = 'Vent: ' + (S.vent ? 'OPEN' : 'CLOSED'); };
$('mat').onchange = e => setMat(e.target.value); $('reset').onclick = reset; $('gear').onclick = () => $('panel').classList.toggle('open');
$('inten').oninput = e => { audio.intensity = +e.target.value; audio.apply(); };
$('calm').onchange = e => { audio.calm = e.target.checked; audio.apply(); };
$('hap').onchange = e => { audio.haptics = e.target.checked; };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
