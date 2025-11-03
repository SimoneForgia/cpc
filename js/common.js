export const CATALOG = [
  { main:'L', label:'Floating',      duration:false, extras:false, sub:[] },

  { main:'P', label:'Depulping',     duration:false, extras:true,  sub:[] },      // mucilage % opzionale via extras

  { main:'F', label:'Fermentation',  duration:true,  extras:true,  sub:['A','N','C','I'] },
  // A=Aerobic, N=Anaerobic, C=Carbonic, I=Immersion

  { main:'W', label:'Washing',       duration:false, extras:false, sub:['M','K','R'] },
  // M=Mechanical demucilagers, K=Kenyan process, R=Only rinsed with water

  { main:'D', label:'Drying',        duration:true,  extras:true,  sub:['R','P','M'] },
  // R=Raised beds, P=Patio, M=Mechanical (+ domanda contatto durante l’asciugatura)

  { main:'R', label:'Resting',          duration:true,  extras:false, sub:['C','P'] },
  // C=In cherries (Hours), P=In parchment (Days)

  { main:'H', label:'Hulling',       duration:false, extras:false, sub:['W','D'] }
  // W=Wet, D=Dry
];

export const SUB_LABELS = {
  // Fermentation
  FA: 'Aerobic',
  FN: 'Anaerobic',
  FC: 'Carbonic maceration',
  FI: 'Immersion',

  // Washing
  WM: 'With mechanical demucilagers',
  WK: 'Manually with the Kenyan process',
  WR: 'Only rinsed with water',

  // Drying
  DR: 'Raised beds',
  DP: 'Patio',
  DM: 'Mechanical',

  // Resting
  RC: 'In cherries',
  RP: 'In parchment',

  // Hulling
  HW: 'Wet',
  HD: 'Dry'
};


export const DESCRIPTIONS = {
  /* --- Categorie (1 lettera) --- */
  L:'Density sorting in water to remove floaters/defects prior to processing.',
  P:'Removal of the outer skin/pulp. Optionally leaves a % of mucilage on parchment.',
  F:'Controlled microbial activity that transforms mucilage and impacts flavor.',
  W:'Washing stage to remove mucilage and/or finish fermentation.',
  D:'Reduction of moisture to safe storage levels on patios, raised beds or machines.',
  R:'Resting period usually due to transportation or processing logistics.',
  H:'Removal of parchment (dry) or wet-hulling style.',

  /* --- Fermentation (F + sub) --- */
  FA:'Fermentation with oxygen available (aerobic).',
  FN:'Fermentation in low/zero-oxygen environment (anaerobic).',
  FC:'Whole-cherry/CO₂-rich “carbonic maceration”.',
  FI:'Cherries or parchment fully submerged in water (immersion).',

  /* --- Washing (W + sub) --- */
  WM:'Mucilage removed using mechanical demucilagers.',
  WK:'Manual wash using the Kenyan process.',
  WR:'Only rinsed with water, minimal mechanical/microbial action.',

  /* --- Drying (D + sub) --- */
  DR:'Dried on raised (African) beds with strong airflow.',
  DP:'Dried on patios (concrete/tiles).',
  DM:'Dried using assisted/mechanical dryers.',

  /* --- Resting (R + sub) --- */
  RC:'Rest in cherries (typically measured in hours).',
  RP:'Rest/conditioning in parchment to uniform humidity.',

  /* --- Hulling (H + sub) --- */
  HW:'Wet hulling.',
  HD:'Dry hulling.'
};

export const $ = (s, root=document) => root.querySelector(s);
export const $$ = (s, root=document) => [...root.querySelectorAll(s)];

