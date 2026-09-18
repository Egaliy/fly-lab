import {initBrain} from './brain.js';

const COLS = 9;
const AXES = [
  {k:'busy',     label:'Event density', tier:'solid'},
  {k:'level',    label:'Response',      tier:'solid'},
  {k:'dip',      label:'Mid-roll hold', tier:'solid'},
  {k:'contrast', label:'Contrast',      tier:'edge'}
];
const LABEL = {
  curve_busy:['Event density','how often the cut changes','solid'],
  curve_level:['Response level','mean activity across the film','solid'],
  curve_dip:['Mid-roll hold','whether the middle keeps feeding the eye','solid'],
  contrast:['Contrast','spread of the L2 response','edge'],
  curve_peak:['Peak position','when the film grabs','drop'],
  force:['Response force','mean T4/T5 activity','drop'],
  dominance:['Concentration','Gini over the attention map','drop']
};

let brain = null;
const state = {data:null, rows:[], byId:{}, rowsCount:0, current:null};

/* Fly Attention Index — engagement of the early visual system, NOT design quality.
   Built only from metrics that passed the reliability audit. Event density is
   deliberately excluded: cut frequency is a style choice, not a virtue. */
const W = {level:.40, dip:.35, contrast:.25};
function attentionIndex(x){
  let s = 0, w = 0;
  for (const k in W){
    const v = x[k + '_pct'];
    if (v != null){ s += v * W[k]; w += W[k]; }
  }
  return w ? Math.round(s / w * 100) : null;
}
const VERDICTS = [
  [80, "Can't look away",   'var(--ok)'],
  [62, 'Holds the eye',     'var(--ok)'],
  [44, 'Looks, then drifts','var(--accent)'],
  [24, 'Loses interest',    'var(--warn)'],
  [0,  'Barely registers',  'var(--warn)']
];
const verdictOf = s => VERDICTS.find(v => s >= v[0]) || VERDICTS[4];

init();
async function init(){
  const res = await fetch('/data.json');
  state.data = await res.json();
  state.rows = state.data.concepts;
  state.rowsCount = Math.ceil(state.rows.length / COLS);
  state.rows.forEach((x,i) => {
    x._i = i;
    const c = i % COLS, r = Math.floor(i / COLS);
    x._pos = (c*100/(COLS-1)).toFixed(3) + '% ' + (r*100/(state.rowsCount-1)).toFixed(3) + '%';
    state.byId[x.id] = x;
    x._score = attentionIndex(x);
  });
  const root = document.documentElement.style;
  root.setProperty('--hero','url(/sheet_hero.jpg)');
  root.setProperty('--retina','url(/sheet_retina.jpg)');
  root.setProperty('--attn','url(/sheet_attn.jpg)');
  root.setProperty('--input','url(/sheet_input.jpg)');

  window.__rows = state.rows;
  buildBars();
  buildSquint();
  buildCurveFig();
  buildControls();
  drawPicker();
  buildStrip();
  buildOrderToggle();
  initBrain(document.getElementById('brainStage')).then(b => {
    brain = b;
    document.getElementById('brainLegend').innerHTML = b.layers.map(l =>
      '<span class="bl"><i style="background:hsl(' + Math.round(l.hue*360) + ' 62% 58%)"></i>' +
      '<b>' + l.name + '</b> ' + l.cells + '</span>').join('');
    if (state.current){
      brain.setConcept(state.current.id);
      document.getElementById('brainId').textContent = '#' + state.current.id;
    }
  }).catch(e => console.warn('brain scan unavailable', e));
  const film = document.getElementById('film');
  let wrapTick = null;
  film.addEventListener('scroll', () => {
    clearTimeout(wrapTick);
    wrapTick = setTimeout(wrapStrip, 90);   // wrap once the fling settles
  }, {passive:true});
  addEventListener('resize', () => { film._span = film.scrollWidth / 3; });
  if (window.flyScene) wireScene(); else addEventListener('flyscene:ready', wireScene, {once:true});
  select(filmList()[0] || state.rows[0], true);
}

/* ═══ scene wiring ═══ */
function wireScene(){ if (state.current) window.flyScene.setSource(state.current.video); }

/* ═══ autoplay ═══ */
const DWELL = 5000;
let autoTimer = null, autoStart = 0, autoOn = true;
function queueNext(){
  autoStart = performance.now();
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!autoOn || window.__hold) return;
    const list = filmList();
    const i = list.indexOf(state.current);
    select(list[(i + 1) % list.length], true);
  }, DWELL);
}
function tickProgress(){
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = autoOn
    ? Math.min(100, (performance.now() - autoStart) / DWELL * 100).toFixed(1) + '%'
    : '0%';
  requestAnimationFrame(tickProgress);
}
requestAnimationFrame(tickProgress);

