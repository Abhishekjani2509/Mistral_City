/* mistral-city.js
 * A pixel town that renders a codebase. Zero dependencies, no build step, no image assets.
 *
 *   import { mountCity } from './mistral-city.js'
 *   const city = mountCity(document.getElementById('city'), { onSelect: id => {} })
 *   city.setModel(cityJson)                 // Paul's scanner output
 *   city.onEvent({ type:'agent.start', agent:'repair', target:'auth' })
 *   city.replay(eventLog)                   // stage fallback
 *   city.setSecurity(['secrets','deps'])    // levels the Town Hall
 *   city.destroy()                          // cancels the loop, removes the DOM
 */

const CITY_CSS = `
:root{
  --ink:#13131C;
  --ink2:#20212E;
  --ink3:#2E3040;
  --paper:#FAF8F4;
  --paper2:#EFEBE3;
  --line:#D9D3C8;
  --y:#F3B23E;
  --o:#EF8934;
  --t:#E75D2E;
  --r:#D2321F;
  --R:#B32527;
  --grass:#6E9B45;
  --ok:#5B9B3A;
  --warn:#EF8934;
  --bad:#D2321F;
  --unk:#5C6480;
  --mute:#3A362F;
}
*{box-sizing:border-box}
body{
  margin:0;background:var(--ink);color:var(--ink);
  font-family:"Archivo",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;overflow:hidden;
}
button{font-family:inherit}
:focus-visible{outline:2px solid var(--t);outline-offset:2px}
.px{image-rendering:pixelated;image-rendering:crisp-edges}

/* ---------- top bar ---------- */

.wm{display:flex;align-items:center;gap:9px;font-weight:800;font-size:14px;letter-spacing:-.01em}
.mark{display:grid;grid-template-columns:repeat(5,3px);grid-template-rows:repeat(5,3px);gap:0}
.mark i{display:block;width:3px;height:3px}
.tabs{display:flex;gap:0;border:1px solid #34364A}
.tab{
  appearance:none;border:0;border-right:1px solid #34364A;background:transparent;color:#9A9CB0;
  font-size:12px;font-weight:700;padding:6px 12px;cursor:pointer;
}
.tab:last-child{border-right:0}
.tab:hover{color:var(--paper);background:#ffffff0f}
.tab[aria-selected="true"]{background:var(--paper);color:var(--ink)}
.right{margin-left:auto;display:flex;align-items:center;gap:8px}
.repo{font-family:"JetBrains Mono",monospace;font-size:11px;color:#9A9CB0}
.repo b{color:var(--y);font-weight:500}

.btn{
  appearance:none;border:1px solid var(--ink);background:var(--paper);color:var(--ink);
  padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer;
}
.btn:hover{background:#fff}
.btn:active{transform:translateY(1px)}
.btn.dark{background:transparent;color:#C9CBDA;border-color:#3A3D52}
.btn.dark:hover{background:#ffffff12;color:#fff}
.btn.hot{background:var(--t);border-color:var(--R);color:#fff}
.btn.hot:hover{background:var(--r)}
.btn[disabled]{opacity:.4;cursor:not-allowed}

/* ---------- panes ---------- */


#p-city{overflow:hidden;background:#4E7233}

/* ---------- world ---------- */
#stage{position:absolute;inset:0;overflow:hidden;cursor:grab}
#stage.drag{cursor:grabbing}
#stage.aim{cursor:crosshair}
#cv{position:absolute;left:0;top:0}

/* floating pixel-card UI */
.card{
  background:var(--paper);border:2px solid var(--ink);
  box-shadow:4px 4px 0 rgba(19,19,28,.35);
}
.hud{position:absolute;z-index:40}

#h-health{left:14px;top:14px;width:230px;padding:11px 12px}
.lbl{font-size:11px;color:var(--ink);font-weight:700}
.big{font-family:"Silkscreen",monospace;font-size:26px;line-height:1;margin:7px 0 8px;display:flex;align-items:baseline;gap:7px}
.big small{font-family:"Archivo";font-size:12px;font-weight:800}
.meter{height:10px;background:var(--paper2);border:2px solid var(--ink);display:block;overflow:hidden}
.meter i{display:block;height:100%;background:linear-gradient(90deg,var(--R),var(--t) 45%,var(--y));transition:width 1s cubic-bezier(.3,1,.4,1)}
.res{display:flex;gap:12px;margin:11px -12px 0;padding:9px 12px 0;border-top:1px solid var(--line)}
.res>div{display:flex;flex-direction:column;gap:1px}
.res .v{font-family:"Silkscreen",monospace;font-size:13px}
.res .k{font-size:10.5px;color:var(--mute);font-weight:600}

#h-legend{right:14px;top:14px;padding:9px 11px}
.lg{display:flex;align-items:center;gap:7px;font-size:11px;padding:2px 0;color:var(--mute)}
.lg b{color:var(--ink);font-weight:700}
.sw{width:9px;height:9px;border:1.5px solid var(--ink)}

#h-huts{left:14px;bottom:14px;padding:8px;display:grid;grid-template-columns:repeat(2,96px);gap:8px;align-items:start}
.hut{
  width:96px;padding:7px 6px 8px;border:2px solid var(--ink);background:var(--paper2);
  cursor:pointer;text-align:center;
}
.hut:hover{background:#fff}
.hut.armed{background:var(--t);color:#fff}
.hut.armed .cv,.hut.armed .cost{color:#fff}
.hut.busy{opacity:.4;pointer-events:none}
.hut canvas{display:block;margin:0 auto 4px}
.hut .cn{font-size:11px;font-weight:800;line-height:1.15}
.hut .cv{font-size:10.5px;font-weight:600;color:var(--t);margin-top:2px}
.hut .cost{font-family:"Silkscreen",monospace;font-size:9px;color:var(--mute);margin-top:3px}

#h-log{right:14px;bottom:14px;width:314px;max-height:240px;display:flex;flex-direction:column}
.loghead{display:flex;align-items:center;gap:7px;padding:8px 11px;background:var(--ink);color:var(--paper)}
.loghead .lbl{color:#9A9CB0;flex:1}
.dotp{width:6px;height:6px;background:#5B9B3A;animation:blink 1.4s steps(2) infinite}
@keyframes blink{50%{opacity:.25}}
#logb{overflow-y:auto;padding:7px 11px 9px;font-family:"JetBrains Mono",monospace;font-size:10.5px;line-height:1.55;background:var(--paper)}
.ll{display:flex;gap:6px;color:#4A4740;animation:sl .25s ease both;padding:1px 0}
@keyframes sl{from{opacity:0;transform:translateX(6px)}}
.ll .t{color:#A8A296;flex-shrink:0}
.ll.sys{color:var(--t);font-weight:500}
.ll.good{color:#3E7A26}
.ll.bad{color:var(--R)}
.ll.code{color:#6E6A62}

/* inspector */
#ins{
  position:absolute;right:14px;top:14px;width:318px;z-index:50;
  transform:translateX(calc(100% + 24px));transition:transform .3s cubic-bezier(.2,.9,.3,1);
  max-height:calc(100% - 28px);min-height:0;display:flex;flex-direction:column;
  overscroll-behavior:contain;
}
#ins.on{transform:none}
.ih{padding:11px 13px 11px;background:var(--ink);color:var(--paper);position:relative}
.ik{font-size:11px;color:#C6C8D6;font-weight:600}
.it{font-size:18px;font-weight:800;letter-spacing:-.02em;margin:2px 0 0}
.isub{font-size:12px;color:#B9BBC9;margin-top:5px;line-height:1.45}
.x{position:absolute;right:8px;top:7px;width:22px;height:22px;border:0;background:transparent;color:#8A8CA0;cursor:pointer;font-size:15px}
.x:hover{color:#fff}
.ib{overflow-y:auto;overscroll-behavior:contain;min-height:0;flex:1 1 auto;padding:11px 13px}
.srow{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.chip{font-size:10.5px;font-weight:700;padding:3px 8px;border:2px solid var(--ink);color:#fff}
.hn{font-family:"Silkscreen",monospace;font-size:18px;margin-left:auto}
.sec{margin-top:14px}
.sec h4{font-size:11.5px;color:var(--ink);margin:0 0 7px;font-weight:700}
.iss{padding:8px 9px;background:#FBEEE9;border-left:3px solid var(--R);margin-bottom:5px}
.iss.w{background:#FDF3E4;border-left-color:var(--o)}
.iss.g{background:#EFF5E9;border-left-color:var(--ok)}
.iss.u{background:#EDEFF4;border-left-color:var(--unk)}
.iss .a{font-size:12px;font-weight:700;line-height:1.3}
.iss .b{font-size:11px;color:#5C584F;margin-top:2px;line-height:1.4}
.iss .src{display:inline-flex;align-items:center;gap:4px;margin-top:7px;color:#8B3D22;font-family:"JetBrains Mono",monospace;font-size:9.5px;font-weight:800;text-decoration:none;overflow-wrap:anywhere}
.iss .src:hover{text-decoration:underline;color:var(--R)}
.iss .src:focus-visible{outline:2px solid var(--t);outline-offset:2px}
.conns{display:flex;flex-wrap:wrap;gap:4px}
.conn{font-size:10.5px;padding:3px 7px;border:1px solid var(--line);background:var(--paper2);cursor:pointer;font-weight:600}
.conn:hover{border-color:var(--ink);background:#fff}
.files{font-family:"JetBrains Mono",monospace;font-size:10px;color:#5C584F;line-height:1.65}
.acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;flex:0 0 auto;padding:10px 13px;border-top:2px solid var(--ink);background:var(--paper2)}
.act{display:flex;align-items:center;gap:7px;min-width:0;min-height:66px;text-align:left;border:2px solid var(--ink);background:var(--paper);padding:7px 8px;cursor:pointer}
.act:hover:not([disabled]){background:#fff}
.act.rec{background:var(--t);color:#fff}
.act.rec .ad{color:#FFE2D2}
.act[disabled]{opacity:.35;cursor:not-allowed}
.act>span{min-width:0}.act .an{font-size:11px;font-weight:800;display:block;line-height:1.2;overflow-wrap:anywhere}
.act .ad{font-size:9px;color:var(--mute);display:block;margin-top:2px;line-height:1.25;overflow-wrap:anywhere}
.act .ac{margin-left:auto;flex:0 0 auto;font-family:"Silkscreen",monospace;font-size:9px}
.chk{display:flex;gap:9px;margin:0 -13px;padding:7px 13px;border-bottom:1px solid var(--line);align-items:flex-start}
.chk .cb{width:16px;height:16px;flex-shrink:0;padding:3px;box-sizing:border-box;
  background:var(--R);color:#fff;margin-top:1px}
.chk .cb svg{display:block;width:100%;height:100%}
.chk.ok .cb{background:var(--ok)}
.chk b{font-size:11.5px;font-weight:700;display:block;line-height:1.25}
.chk i{font-size:10.5px;color:var(--mute);font-style:normal;display:block;margin-top:1px;line-height:1.35}
.fixbox{border:2px solid var(--ink);background:var(--paper2);padding:9px 10px}
.fixt{font-size:11.5px;font-weight:800}
.fixc{display:block;font-family:"JetBrains Mono",monospace;font-size:10px;background:var(--ink);color:#F3B23E;
  padding:6px 7px;margin:6px 0;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.fixh{font-size:10px;color:var(--mute);line-height:1.4}
.btnfix{width:100%;margin-top:8px;border:2px solid var(--ink);background:var(--t);color:#fff;
  font-weight:800;font-size:11.5px;padding:7px;cursor:pointer;font-family:inherit}
.btnfix:hover{background:var(--r)}
.res-card{margin-top:11px;padding:9px 10px;background:#EFF5E9;border-left:3px solid var(--ok)}
.res-card .rt{font-size:12px;font-weight:800;color:#3E7A26}
.res-card .rd{font-size:11px;color:#4E5C42;margin-top:3px;line-height:1.45}
.res-card summary{font-size:11px;font-weight:600;color:var(--mute);cursor:pointer;margin-top:7px}
.res-card .df{font-family:"JetBrains Mono",monospace;font-size:10px;margin-top:5px;line-height:1.6;color:#3E7A26}

/* connect */
#connect{position:absolute;inset:0;z-index:80;display:grid;place-items:center;
  background:
    linear-gradient(rgba(19,19,28,.55),rgba(19,19,28,.55)),
    repeating-linear-gradient(0deg,#ffffff10 0 1px,transparent 1px 44px),
    repeating-linear-gradient(90deg,#ffffff10 0 1px,transparent 1px 44px),
    #4E7233;
  transition:opacity .5s}
#connect.gone{opacity:0;pointer-events:none}
#repo-label{display:block;margin:0 0 5px;color:var(--ink);font-size:11.5px;font-weight:700}
#repo-url{display:block;width:100%;border:2px solid var(--ink);background:var(--paper);color:var(--ink);padding:9px 10px;font:12px "JetBrains Mono",monospace;outline:0}
#repo-url:focus{border-color:var(--t);box-shadow:0 0 0 2px #E75D2E33}
#repo-url::placeholder{color:#A8A296}
.connect-error{min-height:14px;margin-top:7px;color:var(--R);font-size:10px;font-weight:700;line-height:1.35}
.cbox{width:430px;padding:0}
.cbox .top{background:var(--ink);color:var(--paper);padding:16px 18px}
.cbox h1{font-size:24px;margin:0;letter-spacing:-.03em;font-weight:800}
.cbox .top p{font-size:12.5px;color:#B9BBC9;margin:5px 0 0;line-height:1.5}
.cbox .bot{padding:14px 16px 16px}
.ritem{display:flex;align-items:center;gap:10px;padding:9px 11px;border:2px solid var(--ink);background:var(--paper2);cursor:pointer;margin-bottom:7px}
.ritem:hover{background:#fff}
.rn{font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:500}
.rm{font-size:10.5px;color:var(--mute);margin-top:2px}
.rr{margin-left:auto;font-size:10.5px;font-weight:700;background:var(--t);color:#fff;padding:3px 7px}

#toast{position:absolute;left:50%;top:16px;transform:translateX(-50%) translateY(-12px);z-index:70;
  padding:8px 13px;font-size:12px;font-weight:700;opacity:0;transition:all .25s;pointer-events:none}
#toast.on{opacity:1;transform:translateX(-50%)}
#zc{position:absolute;right:14px;bottom:270px;z-index:40;display:flex;flex-direction:column;gap:4px}
#zc .btn{width:28px;height:28px;padding:0;font-size:13px}
#hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:40;font-size:10.5px;
  color:#EDEAE2;background:rgba(19,19,28,.72);padding:4px 10px;font-weight:600}

/* ---------- docs ---------- */
.k1{background:linear-gradient(180deg,#F3B23E,#B32527)}
.k2{background:#767C84}
.k3{background:#13131C;box-shadow:inset 0 -4px 0 #E75D2E}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (max-width:860px){#ins{width:calc(100% - 28px)}#h-log,#h-legend{display:none}}
`;
const CITY_HTML = `
  <div id="stage">
    <canvas id="cv" class="px"></canvas>

    <div class="hud card" id="h-health">
      <span class="lbl">City health</span>
      <div class="big"><span id="chp">--</span><small id="chd"></small></div>
      <span class="meter"><i id="cmeter" style="width:0%"></i></span>
      <div class="res">
        <div><span class="v" id="r-energy">120</span><span class="k">Energy</span></div>
        <div><span class="v" id="r-know">4</span><span class="k">Knowledge</span></div>
        <div><span class="v" id="r-tests">18/19</span><span class="k">Tests</span></div>
      </div>
    </div>

    <div class="hud card" id="h-legend">
      <div class="lg"><span class="sw" style="background:#5B9B3A"></span><b>Healthy</b>&nbsp;lights on</div>
      <div class="lg"><span class="sw" style="background:#EF8934"></span><b>Warning</b>&nbsp;smoke</div>
      <div class="lg"><span class="sw" style="background:#D2321F"></span><b>Broken</b>&nbsp;on fire</div>
      <div class="lg"><span class="sw" style="background:#5C6480"></span><b>Unknown</b>&nbsp;fogged</div>
    </div>

    <div class="hud card" id="h-huts"></div>

    <div class="hud card" id="h-log">
      <div class="loghead"><span class="dotp"></span><span class="lbl">Agent activity</span>
        <span class="lbl" style="color:var(--y)">mistral-medium-3.5</span></div>
      <div id="logb"></div>
    </div>

    <div id="zc">
      <button class="btn" id="zin">+</button>
      <button class="btn" id="zout">&minus;</button>
      <button class="btn" id="zfit">&#9633;</button>
    </div>
    <div id="hint">drag or scroll to pan, +/- to zoom, 0 to fit, click a building</div>

    <aside class="card" id="ins">
      <div class="ih"><button class="x" id="ix">&times;</button>
        <div class="ik" id="ik">System</div><h2 class="it" id="itl">--</h2><p class="isub" id="isb"></p></div>
      <div class="ib" id="ibd"></div>
      <div class="acts" id="iac"></div>
    </aside>

    <div id="toast" class="card"></div>

    <div id="connect">
      <div class="cbox card">
        <div class="top">
          <span class="mark" id="mk2" style="grid-template-columns:repeat(5,7px);grid-template-rows:repeat(5,7px);margin-bottom:10px"></span>
          <h1>Mistral City</h1>
          <p>Point it at a repository. Mistral reads the code and builds the town it describes, cats included.</p>
        </div>
        <div class="bot">
          <label id="repo-label" for="repo-url">GitHub repository URL</label>
          <input id="repo-url" type="url" autocomplete="off" spellcheck="false" placeholder="https://github.com/owner/repository">
          <div class="connect-error" id="connect-error" role="alert"></div>
          <div class="rm" style="margin:7px 0 10px">Public repositories are cloned and analyzed live.</div>
          <button class="btn hot" id="b-connect" style="width:100%;padding:10px;margin-top:4px">Connect repository</button>
        </div>
      </div>
    </div>
  </div>`;

