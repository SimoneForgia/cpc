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
// - se unit='d' e < 41 → converti in ore; mostra solo se > 24h
// - se unit='h' e > 984 → converti in giorni (arrotondati)
function formatFermentDuration(step){
  if (!step || step.main !== 'F') return '';
  const n = step.hours ? parseInt(step.hours,10) : NaN;
  if (!Number.isFinite(n)) return '';
  if (step.unit === 'd'){
    if (n < 41){
      const h = n * 24;
      return (h > 24) ? `${h}h` : '';
    }
    return `${n}d`;
  } else {
    if (n > 984) return `${Math.round(n/24)}d`;
    return `${n}h`;
  }
}

function classifyBase(steps){
  // 1) Carbonic maceration se ultima F è FC (con durata PRIMA della dicitura)
  //    !Se esiste un depulping (P) PRIMA di questa FC → Experimental
const idxF = lastFermentationIndex(steps);
if (idxF >= 0 && steps[idxF].sub === 'C'){
  const hasPBefore = steps.some((s, i) => s.main === 'P' && i < idxF);
  if (hasPBefore) {
    return { base:'Experimental', baseIdxRef: -1 };
  }
  const dur = formatFermentDuration(steps[idxF]);
  return { base: dur ? `${dur} carbonic maceration` : 'Carbonic maceration', baseIdxRef: idxF };
}


  // 2) Double fermentation washed
  // Requisiti:
  // - esiste un P prima della W
  // - tra quel P (il più vicino prima) e quella W: esattamente 1 F (qualsiasi)
  // - tra quella W e il D successivo: esattamente 1 F, ed è FA o FI
  // - e c'è almeno una fermentazione prima della W (soddisfatta dalla F tra P e W)
  for (let iw = 0; iw < steps.length; iw++){
    if (steps[iw].main !== 'W') continue;
    const ip = lastIndexBefore(steps, iw, 'P'); if (ip < 0) continue;

    const fBetweenPW = countBetween(steps, ip, iw, isFermentation);
    if (fBetweenPW !== 1) continue;

    const id = firstIndexAfter(steps, iw, 'D'); if (id < 0) continue;
    const fBetweenWD  = countBetween(steps, iw, id, isFermentation);
    const faFiBetween = countBetween(steps, iw, id, isFAorFI);
    if (fBetweenWD === 1 && faFiBetween === 1 && hasFermentationBefore(steps, iw)){
      return { base:'Double fermentation washed', baseIdxRef: iw };
    }
  }

  // 3) Washed — una sola coppia W…D nell’intero CPC e nessuna F tra quei due
  if (totalPairs(steps, 'W', 'D') === 1){
    for (let iw = 0; iw < steps.length; iw++){
      if (steps[iw].main !== 'W') continue;
      const id = firstIndexAfter(steps, iw, 'D');
      if (id < 0) continue;
      if (!anyBetween(steps, iw, id, isFermentation)){
        return { base:'Washed', baseIdxRef: iw };
      }
    }
  }

  // 4) Honey — una sola coppia P…D; tra P e D: no W e al massimo 2 F
  if (totalPairs(steps, 'P', 'D') === 1){
    for (let ip = 0; ip < steps.length; ip++){
      const st = steps[ip];
      if (st.main !== 'P' || !st.pct) continue;
      const id = firstIndexAfter(steps, ip, 'D'); if (id < 0) continue;
      if (anyBetween(steps, ip, id, s => s.main === 'W')) continue;
      const fCountBetween = countBetween(steps, ip, id, isFermentation);
      if (fCountBetween <= 2){
        const name = honeyNameForPct(st.pct);
        if (name) return { base:name, baseIdxRef: ip };
      }
    }
  }

  // 5) Natural — nessun P, ≤2 fermentazioni totali, nessun W, e ultima F non FC
  const hasP = steps.some(s => s.main==='P');
  const hasW = steps.some(s => s.main==='W');
  const fIdxs = steps.map((s,i)=>s.main==='F'?i:-1).filter(i=>i>=0);
  const fCountTot = fIdxs.length;
  const lastF = fIdxs.length ? steps[fIdxs[fIdxs.length-1]] : null;
  if (!hasP && !hasW && fCountTot <= 2 && !(lastF && lastF.sub === 'C')){
    return { base:'Natural', baseIdxRef: fIdxs.length ? fIdxs[fIdxs.length-1] : -1 };
  }

  // 6) Experimental
  return { base:'Experimental', baseIdxRef: -1 };
}