/* ═══ selection ═══ */
function select(x, auto){
  if (!x) return;
  state.current = x;
  if (!auto) autoOn = false;                 // a manual pick stops the carousel
  if (window.flyScene){
    window.flyScene.setSource(x.video);
    const mood = window.flyScene.reactTo(x);
    document.getElementById('rdMood').textContent = mood;
  }
  document.getElementById('rdId').textContent = '#' + x.id;
  const sEl = document.getElementById('rdScore'), vEl = document.getElementById('rdVerdict');
  if (sEl && x._score != null){
    const v = verdictOf(x._score);
    sEl.textContent = x._score;
    sEl.style.color = v[2];
    vEl.textContent = v[1];
  }
  document.getElementById('rdCount').textContent =
    String(state.rows.indexOf(x) + 1).padStart(3,'0') + ' / ' + state.rows.length;
  syncSquint(x);
  loadLive(x);
  markPicker();
  if (brain){
    brain.setConcept(x.id);
    document.getElementById('brainId').textContent = '#' + x.id;
  }
  drawRadar(x);
  document.getElementById('rdMetrics').innerHTML = AXES.map(a2 => {
    const v = x[a2.k];
    return '<div><b>' + (v == null ? '—' : fmt(a2.k, v)) + '</b><span>' + a2.label + '</span></div>';
  }).join('');
  const film = document.getElementById('film');
  markStrip();
  const target = film.querySelector('button[data-copy="1"][data-id="' + x.id + '"]');
  if (target){
    const left = target.offsetLeft - (film.clientWidth - target.offsetWidth) / 2;
    film.scrollTo({left, behavior:'smooth'});
  }
  if (autoOn) queueNext();
}
function fmt(k,v){ return k === 'dip' ? (v > 0 ? '+' : '') + v.toFixed(2) : v.toFixed(2); }

let filmOrder = 'top';
function filmList(){
  return filmOrder === 'top'
    ? state.rows.slice().filter(x => x._score != null).sort((a,b) => b._score - a._score)
    : state.rows;
}
function buildStrip(){
  const film = document.getElementById('film');
  const list = filmList();
  film.innerHTML = '';
  // three copies: the scroll handler teleports between them, so the strip never ends
  for (let copy = 0; copy < 3; copy++){
    list.forEach((x, i) => {
      const b = document.createElement('button');
      b.dataset.id = x.id;
      b.dataset.copy = String(copy);
      b.setAttribute('aria-label', 'Concept ' + x.id);
      if (copy !== 1) b.setAttribute('aria-hidden', 'true');
      const rank = filmOrder === 'top' ? '<em>' + (i+1) + '</em>' : '';
      const badge = x._score != null ? '<u>' + x._score + '</u>' : '';
      b.innerHTML = rank + '<span>' + x.id + '</span>' + badge +
        '<b style="background-position:' + x._pos + '"></b>';
      b.onclick = () => select(x);
      film.appendChild(b);
    });
  }
  film._span = film.scrollWidth / 3;
  film.scrollLeft = film._span;
  markStrip();
}
function markStrip(){
  const film = document.getElementById('film');
  const id = state.current && state.current.id;
  film.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.id === id && b.dataset.copy === '1')));
}
function wrapStrip(){
  const film = document.getElementById('film');
  const s = film._span;
  if (!s) return;
  if (film.scrollLeft < s * 0.5) film.scrollLeft += s;
  else if (film.scrollLeft > s * 1.5) film.scrollLeft -= s;
}
function buildOrderToggle(){
  const host = document.getElementById('filmOrder');
  if (!host) return;
  [['top','Top by attention'],['seq','Sequence']].forEach(([k,label]) => {
    const b = el('button','btn',label);
    b.dataset.order = k;
    b.setAttribute('aria-pressed', String(k === filmOrder));
    b.onclick = () => {
      filmOrder = k;
      host.querySelectorAll('[data-order]').forEach(o =>
        o.setAttribute('aria-pressed', String(o.dataset.order === k)));
      buildStrip();
    };
    host.appendChild(b);
  });
}

