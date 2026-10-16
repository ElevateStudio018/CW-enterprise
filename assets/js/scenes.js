// 3D-scener (Three.js). Varje element med data-scene="<variant>" får en egen scen.
// Varianter: koncern, network, building, frame, terrain.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const INK = 0x0c0e11;
const BRASS = 0xc9a66b;
const STEEL = 0x8196a8;
const STONE = 0x262a31;
const LIMESTONE = 0xd8d1c3;

const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a, b, t) => a + (b - a) * t;

function edges(mesh, color = BRASS, opacity = 0.55) {
  const line = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 20),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  mesh.add(line);
  return line;
}

function groundGrid(size = 60, div = 60, opacity = 0.07) {
  const grid = new THREE.GridHelper(size, div, STEEL, STEEL);
  grid.material.transparent = true;
  grid.material.opacity = opacity;
  grid.material.depthWrite = false;
  return grid;
}

function dust(count, spread, color = LIMESTONE, size = 0.025) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * spread;
    p[i * 3 + 1] = Math.random() * spread * 0.5;
    p[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.45, depthWrite: false }));
}

/* ------------------------------------------------------------------ */
/* Koncern: tre verksamheter på en gemensam grund                      */
/* ------------------------------------------------------------------ */
function koncern({ scene, camera, small }) {
  camera.position.set(11.5, 7.4, 14);
  const target = new THREE.Vector3(0, 1.3, 0);

  const root = new THREE.Group();
  scene.add(root);
  scene.add(groundGrid(80, 80, 0.06));

  const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.6, metalness: 0.15 });
  const lime = new THREE.MeshStandardMaterial({ color: LIMESTONE, roughness: 0.75, metalness: 0.05 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa88651, roughness: 0.35, metalness: 0.8 });

  // Gemensam grund
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.4, 0.18, 128), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.85, metalness: 0.1 }));
  plinth.position.y = -0.09;
  root.add(plinth);
  const ringGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 4.3, 0.005, Math.sin(a) * 4.3);
    }),
  );
  root.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.8 })));
  const inner = new THREE.Line(ringGeo.clone().scale(0.82, 1, 0.82), new THREE.LineDashedMaterial({ color: BRASS, dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: 0.45 }));
  inner.computeLineDistances();
  root.add(inner);

  // Förbindelser mellan verksamheterna, ritade i grunden
  const sites = [200, 320, 80].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(a) * 2.45, 0.01, Math.sin(a) * 2.45);
  });
  const hub = new THREE.Vector3(0, 0.01, 0.2);
  const wires = new THREE.BufferGeometry().setFromPoints(sites.flatMap((s) => [hub, s]));
  root.add(new THREE.LineSegments(wires, new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.5 })));
  const hubDot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), brass);
  hubDot.position.copy(hub);
  root.add(hubDot);

  // 01 Konsult — vriden torn av skivor
  const tower = new THREE.Group();
  tower.position.copy(sites[0]);
  const plates = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.13, 1.15), lime);
    m.rotation.y = i * 0.055;
    m.userData.y = 0.12 + i * 0.25;
    m.position.y = m.userData.y;
    edges(m, 0x6f6a60, 0.35);
    tower.add(m);
    plates.push(m);
  }
  root.add(tower);

  // 02 Förvaltning — massiv volym med våningslinjer
  const block = new THREE.Group();
  block.position.copy(sites[1]);
  const blockH = 3.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, blockH, 1.5), stone);
  body.position.y = blockH / 2;
  edges(body, BRASS, 0.7);
  block.add(body);
  const floorLines = [];
  for (let i = 1; i < 8; i++) {
    const y = (blockH / 8) * i;
    const pts = [[-1, y, 0.751], [1, y, 0.751], [1.001, y, 0.75], [1.001, y, -0.75]].map((v) => new THREE.Vector3(...v));
    floorLines.push(pts[0], pts[1], pts[2], pts[3]);
  }
  block.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(floorLines), new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.28 })));
  root.add(block);

  // 03 Bygg — öppen stomme
  const frame = new THREE.Group();
  frame.position.copy(sites[2]);
  const postGeo = new THREE.BoxGeometry(0.07, 2.2, 0.07);
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    const p = new THREE.Mesh(postGeo, brass);
    p.position.set(-0.8 + x * 0.8, 1.1, -0.8 + z * 0.8);
    frame.add(p);
  }
  for (const y of [1.1, 2.2]) {
    for (let i = 0; i < 3; i++) {
      const bx = new THREE.Mesh(new THREE.BoxGeometry(1.67, 0.07, 0.07), brass);
      bx.position.set(0, y, -0.8 + i * 0.8);
      const bz = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.67), brass);
      bz.position.set(-0.8 + i * 0.8, y, 0);
      frame.add(bx, bz);
    }
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.7), stone);
  slab.position.y = 1.08;
  edges(slab, BRASS, 0.4);
  frame.add(slab);
  root.add(frame);

  const parts = [tower, block, frame];
  parts.forEach((p) => p.scale.set(1, 0.001, 1));

  const motes = dust(small ? 120 : 260, 22);
  scene.add(motes);

  const anchors = [
    new THREE.Vector3(sites[0].x, 4.4, sites[0].z),
    new THREE.Vector3(sites[1].x, 3.5, sites[1].z),
    new THREE.Vector3(sites[2].x, 2.7, sites[2].z),
  ];

  let rot = -0.5;
  return {
    anchors: () => anchors.map((a) => root.localToWorld(a.clone())),
    update(t, s) {
      parts.forEach((p, i) => { p.scale.y = Math.max(0.001, ease((t - 0.3 - i * 0.35) / 1.6)); });
      plates.forEach((m, i) => { m.position.y = m.userData.y + Math.sin(t * 0.8 + i * 0.4) * 0.012; });
      rot = lerp(rot, -0.5 + t * 0.04 + s.px * 0.35, 0.04);
      root.rotation.y = rot;
      motes.rotation.y = t * 0.01;
      camera.position.y = lerp(camera.position.y, 7.4 - s.py * 0.8 + s.progress * 2.5, 0.05);
      camera.lookAt(target);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Nätverk: system, processer och människor som kopplas samman        */
/* ------------------------------------------------------------------ */
function network({ scene, camera, small }) {
  camera.position.set(0, 0.4, 12.5);
  const root = new THREE.Group();
  scene.add(root);

  const N = small ? 70 : 120;
  const R = 2.7;
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    const rr = R * (0.82 + Math.random() * 0.18);
    nodes.push(new THREE.Vector3(Math.cos(a) * r * rr, y * rr, Math.sin(a) * r * rr));
  }

  // Noder
  const small1 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color: LIMESTONE }), N);
  const hubs = [];
  const m4 = new THREE.Matrix4();
  nodes.forEach((v, i) => {
    m4.makeTranslation(v.x, v.y, v.z);
    small1.setMatrixAt(i, m4);
    if (i % 11 === 0) hubs.push(v);
  });
  root.add(small1);
  const hubMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: BRASS }), hubs.length);
  hubs.forEach((v, i) => { m4.makeTranslation(v.x, v.y, v.z); hubMesh.setMatrixAt(i, m4); });
  root.add(hubMesh);

  // Kanter: närmaste grannar
  const pairs = [];
  const seen = new Set();
  nodes.forEach((v, i) => {
    const near = nodes.map((w, j) => [j, v.distanceToSquared(w)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3);
    for (const [j] of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); pairs.push([i, j]); }
    }
  });
  // Navkopplingar genom kärnan
  for (let a = 0; a < hubs.length; a++) for (let b = a + 1; b < hubs.length; b += 2) pairs.push([nodes.indexOf(hubs[a]), nodes.indexOf(hubs[b])]);

  const linePts = pairs.flatMap(([i, j]) => [nodes[i], nodes[j]]);
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: STEEL, transparent: true, opacity: 0.28 })));

  // Pulser som färdas längs kanterna
  const P = small ? 30 : 60;
  const pulseGeo = new THREE.BufferGeometry();
  const pulsePos = new Float32Array(P * 3);
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulses = Array.from({ length: P }, () => ({ e: Math.floor(Math.random() * pairs.length), t: Math.random(), v: 0.25 + Math.random() * 0.5 }));
  root.add(new THREE.Points(pulseGeo, new THREE.PointsMaterial({ color: BRASS, size: 0.07, transparent: true, opacity: 0.95, depthWrite: false })));

  // Kärna
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), new THREE.MeshBasicMaterial({ color: BRASS, wireframe: true, transparent: true, opacity: 0.22 }));
  root.add(core);
  const coreSolid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.35, metalness: 0.6, flatShading: true }));
  edges(coreSolid, BRASS, 0.8);
  root.add(coreSolid);

  // Banor
  for (const [r, tilt] of [[3.6, 0.4], [4.1, -0.9]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 6, 200), new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2 + tilt;
    root.add(ring);
  }

  const tmp = new THREE.Vector3();
  let last = 0;
  return {
    layout: { x: 0.22, y: 0 },
    update(t, s) {
      const dt = Math.min(t - last, 0.05); last = t;
      const intro = ease(t / 2.2);
      root.scale.setScalar(0.6 + intro * 0.4);
      root.rotation.y = lerp(root.rotation.y, t * 0.07 + s.px * 0.4, 0.05);
      root.rotation.x = lerp(root.rotation.x, 0.15 + s.py * 0.2, 0.05);
      core.rotation.y = -t * 0.15;
      coreSolid.rotation.x = t * 0.2;
      coreSolid.rotation.y = t * 0.12;
      pulses.forEach((p, k) => {
        p.t += dt * p.v;
        if (p.t > 1) { p.t = 0; p.e = Math.floor(Math.random() * pairs.length); }
        const [i, j] = pairs[p.e];
        tmp.lerpVectors(nodes[i], nodes[j], p.t);
        pulsePos[k * 3] = tmp.x; pulsePos[k * 3 + 1] = tmp.y; pulsePos[k * 3 + 2] = tmp.z;
      });
      pulseGeo.attributes.position.needsUpdate = true;
      camera.position.z = 12.5 - s.progress * 1.5;
      camera.lookAt(0, 0, 0);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Byggnad: en förvaltad fastighet, våning för våning                 */
/* ------------------------------------------------------------------ */
function building({ scene, camera, small }) {
  camera.position.set(8.5, 5.2, 10.5);
  const target = new THREE.Vector3(0, 2.4, 0);
  const root = new THREE.Group();
  scene.add(root);
  scene.add(groundGrid(80, 80, 0.06));

  const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.55, metalness: 0.2 });
  const W = 3.4, D = 2.2, FH = 0.46, FLOORS = 10;
  const floors = [];

  const winGeo = new THREE.BoxGeometry(0.22, 0.3, 0.02);
  const perFloor = [];
  const front = 9, side = 5;
  for (let i = 0; i < front; i++) {
    const x = -W / 2 + 0.3 + i * ((W - 0.6) / (front - 1));
    perFloor.push([x, D / 2 - 0.08, 0], [x, -D / 2 + 0.08, Math.PI]);
  }
  for (let i = 0; i < side; i++) {
    const z = -D / 2 + 0.3 + i * ((D - 0.6) / (side - 1));
    perFloor.push([W / 2 - 0.08, z, Math.PI / 2], [-W / 2 + 0.08, z, -Math.PI / 2]);
  }
  const winCount = perFloor.length * FLOORS;
  const windows = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), winCount);
  const lit = new Uint8Array(winCount);
  const cOn = new THREE.Color(0xe9be7c);
  const cOff = new THREE.Color(0x1c2027);

  for (let f = 0; f < FLOORS; f++) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, D), stone);
    edges(plate, BRASS, 0.6);
    g.add(plate);
    const core = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, FH - 0.07, D - 0.16), new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.2, metalness: 0.5 }));
    core.position.y = FH / 2;
    g.add(core);
    g.userData.base = f * FH;
    root.add(g);
    floors.push(g);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, D), stone);
  edges(roof, BRASS, 0.6);
  roof.userData.base = FLOORS * FH;
  root.add(roof);
  floors.push(roof);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  function placeWindows() {
    let k = 0;
    for (let f = 0; f < FLOORS; f++) {
      const y = floors[f].position.y + FH / 2;
      for (const [x, z, r] of perFloor) {
        q.setFromAxisAngle(up, r);
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
        windows.setMatrixAt(k++, m4);
      }
    }
    windows.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < winCount; i++) { lit[i] = Math.random() < 0.35 ? 1 : 0; windows.setColorAt(i, lit[i] ? cOn : cOff); }
  root.add(windows);

  // Pelare i hörnen
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, FLOORS * FH, 0.06), new THREE.MeshStandardMaterial({ color: 0xa88651, metalness: 0.8, roughness: 0.35 }));
    col.position.set(x * (W / 2 - 0.03), (FLOORS * FH) / 2, z * (D / 2 - 0.03));
    root.add(col);
  }

  scene.add(dust(small ? 100 : 200, 20));

  let nextFlip = 0;
  return {
    update(t, s) {
      const spread = ease(t / 2.5) * (0.04 + s.progress * 0.35);
      floors.forEach((g, i) => {
        const rise = ease((t - i * 0.08) / 1.2);
        g.position.y = g.userData.base * (1 + spread) + (1 - rise) * -0.6;
        g.visible = rise > 0.01;
      });
      placeWindows();
      if (t > nextFlip) {
        for (let n = 0; n < 4; n++) {
          const i = Math.floor(Math.random() * winCount);
          lit[i] ^= 1;
          windows.setColorAt(i, lit[i] ? cOn : cOff);
        }
        windows.instanceColor.needsUpdate = true;
        nextFlip = t + 0.35;
      }
      root.rotation.y = lerp(root.rotation.y, -0.35 + t * 0.035 + s.px * 0.3, 0.05);
      camera.position.y = lerp(camera.position.y, 5.2 - s.py * 0.8, 0.05);
      camera.lookAt(target);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Stomme: byggnad som monteras del för del                           */
/* ------------------------------------------------------------------ */
function frame({ scene, camera, small }) {
  camera.position.set(9, 6.2, 10);
  const target = new THREE.Vector3(0, 1.6, 0);
  const root = new THREE.Group();
  scene.add(root);
  scene.add(groundGrid(80, 80, 0.07));

  const steel = new THREE.MeshStandardMaterial({ color: 0x343a43, roughness: 0.45, metalness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa88651, roughness: 0.35, metalness: 0.8 });
  const timber = new THREE.MeshStandardMaterial({ color: 0xc8b08a, roughness: 0.85, metalness: 0 });
  const slabMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.7, metalness: 0.1 });

  const BX = 4, BZ = 3, BAY = 1.15, FL = 3, H = 1.1;
  const ox = (BX * BAY) / 2, oz = (BZ * BAY) / 2;
  const parts = [];
  let order = 0;
  const add = (mesh, delay) => { mesh.userData.home = mesh.position.clone(); mesh.userData.delay = delay; root.add(mesh); parts.push(mesh); };

  // Grundplatta
  const base = new THREE.Mesh(new THREE.BoxGeometry(BX * BAY + 0.5, 0.14, BZ * BAY + 0.5), slabMat);
  base.position.y = -0.07;
  edges(base, BRASS, 0.5);
  add(base, 0);

  for (let f = 0; f < FL; f++) {
    const y0 = f * H;
    for (let x = 0; x <= BX; x++) for (let z = 0; z <= BZ; z++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), f === FL - 1 ? timber : steel);
      post.position.set(x * BAY - ox, y0 + H / 2, z * BAY - oz);
      add(post, 0.4 + f * 1.4 + (order++ % 20) * 0.02);
    }
    for (let z = 0; z <= BZ; z++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(BX * BAY + 0.08, 0.09, 0.09), brass);
      beam.position.set(0, y0 + H, z * BAY - oz);
      add(beam, 0.9 + f * 1.4 + z * 0.06);
    }
    for (let x = 0; x <= BX; x++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, BZ * BAY + 0.08), brass);
      beam.position.set(x * BAY - ox, y0 + H, 0);
      add(beam, 1.1 + f * 1.4 + x * 0.05);
    }
    if (f < FL - 1) {
      // Bjälklag fylls i delvis
      for (let x = 0; x < BX; x++) for (let z = 0; z < BZ; z++) {
        if ((x + z + f) % 3 === 0) continue;
        const s = new THREE.Mesh(new THREE.BoxGeometry(BAY - 0.04, 0.05, BAY - 0.04), slabMat);
        s.position.set(x * BAY - ox + BAY / 2, y0 + H + 0.07, z * BAY - oz + BAY / 2);
        edges(s, BRASS, 0.25);
        add(s, 1.3 + f * 1.4 + (x + z) * 0.04);
      }
    }
  }
  // Diagonalt stag
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, Math.hypot(BAY, H), 0.05), brass);
  brace.position.set(-ox + BAY / 2, H / 2, -oz);
  brace.rotation.z = Math.atan2(BAY, H);
  add(brace, 1.6);

  scene.add(dust(small ? 100 : 220, 22));

  return {
    update(t, s) {
      for (const p of parts) {
        const k = ease((t - p.userData.delay) / 0.7);
        p.visible = k > 0.001;
        p.position.y = p.userData.home.y + (1 - k) * 2.2;
        p.scale.setScalar(0.6 + k * 0.4);
      }
      root.rotation.y = lerp(root.rotation.y, -0.4 + t * 0.03 + s.px * 0.3, 0.05);
      camera.position.y = lerp(camera.position.y, 6.2 - s.py * 0.8 + s.progress * 1.8, 0.05);
      camera.lookAt(target);
    },
    still: 8,
  };
}

