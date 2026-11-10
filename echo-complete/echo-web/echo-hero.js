/* ECHO hero: living particle humanoid (original artwork, inspired by the reference mood).
   Replaces the old orb. #orb stays the tap target, so all existing click logic keeps working. */
(function(){
const orb=document.getElementById("orb");if(!orb)return;
const cv=document.createElement("canvas");orb.appendChild(cv);const ctx=cv.getContext("2d");
let W=0,H=0,F=1,cx=0,top=0,hcy=0,parts=[],terr=[],gold=[],dust=[],ptr=null,coreGrad=null,bodyGrad=null,streaks=[];
const calm=matchMedia("(prefers-reduced-motion: reduce)").matches;
function mk(seed){let s=seed;return()=>(s=(s*16807)%2147483647,(s-1)/2147483646)}
const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x)};
// half-width of the silhouette (units of figure height F) at height y (0 = top of head, 1 = base)
function hw(y){
 const head=(y>0&&y<.36)?.128*Math.sqrt(Math.max(0,1-Math.pow((y-.18)/.18,2))):0;
 const neck=(y>.26&&y<.52)?.06+(y>.42?Math.pow((y-.42)/.1,2)*.05:0):0;
 const sh=y>=.44?.06+.33*sm(.44,.8,y)+.04*sm(.8,1,y):0;
 return Math.max(head,neck,sh)}
function build(){
 const r=mk(11);F=H*.86;cx=W/2;top=H*.09;hcy=top+F*.19;
 const N=Math.round(Math.min(4600,Math.max(2200,W*H/45)));parts=[];
 for(let i=0;i<N;i++){const y=Math.pow(r(),.85)*.93,w=hw(y);if(w<.004){i--;continue}
  const edge=r()<.5,x=edge?(r()<.5?-1:1)*w*(.9+.1*r()):(r()*2-1)*w,out=edge?-Math.log(1-r())*.012:0;
  const core=Math.abs(x)<.075&&y>.06&&y<.30&&r()<.55;
  parts.push({x:x+(x<0?-out:out),y,sz:.9+r()*1.5,a:.5+r()*.5,ph:r()*6.28,sp:.4+r()*1.2,c:core?2:(r()<.18?1:0),e:edge?1:0})}
 terr=[];const M=Math.round(Math.min(4200,Math.max(2200,W*H/45)));
 const ridge=x=>{const d=Math.abs(x-cx)/(W/2);return H*.66-H*.38*Math.pow(d,1.15)-H*.05*Math.sin(x*.012)-H*.035*Math.sin(x*.031+1.7)-H*.02*Math.sin(x*.07)};
 for(let i=0;i<M;i++){const x=r()*W,ry=ridge(x),y=ry+Math.pow(r(),2.2)*H*.42;if(Math.abs(x-cx)<F*.05&&y<H*.8)continue;
  terr.push({x,y:Math.min(y,H*.98),sz:.8+r()*1.5,a:.4+r()*.6,ph:r()*6.28,c:r()<.14?1:0})}
 // golden energy streaks (curves from the edges towards the figure)
 streaks=[[0,.50,.16,.72,.40,.86],[0,.72,.20,.60,.42,.80],[1,.46,.84,.70,.62,.88],[1,.66,.80,.56,.58,.84]].map(s=>({sx:s[0]*W,sy:s[1]*H,c1x:s[2]*W,c1y:s[3]*H,ex:s[4]*W,ey:s[5]*H}));
 gold=[];streaks.forEach(s=>{for(let i=0;i<140;i++){const t=r(),u=1-t,px=u*u*s.sx+2*u*t*s.c1x+t*t*s.ex,py=u*u*s.sy+2*u*t*s.c1y+t*t*s.ey;
  gold.push({x:px+(r()-.5)*14,y:py+(r()-.5)*14,sz:1+r()*1.8,a:.5+r()*.5,ph:r()*6.28})}});
 dust=[];for(let i=0;i<90;i++)dust.push({x:r()*W,y:r()*H,sz:.5+r()*1.1,sp:.1+r()*.35,ph:r()*6.28});
 coreGrad=ctx.createLinearGradient(cx-F*.11,0,cx+F*.11,0);
 [[0,"rgba(60,160,255,.85)"],[.28,"rgba(90,190,255,.9)"],[.5,"rgba(255,150,40,.95)"],[.72,"rgba(90,190,255,.9)"],[1,"rgba(60,160,255,.85)"]].forEach(a=>coreGrad.addColorStop(a[0],a[1]));
 bodyGrad=ctx.createLinearGradient(cx-F*.34,0,cx+F*.34,0);
 [[0,"rgba(50,140,255,.0)"],[.2,"rgba(70,170,255,.55)"],[.5,"rgba(120,200,255,.7)"],[.8,"rgba(70,170,255,.55)"],[1,"rgba(50,140,255,.0)"]].forEach(a=>bodyGrad.addColorStop(a[0],a[1]))}