/* ═══ radar ═══ */
function drawRadar(x){
  const svg = document.getElementById('radar');
  const cx = 140, cy = 100, R = 64;
  const n = AXES.length;
  const pt = (i, r) => {
    const a = -Math.PI/2 + i * 2*Math.PI/n;
    return [cx + Math.cos(a)*R*r, cy + Math.sin(a)*R*r];
  };
  let g = '';
  [0.25,0.5,0.75,1].forEach(r => {
    const p = Array.from({length:n}, (_,i) => pt(i,r).map(v=>v.toFixed(1)).join(',')).join(' ');
    g += '<polygon points="'+p+'" fill="none" stroke="#232838" stroke-width="1"/>';
  });
  const median = Array.from({length:n}, (_,i) => pt(i,0.5).map(v=>v.toFixed(1)).join(',')).join(' ');
  g += '<polygon points="'+median+'" fill="none" stroke="#5B6379" stroke-width="1" stroke-dasharray="3 3"/>';
  for (let i=0;i<n;i++){
    const [px,py] = pt(i,1);
    g += '<line x1="'+cx+'" y1="'+cy+'" x2="'+px.toFixed(1)+'" y2="'+py.toFixed(1)+'" stroke="#232838"/>';
  }
  const vals = AXES.map(a => {
    const v = x[a.k + '_pct'];
    return v == null ? 0.02 : Math.max(0.02, v);
  });
  const poly = vals.map((v,i) => pt(i,v).map(q=>q.toFixed(1)).join(',')).join(' ');
  g += '<polygon points="'+poly+'" fill="#FF8A3D" fill-opacity="0.22" stroke="#FF8A3D" stroke-width="2"/>';
  vals.forEach((v,i) => {
    const [px,py] = pt(i,v);
    g += '<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="3" fill="#FF8A3D"/>';
  });
  AXES.forEach((a,i) => {
    const [px,py] = pt(i, 1.34);
    const anchor = Math.abs(px-cx) < 6 ? 'middle' : (px > cx ? 'start' : 'end');
    g += '<text x="'+px.toFixed(1)+'" y="'+(py+3).toFixed(1)+'" text-anchor="'+anchor+
      '" font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="0.5" fill="'+
      (a.tier === 'edge' ? '#8891A8' : '#EAECF4')+'">'+a.label.toUpperCase()+'</text>';
  });
  svg.innerHTML = g;
}

/* ═══ reliability bars ═══ */
function buildBars(){
  const a = state.data.agreement;
  const rows = Object.keys(a).map(k => ({k, v:a[k].mean, min:a[k].min}))
    .sort((p,q) => q.v - p.v);
  document.getElementById('bars').innerHTML = rows.map(r => {
    const L = LABEL[r.k] || [r.k,'','drop'];
    const color = L[2] === 'solid' ? 'var(--ok)' : L[2] === 'edge' ? 'var(--accent)' : 'var(--warn)';
    const w = Math.max(0, r.v) * 100;
    return '<div class="bar"><div class="bar-name">'+L[0]+'<em>'+L[1]+'</em></div>'+
      '<div class="track"><div class="fill" style="width:'+w.toFixed(1)+'%;background:'+color+';opacity:.85"></div>'+
      '<div class="thresh"></div></div>'+
      '<div class="bar-val" style="color:'+color+'">'+r.v.toFixed(3)+
      (r.min == null ? '<em>2 networks</em>' : '<em>worst '+r.min.toFixed(3)+'</em>')+'</div></div>';
  }).join('');
}

/* ═══ catalogue → live player ═══ */
const SORTS = [
  {k:'score',    t:'fly attention', f:(a,b)=>(b._score??-1)-(a._score??-1)},
  {k:'id',       t:'by number',     f:(a,b)=>+a.id-+b.id},
  {k:'busy',     t:'event density', f:(a,b)=>b.busy-a.busy},
  {k:'level',    t:'response',      f:(a,b)=>b.level-a.level},
  {k:'dip',      t:'mid-roll hold', f:(a,b)=>a.dip-b.dip},
  {k:'contrast', t:'contrast',      f:(a,b)=>b.contrast-a.contrast}
];
let cur = SORTS[0];
function buildControls(){
  const c = document.getElementById('controls');
  SORTS.forEach(s => {
    const b = el('button','btn',s.t);
    b.id = 'sort-' + s.k;
    b.setAttribute('aria-pressed', String(s === cur));
    b.onclick = () => { cur = s; drawPicker(); };
    c.appendChild(b);
  });
}
function drawPicker(){
  SORTS.forEach(s => {
    const b = document.getElementById('sort-' + s.k);
    if (b) b.setAttribute('aria-pressed', String(s === cur));
  });
  const host = document.getElementById('pickList');
  host.innerHTML = state.rows.slice().sort(cur.f).map(x =>
    '<button class="pick" data-id="' + x.id + '">' +
      '<i style="background-position:' + x._pos + '"></i>' +
      '<b>#' + x.id + '<s>' + (verdictOf(x._score ?? 0)[1]) + '</s></b>' +
      '<u>' + (x._score ?? '') + '</u></button>').join('');
  markPicker();
}
function markPicker(){
  const id = state.current && state.current.id;
  document.querySelectorAll('#pickList .pick').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}