/* ------------------------------------------------------------------ */
/* Terräng: lugn yta av punkter (undersidor och avslutningsband)       */
/* ------------------------------------------------------------------ */
function terrain({ scene, camera, small }) {
  camera.position.set(0, 2.4, 9);
  scene.fog = null;
  const seg = small ? 110 : 180;
  const geo = new THREE.PlaneGeometry(44, 28, seg, Math.round(seg * 0.62));
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(STEEL) },
      uB: { value: new THREE.Color(BRASS) },
      uPx: { value: 0 },
      uSize: { value: (small ? 2.2 : 2.6) * Math.min(window.devicePixelRatio, 1.75) },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPx; uniform float uSize;
      varying float vH; varying float vD;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.35 + uTime * 0.35) * 0.45
                + sin(p.z * 0.5 - uTime * 0.25 + p.x * 0.12) * 0.35
                + sin((p.x + p.z) * 0.9 + uTime * 0.6) * 0.08
                + uPx * sin(p.z * 0.3) * 0.2;
        p.y += w;
        vH = w;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vD = -mv.z;
        gl_PointSize = uSize * (8.0 / vD);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform vec3 uB;
      varying float vH; varying float vD;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        float k = smoothstep(0.25, 0.75, vH);
        vec3 col = mix(uA, uB, k);
        float fade = smoothstep(20.0, 5.0, vD) * smoothstep(1.0, 3.0, vD);
        gl_FragColor = vec4(col, (0.3 + k * 0.6) * fade);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.z = -6;
  scene.add(pts);

  return {
    update(t, s) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uPx.value = lerp(mat.uniforms.uPx.value, s.px, 0.05);
      camera.position.y = lerp(camera.position.y, 2.4 - s.py * 0.4 + s.progress * 0.8, 0.05);
      camera.lookAt(0, 0, -4);
    },
    layout: { x: 0, y: 0 },
  };
}

