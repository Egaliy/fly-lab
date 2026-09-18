import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createFly} from './scene.js';
import {motionPresets, createMotionPlayer} from './motion.js';

const host = document.querySelector('#stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new T.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // was 2 — quadrupled pixel count on retina
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;                      // fly barely moves; refresh on demand
host.appendChild(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color(0x04050A);
const camera = new T.PerspectiveCamera(30, 1, .01, 60);

const fly = createFly();
fly.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = false; } });
scene.add(fly);
const pmrem = new T.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
scene.environmentIntensity = .06;
const motion = createMotionPlayer(fly);

const desk = new T.Mesh(new T.PlaneGeometry(60,60),
  new T.MeshStandardMaterial({color:0x151b2b, roughness:1, metalness:0, envMapIntensity:0}));
desk.rotation.x = -Math.PI/2; desk.position.y = -.015; desk.receiveShadow = true;
scene.add(desk);

/* ── screen ── */
const video = document.createElement('video');
video.crossOrigin = 'anonymous';
video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
video.setAttribute('playsinline','');
const videoTexture = new T.VideoTexture(video);
videoTexture.colorSpace = T.SRGBColorSpace;
videoTexture.minFilter = T.LinearFilter;
videoTexture.generateMipmaps = false;

const monitor = new T.Group();
monitor.position.set(-3.05, 1.86, 0);
monitor.rotation.y = Math.PI/2;
scene.add(monitor);
monitor.add(new T.Mesh(new T.BoxGeometry(5.62,3.22,.12),
  new T.MeshStandardMaterial({color:0x05070c, roughness:.32, metalness:.55})));
const screenMesh = new T.Mesh(new T.PlaneGeometry(5.42,3.04875),
  new T.MeshBasicMaterial({map:videoTexture, toneMapped:false}));
screenMesh.position.z = .067;
monitor.add(screenMesh);
const standMat = new T.MeshStandardMaterial({color:0x0c1420, metalness:.7, roughness:.3});
const stand = new T.Mesh(new T.BoxGeometry(.4,.31,.16), standMat);
stand.position.set(-3.1,.15,0); scene.add(stand);
const foot = new T.Mesh(new T.BoxGeometry(.75,.035,1.35), standMat);
foot.position.set(-3.1,.01,0); scene.add(foot);

/* one shadow-casting directional light instead of a shadow-cube point light */
RectAreaLightUniformsLib.init();
const panel = new T.RectAreaLight(0xb6d6ff, 8, 5.42, 3.04875);
panel.position.set(-2.94,1.86,0); panel.lookAt(0,1.86,0); scene.add(panel);
const key = new T.DirectionalLight(0xaacfff, 2.6);
key.position.set(-3.2, 2.6, .35);
key.target.position.set(.1, .5, 0); scene.add(key.target);
key.castShadow = true;
key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2;
key.shadow.camera.top = 2.2;  key.shadow.camera.bottom = -1.2;
key.shadow.camera.near = .3;  key.shadow.camera.far = 9;
key.shadow.bias = -.0004; key.shadow.normalBias = .01;
scene.add(key);
const fill = new T.PointLight(0x8fb6ff, 3.2, 14, 2);
fill.position.set(-2.55,1.9,0); scene.add(fill);   // no shadow

/* screen-driven tint */
const sc = document.createElement('canvas'); sc.width = 8; sc.height = 8;
const sctx = sc.getContext('2d', {willReadFrequently:true});
let lastSample = 0, canSample = true;
function updateScreenLight(now){
  if (!canSample || video.readyState < 2 || now - lastSample < 140) return;
  lastSample = now;
  try {
    sctx.drawImage(video, 0, 0, 8, 8);
    const px = sctx.getImageData(0,0,8,8).data;
    let r=0,g=0,b=0;
    for (let i=0;i<px.length;i+=4){ r+=px[i]; g+=px[i+1]; b+=px[i+2]; }
    r/=16320; g/=16320; b/=16320;
    const bright = (r+g+b)/3;
    const tint = new T.Color().setRGB(.12+r, .14+g, .19+b, T.SRGBColorSpace);
    tint.multiplyScalar(.85 / Math.max(tint.r, tint.g, tint.b, .01));
    panel.color.lerp(tint, .22);
    fill.color.copy(panel.color);
    key.color.copy(panel.color);
    panel.intensity = T.MathUtils.lerp(panel.intensity, 5.5 + bright*14, .16);
    fill.intensity  = T.MathUtils.lerp(fill.intensity,  2.2 + bright*7,  .16);
    key.intensity   = T.MathUtils.lerp(key.intensity,   1.8 + bright*3.4,.16);
  } catch { canSample = false; }
}