document.getElementById('pickList').addEventListener('click', e => {
  const b = e.target.closest('.pick');
  if (b) select(state.byId[b.dataset.id]);
});

/* ═══ live readout, synced to playback ═══ */
const lvid = document.getElementById('liveVideo');
let liveCurve = null, liveMax = 1, liveMin = 0;
function loadLive(x){
  if (!lvid) return;
  lvid.src = x.video; lvid.load(); lvid.play().catch(()=>{});
  liveCurve = x.curve && x.curve.length > 4 ? x.curve : null;
  if (liveCurve){ liveMax = Math.max(...liveCurve); liveMin = Math.min(...liveCurve); }
  document.getElementById('liveId').textContent = '#' + x.id;
  document.getElementById('mapRet').style.backgroundPosition = x._pos;
  document.getElementById('mapAtt').style.backgroundPosition = x._pos;
  setLv('lvContrast','mContrast', x.contrast.toFixed(2), x.contrast_pct ?? 0);
  setLv('lvIndex','mIndex', x._score ?? '—', (x._score ?? 0)/100);
  drawLiveChart();
}
function setLv(id, meter, value, frac){
  const b = document.getElementById(id); if (b) b.textContent = value;
  const m = document.getElementById(meter);
  if (m) m.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
}
function curveAt(p){
  if (!liveCurve) return null;
  const f = Math.max(0, Math.min(0.999, p)) * (liveCurve.length - 1);
  const i = Math.floor(f), t = f - i;
  return liveCurve[i] * (1-t) + liveCurve[Math.min(i+1, liveCurve.length-1)] * t;
}
function drawLiveChart(playP){
  const svg = document.getElementById('liveChart');
  if (!svg) return;
  if (!liveCurve){ svg.innerHTML = ''; return; }
  const W = 720, H = 132, n = liveCurve.length;
  const X = i => i * W / (n - 1);
  const Y = v => H - 10 - (v - liveMin) / (liveMax - liveMin + 1e-9) * (H - 26);
  const pts = liveCurve.map((v,i) => X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  let head = '';
  if (playP != null){
    const px = X(playP * (n-1)), pv = curveAt(playP);
    head = '<line x1="'+px.toFixed(1)+'" y1="6" x2="'+px.toFixed(1)+'" y2="'+(H-4)+'" stroke="#FF7A2F" stroke-width="1.5"/>'+
           '<circle cx="'+px.toFixed(1)+'" cy="'+Y(pv).toFixed(1)+'" r="4.5" fill="#FF7A2F"/>';
  }
  svg.innerHTML =
    '<rect x="'+(W/3).toFixed(0)+'" y="0" width="'+(W/3).toFixed(0)+'" height="'+H+'" fill="#FF4D6D" opacity="0.06"/>'+
    '<polyline points="'+pts+'" fill="none" stroke="rgba(255,122,47,.34)" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
    head;
}
if (lvid){
  let last = 0;
  const tick = () => {
    if (lvid.duration && !lvid.paused){
      const p = lvid.currentTime / lvid.duration;
      const now = curveAt(p);
      if (now != null){
        const rate = Math.abs(now - last); last = now;
        setLv('lvNow','mNow', now.toFixed(2), (now - liveMin) / (liveMax - liveMin + 1e-9));
        setLv('lvRate','mRate', rate.toFixed(2), Math.min(1, rate / ((liveMax - liveMin) * 0.25 + 1e-9)));
        drawLiveChart(p);
      }
      document.getElementById('liveTime').textContent = lvid.currentTime.toFixed(1) + 's';
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ═══ scroll reveal ═══ */
// threshold 0: a section taller than the viewport can never reach a % threshold,
// which left long blocks (the 126-card archive) permanently hidden on phones.
const revealIO = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in','reveal'); revealIO.unobserve(e.target); } });
}, {threshold:0, rootMargin:'0px 0px -40px 0px'});
const rises = [...document.querySelectorAll('.rise')];
rises.forEach(n => revealIO.observe(n));
// safety net: nothing may stay invisible if the observer never fires
addEventListener('load', () => setTimeout(() => {
  rises.forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.top < innerHeight * 1.2) n.classList.add('in','reveal');
  });
}, 400));


