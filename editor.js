import {blockSeconds,clipWindow,formatTime,clamp,clipGainPoints,gainAt,scheduleMix,writeWav} from './audio.js?v=1.4.0';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const session=new URL(location.href).searchParams.get('session'),host=window.opener||(parent!==window?parent:null),origin=location.origin==='null'?'*':location.origin;
let state=null,buffer=null,bufferId=null,decodeGeneration=0,audio,selection=null,cursor=0,zoom=1,pointer=null,dragFrame,preview=null,previewFrame,pending=null,requestSequence=0,exporting=false;
function status(text,error=false){$('#editor-status').textContent=text;$('#editor-status').classList.toggle('error',error);}
function send(type,extra={}){if(host&&!host.closed)host.postMessage({type,session,...extra},origin);}
function secondsPerBlock(){return blockSeconds(state.bpm);}
function duration(){return state?(state.end-state.start)*secondsPerBlock():0;}
function relative(block){return (block-state.start)*secondsPerBlock();}
function absolute(seconds){return state.start+seconds/secondsPerBlock();}
function hasSelection(){return selection&&selection.end-selection.start>1e-9;}
function pps(){return $('#editor-wave-content').offsetWidth/Math.max(.000001,duration());}
function contentBounds(){const starts=state.clips.map(c=>c.start),ends=state.clips.map(c=>c.start+clipWindow(c,state.asset,editedProject()).length/secondsPerBlock());return {start:Math.min(...starts),end:Math.max(...ends)};}
function editedProject(){return {bpm:state.bpm,blocks:state.blocks,clips:state.clips};}
function sourceMap(){return new Map([[state.asset.id,{duration:buffer.duration,buffer}]]);}
function stopPreview(){
 if(preview){cursor=clamp(preview.from+(audio.currentTime-preview.at)/secondsPerBlock(),preview.from,preview.to);for(const node of preview.nodes){try{node.stop();}catch{}}preview=null;}
 cancelAnimationFrame(previewFrame);$('#editor-play').textContent='▶︎ Reproducir';paintCursor();
}
async function playPreview(rangeOnly=false){
 if(preview){stopPreview();if(!rangeOnly)return;}
 if(!state||!buffer||!state.clips.length||pending||exporting)return;
 try{
  if(!audio)audio=new AudioContext();if(audio.state==='suspended')await audio.resume();send('OCHO_EDITOR_ACTION',{action:'preview-start'});
  const bounds=contentBounds(),from=rangeOnly&&hasSelection()?selection.start:(cursor>=bounds.end||cursor<bounds.start?bounds.start:cursor),to=rangeOnly&&hasSelection()?selection.end:bounds.end,at=audio.currentTime+.04;
  const nodes=scheduleMix(audio,editedProject(),sourceMap(),at,from*secondsPerBlock());
  for(const node of nodes){try{node.stop(at+(to-from)*secondsPerBlock());}catch{}}
  preview={from,to,at,nodes};cursor=from;$('#editor-play').textContent='Ⅱ Pausar';tickPreview();
 }catch(e){status('No se pudo reproducir: '+e.message,true);}
}
function tickPreview(){
 if(!preview)return;cursor=clamp(preview.from+(audio.currentTime-preview.at)/secondsPerBlock(),preview.from,preview.to);paintCursor();
 if(cursor>=preview.to){stopPreview();return;}previewFrame=requestAnimationFrame(tickPreview);
}
function paintCursor(){
 if(!state)return;const value=clamp(relative(cursor),0,duration()),el=$('#editor-cursor');el.style.left=(value*pps())+'px';
 el.setAttribute('aria-valuemax',duration());el.setAttribute('aria-valuenow',value);el.setAttribute('aria-valuetext',formatTime(value,true,3));$('#editor-clock').textContent=formatTime(value,true,3);
}
function paintSelection(){
 if(!state)return;
 const band=$('#editor-band');band.hidden=!hasSelection();
 if(hasSelection()){band.style.left=(relative(selection.start)*pps())+'px';band.style.width=((selection.end-selection.start)*secondsPerBlock()*pps())+'px';}
 $('#editor-selection-info').textContent=hasSelection()?formatTime(relative(selection.start),true,3)+' → '+formatTime(relative(selection.end),true,3)+' · '+((selection.end-selection.start)*8).toFixed(2)+' tiempos':'Sin selección';
 $('#editor-from').value=hasSelection()?Number(relative(selection.start).toFixed(6)):Number(relative(cursor).toFixed(6));$('#editor-to').value=hasSelection()?Number(relative(selection.end).toFixed(6)):Number(relative(cursor).toFixed(6));
 $('#editor-global-time').textContent=hasSelection()?'En MultiSesion: '+formatTime(selection.start*secondsPerBlock(),true,3)+' → '+formatTime(selection.end*secondsPerBlock(),true,3):'En MultiSesion: '+formatTime(cursor*secondsPerBlock(),true,3);
 updateButtons();
}
function updateButtons(){
 const ready=!!state&&!!buffer&&!pending&&!exporting,hasAudio=ready&&state.clips.length>0;
 $('#editor-play').disabled=!hasAudio;$('#editor-play-range').disabled=!hasAudio||!hasSelection();$('#editor-export').disabled=!hasAudio;
 $('#editor-split').disabled=!hasAudio||!state.clips.some(c=>{const end=c.start+clipWindow(c,state.asset,editedProject()).length/secondsPerBlock();return cursor>c.start+1e-10&&cursor<end-1e-10;});
 $('#editor-undo').disabled=!ready||!state.canUndo;$$('[data-edit]').forEach(button=>button.disabled=!hasAudio||!hasSelection());
 for(const input of [$('#editor-from'),$('#editor-to')]){input.disabled=!ready;input.max=duration();}
}
function drawWave(){
 if(!state)return;const scroller=$('#editor-wave-scroll'),content=$('#editor-wave-content'),canvas=$('#editor-wave'),width=Math.max(1,scroller.clientWidth),height=300,ratio=Math.min(2,devicePixelRatio||1);
 content.style.width=(width*zoom)+'px';canvas.style.width=width+'px';canvas.width=Math.ceil(width*ratio);canvas.height=height*ratio;
 const c=canvas.getContext('2d');c.scale(ratio,ratio);c.fillStyle='#fbfdff';c.fillRect(0,0,width,height);const scale=pps(),scroll=scroller.scrollLeft,total=duration();
 const rawStep=80/scale,power=10**Math.floor(Math.log10(Math.max(.000001,rawStep))),step=[1,2,5,10].map(n=>n*power).find(n=>n>=rawStep)||10*power;
 c.font='10px -apple-system, sans-serif';c.fillStyle='#91a2ba';c.strokeStyle='#e4ebf6';
 for(let t=Math.floor(scroll/scale/step)*step;t<=Math.min(total,(scroll+width)/scale)+step;t+=step){const x=t*scale-scroll;c.beginPath();c.moveTo(x,29);c.lineTo(x,height);c.stroke();c.fillText(formatTime(t,true,step<1?3:1),x+5,20);}
 if(buffer){
  const data=buffer.getChannelData(0),colors={music:['#e5edff','#7698dc'],effect:['#fff0dd','#d4a069'],voice:['#ece4fa','#a88aca']};
  for(const clip of state.clips){
   const length=clipWindow(clip,state.asset,editedProject()).length,begin=relative(clip.start)*scale-scroll,end=begin+length*scale;
   const x0=Math.max(0,begin),x1=Math.min(width,end);if(x1<=x0)continue;const color=colors[clip.category];
   c.fillStyle=color[0];c.fillRect(x0,42,x1-x0,239);c.strokeStyle='#cbd9ee';c.strokeRect(begin+.5,42.5,Math.max(1,length*scale)-1,238);
   const points=clipGainPoints(clip,length/secondsPerBlock(),secondsPerBlock());c.strokeStyle=color[1];c.lineWidth=1.2;
   for(let x=Math.ceil(x0);x<x1;x+=2){const elapsed=(x-begin)/scale,first=Math.floor((clip.offset+elapsed)*buffer.sampleRate),span=Math.max(1,Math.ceil(buffer.sampleRate/scale));let low=0,high=0;
    for(let n=0;n<Math.min(32,span);n++){const value=data[first+Math.floor(n*span/Math.min(32,span))]||0;low=Math.min(low,value);high=Math.max(high,value);}
    const gain=gainAt(points,elapsed/secondsPerBlock())*clip.volume,amplitude=92*gain;c.beginPath();c.moveTo(x,164+low*amplitude);c.lineTo(x,164+high*amplitude);c.stroke();
   }
   c.fillStyle=color[1];c.font='10px -apple-system, sans-serif';c.fillText(clip.volume===0?'Silenciado':Math.round(clip.volume*100)+' %',Math.max(5,begin+8),61);
  }
 }
 paintCursor();paintSelection();
}
function pointAt(x){const r=$('#editor-wave-content').getBoundingClientRect();return clamp(absolute((x-r.left)/pps()),state.start,state.end);}
function startPointer(e){
 if(!state||!buffer||pending||exporting||pointer||(e.button!==0&&e.button!==2))return;
 e.preventDefault();stopPreview();const at=pointAt(e.clientX),isCursor=e.target.closest('#editor-cursor');
 pointer={id:e.pointerId,target:e.currentTarget,x:e.clientX,origin:e.clientX,anchor:isCursor?cursor:at,range:!isCursor||e.button===2||e.ctrlKey,moved:false,previous:selection?{...selection}:null};
 e.currentTarget.setPointerCapture(e.pointerId);cursor=isCursor?cursor:at;paintCursor();if(!isCursor&&!e.shiftKey){selection=null;paintSelection();}scrollDrag();
}
function movePointer(e){
 if(pointer?.id!==e.pointerId)return;pointer.x=e.clientX;if(Math.abs(e.clientX-pointer.origin)>2)pointer.moved=true;
 cursor=pointAt(e.clientX);if(pointer.range&&pointer.moved)selection={start:Math.min(pointer.anchor,cursor),end:Math.max(pointer.anchor,cursor)};paintCursor();paintSelection();
}
function finishPointer(e){
 if(pointer?.id!==e.pointerId)return;const p=pointer;
 if(e.type==='pointercancel'){selection=p.previous;cursor=p.anchor;}else if(p.moved)movePointer(e);
 pointer=null;cancelAnimationFrame(dragFrame);if(p.target.hasPointerCapture(e.pointerId))p.target.releasePointerCapture(e.pointerId);paintCursor();paintSelection();
}
function scrollDrag(){if(!pointer)return;const el=$('#editor-wave-scroll'),r=el.getBoundingClientRect(),delta=pointer.x<r.left+20?-12:pointer.x>r.right-20?12:0;if(delta){const before=el.scrollLeft;el.scrollLeft+=delta;if(before!==el.scrollLeft){pointer.moved=true;cursor=pointAt(pointer.x);if(pointer.range)selection={start:Math.min(pointer.anchor,cursor),end:Math.max(pointer.anchor,cursor)};paintCursor();paintSelection();}}dragFrame=requestAnimationFrame(scrollDrag);}
function selectAll(){if(!state)return;stopPreview();selection={start:state.start,end:state.end};paintSelection();}
function request(action){
 if(!state||pending||exporting)return;stopPreview();const value=Number($('#editor-volume').value)/100;
 if(action==='volume'&&($('#editor-volume').value===''||!Number.isFinite(value)||value<0||value>1))return status('El volumen debe estar entre 0 y 100 %.',true);
 const range=action==='split'?{start:cursor,end:cursor}:hasSelection()?selection:{start:state.start,end:state.end};
 pending=++requestSequence;updateButtons();send('OCHO_EDITOR_ACTION',{action,from:range.start,to:range.end,value,requestId:pending,revision:state.revision});
}
async function receive(e){
 if(e.source!==host||e.origin!==location.origin||e.data?.session!==session)return;const message=e.data;
 if(message.type==='OCHO_EDITOR_CLOSE'){stopPreview();if(window.opener)window.close();return;}
 if(message.type==='OCHO_EDITOR_STOP'){stopPreview();return;}
 if(message.type!=='OCHO_EDITOR_STATE')return;
 const previous=state;stopPreview();state=message;if(message.replyTo===pending)pending=null;
 if(!previous){cursor=state.start;selection=null;}else{cursor=clamp(cursor,state.start,state.end);if(selection){selection.start=clamp(selection.start,state.start,state.end);selection.end=clamp(selection.end,state.start,state.end);if(!hasSelection())selection=null;}}
 $('#editor-title').textContent=state.asset.name;document.title=state.asset.name+' — Editor OCHO';$('#editor-summary').textContent=state.name+' · '+state.bpm+' BPM · '+state.clips.length+' fragmento'+(state.clips.length===1?'':'s');$('#editor-piece-count').textContent=state.clips.length+' fragmentos';$('#editor-length').textContent='/ '+formatTime(duration(),true,3);
 if(!buffer||bufferId!==state.asset.id){
  const generation=++decodeGeneration;buffer=null;bufferId=state.asset.id;updateButtons();status('Preparando la onda de audio…');
  try{if(!audio)audio=new AudioContext();const decoded=await audio.decodeAudioData(await state.asset.blob.arrayBuffer());if(generation!==decodeGeneration)return;buffer=decoded;}catch(error){status('No se pudo abrir el audio: '+error.message,true);return;}
 }
 drawWave();if(message.notice||!previous||previous.revision!==state.revision)status(message.notice||'Conectado con MultiSesion. Tus cambios se guardan en la mezcla.');
}
window.addEventListener('message',e=>receive(e).catch(error=>status(error.message,true)));
const content=$('#editor-wave-content');content.onpointerdown=startPointer;content.onpointermove=movePointer;content.onpointerup=finishPointer;content.onpointercancel=finishPointer;content.onlostpointercapture=e=>{if(pointer?.id===e.pointerId)finishPointer(e);};content.oncontextmenu=e=>e.preventDefault();content.ondblclick=e=>{e.preventDefault();selectAll();};
$('#editor-wave-scroll').onscroll=drawWave;window.addEventListener('resize',drawWave);
$('#editor-play').onclick=()=>playPreview(false);$('#editor-play-range').onclick=()=>playPreview(true);$('#editor-undo').onclick=()=>request('undo');$('#editor-split').onclick=()=>request('split');$$('[data-edit]').forEach(button=>button.onclick=()=>request(button.dataset.edit));
$('#editor-select-all').onclick=selectAll;$('#editor-clear-range').onclick=()=>{selection=null;paintSelection();};
for(const selector of ['#editor-from','#editor-to'])$(selector).onchange=()=>{
 if(!state||pending)return;let a=Number($('#editor-from').value),b=Number($('#editor-to').value);if(!Number.isFinite(a)||!Number.isFinite(b))return;
 stopPreview();a=clamp(a,0,duration());b=clamp(b,0,duration());if(selector==='#editor-from')b=Math.max(a,b);else a=Math.min(a,b);
 selection={start:absolute(a),end:absolute(b)};if(!hasSelection())cursor=selection.start;paintCursor();paintSelection();
};
function changeZoom(value){zoom=clamp(value,1,8);$('#editor-zoom').value=String(zoom);drawWave();}
$('#editor-zoom').onchange=()=>changeZoom(Number($('#editor-zoom').value));$('#editor-zoom-in').onclick=()=>changeZoom(zoom*2);$('#editor-zoom-out').onclick=()=>changeZoom(zoom/2);$('#editor-fit').onclick=()=>{changeZoom(1);$('#editor-wave-scroll').scrollLeft=0;drawWave();};
function multiSesion(e){e?.preventDefault();stopPreview();try{host?.focus();}catch{}send('OCHO_EDITOR_ACTION',{action:'multisession'});}
$('#editor-multisession').onclick=multiSesion;$('#editor-home').onclick=multiSesion;
$('#editor-export').onclick=async()=>{
 if(!state||!buffer||pending||exporting)return;stopPreview();exporting=true;updateButtons();
 try{const bounds=contentBounds(),ctx=new OfflineAudioContext(2,Math.max(1,Math.ceil((bounds.end-bounds.start)*secondsPerBlock()*44100)),44100);scheduleMix(ctx,editedProject(),sourceMap(),0,bounds.start*secondsPerBlock());const result=await ctx.startRendering();let peak=0;for(let ch=0;ch<result.numberOfChannels;ch++)for(const n of result.getChannelData(ch))peak=Math.max(peak,Math.abs(n));if(peak>.98)for(let ch=0;ch<result.numberOfChannels;ch++){const data=result.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]*=.98/peak;}const blob=new Blob([writeWav(result)],{type:'audio/wav'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=state.asset.name.replace(/[\\/:*?"<>|]/g,'-')+'-editado.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Audio editado exportado como WAV. La mezcla sigue guardada en MultiSesion.');}catch(error){status(error.message,true);}finally{exporting=false;updateButtons();}
};
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();request('undo');return;}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selectAll();return;}
 if(e.key==='Escape'){e.preventDefault();selection=null;paintSelection();return;}
 if((e.key==='Backspace'||e.key==='Delete')&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(!e.repeat)request('delete');return;}
 if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();playPreview(false);return;}
 if(state&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();stopPreview();const before=cursor,step=(e.shiftKey ? .01 : .001)/secondsPerBlock();cursor=e.key==='Home'?state.start:e.key==='End'?state.end:clamp(cursor+(e.key==='ArrowRight'?step:-step),state.start,state.end);paintCursor();if(e.shiftKey){const anchor=hasSelection()?selection.start:before;selection={start:Math.min(anchor,cursor),end:Math.max(anchor,cursor)};}paintSelection();}
});
window.addEventListener('beforeunload',stopPreview);
if(host&&session)send('OCHO_EDITOR_READY');else{status('Abre este editor haciendo doble clic en un clip de MultiSesion.',true);$('#editor-multisession').onclick=()=>location.assign('./');$('#editor-home').onclick=null;}
