// 3D-modeller i Three.js, ritade som vita arkitektmodeller i axonometri.
// Ett element med data-model="koncern|system|building|frame" får en modell.
// Etiketter: element med data-anchor="<index>" inuti samma .model.
import * as THREE from 'three';

const PAPER = 0xf1f2ef;
const INK = 0x16191c;
const GREY = 0x8a9096;
const ACCENT = 0x1f3f8f;

const white = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
const lineMat = (color = INK, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function box(w, h, d, mat = white(), edgeOpacity = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lineMat(INK, edgeOpacity)));
  return m;
}

function plate(w, d) {
  const p = box(w, 0.12, d);
  p.position.y = -0.06;
  return p;
}

/* Koncernen: tre verksamheter på en gemensam grundplatta */
function koncern(root) {
  root.add(plate(9, 6));

  // Konsult: torn av staplade skivor
  const tower = new THREE.Group();
  tower.position.set(-2.8, 0, -0.6);
  for (let i = 0; i < 12; i++) {
    const s = box(1.4, 0.22, 1.4);
    s.position.y = 0.11 + i * 0.3;
    s.rotation.y = i * 0.04;
    tower.add(s);
  }
  root.add(tower);

  // Förvaltning: volym med våningar
  const block = new THREE.Group();
  block.position.set(0.2, 0, 0.6);
  for (let i = 0; i < 6; i++) {
    const f = box(2.4, 0.42, 1.8);
    f.position.y = 0.21 + i * 0.42;
    block.add(f);
  }
  root.add(block);

  // Bygg: stomme
  const frame = new THREE.Group();
  frame.position.set(3, 0, -0.4);
  const post = new THREE.MeshLambertMaterial({ color: 0x3b4146 });
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.08), post);
    p.castShadow = true;
    p.position.set(-0.8 + x * 0.8, 1, -0.8 + z * 0.8);
    frame.add(p);
  }
  for (const y of [1, 2]) for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.07, 0.07), post);
    a.position.set(0, y, -0.8 + i * 0.8);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.68), post);
    b.position.set(-0.8 + i * 0.8, y, 0);
    a.castShadow = b.castShadow = true;
    frame.add(a, b);
  }
  const slab = box(1.7, 0.06, 1.7);
  slab.position.y = 1.05;
  frame.add(slab);
  root.add(frame);

  const parts = [tower, block, frame];
  const anchors = [new THREE.Vector3(-2.8, 3.8, -0.6), new THREE.Vector3(0.2, 2.7, 0.6), new THREE.Vector3(3, 2.2, -0.4)];
  return {
    size: 8.6,
    anchors,
    update(t) { parts.forEach((p, i) => { p.scale.y = Math.max(0.001, ease((t - i * 0.25) / 1.2)); }); },
  };
}

/* Systemlandskap: affärssystem och affärsenheter */
function system(root) {
  root.add(plate(9, 7));
  const erp = box(2.2, 1.1, 1.6);
  erp.position.set(0, 0.55, 0);
  const crm = box(1.3, 0.7, 1.1);
  crm.position.set(-2.6, 0.35, -1.4);
  const cpq = box(1.3, 0.7, 1.1);
  cpq.position.set(-2.6, 0.35, 1.4);
  root.add(erp, crm, cpq);

  // Affärsenheter i en båge till höger
  const units = [];
  for (let i = 0; i < 7; i++) {
    const a = (-60 + i * 20) * (Math.PI / 180);
    const u = box(0.55, 0.3 + (i % 3) * 0.12, 0.55);
    u.position.set(Math.cos(a) * 3.4 + 0.4, u.geometry.parameters.height / 2, Math.sin(a) * 2.9);
    root.add(u);
    units.push(u);
  }

  const ends = [[crm, erp], [cpq, erp], [crm, cpq], ...units.map((u) => [erp, u])];
  const pts = [];
  const routes = ends.map(([a, b]) => {
    const p = new THREE.Vector3(a.position.x, 0.02, a.position.z);
    const q = new THREE.Vector3(b.position.x, 0.02, b.position.z);
    pts.push(p, q);
    return [p, q];
  });
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(INK, 0.55)));

  // Data som rör sig längs förbindelserna
  const dots = routes.map(() => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: ACCENT }));
    root.add(d);
    return d;
  });

  return {
    size: 8.8,
    anchors: [new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(-2.6, 0.7, -1.4), new THREE.Vector3(-2.6, 0.7, 1.4), new THREE.Vector3(units[3].position.x, 0.6, units[3].position.z)],
    update(t) {
      dots.forEach((d, i) => {
        const [p, q] = routes[i];
        const k = (t * 0.35 + i * 0.137) % 1;
        d.position.lerpVectors(p, q, k);
        d.position.y = 0.08;
      });
    },
  };
}

