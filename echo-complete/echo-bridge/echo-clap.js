/* ECHO clap detection (additive). 2 claps = start listening, 3 claps = "stop alle processen".
   Only listens while ECHO is idle (not speaking/listening/thinking) and the page is visible; releases the mic otherwise,
   because iOS Safari can't share the microphone with speech recognition. Nothing is recorded or sent anywhere. */
(function(){
const $=id=>document.getElementById(id);
let LOCAL=null;
const conf=()=>{try{return C}catch(e){}if(!LOCAL){try{LOCAL=JSON.parse(localStorage.echoClap||"{}")}catch(e){LOCAL={}}}return LOCAL};
const persist=()=>{try{save();return}catch(e){}try{localStorage.echoClap=JSON.stringify(LOCAL||{})}catch(e){}};
let ctx=null,stream=null,an=null,timer=0,buf=null,fq=null,floor=.01,prevPeak=0,lastClap=0,claps=[],fin=0,starting=false;
const listeners=[];
const api=window.ECHOCLAP={onPattern:f=>listeners.push(f),running:()=>!!stream};
const sens=()=>Math.min(10,Math.max(1,+conf().clapS||6));
const thr=()=>.9-sens()*.07;                        // sensitivity 1..10 -> peak threshold .83..0.2

function pattern(n){
  listeners.forEach(f=>{try{f(n)}catch(e){}});
  try{typeof beep==="function"&&beep()}catch(e){}
  if(!$("orb")||!$("tx")||!$("sd"))return;                       // pages without the assistant (bridge remote) use onPattern only
  if(n===2){$("orb").click()}                                   // same as tapping the figure
  else if(n>=3){$("tx").value="stop alle processen";$("sd").click()}
}
function onClap(now){
  if(now-lastClap<140)return;lastClap=now;claps.push(now);
  window.dispatchEvent(new CustomEvent("echo-clap"));
  clearTimeout(fin);fin=setTimeout(()=>{const n=claps.length;claps=[];if(n>=2)pattern(Math.min(n,3))},650);
}
function tick(){
  if(!an)return;an.getFloatTimeDomainData(buf);
  let pk=0,sq=0;for(let i=0;i<buf.length;i++){const a=Math.abs(buf[i]);if(a>pk)pk=a;sq+=a*a}
  const rms=Math.sqrt(sq/buf.length),now=performance.now();
  if(pk>thr()&&pk>floor*7&&pk>prevPeak*1.8&&now-lastClap>140){
    an.getByteFrequencyData(fq);let hi=0,tot=0;const k=Math.round(2000/(ctx.sampleRate/2)*fq.length);
    for(let i=1;i<fq.length;i++){tot+=fq[i];if(i>=k)hi+=fq[i]}
    if(tot>0&&hi/tot>.3)onClap(now)                              // broadband + sudden = clap (speech/music are mostly low and gradual)
  }
  floor=floor*.97+rms*.03;prevPeak=pk*.5+prevPeak*.3;
}
async function start(){
  if(stream||starting)return;
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){const c=conf();c.clap=false;persist();label();alert("Klapdetectie werkt alleen via https of op localhost (de browser geeft anders geen toegang tot de microfoon).");return}
  starting=true;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    ctx=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==="suspended")await ctx.resume();
    an=ctx.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=0;ctx.createMediaStreamSource(stream).connect(an);
    buf=new Float32Array(an.fftSize);fq=new Uint8Array(an.frequencyBinCount);floor=.01;prevPeak=0;timer=setInterval(tick,12);
  }catch(e){stream=null;const c=conf();c.clap=false;persist();label();alert("Klapdetectie heeft toegang tot de microfoon nodig.")}
  starting=false}
function stop(){clearInterval(timer);timer=0;an=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}if(ctx){try{ctx.close()}catch(e){}ctx=null}claps=[];clearTimeout(fin)}
function idle(){if(typeof ECHOSTATE!=="function")return !speechSynthesis.speaking;try{const s=ECHOSTATE();return !s.busy&&!s.speaking&&!s.listening}catch(e){return false}}
function sync(){const want=!!conf().clap&&!document.hidden&&idle();want?start():stop()}
function label(){const b=$("clapb");if(b)b.textContent="Klap: "+(conf().clap?"aan":"uit")}

// UI: button next to "Hey Echo" + sensitivity slider in settings
const w=$("wake");
{const b=document.createElement("button");b.id="clapb";b.onclick=()=>{const c=conf();c.clap=!c.clap;persist();label();sync()};
 if(w){b.className=w.className;w.after(b)}
 else{b.style.cssText="position:fixed;right:12px;top:calc(8px + env(safe-area-inset-top));z-index:60;padding:8px 12px;border-radius:12px;border:1px solid #4a3a28;background:#1a1612;color:#f3e9dc;font:600 13px system-ui";document.body.appendChild(b)}
 label()}
const cfg=$("cfg"),sv=$("save");
if(cfg&&sv){const l=document.createElement("label");l.textContent="Klapdetectie gevoeligheid (1 = streng, 10 = gevoelig)";
 const r=document.createElement("input");r.type="range";r.min=1;r.max=10;r.id="f_clapS";r.value=sens();r.style.cssText="accent-color:#ffb454;width:100%;margin:6px 0 10px";r.oninput=()=>{conf().clapS=+r.value;persist()};
 sv.before(l,r)}
document.addEventListener("visibilitychange",sync);
$("orb")&&$("orb").addEventListener("click",()=>{stop()},true);     // release the mic before speech recognition starts
setInterval(sync,500);sync();
})();
