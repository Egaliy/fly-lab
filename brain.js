import * as T from 'three';

const LAYER_META = [
  {key:'lamina',       name:'Lamina',        cells:'L1–L5',   hue:0.58},
  {key:'medulla',      name:'Medulla',       cells:'Mi · Tm',  hue:0.50},
  {key:'lobula_plate', name:'Lobula plate',  cells:'T4a–d',   hue:0.09},
  {key:'lobula',       name:'Lobula',        cells:'T5a–d',   hue:0.03}
];
const GAP = 13, HEX_R = 0.56;

export async function initBrain(host){
  const [metaRes, binRes] = await Promise.all([
    fetch('/layers_meta.json'), fetch('/layers.bin')
  ]);
  const meta = await metaRes.json();
  const raw  = new Uint8Array(await binRes.arrayBuffer());
  const N = meta.hexals, L = meta.layers.length;
  const index = Object.fromEntries(meta.ids.map((id,i) => [id,i]));
  const inner = meta.inner;

  const renderer = new T.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 400);
  scene.add(new T.AmbientLight(0xffffff, 1.4));
  const rim = new T.DirectionalLight(0xbcd4ff, 1.1);
  rim.position.set(-24, 18, 30); scene.add(rim);

  const group = new T.Group();
  scene.add(group);

  // hex prism, flat-top, pointing along Z
  const geo = new T.CylinderGeometry(HEX_R, HEX_R, 2.6, 6, 1);
  geo.rotateX(Math.PI/2);
  const mat = new T.MeshStandardMaterial({roughness:.55, metalness:.08, transparent:true, opacity:.96});
  const mesh = new T.InstancedMesh(geo, mat, N * L);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * L * 3), 3);
  group.add(mesh);

  const dummy = new T.Object3D();
  const u = meta.u, v = meta.v;
  let maxR = 0;
  for (let l = 0; l < L; l++){
    for (let i = 0; i < N; i++){
      // same lattice mapping as the 2D maps: v across, u+v/2 down
      const x = 1.5 * v[i];
      const y = -Math.sqrt(3) * (u[i] + v[i]/2);
      maxR = Math.max(maxR, Math.hypot(x,y));
      dummy.position.set(x, y, ((L-1)/2 - l) * GAP);
      dummy.scale.set(1, 1, inner[i] ? 1 : 0.28);
      dummy.updateMatrix();
      mesh.setMatrixAt(l * N + i, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;

  const col = new T.Color();
  function setConcept(id){
    const ci = index[id];
    if (ci == null) return;
    const base = ci * L * N;
    for (let l = 0; l < L; l++){
      const {hue} = LAYER_META[l];
      for (let i = 0; i < N; i++){
        const a = raw[base + l*N + i] / 255;
        const lit = inner[i] ? a : 0;
        col.setHSL(hue, inner[i] ? 0.62 : 0.10, 0.06 + lit * 0.62);
        mesh.setColorAt(l * N + i, col);
      }
    }
    mesh.instanceColor.needsUpdate = true;
  }

  function resize(){
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    const portrait = w/h < 1;
    camera.position.set(portrait ? 52 : 60, portrait ? 29 : 25, portrait ? 76 : 70);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let visible = false, t0 = performance.now();
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {threshold:.02}).observe(host);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setAnimationLoop(now => {
    if (!visible) return;
    const t = (now - t0)/1000;
    group.rotation.y = reduced ? -0.36 : -0.36 + Math.sin(t*0.13) * 0.24;
    group.rotation.x = reduced ?  0.16 :  0.16 + Math.sin(t*0.09) * 0.06;
    renderer.render(scene, camera);
  });

  return {setConcept, layers: LAYER_META};
}
