import {CATEGORIES,blockSeconds,routineSeconds,clamp,formatTime,clipWindow,writeWav,generateDemo,scheduleMix,validateProject} from './audio.js?v=1.2.0';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], id=()=>crypto.randomUUID();
const titles={music:'Música',effect:'Efectos',voice:'Voces'}, icons={music:'♫',effect:'ϟ',voice:'♩'};
let project={version:1,name:'Mi rutina de campeonato',bpm:144,blocks:16,clips:[]};
let assets=new Map(),category='music',chosen=null,selected=null,context,playing=false,position=0,startClock=0,sources=[],raf,zoom=88,db,saveTimer,previewSource,recorder,recordStream,recordTimer,recordStart,recordBusy=false,busy=false;
let seekDrag=null,seekFrame,dragGrabOffset=0,timelineView='counts';
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
async function audioContext(resume=false){if(!context)context=new AudioContext();if(resume&&context.state==='suspended')await context.resume();return context;}
function safeName(name){return name.replace(/[\\/:*?"<>|]/g,'-').slice(0,80)||'rutina';}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function currentPosition(){return playing?clamp(context.currentTime-startClock,0,routineSeconds(project)):position;}
function pause(){position=currentPosition();playing=false;for(const node of sources){try{node.stop();}catch{}}sources=[];cancelAnimationFrame(raf);$('#play').textContent='▶︎';$('#play').setAttribute('aria-label','Reproducir');paintTransport();}
function stop(){pause();position=0;paintTransport();}
async function play(){if(playing){pause();return;}if(recordBusy||busy)return;try{const ctx=await audioContext(true);if(position>=routineSeconds(project))position=0;previewSource?.stop();previewSource=null;const at=ctx.currentTime+.05;startClock=at-position;sources=scheduleMix(ctx,project,assets,at,position,{click:$('#metronome').checked});playing=true;$('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label','Pausar');tick();}catch(e){toast('No se pudo reproducir: '+e.message);}}
function tick(){paintTransport();if(currentPosition()>=routineSeconds(project)){pause();position=0;paintTransport();return;}raf=requestAnimationFrame(tick);}
function paintTransport(){
 const t=currentPosition(),beat=Math.floor(t/(60/project.bpm)),head=$('#playhead');
 $('#time').textContent=formatTime(t,true,3);
 $('#current-block').textContent=String(Math.min(project.blocks,Math.floor(t/blockSeconds(project.bpm))+1)).padStart(2,'0');
 $$('#beat-dots i').forEach((el,i)=>el.classList.toggle('on',i===beat%8));
 head.style.display='block';paintTimelineMarker(head,t/blockSeconds(project.bpm));
 head.setAttribute('aria-valuemax',routineSeconds(project));head.setAttribute('aria-valuenow',t);
 head.setAttribute('aria-valuetext',formatTime(t,true,3));head.title='Arrastra para elegir la posición · '+t.toFixed(3)+' s';
}
// Both views use the same fractional-block time model; rows only wrap its display.
function timelineScale(){return timelineView==='counts'?Number($('#timeline').dataset.blockWidth):zoom;}
function rowAtY(y){
 const bodies=$$('.count-body');if(!bodies.length)return 0;
 const header=$('#ruler').getBoundingClientRect();
 if(y===undefined||y<=header.bottom)return Math.min(project.blocks-1,Math.floor(currentPosition()/blockSeconds(project.bpm)));
 let nearest=0,distance=Infinity;
 bodies.forEach((body,i)=>{const r=body.getBoundingClientRect(),d=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;if(d<distance){nearest=i;distance=d;}});
 return nearest;
}
function blockAtClientX(x,y){
 const fraction=(x-$('#ruler').getBoundingClientRect().left)/timelineScale();
 return timelineView==='counts'?rowAtY(y)+clamp(fraction,0,1):clamp(fraction,0,project.blocks);
}
function paintTimelineMarker(el,block){
 const timeline=$('#timeline');let fraction=block,top=0,height=timeline.offsetHeight;
 if(timelineView==='counts'){
  const row=Math.min(project.blocks-1,Math.floor(block)),body=$$('.count-body')[row];
  if(!body)return;fraction=block-row;top=body.getBoundingClientRect().top-timeline.getBoundingClientRect().top+1;height=body.clientHeight;
 }
 el.style.left=((timelineView==='counts'?105:104)+fraction*timelineScale())+'px';el.style.top=top+'px';el.style.bottom='auto';el.style.height=height+'px';
}
function setSeekPosition(x,y){position=blockAtClientX(x,y)*blockSeconds(project.bpm);paintTransport();}
function startSeek(e){
 if(e.button!==0||seekDrag)return;
 e.preventDefault();seekDrag={pointerId:e.pointerId,target:e.currentTarget,resume:playing,clientX:e.clientX,clientY:e.clientY};
 pause();clearDropGuide();e.currentTarget.setPointerCapture(e.pointerId);$('#playhead').classList.add('seeking');
 setSeekPosition(e.clientX,e.clientY);scrollWhileSeeking();
}
function scrollWhileSeeking(){
 if(!seekDrag)return;
 const scroller=$('#timeline-scroll'),rect=scroller.getBoundingClientRect(),x=seekDrag.clientX;
 const delta=x<rect.left+128?-Math.min(18,(rect.left+128-x)/3):x>rect.right-24?Math.min(18,(x-rect.right+24)/3):0;
 let changed=false;
 if(delta){const before=scroller.scrollLeft;scroller.scrollLeft+=delta;changed=scroller.scrollLeft!==before;}
 if(timelineView==='counts'){const y=seekDrag.clientY,dy=y<rect.top+48?-12:y>rect.bottom-24?12:0;const before=scroller.scrollTop;scroller.scrollTop+=dy;changed=changed||before!==scroller.scrollTop;}
 if(changed)setSeekPosition(x,seekDrag.clientY);
 seekFrame=requestAnimationFrame(scrollWhileSeeking);
}
function moveSeek(e){if(seekDrag?.pointerId===e.pointerId){seekDrag.clientX=e.clientX;seekDrag.clientY=e.clientY;setSeekPosition(e.clientX,e.clientY);}}
function finishSeek(e){
 if(seekDrag?.pointerId!==e.pointerId)return;
 const drag=seekDrag;if(e.type==='pointerup')setSeekPosition(e.clientX,e.clientY);
 seekDrag=null;cancelAnimationFrame(seekFrame);$('#playhead').classList.remove('seeking');
 if(drag.target.hasPointerCapture(e.pointerId))drag.target.releasePointerCapture(e.pointerId);
 if(e.type==='pointerup'&&drag.resume&&position<routineSeconds(project))play();
}
function laneAtEvent(e){
 const rect=$('#timeline-scroll').getBoundingClientRect();
 if(e.clientX<rect.left+104||e.clientX>rect.right)return null;
 return $$('.lane-content').find(body=>{const r=body.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<r.bottom;});
}
function dropPlacement(e){
 const pointer=blockAtClientX(e.clientX,e.clientY),cursor=currentPosition()/blockSeconds(project.bpm);
 const moving=e.dataTransfer.types.includes('application/ocho-clip');
 const proposed=clamp(pointer-(moving?dragGrabOffset:0),0,project.blocks);
 const snapped=Math.min(Math.abs(pointer-cursor),Math.abs(proposed-cursor))*timelineScale()<=12;
 const sameRow=timelineView!=='counts'||Math.floor(Math.min(pointer,project.blocks-.000001))===Math.floor(Math.min(cursor,project.blocks-.000001));
 const aligned=snapped&&sameRow;
 const free=timelineView==='counts'&&$('#snap-cells').checked&&!e.altKey?Math.floor((proposed+1e-10)*8)/8:proposed;
 return {block:aligned?cursor:free,snapped:aligned};
}
function clearDropGuide(){
 $('#drop-guide').hidden=true;$('#playhead').classList.remove('snap-target');
 $$('.lane-content.dragover').forEach(body=>body.classList.remove('dragover'));
}
function previewDrop(e){
 const types=e.dataTransfer.types;if(!types.includes('application/ocho-asset')&&!types.includes('application/ocho-clip'))return;
 e.preventDefault();clearDropGuide();const body=laneAtEvent(e);if(!body)return;
 const {block,snapped}=dropPlacement(e);body.classList.add('dragover');
 $('#drop-guide').hidden=false;paintTimelineMarker($('#drop-guide'),block);
 $('#playhead').classList.toggle('snap-target',snapped);
}
function dropOnTimeline(e){
 const clipId=e.dataTransfer.getData('application/ocho-clip'),assetId=e.dataTransfer.getData('application/ocho-asset');
 if(!clipId&&!assetId)return;e.preventDefault();const body=laneAtEvent(e),{block}=dropPlacement(e);clearDropGuide();
 if(!body)return;
 if(block>=project.blocks){toast('Coloca el audio antes del final de la rutina.');return;}
 if(clipId){const c=project.clips.find(c=>c.id===clipId);if(!c)return;changing();c.start=block;c.category=body.dataset.lane;selected=c.id;renderTimeline();renderInspector();}
 else addClip(assetId,block,body.dataset.lane);
}
function changing(){pause();scheduleSave();}
function metadata(){return {project:structuredClone(project),assets:[...assets.values()].map(({buffer,...a})=>a)};}
async function initDatabase(){try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ocho-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readonly'),r=tx.objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{$('#save-status').textContent='Guardado local no disponible';toast('No se puede guardar en este navegador. Usa Guardar proyecto para conservar tu mezcla.');}}
function scheduleSave(){clearTimeout(saveTimer);$('#save-status').textContent='● Guardando…';saveTimer=setTimeout(save,350);}
async function save(){if(!db)return;try{const snapshot=metadata();await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});$('#save-status').textContent='● Guardado en este dispositivo';}catch{$('#save-status').textContent='No se pudo guardar';toast('No se pudo guardar localmente. Descarga una copia del proyecto.');}}
async function hydrate(items){const ctx=await audioContext(),map=new Map();for(const a of items){if(!a||typeof a.id!=='string'||typeof a.name!=='string'||!CATEGORIES.includes(a.category)||!(a.blob instanceof Blob)||a.blob.size>50*1024*1024||map.has(a.id))throw Error('Biblioteca de audio no válida.');const buffer=await ctx.decodeAudioData(await a.blob.arrayBuffer());if(!buffer.duration)throw Error('Audio vacío.');map.set(a.id,{id:a.id,name:a.name.slice(0,100),category:a.category,blob:a.blob,buffer,duration:buffer.duration,demo:!!a.demo});}return map;}
async function loadSnapshot(data){const p=validateProject(data.project);if(!Array.isArray(data.assets)||data.assets.length>100)throw Error('Biblioteca de audio no válida.');const map=await hydrate(data.assets);for(const c of p.clips){const a=map.get(c.assetId);if(!a||c.offset>=a.duration)throw Error('Falta un audio del proyecto o su recorte no es válido.');}stop();project=p;assets=map;chosen=[...assets.values()].find(a=>a.category===category)?.id||null;selected=null;render();}
async function addDemos(){const ctx=await audioContext();for(const [kind,name,cat]of [['pulse','Victory Pulse','music'],['rise','Rise Up','effect'],['impact','Final Impact','effect']]){const buffer=generateDemo(ctx,kind);const a={id:'demo-'+kind,name,category:cat,buffer,duration:buffer.duration,demo:true,blob:new Blob([writeWav(buffer)],{type:'audio/wav'})};assets.set(a.id,a);}chosen='demo-pulse';}
function waveform(canvas,buffer,offset=0,length=buffer.duration,color='#7f9edc'){
 const width=clamp(Math.round(canvas.clientWidth||100),10,1800),height=30;canvas.width=width*2;canvas.height=height*2;const c=canvas.getContext('2d');c.scale(2,2);c.strokeStyle=color;c.lineWidth=1.4;const data=buffer.getChannelData(0),first=Math.floor(offset*buffer.sampleRate),span=Math.floor(length*buffer.sampleRate);
 for(let x=1;x<width;x+=3){let peak=0;const base=first+Math.floor(x/width*span),stride=Math.max(1,Math.floor(span/width/16));for(let j=0;j<16;j++)peak=Math.max(peak,Math.abs(data[base+j*stride]||0));const h=Math.max(1,peak*height*.65);c.beginPath();c.moveTo(x,height/2-h);c.lineTo(x,height/2+h);c.stroke();}
}
function renderAssets(){
 const list=$('#asset-list');list.replaceChildren();$('#asset-count').textContent=assets.size;
 $('#library-caption').textContent=category==='voice'?'TUS GRABACIONES':'TU COLECCIÓN';
 for(const a of [...assets.values()].filter(a=>a.category===category)){
  const el=document.createElement('div');el.className='asset '+a.category+(chosen===a.id?' selected':'');el.draggable=true;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Seleccionar '+a.name);
  el.innerHTML='<span class="asset-icon"></span><div class="asset-info"><strong></strong><small></small><div class="asset-visual"></div></div><button class="preview" aria-label="Escuchar sonido">▶︎</button>';
  el.querySelector('.asset-icon').textContent=icons[a.category];el.querySelector('strong').textContent=a.name;el.querySelector('small').textContent=formatTime(a.duration)+' · '+Number((a.duration*project.bpm/60).toFixed(2))+' tiempos';
  const wave=el.querySelector('.asset-visual');for(let n=0;n<30;n++){const i=document.createElement('i');i.style.height=(3+Math.abs(Math.sin(n*1.3))*10)+'px';wave.append(i);}
  el.onclick=()=>{chosen=a.id;renderAssets();};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chosen=a.id;renderAssets();}};
  el.ondragstart=e=>{pause();dragGrabOffset=0;e.dataTransfer.setData('application/ocho-asset',a.id);e.dataTransfer.effectAllowed='copy';};el.ondragend=clearDropGuide;
  el.querySelector('.preview').onclick=async e=>{e.stopPropagation();try{const ctx=await audioContext(true);if(previewSource){previewSource.stop();previewSource=null;return;}if(playing)pause();previewSource=ctx.createBufferSource();previewSource.buffer=a.buffer;const g=ctx.createGain();g.gain.value=.6;previewSource.connect(g).connect(ctx.destination);const src=previewSource;src.onended=()=>{if(previewSource===src)previewSource=null;};src.start();}catch(err){toast(err.message);}};
  list.append(el);
 }
 if(!list.childElementCount){const el=document.createElement('p');el.className='empty-library';el.textContent=category==='voice'?'Graba tu primera voz o importa un audio.':'Importa tu primer sonido.';list.append(el);}
}
// La categoría de la biblioteca no limita la pista de cada clip.
function addClip(assetId,block,lane){const a=assets.get(assetId);if(!a)return;if(project.clips.length>=512){toast('Límite de 512 clips por proyecto.');return;}if(block>=project.blocks){toast('Coloca el audio antes del final de la rutina.');return;}changing();const start=clamp(block,0,project.blocks),length=Math.min(project.blocks-start,a.duration/blockSeconds(project.bpm));const c={id:id(),assetId,start,length,offset:0,volume:.8,fadeIn:0,fadeOut:0,category:lane};project.clips.push(c);selected=c.id;renderTimeline();renderInspector();toast(a.name+' añadido en '+formatTime(start*blockSeconds(project.bpm),true,3));}
function makeClipElement(clip,asset,start,length,localStart,scale){
 const el=document.createElement('div'),continued=start>clip.start+1e-10;
 el.className='clip '+clip.category+(selected===clip.id?' selected':'')+(continued?' continued':'');
 el.style.left=(localStart*scale)+'px';el.style.width=Math.max(3,length*scale)+'px';el.draggable=true;el.tabIndex=0;el.setAttribute('role','button');
 el.setAttribute('aria-label',asset.name+', '+titles[clip.category]+', inicio '+formatTime(clip.start*blockSeconds(project.bpm),true,3)+(continued?', continuación':''));
 el.dataset.clipId=clip.id;el.dataset.segmentStart=start;el.title=asset.name+' · '+(length*8).toFixed(2)+' tiempos';el.innerHTML='<strong></strong><canvas></canvas>';
 el.querySelector('strong').textContent=(continued?'↳ ':'')+asset.name;
 el.onclick=e=>{e.stopPropagation();selected=clip.id;renderTimeline();renderInspector();};
 el.onkeydown=e=>{if(e.key==='Enter'){selected=clip.id;renderTimeline();renderInspector();}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteClip(clip.id);}};
 el.ondragstart=e=>{pause();dragGrabOffset=start-clip.start+(e.clientX-el.getBoundingClientRect().left)/scale;e.dataTransfer.setData('application/ocho-clip',clip.id);e.dataTransfer.effectAllowed='move';};el.ondragend=clearDropGuide;
 requestAnimationFrame(()=>waveform(el.querySelector('canvas'),asset.buffer,clip.offset+(start-clip.start)*blockSeconds(project.bpm),length*blockSeconds(project.bpm),clip.category==='music'?'#809fd9':clip.category==='effect'?'#d5a36a':'#aa8dc9'));
 return el;
}
function renderCountRows(){
 const width=Math.max(48,($('#timeline-scroll').clientWidth-104)/8)*8*zoom/88,scale=width-2;
 const timeline=$('#timeline');timeline.dataset.blockWidth=scale;timeline.style.width=(104+width)+'px';timeline.style.setProperty('--beat-width',(scale/8)+'px');
 $('#ruler').innerHTML=Array.from({length:8},(_,i)=>`<div class="beat-heading">${i+1}</div>`).join('');$('#lanes').replaceChildren();
 for(let n=0;n<project.blocks;n++){
  const row=document.createElement('section');row.className='count-row';row.dataset.block=n;
  row.innerHTML=`<div class="count-label"><strong>${n+1}</strong><span>${formatTime(n*blockSeconds(project.bpm),true,3)}</span><small>hasta ${formatTime((n+1)*blockSeconds(project.bpm),true,3)}</small><div><i class="music">M</i><i class="effect">E</i><i class="voice">V</i></div></div><div class="count-body"><div class="count-seek" title="Arrastra aquí la línea de reproducción" aria-label="Situar línea en fila ${n+1}"></div></div>`;
  const body=row.querySelector('.count-body'),seek=row.querySelector('.count-seek');
  seek.onpointerdown=startSeek;seek.onpointermove=moveSeek;seek.onpointerup=finishSeek;seek.onpointercancel=finishSeek;
  seek.onlostpointercapture=e=>{if(seekDrag?.pointerId===e.pointerId)finishSeek(e);};
  for(const cat of CATEGORIES){
   const track=document.createElement('div');track.className='lane-content grid-track '+cat;track.dataset.lane=cat;track.dataset.block=n;track.setAttribute('aria-label',titles[cat]+', fila '+(n+1));
   track.onclick=e=>{if(e.target!==track)return;if(!chosen){toast('Selecciona primero un sonido en la biblioteca.');return;}const {block}=dropPlacement({clientX:e.clientX,clientY:e.clientY,altKey:e.altKey,dataTransfer:{types:[]}});addClip(chosen,block,cat);};
   for(const clip of project.clips.filter(c=>c.category===cat)){
    const asset=assets.get(clip.assetId);if(!asset)continue;const end=clip.start+clipWindow(clip,asset,project).length/blockSeconds(project.bpm),start=Math.max(n,clip.start),stop=Math.min(n+1,end);
    if(stop>start+1e-10)track.append(makeClipElement(clip,asset,start,stop-start,start-n,scale));
   }
   body.append(track);
  }
  $('#lanes').append(row);
 }
 $('#clip-count').textContent=project.clips.length+' clips en tu mezcla';paintTransport();
}
function renderTimeline(){
 const counts=timelineView==='counts';$('#timeline-scroll').classList.toggle('counts-view',counts);$('#timeline').classList.toggle('counts-view',counts);$('#grid-options').hidden=!counts;
 if(counts){renderCountRows();return;}
 const timeline=$('#timeline');timeline.style.setProperty('--cell',zoom+'px');timeline.style.width=(104+project.blocks*zoom)+'px';$('#ruler').replaceChildren();
 for(let n=0;n<project.blocks;n++){const el=document.createElement('div');el.className='ruler-cell';el.innerHTML=`${String(n+1).padStart(2,'0')}<small>1 2 3 4 5 6 7 8</small>`;el.title='Arrastra para situar la línea en cualquier instante';$('#ruler').append(el);}
 const lanes=$('#lanes');lanes.replaceChildren();
 for(const cat of CATEGORIES){
  const lane=document.createElement('div');lane.className='lane '+cat;lane.innerHTML=`<div class="lane-label"><strong><i></i>${titles[cat]}</strong><span>${cat==='music'?'LA BASE':cat==='effect'?'EL IMPACTO':'TU ENERGÍA'}</span><button class="insert-at-cursor" aria-label="Añadir en la línea: ${titles[cat]}">＋ En la línea</button></div><div class="lane-content" data-lane="${cat}" aria-label="Pista de ${titles[cat]}"></div>`;
  const body=lane.querySelector('.lane-content');
  lane.querySelector('.insert-at-cursor').onclick=()=>{if(!chosen){toast('Selecciona primero un sonido en la biblioteca.');return;}addClip(chosen,currentPosition()/blockSeconds(project.bpm),cat);};
  body.onclick=e=>{if(e.target!==body)return;if(!chosen){toast('Selecciona primero un sonido en la biblioteca.');return;}const {block}=dropPlacement({clientX:e.clientX,clientY:e.clientY,dataTransfer:{types:[]}});addClip(chosen,block,cat);};
  for(const clip of project.clips.filter(c=>c.category===cat)){
   const asset=assets.get(clip.assetId);if(!asset)continue;const w=clipWindow(clip,asset,project);
   body.append(makeClipElement(clip,asset,clip.start,w.length/blockSeconds(project.bpm),clip.start,zoom));
  }
  lanes.append(lane);
 }
 $('#clip-count').textContent=project.clips.length+' clips en tu mezcla';paintTransport();
}
function deleteClip(clipId){changing();project.clips=project.clips.filter(c=>c.id!==clipId);if(selected===clipId)selected=null;renderTimeline();renderInspector();}
function renderInspector(){const root=$('#clip-inspector'),c=project.clips.find(c=>c.id===selected),a=c&&assets.get(c.assetId);
 if(!c||!a){root.innerHTML='<span class="inspector-icon">↖</span><div><strong>Cada gran momento tiene su sonido.</strong><p>Añade o selecciona un clip para ajustar su mezcla.</p></div><span class="eight-decoration">8</span>';return;}
 root.innerHTML='<div class="inspector-form"><strong class="clip-name"></strong><label>INICIO (seg)<input id="clip-start" type="number" min="0" step="0.001"></label><label>DURACIÓN (tiempos)<input id="clip-length" type="number" min="0.001" step="0.125"></label><label>RECORTE (seg)<input id="clip-offset" type="number" min="0" step="0.1"></label><label>VOLUMEN <span id="volume-label"></span><input id="clip-volume" type="range" min="0" max="100"></label><label>ENTRADA (seg)<input id="clip-fade-in" type="number" min="0" max="10" step="0.1"></label><label>SALIDA (seg)<input id="clip-fade-out" type="number" min="0" max="10" step="0.1"></label><button class="align-clip" id="align-clip">Alinear a la línea</button><button class="delete-clip" id="delete-clip">Eliminar clip</button></div>';
 root.querySelector('.clip-name').textContent=a.name+' · '+formatTime(clipWindow(c,a,project).length);
 const fields=[['#clip-start',Number((c.start*blockSeconds(project.bpm)).toFixed(6)),'start',0,routineSeconds(project)-1/44100],['#clip-length',Number((c.length*8).toFixed(6)),'length',.001,project.blocks*8],['#clip-offset',Number(c.offset.toFixed(2)),'offset',0,Math.max(0,a.duration-.01)],['#clip-volume',Math.round(c.volume*100),'volume',0,100],['#clip-fade-in',c.fadeIn,'fadeIn',0,10],['#clip-fade-out',c.fadeOut,'fadeOut',0,10]];
 for(const [selector,value,key,min,max]of fields){const input=$(selector);input.value=value;input.max=max;input.onchange=()=>{if(input.value===''||!Number.isFinite(Number(input.value))){input.value=value;return;}changing();let v=clamp(Number(input.value),min,max);if(key==='start')v/=blockSeconds(project.bpm);if(key==='length')v/=8;if(key==='volume')v/=100;c[key]=v;renderTimeline();renderInspector();};}
 $('#align-clip').onclick=()=>{const start=currentPosition()/blockSeconds(project.bpm);if(start>=project.blocks){toast('Mueve la línea antes del final de la rutina.');return;}changing();c.start=start;renderTimeline();renderInspector();};
 $('#volume-label').textContent=Math.round(c.volume*100)+'%';$('#delete-clip').onclick=()=>deleteClip(c.id);
}
function render(){ $('#project-name').value=project.name;$('#bpm').value=project.bpm;$('#blocks').value=project.blocks;$('#duration').textContent=formatTime(routineSeconds(project));$('#total-time').textContent=formatTime(routineSeconds(project),true);renderAssets();renderTimeline();renderInspector();}
for(const target of [$('#playhead'),$('#ruler')]){
 target.onpointerdown=startSeek;target.onpointermove=moveSeek;target.onpointerup=finishSeek;target.onpointercancel=finishSeek;
 target.onlostpointercapture=e=>{if(seekDrag?.pointerId===e.pointerId)finishSeek(e);};
}
$('#playhead').onkeydown=e=>{
 const step=e.shiftKey?60/project.bpm:.01;
 const next=e.key==='Home'?0:e.key==='End'?routineSeconds(project):e.key==='ArrowRight'?currentPosition()+step:e.key==='ArrowLeft'?currentPosition()-step:null;
 if(next===null)return;e.preventDefault();pause();position=clamp(next,0,routineSeconds(project));paintTransport();
};
$('#timeline').ondragover=previewDrop;$('#timeline').ondrop=dropOnTimeline;
$('#timeline').ondragleave=e=>{if(!e.currentTarget.contains(e.relatedTarget))clearDropGuide();};
$('#timeline-scroll').onscroll=()=>{if(seekDrag)setSeekPosition(seekDrag.clientX,seekDrag.clientY);};
$('#timeline-view').onchange=()=>{clearDropGuide();timelineView=$('#timeline-view').value;$('#timeline-scroll').scrollTop=0;$('#timeline-scroll').scrollLeft=0;renderTimeline();renderInspector();};
$$('[data-insert-lane]').forEach(button=>button.onclick=()=>{if(!chosen){toast('Selecciona primero un sonido en la biblioteca.');return;}addClip(chosen,currentPosition()/blockSeconds(project.bpm),button.dataset.insertLane);});
window.addEventListener('resize',()=>{if(timelineView==='counts'&&!seekDrag)renderTimeline();});
$('#beat-dots').innerHTML=Array.from({length:8},(_,i)=>`<i>${i+1}</i>`).join('');
$('#play').onclick=play;$('#stop').onclick=stop;$('#rewind').onclick=stop;
$('#metronome').onchange=()=>{if(playing){pause();play();}};
$('#project-name').onchange=()=>{project.name=$('#project-name').value.trim()||'Mi rutina';$('#project-name').value=project.name;scheduleSave();};
$('#bpm').onchange=()=>{const v=Number($('#bpm').value);if(!Number.isFinite(v)||v<60||v>200){$('#bpm').value=project.bpm;toast('El tempo debe estar entre 60 y 200 BPM.');return;}changing();project.bpm=v;position=clamp(position,0,routineSeconds(project));render();};
$('#blocks').onchange=()=>{const v=Number($('#blocks').value);if(!Number.isInteger(v)||v<1||v>64){$('#blocks').value=project.blocks;toast('Usa entre 1 y 64 bloques.');return;}if(v<project.blocks&&project.clips.some(c=>c.start>=v)&&!confirm('Al reducir la rutina se eliminarán clips que comienzan fuera de ella. ¿Continuar?')){$('#blocks').value=project.blocks;return;}changing();project.blocks=v;project.clips=project.clips.filter(c=>c.start<v);position=clamp(position,0,routineSeconds(project));render();};
$('#zoom').oninput=()=>{zoom=Number($('#zoom').value);renderTimeline();};
$$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;chosen=[...assets.values()].find(a=>a.category===category)?.id||null;$$('[data-category]').forEach(t=>{t.classList.toggle('selected',t===b);t.setAttribute('aria-selected',String(t===b));});renderAssets();});
$('#upload').onclick=()=>$('#audio-file').click();
$('#audio-file').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(busy)return;const cat=category;busy=true;$('#upload').disabled=true;try{const ctx=await audioContext();for(const file of files){if(file.size>50*1024*1024){toast(file.name+': el máximo es 50 MB.');continue;}if(assets.size>=100){toast('Límite de 100 audios por proyecto.');break;}try{const buffer=await ctx.decodeAudioData(await file.arrayBuffer());const a={id:id(),name:file.name.replace(/\.[^.]+$/,''),category:cat,blob:file,buffer,duration:buffer.duration,demo:false};assets.set(a.id,a);chosen=a.id;toast('Audio importado: '+file.name);}catch{toast('No se pudo leer '+file.name+'. Prueba con WAV o MP3.');}}renderAssets();scheduleSave();}finally{busy=false;$('#upload').disabled=false;}};
$('#clear').onclick=()=>{if(project.clips.length&&confirm('¿Eliminar todos los clips de esta mezcla? Tus audios permanecerán en la biblioteca.')){changing();project.clips=[];selected=null;position=0;render();}};
$('#new-project').onclick=async()=>{if(recordBusy||busy){toast('Finaliza la operación actual antes de crear otra rutina.');return;}if(!confirm('¿Crear una rutina nueva? Guarda el proyecto actual si quieres conservarlo.'))return;stop();project={version:1,name:'Mi nueva rutina',bpm:144,blocks:16,clips:[]};assets=new Map();selected=null;await addDemos();render();scheduleSave();};
$('#export').onclick=async()=>{if(busy||recordBusy)return;if(!project.clips.length){toast('Añade al menos un clip antes de exportar.');return;}pause();busy=true;$('#export').disabled=true;$('#export span').textContent='Renderizando…';try{const duration=routineSeconds(project);const offline=new OfflineAudioContext(2,Math.ceil(duration*44100),44100);scheduleMix(offline,project,assets,0,0,{click:$('#metronome').checked});const rendered=await offline.startRendering();let peak=0;for(let c=0;c<2;c++){const data=rendered.getChannelData(c);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}if(peak>.98)for(let c=0;c<2;c++){const data=rendered.getChannelData(c);for(let i=0;i<data.length;i++)data[i]*=.98/peak;}download(new Blob([writeWav(rendered)],{type:'audio/wav'}),safeName(project.name)+'.wav');toast('WAV estéreo exportado · 44,1 kHz / 16 bits'+(peak>.98?' · Picos ajustados para evitar saturación.':''));}catch(e){toast('No se pudo exportar: '+e.message);}finally{busy=false;$('#export').disabled=false;$('#export span').textContent='Exportar WAV';}};
async function blobBase64(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
$('#save-project').onclick=async()=>{if(busy||recordBusy){toast('Espera a que termine la operación actual.');return;}busy=true;$('#save-project').disabled=true;try{const result={format:'ocho-studio',project:structuredClone(project),assets:[]};for(const a of assets.values())result.assets.push({id:a.id,name:a.name,category:a.category,demo:a.demo,type:a.blob.type,data:await blobBase64(a.blob)});download(new Blob([JSON.stringify(result)],{type:'application/json'}),safeName(project.name)+'.ocho.json');toast('Proyecto guardado con todos sus audios.');}catch(e){toast('No se pudo guardar: '+e.message);}finally{busy=false;$('#save-project').disabled=false;}};
$('#open-project').onclick=()=>{if(recordBusy||busy){toast('Espera a que termine la operación actual.');return;}$('#project-file').click();};
$('#project-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>200*1024*1024){toast('El proyecto supera el límite de 200 MB.');return;}if(project.clips.length&&!confirm('¿Abrir este proyecto y reemplazar la mezcla actual?'))return;busy=true;try{const data=JSON.parse(await f.text());if(data.format!=='ocho-studio'||!Array.isArray(data.assets)||data.assets.length>100)throw Error('Archivo de proyecto no reconocido.');const items=data.assets.map(a=>{if(typeof a.data!=='string'||a.data.length>70*1024*1024)throw Error('Audio de proyecto no válido.');const raw=atob(a.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return {...a,data:undefined,blob:new Blob([bytes],{type:a.type||'audio/wav'})};});await loadSnapshot({project:data.project,assets:items});scheduleSave();toast('Proyecto abierto. Tu rutina está lista.');}catch(err){toast('No se pudo abrir: '+err.message);}finally{busy=false;}};
function recordingUI(active){$('#record').classList.toggle('recording',active);$('#record').innerHTML=active?'<span class="record-dot"></span> Detener grabación <span>■</span>':'<span class="record-dot"></span> Grabar mi voz <span>↗</span>';$('#record-state').hidden=!active;}
$('#record').onclick=async()=>{
 if(recorder?.state==='recording'){recorder.stop();return;}if(recordBusy||busy)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('La grabación requiere un navegador compatible y un contexto seguro (HTTPS o localhost).');return;}
 if(assets.size>=100){toast('Límite de 100 audios por proyecto.');return;}
 recordBusy=true;try{
  pause();previewSource?.stop();previewSource=null;
  recordStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
  recorder=type?new MediaRecorder(recordStream,{mimeType:type}):new MediaRecorder(recordStream);const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const cleanup=()=>{clearInterval(recordTimer);recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;recordingUI(false);};
  recorder.onerror=()=>{cleanup();recordBusy=false;toast('La grabación falló. Comprueba tu micrófono e inténtalo de nuevo.');};
  recorder.onstop=async()=>{const mime=recorder.mimeType;cleanup();try{const blob=new Blob(chunks,{type:mime});if(!blob.size)throw Error('No se recibió audio.');const ctx=await audioContext(),buffer=await ctx.decodeAudioData(await blob.arrayBuffer());const a={id:id(),name:'Voz '+new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),category:'voice',duration:buffer.duration,buffer,blob,demo:false};assets.set(a.id,a);category='voice';chosen=a.id;$$('[data-category]').forEach(b=>{const active=b.dataset.category==='voice';b.classList.toggle('selected',active);b.setAttribute('aria-selected',String(active));});renderAssets();scheduleSave();toast('Voz guardada. Arrástrala a Música, Efectos o Voces.');}catch(e){toast('No se pudo procesar la grabación: '+e.message);}finally{recordBusy=false;}};
  recorder.start(250);recordStart=Date.now();recordingUI(true);const update=()=>{const seconds=(Date.now()-recordStart)/1000;$('#record-state').textContent='● '+formatTime(seconds,true)+' · Máximo 3 min · usa auriculares';if(seconds>=180&&recorder.state==='recording')recorder.stop();};update();recordTimer=setInterval(update,250);
 }catch(e){recordBusy=false;recordStream?.getTracks().forEach(t=>t.stop());recordingUI(false);toast(e.name==='NotAllowedError'?'Permite el acceso al micrófono para grabar tu voz.':'No se pudo acceder al micrófono: '+e.message);}
};
$('#help').onclick=()=>$('#help-dialog').showModal();$$('.dialog-close').forEach(b=>b.onclick=()=>$('#help-dialog').close());
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)&&!$('#help-dialog').open){e.preventDefault();play();}});
window.addEventListener('beforeunload',()=>{recordStream?.getTracks().forEach(t=>t.stop());});
async function init(){render();const saved=await initDatabase();if(saved){try{await loadSnapshot(saved);return;}catch{toast('No se pudo restaurar el proyecto. Conserva o exporta una copia de seguridad.');return;}}await addDemos();
 // A short original arrangement makes the editor immediately playable.
 project.clips=[{id:id(),assetId:'demo-pulse',category:'music',start:0,length:4,offset:0,volume:.8,fadeIn:.03,fadeOut:.4},{id:id(),assetId:'demo-rise',category:'effect',start:3,length:1,offset:0,volume:.65,fadeIn:.1,fadeOut:.03},{id:id(),assetId:'demo-impact',category:'effect',start:4,length:.375,offset:0,volume:.8,fadeIn:0,fadeOut:.1}];render();scheduleSave();}
init().catch(e=>toast('Error al iniciar el estudio: '+e.message));
