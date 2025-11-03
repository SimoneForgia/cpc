// js/summary-narrator.js
// Prose summary from ?cpc= and ?opt= only (EN), with reasons keyed by words.
// Fixes: WK no double "washed"; "and" merge replaces repeated subject with pronoun.

import { SUB_LABELS, $ } from './common.js';

/* ===== WORDS ===== */
const WORDS = {
  then:   'then',
  subseq: 'subsequently',
  after:  'After that,',
  next:   'Next,',
  lastly: 'Lastly,',

  floated:   'floated in water',
  depulped:  'depulped',
  fermented: 'fermented',
  washed:    'washed',
  dried:     'dried',
  rested:    'rested',
  hulled:    'hulled',

  leavingPct: 'leaving {pct}% of the mucilage',
  for:        'for',
  at:         'at',
  hour:       'hour',
  hours:      'hours',
  day:        'day',
  days:       'days',
  with:       'with',
  and:       'and',
  using:      'using',
  contactTxt: 'in contact with external products'
};

const VESSEL = {
  concrete: 'concrete tank',
  metal:    'metal tank',
  plastic:  'plastic barrel',
  wood:     'wood barrel',
  clay:     'clay pot'
};

const DESCRIPTIVE_ADDITIONS = new Set(['fruits','herbs','spices','flowers','essential','other']);
const STANDALONE_ADDITIONS  = new Set(['salt','sugar','yeast','bacteria','koji','mosto']);

/* ===== parse/normalize ===== */
function parseCPC(cpc) {
  if (!cpc) return [];
  return cpc.split('.').filter(Boolean).map(tok => {
    // Supporta: L, FI24h, FA24h*, P10%, DP9d*, ecc.
    const m = tok.match(/^([A-Z])([A-Z]?)(?:(\d{1,3})([hd])|(\d{1,3})%)?(\*)?$/);
    if (!m) return { raw: tok, main: '?', sub: '', hours: '', unit: '', pct:'', star:false };
    return {
      raw: tok,
      main: m[1],
      sub:  m[2] || '',
      hours:m[3] || '',
      unit: m[4] || '',
      pct:  m[5] || '',
      star: !!m[6]
    };
  });
}

function parseOPT(optB64) {
  if (!optB64) return {};
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(optB64))));
    const map = {};
    (json.steps || []).forEach(e => {
      map[e.i] = {
        MP: e.MP || '',
        Ct: e.Ct || '',
        Add: e.Add || '',
        AddK: (e.AddK || ''),
        Th: e.Th || '',
        T:  e.T  || '',
        TU: e.TU || 'C',  // <-- unità temperatura
        pH: e.pH || '',
        CD: e.CD || '',
        CDK:(e.CDK||'')
      };
    });
    return map;
  } catch { return {}; }
}

function normalize(cpc, optB64) {
  const steps = parseCPC(cpc);
  const extrasByIndex = parseOPT(optB64);
  return steps.map((s,i)=>({ ...s, extras: extrasByIndex[i] || {} }));
}

/* ===== subject logic ===== */
function firstDepulpIndex(steps) {
  const idx = steps.findIndex(s => s.main === 'P');
  return idx < 0 ? Number.POSITIVE_INFINITY : idx;
}
function makeSubjectPicker(steps) {
  const depIdx = firstDepulpIndex(steps);
  let preCherryToggle = 0;
  let postToggle = 0;
  return function pick(i) {
    if (i === 0) return { np: 'this coffee', be: 'was', key:'coffee', plural:false };
    if (i < depIdx) {
      const np = (preCherryToggle++ % 2 === 0) ? 'the coffee cherries' : 'the cherries';
      return { np, be:'were', key: np.includes('coffee') ? 'coffee cherries' : 'cherries', plural:true };
    }
    const useCoffee = (postToggle++ % 2 === 0);
    if (useCoffee) return { np:'the coffee', be:'was', key:'coffee', plural:false };
    return { np:'the coffee beans', be:'were', key:'coffee beans', plural:true };
  };
}

/* ===== connectors ===== */
function connectorPlacement(i, total, useLastly) {
  if (i === 0) return { lead: null, inline: null, andFlag: false };
  if (i === total - 1 && useLastly && total >= 3) {
    return { lead: WORDS.lastly, inline: null, andFlag: false };
  }
  const cycle = ['then', 'after', 'next', 'subseq'];
  const key = cycle[(i - 1) % cycle.length];
  if (key === 'after')  return { lead: WORDS.after, inline: null, andFlag: false };
  if (key === 'next')   return { lead: WORDS.next,  inline: null, andFlag: false };
  if (key === 'then')   return { lead: null, inline: WORDS.then,   andFlag: true  };
  /* subseq */          return { lead: null, inline: WORDS.subseq, andFlag: true  };
}