function buildModifiers(base, steps){
  // Aggrega da TUTTE le fermentazioni e da TUTTI i drying; deduplica
  const exBy = extrasMapByIndex();

  // --- anaerobic (solo sull'ULTIMA F, con durata formattata) ---
  let anaerobicChunk = '';
  const idxF = lastFermentationIndex(steps);
  if (idxF >= 0){
    const f = steps[idxF];
    if (f.sub === 'N'){ // FN
      const dur = formatFermentDuration(f);
      anaerobicChunk = dur ? `${dur} anaerobic` : 'anaerobic';
    }
  }

  // --- Mod globali su tutte le F ---
  let hasLactic = false;              // sale in almeno una F
  const withSet   = new Set();        // sugar/mosto/yeast/bacteria/koji (dedup)
  const coferSet  = new Set();        // AddK per categories descrittive (lowercase dedup)

  steps.forEach((st, i) => {
    if (st.main !== 'F') return;
    const ex = exBy[i] || {};
    const add  = (ex.Add || '').toLowerCase();
    const addK = (ex.AddK || '').toString().trim().toLowerCase(); // sempre minuscolo

    if (add === 'salt') hasLactic = true;

    if (['sugar','mosto','yeast','bacteria','koji'].includes(add)){
      withSet.add(add); // deduplica automatica
    }

    if (['fruits','herbs','spices','flowers','essential','other'].includes(add) && addK){
      coferSet.add(addK); // deduplica automatica
    }
  });

  // --- "infused with" da tutti i D con CD=yes ---
  const infusedSet = new Set();
  steps.forEach((st, i) => {
    if (st.main !== 'D') return;
    const ex = exBy[i] || {};
    const k = (ex.CDK || '').toString().trim().toLowerCase();
    if (ex.CD === 'yes' && k) infusedSet.add(k);
  });

 // --- Composizione in ordine richiesto ---
  const parts = [];

  // 1) anaerobic (se presente)
  if (anaerobicChunk) parts.push(anaerobicChunk);

  // 2) lactic fermentation (una sola volta anche se ricorre)
  if (hasLactic) parts.push('lactic fermentation');

  // 3) with sugar/mosto/yeast/bacteria/koji — lista separata da virgola, dedup
  let withStr = '';
  if (withSet.size){
  const arr = Array.from(withSet).sort();
  withStr = `with ${arr.join(', ')}`;
  parts.push(withStr);
  }

  // 4) co-fermented with <list> — lista separata da virgola, dedup
  let coferStr = '';
  if (coferSet.size){
  const arr = Array.from(coferSet).sort();
  coferStr = `co-fermented with ${arr.join(', ')}`;
  parts.push(coferStr);
  }

  // 5) infused with <list> — lista separata da virgola, dedup
  let infusedStr = '';
  if (infusedSet.size){
  const arr = Array.from(infusedSet).sort();
  infusedStr = `infused with ${arr.join(', ')}`;
  parts.push(infusedStr);
  }

  // --- Aggiungi virgole se presenti almeno 2 tra "with", "co-fermented" e "infused with" ---
  const countWithBlocks = [withStr, coferStr, infusedStr].filter(Boolean).length;
  let joined = parts.join(' ').trim();

  if (countWithBlocks >= 2) {
  // Inserisce virgole tra i blocchi rilevanti, mantenendo le parti precedenti (anaerobic/lactic)
  joined = joined
    .replace(/\b(with [^]+?) (co-fermented with)/, '$1, $2')
    .replace(/\b(co-fermented with [^]+?) (infused with)/, '$1, $2')
    .replace(/\b(with [^]+?) (infused with)/, '$1, $2');
  }

  return joined;

}

function classifyProcessString(cpc){
  const steps = parseCPC(cpc);
  const { base } = classifyBase(steps);
  const mods = buildModifiers(base, steps);
  return mods ? `${base} ${mods}` : base;
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


