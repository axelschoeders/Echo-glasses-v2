/* ECHO Jarvis voice (additive). Loaded on every page; changes how ALL speechSynthesis output sounds:
   deep male voice, calm butler tempo, soft "online" chime before the first sentence.
   Limits: a browser can only pick from the voices installed on the device and tune pitch/speed.
   It cannot reproduce the film voice itself. Install an "Enhanced"/"Premium" Dutch or British male voice
   (iOS: Instellingen > Toegankelijkheid > Gesproken content > Stemmen) for the best result. */
(function(){
if(!window.speechSynthesis||window.ECHOJARVIS)return;
const KEY="echoJarvis";
const S=Object.assign({on:true,pitch:.8,rate:.94,chime:true},(()=>{try{return JSON.parse(localStorage[KEY]||"{}")}catch(e){return{}}})());
const save=()=>{try{localStorage[KEY]=JSON.stringify(S)}catch(e){}};
const MALE_NL=/xander|maarten|ruben|frank|jasper|daan|male|man\b/i;
const MALE_EN=/daniel|arthur|oliver|james|google uk english male|male/i;
const FEMALE=/ellen|claire|female|vrouw|fenna|colette|samantha|karen|kate|serena/i;
const rank=v=>(/premium|enhanced|natural|neural/i.test(v.name)?2:0)+(v.localService?1:0);

function pick(lang){
  const all=speechSynthesis.getVoices();if(!all.length)return null;
  const en=/^en/i.test(lang||"");
  const pool=all.filter(v=>en?/^en[-_]GB/i.test(v.lang):/^nl/i.test(v.lang));
  const male=pool.filter(v=>(en?MALE_EN:MALE_NL).test(v.name)&&!FEMALE.test(v.name));
  const list=(male.length?male:pool.filter(v=>!FEMALE.test(v.name))).sort((a,b)=>rank(b)-rank(a));
  return list[0]||pool.sort((a,b)=>rank(b)-rank(a))[0]||null;
}
function userVoice(){try{return JSON.parse(localStorage.echo||"{}").voice||""}catch(e){return""}}   // voice chosen in Instellingen wins

// soft two-tone chime (Web Audio, no files)
let ac=null,lastEnd=0;
function chime(){
  try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume();
    const t=ac.currentTime;[[523.25,0],[783.99,.09]].forEach(([f,d])=>{
      const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f;o.connect(g);g.connect(ac.destination);
      g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.12,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.28);o.start(t+d);o.stop(t+d+.3)});
    return true}catch(e){return false}
}

const proto=window.SpeechSynthesis&&SpeechSynthesis.prototype;
if(!proto)return;
const orig=proto.speak;
proto.speak=function(u){
  try{
    if(S.on&&u&&u.text&&u.text.trim()&&u.volume>0){
      const lang=u.lang||"nl-NL";
      if(!userVoice()){const v=pick(lang);if(v){u.voice=v;u.lang=v.lang}}
      u.pitch=S.pitch;u.rate=S.rate;
      const end=()=>{lastEnd=Date.now()};
      u.addEventListener("end",end);u.addEventListener("error",end);
      if(S.chime&&Date.now()-lastEnd>6000&&chime()){lastEnd=Date.now();const self=this;setTimeout(()=>orig.call(self,u),220);return}
    }
  }catch(e){}
  return orig.call(this,u);
};
speechSynthesis.addEventListener&&speechSynthesis.addEventListener("voiceschanged",()=>{});

const api=window.ECHOJARVIS={settings:S,chime,
  say:t=>{const u=new SpeechSynthesisUtterance(t);u.lang="nl-NL";speechSynthesis.cancel();speechSynthesis.speak(u)},
  voiceName:()=>{const v=pick("nl-NL");return v?v.name:"(geen)"}};

// Settings UI (only on pages that have the settings panel)
const cfg=document.getElementById("cfg"),sv=document.getElementById("save");
if(cfg&&sv){
  const box=document.createElement("div");box.style.cssText="margin:6px 0 12px";
  const l=document.createElement("label");l.style.display="block";
  const on=document.createElement("input");on.type="checkbox";on.checked=S.on;on.style.cssText="margin-right:8px";
  on.onchange=()=>{S.on=on.checked;save()};l.append(on,"Jarvis-stem");
  const p=document.createElement("input");p.type="range";p.min=60;p.max=110;p.value=Math.round(S.pitch*100);p.style.cssText="accent-color:#ffb454;width:100%;margin:6px 0";
  p.oninput=()=>{S.pitch=p.value/100;save()};
  const hint=document.createElement("div");hint.style.cssText="font-size:12px;opacity:.7";hint.textContent="Diepte van de stem (links = dieper). Stem: laden…";
  const t=document.createElement("button");t.textContent="Test Jarvis";t.style.marginTop="6px";
  t.onclick=()=>{api.say("Goedendag. Alle systemen zijn online, en tot uw dienst.")};
  box.append(l,p,hint,t);sv.before(box);
  const upd=()=>{hint.textContent="Diepte van de stem (links = dieper). Stem: "+api.voiceName()};
  upd();speechSynthesis.addEventListener&&speechSynthesis.addEventListener("voiceschanged",upd);
}
})();
