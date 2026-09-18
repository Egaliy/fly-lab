import {chromium} from 'playwright';
const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:1080,height:1920}});
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,140)); });
await p.goto('http://127.0.0.1:4173/', {waitUntil:'load'});
await p.waitForTimeout(3000);
await p.evaluate(() => { window.__hold = true; });
const r = await p.evaluate(async () => {
  const v = window.flyScene.video;
  v.src = '/cap/36.webm'; v.load();
  let err = null;
  try { await v.play(); } catch(e){ err = String(e); }
  await new Promise(r => setTimeout(r, 2500));
  return {src:v.currentSrc, ready:v.readyState, paused:v.paused, t:v.currentTime,
          w:v.videoWidth, h:v.videoHeight, netState:v.networkState, err,
          canVP9: v.canPlayType('video/webm; codecs="vp9"'), mediaErr: v.error && v.error.code};
});
console.log(JSON.stringify(r,null,1));
await b.close();
