/* ============================================================
   scene3d.js — Three.js 3D office world
   workstations · PM cabin · conference room · pantry · lobby
   ============================================================ */

const loadingEl = document.getElementById("stageLoading");

try {
  if (typeof THREE === "undefined") throw new Error("THREE not loaded");
  init(THREE);
} catch (err) {
  console.error("3D init failed:", err);
  if (loadingEl) loadingEl.querySelector("p").textContent =
    "3D engine load nahi hua 😕 — UI phir bhi kaam karega.";
}

function init(THREE) {

  /* ---------------- constants ---------------- */
  const WALK_SPEED = 2.2;
  const SKIN  = [0xf0c8a0, 0xe0b08a, 0xc99a72, 0x9a6b4f, 0xf7d7b8];
  const HAIR  = [0x3b2a20, 0x1a1512, 0x6b4a2a, 0xa8763e, 0xd8c890, 0x8b8f98, 0x9a4a3a];
  const SHIRT = [0x6b8cae, 0xc97b7b, 0x7ba889, 0xd4a96a, 0x8f86b8, 0xc98a68, 0x6ea3a3, 0xb5829c];
  const PANTS = [0x4a5568, 0x3f4a5c, 0x5d5548, 0x505050, 0x445];
  const INK = 0x3a3f4b;

  /* ---- chat generator: random combos, no fixed lines ---- */
  const C_EMOJI = ["\u{1F604}","\u{1F389}","\u{1F525}","\u2615","\u{1F605}","\u{1F929}","\u{1F64C}","\u{1F4AF}","\u{1F680}","\u{1F60E}","\u{1F355}","\u{1F3CF}","\u{1F327}","\u{1F408}","\u{1F3B5}","\u2728","\u{1F973}","\u{1F44F}","\u{1F60D}","\u{1F923}","\u{1F308}","\u{1F369}","\u{1F3AE}","\u{1F4F8}","\u{1F9D8}"];
  const C_TOPIC = ["deployment","client demo","weekend plan","presentation","nayi movie","roadmap","design review","chai break","cricket match","salary day","team outing","naya restaurant","standup","promotion news","coding contest","festival party","gym plan","startup idea","holiday trip","birthday cake","music playlist","new phone","pet video","WFH setup","food truck","stock market","college days","new gadget","book club","traffic hack"];
  const C_OPEN  = ["Arre suno","Guess what","Ek baar batao","Yaar dekho","Sach me","Breaking news","Fun fact","Secret batata hoon","Kal yaad hai","Sunte ho"];
  const C_VERB  = ["bahut mast tha","ekdum awesome hai","bilkul killer hai","superb ho gaya","lit ho gaya hai","maza aa gaya","best decision tha","full paisa vasool","next level hai","too good hai","dil khush kar diya","ek number hai"];
  const C_ASK   = ["kab kar rahe hain","tum bhi chalo na","excited ho kya","plan set hai","milega kya invite","sath chaloge","kaisa laga tumhe","pakka na","sune ho kya","ready ho"];
  const C_REACT = ["Sahi hai","Waah","Maza aayega","Let us go","Totally agree","Best yaar","Count me in","Love it","Done deal","OMG yes","So proud of you","Arre wah","Kya baat hai","Ekdum sahi"];
  const r = a => a[Math.floor(Math.random() * a.length)];
  const E = () => r(C_EMOJI);
  function chatLine(a, b) {
    const nm = b ? b.emp.name.split(" ")[0] : "yaar";
    switch (Math.floor(Math.random() * 8)) {
      case 0: return `${r(C_OPEN)}, ${r(C_TOPIC)} ${r(C_VERB)} ${E()}`;
      case 1: return `${r(C_TOPIC)} ${r(C_ASK)}? ${E()}`;
      case 2: return `${nm}, ${r(C_TOPIC)} ke liye - ${r(C_REACT)}! ${E()}`;
      case 3: return `${r(C_REACT)}! ${r(C_TOPIC)} ${r(C_VERB)} ${E()}`;
      case 4: return `${nm} ne suna? ${r(C_TOPIC)} ka update aaya ${E()}`;
      case 5: return `Aaj ${r(C_TOPIC)} pe baat karte hain ${E()}`;
      case 6: return `${r(C_OPEN)} - ${r(C_TOPIC)}! ${r(C_REACT)} ${E()}`;
      default:return `${nm}, sach me ${r(C_TOPIC)} ${r(C_VERB)} ${E()}`;
    }
  }
  const M_TOPIC = ["quarterly growth","sprint velocity","new feature","customer feedback","release timeline","team hiring","budget plan","product roadmap","user retention","launch prep","design system","infra cost"];
  const M_VERB  = ["improving hai","on track hai","thoda tight hai","better than expected","next milestone hai","solid dikhta hai","review pending hai","green signal mila","double ho gaya","super promising hai"];
  function meetLine() {
    const e = r(["\u{1F4CA}","\u{1F3AF}","\u{1F4A1}","\u{1F4C8}","\u{1F4DD}","\u{1F91D}","\u23F0","\u{1F680}","\u2705","\u{1F64B}"]);
    switch (Math.floor(Math.random() * 4)) {
      case 0: return `${e} ${r(M_TOPIC)} ${r(M_VERB)}!`;
      case 1: return `${e} ${r(M_TOPIC)} pe discuss karein?`;
      case 2: return `${e} Good news - ${r(M_TOPIC)} ${r(M_VERB)}`;
      default:return `${e} Action item: ${r(M_TOPIC)} - sab agree?`;
    }
  }

  const seeded = str => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const pick = (arr, seed, salt = 0) => arr[(seed + salt) % arr.length];
  const rand = (a, b) => a + Math.random() * (b - a);
  const M = (color, o = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...o });

  /* ================= RENDERER / SCENE ================= */
  const stage = document.getElementById("stage");
  const overlay = document.getElementById("overlay");
  const canvas = document.getElementById("scene");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0f172a, 40, 80);

  const FRUSTUM = 6.9;
  const camera = new THREE.OrthographicCamera(-1, 1, FRUSTUM, -FRUSTUM, 0.1, 120);
  camera.position.set(0, 12, 15);
  camera.lookAt(0, 0, -0.9);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const sun = new THREE.DirectionalLight(0xfff4dd, 1.0);
  sun.position.set(8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;   sun.shadow.camera.bottom = -16;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfe0ff, 0.3);
  fill.position.set(-10, 8, -6);
  scene.add(fill);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = -FRUSTUM * aspect;
    camera.right = FRUSTUM * aspect;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  /* ================= FLOOR PLAN =================
     x: -12..12, z: -7..7
     [left]   workstations 8 desks (2x4)
     [right-back] PM glass cabin
     [right]    conference room (meeting)
     [right-front] pantry (cooler + coffee)
     [center-front] lobby rug + couch
     [left-front]  door
  ================================================== */
  const FW = 24, FD = 14, WALL_Z = -FD / 2;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.2, FD), M(0xe3cfa9));
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  for (let z = -5.6; z <= 6.5; z += 1.1) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.005, 0.03), M(0xd4bd96));
    l.position.set(0, 0.003, z);
    scene.add(l);
  }

  /* walls: back + left (dollhouse) */
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(FW, 3.4, 0.25), M(0xeae4da));
  backWall.position.set(0, 1.7, WALL_Z - 0.12);
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, FD), M(0xe3dcd2));
  leftWall.position.set(-FW / 2 - 0.12, 1.7, 0);
  scene.add(leftWall);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.28, 0.06), M(0xffffff));
  skirt.position.set(0, 0.14, WALL_Z + 0.02);
  scene.add(skirt);

  /* door on left wall */
  const DOOR = new THREE.Vector3(-10.6, 0, 5.2);
  {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 1.3), M(0x9a6a4a));
    d.position.set(-FW / 2 + 0.02, 1.1, 5.2);
    scene.add(d);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), M(0xd9b166));
    knob.position.set(-FW / 2 + 0.12, 1.05, 5.55);
    scene.add(knob);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.9), M(0x8f9aa8));
    mat.position.set(-10.6, 0.02, 5.2);
    scene.add(mat);
  }

  /* windows on back wall */
  function windowProp(x) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xd6ecf7 })));
    const sunDot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20),
      new THREE.MeshBasicMaterial({ color: 0xf5c869 }));
    sunDot.position.set(0.7, 0.4, 0.01); g.add(sunDot);
    for (const [w, h, px, py] of [[2.5, 0.08, 0, 0.75], [2.5, 0.08, 0, -0.75], [0.08, 1.5, -1.22, 0], [0.08, 1.5, 1.22, 0], [2.5, 0.06, 0, 0], [0.06, 1.5, 0, 0]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), M(INK));
      f.position.set(px, py, 0.02); g.add(f);
    }
    g.position.set(x, 2, WALL_Z + 0.02);
    scene.add(g);
  }
  windowProp(-8); windowProp(-3.5);

  /* poster */
  {
    const p = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1, 1.25, 0.04), M(INK));
    p.add(fr);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), M(0xfaf7f0));
    inner.position.z = 0.03; p.add(inner);
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.16, 5), M(0xd9b166));
    star.position.set(0, 0.22, 0.05); p.add(star);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.1, 0.07, 0.02), M(0x8f9aa8));
      bar.position.set(0, -0.05 - i * 0.16, 0.05); p.add(bar);
    }
    p.position.set(-5.8, 2, WALL_Z + 0.03);
    p.rotation.z = 0.04;
    scene.add(p);
  }

  /* ---- workstation desk + laptop + chair ---- */
  const laptopScreens = [];
  function deskUnit(x, z, accent = 0x5e7f8d) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.09, 0.75), M(0xf2ede3));
    top.position.y = 0.78; top.castShadow = true; g.add(top);
    for (const [lx, lz] of [[-0.7, -0.28], [0.7, -0.28], [-0.7, 0.28], [0.7, 0.28]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.78, 0.09), M(0x8a6844));
      leg.position.set(lx, 0.39, lz); g.add(leg);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.32), M(0xd8d4ce));
    base.position.set(0, 0.845, 0.02); g.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.03), M(0x3a4450));
    lid.position.set(0, 0.97, -0.14); lid.rotation.x = -0.28; g.add(lid);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26),
      new THREE.MeshBasicMaterial({ color: 0x9fd9f2 }));
    screen.position.set(0, 0.97, -0.124); screen.rotation.x = -0.28;
    g.add(screen); laptopScreens.push(screen.material);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 12), M(0xc97b7b));
    mug.position.set(-0.55, 0.88, 0.1); mug.castShadow = true; g.add(mug);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.5), M(accent));
    seat.position.set(0, 0.44, -0.85); seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.07),
      M(new THREE.Color(accent).multiplyScalar(0.85).getHex()));
    back.position.set(0, 0.72, -1.1); back.castShadow = true; g.add(back);
    for (const [lx, lz] of [[-0.2, -1.03], [0.2, -1.03], [-0.2, -0.67], [0.2, -0.67]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), M(INK));
      l.position.set(lx, 0.22, lz); g.add(l);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  /* ---- workstations appear/disappear with employees ---- */
  const DESK_XS = [-9.6, -7.2, -4.8, -2.4, 0.0];
  const DESK_ZS = [-4.2, -1.4, 1.4];
  const deskMeshes = new Map();   // seatIdx -> {g, screen}
  const deskXZ = i => ({
    x: DESK_XS[i % DESK_XS.length],
    z: DESK_ZS[Math.floor(i / DESK_XS.length) % DESK_ZS.length],
  });
  function ensureDesk(i) {
    if (deskMeshes.has(i)) return;
    const { x, z } = deskXZ(i);
    const before = laptopScreens.length;
    const g = deskUnit(x, z);
    deskMeshes.set(i, { g, screen: laptopScreens[before] });
  }
  function removeDesk(i) {
    const d = deskMeshes.get(i);
    if (!d) return;
    scene.remove(d.g);
    const k = laptopScreens.indexOf(d.screen);
    if (k > -1) laptopScreens.splice(k, 1);
    deskMeshes.delete(i);
  }

  /* ---- PM cabin (glass, back-right) ---- */
  const CABIN = { desk: new THREE.Vector3(8.6, 0, -5.6), seat: new THREE.Vector3(8.6, 0, -6.45) };
  {
    deskUnit(CABIN.desk.x, CABIN.desk.z, 0xd9a441);
    /* glass walls: front (z=-4.2) and left (x=6.4) */
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe9ff, transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false });
    const g1 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), glassMat);
    g1.position.set(8.7, 1.3, -4.2); scene.add(g1);
    const g2 = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), glassMat);
    g2.rotation.y = Math.PI / 2; g2.position.set(6.4, 1.3, -5.6); scene.add(g2);
    /* frames */
    const fm = M(INK);
    for (const x of [6.4, 8.7, 11]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.6, 0.09), fm);
      post.position.set(x, 1.3, -4.2); scene.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.09, 0.09), fm);
    rail.position.set(8.7, 2.62, -4.2); scene.add(rail);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 2.9), fm);
    rail2.position.set(6.4, 2.62, -5.6); scene.add(rail2);
    /* name plate on glass */
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.05), M(0xffd166));
    plate.position.set(9.8, 2.3, -4.2); scene.add(plate);
    /* plant inside cabin */
    plantProp(7, -6.3);
  }

  /* ---- conference room (right-middle) ---- */
  const CONF = { x: 7.6, z: -0.4 };
  {
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.03, 40), M(0xd9cfc0));
    rug.scale.z = 0.72;
    rug.position.set(CONF.x, 0.02, CONF.z);
    rug.receiveShadow = true; scene.add(rug);

    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 28), M(0xf2ede3));
    table.scale.z = 0.62;
    table.position.set(CONF.x, 0.74, CONF.z);
    table.castShadow = true; scene.add(table);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.74, 12), M(0x8a6844));
    pole.position.set(CONF.x, 0.37, CONF.z); scene.add(pole);
    /* chairs around for looks */
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.45), M(0x5e7f8d));
      ch.position.set(CONF.x + Math.cos(a) * 2.15, 0.25, CONF.z + Math.sin(a) * 1.6);
      ch.rotation.y = -a;
      ch.castShadow = true; scene.add(ch);
    }
    /* easel whiteboard */
    const board = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.07), M(0xffffff));
    panel.position.y = 1.5; board.add(panel);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.55, 0.05), M(INK));
    fr.position.set(0, 1.5, -0.04); board.add(fr);
    [0x6b8cae, 0x7ba889, 0xc97b7b].forEach((c, i) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28 + i * 0.2, 0.03), M(c));
      bar.position.set(-0.55 + i * 0.5, 1.1 + (0.28 + i * 0.2) / 2, 0.06);
      board.add(bar);
    });
    for (const s of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), M(INK));
      leg.position.set(s, 0.45, -0.15); leg.rotation.x = 0.25;
      board.add(leg);
    }
    board.position.set(CONF.x, 0, CONF.z - 2.6);
    scene.add(board);
  }
  const pmSpot = new THREE.Vector3(CONF.x, 0, CONF.z - 2.1);
  const meetSpot = (i, n) => {
    const a = 0.5 + (i / Math.max(n - 1, 1)) * (Math.PI - 1); // southern arc
    return new THREE.Vector3(CONF.x + Math.cos(a) * 2.5, 0, CONF.z + Math.sin(a) * 1.9);
  };

  /* ---- pantry (front-right) ---- */
  const COOLER = new THREE.Vector3(10.6, 0, 4.2);
  const COFFEE = new THREE.Vector3(8.2, 0, 5.4);
  {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 0.8), M(0xdcc9a8));
    counter.position.set(8.6, 0.43, 6.2); counter.castShadow = true; scene.add(counter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.07, 0.9), M(0xfaf7f0));
    counterTop.position.set(8.6, 0.89, 6.2); scene.add(counterTop);
    /* coffee machine */
    const cm = new THREE.Group();
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.45), M(0x3a4450));
    cbody.position.y = 0.28; cbody.castShadow = true; cm.add(cbody);
    const cglow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x9fd9f2 }));
    cglow.position.set(0, 0.32, 0.23); cm.add(cglow);
    cm.position.set(7.4, 0.93, 6.15); scene.add(cm);
    /* water cooler */
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.95, 14), M(0xedeef0));
    body.position.set(COOLER.x, 0.48, COOLER.z); body.castShadow = true; scene.add(body);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 14),
      new THREE.MeshStandardMaterial({ color: 0xa8d4e8, transparent: true, opacity: 0.7, roughness: 0.2 }));
    bottle.position.set(COOLER.x, 1.16, COOLER.z); scene.add(bottle);
    /* stools */
    for (const sx of [9.3, 10.3]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14), M(0x8f9aa8));
      st.position.set(sx, 0.55, 5.3); st.castShadow = true; scene.add(st);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), M(INK));
      leg.position.set(sx, 0.27, 5.3); scene.add(leg);
    }
  }

  /* ---- lobby (front-center) ---- */
  {
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.03, 40), M(0xcfd8d4));
    rug.scale.z = 0.55;
    rug.position.set(-1.8, 0.02, 4.0);
    rug.receiveShadow = true; scene.add(rug);
    /* couch */
    const couch = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.9), M(0x6b8f8a));
    base.position.y = 0.28; base.castShadow = true; couch.add(base);
    const cback = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.25), M(0x5c7f7a));
    cback.position.set(0, 0.68, 0.35); couch.add(cback);
    for (const s of [-1.15, 1.15]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.9), M(0x5c7f7a));
      arm.position.set(s, 0.55, 0); couch.add(arm);
    }
    /* cushions */
    for (const s of [-0.6, 0.6]) {
      const cu = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.7), M(0xe3d5bd));
      cu.position.set(s, 0.56, -0.05); couch.add(cu);
    }
    couch.position.set(-1.8, 0, 4.9);
    couch.rotation.y = Math.PI;   // face north toward desks
    scene.add(couch);
  }

  function plantProp(x, z) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.3, 12), M(0xb57a5e));
    pot.position.y = 0.15; pot.castShadow = true; g.add(pot);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), M(0x4d8f5f));
      leaf.position.set(rand(-0.14, 0.14), 0.42 + i * 0.12, rand(-0.14, 0.14));
      leaf.scale.y = 1.3; leaf.castShadow = true; g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  plantProp(-11.2, -6.2); plantProp(11.2, -6.2);
  plantProp(-11.2, 6.4); plantProp(3.2, 5.8);

  /* ================= ECO CORNER ================= */
  /* ⛲ fountain with animated water drops */
  const fountainDrops = [];
  {
    const g = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.28, 20), M(0xd9d3e8));
    basin.position.y = 0.14; basin.castShadow = true; g.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.8, roughness: 0.15 }));
    water.position.y = 0.27; g.add(water);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.5, 12), M(0xcac2dd));
    pillar.position.y = 0.5; g.add(pillar);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.1, 14), M(0xd9d3e8));
    bowl.position.y = 0.78; g.add(bowl);
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x9fdfff }));
      g.add(d);
      fountainDrops.push({ m: d, a: (i / 10) * Math.PI * 2, ph: i * 0.13 });
    }
    g.position.set(-6.8, 0, 4.9);
    scene.add(g);
  }

  /*  office cat wandering around */
  const CAT_SPOTS = [
    new THREE.Vector3(-4.5, 0, 3.0), new THREE.Vector3(-8, 0, 2.4),
    new THREE.Vector3(0.5, 0, 4.4),  new THREE.Vector3(4.5, 0, 4.8),
    new THREE.Vector3(9, 0, 4.4),    new THREE.Vector3(1.8, 0, 2.2),
    new THREE.Vector3(-5, 0, -2.8),  new THREE.Vector3(-1.5, 0, -2.8),
    new THREE.Vector3(-9, 0, 5.6),   new THREE.Vector3(-6.8, 0, 5.6),
  ];
  const catG = new THREE.Group();
  let catTail;
  {
    const catMat = M(0xb0a89e);          // tabby gray
    const stripeMat = M(0x7d7468);
    const cbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 4, 10), catMat);
    cbody.rotation.x = Math.PI / 2; cbody.position.y = 0.24; cbody.castShadow = true;
    catG.add(cbody);
    /* tabby stripes */
    for (const sz of [-0.12, 0, 0.12]) {
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 6, 12), stripeMat);
      st.position.set(0, 0.24, sz); catG.add(st);
    }
    const chead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), catMat);
    chead.position.set(0, 0.38, 0.32); catG.add(chead);
    for (const ex of [-0.09, 0.09]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 6), catMat);
      ear.position.set(ex, 0.52, 0.3); catG.add(ear);
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x2f6b3a });   // green cat eyes
    for (const ex of [-0.06, 0.06]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeM);
      e.position.set(ex, 0.4, 0.45); catG.add(e);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.03, 6), M(0xc97b7b));
    nose.rotation.x = Math.PI; nose.position.set(0, 0.34, 0.47); catG.add(nose);
    catTail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), catMat);
    catTail.position.set(0, 0.36, -0.28); catTail.rotation.x = -0.9;
    catG.add(catTail);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), stripeMat);
    tailTip.position.set(0, 0.34, 0); catTail.add(tailTip);
    for (const [lx, lz] of [[-0.09, 0.16], [0.09, 0.16], [-0.09, -0.16], [0.09, -0.16]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), catMat);
      leg.position.set(lx, 0.08, lz); catG.add(leg);
    }
    catG.scale.setScalar(1.35);
    catG.position.set(-4, 0, 4.5);
    scene.add(catG);
  }
  const catBubble = document.createElement("div");
  catBubble.className = "bubble"; catBubble.hidden = true;
  overlay.appendChild(catBubble);
  const catSay = (txt, ms = 1500) => {
    catBubble.textContent = txt; catBubble.hidden = false;
    clearTimeout(catBubble._t);
    catBubble._t = setTimeout(() => (catBubble.hidden = true), ms);
  };
  let catWait = 1.5, catTarget = null;
  function updateCat(dt, t) {
    catTail.rotation.x = -0.9 + Math.sin(t * 6) * 0.3;   // tail wag
    if (catWait > 0) { catWait -= dt; catG.position.y = 0; return; }
    if (!catTarget)
      catTarget = CAT_SPOTS[Math.floor(Math.random() * CAT_SPOTS.length)];
    const p = catG.position;
    const dx = catTarget.x - p.x, dz = catTarget.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.18) {
      catTarget = null; catWait = rand(1.5, 5);
      if (Math.random() < 0.35) catSay("meow! 🐾");
      return;
    }
    p.x += (dx / dist) * 0.9 * dt;
    p.z += (dz / dist) * 0.9 * dt;
    catG.rotation.y = Math.atan2(dx, dz);
    catG.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
  }

  /* 💡 pendant lamps swaying gently */
  const lamps = [];
  for (const [lx, lz] of [[-6, -2.8], [-2.4, -0.2], [7.6, -0.4], [8.6, 4.5]]) {
    const lamp = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), M(INK));
    cord.position.y = -0.8; lamp.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.35, 16, 1, true),
      M(0xffd166, { side: THREE.DoubleSide }));
    shade.position.y = -1.62; lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    bulb.position.y = -1.75; lamp.add(bulb);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0.15 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = -4.97;
    lamp.add(pool);
    lamp.position.set(lx, 5, lz);
    scene.add(lamp);
    lamps.push({ g: lamp, ph: rand(0, 6) });
  }

  /* chat + wander destinations in open areas */
  const CHAT_SPOTS = [
    new THREE.Vector3(-5.5, 0, 2.6), new THREE.Vector3(-2.8, 0, 3.0),
    new THREE.Vector3(0.2, 0, 2.6),  new THREE.Vector3(2.6, 0, 4.4),
    new THREE.Vector3(-8.5, 0, 3.2),
  ];
  const WANDER_SPOTS = [
    COOLER.clone().add(new THREE.Vector3(-0.7, 0, 0.7)),
    COFFEE.clone().add(new THREE.Vector3(0.4, 0, -0.8)),
    new THREE.Vector3(-7.8, 0, -5.6),   // window gazing
    new THREE.Vector3(-1.8, 0, 4.0),    // lobby rug
  ];

  /* ================= CHARACTER ================= */
  function buildCharacter(emp) {
    const s = seeded(emp.id);
    const skin = pick(SKIN, s), hairC = pick(HAIR, s, 3);
    const shirt = pick(SHIRT, s, 7), pants = pick(PANTS, s, 5);

    const g = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.42;
    g.add(hips);

    const legGeo = new THREE.CapsuleGeometry(0.075, 0.28, 4, 10);
    const legPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.11, -0.05, 0);
      const leg = new THREE.Mesh(legGeo, M(pants));
      leg.position.y = -0.2; leg.castShadow = true;
      pivot.add(leg); hips.add(pivot); legPivots.push(pivot);
    }

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.34, 6, 14), M(shirt));
    body.position.y = 0.42; body.castShadow = true;
    hips.add(body);

    const armGeo = new THREE.CapsuleGeometry(0.07, 0.3, 4, 10);
    const armPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.3, 0.62, 0);
      const arm = new THREE.Mesh(armGeo, M(shirt));
      arm.position.y = -0.16; arm.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), M(skin));
      hand.position.y = -0.34;
      pivot.add(arm, hand); hips.add(pivot); armPivots.push(pivot);
    }

    const headG = new THREE.Group();
    headG.position.y = 1.02;
    hips.add(headG);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 18), M(skin));
    head.castShadow = true; headG.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const eyeM = new THREE.MeshBasicMaterial({ color: INK });
    const eyeL = new THREE.Mesh(eyeGeo, eyeM), eyeR = new THREE.Mesh(eyeGeo, eyeM);
    eyeL.position.set(-0.1, 0.03, 0.235);
    eyeR.position.set(0.1, 0.03, 0.235);
    headG.add(eyeL, eyeR);

    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 14, Math.PI * 0.7),
      new THREE.MeshBasicMaterial({ color: INK }));
    smile.position.set(0, -0.06, 0.235);
    smile.rotation.z = Math.PI * 1.15;
    smile.rotation.x = 0.15;
    headG.add(smile);

    const hairMat = M(hairC);
    if (emp.gender === "male") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
      cap.position.y = 0.05; headG.add(cap);
    } else if (emp.gender === "female") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
      cap.position.set(0, 0.04, -0.03); headG.add(cap);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
      bun.position.set(0, 0.26, -0.16); headG.add(bun);
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), M(pick(SHIRT, s, 11)));
      tie.position.set(0, 0.26, -0.05); headG.add(tie);
    } else {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
      cap.position.y = 0.05; headG.add(cap);
      const mohawk = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.44), hairMat);
      mohawk.position.y = 0.28; mohawk.rotation.x = -0.15; headG.add(mohawk);
    }
    if (s % 4 === 0) {
      const gm = new THREE.MeshBasicMaterial({ color: INK });
      for (const gx of [-0.1, 0.1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 16), gm);
        ring.position.set(gx, 0.03, 0.24); headG.add(ring);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), gm);
      bridge.position.set(0, 0.03, 0.25); headG.add(bridge);
    }

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.85;
    g.add(hit);
    scene.add(g);
    return { group: g, hips, headG, eyes: [eyeL, eyeR], legPivots, armPivots, hit };
  }

  /* ================= AGENTS ================= */
  const agents = new Map();

  const COUCH_FACE = new THREE.Vector3(-1.8, 0, 1.0);
  const COUCH_SEATS = [
    new THREE.Vector3(-2.35, 0, 4.72),
    new THREE.Vector3(-1.25, 0, 4.72),
  ];
  function seatOf(emp, agent) {
    if (emp.seat === "cabin") return CABIN;
    if (emp.seat === "couch0" || emp.seat === "couch1")
      return { seat: COUCH_SEATS[emp.seat === "couch0" ? 0 : 1], desk: COUCH_FACE };
    if (emp.seat === "float")
      return { seat: agent.floatSpot,
               desk: new THREE.Vector3(agent.floatSpot.x, 0, agent.floatSpot.z - 3) };
    const { x, z } = deskXZ(emp.seat);
    return { desk: new THREE.Vector3(x, 0, z), seat: new THREE.Vector3(x, 0, z - 0.85) };
  }

  class Agent {
    constructor(emp) {
      this.emp = emp;
      this.parts = buildCharacter(emp);
      this.state = "walk";
      this.target = null;
      this.onArrive = null;
      this.partner = null;
      this.seated = false;
      this.blinkT = rand(1, 4);
      this.phase = rand(0, 10);

      this.parts.group.position.copy(DOOR);
      this.floatSpot = CHAT_SPOTS[Math.floor(rand(0, CHAT_SPOTS.length))].clone()
        .add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)));

      if (typeof emp.seat === "number") ensureDesk(emp.seat);
      if (emp.seat === "float") this.attachHeldLaptop();

      this.tag = document.createElement("div");
      this.tag.className = "tag";
      overlay.appendChild(this.tag);
      this.refreshTag();
      this.bubble = document.createElement("div");
      this.bubble.className = "bubble";
      this.bubble.hidden = true;
      overlay.appendChild(this.bubble);

      this.parts.hit.userData.agent = this;
      this.goTo(seatOf(emp, this).seat, () => this.startWork());
    }
    attachHeldLaptop() {   // hot-desker stands with a laptop in hand
      const lap = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.24), M(0xded9e8));
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.02), M(0x3d3560));
      l.position.set(0, 0.12, -0.11); l.rotation.x = -0.5;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x8fe3ff }));
      sc.position.set(0, 0.125, -0.105); sc.rotation.x = -0.5;
      lap.add(b, l, sc);
      lap.position.set(0, 0.52, 0.38);
      this.parts.hips.add(lap);
      this.lapScreen = sc.material;
      laptopScreens.push(sc.material);
    }
    refreshTag() {
      const pm = VO.isPM(this.emp) ? `<span class="pm-star">⭐</span>` : "";
      this.tag.innerHTML = `${pm}${esc(this.emp.name.split(" ")[0])}<span class="tag-role">${esc(this.emp.role)}</span>`;
    }
    goTo(v, cb) {
      this.state = "walk";
      this.seated = false;
      this.target = v.clone(); this.target.y = 0;
      this.onArrive = cb || null;
    }
    startWork() {
      this.state = "work";
      this.seated = this.emp.seat !== "float";
      this.face(seatOf(this.emp, this).desk);
    }
    face(v) {
      const p = this.parts.group.position;
      this.faceYaw = Math.atan2(v.x - p.x, v.z - p.z);
    }
    say(text, ms = 1600) {
      this.bubble.textContent = text;
      this.bubble.hidden = false;
      clearTimeout(this._bT);
      this._bT = setTimeout(() => (this.bubble.hidden = true), ms);
    }
    update(dt, t) {
      const g = this.parts.group, hips = this.parts.hips;
      const { legPivots, armPivots, headG, eyes } = this.parts;

      if (this.state === "walk" && this.target) {
        const p = g.position;
        const dx = this.target.x - p.x, dz = this.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.1) {
          this.target = null; this.state = "idle";
          const cb = this.onArrive; this.onArrive = null;
          cb && cb();
        } else {
          const step = Math.min(dist, WALK_SPEED * dt);
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
          this.faceYaw = Math.atan2(dx, dz);
          const w = t * 11 + this.phase;
          g.position.y = Math.abs(Math.sin(w)) * 0.07;
          hips.rotation.z = 0;
          armPivots[0].rotation.z = armPivots[1].rotation.z = 0;
          legPivots[0].rotation.x = Math.sin(w) * 0.7;
          legPivots[1].rotation.x = -Math.sin(w) * 0.7;
          armPivots[0].rotation.x = -Math.sin(w) * 0.5;
          armPivots[1].rotation.x = Math.sin(w) * 0.5;
          hips.position.y = 0.42;
        }
      } else {
        g.position.y = 0;
        hips.rotation.z = 0;
        armPivots[0].rotation.z = armPivots[1].rotation.z = 0;
        if (this.seated) {
          hips.position.y = 0.24;
          legPivots[0].rotation.x = legPivots[1].rotation.x = -1.35;
          const ty = t * 14 + this.phase;
          armPivots[0].rotation.x = -1.15 + Math.sin(ty) * 0.1;
          armPivots[1].rotation.x = -1.15 + Math.cos(ty * 1.1) * 0.1;
          headG.rotation.z = Math.sin(t * 1.4 + this.phase) * 0.06;
          headG.position.y = 1.02 + Math.sin(t * 2.2 + this.phase) * 0.012;
        } else if (this.state === "work") {
          /* hot-desker: standing with laptop, typing */
          hips.position.y = 0.42 + Math.sin(t * 2 + this.phase) * 0.012;
          legPivots[0].rotation.x = legPivots[1].rotation.x = 0;
          const ty = t * 13 + this.phase;
          armPivots[0].rotation.x = -0.95 + Math.sin(ty) * 0.08;
          armPivots[1].rotation.x = -0.95 + Math.cos(ty * 1.1) * 0.08;
          headG.rotation.x = 0.22;
          headG.rotation.z = Math.sin(t * 1.3 + this.phase) * 0.05;
        } else if (this.state === "dance") {
          /* party time — bounce, arms up, sway */
          const w = t * 7 + this.phase;
          g.position.y = Math.abs(Math.sin(w)) * 0.26;
          hips.position.y = 0.42;
          hips.rotation.z = Math.sin(w * 0.5) * 0.14;
          legPivots[0].rotation.x = Math.sin(w) * 0.5;
          legPivots[1].rotation.x = -Math.sin(w) * 0.5;
          armPivots[0].rotation.x = -2.6 + Math.sin(w) * 0.5;
          armPivots[1].rotation.x = -2.6 + Math.cos(w * 1.2) * 0.5;
          armPivots[0].rotation.z = 0.6 + Math.sin(w * 0.7) * 0.4;
          armPivots[1].rotation.z = -0.6 - Math.cos(w * 0.8) * 0.4;
          this.faceYaw = Math.sin(t * 0.9 + this.phase) * 2.2;
          headG.rotation.x = Math.sin(w * 0.5) * 0.15;
        } else {
          hips.position.y = 0.42 + Math.sin(t * 2.4 + this.phase) * 0.015;
          legPivots[0].rotation.x = legPivots[1].rotation.x = 0;
          armPivots[0].rotation.x = Math.sin(t * 2 + this.phase) * 0.12;
          armPivots[1].rotation.x = -Math.sin(t * 2 + this.phase) * 0.12;
          headG.rotation.x = (this.state === "chat" || this.state === "meeting")
            ? Math.sin(t * 3 + this.phase) * 0.1 : 0;
          headG.rotation.z = 0;
        }
      }

      if (this.faceYaw !== undefined) {
        let d = this.faceYaw - g.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        g.rotation.y += d * Math.min(1, dt * 10);
      }

      /* glance toward a chat partner */
      headG.rotation.y += ((this.headYaw || 0) - headG.rotation.y) * Math.min(1, dt * 8);

      this.blinkT -= dt;
      if (this.blinkT < 0) this.blinkT = rand(2.2, 5);
      const es = this.blinkT < 0.12 ? 0.15 : 1;
      eyes[0].scale.y = eyes[1].scale.y = es;
    }
    dispose() {
      scene.remove(this.parts.group);
      this.tag.remove(); this.bubble.remove();
      clearTimeout(this._bT);
      this.dead = true;
    }
  }

  const esc = s => s.replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ================= BEHAVIOURS ================= */
  const workingAgents = () =>
    [...agents.values()].filter(a => a.state === "work" && !a.dead);
  const backToWork = ag => {
    if (ag.dead) return;
    ag.partner = null;
    ag.goTo(seatOf(ag.emp, ag).seat, () => ag.startWork());
  };

  /* random chit-chat — 3 styles:
     1. laptop se remote chat (Slack style, dono apne desk pe)
     2. desk visit (ek colleague ke workstation pe jaake baat)
     3. lobby walk (dono open area me milte hain) */
  let chatTimer = rand(4, 8);
  function tryStartChat() {
    const pool = workingAgents();
    if (pool.length < 2) return;
    const a = pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (a === b || a.chatting || b.chatting) return;
    const mode = Math.random();
    if (mode < 0.35) remoteChat(a, b);
    else if (mode < 0.72) deskVisit(a, b);
    else lobbyChat(a, b);
  }

  /* both stay seated and ping each other on laptop */
  function remoteChat(a, b) {
    a.chatting = b.chatting = true;
    runChatExchange(a, b, 0);
  }

  /* visitor walks over to host's workstation */
  function deskVisit(visitor, host) {
    const hp = seatOf(host.emp, host).seat;
    const spot = hp.clone().add(new THREE.Vector3(0.8, 0, 0.55));
    visitor.partner = host; host.partner = visitor;
    visitor.goTo(spot, () => {
      if (host.dead || visitor.dead) { endChat(visitor); return; }
      visitor.state = "chat";
      visitor.face(host.parts.group.position);
      host.headYaw = headYawToward(host, visitor);  // host glances sideways
      visitor.chatting = host.chatting = true;
      runChatExchange(visitor, host, 0);
    });
  }

  /* classic: both walk to an open spot */
  function lobbyChat(a, b) {
    const spot = CHAT_SPOTS[Math.floor(Math.random() * CHAT_SPOTS.length)];
    const off = new THREE.Vector3(0.55, 0, 0.1);
    a.partner = b; b.partner = a;
    a.goTo(spot.clone().sub(off), () => beginChat(a));
    b.goTo(spot.clone().add(off), () => beginChat(b));
  }
  function beginChat(ag) {
    const p = ag.partner;
    if (!p || p.dead) { backToWork(ag); return; }
    ag.state = "chat";
    ag.face(p.parts.group.position);
    if (p.state === "chat") {
      ag.chatting = p.chatting = true;
      runChatExchange(ag, p, 0);
    }
  }

  function headYawToward(host, guest) {
    const hp = host.parts.group.position, gp = guest.parts.group.position;
    let rel = Math.atan2(gp.x - hp.x, gp.z - hp.z) - (host.faceYaw || 0);
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return Math.max(-0.95, Math.min(0.95, rel));
  }

  function runChatExchange(a, b, n) {
    if (a.dead || b.dead || n >= 6 || !a.chatting || !b.chatting || meetingActive || partyActive) {
      endChat(a); endChat(b);
      return;
    }
    const speaker = n % 2 === 0 ? a : b;
    const listener = speaker === a ? b : a;
    speaker.say(chatLine(speaker, listener), 3200);
    setTimeout(() => runChatExchange(a, b, n + 1), rand(2600, 3400));
  }
  function endChat(x) {
    if (!x || x.dead) return;
    x.chatting = false; x.headYaw = 0; x.partner = null;
    if (x.state === "chat") backToWork(x);
  }

  /* solo wander: coffee / cooler / window / lobby */
  let wanderTimer = rand(9, 14);
  function tryWander() {
    const pool = workingAgents();
    if (!pool.length) return;
    const a = pool[Math.floor(Math.random() * pool.length)];
    const dest = WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)].clone();
    a.goTo(dest, () => {
      if (a.dead) return;
      a.state = "idle";
      a.face(new THREE.Vector3(0, 0, -4));
      if (dest.distanceTo(COOLER) < 2 || dest.distanceTo(COFFEE) < 2)
        a.say("☕", 2800);
      setTimeout(() => !a.dead && a.state === "idle" && backToWork(a), rand(2200, 3500));
    });
  }

  /* meeting in conference room */
  let meetingActive = false;
  const meetingBtn = document.getElementById("meetingBtn");
  addEventListener("vo:meeting", () => {
    if (meetingActive || partyActive) return;
    const all = [...agents.values()].filter(a => !a.dead);
    if (all.length < 2) { VO.toast("Need at least 2 people for a meeting 🙂"); return; }
    meetingActive = true;
    meetingBtn.disabled = true;
    meetingBtn.classList.add("ringing");

    const pm = all.find(a => VO.isPM(a.emp)) || all[0];
    const others = all.filter(a => a !== pm);
    VO.toast(`📣 ${pm.emp.name.split(" ")[0]} called a meeting — conference room!`);

    pm.partner = null;
    pm.say("Conference room, now! 📋", 3200);
    pm.goTo(pmSpot, () => { pm.state = "meeting"; pm.face(new THREE.Vector3(CONF.x, 0, CONF.z + 3)); });

    others.forEach((a, i) => {
      a.partner = null;
      a.goTo(meetSpot(i, others.length), () => {
        a.state = "meeting";
        a.face(new THREE.Vector3(CONF.x, 0, CONF.z - 2));
      });
    });

    setTimeout(() => {
      if (!meetingActive) return;
      let n = 0;
      const talk = () => {
        if (n++ >= 7 || !meetingActive) return;
        const pool = [pm, ...others].filter(x => !x.dead);
        const sp = pool[Math.floor(Math.random() * pool.length)];
        if (sp) sp.say(meetLine(), 3000);
        setTimeout(talk, rand(2200, 3000));
      };
      talk();
    }, 3800);

    setTimeout(() => {
      meetingActive = false;
      meetingBtn.disabled = false;
      meetingBtn.classList.remove("ringing");
      [...agents.values()].forEach(a => { if (a.state === "meeting") backToWork(a); });
      VO.toast("Meeting done — back to work! ✅");
    }, 16000);
  });

  /* ================= 🪩 PARTY MODE ================= */
  let partyActive = false;
  const partyBtn = document.getElementById("partyBtn");

  /* disco rig: mirror ball + 3 coloured moving lights + floor spots */
  const disco = new THREE.Group();
  const discoBall = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 1),
    new THREE.MeshStandardMaterial({ color: 0xd8dee8, metalness: 0.95, roughness: 0.15, flatShading: true }));
  discoBall.position.set(-1.5, 4.4, 3.2);
  disco.add(discoBall);
  const ballCord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), M(INK));
  ballCord.position.set(-1.5, 5.4, 3.2);
  disco.add(ballCord);

  const partyLights = [];
  const partyColors = [0xff2e88, 0x22d3ee, 0xa3e635];
  for (let i = 0; i < 3; i++) {
    const pl = new THREE.PointLight(partyColors[i], 0, 16, 1.6);
    disco.add(pl);
    partyLights.push(pl);
  }
  const danceSpots = [];
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(-6.5 + i * 2.1, 0.035, 3.4 + (i % 2) * 1.4);
    scene.add(spot);
    danceSpots.push(spot);
  }
  disco.visible = false;
  scene.add(disco);

  const DANCE_AREA = { x: -2.5, z: 3.6, rx: 4.5, rz: 1.7 };
  const danceSpot = i =>
    new THREE.Vector3(
      DANCE_AREA.x + rand(-DANCE_AREA.rx, DANCE_AREA.rx), 0,
      DANCE_AREA.z + rand(-DANCE_AREA.rz, DANCE_AREA.rz));

  addEventListener("vo:party", () => {
    if (meetingActive) { VO.toast("Meeting chal rahi hai — baad me party! 😅"); return; }
    partyActive ? stopParty() : startParty();
  });

  function startParty() {
    const all = [...agents.values()].filter(a => !a.dead);
    if (!all.length) { VO.toast("Pehle koi hire to karo! 🙂"); return; }
    partyActive = true;
    disco.visible = true;
    partyBtn.textContent = "🧑‍💻 Back to Work";
    partyBtn.classList.add("on");
    meetingBtn.disabled = true;

    /* dim the office, kill the chats */
    sun.intensity = 0.28;
    scene.children.forEach(o => { if (o.isAmbientLight) o.intensity = 0.3; });
    all.forEach(a => { a.chatting = false; a.partner = null; a.headYaw = 0; });

    VO.toast("🪩 Party time! Dance floor pe aao!");
    all.forEach((a, i) => {
      if (Math.random() < 0.3) a.say(r(["🎉","💃","🕺","🎵","🥳"]), 2200);
      a.goTo(danceSpot(i), () => { a.state = "dance"; });
    });
  }

  function stopParty() {
    partyActive = false;
    disco.visible = false;
    partyLights.forEach(pl => (pl.intensity = 0));
    danceSpots.forEach(s => (s.material.opacity = 0));
    partyBtn.textContent = "🪩 Party Mode";
    partyBtn.classList.remove("on");
    meetingBtn.disabled = false;
    sun.intensity = 1.0;
    scene.children.forEach(o => { if (o.isAmbientLight) o.intensity = 0.72; });
    [...agents.values()].forEach(a => { if (a.state === "dance") backToWork(a); });
    VO.toast("Party over — back to work! 💼");
  }

  /* ================= add / remove events ================= */
  addEventListener("vo:add", e => {
    const emp = e.detail;
    agents.set(emp.id, new Agent(emp));
    agents.forEach(a => a.refreshTag());
  });
  addEventListener("vo:remove", e => {
    const emp = e.detail;
    const a = agents.get(emp.id);
    if (!a) return;
    if (a.partner && !a.partner.dead) backToWork(a.partner);
    if (typeof emp.seat === "number") removeDesk(emp.seat);
    if (a.lapScreen) {
      const k = laptopScreens.indexOf(a.lapScreen);
      if (k > -1) laptopScreens.splice(k, 1);
    }
    a.dispose();
    agents.delete(emp.id);
    agents.forEach(x => x.refreshTag());
  });

  /* ================= labels projection ================= */
  const _v = new THREE.Vector3();
  const _feet = new THREE.Vector3();
  function projectLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const a of agents.values()) {
      /* speech bubble above head */
      a.parts.headG.getWorldPosition(_v);
      _v.y += 0.45;
      _v.project(camera);
      a.bubble.style.left = ((_v.x * 0.5 + 0.5) * w) + "px";
      a.bubble.style.top = ((-_v.y * 0.5 + 0.5) * h) + "px";
      /* name tag at the feet — face stays clear */
      _feet.copy(a.parts.group.position); _feet.y = 0.02;
      _feet.project(camera);
      a.tag.style.left = ((_feet.x * 0.5 + 0.5) * w) + "px";
      a.tag.style.top = ((-_feet.y * 0.5 + 0.5) * h + 14) + "px";
    }
    /* cat's meow bubble follows the cat */
    _v.copy(catG.position); _v.y = 0.85;
    _v.project(camera);
    catBubble.style.left = ((_v.x * 0.5 + 0.5) * w) + "px";
    catBubble.style.top = ((-_v.y * 0.5 + 0.5) * h) + "px";
  }

  /* ================= click → popover ================= */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...agents.values()].map(a => a.parts.hit));
    if (hits.length) VO.openPop(hits[0].object.userData.agent.emp, e.clientX, e.clientY);
    else VO.closePop();
  });
  document.addEventListener("click", e => {
    const pop = document.getElementById("deskPop");
    if (!pop.hidden && !pop.contains(e.target) && e.target !== canvas) VO.closePop();
  });

  /* ================= boot ================= */
  VO.employees.forEach(emp => agents.set(emp.id, new Agent(emp)));
  loadingEl.hidden = true;
  window.__officeReady = true;

  /* ================= loop ================= */
  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    agents.forEach(a => a.update(dt, t));

    if (!meetingActive && !partyActive) {
      chatTimer -= dt;
      if (chatTimer <= 0) { tryStartChat(); chatTimer = rand(6, 12); }
      wanderTimer -= dt;
      if (wanderTimer <= 0) { tryWander(); wanderTimer = rand(8, 15); }
    }

    /* 🪩 party visuals */
    if (partyActive) {
      discoBall.rotation.y += dt * 1.4;
      discoBall.rotation.x += dt * 0.3;
      partyLights.forEach((pl, i) => {
        const a = t * 1.5 + i * (Math.PI * 2 / 3);
        pl.position.set(
          DANCE_AREA.x + Math.cos(a) * 3.2,
          3.3 + Math.sin(t * 2 + i) * 0.5,
          DANCE_AREA.z + Math.sin(a) * 2.2);
        pl.intensity = 2.6;
        pl.color.setHSL((t * 0.18 + i / 3) % 1, 0.9, 0.55);
      });
      danceSpots.forEach((s, i) => {
        s.material.opacity = 0.13 + Math.abs(Math.sin(t * 4 + i * 1.1)) * 0.18;
        s.material.color.setHSL((t * 0.22 + i * 0.16) % 1, 0.8, 0.6);
      });
      if (Math.random() < dt * 1.1) {
        const dancers = [...agents.values()].filter(a => a.state === "dance");
        const d = dancers[Math.floor(Math.random() * dancers.length)];
        if (d) d.say(r(["🎵", "🎶", "💃", "🕺", "🎉"]), 1500);
      }
    }

    laptopScreens.forEach((m, i) => {
      const k = 0.75 + Math.sin(t * 2 + i * 1.7) * 0.25;
      m.color.setRGB(0.55 * k + 0.2, 0.89 * k + 0.05, 1);
    });

    /* ⛲ fountain droplets */
    for (const d of fountainDrops) {
      const prog = (t * 0.9 + d.ph) % 1;
      d.m.position.set(
        Math.cos(d.a) * (0.06 + prog * 0.5),
        0.82 + Math.sin(prog * Math.PI) * 0.3 - prog * 0.45,
        Math.sin(d.a) * (0.06 + prog * 0.5));
    }
    /*  cat + 💡 lamps */
    updateCat(dt, t);
    for (const l of lamps) {
      l.g.rotation.z = Math.sin(t * 0.9 + l.ph) * 0.05;
      l.g.rotation.x = Math.cos(t * 0.7 + l.ph) * 0.04;
    }

    /* camera stays fixed — office does not move with the mouse */

    projectLabels();
    renderer.render(scene, camera);
  })();
}