/* Byggnad: fastighet med bjälklag, fasadpelare och tak */
function building(root) {
  root.add(plate(8, 6));
  const W = 3.6, D = 2.4, H = 0.5, N = 8;
  const g = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const s = box(W, 0.06, D);
    s.position.y = i * H + 0.03;
    g.add(s);
    const core = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, H - 0.06, D - 0.3), new THREE.MeshLambertMaterial({ color: 0xdfe2de }));
    core.position.y = i * H + H / 2 + 0.03;
    core.castShadow = true;
    g.add(core);
  }
  const roof = box(W, 0.1, D);
  roof.position.y = N * H + 0.05;
  g.add(roof);
  const mullion = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i <= 8; i++) {
    for (const z of [D / 2 - 0.03, -D / 2 + 0.03]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, N * H, 0.05), mullion);
      m.position.set(-W / 2 + 0.03 + i * ((W - 0.06) / 8), (N * H) / 2, z);
      m.castShadow = true;
      g.add(m);
    }
  }
  for (let i = 0; i <= 5; i++) {
    for (const x of [W / 2 - 0.03, -W / 2 + 0.03]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, N * H, 0.05), mullion);
      m.position.set(x, (N * H) / 2, -D / 2 + 0.03 + i * ((D - 0.06) / 5));
      m.castShadow = true;
      g.add(m);
    }
  }
  // Teknikrum på taket
  const plant = box(1, 0.4, 0.8);
  plant.position.set(0.9, N * H + 0.3, -0.4);
  g.add(plant);
  root.add(g);

  // En våning markeras åt gången
  const mark = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.12, H, D + 0.12)), lineMat(ACCENT));
  root.add(mark);

  return {
    size: 7.4,
    anchors: [new THREE.Vector3(0.9, N * H + 0.5, -0.4)],
    update(t) {
      g.scale.y = Math.max(0.001, ease(t / 1.4));
      const f = Math.floor(t / 1.6) % N;
      mark.position.y = (f * H + H / 2 + 0.03) * g.scale.y;
      mark.visible = t > 1.4;
    },
  };
}

/* Stomme: byggnad som monteras del för del */
function frame(root) {
  root.add(plate(8, 6.4));
  const BX = 4, BZ = 3, BAY = 1.1, FL = 3, H = 1;
  const ox = (BX * BAY) / 2, oz = (BZ * BAY) / 2;
  const steel = new THREE.MeshLambertMaterial({ color: 0x3b4146 });
  const parts = [];
  const add = (m, delay) => { m.castShadow = true; m.userData.home = m.position.y; m.userData.delay = delay; root.add(m); parts.push(m); };
  let k = 0;
  for (let f = 0; f < FL; f++) {
    for (let x = 0; x <= BX; x++) for (let z = 0; z <= BZ; z++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), steel);
      p.position.set(x * BAY - ox, f * H + H / 2, z * BAY - oz);
      add(p, f * 1.6 + (k++ % 20) * 0.03);
    }
    for (let z = 0; z <= BZ; z++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(BX * BAY, 0.08, 0.08), steel);
      b.position.set(0, (f + 1) * H, z * BAY - oz);
      add(b, f * 1.6 + 0.7 + z * 0.05);
    }
    for (let x = 0; x <= BX; x++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, BZ * BAY), steel);
      b.position.set(x * BAY - ox, (f + 1) * H, 0);
      add(b, f * 1.6 + 0.9 + x * 0.05);
    }
    if (f < FL - 1) {
      for (let x = 0; x < BX; x++) for (let z = 0; z < BZ; z++) {
        if ((x + z + f) % 4 === 0) continue;
        const s = box(BAY - 0.04, 0.06, BAY - 0.04);
        s.position.set(x * BAY - ox + BAY / 2, (f + 1) * H + 0.07, z * BAY - oz + BAY / 2);
        add(s, f * 1.6 + 1.1 + (x + z) * 0.04);
      }
    }
  }
  return {
    size: 7.6,
    anchors: [],
    still: 6,
    update(t) {
      for (const p of parts) {
        const e = ease((t - p.userData.delay) / 0.6);
        p.visible = e > 0.001;
        p.position.y = p.userData.home + (1 - e) * 1.5;
      }
    },
  };
}

const MODELS = { koncern, system, building, frame };

export function mount(el, { reduceMotion = false } = {}) {
  const build = MODELS[el.dataset.model];
  if (!build) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(PAPER, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cdc8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-6, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.121;
  ground.receiveShadow = true;
  scene.add(ground);

  const root = new THREE.Group();
  scene.add(root);
  const api = build(root);

  // Axonometrisk kamera
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(10, 8.5, 10);
  camera.lookAt(0, 1, 0);

  const labels = [...el.querySelectorAll('[data-anchor]')];
  const v = new THREE.Vector3();
  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, el.clientWidth);
    H = Math.max(1, el.clientHeight);
    renderer.setSize(W, H, false);
    const aspect = W / H;
    // Modellen ska få plats både på bredden och på höjden
    const half = api.size * 0.52 * Math.max(1, 1.333 / aspect);
    camera.top = half; camera.bottom = -half;
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.updateProjectionMatrix();
    if (reduceMotion) render(api.still ?? 4);
  }

  // Dra för att vrida modellen
  let spin = 0, drag = null, auto = 0;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, spin }; el.setPointerCapture(e.pointerId); el.classList.add('is-dragging'); });
  el.addEventListener('pointermove', (e) => { if (drag) spin = drag.spin + (e.clientX - drag.x) * 0.01; });
  const end = () => { drag = null; el.classList.remove('is-dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.style.cursor = 'grab';
  el.style.touchAction = 'pan-y';

  function render(t) {
    api.update(t);
    root.rotation.y = -0.15 + spin + auto;
    renderer.render(scene, camera);
    labels.forEach((lab, i) => {
      const a = api.anchors[+lab.dataset.anchor];
      if (!a) return;
      v.copy(a).applyMatrix4(root.matrixWorld).project(camera);
      lab.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
      lab.classList.toggle('is-on', t > 1.2 + i * 0.15);
    });
  }

  new ResizeObserver(resize).observe(el);
  resize();
  el.classList.add('is-ready');

  if (reduceMotion) { render(api.still ?? 4); return; }

  const clock = new THREE.Clock();
  let t = 0, raf = 0, running = false;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    if (!drag) auto += dt * 0.06;
    render(t);
    raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; clock.getDelta(); loop(); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
  }).observe(el);
}
