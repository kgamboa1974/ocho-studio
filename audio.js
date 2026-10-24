export const CATEGORIES = ['music','effect','voice'];
export function blockSeconds(bpm) { return 480 / bpm; }
export function routineSeconds(project) { return project.blocks * blockSeconds(project.bpm); }
export function clamp(value,min,max) { return Math.min(max,Math.max(min,value)); }
export function formatTime(seconds,padded=false,decimals=1) {
 const scale=10**decimals,ticks=Math.floor(Math.max(0,seconds)*scale+0.000001),mins=Math.floor(ticks/(60*scale)),sec=Math.floor(ticks/scale)%60;
 return `${padded?String(mins).padStart(2,'0'):mins}:${String(sec).padStart(2,'0')}.${String(ticks%scale).padStart(decimals,'0')}`;
}
export function clipWindow(clip,asset,project) {
 const start=clip.start*blockSeconds(project.bpm);
 const length=Math.min(clip.length*blockSeconds(project.bpm),asset.duration-clip.offset,routineSeconds(project)-start);
 return {start,length:Math.max(0,length)};
}
export function writeWav(buffer) {
 const channels=buffer.numberOfChannels,frames=buffer.length,size=frames*channels*2;
 const bytes=new ArrayBuffer(44+size),v=new DataView(bytes);
 const text=(pos,s)=>[...s].forEach((c,i)=>v.setUint8(pos+i,c.charCodeAt(0)));
 text(0,'RIFF');v.setUint32(4,36+size,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,size,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let p=44;
 for(let f=0;f<frames;f++)for(let c=0;c<channels;c++){const n=clamp(data[c][f],-1,1);v.setInt16(p,n<0?n*32768:n*32767,true);p+=2;}
 return bytes;
}
// Deterministic, original demo sounds, generated locally with no samples.
export function generateDemo(ctx,kind,bpm=144) {
 const duration=kind==='pulse'?480/bpm*4:kind==='rise'?480/bpm:1.25;
 const b=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),rate=ctx.sampleRate,beat=60/bpm;
 let seed=27;const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2147483648-1};
 for(let i=0;i<b.length;i++){
  const t=i/rate,n=noise();let s=0;
  if(kind==='pulse'){
   const k=t%beat,h=t%(beat/2),sn=(t+beat)%(beat*2);
   const kick=Math.sin(2*Math.PI*(45*k+12*(1-Math.exp(-k*35))))*Math.exp(-k*18);
   const hat=n*Math.exp(-h*80)*.16;
   const clap=n*Math.exp(-sn*35)*.25;
   const note=[55,55,65.406,73.416][Math.floor(t/(beat*4))%4];
   const bass=(Math.sin(2*Math.PI*note*t)+.2*Math.sin(4*Math.PI*note*t))*Math.exp(-k*5)*.17;
   s=(kick*.55+hat+clap+bass)*Math.min(1,t*100,Math.max(0,(duration-t)*20));
  }else if(kind==='rise'){
   const p=t/duration;s=(n*.22+Math.sin(2*Math.PI*(130*t+220*t*t))*.07)*p*p*Math.min(1,(duration-t)*70);
  }else{s=(Math.sin(2*Math.PI*(60*t+10*(1-Math.exp(-t*30))))*.65+n*.22)*Math.exp(-t*7)*Math.min(1,t*200);}
  b.getChannelData(0)[i]=s;b.getChannelData(1)[i]=s;
 }
 return b;
}
export function scheduleMix(ctx,project,assets,when,position=0,{click=false,destination=ctx.destination}={}) {
 const nodes=[];
 for(const c of project.clips){
  const asset=assets.get(c.assetId);if(!asset?.buffer)continue;
  const {start,length}=clipWindow(c,asset,project),elapsed=Math.max(0,position-start),remaining=length-elapsed;
  if(remaining<=0)continue;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=asset.buffer;
  const at=when+Math.max(0,start-position),volume=c.volume*.68;
  const fadeIn=Math.min(c.fadeIn||0,length/2),fadeOut=Math.min(c.fadeOut||0,length/2);
  const envelope=e=>Math.max(0,Math.min(1,fadeIn?e/fadeIn:1,fadeOut?(length-e)/fadeOut:1))*volume;
  gain.gain.setValueAtTime(envelope(elapsed),at);
  if(fadeIn>elapsed)gain.gain.linearRampToValueAtTime(volume,at+fadeIn-elapsed);
  const fadeStart=length-fadeOut;
  if(fadeStart>elapsed)gain.gain.setValueAtTime(volume,at+fadeStart-elapsed);
  gain.gain.linearRampToValueAtTime(envelope(length),at+remaining);
  source.connect(gain).connect(destination);source.start(at,c.offset+elapsed,remaining);nodes.push(source);
 }
 if(click){
  const beat=60/project.bpm;
  for(let n=Math.ceil(position/beat);n*beat<routineSeconds(project);n++){
   const at=when+n*beat-position,osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=n%8===0?1300:850;
   gain.gain.setValueAtTime(.18,at);gain.gain.exponentialRampToValueAtTime(.001,at+.045);osc.connect(gain).connect(destination);osc.start(at);osc.stop(at+.05);nodes.push(osc);
  }
 }
 return nodes;
}
export function validateProject(p) {
 if(!p||p.version!==1||typeof p.name!=='string'||p.name.length>100||!Number.isFinite(p.bpm)||p.bpm<60||p.bpm>200||!Number.isInteger(p.blocks)||p.blocks<1||p.blocks>64||!Array.isArray(p.clips)||p.clips.length>512)throw Error('Formato de proyecto no válido.');
 const ids=new Set();
 for(const c of p.clips){if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.assetId!=='string'||!CATEGORIES.includes(c.category)||!Number.isFinite(c.start)||c.start<0||c.start>=p.blocks||!Number.isFinite(c.length)||c.length<=0||!Number.isFinite(c.offset)||c.offset<0||!Number.isFinite(c.volume)||c.volume<0||c.volume>1||!Number.isFinite(c.fadeIn)||c.fadeIn<0||!Number.isFinite(c.fadeOut)||c.fadeOut<0)throw Error('El proyecto contiene un clip no válido.');ids.add(c.id);}
 return {version:1,name:p.name,bpm:p.bpm,blocks:p.blocks,clips:p.clips.map(c=>({...c}))};
}