export function mountCity(el, opts = {}) {
  if (!el) throw new Error('mountCity needs a host element');
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

  const _style = document.createElement('style');
  _style.textContent = CITY_CSS;
  document.head.appendChild(_style);
  el.innerHTML = CITY_HTML;

  const _listeners = [];
  const WIN = (t, f) => { window.addEventListener(t, f); _listeners.push([t, f]); };
  let MistralCity = {};
  let _ro = null;


  /* ============================================================
     MISTRAL CITY, pixel prototype
     stardew-scale top-down pixel art, clash-of-clans structures
     every roofline is the Mistral M, which is also two cat ears
     ============================================================ */

  const C = {
    ink:'#13131C', ink2:'#20212E', shade:'#2A2A38',
    y:'#F3B23E', o:'#EF8934', t:'#E75D2E', r:'#D2321F', R:'#B32527',
    paper:'#FAF8F4', cream:'#EFE6D6', tan:'#D8B47A', tan2:'#C29A62',
    wood:'#C08B4E', wood2:'#8C6239', wood3:'#6B4A2E',
    grass:'#6E9B45', grass2:'#5F8A3B', grass3:'#7EAA52', grassdk:'#4E7233',
    dirt:'#C9A06A', dirt2:'#B58B58', dirt3:'#9C7444',
    win:'#FFE9A8', win2:'#FFD26B', winoff:'#5A5C6E',
    stone:'#9AA0A8', stone2:'#767C84', stone3:'#5A6068',
    blue:'#4E5C86', blue2:'#3C4870',
    water:'#4B84B5', water2:'#3A6C99',
    fog:'#8C95AE', white:'#FAF8F4', black:'#0B0B12',
    leaf:'#4A7A31', leaf2:'#63A043', trunk:'#6B4A2E'
  };
  const RAMP = [C.y,C.o,C.t,C.r,C.R];
  const RAMPCH = ['y','o','t','r','R'];

  /* pixel mark = the Mistral M = cat ears */
  const MARK = [
    '1.1.1',
    '1.1.1',
    '22322',
    '33433',
    '44444'
  ];
  function paintMark(el,px){
    el.innerHTML='';
    MARK.forEach(row=>[...row].forEach(ch=>{
      const i=document.createElement('i');
      if(px){i.style.width=px+'px';i.style.height=px+'px'}
      i.style.background = ch==='.'?'transparent':RAMP[+ch-1+0];
      el.appendChild(i);
    }));
  }
  const _mk=document.getElementById('mk'); if(_mk) paintMark(_mk);
  const _mk2=document.getElementById('mk2'); if(_mk2) paintMark(_mk2,7);

  /* ============================================================
     1. PIXEL SPRITE ENGINE
     ============================================================ */
  const PAL = {
    '.':null,'#':C.ink,'s':C.shade,'e':C.paper,'w':C.win,'W':C.win2,'x':C.winoff,
    'y':C.y,'o':C.o,'t':C.t,'r':C.r,'R':C.R,
    'c':C.cream,'n':C.tan,'N':C.tan2,'b':C.wood,'B':C.wood2,'v':C.wood3,
    'g':C.stone,'G':C.stone2,'h':C.stone3,'u':C.blue,'U':C.blue2,
    'q':C.water,'Q':C.water2,'l':C.leaf,'L':C.leaf2,'k':C.trunk,
    'a':C.grass,'A':C.grass2,'z':C.grass3,'d':C.dirt,'D':C.dirt2,'f':C.dirt3,
    'F':C.fog,'m':C.black,
    '1':'#A99A8C','2':'#BCAEA0','3':'#8A7C6E',      // warm concrete
    '4':'#9A5A4A','5':'#C4705A',                     // brick
    '6':'#84A24A','7':'#96B45C',                     // warm grass
    '8':'#F2A03C','9':'#FFCE6B'                      // awning orange, warm glow
  };
  function bake(rows,pal){
    const w=Math.max(...rows.map(r=>r.length)), h=rows.length;
    const oc=document.createElement('canvas'); oc.width=w; oc.height=h;
    const ctx=oc.getContext('2d');
    const id=ctx.createImageData(w,h); const d=id.data;
    for(let y=0;y<h;y++)for(let x=0;x<rows[y].length;x++){
      const col=(pal||PAL)[rows[y][x]];
      if(!col) continue;
      const i=(y*w+x)*4;
      d[i]=parseInt(col.slice(1,3),16); d[i+1]=parseInt(col.slice(3,5),16);
      d[i+2]=parseInt(col.slice(5,7),16); d[i+3]=255;
    }
    ctx.putImageData(id,0,0);
    return oc;
  }

  /* grid helpers for procedural buildings */
  function grid(w,h){return Array.from({length:h},()=>Array(w).fill('.'))}
  function toRows(g){return g.map(r=>r.join(''))}
  function box(g,x,y,w,h,ch){for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(g[y+j]&&g[y+j][x+i]!==undefined)g[y+j][x+i]=ch}}
  function outline(g,ch){
    const h=g.length,w=g[0].length;
    const c=g.map(r=>r.slice());
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(c[y][x]!=='.')continue;
      const n=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>c[y+dy]&&c[y+dy][x+dx]&&c[y+dy][x+dx]!=='.'&&c[y+dy][x+dx]!==ch);
      if(n)g[y][x]=ch;
    }
  }

  /* --- THE SIGNATURE: an M-shaped roof (two cat ears) --- */
  function earRoof(g,x,y,w,h,bands){
    /* the Mistral mark: two straight ears over a solid block. also cat ears. */
    const earW=Math.max(4,Math.round(w*0.28));
    const gap=Math.max(3,Math.round(w*0.18));
    const left=x+Math.round((w-(earW*2+gap))/2);
    const solid=Math.max(2,Math.round(h*0.55));
    for(let j=0;j<h;j++){
      const ch=bands[Math.min(bands.length-1,Math.floor(j/h*bands.length))];
      if(j<solid){
        const taper=j===0?1:0;
        box(g,left+taper,y+j,earW-taper*2,1,ch);
        box(g,left+earW+gap+taper,y+j,earW-taper*2,1,ch);
      }else{
        const k=(j-solid)/Math.max(1,h-solid);
        const inset=Math.round((1-k)*(left-x)*0.9);
        box(g,x+inset,y+j,w-inset*2,1,ch);
      }
    }
  }
  function bandFill(g,x,y,w,h,chars){
    for(let j=0;j<h;j++){
      const ch=chars[Math.min(chars.length-1,Math.floor(j/h*chars.length))];
      box(g,x,y+j,w,1,ch);
    }
  }
  function windows(g,x,y,w,h,cols,rowsN,ch){
    const ww=4,wh=4;
    const gapx=Math.max(2,Math.floor((w-cols*ww)/(cols+1)));
    const gapy=Math.max(2,Math.floor((h-rowsN*wh)/(rowsN+1)));
    for(let r=0;r<rowsN;r++)for(let c2=0;c2<cols;c2++){
      const px=x+gapx+c2*(ww+gapx), py=y+gapy+r*(wh+gapy);
      box(g,px,py,ww,wh,'#');
      box(g,px+1,py+1,ww-2,wh-2,ch);
    }
  }

  /* building factory */
  function mkBuilding(o){
    const w=o.w,h=o.h;
    const g=grid(w,h+2);
    const roofH=o.roofH||Math.round(h*0.4);
    const bodyY=roofH, bodyH=h-roofH;
    /* body */
    box(g,1,bodyY,w-2,bodyH,o.wall||'c');
    /* right-side shade */
    box(g,w-3,bodyY,2,bodyH,o.shade||'n');
    /* roof */
    if(o.roof==='ears') earRoof(g,0,0,w,roofH+1,o.bands||['y','o','t','r','R']);
    else if(o.roof==='dome'){
      for(let j=0;j<roofH;j++){
        const inset=Math.round((roofH-j)*(w/2)/roofH*0.75);
        const ch=(o.bands||RAMPCH)[Math.min(4,Math.floor(j/roofH*5))];
        box(g,inset,j,w-inset*2,1,ch);
      }
    } else if(o.roof==='flat'){
      bandFill(g,0,Math.max(0,roofH-3),w,3,o.bands||['o','t','r']);
    } else { /* gable */
      for(let j=0;j<roofH;j++){
        const inset=Math.round((roofH-1-j)*(w/2-1)/roofH);
        const ch=(o.bands||['y','o','t','r','R'])[Math.min(4,Math.floor(j/roofH*5))];
        box(g,inset,j,w-inset*2,1,ch);
      }
    }
    /* windows + door */
    if(o.win!==false) windows(g,2,bodyY+2,w-4,bodyH-5,o.wc||3,o.wr||2,'w');
    if(o.door!==false){
      const dw=o.dw||4;
      const dh=Math.min(11,Math.floor(bodyH*0.55));
      box(g,Math.floor(w/2-dw/2),h-dh,dw,dh,'v');
    }
    /* extras */
    (o.extras||[]).forEach(e=>{
      if(e==='chimney'){box(g,w-7,roofH-6,3,7,'B');box(g,w-8,roofH-7,5,2,'v')}
      if(e==='antenna'){box(g,Math.floor(w/2),0,1,4,'g');box(g,Math.floor(w/2)-1,0,3,1,'y')}
      if(e==='crenel'){for(let i=1;i<w-1;i+=4)box(g,i,bodyY-1,2,2,'g')}
      if(e==='arch'){box(g,Math.floor(w/2)-3,h-9,7,9,'m');box(g,Math.floor(w/2)-3,h-10,7,1,'B')}
      if(e==='silo'){box(g,w-6,bodyY-4,5,bodyH+4,'g');box(g,w-6,bodyY-6,5,3,'G')}
      if(e==='crates'){box(g,2,h-4,4,4,'B');box(g,7,h-3,3,3,'b')}
      if(e==='flag'){box(g,Math.floor(w/2),-0,1,5,'v');box(g,Math.floor(w/2)+1,0,4,3,'R')}
      if(e==='mark'){
        const mx=Math.floor(w/2)-5, my=roofH+3;
        ['1.1.1','1.1.1','22322','33433','44444'].forEach((rw,j)=>[...rw].forEach((c2,i)=>{
          if(c2==='.')return; box(g,mx+i*2,my+j*2,2,2,'yotrR'[+c2-1]);
        }));
      }
      if(e==='awning'){
        const ay=h-Math.min(15,Math.floor((h-o.roofH)*0.42));
        for(let i=1;i<w-1;i+=4){ box(g,i,ay,2,3,'8'); box(g,i+2,ay,2,3,'e'); }
        box(g,1,ay+3,w-2,1,'#');
      }
      if(e==='books'){for(let i=0;i<4;i++)box(g,3+i*3,h-8,2,6,i%2?'e':'y')}
    });
    outline(g,'#');
    /* ground shadow */
    box(g,2,h+1,w-4,1,'s');
    return toRows(g);
  }

  /* --- hand-drawn cats (the soul of the thing) --- */
  const CATBASE = {
    walk1:[
      "...............",
      "..........##.##",
      "..........#####",
      "...##.....#####",
      "..#..#....#E#E#",
      "..#..#....#####",
      "..#..##########",
      "..#############",
      "..####@@@######",
      "..#############",
      "...##.....##...",
    ],
    walk2:[
      "...............",
      "..........##.##",
      "..........#####",
      "..##......#####",
      ".#..#.....#E#E#",
      ".#..#.....#####",
      ".#...##########",
      "..#############",
      "..####@@@######",
      "..#############",
      "..##.......##..",
    ],
    work:[
      "...............",
      "..........##.##",
      "..........#####",
      "...##.....#####",
      "..#..#....#E#E#",
      "..#..#....#####",
      "..#..##########",
      "..#############",
      "..####@@@####T.",
      "..###########T.",
      "...##.....##...",
    ],
    sit:[
      "...............",
      "..........##.##",
      "..........#####",
      "..........#####",
      "...#####..#E#E#",
      "..##...##.#####",
      "..##..#########",
      "..##...########",
      "...####@@@#####",
      "....###########",
      "...............",
    ]
  };
  function catSprite(frame,fur,accent,tool){
    const pal=Object.assign({},PAL,{'#':fur,'E':C.paper,'@':accent,'T':tool||C.stone});
    return bake(CATBASE[frame],pal);
  }

  /* ============================================================
     2. CITY MODEL
     ============================================================ */
  const AGENTS = {
    scout:{name:'Scout Cat', verb:'Understand', cost:10, fur:'#2B2B3A', accent:C.y,  tool:C.stone,
           desc:'Reads unfamiliar code and explains what it does'},
    repair:{name:'Repair Cat', verb:'Fix', cost:25, fur:'#13131C', accent:C.t, tool:C.stone,
           desc:'Finds the cause, edits the code, proves it with tests'}
  };

  const MODEL = {
    repo:{name:'mistral-shop', tests:{pass:18,total:19}},
    city:{energy:120, knowledge:4},
    systems:[
      {id:'tower',name:'Town Hall',kind:'tower',tx:16,ty:11,health:100,status:'healthy',level:2,
       passed:['secrets','deps'],
       blurb:'The repository itself. Its level is how secure this project is.',
       files:['package.json','next.config.js','middleware.ts'],
       connections:['auth','dashboard','api','docs'],issues:[]},
      {id:'auth',name:'Authentication',kind:'gate',tx:7,ty:12,health:64,status:'broken',
       blurb:'Handles logging in and keeping people signed in between visits.',
       files:['src/auth/session.ts','src/app/login/page.tsx','src/auth/guard.ts'],
       connections:['tower','profiles','db'],
       issues:[{t:'Session does not survive a refresh',
         d:'authentication.test.ts, "session should persist after refresh" fails. Sessions live in component state only.'}]},
      {id:'dashboard',name:'Dashboard',kind:'district',tx:25,ty:8,health:92,status:'healthy',
       blurb:'The screens a signed-in customer sees after they log in.',
       files:['src/app/dashboard/*.tsx','src/components/Chart.tsx'],
       connections:['tower','api','profiles'],issues:[]},
      {id:'api',name:'API Workshop',kind:'workshop',tx:22,ty:16,health:81,status:'warning',
       blurb:'The server routes the app calls to read and change data.',
       files:['src/app/api/orders/route.ts','src/app/api/cart/route.ts'],
       connections:['tower','db','dashboard','payments'],
       issues:[{w:1,t:'Thin test coverage on /api/cart',
         d:'3 of 9 routes have no test. A change here could break checkout without anything turning red.'}]},
      {id:'db',name:'Data Vault',kind:'vault',tx:13,ty:20,health:95,status:'healthy',
       blurb:'Where orders, users and products are stored.',
       files:['prisma/schema.prisma','src/lib/db.ts'],connections:['api','auth','profiles'],issues:[]},
      {id:'profiles',name:'User Profiles',kind:'house',tx:6,ty:19,health:88,status:'healthy',
       blurb:'Names, addresses and preferences for each customer.',
       files:['src/app/profile/page.tsx','src/lib/user.ts'],connections:['auth','db','dashboard'],issues:[]},
      {id:'tests',name:'Test Tower',kind:'watch',tx:28,ty:12,health:90,status:'healthy',
       blurb:'The checks that run before anything ships. 18 of 19 pass right now.',
       files:['tests/authentication.test.ts','tests/api.test.ts'],connections:['tower','api'],issues:[]},
      {id:'docs',name:'Library',kind:'library',tx:6,ty:6,health:70,status:'warning',
       blurb:'The written explanation of how this project works.',
       files:['README.md','docs/setup.md'],connections:['tower'],
       issues:[{w:1,t:'Setup guide is out of date',
         d:'docs/setup.md still lists the old env vars. A new contributor hits a wall on step one.'}]},
      {id:'payments',name:'Unknown ground',kind:'port',tx:26,ty:22,health:0,status:'unknown',
       blurb:'Nobody has read this part of the codebase yet.',
       files:[],connections:['api'],issues:[]}
    ],
    huts:[
      {id:'h-scout',kind:'hut',agent:'scout',tx:6,ty:4},
      {id:'h-repair',kind:'hut',agent:'repair',tx:18,ty:4}
    ]
  };

  /* building recipes: silhouette is what tells them apart */
  const RECIPES = {
    tower:   {w:34,h:58,roof:'ears',roofH:14,wc:3,wr:4,dw:6,extras:['antenna','mark'],wall:'c',shade:'n'},
    gate:    {w:46,h:34,roof:'ears',roofH:12,win:false,door:false,extras:['arch'],wall:'g',shade:'G'},
    workshop:{w:36,h:28,roof:'gable',roofH:10,wc:3,wr:1,extras:['chimney','crates'],wall:'b',shade:'B'},
    vault:   {w:32,h:26,roof:'dome',roofH:11,wc:2,wr:1,door:false,extras:['silo'],wall:'g',shade:'G'},
    district:{w:40,h:26,roof:'ears',roofH:9,wc:4,wr:2,wall:'n',shade:'N'},
    house:   {w:26,h:22,roof:'ears',roofH:8,wc:2,wr:1,wall:'c',shade:'n'},
    watch:   {w:20,h:44,roof:'ears',roofH:9,wc:2,wr:3,extras:['flag','crenel'],wall:'g',shade:'G'},
    library: {w:34,h:26,roof:'gable',roofH:9,wc:3,wr:1,bands:['u','u','U','U','U'],extras:['books'],wall:'c',shade:'n'},
    port:    {w:34,h:20,roof:'flat',roofH:6,wc:3,wr:1,extras:['crates'],wall:'g',shade:'G'},
    hut:     {w:22,h:20,roof:'ears',roofH:8,wc:2,wr:1,dw:5,wall:'b',shade:'B'}
  };

  /* Scenery buildings for the rest of the town, one set per era, so the era
     shows up everywhere and not only on the Town Hall plot. Smaller than every
     real system on purpose.

     Art rule 2 applies hard: no ear roofs and no orange ramp, or a viewer
     cannot tell scenery from a system they can click. mkBuilding defaults BOTH
     'flat' and 'gable' to the orange bands, so every recipe names its own. */
  let rnd2;   // the world section defines rnd below; scenery baking runs after that
  const STONE=['G','g','h'], WOOD=['B','b','v'], SLATE=['h','G','g'], BLUE=['U','u','U'];
  const TOWNSFOLK=[
   /*1 ruins   */ [{w:18,h:17,roof:'gable',roofH:6,win:false,door:false,wall:'g',shade:'G',bands:STONE},
                   {w:15,h:14,roof:'gable',roofH:5,win:false,door:false,wall:'v',shade:'b',bands:WOOD},
                   {w:21,h:15,roof:'flat', roofH:4,win:false,door:false,wall:'g',shade:'G',bands:STONE}],
   /*2 timber  */ [{w:20,h:15,roof:'gable',roofH:6,wc:1,wr:1,dw:4,wall:'b',shade:'B',bands:WOOD},
                   {w:16,h:13,roof:'gable',roofH:5,wc:1,wr:1,dw:3,wall:'v',shade:'b',bands:WOOD},
                   {w:23,h:14,roof:'gable',roofH:5,wc:2,wr:1,dw:4,wall:'b',shade:'B',bands:WOOD}],
   /*3 plaster */ [{w:22,h:17,roof:'gable',roofH:6,wc:2,wr:1,dw:4,wall:'c',shade:'n',bands:WOOD},
                   {w:19,h:15,roof:'gable',roofH:5,wc:2,wr:1,dw:4,wall:'n',shade:'N',bands:BLUE},
                   {w:25,h:16,roof:'gable',roofH:6,wc:3,wr:1,dw:4,wall:'c',shade:'n',bands:STONE}],
   /*4 concrete*/ [{w:24,h:26,roof:'flat',roofH:4,wc:3,wr:3,dw:5,wall:'g',shade:'G',bands:SLATE},
                   {w:20,h:19,roof:'flat',roofH:4,wc:2,wr:2,dw:4,wall:'n',shade:'N',bands:SLATE},
                   {w:27,h:22,roof:'flat',roofH:4,wc:3,wr:2,dw:5,wall:'g',shade:'G',bands:BLUE}],
   /*5 towers  */ [{w:22,h:36,roof:'flat',roofH:4,wc:2,wr:5,dw:5,wall:'g',shade:'G',bands:SLATE},
                   {w:27,h:25,roof:'flat',roofH:4,wc:3,wr:3,dw:5,wall:'n',shade:'N',bands:BLUE},
                   {w:18,h:42,roof:'flat',roofH:4,wc:2,wr:6,dw:4,wall:'g',shade:'G',bands:SLATE}]
  ];
  function ruinRows(rows,seed){
    const g=rows.map(r=>r.split(''));
    for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++){
      const c=g[y][x]; if(c==='.'||c==='#') continue;
      const v=rnd2(x*3.1+y*7.7+seed);
      if(y<3 && v>0.68) g[y][x]='.';
      else if(v>0.88)   g[y][x]= v>0.96?'.':'s';
    }
    return toRows(g);
  }

  /* ============================================================
     3. WORLD / TILEMAP
     ============================================================ */
  const TS=16, MW=34, MH=29;
  const map=[];           // 0 grass, 1 dirt path, 2 dark grass, 3 flowers, 4 water
  function rnd(s){let x=Math.sin(s)*10000;return x-Math.floor(x)}
  rnd2=rnd;
  /* Every tile gets a fixed number in [0,1). It flips to the next era once the
     score's fractional part passes it, so the town crosses over gradually
     instead of all at once. Mostly distance from the Town Hall, so upgrades
     radiate outward from the centre, with clustered noise for a ragged edge.
     Assigned once and never re-rolled: a rescan must not reshuffle the town. */
  const HALLX=16, HALLY=11;
  const MAXD=Math.hypot(Math.max(HALLX,MW-HALLX),Math.max(HALLY,MH-HALLY));
  const tmap=[], vmap=[];
  for(let y=0;y<MH;y++){map[y]=[];tmap[y]=[];vmap[y]=[];for(let x=0;x<MW;x++){
    const n=rnd(x*7.3+y*13.1);
    map[y][x]= n>0.93?3 : n>0.72?2 : 0;
    const d=Math.hypot(x-HALLX,y-HALLY)/MAXD;
    const blob=rnd(Math.floor(x/3)*5.13+Math.floor(y/3)*8.71);
    tmap[y][x]=Math.max(0,Math.min(0.999, d*0.62 + blob*0.38 ));
    /* coarse first so paving and planting form patches, fine to break the edges */
    const fine=rnd(x*4.77+y*9.13+0.5);
    vmap[y][x]=Math.floor((fine>0.74?fine:blob)*4)%4;
  }}
  /* The board is a fixed 34x29, but the canvas is whatever size the window is.
     Clamping the tile loop to the board left a hard rectangle of terrain sitting
     on flat backdrop, which read as a diorama on a table rather than a town in a
     landscape. The generator above is pure arithmetic on (x,y), so the same three
     formulas run for any coordinate and the ground reaches every edge of the
     canvas at any zoom or window size.

     Only nature is generated out there. Roads and the pond are carved into `map`
     below and stay inside the board, so the outskirts never sprout a road that
     leads nowhere. Distance from the Town Hall keeps growing past the edge, so
     the threshold saturates and the far country is the last ground to change
     era, which is what you want: the wilderness gives way to town slowly.

     Cached because draw() asks for the same tiles every frame. The working set
     is one viewport, not the whole plane. */
  const OUTSKIRT=new Map();
  function outskirt(x,y){
    const key=x+','+y;
    let t=OUTSKIRT.get(key);
    if(t) return t;
    const n=rnd(x*7.3+y*13.1);
    const d=Math.hypot(x-HALLX,y-HALLY)/MAXD;
    const blob=rnd(Math.floor(x/3)*5.13+Math.floor(y/3)*8.71);
    const fine=rnd(x*4.77+y*9.13+0.5);
    t={k: n>0.93?3 : n>0.72?2 : 0,
       t: Math.max(0,Math.min(0.999, d*0.62 + blob*0.38)),
       v: Math.floor((fine>0.74?fine:blob)*4)%4};
    OUTSKIRT.set(key,t);
    return t;
  }
  function carve(ax,ay,bx,by){
    let x=ax,y=ay;
    while(x!==bx){map[y][x]=1;x+=x<bx?1:-1}
    while(y!==by){map[y][x]=1;y+=y<by?1:-1}
    map[y][x]=1;
  }
  [...MODEL.systems,...MODEL.huts].forEach(s=>{ if(s.id!=='tower') carve(16,13,s.tx,s.ty+1) });
  /* a pond, because stardew */
  for(let y=22;y<29;y++)for(let x=1;x<15;x++){
    const d=Math.hypot((x-7.5)/5.2,(y-25.5)/2.5); if(d<1)map[y][x]=4;
  }

  /* tile art */
  function tileSprite(kind,seed){
    const g=grid(TS,TS);
    const base = kind===1?'d': kind===4?'q':'a';
    box(g,0,0,TS,TS,base);
    if(kind===0||kind===2||kind===3){
      for(let i=0;i<9;i++){
        const x=Math.floor(rnd(seed+i*3.7)*TS), y=Math.floor(rnd(seed+i*5.1+1)*TS);
        g[y][x]= kind===2?'A':'z';
        if(rnd(seed+i)>0.6&&g[y+1])g[y+1][x]= kind===2?'A':'z';
      }
      if(kind===3){
        const x=4+Math.floor(rnd(seed)*7),y=4+Math.floor(rnd(seed+2)*7);
        box(g,x,y,2,2,'y'); box(g,x-1,y+1,1,1,'o'); box(g,x+2,y+1,1,1,'o');
      }
    }
    if(kind===1){
      for(let i=0;i<11;i++){
        const x=Math.floor(rnd(seed+i*2.1)*TS), y=Math.floor(rnd(seed+i*4.3+9)*TS);
        g[y][x]= rnd(seed+i)>0.5?'D':'f';
      }
    }
    if(kind===4){
      for(let i=0;i<6;i++){
        const x=Math.floor(rnd(seed+i*3.1)*TS), y=Math.floor(rnd(seed+i*2.9)*TS);
        box(g,x,y,3,1,'Q');
      }
    }
    return bake(g.map(r=>r.join('')));
  }
  const TILES=[[],[],[],[],[],[],[]];
  for(let k=0;k<5;k++)for(let v=0;v<4;v++)TILES[k][v]=tileSprite(k,v*31.7+k*11.3);
  /* 5 = warm grass, 6 = warm grass with flowers: the developed levels sit on these */
  function warmTile(seed,flower){
    const g=grid(TS,TS); box(g,0,0,TS,TS,'6');
    for(let i=0;i<10;i++){
      const x=Math.floor(rnd(seed+i*3.7)*TS),y=Math.floor(rnd(seed+i*5.1+1)*TS);
      g[y][x]='7'; if(rnd(seed+i)>0.6&&g[y+1])g[y+1][x]='7';
    }
    if(flower){const x=4+Math.floor(rnd(seed)*7),y=4+Math.floor(rnd(seed+2)*7);
      box(g,x,y,2,2,'8'); box(g,x-1,y+1,1,1,'y'); box(g,x+2,y+1,1,1,'r');}
    return bake(toRows(g));
  }
  for(let v=0;v<4;v++){TILES[5][v]=warmTile(v*17.3,false);TILES[6][v]=warmTile(v*23.1,true);}

  /* ------------------------------------------------------------
     THE WHOLE BOARD ANSWERS TO THE SECURITY SCORE.
     Paving only the roads left the top era as a motorway through a
     meadow, so the ground itself walks from all-wild to nearly
     all-slab, with greenery surviving as planted squares.
     ------------------------------------------------------------ */
  const TILE_THEME=[
   {grass:'z',fleck:'A',dark:'z',dfleck:'l',path:'d',pfleck:'z',flower:'l',fleck2:'L',water:'q',slab:'g',seam:'G',accent:'l',back:'#2C3B22'},
   {grass:'a',fleck:'A',dark:'A',dfleck:'z',path:'d',pfleck:'D',flower:'y',fleck2:'o',water:'q',slab:'g',seam:'G',accent:'y',back:'#3E5A2A'},
   {grass:'a',fleck:'6',dark:'A',dfleck:'a',path:'g',pfleck:'G',flower:'y',fleck2:'o',water:'q',slab:'g',seam:'h',accent:'o',back:'#4E7233'},
   {grass:'6',fleck:'7',dark:'a',dfleck:'6',path:'3',pfleck:'1',flower:'9',fleck2:'8',water:'q',slab:'1',seam:'3',accent:'8',back:'#6E6559'},
   {grass:'7',fleck:'6',dark:'6',dfleck:'7',path:'1',pfleck:'3',flower:'8',fleck2:'9',water:'Q',slab:'2',seam:'3',accent:'8',back:'#8A8074'}
  ];
  /* Kind 0 is ~72% of the board, kind 2 ~21%, kind 3 ~7%. An orange accent in
     kind 0 paints a fifth of the map orange, so accents live in rarer kinds. */
  const GROUND_MIX={
   1:{0:['wild','wild','moss','wild'],       2:['moss','wild','moss','wild'],        3:['bramble','wild','bramble','moss']},
   2:{0:['grass','grass','tuft','grass'],    2:['tuft','grass','tuft','grass'],      3:['flower','grass','flower','tuft']},
   3:{0:['grass','slab','grass','tuft'],     2:['grass','slab','tuft','slab'],       3:['flower','slab','planter','grass']},
   4:{0:['slab','slab','grass','slabSeam'],  2:['slabSeam','slab','slab','planter'], 3:['slabAccent','slab','planter','slab']},
   5:{0:['slab','slabSeam','slab','slab'],   2:['slabSeam','slab','slab','slabAccent'],3:['planter','slabAccent','slabSeam','planter']}
  };
  function paintGround(g,style,t,seed){
    const scatter=(ch,count,j)=>{
      for(let i=0;i<count;i++){
        const x=Math.floor(rnd(seed+i*3.7+(j||0))*TS), y=Math.floor(rnd(seed+i*5.1+1+(j||0))*TS);
        g[y][x]=ch; if(rnd(seed+i)>0.6&&g[y+1]) g[y+1][x]=ch;
      }
    };
    switch(style){
      case 'wild':    box(g,0,0,TS,TS,t.grass); scatter(t.fleck,11); scatter(t.dfleck,5,9); break;
      case 'moss':    box(g,0,0,TS,TS,t.dark);  scatter(t.dfleck,12); break;
      case 'bramble': box(g,0,0,TS,TS,t.grass); scatter(t.dfleck,9); scatter(t.fleck2,4,3); break;
      case 'grass':   box(g,0,0,TS,TS,t.grass); scatter(t.fleck,9); break;
      case 'tuft':    box(g,0,0,TS,TS,t.grass); scatter(t.fleck,7); scatter(t.dark,4,5); break;
      case 'flower': { box(g,0,0,TS,TS,t.grass); scatter(t.fleck,7);
        const x=4+Math.floor(rnd(seed)*7), y=4+Math.floor(rnd(seed+2)*7);
        box(g,x,y,2,2,t.flower); box(g,x-1,y+1,1,1,t.fleck2); box(g,x+2,y+1,1,1,t.fleck2); break; }
      case 'slab':      box(g,0,0,TS,TS,t.slab); scatter(t.seam,3,7); break;
      case 'slabSeam':  box(g,0,0,TS,TS,t.slab); box(g,0,0,TS,1,t.seam); box(g,0,0,1,TS,t.seam); break;
      case 'slabAccent':box(g,0,0,TS,TS,t.slab); box(g,0,0,TS,1,t.seam); box(g,0,0,1,TS,t.seam);
                        box(g,4,4,8,8,t.accent); break;
      case 'planter':   box(g,0,0,TS,TS,t.slab); box(g,0,0,TS,1,t.seam); box(g,0,0,1,TS,t.seam);
                        box(g,3,3,10,10,t.seam); box(g,4,4,8,8,t.grass); scatter(t.fleck,3,11); break;
    }
  }
  function themedTile(lv,kind,seed,variant){
    const t=TILE_THEME[lv-1], g=grid(TS,TS);
    if(kind===1){
      box(g,0,0,TS,TS,t.path);
      for(let i=0;i<11;i++){
        const x=Math.floor(rnd(seed+i*2.1)*TS), y=Math.floor(rnd(seed+i*4.3+9)*TS);
        g[y][x]= rnd(seed+i)>0.5 ? t.pfleck : (lv>=4?t.pfleck:'f');
      }
      if(lv>=4){ box(g,0,0,TS,1,'3'); box(g,0,0,1,TS,'3'); }
      if(lv===5){ for(let x=2;x<TS-2;x+=6) box(g,x,7,3,1,'8'); }
      if(lv<=2){ for(let i=0;i<4;i++){
        const x=Math.floor(rnd(seed+i*6.1)*TS), y=Math.floor(rnd(seed+i*8.3)*TS);
        g[y][x]= lv===1?'l':'z'; } }
    } else if(kind===4){
      box(g,0,0,TS,TS,t.water);
      for(let i=0;i<6;i++){
        const x=Math.floor(rnd(seed+i*3.1)*TS), y=Math.floor(rnd(seed+i*2.9)*TS);
        box(g,x,y,3,1, lv===5?'q':'Q');
      }
    } else {
      paintGround(g, GROUND_MIX[lv][kind][variant], t, seed);
    }
    return bake(toRows(g));
  }
  const THEME_TILES={};
  function themeTiles(lv){
    lv=Math.max(1,Math.min(5,lv|0));
    if(!THEME_TILES[lv]){
      const a=[[],[],[],[],[]];
      for(let k=0;k<5;k++)for(let v=0;v<4;v++) a[k][v]=themedTile(lv,k,v*31.7+k*11.3,v);
      THEME_TILES[lv]=a;
    }
    return THEME_TILES[lv];
  }
  /* daylight, interpolated so it moves with the score rather than stepping */
  const GLOOM=[0.30,0.14,0,0,0], WARM=[0,0,0,0.07,0.13];
  function anchorLerp(arr,sv){
    const i=Math.max(0,Math.min(3,Math.floor(sv)-1)), f=Math.max(0,Math.min(1,sv-(i+1)));
    return arr[i]+(arr[i+1]-arr[i])*f;
  }
  function mixHex(a,b,f){
    const p=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
    const A=p(a),B=p(b);
    return '#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*f).toString(16).padStart(2,'0')).join('');
  }

  /* trees + props */
  function treeSprite(){
    const g=grid(20,26);
    box(g,8,16,4,9,'k');
    for(let j=0;j<16;j++){
      const inset=Math.round(Math.abs(j-9)*0.55)+Math.round((16-j)*0.15);
      box(g,2+inset,j,16-inset*2,1, j<5?'L': j%3===0?'L':'l');
    }
    outline(g,'#'); box(g,6,25,8,1,'s');
    return bake(toRows(g));
  }
  function rockSprite(){
    const g=grid(14,11);
    box(g,2,4,10,6,'g'); box(g,3,3,8,2,'g'); box(g,4,2,5,2,'g');
    box(g,8,6,4,4,'G'); outline(g,'#'); box(g,3,10,8,1,'s');
    return bake(toRows(g));
  }
  function bushSprite(){
    const g=grid(14,11);
    box(g,2,3,10,7,'l'); box(g,3,2,8,2,'L'); box(g,8,5,4,5,'l');
    box(g,4,5,2,2,'r'); box(g,9,7,2,2,'r');
    outline(g,'#'); return bake(toRows(g));
  }
  function signSprite(){
    const g=grid(16,16);
    box(g,7,7,2,8,'v'); box(g,2,3,12,6,'b'); box(g,3,4,10,4,'n');
    box(g,4,5,3,1,'v'); box(g,4,7,6,1,'v'); outline(g,'#');
    return bake(toRows(g));
  }
  const SPR = {tree:treeSprite(), rock:rockSprite(), bush:bushSprite(), sign:signSprite()};
  /* what grows out there, per era */
  const PROP_VOCAB=[
   ['deadtree','stump','bramble','boulder','weeds','mud','bramble','weeds'],
   ['tree','stump','logpile','bush','rock','barrel','crate','bush'],
   ['tree','bush','hedge','woodlamp','planter','bench','rock','tree'],
   ['tree','sapling','planter','steellamp','bollard','bench','grate','container','crate'],
   ['sapling','topiary','steellamp','bollard','planter','bench','container','pylon','grate','antenna']
  ];

  /* One fixed pool, decided at boot and never re-rolled.
       thresh  the score at which this site starts existing
       off     which side of the era boundary it sits on, same field as the tiles
     Drawing filters by score, so there is no rebuild cost and nothing shuffles
     between scans. Houses appear as the repository gets safer. */
  const SITES=[];
  function buildSites(){
    if(SITES.length) return;
    const taken=[];
    const clear=(x,y,r)=> !taken.some(t=>Math.abs(t[0]-x)<r&&Math.abs(t[1]-y)<r)
      && ![...MODEL.systems,...MODEL.huts].some(m=>Math.abs(m.tx-x)<5&&Math.abs(m.ty-y)<5);
    const offAt=(x,y)=>{
      const d=Math.hypot(x-HALLX,y-HALLY)/MAXD;
      return Math.max(0,Math.min(0.999,d*0.62+rnd(Math.floor(x/3)*5.13+Math.floor(y/3)*8.71)*0.38));
    };
    /* houses first, they are bigger and want the open ground */
    const HN=22;
    for(let i=0,placed=0;i<HN*5&&placed<HN;i++){
      const x=1+Math.floor(rnd(i*11.3+2.7)*(MW-2)), y=2+Math.floor(rnd(i*19.7+4.1)*(MH-3));
      if(map[y][x]===1||map[y][x]===4) continue;
      if(map[y][x-1]===4||map[y][x+1]===4) continue;
      if(!clear(x,y,4)) continue;
      const f=placed/(HN-1);
      /* a third are there from the start, the rest arrive as the score climbs */
      let th = f<0.34 ? 1 : 1+4*((f-0.34)/0.66);
      th = Math.max(1,Math.min(5, th+(rnd(i*6.1)-0.5)*0.6));
      taken.push([x,y]); placed++;
      SITES.push({x:x*TS,y:y*TS,house:true,vi:Math.floor(rnd(i*7.7)*3),thresh:th,off:offAt(x,y)});
    }
    const PN=58;
    for(let i=0;i<PN;i++){
      const x=Math.floor(rnd(i*17.7)*MW), y=Math.floor(rnd(i*29.3+5)*MH);
      if(map[y][x]===1||map[y][x]===4)continue;
      if(!clear(x,y,2))continue;
      const r=rnd(i*2.9+1.3);
      taken.push([x,y]);
      SITES.push({x:x*TS,y:y*TS,house:false,vi:Math.floor(rnd(i*3.3)*10),
                  thresh: r<0.68?1:1+4*((r-0.68)/0.32), off:offAt(x,y)});
    }
  }

  /* bake buildings */
  const BAKED={};
  Object.entries(RECIPES).forEach(([k,r])=>{BAKED[k]=bake(mkBuilding(r))});
  /* damaged variant of the gate: charred + missing crenellations */
  function damagedVariant(kind){
    const r=Object.assign({},RECIPES[kind]);
    const rows=mkBuilding(r).map(s=>s.split(''));
    for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
      const n=rnd(x*3.1+y*7.7);
      if(rows[y][x]!=='.'&&rows[y][x]!=='#'&&n>0.88) rows[y][x]= n>0.965?'.':'s';
    }
    return bake(rows.map(r2=>r2.join('')));
  }
  const BAKED_DMG={gate:damagedVariant('gate')};

  const CATS={};
  Object.entries(AGENTS).forEach(([k,a])=>{
    CATS[k]={walk1:catSprite('walk1',a.fur,a.accent),walk2:catSprite('walk2',a.fur,a.accent),
             work:catSprite('work',a.fur,a.accent,C.stone),sit:catSprite('sit',a.fur,a.accent)};
  });
  function scaffoldSprite(w,h){
    const g=grid(w,h);
    for(let j=6;j<h;j+=Math.max(6,Math.floor(h/4)))box(g,1,j,w-2,1,'b');
    box(g,1,2,2,h-2,'B'); box(g,w-3,2,2,h-2,'B');
    for(let j=2;j<h;j++){const x=Math.floor(2+(j-2)*(w-6)/(h-2));if(g[j])g[j][x]='b'}
    return bake(toRows(g));
  }



  /* ============================================================
     LEVEL SYSTEM: Town Hall + its whole plot
     the arc is not "castle gets bigger", it is
     overgrown medieval ruin  ->  industrial Mistral waterfront
     ============================================================ */
  const CHECKS=[
   {id:'secrets',name:'No secrets in the repo',
    fail:'.env is committed and contains a live Stripe key',
    pass:'.env is gitignored, keys read from the environment',
    fix:'git rm --cached .env && echo ".env" >> .gitignore',
    how:'scan tracked files for high-entropy strings and known key prefixes'},
   {id:'deps',name:'No critical dependency CVEs',
    fail:'2 critical advisories in the lockfile',
    pass:'0 critical, 0 high advisories',
    fix:'pnpm audit --fix',
    how:'read the lockfile, query the advisory DB'},
   {id:'session',name:'Sessions are signed and httpOnly',
    fail:'session token stored in localStorage, readable by any script',
    pass:'signed httpOnly secure cookie, sameSite lax',
    fix:"cookies().set('sid', token, { httpOnly:true, secure:true, sameSite:'lax' })",
    how:'trace where the session token is written'},
   {id:'input',name:'Queries are parameterised and input is validated',
    fail:'one raw template-string query in /api/orders',
    pass:'every query parameterised, zod schema on each route',
    fix:"const { id } = OrderParams.parse(await req.json())",
    how:'AST scan for string-concatenated SQL and unvalidated request bodies'},
   {id:'headers',name:'Security headers and CORS are set',
    fail:'no CSP, no HSTS, CORS is Access-Control-Allow-Origin: *',
    pass:'CSP, HSTS, frame-deny, CORS pinned to the app origin',
    fix:"export const headers = () => [{ key:'Content-Security-Policy', value:CSP }]",
    how:'read next.config / middleware for the response header set'}
  ];

  const LEVELS=[
   {n:1,name:'Overgrown', tone:'#B32527', era:'Ruin in a forest',
    blurb:'Nobody has been here in years. The forest took it back.'},
   {n:2,name:'Cleared',   tone:'#D2321F', era:'Timber settlement',
    blurb:'Someone cut back the trees and put a roof on. That is all.'},
   {n:3,name:'Built',     tone:'#EF8934', era:'Stone and plaster town',
    blurb:'A real hall on a real street. Tended, lit, watched.'},
   {n:4,name:'Developed', tone:'#F3B23E', era:'Concrete and steel',
    blurb:'Paved, wired, and lit at night. The forest is decoration now.'},
   {n:5,name:'Fortified', tone:'#5B9B3A', era:'Mistral waterfront',
    blurb:'Orange steel, glass, cable spans. Nothing gets in that you did not let in.'}
  ];

  /* ---------- filler props, meaningless on purpose ---------- */
  const P=r=>bake(r);
  const PROPART={
   deadtree:[
    ".....v........","...vvv..vv....","..v..v.v..v...","....vvv.v.....","...v.vv.......",
    "......v.......","......vv......","......vv......","......vv......","......vv......",
    ".....svv......","......vv......"],
   stump:[
    "..........","..BBBB....",".BvvvvB...","BvbbbbvB..","BvbbbbvB..",".BvvvvB...","..BBBB....",
    "...ss.s..."],
   boulder:[
    "....####....","..##GGGG##..",".#GGggggG#..","#GgggggggG#.","#Ggggggggg#.",".#GgggggG#..","..########..",
    "...ssssss..."],
   bramble:[
    "..l...l...","l.ll.ll..l",".llLllLll.","llLlllllLl",".lllllllL.","..llllll..","...l..l..."],
   weeds:[
    "..l..l....",".lL.ll..l.","lllLllllL.",".lllllll..","..l.ll.l.."],
   logpile:[
    "..........",".BBBBBBBB.","BvbvbvbvbB","BvbvbvbvbB",".BBBBBBBB.","..ssssss.."],
   hedge:[
    ".llllllll.","lLLllLLlll","llllllllll","lllLllllLl","llllllllll",".########."],
   planter:[
    "...l..l...","..lLllLl..",".llllllll.","..llllll..",".gGGGGGGg.",".gGgggggg.",".gGGGGGGg.","..######.."],
   /* RING era 5 referenced this twice with no sprite, so the if(!sp)return
      guard silently dropped two waterfront props on every frame. */
   topiary:[
    "...LL...","..LlLL..",".LlllLL.","LlllllLL",".LlllLL.","..LllL..","...bb...","..gGGg..",".gGGGGg.",".gGggGg.","..####.."],
   woodlamp:[
    "...##...","..#WW#..","..#WW#..","...##...","...bb...","...bb...","...bb...","...bb...","...bb...","..svvs.."],
   steellamp:[
    "..#####.","..#WWW#.","..#WWW#.","...###..","....h...","....h...","....h...","....h...","....h...","....h...","...ghg..",
    "..sghgs."],
   bollard:[
    "..oo..",".oooo.",".o##o.",".oooo.",".oooo.",".oooo.","..ss.."],
   bench:[
    "..........",".bbbbbbbb.",".bbbbbbbb.","..........",".b......b.",".b......b.","..ss..ss.."],
   pipes:[
    "..........",".gGGGGGGg.",".gggggggg.",".gGGGGGGg.","..g....g..","..g....g..",".ggg..ggg.","..ssssss.."],
   container:[
    "..............",".tttttttttttt.",".toooooooooot.",".tototototot..",".toooooooooot.",".tttttttttttt.",
    "..ssssssssss.."],
   vent:[
    "........",".gGGGGg.",".g####g.",".gGGGGg.",".gggggg.","..ssss.."],
   pylon:[
    "...oo...","..o##o..","..o##o..","..oooo..","..o##o..","..o##o..","..oooo..","..o##o..","..o##o..","..oooo..",
    ".oo##oo.",".o####o.",".oooooo.","..ssss.."],
   antenna:[
    "...g....","..ggg...","...g....","...g....","..g.g...",".g...g..","g.....g.","..ooo...","..o.o...",".oo.oo..",
    ".o...o..","oo...oo.","..sss..."],
   cablespan:[
    ".....oo.....o.....",".ooo.oo.ooo.o.ooo.","o...oooo...ooo...o","....oooo....oo....",
    "....o##o....o#o...","....o##o....o#o...","....o##o....o#o...","....oooo....ooo...",
    "....o##o....o#o...","....oooo....ooo...","...ssssss...sss..."],
   sapling:[
    "..ll..",".lLLl.","llLLll",".lLLl.","..kk..","..kk..",".skks."],
   crate:[
    "........",".bBBBBb.",".BbbbbB.",".bBBBBb.",".BbbbbB.","..ssss.."],
   barrel:[
    "..BBBB..",".BvvvvB.",".vBBBBv.",".BvvvvB.",".vBBBBv.",".BvvvvB.","..ssss.."],
   mud:[
    "...ffff...","..fFffff..",".fffffffff",".ffffffff.","..ffffff.."],
   grate:[
    "..........",".gGgGgGg..",".GgGgGgG..",".gGgGgGg..","..........."]
  };
  Object.keys(PROPART).forEach(k=>{ SPR[k]=P(PROPART[k]) });
  TOWNSFOLK.forEach((set,li)=>set.forEach((r,vi)=>{
    let rows=mkBuilding(r);
    if(li===0) rows=ruinRows(rows,vi*13.7);
    SPR['fill'+(li+1)+vi]=bake(rows);
  }));
  buildSites();

  /* ---------- the five town halls ---------- */
  function thWild(){ /* L1: mossy ruin swallowed by the forest */
    const w=34,h=34,g=grid(w,h+3);
    box(g,2,10,w-4,h-10,'G');          // stone shell
    box(g,w-7,10,5,h-10,'h');
    box(g,4,12,w-8,3,'l'); box(g,6,20,5,2,'l'); box(g,20,16,6,2,'l');  // ivy
    box(g,3,8,12,3,'h'); box(g,20,7,10,4,'h');                          // broken parapet
    for(let i=0;i<3;i++) box(g,5+i*9,18,6,8,'m');                       // gaping windows
    for(let i=0;i<4;i++) box(g,4,16+i*5,w-8,2,'B');                     // boards nailed across
    box(g,14,h-11,7,11,'m');
    box(g,1,4,8,7,'l'); box(g,25,3,9,8,'l');                            // saplings on the roof
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=rnd(x*4.7+y*9.3);
      if(g[y]&&g[y][x]!=='.'&&n>0.78) g[y][x]= n>0.92?'.':'s';
    }
    outline(g,'#'); box(g,3,h+2,w-6,1,'s');
    return toRows(g);
  }
  function thTimber(){ /* L2: someone cut the trees back and put a roof on */
    const w=34,h=42,g=grid(w,h+3);
    const rh=14;
    box(g,2,rh,w-4,h-rh,'b'); box(g,w-6,rh,4,h-rh,'B');
    for(let j=0;j<rh;j++){                                  // plain gable, dull tile
      const ins=Math.round((rh-1-j)*(w/2-2)/rh);
      box(g,ins,j,w-ins*2,1, j<rh*0.4?'R':'r');
    }
    for(let i=0;i<4;i++) box(g,3,rh+2+i*6,w-6,1,'B');       // timber banding
    windows(g,5,rh+4,w-10,16,2,1,'w');
    box(g,Math.round(w/2)-4,h-13,8,13,'v');
    box(g,Math.round(w/2)-2,h-4,4,4,'m');
    outline(g,'#'); box(g,3,h+2,w-6,1,'s');
    return toRows(g);
  }
  function thStone(){ /* L3: plaster, masonry, the first real Mistral roof */
    const w=38,h=52,g=grid(w,h+3);
    const rh=15, by=rh;
    box(g,2,by,w-4,h-by,'c'); box(g,w-6,by,4,h-by,'n');
    box(g,2,h-8,w-4,8,'g');                                 // stone plinth
    earRoof(g,0,0,w,rh+2,['o','t','r','R','R']);
    windows(g,4,by+4,w-8,22,3,2,'w');
    const mx=Math.round(w/2)-5,my=by+28;
    ['1.1.1','1.1.1','22322','33433','44444'].forEach((rw,j)=>[...rw].forEach((c2,i)=>{
      if(c2==='.')return; box(g,mx+i*2,my+j*2,2,2,'yotrR'[+c2-1]);}));
    box(g,Math.round(w/2)-4,h-12,8,12,'v');
    box(g,Math.round(w/2)-2,h-4,4,4,'m');
    outline(g,'#'); box(g,3,h+2,w-6,1,'s');
    return toRows(g);
  }
  function thSteel(){ /* L4: concrete core, orange steel frame, glass grid */
    const w=42,h=64,g=grid(w+10,h+3), ox=5;
    const by=10;
    box(g,ox+2,by,w-4,h-by,'e');                            // pale concrete
    box(g,ox+w-7,by,5,h-by,'c');
    for(let i=0;i<5;i++) box(g,ox+2,by+6+i*10,w-4,2,'o');   // steel floor bands
    box(g,ox+2,by,3,h-by,'t'); box(g,ox+w-5,by,3,h-by,'t'); // corner columns
    windows(g,ox+7,by+3,w-14,44,3,4,'W');
    bandFill(g,ox,by-8,w,8,['y','o','t','r']);              // crown
    earRoof(g,ox+4,0,w-8,10,['y','o','t','r','R']);
    box(g,ox+Math.round(w/2),0,1,6,'g'); box(g,ox+Math.round(w/2)-2,0,5,3,'y');
    box(g,ox+Math.round(w/2)-5,h-14,10,14,'x');             // glass door
    box(g,ox+Math.round(w/2)-2,h-4,4,4,'m');
    box(g,ox-4,h-20,6,20,'g'); box(g,ox+w-2,h-20,6,20,'g'); // side plant blocks
    bandFill(g,ox-5,h-24,8,4,['o','t','r']); bandFill(g,ox+w-3,h-24,8,4,['o','t','r']);
    outline(g,'#'); box(g,ox+3,h+2,w-6,1,'s');
    return toRows(g);
  }
  /* the exact Mistral mark, 7 x 5. two ears, a band, three legs, a split base. */
  const MARKGRID=[
    '.y...y.',
    '.OO.OO.',
    '.ooooo.',
    '.t.t.t.',
    'RRR.RRR'
  ];
  function stampMark(g,x,y,cell,pal){
    const map=pal||{y:'y',O:'o',o:'o',t:'t',R:'R'};
    const ramp={y:'y',O:'o',o:'t',t:'r',R:'R'};
    MARKGRID.forEach((row,j)=>[...row].forEach((ch,i)=>{
      if(ch==='.')return;
      box(g,x+i*cell,y+j*cell,cell,cell,ramp[ch]);
    }));
  }
  function thMistral(){ /* L5: a Mistral skyscraper. the mark is the crown. */
    const w=54,h=106,g=grid(w,h+3);
    const cell=6, mw=7*cell, mh=5*cell;          // 42 x 30
    const sx=Math.round((w-mw)/2), shaftTop=mh-cell; // shaft tucks under the mark's last row
    const podH=22, podY=h-podH;

    /* shaft */
    box(g,sx,shaftTop,mw,podY-shaftTop,'e');
    box(g,sx+mw-6,shaftTop,6,podY-shaftTop,'c');
    box(g,sx,shaftTop,3,podY-shaftTop,'t');       // structural columns
    box(g,sx+mw-3,shaftTop,3,podY-shaftTop,'t');
    for(let y=shaftTop+10;y<podY-6;y+=13) box(g,sx,y,mw,2,'o');  // floor bands
    windows(g,sx+5,shaftTop+4,mw-10,podY-shaftTop-10,3,6,'W');

    /* podium, wider than the shaft */
    box(g,1,podY,w-2,podH,'g'); box(g,w-6,podY,5,podH,'G');
    box(g,1,podY,w-2,3,'t');
    box(g,3,podY+6,w-6,2,'o');
    box(g,Math.round(w/2)-8,h-14,16,14,'x');      // glass entrance
    box(g,Math.round(w/2)-2,h-4,4,4,'m');         // cat flap
    for(let i=0;i<3;i++){ box(g,6+i*4,podY+11,2,6,'W'); box(g,w-12+i*4,podY+11,2,6,'W'); }

    /* the crown: the mark itself, sitting on top of the shaft */
    stampMark(g,sx,1,cell);
    /* aviation lights on both ears */
    box(g,sx+cell+2,0,2,1,'R'); box(g,sx+5*cell+2,0,2,1,'R');

    outline(g,'#');
    box(g,3,h+2,w-6,1,'s');
    return toRows(g);
  }
  const BAKED_TH=[thWild,thTimber,thStone,thSteel,thMistral].map(f=>bake(f()));

  /* a Golden Gate span, decorative. shows up once the place is developed. */
  function bridgeSpan(scale){
    const w=scale===1?84:58, h=scale===1?42:32;
    const g=grid(w,h);
    const pierW=scale===1?7:5, lp=Math.round(w*0.22), rp=w-lp-pierW;
    const top=4, deckY=h-9;
    const cl=lp+Math.floor(pierW/2), cr=rp+Math.floor(pierW/2);
    box(g,0,deckY,w,3,'G'); box(g,0,deckY+2,w,2,'h');
    for(let x=2;x<w-2;x+=7) box(g,x,deckY+1,3,1,'e');
    box(g,0,deckY-4,5,4,'h'); box(g,w-5,deckY-4,5,4,'h');
    [lp,rp].forEach(px=>{
      box(g,px,top,pierW,deckY-top,'t');
      box(g,px+pierW-2,top,2,deckY-top,'r');
      box(g,px+1,top+7,pierW-2,2,'o'); box(g,px+1,top+16,pierW-2,2,'o');
      box(g,px-1,top-2,pierW+2,3,'y');
    });
    const cy=x=>{
      if(x>=cl&&x<=cr) return top+Math.round(Math.sin(Math.PI*(x-cl)/(cr-cl))*(scale===1?11:8));
      if(x<cl) return top+Math.round((cl-x)/(cl-2)*(deckY-5-top));
      return top+Math.round((x-cr)/(w-3-cr)*(deckY-5-top));
    };
    let prev=cy(1);
    for(let x=1;x<w-1;x++){
      const y=cy(x), lo=Math.min(y,prev), hi=Math.max(y,prev);
      for(let k=lo;k<=hi;k++) if(k<deckY-1&&g[k]) g[k][x]='o';
      prev=y;
    }
    for(let x=cl+3;x<cr;x+=4) for(let y=cy(x)+1;y<deckY;y++) if(g[y]&&g[y][x]==='.') g[y][x]='o';
    outline(g,'#');
    return bake(toRows(g));
  }
  SPR.bridge=bridgeSpan(0); SPR.bigbridge=bridgeSpan(1);


  /* ---------- the plot: ground + filler, per level ---------- */
  function districtGround(lv,tw,thh){
    const W=tw*TS, H=thh*TS, g=grid(W,H);
    const mix={
      1:{base:'A',spec:['l','f','a'],dens:0.30},
      2:{base:'a',spec:['z','d'],dens:0.16},
      3:{base:'6',spec:['7','z','d'],dens:0.14},
      4:{base:'1',spec:['2','7','d'],dens:0.14},
      5:{base:'2',spec:['1','3','9'],dens:0.10}
    }[lv];
    box(g,0,0,W,H,mix.base);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if(rnd(x*3.1+y*7.9+lv*11)<mix.dens) g[y][x]=mix.spec[Math.floor(rnd(x*5.5+y*2.2)*mix.spec.length)];
    }
    if(lv===1){ for(let i=0;i<7;i++){ const x=Math.floor(rnd(i*13)*W),y=Math.floor(rnd(i*17+3)*H);
      box(g,x,y,10+Math.floor(rnd(i)*12),5+Math.floor(rnd(i+1)*5),'f'); } }
    if(lv<=3){ /* erode the edge so the plot does not read as a rectangle */
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const ex=Math.min(x,W-1-x)/ (W*0.22), ey=Math.min(y,H-1-y)/(H*0.22);
        const e=Math.min(1,Math.min(ex,ey));
        if(rnd(x*2.7+y*5.3+lv*7)> e*0.96) g[y][x]='.';
      }
    }
    if(lv>=4){ /* warm slabs, with Mistral-ramp accent squares dropped in */
      for(let y=0;y<H;y+=16) box(g,0,y,W,1,'3');
      for(let x=0;x<W;x+=16) box(g,x,0,1,H,'3');
      const ramp=['y','o','t','r'];
      for(let y=0;y<H;y+=16)for(let x=0;x<W;x+=16){
        const n=rnd(x*2.3+y*5.7+lv*13);
        if(n> (lv===5?0.72:0.84)){
          box(g,x+1,y+1,15,15,ramp[Math.floor(rnd(x+y)*ramp.length)]);
        }
      }
    }
    if(lv===5){ /* painted markings + an inset grass strip */
      for(let x=6;x<W-6;x+=10) box(g,x,Math.round(H*0.72),6,2,'e');
      for(let x=2;x<W-2;x+=6) box(g,x,H-10,3,2,'o');
      box(g,4,H-6,W-8,2,'o');
    }
    return bake(toRows(g));
  }
  const DISTRICT_GROUND=[1,2,3,4,5].map(lv=>districtGround(lv,lv<=2?7:lv===3?8:10,lv<=2?5:6));

  /* dx,dy in tiles from the hall anchor. count climbs with the level. */
  const RING=[
   /*1 overgrown*/[
    [-4.4,-.6,'deadtree'],[4.2,-1,'deadtree'],[-2.6,.7,'bramble'],[2.7,.8,'bramble'],
    [-3.4,.9,'stump'],[3.6,.4,'boulder'],[-1.6,1.1,'weeds'],[1.7,1.2,'weeds'],[0,1.4,'mud'],
    [-5,.4,'bramble'],[5,.9,'stump']],
   /*2 cleared*/[
    [-4.2,-.7,'tree'],[4.3,-.9,'tree'],[-3,.8,'logpile'],[3.1,.7,'bush'],[-1.8,1.1,'stump'],
    [2,1.2,'barrel'],[-4.6,.9,'rock'],[4.7,.5,'crate'],[0,1.4,'weeds'],[1.2,-1.1,'bush'],
    [-1.3,1.4,'crate']],
   /*3 built*/[
    [-4.4,-.8,'tree'],[4.5,-.9,'tree'],[-3.2,.8,'hedge'],[3.3,.8,'hedge'],[-4.6,.5,'woodlamp'],
    [4.7,.5,'woodlamp'],[-1.9,1.2,'planter'],[2,1.2,'planter'],[-2.6,-1,'bush'],[2.7,-1,'bush'],
    [0,1.5,'bench'],[5.4,1,'crate'],[-5.4,1,'barrel'],[1.1,1.5,'grate']],
   /*4 developed*/[
    [-5,-.9,'steellamp'],[5,-.9,'steellamp'],[-3.4,.8,'planter'],[3.5,.8,'planter'],
    [-4.4,.9,'bollard'],[-3.9,1.2,'bollard'],[4.4,.9,'bollard'],[3.9,1.2,'bollard'],
    [-6,.3,'pipes'],[6,.4,'vent'],[-2,1.3,'bench'],[2,1.3,'bench'],[0,1.5,'grate'],
    [-6.4,-.8,'tree'],[6.4,-.7,'sapling'],[5.6,1.2,'container'],[-5.6,1.3,'crate'],
    [1.2,-1.2,'sapling'],[-1.2,-1.2,'sapling'],[7,.9,'bollard']],
   /*5 mistral waterfront*/[
    [-6.4,-1.1,'pylon'],[6.4,-1.1,'pylon'],[-4.6,-1.3,'antenna'],[4.6,-1.3,'antenna'],
    [-5.4,.9,'steellamp'],[5.4,.9,'steellamp'],[-3.4,1.1,'topiary'],[3.4,1.1,'topiary'],
    [-2,1.4,'bollard'],[-1.2,1.4,'bollard'],[1.2,1.4,'bollard'],[2,1.4,'bollard'],
    [-7.2,.5,'container'],[7.2,.5,'container'],[-6.2,1.3,'pipes'],[6.2,1.3,'vent'],
    [-4.4,1.4,'bench'],[4.4,1.4,'bench'],[0,1.6,'grate'],[-8,-.6,'cablespan'],[8,-.6,'cablespan'],
    [-2.6,-1.4,'sapling'],[2.6,-1.4,'sapling'],[7.8,1.2,'bollard'],[-7.8,1.2,'bollard'],
    [-3.2,-1.1,'planter'],[3.2,-1.1,'planter']]
  ];

  /* ============================================================
     4. STATE
     ============================================================ */
  const S={
    systems:[],huts:[],selected:null,armed:null,busy:{},connected:false,
    energy:MODEL.city.energy,knowledge:MODEL.city.knowledge,health:0,
    tp:MODEL.repo.tests.pass,tt:MODEL.repo.tests.total,
    cam:{x:16*TS,y:13*TS,z:2,xt:16*TS,yt:13*TS,zt:2},
    score:1,scoreShown:1,cats:[],ambient:[],fx:[],scaffolds:[],revealed:false,tick:0
  };

  const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
  const stage=document.getElementById('stage');
  function resize(){
    const r=stage.getBoundingClientRect();
    const dpr=Math.min(3,window.devicePixelRatio||1);
    S.vw=Math.max(1,Math.round(r.width)); S.vh=Math.max(1,Math.round(r.height));
    cv.width=Math.round(S.vw*dpr); cv.height=Math.round(S.vh*dpr);
    cv.style.width=S.vw+'px'; cv.style.height=S.vh+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=false;
  }
  WIN('resize',resize); resize();

  /* A tile or site flips to the next era once the score's fractional part
     passes its own threshold. Whole numbers are uniform; everything between is
     a genuine mix of the two neighbouring eras. */
  function eraFor(off){
    const sv=S.scoreShown, base=Math.floor(sv);
    return Math.max(1,Math.min(5, base + ((sv-base)>off ? 1 : 0)));
  }
  function hallLevel(){ return Math.max(1,Math.min(5,Math.round(S.scoreShown))); }
  /* grid placement that always lands inside the board, whatever MW and MH are */
  const AP_COLS=4, AP_MX=5, AP_MY=8, AP_STEPY=7;
  const AP_STEPX=Math.max(5,Math.floor((MW-AP_MX*2)/(AP_COLS-1)));
  const AP_ROWS=Math.max(1,Math.floor((MH-AP_MY-3)/AP_STEPY)+1);
  function autoPlace(i){
    const c=i%AP_COLS, r=Math.floor(i/AP_COLS)%AP_ROWS;
    return { tx:Math.min(MW-3,AP_MX+c*AP_STEPX), ty:Math.min(MH-4,AP_MY+r*AP_STEPY) };
  }
  function setScore(v){
    const nv=Math.max(1,Math.min(5,Number(v)||1));
    if(Math.abs(nv-S.score)<0.0005) return nv;
    const was=S.score, wasEra=hallLevelOf(was);
    S.score=nv;
    themeTiles(Math.floor(nv)); themeTiles(Math.min(5,Math.floor(nv)+1));  // bake before the wave
    /* only speak when the era actually turns over, or a slider drag floods the log */
    const era=hallLevelOf(nv);
    if(era!==wasEra) log(`security ${Math.round((nv-1)/4*100)}%, the town is <b>${LEVELS[era-1].name}</b>`,
                         nv>was?'good':'bad');
    return nv;
  }
  function hallLevelOf(v){ return Math.max(1,Math.min(5,Math.round(v))); }
  function sysAt(id){return S.systems.find(s=>s.id===id)}
  function sprFor(s){
    if(s.kind==='tower') return BAKED_TH[(s.level||3)-1];
    if(s.status==='broken'&&BAKED_DMG[s.kind]) return BAKED_DMG[s.kind];
    return BAKED[s.kind];
  }
  function anchor(s){ /* world px, bottom-centre */
    const sp=sprFor(s); return {x:s.tx*TS+TS/2, y:s.ty*TS+TS, w:sp.width, h:sp.height};
  }

  /* ============================================================
     5. RENDER LOOP
     ============================================================ */
  const ZMIN=1, ZMAX=4;
  function clampCam(){
    const z=S.cam.zt, W=MW*TS, H=MH*TS;
    const mx=Math.min(S.vw/(2*z),W/2), my=Math.min(S.vh/(2*z),H/2);
    S.cam.xt=Math.max(mx,Math.min(W-mx,S.cam.xt));
    S.cam.yt=Math.max(my,Math.min(H-my,S.cam.yt));
  }
  /* keeps the world point under (sx,sy) pinned while the zoom changes */
  function zoomTo(nz,sx,sy){
    nz=Math.max(ZMIN,Math.min(ZMAX,Math.round(nz)));
    if(nz===S.cam.zt) return;
    if(sx==null){sx=S.vw/2;sy=S.vh/2}
    const z0=S.cam.zt;
    const wx=(sx-S.vw/2)/z0+S.cam.xt, wy=(sy-S.vh/2)/z0+S.cam.yt;
    S.cam.zt=nz;
    S.cam.xt=wx-(sx-S.vw/2)/nz; S.cam.yt=wy-(sy-S.vh/2)/nz;
    clampCam();
  }
  function panTarget(x,y){ S.cam.xt=x; S.cam.yt=y; clampCam(); }

  function draw(){
    S.tick++;
    /* Ease on elapsed time, not frames: a fixed per-frame factor runs at half
       speed on a 30Hz projector, which the handoff warns about. Settles exactly
       so the zoom comes to rest on a whole number and pixels stay square. */
    const tnow=performance.now();
    const dt=Math.min(64,tnow-(S.lastT||tnow)); S.lastT=tnow;
    const ease=1-Math.exp(-dt/70);
    S.cam.z+=(S.cam.zt-S.cam.z)*ease;
    S.cam.x+=(S.cam.xt-S.cam.x)*ease;
    S.cam.y+=(S.cam.yt-S.cam.y)*ease;
    if(Math.abs(S.cam.zt-S.cam.z)<0.0015) S.cam.z=S.cam.zt;
    if(Math.abs(S.cam.xt-S.cam.x)<0.05) S.cam.x=S.cam.xt;
    if(Math.abs(S.cam.yt-S.cam.y)<0.05) S.cam.y=S.cam.yt;
    /* the wave: easing the score is what makes blocks flip in sequence */
    const sEase=1-Math.exp(-dt/300);
    S.scoreShown+=(S.score-S.scoreShown)*sEase;
    if(Math.abs(S.score-S.scoreShown)<0.0015) S.scoreShown=S.score;

    const z=S.cam.z;
    ctx.imageSmoothingEnabled=false;
    const sv=Math.max(1,Math.min(5,S.scoreShown));
    const eLo=Math.max(1,Math.min(4,Math.floor(sv))), eHi=Math.min(5,eLo+1);
    const sFrac=sv-Math.floor(sv);
    ctx.fillStyle=mixHex(TILE_THEME[eLo-1].back,TILE_THEME[eHi-1].back,sFrac);
    ctx.fillRect(0,0,S.vw,S.vh);

    /* the Town Hall cannot show a half state, so it steps at the midpoint */
    const _th=S.systems.find(x=>x.kind==='tower');
    if(_th){ const hl=hallLevel(); if(_th.level!==hl){ _th.level=hl; _th.grow=0.4; } }
    const ox=Math.round(S.vw/2 - S.cam.x*z), oy=Math.round(S.vh/2 - S.cam.y*z);

    /* tiles. Bounds are the viewport, not the board: outside 34x29 the terrain
       is generated on the fly so the ground runs to every edge of the canvas. */
    const x0=Math.floor(-ox/z/TS), x1=Math.ceil((S.vw-ox)/z/TS);
    const y0=Math.floor(-oy/z/TS), y1=Math.ceil((S.vh-oy)/z/TS);
    /* two cached atlases in flight, one comparison per tile picks between them */
    const TA=themeTiles(eLo), TB=themeTiles(eHi);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      let k,tv,v;
      if(x>=0&&x<MW&&y>=0&&y<MH){ k=map[y][x]; tv=tmap[y][x]; v=vmap[y][x]; }
      else { const o=outskirt(x,y); k=o.k; tv=o.t; v=o.v; }
      ctx.drawImage((sFrac>tv?TB:TA)[k][v], ox+x*TS*z, oy+y*TS*z, TS*z, TS*z);
    }

    /* depth-sorted entities */
    const ents=[];
    const th=S.systems.find(x=>x.kind==='tower');
    if(th){
      const lv=hallLevel(), ax=th.tx*TS+TS/2, ay=th.ty*TS+TS;
      const dg=DISTRICT_GROUND[lv-1];
      ctx.drawImage(dg,Math.round(ox+(ax-dg.width/2)*z),Math.round(oy+(ay-dg.height*0.62)*z),
        dg.width*z,dg.height*z);
      RING[lv-1].forEach(([dx,dy,k])=>{
        const sp=SPR[k]; if(!sp)return;
        const px=ax+dx*TS, py=ay+dy*TS;
        ents.push({y:py,draw:()=>ctx.drawImage(sp,Math.round(ox+(px-sp.width/2)*z),
          Math.round(oy+(py-sp.height)*z),sp.width*z,sp.height*z)});
      });
    }
    SITES.forEach(p=>{
      if(sv<p.thresh) return;
      const era=eraFor(p.off);
      const vocab=PROP_VOCAB[era-1];
      const sp=SPR[p.house ? 'fill'+era+(p.vi%3) : vocab[p.vi%vocab.length]];
      if(!sp) return;
      ents.push({y:p.y,draw:()=>ctx.drawImage(sp,ox+p.x*z,oy+(p.y-sp.height+TS)*z,sp.width*z,sp.height*z)});
    });
    S.systems.forEach(s=>{
      if(s.hidden) return;
      const a=anchor(s);
      ents.push({y:a.y,draw:()=>drawBuilding(s,a,ox,oy,z)});
    });
    S.huts.forEach(h=>{
      const sp=BAKED.hut, a={x:h.tx*TS+TS/2,y:h.ty*TS+TS};
      ents.push({y:a.y,draw:()=>{
        const px=Math.round(ox+(a.x-sp.width/2)*z), py=Math.round(oy+(a.y-sp.height)*z);
        ctx.drawImage(sp,px,py,sp.width*z,sp.height*z);
        /* tint the roof by agent */
        ctx.globalAlpha=.45; ctx.fillStyle=AGENTS[h.agent].accent;
        ctx.fillRect(px+2*z,py+1*z,(sp.width-4)*z,8*z); ctx.globalAlpha=1;
        const c=CATS[h.agent].sit;
        if(!S.busy['agent-'+h.agent]) ctx.drawImage(c,px+(sp.width+2)*z,py+(sp.height-c.height-1)*z,c.width*z,c.height*z);
        labelSm(AGENTS[h.agent].verb,px+sp.width*z/2,py-3,z,AGENTS[h.agent].accent);
      }});
    });
    S.scaffolds.forEach(sc=>ents.push({y:sc.y+1,draw:()=>{
      ctx.drawImage(sc.spr,Math.round(ox+(sc.x-sc.spr.width/2)*z),Math.round(oy+(sc.y-sc.spr.height)*z),
        sc.spr.width*z,sc.spr.height*z);
    }}));
    /* ambient life: wandering cats, swaying grass, birds. costs one array walk. */
    S.ambient.forEach(a=>{
      if(a.kind==='cat'){
        if(a.wait>0) a.wait--;
        else{
          const dx=a.tx-a.x, dy=a.ty-a.y, d=Math.hypot(dx,dy)||1;
          if(d<2){ a.wait=140+Math.floor(rnd(S.tick+a.ph)*300);
                   a.tx=a.hx+(rnd(S.tick*1.3+a.ph)-0.5)*180;
                   a.ty=a.hy+(rnd(S.tick*2.1+a.ph)-0.5)*120; }
          else { a.x+=dx/d*0.3; a.y+=dy/d*0.3; a.dir=dx<0?-1:1; }
        }
        const sp = a.wait>0 ? a.spr.sit : (Math.floor(S.tick/9)%2?a.spr.w1:a.spr.w2);
        ents.push({y:a.y,draw:()=>{
          const px=Math.round(ox+(a.x-sp.width/2)*z), py=Math.round(oy+(a.y-sp.height)*z);
          ctx.save();
          if(a.dir<0){ctx.translate(px+sp.width*z,py);ctx.scale(-1,1);ctx.drawImage(sp,0,0,sp.width*z,sp.height*z)}
          else ctx.drawImage(sp,px,py,sp.width*z,sp.height*z);
          ctx.restore();
        }});
      } else if(a.kind==='tuft'){
        const sp = Math.sin(S.tick*0.045+a.ph)>0 ? a.spr.a : a.spr.b;
        ents.push({y:a.y,draw:()=>ctx.drawImage(sp,Math.round(ox+(a.x-sp.width/2)*z),
          Math.round(oy+(a.y-sp.height)*z),sp.width*z,sp.height*z)});
      } else if(a.kind==='bird'){
        a.x+=a.vx; a.by=Math.sin(S.tick*0.05+a.ph)*4;
        if(a.x>MW*TS+60) a.x=-60;
        const flap=Math.floor(S.tick/6)%2?1:0;
        ents.push({y:9e5,draw:()=>{
          const px=Math.round(ox+a.x*z), py=Math.round(oy+(a.y+a.by)*z);
          ctx.fillStyle='#3A3A48';
          ctx.fillRect(px,py,2*z,z);
          ctx.fillRect(px-2*z,py-flap*z,2*z,z);
          ctx.fillRect(px+2*z,py-flap*z,2*z,z);
        }});
      }
    });
    S.cats.forEach(c=>ents.push({y:c.y,draw:()=>{
      const spr = c.state==='work' ? (S.tick%18<9?CATS[c.agent].work:CATS[c.agent].walk1)
                : (Math.floor(S.tick/7)%2 ? CATS[c.agent].walk1 : CATS[c.agent].walk2);
      const px=Math.round(ox+(c.x-spr.width/2)*z), py=Math.round(oy+(c.y-spr.height)*z);
      ctx.save();
      if(c.dir<0){ctx.translate(px+spr.width*z,py);ctx.scale(-1,1);ctx.drawImage(spr,0,0,spr.width*z,spr.height*z)}
      else ctx.drawImage(spr,px,py,spr.width*z,spr.height*z);
      ctx.restore();
      if(c.say&&S.tick<c.sayUntil) bubble(c.say,px+spr.width*z/2,py-6,z);
    }}));
    ents.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());

    /* level light, over the world but under the fog and particles */
    const gl=anchorLerp(GLOOM,sv), wm=anchorLerp(WARM,sv);
    if(gl>0.001){ ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=gl;
      ctx.fillStyle='#16241A'; ctx.fillRect(0,0,S.vw,S.vh); ctx.restore(); }
    if(wm>0.001){ ctx.save(); ctx.globalCompositeOperation='overlay'; ctx.globalAlpha=wm;
      ctx.fillStyle='#FFDCA6'; ctx.fillRect(0,0,S.vw,S.vh); ctx.restore(); }

    /* fog over unknown ground */
    S.systems.filter(s=>s.status==='unknown').forEach(s=>{
      const a=anchor(s);
      const cx=ox+a.x*z, cy=oy+(a.y-a.h/2)*z, R=90*z;
      for(let i=0;i<3;i++){
        const t=S.tick*0.012+i*2.1;
        const g2=ctx.createRadialGradient(cx+Math.sin(t)*12*z,cy+Math.cos(t*.7)*8*z,0,cx,cy,R);
        g2.addColorStop(0,'rgba(150,160,185,.55)');
        g2.addColorStop(.6,'rgba(130,140,168,.35)');
        g2.addColorStop(1,'rgba(120,130,160,0)');
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.fill();
      }
      ctx.fillStyle='#FAF8F4'; ctx.font=`700 ${Math.round(16*z)}px Silkscreen, monospace`;
      ctx.textAlign='center'; ctx.fillText('?',cx,cy+6*z);
    });

    /* particles */
    S.fx=S.fx.filter(p=>{
      p.life--; p.x+=p.vx; p.y+=p.vy; p.vy+=p.g||0;
      if(p.life<=0) return false;
      ctx.globalAlpha=Math.max(0,Math.min(1,p.life/p.max));
      ctx.fillStyle=p.c;
      const s=Math.max(1,Math.round(p.s*z));
      ctx.fillRect(Math.round(ox+p.x*z),Math.round(oy+p.y*z),s,s);
      ctx.globalAlpha=1; return true;
    });

    /* floating numbers */
    S.floats=(S.floats||[]).filter(f=>{
      f.life--; f.y-=0.45;
      if(f.life<=0)return false;
      ctx.globalAlpha=Math.min(1,f.life/24);
      ctx.font=`700 ${Math.round(11*z)}px Silkscreen, monospace`;
      ctx.textAlign='center';
      ctx.fillStyle=C.ink; ctx.fillText(f.txt,ox+f.x*z+2,oy+f.y*z+2);
      ctx.fillStyle=f.c||C.y; ctx.fillText(f.txt,ox+f.x*z,oy+f.y*z);
      ctx.globalAlpha=1; return true;
    });

    S.raf=requestAnimationFrame(draw);
  }

  function drawBuilding(s,a,ox,oy,z){
    let spr = sprFor(s);
    const px=Math.round(ox+(a.x-spr.width/2)*z), py=Math.round(oy+(a.y-spr.height)*z);
    const dim = S.selected && S.selected.id!==s.id && !(S.selected.connections||[]).includes(s.id);
    if(dim) ctx.globalAlpha=.55;
    if(s.grow!==undefined&&s.grow<1){
      const g=s.grow, hh=spr.height*g;
      ctx.drawImage(spr,0,spr.height-hh,spr.width,hh, px,py+(spr.height-hh)*z, spr.width*z, hh*z);
      s.grow=Math.min(1,s.grow+0.09);
    } else {
      ctx.drawImage(spr,px,py,spr.width*z,spr.height*z);
    }
    ctx.globalAlpha=1;

    if(S.selected&&S.selected.id===s.id){
      ctx.strokeStyle=C.t; ctx.lineWidth=Math.max(2,z);
      ctx.setLineDash([4*z,3*z]); ctx.lineDashOffset=-S.tick*0.4;
      ctx.strokeRect(px-3*z,py-3*z,spr.width*z+6*z,spr.height*z+6*z);
      ctx.setLineDash([]);
    }
    /* status pip + name */
    if(s.status!=='unknown'){
      const col = s.status==='healthy'?'#5B9B3A':s.status==='warning'?C.o:C.r;
      const showName = S.selected&&S.selected.id===s.id || s.hover || s.status!=='healthy' || s.kind==='tower';
      if(showName){
        if(s.kind==='tower'){
          const L=LEVELS[(s.level||1)-1];
          label(`${s.name}   ${L.name}`,px+spr.width*z/2,py-4,z,C.ink,C.paper,L.tone,(s.level/5)*100);
        } else label(`${s.name}  ${s.health}%`,px+spr.width*z/2,py-4,z,C.ink,C.paper,col,s.health);
      }
    }
    /* ambient fx */
    if(s.status==='broken'&&S.tick%3===0) emit(a.x+(Math.random()*20-10),a.y-spr.height*0.7,'fire');
    if(s.status==='warning'&&S.tick%14===0) emit(a.x+(Math.random()*14-7),a.y-spr.height*0.8,'smoke');
    if(s.status==='healthy'&&S.tick%40===0&&Math.random()>.7) emit(a.x+(Math.random()*16-8),a.y-spr.height*0.9,'glint');
    if(s.kind==='workshop'&&S.tick%26===0) emit(a.x+spr.width*0.28,a.y-spr.height-4,'smoke');
  }

  function labelSm(text,cx,by,z,accent){
    ctx.font=`700 ${Math.round(7*z)}px Archivo, sans-serif`;
    const w=ctx.measureText(text).width+7*z,h=11*z,x=Math.round(cx-w/2),y=Math.round(by-h);
    ctx.fillStyle=C.ink; ctx.fillRect(x,y,w,h);
    ctx.fillStyle=accent; ctx.fillRect(x,y,3*z,h);
    ctx.fillStyle=C.paper; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(text,cx+1.5*z,y+2*z); ctx.textBaseline='alphabetic';
  }
  function label(text,cx,by,z,fg,bg,barcol,pct){
    ctx.font=`700 ${Math.round(9*z)}px Archivo, sans-serif`;
    const w=ctx.measureText(text).width+10*z, h=(barcol!==undefined?18:14)*z;
    const x=Math.round(cx-w/2), y=Math.round(by-h);
    ctx.fillStyle=bg; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=fg; ctx.lineWidth=Math.max(1,Math.round(z)); ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(text,cx,y+3*z);
    if(barcol!==undefined){
      ctx.fillStyle='#D9D3C8'; ctx.fillRect(x+3*z,y+h-5*z,w-6*z,3*z);
      ctx.fillStyle=barcol; ctx.fillRect(x+3*z,y+h-5*z,(w-6*z)*(pct/100),3*z);
    }
    ctx.textBaseline='alphabetic';
  }
  function bubble(text,cx,by,z){
    ctx.font=`700 ${Math.round(9*z)}px Archivo, sans-serif`;
    const w=ctx.measureText(text).width+10*z,h=14*z,x=Math.round(cx-w/2),y=Math.round(by-h);
    ctx.fillStyle=C.paper; ctx.fillRect(x,y,w,h);
    ctx.fillStyle=C.ink; ctx.fillRect(cx-3*z,y+h,6*z,3*z);
    ctx.strokeStyle=C.ink;ctx.lineWidth=Math.max(1,Math.round(z));ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.fillStyle=C.ink;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(text,cx,y+3*z);
    ctx.textBaseline='alphabetic';
  }

  function emit(x,y,kind){
    if(S.fx.length>420)return;
    if(kind==='fire') S.fx.push({x,y,vx:(Math.random()-.5)*.3,vy:-.55-Math.random()*.5,g:-0.006,
      life:22+Math.random()*14,max:34,s:Math.random()>.5?2:1,c:Math.random()>.45?C.y:C.r});
    if(kind==='smoke') S.fx.push({x,y,vx:(Math.random()-.3)*.25,vy:-.32,g:0,
      life:52,max:52,s:3,c:'#B7B3AA'});
    if(kind==='spark') S.fx.push({x,y,vx:(Math.random()-.5)*1.5,vy:-.8-Math.random(),g:0.045,
      life:26,max:26,s:2,c:Math.random()>.5?C.y:C.o});
    if(kind==='glint') S.fx.push({x,y,vx:0,vy:-.16,life:26,max:26,s:1,c:C.win});
    if(kind==='leaf') S.fx.push({x,y,vx:(Math.random()-.5)*.6,vy:-.5,g:0.02,life:40,max:40,s:2,c:C.leaf2});
  }
  function burst(x,y,n,kind){for(let i=0;i<n;i++)emit(x+(Math.random()*18-9),y,kind||'spark')}
  function floatText(x,y,txt,c){(S.floats=S.floats||[]).push({x,y,txt,c,life:56})}

  /* ============================================================
     6. HUD
     ============================================================ */
  function renderHuts(){
    const el=document.getElementById('h-huts');
    el.innerHTML=Object.entries(AGENTS).map(([k,a])=>
      `<div class="hut" data-a="${k}"><canvas class="px" data-cat="${k}" width="60" height="44"></canvas>
       <div class="cn">${a.name}</div><div class="cv">${a.verb}</div>
       <div class="cost">${a.cost} ENERGY</div></div>`).join('');
    el.querySelectorAll('canvas[data-cat]').forEach(c=>{
      const k=c.dataset.cat, g=c.getContext('2d'); g.imageSmoothingEnabled=false;
      const s=CATS[k].sit; g.drawImage(s,0,0,s.width*4,s.height*4);
    });
    el.querySelectorAll('.hut').forEach(h=>h.addEventListener('click',()=>{
      const k=h.dataset.a;
      S.armed = S.armed===k?null:k;
      document.querySelectorAll('.hut').forEach(x=>x.classList.toggle('armed',x.dataset.a===S.armed));
      stage.classList.toggle('aim',!!S.armed);
      toast(S.armed?`${AGENTS[k].name} ready. Click a building.`:'Cancelled.');
    }));
  }
  const $=id=>document.getElementById(id);
  function setEnergy(v){S.energy=v;$('r-energy').textContent=v}
  function setKnow(v){S.knowledge=v;$('r-know').textContent=v}
  function setTests(){$('r-tests').textContent=S.tt?S.tp+'/'+S.tt:'--'}
  function computeHealth(){
    const k=S.systems.filter(s=>s.status!=='unknown');
    const u=S.systems.filter(s=>s.status==='unknown').length;
    if(!k.length)return 0;
    return Math.max(0,Math.round(k.reduce((a,s)=>a+s.health,0)/k.length - u*4));
  }
  function setHealth(v,d){
    S.health=v; $('chp').textContent=v+'%'; $('cmeter').style.width=v+'%';
    const e=$('chd'); if(d){e.textContent=(d>0?'+':'')+d; e.style.color=d>0?'#5B9B3A':'#D2321F';
      setTimeout(()=>e.textContent='',3500)}
  }
  let nlog=0;
  function log(t,c){
    const b=$('logb'), d=new Date();
    const ts=String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
    const el=document.createElement('div'); el.className='ll '+(c||'');
    el.innerHTML=`<span class="t">${ts}</span><span>${t}</span>`;
    b.appendChild(el); b.scrollTop=b.scrollHeight;
    if(++nlog>150)b.firstChild.remove();
  }
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');
    clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2500)}

  function html(v){return String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c])}
  function issueSource(i){
    const source=i&&i.source;
    if(!source||!source.url||!source.file)return '';
    try{
      const url=new URL(source.url);
      if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='github.com')return '';
      const where=source.file+(Number.isInteger(source.line)?':'+source.line:'');
      return `<a class="src" href="${html(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open source ${html(where)} on GitHub">Source · ${html(where)} &#8599;</a>`;
    }catch(_){return ''}
  }

  /* ============================================================
     7. INSPECTOR
     ============================================================ */
  const ins=$('ins');
  function select(s){
    S.selected=s; renderIns(s); ins.classList.add('on');
    if(S.hooks&&S.hooks.select) try{S.hooks.select(s.id)}catch(_){}
  }
  function deselect(){S.selected=null;ins.classList.remove('on')}
  $('ix').addEventListener('click',deselect);

  function renderIns(s){
    const st=s.status;
    $('ik').textContent = st==='unknown'?'Undiscovered':'System';
    $('itl').textContent=s.name; $('isb').textContent=s.blurb;
    const col={healthy:'#5B9B3A',warning:C.o,broken:C.r,unknown:C.unk}[st];
    let h=`<div class="srow"><span class="chip" style="background:${col}">${st}</span>
      <span class="hn" style="color:${col}">${st==='unknown'?'??':s.health+'%'}</span></div>
      <span class="meter"><i style="width:${st==='unknown'?0:s.health}%;background:${col}"></i></span>`;
    h+=`<div class="sec"><h4>What Mistral found</h4>`;
    if(s.issues&&s.issues.length){
      s.issues.forEach(i=>h+=`<div class="iss ${i.w?'w':''}"><div class="a">${html(i.t)}</div><div class="b">${html(i.d)}</div>${issueSource(i)}</div>`);
    } else if(st==='unknown'){
      h+=`<div class="iss u"><div class="a">Nothing yet</div>
        <div class="b">This code has not been read. Send a Scout Cat to map it and lift the fog.</div></div>`;
    } else {
      h+=`<div class="iss g"><div class="a">Nothing broken here</div>
        <div class="b">Every check on this system passes right now.</div></div>`;
    }
    h+=`</div>`;
    if(s.connections&&s.connections.length){
      h+=`<div class="sec"><h4>Connected to</h4><div class="conns">`+
        s.connections.map(c=>{const t=sysAt(c);return t?`<button class="conn" data-g="${c}">${t.name}</button>`:''}).join('')+
        `</div></div>`;
    }
    if(s.files&&s.files.length)
      h+=`<div class="sec"><h4>In the repository</h4><div class="files">`+
         s.files.map(f=>'&#9656; '+f).join('<br>')+`</div></div>`;
    if(s.kind==='tower') h=securityPanel(s)+h.replace(/^<div class="srow">[\s\S]*?<\/span>/,'<div class="srow" style="display:none">');
    if(s.result)h+=s.result;
    $('ibd').innerHTML=h;
    if(s.kind==='tower'){
      const b=$('ibd').querySelector('[data-fix]');
      if(b)b.addEventListener('click',()=>applyFix(b.dataset.fix));
    }
    $('ibd').querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>select(sysAt(b.dataset.g))));

    const rec = st==='unknown'?'scout':'repair';
    $('iac').innerHTML=Object.entries(AGENTS).map(([k,a])=>{
      const busy=!!S.busy[s.id], poor=S.energy<a.cost;
      const noop=k==='repair'&&(st==='healthy'||st==='unknown');
      const dis=busy||poor||noop;
      const why=busy?'a cat is already working here':poor?'not enough energy':
        noop?(st==='unknown'?'send a scout first':'nothing to fix here'):a.desc;
      return `<button class="act ${k===rec&&!dis?'rec':''}" data-s="${k}" ${dis?'disabled':''}>
        <canvas class="px" data-mini="${k}" width="30" height="22"></canvas>
        <span><span class="an">Send ${a.name}</span><span class="ad">${why}</span></span>
        <span class="ac">${a.cost}</span></button>`;
    }).join('');
    $('iac').querySelectorAll('canvas[data-mini]').forEach(c=>{
      const g=c.getContext('2d');g.imageSmoothingEnabled=false;
      const sp=CATS[c.dataset.mini].walk1; g.drawImage(sp,0,0,sp.width*2,sp.height*2);
    });
    $('iac').querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>dispatch(b.dataset.s,s)));
  }


  /* Pixel tick and cross, written as rows like every other sprite here and
     emitted as 1px SVG rects in currentColor. No image files. */
  function pixIcon(rows){
    let r='';
    rows.forEach((row,y)=>{ for(let x=0;x<row.length;x++) if(row[x]==='#')
      r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="currentColor"/>`; });
    return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }
  const ICON_OK = pixIcon(["........","......#.",".....##.","#...##..","##.##...",".###....","..#.....","........"]);
  const ICON_NO = pixIcon(["........",".##..##.","..####..","...##...","...##...","..####..",".##..##.","........"]);

  function securityPanel(s){
    const lv=s.level||3, L=LEVELS[lv-1];
    const nextFail=CHECKS.find(c=>!s.passed.includes(c.id));
    let h=`<div class="lvlhead" style="border-color:${L.tone}">
      <div class="lvlpips">${LEVELS.map(x=>`<i style="background:${x.n<=lv?L.tone:'#D9D3C8'}"></i>`).join('')}</div>
      <div class="lvlnum" style="color:${L.tone}">LVL ${lv}</div>
      <div class="lvlname">${L.name}</div>
      <div class="lvlblurb">${L.blurb}</div>
    </div>
    <div class="sec"><h4>Security, ${s.passed.length} of 5 checks pass</h4>`;
    CHECKS.forEach(c=>{
      const ok=s.passed.includes(c.id);
      h+=`<div class="chk ${ok?'ok':''}"><span class="cb">${ok?ICON_OK:ICON_NO}</span>
        <span><b>${c.name}</b><i>${ok?c.pass:c.fail}</i></span></div>`;
    });
    h+=`</div>`;
    if(nextFail){
      h+=`<div class="sec"><h4>Next level</h4>
        <div class="fixbox">
          <div class="fixt">${nextFail.name}</div>
          <code class="fixc">${nextFail.fix.replace(/</g,'&lt;')}</code>
          <div class="fixh">how Mistral checks it: ${nextFail.how}</div>
          <button class="btnfix" data-fix="${nextFail.id}">Apply this fix &rarr; Level ${lv+1}</button>
        </div></div>`;
    } else {
      h+=`<div class="sec"><div class="iss g"><div class="a">All five checks pass</div>
        <div class="b">Town Hall is at its highest level. New checks would add levels 6 and up.</div></div></div>`;
    }
    return h;
  }
  function applyFix(id){
    const s=sysAt('tower'); if(s.passed.includes(id))return;
    const c=CHECKS.find(x=>x.id===id), was=s.level;
    log(`applying fix, ${c.name.toLowerCase()}`,'sys');
    log(c.fix,'code');
    setTimeout(()=>{
      s.passed.push(id); s.level=Math.max(1,Math.min(5,s.passed.length));
      setScore(s.level);                       // move the whole board, not just the hall
      const a=anchor(s);
      burst(a.x,a.y-a.h*0.6,34,'spark');
      floatText(a.x,a.y-a.h-8,`${LEVELS[was-1].name} to ${LEVELS[s.level-1].name}`,LEVELS[s.level-1].tone);
      s.grow=0.55;
      log(`security check passed, <b>Town Hall reached level ${s.level}, ${LEVELS[s.level-1].name}</b>`,'good');
      setKnow(S.knowledge+1);
      const after=computeHealth(); setHealth(after,after-S.health);
      toast(`Town Hall levelled up: ${LEVELS[s.level-1].name}`);
      renderIns(s);
    },900);
  }

  /* ============================================================
     8. DISPATCH
     ============================================================ */
  const SCRIPT={
    repair:s=>[[0,`dispatching repair agent to <b>${s.name}</b>`,'sys'],
      [900,`reading ${s.files[0]||'source'}`,'code'],
      [2100,`reproducing "session should persist after refresh"`,'code'],
      [3600,`test failed as expected`,'bad'],
      [4800,`cause: session held in React state, never written to a cookie`,''],
      [6200,`editing src/auth/session.ts`,'code'],
      [7500,`editing src/auth/guard.ts`,'code'],
      [8800,`running: pnpm test authentication`,'code'],
      [10600,`authentication.test.ts, 6 passed`,'good'],
      [11300,`repair verified`,'good']]
  };

  function pathTiles(a,b){
    /* walk along the dirt: L-shaped through the tower crossroads */
    const via={x:24*TS+8,y:17*TS};
    return [{x:a.x,y:a.y},{x:a.x,y:via.y},{x:b.x,y:via.y},{x:b.x,y:b.y}];
  }
  function moveCat(cat,pts,ms,done){
    const segs=[];let total=0;
    for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);segs.push(d);total+=d}
    const t0=performance.now();
    (function f(now){
      const t=Math.min(1,(now-t0)/ms);
      let want=t*total,i=0;
      while(i<segs.length-1&&want>segs[i]){want-=segs[i];i++}
      const A=pts[i],B=pts[i+1],k=segs[i]?want/segs[i]:1;
      const nx=A.x+(B.x-A.x)*k;
      cat.dir = nx<cat.x-0.01?-1:nx>cat.x+0.01?1:cat.dir;
      cat.x=nx; cat.y=A.y+(B.y-A.y)*k;
      if(t<1)requestAnimationFrame(f); else done&&done();
    })(t0);
  }

  let speed=1;
  function dispatch(agentKey,target){
    if(S.busy[target.id])return toast('A cat is already working there.');
    const a=AGENTS[agentKey];
    if(S.energy<a.cost)return toast('Not enough energy. Ship something first.');
    if(agentKey==='repair'&&(target.status==='healthy'||target.status==='unknown'))
      return toast(target.status==='unknown'?'Scout it first.':'Nothing is broken there.');

    /* The host may replace the scripted path with the real agent runtime. */
    if(opts.onDispatch){
      const handled=opts.onDispatch({agent:agentKey,systemId:target.id,issue:target.issues&&target.issues[0],
        files:target.files||[],connections:target.connections||[]});
      if(handled!==false){
        MistralCity.onEvent({type:'agent.start',agent:agentKey,target:target.id});
      }
      return;
    }
    if(agentKey!=='repair')return toast('Scout Cat needs a connected repository analysis.');

    setEnergy(S.energy-a.cost);
    S.busy[target.id]=true; S.busy['agent-'+agentKey]=true;
    if(S.selected&&S.selected.id===target.id)renderIns(target);

    const hut=MODEL.huts.find(h=>h.agent===agentKey);
    const start={x:hut.tx*TS+TS+14,y:hut.ty*TS+TS};
    const cat={agent:agentKey,x:start.x,y:start.y,dir:1,state:'walk',
               say:agentKey==='repair'?'on it':'let me look',
               sayUntil:S.tick+120};
    S.cats.push(cat);
    burst(start.x,start.y-6,6,'spark');
    log(`<b>${a.name}</b> left the ${a.verb.toLowerCase()} hut`,'sys');

    const A=anchor(target);
    const dest={x:A.x+A.w/2+6,y:A.y};
    moveCat(cat,pathTiles(start,dest),2600/speed,()=>{
      cat.state='work'; cat.say=null;
      let scaf=null;
      if(agentKey!=='scout'){
        scaf={x:A.x,y:A.y,spr:scaffoldSprite(A.w+8,A.h)};
        S.scaffolds.push(scaf);
      }
      const script=SCRIPT[agentKey](target);
      const workT=setInterval(()=>burst(A.x,A.y-A.h*0.6,2,'spark'),380);
      script.forEach(([t,txt,c])=>setTimeout(()=>log(txt,c),t/speed));
      setTimeout(()=>{clearInterval(workT);finish(agentKey,target,cat,scaf,A)},
        (script[script.length-1][0]+1200)/speed);
    });
  }

  function finish(agentKey,target,cat,scaf,A){
    const before=S.health;
    if(scaf)S.scaffolds=S.scaffolds.filter(s=>s!==scaf);

    if(agentKey==='repair'){
      const was=target.health;
      target.health=94; target.status='healthy'; target.issues=[];
      S.tp=19; setTests();
      burst(A.x,A.y-A.h*0.6,26,'spark');
      floatText(A.x,A.y-A.h-6,`+${94-was}%`,C.y);
      target.result=`<div class="res-card"><div class="rt">Repair Cat fixed session persistence</div>
        <div class="rd">Sessions are written to a signed cookie now, so refreshing keeps you logged in.
        Health ${was}% → 94%.</div>
        <details><summary>What changed</summary><div class="df">
        M src/auth/session.ts<br>M src/auth/guard.ts<br><br>
        &#10003; authentication.test.ts, 6 passed<br>&#10003; 19/19 suite green</div></details></div>`;
      log(`<b>${target.name}</b> repaired, ${was}% to 94%`,'good');
    }

    cat.state='walk';
    const hut=MODEL.huts.find(h=>h.agent===agentKey);
    const home={x:hut.tx*TS+TS+14,y:hut.ty*TS+TS};
    moveCat(cat,pathTiles({x:cat.x,y:cat.y},home),2400/speed,()=>{
      S.cats=S.cats.filter(c=>c!==cat); delete S.busy['agent-'+agentKey];
    });
    delete S.busy[target.id];
    const after=computeHealth(); setHealth(after,after-before);
    setEnergy(S.energy+5);
    if(S.selected&&S.selected.id===target.id)renderIns(target);
  }

  /* ============================================================
     9. CONNECT + GENERATION
     ============================================================ */
  function generate(){
    const repoUrl=$('repo-url')&&$('repo-url').value.trim();
    if(opts.onConnect){
      if(!repoUrl)return toast('Paste a GitHub repository URL first.');
      const handled=opts.onConnect(repoUrl);
      if(handled!==false)return;
    }
    if(S.connected)return;
    S.connected=true;
    $('connect').classList.add('gone');
    if($('repochip'))$('repochip').innerHTML='<b>~/dev/mistral-shop</b> connected';
    log('scanning repository','sys');
    log('mistral-medium-3.5 reading project structure','code');

    const order=['tower','auth','db','api','dashboard','profiles','tests','docs','payments'];
    order.forEach((id,i)=>setTimeout(()=>{
      const s=MODEL.systems.find(x=>x.id===id);
      s.grow=0; S.systems.push(s);
      const a=anchor(s); burst(a.x,a.y-8,10,'spark');
      log(s.status==='unknown'?`unreadable area found near /src`:`found <b>${s.name}</b>, ${s.files.length} files`,
          s.status==='unknown'?'bad':'');
      setHealth(computeHealth());
    },360*i+400));

    setTimeout(()=>{
      MODEL.huts.forEach((h,i)=>setTimeout(()=>{S.huts.push(h);
        burst(h.tx*TS+8,h.ty*TS+16,8,'spark')},160*i));
      log('2 builder huts ready','sys');
    },360*order.length+500);

    setTimeout(()=>{
      log('18 of 19 tests pass','');
      log('<b>Authentication</b> is failing 1 test','bad');
      setHealth(computeHealth());
      toast('Authentication is on fire. Click it.');
    },360*order.length+1300);
  }
  $('b-connect').addEventListener('click',generate);
  document.querySelectorAll('.ritem').forEach(r=>r.addEventListener('click',generate));
  $('b-reset')&&$('b-reset').addEventListener('click',()=>location.reload());
  $('b-demo')&&$('b-demo').addEventListener('click',()=>{
    generate();
    const auth=()=>MODEL.systems.find(s=>s.id==='auth');
    setTimeout(()=>{select(auth());panTo(auth());toast('Every building is a real system in the repo.')},5000);
    setTimeout(()=>dispatch('repair',auth()),8000);
    setTimeout(()=>{deselect();zoomTo(1);toast('Mistral changed the repo. The city followed.')},25500);
  });

  /* ============================================================
     10. CAMERA + INPUT
     ============================================================ */
  function panTo(s){const a=anchor(s);panTarget(a.x,a.y-a.h/2)}
  let drag=false,moved=false,last={x:0,y:0};
  stage.addEventListener('pointerdown',e=>{
    if(e.target.closest('.hud,#ins,#connect,#zc'))return;
    drag=true;moved=false;last={x:e.clientX,y:e.clientY};stage.classList.add('drag');
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove',e=>{
    const r=cv.getBoundingClientRect();
    if(drag){
      const dx=e.clientX-last.x,dy=e.clientY-last.y;
      if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
      S.cam.xt-=dx/S.cam.z; S.cam.yt-=dy/S.cam.z; clampCam();
      S.cam.x=S.cam.xt; S.cam.y=S.cam.yt; last={x:e.clientX,y:e.clientY};
    } else {
      const hit=pick(e.clientX-r.left,e.clientY-r.top);
      S.systems.forEach(s=>s.hover=(hit&&hit.id===s.id));
      stage.style.cursor = S.armed?'crosshair':hit?'pointer':'grab';
    }
  });
  WIN('pointerup',()=>{drag=false;stage.classList.remove('drag')});
  stage.addEventListener('click',e=>{
    if(moved||e.target.closest('.hud,#ins,#connect,#zc'))return;
    const r=cv.getBoundingClientRect();
    const hit=pick(e.clientX-r.left,e.clientY-r.top);
    if(!hit)return deselect();
    if(S.armed){const k=S.armed;S.armed=null;
      document.querySelectorAll('.hut').forEach(x=>x.classList.remove('armed'));
      stage.classList.remove('aim'); dispatch(k,hit); return}
    select(hit);
  });
  function pick(sx,sy){
    const z=S.cam.z;
    const wx=(sx-S.vw/2)/z+S.cam.x, wy=(sy-S.vh/2)/z+S.cam.y;
    let best=null;
    S.systems.forEach(s=>{
      const a=anchor(s);
      if(wx>a.x-a.w/2&&wx<a.x+a.w/2&&wy>a.y-a.h&&wy<a.y){ if(!best||a.y>anchor(best).y)best=s }
    });
    return best;
  }
  /* Pan-first navigation, kept from main: the wheel pans and never zooms.
     Zoom is the buttons and the +/- keys, one whole step per press, so a
     trackpad flick can no longer throw the board from 1 to 4. Everything
     routes through panTarget/zoomTo, which ease and clamp to the board. */
  function fitToView(){ S.cam.zt=ZMIN; panTarget(16*TS,13*TS); }
  stage.addEventListener('wheel', e => {
    // Scroll over the inspector, HUD, or connect card belongs to that surface.
    // overscroll-behavior:contain stops the chain, and returning early here
    // means the map never sees the "extra" wheel delta either.
    if(e.target && e.target.closest && e.target.closest('#ins,.hud,#connect,#toast')) return;
    // Pinch-zoom on Mac touchpads and ctrl+wheel elsewhere fire wheel with
    // ctrlKey. Swallow so the browser doesn't zoom the whole page.
    if(e.ctrlKey){ e.preventDefault(); return; }
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    panTarget(S.cam.xt + (e.deltaX*unit)/S.cam.zt, S.cam.yt + (e.deltaY*unit)/S.cam.zt);
  }, {passive:false});
  $('zin').onclick=()=>zoomTo(S.cam.zt+1);
  $('zout').onclick=()=>zoomTo(S.cam.zt-1);
  $('zfit').onclick=()=>fitToView();
  WIN('keydown',e=>{
    if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if(e.key==='Escape'){deselect();S.armed=null;document.querySelectorAll('.hut').forEach(x=>x.classList.remove('armed'));stage.classList.remove('aim');return}
    if(e.key==='f'){ $('zfit').click(); return; }
    if(e.key==='0'){ e.preventDefault(); fitToView(); return; }
    if(e.key==='+'||e.key==='='){ e.preventDefault(); zoomTo(S.cam.zt+1); return; }
    if(e.key==='-'||e.key==='_'){ e.preventDefault(); zoomTo(S.cam.zt-1); return; }
  });

  renderHuts(); setEnergy(S.energy); setTests(); setHealth(0);
  log('mistral city ready','sys'); log('connect a repository to begin','');
  draw();

  /* ============================================================
     DECORATIVE FILLER
     the rule that makes function readable without a legend:
       ear roof + Mistral ramp = the agents can act on it
       neutral gable/flat roof = scenery, does nothing
       collar + tool           = an agent
       no collar               = a town cat
     ============================================================ */
  const NEUTRAL=[['h','h','G','G','h'],['v','v','B','B','v'],['U','U','u','u','U'],
                 ['x','x','G','G','x'],['B','B','v','v','B'],
                 ['5','5','4','4','5'],['3','3','1','1','3'],['4','4','5','5','4']];
  const FILLER={
    shack:    {w:22,h:18,roof:'gable',roofH:7,wc:1,wr:1,wall:'B',shade:'v',bands:NEUTRAL[1],extras:[]},
    leanto:   {w:26,h:15,roof:'flat',roofH:5,wc:2,wr:1,wall:'v',shade:'v',bands:NEUTRAL[4],extras:['crates']},
    cottage:  {w:26,h:22,roof:'gable',roofH:9,wc:2,wr:1,wall:'n',shade:'N',bands:NEUTRAL[1],extras:[]},
    barn:     {w:34,h:26,roof:'gable',roofH:11,wc:2,wr:1,wall:'b',shade:'B',bands:NEUTRAL[4],extras:['crates']},
    shop:     {w:28,h:26,roof:'gable',roofH:8,wc:2,wr:2,wall:'c',shade:'n',bands:NEUTRAL[5],extras:['awning']},
    townhouse:{w:24,h:34,roof:'gable',roofH:8,wc:2,wr:3,wall:'n',shade:'N',bands:NEUTRAL[7],extras:['chimney']},
    inn:      {w:34,h:30,roof:'gable',roofH:10,wc:3,wr:2,wall:'c',shade:'n',bands:NEUTRAL[5],extras:['chimney','awning']},
    warehouse:{w:44,h:24,roof:'flat',roofH:6,wc:4,wr:1,wall:'1',shade:'3',bands:NEUTRAL[6],extras:['crates','awning']},
    block:    {w:30,h:46,roof:'flat',roofH:5,wc:3,wr:4,wall:'2',shade:'1',bands:NEUTRAL[6],extras:['awning']},
    kiosk:    {w:18,h:16,roof:'flat',roofH:5,wc:1,wr:1,wall:'e',shade:'c',bands:NEUTRAL[5],extras:['awning']},
    office:   {w:36,h:52,roof:'flat',roofH:5,wc:4,wr:5,wall:'e',shade:'c',bands:NEUTRAL[6],extras:['awning']},
    highrise: {w:26,h:64,roof:'flat',roofH:5,wc:2,wr:7,wall:'2',shade:'1',bands:NEUTRAL[6],extras:[]},
    glassbox: {w:40,h:56,roof:'flat',roofH:4,wc:4,wr:6,wall:'e',shade:'c',bands:NEUTRAL[2],extras:[]},
    silo:     {w:20,h:40,roof:'dome',roofH:8,wc:1,wr:2,wall:'g',shade:'G',bands:NEUTRAL[0],extras:[]},
    terminal: {w:46,h:22,roof:'flat',roofH:5,wc:4,wr:1,wall:'1',shade:'3',bands:NEUTRAL[6],extras:['crates','awning']}
  };
  const BAKED_F={}; Object.entries(FILLER).forEach(([k,r])=>{BAKED_F[k]=bake(mkBuilding(r))});

  /* town cats: same body, no collar, no tool. four coats, three frames each. */
  const TOWNFUR=['#4A4A58','#7A6250','#9A9A8C','#2F3340'];
  const TOWNCAT=TOWNFUR.map(f=>{
    const p=Object.assign({},PAL,{'#':f,'E':f==='#9A9A8C'?C.ink:C.paper,'@':f,'T':null});
    return {sit:bake(CATBASE.sit,p), w1:bake(CATBASE.walk1,p), w2:bake(CATBASE.walk2,p)};
  });

  /* what stands in the wider view at each level */
  const SCENE={
    1:{fill:['shack','leanto'],                                  nf:2,
       props:['deadtree','bramble','tree','stump','boulder','deadtree','weeds','bramble','tree','mud','deadtree','boulder'], np:16, cats:1},
    2:{fill:['cottage','shack','barn','cottage'],                nf:4,
       props:['tree','bush','tree','logpile','hedge','rock','stump','tree','barrel','bush','crate','weeds'],      np:20, cats:1},
    3:{fill:['shop','townhouse','inn','cottage','shop','kiosk'], nf:6,
       props:['tree','hedge','planter','tree','woodlamp','hedge','bush','tree','bench','planter','crate','grate','bush','rock'], np:26, cats:2},
    4:{fill:['warehouse','block','office','kiosk','townhouse','block','terminal','shop','warehouse'], nf:9,
       props:['steellamp','planter','tree','bollard','hedge','pipes','planter','sapling','vent','bench','container','tree','grate','planter','crate','steellamp'], np:32, cats:3},
    5:{fill:['highrise','glassbox','office','block','terminal','silo','warehouse','highrise','kiosk','glassbox','block','office'], nf:12,
       props:['pylon','topiary','steellamp','planter','container','topiary','tree','bollard','vent','planter','pipes','topiary','bench','antenna','sapling','grate','planter','pylon'], np:44, cats:5}
  };

  /* deterministic layout for one level's wide view */
  function sceneLayout(lv,halfW){
    const S2=SCENE[lv], out=[], hallW=BAKED_TH[lv-1].width;
    const clear=hallW/2+26;
    let seed=lv*97.3;
    const jitter=n=>rnd(seed+=1.7)*n;
    /* filler buildings, pushed to the back rows */
    for(let i=0;i<S2.nf;i++){
      const k=S2.fill[i%S2.fill.length];
      const side=i%2?1:-1;
      const lane=Math.floor(i/2);
      const x=side*(clear+30+lane*44+jitter(18));
      const y=-64+lane*15+jitter(14);
      out.push({t:'f',k,x,y});
    }
    /* props, front and back, count climbs with the level */
    for(let i=0;i<S2.np;i++){
      const k=S2.props[i%S2.props.length];
      const x=(rnd(seed+=2.3)-0.5)*halfW*2.0;
      const y=-72+rnd(seed+=3.1)*104;
      if(Math.abs(x)<clear*0.85&&y>-14&&y<26) continue;
      out.push({t:'p',k,x,y});
    }
    /* the bridge: scenery, and only once the place is developed */
    if(lv>=4){
      out.push({t:'p',k:lv===5?'bigbridge':'bridge',x:-halfW*0.74,y:-62});
      if(lv===5) out.push({t:'p',k:'bridge',x:halfW*0.80,y:-52});
    }
    /* agent cats near the hall, town cats scattered */
    ['scout','repair'].forEach((a,i)=>out.push({t:'a',k:a,x:(i-.5)*54+jitter(4),y:14+jitter(5)}));
    for(let i=0;i<S2.cats;i++)
      out.push({t:'c',k:i%TOWNCAT.length,x:(rnd(seed+=4.7)-0.5)*halfW*1.8,y:-44+rnd(seed+=1.3)*76});
    return out;
  }

  /* the wide mockup */
  function fullView(lv,cw,chh,showReal){
    const cvv=document.createElement('canvas');
    cvv.width=cw; cvv.height=chh; cvv.className='fvart px';
    const g=cvv.getContext('2d'); g.imageSmoothingEnabled=false;
    const z=2, ax=cw/2, groundY=chh-54;
    /* terrain */
    const wildness={1:0.55,2:0.28,3:0.14,4:0.05,5:0.0}[lv];
    const warm=lv>=3;
    for(let y=0;y<Math.ceil(chh/(TS*z))+1;y++)for(let x=0;x<Math.ceil(cw/(TS*z))+1;x++){
      const n=rnd(x*5.1+y*9.7+lv*3);
      const k = n<wildness?2 : n>0.94?(warm?6:3) : (warm?5:0);
      g.drawImage(TILES[k][(x+y)%4],x*TS*z,y*TS*z,TS*z,TS*z);
    }
    if(lv>=4){ /* warm paving, with Mistral accent squares scattered through it */
      const ramp=['#F3B23E','#EF8934','#E75D2E','#D2321F'];
      for(let y=0;y<chh;y+=32)for(let x=0;x<cw;x+=32){
        const n=rnd(x*1.7+y*3.9+lv*5);
        if(lv===5? n>0.10 : n>0.34){
          const a=rnd(x*3.3+y*1.9+lv);
          g.fillStyle = a> (lv===5?0.86:0.92) ? ramp[Math.floor(rnd(x+y*2)*4)]
                      : ((x/32+y/32)%2?'#BCAEA0':'#A99A8C');
          g.fillRect(x,y,32,32);
          g.fillStyle='#8A7C6E'; g.fillRect(x,y,32,1); g.fillRect(x,y,1,32);
        }
      }
    }
    /* the road running across */
    if(lv>=4){
      g.fillStyle='#6E6A66'; g.fillRect(0,groundY+14,cw,40);
      g.fillStyle='#EF8934'; g.fillRect(0,groundY+14,cw,3);
      g.fillStyle='#8A7C6E'; g.fillRect(0,groundY+17,cw,1); g.fillRect(0,chh-3,cw,3);
      g.fillStyle=C.paper; for(let x=8;x<cw;x+=34) g.fillRect(x,groundY+32,16,3);
    } else {
      for(let x=0;x<cw;x+=TS*z) g.drawImage(TILES[1][(x/16)%4],x,groundY+18,TS*z,TS*z);
    }
    const dg=DISTRICT_GROUND[lv-1];
    g.drawImage(dg,Math.round(ax-dg.width*z/2),Math.round(groundY-dg.height*z*0.55),dg.width*z,dg.height*z);

    /* everything, depth sorted */
    const items=sceneLayout(lv,cw/2/z).map(o=>{
      let sp,real=false,pin=null;
      if(o.t==='f'){sp=BAKED_F[o.k]}
      else if(o.t==='p'){sp=SPR[o.k]}
      else if(o.t==='a'){sp=CATS[o.k].sit;real=true;pin=AGENTS[o.k].name}
      else {sp=TOWNCAT[o.k].sit}
      return sp?{...o,sp,real,pin}:null;
    }).filter(Boolean);
    items.push({t:'h',sp:BAKED_TH[lv-1],x:0,y:0,real:true,pin:'Town Hall'});

    items.sort((a,b)=>a.y-b.y).forEach(it=>{
      const px=Math.round(ax+it.x*z-it.sp.width*z/2), py=Math.round(groundY+it.y*z-it.sp.height*z);
      if(showReal&&!it.real){ g.globalAlpha=.30; g.filter='grayscale(1)'; }
      g.drawImage(it.sp,px,py,it.sp.width*z,it.sp.height*z);
      g.globalAlpha=1; g.filter='none';
      if(showReal&&it.real){
        g.strokeStyle=C.t; g.lineWidth=2; g.setLineDash([4,3]);
        g.strokeRect(px-3,py-3,it.sp.width*z+6,it.sp.height*z+6); g.setLineDash([]);
      }
    });
    if(showReal){
      items.filter(i=>i.real).forEach((it,ix)=>{
        const px=Math.round(ax+it.x*z);
        let py=Math.round(groundY+it.y*z-it.sp.height*z);
        if(py<22) py=22;
        if(it.t==='a') py-=((ix%2)?0:11);
        g.font='700 11px Archivo, sans-serif'; g.textAlign='center'; g.textBaseline='top';
        const w=g.measureText(it.pin).width+12;
        g.fillStyle=C.t; g.fillRect(px-w/2,py-19,w,15);
        g.fillStyle='#fff'; g.fillText(it.pin,px,py-16);
      });
    }
    return cvv;
  }

  /* ---------- populate the living town ---------- */
  (function initAmbient(){
    const tuft=f=>bake(f?['..a..','.aza.','aza a','.a.a.']:['..a..','.aza.','a aza','.a.a.']);
    const tA=bake(['...z.','..za.','.zaa.','.a.a.']), tB=bake(['.z...','.az..','.aaz.','.a.a.']);
    let placed=0;
    for(let i=0;i<340&&placed<70;i++){
      const gx=Math.floor(rnd(i*7.7)*MW), gy=Math.floor(rnd(i*11.3+2)*MH);
      if(map[gy][gx]!==0&&map[gy][gx]!==2) continue;
      S.ambient.push({kind:'tuft',x:gx*TS+8,y:gy*TS+14,ph:rnd(i)*6.28,spr:{a:tA,b:tB}});
      placed++;
    }
    for(let i=0;i<6;i++){
      const gx=8+Math.floor(rnd(i*13.1)*(MW-16)), gy=6+Math.floor(rnd(i*5.9)*(MH-12));
      const x=gx*TS, y=gy*TS;
      S.ambient.push({kind:'cat',spr:TOWNCAT[i%TOWNCAT.length],x,y,hx:x,hy:y,tx:x,ty:y,
                      dir:1,wait:Math.floor(rnd(i)*200),ph:i*1.7});
    }
    for(let i=0;i<3;i++)
      S.ambient.push({kind:'bird',x:-i*220,y:60+i*40,by:0,vx:0.5+i*0.12,ph:i*2.1});
  })();

  /* ============================================================
     PUBLIC API: the only surface the rest of the app touches.
     Everything above is private. Everything below is the contract.
     ============================================================ */
  const KINDS=['tower','gate','workshop','vault','district','house','watch','library','port'];

  function dispatchLive(agentKey,target){
    /* same choreography as the scripted path, but it waits for real events */
    if(S.busy[target.id]) return null;
    const a=AGENTS[agentKey];
    S.busy[target.id]=true; S.busy['agent-'+agentKey]=true;
    setEnergy(Math.max(0,S.energy-a.cost));
    const hut=MODEL.huts.find(h=>h.agent===agentKey);
    const start={x:hut.tx*TS+TS+14,y:hut.ty*TS+TS};
    const cat={agent:agentKey,x:start.x,y:start.y,dir:1,state:'walk',
               say:agentKey==='repair'?'on it':'let me look',
               sayUntil:S.tick+120};
    S.cats.push(cat); burst(start.x,start.y-6,6,'spark');
    const A=anchor(target);
    const h={agentKey,target,cat,scaf:null,A,workT:null};
    moveCat(cat,pathTiles(start,{x:A.x+A.w/2+6,y:A.y}),2600,()=>{
      cat.state='work'; cat.say=null;
      if(agentKey!=='scout'){ h.scaf={x:A.x,y:A.y,spr:scaffoldSprite(A.w+8,A.h)}; S.scaffolds.push(h.scaf); }
      h.workT=setInterval(()=>burst(A.x,A.y-A.h*0.6,2,'spark'),380);
    });
    S.live[target.id]=h;
    return h;
  }
  function finishLive(h,out){
    if(!h) return;
    const {agentKey,target,cat,scaf,A}=h;
    if(h.workT) clearInterval(h.workT);
    if(scaf) S.scaffolds=S.scaffolds.filter(x=>x!==scaf);
    const before=S.health, was=target.health;
    if(out && typeof out.health==='number') target.health=out.health;
    if(out && out.status) target.status=out.status;
    if(target.status!=='broken'&&target.status!=='warning') target.issues=[];
    burst(A.x,A.y-A.h*0.6,26,'spark');
    if(target.health!==was) floatText(A.x,A.y-A.h-6,(target.health>was?'+':'')+(target.health-was)+'%',C.y);
    if(out&&out.summary){
      target.result=`<div class="res-card"><div class="rt">${out.summary}</div>`+
        (out.detail?`<div class="rd">${out.detail}</div>`:'')+
        (out.files&&out.files.length?`<details><summary>What changed</summary><div class="df">`+
          out.files.map(f=>'M '+f).join('<br>')+`</div></details>`:'')+`</div>`;
    }
    cat.state='walk';
    const hut=MODEL.huts.find(x=>x.agent===agentKey);
    moveCat(cat,pathTiles({x:cat.x,y:cat.y},{x:hut.tx*TS+TS+14,y:hut.ty*TS+TS}),2400,
      ()=>{S.cats=S.cats.filter(c=>c!==cat); delete S.busy['agent-'+agentKey];});
    delete S.busy[target.id]; delete S.live[target.id];
    const after=computeHealth(); setHealth(after,after-before);
    if(S.selected&&S.selected.id===target.id) renderIns(target);
  }
  S.live={};

  MistralCity=Object.assign(MistralCity,{
    version:'0.4',

    /* Paul -> Neo -> here. Replaces the whole city. Safe to call more than once. */
    setModel(json){
      if(!json||!json.systems) throw new Error('setModel needs { systems: [...] }');
      const shouldFit=!S.systems.some(sys=>sys.id!=='tower')&&json.systems.some(sys=>sys.id!=='tower');
      S.systems.forEach(x=>{ if(x.fxTimer) clearInterval(x.fxTimer) });
      S.systems=[]; S.cats=[]; S.scaffolds=[]; S.fx=[]; S.live={}; S.busy={}; deselect();
      /* CityModel deliberately carries no layout, so in the real app every
         system lands here. The old fallback hardcoded a 52 wide board and put
         anything past the fourth system off the edge once the map shrank, so
         it is derived from MW and MH now. The hall keeps the centre: the
         upgrade wave radiates from it. */
      let slot=0;
      MODEL.systems=json.systems.map((sys,i)=>({
        id:sys.id, name:sys.name||sys.id,
        kind:KINDS.includes(sys.kind)?sys.kind:'house',
        tx:sys.tx!=null?sys.tx:(sys.kind==='tower'?HALLX:autoPlace(slot).tx),
        ty:sys.ty!=null?sys.ty:(sys.kind==='tower'?HALLY:autoPlace(slot++).ty),
        health:sys.health!=null?sys.health:100,
        status:sys.status||'healthy',
        blurb:sys.blurb||'', files:sys.files||[], connections:sys.connections||[],
        issues:sys.issues||[],
        level:sys.kind==='tower'?Math.max(1,Math.min(5,(json.city&&json.city.security&&json.city.security.passed||[]).length||1)):undefined,
        passed:(json.city&&json.city.security&&json.city.security.passed)||[]
      }));
      MODEL.systems.forEach(sys=>{ sys.grow=0; S.systems.push(sys) });
      /* Prefer a continuous score when the scanner gives one. Falls back to the
         checklist, and to the current score when the model carries neither. */
      const sec=(json.city&&json.city.security)||{};
      if(typeof sec.score==='number') setScore(1+(Math.max(0,Math.min(100,sec.score))/100)*4);
      else if(Array.isArray(sec.passed)) setScore(Math.max(1,Math.min(5,sec.passed.length)));
      if(!S.huts.length) MODEL.huts.forEach(h=>S.huts.push(h));
      if(json.repo&&json.repo.tests){ S.tp=json.repo.tests.pass; S.tt=json.repo.tests.total; setTests(); }
      setHealth(json.city&&json.city.health!=null?json.city.health:computeHealth());
      if(shouldFit) fitToView();
      S.connected=true; $('connect').classList.add('gone');
      return S.systems.length;
    },

    setConnectionState(state,message){
      const idle=state==='idle', connecting=state==='connecting';
      S.connected=state==='connected';
      $('connect').classList.toggle('gone',!idle);
      const button=$('b-connect');
      button.disabled=connecting;
      button.textContent=connecting?'Analyzing repository…':'Connect repository';
      $('connect-error').textContent=message||'';
      return state;
    },

    /* Abhishek streams these. Five types carry the whole interaction. */
    onEvent(e){
      if(!e||!e.type) return;
      const sys=id=>sysAt(id);
      switch(e.type){
        case 'agent.start': { const t=sys(e.target); if(t) dispatchLive(e.agent||'repair',t); break; }
        case 'agent.log':   log(e.text||'', e.level||''); break;
        case 'agent.edit':  log('editing '+e.file,'code'); break;
        case 'agent.test':  log(`${e.suite||'suite'}, ${e.pass||0} passed${e.fail?', '+e.fail+' failed':''}`,
                                e.fail?'bad':'good');
                            if(e.pass!=null){S.tp=e.pass+(S.tt-(e.pass+(e.fail||0)));setTests()} break;
        case 'agent.done':  finishLive(S.live[e.target], e); break;
        case 'city.health': setHealth(e.value); break;
        default: log(String(e.type),'code');
      }
    },

    /* Zach's stage insurance. Same event stream, played from a file. */
    replay(logArr,speed){
      const k=speed||1; let base=null;
      (logArr||[]).forEach(ev=>{
        if(base===null) base=ev.t||0;
        setTimeout(()=>MistralCity.onEvent(ev),((ev.t||0)-base)/k);
      });
      return (logArr||[]).length;
    },

    /* the level mechanic, exposed */
    /* Checklist form, kept so existing callers keep working. Five booleans can
       only ever produce five values, so this quantises. */
    setSecurity(passedIds){
      const ids=(passedIds||[]).slice();
      const lv=Math.max(1,Math.min(5,ids.length));
      setScore(lv);
      const t=sysAt('tower');
      if(!t) return lv;
      t.passed=ids; t.level=lv;
      const a=anchor(t); burst(a.x,a.y-a.h*0.6,26,'spark');
      if(S.selected&&S.selected.id==='tower') renderIns(t);
      return lv;
    },

    /* The real input. A continuous 0..100 security score, so the town can sit
       genuinely between two eras instead of snapping between five states. */
    setSecurityScore(score0to100){
      /* A missing or garbage score must be ignored, not quietly demote the whole
         town. Number(null) is 0, not NaN, so null needs its own guard. */
      if(score0to100==null||score0to100==='') return hallLevel();
      const raw=Number(score0to100);
      if(!Number.isFinite(raw)) return hallLevel();
      const p=Math.max(0,Math.min(100,raw));
      const lv=setScore(1+(p/100)*4);
      const t=sysAt('tower');
      if(t){ const a=anchor(t); burst(a.x,a.y-a.h*0.6,20,'spark');
             if(S.selected&&S.selected.id==='tower') renderIns(t); }
      return lv;
    },

    checks(){ return CHECKS.map(c=>({id:c.id,name:c.name})) },
    levels(){ return LEVELS.map(l=>({n:l.n,name:l.name,era:l.era,tone:l.tone,blurb:l.blurb})) },
    securityScore(){ return Math.round(((S.score-1)/4)*100) },
    securityLevel(){ return hallLevel() },

    select(id){ const t=sysAt(id); if(t) select(t); },
    deselect,
    camera(o){ if(o.x!=null)S.cam.xt=o.x; if(o.y!=null)S.cam.yt=o.y;
      if(o.z!=null)S.cam.zt=Math.max(ZMIN,Math.min(ZMAX,Math.round(o.z)));
      clampCam();
      if(o.snap){S.cam.x=S.cam.xt;S.cam.y=S.cam.yt;S.cam.z=S.cam.zt} },
    on(name,cb){ (S.hooks=S.hooks||{})[name]=cb; },
    state(){ return {health:S.health,energy:S.energy,systems:S.systems.length,
      zoom:S.cam.zt, score:Math.round(((S.score-1)/4)*100), level:hallLevel()}; },
    destroy(){
      cancelAnimationFrame(S.raf);
      S.systems.forEach(x=>{ if(x.fxTimer) clearInterval(x.fxTimer) });
      Object.values(S.live).forEach(h=>{ if(h&&h.workT) clearInterval(h.workT) });
      _listeners.forEach(([t,f])=>window.removeEventListener(t,f));
      _listeners.length=0;
      if(_ro) _ro.disconnect();
      el.innerHTML='';
      if(_style && _style.parentNode) _style.parentNode.removeChild(_style);
    }
  });



  if (opts.onSelect) MistralCity.on('select', opts.onSelect);
  if (window.ResizeObserver) { _ro = new ResizeObserver(() => resize()); _ro.observe(el); }
  if (opts.model) MistralCity.setModel(opts.model);
  return MistralCity;
}

export default mountCity;
