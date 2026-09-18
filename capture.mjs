import {chromium} from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || '/tmp/flycap';
fs.rmSync(OUT, {recursive:true, force:true});
fs.mkdirSync(OUT, {recursive:true});

const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--hide-scrollbars']});
const ctx = await browser.newContext({
  viewport:{width:1080, height:1920},
  deviceScaleFactor:1,
  recordVideo:{dir:OUT, size:{width:1080, height:1920}}
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4173/', {waitUntil:'load'});

// прячем интерфейс сразу, ещё до того как что-то успеет попасть в кадр
await page.addStyleTag({content:`
  .hero-top,.hud-bottom,.mesh,.grain,main,footer{opacity:0!important;pointer-events:none}
  html,body{overflow:hidden!important;background:#04050a!important}
  .hero{min-height:100dvh!important;padding:0!important}
`});
await page.evaluate(() => { window.__hold = true; });
await page.waitForTimeout(3200);        // прогрев сцены, потом обрежем

const TRIO = ['36','122','6'];
for (const id of TRIO){
  await page.evaluate(cid => {            // никаких await внутри страницы: play() может не резолвиться
    const v = window.flyScene.video;
    v.src = '/cap/' + cid + '.webm';
    v.load();
    v.play().catch(() => {});
    const r = (window.__rows||[]).find(x => x.id === cid);
    if (r) window.flyScene.reactTo(r);
  }, id);
  await page.waitForTimeout(2300);
}

// крупный план панели с графиком
await page.addStyleTag({content:`
  .readout{opacity:1!important;position:fixed!important;left:50%!important;top:50%!important;
    transform:translate(-50%,-50%) scale(1.85)!important;width:340px!important;z-index:99!important}
  .hero-top{opacity:1!important}
  .brand{opacity:0!important}
`});
await page.waitForTimeout(3400);

await ctx.close();
await browser.close();
console.log('ok:', fs.readdirSync(OUT).filter(n=>n.endsWith('.webm'))[0]);