/* ===== formatters ===== */
const fmt = {
  duration(step) {
    const n = step.hours ? parseInt(step.hours, 10) : NaN;
    if (!Number.isFinite(n)) return '';
    const isDays = step.unit === 'd';
    const unit = isDays ? (n===1?WORDS.day:WORDS.days) : (n===1?WORDS.hour:WORDS.hours);
    return `${WORDS.for} ${n} ${unit}`;
  },
  temperature(ex) {
    if (ex.T === undefined || ex.T === null || ex.T === '') return '';
    const v = parseFloat(String(ex.T).replace(',', '.'));
    if (Number.isNaN(v)) return '';

    const isF = String(ex.TU).toUpperCase() === 'F';
    if (isF) {
      const f = Math.round(v);
      const c = Math.round((v - 32) * 5 / 9);
      return `${WORDS.at} ${f}°F / ${c}°C`;
    } else {
      const c = Math.round(v);
      const f = Math.round(v * 9 / 5 + 32);
      return `${WORDS.at} ${c}°C / ${f}°F`;
    }
  },

  vessel(ex) {
    if (!ex.Ct || !VESSEL[ex.Ct]) return '';
    const noun = VESSEL[ex.Ct];
    const art = /^[aeiou]/i.test(noun) ? 'an' : 'a';
    return `in ${art} ${noun}`;
  },
  mucilagePct(ex) {
    if (!ex.MP) return '';
    return WORDS.leavingPct.replace('{pct}', String(ex.MP));
  },
  addition(ex) {
    const add  = (ex.Add || '').toLowerCase().trim();
    const kind = (ex.AddK || '').toLowerCase().trim();
    if (!add || add === 'nothing') return '';
    if (kind) {
      const isMulti = /[, ]/.test(kind);
      if (isMulti && DESCRIPTIVE_ADDITIONS.has(add)) {
        const category = (add === 'essential') ? 'essential oils' : add;
        return `${WORDS.with} ${category} (${kind})`;
      }
      return `${WORDS.with} ${kind}`;
    }
    if (STANDALONE_ADDITIONS.has(add)) return `${WORDS.with} ${add}`;
    return '';
  },
  contact(ex) {
    if (ex.CD !== 'yes') return '';
    const kind = (ex.CDK || '').trim().toLowerCase();
    return kind ? `${WORDS.contactTxt} (${kind})` : WORDS.contactTxt;
  },
  subtypeProse(main, sub) {
    if (!sub) return '';
    const key = (main||'') + (sub||'');
    const label = SUB_LABELS[key] || SUB_LABELS[sub] || '';
    if (!label) return '';
    switch (key) {
      // Fermentation
      case 'FA': return 'under aerobic conditions';
      case 'FN': return 'under anaerobic conditions';
      case 'FC': return 'with carbonic maceration';
      case 'FI': return 'by immersion';
      // Washing
      case 'WM': return 'using mechanical demucilagers to remove the mucilage left';
      case 'WK': return 'manually washed with the Kenyan process to remove the mucilage left';
      case 'WR': return 'rinsed with water';
      // Drying
      case 'DR': return 'on raised beds';
      case 'DP': return 'on patios';
      case 'DM': return 'in a mechanical dryer';
      // Resting
      case 'RC': return 'in cherries';
      case 'RP': return 'in parchment';
      // Hulling
      case 'HW': return 'wet hulled';
      case 'HD': return 'hulled';
      default:   return label.toLowerCase();
    }
  },
  // Reason: if starts with "to/for/because" keep, otherwise prefix "to"
  reason(text) {
    if (!text) return '';
    const t = String(text).trim();
    if (!t) return '';
    if (/^(to|for|because)\b/i.test(t)) return t.replace(/\.$/, '');
    return 'to ' + t.replace(/\.$/, '');
  }
};

/* ===== tiny utils ===== */
function capFirst(str){ return str ? str[0].toUpperCase()+str.slice(1) : str; }
function startLower(str){ return str ? str[0].toLowerCase()+str.slice(1) : str; }
function end(arr){ return arr.join(' ') + '.'; }

/* ===== op-word mapping for reasons ===== */
function opWordFor(step){
  switch(step.main){
    case 'L': return 'floated';
    case 'P': return 'depulped';
    case 'F': return 'fermented';
    case 'W': return 'washed';
    case 'D': return 'dried';
    case 'R': return 'rested';
    case 'H': return 'hulled';
    default:  return '';
  }
}

