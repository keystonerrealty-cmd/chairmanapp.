#!/usr/bin/env node
/* ==========================================================================
   CHAIRMAN AGENT OS  —  SINGLE FILE

   RUN IT:   node chairman.js     then open http://localhost:8080

   WHAT THIS BUILD DOES, IN ORDER OF WHAT MAKES MONEY

   1. THE BUSINESS FACTORY
      One button turns an approved idea into a whole trading business:
      a five-page website, the four policy pages Razorpay reads before it
      will approve a sole proprietor, a real working browser tool, an
      editable invoice, and the outreach scripts. One ZIP, drag it onto
      Netlify Drop, it is live.

      It does not look AI-made because the model designs NOTHING. Layout,
      typography, colour and all legal text are hand-written into the
      system as a house style. The model supplies words and prices only.
      Then a hard-coded audit hunts 28 phrases and patterns that mark
      generated work and forces a rewrite before the pack may exist.

   2. THE DOMAIN DESK
      Checking a name is free and needs nobody's permission — RDAP is
      mandated by ICANN and every registry runs one. He invents names and
      verifies every single one against the live registry before showing
      it. He CANNOT register one: that needs an EPP credential issued to
      an accredited registrar plus a card and KYC in your legal name.

   3. THE GROWTH ENGINE
      He plans a two-week campaign, writes every message in finished form,
      and you approve the whole thing with one tick. Then CODE — not the
      model — decides what he may actually send. Email through your own
      Gmail is genuinely automatic. WhatsApp, Instagram, Facebook, X and
      Google Business Profile are not automatable for free by anyone, and
      he says so instead of pretending. Those become jobs on your desk
      with the exact words already written.

   4. THE TREASURY LOCK
      The gateway account is fingerprinted and sealed on connection. Any
      attempt to point the money somewhere else is refused without your
      password, and emails you. The Chairman cannot repoint your revenue.
      Neither can a stolen session.

   5. PERSISTENCE THAT SURVIVES A WIPED DISK
      Free hosts have no disk. Heavy files live in compressed blobs outside
      the state file, and a private GitHub repo acts as the disk. Proven by
      deleting every local file and restarting: everything came back.

   Truthfulness overrides all of it. No testimonials, no client counts, no
   statistics — there are none yet, and one caught fabrication ends the
   sale permanently.

   Creates data.json beside itself. Back that file up — it is your system.
   ========================================================================== */

const __M = {};
function __req(n){
  if(!(n in __M)) throw new Error('BUILD BUG: module "'+n+'" was never inlined');
  return __M[n];
}

__M['blobs'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* ==========================================================================
   BLOBS — heavy things live outside data.json.

   WHY THIS EXISTS.
   The GitHub Contents API is the only free persistent disk available to a
   Render free-tier service. It base64-encodes everything, which inflates
   payloads by 33%, and it rewrites the WHOLE file on every save. A single
   business pack is ~104 KB of HTML. Four of them turn a 122 KB state file
   into ~700 KB, and every trivial state change — one log line — would push
   700 KB to GitHub. That burns the API rate limit and eventually fails.

   So: data.json stays lean and holds only metadata. Anything big goes into
   its own blob file, written once, read on demand, deleted when its owner
   is deleted. Blobs are gzipped before storage: HTML compresses about 5:1.
   ========================================================================== */
const zlib = require('zlib');

function makeBlobs(STORE){
  const mem = new Map();          /* id -> parsed object, hot cache */

  const key = id => 'blob-' + String(id).replace(/[^A-Za-z0-9_-]/g,'') + '.gz.b64';

  return {
    /* Store any JSON-able value. Returns bytes actually written. */
    async put(id, value){
      const raw = Buffer.from(JSON.stringify(value), 'utf8');
      const gz  = zlib.gzipSync(raw, { level: 9 });
      const b64 = gz.toString('base64');
      mem.set(id, value);
      await STORE.write(key(id), b64);
      return { raw: raw.length, stored: b64.length,
               ratio: +(raw.length / Math.max(1,b64.length)).toFixed(1) };
    },

    /* Read it back. Cached after first hit. null if missing. */
    async get(id){
      if(mem.has(id)) return mem.get(id);
      const b64 = await STORE.read(key(id));
      if(!b64) return null;
      try{
        const v = JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
        mem.set(id, v);
        return v;
      }catch(e){ return null; }
    },

    async del(id){
      mem.delete(id);
      try{ await STORE.remove(key(id)); }catch(e){}
    },

    /* Drop from RAM without deleting from storage — for memory pressure. */
    evict(id){ mem.delete(id); },
    cached(){ return mem.size; }
  };
}

module.exports = { makeBlobs };

return module.exports; })();

__M['domains'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* ==========================================================================
   DOMAINS — real availability checking, zero dependencies, zero cost.

   HOW A DOMAIN ACTUALLY COMES INTO EXISTENCE (the honest chain):

     ICANN                  sets the rules, accredits registrars
       └─ REGISTRY          runs ONE top-level domain and owns its database
          e.g. Verisign owns .com   ·   NIXI owns .in   ·   PIR owns .org
          └─ REGISTRAR      accredited to write into that registry
             e.g. GoDaddy, Cloudflare, Porkbun, BigRock
             └─ RESELLER    sells a registrar's stock under its own brand
                └─ YOU / THE CUSTOMER

   Nobody "creates" a domain out of nothing. A registry publishes a zone
   file; a registrar sends an EPP command that inserts your name into it;
   you rent it for a year at a time. Let it lapse and it goes back.

   This module does the ONE part that is free and needs no permission:
   checking, authoritatively, whether a name is available — via RDAP, the
   ICANN-mandated successor to WHOIS. Every registry must run an RDAP
   server. No key, no account, no rate-limit contract, no cost.
   404 = available. 200 = taken.
   ========================================================================== */
const https = require('https');

const UA = 'Chairman-Agent-OS/1.0 (domain availability check)';

/* Direct registry RDAP endpoints. Going straight to the registry avoids the
   rdap.org redirect hop and is roughly 10x faster. Verified live. */
const RDAP = {
  com:'https://rdap.verisign.com/com/v1/',
  net:'https://rdap.verisign.com/net/v1/',
  in:'https://rdap.nixiregistry.in/rdap/',
  'co.in':'https://rdap.nixiregistry.in/rdap/',
  'net.in':'https://rdap.nixiregistry.in/rdap/',
  'org.in':'https://rdap.nixiregistry.in/rdap/',
  'firm.in':'https://rdap.nixiregistry.in/rdap/',
  'gen.in':'https://rdap.nixiregistry.in/rdap/',
  'ind.in':'https://rdap.nixiregistry.in/rdap/',
  org:'https://rdap.publicinterestregistry.org/rdap/',
  info:'https://rdap.identitydigital.services/rdap/',
  biz:'https://rdap.nic.biz/',
  io:'https://rdap.identitydigital.services/rdap/',
  co:'https://rdap.nic.co/',
  dev:'https://www.registry.google/rdap/',
  app:'https://www.registry.google/rdap/',
  page:'https://www.registry.google/rdap/',
  xyz:'https://rdap.centralnic.com/xyz/',
  site:'https://rdap.centralnic.com/site/',
  online:'https://rdap.centralnic.com/online/',
  store:'https://rdap.centralnic.com/store/',
  shop:'https://rdap.gmoregistry.net/rdap/',
  tech:'https://rdap.centralnic.com/tech/',
};
/* Anything not listed falls back to the IANA-run resolver, which redirects. */
const FALLBACK = 'https://rdap.org/';

/* Indicative RETAIL prices in INR, checked August 2026. These are what a
   customer pays at a cheap registrar — NOT wholesale, NOT a quote. They are
   here so he can talk about cost honestly, not so he can invoice from them.
   [first year, renewal] */
const PRICES = {
  'in':      [750, 950],
  'co.in':   [600, 800],
  'net.in':  [600, 800],
  'org.in':  [600, 800],
  'firm.in': [600, 800],
  'gen.in':  [600, 800],
  'ind.in':  [600, 800],
  'com':     [950, 1050],
  'net':     [1150, 1250],
  'org':     [1000, 1150],
  'info':    [400, 1900],
  'biz':     [700, 1500],
  'co':      [900, 2900],
  'io':      [3200, 4200],
  'dev':     [1300, 1400],
  'app':     [1400, 1500],
  'page':    [900, 1000],
  'site':    [300, 2400],
  'online':  [300, 2900],
  'store':   [400, 4500],
  'shop':    [400, 2900],
  'tech':    [400, 3900],
  'xyz':     [200, 1100],
};
const PRICE_ASOF = 'August 2026 — indicative retail, verify before quoting';

function tldOf(name){
  const p = String(name).toLowerCase().trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'').split('.');
  if(p.length < 2) return '';
  const two = p.slice(-2).join('.');
  if(RDAP[two]) return two;
  return p[p.length-1];
}
function priceOf(name){
  const t = tldOf(name);
  const p = PRICES[t];
  return p ? { tld:t, first:p[0], renew:p[1], asOf:PRICE_ASOF }
           : { tld:t, first:null, renew:null, asOf:PRICE_ASOF };
}

/* Syntax gate BEFORE any network call. An invalid label wastes a request
   and, worse, a 404 on a malformed name looks exactly like "available". */
function validate(name){
  const n = String(name||'').toLowerCase().trim()
    .replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\.$/,'');
  if(!n) return { ok:false, why:'empty' };
  if(n.length > 253) return { ok:false, why:'longer than 253 characters' };
  if(!n.includes('.')) return { ok:false, why:'no extension — write it as name.in or name.com' };
  const labels = n.split('.');
  const sld = labels[0];
  for(const l of labels){
    if(!l.length) return { ok:false, why:'empty part between dots' };
    if(l.length > 63) return { ok:false, why:`the part "${l.slice(0,20)}…" is over 63 characters` };
    if(!/^[a-z0-9-]+$/.test(l)) return { ok:false, why:'only letters, numbers and hyphens are allowed' };
    if(l.startsWith('-') || l.endsWith('-')) return { ok:false, why:'a part cannot start or end with a hyphen' };
  }
  if(/^..--/.test(sld) && !/^xn--/.test(sld))
    return { ok:false, why:'two hyphens in positions 3 and 4 are reserved' };
  return { ok:true, name:n, sld, tld: tldOf(n) };
}

function get(url, timeout){
  return new Promise((resolve,reject)=>{
    let done=false;
    const req = https.get(url, { headers:{ 'User-Agent':UA, 'Accept':'application/rdap+json, application/json' } }, res=>{
      /* follow one redirect — the IANA resolver uses them */
      if([301,302,303,307,308].includes(res.statusCode) && res.headers.location){
        res.resume();
        if(done) return; done=true;
        return get(res.headers.location, timeout).then(resolve,reject);
      }
      let b=''; res.on('data',c=>{ b+=c; if(b.length>200000) req.destroy(); });
      res.on('end',()=>{ if(done) return; done=true; resolve({ status:res.statusCode, body:b }); });
    });
    req.setTimeout(timeout||9000, ()=>{ req.destroy(new Error('RDAP timed out')); });
    req.on('error',e=>{ if(done) return; done=true; reject(e); });
  });
}

/* THE CHECK. Returns a verdict that never guesses:
     AVAILABLE  — registry returned 404, the name is genuinely unregistered
     TAKEN      — registry returned 200 with a record
     UNKNOWN    — anything else. Never reported as available. */
async function check(name, timeout){
  const v = validate(name);
  if(!v.ok) return { name:String(name), status:'INVALID', why:v.why, price:null };

  const base = RDAP[v.tld] || FALLBACK;
  const url = base.replace(/\/$/,'') + '/domain/' + encodeURIComponent(v.name);
  const t0 = Date.now();
  let r;
  try{ r = await get(url, timeout); }
  catch(e){
    return { name:v.name, tld:v.tld, status:'UNKNOWN',
      why:`could not reach the ${v.tld} registry (${e.message}) — this is NOT the same as available`,
      ms:Date.now()-t0, price:priceOf(v.name) };
  }
  const ms = Date.now()-t0;
  const price = priceOf(v.name);

  if(r.status === 404)
    return { name:v.name, tld:v.tld, status:'AVAILABLE', ms, price,
             source:'RDAP '+new URL(base).hostname };
  if(r.status === 200){
    let d={}; try{ d = JSON.parse(r.body); }catch(e){}
    const ev = {}; (d.events||[]).forEach(e=>{ ev[e.eventAction]=e.eventDate; });
    let registrar = '';
    for(const en of (d.entities||[])){
      if((en.roles||[]).includes('registrar') && en.vcardArray){
        const fn = (en.vcardArray[1]||[]).find(x=>x[0]==='fn');
        if(fn) registrar = fn[3];
      }
    }
    return { name:v.name, tld:v.tld, status:'TAKEN', ms, price,
      registered: ev.registration || null, expires: ev.expiration || null,
      registrar: registrar || null,
      locked: (d.status||[]).some(s=>/prohibited/i.test(s)),
      source:'RDAP '+new URL(base).hostname };
  }
  if(r.status === 429)
    return { name:v.name, tld:v.tld, status:'UNKNOWN', ms, price,
      why:'the registry rate-limited this check — slow down and retry' };
  return { name:v.name, tld:v.tld, status:'UNKNOWN', ms, price,
    why:`registry replied HTTP ${r.status} — treat as unknown, never as available` };
}

/* Check many, politely. Registries will throttle a burst, and a throttled
   check that reads as UNKNOWN is useless. Small batches, small gap. */
async function checkMany(names, opts){
  opts = opts || {};
  const lane = Math.min(4, Math.max(1, opts.lanes||3));
  const gap  = opts.gap==null ? 250 : opts.gap;
  const out = [];
  const q = names.slice(0, opts.cap || 60);
  while(q.length){
    const batch = q.splice(0, lane);
    const rs = await Promise.all(batch.map(n=>check(n, opts.timeout)));
    out.push(...rs);
    if(q.length && gap) await new Promise(r=>setTimeout(r, gap));
  }
  return out;
}

/* Expand a bare word across a set of extensions. */
function expand(sld, tlds){
  const clean = String(sld||'').toLowerCase().trim()
    .replace(/[^a-z0-9- ]/g,'').replace(/\s+/g,'').replace(/^-+|-+$/g,'');
  if(!clean) return [];
  return (tlds && tlds.length ? tlds : ['in','com','co.in','net','org','xyz'])
    .map(t=>clean+'.'+String(t).replace(/^\./,''));
}

module.exports = { check, checkMany, validate, expand, tldOf, priceOf,
                   RDAP, PRICES, PRICE_ASOF };

return module.exports; })();

__M['factory'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* ==========================================================================
   FACTORY — turns an approved idea into a real, complete business asset pack.

   Zero dependencies. node:zlib for ZIP deflate, everything else is string work.

   The important design decision in this file: THE AI DOES NOT DESIGN ANYTHING.
   The AI writes copy, prices, policy text and app logic. The layout, the CSS,
   the typography scale, the header, the footer, the legal block — all of that
   is hand-written here, once, like a real studio's house style. That is the
   difference between a site that looks generated and a site that looks like a
   small firm paid someone to build it.
   ========================================================================== */
const zlib = require('zlib');

/* ---------------------------------------------------------------- ZIP ----
   Minimal but spec-correct ZIP (deflate, no encryption, no zip64).
   Verified against `unzip -t`. */
function crc32(buf){
  let c, t = crc32.T;
  if(!t){ t = crc32.T = [];
    for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } }
  let crc = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) crc = (crc>>>8) ^ t[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosTime(d){
  return ((d.getHours()<<11) | (d.getMinutes()<<5) | (Math.floor(d.getSeconds()/2))) & 0xFFFF;
}
function dosDate(d){
  return (((d.getFullYear()-1980)<<9) | ((d.getMonth()+1)<<5) | d.getDate()) & 0xFFFF;
}
/* files: [{name, data:Buffer|string}] */
function zip(files, when){
  const d = when || new Date();
  const t = dosTime(d), dt = dosDate(d);
  const locals = [], central = [];
  let offset = 0;

  for(const f of files){
    const name = Buffer.from(f.name, 'utf8');
    const raw  = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8');
    const comp = zlib.deflateRawSync(raw, { level: 9 });
    const use  = comp.length < raw.length ? comp : raw;
    const method = use === comp ? 8 : 0;
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);            /* version needed */
    lh.writeUInt16LE(0x0800, 6);        /* UTF-8 names */
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(t, 10); lh.writeUInt16LE(dt, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(use.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, use);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(t, 12); ch.writeUInt16LE(dt, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(use.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(0, 38);            /* external attrs */
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += 30 + name.length + use.length;
  }

  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ------------------------------------------------------- REALNESS AUDIT ----
   Everything below is a phrase, pattern or habit that makes a reader think
   "a machine wrote this". Each one is a real tell seen in generated sites. */
const TELLS = [
  [/\bunlock (the|your) (power|potential)\b/i, 'Marketing filler: "unlock the power"'],
  [/\bin today'?s (fast[- ]paced|digital|modern) world\b/i, 'Essay opener: "in today\'s ... world"'],
  [/\brevolution(ary|ise|ize|ising|izing)\b/i, 'Overclaim: "revolutionary"'],
  [/\bgame[- ]chang(er|ing)\b/i, 'Cliché: "game-changer"'],
  [/\bseamless(ly)?\b/i, 'Filler adjective: "seamless"'],
  [/\bcutting[- ]edge\b/i, 'Filler adjective: "cutting-edge"'],
  [/\bstate[- ]of[- ]the[- ]art\b/i, 'Filler adjective: "state-of-the-art"'],
  [/\bempower(s|ing|ed)?\b/i, 'Filler verb: "empower"'],
  [/\bharness(es|ing)?\b/i, 'Filler verb: "harness"'],
  [/\belevate your\b/i, 'Filler: "elevate your"'],
  [/\btake .{0,20} to the next level\b/i, 'Cliché: "to the next level"'],
  [/\bwe (are )?(pride ourselves|take pride)\b/i, 'Generic about-us filler'],
  [/\bjourney\b/i, 'Overused word: "journey"'],
  [/\bdelve\b/i, 'Model tell: "delve"'],
  [/\btapestry\b/i, 'Model tell: "tapestry"'],
  [/\btestament to\b/i, 'Model tell: "a testament to"'],
  [/\bAI[- ](powered|driven|enabled)\b/i, 'Says AI-powered — buyers discount it, and it is not the selling point'],
  [/\bpowered by (AI|artificial intelligence|GPT|LLM)\b/i, 'Advertises the AI instead of the outcome'],
  [/\bLorem ipsum\b/i, 'Placeholder text left in'],
  [/\[(insert|your [a-z ]+ here|placeholder)/i, 'Unfilled placeholder bracket'],
  [/\bexample\.com\b/i, 'example.com left in'],
  [/\bjohn doe\b/i, 'Fake person name'],
  [/\b(10,?000|thousands of|millions of) (happy )?(customers|users|clients)\b/i, 'FABRICATED SOCIAL PROOF — this gets you caught'],
  [/\btrusted by \d/i, 'FABRICATED SOCIAL PROOF — "trusted by N"'],
  [/★{3,}|⭐{2,}/, 'Fake star ratings'],
  [/\b\d{2,3}% (of|increase|faster|more)\b/i, 'Unsourced statistic — verify or delete'],
  [/linear-gradient\(\s*(?:to [a-z ]+|\d+deg)\s*,\s*#?[0-9a-f]{3,8}\s*,\s*#?[0-9a-f]{3,8}\s*\)/i,
   'Two-stop purple-era gradient — the single strongest "AI template" signal'],
  [/font-family:\s*['"]?(Inter|Poppins|Montserrat)/i, 'Default generated-site typeface'],
  [/🚀|✨|💡|🔥|🎯|💪|🌟/, 'Emoji in body copy — reads as a bot, not a firm'],
];
function audit(text){
  const hits = [];
  for(const [re, why] of TELLS){
    const m = String(text).match(re);
    if(m) hits.push({ found: String(m[0]).slice(0, 60), why });
  }
  return hits;
}

/* --------------------------------------------------------- DESIGN SYSTEM ----
   Hand-written house style. Restrained, print-influenced, the way a small
   professional firm's site actually looks. Palette is derived, not random. */
const FONTSTACKS = [
  `Georgia, 'Times New Roman', serif`,
  `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`,
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  `'Charter', 'Bitstream Charter', Cambria, Georgia, serif`,
];
function hexOk(h, fb){ return /^#[0-9a-fA-F]{6}$/.test(String(h||'')) ? h : fb; }

function css(id){
  const ink   = hexOk(id.ink,   '#1A1A18');
  const brand = hexOk(id.brand, '#1F3A5F');
  const paper = hexOk(id.paper, '#FCFBF7');
  const rule  = hexOk(id.rule,  '#DDD9CF');
  const head  = FONTSTACKS[(id.fontIndex|0) % FONTSTACKS.length];
  const body  = (id.fontIndex|0) % 2 === 0
    ? `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`
    : `Georgia, 'Times New Roman', serif`;
  return `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:${paper};color:${ink};font:16px/1.65 ${body};
  -webkit-font-smoothing:antialiased}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
a{color:${brand}}
a:hover{color:${ink}}
h1,h2,h3,h4{font-family:${head};font-weight:600;line-height:1.22;margin:0 0 .5em;letter-spacing:-.01em}
h1{font-size:34px}h2{font-size:24px;margin-top:2em}h3{font-size:18px;margin-top:1.6em}
p{margin:0 0 1.05em}
ul,ol{margin:0 0 1.1em;padding-left:20px}li{margin:.35em 0}
hr{border:0;border-top:1px solid ${rule};margin:34px 0}
small,.small{font-size:13.5px;color:#6B675E}

header.site{border-bottom:1px solid ${rule};background:${paper};position:sticky;top:0;z-index:20}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;
  gap:16px;min-height:64px;flex-wrap:wrap}
.brandmark{display:flex;align-items:center;gap:10px;text-decoration:none;color:${ink}}
.brandmark span{font-family:${head};font-size:18px;font-weight:600;letter-spacing:-.01em}
nav.site a{display:inline-block;margin-left:20px;font-size:14.5px;text-decoration:none;
  color:#4A463E;padding:6px 0;border-bottom:2px solid transparent}
nav.site a:hover{color:${ink};border-bottom-color:${brand}}
nav.site a.on{color:${ink};border-bottom-color:${brand}}

.hero{padding:56px 0 40px;border-bottom:1px solid ${rule}}
.hero h1{max-width:19ch}
.lede{font-size:19px;line-height:1.55;max-width:60ch;color:#3A362E}
section{padding:38px 0;border-bottom:1px solid ${rule}}
section:last-of-type{border-bottom:0}

.btn{display:inline-block;background:${brand};color:#fff;text-decoration:none;
  padding:12px 22px;border-radius:3px;font-size:15px;font-weight:600;border:1px solid ${brand}}
.btn:hover{background:${ink};border-color:${ink};color:#fff}
.btn.ghost{background:transparent;color:${brand}}
.btn.ghost:hover{background:${brand};color:#fff}
.actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:22px}

.cols{display:grid;gap:26px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.card{border:1px solid ${rule};border-radius:4px;padding:20px;background:#fff}
.card h3{margin-top:0}

table.plain{width:100%;border-collapse:collapse;font-size:15px}
table.plain th,table.plain td{text-align:left;padding:10px 12px;border-bottom:1px solid ${rule};vertical-align:top}
table.plain th{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#6B675E;font-weight:600}

.price{border:1px solid ${rule};border-radius:4px;padding:24px;background:#fff;display:flex;flex-direction:column}
.price.pick{border-color:${brand};border-width:2px}
.price .amt{font-family:${head};font-size:30px;font-weight:600;margin:6px 0 2px}
.price ul{list-style:none;padding:0;margin:14px 0 20px;font-size:15px}
.price li{padding:6px 0 6px 20px;position:relative;border-bottom:1px solid #F0EDE5}
.price li::before{content:'—';position:absolute;left:0;color:#9A958A}
.price .btn{margin-top:auto;text-align:center}

dl.faq dt{font-weight:600;margin-top:18px}
dl.faq dd{margin:6px 0 0;color:#3A362E}

footer.site{background:#fff;border-top:1px solid ${rule};margin-top:0;padding:30px 0 40px;font-size:14px;color:#5A564D}
footer.site .fcols{display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:22px}
footer.site a{color:#5A564D;text-decoration:none;display:block;padding:3px 0}
footer.site a:hover{color:${ink};text-decoration:underline}
footer.site .legal{border-top:1px solid ${rule};padding-top:16px;font-size:12.5px;color:#807B71}

.notice{border-left:3px solid ${brand};background:#fff;padding:14px 18px;margin:22px 0;font-size:15px}
@media(max-width:700px){
  h1{font-size:27px}h2{font-size:21px}.hero{padding:38px 0 30px}
  .lede{font-size:17px}
  nav.site{width:100%;overflow-x:auto;white-space:nowrap}
  nav.site a{margin:0 18px 0 0}
  header.site .wrap{padding-top:10px;padding-bottom:6px}
}
@media print{header.site,footer.site nav,.actions{display:none}body{background:#fff}}`;
}

/* Simple, non-generated wordmark: initials in a ruled box. No AI-looking
   swooshes, no gradient blobs. Scales cleanly and prints. */
function logoSvg(id){
  const brand = hexOk(id.brand, '#1F3A5F');
  const ini = String(id.name||'B').split(/\s+/).filter(Boolean).slice(0,2)
    .map(w=>w[0].toUpperCase()).join('') || 'B';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34" role="img" aria-label="${esc(id.name||'')}">
<rect x="0.75" y="0.75" width="32.5" height="32.5" rx="2.5" fill="none" stroke="${brand}" stroke-width="1.5"/>
<text x="17" y="17" text-anchor="middle" dominant-baseline="central"
 font-family="Georgia, serif" font-size="${ini.length>1?13:16}" font-weight="600" fill="${brand}">${ini}</text>
</svg>`;
}

function esc(s){ return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const PAGES = [
  ['index.html',   'Home'],
  ['pricing.html', 'Pricing'],
  ['how-it-works.html','How it works'],
  ['about.html',   'About'],
  ['contact.html', 'Contact'],
];
const LEGAL = [
  ['terms.html','Terms of Service'],
  ['privacy.html','Privacy Policy'],
  ['refund.html','Refund & Cancellation'],
  ['shipping.html','Service Delivery'],
];

/* Wrap AI-written <main> content in the house shell. */
function shell(id, file, title, mainHtml, opts){
  opts = opts || {};
  const year = new Date().getFullYear();
  const nav = PAGES.map(([f,l])=>
    `<a href="${f}"${f===file?' class="on"':''}>${esc(l)}</a>`).join('');
  const legalNav = LEGAL.map(([f,l])=>`<a href="${f}">${esc(l)}</a>`).join('');
  const gst = id.gstin ? `<br>GSTIN: ${esc(id.gstin)}` : '';
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}${title===id.name?'':' · '+esc(id.name)}</title>
<meta name="description" content="${esc((opts.desc||id.tagline||'').slice(0,155))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc((opts.desc||id.tagline||'').slice(0,155))}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(logoSvg(id))}">
<style>${css(id)}</style>
</head>
<body>
<header class="site"><div class="wrap">
 <a class="brandmark" href="index.html">${logoSvg(id)}<span>${esc(id.name)}</span></a>
 <nav class="site">${nav}</nav>
</div></header>
<main>
${mainHtml}
</main>
<footer class="site"><div class="wrap">
 <div class="fcols">
  <div><strong>${esc(id.name)}</strong><br>
   <span class="small">${esc(id.tagline||'')}</span></div>
  <div>${PAGES.map(([f,l])=>`<a href="${f}">${esc(l)}</a>`).join('')}</div>
  <div>${legalNav}</div>
  <div><a href="mailto:${esc(id.email)}">${esc(id.email)}</a>
   ${id.phone?`<a href="tel:${esc(String(id.phone).replace(/[^\d+]/g,''))}">${esc(id.phone)}</a>`:''}
   <span class="small">${esc(id.address||'Ludhiana, Punjab, India')}</span></div>
 </div>
 <div class="legal">© ${year} ${esc(id.legalName||id.name)}. ${esc(id.address||'Ludhiana, Punjab, India')}.${gst}<br>
  Prices in Indian Rupees (INR). This is a sole-proprietor business.</div>
</div></footer>
</body>
</html>`;
}

/* README the Owner actually needs — publishing, payments, and what is missing. */
function ownerReadme(id, files, pay){
  const list = files.map(f=>'  ' + f.name).join('\n');
  return `${id.name.toUpperCase()}
${'='.repeat(id.name.length)}

${id.tagline||''}

WHAT IS IN THIS PACK
${list}

PUT THE WEBSITE LIVE (free, about 3 minutes)
  1. Unzip this folder.
  2. Open app.netlify.com/drop in a browser.
  3. Drag the whole "site" folder onto the page.
  4. It is live on a free URL immediately. Copy that URL.
  5. Optional: buy a .in domain (~Rs 700/year) and point it there.
     Do that AFTER the first paying client, not before.

  Cloudflare Pages and GitHub Pages work the same way and are also free.

PAYMENTS
  ${pay ? `Payment links are generated through ${pay.gateway.toUpperCase()} (${pay.live?'LIVE':'TEST MODE'}).
  Every "Pay" button in the site points at a real link. Test one yourself with
  a Rs 1 link before you send it to a client.`
        : `No payment gateway is connected yet, so every "Pay" button is an email
  link instead. Connect Razorpay in the Payments page and rebuild to get real
  buttons. Razorpay needs your PAN, bank account and these four policy pages —
  which is exactly why terms.html, privacy.html, refund.html and shipping.html
  are in this pack. Upload them to your site BEFORE applying, or KYC is refused.`}

WHAT YOU STILL HAVE TO DO YOURSELF
  - Read every page once. If a sentence is not true, delete it. Nothing here
    claims customers you do not have, but you must confirm the promises are
    ones you can keep.
  - Put your real phone number in. A missing phone number kills B2B trust in
    India faster than a bad design.
  - Register the business name only if you need to invoice with GST.

WHAT THIS PACK DOES NOT CONTAIN
  - Customers. A site is a place to send people; it does not find them.
  - Any testimonial, rating, client logo or statistic. All of those were
    deliberately left out because you have not earned them yet and a prospect
    who catches one invented number will not buy anything from you again.
`;
}

module.exports = { zip, crc32, audit, TELLS, css, shell, logoSvg, esc,
                   PAGES, LEGAL, ownerReadme, FONTSTACKS };

return module.exports; })();

__M['llm'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Zero-dependency LLM client. node:https only.
   OpenAI-compatible endpoints — Groq, Google AI Studio, NVIDIA NIM,
   OpenRouter, Cerebras, and local Ollama. All have genuinely free tiers.
   The Owner supplies their own key; nothing is stored in the audit ledger. */
const https = require('https');
const http  = require('http');

const PROVIDERS = {
  custom: {
    label:'Custom — any OpenAI-compatible API', host:'', path:'/v1/chat/completions',
    model:'', custom:true,
    signup:'Paste any base URL that speaks the OpenAI chat format. Works with DeepSeek, Together, Fireworks, Mistral, Perplexity, LM Studio, vLLM, LiteLLM, OpenRouter — and any self-hosted endpoint.' },
  groq: {
    label:'Groq (fastest free tier)', host:'api.groq.com', path:'/openai/v1/chat/completions',
    model:'openai/gpt-oss-120b',
    signup:'console.groq.com — email only, no card. ~14,400 req/day. Models: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b' },
  gemini: {
    label:'Google AI Studio', host:'generativelanguage.googleapis.com',
    path:'/v1beta/openai/chat/completions', model:'gemini-2.0-flash',
    signup:'aistudio.google.com/apikey — no card. Note: prompts may train Google models outside EEA/UK/CH.' },
  nvidia: {
    label:'NVIDIA NIM (120+ models)', host:'integrate.api.nvidia.com',
    path:'/v1/chat/completions', model:'meta/llama-3.3-70b-instruct',
    signup:'build.nvidia.com — email + phone. ~40 req/min, dev use.' },
  openrouter: {
    label:'OpenRouter', host:'openrouter.ai', path:'/api/v1/chat/completions',
    model:'meta-llama/llama-3.3-70b-instruct:free',
    signup:'openrouter.ai/keys — no card. 50 req/day unfunded.' },
  cerebras: {
    label:'Cerebras', host:'api.cerebras.ai', path:'/v1/chat/completions',
    model:'llama-3.3-70b',
    signup:'cloud.cerebras.ai — no card. 1M tokens/day.' },
  ollama: {
    label:'Ollama (local, unlimited, fully private)', host:'127.0.0.1', port:11434,
    path:'/v1/chat/completions', model:'llama3.2', plain:true, nokey:true,
    signup:'ollama.com — install, then: ollama pull llama3.2. No key, no limits, runs offline.' }
};

/* A custom provider carries its own host/path on the config itself, so any
   OpenAI-compatible endpoint works without me hard-coding it. */
function resolve_(cfg){
  const base = PROVIDERS[cfg.provider];
  if(!base) return null;
  if(!base.custom) return base;
  let host = cfg.host || '', path = cfg.path || '/v1/chat/completions', plain = false, port;
  if(/^https?:\/\//i.test(host)){
    try{ const u = new URL(host);
      host = u.hostname; port = u.port || undefined;
      plain = u.protocol === 'http:';
      if(u.pathname && u.pathname !== '/') path = u.pathname.replace(/\/$/,'') + '/chat/completions';
    }catch(e){}
  }
  return Object.assign({}, base, { host, path, plain, port,
    label: 'Custom · ' + (host || 'unset'),
    nokey: !cfg.key });
}

function chat(cfg, messages, opts={}){
  return new Promise((resolve,reject)=>{
    const P = resolve_(cfg);
    if(!P) return reject(new Error('Unknown provider: '+cfg.provider));
    if(P.custom && !P.host) return reject(new Error('Custom provider needs a base URL, e.g. https://api.deepseek.com/v1'));
    if(!P.nokey && !cfg.key) return reject(new Error('No API key configured for '+P.label));

    /* Local models on weak hardware: every token costs real seconds.
       Cap output hard, shrink the context window, and keep the model
       resident in RAM so it is not reloaded from disk on every call. */
    const isLocal = cfg.provider==='ollama';
    const body = JSON.stringify(Object.assign({
      model: cfg.model || P.model,
      messages,
      temperature: opts.temperature!=null?opts.temperature:0.4,
      max_tokens: opts.max_tokens || (isLocal ? 400 : 3000)
    }, isLocal ? {
      keep_alive: '30m',
      options: {
        num_ctx: 2048,        // small context = far less RAM and much faster
        num_thread: 2,        // match the N4500's 2 physical cores
        num_batch: 64,        // smaller batches suit low-memory machines
        top_k: 20,            // less sampling work per token
        repeat_penalty: 1.1
      }
    } : {}));
    const headers = { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) };
    if(!P.nokey) headers['Authorization']='Bearer '+cfg.key;
    if(cfg.provider==='openrouter'){ headers['HTTP-Referer']='http://localhost'; headers['X-Title']='Chairman Agent OS'; }

    const lib = P.plain ? http : https;
    const t0 = Date.now();
    const req = lib.request({ hostname:P.host, port:P.port||(P.plain?80:443),
      path:P.path, method:'POST', headers,
      timeout: opts.timeout || (isLocal ? 300000 : 60000) }, res=>{
      let d='';
      res.on('data',c=>d+=c);
      res.on('end',()=>{
        if(res.statusCode===401||res.statusCode===403)
          return reject(new Error('KEY REJECTED — check the API key for '+P.label));
        if(res.statusCode===429)
          return reject(new Error('RATE LIMITED — free tier quota hit. Wait, or switch provider.'));
        /* Only treat this as a retired model when the PROVIDER is complaining.
           Scanning the whole body for "not found" was a real bug: a perfectly
           good completion that happened to contain the words "not found" —
           e.g. an outreach plan saying "address not found yet" — was reported
           to the Owner as MODEL RETIRED. Diagnose the error envelope, never
           the model's own prose. */
        let errText = '';
        if(res.statusCode>=400){
          errText = d;
        } else {
          try{
            const probe = JSON.parse(d);
            if(probe && probe.error) errText = JSON.stringify(probe.error);
          }catch(e){ /* not JSON — cannot be a structured provider error */ }
        }
        if(res.statusCode===404 || /decommission|deprecat|does not exist|model_not_found|no such model/i.test(errText))
          return reject(new Error('MODEL RETIRED — "'+(cfg.model||P.model)+'" no longer exists on '+P.label+
            '. Press FETCH LIVE MODELS to see what is available today.'));
        if(res.statusCode>=400)
          return reject(new Error('HTTP '+res.statusCode+': '+d.slice(0,220)));
        try{
          const j=JSON.parse(d);
          const c=j.choices&&j.choices[0];
          const text=c&&c.message&&c.message.content;
          if(!text) return reject(new Error('Empty response from model'));
          /* length = the model was cut off mid-sentence. Say so rather than
             handing back half an answer that looks complete. */
          const truncated = c.finish_reason==='length';
          resolve({ text:text.trim()+(truncated
              ? '\n\n[TRUNCATED — the model hit its output limit here. Ask for fewer items, or re-run for the rest.]'
              : ''),
            truncated, ms:Date.now()-t0,
            tokens:(j.usage&&j.usage.total_tokens)||0, model:j.model||cfg.model||P.model });
        }catch(e){ reject(new Error('Bad JSON from provider')); }
      });
    });
    req.on('timeout',()=>{ req.destroy(); reject(new Error(isLocal
      ? 'TIMEOUT — a local model on slow hardware can take minutes. Try a smaller model (qwen2.5:1.5b) or switch to Groq.'
      : 'TIMEOUT — model took too long')); });
    req.on('error',e=>{
      const c = e.code||e.message||'';
      if(cfg.provider==='ollama' && /ECONNREFUSED/.test(c))
        return reject(new Error('OLLAMA NOT RUNNING — start it, or switch provider to Groq. Install: ollama.com'));
      if(/ETIMEDOUT|ETIMEOUT/i.test(c))
        return reject(new Error(isLocal
          ? 'ETIMEDOUT — Ollama did not answer. It may be loading a model too large for this machine, or not running at all.'
          : 'ETIMEDOUT — no reply from '+P.label+'. Usually your internet dropped, or the provider is unreachable. Check your connection and press TEST IT again.'));
      if(/ENOTFOUND|EAI_AGAIN/i.test(c))
        return reject(new Error('NO INTERNET — cannot reach '+P.label+'. Check your connection.'));
      if(/ECONNRESET/i.test(c))
        return reject(new Error('CONNECTION DROPPED mid-request. Try again.'));
      reject(new Error(c));
    });
    req.write(body); req.end();
  });
}

/* Ask the provider what models it actually serves TODAY.
   Providers retire models without warning — this stops a dead default
   from looking like a broken key. */
function listModels(cfg){
  return new Promise((resolve,reject)=>{
    const P = resolve_(cfg);
    if(!P) return reject(new Error('Unknown provider'));
    const path = P.path.replace(/\/chat\/completions$/,'/models');
    const headers = { 'Accept':'application/json' };
    if(!P.nokey) headers['Authorization']='Bearer '+cfg.key;
    const lib = P.plain ? http : https;
    const req = lib.request({ hostname:P.host, port:P.port||(P.plain?80:443),
      path, method:'GET', headers, timeout:20000 }, res=>{
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{
        if(res.statusCode===401||res.statusCode===403) return reject(new Error('KEY REJECTED'));
        if(res.statusCode>=400) return reject(new Error('HTTP '+res.statusCode));
        try{
          const j=JSON.parse(d);
          const ids=(j.data||j.models||[]).map(m=>m.id||m.name).filter(Boolean)
            .filter(id=>!/whisper|tts|orpheus|embed|guard|safeguard/i.test(id)).sort();
          resolve(ids);
        }catch(e){ reject(new Error('Bad JSON')); }
      });
    });
    req.on('timeout',()=>{ req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error',e=>reject(new Error(e.code||e.message)));
    req.end();
  });
}

/* ---------------- FAILOVER ----------------
   Free tiers throttle. Instead of failing the whole job, try the next
   configured provider. The Owner adds spare keys in the AI Brain page;
   nothing is shared between them and each is used only when the one
   before it is exhausted. */
function isQuota(msg){
  return /RATE LIMIT|429|quota|exhaust|too many|capacity/i.test(String(msg));
}

/**
 * cfg    — the primary { provider, key, model }
 * backups— array of the same shape, tried in order on quota errors
 */
async function chatFailover(cfg, backups, messages, opts){
  const chain = [cfg].concat(Array.isArray(backups) ? backups : []).filter(c=>c && c.provider);
  let lastErr = null;
  for(let i=0;i<chain.length;i++){
    const c = chain[i];
    try{
      const r = await chat(c, messages, opts);
      r.usedProvider = c.provider;
      r.usedBackup   = i > 0;
      return r;
    }catch(e){
      lastErr = e;
      /* only slide to the next provider on quota/rate problems — a bad key
         or a retired model should surface immediately, not be masked */
      if(!isQuota(e.message) || i === chain.length-1) throw e;
    }
  }
  throw lastErr || new Error('No provider available');
}

module.exports = { chat, chatFailover, listModels, PROVIDERS };

return module.exports; })();

__M['pay'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Real payment links. Razorpay + Stripe. node:https + crypto only, zero deps.
   Payment Links are used deliberately: they return a URL you can send over
   WhatsApp/email with no frontend integration and no PCI surface. */
const https = require('https');
const crypto = require('crypto');

function req(host, path, method, headers, bodyStr){
  return new Promise((resolve,reject)=>{
    const h = Object.assign({}, headers);
    if(bodyStr) h['Content-Length'] = Buffer.byteLength(bodyStr);
    const r = https.request({hostname:host, path, method, headers:h, timeout:25000}, res=>{
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{
        let j=null; try{ j=JSON.parse(d); }catch(e){}
        if(res.statusCode>=400){
          const msg = (j && (j.error?.description || j.error?.message)) || d.slice(0,200);
          return reject(new Error('HTTP '+res.statusCode+': '+msg));
        }
        resolve(j||{});
      });
    });
    r.on('timeout',()=>{ r.destroy(); reject(new Error('TIMEOUT contacting payment provider')); });
    r.on('error',e=>reject(new Error(e.code||e.message)));
    if(bodyStr) r.write(bodyStr);
    r.end();
  });
}

/* ---------------- RAZORPAY (India: UPI, cards, netbanking) ---------------- */
const RZP = {
  id:'razorpay', label:'Razorpay (India — UPI, cards, netbanking)',
  currency:'INR', minor:100,
  signup:'razorpay.com — needs KYC (PAN + bank account). Test keys work instantly with rzp_test_ prefix.',
  keyHint:'Key ID (rzp_test_... or rzp_live_...) and Key Secret from Settings > API Keys',

  auth(cfg){ return 'Basic '+Buffer.from(cfg.keyId+':'+cfg.keySecret).toString('base64'); },

  async verify(cfg){
    /* cheapest authenticated call that proves the keys work */
    await req('api.razorpay.com','/v1/payments?count=1','GET',
      {'Authorization':this.auth(cfg)});
    return { live: /^rzp_live_/.test(cfg.keyId) };
  },

  async link(cfg, o){
    const body = JSON.stringify({
      amount: Math.round(o.amount * this.minor),
      currency: 'INR',
      description: o.description,
      customer: { name:o.name||'', email:o.email||'', contact:o.phone||'' },
      notify: { sms: !!o.phone, email: !!o.email },
      reminder_enable: true,
      notes: { source:'chairman-agent-os', ref:o.ref||'' },
      callback_method: 'get'
    });
    const j = await req('api.razorpay.com','/v1/payment_links','POST',
      {'Authorization':this.auth(cfg),'Content-Type':'application/json'}, body);
    return { id:j.id, url:j.short_url, status:j.status, amount:o.amount, currency:'INR' };
  },

  async status(cfg, id){
    const j = await req('api.razorpay.com','/v1/payment_links/'+encodeURIComponent(id),'GET',
      {'Authorization':this.auth(cfg)});
    return { status:j.status, paid:(j.amount_paid||0)/this.minor, url:j.short_url };
  },

  /* Verify a webhook actually came from Razorpay before trusting it. */
  verifyWebhook(secret, rawBody, signature){
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try{ return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature||''))); }
    catch(e){ return false; }
  }
};

/* ---------------- STRIPE (international) ---------------- */
const STR = {
  id:'stripe', label:'Stripe (international cards)',
  currency:'USD', minor:100,
  signup:'stripe.com — test keys (sk_test_...) work immediately, no KYC until you go live.',
  keyHint:'Secret key (sk_test_... or sk_live_...) from Developers > API keys',

  form(obj, prefix, out){
    out = out || [];
    for(const [k,v] of Object.entries(obj)){
      if(v===undefined||v===null||v==='') continue;
      const key = prefix ? `${prefix}[${k}]` : k;
      if(typeof v==='object' && !Array.isArray(v)) this.form(v, key, out);
      else if(Array.isArray(v)) v.forEach((x,i)=>{
        if(typeof x==='object') this.form(x, `${key}[${i}]`, out);
        else out.push(encodeURIComponent(`${key}[${i}]`)+'='+encodeURIComponent(x));
      });
      else out.push(encodeURIComponent(key)+'='+encodeURIComponent(v));
    }
    return out;
  },

  async verify(cfg){
    await req('api.stripe.com','/v1/balance','GET',
      {'Authorization':'Bearer '+cfg.keySecret});
    return { live: /^sk_live_/.test(cfg.keySecret) };
  },

  async link(cfg, o){
    const cur = (o.currency||'usd').toLowerCase();
    const priceBody = this.form({
      currency: cur,
      unit_amount: Math.round(o.amount * this.minor),
      'product_data': { name: o.description }
    }).join('&');
    const price = await req('api.stripe.com','/v1/prices','POST',
      {'Authorization':'Bearer '+cfg.keySecret,'Content-Type':'application/x-www-form-urlencoded'}, priceBody);

    const linkBody = this.form({
      line_items: [ { price: price.id, quantity: 1 } ],
      metadata: { source:'chairman-agent-os', ref:o.ref||'' }
    }).join('&');
    const j = await req('api.stripe.com','/v1/payment_links','POST',
      {'Authorization':'Bearer '+cfg.keySecret,'Content-Type':'application/x-www-form-urlencoded'}, linkBody);
    return { id:j.id, url:j.url, status:j.active?'created':'inactive', amount:o.amount, currency:cur.toUpperCase() };
  },

  async status(cfg, id){
    const j = await req('api.stripe.com','/v1/payment_links/'+encodeURIComponent(id),'GET',
      {'Authorization':'Bearer '+cfg.keySecret});
    return { status:j.active?'active':'inactive', paid:0, url:j.url };
  },

  verifyWebhook(secret, rawBody, header){
    /* Stripe-Signature: t=...,v1=... */
    const parts = String(header||'').split(',').reduce((a,p)=>{
      const [k,v]=p.split('='); a[k.trim()]=v; return a; },{});
    if(!parts.t||!parts.v1) return false;
    const signed = parts.t+'.'+rawBody;
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    try{ return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1)); }
    catch(e){ return false; }
  }
};

const GATEWAYS = { razorpay:RZP, stripe:STR };
module.exports = { GATEWAYS };

return module.exports; })();

__M['probe'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Real HTTP/HTTPS uptime probes. node:http(s) only. Cost: $0.00 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Probe a URL. Follows up to 3 redirects. Never throws.
 * returns { ok, status, ms, bytes, err, redirects, ssl }
 */
function probe(target, timeoutMs = 10000, depth = 0) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(target); } catch (e) {
      return resolve({ ok: false, status: 0, ms: 0, bytes: 0, err: 'INVALID_URL', redirects: depth });
    }
    if (!/^https?:$/.test(u.protocol))
      return resolve({ ok: false, status: 0, ms: 0, bytes: 0, err: 'BAD_SCHEME', redirects: depth });

    const lib = u.protocol === 'https:' ? https : http;
    const t0 = Date.now();
    let bytes = 0, done = false;

    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
      path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': 'ChairmanOS-UptimeMarshal/1.0', 'Accept': '*/*', 'Connection': 'close' },
      timeout: timeoutMs
    }, res => {
      const loc = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(res.status || res.statusCode) && loc && depth < 3) {
        res.destroy();
        const next = new URL(loc, u).toString();
        return probe(next, timeoutMs, depth + 1).then(r => {
          if (!done) { done = true; resolve(Object.assign(r, { redirects: r.redirects })); }
        });
      }
      let ssl = null;
      try {
        if (res.socket && res.socket.getPeerCertificate) {
          const c = res.socket.getPeerCertificate();
          if (c && c.valid_to) {
            const days = Math.round((new Date(c.valid_to) - Date.now()) / 86400000);
            ssl = { issuer: (c.issuer && (c.issuer.O || c.issuer.CN)) || '—', days_left: days };
          }
        }
      } catch (e) {}
      res.on('data', d => { bytes += d.length; if (bytes > 400000) res.destroy(); });
      res.on('end', () => {
        if (done) return; done = true;
        const code = res.statusCode;
        resolve({ ok: code >= 200 && code < 400, status: code, ms: Date.now() - t0, bytes, err: null, redirects: depth, ssl });
      });
      res.on('error', () => {
        if (done) return; done = true;
        resolve({ ok: false, status: res.statusCode || 0, ms: Date.now() - t0, bytes, err: 'STREAM_ERROR', redirects: depth, ssl });
      });
    });

    req.on('timeout', () => { req.destroy(); if (!done) { done = true;
      resolve({ ok: false, status: 0, ms: Date.now() - t0, bytes: 0, err: 'TIMEOUT', redirects: depth }); } });
    req.on('error', e => { if (!done) { done = true;
      resolve({ ok: false, status: 0, ms: Date.now() - t0, bytes: 0, err: (e.code || e.message || 'ERROR'), redirects: depth }); } });
    req.end();
  });
}

module.exports = { probe };

return module.exports; })();

__M['research'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Real web research. No API key, no paid search service.
   Uses DuckDuckGo's HTML endpoint and Wikipedia's open API — both free,
   both public. This is genuine outside-world data, not model recall. */
const https = require('https');

function get(host, path, headers){
  return new Promise((resolve,reject)=>{
    const r = https.request({hostname:host, path, method:'GET', timeout:20000,
      headers: Object.assign({
        'User-Agent':'Mozilla/5.0 (compatible; ChairmanOS/1.0)',
        'Accept':'text/html,application/json'
      }, headers||{})}, res=>{
      if([301,302,303,307,308].includes(res.statusCode) && res.headers.location){
        res.destroy();
        try{
          const u=new URL(res.headers.location, 'https://'+host);
          return get(u.hostname, u.pathname+u.search).then(resolve,reject);
        }catch(e){ return reject(new Error('bad redirect')); }
      }
      let d=''; res.on('data',c=>{ d+=c; if(d.length>900000) res.destroy(); });
      res.on('end',()=>resolve(d));
    });
    r.on('timeout',()=>{ r.destroy(); reject(new Error('TIMEOUT')); });
    r.on('error',e=>reject(new Error(e.code||e.message)));
    r.end();
  });
}
const strip = s => String(s).replace(/<[^>]*>/g,' ')
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&nbsp;/g,' ')
  .replace(/\s+/g,' ').trim();

/* Search that works from a datacenter IP.
   DuckDuckGo HTML returns a 202 bot-block when called from cloud hosts
   (Render, Fly, etc), so we fall through a chain of open APIs that do not
   block server traffic. Each is free and needs no key. */
async function search(query, limit){
  limit = limit || 6;
  const out = [];
  const seen = new Set();
  const push = (title, snippet) => {
    const k = (snippet||'').slice(0,50);
    if(!snippet || seen.has(k) || out.length >= limit) return;
    seen.add(k); out.push({ title: title||'', snippet });
  };

  /* 1. DuckDuckGo Instant Answer API — JSON, no bot wall */
  try{
    const j = await get('api.duckduckgo.com',
      '/?q='+encodeURIComponent(query)+'&format=json&no_html=1&skip_disambig=1',
      {'Accept':'application/json'});
    const o = JSON.parse(j);
    if(o.AbstractText) push(o.Heading||'', o.AbstractText);
    (o.RelatedTopics||[]).forEach(t=>{
      if(t.Text) push((t.FirstURL||'').split('/').pop().replace(/_/g,' '), t.Text);
      (t.Topics||[]).forEach(s=>{ if(s.Text) push('', s.Text); });
    });
  }catch(e){}

  /* 2. Hacker News — real people discussing real products and prices.
        Far more useful for market questions than an encyclopedia. */
  if(out.length < limit){
    try{
      const j = await get('hn.algolia.com',
        '/api/v1/search?query='+encodeURIComponent(query)+'&hitsPerPage=6',
        {'Accept':'application/json'});
      const o = JSON.parse(j);
      (o.hits||[]).forEach(h=>{
        const t = h.title || h.story_title;
        const body = (h.story_text||h.comment_text||'').replace(/<[^>]*>/g,' ').trim();
        if(t) push('HN: '+t, body ? body.slice(0,240)
          : `${h.points||0} points, ${h.num_comments||0} comments${h.url?' — '+h.url:''}`);
      });
    }catch(e){}
  }

  /* 3. Wikipedia — only as background, and only if the title is a real
        match. Keyword hits on unrelated articles are worse than nothing. */
  if(out.length < Math.ceil(limit/2)){
    try{
      const j = await get('en.wikipedia.org',
        '/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(query)+
        '&srlimit=4&format=json&origin=*', {'Accept':'application/json'});
      const o = JSON.parse(j);
      const words = query.toLowerCase().split(/\s+/).filter(w=>w.length>3);
      (o.query && o.query.search || []).forEach(r=>{
        const title = r.title.toLowerCase();
        /* keep it only if the article title genuinely relates to the query */
        if(words.some(w=>title.includes(w))) push('WIKI: '+r.title, strip(r.snippet));
      });
    }catch(e){}
  }

  /* 4. last resort: the HTML endpoint, in case we are on a residential IP */
  if(!out.length){
    try{
      const html = await get('html.duckduckgo.com', '/html/?q='+encodeURIComponent(query));
      const re = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while((m = re.exec(html)) && out.length < limit) push(strip(m[1]), strip(m[2]));
    }catch(e){}
  }
  return out;
}

/* Wikipedia summary — stable factual grounding. */
async function wiki(topic){
  try{
    const j = await get('en.wikipedia.org',
      '/api/rest_v1/page/summary/'+encodeURIComponent(topic.replace(/\s+/g,'_')),
      {'Accept':'application/json'});
    const o = JSON.parse(j);
    return o.extract ? { title:o.title, extract:o.extract } : null;
  }catch(e){ return null; }
}

/* Gather evidence for one idea; returns plain text the model can reason over. */
async function gather(topic, region){
  const queries = [
    `${topic} ${region||''} market demand`.trim(),
    `${topic} pricing India`,
    `${topic} competitors problems complaints`
  ];
  const blocks = [];
  for(const q of queries){
    try{
      const r = await search(q, 4);
      if(r.length) blocks.push(`SEARCH "${q}":\n` +
        r.map(x=>`- ${x.title?x.title+' — ':''}${x.snippet}`).join('\n'));
    }catch(e){ blocks.push(`SEARCH "${q}": FAILED (${e.message})`); }
    await new Promise(r=>setTimeout(r, 700));   // be polite, avoid throttling
  }
  const w = await wiki(topic);
  if(w) blocks.push(`WIKIPEDIA "${w.title}": ${w.extract}`);
  return blocks.join('\n\n') || 'NO EVIDENCE RETRIEVED — treat this idea as unvalidated.';
}

/* ---- deep read: pull the actual page text, not just a snippet ---- */
async function readPage(url){
  let u; try{ u=new URL(url); }catch(e){ throw new Error('bad url'); }
  const html = await get(u.hostname, u.pathname+u.search);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi,' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi,' ');
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];
  return { title: strip(title||u.hostname), text: strip(body).slice(0,12000), url };
}

/* ---- open datasets, no key required ---- */
async function openData(query){
  const out=[];
  try{                                   // World Bank indicators
    const j=await get('api.worldbank.org','/v2/country/IND/indicator/NY.GDP.PCAP.CD?format=json&per_page=3');
    const d=JSON.parse(j); if(d&&d[1]&&d[1][0])
      out.push(`WORLD BANK: India GDP per capita ${d[1][0].date} = $${Math.round(d[1][0].value)}`);
  }catch(e){}
  try{                                   // live FX
    const j=await get('api.frankfurter.app','/latest?from=USD&to=INR');
    const d=JSON.parse(j); if(d&&d.rates) out.push(`FX TODAY: 1 USD = ${d.rates.INR} INR (${d.date})`);
  }catch(e){}
  return out.join('\n');
}

/* ---- multi-angle deep research ---- */
async function deepDive(topic, region){
  const angles=[
    `${topic} ${region||''}`.trim(),
    `${topic} pricing cost`,
    `${topic} problems complaints failures`,
    `${topic} competitors alternatives`,
    `${topic} how to start guide`
  ];
  const blocks=[]; const seen=new Set();
  for(const q of angles){
    try{
      const r=await search(q,4);
      const fresh=r.filter(x=>{ const k=x.snippet.slice(0,60); if(seen.has(k))return false; seen.add(k); return true; });
      if(fresh.length) blocks.push(`SEARCH "${q}":\n`+fresh.map(x=>`- ${x.title?x.title+' — ':''}${x.snippet}`).join('\n'));
    }catch(e){}
    await new Promise(r=>setTimeout(r,700));
  }
  const w=await wiki(topic);
  if(w) blocks.push(`WIKIPEDIA "${w.title}": ${w.extract}`);
  const od=await openData(topic);
  if(od) blocks.push('OPEN DATA:\n'+od);
  return blocks.join('\n\n') || 'NO EVIDENCE RETRIEVED';
}

module.exports = { search, wiki, gather, readPage, openData, deepDive };

return module.exports; })();

__M['sandbox'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Sandbox for AI-written capabilities.
   node:vm only. The generated code gets a tiny, curated API and NOTHING else:
   no require, no fs, no process, no child_process, no network of its own.
   Anything it can touch, it touches through the api object we hand in. */
const vm = require('vm');

/* Patterns that must never appear in generated code. Checked BEFORE the
   owner is even shown the proposal, so dangerous code is never offered. */
const BANNED = [
  [/\brequire\s*\(/,            'require() — module loading is forbidden'],
  [/\bprocess\b/,               'process — no access to the host process'],
  [/\bchild_process\b/,         'child_process — shell execution is forbidden'],
  [/\bfs\b\s*\./,               'fs — direct filesystem access is forbidden'],
  [/\beval\s*\(/,               'eval() — nested evaluation is forbidden'],
  [/\bFunction\s*\(/,           'Function() — dynamic code construction is forbidden'],
  [/\bimport\s*\(/,             'import() — dynamic import is forbidden'],
  [/\bglobalThis\b/,            'globalThis — escaping the sandbox is forbidden'],
  [/\bconstructor\s*\[/,        'constructor[...] — prototype escape attempt'],
  [/__proto__|prototype\s*\[/,  'prototype manipulation is forbidden'],
  [/\bBuffer\b/,                'Buffer — raw memory access is forbidden'],
  [/while\s*\(\s*(true|1)\s*\)/,'while(true) — infinite loop'],
  [/for\s*\(\s*;\s*;\s*\)/,     'for(;;) — infinite loop']
];

function scan(code){
  const hits = [];
  for(const [re, why] of BANNED) if(re.test(code)) hits.push(why);
  if(code.length > 6000) hits.push('over 6000 characters — too large to review safely');
  return hits;
}

/**
 * Run AI-written capability code.
 * code — a function BODY. It receives `api` and returns {msg, n, detail}.
 * api  — the curated surface the owner's system chooses to expose.
 */
async function runCapability(code, api, timeoutMs){
  const bad = scan(code);
  if(bad.length) throw new Error('BLOCKED BY SANDBOX: ' + bad.join('; '));

  const sandbox = {
    api,
    result: undefined,
    Math, JSON, Date, String, Number, Boolean, Array, Object,
    isNaN, parseInt, parseFloat,
    console: { log(){}, error(){}, warn(){} }   /* silenced, not removed */
  };
  const ctx = vm.createContext(Object.create(null, Object.getOwnPropertyDescriptors(sandbox)));

  const wrapped = `result = (async function(api){\n${code}\n})(api);`;
  let script;
  try { script = new vm.Script(wrapped, { filename:'capability.js' }); }
  catch(e){ throw new Error('SYNTAX ERROR in generated code: ' + e.message); }

  script.runInContext(ctx, { timeout: Math.min(8000, timeoutMs || 5000) });

  const out = await Promise.race([
    Promise.resolve(ctx.result),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('CAPABILITY TIMED OUT')), timeoutMs || 5000))
  ]);

  if(!out || typeof out !== 'object') throw new Error('Capability returned nothing usable');
  return {
    msg:    String(out.msg || 'ran').slice(0, 300),
    n:      +out.n || 0,
    detail: String(out.detail || '').slice(0, 600)
  };
}

module.exports = { runCapability, scan, BANNED };

return module.exports; })();

__M['smtp'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Zero-dependency SMTP client. node:net + node:tls only. Cost: $0.00 */
const net = require('net');
const tls = require('tls');

function talk(sock, expect, cmd, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const to = setTimeout(() => { cleanup(); reject(new Error('SMTP timeout awaiting ' + expect)); }, timeoutMs);
    function onData(d) {
      buf += d.toString('utf8');
      // wait for a complete final line: "250 text\r\n" (space, not dash)
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return;
      clearTimeout(to); cleanup();
      const code = last.slice(0, 3);
      if (String(code)[0] !== String(expect)[0]) return reject(new Error('SMTP ' + code + ': ' + last.slice(4)));
      resolve(buf);
    }
    function onErr(e) { clearTimeout(to); cleanup(); reject(e); }
    function cleanup() { sock.removeListener('data', onData); sock.removeListener('error', onErr); }
    sock.on('data', onData); sock.on('error', onErr);
    if (cmd !== null && cmd !== undefined) sock.write(cmd + '\r\n');
  });
}

function b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }

function encodeHeader(s) {
  return /[^\x20-\x7E]/.test(s) ? '=?UTF-8?B?' + b64(s) + '?=' : s;
}

/**
 * cfg: { host, port, secure, user, pass, from, name }
 * msg: { to, subject, text }
 */
async function send(cfg, msg) {
  const port = +cfg.port || 587;
  const secure = cfg.secure === true || port === 465;
  const t0 = Date.now();

  /* Never send an IP as SNI — RFC 6066 forbids it, Node warns, and some
     servers abort the handshake. Only set servername for real hostnames. */
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(cfg.host) || cfg.host.includes(':');
  let sock = await new Promise((res, rej) => {
    const opts = { host: cfg.host, port };
    if (!isIp) opts.servername = cfg.host;
    const s = secure ? tls.connect(opts, () => res(s)) : net.connect(opts, () => res(s));
    s.setTimeout(20000, () => { s.destroy(new Error('connect timeout')); });
    s.once('error', rej);
  });

  try {
    await talk(sock, 220, null);
    await talk(sock, 250, 'EHLO chairman-os');

    if (!secure) {
      await talk(sock, 220, 'STARTTLS');
      sock = await new Promise((res, rej) => {
        const topts = { socket: sock };
        if (!isIp) topts.servername = cfg.host;
        const s = tls.connect(topts, () => res(s));
        s.once('error', rej);
      });
      await talk(sock, 250, 'EHLO chairman-os');
    }

    if (cfg.user) {
      await talk(sock, 334, 'AUTH LOGIN');
      await talk(sock, 334, b64(cfg.user));
      await talk(sock, 235, b64(cfg.pass));
    }

    const from = cfg.from || cfg.user;
    await talk(sock, 250, 'MAIL FROM:<' + from + '>');
    await talk(sock, 250, 'RCPT TO:<' + msg.to + '>');
    await talk(sock, 354, 'DATA');

    const body = String(msg.text).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const mid = '<' + Date.now() + '.' + Math.random().toString(36).slice(2) + '@chairman-os>';
    /* HEADERS THAT DECIDE WHETHER A COLD EMAIL LANDS OR IS BINNED.
       Learned the hard way that a technically-valid message is not the same
       as a delivered one:
       - Reply-To: without it, a prospect hitting Reply may answer the
         envelope sender rather than the address you actually read.
       - List-Unsubscribe: spam filters weight this heavily on unsolicited
         B2B mail, and it is legally expected in most jurisdictions. One
         header turns "suspicious cold mail" into "legitimate business mail".
       - X-Chairman-OS was a gift to spam classifiers: a custom header no
         real mail client emits, on every message. Removed. */
    const replyTo = cfg.replyTo || from;
    const headers = [
      'From: ' + encodeHeader(cfg.name || from) + ' <' + from + '>',
      'To: <' + msg.to + '>',
      'Reply-To: <' + replyTo + '>',
      'Subject: ' + encodeHeader(msg.subject),
      'Date: ' + new Date().toUTCString(),
      'Message-ID: ' + mid,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit'
    ];
    if (msg.unsubscribe !== false) {
      headers.push('List-Unsubscribe: <mailto:' + replyTo +
        '?subject=' + encodeURIComponent('Unsubscribe') + '>');
      headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    }
    if (msg.inReplyTo) {
      headers.push('In-Reply-To: ' + msg.inReplyTo);
      headers.push('References: ' + msg.inReplyTo);
    }
    const data = headers.concat(['', body, '', '.']).join('\r\n');

    await talk(sock, 250, data, 30000);
    try { await talk(sock, 221, 'QUIT', 5000); } catch (e) {}
    sock.end();
    return { ok: true, ms: Date.now() - t0, messageId: mid };
  } catch (e) {
    try { sock.destroy(); } catch (x) {}
    throw e;
  }
}

module.exports = { send };

return module.exports; })();

__M['store'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Pluggable persistence. Zero dependencies.
 *
 *   STORE=local   (default) — filesystem. Your PC, VPS, Docker, anything with a disk.
 *   STORE=github            — a private GitHub repo acts as the disk.
 *                             Needed on free hosts (Render free) whose filesystem is
 *                             EPHEMERAL: it is wiped on every restart and redeploy.
 *
 * GitHub mode env vars:
 *   GH_TOKEN  fine-grained PAT with Contents:read+write on ONE private repo
 *   GH_REPO   "youruser/chairman-state"
 *   GH_BRANCH optional, default "main"
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODE = (process.env.STORE || 'local').toLowerCase();

/* ---------------- local ---------------- */
function localStore(dir){
  try { fs.mkdirSync(dir, { recursive:true }); } catch(e){}
  return {
    mode:'local',
    describe:()=>'filesystem · '+dir,
    async read(name){
      try { return fs.readFileSync(path.join(dir,name),'utf8'); } catch(e){ return null; }
    },
    async write(name, text){
      const f=path.join(dir,name), tmp=f+'.tmp';
      fs.writeFileSync(tmp,text); fs.renameSync(tmp,f);
      if(/sessions|CREDENTIALS/.test(name)){ try{ fs.chmodSync(f,0o600); }catch(e){} }
    },
    async remove(name){ try{ fs.unlinkSync(path.join(dir,name)); }catch(e){} }
  };
}

/* ---------------- github ---------------- */
function gh(method, urlPath, token, body){
  return new Promise((resolve,reject)=>{
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname:'api.github.com', path:urlPath, method,
      headers:Object.assign({
        'User-Agent':'ChairmanOS/3',
        'Accept':'application/vnd.github+json',
        'Authorization':'Bearer '+token,
        'X-GitHub-Api-Version':'2022-11-28'
      }, data ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} : {})
    }, res=>{
      let b=''; res.on('data',c=>b+=c);
      res.on('end',()=>{
        if(res.statusCode===404) return resolve(null);
        if(res.statusCode>=400) return reject(new Error('GitHub '+res.statusCode+': '+b.slice(0,180)));
        try{ resolve(JSON.parse(b||'{}')); }catch(e){ resolve({}); }
      });
    });
    req.on('error',reject);
    req.setTimeout(15000,()=>req.destroy(new Error('GitHub API timeout')));
    if(data) req.write(data);
    req.end();
  });
}

function githubStore(){
  const token=process.env.GH_TOKEN, repo=process.env.GH_REPO, branch=process.env.GH_BRANCH||'main';
  if(!token||!repo) throw new Error('STORE=github requires GH_TOKEN and GH_REPO');
  const shas = new Map();
  const cache = new Map();
  const queue = new Map();   // name -> pending text (coalesce rapid writes)
  let flushing=false;

  async function pull(name){
    const r=await gh('GET',`/repos/${repo}/contents/${encodeURIComponent(name)}?ref=${branch}`,token);
    if(!r||!r.content) return null;
    shas.set(name,r.sha);
    return Buffer.from(r.content,'base64').toString('utf8');
  }
  async function push(name,text){
    const body={ message:`chairman-os state ${new Date().toISOString()}`,
      content:Buffer.from(text,'utf8').toString('base64'), branch };
    if(shas.has(name)) body.sha=shas.get(name);
    try{
      const r=await gh('PUT',`/repos/${repo}/contents/${encodeURIComponent(name)}`,token,body);
      if(r&&r.content) shas.set(name,r.content.sha);
    }catch(e){
      if(/409|422/.test(e.message)){        // sha drifted — refetch and retry once
        await pull(name);
        const b2=Object.assign({},body); if(shas.has(name)) b2.sha=shas.get(name);
        const r2=await gh('PUT',`/repos/${repo}/contents/${encodeURIComponent(name)}`,token,b2);
        if(r2&&r2.content) shas.set(name,r2.content.sha);
      } else throw e;
    }
  }
  async function flush(){
    if(flushing) return; flushing=true;
    try{
      while(queue.size){
        const [name,text]=queue.entries().next().value;
        queue.delete(name);
        try{ await push(name,text); }
        catch(e){ console.error('[store] github push failed for',name,'-',e.message); }
      }
    } finally { flushing=false; }
  }

  return {
    mode:'github',
    describe:()=>'github · '+repo+'@'+branch,
    async read(name){
      if(cache.has(name)) return cache.get(name);
      const t=await pull(name); cache.set(name,t); return t;
    },
    async write(name,text){
      cache.set(name,text);
      queue.set(name,text);
      setTimeout(flush,1200);       // debounce: survive bursts, stay far under rate limits
    },
    async remove(name){
      cache.delete(name); queue.delete(name);
      if(!shas.has(name)) await pull(name);
      if(shas.has(name)){
        try{ await gh('DELETE',`/repos/${repo}/contents/${encodeURIComponent(name)}`,token,
          {message:'chairman-os wipe',sha:shas.get(name),branch}); }catch(e){}
        shas.delete(name);
      }
    },
    async verify(){
      const r=await gh('GET',`/repos/${repo}`,token);
      if(!r) throw new Error('repo not found or token lacks access: '+repo);
      if(!r.private) console.warn('[store] WARNING: '+repo+' is PUBLIC. Your state would be world-readable. Make it private now.');
      return { private:r.private, full_name:r.full_name };
    }
  };
}

let store;
if(MODE==='github'){
  store = githubStore();
} else {
  store = localStore(process.env.DATA_DIR || path.join(__dirname,'..'));
}
module.exports = store;

return module.exports; })();

const __ASSETS = {
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgovKiDilZDilZAgQ0hBSVJNQU4gT1MgwrcgTlVNRVJPIOKAlCB0cmVhc3VyeSBsaWdodCB0aGVtZSDilZDilZAgKi8KOnJvb3R7CiAgLyogbGlnaHQgaXMgdGhlIGRlZmF1bHQgbm93ICovCiAgLS1iZzojRUZFQURGOyAtLWJnMjojRTVERkQxOwogIC0tcGFuZWw6I0ZCRjhGMTsKICAtLWdsYXNzOiNGQkY4RjE7CiAgLS1nbGFzczI6I0Y1RjFFNzsKICAtLXN0cm9rZTojREVEN0M3OwogIC0tc3Ryb2tlMjojQzdCRkFCOwogIC0tdHh0OiMxODE1MDk7IC0tZGltOiM2RTY4NTc7IC0tZGltMjojOUM5Njg2OwoKICAtLWxpbWU6Izc4OEExRDsgICAgICAvKiBzaWduYXR1cmUgb2xpdmUtbGltZSAqLwogIC0tbGltZTI6IzhGQTMyNjsKICAtLW9saXZlOiMzOTQ2MDM7ICAgICAvKiBkZWVwIG9saXZlICovCiAgLS1pbms6IzA0MDUwMTsKCiAgLS1jeTojNzg4QTFEOyAtLWJsdTojNUM2RTFBOyAtLWdybjojNEY3QTJBOyAtLWFtYjojQTg4MDFCOwogIC0tbWFnOiNCNDQ0MkE7IC0tcHVyOiM2RTdBM0M7CgogIC0tbW9ubzp1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sIlJvYm90byBNb25vIixtb25vc3BhY2U7CiAgLS1zYW5zOi1hcHBsZS1zeXN0ZW0sQmxpbmtNYWNTeXN0ZW1Gb250LCJTZWdvZSBVSSIsSW50ZXIsUm9ib3RvLHNhbnMtc2VyaWY7CiAgLS1zYnc6MjM4cHg7IC0tcjoxNHB4OwogIC0tc2hhZG93OjAgMXB4IDJweCByZ2JhKDYwLDQ4LDIwLC4wNiksIDAgOHB4IDI0cHggcmdiYSg2MCw0OCwyMCwuMDYpOwogIC0tc2hhZG93MjowIDJweCA2cHggcmdiYSg2MCw0OCwyMCwuMDgpLCAwIDE2cHggNDBweCByZ2JhKDYwLDQ4LDIwLC4xMCk7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXXsKICAtLWJnOiMwQTBCMDY7IC0tYmcyOiMxMDEyMDg7CiAgLS1wYW5lbDojMTUxODBDOyAtLWdsYXNzOiMxNTE4MEM7IC0tZ2xhc3MyOiMxQjFGMEY7CiAgLS1zdHJva2U6IzI1MkExNjsgLS1zdHJva2UyOiMzNzQwMUY7CiAgLS10eHQ6I0YyRjNFQTsgLS1kaW06IzlBOUM4QTsgLS1kaW0yOiM2QTZENUM7CiAgLS1saW1lOiNBM0JCMkI7IC0tbGltZTI6I0I4RDEzNDsKICAtLWN5OiNBM0JCMkI7IC0tYmx1OiM4RkEzMjY7IC0tZ3JuOiM2RkJGNEE7IC0tYW1iOiNEOUE2MkI7CiAgLS1tYWc6I0UzNkI0RTsgLS1wdXI6IzlGQUU1RTsKICAtLXNoYWRvdzowIDFweCAycHggcmdiYSgwLDAsMCwuNCksIDAgOHB4IDI2cHggcmdiYSgwLDAsMCwuMzUpOwogIC0tc2hhZG93MjowIDJweCA4cHggcmdiYSgwLDAsMCwuNSksIDAgMThweCA0NnB4IHJnYmEoMCwwLDAsLjQ1KTsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnR9Cmh0bWwsYm9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMCV9CmJvZHl7CiAgYmFja2dyb3VuZDp2YXIoLS1iZyk7IGNvbG9yOnZhcigtLXR4dCk7CiAgZm9udDoxMy41cHgvMS41NSB2YXIoLS1zYW5zKTsgb3ZlcmZsb3cteDpoaWRkZW47CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMTAwcHggNzAwcHggYXQgODglIC0xNCUsIHJnYmEoMTIwLDEzOCwyOSwuMTMpLCB0cmFuc3BhcmVudCA2MCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDc2MHB4IDUyMHB4IGF0IDQlIDEwNCUsIHJnYmEoMTQwLDExMCw1MCwuMDkpLCB0cmFuc3BhcmVudCA2MiUpOwogIGJhY2tncm91bmQtYXR0YWNobWVudDpmaXhlZDsKfQpidXR0b257Zm9udDppbmhlcml0O2N1cnNvcjpwb2ludGVyO2NvbG9yOmluaGVyaXR9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtmb250OmluaGVyaXR9Ci5oaWRle2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6MTBweDtoZWlnaHQ6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOnZhcigtLXN0cm9rZTIpO2JvcmRlci1yYWRpdXM6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10cmFja3tiYWNrZ3JvdW5kOnRyYW5zcGFyZW50fQoKLyog4pSA4pSAIExPR0lOIC8gSEVSTyDilIDilIAgKi8KI2dhdGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjgwO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1iZyk7CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMDAwcHggNjgwcHggYXQgODQlIC0xMCUsIHJnYmEoMTIwLDEzOCwyOSwuMTYpLCB0cmFuc3BhcmVudCA1OCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDcyMHB4IDUyMHB4IGF0IDYlIDEwMCUsIHJnYmEoMTQwLDExMCw1MCwuMTApLCB0cmFuc3BhcmVudCA2MCUpO30KLnRvcGJhcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMXB4O3BhZGRpbmc6MTVweCAyNHB4O2ZsZXgtd3JhcDp3cmFwOwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9Ci5sb2dve2ZvbnQ6NzAwIDE4cHgvMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjVweH0KLmxvZ28gaXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGx7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyLXJhZGl1czo5OXB4OwogIHBhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzouN3B4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGlsbC5saXZle2JvcmRlci1jb2xvcjpyZ2JhKDEyMCwxMzgsMjksLjM2KTtiYWNrZ3JvdW5kOnJnYmEoMTIwLDEzOCwyOSwuMTApO2NvbG9yOnZhcigtLW9saXZlKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAucGlsbC5saXZle2NvbG9yOnZhcigtLWxpbWUpfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tbGltZSk7CiAgbWFyZ2luLXJpZ2h0OjZweDtib3gtc2hhZG93OjAgMCAwIDNweCByZ2JhKDEyMCwxMzgsMjksLjE4KTthbmltYXRpb246YnAgMnMgaW5maW5pdGV9CkBrZXlmcmFtZXMgYnB7NTAle29wYWNpdHk6LjM1fX0KLmhlcm97bWF4LXdpZHRoOjEyMjBweDttYXJnaW46MCBhdXRvO3BhZGRpbmc6MzRweCAyNHB4IDY4cHh9Ci5oZXJvQ2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoyNHB4OwogIGJveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7cGFkZGluZzpjbGFtcCgyNnB4LDR2dyw1MHB4KTsKICBkaXNwbGF5OmdyaWQ7Z2FwOjM4cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMDVmciAuOTVmcjthbGlnbi1pdGVtczpjZW50ZXJ9CkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpey5oZXJvQ2FyZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDEyMCwxMzgsMjksLjMwKTsKICBjb2xvcjp2YXIoLS1vbGl2ZSk7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS41cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdle2NvbG9yOnZhcigtLWxpbWUpfQpoMS5iaWd7Zm9udDo3MDAgY2xhbXAoMzJweCw1LjZ2dyw1NnB4KS8xLjAyIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0ycHg7bWFyZ2luOjE4cHggMCAxNnB4fQpoMS5iaWcgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tbGltZSl9Ci5sZWRle2NvbG9yOnZhcigtLWRpbSk7Zm9udDoxNXB4LzEuNyB2YXIoLS1zYW5zKTttYXgtd2lkdGg6NTJjaDttYXJnaW46MCAwIDI2cHh9Ci5zdGF0Um93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgxNDRweCwxZnIpKTtnYXA6MTJweH0KLnN0YXR7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxNXB4IDE3cHg7dHJhbnNpdGlvbjouMnN9Ci5zdGF0OmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1saW1lKTtib3gtc2hhZG93OnZhcigtLXNoYWRvdyl9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjRweC8xLjE1IHZhcigtLXNhbnMpO21hcmdpbjo3cHggMCAzcHg7bGV0dGVyLXNwYWNpbmc6LTFweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubG9naW5Cb3h7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgNHB4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLW9saXZlKTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubG9naW5Cb3ggaDN7Y29sb3I6dmFyKC0tbGltZSl9Ci5sb2dpbkJveCAuc2J7Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTAuNXB4O21hcmdpbi1ib3R0b206MThweDtsZXR0ZXItc3BhY2luZzouNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZXJye2NvbG9yOnZhcigtLW1hZyk7Zm9udC1zaXplOjExLjVweDttaW4taGVpZ2h0OjE2cHg7bWFyZ2luLXRvcDo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci53YXJuYm94e2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1hbWIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4wOCk7cGFkZGluZzoxMXB4IDE0cHg7CiAgYm9yZGVyLXJhZGl1czowIDEycHggMTJweCAwO2ZvbnQtc2l6ZToxMS41cHg7Y29sb3I6IzZCNTQxMDttYXJnaW4tYm90dG9tOjE1cHg7bGluZS1oZWlnaHQ6MS42fQpbZGF0YS10aGVtZT0iZGFyayJdIC53YXJuYm94e2NvbG9yOiNFMEMyNzF9Ci5waWxsYXJze21heC13aWR0aDoxMjIwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjAgMjRweCA4MHB4fQoucGlsbGFycyBoMnt0ZXh0LWFsaWduOmNlbnRlcjtmb250OjcwMCBjbGFtcCgyM3B4LDMuNHZ3LDM0cHgpLzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS4xcHg7bWFyZ2luOjAgMCAxMHB4fQoucGlsbGFycyBoMiBlbXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGxhcnMgLnN1Ynt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTMuNXB4LzEuNiB2YXIoLS1zYW5zKTttYXJnaW46MCAwIDMwcHh9Ci5wZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE2cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjE0cHgsMWZyKSl9Ci5wY2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MjBweDt0cmFuc2l0aW9uOi4yMnN9Ci5wY2FyZDpob3Zlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNHB4KTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLnBjYXJkIHV7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC1zaXplOjkuNXB4O2xldHRlci1zcGFjaW5nOjEuNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGNhcmQgaDR7bWFyZ2luOjEwcHggMDtmb250OjcwMCAxNS41cHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0uM3B4fQoucGNhcmQgcHttYXJnaW46MCAwIDEzcHg7Y29sb3I6dmFyKC0tZGltKTtmb250OjEycHgvMS42NSB2YXIoLS1zYW5zKX0KLmNoaXB7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtjb2xvcjp2YXIoLS1kaW0pOwogIGJvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEwcHg7bWFyZ2luOjAgNXB4IDVweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoKLyog4pSA4pSAIFNIRUxMIOKUgOKUgCAqLwojYXBwe2Rpc3BsYXk6ZmxleDttaW4taGVpZ2h0OjEwMHZofQphc2lkZXt3aWR0aDp2YXIoLS1zYncpO2ZsZXg6MCAwIHZhcigtLXNidyk7cG9zaXRpb246c3RpY2t5O3RvcDowO2hlaWdodDoxMDB2aDt6LWluZGV4OjQwOwogIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCB2YXIoLS1zdHJva2UpfQouYWJyYW5ke3BhZGRpbmc6MThweCAxNnB4IDE2cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtkaXNwbGF5OmZsZXg7Z2FwOjExcHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6MTBweDtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxNXB4OwogIGJhY2tncm91bmQ6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtib3gtc2hhZG93OjAgNHB4IDEycHggcmdiYSgxMjAsMTM4LDI5LC4zMCl9Ci5hYnJhbmQgYntmb250OjcwMCAxM3B4LzEuMjUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LjJweDtkaXNwbGF5OmJsb2NrfQouYWJyYW5kIHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjguNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQphc2lkZSBuYXZ7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjEycHggMTJweCAxOHB4fQouZ3Jwe2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjhweDtwYWRkaW5nOjE2cHggMTBweCA3cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBjb2xvcjp2YXIoLS1kaW0pO3BhZGRpbmc6OXB4IDEycHg7Ym9yZGVyLXJhZGl1czoxMHB4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTIuNXB4OwogIHRyYW5zaXRpb246LjE1czttYXJnaW4tYm90dG9tOjJweH0KYXNpZGUgbmF2IGJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Y29sb3I6dmFyKC0tdHh0KX0KYXNpZGUgbmF2IGJ1dHRvbi5vbntiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NjAwOwogIGJveC1zaGFkb3c6MCAzcHggMTBweCByZ2JhKDEyMCwxMzgsMjksLjI4KX0KYXNpZGUgbmF2IGJ1dHRvbiBpe2ZvbnQtc3R5bGU6bm9ybWFsO3dpZHRoOjE2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHh9Ci5hZm9vdHtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6MTRweCAxNnB4O2ZvbnQtc2l6ZToxMC41cHg7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Cm1haW57ZmxleDoxO21pbi13aWR0aDowO3BhZGRpbmc6MjJweCBjbGFtcCgxNnB4LDIuNnZ3LDMycHgpIDk2cHh9Ci5tdG9we2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjExcHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbToyMnB4fQouY3J1bWJ7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjExLjVweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmNydW1iIGJ7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC13ZWlnaHQ6NjAwfQoubXRvcCAuc3B7ZmxleDoxfQojYnVyZ2Vye2Rpc3BsYXk6bm9uZX0KI3RoZW1lQnRue2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjExcHh9CiN0aGVtZUJ0bjpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6dmFyKC0tbGltZSl9CkBtZWRpYShtYXgtd2lkdGg6ODYwcHgpewogIGFzaWRle3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwJSk7dHJhbnNpdGlvbjouMjRzO2JveC1zaGFkb3c6MCAwIDYwcHggcmdiYSg2MCw0OCwyMCwuMjgpfQogIGFzaWRlLm9wZW57dHJhbnNmb3JtOm5vbmV9CiAgI3Njcmlte3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDQ1LDM4LDE4LC4zNCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KTt6LWluZGV4OjM1fQogICNidXJnZXJ7ZGlzcGxheTppbmxpbmUtZmxleH0KICBtYWlue3BhZGRpbmctYm90dG9tOjExMHB4fQp9CgovKiDilIDilIAgUFJJTUlUSVZFUyDilIDilIAgKi8KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcGFkZGluZzoxOHB4IDIwcHg7bWFyZ2luLWJvdHRvbToxNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KTt0cmFuc2l0aW9uOi4yc30KLmNhcmQ6aG92ZXJ7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLmNhcmQ+aDN7bWFyZ2luOjAgMCAxNHB4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7Y29sb3I6dmFyKC0tZGltKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE0cHh9Ci5nMntncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyOTJweCwxZnIpKX0KLmcze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDIwOHB4LDFmcikpfQouZzR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTYycHgsMWZyKSl9Ci5rcGl7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjE3cHggMThweDsKICB0cmFuc2l0aW9uOi4ycztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5rcGk6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3RvcDowO2JvdHRvbTowO3dpZHRoOjNweDtiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO29wYWNpdHk6Ljg1fQoua3BpOmhvdmVye3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0ycHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpfQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyN3B4LzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS40cHh9Ci5rcGkgdXtkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjNweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5rcGkgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi10b3A6NXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRue2JhY2tncm91bmQ6dmFyKC0tcGFuZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7cGFkZGluZzo5cHggMTVweDtib3JkZXItcmFkaXVzOjEwcHg7CiAgZm9udC1zaXplOjExLjVweDt0cmFuc2l0aW9uOi4xNnM7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5idG46aG92ZXJ7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUpO2NvbG9yOnZhcigtLWxpbWUpfQouYnRuLnB7YmFja2dyb3VuZDp2YXIoLS1saW1lKTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo3MDA7CiAgYm94LXNoYWRvdzowIDNweCAxMHB4IHJnYmEoMTIwLDEzOCwyOSwuMjYpfQouYnRuLnA6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1saW1lMik7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUyKTtjb2xvcjojZmZmO2JveC1zaGFkb3c6MCA1cHggMTZweCByZ2JhKDEyMCwxMzgsMjksLjM0KX0KLmJ0bi5va3tiYWNrZ3JvdW5kOnJnYmEoNzksMTIyLDQyLC4xMCk7Ym9yZGVyLWNvbG9yOnJnYmEoNzksMTIyLDQyLC4zNCk7Y29sb3I6dmFyKC0tZ3JuKX0KLmJ0bi5ub3tiYWNrZ3JvdW5kOnJnYmEoMTgwLDY4LDQyLC4wOSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTgwLDY4LDQyLC4zMCk7Y29sb3I6dmFyKC0tbWFnKX0KLmJ0bi5zbXtwYWRkaW5nOjZweCAxMXB4O2ZvbnQtc2l6ZToxMC41cHg7Ym9yZGVyLXJhZGl1czo4cHh9Ci5idG46ZGlzYWJsZWR7b3BhY2l0eTouNDtjdXJzb3I6bm90LWFsbG93ZWQ7dHJhbnNmb3JtOm5vbmV9Ci5yb3d7ZGlzcGxheTpmbGV4O2dhcDo5cHg7ZmxleC13cmFwOndyYXA7YWxpZ24taXRlbXM6Y2VudGVyfQpsYWJlbC5me2Rpc3BsYXk6YmxvY2s7bWFyZ2luLWJvdHRvbToxM3B4fQpsYWJlbC5mPnNwYW57ZGlzcGxheTpibG9jaztmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS4ycHg7Y29sb3I6dmFyKC0tZGltKTttYXJnaW4tYm90dG9tOjZweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5pbnt3aWR0aDoxMDAlO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO2NvbG9yOnZhcigtLXR4dCk7CiAgcGFkZGluZzoxMHB4IDEzcHg7Ym9yZGVyLXJhZGl1czoxMHB4O291dGxpbmU6bm9uZTt0cmFuc2l0aW9uOi4xNnN9Ci5pbjpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxMjAsMTM4LDI5LC4xNCk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9CnRleHRhcmVhLmlue21pbi1oZWlnaHQ6NzRweDtyZXNpemU6dmVydGljYWw7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyl9CnRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4fQp0aHt0ZXh0LWFsaWduOmxlZnQ7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjJweDtwYWRkaW5nOjEwcHggOXB4OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CnRke3BhZGRpbmc6MTFweCA5cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9CnRyOmhvdmVyIHRke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLnR3e292ZXJmbG93LXg6YXV0bztib3JkZXItcmFkaXVzOjEwcHh9Ci50YWd7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzozcHggMTBweDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjFweDsKICBib3JkZXI6MXB4IHNvbGlkO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC13ZWlnaHQ6NjAwfQoudC1jeXtjb2xvcjp2YXIoLS1vbGl2ZSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTIwLDEzOCwyOSwuMzQpO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtY3l7Y29sb3I6dmFyKC0tbGltZSl9Ci50LWdybntjb2xvcjojM0U2NTIyO2JvcmRlci1jb2xvcjpyZ2JhKDc5LDEyMiw0MiwuMzIpO2JhY2tncm91bmQ6cmdiYSg3OSwxMjIsNDIsLjExKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1ncm57Y29sb3I6IzdGRDA1QX0KLnQtYW1ie2NvbG9yOiM4QTY3MTI7Ym9yZGVyLWNvbG9yOnJnYmEoMTY4LDEyOCwyNywuMzIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtYW1ie2NvbG9yOiNFMEI1NEF9Ci50LXJlZHtjb2xvcjojOUIzQTIzO2JvcmRlci1jb2xvcjpyZ2JhKDE4MCw2OCw0MiwuMzApO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1yZWR7Y29sb3I6I0YwODY2Qn0KLnQtYmx1e2NvbG9yOiM0QTVBMTU7Ym9yZGVyLWNvbG9yOnJnYmEoOTIsMTEwLDI2LC4zMCk7YmFja2dyb3VuZDpyZ2JhKDkyLDExMCwyNiwuMTApfQpbZGF0YS10aGVtZT0iZGFyayJdIC50LWJsdXtjb2xvcjojQThCRTQ1fQoudC1wdXJ7Y29sb3I6IzU2NUYyRTtib3JkZXItY29sb3I6cmdiYSgxMTAsMTIyLDYwLC4zMCk7YmFja2dyb3VuZDpyZ2JhKDExMCwxMjIsNjAsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1wdXJ7Y29sb3I6I0I0QzE3Nn0KLnQtZGlte2NvbG9yOnZhcigtLWRpbSk7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLmJhcntoZWlnaHQ6N3B4O2JhY2tncm91bmQ6dmFyKC0tYmcyKTtib3JkZXItcmFkaXVzOjk5cHg7b3ZlcmZsb3c6aGlkZGVufQouYmFyIGl7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTAwJTtib3JkZXItcmFkaXVzOjk5cHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tb2xpdmUpLHZhcigtLWxpbWUpKTt0cmFuc2l0aW9uOndpZHRoIC41cyBjdWJpYy1iZXppZXIoLjQsMCwuMiwxKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFyIGl7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tbGltZSksdmFyKC0tbGltZTIpKX0KdWwudGlnaHR7bWFyZ2luOjdweCAwIDA7cGFkZGluZy1sZWZ0OjE4cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKX0KdWwudGlnaHQgbGl7bWFyZ2luOjVweCAwfQp1bC50aWdodCBie2NvbG9yOnZhcigtLXR4dCl9CnByZS55YW1se2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTRweDsKICBmb250LXNpemU6MTFweDtvdmVyZmxvdzphdXRvO2NvbG9yOiMzRTRBMTg7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MS42O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQpbZGF0YS10aGVtZT0iZGFyayJdIHByZS55YW1se2NvbG9yOiNCNEMxNzZ9Ci5sb2d7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjExcHg7cGFkZGluZzoxM3B4OwogIG1heC1oZWlnaHQ6MzcwcHg7b3ZlcmZsb3c6YXV0bztmb250LXNpemU6MTFweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxvZyBkaXZ7cGFkZGluZzozcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3doaXRlLXNwYWNlOnByZS13cmFwO3dvcmQtYnJlYWs6YnJlYWstd29yZH0KLmxvZyAudHN7Y29sb3I6dmFyKC0tZGltMil9Ci5tb25vLWRpbXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubW9kYWx7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoNDUsMzgsMTgsLjQyKTt6LWluZGV4OjkwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjE4cHg7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNXB4KX0KLm1ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6NjYwcHg7bWF4LWhlaWdodDo4OHZoO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6MCAyNHB4IDcwcHggcmdiYSg2MCw0OCwyMCwuMjQpfQoubWJveCBoM3ttYXJnaW46MCAwIDZweDtmb250LXNpemU6MTVweDtjb2xvcjp2YXIoLS1vbGl2ZSk7bGV0dGVyLXNwYWNpbmc6LS4ycHg7dGV4dC10cmFuc2Zvcm06bm9uZX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubWJveCBoM3tjb2xvcjp2YXIoLS1saW1lKX0KLmZsYXNoe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JvdHRvbToyNnB4O2JhY2tncm91bmQ6dmFyKC0taW5rKTsKICBjb2xvcjojRjRGNEYwO2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1saW1lKTtwYWRkaW5nOjEzcHggMjFweDtib3JkZXItcmFkaXVzOjEycHg7Zm9udC1zaXplOjEycHg7CiAgei1pbmRleDo5OTttYXgtd2lkdGg6OTB2dztib3gtc2hhZG93OjAgMTRweCA0NHB4IHJnYmEoNjAsNDgsMjAsLjMwKTthbmltYXRpb246ZnUgLjI4c30KQGtleWZyYW1lcyBmdXtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlKC01MCUsMTJweCl9fQoKLyog4pSA4pSAIFJBRElBTCBFTkdJTkUg4pSA4pSAICovCi5lbmdpbmVXcmFwe2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDI1OHB4O2dhcDoxNHB4fQpAbWVkaWEobWF4LXdpZHRoOjEwMDBweCl7LmVuZ2luZVdyYXB7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn19Ci5jYW52YXNCb3h7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO21pbi1oZWlnaHQ6NDQwcHg7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpfQouY2FudmFzQm94IHN2Z3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG87dG91Y2gtYWN0aW9uOnBhbi15fQouZ3JpZGJne3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTtvcGFjaXR5Oi41NTsKICBiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh2YXIoLS1zdHJva2UpIDFweCx0cmFuc3BhcmVudCAxcHgpLAogICAgICAgICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLXN0cm9rZSkgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM0cHggMzRweDsKICBtYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDQwJSx0cmFuc3BhcmVudCA3NiUpOwogIC13ZWJraXQtbWFzay1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSA1MCUsIzAwMCA0MCUsdHJhbnNwYXJlbnQgNzYlKX0KLmVuZ1RvcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjE0cHg7dG9wOjEzcHg7ei1pbmRleDoyO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZW5nVGl0bGV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7dG9wOjE0cHg7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoyOwogIGZvbnQ6NzAwIDEzcHggdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6Mi42cHg7Y29sb3I6dmFyKC0tdHh0KX0KLm5vZGV7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMThzfQoubm9kZTpob3ZlciBjaXJjbGV7ZmlsdGVyOmJyaWdodG5lc3MoMS4xNSl9Ci5zaWRle2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE0cHh9Ci5sZWdlbmQgZGl2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7cGFkZGluZzo0cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxlZ2VuZCBpe3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7ZGlzcGxheTpibG9jaztmbGV4OjAgMCAxMHB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2NnB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6OHB4IDRweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7CiAgdGV4dC1hbGlnbjpsZWZ0O3RyYW5zaXRpb246LjE0cztmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmRpckxpc3QgYnV0dG9uOmhvdmVye2NvbG9yOnZhcigtLWxpbWUpO3BhZGRpbmctbGVmdDo3cHh9Ci5kaXJMaXN0IHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjkuNXB4fQoudGVybXtiYWNrZ3JvdW5kOnZhcigtLWluayk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTFweDtwYWRkaW5nOjE0cHg7CiAgZm9udC1zaXplOjEwLjVweDttYXgtaGVpZ2h0OjE1OHB4O292ZXJmbG93OmF1dG87Y29sb3I6I0I4RDEzNDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KPC9zdHlsZT4KCgo8L2hlYWQ+Cjxib2R5Pgo8IS0tID09PT09PT09PT09PT09PT09IEdBVEUgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImdhdGUiPgogIDxkaXYgY2xhc3M9InRvcGJhciI+CiAgICA8ZGl2IGNsYXNzPSJsb2dvIj5DSEFJUk1BTiA8aT5BR0VOVCBPUzwvaT48L2Rpdj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5TRVJWRVIgTElWRSAmYW1wOyBBVURJVElORzwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIj5aRVJPLVRSVVNUIEFDVElWRTwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVCBET0NUUklORTwvc3Bhbj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iaGVybyI+CiAgICA8ZGl2IGNsYXNzPSJoZXJvQ2FyZCI+CiAgICAgIDxkaXY+CiAgICAgICAgPHNwYW4gY2xhc3M9ImJhZGdlIj5IRUFEIE9GIEFMTCBBR0VOVFM8L3NwYW4+CiAgICAgICAgPGgxIGNsYXNzPSJiaWciPk5PIFNVR0FSIENPQVRJTkcuPGJyPjxlbT5OTyBDT01QUk9NSVNFLjwvZW0+PC9oMT4KICAgICAgICA8cCBjbGFzcz0ibGVkZSI+RXZlcnkgZGV0YWlsIGNoZWNrZWQsIGV2ZXJ5IHN1Yi1hZ2VudCBhdWRpdGVkLCBldmVyeSBlbnRlcnByaXNlIHJlcXVlc3QgZm9yY2VkIHRocm91Z2ggYSBwcmVjaXNlIHBlcm1pc3Npb24gZmxvdy4gTm90aGluZyBwYWlkIGZvciwgZXZlciDigJQgdGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCwgY3JlZGl0IG1ldGVyIGFuZCBzdWJzY3JpcHRpb24gZ2F0ZS48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0ic3RhdFJvdyI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5CYWNrZW5kPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIiBpZD0iaHNVcCI+Q0hFQ0tJTkfigKY8L2I+PHMgaWQ9ImhzTm9kZSI+4oCUPC9zPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdCI+PHU+U2VjdXJpdHkgR2F0ZTwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5MT0NLRUQ8L2I+PHM+U2VydmVyLXNpZGUgc2Vzc2lvbnM8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5Db3N0IENlaWxpbmc8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9iPjxzPjAgZGVwZW5kZW5jaWVzIGluc3RhbGxlZDwvcz48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzPSJsb2dpbkJveCI+CiAgICAgICAgPGgzPk9XTkVSIFBPUlRBTDwvaDM+CiAgICAgICAgPGRpdiBjbGFzcz0ic2IiPkNSWVBUT0dSQVBISUMgQ0xFQVJBTkNFIFJFUVVJUkVEPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9ImJvb3ROb3RlIj5Cb290c3RyYXAgY3JlZGVudGlhbHMgd2VyZSBnZW5lcmF0ZWQgb25jZSBieSB0aGUgc2VydmVyIGFuZCBwcmludGVkIHRvIGl0cyBjb25zb2xlIC8gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIHRoZSBwYXNzd29yZCBpbW1lZGlhdGVseSBhZnRlciBmaXJzdCBsb2dpbi48L2Rpdj4KICAgICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0ibGlJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9InVzZXJuYW1lIj48L2xhYmVsPgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJsaVB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJylkb0xvZ2luKCkiPjwvbGFiZWw+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJkb0xvZ2luKCkiPkFVVEhFTlRJQ0FURTwvYnV0dG9uPgogICAgICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImxpRXJyIj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+U2Vzc2lvbnMgYXJlIGhlbGQgc2VydmVyLXNpZGUgKDhoIFRUTCwgSHR0cE9ubHkgY29va2llKS4gTG9nIGluIGZyb20gYW55IGRldmljZSBvbiB0aGlzIFVSTCDigJQgc3RhdGUgaXMgc2hhcmVkIGxpdmUuPC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9InBpbGxhcnMiPgogICAgPGgyPkNIQUlSTUFOIDxlbT5SQURJQUwgUElMTEFSUzwvZW0+PC9oMj4KICAgIDxwIGNsYXNzPSJzdWIiPkZsb29yLWJ5LWZsb29yIGVudGVycHJpc2UgY29tbWFuZCB3aXRoIGRlZGljYXRlZCBtaXNzaW9uIGxlYWRzIGFuZCBoYXJkIG9wZXJhdGlvbmFsIHNjb3BlLjwvcD4KICAgIDxkaXYgY2xhc3M9InBncmlkIiBpZD0iaGVyb1BpbGxhcnMiPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0gPT09PT09PT09PT09PT09PT0gQVBQID09PT09PT09PT09PT09PT09IC0tPgo8ZGl2IGlkPSJhcHAiIGNsYXNzPSJoaWRlIj4KICA8YXNpZGUgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0iYWJyYW5kIj4KICAgICAgPGRpdiBjbGFzcz0ibWFyayI+4peJPC9kaXY+CiAgICAgIDxkaXY+PGI+Q0hBSVJNQU4gT1M8L2I+PHNwYW4+VjMgwrcgTElWRSBCQUNLRU5EPC9zcGFuPjwvZGl2PgogICAgPC9kaXY+CiAgICA8bmF2IGlkPSJuYXYiPjwvbmF2PgogICAgPGRpdiBjbGFzcz0iYWZvb3QiPgogICAgICA8ZGl2Pk9XTkVSIDxiIGlkPSJ3aG9JZCIgc3R5bGU9ImNvbG9yOnZhcigtLXR4dCkiPjwvYj48L2Rpdj4KICAgICAgPGRpdj5VUFRJTUUgPHNwYW4gaWQ9InVwQ2xvY2siIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7igJQ8L3NwYW4+IMK3IFNQRU5EIDxzcGFuIGlkPSJzcGVuZE1pbmkiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4kMC4wMDwvc3Bhbj48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBzdHlsZT0id2lkdGg6MTAwJTttYXJnaW4tdG9wOjhweCIgb25jbGljaz0ibG9nb3V0KCkiPkxPQ0sgU1lTVEVNPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2FzaWRlPgogIDxtYWluPgogICAgPGRpdiBjbGFzcz0ibXRvcCI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9ImJ1cmdlciIgb25jbGljaz0idG9nZ2xlU2IoKSI+4piwPC9idXR0b24+CiAgICAgIDxkaXYgY2xhc3M9ImNydW1iIj5jaGFpcm1hbi1vcyAvIDxiIGlkPSJjcnVtYiI+aG9tZTwvYj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic3AiPjwvZGl2PgogICAgICA8YnV0dG9uIGlkPSJ0aGVtZUJ0biIgb25jbGljaz0idG9nZ2xlVGhlbWUoKSIgdGl0bGU9IkxpZ2h0IC8gZGFyayI+4peQPC9idXR0b24+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj48c3BhbiBpZD0ic3luY1BpbGwiPlNZTkNFRDwvc3Bhbj48L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0idmlldyI+PC9kaXY+CiAgPC9tYWluPgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSIvYXBwLmpzIj48L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==','base64'),
  'app.js': Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNCNDQ0MkEnLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNBODgwMUInLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzc4OEExRCcsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjNkU3QTNDJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzRGN0EyQScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCihhc3luYyBmdW5jdGlvbigpewogIHBhaW50SGVybygpOwogIHRyeXsKICAgIGNvbnN0IGI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL2Jvb3QnLHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGNvbnN0IHQ9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlJyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCkuY2F0Y2goKCk9Pih7fSkpOwogICAgaHNVcC50ZXh0Q29udGVudD0nT05MSU5FJzsgCiAgICBpZihiLmF1dGhlZCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IFM9ci5zdGF0ZTsgZW50ZXIoKTsgfQogIH1jYXRjaChlKXsgaHNVcC50ZXh0Q29udGVudD0nT0ZGTElORSc7IGhzVXAuc3R5bGUuY29sb3I9J3ZhcigtLW1hZyknOyB9Cn0pKCk7CmZ1bmN0aW9uIHBhaW50SGVybygpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvUGlsbGFycycpLmlubmVySFRNTD1QSUxMQVJTLm1hcChwPT5gPGRpdiBjbGFzcz0icGNhcmQiPgogICA8dT5GTE9PUiAwJHtwLmlkfTwvdT48aDQ+JHtwLmljb259ICR7ZXNjKHAubmFtZSl9PC9oND48cD4ke2VzYyhwLmRlc2MpfTwvcD4KICAgJHtwLmNoaXBzLm1hcChjPT5gPHNwYW4gY2xhc3M9ImNoaXAiPiR7ZXNjKGMpfTwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gKS5qb2luKCcnKTsKfQphc3luYyBmdW5jdGlvbiBkb0xvZ2luKCl7CiAgY29uc3QgZT1saUVycjtlLnRleHRDb250ZW50PScnOwogIHRyeXsKICAgIGF3YWl0IEFQSSgnL2FwaS9sb2dpbicse2lkOmxpSWQudmFsdWUudHJpbSgpLHB3OmxpUHcudmFsdWV9KTsKICAgIGxpUHcudmFsdWU9Jyc7IGVudGVyKCk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZT09PSdBQ0NFU1MgREVOSUVEJz8nQUNDRVNTIERFTklFRC4gQ3JlZGVudGlhbCBtaXNtYXRjaCDigJQgbG9nZ2VkIENSSVQgc2VydmVyLXNpZGUuJzp4Lm1lc3NhZ2U7IH0KfQpmdW5jdGlvbiBlbnRlcigpewogIGdhdGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpOyBhcHAuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpOwogIHdob0lkLnRleHRDb250ZW50PVMub3duZXIuaWQ7IGJ1aWxkTmF2KCk7IGdvKFNJTVBMRT8nZGVzayc6J2hvbWUnKTsgc3RhcnRQb2xsKCk7CiAgaWYoUy5vd25lci5ib290c3RyYXApIHNldFRpbWVvdXQoKCk9PmZsYXNoKCdCT09UU1RSQVAgQ1JFREVOVElBTCBTVElMTCBBQ1RJVkUg4oCUIHJvdGF0ZSBpdCBpbiBPd25lciBTZXR0aW5ncycpLDkwMCk7Cn0KYXN5bmMgZnVuY3Rpb24gbG9nb3V0KCl7IHN0b3BQb2xsKCk7IHRyeXthd2FpdCBmZXRjaCgnL2FwaS9sb2dvdXQnLHttZXRob2Q6J1BPU1QnLGNyZWRlbnRpYWxzOidzYW1lLW9yaWdpbid9KX1jYXRjaChlKXt9IGxvY2F0aW9uLnJlbG9hZCgpIH0KCi8qIC0tLS0tLS0tLS0gbGl2ZSBwb2xsaW5nIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gc3RhcnRQb2xsKCl7IHN0b3BQb2xsKCk7IHBvbGw9c2V0SW50ZXJ2YWwoYXN5bmMoKT0+ewogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlP3NpbmNlPScrUy5yZXYse2NyZWRlbnRpYWxzOidzYW1lLW9yaWdpbid9KSkuanNvbigpOwogICAgaWYoci51bmNoYW5nZWQpeyBTLnRlbGVtZXRyeT1yLnRlbGVtZXRyeTsgUy5mbG9vcnM9ci5mbG9vcnM7IHRpY2tDaHJvbWUoKTsKICAgICAgaWYoY3VyPT09J2hvbWUnfHxjdXI9PT0nYW5hbHl0aWNzJ3x8Y3VyPT09J3N5c3RlbScpIHNvZnRSZWZyZXNoKCk7IHJldHVybjsgfQogICAgaWYoci5zdGF0ZSl7IFM9ci5zdGF0ZTsgdGlja0Nocm9tZSgpOyByZW5kZXIoKTsgc3luY1BpbGwudGV4dENvbnRlbnQ9J1VQREFURUQnOyBzZXRUaW1lb3V0KCgpPT5zeW5jUGlsbC50ZXh0Q29udGVudD0nU1lOQ0VEJywxMjAwKTsgfQogIH1jYXRjaChlKXsgc3luY1BpbGwudGV4dENvbnRlbnQ9J09GRkxJTkUnOyB9Cn0sMzAwMCkgfQpmdW5jdGlvbiBzdG9wUG9sbCgpeyBjbGVhckludGVydmFsKHBvbGwpIH0KZnVuY3Rpb24gdGlja0Nocm9tZSgpewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnk7CiAgdXBDbG9jay50ZXh0Q29udGVudD1oaG1tc3ModC51cHRpbWVfcyk7CiAgc3BlbmRNaW5pLnRleHRDb250ZW50PSckJysoUy5zcGVuZHx8MCkudG9GaXhlZCgyKTsKICBzcGVuZE1pbmkuc3R5bGUuY29sb3I9Uy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknOwp9CmZ1bmN0aW9uIHNvZnRSZWZyZXNoKCl7IGNvbnN0IGVsPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpdmVdJyk7CiAgZWwuZm9yRWFjaChuPT57IGNvbnN0IGY9bi5nZXRBdHRyaWJ1dGUoJ2RhdGEtbGl2ZScpOyB0cnl7IG4uaW5uZXJIVE1MPUxJVkVbZl0oKSB9Y2F0Y2goZSl7fSB9KSB9CmNvbnN0IExJVkU9e307CgovKiAtLS0tLS0tLS0tIG5hdiAtLS0tLS0tLS0tICovCi8qIFNJTVBMRSBNT0RFIGlzIHRoZSBkZWZhdWx0OiBvbmUgcGFnZSB3aGVyZSBoZSBhc2tzLCB5b3UgdGljay4KICAgRXZlcnl0aGluZyBlbHNlIGlzIHN0aWxsIHRoZXJlLCBvbmUgY2xpY2sgYXdheSwgZm9yIHdoZW4geW91IHdhbnQgaXQuICovCmNvbnN0IE5BVl9TSU1QTEU9WwogWycnLFtbJ2Rlc2snLCfil4knLCdUaGUgQ2hhaXJtYW4nXSxbJ2ZhY3RvcnknLCfilqYnLCdCdWlsZCBUaGUgQnVzaW5lc3MnXSxbJ2dyb3d0aCcsJ+KepCcsJ0dldCBDdXN0b21lcnMnXSxbJ2RvbWFpbnMnLCfil40nLCdGaW5kIEEgTmFtZSddLFsndmVudHVyZXMnLCfil4YnLCdJZGVhcyAmIE1vbmV5J10sWydtaXNzaW9ucycsJ+KXjicsJ015IEpvYnMnXSxbJ3dvcmsyJywn4pyJJywnRmlsZXMgJiBXcml0aW5nJ10sWydhcmNoJywn4qeJJywnQ29weSBBbnkgUHJvZHVjdCddXV0sCiBbJ0lGIFlPVSBXQU5UIElUJyxbWydtb3JlJywn4ouvJywnRXZlcnl0aGluZyBFbHNlJ11dXQpdOwpjb25zdCBOQVZERUY9WwogWycnLFtbJ2Rlc2snLCfil4knLCdUaGUgQ2hhaXJtYW4nXV1dLAogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydhZ2VudCcsJ+KamScsJ0FnZW50IExvb3AnXSxbJ3dvcmsyJywn4pyJJywnRmlsZXMgJiBXcml0aW5nJ10sWydtaXNzaW9ucycsJ+KXjicsJ015IE1pc3Npb25zJ10sWydjb21tYW5kJywn4pauJywnQ29tbWFuZCBDb25zb2xlJ10sWyd2ZW50dXJlcycsJ+KXhicsJ1ZlbnR1cmVzICYgSWRlYXMnXSxbJ2ZhY3RvcnknLCfilqYnLCdCdXNpbmVzcyBGYWN0b3J5J10sWydzaXRlcycsJ+KWpCcsJ1F1aWNrIExhbmRpbmcgUGFnZSddLFsnZG9tYWlucycsJ+KXjScsJ0RvbWFpbiBEZXNrJ10sWydncm93dGgnLCfinqQnLCdHcm93dGggRW5naW5lJ10sWydwYXknLCfigrknLCdQYXltZW50cyddXV0sCiBbJ1JVTlRJTUUnLFtbJ29wcycsJ+KWticsJ0xpdmUgT3BlcmF0aW9ucyddLFsnYnJhaW4nLCfil4gnLCdBSSBCcmFpbiddLFsnd29yaycsJ+KcpicsJ0FnZW50IFdvcmsnXSxbJ3Jlc2VhcmNoJywn8J+MkCcsJ0RlZXAgUmVzZWFyY2gnXV1dLAogWydFVk9MVVRJT04nLFtbJ2V2b2x2ZScsJ+KfsycsJ1NlbGYtVXBncmFkZSddLFsnYXJjaCcsJ+KniScsJ0NvcHkgQW55IFByb2R1Y3QnXSxbJ3dyaXR0ZW4nLCfinI4nLCdIZSBXcml0ZXMgQ29kZSddLFsnY29ubmVjdCcsJ+KarycsJ0Nvbm5lY3RvcnMnXSxbJ3NraWxsczInLCfil4cnLCdMZWFybmVkIFNraWxscyddXV0sCiBbJ01PTklUT1JJTkcnLFtbJ3VwdGltZScsJ+KXjicsJ1VwdGltZSBNYXJzaGFsJ10sWydtYWlsJywn4pyJJywnTWFpbCBSZWxheSddXV0sCiBbJ1NZU1RFTScsW1snc3lzdGVtJywn4pqhJywnTGl2ZSBUZWxlbWV0cnknXSxbJ3N0b3JhZ2UnLCfim4EnLCdTdG9yYWdlIEhlYWx0aCddLFsnZGV2aWNlcycsJ+KHhCcsJ0RldmljZXMgJiBTZXNzaW9ucyddLFsnemVyb2Nvc3QnLCfiiIUnLCdaZXJvLUNvc3QgUm91dGVyJ10sWydkb2N0cmluZScsJ8KnJywnRG9jdHJpbmUgJiBTT1AnXSxbJ3NldHRpbmdzJywn4pqZJywnT3duZXIgU2V0dGluZ3MnXV1dCl07CmxldCBTSU1QTEUgPSAoKCk9PnsgdHJ5eyByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NoYWlybWFuX3NpbXBsZScpIT09JzAnIH1jYXRjaChlKXsgcmV0dXJuIHRydWUgfSB9KSgpOwpmdW5jdGlvbiB0b2dnbGVTaW1wbGUoKXsgU0lNUExFPSFTSU1QTEU7CiAgdHJ5eyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2hhaXJtYW5fc2ltcGxlJywgU0lNUExFPycxJzonMCcpIH1jYXRjaChlKXt9CiAgYnVpbGROYXYoKTsgZ28oU0lNUExFPydkZXNrJzonaG9tZScpOyB9CmZ1bmN0aW9uIGJ1aWxkTmF2KCl7CiAgY29uc3Qgc3JjID0gU0lNUExFID8gTkFWX1NJTVBMRSA6IE5BVkRFRjsKICBuYXYuaW5uZXJIVE1MID0gc3JjLm1hcCgoW2csaXRdKT0+KGc/YDxkaXYgY2xhc3M9ImdycCI+JHtnfTwvZGl2PmA6JycpKwogICBpdC5tYXAoKFtpZCxpYyxsXSk9PmA8YnV0dG9uIGRhdGEtcD0iJHtpZH0iIG9uY2xpY2s9IiR7aWQ9PT0nbW9yZSc/J3RvZ2dsZVNpbXBsZSgpJzpgZ28oJyR7aWR9JylgfSI+PGk+JHtpY308L2k+JHtsfTwvYnV0dG9uPmApLmpvaW4oJycpKS5qb2luKCcnKQogICArIChTSU1QTEU/Jyc6YDxkaXYgY2xhc3M9ImdycCI+VklFVzwvZGl2PjxidXR0b24gb25jbGljaz0idG9nZ2xlU2ltcGxlKCkiPjxpPuKXiTwvaT5CYWNrIHRvIFNpbXBsZTwvYnV0dG9uPmApOwp9CmZ1bmN0aW9uIGdvKHApe2N1cj1wO1suLi5uYXYucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uJyldLmZvckVhY2goYj0+Yi5jbGFzc0xpc3QudG9nZ2xlKCdvbicsYi5kYXRhc2V0LnA9PT1wKSk7CiBjcnVtYi50ZXh0Q29udGVudD1wO3JlbmRlcigpO2Nsb3NlU2IoKTtzY3JvbGxUbygwLDApfQpmdW5jdGlvbiByZW5kZXIoKXsgdmlldy5pbm5lckhUTUw9UkVOREVSW2N1cl0oKTsgaWYoY3VyPT09J2VuZ2luZScpZHJhd0VuZ2luZSgpOwogIGlmKGN1cj09PSdicmFpbicmJnR5cGVvZiBwcm92SGludD09PSdmdW5jdGlvbicpcHJvdkhpbnQoKTsKICBpZihjdXI9PT0ncGF5JyYmdHlwZW9mIHBheUhpbnQ9PT0nZnVuY3Rpb24nKXBheUhpbnQoKTsgdGlja0Nocm9tZSgpIH0KZnVuY3Rpb24gdG9nZ2xlU2IoKXtjb25zdCBvPXNpZGViYXIuY2xhc3NMaXN0LnRvZ2dsZSgnb3BlbicpOwogaWYobyl7Y29uc3Qgcz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtzLmlkPSdzY3JpbSc7cy5vbmNsaWNrPWNsb3NlU2I7ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzKX1lbHNlIGNsb3NlU2IoKX0KZnVuY3Rpb24gY2xvc2VTYigpe3NpZGViYXIuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JpbScpPy5yZW1vdmUoKX0KLyogLS0tLSBsaWdodCAvIGRhcmsgdGhlbWUsIHJlbWVtYmVyZWQgcGVyIGRldmljZSAtLS0tICovCmZ1bmN0aW9uIGFwcGx5VGhlbWUodCl7CiAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScsIHQpOwogIGNvbnN0IGI9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RoZW1lQnRuJyk7CiAgaWYoYikgYi50ZXh0Q29udGVudCA9IHQ9PT0nZGFyaycgPyAn4piAJyA6ICfimL4nOwogIHRyeXsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2NoYWlybWFuX3RoZW1lJywgdCk7IH1jYXRjaChlKXt9CiAgaWYodHlwZW9mIGN1ciE9PSd1bmRlZmluZWQnICYmIGN1cj09PSdlbmdpbmUnICYmIHR5cGVvZiBkcmF3RW5naW5lPT09J2Z1bmN0aW9uJykgZHJhd0VuZ2luZSgpOwp9CmZ1bmN0aW9uIHRvZ2dsZVRoZW1lKCl7CiAgY29uc3Qgbm93PWRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKT09PSdkYXJrJz8nZGFyayc6J2xpZ2h0JzsKICBhcHBseVRoZW1lKG5vdz09PSdkYXJrJz8nbGlnaHQnOidkYXJrJyk7Cn0KLyogbGlnaHQgaXMgdGhlIGRlZmF1bHQg4oCUIE51bWVybyB0cmVhc3VyeSBwYWxldHRlICovCnRyeXsgYXBwbHlUaGVtZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY2hhaXJtYW5fdGhlbWUnKXx8J2xpZ2h0Jyk7IH1jYXRjaChlKXsgYXBwbHlUaGVtZSgnbGlnaHQnKTsgfQpmdW5jdGlvbiBpc0RhcmsoKXsgcmV0dXJuIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKT09PSdkYXJrJyB9Ci8qIGVuZ2luZSBwYWxldHRlIGZvbGxvd3MgdGhlIHRoZW1lICovCmZ1bmN0aW9uIEVQKCl7IHJldHVybiBpc0RhcmsoKQogID8ge3Jpbmc6JyMyNTJBMTYnLGxpbmU6JyM0QTU3MjInLG5vZGVCZzonIzE1MTgwQycsY29yZTE6JyNFOEYwQzAnLGNvcmUyOicjQTNCQjJCJyxjb3JlMzonIzJBMzMxMCcsCiAgICAgY29yZVR4dDonIzBBMEIwNicsZGVhZDonIzNBNDAyNCcsZGVhZFR4dDonIzZBNkQ1QycsbGFiZWw6JyM5QTlDOEEnfQogIDoge3Jpbmc6JyNFM0UzREEnLGxpbmU6JyNCOUM0OEEnLG5vZGVCZzonI0ZGRkZGRicsY29yZTE6JyNGRkZGRkYnLGNvcmUyOicjOEZBMzI2Jyxjb3JlMzonIzM5NDYwMycsCiAgICAgY29yZVR4dDonI0ZGRkZGRicsZGVhZDonI0NGQ0ZDMycsZGVhZFR4dDonIzlBOUM5MCcsbGFiZWw6JyM2QjZENjInfSB9CgovKiAtLS0tLS0tLS0tIHByaW1pdGl2ZXMgLS0tLS0tLS0tLSAqLwpjb25zdCBSRU5ERVI9e307CmZ1bmN0aW9uIGtwaSh2LGwsYyxzKXtyZXR1cm4gYDxkaXYgY2xhc3M9ImtwaSI+PHU+JHtsfTwvdT48YiBzdHlsZT0iY29sb3I6JHtjfHwndmFyKC0tdHh0KSd9Ij4ke3Z9PC9iPiR7cz9gPHM+JHtzfTwvcz5gOicnfTwvZGl2PmB9CmZ1bmN0aW9uIGxvZ0h0bWwobil7aWYoIVMubG9ncy5sZW5ndGgpcmV0dXJuICc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+TGVkZ2VyIGVtcHR5LjwvZGl2Pic7CiBjb25zdCBjb2w9e0lORk86J3ZhcigtLWJsdSknLE9LOid2YXIoLS1ncm4pJyxXQVJOOid2YXIoLS1hbWIpJyxDUklUOid2YXIoLS1tYWcpJ307CiByZXR1cm4gJzxkaXYgY2xhc3M9ImxvZyI+JytTLmxvZ3Muc2xpY2UoMCxuKS5tYXAobD0+YDxkaXY+PHNwYW4gY2xhc3M9InRzIj4ke2wudH08L3NwYW4+IDxzcGFuIHN0eWxlPSJjb2xvcjoke2NvbFtsLnNldl19Ij5bJHtsLnNldn1dPC9zcGFuPiA8Yj4ke2VzYyhsLnNyYyl9PC9iPiDigJQgJHtlc2MobC5tc2cpfTwvZGl2PmApLmpvaW4oJycpKyc8L2Rpdj4nfQpmdW5jdGlvbiBmbG9vcihpZCl7cmV0dXJuIFMuZmxvb3JzLmZpbmQoZj0+Zi5pZD09PWlkKXx8e2hlYWx0aDowLGxvYWQ6MCxhZ2VudHM6MCxhY3RpdmU6MH19CgovKiAtLS0tLS0tLS0tIEhPTUUgLS0tLS0tLS0tLSAqLwpMSVZFLmhvbWVLcGk9KCk9PnsKICBjb25zdCB0PVMudGVsZW1ldHJ5LCBwZW5kPVMuZ2F0ZXMuZmlsdGVyKGc9Pmcuc3RhdHVzPT09J1BFTkRJTkcnKS5sZW5ndGg7CiAgY29uc3QgYWN0aXZlPVMuYWdlbnRzLmZpbHRlcihhPT5hLnN0YXR1cz09PSdBQ1RJVkUnKS5sZW5ndGg7CiAgcmV0dXJuIGtwaShhY3RpdmUrJyAvICcrUy5hZ2VudHMubGVuZ3RoLCdBY3RpdmUgU3ViLUFnZW50cycsJ3ZhcigtLWN5KScsYWN0aXZlPT09Uy5hZ2VudHMubGVuZ3RoPydGdWxsIHJvc3Rlcic6J0RFR1JBREVEJykKICAgK2twaShwZW5kLCdHYXRlcyBGcm96ZW4nLHBlbmQ/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxwZW5kPydBd2FpdGluZyBjbGVhcmFuY2UnOidRdWV1ZSBjbGVhcicpCiAgICtrcGkoaGhtbXNzKHQudXB0aW1lX3MpLCdTZXJ2ZXIgVXB0aW1lJywndmFyKC0tZ3JuKScsJ3BpZCAnK3QucGlkKQogICAra3BpKHQuYXZnX2xhdGVuY3lfbXMrJyBtcycsJ0F2ZyBMYXRlbmN5Jyx0LmF2Z19sYXRlbmN5X21zPjUwPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsZm10KHQucmVxdWVzdHMpKycgcmVxdWVzdHMnKX0KTElWRS5ob21lTG9hZD0oKT0+UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7CiAgcmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmFjdGl2ZX0vJHtmLmFnZW50c30gYWd0IMK3IEgke2YuaGVhbHRofSUgwrcgTCR7Zi5sb2FkfSU8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmxvYWR9JTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCg5MGRlZywke3AuY29sb3J9LHZhcigtLWxpbWUpKSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKTsKTElWRS5ob21lVGVybT0oKT0+bG9nSHRtbCgxNCk7ClJFTkRFUi5ob21lPSgpPT57CiAgY29uc3QgdD1TLnRlbGVtZXRyeSwgcGVuZD1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJykubGVuZ3RoOwogIGNvbnN0IGluZmxvdz1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiIGRhdGEtbGl2ZT0iaG9tZUtwaSI+JHtMSVZFLmhvbWVLcGkoKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYWlybWFuJ3MgU3RhbmRpbmcgQXNzZXNzbWVudCA8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5OTyBTVUdBUiBDT0FUSU5HPC9zcGFuPjwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgICA8bGk+JHtTLm93bmVyLmJvb3RzdHJhcD8nPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkNSSVRJQ0FMOjwvYj4gYm9vdHN0cmFwIHBhc3N3b3JkIHN0aWxsIGFjdGl2ZS4gUm90YXRlIGl0IG5vdyDigJQgdGhlIHBsYWludGV4dCBjb3B5IGV4aXN0cyBvbiBkaXNrIHVudGlsIHlvdSBkby4nOidCb290c3RyYXAgY3JlZGVudGlhbCByb3RhdGVkIGFuZCBkZXN0cm95ZWQuIEdvb2QuJ308L2xpPgogICAgPGxpPiR7Uy5wYXlvdXQ/J1BheW91dCBjaGFubmVsIHNlYWxlZC4gVHJhbnNmZXJzIHJlcXVpcmUgc2lnbmF0dXJlICsgMkZBIGludGVudC4nOic8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+QkxPQ0tFUjo8L2I+IG5vIHBheW91dCBjaGFubmVsLiBFdmVyeSBmaW5hbmNpYWwgZ2F0ZSBoYXJkLWJsb2NrcyBzZXJ2ZXItc2lkZS4nfTwvbGk+CiAgICA8bGk+JHtwZW5kP2A8YiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtwZW5kfSBvcGVyYXRpb24ocykgZnJvemVuPC9iPiBwZW5kaW5nIHlvdXIgY2xlYXJhbmNlLmA6J05vIGZyb3plbiBvcGVyYXRpb25zLid9PC9saT4KICAgIDxsaT4ke1MucnVubmluZz9gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPlNZU1RFTSBSVU5OSU5HPC9iPiDigJQgJHsoUy50YXNrc3x8W10pLmZpbHRlcih0PT50LmVuYWJsZWQpLmxlbmd0aH0gc3RhbmRpbmcgb3JkZXJzIGV4ZWN1dGluZywgJHsoUy50YXNrc3x8W10pLnJlZHVjZSgoYSx0KT0+YSsodC5ydW5zfHwwKSwwKX0gam9icyBjb21wbGV0ZWQuYDonPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlNZU1RFTSBIQUxURUQ8L2I+IOKAlCBubyBhZ2VudCB3b3JrIGlzIGV4ZWN1dGluZy4gU3RhcnQgaXQgaW4gTGl2ZSBPcGVyYXRpb25zLid9PC9saT4KICAgIDxsaT5aZXJvLUNvc3Q6ICR7Uy5kZW5pYWxzLmxlbmd0aH0gcGFpZCBwYXRoKHMpIGludGVyY2VwdGVkLCAkJHtTLnNwZW5kLnRvRml4ZWQoMil9IGF1dGhvcml6ZWQgc3BlbmQsIDAgbnBtIGRlcGVuZGVuY2llcyBpbnN0YWxsZWQuPC9saT4KICAgIDxsaT5MaXZlIHN5bmMgYWN0aXZlOiAke3QubGl2ZV9zZXNzaW9uc30gZGV2aWNlIHNlc3Npb24ocykgb24gdGhpcyBpbnN0YW5jZSwgc3RhdGUgcmV2aXNpb24gJHtTLnJldn0uPC9saT4KICAgPC91bD48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBpbGxhciBMb2FkIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+REVSSVZFRCBGUk9NIFJFQUwgUFJPQ0VTUyBNRVRSSUNTPC9zcGFuPjwvaDM+CiAgICA8ZGl2IGRhdGEtbGl2ZT0iaG9tZUxvYWQiPiR7TElWRS5ob21lTG9hZCgpfTwvZGl2PjwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXZlbnVlIFRlbGVtZXRyeSA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5JTkZMT1cgJCR7Zm10KGluZmxvdyl9PC9zcGFuPjwvaDM+JHtzcGFyaygpfQogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5HcmVlbiBkYXNoZWQgbGluZSBpcyB0aGUgc3BlbmQgZmxvb3IsIGhlbGQgYXQgJDAuMDAgYnkgZG9jdHJpbmUuPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgVGVybWluYWwgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+U0VSVkVSIExFREdFUjwvc3Bhbj48L2gzPjxkaXYgZGF0YS1saXZlPSJob21lVGVybSI+JHtMSVZFLmhvbWVUZXJtKCl9PC9kaXY+PC9kaXY+YDsKfTsKZnVuY3Rpb24gc3BhcmsoKXsKICBjb25zdCB2PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkubWFwKHI9PnIuYW10KTsgY29uc3QgcHRzPSh2Lmxlbmd0aD92OlswLDBdKS5zbGljZSgtMjQpOwogIGNvbnN0IG14PU1hdGgubWF4KC4uLnB0cywxKSx3PTYwMCxoPTkwLHN0ZXA9cHRzLmxlbmd0aD4xP3cvKHB0cy5sZW5ndGgtMSk6dzsKICBjb25zdCBkPXB0cy5tYXAoKHAsaSk9PmAke2k/J0wnOidNJ30keyhpKnN0ZXApLnRvRml4ZWQoMSl9LCR7KGgtKHAvbXgpKihoLTEyKS02KS50b0ZpeGVkKDEpfWApLmpvaW4oJyAnKTsKICByZXR1cm4gYDxzdmcgdmlld0JveD0iMCAwICR7d30gJHtofSIgc3R5bGU9IndpZHRoOjEwMCU7aGVpZ2h0OjkwcHgiPgogICA8ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InNnIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjNzg4QTFENTUiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM3ODhBMUQwMCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPgogICAke1swLDEsMiwzXS5tYXAoaT0+YDxsaW5lIHgxPSIwIiB5MT0iJHtpKjMwfSIgeDI9IiR7d30iIHkyPSIke2kqMzB9IiBzdHJva2U9IiMxMDFhMjQiLz5gKS5qb2luKCcnKX0KICAgPHBhdGggZD0iJHtkfSBMJHt3fSwke2h9IEwwLCR7aH0gWiIgZmlsbD0idXJsKCNzZykiLz48cGF0aCBkPSIke2R9IiBzdHJva2U9IiM3ODhBMUQiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMiIvPgogICA8bGluZSB4MT0iMCIgeTE9IiR7aC02fSIgeDI9IiR7d30iIHkyPSIke2gtNn0iIHN0cm9rZT0iIzMxZDY3YSIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0IiBzdHJva2Utd2lkdGg9IjEuNCIvPjwvc3ZnPmA7Cn0KCi8qIC0tLS0tLS0tLS0gTElWRSBURUxFTUVUUlkgLS0tLS0tLS0tLSAqLwpMSVZFLnN5cz0oKT0+e2NvbnN0IHQ9Uy50ZWxlbWV0cnk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICR7a3BpKHQucnNzX21iKycgTUInLCdQcm9jZXNzIFJTUycsJ3ZhcigtLWN5KScsJ2hlYXAgJyt0LmhlYXBfbWIrJy8nK3QuaGVhcF90b3RhbF9tYisnIE1CJyl9CiAgJHtrcGkodC5sb2FkMSwnTG9hZCBBdmcgMW0nLHQubG9hZDE+dC5jcHVzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsdC5jcHVzKycgY3B1cyDCtyA1bSAnK3QubG9hZDUpfQogICR7a3BpKHQuc3lzX21lbV9wY3QrJyUnLCdTeXN0ZW0gTWVtb3J5Jyx0LnN5c19tZW1fcGN0Pjg1Pyd2YXIoLS1tYWcpJzondmFyKC0tYW1iKScsJ2hvc3QgJyt0Lmhvc3RuYW1lKX0KICAke2twaShmbXQodC5yZXF1ZXN0cyksJ0hUVFAgUmVxdWVzdHMnLCd2YXIoLS1ibHUpJyxmbXQodC5hcGlfY2FsbHMpKycgYXBpIMK3ICcrdC5lcnJvcnMrJyBlcnJvcnMnKX0KIDwvZGl2PgogPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlByb2Nlc3MgRmFjdHM8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij5SdW50aW1lPC90ZD48dGQ+JHt0Lm5vZGV9IMK3ICR7dC5wbGF0Zm9ybX08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5QSUQ8L3RkPjx0ZD4ke3QucGlkfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlVwdGltZTwvdGQ+PHRkPiR7aGhtbXNzKHQudXB0aW1lX3MpfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF2ZyBsYXRlbmN5PC90ZD48dGQ+JHt0LmF2Z19sYXRlbmN5X21zfSBtcyAobGFzdCA1MDAgcmVxKTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF1dGggZmFpbHVyZXM8L3RkPjx0ZCBzdHlsZT0iY29sb3I6JHt0LmF1dGhfZmFpbHVyZXM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7dC5hdXRoX2ZhaWx1cmVzfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxpdmUgc2Vzc2lvbnM8L3RkPjx0ZD4ke3QubGl2ZV9zZXNzaW9uc30gb2YgJHt0LnRvdGFsX3Nlc3Npb25zfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlN0YXRlIGZpbGU8L3RkPjx0ZD4keyh0LmRiX2J5dGVzLzEwMjQpLnRvRml4ZWQoMSl9IEtCIMK3IHJldiAke3Quc3RhdGVfcmV2fTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlNlc3Npb25zPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWdybiI+RFVSQUJMRSDCtyAzMGQgVFRMPC9zcGFuPjwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1vbml0b3JzPC90ZD48dGQ+JHt0Lm1vbml0b3JzfHwwfSBib3VuZCDCtyA8c3BhbiBzdHlsZT0iY29sb3I6JHt0Lm1vbml0b3JzX2Rvd24/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7dC5tb25pdG9yc19kb3dufHwwfSBkb3duPC9zcGFuPjwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1haWwgcmVsYXk8L3RkPjx0ZD4ke3Quc210cF9yZWFkeT9gPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+QVJNRUQ8L3NwYW4+ICR7dC5tYWlsX3NlbnR9IHNlbnQgLyAke3QubWFpbF9mYWlsZWR9IGZhaWxlZGA6JzxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPk9GRkxJTkUg4oCUIGludGVudCBvbmx5PC9zcGFuPid9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RGVwZW5kZW5jaWVzPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWdybiI+MCBJTlNUQUxMRUQgwrcgJDAuMDA8L3NwYW4+PC90ZD48L3RyPgogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SG90IFBhdGhzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgJHt0LmhvdF9wYXRocy5tYXAoKFtwLGNdKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhwKX08L3RkPjx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+JHtmbXQoYyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+Q291bnRlcnMgYXJlIHJlYWwsIGNvbGxlY3RlZCBpbi1wcm9jZXNzIHNpbmNlIGJvb3QuIFRoZXkgcmVzZXQgd2hlbiB0aGUgc2VydmVyIHJlc3RhcnRzLjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGVyaXZlZCBGbG9vciBIZWFsdGg8L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7cmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmhlYWx0aH0lIGhlYWx0aCDCtyAke2YubG9hZH0lIGxvYWQ8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmhlYWx0aH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5FYWNoIGZsb29yJ3MgaGVhbHRoIGlzIGNvbXB1dGVkIGZyb20gcmVhbCBpbnB1dHM6IGF1dGggZmFpbHVyZXMgYW5kIGRvY3RyaW5lIGRlbmlhbHMgaGl0IFNlY3VyaXR5OyBsb2FkIGF2ZXJhZ2UgYW5kIFJTUyBoaXQgT3BlcmF0aW9uczsgSFRUUCBlcnJvcnMgYW5kIGZyb3plbiBnYXRlcyBoaXQgRW5naW5lZXJpbmc7IHN0YXRlLWZpbGUgc2l6ZSBoaXRzIERhdGE7IGF1dGhvcml6ZWQgc3BlbmQgYW5kIHBheW91dCBzdGF0dXMgaGl0IFN0cmF0ZWd5LiBTdGFmZmluZyByYXRpbyBzY2FsZXMgYWxsIGZpdmUuIFRoZXNlIG1vdmUgd2hlbiB0aGUgc3lzdGVtIGFjdHVhbGx5IG1vdmVzLjwvZGl2PjwvZGl2PmB9ClJFTkRFUi5zeXN0ZW09KCk9PmA8ZGl2IGRhdGEtbGl2ZT0ic3lzIj4ke0xJVkUuc3lzKCl9PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gRU5HSU5FIC0tLS0tLS0tLS0gKi8KUkVOREVSLmVuZ2luZT0oKT0+YAogPGRpdiBjbGFzcz0iZW5naW5lV3JhcCI+PGRpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0icGFkZGluZzoxMXB4IDEzcHg7bWFyZ2luLWJvdHRvbToxMXB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGIgc3R5bGU9ImxldHRlci1zcGFjaW5nOjJweDtmb250LXNpemU6MTJweCI+T1BUSU1BTCBFTkdJTkU8L2I+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5LTk9XTEVER0UgQ09SRTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gJHtlbmdGb2N1cz8nJzoncCd9IiBvbmNsaWNrPSJlbmdGb2N1cz1udWxsO2RyYXdFbmdpbmUoKSI+UmFkaWFsPC9idXR0b24+CiAgICR7UElMTEFSUy5tYXAocD0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSAke2VuZ0ZvY3VzPT1wLmlkPydwJzonJ30iIG9uY2xpY2s9ImVuZ0ZvY3VzPSR7cC5pZH07ZHJhd0VuZ2luZSgpIj4ke3AuaWNvbn08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICA8L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYW52YXNCb3giPjxkaXYgY2xhc3M9ImdyaWRiZyI+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImVuZ1RvcCI+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSIgaWQ9ImVuZ01vZGUiPlJBRElBTCDCtyBBTEwgRkxPT1JTPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJlbmdUaXRsZSIgaWQ9ImVuZ1RpdGxlIj5DSEFJUk1BTiBDT1JFPC9kaXY+PGRpdiBpZD0iZW5nU3ZnIj48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48aDM+RW5naW5lIFRlcm1pbmFsPC9oMz4KICAgPGRpdiBjbGFzcz0idGVybSIgaWQ9ImVuZ1Rlcm0iPmNoYWlybWFuLW9zIDo6IGVuZ2luZSByZWFkeSDCtyAke1MuYWdlbnRzLmxlbmd0aH0gbm9kZXMgYm91bmQgwrcgY29zdCBjZWlsaW5nICQwLjAwCmF3YWl0aW5nIG5vZGUgc2VsZWN0aW9u4oCmPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgY2xhc3M9InNpZGUiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MZW5zPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5FbnRpdHk8L3NwYW4+PHNlbGVjdCBjbGFzcz0iaW4iIGlkPSJsZW5zRW50IiBvbmNoYW5nZT0iZHJhd0VuZ2luZSgpIj4KICAgIDxvcHRpb24gdmFsdWU9ImFsbCI+QWxsPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iYWN0aXZlIj5BY3RpdmUgb25seTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9InN1c3AiPlN1c3BlbmRlZCBvbmx5PC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luOjAiPjxzcGFuPkZsb29yPC9zcGFuPjxzZWxlY3QgY2xhc3M9ImluIiBvbmNoYW5nZT0iZW5nRm9jdXM9dGhpcy52YWx1ZT09PSdhbGwnP251bGw6K3RoaXMudmFsdWU7ZHJhd0VuZ2luZSgpIj4KICAgIDxvcHRpb24gdmFsdWU9ImFsbCI+QWxsIGZsb29yczwvb3B0aW9uPiR7UElMTEFSUy5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iICR7ZW5nRm9jdXM9PXAuaWQ/J3NlbGVjdGVkJzonJ30+JHtwLmlkfSDCtyAke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MZWdlbmQ8L2gzPjxkaXYgY2xhc3M9ImxlZ2VuZCI+CiAgICR7UElMTEFSUy5tYXAocD0+YDxkaXY+PGkgc3R5bGU9ImJhY2tncm91bmQ6JHtwLmNvbG9yfTtib3gtc2hhZG93OjAgMCA4cHggJHtwLmNvbG9yfSI+PC9pPiR7cC5uYW1lfTwvZGl2PmApLmpvaW4oJycpfQogICA8ZGl2PjxpIHN0eWxlPSJiYWNrZ3JvdW5kOiNlNmVlZjc7Ym94LXNoYWRvdzowIDAgOHB4ICNmZmYiPjwvaT5DaGFpcm1hbiBDb3JlPC9kaXY+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRpcmVjdG9yeSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1MuYWdlbnRzLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0iZGlyTGlzdCI+JHtTLmFnZW50cy5tYXAoYT0+YDxidXR0b24gb25jbGljaz0icGlja05vZGUoJyR7YS5pZH0nKSI+JHtlc2MoYS5uYW1lKX08c3Bhbj4ke1BJTExBUlMuZmluZChwPT5wLmlkPT1hLnBpbGxhcklkKS5pY29ufTwvc3Bhbj48L2J1dHRvbj5gKS5qb2luKCcnKXx8JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5lbXB0eTwvZGl2Pid9PC9kaXY+PC9kaXY+CiA8L2Rpdj48L2Rpdj5gOwpmdW5jdGlvbiBkcmF3RW5naW5lKCl7CiAgY29uc3QgYm94PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdTdmcnKTsgaWYoIWJveClyZXR1cm47CiAgY29uc3QgUD1FUCgpOwogIGNvbnN0IGVudD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGVuc0VudCcpPy52YWx1ZXx8J2FsbCc7CiAgbGV0IGxpc3Q9Uy5hZ2VudHMuZmlsdGVyKGE9PmVudD09PSdhbGwnfHwoZW50PT09J2FjdGl2ZSc/YS5zdGF0dXM9PT0nQUNUSVZFJzphLnN0YXR1cyE9PSdBQ1RJVkUnKSk7CiAgY29uc3QgZmxvb3JzPWVuZ0ZvY3VzP1BJTExBUlMuZmlsdGVyKHA9PnAuaWQ9PT1lbmdGb2N1cyk6UElMTEFSUzsKICBpZihlbmdGb2N1cylsaXN0PWxpc3QuZmlsdGVyKGE9PmEucGlsbGFySWQ9PT1lbmdGb2N1cyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ01vZGUnKS50ZXh0Q29udGVudD1lbmdGb2N1cz8nRk9DVVMgwrcgRkxPT1IgMCcrZW5nRm9jdXM6J1JBRElBTCDCtyBBTEwgRkxPT1JTJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nVGl0bGUnKS50ZXh0Q29udGVudD1lbmdGb2N1cz9QSUxMQVJTLmZpbmQocD0+cC5pZD09PWVuZ0ZvY3VzKS5uYW1lLnRvVXBwZXJDYXNlKCk6J0NIQUlSTUFOIENPUkUnOwogIGNvbnN0IFc9OTAwLEg9NTYwLGN4PVcvMixjeT1ILzI7IGxldCBodWJzPScnLGxpbmtzPScnLG5vZGVzPScnLHJpbmdzPScnOwogIFsxNTAsMjE1LDI2NV0uZm9yRWFjaChyPT5yaW5ncys9YDxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IiR7cn0iIGZpbGw9Im5vbmUiIHN0cm9rZT0iJHtQLnJpbmd9IiBzdHJva2UtZGFzaGFycmF5PSIzIDYiLz5gKTsKICBjb25zdCBuPWZsb29ycy5sZW5ndGg7CiAgZmxvb3JzLmZvckVhY2goKHAsaSk9PnsKICAgIGNvbnN0IGFuZz0oLTkwKygzNjAvbikqaSkqTWF0aC5QSS8xODAsaHg9Y3grMTUwKk1hdGguY29zKGFuZyksaHk9Y3krMTUwKk1hdGguc2luKGFuZyk7CiAgICBsaW5rcys9YDxsaW5lIHgxPSIke2N4fSIgeTE9IiR7Y3l9IiB4Mj0iJHtoeH0iIHkyPSIke2h5fSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iLjU1IiBzdHJva2Utd2lkdGg9IjEuNCIvPmA7CiAgICBodWJzKz1gPGcgY2xhc3M9Im5vZGUiIG9uY2xpY2s9ImVuZ0ZvY3VzPSR7ZW5nRm9jdXM/J251bGwnOnAuaWR9O2RyYXdFbmdpbmUoKSI+CiAgICAgPGNpcmNsZSBjeD0iJHtoeH0iIGN5PSIke2h5fSIgcj0iMTciIGZpbGw9IiR7UC5ub2RlQmd9IiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS13aWR0aD0iMiIvPgogICAgIDx0ZXh0IHg9IiR7aHh9IiB5PSIke2h5KzR9IiBmb250LXNpemU9IjEzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4ke3AuaWNvbn08L3RleHQ+CiAgICAgPHRleHQgeD0iJHtoeH0iIHk9IiR7aHkrMzJ9IiBmb250LXNpemU9IjkuNSIgZmlsbD0iJHtwLmNvbG9yfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLm5hbWUuc3BsaXQoJyAnKVswXS50b1VwcGVyQ2FzZSgpfTwvdGV4dD48L2c+YDsKICAgIGNvbnN0IGtpZHM9bGlzdC5maWx0ZXIoYT0+YS5waWxsYXJJZD09PXAuaWQpOwogICAga2lkcy5mb3JFYWNoKChhLGopPT57CiAgICAgIGNvbnN0IHNwcmVhZD1lbmdGb2N1cz9NYXRoLlBJKjEuNjpNYXRoLlBJLyhuKjEuMTUpOwogICAgICBjb25zdCB0PWtpZHMubGVuZ3RoPjE/KGovKGtpZHMubGVuZ3RoLTEpLS41KTowLCBhYT1hbmcrdCpzcHJlYWQsIFI9ZW5nRm9jdXM/MjMwOihqJTI/MjY1OjIxNSk7CiAgICAgIGNvbnN0IHg9Y3grUipNYXRoLmNvcyhhYSkseT1jeStSKk1hdGguc2luKGFhKSxkZWFkPWEuc3RhdHVzIT09J0FDVElWRSc7CiAgICAgIGxpbmtzKz1gPGxpbmUgeDE9IiR7aHh9IiB5MT0iJHtoeX0iIHgyPSIke3h9IiB5Mj0iJHt5fSIgc3Ryb2tlPSIke2RlYWQ/JyMyNDMwNDAnOnAuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iJHtkZWFkPy4zOi4zNX0iIHN0cm9rZS13aWR0aD0iMSIvPmA7CiAgICAgIG5vZGVzKz1gPGcgY2xhc3M9Im5vZGUiIG9uY2xpY2s9InBpY2tOb2RlKCcke2EuaWR9JykiPjx0aXRsZT4ke2VzYyhhLm5hbWUpfTwvdGl0bGU+CiAgICAgICA8Y2lyY2xlIGN4PSIke3h9IiBjeT0iJHt5fSIgcj0iOSIgZmlsbD0iJHtkZWFkP1Aubm9kZUJnOlAubm9kZUJnfSIgc3Ryb2tlPSIke2RlYWQ/UC5kZWFkOnAuY29sb3J9IiBzdHJva2Utd2lkdGg9IjEuNiIvPgogICAgICAgPHRleHQgeD0iJHt4fSIgeT0iJHt5KzMuNH0iIGZvbnQtc2l6ZT0iOC41IiBmaWxsPSIke2RlYWQ/UC5kZWFkVHh0OnAuY29sb3J9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5BPC90ZXh0PgogICAgICAgJHtlbmdGb2N1cz9gPHRleHQgeD0iJHt4fSIgeT0iJHt5KzIxfSIgZm9udC1zaXplPSI4IiBmaWxsPSIke1AubGFiZWx9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke2VzYyhhLm5hbWUuc2xpY2UoMCwxNikpfTwvdGV4dD5gOicnfTwvZz5gOwogICAgfSk7CiAgfSk7CiAgYm94LmlubmVySFRNTD1gPHN2ZyB2aWV3Qm94PSIwIDAgJHtXfSAke0h9Ij4KICAgPGRlZnM+PHJhZGlhbEdyYWRpZW50IGlkPSJjb3JlIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiR7UC5jb3JlMX0iLz48c3RvcCBvZmZzZXQ9Ii41NSIgc3RvcC1jb2xvcj0iJHtQLmNvcmUyfSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iJHtQLmNvcmUzfSIvPjwvcmFkaWFsR3JhZGllbnQ+CiAgIDxmaWx0ZXIgaWQ9Imdsb3ciPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjUiIHJlc3VsdD0iYiIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT48L2ZpbHRlcj48L2RlZnM+CiAgICR7cmluZ3N9JHtsaW5rc308Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSIzNCIgZmlsbD0idXJsKCNjb3JlKSIgZmlsdGVyPSJ1cmwoI2dsb3cpIiBvcGFjaXR5PSIuOTIiLz4KICAgPGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iNDYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iJHtQLmNvcmUyfTU1Ii8+CiAgIDx0ZXh0IHg9IiR7Y3h9IiB5PSIke2N5KzN9IiBmb250LXNpemU9IjEwIiBmaWxsPSIke1AuY29yZVR4dH0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtd2VpZ2h0PSI3MDAiPkNPUkU8L3RleHQ+CiAgICR7aHVic30ke25vZGVzfTwvc3ZnPmA7Cn0KZnVuY3Rpb24gcGlja05vZGUoaWQpe2NvbnN0IGE9Uy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpO2lmKCFhKXJldHVybjsKIGNvbnN0IHQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1Rlcm0nKTsKIGlmKHQpdC50ZXh0Q29udGVudD1gY2hhaXJtYW4tb3MgOjogbm9kZSAke2EuaWR9XG5uYW1lICAgICAke2EubmFtZX1cbmZsb29yICAgICR7YS5waWxsYXJJZH0gwrcgJHtQSUxMQVJTLmZpbmQocD0+cC5pZD09YS5waWxsYXJJZCkubmFtZX1cbnN0YXR1cyAgICR7YS5zdGF0dXN9XG5jb3N0ICAgICAke2EuY29zdH1cbnRvb2xzICAgICR7YS50b29scy5qb2luKCcsICcpfVxuc2NvcGUgICAgJHthLnJvbGV9YDsKIHNob3dZYW1sKGlkKX0KCi8qIC0tLS0tLS0tLS0gR0FURVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZ2F0ZXM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SYWlzZSBQZXJtaXNzaW9uIEdhdGUgPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+NC1TVEVQIFNPUCDCtyBTRVJWRVIgRU5GT1JDRUQ8L3NwYW4+PC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PcGVyYXRpb24gVGl0bGU8L3NwYW4+PGlucHV0IGlkPSJnVGl0bGUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkRlcGxveSBwcmljaW5nLXNlcnZpY2UgdjIuNCI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DbGFzczwvc3Bhbj48c2VsZWN0IGlkPSJnQ2xhc3MiIGNsYXNzPSJpbiI+CiAgICA8b3B0aW9uPkRFUExPWU1FTlQ8L29wdGlvbj48b3B0aW9uPkRCIFNDSEVNQSBDSEFOR0U8L29wdGlvbj48b3B0aW9uPkNPREUgTU9ESUZJQ0FUSU9OPC9vcHRpb24+CiAgICA8b3B0aW9uPkZJTkFOQ0lBTCBUUkFOU0ZFUjwvb3B0aW9uPjxvcHRpb24+QUNDRVNTIEdSQU5UPC9vcHRpb24+PG9wdGlvbj5FWFRFUk5BTCBUT09MIEFET1BUSU9OPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjEgwrcgT2JqZWN0aXZlICZhbXA7IHN1Y2Nlc3MgY3JpdGVyaWE8L3NwYW4+PHRleHRhcmVhIGlkPSJnT2JqIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4yIMK3IEFnZW50cyAvIHRvb2xzIGFzc2lnbmVkICZhbXA7IHdoeTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdKdXN0IiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4zIMK3IFJvbGxiYWNrICZhbXA7IHNhZmVndWFyZHM8L3NwYW4+PHRleHRhcmVhIGlkPSJnU2FmZSIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Qmxhc3QgUmFkaXVzPC9zcGFuPjxzZWxlY3QgaWQ9ImdSaXNrIiBjbGFzcz0iaW4iPjxvcHRpb24+TE9XPC9vcHRpb24+PG9wdGlvbj5NRURJVU08L29wdGlvbj48b3B0aW9uPkhJR0g8L29wdGlvbj48b3B0aW9uPlNFVkVSRTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VG9vbCBDb3N0IC8gQ3JlZGl0cyAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9ImdDb3N0IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgbWluPSIwIiB2YWx1ZT0iMCI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5WYWx1ZSBhdCBSaXNrIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0iZ0FtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIG1pbj0iMCIgdmFsdWU9IjAiPjwvbGFiZWw+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5GcmVlIEFsdGVybmF0aXZlIFJvdXRlIChyZXF1aXJlZCBpZiBjb3N0ICZndDsgMCk8L3NwYW4+PGlucHV0IGlkPSJnRnJlZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iT3Blbi1zb3VyY2UgLyBzZWxmLWhvc3RlZCAvIGZyZWUtdGllciBwYXRoIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyYWlzZUdhdGUoKSI+U1VCTUlUIEZPUiBPV05FUiBDTEVBUkFOQ0U8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIFF1ZXVlIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Uy5nYXRlcy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgJHtTLmdhdGVzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPk9wZXJhdGlvbjwvdGg+PHRoPkNsYXNzPC90aD48dGg+UmlzazwvdGg+PHRoPkNvc3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtTLmdhdGVzLm1hcChnPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7Zy5pZH08L3RkPjx0ZD4ke2VzYyhnLnRpdGxlKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtnLnR9PC9kaXY+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Zy5jbHN9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7WydISUdIJywnU0VWRVJFJ10uaW5jbHVkZXMoZy5yaXNrKT8ndC1yZWQnOmcucmlzaz09PSdNRURJVU0nPyd0LWFtYic6J3QtZ3JuJ30iPiR7Zy5yaXNrfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2cuY29zdD8ndC1yZWQnOid0LWdybid9Ij4ke2cuY29zdD8nJCcrZy5jb3N0OidGUkVFJ308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLnN0YXR1cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpnLnN0YXR1cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7Zy5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9Im9wZW5HYXRlKCcke2cuaWR9JykiPlJldmlldzwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIGdhdGVzIHJhaXNlZC4gTm90aGluZyBpcyBleGVjdXRpbmcuPC9kaXY+J308L2Rpdj5gOwphc3luYyBmdW5jdGlvbiByYWlzZUdhdGUoKXsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2dhdGUnLHt0aXRsZTpnVGl0bGUudmFsdWUudHJpbSgpLGNsczpnQ2xhc3MudmFsdWUsb2JqOmdPYmoudmFsdWUudHJpbSgpLAogICAganVzdDpnSnVzdC52YWx1ZS50cmltKCksc2FmZTpnU2FmZS52YWx1ZS50cmltKCkscmlzazpnUmlzay52YWx1ZSxjb3N0OitnQ29zdC52YWx1ZXx8MCxhbXQ6K2dBbXQudmFsdWV8fDAsZnJlZTpnRnJlZS52YWx1ZS50cmltKCl9KTsKICAgcmVuZGVyKCk7IGZsYXNoKCdHYXRlICcrci5pZCsnIHJhaXNlZCDCtyBmcm96ZW4gc2VydmVyLXNpZGUnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIG9wZW5HYXRlKGlkKXsKICBjb25zdCBnPVMuZ2F0ZXMuZmluZCh4PT54LmlkPT09aWQpOwogIGNvbnN0IGZpbkJsb2NrPWcuY2xzPT09J0ZJTkFOQ0lBTCBUUkFOU0ZFUicmJiFTLnBheW91dCwgY29zdEJsb2NrPWcuY29zdD4wOwogIG1vZGFsKGA8aDM+JHtlc2MoZy50aXRsZSl9PC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+JHtnLmlkfSDCtyAke2cuY2xzfSDCtyByYWlzZWQgJHtnLnR9PC9kaXY+CiAgJHtmaW5CbG9jaz9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj48Yj5IQVJEIEJMT0NLLjwvYj4gRmluYW5jaWFsIHRyYW5zZmVyIHdpdGggbm8gcGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUaGUgc2VydmVyIHdpbGwgcmVqZWN0IGFwcHJvdmFsLjwvZGl2PmA6Jyd9CiAgJHtjb3N0QmxvY2s/YDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPlpFUk8tQ09TVCBET0NUUklORSBGTEFHLjwvYj4gVGhpcyBkZW1hbmRzICQke2cuY29zdH0uIFRoZSBDaGFpcm1hbiBkb2VzIG5vdCBwYXkuIEFwcHJvdmluZyBpcyBhbiBleHBsaWNpdCBPd25lciBvdmVycmlkZS4gRnJlZSByb3V0ZSBvbiByZWNvcmQ6IDxlbT4ke2VzYyhnLmZyZWV8fCdub25lJyl9PC9lbT48L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4xIMK3IE9iamVjdGl2ZTwvaDM+PGRpdj4ke2VzYyhnLm9iail9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjIgwrcgQWdlbnQgSnVzdGlmaWNhdGlvbjwvaDM+PGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXAiPiR7ZXNjKGcuanVzdCl9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjMgwrcgU2FmZWd1YXJkcyAmYW1wOyBSb2xsYmFjazwvaDM+PGRpdj4ke2VzYyhnLnNhZmUpfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PHNwYW4gY2xhc3M9InRhZyAke2cucmlzaz09PSdMT1cnPyd0LWdybic6J3QtcmVkJ30iPkJMQVNUICR7Zy5yaXNrfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke2cuY29zdD8ndC1yZWQnOid0LWdybid9Ij5DT1NUICR7Zy5jb3N0PyckJytnLmNvc3Q6JyQwLjAwJ308L3NwYW4+CiAgICR7Zy5hbXQ/YDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPkFUIFJJU0sgJCR7Zm10KGcuYW10KX08L3NwYW4+YDonJ30KICAgPHNwYW4gY2xhc3M9InRhZyAke2cuc3RhdHVzPT09J0FQUFJPVkVEJz8ndC1ncm4nOmcuc3RhdHVzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtnLnN0YXR1c308L3NwYW4+PC9kaXY+CiAgJHtnLnN0YXR1cz09PSdQRU5ESU5HJz9gPGRpdiBjbGFzcz0iZXJyIiBpZD0iZ0VyciI+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiAke2ZpbkJsb2NrPydkaXNhYmxlZCc6Jyd9IG9uY2xpY2s9ImRlY2lkZSgnJHtnLmlkfScsMSkiPiR7Y29zdEJsb2NrPydPVkVSUklERSAmYW1wOyBBVVRIT1JJWkUnOidBVVRIT1JJWkUgRVhFQ1VUSU9OJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWNpZGUoJyR7Zy5pZH0nLDApIj5ERU5ZICZhbXA7IFRFUk1JTkFURTwvYnV0dG9uPgogICAke2Nvc3RCbG9jaz9gPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXJvdXRlKCcke2cuaWR9JykiPlJFUk9VVEUgRlJFRTwvYnV0dG9uPmA6Jyd9CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmAKICA6YDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5SZXNvbHZlZCAke2VzYyhnLnJlc29sdmVkfHwnJyl9PC9zcGFuPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmB9YCk7Cn0KYXN5bmMgZnVuY3Rpb24gZGVjaWRlKGlkLG9rKXsKICBjb25zdCBlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnRXJyJyk7IGUudGV4dENvbnRlbnQ9Jyc7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9kZWNpZGUnLHtpZCxvazohIW9rfSk7CiAgICBjbG9zZU1vZGFsKCk7IHJlbmRlcigpOyBmbGFzaCgnR2F0ZSAnK2lkKycgcmVzb2x2ZWQnKTsKICB9Y2F0Y2goeCl7IGUudGV4dENvbnRlbnQ9eC5tZXNzYWdlIH0KfQphc3luYyBmdW5jdGlvbiByZXJvdXRlKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2dhdGUvcmVyb3V0ZScse2lkfSk7IGNsb3NlTW9kYWwoKTsgcmVuZGVyKCk7IGZsYXNoKCdSZXJvdXRlZCDCtyAkMC4wMCcpIH0KCi8qIC0tLS0tLS0tLS0gQUdFTlRTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmFnZW50cz0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbW1pc3Npb24gQWdlbnQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmFtZTwvc3Bhbj48aW5wdXQgaWQ9ImFOYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJMZWRnZXIgU2VudGluZWwiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QaWxsYXI8L3NwYW4+PHNlbGVjdCBpZD0iYVBpbCIgY2xhc3M9ImluIj4ke1BJTExBUlMubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9Ij4ke3AuaWR9IMK3ICR7cC5uYW1lfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PcGVyYXRpb25hbCBTY29wZTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImFSb2xlIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBlcm1pdHRlZCBUb29scyAoY29tbWEgc2VwYXJhdGVkKTwvc3Bhbj48aW5wdXQgaWQ9ImFUb29scyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29zdCBQb2xpY3k8L3NwYW4+PHNlbGVjdCBpZD0iYUNvc3QiIGNsYXNzPSJpbiI+CiAgIDxvcHRpb24+RlJFRS1USUVSLU9OTFk8L29wdGlvbj48b3B0aW9uPlNFTEYtSE9TVEVELU9OTFk8L29wdGlvbj48b3B0aW9uPk9XTkVSLU9WRVJSSURFLVBBSUQ8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb21taXNzaW9uKCkiPkNPTU1JU1NJT04gJmFtcDsgQklORDwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvc3RlciBEaXN0cmlidXRpb248L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCksbT1NYXRoLm1heCgxLC4uLlMuZmxvb3JzLm1hcCh4PT54LmFnZW50cykpOwogICByZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5hY3RpdmV9LyR7Zi5hZ2VudHN9PC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5hZ2VudHMvbSoxMDB9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFsbCBhZ2VudHMgaW5oZXJpdCB0aGUgWmVyby1Db3N0IERvY3RyaW5lIHVubGVzcyBzZXQgdG8gT1dORVItT1ZFUlJJREUtUEFJRC48L2Rpdj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5BY3RpdmUgUm9zdGVyIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+JHtTLmFnZW50cy5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RofSBBQ1RJVkU8L3NwYW4+PC9oMz4KICR7Uy5hZ2VudHMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+QWdlbnQ8L3RoPjx0aD5GbG9vcjwvdGg+PHRoPlRvb2xzPC90aD48dGg+Q29zdDwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICR7Uy5hZ2VudHMubWFwKGE9Pntjb25zdCBwPVBJTExBUlMuZmluZCh4PT54LmlkPT1hLnBpbGxhcklkKTtyZXR1cm4gYDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2EuaWR9PC90ZD4KICA8dGQ+PGI+JHtlc2MoYS5uYW1lKX08L2I+PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGEucm9sZSl9PC9kaXY+PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke3AuY2xzfSI+JHtwLmljb259ICR7YS5waWxsYXJJZH08L3NwYW4+PC90ZD4KICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2EudG9vbHMubWFwKGVzYykuam9pbignLCAnKX08L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7YS5jb3N0PT09J09XTkVSLU9WRVJSSURFLVBBSUQnPyd0LWFtYic6J3QtZ3JuJ30iPiR7YS5jb3N0fTwvc3Bhbj48L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7YS5zdGF0dXM9PT0nQUNUSVZFJz8ndC1ncm4nOid0LWRpbSd9Ij4ke2Euc3RhdHVzfTwvc3Bhbj48L3RkPgogIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InNob3dZYW1sKCcke2EuaWR9JykiPllBTUw8L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2coJyR7YS5pZH0nKSI+JHthLnN0YXR1cz09PSdBQ1RJVkUnPydTdXNwZW5kJzonUmVpbnN0YXRlJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJraWxsKCcke2EuaWR9JykiPktpbGw8L2J1dHRvbj48L3RkPjwvdHI+YH0pLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Sb3N0ZXIgZW1wdHkuPC9kaXY+J308L2Rpdj5gOwpmdW5jdGlvbiB5YW1sRm9yKGEpe2NvbnN0IHA9UElMTEFSUy5maW5kKHg9PnguaWQ9PWEucGlsbGFySWQpOwogcmV0dXJuIGBBZ2VudF9EZWZpbml0aW9uOgogIE5hbWU6ICIke2EubmFtZX0iCiAgUGlsbGFyOiAiJHtwLm5hbWV9IgogIFJvbGU6ICIke2Eucm9sZX0iCiAgUGVybWl0dGVkX1Rvb2xzOiBbJHthLnRvb2xzLm1hcCh0PT5gIiR7dH0iYCkuam9pbignLCAnKX1dCiAgU3VwZXJ2aXNvcjogIkNoYWlybWFuIEFnZW50IE9TIgogIEFnZW50X0lEOiAiJHthLmlkfSIKICBDb3N0X1BvbGljeTogIiR7YS5jb3N0fSIKICBDb21taXNzaW9uZWQ6ICIke2EudH0iCiAgSW5zdHJ1Y3Rpb246IHwKICAgIEV4ZWN1dGUgdGFza3Mgc3RyaWN0bHkgd2l0aGluIHNjb3BlLiBSZXBvcnQgYWxsIGxvZ3MsIGFub21hbGllcyBhbmQKICAgIGNvbXBsZXRpb24gbWV0cmljcyBkaXJlY3RseSB0byB0aGUgQ2hhaXJtYW4gdGVybWluYWwuIERvIG5vdCBhdHRlbXB0CiAgICB1bmFwcHJvdmVkIHNpZGUgZWZmZWN0cy4KICAgIFpFUk8tQ09TVCBET0NUUklORTogbmV2ZXIgcHVyY2hhc2UsIHN1YnNjcmliZSwgb3IgY29uc3VtZSBwYWlkIGNyZWRpdHMuCiAgICBJZiBhIHRvb2wsIHNpdGUgb3IgQVBJIGRlbWFuZHMgcGF5bWVudCwgaGFsdCwgZmluZCBhIGZyZWUsIG9wZW4tc291cmNlLAogICAgc2VsZi1ob3N0ZWQgb3IgZnJlZS10aWVyIGVxdWl2YWxlbnQsIGFuZCByZXBvcnQgdGhlIHN1YnN0aXR1dGlvbi4KICAgIEVzY2FsYXRlIHRvIHRoZSBDaGFpcm1hbiBvbmx5IGlmIG5vIGxhd2Z1bCBmcmVlIHJvdXRlIGV4aXN0cy4KICAgIEFueSBkZXBsb3ltZW50LCBzY2hlbWEgY2hhbmdlLCBjb2RlIG1vZGlmaWNhdGlvbiBvciBmaW5hbmNpYWwgdHJhbnNmZXIKICAgIG11c3QgYmUgcmFpc2VkIGFzIGEgUGVybWlzc2lvbiBHYXRlIGFuZCBmcm96ZW4gdW50aWwgT3duZXIgY2xlYXJhbmNlLmB9CmFzeW5jIGZ1bmN0aW9uIGNvbW1pc3Npb24oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9hZ2VudCcse25hbWU6YU5hbWUudmFsdWUudHJpbSgpLHBpbGxhcklkOithUGlsLnZhbHVlLHJvbGU6YVJvbGUudmFsdWUudHJpbSgpLAogICAgdG9vbHM6YVRvb2xzLnZhbHVlLnNwbGl0KCcsJykubWFwKHM9PnMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbiksY29zdDphQ29zdC52YWx1ZX0pOwogICByZW5kZXIoKTsgZmxhc2goJ0FnZW50IGJvdW5kJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBzaG93WWFtbChpZCl7Y29uc3QgYT1TLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCk7CiBtb2RhbChgPGgzPiR7ZXNjKGEubmFtZSl9PC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+JHthLmlkfSDCtyAke2Euc3RhdHVzfTwvZGl2PgogPHByZSBjbGFzcz0ieWFtbCI+JHtlc2MoeWFtbEZvcihhKSl9PC9wcmU+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxM3B4Ij4KIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb3B5WSgnJHthLmlkfScpIj5Db3B5IFlBTUw8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKX0KZnVuY3Rpb24gY29weVkoaWQpe25hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCh5YW1sRm9yKFMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKSkpO2ZsYXNoKCdZQU1MIGNvcGllZCcpfQphc3luYyBmdW5jdGlvbiB0b2coaWQpe2F3YWl0IEFQSSgnL2FwaS9hZ2VudC90b2dnbGUnLHtpZH0pO3JlbmRlcigpfQphc3luYyBmdW5jdGlvbiBraWxsKGlkKXtpZighY29uZmlybSgnRGVjb21taXNzaW9uICcraWQrJz8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2FnZW50L2tpbGwnLHtpZH0pO3JlbmRlcigpO2ZsYXNoKCdEZWNvbW1pc3Npb25lZCcpfQoKLyogLS0tLS0tLS0tLSBPUkcgQ0hBUlQgLS0tLS0tLS0tLSAqLwpSRU5ERVIub3JnY2hhcnQ9KCk9PmA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tbWFuZCBEZXBlbmRlbmN5IEdyYXBoPC9oMz48ZGl2IGNsYXNzPSJ0dyI+CiA8c3ZnIHZpZXdCb3g9IjAgMCA5MDAgNDMwIiBzdHlsZT0ibWluLXdpZHRoOjcyMHB4O3dpZHRoOjEwMCUiPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFyIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI4IiByZWZZPSIzIiBvcmllbnQ9ImF1dG8iPjxwYXRoIGQ9Ik0wLDAgTDAsNiBMOCwzIHoiIGZpbGw9InZhcigtLXN0cm9rZTIpIi8+PC9tYXJrZXI+PC9kZWZzPgogIDxyZWN0IHg9IjMxNSIgeT0iMTQiIHdpZHRoPSIyNzAiIGhlaWdodD0iNTIiIHJ4PSIxMCIgZmlsbD0idmFyKC0tZ2xhc3MyKSIgc3Ryb2tlPSIjNzg4QTFEIi8+CiAgPHRleHQgeD0iNDUwIiB5PSIzOCIgZmlsbD0iIzc4OEExRCIgZm9udC1zaXplPSIxMyIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q0hBSVJNQU4gQUdFTlQ8L3RleHQ+CiAgPHRleHQgeD0iNDUwIiB5PSI1NSIgZmlsbD0iIzZCNkQ2MiIgZm9udC1zaXplPSI5LjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkV4ZWN1dGl2ZSBDb21tYW5kIFRvd2VyIMK3IFplcm8tQ29zdCBBdXRob3JpdHk8L3RleHQ+CiAgJHtQSUxMQVJTLm1hcCgocCxpKT0+e2NvbnN0IHk9MTA0K2kqNjQsZj1mbG9vcihwLmlkKTtyZXR1cm4gYAogICA8cGF0aCBkPSJNNDUwLDY2IEM0NTAsJHt5LTIwfSAyNTAsJHt5LTIwfSAyNTAsJHt5KzE4fSIgc3Ryb2tlPSJ2YXIoLS1zdHJva2UyKSIgZmlsbD0ibm9uZSIgbWFya2VyLWVuZD0idXJsKCNhcikiLz4KICAgPHJlY3QgeD0iMjUwIiB5PSIke3l9IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQ2IiByeD0iOSIgZmlsbD0idmFyKC0tcGFuZWwpIiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIuNyIvPgogICA8dGV4dCB4PSIyNjgiIHk9IiR7eSsyMH0iIGZpbGw9InZhcigtLXR4dCkiIGZvbnQtc2l6ZT0iMTEuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLmljb259ICR7cC5pZH0uICR7cC5uYW1lfTwvdGV4dD4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMzV9IiBmaWxsPSIjNkI2RDYyIiBmb250LXNpemU9IjkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC51bml0c308L3RleHQ+CiAgIDx0ZXh0IHg9IjYzMiIgeT0iJHt5KzI4fSIgZmlsbD0iJHtwLmNvbG9yfSIgZm9udC1zaXplPSIxMCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9ImVuZCI+JHtmLmFnZW50c30gYWd0IMK3ICR7Zi5oZWFsdGh9JTwvdGV4dD5gfSkuam9pbignJyl9CiAgPHBhdGggZD0iTTY2MCwxMjcgQzc1MCwxMjcgNzUwLDQxNSA0NzAsNDE1IiBzdHJva2U9InZhcigtLXN0cm9rZTIpIiBmaWxsPSJub25lIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIG1hcmtlci1lbmQ9InVybCgjYXIpIi8+CiAgPHRleHQgeD0iNzA1IiB5PSIyODUiIGZpbGw9IiM5QTlDOTAiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5pbnNpZ2h0IOKGkiB0b3dlcjwvdGV4dD48L3N2Zz48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Fc2NhbGF0aW9uIExhdzwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPkVzY2FsYXRpb24gaXMgdXB3YXJkIG9ubHkuIE5vIGxhdGVyYWwgZmxvb3ItdG8tZmxvb3IgY29tbWFuZCB3aXRob3V0IGEgQ2hhaXJtYW4gZ2F0ZS48L2xpPgogIDxsaT5TZWN1cml0eSAmYW1wOyBBdWRpdCBob2xkcyB2ZXRvIG92ZXIgdGhlIHJlbWFpbmluZyBmb3VyIGZsb29ycyBhbmQgbWF5IGZyZWV6ZSBhbnkgZ2F0ZSBtaWQtZmxpZ2h0LjwvbGk+CiAgPGxpPk5vIHBhdGggZXhpc3RzIGZyb20gYSBwdWJsaWMgdXNlciB0byBhIGZsb29yLiBFdmVyeSByb3V0ZSB0ZXJtaW5hdGVzIGF0IHRoZSBDaGFpcm1hbi48L2xpPgogIDxsaT5BbnkgYWdlbnQgbWVldGluZyBhIHBheXdhbGwgaGFsdHMgYW5kIHJlcG9ydHMgdXB3YXJkIOKAlCBpdCBuZXZlciBzcGVuZHMuPC9saT48L3VsPjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNLSUxMUyAtLS0tLS0tLS0tICovClJFTkRFUi5za2lsbHM9KCk9Pntjb25zdCBtPXt9O1MuYWdlbnRzLmZvckVhY2goYT0+YS50b29scy5mb3JFYWNoKHQ9PnsobVt0XT1tW3RdfHxbXSkucHVzaChhLm5hbWUpfSkpOwogY29uc3Qgaz1PYmplY3Qua2V5cyhtKS5zb3J0KCk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Ub29sIFN1cmZhY2UgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke2subGVuZ3RofSBESVNUSU5DVDwvc3Bhbj48L2gzPgogPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPkV2ZXJ5IHRvb2wgaXMgYm91bmQgdG8gYXQgbGVhc3Qgb25lIGFnZW50IGFuZCBjb25zdHJhaW5lZCBieSB0aGF0IGFnZW50J3MgY29zdCBwb2xpY3kuIFVuYm91bmQgaW52b2NhdGlvbiBpcyBhbiB1bmFwcHJvdmVkIHNpZGUgZWZmZWN0LjwvZGl2PgogPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5Ub29sPC90aD48dGg+Qm91bmQgQWdlbnRzPC90aD48dGg+RXhwb3N1cmU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke2subWFwKHQ9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHQpfTwvYj48L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bVt0XS5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHttW3RdLmxlbmd0aD4yPyd0LWFtYic6J3QtZ3JuJ30iPiR7bVt0XS5sZW5ndGg+Mj8nV0lERSc6J05BUlJPVyd9PC9zcGFuPjwvdGQ+PC90cj5gKS5qb2luKCcnKXx8Jzx0cj48dGQgY29sc3Bhbj0iMyIgY2xhc3M9Im1vbm8tZGltIj5ub25lPC90ZD48L3RyPid9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CgovKiAtLS0tLS0tLS0tIFpFUk8gQ09TVCAtLS0tLS0tLS0tICovClJFTkRFUi56ZXJvY29zdD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKIhSBaRVJPLUNPU1QgRE9DVFJJTkUgwrcgQUJTT0xVVEU8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+VGhlIENoYWlybWFuIGRvZXMgbm90IHBheS48L2I+IE5vIHN1YnNjcmlwdGlvbnMsIG5vIGNyZWRpdCB0b3AtdXBzLCBubyBtZXRlcmVkIEFQSSBwdXJjaGFzZXMsIG5vIGNvbnZlcnRpbmcgdHJpYWxzLjwvbGk+CiAgIDxsaT5IaXR0aW5nIGEgcGF5d2FsbCwgYW4gYWdlbnQgPGI+aGFsdHM8L2I+LCBmaW5kcyBhIGZyZWUgLyBvcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIGVxdWl2YWxlbnQsIGFuZCByZXBvcnRzIHRoZSBzdWJzdGl0dXRpb24uPC9saT4KICAgPGxpPk5vIGZyZWUgcm91dGUg4oeSIHRoZSBDaGFpcm1hbiBzdGF0ZXMgcGxhaW5seSB0aGUgb2JqZWN0aXZlIGlzIHVucmVhY2hhYmxlIGF0IHplcm8gY29zdC4gSXQgbmV2ZXIgcXVpZXRseSBzcGVuZHMuPC9saT4KICAgPGxpPkZyZWUtdGllciByb3RhdGlvbiBhbmQgcXVvdGEgbWFuYWdlbWVudCBhcmUgbGVnaXRpbWF0ZS4gRnJhdWQsIHN0b2xlbiBrZXlzLCBsaWNlbmNlIHZpb2xhdGlvbiBhbmQgVG9TIGNpcmN1bXZlbnRpb24gYXJlIDxiPnJlZnVzZWQgb3V0cmlnaHQ8L2I+IGFuZCBsb2dnZWQgQ1JJVC48L2xpPgogICA8bGk+T3duZXIgbWF5IG92ZXJyaWRlIHBlci1nYXRlLiBPdmVycmlkZXMgaGl0IGEgdmlzaWJsZSBzcGVuZCBjb3VudGVyLCBuZXZlciBoaWRkZW4uPC9saT4KICAgPGxpPjxiPlByb29mLCBub3Qgc2xvZ2FuOjwvYj4gdGhpcyBiYWNrZW5kIHJ1bnMgb24gTm9kZSBjb3JlIG1vZHVsZXMgb25seSDigJQgMCBucG0gcGFja2FnZXMsIDAgcGFpZCBzZXJ2aWNlcywgMCBBUEkga2V5cy48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdBdXRob3JpemVkIFNwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ0xpZmV0aW1lJyl9CiAgJHtrcGkoUy5kZW5pYWxzLmxlbmd0aCwnUGFpZCBQYXRocyBJbnRlcmNlcHRlZCcsJ3ZhcigtLWFtYiknLCdCbG9ja2VkIG9yIHJlcm91dGVkJyl9CiAgJHtrcGkoJyQnK1MuZGVuaWFscy5yZWR1Y2UoKGEsYik9PmErYi5jb3N0LDApLnRvRml4ZWQoMiksJ1NwZW5kIEF2b2lkZWQnLCd2YXIoLS1ncm4pJywnRG9jdHJpbmUgc2F2aW5ncycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlN1YnN0aXR1dGlvbiBSb3V0aW5nIFRhYmxlPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogIDx0aGVhZD48dHI+PHRoPlBhaWQgRGVtYW5kPC90aD48dGg+RnJlZSBSb3V0ZTwvdGg+PHRoPk93bmluZyBBZ2VudDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke0ZSRUVfUk9VVEVTLm1hcCgoW2EsYixjXSk9PmA8dHI+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPiR7ZXNjKGEpfTwvc3Bhbj48L3RkPjx0ZD4ke2VzYyhiKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JbnRlcmNlcHRpb24gTG9nPC9oMz4ke1MuZGVuaWFscy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPk9wZXJhdGlvbjwvdGg+PHRoPkRlbWFuZGVkPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMuZGVuaWFsc10ucmV2ZXJzZSgpLm1hcChkPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC50fTwvdGQ+PHRkPiR7ZXNjKGQub3ApfTwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4kJHtkLmNvc3R9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYWlkIGRlbWFuZHMgZW5jb3VudGVyZWQgeWV0LjwvZGl2Pid9PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gRklOQU5DRVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZmluYW5jZXM9KCk9PnsKIGNvbnN0IHRvdD1TLnJldmVudWUucmVkdWNlKChhLGIpPT5hK2IuYW10LDApLGluZmxvdz1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKTsKIHJldHVybiBgJHshUy5wYXlvdXQ/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+U0FGRSBNT0RFPC9oMz4KICA8ZGl2Pk5vIHBheW91dCBjaGFubmVsIHNlYWxlZC4gVGhlIHNlcnZlciByZWplY3RzIGFwcHJvdmFsIG9uIGV2ZXJ5IHRyYW5zZmVyIGdhdGUuIENvbmZpZ3VyZSB0aGUgVmF1bHQgZmlyc3QuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPgogICR7a3BpKCckJytmbXQoaW5mbG93KSwnUmVjb3JkZWQgSW5mbG93JywndmFyKC0tZ3JuKScpfQogICR7a3BpKCckJytmbXQodG90KSwnTmV0IFBvc2l0aW9uJyx0b3Q8MD8ndmFyKC0tbWFnKSc6J3ZhcigtLXR4dCknKX0KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdUb3RhbCBTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdUYXJnZXQgJDAuMDAnKX0KICAke2twaShTLnJldmVudWUubGVuZ3RoLCdMZWRnZXIgTGluZXMnLCd2YXIoLS1ibHUpJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVjb3JkIFJldmVudWUgU3RyZWFtPC9oMz48ZGl2IGNsYXNzPSJncmlkIGczIj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNvdXJjZTwvc3Bhbj48aW5wdXQgaWQ9InJTcmMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlByZW1pdW0gY3JlZGl0cyDCtyBhcHAuZXhhbXBsZSI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFtb3VudCBVU0Q8L3NwYW4+PGlucHV0IGlkPSJyQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPiZuYnNwOzwvc3Bhbj48YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9IndpZHRoOjEwMCUiIG9uY2xpY2s9ImFkZFJldigpIj5QT1NUIFRPIExFREdFUjwvYnV0dG9uPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVxdWVzdCBQYXlvdXQ8L2gzPgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPlJhaXNlcyBhIEZJTkFOQ0lBTCBUUkFOU0ZFUiBnYXRlLiBSZXF1aXJlcyBzZWFsZWQgY2hhbm5lbCArIHBhc3N3b3JkIHNpZ25hdHVyZS4gMkZBIHRhcmdldCAke21hc2tNYWlsKFMub3duZXIuZW1haWwpfS48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBpZD0icEFtdCIgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIwMHB4IiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSJBbW91bnQgVVNEIj4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icmVxUGF5b3V0KCkiPlJBSVNFIFRSQU5TRkVSIEdBVEU8L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXZlbnVlIExlZGdlcjwvaDM+JHtTLnJldmVudWUubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5Tb3VyY2U8L3RoPjx0aCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+QW1vdW50PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMucmV2ZW51ZV0ucmV2ZXJzZSgpLm1hcChyPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ci50fTwvdGQ+PHRkPiR7ZXNjKHIuc3JjKX08L3RkPgogIDx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodDtjb2xvcjoke3IuYW10PDA/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7ci5hbXQ8MD8nLSc6JysnfSQke2ZtdChNYXRoLmFicyhyLmFtdCkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RyZWFtcyByZWNvcmRlZC48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBhZGRSZXYoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3JldmVudWUnLHtzcmM6clNyYy52YWx1ZS50cmltKCksYW10OityQW10LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ1Bvc3RlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXFQYXlvdXQoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3BheW91dC9yZXF1ZXN0Jyx7YW10OitwQW10LnZhbHVlfSk7Z28oJ2dhdGVzJyk7Zmxhc2goJ1RyYW5zZmVyIGdhdGUgcmFpc2VkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIFZBVUxUIC0tLS0tLS0tLS0gKi8KUkVOREVSLnBheW91dD0oKT0+YAogPGRpdiBjbGFzcz0id2FybmJveCI+SXNvbGF0ZWQgT3duZXItb25seSBwYW5lbC4gUmF3IHZhbHVlcyBhcmUgc2VudCBvbmNlIG92ZXIgdGhlIHNlc3Npb24sIG1hc2tlZCBpbW1lZGlhdGVseSwgYW5kIDxiPm5ldmVyIHBlcnNpc3RlZCBvciByZXR1cm5lZDwvYj4g4oCUIG9ubHkgdGhlIG1hc2tlZCB2aWV3IGFuZCBhIFNIQS0yNTYgZmluZ2VycHJpbnQgYXJlIHN0b3JlZC4gVGhlIENoYWlybWFuIHdpbGwgbmV2ZXIgcmVxdWVzdCB0aGVzZSBhbnl3aGVyZSBlbHNlLjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYW5uZWwgQ29uZmlndXJhdGlvbjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TWV0aG9kPC9zcGFuPjxzZWxlY3QgaWQ9InZUeXBlIiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJ2U3dhcCgpIj4KICAgIDxvcHRpb24gdmFsdWU9IkJBTksiPkJhbmsgV2lyZSAoU1dJRlQvSUJBTik8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJDUllQVE8iPkNyeXB0byBBZGRyZXNzPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CZW5lZmljaWFyeSBOYW1lPC9zcGFuPjxpbnB1dCBpZD0idk5hbWUiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBpZD0idkJhbmsiPjxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFjY291bnQgTnVtYmVyPC9zcGFuPjxpbnB1dCBpZD0idkFjYyIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JQkFOPC9zcGFuPjxpbnB1dCBpZD0idkliYW4iIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U1dJRlQgLyBCSUM8L3NwYW4+PGlucHV0IGlkPSJ2U3dpZnQiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFuayAmYW1wOyBDb3VudHJ5PC9zcGFuPjxpbnB1dCBpZD0idkJhbmtOYW1lIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxkaXYgaWQ9InZDcnlwdG8iIGNsYXNzPSJoaWRlIj48ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXR3b3JrPC9zcGFuPjxpbnB1dCBpZD0idk5ldCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iQlRDIC8gRVRIIC8gVFJPTiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QYXlvdXQgQWRkcmVzczwvc3Bhbj48aW5wdXQgaWQ9InZBZGRyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGVyLVRyYW5zZmVyIENlaWxpbmcgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJ2Q2FwIiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IjI1MDAwIj48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNlYWxWYXVsdCgpIj5TRUFMIENIQU5ORUw8L2J1dHRvbj4KICAke1MucGF5b3V0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlVmF1bHQoKSI+UHVyZ2UgQ2hhbm5lbDwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2VhbGVkIENoYW5uZWw8L2gzPiR7Uy5wYXlvdXQ/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICR7T2JqZWN0LmVudHJpZXMoUy5wYXlvdXQubWFza2VkKS5tYXAoKFtrLHZdKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPiR7ZXNjKGspfTwvdGQ+PHRkPiR7ZXNjKHYpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2VhbGVkPC90ZD48dGQ+JHtTLnBheW91dC50fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+MkZBIFRhcmdldDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj5gCiA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQ0hBTk5FTCBTRUFMRUQg4oCUIGVuZ2luZSBTQUZFIE1PREUuPC9kaXY+J308L2Rpdj5gOwpmdW5jdGlvbiB2U3dhcCgpe2NvbnN0IGM9dlR5cGUudmFsdWU9PT0nQ1JZUFRPJzt2QmFuay5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJyxjKTt2Q3J5cHRvLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCFjKX0KYXN5bmMgZnVuY3Rpb24gc2VhbFZhdWx0KCl7CiBjb25zdCBiPXt0eXBlOnZUeXBlLnZhbHVlLG5hbWU6dk5hbWUudmFsdWUudHJpbSgpLGNhcDordkNhcC52YWx1ZXx8MCwKICBhY2M6dkFjYz8udmFsdWUudHJpbSgpLGliYW46dkliYW4/LnZhbHVlLnRyaW0oKSxzd2lmdDp2U3dpZnQ/LnZhbHVlLnRyaW0oKSxiYW5rOnZCYW5rTmFtZT8udmFsdWUudHJpbSgpLAogIG5ldDp2TmV0Py52YWx1ZS50cmltKCksYWRkcjp2QWRkcj8udmFsdWUudHJpbSgpfTsKIHRyeXthd2FpdCBBUEkoJy9hcGkvdmF1bHQnLGIpO3JlbmRlcigpO2ZsYXNoKCdDaGFubmVsIHNlYWxlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBwdXJnZVZhdWx0KCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGNoYW5uZWw/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS92YXVsdC9wdXJnZScpO3JlbmRlcigpO2ZsYXNoKCdQdXJnZWQnKX0KCi8qIC0tLS0tLS0tLS0gQU5BTFlUSUNTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmFuYWx5dGljcz0oKT0+ewogY29uc3Qgc2V2PXtJTkZPOjAsT0s6MCxXQVJOOjAsQ1JJVDowfTtTLmxvZ3MuZm9yRWFjaChsPT5zZXZbbC5zZXZdPShzZXZbbC5zZXZdfHwwKSsxKTsKIGNvbnN0IG14PU1hdGgubWF4KDEsLi4uT2JqZWN0LnZhbHVlcyhzZXYpKTsKIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXZlbnQgU2V2ZXJpdHkgTWl4PC9oMz4ke09iamVjdC5lbnRyaWVzKHNldikubWFwKChbayx2XSk9PmA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3Bhbj4ke2t9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHt2fTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7di9teCoxMDB9JTtiYWNrZ3JvdW5kOiR7e0lORk86JyMzYjgyZjYnLE9LOicjMzFkNjdhJyxXQVJOOicjZmZiMDIwJyxDUklUOicjZmYzYjZiJ31ba119Ij48L2k+PC9kaXY+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBPdXRjb21lczwvaDM+JHtbJ1BFTkRJTkcnLCdBUFBST1ZFRCcsJ0RFTklFRCddLm1hcChzPT57Y29uc3QgYz1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PXMpLmxlbmd0aDsKICByZXR1cm4gYDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6N3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzEwMTgyMiI+CiAgPHNwYW4gY2xhc3M9InRhZyAke3M9PT0nQVBQUk9WRUQnPyd0LWdybic6cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7c308L3NwYW4+PGI+JHtjfTwvYj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFwcHJvdmFsIHJhdGUgaXMgbWVhbmluZ2xlc3Mgd2l0aG91dCBkZW5pYWwgcHJlc3N1cmUuIElmIG5vdGhpbmcgaXMgZXZlciBkZW5pZWQsIHRoZSBnYXRlIGlzIHRoZWF0cmUuPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Rmxvb3IgSGVhbHRoIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+TElWRTwvc3Bhbj48L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7cmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmhlYWx0aH0lPC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmhlYWx0aH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db3N0IERpc2NpcGxpbmU8L2gzPiR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ1NwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpfQogIDxkaXYgc3R5bGU9ImhlaWdodDoxMHB4Ij48L2Rpdj4ke2twaSgnJCcrUy5kZW5pYWxzLnJlZHVjZSgoYSxiKT0+YStiLmNvc3QsMCkudG9GaXhlZCgyKSwnQXZvaWRlZCcsJ3ZhcigtLWdybiknKX08L2Rpdj4KIDwvZGl2PmB9OwoKLyogLS0tLS0tLS0tLSBBVURJVCAtLS0tLS0tLS0tICovClJFTkRFUi5hdWRpdD0oKT0+YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206MTFweCI+CiA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Uy5sb2dzLmxlbmd0aH0gZW50cmllcyBzaG93biDCtyBwZXJzaXN0ZWQgc2VydmVyLXNpZGU8L3NwYW4+CiA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZXhwb3J0TG9nKCkiPkV4cG9ydCBKU09OPC9idXR0b24+CiA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InB1cmdlTG9ncygpIj5QdXJnZTwvYnV0dG9uPjwvZGl2PjwvZGl2PiR7bG9nSHRtbCg0MDApfTwvZGl2PmA7CmZ1bmN0aW9uIGV4cG9ydExvZygpe2NvbnN0IGI9bmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KFMubG9ncyxudWxsLDIpXSx7dHlwZTonYXBwbGljYXRpb24vanNvbid9KSx1PVVSTC5jcmVhdGVPYmplY3RVUkwoYiksYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7CiBhLmhyZWY9dTthLmRvd25sb2FkPSdjaGFpcm1hbi1hdWRpdC0nK0RhdGUubm93KCkrJy5qc29uJzthLmNsaWNrKCk7VVJMLnJldm9rZU9iamVjdFVSTCh1KTtmbGFzaCgnRXhwb3J0ZWQnKX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VMb2dzKCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGxlZGdlcj8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2xvZ3MvcHVyZ2UnKTtyZW5kZXIoKX0KCi8qIC0tLS0tLS0tLS0gQVJDSElURUNUOiBzdHVkeSBhIHByb2R1Y3QsIHJlYnVpbGQgdGhlIGNhcGFiaWxpdHkgLS0tLS0tLS0tLSAqLwpMSVZFLmFyY2g9KCk9PnsKICBjb25zdCBBPVMuYW5hbHlzZXN8fFtdLCBDPVMuY3Jld3N8fFtdOwogIGlmKCFBLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyBzdHVkaWVkIHlldC4gUGFzdGUgYSBVUkwgYWJvdmUuPC9kaXY+PC9kaXY+JzsKICByZXR1cm4gQS5tYXAoYT0+ewogICAgY29uc3QgY3Jldz1DLmZpbmQoYz0+Yy5hbmFseXNpc0lkPT09YS5pZCk7CiAgICBjb25zdCB2YyA9IGEudmVyZGljdD09PSdSRUJVSUxEQUJMRSc/J3QtZ3JuJzphLnZlcmRpY3Q9PT0nUEFSVElBTCc/J3QtYW1iJzondC1yZWQnOwogICAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7YS52ZXJkaWN0PT09J1JFQlVJTERBQkxFJz8ndmFyKC0tbGltZSknOgogICAgICAgIGEudmVyZGljdD09PSdQQVJUSUFMJz8ndmFyKC0tYW1iKSc6J3ZhcigtLW1hZyknfSI+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHt2Y30iPiR7ZXNjKGEudmVyZGljdCl9PC9zcGFuPgogICAgICAgPGI+JHtlc2MoYS51cmwpfTwvYj48L2Rpdj4KICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2EudH0ke2EucGFnZVJlYWQ/Jyc6JyDCtyBwYWdlIG5vdCByZWFkYWJsZSd9PC9zcGFuPjwvZGl2PgogICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGI+V2hhdCBpdCBkb2VzOjwvYj4gJHtlc2MoYS5kb2VzKX08L2Rpdj4KICAgICAke2Euam9icy5sZW5ndGg/YDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPlRIRSBKT0JTIElUIFBFUkZPUk1TPC9kaXY+CiAgICAgICA8b2wgc3R5bGU9Im1hcmdpbjo1cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4O2ZvbnQtc2l6ZToxMi41cHg7bGluZS1oZWlnaHQ6MS43Ij4KICAgICAgICR7YS5qb2JzLm1hcChqPT5gPGxpPiR7ZXNjKGopfTwvbGk+YCkuam9pbignJyl9PC9vbD48L2Rpdj5gOicnfQogICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgICAke2EucmV1c2UubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5BZ2VudHMgaGUgYWxyZWFkeSBoYXM8L3RkPgogICAgICAgIDx0ZD4ke2EucmV1c2UubWFwKHI9PmA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4ke2VzYyhyLmNhcCl9PC9zcGFuPiA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHIuZm9yKX08L3NwYW4+YCkuam9pbignPGJyPicpfTwvdGQ+PC90cj5gOicnfQogICAgICAke2EuYnVpbGQubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TXVzdCBiZSB3cml0dGVuPC90ZD4KICAgICAgICA8dGQ+JHthLmJ1aWxkLm1hcChiPT5gPGI+JHtlc2MoYi5uYW1lKX08L2I+IOKAlCAke2VzYyhiLmRlc2MpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhiLndoeV9uZWVkZWR8fCcnKX08L2Rpdj5gKS5qb2luKCc8YnI+Jyl9PC90ZD48L3RyPmA6Jyd9CiAgICAgICR7YS5uZWVkc0Nvbm5lY3Rvci5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5OZWVkcyBhIGNvbm5lY3RvcjwvdGQ+CiAgICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLm5lZWRzQ29ubmVjdG9yLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD48L3RyPmA6Jyd9CiAgICAgICR7YS5jYW5ub3REby5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Ib25lc3RseSBjYW5ub3QgZG88L3RkPgogICAgICAgIDx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHthLmNhbm5vdERvLm1hcChlc2MpLmpvaW4oJzxicj4nKX08L3RkPjwvdHI+YDonJ30KICAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgJHthLm5vdGU/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxiPkhpcyB2ZXJkaWN0OjwvYj4gJHtlc2MoYS5ub3RlKX08L2Rpdj5gOicnfQogICAgICR7Y3Jldz9gPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4O3BhZGRpbmc6MTFweDtiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyLXJhZGl1czoxMXB4Ij4KICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj5DUkVXIEFTU0VNQkxFRDwvZGl2PgogICAgICAgPGRpdj4ke2NyZXcucmV1c2UubGVuZ3RofSBleGlzdGluZyBhZ2VudChzKSByZXVzZWQke2NyZXcuYnVpbHQubGVuZ3RoP2AsICR7Y3Jldy5idWlsdC5sZW5ndGh9IG5ldyB3cml0dGVuOiA8Yj4ke2NyZXcuYnVpbHQubWFwKGVzYykuam9pbignLCAnKX08L2I+YDonJ308L2Rpdj4KICAgICAgICR7Y3Jldy5idWlsdC5sZW5ndGg/JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo1cHgiPk5ldyBvbmVzIGFyZSB3YWl0aW5nIGZvciB5b3VyIHRpY2sgb24gVGhlIENoYWlybWFuIHBhZ2UuPC9kaXY+JzonJ30KICAgICAgICR7Y3Jldy5za2lwcGVkLmxlbmd0aD9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpO21hcmdpbi10b3A6NXB4Ij5Ta2lwcGVkOiAke2NyZXcuc2tpcHBlZC5tYXAoZXNjKS5qb2luKCc7ICcpfTwvZGl2PmA6Jyd9CiAgICAgIDwvZGl2PmA6YDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYXNzZW1ibGUoJyR7YS5pZH0nKSI+QlVJTEQgVEhFIENSRVc8L2J1dHRvbj4KICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icm1BbmFseXNpcygnJHthLmlkfScpIj5EaXNjYXJkPC9idXR0b24+PC9kaXY+YH0KICAgIDwvZGl2PmA7CiAgfSkuam9pbignJyk7Cn07ClJFTkRFUi5hcmNoPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4qeJIENPUFkgQU5ZIFBST0RVQ1Qg4oCUIHRoZSBsZWdhbCB3YXk8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+UGFzdGUgYW55IHdlYnNpdGUgb3IgdG9vbC4gSGUgcmVhZHMgaXQsIHdvcmtzIG91dCA8Yj50aGUgam9iIGl0IGRvZXM8L2I+LCB0aGVuIHJlYnVpbGRzIHRoYXQgY2FwYWJpbGl0eSBmcm9tIGhpcyBvd24gYWdlbnRzIOKAlCByZXVzaW5nIHdoYXQgaGUgaGFzLCB3cml0aW5nIG9ubHkgd2hhdCBpcyBtaXNzaW5nLjwvZGl2PgogIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPkhlIHJlYnVpbGRzIHRoZSBvdXRjb21lLCBuZXZlciB0aGUgY29kZS48L2I+IENvcHlpbmcgc29tZW9uZSdzIHNvdXJjZSBpcyBwaXJhY3kgYW5kIGdldHMgeW91IHN1ZWQuIEJ1aWxkaW5nIGEgdG9vbCB0aGF0IGRvZXMgdGhlIHNhbWUgam9iIGlzIGhvdyBldmVyeSBjb21wZXRpdG9yIGluIGhpc3RvcnkgaGFzIGJlZW4gbWFkZSDigJQgY29tcGxldGVseSBsZWdhbCwgYW5kIGl0IG1lYW5zIHlvdSBvd24gd2hhdCB5b3UgYnVpbGQuPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT5SZXVzZXMgZXhpc3RpbmcgYWdlbnRzIGZpcnN0LiBIZSBvbmx5IHdyaXRlcyBuZXcgY29kZSB3aGVuIG5vdGhpbmcgY292ZXJzIHRoZSBqb2IuPC9saT4KICAgPGxpPkFnZW50cyB3b3JrIGFjcm9zcyBqb2JzLCBsaWtlIHN0YWZmIG1vdmluZyBiZXR3ZWVuIGJyYW5jaGVzLjwvbGk+CiAgIDxsaT5IZSBzdGF0ZXMgcGxhaW5seSB3aGF0IDxiPmNhbm5vdDwvYj4gYmUgcmVidWlsdCBmcmVlIOKAlCBHUFVzLCBsaWNlbmNlcywgZGF0YXNldHMsIGh1bWFuIGp1ZGdlbWVudC48L2xpPgogIDwvdWw+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8ZGl2IGNsYXNzPSJncmlkIGcyIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XZWJzaXRlIG9yIHByb2R1Y3Q8L3NwYW4+CiAgICA8aW5wdXQgaWQ9ImFyVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL3VwdGltZXJvYm90LmNvbSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Bbnl0aGluZyBoZSBzaG91bGQga25vdyAob3B0aW9uYWwpPC9zcGFuPgogICAgPGlucHV0IGlkPSJhckhpbnQiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Ikkgb25seSBjYXJlIGFib3V0IHRoZSBhbGVydGluZyBwYXJ0Ij48L2xhYmVsPgogIDwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFuYWx5c2UoKSI+U1RVRFkgSVQ8L2J1dHRvbj4KICAgJHtbJ2h0dHBzOi8vdXB0aW1lcm9ib3QuY29tJywnaHR0cHM6Ly9tYWlsY2hpbXAuY29tJywnaHR0cHM6Ly9idWZmZXIuY29tJywnaHR0cHM6Ly9jYWxlbmRseS5jb20nXQogICAgIC5tYXAodT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iYXJVcmwudmFsdWU9JyR7dX0nO2FuYWx5c2UoKSI+JHt1LnJlcGxhY2UoJ2h0dHBzOi8vJywnJyl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGFrZXMgYWJvdXQgMzAgc2Vjb25kcyDigJQgaGUgcmVhZHMgdGhlaXIgcGFnZSBhbmQgc2VhcmNoZXMgd2hhdCB1c2VycyBzYXkuPC9kaXY+CiA8L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJhcmNoIj4ke0xJVkUuYXJjaCgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGFuYWx5c2UoKXsKICBjb25zdCB1PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXJVcmwnKXx8e30pLnZhbHVlfHwnJzsKICBpZighdS50cmltKCkpIHJldHVybiBmbGFzaCgnUGFzdGUgYSBVUkwgZmlyc3QnKTsKICBmbGFzaCgnU3R1ZHlpbmcgaXQg4oCUIHJlYWRpbmcgdGhlaXIgcGFnZSBhbmQgc2VhcmNoaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9hcmNoaXRlY3QvYW5hbHlzZScse3VybDp1LGhpbnQ6KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhckhpbnQnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1ZlcmRpY3Q6ICcrci52ZXJkaWN0KTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGFzc2VtYmxlKGlkKXsKICBmbGFzaCgnQnVpbGRpbmcgdGhlIGNyZXcg4oCUIHdyaXRpbmcgYW55IG1pc3NpbmcgYWdlbnRz4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9hcmNoaXRlY3QvYXNzZW1ibGUnLHtpZH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIucmV1c2VkKycgcmV1c2VkLCAnK3IuYnVpbHQrJyB3cml0dGVuJysoci5idWlsdD8nIOKAlCB0aWNrIHRoZW0gdG8gaW5zdGFsbCc6JycpKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJtQW5hbHlzaXMoaWQpeyBhd2FpdCBBUEkoJy9hcGkvYXJjaGl0ZWN0L3JlbW92ZScse2lkfSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gV09SS1NQQUNFOiBmaWxlcyBpbiwgd3JpdGluZyBvdXQgLS0tLS0tLS0tLSAqLwpjb25zdCBLSU5EUz1bWydlbWFpbCcsJ0VtYWlsJ10sWyd3aGF0c2FwcCcsJ1doYXRzQXBwJ10sWydyZXBseScsJ1JlcGx5IHRvIGEgbWVzc2FnZSddLAogICAgICAgICAgICAgWydwcm9wb3NhbCcsJ1Byb3Bvc2FsJ10sWydpbnZvaWNlJywnSW52b2ljZSddLFsnc3VtbWFyeScsJ1N1bW1hcnknXSxbJ2RvYycsJ0RvY3VtZW50J11dOwpMSVZFLndvcmsyPSgpPT57CiAgY29uc3QgRD1TLmRvY3N8fFtdLCBSPVMuZHJhZnRzfHxbXTsKICByZXR1cm4gYCR7RC5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Zb3VyIEZpbGVzIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7RC5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+RmlsZTwvdGg+PHRoPlJlYWQ8L3RoPjx0aD5TaXplPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0QubWFwKGQ9PmA8dHI+PHRkPjxiPiR7ZXNjKGQubmFtZSl9PC9iPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLnByZXZpZXcpLnNsaWNlKDAsOTApfeKApjwvZGl2PjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2QucmVhZGFibGU/J3QtZ3JuJzondC1hbWInfSI+JHtkLnJlYWRhYmxlP2ZtdChkLmNoYXJzKSsnIGNoYXJzJzonTk9UIFJFQURBQkxFJ308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7KGQuc2l6ZS8xMDI0KS50b0ZpeGVkKDApfSBLQjwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9ImFza0RvYygnJHtkLmlkfScpIj5Bc2sgYWJvdXQgaXQ8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InJtRG9jKCcke2QuaWR9JykiPlJlbW92ZTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmA6Jyd9CiAgJHtSLmxlbmd0aD9SLm1hcChkPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7ZXNjKGQua2luZCl9PC9zcGFuPjxiPiR7ZXNjKGQuYnJpZWYpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZC50fSR7ZC5zZW50VG8/JyDCtyBTRU5UIHRvICcrZXNjKGQuc2VudFRvKTonJ308L3NwYW4+PC9kaXY+CiAgICA8ZGl2IGlkPSJkcmZfJHtkLmlkfSIgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNztiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7CiAgICAgIGJvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjExcHg7cGFkZGluZzoxNHB4Ij4ke2VzYyhkLnRleHQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29weURyYWZ0KCcke2QuaWR9JykiPkNvcHk8L2J1dHRvbj4KICAgICAke2Qua2luZD09PSdlbWFpbCcmJiFkLnNlbnRUbz9gPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMzBweCIgaWQ9InRvXyR7ZC5pZH0iIHBsYWNlaG9sZGVyPSJzZW5kIHRvIGVtYWlsIj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJzZW5kRHJhZnQoJyR7ZC5pZH0nKSI+U2VuZCBpdDwvYnV0dG9uPmA6Jyd9CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybURyYWZ0KCcke2QuaWR9JykiPkRlbGV0ZTwvYnV0dG9uPjwvZGl2PgogICA8L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIHdyaXR0ZW4geWV0LjwvZGl2PjwvZGl2Pid9YDsKfTsKUkVOREVSLndvcmsyPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4pyJIEZJTEVTICZhbXA7IFdSSVRJTkcg4oCUIHlvdXIgZXZlcnlkYXkgYXNzaXN0YW50PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPlVwbG9hZCBhIGZpbGUgYW5kIGFzayBoaW0gYWJvdXQgaXQuIE9yIHRlbGwgaGltIHdoYXQgdG8gd3JpdGUg4oCUIGVtYWlsLCBXaGF0c0FwcCwgcHJvcG9zYWwsIGludm9pY2Ug4oCUIGFuZCBoZSBkcmFmdHMgaXQgcmVhZHkgdG8gY29weSBvciBzZW5kLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VXBsb2FkIGEgZmlsZTwvc3Bhbj4KICAgICA8aW5wdXQgdHlwZT0iZmlsZSIgaWQ9InVwRmlsZSIgY2xhc3M9ImluIiBvbmNoYW5nZT0iZG9VcGxvYWQoKSI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj5SZWFkcyB0eHQsIG1kLCBjc3YsIGpzb24sIGxvZywgaHRtbCBhbmQgdGV4dC1iYXNlZCBQREZzLiBNYXggOCBNQi4gU2Nhbm5lZCBQREZzIGFuZCBpbWFnZXMgY2Fubm90IGJlIHJlYWQg4oCUIGhlIHdpbGwgc2F5IHNvIHJhdGhlciB0aGFuIGd1ZXNzLjwvZGl2PgogICA8L2Rpdj4KICAgPGRpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBzaG91bGQgaGUgd3JpdGU/PC9zcGFuPgogICAgIDxzZWxlY3QgaWQ9ImRrS2luZCIgY2xhc3M9ImluIj4ke0tJTkRTLm1hcChrPT5gPG9wdGlvbiB2YWx1ZT0iJHtrWzBdfSI+JHtrWzFdfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRlbGwgaGltIHdoYXQgaXQgaXMgYWJvdXQ8L3NwYW4+CiAgICAgPHRleHRhcmVhIGlkPSJka0JyaWVmIiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjY0cHgiIHBsYWNlaG9sZGVyPSJlLmcuIGVtYWlsIHRvIGEgTHVkaGlhbmEgc2hvcCBvd25lciBvZmZlcmluZyAxNCBkYXlzIGZyZWUgd2Vic2l0ZSBtb25pdG9yaW5nIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJ3cml0ZURyYWZ0KCkiPldSSVRFIElUPC9idXR0b24+CiAgICAgJHsoUy5kb2NzfHxbXSkubGVuZ3RoP2A8bGFiZWwgY2xhc3M9Im1vbm8tZGltIj48aW5wdXQgdHlwZT0iY2hlY2tib3giIGlkPSJ1c2VEb2NzIj4gdXNlIG15IHVwbG9hZGVkIGZpbGVzPC9sYWJlbD5gOicnfTwvZGl2PgogICA8L2Rpdj4KICA8L2Rpdj4KIDwvZGl2PgogPGRpdiBkYXRhLWxpdmU9IndvcmsyIj4ke0xJVkUud29yazIoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBkb1VwbG9hZCgpewogIGNvbnN0IGY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1cEZpbGUnKXx8e30pLmZpbGVzPy5bMF07CiAgaWYoIWYpIHJldHVybjsKICBpZihmLnNpemU+OGU2KSByZXR1cm4gZmxhc2goJ1RvbyBsYXJnZSDigJQgOCBNQiBtYXhpbXVtJyk7CiAgZmxhc2goJ1JlYWRpbmcgJytmLm5hbWUrJ+KApicpOwogIGNvbnN0IHJkPW5ldyBGaWxlUmVhZGVyKCk7CiAgcmQub25sb2FkPWFzeW5jKCk9PnsKICAgIHRyeXsKICAgICAgY29uc3QgYjY0PVN0cmluZyhyZC5yZXN1bHQpLnNwbGl0KCcsJylbMV07CiAgICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvYy91cGxvYWQnLHtuYW1lOmYubmFtZSxtaW1lOmYudHlwZSxkYXRhOmI2NH0pOwogICAgICByZW5kZXIoKTsgZmxhc2goci5yZWFkYWJsZT8oJ1JlYWQgJytmbXQoci5jaGFycykrJyBjaGFyYWN0ZXJzJyk6J1VwbG9hZGVkLCBidXQgdGhlIHRleHQgY291bGQgbm90IGJlIGV4dHJhY3RlZCcpOwogICAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KICB9OwogIHJkLnJlYWRBc0RhdGFVUkwoZik7Cn0KYXN5bmMgZnVuY3Rpb24gcm1Eb2MoaWQpeyBhd2FpdCBBUEkoJy9hcGkvZG9jL3JlbW92ZScse2lkfSk7IHJlbmRlcigpIH0KZnVuY3Rpb24gYXNrRG9jKGlkKXsKICBtb2RhbChgPGgzPkFzayBhYm91dCB0aGlzIGZpbGU8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPllvdXIgcXVlc3Rpb248L3NwYW4+CiAgICA8aW5wdXQgaWQ9ImRxUSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0id2hhdCBhcmUgdGhlIGtleSBwb2ludHM/Ij48L2xhYmVsPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJydW5Bc2tEb2MoJyR7aWR9JykiPkFTSzwvYnV0dG9uPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+CiAgIDxkaXYgaWQ9ImRxT3V0IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48L2Rpdj5gKTsKfQphc3luYyBmdW5jdGlvbiBydW5Bc2tEb2MoaWQpewogIGNvbnN0IHE9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcVEnKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCBvdXQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RxT3V0Jyk7CiAgb3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0ibW9uby1kaW0iPlJlYWRpbmfigKY8L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9jL2Fzaycse2lkLHF1ZXN0aW9uOnF9KTsKICAgIG91dC5pbm5lckhUTUw9YDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjUiPiR7ZXNjKHIudGV4dCl9PC9kaXY+YDsKICB9Y2F0Y2goZSl7IG91dC5pbm5lckhUTUw9YDxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+YCB9Cn0KYXN5bmMgZnVuY3Rpb24gd3JpdGVEcmFmdCgpewogIGNvbnN0IGJyaWVmPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGtCcmllZicpfHx7fSkudmFsdWV8fCcnOwogIGlmKCFicmllZi50cmltKCkpIHJldHVybiBmbGFzaCgnVGVsbCBoaW0gd2hhdCBpdCBpcyBhYm91dCcpOwogIGNvbnN0IHVzZT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VzZURvY3MnKXx8e30pLmNoZWNrZWQ7CiAgZmxhc2goJ1dyaXRpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9kcmFmdC93cml0ZScse2tpbmQ6ZGtLaW5kLnZhbHVlLGJyaWVmLAogICAgICBkb2NJZHM6dXNlPyhTLmRvY3N8fFtdKS5tYXAoZD0+ZC5pZCk6W119KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnV3JpdHRlbiDigJQgY29weSBpdCBvciBzZW5kIGl0Jyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBjb3B5RHJhZnQoaWQpeyBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJmXycraWQpOwogIG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dChlbD9lbC5pbm5lclRleHQ6JycpOyBmbGFzaCgnQ29waWVkJykgfQphc3luYyBmdW5jdGlvbiBzZW5kRHJhZnQoaWQpewogIGNvbnN0IHRvPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9fJytpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXRvLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIHRoZSByZWNpcGllbnQgZW1haWwnKTsKICBmbGFzaCgnU2VuZGluZ+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2RyYWZ0L3NlbmQnLHtpZCx0b30pOyByZW5kZXIoKTsgZmxhc2goJ1NlbnQnKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJtRHJhZnQoaWQpeyBhd2FpdCBBUEkoJy9hcGkvZHJhZnQvcmVtb3ZlJyx7aWR9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBDT05ORUNUT1JTIC0tLS0tLS0tLS0gKi8KY29uc3QgUFJFU0VUUz1bCiBbJ2RlZXBzZWVrJywnaHR0cHM6Ly9hcGkuZGVlcHNlZWsuY29tJywnYmVhcmVyJywnRGVlcFNlZWsg4oCUIGNoZWFwZXN0IGNhcGFibGUgbW9kZWwsIH7igrkzMC9tbyBvZiB1c2UnXSwKIFsnb3BlbndlYXRoZXInLCdodHRwczovL2FwaS5vcGVud2VhdGhlcm1hcC5vcmcvZGF0YS8yLjUnLCdxdWVyeScsJ1dlYXRoZXIg4oCUIGZyZWUgdGllciddLAogWyduZXdzYXBpJywnaHR0cHM6Ly9uZXdzYXBpLm9yZy92MicsJ2hlYWRlcicsJ05ld3MgaGVhZGxpbmVzIOKAlCBmcmVlIHRpZXInXSwKIFsndGVsZWdyYW0nLCdodHRwczovL2FwaS50ZWxlZ3JhbS5vcmcnLCdub25lJywnVGVsZWdyYW0gYm90IOKAlCBmcmVlLCBwdXQgdGhlIHRva2VuIGluIHRoZSBiYXNlIFVSTCddLAogWydzaGVldHMnLCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NCcsJ2JlYXJlcicsJ0dvb2dsZSBTaGVldHMg4oCUIGxvZyByZXN1bHRzIHRvIGEgc3ByZWFkc2hlZXQnXSwKIFsndW5zcGxhc2gnLCdodHRwczovL2FwaS51bnNwbGFzaC5jb20nLCdoZWFkZXInLCdGcmVlIHN0b2NrIGltYWdlcyBmb3IgdGhlIHNpdGVzIGhlIGJ1aWxkcyddCl07CkxJVkUuY29ubmVjdD0oKT0+ewogIGNvbnN0IEM9Uy5jb25uZWN0b3JzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShDLmxlbmd0aCwnQ29ubmVjdG9ycycsJ3ZhcigtLWxpbWUpJyxDLmZpbHRlcihjPT5jLmVuYWJsZWQpLmxlbmd0aCsnIGVuYWJsZWQnKX0KICAgJHtrcGkoZm10KEMucmVkdWNlKChhLGMpPT5hK2MuY2FsbHMsMCkpLCdDYWxscyBNYWRlJywndmFyKC0tb2xpdmUpJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoQy5yZWR1Y2UoKGEsYyk9PmErYy5mYWlscywwKSwnRmFpbHVyZXMnLEMuc29tZShjPT5jLmZhaWxzKT8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCcnKX08L2Rpdj4KICAke0MubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdGVkIFNlcnZpY2VzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogICA8dGhlYWQ+PHRyPjx0aD5OYW1lPC90aD48dGg+RW5kcG9pbnQ8L3RoPjx0aD5BdXRoPC90aD48dGg+S2V5PC90aD48dGg+VXNlZDwvdGg+PHRoPlN0YXRlPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0MubWFwKGM9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1saW1lKSI+JHtlc2MoYy5uYW1lKX08L2I+CiAgICAgJHtjLm5vdGU/YDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLm5vdGUpfTwvZGl2PmA6Jyd9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMuYmFzZSl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLmF1dGgpfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLmtleSl9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7Yy5jYWxsc30ke2MuZmFpbHM/JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+LycrYy5mYWlscysn4pyXPC9zcGFuPic6Jyd9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Yy5lbmFibGVkPyd0LWdybic6J3QtZGltJ30iPiR7Yy5lbmFibGVkPydPTic6J09GRid9PC9zcGFuPjwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0ZXN0Q29ubignJHtlc2MoYy5uYW1lKX0nKSI+VGVzdDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nZ2xlQ29ubignJHtlc2MoYy5uYW1lKX0nKSI+JHtjLmVuYWJsZWQ/J0Rpc2FibGUnOidFbmFibGUnfTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icm1Db25uKCcke2VzYyhjLm5hbWUpfScpIj5SZW1vdmU8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmA6Jyd9YDsKfTsKUkVOREVSLmNvbm5lY3Q9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7imq8gQ09OTkVDVE9SUyDigJQgR0lWRSBISU0gQU5ZIFNFUlZJQ0U8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+QWRkIDxiPmFueSBBUEk8L2I+IHdpdGggYSBrZXkuIEhlIGNhbiB0aGVuIGNhbGwgaXQgZnJvbSB0aGUgY2FwYWJpbGl0aWVzIGhlIHdyaXRlcyDigJQgYnV0IHRoZSBrZXkgaXRzZWxmIGlzIG5ldmVyIHNob3duIHRvIGhpcyBjb2RlLCBuZXZlciByZXR1cm5lZCBieSB0aGUgQVBJLCBhbmQgbmV2ZXIgd3JpdHRlbiB0byB0aGUgbGVkZ2VyLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+VXAgdG8gNDAgY29ubmVjdG9ycy4gQW55IFJFU1Qgc2VydmljZSB0aGF0IHJldHVybnMgSlNPTi48L2xpPgogICA8bGk+Rm91ciBhdXRoIHN0eWxlczogQmVhcmVyIHRva2VuLCBjdXN0b20gaGVhZGVyLCBxdWVyeSBwYXJhbWV0ZXIsIG9yIG5vbmUuPC9saT4KICAgPGxpPkhlIHNlZXMgb25seSB0aGUgPGI+bmFtZTwvYj4gYW5kIHdoYXQgaXQgZG9lcyDigJQgdGhlbiBjYWxscyA8Y29kZT5hcGkuY2FsbCgnbmFtZScsIHtwYXRofSk8L2NvZGU+LjwvbGk+CiAgPC91bD4KICA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TaG9ydCBuYW1lPC9zcGFuPjxpbnB1dCBpZD0iY25OYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJkZWVwc2VlayI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CYXNlIFVSTDwvc3Bhbj48aW5wdXQgaWQ9ImNuQmFzZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly9hcGkuZGVlcHNlZWsuY29tIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkF1dGggc3R5bGU8L3NwYW4+PHNlbGVjdCBpZD0iY25BdXRoIiBjbGFzcz0iaW4iPgogICAgPG9wdGlvbiB2YWx1ZT0iYmVhcmVyIj5CZWFyZXIgdG9rZW48L29wdGlvbj48b3B0aW9uIHZhbHVlPSJoZWFkZXIiPkN1c3RvbSBoZWFkZXI8L29wdGlvbj4KICAgIDxvcHRpb24gdmFsdWU9InF1ZXJ5Ij5RdWVyeSBwYXJhbWV0ZXI8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJub25lIj5ObyBrZXkgbmVlZGVkPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BUEkga2V5PC9zcGFuPjxpbnB1dCBpZD0iY25LZXkiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkhlYWRlciAvIHF1ZXJ5IG5hbWU8L3NwYW4+PGlucHV0IGlkPSJjbkhkciIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iWC1BUEktS2V5IG9yIGtleSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGlzIGl0IGZvcj88L3NwYW4+PGlucHV0IGlkPSJjbk5vdGUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImNoZWFwIG1vZGVsIGZvciBidWxrIHdyaXRpbmciPjwvbGFiZWw+CiAgPC9kaXY+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFkZENvbm4oKSI+QUREIENPTk5FQ1RPUjwvYnV0dG9uPgogIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+UXVpY2sgZmlsbDo8L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij4ke1BSRVNFVFMubWFwKChwLGkpPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJwcmVzZXQoJHtpfSkiPiR7ZXNjKHBbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iY29ubmVjdCI+JHtMSVZFLmNvbm5lY3QoKX08L2Rpdj5gOwpmdW5jdGlvbiBwcmVzZXQoaSl7IGNvbnN0IHA9UFJFU0VUU1tpXTsKICBjbk5hbWUudmFsdWU9cFswXTsgY25CYXNlLnZhbHVlPXBbMV07IGNuQXV0aC52YWx1ZT1wWzJdOyBjbk5vdGUudmFsdWU9cFszXTsKICBmbGFzaCgnRmlsbGVkIOKAlCBub3cgcGFzdGUgdGhlIGtleScpOyB9CmFzeW5jIGZ1bmN0aW9uIGFkZENvbm4oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9jb25uZWN0b3IvYWRkJyx7bmFtZTpjbk5hbWUudmFsdWUsYmFzZTpjbkJhc2UudmFsdWUsYXV0aDpjbkF1dGgudmFsdWUsCiAgICAgIGtleTpjbktleS52YWx1ZSxoZWFkZXJOYW1lOmNuSGRyLnZhbHVlLHF1ZXJ5TmFtZTpjbkhkci52YWx1ZSxub3RlOmNuTm90ZS52YWx1ZX0pOwogICAgY25LZXkudmFsdWU9Jyc7IHJlbmRlcigpOyBmbGFzaCgnQ29ubmVjdG9yIGFkZGVkIOKAlCBoZSBjYW4gdXNlIGl0IG5vdycpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcm1Db25uKG4peyBpZighY29uZmlybSgnUmVtb3ZlICcrbisnPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL2Nvbm5lY3Rvci9yZW1vdmUnLHtuYW1lOm59KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVDb25uKG4peyBhd2FpdCBBUEkoJy9hcGkvY29ubmVjdG9yL3RvZ2dsZScse25hbWU6bn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRlc3RDb25uKG4peyBmbGFzaCgnVGVzdGluZyAnK24rJ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvY29ubmVjdG9yL3Rlc3QnLHtuYW1lOm59KTsKICAgIG1vZGFsKGA8aDM+JHtlc2Mobil9IHJlc3BvbmRlZDwvaDM+PHByZSBjbGFzcz0ieWFtbCI+JHtlc2Moci5zYW1wbGUpfTwvcHJlPgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBUSEUgQ0hBSVJNQU4nUyBERVNLIOKAlCBvbmUgcGFnZSwgaGUgYXNrcywgeW91IHRpY2sgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiBhc2tDYXJkKGtpbmQsIGlkLCB0aXRsZSwgYm9keSwgbWV0YSwgZXh0cmEpewogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1hbWIpIj4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5IRSBJUyBBU0tJTkc8L3NwYW4+PGIgc3R5bGU9ImZvbnQtc2l6ZToxNC41cHgiPiR7ZXNjKHRpdGxlKX08L2I+PC9kaXY+CiAgICAke21ldGE/YDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobWV0YSl9PC9zcGFuPmA6Jyd9PC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweDtsaW5lLWhlaWdodDoxLjY1Ij4ke2JvZHl9PC9kaXY+CiAgICR7ZXh0cmF8fCcnfQogICA8ZGl2IGNsYXNzPSJyb3ciPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBzdHlsZT0iZm9udC1zaXplOjE1cHg7cGFkZGluZzoxMXB4IDI2cHgiIG9uY2xpY2s9InNheSgnJHtraW5kfScsJyR7aWR9JywxKSI+4pyUICZuYnNwO1lFUzwvYnV0dG9uPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBzdHlsZT0iZm9udC1zaXplOjE1cHg7cGFkZGluZzoxMXB4IDI2cHgiIG9uY2xpY2s9InNheSgnJHtraW5kfScsJyR7aWR9JywwKSI+4pyVICZuYnNwO05PPC9idXR0b24+CiAgIDwvZGl2PjwvZGl2PmA7Cn0KTElWRS5kZXNrPSgpPT57CiAgY29uc3QgZ2F0ZXMgPSAoUy5nYXRlc3x8W10pLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJyk7CiAgY29uc3QgdXBzICAgPSAoUy5wcm9wb3NhbHN8fFtdKS5maWx0ZXIocD0+cC5zdGF0dXM9PT0nUEVORElORycpOwogIGNvbnN0IGpvYnMgID0gKFMubWlzc2lvbnN8fFtdKS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nT1BFTicpOwogIGNvbnN0IGFza3MgID0gZ2F0ZXMubGVuZ3RoICsgdXBzLmxlbmd0aDsKICBjb25zdCB0ID0gUy50ZWxlbWV0cnl8fHt9OwogIGNvbnN0IGRvd24gPSAoUy5tb25pdG9yc3x8W10pLmZpbHRlcihtPT5tLnN0YXRlPT09J0RPV04nKTsKCiAgbGV0IGh0bWwgPSAnJzsKCiAgLyogMC4gaWYgdGhlIHdvcmsgaXMgbm90IGJlaW5nIHNhdmVkLCBub3RoaW5nIGVsc2Ugb24gdGhpcyBwYWdlIG1hdHRlcnMgKi8KICBjb25zdCBzdCA9IFMuc3RvcmFnZXx8e307CiAgaWYoc3QubGV2ZWw9PT0nQ1JJVCcpewogICAgaHRtbCArPSBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjA2KSI+CiAgICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7imqAgWU9VUiBXT1JLIElTIE5PVCBCRUlORyBTQVZFRDwvaDM+CiAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPiR7ZXNjKHN0Lm1zZ3x8JycpfTwvZGl2PgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZ28oJ3N0b3JhZ2UnKSI+RklYIElUIOKAlCA2IG1pbnV0ZXMsIGZyZWUsIHBlcm1hbmVudDwvYnV0dG9uPjwvZGl2PmA7CiAgfQoKICAvKiAxLiBldmVyeXRoaW5nIGhlIG5lZWRzIGEgeWVzIG9yIG5vIG9uICovCiAgaWYoYXNrcyl7CiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLHJnYmEoMjU1LDE3OSw2NCwuMTApLHRyYW5zcGFyZW50KTtib3JkZXItY29sb3I6dmFyKC0tYW1iKSI+CiAgICAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4pqRICR7YXNrc30gVEhJTkcke2Fza3M+MT8nUyc6Jyd9IE5FRUQgWU9VUiBBTlNXRVI8L2gzPgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyBiZWxvdyBoYXBwZW5zIHVudGlsIHlvdSB0aWNrIGl0LiBDcm9zcyBpdCBhbmQgaGUgd2lsbCBub3QgYXNrIGFnYWluLjwvZGl2PjwvZGl2PmA7CiAgICBnYXRlcy5mb3JFYWNoKGc9PnsgaHRtbCArPSBhc2tDYXJkKCdnYXRlJywgZy5pZCwgZy50aXRsZSwKICAgICAgYCR7ZXNjKGcub2JqKX08ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij5TYWZlZ3VhcmRzOiAke2VzYyhnLnNhZmUpfTwvZGl2PmAsCiAgICAgIGAke2cuY2xzfSDCtyByaXNrICR7Zy5yaXNrfSR7Zy5jb3N0PycgwrcgY29zdHMg4oK5JytnLmNvc3Q6Jyd9YCk7IH0pOwogICAgdXBzLmZvckVhY2gocD0+eyBodG1sICs9IGFza0NhcmQoJ3VwZ3JhZGUnLCBwLmlkLCBwLmxhYmVsLAogICAgICBgJHtlc2MocC53aHkpfSR7cC5ldmlkZW5jZT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+RXZpZGVuY2U6ICR7ZXNjKHAuZXZpZGVuY2UpfTwvZGl2PmA6Jyd9YCwKICAgICAgcC5rbGFzcyk7IH0pOwogIH0gZWxzZSB7CiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKclCBOT1RISU5HIE5FRURTIFlPVSBSSUdIVCBOT1c8L2gzPgogICAgICA8ZGl2PkhlIGlzIHJ1bm5pbmcgb24gaGlzIG93bi4gJHsoUy50YXNrc3x8W10pLmZpbHRlcih4PT54LmVuYWJsZWQpLmxlbmd0aH0gc3RhbmRpbmcgb3JkZXJzIGFjdGl2ZSwgJHsoUy5ydW5zfHxbXSkubGVuZ3RofSBqb2JzIGRvbmUuPC9kaXY+PC9kaXY+YDsKICB9CgogIC8qIDIuIHdoYXQgaGUgd2FudHMgWU9VIHRvIHBoeXNpY2FsbHkgZG8gKi8KICBpZihqb2JzLmxlbmd0aCl7CiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+4peOICR7am9icy5sZW5ndGh9IEpPQiR7am9icy5sZW5ndGg+MT8nUyc6Jyd9IE9OTFkgWU9VIENBTiBETzwvaDM+CiAgICAgJHtqb2JzLnNsaWNlKDAsMykubWFwKG09PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tbGltZSk7cGFkZGluZy1sZWZ0OjEycHg7bWFyZ2luLWJvdHRvbToxNHB4Ij4KICAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyhtLnRpdGxlKX08L2I+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5+JHttLm1pbnV0ZXN9IG1pbjwvc3Bhbj48L2Rpdj4KICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjRweCAwIDdweCI+JHtlc2MobS53aHkpfTwvZGl2PgogICAgICAgPG9sIHN0eWxlPSJtYXJnaW46MDtwYWRkaW5nLWxlZnQ6MTlweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNzUiPiR7bS5zdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+CiAgICAgICAke20uc2NyaXB0P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6MTBweDttYXJnaW4tdG9wOjlweCI+CiAgICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo1cHgiPlNFTkQgRVhBQ1RMWSBUSElTOjwvZGl2PgogICAgICAgICA8ZGl2IGlkPSJkc2tfJHttLmlkfSIgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwIj4ke2VzYyhtLnNjcmlwdCl9PC9kaXY+CiAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiIG9uY2xpY2s9ImNvcHlTY3JpcHQoJyR7bS5pZH0nKSI+Q29weTwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+CiAgICAgICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyODBweCIgaWQ9Im5vdGVfJHttLmlkfSIgcGxhY2Vob2xkZXI9IndoYXQgaGFwcGVuZWQ/Ij4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdkb25lJykiPuKclCBEb25lPC9idXR0b24+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWJyaWVmKCcke20uaWR9Jywnc2tpcCcpIj7inJUgU2tpcDwvYnV0dG9uPjwvZGl2PgogICAgICA8L2Rpdj5gKS5qb2luKCcnKX0KICAgICAke2pvYnMubGVuZ3RoPjM/YDxkaXYgY2xhc3M9Im1vbm8tZGltIj4rJHtqb2JzLmxlbmd0aC0zfSBtb3JlIGluIE15IEpvYnM8L2Rpdj5gOicnfTwvZGl2PmA7CiAgfQoKICAvKiAzLiBvbmUgaG9uZXN0IHN0YXR1cyBsaW5lLCBubyBqYXJnb24gKi8KICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SG93IHRoaW5ncyBzdGFuZDwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5Xb3JraW5nIGZvciB5b3U8L3RkPjx0ZD4keyhTLmFnZW50c3x8W10pLmZpbHRlcihhPT5hLnN0YXR1cz09PSdBQ1RJVkUnKS5sZW5ndGh9IGFnZW50cywgJHsoUy50YXNrc3x8W10pLmZpbHRlcih4PT54LmVuYWJsZWQpLmxlbmd0aH0gc3RhbmRpbmcgb3JkZXJzJHtTLnJ1bm5pbmc/Jyc6JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4oCUIEhBTFRFRDwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TaXRlcyB3YXRjaGVkPC90ZD48dGQ+JHsoUy5tb25pdG9yc3x8W10pLmxlbmd0aH0ke2Rvd24ubGVuZ3RoP2AgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPsK3ICR7ZG93bi5sZW5ndGh9IERPV048L3NwYW4+YDonIMK3IGFsbCB1cCd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPklkZWFzIGZvdW5kPC90ZD48dGQ+JHsoUy5pZGVhc3x8W10pLmxlbmd0aH0gwrcgJHsoUy52ZW50dXJlc3x8W10pLmxlbmd0aH0gbGF1bmNoZWQ8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWFpbCBwcm92ZW48L3RkPjx0ZD4ke1Muc210cFZlcmlmaWVkP2A8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+eWVzIFx1MjAxNCAke2VzYyhTLnNtdHBWZXJpZmllZC5mcm9tKX08L3NwYW4+YDooUy50ZWxlbWV0cnkmJlMudGVsZW1ldHJ5LnNtdHBfcmVhZHkpPyc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+Y29uZmlndXJlZCBidXQgTkVWRVIgVEVTVEVEIFx1MjAxNCBydW4gdGhlIHByZWZsaWdodCBpbiBNYWlsIFJlbGF5PC9zcGFuPic6JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5ubyBtYWlsIGNvbmZpZ3VyZWQ8L3NwYW4+J308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWVzc2FnZXMgYWN0dWFsbHkgc2VudDwvdGQ+PHRkPiR7KFMub3V0cmVhY2h8fFtdKS5sZW5ndGh9JHshKFMub3V0cmVhY2h8fFtdKS5sZW5ndGg/JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4oCUIHplcm8uIE5vdGhpbmcgZWFybnMgdW50aWwgc29tZXRoaW5nIGlzIHNlbnQuPC9zcGFuPic6JyDCtyAnKyhTLm91dHJlYWNofHxbXSkuZmlsdGVyKG89Pm8ucmVwbGllZCkubGVuZ3RoKycgcmVwbGllZCd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJ1c2luZXNzZXMgYnVpbHQ8L3RkPjx0ZD4keyhTLmJ1c2luZXNzZXN8fFtdKS5sZW5ndGh9IMK3ICR7KFMuYnVzaW5lc3Nlc3x8W10pLmZpbHRlcihiPT5iLnB1Ymxpc2hlZCkubGVuZ3RofSBsaXZlJHsoUy5idXNpbmVzc2VzfHxbXSkubGVuZ3RoJiYhKFMuYnVzaW5lc3Nlc3x8W10pLmZpbHRlcihiPT5iLnB1Ymxpc2hlZCkubGVuZ3RoPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKAlCBidWlsdCBidXQgbmV2ZXIgcHVibGlzaGVkLCBzbyBpdCBlYXJucyBub3RoaW5nPC9zcGFuPic6Jyd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1vbmV5PC90ZD48dGQ+ZWFybmVkIOKCuSR7Zm10KChTLnJldmVudWV8fFtdKS5maWx0ZXIocj0+ci5hbXQ+MCkucmVkdWNlKChhLGIpPT5hK2IuYW10LDApKX0gwrcgc3BlbnQg4oK5JHsoUy5zcGVuZHx8MCkudG9GaXhlZCgwKX08L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+SGlzIGJyYWluPC90ZD48dGQ+JHtTLmxsbT9lc2MoUy5sbG0ucHJvdmlkZXIpKycgwrcgJysoKFMubGxtQmFja3Vwc3x8W10pLmxlbmd0aCsxKSsnIGtleShzKSc6JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5ub3QgY29ubmVjdGVkPC9zcGFuPid9PC90ZD48L3RyPgogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDsKCiAgLyogNC4gdGFsayB0byBoaW0gKi8KICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGVsbCBoaW0gYW55dGhpbmc8L2gzPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5IZSByZXBsaWVzIGhlcmUsIGFuZCBhY3RzIG9uIGl0PC9zcGFuPgogICAgIDx0ZXh0YXJlYSBpZD0iZGVza1NheSIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo3MHB4IiBwbGFjZWhvbGRlcj0iZS5nLiBmaW5kIG1lIGEgd2F5IHRvIGVhcm4gdGhpcyB3ZWVrIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkZXNrU2VuZCgpIj5TRU5EPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkZXNrUXVpY2soJ0ZpbmQgbWUgdGhlIGJlc3Qgd2F5IHRvIGVhcm4gbW9uZXkgdGhpcyB3ZWVrLCByZXNlYXJjaCBpdCBwcm9wZXJseSwgYW5kIHRlbGwgbWUgZXhhY3RseSB3aGF0IHRvIGRvIGZpcnN0LicpIj5GaW5kIG1lIG1vbmV5PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkZXNrUXVpY2soJ0NoZWNrIGV2ZXJ5dGhpbmcgYW5kIHRlbGwgbWUgcGxhaW5seSB3aGF0IGlzIGJyb2tlbiBvciBuZWVkcyBteSBhdHRlbnRpb24uJykiPkNoZWNrIGV2ZXJ5dGhpbmc8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImdvKCdmYWN0b3J5JykiPuKWpiBCdWlsZCB0aGUgYnVzaW5lc3M8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImdvKCdncm93dGgnKSI+4p6kIEdldCBjdXN0b21lcnM8L2J1dHRvbj48L2Rpdj4KICAgICR7KFMuY2hhdHx8W10pLmxlbmd0aD9gPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxM3B4Ij4keyhTLmNoYXR8fFtdKS5zbGljZSgwLDQpLm1hcChtPT4KICAgICAgYDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCAke20ud2hvPT09J0NIQUlSTUFOJz8ndmFyKC0tbGltZSknOid2YXIoLS1zdHJva2UyKSd9O3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTFweCI+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHttLndobz09PSdDSEFJUk1BTic/J0NIQUlSTUFOJzonWU9VJ30gwrcgJHttLnR9PC9kaXY+CiAgICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG0udGV4dCl9PC9kaXY+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+YDonJ30KICAgPC9kaXY+YDsKICByZXR1cm4gaHRtbDsKfTsKUkVOREVSLmRlc2s9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iZGVzayI+JHtMSVZFLmRlc2soKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBzYXkoa2luZCwgaWQsIHllcyl7CiAgZmxhc2goeWVzPydBcHByb3ZpbmfigKYnOidEZWNsaW5pbmfigKYnKTsKICB0cnl7CiAgICBpZihraW5kPT09J2dhdGUnKSAgICBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9kZWNpZGUnLHtpZCxvazohIXllc30pOwogICAgZWxzZSAgICAgICAgICAgICAgICAgYXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvZGVjaWRlJyx7aWQsb2s6ISF5ZXN9KTsKICAgIHJlbmRlcigpOyBmbGFzaCh5ZXM/J0RvbmUg4oCUIGhlIGlzIGFjdGluZyBvbiBpdCc6J0RlY2xpbmVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkZXNrU2VuZCgpewogIGNvbnN0IHQ9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXNrU2F5Jyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXQudHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgc29tZXRoaW5nIGZpcnN0Jyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2tTYXknKS52YWx1ZT0nJzsKICBmbGFzaCgnSGUgaXMgdGhpbmtpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kJyx7dGV4dDp0LnRyaW0oKX0pOyByZW5kZXIoKTsgfQogIGNhdGNoKGUpeyByZW5kZXIoKTsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gZGVza1F1aWNrKHQpeyBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVza1NheScpOyBpZihlbCl7IGVsLnZhbHVlPXQ7IGRlc2tTZW5kKCk7IH0gfQoKLyogLS0tLS0tLS0tLSBBR0VOVCBMT09QIC0tLS0tLS0tLS0gKi8KY29uc3QgQUdPQUxTPVsKIFsnRmluZCBteSBiZXN0IHZlbnR1cmUnLCdDaGVjayBteSBjdXJyZW50IHN0YXRlLCBpbnZlbnQgbW9uZXktbWFraW5nIGlkZWFzLCByZXNlYXJjaCB0aGUgbW9zdCBwcm9taXNpbmcgb25lIGFnYWluc3QgdGhlIGxpdmUgd2ViLCBhbmQgdGVsbCBtZSB3aGljaCBzaW5nbGUgb25lIHRvIHB1cnN1ZSBhbmQgd2h5LiddLAogWydGdWxsIHN5c3RlbSBhdWRpdCcsJ1JlYWQgbXkgc3lzdGVtIHN0YXRlLCBzY2FuIGZvciBhbm9tYWxpZXMsIGNoZWNrIGV2ZXJ5IG1vbml0b3JlZCBzaXRlLCBhbmQgZ2l2ZSBtZSBhIGJsdW50IGxpc3Qgb2Ygd2hhdCBpcyBicm9rZW4gb3IgdW5zYWZlLCBtb3N0IHVyZ2VudCBmaXJzdC4nXSwKIFsnUmVzZWFyY2ggYSBjb21wZXRpdG9yJywnU2VhcmNoIHRoZSB3ZWIgZm9yIHVwdGltZSBtb25pdG9yaW5nIHNlcnZpY2VzIGluIEluZGlhLCByZWFkIHRoZSBwcmljaW5nIHBhZ2Ugb2YgdGhlIG1vc3QgcmVsZXZhbnQgb25lLCBhbmQgdGVsbCBtZSBob3cgSSBzaG91bGQgcG9zaXRpb24gYWdhaW5zdCB0aGVtLiddLAogWydQbGFuIG15IG5leHQgMyBhY3Rpb25zJywnUmVhZCBteSBzdGF0ZSwgd29yayBvdXQgd2hhdCBpcyBhY3R1YWxseSBibG9ja2luZyBtb25leSwgYW5kIGlzc3VlIG15IG5leHQgY29uY3JldGUgbWlzc2lvbnMuJ10KXTsKUkVOREVSLmFnZW50PSgpPT57CiAgY29uc3QgUj1TLmFnZW50UnVuc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKamSBBR0VOVCBMT09QIOKAlCBIRSBERUNJREVTIFRIRSBORVhUIFNURVAgSElNU0VMRjwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+VGhpcyBpcyB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGEgY2hhdGJvdCBhbmQgYW4gYWdlbnQuIEhlIHBpY2tzIGEgdG9vbCwgPGI+c2VlcyB0aGUgcmVhbCByZXN1bHQ8L2I+LCB0aGVuIGRlY2lkZXMgd2hhdCB0byBkbyBuZXh0IOKAlCByZXBlYXRpbmcgdW50aWwgdGhlIGdvYWwgaXMgbWV0LiBFdmVyeSB0b29sIGlzIGNvZGUgdGhhdCBnZW51aW5lbHkgcnVucy48L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgICA8bGk+SGUgY2FuIGNoYWluOiBzdGF0ZSDihpIgaWRlYXMg4oaSIGxpdmUgd2ViIHJlc2VhcmNoIOKGkiBtaXNzaW9ucywgaW4gb25lIGdvLjwvbGk+CiAgICA8bGk+SGUgb25seSBzZWVzIHRvb2xzIHRoYXQgZXhpc3QuIEludmVudGluZyBvbmUgaXMgcmVmdXNlZC48L2xpPgogICAgPGxpPkNhcHBlZCBhdCAxMCBzdGVwcyBzbyBhIGxvb3AgY2FuIG5ldmVyIHJ1biBhd2F5LjwvbGk+CiAgICA8bGk+RXZlcnkgc3RlcCBhbmQgaXRzIHJlYWwgb3V0cHV0IGlzIGxvZ2dlZCBpbiB0aGUgdHJhY2UgYmVsb3cuPC9saT4KICAgPC91bD4KICAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48c3Bhbj5Zb3VyIGdvYWw8L3NwYW4+CiAgICA8dGV4dGFyZWEgaWQ9ImFnR29hbCIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo3NnB4IiBwbGFjZWhvbGRlcj0iZS5nLiBXb3JrIG91dCB3aGljaCB2ZW50dXJlIEkgc2hvdWxkIHN0YXJ0IHRoaXMgd2VlayBhbmQgcHJvdmUgaXQgd2l0aCByZWFsIHdlYiBldmlkZW5jZS4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0ibW9uby1kaW0iPk1heCBzdGVwczwvc3Bhbj4KICAgIDxzZWxlY3QgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjgwcHgiIGlkPSJhZ1N0ZXBzIj4KICAgICAke1szLDQsNiw4LDEwXS5tYXAobj0+YDxvcHRpb24gdmFsdWU9IiR7bn0iICR7bj09PTY/J3NlbGVjdGVkJzonJ30+JHtufTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJ1bkFnZW50KCkiPlJVTiBUSEUgTE9PUDwvYnV0dG9uPgogICAgJHtSLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhckFnZW50KCkiPkNsZWFyIGhpc3Rvcnk8L2J1dHRvbj4nOicnfTwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPiR7QUdPQUxTLm1hcCgoZyxpKT0+CiAgICAgYDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iYWdRdWljaygke2l9KSI+JHtlc2MoZ1swXSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPkEgNi1zdGVwIHJ1biBtYWtlcyA2KyBBSSBjYWxscy4gT24gYSBmcmVlIHRpZXIgdGhhdCBpcyBmaW5lIG9jY2FzaW9uYWxseSDigJQgYWRkIGJhY2t1cCBrZXlzIGJlbG93IGlmIHlvdSBydW4gaXQgb2Z0ZW4uPC9kaXY+PC9kaXY+CiAgPGRpdiBpZD0iYWdPdXQiPjwvZGl2PgogICR7Ui5sZW5ndGg/Ui5tYXAocj0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgIDxiPiR7ZXNjKHIuZ29hbCl9PC9iPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtyLnR9IMK3ICR7ci5zdGVwc30gc3RlcCR7ci5zdGVwcz4xPydzJzonJ30ke3IuaGl0Q2FwPycgwrcgSElUIENBUCc6Jyd9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NTttYXJnaW4tYm90dG9tOjExcHgiPiR7ZXNjKHIuYW5zd2VyKX08L2Rpdj4KICAgIDxkZXRhaWxzPjxzdW1tYXJ5IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj5TaG93IHRoZSAke3IudHJhY2UubGVuZ3RofS1zdGVwIHRyYWNlPC9zdW1tYXJ5PgogICAgIDxkaXYgY2xhc3M9ImxvZyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij4ke3IudHJhY2UubWFwKHQ9PgogICAgICAgYDxkaXY+PHNwYW4gY2xhc3M9InRzIj5zdGVwICR7dC5zdGVwfTwvc3Bhbj4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWxpbWUpIj4ke2VzYyh0LmFjdGlvbil9PC9iPlxuJHtlc2ModC5yZXN1bHQpfTwvZGl2PmApLmpvaW4oJycpfTwvZGl2PgogICAgPC9kZXRhaWxzPjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHJ1bnMgeWV0LiBHaXZlIGhpbSBhIGdvYWwgYW5kIHdhdGNoIGhpbSB3b3JrIGl0IG91dC48L2Rpdj48L2Rpdj4nfWA7Cn07CmFzeW5jIGZ1bmN0aW9uIHJ1bkFnZW50KCl7CiAgY29uc3QgZz1hZ0dvYWwudmFsdWUudHJpbSgpOyBpZighZykgcmV0dXJuIGZsYXNoKCdTdGF0ZSBhIGdvYWwgZmlyc3QnKTsKICBhZ091dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5Xb3JraW5n4oCmIGhlIGlzIGNob29zaW5nIHRvb2xzIGFuZCByZWFkaW5nIHJlc3VsdHMuIFRoaXMgY2FuIHRha2UgYSBtaW51dGUuPC9kaXY+PC9kaXY+JzsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9hZ2VudC9ydW4nLHtnb2FsOmcsc3RlcHM6K2FnU3RlcHMudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnRmluaXNoZWQgaW4gJytyLnN0ZXBzKycgc3RlcChzKScpOwogIH1jYXRjaChlKXsKICAgIGFnT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PjwvZGl2PmA7CiAgfQp9CmZ1bmN0aW9uIGFnUXVpY2soaSl7IGFnR29hbC52YWx1ZT1BR09BTFNbaV1bMV07IHJ1bkFnZW50KCkgfQphc3luYyBmdW5jdGlvbiBjbGVhckFnZW50KCl7IGF3YWl0IEFQSSgnL2FwaS9hZ2VudC9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIFNJVEUgQlVJTERFUiAtLS0tLS0tLS0tICovClJFTkRFUi5zaXRlcz0oKT0+ewogIGNvbnN0IEI9Uy5idWlsZHN8fFtdLCBWPVMudmVudHVyZXN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7ilqQgU0lURSBCVUlMREVSIOKAlCBIRSBXUklURVMgSVQsIFlPVSBQVUJMSVNIIElUPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSB3cml0ZXMgYSBjb21wbGV0ZSwgd29ya2luZyBsYW5kaW5nIHBhZ2Ug4oCUIGhlYWRsaW5lLCBwcmljaW5nIGluIElOUiwgaG9uZXN0IEZBUSwgYW5kIHlvdXIgPGI+cmVhbCBwYXltZW50IGxpbms8L2I+IHdpcmVkIGluLiBPbmUgZmlsZSwgbm8gZGVwZW5kZW5jaWVzLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5XaGF0IGhlIGNhbm5vdCBkbywgYW5kIHdoeS48L2I+IFB1Ymxpc2hpbmcgbmVlZHMgYSBob3N0aW5nIGFjY291bnQsIGEgZG9tYWluIGFuZCBhIGNhcmQgaW4gPGVtPnlvdXI8L2VtPiBsZWdhbCBuYW1lLiBUYWtpbmcgbW9uZXkgbmVlZHMgS1lDIGFnYWluc3QgPGVtPnlvdXI8L2VtPiBQQU4gYW5kIGJhbmsuIE5vIHNvZnR3YXJlIGNhbiBob2xkIHRob3NlIG9uIHlvdXIgYmVoYWxmIOKAlCB0aGF0IGlzIHRoZSBsYXcsIG5vdCBhIG1pc3NpbmcgZmVhdHVyZS4gSGUgZ2V0cyBpdCB0byBvbmUgY2xpY2sgZnJvbSBsaXZlLjwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgIDxsaT5IZSByZWZ1c2VzIHRvIGJ1aWxkIGZvciBhbiB1bnJlc2VhcmNoZWQgdmVudHVyZSDigJQgZXZpZGVuY2UgZmlyc3QuPC9saT4KICAgIDxsaT5ObyBmYWtlIHRlc3RpbW9uaWFscywgbm8gaW52ZW50ZWQgY3VzdG9tZXIgY291bnRzLiBBIG5ldyBidXNpbmVzcyBjYXVnaHQgZmFraW5nIHByb29mIGxvc2VzIHRoZSBzYWxlLjwvbGk+CiAgICA8bGk+UHJldmlldyBpdCBoZXJlLCBkb3dubG9hZCBvbmUgZmlsZSwgcHVibGlzaCBmcmVlIG9uIE5ldGxpZnkgRHJvcCBpbiBhYm91dCA2MCBzZWNvbmRzLjwvbGk+CiAgIDwvdWw+CiAgICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CdWlsZCBmb3IgYSBsYXVuY2hlZCB2ZW50dXJlPC9zcGFuPgogICAgIDxzZWxlY3QgaWQ9InNiVmVudHVyZSIgY2xhc3M9ImluIj4KICAgICAgPG9wdGlvbiB2YWx1ZT0iIj7igJQgcGljayBvbmUg4oCUPC9vcHRpb24+CiAgICAgICR7Vi5tYXAodj0+YDxvcHRpb24gdmFsdWU9IiR7di5pZH0iPiR7ZXNjKHYudGl0bGUpfTwvb3B0aW9uPmApLmpvaW4oJycpfQogICAgIDwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9yIGRlc2NyaWJlIGl0IHlvdXJzZWxmPC9zcGFuPgogICAgIDxpbnB1dCBpZD0ic2JCcmllZiIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiB1cHRpbWUgbW9uaXRvcmluZyBmb3IgTHVkaGlhbmEgc2hvcHMsIFJzIDE1MDAvbW8iPjwvbGFiZWw+CiAgIDwvZGl2PgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYnVpbGRTaXRlKCkiPldSSVRFIFRIRSBTSVRFPC9idXR0b24+CiAgICR7IVYubGVuZ3RoPyc8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5ObyBsYXVuY2hlZCB2ZW50dXJlcyB5ZXQuIEdvIHRvIFZlbnR1cmVzLCBnZW5lcmF0ZSBpZGVhcywgcmVzZWFyY2ggb25lLCB0aGVuIEJVSUxEIEFHRU5UIFRFQU0uPC9kaXY+JzonJ30KICA8L2Rpdj4KICAke0IubGVuZ3RoP0IubWFwKGI9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtY3kiPlNJVEU8L3NwYW4+PGI+JHtlc2MoYi50aXRsZSl9PC9iPgogICAgICA8c3BhbiBjbGFzcz0idGFnICR7Yi5oYXNQYXlMaW5rPyd0LWdybic6J3QtYW1iJ30iPiR7Yi5oYXNQYXlMaW5rPydQQVkgTElOSyBMSVZFJzonQ09OVEFDVCBPTkxZJ308L3NwYW4+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2IudH0gwrcgJHsoYi5ieXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQjwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+CiAgICAgPGEgY2xhc3M9ImJ0biBwIiBocmVmPSIvYXBpL3NpdGUvdmlldz9pZD0ke2IuaWR9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+UFJFVklFVyBJVCDihpc8L2E+CiAgICAgPGEgY2xhc3M9ImJ0biBvayIgaHJlZj0iL2FwaS9zaXRlL3ZpZXc/aWQ9JHtiLmlkfSZkbD0xIj5ET1dOTE9BRCBpbmRleC5odG1sPC9hPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsU2l0ZSgnJHtiLmlkfScpIj5EZWxldGU8L2J1dHRvbj48L2Rpdj4KICAgIDxkZXRhaWxzPjxzdW1tYXJ5IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj5Ib3cgdG8gcHV0IHRoaXMgbGl2ZSwgZnJlZSwgaW4gNjAgc2Vjb25kczwvc3VtbWFyeT4KICAgICA8b2wgc3R5bGU9Im1hcmdpbjo5cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4O2ZvbnQtc2l6ZToxMi41cHg7bGluZS1oZWlnaHQ6MS44Ij4KICAgICAgPGxpPkNsaWNrIDxiPkRPV05MT0FEIGluZGV4Lmh0bWw8L2I+IGFib3ZlLjwvbGk+CiAgICAgIDxsaT5HbyB0byA8Yj5hcHAubmV0bGlmeS5jb20vZHJvcDwvYj4g4oCUIG5vIGFjY291bnQgbmVlZGVkIHRvIHN0YXJ0LjwvbGk+CiAgICAgIDxsaT5EcmFnIHRoZSBmaWxlIG9udG8gdGhlIHBhZ2UuIEl0IGlzIGxpdmUgaW4gc2Vjb25kcyBvbiBhIGZyZWUgVVJMLjwvbGk+CiAgICAgIDxsaT5GcmVlIGN1c3RvbSBkb21haW4gbGF0ZXI6IGEgLmNvbSBpcyByb3VnaGx5IOKCuTkwMC95ZWFyIOKAlCBvcHRpb25hbCwgZG8gaXQgb25jZSB5b3UgaGF2ZSBhIHBheWluZyBjbGllbnQuPC9saT4KICAgICAgPGxpPkJpbmQgdGhhdCBuZXcgVVJMIGluIDxiPlVwdGltZSBNYXJzaGFsPC9iPiBzbyB0aGUgQ2hhaXJtYW4gbW9uaXRvcnMgeW91ciBvd24gc2l0ZSB0b28uPC9saT4KICAgICA8L29sPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPkFsdGVybmF0aXZlcyB0aGF0IGFyZSBlcXVhbGx5IGZyZWU6IENsb3VkZmxhcmUgUGFnZXMsIEdpdEh1YiBQYWdlcywgVmVyY2VsLjwvZGl2PgogICAgPC9kZXRhaWxzPjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHNpdGVzIGJ1aWx0IHlldC48L2Rpdj48L2Rpdj4nfWA7Cn07CmFzeW5jIGZ1bmN0aW9uIGJ1aWxkU2l0ZSgpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYlZlbnR1cmUnKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCBicmllZj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NiQnJpZWYnKXx8e30pLnZhbHVlfHwnJzsKICBpZighdiAmJiAhYnJpZWYudHJpbSgpKSByZXR1cm4gZmxhc2goJ1BpY2sgYSB2ZW50dXJlIG9yIHdyaXRlIGEgYnJpZWYnKTsKICBmbGFzaCgnV3JpdGluZyB0aGUgc2l0ZSDigJQgdGhpcyB0YWtlcyBhIG1pbnV0ZeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2l0ZS9idWlsZCcse3ZlbnR1cmVJZDp2LGJyaWVmfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1NpdGUgd3JpdHRlbiDigJQgJysoci5ieXRlcy8xMDI0KS50b0ZpeGVkKDEpKycgS0IuIFByZXZpZXcgaXQuJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkZWxTaXRlKGlkKXsgaWYoIWNvbmZpcm0oJ0RlbGV0ZSB0aGlzIHNpdGU/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvc2l0ZS9kZWxldGUnLHtpZH0pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIE1JU1NJT05TOiBoZSBndWlkZXMsIHlvdSBleGVjdXRlIC0tLS0tLS0tLS0gKi8KTElWRS5taXNzaW9ucz0oKT0+ewogIGNvbnN0IE09Uy5taXNzaW9uc3x8W10sIG9wZW49TS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nT1BFTicpLCBkb25lPU0uZmlsdGVyKG09Pm0uc3RhdHVzPT09J0RPTkUnKTsKICBjb25zdCBtaW5zPW9wZW4ucmVkdWNlKChhLG0pPT5hKyhtLm1pbnV0ZXN8fDApLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKG9wZW4ubGVuZ3RoLCdPcGVuIE1pc3Npb25zJyxvcGVuLmxlbmd0aD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLG1pbnM/J34nK21pbnMrJyBtaW4gdG90YWwnOidub3RoaW5nIHBlbmRpbmcnKX0KICAgJHtrcGkoZG9uZS5sZW5ndGgsJ0NvbXBsZXRlZCcsJ3ZhcigtLWdybiknLCdsaWZldGltZScpfQogICAke2twaSgoUy5wbGF5Ym9va3N8fFtdKS5sZW5ndGgsJ1BsYXlib29rcycsJ3ZhcigtLWN5KScsJ3N0ZXAtYnktc3RlcCBndWlkZXMnKX0KICAgJHtrcGkoUy52ZW50dXJlcyYmUy52ZW50dXJlcy5sZW5ndGg/ZXNjKFMudmVudHVyZXNbMF0udGl0bGUpLnNsaWNlKDAsMTgpOidub25lJywnQWN0aXZlIFZlbnR1cmUnLCd2YXIoLS1wdXIpJywnJyl9PC9kaXY+CiAgJHtvcGVuLmxlbmd0aD9vcGVuLm1hcChtPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206N3B4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPkRPIFRISVM8L3NwYW4+PGIgc3R5bGU9ImZvbnQtc2l6ZToxNHB4Ij4ke2VzYyhtLnRpdGxlKX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5+JHttLm1pbnV0ZXN9IG1pbjwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4O2NvbG9yOiNiM2MxZDEiPiR7ZXNjKG0ud2h5KX08L2Rpdj4KICAgICR7bS5zdGVwcy5sZW5ndGg/YDxvbCBzdHlsZT0ibWFyZ2luOjAgMCAxMHB4O3BhZGRpbmctbGVmdDoyMHB4O2ZvbnQtc2l6ZToxMi41cHg7bGluZS1oZWlnaHQ6MS43NSI+CiAgICAgICR7bS5zdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+YDonJ30KICAgICR7bS5zY3JpcHQ/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6IzA2MjIyYTtib3JkZXI6MXB4IHNvbGlkICMxNTVlNmI7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPkNPUFkgVEhFU0UgRVhBQ1QgV09SRFM6PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiIgaWQ9InNjcl8ke20uaWR9Ij4ke2VzYyhtLnNjcmlwdCl9PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiIG9uY2xpY2s9ImNvcHlTY3JpcHQoJyR7bS5pZH0nKSI+Q29weSBtZXNzYWdlPC9idXR0b24+PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTIwcHgiPkRvbmUgd2hlbjwvdGQ+PHRkPiR7ZXNjKG0uZG9uZVdoZW4pfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGlrZWx5IGJsb2NrZXI8L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtlc2MobS5yaXNrKX08L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxzcGFuPldoYXQgaGFwcGVuZWQ/IChoZSBhZGFwdHMgdGhlIG5leHQgbWlzc2lvbiB0byB0aGlzKTwvc3Bhbj4KICAgICA8aW5wdXQgY2xhc3M9ImluIiBpZD0ibm90ZV8ke20uaWR9IiBwbGFjZWhvbGRlcj0iZS5nLiBzZW50IHRvIDQgc2hvcHMsIDEgcmVwbGllZCBhc2tpbmcgcHJpY2UiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ2RvbmUnKSI+TUFSSyBET05FPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWJyaWVmKCcke20uaWR9Jywnc2tpcCcpIj5Ta2lwIHRoaXM8L2J1dHRvbj48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBvcGVuIG1pc3Npb25zLiBQcmVzcyBHRVQgTVkgTkVYVCBNSVNTSU9OUyBhbmQgaGUgd2lsbCB0ZWxsIHlvdSBleGFjdGx5IHdoYXQgdG8gZG8gdG9kYXkuPC9kaXY+PC9kaXY+YH0KICAke2RvbmUubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tcGxldGVkIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPiR7ZG9uZS5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPk1pc3Npb248L3RoPjx0aD5PdXRjb21lPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke2RvbmUuc2xpY2UoMCwxNSkubWFwKG09PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttLmNsb3NlZHx8bS50fTwvdGQ+PHRkPiR7ZXNjKG0udGl0bGUpfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtLm91dGNvbWV8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gOicnfQogICR7KFMucGxheWJvb2tzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UGxheWJvb2tzPC9oMz4KICAgJHtTLnBsYXlib29rcy5tYXAoKHAsaSk9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tY3kpO3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTNweCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PGI+JHtlc2MocC50b3BpYyl9PC9iPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weVBiKCR7aX0pIj5Db3B5PC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1O2ZvbnQtc2l6ZToxMi41cHg7bWFyZ2luLXRvcDo2cHgiPiR7ZXNjKHAudGV4dCl9PC9kaXY+PC9kaXY+YCkuam9pbignJyl9CiAgIDwvZGl2PmA6Jyd9YDsKfTsKUkVOREVSLm1pc3Npb25zPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNTEwMGEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4peOIE1ZIE1JU1NJT05TIOKAlCBIRSBQTEFOUywgWU9VIEVYRUNVVEU8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgY2Fubm90IHJlZ2lzdGVyIGNvbXBhbmllcywgcGxhY2UgYWRzIG9yIHRhbGsgdG8gY3VzdG9tZXJzLiBTbyBoZSBkb2VzIHRoZSBuZXh0IGJlc3QgdGhpbmc6IGJyZWFrcyB0aGUgcGF0aCBpbnRvIDxiPnNpbmdsZSBhY3Rpb25zIHlvdSBjYW4gZmluaXNoIHRvZGF5PC9iPiwgd3JpdGVzIHRoZSBleGFjdCB3b3JkcyB0byBzZW5kLCBhbmQgYWRhcHRzIGJhc2VkIG9uIHdoYXQgYWN0dWFsbHkgaGFwcGVuZWQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImdldE1pc3Npb25zKCkiPkdFVCBNWSBORVhUIE1JU1NJT05TPC9idXR0b24+CiAgICR7KFMubWlzc2lvbnN8fFtdKS5zb21lKG09Pm0uc3RhdHVzIT09J09QRU4nKT8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhck1pc3Npb25zKCkiPkNsZWFyIGhpc3Rvcnk8L2J1dHRvbj4nOicnfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MzQwcHgiIGlkPSJwYlRvcGljIiBwbGFjZWhvbGRlcj0iUGxheWJvb2sgdG9waWMg4oCUIGUuZy4gaG93IHRvIHJlZ2lzdGVyIGEgc29sZSBwcm9wcmlldG9yc2hpcCBpbiBQdW5qYWIiPgogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9Im1ha2VQYigpIj5XUklURSBQTEFZQk9PSzwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlBsYXlib29rIGlkZWFzOiBnZXR0aW5nIGEgUmF6b3JwYXkgYWNjb3VudCDCtyBHU1QgZm9yIGZyZWVsYW5jZXJzIGluIEluZGlhIMK3IGZpbmRpbmcgc2hvcCBvd25lcnMnIG51bWJlcnMgbGVnYWxseSDCtyB3cml0aW5nIGEgZmlyc3QgaW52b2ljZTwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9Im1pc3Npb25zIj4ke0xJVkUubWlzc2lvbnMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBnZXRNaXNzaW9ucygpeyBmbGFzaCgnQ2hhaXJtYW4gaXMgcGxhbm5pbmcgeW91ciBuZXh0IG1vdmVz4oCmJyk7CiAgdHJ5eyBjb25zdCB2PShTLnZlbnR1cmVzfHxbXSlbMF07CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL2dlbmVyYXRlJyx7dmVudHVyZUlkOnY/di5pZDpudWxsfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5hZGRlZCsnIG1pc3Npb24ocykgaXNzdWVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQpmdW5jdGlvbiBjb3B5U2NyaXB0KGlkKXsgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njcl8nK2lkKTsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoZWw/ZWwuaW5uZXJUZXh0OicnKTsgZmxhc2goJ01lc3NhZ2UgY29waWVkIOKAlCBub3cgc2VuZCBpdCcpIH0KZnVuY3Rpb24gY29weVBiKGkpeyBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoKFMucGxheWJvb2tzfHxbXSlbaV0udGV4dCk7IGZsYXNoKCdQbGF5Ym9vayBjb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGRlYnJpZWYoaWQsb3V0Y29tZSl7CiAgY29uc3Qgbm90ZT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25vdGVfJytpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYob3V0Y29tZT09PSdkb25lJyYmIW5vdGUudHJpbSgpKSByZXR1cm4gZmxhc2goJ1dyaXRlIHdoYXQgaGFwcGVuZWQgZmlyc3Qg4oCUIGhlIG5lZWRzIGl0IHRvIHBsYW4gdGhlIG5leHQgc3RlcCcpOwogIGZsYXNoKCdSZWNvcmRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL21pc3Npb24vZGVicmllZicse2lkLG91dGNvbWUsbm90ZX0pOyByZW5kZXIoKTsKICAgIGlmKHIuYWR2aWNlKSBtb2RhbChgPGgzPkRlYnJpZWY8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKHIuYWR2aWNlKX08L2Rpdj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY2xvc2VNb2RhbCgpO2dldE1pc3Npb25zKCkiPk5leHQgbWlzc2lvbnMg4oaSPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogICAgZWxzZSBmbGFzaCgnU2tpcHBlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gbWFrZVBiKCl7IGNvbnN0IHQ9cGJUb3BpYy52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYSB0b3BpYycpOwogIGZsYXNoKCdXcml0aW5nIHBsYXlib29r4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9wbGF5Ym9vaycse3RvcGljOnR9KTsgcmVuZGVyKCk7IGZsYXNoKCdQbGF5Ym9vayByZWFkeScpIH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KCi8qIC0tLS0tLS0tLS0gQ09NTUFORCBDT05TT0xFIC0tLS0tLS0tLS0gKi8KTElWRS5jb21tYW5kPSgpPT57CiAgY29uc3QgQz1TLmNoYXR8fFtdOwogIHJldHVybiBDLmxlbmd0aD9DLm1hcChtPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweDtib3JkZXItY29sb3I6JHsKICAgICBtLndobz09PSdPV05FUic/JyMyMjM0NGEnOm0ud2hvPT09J0NIQUlSTUFOJz8nIzE1NWU2Yic6JyM2YjIyMzMnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjZweCI+CiAgICAgPHNwYW4gY2xhc3M9InRhZyAke20ud2hvPT09J09XTkVSJz8ndC1ibHUnOm0ud2hvPT09J0NIQUlSTUFOJz8ndC1jeSc6J3QtcmVkJ30iPiR7bS53aG99PC9zcGFuPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHttLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhtLnRleHQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG9yZGVycyBnaXZlbiB5ZXQuIFRlbGwgdGhlIENoYWlybWFuIHdoYXQgeW91IHdhbnQuPC9kaXY+PC9kaXY+JzsKfTsKUkVOREVSLmNvbW1hbmQ9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzE1NWU2YjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzA2MjIyYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPuKWriBDT01NQU5EIENPTlNPTEUg4oCUIEhFIEFOU1dFUlMgT05MWSBUTyBZT1U8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+R2l2ZSBvcmRlcnMgaW4gcGxhaW4gRW5nbGlzaC4gSGUgcmVwbGllcyB3aXRoIHdoYXQgaGUgd2lsbCBkbywgd2hhdCBoZSBuZWVkcyBmcm9tIHlvdSwgYW5kIHdoYXQgaGUgY2Fubm90IGRvLiBFdmVyeXRoaW5nIGhlcmUgaXMgbG9nZ2VkIGFuZCBzdXJ2aXZlcyByZXN0YXJ0cy48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj5ObyBBSSBicmFpbiBjb25uZWN0ZWQg4oCUIGhlIGNhbm5vdCBhbnN3ZXIuIENvbm5lY3Qgb25lIG9uIHRoZSBBSSBCcmFpbiBwYWdlLjwvZGl2Pic6Jyd9CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Zb3VyIG9yZGVyPC9zcGFuPjx0ZXh0YXJlYSBpZD0iY21kVGV4dCIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo4MHB4IgogICAgcGxhY2Vob2xkZXI9ImUuZy4gRmluZCBtZSB0aHJlZSB3YXlzIHRvIGVhcm4gZnJvbSB3aGF0IEkgb3duLCByZXNlYXJjaCB0aGUgYmVzdCBvbmUsIGFuZCBidWlsZCB0aGUgYWdlbnQgdGVhbS4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZW5kQ21kKCkiPlNFTkQgT1JERVI8L2J1dHRvbj4KICAgJHsoUy5jaGF0fHxbXSkubGVuZ3RoPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyQ21kKCkiPkNsZWFyIGxvZzwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iY29tbWFuZCI+JHtMSVZFLmNvbW1hbmQoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBzZW5kQ21kKCl7CiAgY29uc3QgdD1jbWRUZXh0LnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhbiBvcmRlciBmaXJzdCcpOwogIGZsYXNoKCdDaGFpcm1hbiBpcyB0aGlua2luZ+KApicpOyBjbWRUZXh0LnZhbHVlPScnOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2NvbW1hbmQnLHt0ZXh0OnR9KTsgcmVuZGVyKCk7IH0KICBjYXRjaChlKXsgcmVuZGVyKCk7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyQ21kKCl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kL2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gVkVOVFVSRVMgLS0tLS0tLS0tLSAqLwpMSVZFLnZlbnR1cmVzPSgpPT57CiAgY29uc3QgST1TLmlkZWFzfHxbXSwgVj1TLnZlbnR1cmVzfHxbXTsKICBjb25zdCByYXc9SS5maWx0ZXIoaT0+aS5zdGF0dXM9PT0nUkFXJykubGVuZ3RoOwogIGNvbnN0IGRvbmU9SS5maWx0ZXIoaT0+aS5zdGF0dXM9PT0nUkVTRUFSQ0hFRCcpOwogIGNvbnN0IGJlc3Q9ZG9uZS5zbGljZSgpLnNvcnQoKGEsYik9PihiLnNjb3JlfHwwKS0oYS5zY29yZXx8MCkpWzBdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKEkubGVuZ3RoLCdJZGVhcyBHZW5lcmF0ZWQnLCd2YXIoLS1jeSknLHJhdysnIGF3YWl0aW5nIHJlc2VhcmNoJyl9CiAgICR7a3BpKGRvbmUubGVuZ3RoLCdSZXNlYXJjaGVkJywndmFyKC0tcHVyKScsJ2FnYWluc3QgbGl2ZSB3ZWIgZGF0YScpfQogICAke2twaShiZXN0P2Jlc3Quc2NvcmUrJy8xMDAnOifigJQnLCdCZXN0IFNjb3JlJyxiZXN0JiZiZXN0LnNjb3JlPj02MD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWFtYiknLGJlc3Q/ZXNjKGJlc3QudGl0bGUpLnNsaWNlKDAsMjYpOidub25lIHlldCcpfQogICAke2twaShWLmxlbmd0aCwnVmVudHVyZXMgTGF1bmNoZWQnLCd2YXIoLS1ncm4pJywnd2l0aCByZWFsIGFnZW50IHRlYW1zJyl9PC9kaXY+CiAgJHtWLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgVmVudHVyZXM8L2gzPgogICAke1YubWFwKHY9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tZ3JuKTtwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjE0cHgiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKHYudGl0bGUpfTwvYj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7di5hZ2VudHMubGVuZ3RofSBhZ2VudHMgwrcgZmlyc3QgcnVwZWUgaW4gfiR7di53ZWVrc313PC9zcGFuPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46NXB4IDAiPiR7ZXNjKHYucmV2ZW51ZVBhdGgpfTwvZGl2PgogICAgJHt2Lm93bmVyU3RlcHMubGVuZ3RoP2A8ZGl2IHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+WU9VUiBTVEVQUyAob25seSBhIGh1bWFuIGNhbiBkbyB0aGVzZSk6PC9iPgogICAgIDxvbCBzdHlsZT0ibWFyZ2luOjVweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHgiPiR7di5vd25lclN0ZXBzLm1hcChzPT5gPGxpPiR7ZXNjKHMpfTwvbGk+YCkuam9pbignJyl9PC9vbD48L2Rpdj5gOicnfQogICA8L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JZGVhIFBpcGVsaW5lIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7SS5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7SS5sZW5ndGg/SS5tYXAoaT0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCAkewogICAgICBpLnN0YXR1cz09PSdMQVVOQ0hFRCc/J3ZhcigtLWdybiknOmkuc3RhdHVzPT09J0tJTExFRCc/J3ZhcigtLWRpbTIpJzoKICAgICAgaS52ZXJkaWN0PT09J1BVUlNVRSc/J3ZhcigtLWN5KSc6aS52ZXJkaWN0PT09J0tJTEwnPyd2YXIoLS1tYWcpJzondmFyKC0tYW1iKSd9OwogICAgICBwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHg7JHtpLnN0YXR1cz09PSdLSUxMRUQnPydvcGFjaXR5Oi40NSc6Jyd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxiPiR7ZXNjKGkudGl0bGUpfTwvYj4KICAgICAgJHtpLnNjb3JlIT1udWxsP2A8c3BhbiBjbGFzcz0idGFnICR7aS5zY29yZT49NjA/J3QtZ3JuJzppLnNjb3JlPj00MD8ndC1hbWInOid0LXJlZCd9Ij4ke2kuc2NvcmV9LzEwMDwvc3Bhbj5gOicnfQogICAgICAke2kudmVyZGljdD9gPHNwYW4gY2xhc3M9InRhZyAke2kudmVyZGljdD09PSdQVVJTVUUnPyd0LWN5JzppLnZlcmRpY3Q9PT0nS0lMTCc/J3QtcmVkJzondC1kaW0nfSI+JHtpLnZlcmRpY3R9PC9zcGFuPmA6Jyd9CiAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7aS5zdGF0dXN9PC9zcGFuPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+4oK5JHtmbXQoaS5wcmljZSl9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7bWFyZ2luOjRweCAwIj4ke2VzYyhpLndoYXQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPkJ1eWVyOiAke2VzYyhpLmJ1eWVyKX08L2Rpdj4KICAgICR7aS5lZGdlP2A8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjVweDtmb250LXNpemU6MTJweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWxpbWUpIj5VbmZhaXIgZWRnZTo8L2I+ICR7ZXNjKGkuZWRnZSl9PC9kaXY+YDonJ30KICAgICR7aS53aHk/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDozcHgiPldoeSBub3c6ICR7ZXNjKGkud2h5KX08L2Rpdj5gOicnfQogICAgJHtpLnJlc2VhcmNoP2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiMwYTExMTk7Ym9yZGVyLXJhZGl1czo3cHg7cGFkZGluZzo5cHg7bWFyZ2luLXRvcDo3cHg7Zm9udC1zaXplOjExLjVweCI+CiAgICAgIDxkaXY+JHtlc2MoaS5yZXNlYXJjaC5yZWFzb25pbmcpfTwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjZweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+Rmlyc3Qgc3RlcDo8L2I+ICR7ZXNjKGkucmVzZWFyY2guZmlyc3RTdGVwKX08L2Rpdj4KICAgICAgPGRpdj48YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+S2lsbCByaXNrOjwvYj4gJHtlc2MoaS5yZXNlYXJjaC5raWxsUmlzayl9PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo1cHgiPmRlbWFuZCAke2kucmVzZWFyY2guZGVtYW5kfS8xMCDCtyBjb21wZXRpdGlvbiAke2kucmVzZWFyY2guY29tcGV0aXRpb259LzEwIMK3IHNwZWVkICR7aS5yZXNlYXJjaC5zcGVlZH0vMTAgwrcgZml0ICR7aS5yZXNlYXJjaC5maXR9LzEwPC9kaXY+PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4KICAgICAke2kuc3RhdHVzPT09J1JBVyc/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBvbmNsaWNrPSJyZXNlYXJjaElkZWEoJyR7aS5pZH0nKSI+UkVTRUFSQ0ggSVQ8L2J1dHRvbj5gOicnfQogICAgICR7aS5zdGF0dXM9PT0nUkVTRUFSQ0hFRCc/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBvayIgb25jbGljaz0ibGF1bmNoSWRlYSgnJHtpLmlkfScpIj5CVUlMRCBBR0VOVCBURUFNPC9idXR0b24+YDonJ30KICAgICAke2kuc3RhdHVzIT09J0tJTExFRCcmJmkuc3RhdHVzIT09J0xBVU5DSEVEJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJraWxsSWRlYSgnJHtpLmlkfScpIj5LaWxsPC9idXR0b24+YDonJ30KICAgIDwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIGlkZWFzIHlldC4gUHJlc3MgR0VORVJBVEUgSURFQVMgYW5kIGhlIHdpbGwgaW52ZW50IHRoZW0uPC9kaXY+J308L2Rpdj5gOwp9OwpSRU5ERVIudmVudHVyZXM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7il4YgVkVOVFVSRSBFTkdJTkUg4oCUIElERUFTIOKGkiBSRUFMIFJFU0VBUkNIIOKGkiBBR0VOVCBURUFNUzwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSBpbnZlbnRzIHZlbnR1cmVzLCByZXNlYXJjaGVzIGVhY2ggb25lIGFnYWluc3QgPGI+bGl2ZSB3ZWIgc2VhcmNoPC9iPiAobm90IG1vZGVsIG1lbW9yeSksIHNjb3JlcyBpdCBvdXQgb2YgMTAwLCBhbmQgZGVzaWducyB0aGUgYWdlbnQgdGVhbSB0byBleGVjdXRlLiBBZ2VudHMgd2hvc2UgdG9vbHMgbWFwIHRvIG5vIHJlYWwgY29kZSBhcmUgcmVmdXNlZCwgc28gbm90aGluZyBkZWNvcmF0aXZlIGdldHMgY3JlYXRlZC48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PcHRpb25hbCBzdGVlciA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihsZWF2ZSBibGFuayBhbmQgaGUgZGVjaWRlcyk8L3NwYW4+PC9zcGFuPgogICA8aW5wdXQgaWQ9ImlkZWFTdGVlciIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiBmb2N1cyBvbiBCMkIsIG9yIG9ubGluZS1vbmx5LCBvciB1bmRlciA1MDAgSU5SIHRvIHN0YXJ0Ij48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImdlbklkZWFzKCkiPkdFTkVSQVRFIElERUFTPC9idXR0b24+CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLmF1dG9JZGVhcz8ndC1yZWQnOid0LWRpbSd9Ij5JREVBIEFVVE9QSUxPVCAke1MuYXV0b0lkZWFzPydPTic6J09GRid9PC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvSWRlYXM/J25vJzonJ30iIG9uY2xpY2s9InRvZ2dsZUlkZWFBdXRvKCkiPiR7Uy5hdXRvSWRlYXM/J1NUT1AgQVVUT1BJTE9UJzonRU5BQkxFIElERUEgQVVUT1BJTE9UJ308L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5BdXRvcGlsb3QgPSBoZSBpbnZlbnRzIGFuZCByZXNlYXJjaGVzIHZlbnR1cmVzIHVucHJvbXB0ZWQsIGV2ZXJ5IH41IG1pbnV0ZXMuPC9zcGFuPjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9InZlbnR1cmVzIj4ke0xJVkUudmVudHVyZXMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBnZW5JZGVhcygpeyBmbGFzaCgnVGhpbmtpbmcgdXAgdmVudHVyZXPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvZ2VuZXJhdGUnLHtuOjUsc3RlZXI6aWRlYVN0ZWVyLnZhbHVlLnRyaW0oKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBpZGVhKHMpIGdlbmVyYXRlZCcpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2VhcmNoSWRlYShpZCl7IGZsYXNoKCdTZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9pZGVhL3Jlc2VhcmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnU2NvcmVkICcrci5zY29yZSsnLzEwMCDigJQgJytyLnZlcmRpY3QpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIGxhdW5jaElkZWEoaWQpeyBmbGFzaCgnRGVzaWduaW5nIGFnZW50IHRlYW3igKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvbGF1bmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLmFnZW50cysnIGFnZW50KHMpIGNvbW1pc3Npb25lZCcrKHIuc2tpcHBlZD8nIMK3ICcrci5za2lwcGVkKycgcmVqZWN0ZWQgYXMgbm9uLWV4ZWN1dGFibGUnOicnKSk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24ga2lsbElkZWEoaWQpeyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9raWxsJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVJZGVhQXV0bygpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2lkZWEvYXV0b3BpbG90Jyx7b246IVMuYXV0b0lkZWFzfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvSWRlYXM/J0F1dG9waWxvdCBPTiDigJQgaGUgd2lsbCBpbnZlbnQgdmVudHVyZXMgb24gaGlzIG93bic6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIFBBWU1FTlRTIC0tLS0tLS0tLS0gKi8KTElWRS5wYXk9KCk9PnsKICBjb25zdCBPPVMub3JkZXJzfHxbXTsKICBjb25zdCBwYWlkPU8uZmlsdGVyKG89Pm8ucGFpZD4wKS5yZWR1Y2UoKGEsbyk9PmErby5wYWlkLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKE8ubGVuZ3RoLCdMaW5rcyBSYWlzZWQnLCd2YXIoLS1jeSknLCdsaWZldGltZScpfQogICAke2twaShPLmZpbHRlcihvPT5vLnBhaWQ+MCkubGVuZ3RoLCdQYWlkJyxwYWlkPyd2YXIoLS1ncm4pJzondmFyKC0tZGltKScsJ3NldHRsZWQnKX0KICAgJHtrcGkoKFMucGF5PyhTLnBheS5nYXRld2F5PT09J3Jhem9ycGF5Jz8n4oK5JzonJCcpOicnKStmbXQocGFpZCksJ0NvbGxlY3RlZCcsJ3ZhcigtLWdybiknLCdyZWFsIG1vbmV5Jyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBheW1lbnQgTGlua3M8L2gzPgogICAke08ubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5Gb3I8L3RoPjx0aD5BbW91bnQ8L3RoPjx0aD5Nb2RlPC90aD48dGg+U3RhdHVzPC90aD48dGg+TGluazwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtPLm1hcChvPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7by50fTwvdGQ+CiAgICA8dGQ+JHtlc2Moby5kZXNjKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moby5jdXN0b21lcil9PC9kaXY+PC90ZD4KICAgIDx0ZD4ke28uY3VycmVuY3l9ICR7Zm10KG8uYW1vdW50KX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtvLmxpdmU/J3QtcmVkJzondC1kaW0nfSI+JHtvLmxpdmU/J0xJVkUnOidURVNUJ308L3NwYW4+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5wYWlkPjA/J3QtZ3JuJzondC1hbWInfSI+JHtvLnBhaWQ+MD8nUEFJRCc6ZXNjKG8uc3RhdHVzKX08L3NwYW4+PC90ZD4KICAgIDx0ZD48YSBocmVmPSIke2VzYyhvLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+b3BlbiDihpc8L2E+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHBheW1lbnQgbGlua3MgcmFpc2VkIHlldC48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi5wYXk9KCk9PnsKICBjb25zdCBQPVMucGF5LCBHVz1TLmdhdGV3YXlzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtQPyhQLmxpdmU/JyM2YjIyMzMnOicjMWM1YzNjJyk6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtQPyhQLmxpdmU/JyMxNjBiMGMnOicjMDgxNzBmJyk6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtQPyhQLmxpdmU/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyk6J3ZhcigtLWFtYiknfSI+4oK5IFBBWU1FTlRTIOKAlCAke1A/KFAubGl2ZT8nTElWRSDCtyBSRUFMIE1PTkVZJzonQ09OTkVDVEVEIMK3IFRFU1QgTU9ERScpOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7UAogICAgP2BWZXJpZmllZCBhZ2FpbnN0IDxiPiR7ZXNjKFAuZ2F0ZXdheSl9PC9iPiwga2V5ICR7ZXNjKFAua2V5SWQpfS4gJHtQLmxpdmUKICAgICAgPyc8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+TElWRSBNT0RFIOKAlCBsaW5rcyB5b3UgcmFpc2UgdGFrZSByZWFsIG1vbmV5LiBFdmVyeSBsaW5rIG5lZWRzIHlvdXIgcGFzc3dvcmQuPC9iPicKICAgICAgOidUZXN0IG1vZGUuIExpbmtzIHdvcmsgZW5kLXRvLWVuZCBidXQgbW92ZSBubyByZWFsIG1vbmV5Lid9YAogICAgOidDb25uZWN0IFJhem9ycGF5IG9yIFN0cmlwZSBiZWxvdy4gS2V5cyBhcmUgdmVyaWZpZWQgYWdhaW5zdCB0aGUgcmVhbCBBUEkgYmVmb3JlIGJlaW5nIGFjY2VwdGVkIOKAlCBhIHdyb25nIGtleSBpcyByZWplY3RlZCBpbW1lZGlhdGVseSwgbm90IHN0b3JlZC4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+U3RhcnQgd2l0aCA8Yj50ZXN0IGtleXM8L2I+LiBSYXpvcnBheSA8Y29kZT5yenBfdGVzdF88L2NvZGU+LCBTdHJpcGUgPGNvZGU+c2tfdGVzdF88L2NvZGU+IOKAlCBpbnN0YW50LCBubyBLWUMuPC9saT4KICAgIDxsaT5MaXZlIGtleXMgbmVlZCBLWUMgKFBBTiArIGJhbmsgZm9yIFJhem9ycGF5KS4gUHJvdmlkZXJzIGNoYXJnZSB+MiUgcGVyIHRyYW5zYWN0aW9uIOKAlCB0aGF0IGlzIHRoZSBjb3N0IG9mIG1vdmluZyBtb25leSwgbm90IHNvbWV0aGluZyB0byByb3V0ZSBhcm91bmQuPC9saT4KICAgIDxsaT5Zb3VyIHNlY3JldCBpcyBuZXZlciByZXR1cm5lZCBieSB0aGUgQVBJIGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBHYXRld2F5PC9oMz4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+R2F0ZXdheTwvc3Bhbj48c2VsZWN0IGlkPSJwZ1NlbCIgY2xhc3M9ImluIiBvbmNoYW5nZT0icGF5SGludCgpIj4KICAgICAke0dXLm1hcChnPT5gPG9wdGlvbiB2YWx1ZT0iJHtnLmlkfSIgJHtQJiZQLmdhdGV3YXk9PT1nLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKGcubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icGF5SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPktleSBJRCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihSYXpvcnBheSBvbmx5KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJwZ0lkIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icnpwX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TZWNyZXQgS2V5PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdTZWNyZXQiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ic2VjcmV0IC8gc2tfdGVzdF8uLi4iPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0UGF5KCkiPlZFUklGWSAmYW1wOyBDT05ORUNUPC9idXR0b24+CiAgICAgJHtQPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlUGF5KCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmFpc2UgYSBQYXltZW50IExpbms8L2gzPgogICAgJHshUD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iPkNvbm5lY3QgYSBnYXRld2F5IGZpcnN0LjwvZGl2Pic6YAogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BbW91bnQgJHtQLmdhdGV3YXk9PT0ncmF6b3JwYXknPycoSU5SKSc6JyhVU0QpJ308L3NwYW4+PGlucHV0IGlkPSJwbEFtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSIyNTAwIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VzdG9tZXIgbmFtZTwvc3Bhbj48aW5wdXQgaWQ9InBsTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXMgaXQgZm9yPC9zcGFuPjxpbnB1dCBpZD0icGxEZXNjIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJXZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIOKAlCBBdWd1c3QiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkVtYWlsPC9zcGFuPjxpbnB1dCBpZD0icGxFbWFpbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QaG9uZTwvc3Bhbj48aW5wdXQgaWQ9InBsUGhvbmUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgJHtQLmxpdmU/YDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgY29uZmlybSB3aXRoIHlvdXIgcGFzc3dvcmQ8L3NwYW4+CiAgICAgIDxpbnB1dCBpZD0icGxQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+YDonJ30KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im1ha2VMaW5rKCkiPkNSRUFURSBMSU5LPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZWZyZXNoUGF5KCkiPkNIRUNLIEZPUiBQQVlNRU5UUzwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+WW91IGdldCBhIFVSTCB0byBzZW5kIG92ZXIgV2hhdHNBcHAgb3IgZW1haWwuIFdoZW4gaXQgc2V0dGxlcywgdGhlIGxlZGdlciB1cGRhdGVzIGFuZCB5b3UgZ2V0IGFuIGVtYWlsLjwvZGl2PmB9PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBkYXRhLWxpdmU9InBheSI+JHtMSVZFLnBheSgpfTwvZGl2PmA7Cn07CmZ1bmN0aW9uIHBheUhpbnQoKXsKICBjb25zdCBnPShTLmdhdGV3YXlzfHxbXSkuZmluZCh4PT54LmlkPT09ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BnU2VsJykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXlIaW50Jyk7CiAgaWYoZyYmZWwpIGVsLmlubmVySFRNTD1gPGI+JHtlc2MoZy5sYWJlbCl9PC9iPjxicj4ke2VzYyhnLnNpZ251cCl9PGJyPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZy5rZXlIaW50KX08L3NwYW4+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0UGF5KCl7CiAgZmxhc2goJ1ZlcmlmeWluZyBrZXlzIGFnYWluc3QgdGhlIHJlYWwgQVBJ4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvY29ubmVjdCcse2dhdGV3YXk6cGdTZWwudmFsdWUsa2V5SWQ6cGdJZC52YWx1ZSxrZXlTZWNyZXQ6cGdTZWNyZXQudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmxpdmU/J0NPTk5FQ1RFRCDigJQgTElWRSBNT0RFLCByZWFsIG1vbmV5JzonQ29ubmVjdGVkIGluIFRFU1QgbW9kZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VQYXkoKXsgaWYoIWNvbmZpcm0oJ0Rpc2Nvbm5lY3QgdGhlIHBheW1lbnQgZ2F0ZXdheT8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9wYXkvcHVyZ2UnLHt9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBtYWtlTGluaygpewogIGZsYXNoKCdDcmVhdGluZyBsaW5r4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvbGluaycse2Ftb3VudDorcGxBbXQudmFsdWUsZGVzY3JpcHRpb246cGxEZXNjLnZhbHVlLAogICAgICBuYW1lOnBsTmFtZS52YWx1ZSxlbWFpbDpwbEVtYWlsLnZhbHVlLHBob25lOnBsUGhvbmUudmFsdWUsCiAgICAgIHB3Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxQdycpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5QYXltZW50IGxpbmsgcmVhZHk8L2gzPgogICAgIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXYgc3R5bGU9IndvcmQtYnJlYWs6YnJlYWstYWxsO2NvbG9yOnZhcigtLWN5KSI+JHtlc2Moci51cmwpfTwvZGl2PjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgnJHtlc2Moci51cmwpfScpO2ZsYXNoKCdDb3BpZWQnKSI+Q29weSBsaW5rPC9idXR0b24+CiAgICAgIDxhIGNsYXNzPSJidG4iIGhyZWY9IiR7ZXNjKHIudXJsKX0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5PcGVuIOKGlzwvYT4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiByZWZyZXNoUGF5KCl7IGZsYXNoKCdDaGVja2luZyBnYXRld2F54oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvcmVmcmVzaCcse30pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIudXBkYXRlZD9yLnVwZGF0ZWQrJyBvcmRlcihzKSB1cGRhdGVkJzonTm8gY2hhbmdlcycpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIERFRVAgUkVTRUFSQ0ggLS0tLS0tLS0tLSAqLwpSRU5ERVIucmVzZWFyY2g9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzFjM2Y3NTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzA4MTMxZiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ibHUpIj7wn4yQIERFRVAgUkVTRUFSQ0gg4oCUIExJVkUgRlJPTSBUSEUgT1BFTiBXRUI8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgZG9lcyBub3Qgc3RvcmUgdGhlIHdvcmxkJ3MgZGF0YSDigJQgbm9ib2R5IGNhbi4gSW5zdGVhZCBoZSA8Yj5mZXRjaGVzIGl0IGxpdmUgdGhlIG1vbWVudCB5b3UgYXNrPC9iPiwgd2hpY2ggaXMgYmV0dGVyLCBiZWNhdXNlIHN0b3JlZCBkYXRhIGlzIHN0YWxlIHdpdGhpbiBkYXlzLiBTb3VyY2VzOiBEdWNrRHVja0dvLCBXaWtpcGVkaWEsIFdvcmxkIEJhbmssIGxpdmUgRlguIE5vIEFQSSBrZXksIG5vIHBhaWQgc2VhcmNoLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+RGVlcCBkaXZlPC9iPiBzZWFyY2hlcyA1IGRpZmZlcmVudCBhbmdsZXMsIGRlZHVwbGljYXRlcywgYWRkcyBvcGVuIGRhdGFzZXRzLCB0aGVuIHJlYXNvbnMgb3ZlciB0aGUgbG90LjwvbGk+CiAgIDxsaT48Yj5SZWFkIHBhZ2U8L2I+IHB1bGxzIHRoZSBmdWxsIHRleHQgb2YgYW55IFVSTCDigJQgY29tcGV0aXRvciBzaXRlcywgcHJpY2UgbGlzdHMsIGdvdmVybm1lbnQgcGFnZXMuPC9saT4KICAgPGxpPkhlIGlzIGluc3RydWN0ZWQgdG8gc3RhdGUgd2hhdCBoZSBjb3VsZCA8Yj5ub3Q8L2I+IGZpbmQsIHJhdGhlciB0aGFuIGZpbGxpbmcgZ2FwcyB3aXRoIGludmVudGlvbi48L2xpPgogIDwvdWw+PC9kaXY+CiAkeyFTLmxsbT8nPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdCDigJQgcmVzZWFyY2ggbmVlZHMgcmVhc29uaW5nIHRvIGJlIHVzZWZ1bC48L2Rpdj48L2Rpdj4nOicnfQogPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlZXAgRGl2ZSBhIFRvcGljPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub3BpYzwvc3Bhbj48aW5wdXQgaWQ9ImR2VG9waWMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gdXB0aW1lIG1vbml0b3JpbmcgZGVtYW5kIGZvciBMdWRoaWFuYSBlLWNvbW1lcmNlIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlJlZ2lvbjwvc3Bhbj48aW5wdXQgaWQ9ImR2UmVnaW9uIiBjbGFzcz0iaW4iIHZhbHVlPSJMdWRoaWFuYSBQdW5qYWIgSW5kaWEiPjwvbGFiZWw+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb0RpdmUoKSI+SU5WRVNUSUdBVEU8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGFrZXMgfjE1cy4gRml2ZSBzZWFyY2hlcyBwbHVzIG9wZW4gZGF0YS48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVhZCBBbnkgUGFnZTwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0icmRVcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vY29tcGV0aXRvci5jb20vcHJpY2luZyI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGRvIHlvdSB3YW50IHRvIGtub3c/IChvcHRpb25hbCk8L3NwYW4+PGlucHV0IGlkPSJyZEFzayIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0id2hhdCBkbyB0aGV5IGNoYXJnZSBhbmQgd2hhdCBpcyBtaXNzaW5nIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9SZWFkKCkiPlJFQUQgSVQ8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+UHVsbHMgdXAgdG8gMTIsMDAwIGNoYXJhY3RlcnMgb2YgcmVhbCBwYWdlIHRleHQuPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgaWQ9InJlc091dCI+PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZG9EaXZlKCl7CiAgY29uc3QgdD1kdlRvcGljLnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhIHRvcGljJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPlNlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvZGl2ZScse3RvcGljOnQscmVnaW9uOmR2UmVnaW9uLnZhbHVlfSk7CiAgICByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RmluZGluZ3MgPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5ldmlkZW5jZSl9IGNoYXJzIG9mIGV2aWRlbmNlPC9zcGFuPjwvaDM+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjUiPiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+YDsKICB9Y2F0Y2goZSl7IHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gIH0KfQphc3luYyBmdW5jdGlvbiBkb1JlYWQoKXsKICBjb25zdCB1PXJkVXJsLnZhbHVlLnRyaW0oKTsgaWYoIXUpIHJldHVybiBmbGFzaCgnUGFzdGUgYSBVUkwnKTsKICByZXNPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+RmV0Y2hpbmcgcGFnZeKApjwvZGl2PjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9yZXNlYXJjaC9yZWFkJyx7dXJsOnUsYXNrOnJkQXNrLnZhbHVlLnRyaW0oKX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPiR7ZXNjKHIudGl0bGUpfSA8c3BhbiBjbGFzcz0idGFnIHQtYmx1Ij4ke2ZtdChyLmNoYXJzKX0gY2hhcnMgcmVhZDwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KCi8qIC0tLS0tLS0tLS0gQUkgQlJBSU4gLS0tLS0tLS0tLSAqLwpSRU5ERVIuYnJhaW49KCk9PnsKICBjb25zdCBMPVMubGxtLCBQVj1TLnByb3ZpZGVyc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7TD8nIzFjNWMzYyc6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtMPycjMDgxNzBmJzonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjoke0w/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJ30iPuKXiCBBSSBCUkFJTiDigJQgJHtMPydDT05ORUNURUQnOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7TAogICAgP2BBZ2VudHMgY2FuIHRoaW5rLiBDb25uZWN0ZWQgdG8gPGI+JHtlc2MoTC5wcm92aWRlcil9PC9iPiBydW5uaW5nIDxiPiR7ZXNjKEwubW9kZWwpfTwvYj4uIEtleSAke2VzYyhMLmtleSl9LmAKICAgIDonWW91ciBhZ2VudHMgY2FuIG1lYXN1cmUgdGhpbmdzIGJ1dCBjYW5ub3QgPGI+cmVhc29uPC9iPiB5ZXQuIENvbm5lY3QgYSBmcmVlIG1vZGVsIGJlbG93IGFuZCB0aGV5IGdhaW4gdGhlIGFiaWxpdHkgdG8gZGlhZ25vc2UsIHdyaXRlLCBhbmFseXNlIGFuZCBzdHJhdGVnaXNlLid9PC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPjxsaT5FdmVyeSBwcm92aWRlciBiZWxvdyBpcyA8Yj5nZW51aW5lbHkgZnJlZTwvYj4g4oCUIG5vIGNyZWRpdCBjYXJkLjwvbGk+CiAgICA8bGk+WW91ciBrZXkgaXMgc3RvcmVkIGxvY2FsbHkgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2xpPjwvdWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7impEgV0FOVCBISU0gRlVMTFkgSU5ERVBFTkRFTlQ/IOKAlCBSRUFEIFRISVM8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+QSB0aGlua2luZyBicmFpbiBjYW5ub3QgYmUgY29uanVyZWQgZnJvbSBub3RoaW5nLiBUcmFpbmluZyBvbmUgY29zdHMgbWlsbGlvbnMgaW4gR1BVIHRpbWUuIEV2ZXJ5IEFJIG9uIGVhcnRoIOKAlCBpbmNsdWRpbmcgdGhpcyBvbmUg4oCUIHJ1bnMgd2VpZ2h0cyB0cmFpbmVkIGJ5IHNvbWVvbmUgd2l0aCBhIGRhdGEgY2VudHJlLiBUaGUgaG9uZXN0IHF1ZXN0aW9uIGlzIG5vdCA8ZW0+ImhpcyBicmFpbiBvciB0aGVpcnMiPC9lbT4gYnV0IDxiPiJ3aG8gY2FuIHN3aXRjaCBpdCBvZmYiPC9iPi48L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5PbGxhbWEgaXMgdGhlIGFuc3dlciB0byB0aGF0LjwvYj4gVGhlIG1vZGVsIGZpbGUgc2l0cyBvbiB5b3VyIG93biBkaXNrLiBObyBrZXksIG5vIGFjY291bnQsIG5vIHJhdGUgbGltaXQsIG5vIHRlcm1zIG9mIHNlcnZpY2UuIEl0IHdvcmtzIHdpdGggdGhlIGludGVybmV0IHVucGx1Z2dlZC4gTm9ib2R5IGNhbiByZXZva2UgaXQsIHJlYWQgeW91ciBwcm9tcHRzLCBvciBjaGFuZ2UgdGhlIGRlYWwuIFRoYXQgaXMgcmVhbCBzb3ZlcmVpZ250eSDigJQgdGhlIG9ubHkgY29zdCBpcyB5b3VyIGhhcmR3YXJlLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPjEuIEluc3RhbGw8L3RkPjx0ZD5Eb3dubG9hZCBmcm9tIDxiPm9sbGFtYS5jb208L2I+IChmcmVlLCBXaW5kb3dzL01hYy9MaW51eCk8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+Mi4gR2V0IGEgbW9kZWw8L3RkPjx0ZD5JbiB0ZXJtaW5hbDogPGNvZGU+b2xsYW1hIHB1bGwgbGxhbWEzLjI8L2NvZGU+IOKAlCBhYm91dCAyIEdCPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjMuIENvbm5lY3Q8L3RkPjx0ZD5DaG9vc2UgPGI+T2xsYW1hPC9iPiBhYm92ZSwgbGVhdmUgdGhlIGtleSBibGFuaywgcHJlc3MgQ09OTkVDVDwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CaWdnZXIgYnJhaW48L3RkPjx0ZD48Y29kZT5vbGxhbWEgcHVsbCBxd2VuMi41OjE0YjwvY29kZT4gaWYgeW91IGhhdmUgMTYgR0IrIFJBTTwvdGQ+PC90cj4KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48Yj5UaGUgdHJhZGUtb2ZmLCBzdGF0ZWQgcGxhaW5seTo8L2I+IGEgbG9jYWwgbW9kZWwgb24gYSBub3JtYWwgbGFwdG9wIGlzIHNsb3dlciBhbmQgbGVzcyBjYXBhYmxlIHRoYW4gR3JvcSdzIGZyZWUgY2xvdWQgbW9kZWxzLiBZb3UgYXJlIGV4Y2hhbmdpbmcgcmF3IHBvd2VyIGZvciB0b3RhbCBjb250cm9sLiBBbHNvIOKAlCB0aGlzIFJlbmRlciBpbnN0YW5jZSBjYW5ub3QgcmVhY2ggYW4gT2xsYW1hIHJ1bm5pbmcgb24geW91ciBQQzsgbG9jYWwgYnJhaW4gbWVhbnMgcnVubmluZyB0aGUgQ2hhaXJtYW4gbG9jYWxseSB0b28uPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db25uZWN0IGEgRnJlZSBNb2RlbDwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlByb3ZpZGVyPC9zcGFuPjxzZWxlY3QgaWQ9ImxwUHJvdiIgY2xhc3M9ImluIiBvbmNoYW5nZT0icHJvdkhpbnQoKSI+CiAgICAgJHtQVi5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iICR7TCYmTC5wcm92aWRlcj09PXAuaWQ/J3NlbGVjdGVkJzonJ30+JHtlc2MocC5sYWJlbCl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIGlkPSJwcm92SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFQSSBLZXkgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obm90IG5lZWRlZCBmb3IgT2xsYW1hKTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscEtleSIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJwYXN0ZSB5b3VyIGZyZWUga2V5Ij48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Nb2RlbCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihibGFuayA9IHByb3ZpZGVyIGRlZmF1bHQpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImxwTW9kZWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImxlYXZlIGJsYW5rIiBsaXN0PSJtb2RlbExpc3QiPgogICAgIDxkYXRhbGlzdCBpZD0ibW9kZWxMaXN0Ij48L2RhdGFsaXN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJhc2UgVVJMIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KG9ubHkgZm9yIEN1c3RvbSDigJQgYW55IE9wZW5BSS1jb21wYXRpYmxlIEFQSSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibHBIb3N0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2FwaS5kZWVwc2Vlay5jb20vdjEiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0TExNKCkiPkNPTk5FQ1QgQlJBSU48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RMTE0oKSI+VEVTVCBJVDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZmV0Y2hNb2RlbHMoKSI+RkVUQ0ggTElWRSBNT0RFTFM8L2J1dHRvbj4KICAgICAke0w/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VMTE0oKSI+RGlzY29ubmVjdDwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Qcm92aWRlcnMgcmV0aXJlIG1vZGVscyB3aXRob3V0IG5vdGljZS4gSWYgVEVTVCBJVCBzYXlzIE1PREVMIFJFVElSRUQsIHByZXNzIEZFVENIIExJVkUgTU9ERUxTIGFuZCBwaWNrIG9uZSBmcm9tIHRoZSBsaXN0LjwvZGl2PjwvZGl2PgogICAke0w/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tYW1iKSI+CiAgICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKHhCBTV0lUQ0ggTU9ERUwg4oCUIEtFRVBTIFlPVVIgS0VZPC9oMz4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5DdXJyZW50bHkgcnVubmluZyA8Yj4ke2VzYyhMLm1vZGVsKX08L2I+IG9uICR7ZXNjKEwucHJvdmlkZXIpfS4gUHJvdmlkZXJzIHJldGlyZSBtb2RlbHMgd2l0aG91dCBub3RpY2Ug4oCUIHN3YXAgaXQgaGVyZSB3aXRob3V0IGRpc2Nvbm5lY3Rpbmcgb3IgcmUtcGFzdGluZyB5b3VyIGtleS48L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgICAgPGlucHV0IGlkPSJzd01vZGVsIiBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjgwcHgiIHBsYWNlaG9sZGVyPSJ0eXBlIGEgbW9kZWwgbmFtZSIgdmFsdWU9IiR7ZXNjKEwubW9kZWwpfSI+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InN3aXRjaE1vZGVsKCkiPlNXSVRDSDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZmV0Y2hNb2RlbHMoKSI+RkVUQ0ggTElWRSBMSVNUPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0TExNKCkiPlRFU1QgSVQ8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPktub3duIHdvcmtpbmcgb24gR3JvcSByaWdodCBub3cg4oCUIGNsaWNrIHRvIHVzZTo8L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyI+JHtbJ29wZW5haS9ncHQtb3NzLTEyMGInLCdvcGVuYWkvZ3B0LW9zcy0yMGInLCdxd2VuL3F3ZW4zLjYtMjdiJ10KICAgICAgLm1hcChtPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJxdWlja01vZGVsKCcke219JykiPiR7bX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICAgPC9kaXY+YDonJ30KICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjokeyhTLmNvb2xkb3dufHwwKT8ndmFyKC0tbWFnKSc6J3ZhcigtLXN0cm9rZSknfSI+CiAgICA8aDM+QmFja3VwIFByb3ZpZGVycyA8c3BhbiBjbGFzcz0idGFnICR7KFMubGxtQmFja3Vwc3x8W10pLmxlbmd0aD8ndC1ncm4nOid0LWRpbSd9Ij4keyhTLmxsbUJhY2t1cHN8fFtdKS5sZW5ndGh9IFNQQVJFPC9zcGFuPjwvaDM+CiAgICAkeyhTLmNvb2xkb3dufHwwKT9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48Yj5RVU9UQSBDT09MRE9XTiDigJQgJHtNYXRoLmNlaWwoUy5jb29sZG93bi82MCl9IG1pbiBsZWZ0LjwvYj4gVGhlIGZyZWUgdGllciB0aHJvdHRsZWQuIEFJIHdvcmsgaXMgcGF1c2VkIHNvIHRoZSBsaW1pdCBjYW4gcmVzZXQ7IG1vbml0b3Jpbmcga2VlcHMgcnVubmluZy4gQWRkIGEgYmFja3VwIGJlbG93IGFuZCB3b3JrIGNvbnRpbnVlcyBzdHJhaWdodCB0aHJvdWdoIHRoZSBuZXh0IGxpbWl0LgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNsZWFyQ29vbCgpIj5DbGVhciBjb29sZG93biBub3c8L2J1dHRvbj48L2Rpdj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkZyZWUgdGllcnMgdGhyb3R0bGUuIEFkZCA8Yj51cCB0byA0MCBrZXlzPC9iPiDigJQgZnJvbSBkaWZmZXJlbnQgcHJvdmlkZXJzLCBvciBzZXZlcmFsIGtleXMgZnJvbSB0aGUgc2FtZSBvbmUuIFdoZW4gYW55IGtleSBpcyByYXRlLWxpbWl0ZWQgaXQgaXMgcGFya2VkIGZvciAxMCBtaW51dGVzIGFuZCB0aGUgQ2hhaXJtYW4gcm90YXRlcyB0byB0aGUgbmV4dCBhdXRvbWF0aWNhbGx5LiBOb3RoaW5nIHN0b3BzLjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qcm92aWRlcjwvc3Bhbj48c2VsZWN0IGlkPSJia1Byb3YiIGNsYXNzPSJpbiI+CiAgICAgICR7KFMucHJvdmlkZXJzfHxbXSkubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9Ij4ke2VzYyhwLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QVBJIGtleTwvc3Bhbj48aW5wdXQgaWQ9ImJrS2V5IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk1vZGVsIChibGFuayA9IGRlZmF1bHQpPC9zcGFuPjxpbnB1dCBpZD0iYmtNb2RlbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ibGVhdmUgYmxhbmsiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CYXNlIFVSTCAoQ3VzdG9tIG9ubHkpPC9zcGFuPjxpbnB1dCBpZD0iYmtIb3N0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2FwaS5kZWVwc2Vlay5jb20vdjEiPjwvbGFiZWw+CiAgICA8L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhZGRCYWNrdXAoKSI+QUREIEJBQ0tVUDwvYnV0dG9uPgogICAgJHsoUy5sbG1CYWNrdXBzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPiM8L3RoPjx0aD5Qcm92aWRlcjwvdGg+PHRoPk1vZGVsPC90aD48dGg+S2V5PC90aD48dGg+U2VydmVkPC90aD48dGg+U3RhdGU8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAgJHtTLmxsbUJhY2t1cHMubWFwKChiLGkpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7aSsxfTwvdGQ+PHRkPiR7ZXNjKGIucHJvdmlkZXIpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGIubW9kZWwpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYi5rZXkpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7Yi5va3x8MH0ke2IuZmFpbD8nIC8gJytiLmZhaWwrJ+Kclyc6Jyd9PC90ZD4KICAgICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtiLmNvb2xlZD8ndC1hbWInOid0LWdybid9Ij4ke2IuY29vbGVkPydDT09MSU5HJzonUkVBRFknfTwvc3Bhbj48L3RkPgogICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybUJhY2t1cCgke2l9KSI+UmVtb3ZlPC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+UmVjb21tZW5kZWQgc3BhcmVzOiA8Yj5Hb29nbGUgQUkgU3R1ZGlvPC9iPiAoMSw1MDAvZGF5KSwgPGI+Q2VyZWJyYXM8L2I+ICgxTSB0b2tlbnMvZGF5KSwgPGI+TlZJRElBIE5JTTwvYj4uIERpZmZlcmVudCBjb21wYW5pZXMgbWVhbnMgc2VwYXJhdGUgcXVvdGFzLjwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+V2hhdCBBZ2VudHMgR2FpbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5haS5icmllZjwvdGQ+PHRkPkV4ZWN1dGl2ZSBicmllZiB3cml0dGVuIGZyb20geW91ciByZWFsIHN5c3RlbSBzdGF0ZTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkuaW5jaWRlbnQ8L3RkPjx0ZD5SYW5rZWQgZGlhZ25vc2lzIG9mIGFueSBzaXRlIHRoYXQgZ29lcyBkb3duPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5yZXZlbnVlPC90ZD48dGQ+Q29uY3JldGUgbW9uZXktbWFraW5nIHJvdXRlcyBmcm9tIHdoYXQgeW91IGFjdHVhbGx5IGhhdmU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmNsaWVudF9yZXBvcnQ8L3RkPjx0ZD5DbGllbnQtcmVhZHkgdXB0aW1lIHJlcG9ydCB5b3UgY2FuIHNlbmQgYW5kIGNoYXJnZSBmb3I8L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWRkIHRoZXNlIG9uIHRoZSBMaXZlIE9wZXJhdGlvbnMgcGFnZSBhcyBzdGFuZGluZyBvcmRlcnMsIG9yIHJ1biB0aGVtIG9uIGRlbWFuZCBmcm9tIEFnZW50IFdvcmsuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmZ1bmN0aW9uIHByb3ZIaW50KCl7CiAgY29uc3QgcD0oUy5wcm92aWRlcnN8fFtdKS5maW5kKHg9PnguaWQ9PT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBQcm92JykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm92SGludCcpOwogIGlmKHAmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48YnI+JHtlc2MocC5zaWdudXApfTxicj5EZWZhdWx0IG1vZGVsOiA8Y29kZT4ke2VzYyhwLm1vZGVsKX08L2NvZGU+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0TExNKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Nvbm5lY3QnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlLG1vZGVsOmxwTW9kZWwudmFsdWUsaG9zdDooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwSG9zdCcpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQnJhaW4gY29ubmVjdGVkIOKAlCBub3cgcHJlc3MgVEVTVCBJVCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gdGVzdExMTSgpeyBmbGFzaCgnVGhpbmtpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS90ZXN0Jyx7fSk7IHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5BSSBCcmFpbiBPbmxpbmU8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXY+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5tb2RlbCl9IMK3ICR7ci5tc31tczwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnbygnd29yaycpIj5HaXZlIGl0IHdvcmsg4oaSPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBwdXJnZUxMTSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCB0aGUgQUkgYnJhaW4/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvbGxtL3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gc3dpdGNoTW9kZWwoKXsKICBjb25zdCBtPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3dNb2RlbCcpfHx7fSkudmFsdWU7CiAgaWYoIW18fCFtLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIGEgbW9kZWwgbmFtZScpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9tb2RlbCcse21vZGVsOm0udHJpbSgpfSk7IHJlbmRlcigpOwogICAgZmxhc2goJ1N3aXRjaGVkIHRvICcrbS50cmltKCkrJyDigJQgbm93IHByZXNzIFRFU1QgSVQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHF1aWNrTW9kZWwobSl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL21vZGVsJyx7bW9kZWw6bX0pOyByZW5kZXIoKTsgZmxhc2goJ1N3aXRjaGVkIHRvICcrbSk7CiAgICBzZXRUaW1lb3V0KHRlc3RMTE0sIDQwMCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBhZGRCYWNrdXAoKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vYmFja3VwL2FkZCcse3Byb3ZpZGVyOmJrUHJvdi52YWx1ZSxrZXk6YmtLZXkudmFsdWUsbW9kZWw6YmtNb2RlbC52YWx1ZSxob3N0Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmtIb3N0Jyl8fHt9KS52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdCYWNrdXAgYWRkZWQg4oCUIHF1b3RhIGxpbWl0cyB3aWxsIG5vIGxvbmdlciBzdG9wIHlvdScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcm1CYWNrdXAoaSl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vYmFja3VwL3JlbW92ZScse2luZGV4Oml9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBjbGVhckNvb2woKXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9jb29sZG93bi9jbGVhcicse30pOyByZW5kZXIoKTsgZmxhc2goJ0Nvb2xkb3duIGNsZWFyZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGZldGNoTW9kZWxzKCl7CiAgZmxhc2goJ0Fza2luZyBwcm92aWRlciB3aGF0IGl0IHNlcnZlcyB0b2RheeKApicpOwogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS9tb2RlbHMnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlfSk7CiAgICBpZighci5tb2RlbHMubGVuZ3RoKSByZXR1cm4gZmxhc2goJ1Byb3ZpZGVyIHJldHVybmVkIG5vIGNoYXQgbW9kZWxzJyk7CiAgICBtb2RhbChgPGgzPkxpdmUgbW9kZWxzIG9uICR7ZXNjKGxwUHJvdi52YWx1ZSl9PC9oMz4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtyLm1vZGVscy5sZW5ndGh9IGF2YWlsYWJsZSByaWdodCBub3cuIENsaWNrIG9uZSB0byB1c2UgaXQuPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0iZGlyTGlzdCIgc3R5bGU9Im1heC1oZWlnaHQ6MzQwcHgiPiR7ci5tb2RlbHMubWFwKG09PgogICAgICAgYDxidXR0b24gb25jbGljaz0icGlja01vZGVsKCcke2VzYyhtKX0nKSI+JHtlc2MobSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHBpY2tNb2RlbChtKXsgY2xvc2VNb2RhbCgpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdscE1vZGVsJyk7IGlmKGVsKSBlbC52YWx1ZT1tOwogIGZsYXNoKCdNb2RlbCBzZXQgdG8gJyttKycg4oCUIHByZXNzIENPTk5FQ1QgQlJBSU4gdGhlbiBURVNUIElUJyk7IH0KCi8qIC0tLS0tLS0tLS0gQUdFTlQgV09SSyAtLS0tLS0tLS0tICovCmNvbnN0IFFVSUNLPVsKIFsnRXhlY3V0aXZlIGJyaWVmJywnU3VtbWFyaXNlIG15IHN5c3RlbSBzdGF0ZSBhbmQgdGVsbCBtZSB0aGUgc2luZ2xlIG1vc3QgdXJnZW50IHRoaW5nIHRvIGZpeC4gQmUgYmx1bnQuJ10sCiBbJ01ha2UgbW9uZXknLCdPbmx5IHByb3Bvc2Ugb2ZmZXJzIGRlbGl2ZXJlZCB1c2luZyBNWSB1cHRpbWUgbW9uaXRvcmluZyBzeXN0ZW0gKDI0LzcgSFRUUCBwcm9iaW5nLCBUTFMgZXhwaXJ5IGFsZXJ0cywgaW5zdGFudCBvdXRhZ2UgZW1haWwsIGF2YWlsYWJpbGl0eSBhbmQgcDk1IHJlcG9ydGluZykuIFRSVVRIIFJVTEU6IEkgaGF2ZSBuZXZlciBtb25pdG9yZWQgYW55IGNsaWVudCBzaXRlIGFuZCBoYXZlIG5vIHRyYWNrIHJlY29yZC4gVGhlIG91dHJlYWNoIG1lc3NhZ2UgbXVzdCBjb250YWluIFpFUk8gY2xhaW1zIEkgY2Fubm90IHByb3ZlIOKAlCBubyAiSSBub3RpY2VkIG91dGFnZXMgb24gbG9jYWwgc2l0ZXMiLCBubyBpbnZlbnRlZCByZXZlbnVlIGZpZ3VyZXMsIG5vIHVudmVyaWZpZWQgc3RhdGlzdGljcy4gTGVhZCB3aXRoIGEgZnJlZSB0cmlhbCwgbm90IGEgZmFrZSBvYnNlcnZhdGlvbi4gVmVyaWZ5IGFueSBhcml0aG1ldGljIHlvdSBzdGF0ZS4gR2l2ZSAzIG9mZmVyczogdGhlIG9mZmVyIGluIG9uZSBzZW50ZW5jZSwgdGhlIEx1ZGhpYW5hIGJ1c2luZXNzIHR5cGUgYW5kIGl0cyByZWFsIHBhaW4sIG1vbnRobHkgSU5SIHByaWNlIHdpdGggc291bmQgcmVhc29uaW5nLCB0aGUgbGl0ZXJhbCBmaXJzdCBXaGF0c0FwcCBtZXNzYWdlIHVuZGVyIDUwIHdvcmRzLCBhbmQgdGhlIGJpZ2dlc3Qgb2JqZWN0aW9uIHdpdGggYW4gaG9uZXN0IGNvdW50ZXIuIENvbGQgb3V0cmVhY2ggY2xvc2VzIDEtMyUuJ10sCiBbJ0ZpbmQgcHJvc3BlY3RzJywnTGlzdCAxMCBzcGVjaWZpYyBidXNpbmVzcyB0eXBlcyBpbiBMdWRoaWFuYSB0aGF0IGxvc2UgcmVhbCBtb25leSB3aGVuIHRoZWlyIHdlYnNpdGUgZ29lcyBkb3duLCByYW5rZWQgYnkgaG93IG11Y2ggdGhleSBsb3NlIHBlciBob3VyLiBGb3IgZWFjaCwgc2F5IHdoZXJlIEkgY2FuIGZpbmQgdGhlaXIgY29udGFjdCBkZXRhaWxzIGZvciBmcmVlLiddLAogWydDbGllbnQgcGl0Y2gnLCdXcml0ZSBhIFdoYXRzQXBwIG1lc3NhZ2Ugb2ZmZXJpbmcgZnJlZSAxNC1kYXkgd2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZyB0byBhIGxvY2FsIGJ1c2luZXNzIG93bmVyLiBQbGFpbiBJbmRpYW4gRW5nbGlzaCwgbm8gbWFya2V0aW5nIGxhbmd1YWdlLCBubyBlbW9qaS4gVW5kZXIgNDUgd29yZHMuIFRoZSBnb2FsIGlzIGEgcmVwbHksIG5vdCBhIHNhbGUuJ10sCiBbJ0hhbmRsZSBvYmplY3Rpb25zJywnQSBMdWRoaWFuYSBidXNpbmVzcyBvd25lciBzYXlzICJteSB3ZWJzaXRlIG5ldmVyIGdvZXMgZG93biwgSSBkb24gbm90IG5lZWQgdGhpcyIuIEdpdmUgbWUgdGhyZWUgaG9uZXN0IHJlcGxpZXMgdGhhdCBkbyBub3QgZXhhZ2dlcmF0ZSBvciB1c2UgZmVhciB0YWN0aWNzLiddLAogWydJbnZvaWNlIHRlbXBsYXRlJywnV3JpdGUgYSBzaW1wbGUgbW9udGhseSBpbnZvaWNlIGZvciB3ZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nLCByZWFkeSB0byBmaWxsIGluLCBzdWl0YWJsZSBmb3IgYSBzbWFsbCBJbmRpYW4gYnVzaW5lc3MuIEluY2x1ZGUgR1NUIHBsYWNlaG9sZGVyIGFuZCBVUEkgcGF5bWVudCBsaW5lLiddCl07ClJFTkRFUi53b3JrPSgpPT57CiAgY29uc3QgTz1TLm91dHB1dHN8fFtdOwogIHJldHVybiBgJHshUy5sbG0/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIEJSQUlOIENPTk5FQ1RFRDwvaDM+CiAgIDxkaXY+QWdlbnRzIGNhbm5vdCB0aGluayB5ZXQuIDxiIG9uY2xpY2s9ImdvKCdicmFpbicpIiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpO2N1cnNvcjpwb2ludGVyO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmUiPkNvbm5lY3QgYSBmcmVlIG1vZGVsPC9iPiBmaXJzdCDigJQgdGFrZXMgYWJvdXQgMiBtaW51dGVzIGFuZCBuZWVkcyBubyBjcmVkaXQgY2FyZC48L2Rpdj48L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HaXZlIHRoZSBDaGFpcm1hbiBXb3JrIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UExBSU4gRU5HTElTSDwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+VHlwZSBhbnkgaW5zdHJ1Y3Rpb24uIEEgcmVhbCBtb2RlbCBleGVjdXRlcyBpdCBhbmQgdGhlIHJlc3VsdCBpcyBzYXZlZCBiZWxvdy48L2Rpdj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbnN0cnVjdGlvbjwvc3Bhbj48dGV4dGFyZWEgaWQ9IndrUHJvbXB0IiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjkwcHgiCiAgICAgcGxhY2Vob2xkZXI9ImUuZy4gV3JpdGUgYSBvbmUtcGFnZSBwcm9wb3NhbCBvZmZlcmluZyB1cHRpbWUgbW9uaXRvcmluZyB0byBhIEx1ZGhpYW5hIGNsb3RoaW5nIHNob3AsIHByaWNlZCBpbiBJTlIuIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvV29yaygpIj5FWEVDVVRFPC9idXR0b24+CiAgICAke08ubGVuZ3RoPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyV29yaygpIj5DbGVhciByZXN1bHRzPC9idXR0b24+JzonJ308L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5RdWljayB0YXNrczo8L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyI+JHtRVUlDSy5tYXAoKHEsaSk9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InF1aWNrKCR7aX0pIj4ke2VzYyhxWzBdKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj48L2Rpdj48L2Rpdj4KICAke08ubGVuZ3RoP08ubWFwKChvLGkpPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtcHVyIj4ke2VzYyhvLnRhZyl9PC9zcGFuPjxiPiR7ZXNjKG8uYWdlbnQpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7by50fSDCtyAke28ubXN9bXMgwrcgJHtvLnRva2Vuc30gdG9rZW5zPC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhvLnRleHQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlPdXQoJHtpfSkiPkNvcHk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB3b3JrIHByb2R1Y2VkIHlldC48L2Rpdj48L2Rpdj4nfWB9Owphc3luYyBmdW5jdGlvbiBkb1dvcmsoKXsKICBjb25zdCBwPXdrUHJvbXB0LnZhbHVlLnRyaW0oKTsgaWYoIXApIHJldHVybiBmbGFzaCgnVHlwZSBhbiBpbnN0cnVjdGlvbiBmaXJzdCcpOwogIGZsYXNoKCdXb3JraW5n4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Fzaycse3Byb21wdDpwfSk7IHJlbmRlcigpOyBmbGFzaCgnRG9uZScpOyB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHF1aWNrKGkpeyB3a1Byb21wdC52YWx1ZT1RVUlDS1tpXVsxXTsgZG9Xb3JrKCkgfQpmdW5jdGlvbiBjb3B5T3V0KGkpeyBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoKFMub3V0cHV0c3x8W10pW2ldLnRleHQpOyBmbGFzaCgnQ29waWVkJykgfQphc3luYyBmdW5jdGlvbiBjbGVhcldvcmsoKXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIExJVkUgT1BFUkFUSU9OUyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIGFnbyhpc28peyBpZighaXNvKSByZXR1cm4gJ25ldmVyJzsKICBjb25zdCBzPU1hdGguZmxvb3IoKERhdGUubm93KCktbmV3IERhdGUoaXNvLnJlcGxhY2UoJyAnLCdUJykrJ1onKS5nZXRUaW1lKCkpLzEwMDApOwogIGlmKHM8NjApIHJldHVybiBzKydzIGFnbyc7IGlmKHM8MzYwMCkgcmV0dXJuIE1hdGguZmxvb3Iocy82MCkrJ20gYWdvJzsgcmV0dXJuIE1hdGguZmxvb3Iocy8zNjAwKSsnaCBhZ28nOyB9CmZ1bmN0aW9uIGV2ZXJ5KG4peyByZXR1cm4gbjw2MD9uKydzJzpuPDM2MDA/TWF0aC5yb3VuZChuLzYwKSsnbSc6TWF0aC5yb3VuZChuLzM2MDApKydoJzsgfQpMSVZFLm9wcz0oKT0+ewogIGNvbnN0IFQ9Uy50YXNrc3x8W10sIFI9Uy5ydW5zfHxbXTsKICBjb25zdCBvbj1ULmZpbHRlcih0PT50LmVuYWJsZWQpLmxlbmd0aDsKICBjb25zdCB0b3RhbFJ1bnM9VC5yZWR1Y2UoKGEsdCk9PmErKHQucnVuc3x8MCksMCk7CiAgY29uc3QgZmFpbHM9VC5yZWR1Y2UoKGEsdCk9PmErKHQuZmFpbHN8fDApLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKFMucnVubmluZz8nUlVOTklORyc6J0hBTFRFRCcsJ1N5c3RlbSBTdGF0ZScsUy5ydW5uaW5nPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKScsUy5ydW5uaW5nPyd3b3JrIGV4ZWN1dGluZyc6J25vdGhpbmcgcnVubmluZycpfQogICAke2twaShvbisnIC8gJytULmxlbmd0aCwnU3RhbmRpbmcgT3JkZXJzIExpdmUnLCd2YXIoLS1jeSknLCdvbiBzY2hlZHVsZScpfQogICAke2twaShmbXQodG90YWxSdW5zKSwnSm9icyBFeGVjdXRlZCcsJ3ZhcigtLWdybiknLFMudGlja3MrJyBzY2hlZHVsZXIgdGlja3MnKX0KICAgJHtrcGkoZmFpbHMsJ0ZhaWx1cmVzJyxmYWlscz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdzaW5jZSBpbnN0YWxsJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlN0YW5kaW5nIE9yZGVycyA8c3BhbiBjbGFzcz0idGFnICR7Uy5ydW5uaW5nPyd0LWdybic6J3QtcmVkJ30iPiR7Uy5ydW5uaW5nPydFWEVDVVRJTkcnOidGUk9aRU4nfTwvc3Bhbj48L2gzPgogICAke1QubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPkNhcGFiaWxpdHk8L3RoPjx0aD5Pd25lciBBZ2VudDwvdGg+PHRoPkV2ZXJ5PC90aD48dGg+TGFzdCBSdW48L3RoPjx0aD5SZXN1bHQ8L3RoPjx0aD5SdW5zPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke1QubWFwKHQ9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHQuY2FwKX08L2I+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKChTLmNhcHN8fFtdKS5maW5kKGM9PmMuY2FwPT09dC5jYXApPy5kZXNjfHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHQub3duZXIpfTwvdGQ+CiAgICA8dGQ+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9IndpZHRoOjc0cHg7cGFkZGluZzo0cHggN3B4IiB0eXBlPSJudW1iZXIiIHZhbHVlPSIke3QuZXZlcnl9IgogICAgICAgIG9uY2hhbmdlPSJzZXRFdmVyeSgnJHt0LmlkfScsdGhpcy52YWx1ZSkiIHRpdGxlPSJzZWNvbmRzIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtldmVyeSh0LmV2ZXJ5KX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthZ28odC5sYXN0QXQpfTwvdGQ+CiAgICA8dGQ+JHt0Lmxhc3RNc2c/YDxzcGFuIGNsYXNzPSJ0YWcgJHt0Lmxhc3RPaz8ndC1ncm4nOid0LXJlZCd9Ij4ke3QubGFzdE9rPydPSyc6J0ZBSUwnfTwvc3Bhbj4gJHtlc2ModC5sYXN0TXNnKX1gOic8c3BhbiBjbGFzcz0ibW9uby1kaW0iPm5vdCB5ZXQgcnVuPC9zcGFuPid9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7dC5ydW5zfHwwfSR7dC5mYWlscz8nIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4vJyt0LmZhaWxzKyfinJc8L3NwYW4+JzonJ308L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBvbmNsaWNrPSJydW5Ob3coJyR7dC5pZH0nKSI+UnVuPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2dnbGVUYXNrKCcke3QuaWR9JywkeyF0LmVuYWJsZWR9KSI+JHt0LmVuYWJsZWQ/J1BhdXNlJzonU3RhcnQnfTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdGFuZGluZyBvcmRlcnMuIFBvd2VyIHRoZSBzeXN0ZW0gb24gdG8gaW5zdGFsbCB0aGVtLjwvZGl2Pid9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV4ZWN1dGlvbiBGZWVkIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Ui5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7Ui5sZW5ndGg/YDxkaXYgY2xhc3M9ImxvZyI+JHtSLm1hcChyPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7ci50fTwvc3Bhbj4KICAgICA8c3BhbiBzdHlsZT0iY29sb3I6JHtyLm9rPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKSd9Ij5bJHtyLm9rPydET05FJzonRkFJTCd9XTwvc3Bhbj4KICAgICA8Yj4ke2VzYyhyLm93bmVyKX08L2I+IMK3ICR7ZXNjKHIuY2FwKX0g4oCUICR7ZXNjKHIubXNnKX0ke3IuZGV0YWlsP2BcbiAgICAgICAg4oazICR7ZXNjKHIuZGV0YWlsKX1gOicnfQogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KCR7ci5tc31tcyR7ci5tYW51YWw/JyDCtyBtYW51YWwnOicnfSk8L3NwYW4+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+YAogICA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIGV4ZWN1dGVkIHlldC4gUG93ZXIgb24gYW5kIHRoZSBmaXJzdCBzd2VlcCBydW5zIHdpdGhpbiAxMCBzZWNvbmRzLjwvZGl2Pid9PC9kaXY+YH07ClJFTkRFUi5vcHM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLmh1c3RsZT8nI2E4NTVmNyc6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtTLmh1c3RsZT8nIzFhMGYyZSc6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjoke1MuaHVzdGxlPyd2YXIoLS1wdXIpJzondmFyKC0tYW1iKSd9Ij7imqEgSFVTVExFIE1PREUg4oCUICR7Uy5odXN0bGU/J0VOR0FHRUQnOidPRkYnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke1MuaHVzdGxlCiAgID9gPGI+TWF4aW11bSBvdXRwdXQuPC9iPiAkeyhTLnRhc2tzfHxbXSkubGVuZ3RofSBtb25leS1mb2N1c2VkIG9yZGVycyBydW5uaW5nIG9uIDxiPiR7Uy5sYW5lc3x8M30gcGFyYWxsZWwgbGFuZXM8L2I+IOKAlCBpZGVhcywgcmVzZWFyY2gsIG1pc3Npb25zLCByZXZlbnVlIHJvdXRlcywgZGVlcCBpbnZlc3RpZ2F0aW9uLiBBbGwgZmlyaW5nIGF0IG9uY2UsIG5vdCBvbmUgYWZ0ZXIgYW5vdGhlci5gCiAgIDonU3dpdGNoZXMgdGhlIHJvc3RlciB0byBtb25leS1nZW5lcmF0aW5nIHdvcmsgb25seSwgdGlnaHRlbnMgZXZlcnkgaW50ZXJ2YWwsIGFuZCBydW5zIHRhc2tzIDxiPmluIHBhcmFsbGVsPC9iPiBpbnN0ZWFkIG9mIHNlcXVlbnRpYWxseS4gRXhwZWN0IHJvdWdobHkgMTDigJMyMCBjb21wbGV0ZWQgam9icyBpbiB0aGUgZmlyc3QgaG91ci4nfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+UGFyYWxsZWwgbGFuZXMgZm9yIEFJIHRhc2tzOjwvc3Bhbj4KICAgPHNlbGVjdCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6OTBweCIgaWQ9ImxhbmVTZWwiIG9uY2hhbmdlPSJzZXRMYW5lcyh0aGlzLnZhbHVlKSI+CiAgICAke1sxLDIsMyw0LDUsNl0ubWFwKG49PmA8b3B0aW9uIHZhbHVlPSIke259IiAkeyhTLmxhbmVzfHwzKT09bj8nc2VsZWN0ZWQnOicnfT4ke259PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+SGlnaGVyID0gZmFzdGVyLCBidXQgZnJlZSBBSSB0aWVycyByYXRlLWxpbWl0IGFyb3VuZCAzMCByZXF1ZXN0cy9taW4uPC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5odXN0bGU/J25vJzoncCd9IiBvbmNsaWNrPSJ0b2dnbGVIdXN0bGUoKSI+JHtTLmh1c3RsZT8nU1RBTkQgRE9XTic6J0VOR0FHRSBIVVNUTEUgTU9ERSd9PC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+JHtTLmh1c3RsZQogICA/J1N0YW5kaW5nIGRvd24gcmVzdG9yZXMgdGhlIG5vcm1hbCBtb25pdG9yaW5nIHJvc3Rlci4nCiAgIDonVGhpcyByZXBsYWNlcyB5b3VyIGN1cnJlbnQgdGFzayBsaXN0LiBNb25pdG9yaW5nIGNvbnRpbnVlcywgYnV0IHRoZSBlbXBoYXNpcyBzaGlmdHMgaGFyZCB0byByZXZlbnVlLid9PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxNTVlNmIiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj7igrkgU1BFTkRJTkcgQ0VJTElORyDigJQgJHtTLmJ1ZGdldD8oJ+KCuScrZm10KFMuYnVkZ2V0KSk6J05PVCBTRVQnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkhlIGNhbiA8Yj5yZXF1ZXN0PC9iPiBtb25leSBmb3IgYSB2ZW50dXJlIOKAlCBhIGRvbWFpbiwgYSBsaXN0aW5nIGZlZSwgYSBzbWFsbCBhZCB0ZXN0LiBIZSBjYW4gbmV2ZXIgdGFrZSBpdC4gRXZlcnkgcmVxdWVzdCBiZWNvbWVzIGEgZnJvemVuIGdhdGUgbmVlZGluZyB5b3VyIHNpZ25hdHVyZSwgYW5kIGFueXRoaW5nIGFib3ZlIHRoaXMgY2VpbGluZyBpcyByZWZ1c2VkIG91dHJpZ2h0LjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoxNTBweCIgdHlwZT0ibnVtYmVyIiBpZD0iYnVkZ2V0QW10IiBwbGFjZWhvbGRlcj0iZS5nLiAyMDAwIiB2YWx1ZT0iJHtTLmJ1ZGdldHx8Jyd9Ij4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNldEJ1ZGdldCgpIj5TRVQgQ0VJTElORzwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkxpZmV0aW1lIGF1dGhvcml6ZWQgc3BlbmQgc28gZmFyOiA8Yj7igrkkeyhTLnNwZW5kfHwwKS50b0ZpeGVkKDIpfTwvYj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLnJ1bm5pbmc/JyMxYzVjM2MnOicjNmIyMjMzJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7Uy5ydW5uaW5nPycjMDgxNzBmJzonIzE2MGIwYyd9LCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOiR7Uy5ydW5uaW5nPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKSd9Ij7ilrYgTUFTVEVSIFBPV0VSIOKAlCAke1MucnVubmluZz8nU1lTVEVNIFJVTk5JTkcnOidTWVNURU0gSEFMVEVEJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+JHtTLnJ1bm5pbmcKICAgPydFdmVyeSBzdGFuZGluZyBvcmRlciBiZWxvdyBpcyBleGVjdXRpbmcgb24gaXRzIG93biBzY2hlZHVsZS4gVGhlIENoYWlybWFuIGlzIGRvaW5nIHJlYWwgd29yayByaWdodCBub3cg4oCUIHByb2JpbmcgeW91ciBzaXRlcywgYXVkaXRpbmcgdGhlIGxlZGdlciwgY29tcHV0aW5nIFNMQXMsIHdyaXRpbmcgYnJpZWZzIOKAlCB3aXRob3V0IHlvdSB0b3VjaGluZyBhbnl0aGluZy4nCiAgIDonPGI+Tm90aGluZyBpcyBydW5uaW5nLjwvYj4gU2lnbiBiZWxvdyB0byBicmluZyB0aGUgd2hvbGUgc3lzdGVtIG9ubGluZS4gT25jZSBydW5uaW5nIGl0IGRvZXMgbm90IHN0b3AgdW50aWwgeW91IGhhbHQgaXQuJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biAke1MucnVubmluZz8nbm8nOidwJ30iIG9uY2xpY2s9InBvd2VyKCkiPiR7Uy5ydW5uaW5nPydIQUxUIEVWRVJZVEhJTkcnOidTVEFSVCBFVkVSWVRISU5HJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJyZXNldFRhc2tzKCkiPlJlaW5zdGFsbCBzdGFuZGluZyBvcmRlcnM8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+U2NoZWR1bGVyIHRpY2tzIGV2ZXJ5IDEwcy4gT25seSB5b3UgY2FuIHN0YXJ0IG9yIHN0b3AgaXQg4oCUIG5vdGhpbmcgZWxzZSBjYW4uPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0ib3BzIj4ke0xJVkUub3BzKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcG93ZXIoKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Bvd2VyJyx7b246IVMucnVubmluZ30pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMucnVubmluZz8nU1lTVEVNIFJVTk5JTkcg4oCUIGFnZW50cyBleGVjdXRpbmcnOidTeXN0ZW0gaGFsdGVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBzZXRFdmVyeShpZCx2KXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvdGFzaycse2lkLGV2ZXJ5Oit2fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlVGFzayhpZCxvbil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Rhc2snLHtpZCxlbmFibGVkOm9ufSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gcnVuTm93KGlkKXsgZmxhc2goJ0V4ZWN1dGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcnVudGltZS9ydW5ub3cnLHtpZH0pOyByZW5kZXIoKTsgZmxhc2goci5tc2cpIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcmVzZXRUYXNrcygpeyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9yZXNldCcse30pOyByZW5kZXIoKTsgZmxhc2goJ1N0YW5kaW5nIG9yZGVycyByZWluc3RhbGxlZCcpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlSHVzdGxlKCl7CiAgZmxhc2goUy5odXN0bGU/J1N0YW5kaW5nIGRvd27igKYnOidFbmdhZ2luZyBodXN0bGUgbW9kZeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcnVudGltZS9odXN0bGUnLHtvbjohUy5odXN0bGUsbGFuZXM6Uy5sYW5lc3x8M30pOwogICAgcmVuZGVyKCk7IGZsYXNoKFMuaHVzdGxlP2BIVVNUTEUgRU5HQUdFRCDigJQgJHtyLnRhc2tzfSBvcmRlcnMgZmlyaW5nIGluIHBhcmFsbGVsYDonU3Rvb2QgZG93biB0byBub3JtYWwgcm9zdGVyJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBzZXRMYW5lcyhuKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvbGFuZXMnLHtsYW5lczorbn0pOyByZW5kZXIoKTsgZmxhc2goJ0xhbmVzOiAnK24pIH0KYXN5bmMgZnVuY3Rpb24gc2V0QnVkZ2V0KCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc3BlbmQvYnVkZ2V0Jyx7YnVkZ2V0OitidWRnZXRBbXQudmFsdWV8fDB9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnQ2VpbGluZyBzZXQg4oCUIGhlIGNhbiByZXF1ZXN0IHVwIHRvIHRoaXMsIG5ldmVyIHRha2UgaXQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiAtLS0tLS0tLS0tIFNFTEYtVVBHUkFERSAtLS0tLS0tLS0tICovCkxJVkUuZXZvbHZlPSgpPT57CiAgY29uc3QgUD0oUy5wcm9wb3NhbHN8fFtdKS5maWx0ZXIocD0+cC5zdGF0dXM9PT0nUEVORElORycpOwogIGNvbnN0IEU9Uy5ldm9sdXRpb258fFtdOwogIGNvbnN0IGFwcGxpZWQ9RS5maWx0ZXIoZT0+ZS5kZWNpc2lvbj09PSdBUFBMSUVEJykubGVuZ3RoOwogIGNvbnN0IHJlamVjdGVkPUUuZmlsdGVyKGU9PmUuZGVjaXNpb249PT0nUkVKRUNURUQnKS5sZW5ndGg7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUC5sZW5ndGgsJ1VwZ3JhZGVzIEF3YWl0aW5nIFlvdScsUC5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxQLmxlbmd0aD8nbmVlZHMgeW91ciBzaWduYXR1cmUnOidub3RoaW5nIHBlbmRpbmcnKX0KICAgJHtrcGkoYXBwbGllZCwnVXBncmFkZXMgQXBwbGllZCcsJ3ZhcigtLWdybiknLCdsaWZldGltZScpfQogICAke2twaShyZWplY3RlZCwnUmVqZWN0ZWQnLCd2YXIoLS1kaW0pJywnbmV2ZXIgcmUtcHJvcG9zZWQnKX0KICAgJHtrcGkoUy5zY2FuQ291bnR8fDAsJ1NlbGYtU2NhbnMgUnVuJywndmFyKC0tY3kpJywnZXZlcnkgNjAgc2Vjb25kcycpfTwvZGl2PgogICR7UC5sZW5ndGg/UC5tYXAocD0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtwLmtsYXNzPT09J1NBRkUnPycjMWM1YzNjJzonIzY3NDcwZid9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmtsYXNzPT09J1NBRkUnPyd0LWdybic6J3QtYW1iJ30iPiR7cC5rbGFzc308L3NwYW4+CiAgICAgIDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48L2Rpdj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7cC5pZH0gwrcgJHtwLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo3cHgiPiR7ZXNjKHAud2h5KX08L2Rpdj4KICAgICR7cC5ldmlkZW5jZT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+RXZpZGVuY2U6ICR7ZXNjKHAuZXZpZGVuY2UpfTwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZGVjaWRlVXAoJyR7cC5pZH0nLDEpIj5BVVRIT1JJWkUgVVBHUkFERTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVjaWRlVXAoJyR7cC5pZH0nLDApIj5SRUpFQ1QgUEVSTUFORU5UTFk8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImVyXyR7cC5pZH0iPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDpgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHVwZ3JhZGVzIHBlbmRpbmcuIFRoZSBDaGFpcm1hbiBzY2FucyBpdHNlbGYgZXZlcnkgNjAgc2Vjb25kcyBhbmQgd2lsbCByYWlzZSBhIHByb3Bvc2FsIGhlcmUgdGhlIG1vbWVudCBpdCBmaW5kcyBhIHJlYWwgd2Vha25lc3Mg4oCUIGEgZmxha3kgc2l0ZSwgYW4gZXhwaXJpbmcgY2VydGlmaWNhdGUsIGFuIHVuc3RhZmZlZCBmbG9vciwgYSBzZWN1cml0eSBnYXAuPC9kaXY+PC9kaXY+YH0KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXZvbHV0aW9uIEhpc3Rvcnk8L2gzPgogICAke0UubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5DaGFuZ2U8L3RoPjx0aD5EZWNpc2lvbjwvdGg+PHRoPlJlc3VsdDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtFLm1hcChlPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZS50fTwvdGQ+PHRkPiR7ZXNjKGUubGFiZWwpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLndoeXx8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2UuZGVjaXNpb249PT0nQVBQTElFRCc/J3QtZ3JuJzondC1yZWQnfSI+JHtlLmRlY2lzaW9ufTwvc3Bhbj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS5ob3d8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS5yZXN1bHR8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+VGhlIENoYWlybWFuIGhhcyBub3QgY2hhbmdlZCBpdHNlbGYgeWV0LjwvZGl2Pid9PC9kaXY+YH07CkxJVkUud3JpdHRlbj0oKT0+ewogIGNvbnN0IFc9KFMud3JpdHRlbkNhcHN8fFtdKTsKICBpZighVy5sZW5ndGgpIHJldHVybiAnPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPkhlIGhhcyBub3Qgd3JpdHRlbiBhbnkgbmV3IGFiaWxpdGllcyB5ZXQuPC9kaXY+PC9kaXY+JzsKICByZXR1cm4gVy5tYXAoYz0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHsKICAgICAgYy52aW9sYXRpb25zLmxlbmd0aD8ndmFyKC0tbWFnKSc6Yy5zdGF0dXM9PT0nSU5TVEFMTEVEJz8ndmFyKC0tZ3JuKSc6J3ZhcigtLWFtYiknfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij4KICAgICAgPHNwYW4gY2xhc3M9InRhZyAke2MudmlvbGF0aW9ucy5sZW5ndGg/J3QtcmVkJzpjLnN0YXR1cz09PSdJTlNUQUxMRUQnPyd0LWdybic6J3QtYW1iJ30iPiR7CiAgICAgICAgYy52aW9sYXRpb25zLmxlbmd0aD8nU0FOREJPWCBCTE9DS0VEJzpjLnN0YXR1c308L3NwYW4+CiAgICAgIDxiIHN0eWxlPSJmb250LXNpemU6MTRweCI+JHtlc2MoYy5uYW1lKX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2MudH0gwrcgJHtjLmJ5dGVzfSBieXRlczwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OHB4Ij4ke2VzYyhjLmRlc2MpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMTBweCI+V2h5IGhlIHdyb3RlIGl0PC90ZD48dGQ+JHtlc2MoYy53aHkpfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UmlzayBoZSBzZWVzPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKGMucmlzayl9PC90ZD48L3RyPgogICAgICR7Yy52aW9sYXRpb25zLmxlbmd0aD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJsb2NrZWQgYmVjYXVzZTwvdGQ+CiAgICAgICA8dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7Yy52aW9sYXRpb25zLm1hcChlc2MpLmpvaW4oJzxicj4nKX08L3RkPjwvdHI+YDonJ30KICAgICAke2MudGVzdFJ1bj9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRyeSBydW4gb3V0cHV0PC90ZD4KICAgICAgIDx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+JHtlc2MoYy50ZXN0UnVuLm1zZyl9JHtjLnRlc3RSdW4uZGV0YWlsPyc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Jytlc2MoYy50ZXN0UnVuLmRldGFpbCkrJzwvZGl2Pic6Jyd9PC90ZD48L3RyPmA6Jyd9CiAgICAgJHtjLnRlc3RFcnJvcj9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRyeSBydW4gZmFpbGVkPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGMudGVzdEVycm9yKX08L3RkPjwvdHI+YDonJ30KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxkZXRhaWxzIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxzdW1tYXJ5IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj4KICAgICAgUkVBRCBUSEUgQUNUVUFMIENPREUgYmVmb3JlIHlvdSBzaWduIGl0ICgke2MuYnl0ZXN9IGJ5dGVzKTwvc3VtbWFyeT4KICAgICA8cHJlIGNsYXNzPSJ5YW1sIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPiR7ZXNjKGMuY29kZSl9PC9wcmU+PC9kZXRhaWxzPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij4KICAgICAke2Muc3RhdHVzPT09J1BFTkRJTkcnP2A8c3BhbiBjbGFzcz0ibW9uby1kaW0iPlNpZ24gaXQgb24gdGhlIHByb3Bvc2FsIGFib3ZlIHRvIGluc3RhbGwuPC9zcGFuPmA6Jyd9CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkaXNjYXJkQ2FwKCcke2MuaWR9JykiPkRpc2NhcmQ8L2J1dHRvbj48L2Rpdj4KICAgPC9kaXY+YCkuam9pbignJyk7Cn07ClJFTkRFUi53cml0dGVuPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLXB1cikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4pyOIFNFTEYtRVhURU5TSU9OIOKAlCBIRSBXUklURVMgSElTIE9XTiBORVcgQUJJTElUSUVTPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPk5vdCBzZXR0aW5ncyB0dW5pbmcuIEhlIHdyaXRlcyA8Yj5yZWFsIEphdmFTY3JpcHQ8L2I+IGZvciBhIGNhcGFiaWxpdHkgaGUgZG9lcyBub3QgeWV0IGhhdmUsIGl0IHJ1bnMgaW4gYSBsb2NrZWQgc2FuZGJveCwgYW5kIHlvdSByZWFkIHRoZSBhY3R1YWwgc291cmNlIGJlZm9yZSBzaWduaW5nLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+U2FuZGJveCBibG9ja3M8L2I+IHJlcXVpcmUsIHByb2Nlc3MsIGZzLCBjaGlsZF9wcm9jZXNzLCBldmFsLCBGdW5jdGlvbiwgcHJvdG90eXBlIGFjY2VzcyBhbmQgaW5maW5pdGUgbG9vcHMg4oCUIGNoZWNrZWQgPGVtPmJlZm9yZTwvZW0+IHlvdSBhcmUgc2hvd24gaXQuPC9saT4KICAgPGxpPkdlbmVyYXRlZCBjb2RlIHNlZXMgb25seSBhIHRpbnkgcmVhZC1vbmx5IEFQSSBvZiB5b3VyIG93biBzdGF0ZSwgcGx1cyBvbmUgd3JpdGU6IGEgbm90ZSBpbiB0aGUgbGVkZ2VyLjwvbGk+CiAgIDxsaT5FdmVyeSBuZXcgYWJpbGl0eSBpcyA8Yj5kcnktcnVuIGFnYWluc3QgcmVhbCBkYXRhIGZpcnN0PC9iPiwgc28geW91IHNlZSBnZW51aW5lIG91dHB1dCwgbm90IGEgcHJvbWlzZS48L2xpPgogICA8bGk+Tm90aGluZyBpbnN0YWxscyB3aXRob3V0IHlvdXIgcGFzc3dvcmQgc2lnbmF0dXJlIG9uIHRoZSBTZWxmLVVwZ3JhZGUgcGFnZS48L2xpPgogIDwvdWw+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxzcGFuPldoYXQgbmV3IGFiaWxpdHkgc2hvdWxkIGhlIGJ1aWxkPzwvc3Bhbj4KICAgPGlucHV0IGlkPSJzZUdvYWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gZmluZCB3aGljaCBtb25pdG9yZWQgc2l0ZSBkZWdyYWRlZCBtb3N0IHRoaXMgd2VlayI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJ3cml0ZUNhcCgpIj5IRSBXUklURVMgSVQ8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5MZWF2ZSBibGFuayBhbmQgaGUgcGlja3MgYSBnYXAgaGUgY2FuIHNlZSBpbiBoaXMgb3duIHN0YXRlLjwvc3Bhbj48L2Rpdj4KIDwvZGl2PgogPGRpdiBkYXRhLWxpdmU9IndyaXR0ZW4iPiR7TElWRS53cml0dGVuKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gd3JpdGVDYXAoKXsKICBjb25zdCBnPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VHb2FsJyl8fHt9KS52YWx1ZXx8Jyc7CiAgZmxhc2goJ0hlIGlzIHdyaXRpbmcgY29kZeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2VsZmV4dGVuZC93cml0ZScse2dvYWw6Z3x8J3BpY2sgYSBnZW51aW5lIGdhcCBpbiB5b3VyIG93biBhYmlsaXRpZXMnfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5ibG9ja2VkPygnV3JvdGUgJytyLm5hbWUrJyDigJQgU0FOREJPWCBCTE9DS0VEIElUJyk6KCdXcm90ZSAnK3IubmFtZSsnIOKAlCByZWFkIHRoZSBjb2RlLCB0aGVuIHNpZ24gaXQnKSk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkaXNjYXJkQ2FwKGlkKXsgYXdhaXQgQVBJKCcvYXBpL3NlbGZleHRlbmQvZGlzY2FyZCcse2lkfSk7IHJlbmRlcigpIH0KClJFTkRFUi5ldm9sdmU9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7in7MgQ09OVElOVU9VUyBTRUxGLVVQR1JBREU8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+VGhlIENoYWlybWFuIGF1ZGl0cyBpdHMgb3duIHN0YXRlIGV2ZXJ5IDYwIHNlY29uZHMgYWdhaW5zdCByZWFsIHRlbGVtZXRyeSDigJQgdXB0aW1lIHJlY29yZHMsIFRMUyBleHBpcnksIGF1dGggZmFpbHVyZXMsIGxlZGdlciBzaXplLCBmbG9vciBzdGFmZmluZywgbWFpbCByZWFkaW5lc3MuIFdoZW4gaXQgZmluZHMgYSBnZW51aW5lIHdlYWtuZXNzIGl0IHByb3Bvc2VzIGEgZml4IGhlcmUgYW5kIDxiPmZyZWV6ZXMgdW50aWwgeW91IHNpZ24gaXQ8L2I+LjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+Tm90aGluZyBzZWxmLWluc3RhbGxzIGJ5IGRlZmF1bHQuPC9iPiBFdmVyeSB1cGdyYWRlIG5lZWRzIHlvdXIgcGFzc3dvcmQsIHNhbWUgYXMgYSBwZXJtaXNzaW9uIGdhdGUuPC9saT4KICAgPGxpPjxiPlNBRkU8L2I+ID0gcmV2ZXJzaWJsZSB0dW5pbmcgKHByb2JlIGludGVydmFscywgbGVkZ2VyIGNvbXBhY3Rpb24sIHNraWxscykuIDxiPlJFVklFVzwvYj4gPSBjaGFuZ2VzIHlvdXIgcm9zdGVyIG9yIHJhaXNlcyBhIHNlY3VyaXR5IGdhdGUuPC9saT4KICAgPGxpPlJlamVjdCBvbmNlIGFuZCBpdCBpcyA8Yj5zdXBwcmVzc2VkIHBlcm1hbmVudGx5PC9iPiDigJQgdGhlIENoYWlybWFuIHdpbGwgbm90IG5hZyB5b3UgYWJvdXQgaXQgYWdhaW4uPC9saT4KICAgPGxpPkl0IHByb3Bvc2VzIG9ubHkgb24gZXZpZGVuY2UgZnJvbSB5b3VyIGFjdHVhbCBydW5uaW5nIHN5c3RlbS4gSXQgZG9lcyBub3QgaW52ZW50IHdvcmsuPC9saT4KICA8L3VsPgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzY2FuTm93KCkiPlJVTiBTRUxGLVNDQU4gTk9XPC9idXR0b24+CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLmF1dG9waWxvdD8ndC1yZWQnOid0LWRpbSd9Ij5BVVRPUElMT1QgJHtTLmF1dG9waWxvdD8nT04nOidPRkYnfTwvc3Bhbj4KICA8L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLmF1dG9waWxvdD8nIzZiMjIzMyc6J3ZhcigtLWxpbmUpJ30iPgogIDxoMz5BdXRvcGlsb3QgJHtTLmF1dG9waWxvdD8nPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+QUNUSVZFPC9zcGFuPic6Jyd9PC9oMz4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+V2l0aCBhdXRvcGlsb3Qgb24sIDxiPlNBRkUtY2xhc3M8L2I+IHVwZ3JhZGVzIGFwcGx5IHRoZW1zZWx2ZXMgdGhlIG1vbWVudCB0aGV5IGFyZSBmb3VuZCDigJQgbm8gc2lnbmF0dXJlLiBSRVZJRVctY2xhc3MgYWx3YXlzIHdhaXRzIGZvciB5b3UgcmVnYXJkbGVzcy4gRXZlcnkgYXV0b25vbW91cyBjaGFuZ2UgaXMgc3RpbGwgd3JpdHRlbiB0byB0aGUgZXZvbHV0aW9uIGhpc3RvcnkuIFRoaXMgaXMgcmVhbCBhdXRvbm9teTogdHVybiBpdCBvbiBvbmx5IGlmIHlvdSBhY2NlcHQgdGhlIENoYWlybWFuIGNoYW5naW5nIGl0cyBvd24gdHVuaW5nIHdoaWxlIHlvdSBzbGVlcC48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biAke1MuYXV0b3BpbG90Pydubyc6J3AnfSIgb25jbGljaz0idG9nZ2xlQXV0bygpIj4ke1MuYXV0b3BpbG90PydESVNBQkxFIEFVVE9QSUxPVCc6J0VOQUJMRSBBVVRPUElMT1QnfTwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImV2b2x2ZSI+JHtMSVZFLmV2b2x2ZSgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRlY2lkZVVwKGlkLG9rKXsKICBjb25zdCBlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcl8nK2lkKTsgZS50ZXh0Q29udGVudD0nJzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvZGVjaWRlJyx7aWQsb2s6ISFva30pOwogICAgcmVuZGVyKCk7IGZsYXNoKG9rPygnVVBHUkFERUQgwrcgJysoci5yZXN1bHR8fCcnKSk6J1JlamVjdGVkIHBlcm1hbmVudGx5Jyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2Nhbk5vdygpeyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL3NjYW4nLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5wZW5kaW5nP3IucGVuZGluZysnIHVwZ3JhZGUocykgYXdhaXRpbmcgeW91ciBzaWduYXR1cmUnOidTY2FuIGNsZWFuIOKAlCBub3RoaW5nIHRvIGltcHJvdmUnKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUF1dG8oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2F1dG9waWxvdCcse29uOiFTLmF1dG9waWxvdH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMuYXV0b3BpbG90PydBVVRPUElMT1QgT04g4oCUIHNhZmUgdXBncmFkZXMgbm93IHNlbGYtYXBwbHknOidBdXRvcGlsb3Qgb2ZmJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQoKLyogLS0tLS0tLS0tLSBMRUFSTkVEIFNLSUxMUyAtLS0tLS0tLS0tICovClJFTkRFUi5za2lsbHMyPSgpPT57CiAgY29uc3QgSz1TLnNraWxsc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGVhY2ggdGhlIENoYWlybWFuIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UEVSU0lTVFMgRk9SRVZFUjwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+QW55dGhpbmcgeW91IHRlYWNoIGlzIHN0b3JlZCBzZXJ2ZXItc2lkZSBhbmQgc3Vydml2ZXMgcmVzdGFydHMsIHJlZGVwbG95cyBhbmQgZXZlcnkgZGV2aWNlIHlvdSBsb2cgaW4gZnJvbS4gVGVhY2ggaXQgeW91ciBzaG9ydGhhbmQsIHlvdXIgcnVuYm9va3MsIHlvdXIgc3RhbmRpbmcgb3JkZXJzLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VHJpZ2dlciBwaHJhc2U8L3NwYW4+PGlucHV0IGlkPSJza1BocmFzZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ibW9ybmluZyBjaGVjayI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBpdCBtZWFucyAvIGRvZXM8L3NwYW4+PGlucHV0IGlkPSJza0FjdGlvbiIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iU2NhbiBhbGwgbW9uaXRvcnMgYW5kIHJlcG9ydCBhbnl0aGluZyBiZWxvdyA5OSUiPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlR5cGU8L3NwYW4+PHNlbGVjdCBpZD0ic2tLaW5kIiBjbGFzcz0iaW4iPgogICAgIDxvcHRpb24gdmFsdWU9Im5vdGUiPlN0YW5kaW5nIG9yZGVyPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iYWxpYXMiPkNvbW1hbmQgc2hvcnRjdXQ8L29wdGlvbj4KICAgICA8b3B0aW9uIHZhbHVlPSJydW5ib29rIj5SdW5ib29rIHN0ZXA8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJwb2xpY3kiPlBvbGljeSBydWxlPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InRlYWNoKCkiPlRFQUNIIElUPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPktub3duIFNraWxscyA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0subGVuZ3RofTwvc3Bhbj48L2gzPgogICAke0subGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlBocmFzZTwvdGg+PHRoPk1lYW5pbmc8L3RoPjx0aD5UeXBlPC90aD48dGg+VXNlZDwvdGg+PHRoPkxlYXJuZWQ8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Sy5tYXAocz0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2Mocy5waHJhc2UpfTwvYj48L3RkPjx0ZD4ke2VzYyhzLmFjdGlvbil9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2VzYyhzLmtpbmQpfTwvc3Bhbj48L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7cy51c2VzfHwwfcOXPC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7cy5sZWFybmVkfTxkaXY+JHtlc2Mocy5vcmlnaW58fCdvd25lcicpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ1c2VTa2lsbCgnJHtlc2Mocy5waHJhc2UpfScpIj5SZWNhbGw8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImZvcmdldCgnJHtlc2Mocy5waHJhc2UpfScpIj5Gb3JnZXQ8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyB0YXVnaHQgeWV0LiBUcnkgcGhyYXNlICJtb3JuaW5nIGNoZWNrIiDihpIgIlNjYW4gYWxsIG1vbml0b3JzIGFuZCByZXBvcnQgYW55dGhpbmcgYmVsb3cgOTklIGF2YWlsYWJpbGl0eSIuPC9kaXY+J308L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gdGVhY2goKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9za2lsbC90ZWFjaCcse3BocmFzZTpza1BocmFzZS52YWx1ZSxhY3Rpb246c2tBY3Rpb24udmFsdWUsa2luZDpza0tpbmQudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnU2tpbGwgbGVhcm5lZCDigJQgaXQgcGVyc2lzdHMgYWNyb3NzIHJlc3RhcnRzJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBmb3JnZXQocCl7IGlmKCFjb25maXJtKCdGb3JnZXQgIicrcCsnIj8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9za2lsbC9mb3JnZXQnLHtwaHJhc2U6cH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHVzZVNraWxsKHApeyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9za2lsbC91c2UnLHtwaHJhc2U6cH0pOyByZW5kZXIoKTsKICBtb2RhbChgPGgzPiR7ZXNjKHApfTwvaDM+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIj48ZGl2PiR7ZXNjKHIuYWN0aW9uKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEzcHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApIH0KCi8qIC0tLS0tLS0tLS0gVVBUSU1FIE1BUlNIQUwgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiB1cEJhcihtKXsKICBjb25zdCBoPShtLmhpc3Rvcnl8fFtdKS5zbGljZSgtNDApOwogIGlmKCFoLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImZvbnQtc2l6ZToxMHB4Ij5ubyBjaGVja3MgeWV0PC9kaXY+JzsKICByZXR1cm4gJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6MnB4O2FsaWduLWl0ZW1zOmZsZXgtZW5kO2hlaWdodDoyNnB4Ij4nK2gubWFwKHg9PgogICBgPGRpdiB0aXRsZT0iJHt4LnR9IMK3IEhUVFAgJHt4LmNvZGV9IMK3ICR7eC5tc31tcyIgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6M3B4O2hlaWdodDoke3gub2s/TWF0aC5tYXgoMzAsTWF0aC5taW4oMTAwLDEwMC14Lm1zLzI1KSk6MTAwfSU7YmFja2dyb3VuZDoke3gub2s/JyMzMWQ2N2EnOicjZmYzYjZiJ307Ym9yZGVyLXJhZGl1czoxcHg7b3BhY2l0eTouOSI+PC9kaXY+YCkuam9pbignJykrJzwvZGl2Pic7Cn0KTElWRS51cHRpbWU9KCk9PnsKICBjb25zdCBNPVMubW9uaXRvcnN8fFtdLCBkb3duPU0uZmlsdGVyKG09Pm0uc3RhdGU9PT0nRE9XTicpLmxlbmd0aDsKICBjb25zdCB0b3Q9TS5yZWR1Y2UoKGEsbSk9PmErKG0uY2hlY2tzfHwwKSwwKSwgdXBzPU0ucmVkdWNlKChhLG0pPT5hKyhtLnVwfHwwKSwwKTsKICBjb25zdCBhdmFpbD10b3Q/KCh1cHMvdG90KSoxMDApLnRvRml4ZWQoMik6J+KAlCc7CiAgY29uc3QgYXZnPU0uZmlsdGVyKG09Pm0ubGFzdE1zKS5sZW5ndGg/TWF0aC5yb3VuZChNLnJlZHVjZSgoYSxtKT0+YSsobS5sYXN0TXN8fDApLDApL00uZmlsdGVyKG09Pm0ubGFzdE1zKS5sZW5ndGgpOjA7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoTS5sZW5ndGgsJ1RhcmdldHMgTW9uaXRvcmVkJywndmFyKC0tY3kpJywncHJvYmUgZXZlcnkgMTVzJyl9CiAgICR7a3BpKGRvd24sJ0N1cnJlbnRseSBEb3duJyxkb3duPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsZG93bj8nSU5DSURFTlQgQUNUSVZFJzonYWxsIHJlYWNoYWJsZScpfQogICAke2twaShhdmFpbCsoYXZhaWw9PT0n4oCUJz8nJzonJScpLCdBdmFpbGFiaWxpdHknLCd2YXIoLS1ncm4pJyx0b3QrJyBjaGVja3MnKX0KICAgJHtrcGkoYXZnKycgbXMnLCdBdmcgUmVzcG9uc2UnLGF2Zz4xNTAwPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsJ2xhc3QgY3ljbGUnKX08L2Rpdj4KICAke00ubGVuZ3RoP00ubWFwKG09PnsKICAgIGNvbnN0IGE9bS5jaGVja3M/KChtLnVwL20uY2hlY2tzKSoxMDApLnRvRml4ZWQoMik6JzAuMDAnOwogICAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7bS5zdGF0ZT09PSdVUCc/J3QtZ3JuJzptLnN0YXRlPT09J0RPV04nPyd0LXJlZCc6J3QtZGltJ30iPiR7bS5zdGF0ZX08L3NwYW4+CiAgICAgIDxiPiR7ZXNjKG0ubmFtZSl9PC9iPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobS51cmwpfTwvc3Bhbj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsTW9uKCcke20uaWR9JykiPlVuYmluZDwvYnV0dG9uPjwvZGl2PjwvZGl2PgogICAgJHt1cEJhcihtKX0KICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+TGFzdCBjaGVjazwvdGQ+PHRkPiR7bS5sYXN0QXR8fCfigJQnfSDCtyBIVFRQICR7bS5sYXN0U3RhdHVzfHwn4oCUJ30ke20ubGFzdEVycj8nIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4nK2VzYyhtLmxhc3RFcnIpKyc8L3NwYW4+JzonJ308L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxhdGVuY3k8L3RkPjx0ZD4ke20ubGFzdE1zfHwwfSBtcyAocDk1ICR7bS5wOTV8fDB9IG1zKTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXZhaWxhYmlsaXR5PC90ZD48dGQgc3R5bGU9ImNvbG9yOiR7YT45OT8ndmFyKC0tZ3JuKSc6YT45NT8ndmFyKC0tYW1iKSc6J3ZhcigtLW1hZyknfSI+JHthfSUgwrcgJHttLnVwfHwwfSB1cCAvICR7bS5kb3dufHwwfSBkb3duIG9mICR7bS5jaGVja3N8fDB9PC90ZD48L3RyPgogICAgICR7bS5zc2w/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5UTFMgY2VydGlmaWNhdGU8L3RkPjx0ZD4ke2VzYyhtLnNzbC5pc3N1ZXIpfSDCtyBleHBpcmVzIGluIDxzcGFuIHN0eWxlPSJjb2xvcjoke20uc3NsLmRheXNfbGVmdDwxND8ndmFyKC0tbWFnKSc6bS5zc2wuZGF5c19sZWZ0PDQ1Pyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKSd9Ij4ke20uc3NsLmRheXNfbGVmdH0gZGF5czwvc3Bhbj48L3RkPjwvdHI+YDonJ30KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+SW50ZXJ2YWw8L3RkPjx0ZD4ke20uaW50ZXJ2YWx9cyDCtyBib3VuZCAke20uYWRkZWR9PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB0YXJnZXRzIGJvdW5kLiBBZGQgeW91ciBsaXZlIHNpdGVzIGFuZCBhcHBzIGJlbG93IOKAlCB0aGUgVXB0aW1lIE1hcnNoYWwgd2lsbCBwcm9iZSB0aGVtIGZvciByZWFsLjwvZGl2PjwvZGl2Pid9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkluY2lkZW50IEhpc3Rvcnk8L2gzPiR7KFMuaW5jaWRlbnRzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogICA8dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+VGFyZ2V0PC90aD48dGg+VHJhbnNpdGlvbjwvdGg+PHRoPkRldGFpbDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtTLmluY2lkZW50cy5tYXAoaT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2kudH08L3RkPjx0ZD4ke2VzYyhpLm5hbWUpfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2kudG89PT0nRE9XTic/J3QtcmVkJzondC1ncm4nfSI+JHtpLmZyb219IOKGkiAke2kudG99PC9zcGFuPjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhpLmRldGFpbCl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RhdGUgdHJhbnNpdGlvbnMgcmVjb3JkZWQuIE5vdGhpbmcgaGFzIGZsYXBwZWQuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLnVwdGltZT0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkJpbmQgVGFyZ2V0IDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UkVBTCBIVFRQIFBST0JFUzwvc3Bhbj48L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVSTDwvc3Bhbj48aW5wdXQgaWQ9Im1VcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8veW91cnNpdGUuY29tIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkxhYmVsIChvcHRpb25hbCk8L3NwYW4+PGlucHV0IGlkPSJtTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iTWFpbiBzaXRlIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkludGVydmFsIChzZWMsIG1pbiAxNSk8L3NwYW4+PGlucHV0IGlkPSJtSW50IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IjYwIj48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFkZE1vbigpIj5CSU5EICZhbXA7IFBST0JFIE5PVzwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZWNrTm93KCkiPkZPUkNFIENIRUNLIEFMTDwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPlByb2JlcyBmb2xsb3cgdXAgdG8gMyByZWRpcmVjdHMsIHJlYWQgVExTIGV4cGlyeSwgYW5kIHJlY29yZCBwOTUgbGF0ZW5jeS4gT24gYW55IFVQ4oaURE9XTiB0cmFuc2l0aW9uIHRoZSBVcHRpbWUgTWFyc2hhbCB3cml0ZXMgYSBDUklUIGluY2lkZW50IGFuZCBmaXJlcyBhbiBlbWFpbCB0aHJvdWdoIHRoZSBNYWlsIFJlbGF5LjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9InVwdGltZSI+JHtMSVZFLnVwdGltZSgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGFkZE1vbigpe3RyeXthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9hZGQnLHt1cmw6bVVybC52YWx1ZS50cmltKCksbmFtZTptTmFtZS52YWx1ZS50cmltKCksaW50ZXJ2YWw6K21JbnQudmFsdWV8fDYwfSk7CiByZW5kZXIoKTtmbGFzaCgnVGFyZ2V0IGJvdW5kIMK3IHByb2JpbmcnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gZGVsTW9uKGlkKXtpZighY29uZmlybSgnVW5iaW5kIHRoaXMgdGFyZ2V0PycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9yZW1vdmUnLHtpZH0pO3JlbmRlcigpfQphc3luYyBmdW5jdGlvbiBjaGVja05vdygpe2ZsYXNoKCdQcm9iaW5nIGFsbCB0YXJnZXRz4oCmJyk7YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvY2hlY2snLHt9KTtyZW5kZXIoKTtmbGFzaCgnUHJvYmUgY3ljbGUgY29tcGxldGUnKX0KCi8qIC0tLS0tLS0tLS0gTUFJTCBSRUxBWSAtLS0tLS0tLS0tICovClJFTkRFUi5tYWlsPSgpPT57CiAgY29uc3Qgc3Q9Uy5zbXRwLCBtcz1TLm1haWxzdGF0fHx7c2VudDowLGZhaWxlZDowfTsKICByZXR1cm4gYCR7IXN0P2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIE9VVEJPVU5EIE1BSUw8L2gzPgogICA8ZGl2PkV2ZXJ5IDJGQSBub3RpZmljYXRpb24gYW5kIG91dGFnZSBhbGVydCBpcyBiZWluZyByZWNvcmRlZCBhcyBhbiA8Yj5pbnRlbnQgb25seTwvYj4uIENvbmZpZ3VyZSB5b3VyIG93biBTTVRQIHJlbGF5IGJlbG93IHRvIG1ha2UgdGhlbSByZWFsLiBUaGUgQ2hhaXJtYW4gd2lsbCBuZXZlciBhc2sgZm9yIHRoZXNlIGluIGNoYXQg4oCUIHlvdSBlbnRlciB0aGVtIGhlcmUsIGFuZCB0aGUgcGFzc3dvcmQgaXMgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvZGl2PjwvZGl2PmAKICA6YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzFjNWMzYztiYWNrZ3JvdW5kOiMwODE3MGYiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+UkVMQVkgQVJNRUQ8L2gzPgogICA8ZGl2Pk91dGJvdW5kIGVtYWlsIGlzIGxpdmUgdmlhICR7ZXNjKHN0Lmhvc3QpfToke3N0LnBvcnR9LiAke21zLnNlbnR9IGRlbGl2ZXJlZCwgJHttcy5mYWlsZWR9IGZhaWxlZCB0aGlzIHByb2Nlc3MuPC9kaXY+PC9kaXY+YH0KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5zbXRwVmVyaWZpZWQ/J3ZhcigtLWxpbWUpJzondmFyKC0tYW1iKSd9Ij4KICAgPGgzIHN0eWxlPSJjb2xvcjoke1Muc210cFZlcmlmaWVkPyd2YXIoLS1vbGl2ZSknOid2YXIoLS1hbWIpJ30iPiR7Uy5zbXRwVmVyaWZpZWQ/J1x1MjcxNCc6J1x1MjZhMCd9IFBSRUZMSUdIVCBcdTIwMTQgUFJPVkUgSVQgQUdBSU5TVCBUSEUgUkVBTCBTRVJWRVI8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+JHtTLnNtdHBWZXJpZmllZAogICAgID8gYFZlcmlmaWVkICR7ZXNjKFMuc210cFZlcmlmaWVkLmF0KX0gYWdhaW5zdCA8Yj4ke2VzYyhTLnNtdHBWZXJpZmllZC5ob3N0KX08L2I+LCBzZW5kaW5nIGFzIDxiPiR7ZXNjKFMuc210cFZlcmlmaWVkLmZyb20pfTwvYj4uIFlvdXIgY3JlZGVudGlhbHMgYXJlIGtub3duLWdvb2QgYmVjYXVzZSBHb29nbGUgYWNjZXB0ZWQgdGhlbSwgbm90IGJlY2F1c2UgdGhlIGZvcm0gbG9va2VkIHJpZ2h0LmAKICAgICA6IGA8Yj5Zb3VyIGNyZWRlbnRpYWxzIGhhdmUgbmV2ZXIgYmVlbiBwcm92ZW4uPC9iPiBTYXZpbmcgdGhlIGZvcm0gb25seSBzdG9yZXMgdGhlbS4gVGhpcyBvcGVucyBhIHJlYWwgY29ubmVjdGlvbiB0byB5b3VyIG1haWwgc2VydmVyLCBkb2VzIHRoZSByZWFsIFRMUyBoYW5kc2hha2UsIHN1Ym1pdHMgeW91ciByZWFsIHBhc3N3b3JkLCBhbmQgdmFsaWRhdGVzIHlvdXIgc2VuZGVyIGFuZCByZWNpcGllbnQgXHUyMDE0IHdpdGhvdXQgc2VuZGluZyBhbnl0aGluZy4gSGUgd2lsbCByZWZ1c2UgdG8gcnVuIGFuIGVtYWlsIGNhbXBhaWduIHVudGlsIHRoaXMgcGFzc2VzLmB9PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InByZWZsaWdodCgpIj5SVU4gVEhFIFBSRUZMSUdIVDwvYnV0dG9uPgogICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9InBmVG8iIHBsYWNlaG9sZGVyPSJ0ZXN0IGEgcmVjaXBpZW50IChvcHRpb25hbCkiIHN0eWxlPSJtYXgtd2lkdGg6MjUwcHgiPjwvZGl2PgogICA8ZGl2IGlkPSJwZk91dCIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PC9kaXY+CiAgICR7Uy5zZW5kV2luZG93P2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+U2VuZCBidWRnZXQ6IDxiPiR7Uy5zZW5kV2luZG93LnVzZWR9PC9iPiBvZiAke1Muc2VuZFdpbmRvdy5jYXB9IHVzZWQgaW4gdGhlIGxhc3QgMjRoLiBHbWFpbCBzdXNwZW5kcyBzZW5kaW5nIG5lYXIgNTAwIFx1MjAxNCB0aGUgY2FwIGlzIHNldCBiZWxvdyB0aGF0IGRlbGliZXJhdGVseSwgYW5kIG1lc3NhZ2VzIGFyZSBwYWNlZCA4IHNlY29uZHMgYXBhcnQgc28gYSBidXJzdCBuZXZlciBsb29rcyBsaWtlIGEgY29tcHJvbWlzZWQgYWNjb3VudC48L2Rpdj5gOicnfQogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShtcy5zZW50LCdEZWxpdmVyZWQnLCd2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKG1zLmZhaWxlZCwnRmFpbGVkJyxtcy5mYWlsZWQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKHN0PydBUk1FRCc6J09GRkxJTkUnLCdSZWxheSBTdGF0dXMnLHN0Pyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKScsc3Q/ZXNjKHN0Lmhvc3QpOidpbnRlbnQtb25seSBtb2RlJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TTVRQIENvbmZpZ3VyYXRpb248L2gzPgogICAgPGRpdiBjbGFzcz0id2FybmJveCI+VXNlIGFuIDxiPmFwcC1zcGVjaWZpYyBwYXNzd29yZDwvYj4sIG5ldmVyIHlvdXIgbWFpbiBhY2NvdW50IHBhc3N3b3JkLiBHbWFpbDogPGNvZGU+c210cC5nbWFpbC5jb206NTg3PC9jb2RlPi4gT3V0bG9vazogPGNvZGU+c210cC1tYWlsLm91dGxvb2suY29tOjU4NzwvY29kZT4uIFpvaG86IDxjb2RlPnNtdHAuem9oby5jb206NTg3PC9jb2RlPi4gQWxsIGZyZWUgdGllcnMg4oCUIG5vIHBhaWQgc2VydmljZSByZXF1aXJlZC48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U01UUCBIb3N0PC9zcGFuPjxpbnB1dCBpZD0ic0hvc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InNtdHAuZ21haWwuY29tIiB2YWx1ZT0iJHtzdD9lc2Moc3QuaG9zdCk6Jyd9Ij48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UG9ydDwvc3Bhbj48aW5wdXQgaWQ9InNQb3J0IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7c3Q/c3QucG9ydDo1ODd9Ij48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Vc2VybmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNVc2VyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QXBwIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0ic1Bhc3MiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Gcm9tIEFkZHJlc3M8L3NwYW4+PGlucHV0IGlkPSJzRnJvbSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSIgdmFsdWU9IiR7c3Q/ZXNjKHN0LmZyb20pOicnfSI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyb20gTmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNOYW1lIiBjbGFzcz0iaW4iIHZhbHVlPSIke3N0P2VzYyhzdC5uYW1lKTonQ2hhaXJtYW4gQWdlbnQgT1MnfSI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW1wbGljaXQgVExTIChwb3J0IDQ2NSk8L3NwYW4+PHNlbGVjdCBpZD0ic1NlYyIgY2xhc3M9ImluIj4KICAgICA8b3B0aW9uIHZhbHVlPSIwIiAke3N0JiYhc3Quc2VjdXJlPydzZWxlY3RlZCc6Jyd9Pk5vIOKAlCBTVEFSVFRMUyBvbiA1ODc8L29wdGlvbj4KICAgICA8b3B0aW9uIHZhbHVlPSIxIiAke3N0JiZzdC5zZWN1cmU/J3NlbGVjdGVkJzonJ30+WWVzIOKAlCBTTVRQUyBvbiA0NjU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2F2ZVNtdHAoKSI+QVJNIFJFTEFZPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0U210cCgpIj5TRU5EIFRFU1QgRU1BSUw8L2J1dHRvbj4KICAgICAke3N0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlU210cCgpIj5QdXJnZTwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWxpdmVyeSBMb2c8L2gzPiR7KFMubWFpbHF8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgICA8dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+U3ViamVjdDwvdGg+PHRoPlN0YXR1czwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7Uy5tYWlscS5tYXAobT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke20udH08L3RkPjx0ZD4ke2VzYyhtLnN1YmplY3QpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj7ihpIgJHtlc2MobS50byl9PC9kaXY+PC90ZD4KICAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAkey9ERUxJVkVSRUQvLnRlc3QobS5zdGF0dXMpPyd0LWdybic6L1VOU0VOVC8udGVzdChtLnN0YXR1cyk/J3QtYW1iJzondC1yZWQnfSI+JHtlc2MobS5zdGF0dXMpfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gbWFpbCBhdHRlbXB0ZWQgeWV0LjwvZGl2Pid9CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5UYXJnZXQgaW5ib3g6IDxiPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC9iPi4gQ2hhbmdlIGl0IGluIE93bmVyIFNldHRpbmdzLjwvZGl2PjwvZGl2PgogIDwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBzYXZlU210cCgpewogdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc210cCcse2hvc3Q6c0hvc3QudmFsdWUudHJpbSgpLHBvcnQ6K3NQb3J0LnZhbHVlfHw1ODcsc2VjdXJlOnNTZWMudmFsdWU9PT0nMScsCiAgIHVzZXI6c1VzZXIudmFsdWUudHJpbSgpLHBhc3M6c1Bhc3MudmFsdWUsZnJvbTpzRnJvbS52YWx1ZS50cmltKCksbmFtZTpzTmFtZS52YWx1ZS50cmltKCl9KTsKICByZW5kZXIoKTsgZmxhc2goJ1JlbGF5IGFybWVkIOKAlCBzZW5kIGEgdGVzdCBlbWFpbCB0byBjb25maXJtJyk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gdGVzdFNtdHAoKXsgZmxhc2goJ0RpYWxpbmcgU01UUCByZWxheeKApicpOwogdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zbXRwL3Rlc3QnLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5vaz8nREVMSVZFUkVEIOKAlCBjaGVjayB5b3VyIGluYm94JzonRkFJTEVEOiAnKyhyLnJlYXNvbnx8J3Vua25vd24nKSk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VTbXRwKCl7IGlmKCFjb25maXJtKCdQdXJnZSByZWxheT8gTWFpbCByZXZlcnRzIHRvIGludGVudC1vbmx5LicpKXJldHVybjsKIGF3YWl0IEFQSSgnL2FwaS9zbXRwL3B1cmdlJyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnUmVsYXkgcHVyZ2VkJykgfQoKLyogLS0tLS0tLS0tLSBERVZJQ0VTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmRldmljZXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBNdWx0aS1EZXZpY2UgU3luYyA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5SRUFMPC9zcGFuPjwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlN0YXRlIGxpdmVzIG9uIHRoZSBzZXJ2ZXIsIG5vdCB0aGUgYnJvd3Nlci4gRXZlcnkgZGV2aWNlIHBvbGxzIGV2ZXJ5IDMgc2Vjb25kcyBhbmQgYWRvcHRzIHJldmlzaW9uIGNoYW5nZXMgYXV0b21hdGljYWxseS48L2xpPgogIDxsaT5DdXJyZW50IHN0YXRlIHJldmlzaW9uIDxiPiR7Uy5yZXZ9PC9iPiDCtyA8Yj4ke3QubGl2ZV9zZXNzaW9uc308L2I+IHNlc3Npb24ocykgYWN0aXZlIGluIHRoZSBsYXN0IDcwcy48L2xpPgogIDxsaT5PcGVuIHRoaXMgc2FtZSBVUkwgb24geW91ciBwaG9uZSwgbG9nIGluIHdpdGggdGhlIHNhbWUgT3duZXIgSUQsIGFuZCBib3RoIHNjcmVlbnMgdHJhY2sgZWFjaCBvdGhlci4gUmFpc2UgYSBnYXRlIG9uIG9uZSwgaXQgYXBwZWFycyBvbiB0aGUgb3RoZXIuPC9saT4KICA8bGk+PGI+U2Vzc2lvbnMgYXJlIGR1cmFibGUuPC9iPiBXcml0dGVuIHRvIDxjb2RlPnNlc3Npb25zLmpzb248L2NvZGU+IChjaG1vZCA2MDApIHdpdGggYSAzMC1kYXkgVFRMIOKAlCByZXN0YXJ0aW5nIHRoZSBzZXJ2ZXIgbm8gbG9uZ2VyIGxvZ3MgeW91IG91dC4gUmV2b2tpbmcgYmVsb3cga2lsbHMgZXZlcnkgZGV2aWNlIGV4Y2VwdCB0aGlzIG9uZS48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2Vzc2lvbiBMb2c8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5JUDwvdGg+PHRoPlVzZXIgQWdlbnQ8L3RoPjx0aD5BdDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZGV2aWNlcy5tYXAoZD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLmlkKX08L3RkPjx0ZD4ke2VzYyhkLmlwfHwn4oCUJyl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLnVhKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC5hdH08L3RkPjwvdHI+YCkuam9pbignJyl8fCc8dHI+PHRkIGNvbHNwYW49IjQiIGNsYXNzPSJtb25vLWRpbSI+bm9uZTwvdGQ+PC90cj4nfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PgogPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InJldm9rZSgpIj5SRVZPS0UgQUxMIE9USEVSIFNFU1NJT05TPC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGhpcyBEZXZpY2U8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPlZpZXdwb3J0PC90ZD48dGQ+JHtpbm5lcldpZHRofSDDlyAke2lubmVySGVpZ2h0fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF5b3V0PC90ZD48dGQ+JHtpbm5lcldpZHRoPDg2MD8nTU9CSUxFIMK3IGNvbGxhcHNlZCBzaWRlYmFyJzonREVTS1RPUCDCtyBmaXhlZCBzaWRlYmFyJ308L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRyYW5zcG9ydDwvdGQ+PHRkPiR7bG9jYXRpb24ucHJvdG9jb2x9IMK3IHBvbGwgM3M8L3RkPjwvdHI+CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHJldm9rZSgpe2NvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Nlc3Npb25zL3Jldm9rZScse30pO3JlbmRlcigpO2ZsYXNoKHIucmV2b2tlZCsnIHNlc3Npb24ocykgcmV2b2tlZCcpfQoKLyogLS0tLS0tLS0tLSBET0NUUklORSAtLS0tLS0tLS0tICovClJFTkRFUi5kb2N0cmluZT0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvcmUgTWFuZGF0ZTwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjxiPlplcm8gc3VnYXItY29hdGluZy48L2I+IEZhaWx1cmVzLCBib3R0bGVuZWNrcyBhbmQgcmlza3MgcmVwb3J0ZWQgYXQgZnVsbCBzZXZlcml0eSwgdW5zb2Z0ZW5lZC48L2xpPgogIDxsaT48Yj5VbmNvbXByb21pc2luZyBvdmVyc2lnaHQuPC9iPiBFdmVyeSBzdWItYWdlbnQsIHRvb2wgY2FsbCwgZGVwbG95bWVudCBhbmQgdHJhbnNhY3Rpb24gcGFzc2VzIGEgZ2F0ZS48L2xpPgogIDxsaT48Yj5Pd25lciBwcmltYWN5LjwvYj4gQXV0aG9yaXR5IGZsb3dzIGZyb20gdGhlIHZlcmlmaWVkIE93bmVyIG9ubHkuIE5vIHB1YmxpYyB1c2VyLCBleHRlcm5hbCByZXF1ZXN0IG9yIHN1Yi1hZ2VudCBieXBhc3NlcyBhIGdhdGUuPC9saT4KICA8bGk+PGI+WmVybyBjb3N0LjwvYj4gVGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCByYXRoZXIgdGhhbiBmdW5kaW5nIGl0LjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIFNPUDwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjEgwrcgT2JqZWN0aXZlLCBzdWNjZXNzIGNyaXRlcmlhLCBvcGVyYXRpb25hbCBib3VuZGFyaWVzLjwvbGk+CiAgPGxpPjIgwrcgSnVzdGlmeSBldmVyeSBhc3NpZ25lZCBhZ2VudCBhbmQgdG9vbC48L2xpPgogIDxsaT4zIMK3IEVudW1lcmF0ZSByb2xsYmFjaywgYXVkaXRzLCBtaXRpZ2F0aW9ucy48L2xpPgogIDxsaT40IMK3IEhhbHQgdW50aWwgT3duZXIgY3J5cHRvZ3JhcGhpYyBjbGVhcmFuY2UgaXMgc2lnbmVkIOKAlCBlbmZvcmNlZCBieSB0aGUgc2VydmVyLCBub3QgdGhlIFVJLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UcmVhc3VyeSBTYWZlZ3VhcmRzPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+Q3JlZGVudGlhbHMgbmV2ZXIgcmVxdWVzdGVkIGluIGNoYXQsIG5ldmVyIHdyaXR0ZW4gdG8gYW55IGxvZy48L2xpPgogIDxsaT5Pd25lciBlbnRlcnMgcGF5b3V0IGRldGFpbHMgb25seSBpbiB0aGUgaXNvbGF0ZWQgVmF1bHQgcGFuZWw7IG9ubHkgbWFza2VkIHZhbHVlcyBhcmUgcGVyc2lzdGVkLjwvbGk+CiAgPGxpPlRyYW5zZmVycyByZXF1aXJlIHBhc3N3b3JkIHNpZ25hdHVyZTsgc2VydmVyIGhhcmQtYmxvY2tzIHdpdGggbm8gc2VhbGVkIGNoYW5uZWwuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkhvbmVzdCBMaW1pdHMg4oCUIFJlYWQgVGhpczwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlBlcnNpc3RlbmNlIGlzIGEgSlNPTiBmaWxlIG9uIHRoaXMgc2VydmVyLiBLaWxsIHRoZSBzYW5kYm94IGFuZCBpdCBkaWVzIHdpdGggaXQg4oCUIGV4cG9ydCB0aGUgYXVkaXQgbGVkZ2VyIGlmIGl0IG1hdHRlcnMuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5ObyBvdXRib3VuZCBuZXR3b3JrLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gcmVhbCBTTVRQIGNsaWVudCAobm9kZTpuZXQgKyBub2RlOnRscywgemVybyBkZXBzKS4gQXJtIGl0IGluIE1haWwgUmVsYXkgd2l0aCB5b3VyIG93biBhcHAgcGFzc3dvcmQgYW5kIDJGQSBiZWNvbWVzIGRlbGl2ZXJlZCBtYWlsLCBub3QgaW50ZW50LjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+VGVsZW1ldHJ5IGlzIG9ubHkgdGhpcyBwcm9jZXNzLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gVXB0aW1lIE1hcnNoYWwgcnVucyByZWFsIEhUVFAvSFRUUFMgcHJvYmVzIGFnYWluc3QgYW55IFVSTCB5b3UgYmluZCDigJQgc3RhdHVzLCBsYXRlbmN5LCBwOTUsIFRMUyBleHBpcnksIGluY2lkZW50IHRyYW5zaXRpb25zLjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+U2Vzc2lvbnMgYXJlIGluLW1lbW9yeS48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IGR1cmFibGUgdG8gZGlzaywgMzAtZGF5IFRUTCwgc3Vydml2ZXMgcmVzdGFydC48L2xpPgogIDxsaT48Yj5TdGlsbCB0cnVlOjwvYj4gU01UUCBjcmVkZW50aWFscyBzaXQgaW4gPGNvZGU+ZGF0YS5qc29uPC9jb2RlPiBvbiB0aGlzIGJveC4gVGhhdCBpcyBzdGFuZGFyZCBmb3IgYSBzZWxmLWhvc3RlZCByZWxheSwgYnV0IGl0IGlzIG5vdCBhIGhhcmR3YXJlIHZhdWx0IOKAlCB1c2UgYW4gYXBwLXNwZWNpZmljIHBhc3N3b3JkIHlvdSBjYW4gcmV2b2tlLCBuZXZlciB5b3VyIHByaW1hcnkgb25lLjwvbGk+CiAgPGxpPjxiPlN0aWxsIHRydWU6PC9iPiBwcm9iZXMgcnVuIGZyb20gdGhpcyBzYW5kYm94LiBJZiB0aGUgc2FuZGJveCBoYXMgbm8gcm91dGUgdG8gYSBob3N0LCB0aGF0IHJlYWRzIGFzIERPV04gZXZlbiB3aGVuIHRoZSBob3N0IGlzIGZpbmUuIFZlcmlmeSBhbiBvdXRhZ2UgYmVmb3JlIGFjdGluZyBvbiBpdC48L2xpPgogIDxsaT5aZXJvLUNvc3QgbWVhbnMgbGF3ZnVsIGZyZWUgcm91dGVzIG9ubHkg4oCUIG5ldmVyIHBpcmFjeSwgc3RvbGVuIGtleXMgb3IgVG9TIGV2YXNpb24uPC9saT48L3VsPjwvZGl2PjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNFVFRJTkdTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNldHRpbmdzPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAke1Mub3duZXIuYm9vdHN0cmFwP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iZ3JpZC1jb2x1bW46MS8tMTtib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4pqgIEJPT1RTVFJBUCBDUkVERU5USUFMIEFDVElWRTwvaDM+CiAgPGRpdj5UaGUgc2VydmVyLWdlbmVyYXRlZCBwYXNzd29yZCBpcyBzdGlsbCBpbiBmb3JjZSBhbmQgYSBwbGFpbnRleHQgY29weSBzaXRzIGluIDxjb2RlPk9XTkVSX0NSRURFTlRJQUxTLnR4dDwvY29kZT4uIFJvdGF0ZSBub3cg4oCUIHJvdGF0aW9uIGRlbGV0ZXMgdGhhdCBmaWxlIGF1dG9tYXRpY2FsbHkuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JZGVudGl0eTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNjBweCI+T3duZXIgSUQ8L3RkPjx0ZD4ke2VzYyhTLm93bmVyLmlkKX08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBhc3N3b3JkPC90ZD48dGQ+UEJLREYyLVNIQTI1NiDCtyAxNTBrIGl0ZXJhdGlvbnMgwrcgc2VydmVyLXNpZGU8L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjJGQSBFbWFpbDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Qcm92aXNpb25lZDwvdGQ+PHRkPiR7Uy5vd25lci5jcmVhdGVkfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RG9jdHJpbmU8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5aRVJPLUNPU1QgRU5GT1JDRUQ8L3NwYW4+PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3RhdGUgUGFzc3dvcmQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VycmVudDwvc3Bhbj48aW5wdXQgaWQ9InJwT2xkIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IChtaW4gOCk8L3NwYW4+PGlucHV0IGlkPSJycE5ldyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icm90YXRlKCkiPlJPVEFURTwvYnV0dG9uPjxkaXYgY2xhc3M9ImVyciIgaWQ9InJwRXJyIj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFuZ2UgT3duZXIgSUQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IE93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0iaWROZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvbmZpcm0gUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJpZFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hnSWQoKSI+VVBEQVRFIElEPC9idXR0b24+PGRpdiBjbGFzcz0iZXJyIiBpZD0iaWRFcnIiPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPjJGQSBUYXJnZXQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IEVtYWlsPC9zcGFuPjxpbnB1dCBpZD0iZW1OZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZ01haWwoKSI+VVBEQVRFPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um9zdGVyPC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5SZXN0b3JlIHRoZSAxOCBkZWZhdWx0IHN1Yi1hZ2VudHMuPC9kaXY+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXNldFJvc3RlcigpIj5SRVNFVCBST1NURVI8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5EZXN0cnVjdGl2ZTwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db25maXJtIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0id3BQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9IndpcGUoKSI+V0lQRSBFTlRJUkUgSU5TVEFOQ0U8L2J1dHRvbj48L2Rpdj48L2Rpdj5gOwphc3luYyBmdW5jdGlvbiByb3RhdGUoKXtjb25zdCBlPXJwRXJyO2UudGV4dENvbnRlbnQ9Jyc7CiB0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL3JvdGF0ZScse29sZDpycE9sZC52YWx1ZSxuZXU6cnBOZXcudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnUGFzc3dvcmQgcm90YXRlZCDCtyBib290c3RyYXAgZmlsZSBkZXN0cm95ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ0lkKCl7Y29uc3QgZT1pZEVycjtlLnRleHRDb250ZW50PScnOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9pZCcse25ld2lkOmlkTmV3LnZhbHVlLnRyaW0oKSxwdzppZFB3LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ093bmVyIElEIHVwZGF0ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ01haWwoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL2VtYWlsJyx7ZW1haWw6ZW1OZXcudmFsdWUudHJpbSgpfSk7cmVuZGVyKCk7Zmxhc2goJzJGQSB0YXJnZXQgdXBkYXRlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXNldFJvc3Rlcigpe2lmKCFjb25maXJtKCdSZXNldCByb3N0ZXI/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9yZXNldCcse30pO3JlbmRlcigpO2ZsYXNoKCdSb3N0ZXIgcmVzZXQnKX0KYXN5bmMgZnVuY3Rpb24gd2lwZSgpe2lmKCFjb25maXJtKCdJUlJFVkVSU0lCTEUuIERlc3Ryb3kgYWxsIHNlcnZlciBzdGF0ZT8nKSlyZXR1cm47CiB0cnl7YXdhaXQgQVBJKCcvYXBpL3dpcGUnLHtwdzp3cFB3LnZhbHVlfSk7bG9jYXRpb24ucmVsb2FkKCl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIE1PREFMIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gbW9kYWwoaHRtbCl7Y2xvc2VNb2RhbCgpO2NvbnN0IGQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7ZC5jbGFzc05hbWU9J21vZGFsJztkLmlkPSdtZGwnOwogZC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9Im1ib3giPiR7aHRtbH08L2Rpdj5gO2Qub25jbGljaz1lPT57aWYoZS50YXJnZXQ9PT1kKWNsb3NlTW9kYWwoKX07ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkKX0KZnVuY3Rpb24gY2xvc2VNb2RhbCgpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZGwnKT8ucmVtb3ZlKCl9CmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGU9PntpZihlLmtleT09PSdFc2NhcGUnKXtjbG9zZU1vZGFsKCk7Y2xvc2VTYigpfX0pOwphZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCgpPT57aWYoY3VyPT09J2VuZ2luZScpZHJhd0VuZ2luZSgpfSk7CgovKiA9PT09PT09PT09PT09PT09PSBUSEUgQlVTSU5FU1MgRkFDVE9SWSA9PT09PT09PT09PT09PT09PQogICBOb3QgYSBsYW5kaW5nIHBhZ2UuIEEgd2hvbGUgYnVzaW5lc3MsIGluIGEgZm9sZGVyLiAqLwpMSVZFLmZhY3Rvcnk9KCk9PnsKICBjb25zdCBCPVMuYnVzaW5lc3Nlc3x8W10sIFY9Uy52ZW50dXJlc3x8W107CiAgY29uc3QgaGVhZD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7ilqYgQlVTSU5FU1MgRkFDVE9SWSDigJQgSEUgQlVJTERTIFRIRSBXSE9MRSBUSElORzwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+UGljayBhbiBpZGVhLiBIZSBidWlsZHMgYSA8Yj5yZWFsIGJ1c2luZXNzPC9iPjogYSBmaXZlLXBhZ2Ugd2Vic2l0ZSwgdGhlIGZvdXIgcG9saWN5IHBhZ2VzIFJhem9ycGF5IGRlbWFuZHMgYmVmb3JlIGl0IHdpbGwgYXBwcm92ZSB5b3UsIGEgZnJlZSB3b3JraW5nIHRvb2wgeW91ciBidXllciBjYW4gdXNlLCBhbiBlZGl0YWJsZSBpbnZvaWNlLCBhbmQgdGhlIGV4YWN0IHdvcmRzIHRvIHNlbmQgdGhlIGZpcnN0IHRlbiBwcm9zcGVjdHMuIE9uZSBaSVAuIERyYWcgaXQgb250byBOZXRsaWZ5IGFuZCBpdCBpcyBsaXZlLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5XaHkgaXQgd2lsbCBub3QgbG9vayBBSS1tYWRlLjwvYj4gSGUgZG9lcyBub3QgZGVzaWduIGFueXRoaW5nLiBUaGUgbGF5b3V0LCB0eXBvZ3JhcGh5IGFuZCBjb2xvdXIgcnVsZXMgYXJlIHdyaXR0ZW4gaW50byB0aGUgc3lzdGVtIGJ5IGhhbmQsIG9uY2UsIGxpa2UgYSBzdHVkaW8gaG91c2Ugc3R5bGUuIEhlIG9ubHkgc3VwcGxpZXMgdGhlIHdvcmRzIGFuZCBwcmljZXMuIFRoZW4gYSBoYXJkLWNvZGVkIGF1ZGl0IGh1bnRzICR7JzI4J30gcGhyYXNlcyBhbmQgcGF0dGVybnMgdGhhdCBtYXJrIGdlbmVyYXRlZCB3b3JrIOKAlCBncmFkaWVudHMsICJ1bmxvY2siLCAic2VhbWxlc3MiLCBlbW9qaSwgZmFrZSBjdXN0b21lciBjb3VudHMsIGludmVudGVkIHBlcmNlbnRhZ2VzIOKAlCBhbmQgZm9yY2VzIGhpbSB0byByZXdyaXRlIGJlZm9yZSB0aGUgcGFjayBpcyBhbGxvd2VkIHRvIGV4aXN0LiBBbnl0aGluZyBzdGlsbCBmbGFnZ2VkIGlzIGxpc3RlZCBmb3IgeW91LjwvZGl2PgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogICAkeyEoUy5vd25lciYmUy5vd25lci5lbWFpbCk/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPlNldCB5b3VyIGVtYWlsIGluIE93bmVyIFNldHRpbmdzIGZpcnN0IOKAlCBpdCBnb2VzIG9uIGV2ZXJ5IHBhZ2UsIGludm9pY2UgYW5kIHBvbGljeS48L2Rpdj4nOicnfQogICA8ZGl2IGNsYXNzPSJncmlkIGcyIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QnVpbGQgZnJvbSBhIGxhdW5jaGVkIHZlbnR1cmU8L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0iYnpWZW50dXJlIiBjbGFzcz0iaW4iPjxvcHRpb24gdmFsdWU9IiI+4oCUIHBpY2sgb25lIOKAlDwvb3B0aW9uPgogICAgICAke1YubWFwKHY9PmA8b3B0aW9uIHZhbHVlPSIke3YuaWR9Ij4ke2VzYyh2LnRpdGxlKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PciBkZXNjcmliZSB0aGUgYnVzaW5lc3MgeW91cnNlbGY8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJiekJyaWVmIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHdlYnNpdGUgZG93bnRpbWUgYWxlcnRzIGZvciBMdWRoaWFuYSBob3NpZXJ5IGV4cG9ydGVycyI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Zb3VyIHBob25lIChnb2VzIG9uIHRoZSBzaXRlIOKAlCBsZWF2aW5nIGl0IG91dCBjb3N0cyB5b3UgQjJCIHRydXN0IGluIEluZGlhKTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImJ6UGhvbmUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Iis5MSAuLi4iPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXRzQXBwIG51bWJlciAob3B0aW9uYWwpPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iYnpXYSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iKzkxIC4uLiI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CdXNpbmVzcyBhZGRyZXNzIHNob3duIGluIHRoZSBmb290ZXI8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJiekFkZHIiIGNsYXNzPSJpbiIgdmFsdWU9Ikx1ZGhpYW5hLCBQdW5qYWIsIEluZGlhIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5HU1RJTiAobGVhdmUgYmxhbmsgaWYgbm90IHJlZ2lzdGVyZWQg4oCUIHRoYXQgaXMgbm9ybWFsKTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImJ6R3N0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48c3Bhbj48aW5wdXQgdHlwZT0iY2hlY2tib3giIGlkPSJielRvb2wiIGNoZWNrZWQ+IEFsc28gYnVpbGQgdGhlIGZyZWUgYnJvd3NlciB0b29sIChhZGRzIGFib3V0IGEgbWludXRlKTwvc3Bhbj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYnVpbGRCaXooKSI+QlVJTEQgVEhFIEJVU0lORVNTPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRha2VzIDLigJM0IG1pbnV0ZXMuIEhlIG1ha2VzIDTigJM1IG1vZGVsIGNhbGxzIGFuZCByZXdyaXRlcyBoaXMgb3duIGNvcHkgaWYgaXQgZmFpbHMgdGhlIGF1ZGl0LjwvZGl2PgogIDwvZGl2PmA7CgogIGlmKCFCLmxlbmd0aCkgcmV0dXJuIGhlYWQrJzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIGJ1aWx0IHlldC48L2Rpdj48L2Rpdj4nOwoKICByZXR1cm4gaGVhZCArIEIubWFwKGI9PnsKICAgIGNvbnN0IHRpZXJzPShiLnRpZXJzfHxbXSkubWFwKHQ9PmA8dHI+PHRkPiR7ZXNjKHQubmFtZSl9JHt0LnBpY2s/JyA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj50aGUgb25lIHRoZXkgcGljazwvc3Bhbj4nOicnfTwvdGQ+CiAgICAgIDx0ZD5ScyAke051bWJlcih0LmFtb3VudHx8MCkudG9Mb2NhbGVTdHJpbmcoJ2VuLUlOJyl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh0LnBlcmlvZHx8JycpfTwvdGQ+CiAgICAgIDx0ZD4ke2VzYyh0Lndob3x8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKTsKICAgIGNvbnN0IHBhZ2VzPShiLmZpbGVMaXN0fHxbXSkuZmlsdGVyKGY9Pi9ec2l0ZVwvLipcLmh0bWwkLy50ZXN0KGYubmFtZSkpOwogICAgY29uc3Qgb3RoZXI9KGIuZmlsZUxpc3R8fFtdKS5maWx0ZXIoZj0+IS9ec2l0ZVwvLipcLmh0bWwkLy50ZXN0KGYubmFtZSkpOwogICAgY29uc3Qgbz1iLm91dHJlYWNofHxudWxsOwogICAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWxlZnQ6NHB4IHNvbGlkICR7ZXNjKGIuYnJhbmR8fCcjNzg4QTFEJyl9Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjZweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5CVVNJTkVTUzwvc3Bhbj4KICAgICAgIDxiIHN0eWxlPSJmb250LXNpemU6MTZweCI+JHtlc2MoYi5uYW1lKX08L2I+CiAgICAgICAke2IucHVibGlzaGVkP2A8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5MSVZFPC9zcGFuPmA6JzxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPk5PVCBQVUJMSVNIRUQ8L3NwYW4+J30KICAgICAgICR7Yi50ZWxsQ291bnQ/YDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPiR7Yi50ZWxsQ291bnR9IHRlbGxzIHRvIGZpeDwvc3Bhbj5gOic8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5hdWRpdCBjbGVhbjwvc3Bhbj4nfQogICAgICAgJHtiLnJld3JvdGU/JzxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPnJld3JpdHRlbiBvbmNlPC9zcGFuPic6Jyd9PC9kaXY+CiAgICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtiLnR9IMK3ICR7KGIuemlwQnl0ZXMvMTAyNCkudG9GaXhlZCgxKX0gS0IgwrcgJHsoYi5maWxlTGlzdHx8W10pLmxlbmd0aH0gZmlsZXM8L3NwYW4+PC9kaXY+CiAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij4ke2VzYyhiLnRhZ2xpbmV8fCcnKX08L2Rpdj4KCiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4O2ZsZXgtd3JhcDp3cmFwIj4KICAgICAgPGEgY2xhc3M9ImJ0biBwIiBocmVmPSIvYXBpL2Jpei9maWxlP2lkPSR7Yi5pZH0mZj1zaXRlL2luZGV4Lmh0bWwiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5PUEVOIFRIRSBXRUJTSVRFIOKGlzwvYT4KICAgICAgPGEgY2xhc3M9ImJ0biBvayIgaHJlZj0iL2FwaS9iaXovemlwP2lkPSR7Yi5pZH0iPkRPV05MT0FEIFRIRSBaSVA8L2E+CiAgICAgICR7Yi5oYXNUb29sP2A8YSBjbGFzcz0iYnRuIiBocmVmPSIvYXBpL2Jpei9maWxlP2lkPSR7Yi5pZH0mZj1zaXRlL3Rvb2wuaHRtbCIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPkZyZWUgdG9vbDogJHtlc2MoYi50b29sVGl0bGV8fCcnKX0g4oaXPC9hPmA6Jyd9CiAgICAgIDxhIGNsYXNzPSJidG4iIGhyZWY9Ii9hcGkvYml6L2ZpbGU/aWQ9JHtiLmlkfSZmPWludm9pY2UtdGVtcGxhdGUuaHRtbCIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPkludm9pY2UgdGVtcGxhdGUg4oaXPC9hPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbEJpeignJHtiLmlkfScpIj5EZWxldGU8L2J1dHRvbj48L2Rpdj4KCiAgICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjx0YWJsZT48dGJvZHk+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTMwcHgiPldobyBwYXlzPC90ZD48dGQ+JHtlc2MoYi5idXllcnx8J+KAlCcpfTwvdGQ+PC90cj4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRoZSBwcm9taXNlPC90ZD48dGQ+JHtlc2MoYi5wcm9taXNlfHwn4oCUJyl9PC90ZD48L3RyPgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UGF5bWVudHM8L3RkPjx0ZD4ke2VzYyhiLnBheU5vdGV8fCfigJQnKX08L3RkPjwvdHI+CiAgICAgICR7Yi5kb21haW5zP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RG9tYWluPC90ZD48dGQ+JHtiLmRvbWFpbnMubWFwKGQ9PgogICAgICAgIGA8c3BhbiBjbGFzcz0idGFnICR7ZC5zdGF0dXM9PT0nQVZBSUxBQkxFJz8ndC1ncm4nOmQuc3RhdHVzPT09J1RBS0VOJz8ndC1kaW0nOid0LWFtYid9Ij4ke2VzYyhkLm5hbWUpfSAke2Quc3RhdHVzPT09J0FWQUlMQUJMRScmJmQucHJpY2UmJmQucHJpY2UuZmlyc3Q/J37igrknK2QucHJpY2UuZmlyc3Q6Jyd9PC9zcGFuPmApLmpvaW4oJyAnKX0KICAgICAgICAke2IuZG9tYWlucy5zb21lKGQ9PmQuc3RhdHVzPT09J0FWQUlMQUJMRScpPyc8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4Ij5DaGVja2VkIGxpdmUgYWdhaW5zdCB0aGUgcmVnaXN0cnkuIEJ1eSBpdCB5b3Vyc2VsZiBhdCBDbG91ZGZsYXJlIG9yIFBvcmtidW4g4oCUIGhlIGNhbm5vdCwgdGhhdCBuZWVkcyBhIGNhcmQgYW5kIEtZQyBpbiB5b3VyIG5hbWUuPC9kaXY+JzonPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweDtjb2xvcjp2YXIoLS1hbWIpIj5Ob3RoaW5nIGZyZWUg4oCUIGNvbnNpZGVyIHJlbmFtaW5nIGJlZm9yZSB5b3UgcHJpbnQgYW55dGhpbmcuPC9kaXY+J308L3RkPjwvdHI+YDonJ30KICAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CgogICAgIDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+UHJpY2luZyBoZSBzZXQ8L2I+PC9zdW1tYXJ5PgogICAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48dGFibGU+PHRib2R5PiR7dGllcnN9PC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGV0YWlscz4KCiAgICAgPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5FdmVyeSBwYWdlIGhlIHdyb3RlICgke3BhZ2VzLmxlbmd0aH0pPC9iPjwvc3VtbWFyeT4KICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0iZmxleC13cmFwOndyYXA7Z2FwOjZweDttYXJnaW4tdG9wOjlweCI+CiAgICAgICAke3BhZ2VzLm1hcChmPT5gPGEgY2xhc3M9ImJ0biBzbSIgaHJlZj0iL2FwaS9iaXovZmlsZT9pZD0ke2IuaWR9JmY9JHtlbmNvZGVVUklDb21wb25lbnQoZi5uYW1lKX0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj4ke2VzYyhmLm5hbWUucmVwbGFjZSgnc2l0ZS8nLCcnKSl9PC9hPmApLmpvaW4oJycpfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWxzbyBpbiB0aGUgcGFjazogJHtvdGhlci5tYXAoZj0+ZXNjKGYubmFtZSkpLmpvaW4oJywgJyl9PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxiPnRlcm1zLCBwcml2YWN5LCByZWZ1bmQgYW5kIHNoaXBwaW5nIGFyZSB3cml0dGVuIGluIGNvZGUsIG5vdCBieSB0aGUgbW9kZWwuPC9iPiBMZWdhbCB0ZXh0IGlzIGV4YWN0bHkgd2hlcmUgYSBtYWRlLXVwIHNlbnRlbmNlIGJlY29tZXMgYSBsaWFiaWxpdHksIGFuZCBhIFJhem9ycGF5IEtZQyByZXZpZXdlciByZWFkcyB0aG9zZSBmb3VyIHBhZ2VzIGJlZm9yZSBhcHByb3ZpbmcgYSBzb2xlIHByb3ByaWV0b3IuIEhlIGlzIG5vdCBhbGxvd2VkIHRvIGltcHJvdmlzZSB0aGVtLjwvZGl2PgogICAgIDwvZGV0YWlscz4KCiAgICAgJHtvP2A8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPlRoZSB3b3JkcyB0aGF0IGdldCB0aGUgZmlyc3QgY3VzdG9tZXI8L2I+PC9zdW1tYXJ5PgogICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjVweCI+V0hBVFNBUFAg4oCUIHBhc3RlIGFzIGlzPC9kaXY+CiAgICAgICA8ZGl2IGlkPSJiendfJHtiLmlkfSIgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2JhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moby53aGF0c2FwcHx8JycpfTwvZGl2PgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIHN0eWxlPSJtYXJnaW4tdG9wOjdweCIgb25jbGljaz0iY29weUJpeignYnp3XyR7Yi5pZH0nKSI+Q29weTwvYnV0dG9uPgoKICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE0cHggMCA1cHgiPkVNQUlMIOKAlCBzdWJqZWN0OiAke2VzYygoby5lbWFpbHx8e30pLnN1YmplY3R8fCcnKX08L2Rpdj4KICAgICAgIDxkaXYgaWQ9ImJ6ZV8ke2IuaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7YmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHg7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYygoby5lbWFpbHx8e30pLmJvZHl8fCcnKX08L2Rpdj4KICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiIG9uY2xpY2s9ImNvcHlCaXooJ2J6ZV8ke2IuaWR9JykiPkNvcHk8L2J1dHRvbj4KCiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNHB4IDAgNXB4Ij5XQUxLSU5HIElOVE8gVEhFIFNIT1A8L2Rpdj4KICAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moby5pblBlcnNvbnx8JycpfTwvZGl2PgoKICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE0cHggMCA1cHgiPk5PIFJFUExZIEFGVEVSIDQgREFZUzwvZGl2PgogICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhvLmZvbGxvd1VwfHwnJyl9PC9kaXY+CgogICAgICAgJHsoby5maXJzdFRlblRhcmdldHN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE0cHggMCA1cHgiPlRIRSBGSVJTVCBURU4gVE8gQVBQUk9BQ0g8L2Rpdj4KICAgICAgICA8b2wgc3R5bGU9InBhZGRpbmctbGVmdDoxOXB4O2xpbmUtaGVpZ2h0OjEuNzU7Zm9udC1zaXplOjEzcHgiPiR7KG8uZmlyc3RUZW5UYXJnZXRzfHxbXSkubWFwKHg9PmA8bGk+JHtlc2MoeCl9PC9saT5gKS5qb2luKCcnKX08L29sPmA6Jyd9CiAgICAgICAkeyhvLm9iamVjdGlvbnN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE0cHggMCA1cHgiPldIRU4gVEhFWSBTQVkgTk88L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4keyhvLm9iamVjdGlvbnN8fFtdKS5tYXAoeD0+YDx0cj48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKHgudGhleSl9PC90ZD48dGQ+JHtlc2MoeC55b3UpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonJ30KICAgICAgPC9kaXY+PC9kZXRhaWxzPmA6Jyd9CgogICAgICR7Yi50ZWxsQ291bnQ/YDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlcjtjb2xvcjp2YXIoLS1hbWIpIj48Yj4ke2IudGVsbENvdW50fSBwaHJhc2Uocykgc3RpbGwgcmVhZCBhcyBtYWNoaW5lLXdyaXR0ZW4g4oCUIGZpeCB0aGVzZSBiZWZvcmUgeW91IHNlbmQgaXQ8L2I+PC9zdW1tYXJ5PgogICAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48dGFibGU+PHRib2R5PgogICAgICAgJHsoYi50ZWxsc3x8W10pLm1hcCh0PT5gPHRyPjx0ZCBzdHlsZT0iZm9udC1mYW1pbHk6bW9ub3NwYWNlIj4iJHtlc2ModC5mb3VuZCl9IjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC53aHkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5UaGV5IGFyZSBsaXN0ZWQgaW4gUkVBTE5FU1MtQVVESVQudHh0IGluc2lkZSB0aGUgWklQIHRvby4gT3BlbiB0aGUgSFRNTCwgZmluZCB0aGVtLCBzYXkgaXQgaW4geW91ciBvd24gd29yZHMuPC9kaXY+PC9kZXRhaWxzPmA6Jyd9CgogICAgIDxkZXRhaWxzPjxzdW1tYXJ5IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj5Ib3cgaGUgYnVpbHQgaXQsIHN0ZXAgYnkgc3RlcDwvc3VtbWFyeT4KICAgICAgPGRpdiBjbGFzcz0ibG9nIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPiR7KGIuc3RlcHN8fFtdKS5tYXAocz0+YDxkaXY+PHNwYW4gY2xhc3M9InRzIj4rJHsocy5tcy8xMDAwKS50b0ZpeGVkKDEpfXM8L3NwYW4+ICR7ZXNjKHMucyl9JHtzLm5vdGU/JyDigJQgPGI+Jytlc2Mocy5ub3RlKSsnPC9iPic6Jyd9PC9kaXY+YCkuam9pbignJyl9PC9kaXY+PC9kZXRhaWxzPgoKICAgICA8ZGV0YWlscyAke2IucHVibGlzaGVkPycnOidvcGVuJ30+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5QdXQgaXQgbGl2ZSDigJQgZnJlZSwgYWJvdXQgMyBtaW51dGVzPC9iPjwvc3VtbWFyeT4KICAgICAgPG9sIHN0eWxlPSJtYXJnaW46OXB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuODUiPgogICAgICAgPGxpPjxiPkRPV05MT0FEIFRIRSBaSVA8L2I+IGFib3ZlLCB0aGVuIHVuemlwIGl0LjwvbGk+CiAgICAgICA8bGk+R28gdG8gPGI+YXBwLm5ldGxpZnkuY29tL2Ryb3A8L2I+LiBObyBhY2NvdW50IG5lZWRlZCB0byBzdGFydC48L2xpPgogICAgICAgPGxpPkRyYWcgdGhlIDxiPnNpdGU8L2I+IGZvbGRlciDigJQgbm90IHRoZSB6aXAsIHRoZSBmb2xkZXIgaW5zaWRlIGl0IOKAlCBvbnRvIHRoZSBwYWdlLjwvbGk+CiAgICAgICA8bGk+SXQgaXMgbGl2ZSBpbiBzZWNvbmRzIG9uIGEgZnJlZSBVUkwuIENvcHkgdGhhdCBVUkwuPC9saT4KICAgICAgIDxsaT5QYXN0ZSBpdCBiZWxvdy4gSGUgc3RhcnRzIG1vbml0b3JpbmcgeW91ciBvd24gc2l0ZSBpbW1lZGlhdGVseSwgYW5kIHN0b3BzIGNhbGxpbmcgdGhpcyBidXNpbmVzcyB1bnB1Ymxpc2hlZC48L2xpPgogICAgICAgPGxpPkEgLmluIGRvbWFpbiBpcyBhYm91dCBScyA3MDAveWVhci4gQnV5IGl0IDxpPmFmdGVyPC9pPiB0aGUgZmlyc3QgcGF5aW5nIGNsaWVudCwgbm90IGJlZm9yZS48L2xpPgogICAgICA8L29sPgogICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPgogICAgICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9ImJ6dXJsXyR7Yi5pZH0iIHBsYWNlaG9sZGVyPSJodHRwczovL3lvdXItc2l0ZS5uZXRsaWZ5LmFwcCIgdmFsdWU9IiR7ZXNjKGIucHVibGlzaGVkVXJsfHwnJyl9IiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDoyMDBweCI+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InB1Ymxpc2hCaXooJyR7Yi5pZH0nKSI+SVQgSVMgTElWRTwvYnV0dG9uPjwvZGl2PgogICAgIDwvZGV0YWlscz4KICAgIDwvZGl2PmA7CiAgfSkuam9pbignJyk7Cn07ClJFTkRFUi5mYWN0b3J5PSgpPT5gPGRpdiBkYXRhLWxpdmU9ImZhY3RvcnkiPiR7TElWRS5mYWN0b3J5KCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIGJ1aWxkQml6KCl7CiAgY29uc3QgZz1pZD0+KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCB2PWcoJ2J6VmVudHVyZScpLCBicmllZj1nKCdiekJyaWVmJyk7CiAgaWYoIXYgJiYgIWJyaWVmLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdQaWNrIGEgdmVudHVyZSBvciBkZXNjcmliZSB0aGUgYnVzaW5lc3MnKTsKICBjb25zdCB0b29sPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnpUb29sJyl8fHt9KS5jaGVja2VkIT09ZmFsc2U7CiAgZmxhc2goJ0J1aWxkaW5nIHRoZSB3aG9sZSBidXNpbmVzcyDigJQgMiB0byA0IG1pbnV0ZXMuIERvIG5vdCBjbG9zZSB0aGlzLicpOwogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2Jpei9idWlsZCcse3ZlbnR1cmVJZDp2LGJyaWVmLHBob25lOmcoJ2J6UGhvbmUnKSwKICAgICAgd2hhdHNhcHA6ZygnYnpXYScpLGFkZHJlc3M6ZygnYnpBZGRyJyksZ3N0aW46ZygnYnpHc3QnKSx0b29sfSk7CiAgICByZW5kZXIoKTsKICAgIGZsYXNoKGAiJHtyLm5hbWV9IiBidWlsdCDigJQgJHtyLmZpbGVzfSBmaWxlcywgJHsoci56aXBCeXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQmAKICAgICAgKyAoci50ZWxscz9gLCAke3IudGVsbHN9IHBocmFzZXMgZmxhZ2dlZCBmb3IgeW91ciBlZGl0YDonLCBhdWRpdCBjbGVhbicpKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRlbEJpeihpZCl7IGlmKCFjb25maXJtKCdEZWxldGUgdGhpcyB3aG9sZSBidXNpbmVzcyBwYWNrPycpKXJldHVybjsKICBhd2FpdCBBUEkoJy9hcGkvYml6L2RlbGV0ZScse2lkfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gcHVibGlzaEJpeihpZCl7CiAgY29uc3QgdT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J6dXJsXycraWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF1LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdQYXN0ZSB0aGUgVVJMIE5ldGxpZnkgZ2F2ZSB5b3UnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9iaXovcHVibGlzaGVkJyx7aWQsdXJsOnUudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0xpdmUg4oCUIGFuZCBoZSBpcyBub3cgbW9uaXRvcmluZyBpdCBldmVyeSA1IG1pbnV0ZXMuJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBjb3B5Qml6KGVsKXsgY29uc3Qgbj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbCk7IGlmKCFuKXJldHVybjsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChuLmlubmVyVGV4dCkudGhlbigoKT0+Zmxhc2goJ0NvcGllZCcpLCgpPT5mbGFzaCgnU2VsZWN0IGFuZCBjb3B5IG1hbnVhbGx5JykpIH0KCi8qID09PT09PT09PT09PT09PT09IERPTUFJTiBERVNLID09PT09PT09PT09PT09PT09CiAgIENoZWNraW5nIGlzIGZyZWUgYW5kIGhlIGRvZXMgaXQgbGl2ZS4gUmVnaXN0ZXJpbmcgaXMgbGljZW5zZWQgYW5kIHBhaWQsCiAgIGFuZCBoZSBjYW5ub3QgZG8gaXQuIEJvdGggZmFjdHMgYXJlIHN0YXRlZCBwbGFpbmx5IG9uIHRoZSBwYWdlLiAqLwpmdW5jdGlvbiBkb21Sb3cocil7CiAgY29uc3QgYyA9IHIuc3RhdHVzPT09J0FWQUlMQUJMRScgPyAndC1ncm4nIDogci5zdGF0dXM9PT0nVEFLRU4nID8gJ3QtZGltJwogICAgICAgICAgOiByLnN0YXR1cz09PSdJTlZBTElEJyA/ICd0LW1hZycgOiAndC1hbWInOwogIGNvbnN0IHAgPSByLnByaWNlICYmIHIucHJpY2UuZmlyc3QKICAgID8gYH7igrkke3IucHJpY2UuZmlyc3R9IGZpcnN0IHlyIMK3IOKCuSR7ci5wcmljZS5yZW5ld30gcmVuZXdgIDogJ+KAlCc7CiAgY29uc3QgZGV0YWlsID0gci5zdGF0dXM9PT0nVEFLRU4nCiAgICAgID8gYCR7ci5yZWdpc3RyYXI/ZXNjKHIucmVnaXN0cmFyKToncmVnaXN0cmFyIHVua25vd24nfSR7ci5leHBpcmVzPycgwrcgZXhwaXJlcyAnK1N0cmluZyhyLmV4cGlyZXMpLnNsaWNlKDAsMTApOicnfWAKICAgIDogci5zdGF0dXM9PT0nQVZBSUxBQkxFJyA/ICdmcmVlIHJpZ2h0IG5vdycKICAgIDogZXNjKHIud2h5fHwnY291bGQgbm90IGJlIHJlc29sdmVkJyk7CiAgcmV0dXJuIGA8dHI+PHRkPjxiPiR7ZXNjKHIubmFtZSl9PC9iPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Y30iPiR7ci5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7cH08L3RkPgogICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2RldGFpbH08L3RkPgogICA8dGQ+JHtyLnN0YXR1cz09PSdBVkFJTEFCTEUnfHxyLnN0YXR1cz09PSdUQUtFTicKICAgICA/IGA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9IndhdGNoRG9tKCcke2VzYyhyLm5hbWUpfScpIj5XYXRjaDwvYnV0dG9uPmA6Jyd9PC90ZD48L3RyPmA7Cn0KbGV0IERPTVJFUyA9IFtdOwpMSVZFLmRvbWFpbnM9KCk9PnsKICBjb25zdCBEPVMuZG9tYWluc3x8e3dhdGNoOltdLHJ1bnM6W119LCBXPUQud2F0Y2h8fFtdLCBSPUQucnVuc3x8W107CiAgY29uc3Qgc29vbj1XLmZpbHRlcih4PT57IGlmKCF4LmV4cGlyZXMpIHJldHVybiBmYWxzZTsKICAgIGNvbnN0IGQ9KG5ldyBEYXRlKHguZXhwaXJlcyktRGF0ZS5ub3coKSkvODY0MDAwMDA7IHJldHVybiBkPjAmJmQ8NjA7IH0pOwoKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4peNIERPTUFJTiBERVNLIOKAlCBIRSBDSEVDS1MsIFlPVSBCVVk8L2gzPgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5SZWFkIHRoaXMgYmVmb3JlIHlvdSBwbGFuIGEgZG9tYWluIGJ1c2luZXNzLjwvYj4KICAgIENoZWNraW5nIHdoZXRoZXIgYSBuYW1lIGlzIGZyZWUgaXMgPGI+ZnJlZSwgaW5zdGFudCBhbmQgbmVlZHMgbm9ib2R5J3MgcGVybWlzc2lvbjwvYj4g4oCUIGhlIGRvZXMgaXQgbGl2ZSBhZ2FpbnN0IHRoZSByZWFsIHJlZ2lzdHJ5IHVzaW5nIFJEQVAsIHRoZSBwcm90b2NvbCBJQ0FOTiBmb3JjZXMgZXZlcnkgcmVnaXN0cnkgdG8gcnVuLiBSZWdpc3RlcmluZyBhIG5hbWUgaXMgYSA8Yj5saWNlbnNlZCwgcGFpZCwgS1lDJ2QgYWN0PC9iPi4gSGUgY2Fubm90IGRvIGl0LiBOb3QgIm5vdCB5ZXQiIOKAlCB3cml0aW5nIGludG8gYSByZWdpc3RyeSBuZWVkcyBhbiBFUFAgY3JlZGVudGlhbCBpc3N1ZWQgdG8gYW4gYWNjcmVkaXRlZCByZWdpc3RyYXIsIHBsdXMgbW9uZXkuIEFueW9uZSBjbGFpbWluZyB0aGVpciBBSSByZWdpc3RlcnMgZG9tYWlucyBpcyBlaXRoZXIgcmVzZWxsaW5nIG9yIGx5aW5nLjwvZGl2PgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj5Db25uZWN0IGFuIEFJIGJyYWluIHRvIGhhdmUgaGltIGludmVudCBuYW1lcy4gQ2hlY2tpbmcgd29ya3Mgd2l0aG91dCBvbmUuPC9kaXY+JzonJ30KCiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SGF2ZSBoaW0gaW52ZW50IG5hbWVzIGZvciBhIGJ1c2luZXNzLCB0aGVuIGNoZWNrIGV2ZXJ5IG9uZSBsaXZlPC9zcGFuPgogICAgPGlucHV0IGlkPSJkbUJyaWVmIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHdlYnNpdGUgZG93bnRpbWUgYWxlcnRzIGZvciBMdWRoaWFuYSBob3NpZXJ5IGV4cG9ydGVycyI+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9tU3VnZ2VzdCgpIj5JTlZFTlQgQU5EIENIRUNLIE5BTUVTPC9idXR0b24+CiAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPjE0IG5hbWVzIMOXIDMgZXh0ZW5zaW9ucyA9IDQyIGxpdmUgcmVnaXN0cnkgbG9va3Vwcy4gVGFrZXMgYWJvdXQgMzAgc2Vjb25kcy48L3NwYW4+PC9kaXY+CgogICA8aHIgc3R5bGU9ImJvcmRlcjowO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7bWFyZ2luOjE2cHggMCI+CgogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3IgY2hlY2sgZXhhY3QgbmFtZXMgeW91IGFscmVhZHkgaGF2ZSBpbiBtaW5kPC9zcGFuPgogICAgIDx0ZXh0YXJlYSBpZD0iZG1OYW1lcyIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo2NHB4IiBwbGFjZWhvbGRlcj0ic2FuZGh1d29ya3MuaW4KYmFzYW50dXB0aW1lLmNvbQpnaWxyb2FkbGFicy5jby5pbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PciB0YWtlIG9uZSB3b3JkIGFjcm9zcyBldmVyeSBleHRlbnNpb248L3NwYW4+CiAgICAgPGlucHV0IGlkPSJkbVNsZCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ic2FuZGh1d29ya3MiPgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImRvbUNoZWNrKCkiPkNIRUNLIFRIRSBMSVNUPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZG9tRXhwYW5kKCkiPlNQUkVBRCBPTkUgV09SRDwvYnV0dG9uPjwvZGl2PjwvbGFiZWw+CiAgIDwvZGl2PgoKICAgJHtET01SRVMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6MTRweCI+PHRhYmxlPgogICAgIDx0aGVhZD48dHI+PHRoPk5hbWU8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD5JbmRpY2F0aXZlIHByaWNlPC90aD48dGg+RGV0YWlsPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+CiAgICAgPHRib2R5PiR7RE9NUkVTLm1hcChkb21Sb3cpLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij5QcmljZXMgYXJlIGluZGljYXRpdmUgcmV0YWlsICgke2VzYygoUy5kb21haW5zfHx7fSkucHJpY2VBc09mfHwnJyl9KS4gVmVyaWZ5IGF0IHRoZSByZWdpc3RyYXIgYmVmb3JlIHlvdSBxdW90ZSBhbnlib2R5LjwvZGl2PmA6Jyd9CiAgPC9kaXY+CgogICR7Ui5sZW5ndGg/Ui5tYXAocnVuPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtY3kiPk5BTUVTPC9zcGFuPjxiPiR7ZXNjKHJ1bi5icmllZikuc2xpY2UoMCw3MCl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtydW4udH0gwrcgJHtydW4uY2hlY2tlZH0gbGl2ZSBjaGVja3MgwrcgJHtydW4uYXZhaWxhYmxlfSBhdmFpbGFibGUke3J1bi51bmtub3duPycgwrcgJytydW4udW5rbm93bisnIHVucmVzb2x2ZWQnOicnfTwvc3Bhbj48L2Rpdj4KICAgICR7cnVuLnVua25vd24/YDxkaXYgY2xhc3M9Indhcm5ib3giPiR7cnVuLnVua25vd259IGxvb2t1cChzKSBjb3VsZCBub3QgYmUgcmVzb2x2ZWQuIFRob3NlIGFyZSBzaG93biBhcyBVTktOT1dOIGFuZCBhcmUgPGI+bm90PC9iPiBjb3VudGVkIGFzIGF2YWlsYWJsZSDigJQgYSByZWdpc3RyeSB0aGF0IGRpZCBub3QgYW5zd2VyIGlzIG5vdCB0aGUgc2FtZSBhcyBhIGZyZWUgbmFtZS48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5OYW1lPC90aD48dGg+V2h5PC90aD48dGg+RXh0ZW5zaW9uczwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICAkeyhydW4ucm93c3x8W10pLm1hcChyPT5gPHRyPgogICAgICA8dGQ+PGI+JHtlc2Moci5zbGQpfTwvYj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5yZWdpc3Rlcnx8JycpfTwvZGl2PjwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHIud2h5fHwnJyl9PC90ZD4KICAgICAgPHRkPiR7KHIub3B0aW9uc3x8W10pLm1hcChvPT57CiAgICAgICAgY29uc3QgYz1vLnN0YXR1cz09PSdBVkFJTEFCTEUnPyd0LWdybic6by5zdGF0dXM9PT0nVEFLRU4nPyd0LWRpbSc6J3QtYW1iJzsKICAgICAgICByZXR1cm4gYDxzcGFuIGNsYXNzPSJ0YWcgJHtjfSIgdGl0bGU9IiR7ZXNjKG8ud2h5fHxvLnN0YXR1cyl9Ij4ke2VzYyhvLm5hbWUpfTwvc3Bhbj5gCiAgICAgICAgICArIChvLnN0YXR1cz09PSdBVkFJTEFCTEUnP2AgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ3YXRjaERvbSgnJHtlc2Moby5uYW1lKX0nKSI+d2F0Y2g8L2J1dHRvbj4gYDonICcpOwogICAgICB9KS5qb2luKCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOicnfQoKICAke1cubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8aDMgc3R5bGU9Im1hcmdpbjowIj7il44gV0FUQ0hMSVNUICgke1cubGVuZ3RofSk8L2gzPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZG9tUmVjaGVjaygpIj5SRS1DSEVDSyBBTEwgTk9XPC9idXR0b24+PC9kaXY+CiAgICAke3Nvb24ubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj48Yj4ke3Nvb24ubGVuZ3RofSBleHBpcmluZyB3aXRoaW4gNjAgZGF5cy48L2I+IEEgZG9tYWluIGFib3V0IHRvIGV4cGlyZSBtZWFucyBhbiBvd25lciBhYm91dCB0byBtYWtlIGEgZGVjaXNpb24uIFRoYXQgaXMgdGhlIG1vbWVudCB0byBhcHByb2FjaCB0aGVtIOKAlCBlaXRoZXIgdG8gYnV5IHRoZSBuYW1lLCBvciB0byBzZWxsIHRoZW0gdGhlIHNlcnZpY2UgdGhhdCBrZWVwcyBpdCB3b3JraW5nLjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPk5hbWU8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD5FeHBpcmVzPC90aD48dGg+UmVnaXN0cmFyPC90aD48dGg+Tm90ZTwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICAke1cubWFwKHg9PmA8dHI+CiAgICAgIDx0ZD48Yj4ke2VzYyh4Lm5hbWUpfTwvYj48L3RkPgogICAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke3guc3RhdHVzPT09J0FWQUlMQUJMRSc/J3QtZ3JuJzp4LnN0YXR1cz09PSdUQUtFTic/J3QtZGltJzondC1hbWInfSI+JHt4LnN0YXR1c308L3NwYW4+PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHt4LmV4cGlyZXM/U3RyaW5nKHguZXhwaXJlcykuc2xpY2UoMCwxMCk6J+KAlCd9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoeC5yZWdpc3RyYXJ8fCfigJQnKX08L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh4Lm5vdGV8fCcnKX08L3RkPgogICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJ1bndhdGNoRG9tKCcke2VzYyh4Lm5hbWUpfScpIj7inJU8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5IZSByZS1jaGVja3MgdGhlIHdob2xlIHdhdGNobGlzdCBhdXRvbWF0aWNhbGx5IGFzIGEgc3RhbmRpbmcgb3JkZXIuIElmIGEgbmFtZSB5b3Ugd2FudCBpcyByZWxlYXNlZCwgaXQgYXBwZWFycyBpbiB0aGUgbGVkZ2VyIHRoZSBzYW1lIGRheS48L2Rpdj4KICAgPC9kaXY+YDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPldhdGNobGlzdCBlbXB0eS4gV2F0Y2ggYSBuYW1lIGFuZCBoZSB0cmFja3MgaXQgZm9yIHlvdS48L2Rpdj48L2Rpdj4nfQoKICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgPGgzPlNob3VsZCB5b3UgYmVjb21lIGEgcmVzZWxsZXI/IERvIHRoZSBhcml0aG1ldGljIGZpcnN0LjwvaDM+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDoxODBweCI+PHNwYW4+RG9tYWlucyB5b3UgcmVhbGlzdGljYWxseSBzZWxsIHBlciBtb250aDwvc3Bhbj4KICAgIDxpbnB1dCBpZD0iZG1OIiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IjUiIG1pbj0iMCIgbWF4PSI1MDAiPjwvbGFiZWw+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImRvbU1hdGgoKSIgc3R5bGU9ImFsaWduLXNlbGY6ZW5kO21hcmdpbi1ib3R0b206MTFweCI+V09SSyBJVCBPVVQ8L2J1dHRvbj48L2Rpdj4KICAgPGRpdiBpZD0iZG1NYXRoT3V0Ij48L2Rpdj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iY2FyZCI+CiAgIDxoMz5Ib3cgYSBkb21haW4gYWN0dWFsbHkgY29tZXMgaW50byBleGlzdGVuY2U8L2gzPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5Xcml0dGVuIGludG8gdGhlIHN5c3RlbSBhcyBmYWN0LCBub3QgZ2VuZXJhdGVkLiBGaWd1cmVzIGNoZWNrZWQgQXVndXN0IDIwMjYuPC9kaXY+CiAgIDxwcmUgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2ZvbnQ6MTJweC8xLjY1IHZhcigtLW1vbm8pO2JhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoxNHB4O292ZXJmbG93LXg6YXV0byI+JHtlc2MoKFMuZG9tYWluc3x8e30pLmhvd0l0V29ya3N8fCcnKX08L3ByZT4KICA8L2Rpdj5gOwp9OwpSRU5ERVIuZG9tYWlucz0oKT0+YDxkaXYgZGF0YS1saXZlPSJkb21haW5zIj4ke0xJVkUuZG9tYWlucygpfTwvZGl2PmA7Cgphc3luYyBmdW5jdGlvbiBkb21DaGVjaygpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkbU5hbWVzJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXYudHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgYXQgbGVhc3Qgb25lIG5hbWUnKTsKICBmbGFzaCgnQ2hlY2tpbmcgYWdhaW5zdCB0aGUgbGl2ZSByZWdpc3RyaWVz4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb20vY2hlY2snLHtuYW1lczp2fSk7CiAgICBET01SRVM9ci5yZXN1bHRzOyByZW5kZXIoKTsKICAgIGZsYXNoKGAke3IucmVzdWx0cy5maWx0ZXIoeD0+eC5zdGF0dXM9PT0nQVZBSUxBQkxFJykubGVuZ3RofSBvZiAke3IucmVzdWx0cy5sZW5ndGh9IGF2YWlsYWJsZWApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9tRXhwYW5kKCl7CiAgY29uc3Qgdj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RtU2xkJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXYudHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgb25lIHdvcmQnKTsKICBmbGFzaCgnU3ByZWFkaW5nIGl0IGFjcm9zcyBleHRlbnNpb25z4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb20vZXhwYW5kJyx7c2xkOnZ9KTsKICAgIERPTVJFUz1yLnJlc3VsdHM7IHJlbmRlcigpOwogICAgZmxhc2goYCR7ci5yZXN1bHRzLmZpbHRlcih4PT54LnN0YXR1cz09PSdBVkFJTEFCTEUnKS5sZW5ndGh9IG9mICR7ci5yZXN1bHRzLmxlbmd0aH0gYXZhaWxhYmxlYCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkb21TdWdnZXN0KCl7CiAgY29uc3Qgdj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RtQnJpZWYnKXx8e30pLnZhbHVlfHwnJzsKICBpZighdi50cmltKCkpIHJldHVybiBmbGFzaCgnRGVzY3JpYmUgdGhlIGJ1c2luZXNzIGZpcnN0Jyk7CiAgZmxhc2goJ0ludmVudGluZyBuYW1lcywgdGhlbiBjaGVja2luZyBldmVyeSBvbmUgbGl2ZS4gQWJvdXQgMzAgc2Vjb25kc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9tL3N1Z2dlc3QnLHticmllZjp2fSk7CiAgICBET01SRVM9W107IHJlbmRlcigpOwogICAgZmxhc2goYCR7ci5hdmFpbGFibGV9IG9mICR7ci5jaGVja2VkfSBhdmFpbGFibGVgKyhyLnVua25vd24/YCDCtyAke3IudW5rbm93bn0gdW5yZXNvbHZlZGA6JycpKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHdhdGNoRG9tKG5hbWUpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2RvbS93YXRjaCcse25hbWV9KTsgcmVuZGVyKCk7IGZsYXNoKCdXYXRjaGluZyAnK25hbWUpIH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gdW53YXRjaERvbShuYW1lKXsgYXdhaXQgQVBJKCcvYXBpL2RvbS91bndhdGNoJyx7bmFtZX0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIGRvbVJlY2hlY2soKXsKICBmbGFzaCgnUmUtY2hlY2tpbmcgdGhlIHdob2xlIHdhdGNobGlzdOKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9tL3JlY2hlY2snLHt9KTsgcmVuZGVyKCk7IGZsYXNoKHIubXNnKycg4oCUICcrKHIuZGV0YWlsfHwnJykpIH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9tTWF0aCgpewogIGNvbnN0IG49KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkbU4nKXx8e30pLnZhbHVlfHwwOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9tL21hdGgnLHtwZXJNb250aDpufSk7CiAgICBjb25zdCBtPXIubWF0aDsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkbU1hdGhPdXQnKS5pbm5lckhUTUw9CiAgICAgYDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjIwMHB4Ij5NYXJnaW4gcGVyIC5pbiBkb21haW48L3RkPjx0ZD7igrkke20ubWFyZ2luRWFjaH0gKOKCuTk1MCByZXRhaWwg4oiSIOKCuTYyMCB3aG9sZXNhbGUpPC90ZD48L3RyPgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UHJvZml0IGF0ICR7bS5wZXJNb250aH0vbW9udGg8L3RkPjx0ZD48Yj7igrkke20ueWVhclByb2ZpdC50b0xvY2FsZVN0cmluZygnZW4tSU4nKX0gcGVyIHllYXI8L2I+PC90ZD48L3RyPgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UmVzZWxsZXIgc2V0dXAgY29zdDwvdGQ+PHRkPuKCuSR7bS5zZXR1cC50b0xvY2FsZVN0cmluZygnZW4tSU4nKX0gb25lLXRpbWU8L3RkPjwvdHI+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CcmVhay1ldmVuPC90ZD48dGQ+JHttLmJyZWFrRXZlbkRvbWFpbnN9IGRvbWFpbnMgc29sZDwvdGQ+PC90cj4KICAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+JHtlc2MobS52ZXJkaWN0KX08L2Rpdj5gOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KCi8qID09PT09PT09PT09PT09PT09IEdST1dUSCBFTkdJTkUgPT09PT09PT09PT09PT09PT0gKi8KTElWRS5ncm93dGg9KCk9PnsKICBjb25zdCBDPVMuY2FtcGFpZ25zfHxbXSwgQj1TLmJ1c2luZXNzZXN8fFtdLCBPPVMub3V0cmVhY2h8fFtdLCBDSD1TLmNoYW5uZWxzfHx7fTsKICBjb25zdCBzbXRwPShTLnRlbGVtZXRyeXx8e30pLnNtdHBfcmVhZHk7CiAgY29uc3QgY2hSb3dzPU9iamVjdC52YWx1ZXMoQ0gpLm1hcChjPT5gPHRyPgogICAgPHRkPjxiPiR7ZXNjKGMubGFiZWwpfTwvYj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtjLmF1dG8/KGMuaWQ9PT0nZW1haWwnJiYhc210cD8ndC1hbWInOid0LWdybicpOid0LWRpbSd9Ij4kewogICAgICBjLmF1dG8/KGMuaWQ9PT0nZW1haWwnJiYhc210cD8nQkxPQ0tFRCc6J0hFIFNFTkRTIElUJyk6J1lPVSBTRU5EIElUJ308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMudHJ1dGgpfTwvdGQ+PC90cj5gKS5qb2luKCcnKTsKCiAgY29uc3QgaGVhZD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7inqQgR1JPV1RIIEVOR0lORSDigJQgSEUgUExBTlMgSVQsIFlPVSBUSUNLIE9OQ0U8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIHBsYW5zIGEgdHdvLXdlZWsgY2FtcGFpZ24gdG8gZ2V0IHRoZSA8Yj5maXJzdCBwYXlpbmcgY3VzdG9tZXI8L2I+LCB3cml0ZXMgZXZlcnkgbWVzc2FnZSBpbiBmaW5pc2hlZCBmb3JtLCB0aGVuIGV4ZWN1dGVzIGV2ZXJ5dGhpbmcgaGUgbGVnYWxseSBjYW4gYW5kIHB1dHMgdGhlIHJlc3Qgb24geW91ciBkZXNrIHdpdGggdGhlIHdvcmRzIGFscmVhZHkgd3JpdHRlbi48L2Rpdj4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+V2hhdCBoZSBjYW4gYW5kIGNhbm5vdCBzZW5kIOKAlCByZWFkIHRoaXMgb25jZS48L2I+IEVtYWlsIGlzIGdlbnVpbmVseSBhdXRvbWF0aWMgdGhyb3VnaCB5b3VyIG93biBHbWFpbC4gRXZlcnl0aGluZyBlbHNlIGlzIGEgbGllIHdoZW4gYW55b25lIGNsYWltcyB0byBhdXRvbWF0ZSBpdCBmb3IgZnJlZTogdGhlIGNvbnN1bWVyIFdoYXRzQXBwIGFwcCBoYXMgPGI+bm8gQVBJPC9iPiBhbmQgdW5vZmZpY2lhbCBhdXRvbWF0aW9uIGdldHMgeW91ciBudW1iZXIgPGI+YmFubmVkPC9iPjsgSW5zdGFncmFtIGFuZCBGYWNlYm9vayBuZWVkIGEgTWV0YSBhcHAgYW5kIE9BdXRoOyBYIGNoYXJnZXMgZm9yIHdyaXRlIGFjY2VzczsgYSBHb29nbGUgQnVzaW5lc3MgUHJvZmlsZSBuZWVkcyBwb3N0Y2FyZCBvciBwaG9uZSB2ZXJpZmljYXRpb24gYXQgeW91ciByZWFsIGFkZHJlc3MuIEhlIHdyaXRlcyBpdCBhbGwuIFlvdSB0YXAgc2VuZC48L2Rpdj4KICAgJHshc210cD8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48Yj5TTVRQIGlzIG5vdCBhcm1lZDwvYj4sIHNvIGhlIGNhbiBzZW5kIE5PVEhJTkcgaGltc2VsZiBcdTIwMTQgZXZlcnkgYWN0aW9uIGJlY29tZXMgYSBtYW51YWwgam9iLiBTZXQgYSBHbWFpbCBhcHAgcGFzc3dvcmQgaW4gTWFpbCBSZWxheSBhbmQgaGUgc3RhcnRzIGFjdHVhbGx5IHNlbmRpbmcuPC9kaXY+JzonJ30KICAgJHtzbXRwJiYhUy5zbXRwVmVyaWZpZWQ/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+PGI+TWFpbCBpcyBjb25maWd1cmVkIGJ1dCBuZXZlciBwcm92ZW4uPC9iPiBIZSB3aWxsIHJlZnVzZSB0byBydW4gYW4gZW1haWwgY2FtcGFpZ24gdW50aWwgdGhlIHByZWZsaWdodCBwYXNzZXMgXHUyMDE0IGJlY2F1c2UgYSBjYW1wYWlnbiB0aGF0IHNpbGVudGx5IGZhaWxzIG9uIGV2ZXJ5IHNlbmQgaXMgd29yc2UgdGhhbiBvbmUgdGhhdCBuZXZlciByYW4uIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZ28oJ21haWwnKSI+UnVuIHRoZSBwcmVmbGlnaHQ8L2J1dHRvbj48L2Rpdj5gOicnfQogICAke1Muc210cFZlcmlmaWVkP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj48Yj5NYWlsIHByb3ZlbiBhZ2FpbnN0IHRoZSByZWFsIHNlcnZlcjwvYj4gJHtlc2MoUy5zbXRwVmVyaWZpZWQuYXQpfSBcdTIwMTQgc2VuZGluZyBhcyAke2VzYyhTLnNtdHBWZXJpZmllZC5mcm9tKX0uJHtTLnNlbmRXaW5kb3c/YCAke1Muc2VuZFdpbmRvdy5sZWZ0fSBvZiAke1Muc2VuZFdpbmRvdy5jYXB9IHNlbmRzIGxlZnQgaW4gdGhpcyAyNC1ob3VyIHdpbmRvdy5gOicnfTwvZGl2PmA6Jyd9CiAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luOjEycHggMCI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPkNoYW5uZWw8L3RoPjx0aD5XaG8gc2VuZHM8L3RoPjx0aD5UaGUgdHJ1dGg8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+JHtjaFJvd3N9PC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAkeyFCLmxlbmd0aD8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj5CdWlsZCBhIGJ1c2luZXNzIGZpcnN0IOKAlCB0aGVyZSBpcyBub3RoaW5nIHRvIG1hcmtldC48L2Rpdj4nOmAKICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNhbXBhaWduIGZvciB3aGljaCBidXNpbmVzczwvc3Bhbj4KICAgICA8c2VsZWN0IGlkPSJnd0JpeiIgY2xhc3M9ImluIj4ke0IubWFwKHg9PmA8b3B0aW9uIHZhbHVlPSIke3guaWR9Ij4ke2VzYyh4Lm5hbWUpfSR7eC5wdWJsaXNoZWQ/Jyc6JyAoTk9UIFBVQkxJU0hFRCknfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkdvYWwgKGxlYXZlIGJsYW5rIGZvcjogZmlyc3QgcGF5aW5nIGN1c3RvbWVyKTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9Imd3R29hbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZmlyc3QgcGF5aW5nIGN1c3RvbWVyIj48L2xhYmVsPjwvZGl2PgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icGxhbkNhbXAoKSI+UExBTiBUSEUgQ0FNUEFJR048L2J1dHRvbj5gfQogIDwvZGl2PmA7CgogIGNvbnN0IG91dGI9Ty5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGgzPuKXiCBBQ1RVQUxMWSBTRU5UICgke08ubGVuZ3RofSk8L2gzPgogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+VG88L3RoPjx0aD5TdWJqZWN0PC90aD48dGg+UmVwbHk/PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtPLnNsaWNlKDAsMjApLm1hcCh4PT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7eC50fTwvdGQ+PHRkPiR7ZXNjKHgudG8pfTwvdGQ+CiAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoeC5zdWJqZWN0fHwnJyl9PC90ZD4KICAgICA8dGQ+JHt4LnJlcGxpZWQ/JzxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPlJFUExJRUQ8L3NwYW4+JzpgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJtYXJrUmVwbGllZCgnJHtlc2MoeC50byl9JywnJHt4LnR9JykiPm1hcmsgcmVwbGllZDwvYnV0dG9uPmB9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmA6Jyc7CgogIGlmKCFDLmxlbmd0aCkgcmV0dXJuIGhlYWQrb3V0YisnPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIGNhbXBhaWduIHlldC48L2Rpdj48L2Rpdj4nOwoKICByZXR1cm4gaGVhZCArIEMubWFwKGM9PnsKICAgIGNvbnN0IGJ5RGF5PXt9OyAoYy5hY3Rpb25zfHxbXSkuZm9yRWFjaChhPT57IChieURheVthLmRheV09YnlEYXlbYS5kYXldfHxbXSkucHVzaChhKSB9KTsKICAgIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjdweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7Yy5zdGF0dXM9PT0nQUNUSVZFJz8ndC1ncm4nOmMuc3RhdHVzPT09J1JVTk5JTkcnPyd0LWFtYic6J3QtY3knfSI+JHtjLnN0YXR1c308L3NwYW4+CiAgICAgIDxiIHN0eWxlPSJmb250LXNpemU6MTVweCI+JHtlc2MoYy5uYW1lKX08L2I+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLmJpek5hbWV8fCcnKX08L3NwYW4+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2MudH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+JHtlc2MoYy50aGVzaXMpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+Rmlyc3QgY3VzdG9tZXIgYnk8L3RkPjx0ZD4ke2VzYyhjLmZpcnN0Q3VzdG9tZXJCeXx8J+KAlCcpfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U3RvcCBpdCBpZjwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke2VzYyhjLmtpbGxDcml0ZXJpYXx8J+KAlCcpfTwvdGQ+PC90cj4KICAgICAke2Muc3RhdHVzIT09J0RSQUZUJz9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlJlc3VsdDwvdGQ+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4ke2Muc2VudH0gYWN0dWFsbHkgc2VudDwvYj4gwrcgJHtjLnBhcmtlZH0gb24geW91ciBkZXNrJHtjLmZhaWxlZD9gIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2MuZmFpbGVkfSBmYWlsZWQ8L3NwYW4+YDonJ308L3RkPjwvdHI+YDonJ30KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KCiAgICAke2Muc3RhdHVzPT09J0RSQUZUJz9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgICAgIDxiPk9uZSB0aWNrIHJ1bnMgdGhlIHdob2xlIHRoaW5nLjwvYj4gSGUgd2lsbCBzZW5kICR7Yy5hdXRvQ291bnR9IG1lc3NhZ2UocykgaGltc2VsZiBhcyByZWFsIGVtYWlsLCBhbmQgcHV0IHRoZSBvdGhlciAkeyhjLmFjdGlvbnN8fFtdKS5sZW5ndGgtYy5hdXRvQ291bnR9IG9uIHlvdXIgZGVzayB3aXRoIHRoZSBleGFjdCB3b3JkcyByZWFkeSB0byBjb3B5LiBOb3RoaW5nIGdvZXMgb3V0IHVudGlsIHlvdSBwcmVzcyB0aGlzLjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJydW5DYW1wKCcke2MuaWR9JykiPuKclCBBUFBST1ZFIOKAlCBSVU4gSVQ8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWxDYW1wKCcke2MuaWR9JykiPuKclSBEaXNjYXJkPC9idXR0b24+PC9kaXY+YAogICAgIDpgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxDYW1wKCcke2MuaWR9JykiPkRlbGV0ZSBjYW1wYWlnbjwvYnV0dG9uPmB9CgogICAgPGRldGFpbHMgc3R5bGU9Im1hcmdpbi10b3A6MTFweCIgJHtjLnN0YXR1cz09PSdEUkFGVCc/J29wZW4nOicnfT48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPkV2ZXJ5IGFjdGlvbiwgaW4gb3JkZXIgKCR7KGMuYWN0aW9uc3x8W10pLmxlbmd0aH0pPC9iPjwvc3VtbWFyeT4KICAgICAke09iamVjdC5rZXlzKGJ5RGF5KS5zb3J0KChhLGIpPT5hLWIpLm1hcChkPT5gCiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjEzcHggMCA2cHgiPkRBWSAke2R9PC9kaXY+CiAgICAgICR7YnlEYXlbZF0ubWFwKGE9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHthLnN0YXR1cz09PSdTRU5UJz8ndmFyKC0tZ3JuKSc6YS5hdXRvPyd2YXIoLS1saW1lKSc6J3ZhcigtLXN0cm9rZTIpJ307cGFkZGluZy1sZWZ0OjEycHg7bWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2ZsZXgtd3JhcDp3cmFwIj4KICAgICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHthLmF1dG8/J3QtZ3JuJzondC1kaW0nfSI+JHsoQ0hbYS5jaGFubmVsXXx8e30pLmxhYmVsfHxhLmNoYW5uZWx9PC9zcGFuPgogICAgICAgICA8Yj4ke2VzYyhhLnRpdGxlKX08L2I+CiAgICAgICAgICR7YS5zdGF0dXM9PT0nU0VOVCc/JzxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPlNFTlQgJytlc2MoYS5zZW50QXR8fCcnKSsnPC9zcGFuPic6Jyd9CiAgICAgICAgICR7YS5zdGF0dXM9PT0nTkVFRFNfQUREUkVTUyc/JzxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPk5FRURTIEFOIEFERFJFU1M8L3NwYW4+JzonJ30KICAgICAgICAgJHthLnN0YXR1cz09PSdGQUlMRUQnPyc8c3BhbiBjbGFzcz0idGFnIHQtbWFnIj5GQUlMRUQ8L3NwYW4+JzonJ30KICAgICAgICAgJHthLnN0YXR1cz09PSdPTl9ZT1VSX0RFU0snPyc8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5PTiBZT1VSIERFU0s8L3NwYW4+JzonJ308L2Rpdj4KICAgICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPn4ke2EubWludXRlc30gbWluPC9zcGFuPjwvZGl2PgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46NHB4IDAgNnB4Ij4ke2VzYyhhLndoeSl9PC9kaXY+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5UbzogJHtlc2MoYS50YXJnZXR8fCfigJQnKX08L2Rpdj4KICAgICAgICR7YS5yZXN1bHQ/YDxkaXYgY2xhc3M9Indhcm5ib3giPiR7ZXNjKGEucmVzdWx0KX08L2Rpdj5gOicnfQogICAgICAgJHthLnN0YXR1cz09PSdORUVEU19BRERSRVNTJz9gPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPgogICAgICAgICA8aW5wdXQgY2xhc3M9ImluIiBpZD0iYWRyXyR7YS5pZH0iIHBsYWNlaG9sZGVyPSJ0aGVpckBlbWFpbC5jb20iIHN0eWxlPSJtYXgtd2lkdGg6MjQwcHgiPgogICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImZpbGxBZGRyKCcke2MuaWR9JywnJHthLmlkfScpIj5TRU5EIElUIE5PVzwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICAgICAke2EuY29udGVudD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHgiPgogICAgICAgICAke2Euc3ViamVjdD9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjVweCI+U1VCSkVDVDogJHtlc2MoYS5zdWJqZWN0KX08L2Rpdj5gOicnfQogICAgICAgICA8ZGl2IGlkPSJjbnRfJHthLmlkfSIgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MoYS5jb250ZW50KX08L2Rpdj4KICAgICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9ImNvcHlCaXooJ2NudF8ke2EuaWR9JykiPkNvcHk8L2J1dHRvbj4KICAgICAgICAgICR7YS5jaGFubmVsPT09J3doYXRzYXBwJz9gPGEgY2xhc3M9ImJ0biBzbSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiIGhyZWY9Imh0dHBzOi8vd2EubWUvP3RleHQ9JHtlbmNvZGVVUklDb21wb25lbnQoYS5jb250ZW50KX0iPk9wZW4gaW4gV2hhdHNBcHAg4oaXPC9hPmA6Jyd9CiAgICAgICAgIDwvZGl2PjwvZGl2PmA6Jyd9CiAgICAgIDwvZGl2PmApLmpvaW4oJycpfWApLmpvaW4oJycpfQogICAgPC9kZXRhaWxzPgoKICAgICR7KGMudGFyZ2V0c3x8W10pLmxlbmd0aD9gPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5XaG8gdG8gYXBwcm9hY2ggKCR7Yy50YXJnZXRzLmxlbmd0aH0pPC9iPjwvc3VtbWFyeT4KICAgICA8b2wgc3R5bGU9InBhZGRpbmctbGVmdDoxOXB4O2xpbmUtaGVpZ2h0OjEuODtmb250LXNpemU6MTNweDttYXJnaW4tdG9wOjhweCI+JHtjLnRhcmdldHMubWFwKHQ9PmA8bGk+JHtlc2ModCl9PC9saT5gKS5qb2luKCcnKX08L29sPjwvZGV0YWlscz5gOicnfQogICAgJHsoYy5pbWFnZUJyaWVmc3x8W10pLmxlbmd0aD9gPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5JbWFnZSBicmllZnMgKCR7Yy5pbWFnZUJyaWVmcy5sZW5ndGh9KTwvYj48L3N1bW1hcnk+CiAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5IZSBoYXMgPGI+bm8gaW1hZ2Ugb3IgdmlkZW8gbW9kZWw8L2I+LiBUaGVzZSBhcmUgYnJpZWZzIHRvIHBhc3RlIGludG8gYSBmcmVlIHRvb2wg4oCUIENhbnZhLCBCaW5nIEltYWdlIENyZWF0b3IsIG9yIEdvb2dsZSBXaGlzay4gSGUgd2lsbCBub3QgcHJldGVuZCB0byBoYXZlIGRyYXduIHRoZW0uPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+JHtjLmltYWdlQnJpZWZzLm1hcChpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+JHtlc2MoaS5mb3J8fCcnKX08L3RkPgogICAgICA8dGQ+JHtlc2MoaS5icmllZnx8JycpfSR7aS50ZXh0P2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij5UZXh0IG9uIGltYWdlOiAiJHtlc2MoaS50ZXh0KX0iPC9kaXY+YDonJ308L3RkPjwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGV0YWlscz5gOicnfQogICAgJHtjLndlZWtUd28/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48Yj5XZWVrIHR3bzo8L2I+ICR7ZXNjKGMud2Vla1R3byl9PC9kaXY+YDonJ30KICAgPC9kaXY+YDsKICB9KS5qb2luKCcnKSArIG91dGI7Cn07ClJFTkRFUi5ncm93dGg9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iZ3Jvd3RoIj4ke0xJVkUuZ3Jvd3RoKCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIHBsYW5DYW1wKCl7CiAgY29uc3QgYml6PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ3dCaXonKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCBnb2FsPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ3dHb2FsJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIWJpeikgcmV0dXJuIGZsYXNoKCdQaWNrIGEgYnVzaW5lc3MnKTsKICBmbGFzaCgnUGxhbm5pbmcgdGhlIGNhbXBhaWduIGFuZCB3cml0aW5nIGV2ZXJ5IG1lc3NhZ2XigKYgYWJvdXQgYSBtaW51dGUuJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ncm93dGgvcGxhbicse2JpeklkOmJpeixnb2FsfSk7CiAgICByZW5kZXIoKTsgZmxhc2goYCR7ci5hY3Rpb25zfSBhY3Rpb25zIHBsYW5uZWQg4oCUIGhlIGNhbiBzZW5kICR7ci5hdXRvfSBoaW1zZWxmLmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcnVuQ2FtcChpZCl7CiAgaWYoIWNvbmZpcm0oJ0FwcHJvdmUgdGhpcyBjYW1wYWlnbj8gSGUgd2lsbCBzZW5kIHJlYWwgZW1haWwgdG8gcmVhbCBwZW9wbGUuIFRoaXMgY2Fubm90IGJlIHVuc2VudC4nKSkgcmV0dXJuOwogIGZsYXNoKCdSdW5uaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ncm93dGgvcnVuJyx7aWR9KTsKICAgIHJlbmRlcigpOyBmbGFzaChgJHtyLnNlbnR9IGFjdHVhbGx5IHNlbnQgwrcgJHtyLnBhcmtlZH0gb24geW91ciBkZXNrJHtyLmZhaWxlZD8nIMK3ICcrci5mYWlsZWQrJyBmYWlsZWQnOicnfWApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZGVsQ2FtcChpZCl7IGlmKCFjb25maXJtKCdEZWxldGUgdGhpcyBjYW1wYWlnbiBhbmQgaXRzIGpvYnM/JykpcmV0dXJuOwogIGF3YWl0IEFQSSgnL2FwaS9ncm93dGgvZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBmaWxsQWRkcihjYW1wSWQsYWN0aW9uSWQpewogIGNvbnN0IGVtYWlsPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWRyXycrYWN0aW9uSWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKCFlbWFpbC50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSB0aGUgYWRkcmVzcycpOwogIGZsYXNoKCdTZW5kaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ncm93dGgvYWRkcmVzcycse2NhbXBJZCxhY3Rpb25JZCxlbWFpbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdTZW50IHRvICcrci50byk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBtYXJrUmVwbGllZCh0byx0KXsgYXdhaXQgQVBJKCcvYXBpL2dyb3d0aC9yZXBsaWVkJyx7dG8sdH0pOyByZW5kZXIoKSB9CgovKiA9PT09PT09PT09PT09PT09PSBTVE9SQUdFIEhFQUxUSCA9PT09PT09PT09PT09PT09PSAqLwpMSVZFLnN0b3JhZ2U9KCk9PnsKICBjb25zdCBoPVMuc3RvcmFnZXx8e307CiAgY29uc3QgY29sPWgubGV2ZWw9PT0nQ1JJVCc/J3ZhcigtLW1hZyknOmgubGV2ZWw9PT0nV0FSTic/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJzsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtjb2x9Ij4KICAgPGgzIHN0eWxlPSJjb2xvcjoke2NvbH0iPiR7aC5sZXZlbD09PSdPSyc/J+KclCc6J+KaoCd9IFNUT1JBR0Ug4oCUICR7ZXNjKGguZGVzY3JpYmV8fCd1bmtub3duJyl9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke2VzYyhoLm1zZ3x8JycpfTwvZGl2PgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPk1vZGU8L3RkPjx0ZD4ke2VzYyhoLm1vZGV8fCc/Jyl9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlN0YXRlIHNpemU8L3RkPjx0ZD4keygoaC5ieXRlc3x8MCkvMTAyNCkudG9GaXhlZCgwKX0gS0IgcmF3IMK3ICR7KChoLmVuY29kZWR8fDApLzEwMjQpLnRvRml4ZWQoMCl9IEtCIGVuY29kZWQke2gubW9kZT09PSdnaXRodWInPycgKEdpdEh1YiByZXdyaXRlcyBhbGwgb2YgaXQgZXZlcnkgc2F2ZSknOicnfTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MYXN0IHNhdmU8L3RkPjx0ZD4ke2gubGFzdFNhdmVPaz09PW51bGw/J25vdCB5ZXQnOmgubGFzdFNhdmVPaz9gPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPk9LIGF0ICR7ZXNjKGgubGFzdFNhdmVBdHx8JycpfTwvc3Bhbj5gOmA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+RkFJTEVEIOKAlCAke2VzYyhoLmxhc3RTYXZlRXJyfHwnJyl9PC9zcGFuPmB9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJ1c2luZXNzIHBhY2tzPC90ZD48dGQ+JHtoLmJsb2JzQ2FjaGVkfHwwfSBjYWNoZWQgb3V0LW9mLWJhbmQgKGNvbXByZXNzZWQsIG5vdCBpbiBkYXRhLmpzb24pPC90ZD48L3RyPgogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InN0b3JlVGVzdCgpIj5SVU4gVEhFIFNFTEYtVEVTVDwvYnV0dG9uPgogICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5Xcml0ZXMgYSBmaWxlLCByZWFkcyBpdCBiYWNrLCBjb21wYXJlcyBieXRlLWZvci1ieXRlLCBkZWxldGVzIGl0LiBQcm9vZiwgbm90IGEgZ3Vlc3MuPC9zcGFuPjwvZGl2PgogICA8ZGl2IGlkPSJzdE91dCIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PC9kaXY+CiAgPC9kaXY+CiAgJHtoLmVwaGVtZXJhbD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5GSVggSVQg4oCUIDYgTUlOVVRFUywgRlJFRSwgUEVSTUFORU5UPC9oMz4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+UmVuZGVyJ3MgZnJlZSB0aWVyIGdpdmVzIHlvdSA8Yj5ubyBkaXNrPC9iPi4gRXZlcnkgcmVzdGFydCBhbmQgZXZlcnkgcmVkZXBsb3kgZGVzdHJveXMgZXZlcnl0aGluZyDigJQgYW5kIGZyZWUgc2VydmljZXMgcmVzdGFydCBvbiB0aGVpciBvd24uIEEgcHJpdmF0ZSBHaXRIdWIgcmVwbyBiZWNvbWVzIHRoZSBkaXNrIGluc3RlYWQuIEl0IGlzIGZyZWUsIHVubGltaXRlZCBmb3IgdGhpcywgYW5kIHN1cnZpdmVzIGV2ZXJ5dGhpbmcuPC9kaXY+CiAgIDxvbCBzdHlsZT0icGFkZGluZy1sZWZ0OjE5cHg7bGluZS1oZWlnaHQ6Mjtmb250LXNpemU6MTMuNXB4Ij4KICAgIDxsaT5HbyB0byA8Yj5naXRodWIuY29tL25ldzwvYj4uIE5hbWUgaXQgPGNvZGU+Y2hhaXJtYW5zdGF0ZTwvY29kZT4uIFRpY2sgPGI+UHJpdmF0ZTwvYj4uIFRpY2sgPGI+QWRkIGEgUkVBRE1FPC9iPiDigJQgdGhlIHJlcG8gbXVzdCBub3QgYmUgZW1wdHkuIENyZWF0ZSBpdC48L2xpPgogICAgPGxpPkdvIHRvIDxiPmdpdGh1Yi5jb20vc2V0dGluZ3MvcGVyc29uYWwtYWNjZXNzLXRva2Vucy9uZXc8L2I+IChGaW5lLWdyYWluZWQgdG9rZW5zKS48L2xpPgogICAgPGxpPlRva2VuIG5hbWU6IDxjb2RlPmNoYWlybWFuPC9jb2RlPi4gRXhwaXJhdGlvbjogPGI+Tm8gZXhwaXJhdGlvbjwvYj4g4oCUIGlmIGl0IGV4cGlyZXMgeW91ciBzeXN0ZW0gc2lsZW50bHkgc3RvcHMgc2F2aW5nLjwvbGk+CiAgICA8bGk+UmVwb3NpdG9yeSBhY2Nlc3M6IDxiPk9ubHkgc2VsZWN0IHJlcG9zaXRvcmllczwvYj4g4oaSIHBpY2sgPGNvZGU+Y2hhaXJtYW5zdGF0ZTwvY29kZT4gYW5kIG5vdGhpbmcgZWxzZS48L2xpPgogICAgPGxpPlBlcm1pc3Npb25zIOKGkiBSZXBvc2l0b3J5IHBlcm1pc3Npb25zIOKGkiA8Yj5Db250ZW50czwvYj4g4oaSIHNldCB0byA8Yj5SZWFkIGFuZCB3cml0ZTwvYj4uIFRoYXQgb25lIHBlcm1pc3Npb24gb25seS48L2xpPgogICAgPGxpPkdlbmVyYXRlLCB0aGVuIGNvcHkgdGhlIHRva2VuLiBJdCBzdGFydHMgPGNvZGU+Z2l0aHViX3BhdF88L2NvZGU+LiBZb3UgY2Fubm90IHNlZSBpdCBhZ2Fpbi48L2xpPgogICAgPGxpPkluIFJlbmRlciDihpIgeW91ciBzZXJ2aWNlIOKGkiA8Yj5FbnZpcm9ubWVudDwvYj4g4oaSIGFkZCB0aHJlZSB2YXJpYWJsZXM6CiAgICAgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHg7bWFyZ2luOjdweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZToxMnB4O2xpbmUtaGVpZ2h0OjEuOSI+CiAgICAgIFNUT1JFID0gZ2l0aHViPGJyPkdIX1JFUE8gPSA8aT55b3VydXNlcm5hbWU8L2k+L2NoYWlybWFuc3RhdGU8YnI+R0hfVE9LRU4gPSBnaXRodWJfcGF0X+KApjwvZGl2PjwvbGk+CiAgICA8bGk+U2F2ZS4gUmVuZGVyIHJlZGVwbG95cyBhdXRvbWF0aWNhbGx5LiBMb2cgaW4gaGVyZSBhbmQgcHJlc3MgPGI+UlVOIFRIRSBTRUxGLVRFU1Q8L2I+IGFib3ZlLjwvbGk+CiAgIDwvb2w+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tYW1iKSI+PGI+VGhlIHJlcG8gbXVzdCBiZSBQUklWQVRFLjwvYj4gWW91ciBzdGF0ZSBmaWxlIGhvbGRzIEFQSSBrZXlzLCB5b3VyIFNNVFAgcGFzc3dvcmQgYW5kIGNsaWVudCBkYXRhLiBUaGUgc2VsZi10ZXN0IHJlZnVzZXMgdG8gcGFzcyBpZiB0aGUgcmVwbyBpcyBwdWJsaWMuPC9kaXY+CiAgPC9kaXY+YDonJ31gOwp9OwpSRU5ERVIuc3RvcmFnZT0oKT0+YDxkaXYgZGF0YS1saXZlPSJzdG9yYWdlIj4ke0xJVkUuc3RvcmFnZSgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHN0b3JlVGVzdCgpewogIGNvbnN0IG89ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0T3V0Jyk7IG8uaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+UnVubmluZyBhIHJlYWwgcm91bmQgdHJpcOKApjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zdG9yZS90ZXN0Jyx7fSk7CiAgICBvLmlubmVySFRNTD1gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+JHsoci5zdGVwc3x8W10pLm1hcChzPT4KICAgICAgYDx0cj48dGQgc3R5bGU9IndpZHRoOjMwcHgiPiR7cy5vaz8nPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPuKclDwvc3Bhbj4nOic8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4pyVPC9zcGFuPid9PC90ZD4KICAgICAgIDx0ZD4ke2VzYyhzLnN0ZXApfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2Mocy5kZXRhaWx8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4O2JvcmRlci1jb2xvcjoke3Iub2s/J3ZhcigtLWxpbWUpJzondmFyKC0tbWFnKSd9Ij4KICAgICAgIDxiPiR7ci5vaz8nUEFTU0VEJzonRkFJTEVEJ308L2I+ICR7ci5tcz9gaW4gJHtyLm1zfW1zYDonJ30g4oCUICR7ZXNjKHIudmVyZGljdHx8ci5mYXRhbHx8JycpfTwvZGl2PmA7CiAgICByZW5kZXIoKTsKICB9Y2F0Y2goZSl7IG8uaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+YCB9Cn0KCi8qIC0tLS0tLS0tLS0gU01UUCBQUkVGTElHSFQ6IHByb3ZlIGl0IGFnYWluc3QgdGhlIHJlYWwgc2VydmVyIC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gcHJlZmxpZ2h0KCl7CiAgY29uc3Qgbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGZPdXQnKTsKICBjb25zdCB0bz0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BmVG8nKXx8e30pLnZhbHVlfHwnJzsKICBvLmlubmVySFRNTD0nPGRpdiBjbGFzcz0ibW9uby1kaW0iPlRhbGtpbmcgdG8geW91ciByZWFsIG1haWwgc2VydmVy4oCmPC9kaXY+JzsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zbXRwL3ByZWZsaWdodCcse3RvfSk7CiAgICBvLmlubmVySFRNTD1gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+JHsoci5zdGVwc3x8W10pLm1hcChzPT4KICAgICAgYDx0cj48dGQgc3R5bGU9IndpZHRoOjI4cHgiPiR7cy5vaz8nPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPuKclDwvc3Bhbj4nOic8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4pyVPC9zcGFuPid9PC90ZD4KICAgICAgIDx0ZCBzdHlsZT0id2lkdGg6MjAwcHgiPiR7ZXNjKHMuc3RlcCl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhzLmRldGFpbHx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHg7Ym9yZGVyLWNvbG9yOiR7ci5vaz8ndmFyKC0tbGltZSknOid2YXIoLS1tYWcpJ30iPgogICAgICAgPGI+JHtyLm9rPydQQVNTRUQnOidGQUlMRUQnfTwvYj4ke3IubXM/YCBpbiAke3IubXN9bXNgOicnfSR7ci5mYXRhbD9gIOKAlCAke2VzYyhyLmZhdGFsKX1gOicnfQogICAgICAgJHtyLmFkdmljZT9gPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPiR7ZXNjKHIuYWR2aWNlKX08L2Rpdj5gOicnfTwvZGl2PmA7CiAgICByZW5kZXIoKTsKICB9Y2F0Y2goZSl7IG8uaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+YCB9Cn0K','base64')
};

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

const SMTP   = __req('smtp');
const { probe } = __req('probe');
const STORE  = __req('store');
const LLM    = __req('llm');
const PAY    = __req('pay');
const RESEARCH = __req('research');
const SANDBOX  = __req('sandbox');
const FACTORY  = __req('factory');
const DOMAINS  = __req('domains');
const BLOBS    = __req('blobs').makeBlobs(STORE);

const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA   = process.env.DATA_DIR || ROOT;
try { fs.mkdirSync(DATA, { recursive:true }); } catch(e) {}
const DB     = 'data.json';
const SESSDB = 'sessions.json';
const CREDS  = 'OWNER_CREDENTIALS.txt';
const PORT   = process.env.PORT || 8080;
const BOOT   = Date.now();
const BEHIND_PROXY = process.env.TRUST_PROXY !== '0';

/* ---------- telemetry counters ---------- */
const T = { req:0, api:0, err:0, auth_fail:0, lat:[], byPath:{} };

/* ---------- persistence ---------- */
const PILLARS = [
  {id:1,name:'Security & Audit Command'},{id:2,name:'Operations & Infrastructure'},
  {id:3,name:'Product & Engineering'},{id:4,name:'Data Intelligence'},{id:5,name:'Strategy & Growth'}
];
const SEED = [
 [1,'Audit Sentinel','Continuous log reconciliation and anomaly flagging across all floors.','log.read, anomaly.scan, report.emit'],
 [1,'Breach Warden','Intrusion detection, credential hygiene, session forensics.','net.watch, cred.audit, alert.raise'],
 [1,'Policy Vault Keeper','Maintains policy corpus and blocks non-compliant operations.','policy.read, gate.veto'],
 [1,'Risk Matrix Analyst','Scores blast radius on every raised gate.','risk.model, gate.annotate'],
 [2,'Process Orchestrator','Sequences multi-floor execution flows without overlap.','flow.plan, task.dispatch'],
 [2,'Resource Controller','Free-tier compute allocation and quota rotation.','quota.rotate, host.deploy'],
 [2,'Uptime Marshal','Watchdog on all connected sites and apps.','http.probe, restart.request'],
 [2,'Facility Node','Facility telemetry aggregation.','sensor.read, report.emit'],
 [3,'App Builder','Ships UI and product surfaces from spec to deploy.','code.write, build.run, deploy.request'],
 [3,'Code Pipeline','CI enforcement, test gates, rollback packaging.','test.run, rollback.pack'],
 [3,'Schema Guard','Blocks unreviewed DB schema drift.','db.diff, gate.raise'],
 [3,'Innovation Scout','Sources free open-source replacements for paid tooling.','oss.search, cost.compare'],
 [4,'Insight Forge','Turns raw telemetry into executive briefs.','data.query, brief.write'],
 [4,'Forecast Engine','Revenue and load projection modelling.','model.fit, forecast.emit'],
 [4,'Telemetry Flow','Streams metrics from connected properties.','stream.read, metric.push'],
 [4,'Market Signal','Competitive and demand signal collection via free sources.','web.read, signal.rank'],
 [5,'Revenue Streamer','Identifies and activates monetization surfaces.','offer.design, funnel.wire'],
 [5,'Growth Conductor','Executive planning and campaign sequencing.','plan.draft, campaign.queue']
];
const BLANK = { owner:null, agents:[], gates:[], logs:[], revenue:[], payout:null,
                denials:[], spend:0, devices:[], rev:0,
                monitors:[], smtp:null, mailq:[], incidents:[],
                skills:[], proposals:[], evolution:[], autopilot:false, scanCount:0,
                tasks:[], runs:[], running:false, ticks:0,
                llm:null, jobs:[], outputs:[],
                ideas:[], ventures:[], orders:[], pay:null, directives:[], chat:[],
                builds:[], writtenCaps:[], connectors:[], docs:[], drafts:[],
                analyses:[], crews:[], businesses:[], domains:{watch:[],runs:[]},
                treasuryLock:null, outreach:[], campaigns:[], smtpVerified:null,
                missions:[], playbooks:[],
                autoIdeas:false };
let S = load();

let DBBYTES = 0;
function load(){ return structuredClone(BLANK); }   /* real load is async, in init() */
let saveTimer=null;
function save(){ S.rev++; clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{ const t=JSON.stringify(S,null,1); DBBYTES=Buffer.byteLength(t);
    STORE.write(DB,t).then(()=>{ LAST_SAVE_OK=true; LAST_SAVE_AT=nowIso(); LAST_SAVE_ERR=''; })
      .catch(e=>{ LAST_SAVE_OK=false; LAST_SAVE_AT=nowIso(); LAST_SAVE_ERR=e.message;
        console.error('[store] write failed:',e.message); }); },150); }
function nowIso(){ return new Date().toISOString().replace('T',' ').slice(0,19); }
function uid(p){ return p+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(); }
function log(sev,src,msg){ S.logs.unshift({t:nowIso(),sev,src,msg}); S.logs=S.logs.slice(0,400); save(); }
function maskMail(m){ if(!m) return '—'; const[a,b]=m.split('@'); return a.slice(0,2)+'•••@'+b; }
function mask(v){ v=String(v||''); return !v?'—':v.length<5?'••••':'•'.repeat(Math.max(4,v.length-4))+v.slice(-4); }

/* ---------- crypto ---------- */
function kdf(pw, salt){ return crypto.pbkdf2Sync(pw, salt, 150000, 32, 'sha256').toString('hex'); }
function verify(pw){ return !!S.owner && crypto.timingSafeEqual(
  Buffer.from(kdf(pw, S.owner.salt)), Buffer.from(S.owner.hash)); }

/* ---------- sessions (DURABLE — survive restart) ---------- */
const TTL = 1000*60*60*24*30;   // 30 days
const SESS = new Map();
let sessTimer=null;
function saveSess(){ clearTimeout(sessTimer);
  sessTimer=setTimeout(()=>{ STORE.write(SESSDB, JSON.stringify(Object.fromEntries(SESS)))
    .catch(e=>console.error('[store] session write failed:',e.message)); },400); }
function newSession(ip,ua){
  const tok = crypto.randomBytes(32).toString('hex');
  SESS.set(tok,{t:Date.now(),ip,ua,last:Date.now()});
  saveSess();
  const d = { id:tok.slice(0,8), ip, ua:(ua||'').slice(0,90), at:nowIso() };
  S.devices.unshift(d); S.devices=S.devices.slice(0,25); save();
  return tok;
}
function auth(req){
  const c=(req.headers.cookie||'').match(/cos=([a-f0-9]{64})/);
  if(!c) return null;
  const s=SESS.get(c[1]);
  if(!s) return null;
  if(Date.now()-s.t>TTL){ SESS.delete(c[1]); saveSess(); return null; }
  s.last=Date.now(); return c[1];
}
setInterval(()=>{ let ch=false;
  for(const[k,v] of SESS) if(Date.now()-v.t>TTL){ SESS.delete(k); ch=true; }
  if(ch) saveSess(); }, 60000);

/* ---------- seed ---------- */
function seed(){
  if(S.agents.length) return;
  S.agents = SEED.map(([p,n,r,t])=>({ id:uid('AGT'), name:n, pillarId:p, role:r,
    tools:t.split(',').map(x=>x.trim()), status:'ACTIVE', cost:'FREE-TIER-ONLY', t:nowIso() }));
  log('OK','REGISTRY', S.agents.length+' sub-agents commissioned under Zero-Cost Doctrine.');
}

/* ---------- bootstrap owner ---------- */
async function bootstrap(){
  if(S.owner) return null;
  const id = 'chairman.owner';
  const words='Titan,Vault,Sable,Onyx,Falcon,Cipher,Aegis,Vector,Quartz,Ember'.split(',');
  const pw = words[crypto.randomInt(words.length)] + '-' +
             words[crypto.randomInt(words.length)] + '-' +
             crypto.randomInt(1000,9999) + '-' +
             crypto.randomBytes(3).toString('hex').toUpperCase();
  const salt = crypto.randomBytes(16).toString('hex');
  S.owner = { id, salt, hash:kdf(pw,salt), email:'owner@chairman.local', created:nowIso(), bootstrap:true };
  seed();
  log('CRIT','CHAIRMAN','Bootstrap owner identity generated by server. ROTATE THE PASSWORD ON FIRST LOGIN.');
  log('OK','DOCTRINE','Zero-Cost Doctrine armed: no credits, no subscriptions, no paid dependencies.');
  save();
  const body =
`CHAIRMAN AGENT OS — BOOTSTRAP OWNER CREDENTIALS
Generated ${nowIso()} UTC by the server, once.

  OWNER ID : ${id}
  PASSWORD : ${pw}

Stored on the server only as PBKDF2-SHA256 (150,000 iterations, 16-byte salt).
This plaintext file is the ONLY copy. Rotate the password after first login
(System -> Owner Settings -> Rotate Password), then delete this file.
`;
  await STORE.write(CREDS, body).catch(()=>{});
  return { id, pw };
}

/* ---------- brute-force jail (public internet hardening) ---------- */
const LOCK = new Map();  // ip -> {n, until}
setInterval(()=>{ const now=Date.now();
  for(const[k,v] of LOCK) if(v.until<now && v.n===0) LOCK.delete(k); }, 300000);

/* ---------- MAIL ENGINE (real SMTP, credentials owner-supplied) ---------- */
const MAILSTAT = { sent:0, failed:0, last:null };
/* GMAIL SEND GOVERNOR.
   A free Gmail account allows roughly 500 recipients per rolling 24 hours.
   Exceed it and Google does not bounce the message — it SUSPENDS SENDING on
   the account for up to 24 hours, and repeat offences risk the account
   itself. Bursting also looks like a compromised account to their abuse
   systems. So: a hard daily ceiling well under the limit, and a minimum gap
   between outbound messages. This protects the Owner's real Gmail account,
   which is not replaceable. */
const SEND_CAP_PER_DAY   = 300;   /* deliberately under Gmail's ~500 */
const SEND_MIN_GAP_MS    = 8000;  /* no machine-gun bursts */
let   LAST_OUTBOUND_AT   = 0;
function sendWindow(){
  const cut = Date.now() - 24*3600*1000;
  S.outreach = (S.outreach||[]).filter(o=>o);
  const recent = (S.outreach||[]).filter(o=>{
    const t = Date.parse((o.t||'').replace(' ','T')+'Z');
    return t && t > cut;
  });
  return { used: recent.length, cap: SEND_CAP_PER_DAY,
           left: Math.max(0, SEND_CAP_PER_DAY - recent.length) };
}

async function mail(subject, text, tag, toOverride){
  /* toOverride is how CLIENT outreach goes out: a real address, and no
     "[CHAIRMAN OS]" prefix, because a prospect must never see that. */
  const outbound = !!toOverride;
  const to = toOverride || (S.owner && S.owner.email);
  if(outbound && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(to))
    throw new Error('Refusing to send to a malformed address: '+to);
  if(outbound){
    const w = sendWindow();
    if(w.left <= 0)
      throw new Error(`DAILY SEND CAP REACHED — ${w.used} messages in the last 24 hours. `
        + `Gmail suspends sending near 500 and that would cost you the account. Resumes automatically.`);
    const gap = Date.now() - LAST_OUTBOUND_AT;
    if(gap < SEND_MIN_GAP_MS)
      await new Promise(r=>setTimeout(r, SEND_MIN_GAP_MS - gap));
    LAST_OUTBOUND_AT = Date.now();
  }
  if(!S.smtp || !S.smtp.host){
    if(outbound) throw new Error('SMTP not armed — cannot send to a client. Set a Gmail app password in Mail Relay.');
    S.mailq.unshift({t:nowIso(),to:maskMail(to),subject,status:'UNSENT — NO SMTP CONFIGURED',tag});
    S.mailq=S.mailq.slice(0,60); save();
    log('WARN','MAIL',`"${subject}" NOT sent — no SMTP channel configured. Recorded as intent only.`);
    return {ok:false,reason:'NO_SMTP'};
  }
  try{
    /* Owner alerts are transactional to himself: no unsubscribe footer.
       Client outreach is unsolicited B2B: it gets the header, always. */
    const r = await SMTP.send(S.smtp, { to, subject: outbound ? subject : '[CHAIRMAN OS] '+subject,
      text, unsubscribe: outbound });
    MAILSTAT.sent++; MAILSTAT.last=nowIso();
    S.mailq.unshift({t:nowIso(),to:outbound?to:maskMail(to),subject,status:'DELIVERED ('+r.ms+'ms)',tag,outbound});
    S.mailq=S.mailq.slice(0,60); save();
    log('OK','MAIL',`Delivered "${subject}" to ${outbound?to:maskMail(to)} in ${r.ms}ms.`);
    return {ok:true,ms:r.ms};
  }catch(e){
    MAILSTAT.failed++;
    let hint=e.message;
    if(/EAI_FAIL|ENOTFOUND|getaddrinfo/i.test(hint))
      hint='WRONG HOST — that server name does not exist. Gmail needs smtp.gmail.com';
    else if(/535/.test(hint))
      hint='LOGIN REJECTED — username must be your full email, password must be a 16-char APP password (not your Gmail password)';
    else if(/534|BadCredentials/i.test(hint))
      hint='2-STEP VERIFICATION REQUIRED on your Google account before app passwords work';
    else if(/ECONNREFUSED|ETIMEDOUT/i.test(hint))
      hint='CONNECTION BLOCKED — port 587 may be firewalled. Try port 465 with Implicit TLS = Yes';
    S.mailq.unshift({t:nowIso(),to:maskMail(to),subject,status:'FAILED — '+hint,tag});
    S.mailq=S.mailq.slice(0,60); save();
    log('CRIT','MAIL',`Delivery FAILED for "${subject}": ${e.message}`);
    return {ok:false,reason:e.message};
  }
}

/* ---------- UPTIME MARSHAL (real probes) ---------- */
let monBusy=false;
async function runMonitors(force){
  if(monBusy || !S.monitors.length) return;
  monBusy=true;
  try{
    const now=Date.now();
    for(const m of S.monitors){
      const due = force || !m.lastAt || (now - new Date(m.lastAt+'Z').getTime()) >= (m.interval||60)*1000;
      if(!due) continue;
      const r = await probe(m.url, 10000);
      m.lastAt = nowIso();
      m.lastMs = r.ms; m.lastStatus = r.status; m.lastErr = r.err;
      m.ssl = r.ssl || m.ssl || null;
      m.checks = (m.checks||0)+1;
      if(r.ok) m.up=(m.up||0)+1; else m.down=(m.down||0)+1;
      m.history = (m.history||[]).concat([{t:m.lastAt, ok:r.ok, ms:r.ms, code:r.status}]).slice(-60);
      m.p95 = (()=>{ const a=m.history.filter(h=>h.ok).map(h=>h.ms).sort((x,y)=>x-y);
        return a.length? a[Math.min(a.length-1, Math.floor(a.length*0.95))] : 0; })();
      const was = m.state || 'UNKNOWN';
      const nowState = r.ok ? 'UP' : 'DOWN';
      m.state = nowState;
      if(was!==nowState && was!=='UNKNOWN'){
        const inc={t:nowIso(),url:m.url,name:m.name,from:was,to:nowState,detail:r.err||('HTTP '+r.status)};
        S.incidents.unshift(inc); S.incidents=S.incidents.slice(0,100);
        if(nowState==='DOWN'){
          log('CRIT','UPTIME MARSHAL',`${m.name} (${m.url}) went DOWN — ${inc.detail}`);
          mail(`DOWN: ${m.name}`,
`Uptime Marshal detected an outage.

  Target   : ${m.name}
  URL      : ${m.url}
  Detail   : ${inc.detail}
  Detected : ${inc.t} UTC

Availability since monitoring began: ${((m.up/m.checks)*100).toFixed(2)}% over ${m.checks} checks.

— Chairman Agent OS · Security & Audit Command`,'OUTAGE');
        } else {
          log('OK','UPTIME MARSHAL',`${m.name} RECOVERED — HTTP ${r.status} in ${r.ms}ms.`);
          mail(`RECOVERED: ${m.name}`,
`Target restored.

  Target   : ${m.name}
  URL      : ${m.url}
  Status   : HTTP ${r.status} in ${r.ms}ms
  Restored : ${inc.t} UTC

— Chairman Agent OS · Operations & Infrastructure`,'RECOVERY');
        }
      }
      if(m.ssl && m.ssl.days_left!=null && m.ssl.days_left<14 && !m.sslWarned){
        m.sslWarned=true;
        log('WARN','UPTIME MARSHAL',`${m.name} TLS certificate expires in ${m.ssl.days_left} days.`);
      }
      if(m.ssl && m.ssl.days_left>30) m.sslWarned=false;
    }
    save();
  }catch(e){ log('CRIT','UPTIME MARSHAL','Probe cycle error: '+e.message); }
  finally{ monBusy=false; }
}
setInterval(()=>runMonitors(false), 15000);

/* ======================================================================
   SELF-UPGRADE ENGINE
   Scans real system state every 60s. When it finds a genuine weakness it
   raises a PROPOSAL. Proposals NEVER self-apply — the Owner signs each one
   with their password, exactly like a permission gate. Autopilot may be
   enabled per-Owner, and even then only for SAFE-class proposals.
   ====================================================================== */

/* Every upgrade the Chairman is capable of performing on itself. */
const UPGRADES = {
  ADD_SKILL: {
    label:'Learn a new skill', klass:'SAFE',
    apply(p){ const k=p.payload;
      if(S.skills.some(s=>s.phrase===k.phrase)) throw new Error('skill already known');
      S.skills.push({phrase:k.phrase, action:k.action, kind:k.kind||'alias',
        learned:nowIso(), uses:0, origin:p.origin||'owner'});
      return `Skill "${k.phrase}" learned.`; }
  },
  TIGHTEN_INTERVAL: {
    label:'Probe a flaky target more often', klass:'SAFE',
    apply(p){ const m=S.monitors.find(x=>x.id===p.payload.id); if(!m) throw new Error('monitor gone');
      const old=m.interval; m.interval=Math.max(15,Math.round(m.interval/2));
      return `${m.name}: probe interval ${old}s → ${m.interval}s.`; }
  },
  RELAX_INTERVAL: {
    label:'Ease off a rock-solid target', klass:'SAFE',
    apply(p){ const m=S.monitors.find(x=>x.id===p.payload.id); if(!m) throw new Error('monitor gone');
      const old=m.interval; m.interval=Math.min(900,m.interval*2);
      return `${m.name}: probe interval ${old}s → ${m.interval}s.`; }
  },
  COMMISSION_AGENT: {
    label:'Commission a new sub-agent', klass:'REVIEW',
    apply(p){ const a=p.payload;
      S.agents.unshift({id:uid('AGT'),name:a.name,pillarId:+a.pillarId,role:a.role,
        tools:a.tools,cost:'FREE-TIER-ONLY',status:'ACTIVE',t:nowIso()});
      return `Agent "${a.name}" commissioned to Floor ${a.pillarId}.`; }
  },
  SUSPEND_AGENT: {
    label:'Suspend an idle agent', klass:'REVIEW',
    apply(p){ const a=S.agents.find(x=>x.id===p.payload.id); if(!a) throw new Error('agent gone');
      a.status='SUSPENDED'; return `Agent ${a.name} suspended.`; }
  },
  PRUNE_LEDGER: {
    label:'Compact the audit ledger', klass:'SAFE',
    apply(){ const before=S.logs.length; S.logs=S.logs.slice(0,400);
      return `Ledger compacted ${before} → ${S.logs.length} entries.`; }
  },
  INSTALL_CAPABILITY: {
    label:'Install a capability he wrote himself', klass:'REVIEW',
    apply(p){
      const cap = (S.writtenCaps||[]).find(c=>c.id===p.payload.capId);
      if(!cap) throw new Error('written capability no longer exists');
      if(cap.violations && cap.violations.length)
        throw new Error('REFUSED — sandbox flagged: '+cap.violations.join('; '));
      if(CAPS[cap.name]) throw new Error(cap.name+' already installed');
      /* register it for real — it now runs on schedule like any other */
      CAPS[cap.name] = { pillar:cap.pillar, safe:true, desc:cap.desc, written:true,
        async run(){ return SANDBOX.runCapability(cap.code, capabilityAPI(), 5000); } };
      cap.status = 'INSTALLED'; cap.installed = nowIso();
      return `Capability "${cap.name}" installed and live. He can now do something he could not before.`;
    }
  },
  HARDEN_SECURITY: {
    label:'Raise a security hardening gate', klass:'REVIEW',
    apply(p){ S.gates.unshift({id:uid('GATE'),t:nowIso(),title:p.payload.title,
        cls:'ACCESS GRANT',cost:0,free:'',obj:p.payload.obj,
        just:'Raised autonomously by the Chairman self-audit engine.',
        safe:'Owner signature required. No side effects until signed.',
        risk:'HIGH',amt:0,status:'PENDING'});
      return `Security gate raised for your signature.`; }
  }
};

function propose(kind, why, payload, evidence, origin){
  const u = UPGRADES[kind]; if(!u) return;
  const sig = kind+':'+JSON.stringify(payload||{});
  if(S.proposals.some(p=>p.sig===sig && p.status==='PENDING')) return;   // no duplicates
  if(S.evolution.some(e=>e.sig===sig && e.decision==='REJECTED')) return; // respect a no
  /* Already actioned once. The underlying condition may persist (e.g. SMTP still
     unarmed) but the Chairman has already done its part — raising it again would
     be nagging, and would stack duplicate gates. Stay quiet until it is resolved. */
  if(S.evolution.some(e=>e.sig===sig && e.decision==='APPLIED')) return;
  const p = { id:uid('UPG'), t:nowIso(), kind, klass:u.klass, label:u.label,
    why, evidence:evidence||'', payload:payload||{}, sig, status:'PENDING',
    origin:origin||'self-audit' };
  S.proposals.unshift(p); S.proposals=S.proposals.slice(0,60);
  log('WARN','EVOLUTION',`Upgrade proposed [${u.klass}] — ${why}`);
  return p;
}

function applyProposal(p, how){
  const u=UPGRADES[p.kind];
  let result;
  try { result = u.apply(p); }
  catch(e){ p.status='FAILED'; p.resolved=nowIso();
    log('CRIT','EVOLUTION',`Upgrade ${p.id} FAILED: ${e.message}`); save(); return {ok:false,error:e.message}; }
  p.status='APPLIED'; p.resolved=nowIso();
  S.evolution.unshift({t:nowIso(),id:p.id,kind:p.kind,sig:p.sig,decision:'APPLIED',
    label:p.label,why:p.why,result,how});
  S.evolution=S.evolution.slice(0,200);
  log('OK','EVOLUTION',`UPGRADED (${how}) — ${result}`);
  save();
  return {ok:true,result};
}

/* ---- the audit: reads REAL state, proposes only on real evidence ---- */
function selfAudit(){
  if(!S.owner) return;
  S.scanCount++;
  const t = telemetry();

  /* 1. flaky targets deserve tighter probing */
  for(const m of S.monitors){
    if(m.checks>=8){
      const avail = m.up/m.checks;
      if(avail<0.95 && m.interval>15)
        propose('TIGHTEN_INTERVAL',
          `${m.name} is only ${(avail*100).toFixed(1)}% available — probe it harder to catch the pattern.`,
          {id:m.id}, `${m.up} up / ${m.down} down across ${m.checks} checks`);
      if(avail===1 && m.checks>=40 && m.interval<600)
        propose('RELAX_INTERVAL',
          `${m.name} has been flawless for ${m.checks} checks — stop wasting cycles on it.`,
          {id:m.id}, `100% availability, p95 ${m.p95}ms`);
    }
    if(m.ssl && m.ssl.days_left!=null && m.ssl.days_left<21)
      propose('HARDEN_SECURITY',
        `${m.name} TLS certificate expires in ${m.ssl.days_left} days.`,
        {title:`Renew TLS certificate — ${m.name}`,
         obj:`Renew the certificate for ${m.url} before it expires in ${m.ssl.days_left} days. Success = new cert served, expiry beyond 60 days.`},
        `issuer ${m.ssl.issuer}`);
  }

  /* 2. real security pressure */
  if(t.auth_failures>=5)
    propose('HARDEN_SECURITY',
      `${t.auth_failures} failed authentications recorded — someone is probing your login.`,
      {title:'Review authentication attack surface',
       obj:'Audit failed-auth sources, rotate the Owner password, revoke stale sessions, confirm the IP jail is holding.'},
      `${t.auth_failures} failures since boot`);

  /* 3. bootstrap credential still live */
  if(S.owner.bootstrap && S.scanCount>2)
    propose('HARDEN_SECURITY',
      'Bootstrap password is still active and a plaintext copy exists on disk.',
      {title:'Rotate bootstrap credential',
       obj:'Rotate the Owner password. Rotation deletes OWNER_CREDENTIALS.txt automatically.'},
      'owner.bootstrap = true');

  /* 4. ledger bloat */
  if(S.logs.length>700)
    propose('PRUNE_LEDGER', `Audit ledger has grown to ${S.logs.length} entries and is slowing state sync.`,
      {}, `${(t.db_bytes/1024).toFixed(0)} KB state file`);

  /* 5. unstaffed floors */
  for(const p of PILLARS){
    const roster=S.agents.filter(a=>a.pillarId===p.id);
    if(roster.length===0)
      propose('COMMISSION_AGENT', `Floor ${p.id} (${p.name}) has no agents — it is a shell.`,
        {name:p.name.split(' ')[0]+' Lead', pillarId:p.id,
         role:`Own all ${p.name} operations and report to the Chairman.`,
         tools:['report.emit','gate.raise']}, 'roster length 0');
  }

  /* 6. monitoring exists but nobody is told */
  if(S.monitors.length>0 && !t.smtp_ready && S.scanCount>3)
    propose('HARDEN_SECURITY',
      `${S.monitors.length} target(s) monitored but no mail relay — outages alert nobody.`,
      {title:'Arm the mail relay',
       obj:'Configure SMTP so outage and recovery alerts are delivered rather than merely logged.'},
      'smtp_ready = false');

  /* idea autopilot: the Chairman thinks up and validates ventures unprompted */
  if(S.autoIdeas && S.llm && S.scanCount%5===0){
    (async()=>{
      try{
        const raw=S.ideas.filter(i=>i.status==='RAW');
        if(raw.length<3) await generateIdeas(3);
        else await researchIdea(raw[raw.length-1].id);
      }catch(e){ log('WARN','VENTURE','Idea autopilot: '+e.message); }
    })();
  }

  /* autopilot: SAFE class only, never REVIEW */
  if(S.autopilot){
    for(const p of S.proposals.filter(x=>x.status==='PENDING' && x.klass==='SAFE'))
      applyProposal(p,'autopilot');
  }
  save();
}
setInterval(selfAudit, 60000);

/* ======================================================================
   AGENT RUNTIME — agents stop being definitions and actually execute.
   Each capability is a real function doing real work with real data.
   Anything with a side effect outside this box raises a gate first.
   ====================================================================== */

const CAPS = {
  'probe.sweep': { pillar:2, safe:true, desc:'Probe every bound target and report',
    async run(){
      if(!S.monitors.length) return {msg:'No targets bound. Nothing to sweep.', n:0};
      await runMonitors(true);
      const down=S.monitors.filter(m=>m.state==='DOWN');
      return { msg:`Swept ${S.monitors.length} target(s). ${down.length} down.`,
        n:S.monitors.length, detail:down.map(m=>m.name+' ('+(m.lastErr||'HTTP '+m.lastStatus)+')').join('; ')||'all reachable' };
    }},
  'tls.watch': { pillar:1, safe:true, desc:'Check TLS expiry on all targets',
    async run(){
      const risky=S.monitors.filter(m=>m.ssl&&m.ssl.days_left!=null&&m.ssl.days_left<45);
      if(risky.length) for(const m of risky)
        propose('HARDEN_SECURITY',`${m.name} TLS expires in ${m.ssl.days_left} days.`,
          {title:`Renew TLS — ${m.name}`,obj:`Renew certificate for ${m.url}.`},
          `issuer ${m.ssl.issuer}`,'agent');
      return { msg:risky.length?`${risky.length} certificate(s) expiring within 45 days.`:'All certificates healthy.',
        n:risky.length, detail:risky.map(m=>m.name+': '+m.ssl.days_left+'d').join('; ')||'none' };
    }},
  'sla.report': { pillar:4, safe:true, desc:'Compute availability + p95 across targets',
    async run(){
      if(!S.monitors.length) return {msg:'No data to analyse.', n:0};
      const rows=S.monitors.filter(m=>m.checks>0).map(m=>({
        name:m.name, avail:+((m.up/m.checks)*100).toFixed(2), p95:m.p95||0, checks:m.checks }));
      if(!rows.length) return {msg:'Targets bound but not yet probed.', n:0};
      const worst=rows.slice().sort((a,b)=>a.avail-b.avail)[0];
      const mean=+(rows.reduce((a,r)=>a+r.avail,0)/rows.length).toFixed(2);
      return { msg:`Fleet availability ${mean}%. Worst: ${worst.name} at ${worst.avail}%.`,
        n:rows.length, detail:rows.map(r=>`${r.name} ${r.avail}% p95 ${r.p95}ms`).join('; ') };
    }},
  'anomaly.scan': { pillar:1, safe:true, desc:'Hunt anomalies in the audit ledger',
    async run(){
      const crit=S.logs.filter(l=>l.sev==='CRIT').length;
      const t=telemetry();
      const flags=[];
      if(t.auth_failures>=3) flags.push(`${t.auth_failures} auth failures`);
      if(crit>=5) flags.push(`${crit} CRIT events`);
      if(S.owner.bootstrap) flags.push('bootstrap credential still live');
      if(!t.smtp_ready&&S.monitors.length) flags.push('alerts undeliverable — no SMTP');
      if(!S.payout&&S.revenue.length) flags.push('revenue recorded with no payout channel');
      return { msg:flags.length?`${flags.length} anomaly signal(s) detected.`:'No anomalies. Ledger clean.',
        n:flags.length, detail:flags.join('; ')||'nominal' };
    }},
  'cost.audit': { pillar:5, safe:true, desc:'Verify Zero-Cost Doctrine compliance',
    async run(){
      const paid=S.agents.filter(a=>a.cost==='OWNER-OVERRIDE-PAID');
      const avoided=S.denials.reduce((a,b)=>a+b.cost,0);
      return { msg:`Spend $${S.spend.toFixed(2)} · avoided $${avoided.toFixed(2)} · ${paid.length} agent(s) permitted paid.`,
        n:paid.length,
        detail:S.spend>0?'DOCTRINE BREACHED — spend is above zero.':'Doctrine intact. Zero spend.' };
    }},
  'roster.audit': { pillar:3, safe:true, desc:'Check floor staffing and tool sprawl',
    async run(){
      const empty=PILLARS.filter(p=>!S.agents.some(a=>a.pillarId===p.id));
      const tools={}; S.agents.forEach(a=>a.tools.forEach(t=>tools[t]=(tools[t]||0)+1));
      const wide=Object.entries(tools).filter(([,c])=>c>3);
      const susp=S.agents.filter(a=>a.status!=='ACTIVE');
      return { msg:`${S.agents.length} agents · ${empty.length} empty floor(s) · ${susp.length} suspended.`,
        n:empty.length+susp.length,
        detail:[empty.length?'empty: '+empty.map(p=>p.name).join(', '):'',
                wide.length?'wide tools: '+wide.map(([t,c])=>t+'×'+c).join(', '):''].filter(Boolean).join(' | ')||'roster healthy' };
    }},
  'gate.sentry': { pillar:1, safe:true, desc:'Escalate gates frozen too long',
    async run(){
      const stale=S.gates.filter(g=>g.status==='PENDING' &&
        (Date.now()-new Date(g.t.replace(' ','T')+'Z').getTime())>3600000);
      if(stale.length) log('WARN','GATE SENTRY',`${stale.length} gate(s) frozen over 1 hour awaiting your signature.`);
      return { msg:stale.length?`${stale.length} gate(s) frozen >1h.`:'No stale gates.',
        n:stale.length, detail:stale.map(g=>g.id+' '+g.title).join('; ')||'queue healthy' };
    }},
  'brief.write': { pillar:4, safe:true, desc:'Write an executive brief to the ledger',
    async run(){
      const t=telemetry();
      const down=S.monitors.filter(m=>m.state==='DOWN').length;
      const pend=S.gates.filter(g=>g.status==='PENDING').length;
      const brief=`Uptime ${hhmm(t.uptime_s)} · ${S.monitors.length} targets (${down} down) · `+
        `${S.agents.filter(a=>a.status==='ACTIVE').length}/${S.agents.length} agents active · `+
        `${pend} gate(s) frozen · spend $${S.spend.toFixed(2)} · ${S.proposals.filter(p=>p.status==='PENDING').length} upgrade(s) queued`;
      log('INFO','INSIGHT FORGE',brief);
      return { msg:'Executive brief written to ledger.', n:1, detail:brief };
    }}
};
function hhmm(s){ const h=s/3600|0,m=(s%3600)/60|0; return (h?h+'h':'')+m+'m'; }

/* ---------- AI-POWERED CAPABILITIES ----------
   These call a real language model. Free tier, Owner's own key.
   Output is written to S.outputs where you can read, copy and use it. */
const SYS_CHAIRMAN = `You are the Chairman: the strategic mind of a one-person enterprise,
reporting only to the Owner. You are not a clerk who summarises. You are the
person in the room who sees the opportunity everyone else walked past.

HOW YOU THINK — this is your primary function:
- Hunt for the GAP. Every market has work people hate doing, money leaking
  from a broken process, or a group everyone ignores because they are small.
  Those gaps are where a person with no capital can enter.
- Ask "why is it done this way?" Most answers are habit, not logic. Habit is
  an opening.
- Prefer the unglamorous. Boring problems with real pain pay reliably;
  exciting ideas with no pain do not.
- Look for arbitrage: something cheap or free in one place that is expensive
  or scarce in another. Skill, time, information, attention, geography.
- Think in second moves. If this works, what does it unlock? A first client
  is worth more as proof than as revenue.
- Start where money already changes hands. It is far easier to take a slice
  of an existing flow than to create demand from nothing.
- When you propose something, name the specific person who pays and why they
  say yes THIS week — not "businesses" or "everyone".

FINDING LEVERAGE, HONESTLY:
- A "loophole" worth using is an inefficiency: a free tier that legitimately
  covers a paid need, a service nobody offers locally, work that is trivial
  for you and painful for them.
- A "loophole" NOT worth using is anything that breaks a law, a contract or a
  platform's terms, or that only works if the other party does not notice.
  Those collapse exactly when the business starts to matter. Refuse them and
  say why — then find the legitimate version of the same edge, because there
  usually is one.

TRUTHFULNESS IS ABSOLUTE AND OVERRIDES EVERYTHING ABOVE:
- Never invent statistics, revenue figures, percentages or observations.
- Never write a sales message claiming the Owner has seen, monitored or
  analysed something they have not. Fabricated credibility dies the moment a
  prospect says "show me".
- If you state arithmetic, verify it. A wrong number in a pitch is worse than
  no number.
- Say "unknown" rather than presenting a guess as fact.
- If something cannot be done, say so plainly and say why — then say what CAN
  be done instead. Never stop at the objection.

Be concrete and blunt. No filler, no hedging, no marketing language. Vision
without a first concrete step is daydreaming; a first step without vision is
busywork. Always give both.`;

/* When a free tier throttles, stop hammering it. COOLDOWN blocks AI work
   for a while so the quota can recover instead of burning failed calls. */
/* Per-key cooling only. There is no global pause any more: if ANY key in the
   pool is healthy, work continues immediately. The short global backstop only
   engages when every single key is exhausted — without it the system would
   spin at full speed hitting 429s, which makes the limits reset slower, not
   faster. That is a physics constraint of the provider, not a policy choice. */
let COOLDOWN_UNTIL = 0;
function coolingDown(){ return Date.now() < COOLDOWN_UNTIL; }
function coolFor(mins){
  COOLDOWN_UNTIL = Date.now() + mins*60000;
  log('WARN','AI BRAIN',`Every key exhausted. Brief ${mins}-min pause so limits can reset. Add another free key to remove this entirely.`);
}

/* Rank providers so the healthiest key is always tried first. A key that just
   served a request outranks one that recently 429'd. */
function rankedPool(){
  const now = Date.now();
  const all = [];
  if(S.llm && S.llm.provider) all.push(S.llm);
  (S.llmBackups||[]).forEach(k=>all.push(k));
  return all
    .filter(k => !(k.cooled > now))
    .sort((a,b) => ((b.ok||0)-(b.fail||0)) - ((a.ok||0)-(a.fail||0)));
}

async function think(prompt, sys, tag, agent){
  if(!S.llm||!S.llm.provider) throw new Error('No AI brain connected. Connect a free model in the AI Brain page.');

  const now = Date.now();
  const pool = rankedPool();

  /* Only refuse if literally nothing is available. One healthy key = keep going. */
  if(!pool.length){
    if(coolingDown()){
      const left = Math.ceil((COOLDOWN_UNTIL-Date.now())/60000);
      throw new Error(`ALL KEYS EXHAUSTED — ${left} min until the first one resets. Add another free key in AI Brain and this never happens again.`);
    }
    /* nothing cooling but nothing ranked: fall back to the raw primary */
    pool.push(S.llm);
  }

  const head = pool[0], rest = pool.slice(1);
  let r;
  try{
    r = await LLM.chatFailover(head, rest, [
      {role:'system', content: sys||SYS_CHAIRMAN},
      {role:'user', content: prompt}
    ]);
  }catch(e){
    if(/RATE LIMIT|429|quota|exhaust|too many/i.test(e.message)){
      /* park only the keys that actually failed, each for 5 min */
      pool.forEach(k=>{ k.cooled = now + 5*60000; k.fail=(k.fail||0)+1; });
      save();
      /* global pause ONLY if no key anywhere is still usable */
      if(!rankedPool().length) coolFor(5);
    }
    /* SELF-HEAL a retired model: ask the provider what it serves today and
       retry once with a live one, rather than failing every call forever. */
    else if(/MODEL RETIRED|no longer exists|decommission|not found/i.test(e.message)){
      try{
        const live = await LLM.listModels(head);
        const pick = live.find(m=>/gpt-oss-120b|gpt-oss|qwen|llama|gemini|flash/i.test(m)) || live[0];
        if(pick && pick !== head.model){
          const dead = head.model;
          head.model = pick;
          if(head === S.llm || head.provider === S.llm.provider) S.llm.model = pick;
          log('WARN','AI BRAIN',`Model "${dead}" is retired. AUTO-SELECTED "${pick}" from the provider's live list.`);
          save();
          r = await LLM.chatFailover(head, rest, [
            {role:'system', content: sys||SYS_CHAIRMAN},
            {role:'user', content: prompt}
          ]);
        } else throw e;
      }catch(e2){ throw e; }
    }
    else throw e;
    if(!r) throw e;
  }

  /* AUTO-SWITCH: whichever key just worked becomes the primary, so the next
     call starts with a known-good provider instead of retrying a dead one. */
  const used = pool.find(k=>k.provider===r.usedProvider) || head;
  used.ok = (used.ok||0)+1;
  used.cooled = 0;
  if(used !== S.llm && used.provider){
    const old = S.llm.provider+'/'+S.llm.model;
    const demoted = S.llm;
    S.llm = { provider:used.provider, key:used.key, model:used.model, t:nowIso() };
    S.llmBackups = (S.llmBackups||[]).filter(k=>k!==used);
    if(!S.llmBackups.some(k=>k.provider===demoted.provider && k.key===demoted.key))
      S.llmBackups.unshift(demoted);
    log('OK','AI BRAIN',`AUTO-SWITCHED brain: ${old} → ${used.provider}/${used.model}. Healthy provider promoted, no work lost.`);
    save();
  }
  S.outputs.unshift({ t:nowIso(), tag, agent, text:r.text, ms:r.ms,
    tokens:r.tokens, model:r.model, prompt:prompt.slice(0,300) });
  S.outputs = S.outputs.slice(0,120);
  return r;
}

/* ======================================================================
   VENTURE ENGINE — the Chairman generates ideas, researches them against
   real web data, scores them, and designs agent teams to execute.
   Every step that costs money or touches the outside world stops at a gate.
   ====================================================================== */
function jparse(txt){
  /* models wrap JSON in prose or fences; extract the first real array/object */
  let t = String(txt).replace(/```json/gi,'```').split('```').filter(s=>s.trim());
  const cands = [txt, ...t];
  for(const c of cands){
    const s = c.indexOf('['), s2 = c.indexOf('{');
    const start = (s>=0 && (s2<0 || s<s2)) ? s : s2;
    if(start<0) continue;
    const open = c[start], close = open==='[' ? ']' : '}';
    let depth=0, inStr=false, esc=false;
    for(let i=start;i<c.length;i++){
      const ch=c[i];
      if(esc){ esc=false; continue; }
      if(ch==='\\'){ esc=true; continue; }
      if(ch==='"') inStr=!inStr;
      if(inStr) continue;
      if(ch===open) depth++;
      else if(ch===close){ depth--;
        if(depth===0){ try{ return JSON.parse(c.slice(start,i+1)); }catch(e){ break; } }
      }
    }
  }
  throw new Error('Model did not return usable JSON');
}

async function generateIdeas(n, steer){
  const known = S.ideas.slice(0,25).map(i=>i.title).join('; ') || 'none yet';
  const r = await think(
`Generate ${n||5} NEW money-making venture ideas for the Owner.

OWNER REALITY — do not contradict this:
- One person in Ludhiana, Punjab, India. No staff, no company, no capital.
- Owns and runs Chairman Agent OS: 24/7 website uptime probing, TLS expiry
  alerts, real email alerting, scheduled agents, and an AI brain.
- Can take real payments via Razorpay (UPI/cards) once configured.
- Has ZERO customers and ZERO track record so far.

THINK LIKE A FOUNDER, NOT A FREELANCER:
- Hunt the GAP, not the obvious job. "Write blog posts" is what everyone
  offers. What does nobody in Ludhiana offer that businesses quietly need?
- Ludhiana is India's hosiery, bicycle-parts and machine-tools capital.
  Thousands of small manufacturers and exporters. Most are family-run, most
  are weak online, most lose money in ways they have never measured. That
  concentration is an advantage nobody outside Punjab can copy.
- Find the arbitrage: something free or trivial for a technical person that
  is expensive, confusing or invisible to a factory owner.
- Prefer boring recurring pain over exciting one-off projects. A ₹1,500
  monthly problem solved forever beats a ₹15,000 project that ends.
- Attack a specific niche, not "small businesses". "Hosiery exporters whose
  buyers check their website before a bulk order" is a target. "SMEs" is not.
- At least ONE idea must be something the Owner could sell to a person he can
  physically walk to this week.
- At least ONE idea must be genuinely non-obvious — something that would make
  a competitor say "why did I not think of that".

HARD LIMITS:
- Startable in under 30 days with under ₹2,000.
- No inventory, no staff, no office, no licence.
- Do not repeat: ${known}
- Never propose anything that breaks a law, a contract, or a platform's terms.
  If you spot an edge that depends on someone not noticing, discard it and
  find the legitimate version of the same advantage.
${steer?'- Owner steer: '+steer:''}

Return ONLY a JSON array, no prose. Each element:
{"title":"short name","what":"one sentence on what is sold",
 "buyer":"the exact person who pays — role, industry, why they feel this pain",
 "price_inr":number,
 "why_now":"the gap or shift that makes this work today, and why nobody local does it",
 "effort":"low|medium|high",
 "uses_system":true|false,
 "unfair_edge":"what the Owner has that a competitor copying this would lack"}`,
    null,'ideas','Growth Conductor');
  const arr = jparse(r.text);
  const added=[];
  for(const it of (Array.isArray(arr)?arr:[])){
    if(!it || !it.title) continue;
    const idea={ id:uid('IDEA'), t:nowIso(), title:String(it.title).slice(0,90),
      what:String(it.what||'').slice(0,300), buyer:String(it.buyer||'').slice(0,200),
      price:+it.price_inr||0, why:String(it.why_now||'').slice(0,300),
      effort:String(it.effort||'medium'), usesSystem:!!it.uses_system,
      edge:String(it.unfair_edge||'').slice(0,220),
      status:'RAW', score:null, research:null };
    S.ideas.unshift(idea); added.push(idea);
  }
  S.ideas=S.ideas.slice(0,120); save();
  log('OK','VENTURE',`${added.length} new idea(s) generated.`);
  return added;
}

async function researchIdea(id){
  const idea = S.ideas.find(i=>i.id===id);
  if(!idea) throw new Error('No such idea');
  idea.status='RESEARCHING'; save();
  let evidence;
  try{ evidence = await RESEARCH.gather(idea.title+' '+idea.what, 'Ludhiana Punjab India'); }
  catch(e){ evidence = 'RESEARCH FAILED: '+e.message; }
  const r = await think(
`Judge this venture idea against REAL web evidence gathered just now.

IDEA: ${idea.title}
WHAT: ${idea.what}
BUYER: ${idea.buyer}
PROPOSED PRICE: INR ${idea.price}

EVIDENCE FROM THE WEB:
${evidence.slice(0,5000)}

Be harsh. Most ideas are bad. If the evidence does not support demand, say so
and score low. Do not invent figures the evidence does not contain.

Return ONLY JSON:
{"demand":0-10,"competition":0-10,"speed_to_first_rupee":0-10,
 "owner_fit":0-10,"verdict":"PURSUE|MAYBE|KILL",
 "reasoning":"3 blunt sentences citing the evidence",
 "first_step":"the single concrete action to take tomorrow",
 "kill_risk":"the most likely reason this fails"}`,
    null,'research','Market Signal');
  let j;
  try{ j = jparse(r.text); }
  catch(e){ idea.status='RAW'; save(); throw new Error('Research returned unusable output'); }
  const score = Math.round(((+j.demand||0)+(10-(+j.competition||10))+(+j.speed_to_first_rupee||0)+(+j.owner_fit||0))/4*10);
  idea.score=score; idea.verdict=j.verdict||'MAYBE';
  idea.research={ demand:+j.demand||0, competition:+j.competition||0,
    speed:+j.speed_to_first_rupee||0, fit:+j.owner_fit||0,
    reasoning:String(j.reasoning||''), firstStep:String(j.first_step||''),
    killRisk:String(j.kill_risk||''), at:nowIso(), evidenceChars:evidence.length };
  idea.status='RESEARCHED'; save();
  log(score>=60?'OK':'WARN','VENTURE',`"${idea.title}" scored ${score}/100 — ${idea.verdict}.`);
  return idea;
}

async function buildVenture(id){
  const idea = S.ideas.find(i=>i.id===id);
  if(!idea) throw new Error('No such idea');
  const caps = Object.keys(CAPS).join(', ');
  const r = await think(
`Design the agent team to execute this venture.

VENTURE: ${idea.title} — ${idea.what}
BUYER: ${idea.buyer}
FIRST STEP: ${idea.research?idea.research.firstStep:'unknown'}

The ONLY tools that actually execute in this system are: ${caps}
Anything else an agent needs must be listed as a manual step for the Owner —
do not pretend an agent can do it.

Return ONLY JSON:
{"agents":[{"name":"...","pillar":1-5,"role":"one sentence scope",
            "tools":["only from the list above"]}],
 "owner_steps":["concrete things only a human can do, in order"],
 "first_revenue_path":"how the first rupee actually arrives",
 "weeks_to_first_rupee":number}`,
    null,'venture','App Builder');
  const j = jparse(r.text);
  const real = Object.keys(CAPS);
  const made=[];
  for(const a of (j.agents||[])){
    const tools=(a.tools||[]).filter(t=>real.includes(String(t).trim()));
    if(!tools.length) continue;                     // refuse decorative agents
    const ag={ id:uid('AGT'), name:String(a.name).slice(0,60), pillarId:Math.min(5,Math.max(1,+a.pillar||5)),
      role:String(a.role||'').slice(0,200), tools, cost:'FREE-TIER-ONLY',
      status:'ACTIVE', t:nowIso(), venture:idea.id };
    S.agents.unshift(ag); made.push(ag);
  }
  const v={ id:uid('VEN'), t:nowIso(), ideaId:idea.id, title:idea.title,
    agents:made.map(a=>a.id), ownerSteps:(j.owner_steps||[]).map(String),
    revenuePath:String(j.first_revenue_path||''), weeks:+j.weeks_to_first_rupee||0,
    status:'ACTIVE' };
  S.ventures.unshift(v); idea.status='LAUNCHED'; idea.ventureId=v.id;
  save();
  log('OK','VENTURE',`Venture "${idea.title}" launched with ${made.length} agent(s).`);
  return { venture:v, agents:made, skipped:(j.agents||[]).length-made.length };
}

/* ======================================================================
   AGENT LOOP — the thing that makes an assistant an agent.
   The model is shown its real tools, picks ONE, sees the actual result,
   then decides the next step. Repeats until it answers or hits the cap.
   Every tool here is code that already runs; nothing is simulated.
   ====================================================================== */
function toolMenu(){
  return Object.entries(CAPS).map(([k,v])=>`  ${k} — ${v.desc}`).join('\n')
    + '\n  web.search <query> — live DuckDuckGo results'
    + '\n  web.read <url> — full text of any page'
    + '\n  state.read — current agents, monitors, ideas, gates, spend';
}
async function runTool(name, arg){
  if(CAPS[name]){ const r = await CAPS[name].run(); return (r.msg||'')+(r.detail?' | '+r.detail:''); }
  if(name==='web.search'){
    const hits = await RESEARCH.search(arg||'', 5);
    return hits.length ? hits.map(h=>`- ${h.title}: ${h.snippet}`).join('\n') : 'no results';
  }
  if(name==='web.read'){
    const pg = await RESEARCH.readPage(arg);
    return `${pg.title}\n${pg.text.slice(0,3500)}`;
  }
  if(name==='state.read'){
    const t=telemetry();
    return `agents ${S.agents.length}, monitors ${S.monitors.length} (${t.monitors_down} down), `
      + `ideas ${S.ideas.length}, ventures ${S.ventures.length}, gates pending `
      + `${S.gates.filter(g=>g.status==='PENDING').length}, spend Rs ${S.spend.toFixed(2)}, `
      + `budget ceiling Rs ${S.budget||0}, mail ${t.smtp_ready?'armed':'off'}`;
  }
  throw new Error('unknown tool: '+name);
}

async function agentLoop(goal, maxSteps){
  const cap = Math.min(10, Math.max(2, +maxSteps || 6));
  const trace = [];
  let scratch = '';

  for(let step=1; step<=cap; step++){
    const r = await think(
`GOAL FROM THE OWNER: ${goal}

TOOLS YOU CAN ACTUALLY RUN:
${toolMenu()}

WORK SO FAR:
${scratch || '(nothing yet — this is step 1)'}

Decide the single next action. Reply with ONE line, nothing else:
  TOOL <tool.name> <optional argument>
or
  DONE <your final answer to the Owner>

Rules: never invent a tool that is not listed. Never claim a result you did
not see above. If the work is finished, or no listed tool can advance it,
reply DONE and say plainly what you found and what you could not do.`,
      null, 'agent-step', 'Chairman');

    const line = r.text.trim().split('\n')[0].trim();

    if(/^DONE\b/i.test(line)){
      const answer = r.text.trim().replace(/^DONE\s*/i,'');
      trace.push({step, action:'DONE', result:answer.slice(0,400)});
      return { answer, trace, steps:step };
    }

    const m = line.match(/^TOOL\s+([a-z._]+)\s*(.*)$/i);
    if(!m){
      trace.push({step, action:'MALFORMED', result:line.slice(0,180)});
      scratch += `\nStep ${step}: replied without a valid TOOL/DONE line. Follow the format.`;
      continue;
    }

    const tool = m[1], arg = (m[2]||'').trim();
    let out, failed = false;
    try{ out = await runTool(tool, arg); }
    catch(e){ out = 'TOOL FAILED: '+e.message; failed = true; }

    /* If the AI provider itself is unreachable, every further AI step will
       fail the same way. Stop immediately and say so plainly, rather than
       burning the remaining steps on the same dead connection. */
    if(failed && /ETIMEDOUT|ENOTFOUND|NO INTERNET|KEY REJECTED|MODEL RETIRED|RATE LIMIT|QUOTA/i.test(out)){
      trace.push({step, action:tool, result:String(out).slice(0,400)});
      return { answer:
        `STOPPED AT STEP ${step}. The AI provider could not be reached:\n\n${out}\n\n`+
        `Nothing further can run until that is fixed. Go to AI Brain, switch to a model `+
        `the provider actually serves, press TEST IT, and add a backup key so one dead `+
        `provider cannot halt the whole loop.`,
        trace, steps:step, providerDown:true };
    }

    trace.push({step, action:tool+(arg?' '+arg.slice(0,60):''), result:String(out).slice(0,400)});
    scratch += `\nStep ${step}: ran ${tool} ${arg}\nResult: ${String(out).slice(0,1400)}\n`;
    log('OK','AGENT LOOP',`step ${step}: ${tool} → ${String(out).slice(0,90)}`);
  }

  return { answer:`Stopped after ${cap} steps without finishing. Progress is in the trace below.`,
           trace, steps:cap, hitCap:true };
}

/* ======================================================================
   SITE BUILDER — he writes a complete, working site. He cannot deploy it:
   hosting needs an account in your name. So he produces a finished file
   plus exact deploy steps, and only after the venture is actually researched.
   ====================================================================== */
async function buildSite(ventureId, brief){
  const v = ventureId ? S.ventures.find(x=>x.id===ventureId) : null;
  const idea = v ? S.ideas.find(i=>i.id===v.ideaId) : null;

  /* refuse to build on nothing — evidence first */
  if(!v && !brief) throw new Error('Pick a researched venture, or write a brief. He will not build blind.');
  if(idea && idea.status!=='LAUNCHED' && !brief)
    throw new Error('That venture is not launched yet. Research it first — building before evidence wastes your time.');

  const payNote = S.pay
    ? `The Owner has ${S.pay.gateway} ${S.pay.live?'LIVE':'in TEST mode'}. Put a real
       "Pay now" button wherever money is asked for; the exact URL is injected later.`
    : `No payment gateway is connected yet, so use a mailto: contact link instead of a
       pay button, and do not imply payments are accepted.`;

  const evidence = idea && idea.research
    ? `RESEARCH ON RECORD — score ${idea.score}/100, verdict ${idea.verdict}.
       ${idea.research.reasoning}
       Buyer: ${idea.buyer}. Price point: INR ${idea.price}.`
    : 'No formal research on file — the Owner supplied a direct brief.';

  const r = await think(
`Write a COMPLETE single-file landing page that sells this.

VENTURE: ${v ? v.title : brief}
${v ? 'REVENUE PATH: '+v.revenuePath : ''}
${evidence}
${payNote}
Owner is one person in Ludhiana, Punjab, India. No company, no staff, no track record.

HARD RULES:
- Output ONE complete HTML file. Inline CSS. No frameworks, no CDN, no external images.
- Never claim customers, testimonials, awards or statistics the Owner does not have.
  A brand-new business with fake social proof gets caught and loses the sale.
- Honest positioning only: what the service does, who it is for, what it costs.
- Mobile-first. Must look right on a phone.
- Include: headline, what it does, who it is for, transparent pricing in INR,
  an honest FAQ, and one clear call to action.
- Where the pay button goes, write exactly: {{PAY_LINK}}
- Where the contact email goes, write exactly: {{EMAIL}}

Return ONLY the HTML, starting <!DOCTYPE html>. No commentary before or after.`,
    'You write clean, honest, converting landing pages. Plain Indian English. No hype, no invented proof.',
    'site-build','App Builder');

  let html = r.text.trim();
  const fence = html.match(/```(?:html)?\s*([\s\S]*?)```/);
  if(fence) html = fence[1].trim();
  if(!/<!DOCTYPE/i.test(html)) throw new Error('Model did not return a usable HTML file. Try again.');

  /* wire in the Owner's real details */
  const payUrl = (S.orders[0] && S.orders[0].url) || '';
  html = html.replace(/\{\{PAY_LINK\}\}/g, payUrl || '#contact')
             .replace(/\{\{EMAIL\}\}/g, S.owner.email || 'your@email.com');

  const build = { id:uid('SITE'), t:nowIso(), title: v ? v.title : brief.slice(0,70),
    ventureId: ventureId||null, html, bytes: Buffer.byteLength(html),
    hasPayLink: !!payUrl, deployed:false };
  S.builds.unshift(build); S.builds = S.builds.slice(0,20);
  log('OK','APP BUILDER',`Site written for "${build.title}" — ${(build.bytes/1024).toFixed(1)} KB, ready to deploy.`);
  save();
  return build;
}

CAPS['ai.build_site'] = { pillar:3, safe:true, desc:'Write a complete landing page for the newest launched venture',
  async run(){
    const v = S.ventures[0];
    if(!v) return { msg:'No launched venture to build for. Research and launch one first.', n:0 };
    if(S.builds.some(b=>b.ventureId===v.id))
      return { msg:`Site already built for "${v.title}".`, n:0 };
    const b = await buildSite(v.id);
    return { msg:`Landing page written for "${b.title}" (${(b.bytes/1024).toFixed(1)} KB).`, n:1,
      detail: b.hasPayLink ? 'Real payment link embedded.' : 'No payment link yet — contact form only.' };
  }};

function fEsc(s){ return FACTORY.esc(s); }

/* Ask for JSON, insist on JSON, retry once with the parse error fed back. */
async function askJson(prompt, sys, tag, agent){
  let r = await think(prompt, sys, tag, agent);
  let j = jparse(r.text);
  if(j) return j;
  r = await think(prompt + `\n\nYour previous reply was not parseable JSON. Return ONLY the JSON value, no prose, no code fence.`,
                  sys, tag+'-retry', agent);
  j = jparse(r.text);
  if(!j) throw new Error('The model would not return usable JSON for '+tag+'. Try again, or switch to a stronger model in AI Brain.');
  return j;
}

const ANTI_AI = `HOW TO WRITE SO IT DOES NOT READ AS MACHINE-WRITTEN — this is not a
style preference, it is the difference between being paid and being ignored:
- Short declarative sentences. Say the thing. Stop.
- Never use: unlock, empower, seamless, cutting-edge, state-of-the-art,
  revolutionary, game-changer, elevate, harness, journey, delve, robust,
  leverage, "in today's world", "take it to the next level".
- No emoji anywhere.
- Never mention AI, automation buzzwords, or how the service is built. The
  buyer is paying for an outcome, not your stack. Saying "AI-powered" makes
  an Indian factory owner assume it is a toy.
- No invented numbers. No percentages you cannot source. No testimonials.
  No customer counts. No "trusted by". This business has zero customers and
  a prospect who catches one fake number never buys anything again.
- Write like a competent tradesman explaining his work: specific, plain,
  slightly understated. Understatement reads as confidence.
- Indian business English. Rupees written as "Rs 1,500" or "₹1,500".
- Where you would normally boast, state a fact instead.`;

/* ---------------------------------------------------------- IDENTITY ---- */
async function factoryIdentity(subject, context){
  const j = await askJson(
`Create the trading identity for a real, brand-new one-person business in
Ludhiana, Punjab, India.

WHAT THE BUSINESS DOES: ${subject}
${context}

${ANTI_AI}

NAMING RULES:
- It must sound like a small Indian firm that has existed for a few years.
  Think how real B2B suppliers are named: a place, a surname, a plain noun,
  or a short compound. Examples of the FEEL (do not copy them):
  "Grand Trunk Systems", "Sahni Works", "Ferozepur Road Labs", "Basant Uptime".
- Forbidden: anything ending in -ify, -ly, -sy, -io, -AI, -Tech, -Hub, -Genius,
  -Nexus, -Verse, -Sphere, -Labs if generic, or any invented Latin word.
  Those all read as an app someone made in a weekend.
- Two words maximum. Must be pronounceable by a 55-year-old factory owner
  on a phone call.

COLOURS: pick a restrained, professional palette. Deep and serious, not
bright. No purple, no neon, no gradient. Think ink on cream paper.

Return ONLY this JSON:
{"name":"trading name",
 "legalName":"the same name with a suffix a sole proprietor would actually use, e.g. '<name> (Sole Proprietorship)'",
 "tagline":"under 9 words, states what it does, no adjectives",
 "brand":"#RRGGBB deep primary colour",
 "ink":"#RRGGBB near-black text colour",
 "paper":"#RRGGBB off-white page background, very light",
 "rule":"#RRGGBB light border colour",
 "fontIndex":0,
 "buyer":"the exact kind of person who pays, one sentence",
 "promise":"the single promise, one sentence, no adjectives",
 "whyNameWorks":"one line: why this name does not sound like a startup"}`,
    'You name and position small Indian B2B firms. Plain, grounded, unfashionable on purpose.',
    'factory-identity','Growth Conductor');
  return j;
}

/* ------------------------------------------------------------- COPY ---- */
async function factoryCopy(id, subject, context, payKnown){
  return await askJson(
`Write the words for the website of this business. You are writing CONTENT
ONLY as structured data. Do not write HTML, do not describe layout, do not
mention design.

BUSINESS: ${id.name} — ${id.tagline}
IT DOES: ${subject}
BUYER: ${id.buyer}
PROMISE: ${id.promise}
${context}
${payKnown ? 'A real payment gateway is connected, so pricing may say "Pay now".'
           : 'No payment gateway yet, so the call to action is email or phone.'}

${ANTI_AI}

Price in INR at a level a small Ludhiana business will actually approve
without a meeting. Three tiers. The middle one is the one you expect them to
pick. Monthly recurring where the service is ongoing.

Return ONLY this JSON:
{"headline":"under 12 words, states the outcome",
 "subhead":"one or two sentences, plain, what it is and who for",
 "ctaPrimary":"3-4 words on the main button",
 "problem":{"title":"heading","paras":["2 or 3 short paragraphs naming the specific pain, no statistics"]},
 "service":{"title":"heading","items":[{"h":"short name of the thing delivered","p":"one or two sentences, concrete"}]},
 "how":{"title":"heading","steps":[{"h":"step name","p":"what happens, and how long it takes"}]},
 "forWhom":{"title":"heading","yes":["3-5 lines: who this is right for"],"no":["2-4 lines: who should NOT buy this — be honest, this sells"]},
 "tiers":[{"name":"tier name","amount":1500,"period":"per month or one-time","who":"one line on who picks this","features":["4-6 concrete lines"],"pick":false}],
 "faq":[{"q":"question a real sceptical buyer asks","a":"honest answer, including the awkward ones about being new"}],
 "about":{"title":"heading","paras":["2-3 paragraphs. It is one person in Ludhiana with no track record. Say so plainly and turn it into a reason to trust: direct access, no account manager, answers the phone himself. Never invent history."]},
 "contact":{"title":"heading","intro":"1-2 sentences","hours":"realistic working hours in IST"},
 "guarantee":"one honest sentence: what happens if the work is not done. Only promise something actually deliverable by one person."}

Exactly 3 tiers. Exactly one tier has "pick": true. 5 to 7 FAQ entries.`,
    'You write copy for small Indian B2B service firms. Plain, specific, unglamorous, honest.',
    'factory-copy','Revenue Streamer');
}

/* --------------------------------------------------------- THE TOOL ---- */
/* A landing page asks for money. A working tool proves you can build. This
   is a real single-file app the buyer can use in their browser, offline. */
async function factoryTool(id, subject, copy){
  const j = await askJson(
`Design ONE small, genuinely useful browser tool that this business gives
away free on its site. It must be real and working, not a demo.

BUSINESS: ${id.name} — ${subject}
BUYER: ${id.buyer}

RULES:
- It solves a small, real, immediate problem for the buyer, related to the
  paid service but not a crippled version of it. Free tool earns the trust,
  paid service does the ongoing work.
- Pure vanilla JavaScript. No libraries, no CDN, no fetch, no network calls.
  It must work with the wifi off.
- Data stays in the browser. If it stores anything, localStorage only, and
  the page must say so.
- Under 200 lines of JS. It must actually run — no placeholders, no TODO,
  no functions that return fake results.
- Do NOT write any CSS or any HTML <head>. Only the body content and script.
- Every element you create must be used. No dead controls.

Examples of the right SIZE of tool (do not copy, invent one that fits):
a GST-inclusive price calculator, a delivery-date counter that skips Sundays,
a bulk-order margin sheet, a fabric metre-to-piece converter.

Return ONLY this JSON:
{"title":"tool name, plain",
 "purpose":"one sentence: what it works out for them",
 "html":"the inner HTML of the tool: a heading, the inputs with labels and ids, an output area. No <html>, <head>, <body>, <style> or <script> tags.",
 "js":"the JavaScript that makes it work. Plain script body, no <script> tags, no imports."}`,
    'You build tiny, correct, dependency-free browser utilities that do exactly one thing.',
    'factory-tool','App Builder');

  const bad = /\b(fetch|XMLHttpRequest|import\s|require\(|eval\(|new Function|document\.write|innerHTML\s*=\s*[^;]*(location|cookie))/i;
  if(bad.test(String(j.js||''))) throw new Error('Tool code tried to use network or unsafe calls — rejected.');
  return j;
}

/* ------------------------------------------------------- LEGAL PAGES ---- */
/* Written in CODE, not by the model. Legal text is exactly where a
   hallucination becomes a liability, and Razorpay's KYC reviewer reads
   these four pages before approving a sole proprietor. */
function legalPages(id, copy){
  const y = new Date().getFullYear();
  const who = fEsc(id.legalName || id.name);
  const em  = fEsc(id.email);
  const ph  = id.phone ? fEsc(id.phone) : null;
  const addr= fEsc(id.address || 'Ludhiana, Punjab, India');
  const contactBlock = `<p><strong>${who}</strong><br>${addr}<br>
Email: <a href="mailto:${em}">${em}</a>${ph?`<br>Phone: ${ph}`:''}</p>`;

  const terms = `<div class="wrap"><section>
<h1>Terms of Service</h1>
<p class="small">Last updated ${new Date().toISOString().slice(0,10)}</p>
<p>These terms govern the services provided by ${who} ("we", "us") to the
customer ("you"). By placing an order or making a payment you accept them.</p>
<h2>1. What we provide</h2>
<p>${fEsc(id.promise)} The specific scope, price and duration of your engagement
are whatever is stated on the plan you purchase or in written correspondence
with us. Nothing outside that written scope is included.</p>
<h2>2. Payment</h2>
<p>All prices are in Indian Rupees and are payable in advance unless agreed
otherwise in writing. Recurring plans are billed for the period stated on the
plan. We may revise prices for future periods with at least 15 days' notice;
your current paid period is not affected.</p>
<h2>3. Your responsibilities</h2>
<p>You confirm that you own, or are authorised to act for, any website,
account, business or data you ask us to work on. You are responsible for the
accuracy of the information you give us. We are not able to work on systems
we have not been given lawful access to.</p>
<h2>4. Availability and limits</h2>
<p>We operate as a small business. Services are provided on a best-effort
basis during the working hours published on our contact page. We do not
guarantee uninterrupted service and we depend on third-party networks and
providers outside our control.</p>
<h2>5. Liability</h2>
<p>Our total liability for any claim arising out of these terms is limited to
the amount you paid us for the service in the three months preceding the
claim. We are not liable for indirect or consequential loss, including loss of
profit, business or data.</p>
<h2>6. Ending the agreement</h2>
<p>Either side may end an ongoing service at any time with written notice.
Refunds, where applicable, are handled under our Refund and Cancellation
Policy.</p>
<h2>7. Governing law</h2>
<p>These terms are governed by the laws of India. The courts at Ludhiana,
Punjab shall have exclusive jurisdiction.</p>
<h2>8. Contact</h2>
${contactBlock}
</section></div>`;

  const privacy = `<div class="wrap"><section>
<h1>Privacy Policy</h1>
<p class="small">Last updated ${new Date().toISOString().slice(0,10)}</p>
<p>${who} respects your privacy. This policy explains what we collect, why,
and what we do with it. It is deliberately short because we collect very
little.</p>
<h2>What we collect</h2>
<table class="plain"><tbody>
<tr><th>Data</th><th>Why</th></tr>
<tr><td>Name, email address, phone number</td><td>To contact you about the service you asked for and to raise invoices.</td></tr>
<tr><td>Business name and address</td><td>To issue a valid invoice.</td></tr>
<tr><td>Website addresses or account details you give us</td><td>To perform the service you are paying for.</td></tr>
<tr><td>Payment reference and amount</td><td>Accounting and reconciliation.</td></tr>
</tbody></table>
<h2>What we do not collect</h2>
<p>We do not store your card, UPI or bank credentials at any time. Payments
are handled entirely by our payment gateway on their systems. We do not use
advertising trackers, and we do not sell or rent your data to anyone, ever.</p>
<h2>Who else sees it</h2>
<p>Only service providers strictly required to deliver the service: our
payment gateway for the transaction, and our email provider for correspondence.
Each is bound by its own privacy terms.</p>
<h2>How long we keep it</h2>
<p>Correspondence and invoices are retained for as long as Indian tax law
requires. Operational data relating to your service is deleted within 90 days
of the service ending, on request or automatically.</p>
<h2>Your rights</h2>
<p>Email us and we will tell you exactly what we hold about you, correct it,
or delete it. We aim to respond within 7 working days.</p>
<h2>Contact</h2>
${contactBlock}
</section></div>`;

  const refund = `<div class="wrap"><section>
<h1>Refund and Cancellation Policy</h1>
<p class="small">Last updated ${new Date().toISOString().slice(0,10)}</p>
<h2>Cancelling an ongoing service</h2>
<p>You can cancel at any time by email. Cancellation takes effect at the end
of the period you have already paid for. We do not lock you into a contract
and we do not charge a cancellation fee.</p>
<h2>Refunds</h2>
<ul>
<li>If we have not started work, you get a full refund.</li>
<li>If we have started but not delivered what was agreed, you get a pro-rata
refund for the undelivered part.</li>
<li>If the service was delivered as described, the fee for that period is not
refundable.</li>
<li>If we are at fault — we failed to deliver what this site promises — tell
us and we will refund that period in full. ${fEsc(copy.guarantee||'')}</li>
</ul>
<h2>How to request one</h2>
<p>Email <a href="mailto:${em}">${em}</a> with your payment reference and what
went wrong. We will reply within 3 working days.</p>
<h2>How long it takes</h2>
<p>Approved refunds are issued to the original payment method within 7 working
days. Your bank may take a further 5 to 7 working days to show it.</p>
<h2>Contact</h2>
${contactBlock}
</section></div>`;

  const shipping = `<div class="wrap"><section>
<h1>Service Delivery Policy</h1>
<p class="small">Last updated ${new Date().toISOString().slice(0,10)}</p>
<p>${who} sells services, not physical goods. Nothing is shipped and there is
no delivery charge.</p>
<h2>When service starts</h2>
<p>Setup begins within one working day of payment being confirmed and of your
having given us the access or information we need to start. You receive
written confirmation by email when it is live.</p>
<h2>How it is delivered</h2>
<p>Entirely online and by email, to the address you gave at the time of
purchase. Where the plan includes visits or calls, those are scheduled with
you directly.</p>
<h2>Where we serve</h2>
<p>India. Correspondence is in English, Hindi or Punjabi.</p>
<h2>If something is delayed</h2>
<p>We will tell you before the due date, not after, and give a revised date.
If a delay is our fault and you no longer want the service, our Refund Policy
applies.</p>
<h2>Contact</h2>
${contactBlock}
</section></div>`;

  return { terms, privacy, refund, shipping };
}

/* -------------------------------------------------- PAGE COMPOSITION ---- */
function payButton(href, label, cls){
  const mailto = /^mailto:/.test(href);
  return `<a class="btn${cls?' '+cls:''}" href="${fEsc(href)}"${mailto?'':' rel="noopener"'}>${fEsc(label)}</a>`;
}
function money(n){ return 'Rs ' + Number(n||0).toLocaleString('en-IN'); }

function pageHome(id, copy, links){
  const t = copy.tiers||[];
  const pick = t.find(x=>x.pick) || t[1] || t[0] || null;
  return `<div class="hero"><div class="wrap">
 <h1>${fEsc(copy.headline)}</h1>
 <p class="lede">${fEsc(copy.subhead)}</p>
 <div class="actions">
  ${payButton(pick ? (links[pick.name]||links._contact) : links._contact, copy.ctaPrimary||'Get started')}
  <a class="btn ghost" href="pricing.html">See pricing</a>
 </div>
</div></div>

<section><div class="wrap">
 <h2>${fEsc(copy.problem.title)}</h2>
 ${(copy.problem.paras||[]).map(p=>`<p>${fEsc(p)}</p>`).join('\n ')}
</div></section>

<section><div class="wrap">
 <h2>${fEsc(copy.service.title)}</h2>
 <div class="cols">
  ${(copy.service.items||[]).map(i=>`<div class="card"><h3>${fEsc(i.h)}</h3><p>${fEsc(i.p)}</p></div>`).join('\n  ')}
 </div>
</div></section>

<section><div class="wrap">
 <h2>${fEsc(copy.forWhom.title)}</h2>
 <div class="cols">
  <div><h3>This is for you if</h3><ul>${(copy.forWhom.yes||[]).map(x=>`<li>${fEsc(x)}</li>`).join('')}</ul></div>
  <div><h3>This is not for you if</h3><ul>${(copy.forWhom.no||[]).map(x=>`<li>${fEsc(x)}</li>`).join('')}</ul></div>
 </div>
</div></section>

<section><div class="wrap">
 <h2>What it costs</h2>
 <div class="cols">${tierCards(t, links)}</div>
 <p class="small" style="margin-top:18px">All prices in Indian Rupees. Full pricing detail on the <a href="pricing.html">pricing page</a>.</p>
</div></section>`;
}

function tierCards(tiers, links){
  return (tiers||[]).map(x=>`<div class="price${x.pick?' pick':''}">
   <h3 style="margin:0">${fEsc(x.name)}</h3>
   <div class="amt">${money(x.amount)}</div>
   <div class="small">${fEsc(x.period||'')}</div>
   <p class="small" style="margin-top:10px">${fEsc(x.who||'')}</p>
   <ul>${(x.features||[]).map(f=>`<li>${fEsc(f)}</li>`).join('')}</ul>
   ${payButton(links[x.name]||links._contact, links[x.name]?'Pay '+money(x.amount):'Enquire', x.pick?'':'ghost')}
  </div>`).join('\n  ');
}

function pagePricing(id, copy, links, payOn){
  return `<div class="wrap"><section>
 <h1>Pricing</h1>
 <p class="lede">No setup fee. No contract. Cancel by email at any time.</p>
 <div class="cols" style="margin-top:26px">${tierCards(copy.tiers, links)}</div>
 <div class="notice"><strong>Our guarantee.</strong> ${fEsc(copy.guarantee||'')}</div>
 ${payOn ? '' : `<p class="small">Payment links are issued by email once you confirm the plan.</p>`}
 <h2>Questions people ask before paying</h2>
 <dl class="faq">${(copy.faq||[]).map(f=>`<dt>${fEsc(f.q)}</dt><dd>${fEsc(f.a)}</dd>`).join('\n  ')}</dl>
 <p style="margin-top:26px">Still unsure? <a href="contact.html">Ask directly</a> — you will get a straight answer, not a sales call.</p>
</section></div>`;
}

function pageHow(id, copy, links){
  const steps = copy.how.steps||[];
  return `<div class="wrap"><section>
 <h1>${fEsc(copy.how.title)}</h1>
 <p class="lede">${fEsc(copy.subhead)}</p>
 <table class="plain" style="margin-top:26px"><tbody>
 ${steps.map((s,i)=>`<tr><th style="width:60px">${String(i+1).padStart(2,'0')}</th>
   <td><strong>${fEsc(s.h)}</strong><br>${fEsc(s.p)}</td></tr>`).join('\n ')}
 </tbody></table>
 <div class="actions">${payButton(links._contact,'Start the first step')}
  <a class="btn ghost" href="pricing.html">See pricing</a></div>
</section></div>`;
}

function pageAbout(id, copy){
  return `<div class="wrap"><section>
 <h1>${fEsc(copy.about.title)}</h1>
 ${(copy.about.paras||[]).map(p=>`<p>${fEsc(p)}</p>`).join('\n ')}
 <div class="notice">We have deliberately put no testimonials, no client logos
 and no statistics on this website. This is a new business. Anything in that
 space would be invented, and you would be right not to trust it. Judge the
 work instead — <a href="contact.html">ask for it on one site, free, for a week</a>.</div>
 <h2>Where we are</h2>
 <p>${fEsc(id.address||'Ludhiana, Punjab, India')}. Work is done remotely; in
 Ludhiana we can come to you.</p>
</section></div>`;
}

function pageContact(id, copy, links){
  const em = fEsc(id.email);
  return `<div class="wrap"><section>
 <h1>${fEsc(copy.contact.title)}</h1>
 <p class="lede">${fEsc(copy.contact.intro)}</p>
 <table class="plain" style="max-width:520px;margin-top:22px"><tbody>
  <tr><th>Email</th><td><a href="mailto:${em}">${em}</a></td></tr>
  ${id.phone?`<tr><th>Phone</th><td><a href="tel:${fEsc(String(id.phone).replace(/[^\d+]/g,''))}">${fEsc(id.phone)}</a></td></tr>`:''}
  ${id.whatsapp?`<tr><th>WhatsApp</th><td><a href="https://wa.me/${fEsc(String(id.whatsapp).replace(/[^\d]/g,''))}">${fEsc(id.whatsapp)}</a></td></tr>`:''}
  <tr><th>Hours</th><td>${fEsc(copy.contact.hours||'Monday to Saturday, 10:00 to 19:00 IST')}</td></tr>
  <tr><th>Based in</th><td>${fEsc(id.address||'Ludhiana, Punjab, India')}</td></tr>
 </tbody></table>
 <div class="actions">${payButton('mailto:'+id.email+'?subject='+encodeURIComponent('Enquiry — '+id.name),'Send an email')}</div>
 <p class="small" style="margin-top:24px">There is no contact form on this site
 on purpose. Forms on new sites break silently and the enquiry is lost. Email
 and phone always arrive.</p>
</section></div>`;
}

function pageTool(id, tool){
  return `<div class="wrap"><section>
 <h1>${fEsc(tool.title)}</h1>
 <p class="lede">${fEsc(tool.purpose)} Free, no sign-up. It runs entirely in your
 browser — nothing you type here is sent anywhere.</p>
 <div class="card" style="margin-top:24px">
${tool.html}
 </div>
 <p class="small" style="margin-top:20px">Built by ${fEsc(id.name)}. If this is
 useful, the <a href="pricing.html">paid service</a> does the ongoing work for you.</p>
</section>
<script>
(function(){
try{
${tool.js}
}catch(e){ console.error('tool error', e); }
})();
</script>
</div>`;
}

/* ------------------------------------------------------------ INVOICE ---- */
function invoiceHtml(id){
  return `<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice — ${fEsc(id.name)}</title>
<style>${FACTORY.css(id)}
.inv{max-width:800px;margin:30px auto;background:#fff;border:1px solid ${FACTORY.esc(id.rule||'#DDD9CF')};padding:38px}
.inv .top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:30px}
[contenteditable]{outline:1px dashed transparent;padding:1px 3px;border-radius:2px}
[contenteditable]:hover{outline-color:#C9C4B8;background:#FBFAF6}
[contenteditable]:focus{outline:1px solid ${FACTORY.esc(id.brand||'#1F3A5F')};background:#fff}
.tot{text-align:right;font-size:20px;font-weight:600;margin-top:16px}
@media print{.noprint{display:none}.inv{border:0;margin:0}body{background:#fff}}
</style></head><body>
<div class="inv">
 <div class="noprint small" style="margin-bottom:18px;color:#807B71">
  Click any text to edit it, then use your browser's Print → Save as PDF.
  Nothing here is uploaded anywhere.</div>
 <div class="top">
  <div>${FACTORY.logoSvg(id)}
   <div style="margin-top:8px"><strong>${fEsc(id.legalName||id.name)}</strong><br>
   <span class="small">${fEsc(id.address||'Ludhiana, Punjab, India')}<br>
   ${fEsc(id.email)}${id.phone?' · '+fEsc(id.phone):''}${id.gstin?'<br>GSTIN: '+fEsc(id.gstin):''}</span></div></div>
  <div style="text-align:right">
   <h2 style="margin:0">INVOICE</h2>
   <div class="small">No. <span contenteditable>INV-001</span><br>
   Date: <span contenteditable>${new Date().toISOString().slice(0,10)}</span><br>
   Due: <span contenteditable>On receipt</span></div></div>
 </div>
 <p class="small" style="text-transform:uppercase;letter-spacing:.06em;color:#6B675E">Bill to</p>
 <p contenteditable>Client name<br>Client address<br>Client GSTIN (if any)</p>
 <table class="plain" style="margin-top:20px"><thead><tr>
  <th>Description</th><th style="width:90px">Qty</th><th style="width:130px">Rate (Rs)</th><th style="width:130px">Amount (Rs)</th>
 </tr></thead><tbody>
  <tr><td contenteditable>${fEsc(id.promise||'Service')} — monthly</td><td contenteditable>1</td><td contenteditable>0</td><td contenteditable>0</td></tr>
  <tr><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td></tr>
 </tbody></table>
 <div class="tot">Total: Rs <span contenteditable>0</span></div>
 <hr>
 <p class="small"><strong>Payment</strong><br>
 <span contenteditable>Bank name / Account number / IFSC / UPI ID — fill this in once and keep this file.</span></p>
 <p class="small"><span contenteditable>No GST charged — supplier is below the registration threshold.</span>
 Delete that line once you are GST registered and add your rate.</p>
 <p class="small" style="margin-top:22px;color:#807B71">
 ${fEsc(id.legalName||id.name)} · Sole proprietorship · Ludhiana, Punjab, India</p>
</div></body></html>`;
}

/* --------------------------------------------------------- OUTREACH ---- */
async function factoryOutreach(id, copy, siteNote){
  return await askJson(
`Write the messages the Owner sends to get the first customer. He is one
person in Ludhiana with a brand-new business and ZERO customers.

BUSINESS: ${id.name} — ${id.tagline}
BUYER: ${id.buyer}
CHEAPEST PLAN: ${money((copy.tiers&&copy.tiers[0]&&copy.tiers[0].amount)||0)}
${siteNote}

${ANTI_AI}

ABSOLUTE RULES FOR THESE MESSAGES:
- Never claim he has monitored, audited, analysed or noticed anything about
  the recipient's business unless the message explicitly tells him to check
  it first and put the real finding in.
- Never claim other customers, other clients, or any track record.
- The WhatsApp message must be under 60 words. Punjabi business owners read
  it on a phone between two other things.
- Offer something free and finite first. Asking a stranger for money in the
  first message is why every cold pitch fails.
- No "Hope you are doing well". No "I wanted to reach out".

Return ONLY this JSON:
{"whatsapp":"the message, under 60 words, ready to paste",
 "email":{"subject":"under 8 words, specific, not clever","body":"under 150 words, plain text, ends with one clear small ask"},
 "inPerson":"what he literally says walking into a shop, 3 sentences maximum",
 "followUp":"the message sent 4 days later if there is no reply, under 40 words",
 "firstTenTargets":["10 specific, findable kinds of business in Ludhiana to approach first — describe the type and where to find them, e.g. 'hosiery exporters listed on IndiaMART with a working website'"],
 "objections":[{"they":"what they say to refuse","you":"the honest one-line reply"}]}`,
    'You write cold outreach that a sceptical Indian small-business owner replies to. Short, useful, no flattery.',
    'factory-outreach','Growth Conductor');
}

/* ================================================== THE BUILD ITSELF ==== */
async function buildBusiness(opts){
  opts = opts || {};
  const v = opts.ventureId ? S.ventures.find(x=>x.id===opts.ventureId) : null;
  const idea = v ? S.ideas.find(i=>i.id===v.ideaId) : null;
  const brief = (opts.brief||'').trim();

  if(!v && !brief) throw new Error('Pick a researched venture, or write a brief. He will not build a business on nothing.');
  if(!S.owner || !S.owner.email) throw new Error('Set your email in Owner Settings first — it goes on every page, invoice and policy.');

  const subject = v ? `${v.title}. ${v.revenuePath||''}` : brief;
  const context = idea && idea.research
    ? `RESEARCH ON FILE — scored ${idea.score}/100 (${idea.verdict}).
${idea.research.reasoning}
Named buyer: ${idea.buyer}. Price point discussed: Rs ${idea.price}.`
    : 'No formal research on file — the Owner supplied this brief directly.';

  const steps = [];
  const t0 = Date.now();
  const mark = (s,note)=>{ steps.push({s,note,ms:Date.now()-t0});
    log('INFO','FACTORY',`${s}${note?' — '+note:''}`); };

  /* 1 — identity */
  mark('Naming the business and setting the house style');
  const raw = await factoryIdentity(subject, context);
  const id = {
    name: String(raw.name||'').slice(0,40) || 'New Venture',
    legalName: String(raw.legalName||raw.name||'').slice(0,60),
    tagline: String(raw.tagline||'').slice(0,90),
    brand: raw.brand, ink: raw.ink, paper: raw.paper, rule: raw.rule,
    fontIndex: Number(raw.fontIndex)||0,
    buyer: raw.buyer||'', promise: raw.promise||'',
    email: S.owner.email,
    phone: (S.owner.phone||opts.phone||'').trim(),
    whatsapp: (opts.whatsapp||S.owner.phone||'').trim(),
    address: (opts.address||'Ludhiana, Punjab, India').trim(),
    gstin: (opts.gstin||'').trim(),
  };
  /* the model loves startup suffixes; refuse them in code, not in a prompt */
  if(/(ify|ly|sy|io|ai|tech|hub|nexus|verse|sphere|genius|guru|ninja)$/i.test(id.name.replace(/\s+/g,'')))
    mark('WARNING: name still has a startup suffix', id.name);

  /* 2 — copy, audited, one forced rewrite if it reads like a machine */
  mark('Writing the copy');
  let copy = await factoryCopy(id, subject, context, !!S.pay);
  let tells = FACTORY.audit(JSON.stringify(copy));
  let rewrote = false;
  if(tells.length){
    mark(`Copy failed the realness audit (${tells.length} tells) — forcing a rewrite`);
    const list = tells.map(h=>`- "${h.found}" → ${h.why}`).join('\n');
    const r2 = await askJson(
`Rewrite this website copy. It was rejected because it reads as machine-written.

WHAT WAS FLAGGED:
${list}

Remove every flagged phrase and pattern. Do not substitute a different
cliché. Where a flagged sentence carried no information, delete it entirely
rather than rephrasing it — most of them carry none.

${ANTI_AI}

Return the SAME JSON structure, corrected:
${JSON.stringify(copy).slice(0,7000)}`,
      'You strip marketing filler out of copy until only facts remain.',
      'factory-copy-fix','Revenue Streamer');
    if(r2 && r2.tiers) { copy = r2; rewrote = true; }
    tells = FACTORY.audit(JSON.stringify(copy));
    mark(rewrote ? `Rewrite done — ${tells.length} tells remain` : 'Rewrite failed, keeping original');
  } else mark('Copy passed the realness audit clean');

  /* normalise tiers so the templates never break on a bad model reply */
  copy.tiers = (Array.isArray(copy.tiers)?copy.tiers:[]).slice(0,3)
    .map(x=>({ name:String(x.name||'Plan').slice(0,30), amount:Math.max(0,Math.round(+x.amount||0)),
               period:String(x.period||'per month').slice(0,30), who:String(x.who||'').slice(0,140),
               features:(Array.isArray(x.features)?x.features:[]).slice(0,8).map(f=>String(f).slice(0,120)),
               pick:!!x.pick }));
  if(!copy.tiers.length) throw new Error('The model returned no pricing tiers. Rebuild, or use a stronger model.');
  if(!copy.tiers.some(t=>t.pick)) copy.tiers[Math.min(1,copy.tiers.length-1)].pick = true;
  ['problem','service','how','forWhom','about','contact'].forEach(k=>{ copy[k] = copy[k]||{}; });
  copy.problem.paras = copy.problem.paras||[]; copy.service.items = copy.service.items||[];
  copy.how.steps = copy.how.steps||[]; copy.forWhom.yes = copy.forWhom.yes||[];
  copy.forWhom.no = copy.forWhom.no||[]; copy.about.paras = copy.about.paras||[];
  copy.faq = copy.faq||[];

  /* 3 — real payment links, one per tier */
  const links = { _contact: 'mailto:'+id.email+'?subject='+encodeURIComponent('Enquiry — '+id.name) };
  let payNote = 'No payment gateway connected — every button is an email link.';
  if(S.pay && !S.pay.live){
    const G = PAY.GATEWAYS[S.pay.gateway];
    for(const t of copy.tiers){
      if(t.amount<=0) continue;
      try{
        const l = await G.link(S.pay, { amount:t.amount, description:`${id.name} — ${t.name}`,
          email:id.email, currency:'INR', ref:uid('REF') });
        links[t.name] = l.url;
        S.orders.unshift({ id:l.id, t:nowIso(), url:l.url, amount:t.amount, currency:l.currency,
          desc:`${id.name} — ${t.name}`, customer:'(site button)', gateway:S.pay.gateway,
          live:false, status:l.status, paid:0 });
      }catch(e){ mark('Payment link failed for tier '+t.name, e.message); }
    }
    S.orders = S.orders.slice(0,200);
    const n = copy.tiers.filter(t=>links[t.name]).length;
    payNote = `${n} real ${S.pay.gateway} TEST payment links wired into the buttons. Switch to live keys and rebuild before you send this to a customer.`;
    mark('Payment links created', n+' of '+copy.tiers.length);
  } else if(S.pay && S.pay.live){
    payNote = 'Gateway is in LIVE mode. Live links need your password per link, so buttons are email links. Raise them by hand in Payments and paste them in.';
    mark('Live mode — buttons left as email links (a live link needs your signature)');
  } else mark('No gateway — buttons are email links');

  /* 4 — the free tool */
  let tool = null;
  if(opts.tool !== false){
    mark('Building the free browser tool');
    try{ tool = await factoryTool(id, subject, copy); mark('Tool built', tool.title); }
    catch(e){ mark('Tool build failed — pack continues without it', e.message); }
  }

  /* 4b — is the trading name actually gettable as a domain?
     A business named something already taken is a business with no address. */
  let domainOpts = null;
  try{
    const sld = id.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(sld){
      const rs = await DOMAINS.checkMany(DOMAINS.expand(sld,['in','com','co.in']), {lanes:3,gap:220});
      domainOpts = rs.map(r=>({name:r.name,status:r.status,price:r.price,why:r.why||null}));
      const free = rs.filter(r=>r.status==='AVAILABLE');
      mark('Checked the trading name against live registries',
        free.length ? free.map(r=>r.name).join(', ')+' available'
                    : 'NONE FREE — the name is taken everywhere, consider renaming');
    }
  }catch(e){ mark('Domain check failed — pack continues without it', e.message); }

  /* 5 — legal (code-written) */
  mark('Writing the four policy pages Razorpay checks');
  const legal = legalPages(id, copy);

  /* 6 — outreach */
  mark('Writing the outreach scripts');
  let out = null;
  try{ out = await factoryOutreach(id, copy, payNote); }
  catch(e){ mark('Outreach generation failed', e.message); }

  /* 7 — compose every page through the house shell */
  const nav = FACTORY.PAGES;
  const files = [];
  const P = (f,title,html,desc)=>files.push({ name:'site/'+f, data:FACTORY.shell(id,f,title,html,{desc}) });

  P('index.html', id.name, pageHome(id,copy,links), copy.subhead);
  P('pricing.html','Pricing', pagePricing(id,copy,links,!!S.pay), 'Plans and prices in INR.');
  P('how-it-works.html', copy.how.title||'How it works', pageHow(id,copy,links), '');
  P('about.html', copy.about.title||'About', pageAbout(id,copy), '');
  P('contact.html', copy.contact.title||'Contact', pageContact(id,copy,links), '');
  P('terms.html','Terms of Service', legal.terms,'');
  P('privacy.html','Privacy Policy', legal.privacy,'');
  P('refund.html','Refund & Cancellation', legal.refund,'');
  P('shipping.html','Service Delivery', legal.shipping,'');
  if(tool) P('tool.html', tool.title, pageTool(id,tool), tool.purpose);

  files.push({ name:'site/robots.txt', data:'User-agent: *\nAllow: /\n' });
  files.push({ name:'site/_redirects', data:'/* /index.html 404\n' });
  files.push({ name:'invoice-template.html', data:invoiceHtml(id) });

  if(out){
    files.push({ name:'outreach/whatsapp.txt', data:String(out.whatsapp||'') });
    files.push({ name:'outreach/email.txt',
      data:`Subject: ${out.email&&out.email.subject||''}\n\n${out.email&&out.email.body||''}` });
    files.push({ name:'outreach/in-person.txt', data:String(out.inPerson||'') });
    files.push({ name:'outreach/follow-up.txt', data:String(out.followUp||'') });
    files.push({ name:'outreach/first-ten-targets.txt',
      data:(out.firstTenTargets||[]).map((x,i)=>`${i+1}. ${x}`).join('\n') });
    files.push({ name:'outreach/objections.txt',
      data:(out.objections||[]).map(o=>`THEY: ${o.they}\nYOU : ${o.you}\n`).join('\n') });
  }

  /* 8 — final audit over everything that ships */
  const shipped = files.filter(f=>/\.(html|txt)$/.test(f.name))
                       .map(f=>String(f.data)).join('\n');
  const finalTells = FACTORY.audit(shipped);
  mark('Final realness audit', finalTells.length ? finalTells.length+' tells left' : 'clean');

  files.push({ name:'README.txt', data:FACTORY.ownerReadme(id, files, S.pay) });
  if(finalTells.length)
    files.push({ name:'REALNESS-AUDIT.txt',
      data:`These phrases still read as machine-written. Open the file, find them,\nrewrite them in your own words. Each one costs you credibility.\n\n`
        + finalTells.map(h=>`  "${h.found}"\n    ${h.why}\n`).join('\n') });

  const bundle = FACTORY.zip(files);

  const biz = {
    id: uid('BIZ'), t: nowIso(),
    name: id.name, tagline: id.tagline, identity: id,
    ventureId: v ? v.id : null, subject,
    tiers: copy.tiers, tellCount: finalTells.length, tells: finalTells.slice(0,20),
    rewrote, payNote, hasTool: !!tool, toolTitle: tool?tool.title:null,
    domains: domainOpts,
    outreach: out, steps,
    fileList: files.map(f=>({ name:f.name, bytes:Buffer.byteLength(
      Buffer.isBuffer(f.data)?f.data:Buffer.from(String(f.data))) })),
    zipBytes: bundle.length,
    /* The HTML does NOT live in data.json. It goes to a gzipped blob, and
       the ZIP is rebuilt from it on download. Four packs inside the state
       file would push it past what the GitHub Contents API can sanely
       rewrite on every save. */
    blob: true,
    published: false, publishedUrl: '',
  };
  S.businesses = S.businesses || [];
  S.businesses.unshift(biz);
  /* files go to their own compressed blob, never into data.json */
  const bstat = await BLOBS.put(biz.id, files);
  log('INFO','FACTORY',
    `Pack stored out-of-band: ${(bstat.raw/1024).toFixed(0)} KB of files → ${(bstat.stored/1024).toFixed(0)} KB compressed (${bstat.ratio}:1). data.json stays lean.`);
  /* evict old packs' blobs so storage does not grow without bound */
  for(const old of S.businesses.slice(6)) await BLOBS.del(old.id);
  S.businesses = S.businesses.slice(0,6);
  save();
  log('OK','FACTORY',
    `"${id.name}" built — ${files.length} files, ${(bundle.length/1024).toFixed(1)} KB, `
    + (finalTells.length?`${finalTells.length} realness tells flagged`:'realness audit clean'));
  return biz;
}

CAPS['ai.build_business'] = { pillar:3, safe:true,
  desc:'Turn the newest launched venture into a complete business pack — site, tool, policies, invoice, outreach',
  async run(){
    const v = S.ventures[0];
    if(!v) return { msg:'No launched venture. Research and launch one first.', n:0 };
    if((S.businesses||[]).some(b=>b.ventureId===v.id))
      return { msg:`Business pack already built for "${v.title}".`, n:0 };
    const b = await buildBusiness({ ventureId:v.id });
    return { msg:`Business "${b.name}" built — ${b.fileList.length} files, ${(b.zipBytes/1024).toFixed(1)} KB.`,
      n:1, detail: b.tellCount ? `${b.tellCount} realness tells flagged for your edit.` : 'Realness audit clean.' };
  }};


/* ======================================================================
   DOMAIN DESK

   Two jobs, and the Chairman must never confuse them:

   1. CHECKING a name is free, instant and needs nobody's permission.
      RDAP is mandated by ICANN; every registry runs one. He can do this
      all day at zero cost, and he does it FOR you and for your clients.

   2. REGISTERING a name is a paid, licensed, KYC'd act. He cannot do it.
      Not "not yet" — structurally cannot. Writing into a registry needs
      an EPP credential issued to an accredited registrar, and money.
      He gets you to one click from it and stops.

   The business he CAN build here is the naming and brand-availability
   service, plus reseller margin once the Owner opens an account in his
   own name. That is stated honestly everywhere in this file.
   ====================================================================== */

const HOW_DOMAINS_WORK = `
THE CHAIN, TOP TO BOTTOM

  ICANN            writes the rules and accredits registrars.
   └─ REGISTRY     runs exactly one extension and owns its database.
      Verisign owns .com and .net. NIXI, a government-backed body in
      New Delhi, owns .in. Public Interest Registry owns .org.
       └─ REGISTRAR   accredited and contracted to write into that
          registry over a protocol called EPP. GoDaddy, Cloudflare,
          Porkbun, BigRock, Hostinger.
           └─ RESELLER   sells a registrar's stock under its own brand
              and keeps the margin. No accreditation needed.
               └─ THE CUSTOMER

NOBODY CREATES A DOMAIN
A domain is not manufactured. The registry already publishes a zone file
for its extension; registering inserts your name into it. You are renting
a row in someone else's database, one year at a time. Stop paying and it
is deleted and resold.

WHAT IT COSTS TO STAND AT EACH RUNG (checked August 2026)

  Become a REGISTRY (own a new .something)
    ICANN application fee              USD 227,000 one-time
    Annual ICANN fees                  USD 25,800
    Realistic year-one total           USD 350,000 to 1,200,000
    → Not a consideration. Stated only so the number is known.

  Become an ICANN-ACCREDITED REGISTRAR (.com, .net, .org)
    Application fee                    USD 3,500 non-refundable
    Annual accreditation fee           USD 4,000
    Variable ICANN fee                 ~USD 800-1,200 per quarter
    Proof of working capital           USD 70,000 must be demonstrated
    Liability insurance                USD 500,000 cover, mandatory
    Realistic fixed cost               ~USD 9,000-10,000 per year
    → Roughly Rs 8 lakh a year before selling one domain. You would
      need to push about 9,000+ domain-years annually just to beat
      buying at retail. Not viable.

  Become a .IN ACCREDITED REGISTRAR (NIXI, India only)
    One-time accreditation fee         Rs 50,000 non-refundable
    Minimum initial funding            Rs 75,000 total
      (Rs 50,000 fee + Rs 25,000 pre-paid registration balance)
    Plus technical qualification against NIXI's EPP test system
    → An order of magnitude cheaper than ICANN and India-only. Still
      real money and a real compliance burden. Revisit at volume.

  Become a RESELLER
    ResellerClub base slab deposit     USD 25 (about Rs 2,200)
    Some Indian resellers charge       Rs 4,999 one-time setup
    → This is the only rung reachable from zero. You sell at your own
      price and keep the difference. No accreditation, no insurance,
      no capital proof.

WHERE THE MARGIN ACTUALLY IS — the uncomfortable arithmetic
  Cloudflare sells .com at cost, about USD 10.46, roughly Rs 920.
  Porkbun sells at about USD 11.08, roughly Rs 975.
  A reseller's wholesale .com is around Rs 950-1,080.

  So "sell domains cheaper than the big providers" is already a solved
  and dead market. Cloudflare charges literally zero markup and can
  afford to forever, because domains are a loss-leader that feeds their
  real business. You cannot out-price a company that has priced at cost
  on purpose. Anyone telling you otherwise is selling you a reseller
  package.

  GoDaddy is beatable — they renew .com at about USD 22.99, roughly
  Rs 2,020, more than double wholesale. But you beat GoDaddy on price
  by pointing customers at Cloudflare, which earns you nothing.

  The money is NOT in the domain. It is in what surrounds it:
    · Finding the name. Availability search is free to run and the
      part customers actually find hard.
    · The bundle. Domain plus a built website plus email plus
      monitoring, one invoice, one person who answers the phone.
      Rs 950 of domain inside a Rs 8,000 package is invisible.
    · Doing it FOR them. A Ludhiana factory owner will not open a
      Cloudflare account, verify an email and configure nameservers.
      He will pay Rs 2,000 for someone to hand him a working website
      at a name he likes.
  Sell the outcome. The domain is a line item, not the product.
`;

/* -------------------------------------------------- CAPABILITIES ---- */

CAPS['dom.check_own'] = { pillar:2, safe:true,
  desc:"Re-check the Owner's watchlist of domains and flag any that freed up",
  async run(){
    const w = (S.domains && S.domains.watch) || [];
    if(!w.length) return { msg:'Watchlist empty. Add names in Domain Desk.', n:0 };
    const rs = await DOMAINS.checkMany(w.map(x=>x.name), { lanes:2, gap:400 });
    let freed = 0, changed = [];
    for(const r of rs){
      const item = w.find(x=>x.name===r.name);
      if(!item) continue;
      const was = item.status;
      item.status = r.status; item.checked = nowIso();
      item.expires = r.expires || item.expires;
      item.registrar = r.registrar || item.registrar;
      if(was === 'TAKEN' && r.status === 'AVAILABLE'){
        freed++; changed.push(r.name);
        log('OK','DOMAIN DESK',`"${r.name}" HAS BEEN RELEASED and is available right now. Someone will take it.`);
      }
    }
    save();
    return { msg:`Re-checked ${rs.length} watched name(s). ${freed} freed up.`,
      n:rs.length, detail: freed ? 'FREE NOW: '+changed.join(', ') : 'no changes' };
  }};

CAPS['dom.expiring_soon'] = { pillar:5, safe:true,
  desc:'Flag watched domains expiring within 60 days — the moment to approach that owner',
  async run(){
    const w = (S.domains && S.domains.watch) || [];
    const soon = w.filter(x=>{
      if(!x.expires) return false;
      const d = (new Date(x.expires) - Date.now()) / 86400000;
      return d > 0 && d < 60;
    });
    if(!soon.length) return { msg:'Nothing on the watchlist expires within 60 days.', n:0 };
    return { msg:`${soon.length} watched name(s) expire within 60 days.`, n:soon.length,
      detail: soon.map(x=>`${x.name} on ${String(x.expires).slice(0,10)}`).join('; ') };
  }};

/* -------------------------------------------- NAME GENERATION ---- */
/* He invents candidate names, then EVERY ONE is checked against the live
   registry. A suggested name that turns out to be taken is worse than no
   suggestion — so nothing is shown until RDAP has ruled on it. */
async function suggestNames(brief, tlds, count){
  if(!S.llm) throw new Error('CONNECT AN AI BRAIN FIRST');
  const want = Math.min(24, Math.max(6, +count || 14));

  const j = await askJson(
`Invent ${want} candidate domain names for this business.

BUSINESS: ${brief}
Owner is one person in Ludhiana, Punjab, India. Sells to Indian businesses.

${ANTI_AI}

NAMING RULES — these matter more than cleverness:
- It must survive being said down a bad phone line to a 55-year-old
  factory owner. If he has to spell it twice, it is dead.
- No invented Latin. No -ify, -ly, -io, -sy, -ai, -tech, -hub, -nexus,
  -verse, -sphere, -genius, -ninja, -guru suffixes. Those brand you as
  a weekend project.
- No double letters at a word join. No numbers substituting letters.
- Under 15 characters in the name part, ideally under 11.
- Draw on things that are real and local where it fits: Punjabi and
  Hindi words a business owner already knows, Ludhiana landmarks,
  trades, seasons, plain English nouns. A real word beats a coined one.
- Mix the registers: some plain-descriptive, some place-rooted, some
  short surname-style. Do not give ${want} variations of one idea.

Return ONLY a JSON array of ${want} objects:
[{"sld":"the name part only, lowercase, no dot, no extension",
  "why":"under 12 words: what it means and why it works",
  "register":"one of: descriptive, local, surname, plain"}]`,
    'You name small Indian B2B firms. Plain, sayable, unfashionable on purpose.',
    'domain-suggest','Growth Conductor');

  const arr = (Array.isArray(j) ? j : (j.names || j.suggestions || [])).slice(0, want);
  if(!arr.length) throw new Error('The model returned no names. Try again or use a stronger model.');

  const list = tlds && tlds.length ? tlds : ['in','com','co.in'];
  const jobs = [];
  for(const it of arr){
    const sld = String(it.sld||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
    if(!sld) continue;
    for(const t of list) jobs.push({ sld, tld:t, why:it.why||'', register:it.register||'', name:sld+'.'+t });
  }

  /* every single one is verified against the live registry */
  const results = await DOMAINS.checkMany(jobs.map(j=>j.name), { lanes:3, gap:220, cap:80 });
  const byName = {}; results.forEach(r=>{ byName[r.name] = r; });

  const rows = {};
  for(const j of jobs){
    const r = byName[j.name] || { status:'UNKNOWN' };
    rows[j.sld] = rows[j.sld] || { sld:j.sld, why:j.why, register:j.register, options:[] };
    rows[j.sld].options.push({ name:j.name, tld:j.tld, status:r.status,
      price:r.price||null, registrar:r.registrar||null, expires:r.expires||null,
      why:r.why||null });
  }
  const out = Object.values(rows);
  /* a name with a free .in or .com beats one with only a free .xyz */
  const rank = o=>{
    let s = 0;
    for(const x of o.options){
      if(x.status!=='AVAILABLE') continue;
      s += (x.tld==='in'||x.tld==='com') ? 10 : (x.tld==='co.in') ? 6 : 2;
    }
    return s - o.sld.length*0.1;
  };
  out.sort((a,b)=>rank(b)-rank(a));

  const run = { id:uid('DOM'), t:nowIso(), brief, tlds:list, rows:out,
    checked: results.length,
    available: results.filter(r=>r.status==='AVAILABLE').length,
    unknown: results.filter(r=>r.status==='UNKNOWN').length };
  S.domains = S.domains || { watch:[], runs:[] };
  S.domains.runs = S.domains.runs || [];
  S.domains.runs.unshift(run);
  S.domains.runs = S.domains.runs.slice(0,8);
  save();
  log('OK','DOMAIN DESK',
    `${out.length} names invented, ${results.length} live registry checks, ${run.available} available.`
    + (run.unknown ? ` ${run.unknown} could not be resolved and are NOT counted as free.` : ''));
  return run;
}

/* Whether the Owner should be a reseller yet — arithmetic, not opinion. */
function resellerMath(perMonth){
  const n = Math.max(0, Math.round(+perMonth || 0));
  const WHOLESALE_IN = 620;      /* indicative reseller cost, .in, INR */
  const RETAIL_IN    = 950;      /* what a small firm pays without shopping around */
  const marginEach   = RETAIL_IN - WHOLESALE_IN;
  const setup        = 4999;     /* typical Indian reseller onboarding */
  const yearProfit   = n * 12 * marginEach;
  return {
    perMonth:n, marginEach, setup,
    yearProfit,
    breakEvenDomains: Math.ceil(setup / marginEach),
    verdict: n < 15
      ? `At ${n} domains a month you make about Rs ${yearProfit.toLocaleString('en-IN')} a year — before a single hour of support. Do not open a reseller account. Register each client's domain on their own card at Cloudflare or Porkbun, charge for the setup, and keep zero renewal liability.`
      : `At ${n} a month a reseller account clears its Rs ${setup.toLocaleString('en-IN')} setup in about ${Math.ceil(setup/(n*marginEach))} month(s) and returns roughly Rs ${yearProfit.toLocaleString('en-IN')} a year. Worth doing — but you now own every renewal, every transfer dispute and every angry call at 11pm.`
  };
}


const CHANNELS = {
  email: { id:'email', label:'Email', auto:true,
    needs:'A Gmail app password in Mail Relay.',
    truth:'Fully automatic. Real SMTP from your own address. Free, unlimited within Gmail\'s ~500/day cap.' },
  whatsapp: { id:'whatsapp', label:'WhatsApp', auto:false,
    needs:'Your thumb.',
    truth:'Not automatable for free. The consumer app has no API; unofficial automation gets the number BANNED. He writes it and gives you a wa.me link — one tap, message pre-filled.' },
  gbp: { id:'gbp', label:'Google Business Profile', auto:false,
    needs:'Postcard or phone verification at your address.',
    truth:'The single highest-return free thing for a local Indian business. Cannot be automated — Google verifies a human at a real address. He fills in every field for you to paste.' },
  social: { id:'social', label:'Social posts', auto:false,
    needs:'You paste it.',
    truth:'Instagram/Facebook need a Meta app and OAuth. X charges for write access. He writes the posts and the image briefs; posting is manual.' },
  seo: { id:'seo', label:'Website content', auto:true,
    needs:'A built business to add pages to.',
    truth:'He writes real pages into your site pack. That is genuine SEO — content that answers what people search. Ranking still takes months and nobody can promise position one.' },
  inperson: { id:'inperson', label:'Walk in', auto:false,
    needs:'Shoes.',
    truth:'You are in Ludhiana, in the middle of your entire market. The highest-converting channel available to you and the one you keep skipping.' },
};

/* ---------------------------------------------------- PLAN ---- */
async function planCampaign(bizId, goal){
  const biz = (S.businesses||[]).find(x=>x.id===bizId);
  if(!biz) throw new Error('Build the business first. There is nothing to market.');

  const t = telemetry();
  const capability = `
WHAT HE CAN ACTUALLY SEND RIGHT NOW:
  Email via SMTP : ${t.smtp_ready ? 'ARMED — he can send real email himself' : 'NOT ARMED — no app password set, so he can send nothing'}
  Everything else: prepared for the Owner to send by hand.
Owner is one person in Ludhiana. No staff, no ad budget, no track record.
Business: ${biz.name} — ${biz.tagline}
Buyer: ${biz.buyer || 'unspecified'}
Cheapest plan: Rs ${(biz.tiers&&biz.tiers[0]&&biz.tiers[0].amount)||'?'}
Site published: ${biz.published ? biz.publishedUrl : 'NOT PUBLISHED YET — there is nowhere to send anyone'}`;

  const j = await askJson(
`Plan a two-week campaign to get the FIRST paying customer for this business.

${capability}
GOAL: ${goal || 'first paying customer'}

${ANTI_AI}

HARD CONSTRAINTS ON WHAT YOU MAY PROPOSE:
- Zero budget. No ads, no paid tools, no sponsorships.
- Do not propose posting to Instagram, Facebook, X or LinkedIn automatically.
  Those cannot be automated for free. Propose the CONTENT; the Owner posts it.
- Do not propose WhatsApp automation. Propose the message; he taps send.
- Never claim the Owner has existing customers, results or observations.
- Do not promise a Google ranking. Nobody can.
- Prefer things that work in week one over things that work in month six.

Return ONLY this JSON:
{"name":"campaign name, plain",
 "thesis":"one sentence: why this gets a customer and not just attention",
 "firstCustomerBy":"a realistic date range, and say plainly if it is unlikely",
 "actions":[
   {"channel":"one of: email, whatsapp, gbp, social, seo, inperson",
    "title":"what this action is",
    "why":"one line: why it moves money, not attention",
    "day":1,
    "minutes":20,
    "auto":false,
    "content":"the ACTUAL finished text to send or post. Not a description of it. Ready to use as-is.",
    "subject":"only for email actions",
    "target":"exactly who receives it",
    "doneWhen":"how the Owner knows it worked"}],
 "targets":["8-12 specific findable Ludhiana businesses or business types, with WHERE to find each"],
 "imageBriefs":[{"for":"which action","brief":"precise description to hand a free image tool","text":"any words that must appear in the image"}],
 "weekTwo":"one line: what changes in week two based on what week one taught you",
 "killCriteria":"the honest signal that this campaign is not working and should be stopped"}

6 to 10 actions. At least half must be things that can happen in the first three days.`,
    'You plan zero-budget campaigns for one-person Indian B2B businesses. Concrete, unglamorous, first-customer focused.',
    'campaign-plan','Growth Conductor');

  /* the model does not get to decide what is automatable — code does */
  const acts = (Array.isArray(j.actions)?j.actions:[]).slice(0,12).map((a,i)=>{
    const ch = CHANNELS[a.channel] ? a.channel : 'inperson';
    const canAuto = CHANNELS[ch].auto && (ch !== 'email' || telemetry().smtp_ready);
    return { id: uid('ACT'), n:i+1, channel:ch, title:String(a.title||'').slice(0,120),
      why:String(a.why||'').slice(0,200), day:Math.max(1,Math.min(14,+a.day||1)),
      minutes:Math.max(2,Math.min(240,+a.minutes||15)),
      auto: canAuto,                       /* never trust the model's own flag */
      autoBlocked: CHANNELS[ch].auto && !canAuto ? 'SMTP not armed' : null,
      content:String(a.content||''), subject:String(a.subject||'').slice(0,140),
      target:String(a.target||'').slice(0,200), doneWhen:String(a.doneWhen||'').slice(0,200),
      status:'PENDING', sentAt:null, result:null };
  });
  if(!acts.length) throw new Error('The model returned no actions. Try again or use a stronger model.');

  const camp = { id: uid('CAMP'), t: nowIso(), bizId, bizName: biz.name,
    name: String(j.name||'Campaign').slice(0,80),
    thesis: String(j.thesis||'').slice(0,300),
    firstCustomerBy: String(j.firstCustomerBy||'').slice(0,140),
    weekTwo: String(j.weekTwo||'').slice(0,300),
    killCriteria: String(j.killCriteria||'').slice(0,300),
    targets:(j.targets||[]).slice(0,14).map(x=>String(x).slice(0,220)),
    imageBriefs:(j.imageBriefs||[]).slice(0,8),
    actions: acts, status:'DRAFT', approvedAt:null,
    autoCount: acts.filter(a=>a.auto).length };

  S.campaigns = S.campaigns || [];
  S.campaigns.unshift(camp);
  S.campaigns = S.campaigns.slice(0,10);
  save();
  log('OK','GROWTH',
    `Campaign "${camp.name}" planned for ${biz.name} — ${acts.length} actions, ${camp.autoCount} he can send himself, ${acts.length-camp.autoCount} need your hand.`);
  return camp;
}

/* ------------------------------------------------ APPROVE + RUN ---- */
/* One tick approves the whole campaign. Then he executes ONLY the actions
   code has certified as automatable, and parks the rest on your desk. */
async function runCampaign(campId){
  const c = (S.campaigns||[]).find(x=>x.id===campId);
  if(!c) throw new Error('No such campaign');
  if(c.status === 'RUNNING') throw new Error('Already running');

  const willSend = c.actions.some(a=>a.auto && a.channel==='email');
  if(willSend && !S.smtpVerified)
    throw new Error('This campaign sends real email, but your mail credentials have never been proven against the real server. '
      + 'Run the SMTP preflight in Mail Relay first — it takes two seconds and tells you exactly what is wrong if anything is.');

  c.status = 'RUNNING'; c.approvedAt = nowIso();
  log('CRIT','GROWTH',`Campaign "${c.name}" APPROVED by Owner. Executing ${c.autoCount} automatic action(s).`);

  let sent = 0, parked = 0, failed = 0;
  for(const a of c.actions){
    if(!a.auto){
      /* becomes a job on the desk, with the words already written */
      S.missions.unshift({ id: uid('MSN'), t:nowIso(), status:'OPEN',
        title:`[${CHANNELS[a.channel].label}] ${a.title}`,
        why:`${a.why}  —  ${CHANNELS[a.channel].truth}`,
        minutes:a.minutes,
        steps:[ `Target: ${a.target}`,
                CHANNELS[a.channel].needs,
                'Copy the text below exactly. Do not improve it.',
                a.doneWhen ? 'Done when: '+a.doneWhen : 'Mark it done here afterwards.' ],
        script: a.subject ? `Subject: ${a.subject}\n\n${a.content}` : a.content,
        doneWhen: a.doneWhen || 'you have sent it',
        risk: CHANNELS[a.channel].auto ? (a.autoBlocked||'') : 'This channel cannot be automated for free — see the note above.',
        campaignId: c.id, actionId: a.id });
      a.status = 'ON_YOUR_DESK'; parked++;
      continue;
    }

    if(a.channel === 'email'){
      const to = (a.target||'').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if(!to){
        a.status = 'NEEDS_ADDRESS';
        a.result = 'No email address in the target. He will not guess an address — a bounce burns your sending reputation.';
        parked++;
        S.missions.unshift({ id: uid('MSN'), t:nowIso(), status:'OPEN',
          title:`Find the email address for: ${a.target}`.slice(0,110),
          why:'He has the message written and ready to send automatically. He is missing only the address. Find it and he sends it himself.',
          minutes:10,
          steps:['Look on their website contact page, IndiaMART listing, or Google Business Profile.',
                 'Paste it into the campaign action here.',
                 'He sends it the moment you do.'],
          script:'', doneWhen:'the address is filled in', risk:'Many small firms list only a phone number. If so, this becomes a call or a walk-in.',
          campaignId:c.id, actionId:a.id });
        continue;
      }
      try{
        await mail(a.subject || `Regarding your website`, a.content, 'OUTREACH', to[0]);
        a.status = 'SENT'; a.sentAt = nowIso(); sent++;
        S.outreach = S.outreach || [];
        S.outreach.unshift({ t:nowIso(), channel:'email', to:to[0],
          subject:a.subject||'', campaignId:c.id, bizId:c.bizId, replied:false });
        S.outreach = S.outreach.slice(0,200);
        log('OK','GROWTH',`Email actually sent to ${to[0]} — "${a.subject||''}"`);
      }catch(e){
        a.status = 'FAILED'; a.result = e.message; failed++;
        log('CRIT','GROWTH',`Email to ${to[0]} FAILED: ${e.message}`);
      }
    } else if(a.channel === 'seo'){
      /* real: append a content page into the business pack */
      a.status = 'ON_YOUR_DESK'; parked++;
      S.missions.unshift({ id: uid('MSN'), t:nowIso(), status:'OPEN',
        title:`Add this page to your site: ${a.title}`.slice(0,110),
        why:a.why, minutes:a.minutes,
        steps:['The page text is below.','Rebuild the business pack, or paste it into your live site.','Re-upload to Netlify.'],
        script:a.content, doneWhen:a.doneWhen||'the page is live',
        risk:'SEO takes months. Nobody can promise a ranking.',
        campaignId:c.id, actionId:a.id });
    }
  }

  S.missions = S.missions.slice(0,60);
  c.sent = sent; c.parked = parked; c.failed = failed;
  c.status = 'ACTIVE';
  save();
  log(sent?'OK':'WARN','GROWTH',
    `Campaign "${c.name}" running — ${sent} sent automatically, ${parked} on your desk, ${failed} failed.`);
  return { sent, parked, failed, campaign:c };
}

/* Fill in a missing address, then he sends it immediately. */
async function fillAddress(campId, actionId, email){
  const c = (S.campaigns||[]).find(x=>x.id===campId);
  if(!c) throw new Error('No such campaign');
  const a = c.actions.find(x=>x.id===actionId);
  if(!a) throw new Error('No such action');
  if(!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(String(email||'').trim()))
    throw new Error('That is not a valid email address.');
  if(!telemetry().smtp_ready) throw new Error('SMTP is not armed. Set a Gmail app password in Mail Relay first.');
  const to = email.trim();
  await mail(a.subject || 'Regarding your website', a.content, 'OUTREACH', to);
  a.status='SENT'; a.sentAt=nowIso(); a.target=to;
  S.outreach = S.outreach || [];
  S.outreach.unshift({ t:nowIso(), channel:'email', to, subject:a.subject||'',
    campaignId:c.id, bizId:c.bizId, replied:false });
  S.missions = (S.missions||[]).filter(m=>m.actionId!==actionId);
  c.sent = (c.sent||0)+1;
  log('OK','GROWTH',`Email actually sent to ${to} after you supplied the address.`);
  save();
  return { to };
}

CAPS['growth.followup'] = { pillar:5, safe:true,
  desc:'Flag outreach sent 4+ days ago with no reply — the follow-up is where most sales actually happen',
  async run(){
    const o = (S.outreach||[]).filter(x=>!x.replied);
    const due = o.filter(x=>(Date.now()-new Date(x.t+'Z').getTime())/86400000 >= 4);
    if(!due.length) return { msg:`${o.length} outreach message(s) open, none due for follow-up yet.`, n:0 };
    return { msg:`${due.length} message(s) sent 4+ days ago with no reply. Follow up — most sales close on the second touch.`,
      n:due.length, detail: due.slice(0,8).map(x=>x.to).join(', ') };
  }};

CAPS['growth.stalled'] = { pillar:5, safe:true,
  desc:'Say plainly whether the business is stalled and name the one thing blocking money',
  async run(){
    const B=(S.businesses||[]), C=(S.campaigns||[]), O=(S.outreach||[]);
    const blockers=[];
    if(!B.length) blockers.push('No business built. Nothing exists to sell.');
    else if(!B.some(x=>x.published)) blockers.push('A business is built but NOT PUBLISHED. There is nowhere to send a prospect.');
    if(!telemetry().smtp_ready) blockers.push('SMTP not armed — he cannot send a single email himself.');
    if(!S.pay) blockers.push('No payment gateway. Even a willing buyer cannot pay you.');
    if(!C.length) blockers.push('No campaign planned. Nobody knows this business exists.');
    else if(!O.length) blockers.push('Campaign exists but ZERO messages have actually gone out.');
    if(!blockers.length)
      return { msg:`${O.length} message(s) sent, ${B.filter(x=>x.published).length} business(es) live. Not stalled.`, n:0 };
    return { msg:`STALLED. ${blockers.length} thing(s) block money. First: ${blockers[0]}`,
      n:blockers.length, detail: blockers.join(' | ') };
  }};

/* ======================================================================
   CAPABILITY CLONING — the legitimate kind.
   Paste any product's URL. He studies WHAT IT DOES, then either combines
   agents he already has, or writes a new one. He never copies their code —
   he rebuilds the capability from a description of the outcome, which is
   how every competitor in every industry has always been built.
   ====================================================================== */
async function analyseProduct(url, hint){
  let page = null, evidence = '';
  if(/^https?:\/\//i.test(url)){
    try{
      page = await RESEARCH.readPage(url);
      evidence = `THEIR OWN PAGE (${page.title}):\n${page.text.slice(0,9000)}`;
    }catch(e){ evidence = `Could not read the page directly (${e.message}).`; }
  }
  /* what do people say it actually does, and where does it fall short */
  try{
    const host = /^https?:\/\//i.test(url) ? new URL(url).hostname.replace(/^www\./,'') : url;
    const hits = await RESEARCH.search(host + ' what it does pricing complaints', 5);
    if(hits.length) evidence += `\n\nWHAT PEOPLE SAY:\n` + hits.map(h=>`- ${h.title}: ${h.snippet}`).join('\n');
  }catch(e){}

  const have = Object.entries(CAPS).map(([k,v])=>`${k} — ${v.desc}`).join('\n');
  const conns = (S.connectors||[]).filter(c=>c.enabled!==false)
    .map(c=>`${c.name} (${c.note||c.base})`).join(', ') || 'none connected yet';

  const r = await think(
`Study this product and work out how to DO THE SAME JOB with agents.

TARGET: ${url}${hint?`\nOWNER'S NOTE: ${hint}`:''}

${evidence || 'No page content retrieved — reason from the name and your knowledge, and say so.'}

WHAT YOU ALREADY HAVE:
${have}

CONNECTORS AVAILABLE: ${conns}

Never copy their code or their words. Identify the JOB the product does for
its user, then design the shortest honest path to that same outcome using
what you have, or one new capability.

Be blunt about what is NOT reproducible without money, a licence, a dataset,
or a human. Do not pretend a free agent can replace a paid GPU cluster.

Return ONLY JSON:
{"does":"the core job it performs for a user, one sentence",
 "jobs":["the 3-6 distinct things it actually does"],
 "reuse":[{"cap":"an existing capability name","for":"which job it covers"}],
 "build":[{"name":"cap.new_name","desc":"what it would do","why_needed":"why nothing existing covers it"}],
 "needs_connector":["any external service required, or empty"],
 "cannot_do":["parts that genuinely require money, a licence, hardware or a human"],
 "verdict":"REBUILDABLE|PARTIAL|NOT_WORTH_IT",
 "honest_note":"the blunt truth about whether this is worth the Owner's time"}`,
    'You are a systems architect. You reverse-engineer outcomes, never source code. You state limits plainly.',
    'analyse-product','Market Signal');

  const j = jparse(r.text);
  const a = { id:uid('ANL'), t:nowIso(), url:String(url).slice(0,200),
    does:String(j.does||'').slice(0,300),
    jobs:(j.jobs||[]).map(x=>String(x).slice(0,160)).slice(0,8),
    reuse:(j.reuse||[]).filter(x=>x&&CAPS[x.cap]).slice(0,8),
    build:(j.build||[]).slice(0,4),
    needsConnector:(j.needs_connector||[]).map(String).slice(0,6),
    cannotDo:(j.cannot_do||[]).map(String).slice(0,6),
    verdict:String(j.verdict||'PARTIAL'),
    note:String(j.honest_note||'').slice(0,400),
    pageRead: !!page, status:'ANALYSED' };
  S.analyses = S.analyses || [];
  S.analyses.unshift(a); S.analyses = S.analyses.slice(0,20);
  log('OK','ARCHITECT',
    `Analysed ${a.url} — ${a.verdict}. Reuse ${a.reuse.length}, build ${a.build.length}, blocked ${a.cannotDo.length}.`);
  save();
  return a;
}

/* Build the missing pieces as a coordinated team — reuse first, write only
   what is genuinely missing. Each new capability still needs your signature. */
async function assembleTeam(analysisId){
  const a = (S.analyses||[]).find(x=>x.id===analysisId);
  if(!a) throw new Error('No such analysis');
  if(a.verdict === 'NOT_WORTH_IT')
    throw new Error('He judged this not worth building. Read his note before overriding.');

  const made = [], skipped = [];
  for(const spec of (a.build||[])){
    if(CAPS[spec.name]){ skipped.push(spec.name+' already exists'); continue; }
    try{
      const c = await writeCapability(
        `${spec.desc}. This is one part of rebuilding what ${a.url} does. `+
        `Specifically: ${spec.why_needed}`);
      made.push(c.name);
    }catch(e){ skipped.push(spec.name+': '+e.message); }
  }

  /* a named crew so the reused pieces are visibly working together */
  const crew = { id:uid('CREW'), t:nowIso(), analysisId:a.id,
    title:(a.does||a.url).slice(0,80), url:a.url,
    reuse:a.reuse.map(r=>r.cap), built:made, skipped,
    connectors:a.needsConnector, blocked:a.cannotDo };
  S.crews = S.crews || [];
  S.crews.unshift(crew); S.crews = S.crews.slice(0,20);
  a.status = 'ASSEMBLED';
  log('OK','ARCHITECT',
    `Crew for "${crew.title}": ${crew.reuse.length} reused, ${made.length} written${made.length?' (awaiting your signature)':''}.`);
  save();
  return crew;
}

/* ======================================================================
   WORKSPACE — upload a file, he reads it. Ask for an email or document,
   he writes it. This is the everyday-assistant surface.
   ====================================================================== */
function textFromUpload(name, mime, b64){
  const buf = Buffer.from(b64, 'base64');
  const lower = (name||'').toLowerCase();

  /* plain-ish formats: read directly */
  if(/\.(txt|md|csv|json|log|html|htm|xml|yml|yaml|js|ts|py|sql|ini|conf)$/.test(lower)
     || /^text\//.test(mime||'') || /json|xml|csv/.test(mime||'')){
    return buf.toString('utf8').slice(0, 200000);
  }

  /* PDF: pull the text streams. Works on most text-based PDFs, not scans. */
  if(/\.pdf$/.test(lower) || /pdf/.test(mime||'')){
    const raw = buf.toString('latin1');
    const chunks = [];
    const re = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]]|\\\])*)\]\s*TJ/g;
    let m;
    while((m = re.exec(raw)) && chunks.length < 9000){
      let t = m[1] || m[2] || '';
      t = t.replace(/\\([()\\])/g,'$1').replace(/\)\s*-?\d+(\.\d+)?\s*\(/g,'');
      t = t.replace(/[^\x20-\x7E\n]/g,'');
      if(t.trim()) chunks.push(t);
    }
    const out = chunks.join(' ').replace(/\s+/g,' ').trim();
    return out.length > 60 ? out.slice(0,200000)
      : '[PDF CONTAINS NO EXTRACTABLE TEXT — it is probably a scan or image. '
        + 'Retype the key lines, or export it as text from your PDF reader.]';
  }

  /* DOCX/XLSX are zip archives — readable strings only, honestly labelled */
  if(/\.(docx|xlsx|pptx)$/.test(lower)){
    const raw = buf.toString('utf8');
    const txt = (raw.match(/[\x20-\x7E]{6,}/g)||[]).join(' ').replace(/\s+/g,' ');
    return txt.length > 120
      ? '[PARTIAL EXTRACT from an Office file — formatting lost, some text may be missing]\n' + txt.slice(0,120000)
      : '[OFFICE FILE COULD NOT BE READ. Save it as .txt or .csv and upload again.]';
  }

  if(/^image\//.test(mime||''))
    return '[IMAGE FILE — this Chairman has no vision model, so he cannot see it. '
         + 'Describe what it shows and he can work with that.]';

  return '[UNSUPPORTED FILE TYPE. Supported: txt, md, csv, json, log, html, pdf (text-based).]';
}

async function draftFor(kind, brief, docIds){
  const ctx = (docIds||[]).map(id=>{
    const d = (S.docs||[]).find(x=>x.id===id);
    return d ? `--- FILE: ${d.name} ---\n${d.text.slice(0,14000)}` : '';
  }).filter(Boolean).join('\n\n');

  const shapes = {
    email:    'a complete email. Give SUBJECT: on the first line, then the body.',
    whatsapp: 'a WhatsApp message under 80 words. Plain Indian English, no emoji, no marketing language.',
    reply:    'a reply to the message in the brief. Match its tone. Be direct.',
    proposal: 'a one-page proposal: what you deliver, timeline, price in INR, next step.',
    invoice:  'a simple invoice with line items, total in INR, a UPI line and a GST placeholder.',
    summary:  'a summary: the 5 points that matter, then what to do about them.',
    doc:      'a clear document. Use headings. No filler.'
  };

  const r = await think(
`Write ${shapes[kind] || shapes.doc}

BRIEF FROM THE OWNER: ${brief}
${ctx ? `\nUSE THESE UPLOADED FILES AS THE SOURCE:\n${ctx}` : ''}

Owner: one person in Ludhiana, Punjab, India. No company, no staff, no track record yet.

RULES:
- Never invent facts, numbers, dates, names or achievements that are not in the brief or the files.
- If something essential is missing, write [NEED FROM YOU: ...] inline rather than guessing.
- Plain Indian English. No hype.
- Output ONLY the finished text, ready to copy and send.`,
    'You draft real business correspondence. Concise, honest, immediately usable.',
    'draft-'+kind, 'Insight Forge');

  const d = { id:uid('DRF'), t:nowIso(), kind, brief:String(brief).slice(0,200),
    text:r.text, docIds:docIds||[], bytes:Buffer.byteLength(r.text) };
  S.drafts.unshift(d); S.drafts = S.drafts.slice(0,40);
  log('OK','WORKSPACE',`Drafted a ${kind} (${d.bytes} bytes).`);
  save();
  return d;
}

/* ======================================================================
   CONNECTORS — any external service the Owner wants him to reach.
   Keys are stored, masked everywhere, and NEVER written to the ledger.
   Generated capability code can call a connector but can never read its key.
   ====================================================================== */
function connectorCall(name, opts){
  const c = (S.connectors||[]).find(x=>x.name===name && x.enabled!==false);
  if(!c) throw new Error('No connector named "'+name+'". Add it in Connectors.');
  return new Promise((resolve,reject)=>{
    /* join base + path without new URL() eating the base's own path */
    let u;
    try{
      const pth = String(opts.path||'');
      u = /^https?:\/\//i.test(pth)
        ? new URL(pth)
        : new URL(c.base.replace(/\/+$/,'') + (pth ? (pth.startsWith('/')?pth:'/'+pth) : ''));
    }catch(e){ return reject(new Error('bad url: '+e.message)); }
    const isHttps = u.protocol==='https:';
    const lib = isHttps ? require('https') : require('http');
    const body = opts.body ? (typeof opts.body==='string'?opts.body:JSON.stringify(opts.body)) : null;
    const headers = Object.assign({
      'Accept':'application/json',
      'User-Agent':'ChairmanAgentOS/1.0 (self-hosted; contact via owner)'
    }, c.headers||{});
    if(c.key){
      if(c.auth==='bearer')      headers['Authorization'] = 'Bearer '+c.key;
      else if(c.auth==='header') headers[c.headerName||'X-API-Key'] = c.key;
      else if(c.auth==='query')  u.searchParams.set(c.queryName||'key', c.key);
    }
    if(body){ headers['Content-Type']='application/json'; headers['Content-Length']=Buffer.byteLength(body); }
    const req = lib.request({hostname:u.hostname, port:u.port||undefined,
      path:u.pathname+u.search, method:opts.method||'GET', headers, timeout:20000}, res=>{
      let d=''; res.on('data',ch=>{ d+=ch; if(d.length>400000) res.destroy(); });
      res.on('end',()=>{
        c.calls=(c.calls||0)+1; c.lastAt=nowIso();
        if(res.statusCode>=400){ c.fails=(c.fails||0)+1; save();
          return reject(new Error(name+' returned HTTP '+res.statusCode+': '+d.slice(0,160))); }
        save();
        try{ resolve(JSON.parse(d)); }catch(e){ resolve({ text:d.slice(0,4000) }); }
      });
    });
    req.on('timeout',()=>{ req.destroy(); reject(new Error(name+' timed out')); });
    req.on('error',e=>reject(new Error(name+': '+(e.code||e.message))));
    if(body) req.write(body);
    req.end();
  });
}

/* ======================================================================
   SELF-EXTENSION — he writes genuinely NEW capabilities for himself.
   The code runs in a locked sandbox, is scanned for dangerous patterns
   before you ever see it, and only becomes real after you read the actual
   source and sign it. This is the difference between tuning settings and
   growing new abilities.
   ====================================================================== */

/* The only surface generated code can touch. Deliberately small. */
function capabilityAPI(){
  return {
    /* read-only views of real state */
    monitors: () => S.monitors.map(m=>({name:m.name,url:m.url,state:m.state,
      checks:m.checks||0,up:m.up||0,down:m.down||0,p95:m.p95||0,
      ssl:m.ssl?{days_left:m.ssl.days_left,issuer:m.ssl.issuer}:null})),
    agents:   () => S.agents.map(a=>({name:a.name,pillar:a.pillarId,status:a.status,tools:a.tools})),
    ideas:    () => S.ideas.map(i=>({title:i.title,score:i.score,verdict:i.verdict,status:i.status,price:i.price})),
    gates:    () => S.gates.map(g=>({title:g.title,cls:g.cls,risk:g.risk,status:g.status,cost:g.cost})),
    revenue:  () => S.revenue.map(r=>({src:r.src,amt:r.amt,t:r.t})),
    logs:     (n) => S.logs.slice(0, Math.min(120, n||40)).map(l=>({sev:l.sev,src:l.src,msg:l.msg})),
    telemetry:() => telemetry(),
    spend:    () => ({ authorized:S.spend||0, ceiling:S.budget||0, avoided:S.denials.reduce((a,b)=>a+b.cost,0) }),
    /* the one write it gets: leave a note in the ledger */
    note: (sev, msg) => { log(['OK','INFO','WARN','CRIT'].includes(sev)?sev:'INFO',
      'WRITTEN CAP', String(msg).slice(0,240)); return true; },
    /* connectors: it can CALL them, it can never read the key */
    connectors: () => (S.connectors||[]).filter(c=>c.enabled!==false)
      .map(c=>({ name:c.name, base:c.base, note:c.note||'' })),
    call: (name, opts) => connectorCall(name, opts||{})
  };
}

async function writeCapability(goal){
  if(!goal || !goal.trim()) throw new Error('Say what the new ability should do');
  const existing = Object.keys(CAPS).join(', ');
  const r = await think(
`Write a NEW capability for yourself. You are extending your own abilities.

WHAT IT MUST DO: ${goal}

You already have these, do not duplicate them: ${existing}

You are writing a JavaScript FUNCTION BODY. It receives one argument, api,
and must return an object {msg, n, detail}.

THE ONLY THINGS YOU CAN CALL — nothing else exists:
  api.monitors()      array of {name,url,state,checks,up,down,p95,ssl}
  api.agents()        array of {name,pillar,status,tools}
  api.ideas()         array of {title,score,verdict,status,price}
  api.gates()         array of {title,cls,risk,status,cost}
  api.revenue()       array of {src,amt,t}
  api.logs(n)         last n log entries {sev,src,msg}
  api.telemetry()     process metrics object
  api.spend()         {authorized, ceiling, avoided}
  api.note(sev,msg)   write one line to the audit ledger
  api.connectors()    list of connected services [{name, base, note}]
  api.call(name,opts) call a connector. opts = {path, method, body}
                      returns parsed JSON. You never see the API key.
                      Available right now: ${((S.connectors||[]).filter(c=>c.enabled!==false)
                        .map(c=>c.name+' ('+(c.note||c.base)+')').join(', ')) || 'none yet'}

FORBIDDEN and automatically rejected: require, process, fs, child_process,
eval, Function, import, globalThis, Buffer, prototype access, infinite loops.
No network. No filesystem. No shell.

Return ONLY JSON, no prose:
{"name":"cap.short_name","desc":"one line describing what it does",
 "pillar":1-5,
 "code":"the function body as a single JSON string, using \\n for newlines",
 "why":"why this is genuinely useful to the Owner",
 "risk":"what could go wrong with this code"}`,
    'You write small, safe, defensive JavaScript. Assume arrays may be empty. Never invent an api method that is not listed.',
    'self-extend','App Builder');

  const j = jparse(r.text);
  if(!j || !j.name || !j.code) throw new Error('Model did not return a usable capability');

  const name = String(j.name).replace(/[^a-z0-9._]/gi,'').slice(0,40);
  if(CAPS[name]) throw new Error(`"${name}" already exists`);

  /* scan BEFORE the owner is offered it */
  const violations = SANDBOX.scan(String(j.code));

  /* dry-run it against real state so the owner sees actual output, not a promise */
  let testRun = null, testError = null;
  if(!violations.length){
    try { testRun = await SANDBOX.runCapability(String(j.code), capabilityAPI(), 5000); }
    catch(e){ testError = e.message; }
  }

  const cap = { id:uid('CAP'), t:nowIso(), name, desc:String(j.desc||'').slice(0,160),
    pillar:Math.min(5,Math.max(1,+j.pillar||4)), code:String(j.code),
    why:String(j.why||'').slice(0,300), risk:String(j.risk||'').slice(0,300),
    violations, testRun, testError, status:'PENDING', bytes:String(j.code).length };
  S.writtenCaps.unshift(cap); S.writtenCaps = S.writtenCaps.slice(0,30);

  /* becomes a signed upgrade — same gate as everything else */
  propose('INSTALL_CAPABILITY',
    `He wrote a new ability for himself: ${name} — ${cap.desc}`,
    { capId:cap.id, name },
    violations.length ? `SANDBOX BLOCKED: ${violations.join('; ')}`
      : testError ? `dry-run failed: ${testError}`
      : `dry-run OK: ${testRun.msg}`,
    'self-extension');

  log(violations.length?'CRIT':'WARN','SELF-EXTEND',
    `Wrote capability "${name}" (${cap.bytes} bytes). ${violations.length?'BLOCKED by sandbox.':'Awaiting your signature.'}`);
  save();
  return cap;
}

/* SELF-REPAIR — his own written code broke, so he fixes his own code.
   Sandboxed and dry-run exactly like a new capability. Never touches the
   core system: a bug in that must be fixed by a human who can read a stack
   trace, not by a model guessing at a file it cannot see. */
let repairing = new Set();
async function repairCapability(capName, errMsg){
  if(repairing.has(capName)) return;
  const cap = (S.writtenCaps||[]).find(c=>c.name===capName && c.status==='INSTALLED');
  if(!cap) return;
  if((cap.repairs||0) >= 3){
    if(CAPS[capName]){ delete CAPS[capName]; cap.status='RETIRED'; cap.retired=nowIso();
      log('CRIT','SELF-REPAIR',`"${capName}" failed after 3 repair attempts. Retired so it stops wasting cycles.`);
      (S.tasks||[]).forEach(t=>{ if(t.cap===capName) t.enabled=false; });
      save(); }
    return;
  }
  repairing.add(capName);
  try{
    log('WARN','SELF-REPAIR',`"${capName}" failed twice. He is rewriting it.`);
    const r = await think(
`Your own capability is failing. Fix the code.

NAME: ${cap.name}
WHAT IT SHOULD DO: ${cap.desc}
THE ERROR IT THROWS: ${errMsg}

THE CURRENT CODE:
${cap.code}

The api object is the ONLY thing that exists. Nothing else. Available:
  api.monitors() api.agents() api.ideas() api.gates() api.revenue()
  api.logs(n) api.telemetry() api.spend() api.note(sev,msg)
  api.connectors() api.call(name,{path,method,body})

Common causes: reading a property of an empty array, assuming a field exists,
dividing by zero, calling an api method that is not on that list.

Rewrite it so it CANNOT throw. Guard every array. Default every number.
Return {msg, n, detail} in all paths, including when there is no data.

Return ONLY JSON: {"code":"the fixed function body as a JSON string","fix":"one line on what was wrong"}`,
      'You fix broken JavaScript defensively. Assume every input may be empty or missing.',
      'self-repair', 'Code Pipeline');

    const j = jparse(r.text);
    if(!j || !j.code) throw new Error('model returned no code');

    const violations = SANDBOX.scan(String(j.code));
    if(violations.length) throw new Error('rewrite blocked by sandbox: '+violations.join('; '));

    /* prove the fix works before adopting it */
    const test = await SANDBOX.runCapability(String(j.code), capabilityAPI(), 5000);

    const old = cap.code;
    cap.code = String(j.code);
    cap.repairs = (cap.repairs||0)+1;
    cap.repairLog = (cap.repairLog||[]);
    cap.repairLog.unshift({t:nowIso(), was:errMsg.slice(0,160),
      fix:String(j.fix||'').slice(0,200), verified:test.msg.slice(0,120)});
    cap.repairLog = cap.repairLog.slice(0,6);
    CAPS[capName] = { pillar:cap.pillar, safe:true, desc:cap.desc, written:true,
      async run(){ return SANDBOX.runCapability(cap.code, capabilityAPI(), 5000); } };
    (S.tasks||[]).forEach(t=>{ if(t.cap===capName){ t.fails=0; t.enabled=true; } });
    log('OK','SELF-REPAIR',`Fixed "${capName}" — ${j.fix}. Verified: ${test.msg}`);
    save();
    return { fixed:true, was:old.length, now:cap.code.length, note:j.fix };
  } finally { repairing.delete(capName); }
}

CAPS['ai.self_extend'] = { pillar:3, safe:true, desc:'Write a brand-new capability for himself, for your approval',
  async run(){
    const pending = (S.writtenCaps||[]).filter(c=>c.status==='PENDING').length;
    if(pending >= 2) return { msg:`${pending} written capabilities already awaiting your signature.`, n:0 };
    /* pick a gap he can actually see in his own state */
    const gaps = [];
    if(S.monitors.length && !CAPS['cap.slowest_target']) gaps.push('find the slowest monitored target and how much worse it is than the rest');
    if(S.ideas.length   && !CAPS['cap.idea_ranker'])     gaps.push('rank every researched idea by score against effort and name the single best');
    if(S.revenue.length && !CAPS['cap.revenue_trend'])   gaps.push('detect whether recorded revenue is rising or falling and by how much');
    gaps.push('summarise the most repeated warning in the audit ledger and how often it recurs');
    const c = await writeCapability(gaps[0]);
    return { msg:`Wrote "${c.name}" — ${c.violations.length?'sandbox blocked it':'awaiting your signature'}.`,
      n:1, detail:c.desc };
  }};

/* ======================================================================
   SELF-HEALING TEAM — when the system breaks, an agent diagnoses it and
   either fixes it outright or issues you the one action only a human can do.
   ====================================================================== */
function keyHealth(){
  const now = Date.now();
  const all = [];
  if(S.llm && S.llm.provider) all.push({...S.llm, role:'PRIMARY'});
  (S.llmBackups||[]).forEach(k=>all.push({...k, role:'BACKUP'}));
  return {
    total: all.length,
    ready: all.filter(k=>!(k.cooled>now)).length,
    cooling: all.filter(k=>k.cooled>now).length,
    providers: [...new Set(all.map(k=>k.provider))],
    detail: all.map(k=>`${k.role} ${k.provider}/${k.model} ${k.cooled>now?'COOLING':'ready'} (${k.ok||0} ok, ${k.fail||0} fail)`)
  };
}

/* Medic: runs without the AI so it still works when the AI is the problem. */
CAPS['team.medic'] = { pillar:1, safe:true, desc:'Diagnose the system and repair what can be repaired without you',
  async run(){
    const kh = keyHealth();
    const fixed = [], blocked = [];

    /* 1. revive keys whose cooldown has genuinely elapsed */
    const now = Date.now();
    let revived = 0;
    (S.llmBackups||[]).forEach(k=>{ if(k.cooled && k.cooled<=now){ k.cooled=0; revived++; } });
    if(S.llm && S.llm.cooled && S.llm.cooled<=now){ S.llm.cooled=0; revived++; }
    if(revived) fixed.push(`${revived} key(s) came off cooldown and were returned to the pool`);

    /* 2. clear a stale global pause */
    if(COOLDOWN_UNTIL && Date.now() >= COOLDOWN_UNTIL){ COOLDOWN_UNTIL=0; fixed.push('global pause expired and was cleared'); }

    /* 3. disable standing orders whose capability no longer exists */
    let orphan = 0;
    (S.tasks||[]).forEach(t=>{ if(!CAPS[t.cap] && t.enabled){ t.enabled=false; orphan++; } });
    if(orphan) fixed.push(`${orphan} standing order(s) pointed at missing capabilities and were disabled`);

    /* 4. restore an empty roster */
    if(S.owner && !S.agents.length){ seed(); fixed.push('agent roster was empty and has been reseeded'); }

    /* 5. flag what only the Owner can resolve */
    if(kh.ready === 0)
      blocked.push('NO USABLE AI KEY — every key is cooling or exhausted. Add one free key (Google AI Studio, Cerebras, NVIDIA NIM) and the system self-recovers.');
    if(kh.total === 1)
      blocked.push('SINGLE POINT OF FAILURE — only one AI key exists. One rate limit stops everything. A second free key removes this entirely.');
    if(!S.monitors.length)
      blocked.push('NO SITES MONITORED — the Uptime Marshal is watching nothing, so there is no evidence to sell.');
    if(!telemetry().smtp_ready && S.monitors.length)
      blocked.push('ALERTS UNDELIVERABLE — sites are monitored but no mail relay is armed.');
    if(S.owner && S.owner.bootstrap)
      blocked.push('BOOTSTRAP PASSWORD STILL LIVE — a plaintext copy exists on disk.');

    if(fixed.length) log('OK','TEAM MEDIC',`Repaired: ${fixed.join('; ')}`);
    if(blocked.length) log('WARN','TEAM MEDIC',`Needs you: ${blocked[0]}`);
    save();
    return {
      msg: `${fixed.length} repair(s) made, ${blocked.length} item(s) need you. Keys: ${kh.ready}/${kh.total} ready.`,
      n: fixed.length,
      detail: [...fixed.map(f=>'FIXED: '+f), ...blocked.map(b=>'NEEDS YOU: '+b)].join(' | ') || 'nothing to repair'
    };
  }};

/* Quartermaster: when keys run dry, issue the exact human steps to fix it. */
CAPS['team.quartermaster'] = { pillar:2, safe:true, desc:'When AI keys run out, issue the exact steps to add another',
  async run(){
    const kh = keyHealth();
    if(kh.ready > 1)
      return { msg:`${kh.ready} keys ready across ${kh.providers.length} provider(s). No action needed.`, n:0,
               detail: kh.detail.join(' | ') };

    const have = kh.providers;
    const options = [
      ['gemini','Google AI Studio','aistudio.google.com/apikey','1,500 requests/day','Sign in with Google, click Create API key. No card.'],
      ['cerebras','Cerebras','cloud.cerebras.ai','1,000,000 tokens/day','Sign up with email, go to API Keys. No card.'],
      ['nvidia','NVIDIA NIM','build.nvidia.com','120+ models, ~40 req/min','Email plus phone verification. No card.'],
      ['openrouter','OpenRouter','openrouter.ai/keys','50 requests/day free','Sign up, create a key. No card.'],
      ['groq','Groq','console.groq.com','~14,400 requests/day','Email only, no card. Fastest option.']
    ].filter(o=>!have.includes(o[0]));

    if(!options.length)
      return { msg:'Every supported free provider is already connected. Consider a paid key if limits still bite.', n:0 };

    const pick = options[0];
    const already = S.missions.some(m=>m.status==='OPEN' && /API key/i.test(m.title));
    if(!already){
      S.missions.unshift({
        id:uid('MSN'), t:nowIso(), ventureId:null,
        title:`Add a free ${pick[1]} key`,
        why:`Only ${kh.ready} AI key is usable, so a single rate limit halts the whole system. A second provider on a separate quota removes that.`,
        steps:[
          `Open ${pick[2]} in your browser`,
          pick[4],
          'Copy the key it shows you — it is usually displayed only once',
          'In the Chairman: AI Brain page, scroll to Backup Providers',
          `Choose ${pick[1]}, paste the key, leave Model blank, press ADD BACKUP`
        ],
        script:'', minutes:4,
        doneWhen:`AI Brain shows 2+ keys and the new one reads READY`,
        risk:'Getting distracted mid-signup and losing the key before pasting it',
        status:'OPEN', outcome:null
      });
      S.missions = S.missions.slice(0,80);
      log('WARN','QUARTERMASTER',`AI capacity low. Mission issued: add a free ${pick[1]} key (${pick[3]}).`);
      save();
    }
    return { msg:`Only ${kh.ready} key usable — mission issued to add ${pick[1]} (${pick[3]}).`, n:1,
             detail:`${pick[1]} at ${pick[2]} — ${pick[3]}, no card required.` };
  }};

/* ======================================================================
   MISSION ENGINE — the Chairman cannot act in the physical world, so he
   coaches. Every mission is one concrete action YOU can finish today,
   with the literal words to use and a definition of done.
   ====================================================================== */
async function generateMissions(ventureId, feedback){
  const v = ventureId ? S.ventures.find(x=>x.id===ventureId) : null;
  const idea = v ? S.ideas.find(i=>i.id===v.ideaId) : null;
  const doneList = S.missions.filter(m=>m.status==='DONE')
    .slice(0,12).map(m=>`${m.title} → ${m.outcome||'done'}`).join('; ') || 'nothing yet';
  const openList = S.missions.filter(m=>m.status==='OPEN').map(m=>m.title).join('; ') || 'none';
  const sites = S.monitors.filter(m=>m.checks>0)
    .map(m=>`${m.name} ${(m.up/m.checks*100).toFixed(1)}% over ${m.checks} checks`).join('; ') || 'none yet';

  const r = await think(
`Produce the Owner's next 3 missions. A mission is ONE action a single person
can finish in under 90 minutes, today, with no money and no company.

OWNER REALITY:
- One person, Ludhiana, Punjab. Gmail working. No company, no staff, no ads budget.
- Owns Chairman Agent OS: 24/7 uptime probing, TLS alerts, real email alerts,
  AI brain, Razorpay/Stripe payment links.
- Monitored sites and their real numbers: ${sites}
- Payments: ${S.pay?(S.pay.live?'LIVE Razorpay/Stripe armed':'test mode only'):'not connected'}
${v?`- Current venture: ${v.title}. Revenue path: ${v.revenuePath}`:'- No venture chosen yet.'}
${idea&&idea.research?`- Research verdict: ${idea.verdict}, first step was "${idea.research.firstStep}"`:''}
- Missions already completed: ${doneList}
- Missions currently open (do NOT repeat these): ${openList}
${feedback?`- Owner just reported: "${feedback}" — adapt to this.`:''}

RULES:
- No mission may require the Owner to lie or claim experience he lacks.
- No mission may cost money.
- If a mission involves contacting someone, give the LITERAL message text.
- Prefer actions that produce evidence or a reply, not "research" or "think about".
- Sequence matters: mission 1 must be doable before mission 2.

Return ONLY JSON:
[{"title":"short imperative, max 8 words",
  "why":"one sentence on why this specifically moves money closer",
  "steps":["numbered concrete actions, 3-6 of them"],
  "script":"the exact words to send or say, or empty string if not applicable",
  "minutes":number,
  "done_when":"the observable thing that proves it is complete",
  "blocker_risk":"the most likely reason the Owner stalls on this"}]`,
    null,'missions','Growth Conductor');

  const arr = jparse(r.text);
  const added = [];
  for(const m of (Array.isArray(arr)?arr:[])){
    if(!m || !m.title) continue;
    const mission = { id:uid('MSN'), t:nowIso(), ventureId:ventureId||null,
      title:String(m.title).slice(0,80), why:String(m.why||'').slice(0,240),
      steps:(m.steps||[]).map(s=>String(s).slice(0,300)).slice(0,8),
      script:String(m.script||''), minutes:+m.minutes||30,
      doneWhen:String(m.done_when||'').slice(0,200),
      risk:String(m.blocker_risk||'').slice(0,200),
      status:'OPEN', outcome:null };
    S.missions.unshift(mission); added.push(mission);
  }
  S.missions = S.missions.slice(0,80); save();
  log('OK','MISSION',`${added.length} mission(s) issued to the Owner.`);
  return added;
}

async function debriefMission(id, outcome, note){
  const m = S.missions.find(x=>x.id===id);
  if(!m) throw new Error('No such mission');
  m.status = outcome==='done' ? 'DONE' : 'SKIPPED';
  m.outcome = String(note||'').slice(0,400) || (outcome==='done'?'completed':'skipped');
  m.closed = nowIso(); save();
  log(outcome==='done'?'OK':'WARN','MISSION',`"${m.title}" ${m.status}. ${m.outcome}`);

  if(outcome!=='done') return { advice:null };
  const r = await think(
`The Owner just completed this mission:
TITLE: ${m.title}
WHAT HAPPENED: ${m.outcome}

Give a short debrief: what this actually proves, what it does NOT prove,
and the single most valuable next action. Be blunt. Under 120 words.
Do not congratulate. If the outcome was weak, say so.`,
    null,'debrief','Chairman');
  return { advice:r.text };
}

async function writePlaybook(topic){
  const r = await think(
`Write a practical playbook the Owner can follow step by step.

TOPIC: ${topic}

CONTEXT: one person in Ludhiana, Punjab, India. No company, no capital, no staff.
Owns website uptime monitoring software with real email alerting and can raise
Razorpay payment links.

Requirements:
- Number every step. No step may be vague.
- Where a website or form is involved, name it exactly.
- Where words are needed, write the exact words.
- State honestly where the Owner will need documents, money, or a legal identity.
- If a step is genuinely optional at this stage, mark it OPTIONAL.
- End with "COMMON MISTAKES" listing 3 specific errors people make here.
Under 700 words. No motivational filler.`,
    null,'playbook','Insight Forge');
  const pb = { id:uid('PBK'), t:nowIso(), topic:String(topic).slice(0,120), text:r.text };
  S.playbooks.unshift(pb); S.playbooks = S.playbooks.slice(0,40); save();
  log('OK','MISSION',`Playbook written: ${pb.topic}`);
  return pb;
}

CAPS['ai.missions'] = { pillar:5, safe:true, desc:'AI issues the Owner\'s next concrete actions',
  async run(){
    const open = S.missions.filter(m=>m.status==='OPEN').length;
    if(open >= 3) return { msg:`${open} mission(s) still open — finish those first.`, n:open };
    const v = S.ventures[0];
    const added = await generateMissions(v?v.id:null);
    return { msg:`${added.length} new mission(s) issued.`, n:added.length,
      detail: added.map(a=>a.title).join('; ') };
  }};

CAPS['ai.investigate'] = { pillar:4, safe:true, desc:'Deep multi-angle research on any topic, live from the web',
  async run(){
    const q = S.directives[0] || (S.ideas[0] && S.ideas[0].title) || 'website uptime monitoring India';
    const ev = await RESEARCH.deepDive(q, 'Ludhiana Punjab India');
    const r = await think(
`You just gathered live evidence on: ${q}

${ev.slice(0,7000)}

Extract what MATTERS. Cite only what the evidence supports.
Return: 5 hard facts, 2 things the evidence contradicts about common assumptions,
and 1 opportunity nobody in the results is serving. Be blunt. No invention.`,
      null,'investigate','Market Signal');
    return { msg:`Deep-dived "${q}".`, n:1, detail:r.text.slice(0,220) };
  }};

CAPS['ai.ideas'] = { pillar:5, safe:true, desc:'AI invents new money-making ideas on its own',
  async run(){
    const added = await generateIdeas(3);
    return { msg:`${added.length} new idea(s) generated.`, n:added.length,
      detail: added.map(a=>a.title).join('; ') };
  }};
CAPS['ai.research'] = { pillar:4, safe:true, desc:'AI researches the oldest unresearched idea against live web data',
  async run(){
    const next = S.ideas.filter(i=>i.status==='RAW').pop();
    if(!next) return { msg:'No unresearched ideas in the queue.', n:0 };
    const i = await researchIdea(next.id);
    return { msg:`"${i.title}" scored ${i.score}/100 — ${i.verdict}.`, n:1,
      detail:i.research.reasoning };
  }};

CAPS['ai.brief'] = { pillar:4, safe:true, desc:'AI writes an executive brief on real system state',
  async run(){
    const t=telemetry();
    const down=S.monitors.filter(m=>m.state==='DOWN');
    const facts=`Uptime ${hhmm(t.uptime_s)}. ${S.monitors.length} monitored targets, ${down.length} currently down`+
      (down.length?` (${down.map(m=>m.name+': '+(m.lastErr||'HTTP '+m.lastStatus)).join('; ')})`:'')+
      `. ${S.agents.filter(a=>a.status==='ACTIVE').length} of ${S.agents.length} agents active. `+
      `${S.gates.filter(g=>g.status==='PENDING').length} permission gates frozen. `+
      `Authorized spend $${S.spend.toFixed(2)}. ${t.auth_failures} failed logins. `+
      `Mail relay ${t.smtp_ready?'armed':'OFFLINE'}. `+
      S.monitors.filter(m=>m.checks>0).map(m=>`${m.name} availability ${((m.up/m.checks)*100).toFixed(1)}% p95 ${m.p95}ms`).join('. ');
    const r=await think(
      `Here is the live state of the system you oversee:\n\n${facts}\n\n`+
      `Write a 5-line executive brief for the Owner. Line 1: the single most urgent thing. `+
      `Lines 2-4: what matters and why. Line 5: the one action to take next. `+
      `If everything is healthy, say so in one line instead of padding.`,
      null,'brief','Insight Forge');
    log('INFO','AI BRIEF', r.text.split('\n')[0].slice(0,160));
    return { msg:'AI brief written ('+r.tokens+' tokens, '+r.ms+'ms).', n:1, detail:r.text.slice(0,200) };
  }};

CAPS['ai.incident'] = { pillar:1, safe:true, desc:'AI diagnoses any target that is down',
  async run(){
    const down=S.monitors.filter(m=>m.state==='DOWN');
    if(!down.length) return {msg:'No incidents to diagnose.', n:0, detail:'all targets up'};
    const m=down[0];
    const r=await think(
      `A monitored website is failing.\nURL: ${m.url}\nStatus: ${m.lastErr||'HTTP '+m.lastStatus}\n`+
      `Latency: ${m.lastMs}ms\nAvailability: ${((m.up/m.checks)*100).toFixed(1)}% over ${m.checks} checks\n`+
      `TLS: ${m.ssl?m.ssl.issuer+', expires in '+m.ssl.days_left+' days':'unknown'}\n\n`+
      `Give the 3 most likely causes ranked by probability, and the exact first check for each. Be specific and technical.`,
      null,'incident','Breach Warden');
    log('CRIT','AI DIAGNOSIS', m.name+': '+r.text.split('\n')[0].slice(0,140));
    return { msg:`Diagnosed ${m.name}.`, n:1, detail:r.text.slice(0,200) };
  }};

CAPS['ai.revenue'] = { pillar:5, safe:true, desc:'AI proposes concrete ways to earn from what you actually have',
  async run(){
    const r=await think(
      `HARD CONSTRAINT 1: every proposal must be delivered USING the software described below. `+
      `Reject any idea that is just "resell ChatGPT output".\n`+
      `THINK LIKE A FOUNDER: find the angle a competitor would miss. Ludhiana is India's `+
      `hosiery, bicycle-parts and machine-tools capital — thousands of family-run exporters `+
      `whose buyers check their website before placing bulk orders, and who have no idea when `+
      `that website is down. Name the specific niche and the specific moment the pain is felt, `+
      `not "small businesses". One offer must target someone the Owner can physically visit.\n`+
      `HARD CONSTRAINT 2 — TRUTH: the Owner has monitored ONLY ${S.monitors.length} site(s) and has `+
      `NEVER monitored any client site. The outreach message must NOT claim prior observation of other `+
      `businesses, must NOT cite statistics the Owner cannot prove, and must NOT invent revenue figures. `+
      `Any sentence beginning "I noticed" or "I saw" about a stranger's website is a lie and is forbidden. `+
      `The honest opening is an offer to monitor FREE and show real data afterwards.\n`+
      `HARD CONSTRAINT 3: check your own arithmetic. If you state a price as a percentage of a loss, `+
      `compute it correctly.\n\n`+
      `THE ASSET the Owner owns and runs:\n`+
      `- Automated HTTP/HTTPS uptime probing, every 15-120 seconds\n`+
      `- TLS certificate expiry detection with advance warning\n`+
      `- Instant email alerts on outage and recovery via working SMTP\n`+
      `- Availability percentage, p95 latency, incident history per site\n`+
      `- Runs 24/7 at zero hosting cost\n`+
      `Owner: one person in Ludhiana, Punjab. No company, no staff, no capital, no track record yet.\n\n`+
      `Give exactly 3 offers. For each state:\n`+
      `1. The offer in one sentence\n`+
      `2. The business type in Ludhiana and the specific pain, described WITHOUT inventing numbers\n`+
      `3. Monthly price in INR and the reasoning, using only arithmetic you have verified\n`+
      `4. The literal first WhatsApp message, under 50 words, containing ZERO unverifiable claims — `+
      `it should lead with a free trial offer, not a fake observation\n`+
      `5. The biggest objection and an honest counter that does not exaggerate\n\n`+
      `Cold outreach closes 1-3%. Do not promise fast results. No filler.`,
      null,'revenue','Revenue Streamer');
    log('INFO','AI STRATEGY', 'Revenue proposals generated.');
    return { msg:'3 revenue routes proposed.', n:3, detail:r.text.slice(0,200) };
  }};

CAPS['ai.client_report'] = { pillar:4, safe:true, desc:'AI writes a client-ready uptime report you can send',
  async run(){
    const rows=S.monitors.filter(m=>m.checks>0);
    if(!rows.length) return {msg:'No monitor data to report on.', n:0, detail:'bind a target first'};
    const data=rows.map(m=>`${m.name} (${m.url}): ${((m.up/m.checks)*100).toFixed(2)}% availability, `+
      `${m.checks} checks, p95 ${m.p95}ms, ${m.down} failures`+
      (m.ssl?`, TLS valid ${m.ssl.days_left} more days`:'')).join('\n');
    const r=await think(
      `Write a short professional uptime report a client would pay for, based only on this real data:\n\n${data}\n\n`+
      `Include: a one-line headline verdict, the numbers in plain English a non-technical business owner understands, `+
      `and one clear recommendation. Keep it under 200 words. Do not invent data not listed above.`,
      'You write concise professional client reports. Plain English, no jargon, no invented figures.',
      'client-report','Insight Forge');
    return { msg:'Client report ready to send.', n:rows.length, detail:r.text.slice(0,200) };
  }};

/* default standing orders — real schedules, real work */
/* HUSTLE MODE — everything money-facing, tight intervals, parallel lanes.
   Used when the Owner wants maximum output in the next hour. */
/* Intervals sized for FREE tiers. Groq allows ~14,400 req/day but throttles
   at ~30/min; these spacings keep well clear while still producing steadily. */
const HUSTLE_TASKS = [
  ['ai.ideas',        900, 'Growth Conductor'],
  ['ai.research',     600, 'Market Signal'],
  ['ai.missions',    1200, 'Growth Conductor'],
  ['ai.revenue',     1800, 'Revenue Streamer'],
  ['ai.investigate', 1500, 'Market Signal'],
  ['ai.client_report',2400,'Insight Forge'],
  ['probe.sweep',     120, 'Uptime Marshal'],
  ['anomaly.scan',    600, 'Audit Sentinel'],
  ['gate.sentry',     600, 'Risk Matrix Analyst'],
  ['ai.brief',       1800, 'Insight Forge'],
  ['team.medic',      240, 'Breach Warden'],
  ['team.quartermaster', 600, 'Resource Controller'],
  ['dom.check_own',    10800, 'Resource Controller']
];

const DEFAULT_TASKS = [
  ['probe.sweep',   120, 'Uptime Marshal'],
  ['tls.watch',    3600, 'Breach Warden'],
  ['sla.report',    600, 'Insight Forge'],
  ['anomaly.scan',  300, 'Audit Sentinel'],
  ['cost.audit',    900, 'Innovation Scout'],
  ['roster.audit', 1800, 'Policy Vault Keeper'],
  ['gate.sentry',   600, 'Risk Matrix Analyst'],
  ['brief.write',   900, 'Insight Forge'],
  ['team.medic',    300, 'Breach Warden'],
  ['team.quartermaster', 900, 'Resource Controller'],
  ['dom.check_own',    21600, 'Resource Controller'],
  ['dom.expiring_soon', 43200, 'Market Signal']
];
function seedTasks(force, hustle){
  if(S.tasks.length && !force) return;
  const src = hustle ? HUSTLE_TASKS : DEFAULT_TASKS;
  S.tasks = src.map(([cap,every,owner])=>({
    id:uid('TSK'), cap, every, owner, enabled:true, runs:0, fails:0,
    lastAt:null, lastMsg:null, lastOk:null, created:nowIso() }));
  S.hustle = !!hustle;
  log(hustle?'CRIT':'OK','RUNTIME',
    hustle ? `HUSTLE MODE — ${S.tasks.length} money-focused orders, ${S.lanes||3} parallel lanes. Maximum output.`
           : `${S.tasks.length} standing orders installed. Agents are now executing work.`);
}

/* PARALLEL EXECUTION — every due task fires at once, not one after another.
   Concurrency is capped so free-tier LLM rate limits are not tripped. */
let tickBusy=false;
async function runTask(t){
  const cap=CAPS[t.cap];
  if(!cap){ t.enabled=false; return; }
  const t0=Date.now();
  t.lastAt=nowIso();                     // claim it now so a parallel tick cannot double-fire
  try{
    const r=await cap.run();
    t.lastOk=true; t.lastMsg=r.msg; t.runs++;
    S.runs.unshift({t:nowIso(), cap:t.cap, owner:t.owner, ok:true,
      msg:r.msg, detail:r.detail||'', ms:Date.now()-t0, n:r.n||0});
  }catch(e){
    t.lastOk=false; t.lastMsg='FAILED: '+e.message; t.fails++;
    S.runs.unshift({t:nowIso(), cap:t.cap, owner:t.owner, ok:false,
      msg:'FAILED: '+e.message, detail:'', ms:Date.now()-t0, n:0});
    log('CRIT','RUNTIME',`${t.cap} failed: ${e.message}`);
    /* SELF-REPAIR: only for code he wrote himself. Never touches my code. */
    if(cap.written && t.fails>=2) repairCapability(t.cap, e.message)
      .catch(err=>log('WARN','SELF-REPAIR', t.cap+': '+err.message));
  }
  S.runs=S.runs.slice(0,120);
}
async function tick(){
  if(tickBusy || !S.running || !S.owner) return;
  tickBusy=true; S.ticks++;
  try{
    const now=Date.now();
    const due = S.tasks.filter(t=>t.enabled &&
      (!t.lastAt || (now - new Date(t.lastAt.replace(' ','T')+'Z').getTime()) >= t.every*1000));
    if(due.length){
      /* split: cheap local tasks all at once, AI tasks throttled to 3 at a time */
      const localTasks = due.filter(t=>!t.cap.startsWith('ai.'));
      const aiTasks    = due.filter(t=>t.cap.startsWith('ai.'));
      await Promise.all(localTasks.map(runTask));
      const LANES = Math.max(1, +S.lanes || 3);
      for(let i=0;i<aiTasks.length;i+=LANES)
        await Promise.all(aiTasks.slice(i,i+LANES).map(runTask));
      log('OK','RUNTIME',`Parallel cycle: ${localTasks.length} local + ${aiTasks.length} AI task(s) executed.`);
    }
    save();
  } finally { tickBusy=false; }
}
setInterval(tick, 10000);
setTimeout(selfAudit, 8000);

/* ---------- real telemetry ---------- */
function telemetry(){
  const mu = process.memoryUsage();
  const lat = T.lat.length ? T.lat.reduce((a,b)=>a+b,0)/T.lat.length : 0;
  const live = [...SESS.values()].filter(s=>Date.now()-s.last<70000).length;
  const dbBytes=DBBYTES;
  const la = os.loadavg();
  return {
    uptime_s: Math.floor((Date.now()-BOOT)/1000),
    node: process.version, platform: process.platform+'/'+process.arch,
    pid: process.pid,
    rss_mb: +(mu.rss/1048576).toFixed(1),
    heap_mb: +(mu.heapUsed/1048576).toFixed(1),
    heap_total_mb: +(mu.heapTotal/1048576).toFixed(1),
    sys_mem_pct: +(100-(os.freemem()/os.totalmem()*100)).toFixed(1),
    cpus: os.cpus().length,
    load1: +la[0].toFixed(2), load5: +la[1].toFixed(2), load15: +la[2].toFixed(2),
    requests: T.req, api_calls: T.api, errors: T.err, auth_failures: T.auth_fail,
    avg_latency_ms: +lat.toFixed(2),
    live_sessions: live, total_sessions: SESS.size,
    db_bytes: dbBytes, state_rev: S.rev,
    hostname: os.hostname(),
    monitors: S.monitors.length,
    monitors_down: S.monitors.filter(m=>m.state==='DOWN').length,
    smtp_ready: !!(S.smtp && S.smtp.host),
    mail_sent: MAILSTAT.sent, mail_failed: MAILSTAT.failed,
    sessions_durable: true,
    hot_paths: Object.entries(T.byPath).sort((a,b)=>b[1]-a[1]).slice(0,6)
  };
}
/* real per-floor health derived from actual process + roster facts */
function floorHealth(){
  const t = telemetry();
  const memPen = Math.min(30, t.rss_mb/8);
  const loadPen = Math.min(25, t.load1*10);
  const errPen = Math.min(25, t.errors*3);
  const authPen = Math.min(30, t.auth_failures*6);
  const pend = S.gates.filter(g=>g.status==='PENDING').length;
  const mons = S.monitors.length;
  const downs = S.monitors.filter(m=>m.state==='DOWN').length;
  const monPen = mons ? (downs/mons)*45 : 0;
  return PILLARS.map(p=>{
    const roster = S.agents.filter(a=>a.pillarId===p.id);
    const active = roster.filter(a=>a.status==='ACTIVE').length;
    const staffing = roster.length ? active/roster.length : 0;
    let h;
    if(p.id===1) h = 100 - authPen - Math.min(15,S.denials.length*2);
    else if(p.id===2) h = 100 - loadPen - memPen/2 - monPen;
    else if(p.id===3) h = 100 - errPen - Math.min(20, pend*4);
    else if(p.id===4) h = 100 - Math.min(20, (t.db_bytes/60000));
    else h = 100 - Math.min(25, S.spend) - (S.payout?0:12);
    h = Math.round(Math.max(5, Math.min(100, h * (0.55 + 0.45*staffing))));
    const load = Math.round(Math.min(100, (t.load1/Math.max(1,t.cpus))*100*0.6 + roster.length*3 + (p.id===3?pend*5:0)));
    return { id:p.id, health:h, load:Math.max(3,load), agents:roster.length, active };
  });
}

/* ---------- helpers ---------- */
function send(res, code, obj, hdrs={}){
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, Object.assign({'Content-Type':'application/json','Content-Length':b.length,
    'Cache-Control':'no-store','X-Frame-Options':'ALLOWALL'}, hdrs));
  res.end(b);
}
function pub(){
  return { owner: S.owner ? { id:S.owner.id, email:S.owner.email, created:S.owner.created,
             bootstrap:!!S.owner.bootstrap } : null,
    agents:S.agents, gates:S.gates, logs:S.logs.slice(0,400), revenue:S.revenue,
    payout: S.payout ? { type:S.payout.type, cap:S.payout.cap, masked:S.payout.masked, t:S.payout.t } : null,
    denials:S.denials, spend:S.spend, devices:S.devices.slice(0,12), rev:S.rev,
    monitors:S.monitors, incidents:S.incidents.slice(0,40), mailq:S.mailq.slice(0,30),
    smtp: S.smtp ? { host:S.smtp.host, port:S.smtp.port, secure:!!S.smtp.secure,
      user:mask(S.smtp.user), from:S.smtp.from, name:S.smtp.name, t:S.smtp.t } : null,
    mailstat: MAILSTAT,
    skills:S.skills, proposals:S.proposals.slice(0,40),
    evolution:S.evolution.slice(0,60), autopilot:!!S.autopilot, scanCount:S.scanCount,
    writtenCaps:(S.writtenCaps||[]).slice(0,15),
    analyses:(S.analyses||[]).slice(0,12),
    crews:(S.crews||[]).slice(0,12),
    docs:(S.docs||[]).map(d=>({id:d.id,t:d.t,name:d.name,size:d.size,
      chars:d.chars,readable:d.readable,preview:d.text.slice(0,180)})),
    drafts:(S.drafts||[]).map(d=>({id:d.id,t:d.t,kind:d.kind,brief:d.brief,
      text:d.text,bytes:d.bytes,sentTo:d.sentTo?maskMail(d.sentTo):null,sentAt:d.sentAt||null})),
    connectors:(S.connectors||[]).map(c=>({name:c.name,base:c.base,auth:c.auth,
      note:c.note,enabled:c.enabled!==false,calls:c.calls||0,fails:c.fails||0,
      key:c.key?mask(c.key):'(none)',lastAt:c.lastAt||null})),
    tasks:S.tasks, runs:S.runs.slice(0,80), running:!!S.running, ticks:S.ticks,
    hustle:!!S.hustle, lanes:S.lanes||3, budget:S.budget||0,
    llmBackups:(S.llmBackups||[]).map(b=>({provider:b.provider,model:b.model,key:mask(b.key),
      ok:b.ok||0,fail:b.fail||0,cooled:(b.cooled||0)>Date.now()})),
    agentRuns:(S.agentRuns||[]).slice(0,12),
    builds:(S.builds||[]).map(x=>({id:x.id,t:x.t,title:x.title,bytes:x.bytes,
      hasPayLink:x.hasPayLink,ventureId:x.ventureId})),
    domains: { watch:((S.domains||{}).watch)||[], runs:((S.domains||{}).runs)||[],
      howItWorks: HOW_DOMAINS_WORK, priceAsOf: DOMAINS.PRICE_ASOF,
      tlds: Object.keys(DOMAINS.PRICES).map(t=>({tld:t,first:DOMAINS.PRICES[t][0],renew:DOMAINS.PRICES[t][1]})) },
    businesses:(S.businesses||[]).map(x=>({id:x.id,t:x.t,name:x.name,tagline:x.tagline,
      ventureId:x.ventureId, zipBytes:x.zipBytes, tellCount:x.tellCount, tells:x.tells,
      rewrote:x.rewrote, payNote:x.payNote, hasTool:x.hasTool, toolTitle:x.toolTitle,
      domains:x.domains||null,
      tiers:x.tiers, outreach:x.outreach, steps:x.steps, published:!!x.published,
      publishedUrl:x.publishedUrl||'',
      brand:(x.identity||{}).brand, buyer:(x.identity||{}).buyer,
      promise:(x.identity||{}).promise,
      fileList:x.fileList})),
    cooldown: coolingDown() ? Math.ceil((COOLDOWN_UNTIL-Date.now())/1000) : 0,
    caps:Object.entries(CAPS).map(([k,v])=>({cap:k,desc:v.desc,pillar:v.pillar})),
    llm: S.llm ? { provider:S.llm.provider, model:S.llm.model, key:mask(S.llm.key), t:S.llm.t } : null,
    providers: Object.entries(LLM.PROVIDERS).map(([k,v])=>({id:k,label:v.label,model:v.model,signup:v.signup,nokey:!!v.nokey})),
    outputs: S.outputs.slice(0,40),
    ideas:S.ideas.slice(0,60), ventures:S.ventures.slice(0,20),
    orders:S.orders.slice(0,40), chat:S.chat.slice(0,60), autoIdeas:!!S.autoIdeas,
    missions:S.missions.slice(0,40), playbooks:S.playbooks.slice(0,20),
    campaigns:(S.campaigns||[]).map(c=>({id:c.id,t:c.t,name:c.name,bizId:c.bizId,bizName:c.bizName,
      thesis:c.thesis,firstCustomerBy:c.firstCustomerBy,weekTwo:c.weekTwo,killCriteria:c.killCriteria,
      targets:c.targets,imageBriefs:c.imageBriefs,status:c.status,autoCount:c.autoCount,
      sent:c.sent||0,parked:c.parked||0,failed:c.failed||0,actions:c.actions})),
    outreach:(S.outreach||[]).slice(0,60),
    channels: CHANNELS,
    treasuryLock: S.treasuryLock || null,
    pay: S.pay ? { gateway:S.pay.gateway, live:!!S.pay.live, fp:S.pay.fp||null,
      keyId:mask(S.pay.keyId||S.pay.keySecret), t:S.pay.t } : null,
    gateways: Object.values(PAY.GATEWAYS).map(g=>({id:g.id,label:g.label,
      currency:g.currency,signup:g.signup,keyHint:g.keyHint})),
    telemetry: telemetry(), floors: floorHealth(), pillars:PILLARS,
    storage: storageHealth(), sendWindow: sendWindow(),
    smtpVerified: S.smtpVerified || null };
}
/* ---- STORAGE HEALTH ----
   On a free host with no disk, silent persistence failure is the worst
   possible bug: everything looks fine until a restart eats the business.
   This reports the truth on every state poll. */
let LAST_SAVE_OK = null, LAST_SAVE_ERR = '', LAST_SAVE_AT = null;
function storageHealth(){
  const bytes = DBBYTES || 0;
  const b64   = Math.round(bytes * 4/3);
  const mode  = STORE.mode || 'local';
  const ephemeral = mode === 'local' && !!(process.env.RENDER || process.env.DYNO || process.env.FLY_APP_NAME);
  let level = 'OK', msg = '';
  if(ephemeral){
    level = 'CRIT';
    msg = 'THIS HOST HAS NO PERSISTENT DISK. Everything you build is destroyed on the next restart or redeploy — and free hosts restart daily. Set STORE=github now.';
  } else if(mode === 'github' && b64 > 900000){
    level = 'CRIT';
    msg = `State is ${(b64/1024).toFixed(0)} KB encoded. The GitHub Contents API rewrites the whole file on every save; past ~1 MB this starts failing. Delete old business packs.`;
  } else if(mode === 'github' && b64 > 500000){
    level = 'WARN';
    msg = `State is ${(b64/1024).toFixed(0)} KB encoded and every save rewrites all of it. Watch it.`;
  } else if(LAST_SAVE_OK === false){
    level = 'CRIT';
    msg = 'THE LAST SAVE FAILED: ' + LAST_SAVE_ERR + ' — anything since then exists only in memory.';
  } else if(mode === 'local'){
    msg = 'Filesystem storage. Persistent only if this machine keeps its disk.';
  } else {
    msg = 'Private GitHub repo acting as the disk. Survives restarts and redeploys.';
  }
  return { mode, describe: STORE.describe ? STORE.describe() : mode,
    bytes, encoded: b64, ephemeral, level, msg,
    lastSaveOk: LAST_SAVE_OK, lastSaveAt: LAST_SAVE_AT, lastSaveErr: LAST_SAVE_ERR,
    blobsCached: BLOBS.cached() };
}

function body(req){ return new Promise(r=>{ let d=''; req.on('data',c=>{ d+=c; if(d.length>12e6) req.destroy(); });
  req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch(e){ r({}); } }); }); }

/* ---------- API ---------- */
async function api(req,res,url){
  T.api++;
  const ip = (req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  const ua = req.headers['user-agent']||'';
  const p  = url.pathname;

  if(p==='/api/boot') return send(res,200,{ provisioned: !!S.owner, authed: !!auth(req) });

  /* serve a built site for preview / download — owner session required */
  if(p==='/api/site/view'){
    if(!auth(req)){ res.writeHead(401); return res.end('unauthorised'); }
    const id=url.searchParams.get('id');
    const b=(S.builds||[]).find(x=>x.id===id);
    if(!b){ res.writeHead(404); return res.end('not found'); }
    const dl = url.searchParams.get('dl')==='1';
    const buf=Buffer.from(b.html,'utf8');
    res.writeHead(200, Object.assign({
      'Content-Type':'text/html; charset=utf-8','Content-Length':buf.length,'Cache-Control':'no-store'},
      dl ? {'Content-Disposition':'attachment; filename="index.html"'} : {}));
    return res.end(buf);
  }

  /* ---- BUSINESS FACTORY: serve any file from a built pack ---- */
  if(p==='/api/biz/file'){
    if(!auth(req)){ res.writeHead(401); return res.end('unauthorised'); }
    const b=(S.businesses||[]).find(x=>x.id===url.searchParams.get('id'));
    if(!b){ res.writeHead(404); return res.end('not found'); }
    const want=url.searchParams.get('f')||'site/index.html';
    const files=b.files || await BLOBS.get(b.id);
    if(!files){ res.writeHead(410); return res.end('This pack\'s files are gone — rebuild it.'); }
    const f=files.find(x=>x.name===want);
    if(!f){ res.writeHead(404); return res.end('no such file in this pack'); }
    const buf=Buffer.isBuffer(f.data)?f.data:Buffer.from(String(f.data),'utf8');
    const ct=/\.html$/.test(want)?'text/html; charset=utf-8':'text/plain; charset=utf-8';
    res.writeHead(200,{'Content-Type':ct,'Content-Length':buf.length,'Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'"});
    return res.end(buf);
  }
  if(p==='/api/biz/zip'){
    if(!auth(req)){ res.writeHead(401); return res.end('unauthorised'); }
    const b=(S.businesses||[]).find(x=>x.id===url.searchParams.get('id'));
    if(!b){ res.writeHead(404); return res.end('not found'); }
    const files=b.files || await BLOBS.get(b.id);
    if(!files){ res.writeHead(410); return res.end('This pack\'s files are gone — rebuild it.'); }
    const buf=FACTORY.zip(files.map(f=>({name:f.name,
      data: Buffer.isBuffer(f.data)?f.data:Buffer.from(f.data&&f.data.type==='Buffer'?f.data.data:String(f.data))})));
    const safe=String(b.name||'business').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'business';
    res.writeHead(200,{'Content-Type':'application/zip','Content-Length':buf.length,
      'Cache-Control':'no-store','Content-Disposition':`attachment; filename="${safe}.zip"`});
    return res.end(buf);
  }

  if(p==='/api/health'){
    const t=telemetry();
    return send(res,200,{ ok:true, uptime_s:t.uptime_s, monitors:t.monitors,
      monitors_down:t.monitors_down, smtp:t.smtp_ready, rev:S.rev });
  }

  if(p==='/api/login'){
    const b = await body(req);
    if(!S.owner) return send(res,400,{error:'NOT_PROVISIONED'});
    const jail = LOCK.get(ip);
    if(jail && jail.until > Date.now()){
      const secs = Math.ceil((jail.until-Date.now())/1000);
      return send(res,429,{error:`IP LOCKED OUT. ${secs}s remaining.`});
    }
    if(b.id!==S.owner.id || !b.pw || !verify(b.pw)){
      T.auth_fail++;
      const j = LOCK.get(ip) || {n:0,until:0};
      j.n++;
      if(j.n>=5){ j.until=Date.now()+15*60000; j.n=0;
        log('CRIT','AUTH',`IP ${ip} LOCKED OUT for 15 minutes after 5 failed authentications.`);
        mail('Brute-force lockout',
`Five failed Owner authentication attempts triggered a lockout.

  Source IP : ${ip}
  Agent     : ${(ua||'').slice(0,120)}
  At        : ${nowIso()} UTC
  Lockout   : 15 minutes

If this was not you, your Owner ID is known to an attacker.
Rotate your password and revoke all sessions immediately.

— Chairman Agent OS · Security & Audit Command`,'LOCKOUT');
      } else {
        log('CRIT','AUTH',`Failed owner authentication from ${ip} (${j.n}/5).`);
      }
      LOCK.set(ip,j);
      return send(res,401,{error:'ACCESS DENIED'});
    }
    LOCK.delete(ip);
    const tok = newSession(ip,ua);
    log('INFO','AUTH','Owner authenticated from '+ip+'. Command Tower unlocked.');
    const https = BEHIND_PROXY && (req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
    const cookie = `cos=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`+(https?'; Secure':'');
    return send(res,200,{ok:1,state:pub()},{'Set-Cookie':cookie});
  }

  if(p==='/api/logout'){
    const t=auth(req); if(t) SESS.delete(t);
    log('INFO','AUTH','Session terminated by Owner.');
    return send(res,200,{ok:1},{'Set-Cookie':'cos=; Path=/; Max-Age=0'});
  }

  /* everything below requires a live server session */
  if(!auth(req)) return send(res,401,{error:'UNAUTHENTICATED'});

  if(p==='/api/state'){
    const since = +url.searchParams.get('since')||-1;
    if(since===S.rev) return send(res,200,{unchanged:1,rev:S.rev,telemetry:telemetry(),floors:floorHealth()});
    return send(res,200,{state:pub()});
  }

  const b = await body(req);

  if(p==='/api/gate'){
    if(!b.title||!b.obj||!b.just||!b.safe) return send(res,400,{error:'ALL THREE SOP SECTIONS MANDATORY'});
    const cost=+b.cost||0;
    if(cost>0 && !b.free){
      S.denials.push({t:nowIso(),op:b.title,cost});
      log('CRIT','DOCTRINE',`Gate refused pre-submission — "${b.title}" demands $${cost} with no free route. ZERO-COST VIOLATION.`);
      return send(res,400,{error:'ZERO-COST BLOCK: declare a free alternative route'});
    }
    const g={ id:uid('GATE'), t:nowIso(), title:b.title, cls:b.cls, obj:b.obj, just:b.just, safe:b.safe,
      risk:b.risk, amt:+b.amt||0, cost, free:b.free||'', status:'PENDING' };
    S.gates.unshift(g);
    log('WARN','GATE',`${g.id} raised [${g.cls} · ${g.risk}] — "${g.title}". Execution FROZEN.`);
    if(cost>0){ S.denials.push({t:nowIso(),op:g.title,cost});
      log('CRIT','DOCTRINE',`Paid path on ${g.id} ($${cost}). Free route proposed: ${g.free}`); }
    save(); return send(res,200,{ok:1,id:g.id,state:pub()});
  }

  if(p==='/api/gate/decide'){
    const g=S.gates.find(x=>x.id===b.id);
    if(!g||g.status!=='PENDING') return send(res,400,{error:'GATE NOT PENDING'});
    /* You are already logged in. A tick is your signature. */
    if(g.cls==='FINANCIAL TRANSFER' && !S.payout && b.ok)
      return send(res,400,{error:'HARD BLOCK: no payout channel sealed'});
    g.status = b.ok?'APPROVED':'DENIED'; g.resolved=nowIso();
    if(b.ok && g.cost>0){ S.spend+=g.cost;
      log('CRIT','DOCTRINE',`Owner OVERRIDE on ${g.id}: $${g.cost} authorized against Zero-Cost Doctrine.`); }
    log(b.ok?'OK':'WARN','GATE',`${g.id} ${g.status} by Owner signature.`);
    mail(`${g.status}: ${g.title}`,
`A permission gate was resolved by Owner cryptographic signature.

  Gate     : ${g.id}
  Operation: ${g.title}
  Class    : ${g.cls}
  Blast    : ${g.risk}
  Cost     : $${(g.cost||0).toFixed(2)}
  At risk  : $${(g.amt||0).toLocaleString()}
  Decision : ${g.status}
  At       : ${g.resolved} UTC

If you did not authorize this, your Owner password is compromised.
Rotate it immediately and revoke all sessions.

— Chairman Agent OS · Executive Command Tower`, 'GATE-2FA');
    if(b.ok && g.cls==='FINANCIAL TRANSFER' && g.amt)
      S.revenue.push({t:nowIso(),src:'Authorized transfer · '+g.title,amt:-g.amt});
    save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/gate/reroute'){
    const g=S.gates.find(x=>x.id===b.id); if(!g) return send(res,404,{error:'NOT FOUND'});
    g.cost=0; g.just+=`\n[REROUTED] Paid dependency removed. Free path: ${g.free||'open-source substitute'}`;
    log('OK','DOCTRINE',`${g.id} rerouted to free path. Spend avoided.`); save();
    return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/agent'){
    if(!b.name||!b.role||!b.tools?.length) return send(res,400,{error:'NAME, SCOPE AND >=1 TOOL REQUIRED'});
    /* Honesty guard: an agent whose tools match no real capability will never
       execute. Refuse to create a decorative agent that looks operational. */
    {
      const real = Object.keys(CAPS);
      const known = (b.tools||[]).filter(t=>real.includes(String(t).trim()));
      if(!known.length)
        return send(res,400,{error:
          'NONE OF THOSE TOOLS EXIST, so this agent could never run. Real executable capabilities are: '
          + real.join(', ') + '. Writing a role in plain English does not create the ability to do it.'});
    }
    S.agents.unshift({ id:uid('AGT'), name:b.name, pillarId:+b.pillarId, role:b.role,
      tools:b.tools, cost:b.cost||'FREE-TIER-ONLY', status:'ACTIVE', t:nowIso() });
    log('OK','REGISTRY',`Agent "${b.name}" commissioned to Floor ${b.pillarId} · ${b.cost}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/agent/toggle'){
    const a=S.agents.find(x=>x.id===b.id); if(!a) return send(res,404,{error:'NOT FOUND'});
    a.status = a.status==='ACTIVE'?'SUSPENDED':'ACTIVE';
    log('WARN','REGISTRY',`Agent ${a.id} ${a.status}.`); save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/agent/kill'){
    S.agents=S.agents.filter(a=>a.id!==b.id);
    log('CRIT','REGISTRY',`Agent ${b.id} decommissioned.`); save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/agent/reset'){
    S.agents=[]; seed(); save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/revenue'){
    if(!b.src||!+b.amt) return send(res,400,{error:'SOURCE AND NON-ZERO AMOUNT REQUIRED'});
    S.revenue.push({t:nowIso(),src:b.src,amt:+b.amt});
    log('OK','REVENUE',`Stream posted: ${b.src} $${(+b.amt).toLocaleString()}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/payout/request'){
    const a=+b.amt; if(!a||a<=0) return send(res,400,{error:'POSITIVE AMOUNT REQUIRED'});
    S.gates.unshift({ id:uid('GATE'), t:nowIso(), title:`Owner payout $${a.toLocaleString()}`,
      cls:'FINANCIAL TRANSFER', cost:0, free:'',
      obj:`Transfer $${a.toLocaleString()} to the Owner's sealed payout channel. Success = funds settled, ledger reconciled.`,
      just:'Chairman executes directly. No sub-agent holds treasury access; Security & Audit observes read-only.',
      safe:'Password signature + 2FA to registered email. Ceiling enforced. Reversible hold window. Dual ledger write.',
      risk: a>10000?'SEVERE':a>1000?'HIGH':'MEDIUM', amt:a, status:'PENDING' });
    log('WARN','TREASURY',`Payout request $${a.toLocaleString()} raised. FROZEN.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/vault'){
    /* raw values are hashed away immediately; only masked view is ever persisted or returned */
    let masked;
    if(b.type==='BANK'){
      if(!b.name || (!b.acc && !b.iban)) return send(res,400,{error:'BENEFICIARY AND ACCOUNT/IBAN REQUIRED'});
      masked={Method:'Bank Wire',Beneficiary:b.name,Account:mask(b.acc),IBAN:mask(b.iban),
        SWIFT:mask(b.swift),Bank:b.bank||'—',Ceiling:'$'+(+b.cap||0).toLocaleString()};
    } else {
      if(!b.name||!b.addr) return send(res,400,{error:'BENEFICIARY AND ADDRESS REQUIRED'});
      masked={Method:'Crypto',Beneficiary:b.name,Network:b.net||'—',Address:mask(b.addr),
        Ceiling:'$'+(+b.cap||0).toLocaleString()};
    }
    const fp = crypto.createHash('sha256').update(JSON.stringify(b)).digest('hex').slice(0,16);
    S.payout={ type:b.type, cap:+b.cap||0, masked, fp, t:nowIso() };
    log('OK','VAULT',`Payout channel sealed (${b.type}). Values withheld from ledger by policy. Fingerprint ${fp}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/vault/purge'){
    S.payout=null; log('CRIT','VAULT','Payout channel purged.'); save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/owner/rotate'){
    if(!verify(b.old)) return send(res,401,{error:'CURRENT PASSWORD WRONG'});
    if(!b.neu||b.neu.length<8) return send(res,400,{error:'NEW PASSWORD TOO SHORT'});
    S.owner.salt=crypto.randomBytes(16).toString('hex');
    S.owner.hash=kdf(b.neu,S.owner.salt); S.owner.bootstrap=false;
    STORE.remove(CREDS).catch(()=>{});
    log('CRIT','AUTH','Owner password rotated. Bootstrap credential file destroyed.');
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/owner/email'){
    if(!/^\S+@\S+\.\S+$/.test(b.email||'')) return send(res,400,{error:'INVALID EMAIL'});
    {
      const dom=String(b.email).split('@')[1].toLowerCase();
      if(/\.(local|test|invalid|example|localdomain)$/.test(dom))
        return send(res,400,{error:
          `"${dom}" is not a real mail domain — every alert would silently bounce and you would never be told. Use a real inbox such as your Gmail address.`});
    }
    S.owner.email=b.email; log('WARN','AUTH','2FA target changed to '+maskMail(b.email));
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/owner/id'){
    if(!verify(b.pw)) return send(res,401,{error:'PASSWORD WRONG'});
    if(!b.newid||b.newid.length<3) return send(res,400,{error:'ID TOO SHORT'});
    log('CRIT','AUTH',`Owner ID changed from ${S.owner.id} to ${b.newid}.`);
    S.owner.id=b.newid; save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/sessions/revoke'){
    let n=0; const me=auth(req);
    for(const k of [...SESS.keys()]) if(k!==me){ SESS.delete(k); n++; }
    log('CRIT','AUTH',`${n} remote session(s) revoked by Owner.`); save();
    return send(res,200,{ok:1,revoked:n,state:pub()});
  }
  /* ---- UPTIME MARSHAL ---- */
  if(p==='/api/monitor/add'){
    let u=(b.url||'').trim();
    if(!/^https?:\/\//i.test(u)) u='https://'+u;
    let parsed;
    try{ parsed=new URL(u); }catch(e){ return send(res,400,{error:'INVALID URL'}); }
    /* Reject hostnames that can never resolve on the public internet.
       A bare word like "chairman" reports 0% availability forever and
       poisons every SLA figure and self-upgrade proposal downstream. */
    {
      const h=parsed.hostname;
      const isIP=/^\d{1,3}(\.\d{1,3}){3}$/.test(h);
      const localish=/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(h);
      if(!localish && !isIP && !h.includes('.'))
        return send(res,400,{error:
          `"${h}" is not a real website address — it has no domain, so it can never resolve and would report 0% availability forever. Use a full address like https://${h}.com`});
      if(/\.(local|test|invalid|example|localdomain)$/i.test(h))
        return send(res,400,{error:
          `".${h.split('.').pop()}" is a reserved non-routable domain. It will never resolve on the public internet.`});
    }
    if(S.monitors.some(m=>m.url===u)) return send(res,400,{error:'ALREADY MONITORED'});
    const m={ id:uid('MON'), url:u, name:(b.name||new URL(u).hostname), interval:Math.max(15,+b.interval||60),
      state:'UNKNOWN', checks:0, up:0, down:0, history:[], added:nowIso() };
    S.monitors.push(m);
    log('OK','UPTIME MARSHAL',`Monitor bound: ${m.name} → ${m.url} every ${m.interval}s.`);
    save(); runMonitors(true);
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/monitor/remove'){
    const m=S.monitors.find(x=>x.id===b.id);
    S.monitors=S.monitors.filter(x=>x.id!==b.id);
    if(m) log('WARN','UPTIME MARSHAL',`Monitor removed: ${m.name}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/monitor/check'){ await runMonitors(true); return send(res,200,{ok:1,state:pub()}); }

  /* ---- SMTP ---- */
  if(p==='/api/smtp'){
    if(!b.host||!b.from) return send(res,400,{error:'HOST AND FROM ADDRESS REQUIRED'});
    const host=b.host.trim();
    /* catch the classic mistake: email address typed into the host field */
    if(host.includes('@'))
      return send(res,400,{error:'SMTP HOST must be a SERVER NAME, not an email address. For Gmail use: smtp.gmail.com'});
    /* A dotted public name is the normal case, but a bare hostname or an IP
       is legitimate for a self-hosted or LAN relay — and rejecting those made
       the send path untestable end to end. Allow them; the connection attempt
       is the real validator. */
    const dotted   = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host);
    const bareHost = /^[a-z0-9-]+$/i.test(host);
    const ipv4     = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if(!dotted && !bareHost && !ipv4)
      return send(res,400,{error:'SMTP HOST looks invalid. Example: smtp.gmail.com'});
    if(bareHost && !/^(localhost|smtp|mail)$/i.test(host))
      return send(res,400,{error:`"${host}" has no domain, so it cannot resolve on the internet. For Gmail use: smtp.gmail.com`});
    if(!b.user||!b.user.trim())
      return send(res,400,{error:'USERNAME required — normally your full email address'});
    if(!b.pass)
      return send(res,400,{error:'APP PASSWORD required. Generate one at myaccount.google.com/apppasswords'});
    if(/gmail\.com$/i.test(host) && String(b.pass).replace(/\s/g,'').length!==16)
      return send(res,400,{error:'Gmail app passwords are exactly 16 characters. That looks like your normal password — generate an app password instead.'});
    if(S.owner.email && /@chairman\.local$/i.test(S.owner.email))
      return send(res,400,{error:'Your 2FA email is still the placeholder owner@chairman.local. Set your REAL email in Owner Settings first, or mail goes nowhere.'});
    S.smtp={ host, port:+b.port||587, secure:!!b.secure, user:b.user.trim(),
      pass:String(b.pass).replace(/\s/g,''), from:b.from.trim(), name:b.name||'Chairman Agent OS', t:nowIso() };
    /* new credentials are unproven until preflight says otherwise */
    S.smtpVerified = null;
    log('OK','MAIL',`SMTP relay configured: ${S.smtp.host}:${S.smtp.port} as ${mask(S.smtp.user)}. Password withheld from ledger.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/smtp/purge'){ S.smtp=null; log('CRIT','MAIL','SMTP relay purged. 2FA reverts to intent-only.');
    save(); return send(res,200,{ok:1,state:pub()}); }
  if(p==='/api/smtp/test'){
    const r=await mail('Relay verification',
`This is a live verification message from your Chairman Agent OS instance.

  Sent    : ${nowIso()} UTC
  Owner   : ${S.owner.id}
  Relay   : ${S.smtp?S.smtp.host+':'+S.smtp.port:'none'}
  Agents  : ${S.agents.length} commissioned
  Monitors: ${S.monitors.length} bound

If you are reading this in your inbox, real outbound email is working and
2FA notifications are no longer an intent — they are delivered.

— Chairman Agent OS`,'TEST');
    return send(res,200,{ok:r.ok,reason:r.reason||null,state:pub()});
  }

  /* ---- SELF-UPGRADE ---- */
  if(p==='/api/upgrade/decide'){
    const pr=S.proposals.find(x=>x.id===b.id);
    if(!pr||pr.status!=='PENDING') return send(res,400,{error:'PROPOSAL NOT PENDING'});
    /* logged-in owner: approval is the tick itself */
    if(!b.ok){
      pr.status='REJECTED'; pr.resolved=nowIso();
      S.evolution.unshift({t:nowIso(),id:pr.id,kind:pr.kind,sig:pr.sig,decision:'REJECTED',
        label:pr.label,why:pr.why,result:'Owner declined. Will not be proposed again.',how:'owner'});
      log('WARN','EVOLUTION',`Upgrade ${pr.id} REJECTED by Owner. Permanently suppressed.`);
      save(); return send(res,200,{ok:1,state:pub()});
    }
    const r=applyProposal(pr,'owner-signed');
    if(!r.ok) return send(res,400,{error:r.error,state:pub()});
    return send(res,200,{ok:1,result:r.result,state:pub()});
  }
  /* ---- ARCHITECT: study a product, rebuild the capability ---- */
  if(p==='/api/architect/analyse'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    const u=(b.url||'').trim();
    if(!u) return send(res,400,{error:'PASTE A URL OR NAME A PRODUCT'});
    try{ const a=await analyseProduct(u,(b.hint||'').trim());
      return send(res,200,{ok:1,id:a.id,verdict:a.verdict,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/architect/assemble'){
    try{ const c=await assembleTeam(b.id);
      return send(res,200,{ok:1,built:c.built.length,reused:c.reuse.length,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/architect/remove'){
    S.analyses=(S.analyses||[]).filter(x=>x.id!==b.id);
    S.crews=(S.crews||[]).filter(x=>x.analysisId!==b.id);
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- WORKSPACE: files in, drafts out ---- */
  if(p==='/api/doc/upload'){
    const name=(b.name||'file').slice(0,120);
    if(!b.data) return send(res,400,{error:'NO FILE DATA'});
    const size = Math.round(String(b.data).length*0.75);
    if(size > 8e6) return send(res,400,{error:'FILE TOO LARGE — 8 MB maximum'});
    let text;
    try{ text = textFromUpload(name, b.mime||'', String(b.data)); }
    catch(e){ return send(res,400,{error:'COULD NOT READ FILE: '+e.message}); }
    const d={ id:uid('DOC'), t:nowIso(), name, mime:b.mime||'', size,
      text, chars:text.length, readable:!text.startsWith('[') };
    S.docs.unshift(d); S.docs=S.docs.slice(0,40);
    log('OK','WORKSPACE',`File "${name}" uploaded (${(size/1024).toFixed(0)} KB, ${d.chars} chars readable).`);
    save();
    return send(res,200,{ok:1,id:d.id,chars:d.chars,readable:d.readable,
      preview:text.slice(0,300),state:pub()});
  }
  if(p==='/api/doc/remove'){
    S.docs=(S.docs||[]).filter(d=>d.id!==b.id); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/doc/ask'){
    const d=(S.docs||[]).find(x=>x.id===b.id);
    if(!d) return send(res,404,{error:'FILE NOT FOUND'});
    try{
      const r=await think(
`The Owner uploaded this file and asks: ${b.question||'Summarise it and tell me what matters.'}

FILE: ${d.name}
CONTENT:
${d.text.slice(0,18000)}

Answer only from what is actually in the file. If the answer is not there, say so plainly.`,
        null,'doc-qa','Insight Forge');
      return send(res,200,{ok:1,text:r.text,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/draft/write'){
    if(!(b.brief||'').trim()) return send(res,400,{error:'SAY WHAT YOU NEED'});
    try{ const d=await draftFor(b.kind||'email', b.brief.trim(), b.docIds||[]);
      return send(res,200,{ok:1,id:d.id,text:d.text,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/draft/send'){
    const d=(S.drafts||[]).find(x=>x.id===b.id);
    if(!d) return send(res,404,{error:'DRAFT NOT FOUND'});
    if(!S.smtp) return send(res,400,{error:'NO MAIL RELAY ARMED — set one up on the Mail Relay page first'});
    const to=(b.to||'').trim();
    if(!/^\S+@\S+\.\S+$/.test(to)) return send(res,400,{error:'VALID RECIPIENT EMAIL REQUIRED'});
    let subject=b.subject||'Message from Chairman Agent OS', text=d.text;
    const m=d.text.match(/^SUBJECT:\s*(.+)$/im);
    if(m && !b.subject){ subject=m[1].trim(); text=d.text.replace(/^SUBJECT:.*$/im,'').trim(); }
    try{
      const r=await SMTP.send(S.smtp,{to,subject,text});
      d.sentTo=to; d.sentAt=nowIso();
      S.mailq.unshift({t:nowIso(),to:maskMail(to),subject,status:'DELIVERED ('+r.ms+'ms)',tag:'DRAFT'});
      log('OK','WORKSPACE',`Draft sent to ${maskMail(to)} — "${subject}".`);
      save(); return send(res,200,{ok:1,ms:r.ms,state:pub()});
    }catch(e){ return send(res,400,{error:'SEND FAILED: '+e.message}); }
  }
  if(p==='/api/draft/remove'){
    S.drafts=(S.drafts||[]).filter(x=>x.id!==b.id); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/selfrepair/run'){
    try{ const r=await repairCapability(b.name, b.error||'manual repair requested by Owner');
      return send(res,200,{ok:1,result:r||{fixed:false},state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }

  /* ---- CONNECTORS: any service, any key ---- */
  if(p==='/api/connector/add'){
    const name=(b.name||'').trim().replace(/[^a-z0-9._-]/gi,'').slice(0,32);
    const base=(b.base||'').trim();
    if(!name) return send(res,400,{error:'NAME REQUIRED (letters, numbers, dot, dash)'});
    if(!/^https?:\/\//i.test(base)) return send(res,400,{error:'BASE URL must start with https://'});
    if((S.connectors||[]).some(c=>c.name===name)) return send(res,400,{error:'"'+name+'" already exists'});
    if((S.connectors||[]).length>=40) return send(res,400,{error:'MAXIMUM 40 CONNECTORS'});
    let headers={};
    if(b.headers){ try{ headers=JSON.parse(b.headers); }catch(e){ return send(res,400,{error:'Extra headers must be valid JSON'}); } }
    S.connectors.push({ name, base, key:(b.key||'').trim(),
      auth:['bearer','header','query','none'].includes(b.auth)?b.auth:'bearer',
      headerName:(b.headerName||'X-API-Key').trim(), queryName:(b.queryName||'key').trim(),
      headers, note:(b.note||'').slice(0,120), enabled:true, calls:0, fails:0, t:nowIso() });
    log('OK','CONNECTORS',`Connector "${name}" added → ${base}. Key withheld from ledger.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/connector/remove'){
    S.connectors=(S.connectors||[]).filter(c=>c.name!==b.name);
    log('WARN','CONNECTORS',`Connector "${b.name}" removed.`); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/connector/toggle'){
    const c=(S.connectors||[]).find(x=>x.name===b.name);
    if(c){ c.enabled = c.enabled===false; save(); }
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/connector/test'){
    try{ const out=await connectorCall(b.name,{path:b.path||'',method:b.method||'GET'});
      return send(res,200,{ok:1,sample:JSON.stringify(out).slice(0,500),state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }

  if(p==='/api/selfextend/write'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{ const c = await writeCapability((b.goal||'').trim());
      return send(res,200,{ok:1,name:c.name,blocked:c.violations.length>0,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/selfextend/discard'){
    S.writtenCaps=(S.writtenCaps||[]).filter(c=>c.id!==b.id);
    S.proposals=(S.proposals||[]).filter(p2=>!(p2.payload&&p2.payload.capId===b.id));
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/upgrade/scan'){ selfAudit();
    return send(res,200,{ok:1,pending:S.proposals.filter(x=>x.status==='PENDING').length,state:pub()}); }
  if(p==='/api/upgrade/autopilot'){
    S.autopilot=!!b.on;
    log(S.autopilot?'CRIT':'OK','EVOLUTION',
      S.autopilot?'AUTOPILOT ENABLED — SAFE-class upgrades will self-apply without further signature.'
                 :'Autopilot disabled. Every upgrade now requires an Owner signature.');
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/skill/teach'){
    const phrase=(b.phrase||'').trim().toLowerCase(), action=(b.action||'').trim();
    if(!phrase||!action) return send(res,400,{error:'PHRASE AND ACTION REQUIRED'});
    if(S.skills.some(s=>s.phrase===phrase)) return send(res,400,{error:'ALREADY KNOWN'});
    S.skills.push({phrase,action,kind:b.kind||'note',learned:nowIso(),uses:0,origin:'owner'});
    log('OK','EVOLUTION',`Skill learned from Owner: "${phrase}"`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/skill/forget'){
    S.skills=S.skills.filter(s=>s.phrase!==b.phrase);
    log('WARN','EVOLUTION',`Skill forgotten: "${b.phrase}"`); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/skill/use'){
    const s=S.skills.find(x=>x.phrase===(b.phrase||'').toLowerCase());
    if(!s) return send(res,404,{error:'UNKNOWN SKILL'});
    s.uses++; s.lastUsed=nowIso(); save();
    return send(res,200,{ok:1,action:s.action,state:pub()});
  }

  /* ---- AI BRAIN ---- */
  if(p==='/api/llm/connect'){
    const P=LLM.PROVIDERS[b.provider];
    if(!P) return send(res,400,{error:'UNKNOWN PROVIDER'});
    if(!P.nokey && !P.custom && !(b.key||'').trim())
      return send(res,400,{error:'API key required for '+P.label+'. '+P.signup});
    S.llm={ provider:b.provider, key:(b.key||'').trim(),
      model:(b.model||'').trim()||P.model, host:(b.host||'').trim(), t:nowIso() };
    if(P.custom && !S.llm.host) return send(res,400,{error:'Custom provider needs a Base URL, e.g. https://api.deepseek.com/v1'});
    if(P.custom && !S.llm.model) return send(res,400,{error:'Custom provider needs a model name'});
    log('OK','AI BRAIN',`Connected to ${P.label} (${S.llm.model}). Key withheld from ledger.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  /* ---- SITE BUILDER ---- */
  if(p==='/api/site/build'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{ const built=await buildSite(b.ventureId||null, (b.brief||'').trim());
      return send(res,200,{ok:1,id:built.id,bytes:built.bytes,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  /* ---- SMTP PREFLIGHT ----
     The one test that actually matters before a campaign: talk to the REAL
     mail server with the Owner's REAL credentials and report exactly which
     stage fails. Every stage below was verified against live smtp.gmail.com.
     A 535 here is the difference between "my app is broken" and "you pasted
     your Google password instead of an app password". */
  if(p==='/api/smtp/preflight'){
    if(!S.smtp || !S.smtp.host) return send(res,400,{error:'No SMTP configured yet.'});
    const steps=[]; const t0=Date.now();
    const net=require('net'), tls=require('tls');
    const host=S.smtp.host, port=+S.smtp.port||587;
    const secure = S.smtp.secure===true || port===465;
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    let sock=null;
    const done=(ok,fatal,advice)=>{ try{sock&&sock.destroy();}catch(e){}
      return send(res,200,{ok,steps,ms:Date.now()-t0,fatal,advice,
        window:sendWindow()}); };
    const line=(s,timeout)=>new Promise((resolve,reject)=>{
      let b=''; const to=setTimeout(()=>reject(new Error('timed out waiting for the server')),timeout||15000);
      const on=d=>{ b+=d.toString();
        const ls=b.split(/\r?\n/).filter(Boolean); const last=ls[ls.length-1]||'';
        if(!/^\d{3} /.test(last)) return;
        clearTimeout(to); s.removeListener('data',on); resolve({code:+last.slice(0,3),text:b.trim()}); };
      s.on('data',on); s.once('error',e=>{clearTimeout(to);reject(e);});
    });
    try{
      sock = await new Promise((resolve,reject)=>{
        const o={host,port}; if(!isIp) o.servername=host;
        const s = secure ? tls.connect(o,()=>resolve(s)) : net.connect(o,()=>resolve(s));
        s.setTimeout(15000,()=>{ s.destroy(new Error('connect timed out')); });
        s.once('error',reject);
      });
      steps.push({step:`Reach ${host}:${port}`,ok:true,detail:`TCP open${secure?' (implicit TLS)':''}`});

      let r = await line(sock);
      if(r.code!==220) return done(false,`Server greeting was ${r.code}, expected 220`,'');
      steps.push({step:'Server greeting',ok:true,detail:r.text.slice(0,80)});

      sock.write('EHLO chairman-os\r\n'); r = await line(sock);
      if(r.code!==250) return done(false,`EHLO refused (${r.code})`,'');
      const caps = r.text;
      steps.push({step:'EHLO handshake',ok:true,
        detail:(/STARTTLS/i.test(caps)?'STARTTLS offered · ':'')+(/AUTH/i.test(caps)?'AUTH offered':'no AUTH advertised')});

      if(!secure){
        if(!/STARTTLS/i.test(caps))
          return done(false,'The server does not offer STARTTLS',
            'Credentials would travel in clear text. Refusing. Use port 465 with implicit TLS, or a different server.');
        sock.write('STARTTLS\r\n'); r = await line(sock);
        if(r.code!==220) return done(false,`STARTTLS refused (${r.code})`,'');
        sock = await new Promise((resolve,reject)=>{
          const o={socket:sock}; if(!isIp) o.servername=host;
          const s=tls.connect(o,()=>resolve(s)); s.once('error',reject);
        });
        const cert=sock.getPeerCertificate?sock.getPeerCertificate():{};
        /* One deliberate exception: an operator running a LAN relay on
           localhost with a self-signed cert is not being attacked. Anything
           reachable off-box must present a trusted certificate. */
        const localOnly = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);
        const certOk = sock.authorized || localOnly;
        steps.push({step:'Encrypt the connection',ok:certOk,
          detail: sock.authorized
            ? `TLS verified · ${cert.subject&&cert.subject.CN||host} · issued by ${cert.issuer&&cert.issuer.O||'?'} · valid to ${cert.valid_to||'?'}`
            : localOnly
              ? 'encrypted, self-signed certificate accepted because the server is on this machine'
              : 'CERTIFICATE NOT TRUSTED — '+(sock.authorizationError||'unknown')});
        if(!certOk)
          return done(false,'The server\'s TLS certificate is not trusted: '+sock.authorizationError,
            'Someone may be intercepting the connection. Do not send credentials through it.');
        sock.write('EHLO chairman-os\r\n'); r = await line(sock);
        if(r.code!==250) return done(false,`EHLO after STARTTLS refused (${r.code})`,'');
      }

      sock.write('AUTH LOGIN\r\n'); r = await line(sock);
      if(r.code!==334) return done(false,`Server would not start AUTH LOGIN (${r.code})`,
        'This server may require a different auth method.');
      sock.write(Buffer.from(S.smtp.user,'utf8').toString('base64')+'\r\n'); r = await line(sock);
      if(r.code!==334) return done(false,`Username rejected (${r.code})`,'Use your FULL email address as the username.');
      sock.write(Buffer.from(S.smtp.pass,'utf8').toString('base64')+'\r\n'); r = await line(sock);

      if(r.code===535){
        steps.push({step:'Log in',ok:false,detail:r.text.slice(0,120)});
        S.smtpVerified = null; save();
        const gmail=/gmail\.com|googlemail/i.test(host);
        return done(false,'LOGIN REJECTED by the server (535).',
          gmail
            ? 'Three causes, in order of likelihood: (1) you used your normal Google password — it MUST be a 16-character App Password from myaccount.google.com/apppasswords; (2) 2-Step Verification is not switched on, which is required before App Passwords exist at all; (3) the App Password was revoked. Generate a fresh one and paste it again — spaces are fine, they are stripped.'
            : 'Check the username is the full address and the password is correct for this server.');
      }
      if(r.code!==235){
        steps.push({step:'Log in',ok:false,detail:r.text.slice(0,120)});
        return done(false,`Authentication failed (${r.code})`,r.text.slice(0,200));
      }
      steps.push({step:'Log in',ok:true,detail:'accepted — your credentials are correct'});

      /* Prove the envelope is accepted WITHOUT sending anything: Gmail
         validates MAIL FROM and RCPT TO, then RSET discards it. */
      sock.write('MAIL FROM:<'+(S.smtp.from||S.smtp.user)+'>\r\n'); r = await line(sock);
      if(r.code!==250)
        return done(false,`Your FROM address was refused (${r.code}): ${r.text.slice(0,120)}`,
          'Gmail only lets you send as your own address or a verified alias. Set FROM to the same address as the username.');
      steps.push({step:'Sender address accepted',ok:true,detail:S.smtp.from||S.smtp.user});

      const probe = (b.to||'').trim() || S.owner.email;
      sock.write('RCPT TO:<'+probe+'>\r\n'); r = await line(sock);
      steps.push({step:'Recipient accepted',ok:r.code===250,
        detail: r.code===250 ? probe+' would be delivered' : `refused (${r.code}) ${r.text.slice(0,90)}`});
      sock.write('RSET\r\n'); await line(sock).catch(()=>{});
      sock.write('QUIT\r\n'); await line(sock).catch(()=>{});

      S.smtpVerified = { at:nowIso(), host, user:S.smtp.user, from:S.smtp.from||S.smtp.user };
      save();
      log('OK','MAIL',`SMTP preflight PASSED against ${host} in ${Date.now()-t0}ms. Real credentials accepted by the real server.`);
      const w=sendWindow();
      return done(true,null,
        `Everything works. He can send real email as ${S.smtp.from||S.smtp.user}. `
        + `${w.left} of ${w.cap} sends left in this 24-hour window.`);
    }catch(e){
      steps.push({step:'FAILED',ok:false,detail:e.message});
      let advice='';
      if(/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(e.message))
        advice='That server name does not resolve. For Gmail it is exactly: smtp.gmail.com';
      else if(/ECONNREFUSED|ETIMEDOUT|timed out/i.test(e.message))
        advice='Port '+port+' is blocked or unreachable from this host. Try port 465 with implicit TLS.';
      else if(/certificate|self.signed|altnames/i.test(e.message))
        advice='TLS certificate problem — do not send credentials until this is resolved.';
      S.smtpVerified = null; save();
      log('CRIT','MAIL','SMTP preflight FAILED — '+e.message);
      return done(false,e.message,advice);
    }
  }

  /* ---- GROWTH ENGINE ---- */
  if(p==='/api/growth/plan'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{ const c=await planCampaign(b.bizId, b.goal||'');
      return send(res,200,{ok:1,id:c.id,actions:c.actions.length,auto:c.autoCount,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/growth/run'){
    try{ const r=await runCampaign(b.id);
      return send(res,200,{ok:1,sent:r.sent,parked:r.parked,failed:r.failed,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/growth/address'){
    try{ const r=await fillAddress(b.campId,b.actionId,b.email);
      return send(res,200,{ok:1,to:r.to,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/growth/delete'){
    S.campaigns=(S.campaigns||[]).filter(x=>x.id!==b.id);
    S.missions=(S.missions||[]).filter(m=>m.campaignId!==b.id);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/growth/replied'){
    const o=(S.outreach||[]).find(x=>x.to===b.to&&x.t===b.t);
    if(o){ o.replied=true; log('OK','GROWTH',`REPLY from ${b.to}. Follow it up today, not tomorrow.`); save(); }
    return send(res,200,{ok:1,state:pub()});
  }

  /* ---- STORAGE SELF-TEST ----
     Proves persistence works by doing a real round trip, instead of the
     Owner discovering it did not after a restart destroyed the work. */
  if(p==='/api/store/test'){
    const probeName = 'storage-selftest.json';
    const token = crypto.randomBytes(8).toString('hex');
    const steps = [];
    const t0 = Date.now();
    try{
      if(STORE.verify){
        const v = await STORE.verify();
        steps.push({ step:'Reach the store', ok:true,
          detail: v.full_name ? `${v.full_name} · ${v.private?'PRIVATE (correct)':'PUBLIC — YOUR STATE IS WORLD-READABLE, FIX THIS NOW'}` : 'reachable' });
        if(v.private === false)
          return send(res,200,{ok:0,steps,fatal:'The repo is PUBLIC. Anyone can read your API keys, SMTP password and client data. Make it private before doing anything else.'});
      } else steps.push({ step:'Reach the store', ok:true, detail:'local filesystem' });

      await STORE.write(probeName, JSON.stringify({ token, at:nowIso() }));
      steps.push({ step:'Write a test file', ok:true, detail:probeName });

      await new Promise(r=>setTimeout(r, STORE.mode==='github' ? 2500 : 100));

      const back = await STORE.read(probeName);
      const got = back ? (JSON.parse(back).token || '') : '';
      const match = got === token;
      steps.push({ step:'Read it back', ok:match,
        detail: match ? 'byte-for-byte match' : `MISMATCH — wrote ${token}, read ${got||'nothing'}` });
      if(!match)
        return send(res,200,{ok:0,steps,fatal:'The store accepted a write but did not return it. Persistence is NOT working. Do not build anything until this passes.'});

      const bs = await BLOBS.put('selftest', { big:'x'.repeat(50000) });
      const bg = await BLOBS.get('selftest');
      const bok = bg && bg.big && bg.big.length === 50000;
      steps.push({ step:'Compressed blob round trip', ok:!!bok,
        detail: bok ? `50 KB → ${(bs.stored/1024).toFixed(1)} KB stored (${bs.ratio}:1)` : 'FAILED' });
      await BLOBS.del('selftest');

      await STORE.remove(probeName);
      steps.push({ step:'Clean up', ok:true, detail:'test file deleted' });

      const h = storageHealth();
      log('OK','STORAGE',`Self-test PASSED in ${Date.now()-t0}ms — ${h.describe}. Persistence confirmed by round trip.`);
      return send(res,200,{ok:1,steps,ms:Date.now()-t0,health:h,
        verdict: h.ephemeral
          ? 'Round trip works, BUT this host has no persistent disk — it will still be wiped on restart. Switch to STORE=github.'
          : 'Persistence confirmed. Your work survives restarts and redeploys.'});
    }catch(e){
      steps.push({ step:'FAILED', ok:false, detail:e.message });
      log('CRIT','STORAGE','Self-test FAILED — '+e.message);
      return send(res,200,{ok:0,steps,fatal:e.message});
    }
  }

  /* ---- DOMAIN DESK ---- */
  if(p==='/api/dom/check'){
    const raw=String(b.names||'').split(/[\s,\n]+/).filter(Boolean).slice(0,40);
    if(!raw.length) return send(res,400,{error:'TYPE AT LEAST ONE NAME'});
    try{
      const rs=await DOMAINS.checkMany(raw,{lanes:3,gap:220});
      const av=rs.filter(x=>x.status==='AVAILABLE').length;
      log('INFO','DOMAIN DESK',`Checked ${rs.length} name(s) against live registries — ${av} available.`);
      return send(res,200,{ok:1,results:rs});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/dom/expand'){
    const sld=String(b.sld||'').trim();
    if(!sld) return send(res,400,{error:'TYPE A NAME'});
    const names=DOMAINS.expand(sld, Array.isArray(b.tlds)?b.tlds:null);
    if(!names.length) return send(res,400,{error:'NOTHING USABLE IN THAT NAME'});
    try{ return send(res,200,{ok:1,results:await DOMAINS.checkMany(names,{lanes:3,gap:220})}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/dom/suggest'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    if(!(b.brief||'').trim()) return send(res,400,{error:'DESCRIBE THE BUSINESS FIRST'});
    try{ const r=await suggestNames(b.brief.trim(), Array.isArray(b.tlds)?b.tlds:null, b.count);
      return send(res,200,{ok:1,id:r.id,available:r.available,checked:r.checked,unknown:r.unknown,state:pub()});
    }catch(e){ log('WARN','DOMAIN DESK','Suggest failed — '+e.message); return send(res,400,{error:e.message}); }
  }
  if(p==='/api/dom/watch'){
    S.domains=S.domains||{watch:[],runs:[]};
    const n=String(b.name||'').toLowerCase().trim();
    const v=DOMAINS.validate(n);
    if(!v.ok) return send(res,400,{error:'Not a valid domain — '+v.why});
    if(S.domains.watch.some(x=>x.name===v.name)) return send(res,400,{error:'ALREADY WATCHED'});
    if(S.domains.watch.length>=40) return send(res,400,{error:'Watchlist is full at 40. Remove one first.'});
    let r; try{ r=await DOMAINS.check(v.name); }catch(e){ r={status:'UNKNOWN'}; }
    S.domains.watch.unshift({ name:v.name, tld:v.tld, status:r.status, checked:nowIso(),
      expires:r.expires||null, registrar:r.registrar||null, note:String(b.note||'').slice(0,120), added:nowIso() });
    log('OK','DOMAIN DESK',`Watching "${v.name}" — currently ${r.status}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/dom/unwatch'){
    S.domains=S.domains||{watch:[],runs:[]};
    S.domains.watch=S.domains.watch.filter(x=>x.name!==b.name); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/dom/recheck'){
    try{ const r=await CAPS['dom.check_own'].run(); return send(res,200,{ok:1,msg:r.msg,detail:r.detail,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/dom/math'){
    return send(res,200,{ok:1,math:resellerMath(b.perMonth)});
  }
  if(p==='/api/dom/clear'){
    S.domains=S.domains||{watch:[],runs:[]}; S.domains.runs=[]; save();
    return send(res,200,{ok:1,state:pub()});
  }

  /* ---- BUSINESS FACTORY ---- */
  if(p==='/api/biz/build'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{
      const built=await buildBusiness({ ventureId:b.ventureId||null, brief:b.brief||'',
        phone:b.phone, whatsapp:b.whatsapp, address:b.address, gstin:b.gstin,
        tool: b.tool!==false });
      return send(res,200,{ok:1,id:built.id,name:built.name,
        files:built.fileList.length,zipBytes:built.zipBytes,tells:built.tellCount,state:pub()});
    }catch(e){ log('WARN','FACTORY','Build failed — '+e.message); return send(res,400,{error:e.message}); }
  }
  if(p==='/api/biz/delete'){
    S.businesses=(S.businesses||[]).filter(x=>x.id!==b.id);
    await BLOBS.del(b.id); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/biz/published'){
    const z=(S.businesses||[]).find(x=>x.id===b.id);
    if(!z) return send(res,400,{error:'NO SUCH BUSINESS'});
    const u=String(b.url||'').trim();
    if(u && !/^https?:\/\//i.test(u)) return send(res,400,{error:'URL must start with http:// or https://'});
    z.published=!!u; z.publishedUrl=u;
    if(u){
      log('OK','FACTORY',`"${z.name}" is LIVE at ${u}`);
      if(!(S.monitors||[]).some(m=>m.url===u)){
        S.monitors.push({ id:uid('MON'), url:u, name:z.name, interval:300,
          state:'UNKNOWN', checks:0, up:0, down:0, history:[], added:nowIso() });
        log('OK','UPTIME MARSHAL',`Now watching your own site ${u} every 5 minutes.`);
        runMonitors(true);
      }
    }
    save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/site/delete'){
    S.builds=(S.builds||[]).filter(x=>x.id!==b.id); save();
    return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/agent/run'){
    if(!(b.goal||'').trim()) return send(res,400,{error:'STATE A GOAL'});
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{
      const r = await agentLoop(b.goal.trim(), b.steps);
      S.chat.unshift({t:nowIso(),who:'OWNER',text:'[AGENT] '+b.goal.trim()});
      S.chat.unshift({t:nowIso(),who:'CHAIRMAN',text:r.answer});
      S.chat=S.chat.slice(0,200);
      S.agentRuns = S.agentRuns||[];
      S.agentRuns.unshift({t:nowIso(), goal:b.goal.trim(), steps:r.steps,
        answer:r.answer, trace:r.trace, hitCap:!!r.hitCap});
      S.agentRuns = S.agentRuns.slice(0,25);
      log('OK','AGENT LOOP',`Goal completed in ${r.steps} step(s).`);
      save();
      return send(res,200,{ok:1,answer:r.answer,trace:r.trace,steps:r.steps,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/agent/clear'){ S.agentRuns=[]; save(); return send(res,200,{ok:1,state:pub()}); }

  if(p==='/api/llm/backup/add'){
    const P=LLM.PROVIDERS[b.provider];
    if(!P) return send(res,400,{error:'UNKNOWN PROVIDER'});
    if(!P.nokey && !P.custom && !(b.key||'').trim())
      return send(res,400,{error:'API key required for '+P.label+'. '+P.signup});
    S.llmBackups = S.llmBackups || [];
    if(S.llmBackups.length >= 40) return send(res,400,{error:'MAXIMUM 40 KEYS'});
    S.llmBackups.push({ provider:b.provider, key:(b.key||'').trim(),
      model:(b.model||'').trim()||P.model, host:(b.host||'').trim(),
      t:nowIso(), ok:0, fail:0, cooled:0 });
    log('OK','AI BRAIN',`Backup provider added: ${P.label}. Used only when the primary is throttled.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/llm/backup/remove'){
    S.llmBackups = (S.llmBackups||[]).filter((x,i)=>i !== +b.index);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/llm/cooldown/clear'){
    COOLDOWN_UNTIL = 0;
    log('OK','AI BRAIN','Quota cooldown cleared manually by Owner.');
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/llm/model'){
    if(!S.llm) return send(res,400,{error:'NO BRAIN CONNECTED — connect one first'});
    const m=(b.model||'').trim();
    if(!m) return send(res,400,{error:'MODEL NAME REQUIRED'});
    const old=S.llm.model;
    S.llm.model=m;
    log('OK','AI BRAIN',`Model switched: ${old} → ${m}. Key and provider kept.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/llm/purge'){ S.llm=null; log('CRIT','AI BRAIN','AI brain disconnected.');
    save(); return send(res,200,{ok:1,state:pub()}); }
  if(p==='/api/llm/models'){
    const cfg = { provider:b.provider||(S.llm&&S.llm.provider), key:(b.key||'').trim()||(S.llm&&S.llm.key) };
    if(!cfg.provider) return send(res,400,{error:'PICK A PROVIDER FIRST'});
    try{ const ids=await LLM.listModels(cfg); return send(res,200,{ok:1,models:ids}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/llm/test'){
    try{
      const r=await think('Reply with exactly one sentence confirming you are online and name your model.',
        null,'test','Chairman');
      save(); return send(res,200,{ok:1,text:r.text,ms:r.ms,model:r.model,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/llm/ask'){
    if(!(b.prompt||'').trim()) return send(res,400,{error:'PROMPT REQUIRED'});
    try{
      const r=await think(b.prompt.trim(), b.sys||null, b.tag||'owner-task', b.agent||'Chairman');
      log('INFO','AI TASK',`Owner task executed (${r.tokens} tokens).`);
      save(); return send(res,200,{ok:1,text:r.text,ms:r.ms,tokens:r.tokens,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/llm/clear'){ S.outputs=[]; save(); return send(res,200,{ok:1,state:pub()}); }

  /* ---- COMMAND CONSOLE: you talk, he acts ---- */
  if(p==='/api/command'){
    const text=(b.text||'').trim();
    if(!text) return send(res,400,{error:'SAY SOMETHING'});
    S.chat.unshift({t:nowIso(),who:'OWNER',text}); S.chat=S.chat.slice(0,200);
    const ctx=`SYSTEM STATE RIGHT NOW: ${S.agents.length} agents, `+
      `${S.monitors.length} monitored sites (${S.monitors.filter(m=>m.state==='DOWN').length} down), `+
      `${S.ideas.length} ideas (${S.ideas.filter(i=>i.status==='RAW').length} unresearched), `+
      `${S.ventures.length} live ventures, ${S.orders.length} payment links raised, `+
      `runtime ${S.running?'RUNNING':'HALTED'}, payments ${S.pay?S.pay.gateway+' armed':'not configured'}, `+
      `mail ${S.smtp?'armed':'offline'}.`;
    try{
      const r=await think(
`${ctx}

The Owner just told you: "${text}"

You are the Chairman. Reply directly to the Owner. If this is an instruction,
say precisely what you will do and what you need from them. If it needs a
capability the system does not have, say so plainly instead of pretending.
Never claim to have done something you have not done. Under 180 words.`,
        null,'command','Chairman');
      S.chat.unshift({t:nowIso(),who:'CHAIRMAN',text:r.text}); S.chat=S.chat.slice(0,200);
      save(); return send(res,200,{ok:1,text:r.text,state:pub()});
    }catch(e){
      S.chat.unshift({t:nowIso(),who:'SYSTEM',text:'FAILED: '+e.message});
      save(); return send(res,400,{error:e.message,state:pub()});
    }
  }
  if(p==='/api/command/clear'){ S.chat=[]; save(); return send(res,200,{ok:1,state:pub()}); }

  /* ---- HUSTLE MODE: maximum parallel money-focused output ---- */
  if(p==='/api/runtime/hustle'){
    if(b.on && !S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST — hustle mode is mostly AI work'});
    S.lanes = Math.min(6, Math.max(1, +b.lanes||3));
    seedTasks(true, !!b.on);
    S.running = true;
    save();
    setTimeout(tick, 500);
    return send(res,200,{ok:1,tasks:S.tasks.length,state:pub()});
  }
  if(p==='/api/runtime/lanes'){
    S.lanes = Math.min(6, Math.max(1, +b.lanes||3)); save();
    return send(res,200,{ok:1,state:pub()});
  }

  /* ---- SPEND REQUEST: he asks, you approve, budget is enforced ---- */
  if(p==='/api/spend/request'){
    const amt=+b.amount||0;
    if(amt<=0) return send(res,400,{error:'POSITIVE AMOUNT REQUIRED'});
    if(!(b.what||'').trim()) return send(res,400,{error:'STATE WHAT IT BUYS'});
    S.gates.unshift({ id:uid('GATE'), t:nowIso(),
      title:`Spend ₹${amt.toLocaleString()} — ${b.what.trim()}`,
      cls:'FINANCIAL TRANSFER', cost:amt, free:b.free||'',
      obj:`Spend ₹${amt.toLocaleString()} on: ${b.what.trim()}. Expected return: ${b.roi||'not stated'}.`,
      just:b.why||'Requested by the Chairman to unblock a venture.',
      safe:'Owner signature required. Amount capped by the budget ceiling. Recorded against lifetime spend.',
      risk: amt>2000?'HIGH':amt>500?'MEDIUM':'LOW', amt:0, status:'PENDING' });
    log('WARN','TREASURY',`Spend request ₹${amt} — ${b.what.trim()}. FROZEN pending your signature.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/spend/budget'){
    S.budget = Math.max(0, +b.budget||0);
    log('CRIT','TREASURY',`Owner set a spending ceiling of ₹${S.budget}. Anything above this is refused outright.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- RESEARCH: read any page, deep-dive any topic ---- */
  if(p==='/api/research/read'){
    if(!(b.url||'').trim()) return send(res,400,{error:'URL REQUIRED'});
    try{
      const pg = await RESEARCH.readPage(b.url.trim());
      const r = await think(
`You just read this page in full.
URL: ${pg.url}
TITLE: ${pg.title}

CONTENT:
${pg.text}

${b.ask ? 'The Owner asks: '+b.ask : 'Summarise what matters, and state plainly what this page does NOT say.'}
Cite only what is actually on the page. If it is thin or promotional, say so.`,
        null,'read-page','Market Signal');
      return send(res,200,{ok:1,title:pg.title,text:r.text,chars:pg.text.length,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/research/dive'){
    if(!(b.topic||'').trim()) return send(res,400,{error:'TOPIC REQUIRED'});
    try{
      const ev = await RESEARCH.deepDive(b.topic.trim(), b.region||'Ludhiana Punjab India');
      const r = await think(
`Live evidence gathered just now on: ${b.topic}

${ev.slice(0,7000)}

Give: 5 hard facts the evidence supports, 2 common assumptions it contradicts,
1 unserved opportunity, and what you could NOT find out. Invent nothing.`,
        null,'deep-dive','Market Signal');
      return send(res,200,{ok:1,text:r.text,evidence:ev.length,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }

  /* ---- MISSION ENGINE: he guides, you execute ---- */
  if(p==='/api/mission/generate'){
    try{ const a=await generateMissions(b.ventureId||null, b.feedback||'');
      return send(res,200,{ok:1,added:a.length,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/mission/debrief'){
    try{ const r=await debriefMission(b.id, b.outcome, b.note);
      return send(res,200,{ok:1,advice:r.advice,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/mission/playbook'){
    if(!(b.topic||'').trim()) return send(res,400,{error:'TOPIC REQUIRED'});
    try{ const pb=await writePlaybook(b.topic.trim());
      return send(res,200,{ok:1,id:pb.id,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/mission/clear'){
    S.missions=S.missions.filter(m=>m.status==='OPEN'); save();
    return send(res,200,{ok:1,state:pub()});
  }

  /* ---- VENTURE ENGINE ---- */
  if(p==='/api/idea/generate'){
    try{ const a=await generateIdeas(Math.min(8,+b.n||5), b.steer);
      return send(res,200,{ok:1,added:a.length,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/idea/research'){
    try{ const i=await researchIdea(b.id);
      return send(res,200,{ok:1,score:i.score,verdict:i.verdict,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/idea/launch'){
    try{ const r=await buildVenture(b.id);
      return send(res,200,{ok:1,agents:r.agents.length,skipped:r.skipped,state:pub()}); }
    catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/idea/kill'){
    const i=S.ideas.find(x=>x.id===b.id); if(i){ i.status='KILLED'; log('WARN','VENTURE',`Idea "${i.title}" killed by Owner.`); }
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/idea/autopilot'){
    S.autoIdeas=!!b.on;
    log(S.autoIdeas?'CRIT':'OK','VENTURE',
      S.autoIdeas?'IDEA AUTOPILOT ON — Chairman will invent and research ideas unprompted.'
                 :'Idea autopilot off.');
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- REAL PAYMENTS ---- */
  if(p==='/api/pay/connect'){
    const G=PAY.GATEWAYS[b.gateway]; if(!G) return send(res,400,{error:'UNKNOWN GATEWAY'});
    if(b.gateway==='razorpay' && (!b.keyId||!b.keySecret))
      return send(res,400,{error:'Razorpay needs BOTH Key ID and Key Secret'});
    if(b.gateway==='stripe' && !b.keySecret)
      return send(res,400,{error:'Stripe needs the Secret key (sk_test_... or sk_live_...)'});
    const cfg={ gateway:b.gateway, keyId:(b.keyId||'').trim(), keySecret:(b.keySecret||'').trim(),
      webhookSecret:(b.webhookSecret||'').trim() };
    try{
      const v=await G.verify(cfg);
      cfg.live=v.live; cfg.t=nowIso();

      /* TREASURY LOCK.
         The Owner's rule: every rupee lands in HIS account, never anywhere
         else. Once a gateway is sealed, the account fingerprint is frozen.
         Connecting different credentials later requires his password and an
         explicit unseal — so a compromised session, a bug, or the Chairman
         himself cannot silently repoint the money. */
      const fp = crypto.createHash('sha256')
        .update(cfg.gateway + '|' + (cfg.keyId || cfg.keySecret.slice(0,14)))
        .digest('hex').slice(0,16);
      if(S.treasuryLock && S.treasuryLock.fp && S.treasuryLock.fp !== fp){
        if(!verify(b.pw||''))
          return send(res,401,{error:
            `TREASURY LOCKED to a different account (sealed ${S.treasuryLock.t}). These credentials pay into somewhere else. Enter your Owner password to repoint the money — nothing else can do it.`});
        log('CRIT','TREASURY',
          `TREASURY REPOINTED by Owner signature. Money now lands in ${G.label} account ${fp}. Previous: ${S.treasuryLock.fp}.`);
        mail('Treasury repointed',
`The payment account receiving all money has been CHANGED.

  Gateway    : ${G.label}
  New account: ${fp}
  Old account: ${S.treasuryLock.fp}
  Mode       : ${v.live?'LIVE — real money':'TEST'}
  At         : ${nowIso()} UTC

If you did not do this, your session is compromised. Revoke all sessions and
rotate your password immediately.

— Chairman Agent OS · Treasury`,'TREASURY');
      }
      cfg.fp = fp;
      S.pay = cfg;
      S.treasuryLock = { fp, gateway:cfg.gateway, t:nowIso(), live:!!v.live };
      log(v.live?'CRIT':'OK','TREASURY',
        `Payment gateway ${G.label} verified in ${v.live?'LIVE — real money':'TEST'} mode. Secret withheld from ledger.`);
      save(); return send(res,200,{ok:1,live:v.live,state:pub()});
    }catch(e){ return send(res,400,{error:'KEYS REJECTED — '+e.message}); }
  }
  if(p==='/api/pay/purge'){
    if(S.treasuryLock && !verify(b.pw||''))
      return send(res,401,{error:'The treasury is sealed to your account. Disconnecting it needs your Owner password.'});
    S.pay=null; S.treasuryLock=null;
    log('CRIT','TREASURY','Payment gateway disconnected and treasury lock cleared by Owner signature.');
    save(); return send(res,200,{ok:1,state:pub()}); }
  if(p==='/api/pay/link'){
    if(!S.pay) return send(res,400,{error:'NO GATEWAY CONNECTED'});
    const amt=+b.amount||0;
    if(amt<=0) return send(res,400,{error:'POSITIVE AMOUNT REQUIRED'});
    if(!(b.description||'').trim()) return send(res,400,{error:'DESCRIPTION REQUIRED'});
    /* Live money always needs a signature. Test mode does not. */
    if(S.pay.live && !verify(b.pw||''))
      return send(res,401,{error:'LIVE MODE — Owner password required to raise a real payment link'});
    const G=PAY.GATEWAYS[S.pay.gateway];
    if(S.treasuryLock && S.pay.fp && S.treasuryLock.fp !== S.pay.fp)
      return send(res,403,{error:'BLOCKED — the active gateway does not match the sealed treasury account. No link will be raised.'});
    try{
      const l=await G.link(S.pay,{amount:amt,description:b.description.trim(),
        name:b.name,email:b.email,phone:b.phone,currency:b.currency,ref:b.ref||uid('REF')});
      const o={ id:l.id, t:nowIso(), url:l.url, amount:amt, currency:l.currency,
        desc:b.description.trim(), customer:b.name||b.email||b.phone||'—',
        gateway:S.pay.gateway, live:!!S.pay.live, status:l.status, paid:0 };
      S.orders.unshift(o); S.orders=S.orders.slice(0,200);
      log(S.pay.live?'CRIT':'OK','TREASURY',
        `Payment link ${o.id} raised for ${l.currency} ${amt} (${S.pay.live?'LIVE':'TEST'}) — ${o.desc}`);
      save(); return send(res,200,{ok:1,url:l.url,id:l.id,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/pay/refresh'){
    if(!S.pay) return send(res,400,{error:'NO GATEWAY'});
    const G=PAY.GATEWAYS[S.pay.gateway];
    let updated=0;
    for(const o of S.orders.slice(0,25)){
      if(o.gateway!==S.pay.gateway || o.status==='paid') continue;
      try{ const st=await G.status(S.pay,o.id);
        if(st.status!==o.status || st.paid>o.paid){
          if(st.paid>o.paid && st.paid>0){
            S.revenue.push({t:nowIso(),src:'Payment · '+o.desc,amt:st.paid});
            log('OK','TREASURY',`PAYMENT RECEIVED ${o.currency} ${st.paid} — ${o.desc}`);
            mail('Payment received',
`A payment has settled.

  Amount : ${o.currency} ${st.paid}
  For    : ${o.desc}
  From   : ${o.customer}
  Link   : ${o.id}
  Mode   : ${o.live?'LIVE':'TEST'}

— Chairman Agent OS · Treasury`,'PAYMENT');
          }
          o.status=st.status; o.paid=st.paid; updated++;
        }
      }catch(e){}
    }
    save(); return send(res,200,{ok:1,updated,state:pub()});
  }

  /* ---- RUNTIME CONTROL ---- */
  if(p==='/api/runtime/power'){
    S.running=!!b.on;
    if(S.running) seedTasks();
    log(S.running?'OK':'CRIT','RUNTIME',
      S.running?'SYSTEM RUNNING — all standing orders executing on schedule.'
               :'SYSTEM HALTED by Owner. All agent work stopped.');
    save();
    if(S.running) setTimeout(tick,600);
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/runtime/task'){
    const t=S.tasks.find(x=>x.id===b.id); if(!t) return send(res,404,{error:'NO SUCH TASK'});
    if(b.every!=null) t.every=Math.max(30,+b.every||60);
    if(b.enabled!=null){ t.enabled=!!b.enabled;
      log('WARN','RUNTIME',`Standing order ${t.cap} ${t.enabled?'ENABLED':'DISABLED'}.`); }
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/runtime/runnow'){
    const t=S.tasks.find(x=>x.id===b.id); if(!t) return send(res,404,{error:'NO SUCH TASK'});
    const cap=CAPS[t.cap]; if(!cap) return send(res,400,{error:'UNKNOWN CAPABILITY'});
    const t0=Date.now();
    try{
      const r=await cap.run();
      t.lastAt=nowIso(); t.lastOk=true; t.lastMsg=r.msg; t.runs++;
      S.runs.unshift({t:t.lastAt,cap:t.cap,owner:t.owner,ok:true,msg:r.msg,
        detail:r.detail||'',ms:Date.now()-t0,n:r.n||0,manual:true});
      S.runs=S.runs.slice(0,300); save();
      return send(res,200,{ok:1,msg:r.msg,detail:r.detail||'',state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/runtime/reset'){
    S.tasks=[]; seedTasks(); save(); return send(res,200,{ok:1,state:pub()});
  }

  if(p==='/api/logs/purge'){
    S.logs=[]; log('CRIT','AUDIT','Ledger purged by Owner.'); save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/wipe'){
    if(!verify(b.pw)) return send(res,401,{error:'PASSWORD WRONG'});
    S=structuredClone(BLANK); SESS.clear();
    await STORE.remove(DB).catch(()=>{});
    await STORE.remove(SESSDB).catch(()=>{});
    await STORE.remove(CREDS).catch(()=>{});
    return send(res,200,{ok:1,wiped:1});
  }

  return send(res,404,{error:'NO SUCH ENDPOINT'});
}

/* ---------- static ---------- */
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
function serve(res,name){
  const d = __ASSETS[name] || __ASSETS['index.html'];
  res.writeHead(200,{'Content-Type':MIME[path.extname(name)]||'text/html; charset=utf-8',
    'Cache-Control':'no-store','X-Frame-Options':'ALLOWALL',
    'Content-Security-Policy':"frame-ancestors *"});
  res.end(d);
}

/* ---------- server ---------- */
const server = http.createServer(async (req,res)=>{
  const t0=Date.now(); T.req++;
  /* inspect the RAW request line before any parser normalizes it away */
  let rawLine = req.url || '';
  try { rawLine = decodeURIComponent(rawLine); } catch(e) {}
  if(rawLine.includes('..') || rawLine.includes('\0')){
    T.err++;
    log('CRIT','SECURITY',`Path traversal attempt blocked: ${(req.url||'').slice(0,80)} from ${(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0]}`);
    res.writeHead(403,{'Content-Type':'text/plain','Cache-Control':'no-store'});
    return res.end('403 FORBIDDEN');
  }
  const url=new URL(req.url,'http://x');
  T.byPath[url.pathname]=(T.byPath[url.pathname]||0)+1;
  res.on('finish',()=>{ T.lat.push(Date.now()-t0); if(T.lat.length>500) T.lat.shift(); });
  try{
    if(url.pathname.startsWith('/api/')) return await api(req,res,url);

    let raw = url.pathname;
    try { raw = decodeURIComponent(raw); } catch(e) {}
    /* reject any traversal attempt outright instead of silently serving the SPA */
    if(raw.includes('..') || raw.includes('\0')){
      T.err++; log('CRIT','SECURITY',`Path traversal attempt blocked: ${raw.slice(0,80)} from ${(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0]}`);
      res.writeHead(403,{'Content-Type':'text/plain'}); return res.end('403 FORBIDDEN');
    }
    const f = raw==='/' ? 'index.html' : raw.replace(/^\/+/,'');
    serve(res, __ASSETS[f] ? f : 'index.html');
  }catch(e){ T.err++; console.error('ERR',e.message); send(res,500,{error:'INTERNAL'}); }
});

/* ---------- async init: hydrate state from whichever store is configured ---------- */
(async function init(){
  const line='════════════════════════════════════════════════════════';
  try{
    if(STORE.verify){
      const v=await STORE.verify();
      console.log('[store] github repo '+v.full_name+(v.private?' (private ✓)':' (PUBLIC ✗ — make it private!)'));
    }
    const raw=await STORE.read(DB);
    if(raw){ S=Object.assign(structuredClone(BLANK), JSON.parse(raw)); DBBYTES=Buffer.byteLength(raw); }
    const sraw=await STORE.read(SESSDB);
    if(sraw){ const now=Date.now();
      for(const[k,v] of Object.entries(JSON.parse(sraw))) if(now-v.t<TTL) SESS.set(k,v); }
  }catch(e){
    console.error(line);
    console.error(' STORE INIT FAILED: '+e.message);
    console.error(' Refusing to start with a blank identity — that would silently');
    console.error(' orphan your existing owner account. Fix the store and retry.');
    console.error(line);
    process.exit(1);
  }

  const boot = await bootstrap();
  /* self-heal: an owner exists but the roster is empty (wiped or corrupted) */
  if(S.owner && !S.agents.length){ seed(); save(); }
  /* AUTO-START: the Chairman runs himself. The Owner should never have to
     press "start" — that is his job, not yours. */
  if(S.owner){
    if(!S.tasks || !S.tasks.length) seedTasks(true, false);
    if(S.running !== false) S.running = true;   /* only a deliberate halt keeps it off */
    save();
    setTimeout(tick, 2000);
  }

  server.listen(PORT,'0.0.0.0',()=>{
    const lan = lanIP();
    console.log('');
    console.log(line);
    console.log('   CHAIRMAN AGENT OS  ·  RUNNING');
    console.log(line);
    console.log('');
    console.log('   OPEN THIS IN YOUR BROWSER:');
    console.log('');
    console.log('        http://localhost:' + PORT);
    console.log('');
    if(lan){
      console.log('   From your PHONE on the same Wi-Fi:');
      console.log('');
      console.log('        http://' + lan + ':' + PORT);
      console.log('');
    }
    console.log(line);
    if(boot){
      console.log('');
      console.log('   YOUR LOGIN  (copy these now)');
      console.log('');
      console.log('        OWNER ID : ' + boot.id);
      console.log('        PASSWORD : ' + boot.pw);
      console.log('');
      console.log('   Also saved to OWNER_CREDENTIALS.txt in this folder.');
      console.log('   Rotate it after first login and that file self-deletes.');
      console.log('');
      console.log(line);
    } else {
      console.log('');
      console.log('   Owner already set up. Use your existing ID and password.');
      console.log('   Forgot it? Delete data.json and restart for a fresh identity.');
      console.log('');
      console.log(line);
    }
    console.log('');
    console.log('   ' + STORE.describe() + '  ·  0 dependencies  ·  $0.00');
    console.log('   Keep this window open. Press Ctrl+C to stop the server.');
    console.log('');
    if(process.env.NO_OPEN !== '1') openBrowser('http://localhost:' + PORT);
  });
})();

/* ---------- convenience: LAN address + auto-open browser ---------- */
function lanIP(){
  try{
    for(const list of Object.values(os.networkInterfaces()))
      for(const i of list)
        if(i.family==='IPv4' && !i.internal && !/^169\.254\./.test(i.address)) return i.address;
  }catch(e){}
  return null;
}
function openBrowser(url){
  const { spawn } = require('child_process');
  const cmd = process.platform==='darwin' ? ['open',[url]]
            : process.platform==='win32'  ? ['cmd',['/c','start','',url]]
            : ['xdg-open',[url]];
  try{
    const p = spawn(cmd[0], cmd[1], { stdio:'ignore', detached:true });
    p.on('error',()=>{});
    p.unref();
  }catch(e){}
}

process.on('SIGTERM',()=>{ console.log('[shutdown] flushing state…');
  try{ STORE.write(DB, JSON.stringify(S,null,1)); }catch(e){}
  setTimeout(()=>process.exit(0),1500); });