/* ═══ squint comparator ═══ */
let sqMode = 'retina';
function syncSquint(x){
  const A = document.getElementById('sqA'), B = document.getElementById('sqB');
  if (!A || !B) return;
  A.style.backgroundPosition = x._pos;
  B.style.backgroundPosition = x._pos;
  const id = document.getElementById('sqId');
  if (id) id.textContent = sqMode === 'retina' ? '#'+x.id+' · 721 facets' : '#'+x.id+' · T4/T5';
}
function buildSquint(){
  const stage = document.getElementById('sqStage');
  if (!stage) return;
  const B = document.getElementById('sqB'), handle = document.getElementById('sqHandle');
  let dragging = false;
  const set = clientX => {
    const r = stage.getBoundingClientRect();
    const p = Math.min(100, Math.max(0, (clientX - r.left) / r.width * 100));
    stage.style.setProperty('--pos', p.toFixed(2) + '%');
    B.style.setProperty('--pos', p.toFixed(2) + '%');
    handle.style.setProperty('--pos', p.toFixed(2) + '%');
  };
  stage.style.setProperty('--pos','50%');
  B.style.setProperty('--pos','50%');
  handle.style.setProperty('--pos','50%');
  stage.addEventListener('pointerdown', e => { dragging = true; stage.setPointerCapture(e.pointerId); set(e.clientX); });
  stage.addEventListener('pointermove', e => { if (dragging) set(e.clientX); });
  stage.addEventListener('pointerup',   () => { dragging = false; });
  stage.addEventListener('pointercancel',() => { dragging = false; });
  document.querySelectorAll('[data-sq]').forEach(btn => {
    btn.onclick = () => {
      sqMode = btn.dataset.sq;
      B.classList.toggle('attn', sqMode === 'attn');
      document.querySelectorAll('[data-sq]').forEach(o =>
        o.setAttribute('aria-pressed', String(o.dataset.sq === sqMode)));
      if (state.current) syncSquint(state.current);
    };
  });
}

/* ═══ curve figure ═══ */
function buildCurveFig(){
  const host = document.getElementById('curveFig');
  if (!host) return;
  const withCurve = state.rows.filter(x => x.curve && x.curve.length > 20 && x.dip != null);
  const picks = withCurve.slice().sort((a,b) => a.dip - b.dip).slice(0,3);
  const avg = arr => arr.reduce((s,v) => s+v, 0) / arr.length;
  const describe = x => {
    const c = x.curve, n = c.length, t = Math.floor(n/3);
    const pk = c.indexOf(Math.max(...c)) / (n-1);
    const first = avg(c.slice(0,t)), mid = avg(c.slice(t,2*t)), last = avg(c.slice(2*t));
    const strongest = Math.max(first, last);
    const drop = Math.round((1 - mid/strongest) * 100);
    const where = pk < .34 ? 'the opening third' : pk < .67 ? 'the middle' : 'the final third';
    const tail = last > mid * 1.12
      ? 'then picks back up before the end.'
      : 'and never recovers.';
    return 'Peaks in ' + where + '. The middle third runs ' + drop + '% below the strongest stretch, ' + tail;
  };
  host.innerHTML = picks.map(x => {
    const c = x.curve, w = 720, h = 96, mx = Math.max(...c), mn = Math.min(...c);
    const X = j => (j * w / (c.length - 1));
    const Y = v => (h - (v - mn) / (mx - mn + 1e-9) * (h - 16) - 8);
    const line = c.map((v,j) => X(j).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
    const area = 'M0,'+h+' L'+line.split(' ').join(' L')+' L'+w+','+h+' Z';
    return '<div class="cf shell"><div class="core">'+
      '<div class="cf-thumb" style="background-position:'+x._pos+'"></div>'+
      '<div class="cf-body"><h3>#'+x.id+' · mid-roll hold '+fmt('dip',x.dip)+'</h3>'+
      '<p>'+describe(x)+'</p>'+
      '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" role="img" aria-label="response across concept '+x.id+'">'+
        '<rect x="'+(w/3).toFixed(0)+'" y="0" width="'+(w/3).toFixed(0)+'" height="'+h+'" fill="#FF4D6D" opacity="0.07"/>'+
        '<path d="'+area+'" fill="#FF7A2F" opacity="0.10"/>'+
        '<polyline points="'+line+'" fill="none" stroke="#FF7A2F" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
      '</svg></div></div></div>';
  }).join('');
}


function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