const VARIANTS = { koncern, network, building, frame, terrain };

/* ------------------------------------------------------------------ */

export function mount(el, { reduceMotion = false } = {}) {
  const build = VARIANTS[el.dataset.scene] || terrain;
  const small = window.innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);
  el.classList.add('scene-fade');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 16, 38);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xc9d2dc, INK, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.set(6, 9, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(STEEL, 1.4);
  rim.position.set(-7, 3, -6);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  const api = build({ scene, camera, small });

  // Etiketter som följer 3D-punkter (endast hero på startsidan)
  const labels = [...el.parentElement.querySelectorAll('[data-anchor]')];
  const v = new THREE.Vector3();

  // Placera motivet till höger på breda skärmar, upptill på smala
  const offset = api.layout || { x: 0.2, y: 0 };
  const sizeEl = el;
  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, sizeEl.clientWidth);
    H = Math.max(1, sizeEl.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 1.1 ? 44 : 32;
    if (el.dataset.offset === 'none') camera.clearViewOffset();
    else if (W / H > 1.1) camera.setViewOffset(W, H, -W * offset.x, H * offset.y, W, H);
    else camera.setViewOffset(W, H, 0, H * 0.16, W, H);
    camera.updateProjectionMatrix();
    if (reduceMotion) renderFrame(api.still ?? 6);
  }

  const state = { px: 0, py: 0, progress: 0 };
  function renderFrame(t) {
    state.px = lerp(state.px, reduceMotion ? 0 : pointer.x, 0.06);
    state.py = lerp(state.py, reduceMotion ? 0 : pointer.y, 0.06);
    const r = el.getBoundingClientRect();
    state.progress = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
    api.update(t, state);
    renderer.render(scene, camera);
    if (labels.length && api.anchors) {
      const pts = api.anchors();
      labels.forEach((lab, i) => {
        const p = pts[+lab.dataset.anchor];
        if (!p) return;
        v.copy(p).project(camera);
        lab.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
        lab.classList.toggle('is-on', t > 2.2 + i * 0.3);
      });
    }
  }

  new ResizeObserver(resize).observe(sizeEl);
  resize();

  if (reduceMotion) {
    renderFrame(api.still ?? 6);
    el.classList.add('is-ready');
    return;
  }

  let running = false;
  let raf = 0;
  const clock = new THREE.Clock();
  let elapsed = 0;
  function loop() {
    elapsed += Math.min(clock.getDelta(), 0.05);
    renderFrame(elapsed);
    raf = requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; clock.getDelta(); loop(); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
  });
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { running = false; cancelAnimationFrame(raf); }
    else if (!document.hidden) { io.unobserve(el); io.observe(el); }
  });
  requestAnimationFrame(() => el.classList.add('is-ready'));
}
