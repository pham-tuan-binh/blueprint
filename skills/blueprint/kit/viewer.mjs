// three.js viewer, drawn as a technical illustration rather than a photo:
// an orthographic camera, every face flat-filled with one of
// four greys by the way it faces, thin dark outlines found from depth and normal
// edges, a paper background, and colour only as a code: yellow for the parts new in
// the step you are reading, red for the part you clicked (CODE in shop.mjs). setModel() rebuilds the geometry whenever the params change.
// Design coordinates (mm, z up) live inside one group rotated into three's y-up metres.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm';
import { memberCorners } from './joints.mjs';
import { prismAxes, printManifold } from './print.mjs';

// the matrix of each placement of a print (see print.mjs copies)
const placeMatrices = pr => [new THREE.Matrix4(), ...(pr.copies || []).map(c => {
  const ab = c.about || [0, 0, 0], mv = c.move || [0, 0, 0];
  return new THREE.Matrix4().makeTranslation(ab[0] + mv[0], ab[1] + mv[1], ab[2] + mv[2])
    .multiply(new THREE.Matrix4().makeRotationZ(((c.rotZ || 0) * Math.PI) / 180))
    .multiply(new THREE.Matrix4().makeTranslation(-ab[0], -ab[1], -ab[2]));
})];

// ---------------------------------------------------------------- printed parts
// The exact solid of a print (print.mjs printManifold) with manifold-3d, loaded only
// when a plan has prints. Until it arrives, the plain union of the solids stands in.
let manifoldLib = null;
export const loadManifold = () => (manifoldLib ||= import('https://cdn.jsdelivr.net/npm/manifold-3d@3.4.1/manifold.js').then(async m => { const M = await m.default(); M.setup(); return M; }));
export async function printSolid(part) { return printManifold(part, await loadManifold()); }
async function printGeometry(part) {
  const { pts, tris } = await printSolid(part), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  g.setIndex(new THREE.BufferAttribute(tris, 1));
  return g;
}
function solidGeo(sh) {
  if (sh.type === 'box') { const g = new THREE.BoxGeometry(...sh.s); g.translate(...sh.c); return g; }
  if (sh.type === 'cyl' || sh.type === 'tube') {
    const a = new THREE.Vector3(...sh.a), b = new THREE.Vector3(...sh.b), d = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(sh.r, sh.r, d.length(), 32);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate(...a.add(b).multiplyScalar(0.5).toArray());
    return g;
  }
  if (sh.type === 'prism') {
    const shape = new THREE.Shape(sh.pts.map(([u, v]) => new THREE.Vector2(u, v)));
    let g = new THREE.ExtrudeGeometry(shape, { depth: sh.h, bevelEnabled: false });
    if (g.index) g = g.toNonIndexed();
    g.translate(0, 0, sh.z0);
    const [iu, iv, iz] = prismAxes(sh.axis), pos = g.attributes.position, out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { out[i * 3 + iu] = pos.getX(i); out[i * 3 + iv] = pos.getY(i); out[i * 3 + iz] = pos.getZ(i); }
    // the 'y' mapping is a mirror: swap two corners of every triangle to keep faces outward
    if (sh.axis === 'y') for (let t = 0; t < out.length; t += 9) for (let c = 0; c < 3; c++) { const k = out[t + 3 + c]; out[t + 3 + c] = out[t + 6 + c]; out[t + 6 + c] = k; }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(out, 3));
    ng.computeVertexNormals();
    return ng;
  }
  if (sh.type === 'sphere') { const g = new THREE.SphereGeometry(sh.r, 32, 20); g.translate(...sh.c); return g; }
  if (sh.type === 'mesh') return meshGeo(sh);
  throw new Error(`unknown print solid "${sh.type}"`);
}
// a mesh shape (kit/shapes.mjs) as three geometry, in plan coordinates
function meshGeo(m) {
  const out = new Float32Array(m.tris.length * 9);
  m.tris.forEach(([a, b, c], t) => [a, b, c].forEach((v, k) => out.set(m.pts[v], t * 9 + k * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}
// the plain union before the cut arrives, so the part shows at once
const roughPrint = part => part.shapes.map(sh => solidGeo(sh));

const TONES = {
  light: {
    paper: 0xfbfbfa, ink: 0x232326, grid: [0xd6d6d2, 0xe9e9e5],
    hi: [0x9d9d9a, 0xbcbcb8, 0xd6d6d2, 0xededea], mid: [0x777775, 0x909090, 0xa8a8a5, 0xbebebb],
    lo: [0x5a5a5c, 0x6d6d6f, 0x808082, 0x949496], faint: [0xd2d2ce, 0xdededa, 0xe8e8e4, 0xf2f2ef],
    lit: [0xa8343a, 0xc63f45, 0xe5484d, 0xef7478],   // the part you clicked
    new: [0xe0b400, 0xf2c600, 0xffd100, 0xffe04d],   // new in this step: the guide's yellow
  },
};

function toneMat(cols, { opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { tones: { value: cols.map(c => new THREE.Color(c)) }, opacity: { value: opacity } },
    transparent: opacity < 1, depthWrite: opacity >= 1, side: THREE.DoubleSide,
    vertexShader: `varying vec3 wp; void main() { vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 tones[4]; uniform float opacity; varying vec3 wp;
      void main() {
        vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
        int k;
        if (n.y > 0.6) k = 3; else if (n.y < -0.6) k = 0;
        else k = dot(normalize(n.xz + 1e-5), normalize(vec2(0.62, 0.78))) > 0.0 ? 2 : 1;
        gl_FragColor = vec4(tones[k], opacity);
      }`,
  });
}

export function createViewer(el, { onPick } = {}) {
  // light paper only, like the page
  const T = TONES.light;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(T.paper, 1);
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 100);
  camera.layers.enable(1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minZoom = 0.5;
  controls.maxZoom = 10;
  controls.maxPolarAngle = Math.PI * 0.5;
  // inside a long page: the wheel scrolls the page unless Ctrl / pinch; one finger scrolls
  el.addEventListener('wheel', e => { controls.enableZoom = e.ctrlKey || e.metaKey; }, { capture: true, passive: true });
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = 'pan-y';

  // outlines: view-space normals and depth, then a line wherever either jumps
  const ndMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vp; void main() { vec4 v = modelViewMatrix * vec4(position, 1.0); vp = v.xyz; gl_Position = projectionMatrix * v; }`,
    fragmentShader: `varying vec3 vp; void main() { vec3 n = normalize(cross(dFdx(vp), dFdy(vp))); gl_FragColor = vec4(n * 0.5 + 0.5, -vp.z / 100.0); }`,
  });
  const ndTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType });
  const edgeMat = new THREE.ShaderMaterial({
    uniforms: { nd: { value: ndTarget.texture }, px: { value: new THREE.Vector2() }, ink: { value: new THREE.Color(T.ink) }, dzK: { value: 0.012 } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 uv0; void main() { uv0 = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D nd; uniform vec2 px; uniform vec3 ink; uniform float dzK; varying vec2 uv0;
      // an edge is where the normal turns, the silhouette meets paper, or depth stops
      // being linear across the pixel (second difference), so big flat faces seen at a
      // low angle stay clean
      void main() {
        vec4 c = texture2D(nd, uv0);
        vec4 l = texture2D(nd, uv0 - vec2(px.x, 0.0)), r = texture2D(nd, uv0 + vec2(px.x, 0.0));
        vec4 d = texture2D(nd, uv0 - vec2(0.0, px.y)), t = texture2D(nd, uv0 + vec2(0.0, px.y));
        float e = 0.0;
        vec4 s4[4]; s4[0] = l; s4[1] = r; s4[2] = d; s4[3] = t;
        for (int i = 0; i < 4; i++) {
          vec4 s = s4[i];
          float bg = step(c.a, 0.0) + step(s.a, 0.0);
          float dn = 1.0 - dot(c.rgb * 2.0 - 1.0, s.rgb * 2.0 - 1.0);
          e = max(e, max(bg > 0.5 && bg < 1.5 ? 1.0 : 0.0, step(0.25, dn)));
        }
        if (l.a > 0.0 && r.a > 0.0 && d.a > 0.0 && t.a > 0.0) {
          float lap = max(abs(l.a + r.a - 2.0 * c.a), abs(d.a + t.a - 2.0 * c.a)) * 100.0;
          e = max(e, step(dzK, lap));
        }
        gl_FragColor = vec4(ink, e * 0.88);
      }`,
  });
  const edgeScene = new THREE.Scene();
  edgeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat));
  const edgeCam = new THREE.Camera();

  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  root.scale.setScalar(0.001);
  scene.add(root);
  let grid = null;

  const mats = Object.fromEntries(['hi', 'mid', 'lo', 'faint', 'lit', 'new'].map(k => [k, toneMat(T[k])]));
  const ghost = toneMat(T.faint, { opacity: 0.35 });
  const STRESS = [[4, 'hi'], [3, 'mid'], [2, 'lo'], [0, 'lit']];
  let meshes = [], size = 2, camDist = 4, center = new THREE.Vector3();
  let stepLimit = null, stepHi = null, selected = null, stress = null, dirty = true;

  const V = a => new THREE.Vector3(a[0], a[1], a[2]);
  function hexGeo(c) {
    const quads = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [0, 3, 2, 1], [4, 5, 6, 7]];
    const pos = [];
    for (const [a, b, cc, d] of quads) for (const i of [a, b, cc, a, cc, d]) pos.push(...c[i]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  function sphGeo(c, r) { const g = new THREE.SphereGeometry(r, 28, 18); g.translate(c[0], c[1], c[2]); return g; }
  function boxGeo(c, s) { const g = new THREE.BoxGeometry(s[0], s[1], s[2]); g.translate(c[0], c[1], c[2]); return g; }
  function cylGeo(a, b, r, seg = 28) {
    const va = V(a), vb = V(b), d = new THREE.Vector3().subVectors(vb, va);
    const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate(...va.add(vb).multiplyScalar(0.5).toArray());
    return g;
  }
  function add(geo, info, tone) {
    const m = new THREE.Mesh(geo, mats[tone]);
    m.userData = info;
    root.add(m);
    meshes.push({ mesh: m, tone, ...info });
  }

  function setModel(d) {
    for (const r of meshes) { root.remove(r.mesh); r.mesh.geometry.dispose(); }
    meshes = [];
    const md = d.model;
    for (const m of md.members) {
      const j = d.joints[m.id];
      const info = { id: m.id, name: m.name, step: m.step, kind: 'member', mark: d.markOf[m.id], spec: j.sec.short };
      if (j.sec.round) {
        const tA = Math.min(...j.edges.map(e => e.ta)), tB = Math.max(...j.edges.map(e => e.tb));
        add(cylGeo(j.A.map((v, i) => v + j.axis[i] * tA), j.A.map((v, i) => v + j.axis[i] * tB), j.hu), info, m.tone || 'hi');
      } else add(hexGeo(memberCorners(j)), info, m.tone || 'hi');
    }
    for (const pl of md.plates) {
      const info = { id: pl.id, name: pl.name, step: pl.step, kind: 'plate', mark: pl.mark, spec: pl.spec };
      const tone = pl.tone || (pl.material === 'steel' || !pl.material ? 'mid' : 'faint');
      if (!pl.notches?.length) { add(boxGeo(pl.c, pl.s), info, tone); continue; }
      // notched: the kept cells of the outline as boxes (coplanar, so no seams are inked)
      const [a0, a1] = pl.axes, W = pl.s[a0], H = pl.s[a1];
      const xs = [...new Set([0, W, ...pl.notches.flatMap(n => [n[0], n[2]])])].sort((a, b) => a - b);
      const ys = [...new Set([0, H, ...pl.notches.flatMap(n => [n[1], n[3]])])].sort((a, b) => a - b);
      const geos = [];
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const mx = (xs[i] + xs[i + 1]) / 2, my = (ys[j] + ys[j + 1]) / 2;
        if (pl.notches.some(n => mx > n[0] && mx < n[2] && my > n[1] && my < n[3])) continue;
        const c = pl.c.slice(), sz = pl.s.slice();
        c[a0] = pl.c[a0] - W / 2 + mx; sz[a0] = xs[i + 1] - xs[i];
        c[a1] = pl.c[a1] - H / 2 + my; sz[a1] = ys[j + 1] - ys[j];
        geos.push(boxGeo(c, sz));
      }
      for (const g of geos) add(g, info, tone);
    }
    const gen = ++generation;
    for (const pr of md.prints || []) {
      const info = { id: pr.id, name: pr.name, step: pr.step, kind: 'print', spec: `3D print, ${pr.material || 'PETG'}` };
      const tone = pr.tone || 'faint';
      const mats4 = placeMatrices(pr);
      const rough = mats4.flatMap(m4 => roughPrint(pr).map(g => { add(g.applyMatrix4(m4), info, tone); return meshes[meshes.length - 1]; }));
      printGeometry(pr).then(geo => {
        if (gen !== generation) return;
        for (const r of rough) { root.remove(r.mesh); r.mesh.geometry.dispose(); meshes.splice(meshes.indexOf(r), 1); }
        for (const m4 of mats4) add(geo.clone().applyMatrix4(m4), info, tone);
        refresh();
      }).catch(e => console.warn('print geometry:', e.message));
    }
    for (const h of md.hardware) for (const sh of [h.shape || []].flat(Infinity)) {
      const info = { id: h.id, name: h.name, step: h.step, kind: 'hardware', spec: h.spec };
      add(sh.type === 'box' ? boxGeo(sh.c, sh.s) : sh.type === 'sphere' ? sphGeo(sh.c, sh.r) : sh.type === 'mesh' ? meshGeo(sh) : cylGeo(sh.a, sh.b, sh.r), info, sh.tone || h.tone || 'lo');
    }
    const [lo, hi] = d.bbox;
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    // fit the bounding sphere, so a tall or wide build stays in view from any side
    size = (Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 1000) * 0.52;
    // close enough that half-float depth in the outline pass resolves millimetres
    camDist = Math.max(1.5, (span / 1000) * 1.6);
    camera.near = -camDist * 2; camera.far = camDist * 4;
    // design (x, y, z) -> three (x, z, -y), in metres
    center.set((lo[0] + hi[0]) / 2000, (lo[2] + hi[2]) / 2000, -(lo[1] + hi[1]) / 2000);
    if (grid) scene.remove(grid);
    const gs = Math.ceil((span * 2.2) / 1000);
    grid = new THREE.GridHelper(gs, gs * 10, T.grid[0], T.grid[1]);
    grid.position.set(center.x, lo[2] / 1000 - 0.001, center.z);
    grid.layers.set(1);
    scene.add(grid);
    edgeMat.uniforms.dzK.value = Math.max(0.008, span / 1000 * 0.006);
    if (!framed) { view('iso', true); framed = true; }
    resize();
    refresh();
  }
  let framed = false, generation = 0;

  function refresh() {
    for (const r of meshes) {
      r.mesh.visible = stepLimit == null || r.step <= stepLimit;
      let mat = mats[r.tone];
      if (stepHi != null) mat = r.step === stepHi ? mats.new : r.kind === 'hardware' || r.kind === 'plate' ? ghost : mats[r.tone];
      if (selected && r.id === selected) mat = mats.lit;
      if (stress) {
        const sf = r.kind === 'member' ? stress[r.id] : undefined;
        mat = sf === undefined ? ghost : mats[STRESS.find(([lo]) => sf >= lo)[1]];
      }
      r.mesh.material = mat;
    }
    dirty = true;
  }

  const dirOf = (az, el) => {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    // azimuth 0 looks from the front (-y in design = +z in three)
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  };
  const presets = { iso: [35, 28], front: [0, 0], side: [90, 0], top: [0, 89.9] };
  let anim = null;
  function view(name, instant = false) {
    const [az, elv] = presets[name];
    const from = { p: camera.position.clone(), t: controls.target.clone(), z: camera.zoom };
    const to = { p: center.clone().add(dirOf(az, elv).multiplyScalar(camDist)), t: center.clone(), z: 1 };
    const reduce = instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now(), dur = reduce ? 0 : 600;
    anim = now => {
      const k = dur ? Math.min(1, (now - start) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(from.p, to.p, e);
      controls.target.lerpVectors(from.t, to.t, e);
      camera.zoom = from.z + (to.z - from.z) * e;
      camera.updateProjectionMatrix();
      dirty = true;
      if (k >= 1) anim = null;
    };
    if (reduce) anim(performance.now());
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes.filter(m => m.mesh.visible).map(m => m.mesh), false)[0]?.object;
    selected = hit ? hit.userData.id : null;
    refresh();
    onPick && onPick(hit ? hit.userData : null);
  });

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    const half = size, a = w / h;
    Object.assign(camera, a >= 1 ? { left: -half * a, right: half * a, top: half, bottom: -half } : { left: -half, right: half, top: half / a, bottom: -half / a });
    camera.updateProjectionMatrix();
    const dpr = renderer.getPixelRatio();
    ndTarget.setSize(Math.round(w * dpr), Math.round(h * dpr));
    edgeMat.uniforms.px.value.set(1 / (w * dpr), 1 / (h * dpr));
    dirty = true;
  }
  new ResizeObserver(resize).observe(el);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);
  renderer.setAnimationLoop(now => {
    if (anim) anim(now);
    if (controls.update()) dirty = true;
    if (!dirty || !visible) return;
    dirty = false;
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.overrideMaterial = ndMat;
    renderer.setRenderTarget(ndTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(T.paper, 1);
    scene.overrideMaterial = null;
    camera.layers.enable(1);
    renderer.autoClear = false;
    renderer.render(edgeScene, edgeCam);
    renderer.autoClear = true;
  });

  return {
    setModel, view, resize,
    setStep(limit, hi) { stepLimit = limit; stepHi = hi; refresh(); },
    setStress(map) { stress = map; refresh(); },
    select(id) { selected = id; refresh(); },
  };
}