/* ===== templates ===== */
const TPL = {
  L(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';
    const chunks = [`${np} ${be}${first}${inline} ${WORDS.floated}`];

    const reason = fmt.reason(ctx.reasonText);
    if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  },

  P(step, ctx) {
  const { np, be } = ctx.subject;
  const parts = [];
  if (ctx.lead) parts.push(ctx.lead);
  const first = ctx.isFirst ? ' first' : '';
  const inline = ctx.inline ? ` ${ctx.inline}` : '';

  const chunks = [];
  chunks.push(`${np} ${be}${first}${inline} ${WORDS.depulped}`);

  // Reason subito dopo lo step
  const reason = fmt.reason(ctx.reasonText);
  if (reason) chunks.push(reason);

  // Mucilage percentage, preceduta da virgola se presente
  const mp = fmt.mucilagePct(step.extras);
  if (mp) chunks[chunks.length - 1] += `, ${mp}`;

  const sent = chunks.join(' ');
  parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
  return end(parts);
},

  F(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';

    const chunks = [];
    chunks.push(`${np} ${be}${first}${inline} ${WORDS.fermented}`);

    const sub = fmt.subtypeProse(step.main, step.sub); if (sub) chunks.push(sub);
    const dur = fmt.duration(step); if (dur) chunks.push(dur);
    const vess = fmt.vessel(step.extras); if (vess) chunks.push(vess);
    const temp = fmt.temperature(step.extras); if (temp) chunks.push(temp);
    const add = fmt.addition(step.extras); if (add) chunks.push(add);
    if (step.extras.Th === 'yes') chunks.push(`${WORDS.and} a final thermal shock`);

    const reason = fmt.reason(ctx.reasonText); if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  },

  W(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';

    const chunks = [];
    const sub = fmt.subtypeProse(step.main, step.sub);

    // Robust WK/WR handling (no double "washed")
    if (sub && /^(rinsed with water|manually washed\b)/i.test(sub)) {
      chunks.push(`${np} ${be}${first}${inline} ${sub}`);
    } else {
      const baseVerb = WORDS.washed;
      chunks.push(sub ? `${np} ${be}${first}${inline} ${baseVerb} ${sub}`
                      : `${np} ${be}${first}${inline} ${baseVerb}`);
    }

    const reason = fmt.reason(ctx.reasonText); if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  },

  D(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';

    const chunks = [];
    chunks.push(`${np} ${be}${first}${inline} ${WORDS.dried}`);
    const sub = fmt.subtypeProse(step.main, step.sub); if (sub) chunks.push(sub);
    const dur = fmt.duration(step); if (dur) chunks.push(dur);
    const contact = fmt.contact(step.extras); if (contact) chunks.push(contact);

    const reason = fmt.reason(ctx.reasonText); if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  },

  R(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';

    const chunks = [];
    chunks.push(`${np} ${be}${first}${inline} ${WORDS.rested}`);
    const sub = fmt.subtypeProse(step.main, step.sub); if (sub) chunks.push(sub);
    const dur = fmt.duration(step); if (dur) chunks.push(dur);

    const reason = fmt.reason(ctx.reasonText); if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  },

  H(step, ctx) {
    const { np, be } = ctx.subject;
    const parts = [];
    if (ctx.lead) parts.push(ctx.lead);
    const first = ctx.isFirst ? ' first' : '';
    const inline = ctx.inline ? ` ${ctx.inline}` : '';

    const sub = fmt.subtypeProse(step.main, step.sub); // "wet hulled" | "hulled"
    const verb = sub || WORDS.hulled;

    const chunks = [`${np} ${be}${first}${inline} ${verb}`];

    const reason = fmt.reason(ctx.reasonText); if (reason) chunks.push(reason);

    const sent = chunks.join(' ');
    parts.push(ctx.lead ? startLower(sent) : capFirst(sent));
    return end(parts);
  }
};

