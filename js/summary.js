import {CATALOG,SUB_LABELS,DESCRIPTIONS,$} from './common.js';

const summaryEl = $('#summary');

function parseCPC(cpc){
  if(!cpc) return [];
  return cpc.split('.').filter(Boolean).map(tok=>{
    // Formati supportati:
    // 1) L*
    // 2) FI24h*
    // 3) P25%*
    // 4) WK (senza tempo)
    const m = tok.match(/^([A-Z])([A-Z]?)(?:(\d{1,3})([hd])|(\d{1,3})%)?(\*)?$/);
    if(!m) return {raw:tok, main:'?', sub:'', hours:'', unit:'', pct:'', star:false};
    return {
      raw: tok,
      main: m[1],
      sub: m[2] || '',
      hours: m[3] || '',
      unit: m[4] || '',
      pct:  m[5] || '',
      star: !!m[6]
    };
  });
}

function makeDetails(titleKey, titleText, descKey){
  const det=document.createElement('details');
  const sum=document.createElement('summary');
  sum.className='sum-title';
  const caret=document.createElement('i'); caret.className='caret-small';
  const lbl=document.createElement('span'); lbl.textContent=titleText;
  sum.appendChild(caret); sum.appendChild(lbl);
  det.appendChild(sum);
  const p=document.createElement('div'); p.className='sum-desc'; p.textContent = DESCRIPTIONS[descKey] || '—';
  det.appendChild(p);
  return det;
}

function decodeOpt(){
  const p = new URLSearchParams(location.search);
  const opt = p.get('opt');
  if (!opt) return null;
  try{
    return JSON.parse(decodeURIComponent(escape(atob(opt))));
  }catch(e){ return null; }
}

function extrasKeywordsForIndex(optObj, idx){
  if (!optObj || !optObj.steps) return '';
  const rec = optObj.steps.find(x => x.i === idx);
  if (!rec) return '';

  // --- Helpers ---
  const formatTempBoth = (val, unit) => {
    if (val === undefined || val === null || val === '') return '';
    const v = parseFloat(String(val).replace(',', '.'));
    if (Number.isNaN(v)) return '';
    if (unit === 'F') {
      const c = Math.round((v - 32) * 5 / 9);
      return `${v}°F / ${c}°C`;
    } else {
      const f = Math.round(v * 9 / 5 + 32);
      return `${v}°C / ${f}°F`;
    }
  };
  const normalizeTempUnits = s => s.replace(/°\s*([cf])/gi, (_, u) => `°${u.toUpperCase()}`);
  const sentenceCaseList = (arr) => {
    if (!arr.length) return '';
    const out = arr.map((raw, i) => {
      let s = String(raw).trim();
      const isTemp = s.includes('°');
      if (isTemp) {
        // conserva la temperatura così com'è, assicurando C/F maiuscole
        s = normalizeTempUnits(s);
        return s; // le altre voci "tutte in minuscolo" non si applicano ai simboli °C/°F
      }
      // voci non-temperatura: prima con iniziale maiuscola, le successive tutte minuscole
      s = s.toLowerCase();
      if (i === 0 && s) s = s.charAt(0).toUpperCase() + s.slice(1);
      return s;
    });
    return out.join(', ');
  };

  const parts = [];

  // Fermentation — temperature (always both units)
  if (rec.T) {
    const unit = (rec.TU === 'F') ? 'F' : 'C';
    const t = formatTempBoth(rec.T, unit);
    if (t) parts.push(t);
  }

  // Fermentation — container
  if (rec.Ct) {
    const map = {
      plastic:'plastic barrel',
      wood:'wood barrel',
      metal:'metal tank',
      concrete:'concrete',
      clay:'clay pot'
    };
    parts.push(map[rec.Ct] || rec.Ct);
  }

  // Fermentation — thermal shock
  if (rec.Th === 'yes') parts.push('thermal shock');

  // Fermentation — additions
  if (rec.Add && rec.Add !== 'nothing') {
    const descriptive = ['fruits','herbs','spices','flowers','essential','other'];
    if (descriptive.includes(rec.Add) && rec.AddK) {
      parts.push(rec.AddK);
    } else {
      const map = { essential:'essential oils' };
      const label = map[rec.Add] || rec.Add;
      parts.push(label);
      if (rec.AddK) parts.push(rec.AddK);
    }
  }

  // Drying — contact
  if (rec.CD === 'yes' && rec.CDK) parts.push(rec.CDK);

  return sentenceCaseList(parts.filter(Boolean));
}

