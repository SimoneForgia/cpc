import {$} from './common.js';

const video=$('#video'), frame=$('#frame'), hint=$('#scanHint');
let stream=null, raf=null;

function toSummaryLink(cpc,opt){
  const url=new URL('summary.html', location.href);
  if(cpc) url.searchParams.set('cpc',cpc);
  if(opt) url.searchParams.set('opt', opt);
  return url.toString();
}

// Simplest path: uploaded SVG with data-payload
async function tryDecodeSVG(file){
  const text = await file.text();
  const m = text.match(/data-payload=\"([^\"]+)\"/);
  if(!m) return null;
  try{
    const payloadKey = decodeURIComponent(m[1]);
    // payloadKey is "cpc|{...}" per generator.js
    const [cpc, optJson=""] = payloadKey.split('|');
    const opt = optJson ? btoa(unescape(encodeURIComponent(optJson))) : '';
    return toSummaryLink(cpc, opt);
  }catch{ return null; }
}

$('#filePick').addEventListener('change', async (e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  hint.textContent='Reading file…';
  if(f.type==='image/svg+xml' || f.name.endsWith('.svg')){
    const link = await tryDecodeSVG(f);
    if(link){ $('#urlOut').textContent=link; $('#openLink').href=link; hint.textContent='SVG decoded.'; return; }
  }
  hint.textContent='Image decoding not implemented yet. Paste link manually if needed.';
});

$('#startCam').addEventListener('click', async ()=>{
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject=stream; await video.play(); hint.textContent='Camera on. Center the BeanTag and hold steady.';
    // MVP: no live decode yet — future step (perspective + sampling)
  }catch(e){ hint.textContent='Camera access denied.'; }
});
$('#stopCam').addEventListener('click', ()=>{
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; video.srcObject=null; }
  if(raf) cancelAnimationFrame(raf); raf=null; hint.textContent='Camera stopped.';
});
