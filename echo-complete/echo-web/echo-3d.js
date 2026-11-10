/* ECHO 3D module (additive). Voice/text -> 3D model -> viewer, hand gestures, explode view, STL/OBJ/GLB export.
   Same JSON schema as the iOS app (parts: box|sphere|cylinder|cone|capsule|torus|pyramid). */
(function(){
const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
const GLTF_URL="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js";
const HANDS_URL="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js";
const HANDS_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";
const SYS=`You design 3D models out of primitive shapes. Reply with ONLY one JSON object, no markdown.
Schema: {"name":"short Dutch name","computer":true|false,"parts":[{"shape":"box|sphere|cylinder|cone|capsule|torus|pyramid","label":"part name","size":[..],"position":[x,y,z],"rotation":[x,y,z],"color":"#RRGGBB","metal":0-1,"rough":0-1}]}
Sizes: box [w,h,l]; sphere [r]; cylinder [r,h]; cone [r,h]; capsule [r,h]; torus [ring,pipe]; pyramid [w,h,l].
Y is up, rotation in degrees, object centered at origin inside a cube from -1 to 1. Use 8 to 60 parts, parts must touch or overlap.
Set "computer":true for computer hardware (PC, laptop, phone, console, server) and then give every part a clear "label" (e.g. "moederbord","gpu","koeling","voeding") with internal parts INSIDE a casing.`;
let T=null,state={model:null,group:null,exploded:0,target:0,hands:null,cam:false,sc:null,ren:null,cm:null,root:null,raf:0};
const load=u=>new Promise((ok,no)=>{const s=document.createElement("script");s.src=u;s.onload=ok;s.onerror=()=>no(new Error("kon "+u+" niet laden"));document.head.appendChild(s)});
async function lib(){if(window.THREE)return;await load(THREE_URL);await load(GLTF_URL)}
function col(h){try{return new THREE.Color(h||"#aaaaaa")}catch(e){return new THREE.Color("#aaaaaa")}}
function num(a,i,d){return a&&typeof a[i]==="number"?Math.min(Math.max(a[i],.01),5):d}
function geo(p){const s=p.size,k=(p.shape||"box").toLowerCase();
 if(k==="sphere")return new THREE.SphereGeometry(num(s,0,.3),32,24);
 if(k==="cylinder")return new THREE.CylinderGeometry(num(s,0,.2),num(s,0,.2),num(s,1,.5),32);
 if(k==="cone")return new THREE.ConeGeometry(num(s,0,.3),num(s,1,.5),32);
 if(k==="capsule"){const r=num(s,0,.15);return THREE.CapsuleGeometry?new THREE.CapsuleGeometry(r,Math.max(num(s,1,.5)-2*r,.01),8,16):new THREE.CylinderGeometry(r,r,num(s,1,.5),24)}
 if(k==="torus")return new THREE.TorusGeometry(num(s,0,.4),num(s,1,.1),16,48);
 if(k==="pyramid")return new THREE.ConeGeometry(num(s,0,.5)/1.414,num(s,1,.5),4);
 return new THREE.BoxGeometry(num(s,0,.4),num(s,1,.4),num(s,2,.4))}
function build(m){const g=new THREE.Group();g.name=m.name||"model";
 (m.parts||[]).slice(0,80).forEach((p,i)=>{
  const mesh=new THREE.Mesh(geo(p),new THREE.MeshStandardMaterial({color:col(p.color),metalness:p.metal??.15,roughness:p.rough??.55}));
  const pos=p.position||[0,0,0],r=p.rotation||[0,0,0];
  mesh.position.set(pos[0]||0,pos[1]||0,pos[2]||0);
  mesh.rotation.set((r[0]||0)*Math.PI/180,(r[1]||0)*Math.PI/180,(r[2]||0)*Math.PI/180);
  mesh.name=p.label||("deel"+i);mesh.userData.home=mesh.position.clone();mesh.castShadow=mesh.receiveShadow=true;g.add(mesh)});
 return g}
function parse(t){const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a<0||b<a)throw new Error("geen model");
 const m=JSON.parse(t.slice(a,b+1));if(!m.parts||!m.parts.length)throw new Error("geen onderdelen");return m}

// ---------- overlay UI
function ui(){if(document.getElementById("e3d"))return;
 const d=document.createElement("div");d.id="e3d";d.hidden=true;
 d.style.cssText="position:fixed;inset:0;z-index:7;background:#0d0b09;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)";
 d.innerHTML=`<div style="display:flex;gap:6px;padding:8px;flex-wrap:wrap" id="e3b"></div>
 <div style="position:relative;flex:1;min-height:0"><canvas id="e3c" style="width:100%;height:100%;display:block;touch-action:none"></canvas>
 <video id="e3v" playsinline muted style="position:absolute;right:8px;bottom:8px;width:120px;border-radius:10px;opacity:.7;transform:scaleX(-1)" hidden></video>
 <div id="e3s" style="position:absolute;left:10px;bottom:8px;color:#a8957c;font-size:13px"></div></div>`;
 document.body.appendChild(d);
 const B=(l,f)=>{const b=document.createElement("button");b.textContent=l;b.style.cssText="padding:10px 12px;border-radius:12px;border:1px solid #4a3a28;background:#1a1612;color:#f3e9dc;font:inherit;font-size:14px";b.onclick=f;document.getElementById("e3b").appendChild(b);return b};
 B("Sluiten",close);
 B("Uitklappen",()=>explode());
 B("Gebaren",toggleHands);
 B("STL",()=>exp("stl"));B("OBJ",()=>exp("obj"));B("GLB",()=>exp("glb"));
 setup()}
function status(t){const s=document.getElementById("e3s");if(s)s.textContent=t}
function setup(){const c=document.getElementById("e3c");
 const r=new THREE.WebGLRenderer({canvas:c,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.toneMapping=THREE.ACESFilmicToneMapping;
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x0d0b09);sc.fog=new THREE.Fog(0x0d0b09,6,14);
 const cm=new THREE.PerspectiveCamera(40,1,.05,50);cm.position.set(0,.9,4.2);
 sc.add(new THREE.HemisphereLight(0xffe2bf,0x1a120a,.7));
 const k=new THREE.DirectionalLight(0xffffff,1.6);k.position.set(3,5,3);k.castShadow=true;sc.add(k);
 const rim=new THREE.PointLight(0xffb454,1.4,12);rim.position.set(-3,1.5,-2);sc.add(rim);
 const fl=new THREE.Mesh(new THREE.CircleGeometry(4,64),new THREE.MeshStandardMaterial({color:0x17110b,metalness:.6,roughness:.35}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.05;fl.receiveShadow=true;sc.add(fl);
 const root=new THREE.Group();sc.add(root);Object.assign(state,{sc,ren:r,cm,root});
 // pointer: 1 finger rotate, 2 fingers pinch zoom
 const P=new Map();let last=0;
 c.onpointerdown=e=>{c.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY])};
 c.onpointerup=c.onpointercancel=e=>{P.delete(e.pointerId);last=0};
 c.onpointermove=e=>{if(!P.has(e.pointerId))return;const o=P.get(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);
  if(P.size===1){root.rotation.y+=(e.clientX-o[0])*.01;root.rotation.x+=(e.clientY-o[1])*.01}
  else if(P.size===2){const[a,b]=[...P.values()],dd=Math.hypot(a[0]-b[0],a[1]-b[1]);if(last)zoom(dd/last);last=dd}};
 c.onwheel=e=>{e.preventDefault();zoom(e.deltaY>0?.95:1.05)};
 addEventListener("resize",fit);fit()}
function zoom(f){const s=Math.min(Math.max(state.root.scale.x*f,.3),4);state.root.scale.setScalar(s)}
function fit(){const c=document.getElementById("e3c");if(!c||!state.ren)return;const w=c.clientWidth,h=c.clientHeight;state.ren.setSize(w,h,false);state.cm.aspect=w/h;state.cm.updateProjectionMatrix()}
function loop(){state.raf=requestAnimationFrame(loop);
 state.exploded+=(state.target-state.exploded)*.08;
 if(state.group)state.group.children.forEach(m=>{const h=m.userData.home,d=h.clone().normalize();if(h.length()<.001)d.set(0,1,0);m.position.copy(h).addScaledVector(d,state.exploded*(.5+h.length()*.6))});
 if(!state.hand&&!document.getElementById("e3c").matches(":active"))state.root.rotation.y+=.002;
 state.ren.render(state.sc,state.cm)}
function show(m){ui();state.model=m;if(state.group)state.root.remove(state.group);state.group=build(m);state.root.add(state.group);
 state.root.scale.setScalar(1);state.root.rotation.set(.2,0,0);state.target=0;state.exploded=0;
 document.getElementById("e3").hidden=false;fit();cancelAnimationFrame(state.raf);loop();
 status(m.name+(m.computer?" · tik Uitklappen voor explosieweergave":""))}
function explode(on){state.target=on===undefined?(state.target?0:1):(on?1:0)}
function close(){document.getElementById("e3").hidden=true;cancelAnimationFrame(state.raf);stopHands()}

// ---------- hand gestures (MediaPipe Hands via webcam / iPhone camera)
// pinch (thumb+index) = grab and rotate; two hands pinching = zoom; fist = explode toggle
async function toggleHands(){state.cam?stopHands():await startHands()}
async function startHands(){
 try{status("Camera starten…");if(!window.Hands)await load(HANDS_URL);
  const v=document.getElementById("e3v");v.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:640,height:480}});v.hidden=false;await v.play();
  const h=new Hands({locateFile:f=>HANDS_BASE+f});h.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.6,minTrackingConfidence:.6});
  let prev=null,pd=0,fistT=0;
  h.onResults(r=>{const L=r.multiHandLandmarks||[];state.hand=L.length>0;
   const pinch=l=>Math.hypot(l[4].x-l[8].x,l[4].y-l[8].y)<.05;
   const fist=l=>[8,12,16,20].every(i=>l[i].y>l[i-2].y);
   if(L.length===2&&pinch(L[0])&&pinch(L[1])){const d=Math.hypot(L[0][8].x-L[1][8].x,L[0][8].y-L[1][8].y);if(pd)zoom(d/pd);pd=d;prev=null;return}
   pd=0;
   if(L.length===1){const l=L[0];
    if(pinch(l)){const p={x:l[8].x,y:l[8].y};if(prev){state.root.rotation.y-=(p.x-prev.x)*6;state.root.rotation.x+=(p.y-prev.y)*6}prev=p}
    else{prev=null;if(fist(l)){if(Date.now()-fistT>1500){fistT=Date.now();explode()}}}}
   else prev=null});
  state.hands=h;state.cam=true;status("Gebaren aan: knijp = pakken/draaien · twee handen knijpen = zoomen · vuist = uitklappen");
  const tick=async()=>{if(!state.cam)return;try{await h.send({image:v})}catch(e){}requestAnimationFrame(tick)};tick()
 }catch(e){status("Camera/handtracking niet beschikbaar: "+e.message);stopHands()}}