function decodeOptRaw(){
  const p = new URLSearchParams(location.search);
  const opt = p.get('opt');
  if (!opt) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(opt)))); }
  catch { return null; }
}

function titleCaseWords(str){
  if (!str) return '';
  return String(str)
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// varieties: tutto minuscolo tranne l’iniziale della prima parola
function sentenceCap(str){
  if (!str) return '';
  const s = String(str).trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// se contiene uno di questi separatori ⇒ label "Varieties", altrimenti "Variety"
function varietiesLabel(str){
  if (!str) return 'Variety';
  return /[,\./|\\;]/.test(str) ? 'Varieties' : 'Variety';
}

// Normalizza le varietà:
// - separatori vari -> sempre virgola+spazio
// - rimuove spazi doppi
// - parole con numeri (anche con trattino senza spazi) -> tutte MAIUSCOLE
// - altre parole -> minuscole
// - infine iniziale maiuscola della prima parola dell'intera stringa
function normalizeVarieties(str){
  if (!str) return '';
  const parts = String(str)
    .split(/[,\.\|\/\\;]+/g)            // qualunque separatore indicato
    .map(s => s.replace(/\s+/g, ' ').trim()) // compatta spazi e trim
    .filter(Boolean)
    .map(part => {
      // trasforma parole dentro al singolo "part"
      const words = part.split(/\s+/).map(w => {
        // se la parola contiene almeno una cifra -> uppercase completo
        if (/\d/.test(w)) return w.toUpperCase();
        // altrimenti tutta minuscola
        return w.toLowerCase();
      });
      return words.join(' ');
    });

  const joined = parts.join(', ');
  if (!joined) return '';
  // iniziale maiuscola della stringa complessiva (lascia intatti i token uppercased)
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}


// LOGICA PRIMARY PROCESS !!!

function extrasMapByIndex(){
  const raw = decodeOptRaw();
  const map = {};
  if (raw && Array.isArray(raw.steps)) {
    raw.steps.forEach(e => { map[e.i] = e; });
  }
  return map;
}

// trova il primo indice di un main dopo start (escluso)
function firstIndexAfter(steps, start, main){
  for (let i = start + 1; i < steps.length; i++){
    if (steps[i].main === main) return i;
  }
  return -1;
}

// trova l'ultimo indice di un main prima di start (escluso)
function lastIndexBefore(steps, start, main){
  for (let i = start - 1; i >= 0; i--){
    if (steps[i].main === main) return i;
  }
  return -1;
}

function countBetween(steps, a, b, pred){
  let c = 0;
  for (let i = a + 1; i < b; i++) if (pred(steps[i])) c++;
  return c;
}
function anyBetween(steps, a, b, pred){
  for (let i = a + 1; i < b; i++) if (pred(steps[i])) return true;
  return false;
}
function lastFermentationIndex(steps){
  for (let i = steps.length - 1; i >= 0; i--){
    if (steps[i].main === 'F') return i;
  }
  return -1;
}
function hasFermentationBefore(steps, idxW){
  for (let i = 0; i < idxW; i++){
    if (steps[i].main === 'F') return true;
  }
  return false;
}
function honeyNameForPct(p){
  const n = parseInt(p,10);
  if (n === 10) return 'White honey';
  if (n === 25) return 'Yellow honey';
  if (n === 50) return 'Red honey';
  if (n === 75) return 'Black honey';
  return null;
}
function isFermentationFAorFI(st){ return st.main==='F' && (st.sub==='A' || st.sub==='I'); }
function isFermentation(st){ return st.main === 'F'; }

// conta le coppie "left ... right" prendendo il PRIMO right dopo ogni left
function totalPairs(steps, leftMain, rightMain){
  let count = 0;
  for (let i = 0; i < steps.length; i++){
    if (steps[i].main !== leftMain) continue;
    const j = firstIndexAfter(steps, i, rightMain);
    if (j >= 0) count++;
  }
  return count;
}

// Durata per fermentazioni (FN/FC):
// - se unit='d' e <41 → converti in ore (solo se >24h mostrate)
// - se unit='h' e <=24 → non mostra nulla
// - se unit='h' e >984 → converti in giorni (arrotondati)
function formatFermentDuration(step){
  if (!step || step.main !== 'F') return '';
  const n = step.hours ? parseInt(step.hours,10) : NaN;
  if (!Number.isFinite(n)) return '';

  if (step.unit === 'd'){
    // meno di 41 giorni => converti in ore, ma mostra solo se >24
    if (n < 41){
      const h = n * 24;
      return (h > 24) ? `${h}h` : '';
    }
    return `${n}d`;
  } else { // unità in ore
    if (n <= 24) return '';           // non mostrare se ≤24h
    if (n > 984) return `${Math.round(n/24)}d`;
    return `${n}h`;
  }
}

function classifyBase(steps){
  // 🚧 Regola dura: se ci sono più di uno step di depulping → Experimental
  const pCount = steps.reduce((n,s)=> n + (s.main==='P' ? 1 : 0), 0);
  if (pCount > 1) return { base:'Experimental', baseIdxRef: -1 };

  // 1) Carbonic maceration se l'ultima F è FC
  //    Ma se esiste un P PRIMA di questa FC → Experimental
  const idxF = lastFermentationIndex(steps);
  if (idxF >= 0 && steps[idxF].main === 'F' && steps[idxF].sub === 'C'){
    const hasPBefore = steps.some((s, i) => s.main === 'P' && i < idxF);
    if (hasPBefore) return { base:'Experimental', baseIdxRef: -1 };
    const dur = formatFermentDuration(steps[idxF]);
    return { base: dur ? `${dur} carbonic maceration` : 'Carbonic maceration', baseIdxRef: idxF };
  }

  // 2) Double fermentation washed
  // Requisiti:
  // - deve esistere un depulping (P) PRIMA della W
  // - deve esistere ALMENO una fermentazione qualunque PRIMA della W
  // - tra W e il PRIMO D successivo deve esserci ESATTAMENTE una fermentazione
  //   e questa deve essere FA, FI oppure FN (anaerobic)
  // - "anaerobic" ed eventuale durata saranno **gestiti dal modificatore**, non nella base
  for (let iw = 0; iw < steps.length; iw++){
    if (steps[iw].main !== 'W') continue;

    // P obbligatorio prima della W
    const ip = lastIndexBefore(steps, iw, 'P');
    if (ip < 0) continue;

    // almeno una F prima della W (ovunque prima)
    if (!hasFermentationBefore(steps, iw)) continue;

    const id = firstIndexAfter(steps, iw, 'D');
    if (id < 0) continue;

    // esattamente UNA F tra W e D
    let kBetween = -1, fCountWD = 0;
    for (let k = iw + 1; k < id; k++){
      if (steps[k].main === 'F'){ fCountWD++; kBetween = k; }
    }
    if (fCountWD !== 1) continue;

    // quella F dev'essere FA, FI o FN
    const fStep = steps[kBetween];
    const okSub = (fStep.sub === 'A' || fStep.sub === 'I' || fStep.sub === 'N');
    if (!okSub) continue;

    // base pulita: niente "anaerobic" né durata qui (ci pensa il modificatore)
    return { base:'Double fermentation washed', baseIdxRef: iw };
  }


  // 3) Washed — una sola coppia W…D nell’intero CPC, nessuna F tra quei due,
  //    e deve esistere un depulping (P) PRIMA della W
  if (totalPairs(steps, 'W', 'D') === 1){
  for (let iw = 0; iw < steps.length; iw++){
    if (steps[iw].main !== 'W') continue;
    const id = firstIndexAfter(steps, iw, 'D');
    if (id < 0) continue;

    const hasPBefore = lastIndexBefore(steps, iw, 'P') >= 0; // requisito P prima della W
    if (hasPBefore && !anyBetween(steps, iw, id, s => s.main === 'F')){
      return { base:'Washed', baseIdxRef: iw };
    }
  }
  }


  // 4) Honey — una sola coppia P…D; tra P e D: no W e al massimo 2 F
  if (totalPairs(steps, 'P', 'D') === 1){
    for (let ip = 0; ip < steps.length; ip++){
      const st = steps[ip];
      if (st.main !== 'P' || !st.pct) continue;
      const id = firstIndexAfter(steps, ip, 'D');
      if (id < 0) continue;
      if (anyBetween(steps, ip, id, s => s.main === 'W')) continue;
      const fCountBetween = countBetween(steps, ip, id, s => s.main === 'F');
      if (fCountBetween <= 2){
        const name = honeyNameForPct(st.pct);
        if (name) return { base:name, baseIdxRef: ip };
      }
    }
  }

  // 5) Natural — nessun P, ≤2 F totali, nessun W, e ultima F non FC
  const hasP = steps.some(s => s.main==='P');
  const hasW = steps.some(s => s.main==='W');
  const fIdxs = steps.map((s,i)=>s.main==='F'?i:-1).filter(i=>i>=0);
  const fCountTot = fIdxs.length;
  const lastF = fIdxs.length ? steps[fIdxs[fIdxs.length-1]] : null;
  if (!hasP && !hasW && fCountTot <= 2 && !(lastF && lastF.sub === 'C')){
    return { base:'Natural', baseIdxRef: fIdxs.length ? fIdxs[fIdxs.length-1] : -1 };
  }

  // 6) Experimental (catch-all)
  return { base:'Experimental', baseIdxRef: -1 };
}

function buildModifiers(base, steps){
  const exBy = extrasMapByIndex();

  // ---- anaerobic (solo ULTIMA F) ----
  let anaerobicChunk = '';
  const idxF = lastFermentationIndex(steps);
  if (idxF >= 0){
    const f = steps[idxF];
    if (f.sub === 'N'){
      const dur = formatFermentDuration(f);
      anaerobicChunk = dur ? `${dur} anaerobic` : 'anaerobic';
    }
  }

  // ---- aggrega modificatori globali (tutte le F e tutti i D) ----
  let hasLactic = false;
  const withSet  = new Set(); // sugar/mosto/yeast/bacteria/koji
  const coferSet = new Set(); // AddK per categorie descrittive (lowercase dedup)
  const infusedSet = new Set(); // drying contact

  steps.forEach((st, i) => {
    if (st.main === 'F'){
      const ex = exBy[i] || {};
      const add  = (ex.Add || '').toLowerCase();
      const addK = (ex.AddK || '').toString().trim().toLowerCase();

      if (add === 'salt') hasLactic = true;

      if (['sugar','mosto','yeast','bacteria','koji'].includes(add)){
        withSet.add(add);
      }

      if (['fruits','herbs','spices','flowers','essential','other'].includes(add) && addK){
      const clean = addK.replace(/[,\.;:]+$/,'').trim(); // rimuove virgole/punti finali
      if (clean) coferSet.add(clean);
      }
    }

    if (st.main === 'D'){
      const ex = exBy[i] || {};
      const k = (ex.CDK || '').toString().trim().toLowerCase().replace(/[,\.;:]+$/,'');
      if (ex.CD === 'yes' && k) infusedSet.add(k);
    }
  });

  // --- Composizione in ordine richiesto (senza regex post-join) ---
  const blocks = [];
  if (anaerobicChunk) blocks.push(anaerobicChunk);
  if (hasLactic)     blocks.push('lactic fermentation');

  // Costruisci i tre blocchi “with / co-fermented / infused” senza virgole finali
  let withStr = '';
  if (withSet.size){
    const arr = Array.from(withSet).sort();
    withStr = `with ${arr.join(', ')}`.replace(/,\s*$/,'');
  }
  let coferStr = '';
  if (coferSet.size){
    const arr = Array.from(coferSet).sort();
    coferStr = `co-fermented with ${arr.join(', ')}`.replace(/,\s*$/,'');
  }
  let infusedStr = '';
  if (infusedSet.size){
    const arr = Array.from(infusedSet).sort();
    infusedStr = `infused with ${arr.join(', ')}`.replace(/,\s*$/,'');
  }

  // Unisci i tre blocchi “di coda”:
  // - se ne esiste solo 1 → attaccalo con spazio
  // - se ne esistono ≥2 → uniscili tra loro con ", " e poi aggiungi al resto
  const tailMods = [withStr, coferStr, infusedStr].filter(Boolean);
  if (tailMods.length === 1){
    blocks.push(tailMods[0]);
  } else if (tailMods.length >= 2){
    blocks.push(tailMods.join(', '));
  }

  // Ritorna tutto con singoli spazi
  return blocks.join(' ').trim();
  }

function classifyProcessString(cpc){
  try{
    const steps = parseCPC(cpc);
    const { base } = classifyBase(steps) || { base:'Experimental' };
    const mods = buildModifiers(base, steps);
    return mods ? `${base} ${mods}` : base;
  }catch(e){
    // fallback robusto: mai bloccare l’interfaccia
    return 'Experimental';
  }
}

// FINE LOGICA PRIMARY PROCESS !!!


function renderProducerCard(cpc){
  const metaObj = decodeOptRaw();
  const meta = metaObj && metaObj.meta ? metaObj.meta : null;
  const host = document.getElementById('producerInfo');
  if (!host) return;

  // helpers già presenti nel file:
  // - titleCaseWords(str)
  // - sentenceCap(str)
  // - varietiesLabel(str)

  // Normalizza le varieties per:
  // • separatori misti → sempre virgole
  // • rimuovere spazi doppi
  // • parole con numeri → tutte le lettere maiuscole (es. SL34, SL-28)
  // • resto minuscolo, poi iniziale della PRIMA parola maiuscola
  function formatVarietiesDisplay(raw){
    if (!raw) return '';
    const parts = String(raw)
      .split(/[,\./|\\;]+/g)         // qualunque separatore → token
      .map(s => s.trim().replace(/\s{2,}/g, ' ')) // pulizia spazi
      .filter(Boolean)
      .map(tok => {
        if (/\d/.test(tok)) {
          // contiene numeri: tutte le lettere in maiuscolo, mantieni trattini
          return tok.replace(/[A-Za-z]+/g, m => m.toUpperCase());
        }
        return tok.toLowerCase();
      });

    if (!parts.length) return '';

    // ricompone con virgole
    let out = parts.join(', ');

    // iniziale della primissima parola maiuscola se è lettera
    out = out.replace(/^([a-z])/, (_, c) => c.toUpperCase());
    return out;
  }

  // Prepara label e valori
  const typeLabel = (meta && meta.farmType === 'cooperative') ? "Cooperative name" : "Farm name";
  const nameValue = titleCaseWords(meta && meta.farmName ? meta.farmName : '');

  const rawVar = meta && meta.varieties ? meta.varieties : '';
  const vLabel  = varietiesLabel(rawVar);                // "Variety" / "Varieties"
  const vValue  = formatVarietiesDisplay(rawVar);        // string formattata come da regole

  // Process string dal CPC (usa la funzione già definita a valle)
  const processValue = classifyProcessString(cpc || '');

  // CPC completo così come nel link
  const cpcValue = cpc || (new URLSearchParams(location.search).get('cpc') || '');

  // Render in grid: coppie (label .k | valore .v)
  host.innerHTML = `
    <span class="k">${typeLabel}</span><span class="v">${nameValue || '—'}</span>
    <span class="k">${vLabel}</span><span class="v">${vValue || '—'}</span>
    <span class="k">Primary process</span><span class="v">${processValue || '—'}</span>
    <span class="k">Coffee Process Code</span><span class="v">${cpcValue || '—'}</span>
  `;
}


function renderVerticalSummary(cpc){
  summaryEl.innerHTML='';
  const groups = parseCPC(cpc);
  const optObj = decodeOpt();

  if(groups.length===0){
    const li=document.createElement('li');
    li.className='tiny';
    li.textContent='No CPC in link.';
    summaryEl.appendChild(li);
    return;
  }

  groups.forEach((g, idx) => {
    const frag = document.createDocumentFragment();

    // HEADER "Step 1" prima della prima categoria
    if (idx === 0) {
      const liStepHdr = document.createElement('li');
      liStepHdr.className = 'sum-row';
      const leftBlank = document.createElement('div');
      leftBlank.className = 'sum-code mono';
      leftBlank.textContent = '';
      liStepHdr.appendChild(leftBlank);
      const rightHdr = document.createElement('div');
      rightHdr.innerHTML = '<b>Step 1</b>';
      liStepHdr.appendChild(rightHdr);
      frag.appendChild(liStepHdr);
    }

    // MAIN ROW (lettera principale)
    const liMain = document.createElement('li');
    liMain.className = 'sum-row';

    const codeMain = document.createElement('div');
    codeMain.className = 'sum-code mono';
    codeMain.textContent = g.main;
    liMain.appendChild(codeMain);

    const rightMain = document.createElement('div');
    const mainLabel = (CATALOG.find(x => x.main === g.main) || {}).label || 'Unknown';
    rightMain.appendChild(makeDetails(g.main, mainLabel, g.main));
    liMain.appendChild(rightMain);
    frag.appendChild(liMain);

    // SUB ROW (se presente)
    if (g.sub) {
      const liSub = document.createElement('li');
      liSub.className = 'sum-row';

      const codeSub = document.createElement('div');
      codeSub.className = 'sum-code mono';
      codeSub.textContent = g.sub;
      liSub.appendChild(codeSub);

      const rightSub = document.createElement('div');
      const subKey = g.main + g.sub;
      const subLabel = SUB_LABELS[subKey] || SUB_LABELS[g.sub] || g.sub;
      rightSub.appendChild(makeDetails(subKey, subLabel, subKey));
      liSub.appendChild(rightSub);

      frag.appendChild(liSub);
    }

    // TIME ROW (se presente)
    if (g.hours) {
      const liTime = document.createElement('li');
      liTime.className = 'sum-row';

      const codeTime = document.createElement('div');
      codeTime.className = 'sum-code mono';
      codeTime.textContent = `${g.hours}${g.unit||''}`;
      liTime.appendChild(codeTime);

      const n = parseInt(g.hours, 10);
      const unitFull = (g.unit === 'd') ? 'day' : 'hour';
      const rightTime = document.createElement('div');
      rightTime.textContent = `${n} ${unitFull}${n === 1 ? '' : 's'}`;
      liTime.appendChild(rightTime);

      frag.appendChild(liTime);
    }

    // PERCENT ROW per Depulping (es. 25%)
    if (g.pct) {
      const liPct = document.createElement('li');
      liPct.className = 'sum-row';

      const codePct = document.createElement('div');
      codePct.className = 'sum-code mono';
      codePct.textContent = `${g.pct}%`;
      liPct.appendChild(codePct);

      const rightPct = document.createElement('div');
      rightPct.textContent = `${g.pct}% mucilage left`;
      liPct.appendChild(rightPct);

      frag.appendChild(liPct);
    }

    // STAR ROW (se presente) → * --> parole-chiave
    if (g.star) {
      const kw = extrasKeywordsForIndex(optObj, idx);
      if (kw) {
        const liStar = document.createElement('li');
        liStar.className = 'sum-row';

        const codeStar = document.createElement('div');
        codeStar.className = 'sum-code mono';
        codeStar.textContent = '*';
        liStar.appendChild(codeStar);

        const rightStar = document.createElement('div');
        rightStar.textContent = kw;   // niente "* -->"
        liStar.appendChild(rightStar);


        frag.appendChild(liStar);
      }
    }

    // SEPARATORE con "Step N+1"
    if (idx < groups.length - 1) {
      const liDot = document.createElement('li');
      liDot.className = 'sum-row';

      const codeDot = document.createElement('div');
      codeDot.className = 'sum-code mono';
      codeDot.textContent = '.';
      liDot.appendChild(codeDot);

      const rightDot = document.createElement('div');
      rightDot.innerHTML = `<b>Step ${idx + 2}</b>`;
      liDot.appendChild(rightDot);

      frag.appendChild(liDot);
    }

    summaryEl.appendChild(frag);
  });
}




(function(){
  const p=new URLSearchParams(location.search);
  const cpc=p.get('cpc')||'';
  renderProducerCard(cpc);     // <-- nuova card prima del breakdown
  renderVerticalSummary(cpc);  // breakdown come prima
})();