const dustGeo = new T.BufferGeometry();
const dust = [];
for (let i=0;i<90;i++) dust.push(-4+Math.random()*7, .1+Math.random()*3.6, -3+Math.random()*5);
dustGeo.setAttribute('position', new T.Float32BufferAttribute(dust,3));
scene.add(new T.Points(dustGeo,
  new T.PointsMaterial({color:0xb8cde1, size:.009, transparent:true, opacity:.22})));

/* ── fixed cinematic framing, slow drift, no user controls ── */
const LANDSCAPE = {pos:new T.Vector3(4.7,3.15,-10.6), tgt:new T.Vector3(-1.35,1.15,0), fov:30};
const PORTRAIT  = {pos:new T.Vector3(4.55,2.72,-9.55), tgt:new T.Vector3(-0.45,0.86,0), fov:40};
let BASE = LANDSCAPE;
const tmp = new T.Vector3();
function frame(now){
  const t = now/1000;
  const sway = reduced ? 0 : Math.sin(t*0.12)*0.30;
  const rise = reduced ? 0 : Math.sin(t*0.09+1.4)*0.13;
  tmp.copy(BASE.pos); tmp.x += sway; tmp.y += rise; tmp.z += sway*0.34;
  camera.position.lerp(tmp, 0.05);
  camera.lookAt(BASE.tgt);
}

function resize(){
  const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
  BASE = (w / h) < 0.95 ? PORTRAIT : LANDSCAPE;   // portrait needs a wider, further framing
  camera.aspect = w/h;
  camera.fov = BASE.fov;
  camera.position.copy(BASE.pos);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.shadowMap.needsUpdate = true;
}
addEventListener('resize', resize); resize();

let prev = null, visible = true, shadowTick = 0;
renderer.setAnimationLoop(now => {
  const dt = prev === null ? 0 : Math.min(.05, (now - prev)/1000); prev = now;
  if (!visible) return;
  motion.update(dt);
  updateScreenLight(now);
  frame(now);
  if (++shadowTick % 12 === 0) renderer.shadowMap.needsUpdate = true;  // ~5 fps shadows
  renderer.render(scene, camera);
});
new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {threshold:.01}).observe(host);

/* ── behaviour: the fly reacts, it is not steered ── */
const MOODS = [
  {id:'steps', label:'restless',  test:x => x.busy   != null && x.busy_pct   >= .78},
  {id:'wings', label:'alert',     test:x => x.contrast_pct != null && x.contrast_pct >= .78},
  {id:'groom', label:'disengaged',test:x => x.level  != null && x.level_pct  <= .25},
  {id:'idle',  label:'watching',  test:() => true}
];
let moodTimer = null;
function reactTo(x){
  const mood = MOODS.find(m => { try { return m.test(x); } catch { return false; } }) || MOODS[3];
  motion.select(mood.id);
  clearTimeout(moodTimer);
  // settle back to watching after the reaction plays out
  if (mood.id !== 'idle') moodTimer = setTimeout(() => motion.select('idle'), 6500);
  return mood.label;
}

window.flyScene = {
  setSource(url){ video.src = url; video.load(); video.play().catch(()=>{}); },
  reactTo,
  video
};
video.addEventListener('loadedmetadata', () => {
  if (video.videoWidth) screenMesh.scale.y = (5.42*video.videoHeight/video.videoWidth)/3.04875;
  video.play().catch(()=>{});
});
motion.select('idle');
dispatchEvent(new Event('flyscene:ready'));