function stopHands(){state.cam=false;state.hand=false;const v=document.getElementById("e3v");if(v){if(v.srcObject)v.srcObject.getTracks().forEach(t=>t.stop());v.srcObject=null;v.hidden=true}try{state.hands&&state.hands.close()}catch(e){}state.hands=null}

// ---------- export (for 3D printing: STL in mm, 1 unit = 100 mm)
function tris(){const out=[];state.root.updateMatrixWorld(true);const g0=state.group; g0.children.forEach(m=>{m.position.copy(m.userData.home)});g0.updateMatrixWorld(true);
 g0.children.forEach(m=>{const gm=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=gm.attributes.position,M=m.matrix;
  const v=[];for(let i=0;i<p.count;i++)v.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(M));
  for(let i=0;i<v.length;i+=3)out.push([v[i],v[i+1],v[i+2]])});return out}
function stl(){const T3=tris(),S=100;let s="solid echo\n";
 for(const[a,b,c]of T3){const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
  s+=`facet normal ${n.x} ${n.y} ${n.z}\n outer loop\n`;for(const v of[a,b,c])s+=`  vertex ${v.x*S} ${-v.z*S} ${v.y*S}\n`;s+=" endloop\nendfacet\n"}
 return s+"endsolid echo\n"}
function obj(){const T3=tris();let s="# ECHO\n",k=1;for(const t of T3){for(const v of t)s+=`v ${v.x} ${v.y} ${v.z}\n`;s+=`f ${k} ${k+1} ${k+2}\n`;k+=3}return s}
function save(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}
async function exp(kind){const n=(state.model.name||"model").replace(/\W+/g,"-");
 try{if(kind==="glb"){new THREE.GLTFExporter().parse(state.group,b=>save(new Blob([b],{type:"model/gltf-binary"}),n+".glb"),{binary:true});return}
  const f=new File([kind==="stl"?stl():obj()],n+"."+kind,{type:"text/plain"});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f]});return}catch(e){}}save(f,f.name);
  status(kind==="stl"?"STL klaar (1 eenheid = 100 mm, schaal in je slicer aan). Controleer wanddikte voor het printen.":"OBJ klaar")}
 catch(e){status("Export mislukt: "+e.message)}}

// ---------- public: called from ECHO's route()
async function make(desc,ai){await lib();const raw=await ai(SYS,"Ontwerp: "+desc);show(parse(raw));return state.model}
window.ECHO3D={make,show,explode,close,startHands,stopHands,SYS,
 handles:t=>/\b(3\s?d|drie\s?d)\b/.test(t)&&/\b(maak|bouw|ontwerp|genereer|model)\b/.test(t)||/\b(explosie|uitklappen|uit elkaar)\b/.test(t)&&!!state.model};
})();