/* ===== compose + AND-MERGE ===== */
function compose(steps, { useLastly, reasons }) {
  const pickSubject = makeSubjectPicker(steps);
  const raw = steps.map((step, i) => {
    const place = connectorPlacement(i, steps.length, useLastly);
    const subject = pickSubject(i, step);
    const reasonText = pickReasonByWord(step, i, steps, reasons);
    const tpl = TPL[step.main] || ((st, ctx) => {
      const first = ctx.isFirst ? ' first' : '';
      const inline = ctx.inline ? ` ${ctx.inline}` : '';
      const base = `${ctx.subject.np} ${ctx.subject.be}${first}${inline} processed`;
      const chunks = [base];
      const rr = fmt.reason(ctx.reasonText); if (rr) chunks.push(rr);
      const sent = chunks.join(' ');
      return (ctx.lead ? startLower(sent) : capFirst(sent)) + '.';
    });
    return {
      text: tpl(step, { lead: place.lead, inline: place.inline, isFirst: i === 0, subject, reasonText }),
      andCandidate: place.andFlag,
      subjKey: subject.key,
      subjPlural: subject.plural
    };
  });

    // merge with "and" when eligible, replacing repeated subject with pronoun
  const out = [];
  const total = raw.length; // serve per bloccare il merge quando ci sono solo 2 step
  let usedAndLast = false;

  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];

    // condizioni base per il merge con "and"
    const canBaseMerge =
      cur.andCandidate &&
      !usedAndLast &&
      out.length > 0 &&
      total > 2 && // ⬅️ nuovo: non unire se ci sono solo 2 step
      !/\sand\s[^.]*\.$/i.test(out[out.length - 1]);

    if (canBaseMerge) {
      // Conta parole: se una delle due frasi supera 12 parole, non unire
      const prevSentence = out[out.length - 1];
      const prevWords = prevSentence.replace(/\.\s*$/, '').trim().split(/\s+/).filter(Boolean).length;
      const curWordsInitial = cur.text.replace(/\.\s*$/, '').trim().split(/\s+/).filter(Boolean).length;

      if (prevWords > 12 || curWordsInitial > 12) {
        out.push(cur.text);
        usedAndLast = false;
        continue;
      }

      // Procedi con l'unione
      const prev = out.pop().replace(/\.\s*$/, '');
      let curClause = cur.text.trim().replace(/\.$/, '');

      // Se il soggetto della seconda frase è identico alla prima, sostituisci con pronome
      const prevMeta = raw[i - 1];
      if (prevMeta && prevMeta.subjKey === cur.subjKey) {
        curClause = curClause.replace(
          /^(?:After that,\s+|Next,\s+|Lastly,\s+)?(?:(?:this|the)\s+)?(coffee beans|beans|coffee cherries|cherries|coffee)\s+(was|were)\s+/i,
          (_, noun) => (/(beans|cherries)/i.test(noun) ? 'they were ' : 'it was ')
        );
      }

      // Dopo l’unione con "and", forza sempre la minuscola iniziale
      curClause = curClause.replace(/^\s*([A-Z])/, (_, c) => c.toLowerCase());

      out.push(prev + ' and ' + curClause + '.');
      usedAndLast = true;
    } else {
      out.push(cur.text);
      usedAndLast = false;
    }
  }
  return out;
}

/* ===== reasons picking ===== */
function hasWordKeys(obj){
  const keys = ['floated','depulped','fermented','washed','dried','rested','hulled'];
  return obj && typeof obj === 'object' && keys.some(k => Object.prototype.hasOwnProperty.call(obj,k));
}
function pickReasonByWord(step, i, steps, reasonsOpt){
  const src = (reasonsOpt && typeof reasonsOpt === 'object') ? reasonsOpt
    : (typeof window !== 'undefined' ? (window.CPC_REASONS || null) : null);
  if (!src) return '';
  const word = opWordFor(step);
  if (word && hasWordKeys(src) && src[word]) return src[word];
  if (Array.isArray(src)) return src[i] || '';
  const byIndex = src[i] || src[String(i)]; if (byIndex) return byIndex;
  const tok = step.main + (step.sub||'') + (step.hours||'') + (step.unit||'');
  return src[tok] || src[step.main] || '';
}

/* ===== render & API ===== */
function render(targetSel, text) {
  const host = $(targetSel) || document.querySelector(targetSel);
  if (!host) return;
  host.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = text;
  host.appendChild(p);
}

export const SummaryNarrator = {
  init({ target = '#processSummary', useLastly = true, reasons = null } = {}) {
    const p = new URLSearchParams(location.search);
    const cpc = p.get('cpc') || '';
    const opt = p.get('opt') || '';

    if (!cpc) { render(target, 'A process summary will appear once a code is generated.'); return; }
    const steps = normalize(cpc, opt);
    if (!steps.length) { render(target, 'A process summary will appear once a code is generated.'); return; }

    const sentences = compose(steps, { useLastly, reasons });
    render(target, sentences.join(' '));
  }
};
window.SummaryNarrator = SummaryNarrator;