export const blankStep = () => ({
  main:'', sub:'', hours:'', unit:'',
  // campi extra opzionali
  mucilagePct:'',              // Depulping: 10|25|50|75
  extras:{
    // Fermentation
    container:'',              // none|plastic|wood|metal|concrete|clay
    addition:'',               // nothing|mosto|yeast|bacteria|koji|fruits|herbs|spices|flowers|essential|other
    additionKind:'',           // testo richiesto se addition ∈ {fruits,herbs,spices,flowers,essential,other}
    thermal:'',                // yes|no
    temp:'',                   // °C (se vuoi mantenerlo)
    ph:'',                     // opzionale: lo lasci se ti serve ancora

    // Drying
    contactDuringDrying:'',    // yes|no
    contactKind:''             // testo richiesto se yes
  }
});


export function tokenForStep(s){
  if(!s || !s.main) return '';

  // --- Depulping con percentuale (es. P25%) ---
  if (s.main === 'P' && s.mucilagePct) {
    return `${s.main}${s.sub||''}${parseInt(s.mucilagePct,10)}%`;
  }

  // --- Altri step con durata opzionale/obbligatoria ---
  const HRS = (s.hours!=='' && /^\d{1,3}$/.test(String(s.hours)))
    ? String(parseInt(s.hours,10)) : '';
  const U = (HRS && (s.unit==='h' || s.unit==='d')) ? s.unit : '';
  return `${s.main}${s.sub||''}${HRS}${U}`;
}



function needsStar(s){
  if (!s || !s.main) return false;
  const ex = s.extras || {};

  // Depulping: la percentuale è rappresentata nel codice (P25%), quindi NON attiva lo star
  if (s.main === 'P') return false;

  // Fermentation: metti * se esistono extra significativi
  if (s.main === 'F') {
    const hasTemp = !!ex.temp;
    const hasContainer = !!ex.container;
    const hasThermalYes = ex.thermal === 'yes';
    const hasAddition = !!ex.addition && ex.addition !== 'nothing';
    return (hasTemp || hasContainer || hasThermalYes || hasAddition);
  }

  // Drying: metti * se i chicchi sono stati a contatto con qualcosa
  if (s.main === 'D') {
    return ex.contactDuringDrying === 'yes';
  }

  return false;
}


export function buildCPC(steps){
  return steps
    .map(s => {
      const base = tokenForStep(s);
      if (!base) return '';
      return needsStar(s) ? (base + '*') : base;
    })
    .filter(Boolean)
    .join('.');
}

export function safeB64Encode(obj){ return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }

export function buildOpt(steps){
  const list=[];
  steps.forEach((s,i)=>{
    const ex = s.extras || {};
    const payload = {};

    // Depulping
    if (s.main==='P' && s.mucilagePct) payload.MP = s.mucilagePct;

    // Fermentation
    if (s.main==='F') {
      if (ex.container)    payload.Ct  = ex.container;
      if (ex.addition)     payload.Add = ex.addition;
      if (ex.additionKind) payload.AddK= ex.additionKind;
      if (ex.thermal)      payload.Th  = ex.thermal;
      if (ex.temp)         payload.T   = ex.temp;
      if (ex.unitTemp)     payload.TU  = ex.unitTemp;  // <-- nuova: C|F
      if (ex.ph)           payload.pH  = ex.ph;        // opzionale, se già lo usi
    }

    // Drying
    if (s.main==='D') {
      if (ex.contactDuringDrying) payload.CD = ex.contactDuringDrying;
      if (ex.contactKind)         payload.CDK= ex.contactKind;
    }

    if (Object.keys(payload).length) list.push({ i, ...payload });
  });
  return list.length ? { steps:list } : null;
}


// Hash + PRNG for BeanTag
export async function strongHash(str){
  try{ const enc=new TextEncoder(); const d=await crypto.subtle.digest('SHA-256', enc.encode(str)); return new Uint32Array(d.slice(0,16)); }
  catch(e){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return new Uint32Array([h,h^0x9e3779b9,h^0x85ebca6b,h^0xc2b2ae35]); }
}
export function prng32(seed){ let x=seed|0; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; }; }