function size(){const R=Math.min(devicePixelRatio||1,2),b=orb.getBoundingClientRect();
 if(!b.width||!b.height)return;W=b.width;H=b.height;cv.width=Math.round(W*R);cv.height=Math.round(H*R);ctx.setTransform(R,0,0,R,0,0);build()}
new ResizeObserver(size).observe(orb);size();
orb.addEventListener("pointermove",e=>{const b=orb.getBoundingClientRect();ptr={x:e.clientX-b.left,y:e.clientY-b.top}});
orb.addEventListener("pointerleave",()=>ptr=null);orb.addEventListener("pointerup",()=>setTimeout(()=>ptr=null,400));
function state(){try{return window.ECHOSTATE?window.ECHOSTATE():{}}catch(e){return{}}}
let e=.15,T=0,last=performance.now();
const LAB={standby:"STANDBY",listening:"LISTENING",thinking:"THINKING",speaking:"SPEAKING"};
function frame(now){requestAnimationFrame(frame);if(document.hidden||!W)return;
 const dt=Math.min(.05,(now-last)/1000);last=now;T+=dt*(calm?.3:1);const t=T,S=state();
 const mode=S.speaking?"speaking":S.busy?"thinking":S.listening?"listening":"standby";
 const tgt=mode==="speaking"?.45+.5*Math.abs(Math.sin(t*7)*Math.sin(t*2.9+1)):mode==="thinking"?.65+.2*Math.sin(t*9):mode==="listening"?.3+.25*Math.abs(Math.sin(t*3)*Math.sin(t*1.3)):.12+.05*Math.sin(t);
 e+=(tgt-e)*Math.min(1,dt*8);
 const spd=mode==="thinking"?2.2:mode==="listening"?1.4:1;
 ctx.clearRect(0,0,W,H);
 // glow behind the figure + warm core
 let g=ctx.createRadialGradient(cx,hcy,0,cx,hcy,Math.min(F*.6,W*.5));g.addColorStop(0,"rgba(40,120,255,.34)");g.addColorStop(.7,"rgba(40,120,255,.08)");g.addColorStop(1,"rgba(40,120,255,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 g=ctx.createRadialGradient(cx,hcy,0,cx,hcy,F*.2);g.addColorStop(0,`rgba(255,140,30,${.4+e*.5})`);g.addColorStop(1,"rgba(255,150,40,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // terrain particles
 for(const p of terr){ctx.globalAlpha=p.a*(.55+.45*Math.sin(t*1.6+p.ph));ctx.fillStyle=p.c?"#9fe3ff":"#2f86ff";ctx.fillRect(p.x,p.y,p.sz,p.sz)}
 // gold streaks (thin lines + sparks)
 ctx.globalAlpha=.45;ctx.strokeStyle="#ffb454";ctx.lineWidth=1;streaks.forEach(s=>{ctx.beginPath();ctx.moveTo(s.sx,s.sy);ctx.quadraticCurveTo(s.c1x,s.c1y,s.ex,s.ey);ctx.stroke()});
 for(const p of gold){ctx.globalAlpha=p.a*(.4+.6*Math.abs(Math.sin(t*2+p.ph)));ctx.fillStyle="#ffc46b";ctx.fillRect(p.x,p.y,p.sz,p.sz)}
 // concentric dotted rings
 ctx.lineWidth=1.4;ctx.strokeStyle="#5db4ff";
 for(let i=0;i<7;i++){const ph=((t*.07*spd*(1+e*.8)+i/7)%1),r=(.13+ph*.78)*F;ctx.globalAlpha=Math.pow(1-ph,1.4)*.8;ctx.setLineDash([1,5+i]);ctx.beginPath();ctx.arc(cx,hcy,r,0,6.2832);ctx.stroke()}
 ctx.setLineDash([]);
 // torso contour lines (curved, flowing)
 ctx.strokeStyle=bodyGrad;ctx.lineWidth=1;
 for(let k=0;k<16;k++){const y0=.48+k*.03;ctx.globalAlpha=.5-k*.02;ctx.beginPath();
  for(let s=-1;s<=1.001;s+=.05){const w=hw(y0)*.96,x=cx+s*w*F,y=top+(y0+.018*(1-s*s)+Math.sin(s*5+t*spd+k*.6)*(.003+e*.006))*F;s<-.99?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}
 // figure particles
 const br=1+.008*Math.sin(t*.8)+e*.012,col=["#3e9bff","#bfeaff","#ff9a2e"];
 for(let c=0;c<3;c++){ctx.fillStyle=col[c];for(const p of parts){if(p.c!==c)continue;
   let x=cx+(p.x*br+Math.sin(t*p.sp*spd+p.ph)*(p.e?.006:.003))*F,y=top+(p.y+Math.cos(t*p.sp*spd+p.ph)*.003)*F;
   if(ptr){const dx=x-ptr.x,dy=y-ptr.y,d=Math.hypot(dx,dy),R=F*.13;if(d<R&&d>.1){const k=(1-d/R)*F*.05;x+=dx/d*k;y+=dy/d*k}}
   ctx.globalAlpha=p.a*(.6+.4*Math.sin(t*2+p.ph))*(c===2?.6+e*.5:1);ctx.fillRect(x,y,p.sz,p.sz)}}
 // face contour lines: blue at the edges, orange energy in the middle
 ctx.strokeStyle=coreGrad;ctx.lineWidth=1.1;
 for(let k=0;k<24;k++){const y0=.065+k*.0105,w=hw(y0)*.92;ctx.globalAlpha=.55+e*.35;ctx.beginPath();
  for(let s=-1;s<=1.001;s+=.04){const x=cx+s*w*F,y=top+(y0+Math.sin(s*7+t*3*spd+k*.5)*(.0022+e*.0085)*(1-Math.abs(s)*.4))*F;s<-.99?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}
 // floating dust
 ctx.fillStyle="#8fd0ff";for(const d of dust){d.y-=d.sp*dt*20;if(d.y<0)d.y=H;ctx.globalAlpha=.4+.4*Math.sin(t+d.ph);ctx.fillRect(d.x+Math.sin(t*.5+d.ph)*6,d.y,d.sz,d.sz)}
 // status readout (same idea as the reference HUD, own wording)
 ctx.globalAlpha=.8;ctx.fillStyle="#7cc4ff";const fs=Math.max(9,Math.min(13,W*.022));ctx.font=`${fs}px ui-monospace,Menlo,monospace`;
 try{ctx.letterSpacing="2px"}catch(_){}
 const tx=Math.min(W-fs*14,cx+F*.2),ty=top+F*.2;ctx.fillText("STATUS: "+LAB[mode],tx,ty);ctx.globalAlpha=.35;ctx.fillRect(cx+F*.11,ty-fs*.35,tx-cx-F*.11-6,1);
 ctx.globalAlpha=1}
requestAnimationFrame(frame);
})();
