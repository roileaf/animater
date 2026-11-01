// Builds a standalone page that draws every Tokenshade aura motif (scripts/engines/tokenshade/aura-field.mjs) on a
// map-like grid, with sliders for colour, strength and pace, so the looks can be tuned outside Foundry.
// Usage: node tools/build-aura-preview.mjs <out.html>
import { writeFile } from "node:fs/promises";
import { AURA_FRAGMENT, AURA_VERTEX, AURA_MOTIFS, AURA_FIELD_DEFAULTS } from "../scripts/engines/tokenshade/aura-field.mjs";

const out = process.argv[2] ?? "aura-preview.html";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tokenshade Auras</title>
<style>
:root{--bg:#1d1d20;--panel:#2a2a2f;--text:#eee;--muted:#aaa}
body{margin:0;background:var(--bg);color:var(--text);font:14px system-ui,sans-serif}
header{padding:12px 16px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;background:var(--panel);position:sticky;top:0;z-index:2}
header label{display:flex;gap:6px;align-items:center;color:var(--muted)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:12px;padding:16px}
figure{margin:0;background:#000;border-radius:6px;overflow:hidden}
figcaption{padding:6px 10px;color:var(--muted)}
.tile{position:relative;aspect-ratio:1}
.tile canvas{position:absolute;inset:0;width:100%;height:100%}
</style></head><body>
<header>
<label>Colour <input id="color" type="color" value="#${AURA_FIELD_DEFAULTS.color.toString(16).padStart(6, "0")}"></label>
<label>Edge <input id="edge" type="range" min="0" max="1" step="0.05" value="${AURA_FIELD_DEFAULTS.edge}"></label>
<label>Band <input id="band" type="range" min="0" max="1" step="0.05" value="${AURA_FIELD_DEFAULTS.band}"></label>
<label>Wash <input id="wash" type="range" min="0" max="0.3" step="0.01" value="${AURA_FIELD_DEFAULTS.wash}"></label>
<label>Band width (squares) <input id="bandWidth" type="range" min="0.2" max="2" step="0.05" value="${AURA_FIELD_DEFAULTS.bandWidth}"></label>
<label>Gap (squares) <input id="gap" type="range" min="0" max="1.5" step="0.05" value="${AURA_FIELD_DEFAULTS.gap}"></label>
<label>Speed <input id="speed" type="range" min="0" max="3" step="0.1" value="${AURA_FIELD_DEFAULTS.speed}"></label>
<label>Reach (ft) <select id="feet"><option>15</option><option selected>30</option><option>60</option></select></label>
<label><input id="inward" type="checkbox"> Gathers inward</label>
</header>
<main id="tiles"></main>
<script>
const VERT=${JSON.stringify(AURA_VERTEX)}, FRAG=${JSON.stringify(AURA_FRAGMENT)}, MOTIFS=${JSON.stringify(AURA_MOTIFS)};
const $=id=>document.getElementById(id);
const settings=()=>({color:parseInt($('color').value.slice(1),16),edge:+$('edge').value,band:+$('band').value,wash:+$('wash').value,bandWidth:+$('bandWidth').value,gap:+$('gap').value,speed:+$('speed').value,inward:$('inward').checked,feet:+$('feet').value});
function tile(name,id){
  const fig=document.createElement('figure');fig.innerHTML='<div class="tile"><canvas class="map"></canvas><canvas class="gl"></canvas></div><figcaption>'+name+'</figcaption>';
  $('tiles').append(fig);
  const map=fig.querySelector('.map'),cv=fig.querySelector('.gl');
  const gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true});
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=n=>gl.getUniformLocation(pr,n);
  return {map,cv,gl,pr,loc,id};
}
// ?m=flame,frost shows only those motifs.
const only=new URLSearchParams(location.search).get('m')?.split(',');
const tiles=Object.entries(MOTIFS).filter(([n])=>!only||only.includes(n)).map(([n,id])=>tile(n,id));
function drawMap(t,size,grid){
  const c=t.map.getContext('2d');t.map.width=t.map.height=size;
  c.fillStyle='#6e6e6e';c.fillRect(0,0,size,size);c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1;
  for(let x=(size/2-grid/2)%grid;x<size;x+=grid){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,size);c.stroke();c.beginPath();c.moveTo(0,x+.5);c.lineTo(size,x+.5);c.stroke();}
  c.fillStyle='#8b5a2b';c.fillRect(size/2-grid/2+3,size/2-grid/2+3,grid-6,grid-6);
}
let last=-1;
function frame(ms){
  const s=settings(),dpr=devicePixelRatio||1;
  for(const t of tiles){
    const size=Math.round(t.cv.clientWidth*dpr);if(!size)continue;
    const squares=s.feet/5*2+1,grid=size/(squares+2),R=grid*(s.feet/5+0.5);
    if(t.cv.width!==size||last!==s.feet){t.cv.width=t.cv.height=size;drawMap(t,size,grid);}
    const gl=t.gl;gl.viewport(0,0,size,size);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(t.pr);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    const ext=R*1.08,sc=ext/(size/2);
    gl.uniformMatrix3fv(t.loc('translationMatrix'),false,[1,0,0,0,1,0,0,0,1]);
    gl.uniformMatrix3fv(t.loc('projectionMatrix'),false,[1/(size/2),0,0,0,-1/(size/2),0,0,0,1]);
    gl.uniform1f(t.loc('uExtent'),ext);
    gl.uniform1f(t.loc('uRadius'),R);gl.uniform1f(t.loc('uInner'),grid/2);gl.uniform1f(t.loc('uZoom'),1);
    gl.uniform1f(t.loc('uTime'),ms/1000*s.speed);gl.uniform1i(t.loc('uMotif'),t.id);
    gl.uniform3f(t.loc('uColor'),(s.color>>16&255)/255,(s.color>>8&255)/255,(s.color&255)/255);
    gl.uniform3f(t.loc('uStrength'),s.edge,s.band,s.wash);gl.uniform1f(t.loc('uBand'),s.bandWidth*grid);gl.uniform1f(t.loc('uGap'),s.gap*grid);
    gl.uniform1f(t.loc('uInward'),s.inward?1:0);gl.uniform1f(t.loc('uAlpha'),1);
    const a=gl.getAttribLocation(t.pr,'aVertexPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  last=s.feet;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script></body></html>`;
await writeFile(out, html);
console.log(out);
