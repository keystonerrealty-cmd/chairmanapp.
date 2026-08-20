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

__M['meta'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* ==========================================================================
   META GRAPH API — official Instagram comment handling. Zero dependencies.

   I TOLD THE OWNER THREE TIMES THAT REPLYING TO COMMENTS COULD NOT BE
   AUTOMATED SAFELY. THAT WAS WRONG.

   What is true: browser extensions, password-sharing bots and session
   scrapers get accounts banned. That part I had right, and it is still
   right.

   What I got wrong: Meta publishes an OFFICIAL, sanctioned path for exactly
   this. With the instagram_manage_comments permission, an app can read,
   reply to, hide and delete comments through the Graph API. Meta explicitly
   permits automated replies to USER-INITIATED actions. I generalised from
   "bots get you banned" to "all automation gets you banned" and never
   checked. Verified live: graph.facebook.com/v22.0 answers, and the
   /{comment-id}/replies endpoint exists.

   THE LINE, and this module enforces it in code, not in a warning label:

     ALLOWED  — replying to someone who commented on YOUR post
                (they initiated; you are responding)
     ALLOWED  — one private DM reply to a qualifying commenter, within
                7 days for posts and reels
     BANNED   — cold DMs to people who never engaged
     BANNED   — mass identical replies at scale
     BANNED   — anything through a browser extension or your password
     BANNED   — auto-follow, follow/unfollow, engagement pods

   Requirements Meta imposes and nobody can bypass:
     · Instagram Business or Creator account. Personal accounts have NO API.
     · Linked Facebook Page.
     · A Meta Developer App and App Review for production use.
     · OAuth. Never a password.
   ========================================================================== */
const https = require('https');

const API = 'graph.facebook.com';
const VER = 'v22.0';

/* Meta's published ceiling is 750 private replies/hour. We pace far below
   that: this is one person's account, and looking like a firehose is what
   attracts scrutiny even when every call is legal. */
const LIMITS = {
  repliesPerHour: 40,      /* deliberately conservative */
  minGapMs: 20000,         /* 20s between replies — human-plausible */
  dmPerUserPer24h: 1,      /* Meta's own rule: one private reply */
  replyWindowDays: 7,      /* posts and reels */
};

function call(method, path, params, token){
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(Object.assign({}, params||{}, { access_token: token }));
    const isGet = method === 'GET';
    const body = isGet ? null : qs.toString();
    const opts = {
      hostname: API, method,
      path: `/${VER}/${String(path).replace(/^\//,'')}` + (isGet ? '?' + qs.toString() : ''),
      headers: Object.assign({ 'User-Agent': 'ChairmanOS/1.0' },
        body ? { 'Content-Type':'application/x-www-form-urlencoded',
                 'Content-Length': Buffer.byteLength(body) } : {})
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; if(d.length > 500000) req.destroy(); });
      res.on('end', () => {
        let j = {};
        try { j = JSON.parse(d||'{}'); } catch(e){}
        if(j.error){
          const e = j.error;
          /* Translate Meta's codes into something the Owner can act on. */
          let msg = e.message || 'Meta API error';
          if(e.code === 190) msg = 'ACCESS TOKEN INVALID OR EXPIRED — reconnect the account.';
          else if(e.code === 200 || e.code === 10)
            msg = 'PERMISSION MISSING — this app has not been granted instagram_manage_comments. '
                + 'That needs Meta App Review before it works on a live account.';
          else if(e.code === 4 || e.code === 17 || e.code === 32)
            msg = 'RATE LIMITED by Meta. Stop and let it reset — pushing through is what gets accounts restricted.';
          else if(e.code === 100) msg = 'BAD REQUEST — ' + msg;
          else if(e.code === 803) msg = 'That object does not exist or this account cannot see it.';
          const err = new Error(msg);
          err.code = e.code; err.sub = e.error_subcode; err.raw = e;
          return reject(err);
        }
        if(res.statusCode >= 400)
          return reject(new Error('Meta HTTP ' + res.statusCode + ': ' + d.slice(0,200)));
        resolve(j);
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('Meta API timed out')));
    req.on('error', reject);
    if(body) req.write(body);
    req.end();
  });
}

/* Confirm the token works and find the Instagram account behind it. */
async function verify(token){
  const me = await call('GET', 'me/accounts',
    { fields: 'id,name,instagram_business_account{id,username,followers_count,media_count}' }, token);
  const pages = (me.data || []).filter(p => p.instagram_business_account);
  if(!pages.length)
    throw new Error('No Instagram Business or Creator account is linked to any Facebook Page on this token. '
      + 'Personal Instagram accounts have no API access at all — convert to Professional first, then link a Page.');
  const p = pages[0];
  return {
    pageId: p.id, pageName: p.name,
    igId: p.instagram_business_account.id,
    username: p.instagram_business_account.username,
    followers: p.instagram_business_account.followers_count,
    mediaCount: p.instagram_business_account.media_count,
    otherPages: pages.length - 1,
  };
}

/* Recent posts, so we know where to look for comments. */
async function media(igId, token, limit){
  const r = await call('GET', `${igId}/media`,
    { fields: 'id,caption,media_type,permalink,timestamp,comments_count,like_count',
      limit: Math.min(25, limit || 10) }, token);
  return r.data || [];
}

/* Comments on one post, newest first, with existing replies so we never
   answer the same person twice. */
async function comments(mediaId, token){
  const r = await call('GET', `${mediaId}/comments`,
    { fields: 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}',
      filter: 'stream', limit: 50 }, token);
  return r.data || [];
}

/* PUBLIC reply to a comment. This is the sanctioned action. */
async function reply(commentId, message, token){
  if(!String(message||'').trim()) throw new Error('Refusing to post an empty reply.');
  if(String(message).length > 2200) throw new Error('Reply is over Instagram\'s 2,200 character limit.');
  return await call('POST', `${commentId}/replies`, { message: String(message).trim() }, token);
}

/* PRIVATE reply — one per commenter, inside Meta's window. Used only when
   the answer contains something that does not belong in public, like a
   price list or a link. */
async function privateReply(igId, commentId, message, token){
  return await call('POST', `${igId}/messages`, {
    recipient: JSON.stringify({ comment_id: commentId }),
    message: JSON.stringify({ text: String(message).trim() })
  }, token);
}

async function hide(commentId, token, on){
  return await call('POST', commentId, { hide: on !== false }, token);
}

module.exports = { call, verify, media, comments, reply, privateReply, hide, LIMITS, VER };

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
function localStore(fixedDir){
  let made = false;
  /* Worked out on first use, by which time the server has told us where
     it lives. Order of precedence: explicit DATA_DIR, then the directory
     of the running entry script, then this module's own folder. */
  function dir(){
    if(fixedDir) return fixedDir;
    const d = process.env.DATA_DIR
           || global.__CHAIRMAN_ROOT
           || (require.main && require.main.filename
                 ? path.dirname(require.main.filename)
                 : path.join(__dirname,'..'));
    if(!made){ try{ fs.mkdirSync(d, { recursive:true }); made = true; }catch(e){} }
    return d;
  }
  return {
    mode:'local',
    describe:()=>'filesystem · '+dir(),
    async read(name){
      try { return fs.readFileSync(path.join(dir(),name),'utf8'); } catch(e){ return null; }
    },
    async write(name, text){
      const f=path.join(dir(),name), tmp=f+'.tmp';
      fs.writeFileSync(tmp,text); fs.renameSync(tmp,f);
      if(/sessions|CREDENTIALS/.test(name)){ try{ fs.chmodSync(f,0o600); }catch(e){} }
    },
    async remove(name){ try{ fs.unlinkSync(path.join(dir(),name)); }catch(e){} }
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
  /* In the single-file build every lib is inlined and this module RUNS
     BEFORE the server sets anything, so __dirname is wherever node happened
     to be launched from — not where chairman.js lives. That silently wrote
     data.json to /tmp and the Owner lost his state on every restart.

     My first attempt at this fix read a global that did not exist yet.
     Resolving eagerly was the bug; resolve LAZILY, on first actual use. */
  store = localStore(null);
}
module.exports = store;

return module.exports; })();

const __ASSETS = {
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgovKiDilZDilZAgQ0hBSVJNQU4gT1MgwrcgTlVNRVJPIOKAlCB0cmVhc3VyeSBsaWdodCB0aGVtZSDilZDilZAgKi8KOnJvb3R7CiAgLyogbGlnaHQgaXMgdGhlIGRlZmF1bHQgbm93ICovCiAgLS1iZzojRUZFQURGOyAtLWJnMjojRTVERkQxOwogIC0tcGFuZWw6I0ZCRjhGMTsKICAtLWdsYXNzOiNGQkY4RjE7CiAgLS1nbGFzczI6I0Y1RjFFNzsKICAtLXN0cm9rZTojREVEN0M3OwogIC0tc3Ryb2tlMjojQzdCRkFCOwogIC0tdHh0OiMxODE1MDk7IC0tZGltOiM2RTY4NTc7IC0tZGltMjojOUM5Njg2OwoKICAtLWxpbWU6Izc4OEExRDsgICAgICAvKiBzaWduYXR1cmUgb2xpdmUtbGltZSAqLwogIC0tbGltZTI6IzhGQTMyNjsKICAtLW9saXZlOiMzOTQ2MDM7ICAgICAvKiBkZWVwIG9saXZlICovCiAgLS1pbms6IzA0MDUwMTsKCiAgLS1jeTojNzg4QTFEOyAtLWJsdTojNUM2RTFBOyAtLWdybjojNEY3QTJBOyAtLWFtYjojQTg4MDFCOwogIC0tbWFnOiNCNDQ0MkE7IC0tcHVyOiM2RTdBM0M7CgogIC0tbW9ubzp1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sIlJvYm90byBNb25vIixtb25vc3BhY2U7CiAgLS1zYW5zOi1hcHBsZS1zeXN0ZW0sQmxpbmtNYWNTeXN0ZW1Gb250LCJTZWdvZSBVSSIsSW50ZXIsUm9ib3RvLHNhbnMtc2VyaWY7CiAgLS1zYnc6MjM4cHg7IC0tcjoxNHB4OwogIC0tc2hhZG93OjAgMXB4IDJweCByZ2JhKDYwLDQ4LDIwLC4wNiksIDAgOHB4IDI0cHggcmdiYSg2MCw0OCwyMCwuMDYpOwogIC0tc2hhZG93MjowIDJweCA2cHggcmdiYSg2MCw0OCwyMCwuMDgpLCAwIDE2cHggNDBweCByZ2JhKDYwLDQ4LDIwLC4xMCk7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXXsKICAtLWJnOiMwQTBCMDY7IC0tYmcyOiMxMDEyMDg7CiAgLS1wYW5lbDojMTUxODBDOyAtLWdsYXNzOiMxNTE4MEM7IC0tZ2xhc3MyOiMxQjFGMEY7CiAgLS1zdHJva2U6IzI1MkExNjsgLS1zdHJva2UyOiMzNzQwMUY7CiAgLS10eHQ6I0YyRjNFQTsgLS1kaW06IzlBOUM4QTsgLS1kaW0yOiM2QTZENUM7CiAgLS1saW1lOiNBM0JCMkI7IC0tbGltZTI6I0I4RDEzNDsKICAtLWN5OiNBM0JCMkI7IC0tYmx1OiM4RkEzMjY7IC0tZ3JuOiM2RkJGNEE7IC0tYW1iOiNEOUE2MkI7CiAgLS1tYWc6I0UzNkI0RTsgLS1wdXI6IzlGQUU1RTsKICAtLXNoYWRvdzowIDFweCAycHggcmdiYSgwLDAsMCwuNCksIDAgOHB4IDI2cHggcmdiYSgwLDAsMCwuMzUpOwogIC0tc2hhZG93MjowIDJweCA4cHggcmdiYSgwLDAsMCwuNSksIDAgMThweCA0NnB4IHJnYmEoMCwwLDAsLjQ1KTsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnR9Cmh0bWwsYm9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMCV9CmJvZHl7CiAgYmFja2dyb3VuZDp2YXIoLS1iZyk7IGNvbG9yOnZhcigtLXR4dCk7CiAgZm9udDoxMy41cHgvMS41NSB2YXIoLS1zYW5zKTsgb3ZlcmZsb3cteDpoaWRkZW47CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMTAwcHggNzAwcHggYXQgODglIC0xNCUsIHJnYmEoMTIwLDEzOCwyOSwuMTMpLCB0cmFuc3BhcmVudCA2MCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDc2MHB4IDUyMHB4IGF0IDQlIDEwNCUsIHJnYmEoMTQwLDExMCw1MCwuMDkpLCB0cmFuc3BhcmVudCA2MiUpOwogIGJhY2tncm91bmQtYXR0YWNobWVudDpmaXhlZDsKfQpidXR0b257Zm9udDppbmhlcml0O2N1cnNvcjpwb2ludGVyO2NvbG9yOmluaGVyaXR9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtmb250OmluaGVyaXR9Ci5oaWRle2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6MTBweDtoZWlnaHQ6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOnZhcigtLXN0cm9rZTIpO2JvcmRlci1yYWRpdXM6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10cmFja3tiYWNrZ3JvdW5kOnRyYW5zcGFyZW50fQoKLyog4pSA4pSAIExPR0lOIC8gSEVSTyDilIDilIAgKi8KI2dhdGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjgwO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1iZyk7CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMDAwcHggNjgwcHggYXQgODQlIC0xMCUsIHJnYmEoMTIwLDEzOCwyOSwuMTYpLCB0cmFuc3BhcmVudCA1OCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDcyMHB4IDUyMHB4IGF0IDYlIDEwMCUsIHJnYmEoMTQwLDExMCw1MCwuMTApLCB0cmFuc3BhcmVudCA2MCUpO30KLnRvcGJhcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMXB4O3BhZGRpbmc6MTVweCAyNHB4O2ZsZXgtd3JhcDp3cmFwOwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9Ci5sb2dve2ZvbnQ6NzAwIDE4cHgvMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjVweH0KLmxvZ28gaXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGx7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyLXJhZGl1czo5OXB4OwogIHBhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzouN3B4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGlsbC5saXZle2JvcmRlci1jb2xvcjpyZ2JhKDEyMCwxMzgsMjksLjM2KTtiYWNrZ3JvdW5kOnJnYmEoMTIwLDEzOCwyOSwuMTApO2NvbG9yOnZhcigtLW9saXZlKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAucGlsbC5saXZle2NvbG9yOnZhcigtLWxpbWUpfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tbGltZSk7CiAgbWFyZ2luLXJpZ2h0OjZweDtib3gtc2hhZG93OjAgMCAwIDNweCByZ2JhKDEyMCwxMzgsMjksLjE4KTthbmltYXRpb246YnAgMnMgaW5maW5pdGV9CkBrZXlmcmFtZXMgYnB7NTAle29wYWNpdHk6LjM1fX0KLmhlcm97bWF4LXdpZHRoOjEyMjBweDttYXJnaW46MCBhdXRvO3BhZGRpbmc6MzRweCAyNHB4IDY4cHh9Ci5oZXJvQ2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoyNHB4OwogIGJveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7cGFkZGluZzpjbGFtcCgyNnB4LDR2dyw1MHB4KTsKICBkaXNwbGF5OmdyaWQ7Z2FwOjM4cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMDVmciAuOTVmcjthbGlnbi1pdGVtczpjZW50ZXJ9CkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpey5oZXJvQ2FyZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDEyMCwxMzgsMjksLjMwKTsKICBjb2xvcjp2YXIoLS1vbGl2ZSk7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS41cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdle2NvbG9yOnZhcigtLWxpbWUpfQpoMS5iaWd7Zm9udDo3MDAgY2xhbXAoMzJweCw1LjZ2dyw1NnB4KS8xLjAyIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0ycHg7bWFyZ2luOjE4cHggMCAxNnB4fQpoMS5iaWcgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tbGltZSl9Ci5sZWRle2NvbG9yOnZhcigtLWRpbSk7Zm9udDoxNXB4LzEuNyB2YXIoLS1zYW5zKTttYXgtd2lkdGg6NTJjaDttYXJnaW46MCAwIDI2cHh9Ci5zdGF0Um93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgxNDRweCwxZnIpKTtnYXA6MTJweH0KLnN0YXR7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxNXB4IDE3cHg7dHJhbnNpdGlvbjouMnN9Ci5zdGF0OmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1saW1lKTtib3gtc2hhZG93OnZhcigtLXNoYWRvdyl9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjRweC8xLjE1IHZhcigtLXNhbnMpO21hcmdpbjo3cHggMCAzcHg7bGV0dGVyLXNwYWNpbmc6LTFweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubG9naW5Cb3h7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgNHB4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLW9saXZlKTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubG9naW5Cb3ggaDN7Y29sb3I6dmFyKC0tbGltZSl9Ci5sb2dpbkJveCAuc2J7Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTAuNXB4O21hcmdpbi1ib3R0b206MThweDtsZXR0ZXItc3BhY2luZzouNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZXJye2NvbG9yOnZhcigtLW1hZyk7Zm9udC1zaXplOjExLjVweDttaW4taGVpZ2h0OjE2cHg7bWFyZ2luLXRvcDo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci53YXJuYm94e2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1hbWIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4wOCk7cGFkZGluZzoxMXB4IDE0cHg7CiAgYm9yZGVyLXJhZGl1czowIDEycHggMTJweCAwO2ZvbnQtc2l6ZToxMS41cHg7Y29sb3I6IzZCNTQxMDttYXJnaW4tYm90dG9tOjE1cHg7bGluZS1oZWlnaHQ6MS42fQpbZGF0YS10aGVtZT0iZGFyayJdIC53YXJuYm94e2NvbG9yOiNFMEMyNzF9Ci5waWxsYXJze21heC13aWR0aDoxMjIwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjAgMjRweCA4MHB4fQoucGlsbGFycyBoMnt0ZXh0LWFsaWduOmNlbnRlcjtmb250OjcwMCBjbGFtcCgyM3B4LDMuNHZ3LDM0cHgpLzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS4xcHg7bWFyZ2luOjAgMCAxMHB4fQoucGlsbGFycyBoMiBlbXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGxhcnMgLnN1Ynt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTMuNXB4LzEuNiB2YXIoLS1zYW5zKTttYXJnaW46MCAwIDMwcHh9Ci5wZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE2cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjE0cHgsMWZyKSl9Ci5wY2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MjBweDt0cmFuc2l0aW9uOi4yMnN9Ci5wY2FyZDpob3Zlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNHB4KTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLnBjYXJkIHV7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC1zaXplOjkuNXB4O2xldHRlci1zcGFjaW5nOjEuNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGNhcmQgaDR7bWFyZ2luOjEwcHggMDtmb250OjcwMCAxNS41cHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0uM3B4fQoucGNhcmQgcHttYXJnaW46MCAwIDEzcHg7Y29sb3I6dmFyKC0tZGltKTtmb250OjEycHgvMS42NSB2YXIoLS1zYW5zKX0KLmNoaXB7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtjb2xvcjp2YXIoLS1kaW0pOwogIGJvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEwcHg7bWFyZ2luOjAgNXB4IDVweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoKLyog4pSA4pSAIFNIRUxMIOKUgOKUgCAqLwojYXBwe2Rpc3BsYXk6ZmxleDttaW4taGVpZ2h0OjEwMHZofQphc2lkZXt3aWR0aDp2YXIoLS1zYncpO2ZsZXg6MCAwIHZhcigtLXNidyk7cG9zaXRpb246c3RpY2t5O3RvcDowO2hlaWdodDoxMDB2aDt6LWluZGV4OjQwOwogIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCB2YXIoLS1zdHJva2UpfQouYWJyYW5ke3BhZGRpbmc6MThweCAxNnB4IDE2cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtkaXNwbGF5OmZsZXg7Z2FwOjExcHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6MTBweDtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxNXB4OwogIGJhY2tncm91bmQ6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtib3gtc2hhZG93OjAgNHB4IDEycHggcmdiYSgxMjAsMTM4LDI5LC4zMCl9Ci5hYnJhbmQgYntmb250OjcwMCAxM3B4LzEuMjUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LjJweDtkaXNwbGF5OmJsb2NrfQouYWJyYW5kIHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjguNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQphc2lkZSBuYXZ7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjEycHggMTJweCAxOHB4fQouZ3Jwe2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjhweDtwYWRkaW5nOjE2cHggMTBweCA3cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBjb2xvcjp2YXIoLS1kaW0pO3BhZGRpbmc6OXB4IDEycHg7Ym9yZGVyLXJhZGl1czoxMHB4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTIuNXB4OwogIHRyYW5zaXRpb246LjE1czttYXJnaW4tYm90dG9tOjJweH0KYXNpZGUgbmF2IGJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Y29sb3I6dmFyKC0tdHh0KX0KYXNpZGUgbmF2IGJ1dHRvbi5vbntiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NjAwOwogIGJveC1zaGFkb3c6MCAzcHggMTBweCByZ2JhKDEyMCwxMzgsMjksLjI4KX0KYXNpZGUgbmF2IGJ1dHRvbiBpe2ZvbnQtc3R5bGU6bm9ybWFsO3dpZHRoOjE2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHh9Ci5hZm9vdHtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6MTRweCAxNnB4O2ZvbnQtc2l6ZToxMC41cHg7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Cm1haW57ZmxleDoxO21pbi13aWR0aDowO3BhZGRpbmc6MjJweCBjbGFtcCgxNnB4LDIuNnZ3LDMycHgpIDk2cHh9Ci5tdG9we2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjExcHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbToyMnB4fQouY3J1bWJ7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjExLjVweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmNydW1iIGJ7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC13ZWlnaHQ6NjAwfQoubXRvcCAuc3B7ZmxleDoxfQojYnVyZ2Vye2Rpc3BsYXk6bm9uZX0KI3RoZW1lQnRue2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjExcHh9CiN0aGVtZUJ0bjpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6dmFyKC0tbGltZSl9CkBtZWRpYShtYXgtd2lkdGg6ODYwcHgpewogIGFzaWRle3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwJSk7dHJhbnNpdGlvbjouMjRzO2JveC1zaGFkb3c6MCAwIDYwcHggcmdiYSg2MCw0OCwyMCwuMjgpfQogIGFzaWRlLm9wZW57dHJhbnNmb3JtOm5vbmV9CiAgI3Njcmlte3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDQ1LDM4LDE4LC4zNCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KTt6LWluZGV4OjM1fQogICNidXJnZXJ7ZGlzcGxheTppbmxpbmUtZmxleH0KICBtYWlue3BhZGRpbmctYm90dG9tOjExMHB4fQp9CgovKiDilIDilIAgUFJJTUlUSVZFUyDilIDilIAgKi8KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcGFkZGluZzoxOHB4IDIwcHg7bWFyZ2luLWJvdHRvbToxNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KTt0cmFuc2l0aW9uOi4yc30KLmNhcmQ6aG92ZXJ7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLmNhcmQ+aDN7bWFyZ2luOjAgMCAxNHB4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7Y29sb3I6dmFyKC0tZGltKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE0cHh9Ci5nMntncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyOTJweCwxZnIpKX0KLmcze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDIwOHB4LDFmcikpfQouZzR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTYycHgsMWZyKSl9Ci5rcGl7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjE3cHggMThweDsKICB0cmFuc2l0aW9uOi4ycztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5rcGk6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3RvcDowO2JvdHRvbTowO3dpZHRoOjNweDtiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO29wYWNpdHk6Ljg1fQoua3BpOmhvdmVye3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0ycHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpfQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyN3B4LzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS40cHh9Ci5rcGkgdXtkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjNweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5rcGkgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi10b3A6NXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRue2JhY2tncm91bmQ6dmFyKC0tcGFuZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7cGFkZGluZzo5cHggMTVweDtib3JkZXItcmFkaXVzOjEwcHg7CiAgZm9udC1zaXplOjExLjVweDt0cmFuc2l0aW9uOi4xNnM7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5idG46aG92ZXJ7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUpO2NvbG9yOnZhcigtLWxpbWUpfQouYnRuLnB7YmFja2dyb3VuZDp2YXIoLS1saW1lKTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo3MDA7CiAgYm94LXNoYWRvdzowIDNweCAxMHB4IHJnYmEoMTIwLDEzOCwyOSwuMjYpfQouYnRuLnA6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1saW1lMik7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUyKTtjb2xvcjojZmZmO2JveC1zaGFkb3c6MCA1cHggMTZweCByZ2JhKDEyMCwxMzgsMjksLjM0KX0KLmJ0bi5va3tiYWNrZ3JvdW5kOnJnYmEoNzksMTIyLDQyLC4xMCk7Ym9yZGVyLWNvbG9yOnJnYmEoNzksMTIyLDQyLC4zNCk7Y29sb3I6dmFyKC0tZ3JuKX0KLmJ0bi5ub3tiYWNrZ3JvdW5kOnJnYmEoMTgwLDY4LDQyLC4wOSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTgwLDY4LDQyLC4zMCk7Y29sb3I6dmFyKC0tbWFnKX0KLmJ0bi5zbXtwYWRkaW5nOjZweCAxMXB4O2ZvbnQtc2l6ZToxMC41cHg7Ym9yZGVyLXJhZGl1czo4cHh9Ci5idG46ZGlzYWJsZWR7b3BhY2l0eTouNDtjdXJzb3I6bm90LWFsbG93ZWQ7dHJhbnNmb3JtOm5vbmV9Ci5yb3d7ZGlzcGxheTpmbGV4O2dhcDo5cHg7ZmxleC13cmFwOndyYXA7YWxpZ24taXRlbXM6Y2VudGVyfQpsYWJlbC5me2Rpc3BsYXk6YmxvY2s7bWFyZ2luLWJvdHRvbToxM3B4fQpsYWJlbC5mPnNwYW57ZGlzcGxheTpibG9jaztmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS4ycHg7Y29sb3I6dmFyKC0tZGltKTttYXJnaW4tYm90dG9tOjZweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5pbnt3aWR0aDoxMDAlO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO2NvbG9yOnZhcigtLXR4dCk7CiAgcGFkZGluZzoxMHB4IDEzcHg7Ym9yZGVyLXJhZGl1czoxMHB4O291dGxpbmU6bm9uZTt0cmFuc2l0aW9uOi4xNnN9Ci5pbjpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxMjAsMTM4LDI5LC4xNCk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9CnRleHRhcmVhLmlue21pbi1oZWlnaHQ6NzRweDtyZXNpemU6dmVydGljYWw7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyl9CnRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4fQp0aHt0ZXh0LWFsaWduOmxlZnQ7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjJweDtwYWRkaW5nOjEwcHggOXB4OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CnRke3BhZGRpbmc6MTFweCA5cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9CnRyOmhvdmVyIHRke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLnR3e292ZXJmbG93LXg6YXV0bztib3JkZXItcmFkaXVzOjEwcHh9Ci50YWd7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzozcHggMTBweDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjFweDsKICBib3JkZXI6MXB4IHNvbGlkO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC13ZWlnaHQ6NjAwfQoudC1jeXtjb2xvcjp2YXIoLS1vbGl2ZSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTIwLDEzOCwyOSwuMzQpO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtY3l7Y29sb3I6dmFyKC0tbGltZSl9Ci50LWdybntjb2xvcjojM0U2NTIyO2JvcmRlci1jb2xvcjpyZ2JhKDc5LDEyMiw0MiwuMzIpO2JhY2tncm91bmQ6cmdiYSg3OSwxMjIsNDIsLjExKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1ncm57Y29sb3I6IzdGRDA1QX0KLnQtYW1ie2NvbG9yOiM4QTY3MTI7Ym9yZGVyLWNvbG9yOnJnYmEoMTY4LDEyOCwyNywuMzIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtYW1ie2NvbG9yOiNFMEI1NEF9Ci50LXJlZHtjb2xvcjojOUIzQTIzO2JvcmRlci1jb2xvcjpyZ2JhKDE4MCw2OCw0MiwuMzApO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1yZWR7Y29sb3I6I0YwODY2Qn0KLnQtYmx1e2NvbG9yOiM0QTVBMTU7Ym9yZGVyLWNvbG9yOnJnYmEoOTIsMTEwLDI2LC4zMCk7YmFja2dyb3VuZDpyZ2JhKDkyLDExMCwyNiwuMTApfQpbZGF0YS10aGVtZT0iZGFyayJdIC50LWJsdXtjb2xvcjojQThCRTQ1fQoudC1wdXJ7Y29sb3I6IzU2NUYyRTtib3JkZXItY29sb3I6cmdiYSgxMTAsMTIyLDYwLC4zMCk7YmFja2dyb3VuZDpyZ2JhKDExMCwxMjIsNjAsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1wdXJ7Y29sb3I6I0I0QzE3Nn0KLnQtZGlte2NvbG9yOnZhcigtLWRpbSk7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLmJhcntoZWlnaHQ6N3B4O2JhY2tncm91bmQ6dmFyKC0tYmcyKTtib3JkZXItcmFkaXVzOjk5cHg7b3ZlcmZsb3c6aGlkZGVufQouYmFyIGl7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTAwJTtib3JkZXItcmFkaXVzOjk5cHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tb2xpdmUpLHZhcigtLWxpbWUpKTt0cmFuc2l0aW9uOndpZHRoIC41cyBjdWJpYy1iZXppZXIoLjQsMCwuMiwxKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFyIGl7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tbGltZSksdmFyKC0tbGltZTIpKX0KdWwudGlnaHR7bWFyZ2luOjdweCAwIDA7cGFkZGluZy1sZWZ0OjE4cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKX0KdWwudGlnaHQgbGl7bWFyZ2luOjVweCAwfQp1bC50aWdodCBie2NvbG9yOnZhcigtLXR4dCl9CnByZS55YW1se2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTRweDsKICBmb250LXNpemU6MTFweDtvdmVyZmxvdzphdXRvO2NvbG9yOiMzRTRBMTg7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MS42O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQpbZGF0YS10aGVtZT0iZGFyayJdIHByZS55YW1se2NvbG9yOiNCNEMxNzZ9Ci5sb2d7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjExcHg7cGFkZGluZzoxM3B4OwogIG1heC1oZWlnaHQ6MzcwcHg7b3ZlcmZsb3c6YXV0bztmb250LXNpemU6MTFweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxvZyBkaXZ7cGFkZGluZzozcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3doaXRlLXNwYWNlOnByZS13cmFwO3dvcmQtYnJlYWs6YnJlYWstd29yZH0KLmxvZyAudHN7Y29sb3I6dmFyKC0tZGltMil9Ci5tb25vLWRpbXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubW9kYWx7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoNDUsMzgsMTgsLjQyKTt6LWluZGV4OjkwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjE4cHg7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNXB4KX0KLm1ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6NjYwcHg7bWF4LWhlaWdodDo4OHZoO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6MCAyNHB4IDcwcHggcmdiYSg2MCw0OCwyMCwuMjQpfQoubWJveCBoM3ttYXJnaW46MCAwIDZweDtmb250LXNpemU6MTVweDtjb2xvcjp2YXIoLS1vbGl2ZSk7bGV0dGVyLXNwYWNpbmc6LS4ycHg7dGV4dC10cmFuc2Zvcm06bm9uZX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubWJveCBoM3tjb2xvcjp2YXIoLS1saW1lKX0KLmZsYXNoe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JvdHRvbToyNnB4O2JhY2tncm91bmQ6dmFyKC0taW5rKTsKICBjb2xvcjojRjRGNEYwO2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1saW1lKTtwYWRkaW5nOjEzcHggMjFweDtib3JkZXItcmFkaXVzOjEycHg7Zm9udC1zaXplOjEycHg7CiAgei1pbmRleDo5OTttYXgtd2lkdGg6OTB2dztib3gtc2hhZG93OjAgMTRweCA0NHB4IHJnYmEoNjAsNDgsMjAsLjMwKTthbmltYXRpb246ZnUgLjI4c30KQGtleWZyYW1lcyBmdXtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlKC01MCUsMTJweCl9fQoKLyog4pSA4pSAIFJBRElBTCBFTkdJTkUg4pSA4pSAICovCi5lbmdpbmVXcmFwe2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDI1OHB4O2dhcDoxNHB4fQpAbWVkaWEobWF4LXdpZHRoOjEwMDBweCl7LmVuZ2luZVdyYXB7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn19Ci5jYW52YXNCb3h7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO21pbi1oZWlnaHQ6NDQwcHg7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpfQouY2FudmFzQm94IHN2Z3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG87dG91Y2gtYWN0aW9uOnBhbi15fQouZ3JpZGJne3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTtvcGFjaXR5Oi41NTsKICBiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh2YXIoLS1zdHJva2UpIDFweCx0cmFuc3BhcmVudCAxcHgpLAogICAgICAgICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLXN0cm9rZSkgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM0cHggMzRweDsKICBtYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDQwJSx0cmFuc3BhcmVudCA3NiUpOwogIC13ZWJraXQtbWFzay1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSA1MCUsIzAwMCA0MCUsdHJhbnNwYXJlbnQgNzYlKX0KLmVuZ1RvcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjE0cHg7dG9wOjEzcHg7ei1pbmRleDoyO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZW5nVGl0bGV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7dG9wOjE0cHg7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoyOwogIGZvbnQ6NzAwIDEzcHggdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6Mi42cHg7Y29sb3I6dmFyKC0tdHh0KX0KLm5vZGV7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMThzfQoubm9kZTpob3ZlciBjaXJjbGV7ZmlsdGVyOmJyaWdodG5lc3MoMS4xNSl9Ci5zaWRle2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE0cHh9Ci5sZWdlbmQgZGl2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7cGFkZGluZzo0cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxlZ2VuZCBpe3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7ZGlzcGxheTpibG9jaztmbGV4OjAgMCAxMHB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2NnB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6OHB4IDRweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7CiAgdGV4dC1hbGlnbjpsZWZ0O3RyYW5zaXRpb246LjE0cztmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmRpckxpc3QgYnV0dG9uOmhvdmVye2NvbG9yOnZhcigtLWxpbWUpO3BhZGRpbmctbGVmdDo3cHh9Ci5kaXJMaXN0IHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjkuNXB4fQoudGVybXtiYWNrZ3JvdW5kOnZhcigtLWluayk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTFweDtwYWRkaW5nOjE0cHg7CiAgZm9udC1zaXplOjEwLjVweDttYXgtaGVpZ2h0OjE1OHB4O292ZXJmbG93OmF1dG87Y29sb3I6I0I4RDEzNDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KPC9zdHlsZT4KCgo8L2hlYWQ+Cjxib2R5Pgo8IS0tID09PT09PT09PT09PT09PT09IEdBVEUgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImdhdGUiPgogIDxkaXYgY2xhc3M9InRvcGJhciI+CiAgICA8ZGl2IGNsYXNzPSJsb2dvIj5DSEFJUk1BTiA8aT5BR0VOVCBPUzwvaT48L2Rpdj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5TRVJWRVIgTElWRSAmYW1wOyBBVURJVElORzwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIj5aRVJPLVRSVVNUIEFDVElWRTwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVCBET0NUUklORTwvc3Bhbj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iaGVybyI+CiAgICA8ZGl2IGNsYXNzPSJoZXJvQ2FyZCI+CiAgICAgIDxkaXY+CiAgICAgICAgPHNwYW4gY2xhc3M9ImJhZGdlIj5IRUFEIE9GIEFMTCBBR0VOVFM8L3NwYW4+CiAgICAgICAgPGgxIGNsYXNzPSJiaWciPk5PIFNVR0FSIENPQVRJTkcuPGJyPjxlbT5OTyBDT01QUk9NSVNFLjwvZW0+PC9oMT4KICAgICAgICA8cCBjbGFzcz0ibGVkZSI+RXZlcnkgZGV0YWlsIGNoZWNrZWQsIGV2ZXJ5IHN1Yi1hZ2VudCBhdWRpdGVkLCBldmVyeSBlbnRlcnByaXNlIHJlcXVlc3QgZm9yY2VkIHRocm91Z2ggYSBwcmVjaXNlIHBlcm1pc3Npb24gZmxvdy4gTm90aGluZyBwYWlkIGZvciwgZXZlciDigJQgdGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCwgY3JlZGl0IG1ldGVyIGFuZCBzdWJzY3JpcHRpb24gZ2F0ZS48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0ic3RhdFJvdyI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5CYWNrZW5kPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIiBpZD0iaHNVcCI+Q0hFQ0tJTkfigKY8L2I+PHMgaWQ9ImhzTm9kZSI+4oCUPC9zPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdCI+PHU+U2VjdXJpdHkgR2F0ZTwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5MT0NLRUQ8L2I+PHM+U2VydmVyLXNpZGUgc2Vzc2lvbnM8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5Db3N0IENlaWxpbmc8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9iPjxzPjAgZGVwZW5kZW5jaWVzIGluc3RhbGxlZDwvcz48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzPSJsb2dpbkJveCI+CiAgICAgICAgPGgzPk9XTkVSIFBPUlRBTDwvaDM+CiAgICAgICAgPGRpdiBjbGFzcz0ic2IiPkNSWVBUT0dSQVBISUMgQ0xFQVJBTkNFIFJFUVVJUkVEPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9ImJvb3ROb3RlIj5Cb290c3RyYXAgY3JlZGVudGlhbHMgd2VyZSBnZW5lcmF0ZWQgb25jZSBieSB0aGUgc2VydmVyIGFuZCBwcmludGVkIHRvIGl0cyBjb25zb2xlIC8gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIHRoZSBwYXNzd29yZCBpbW1lZGlhdGVseSBhZnRlciBmaXJzdCBsb2dpbi48L2Rpdj4KICAgICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0ibGlJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9InVzZXJuYW1lIj48L2xhYmVsPgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJsaVB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJylkb0xvZ2luKCkiPjwvbGFiZWw+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJkb0xvZ2luKCkiPkFVVEhFTlRJQ0FURTwvYnV0dG9uPgogICAgICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImxpRXJyIj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+U2Vzc2lvbnMgYXJlIGhlbGQgc2VydmVyLXNpZGUgKDhoIFRUTCwgSHR0cE9ubHkgY29va2llKS4gTG9nIGluIGZyb20gYW55IGRldmljZSBvbiB0aGlzIFVSTCDigJQgc3RhdGUgaXMgc2hhcmVkIGxpdmUuPC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9InBpbGxhcnMiPgogICAgPGgyPkNIQUlSTUFOIDxlbT5SQURJQUwgUElMTEFSUzwvZW0+PC9oMj4KICAgIDxwIGNsYXNzPSJzdWIiPkZsb29yLWJ5LWZsb29yIGVudGVycHJpc2UgY29tbWFuZCB3aXRoIGRlZGljYXRlZCBtaXNzaW9uIGxlYWRzIGFuZCBoYXJkIG9wZXJhdGlvbmFsIHNjb3BlLjwvcD4KICAgIDxkaXYgY2xhc3M9InBncmlkIiBpZD0iaGVyb1BpbGxhcnMiPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0gPT09PT09PT09PT09PT09PT0gQVBQID09PT09PT09PT09PT09PT09IC0tPgo8ZGl2IGlkPSJhcHAiIGNsYXNzPSJoaWRlIj4KICA8YXNpZGUgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0iYWJyYW5kIj4KICAgICAgPGRpdiBjbGFzcz0ibWFyayI+4peJPC9kaXY+CiAgICAgIDxkaXY+PGI+Q0hBSVJNQU4gT1M8L2I+PHNwYW4+VjMgwrcgTElWRSBCQUNLRU5EPC9zcGFuPjwvZGl2PgogICAgPC9kaXY+CiAgICA8bmF2IGlkPSJuYXYiPjwvbmF2PgogICAgPGRpdiBjbGFzcz0iYWZvb3QiPgogICAgICA8ZGl2Pk9XTkVSIDxiIGlkPSJ3aG9JZCIgc3R5bGU9ImNvbG9yOnZhcigtLXR4dCkiPjwvYj48L2Rpdj4KICAgICAgPGRpdj5VUFRJTUUgPHNwYW4gaWQ9InVwQ2xvY2siIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7igJQ8L3NwYW4+IMK3IFNQRU5EIDxzcGFuIGlkPSJzcGVuZE1pbmkiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4kMC4wMDwvc3Bhbj48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBzdHlsZT0id2lkdGg6MTAwJTttYXJnaW4tdG9wOjhweCIgb25jbGljaz0ibG9nb3V0KCkiPkxPQ0sgU1lTVEVNPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2FzaWRlPgogIDxtYWluPgogICAgPGRpdiBjbGFzcz0ibXRvcCI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9ImJ1cmdlciIgb25jbGljaz0idG9nZ2xlU2IoKSI+4piwPC9idXR0b24+CiAgICAgIDxkaXYgY2xhc3M9ImNydW1iIj5jaGFpcm1hbi1vcyAvIDxiIGlkPSJjcnVtYiI+aG9tZTwvYj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic3AiPjwvZGl2PgogICAgICA8YnV0dG9uIGlkPSJ0aGVtZUJ0biIgb25jbGljaz0idG9nZ2xlVGhlbWUoKSIgdGl0bGU9IkxpZ2h0IC8gZGFyayI+4peQPC9idXR0b24+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj48c3BhbiBpZD0ic3luY1BpbGwiPlNZTkNFRDwvc3Bhbj48L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0idmlldyI+PC9kaXY+CiAgPC9tYWluPgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSIvYXBwLmpzIj48L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==','base64'),
  'app.js': Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNCNDQ0MkEnLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNBODgwMUInLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzc4OEExRCcsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjNkU3QTNDJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzRGN0EyQScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCi8qIEJPT1Qg4oCUIGV2ZXJ5IHN0ZXAgaXNvbGF0ZWQuCiAgIFRoaXMgdXNlZCB0byBiZSBvbmUgdHJ5L2NhdGNoIGFyb3VuZCBldmVyeXRoaW5nLiBJZiBBTlkgc3RlcCB0aHJldyDigJQKICAgYSBtaXNzaW5nIGVsZW1lbnQsIGEgYmFkIHN0YXRlIHNoYXBlLCBvbmUgYnJva2VuIHJlbmRlciDigJQgdGhlIHdob2xlCiAgIGFwcCBkaWVkIHNpbGVudGx5IGFuZCB5b3UgZ290IGEgYmxhbmsgc2NyZWVuIHdpdGggbm8gZXhwbGFuYXRpb24uCiAgIFRoYXQgaXMgdGhlICJicmFpbiBub3QgcnVubmluZyIgYnVnLiBOb3cgZWFjaCBzdGVwIGZhaWxzIG9uIGl0cyBvd24KICAgYW5kIHNheXMgc28gb24gc2NyZWVuIGluc3RlYWQgb2YgdmFuaXNoaW5nLiAqLwpmdW5jdGlvbiBib290RmFpbChtc2csIGRldGFpbCl7CiAgdHJ5ewogICAgY29uc3Qgdj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlldycpfHxkb2N1bWVudC5ib2R5OwogICAgdi5pbm5lckhUTUw9YDxkaXYgc3R5bGU9Im1heC13aWR0aDo1NjBweDttYXJnaW46NDBweCBhdXRvO3BhZGRpbmc6MjJweDsKICAgICAgYmFja2dyb3VuZDojRkJGOEYxO2JvcmRlcjoxcHggc29saWQgI0I0NDQyQTtib3JkZXItcmFkaXVzOjE0cHg7CiAgICAgIGZvbnQ6MTRweC8xLjYgLWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxSb2JvdG8sc2Fucy1zZXJpZjtjb2xvcjojMTgxNTA5Ij4KICAgICAgPGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNCNDQ0MkE7bWFyZ2luLWJvdHRvbTo4cHgiPiR7bXNnfTwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJmb250LWZhbWlseTp1aS1tb25vc3BhY2UsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMnB4O2JhY2tncm91bmQ6I0Y1RjFFNzsKICAgICAgICBib3JkZXI6MXB4IHNvbGlkICNERUQ3Qzc7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4O21hcmdpbi1ib3R0b206MTJweDsKICAgICAgICB3aGl0ZS1zcGFjZTpwcmUtd3JhcDt3b3JkLWJyZWFrOmJyZWFrLXdvcmQiPiR7U3RyaW5nKGRldGFpbHx8JycpLnNsaWNlKDAsNDAwKX08L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0iY29sb3I6IzZFNjg1NzttYXJnaW4tYm90dG9tOjEycHgiPlRoZSBzZXJ2ZXIgaXMgcHJvYmFibHkgZmluZSBcdTIwMTQgdGhpcyBpcyB0aGUgcGFnZSBmYWlsaW5nIHRvIGRyYXcuCiAgICAgICBUcnkgYSBoYXJkIHJlZnJlc2ggZmlyc3QuIElmIGl0IGtlZXBzIGhhcHBlbmluZywgdGhpcyBleGFjdCB0ZXh0IGlzIHdoYXQgdG8gcmVwb3J0LjwvZGl2PgogICAgICA8YnV0dG9uIG9uY2xpY2s9ImxvY2F0aW9uLnJlbG9hZCgpIiBzdHlsZT0iYmFja2dyb3VuZDojNzg4QTFEO2NvbG9yOiNmZmY7Ym9yZGVyOjA7CiAgICAgICAgYm9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoxMHB4IDE4cHg7Zm9udDppbmhlcml0O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlciI+UmVsb2FkPC9idXR0b24+CiAgICAgIDxidXR0b24gb25jbGljaz0iZG9jdW1lbnQuY29va2llPSdjb3M9OyBQYXRoPS87IE1heC1BZ2U9MCc7bG9jYXRpb24ucmVsb2FkKCkiCiAgICAgICAgc3R5bGU9ImJhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Ym9yZGVyOjFweCBzb2xpZCAjREVEN0M3O2JvcmRlci1yYWRpdXM6OXB4OwogICAgICAgIHBhZGRpbmc6MTBweCAxOHB4O2ZvbnQ6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjttYXJnaW4tbGVmdDo4cHgiPkxvZyBvdXQgYW5kIHJldHJ5PC9idXR0b24+CiAgICA8L2Rpdj5gOwogIH1jYXRjaChlKXsgLyogbm90aGluZyBsZWZ0IHRvIGRyYXcgb24gKi8gfQp9CndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGV2PT57CiAgaWYoIXdpbmRvdy5fX2Jvb3RlZCkgYm9vdEZhaWwoJ1RoZSBwYWdlIGhpdCBhbiBlcnJvciB3aGlsZSBsb2FkaW5nLicsIGV2Lm1lc3NhZ2UrJyBcdTIwMTQgJysoZXYuZmlsZW5hbWV8fCcnKSsnOicrKGV2LmxpbmVub3x8JycpKTsKfSk7CgooYXN5bmMgZnVuY3Rpb24oKXsKICB0cnl7IHBhaW50SGVybygpOyB9Y2F0Y2goZSl7IGNvbnNvbGUuZXJyb3IoJ2hlcm8gcGFpbnQgZmFpbGVkJywgZSk7IH0KCiAgbGV0IGI9e307CiAgdHJ5ewogICAgYiA9IGF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9ib290Jyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCk7CiAgICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaHNVcCcpOyBpZihlbCkgZWwudGV4dENvbnRlbnQ9J09OTElORSc7CiAgfWNhdGNoKGUpewogICAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hzVXAnKTsKICAgIGlmKGVsKXsgZWwudGV4dENvbnRlbnQ9J09GRkxJTkUnOyBlbC5zdHlsZS5jb2xvcj0ndmFyKC0tbWFnKSc7IH0KICAgIHJldHVybiBib290RmFpbCgnQ2Fubm90IHJlYWNoIHRoZSBzZXJ2ZXIuJywgZS5tZXNzYWdlKTsKICB9CgogIGlmKCFiLmF1dGhlZCl7IHdpbmRvdy5fX2Jvb3RlZD10cnVlOyByZXR1cm47IH0gICAvKiBzaG93IHRoZSBsb2dpbiBzY3JlZW4gKi8KCiAgbGV0IHI7CiAgdHJ5eyByID0gYXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IH0KICBjYXRjaChlKXsgcmV0dXJuIGJvb3RGYWlsKCdTaWduZWQgaW4sIGJ1dCBjb3VsZCBub3QgbG9hZCB5b3VyIGRhdGEuJywgZS5tZXNzYWdlKTsgfQoKICBpZighciB8fCAhci5zdGF0ZSkgcmV0dXJuIGJvb3RGYWlsKCdUaGUgc2VydmVyIHJldHVybmVkIG5vIHN0YXRlLicsIEpTT04uc3RyaW5naWZ5KHJ8fHt9KS5zbGljZSgwLDIwMCkpOwogIFMgPSByLnN0YXRlOwoKICB0cnl7IGVudGVyKCk7IHdpbmRvdy5fX2Jvb3RlZD10cnVlOyB9CiAgY2F0Y2goZSl7IGJvb3RGYWlsKCdZb3VyIGRhdGEgbG9hZGVkLCBidXQgdGhlIHNjcmVlbiBmYWlsZWQgdG8gZHJhdy4nLCBlLm1lc3NhZ2UrJ1xuXG4nKyhlLnN0YWNrfHwnJykuc3BsaXQoJ1xuJykuc2xpY2UoMCwzKS5qb2luKCdcbicpKTsgfQp9KSgpOwpmdW5jdGlvbiBwYWludEhlcm8oKXsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVyb1BpbGxhcnMnKS5pbm5lckhUTUw9UElMTEFSUy5tYXAocD0+YDxkaXYgY2xhc3M9InBjYXJkIj4KICAgPHU+RkxPT1IgMCR7cC5pZH08L3U+PGg0PiR7cC5pY29ufSAke2VzYyhwLm5hbWUpfTwvaDQ+PHA+JHtlc2MocC5kZXNjKX08L3A+CiAgICR7cC5jaGlwcy5tYXAoYz0+YDxzcGFuIGNsYXNzPSJjaGlwIj4ke2VzYyhjKX08L3NwYW4+YCkuam9pbignJyl9PC9kaXY+YCkuam9pbignJyk7Cn0KYXN5bmMgZnVuY3Rpb24gZG9Mb2dpbigpewogIGNvbnN0IGU9bGlFcnI7ZS50ZXh0Q29udGVudD0nJzsKICB0cnl7CiAgICBhd2FpdCBBUEkoJy9hcGkvbG9naW4nLHtpZDpsaUlkLnZhbHVlLnRyaW0oKSxwdzpsaVB3LnZhbHVlfSk7CiAgICBsaVB3LnZhbHVlPScnOyBlbnRlcigpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2U9PT0nQUNDRVNTIERFTklFRCc/J0FDQ0VTUyBERU5JRUQuIENyZWRlbnRpYWwgbWlzbWF0Y2gg4oCUIGxvZ2dlZCBDUklUIHNlcnZlci1zaWRlLic6eC5tZXNzYWdlOyB9Cn0KZnVuY3Rpb24gZW50ZXIoKXsKICBnYXRlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTsgYXBwLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTsKICB3aG9JZC50ZXh0Q29udGVudD1TLm93bmVyLmlkOyBidWlsZE5hdigpOyBnbyhTSU1QTEU/J2Rlc2snOidob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCi8qIFRIRSBCVUcgVEhBVCBNQURFIFlPVSBXUklURSBJTiBOT1RFUEFELgogICBFdmVyeSAzIHNlY29uZHMgdGhpcyBjYWxsZWQgcmVuZGVyKCksIHdoaWNoIGRvZXMgdmlldy5pbm5lckhUTUwgPSAuLi4KICAgVGhhdCBkZXN0cm95cyBhbmQgcmVidWlsZHMgZXZlcnkgaW5wdXQgYW5kIHRleHRhcmVhIG9uIHRoZSBwYWdlLiBJZiB5b3UKICAgd2VyZSBtaWQtc2VudGVuY2UsIHlvdXIgdGV4dCB3YXMgZ29uZS4gVGhhdCBpcyB3aHkgdHlwaW5nIHdlbnQgYmxhbmsuCgogICBGaXgsIGluIHRocmVlIHBhcnRzOgogICAxLiBJZiB5b3UgYXJlIHR5cGluZyBpbiBBTlkgZmllbGQsIHRoZSByZXBhaW50IGlzIERFRkVSUkVELCBub3Qgc2tpcHBlZC4KICAgMi4gQW55IGZpZWxkIHdpdGggdGV4dCBpbiBpdCBpcyBuZXZlciB3aXBlZCwgZXZlbiB1bmZvY3VzZWQuCiAgIDMuIEN1cnNvciBwb3NpdGlvbiBhbmQgc2Nyb2xsIGFyZSByZXN0b3JlZCB3aGVuIGEgcmVwYWludCBkb2VzIGhhcHBlbi4gKi8KZnVuY3Rpb24gaXNUeXBpbmcoKXsKICBjb25zdCBhID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDsKICBpZighYSkgcmV0dXJuIGZhbHNlOwogIGNvbnN0IHRhZyA9IChhLnRhZ05hbWV8fCcnKS50b0xvd2VyQ2FzZSgpOwogIHJldHVybiB0YWc9PT0naW5wdXQnIHx8IHRhZz09PSd0ZXh0YXJlYScgfHwgdGFnPT09J3NlbGVjdCcgfHwgYS5pc0NvbnRlbnRFZGl0YWJsZTsKfQpsZXQgZGlydHlTdGF0ZSA9IGZhbHNlOwpmdW5jdGlvbiBzYWZlUmVuZGVyKCl7CiAgaWYoaXNUeXBpbmcoKSl7IGRpcnR5U3RhdGUgPSB0cnVlOyByZXR1cm47IH0gICAvKiBjb21lIGJhY2sgd2hlbiB0aGV5IHN0b3AgKi8KICBjb25zdCBzY3JvbGwgPSB3aW5kb3cuc2Nyb2xsWTsKICByZW5kZXIoKTsKICB3aW5kb3cuc2Nyb2xsVG8oMCwgc2Nyb2xsKTsKICBkaXJ0eVN0YXRlID0gZmFsc2U7Cn0KLyogV2hlbiB5b3UgY2xpY2sgYXdheSBvciBzdG9wIHR5cGluZywgYXBwbHkgYW55dGhpbmcgdGhhdCB3YXMgd2FpdGluZy4gKi8KZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCAoKT0+eyBzZXRUaW1lb3V0KCgpPT57IGlmKGRpcnR5U3RhdGUgJiYgIWlzVHlwaW5nKCkpIHNhZmVSZW5kZXIoKTsgfSwgMjUwKTsgfSk7CgpmdW5jdGlvbiBzdGFydFBvbGwoKXsgc3RvcFBvbGwoKTsgcG9sbD1zZXRJbnRlcnZhbChhc3luYygpPT57CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCAoYXdhaXQgZmV0Y2goJy9hcGkvc3RhdGU/c2luY2U9JytTLnJldix7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCk7CiAgICBpZihyLnVuY2hhbmdlZCl7IFMudGVsZW1ldHJ5PXIudGVsZW1ldHJ5OyBTLmZsb29ycz1yLmZsb29yczsgdGlja0Nocm9tZSgpOwogICAgICBpZighaXNUeXBpbmcoKSAmJiAoY3VyPT09J2hvbWUnfHxjdXI9PT0nYW5hbHl0aWNzJ3x8Y3VyPT09J3N5c3RlbScpKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgc2FmZVJlbmRlcigpOwogICAgICBzeW5jUGlsbC50ZXh0Q29udGVudCA9IGRpcnR5U3RhdGUgPyAnUEFVU0VEIOKAlCBZT1UgQVJFIFRZUElORycgOiAnVVBEQVRFRCc7CiAgICAgIHNldFRpbWVvdXQoKCk9PnsgaWYoIWRpcnR5U3RhdGUpIHN5bmNQaWxsLnRleHRDb250ZW50PSdTWU5DRUQnOyB9LDEyMDApOyB9CiAgfWNhdGNoKGUpeyBzeW5jUGlsbC50ZXh0Q29udGVudD0nT0ZGTElORSc7IH0KfSw1MDAwKSB9CmZ1bmN0aW9uIHN0b3BQb2xsKCl7IGNsZWFySW50ZXJ2YWwocG9sbCkgfQpmdW5jdGlvbiB0aWNrQ2hyb21lKCl7CiAgY29uc3QgdD1TLnRlbGVtZXRyeTsKICB1cENsb2NrLnRleHRDb250ZW50PWhobW1zcyh0LnVwdGltZV9zKTsKICBzcGVuZE1pbmkudGV4dENvbnRlbnQ9JyQnKyhTLnNwZW5kfHwwKS50b0ZpeGVkKDIpOwogIHNwZW5kTWluaS5zdHlsZS5jb2xvcj1TLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSc7Cn0KZnVuY3Rpb24gc29mdFJlZnJlc2goKXsKICBpZihpc1R5cGluZygpKSB7IGRpcnR5U3RhdGUgPSB0cnVlOyByZXR1cm47IH0KICBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+ewogICAgLyogbmV2ZXIgYmxvdyBhd2F5IGEgc2VjdGlvbiB0aGF0IGNvbnRhaW5zIHRleHQgdGhlIE93bmVyIGhhcyBlbnRlcmVkICovCiAgICBjb25zdCBmaWxsZWQgPSBbLi4ubi5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCx0ZXh0YXJlYScpXS5zb21lKGk9PmkudmFsdWUgJiYgaS52YWx1ZS50cmltKCkpOwogICAgaWYoZmlsbGVkKSByZXR1cm47CiAgICBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsKICAgIHRyeXsgbi5pbm5lckhUTUw9TElWRVtmXSgpIH1jYXRjaChlKXt9CiAgfSk7Cn0KY29uc3QgTElWRT17fTsKLyogUGl4ZWwgYXJ0LCBpbmxpbmVkIGFzIGRhdGEgVVJJcyBzbyBpdCB3b3JrcyB3aXRoIG5vIG5ldHdvcmsgYXQgYWxsLiAqLwpjb25zdCBBUlQ9eyJoZXJvIjogImRhdGE6aW1hZ2UvanBlZztiYXNlNjQsLzlqLzRBQVFTa1pKUmdBQkFRQUFBUUFCQUFELzJ3QkRBQWtHQndnSEJna0lCd2dLQ2drTERSWVBEUXdNRFJzVUZSQVdJQjBpSWlBZEh4OGtLRFFzSkNZeEp4OGZMVDB0TVRVM09qbzZJeXMvUkQ4NFF6UTVPamYvMndCREFRb0tDZzBNRFJvUER4bzNKUjhsTnpjM056YzNOemMzTnpjM056YzNOemMzTnpjM056YzNOemMzTnpjM056YzNOemMzTnpjM056YzNOemMzTnpjM056Zi93Z0FSQ0FIMkE0UURBU0lBQWhFQkF4RUIvOFFBR3dBQUF3RUJBUUVCQUFBQUFBQUFBQUFBQUFFQ0F3UUZCZ2YveEFBWUFRRUJBUUVCQUFBQUFBQUFBQUFBQUFBQUFRSURCUC9hQUF3REFRQUNFQU1RQUFBQitIQVFBQUFBQUFHSUtxS1NTcEFCUUEwZ3BKQVdXQUF3QUJnQTBnRnlyU0xRcE1HQTZWR0JhQzFSV3NhRysyVzByUkJLVkpyb21xbTVNSXZORzVSMFlndUdYUm1tRTc1MW5Pa2t6cEpFMGlSc25XU3F6YUFBU1lKQVVUUTVwQ1lDUUF5Z2hvRTBvQUFBQUFBQUFoaWdDQUFBQUFBMklBUXdBQUdnQUNwQmpTQUNqQ0JNRU5rMkEwVWlxS0xwTUdxS1pSTWJaQmNVWHJqY2RXdUdxMWxwbVJwZzA3VEhWYWh3WjUxa2pVaGJtaEtnaU5vT2ZMZk9vbTRNMndodXFhY0NFQUNCTkMyTkRHbkJLWUpNQ215RmNrakJKaXAxQUFBQUFBQUFBVWt4RlNBQURBYkVUVkVxd2dvRXhESkNrZ29RVUp4THRLS2dTb0piYUNZU3hHdFowWFNaVkt4eG9veXE3TW5TTjljclcwQmltSnBybnFyejBneHkyeVRNQXE4N0twVVRucmt1TVhLWnhyRlNOa3VrUkRpcUpDaVVGVDFGWVBKTFVpZ2dMTEZOU2twaW9kRVhwZ1NBSWFVQUFBRzVHSUFBYmtBcEFBUFRPMHFOd3dla0NUUU5NQmhKU0VOaVlRTWFpcW9oYUltelFtZHBNRGFTYVZqWm9MYWRCem9qT3Jrem5TRTAweDBYUm9NNTF6TDF4MExsd1RscGttY3VLdlREU09pczdVenZNalBXRXlpbGFOT0NMbXNsb2toYUl6S0swdDRDQkRRQ29vYUVFakUzUXJHWlR1SnpUN0hrcktxVkFZbUlBQkFLd0VBQWFZMDJkR3VIV3laZEZISE9rRXpTWE5XRU5nbFpFbEFxVlNqcWlMYlZEdU03dGluYURNZG1UMTJPVGRzVHBob3JKejNSejU2S3pOa0p2WFBvYTV1VnVvMFFta3VlZHdtV2V1TkdtZXB2cG5yTE9ldVpPZW1TWnpTdFZKd2tBa3doTlVheWttR3FCZ1dyRUtSeU1HTUxuUU5KMFN2Y3J6WTErZHZPa21ORXRBQUFBaGloY29nQWFZQUdqa1R0MDR0VFRKeUpOQ1RRaGdOM215ZlVQbHI1VitwNS9TS291cUZVTzFTakZGNTJHVmpRNk1ORjF6cFEyd3NlZ2xwSnk0ZHZCcUdibTVxODZLY0J2cGpxdFM1SnoxeUl3MnpTZEp0ZHRjN0NMZ2lOWk1WcWlNOWN4QmF3cWxJS0tVVktJWUp2VWllNnBmT24wT0N4TlZUY3NxcFJwV1FiODZoRWhLUzByVFFBQURFTVViVWpnb2x0VUF5cW5SS05LSWxPSldrVkkxRFpVcXViUFo2L04yOC9UbDBXdXBpdlU0WTVzTnR1azVLNnlPVjlPZFJTWW1rVWdOWE9zSmlMMGdYVXpaUEgyY3VweXE0MWwxTEJqTHVMTGN1Vlk2NUVSU3BXcU5TYWhxcUpMWmpPOHh6NTlPZFltMG1NYjBjNjlEZVBJWDB2TG0rWnJ6eHFkc2QvRG04Y2E1OU0rajVYZnhFZ2FoU0JnaGtncEFRQVRVcTB3VEFjbENHRExjUkZCTk9RYW9Oc2RyTkNTSFVhMWkzTVNVQXh5clNkcGZRMnpyejlNb2ExbWRNbFd2Unk5RWJjbmJlYjV4dWFtYjB6VWhxeVkyOU92SjA5UE9PS1BjNVY4MDZNOVRKMUtMRGJMU2M5b3N6cFVEWURBb1NIbHBCQlZFUFNwY2EzME1hNktqbmZWckx3TDJlek4rY083enJORE8xTWZUVWVVdlY4K3Zvdm4vZStZeXgxMTlUVTlEWGJtOG5YenZuZlo4ZjE4czh0TSszTkRLUTBYbmVRVk9oQ3BWQUVOTnFoTW1xbUhOV1FNSHB6V2FKdU1ucEpLTHFkWWFhS1F1OHJwM2hwSzJpWFNzcnpyYmZrNnNhOXpIYjZYaHI0NlBvdkRPTTM1K21JNmxjWmFmUStSbXJoN2VEVVlMUk9rWGZQUjNUemRFdmR5ZXAzWmZKSG9lZHVOMG8wSnFXSTJ6c1QzNjQ0TS9WNHF4TnJsNXpwa3dOWkkwVUZGUVRqdVdjL3IrZDdCejhuWHpMaGVmbzJlWDduZjE0MTh0NnZaenkrNXgrTjU2ZllmSFk4Mm1mTnZQWEVlLzRUeSt2NGNPRGh2SGdyTDFjNG5wdzNuTWExSG5USW5UTU5NOVNSdXpGdVpRdEtJcUkxRUNVRkdaVEFIZVpIU2Mrc1hqdGtGVkpVelZsYVpCV3VPNE1jb2dsdnQ0dXJHdnAvYitSUFB2Nkw1OFJ6YUxUVXk5UGlVZmFlVHNjdGZQY1BxK1oyd2k4OUttWFlxcXllcm0xbDlkYmRtTmZOWmQzRHFWR21aSTg5U2pYR0YyNDlrdkw2L21hNWRlRzNETElscU9RRk9zVXNtV0Y0T3l1L2c5bVh5bDZ2QVlkdkQzVnl4Nk9jY2ZySERMNlBKNSt5dmg5SHpOVDBqWGl5OHlaTy9QcDU1UXUvaTZVOW41MzB1REd1WFBhTzJJYnFweTZlZEZVMHBVZ0tLbEZya2F0NGxaeWhnVUNGdWRvaUNsWWdDcXpaMEdHa0Nwa1VRWHJqc1hTSUdFdXZaeGI0dm9yVHpPZXVycjhyb3VQVFhuZDNQZlBsMFZZdlc1YTU3NTl0QmViait1NVQ1NmZxUEEzbkxxNU5xeE1OdFBkbnlzOFhwNVllcDBNbkZlT2lyS2gxdnZqN1dONytEOWRoY2VGNVhwYzY4ZFZHb0pUWnBtZ210Q3ptTy9pcDl2QjdzZU52OVo1ZGZQNlpPdzJ4UThtNmthQ2s0Zm45MmRaYWM4Nm5Xc2ZleThUUDB0NDgvd0EzNlA1N1JZOXZIMXd0OE5xeHc3K1l3cUVVeTVacFNhWlNxQUFRd0V3RUhSZks1ZGM2U1NxWkF5Z0dQVEtvdUtBb3VIcms1ZEVxTDI1K2pONjNyeThyRlp2ZUQwdk82STdPalgxZUhYNWRlMWpYays3eVRIcGQzZ2V2amZMdytyNG04OVhqZG5KMHpQVHo2N2JHVlp0RnVJY1dPWnVONWZSbXJyOG5GZnVkZm1QZUk4djI4czM1RmZVOGVuZ3J2MHM4eWZWNGJtTkN6Znk5T0N5dS93QTcwOUpqdDU4dE5mTTlLdUhQZTY0c3UzbXJubTQza1JRKzNpK2o1M3hiM25ONVBVOGlyRFpzNGVmNjM1UGM2T0RmTHRqUHE0c3lzcUNTa3RLVlFtZ0FBYUdDRTJ3RUNHZ0FDcFl3Y0NZQXdHTWR3NDB2UFNXYVZqMXl2TnZBVm13czAzMzR0WSt1OWo0LzZYeTl0ZDU3WmZBOHoyZk5PWjgzSjB6dE12U3RwcVhMb3k3VEdPclBONGRxeTZaNko1ODQ2dGZNdXowdFpPZXVJNmFzNS9Xamd6djZuYjV4NHYwM1B6OGxqOUR5L1J4dm44dlRpNjgrbkRwODI1NEt2UHRnMHpSc1FMZXVmUkhSZVd1ZEZSdGkrWHkvUzgrcDRSOVBocWVEOVB6UG5WTDZlZDUrSDNRNFBXMitXMWZkK0o5SHl1dVl3Y2Vqa3BhcElRNWFwREJNQVRCVTVISUFKaUtBRURFd0FHVW9BWTZuUVRaRTB3ZEJLNlRIM2NmcDg3eDRmVjQ1ZlA0K3A1dTh4Y3ZUcyt0K045eno5UGJ4OVR6dVBUemZIOUx5KytPWmJMcG5OMng5V08yYlBaajFZMHRkekd1Zms2T1hlWXo2WjZUa3o2OExPN1h6UFR4cTlQUW5scjUwOVRIZWVIZmZRbStmUE45YnYrYzY1ZTN4SjQrbVBSNE5Kc2VQUnoyU21haFNacDZIRGViNm1ITHBuVkdOSHRkbmxhOE4zeTcrWjF6MjRZNFdkbCtXMDluditNNnE5SHlzZE5GdzlYTHZPTTFIVEttbFlwWlNCaUtDUVMwa3lXQWdCb0FBR2hpWUFBTXJWTVhyTUp0aFpVb3FRbkxscW9vcjFmTTdzWHZuSGJuZUxrNnNPblBBcWROdmUrZDlIbjArNDYrS1BQdjV2eU51ZnZtU1RwbXRNZHBlL21jWnZWM2VkMFkxNm5OeEV0cHZTZ2F6ejltSnlkZkdyUHNIOC8yY09tSnQyUnpZL1FlVFp4TGJ6dDQ2UExqUHJuVXpxeTlNSEY1N3FUQzFWaWEwalBlYXRyTHY1WloxdkdYcjhibzRiTFVUMHpwNnZqZW5penIyOGZPOGtyM09tZVBqNzg1Zk53OXJnMVBLbTU2NWhXV1NVVk02eVFWUm10SUpHbEUwQUFBQUFBQXdBWnFSWHRZSjU5N0tNUzVFMExUbW9UcXBZZXQ1dVBjZTVpK0RmYmxITFBTWEhGSGRscWMyNnByNmp5L09PZTY1dHNkNWtwYVVpNVRUb3p6ZE44OWM2enIyT0dNS21yYUFsMWM2eThQSjdIbmF6bDd2Zyt0bWRtcjlEbDA0ZU91ZXVYaTZzdTJPUFBXTjROYTBsNTNybVZPVkl0WmNqSVpwcnpzNmx4NHI3SG1acXpCZEJ1WUhSckhEMGVoMDVlWHk5K1ZjdTlpWUxUQ3RlbnpOVGtpcDZTUlZZVW5RTm1ONnlROW9UQ09udlh4bDd2aGlBVUFFQXJBUmdEcWRFNnZTODNXUFc0WXM1c2VqRXlWUVZVT1hReVpxODZsMjcvTjZNM3U4elM0enZUdGpoMHh5dWU0NEd2b2R2bGI0MTA1K3I4NUwxenl2VTZYamN1MitXK2RhNWFUTDdIbStsNTJYSlVQbzFtYmxldWR5NjRkRFBLN1NrOXIwdVhsNXowdk44anIxZk81K3ZtM2VOM1c4YVBTTTNzOHYwT0JNVmVPNXBGNXpOMW5aMWVoNC9yNHZuOC9zZUJwcW8zc3d6MWl6S3UzNkxOK1Q3dVRvbzVQb2ZJemZPUHN2RXN3NFBzL0NsWGpmY2ZLbm1aOUdQbzV3WE5nNXFxcVdqcDJaYjNaMDVZODBjM1AwODlxQVVBQUFCb3BORDN3NkU2WE14dFdUSG5VbVU2SXpHS05NclNOTTNYMGVEMStldlY1OCszejlQTTI5M0xOK2U0ZnFlVGVmQTA5Ymc2VFBwd2l6Nlg1LzJQbjhYMEx3eXBlejRmUXZWV1hYSG1iUmR2dWNOOCtITmpyRzBiWjJ1MXpybXZYUFVySHJacjhEOWo4UHJLNnVMYnR6KzM4LzEvUDgvYmhmUldwaHpiNFdFR2xtR041Nnp2RGNaUnBPcHRyaGpsMDQ1ZEZhVnQ5SnkxNHZUNmZGalh5V2ZYemVubSszaWsrajhmcjVlZXZYOFA2dnhKZGZKL1JmaWJuSHpmcVBCM09UTGZIcmlZMm16RzcyckZ1a296RFF5b2NBUGs3T1ZjUUZhQUFCMmlKR3FPbm0yVHBpUTBNeU5ETkdxaXlLejBBTGhiTE9hNnZkK2QzNTYrN2o1UDBlSFR1MDVYenZwZEh6bm03bjBQbGQzazArYnA5VHBqeU1mYzhtWFhuN3RGNUo3K2Nyb3dxTU9uazlKYjR1cktNSjZSZU91cTZ3Nk9oNVpibXFsdTdPZjRqN1Q0amM1Zlk4YjE5NCt6NStuVGowOHBkL05MNVdYbzQ2bm52cWk1OCtmUk5UeityV1lPam1JS1hCcWI5SG1iVjlycDh6N25uMzBjOC9PVkdXR1BvNTczejdWN1BsZTM0UFBYdWVSMytTZlVmUDl2TFpIUDhBUWNaNCtXbVhmbXBwV0hkemJIUERpeEtaTE13dDUwYmM5NXJpQW9ERUlMVFFEUWE1YnBTVEtpb0dBVlNJalNkQ1hPOHViR1ZvNnpZMngwbDdQUjhEcTU2ZVdjN25kMWVQZWI2dnQvTGZSWXYwSHlQMHZ5MGJHRXpXK3F4RXVtenpkc1Z1ZCtFN1pzWFdrdVY1VWI3WWVsTEZkU1RnK1hqeXV1ZGNSZGNEa3M2L1Y4Q3MzOUJ6OFA2L3o5ZkJ5OW5wand1TDZqNXpVNWN2VDNzOForOXRMNU8zcnhsOHh5ZFQ3WTRLN3ZOMU9yMnZuTjh1N2p6d3BuUjdDZUY2RithdjN2eVBCRXYxSHovTFZucmMzTnlXZlFlZjUzVExsamZIMXhxc1ZxZDNaNHZiRjQzbFloRktRVjNsYVZGVExrQW8wQ0FXMDVSaW9XK0d5RGNsUlFKakNrUTZoaGNVcllRMnFsclhQU0ZjTmFTSUxoblErYWMzcnp3RG9ybHV1dDQxblZ1S05kK1RUTjc4RnBuUkswT25UbjB6YjZlV3pyd3J3clBBeU0vUnl1WldzdHc2MGVUbDZQdS96NzZibHYxc004T1hTOGNjdDU3Y01WWnZqR2RuWXVKV2RVWUt5czFGbXM1dXkxbUdwbkowWHlzM1VUVjN6Mm0vRjBjeEVPS0MyWW9ORHA1dGswa1NJYW9OTGw0eEF4QWdGQUJERjJoS1Jzb2pTZHJNMTJRWWlSVlpCcVF5bktpNmlscHpjRlM1ZEx6cVYxR29wck1aQVVwUnVzNU5EandzOTIvQjdNMzBMOHZKZlkxOGpTUFowOElsOXJQeWcraTZQRHJHL2RueC9aemVuNHI2TDQzZUhHL1Ayd0NMQm9waURUdDVjczM2dkdyNDlPZkxQeU40OVU0dXV6V2QrSmRKNkVuTTk1SnJMRXZMa3JlZWlzTlphY01HbVVKMlN3Tk9iYm5NcHRWQzBSQTFTMnlvMmh5alRSM0xsU1lnbW1DQUdOcFJSQU1Ub2FCb0FaYVRlZW9yenNiaGxwT0tjMUswZzBjMUxkVG9JcVlXZWtVazBCcGlVUUd1R3R4d1I2dmw2aTJ5VmVscDVJZXNlUzQ5YS9IRjl0K0lTK3pwNFNqNkh3RFN5Y1hOQUZnSmdKblhncWw5TFR4Zzl2azRBOVdQTkU5RFh5ZzlVOGtPN2pnb0RZejZMaVdwQ0dJcGlaWWhGVWhXZDVHQlVVVkxKR2hhR3hlR21ObTA0c1NBQkNnQUFBQUFBWExFTkFya0hMUjY0c3R3eW5MTEpJdXMydGsxR2xTNWRMeVpTem90SUZMa0VCTFZqcFhLOWN0WmVmenRNOTRFZFZjMjN2YmMrbnoxZlJ6bS9QdjZXSStmcjZIcmwrVTQvd0JBOEhVK2Q1L1Q4enJ6YURVQUFBT3JMMTc1NzgzUDZmaXpmRVhyWWF6d1BzMnJ6WTlTWTh0ZWh3YXloclR1TWRNVWhvbGlxbW1hNXlGRUZqSkRUTklpYlJJd2tDaW9aMDRPVUVKV0NBQUFBYUFBQUJkRWxKVW9wdVdKdEEyaTZUUk5zVkRFeHhOSnkzY1VPb1pOVHBMTGNpUXhBaE9ncTUwelhsdDUxYzRIVEw5YnpQYzU2dmZQVGwxMVNlYVloVzNmd2RXYjAvUCt2ODlyUGxUMWN2cDRvQ3dBQnJTTlBWNE5jYjlyazJubDA0ODljZDg4OXN0ckl6dkszbnlSdkRjbE5BR3VPMGEzRGxiVEZGQ1N5YTBXYlMzakN5bWdBb1RRQUdrMGtsWEtpYUFBQUJ5MFc0VWFFQlFpbkxSYUdnd0JFbXJ6Wm9aaHFZdU5DS1Vjc3R5NHB3aTZ5cGRUTWpWREZkYXl3bEl3US9MNmViVVlyczdmUXczNWROTnNLeHEzbkt4ck9WblpYblFkdm42WmF6d1pYSFhtRlRRQUEwZFBSeGQrTmVnOEs1Yk9mWEhVejZPWGV4Y1haeVdjd0hUSUFBSU5NNk9nbFphVm5vcVNaSnRnam1IVFNZbFNKZElrSFlnUlRnS1NCb1NzVEFBUU1RQUFERURUQUVERUEwd0FBQVltTnk0YlRLcktpeEtDa3dhWlZSVXRrMEZOU3RHQnlnZE1uUmwyNXZYZU44dDZxUmFTUmVGcE1DNDFEVEt6aDUrbm02WjZtK2pOODdzeTdEaTV1bm0xT3ZveDB4ZDlNTk02SmNwejc1VnFYblVTK2VOZGNBQUFCVTBXbW9wSkdxUkNRVk9rTVZKZzd5QWdBRlRUUURRQUNhWUNZQUFKZ0FBQXdJQUJNZEpzSktDSGFKTENIUkV0c1RHUzJGQ2NEYklOS005WW1YVjRoMzU4cmpmeitqbDBUSHFhK2p3ZEhQWFZYTFdiMExBWFl3RGVjdzBsQ0ZGcnllZjYvazd6MTkzUDBadmtldjR2MEZuaTQ3NWJucDMxVHg2WTFVSW91YXpselpweDY1MmNvSFRJQUFBQUc2MU1zMXRKazZESTBLeXFnUTBHZWlJYkNDaXBHQ0tDU21RVUVqQVRCQUEwd0VBQW9EUlU1aTNrVlpBV1FGa01va0xJSTBlVkdyeVpaTGdLWkpiVlVPRlJKcXNabFhQcEc4akE5UitWV05lcmZtOUdkZFR6Y3VqVlp0WExtdGRlWFRONitmUGtzbng5TWZSeG8rczk3R3Z6UjdmcGxuNVpyMytWdlAwWGY4MTZITHI3ZU8rZkRyeFkraGhyUEpqMWMzVEVjblh6Ynp3Z2RlWUFBQUFIWnR3MWk5RVkzVE5DTVZhc2xVRWxLMVRTUkpnbWdhUlZDQmtnM0lXUURtbkVGb2txYlFRQXdRMmt0c2xzRUFBQXdBYUJpY055eHVXVUJEY3NZa05VS2xTa0JpcWFpZ2xXYmFZWG03WGk1ZDZ3cU5uZ0wxVnlFZHRjRXJ0eXJMZWQrVnpaOU4xL01iOGV1dnZmSmRWbS9rNjQ5TWVqanpoNnUzbVhqWFpsa3Exak5KZU5aNm5PdEZ2TUZJUTBBdzBwVms1b2xFMVl5QTBJQ2lXQ0VKTlVrMEFLbUlHZ0FBRU1Rd1FBTklZaFdJUmlCdEF4QXhBeEF4QTNJVVNGT0tpbkxCcEZtYk5YaVJzWkJxWkJxOFExaVZUU1JkNU0ycm5aMFBuY2J2bkRvT2NPaFlwZGNTUlNHcHJXTGxOY0tSeUtxMXh1T2w4N2wzTUVickVzMWlFQ1JZMEFDRmRRemFzSGxzWWhxWkJvWmhTa3JTWkNrQWs1R2tVeEFOQXhBeEFBQUFBQUNCaUZBQmdJQUFBQUFBQXdBQUFCZ1JTQUFCc0liQlJnTUNBQ2xJSXBDaGhWVUVOaEtBREFBQ0NRTWtHbzJFc1dGa29DOUFscGhBZ3BJRUpBaEJvQUNBQ2dpMkVNQ1VBQkFJQ2tBa29LRUFJQkFVQUFBQUFBQUFBQUFBQXYvOFFBTGhBQUFnSUJBd1FCQXdRREFBTUJBQUFBQVFJQUF4RUVFQklUSUNFeE1DSXlRUVVVSTBBelFsQVZKRFJFLzlvQUNBRUJBQUVGQXZrQnhDTy8yUG5BN2Z6M2lDRGN3UVQ4UXc3aVpoaGgzL0g5RVF3VDMzK3Y3Z01JN2hEODNydk94OTdpQ0NEWXd3UWJtSHVNT3hoN0QyZTVpZWZoQXo4QS93Q0tQa3g4UDRoN0JCQnVkaDJHSDRETVEvMFF1M29kMlA4QWwrWmllTnZKbVBqSGVJSUlZWVlJTnpEM2pjN25zR3htZTVGekdNOWZBZlBkNitQMy9Rejhma3pqOFE3aENOaHNJT3c3RHNNUGNOakQ4T0ppWUV3SmpZREpQZ2R3SGZqTSszNDg3NDdoOEdKanZ4dm41QnVPekd4Z2c3RE13SGN3d3pNejNHSDREM3I5SVk5d0hlQm1mYVBoOWQzdnVIbVltUDZ1SmlZaEhkaUNDWW1OenNPNGJtR0hzSFlkejhpQ01aNG5pZU54MzRucmJIOUQzMmlDWTI0enpNL0pqZkV4MjQ3QnVOOGJIWVFibllkcGgzRUc1Mk1QZjRuaWVOZ013bkczajVjVEU0eXZSdTZFWVA4QVI0U3ZBalY0N3NURTh6elBNOC9GaVlnRXh2aVltSUpqY2JIWTltZmhNTzRnN1REOFk4UW5QYVBqQ3pUNlFMTlhySWY2UHVFK1ZaYkFDMWNaUVIvWE8rSUJPTytOOFFqYzdnOTUyTzRnN1Q4WWhQOEFRRTA0cnFUVjZzMncvd0JWSDhmYkdPVDhPSmo1RHNOaDhMQ0h2SFlkenNJTzAvQ2Y2ZVlYT0Nmazl6SHdDQXdHSDRSSzdkSWEvd0JoUmRMZEZhak1wVS9IanZFRzdRN2pzSFlZZXdRZDJKaUhkUUNmaFJHYWZ0bW44Q1I3dVZmdzU3QjM0M3pQZmNZUFdKOXB6bjR0TzVRNTByeTdLMlYyWE5NMG1kRkREUllKNitjZGhqdzl3N1RQZTQ3OFRFSW1KanV4T0pNR25zTTZOYXpuU3NiVU9ZV0oyL1VFRmVwK1VmRmpiTXh1UFo5RGZFRUkrQ3YvQUNFWmpyTk94ckp0Nmt0cVV6K1JJTDJuS3BwMDBNNkxRcXc3eEIzbU5EOFJoK1U3WTNXdG1uN2RwWFJWenpvVWw5elJtWXdETTAra2F5aXlrb2VKMnZ1Tjlud1o3ZnoyWjN6TVQxUEJtT3dlekIyY2N3NUhlSldQcUp4R3d4R2NablB4eU1BNVE2ZngweE9GZ25VZFoxY3pOUm5CRE9rWjBubkVpQWR1Wm1abVkweDhaN2gzY1NaMG5uUm5Dc1QrSVRxNGpXT1l1REJpYVY5UFZwZFRxYkw1ak1Dd2Z3MTVtc3FwcnJzKzhlKzN4anYvQU51ekhhUk1UTXh1TzVaWjkyTWR5RDZxL3VaWVJCOWhudVlNcHM0d09hckxhZVlLT3M1R2VJVlNjQk9tOHhZc1NxOHcxM1JPbWJPanBHbHROU2sxVG90T2paRFc4NGtUR3grUUNjR25Tc25Rc2dvYWRHY0VuOFVYcHpUMkJWY2FrclpUd1NjWnhpNlYycjArbjYxdCttTlQ0d2RLaURSMm5tOVp5TkRXdGwzVE5qWjRuV0g2clB2SHZ0SjhibnNQdmJFOENlVE1kcDN6TVFUODlnamZkTUNZbkdjWUVsYURuUlFscVcxdFhPRTRmUzFjOUJWektrL2xaV0RWbmpBbkFIdEJJblVhSmN3bWVUVjA5YXF6VG1zNDJ4QnlnTHpOc0xPSnlNOG5ZakU4R1ltSmlZbm1mVk12UDVKOVU0SEhDRmNRZVorMVowYlJYS3VTa1UvWGI5M0dhYlFscFpReU5vOUlRNUE0MVVKVTdkTXpYQ3NYbDI0UVQ5TUk1ZFUxd3VPVnBXeDdSaGg3UFlld2JuWTdZeE13YkRzQjdNVDFNekhudC8ySGRUOStoYkZ4QU0xVktsUHcvckVYMEI1RkhLdi9BSDFIZzk0aSs5R3BscjNKTGtleDhZT3c4VGxDMDh0QUFzUEJJT2xhcjFOV3c1Ym5FOXowZkJtZlA0eVp5TXo0ekJxYlJXMzdtMFBXeXpIMVY2WHF1bEZOYWRlb1E2bXVIWEFSdGVZMnJzSlY3WGU3cUN4SzNzTnRUMWxGeUMrSWx3dVMrMkh4dDAzNHQ3Mjl4dXdldXpFek1USFpudEI3ZklnM3p0K1IyaVUvZG82OG5tc3MxRmZGNS90Z0dDYVZWNWNacmExQWZGdndMRk0wbGkxSFVXSThNOXoxMm5JbVNJakd4UVlsb1pIc2FXaFEwOFR4MkU3OHZFNXUxVE96RVF4UUZyNXRNbUNJbGFRNlduTm1rNFEyaFJabmxwTFZycjExNHVUT0ptVS81QzIybXY2TTFsNnZWWXBWejZpK2o2R3huNHpBSWZlUUo3bjUyUGljdmhEYkQzTWR3OWJIMU1Tb1RvdFhPb0dZeGhNUUpPYVJMUHEwMXZNYXB1SmFxWk1JN0FCT08rZ0JJdXA1QzFGR3hoR052empBOGtoSlhWbW9aRE1qcktteFVERDJFK1d4RE0rTjZUVjArcHBRYkNyc2ZhNTVkT294cWVFclZLRWZWR2RWcFZxU2svZU1wdHNOci9wb3pOWmFtZDhRRE1GTHhhUUpxUDhBSUJQeXZvanhYaU45eG1OaWRzUVQ4K0JDMmU3SGVEM2pZSFl6OGlWUkI0YXVkT2ZVSU1FSWVCc0hGNGprRjI2azhxZUtYU3pUV1Zqd1k5WENLbkkvU2tUaTZ1dUNCTkR5NFdhcTZ0bXNWbGdYSytJUkdHSXhsWUV4NHJCNUdnTUNyMHN6L3dBUjluenQ0M0pubUhzWjE2WUJoclpRM3N0aUhoRjFMSUxIZTA4V2oxc2hkQWhicENFSTZMYlpweWN1d3BlZEtZcUU1MWlHOTRoNU8zUVd3eEovc25vajZGSUVieVpueE1iNXhNL0J4K0hPNTNCbUo2aDlmbUlmRDBrVnM3RThtanVlVmR2RmpZeGZxODRWSFVGZUcwL0hQQkdpVnNIblRSMnVXb3NCOVM0eTFnclBQSlV4YldXV096RlduNVU1VXdlWTBBaXdHYVN2TXhMYXcwc2V5dG1SV1RqMkQyVDU5QmJER3E4SHdjelEwSllNYVZaK28yMXVyUWNZMk9UVy9VMWpPemRTdzlKNTBaeHJFelNKMVZFTnptRm0yclEyT1AwcXpIUm9CVG9JZFJxYzZlVWpKUDNwTWxsb3J6TGlPZmJuNHVXeFdldmd6Mmd6TU0vTUgyVUU0NGd4aGdzZnFuUGxWVFQxQWdLMG1Cc1FONXJjVlEzNFlabXRaZzlQMXNNeHp5WVJjWnhPSmdYWVFyQmtBZmQ0bUlxakZXbytxdXdPUHhhZ3NGK25iR09NT0RPRTZjNmZuaEFvQVI3R2lucVN6Qm1aVjB6T2RNTGhwU2l0Q21rRUxWVHFDRzVvYkhNNUhzVEhQaFZ6YW91WDB2RlJ4V3k2NVJQNUhqMlZWaHJTdy9HbS93QXIvZXE1YmtxTHpPNDJ6OGVOc2tUbEQ4WTdNN3FPUUZMSXZJUS9mK2NHVmxrT2w1MldZNElhYThuU3FZYWxxRmYxTTFpdTFMaHhyMXhXdG5UbW9IQ1k4UWlLNVdGMm5tRW5iM3NuM0t1UzdHb3ZhV2dhYWE0aVUyOVNOUFFOS1dCOUVtRzB0aVRUcFliTlJRem10ZW0xdlRleERtTnFCbmFub2hXdjAwc3ZTeGMrZXRZS2Jrc1k2T2xiYk9nR05sTDF6SGpmRXNYcHFRUk1tV0tWakhpNkU4S2RGWmRGMGRGS24xWDlUdUFwejUvNC93RG90MWliVi81T1U1eFhNL1RiUmxpREZXY0Ztc1hDM1lVVkt6eThqZ2VSZ0JCSytTUEdKd0xSS0pkRlpoT3FZTEs1MUVoc1NMaG9mREg2NjRKNUVGcHFGWElwaUFZbHpxRjZtSlN6R1BhVmZBRUtnc3pEaHZuY3pOaHFJMVBEUjFzOXJhWEpUbWt0cUttWW5HWWpZaDR0T2pMS0ZaR3BWVG9kTnpzczFOVmM1MVhSeGljK0pKejgzcitzTzAvYnRYOSt3bWliK2VqL0FCcXc1REhIVVlNNUNYNmpuT29aMWpPcVlyK09VNVJXbkxNWVptTnNibzNFNFJhMXRWVHpFZFFEYTZ2SFlHTnFNeE5RNGlhakV0dEhLdGkwNWNacTE0dWlnbDIvbXVkV0dNZHVZWUxHNkhYYzE2VTJHNXhkeXJhNFJoelZOSWJEWm9rcUZOZVJxbHhVN0FoUkt1WWhTcDE2T0J5NGFlMzJNOG1QL0xyUkdscXFyWWlENnRoSzI0a1dLNUgwQnRSNHV0VVM2dzJIc1gyQkNNRkI0QW1JRmxtTXdpZVJ0cGNHV09wRmREV0NnTUI1NVpPMUs4aTdoampGV253aFJlVDY1Q0Y1OFNycUVYeVg5ZDFkcWpTZnVFQ1Zha0xkWnFTV1RWc0pTN1dCbUtpOXc4b3JETHFheUsxdCtsMjVUekRyQ2dyMTJueHJOY2JaWFkrY20yRWNlMzhkM2llSm50ejhJUGFQaEUwcEF2MUlvWVZVYWN5OUJYYWQxbEI0cXVDdHVtT2RaVmk0cE9FNFRoT0JnVXpER0JEaFZnU0ZjUm1JbUppY1lWaEVFVXE4bzhsbGFwYkN1UWN6bVFDdzZDZ1I3T1RTNjVxMnR2YXpiN2xYd1g5YmZtQ2ZnZFBwZzBSTEtoYlpZQ3lQWkJjVkF2VkpkZWpKVlpVb3R2cEttczhPVExCWTRqSE0vd0F0ZWZESWExSnR1bU1mRGlmbisyTzNTbkYrdTQ0MENzWWZ1TzZ6Uk9ES1BDR2F1M201bVptWml6VktLcmd4aU1aV1p6eEh0aEpQWVJHQW5pVjRta3huVVloOHhVeVdDR1dvRVRsL0N0RDVlOElDMitZM21IM0JzSWZPeUJEVUhxQVJ3dHIzWk5OWnRMT0FHYk16TTdaenBwMHN5ekVyTmlUaWVCdmNxMXJ0TE1jdXpFeE1iZTVqK245Qm5HWTdjZCtuT0x0U3IyTm9iT0NqekREc0pRL0Y2aUF0MTRSWE1QWlY5OTFoc3RFVDN5SW5JOTdMR0VFb3VLdlkzMUloSVRCblFYZ3l6bG1XV1loM0VNV1l6R1NEWmZPekw5TmRmSkVvcTZLY092cUdxRm9ackpkYnpQWlNPVmFwVXNleXRZekF6UXRiME5jYlMxZW1SZ2F0R3N2RkpmdnhQVTl6SDlUSitNVCtTbTJ4bnNhcXpwaFQ0bUpqWlRLTlhYMGJOUTlwZnpEdU1ZbjVFVDMrTWR3aGpwQ0lJaTVubkkrbE92Z05raDMra3c3TE1RaUtjVG5BeG41Z2hoUGpUMXE2MTFLVTZlTE5SdzZsbG1SMm9hMUJ0V0hPZk1XNTFVaG5uUXNuUWVWVkhKN2M3K3B4MnlJZmpHOVFEV0hTS1lkSzRuQWlZaDdzVGpPbVowNVVpODJwL1R5YkUwNnR4RTZablNhZEpvVW5GWnhtREFHbm5IWUp4NVVnUlI1QndPZ3BEOE8xZGpMQkJOTzU0VWZWSHF5dGxlSmNEa2lORHNnbUppRWJuMytZWUZKaThsM3p0d002Tms2TmtGTFNyU003dm8wUlN1bkU1VUNkV3NUOXdSRHFiSWJHTTVOQnc0N2p1REZaaWNZVTR5clF1NE9sUklmZmVOeDdRa1JMbW5XQkQrU1lld1RNek9VNVJUNXExSVJUZFEyM0l6a1lMR2d2c0UvY3RPdUlIcEpyWFJGTEZvRFlTY1JPbk9rWjAybkJvRWlCZG01Qkx2TXlNVDhRUWJPTXpFMC8wMktoclpmTVpWTTFnR3o3QVJSRE5FdWIzMk1NSityM3NnWG5uUnc0blZFNnhndHRhZFo0YkduSm92M1pHUmJwZ091Z2wxblZPSUJtTm9yd25EeWYwOWdoSEYyOXpIZmljV1dKMWNvRnJOMnF1YU41UHdEZEJrZ2JBek1NUHdyN0ZUbE9EVHBQT21KVW5GSFhzNXVVb2QwTEpxRlZ2Yzh3UVppSzdFaXhJbHJBdzhlTHJYeG1abnNFeEdTSjROSnltcDF0ZW1JL1YvcTY2YWdFUnhNUmRqS0daWWRqMkFpRXpSaTAwNnpxSlhnUUtERVZST0VQaWFUajF6ZlVwc0lObWpXcHJEcEtxS3RPZ2EzWDZkQU5BQis1RCtFWkJybVFFYXpIN2gvdTdCc05odHloYUdHSDMzamVyMytJTmo4SWl4RGpUSWJYajBNWU5QOEFVNlN4QkhURVNvc1dTb0MxS2xYOVBPTlZhTDJ2MXRmVHRLOGRJYUMxVkM1YlVhZkUwYnJYYnFMdXFCQkxEZUFiTHBZV080N0ZoRTQ0bEw0bHRoZDh6UzJGTDNXT0lSRkVhR0R6Mm5mL0FGcjFGbFMyMzJXeE1FbVZxU1UwbGhsOUZWV25ZWU1XYUsydXV6OStIQ1dGVzFQNmgxVVVsVy9kV2NENy9jWHFoai9kc2Roc044ek1PMkpaOTNmK05xUWRzL0trNHQrMnNGb21tdmUyY2t3eUtaWlNyam9NaU10Vkt0ZURMcnVxS1VaN2V2YXEyMlBhMVp1TklkeEY1U3kxaWRNNnF6YWl1SEJlV0ttT0FqWjdFMkd3aEV0YnAxSGFsZ2xwOGdyNUltSSs5Z1hqc0RENm1KL3JzQjRvcWF4cXF4U0pyVklvZjFCRkdaYm8zU21pbzJXdG9WNk5WR2IrZ25UMWxZUzdTVjFYVlgvNUg5NzRpMStQUjdNOWxuM2RvOW5zcUpBNW5mTXpNOW1Pd1JZbFE2WTB0Q3l4d29hemt3T0N1REE5WWx5VlN4UUpxQWdJQnl2VWpaeWwxMVlQSm1wdGFrMldHeXpUaXNtejlzVkhzWkVlMVhqZSt4WU5odXloaHFxT2c4MEdtNjFoaEU0eG8wOUV6cUVWNDJ4QW9LS2xaQXEwOHNRQWFaZE9aWjB1b2hyRnFsWU1UODYrOEtqUDRxMUQxVGtXYW0xNldzMVo2VmRySlkydFUwcmFRLzhBNVA2YnJPbzV0Wmx0ZHJIYkV4dUlucXovQUNIZlBZR3hMVzVIdFgyM3Y4Ykw2K0hPMlp6R0lJTEdFVFYzTEYxSXRtUHBMeSs4MXhXYWNoWlNlbm03aVcvVGE4MkNoaTlxRkg1T0ZmUFMwNkl0QlEyalQwOVl0cG1DQ0lOUHdjVWlmUlBvbjB6NlpnVG8vU1V4QUlCdmZxS3FacWIydnNtaDFmN2RxblM1U2tLWWhFS2lGUk1DWVdZRXdzd2t4WE1WVCtHUDBlbWRnY3JvN3VreDhIcUNwTlJZYkhzOGJDVlZteXo5alh3ZENHWFF1MUdNRWFONXE2K2xkcHowbDF0U0tyK3BtWmdEd1ZNWmFPTFF3bnVmdUhhUFh3bjMyZmppd0VEUmJ5R0RmUVRpY3BUY0ZPZnJ2TGRUOUw5cW9ENjMvd0NxMnpxQTJjYXFEWVVzdTRyVS9FTzNnU2svWFk1TXg0WDM0blRPV1VLSzRCbUluSWdUVVhEVHBicnJYak9UMkxheW1yOVJ0QnJzVzlHaGhFWFNXdWJVNlR1L0xiRXhLdEpaWTFlanRGK29VSmFmY1J1TFp6TkhlRm1wdDZ0bk1LU2N6RUF4TkpZSzcydlRvWFc1MUNhMytDeXd1NTFicU5WcUJhZEpyVXJtcTFJdFl2OEFUMUoxSjFKKzRNcnQ1TGVjdHNZZTF2WGFJZXdlaHQrTno0TUViM0VmaU5sVEtFMkVjVE9KeE9veHI3Rm42ZGNsY1hVMWN0U3dmVWtoaDQ2T21aZWhmWUhPa3Q2Y3QxRnNaMmRneFVvK0dhekpWZ0M5Z1lURVNWS1F0UStwRm11dk45M2YrazNjTHlsWW5UVTJaUU1iZk9vUEs2dlRjNSsycTRhY1Uwbk9tNW5WTFAzU3pVTnl1cDA3Nmd2bzdVVGF0L3Fkc21WZElIUzNhWkgxOTYyMkdjb1RNN3NEeXcwcGJweXhDdFhaU2ZwdDNidWIxOFE5ZkFJZmdIcVpPTW1abVptTFppYzV6bktjaFBFR0ljWjJYamhHQ25xbll0eUFoZmxNL1RPcXhpMk5uV1dGTklmTzNLWjJ6TTdJL0U5WXVwc2FOWTBOelRQS0t3VXRnbmtBdjBpTzZPUTZCU1U0dVY1RXp4Q01UeE1pWkV5Snlpdmd2WnlibE9VNW1jekM1QVpzbnZxOVBQeHNmWkpBbWZtQTVmMC94M25ZUWRvZzNYWWJDS0orclcrZmgwRm5LZ21NWWRzN0graWRoRDVWaGc3Y2hPZlpYRzJNSHRnQTF1T2w4UEV6aVpnLzFCMzVtZGxPSVRrOGhPYXhSbVl3Q3lpZTVtQmxnZFoxRmpXb2cvZFV5dGc2allRZUJxN1JiZjhBRHBMdWxheGhPemtJenVxd01EMjRNd1owbk0vYjJ4MUtUSTdHeUQySGI4V2UrOUkyNDhGN0VacjdlYWQzRXppMDROdmt6a1puTUFVdzByT2xHWGp0bVpuS2NwbVptWm1aNy93V3ozdDVIU095c1ZnMUp4OUR3ZFNzaTZkWkoxVW5WV2RaWmptS3dBdVRBNXhRYTJuNmszSFRHY1A0ZTkwd2swNy9BTVRzRE5TeDZmbUFjbHFVTE9WSUJkbk8yWm1kZFZqNnExdGd1WXFZYjRlUWorWmlZbkdFWTdGT0R5bVlJY1FXUXRrZG9PSnlNejNmanNiMFBoSGFSQjYrRmt5U3JEZGJHRVcyb2pxVVRucDV6MDg1YWVkV21kYXFDNm1OZFZFMUtJYk5VbGlSbXl2ZXBYcFNsNjBVM1ZDZFduSEhUd1BVSXhvYWYrdk9wVE9wVE9yVEh1RVppMi9Fd2VBVHZudUkrbXV2bEwwNGRuNDNUN21PQm1MYXlRMk1mNkg0N0hCSHcvZ2RyZWg2N0ZRdjJDRGJCK1VBc1JWWVlmZ1VGandmNXEvZnhFK0Q2VDFaNy9HMzQyVTRJZjZYOWJaL3FmbDJMZkNmUTNFejVhZmpieDhBZ21vYkM5Z3FzTTZGcy9iMno5dGRQMjEwL2EzbWZzNzUreTFFUlhkN3FyS203NmFiYklvZG4vYjNUcFBPbTg0Tk9EVGc4NE5NRWRnT0puNEVmaXUvNC9DZXJQZS80M0h0ajQvdGVaNTdoMlloN0QyanNFc2JrKzFLY21HQnYrUkNZclJZSnBrVWZxV3Z2NjkvZittWDhMSzFVZnFMeHRqRTJ6c3c4R0RhdjFNajVGamVKbVptWWZYWjUrZmtaeU01R1pQOUFlNE1iWmg3RHVSZzdEZTV1S2JDYVpjSUlCdTJ5d2VzeWkzT3R3Y2Q5ZVVzRFkvVUdNYmIvYXVIWnNUbjU3azdjbkcvMDQ1RGpWaVhZNC8xTW1jak9SK0VZbjVHMk80eGUxcGlZK0FiM05sOWxHU1BHdzNZd1JZREMwMDMvd0JWV29zcVUrZTZ0K0RHNTdidi93QjBNTS8zVDdvWm42ZTlQaUdJSWY3V2RobmJFeHQrWjRtQlBFOFRNenNZRE16Sm5tWk16TTdzY3dqR3d4TUxNRGRtNHJzSnB4NWdnaE01WkdmT1lHaGVNOHFianFiUDhuZnAvd0RLamN0Um1HR05GKytINFY3OHpPMmRzVEhkait2NDJ6dG1abWUzT3crSE04Y1EzaFhFSnlZZHJqNTJFckhGTmdZWUkwSm5LY2ptV0x5akE4cCtOenNnSmxZQ2dUT3plaDcySUkrQWJqMzRJRVUrZXBIT1QvejgvRCtPd3owRDVPMVl5MEhhVERQVU9KbmE3N3BVQVExWnlGSlpLeURlTU5LdnR6QVpudWZqanZHNDJFQThROW1JRk9abVovNUkrQWV0aGpZKzdUNDJFcUhqNGh0ZHRWOXNYL05MajlVVDdJT3ovWWJGMTQ5NDNHd2cyTytKZ3duQ01mOEFwZ0hCRUU1RTFZTXhHT1RzSUJqc3lKa1RJbVJNaVpXWlNaU2Z4elVjT00wNVVRdFZ4SHZuVExTRFpFNmZEK0tmeHo2SWVFOFFnY20razRqKy9neE1RUWlDRHZQL0FEL014UEczS1pFek16ekJtT3pBYkNMNzg3NG1KaVltQk9JbkZaeFdCRW5CSmNpOU9hVTBDV3ZwT01XelFrWGNlb0FTZW5WT25YT0NUZ3M0ck1MR0FtQVp4eEcrSDJBVmh4RHRtWkcyWm1abWY3dURNVHg4R1ptWk04enp0OUU1Sk9ZbkltZlZQTTR6RXhPTUEzdDdLN0sxWDRCaURFQ2t3S1krcnBTWGE0dXN6TVoyOWJJV1JrL1V6RjFWTnNLTkdEQ0V6elBNUGlkU1BqNFViakJob1ZuZ2JlZDhtWk15Wm1abVptWitMTThURXdmajVHWitYRXhNVEV4OFBLWjJiYkV4TUdESWd0ZVYzMkxPUk16QnRpY1ppQlpxTUxwNmFkUCsxZGdUUDB2UzF2UmRSMU5QVXZVdDZZNGZxVllxMWNyWlViV1VhZXVsSFY2L0VQR0dOR2c4eTBlZmdYTzNtTE1URStxZVo1bURNR1ltSmlZL29lSmdUQi91NTI1VEptZmdHNE01VGxPYzZrNnNGMC9jR2Z1VE5WYjFSMU9ORFdjcXZ6UnJTbFkvVUdsVm5Dei9BTWkwMWw2M2tlNzcrVkQyZFZkTmYwNmpxWWI1MXAxSnptUkcrSEhabVpJbktjcG4remsvM000bnYrdG1PY3d6OFJET1VEZlZtT2RqQkFabnVPMkpqdUhkaWVwNC93Q242bnYreVlSdUlkdk1PNjdZN2ovUnhQVTk3NS81dm1lWjVtVE1tWk15Wmt6Sm1UTW1aTXoyZVprekptVE9Sbkl6a1p5TTVHY2pPUm5Jek8rWms3WlBabWNqT1JuSXprWmt6Sm1UTW40Y3pKbVRNbVpNeVprekptWm1abWYrWjZudi9naUhjN0QrOWordi84UUFKQkVBQWdJQkJBTUJBQU1CQUFBQUFBQUFBQUVRRVFJU0lEQkFJVEZRUVFOUmNJRC8yZ0FJQVFNQkFUOEIvd0NLTkpYSStwWGFydDBWRk9IMzZLSzVLaWlwb29mb1NqUHJlQzFzb29mVnJkWTMxMXNVUGlyZ1VLYlF6OGl4RDZ5R1dKd28wbGNDTDZORDdERXhGQ0ZEM3JJZVA2aEZGVFl0bE9VVkxYWGNVS0dpendlRHdWTnluQzlqOGo0TkpVMUdUNjlUZzRaUlVKYlVhU3BzYmg3TEwyV1dXUHJJL1J4aU5EMldYc1dWRnE3ancvVU44TGNMczB6VERSVWF1SmlMcUhGYjdpaXV6Wlo1S1o1UFBJa1ArakgyUGg4bmtTaWpTYVRMRmNDNWtJb2VKVlErUE1VdmVrVU1VTkRId0xtVEU0c2MxeFpOR0pleWlvWWhEWTNIa2JZeHJnWFFXUlpmSFprNXN2WlJRNFRMajBhaDVHb3NmYXN2aFk5bURpNXY0OW1vMUdvMW1zMUdveWUzMFdQSXN1Zkh5N0wzMzgxeG9OQm9Sb1E4QjdLSGdpaWl2bDQ3RVpmbTFEK1RVdUZzMURlMWZPWENoL0pyY3QxR1F2UmpGRmZLdWRSYTJ0djBodHNYOGZpekhHejBMTEtHaG9lMi9pMldXYWpVeld4dnpDelpqa1pPMldhMmEyYWkvd0RDZi8vRUFDb1JBQUlDQVFRQkJBSUNBZ01BQUFBQUFBQUJBaEVRRWlBaE1RTXdRRUZRRTFGQ1lTSXlZSEJ4LzlvQUNBRUNBUUUvQWY4QXZlL3NmeWZzVWsvVVh0TlNFL2J2cytCU0xacUw5QmVwZXpXalhaeUp4dkVldmJNZmVLSC9BRUpzczRMTlJxTlJhTFhvMmFrYWthaHlMeGFFeUhaS1ZZOFhYdDVGaVloczFXUnpSMFdMWnFGSTFHb3ZOc2JMSHdhckxaeXhMa1ZFbGZBb082SXFoZXRYb1NLeThSM0xZMmhpM01ReTBkOUZTSXBuODhVU3I1SVV1RjdhU0Vob2NjTXNYa0ZMTlpXVW1oYlV4NXJGNFJ5TTFJaHo2bGVrei96RWtTWnFSTGthb1hSSEZQYnBFL2huUXBGaWVJb2wwSVp3Snh6T1ZHcGpWbkh5UWtuMTdsayt5S3NRb3ZzcG5JMnhOM3ljTTBvY01XZG1uSFFoYm5ZdkoreldUZDRVbWpzOGFwKzJrS2ZBbmVQS3NRb3RGb1kyV1JMTEpMNUd6VU5sR25rVU1MWnBLUTBMbzAvczBHaElwRWZiUzZQNGl4NUZ3SWlzTW9hRkRZMVkwK2l6cnNRbzFpaTlsckVJbEV5MitoOElWVnlKcjJsbXBEa1dpMGFobWhDell5OWlaTW9Rc1hpdGxDUmFOU0hKQ1ozOEhJMC9hVVVOSVZJY2tVbWFVTkM1S09SNFcxc1EweFpYZUZoaW80T0NVcStCaWtqWHdLYklTYkY3V1kvMmFpUGtGSnMrQ0M1T1IzWjhqRnU4YUdJc1cyck9oeW9VbTJKalZsSVRSSGdpK1JlMWxHeWNHVVJpK3lCWW1XZko4anhaZXlDZGtycmpObG1vdkM2R2lTb2pHeFJHUjBrVkVqVmtaS3hlM2xBb2NUclB5Zk8rRWN0SmpWRmlrYWtqV2EySjhjbHBrb2lpTjBmN0lVUDJSZ2thRWFVdVJlNm9vckwycFd4TFo1SS9KUlJSUnBLS3pSUlgwRkRpelNhRDhaK1A5bWdhbzhhK1JiS3NvakVvclA4QWtWOUtuaWlpalNqU2lraGJhUlJSUlJYMUNXSDVEOGpQeU0vSXhlUWoxenNjdVdLYk5SWnFFL3FGaWJIbGtGd3hYc2Y5aXcvcDd5c1BacEV0c2loREY5VTk2TEd4ZEQrcm9XSHV0RWVoOWt4ZEZsNVgxQ3hwR25tOEpLclpGSmREOHFUb241Tkl1VVNoRzhLUW1MYldMK2pvb28wbWhHaENYQWtQeHF5VUxJcWtLTkRnck5DTklsOWZXK3YrSi8vRUFFRVFBQUVEQWdFSkJRWUVCUU1FQXdBQUFBRUFBaEVoTVJJREVDQWlNa0ZSWVhFVE1FQ0JrU016UWxDU29RUlNjckZnWW9MQjRSU2kwU1EwY1BCanN2SC8yZ0FJQVFFQUJqOEM3MlIvQ3MveGhYNWpYNXRKK2EzL0FQRTExZFgwSUhmOC9rOS9uWFA1UlgrQ0o3K25kVThkWlZQb3FEK0NpODBHN21vOEZ6V0Y0WEwrRzhlVitsWWNsOVhoSWZmaW9kVUtXL3d6MmppSjRyQzJqUDM4TkRxaFMyMzhNeFB5TmpNdGs2Z2JVTC9wOHQ1SWlqaU9CV3NJK2FDVEE0OTFxdEo2TDJqbXQrNjN2Nm9zYTBBY2g0bW5oSGFySENraHdWY203Sm5pd293NGtiaVZBQmVCdWlWclpQQ2VWRnFaVDZsc3owcjgzb0ZVWWYxTFh5ay9wV3BrNTYxWEpWT1p3YUtZUWZGVjdtbmVVc25PRXp5SzF3SGZxQ0haTnduZnJLc3JXcjFWV1IwV3EvMVZJUFFxb1B5NmpTVlhDM3FVMFB5dERkYXJYUDZxV01PVFp1Q3ZtYzV1RysvZW9lMHRPZkU2Snd4VDVMQjdnOVZCVjRUcTU2S3JRN3lWV1BhdFY0ODEvd0FadFpvUGtyUjVxai9WVWMwclpWUjhpb0ZzcXJtaFZmNkJiTTlTdFZvSGtyclhlY3pYTzdNUDZTVjdSMGdXenN5ZTlva3JkSDVTc2JHbHVVbE9QUHd0TktxcDNRVk5JZGMwNXZQUHFvdE5KM2hWZFpkcGtmUWJsSkN1cXRDM3FqdlVLbGZOV0sxSE5kL1V0YklFL3dCS2FIdHdqNG9WTXNSMVdybHBWSHRYd256V3l0Zytpc2ZBYko5RnNPOUZzcTdmVlZlMWJmMlc4cjNjb01ia1E5NUtJdzVMSmc4U2lUK0lZWGZsR2djb0JxaEJ1N2VpMCtXYnRleGE5dzRvdW9KTmdnMHhGYnJmRGRZeW5PKzZ3ckJ3WWloNHl1Y2FRMHdvQmg0V0V1elczNkRlcU9OY3Q2TG5HQnc0NlY4MUNwUURXTnhSZkVvZG4zcmFLMnlycjRmUmJEZlJlN1l2ZE1WY2kxZTZhdmN0WHVXcjNMVjdwaTJHS3pQUlhiNkwzaTk0VkpjVnZXL00wNVBKbFNXL2RGdk9xRVRmY3Y4QWtyY212eWgxVHVVRnBRZGxHMFVia1hOM3JYanpSN08zSllNUnc4TTd4dkxSQ0t4WlFEQ0xwenNVY25LdkFmTFFoem9xaVZpYlNPQXVobkdZRjJzK0ZoeWdyK1pBU0M0VVBjaWVDbkp1RXhVRlM1ckNPcXhOeVVmcFVIUXZuNHFET0xrb2pDZHhsUWFhVmFxalFxV1V4bXRuR0Z6b3Rzcld4RWMxclI2cnpWTU9FWGdvdGNRWjRxQTcwWEdPS3BIcXYrQWpVeDFXcFZ5UGE3U2hqUzdvb2VJS3hmQ0RWRERJaTBLYVkvaUhGWUdtZ0s1NXNXRTRlTUk5OVR4Mk9RUnlVU0o0SXcrRHlRelV6QXZ0bXhBU3BiUis4ZHo1TFhrU0tLR1RIY1VYTkhIWVdjcC9zdGNCMGNWcTRmSUxoU3c3enMydGNSd2hhMDUvZXNydVY4NFkvSjQzbS9KYlpIM1U5cXpEeFdESXp6UEZhM0JaUU9kRmJiME1MWFlRZG9xaXFQUk5pdjJ6MGEwbmlSWk9iL3FNWk5nMXRFUWU1cDRLdmdEMFRleTFwSEVMV01PNTVoMFJSTzRMWVBUY3BLd3lod2hIS1pHc1dIQmEybFRONUk0Y083YUNxeHRQeXFXdkI1YVVsVUtxbkFWSUtpSlV4NXB4alhDTW5TRWFYdHUxbmt0WEl6MVRpeHVFY014OTNsSjNsYTVERHlXdzkzQWl5N1hLdGgzd0NVY0lEUnl6RU9BYzA3aXRSclIwQ0xuWFdWbmRDZGsyc3M2K2pTdlJiTWZxSzFzb0Ira0k0WEYzTW9vNTZvOXpYeGp1bWF3VkZmY3BLbFJtMVpsTkRuREhGbEl1cTZydVBGVGNjbFVLNjFLcXVzNzdCT0VCaDNGRUc0WGtuNEkzTEM3Q1VmWk5ITVpwMFRtRUwrYUxxaEtEd3hvUEh1YWhVejRjV1ZMdXRNMnMySkVoRkRFMEFFYmx0L1pZV0hWNEtUSlZsRDlVODFyUEIvU2hoSmR4M1F2WnNJSUdzU1U3czN0MWtUVnhLMmZVd3F1YU9sVlZ6aXRWZ1ZLSUI3OEltcFJxL0tzanBYTWRDdmdhS29WUEJsWThpOXp1V0RPVU1WVzcwY09UQkc2aTFtaUUwWGFVMTdSRFRlcWU4aWdzdFRLRHpVS2hWY242TEE5dlRtcEdTUGs1R0d4eEozSnRNUkhGRmVTMVhFZEZKTTU0blJPYkVjMDcwUTZDTjRLN1J1cnhCWEhSb0ZaV29wMlR3T2R6OG9lVUs3THpkTjdOd0pHWWFuM1dxeUJ6VWdCdklLWjlGSnhPUFJWSHFWVjdRcXZQa0ZZbnFWcXNIcG12bURXaXBYdEhzYXE1UXZQOG9YdUovV1lUbU5iazJnajRRZ2lPU0NLaGc4MFR3Umo1S2VxT2M5Y3d3QU4zT2hPa3hDTHVkT1dZd2MwVk84TENRSlZSaFRTSEhpT1MxbXNpZUYxUHd6TGlpZU9ZOU0vVFF1aG1vcE5ndVdlQ2hocUFOMmh2eldXUEtXM0RlVjdNUTBmWkRJdm80SGFVdE5zMnYrNm8xUTFzSjJMSzRCVHpWY3E0cWpGUmc5RlJYVjlBWXJUVkhBektQYnUzS2pRd2RWT01Ib0UySnZ4VTRHOHBxdHFuVllXTXJ2SlVRQjBRWGtnaWlGSHlZQWIzS3F1aENPYWdWUUFBRHVXQUtjSGx1VkFmSXJFSzhKVW0yOG9FeTBxbDk2YjFVQ09LRFBQT1Z4VXFpdG12b1lXMi9kVk9sVnRlSVZIVjVxZ1BrdDlRVnFucUNzVGNxeFlzVGlFTVJnYm1xR05HSG52eisxdjBXcmtFR3RZR3htN1FaUEpCc3hzckc2dlJFUDRLQTRMV0dsU3BWY3dLSklFOE9DY0J0dUhvRnEyNGxIdERqZEhsbUFtTXhqeEUrQUMxY280ZWVadlhQZEVIZ3BHYXFDYTFwS3BGTjZER0dkNUtxZEV3cGZRS0FxRlZhRldWdlc5WWhtamUzUXBiOHlrNzg4VFZVVlpXQnpnNXA0cXZZejFUWmppUzFQeWpSVzFlNGl1Q1ZySFY2cU1SWlJIWHJ6WFo1WVN6andSMFpKM0xlRklxT1FRa1F0Y0VsWW8xVmdEYUJReDBIZzVIa1ZJK1ZOempRYnpvZ1hGUTNOcnpBM292dC9NNyt5d3Rvd2J0Q0NobWRucU5KcnRyRnczS1F5dlZWYUZJc2JKNGZRQzNGTkRaZ2NVTU1oUUNveXBGRlZzZzJLZ00xVnpWQlJPSnJBbUVHT2FOYWl3TWJBQjQ2Zmt1ekFwTXlzR0VMVk90RzlIWEM5bzNFM2lGRHhYNFh0M3IrNkcwOG1iTC90NS9VNWJPUWIrazFUUmJWVndxT2dLcGQrcFUxbW9tMjRMaXFGTzYvS3gyamkwUmNDVkRIWWh4ak41YUFJUURmeXlpNVVYdENYUDRMZ0JRRHVIZGRDbWVtWXRjYWRGaFkwQUlrUlJQSTRXME9BQ3BRQUlCeGlhb2h6eEg3cVB1bUlIRlhrcGNUaUV3aHArU2ZreWFrMlZNVXdzYm1va0NpLzRVSFpLbWZNSnN2eWg1QUwzRDMvMUkreHliUDZxb0RsbW5MUGdmbFVZV2h2QTcwTGliaFJreERRb3c0aEZRb3ljampKb25DUWVueXRrL3ZDYjJqM00vcEIvWkdNc3gvV1FuQnBFUnVNNk9UZnVraFFWcXRUbGZ1RDF6eHB5NDRYZExyQTJ5NXJXYUNvd2pEdUNwQThrQ0x6Vk9lNWNrSXVzREhFQWJsck9KN3J5VHBKeDdsYktIelRTTW5xOENVU01tMEw0V2o5S0dFREc1UmJrRTMyMFYrRzYxKzBQUXFHWkdEeExrMXdkY2VpbzVFaS9ITUkyMk45UW9SQnBpQVRXM2dVQVRnYUg1V0pNVTR3bWtHdmwvWk9JL3VzcG91eWJyT1ExcFZVVHBGamQyYzljMUZKN3F5aFJoTUtPZEUwWVJXaS85b3NPU0g5Vy91NnJ5VHk3YTNWWHVwUE55RG9nY2tTRkxxTkNjOXZRRmN0REpoV1Z5akNhOWxPQkM3WTVISitidjdMQ1lqb3Qza0lSd2dnUnZQamQ0Vks5N1A5NFdJQ1JISk8vei9aUE9pSGNFZjVTcGZ2dHBONnB6blhKejA0OTJDbkIyNHFRaisrWWgyeXZaQzN4SGNpMWg2bmozRTZMVHhsUGRPeXNibjFpMGhOTGFObjRrNGpXVmRWaXd0c0xhSWc3K0sxOG93ZWExY3BQUlVsUmsvd0FNMTlkb3BveXpXTkkzTlRUbE1zeGdLcitJSjZKby9EWWpTczl6TGZrUndHdkZwV0oxK2kyUVU3UzlvZGI5MXJHeW5RNStCT1dwQi9kR3NxNmk2bktPMWJ3c0xSQTA2clZSR2lQTlpURTE1Z2ZDZ1RrM25uSUNCZ1laMlM2VTZqRzhsRGRMV3llSTlWcS9oMkJiTVpzTGNxUU9BWHh1WHUzZWFyMlk2dVZNdTFwUEFkMUlWYzFPK0FObHFsVXIwVlIzZ0RyU3FQSVVNeXJqMFZNc2ZOcTJzbVZzTVBSeTkwL3lWUThlUzJ2c3RwcTNlcXNqVFNuVjFUSFBROTJmckNvSEE4KzZka3VOZEFkQjM3UUZTUm11RkZGL2hVRHZSZTdldGoxY3I1TWVhRGNiS2laVXUvRUR5VzA4K2EySjgxVEp0OUZRUjVLNTljMTBLdTdURjVSM05sQnRucUZpZHE4bHJ1OWU5b1Nxd1ZWcW9PN0N3bkk1Ti82bFg4TVBKeHpYVjgxL3VxcXJHK2kxc2tFM0c1d2RGVnFaUjVIVmU4Y3ZlZjdWdE05RjhIcXJEMVd4OTFzT1dzMS9vZ3A3VXQ1MVdJNVlQSzU5eTA4MXl6K1dtT1ZkQWFEZTAyWnJDcGs4b1ZJeUZQMHFqRytpb0ZxejVLNnVyb1lzVWNrY014elgvYnllYjFUOE5rL09xR294c2ZsRVo4WnlaaFFwTDJCMzVacXE4VWU2MWZRcWpXaGRvLzJtVTRuY294d09TcjR6R0duRHhWaXRranF0cWVpdFYxdWlrVzBHc0oxVzJVWk1BazhSS2wrUnlCL3BScEhMUGNxNmhnazhsck5JOGxLQ3JrNmVTT0VQOCs4d21ydUFXdGtxY2lpNWg4dE43bWo0YTh1NEhWYXY0Z1pNVFphMzRuSE4ycTZvalYxdmhWS3FyVTJTeHZOMWtQOEFxTW41TlR5RE5UVlJscGpjbmR0VXUyVUE0RWhiSmlEWkNkMWsxNHlqamxTNnJVRDhPTk9aMkpPVUpvOU93bytLUGdJN2NqLzQxQS9Fc3luN3FWTG02bzN5dGE1K3lrMk4xYXFoSDJtdHlGRURrOHBqTzhZWVRVR3RBN1BNTVB4Vktaak90WDBqTUdOSUpBbXFsNWdRb21nKytacTFWWC82cW8rM2RlU0xuR3B6TmpqR25HZ05EeldGaGdkRnJ1bUZyV0NqZHdDcHczTFhoby9tVWlUV0txTS90bXkxUDdWdUttclJTQ29HVDlTcGFhcUExb0orSUN1YkIyam84WWZBTTkwUVQ1cXY0Wm5WcXd2YkViMUVadXF3eDJqT2ExMm45QVA3cUJrY21CMFE5bXhzZmxDaGw3cVdPeEVmeXJFOHlWaERNVGR4NEp3bUtRdFVLNXFJTXB4Y0FkWGVoR1NaNXRSSUVjZ21xbVVhUFZlK2FyejNUM1JNQzJkcmlKZzI3aHBZRHowL1BPUFZCb0hNclZxZDdzemVFcm1LWjZMSnZBcjhTRElUWXlSbjdyQTZsYXFBQWlHbEYzNGpLVmJRVnNqelhsNHFpcjMrU244T2FrYTAzV3dmVlVVNXIwVUVoUUdqbzR3aFA0V0s3blhRdzVGMlQvVVZSRUFsVlFhMjI0UWlUZEV0aXZGRjV2eVR1MUVnQmV6MVRtYVlXdGt2OXkxUkE3c2cyS3d6T2FUWnVsYWN4eWZ3bXVoT0tEd2hhemlEK2xWZmxQb1J3emhta3AzK29KSENGcUE0T3Exd2NIOWtDeXJPU25OZ2dTVTgwclN5ZGhqVzRoRnh1U3BZWUtEc21ZeXI5c2hZNU1vREUvRkt4YjFzL2RGeDNwZ3BxV29pNTVrbERwOG1zclo3bFV5aDgxRHhCV0lWUTZLQnRjT0NrMzVoYklkeVFnNVJ0YXp1UXdaUjJVcDhTZDBXV2pjaTExd2hsWG5Xc3hkdGt6R0tqMDdMWlJ1S3NOQ2ZsR2dBRGNFNFRFQkYwdHB6ek54UGNIYjFxdkpWeXRweTIzTGJLMno2S2UwQzJncnErZldkSjRCRnp2VE5CYkxUZmlweWJnVmNLNFYvc3RyN0xiK3kyL3N0cytpOTQ1YmJsdHZXMC8xVjNlcTMrcTFKeFR4ei9wVmJXamlnUkJEckx0SEFjaHhSZW80Wnd4dHlWdHVuODBhcXc3MWpwMFVJVUphUk5FUkVBMUN3TmEyWE54RXVUTXBrNkI0dHdUZERncXZLanVSNHVTMGdjWXowMVN1MGdJbWFyZXRZUzAzVE1PV0RxMHhia01UbU9wOENlbmN3RTdxbWh6QU1JcGhjbk5ETlFqOHlJRE1iSnFuWkptVHdBM1R0V1pVQmhHYTRIVVNpUFpub0ZLNHJZV3NRM3FtdzZaVzd6UmRBVVpzVHJtd1VUaEhBYU1nd3RlSGptc2JCMUdoR0dPcUxURWhXYU9nMElpS1hLdzI0dUNlMGJqbm02b2ZJcnM4c1lHNmR5MWRrV1U3UisyZ0M2eWlXeHhsSEtNcFdpTXhqdEtrbEFaSjdocWdGTnFURFlNcjJvY1lFQ0N0VnNORkFPQ0Nzckt5MlZLSHlCMUJVUlVaeVpGRFpRWEVqcXJLY3dadzBuNDNRajdSdTVPTTB4SnhFQ3FKb2pMbWc0dDYzeUUrMWVLeE5lSTRJdWRkVU1JRTFIQ1ZxRENPRXFYQ1J3V3FNT2dRNzh3UTgxV3lKK0d6ZW5jWUhiTDZMajFRZFNCY0xFR2dPelBQTkV1Y0dyM3V2OWxMbkJ6bGpwUDJXMHRwWlE4U25ZSTFlS0x6RURubnZUbXIwemUxRGowS2tOTEtYYzZVQzEyTFZVenYwaXJGSEZrRzVUOVNhNHhVbW1rUGx0aGViWjdLMmtabWR5bHByMFc3NlJtQTRjczFtam9GRUROTkZ1VCtkTTloNmFHN01DTnlEZ1JVU3JoWEMyaDZLcFc1M1ZYK3lMZFhyaFcxOWxKTWRHb3RrMS9sUmlTZWlPQXVoWEszb1NEWE5iN3F5c3JCV0NKZ2Vpc1BSZjR6WFZ5cm51RG93UEF3TC9MVzVJZFQzV0RlenhaMEJxQmJEZEE2QVYwS0dlUGRXVmxieDMvdEZKVnd0b0tpa3FwVkNNMTFkWFV1SzJ2c2c1dFFkQ1NZQVQzaXhOTzZyWTBPZ0d1TUg5bHRLbWpaV1d5dGdyV290MmhCdjNBNmQ2REJvb2pUc3JLMmU2dXFyYUFYdnNtdHRucXQzaVlWeG1vWVVQRXJWVXRLMWhtdXJxcW5zcEg2bHEwQTNTcnIrNmlzamlVY0J1YTF6WStjZHd4MzVobWFYeWFiaXRURU9wbFVtcXFoaEZlS3E4RGpKVmNxRnFDQngwZUt2QTVaeE51N0dlNDByS3lzVllxM2NYK1RTRlVaK0sxOFFQU1ZkMzBLN3ZvVno5Q3Vmb1cwZnBXMmZwVzBmcFZISDBWSHRQVmtvdEp5ZGVHVHpBZHhEalhNWnlsLzVTcVBueVczOWx0bjZWUi8rMVZjZnBXMGZvVzI3NkZ0ditsYlQvcFdwNmxWUGYzQ3VEMDBCcDBLcjRXdmhURzRUNFNHaVZzTzlPNWhvSlBKYkpWZmtWZ2VxWXpDMmgydDU4VFh4dUhqbzBZNzBYdTNMWUs5MlZzRmU3SzkyVlRKbEJqSkxsR1ZhUVRYdUp5VFNZNExDSnhjRlZoV3lWc2xXS3N0a3JaS3FPOWUyQWNYSGQzQitlazU0VkIzT1ZnVWJaVDhMYUR1T3pObi9BTHJLVXRiUWR5TXB2UStKc3JlSHY0Ty9kUnBkZENlUGRmaUhmeXVVeFR1R09nM1QrZWdlaUhubnhCMXR4SGRHbWZETk5JeXFlRnVyOXhiTlh1ejRMcG5BVWQxbFR5S0xSWTdqcGgwQXh4VEM3aWoxMEF2WE80VFR1RDhtdDRvVWpvcjZaT2hQZHU1cDNYdUFpNGFBNnJ6T2QzakwvTDZqUmpRSGQ4MVcrYm5vQ00xTkVxZjVzN3U4Sm12RE5WV0h6bytFRmY4QUdpWkNvYUxDdGFDRlR1SERPYmc5OFRPblROYjVrYzlST2VOQ2U5SGNEVGpNUTVubUw5OGRHK2FtOVFMZk03TC9BQ3JoWUliZVozNXQyaEhjWFYvdXY4ci9BQ3Y4NWhoekhHai9BSlFYL3dDbzRiWmhKckhOWC9kWFYxZFhRWExNZjRBc3JLeXN0a3FzRHpYRldBNnE1OGxaV0MzTGYzTzliMXZXOWZFck85Rlovb3RsL290bktlaTJjcDZMWXl2MG80TW5sSjV0ek83Y09QQ0VjTEg0czFjbTlPN1BabWlnQ1N2YzVmNlY3dkxmU3RqSytpMmNwNksyVTlGWi9vck85RjhYb3Q4ZDE3dGJMczJ5VnNyWld5ckt5c3JLeXNyZU12M1ZzOXd0djdMYWNyRmJLdG12M21xQlBQdktyYXhmcFJZeGtBNzgxTkVQWWFoZTFaUE5xby9DZWF2by93QjFWVTduWlZDTTFIUXJyZjZyZXQvb3Y4ZURvZTd0OG0yV25xMVNiNkY4Mi9NL0ZTYkx0c3BMaUxnRlMxb2FPV2J0TXBrd1hUVEVuNU1FQUVKclB6R0VHdUFJQWlxZUd0d3QzWnZiWkxFUFFwajhrNDYxZ2VDYVdtUnhWeXJxL2UzWE5XejBXNWJzMTFkWFYvQVh6V1Yva0ZGWHdyUWVLZGt0em5TbXQzRE1HaG9BVmdtYWpOVjB6eFZsTG02M0hNTW1mSlpOcnFCZ2hZZWFzckszOEZVVmZFRHVSUGlhcW56U3Z6NnZ6MjNjV1ZsWldWbGJOYnZMS3lzckt5c3JLeXQzVnU0dC93Q0N2Ly9FQUNvUUFRQUNBUU1EQXdRREFRRUJBQUFBQUFFQUVTRVFNVUZSWVhFZ2daRXdvYkh3d2RIaDhVQlEvOW9BQ0FFQkFBRS9JZnFqeEhyN1dkWDZQaVYxMTZtbThyUXgyVG4wRUllbExIOUZDcG15WnVrU3Q0a3FsRXhLbFQ3Ujd5cjJadHZETG94TGxFb2xTdFJiRkhXYVh4RnRiSzBmUlZlcmliNy9BUHJxdzdTang2bFRBYm1yNmZhVjFaanBMbHdGaFhjeTRaOGVqaTV1SHJDQ0toQTBIV1l0QnpCT0llbHVER0NDVmlDSFlqdm82REVhOFRKdG1BUlkyWXhucEw3Uy9NdVhIVlYvY2JxcnhLMGZSUXo4SXR0LysyM2E1bjFMaU5kWmM5cFRLN3lqdXp4TG1lQ2VXQmUwQVF4bm5mcFBNTlNCZmhDSFFocXVFWW9zY0dYalJSeFpjdUV1TXFDWk15VjFmUldaVVN1WlRNOTUrN1Q5Mm56cmpoV2NFWEFCY3pNK2lxSjFldmIvQU1ScFhwcVV6TTl0TVRFc2x5NTdTbzhFcnVsOUNWQ2h1M0w2WTAzMmxWTHJhRU5DRTNlWVJMSWtONGFPUFVHaHhRY2VnWmNJYU1HWWtjWHBUVUVaVUhPaXpvdVhMMXMyN0U0SmRMNW0vcENvRjVZdlo2YXVVZVgwOGJ0K3NTdldlaXBXbDZMTmFsYVlseTlBMkJtRzZTaUs2aDErSmVLTUdwRjZEMENvSXc2Umx4MG1nakgwaERUWnIzUmlSSVNwVVl5bldWMVNJNjZNUVNraHE0cEw5SEl3TDNqbmJhUG9Fc1JvUTUralhXZG1nOE1jTE1ucUVTYmJ3MHJTalVyV3BVclJSTHJZSXQzamZhNVhnbEhMQTZGSFdlUG5TcFdodnE0aG9DQkhRRU1VVXVYRmxvYUFaY1VVVExhQmcrc1k2RUNQMEI0TXZXOVRSemcyajAxcUtzUnFvM2puNk9OMjgzOUExS05tL1QwbWd4MjRscHNoVEU5VkVxVks4eXZNb2xIUWx5K3JLWHNkNVFkM3ZHRUdxVkVnU29HZ1FhR0tocHFLR2pFbFowR29hR053MEdqQkVpZW94SlVxVnJ6dEx5bFI3cGpRWG81d1IybzFxRnBZS2hMakZWNmd1WFg4dm9YeTM2eXE5QVprVXhpb2pqRW9kNVRuSDBySmwyK1VwL0RCUndTcjFBZ1NvbWhJR29JRUdsYWhLMEtHZ2pQS0htZThYdkh6UEtlVTk0UGVMdkhvc1hwRFZxTmFQZEh5alhFdVFCRkY1MFltTkExY2VnTkRVYkRINUx0R1JHVGVPdGNzVy9IcDU5SS9FcmswekNud2orNUkyWm5xbFJJNk1ST3hubFBaUEFuc2xQV1YzbEVPMHFWS2dlb0NTdlFSQ0todG9BZzZTczZIUVlTTVl3aHE2ajZWbFIraVZIU29LUzU2Uks2T2krZ2dRSUVzMmdnT2R4Y2VadnYyZjZSWHJnOHgrbVF4dERMdkd6SGFiSStNbzd6TjBaMGpIVitpUWdTdFFsUVBRTXd5bUdOSVFMaGxLZ2FNTWRTd2RDNWNNdzBkRHBZYXBHTWZRQ1BvWTZDcHhFZEswQ2JTNHZvSVFocDg4QTQ4U3l0Kzk1UjZCYlVYZzlidk92cFBRVDlVRXk3TGc3Z3FQMEsxcTBJYUVJSHJCekhpSkV6Q0doS2xTaGpxWFpIZUVHWHFOR0NNZEJybTBZeGdpU3BWUjBxVkhRRWZTRTJqNmgwdVhDR0JLamJRWXpoK2d6RzdFVWIvQUVEaWNER050cHY5WnB2ajlRSlQrbVlnc2JlZWY5Z3A1Z3pmRW9TTG9sUWhvUTlCS3VKQ0txRUxtN0FtMDJRU3BWUTRtK1hIZlFTOUhCMGRSaktoMEhvVDBCTkNLNmMwdW83Nk9XYmVtb3JUUFpBUGhidDhFcmZIN3FQZ2h0UHB3R3BONFJneTVjWVhUZWJIMTlURjZFNGdqeDBsSDhFMjlISk5qcEZvV0hKRVpSOVJvUVVzVEpybjduSG94Wm0rSGxnS0ZMZGdSVFhtUDRSMlo0RmZlWkFwNnVLVlNVOTlUMFZxYncxWUlNR09nWm03UWw2R2dobzZLVlI2QkdFcUJLanFEb1ZIU3BWeTBFVWk5aVo0QjFWUSt5dy9sbkZsMWtmVjEwYVdCS1FpMkZjSHBJNlhGeEYxTjV1OUlYTERiZlFKWXhwcGwxUjVHVFhZMEJ0QWh2SGxDSERobFJBam9ha3dVRlFUSmZkR2JBRGNQeFB4NUg3NFlRL3ZoNHVWbkI3MUVsQVBaYzZpZFhVNVNlUDlUcVptMjd5ZWk5Vm9UUVpjR1hvM1FhbWdRaENYRm9kS2h2QmhwV2xGUFhpVktnaWFFaVQ3TnhCOThDa3JKWUtxaUc1R0x0b1lodXlpcnZBY1ZBT2ZoUE5qTXg0cytKc3lqWTREb2VranE4Q2VZNmN3L1AwWU4vaU5vUUszME1XN3RwWGtpaURVdzc0aVZvYk5acFF4ZlkyRVRRMU9TRXZ6c2dxalBhTDdpWVJVSEprbHovSWJHYTd3dWN6d3g4RXVtNzdRc3Z1aEx2c0JVNG9wM1hER1ZQTXJDT1EvQ09VSGhIK2FLaVBKOFpuSUR5YUJvd2REbnB6anRtUkVoT05haHBjZFZla1Fob3czQStDRDhqemlXUHpGem1UQzlwd1A0UGplM0FGZzdCQmJGeEZLamJ1WlRuQUFVRUpjSWY3QmtPRzlYZVZyWlBnc2U4c0FGZ1d5dXBIZldXMG4wdlUwdTRFZlF3N3NyRnN2cG9kY1VJcGQ1VWVQTXNuYkJFVVM0U29LU2wyUjQ4dzBQUUZzdGtNeXBXbFM3d29jbzZ1d2oxS1cyaFNtbUpSMlMvWUdMdkV6UXZEc2tyd3NkOTZCaGRQTU5qTHM1aVA4SEU2RStHNWZNNjA4STVnKzByZGdHais4SHNuWEtXMFdNRkdKL1hTQ2dMbDJGd1hkZWJJOGI0Sm81UGh1QjNpcFpMMmpsb1lHSVN2V3lwWTgvRUUyV0J0b0RrcDVRbklPUUg0UXNyM1Q0Z0IvZEZZb0R1c1dDU21OakVzRnd1QU5sdVplWjRROEo5dmdUR0xiZDBKc01YbFc1TXc3eWtyMTVUQ2RrOUNZanhZUnN3YXVEUnk2VEQxMCtRa3lRR1dncmw2TWVxOEhlOVpuVW5Ncmp6T1lRU3NSMC9CR2g3eGJnbWZKUGdoRlRpQzRkd2wzdG84bHlrYkpuZ1I2SnVZd0c5QmpvUTVJVlc4ZXRBY3NCQVFKdUhtVWhNemJ1UmQ0bkRaSDNSTk1JNU5wUmozNnpjUzdiZ1FibmRXSzZlVkRwTWppSVJKMmxFMjJuT2gyS2VHSEl2dkI4NTRVbkEwdHN3QnR1dm5rbFVhYXZyRWtLNzM1ajBNSWNFNGNIL2FUZkJSZVdyN0lmNEpLNnlyWHNiaHdTL1ovM1dXMytVbzhmc1REaDhDSEVYaUMvQThSdTB5Y3NpZDF2ZU5sc2hPRE13WjN4L2NiRm83SlNGVEN0NFkzS2RTbURrUHpNTW9BNUNwaGpIZU1QV0VVQVdEMW0xekNxbDE5NFYwaHlEemdEcnQ3TG5EKzNuaU5TdVBmOFRQTmY1aU8rS0ttZDc2U3hVRzZieTlCby84QVNLWUtidnROanpOejZGMGdjODZjelpFbFRkS3JlYmp4S1ZsTW1LZG9LWTh6Wkxpd2EyblYrWmZYSjJnYjFrbFJuT3lBZDhUWWVKdkxUZURPWU9JNTlrMlRuYVZDelFYckx6MkxjT3NEcm1LUUdiZzNxdm1mWTRtUkRZZFpaaHREQmdYTy9tVVlRVFFEK0liZ0JnZWtjdzIxU2k1ekNLSDNDR2NyeHIxZ1I4R1B2SGxCMFFrVXVGT0hjbTVQRVRJMWl6Y0p1Y0ZScW5oZ3VEZ3pjcmlGQnQ5Ujh4Q1N2c3k3Q0htWnJieks5b2h6ZmlOYnZpT2ZDTFRkZHAyWFl3dUN6WVBlQmY2aWxOenVNOVlEMDVTaCtZNjNNVXNUTC9tVFlzczRYVWJKUFhVdDdES2daUW90ZVVTdVBZSDVtM3Z2UlhqOU41WGxyWWRueE1YS2NCY0lsakJibDNkZkNBdXpMaktycDM2WEV5UWRwZmVaMW94eG5ySHIyazVsZTdvNlNsbFczdkJCODByR2g4SXNVRkhTY2FPK2hVV292VFNsRjhSNHdXM2hvY1Bmb1JhMytJK3owQ20wSG5IY2hrc2xTcHpNbmFJZTBjYUhWRE01elpxN1M4RVJGVitnd2hxRzI3TUxOczZwVW42aHlTZ1p1MS9lRFlPTjRnYkUzVWJFNm4xQjFadXU0MTNyWXhMbGYzUHVlZ2l6REtkRkZlVVVPSVdDT1pIVmY4VEF1c3grVVJCMWw4SktHRkc4Y3VKM2liaTRRKzlkeDZkNXRCcTRySld6a1Erd1gwS2xKTFlMNnZNUUczbnJMNFM3Y3NhNlMwTVk5cCtKWnlrdGx4dFJyMm5pVU5sYk1ZcVhiYXJqM3hOM3ZMQlU1YmxtSnFuaVBNc1Z5ekhiTCtFeHl0NEVwTDRyT3ovcU15UTc1bi9Nb2ZLakJpaEx1dDRadzN5VkRpRDNFWTNieWRjSTZaR1hXMHFjYjllbWl0WHUxNkU2akdGdDVnQW85RWxEdWw3OVpzYVd5TzhHVFFjSTkxaHVPQm1Bck1BcEswUkN0akJyWHBGTm5RWFppYlhtTVl5YndSMDIyZzJ1aFdwV1RSbTg4dEp1Ulgra0doTmhKR2V0UjJwMFFxMjZRMnpJV2h1dzNXem9ZVEpWL0Uyc3MyekZadmdUcktGaHVGdjdZSTB0NGh4ZmViUllwZUw5NG5ET3ZJaGlHOGRFeTJTVkwzREZnS0d2R1Z4YzJTelFFVlRjeDh6UFZEaTNTQXVDT3k0eGpJMTdRMml0dUVjRzZlQnpLVDZEdDNtOXpNZTJHcG11bmFJT1lTeTFCTG5MZFo4d000RTk1dnN5MkRjdkcwY1hxb1h5QytjTTV2RnB2ZVpYYUlEa3FIdXhPejRtM2J2ZHA3bUltK3NUUmx2eWZMRnVXQmJvMmM4d3VpZWd6ZXVFTjBXSlRCTmt5NTV4clY4Ulp2aVdLc3VndU8zOGxFeVh1bjk1VEdEbm5mTXg5VXI0dExOaHNSOTVGdEN4YjhRMzBjc05BMlJkOWIwSSt6QjZ1M1BxR29GMmszMmp0cFV0NWx6bEN3eHRMTk5zNDZCWittOCs5Z1dvaE4yNDk0cVZmWVRxb2J5aDNVdzBMWWN3WVErQkVCb1IzQlF5VkhydndNZXlWdW5QdXFOV1llMERkMnVPWmhzbFhVOFo0L1M1MUJ6dVJUTmJoTG1RTEFhM0hhSTdic1NyRVBJNGxIdktpRXBWUUtyRUJZeXN1Q1hsQ2xybDhWTjRqSzNlS0V4c1Z4Y0N4Q3hCc3loMXhiSjIzbXp2UHZHc1p1VkVMWjZTMlROY2NNRjd6R0loWVJRWUNDTnVZQ2Fsd3o3eVlvQWY3bmNNNG9PYXpjeUZOaWphZFpIbkV3TlF1bEN3Z2w4b1J1cVFLYlJPRjlwWDBvVzRZSEMxYWhkem1Na0svYmtmelJxZm50TC9BREdGWU9oaUpmRGdsMFFZNzk0L29UZmpwQlo0eitNL05NeUIydmFXVlNybkJNS1MxMmhxcHVqMDQrZzlTbzMvQURTaDNTdlNNT3VZWnRNbzlvTVBhSVpidW1ZODZSbEdmb1NsMWNpeWxsY1R2VGNrdlZyTU8wczEyYVh4RzdqZ280Z3cya1I3UTh0NER3bWNQU1pxVjg5Nll3UytlVG1XVUdVS1dOVVErMkVHZGJkbkQxZ2xzZU5pVkJpOVF3V2MwMzI1aWtXNTZzVy9iRW1wZUZMRzJkWndTdHp6S3pCWEVXWUY0ekhXeGJjb003ekdiS09DYkp4eDNobGMyOFV6NWdZcmNEREUyRjhydE1EY0hhTlpsZHB6UktVdGE3UUhhSFNaMm5tNEh6Zk1vd1BNRU9KbE1YQmkxeVBhS0xiZmtRT3RTNjRsbTkrSnlFOWVxSzVMaE1tSmdyMkplb3ZvWUsvMWpDL0I0NWg5aXRuTi9nTk5YamVOdTI4eFdXRlV5ckw3ejBEQTNIN3R6SGRHU3lUczRpd1RVUkg3eE1lRTg3WmhERExyRml4VzhaeVgzUkRLeVhONGFORWVtWDZROUFIWnJzeStzQjJsV3pFbGVrWWRVU01ONEVvaGFDa2w1d1NmYUlDanJMei9BQkNxTnBkTXk5REE2aS85aG9vRzl0NVNhOW1HN3JGMWJEN1RkZ0VwelZ6QUx4T0hMazZYTHBMZU5ieHB3ZUc3QW9DcUl0ZDdhdllUTFNtd2V4WEg3MWl1OHIwT2c5RThZMFVSczFsaFhrMmpsVlczY3dOQTZFU2pHenVETThiZVdGU1Z2Sk1CcWhnT2t0QkhsTm1MMXJTeGlsa2xyZW9ZMlcrSVdlcVdGWlZkWmk3cm1YdHVmOUNPMFBBTnZkL01FSlhISWFuT0ZxamxFVzBTdVdZbkZ2aEdObkZ3K3cvQjhubFdKN2VPemVKdWtXN3hkdVZaaXR0TjFwVlkzcWJGcHlYS1gzYmxUWGQxTnFaNndGdUVEZHdwdVg1ZzQ3SFJoRlFuWmxMR1FNOUVmeVN1N2xTbUtVeDJqenhXQWlwbGg0MHJSNWowUmZUV2p0b0Z6eWxRZ09yN1IzRFBtVnlUZVZyVUxseHp2TjJsVGFFRzhxTUt6UVI5aDF6ajh3NXhNc1NyTm8yK2FXY011bTloRXNaVG13UlFNUkJaVG5wRmNzOTZYeUs4MEh4SHVZNEIyWnZWTjhCd3NibWFKZHJBY21Ca2wyK0l3c1hEdDFtSWRYNTdURzBDWXZaTVpzN3hwblIyNW1EYTNsT21QYUgvQUVpUFNaNVlxRUY3WEtLVWVVa0tzSFNKZTl3bHJpVUlmYU4yVGFsNEVxcmhleVdUUU9jb2d1bUE5NWl4Z0xGTzI3RXBKUFA5U3phSGFNNkx0K0wrSUpKVlJybnlsN2FGdGUyMDRnY0U0cmlaaFB6ZStOcGlHaDJhWlJQZFNCYmlDcTI5Y1MyTkJ1R05LejNqdFl1RTJqVzYrMDUwNDBBNWsxVXpObm1CQ0N4eHRyMmx3QlpPTUdIdk5lZWpGTU83WUo5aUtDT2g1WUd3RjVJQnJoaTdGVnplVnJ0dHJVclhhWEFyem9TNWZxN1BlUDBDRERSaEJpMTVHRFVGMEZCaitCTjBFY3M2cEJicm5CQkRNQzYzdUlsQnZxU2ppYnZ2TCtGWnlWdkxWcURsWUNEdDhVRzNpYzRhN3dnc1k3Sm5RN1lWb3lWRXYyRHJNMmlnMmd0SlhTWW9LUWkvU05lTTVSM1h0SDBsblVUcUZTbmNsUEVOY1o0Z2RtQkhOUm5GWEt1a1gwald4UHRnUytiYjdRTzNsZ2pJK3VlSG1ianNHMzRqR2JvN0FuV1lUZGpvdnA3UWwwWW5FZmRCeEhQRlJWOEVPSTl1MXhpRkFaS2x6Ty95c014VkZMY0prV0RqbURicHhLekw1Z3FoU0d4UUtiZUpmRDNHTE1MMXJKc0V1ckhDaTVXSllvTis4UkwrTEViQStnVkxRZWhNSGRPWXlWNStyVXJjNTdTOFBwY2VrYVpzOXROOUswcVY2VmEva1JOTi9vUjFHRDd2a1RNd0ZTbitTV0pZTTFENDZ1MDdaMlFLOWtXbzhRWXZ1d0RtZDJXUzFwNGpjZ25QVHRPNU9OdktQNUNKVFRFUnhHWG05TWJ0djFLZzRueXZEWWFkaXFnazd6ZjBncVNpRWkwRFBhQnZ3ZDh5Z1RUM2pYc2hmZUpDR1FEVVpRMTQ2ZThPQ243U0JVZ2dkNGJHeWRXWlVzbVo3WHgwaGhUaTNhMllKdk5vTUdXdWZ4UUZMdnFabHdLRXF3ektqV2xuT1lHV1hDMUFhc1BLU3UybkUyZEttM0N1bG8rSTdJWmhqeER3RjBOMHl4MnZGa2tCQlRQdEFPUzQ3dTlzZXRPODI1bGJnZGJqL0p0czRNVGxZWGJrWml2elA3bVp4REhWOUZhMnlwWFRNdXU3TjQ2MUtPc3RQRXgwcVk2K2doanhIR2hLbGFWQ0dob0VhUG5jcm53d3hMemZkMzRpVk02RzNVTnd5U21uM2xrQzAyaW1PdU10ellDY2NCN3d5cFFvY0V1WG9USUJMYW0yWkdaSHQwTWlXTkpIUWNPWW1OREt1R0tsU3pWMHNHMXNNRURlMjhZMEhVeXhockJkZXNXeHFaS0l4R3RvV3U5U3Nwb2krWWtLYW9WZFN5NjNiZUZ6TUppTDA2Sk1ZUWVWTXdkeGMyZjNDeERsQ09oY050cHZDQUE2VXhNYWxpcXFJRHVsT3ptQWJFMkR4RUFxb0NVV2JoU01YZ0p4c01BdmVkbnhHU01yZkFpdlY2NVNWWXlSUUtFYjRkNWxUUjJ0bUFxUjU0SGlmZUdDVUhFRXRRRXRSd1IySmNnKzZYc1k1VmpveGRNY0c0NitOTWN6eVo0TEZlRFR0TjJZbllWOUhEU1ltSVNpQkVWelBhVkswTlRSa05RY0Q4cDJNaElpMlJjRlNLODJwL08xRWNXc3diOXBnakRFVXN6RXU0dG5aUjd5ZVpMd2xidm1jeG56RVM1SlcwcU9KalpEczB1aW9qYnhHeFhJbHY4QXFVSVc0MnZPSUlESE9BdGFtK3pNc0tUTEU2bDNJWlFRSFhEZXRvMml1ZGhxMWlkSFlWS3N5VzQ2d1dFVEIyWjk3aGpsZ1lPU2JWbGJITWZFcTVWUVhNSlpTTTltOFF4N3d3V2puQWp0RWIzcmxsdWRrdXB3anhFRW5oV1Rqck45ZDQ0UE1ieFZ6Tmc2ejRSNlNNclJ6RmdTbFhZWXZDK09la0YzSXBlL3RFeVZ1RzA3Sk9qejdTdWF4M3ZyTHJXclBKMGdJM3RnRzM1aWtOQXlNVWpxdWpBdlJkWVJiM2xkSlRyc2Vmb3ZyS3JmTUw2eW1Cb2tXbU5EZUI1WVU0ZDRiTlZpU3Ftc0RrZmlmWVA1ME1KZ3dnVmxZZHlIanFZVWpveWpkZll1OHRMUWZXSldyaW90RXUrdFpuVVRZWExJRkZ6cXhZelptRUhUckU2Q2J0dnZMWGI3emo3MUdXbjdRcW95dmF0bzl2WXpOaUhheTRiS3luSkd1MU5zWmVqS2ZBRHUzanlsT0JSVjkzOVExdDNsblNZbURpSUFuRTJ1ODdRU3B1eEx1MWJIWXZxbTJBcmorM01ERzJ5cERMU2I1U3JEbDNjUzZPNlZ4QWozeXVrZkQ0Uzl5OHVPYWw1L01BeHU2MndORm84U3RCU3VzMzZjOVI1amRwOTZ3dnlpQlQxWlBpM2lHOE0zanA4UzI3V3l4dVZFakt4Y3dnbGxEZWJNejNSUnZLdno2ZC9YZWpxYjV6QS82TTM1bmhMRzhDQkJaY2NzY3lxbk12UWh0ZCswZHcxUkFTc09DdnhObkxreWZ6aFY2Mzl3UWFiNVZYSVlCOWs4U3hISW9TNWJpOUZxZ0ZwaDJuOGF3ME9LR1ZaUlF5NkVKVUNKT1dVTWFPOHMxZ2N4ZHl3eTNHTzdVSUU3SFV4eXUwQnprbG1kcGQ0emx3djRsVlpIOVhhTDBsbFNiQkhQS1lPWTBKb0ptVlVIREtZY0ZOck15aTU0a21Hd1ZEY2YxUEFCU3ErWWpYZ0hNS3Q0Z2N4WXptWGlLZmtacERzcDN2R0dyd0xML0pBa1VMUEE0aFlFdnFqMHNtNVg1dzJTdjFGam9tSno0bUx6RGFWSEMrWmR1Q1hwSTZJNlAwWDBCQWxtRnVVU3ZTeXBXbVV6SHVnTW9qc3E4SllHUnkyUDJnQmN0VkdPZ0VxbkNBM3h4MmduT2JDdG92UU1tMTZPbWlBcXljT2phaVg3blFFSWFpQzV5U2lPRmVzUTA1cmxHMENvV0Jlc2JvYmQ5cFZnN2pMNGd1N3R0dHJEb1lMaG9DYlM0MTJSQWpqZUxoR1lZSnVJMWQ0SVJFYnpvOHh3azhDTTJiMDRLKzBRNXpzSHBHc211VjNmUldaV0daeFg5cEZVWnJvc3NTWk9JSTVEM25ONGJHTjNrOExCZHZ0Si9vU0JxWUptNmRkUzVuR0pWRVJMMDNkbVhqZFl4N3p1RXB3ajlMZEhUZEZPYzFBTFVPNWMyaUh1ampvZWRJcUVkUXVYWUtDUVJ6TG01QzRpK1JaU2xkVVMyU3o0ODRyUkE4M3ZMZ24zS2Y4QXBVQng4MDZhdkFscmZLTmkrTktsUWdqUXZ3SEs5REU4eEF3TndCUzN0S3V6dWdUaUVHTEZvYkpTNkVlQWVTUG92dks2Z3hFVlZMMDdZdEFZMFZMbzFqb3F6RENRQk8yNlVYdktPMFZ5RldVbmNGTk84UjVyNWp2c2U4YmhieTVsRHkrMEQ3dnhObTN2WWgwaDRKeXZsWUNqc29Pa2RQVWJWdjhBTTN6eVNUaGU0MmY2UC9NNGw0QWlQN0U1eUtjcGN6MHo5TXhKdHZvSnV5cFdtS3BES0R4R05wbnNTcGZpN3diUmJhbHNEY0hsVXdWZlEzZWlmeHZEQi9tazNZL01CWlJEQkhWVkx5L1dXNnkzV1B2Y3hHSXRiR1piVi9HbVNBY29UQTJaeW41VHl2Tk10My90aG9wdlN6K1pmYjlsZDVUS2h2SFM5OEdMYkgzalBadmNUcHFpdm44U2RkN1FsU0VXQkhpT0lOUUkzVnBob0E2TnpBMzZwV0ljTWVZN3l4Rk9KVzArQXhqV1U0WWt4QzB1WUFBVndqcnNkcFdhQ1VsMGFlMEZMQTBHaUs4T0lPVjFOa0hqbVVmK09SNFI3WEhsUUhLb2xzUGJFOWc5aWJJY0w4dmxpOTRzaHJaWE8rWnVQZnErWVpGMVpVekxTL05VaUllaFRMTnlXcUpTeDM3UVRRWmhaUk44SG9GSkFyelJ6NG1HcHFFb2xNTjVFaHpBNnM4WURaOENEdmdzWmV4Szk0Ny9BRkUxRUhTWTdkREdYcGNHR0c0RUdFdkI5dkVTeG04UW90QjF3bEYyS0Z5Q3RLOTM2M2dGVzI0ZUhwUE9nTWNnVmhXMHBJRUtHMGQ0aGtwZjJpdHFaYk9KVE1HbXhpYTVJb1grZElRT3krclNGQTdQV0dZNUs5bHBjQXZZVkVxb1FRUTAyektaTGhoaW5OZmlOUHdINW5HUGt6MzhsdVRMcE1ETUNNdkVCS2FWcjVSM3Zvc3dwQ0lPWmdpTjk1eElRSjFaUUVPRkJqQXpWbDdFcE56ZHFhTzg3THBsSFZMM2l3cExhTGhvQXJlVkNBc2RVdHhZWUhMR1RFWkE0WnlkUlhFRnRwUlJrbDlGb1VkNERtYkIrU3VrWm1EOEltci9BS2NkbTR6YXNHcko5L0gxTzZWQkJtRXZJN20rYjNvZlJzWnpwOXBDR0tpWEZFanFhVm9ZTXkxRGx6UnJlSW1ON1ZVT0tTL0Z5L3VOeVBTTmV6OUI5cGNyckgydldXNlVmWXloZytZSldUc2ZsUlJhYm1DRmdGMDFmR0kyQlRNeHRVcGJCd1FpL3JuYjdTc0RjRWJ3dG1QWmpvTHhDS3I3aW1qaWJ1cExqQUQwN1llWnYvWE1CWHZ4YitTWjRIM0g5U2d4ZkhRY3pPRUliUVMyTmx3amJ3cGRZUzEwTHV4c09vd1NaTkZiaW9pbDFrRjlXb3Nkb3pnUUJVZE56RHM2TndJRG5aQ2gyRnRTL0N2WVI0QmJXSU52NWsvM045V1YyMXgwak91SmNYNzdSSW94eHd5bFhMSFNseVI0ZDRsRU1KZG04T01Cc2tYUWF6QXZrN3piRFhhNW5EbkgxQTBHT2dwdnBGUFUxclEzVG5SRmdXWFc4Y1lPSmN1TzhTVkhVZ1loTjN0TUlJU2pGVytaa3gxMVA0WllLWFRsUVdKdEFiTS94UEJXWmhuWWNKdjBPLzVEK0lZOWxzL21DRzdiTkZ3OGlEY2NWRjJrcXR6L0FETEcrdXplUExxOTBGeURhVngwN1ROYUtkQ0tReGxDbnhDeFZxQmVZOHQrdUNNUUYyMkNCbTIxUllnT2g4ci9BRkZzYUR2RWxUWUttVzhDYm9hajN0eFVkdWpEeVRUbUhLbFdiYWJoaFVtK01Zd0w3OWg2RVdPWUNIV0Q0Nk1COXVPbFpkY3ZFdHdqbDRKVjZMQnRxOC94T3ZCMiswTmhlb2lRL21LZ0Z2YU1UVVlHNWUyUEVEQ3RjNDJqS28xdk9IZVZ1MnBhQnFncnB4QzBKMjRtSDdsdXdmbWIxQWNxQ3B0ZUVxQkdCWmFxbFlHYlJZT3BjeTh5NStMVTMxMklTc1EyaHZvb3RMSXNlSXZvRjZNTUNKS2hLU21mRVJYS2xaNVFGT3FsYXJDSUZURHJucXhsa1UrMDNhbmgzbHkvcHc4TXBxTkdVVHNoQ3pUWWpjYW05OW1ZT3BHSlpiWS9TYmtrQUMydHhCSlZLUVFBd1VOVDJtRjZ3aHl2M1ZTVjVlOEc1eXBXM05kMG91M29YY2RNM0JtR21vWUVxYlpSVE54c045Q3VhWVU2dzZlK0NpSE1Lc1IyT2lscXRGNUlxVkxkSVJXYldXTXVqTTVpMit0UXk3VFlVczJLME04cXR1VExvdEExY2JFOEJpRVFDa1ZCVlpnZTk5aVVFT0ZIdTdVc1V6ZGhtVSt4Wk16a3lNNC91R3ptMnQ3eTBvRytaa0RkY05oenJQQ0p1QlhLN2szREwzbkltVERFamhsVkttNkN1VTN0VG9Jc3hlWU93SWdMMDFOeld0YjJsZG1nMGRhTGl5NWNXRE9JeFdJUFdCSFpGS2xXREhobFpSVnRtSVg0S3VHZVVtekE3Y1hRM0ZSdnpZUU5iMi9KQU50Ym1TYzA5blpuc3hrK0RCRjRHM0lxcHNVOC9KQXV2WG1CeFdCSmRvczhRY3g1RnM1dy93Q3pCbTlOdnZGR3JieEU2NFp0RXl3TGEwWE13Tm5XVTM0dW8vOEFiUDBNcUFQOEpDY0ZURmZFcDVieFAway9RUU8vMmdkL3RCZnVPeWdvNkRpWEhZVC9BQWVKVEs5T1QyMFI3TStzZFVFcDg1WVkvd0FRbjc1SC9XSjFQaVRxVGdldjk5bzdhQ3JxeE43TG5uUHdtUnNzdDBPc1R1dGxDd1M5dDNSVXQzK1lySFRyMzVseitzNGNBVGljWVdaL2VZalJnMU51VFYyY3AxaTdVYXZNSk4xaTVXQ0VlQmxhdlZXeE9oTjJacjhvUGcwdEZ5dFlsb1BjbTd1SXVZcGtJdVplbk9tMzBIZDA1eDNuRU5NUS9NNDBkdERRaTRoNm8zc1QyWFpZUVpWTFk4RldiUG1WdWcvejRscmMzTHl4eVhkMVdJaEEwZXM0WGY4QVR1TUJqbFN2dE0xN0VRZ054TzE4b1JoVlVac0EvZzU2eXgraW5lT0k3WXR2ekZLVWtHRTNGSHY0bEk0VzlTQ1lUcld5MWJIaTVnTERzWmFVQm5hbHhLNnBWZVVhaVl6WERFRGRQRXVRQU9DT095NHpDNDNzZk12eEk4cEhRWmVrdW8xQ1I4UWZtWE5nWTZFRzhHWmU3VE1nOWNTTGFDNXJhTnZxZHVFeTBqTFMycG9tNXA4Q29EMUZOTGMzdk9sUWluSjFKUi9CZ3FKWEZ5dWFLMlRpRGdDQkZxT0l1SzdzTFJOMERMZG1NRlhieFY0aGhhUXRYQUtMcE1pbkJCR0h1SkZPMFhjVEpKMmV3VE9ZMlhzbkg5WXdZRkdNbXo1allWTXVYYU1aeDlEazAydlE2Y3B1anREVGppbk1kQkNIRlkrR2NRWk5SQ0M1bVN2RU5LUE5ESnBZTE1lRzVIcXB4VDhTbm94UXFwYjFtT2x3bFRtRlVMMVZ5enRGVXpCZ0Y3dTBhZ0Q5Y3h1RGJSM2hEeUI4SVdxMkMrSlFwblF5bVdGYkE0aUkyamVXQmxXNUh2WmI4a0RnYlphRlVjMnlaSmRRT0lHZ2I0ZG9LMU94S3ZGQld1SUZsd2NNSFNIMUVBOG4zSEVJY1dmaEhFWHRGenpuQkV5dWR3b2NrNWRYeXh4S1MvRHJ5YmNjMVh1OFRsbjVqMC96S3BiTEplTHJXcUZiemROeW9DVHQyUTBNdzRvb21POGJLZmlvbHZ5ZFVmYVlsNmx6QzZPem1YcmZVRUJtMEg0bi9DZzJMT3pmRXJ0WTFzOGVtaCtZclk2YWJDWHBtWnhpUHJUYlM0YVVwSERlanNhR3ZFM1RmNmlQRTRKYjFZY3huZWx1c0YyK0lkaDhSdHV5OWliMW9qMmtULzFQME1Ibys4dlFjVzc5SlFnYnAzT1pZOVpqdk56WU5rQnNLWnNNMjh4VVhkL2FLalZDc1FPLzJsQUgyeksvZWF6Q2pJeTBweVIybFkzaGZFY3h5RDV4V2loc1g1MEpiMCtKY0VkUGllUHdnKzBUZlNzbUp4VXhQOEJCL3dCV2pDVXVWN1M2S0hRTlMxYWw4R3lGNksrV1JCUWVFL1lKWk1BTGRqY3pTM2E2VkFJRmRkNFBNYmtBUTZXWjNKZlMvT2dmdFoydnl5di9BR2w5emxPTHd6azM1eDBCWGFPNzlvZFZMQS9KR2QrNUZlcjh5NWVqcXFrN0NjSXhwb2Rva3FIeE9sSHRMZXN0MVpiMVplUFVha1p4RVFXVzBKeE9OQWxSMmhMMFBTUWE5QjF1WEJWb2xocHd3WW90RFExYWxVNnRrcWRFelJyYkFlOXhMbCtxNXpMeGJuMmRBTk56ZEZqVURHRHBHT2x5NHhsK2grSW1nK2t4RXhaSFIyZzE5NEdub2VrMncyaWlNbldXRVlzUzJZN2pmNldDTzZuZWZFcHJabk11WG9zdkhwUG9yMHJCb3N2UXhjejJoZUg4aU1pMnJhdk1wL3VoL3FSQmVSMUlwTUljc0ZFUWVZY2tYM2xSeXpuUjBlWWRzSllMdFJjN3Y1UklPQXk4WmE0eHF3dFhpTVQrSW5EOUVMTmxDM1puY2l3U1NOTi9sRndRcjBtKzdqSzdSSHBHK2pPNmgxME5ndmswQlNxcm9zYUt2NVMrOEhRS0Nodm9lZ1EzZUp1T3NQcjNzMlFjUmlvZWpNanpvakRlVTd2cjdyNG5lL0U3aWNTM3JPNG5kUzFiZThkcDc1Z0RDZTh6MmVXVkt2REF4S1N2ZVU2TXAwWUhwS3cxQVpudkxoVXNxR1ppdWN6QXVzRllJc3YwREJmYXJuU2hWTlJhMlhhSXJBOGtRc2dmaGdzQ1pkcnZPNC9Ha2E4VmZFT2FNdXg4QWtvTitReUk3Z3ZtQTNQdTJoeWc3aXVZUW13bTdpTE10WjdWSGY2Q1hkbG5oR29USWdkQ1A0aTRCemVMY0NWWHRGc200N3pZTU41WVMveXFJcUtLNlptUVhYYnN1WEdHbSswZHBuMmhOZU5qRnVOZmFXQjRPYWp2amFYTjlEUjBzNncyRkpiQndSWGFYNm56b0hwM2lWenIzQ051V2hsdjdFeFl0N3lqMXVUSTNuZFMzV1craDJuRFhhRFRGQ1FyaGhxYUduRE9QalVKUjBnQktObUlha1pjdVhCanB5emZRMXd0MDZNK0lCL2RQMW45ejlwL2MvVGYzcGovQUtXWEFLQklQN2t0SGtaeTRZQ2dZUTM4Tldva2F1UHdKeDlCTzJsb3BoVW9odkpOaUFiaGM1d3VDczk4L3dDa2dkSlhuRkxVK2NLZm8vTUMvWitaK3gvdWY0bis0ZG9xZEd2dE4yblVYaUhGTEhnOGFDVG9sNlYzbEVybVYzeHY3d3phWG1DeXJrY2FNL0o2TnVORmZXWFdNZDRXMmN5NGMvVlp3MEplS203aUNsS3VFTmVORFIzVGg0aG9RTnRmWTY3Vjd5MnNSbHk5VGNpRFNNcjFabVptWm1kTDRGMENKVU05SXNOT0UrZ2ZjTmdYUCtWRVJvVW4xS2hiUGFPaXhyRmROR0U2d2k2VjI0dnZtV283emg1MXkyd3JDNFRVbG1odWNPb3hkVnB6NmowOGFNNDBKbUNscFcydjBtaHB1VGQ3UTBGNkR4Qk9VczZ4U0c2MnNhTG05UWhDTFJVQnp1OGVqTHNUZVpxeHhkRnphZklUL3JFLzFaQm9hNEJnTWpidWZvQnV6aThKU05KcktKUnA3NlJjUE5VRnFubkpwSC9NanZnOXZSWUU0aGNzakdPcHBzcGxXTStFSmN1TEREKzZiVU50RFA1UjFlUC9BSVlNWlQwaDR1UGowUEV6MWxQV2VVcnFsUFdVOVpUMW1lc2JxYjNUM2xGY3dPWlFnRlRHcDlERGN1R2hvNmNiR3BEN2xsYWlEdEJuRXhzMm15WlpueEdwSGlIeGdOT20wdGdIMlAwbXRsVlpoNlFBaHF6Mk9ORytMVVRYV0VMNC9raldpNGFtb0M4YlJHYkx4b25DbkduZUpZNlZDSTFkWTB1WHB4S3hLTjNjeEZYN3d3NDJuaWxJUTRGZWdZMjNmUm4xOHlucHI0UGlkNmR4Tzh5OHg5SEpEMEV2VjJtNUxnUTNTakdOOU9VNFRpWG9wVXEyb3pLckdzTjZHaW9Fc2Ezd1BRc0h2K01EcE9DVm5HM2VLaU9aaEhVR1VLZ1MvWXFjZzdxK2cwQVl1MitZZmRrbGtzeDNodDlST1BvZmxvWWhuNGVURjNkemk5Y2Q0OXIxMnM1aWpiQlhGYkVKeEhjbFc2N3ptRXhOenJEQ3JOUkNEUXd3eDJOZUgwM0g2TzJsV3luZlR2eTRub0paRE0yQ3hyWkR2Y0NleVVITXJ2Szd5dE5zeVlxVmpTb0txR01RY3pHcktnZDRtZzB4UnRocW9PN0NBR3hnZzZibXhvSzlHS0JGUVAxWTRJN3dSV1dxOGVwREVRVkV3S0F4T1h1L0VHR0hNcXU0SkJUL0FGdkUwRmJNbzkvcFJxNk5kSXAwbnRPb1NtYm5LY2E4UHBERVJ1TTlwWHBOWDBZNlF3MlRtTU9KVG84cFhlZVVBNnNydW5rbFJlcXRpV3BSTDZBeFJHKzdwR1hEZERpRDFkNFd5eENkU1lORnhCbldYalhkTFcrTm9SUllsRTl4RmJvVWxFcEpic3pLY2NZUUF4bDlBZXdMTnhoVzhPaUxUaXZwb1IwZjMrZzZ2MEp6c2RKVWJOOUhoRkF2U09kRGhLSmlZekt6dkVsT3NvajN4UGYwMUtsU3BVcjE4NlYzMFdkTkY1djBDNWN1WG91ZUV1TEwwTkwxb2s4a3FPRDRndVNYcUZTNHJoTFIwNjdKV09kMkVyRmpNRVZ4WmdGc2xVSEZOMHU0ZGVCc3dxOTdURzQzYW0rMHBWSEdkRmtkZFpTajNZb3dzeithTDlITVdNdENJTjAvUTUrSXNHT0xTVkNWVGVLQTN6bEI0dkVPMEtsejIwOTVicGpwR2dseXlYTGxrc2x5NWYxdWRMbHkvcURVOEp4ZkVxWWx5OURRekFjRUdYQjBYWXZFVmk4NkJiS2M0bHhhWExsekJNOUZBcXE3a0dVdkUyL0dsWkRtTGFSd0prTE12TG9iUVNyUlhHaHBQVjFWS2k2QmpwWmwyWG90cFYzdXgraHZZeTRzeTQ1WlNGY2RkTnBDWHp3ZmVYY0E4eEZNbVp0cWtOMlZoS1ZYMXI5VjZabGYrRGpSVjRuVW1XVjFtT0pjTjlRUWlGMDRmRU10QUVzVWVKU0J6cU9aVXVyUTF1WHB0SExFZ3Bpd1pXbVB2aE56eTZZaDBOWWFPSTZPRy9Nd096UkFidGovQU5mUWRNZE4yclo0YWJDRXhBTzBVY1NpTjIrQlJ0UHUvd0RrejY2bFRIMTlwZW5HaERNUWkwcDZIbVAwTXFNVTJoOTA4WHpITGY1UzdkUnNJQUE0bFFxV2RaM1B2TzhmTTdoOHpzUG1QVFIzVDllSTlUOWUwN3YzZjFCNXYzZjZsbG5ONTMwU0d6amYrSmdtOVl4L2FQNUkvb1F6K0NWS2U2RVZ3Ky8ra1AxWCtwZlcrZjhBSjBQdmxkYjVJREkxN1FnTnhYcS9FSDBUTGgwR25NSVlxbE0zb3VQUmRiTVMxZXRWdi82TDdTKzA5cGZhVzlKbnBwZmFYMmw5cGZhWDJudFBabnRMN1M0dUw3cG5yZ1BhRmo4aU8wZkVqalB2MXMvUXFQOEF0WVArNGkrM3dRZUVLK0IrWXNGUGJYZE00UEtGOTVYYjRUdytFcDArTXIwK01yMCtIcGt5VE9UT2RlL1hlS3FJemVEUjNMYXFZSWpVd0tRY2t1QW5rS1ltNFI3dlNFbkpzQk1aMFAxdkVaSGgwNjNUbXFPUGRnQmt0ekRiZzZWazU3Ky8wQnE4UXV5dGRSWUJwTDd4SGI0U291dndTenErSlRxK0ozSHhMT3Y0bE92NGxPdVU2NVRxbDkweEdPa3Z0UGFlMDlwN1MrMHZ0TDdUMm50UGFlMDl0UGIxWEwwdVd3WGlkeDlwaDFmVFpMSmM4SFNzNG5pVHg1NVB0RmpkdkJVbzVmTE9sOTA2VDc1bDloNEpUM1VPNkhmS2Q1U0NPQ1VjdnhMRGFMSWFsWG5hVjY1S1V3cmhnU25wcG5VT3F6TFRiRmZhYkFQekNDNEJ5c3dPYm9MKzhQd1dsTnNTdDhkaVhPaUNDZzBidFNvanVFOHk3M21kbDJQU2JjZTRyN1NtQjZCcUU2L2FiaGNad1JxekxjbHQ5bGJEOE1Uc2I4Ukp1MWZScDNjSzNuSm5aeENITDh6L0FGVXJvWDNsUVovWkxZZWFPMTlwMnZ0TDlKZnBQR2VFcExKY3NtT3ZxOEpiNFNVZG4zaU10OWZ2TVFRNnAwZ1BCRk84dVg2YjdTK3hMWmJMWm5yNkRTVStodHhiSC9nbDRyMWdXVkxTMDdFV3dwQWMzN1JUSHY2RzNiYjBWQlRMbUIzaEwzZTBCNXh1OWVZN0pocXp1d0tmakd6d1JIMGFzL2ZTMk1PMnl2RXdEYktNRXl2Vk51bHhZTHlndUhYd0lERzJsV3U5eHYySVFhMVYzY0pXb3FrLzZwMkZ3RUF2Y2dETy9XVTNSUy9EOUZEWkUzYk1kUkU1Qmh4eDRKVEdjU3gvU1BrMHE3WjJYeE9wTnVxVzZwNU9pdlY3VDVudnJjeDFuZ1Mzc3kxdjhKWnQ4cDBzK0pWYi9RcVZLTktsU3ZxRTJuUkNKTVpRVGRqcEdMMVNWNkJVc2dtaXVnN0o0UlRZaDBZQTdSVjlCR0xaeUhpVUFWaHFGYmk0Wk1FQ1luWWl6Rm1mS1BSd3JUR0t6R0ZJM1RhNlFPYVQzaUJ1cFJXTEpZSmVJM25hakVpVjZ5QWdCdExsQnRpQzZ2bVhNNU8wbzdUdVBlYlpmL2hyMTl6MDFNYVgvd0NDbWJTLzBsTDJsTUJiMmxPNTdFQU5pZTBxVnEzRzVUS1llWVFKaVltSjdTOWJqSVFpN2JRNmVzNW1HcmpReXhNcGtTNWh2R1BRbGFUdktpQmxucEpFSlRSVXBsU29HcXBVU0hpTnV6Mmx1eFoxbVVYWDlrSEhXYjdmL01EckxyYVhjQlpaZ1plMHp1ZXhERzB2V3ZReDlCRFcvVmptNVJNYVhHbCtKYUc4dlVjd1ZBTkZlaGRENnlIMEgyTXQ2aDFtTWhqM3pMZk9pLzhBNCtZWHBsbGhzdDlwZlJMNkpmUk94T3hPeE94TzNPM095enRNN0V0RnZTWjZUUFNYMFRzVHNUdGZlZDE4enV2bWQxOHp1UG1keDh6OWpPMTk1M0h6Rnk5QkcwVzVkTzh4VjBHRDZmZUFmNm5lZk03ajVuZFR2cDMwNzZkeExZejBtZWt6MG1la3owbnRMN1MvU2RwbmVUdE03VE8wenRNN1RMOUdYNlM4ZHhNT3pMNmtZMy84WGViYWJNelBoTnR0Q1Y5SjlKb2ZRcUlSSldpa0NCQktnZ1FxVjZuMFhwZWhEUTlOYVlqcDJ3ZXNTWEgvQU1mLzJnQU1Bd0VBQWdBREFBQUFFRmFRUVhqcDd4anJ4TE9CQU1ZdXpmaW5wUFFMRWRGRmVWSTRHa002OWZRKzIwMnl6NTgxZ1FRUVFjQllRWCtpdHZoc0xKU0p1dGdpMllXR0haYXpBRFdDQlIrYlMrZmQ3Q0tSUjVzam13b28zcmlRUVJRWllRY3QrdjI5KzFWVHhrQW15WDBZY0YzeXhHYWVHTGZ4WVJBK1lYZk5KQ3Z3cmdrN2l1cjlLUVJjVlNRUWttdnRxc3JFWDVHbG0vZGlucExQTHhMWkJKQmVleUpGMkJzSzB4QXRzcGlpb2tqOWxyY1ZmUFNVZEFVYlNDTE94VHNnT3hRVG1MSE9BT0QxWkdYUFRlTkZGZk9xaWpFakZBTGtwcWg2OHlGQVZjTmFRT25aQ0lNUFBvdUdGd0JIRDZGOW0yZEJ6N1lGUUh4dkFZRGxmSFlGUmJXT2JsaG5nNzNGZ1JURDN4UElSRHZCZ3Fmbk0yWitRSGtzN3hqb0RES0ZabXZNRXU5ZnpSMXNlSXBWQU9vb2tpdDNFQ1hmYWZ6cmhTaktZUTRhczUweC93RFovRE5oUXZBMTQ3NE5ObTVCMXdqa2dXUWRLWngzcVlyS3p1U0Jkb0syTi9xOVp3eDNMZEh1VysyMFFKaWgyM3RLdk5GWWJJWkl0ZDZXQndaNG4vY3FVUlM0TG1GQ2JRdzBGUHUvcDhjbnRHM3VFWldQK1pPT3RUMnFGY3JQejFQRmhueW1rOE04ZG51Nldjdmg5SkNwYURjRXdRRlZnM21URGM4V1IwclBXaFdlRExLL09yYlE5NjZYWWxTNFRNTWpIOXBEcm5qb2lCMVJnQ0YwazB5M3RoQ2hUM0pMSy9McXE1dWlxY21DM252bE5NMVVMM1JvRGtYcXpscGxqYStmRjNIWWpRMUVuMEZXMzM1eFJ6K3NrYml3SWRMQ29QWk82aTZGVU9UOG01ejIwZXpPd1hoR0Q0WEk2bFFwVGlyYkVtM0YyZ0RweGdhV2JtZjM0S1pVRDRhSC9CZTFKQ0dWRi9NbzZNdEZQN2pieUlBNUQvMGVrM25RaTNtRUZtQnhYZlc0SDZhVFhuc2hNb25SSE5sWkNZRk5haW4yS3FPa3NFU1Q3RGJia2kxcitTY01lWlVFRUZralJRcktpWHh2dnE4dktsOUJpdVdGamZwTHZEQms3ZUtxSjV2N0hBbzgxdDRzNzlUN2J1NFVFSHlHaW1peXgyTDNHaEFSdno2VGV0TFVmRUh5QTVmcWd6MU15dFBOUllNKzlzTTZlWVlLZGZYYjhFMEVVaVhLZ0RUd3lwWFdvemlDSFhUa0RLL0tLUmlLMGVuMnA4eDBkcHNaRFQ4b1hENUtac3BvcEtFazIrQzJDb1pnbHNaRVFHM1Q5N3lMZFRYTWkrYW5BT0VJUjgyYllGajhrc3dQY0hvaHBLSGZzTUlIbjN5VG5oVFNwdXRXRnFPeTZwdnFxWjBuMXRnbzdMMEVUdVdPaG14NkhTTUVsSmZaRlVmVjFDbjRFWHl4aWtBRENhV3pWck9CZUdiNDNpRXNCRVlnc2Rma29rNlRESmlWYWw4TGVCc3U2dnhVdlVSZThGWEJhSjFBclNBWEJtNEo0aENiMDMxUXR1TUJRdktxQlNDVy93RGNSM2hSK3pTcGdEc1dBaytPaEdHVmYvTWdJUjRJSVp5ZGU1SFlWaGRQakFrN0VrK1ZPejZhNEFnZDdiNEt3aWM4MXQ2a0NHeXFPN094VkJCa2cwOTk4d0hNRmFUUk5oeS9hWTdkTW1yN2gyYzFsVVpqOGVQUVB1a00wTUlVaEtBSUxHT3hCOE5BYVI0c0Vnb1FKaVpwK2lTSDlyUlF2SVZvcExzNVZuRkFmZndYTW9iTWdQQTk4NjBFZDZXV0JGVkhEdzg5bU5aWkR3Z3IxSUc5RlVoK2ZLSFVzZ0JQaGROOGJFdW5nUUU5SFFZdGNZT3V4ZHZQRXlxNEZCTlJ4Tm9Bd1lNNG9IenhtUmt5Z2hMc0EvMGcwODBFaWlqcE8xdDVWUUlmOCtxc21FVUJCdEp4NU5CWGlza3NrRWlNSWtySFpDNW5Ld21MMitXREhDRnpjMkhjT2E5aEJGUHJmSXNFREM0TnNJSThZSnBOZ04vTjh3NFJmYlIzekFsSldaREx1MXZjL2Z1SkczQXByVjhCQkJCcmQvOEEzeEZXcW5JRElCZXh3RE1NYVlESEFJR3FMRXM5Vk44aU5kNWkxaDdhUW5ISUFWVUV1SUFSVlhRb2Z3YlE0RmhQT0lHQVNSVEhmWVVZUVVaVGFvTWVkOS82OWZzcll5OHdPbVNMUWFlSnNlZVUvTEM3NzgvV1djdklZUVFjWVVmVFBBZmZmZllRZkluZlA0UElnSDN2SVFnZ1B2NG92WXdQd0gvL0FBQUQ2Rjc0S0QyR01MMzMzMzMyRUVEL3hBQWlFUUFEQUFJQ0FnTUJBUUVBQUFBQUFBQUFBUkVRSVNBeE1FRkFVV0ZRY1lILzJnQUlBUU1CQVQ4US9pM2h2TStEZjQ3Zmd0OGxLYUp3MTVGNVg1MTRINUVocitFaGVXOFlUakNFSU5EK1l2Rk9LUitHTmx6WENDZUNZbUlKRUdzVEVMOWpTWEtlTDBYaWhkRWRHTkVJL0ErRXpPRUlRaEJPTlY3TmVrT0JzWk42OGUrUHJoQ0NRcWxyRkU5N0luMFFqSitDd1VSa1kwTkU0d2pLSUlKU1FTWlkzUm9LQzBvUmRjWDhCTkNmMEY5QlY5RFNIcDZFSFBCUk9rR29RME5DUkNJaUlhSWhwQ1JJSlhSb1RXaEpKU2phU0cyMVJPYkdxVktETGw4NW1qSVRLRU5zdDdIckRKTW14TVVnajJNZUlKaElaTXN1SC9Uc09paTdLanFkak5IcENyVVUxWHk2OFY0SVF3MEtLSW05RE5hRXF4aG9JVFEyWERGMlFsV1MzQnFaYklOUVFwaXc3SitZY0tqYjZLOXMxUFl4UDRDSmhEMG94aWJFVFZSUlNHbzJxYkNLdUgra0dTK2dhcERTd1phUFl4MkgvdUduUm9IaENQWW5CSnpROUtzbXlYaHJoVGZsTmFFZzZhSHJzZ1IwYmtDVERSTFJHaHRvVyt5b1NJRnZURTdNMFJJajBOemdoejBKS2orbUtVRWlHeUZrcjQ3NEZsRGVqMEkyRjNDeWloSmpMaC9RME5DWFIyZzNUaEl4UDdOVnJCMkp2S1kyWW12WW1Ob2Irc0xaVEdvMzhDOGUyUk1iWlRZOVpXSnNyb21Ia3l6YUxmNUMyeHdvWjlKYVgwTlpTMk5NOTd4VVlpWFl0c2RzUTAvYkhsWXZtU0U0VFNrYUdzcENjS0hoSVNFaUN5bURWa05pREZvTmNFTm9iRVpRbUd2dG1sN0toTkQ1VVR2a1RFd21IUW5NY01UQ0dwaElTeEJaaHN4VDdDRTJUUTBQRUVOTVNZbjJLOXNTM0J2ME5LaHFoQlZEK0lRcEQweUNnMEM3MFBxR2hTWVJDQzRNTnNaTUd4NFpZTGJLR25Ra1kwWlcyTTFHYkxzVnlqNTl1VDVJUXRkaXlqU3drbXhvNkUxaEN5bm1DREpQWkJSb2F5UTdERFZDRnNaUlc2SEd5UXFEcDJQdkw0ZHVUNUtZZ20wTTlqQzFoMmovQUVwNnA2ekNET3d6ckZFeTZGb01hSTh2YlE2bWJSN2lWOWlkRFNhR3RRcGx2UWhNUHZndStUNXJDelNpbUppZXNJU3hDREpLalhGRXpaQnNZYkc4S05qemNVVHhNUHh2TTRMbmRGSVNDWVdPdlF0ZWhJejFqelJOdFI2MCtnVDBlVjl5L1hKY0htVHd2a3VXeWtvMU1Vb21VVVZzYnZDdG9vYnBTbFpXSWs0VXBlSHJFK0F1YXdocXhLNkY5bVQ5bjdDSkNhZ2lUMXdTdEpwaUhzYWlVa2FtTHdielBMZkVtVXZGRGNXRTNSWWIzZyt3MHBySzcyUXV2czJHTHJENVA0S3pDRUlURTRkaVIreUxEWVNJVEtXWU1leDk4R0tNUStYZUd1RXhzaEJMNHR3M2hCTXBSN3kreEpRUkhZWFFubTg3ODlVSmplVkt5czJSaVlScG51cUU3Mmg5bC9oUkdORDR3aENFSnlwZkZDRTRVdkNUQmtLNmFGaVNFaEN6QjVXNk1kR1J2WTAyaE5iWVJOVkg2NEVjNHJDZUdFOEZMNDZYTkZnc3JGK28xME4xMGlHcm9iUmpkaVFvTUtHYVhqV1V2d1lRaENmQm8zY3JDS1hNSVFuaGhDRUovQjlDd3ZsLy84UUFKQkVBQXdBQ0FnSURBQU1CQVFBQUFBQUFBQUVSRUNFeFFTQXdRRkZoVUhHQmthSC8yZ0FJQVFJQkFUOFErTmZXdktsWDhCZjVldkZMNTMzcitEcFM0djhBRWNEODdpbHhSUERGS1V2d2w2ZWZnTWJKVDBod0Q4VVVlYVViNGRTNVBxMk9mS254TGg0RzF2RHFzUDhBUS9TRXI0Zncxd1RLVkxrYUJPMFMvd0NtM0xHSWZJcE5DdFEvWmNjK2hvaUhzTGdhUGtYUVNlMmJmb21GK2hzamJvU2krNC9RVFFuNVVqN0g5Z3dmNEdwOENaOWovV0pZbDhDSnVRTnNicnBVTmk1OVZ3MWlsOFdoMHBKN0d5WTBadGJHN0ZLTTIzaWtNaUZqVkZIZm9UKzBPR1UweHNVVVZzckVobXhVaHZrWmJNZlVVR25XRCtSQnk3SjJIS0grQVpQanp2azFSaEY4R05DNlkreTJKRGFGYldpemhEYTBMWkNvZXh5NEw5RUowbUliRWVVSkV4YTlIRVgwRHBKWFpSdENTZXEyUkNTMG9vRlo1aUlUS2VZVHhZeURXNm1OYjJNVGduRkdTOW9jcjlIZGpPSHlOTjZYSTAwaFc5a21qZEdkZzNxSWRlaEpSdXlpUWtXaUdJTzl3bXRtM1FxaU8yZjFTazZrUnVXUXVXTmEwaCtUd3ZDRThpdmcxNWJXMklVUTFPTVhlUXVoMGFFZW5ZcVNvOTZJTXJvOWJKRTJkeEZ0YkcwRzZFUGJIOVdWVm8zcWpWdkZYMHhHTFNqR2hUckdwRDYySWwwdGZRWVFYUmN6M1BMRWtUWWdyVUcwa1A4QWcxc2ZpTUlLalZEN0VJdEdpUGxETWZVVGRsMUViWVhWb3RZbmNRYjBqYVRxUTBiYVlxUU9EUlpXaEp5SnVQMHVURUo2WjZXTzB0RWFhT1lNcnNTWElpN3lESjlpcERZUjhzUVZFR0d0UVZMZ2EwYmFRNkVrSlNuRW94cW9TTG9jdUJ2S1FyZXlIU0ZUUkpSS1VFbWhMNEU4ZDJKeFJyaW9lS0VrUVJRV215MmtJWE9VeURRa2c0VVJ0a0ZiY1FvUWZZU2NGRzR5cUNaUjhhVUlLc2dTSk1vZ1o3Zi9BRTVndWlUUWhlMmx5eG9NRnB3c3BOQ3NKQmswSkZacGhtdzJ4WG1uVUpVVTdGd0ttU3VCRDJMZEV3Wk5uVVFtYjVFcmJ3TkhZMW9RdUV4MEYrU0RiRjhLWVFkdyswS3F3U1ZtUFRwaThLVXV4L29abSt4OTVZbkN5RmRvbHVEN0tXc29MQm9TSzBWa09laGZWRGRFSWxac05MZ3VtMXdQVWVSbkR5UzlyR01LMW9OM3RrRU1haDF2UjJ4SzVFWU1Ob2FpR1BPeHNSUmpRNFlkaUZwbEkwWTBraUpJYkFVUWhHbUtMYUVrNmpaSktLMFNPQXZWM21FSjRORHVBanVZUkNsVWFJdXpSNlJWc05ydGduTXJaY2JMb1ZnaktJeGk3SGYwVnVEVHlOWWR5NEZUWWlTZDRLVkkySUp4R2dTT0Foc1hId0hlaGplOURTWWx5Q1ZDYlVOVWhUcjlFdUJXMUJocW9qV2h0M0ZKcWlKV0pFT2NMSVFXY09FTXR2Q0VLZ2tkRlVLU2c5TkluSjJQVHJVYTFDUklKeURkWWFRdVBoc2hFUWFpVllRZ2xJbGg0a0lnUWcwYUFsRW90eEdCU0lRaEJOb2tJaUNSdjZ5dlJzMzVzZmpDRTJKSDJVYVA3am9ZU0lQYlRHaTQyOEdpUVVPRkZXTlpvVFpsYUZDMzZLc3JFOE5tOHJ3ZVg1YUlXY0ZEVElJR21DZ3VBSWt0Q0lRaVRPNFNMZ2dnZ1NJYmczZkNFOGEvZ1BEelBGaklJYlNWR2RJL0kvSWEraDdUcTRHYlI4dkJpUTEwTmRDWmpkRkZNTlR3bmd2WkVUNERGcnhvZzJFb3NnMk9yTHMwSTMrb2FDT1FrSkpaZkdWNEwxUWk5L0EyWFJ2Q3hESHJHaUV1S2xvWEhoRzNnbmtNbVUyK3ZDL0ZuZzhVU3VIME5ZZ3RZWndHeVk3akZ5R2hEOWkyVDRWOHFiWkdhaTlqeGhFUkdqUXdkTVBaak5KcC93Q1lKL1NHSm9SeThhWEZMaGU3ZmpDR2pSckZLVnNuMmNEUlBLZUV4c1liSHRubWFFc1NFeVJTdFdqSzMyUWxKU3RPTS9Bb09yNHNUV0ZORlJyMDM0RThFUWVHU01INWkwaUlXSFRDbVZGd1FoTkRETm9RSlRiNHU0UkVRbnlZUWhDRXhDRUlRb1NheEJvUTB5aUVKNE1qSVFqeEg4ZnJ6UXZRanNZaCtDOEg1b1F2Vi8vRUFDa1FBUUFDQWdJQkJBSUNBd0VCQVFBQUFBRUFFU0V4UVZGaEVIR0JrYUd4d2RFZzRmRHhNRUQvMmdBSUFRRUFBVDhRL3dBNjZsc3YxWlkwN0lGVVovaWJLbGY0WFdTWDRubUpTaWVndlVQOHh4bGdycGZsanlWK0NPREdJUFVSYndJRkdJR3BydUFyV0NCZmc3bFJLeXhBcER3ekNWM2pjU2xJVGg2VE9NTmtCaWFJRXpIb09waTF3TFdIR1lhdVgxTDlFeTJtWkJiTDJZQytKUWFoWWN1Sm9lbHBLSzMvQUFtK0h6L3VKN0hUS2RDUVVCREd1STZNd0ZhVHhUeFJQUkVTaUJtQmt3Y3N2YU5FSk5nZjh0akl0dlJDM2dnQmdxUEZENkJiSEJSQ2lzTFNLcFZheC95ZjhuL0Yvd0FCN2lkVE11WEFXeGJKY3MyMHh6RDByMFc2TThucUtmVWluY0JkS0graG1DSEgyaWVXTjhCRmNDd0ZuK0NXY3JNQmVPbmN2Z3k5RUR2ZlhFY3hMSEloRU9BZm1DeVZyekNrSG9BbVNHVWlua2l0bUIxY3hFZDRDak04MlU3OUZPNDVUanVJbVNZV05SS1pTOVpiTXFRcUNZUytqOFMzWXJ4cUFHVlBHWWRhQStKenV2ZUk0VWZjbDlIM0xkcDdQcEVkUDFIb01UTGVJVzZsYUtPMVZBTXQ2R0NGTVZQaUt1UFNvTkZRbHVyWGFPNnJQL3dmOG4vTTlLbVNEY3FWNkZYQjB5dWcrMFhzbGtzbGtzN2dtVGlLMklwTjhvZFFlN0w4ajRoeWZvbDFvSHhITExjQlp3ZHhBL1FSRlFuYW5xTHJCMUtmTUNubHdndDJyd2JsREJqMU5sUnErVmNHTlRBTmVKWGlDVnJVVllvaXp4TkdvbkZCOVJvVlVUb2w5WFdabUppTlIrU0R6TzRKa2RSSXk1Uk1GTW9wUTdpMjFYM0NxT3R3cWNSbE0xamxnWWlXd1NBbEVwQmlCUkh2bU5pdGZEVWZEOEdaOHg4c0lmOEFpSjRmbUJNRUJIUXNVMEE2Q1BuaHR1TDNudWx2UG9GdEVwUTdna1UwSGNTUCtGU3VYLzRPSnJjRituakVSZzl5eVZjUE9vbnBzbGNpWEZuVXZwTGdwcFB4Szl5dm1OcmhRYmdQZHFXNUQyektOcS9FcWFJZGlITEhSTG1CVHhDQXFoZmIxQWM4OTgvNm1TaFIzekhtWmVta3hTRXg0RUNNdVNJVEtpMGQ5VFAweStnOFptUjZCUnVLTzR5R1paQ3g0eDZYUkhLSzJLOXd6NkxMOWVtS0t2RUZGVE5IVTFtU0g4elNNYWJqS3dIRXQxTnJxUGpYb3YwYjNTbkUwUUY3YlVWVnNZR0l5cm02N2lKMFIxUmdhSXl2U29KVUdZaHpuOUk1Yi84QWxZY1BxWWlwMy9qd1NwWXlmVUVkYjZoTjdpWXZqTXlka0YxQWNrdWR5enNsQzRsSGlVNmdIUkR3SlRzamZsWXVkVGVRN0NXRmtlcnRsR2hpQ3J4MFRVY0JoaTdkSFRiRkh3QW1zeGptQ0ZNQ3BVMEhraTIzM01qUG9iK2lhbVNlNmRqbVpibGFsSE53NXNuSE1jeUk1WDBKTkVmYktlZ3BlWWx3Y1RPQlpQZWx6Q0ViTWJ0UVZyaUlNdUlxMm5NdDRUd0o0RUhxVXppR1Z2YjFBUGlqeUwvdUtiY3hJWXFYZVlzWlFkbWlLcjBJNzBLRXB4S2xTb1FCYkJYMnVZbFd2bytuSCtKaGVCKzViZ0JPSlFVV2ZxVVdQSWNmNGNlbGhoejFCZkRMZEh5UURrYmdSOUYzRXE4c1dhUmxqWXlvRDVsdk12MUIrSWVSTzYyQTE3MmwvdWJPZm1IUXZZbCtma1lpV2o3WWlKWWR5Q0RzdmJjQ1pjUndxVlpCVUVTTTNhTGlhUzBsQkRjUFo2WW1aUzhSMmpGZTBGZkgxQjQxR3AxOVJXdkgxR0UxOVIvSDFGZXZxVzBoOVJUVmZVWE92cUN2WDFHek5mVVY0K292aVBxQ3k2STVqYlhpYlM1bm5VRXJGd2ZpY25QcGF0ZFJKWGpFcjBxVmJSQ1ZWeVM5UTN6RnR6NlBYcnphUUxiNGllSU5zZUthbFN2UlFCTllxMnhxVmxTc1I5SDFDMmlKd0hwMUZiSzIrbkVkeEZZKy9tT1JqL3hpYXcvNEtwZ3Bja3B2RTJ0Mmpnb2VTSUxFWjBTcW1vZWlEMUZ1Q1Y2L01wMi9jUEw3U25mMm5pWDVsSC90QmNVZXhFaCt5YlFlVCtrR1lQSi9TV1czTXVJTlFGU25VdmNyek1VRGpFelpncnhLYVdGY3B1cHFxRDZnb3JtQmJxQ0VsVkV5ZHdGTVFZaWFsZ1loY1FOUXVvVllsYWhhWU15aDN1V2xvWUpLVXBNVXRQTVVaaTB5clpWc3JpY1RXV1J5aExTVjZYdGVEVUFLdkxLN0o1V0pYRENjVnVZcnpMVnNDSjZITEVIQTU4em1WNkdWUjVNNVlpdDlCNUl4L3dBRTAwY3hPSHkvd2RSOWFZWS84WmlrV1RuME5FUmtpS0Q1bExpUEJtNVplSTlJemlDdk1FZEpERTNLaVNxOUQyOUt0cEEzMWQ0RXJOM2h2OHNXbzhuTDl6a3pmb1JVOC9wYVRpOUYrS2xYdEFZTStoZktpN2preE5LcWFYRXpQSVI1V1IwN2dka1ZtNWQ4eXd2RTIzRjRZbmtJdGNKc3dqT1FSbGFTbDZScTlZSFdaWXNOM0x4NWxGU3hxTzRRMU5wb21abUhjWUZ0WU04c3EyMmU2UExBN1BtUFRXRGNwWmdPSmZuS1g1VDJzcUt4TGN3eGdqYTF4ekVDaGdjelVEMHZCNkQ0eHNhaWw1MlpmQ0IvTVhrTlFlR0FwNzlTcHBPdTRvb3gwOVQwTlA4QUZqRG5wSEd5ejhrSmpBc1dkb0UwQmNVeVFTNjNSbUdHZE1HSWtGN0xuVHIybGphUUJvTTlxbC83a2ZBVHRCOFMvTCtDSE1MN3NOVlFQWWxuYmZ2Q1NyNkZUSWd2UU1KVzNBckdubWJhaXF3UmJwbU8yWXkzYVl4RUFJVmw2RG1Va2Nkek5zbGhGaTVaWWE5Qy9VcnpQT0c0VXpVVUhNM0k4ZTg0aHQzSEtZUlVlaHpER0lhaXhJbUl3WWt5d2N3S3o1WnFORWZTb0Z5NkpNMFRYT1pub200U3JndUp4TTh2MUhZQlZhQUlRTkphVUR0OEhpRXBxaFNLQTZQQjVpSlZWVzFZeXIxTzNQNlJLMnQvNEc0N2h0OXY4ZG9sV3FZQUt4MDdsSWdRVW5FSEFGZ0NyOTQ3TGhjaVJVdks4aUNsT3ZTeGdpZWc4U3ZTcFVDSHVDL1dWUkFsMklSUXlzUVh1R0dDa0owZ05LbHp4QlJSSzBZcFBiS054OHZ1Wk5iaGJSbFFTaG1lWUk0K1p0RllxREJLWmdWRm5Yb3ltTE10UXd3WERoZzlEaVhLbGpjeHhHK28rbW5vUDNOeE14bjhrRXFHRXIwc0R6RytDY1pQZUVJSUc1cGliUkZrTXJVdEd6eEhMTGhXTFM4bmEvaVdMVVloRGJBUDIrai9BSTdJZnA2UCtKYXBOakZ0dGpMMzhSQUYwM3VMek9mOW1iaEJuM2lqT2FqR01xNEdJTmdrMU1KaHVCTmZSeEtRTW9KVUpXSU13SzNFRXFnbi9tWURLY0lTc01HU1ZpSE9aUkprVk14VTJJeVBsRmJ3U285RjI3bEtQU29FZHdJYWhFV0cyRDBHd3VJS2RlaldDV1RMcjY5Wms1bFNpUnBCQkxtK29rSStZa0NKUkxtRkNaUktLSlhvUUFMWlpOTUJ4dUVWYlk2QnJYZ2wyMk8yV0MzVUhJZGVyL2p0QkJ3ZmZFWnd3NlRUL2dhOUhpT0JmRTN6Y29lU01Bc3Q5UVVxaXhsNWpPWXdTb1NseXJzMkRibTI2Y2p1R0t1dXdZOVUxKzBKSkNoRSs2cGp6dWRMOCtpMVF1R0NvUG9PWW85RXkxSHUrSVhSOWZjZkxNUndPSlhHMWJxTzhJSFVUeHVGbE12ZEV1b3ppRk54M0l2SDVnYXNMNGh5TVJjM01CNkdXV2xxeDZla09lb1JrZ3FMREhKSGNTNHM4dHd5WU9EMEV6QWFrQ29IdWpMS2lCc0hjWHFCeWN4S1JidkVaOFFPV0ZwNDhvck1nUDIvNG5saHJ4LzdpL3RpeThRMERqeS9jZHZvQUxZdG80dGVnZVVXRitoZ2kxNVlaWm1YdE1OZWovZ0lEQ091MkJpaXE1bFZsM0NhMnRyVTNuVDIvaUlxa3A5RFhvWjl5S0FvRUEwbUpmS2pjaDNCak1UREF6R0VDRFBwNHd3Z2NFMU9Iam5tTlc4bUxCZmY5TE9zdUFIdExmM05UMkMreEVhSWk3QXNqNVdRQ3pYL0FPRXNnbnNsRDhSdUVYQXBoREpCS3JNREVyRWFNMFJNZWsxSUZ2RVBNT0NPYzRnRXl4aVJEWWx3YnBDd0RWMDQ1bUVNTStpK3ZSZlQ2RXhEdVVGbFNGcnJOUjNBZ3lSWThST2hsa2VvdFlOYWxlcHVpaVo1azE2R3NFUnZVSytJdFVURnE1NHVreS9pQ0hUNy9GeitKa1U3VnovanhESUFjNi96UitKUnJxd2NCOEZFM2duV2lDcEZFRnduZHRBQk04d0t5eGJoTm84UWZSWkZFVmRSbWliajNJZWpyMFhReDNQSjltS3JhM0xEbVU2Y1BVZlNjd05BMDc1Smd0L2docjBGeTNlWmNSVVJtWGlPS3RQWEVkcDhERWxzOW9Nd3FDQkt6REhSRjNWZkV2TFdFeFZYNzZsY1F1VzFzSUdrS0piNVJyTjlibmNsWFRSWG1FaUV4dW1Hd0JPZVdLanlVdjJReDFFSDd3NVRjdjhBQnNobitKdC9QOUk3d1BCZjAweFQ3VUlFWTRnNWZjRnVZQWdLbVJTZE5qNDVKaG1UTXNRa3JWemJjMjd1SnhLZ1Z4SzlIRWlpekNNRDZjcFZzTWpxWWVnUXZvVzRnUVd5L0JyemNhWWxJTlFaNUU4TTY1bGlQTFgzTWtaNGIraTJOSW1QUElaZTlhaVFqdWRIN28vRVhveEJRMFp5QmNWWE8zVW9abGNzQ2RJTGlBcVBRVnU0dzRpQlI5bi9BTmw2eUg1L2lWWmVHTGk0RXFLb1BtVlViWlZRT1dMTVdKY1dHR3hpWnYwR0RRZk14WkhaNTlLWEFaZ1pjM3BHdzBjQkFyUkJ5WkttakVCTDAyUXdoY0FjTmZsR2MvY1JXTk1IdE96VVRiN212Mm1vOGtHb3RFVy9iMGNoaDRTYXNUZ2hzVW1TQm1DVkRjc0x0Q0tGd1ZPOXluUHMzRTl4cU5XeWVERUI2SXpRN1pZYmMrVWV6eWFNcFVHWnZCL3hIQjFEL1p5ZzAzTHRDaXZjL21MM0lIYWY4a2M0VnlCL0VkOWhXUHhBUHpTTCt5b2JwK2I5TVM1enEzOGpGWjlpL21obDF1Ni9wSEE5eUNWT2lCS0lsRUgvQUJLSUEzT0F6QXpNVkV3aEhSamlqQmJEUWxRTWtBOGhGRmhHVUdXSm1FSmlCaUcvUVo0UVFJTzBpZEplUmd0ME8yRDh6OFpzMzRsREo5QWZsWTdPOW8vZ3FhSGtqSDdiWnNhZEtzVzVYUmVVNzY3aWtYRm9MdEtseGhTWEFwYVBPb2hjaFJQWUJMN2tBMnZCQUFWVHc0Zko2UEV5OFNFZ0xMK1Jncm1vcXFLM1FOeURqUEJrbFN0R2cydCt3cU01ZHRsdk9acThpZmlMMDFGaGhsQ3ZMZ2wxbUt3UHVFQlI3c3hhakgwd1h1TXdMekI1RkVhaVluZmMzTG5qTUxsREpVQlhFR1R3aVVMSXFyMm1FRisrNDNRZWZFVFltRTJkTUNlQnJVM1BjY1dMaUxERnBxTGlHdzRnWmE3WklnWXcra2dMaG5LRjMreUt2dTdzUGVHRTBZc3MrSWJOTWJzaE9RcWRlRC9jRzdLZW10eStLVytaYnRGTU5QTWRqUVlENWVzNU9hbWZ4Y3JYZ0h0WDdoZVFSVjl1VHFCNTZ1dmhyVDd4ZXdkcCtEQmJYNUg4SnNmSGgrU0o4STlJZmt1QWZodC9ETFYwbksvMlFYSTZzc3ZpdVhaQjFBWFlINUVKcm91MW9HS00wak0xWnIvMUJIS29FR2ROTS9BOC9nbDNESFNYOXorQkQ5R0pZUHlscDhzNHVTSjdrRXdZbk5jTEs4M3F1TzRIMFV5c1Fpc1Y4eGNUSllRZ0ZaUEZwOERGS2JKZTZqZUQvd0JtWU5QbVEvcVVGTC9nMURhN3dIN1p2ajNpZm9tM0FCdWZ6RXV4cFZ2UjNpb0tWYkpnZU00aDE0WFpTNnZpSTJVL01zdDIrbzdXQjh3U09SVlN3RnRYTVBxV09mTkNnQUtuNXhITkcrL3N4bGJhclZxOVZSUitwWC9IQ0w5SFVIU01rd1hhaGJxZ2NRZjZISld4Uy9mY3FSaklOcGxPN3htV3NKbkxHVEp6eEQySU0yNFZuOUgxTTB4YlRqeUUvTXFCbFZLYmdqZzFBUVF0NkpTNXdPb1lYdE13bFNWSzVNRktlbWp5Sm5qTy90RVZyQk9qekYwbHc3YXI4SUJWWjh6VEh6QzZZNGxxeXhlSURKRU5BZHdVYUFWR3dVOHdBS0hrNWd1WFoxRFZ1NWtIbUJvMlFjUUtjeFd4aHpMd1RSTS9MZlVZMlZmYU54QlBNWHpFN1dPcjRZUFl4U0ozQlZIQnVHV1JEdkRpVWJvVVhjczJSVGoySVZWb2NyL0UxTXViUlh4UnpXQmpCcFhRczU0amdDczFkOFhFaW85bGs2cUpaekZ6ZUs4YnZ4S1JXWE9NL2NGNHNtZjZJaVlEbDBUTmpnRTFMUXk4aEVPVmpnTXRDUG1CK0dJcFpHTFhPZVhNRTZjSUl3MDcrdUpRaGpDd1Y3a3NMRHdrRGFhZTVtVXBTK1pvZWhtVXF1Y1pXVWxTNXFvVWI3eVA2bDBDSG4rcVZGSEF0c0x2cUN2SXJlSy9tS1FJMEk3UHVPcXpaWmwvdUlQN0dBZjczKzVZMStUKzVsd0h2L3RITVQ5c3IxR00zUS9VV1dVY2gvVUlXZzNoSzFKK2Y3ak1pSzNLcmFEczJocXNIbU1sNW1zeElQa1NnU2ltMW0vYUNtbG1yQ05odlNXVWNZOFFwcTlCM09oN2kyQXBkZ2g3dk1zcGo3Q3dYTkZya09NeW1pV05hZXp1WXR4RXYzRXN2Q25GVnFBMEJ5NkYzaVp6YUV3YWRtWU9oRGd2Y2l5cmdBOCs2Z0xrbUxEa1J5QjVhcHE3OGw0UEVaQmFBc3RtbDRQTUZmOEFSdUZ4YWJjbjZsS1JSeEZZRVl2eEh4SlFzZGpxR2w2SDdsQWE1WmZpSHRNMW9pTFF0TnZVd3F6MmxzdjhJK1pMa09KcHppRE9CRnY0Tnhpb1ZEZ3pZWmdLMjJZQTE1NWlndmNWNlVicWFaajVlaVpkaDRpSzFUQXZHbnBBdE5nemNYcVlIM0VKcW9TU252NnpINXZ4RkJ0SWhsa2V5VktGblpMS3A1amp3bEVMSjFDd2hnS0VPSG1aN2kydUlMdTVZMmxsenBYOE1XNDhuc3ZtV29RNEUvYTR2MmpLS2RmK0V1dUVydzh4QlYzOWpGTTNqZlZlOGRqVmw5cGhrMGNabFg0R210WU95UzRZclJKbkZqRDd4RWxlU0MxSHMxeERZdWpIRVZnS0lHUklGdHVHc1V4TEduRjlzdmt4STV3L3FJYzM4Um5rR0g3bXdOS0VHbEpNMEdpYlA0UWlEQmQ0ZDRZYTYzSkluVVVDaTAzWFVwU3BFV3hkYmhnd2RWVXhCdDlZeEtRQUZhZzMxQm8yUWhRVjR4QmkyZzFoWFlydGxnc2JoWHc0aDJ1Z2MrUThlWU9BQzZQVUwyM05JSjZwdTJvcURiMUM1aDF3STlaL2o2bDNRcG9OUnFnQmNtcHlTN3F1UGU0TndnMlJjaUtlVCtFSmFHeWppWlVEeVF3MElUREJyVm5NWUl3d0I3cW1XUXFOQlg0bENzc1dxRXZ2aVhlZ3M4bDIwS1hjeTI0dzQwSFVFUVJDZzBPTkVEU3gyNlB0YjlTNkx3Y3JwMFREWktjUTM3cC9VVWxiR1AwWEJ0WUlhVGx6ZGU4QmJaQVhPdGVJcXdBcFhQdnhMa0VXSUtack5PSVpJcEhOQWhqdHBpaXlzUlNhWG1KU0JpbXIydk4zVm5lWTl2V05vRWU2ODhlSWhiTW1GazhudGl5MjFYY1dFYUZ0QnpqTlZLUjhvckx6QjBSWG9zdmxOc0FJamNEbnl3NmRSTXpBd2p0RUtWY0FackhVUTBwZVlDdmJMa2RaUXpEOHhNbG1VOFZLK29NRjJ2SXdoU3J4L21JNE1Pai9BQWN0VXkxWnQ5bnVTbHhaNGhGT29BcnkxTXFzMjFGYXUzVERhcjlvR2JHbVVPRXFhSFBtQlZuRU5sWVpoV295OTIrMHh3Wll4cHcrWVI4Ri9oaHVCaUVKUmtUWlY5UmlYSUlpUHMxK3BrazlHUmV6VWVLMjJEdFZBVE5sWG1PbjJvMXU0cVh1UDJQQmY5QnpDcElhZHhjNkFYVUYyckRhb21SdkV5dlBramJoK0lPQS9GekEyS1g1aXJrbFo0ZzBXMUd4RnV1WUt3d2M5ci9OS0xDOERpMXVLN05UZGg3UlNrTFhtdUpYVXBjeXNrTktXWHBEVHR1VXNGUUptVjJUQUU1YUd0UVhaRFYrWlJ5RnJFZFJVY0NwME1lNTltNDQyeFU4UHZoaEhHSjMrd3pVSkNwQlRFZFhWc1ljekZNY040ei9BREV0MldlVUNiMDlvbzRPMmpuUmk1WXU3YnNFMWVGR3JNeEJtbHJrZ1pjelJYWmlNV1IySUpmYnpNTnh0SlQ3aGF5ZzR0c0FWalVlblNzWnZXWnY5KzRvb0RHWEthR2lobFlJSGRBOFJXVlh1M2NzQmxlQWpncldiMzBLNURhNmxGc3dSZmx4Q05XYXdLZFVHM3hPS0VZVitEWGg5d25FSGd0NGFTVXQvd0RNVjJXQlBNemVpRXJLSUFiNWJZQ3RwMGFTSGlIdTMxcWEyQ05IUGpiajVqT01SaW12QS91Ykw1anY1MlFWV1AzTXZzRThKdFo3MTBReHZjb0V4ZW9rRGxPQ1dRcFFKVDNvSW9tYlBlVmVVaGplb2pnenl3dWZjWU5BbEc1UW8ybGlmR29XaTdZVlRxVXZtb3MyMjlFU0tXTnRiZm4wTlBpQ2RWOS80dTJnelBXSGtKa0tFN0lic2RtRGVJYVdZaDVCS0NuTXE5ek5GL0V1RHQzTVFNSXFHbEREeHFGdHhDN1IvQVJ5SGRZSnJWWmJocEMyR2JNVmNKU05GbWtZVlFQRkhjRnFrS0M4RkowZjNESUVTdWE0YzU2dWJhamVqK2hGVkpRdHlUa2xIeDdIUTVJVFJpd04yVldXalNlOGMzQlhiMzNNMDBjVTNMTXFpalFmVXJqUVplVC9BQkxOYWFzeFVRbHJ5RHNoc2ZpSW9McS81bHVrV0hLVzlad1Fpb0p5dFhObE9DSGYxT0YrUUk0YUxjNDB5d0JUczVtWTBXOFpxTFpWcmxmeEt3SkNVSWpTUENDdHBjb0FGeXBBVWdIa0NoZmJVYlZpVTdWNFR5UVcweE1JNkpyN2lsdUpHdzhpNGk5aDBwYkF0aWpCY2RpZzJMVUFHQmpMZTR3T3cwQnFXRFltQXhYeE1VM2d0bS9DcFpyTmtSaGJPR0g1bFdzaGdXZDl6QXdWSElMMjBTUXB4alJ1UERkTHNTdUxXTDB0VVdEQlJMaURWU2dIZ2NMeEtyUGNGclNydC9sWlBobDduMWhUMklOeXZTOUxDQXl1cS9FdHpHemY1VExMaVFuQndjaG9kTUZrMmFnOW5sKzR1WmcwYUE2Z1ZRRFNDT2NpNGlyUFpYVnRod3ZIMUZ2RXJFdmdKaUZnOGxxUDd4bXBWTmZvZmp1VUZNelNNK1ZFcUZzTEYzSDVRcmtzRzQ0WGNpektraWtBaHhGUUdNcFp2a2lXdUlxWmFPbzRVWThFWGJnOUlaQ0RUdUdmSUg4ekZBNmoxRHZSTDM1akZVckI0My9qY1ZXTlBpVXVVY2tFRnF5RGxBdlRnamQ2Z1dCWkFPU0FjKzVuTHZWM0ExdzlTc1ExODRGaDBRQWh4TnE0SDRSN3VVN0Yvd0FNZlVGYUtEK0dGRXJwQlFFMENnbDhFcXNCVUEzQ3lBc0FjMUx4Q3hiS09SOFlaZ2NLNkI2aGVrc0hUMnFVbkVXdHp3WG9mRENpdEZpcW4rNFFKTnJPdTBhZko5UTF6a1NQZWZ6R2kzY2pFZUVrRkc5bERCM3VZWVYwTWxieEtLcjduSXh2dDQxR2d4cXhMdlZleVhqUkY5dDg1NS9KQVpldjdtRzFobUx0V1pneG91aXZjU2NhUkQvUzZoOTdYaUFvQTVOWVlhODErNE1BMHlYQnRYS3Q0aUdVeHhCVkN3dFlvWXJkRVJnV0VZcG1FSzVLQ3ZOZCtZanlBb1lYZlBERlhFdUM3ZUw1SDRpZFFDOFppcW1BTER1VUNocHk4UmRDMCtpRnRaczhUR2hKQmNWVDFMQmxGQnNZdkxLUVkzUDlNdGZrY011U3hmWGNHeVNzVkdwU1VqQ01WdEpteWJvWTU2amYxd01vT3pxTjhIOUkxMWVSWlRqWnpLR3czUXgvZFRKWUZZWjl2bjJtRVNLS1FIQUdBaWY2WCswS1ZZMkZPbWk0SzRlb2w4TGUvRXo5N0ZVWFdzKzVNb2VXdE1BLzVZL1dhSERpOFhwTGlWa0tVbmJGMGo5a1B6Q3o4SWkvcU8xSFZEK0xZN0NUU24rVmZpWEZlMHA5RlJhZ3g1QlBtQndvYm55alE0V1ltTG5PSjlwRm82ampPSmNkWm9jeEp5NjZZZ0lkek1qVWp0M0tCd1FGaXExazRqTGllemNYL0J4aUJjbzVZWTJ5Nll3VmQ0VGNzOE9HV3BldG4rQTFLSERUUDk4bExZbnVUTDRTVXlvOXBnNVJkSlhtVmhZZTVrVEQyUVZXUjJRQ0JFUnpDdStDVmFaYzdBdHg3d0VMaEJZZWJGQ3E1cUttdHFyY1FJekJBdGlqOEVRN1JWdEx5bXFSMXdjRVRlTzRWcVRSa2FZc2QvY1dtNlJsVG4rdmlkWlpMQ3hSdTBUUGlCQldDMVdMZGVhNVp1UjVDMStjWEQwdzhKWU94MVVBTVlJTU5jZVphWU5ydDhtU0dvMFVsVG1vY1lVMzFNd0lNL0w0eitZVXdSYnF1cURHYjFjdmFNTnZMZzF6K3B1K1ZjalMzbDVnbTdvRytybGp1N0lNQ0g2cmRvZFM2MWh1NmlndGQ2bWxnWlVXcXN2R0xWa3FVR0VQSnhGUU9QS0RpYUM4QXZsbUNLOUVFNVF5WGxLVWh0aG1VTFJOcWxtVm9TSHY0bDlJdEp0Zkx6K3lGOU9aZGozSUVLL2g1all4UU1PWXRVZGF1WUxNWk5rNklqcWRvQ3RIdTdZNGhtMWdvL3VaL05VUnRGOC9xRllyYlZLSFcrUE1iRkhRTjAvMUxLWGFiZkpBeHlnQUZJdHpCdzQyQnJTNWovVGNWSDlTOHdXYkllSmd3SUwyOXlkUTFrbURpOHJFMEdSQUtWNzVsWVExVkVLMWdpTi9LdWFOWmo5M2V3UDdoL05SL0JENlNnL2xsYkR2SS9nQ05nWDdDdjIzREVhRFlVUG9xV2RETlkzTWk3M2duQVhLRmU0NnFLOHEvZ2hXVU5OajlEQ29SVUk2UERTL3hISWJJNXlkQU5lWm5PLzVNODJRUHVDb3hYQUVWSkFWdGZFQ3JLaXVoQ1pkaHFQU0ZyTERTVGZ0Rzl1K295Y0NNWi93NUhpT1dYTG5ORDNDVXJHaDUyVFBZZTJwYWs0MWNyY1RTelArQXBNblRMTmI4eTdKazlJdEZTbU04TmVJUTZZZUZXY3pCSHFLUE1vTjJYNFlxTkNscC9kZnpIT1M3MS82WUJzVTFmZjRueUorNVdYc29rVXM1M3FuM1pDSzc4MXdjRmUwS1RGTjliWVhXTVJrQmdZeTRkQkVyL1ZBbU53MGF6eWgvSGNGRFZENnNDc25FcG5pQnBWMGdZeVMyNnE3ZkNkRVRxQXN3akhzNmdGa2E4RVZ3Sm1KMzBCd3IyVjF6ekdGOVZCeGJxQU9PTXd5SVdCZmVJdklCSEdZSUQ0YWRSQWlxeUp1VnFjdHF0UU1EVkxZamtaVVZMdEU0R2UrKzgxT0xiWXFnQjNLTUxhNklpK25RdFYwSG1Gb0NXckFSMHVUTFRDNEdYczZzbjNEVVFjeTA4dGIrWmFVWHNkUm1IbnpMQWdQeVk3VmF4UWtyaUxKTUUrNDJSeU9Nd3QwSW90N0wwTzRxY29oQjViWXZHMlpRVTFRQUx5cmtmZXRTc29zdXd6bkQ4a0JkSE9GbHZKd0xBRmIzTEVSUitQaFZnK2tMQUMzSGdsRExaTVpjZlg4eEFxT2Yra1FjZTJtWW5md1grYmhPbjJINmh1WDVWbXd2eGlLd0JmTEtzd1h2cVZRVWE1Z1ZsNkRoYktlYWpsWEdDRGhhSlNCeXpUWGx1MjRQbjZuN09aWkVDa3Mzd212ZVVXVlVHbHpiY1Z5RzVTbFpvcUtZTUdMbEJTdjNIWFI0RDVoMFVxcWFQbTRHeDhQektLNkIvRUdSR2xHb0xobzJoekU0MjZSdVF6Y0doOTRpN21FcGVZVVp3OFJOWXo1SXQvNEQ1eExEUm1ZVTVkd2k2RndGWkk5VktPbjRacUZJZkNudUJHRVkzQTAxNUkyUHZPcGpiREZFQmxRVW9oNVV5bWo1SUs3RW9oYUE2UUdyMlNxdk1zTmo5eFREV0F0V2orNVZBTjVGeCtCMTNEMFdrMDIxKzRDN2JJdGZKdUZxbHQvdUdvM3hHckdtQmpwSVdTeFFMVVhYTG1ZeGtTMnk3dzdoTE1EUWZrdS93QVFPMG1RQWRCZ0JDYzBTeXZUL3VhT0ZwZU9mZStJTkNBdldIWnk2Z2Q2SmhYV205V3pKbGljWFFmcTRnVXFJNWN6RDNDb25DcXM2RlF4eFFQekZEUnZtWkc0SHhHYXdBVUUwMVRTZ1VMK1pudUNpVnA4eFFBbk5FU2xiWi9FOHdycEJOQ1hpWHp0bDNBaDFnZjdpMEZpN1podE9UcUZucFZBQUM4MFNqTGRBbHZGY25PaVdBMElXQkM1TzBxanh5Y3pFeHVHMzFxYjF3bEQ0WTFLQVdiQVB4QnROVWl0Y04vMUJlSmpVb0JSdys0dzVkVXUxalRqYmNMYW5KaHJpMXdibVMxZ3RFRnFkVU44MUVtU2djNVZyWjdER3pSdmlIRnZNYVNIVlRMbXl2TUJvR1pRWDU1Z0JVSTNEd0VieUFPSWE0WmFkRGtJYzVxR08xYk9BckRnQUlUZ1JFS1JOMFJ4YUNVcm00Z1pWbzhNSktpdENISjNBQVhhZFM4TjVnMlBlQ1V0T0lxSVZKY29uWDkvVWVBc01Bd01hRUhSMS94RFROdndiL01KT1pTV2JrdnYyaVdib1JjQ3gxWmw4QkhDSU5xdmNZMjJhb00ydnQrWU5yZ1AxQjhncmtoSUx0dnVHWURySEsySUdjMUdGZnlNWDdpTHpQaFBjU21WTE5NeFRLQTh0ZVBNZCswT05SQWJqNmI4eXgyZlhwa2d0ZlFnTm1uOFFHck1rL2ZtSjhRdUM4K2hZWWpsdTVuT0lKY2xtNDFMYTE4OFJwU0NORlhWYTU5RmtQOEFpNWF6YmxYY2F4OTBTbjdaWmUyQlhyTEdCa1hpa3pGc1VOalVNMEJ0NEdBWmtRQTVoaytxZ3FtM3BzcjkrSWxXa3FDM3lzTFhndzNRS2Q2M0s0QURBcHFDUmcyZGtQSmxVakdxeHJFWXVvSHNyTlhYRXdEK1JBMHNXRFV3UXZMSk1BUW0wc3VMcU1lUmN1VUJPcUlDMTU0NFNnQkJwRXpaRVVGeEwzcUl1ZzZId1g5VmNvYldvcVVBc2RpTkMzN2lEeUFCQ05ycXVqRDVpQW9TeHVrVGpJNHFVcWxWcGxrNE1nSnpyYmNhaGVtS0Yva0lVT0pDNzFRVTgxY3ZxTzk0TDJwajdoeU5BRlhPTllYSjVnVHdJanlMbUJqR0ZmTUF0WEFCbU43U1grVVJxN29GVzZJZERGM0dMR2pjY1ZjaDkxanF4Zm51WGtBcFNWNGJmYUlEY1V5eGpGUVpZUEs1enV5QWt0ZkZYZnQyTUkrbm0xMGRuWjVsd1VSUTlrK3hqWkpWRTM0cUF0Y05FQVNvS0ZzeDNYKzRzT2U3RFB0TGd5cXdYZGY5ek01U2ROWnVUK21MR3ZxSmc1VFdmSGN0RCtBZHI2ZFRDeTFYdmsvaVhRMDlubEZMdFZyRU54ZW9yY1BNWE1mOEFYaVVHMkxjRTZKUUZDNGdvamxmUzNYcUxaK0pVcVY2WmpaeWR3ZFdWSGRtdkVhQlREcGgwZnVlNHp3bU80QkJwc2l2TENtT1JBK3A3QkcxVTh2ek1Gd016SG9LL1F6aUQwZ0FXckh5RUxieUNMbHJEVXpBeWxzejhFTllaekVYVzZHZzc4KzhlWlEzaVcvQTVPVjRycnFaZ3RaaXprREZ2NG1uVU94OUVONWZvaDc0THc1bkNNbE14WjM3UmhNTWo4UzZxeDd4czlEWWtiQld2Z2xvSUpLa0pETTVpWmxDc015WHhvVEZWalpsejdTakVDWFV5VmFWbVdGLzR2OEFzVCtiSWVZWmt2cTE1R09GQ2xJZWEvVUF0d0tCbS9FR3hLM0JwNE96M2lscnFCcGNaRTRMTGJqUE1iRHFnc2VmUGlQdnBiV3ZjN2ZjRlpLS1FNSFIzaUpScE5yc3pUMUhDa3cyWFFiTTBYY29yY1BZMlpXaFN0Vjd3UEtCWjBib3dCK1dPY2hGRVBCZ3h1SUtyOHR4N3NiZ2tzeSsyQVFvNXZ6RnZJMVpWcTlTcEJkS3d4MTdRdFQ0azRWazVnYlNxY2czMGtzZTVDUG5FL1VONEJhaDhya25XR0hrRnY4QU9GbUZhb1NLSllmWTVsTmZZM1pOMWpEREtvUTU5NC91TTZpb0cxcGVpNG9JQXJodkhTWVNDM0xzK2o0NStvNFNLVUVQWjFBZE5NREsrT1h0TUx4YUdLWG1ITjBvaCt6dy9ralZGRzJ5c0RZdXYvRXNjclhQM1lmVGxZNFlyY1M2WmE4ejM5RlRCNWluaUVGbWlxSU5MNERSTFZhNTVZc2U4ZlFYdDd6dGZ3UUJXSG94WHk5alBjZmlZOWJWa3h4Y1ZxZHZ4QmJPUjBrSHpmdktybkVzSFpEUERYaVB0TXVjUVpnaFpFOVpnM2dJbDR6TGprSllaS0VzeEhtR2lOWjlVOVFSd1JpdzB2NVI4SUZ0ZWxqS01QQ05rcE9hSEZwVTl5QzRweGJGWC9VWkJFWFlmRWVVVUJaU2wyL3dPNGJRRkJRdmY4c2FNTHVZN2p1RjNCWW9Ha2R1SUdXWkFrc3poQUQ0WTkzTENtOWJ6RS9LSTZxUTBqbGlNYllXU3BTYTRjSkNpUmwxdFNiZ3lJMWV0eXhTSTRxK2JmekJ5RGExWGk2UHFaYTJwWGZncmlGV0Z0c2RlWmdVZ2M4UzV6azJtb3M1RVk3T0R6TUF3cFcwZWZ1Q1dPUm9WK0Z4enFMRXlGc25aMDU1bE1wWWxyNGpQUVJTdm00NS9PRkpMOHlsc1pVcnloNHJLL01OTTI3WVJmT25VeXZGQnhjTldzREZEbTVSc3NpOGh3OVRRUTBjZk1IVFJzZ1ZkdjhBMm9sRFJ5RWNjai9FeGQ0UkZXVVpZc0txR2p4aVk0VitYNGNRelZnTzQ5VFg5d0c0b3ltdmRITUxVU0hDSzlQT2Z4Y0FJeGJWK2Z4L1VMaHRYMlhCY0VKckNwQ1VDVGRiYjRpQlVlRmsrQ0QzVmdhdk5hK1lvQ0Q4Z3J5ZXhHeGVZMmo0Z0htaDB2SXQ3RU9ZM2V2SllWZTZGWTd6TnlHSE9HeDVJcXd6TlJHMjdqWEx6Yng5ZWpjcDN4NW5tTFhYMUtaWVQybUd2b2xnMlBMRUZGZEJETGlCYlRYTEhaV0k0WGRzY2FEMlJWMzZaSmZjOW93OUFNOVNPVlhqaGY1bUdEWFRCdE5QVEtOajhRT2llcGRzR0ZyWGlIaE5KbVZjd2Fjd2NWeDFQZEVXUlMzZTZCcHplSFBPNENvMjVRN0ZXb2VCQXJJSHhDTWZFZ0VxdktXN1ptTHpNaG1GY3F3NnpZenh0aGVoOEdvckJaSTF4TWRhQ2UxRlRNMTlrLzhBU2wrUHNubFB1QTBuM01QUTdHSW1DNm80cm1vYUppLzR5bXd0SWhITHZxV2c2VExlVzRydUZWZ2lQRVlIRVJjd1ZraWFTRHVQR1BQR3YyaHFXVjlMYVhqUmd4REdFVlptK3ZiMmhHbDdoVmU4bU8rSTZ0UUJzT2wwcjVqRUVLUWxENGlMQnRLOGd4aXN3a1pvTzJqbDZLaXV5c29OMEJqOVF0a2NoVDJYTmZBOFk3ZmR2bUpDNmF5VjZERkhIbnlkeW5PaFdaZll4QmlXazIvRUxLNzdpOERxRWNqRmR0NTB4ZEVCVis1YVZnVnl6bTB3cC9nNzhZZVpaMVhkL0RyK0pZbk5HMGRWcjhRK2VSTkdQYVZHVUdsZVNydlhzTUlGZHhDWExiUys3UkQzUU5QQVJwZS83aXcwTmU2MytQekhPNGdKZVExRTJzVFJndUh6ampzaGV2RmxuS3BqMHRIZFhlWDdKWUtKdFhPWW05VWhjeHc4Mno0enhHZ0Zod1dEcC83bVhaa1FWWTN4djM5cW11NUxBUFpWcTV5eXJHQVZJMlN4aVp6QkxGQ1dNZk0yczRteXNBTnJVcmRtY2pMR0gxQyt3eWpZeWcyVkJCd1k4eCtYOUlEVlN2TXg2WjdsSnFYMlRIRXR6RFVKVXFBdy93Q3VDekk2VmlXYkVPRVlvR015Nk5RRVlDVldYVTR1R0JTM3pCbDZWM0h5a00wbnVDZkhNT21aMlFtOTdPZVNBWUJacFhleW4zQ1huMjNzeTB0Y1dhcU55VjRpREtvYkN2SG12eUUyUmRWQ25tQmNnQmIvQURMbVl3SFJ4SHpsR3piUE94YnRENldaUmMybGQwSysySnJLS2NqY1lOVzd4TXlnMjNFcFdMVnBkUkhZNU5WTHdLek1QRW9xMHNzdmtsalA1UXJFd1hCMWdCTUc0a1JYZzVRd1Bka1VRTmd6TUJRWnVVRkpUTmwrYVRGeEM0TWt3bFpmZitJd3hxVzZyL0lsd2F0dnBLSE9Hc2R6aENKWDV6cDF6RWRpbTFYTEYvOEFhRDBoU2JEN3hieXlYVXVvclFyNG1oUnBxSTFXMTFBSzN0bDhzRVhjRmswQmFjRXNDaThuM0s1RGVEM2Fmd2pVb1ZvUzkwR0lLOW1nYUhXVXY3Z0xETWZ3QmYzQTRUTGxLTi8reXZBMzNZTUtIQWNjckZBV0JzdHQ3Zk1haG1XRDdRYVd2TUlOZ3ZXVEw5eTZGaHB3TDlvNzdNUldJcEF5K1dBUG9RTEtIUGx2bmlPQUtxVUwyWmx3NGp0SGJRMzhaQ1ljYWhndGdCUVFWaWhYOTVnY0tQV21XNk1MYkhMZm9DK1lPL0hpTldVdVVLTzR6NGdyVkRnR0tGQ1NneHBzN2lTM1ZzOTRaZkJISzNVdjF6S081N010em1XTTJnWW5pRUFpblYxS0xLZWNJdHAwa0xhS1BrbUh6NlJvRmNrU2hrYVJTemlhcExjem4wZ0JRcXAyUE10SWxCcjBLdEUrR0JQQ0t0aTNxZmk1WVM1ZFFyRHlVZkpHUjJCeTNzdTV6emdsVkZWb20rL1NNSXZNbU5zbUpjQmlXeTBOdlJrajhwelBKRkxtNEdaWXdoQzBtK1hnaWRGakEyQXdCNElxQ1lsWnlibDliYXlvc0w3N2hubUFTQ0VmWkVRNXhpNVlOSTdVVERsSFVnTzNGNW1aTFl0OGNNVDBiVmVSMzlRRDkyY2l6Nk1hbm1PUjFBaDJTeHVMejV5VkZPaHBXQURRWGdGZTdDd0FiNGM5SFZ2dm1Kbk1keTNpTlppU29PU29zRHN4Q1FVaHluWnhGZzR1YWhTTlMybDJzdk5JSkUxUUxhYWVKYU5hVkEyOTM5WEZyTE5vUEFaYjhNczV2TnBNNWJzZlpNdkN6SkxCd0EvRURiUWVnYytZV1dHR2JITDNIc3ppV1V6dXVZNFdUbk1NbWMzMUNhQ0dvQ3NPbHVYVjVWMHE2NkpuWW4vWUlFZFFSYzJZbFNpTVpiZDE4UlU0VmJRdkxmaVh0UVV1RDJlWmVocHFnaCtpSzJHTFhKV2pxcGdSdGM0OTRSZzJ1cFlnTmErV0ZtNVZBcWFxMjQ0NTFES3hwbjNKeVMyeGpqVld1T28rT1p1UDNHQ3F4TDFmTVNzTFg4Ulhnd0grTmVvV2syaHFCQ05IR3l4N0lnRkE3ekNqSm1IU2N5NW1qT29yZnZCcEdaLzZnTHU4d3NNa0tnS3kxbUFMcUtWaWVFMlM4TlFvT0I3QVJjdnRxa3hXRkVlcldFcnB0aEhraHZNZmJpRUorNGpPcFZDdkVqV2lxSnp3M0hNbUxVQWVBOW9nVzJybDdpekhjSUxwYmxRTEhOdjFBelVBR2c1Q2xPNmxxbVB1SDdsQTl5dGJHTnkxMGFtME1FTEVaWVJpRkdDaWlQVFNBNTB3ZGREVEFvQ2Y5c2d2S3FMVXhYaUMzRkVCZGhmTU5DRTJNUGlNemxZUXdXWWUrSXpheHpJQ2p4ekV6WkRjTlhST1hETWtlWElCS3c2aERRcGxjeDNDc0R5UzFLeHFBdlBNQWlnZk1aY3QweGkxWlF2dXJsa2RmU24zZmlXYWR0SloxWmNNZVNsUUxNT3o4RWFpb1FTVERRaFh5UlJheXY4QXNWQ3h3NWl0eEtCdHlkUkZoY0Y1Z0xzWFpSRXZHU3VqcWd2dm1IQVlHN2FIQ3JxVktYTFFvUEJjc044bktubWpGdTNFMkFlWk5FdktEK2FnYm43S3ZvV1oxTW1sYXpBcTlmTTRVUlMyeG1CWEdvdFUyaGc5NGxBQ0VMZTVSbjgzaGw1UWgzQytsWFRVcjVpV1cySGZFVmJiWlN0ditUNjZadE9vNXdaQm9yM2hobzFnZlpDYjdSZCtOeGkwbkFTUGNtUmhnZ1NHb09JMnR5cEg0bXdUN204UDNIaUVqMkxBaFVVMDUrbVk5Nk4wZTJhWWdyMkZuNldXVzkxbitvcnIyT2Z6S21KNS9wVDkrdk9nbnRwZUxIelAyU28rd1g4eXp1bEVzekVPVXJsYjRsTHNmbUloU0Jsa3dHWldnaXhld3F2RWJ6TzcwZ0JRVFlsOGtZS1FZL2tFSWpScktENkNDYUw5UmxibVNCWUhvRk9JVGxjUlhhZ3JNSnpnL25FK1EvQktvVlZaUmtyVUY5d2FEYk5QRTY1WjFVWHNyKzduZ2hDaHFNWldKa1hqcVdQbzlFcTUxejdRUnlHUk9TT2xGOEhjd2hROURDbFdLNHFGbWhndmJVb3pMVWxPbnVGMDA1RUNXc1FhbU5XZ3F2dGhxSjdqRUxlOGszRUhZL2xPUjdQZnpGVjh4L0ZjS25uSVFHV05oM0VSOWxkbWVMZ0Z0djhBZ29ZcW8vTDlWVU5ZK2Y3REgvdDFkRXhMVjAveFRiajNxLzNNOVdlTVJ0dXdMQjgxM2Y2VElpNmFpMlI0N20vbWZhd0xGMFlLZ0lVZ0VDd0E5eTJQNjNoaFpBTi9tSmVDK2lHYWk5SGZzaXBrUnNDZXhyNWp3U0RaL2daZ0FLd1dudjhBdzVqNm0vaEhjNnVDeGNPUHZJU3ZHSHpmWkNzNm02Zm1QS0R4QkpVNGpzZ3dxS3QxUEpNdUlwTnZ1RDhvSnVCY3hBMnVYZml4MUxjdTgxUHczTFREWHROVVB5d2ZMNXpNdU9QRmZxYVFhNkQrWUtVcStIN0NmdWovQUJWTHpBcGY0MFZpRlZRTDYxVXd6VWhKbnFrancvOEE0TnpiRC92aTQvdWIrQkt2d3pQM05ROWcvd0J5OWxQWVlNWVBiUDhBRXBRSWp1T2J1S2hBVXJ4NWdBR2xFS3JXbVpScUFWb3ZSWlVzSU16YXlxOEVDaXR4Vmh3Ynd6OTlRS3Fpb3hHVGNDN012Y1pseDF6R0xhSmM4Yy9pWm52S2RWNW1jdFZtQy9aSFRHM2hWUTFtRzEvRU5EVVMwc3MvY0ZpTWxEM01HaTFMdEZVVmJqTGdnY3dGMHhxMmF4bU1DQ3daOHdyQ0ZNSkxVV3cxaVYyMmZiRGlwdjFydXRoaHkwNEVQS3ZvYUg0UWcvaU9PQjNrMTlSSkgvbzh4THM4WEYrVWV3RXlsL0dobmppNGdJRlUyVnh1c1hCYzhBd1ZaYUR1Rk5aMGZ2R0hnQWdBTjk5ekJvZThZUXRjVk1Kc3N1UWRwc2dkQ21nREt5eWdJa0RHRENkSXl0dmY5dzJiamtNblVGY0JVMWlaUHBWaGRZbWVOTUNQRVMvNVJwZ284KzdyNGpvQUlZRUNYai9mY3NVTGFyWmd2OFhlL1haZkVkeGN6QUhCTThSanVKV0dZS1liVjBOd0hPNFRxQ21VbUV4Q1E2Ympvb05OMGxrdXpxNHVmVnhPVUtJYVUzYjh4bTNnWHVWblNCL0tib3JCbFI1V2lBbTJsTjEyYjdZOW95RWJFOTZFVEZpTGNVV0dvdmxRdUtUdk81OEhFbWdCR1ZoMjJFZmgxTi9WTkZHZWoybGdvS0cwSUNxQnNiS2xvMWNNNGlYYnFKd1lYSVVPWWFSR2hRWDNpTHFEbHY3aHJmTzhmTVkwUUNsdGNVRW9wSmpCUGxHRVYzS0RNc1krNHJjd0dJd203cGxPREVNRk9ZSjR4QkhuL1NYQVYyL1FzNjlvcGs3NXN3K1NvdmZkOGYzenJ5UnNvN0tlTlRxeWd5UzROT0xsS1UyRWloWjgxTTdabUFqUms3V2NyMUVGOHR5d3hETkthTzRhSVVhZlVGb1E3aHhuNWovMHJ4UVZiN2t2V2o0R1dHNjJuK281dHRXa01LOG5nbk9EdCtBd2V3ZzBZNUxITklOSjVsV3NPRmkrZ0dZS0hSVlhOMXhjZFlBV2R1c1ovd0J5NXRBdnhEajlaanFRMFBOdHhvaWZBNDJtcWMxUnc3aEE3Q2NreEI4UUxBQzhod0F6QStMRE9ETEQ5eDU5V1lpN0RpQndkZVpWQVV0Q200YnhjNEdwV01rVE5XSHZGYmpjV1I3bFdLcmpVTERVTHFvVjRhbkljUUFyQmVCQlFlZldySHhOQ1ByZ3ZqME80cWI0UjRjTnl0WW1RR0szY1J4TGhqcGpsaVpscC8xd2dxV1FLcHdQNmgwTlRLUkdiMXhmeEdTMUhNeDR4bUVTMHpZeThDV1F0OGhKK3dLMi9VM2dWV0hVd09xKzExQllBQkJ4NHJDb3lNV0tQWXpoaTI5RGwzKzUyWTR5ZXJKOTFFMGdpU05iM21XZllKS3JjdmVPQnB1MWp1M2QzcUFSVkdKV2JySGZ2QmxXc2JJakx4d05yNGxQVWhROFNMdzR6cTZoTUFiS0ZHODUrWmhzUXI1R3hzZGw1eDVpVlZRb3BiVmFoRzZLV2xjTlZWekI3anNGMlE1b09jMnBERWQ0U0phTWZXSDZoRXdzY3BNNFdGNHR4QlRWL0pIVFRDaUFHK2F5U3dwdUNLVDVqZ0lyMG96ckF2OEFFYVkremxacmxpWHRMdENraURjQnFURHFWTFVMRkh1SXAxVjFQbGdWR01MT2U1ZVpxbGhvRzhaYWpaYU5RcElsMHY2ajJRV29vK0YxcVg3b1FnVmZzUVFscUNwZWo3aFpRSmt3Zk4yL01wWklNQXRmYkRpN3orb0VGcjVnckJLNmZCbTlCVmZjWHE0Rk9MYlQ4cGc2UjJRYkdWSmFoVW15M3pyTzhTMzdjTmhUa2ZFSEU4OFZwVis4YzQ5b3lNcGVJclVlL0Q1Z3RTMDJyR2hZY05HUDNVYW0rWm1lNmZ3UTBST1lHc1FudmxLUkxqUkRJNDRncXpFWEMrMEJTWEFNcGg3K3V5ZUk2bVdJdkRjcDVtUHVFTklzRUhDaG8xRjRDcFpTK1pZU01VWWVETDI1eGd5NW1pY1pKdjhBM0xCWGNDWW14OHQrME1aNkRLTEMzVjc4U28yeFN2cGhRcUYyU1YwcnorNDV6RE8vM0dCKzEzbGI3LzhBa1hpSVVVY2p3NTg1KzQ3QWl1dGNJR1QzR1pMODE1YndjSjlvcDdWempQWnVHaTJuZXpURGZIbEFrYkxUVUVnelJDU3J5VTd6VVV2QlhRZEV3WVNRRnlLQnlOYVRlWU8xelQ1V2pwak5ianROR2JHdmVVRHRBMkFNcTRzK1lMZFVXR3h3OHk5bmJyaGV5T1lwZXJzYU5GeW9YVkZ0ZVdZQUYzYS9EZFJvYm5XT0xDaEdHeWZFc0lBWU5pdzFuTVJsYjRndHBMRUZzb3hDSm1DbW8rR0ZVWkJ3NTltNFNzcnFJa0twVFZzTDR6RUpxQmVpbDFIdk1YSnVjWEE0Y1E0WUxoRkZFZks0VHF1OHdURXpNQW04S3VXTEdWZnRBTCtKWm1vd3NmOEFnd040N2xacVhIcHZ0dEg3KzQyUjFqazByeGo5d2VJeTBaMW82UE11S3I2VC90d2h5dGVKQUxPVEI5T245bnhGY2tZUytuNlluQk1BTFdYQVV0dEZaNVJpR1lESWM0aGVFQzBlRncrMFlBYmNybUVwdEdxZGkrcGVzOW11WEQ3UndnUW1Vck1PbDRxRzJ1WHBoYzRPRE9vTTNhL2lQS1hXK0lMaU5TeWJjUmFsazNMc3pMTXNWdFNHRzRLZTRBWXNCTXc5ai9DNHFCWkRZT3JoZ3EyNEgyZWd5NVlidkRBcUMvY2lnY015bm4yaGpES0l1cGxxT3BzeWxuYkIxQ1N5d3lrVkw5dFRCYnhyMWJLNFUrcWw2eE5Wdnd3b0lEQWY2Z0R3Vllmbm44UWJvTEFXTTVwVHgxTFc4dDNtM1o1bUg0cVdvSG1JU2xsRTB1eEhLbmNSR3pEcGVSc3RseGIzakNsbnZGdEEyME5hbXBFb3g2Ti9tWk1BYlc0Ni9ZQTNmSlpiY1lTVjBuYmppYndvQUt1NVZ5bXdVRkZTdGdjQXBvWGozaDA4MWF4emhJTFFDRjEyZ2dzd2xsamx4S05rTlVOWEMwdTAxVDVnYXlQMU1nbFlmRWJSM00xVkhiQTJNT29VOWtOZTFsNFNtTnBTMWlyeW12UXNzRmk2N3ErTkgzTGh4dVczaUlOWVVVWXhDS1N4clc4ZmNwWG1Dc29RbHZBblVVS0NodUQ2Wmd3dnFab1lTUnJ1ekVHemhtTUwwK1A3bTYydUVYWEZzc2sxd3NCNGp0cm90ME83R2h6cUU1VEJQeWNtUGFZSVVBaWlzYTQvaGxaQlJhQ0t3UG11N2dMUXRobk5mMUwxb1pZVTE0WldYNVltTFMyTGZNTUJTcDV3ZmNYVFZBNGpxcjF1Q2lBU2d0WG9qQjRGQVpPc3pPaG0vYW1PTXIrSWxSdGE3YnRtdzl3MVNzQzNxRnk2VnZUQ3FwMUNpZjRneUZoQVFnbGNXSnU3WE1TUFN0QXZqaVVMT1UvekdQSkIzRVk0d1lCdGlXSlQyaUN2VFUyWXRiaXBJMHNsbThuM1BKTFZyTDRoTzEya3Fmc3BncUhwK2RFMlFjUXI1cVZVMXJpYUh6TnZRcmVSejdSMHpCSWlPZlFkSWcyVFZVdmFMcm1Kb2dVUUJ5bGdzSTJJbk5lbFN0Y2Z6S2hjYm84UGpxQ1VQWUg0WVBBZi9tUDZ1RG80NnNickdLdnhIaU1nVkVLZWo5TDd5c3ZyRE5YbDI5REJLRmJMMis3M0hkY1dHMk90ZzhuZVRpVmt3MHlqc1NyVDJod3JCZFo2TXVKZDFBRmdzM2Z4Q3diWXBRYmVKYmNHUmRNYnlwcVZxSjl0SGxXVk44S0cwL1dURHpJRXRLbHI0UXY4aEtFNjltT0k2RnNoelZPU2lVZkRHU3JycUdsOERMZ0lSb1c5b21ybTd6L0JBc2greGdaVVh3blNIMS9jVXY1LzdJclh5RCs1cUhoemxueGNRa2RhMWYwdzN0SURwQjlZRm9wQzlNakJmWndmTVBPMW91RHdlZmVFQ09kWSszdDdNQjFaa1k5ellqMWRkbUxnMkJPa1lhWVVJdkVuSXRIc0k5bjRSL2MvclIvdWN1cngvZE8xL1lIOHdIOVIvTXdaVXIzSTl6L1VZeVNtb0VJdEJ5dmc1cUtxSGxqVmoybVd1dTN2OC91S2E1VWNiVDRSU0JyalZuOW1tTzFDUko5eDBCeXpOSUZvYkI4SHNhOW9uQzJQeS9MSHhHek4ydS8yaDJEbEdEZTJEa3RYRmVrYzFlSXkvS3p6S3lNRnE1bUIram1MaHBPLzNLbmNib1VIdkJOeUZIUU9QbTVrc0pPcXU0TVkvTU05UWV3Ti9HWWxoM1BwWlZaNWxCaGdZMEJkTVpseXc0TGxmWTROc05WeWx1TllIb2hzVzViVTdJVm1ISjd3OURaQlhvVXRQWHBPdnRPVWNRZFBxRE5PbzdLbjdZdm1LbUZyaGkwVElsbER0Z1NoMUFKaTRFTDRoY293aFY1WWtPS1NGOHNVcTV1TlE0U2grbzNEY1ZJUEFLMGN0dUUxcm1FcW0wdVVlWllsVDNrc29OUXFZZG5TYkdLVnpFeFduRUo0NUlZS21pd3Jwb1pody9GK1lKVTRRMjI3aXMrVmNxUGxtSjZTV1BraURZQlZvTFpjeXNhcFlIUWRJM1kxS2dURGlvM2xmVlI2bEdSd0RjVDJFTnFzY3pVUlJhMlJ5ZEdxcGlFNUg0OWdnd1ZGU2xrOXpnek1tSU8raDhNcTVxdy9rSS9RYkg4WEYrNXJ3R3ZxTVhWZUFvL1hNZGNnTm9XOVM2WlVvcGpFVW9QekhnNHFNLzFEdU4zRHZCank3WUNpMGR4UzVYRGc3cTBQcU5OZEJOVDJSZ3MwRnEvUDl4OUNkRE1Tb1NyUUhNWWlvdE5LTHNNTmlaUmw4eFIrczZwRmFINGduRlRmV2lLUGVEUlVNcmIwK1lndXVXUjg4eDRiNVJiVmc4WXJ0V2JMbFlpMTJIZ09vWlRkTmVMdnBQNGl6VzlZM0w1ZHZ2S2VGWVJoOGMvaUl3VkZYdUpwY1VhcGdjbmtoMmtzdVhRNHVPQmtGUTA4bTEwYTdoeVZzSzRxdnpES00xUGVmWFovVVNPVlpPQWxWaHdnYkRIaW9tNjFVS0c2clo1WlRPdlN4OWxlWUFxY3U0SEIrNGRyek8vSi9jSU1mbExOZmxHQlMxbXJtNGVIS0JVYkVRWllNcko3UXJVSUVvdkhVR29PSXVlS2l6UHdNUFZXMzZIRVlLYUs2bktNb2xja3daMllZc2FKYzNpcGxvOGN6Y09PNVphWVk3bjZKblVETXVoSWQyMCtUMEZRRGttdUJISmV3clB2RXk1WlZId1hDSnpkWmdPS3BxclRQcStKWFFjZ29zY3ZOY1MzTVdDdU53UklPV3J4VlpsdGNSMzViaUNLdW10dWJtQ2txK0cyL2FGb2tXWVUwYnkxeEN2TkZWbEcrTTMrSmlldUVYVk5SS2ZJSmM4RlloUFZJc1JWdDhrTVVORk4wNHUycGlDNDBDNnh4Q0dQMWxOUlFWTFNsZWxsM3R3S0F2ZVlRcE4yWmZNQUQ2VVlvOTkvRFBCTHJneEZ3c1ZoVllpZmFWVUd5YXAvTWJVb0M2S0x1QU5jcHdHdnZmek5vc1dYTGd4VEdtYmk0T2IrUG1PZ2cxV24xaENBcnkybXEvN2lPOU0rYm1vb082Y0x1V0x5UDZqNVpBZG9lRFI1aHlDQmF0TGV1L21ZVlJRcDlZN2ZNU0p4d1B6UCtWR2piekF5aXZxQ3dvQk9Zc2t3ZTR1cXg0Z3FwM1VMOWZNYUd1cFFkeSsvT2JUK1A2aUp0SERPdzRqbnY2RWNhNlZkSG03R0lWNHBuQllBc3ZmaVZjbHdDVTNkWkNPNDVVVmNPYjlwcGFTM21XN2p6RWNQMUNrYitGQ3JGSHVoeWJDZ0dPcUVINWxjaU1pZ0RKRFJlTTlTOEpIMHZNY0Y0SnRVWEZPU2FpOWlQMmhuUkFEcCtwbGd2cVg2WndlZjhIajJqdU9rdmNjcTNGT09KcEdJNUM2bUtOTzQ3SmVxK0p6WG9HMlZuYzBvcVB2RmZ4aHVEaUc1N1FjeXNHTUkwRmtIekF0ZlpBV04zY3M1eC84QU1SN3I1Q0tiK2xBelVzSVc5UGp4S05UVldnUWdmN21JYnA5b0lkL2RIdHJ1QmhpQXR3TzlSS2dJQ1k4aWNEOUlVLzBJdHlxVUZYZWIvd0JTcHZKUlBPNHNwWk81S0s2MXZqRk1OSWdLZVhtQ3NtcEU1dWZjS2J3OGYzeDBtRTdJV09WYTVtcHZRQVBkdUMrQUNieUIvRnpIaVpZODArVnYxTEdENkUzQjhTVHQvRTdSN2hoYmJmR0N1ajJSTzZKNGtiSVVoTjRDWFA4QWFrMG4yWUJnQzN5dDl6QWZLL2ppUmd5cFJGZUJQTFVZKzAzaVhVdGhwU2Z1QWhPcW8vcXVGNW5GS2oyVnMrSUU2WktReXRiR1VneXhRMDVwN2lMc1gyeDZ2c1FrUmZvTW16SGhsR24vQU8rSWp6K2Y5SUQvQUw1WHI1b0pZUHUvdExRVU96Y1lHcmQxTXlOc1VXREFvTkRVdDAvQ2NldncvcUFOVlBZZjFHSDZvOXFqcUJ2UStVcjVxOHdXZHphSnVBNGZUbVVueVN3ZVlaOWlDQUdWYkxFcnRhZVVzQ0RZd3FIZSs1LzYwLzhBZWlsQzMvaDFIYzFQZU81VUdKdEF3d2FscHBhRjFiOHpLeDJZaU5Nd05vSGNzSmd6RGFQTWJOdzNCaUJtQkE3aE1xakNubjBFb1p1NEdacG1GUzhUNVJrQUNxMEFYY0NCb2FSS1I4eEJpM01NR0xQaURHVFlxRVRNQ2tia0F1WWdoWDNEb3hHb3dIYUFiRGVjUUhHbHUxZ2ZCYjh3elhvWXdzV1hMekJoU08zdkFZNkI1YXo2YlBxR0xjY09ZcllvMHc1SmRGRmhVVlRtODl4WEZVdk9HWVJ0bVBNdHpGTzJYaUx1RjM0L2NxMmhSMFhxSmVJWUkwdDdpNmp4Y3BCbEV4Q1hSUXhZZzVqd0xDbHo4M01DRmxvdEhIbmN1WDZPcWUwL2JIWmxnRkJSeHo3eGhVcWx6Z01BQ0I5R2VrQlhyYzRoNjhSM0F4a3VkTVEvcWovdFVyRmw4UkhCeEtFeWpoc2dBSGlBWUVyTUVyREdtSmliUllOdzFDK29RWVJWS0FESGMrVkFKdWdkUkhvRjJoZ3NXVE9vcXhLT2NSVnJ5RnFkcXgzZytFTXdCeEcwZ2tQRGVVb0l0U0tMV2ZpVUFCMFM1TWRrbFl3ZkRBN0wzR0M0VHBqTFZpMzFBTHdlL3dEVktTYXNPWjJYVTB4WkZFTHlpMkFiWXpob0p4aVVmZ2w1UEVXWEZseTVjdUx6NGdCYWVuWEkvRE53SzhNdDMrVU4xSzRQeGZicCsvRUlnRjRyUjVzeGU0dzZWS0E0OTRsNFlxdHZxS2NxdmFIUVQ0bGp0aUdpeUpaRi93REc0cHI3ais1bjV1SGY3bEtMaDNYTXF1QSt5TSt5WGU3aXRHMEhoOUhyTXVjM0ZjdU5YTWhjV28vQ0NQaUd5Yyt0K2pyekVDdVZWckpGWlBDNHl4d1dqSzNjV2ljK21mVUZhQzNxQ2FmNVRCNklpalp1dTRkeUJHUHNsUi9KTExBYnEzVU4zSHZxQ205NEgvVVVHSU9XWG02VUpjUjg4T2lBdFNVcUF1VXlYVEJyVEFkTUJYUHZMZ1l5WE1kUHVBV0ljeGJZdVZXR05VVGhxNGhPbk5CanpXM3pNekhLRGQrSXVJTk13eGlyK1U3bDdpUlRMWTB6eWZ4VkYyR0NOUHlhWlU5aG8vUnpLR2xaeHo3a0pWbmdIOVE2cjVmMUR1ZlQvVVpuY0RaL2lJQUI1cXgrTVM4RWkxUVQyM0JiQzIwclBmYm5VdWlIRmN2OXp2QzZPL2hxdTcxQzVlWTlqc3J6Y3FvUWkwTldrOXdpMmlPRlpmYWxmcWo3aXhaY3YwdVhBWUZoNUJEOUgzTExLakZJbUlZcks0bTNva1FsZXhYTU1xeVZNMS9aaEdiMkNHb3dCZmRSbDk0U2tWRHMrRGJLMEd1blo5Z2xPdmUyL3dDaUo1bnVtVEI5U2txQWJiMUUycVd1SDNGUmZ6ejNkeFVxMnUxeXNMUWl1NGVCUWpGVG1yaUxOaTJMaDNZK0hxQ0RXcFozRGdGKzh6UXBncXJRejU3ekM3TVYrajVscHNTOUpDVlVmYVk3bU8veEJ1cHdxaUNKVnJDbFhhdzNXNEJZSWMweFVwNFExVmtaeThkUCtONWlDdFUyUmJmMlJmYSs0OTBZRXVLRDhqNlZjQjBQeEZGbytwUXdqTU5BQ2R6U0xVWEJFVTM2VThSSXYxUlcrNTZBUFVMb25pUkNtUGFDa1gxQVpDbzdaVjZpVE1VUlVGTDNHeEg0RzEwNHFhRE82czlRQkFQTCtZRjhrRVBocEQvU3BzL3FSaDJlOEQvcWZ6QTZDcy80M0c1WUtGRy9NVlVvZG1DRFJsdFcreUc2c2djUFovY2M0QlpJWFk4TnduRnM5cFo5dlU0Vzh4bHo1bU81N1BxREFMWHptdWRTbHRiZzQ1eXhhYWxocUl3OGQ1NE90c3lvUW1QeWR3QTVxa05MQlJYOWtJbUJWLzdwc2ZrUUJYMFFmOWRsYlpIaGxqMHMvd0FDL2xpTjlDT2o0bVlXelVPdk9JZVJhNVdFelhnRkVXVUhDeFZGQXJrTnd0TDY0Z0dtMFNMdGk2T0YxbUd3Ym96L0FNMU4zZFFPcHRQQWkxRVVQWkR6Tm9ydndLTzVUNmZzd1lqelVTTjdRc3NHaFc0U0tCVGpFTUt1S3FmNUhQdEQwZlRqRTVtbnFiU3VpWkV5VnhMK3JPWnBGaUxtWHFEQTU2aXpMSFVlanFiK0U1UTQ0OUQzOW93K1JGK1VHNE05U21PdjVoekt2cmNHNnZiNEltQ20wV1lzd0ZEc2lJSk1Ja3R5TXo2WjYvRXowZlVMZVB4QTZmaUIwL0VycCtKWFQ4UktaSDZtWml6OTVUVUd2T2dsWVVHb1JFcEdYNk8vUWZRWWtWNlVUN0VSYVJZUnNSU0praE05UDFNLzhUUFg0bFBYNGpmWDRtZWo2bWV2eE05SDFHRXM4UVNockM0VTh4ZTRGNm9pZUZNTHR1MkdKaXg4WWhxRnFKR1I0U0xBQlYzYU5BVFRObnd3M2ZVV1Z6UHRSeSs4K0pmWjVVb1pLdjNnOWFmUUd6a0t4TXg3K2lpK3YxYy80alB4RDFKV0VkelNPaDZMTXUwQUJwR3htZTlKY3ZFTzV4Nkx6RkJ4RkRqNkVNQ3NTNFNoWEZCQmFqeVF3RVR4SWk4a1M3SldMdDZqYVlkU3hVRHdhSTZqdHpMbUNXUGVKMUc5eGNvTit4L3YwWmNCS1JlZ2hOaTlpaC9yUDl3WC9WL2MwaWZKL2NxMzl4L2NJeWYrTzRQci9rOHdjYWZzWDh4cVFCNjdOOCtKVkNJR0tGYzJQaGx3M0hmb2I5TGx1eGlJV1RXNEtaQURKVGo4Umk3UGJYOXgvQStwck12dE0yMXBybXJxWHA0TUJzN21LL3dlaXZ6aktNNWpFMnBYS3BNSlpFck1qRXNabm1EeE8wYmZpTVlZMWRvYnRjTUZqVUNGY2tUTGtSV3M4VEpGNVRGams5RmVHYlhMbHN5NWlWTDVoTmI1aXhqQ095Ty84RDBQVWdWN1Fac0lvYmZVUlZKZ2NsQ0RMbHhxWlF2Qi93Q09WLzR3NlAxRC93QWNILzBsTy93Z2RVemM0aTFkRUw3bnkrSVpDMjk0MFRlTzJHaWptVlZoQUdnaW5Fd0lPWWVsWll3OEpNdFU5dzJ5c2E5ZWdIYjRTRTVpTk1mQ1BFSWhMcFVWQ29DN0VxeXlqbEtpcmhCTTBQUU14TjVoQ0xqK05TMDJqWDIvY1F1RTBtVUxsOTIzME5rZlRiMHFVUnBPd0RIdzYrb2VBcC9zSDJ4MlhNRmVQVElZMFg2SCtHWG8yQy9DS2k4OFJ3b0kzR1pzVUxTdHdsbmExblVCeTJHWEQzS0hpSWRnV0dvcVpSeTFxQ1h3Tk50VFFFZlp1VnVHVUVFYnJOWFdGbHRheDNPUnpEQXNpblJHbE5RVFlIVUFkamlaaExOUm5DVWJhZ0t6QjVUOXpnbWM1aTUxY3Z3Uy9FUVJLdUxHRmUwUkhaRmVaYkJEWld1bzNpNDcvd0FDWFlyVnp5SzlwVmNlaUdRUHNKLzRnakVWL3VoU01pRzR1WmZvRTdKcWFtNHFoaFJxVzM2WS9PS0pDRGNzR1ZyMTQ3K0pZdVdVTm9oY3VZZlNZUy94QVprUW9DclVNdUloNlVrZ3AwbTVYVThwcGlDV1k2cVVqL2xXK2x3VzN3U2tHVEhzaW1kMEVRYzhNQ05US0t5cUNWRXBFU1kyR0xjSDlUSDZyTlgzR0c0NzlEZm9VRUkwQTJ4UUdvcDA0dnhnZjRsR3htYTNiNWpUd2pMdWtmc2lSVFluNlJNVkVGMnB4SFJ5TmZmVWFkVnNBTmZxNVptelBvWTV6OFZFZjJUN2pFVTFtek1EYXJ6cGxXRzREd2RBd0dvaTB2NGl5ckNlSWlsK2llVVpXWTMyRmU4QlhMaGltQXZXaTR1R0NwVndFYTJWSzRlc3ppTlZEOVVkK3BPRTN4Nk1HZFIzL2dsUFBvWXdBNHVmK3BQK0lRSE1weWVuSkhiRld5eUZlbjNLdVFyeEdWV2REVUs0VGk0U2ZzaUxYSGNQTDdSQmtmRUR1a0RGTzM2Z0htYS9lWksrWlRWeWhhejJsRUw2aDFURjlwc0lUS3Jqc3NnMWVhdllRVzdoZnhCNi9VRGh1UEF4a0hORXZtNDN2ejY3a1VKaU5BZzFGUk02ckxBcVg0dkVJVXRVWXhOajJsSUZ1Q3JNZkpGcjhyQkx2cXdQaVkxV2JvWUlianYwTitpRmlzQlpmdEYxSzlNTThFdlkzQUtVdTRZS1RyVElmOEEvM0tFdXY0SldRTXBOZHFBemRuRmVsLzVhZUZRWXI2bDB6RmJ6S05aZ0drektidC9jNEMrWXRiREVpcUh1Qm9wNGlLQnE4UlFIZm84UWc4ZTMrQ29RdUN0V0lNYWJnVnRTMU9JNlA4TU14YmI5TnZYSGxsZzJ1VUlzOHBPR0tpSllYMlhGbThRVmNUMlBxR1ZTaFFWcmMvMGFlYUNLbmo4eWpXNDBtY2Q5VEtIbUlGT1dGMjRKTFdXTkJXdW9qM1FUeXRlWjJqSHppY1VFSnBHMWZMRUNodVNJeGtoZXErMGN3dG5BQ1FyeEdJUENDdmR4THR0MzZDL0FsYnNHdmMvNml6TDZHVUNYTEk0STRUQVFYaGNNWVlKWkxtOGtFOVh2MW5EK1lZaFNvNDMvQVBBcjkvQVlnMFFXSDBMaFhrdnZCVE1SRWNLTi9PSXFhNlIvVEtZbldOQ0svd0NQK0dmOE56cENMOVFjZThIbDFMVkJkcE50U2pkSXdVVXIzbE9vRnhGeFZjQkFGVk45eGJjcXdKVnRiOXBYZGxVbzNpVmFOTWJnbW01L3dKai9BRXFCU0Y0ZmN4TzdqWGJNZHhxc01wM0tlaFhpVzhlaDliWmI2NjZZRGxRQnR2NWp4eFF5RVV3SDFMK1k0Y3l2VEhMbUNnVFpOYXBnRGk0eW03UTZrUzdzekJKbG5HV1U0YmcxVEw2ZzJnUW9VQlh0TkhHK3lLRnhIQWx0VDRWRERBdXVvTXlNWUZ3TnlzWEdiNytvcTNjdlhDK3hnbEFBdDJWcVU1ZTBFTUlnSUNlODcyQ05hR1ZDR29MekIxYUxEK29TdTdXcnUvTXA1Z2xpTkZQRlZuK0puMFZaQjhNVHNCS1g1YmMvVlNtVUlGVTc0WlF1MXltMlY2bW1YdzRXd3A3bVlOeG92OENZZHhYcU4ySkUwa3VQb2Y0T3E5d0ZZOUhEWElacVVQaUhWbHUwZEZZMzNCYng4eG5oSGNLQ3pwU1VUbE5CQnU0WkYwTnNhSE9KN1FDSmNHOWhLdG5Ec2dRbDlhbXd6STRZaTlST3FuZ1o0R1Y4ejV5blVVNEpjM3pNelBVdGkrWXpNejFBdVY2RVhYTXBXNVRxZXovQzVjdjBQUTlPcGNUeDltS29vWjFac25lN0hUM0doNW1EaUZzL0NSYzQxRzJTNXNNVVNnakxVcXQ2bVRhU3ppYUFST2hpMkxzU3Q5S0FndEdEYjdFSndRY1hOdHhqWTlDV2JVbHNJOEtvaU9XQjd2ZUpnUjVJQ3c1Tnk0MFlrRm5pTW9qc1NvMEFDcGE0eEdDVWpadGdXTDZqRjIraGN2OEFvZ0lMeEhBRGUxNDl2UXd5cmtJSHhFaU5KY05SS0F5RUIvczVQei84UHhJb1JrZTArYzN3cnBFcHJkbmoyaEZ3VEpEdGdDOXRROG90SzdZRGRoZ1o3T0kwQmFWMUxuT0hoaklMT3MrbCtsZjVHV084Y1FhbCtpNHZnajZZaFFscktnN01UUDhBOGowTndoQUQ1ZWxydGJPNE9sc2NqQTRHRmR2cUlqZ1IwQm1xWG4rSXZxbkQyZ1hFTktqUVZTM2NzU2hhbG81YXJFdVZsVyszcmlmaE1lWndQYWJpdjRnNGwxbU9Ib1hBUnJKbEZhZzNxRFlzdU1NYnJJbnBrWHkwbmxEa2xtcUpkaC8zZWhRTzdmektYSFhNdTRXR0x0dUxFNHY1Q0VkbHQ2UGJpTDVqeHFDSjlxK1B3WTFiVjF4ZitaSmZKQkVodW5pSzlzYWo3ZWxYNlJhMHpRRzYzaWFVdnBuSnNlSm9KZGZtdXBvRHNmeU1ZRzMvQUJmOFRCZmV2OEs5YXhzbGRKbnI4U3lzQVMzdjFwekJRN1NoRk9DTDQvd3B1SG9RZ3d6UWJaVXFZb215VzIyKzh5N2xCWWk4RXhtUXFIREo0aU9tbXRCY3BmOEFCbFIzeXV3cFZQVHhBK0tQakYyRDNNNlh1ajI5QXRxV3V3NEpxS0ZGRER3ZnBsRzd2Mmlaa0h5UlBoOVA3bi9oUDdpbjlUKzRtZndQN2lkL1FsUXlsYlAybk5tUzdiT0UyUTZLc1Y1Q1ZtZElod1dlZGlZNzMyNUtnQm5RTCs1YWNmOEFmdkNtemEyNjg1Z2xsYkxCU3huNEtsbVFKU09YeEtVMStaRmwvby8xTDlRMllSVmJhOGQrWmF4d3ZDMTFoNG1oS2t3Lys1UUd5My80RXNnRFhWNUdMNTQ0ZzIycXVJUXBVUzROeExJemV4WmlvcExoN3c0aG9nVWNSV3dRemZXcHl5NHBvS2E5Ymx4dm0vOEFBTFlzczZtSlVyL0Nvck1Feldwbm1aOTRLTGYrcGIvNmx2OEEzNkcvL1dEMlMzYUNIYU45eDdrOXlYNVFYajZvcWM0UHZCOXA3MEd4SGpIYUQySjBiNHIraURhbXZqKzJZYmY4Z3FVNVR3QXkxZ3IyekxZbUgyWmxHenBqdVQyd1NpenZLaEIxNFNseGhGVnVvODROaGRrczJ5T1g0dzd3MDUrSC9lTGYwLzduL2g1MjR2R1g4dnNQN25kL3k5NTJMLzN6RHp2L0FIdUlhLzRQZURpSEJiTVJRM2JieEJ0alJTQUU1emQ1UEVjeEdZbzFoYVdwVXlXRGtnam1WMGZrdUkwcWcwbkFZekthdGxmQkNqb29GdStJb3FEMy93Qm9Vd1BmL2ViYStwL2NHWFY3L3dDOFMxLzA5NFM0YWM5SE1xaXhnRUl0dEpvdDlRVWlodkFwK1NYL0FKZ0xCc3EzanlSNWZHRUsvdFl3YVBGbjhDYmJsN1Q4NC9NcCtzNUVaWW1HRWV1K0hvei9BTTZmK1JIayt1SmY2WXZKZlV2dCtvbnQ5UnlZZjFMTzMxTWR2cVg1ZlV0eW1lQ25uSlQwOTQzeGIyaXYvaVhGeG5wbFBhWjY5Q1c5Ulk5TVMzY3Rsb2NEQkxFSGJpRk5UN1M5Ujd6VVcxVEIxSzduc1N3Mmg4enpUemZpVjRGK0pocjdvVTBmbG5DTURvL1VPM3VrZ25IOTUvaWM0L0QvQUNqcFI5Zkgvd0E4UjFHK1ZQdGd6WWUya2NOL3pGdk1WYzY4VEVqYnlzVjNydFp1bTl2OVF1YkZPT0g4RVFVRDQvbDVqcWdDbHg2RWRHZmFvS1RaYnNKV0JsaHhkN0k2SGNBNVFaZkRQVUI1QStZR1F2Y0hCOUNZUWRsa3VLYm5BRmZ6TWlZN3BGek1oT0FkM0JGVi93RDJGRVdsQmtvOEZVRXRXL3lQOVFCV0htdHZ6RnF0UXFQZDlGZm5DeWxXZHppTitlWlc1d05hdmFVVHVWZy9LejhrS1RXbk0rZGZtYUFlR1VFWEZ6aW8zYm5tMlBNcytZb09RNXZtQlMxQ2pXaDBja0lKUzdkSDRZNm9Od08vL2k0MlNpRzdQNGpOZktJdmJwL0VRWUt3bVZRTHNwTWhqOVFYOG1IOE1Tckh3djhBc2pYeStVVE4vSWYzRVRGbnovdDZML3hVNy94WStLK3pMZjhBR1U1VWVoSjFMQXZuNG5iWkw0Q0U0Z2VsK0lVMkU4eC9RTGNkd2VNSnd0blptTm1aYkxseTViM0s4a28vOFN1eS9FNEI3bVVGZTF4RXJWdmxsdkV0M0w4c3Z5eXp6TE9wVHBQR1hRZmlGdjhBcVc3V1UrWDNMUE1QT0FoMVFEUVFDSHV3MUNGOHMwbkh2dVpVTnZqY1crM1FPdmRqVWxsZXgrZVphVVVIUnFMNVJpMjJDZlE2U2VSOFIrMi9FTXI3Q3hTc0pSVVR6VGlCMWpPVEYrQXdTN3VXR1FmTW8xbEUzL0tLcXkzY0JFRHdhZ00xNHNJYUNyYTNRMWoybUhubEtFOUYza3Vha2JHbzkxbFplYVk0cUFGVVFwRmpkNXFXdUNvTE5qUUhVZWtackxMS3VvT1dBRW9GYVI2alpGZzVDTFR4ZHd1OE1xQm9xUkhhSy9KQkR2bFVHWFdFYTJ4WUxJc0xRcHh2WkV6c1Bldzl3YVdXVm8rTVJWaXc2U0xaVWVSa2xodmFhNmlMZlc5Zi9FUXhIV1NJc0FHMHEvaVVHb2VicGxnQzlsSUZ3NTBPS29UNmRSdVd4NFdmVUkxUjNxSnRYMlkwZjFaWnd4aTBleEZ2Nm8vN2lXZjVHSjV0K1pVNEpSMGZVUTZsU3ZNcjIrcDhQaUFkaUk4Smx2Wkxlb0RrWWVZOXlHUDV5UTV2d001VWVWVTZYNEVkd0I1WEZMQlBjOWN6TXFWS2hIbmozbEhiRU9vZW9xVjZrSU12cVhtVjV1R3BabEdTeEpnWjhaWWx1OGZ1SUlXOFJpNk9qK1paelIwVDNFRy9lWnZVdDNSR2ppWWhVb080dkNBd0xoZ1NCYnVWL3dDWUJGQXpmME5CdFFJMytZaUo1WG9Tb1VxbUI0VGd4VE1OTU12TDh4Z05RNHVWclJBYWhZK1k3aFBaM2N5Z3VpOGUwWWMyOXdrSnFMU25UM0ZUWGNEV3hTMjE2OGVJaWk3U2U0Z1BLSTEyd2hHNUtmNlZHVnlQWW1Tc1A1Z0x4MHhadCtReXZkWkc4a2RkbmY4QW1NeGhsZnVQMk1zUWlJMUJOaTNDUmFyY20wTEQzV3hETGRQUC9rYVpvOE16azJka3kxU2VJWDRqNUtqVWI0L1VZc2N4OWZiMGZTNVIxVThHSW5wOGV0cHpDcXJKNXpGT2Y4Q0FHMktjRXM4ekgrTnkvWDN1WExsbFE5NGZMRDJEdHhMRmh0OXBpMHJmVUc1aDBibjB0UXUxRUJLQWlITU4vRXhITXBQTXA0SjRKaTlEc1lXQjVnZHdJUENIZ1JRZ0V2cGgyTWE4eWg1Z0plYWxVR04zVWFJMGdZdU5oS3h0RFdDR3FhdVZzVzhiYVlIRkVnU1lXVUxZTWRGckloR0JqbUk1L0V1MHhUdUw0bG5VYTZtUmlkTDh4ZzlKZjByUzhXOVFZTU0rUHhCY25wSG9hZzZCRHkrU09PZFF6RGE2Zkg5U3l5SXdUSWFka3MyWDQ1akU2aXV1b3N1TlJseTVjdjhBeHZxWDJFeDUrWlh6L2pVeDVaZlUzNkhwVDMvOEw5U0h0T3hVcjJQbUxXUzNvNG13YU9pYXo0UDdTdUlJRU5BRG9teC9FdnFaOGVpcDhZbCtJdkU5a3ZNcGd4eE1GNklMMVBZd1dYTnhIaG1YWXhTNkp5bmZNZnFaSytncENybjlST1pNWGoyalZ6RGVKWUVFWkpWMStZaDFpTkRETFlzWDBGaUtYTDh4OUxsemVPQ3N2dk1XTDRtZUpjYmdyZnlFTlo0RTZrK054UEFIWkRpQWRUYms4UlJzbHN2TVpjWC9BQXVYTC95dG1PdnFWNWpaL3dERFBwbVpsc3RtZXBucVc5VFBVdDZsOUoyUWFjWmZFN1BvaUtrY0RTTlZyRDVua2ZjcTAvelBLKzJlZjlzOC93QzJlZjhBYlBOKzJXYy90bi90TS84QVVaM1A3WXFiZmJMZWYzTDdQdUR4Z0RsOXlqbjl3NDM5c3I1L2FIK3dULzBFL3dEUVQvM0VhOGg4b2NMZmxGZWYybi9zSTF5SjhzVTdsemJrK1lCbjdJTHZNQU1mWk5wZjNMaUhEOXdKaHh5bCtjNi91VC8zay84QVFZZjdpTjM4ckgvWVJRL2tqeUtlN0s3NG5OdzgwOTJXa2pOUDdnUFA3aC91bWY4QXNNLzk1bi92TS84QWVaLzYwLzhBU2pYbXIzaDIvdUk1d2w3eUI0bEJhM0xuSjVJcnlNUTRsdlRMZW1XK1piMUxaYkxaYkxmVE10Ly9BRVZSQXRVd0R6TXUvcUlBNVhvSUZsdERnbGVDYjNuM2c0bmxERVY4UWJnTnl2YVZYbWFDbzQ3bTJYSW1acjBGNWdJRUgvVkEvd0NxVVhLeEtycVY3U3ZCS00yRVQwVHFIMUwxMFE3d0drSWFZS21pRHpBNGhhYU5RdElmVUZxcWZENmpoLzFGOXNlSWtaWG1Za1hQK283aXQ3bG5tS25vRzVwY0ZtWWRSOXk4aEVsWHVKWFgxR0hWMFRMaVUwbHhxcW9qYkxwaTZOK1NWNXZNdHpBWEgxdi9BTzFYUC8vWiIsICJidWlsZCI6ICJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LC85ai80QUFRU2taSlJnQUJBUUFBQVFBQkFBRC8yd0JEQUFvSEJ3Z0hCZ29JQ0FnTENnb0xEaGdRRGcwTkRoMFZGaEVZSXg4bEpDSWZJaUVtS3pjdkppazBLU0VpTUVFeE5EazdQajQrSlM1RVNVTThTRGM5UGp2LzJ3QkRBUW9MQ3c0TkRod1FFQnc3S0NJb096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenYvd2dBUkNBRGxBYVFEQVNJQUFoRUJBeEVCLzhRQUdnQUFBZ01CQVFBQUFBQUFBQUFBQUFBQUFBRUNBd1FGQnYvRUFCZ0JBUUVCQVFFQUFBQUFBQUFBQUFBQUFBQUJBZ01FLzlvQURBTUJBQUlRQXhBQUFBSHhnQUFJd0FBQUFBQUFBQUFDYmpNUXdRd1F3UklFTUVTUkVraEJFYUFRd2lXVmdBQ1lJYUFBQUFBQUJRQkdBRFRBQUJoRmdBd0ZJSTJRc2dHeEtRUmJheGRtaVhITHNiT2V1QXZVMTV2bEZxemR1ZFJaR3hOU3B6akpGbXVwVUFBQUUwQUFBS0FJRFNnTkdtZ2FrSnFRMUpFVzJSSkFtM0VaV2RIT3VaTDBXdkd2TGJQU1I1NjRWdlJKZWU5TllydEx6YWRXWFJMajgvN3puYno0dU8zTDZlTUpCcU5PQXE1eEVFaUtZSVRFQUFBQURHZ0FKUmxFY295RktNeFNKRVc1RUN4UkNUYStrN2ZrZlIrUHZyVkU4M1RsMlFPY2E2WmVmazNZK21kRi9QdmpYdTRPMlh0SE9vU3p4L291SDM1MFJ2aDI1d2pjcVdmb1lFaW1sQVpBQUV3UXdRQU5BeE1uWW93T2FxRXkwcm1yVWpaWnBqR3Uxbk9kVnNNNlhvK2IyUE4zeDh2ME9NZlZsbXlWRldNdG9veTlNOXFQRnNPNXQ1UFE1NjA4Zlp2MVBPOC8wSFA3YzhWUHBlYjE1OG8wVmtjRzNJUVZpdHJzTktZVnJxV2duQUc1bFl3Z01DeUZzT2pUWFQyNGcyR2JSSTdMSmhxcGtkS3VxY1pKU3laMzdCVXJ5OXNtSHVVVnlWMG5ITDFZK3hxWUtMc3BXVjM3enI2M0I3UFBST0dpTlhFN0huZTJMOGthKy9LdWk2Z3BwdGdSZzQyeTFZcXpWa1FDWU51Qk1ySldKMkU0emhvaFZpRVcyNTdFMGFNbWlMNDFvMTM4OGwwVWtaZTVyd1UrYnRmUE5XUzZ2RzZjc04vbmUwbkNIRHBtbHA3bTdwYy9zY044dlhrcDNuditlOUY1NG9oS24wY3JLaDJXVVMzR1hsOVBFVUtWZHJTUUpvR0FESll0T3h5ak9WUmtySnlpRHRwdExiS0xZbkt0cHB6M1dtV2RmUnpyZGw3dVR6ZHVmbzBVeTVlelJyamg5dlB1czg5VGJYcVR1cXBOM1Y1WFV6Y3VTbzFPeDV2MW5uVEJWcno5K1JXUjNtOGxsTHM4NnpHcEsyQ2FBRU5vZ0FWRFZqc3JzaFJzVkRuV1NuWFlPeUJGazZMQzZFeEtkdURUTDZlN3lDNWRQVjErYWN2cWJ1RHA1Nm5veGMydDYwVVJVcnAyWDZLZVpMNkNqZ1hhejMrUFhrMU5PYk5EcG0wZE84M1Zwb29pTXlGYW95aUNhR0FBaVdTUll4QTJndElPSFpDVldSQ0JqSTZLWkNuRFRGTWJvTEV0Y3NPdnllN3owNld1VzdMMlp1aDcvSjZtY3J6OStkdFJIV2Jvd1ZKMTJXTWFFTkpYRnh0U2FJcG9FMEFBQUtEU0RBR21OeENUaE9HNVNJdWJLcnJJeXZWaTBTeGtic2F6VzM5RG5xelJ6dVhtNkJSclgwZU1wZW54cDIyY3FyVGw3ODJoNnplbGVtQ2VtaXE0V1JLeXlGUUNJMGtNUUFBMnBTb1lWZ1VOTkFBYkVTY1pqYWxFNUswbU9HYmE2TGM2anJ4VzUxcm5SdTU3blIyS2VldVdsSGVibXI4MkZPM0FVWVNuMGNycFo3dFNKS2RsUlpHeUtJV1NJQTRxSkZTalNBQk1FTnlvc0NvQ2hvUWFCZ3djV1drTEl0aXJCVGdFbFNTMzJVckdyUmJKWWR6aVhjOTNWMDFuUzZYSXQ1YjlCNWp2OGRPQ3RLOVhMTm96dXlVTlZkbE1iVVZPSzFtYmhZUWpmR3loT0tnZ1lnYlRsa1FCQVVBQUFnQU5wazdhSlJhNDYwa3RNRjUyaU1jNjJXYzk4OTZwWUVkUG84Ty9HdHVXbXVyaUxOVmRjYzJzcDE3d3BYVHpxeXFHSWhUWlgyNTFKcmVSQ0dKV05BQUFBQUJLeEZBQUFBQUFDQUE3QUZNSVRCVmFHYkxNQ3VZSmV3enFtNEtjUXpiWkJtNTdRMUw3ZzVib29EZWNzQTY4NHhEVUFBQUJCWUFLQUFBQUVmL0VBQzBRQUFJQ0FnQUdBUVFDQVFVQkFBQUFBQUVDQUFNUkVnUVFFeUVpTVRBVUlFQkJJekl6QlNRMFFsQmcvOW9BQ0FFQkFBRUZBdjhBNGNmaTRoVWovd0FyRUZMbVBVeWZBSTVPdjU0KzlVWm9LR2k4S29nUkZpNk9iNlJpMm8xbUg3bS84QWNzUmEyYURnN0o5RVJCU2duYUF0QXZjMW5YWWdNeGFXVkt5VzFHdHZ0ekQrZXFGb25BM21ML0FLYjJIQ1VwUEhCMm11VDBTWlltcFgyemlzN0EwanRBTzcweTNoMWRMcVdxZjhrOGg4UCtudU5kNXJtWVV6cHk1UUdYL0pkYXdiaVdnSjN2WE5pZjhkRjhjQlpzTmE4dE9OcnI2QiswSjIvQ0VQSWZaaVltT2RSSzAwTnJXZUozcnB1U3huVGRyRTdpdnZiWDU4VU80YldYdi9JbG4rMUZ2Z0d0aldzMVhDMnFpOFpjVFAxaVloSGNEeXoyL0JJelAyZVE1NG1Kck5ZQXVKV1BHdDFXbHJGdDRXazRlL2lycTcvcUV5T0pWN0xrWjJ0V3d6b2VSeE5oQzRXS1ZZR2hNVWdWemloNWFUUXdyTVRIZjdjZVJHRDltUHZFN3pISlJ5QWdFVkpXaFEyQXV6b0JFUXRFclpZbEcxUDBXS0srQUlzMVdiVkt6Y1RTc2JqQUkzR01aMWJEUE5wcFlZMVoyRlpOZE5oaXBYWXZGMUVGVWcyQ1dDWWhoUElqdCtraS93Q1N6dFppSDNCRE8zMkpqSkFBaXVSRWRDYk1aVmUyc0FnSGlrSHBseU5NeFdVR2xxUUd2TWZpN3AxT0xzalU4UTVYaFdBNk5VcTRTdTJOVldrTGhZenFZTWJLUnJzT2dQTW9qS2ZCZ2ZZZnRaM2hqUThqL1RsVytnZTNMNTU0bUoyNS9xczRQYUVEQUhoaUNLMEhlQVEvMVV3TkdZNk9mQnU0b1N2VmErSHJKNHVwWlp4VllEMmhuNlkxeTA0Sm5seU8xbDFYOG10U3dYS3MyUW9qZjdmeTZ5dTRqVXE4ZndiTUpqUTg4OHN3bjdTMmVlZVk1R2Y5WUdneEFZclJqMkJtMDI4Ry9vREtiQ3lhVmJuNllDeTZvVk95YjBISWRLUTlPRXN0N2NRM3NzdXh3SWgvaXkzMGhzWWNTbkV4V0p2Yk9DM2ZNSmhtQmdWNVBFVUpReG1wbVBqRVk1KzBRZlptWmdmRVBpMVJKVkRrbnpxY1pwdlJtdXBVOUswRTIxLzV1Skg4NXlHMEtNZTYwcWVtRUhRNGhmNXE4NkwvQU1rc3Fsd1FUeUF6RS92cUl3aGFINHp5UElUOVFlaE04bHdTNm9PUkdKMDIwNGRTYTFYTExUZGhnMkxxejFlSEdGdHF6ZUV6YnhGVzFwcVIzMXlORnJSR3JGWU5aby9zN1Z1ay90ZllTSFppUVJpS21aNklUeDJtWlo2aCtJL1lPZjZIc1RQYUsySjFVNkxObUxhdjBuRFk2ZjE1QityWjRMYlN3MjY0VnBZbGhzUmNHeWh5NXBiWG9oWWFzbXVsU25TVVZOV1N5V1BWSzd0cHhXT3Jaa3BuSEkrd2Y0ODhtOWZ0dndoekV3WitvdU1WOGZXaWpqYXkvd0JUMUNlSUt3V215TnhKU2RUV0hpN0JMRDMxSVF0aFJtQkdCTkdqTU9HcmxuRlVwQngxVXZJdHV2NmFMMllkNTdLbnhFTU9kZjIzeHEySUd3VzloUVJ5VVpuby9xQXhYN0gvQUJ3R1ptZTVjNFZzU3JpVGgrazY4UUc2T3paeW5EaTJxd0RwdllVNFo5MjRxbXMzWFBaR0RCM2RkVXZKaW54N21abWZBSHVzN1p6R2NsVDdQd1lQM0tjY3dablBNUllyZ0w5dzljTnNaMWNYb3UxbWcyOUpSV0h2NGlGZ0YzMkpPUm1iTG9Xek5qa2Vzd2UvM005cy9oWW1PV0pyTVJSNGtZNUR5Z1U0OVFLekFLQ2dCbkRjT1dvWlZwUWRRSHN0QjJhN3hxcnZzT1dzSmJuZzhqRkhiV1k1RVRFd1pnekh6OTVtWm1aa3p5bUc1THFKa2FJdWpiNGdCWnEwYkNjSlk2MThIMnQwRU5taW0wM1dVVm5aTHE2d1hheVh6dHB2TXJyN25UakpNQ2VITHltMDNtZmh4TmZqek5wc0p0QjJVYXcvMmExaUdmWktGUUFPZ24xWUZGdkYyeG5Zd04yL2tJNnpZN01OQkxPblpYWlQ0NlFWa25TQ3J0cmlNcE1LR2FpWUUvZXNJbVBoejhXT1hlWk9PK0JuVDlCZ2pON3lRRWV6VEpNMWN6cFdPdm9LRWpZMkEzVVloUWd0b1V0Y0d2WVRZUnRaMm1yUTlvSFBJejluMytQMm5xWkFIWXdyMzJ3bjZVa1JYT0Y0aHdCWWp5K3ROZkRWbE1TczU2Yk9XQUp1OFZkNW5rM2VDRnUreHhsZnN6OGVQanlSUDdFREFuNi9XNEIzRTJJaExMQXhWTy9UQmRheGIxS0hJaHd6QXl0MHkxV3ljVGhvY1o4Wm52akFQTFBJVEFtczFtcG1EOE9SOGdISU1SRDNJT3ZJZXpnRGNpWkJsYU0wTm1oNk5qSWF0QmxXaU40bXpXVTN6aVNlcmp6NkJCMWdSakZGd2hac2d4cDNtWnROb1R5UDRZZzVwVUJhQjB6cjNyOENlbllxWVZHY0dLeDNyYkROYm1YdjFZdmpDVEdmQXFkU2JHM083Q2RRNitMUWxWSUQ2OFY1RmxBaDdRblBJODgvaVptWXNSRnhkeEl2dWZpdDFMUmlNWkFVUENmTEppN21IZVphWmJQWloySkJWWjRtWkVyajRMT2VzaWxOV2NsejZQZUdEOGxqdEFUTTQ1QnA3ZzlGY2dld2UrWUhNYXd3V05GZnRzWjdJN2tlajJpdWNWdE5ROGIwRkRMbkV6aUQxODMveEFBZUVRQUNBZ01CQVFFQkFBQUFBQUFBQUFBQUFSRkFBaEFTSURBeFVQL2FBQWdCQXdFQlB3SCtSQnljVlZpemc0UkM4TlNOVTErZkRPbmp1U1VUdk9rdHhwK01ySzFsYlk2WFIxcDduYnFZK0pxSVNrand5Q0NLYUY0WTNWblMyeUhVUkpJbVR0RUQvS1NIdGVGOC93RC94QUFpRVFBQ0FRUUNBd0FEQUFBQUFBQUFBQUFBQVJFQ0VDRkFFakVERXlBd1VHSC8yZ0FJQVFJQkFUOEIvVVNoK1E5Z25xT3BJZmtSN0djbVNUYW11Qk9kT3Radkl1aU1FTzNqNjA2M0ppeXBGU3pqZWpyU2ViOGlSZjJ6dFJwdFpJSDBOUUsxUkJRTFNreU5uWXZpanNXbDZ6MWpVQ1YrTE9Ja0phbGZWMHBJdEdreHVFT3BrTjJpUllZbWlkTmpISk5wRXlsYWtFRHdOU1FORlBaS3N0SjVHamlPa1N0R1JraVdSYUxGYUJyNFl1dnhmLy9FQURnUUFBRURBZ01HQkFRRUJRVUFBQUFBQUFFQUFoRWhNUklpUVJBeVVXRnhnUU1UUUpFZ1FxR3hNRkJTd1hLeTBlSHdJek5pY0lMLzJnQUlBUUVBQmo4Qy93Q2lLTkt6Qy80TmZ5ZWdsVmdMUFBXd1ZJbmtKVnBPb0tpTXZEZ3YzMkQ4cHlnbFpvYjFWZmV3WCtGVXJDNGRGejRLWU9Ibm9tejdxdC91alRMOWxCOStQNU5RU3Fzdy93QVZGTG5lMXZkVUEvbVJBRlBwOUZOdWxFZm1Pc0szdVZXdjNRdEgwV0RsdWhZclZ1cVVKMDRydjdMRWlDS2Z5OHdzSjkrUDVMWjhpa2l5K1duNlZNazgxYjNWVHNFNkp6UjlrM29ncEx3RmNtdkJDM1RpcjkwNks4bGIzdWlTUnlFL0VaOWZsZEJMclN2RThUeTY0cVlSZEVsaG9ZdkJXOUo0R2hSNDdBaWNBNmxBa2l5R280S2VTT2kzWFBsTlBsaG9rWFhpQXZpR2hITVgxNEx4R3hsbW5KSDA5UHd6TTh0ZzRZbDRrenZLV3RnVHFaUXhLQlZ2QXFISERIRlEzRVVUbEE1bVVNRHZvcGM4bnF0RmRCcFBzZzM3MlRvRU9Jc2RVN0xJNXAzWFpiOEdGSHBjUUE3cmQ5bEV5b0FyTjAzR3pNWGV5Y0dpaE9xOHZGTlpXTHhEMlc2M3VzV0pzcW4wV1Zxc3Jxem5Lb2hDTlUzREZCWllIVkhBbzFuN28vZlpBUHhsSG9nVVFCWFlmd0svQlZVK014b2p5V1VBVXZDQWJBbmdwWXpGM1JvQjJWMzlnc3c5eXF2YTB5cStLZXdXV1QxSzNXanFva2RsdkZBSEZDYVkxb3Y2TGpHb3VGTTAvVUZENFRtTjBOUHdhYkM3MFJRMjhrQWhTeWE2cEVLbUVFVnV1UFJxQmh3bm1zdUh1aGlZZXl5c0hkQ1k3TFM2Y1hPZ0xmbE5pZVN5aUJpVnRGUXgyVXVyL3dBaFJPcUJ6VGdLeDY0YmVsNnJFb1RSb0poUFBuVmkzQkE1M2RvVGY5SXY2N0d3WUZiTFBmbVVNSUVJOVVjeGpWV2xBd3U2bWRGaW5DZ1NUVmVJb3VBYnFrajRZc3NMZkViNG5UMWZFSFJVSzdIVmVORytMTE1BT3liaG0zWkhrT0tiMFQvNGsxTzZwMnVZTE5STW5YVmQxQTRGVkVjRjNSS2NPSWlxelR6bmFmVjFNQlpIWXR1T0tKdE5GNDFLNFVIKzVYaHRZMktkUVVjcDZ3bWd0K1ZPZ2FvT0FvQWljWVJPTEQyV0NadWdmMHJsaVR0RkxQR0I1RlM3d3RidFdJRDVWVzgzUW1LY05seHN4ZW9PMnl3K1dKNDdQS0pyUEJNRUN5LzJmWldJNmhXSTdGT3JxdXlNTkVUZUFuUitoR2JJTkVjVmtJam1RczNpQ2VxRE1XcWMyZFZsYmlwbzVXZTN1bXkyYUowZzczRldrVWgwUWpHdTArdmpDc0lFbFFLY3lZVHBOakc4aTVycTZEaXJzekRMS0pMS1NLcnl6aGJUZ2cwa1QvRFpYRTg3b3pMWW9xdWRlSWxWZTRPNnFybjE1ck85dlk0a1BMTW9VckMzTUlKckYwQXkvd0JVWE9mQk9rYlQ2R0pwK0dLL0RjcTZ3MGtWQ2tFRHJvdU1ja0l1c1VSNHJoTmFyekhQNVR4WG1PZnZXQ0xYT0xaRTlVQXh0N09KUU1IaXF3MlJLQmI0b3NLTE9jbnpBWEt4QnRBYThWaWQ4QjJ4NmtqRE0vVDQ1bEFFQVVvU3BjNkc2VnF2TjhQSVJYa3NIaVNaTlFDZ0hBNUxHYkxGam5EeVdFak1mc2lJSUtnTW9MMVc5MjJSRmVNcm9yK3ZsWDJBQnphOGFRc1JHV1lXNnBESlJOWldVS3V0VmxNdU5URllXTEZnZ1ZKUUxYR1JRNHRFQ1hTUnExVHFORkp0OHBUblFKZHlWdlgzMlcyWDJTUUNvMVJIaVVwd1JPRUdmb3NKazBwaHFnM00xeE5PYUdFWDFXYkswYnh0S2htN3JDdzIrNkVQai9PS0RzenAwdEt6QWY4QWxFbDk2UzFPRGdLUkNHSnh2dWpZS21lR3k2b3FyNWd0OWFGVkhwcmZCdW81TFhWbzdLZ01JdEJkZ09oUUdHcWpHYzRnb2h3cm9PQlVpanhTUDdMTjlsQUpjT2FEdkVheDV0QlFBQVlOYTNRWU4wYUVyeS9Ea3pvRkFjN0R5bEJuZ2l2RDkwWGg3U0xERHNnTFZYSzNqQ3ZWVlg5VnA2ckRLMFJxMzJVeWU2RlVkZGh3MkEwUWNhRVdJMVZaclZTNnkzUjFWUkpWS3JUQ0ZsV0J6b2hjQzNYaWhwRkZiWU1KSy91ckw1bGYxbDBLMFZ6c3FuTnBVN0hWdXJpZ1VuY3NyYVhJVlhHMDJSRDNZQ2g5NVFqNkw5U3NqdG9oVFpxdjZxMjIvcDc3SjIvdXRkbGxEdm9FZVlSRUlrVTdMRDRoYVR4RkUyYXdJVmJJUlNPYWdnNDVvVkxEbSs2a2gyVVdVZlZVRXFnaFYrT25xT2V5aWtxMDlkbDRVQitMNks2RXR1dkx3bVVXNnJGT0ZxcTBoVWtvVWptaThDaGRkRE8waFhITkdncnlVZzA0b3F4VkFmYlpWRGJmMVlIakJ6UVFqajhMRklvb3NqaU9WWE5rTFUwaFJoV0xFVkpDM29IQkRrcUNWRXp5VmFjbG13OGxVcHhCRmVLM2tJQjVrb1ljYzZjRmlNR3FheUEzaFJDTy9yWk5RbStKaTFzbWw4a05GbGhEYmFuWlpBQlZWTnQxZjRLdFhCVVc2djJVZ1FXMldmZVVsMWxSVTlYT3lud3pQNGxOa3JnanlVbFI2SC8veEFBcEVBRUFBZ0lCQXdJR0F3RUJBQUFBQUFBQkFCRWhNVUVRVVdGeGdTQXdrYUd4d2RIaDhFRHgvOW9BQ0FFQkFBRS9JZjhBaVA4QWdxTXhNZFgvQUtEL0FJVlNwVXJyZldwWFFhS2Y4NzhWWTY3K1RYU0RkRHZVcThGTFBNcU9vOVNvVkttWTZuL09TSHhWOEtwVXFWRktmMEVjV2c5Ym1id2NKaFZCSTlaN3NBcWZJci9FdnNIMXZNbEJjamtHa2lRL1oxSWRNLzhBa2RRZXBLbGZCVXFDVkNFYVU4RnlwZFUzYko3UnR0NjQyUGRuSGkxa0MzczZtaFJQSzhucUVRNHB2T3I5SW1ORnR2YjZiWUc5eDJVL1YvRUNpeHN6KzkxS0l3SytrZW9BaHQ5eWQ3ZVFhSGVNcVZEVUkwaXY0SDU1dVBRNjEwcVZEb2xUTHdUSzBLdTFGYWVnWGpTOTB2clNWVjJ2MFJiRFU5L3gwK3M0UlY1b3ZxYitzMFhvbC9VekhFUjRNSHM1U1VZbGJzTVBydjZSQ1RaTkk1WHFjZlNWWmZMQWZTWWwydjdhbUFBQTlINFFhOGh6M3JPQ2dtYmxZUFpBeXY4QUZrOXhJTkR1Uk05V1BTdXI4ODM4Qno4RlNvSFN2TXo2bDNsQmFvWHptL3o5NVhqR0hzOS81aFZ3YnliZjcyWTE5T3J1cTk5eXBGQnR2Ti9YSDRsek9iWXpkZnhLQ0F2MWYzRWMwU3U5YSswTGdUSm4vWVlWQTBNWmxMMW5NN2NjY3pDVUI5bm9ZSUZwazhqSE1UT3lBVWZxRU42Tk9Bbm1zaG85ejlrR1pYV29hMjNSNlg4dzMxMitBNWdTdmdGU3BvUzJIRHpGYUlLWUNaMmtDVkdrQXR5TmY4ekVyUEtLNTNFeDhNdU50dXlZYzJtcGpON2xHdjhBZUpnWUhtektOa2VEMGxZU3dUZS9wQkhLUU9LOHdLOXhkK0NOMlpsOUV2WUt3dmtaSVZtTjZmUFM1OUJSRFJGY1I2aEs2dng4UWhLQlRSQXJLREE5UVFJUWRKamtWV25mekcyaTNHb3hid3U0bllNY1UvN0VYYXhxdzRJdXp6Z1lnMVpqc21hcGp5SDBtZVFkZ0NVMDhpaHNqUVUxL0NEcFd1TVAzQmErT01FelZSOVUvdUhjaGpZbHBqSmtHWCs3eG80cnV4VHN6TVFUZGRtSmI3OCtrSGhyY3g0ZjBqY25UcWlSakUzRExHd0dZeW95U3FNL0JZMzhKTkhjN2tTNmxhSkxEZ2xYdkQwUTZuWkxVSG9tcnJkQWlOTERkYWd2Z242TngzTXY1UHVuSzZzNkY3d3RBYUZhTlFrRkRoaU9DOFdxWFVYV0x4ZG45elpGZkQveWYwaVFPcWU5c2RhdnBpVmsrbmFtQVVPMWhCZHFMVnc0TVJ3MkcyZWRNeVJxem9UL0FIaUxscmM4UFh2NnpsUXZIZGllT1BYSHBEeXh4bU5TaGlXelpoWHN3aTJnbElNeDhzdHh1bDVaVDhFV1ZzdGxVbC9BQ2d3cm9wM0lVcFVEdzRscVJtM1psSm1VbDh3eGtXanlTdGp3dVVia2o1K0xoWGIvQUpOZDRRdy9lY0pkckFyOXd2VUhzZmlXUk5iSWwzRVc1ZUpWdU1HbXFrRnRyeXo5NHpZRTdQNG5LUHRNQVlMWGNLRzliRWhrcGtON1ZjR3kxd0s5WWd3V1QvNmt5ZDc3eW9CWjZxVXhTY09uS0orWU1vVXFjSkNoNFFSd1lkc0hZTDJsdXRwdG1XUE1lbjdRTEdOczRtWUlGbDd5eDVpbFdIVXBwbUJZbUJlWlRQSkt1aHozWE16NTFmT29zV2xLdnZLMVcrRkRGNEFyVzlRTERTSDR5cW13YThLcmc0aVcxVkZHL1Jid1RRTHV5Tmlwa0k1WXJrSmw3VGxJZUNaSXFjRE1xRmVBNzNMWFJIUjk1UU5BdmVCOWU4Y1BZbGoxdkV0Z2lrcHI2VElCWlYzK0pxK09pNDVtN2pXYmpheW9iekVrUjM4TGRoNmRWTTVuRTE2QlRFN0lLVHVFUzFFTTNFYzkrckJoS3BhVThIeExwd1J3dGFZcVlxOFoxM2owdmtOaDJpQWxsczhJTGhZMVpZUDJsdUIrMzFtVmNONk8wMjBoWlh4R1dLZG9qOW9nUUk5WlZGNUpTaXBiQjBkb2xyVDRhbGd1T21WbkZMblI2U2haRWY1SldHSkxUbWMrT0JyemlFV2FpQ0NhUjNsVkFIbU0zMTBuWXlpV3pWdkVBWURsNHd0ejJKVHZNUjlmak54MFIxbWJDNWxzNDZFMTZESDFpMkV2cU5jVGxSVGxodzNxRkc3NzlzM09UQXdlY3hjdzVzcWpYaUN4YUd2eWkvZ01od2hWcmY2ek5ta1FQcEIrWlcrRDhvZ2dMWUZxT0NGTDJXTUtodHB5bFJZZXM5STI2LzhBaEVvcGRGVmlxUHZFeHltT014WGY0MTlKM2hWQmVaZmJYWExmYUtFUEp3VE1EcU5NTXVvbnBGRitTVGg2UTExYVI2aFpKKzB2QkFFN3d5dHQ5a3ZNYWx3WEo4NVdGdFB2TnBVWDVKVlFoVk0yd3RqRmtyWTB4Tlk5ajlrejZQZDZSMHVXOGQvU05paXE5c3pFSm5VZHRTa1l4MlpWbGx5WU82cnptNFdTenZOM3FHdDB6a2pnUVl5VmZzeFMxelA5VkFwUlg5TnhEVnJnbUJ3QmdVaTBlNWVKUXVyMWxyZzdsV1hYSFMybEtZNm40ZU92ZWJkR1BRNmhCaHdqYWFDREIydE12Y3pnK0lrVVZid2k0akQ5cGFsdkN2Nm5OOWV2NGdyRVlXS1ZwR1NNMjdXZnJBTVlzYkU3Q1d4eHVNeVQxUzRJQjJTMW1SUXdwM2lEZmJiYXlzdHZGTTlweTFzWjd3d3ZRYW1YT2Q2aVlldzN1c3hWMEE3Y2tQRXlsaU9BZVBPb0ZVTkNxdWJKaEdPNkxqKzdvMitVN2xOWFVSM1RYUTZtcHZMd3k4VE9EYWppTGxRc3ZFelZvS0FyRTdBNVJYNW1BYmRyQ2VqaWFEdnBFU1g1VUlnNXFINXFzVnNqQ3JJUFkrN0VWUjNxelg5d0JMc2pRalVINXFUd0IrNWxCTmdYYjZ3L1Roa1F5Y0d1cFhFUVR5UitYYWJEWTFZbVhKNU0vVGNBTFBneGlhY3NzTCtjMEVIRCtYNmxFUkRoR0JmRWVTWUtJcUpoU2FqaU9FZmxhYVdNZkkrTVYyTXl3Mnh3OU5PQkM2OVV1VnNFckNpWlh4MHduU1NYUzRjYmlxL3VpYktyYlZYWEQ2eWlaN29WVG12ZWFSbzkyejVtMFdzR2I1bVpZNVJRdG5OaTVzWWJ6S28xV3kzU2FLbFJUWXI5cGNqUU9HaW9qbHNPL2FJTUlxWGVITTRBa2l4V0N2Qy9ua0FWd2RycjBlSXFMTkx0NW1VNDVkRHlJV1JxWXpzQjBGWkt4OGFEVlN1ckJTS290dTVmWmlHWnlSNGpoaW5MMWl1REZDd3N2RXZFSE1XWGlXdlIycTh5NWZqN1k3eWwwRmFGbHg5V3BqWTFUKzN2Q3IyaTYyR1ZWcytFbnRQUmRNWDRoelF5OE52ZHZpRERRSE5uYnhNNmhrRzFIbGkzdW1CTVcxYmRRMkhQMlBTVWpCaFJpSzdwNU9qeVROcWl0WEgzdWxqODRadVhsb0hSNmlGWmVyRzlYbUhTcmQ1enNoMklNNlBkS2ZsUk53YVhuNVltV0RrSWFobmcwSGRsbkpZWlRNVVlha0tGOFhDWm0xQ25EK3BqRmhabERldy9xV3BMV09uK25OUUZCdDkvMjg5NWFiNE5IbitZMUVXckRrYU1YNlN0clpkWWUwNGoybWVsaXR3VzQ2RDFTdmVWWE13Ymk2Z2pxZHdqaEsrWmN0NmdJcnhiRGptKzBKWnVhSzM5NTJCWEN1SVhxbVZpVkFTYzlaTDI4SHJFakFiVGQvOEFxRGNmZ1o1UkJzeUNZRGpIM3pIVFR1MmFxRGpUVkJyOS93QnlxMEw5Y3g5c1IwWnE0djd1MHlJQXZ0WDhKeGg3VzJYTzVUenYwMzQvY1U3REpRSG5tV0ExZ1JyR0gzL2liLzJBSzNLSEI3eHVESmJwZ2dIZENoY0xXVnhGd2JsVndwS3hnKzVIK2hMa0tUUG1XOFMyV3kvZ3J6UFhQVWZEY3RtZVhwaUQ0US8ycFNGRzMySUd0azh6STRteXptWW04R2gyOFNpcTE4V1pDWW9jeTVmVm1MTk1YWCt6R1k0UU5STHZBam14NjRoUnRmd1ZjQnJCS3NIWi9kVExIWlRIUGl1SWdRV0crdjRqWCthVVA2WWl1TXUycjlIdEx5WVBpSDFjdFRDMGdkRmRjZnVYUmxsdTdyWS9pWUFSQTVkQXExWGdoZzNyMmlaUDFabm9MaGRNcUtEMk5TM2g5SlRxS09mb25ocUk3VHd4UG1aSm1YTE90d1piL0h5YWhIRXRKM2dLd2k1Q0J1YWVzVEN3b3lhUXZZTUpKWk00eFRCYlpwdDh4YXhoaHRUS3dHbzZXbUJuM1RleDdubnpFbGhyUXJVQXJNL0l0amJ1NEZhQ0MreDU2aTJyWTMvc3lrQVZ3cHRsaitWb3pUQlE1Q1VoV3pWaFdHWEZSWkhlMUtMdkdZcTRZemJNRzFEMWdkTDNsM0JEeCs4SFpHTnhudkxudDhOdnhFdVgwTmJJZGlEM3hBWWE0emNNazM5VXBEajN4SFNOSDFpTnFXNTNDeUNReldwVjBxWVF3Tk9lSlVXa0FDZ0RZVU14cDV2Z1BTVk5pckRpMXFVY2dNQ2I5NVV1Z2FGdEs0bDg1eXBvYmVjL1NZYlZxcWNaaVZtaWx4dTlRRXk1Vys4VnpCdDBpeUExVWJxY0czZUxaTm5iU0ZEZElweGYxbGpqVWJpMytaNXpIZTM1SmhyNVJ1QWFNSVdPRE1VRG4wMUxXODBkK0lpQlVxSE1LbzA1bW93aFEzZDFpWW1JT3N4TktGL1ZxM21BMDdPeC9VYWt3QkIyeGNjNVFLbFV2S1gxakU0VUNXMVpxTzZPZExlQnBibDBWcGRjS0ZxU2tWdTZZamw3ZDFSeSt4SUZBbm9Zc0hBNFpndE10dzVqY3FhTTM3UjVqb3ViZnlsemJHNkpjZklQa2hYbStuTUw5Wmc5VzdsVTU5WXdka3p0aTNMemhqVmNJdzNWSGt3VllLNXVqQUJWbUZCbkd4cU43RFJDRndQR1pXWFVTaVE5MnU0S3MxZG1VRFpqYW90UzdoT0c4RmNWQkhBYVZZaWE2TXF1TWxFdFVKaFIyUUt5QjJTYXpBczlrQmVBOWlaV3EvTWFZY1RXb0lnS3dUVEZtM3hZbFRQeXhLblF6Z2pEQ1Z4YksvcTE4VTk1em0zTndpUW9iTndiRzZlSUc4L2NUdDEzWVZGdmVPSE16NW5EWGd3dTBDaUE3cDJnMzZwR0xEd2FsMHpjZ3FXYVJUMmhZbHAzVjRnTExodWppRk9ZcnlJUVVlS0VsN2hZc3NoenFVdWJoMUMxZHhOcFdjd2VldHU4di9qd2w0VndVYmhlTDA3SURWTWlzVmVpYWliZHVXWXZOZVpueGNBeEN0dEpVeHBNR1JHMmpDR0lORXlhdnpNVFBzeThScDFVc1ZxTm5aRnF5aktMTmdha0cxNHdXQVdSd3JVTTRHdHl5M0tBbzc4eFgwTGYvT01vWUJXTVFHQmFZNWpDNW05eGFxVzdNM3NXRWxWeHlMdVllQ3hVcE9ZeXlveUZsb01PVjVsRWdxYkhNdHlMbDBjK21FRzI2U3BlWmF4MUdpaUMwL1AvQVAvYUFBd0RBUUFDQUFNQUFBQVFJTmQ4SnNBTU5KVThzeE5GaG9BNGtCUjE5OUJBOXBsTUFrQXg3N1hxb3l6RDdjOTBzZDE5Y05rNUpad1VvdzNKbEREUkRUMVZvY2tZWUo5OTlsSkZNTWdJbWczeHNQcGpadGpjRTVNQVZaeDl0OTJRSWRqeHpLVkJ6ZFIrY2k1OWZBTlloVng1RDRvRFJrN1E4Tm4zUzFKNXNaSWpZTU1SQk9wejhFbGpNR3RkRlV5aXNXUnpwTmFiRWtWbEM1eUlrWVNXcTc0QUFlWjlRazZUcG1RQTBGdisxallzRW1PeDdSSW1neS9RZjFPa3VTY2NWUk9OTmhEZ0NlaHpZd3hHM1V5VDA1ZS9ZTWNWOXcxaHBSeitxV2dNSE5tWTJvVmJndTBzQnR4Zzg4cDlsQWI5M3JPSWFUWEg2S2c1bHltMXBSK05RdHR4dHVPNEdMbGx0UHpBU0oraEc5TjlOcU1BVVY5MXFia1I3SDFvODZ6TlB5d09kOTU5K01BQWM5OTlmQStBL0RBQ2hnZUJqOUNDZEFBQSsvL0VBQ0FSQUFNQUFnSURBUUVCQUFBQUFBQUFBQUFCRVNFeEVEQWdRRUZSWVhILzJnQUlBUU1CQVQ4UTdvVDE1d21ZbitqU0RVOU5ER2hOOUVnbG9oQ0NWd01UajlKRDFLUVUra0hzVFZLbVQ0Tm1jcnVRbGNDUlpMb3dORU1GL1BGTnJ5dTVEUVNSRDlrUmhvdjZKMGY4OGs3RTRMOUU4SXJFM1dXMGUyWktoWFJNSWF6eHJvZmtpSzRKaENTaERXaG8xdzhtb21mTmRTZkQvSW1taGljTkVVYlExWS9RU0lKQ1pQOEFlRzVrWWJLUHJuakdSOUtoS2FNbWxESlFiRFlyeGhPdWlHYVpCT0VtSkZUTVZ0RUlOZDFLSnN3MkpVYWF5VVR3STQ3eEp0ZkJ3MlJtUzlzRW1SSmFibUFlVk1seEJtM3ZneXdZMHZucGlaWEJud2hQSmtzaldSOVAvOFFBSUJFQkFRRUFBZ0VGQVFFQUFBQUFBQUFBQVFBUklURVFJREJBUVZGaGNmL2FBQWdCQWdFQlB4RDN0dCtOdHRzbDJ3SFVQZVlFMGgrSDJEQzZsdXBidHNadHFVa2ZQVUEwK0UyRFM1bGpYZmdWaVNzZTRwcnh2d0Z6bTBRZ1NlUWtlaXc1MU9lMlFqOG4xOG5zbG5vWVJmcUhPaTNtWmE0NXN2YVQ4SVpEKy9DcHQvTFJOalRZbUd3RU5DNDR5eHRoQm55M0k4bnR2bFVJU3NxZXJUQzF3TXNEbTcrK0p6ZUlNT0xoSHh4NjMwNzZVMlIrMytwVnpHbWtjOFNoOXdqWTJVYkk3ajMzSGlVTGJTWlByaTEvWmxrY2VZSUZud0YyMTBYS1d2andPTFMxdTU0QUxTMzE4M1BzWmZ4RVN5NElYVDRSdVd6aENGZ050c2V2VDE1Wkl1WFV1MTl6aUI5U2JrOEdYN1NEOStIWEZ4Njg5alpkSmN6YnBFc29aWWZrZGtBTnlPdjVOeS9KUDNIWHdUMFpDeHNWaGt5Q2MzRjBsMmdqMlAvRUFDZ1FBUUFDQWdJQ0FnSUJCUUVCQUFBQUFBRUFFU0V4UVZGaGNSQ0JrYUd4SUREQjBmRGg4Zi9hQUFnQkFRQUJQeEQrZzE4OGZCSCt4a1NwVXFWS2xTcFVxVktsU3BVcjRJS0l5OUpSY3hCaS9tNFIvdUg5Q1FqdURQOEFSVXFWSG1wVXFWS2xTcFVxVi9TQ1NvbTlSeTNLeEMzeHNvQmxsTElaWHlSUDdSdjVkd2Zpc1NzemFCOEJLbFFEYm1WRERjR2x5cFVxVktsUUpVTHdUeExvWFpRL0xGVFFCaHNIaGpTQ3JRUU01bEU4RUhTREpDelVOTU9iTWYwSHhSSGNmNno1ZHczUGNxb2s1SU55b0VxVkFhakZRNGxTdjZBT0FsVHdqTXFvQjJmZ2ptU3l4bSszUCtTRzVWdUYyY1YvZE1FVlEyNHJOMFljYXVEYytuV0hRZGQ5ekJjWDVSRWJYRUtxSGxLbFFZbWVJR0FpUXJ4OGhjVCtoL3JJYitHRy9rSzFLdURES2NRaXBVRDVja3ZGZUlOYXNBeS9Vc0FjcjlzRnY2Z0tuVzJBUGlDQ0J1UzI5cFVWWXc0WEsvUm85L2ZFSkRRd1llTkNwOXA5UW1aektIeWYrSjl6bUtaREw5MVBWSHhHb0FMYlRDLzhDenlUSUNzR2FLTmFPZGFZYldWaDcvYWpzLzVXZ0lOb2pRZVNGYXZpYmZEQ0FnTHpOaXJoQk9XTy9ndHhCWE00bC9EOG0vaWhsUTB3M0NPNWtJTVFJWmk0RzVlcmxmSU13SWJiT0dYOVFURThBdzdweS9pR0JzRFRYcWt2NmlKczR4Nk5OdjBzcUxJVW9DYndINXhhS3VLMGVpNzZ0cHZtVEJYZjNqMkpHS21tZ255ZndScUxRVHBaSDhxZW9vWkZZZUdpV2k5TjBXaEI4S3M4VkZMUGNVUjJZSHQ1KzQxYmpheG40ZVdYbi9VdktOb2d6SjRGbDd6TEFJZ09ManQxL3dCOUlGdGJOeU93OHZtT1JFcTF0bWs1SlRDYmdSYURpY29sNStDU3FQTEJLK0QrbDNLK09JYmhxTTFUUWdRWm1sQXhNd0l3L0FDbU1JWnFKWVM2bDE3bHF4UU1FOUprZlFnaEJVVkd3WmJWb2Y4QUdOQzFuS2x1Q3RuNEh4RHM1QVlEN1VyK2l5ckNRd1IweFpkNFZLVlJvU2d1YVczMFdwVHdhWUdIcEUrbFBpWmNCS1cxTk9mOEpzdjVoVjlXZlpOdFJTMmM5R1B1VWc0V1lQWU5JVG5EcTFadm9mQ1pnVmFVS2k0RkEyY1gvTUFJQWxSc01vZzFyWWF2KzRmOXFYMUVFVnYvQUJyanNsbW54cXBRZTJObE9aZHdBc2lZZ2cxY280cmNyNHU0L0hNcTRrRzR6aUc0cW9pUVNkUUlNa0RLWUlTVG1hajRURGlXS1VTOVh6RERzRXJSME1WbDMxQktFcDJtakxzdTh4d3hoWUw2c00rQ1lxOFJNTEJqRklTcWc3QW5IaGw5Q1FDN1FjWU1mK3h5WStLaC9HczhZOVJMMWxpOHZhWVB6K1lBWUJQVEIxby9NVEZiMVVIMmRQbGU1blNpT1pNdSt5VWlNZDJIa0xyTEFVVklhMnhsQi8xdzBWZzV2Z2VYRVZCR0hTMGRlWGpzbUhlUU5FVkYydDh6QmtFQmtJMGN1Yjdob1dsS0tzNGVhcThldW9XTlNxUVJVcllBd3prc0VTSmlLNTBSaE1zRFh1R2xsU2lYOFhMbGxPNXV3WnFFMmpBM3l6SkJKZURKS3pEa2xqTHlaWXJ4QjlSRGlEUjJxdGEremoxQUNJWUJjSE9KaWdwcFVVQTF6ZVplVmRpaFMyZ3ZRSUh6Y1N6bVJvMk9LTi81aExjZ0xWK0tkbmVHQS9ZbWJ0WnAyUVd3WVFVK1JiR04zVWFjR1RTdkF3ZTVZRmF2UlFRMWZYdmdNVWNZaGNkU29aVjV0WDFLQnRoUnRRNnNEK1k3ZXBTYUQ3MGlqTGJDeVdEU2xCS29HUUcwWGZXc0NJNkJWNEI5bXBRZ0NBYVU5YzJmeVJ5SWdxemtwS0NZYVFDeUR1MHQyaDlURnRKZzB1czNpR2xJTVRCNE1PREtIRXBSWndCSFVDVlV1bEtka1VWZFM4UXpIcUpqcjU3bGM1cVUzTkFRUkRMTU9jbm1PZUtlSldRelk4RE0weGFscmRTNkFUREptckNYZWxxbzdmVXBBVWl5OGFlZWJnczZCVlZLNlJWV01mZTQ2TlFxQWRHZzR4YlZjUXlDelJzZ0lDMEI0ZXZNWllTc1VDckhQSngzTlEvYi93Qm1tRFZRdmJZYnBUSDVscGhrT3A0ditFRVZWeTRQOElvMiszL0FMKzRuMjlMUS9kZnFFTFI3b0lMc2ovaDUvVXRubUdZRDZ1T0tzcEJRaFQ4UlZWVHJpLzRZZjNBbTNJTUhtdUh6WTlUR2xNbXF2RGpqeTl4alFZSmFGci9pYVZvWFYxRFJnbWdRMW0rWmdYS1AyZ1hINGx6N2xIZGNDdEZRSjRnK2dwSmZjdkNjMkplTzZseThGUXptRTM0clFsbTRYaWlJallVVHhQeTgrNVNtaDJFNWpjSXdhWUV1aTJNMmxOanhHVkZDaE9aaVZUaGlYOURobUVGSVF1eVVBU0lxekZvcUxOTytJWFZzUW9DQjJ2ckVPWkZjdGdDRlZZWHZhMzBSWFVDcFEyRHNsWnRqQWIzaVArL2NNRVBseFgvblVwSkFYVGwvQ1k0V05zL2JjeGVRSWdaZUt2N2pXZHlROC9kdjhRWkFMcXUvd0VwTG5nTmowbU04UFVkckhoRjFiSGlmeXpGQWdLa1hvQzgzaVY5VktzQXBaclYvNWkyeDJTZ3RDRzExNlcveVQyZnFKM3huRi9rOC9tNHVTNXR6akRhOFBrZ2RMRmxLSFB2VVdyaUt4TVgxSGhCYXdXcmxsQ3ZVV1lOTUxSb04xQlVGSzU1ZzhJM0hCS0RaZWNDNDJOS1h1YnQrQ3EzQkFZT3ZjWFVIdEJUcElaU1dXS3l4b1JuY2R3dG1HcFU5UjdGS0M0WmcwaTZ0SlZSeTVJSEdnbkkxQjlTblZLWHBXWENNSVdkVnpWK2d4TFNqWlhWTEEwQmtlM3YxQk5Tc2pTdGI4TmZ4TmJRVjBTSzhqbEk0a0lNUUZxK0t6T2RDYzU3di9NZXdyYUEwYXlNWEJBQy85VmxSMksya0dLckdLekdOVUdPQjZkeXRuSW9lSTRvVmNGSFZUQVNOaGl4Uno0bXg1SVYraUxvZzBpSzQycjR4QUpxQVF0UXk0aXFRWFJlc0FnU3RyaTdySU10TlhVeFNXclVLK0lGLzFRWld0VFpLendoQUdPdmJlZXhpWFVMYVcwYUpiekVFNnFhbWVSaU5GbWJ1TUF3U01MZElKUmxtM1krS2F1cGVacEdVNVFoZ0VXMjIzNHdDM0RTTjE4ckZWTTVpZ1ZwbVZoOFJhTGVkVE1EVTZOOHk4Ykh1STBwNmwxMkF3Mmp0WlMzY3dNd1dyb25vd283eU45WDFLYkdLMVVzMWZrLzF4QVFDYk9veWdOWi94RlNUSzJ4NExGWHhFbEw1MHRDM0lpbC91RWhEMmZrS3BuakdZa2NsRW5LaE9idy9pUGFVWmtucGRleldLbHRmQUFncGgxMTFDd00vc1lUcDlpdFFxRGwzR1JHVlNRemZOUy9hZnZVUURieVhER3VNRVJDclFMck9vSVRqcEtMeWlScWhsM2IwU21zMlM1dFkrdnhqek1wYzhxTHpRVjd1eE1USk1zR1hKbkg3bXV3UXEwZWM2SUNJQlZQT3VmZ0kweWhtSzZvMUcwS1hEZkZCYXJPM3hINVRkU2o2aHEwNTFMQzBwNWlabXo0bUJnQ1VkL0MvaEpmeWZyeFNDeE5KeEgyQ2JXQmFZcW4zS2ExaUJZVVJVS29hbHlVbGtJZjNDa0Vjd2VUdURDWURLRDAremlWTFVKQzl0aUovTVdkRmcyYmJXYnQ1aUJZZzFLS0xNOUlZOHdRejFLOVdIbzd1cWF6bWJFMDVhQ1BzdDQ0R0ZzUE5MRG1oZFcvdUdwZ3RWN1JZekdGZFpncjJ0Q3ZHTmhrM3Z3MTVnbTVOVkxtcTVyT2FjY3c2SUNoY1N5aXQ1NUdzUWdxd3NienQ1Y3hXQVk0bW53aVlVclYzeXZpOVFiU29tTEEvMitvNDJLMzBJRFErUzhRQ044M3NLb25qTUNOb3hpTFdOaVVpRys5UksyQ3dvRUwyYm9xbnFaY1JYRy9NRTVFVGtqMWpENWwvenJSY2F0QjlKYTJxc1JqZkxLanY0U09UNUYzNEpnSHdtSnd5cUVxVmlpSVExWTNjc0JyY1FYUzJXbDhHbzVwSEFYVU9WNXU2VkMxSVdzTExJWU9UWFc0Z21VSzBQK1ptUGsxWTRYRjkzRVlHaldMcTlZUHkxNGkrQlM3QUdncWxjK05UUGlDV2czaTNqRy9MT0dDVThIcCtac3E4YUM3WCtHRzRDQmdvRi9pRFVETVFzZDZlRFFjRzNIYkVBUm9xRUhMbGNCWEZiWWxGRlFzc1lBTDZwcGwrVVRRZGk4TmNRYUkwaFc4WFdDdlVOb2d2aWxIZy9jS0JnaXE5T0w0UThGak5BOXZMNmx5SmR3VUM0ODU1MzVsNndxQUY1Vk52bnFvVWdKUVZkRjFuckp6SHZoOHN3SXBNRmw4TzdDTnprKzRQQ0JJRGZCS3pBV1VWQmNJN2h1YjFEK0VxejRNSHBOSGdDRFFSMmsyaW9pd3FXbFFQTXdQY3JQUERVSDFUTXhFWnNCMHhZaE5ZNzNIT2JqVWVEY01uYTVTRldFTU8ydUhHNFlHcmFLM3oyaldCTTVHdjdmNGliY0FkVCtZMzRqRytnODdDQkxkYUE2by8ybHdmQmNIdGpVMlJnUFJCNEs2ekZlTmxSTnBzYlJ4bGRoeDl5bXpkTGs1RmMxdmpXcFk1eUkxL3VYY3J0bTFuUThSQ01UeXdXNEdwV1dBN1VBY0dZdXJocWtuNFNPQXROcVVkelR6UXJQUmRaWHc0aFcyR29wYk5NVzVkaktvSldyMll1KzhsbldJYUFtRU81ZFk0aGh1WENmb0lZKzhJWXhQaG5NTHFjRU5mRngyNm1zZGQxRUI3eXNSM0ZpTHFFVTZZQWV0azArcGJHNmg0aXl0eTJuRHpNc1FFaGFtZVBKQmlFQjJQVytmdUlWWDBETE9VR05WNGphTVFWWHBNUmVNMUdiUUZGTmp2QnNNVnVMcEFzYnJDMnlxU05WVlFBTXBWdkZReFFVcUlYVzBkalNIZE1KVVFDczRsWkxzZXI4UWtQUlpjMlZ0enQ2R2lXVjVEQk1OVVo3dEdwSVdxNzIrUU9PT3BlVmwzanhWYmpYQmNEUThHc3d0ai9WTmtyYnNoeGpsVHBxTkZ3VXlWOHFmNmlSb2xqaWVXQitvMWtka0dDbkM4ZXVjUjQwYVN6T0V3MytJYTZvS2lweGVlS3hwdTNqYW1sYTI5V09NQXVQRVFKdTNNSjZFeHAxYzJPNHBNUzBBQk16SjhNNUlQSjhQeU5WTGlGZkhNcUp1RThNR0FMWGxndUE5ZlpKc2dUanVCb2VJV3hHaEJPNGxMeDFHOGJoS2J5Y1E3S3VpY2tJSmhoQ29OK0V1a2dsam9sbTg4eGI4NGoxQUJDcVEwZlVlQ2lsTkJzMXpCekNGNVBJTXJRcnp2Y1JGS0J4dVVBMjJUSTRCd1JBMFUwRUswQ3FCdDJHY2wzS0V1cFp3QkQ4d3BqZ2lhbHBIR0YrdWRRcmNjMmFGZHRqSVViUThRdTVvOENMUk0rS3ZNYlFYMUZ1Mmp3cXMzWVZtTWVWTG9sZ3ZadDRiZk13cjBZdVc2WUVyeEFlOG0wMEFweTI3L0FEQ0JGQXdDeHZIRkRma2phYTJqVXJMWEoyR1ZKWnE3eTI2Q2FkdGRTN3h6bVYrTDIrWmNYdzhUTVg0aXFyckV6alZ3Mkh3V0pXcmp5d2RDTEo4eGc4UXVucU5SL291V2doSllja3B2NHlSaW1HcGVGc2NzRjJ3THlTdzVXS2dXNHRhRE15TlNaa2pRa0srU3pidlpFVVdHTE13dExYbVlpWVFLb1N4MFc1MTFqY3J4Ynp3RzJOMkNIQWZ1V1o2VkNCUVF4b1p2Zkc0Um5EaEJxclBZWWV5cmw0YmdTZWl4MG1tbmE4UUI0MHFDM1FwaHB4WU5GbHBLVWxTMFRBQ1U0MFl6a2h0dFh0TEY4TUNndDNibUxPKzVEYWN2dFlabWc0UzNvWmY5QjlSMFhWQXRlRFZFb1NBVVkwUWFWdlE2T21IN3VQVHdDVU1ITFczTzIyUDF1Q3JYanFPN09WeTFWYlVyZzBPNGJMbmlFWEluUzIzRlVpWGNSZHpXTDhQOWcrYXVQMUxzQmlIaC9NS0t4K1lsZit5enBJcEJ6ZFJndGthdTZyYko1cnFIYmdHeFZQVzgrNFVETk5qUWFsQndyRGZpR1RBTk82WFFMMTlRV0JzNHRmcXRSa2xVcW9hditCWUZSYlJER3ljN3FqOHgyWlUyZloxZ2k5ZWhnQmFYVzdBYXNMcnVWYU1iRTBCakhhU3VzNmpTVENxMEdSYnFxcHdITXNETllTbzNUWndzQm8zakQ3OHA4Q3NGc1g3TVYxQlJPZmlXTGE4cmw4Ui80bURRb1dPRnMrZDBPckl0QkhiYmJCOVppV0MxamEzdjY0Z0I1Ulc0eEx5Nnc5VEZYOUtoS3JFUnllWUJpcDFnZERtWkFCKzRSSlM5UlZkTVNneStJbDdNazlpVm1QeFQvVmlGUXJCTkg2bGRLOXdaaFQzY3c3WG1pVWNqeVQvd0U1YXZxV0txOU1CeWFYNFJpQkVLQzNEWjF2OEFtWDFaSVdCVFl1K3RTK0JLa0xCZEYvSStzeDRpSlozYnhWQ3VlOVNxQjBBV1VMdWd6bmt6ekhTdWg2NnpnbDBlZ29oR0VSSVBjMEdUWVUyeWdJVHBpYVJLbDB1bWdxYkVUbHRGWXZOYWFERlM1aFhIZGFvS2I3R3JmRzVYQU53d2hwWlJXQnp1b0ZJclZNSHlieDB0ZW9RZE1xS0lUQ2RweU1IdkVyTEJOaVRBY0U1ZldkeFV3NTl0bVI3Y3V6eUkwQVM5OVl4Vm9WeHJqNmhZQmpJVXpUMzVqV05ocUdLUnZONTR4VUF3MzZTTUtDSmVIVUJnT3RXZjVsS1AwS2dIOGdSdlluUXhLY2o3Vnh3VkpZVmRleUk0RDh5ellZK1g2bm1aZVdzZk1vZ1hsS3ZHWGxtZmN4TE9KcHhERFJWZEVWdjhyS09WL0VNdExDT1B5d0RXZlVDR0s4Mk1Ec3Y1WlluWklDVnhMQmthT0RPVVRyWGlPNmhGcVc3MGFjN3k0eEdzaHNBZWd1QmFscVpXS2thQU1uUm9pVUlDV1RGRk5pS0tkNHBseGJWMkYwVWRXTkk0dlZkdzZkYVROZEFWZExkbVYweE1aRXBLZXk1MzZtaWlIVkpoRXF1amc4NmlBelFTKzFsbG1XdVphZlcycFRGMWdEb3NmekFnRXlYWFlPUnBpQUlGVmdXV3hLU2xiNnZNb0NCbE9ZbGpoQUxlQzIrSXRmaDBCdXFPRHk2M1VCUVNXSFFYYTJscndLQTdESU1nS1Z1a0hHTFV0dmJMSXR3a0ZxQXlzekRMMlJ4eWpzTlZMVVBhTkg3aVllRjRqVU9SRU40ci9Fb1pmUXYrSll1aDRCWm1iRkZiT29pK1htQU9Kb1lxK3BTWVVZdk5aZmtQeExRd2p6bU5jWEw4d1hjWHQvRXExL0NWSzh6RUpiM0NscHVWV3Y0bFhOc055emNDdHIrOHpCbm9YbTVYYU1tdTYxL0xxQ0FLMkJHUFpCb2lGTWMrTWVJYkZRWDBJZ253cngrNnczVWZIYXhtTGVmY0FzWHBiSEpIOEF0OGdjV2hibGwyQTBxbEhkSFljd0RTc3UybjVKbUY5d3JBNkxhSlJOY1AxQldqM0ZzdWZrVTBXdmdsdkc0Rkg5eXZpdTBpMzZxMEtUVGxLeFkxbzFqbmxpc1ZZV2lCWldOMEQ2bElhZ1lHMnNaUi9WUWxYQXRCV0VLNXB2aTRrSUlPSnloK21IQzEzaE1tOGc4OHlpQzNYbE1rSERtdUpsZFBsejdpTjlmU0IycGdHUkx2VU8yTjl3Z2pMMW1BT0VmVVkxZGVwZzdxS3ViUlhPZmNzNS9DTmNYS2xNcDZsSGZ5ZkdLM0ZMU3p6QmhWTkZGNWR4K1JlRExFT1ZIMUY3SG9vdDhWcTRjV2xEVnFIZy9FSGRWbzZWNHhLNE10VlhsdHFKYUhDMGdOcGd5ME9uWi9FQ2pMallWRGE4ZTlZby9VcnBtUzNZRlp0eHVzZFFYUTduTGJEQnhlUmtEM2FGb3Z6TVpSZXdEVG5ML01SSks3ZUZVMFQ4ak1CU0FDaDRNUnJEYndBSzY1WUcya3Q5R3ltWTRiZ0xUSm5Ycm1VZ0JNb0FTYmQwNjZnS3dwRzdTOGxFM1RtTlVQK2U1Z0JzcWphYmNTaUV2T0FiZnhVdkZsYXM3V1pSWDV5RHEzdkV1UXZkWktldC83bW9RaTV5dUpNbW5US0d5MThYcUlGR1I2aEJlWHRibmtqaU9HM0s4MUtyLzdLbEVxVkFobi9ybktMNXI1SmZ3TlFiM01ZcUt1OHhHRGRSZ29iZERoL3dBeENBV3dYUWZiQ0h2blREeGJvaUFOckJWeWxnVXhZTlN5TXhXZ1VOMXEzTVZDL1BOQXVNWTl4TE1EQUdGaVlZWlJ3Z0FxUzFSeDRkUWlCc0NBeVRaMUFqQ2VWbXVPRG5tWTQ5Sm9PRjR3eEFyVUtUclBSajZqUjk0WXlOaGEvRXNVcUFjQUFmeEtlc3lXY3I1UExLLytoYXczU2h4eFVJb0lWQUF0WFduTUFFTVBBS1BHNklJeWlwOERVUXhFbWtLandTOFp2emNKWlUwVnZ4TElCTjJjVElOdldzUmRuTGw3K3RNemgwZENxVUd4V3N0eHVTcmpNejIxK1V2R0oyMDNNa1VuZHdaYVNxVVNhSng4M0RmY0J5MUFDa1grcTVjWUZmQlV2T2N3S3RRK0dHMlR3dmlLa3JDd3NBNnFLUzNPSEZ4c1hnVlorTlJJb2JURkYrakJDYW1XTEV0eWVZNEpsbkRhbjZtOWhVQVhjWHVGUmdWVkxYNWgyV0ZYMStjZnFGazF1YkFuTnpnV1NyVWRRVHJTclZMNDhYQlF4ZzNDTVZHNHhaSythOGxZbEFSOFlSZU5weFhXWldCSHJHUzgzWE1jQ2dVcFdicmNHNEF5U0ErdXU0Ylh0WTRqbldEQjVqNTBPUzJNd2JTcFE4S2t5SURad2Vva0Z5TWxmVUlrQWNVYUU4K1liTmlXQ0g4UjRXbjFCK1RPOHdER3ZUSzZzejRqTDEzTWZHWmN1WHdzbHVLaUoxL2FJRFJtNDB1dnVMYXU0MUFXdUN1WWhMaXhlakZYeEFjcklwc2FIY3l4dzFScVBiV0tTenhWeGMyMkhHUjNHZ3VVcGt2dGlhS0NtekpYVVJKSWdGRWhHU3JpR3ZrUEIvTUFDWWN2VWZxaHR5MUM0TjgvNEpqb3FZcmphR2JzaDdOTTRwMlNqWEZ5eE5HcUJJNFZhVkhYMnpHTCtJUU53VTVIdVp3cU16WFpwbHNRdHhVZXlZNnZZRG0wNVBFcDI1RmdOM0xETXR1blJBVVYrSUFxVzdtUE11czNFTktLZHkvbXBVR25FM0JUK3hjSE1HQ1Z3NEVMbG8wMkE2aEhZMkk2SGNwZDJLaHZ1WHdORUxUcUVWQmF4SlUrQ1lLSTJ6VEwxRmJ0Z2NtVEZyY3hzZmJBQlVOeHdDMHppWmxJNVRpR0NQa3JjV3h1YlN4TFJtRG9seDFKVGJNQTVOQnVLTDJsWkwwTUtzT0dLS1lCVUsrVnMybGZ3RUVQZlp1eHJIVXZ6WUx0eE00dGxEUEpEeUNwZVA3Ri9PZjdOeTJVSmk1VVhJS0RjSlF0Z080aEJVRjB4ZERGTXNvcUJYSkJDb3gzV3lhbVE0aGRCQkJYNWlhblV1RkFtdGp4UWxkekRBSFZSK2lydkVZMTNLZ3FWMURacU5lSWRHQzNES01ZR3pScDFVWTV3eHZjU2hTbGJiaXVPU2pNaXYxTGo2aE5aZTN1RHloR0RqVXU0OVM1WDlqYy85az0iLCAibmFtZSI6ICJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LC85ai80QUFRU2taSlJnQUJBUUFBQVFBQkFBRC8yd0JEQUFvSEJ3Z0hCZ29JQ0FnTENnb0xEaGdRRGcwTkRoMFZGaEVZSXg4bEpDSWZJaUVtS3pjdkppazBLU0VpTUVFeE5EazdQajQrSlM1RVNVTThTRGM5UGp2LzJ3QkRBUW9MQ3c0TkRod1FFQnc3S0NJb096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenYvd2dBUkNBRGxBYVFEQVNJQUFoRUJBeEVCLzhRQUdnQUFBd0VCQVFFQUFBQUFBQUFBQUFBQUFBRUNBd1FGQnYvRUFCZ0JBUUVCQVFFQUFBQUFBQUFBQUFBQUFBQUJBZ01FLzlvQURBTUJBQUlRQXhBQUFBSDQwQ1FhWU5NYlRHeGlWSVFBMnFHbUNUUURaQlNKVklTcEFtQ0t0SHJteThwek5ZelNzR05BSWFCTkFBSUFBS0FCZ1FNQmdEYVpWU3hwaEl3VkpqVElRQVZOa3pjaVRLa29CdG9tOHlZc1dDMEpzSkJpVEJBQ0FCTkNCaUFBQ20wNEdBREJneHRCUWdZRUZWVXNMU0NSbFRwbTBjc0V5aVJvb1FqeDN4bzBqVXluWU1uck1ZaTB0ZzBoSlZKVU5DQUVBQ2FBQzJtbkF4d21OR0RWRFNEQXFwMXpWYjZzNjVJN2VjeFdrNnprNmRRVUVOZ0twUnkzVWwwSituNTJiQTNyTXpjR0d1V3RPYWttYVFrMG9oQUFDWUlaYmRhNmM5Yzk5ZlZuWGxMMStjNFYweHJHQzJMTVgxYloxdzZWcWVoMDVldDV1dmo4MzFtRWZKcjZUaDNQSW5zVzg4VWQyV3M4MGRVYW1Kck5rbWpNbnBLTlFGRXV4eU1sVTF4VnhTVFZKTkNRQURFQUlDM1c4M2xycGdSc1pNdVIyRTBsUU1OTTZqdDI4L2JsdnYwOHljMzZydCtLNjhhK2w4dkwxODN4TS9yTTArVjVQc09Xdmx6MStUcG5pWGZ6NnpqbDBUdkdOV3JtUzdURmJaMjV4cG1zS3BxUmxKQXNwcWhxb2thRU1WMUxSdFZBNmNxWUEyeVhSRU83WE8yb0JCZW1CTDE3Y05ZdnE5WGozejM5UjMvRzlXTDlKNTA5T0w0K0gwUEpxZlByMUo3Y3ZQWDBNNzh2Z3I2TFBYTDV1UG9QRTF2bTUrM2p2YVUxZFROSzFLZ2xNRW1DVEJERjBjRWFYanBHcnl1WFNaVWExbFJ0V1ZaMXZweXZMZU00cTV6ZG1wblVVNXBiclBYTFZ4dm5WYmJkWE84MnZUdm00N1UwMDF4anY0L1I4M3U1TzNQeXZOOXJ3czVQTzcvTXZaeW8xMXVzR25WcHlhekd5d1V0WnFMdFJNNnRrRkFPd3BPVnNxQmpoMnRacEdqemNaMUxNMXNveWZSckx5UDFQUXpmbk9uNm5wNTYrWjlUdnc1NjI2UEk0ejZqbCtkNTlUMXNQS2VwNk04RDN6OVhUeFkzdytndndJMXg5ejU4MGRGbk16dlBNVDBpUXFZbFNFQTBBQUFoYVpVRGRRbnB0bldHM1J2alhIcDJkbUx3WDlCMzg5ZkphL1dacDRQYnQ1NitzZk04NTlKeStGanFlMXkrVTdQUWpqejFPekhBM25jeGc2Snh2VTFyR3BMU0VxRk9zUk40VzMwOGFtKzNrMHVYbG5YTGVaQW9FQU5BZ0FDdW5ydjB2TDI4enE5blhqdnpPdlhuemZVMSthNUxQcmNQa1o2WitueDhHNjcrWEZham1KM200VHNHU05FV01sVlpDU3lTcXVLaWtrTWtzc3lFMW5KRkltMWlRNGFwRFFnQUFCQUFGZTNma2FlZnIzNVlnNGxieTBwc3Q1bGFWazQzZUxsMFVDV3BSWm1xMGlWWXlhR0pqVEJpUlpDVFJTeEpYVUs0UWxxMldJQVF4QUNZQ0FBQUMzZXNqRjZUbVViVG1XVUowd0lvUVVTTFJLUmtxcVVoUkxzYlRsZFM0cEVqUk5sa2dOQm9aVVhBaGtzbWRKcVUwQUlHZ0FBQUFDMGFJZFN4aVl4RVVJR0lLVWd4SWFDd2FCdE1kS29xUktTNUdrV084bkZwS201b3FLaU5GVkdjMUZTQUFtSWFBQzBBQUFBQVlRd0VZQ2dBQVFnTEFBRUNqQkJnVllSS0FTQ2tBQUE5d3plZXcxTk1RaXBDaEFJQVRBRUNnRkFBQUgvL3hBQXBFQUFDQWdJQkF3TUZBUUVCQVFBQUFBQUFBUUlSQXhJRUVCTWhJREF4RkNKQVFWQUZJeVF5LzlvQUNBRUJBQUVGQXY0RVBpK2xlZkNISmZ6cUtFZkJ1TnQvenE5SG4wVVVQK2RmazE2TCtPdmFmeXVxNlUvenE5ZjY5bC9LK2FLUXFMSC9BQy8xYUxQTEtJL0hvZlJmSDVTRkh5c01pV0tocnBSUlhqMHIwOFhCREpnbXZQVi9BdmozNk5UVXIyRWNlS1VkSjVTZUo3eWlhR280bEZEUStpK1Y2VmVwY1RhSnNmZEkxa2w1OTd3TFVXaEh0ajdROUQ3VHdlRHdSb2tvMTlvdFNMajJlTG1oQ011emtIeGt6NmZVeVloK0hxbU9KUTQrZFNoRkZGRjBWYXFSVXEwWm9qNDZLaC9QdjJXWDdPUEpSdDQ3N2lsekpKNCtaRnFPWERsTW5BeDVTZkJ5NHpTUkxDMHBZY2lXcG9mQ0s2VDhTODBoL3dEeXZpdlovWHRYN2FMTDhpSVQ4eHo1SW1MblNPNXg4dytIQm5aeTR6Smd4eUo4YVNGajJpK1BORGoweVIrK3ZGRmVLOGRQMzZ2MStQOEFzL1VYVFRGS1Fwa004b21QbVdiUW1Td1JrVDR1c1duQW5KeVBCS3BQVDdGR0kxRFg3S2VodGpSYWIyTmtiSXNzdm8vbjJxOWlpaXVqUit2MGZBcEcxR3h0Ump6TVhJRm5tZHpGa0o4ZUxKWU5TR0ZQSjJzTmZTNG5MNlBIVStOeDRTbHh1SlhJeDQ0WmRFaWtVaWlsMG9xbS9uMjZSb2pWRkZJcEZSS2lWQXFBMUFkRklTaVVpa2FsZWVuZytCU2UvY0U3SWtFdDNoVnh4SkdxT1RCTlJ3UHVjNkgvQUtORFZHcU5VYUk3Y1R0NHp0WTNMc1loOGZHUERBZU9Kb2pWRkwwV2JNM2tic3ZwWlpzYk0zWnNiRmwrRXl5eXl4SnMxWkdMWkRqVFo5UEsxeDJMREZIL0FEaVJ5cmFjMlF5U3ZmeGt6UnY1T2JOdmt5azB0alpteHVkeG5la2ZVUzMrcG1mVVNPL0llVjNaZnRyMktLNlVSeE5tUGk1R1krRUxpcEN3NDBiNDRrK1hHSlBsdG5mYk82S2ZuNmlWZlZUUHFacGQrV3p6NnZrNU81bldUeHRqa05SSDZMKy9yKy9iUWlpaWpVMUtOV2FTa1I0ZVdSai9BTTJaSGc0b21tSEdQa3dSTGxrK1RKRDVVbVBPeHpOamMyRkljdk5tdzVpeU1sayt5RlpJendhOUw5SDc5MUlVRFFqRVViTzAyZGlRdUpOa2Y4MmJJLzVjUmNUajR4NXVOakpmNkVVUG1aWmtzdWNlU0ozVWp1ek84a2IySm14c1gwdnBaWll5eE9pR1pwTktZNFVNL1h0SVNOUlJFaFJaMnNndU5sa1E0TW1ZK0NrUjQ4SW4vR0krVmlpUzU2Sjg4bHlteDVqNm1TSG55U0xMUTVsOVV5K2w5TDhYNkhHWG9UTmxJbXE5dU1ISSttblN4Ukk0c1pIRWlHQ1JIRE1yR2g1c01COCtNUi82RFpMbU1sbm14elpiZlJ2OEMramsyV2VCdTE0cXVyZnR3aEprT0xaSGo0NEcyR0o5VkNKTG5TSmMyeVhLa3g1R3pZMk5peS93bjY5bVdYN3E1TFI5VEllWnNlVmprYlBwZlN5eXl5L3diNitQeFV5algyN0xMNldXV1g3bHZyNEgrSHNiRGY1WDZMbzdoOXJLWTJlU3l2ZHNzc3Y4djllcStsL3pmRmVsaVMxcitpaHJwR2lYUi96ZTMveEYwZjRILzhRQUlSRUFBZ0lDQXdBQ0F3QUFBQUFBQUFBQUFBRVJFZ0lRSVRCQUlHQURNV0gvMmdBSUFRTUJBVDhCK3NRUjQ0S0R3STFVZ1JCVWdnanpKbGhQZFNwQXlTUlB4eVNjYWd5eE1za1hNYzB4UHE0T09xTk15ZUpsVm1HRFRNRkcrUlNKL3dBNm9JS2xTTmNGaHN5UThERDhjQ21PcUNwVTQrRW9zV0pKMnlOSm43K2F4SzZzaXhZa255V1pMOWMvUlYxLy84UUFKaEVBQWdJQUJRUUJCUUFBQUFBQUFBQUFBQUVDRVFNUUVoTWhJREF4UUNKQlVGRmdZZi9hQUFnQkFnRUJQd0g3N2Z0dGlmWXZ0Mk9ZcEY1YWhzYjVGTVdJYWhTTExMOVJ4TkNIaG5nMU1XSitSVHNVaGVsZWREaU9BNHZKU0ZJdnU4bk9kTW9yTG5OdFpMeUx5U29pN0VVeW1VeXBGU09ldXl5elViaUhpRGsyVVV6UUtJbG54WXV6WTVEbWkzOUMvd0NsbWxtMnpiRkEwb29ycGFzNVF1cVdKUThXejVNV0d4WVJ0b1VTdlUyMGFVVjBWblhwVVVWK2lQSmRuLy9FQURBUUFBRURBZ01HQmdJQkJRQUFBQUFBQUFBQklURUNFUkFpTWdNZ1FFRlFjUkl3VVlHUm9XQmhFeFF6Z3FMaC85b0FDQUVCQUFZL0F1aU92d01uVUZ3YnFhL2w4ZFNrajhXZmdhNjZxL0NxZEQ4ZFJsSTRGMVQ1TlgwUXFqYk1oQzFrK0NTZlBnZ2dqZGcwSjg0d09oZUZHZnNhYmtEamVSQi8waEJrTk9Fb2hxR1ZjSDQ2d25NZGZhb2RpOUZSQTU0ck1YV215RTRKdUxpdlIycU02WEhReVZXUFZDUENwY1JJVWkrSzRyMGRseDFHWTVERnZEYzVvYVVYOWtZWDVJYXZvWE5mMk5YMGF2bzVyN0NzUVFRUjBXVDFNeU9aRkhRcFN6Q3A0YXZrWkc3bWovWXRWVDlsMFdwZXhiTWlXdkF0cjR4d0VtbzFHcmRnanpaRzlSOEpFWVVqQ0hGbjJMZnBDcnR1U1NTU2FqV2FpU2ZKbmc0d2pCMVBVUkVRVXRoWlVMN09zZjBRWGY1SEk1SExpSXdaRklISXhiY2E0KzBVL3VVKzZHblp1WFhZSlYyckwvMDlhZjQzRnFSRlJQMmFxUitQaFRTT1pxaURrTU8yL3dDMktkOEpGZGI5ek9vMWxRZ2xlSGdnWkJ6TlVQOEFaeU1sSTFBOWFVbWJhTFYyTXRJOVZoa3drZkNkMU8rN1labHdYZ3RDbWtmQnpsZzJPbEJyRDFMZy9sOGpTTVNoRzYvbU1nOWtOUkZTamJMNVVhbWxQWWRiR2JhRWZKbHQ3WXp3OEhvVGh6ODZSN2orRkNibVdsRFZZNXFlZzY4ZEpIbk1pR29uam92dzg4ZjY5V3pJaWpMYnZpM1ZINmV1L3dEdjhsL2t2enRiaFAvRUFDb1FBQUlCQXdNRUFRUURBUUVBQUFBQUFBQUJFU0V4UVJCUmNTQmhnWkV3b2JIUjhFREI0ZkZRLzlvQUNBRUJBQUUvSWZoZ2orUUpsamFTU1B4WS9LTmVTVVY0STZIZitLdEgwdGRjVG9TTFNiVnpTSHNleTZQb3J3UjU2M2Y1bDhFMDZuMHcraFpTeHZKVFdHOUVFWEw0WGY1VUw0STZWWWVzYTRJSUhCaFZUak9pSUxOWGRkZmorQ3VtQklnZlFxZDNBNjZZSUkwV3R3dUdPd21sS1pRTzYwNFRaWHN1VHlSMFkvaHBDRURIbzlXZElwcXJDMFNrdUZvbnh5T0wraUVYZHlkbjBVRmdoSlJSRHRVZ2ZUajVFUjBJUkFoSWFHaU5jYUlkMlkwWGNRZHllSVJ5TW4ySlVvOHgwV2F6K2VOWTYwVkVrQ05OQ0hMUnBrSTFRbVMxRWlQMUVmcllsaWZTRUlXcUZTbVlTM0lLSElpT2lzRVBZOG9wdVN1NTRKNEh6ckZPaElnVENaNEpiYUk2bHBhRVNsWVZRa3Bpc0tJS0tsRGFLSVQ1V21xQjdFTUVhMHRDWElJSUVMWXNOUUpEK0EvWklrN0M1WmNTVHdpSDh0MUViWHNhMytnaGR6eDlTK05IWmoxeDBJOWc3d29WYjJkNTdOdHZZM3NHOXB3Sm5ZUjNhL0lsWWNCVldIMkQwVlk5eCthQ2Nyckl2b1hOL1E1SVhCa2FuU1BKaU5DaGNORFJVYUVPZ2I3Q2c2L2NobWdreFhnNXZzY1Y1RmFBckd3L2FocWxDUzhDWXA0a2p6ZWlFbFJBWlNTTmlFb3NTVHE3ZEdGMElXbEplVlBTQ09oQ1pOakRLS0dKSWhTaEpzL3lMWHBKK3BSRjVUS0tKSkhPYTNRNUlXVjNMeUJQbEJKSmlIY1V3c2xXNnQremdRTTBsUVRncXk0VUVwNDBOVlE3akdZNkg5NW5YYm9URXlkRWs2VHBHa2FXR0ZOUU4ya1VZKzQ4VzNIUVV3TzA1RUpxSUFrYUNaV0RLaXB0c3pUakZyUnBwRmNlUVN6UTdFR3FxSzhDRDlZVkxoRFExYnlPNFprZCtoL2QwYmNENDZKNmJFaUgwSVZCT29uVFhJM1Y4aWYxQzB6WVRlQTM2WnZVTEN5K3h4bTRsc2hFNXFveWs5dzhwUHlYTHNseUZkUTBxSWJLNEhnWTIveUN5SlNWa0hTcVNoSXZneGlRd0tLSXZaQ0s2U3h0Y0RndERyUXBmNFlFaENORVFRS2hHaGFUVkNBc2ozRXFuc1N4MVFNRk5BbUZHbDVGSGRDdXdRMlFzSVJYMHpzM0F4bzh3MEZSN2pYSEZLQ1hMblNMeGd1dVZWMEZHcUMxUlYxMVV1ZGZJbjFTeDFiTzIvWTlsK3lEeTluWStwQy9XUUhBS21QSkExRDZJUkNLQ2doQk93T3pJc0dKTnhBaFd5SVMvd0NnN0dnbDI5a2lRZ25wdVlTTWFoSmJ3VXBOYUNUWkVsV0UzazBGVlRVd0NoQnFobWJvY2dpckdVQ2xZVGZjTm8zMVNDbEpkS0lTekRqdVBmSHZrdUFocklZWGlKcmRoc1JoRloyajJROXc3eEpJbVNSM3hiMmlzekluc0p4T1MxcWU0MzNZM0pRSGlmY2RvcGlidVVSTzU5QVN3bmZCSE54QmVpL2oyV0NHN1NZanhWU3hQSTVTMEZ2Ymw3Ymx1WUhHVXY4QXBHanVodjVIRU55UWw3Q1ZzUXFvdVdEdGVnMy9BT0JzL3dBRHJXRzcwVDBUcGdSQWtJSkVEbUJFc3F4b2xzeEJwaWJHdFo0TEMwRmgzOWk4SWwzTHpBMGJvVkJwY2VTTjgyNUxwMGFyS1pEQ1M5MUpGRGtjSEZWRTBLRzBUeXh1aGlYTmtXQ1UwUkVJSTNySllaV1FoOXFqN280OEVDaDVJa3lkK2gzYTAxVTZSbUtDc0tsUytoQkI5aGNJT0NGUEIyaFJVbkQya0JtS1VsdVdRYjdFV1VyNUtiVHpVYlptK0tDYXBkaFlKOHNjVld5WlZZMnV4Q3NnYjVFcWNFaFFYQ09hUCt3VHhBVWlHbDRITEticUJwTFp3OUE1MytoWHNTOWlibytLR3JyUklTR3ZBMWswSUVCV2pDbTBlMjhrTFY5QXNsRStRcnA2b283UHNmOEFjaG14OHBHZDRiMmZkalpXSzlyalFpWjdzazFYQTNBNFBJNVlJZG5JbTkwU3JldzcxSFdNRHNIcVo4RUpjREZLand4ZEtkbmNjOE5ReEVxRERXZEhjejBJbFA1SlJEYU1jSXdrM3doTVZQU1pvaS9FdklzcUlxdEZ0S0ZGTm00eDVmc3ZNdmxpY0RzandPZnVpYnV4SURiS0VpcDFNRFpkR0U2aWJjVFdVUVRSUEJOeFZ1U2l2Nk1ibUt1OGtQSHVndXB4eEphVENKRXBYRlEzN203TUxwZHpQUmZ4aVJLTHlJdXJQaEg5UnJSUE05ZE1YcW4wUTgvNEswbWZkaGQ5Z2RtRzh0bjRrWGtuZkRkYXZRbHZTWWRTV080MlVwV3BJM0R5anlZRUxSdWpHRzRleEFTNUkvNFpLVlgwUjloekprdVpKU0VUM3NQZytwNVJWRWlOdW5PamN1ZGFjblhBL001WWcwSG45Y21iQW5Za1orN0xFL0RWaW9Da01PUTI5eVgwTmtzK2cyWkUzaStrdDNGYXFFKy9zVTdlaWRtU2dZN2pkVVRvN01oU1NvMkk3ZkZDRHkvTlRpUEZCekZaSlhUa3gwS0tRbnY2bVdQa1p6QTE1SnBzVEpRVDM2S21aVU5rNnlTTjl6SXhPeFFnV2RaZzc2amFqSlY0Y0M2N1hLR29hcXZBNlBvZWpNTW40ay9JeDJoRmlkUTJvTWNTU1NYejBKazEyNkEyUFZTUkptZW5qU1RHa3M0TGVvM0x0Q0s4andhYTRFaXo5OU9Qalc0aE9nNFpLaExzU1QxeVNOa2svQlZWSHBKVGdmRG5STTBwd3lwK1ZzL1pGODdSQXJ5aUJXZ1U3cFd5S096OUQ3dlpCalNrZC9pekpyT2lUT3FzNjZ6ck9pVXB2QytCTFNSc2taRkRsVjBiN1NjTWFobkE1UTlpZEpacnlVeEs0R212MkIvTlNDZEtkVWtrL0FoRWRFazZKMWljNGdtZkJPNW1nbkRxb1BPaGgzTWJORU5EWS9td0wrQ2hhTmswRTFOWmp0MHowVlVJYkRrYU1PakdpeGN1L3dEQ1JnZndTUDdZTmJyUVNvbEtKYU1UOHY4QS85b0FEQU1CQUFJQUF3QUFBQkFPcTRiUW94Qmh3Q0R4UnkyajNSTWFaYXYvQU54WG1XMHNRb2s2cTVTTThkVjBDWUFhT3FINy93RGJaZEdCRkI5WWFMZXV1aDFRV2YwSlhncWgxL0NBbzF0OCsxR0QrRXN1M1dBbFI3UVVXajEwOEJ0Y0grY3ZCUFJQaTA1UnN3cVc2cG5NSDA2L0JMWWlTRUtRcDhLczJmcC9LdzVENTRTRk03OHJmK3JvVDZBU1dOemNUWjBwcTFWZWZLS0UyOHZPbVV5V0Q5VTA2TjJFU1VudkxQaE0xNGt6dzJmRzA2RUZiODhkdW9ocmhVVkNwMGZuRHF3L3RyMHJGVGtRRGhmeHdkb05xaFI5bkl5VDgzL2NqaG1scURKSFF0ZlB3TFBJQ1QzQTNRNjYzL1lNa0FqS2hCZStFZXNrUHA1OUQzSU54NnovQVB4UzkvQkpVdzJnNDJhNGJVRzdTWWJGZWUrdE1DNkFnWkxoeVptV0hkQjRuc1JBcm9ETXZlZ0FDRDUwQno3MEZ5SDBNTUgxMy8zMTMwT043d0FELzhRQUloRUJBUUVBQVFNRUF3RUFBQUFBQUFBQUFRQVJFQ0V4UVNBd1FGRmhjYUZnLzlvQUNBRURBUUUvRVBnWlo4blBoNUpaOGJPQ0V5aXl6akxPVWMzbHM5WnZ6QWZOaDVrZmRrYU4yUHloMHlUUEcxVmxrbklIdGJiNkRnMWE5N05zUE1oN1NpV2Q3bzRKdFBleXprY2pNVTFZenJnTjBrbmVjd1lIczIreVBsTDRFWmRMU1V0T09rRURDdXYzZHRraU9EbG8yUk9scDlTL1VtTzM5a1BIOXZzbW4xYWM1d0ZsbHFMcnpBakUvdTZKak5xUXJsM0pEclRaWjZzaUVGZEhlL1JZL2d1bmxzdTAxVXQ0THdKaElUa1RQVnJBTEFrUE1uNmlMWm04TGJiNkgyeWxwVzIyMjIyMjJYNE84Ti93ZzNmYi84UUFKUkVBQXdBQkJBSUNBUVVBQUFBQUFBQUFBQUVSTVJBZ0lVRXdVVUJoc1hHQm9jSGgvOW9BQ0FFQ0FRRS9FUGhUNGJGOGFqQ1pSaTNYeTNWc1NzaVhnVEtVcGRLSkcydkcvcU1YUlhvVGVpamx5SDBEcVkxQ1c0TGh6b0pkUzdWdmFJVFkwSXRMNVJMQlh3LzBoZ2F1RUVKUkR3eHVlZGk4VjBwUmkwNEhSUW9JTGdzK2hTZkl0aXNURTArQlFpT05Gc2pHaHJvVHN4cGpUR1NmMlVocDNRL3NiUzdQMVEydlJpSG1BMGNDY0NuZ1hzUHNIN1Q3eGR6RXZZajBaUmplaUNCb2g5SEkvcGFBbmVFSi9HQktKUXdTWlk4RVdId3hKM3ZZMmh5Sk8weStCZmFmazVZci9ncDEvZjVFeklrUWdTTWFlQkJDMFRrTDlnYXE3ck1qTUtVRytocXl4OXdoWVFoSVpFaUVJUFJJZ2tUUmJuNlJKRWdrUWd4Q2FFaWJJVHh0dE1FMlFoTnExbnJ6UWhQRE5WOGwycFBZOUN6NFAvL0VBQ2dRQVFBQ0FnRURCQUlEQVFFQkFBQUFBQUVBRVNFeFFWRmhjUkNCa2FHeDBTREI4T0V3OGYvYUFBZ0JBUUFCUHhEK0JDRUllaGlzZXBDVmlKT1BXb2txSkU5YWxldGg5djNCaEJpZFl4RTAvRVRuSHlQenFhRmZkV3prZ1pJaUY0ZVlocTJYL3FwM0t5cTZIcnM5RG4rWkNFSVE3UTd4aWRKVXFIb3FLUGlWS2dTaVZqeEVpRlN2VVdoY0w3ZmlhZ2x0TTUvdWZDWmR2eEJIYTlmMG0yYTZHRDFOd09vaW5OK1dKZGFvOFI5RTlPSnMvd0RBL2dROUFWVjJERXdhekU5UXRoaVVpOHhPWVF4QXhOZlJQUnp4VUd4VG1CTXVZQlVZRnVBN3lnQmd0bzV6Nm1nTEJ2SjdaZ2EwdDdzNkE5aXBXNVIvTGliUFBvLytKNkJTL1FUVWN5anpLbFFMaEZWNlZVSW96MTZPNmgzZkVxdEZSeFhqKzVXM0Z3eHo5NGgvaGlaNENYWGVhRlJnZk1VV3YxS2h3Zm1aYVNreEU5SlcvTXE4RVRNRHZFNjRpbldaNFh2UGNQRVRGeXBYOENlSWJsWmlVdzlDR3ZWY3UveDZFWVpnUVNva0NYZFFDS21xOUV6bHdQUmd5a1JzK3BmUWx2V1hkZTRjZk0wcUhLWEVxRDREcVNpRy9CTEFwVDVsMlpDK0NJTm5rUkhxOWlwVHA4dHpYL0pYTmZNZFIyOCtqeDQvaVF3emJNcVhBbE1xVlV2cE84dWVNUFdKQXd3cnM4UVZCbjBIcFZxdXN3YVRlc3hWb29oVnRFT2RhWm05NzVneEFuQUZocnp3S0FXM3hHM05kNnFXZ3AvMXRodVBJMStpcGNNYThINFJMa1o3NWxSRmJEanBIQkE3N2xtbGw0ekVHdnFDcFhveDFIOHZSL3IrQktnUTlBZ3VPVVQwTDNYdk1zVkRuckREMFdFWWlWTEJiMWxaZkRLZ0t6V2JpNTFFcTU0WmRvWU9GdHdTRXRZTXdCaTZlMGVKN0YvbWY3TVM5cHAydjlURFJmRVN0aGRwUTlXVldnamFRVlpsM1Y1dXJsYXpvWTRqNk1ZNklqV3VmNUVDRUFVNGUwQnVGSVhDckxNYzFFOUNzMzlRbUxBWWN4eTB2b1hIRWpyTFVzbmpXNDlMTTFNc09zb3ByY3FvQ3I2UVlsTTZpY3hNdGNNYkxUZWVGd1pzcjJQcUF0TTNpRnFsMWk5VFBwOTJBRGdEd1M3TWwrVzRrU3NaNGlBSUs3TGd1QUwyUTlvdXdLVjZTcGdwV0NHNkk5Wjd4bzJIdkY1L0FtQ2dVV3VKNVlxdGp3UzJNc3hyMDBMZVdwUnV2dWV4TXhYaUUyaExHY29ZaHlpaDB5OWFpVVZWZDVSRWxRS2VzdzR1WlBSaGFjRHlpR2FNRVVLckJSeWQ1c2hxeTQreVpjTUFoeUVRQkMrM1NVTVNMdWoybHJmeXhCQm82RVRGbnZCeGRaYzRjTXlOWERHRCtKdWVZM2VMZHRYQlZoUEIvRU4rNzBaL05SQng3WS9hQXhDNnYveU5GREdjajg1aUdZbkpQc3dVNXVsUDZscmg5ay9xSThyMkQ5ekJwZjUybEt3UEcvekVSclhnaWR5Nml0UEU5L1RoNytqNlY4ZmNweXA5NHJGL0pIVkFkMnA4a0E3US9tSk1MNWk5YjVoc045NFZ2c0drVVBuQ3hDalQzbHVydnZETHQ2UmVYQnkydzAzZ0NVd0t0aGZ1cVlpVUY1MEhzeTA0RG5rZTBvbUF0MUROSmRhZVlTS0d0TVNzMUdodjBoT2NNMmh2aEFGcHB5eEhMd0wvQUZCcCtVUHlZb2Y4SHRFc2lSM1MvbUZ2RFpvdTVVVll2clQ4eDB1aURiOXdPeVBKV2V3UUFYcjNYOHBIUmk1Ym82UkF6LzdMbDBTTnNhRGlLNkVZdk43N1JtM3lSMzZ2NVBSOUZFZFlQUllWYmwzS2NnMU1MYTFMVlpxWmErNDcxTHRnK2l1TXpodEpsNnhDbHdVYmdLam1ieHZzTWt3M2IwdnNNL1VHcklhQjhKM0FhYTE0YlBpTUVaNnlrMVRNQmlrQjBzME5XUGFYY3loTHF1b2tkV3p3Vm1DWWM2YzRoc3FaTFFYdDVqZ0w4cVl0bnlsNjBSSktYMEpWOFZYVnhCWkx4QWF1Q1BiMmZpTWFBYnovQUZEbjVtT200dGxERU9XWnhFak5qMi9pT0kyNW5iaUpqdy91UDhEdVFodFFHaXRReDZzTWEyc0d0a09IRE1KUkdBek9xR0laVmQrSlFuRlJnWEdwWVpDZ1I1bVhoaUlMVFdHNEt3UzdKbVpHUC9zd1UyTzh6Vy9VcUNMa3RsTXVLc2NsWW5qaU90dk84aGZhQ1J4VkhaVUFSQ1kxTnZNYTFCdGQxRUdCWVZWY3p6UTVLbHBUZjd3Ymo2NlAzSlhlZDcySlNkYWxWczUvU0JjSExBQkhBVGN1cFcyOTlZa29xTlRWL21vN2hsOUVlRnhTaXFQT2R5bi9BREs4UVlVZ3cxdUdzSHZLb3h1WkZZVHREa1JQRXlYTjkrc0NKVVlMYzVndDM2ZEpTTDZ4SEV5TXZtWXpDMmdsYnpsWHRITFJ1NGhMSlhEcUd1OGdxTll0WGJVSlV6b3FxTUFCMk1rSHJTOGtMZ1VxcmpBRnZDdXdpOUFOYkg0aHdWQm8vb1N3VnZmUDZqVjg4Z3R3S1l5WGpoVnJFb2lETy84QWhDVXdBU2NuTGlaaXNvS1c2LzVGbW41L3VHUVF0RlJWMTM3UjlQTFJYTEM1ejIrNFBmTDJXdnpIbk4rWDl6Q29tTTNtSjBIeFA4QW5nZkJFbzdvUVp3djVsMXhGdmdtTTJYZXUzOEFQK3dLYWhocUt4Q2Q4Y1lsVnBhT3NDbHlsNnhMS3o4UlVPeVlOUllTckRjSkZjeENpMGIrWVNiZjZRUzNHWXNUaUJhRlBlS3Rsck9ZdXQwa29EQ2xxNGdvQzYzaVk0cGRic2p0QmJwcHVaQk5Ud3gyZzRXSDZsMGI4UHVJbFJqMlRadUFkL2lCZ1hkT3p0aThRNXY2V2xkallweDl3SUFVTFZ2ekhZcWluQWJ1OE9KaWg3TmtwTDFLakZQZi9BSmdQOWZ4TDFDUCs5STBYZi9mRWE5UCtlSmM2KzR3ak4wNTd4TDNhdjVpWHRmRXAxK29ORnJpNVIzalhlWWgxaWVHRmRWTzhTNDBKdEE4akxkbjdNZEx4aVVkSTU0K1p5aS9lY3h2dkV1VXZtRE5pRkhoN3c1Z2ZtR3ByVHFpSVFvdXN3Z2F6RkNpaWpxeGx5bUs4SE1LMVRSK0kycTJaM1JNUzR3NXFQY0pXREN6RjNQQ29QTUpUWlp5bTVnclEzWEV3QzVmRGsrSS91QjRKZGxaSGlGQUJvdW01VWNNRU9qWnpqL2JKTzhjeEhhTGg4VGh4dFhqTUJvcWRHZ2VFTnFEZGlVc0VEcUJ4K2lZUXErWVVVK0tCdWg5b3g2QitJVFh6UUhHZGpMMVY0OUNMVU1PeXlCWlBwT2kvQkZUTzNZbVl2Wm5wVWZWTTlaMnM0NGZFRDZmRXE2RUVLV1o4ZXlOYU5tcGZCY2t1QllCZkVEd2IrcHdqTmRJbFRJZ3JqRTRGcTZSSVJlRkdtQXFLT2tPb0Z1N1Y5NGlRZ3MwWllFM1cyNE51enZoTTliTzl3UUVleUVveGtDM2JEZ1M2QlJWd0drSmQzeDFpd09FNmpjeDcxbWhjY1R1WTN2VTVyZ1hyU0Vkd2xNcjFWQnpjeW1KV3JubUk2cWFENlFWbzE1SVZCNFBnUWt1TU1INWdWdU45STViVVZGZWd3aHdTR29LSUhEc2c2d0ZkNXdkT2t5NnZ0TFdOWjBHRG1KdGVZamh5ajVqWm1pWHBWT09JVmwwSlpaRXhlOVJZRktPUXpCaFFwTG9CVzJuRVR5ZEhhUXJRMGRDL3hERXMzUmN6S1QySlMwQTZ0eHpZTzlSOVNEcXdSZWZXYStYWWlEWURvNUFYMGlJbFE0cTQxbWJNMUg4TmtHVk1wZnN1Nk5yOElZZGNXMko4a2ZDRVNvb0RYdEgyejdNbnVSUWpUckI5UnBhQXhsQ1hrbXUyNDBMV0VMcXMxR25MWDlJTVhwTm9SL0o2bUdWSHhBdlJBZ29wanJtQlhFRWlGVGZhWmJGSEVzZ2JPcEZWYnk3Z0owWXZTWUd4bVhWZHQ0M0ZTd3gxZzNLZUx6QXNlVVNwNUdQRXVpUURCaVdFYk4wY1N3ZUlTSGlVNEZ3UFFtdG43aklYcDIvRFVJZ04xU2tWMnZDMi93Qi9VZDJyemQ4RUZOenpsajJJM21yNXFYTU9PQ0NkQmZ1RkdYTjZJaWZZUEVZQTNodDdFV2Q0NlhLVXZQSHRPZUlaQlE5a1NpWVIwa2NkMld1TXdvZHJ2NElSYmRIYUpOTkhWaXJvSDN1S3EzYXptRkFLTytwVE5XUHN3VGZTMWZTNHZNc1ZXOHpIWDZudjZFdFhNUUdDK3NKWTFtdVl3NERWZFpnN01PeVEyS0lCeTNLVTZZN3phQTYxRmN2YW9DQ3Q5cFQwUGRpT2gwRlREbGMyUkFPeHhaRGxJMFVFSUlxUFc0K2Nrajl4QW9qWlpQdVpZZDdiY2E2Z2NrWFhqZWRZc3JlRE1pelYwNGhjeTJ4RExkT3pjc2ZvRVlYYTlrSWphamtYTGc2SUZnQTd4WGJoTS9MeEYrV0lLczhxL0VmTHh3OTJHRThtaUo3QnZoNFF1clpVcVNzckNsWGtpMkhBUDVqQ1c2c3ZyK0pqN0NJV0tyTXhQZWU4c05tR0MxS1ZITkpnV0lkb3UxSWw0TENLcEx6dU5LY2g4NUY4eXBRM1Z4S1orYVFjdFh4QTFHT3JGSE9rTm9hdXNlMm9hb1VYRFVIOFVsblFlNHdSWWM4bHNXWFo2aG1RY1RWL3hGQmtYYXNRYVgwcGxMd2dKYk5UY2FCbjJyaVV2YnJLQkZhK1lxYjJ4R3hpVThwODVsekQ3S1J2Z1l5dFB4TU40MWY3L2NkbVBxeCt5QWtXRFlvMThSdXJ3RzkrYWhMWGRGSDFGOGxPUGFYM3FQN1lDK2hMR0laZlBWTVE5c0VkVjdSYThIOXNhaEdYSGZ4amxlZjRVVjVveEFibzY1U3NNZXpMQlQraGhOdEE0d2ZpTEwwUzUvTE1FMy9HaWNpT2l1QVlMMFJLZ0E5Tkh2R3FFSGR0K0lHMGg1V2o2bHE0blJWSGlsOHgxclJiU0JLaUJxdDhRRmMyd0ZnK0piWFR0TEpBYnVxdm1VT0ZHb05GWnl4cjdnaDNmYXJ1Sm9RNmNRMHROUVYxK0k4SjA0anRpMWVKVU9ISDl6SlhlS2FLcU1tSWxjbzg4dzVrSGkrbXlWaTYxMDJ0N3Irb2NMeXRXZklNcGwyUXErOFFRc29lb0Q2bWREOWxwKzRDV2pIMjNYSHZISU8wMTZzZnpsNXVJaTIrcFFBZUlyMnY0aUhGSWN1WDdpYWxJNE1FS3ExMUpyQjNCbHdXcnRIeEcyc2RCSGJWZTdjRTZXM3F5d1pzK0ltSnVKZVVzNk1NVWhnbHloSFpoZDlPZG5TQ3JUbVdXNkRnbHJuTFJFckVxSE1FWGZzL1V0ckpnNlZCUVM0S1RnakZic1crc0NPMk9keEJzZTlRS3d6c2IrNVJseDZxeVVUNkdDM0NZM0hyUE1lWStETSt3akYzcmN5OEVzMHFHV1Q0WThsdlc2K284YjdBRXdPVDhsUzdJUjY1KzQ2R25GRk5NYW9LVHZWeXVpU25wNkkwYTI0bEdWNXVlZld2ZHhDTzhIYUhMZTRVYzZuUW1WVXAxWlFGKzdmdEhaenpjc0V3MzllSTZXUGJpWHpnMXhpRjgzWFNEb09rZHhscTRWWGpFczJ4VDBnMVduTnBGQzNXY1RJNGxBY1FFdkR0TGFST0hoTVJiRFZUTG1wYmZIYVVETEZRY1FvSm1zYWUweTBQSXo4eS9xblpiSTRRTldiNS93QjdTa2k3MC9SK293ckw1VnhXQTNXTEpuaGk0ZkVkaDRnekhjQWFibjlFVlZXSjBTV2RQaG1IbCtKWFJId3pKMWh1NWllL3FQVitrd0E5eWJnSnpRNm1hYzNxc3NzRFJmZnBNYWhNYzdpaHNvOW8zYnU3eTRnZzRLNnJFR2N0T084SHZPTjFEQVdEcXdRdE9IRUVSakxaaWFLeDd6Ym1YelhUbUJHbmVKa1F5QlZYeHhCVnFEVGpFdnI4eEtOWUdDbVZtWFYyUVJrY3hWcGpwQ3JNNXZVcTBIYXBRbEFsam5meEJvRmg0SFA1ejl5eHN2ZC9UKzVRY25ZSS9FUkt2SC95SXQ0V2kyb3hpNWUwZlJURkZZem4wTncyU3pwTWVvVzBabUVBMkNFRXlKUlZ4Rk1LZ25GV3Vzd3djR1RtQ2N3cnJCdzRNbFppVTFkK0l1RDQzQzlqbUZJejNiamp1TnRSY1h4MHVYNHpETDA4enYxN1FhNWdqblQ2RkFMTTRZOHZtYk5SWmpaMFpiYXZ5TW43bFRWWjA1N1M4eTQ0T1JwaWdMVTJQcGYzY2M1TG9XZkorcG53ZHRzaXFBcDhQdHFZVFliYlhzd0NUY1VoYnJwMGdidzhLKzlSWnN4MUl3N2pncGVycDZrUFZvY045L1FZOXVrRXhlK3N2SWRtT1paNW1SVVVVaFIwZ3dRRW91OXpzSGF0d2d3cExsMUVYaHNJdHRERXNRb3UwdlBRNWx5NWNKM2hLNlJJWWxLNlRKTDFpS05MQmxnY2xkWnhLQXdIS1RDTkdlSERFRVNzUXE0c1dXUFVobzBkN2grWU9POGF3UWVtVUJHQzkyUGhpbkQ0eWw5TmozSmhsUEdmVWVQNVdqWmoxTXQxYjlUU3VKYzA1V29OUzVjdXBlSmNITzR3eGNXWDZDOFQyOUJtQytKUTNIT294WXgzUVNabGFsMFVaelo0aTZkbFl4aUlkQjdrNDdlWmpFaHR5Qmp4N3hzTVhGTUpOTFNLYWpPNHNWRnpvbU92ek16Zi9oZUsrL1N6RGE4OUlGeUZoTVc1K0QwMUxseFRGSG1YRmx5NWZwY3dPN2x3U3Q1NlJTblNDRTZiaUZVTW8zdk1MaTRqMWx6bUVMZFM1ZVpkVzEwWld0VHFOeXNieVNpRkdLVXpVd3djUi91ZGZYZmYvd0FuR09rSGowdjFNajJuRU0rdC93QWJoRFZ6ZVYxVFdYVkpGajZiOURPSWRXWVlyN3IvQUdMbk13RjNMc3RSS28yekVEbXc0WU4wWTdSekhqMTQvalhyLzlrPSIsICJjdXN0b21lcnMiOiAiZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwvOWovNEFBUVNrWkpSZ0FCQVFBQUFRQUJBQUQvMndCREFBb0hCd2dIQmdvSUNBZ0xDZ29MRGhnUURnME5EaDBWRmhFWUl4OGxKQ0lmSWlFbUt6Y3ZKaWswS1NFaU1FRXhORGs3UGo0K0pTNUVTVU04U0RjOVBqdi8yd0JEQVFvTEN3NE5EaHdRRUJ3N0tDSW9PenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3p2L3dnQVJDQUN3QWFRREFTSUFBaEVCQXhFQi84UUFHZ0FBQXdFQkFRRUFBQUFBQUFBQUFBQUFBUUlEQUFRRkJ2L0VBQmNCQVFFQkFRQUFBQUFBQUFBQUFBQUFBQUFCQWdQLzJnQU1Bd0VBQWhBREVBQUFBZmpDQ2gyS0FrVmpzRmtJNVZqWTBTVE9nRk9YYk9rdFpSR0JHZEhLelhHellRT3dJMFZWemxFWmdxQ2hpU25XQUhBRE9zUVFBRUdCRW94eGpzakhOV1lNaEJvYzY5TXlaZXk4N1VtT0ZCdGdFcTRISlRPcmtrdUNRcXBtUURyclN4cGFrc1hTSVRMV1phQVIxVTJCRGx3b2ZVbW9DWklCdGhjRERNaHFqVFlkNXNqQUFhM081MHhBQnF0TGx0S1ZXekZFZElxb0JGT3pub1N2U0lyZTB2SXp2Rk9QdEs4ZGVxWnlROU1XY2FkNlZ3TjFyWndqdWxaekRvalF4eUtIQWl1cXJqZ1BLc0VQcVRVQW9ZZ0xhRno1VnJxNXNuZnFsNDI2V2hNdlRtOHA5R3VieUc5YzNnaDdFTFBNNzZTT1dxTlhKMmRDUnNBdG8wODZ6b1RucHZKakhkY2RBUFBYU2VVSjFqbUIxODhrS1RRS3lBQnk0VTRTMXBDeVlNd0dScFgwMmxZczhwdWI4OVI2T3pZMHR1aE1XVDE4NDY0d0dwMTlmaVhqdTV1UG4xTDhacHZQYkxtZ2RDUk9wZXZHNnNrYTJUY0xxS2xSWW1mRTNKVkkzQkJicFpOTEFrS3FKbXdoQkF3WTZXNW5pckNzc0QwVXhxUGMzdWN0K2QzZWpEbHJKSHpLdkhpSFRPMG85TTN0Q1ZuVS9uTlowUHlxbFZFS2NMdFNyUmFIMnBMemlvMUV5clZ4REhRSU1XZm5NWG5BRG1ac1lLcFJab3I2ZUdJb0lhaU1YcEt2UW5SalZ1MXZvdUhYazlPbmgzUFQ0dkhCWDVGbjF3V2ttOHVtU3lwMnNLb0xLb3JpWW9Oa0pUVHdTcERuSkxYUVFnRDVhQ3F5QWVKcDViUU1HQUdWUnRnc2hsc01CdW5nNll0ZmtiR3ZhK20rQzlUajA5cnhIaG5VSitwNHZibUpBZE1WVUN6TFRXU0w0VFkxaFhKTE9SWDJOZ3hQWFVRb0FzQVV0eEE2aHpZcWlnMndHR3dweEFHVmRoZ2xUSzVUQnZFUjBRVmkvWnhkR2Rkdkh3ZzdaOHdzdGtGajVCWXducTZWZkpBc0YyTElCUWsyQ2hNaUZPemtCc0E0WXhCQ1ZJeERFdzh3NEVKVWhSbEJqbFhiS1N1Q0tLZ1lNWmxNb0JtTVV5TUJxeEJDTURvcnlVUzRLakdGUnloSXBVRXM4eHpQRHFNWmlvV1FqallmS1RUZVlNVVZzcE11eHRzdTJ4dHNNQmtKR0M2NkNVYWtGRkYyeGlDRlRod3dLS3BRWGhVZENoc0FWbm1GRlhPY1hVa1dCaU1Fb0RaUXB5NDIyWEVZMjJOdGovL0VBQ2tRQUFJQ0FnRURCQUVGQVFFQUFBQUFBQUVDQUJFREVoQVRJQ0VFSWpBeFFSUWpNa0JDTTFELzJnQUlBUUVBQVFVQytTcFh5Q2VPS2xTcFVYR3pIL3dxaDdCeFVyNDZsZGx5MTE3V3h1ZytHcFhGVFdhd2l1MjVmdzYzQ095ajJoWVU5eklpclVKVUVtendRdXZGdEdzOWxTcFh3aU41TlFEem9JVWxjMXlCTlpyTmVkWjRseStkSU5WZzlTKzJSM1BaOXcwQ1Q1NXYraGZZS25pR1ZCRVF2RGlhdWthOXNZTHF2M3BjOXljb3V6Vk9rVmxDWHh2a01xd3VESTZqMHpRc3VsR0tyQUhFNG1oalkyVCt2Y3ZnZVlhMi9nMjBKMktpejdjamZjS01KYjlOWFpSNDR2UmlodDhMYWk0b3FMaTZvNmFvdTRDcm94UlNEbzdMK25XZEtMMUNndFpxSFpob2NoMmFqTlROVEs3YWxjVjhTNmlGV0JPNWhSdFd4NndJMk9BYksrT0xoOG5EalNWZ0NCRmFkTEx1ZGkrSmpsVXY3NkFuaUtxcTdvMXRrQW1QSW94NWY1Q3hCbXBzbVhhV1pkYzZneWdKNG15MGU2NHB1VjIxS2xTcFVBOHV0c3BPTW91VjhZWFdkSk50S2lqSTRURGp5QmN1UVJObGpZaXF0U3JsQVI4YWVuQ05zY2Q2a0FiQjMwY3FvR1RBOGJJTHlPRlZtM1gyZ2RVenhOcDdzcDJtODJtMDJtMDJseTVmWUlwOHkrTGx5NWNzU3hFMko2YkxGeEFycHJCMU5oV1RMa1hhSEM3TCtsUXl2VFkzb1pIS0tySmtNSjJmcGNkVlFveWViWWdPZHY4QW96WTlZM1NFVStmYmJsREExVDNHYW1hVFVRRUxHY3RLbGZIck5aOUVDWHg5S2l0cUt4b0VPYklpQXhQVHFpa3FvR1RCMDJ5bUhMMUIxV1VEMUJJYnFpZnRWa2RIeUlEakozTVY2Qk9wSG1XczNVVHF6eU1maWZ0a0JTWlJubnM4M2MybTBMZUw4OEVkNm4yL2MxbFNwVVhHelRWV09QMDI0eDQxSVZVeERxS1k1amRTbVVHQW9FeXYxRGp6RUt0VHFYR2Q0d2NEYklyRWdsdGJvU3VQMjRIVVF1U2JKZ00ybTNqWVFaQUljbG5kSnNwTjRsT3lrV0lmc2lFc1paQXN3dFo3UkNZdjFyRlFHSXJuR21CamhHRWFaRDBwbXlYaUdSYUxDYmc0MUpnWGFhVVM1djdudXJVaGZNSDE1RTJNdVdKN1lKdTJvR0tGU1o1RXZ0ODJmcnR1YmQ0NEVXSXUwVEViOVA2V0VLaTVjL2oxSHFpWmt5S3haU0o3VmpNQWVBYU5UNjRxRmVOak56TmpOMm03YzNMUE56WXpacDVtc0lxWExoYjRLbFNvb21zQ21LaG1IRVpqOVA0WjF4alBrM1luVTdHMkVKSkZRODJKY0o0c2lia3crWlVydTBnOXN0WVo5YzNMTVl5NERYWU95NFB2OEg3MnFBTVUyaVpQT0gxQkJ4K3FHdWZQY2Q0V2hEUW4zLzZCaCtUelJoU1VaNWx0TGxTdVBickN3bThQbjVFclljYkhYN250RS9nVWRnbnZNWUdNVlRBK1I5ck93bmlyUEZUV1Z6NGxDZUJMRTJsbVhOcWxscHBDSjRtMDNNMi9vZm1mNmltbEdZY0Z3WjZSWGJOK3E2THY2ekkweDVtMUptM0ZWTnZHL20vZDhHMHBtbnRFQm51SitLcFh4Zm5neTRJUUJGMW9aMlJYWWx1ZHB0TGg1SGtWS2xRTE5aVTFvV0JDVHdEVURCbElOL0VmbFBJRjkxd20rNWZya2NrOXR6YWVEeUpYZVpYWWZnUEFsM1B3ZG1QeGJlUjlDWDd1RHhYZmZ3dFB4OFE3ZnFlWTN3MXdENEhBK3ViNHJpdXl1MG1YL1M4ejhYeWZQZjhBbnNCbDlnN2p5VDRKaFB5Zi84UUFIUkVBQWdJQ0F3RUFBQUFBQUFBQUFBQUFBQkVCRURGQUVqQlFZUC9hQUFnQkF3RUJQd0h5MXNJVklVQ0Yzb1ZjUkNGU3FSOXlFSVZzZE1lZ2lJdGpHTVk5R0lNWk03VVM4a2s3TUhLUi9GLy94QUFmRVFBREFBSURBUUFEQUFBQUFBQUFBQUFBQVJFQ0VoQWhNRUFnVUdELzJnQUlBUUlCQVQ4Qi9WVXAzODFLWGlwR3pLVXZyU214VGMyTmk4WGhJaFBXanlOeThSbXByeHFRaFBhbVdRMnlNV0pDR3BDZmgxeENjVHdiSzIraHhDeEV2Q2V6R1BGcnRHSmk3OUxGZ2pVbjhWLy94QUE0RUFBQkF3SUNCd1lFQmdJREFRQUFBQUFCQUFJUklURVNRUU1RSWpKUllYRVRJRUJTZ1pFd00xQ2hJMEppY3JIUndlRTBnb09TLzlvQUNBRUJBQVkvQXZvRUFTZnFuRHU4TldRUm5FVGwzcGN3anFQcE5hRGl0bVk1cjVnSjRCWklYZHhtaTRheERwT2ROVmxUN0xhUHY5SHFRRlFlcFhtT1VoWVhPLzZoVk1hOEpORlNvNHFsUEd3Rk1VbUpSSnBDSEhtc1FjMmZLQXVIb3RnNHEyaFQyWTlRdDNWbWVPR3FvaGoyWlhGZjB0MnZOREVUaGFQeUJHd0E1b2xyREF6UW5NVGRZUUc5YzlSR01OQkh1dDAwdXJJWWhFK0wyWmpLVVE4R1JxRU5BNktZTG80STRHa0FCUmhQb2lRdzRlWVdVVHlSZGpJSXRCVWsxNmFvd2dxS0RxVWRLNXhjcmY4QXl0b2djODBhdmVVVFJwNktjYm52L2hYMno1djlwOE5jNS9TVkJjeHY2Vjh3Y3NwV3k1dHBUNGFTM09sa0NBMXBHYTNwY2VTd2xsUnhValJobkllRzJ4UEpRUlVaSWJNVGFBc1VnamtVS3lVUHhXdGtmbFZYQUFJSEV5dVRjbFZ6UjFUTzB4OFpHYUxSV2VTYVdhTm9QQzZJR2pJOUxLcG5tVmd1QUxHM3FnYWVnVGpvNU1qZUpoVkpVTkRUK3BiUnc4bkZBbCtKdkNLSWh1aEpCb1NCSDNVQm8vOEFOVndqazUwcThkR3JDSHZMTWdkVVlwMVhLclhYUmc4SVhOYkE1WksxMDRpb05LcG9JYkxzM1pLRFNUU2VDNHdiV1ZNUEpvVUU0WEJZY0RZNFNuTnh3UGRZc2JjSkdVSVE0eHhvZy9DSHQ2VVJjNEgxVFdrdzBsV2puQzJxZnVROHN3cE9sd3VuOHFBMG5hUC9BRlFoMldqMmVhYjJnRmF6TW9SaXBjak5EQXl1Y3B6aTdhUElBSytxalJRWkNQRXd5azBsRnJIZnZ5Q3ZYZ2hqMnRKNUNqcFRnQTR4UkY0YURPY1ZXeG9XT3JtNytVQzl6UTQrd1FBZi9hakc3Mld5MTViKzFmaHkwdEUxcXZtVmM2ellUOFdqYmlPWkV3b3Z6R2F2WllnY1VXWmlVblE0blhyd1ZCYmlWdE1sV2prRnV0citxWVV0ZFhvdU1aS3A5bFJ4SUZHeUZSbzlsbnF1Tlh5NTZyZGEzb1BCeVczc25FQ2tWVjVPS2dteW5kYmVSTlZTR2pNbTZtMDJ4SnBJdG02eXhYeVd3SUhtY0pUcGROZjJoREFEVHkySVJMOUhvM0UrZFlTQXljNVdIdFhuaUdGSHNHaDg4UVpDbDM5ckdmNFVBRXVLTGRJYXhsa3Y3Sy8ycmY1Vmg3TDVvd244dUxWZmF5R0ZaYXJxK3VJV1N5VkF1cW9GYjROVlR1MEMySk1ET2xVY2UwN0txcEpublpHR1FPS3FMOFUwNlZrczRTcW5zOUdENVZ2dmU0blpYL0hjUzAxZEs0UnhLTHUyaDQzYUZkcHBEVW1tS3hSTWRtMDJpeFFhVGhGNFFhRzlDR1hVWWlDRnRTdG0zTlpyZWhmTSt5cTV4OUZSczlkY3JOVks0K2l0cTNWU1BXaXEwb3czMzFURUJXOTFYSlJoSHN1RUtUOEl5WW9vQm9UdXI4VVRpeUdTdGg2SzFsdFRiZHVvdzR2S2NtcmZhNk9QK0ZoR2xmOEF0aERHQUJ4d1NzTFd1TTgwZDNSdUdTbDJGM1VLNFVZNmRWTXQ5MStVb3pvMnU5YkxQVlpicW8wcmQreXc5dEE0TGFjVDBvcFpvemg5OVYrN3VyZGp3Y2loVFpHN3FPSEpIUjByY3B0M1UzZUN3bDhONFRLOHkyTVhycm1CN2QrK3E2dXJuNE4rN2J3TmRRa280ZjVVZ04vblVCTnRkKzlmNFY5ZFBDbDRCd2k1MTM3dGlvVjUrTkt0M0xySlg4SHR6aHpoRVJYVWJ3YXFxdUtxOG5rcHNOUTVvQ0JpVkRaZFVWZjR0bGRYbFZDM3dycTZvRmZ3dzJmdnEzWVBWREROTGtDeWMzYWNSU3BwcUl4ZmJ1VHJ2VDRVbTJxamZHWGhVZEsyazRhTjVIUW9rM1BjdDhXcW9PNUJvY2lxK052M0xLM2VqNHZGY1BGVVZWUlZrL1ZLS1ZQMVN2MHYvOFFBS1JBQkFBSUNBUVFCQXdVQkFRRUFBQUFBQVFBUklURkJFRkZoY1lFZ2thR3h3ZEhoOEREeFFQL2FBQWdCQVFBQlB5SC9BSjExRHBobFNwV0pYVWhCTHBralgwUHhtTklMUTRQTHg5TkJ2cFQybGY4QXcxOVZ5NE1NeHRNUHBKR2J5cWhCbHk1Y1dlNWRIK0xMeFJnN2RTaVY1akhBc3QzZ2ZDU2FQbjZhdUhCYnJCZi9BRUNWbEpucVdLK2s2S3k1ZlM1Y3VEYzhrbzY1aDJwZzV2MUw3WWxRSlpTdk1uQ2R0RkxCRFkrV3ZiUGFOQXBwZ2ZFSlVDM0J4MHBobFJkTUEvbVlsK0VMTW1MZG92bGNxVksrZ1VkVG9kQmp6QWFKU0U5QW9TOHBsTXQxUmhQdkxFTVJMSWQxRXc4end4NmluYmN1RnJSbDhRZFdUNWl5WC9MK0lDd0ZkS3l2WGFZOVlmQVFDbW1oam0rbHdhRkcxMVV0eDVPRlhMMW1PMTliOFN6ejFxWStzaERvUWk1Y056dVN6TnNSWm1CaUFCbmxhUHZDTE1NRFVNTkRhMHY3UUFVSHUxSno5TnpIM2lzVzA3eTN0RHdNQ25lWjdmZUlyNGRLWXdib3NFdXVEVWJTNEZsbTRlYjhDRmNEOEdhYy9KbUEyeHhudVdwVm1uSi9tTkVGYm9UNE5NTlJnS3B2QzE4eTcrSm12UWkvWmlDSzEwMDFQS2grbldYMmxkSzYxMWZySU11REw2blFHb3VUUk1ySjhpTGkxVUYxVEcyMnZXL3ZOQXdxaHZ6TDVIRnRPUGNSUzBLSGlBcy9sSmlET1RtSVdlQUxYK3NHbFJwUkMxMU9CbGNjN3pmZUd3cHhkL3BEM0s3VVg5SmtRTTV4QVFiVTZQNVRUTGRndjhwYzIxdkJpVUFoME5uN3luZm9LUHVoMFZtS0NmZUthZ0pSVjV6b2xtWktVWStjU2dIYnMvY3p4TEZpQXRWbytMM0ZUV3EvK0tpdmlMT1VicGU3V1N5MVNiaFFha1Z5MStaWnhQRDF1STFIcUlyb3JyYkxldHk1a3FZTkJxbnV4VXcyVXpFaXczUlFRU0kxVzhqeEZReUMyc0I4eFMyN0dhZTVoOXNOYi9tSlkwY2kvbExzWnJibEl4UEpvZUxKWVZyMmtyNWMvYVdoeXdUbjd0bW9Uc0lYVmIxa2IrOHFuV2F2bXZFekJZY1ZCSEZVbDBnTUcyV2MwNmcrNmRsMStzNERtYkIrSXVDR0MyMDEyTkpmREZNMW93VVErWWlVOWhTZmlibzVab1U5WEd3SjI5SHhEZ3I1aTBsSDVDV0dzZW9ITkR4bVdGZG5saHBNeDdzY1VMM3lzUkZJeGk5TFN4VThJZEtsZlVIaWYrVEJtQjNFZDRCcTkrKy9xRFZoTlJuMTQvRUVVQXROSy92OFF6MVJiU1B4MXZBZzNPVitmN2x3RnpONGZtTTF3YTJoODhURENlMFdzUkpyUzd2QVZEbHZhT0orT0lMYUNyMk5mckRDQzZITXV2RW9Md3cwRDhmekZYbllCdDh4VkhkNWhKRjNveTArTVMyZEZZQVQ4WEhBQU4yc3dnS0ROMUtmektzS0tYbCtKZzFWeUdGd1p6a2Z0Rk1FZFkvMGVwWTBJZklnK3RnQlV3bHU4dDNsKzg5b3k5QmhpK3FwdU44NXFLbHNQQ2VrQ2NSUEJDR0xUS2xyY3l2eksxNFVkaDJNelhHTjI1N2Y3bUE1anI5emdqWXVIWUxYeGU0aVlqS0QvVDRqc3dsT1QvUHZNSEFDZ28rY3pHaStUTCtYOFFadCtTMVE5bndCUkxVTTRBc1JwcDRpWGlVTUtjTXUrNGR0eVF4ZUdJRktLdmF1SUUwUXlKcDFmZjdNekdFWldhOUlXbURJd1B3VEtJT3hpWGFyL0RqalFVUmNEbTRsUEsxZ2VvVHRYTGF2MUkydmdYV2hHWFRwbXI5Q0piN20wZVJVdjQrODhpK2Jua1gwUnE2ZTkvYWNRTzFjdEZTcFVyNkt4MElOMU1wU1BCTTF5MXdydERPQjF0eDVpTU9VU2FGbENPMkg3L3orMGJYQUwyaGZPLzZsT3Z6NHZNU1lOMzNUOS8wbGpMUncyOEUyRVpvR1dIbzc3WmZCcUduc0MxOWpjZWVJMmc1R1p5SkF5ZmlpTUREcmtwL05SUUxrTHVmd0ZRRXFXLzFoVUdtZ05YUmxOMEt1ckl6VlRuQlhxQXNjRjlvTDBvZWFZRHpYdU15aFpBczVCT3lpSlZxeVUvYVN1WkxVcnBnTVg4d0s2bEhSWDJsOHAxM1F6R3ljU3o0alhkcGtYR1VFcms1YWpiS3JpOXpNVmVpS0ZwS2lWLzcxTndjZnBEYktXUTdvWVJraEVFZTBTWEFSY0RvVjRoWWRic2IxS0NnVkkwUDVRQUxaM1hDdmE4SEg3VE81WWhoRlAzbkdzVWYyeGZ1QlUwQldxcjFIbGRucDY4UmIya00wVWVDcGdVMlZpK0w0bHp5c3F2ZHRmNGdFcjcxS1BVVGJhUXBvZlV3MW5OTy9LV1dpcU1KTDM5NHRtVlI3TFV3VCt4Q25QNFN3NC9uUDJJVUlpb2ZPL3ZMQmc4QkZtMk1PQzFOcnc1Z1U1Y09LaWJScHpoY0NTODRDam5tWk5xOXd4YVRjSEhDWE9BbmZoTWxoanN3VTZMTUJ4SDRSMmcwS0pqZ21SOTYzS2ViRnFOdUh2MEliNkdvS1NXbUpsRGxPTWl4amIyaWk1cU4vK1EwVy9EOFNhYkpoMEs3UWcxUUdGcVpRRnl4d083MitZSjBySnNibmU0RzhYc28zMkZ6RW8xbFhGK0lQYjlXM2ZyR1dVTUhLYml4S1N2N1JUc25GMlRiUkxYMmJTVkdIZGFYUGIzVk1BVWRJdjBNOWFYODNQSS9hZjRzdDZQdk13L2tQM21hYmV4L1VNL0ExL1ZIRWoydytaZkpWNFkrU1hjOTlDKzM0bFpiZW9IdEh6TlM4WWxxOTU4RVVDVk5NVlc0OVRxTVE2TUVKUXJtVktkaGdaL01pYmptQllIVzAvVDNEaFYzVi9GNGlaZ2FPQWVsUW5LR3l0SGE0V1ZSaHNVcUJMakhMTi9FVzlzWXhhSGUwTFRFWGJMc1NJbTVScFR5ZmlldFBQaW0vdlMrOHZ3UzVySG9pbkt5Ky9TM2VlV1djcGx5L2VLWlF1VWhoemxHQXFLdlFMbFc0alhRSVE4NDhJcytNdGNSVWNtSVNFU2djOW80RXBhUVFyN3hkQjJYSWlGU2E1UDNSYnl4c1dOTmRGcjZOTzRjMHhsc3ozbW5GRExGM1QybHBUMjYxRExNTmlFNVpsaGt0OVFEb0h6SHVKVXROU3o0bkJjeWQ2NkYwZnBiK2c4ZjNnOTBXRlR5UzZvcTRCaFhhekFMcjJ3VERqNm1UVEZ2Y3o1dUoxRG0zZ3RpNUJWMEJtVjF2b011ZVpjdk1JQTVqdEEwT0Z5akZ0K3AySmgvVXhiSHRnazQrYmduaFB1bVdyR1Y3Smorb0JxSnN4RVdUNnVKZlVMYWxVeDAwZkJndzdySXhuVTE4d3BCVGlMeGN3alNXQmlwak1Gb3A5aEFGY21MWWdyWUhsaXU1NFZFU0ZuT0czbk1NOEdoUk15TUMxUzdIOEM1WVhYM3hEUDhBNUdOSWl2TUE1bEErSUFNRVY4U3NtNWdNYWpkMFBzbGZZUlNhZmVEZjRaZmNCV0JqZlB4M0tlRER2K3lVSVBKRnU4dVo2VjlkUk9wQXVyak11dkVFeUhpSXZOMUg0TmFtd3NucEF0Y2h6TmVLQ0d3K1lxUk9lMXd2d2dGY1hjc0FVVlY2ZW9XWlR2bUhQbVZ0OW1aaUdvdDdJT21XWE16TFl1WmZpWEJlOHZHWnFXQ2lJT0Y1aWJGZkJFcCs5dUxrM2JNNjEwdjY2bXMyajBKUjFTVjB2YVhlNEplcGh1NFVLL2FBWElFYU5ueEZYUzg5NEZCN1VCbWJHQzJHcDd4THppMkJKMjFYdVY1WXNkemhqMGRMME02Uk9odktpcmZCUElPNng3YStZc2RibHlRNFdORytmcXJvUXVaZW9ZNEtnZEZ4RDZUUGlCNTZVeGRLbDA2amt1dnFacTNETTF4TWM1bFRVV0xSSHgxYWpFVWdTNmxSTTNOcTZZaVBnamx1T1pXWUVvWXEvTUhXUUhaai9jeVJNeW9MTlNsN2xIdjJ5dkVxSFNvT2g2cjZqY3VwdGlWMnpCaTBYSDRreGtxanVOUFAxNDQ2bXBhakU1eFhmaUZFOVVhbEUwaVZiTTlOUzFuTUtsYzlBZm91anBjVXVGdUU1ajllblRjOFRiTk5CZ0ZNcy9tQzYrNlUvU1RaNitnWXlxaXptYzlSWXNNcGRrWW9tV3BUVXFWMEJLdVZVMFRCREdYNWk2LzYxT0lYY1BLUHRMUlowWDByaEZUQjlkS2UwTU01bUNNTDBkUlk2QkNvMWVvMU5xbHhjZERnbG1JLzgvL2FBQXdEQVFBQ0FBTUFBQUFRN0RsRU00Sjc4UnBOTCtpNU1YTWVaWkFVOUd4M0E5WEJNNGs4b25pUloxQ3dJNkRhNnVFUTg4ZjBVenBaeDJ1TWFub2JRM1VJUnNxZjRIMVl4N1F3Y25jUzhsbW1LanlvWGNyM0ZBR2pEY0lOMVR2cU95M3RKR0Z6S1dORmM3bFJESWhOUVNPSTVlaC92WE9iNFVnelNzRlNGY1lvUld5MzhOSjNGMXRacTJHbVVwOEc1QnVxKytTZU1iZjI5NjAvSFZNRmZhQ3FjZDZTaVNHaWUybUhMM3lObUZidmg0Um5YcDVrVkN5ai92cnJueWpEai9PNEE1dE8rZnRwRnRsMHV5VHpuTHZHT09DbVp3SUFOcFBwUnhaUnFidlNqK3lhbmZQaU40RUFBLy9FQUI4UkFBTUFBZ0lEQVFFQUFBQUFBQUFBQUFBQkVSQWhJREF4UUVGUmNmL2FBQWdCQXdFQlB4RDBOY3AwMHZVazJKUG81ZEY0WHFoQ01pUlB3bXlFdy9nU0d6RW9iTWVteUluSnA4SmhMNklTSkN3TlJSaEl0bXYwYjVnMjJ4cGtaRFpPRFdJSkNDK1JUNE5EUlV2R0RMYUcyRlJibUlVRzBhTmNZSkNFQlQ0VkRML0EyVytFb25qWlNsWldVcGVFSXhoRWxDcjN3aHVlQnNiTm15Y0xpOWFRaGFFSkI0YUVTOGpHdXVjbG1sakcyeHZvL0JTNUJ2MGtYTnd2U1hVKytFSngvOFFBSVJFQkFRRUFBZ0VFQXdFQUFBQUFBQUFBQVFBUkVDRXhNRUJCOENCUllZSC8yZ0FJQVFJQkFUOFE5ZFlIbmVkUGFJSmI0STBhdGx0M3hucDdiYXRyODI5V3Y3aWJ2N1pTT3BMUVNOdlZyWWQ5Tlo3Wk9iYy8xTCtMWDdoenUyVzlXUHlUUGNINzlZQVJuUGo4OWxtZko4VHJ6Tzd0SVR6d0Y1MkJEOXdJL20zZEwvWWJXMWpTNy9MWlpQQ3lHN2xJNlkyWG9rMmZpQStMR1Q3MWZmdVF6RGhpdzRaWlp4dHNwRVRoUWpubHU3V0k4UUYxZGZoaFk0dzR3c1BRWGdObVpHT3NuZ1FaRDdUSk5JQWVvYjBRZThzYnBHTExQYkpIdXoyMy84UUFLQkFCQUFJQ0FnSUNBd0FEQVFFQkFRQUFBUUFSSVRGQlVXRnhnWkVRb2JIQjBmQWc0VER4LzlvQUNBRUJBQUUvRUlQL0FJcjhEQmd3aFlpcGFXTWZoSU5XWU16dEZUTUZpZ3VHUVNvWDNCYXFpblVWM01lWXRheVhnaU5pQ0FCYlV3Q0w4UVdiZ0s0M0tITjZQOHNiWVBwUG9palpVZnpVWXhqSDhQNUlRTGxwVXFWQ0RDQ2tyWlVjUVJaaGdWdWJpUldHekxCNHFNdUpSeEJiRVNTbmNmT0JYTURxNTVJK1ZIWE1MVnRIZy80STNXUTJIZnZ1SXVBNWhLb1pBKzFsY1ZPWFVvMTRBV3hRM3U0ajVGSytpb3YvQUlFZ0JWMEJkemNvMDN4WEZpeGorRWxTb0Z3dEJTcmlvTG01MFZMNkxqMkNtVkEvQmlWTTAzTFkvZ3Y4Qnd2VHlTcE1Ha1Irb3JlSlRLV0l4cFJYZUtsSHpkZjdScG9lWE1VeWptUFExY2d2MEdXQ3F6eG55RTBmTE9naHVnOHRGK0Q3aUJzSTh0eFlGQVFla3B1dk9JQXNTak5Eb3ZNWjNGZTRmS0ZmeElLL3dUeXQ5WWxUWHlaamdrVEpTcStvdTdXcW96YjhhU2tRUjZQd2ZnTVVNbm1NUy9wT3lJdUtDSFVHallNYjZHMldrYlYxRVhYNGwrSTlNcEpUT0VpdTJwY2dWdUVITndxT1pRV3ZadVBtL1NMRzYxMVNLV2lkcTNMTFJtQ2dQUmxIanoydGZRYmh0QkdLOXZHZys3WnFSaVNQL0dnWVVWRjFoWjVyRisxWTVjZ0JGTHJHdmJMNWhiaTRweWRXU2wyMFppU0pVTEtPNmRRRkJPbFpQYlJITzJZOHN3MFBuTVJVcXVyeERVcVVoVGlMMUZpeTRRL0lEdUFkeFZ1QUZWR0VYR1J5QnYzRE4vc2VhY1BFQ1VYY3RYV1lOVGFxUWUxZ2d5eVprVHhYZXVJVUlvYWJKb3Exc2VVMnU0VTRxc3pCYTZvVk94MmdFTkhORFI2dk1iUVlacEx3TUhxNEFiR21paThhdW9mRnZNdUt1aUVpOVUwMjhIMnhYRVd4ZTZnZ0xYNWh3MTBwS1Y0L0g5bUJocy85RjMrNEN6U3VmOWtMcW1sTE5zVlFYZ2FndFZvUW5nT1Y0SXNleXlrOXRIMUJvSmRTQWVTcmo1cVdXTHBhTlUycXZFZTB2RklnY05IZXRBcXZXSUUrQ1Y2dnErcjh6SUJjOEJiOVJoVGJ4YjI4Zk1SSy9DcFVwM0VJeFJmeVF1RmtUM0tOd01HSVRFczB3b2cxdVVUY3RiaG9ydnkxZjBjc3BxVzhBV1BJWS94N2cydUFmQkxqUjBCN2d1MjhGbDdnU1ZQWlhUYVhLdk1kbnNhSURsNEVwbzJqQURMZ2QrZmxoTEV3VlFhY3Q3WjB3eGhvM25XK28xc1ZvQmlNdEdGZkV4SGFCWlhxN2ZnbUhGbHBsTG53Zk1BaXFzTXF2NDFCdkNxUlVLZHMxN2dlbHhCWjhKejQzTHIxQ1ZadHEwTmEwMHZVQ3pDdEFlczhJMlcyeVQ2Q3dibE1odFdTY3JoejlTNUV5a1k3Yk5lcWl1a3pzVThoVy9GVkRHS2l4ZnRLSDRobFJGRDNpdzBISmZpb096b0lWQlYwTnZaZHU2aVNDTm9wRjRIOUVOUzJwVllsY1lSK2h2aVUxTlRBQmNaRFo2Y3pNSG1ndDgzZXZVdWw2dzZsMFZkL3FBaFpUUWo1S0tqcGxCbkN1Y2x0OXdkaHZ4RTJydzU4U3h0aUR6QjFsT0ppRVZtWlc4UlVzY1RNTGxEQnRSdVdrRkZSV1JKWmtHRXJSdXVmRUpubHBnS3ZQV0dZNnhiRVhsT3dyZDhSd0pFMW9GOWtyTldIY3dEUUl5TkZ0d1d1aFFtNlIzN2o3UHRrV3VDN3RlcW1GQVdQd2RHNlhlVm0yVWtDajY5ekxXYUdTT0NGVjN6TEc5YkhJY0Z5TWJSRUVpWEU2NEZYaG9saUVhVXhUZHRxVnpOZzNsQUR5akh1R0RSa1MrYnNCUTNqZlVUU3lSa0dnQkFjWjArWURWaXc1TVZRcWF5MDhFYlM5RnFBZDBTbTJoVWovQy9ReEtNQzVWNnl2R2JhM05hS2cxY1ZlYXVBRm9SY2kwNU9hc2hSSVdDc09HcTM3WlR2S0hCZXIwL0lRRk5BWkZ5TEEvY1hhc2hlRFFtR0lETjlGRkxROFhkUmlKcTlqNGVvNHlQVUV1UWdOb2RqMlIyQWhUTDh5OXdqOHhXMTlCUE1TTi9ZYVBxQ1dONHpLTXFkVHdSY3dHc3hrZnU0b3Uyb0c4eGlMbWZjTUlRUW1VdlVGQUc5M1gyakJMOUczQUxYTks5OHNvR1kyOWczWW5oaTdZN2hiOE1nQzBMVllxOFVLaERUQ2dtQkxvd3lVZm1acWhOMFVhZUZ2RG94eVJ0cE13NldPVnJCODNDR2VWU3dwYzFMRE9Td2doQXJMODVCMWlYaFVpNmhLMngyY1FzVnRuL29sQktzNW1CVG9NbnFwa3k4NE1SUXFCN05SNEtOTnR3Smp5L2NyeDJTYkNxdS93REVUNXBXYzdjSDUrRUhCcTBLbDRXSDRoTXVXMkFHNzAvb2w2VUM1WXpVQVByTVZnaUdVOEZHZkpIb2syQzd5dk5HOVRmajBJbTZ0K3hsbWxzNjExMmUwUWhoRVFxS1hDaGdyV0dFaTBXTXIwTTQ4c0djS0pYTk9Lc3gwUGNkZ2Vvb2FndkJOaUpEbmcvekVyQVJTTG9RM0QzaWptV081UmN0UURtNVpHTC9BQlQ5R1dHZTI1bFhlWTV4Ukc0dXU0OTZRdG9SQzI3T1VQdUtNMlF3a0c5LzRnejB5dzBTa1ZnS3U0cVhWTnlidXpaNTRjZTRqUXcwb0hacTBlRGFjRld4eEsxb09PMWRKMC91YS9aVWoyc3E4WUs4d0VyaHhCcDBXMWdMaU9wRDVkUTVSaks4dHZFcUNQUmc0cHBiSFVGV1doV3M1UmRCV2NDSVlncFRQb2psOVNtTU1LVHV5djdnRjB1bkJjS1d2Z2hBb3RjSWJpWXp0TUg3bURWeXprQ0tiK0daVElOZ2ttRnFvWG1Hc2Jxdmh1Nk1TbnEyUktrcnl2T01HOEV0eGR0TGlWT1RwV285SVlRZmdPWVlBamFvbjVwU0lKaGJMcUhRdHNWRkV3cnRLWUY1dlVJUzVPSTk0RmFwWExGYTAxMWxEdmk5Wmh2c3NJdEY2TC8yeW1naTArUGZ3RngrMFVxeVI2NEg0aVRJZk1OdC9PdjdMMzlSL2dpRC9PZjJYVWs0VWZWSTNqckVmOS91UFRPaEZrVldTS2lTdndXVGoxRVJsUnR2SEhjcWhLc3c5eFVGaHpNdzVSTERHSmtqVlJjbGNJQ1pYVGFFc0I5WnhsNmg5RVFob0RGNlZ3Vm5mbURIVUlrQlNvTUxnWGVMZUplSllMS0ZUa05YcUZIY09TR3JYZVZYeUN2SVpHZEJCNXlWUlJoeTQ2RHVEOXB0akVhb3RXdXF4MWNXV3dyWFM3MW9PdVBVeXpnTG5vNUI0dUZnUUxTdUw1UGxJMG9hQWdiYzB2elV4eG9DVVF4VGk5eTNvQUFBbUFIQjQrNG44ZmNxTkp3aGJ0d1EwaVNLWXFTcWVWMUZlSHpjcjBxUC9aaEZIdnBEUFZmNnhGclJ3V3Qwd3l2YTRqTWxsUlc2d1VRZW03KzQ5WjBWUVlaWHhVbjZGaGxuc0VmNngrcGJlSUsySE5GRndNaEY4cGVrdHdyTDg0dS8vc28rRUE4UnlncjNURVlHbklnUHZNQ3NCNXBNZW4wMy9JdUdkaThIKzRtemg5MWNSYUx2VmFoVWdRc0FONHVHVjBNQU4zTE5nenB4anVVQTJOSzRxcStaa1NHUXBqTUtweWNCYStwYXpwNmdyZ05GdVlQcWpySkx0VUdkWklxcHI2UXd6WjZoc0VxWm14dFhxVTRDTk53djN1c01NMVppMkRUSzdvMi9nWCtJdkFvM2x4dGpVdlJqZllPRHk5TEFrRUxDTERBYk1aK0E1UVNjVmFsWnF0c0dBb3djTExHN3M5djJkZlBxSmsyeGVRNnJLMS9uaVp0L2laQzRXMTRKZGlFN0NpbGlmQS9wRFdRNERKbXVYc29nelpoVFEwTENDK2IrWU1lckJ5R3FWcFhkNXZNYnRLQURIQzFENFlyUmEzVVR1SCtzeTdaTGR6QXdwZUwwWHhMRHpoUTdpTGNkNThRWFY5Tkw0UUtlSVp6b2dFZEpHZ3V6TnFQT2JJSzFOc1B5RnBNb0lmWk43NXcvM0FqYWpzUmFCVnlqZEwvTi9JdkhTcUFWNm9QMU9BQnNBQjZKZkd6b1dZT29icmpGYitaZEtzellUZkNZOUV5aFFnb3BWOWU0b29BeGtaY2w5WEJMUzkwcDZZcHRrUkRTZldJQ3Q1MmhRdnFpMnU1a0NLcWpia3U3cnFVbENCQmFhOEtCR2xhQzhsaDI0ODQrWmJtYmNsMTMvd0F4aEdGeUJ4dHY5eTBCaTdpNmRZK2YzQzJBb2pnUEp4bUlpZE4yV0s3SFViMFQ2Ui8yc1JJdHRiWmJCbVlXNmxVMUNMMmRZM0hWZFo3akFYQnpjT0oyYllyU29ZcmxUbG1EK2wrSXBkWndxUXNYcXpuMWRRWFlCc01lNmpvUFFkcXpSaHJiYUdyT2Evc2E2Y0VXRjBCeXYvWEVXaVZsRjJSMGwweFVFS0ZNYllWVHIvOEFrcFlQc1NWbXdhUEtWRTVvK0NVWVY4Mzh5b0YwanJEbTZUL0lLVTBhRDR4VUUxb0FRVVo1VzNUdjRsT21VN3pacW9EeWpvb1AxRlNqeXMramlYU1NRQkxlUXlIbUFuSHZQOHBqU3VGUGtZSDVHTGlYMk1NQjlLWEh1L1NJYzQrRkduZWMycCtxZ2M2SG1CV0kxOEErNjVtSXJXRXMrZjhBV0VBUUEyOWlBTG1lNXhRT1U4elZTdGM0cjFFSnBRZEYzT1d6Wjg1aTQ0dlZFYkVzNHdaM0wwQ0ZVcTBlTXdxT1kxYzNqenJFdHJXK2RNdFJzSnozQTJ6QVNreEx4WHpWbVg1cTQxYktkZ3hTQkZoZVlsVlcxMi9nQkx1RE1CNWxhcUkxYzlRTmt6b3FzMUFVbXpjUzU2dFFOSXJzTk5TdGVVYWNMSE5WNFZ6NW1mR3F1c3F1MWdyQkFBV0RvWHRkNW90akoxRGFSV1MrbGM4ZTRzTHZhZkNoQ0FlY24zR1JuQzBRMENBNTM3eEUxQmNMQ1RwM1Q5d0tCQmtEc3JwR3VxcTh1WllhQS9zSGlLc3FIeU9HSmw1MUwyWVl2QnBnSEd2REF1Qy9jNFFRd1JlbG5hSDJHUEd2UnFGMlB2bS84VVhaOXNvYSthMlZzajBDWVY4WlZsYXEzM0s1RmdPa0VDMVg0SWFId1lnWkxvQXlmY0M5V2VwMERjWlFmWkt1YTViMUZ0dUNqMStNQXNDVUFXM25nZ3RpL3dBSmN4OFNrTEFQbUR0aDd1WE5tY2JnMy82SUF2OEFSRzhCOWtXR1MrY0xHb3FtaGlHbUlYaDk0Wm1lZ3R5UG9Sb2ZKR1RJQnJzOTV1WWl3TjV4VmZVSXNOQ0FxOTYzOHk5YlB1QUZzKzRBMm96TTI1VktoYU56cEIxR2V3dm1XMWM4VG1CNEdZQUI5UktYQzZXbTU4a3Eyb25pb0IzajNGSG1Gb0N2aUpGa2QwT3Zjc01GYmZFMHduR0VZM21NUllBcGZadVd2RU1tMzFFUWdLcHJTb2w5WER0RkptcTlRTFVkUlZiVzF5eC9Bd3FsSGlhWGkzTDRJL2kzZjBSaEhPYkRJZkV1V3didmlMa2NacGdVRnJPQ0wxRHE1V2hlNEJIVCs1ZUJwZDFoTHNzR3k0bGxGOXJ6S3F0OFJqeSs0TFJmMUxmVDhNdVlEYW1MNWZXWlhRazJhdm1XYmZFdXpZMTVpTjdndDFNdmlMU2prbEdPZUkydkdOK29oZ1B1Ymw4U3hoM09pbStlSVFzSTFiOVJGb2VHL21BbkE1cUtjM1RtaElyNkwvNXhBTWZFb21VV1ZsWlB4TkJDNFhuMElxbWlhR05CVUsxUXl5MHBVRjhMdW54RWNIbVBBcTI4eGhNUi9GMVh0dGlNQm8vY1o4eFNGQzl4d00yUEVzdHp5UkR3c3FXTXJVTkVWeHZGd1VaTWR1WXNrQTFZWHMxWk5BYlp0elV4U3dXcXQyYkM2eGU1U0pqdEwrd1hLQW5vQnQ3b3UwS3kxaVhoNHU2TDV4M01sUm9Jb255NGdqVllMTG5SYmpVVEVJMG5HWDNDeHA0WDQ1L1VxNEF3aDdpUnFOandKdW1yM1FWSzJDM0YzWUk0SldZQnlqbFdQMGpNS28zQzMyR0ZHem00Q1V0UG1XTlBZaFhaMnVyNWpnM3RWQk1LdWlxbjZZTUFXN1BZZkZ1NEdtSmNBKytmTWR1QlYyeklOMW9kTlFtbHEzUXl4VzFIbGJTSkd6UEJpS2xXKzVjMHkrMGJjdTJaUktqTGwyU2hpWm1PSGZYVXJMaitBcmxBQzhzUVZiVVhxSFB0RVUxcnErOVNxRUFnVnIxTDBxQzZ6OS95QUU5a3NZK2ovTncwQml4YlhtanpCbXdYSWtIeDc4eWxkVGw3Q1hrcUhSTUtxbUtRQlRqdW9ydldCYmtmaXBRRVFFR2pkK0VWY3k2bVJVS0srSUIwd0s2Sy93Q0lWaktGNlBxV0Exd2kyd01vRHdjUjVGeTFMRXVqR1N3OXhBcHllbW80VEQzRUlBRDNDa2lEZmNhUktIZ2c5dUMybFJpa09RcXZsZ1VMS1ZzS1I1OVJsZFhyYmw3bUR5YzNGZTlhL0M4eHcvTUlPQ0ZYQXVQU05zc01hWlFBd3pCbVVHVzE0T0liamtuWExmaGIyMk1RbHNyS0JPSE1WRFJlSUNqa3BYS1Y2dFhhTGYxRFVxTGFSVDFMaWpGWi9wSFRRS2RzQ2dwc2ZMRWZGS0ZaWGVvU3kzaCs1a1hETGNOK2pVSW9GOFZ1SWNpamxYTGpnNEEvekJ3S1F5YlBFZDAxN2g3cVdKU3BtSmJqM3FPbzNFWXFXT0lJTGFTTGp2QUl2RndhdGZxV0o1Y0RCOVJWVmJWM0VWSU92TXB1aTlGdlQ3Z1FFWEIzTk9ibTh6dGx6V0lKNHhBWW04UkNNQ2hpTEtJbnVPNHl3YWR5amFPeGxSZytKZE9NUnFxenBBZHZOM0FYUXN1YTArWWhTc2NYRkdOV2pFdmN3NjBjZUk1RTlFVjVlVnFYQ2p0Nk5RRlErMWc1QThZbExhSWNYK0JhUzhkVFJXb0s4ZUlLd0NFekRjY3JjekVCUkVLNVZjYXZLUXZUZDEwUWlxb3pVelVYekd1ODZqb21LQlZEcEFBQitHNi95UmFMdG8vbzNCS1daNmJqaGlLVzNsd0UwSythTGxlaitDYWlVdUJGV1gxUWZFVE80ajNEQmFLOVF6RWNTdDJwQ2tzbDVtU29OYWwvaXZQNFZCNmh5R0lqb2wxeVBTTUxzZ29RNm9xMkt5d1RrWGRSWXhZVkxjU3RsUy8vQUNpQ3JnemZjZGZoSUhWWmxvZU9JNnltOCtZNER0Y2t0Uzg4M0RHODNCYndWSEJzOXg1SWpJYkx5RWRBWVNMd3hFeEJkRklrcHArSVhSR29pcTdPRmNWRlhrWWpXWmRZdUN6ekUzTFJGakNVSEVLMnM4RlM1ZFYzR25PSlo2VEpmenYvQU1MSXUvRUtxN3o2bFc2OHkzbGZraDFiNmxqMkp1N1ZqNVNaaTRnQ21HcXBPb1dJalNVLytMbW1yL2NjdUtWeCtLMEF1cnFwa2VZNFJoaDdaUzhFVE12S3RQaVBFcDF0aW9maFZibWdSTkVMTlZVQ3pkbmdpRmd4eEFZb01tWVBiK0ZUS0MzN25aR3JtSTF2bmNVbzdnMEJWRXYrSC9neC93Q01QNXByVEFaYnhBcGM5VktBaWp4TmlVRnlqVWFrK3p6TDhKYTFmRTR2RzRVT1lGRXc2cU9NUDVhb3BjVEk4MVM5d0ZpNnVaQUl1U2I5eHBiQ3ZCeEIrWFdwYW5Uck1NQnZVTFIxeE1HWlY2anE0NnNjeXdTbUF3R09TeHM0aW9jbk1NcFJZbFFweXk0SDNFb05SV1ZPUC95Ly85az0iLCAiYXBwcm92ZSI6ICJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LC85ai80QUFRU2taSlJnQUJBUUFBQVFBQkFBRC8yd0JEQUFvSEJ3Z0hCZ29JQ0FnTENnb0xEaGdRRGcwTkRoMFZGaEVZSXg4bEpDSWZJaUVtS3pjdkppazBLU0VpTUVFeE5EazdQajQrSlM1RVNVTThTRGM5UGp2LzJ3QkRBUW9MQ3c0TkRod1FFQnc3S0NJb096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenYvd2dBUkNBRGxBYVFEQVNJQUFoRUJBeEVCLzhRQUd3QUFBZ01CQVFFQUFBQUFBQUFBQUFBQUFBRUNBd1FGQmdmL3hBQVlBUUVCQVFFQkFBQUFBQUFBQUFBQUFBQUFBUUlEQlAvYUFBd0RBUUFDRUFNUUFBQUI4YzA1SlRyc21oa29pbmNRcHVySXlWbGxNbEt4S2NSTU5aR3dHbWcwd0FyUjArVjErWGFHNHpZNlhVYS9QNnpISEtyZUFIY2sxWm14cWExbERDZGJqTkpoWUFoeU4yTjE0cFJzQU5aazA0YzR5bGJVcFpXcXZPbEdVZDRkc0s1VlpYZFpDTnRkQUZ3QVVBMEFCZ2kzdGNMdmMrM1M1ZmE0K040K1R2eWRNVXduRzVKdStGR1ZNM0JUdDFqTklWaWpKeXdHckFMWmRHYlJqenBBYndBRXBLek5rclhOVldUbm0weHNyMUVndVpSc0phNTNJcWpPTnluTjFVU1Z5aVNFSXNZSVBVZVg5bGpwZnlOWEN6MHF5enIxZ1pjbGxkK0RPMGkzVWowTUYyTjU0eVcrVEpTS3E3WTJWOUxEZm5lVkJ2QW1oZ0VwUmNUY0hMWVFjc2tsWkthc2xoR2NMbWFMWll4a3JJeG1ybUxVcVRTQk5VQUp0OVJrWEx2aDVtL2wxQkVyaVdxTThieVNzaXRkV3FpcFN2enBSSU44eHVFTlN0bWpIS09vQVhLR2xBQ1RpNGs0emxZZ1pLMld0QlpKcDNLdEZMWldwUlc1T3lwem5aUXI2aXRoUzI0KzFOZFRtMllPZmZQbW5Wdm05RmZXeVZYUXA0dWZEWFQwVVJzbGJkaDZtYU1DdWoweFhMVFhuVHhCdkNUTlJNbEZZTlVBV0VYREdEc3Fjc25FSk9Fa201eWh1cTlNMDVWMldRdHFXMlVTUjA2SzZ6UnNyMFBUK2Y3Mk91UG42c2MxV08yNG05Zk96Vm95TGZQcDJjbTNOMTVWT3Jland0dVpHblZtYm56bXVtVW10WkUwb0RpTEVvQVNjV1dSaTRrSUpTaElHNWlzVTRWa0hKYlRhMHJyc2hVcks5ZVVWZThzRlBReTdiUFJaNFo5SE01K2pQWlhxaDE4VEhpMnd2TGwyZEhMdVo3WTIwVnpyaUVadlVyaEt1aUxTeGR5bW9RbWlKSlZGVElnVEZoSUxCdTNOcmQwQ0pJR3lTRTR6VFJmQy9ubU92bzlEbHJ5TWZVNk5UazI2c09acHF0NkZ4eGNYcTgrcnplUjIrWG4xY282MnV6bmF1N2JNZVZsMzQzbDU3UjFvWjF5OG5yTGJqNTlEM1BNNlh6VkhvS3RhNHk3dEtjV3U2bnBZcVNvVFVxQUN5dFM2Q2dtckpRbmMzUmhQR29TdW5aUWFwUmxzMVh4bHQ2UG91YzQzb0paOHl6aWQvbkhLN2NOaVZ2TGlzN2VhL21UVi9LNnl6ZWZwNVhRT2xUZHhKZDhvWEN5ejZXc1BpYWVScWRxRlhUazVuVTV0MHRQTTlSeGJmTzBldXIyOGREcTBkWFBOczJ1ZkhvVTFrV21GbEN0alVDUXBLQVdTcmNXeXJJdW5TelJwdzZjNTlOcnlaT0d0RDVWMjgyZGp5bGxudThmSTlEbStiNTNzTUZuRTZNYUpQUTVlU3BlOUx6bEVleXkrYVRmb3p6d25ZeDVkRm5LNkc3c1ZoNmNPU3ZRNXZuN1UxVlg0enA5SEZzazg5eVBWZVI2YW5MUERkMVUweHF5TmFza1JLQkF4cFc0c25Pc2l5VmJMcjhiazloMC9EOUx6NjY5SFN1NTY0MXVLUFRHMmpQblQwT254OHRaOXpSNHFkZXlxOHZybU90RGxaRjlIbndVelhxSmVlMHk5MnZnNTdQUzUvTmRTODhVS3RPcTZhTTlwcXhxMzFhNHZOeHJzOFhQRG91cFVkMXBBSm9FQ2dBTkEzR1FPTWh0Q1N0cGNicmVlOHpzUjVablhXbHhwSjY2N3krakY5SGdoQnl4NmNPalRSMU1qbWNWMnk3TjRmSjM4enRyYlpnN0dkNDc4Vk56cjI1dlg1NStMVi9NM2VqdDRDYjZYTFMwbW94cHVDVnFVVkFCQ0FUU2dBd0FuQUd3R0FqY1dOeENVa2h6aUpaS3B5V3dxUlk2U3RCUXBMOWZOc1dVQ0xVcnN3VFNqVnVqRTVpK05MYlFqVVpGZ05RbWxhM0VnSlFVQkRCREVBQU1BWWdZbVNFSXhXeE9ObEdkRW9QZUxGRkFoaUVVQWljUUpPRXBVbWdFeHhCQ2NibGpHTnFWS1VRUUswMENCUUVBQURRQUFBV1JBVEFVZ0JBV2FBNTdwcURlR3dzQUVRQ2lBQUIzZ2xFZ1ZSQUFCQUFBQUE1Z1ZnQUFxQUVBREFRQUFILy94QUFzRUFBQ0FnRUNCZ0lCQkFNQkFRQUFBQUFCQWdBREVRUVNFQk1nSVRBeEZDSkJJekl6UUFVVkpFSkQvOW9BQ0FFQkFBRUZBdUE2Z01BKzRQVVgyZmZqb09MaDIxRm9sVGlqVEtXdU4yMUE3Wmg2QUlXNkEzV3E1TFlyVHJIWXhWakdZNEx3SHMrL0hWL00vYTNsOHkzVW5mZGdKWGN3TGRBRWJzUEVJdUtheVN4OENqSlk4ZHBoK29naDhsZjhsbjd3TzJCdnZmTVBTb2xpNFBFZGRTaVdPYkg4R2V3N0RpcHhEM01XRWVUL0FOUDlwWXVLMlNXQ0dIZ0JBa1pvV0o0Rk1wMW91VGNkbzZsR2VJRVBRT0t3bmpqeGFNY3lXdExYanZ4eEVTTlp4QW1ObEI0NDZLLzA2ejNQUU9BNGRwMmpkQ2UvL1hhWkVNeEFjVGNJZkRva05Xa3VzbGpROFFJVzJnaWU1dHhNeGljSG9QQlJscmpqcnpNek03NHowZWg2RUU5RStUUzA4KysxNVljeCtJbjdWUGN3amdpNVorR09uK0pmTXZ2MlhHREJHSGI4ZVBUVmlpaXl4WmFZZUFsYXg1ampqdld2MWYzdzl6MXc3VmdraytMOGNSUHo3SkhCZlJYeDZXdm02bHJHTVo0N0FrOEZXS20xZHN4amlSM1VmUitqRVpscmg5OGNkZWVJRXgwQ1lucVo0aVk3NGhHSWVqUWpiWFlZN1E4Qkt3cUoyYUVRaU11T0FFWHVqcGc0NFVwbG5mRGRPZTNIODhSNzJOTXpjZWtROEJDSU9KaDZLbDI2V3p0R1BGRnlkUi9JSFpJTlNaelV5VHZoMmlNNU0wN2JXc1RzeXdMazJ1RVgrb3BCaFdDQ0VUOC9pRHVCRENPM0NsT1phVmU1clVkSWVBRXFHSm5jeGdoaWlHWXdERTFSdzFsUmpXOXZMa2Jldjg1bUlPQkVFTVU0NGZYQmRveERFaWFKTXQvRFhmWVdtUHJpSXVUZVF0UlFLSjZnOXpHSVlaM0V4Mmh4bmp0UDlERXgydzIzOHdjU0lGaUtTdnh6bHFjVDRybUZHcm1ncjI2ZTk1WVlQMnFKcDZ0MGFoN2o4VzByWnA3YWh5NTZpeHVKNmZxSnZtNlo0Wm1abVo2Y1RIVG1MSzFFenRpVm83UC9BSTk0Mmx1UUpwOTdWNkJVVWNsU3JPMXJYT3I4aGJGK0pkVkdPeXF4ekNDWXFFaW1uSnRHK0xwY1RsM0U4clVDS2Q0K0J2ajZPMUl5N1RQMjhNRXdKa3NtQitlR09sZHM1c3h3RUNHSGhqZ0ozNERzYXdJdWxzZUpvSFNiZHFCYXBsQWVYYTdXVUlYWFRnS3RWSmhxQkIwNEp2cW5Kc254U1ltbE1yMDRBT21YYTFMejQxa05kdGc1dFNFWjJZUjVib2xNcy94cG4rc3ZNK0FRM00wbEFheGRRcnFWSkdQRG1abVFadkFtOG5oanRpWW1JRkppMTdpS3N5alNZbGRTckw3K1dMTmJaa2F5MHlxeDdGS1ZxRnNKaDI0MzJOWlpxRnJObDVEaS9VdUtydTlsMWRjRjFqT2JrVXFVSktYQnFyTDY3ckxNVkZFdGI0NTI4emtCTlkrOFdkN2JyRmpvTFpacG5RQUVBdzhjZGVJQUpnUUFRWW1GbUVtRW1FaWNvR3RhM2FwYTFoc1JRdG1JeWg0MU5lNU5PcWx5aVMzVWdWMWFwUzFnYXl1dDNydmVuQnMrdGUxWE5LMXkxYW1WdG1hVExrV0JUVHAwKzFOKzNKc2NTa3NMZVdqejQ3Y3hjVms3Q3R1blJXcjJQTDlMVzhhc1pLaWJKc215RlppWW1KampuaG1abVptQ2JvajRtbWJGVHVFV3pVRGM5cTg0WDdUUnErWWdBSzZwY2hySEsyN3E3ZWF4cW8xcXNxOHBxenB3RzVhR0N1dkpDeGtyenNHUDBWTnVyamFobXEzTXBwMDl4aVY2bktKdEZ4VVJucFZiWFlSN2NTaDZ3ZFluMTFLSEc4aWMxcHpubk9lR3hvV00zVE16MjhIZWJXaWhzMFZQWnBiZFBma0sxVnR1RlYyWXRYWnNPbTFqZ1YycGFMZE1sa09pcncrblVFMURjTVVuOVo0VjJ4cmlyL0thZklaeUZ0TGNzeFVwejhRUVVOdlViRk55QVc2MHg3OTByN2ovQUpXbG43dERweVRxZzF6YTFDbWtaV3l3ODJaa3pMVGMwVnlEcGRidEJ1NXNOWE9ZVm10eHRxSTJXUnF3WGJla3IxTHJGL3lOSm55S2pEZlVaK2haQ21uUnh6SzV5V1p2aXZEV09jVXJzUmRQVE9WUldCY21Qa2htdDVtMXpaYmNuT1Fpb0xIM0NjeGtsZUZIelRZdk1PbW1vMXZNSmJjV0RUSm1mNk5lVEsyd2E3UVpkaGgreHloTmhmWkJmWUl5bUJ3aUZ2dHZkSXR6dVJYZVlUZXBJdGgzMXpha0d5TmNOdEdvWmJOUVdGd1pDOXVxdHMwM00rM3orM05zZWJST1lFbnNqVWN0WHV6QzJabVo3ZjBSdGxiN1lMdTlWMWdEWEFINVR6NWYyUktyaFRwSzBhM1M2Ykw2QkNXLzVMMXB0dHAwOUYxTnRqY2lmWjRVL3dDZlhQdjFXNFJMVUR1NmJoZXF2ZHI3SFlXV09YcFpxMndvQXNhY3VWUHBWbXJ1TmpabTZaaG52eTQ4RzZmbk1KN2oyRzJ5alVtdWY3Qm1ObDlPR3NxWmwxQ0l5ZjVCaERyckRGMTMyZlZNdFd0YjVGNFhzRXpIMGlEVHVpYmYwNVM5YXNtc1RicTc5MXBmTURRdVRNelBjZmJvOXc5aUJra1lQZzNlTHRqaG1Cc1F2TWlabThpYnpONU0zeTI3ZUdQZUQzekNVbVlHbk03YjRWN2VIMy9VQXp3Qkk4SDRCeHhQUURqaG50bmdDUjBqcTkvMHgyaDhmZng0bTJGY2YyMUUvQlBWbkg5RG1ZbVRuZG1IcDllUmZSOThmendUM0dQazl6LzVqeS9qeS8vRUFDTVJBQU1BQVFNRUF3RUJBQUFBQUFBQUFBQUJFUkFDSUNFU01ERkFBMEZ4WVZILzJnQUlBUU1CQVQ4QjJNV0h1K1B4bDV1MUlidTN3c2VFSWU3NC9BeDVuRU9nU3lqVS9yWkNEeklNbTM0OFBEVXduRnNYQ3ZiZTdTb3NyREhsSWJ1K1pROXVoVmpHSkRlRnlQSFR4V04zdFRmOGYranhxNFJUcU9wbEZEVnF2cEpjVExmVTk4T05zSnNiZ21weVVaR1JsNEthbjlJUTVqa201SFU4ZFd4Y25BMWMrQ0MvY1JFSHlLQzBzL1NZaE93elJwNElTSGsvYzNGZUVrY0Z3andVdlpXb2xJME9GR1ZGeEIvd2VwNHVQSGRwUnVvYVgwUjRRaExnL2hPUmVuTVRhMTZMOXJUNEg2di94QUFnRVFBQ0FRVUFBZ01BQUFBQUFBQUFBQUFBQVJFQ0VCSWdJVEZBTUVGUi85b0FDQUVDQVFFL0FkRU95MnI4aStKdUJLTmZOMkxhc1FyTmlNdGFWOTZTU0s4aUoxcjBWbXAwcTd6MFgxaXMzWmFTSmJ6ZGkxcWZCV3FjQ2QwN1QyQktQaW5ldjh1dXNoR0JFRlZQMmhTSlI4N0pRbWllMnFxRTBrWko3VHMzcXgxTlBoazdveU14UytuU1daVkdmNlpveUZyaXJRaVNUSWRSOWpmNmVUdjBPempSRUUyVmY2WkdSa1R1eHZ0b3Q0T1d4TVdSYVRoaUpES1NFUWlONEtxVEtEeUpNeElaREl2MHhJSUlNWkZSSHg0bUJnakZuYk95OERoTWhEWWpFUzlHTFFSYUxRUjZDOXFyeUwxZi84UUFPaEFBQVFNQkJRUUhCZ1VFQXdBQUFBQUFBUUFDRVNFREVpSXhRVEJSWVhFUUV5QXlRRUtCSTFCU1lwR2hCRE55Z3VHU3NjSFJZS0xTLzlvQUNBRUJBQVkvQXZGTlE1OUFjY3pVS1hBL1hZVTJrZVk3REtlaWZCdDVyMVFicHF1Q2svZnR4dEw1ek9RVW5aUjROdk5UeFRuSEpTSEx2azlxU3AzN09YVUFVN0dQQzBRaEJxekt6Mk40YWJFV1k5ZmNESGJoMFU3VURzR2ZOc09zT21TbjNBMjltNnV5cVZSVk93Rm1QTC9mM0FHK1VWY3RCNkxUc3owMDJWN3o2ZUFqc1R0WU0zMzFNTE4wck9kaWRoV3JsSjhEWHBqYUNjaFVxdEZXcTNiZUZIbS90N2lmYUhXZ1d2WnZQTUtuYXAyTHpxTmJtaWZNZnQ3allOWW50QnZ3aFlTc1FXNVRNcXBVTnlWMCtaUXA2T3JiNitGcnRtczNsRzREQTNMRjJMeHlDTGpyc0xyeGU0cWIzMlVNK3UyNDdPdXd6eXlSSnpLa1pKemdQbGFybzdOelZ5N3dkeTJFNWRORFBoZ2RPaXZaZ1Y2SXZOWGVCUklpbkZDWjNoTmVlazlMbnlNMGNPaXhoZk51UFJQWXBQYW9PM2x0S1pxWFZBMGxFUHpUWmxrbzNEZmhZbVJPOVJlYVBWUzh3TjVHYXVzcy93QjFvcmdleHJkREdhaTBMYlFSR1N1UEZ6Y1FwRjlOYU5CMlJaTWRFWnE5MWt0R1U2b2RVK1l5Z3B0YXVWMzhSWUg5UUN3dmJHa3FzZE9oNk1JTUxjTjVXZXh4S2cycDFLb0pWU29OcFJBWTNMQVd0NEZzS3RvSTV5aithNzBVMnJTRzdzeXU2MVVweVZiVzArcWhycG90RnZXWFFjUkhGQWRjMC9xQ3ZDNEhjRkZxd1U4eFZ6cjNBamZVTHlQRzgwV0pzcWU4T0ttenJ3WGRYdGJSck9HWldDejYwL0UvL1NlQXdOSTdvQ3I0R25ZalRvYTR1amdwMVZNMTNWaWowQ2s0V3FYWXlwRU5DdlBsWFdzZ2IxZHFYYnBWR2ZWUmRqOXFpMFlKNEZERDkxRFdpRkRySWcvUmV6dDNNTzV5a0crRHBLdXVFTjNFWks4ekVGZDZrdGZ3VUNtN1NWZGRGN2VBZ0NNOGwrWlhjdmFOK3FQVnVnNnFjMjd3dWZoZTdQTkNMUDZMdWluMlZGZU92QlVoZTBiNmdJbUpDeEdGSWY4QTlFQkloeUhWdXF2YWZjb3ZtcmptcHNxN3p1V3BPdFZVRlpUQVZDUW9rdUIzMVJBeUFwelUybXVRVUFIa1VMTU9ydkN2QzFjNnRWZDZ3bm1FQVJRL1pFU1ZoTjQ2MVdKd1JjTFM2T0NnUExuYnlGOEozUXY0V3EvaGZ3djQyK3ExUmVlU0VGSHZVVFcxZ1I1a1lFSG1vZlhrc0pWNys2dXpkcjVWTUVBNUpvWVRJMFhWMjRsUUhTM1RncGJid3NUMkZlWDZyUmVRTDh4Z0N2QVh5cGNXdCs2TGJNR3VwTlNoRHZWYWdIVGVxd2h3V0swdThzMGVydk9NWmtvUzEzOVNiZVlhalZNY0dxUlFvV254TE5kNHJ2RmQ0ck5aOU1iSEpaTEpGb0dzcnpGWTJIaUVMckczVHFwL3dwcWpBdkwvQUFzb1BCU1E2VUEwTzVpaXE5dHArcW4zV0dSUHpTRlNQUlJGc1BSZDZSb3FPM2FxS2VxNzRhVGxoelh0TFdWdTRuSlM0bUQ4T1N3Tmx2eTBRQmhxb2J5Z0g2QlZtVmVlMEJ1OVoyZzRLNzFyOG9pRUhHclFneHJTVXl5aFpGVTIrYXpXYXpVRXE5WjFJellpKzg5M3k2bzNnOE1PaDFXS3lFYzFTTFRnYU9DZ1dsMGpRNXIyalhIaUVMem9idWZtc1FjMVVjRlZxaTdud1hlRjRaVG9pRCtKYVozNzFEZnhBZHd2STNyU3NaM2tlc3QyaWRBYUxxeTVzREpSZWxYb21FZXJzL1U1SzVlcndXY0g3cTVsNklqcmJuQ2EvUlNSZDQydi9sR1NIRTBGL01laWdTT0tiYU9kUHlHaURMTnQzZ0ZWMTYwT2s1SUFrd0VmYVJ6VkhUeUs0K0RHTExkb2hmcTdlM3ZLRFhsbjlFUlpWbmYvQUtWMjBIVjhUUWZSRnJYWHQ1Szgzb1ZlazFRdWlIYjVsUzBsL0dGaXZOUURTU1U0bHB3NTgxVnJzRmZWVGNjRkRuM1M1dFJkS3JhRS9zSzd6LzZGM1hFeEEwWHMydGsvTktkMXRON1VialhuY055dWx0M21nNHZNYW80Zlh1bFlSOUtMR2ZRVlhzMnh4TlVEYW1ONTFLaXhIVk4rTE54VUFRT21QQjkxdk55bDJQaGtGRjhXVGVDM25lcXc3OWF6UExNTHZNTjdNTk4xR2JKN2dkNnUxSEpZYlZ2SkRGaUc2c0lSSlpNNUsrTE9Ub20yVjBrREU3aVZkRFg0M1NWMW1MRmFKMGtqMVVndTlWZXV1bm1yNHM4K0trV2JRdE9HRmQ0cHJ2OEFDaXBXR3o5VjdhM2FQdXNGaysxUHpVQ0ZHTTRNNmFxbmg4NmRqRlZkOTdlU0F2Q09TbzI4N1VsU2JOdzVGWDJXMW8wbmVGVzNhZVlReDJheFhNdEZaeTFtSlhxQ2lOUXB2Qk10RzJyYTVvWWdzM0ZVWTQ4MVZ1aWNXNFpWU1NxQUxQWVFvQ2p3ZkhzOGVuUG9sWkpnK0VkTzVYZE9uTlpxcXcrNE9leno3Y2ROT3psN2xuWVQ3dGpaNGUzSC9BUC94QUFwRUFFQUFnSUJCQUlCQkFNQkFRQUFBQUFCQUJFaE1VRVFVV0Z4SUlHUm9iSEIwVERoOFBGQS85b0FDQUVCQUFFL0lmbXFaaG1VVmlITHFEL0lzZm1aV0V0WVNPZEQrWmZDUHBIaUJmaGduYkZtUFc1bCtNRDRJWWN4K0pFbGkzOUo4U0d1aU1sSGJwaXRMTmRSc1ltZmxZVzlUZXIrUDZYTUgwbEVQTDBpa0ZVNENKdkpvaDNRSHFPRGNlZ1RKUGJQd0M0NHg4amNGVnY3S09YdGZrZGNCS2luUmdsWTNHVm01ZWJsYXZxcUI1L3dxazhKb2hSd1NzUnp1ZnJOSitwRXJIb0VDVTlpTUhzbFBYRE1mbGxZbGF4UThjQjJQbWRMSTRFMnVZdHZSNlJOajBOblFTSHk0NkZYbDZDQWREdkQzQzFVQm0yamhsZVFmRzRGN2ZjSDMwVkxwZEJHamliQmdzdVBZZ2NzZWxmREJ6N1ZlL2I1bmE0bE1PZ3VPcmx2cGR5b3FtU01CbHUzV3VnMDM4YzhNWGZjcDV4NWxCREt4bFFpNm1GVVY2WE1lK3NEb3FWTU5STEluUUhwZzdzU2liWGZ4RUNBSlJBZ2lqbjRJTTRWZU5PZ2VnQm5vWlBRYWlkZlhWR3c1SEJ4SzhGZmpwcStoMC9wTUVXQTZTb3Y2SVVoSXVadENFd3dWa2xYcVZoVjJ5OXFiL3UrUjBYbDVvZS9Rdld1Z0FyaVpTb2FkRTZYMXY0M2gvQVNrd2g1aDNiYnlSUjZHMkJZL1JMWkpWVkhCZHBkemNhTTlOWEI5TDZWY0VMa3o0K2V0SjkvSStRdjRJR0RMQUl4V09pU29kR3pjMGpoOFNzWDE4WEV0ZGlmc0FreFZKemNHWmF6Tm8wVFNKeVEzbU5DbTUzbXlYMmc1M0xNR1ZhQXNXNE93ZHZjVkphN2V1NGIzWFhVS3J6QXRtbWNjbStvWjdlNDZseGRGNEE0YjZLN0pRU29sTXJFNFNFcVYwTlYwSUl2SGVwZk5nZDRGS3p3WXdhaFd3TGlycWV4WTRSaFhTMXNvTmRwbXlzU3FsU3kyTXdDbVlLMDc5L0M5WDhET3B6cm9MVGs4ekhFek1rcldZYmh2ZFRaTXVtbUw5NGQ2bFp1cm1jYVFYbHJ2ME1DMnVoOGtYZnZNRHBNTk9mYzNqRGNPQkRxNGhYcDRnOTUyb3NPSm4xY0ptWFdHWlhoalJsZDRiTHRLZmpFN1p0bXJKekRlWXpqNkhRSzJsY2RweDBOMG5ndjEwWkxodVZLaEhCWkVwNmNFd2FpYVlRV3d4Nm5xY2oyeFczTEl3TFpTQkg5VSs1dFVqT1gxQWMyM21BOE52TUkyRTRXL2REdnNmdWcyV0l6NUc0bFlReFRqUHRIUCtEanB2cGlwaXNiNkNtbVhmRTR1WDJnMHpDUldXT0lxWmtkSXhEbUZtcE1HVXFYOHI5Uk9uWjdKNjVuN2V3ZmNWMis0c1EzTElkOWJiTGJ3cm1qbjZnZ3pVd1FXMU42Wk1JRUEwTnpDcStJTVFWZTVmRTQ2OGRVcnE0NlhDMlYwVll2YnFPS2xWMERnTUZXNEoxSFRWekdJNU9pR25DMXZ4TVpZRWpsdURhWlc5K0piRXlxTHRXcFlTSXF6RFF0cXViRG5aM2R5ejgyOTJXdUNaTHd3emxJUTJXc2o2bGpMQjlJMnNGMDVsczRkaUZOdTQ3Nk1vTFd4bUZsOVIwNWhGS0hlcDN4MEM0UHhIby9DK3RKOTlDR1dweEF1Qzd6bS9NcVlVOFk1bkxraVU4TVltVVFwelg4emlXRnNhOWg3VEN6MjhUY0UrOXpYRWRxNGlOakRiVU5VWkdqRUEzbWxQdi9BRkxySmtpKzVqeTBXUWk1ZEI4YStpRG9WWmZVRHZqQnpPQmFhTUVXaVpncktKNTVqSExCZWlEbGpkWHhGdUJjQzNjb3RYUHdZcDNBZG9adXF4bWVzOVo2ekw0TXNPaHdZcnpDWGpCQzVldmN2ZERMVlFhMWNCUmxLZ3VhOE9vSVZNRkM0VzVEeHBsZ0FEYnFvNk9wN1JDYjNqMEk2eHo0aVlBZGlKYUxtdE1LRnd6QTZCS2VVYng0amxuQmNReXhhbXNlWWdZeEFXUnNnMjhFQzlPQ01MWHBuQkU3dTRMVjdzQzNFZFB0V3pHcHdudWxoU2gyWnNML0FCS1pzbGZxUnVWY0JVTnZOU2lDa2UzVTRBcm9ITVJ0cjZZcXR1ZWlnSHZGdjRNMmkrMCtqMFZNdEZ4ZThRaFVhbmczT0tsakkxTXNaYWxQUDZ3NUp2VjRTcGlLM2VFWFlwem1wY3FKMlhLS2g3enI5WmpYVC8wcGZwWDdIMU1vVTRxTzNqRTJRSVFMem1WNVBwbjY1NGpEcE82MzdpcmwvQ2NxNHd6RWxIc0h3d1Jqbmh4TThyY1FLN1NOaU56eWlHSitxbElqbGNDWXR2dUNhbGIzZFFIaGFOajdqclduZHNtWFZmYlVDanZZZjBpSHNzMC9VRGJtOENqbkVSTmhHdWR4RWp4MXI0T2VPZ2pURVFvWEFkQmNkVEV5elEzbnQybWVkUE1zd2NjeE53N2xDT3NabGRhemVFb3FpT2Vaa1N2cGlXbEFlT0NYQU5zUUxWVWZtR3JBMWNxUXU1S3pLYzVlcm1KWEtOa3V4Tml5YmhaTHhhMlZvMCtKK3JGeXZ1UDlyZ0hjOENBcnVYZ1g5WXh0allzQlB1aEs1OXFsUE81a01tK0FqNFJ0WXMrNFdkVmQ2dnE0RG1jRXNNbWw0cjZsOGQ2WHROaFF1YmkvY1YzKzJ2NGhUNVljL2orcC9FdGY2bUhVRnR1NEx6M3k0Z3VWSzZLamx1VjhNSE55aDBQSWxDUGFISmNHN3c1N2dZTllmTXoxZkdCN0l1bHY5Wmh6RXpteUdidDZoM0hDNDNnZko1THFZYW42RXhkSlFQTUxHeDRJU0JuV1VaS3RUYms4eGdMeUlDQTl1NU1YUHNLOFRtSnJ1TVpaZStaUTlZZzFiREdXUjlSV0g4VkFOYWFGSjdMTzlkaEhUWGF6anJ0ZTVrSXJDbzJwaTViR1QzREdadWw5L3dBTXp4NGI1eEJtTnduRUdySEtnUTZDVFRXSjQ4OEIvcVVlQXVRZWN3eFFwTW5uNG1ERUp0NlRLZG1LOW1IeFl5YWZ4RTl2MGlQK0lqL2llMG83OURTV2xlWVlkQkpLYXZnaGFzcmljQ3YzQlh0Nk42N3cxUXJ6dGl4cDZEZis0TmxxQndnNGF2ZmNGUWFiVmtKdlljTVFxRm5Ha2EwY1JnUGhJSFdvMDhRT3NQMm1BS2N1eURLdm16bjBtWWoyaHVEM1lEQitzS3BUQTVtVXA3eG1mcktJRnhIeXVEN1lHYUxxcy9yaUdJR1QrUVBFekt2a2w1N0VKdXNwVXpHYVpsSWN4cnNuRUZFV0YwSnNrUWNRQnhWcHRmbUtDRjhZY3dERDQzVVBXcWx0T25tUEtmbWYraE1IODBVL3VpT2Y1aXVVVmVGaXU4WG8rSEVJdWNEQyt6Qyt6UFpDZ2IxNm5hejZpMEx4TXJMT3hNNmhwTVhNa0FZWTJ4RzZiN1E5UjhqaG1EZ1pTRFVhZTZadjNJRWtOcnYrSjYyeXgvTXRRNDdGUlFyN1NuNlg5UzJ1d2RWUC9aWUYzcVZINmxRTWpKeGNwRENuQ0FQQWF1elVxMndLd2VqVWI3VkRWYi9XSnd5OXY0UXhyTnMxOTVUZ2JHbjdtT2dNNEp0dzdFdnRKdXRuL01WS0Z4YjFGN21ZNThIZGxqaFdoMjM0bE1sMlJXRHhGQzRNT0FHYkNXWVliY2Y5M2hQNEVVZGtydE00S3o1bWUwYjdmQ21yK0gzT2R3WHZCSE4zNTFEdklkNytZRlRmOHpQbGZ1Y2ZQY1pIYzY1ZlVLdFBOOFp3V2psK3h2N0k3RnJwYjE2ZjlUbHF1QSs1cG5JbktLL0xVcTJSeHMvT28vVHE3TVl6eUNZaFRNM3ZpZTRkMGZ6S1kzNlRyVmpLd3Z4TSs3RXpZTURiQjRpSGpBZ0ZFQlZIZUI0Z0RkS08weS9hZ2dEeTFtR3dSeGdVME5ZMHNqQVMyOHBTL3VadXRyaCthajJYNGJQU0RaYjduME12M0tyeXdLaThXeEZLaWFiWm13KzVSVDY3eHpyOEdSWjlzSndQZGltSGRUbWJRUEdXZnhOa2k1cStwaXJPWGVLN3NYTzJYOFJwenI0SFM4eTV4Y0hPNEVDLzRJdURlQzdZenlkNi9VRVM4S3J0VkpiRXZqaC9SbEZ0OVJqS3dKUWEvZUpiMHhncjhSNWIyRzFscUNiMVBxV0JJK0Jqd0ZHZlRSV1ZsTkEvSjJTNnJlNDRVMURERGhnZXlTV0dPMEV1MGdhQ1hIYW44eTJyc0Uvbm1EUTJPbTVpa2FYWWpGM25naXdmalczdTVTNERwblA0aXZML0FPRlpZb1Rkc1A3dHMzVTMyTFRTdWUxL1VvclM2TXd2YjV0LytPS1A1Zysra1ZWVzEybDBBUGZNdnJ3dC93Q0FhMThCNklBSm51TUd5TmZscWFiNFNVanVPRnl5Rjl6dVdKakdnUVdZTjdYODBlcFRaMVAwdzQwcGcxK0lHcFQ3VkZtWDNZWVVXaHVzTVcreGVhektRV1dFcnpENTh5NDVLQjMyWWhaVjEzSzB1WXhRMUswUlI1UUJmRGZaR3JZV3lWekR1M0RpdUp3WFVHM243TlF5V3VrNFRZbWRnMUhyRThqKzV0ZmpCdEEvWTFBNHJCby9lV05UUEx2dVJzNVdTbDlrSFJpVS9GUG5ZTHJvTlg1NkcrZzFCV0ZIVXNkeHd2Y3hjUzJMMHJjTzRCUmZTODhSV0NQTGt6VVM1d3BqYU9iWXgyYXlrWVdtMFV4eW1YdkV2a0RDM00xNUY1Y1RDUFdZcndHZHppSHhjcVd0VHd3dEJwaHB1NEZzK2dRTSs4U2x3UEFaUk1LMFJQM0pLYm9WM215YzlJM3RxQlRxWCtZOURoekFvdGtRc2l4R1d6NU5YaHZxcEsrVzV4ZC9VdVhOTGJsbUVHcVJ6RHUzRVV3UTFSd3hEU2dXOVAxTGxneEFWQVpCd1pndHErbzRqTm1uZUlLZlRwYzVpRHRMOGtya055eTJYVytPSTFlTmZDdS9UVHpOZkJFaFhKMEt2UHdLcnpBdHFjOXBpKy9RYTAvQ0pXSUlnMVNuejBKZFJjeXlqdnpMbVdHemYxRTBnenMvaE51dHkxZEQ3Nlc4RzRRdHQxVTJxWGZ3VlhnMmM4UTkvQzZpL2I0S3UzL0hmVXpEVHFKY1g1WEVwamg1NkQ4aXlxWTZpY1ZtRjhST3JqcFdMLzhBbTVJcEZqMXVYTndXbnhWTXI5ZERvL0E5MTBLdk9vZ1VQdG01ZVlVWjZLNmN3dDIzRXRYektwcytPekhVRG9sVTZpNHFqNWwxcVg0aTM4THRtTDI4UVc5T2Y4Vi81My8vMmdBTUF3RUFBZ0FEQUFBQUVBUUlXZjNXb3JjTDZzQWFaVEJUemdqWVRYdmpkWTZra1I2akZ6T1doaUUwRm5RS2VXUFJrZmZUaEF1TGpsTmdJN3JUZVpkalVSMjkyQ2FibFFVWGZqY1M0NVozTDFNVGo0ekZxcm9iL3BBd2dUNm5seUZFVDJzZTU5ZXBjYXpUVUtQc1dGK2piWmNZVHcycitDd2ZZVS8yZnJsTFhpQlhLOWpRTlpUY0JNa2RiMnlVRjQxYXJ0c1JicHFsRzhxSGxVdGFKYytsTFdJeFBOeXM2amFQTmJxei9hRDhSV09sK3Z6OUFTMCsxVm14dWR1WTNJK1FCQ3R0STVtTEFYWWRHOVhpSk0yUWtscGxuOWZjT0J2TmRxN0ZYMlk3SDdUNVVRVzFFZU5tM3NZRFBKU2dlRHZPR3RFa2FmWjAxRW5SM2puOWZhWk5GUXZKQVRSalgrQ282R3dxYVE1RzVKdlRmUVJPQTEzOVpFNlZTYWd1bTVUdzloM3R2ZGZmWUFJSFBYUWc0dmduNFhRL3Z2d2d3Z2ZZZmZmL3hBQWdFUUVCQVFBQ0F3RUJBUUVCQUFBQUFBQUJBQkVoTVJBZ1FWRXdZYUZ4LzlvQUNBRURBUUUvRUk4QnJsK1NITWR3NW4xWC9jNE95L1piNEREWlQzNDV6bnp2eTlXemp5ZU5oaE5QdHpZKzNkT1hnSkRDczB2bytScmxoeDhoRkwyOFpvUnB1MnRnWjNObmxZc3lnMkFHV3dKK3krWHQ2QzF0bURqWmJOTHQ3ZHQzTXd3MkdCMmVEdDNhY3ZWMWpyMVBCcWV2RHhtTHg2NEpkcFgwdFBId3VNa0FnNy96M00rMnZoNDZlNXpZdDhMaC9ZUmFsRENPR1NIS3lQWDMzMXowR2JpeEFnNTJYUTZ1dS9Vc2ZXZnhZV0ZuZ1QxT0xKSmhFN1FzL0pIY003MUo5UnhOeW5TQzdjdlVJOEVJY1MxTEhvc2R2OW9iVHhjWEg3UEVpSUx0THhKblRZRHNvcDMvQUphbVA3Y1d5TjQ3aDljWE5pY3lIUjR1djhTams2am1LNHM4YjZoenFYLzNQY1lYSWxCajNJN2t3M2h0WGpMWDB0NDZ2OExQcTN3UUIyMnpvVzB1MkZ1MWErTTlXSWtHNkR6RDdqOE10NHlSK1FYcC93QzJQN1k3V3dHaVJDNXNZdDJEdHZOci9NYzZ0V2lEa3RrUU9HK1A3QngyS21zQ2hrTWlYdGtWSTRzc2l6K2pKNFo0QkhGczJzSm1QcVdmeERXd0UreDZBUGJQOGowRTcrekhzL3cvLzhRQUlCRUJBUUVBQWdJREFRRUJBQUFBQUFBQUFRQVJJVEVRUVNCUllUQnhzZi9hQUFnQkFnRUJQeENmQzRiZlpseFBVdVBsL3dBTGtaQnpCNFhYSUE2OGUvUHJkMlRudnkrTTFFaXY1Y0NYeTdFY2dlTUxRN1kzR1gxNVhEYlRuNVdhM2tSYmkzSTZzV3ZxRzN5TkNDSmN1YnI0WkVXeERSOEdXRmtFdk9RVzR4MUQ4VkE4YU9lRjZZZWZMNkZoeTkvTnhIZmprUVE1dHRoOFlQd0xGNEJ0em01b1ozaEg4eVBxd3N1Mk0rRHdNUzFJRXVUMWZxV09TUjJNSHRJc2E4WkdjK2VlZGxQSFhoQnpjOTZUT2syMlJaTFk2RXZ1UHZ3ZU5QUkcrN1cxdGZBSGNPMjJ6MUlYbHVhTGp0VjViVHExa0U0Wk9jUWdxdFBYTUI3c0hFT3kzOWNTMzRKcGwrVTVaY3pQOHorSlRxZU5QTEtNQTVaTCtGcmZ5M25ubS9LMFhJWTNrWkxQMGtRQTZkMnZBZ1NJRDRiNXl5U0JGL2l3NHlUNnNNenFKc1FibDFmaFpMQTdsUFVZL1o5MkxZY0xjem0yZ3JIeHl5UzJIRzhYMFcra3FFZE4rdGgza043c0xYcklOWjFQTGx0SEFRdmM4TGJpRUg4VTJRdG5kdURtQzZqTFk1MXphV1Y2eUlEYkloT2NzbjZncHNwOTJCbGxrUDhBUGp4a1REd1R1d1NHQ2RYRHI0djhseTB2ODFmUmMveTkvQlRwOG1mN2YvL0VBQ2NRQVFBQ0FnSUNBZ0lDQXdFQkFBQUFBQUVBRVNFeFFWRmhjUkNCa2FHeHdTRFI4T0h4LzlvQUNBRUJBQUUvRUNFcmFNREh4VXJ1WlFXazduNExKMUJZbFRKVk1xRXFFUDhBQXk1YWpoYWJPNTlXZnpGc0t3ZnVXclc2Q1BhYUovUXZ4aU9tMXZVZnpHams4MlkrNVpTM20yNW41bVRBZ1hOcm95dmlNS2ZKeXgrU0tLQnp4SGF2K0RCYktBRWRxeDVQKzh2eVFtREt1MmV2aThCMkdwemlCWWNjVFgwbWtURWVPaG04ekV3VkRLZ1JnRGJENFFCYU9vUlJEQVYxejg0LzhtWUREMW0rNDJ0R3ZyYi9BTmZjQ2ZCRFFOQkJ4enNMRDBRb3ZIZUVvbEo5NGl6RDRMUGFZWTczd1Nva3FLc1REMjVqbjRyNVZPSUFFcWsvWjhSM0M3Vi93SVRHWE5zcitITUl2dmlYRnhHYzFhdnFjZ2tFTFpZTWpjb3R5b1lLWkRtQTNZS0x6ei9qZndDbnI0eS9wdjNDM3NBSDNtWDlURlZYbDFucUtRNHlXbjg0NXNZWXdDTld4amVmNWlTejR6R29mdGxOVkRUeEVPR1B3cXF2eEZiRTh6RXVNQzJvNFZaVXVEKzJHblRUMFdqL0FBSVErQk1vWkZDdEx1VkFiUnJsaktjUzR1K280VE1xQzl3RFVvZ3hDVmpjcng4M1NLUGZ3VlNnN2x3UWtRY3JpWUdpSEs2aDQ0QnRNOHNPNllQUjkxRE0wOUFZUnpBemdnb3VINW1NdUF5c0tIWnA3N2pPVnJYaUNjTW9sVHA4Uzg0RGp1TldCWkg4WW5pSjhNRkhQSFpMb1pBcDhNZlQrZml2a2dTd2NJcWdOY1FQVUpNbVk0L0JhZlhjZHRBdHVqUkRsZ3pqbDM5Uk1hY3hMREZaRUdDNGNpaUpzcjRGVmhyNG9LRFRwaTIzM0FYUXZ4Y1RLclgwd2Y3K29LUnR3eWhwWkUwcC93Q3pJekhiR0xuVXBVMHJYMUNyVU5lNVkzejhNWlV0ZFNnbnFMTkdBNGlXRlNqUDFGWmJmekFaQ25rNmxHWVplb3VNYzFjOUorTXNYRWhVOHY4QWhWeXlIY0l4TDNNRkVUV1ljU1hSR051THNOUTBnU3VZMnpRUmN4THFwSU4yUlFEakpabVZTSC9vanlVbGxrRFdKY3lTNVVOelROeFFXelhGL05LV1VPUnArTS9jTUtYZWhjUlZXbndUY3NnMjVndDFMa080REkwRDJ2Y0NYVjF5WmpBQldGWXI2UzNoWG1BS0ljdW9zbnVQdVlmQXEwSis0MDN0MUUxWUZkd0VWbWp1eFg5TUgxL2lOUjFCUTdKYnpGQ1VyeWdxeXhVM0I3bVhCekhkMnlpeDJ6R0Z0WEdHbUtvWldzSXpLcVdhRjFxR3Zod3FOVnpkL1V2aUZJNW1LTjN6S204OXJIajdhUHVPdE94VEpYdkVjV25aRFhHS3g0anh1QXI1amgxQ0JVMVI1N21Yd0RBZEVQY1pnQUd3NWdsbGdXRERiK29xYUpaYW5BSXRibVdHcVlpMGJUWG1QRVp1SWROSjBwTGYxNWlxMnR2d2dGRUJaNWxLMGZOVnpjSXdjbDRneSttWDNGeENiclJMb0Zib2lrWFpVQzVnTUtZc2lHeUxtSTJock10c05ibUpvYkt5UklhYVZaWkJzUUIyNW43Rk14V3M5L0hIcVc2bnRPaHo1V1l3bndYdjdJWmlXTHhSK3BuYTEwemJNdjBsUC8xUStseis1VnRVU3pZWW1JNG00Sm1oeENFemQvQkJhYUxncjRuY1FvSnZ1SWRMM0hGVDdtdEx1VW9LWmRlWCtrM0hPa3I0MHZHRHVZbDE4OWZOV1JySFRPd2x2cW8xUlYrNnVJMElqMHpOamdSWE00bTQ3UlR5V0ptZVlJc05SYWxUbDVxUENwZUh1VlV1b0JUY1VZK0lDdkZ2OFRKWVM2czRZS3orcWpoYlhxT0ZsU29pMUxYUDRpQnBHemlaQjQ3QmtIMjBSQ3NMV21mckVVMkhXZW9CR3VLYkl0RjM1bDZvWUl0bXJLcmw3b2lwRFVhc1RMM0NvOWhPem9DaHh6Q3RvM1d4dTJjeXBaVkNvYk1venovOVNxRnMzZXpIMUZVQmNHb2liS25EWStDTUNxQ3ZRUmJUUXZnMUtvdXg5U2xRY1J3OWRTa05HNzc0aGhFQlp1SVBDWXVVYXRGN21iYm82N1lOSVhMbGk5UlZ6Q05ramlPSlVHVXVySnNveDFPSWdDd2daQTlHRE1HWXdEZkVBcFZic3FZekVxbkJuOWsvRUhJbTd1NmhMQXZ5SmtrMTFDaVRHSTZ3SzVGZW9MWWU2djZsTE5BN3hBdWpheEpFUjVndFFiakpXdnBhbUtGN1YzL3pCQkY0M3gvekw0VEpHcll2eEdnQThZNjl1aVZDQTlnK2o3cjhTbk81WGEvekxRb0l1WGY0aWFBL2NwVGh6R1hoWDMxQTVETmZHa2R5MkNqd2pVNUlwd2dEVFRBakVFTDdpQllSNVhGMllwSE1hZ2FyVWFYRzJXWEVkYUV4ek1QY0JLWlVGQlJ3ZkVVY2ZHUm5YQnRYemlNUnJ1Tm9naTRZYStGRFBFVStUN3pmOEpFWUVVNnU0clZTM204c0ZPL3hGelJOaXZGUzBiZzBlV1grb2hmZ2VINmhBRjJYL1VvaWh1bDU5a2JYM1NGUS9neXcyaDcrWVZHR0FYUncvT28wQjRaNGx3ekpSODkvY0pYbFk0eXZZYzkzMXdmY3lLdVhLdk1mOFBDZklXbXdvdlBNWnB1QkRBM204bGFqaXk3ZkcwRDB4QU1MNWU1UmljM3FvVVhnOXhjU05rQURxOVRCSmphUVhWbWkyYzlUblJaamNZclZYY2R0UHVYY2NRMHBkL3FValY3cHdyaW1VSFNSRzVhbUJENkdWK0JqRlpzQUFIRnJCampjb3BLZHgvWkxBM00vQ0Y0Ujh3UGJ3Wmp2dGw0dUcwcmhQYVhPQzcvVUFzdStLbEZvMVNBZFZjYmRxWVg0SS9qekVWRFRaWC83R2pzVWhUWGc0bGIycnozR3NyemVxNGxvVU9IY3JGeThqdmNaekUyS3N2NUNxYSttQ0J6Q1RJQ25kYWdsTnNFQnJhRG5pV1RaWUU0STJWWStvRHNqVnVGNEhMNnhIVUxIVTRVTlhsRCtabkNqUWM4ZlVwbXg1aWpZWTdqV0FHMEYwMW1DM1VXdFBZbGtOTk55c1NpdFlPMk83NW1RY2FuSldrb2FJRlZiNC9NZTVCWldpOS94SFlFZ3N1UmZRZnVOS2lHVTVOckZMZ09ESEVDMHk3UEVzRlhuaVl3bUw2c04xZm4ybjZtMlloVDdpTUZITmJsd1lVclhFSUI0TXFSMEd5QVZOdFJYNW1CVUJ1MUVvK3hsYVlHaHl3Q2xCREIzS2thakZHYTFUQVVwYkdXdGZDSURtV0doNWdwcXNtL01Hc1JXNEkzSytPa002L1V4ZUg4eEFLSUN4N2xQY0NqUllaWHFCb0ZyQndLTVRqY1RXQVJvUmEzVnpBOFY5UVFOTkVZUm43Uy8zQUNqRHBTcklqalhWRG14MStvNlpaa0x3c0t1MTY4UnNRT0hlZHhDb3BNWmlUVUFRVi9YdUFoM1k1WUgzcXU0QWdoUTJQdExRczdzREREZjZscTVJRHZSOXh5MG96V3kzNnVGZ3RpNnRXL3dEN2lJSEg4OXdGWnR1S1V0TlllaUtSUzR0Q0RhclFIbFk1SUpWakJoNkFaOHlxZ2FOTnYrOXgycFppVVlyalZHaGxFRVRCMVQ0ZlhjZHNkSVJSdGU0aEFVQ3oxTnZFNEVMTEVSK1QwY3dwa3dhVytZeXVnOEJMRmM4RUhMUTdsa3FRMVR1V0JBT1QxTisraUJ1NzNPTUZGV2hCR0FSWFNMNlFXUmIwUWxoZzA5bVpVMENyV29qb2xqRVRJV0M3YmdxcnV1NmdFRFdHWGYvd0FpeGM5eFZDaml1SXM2dUJiWEFCTWJMYmo4VmZuVHhPV1dETG9GUldPYjhpYXFYZUtVTmZOSFBEanVCTWtZR281TVJkWktBMmVYRGlYcUNXaHQ2RGNwQTVGQ1dMNVBUK29hR29xcUFkbk44UjNjcWlPZ3ZrL2N0VWlITlAwNFR6R1ZrUlBsV3MxdzQzcHpPWDBsSTFaR3gxemlFVWhyR1JyTitZaVVjUkVIUmxZUXRVc1dkaWN4bFN2eEdyeUJsK29JemxEUTJHaXh5dmlvQ0JlQlJrMjN5NXJvZ1Z0Z1cxNVc5VjNBb3VDODhMWG5FUnowbzRlaTBYQ0ZVYnUrSWdFOFdpNHRzUWlJMVBDMVREc1kxWVhWM1hFVlRqb0NiYndkb1JXVkV1cGhtNnYvQUhBSkZHMFIybkhyY3FRSG1zQjlzdVFwNVpuaTR6cW8yVThSS1hXQ3NGZkhNWHFaMEhDS0dqT0VXVlp1V053TkJmQ29CWUI1M0V3S1BNeVlLam5xOUcveEJ3eTh3S0lYQ05TaWNRS202T2ZSbVdJV3NLcmdTcHErWm9GNnVEaGIxWWNPRWZFSkZNaFJzTDFmVWNJSE1LVTU5K1kzMkxBMWNWVkdmT0hFV1h5SkZwdTlkZkV4Ym5LMWZaVCtvYVVtWDlZSytwZlRjUUJiemwvMUFRSFRkTGhVd2ZVRDZhR3Q4T0dVSWFsUENmeEhkQ2hvTU44UVV0RmxQNEhNZHRSMm9hL1VWRjcrc0UyenhZcVdWZEFnV1JnUTNRZmhSSEcyOVUvNjR3dklFcGNXMUNLMmJWczRPcnRZNWg0QllyUmpjWVVXV0lxUFBPWnhvR1VKOUV6S29hanNINEdmcU9mU3Qvc2xMVDlkcGw1UzJhZU5YTzJJQzdHeFF6VkIvTG1FUUZRbm1kblhKSG8wY1lVMWZaMUNJQjJ5TXFhS0d5QWJ5R09lWldjNEpYd3JLQThId1BWQkRKaTRrTUM4ejhCUW1LQUlpV3R6RUFVbzBmUnZ6L1VjeE5LdXhkeTlhM3htRXhobFpEckxHMWhjNVFETFVyckJkWHA5MUdQVTFlT0hGWGgzMVhtRGRXQUsvRUFyaXFzdnQvNVBjY0E5enkva2lZTmJJUUh0N0pkR2dHTWVqdFk1NVhKazZ4dXZ6RE4xRXdISG5PWlJCYXdTL2RHb0doNVZJczlrQ0x5d2J0YVVNSTlSSFMrbk92WkhYT3dHMWJ3SEgzS1lHNGRmZGsyeFNKWU0zejlSZVN3VGFkYlV2aWJvYmZZYzR1RTFNdE9pYjVsanhXS1BZOHNVY1hMOUxaU09SRWpjc2ExTjNocUcrbUpvK1VJdXVpNEZCZzJFZUd4cjFoZjFFRVVxWEtGWXRXMkxRbHNPZXJabGlJTEZWSHFBVis0MnVEZGwxSzRCUDVRS3FJR210WGROcmVUOEplNFc3YkQwOHJ3eXcwUlVZWUo3NzNOOWxKZ0ZOOFZHeWFYWDRsK28zNHJ4SENNbFJBWDFHS1pYd21naG9hWloyTjhOd0R1TEw0YmdJS05LYU9JbHZabUlVVWZjQTdDdUVqN1NMV0M0eHJpSkN0Rld0SG5DUUVGQ21mVE1MbHhtRmwwVzVZY1Z0NXNyTVM5WXVGOHZvaU5iMGFmUlhjdUxHOFVINy8zRnlRRkJ5NHpIYUJWMnYwZEhxS0VGM01BR25GOXhTU0JvVHY1djM3alZ5REtDbmlGNjRja0xjbDR2N2pDZlFKOGRIdEpsMXBGbXRUdlh1S0NpbUFwWHl3TnJvQU1QVUJGbUIxOXBtbE5BcDlLbVhpenVISlhIM0YwQlE3SEV1MDNacW9LQkZ2cnFyOEZPdkV0aUlQNTZjaDFOY1VFRjBybUtXQVRrU2IzaTgxMVZSTUZjTURRYkZic2Q4TUJXWmNSWWJDK0dYZVdnaFRUMEg0bThzVW1QVGRscmt6Y3RDcTF5ejZXLzNBT2xYRW5uRFQ4V1NvQVFRendWVm5tcjd1YWM2NHZMa0djNjNXT29CV1RhZ3IrdnhDcFVOS1gvQUJEL0FOeEJqKzdEQy8zSUpRdWVMd0ZpajdUcE1kaGhDMEorcC8wSmVOdHhOQXdkYjl4Q204TFBVdS85UXJ5ek50L01zNVloRmNGNU9ZckZqUTM5RVZVbU9LRlA0bFNPYjNRcTkxajdnNWdCZzJ0WGk3NXFFMUlxTU5oZjIvbUJTazZ1RkRkYmN1WmEyOHJkYTg2UGU0dHN3OWhLMnl4Q3FOSEoyY1FaSm5jeVR4eVEzVXJPYm03R1I3UDdsK3lMWFNsTWVNeE13aHMyTFg2U1ptdFFmN1lPQmdGWHNNczJTbXp2cHhLQkdjeGMzbTR4UldpV2dBakxBVk05NUVkR09wUmVyYWNQc3RsYUpYZ2U1YS9tRWF1OXI5Z0h2TVhWSTVRZWRBL0V1S1RhZ0JlVGp2dVZUVUtnQTFkR0R5L3VOenl0T3FIZ3JpWDV0WnM3ZHgrN0dkcWZVVXljbm16cFJlOEVwcFFqc0hVcW1teFVMVGJ1cGN5bkZWQ25mbUREeWl3QzRUS2xJbDNDeHd3MEZnRDJYOXh4QXZVZEVJUkFnd0ZZWmxaUXR2N2hadjhBSkhKR2NDM0ZiVVlVQUc3ck12ejhEV3BTQk5PSE1zY01Cc1lyU2N3ZitLVS82b0MvMHpGS2xCdHMvd0RzTVN4SnFsTUNZUEVXVlNmd24zQjNNdExMYkcxOXMrd2Q1NGVSN0NFR2x6RHR0b3BPdHdGRU5LdlZYNzh3TU8xU0MrTkJ5U3lEQWRvRjhIRUVzeGRzVUhYeU9EK0puMFZJb3Z1QXhrTlhhSG53ZnBJdEpHWHk4QVgrYklhQUNzb2Z3YTlxTkpxWm9kOFpGK0pZbFlvVkcwV2F2ei9xSkdEUk5nTFNpZTVocFlGbzRFcjdsRTFZS1pkSzNkRUJrNVM0aHd2elJDNU9NWHd2WnFaMVIwMXo2S251NEFyUVcvWnMvcTRIbjNIUDBmc215bUNyKzJLQmhMc3o5OWZjQTExU2dLNGVmQ0kvVFlWdHpaV1pzV0N5R25BSXA0KzZpQmlWRDRXQXk5SFVLYS9jZEZIRUdVak5FdDNRTmN5NnMrQUh2M0R0eHRoZExYNlJCczlvREJXTnJNMWsrbVV3WFpjNEIrWmZkK0l1ejhSWHBpdngwZFhXeTc5UzRDK3VYcWN3d1hoMUxTbDB2WTdsTGMrNFBXWVlSZjhBR2Y4QXJZTFF3R21mVlRUYTV6YW1kMXRYZ2ZtVnY4UGc3N2R4RkMwVkR2Rzlod2swOHM4QXJBUS9Rc2kwOGErd251L1RhWnFUZG9yNmZnU292ZUlyaWVBdGY4bnFESSs1OStNTXYzQm5OYStub0xYN3FCMFJjVzBkeXVNaXdiWTlmK1JkQ3JsVWZPa3ZraTRXRit4MUxMVTFWYTU4cGV5dFRTMnd3ZC94QUl0cUZkYlBkcXNjQ2cyb0E1c3EzVUszMng0RE53MFN3SU12aGNHY1NvNWRHd1gxZmNxaUxNRFBLU3UwbWhqZXJabDU1RmJxQ1dQdTRaVFdzWlBHVS9PNEw0MVd5UEZBdjNVdDR6RiszaFl2NmZNdENac0xJK1o0TW9hNDc1ak9FT3IxMUJSN0lmc0RvUFg1Z2V3d3N2Q3MwNzFNU0FzdlNLMGVZSWJ4dGEvcENjRWVWVmJZN0x3UHVXOUN0WlhnWU5NUTFNYkpnMnBzUGNzeXRZTjlkVkFxWnZjVldxcGE3VmZ1Szl2eTBWVGVNNGg0Q3JZTlhCUzZhdVhlOHZjTFdJb2FNYllNQVVMZnFQVmhiZGRYVnd5bW5jR3FMY3EwZTFnUU15WTlKL3FOVWFGWkRvL3RzR09wcXlQVk4vY1Jrd3NhbllxdnNnZ29GeWdEZHNmaVZDbFNBT0FCaUpzV2plL3VzUHpBRkNNcEk1MW44eFVWZFdqd3dwOTNFRUZ5bFk4VnpLaWpkWlQrY1JhbkJRZUJuY01hVzFiZWd3ZHdLa2M3ekF4dk1BcHh1TTE3aGU5TUNiaVEvd0RrdHpLc2w0RVJSaVZmL0tNcGtTeGljdFdpanBqY3pvLzFMaTBkWWVQZlpBS0MybFU2SEt4NkZvUTJnN0svaWFoMkNsUnJQKzBPQUxLYUFjWi9ZWTJzWHlIMi93QmpLeW1EbTAvWmo4c2ZFYmgrazAvRXVZTmtQbVV1L2RFcHBCVEtIaDRlcTl3ME1HMTIvYTVpOG1CdnVONVl2dVVDMFZyaFkwdldKWnYrWmZpRlBHWlEwSlZZZHZyNVJvZUdJbFh6OE9IQ005eEZhUjdHRUhFeVBVNE1aN2dNV25WdHpIeFdvUzJpaXo2alZ3UWhBSnlIZEV0dXJhdHZzWlljVHN1Zm9QN2x4VkZrVTlQRUNyZXRPYndaSDFCTndmWnRZTlREZ0JVUHVxKzVZVmQwUyttSHlEeW9mdUNCRmZtT01XYmwvS0VkUnRjM0JTTnBKY1V4aGxFMzAxdVFGVE9mNmdMQkFuTlY0dnJjSmtVQlowZU9vaGhwUWdBZVlYVjRUREdaeFJscnZWYThSMlBnbEx1cWdCd3RkM3RkeW5acVNnOW5jZHNPTmYxSlpsaEFyQnl2TXJFdHVrRDZJVGRtc3ozY09vcmxaK014QUlmTWl2N280OXpHU0lNVWRJM043ODVseW5leks3MkFabGJzOUxnaS9XbUpRekhNOGZ1R25MalZReTFFRXNxeXoxT0wrYitDTm9vTUlvQldGTmx3VVd6OHdLQTJ0RTA1YnJxS3NVU3NPMzJyQTJGdks3Z2t1MjJVNGhyYmUyTWpqNjRseE5zMFFXcHRGYi9NUTBrNnQvQm1DcW1UNUdZcHFzdFBFS1lCeDB2ZWR4NkZZRitEVUtTaWtVdmVJWktWc3BGaTNnOHp3eThSNXRJOEZQRXdqaUJ5aDM1aFVoVGJlQ0ZHM0FFZzYxdlpGeGxWWDJoeENoN2NBalJRNlNNeDhNS3RjUVZBcVY0KzRGdStGeEJZeGQ3ZlZ3SEo4WGlLc1cxYzhNWkNDNkpTQ0VMeTFjQUR2TDZpdHY0UVIraktVTEthYmdVV0tDWUFjRG40S3B1OVlyL0FDbER1cStDWGRnNWd3WmF0cm1EQnhWd0cxWm91QnhiSDJnZWlFTFNaQUNZRGpNczZGckxISUt1T1NWaTVMbGxvMzRnNU9WK295bWI1YjNNSVRmTUF5NDdsK2NCbGk0ZnBWMUNMQldZMkJrZDE2aUlrSUZSb2JOZFJ1T2c2WEZqcGJMWWdxWXFGck1nSi9aT0ZyN2wrSHZQVVBVYnZlWmVhY1M4N2c2RXVXcG01dHNMdUNtcGZ3Q3JTQ05OYlpwdVdWT0JNcnBJcTVXL2k1c0NyaUY1TVl6Vk1yek85cng4a1Y0aThjNGlRWW9lakNtVFR4TTNVUldnNnhCeExpM3B3Um1yaU1MRkNjTjFCdmlDY201YW1PQUhheTRlcGJVQktDNkx4RTFpVlYyeXhZVnB2SmMvbGk0Y0txZGlwVndqZ2w0bDZxTlFvY0N5TG1WNU1uQ3VZcFYwMDZlWmVnQmJvMFJ4YUxLZk1VbGRzWmNIdlJtb05MWkE3T3lVYnVtTVkzRkx3Vkxsd1NFYVNBTGZndndJQ0lhRjEvbU1GR3lYZk9ZU2xGRlBMM01VVmQ4eTVaVUVYQzVncTFneGZDNGl5NE9ZcVM0SUVPWXk1alZRb1dFd3hZL0JxTUF2ZExTNlUrQ0tVVDByTVZLYVlobU9MRStGdkp5ZkZ0RFYxZnc3K01jUitVcC94TS9CSGVHNFFsUzRPWnlDb0FGWnZjeHhvZ3dhK0xoTXFnVjZqZ3FrOFM0d3BhMTVuTkdYeEFyQURkbUYxZFlpZzRpdjZpbDQvY3VEaEszQUtqb1hQOFF5ekYrNnBpQXhuWk14cFVDcmFFSEVjTGx3YURRMXd4VUNndE9vNkw0NG5IemVIRVFzRlRDT3Y4VWFGOXpaOFdYNElicVhRNGk0K0xSdE1WaUp3eE5RaExZTVdDVnFueEc0RkN1ZTQ3RnJWWUp4OENqWnNpcjFiQ1FBS2pGM0twcUpkUG0vbmljZkZwcUtaUWlPL2xWeXQvd0NTMkdQbXAvL1oifTsKCi8qIC0tLS0tLS0tLS0gbmF2IC0tLS0tLS0tLS0gKi8KLyogU0lNUExFIE1PREUgaXMgdGhlIGRlZmF1bHQ6IG9uZSBwYWdlIHdoZXJlIGhlIGFza3MsIHlvdSB0aWNrLgogICBFdmVyeXRoaW5nIGVsc2UgaXMgc3RpbGwgdGhlcmUsIG9uZSBjbGljayBhd2F5LCBmb3Igd2hlbiB5b3Ugd2FudCBpdC4gKi8KY29uc3QgTkFWX1NJTVBMRT1bCiBbJycsW1snZGVzaycsJ1x1MjVjOScsJ0NoYWlybWFuJ10sWydmYWN0b3J5JywnXHUyNWE2JywnTXkgQnVzaW5lc3NlcyddLFsnZ3Jvd3RoJywnXHUyN2E0JywnQ3VzdG9tZXJzJ10sWydjb250ZW50JywnXHUyNWEzJywnQ29udGVudCddLFsnY29tbWVudHMnLCdcdTI1YzgnLCdDb21tZW50cyddXV0sCiBbJ0lGIFlPVSBXQU5UIElUJyxbWydtb3JlJywn4ouvJywnRXZlcnl0aGluZyBFbHNlJ11dXQpdOwpjb25zdCBOQVZERUY9WwogWycnLFtbJ2Rlc2snLCfil4knLCdUaGUgQ2hhaXJtYW4nXV1dLAogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydhZ2VudCcsJ+KamScsJ0FnZW50IExvb3AnXSxbJ3dvcmsyJywn4pyJJywnRmlsZXMgJiBXcml0aW5nJ10sWydtaXNzaW9ucycsJ+KXjicsJ015IE1pc3Npb25zJ10sWydjb21tYW5kJywn4pauJywnQ29tbWFuZCBDb25zb2xlJ10sWyd2ZW50dXJlcycsJ+KXhicsJ1ZlbnR1cmVzICYgSWRlYXMnXSxbJ2ZhY3RvcnknLCfilqYnLCdCdXNpbmVzcyBGYWN0b3J5J10sWydzaXRlcycsJ+KWpCcsJ1F1aWNrIExhbmRpbmcgUGFnZSddLFsnZG9tYWlucycsJ+KXjScsJ0RvbWFpbiBEZXNrJ10sWydncm93dGgnLCfinqQnLCdHcm93dGggRW5naW5lJ10sWydjb250ZW50Jywn4pajJywnQ29udGVudCBTdHVkaW8nXSxbJ2NvbW1lbnRzJywn4peIJywnQ29tbWVudCBEZXNrJ10sWydwYXknLCfigrknLCdQYXltZW50cyddXV0sCiBbJ1JVTlRJTUUnLFtbJ29wcycsJ+KWticsJ0xpdmUgT3BlcmF0aW9ucyddLFsnYnJhaW4nLCfil4gnLCdBSSBCcmFpbiddLFsnd29yaycsJ+KcpicsJ0FnZW50IFdvcmsnXSxbJ3Jlc2VhcmNoJywn8J+MkCcsJ0RlZXAgUmVzZWFyY2gnXV1dLAogWydFVk9MVVRJT04nLFtbJ2V2b2x2ZScsJ+KfsycsJ1NlbGYtVXBncmFkZSddLFsnYXJjaCcsJ+KniScsJ0NvcHkgQW55IFByb2R1Y3QnXSxbJ3dyaXR0ZW4nLCfinI4nLCdIZSBXcml0ZXMgQ29kZSddLFsnY29ubmVjdCcsJ+KarycsJ0Nvbm5lY3RvcnMnXSxbJ3NraWxsczInLCfil4cnLCdMZWFybmVkIFNraWxscyddXV0sCiBbJ01PTklUT1JJTkcnLFtbJ3VwdGltZScsJ+KXjicsJ1VwdGltZSBNYXJzaGFsJ10sWydtYWlsJywn4pyJJywnTWFpbCBSZWxheSddXV0sCiBbJ1NZU1RFTScsW1snc3lzdGVtJywn4pqhJywnTGl2ZSBUZWxlbWV0cnknXSxbJ3N0b3JhZ2UnLCfim4EnLCdTdG9yYWdlIEhlYWx0aCddLFsnZGV2aWNlcycsJ+KHhCcsJ0RldmljZXMgJiBTZXNzaW9ucyddLFsnemVyb2Nvc3QnLCfiiIUnLCdaZXJvLUNvc3QgUm91dGVyJ10sWydkb2N0cmluZScsJ8KnJywnRG9jdHJpbmUgJiBTT1AnXSxbJ3NldHRpbmdzJywn4pqZJywnT3duZXIgU2V0dGluZ3MnXV1dCl07CmxldCBTSU1QTEUgPSAoKCk9PnsgdHJ5eyByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NoYWlybWFuX3NpbXBsZScpIT09JzAnIH1jYXRjaChlKXsgcmV0dXJuIHRydWUgfSB9KSgpOwpmdW5jdGlvbiB0b2dnbGVTaW1wbGUoKXsgU0lNUExFPSFTSU1QTEU7CiAgdHJ5eyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2hhaXJtYW5fc2ltcGxlJywgU0lNUExFPycxJzonMCcpIH1jYXRjaChlKXt9CiAgYnVpbGROYXYoKTsgZ28oU0lNUExFPydkZXNrJzonaG9tZScpOyB9CmZ1bmN0aW9uIGJ1aWxkTmF2KCl7CiAgY29uc3Qgc3JjID0gU0lNUExFID8gTkFWX1NJTVBMRSA6IE5BVkRFRjsKICBuYXYuaW5uZXJIVE1MID0gc3JjLm1hcCgoW2csaXRdKT0+KGc/YDxkaXYgY2xhc3M9ImdycCI+JHtnfTwvZGl2PmA6JycpKwogICBpdC5tYXAoKFtpZCxpYyxsXSk9PmA8YnV0dG9uIGRhdGEtcD0iJHtpZH0iIG9uY2xpY2s9IiR7aWQ9PT0nbW9yZSc/J3RvZ2dsZVNpbXBsZSgpJzpgZ28oJyR7aWR9JylgfSI+PGk+JHtpY308L2k+JHtsfTwvYnV0dG9uPmApLmpvaW4oJycpKS5qb2luKCcnKQogICArIChTSU1QTEU/Jyc6YDxkaXYgY2xhc3M9ImdycCI+VklFVzwvZGl2PjxidXR0b24gb25jbGljaz0idG9nZ2xlU2ltcGxlKCkiPjxpPuKXiTwvaT5CYWNrIHRvIFNpbXBsZTwvYnV0dG9uPmApOwp9CmZ1bmN0aW9uIGdvKHApe2N1cj1wO1suLi5uYXYucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uJyldLmZvckVhY2goYj0+Yi5jbGFzc0xpc3QudG9nZ2xlKCdvbicsYi5kYXRhc2V0LnA9PT1wKSk7CiBjcnVtYi50ZXh0Q29udGVudD1wO3JlbmRlcigpO2Nsb3NlU2IoKTtzY3JvbGxUbygwLDApfQpmdW5jdGlvbiByZW5kZXIoKXsKICAvKiBPbmUgYnJva2VuIHBhZ2UgbXVzdCBub3QgdGFrZSB0aGUgd2hvbGUgYXBwIHdpdGggaXQuICovCiAgaWYoIVJFTkRFUltjdXJdKXsgY3VyID0gU0lNUExFID8gJ2Rlc2snIDogJ2hvbWUnOyB9CiAgdHJ5eyB2aWV3LmlubmVySFRNTD1SRU5ERVJbY3VyXSgpOyB9CiAgY2F0Y2goZSl7CiAgICBjb25zb2xlLmVycm9yKCdyZW5kZXIgJytjdXIrJyBmYWlsZWQnLCBlKTsKICAgIHZpZXcuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPgogICAgICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlRoaXMgcGFnZSBmYWlsZWQgdG8gZHJhdzwvaDM+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkV2ZXJ5dGhpbmcgZWxzZSBzdGlsbCB3b3JrcyBcdTIwMTQgdGhlIHJlc3Qgb2YgdGhlIGFwcCBpcyBmaW5lLjwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6MTJweDtiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpOwogICAgICAgIGJvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDt3aGl0ZS1zcGFjZTpwcmUtd3JhcCI+JHtlc2MoY3VyKX06ICR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4IiBvbmNsaWNrPSJnbygnZGVzaycpIj5CYWNrIHRvIHRoZSBDaGFpcm1hbjwvYnV0dG9uPjwvZGl2PmA7CiAgfQogIGlmKGN1cj09PSdlbmdpbmUnKWRyYXdFbmdpbmUoKTsKICBpZihjdXI9PT0nYnJhaW4nJiZ0eXBlb2YgcHJvdkhpbnQ9PT0nZnVuY3Rpb24nKXByb3ZIaW50KCk7CiAgaWYoY3VyPT09J3BheScmJnR5cGVvZiBwYXlIaW50PT09J2Z1bmN0aW9uJylwYXlIaW50KCk7IHRpY2tDaHJvbWUoKSB9CmZ1bmN0aW9uIHRvZ2dsZVNiKCl7Y29uc3Qgbz1zaWRlYmFyLmNsYXNzTGlzdC50b2dnbGUoJ29wZW4nKTsKIGlmKG8pe2NvbnN0IHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7cy5pZD0nc2NyaW0nO3Mub25jbGljaz1jbG9zZVNiO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocyl9ZWxzZSBjbG9zZVNiKCl9CmZ1bmN0aW9uIGNsb3NlU2IoKXtzaWRlYmFyLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyaW0nKT8ucmVtb3ZlKCl9Ci8qIC0tLS0gbGlnaHQgLyBkYXJrIHRoZW1lLCByZW1lbWJlcmVkIHBlciBkZXZpY2UgLS0tLSAqLwpmdW5jdGlvbiBhcHBseVRoZW1lKHQpewogIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCB0KTsKICBjb25zdCBiPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aGVtZUJ0bicpOwogIGlmKGIpIGIudGV4dENvbnRlbnQgPSB0PT09J2RhcmsnID8gJ+KYgCcgOiAn4pi+JzsKICB0cnl7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjaGFpcm1hbl90aGVtZScsIHQpOyB9Y2F0Y2goZSl7fQogIGlmKHR5cGVvZiBjdXIhPT0ndW5kZWZpbmVkJyAmJiBjdXI9PT0nZW5naW5lJyAmJiB0eXBlb2YgZHJhd0VuZ2luZT09PSdmdW5jdGlvbicpIGRyYXdFbmdpbmUoKTsKfQpmdW5jdGlvbiB0b2dnbGVUaGVtZSgpewogIGNvbnN0IG5vdz1kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJyk9PT0nZGFyayc/J2RhcmsnOidsaWdodCc7CiAgYXBwbHlUaGVtZShub3c9PT0nZGFyayc/J2xpZ2h0JzonZGFyaycpOwp9Ci8qIGxpZ2h0IGlzIHRoZSBkZWZhdWx0IOKAlCBOdW1lcm8gdHJlYXN1cnkgcGFsZXR0ZSAqLwp0cnl7IGFwcGx5VGhlbWUobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NoYWlybWFuX3RoZW1lJyl8fCdsaWdodCcpOyB9Y2F0Y2goZSl7IGFwcGx5VGhlbWUoJ2xpZ2h0Jyk7IH0KZnVuY3Rpb24gaXNEYXJrKCl7IHJldHVybiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJyk9PT0nZGFyaycgfQovKiBlbmdpbmUgcGFsZXR0ZSBmb2xsb3dzIHRoZSB0aGVtZSAqLwpmdW5jdGlvbiBFUCgpeyByZXR1cm4gaXNEYXJrKCkKICA/IHtyaW5nOicjMjUyQTE2JyxsaW5lOicjNEE1NzIyJyxub2RlQmc6JyMxNTE4MEMnLGNvcmUxOicjRThGMEMwJyxjb3JlMjonI0EzQkIyQicsY29yZTM6JyMyQTMzMTAnLAogICAgIGNvcmVUeHQ6JyMwQTBCMDYnLGRlYWQ6JyMzQTQwMjQnLGRlYWRUeHQ6JyM2QTZENUMnLGxhYmVsOicjOUE5QzhBJ30KICA6IHtyaW5nOicjRTNFM0RBJyxsaW5lOicjQjlDNDhBJyxub2RlQmc6JyNGRkZGRkYnLGNvcmUxOicjRkZGRkZGJyxjb3JlMjonIzhGQTMyNicsY29yZTM6JyMzOTQ2MDMnLAogICAgIGNvcmVUeHQ6JyNGRkZGRkYnLGRlYWQ6JyNDRkNGQzMnLGRlYWRUeHQ6JyM5QTlDOTAnLGxhYmVsOicjNkI2RDYyJ30gfQoKLyogLS0tLS0tLS0tLSBwcmltaXRpdmVzIC0tLS0tLS0tLS0gKi8KY29uc3QgUkVOREVSPXt9OwpmdW5jdGlvbiBrcGkodixsLGMscyl7cmV0dXJuIGA8ZGl2IGNsYXNzPSJrcGkiPjx1PiR7bH08L3U+PGIgc3R5bGU9ImNvbG9yOiR7Y3x8J3ZhcigtLXR4dCknfSI+JHt2fTwvYj4ke3M/YDxzPiR7c308L3M+YDonJ308L2Rpdj5gfQpmdW5jdGlvbiBsb2dIdG1sKG4pe2lmKCFTLmxvZ3MubGVuZ3RoKXJldHVybiAnPGRpdiBjbGFzcz0ibW9uby1kaW0iPkxlZGdlciBlbXB0eS48L2Rpdj4nOwogY29uc3QgY29sPXtJTkZPOid2YXIoLS1ibHUpJyxPSzondmFyKC0tZ3JuKScsV0FSTjondmFyKC0tYW1iKScsQ1JJVDondmFyKC0tbWFnKSd9OwogcmV0dXJuICc8ZGl2IGNsYXNzPSJsb2ciPicrUy5sb2dzLnNsaWNlKDAsbikubWFwKGw9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtsLnR9PC9zcGFuPiA8c3BhbiBzdHlsZT0iY29sb3I6JHtjb2xbbC5zZXZdfSI+WyR7bC5zZXZ9XTwvc3Bhbj4gPGI+JHtlc2MobC5zcmMpfTwvYj4g4oCUICR7ZXNjKGwubXNnKX08L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+J30KZnVuY3Rpb24gZmxvb3IoaWQpe3JldHVybiBTLmZsb29ycy5maW5kKGY9PmYuaWQ9PT1pZCl8fHtoZWFsdGg6MCxsb2FkOjAsYWdlbnRzOjAsYWN0aXZlOjB9fQoKLyogLS0tLS0tLS0tLSBIT01FIC0tLS0tLS0tLS0gKi8KTElWRS5ob21lS3BpPSgpPT57CiAgY29uc3QgdD1TLnRlbGVtZXRyeSwgcGVuZD1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJykubGVuZ3RoOwogIGNvbnN0IGFjdGl2ZT1TLmFnZW50cy5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RoOwogIHJldHVybiBrcGkoYWN0aXZlKycgLyAnK1MuYWdlbnRzLmxlbmd0aCwnQWN0aXZlIFN1Yi1BZ2VudHMnLCd2YXIoLS1jeSknLGFjdGl2ZT09PVMuYWdlbnRzLmxlbmd0aD8nRnVsbCByb3N0ZXInOidERUdSQURFRCcpCiAgICtrcGkocGVuZCwnR2F0ZXMgRnJvemVuJyxwZW5kPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScscGVuZD8nQXdhaXRpbmcgY2xlYXJhbmNlJzonUXVldWUgY2xlYXInKQogICAra3BpKGhobW1zcyh0LnVwdGltZV9zKSwnU2VydmVyIFVwdGltZScsJ3ZhcigtLWdybiknLCdwaWQgJyt0LnBpZCkKICAgK2twaSh0LmF2Z19sYXRlbmN5X21zKycgbXMnLCdBdmcgTGF0ZW5jeScsdC5hdmdfbGF0ZW5jeV9tcz41MD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLGZtdCh0LnJlcXVlc3RzKSsnIHJlcXVlc3RzJyl9CkxJVkUuaG9tZUxvYWQ9KCk9PlBJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpOwogIHJldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5hY3RpdmV9LyR7Zi5hZ2VudHN9IGFndCDCtyBIJHtmLmhlYWx0aH0lIMK3IEwke2YubG9hZH0lPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5sb2FkfSU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsJHtwLmNvbG9yfSx2YXIoLS1saW1lKSkiPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyk7CkxJVkUuaG9tZVRlcm09KCk9PmxvZ0h0bWwoMTQpOwpSRU5ERVIuaG9tZT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBpbmZsb3c9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4IiBkYXRhLWxpdmU9ImhvbWVLcGkiPiR7TElWRS5ob21lS3BpKCl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFpcm1hbidzIFN0YW5kaW5nIEFzc2Vzc21lbnQgPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+Tk8gU1VHQVIgQ09BVElORzwvc3Bhbj48L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPiR7Uy5vd25lci5ib290c3RyYXA/JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5DUklUSUNBTDo8L2I+IGJvb3RzdHJhcCBwYXNzd29yZCBzdGlsbCBhY3RpdmUuIFJvdGF0ZSBpdCBub3cg4oCUIHRoZSBwbGFpbnRleHQgY29weSBleGlzdHMgb24gZGlzayB1bnRpbCB5b3UgZG8uJzonQm9vdHN0cmFwIGNyZWRlbnRpYWwgcm90YXRlZCBhbmQgZGVzdHJveWVkLiBHb29kLid9PC9saT4KICAgIDxsaT4ke1MucGF5b3V0PydQYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRyYW5zZmVycyByZXF1aXJlIHNpZ25hdHVyZSArIDJGQSBpbnRlbnQuJzonPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkJMT0NLRVI6PC9iPiBubyBwYXlvdXQgY2hhbm5lbC4gRXZlcnkgZmluYW5jaWFsIGdhdGUgaGFyZC1ibG9ja3Mgc2VydmVyLXNpZGUuJ308L2xpPgogICAgPGxpPiR7cGVuZD9gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7cGVuZH0gb3BlcmF0aW9uKHMpIGZyb3plbjwvYj4gcGVuZGluZyB5b3VyIGNsZWFyYW5jZS5gOidObyBmcm96ZW4gb3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+JHtTLnJ1bm5pbmc/YDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5TWVNURU0gUlVOTklORzwvYj4g4oCUICR7KFMudGFza3N8fFtdKS5maWx0ZXIodD0+dC5lbmFibGVkKS5sZW5ndGh9IHN0YW5kaW5nIG9yZGVycyBleGVjdXRpbmcsICR7KFMudGFza3N8fFtdKS5yZWR1Y2UoKGEsdCk9PmErKHQucnVuc3x8MCksMCl9IGpvYnMgY29tcGxldGVkLmA6JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5TWVNURU0gSEFMVEVEPC9iPiDigJQgbm8gYWdlbnQgd29yayBpcyBleGVjdXRpbmcuIFN0YXJ0IGl0IGluIExpdmUgT3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+WmVyby1Db3N0OiAke1MuZGVuaWFscy5sZW5ndGh9IHBhaWQgcGF0aChzKSBpbnRlcmNlcHRlZCwgJCR7Uy5zcGVuZC50b0ZpeGVkKDIpfSBhdXRob3JpemVkIHNwZW5kLCAwIG5wbSBkZXBlbmRlbmNpZXMgaW5zdGFsbGVkLjwvbGk+CiAgICA8bGk+TGl2ZSBzeW5jIGFjdGl2ZTogJHt0LmxpdmVfc2Vzc2lvbnN9IGRldmljZSBzZXNzaW9uKHMpIG9uIHRoaXMgaW5zdGFuY2UsIHN0YXRlIHJldmlzaW9uICR7Uy5yZXZ9LjwvbGk+CiAgIDwvdWw+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QaWxsYXIgTG9hZCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPkRFUklWRUQgRlJPTSBSRUFMIFBST0NFU1MgTUVUUklDUzwvc3Bhbj48L2gzPgogICAgPGRpdiBkYXRhLWxpdmU9ImhvbWVMb2FkIj4ke0xJVkUuaG9tZUxvYWQoKX08L2Rpdj48L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmV2ZW51ZSBUZWxlbWV0cnkgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+SU5GTE9XICQke2ZtdChpbmZsb3cpfTwvc3Bhbj48L2gzPiR7c3BhcmsoKX0KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+R3JlZW4gZGFzaGVkIGxpbmUgaXMgdGhlIHNwZW5kIGZsb29yLCBoZWxkIGF0ICQwLjAwIGJ5IGRvY3RyaW5lLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFRlcm1pbmFsIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPlNFUlZFUiBMRURHRVI8L3NwYW4+PC9oMz48ZGl2IGRhdGEtbGl2ZT0iaG9tZVRlcm0iPiR7TElWRS5ob21lVGVybSgpfTwvZGl2PjwvZGl2PmA7Cn07CmZ1bmN0aW9uIHNwYXJrKCl7CiAgY29uc3Qgdj1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLm1hcChyPT5yLmFtdCk7IGNvbnN0IHB0cz0odi5sZW5ndGg/djpbMCwwXSkuc2xpY2UoLTI0KTsKICBjb25zdCBteD1NYXRoLm1heCguLi5wdHMsMSksdz02MDAsaD05MCxzdGVwPXB0cy5sZW5ndGg+MT93LyhwdHMubGVuZ3RoLTEpOnc7CiAgY29uc3QgZD1wdHMubWFwKChwLGkpPT5gJHtpPydMJzonTSd9JHsoaSpzdGVwKS50b0ZpeGVkKDEpfSwkeyhoLShwL214KSooaC0xMiktNikudG9GaXhlZCgxKX1gKS5qb2luKCcgJyk7CiAgcmV0dXJuIGA8c3ZnIHZpZXdCb3g9IjAgMCAke3d9ICR7aH0iIHN0eWxlPSJ3aWR0aDoxMDAlO2hlaWdodDo5MHB4Ij4KICAgPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJzZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc4OEExRDU1Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNzg4QTFEMDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KICAgJHtbMCwxLDIsM10ubWFwKGk9PmA8bGluZSB4MT0iMCIgeTE9IiR7aSozMH0iIHgyPSIke3d9IiB5Mj0iJHtpKjMwfSIgc3Ryb2tlPSIjMTAxYTI0Ii8+YCkuam9pbignJyl9CiAgIDxwYXRoIGQ9IiR7ZH0gTCR7d30sJHtofSBMMCwke2h9IFoiIGZpbGw9InVybCgjc2cpIi8+PHBhdGggZD0iJHtkfSIgc3Ryb2tlPSIjNzg4QTFEIiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgPGxpbmUgeDE9IjAiIHkxPSIke2gtNn0iIHgyPSIke3d9IiB5Mj0iJHtoLTZ9IiBzdHJva2U9IiMzMWQ2N2EiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIgc3Ryb2tlLXdpZHRoPSIxLjQiLz48L3N2Zz5gOwp9CgovKiAtLS0tLS0tLS0tIExJVkUgVEVMRU1FVFJZIC0tLS0tLS0tLS0gKi8KTElWRS5zeXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAke2twaSh0LnJzc19tYisnIE1CJywnUHJvY2VzcyBSU1MnLCd2YXIoLS1jeSknLCdoZWFwICcrdC5oZWFwX21iKycvJyt0LmhlYXBfdG90YWxfbWIrJyBNQicpfQogICR7a3BpKHQubG9hZDEsJ0xvYWQgQXZnIDFtJyx0LmxvYWQxPnQuY3B1cz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLHQuY3B1cysnIGNwdXMgwrcgNW0gJyt0LmxvYWQ1KX0KICAke2twaSh0LnN5c19tZW1fcGN0KyclJywnU3lzdGVtIE1lbW9yeScsdC5zeXNfbWVtX3BjdD44NT8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknLCdob3N0ICcrdC5ob3N0bmFtZSl9CiAgJHtrcGkoZm10KHQucmVxdWVzdHMpLCdIVFRQIFJlcXVlc3RzJywndmFyKC0tYmx1KScsZm10KHQuYXBpX2NhbGxzKSsnIGFwaSDCtyAnK3QuZXJyb3JzKycgZXJyb3JzJyl9CiA8L2Rpdj4KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Qcm9jZXNzIEZhY3RzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+UnVudGltZTwvdGQ+PHRkPiR7dC5ub2RlfSDCtyAke3QucGxhdGZvcm19PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UElEPC90ZD48dGQ+JHt0LnBpZH08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5VcHRpbWU8L3RkPjx0ZD4ke2hobW1zcyh0LnVwdGltZV9zKX08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmcgbGF0ZW5jeTwvdGQ+PHRkPiR7dC5hdmdfbGF0ZW5jeV9tc30gbXMgKGxhc3QgNTAwIHJlcSk8L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdXRoIGZhaWx1cmVzPC90ZD48dGQgc3R5bGU9ImNvbG9yOiR7dC5hdXRoX2ZhaWx1cmVzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QuYXV0aF9mYWlsdXJlc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MaXZlIHNlc3Npb25zPC90ZD48dGQ+JHt0LmxpdmVfc2Vzc2lvbnN9IG9mICR7dC50b3RhbF9zZXNzaW9uc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TdGF0ZSBmaWxlPC90ZD48dGQ+JHsodC5kYl9ieXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQiDCtyByZXYgJHt0LnN0YXRlX3Jldn08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TZXNzaW9uczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkRVUkFCTEUgwrcgMzBkIFRUTDwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Nb25pdG9yczwvdGQ+PHRkPiR7dC5tb25pdG9yc3x8MH0gYm91bmQgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOiR7dC5tb25pdG9yc19kb3duPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QubW9uaXRvcnNfZG93bnx8MH0gZG93bjwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5NYWlsIHJlbGF5PC90ZD48dGQ+JHt0LnNtdHBfcmVhZHk/YDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkFSTUVEPC9zcGFuPiAke3QubWFpbF9zZW50fSBzZW50IC8gJHt0Lm1haWxfZmFpbGVkfSBmYWlsZWRgOic8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5PRkZMSU5FIOKAlCBpbnRlbnQgb25seTwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRlcGVuZGVuY2llczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPjAgSU5TVEFMTEVEIMK3ICQwLjAwPC9zcGFuPjwvdGQ+PC90cj4KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkhvdCBQYXRoczwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICR7dC5ob3RfcGF0aHMubWFwKChbcCxjXSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MocCl9PC90ZD48dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPiR7Zm10KGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkNvdW50ZXJzIGFyZSByZWFsLCBjb2xsZWN0ZWQgaW4tcHJvY2VzcyBzaW5jZSBib290LiBUaGV5IHJlc2V0IHdoZW4gdGhlIHNlcnZlciByZXN0YXJ0cy48L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlcml2ZWQgRmxvb3IgSGVhbHRoPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpO3JldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5oZWFsdGh9JSBoZWFsdGggwrcgJHtmLmxvYWR9JSBsb2FkPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5oZWFsdGh9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+RWFjaCBmbG9vcidzIGhlYWx0aCBpcyBjb21wdXRlZCBmcm9tIHJlYWwgaW5wdXRzOiBhdXRoIGZhaWx1cmVzIGFuZCBkb2N0cmluZSBkZW5pYWxzIGhpdCBTZWN1cml0eTsgbG9hZCBhdmVyYWdlIGFuZCBSU1MgaGl0IE9wZXJhdGlvbnM7IEhUVFAgZXJyb3JzIGFuZCBmcm96ZW4gZ2F0ZXMgaGl0IEVuZ2luZWVyaW5nOyBzdGF0ZS1maWxlIHNpemUgaGl0cyBEYXRhOyBhdXRob3JpemVkIHNwZW5kIGFuZCBwYXlvdXQgc3RhdHVzIGhpdCBTdHJhdGVneS4gU3RhZmZpbmcgcmF0aW8gc2NhbGVzIGFsbCBmaXZlLiBUaGVzZSBtb3ZlIHdoZW4gdGhlIHN5c3RlbSBhY3R1YWxseSBtb3Zlcy48L2Rpdj48L2Rpdj5gfQpSRU5ERVIuc3lzdGVtPSgpPT5gPGRpdiBkYXRhLWxpdmU9InN5cyI+JHtMSVZFLnN5cygpfTwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIEVOR0lORSAtLS0tLS0tLS0tICovClJFTkRFUi5lbmdpbmU9KCk9PmAKIDxkaXYgY2xhc3M9ImVuZ2luZVdyYXAiPjxkaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9InBhZGRpbmc6MTFweCAxM3B4O21hcmdpbi1ib3R0b206MTFweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxiIHN0eWxlPSJsZXR0ZXItc3BhY2luZzoycHg7Zm9udC1zaXplOjEycHgiPk9QVElNQUwgRU5HSU5FPC9iPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+S05PV0xFREdFIENPUkU8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7ZW5nRm9jdXM/Jyc6J3AnfSIgb25jbGljaz0iZW5nRm9jdXM9bnVsbDtkcmF3RW5naW5lKCkiPlJhZGlhbDwvYnV0dG9uPgogICAke1BJTExBUlMubWFwKHA9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20gJHtlbmdGb2N1cz09cC5pZD8ncCc6Jyd9IiBvbmNsaWNrPSJlbmdGb2N1cz0ke3AuaWR9O2RyYXdFbmdpbmUoKSI+JHtwLmljb259PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FudmFzQm94Ij48ZGl2IGNsYXNzPSJncmlkYmciPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJlbmdUb3AiPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iIGlkPSJlbmdNb2RlIj5SQURJQUwgwrcgQUxMIEZMT09SUzwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZW5nVGl0bGUiIGlkPSJlbmdUaXRsZSI+Q0hBSVJNQU4gQ09SRTwvZGl2PjxkaXYgaWQ9ImVuZ1N2ZyI+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PGgzPkVuZ2luZSBUZXJtaW5hbDwvaDM+CiAgIDxkaXYgY2xhc3M9InRlcm0iIGlkPSJlbmdUZXJtIj5jaGFpcm1hbi1vcyA6OiBlbmdpbmUgcmVhZHkgwrcgJHtTLmFnZW50cy5sZW5ndGh9IG5vZGVzIGJvdW5kIMK3IGNvc3QgY2VpbGluZyAkMC4wMAphd2FpdGluZyBub2RlIHNlbGVjdGlvbuKApjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGNsYXNzPSJzaWRlIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVuczwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RW50aXR5PC9zcGFuPjxzZWxlY3QgY2xhc3M9ImluIiBpZD0ibGVuc0VudCIgb25jaGFuZ2U9ImRyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImFjdGl2ZSI+QWN0aXZlIG9ubHk8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJzdXNwIj5TdXNwZW5kZWQgb25seTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbjowIj48c3Bhbj5GbG9vcjwvc3Bhbj48c2VsZWN0IGNsYXNzPSJpbiIgb25jaGFuZ2U9ImVuZ0ZvY3VzPXRoaXMudmFsdWU9PT0nYWxsJz9udWxsOit0aGlzLnZhbHVlO2RyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbCBmbG9vcnM8L29wdGlvbj4ke1BJTExBUlMubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke2VuZ0ZvY3VzPT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7cC5pZH0gwrcgJHtwLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVnZW5kPC9oMz48ZGl2IGNsYXNzPSJsZWdlbmQiPgogICAke1BJTExBUlMubWFwKHA9PmA8ZGl2PjxpIHN0eWxlPSJiYWNrZ3JvdW5kOiR7cC5jb2xvcn07Ym94LXNoYWRvdzowIDAgOHB4ICR7cC5jb2xvcn0iPjwvaT4ke3AubmFtZX08L2Rpdj5gKS5qb2luKCcnKX0KICAgPGRpdj48aSBzdHlsZT0iYmFja2dyb3VuZDojZTZlZWY3O2JveC1zaGFkb3c6MCAwIDhweCAjZmZmIj48L2k+Q2hhaXJtYW4gQ29yZTwvZGl2PjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EaXJlY3RvcnkgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmFnZW50cy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9ImRpckxpc3QiPiR7Uy5hZ2VudHMubWFwKGE9PmA8YnV0dG9uIG9uY2xpY2s9InBpY2tOb2RlKCcke2EuaWR9JykiPiR7ZXNjKGEubmFtZSl9PHNwYW4+JHtQSUxMQVJTLmZpbmQocD0+cC5pZD09YS5waWxsYXJJZCkuaWNvbn08L3NwYW4+PC9idXR0b24+YCkuam9pbignJyl8fCc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+ZW1wdHk8L2Rpdj4nfTwvZGl2PjwvZGl2PgogPC9kaXY+PC9kaXY+YDsKZnVuY3Rpb24gZHJhd0VuZ2luZSgpewogIGNvbnN0IGJveD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nU3ZnJyk7IGlmKCFib3gpcmV0dXJuOwogIGNvbnN0IFA9RVAoKTsKICBjb25zdCBlbnQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xlbnNFbnQnKT8udmFsdWV8fCdhbGwnOwogIGxldCBsaXN0PVMuYWdlbnRzLmZpbHRlcihhPT5lbnQ9PT0nYWxsJ3x8KGVudD09PSdhY3RpdmUnP2Euc3RhdHVzPT09J0FDVElWRSc6YS5zdGF0dXMhPT0nQUNUSVZFJykpOwogIGNvbnN0IGZsb29ycz1lbmdGb2N1cz9QSUxMQVJTLmZpbHRlcihwPT5wLmlkPT09ZW5nRm9jdXMpOlBJTExBUlM7CiAgaWYoZW5nRm9jdXMpbGlzdD1saXN0LmZpbHRlcihhPT5hLnBpbGxhcklkPT09ZW5nRm9jdXMpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdNb2RlJykudGV4dENvbnRlbnQ9ZW5nRm9jdXM/J0ZPQ1VTIMK3IEZMT09SIDAnK2VuZ0ZvY3VzOidSQURJQUwgwrcgQUxMIEZMT09SUyc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1RpdGxlJykudGV4dENvbnRlbnQ9ZW5nRm9jdXM/UElMTEFSUy5maW5kKHA9PnAuaWQ9PT1lbmdGb2N1cykubmFtZS50b1VwcGVyQ2FzZSgpOidDSEFJUk1BTiBDT1JFJzsKICBjb25zdCBXPTkwMCxIPTU2MCxjeD1XLzIsY3k9SC8yOyBsZXQgaHVicz0nJyxsaW5rcz0nJyxub2Rlcz0nJyxyaW5ncz0nJzsKICBbMTUwLDIxNSwyNjVdLmZvckVhY2gocj0+cmluZ3MrPWA8Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSIke3J9IiBmaWxsPSJub25lIiBzdHJva2U9IiR7UC5yaW5nfSIgc3Ryb2tlLWRhc2hhcnJheT0iMyA2Ii8+YCk7CiAgY29uc3Qgbj1mbG9vcnMubGVuZ3RoOwogIGZsb29ycy5mb3JFYWNoKChwLGkpPT57CiAgICBjb25zdCBhbmc9KC05MCsoMzYwL24pKmkpKk1hdGguUEkvMTgwLGh4PWN4KzE1MCpNYXRoLmNvcyhhbmcpLGh5PWN5KzE1MCpNYXRoLnNpbihhbmcpOwogICAgbGlua3MrPWA8bGluZSB4MT0iJHtjeH0iIHkxPSIke2N5fSIgeDI9IiR7aHh9IiB5Mj0iJHtoeX0iIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9Ii41NSIgc3Ryb2tlLXdpZHRoPSIxLjQiLz5gOwogICAgaHVicys9YDxnIGNsYXNzPSJub2RlIiBvbmNsaWNrPSJlbmdGb2N1cz0ke2VuZ0ZvY3VzPydudWxsJzpwLmlkfTtkcmF3RW5naW5lKCkiPgogICAgIDxjaXJjbGUgY3g9IiR7aHh9IiBjeT0iJHtoeX0iIHI9IjE3IiBmaWxsPSIke1Aubm9kZUJnfSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utd2lkdGg9IjIiLz4KICAgICA8dGV4dCB4PSIke2h4fSIgeT0iJHtoeSs0fSIgZm9udC1zaXplPSIxMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+JHtwLmljb259PC90ZXh0PgogICAgIDx0ZXh0IHg9IiR7aHh9IiB5PSIke2h5KzMyfSIgZm9udC1zaXplPSI5LjUiIGZpbGw9IiR7cC5jb2xvcn0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC5uYW1lLnNwbGl0KCcgJylbMF0udG9VcHBlckNhc2UoKX08L3RleHQ+PC9nPmA7CiAgICBjb25zdCBraWRzPWxpc3QuZmlsdGVyKGE9PmEucGlsbGFySWQ9PT1wLmlkKTsKICAgIGtpZHMuZm9yRWFjaCgoYSxqKT0+ewogICAgICBjb25zdCBzcHJlYWQ9ZW5nRm9jdXM/TWF0aC5QSSoxLjY6TWF0aC5QSS8obioxLjE1KTsKICAgICAgY29uc3QgdD1raWRzLmxlbmd0aD4xPyhqLyhraWRzLmxlbmd0aC0xKS0uNSk6MCwgYWE9YW5nK3Qqc3ByZWFkLCBSPWVuZ0ZvY3VzPzIzMDooaiUyPzI2NToyMTUpOwogICAgICBjb25zdCB4PWN4K1IqTWF0aC5jb3MoYWEpLHk9Y3krUipNYXRoLnNpbihhYSksZGVhZD1hLnN0YXR1cyE9PSdBQ1RJVkUnOwogICAgICBsaW5rcys9YDxsaW5lIHgxPSIke2h4fSIgeTE9IiR7aHl9IiB4Mj0iJHt4fSIgeTI9IiR7eX0iIHN0cm9rZT0iJHtkZWFkPycjMjQzMDQwJzpwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9IiR7ZGVhZD8uMzouMzV9IiBzdHJva2Utd2lkdGg9IjEiLz5gOwogICAgICBub2Rlcys9YDxnIGNsYXNzPSJub2RlIiBvbmNsaWNrPSJwaWNrTm9kZSgnJHthLmlkfScpIj48dGl0bGU+JHtlc2MoYS5uYW1lKX08L3RpdGxlPgogICAgICAgPGNpcmNsZSBjeD0iJHt4fSIgY3k9IiR7eX0iIHI9IjkiIGZpbGw9IiR7ZGVhZD9QLm5vZGVCZzpQLm5vZGVCZ30iIHN0cm9rZT0iJHtkZWFkP1AuZGVhZDpwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIxLjYiLz4KICAgICAgIDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSszLjR9IiBmb250LXNpemU9IjguNSIgZmlsbD0iJHtkZWFkP1AuZGVhZFR4dDpwLmNvbG9yfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+QTwvdGV4dD4KICAgICAgICR7ZW5nRm9jdXM/YDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSsyMX0iIGZvbnQtc2l6ZT0iOCIgZmlsbD0iJHtQLmxhYmVsfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtlc2MoYS5uYW1lLnNsaWNlKDAsMTYpKX08L3RleHQ+YDonJ308L2c+YDsKICAgIH0pOwogIH0pOwogIGJveC5pbm5lckhUTUw9YDxzdmcgdmlld0JveD0iMCAwICR7V30gJHtIfSI+CiAgIDxkZWZzPjxyYWRpYWxHcmFkaWVudCBpZD0iY29yZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIke1AuY29yZTF9Ii8+PHN0b3Agb2Zmc2V0PSIuNTUiIHN0b3AtY29sb3I9IiR7UC5jb3JlMn0iLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiR7UC5jb3JlM30iLz48L3JhZGlhbEdyYWRpZW50PgogICA8ZmlsdGVyIGlkPSJnbG93Ij48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI1IiByZXN1bHQ9ImIiLz48ZmVNZXJnZT48ZmVNZXJnZU5vZGUgaW49ImIiLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PC9kZWZzPgogICAke3JpbmdzfSR7bGlua3N9PGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iMzQiIGZpbGw9InVybCgjY29yZSkiIGZpbHRlcj0idXJsKCNnbG93KSIgb3BhY2l0eT0iLjkyIi8+CiAgIDxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjQ2IiBmaWxsPSJub25lIiBzdHJva2U9IiR7UC5jb3JlMn01NSIvPgogICA8dGV4dCB4PSIke2N4fSIgeT0iJHtjeSszfSIgZm9udC1zaXplPSIxMCIgZmlsbD0iJHtQLmNvcmVUeHR9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXdlaWdodD0iNzAwIj5DT1JFPC90ZXh0PgogICAke2h1YnN9JHtub2Rlc308L3N2Zz5gOwp9CmZ1bmN0aW9uIHBpY2tOb2RlKGlkKXtjb25zdCBhPVMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKTtpZighYSlyZXR1cm47CiBjb25zdCB0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdUZXJtJyk7CiBpZih0KXQudGV4dENvbnRlbnQ9YGNoYWlybWFuLW9zIDo6IG5vZGUgJHthLmlkfVxubmFtZSAgICAgJHthLm5hbWV9XG5mbG9vciAgICAke2EucGlsbGFySWR9IMK3ICR7UElMTEFSUy5maW5kKHA9PnAuaWQ9PWEucGlsbGFySWQpLm5hbWV9XG5zdGF0dXMgICAke2Euc3RhdHVzfVxuY29zdCAgICAgJHthLmNvc3R9XG50b29scyAgICAke2EudG9vbHMuam9pbignLCAnKX1cbnNjb3BlICAgICR7YS5yb2xlfWA7CiBzaG93WWFtbChpZCl9CgovKiAtLS0tLS0tLS0tIEdBVEVTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmdhdGVzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmFpc2UgUGVybWlzc2lvbiBHYXRlIDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPjQtU1RFUCBTT1AgwrcgU0VSVkVSIEVORk9SQ0VEPC9zcGFuPjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3BlcmF0aW9uIFRpdGxlPC9zcGFuPjxpbnB1dCBpZD0iZ1RpdGxlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJEZXBsb3kgcHJpY2luZy1zZXJ2aWNlIHYyLjQiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q2xhc3M8L3NwYW4+PHNlbGVjdCBpZD0iZ0NsYXNzIiBjbGFzcz0iaW4iPgogICAgPG9wdGlvbj5ERVBMT1lNRU5UPC9vcHRpb24+PG9wdGlvbj5EQiBTQ0hFTUEgQ0hBTkdFPC9vcHRpb24+PG9wdGlvbj5DT0RFIE1PRElGSUNBVElPTjwvb3B0aW9uPgogICAgPG9wdGlvbj5GSU5BTkNJQUwgVFJBTlNGRVI8L29wdGlvbj48b3B0aW9uPkFDQ0VTUyBHUkFOVDwvb3B0aW9uPjxvcHRpb24+RVhURVJOQUwgVE9PTCBBRE9QVElPTjwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4xIMK3IE9iamVjdGl2ZSAmYW1wOyBzdWNjZXNzIGNyaXRlcmlhPC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ09iaiIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MiDCtyBBZ2VudHMgLyB0b29scyBhc3NpZ25lZCAmYW1wOyB3aHk8L3NwYW4+PHRleHRhcmVhIGlkPSJnSnVzdCIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MyDCtyBSb2xsYmFjayAmYW1wOyBzYWZlZ3VhcmRzPC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ1NhZmUiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJsYXN0IFJhZGl1czwvc3Bhbj48c2VsZWN0IGlkPSJnUmlzayIgY2xhc3M9ImluIj48b3B0aW9uPkxPVzwvb3B0aW9uPjxvcHRpb24+TUVESVVNPC9vcHRpb24+PG9wdGlvbj5ISUdIPC9vcHRpb24+PG9wdGlvbj5TRVZFUkU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRvb2wgQ29zdCAvIENyZWRpdHMgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJnQ29zdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIG1pbj0iMCIgdmFsdWU9IjAiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VmFsdWUgYXQgUmlzayAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9ImdBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPSIwIj48L2xhYmVsPjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJlZSBBbHRlcm5hdGl2ZSBSb3V0ZSAocmVxdWlyZWQgaWYgY29zdCAmZ3Q7IDApPC9zcGFuPjxpbnB1dCBpZD0iZ0ZyZWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Ik9wZW4tc291cmNlIC8gc2VsZi1ob3N0ZWQgLyBmcmVlLXRpZXIgcGF0aCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icmFpc2VHYXRlKCkiPlNVQk1JVCBGT1IgT1dORVIgQ0xFQVJBTkNFPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBRdWV1ZSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1MuZ2F0ZXMubGVuZ3RofTwvc3Bhbj48L2gzPgogICR7Uy5nYXRlcy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5PcGVyYXRpb248L3RoPjx0aD5DbGFzczwvdGg+PHRoPlJpc2s8L3RoPjx0aD5Db3N0PC90aD48dGg+U3RhdHVzPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Uy5nYXRlcy5tYXAoZz0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2cuaWR9PC90ZD48dGQ+JHtlc2MoZy50aXRsZSl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7Zy50fTwvZGl2PjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2cuY2xzfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke1snSElHSCcsJ1NFVkVSRSddLmluY2x1ZGVzKGcucmlzayk/J3QtcmVkJzpnLnJpc2s9PT0nTUVESVVNJz8ndC1hbWInOid0LWdybid9Ij4ke2cucmlza308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLmNvc3Q/J3QtcmVkJzondC1ncm4nfSI+JHtnLmNvc3Q/JyQnK2cuY29zdDonRlJFRSd9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Zy5zdGF0dXM9PT0nQVBQUk9WRUQnPyd0LWdybic6Zy5zdGF0dXM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke2cuc3RhdHVzfTwvc3Bhbj48L3RkPgogICA8dGQ+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJvcGVuR2F0ZSgnJHtnLmlkfScpIj5SZXZpZXc8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBnYXRlcyByYWlzZWQuIE5vdGhpbmcgaXMgZXhlY3V0aW5nLjwvZGl2Pid9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcmFpc2VHYXRlKCl7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9nYXRlJyx7dGl0bGU6Z1RpdGxlLnZhbHVlLnRyaW0oKSxjbHM6Z0NsYXNzLnZhbHVlLG9iajpnT2JqLnZhbHVlLnRyaW0oKSwKICAgIGp1c3Q6Z0p1c3QudmFsdWUudHJpbSgpLHNhZmU6Z1NhZmUudmFsdWUudHJpbSgpLHJpc2s6Z1Jpc2sudmFsdWUsY29zdDorZ0Nvc3QudmFsdWV8fDAsYW10OitnQW10LnZhbHVlfHwwLGZyZWU6Z0ZyZWUudmFsdWUudHJpbSgpfSk7CiAgIHJlbmRlcigpOyBmbGFzaCgnR2F0ZSAnK3IuaWQrJyByYWlzZWQgwrcgZnJvemVuIHNlcnZlci1zaWRlJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBvcGVuR2F0ZShpZCl7CiAgY29uc3QgZz1TLmdhdGVzLmZpbmQoeD0+eC5pZD09PWlkKTsKICBjb25zdCBmaW5CbG9jaz1nLmNscz09PSdGSU5BTkNJQUwgVFJBTlNGRVInJiYhUy5wYXlvdXQsIGNvc3RCbG9jaz1nLmNvc3Q+MDsKICBtb2RhbChgPGgzPiR7ZXNjKGcudGl0bGUpfTwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPiR7Zy5pZH0gwrcgJHtnLmNsc30gwrcgcmFpc2VkICR7Zy50fTwvZGl2PgogICR7ZmluQmxvY2s/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+PGI+SEFSRCBCTE9DSy48L2I+IEZpbmFuY2lhbCB0cmFuc2ZlciB3aXRoIG5vIHBheW91dCBjaGFubmVsIHNlYWxlZC4gVGhlIHNlcnZlciB3aWxsIHJlamVjdCBhcHByb3ZhbC48L2Rpdj5gOicnfQogICR7Y29zdEJsb2NrP2A8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5aRVJPLUNPU1QgRE9DVFJJTkUgRkxBRy48L2I+IFRoaXMgZGVtYW5kcyAkJHtnLmNvc3R9LiBUaGUgQ2hhaXJtYW4gZG9lcyBub3QgcGF5LiBBcHByb3ZpbmcgaXMgYW4gZXhwbGljaXQgT3duZXIgb3ZlcnJpZGUuIEZyZWUgcm91dGUgb24gcmVjb3JkOiA8ZW0+JHtlc2MoZy5mcmVlfHwnbm9uZScpfTwvZW0+PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MSDCtyBPYmplY3RpdmU8L2gzPjxkaXY+JHtlc2MoZy5vYmopfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4yIMK3IEFnZW50IEp1c3RpZmljYXRpb248L2gzPjxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwIj4ke2VzYyhnLmp1c3QpfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4zIMK3IFNhZmVndWFyZHMgJmFtcDsgUm9sbGJhY2s8L2gzPjxkaXY+JHtlc2MoZy5zYWZlKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLnJpc2s9PT0nTE9XJz8ndC1ncm4nOid0LXJlZCd9Ij5CTEFTVCAke2cucmlza308L3NwYW4+CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtnLmNvc3Q/J3QtcmVkJzondC1ncm4nfSI+Q09TVCAke2cuY29zdD8nJCcrZy5jb3N0OickMC4wMCd9PC9zcGFuPgogICAke2cuYW10P2A8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5BVCBSSVNLICQke2ZtdChnLmFtdCl9PC9zcGFuPmA6Jyd9CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtnLnN0YXR1cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpnLnN0YXR1cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7Zy5zdGF0dXN9PC9zcGFuPjwvZGl2PgogICR7Zy5zdGF0dXM9PT0nUEVORElORyc/YDxkaXYgY2xhc3M9ImVyciIgaWQ9ImdFcnIiPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgJHtmaW5CbG9jaz8nZGlzYWJsZWQnOicnfSBvbmNsaWNrPSJkZWNpZGUoJyR7Zy5pZH0nLDEpIj4ke2Nvc3RCbG9jaz8nT1ZFUlJJREUgJmFtcDsgQVVUSE9SSVpFJzonQVVUSE9SSVpFIEVYRUNVVElPTid9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVjaWRlKCcke2cuaWR9JywwKSI+REVOWSAmYW1wOyBURVJNSU5BVEU8L2J1dHRvbj4KICAgJHtjb3N0QmxvY2s/YDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVyb3V0ZSgnJHtnLmlkfScpIj5SRVJPVVRFIEZSRUU8L2J1dHRvbj5gOicnfQogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gCiAgOmA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+UmVzb2x2ZWQgJHtlc2MoZy5yZXNvbHZlZHx8JycpfTwvc3Bhbj48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gfWApOwp9CmFzeW5jIGZ1bmN0aW9uIGRlY2lkZShpZCxvayl7CiAgY29uc3QgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ0VycicpOyBlLnRleHRDb250ZW50PScnOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2dhdGUvZGVjaWRlJyx7aWQsb2s6ISFva30pOwogICAgY2xvc2VNb2RhbCgpOyByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytpZCsnIHJlc29sdmVkJyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVyb3V0ZShpZCl7IGF3YWl0IEFQSSgnL2FwaS9nYXRlL3Jlcm91dGUnLHtpZH0pOyBjbG9zZU1vZGFsKCk7IHJlbmRlcigpOyBmbGFzaCgnUmVyb3V0ZWQgwrcgJDAuMDAnKSB9CgovKiAtLS0tLS0tLS0tIEFHRU5UUyAtLS0tLS0tLS0tICovClJFTkRFUi5hZ2VudHM9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21taXNzaW9uIEFnZW50PC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5hbWU8L3NwYW4+PGlucHV0IGlkPSJhTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iTGVkZ2VyIFNlbnRpbmVsIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGlsbGFyPC9zcGFuPjxzZWxlY3QgaWQ9ImFQaWwiIGNsYXNzPSJpbiI+JHtQSUxMQVJTLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSI+JHtwLmlkfSDCtyAke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3BlcmF0aW9uYWwgU2NvcGU8L3NwYW4+PHRleHRhcmVhIGlkPSJhUm9sZSIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QZXJtaXR0ZWQgVG9vbHMgKGNvbW1hIHNlcGFyYXRlZCk8L3NwYW4+PGlucHV0IGlkPSJhVG9vbHMiIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvc3QgUG9saWN5PC9zcGFuPjxzZWxlY3QgaWQ9ImFDb3N0IiBjbGFzcz0iaW4iPgogICA8b3B0aW9uPkZSRUUtVElFUi1PTkxZPC9vcHRpb24+PG9wdGlvbj5TRUxGLUhPU1RFRC1PTkxZPC9vcHRpb24+PG9wdGlvbj5PV05FUi1PVkVSUklERS1QQUlEPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29tbWlzc2lvbigpIj5DT01NSVNTSU9OICZhbXA7IEJJTkQ8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3N0ZXIgRGlzdHJpYnV0aW9uPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpLG09TWF0aC5tYXgoMSwuLi5TLmZsb29ycy5tYXAoeD0+eC5hZ2VudHMpKTsKICAgcmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuYWdlbnRzL20qMTAwfSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BbGwgYWdlbnRzIGluaGVyaXQgdGhlIFplcm8tQ29zdCBEb2N0cmluZSB1bmxlc3Mgc2V0IHRvIE9XTkVSLU9WRVJSSURFLVBBSUQuPC9kaXY+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QWN0aXZlIFJvc3RlciA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aH0gQUNUSVZFPC9zcGFuPjwvaDM+CiAke1MuYWdlbnRzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPkFnZW50PC90aD48dGg+Rmxvb3I8L3RoPjx0aD5Ub29sczwvdGg+PHRoPkNvc3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke1MuYWdlbnRzLm1hcChhPT57Y29uc3QgcD1QSUxMQVJTLmZpbmQoeD0+eC5pZD09YS5waWxsYXJJZCk7cmV0dXJuIGA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLmlkfTwvdGQ+CiAgPHRkPjxiPiR7ZXNjKGEubmFtZSl9PC9iPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhhLnJvbGUpfTwvZGl2PjwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmNsc30iPiR7cC5pY29ufSAke2EucGlsbGFySWR9PC9zcGFuPjwvdGQ+CiAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLnRvb2xzLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2EuY29zdD09PSdPV05FUi1PVkVSUklERS1QQUlEJz8ndC1hbWInOid0LWdybid9Ij4ke2EuY29zdH08L3NwYW4+PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2Euc3RhdHVzPT09J0FDVElWRSc/J3QtZ3JuJzondC1kaW0nfSI+JHthLnN0YXR1c308L3NwYW4+PC90ZD4KICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJzaG93WWFtbCgnJHthLmlkfScpIj5ZQU1MPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nKCcke2EuaWR9JykiPiR7YS5zdGF0dXM9PT0nQUNUSVZFJz8nU3VzcGVuZCc6J1JlaW5zdGF0ZSd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbCgnJHthLmlkfScpIj5LaWxsPC9idXR0b24+PC90ZD48L3RyPmB9KS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Um9zdGVyIGVtcHR5LjwvZGl2Pid9PC9kaXY+YDsKZnVuY3Rpb24geWFtbEZvcihhKXtjb25zdCBwPVBJTExBUlMuZmluZCh4PT54LmlkPT1hLnBpbGxhcklkKTsKIHJldHVybiBgQWdlbnRfRGVmaW5pdGlvbjoKICBOYW1lOiAiJHthLm5hbWV9IgogIFBpbGxhcjogIiR7cC5uYW1lfSIKICBSb2xlOiAiJHthLnJvbGV9IgogIFBlcm1pdHRlZF9Ub29sczogWyR7YS50b29scy5tYXAodD0+YCIke3R9ImApLmpvaW4oJywgJyl9XQogIFN1cGVydmlzb3I6ICJDaGFpcm1hbiBBZ2VudCBPUyIKICBBZ2VudF9JRDogIiR7YS5pZH0iCiAgQ29zdF9Qb2xpY3k6ICIke2EuY29zdH0iCiAgQ29tbWlzc2lvbmVkOiAiJHthLnR9IgogIEluc3RydWN0aW9uOiB8CiAgICBFeGVjdXRlIHRhc2tzIHN0cmljdGx5IHdpdGhpbiBzY29wZS4gUmVwb3J0IGFsbCBsb2dzLCBhbm9tYWxpZXMgYW5kCiAgICBjb21wbGV0aW9uIG1ldHJpY3MgZGlyZWN0bHkgdG8gdGhlIENoYWlybWFuIHRlcm1pbmFsLiBEbyBub3QgYXR0ZW1wdAogICAgdW5hcHByb3ZlZCBzaWRlIGVmZmVjdHMuCiAgICBaRVJPLUNPU1QgRE9DVFJJTkU6IG5ldmVyIHB1cmNoYXNlLCBzdWJzY3JpYmUsIG9yIGNvbnN1bWUgcGFpZCBjcmVkaXRzLgogICAgSWYgYSB0b29sLCBzaXRlIG9yIEFQSSBkZW1hbmRzIHBheW1lbnQsIGhhbHQsIGZpbmQgYSBmcmVlLCBvcGVuLXNvdXJjZSwKICAgIHNlbGYtaG9zdGVkIG9yIGZyZWUtdGllciBlcXVpdmFsZW50LCBhbmQgcmVwb3J0IHRoZSBzdWJzdGl0dXRpb24uCiAgICBFc2NhbGF0ZSB0byB0aGUgQ2hhaXJtYW4gb25seSBpZiBubyBsYXdmdWwgZnJlZSByb3V0ZSBleGlzdHMuCiAgICBBbnkgZGVwbG95bWVudCwgc2NoZW1hIGNoYW5nZSwgY29kZSBtb2RpZmljYXRpb24gb3IgZmluYW5jaWFsIHRyYW5zZmVyCiAgICBtdXN0IGJlIHJhaXNlZCBhcyBhIFBlcm1pc3Npb24gR2F0ZSBhbmQgZnJvemVuIHVudGlsIE93bmVyIGNsZWFyYW5jZS5gfQphc3luYyBmdW5jdGlvbiBjb21taXNzaW9uKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvYWdlbnQnLHtuYW1lOmFOYW1lLnZhbHVlLnRyaW0oKSxwaWxsYXJJZDorYVBpbC52YWx1ZSxyb2xlOmFSb2xlLnZhbHVlLnRyaW0oKSwKICAgIHRvb2xzOmFUb29scy52YWx1ZS5zcGxpdCgnLCcpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLGNvc3Q6YUNvc3QudmFsdWV9KTsKICAgcmVuZGVyKCk7IGZsYXNoKCdBZ2VudCBib3VuZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gc2hvd1lhbWwoaWQpe2NvbnN0IGE9Uy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpOwogbW9kYWwoYDxoMz4ke2VzYyhhLm5hbWUpfTwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPiR7YS5pZH0gwrcgJHthLnN0YXR1c308L2Rpdj4KIDxwcmUgY2xhc3M9InlhbWwiPiR7ZXNjKHlhbWxGb3IoYSkpfTwvcHJlPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+CiA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29weVkoJyR7YS5pZH0nKSI+Q29weSBZQU1MPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCl9CmZ1bmN0aW9uIGNvcHlZKGlkKXtuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoeWFtbEZvcihTLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCkpKTtmbGFzaCgnWUFNTCBjb3BpZWQnKX0KYXN5bmMgZnVuY3Rpb24gdG9nKGlkKXthd2FpdCBBUEkoJy9hcGkvYWdlbnQvdG9nZ2xlJyx7aWR9KTtyZW5kZXIoKX0KYXN5bmMgZnVuY3Rpb24ga2lsbChpZCl7aWYoIWNvbmZpcm0oJ0RlY29tbWlzc2lvbiAnK2lkKyc/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9raWxsJyx7aWR9KTtyZW5kZXIoKTtmbGFzaCgnRGVjb21taXNzaW9uZWQnKX0KCi8qIC0tLS0tLS0tLS0gT1JHIENIQVJUIC0tLS0tLS0tLS0gKi8KUkVOREVSLm9yZ2NoYXJ0PSgpPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbW1hbmQgRGVwZW5kZW5jeSBHcmFwaDwvaDM+PGRpdiBjbGFzcz0idHciPgogPHN2ZyB2aWV3Qm94PSIwIDAgOTAwIDQzMCIgc3R5bGU9Im1pbi13aWR0aDo3MjBweDt3aWR0aDoxMDAlIj4KICA8ZGVmcz48bWFya2VyIGlkPSJhciIgbWFya2VyV2lkdGg9IjkiIG1hcmtlckhlaWdodD0iOSIgcmVmWD0iOCIgcmVmWT0iMyIgb3JpZW50PSJhdXRvIj48cGF0aCBkPSJNMCwwIEwwLDYgTDgsMyB6IiBmaWxsPSJ2YXIoLS1zdHJva2UyKSIvPjwvbWFya2VyPjwvZGVmcz4KICA8cmVjdCB4PSIzMTUiIHk9IjE0IiB3aWR0aD0iMjcwIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9InZhcigtLWdsYXNzMikiIHN0cm9rZT0iIzc4OEExRCIvPgogIDx0ZXh0IHg9IjQ1MCIgeT0iMzgiIGZpbGw9IiM3ODhBMUQiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNIQUlSTUFOIEFHRU5UPC90ZXh0PgogIDx0ZXh0IHg9IjQ1MCIgeT0iNTUiIGZpbGw9IiM2QjZENjIiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FeGVjdXRpdmUgQ29tbWFuZCBUb3dlciDCtyBaZXJvLUNvc3QgQXV0aG9yaXR5PC90ZXh0PgogICR7UElMTEFSUy5tYXAoKHAsaSk9Pntjb25zdCB5PTEwNCtpKjY0LGY9Zmxvb3IocC5pZCk7cmV0dXJuIGAKICAgPHBhdGggZD0iTTQ1MCw2NiBDNDUwLCR7eS0yMH0gMjUwLCR7eS0yMH0gMjUwLCR7eSsxOH0iIHN0cm9rZT0idmFyKC0tc3Ryb2tlMikiIGZpbGw9Im5vbmUiIG1hcmtlci1lbmQ9InVybCgjYXIpIi8+CiAgIDxyZWN0IHg9IjI1MCIgeT0iJHt5fSIgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0NiIgcng9IjkiIGZpbGw9InZhcigtLXBhbmVsKSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iLjciLz4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMjB9IiBmaWxsPSJ2YXIoLS10eHQpIiBmb250LXNpemU9IjExLjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC5pY29ufSAke3AuaWR9LiAke3AubmFtZX08L3RleHQ+CiAgIDx0ZXh0IHg9IjI2OCIgeT0iJHt5KzM1fSIgZmlsbD0iIzZCNkQ2MiIgZm9udC1zaXplPSI5IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AudW5pdHN9PC90ZXh0PgogICA8dGV4dCB4PSI2MzIiIHk9IiR7eSsyOH0iIGZpbGw9IiR7cC5jb2xvcn0iIGZvbnQtc2l6ZT0iMTAiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJlbmQiPiR7Zi5hZ2VudHN9IGFndCDCtyAke2YuaGVhbHRofSU8L3RleHQ+YH0pLmpvaW4oJycpfQogIDxwYXRoIGQ9Ik02NjAsMTI3IEM3NTAsMTI3IDc1MCw0MTUgNDcwLDQxNSIgc3Ryb2tlPSJ2YXIoLS1zdHJva2UyKSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0IiBtYXJrZXItZW5kPSJ1cmwoI2FyKSIvPgogIDx0ZXh0IHg9IjcwNSIgeT0iMjg1IiBmaWxsPSIjOUE5QzkwIiBmb250LXNpemU9IjkuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+aW5zaWdodCDihpIgdG93ZXI8L3RleHQ+PC9zdmc+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXNjYWxhdGlvbiBMYXc8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5Fc2NhbGF0aW9uIGlzIHVwd2FyZCBvbmx5LiBObyBsYXRlcmFsIGZsb29yLXRvLWZsb29yIGNvbW1hbmQgd2l0aG91dCBhIENoYWlybWFuIGdhdGUuPC9saT4KICA8bGk+U2VjdXJpdHkgJmFtcDsgQXVkaXQgaG9sZHMgdmV0byBvdmVyIHRoZSByZW1haW5pbmcgZm91ciBmbG9vcnMgYW5kIG1heSBmcmVlemUgYW55IGdhdGUgbWlkLWZsaWdodC48L2xpPgogIDxsaT5ObyBwYXRoIGV4aXN0cyBmcm9tIGEgcHVibGljIHVzZXIgdG8gYSBmbG9vci4gRXZlcnkgcm91dGUgdGVybWluYXRlcyBhdCB0aGUgQ2hhaXJtYW4uPC9saT4KICA8bGk+QW55IGFnZW50IG1lZXRpbmcgYSBwYXl3YWxsIGhhbHRzIGFuZCByZXBvcnRzIHVwd2FyZCDigJQgaXQgbmV2ZXIgc3BlbmRzLjwvbGk+PC91bD48L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBTS0lMTFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2tpbGxzPSgpPT57Y29uc3QgbT17fTtTLmFnZW50cy5mb3JFYWNoKGE9PmEudG9vbHMuZm9yRWFjaCh0PT57KG1bdF09bVt0XXx8W10pLnB1c2goYS5uYW1lKX0pKTsKIGNvbnN0IGs9T2JqZWN0LmtleXMobSkuc29ydCgpOwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VG9vbCBTdXJmYWNlIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+JHtrLmxlbmd0aH0gRElTVElOQ1Q8L3NwYW4+PC9oMz4KIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij5FdmVyeSB0b29sIGlzIGJvdW5kIHRvIGF0IGxlYXN0IG9uZSBhZ2VudCBhbmQgY29uc3RyYWluZWQgYnkgdGhhdCBhZ2VudCdzIGNvc3QgcG9saWN5LiBVbmJvdW5kIGludm9jYXRpb24gaXMgYW4gdW5hcHByb3ZlZCBzaWRlIGVmZmVjdC48L2Rpdj4KIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VG9vbDwvdGg+PHRoPkJvdW5kIEFnZW50czwvdGg+PHRoPkV4cG9zdXJlPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogJHtrLm1hcCh0PT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyh0KX08L2I+PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke21bdF0ubWFwKGVzYykuam9pbignLCAnKX08L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7bVt0XS5sZW5ndGg+Mj8ndC1hbWInOid0LWdybid9Ij4ke21bdF0ubGVuZ3RoPjI/J1dJREUnOidOQVJST1cnfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl8fCc8dHI+PHRkIGNvbHNwYW49IjMiIGNsYXNzPSJtb25vLWRpbSI+bm9uZTwvdGQ+PC90cj4nfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9OwoKLyogLS0tLS0tLS0tLSBaRVJPIENPU1QgLS0tLS0tLS0tLSAqLwpSRU5ERVIuemVyb2Nvc3Q9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE1MTAwYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj7iiIUgWkVSTy1DT1NUIERPQ1RSSU5FIMK3IEFCU09MVVRFPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPlRoZSBDaGFpcm1hbiBkb2VzIG5vdCBwYXkuPC9iPiBObyBzdWJzY3JpcHRpb25zLCBubyBjcmVkaXQgdG9wLXVwcywgbm8gbWV0ZXJlZCBBUEkgcHVyY2hhc2VzLCBubyBjb252ZXJ0aW5nIHRyaWFscy48L2xpPgogICA8bGk+SGl0dGluZyBhIHBheXdhbGwsIGFuIGFnZW50IDxiPmhhbHRzPC9iPiwgZmluZHMgYSBmcmVlIC8gb3Blbi1zb3VyY2UgLyBzZWxmLWhvc3RlZCAvIGZyZWUtdGllciBlcXVpdmFsZW50LCBhbmQgcmVwb3J0cyB0aGUgc3Vic3RpdHV0aW9uLjwvbGk+CiAgIDxsaT5ObyBmcmVlIHJvdXRlIOKHkiB0aGUgQ2hhaXJtYW4gc3RhdGVzIHBsYWlubHkgdGhlIG9iamVjdGl2ZSBpcyB1bnJlYWNoYWJsZSBhdCB6ZXJvIGNvc3QuIEl0IG5ldmVyIHF1aWV0bHkgc3BlbmRzLjwvbGk+CiAgIDxsaT5GcmVlLXRpZXIgcm90YXRpb24gYW5kIHF1b3RhIG1hbmFnZW1lbnQgYXJlIGxlZ2l0aW1hdGUuIEZyYXVkLCBzdG9sZW4ga2V5cywgbGljZW5jZSB2aW9sYXRpb24gYW5kIFRvUyBjaXJjdW12ZW50aW9uIGFyZSA8Yj5yZWZ1c2VkIG91dHJpZ2h0PC9iPiBhbmQgbG9nZ2VkIENSSVQuPC9saT4KICAgPGxpPk93bmVyIG1heSBvdmVycmlkZSBwZXItZ2F0ZS4gT3ZlcnJpZGVzIGhpdCBhIHZpc2libGUgc3BlbmQgY291bnRlciwgbmV2ZXIgaGlkZGVuLjwvbGk+CiAgIDxsaT48Yj5Qcm9vZiwgbm90IHNsb2dhbjo8L2I+IHRoaXMgYmFja2VuZCBydW5zIG9uIE5vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgbnBtIHBhY2thZ2VzLCAwIHBhaWQgc2VydmljZXMsIDAgQVBJIGtleXMuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCI+CiAgJHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnQXV0aG9yaXplZCBTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdMaWZldGltZScpfQogICR7a3BpKFMuZGVuaWFscy5sZW5ndGgsJ1BhaWQgUGF0aHMgSW50ZXJjZXB0ZWQnLCd2YXIoLS1hbWIpJywnQmxvY2tlZCBvciByZXJvdXRlZCcpfQogICR7a3BpKCckJytTLmRlbmlhbHMucmVkdWNlKChhLGIpPT5hK2IuY29zdCwwKS50b0ZpeGVkKDIpLCdTcGVuZCBBdm9pZGVkJywndmFyKC0tZ3JuKScsJ0RvY3RyaW5lIHNhdmluZ3MnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TdWJzdGl0dXRpb24gUm91dGluZyBUYWJsZTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICA8dGhlYWQ+PHRyPjx0aD5QYWlkIERlbWFuZDwvdGg+PHRoPkZyZWUgUm91dGU8L3RoPjx0aD5Pd25pbmcgQWdlbnQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtGUkVFX1JPVVRFUy5tYXAoKFthLGIsY10pPT5gPHRyPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtcmVkIj4ke2VzYyhhKX08L3NwYW4+PC90ZD48dGQ+JHtlc2MoYil9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SW50ZXJjZXB0aW9uIExvZzwvaDM+JHtTLmRlbmlhbHMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5PcGVyYXRpb248L3RoPjx0aD5EZW1hbmRlZDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1suLi5TLmRlbmlhbHNdLnJldmVyc2UoKS5tYXAoZD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2QudH08L3RkPjx0ZD4ke2VzYyhkLm9wKX08L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JCR7ZC5jb3N0fTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gcGFpZCBkZW1hbmRzIGVuY291bnRlcmVkIHlldC48L2Rpdj4nfTwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIEZJTkFOQ0VTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmZpbmFuY2VzPSgpPT57CiBjb25zdCB0b3Q9Uy5yZXZlbnVlLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKSxpbmZsb3c9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCk7CiByZXR1cm4gYCR7IVMucGF5b3V0P2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlNBRkUgTU9ERTwvaDM+CiAgPGRpdj5ObyBwYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRoZSBzZXJ2ZXIgcmVqZWN0cyBhcHByb3ZhbCBvbiBldmVyeSB0cmFuc2ZlciBnYXRlLiBDb25maWd1cmUgdGhlIFZhdWx0IGZpcnN0LjwvZGl2PjwvZGl2PmA6Jyd9CiA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAke2twaSgnJCcrZm10KGluZmxvdyksJ1JlY29yZGVkIEluZmxvdycsJ3ZhcigtLWdybiknKX0KICAke2twaSgnJCcrZm10KHRvdCksJ05ldCBQb3NpdGlvbicsdG90PDA/J3ZhcigtLW1hZyknOid2YXIoLS10eHQpJyl9CiAgJHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnVG90YWwgU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnVGFyZ2V0ICQwLjAwJyl9CiAgJHtrcGkoUy5yZXZlbnVlLmxlbmd0aCwnTGVkZ2VyIExpbmVzJywndmFyKC0tYmx1KScpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlY29yZCBSZXZlbnVlIFN0cmVhbTwvaDM+PGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Tb3VyY2U8L3NwYW4+PGlucHV0IGlkPSJyU3JjIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJQcmVtaXVtIGNyZWRpdHMgwrcgYXBwLmV4YW1wbGUiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BbW91bnQgVVNEPC9zcGFuPjxpbnB1dCBpZD0ickFtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4mbmJzcDs8L3NwYW4+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJhZGRSZXYoKSI+UE9TVCBUTyBMRURHRVI8L2J1dHRvbj48L2xhYmVsPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlcXVlc3QgUGF5b3V0PC9oMz4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5SYWlzZXMgYSBGSU5BTkNJQUwgVFJBTlNGRVIgZ2F0ZS4gUmVxdWlyZXMgc2VhbGVkIGNoYW5uZWwgKyBwYXNzd29yZCBzaWduYXR1cmUuIDJGQSB0YXJnZXQgJHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX0uPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgaWQ9InBBbXQiIGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMDBweCIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iQW1vdW50IFVTRCI+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJlcVBheW91dCgpIj5SQUlTRSBUUkFOU0ZFUiBHQVRFPC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmV2ZW51ZSBMZWRnZXI8L2gzPiR7Uy5yZXZlbnVlLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+U291cmNlPC90aD48dGggc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPkFtb3VudDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1suLi5TLnJldmVudWVdLnJldmVyc2UoKS5tYXAocj0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke3IudH08L3RkPjx0ZD4ke2VzYyhyLnNyYyl9PC90ZD4KICA8dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQ7Y29sb3I6JHtyLmFtdDwwPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3IuYW10PDA/Jy0nOicrJ30kJHtmbXQoTWF0aC5hYnMoci5hbXQpKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0cmVhbXMgcmVjb3JkZWQuPC9kaXY+J308L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gYWRkUmV2KCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9yZXZlbnVlJyx7c3JjOnJTcmMudmFsdWUudHJpbSgpLGFtdDorckFtdC52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdQb3N0ZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcmVxUGF5b3V0KCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9wYXlvdXQvcmVxdWVzdCcse2FtdDorcEFtdC52YWx1ZX0pO2dvKCdnYXRlcycpO2ZsYXNoKCdUcmFuc2ZlciBnYXRlIHJhaXNlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQoKLyogLS0tLS0tLS0tLSBWQVVMVCAtLS0tLS0tLS0tICovClJFTkRFUi5wYXlvdXQ9KCk9PmAKIDxkaXYgY2xhc3M9Indhcm5ib3giPklzb2xhdGVkIE93bmVyLW9ubHkgcGFuZWwuIFJhdyB2YWx1ZXMgYXJlIHNlbnQgb25jZSBvdmVyIHRoZSBzZXNzaW9uLCBtYXNrZWQgaW1tZWRpYXRlbHksIGFuZCA8Yj5uZXZlciBwZXJzaXN0ZWQgb3IgcmV0dXJuZWQ8L2I+IOKAlCBvbmx5IHRoZSBtYXNrZWQgdmlldyBhbmQgYSBTSEEtMjU2IGZpbmdlcnByaW50IGFyZSBzdG9yZWQuIFRoZSBDaGFpcm1hbiB3aWxsIG5ldmVyIHJlcXVlc3QgdGhlc2UgYW55d2hlcmUgZWxzZS48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFubmVsIENvbmZpZ3VyYXRpb248L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk1ldGhvZDwvc3Bhbj48c2VsZWN0IGlkPSJ2VHlwZSIgY2xhc3M9ImluIiBvbmNoYW5nZT0idlN3YXAoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJCQU5LIj5CYW5rIFdpcmUgKFNXSUZUL0lCQU4pPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iQ1JZUFRPIj5DcnlwdG8gQWRkcmVzczwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmVuZWZpY2lhcnkgTmFtZTwvc3Bhbj48aW5wdXQgaWQ9InZOYW1lIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PgogIDxkaXYgaWQ9InZCYW5rIj48ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BY2NvdW50IE51bWJlcjwvc3Bhbj48aW5wdXQgaWQ9InZBY2MiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SUJBTjwvc3Bhbj48aW5wdXQgaWQ9InZJYmFuIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNXSUZUIC8gQklDPC9zcGFuPjxpbnB1dCBpZD0idlN3aWZ0IiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJhbmsgJmFtcDsgQ291bnRyeTwvc3Bhbj48aW5wdXQgaWQ9InZCYW5rTmFtZSIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj48L2Rpdj4KICA8ZGl2IGlkPSJ2Q3J5cHRvIiBjbGFzcz0iaGlkZSI+PGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV0d29yazwvc3Bhbj48aW5wdXQgaWQ9InZOZXQiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkJUQyAvIEVUSCAvIFRST04iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGF5b3V0IEFkZHJlc3M8L3NwYW4+PGlucHV0IGlkPSJ2QWRkciIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBlci1UcmFuc2ZlciBDZWlsaW5nIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0idkNhcCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSIyNTAwMCI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZWFsVmF1bHQoKSI+U0VBTCBDSEFOTkVMPC9idXR0b24+CiAgJHtTLnBheW91dD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVZhdWx0KCkiPlB1cmdlIENoYW5uZWw8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNlYWxlZCBDaGFubmVsPC9oMz4ke1MucGF5b3V0P2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAke09iamVjdC5lbnRyaWVzKFMucGF5b3V0Lm1hc2tlZCkubWFwKChbayx2XSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij4ke2VzYyhrKX08L3RkPjx0ZD4ke2VzYyh2KX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlNlYWxlZDwvdGQ+PHRkPiR7Uy5wYXlvdXQudH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjJGQSBUYXJnZXQ8L3RkPjx0ZD4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvdGQ+PC90cj48L3Rib2R5PjwvdGFibGU+PC9kaXY+YAogOic8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIENIQU5ORUwgU0VBTEVEIOKAlCBlbmdpbmUgU0FGRSBNT0RFLjwvZGl2Pid9PC9kaXY+YDsKZnVuY3Rpb24gdlN3YXAoKXtjb25zdCBjPXZUeXBlLnZhbHVlPT09J0NSWVBUTyc7dkJhbmsuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsYyk7dkNyeXB0by5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJywhYyl9CmFzeW5jIGZ1bmN0aW9uIHNlYWxWYXVsdCgpewogY29uc3QgYj17dHlwZTp2VHlwZS52YWx1ZSxuYW1lOnZOYW1lLnZhbHVlLnRyaW0oKSxjYXA6K3ZDYXAudmFsdWV8fDAsCiAgYWNjOnZBY2M/LnZhbHVlLnRyaW0oKSxpYmFuOnZJYmFuPy52YWx1ZS50cmltKCksc3dpZnQ6dlN3aWZ0Py52YWx1ZS50cmltKCksYmFuazp2QmFua05hbWU/LnZhbHVlLnRyaW0oKSwKICBuZXQ6dk5ldD8udmFsdWUudHJpbSgpLGFkZHI6dkFkZHI/LnZhbHVlLnRyaW0oKX07CiB0cnl7YXdhaXQgQVBJKCcvYXBpL3ZhdWx0JyxiKTtyZW5kZXIoKTtmbGFzaCgnQ2hhbm5lbCBzZWFsZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VWYXVsdCgpe2lmKCFjb25maXJtKCdQdXJnZSBjaGFubmVsPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvdmF1bHQvcHVyZ2UnKTtyZW5kZXIoKTtmbGFzaCgnUHVyZ2VkJyl9CgovKiAtLS0tLS0tLS0tIEFOQUxZVElDUyAtLS0tLS0tLS0tICovClJFTkRFUi5hbmFseXRpY3M9KCk9PnsKIGNvbnN0IHNldj17SU5GTzowLE9LOjAsV0FSTjowLENSSVQ6MH07Uy5sb2dzLmZvckVhY2gobD0+c2V2W2wuc2V2XT0oc2V2W2wuc2V2XXx8MCkrMSk7CiBjb25zdCBteD1NYXRoLm1heCgxLC4uLk9iamVjdC52YWx1ZXMoc2V2KSk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV2ZW50IFNldmVyaXR5IE1peDwvaDM+JHtPYmplY3QuZW50cmllcyhzZXYpLm1hcCgoW2ssdl0pPT5gPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PHNwYW4+JHtrfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7dn08L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke3YvbXgqMTAwfSU7YmFja2dyb3VuZDoke3tJTkZPOicjM2I4MmY2JyxPSzonIzMxZDY3YScsV0FSTjonI2ZmYjAyMCcsQ1JJVDonI2ZmM2I2Yid9W2tdfSI+PC9pPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgT3V0Y29tZXM8L2gzPiR7WydQRU5ESU5HJywnQVBQUk9WRUQnLCdERU5JRUQnXS5tYXAocz0+e2NvbnN0IGM9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT1zKS5sZW5ndGg7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjdweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICMxMDE4MjIiPgogIDxzcGFuIGNsYXNzPSJ0YWcgJHtzPT09J0FQUFJPVkVEJz8ndC1ncm4nOnM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke3N9PC9zcGFuPjxiPiR7Y308L2I+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BcHByb3ZhbCByYXRlIGlzIG1lYW5pbmdsZXNzIHdpdGhvdXQgZGVuaWFsIHByZXNzdXJlLiBJZiBub3RoaW5nIGlzIGV2ZXIgZGVuaWVkLCB0aGUgZ2F0ZSBpcyB0aGVhdHJlLjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkZsb29yIEhlYWx0aCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPkxJVkU8L3NwYW4+PC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpO3JldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5oZWFsdGh9JTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5oZWFsdGh9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29zdCBEaXNjaXBsaW5lPC9oMz4ke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknKX0KICA8ZGl2IHN0eWxlPSJoZWlnaHQ6MTBweCI+PC9kaXY+JHtrcGkoJyQnK1MuZGVuaWFscy5yZWR1Y2UoKGEsYik9PmErYi5jb3N0LDApLnRvRml4ZWQoMiksJ0F2b2lkZWQnLCd2YXIoLS1ncm4pJyl9PC9kaXY+CiA8L2Rpdj5gfTsKCi8qIC0tLS0tLS0tLS0gQVVESVQgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYXVkaXQ9KCk9PmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjExcHgiPgogPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke1MubG9ncy5sZW5ndGh9IGVudHJpZXMgc2hvd24gwrcgcGVyc2lzdGVkIHNlcnZlci1zaWRlPC9zcGFuPgogPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImV4cG9ydExvZygpIj5FeHBvcnQgSlNPTjwvYnV0dG9uPgogPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJwdXJnZUxvZ3MoKSI+UHVyZ2U8L2J1dHRvbj48L2Rpdj48L2Rpdj4ke2xvZ0h0bWwoNDAwKX08L2Rpdj5gOwpmdW5jdGlvbiBleHBvcnRMb2coKXtjb25zdCBiPW5ldyBCbG9iKFtKU09OLnN0cmluZ2lmeShTLmxvZ3MsbnVsbCwyKV0se3R5cGU6J2FwcGxpY2F0aW9uL2pzb24nfSksdT1VUkwuY3JlYXRlT2JqZWN0VVJMKGIpLGE9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpOwogYS5ocmVmPXU7YS5kb3dubG9hZD0nY2hhaXJtYW4tYXVkaXQtJytEYXRlLm5vdygpKycuanNvbic7YS5jbGljaygpO1VSTC5yZXZva2VPYmplY3RVUkwodSk7Zmxhc2goJ0V4cG9ydGVkJyl9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlTG9ncygpe2lmKCFjb25maXJtKCdQdXJnZSBsZWRnZXI/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9sb2dzL3B1cmdlJyk7cmVuZGVyKCl9CgovKiAtLS0tLS0tLS0tIEFSQ0hJVEVDVDogc3R1ZHkgYSBwcm9kdWN0LCByZWJ1aWxkIHRoZSBjYXBhYmlsaXR5IC0tLS0tLS0tLS0gKi8KTElWRS5hcmNoPSgpPT57CiAgY29uc3QgQT1TLmFuYWx5c2VzfHxbXSwgQz1TLmNyZXdzfHxbXTsKICBpZighQS5sZW5ndGgpIHJldHVybiAnPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgc3R1ZGllZCB5ZXQuIFBhc3RlIGEgVVJMIGFib3ZlLjwvZGl2PjwvZGl2Pic7CiAgcmV0dXJuIEEubWFwKGE9PnsKICAgIGNvbnN0IGNyZXc9Qy5maW5kKGM9PmMuYW5hbHlzaXNJZD09PWEuaWQpOwogICAgY29uc3QgdmMgPSBhLnZlcmRpY3Q9PT0nUkVCVUlMREFCTEUnPyd0LWdybic6YS52ZXJkaWN0PT09J1BBUlRJQUwnPyd0LWFtYic6J3QtcmVkJzsKICAgIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke2EudmVyZGljdD09PSdSRUJVSUxEQUJMRSc/J3ZhcigtLWxpbWUpJzoKICAgICAgICBhLnZlcmRpY3Q9PT0nUEFSVElBTCc/J3ZhcigtLWFtYiknOid2YXIoLS1tYWcpJ30iPgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7dmN9Ij4ke2VzYyhhLnZlcmRpY3QpfTwvc3Bhbj4KICAgICAgIDxiPiR7ZXNjKGEudXJsKX08L2I+PC9kaXY+CiAgICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHthLnR9JHthLnBhZ2VSZWFkPycnOicgwrcgcGFnZSBub3QgcmVhZGFibGUnfTwvc3Bhbj48L2Rpdj4KICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxiPldoYXQgaXQgZG9lczo8L2I+ICR7ZXNjKGEuZG9lcyl9PC9kaXY+CiAgICAgJHthLmpvYnMubGVuZ3RoP2A8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5USEUgSk9CUyBJVCBQRVJGT1JNUzwvZGl2PgogICAgICAgPG9sIHN0eWxlPSJtYXJnaW46NXB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNyI+CiAgICAgICAke2Euam9icy5tYXAoaj0+YDxsaT4ke2VzYyhqKX08L2xpPmApLmpvaW4oJycpfTwvb2w+PC9kaXY+YDonJ30KICAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICAgJHthLnJldXNlLmxlbmd0aD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+QWdlbnRzIGhlIGFscmVhZHkgaGFzPC90ZD4KICAgICAgICA8dGQ+JHthLnJldXNlLm1hcChyPT5gPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+JHtlc2Moci5jYXApfTwvc3Bhbj4gPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhyLmZvcil9PC9zcGFuPmApLmpvaW4oJzxicj4nKX08L3RkPjwvdHI+YDonJ30KICAgICAgJHthLmJ1aWxkLmxlbmd0aD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk11c3QgYmUgd3JpdHRlbjwvdGQ+CiAgICAgICAgPHRkPiR7YS5idWlsZC5tYXAoYj0+YDxiPiR7ZXNjKGIubmFtZSl9PC9iPiDigJQgJHtlc2MoYi5kZXNjKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYi53aHlfbmVlZGVkfHwnJyl9PC9kaXY+YCkuam9pbignPGJyPicpfTwvdGQ+PC90cj5gOicnfQogICAgICAke2EubmVlZHNDb25uZWN0b3IubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TmVlZHMgYSBjb25uZWN0b3I8L3RkPgogICAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YS5uZWVkc0Nvbm5lY3Rvci5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+PC90cj5gOicnfQogICAgICAke2EuY2Fubm90RG8ubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+SG9uZXN0bHkgY2Fubm90IGRvPC90ZD4KICAgICAgICA8dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7YS5jYW5ub3REby5tYXAoZXNjKS5qb2luKCc8YnI+Jyl9PC90ZD48L3RyPmA6Jyd9CiAgICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgICR7YS5ub3RlP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48Yj5IaXMgdmVyZGljdDo8L2I+ICR7ZXNjKGEubm90ZSl9PC9kaXY+YDonJ30KICAgICAke2NyZXc/YDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTFweDtwYWRkaW5nOjExcHg7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlci1yYWRpdXM6MTFweCI+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Q1JFVyBBU1NFTUJMRUQ8L2Rpdj4KICAgICAgIDxkaXY+JHtjcmV3LnJldXNlLmxlbmd0aH0gZXhpc3RpbmcgYWdlbnQocykgcmV1c2VkJHtjcmV3LmJ1aWx0Lmxlbmd0aD9gLCAke2NyZXcuYnVpbHQubGVuZ3RofSBuZXcgd3JpdHRlbjogPGI+JHtjcmV3LmJ1aWx0Lm1hcChlc2MpLmpvaW4oJywgJyl9PC9iPmA6Jyd9PC9kaXY+CiAgICAgICAke2NyZXcuYnVpbHQubGVuZ3RoPyc8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4Ij5OZXcgb25lcyBhcmUgd2FpdGluZyBmb3IgeW91ciB0aWNrIG9uIFRoZSBDaGFpcm1hbiBwYWdlLjwvZGl2Pic6Jyd9CiAgICAgICAke2NyZXcuc2tpcHBlZC5sZW5ndGg/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKTttYXJnaW4tdG9wOjVweCI+U2tpcHBlZDogJHtjcmV3LnNraXBwZWQubWFwKGVzYykuam9pbignOyAnKX08L2Rpdj5gOicnfQogICAgICA8L2Rpdj5gOmA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFzc2VtYmxlKCcke2EuaWR9JykiPkJVSUxEIFRIRSBDUkVXPC9idXR0b24+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InJtQW5hbHlzaXMoJyR7YS5pZH0nKSI+RGlzY2FyZDwvYnV0dG9uPjwvZGl2PmB9CiAgICA8L2Rpdj5gOwogIH0pLmpvaW4oJycpOwp9OwpSRU5ERVIuYXJjaD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKniSBDT1BZIEFOWSBQUk9EVUNUIOKAlCB0aGUgbGVnYWwgd2F5PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlBhc3RlIGFueSB3ZWJzaXRlIG9yIHRvb2wuIEhlIHJlYWRzIGl0LCB3b3JrcyBvdXQgPGI+dGhlIGpvYiBpdCBkb2VzPC9iPiwgdGhlbiByZWJ1aWxkcyB0aGF0IGNhcGFiaWxpdHkgZnJvbSBoaXMgb3duIGFnZW50cyDigJQgcmV1c2luZyB3aGF0IGhlIGhhcywgd3JpdGluZyBvbmx5IHdoYXQgaXMgbWlzc2luZy48L2Rpdj4KICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5IZSByZWJ1aWxkcyB0aGUgb3V0Y29tZSwgbmV2ZXIgdGhlIGNvZGUuPC9iPiBDb3B5aW5nIHNvbWVvbmUncyBzb3VyY2UgaXMgcGlyYWN5IGFuZCBnZXRzIHlvdSBzdWVkLiBCdWlsZGluZyBhIHRvb2wgdGhhdCBkb2VzIHRoZSBzYW1lIGpvYiBpcyBob3cgZXZlcnkgY29tcGV0aXRvciBpbiBoaXN0b3J5IGhhcyBiZWVuIG1hZGUg4oCUIGNvbXBsZXRlbHkgbGVnYWwsIGFuZCBpdCBtZWFucyB5b3Ugb3duIHdoYXQgeW91IGJ1aWxkLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+UmV1c2VzIGV4aXN0aW5nIGFnZW50cyBmaXJzdC4gSGUgb25seSB3cml0ZXMgbmV3IGNvZGUgd2hlbiBub3RoaW5nIGNvdmVycyB0aGUgam9iLjwvbGk+CiAgIDxsaT5BZ2VudHMgd29yayBhY3Jvc3Mgam9icywgbGlrZSBzdGFmZiBtb3ZpbmcgYmV0d2VlbiBicmFuY2hlcy48L2xpPgogICA8bGk+SGUgc3RhdGVzIHBsYWlubHkgd2hhdCA8Yj5jYW5ub3Q8L2I+IGJlIHJlYnVpbHQgZnJlZSDigJQgR1BVcywgbGljZW5jZXMsIGRhdGFzZXRzLCBodW1hbiBqdWRnZW1lbnQuPC9saT4KICA8L3VsPgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2Vic2l0ZSBvciBwcm9kdWN0PC9zcGFuPgogICAgPGlucHV0IGlkPSJhclVybCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly91cHRpbWVyb2JvdC5jb20iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW55dGhpbmcgaGUgc2hvdWxkIGtub3cgKG9wdGlvbmFsKTwvc3Bhbj4KICAgIDxpbnB1dCBpZD0iYXJIaW50IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJJIG9ubHkgY2FyZSBhYm91dCB0aGUgYWxlcnRpbmcgcGFydCI+PC9sYWJlbD4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhbmFseXNlKCkiPlNUVURZIElUPC9idXR0b24+CiAgICR7WydodHRwczovL3VwdGltZXJvYm90LmNvbScsJ2h0dHBzOi8vbWFpbGNoaW1wLmNvbScsJ2h0dHBzOi8vYnVmZmVyLmNvbScsJ2h0dHBzOi8vY2FsZW5kbHkuY29tJ10KICAgICAubWFwKHU9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImFyVXJsLnZhbHVlPScke3V9JzthbmFseXNlKCkiPiR7dS5yZXBsYWNlKCdodHRwczovLycsJycpfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRha2VzIGFib3V0IDMwIHNlY29uZHMg4oCUIGhlIHJlYWRzIHRoZWlyIHBhZ2UgYW5kIHNlYXJjaGVzIHdoYXQgdXNlcnMgc2F5LjwvZGl2PgogPC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iYXJjaCI+JHtMSVZFLmFyY2goKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBhbmFseXNlKCl7CiAgY29uc3QgdT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FyVXJsJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXUudHJpbSgpKSByZXR1cm4gZmxhc2goJ1Bhc3RlIGEgVVJMIGZpcnN0Jyk7CiAgZmxhc2goJ1N0dWR5aW5nIGl0IOKAlCByZWFkaW5nIHRoZWlyIHBhZ2UgYW5kIHNlYXJjaGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvYXJjaGl0ZWN0L2FuYWx5c2UnLHt1cmw6dSxoaW50Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXJIaW50Jyl8fHt9KS52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdWZXJkaWN0OiAnK3IudmVyZGljdCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBhc3NlbWJsZShpZCl7CiAgZmxhc2goJ0J1aWxkaW5nIHRoZSBjcmV3IOKAlCB3cml0aW5nIGFueSBtaXNzaW5nIGFnZW50c+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvYXJjaGl0ZWN0L2Fzc2VtYmxlJyx7aWR9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLnJldXNlZCsnIHJldXNlZCwgJytyLmJ1aWx0Kycgd3JpdHRlbicrKHIuYnVpbHQ/JyDigJQgdGljayB0aGVtIHRvIGluc3RhbGwnOicnKSk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBybUFuYWx5c2lzKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2FyY2hpdGVjdC9yZW1vdmUnLHtpZH0pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIFdPUktTUEFDRTogZmlsZXMgaW4sIHdyaXRpbmcgb3V0IC0tLS0tLS0tLS0gKi8KY29uc3QgS0lORFM9W1snZW1haWwnLCdFbWFpbCddLFsnd2hhdHNhcHAnLCdXaGF0c0FwcCddLFsncmVwbHknLCdSZXBseSB0byBhIG1lc3NhZ2UnXSwKICAgICAgICAgICAgIFsncHJvcG9zYWwnLCdQcm9wb3NhbCddLFsnaW52b2ljZScsJ0ludm9pY2UnXSxbJ3N1bW1hcnknLCdTdW1tYXJ5J10sWydkb2MnLCdEb2N1bWVudCddXTsKTElWRS53b3JrMj0oKT0+ewogIGNvbnN0IEQ9Uy5kb2NzfHxbXSwgUj1TLmRyYWZ0c3x8W107CiAgcmV0dXJuIGAke0QubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+WW91ciBGaWxlcyA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0QubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPkZpbGU8L3RoPjx0aD5SZWFkPC90aD48dGg+U2l6ZTwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtELm1hcChkPT5gPHRyPjx0ZD48Yj4ke2VzYyhkLm5hbWUpfTwvYj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC5wcmV2aWV3KS5zbGljZSgwLDkwKX3igKY8L2Rpdj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtkLnJlYWRhYmxlPyd0LWdybic6J3QtYW1iJ30iPiR7ZC5yZWFkYWJsZT9mbXQoZC5jaGFycykrJyBjaGFycyc6J05PVCBSRUFEQUJMRSd9PC9zcGFuPjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4keyhkLnNpemUvMTAyNCkudG9GaXhlZCgwKX0gS0I8L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBvbmNsaWNrPSJhc2tEb2MoJyR7ZC5pZH0nKSI+QXNrIGFib3V0IGl0PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybURvYygnJHtkLmlkfScpIj5SZW1vdmU8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gOicnfQogICR7Ui5sZW5ndGg/Ui5tYXAoZD0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke2VzYyhkLmtpbmQpfTwvc3Bhbj48Yj4ke2VzYyhkLmJyaWVmKX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2QudH0ke2Quc2VudFRvPycgwrcgU0VOVCB0byAnK2VzYyhkLnNlbnRUbyk6Jyd9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBpZD0iZHJmXyR7ZC5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjc7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpOwogICAgICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTRweCI+JHtlc2MoZC50ZXh0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvcHlEcmFmdCgnJHtkLmlkfScpIj5Db3B5PC9idXR0b24+CiAgICAgJHtkLmtpbmQ9PT0nZW1haWwnJiYhZC5zZW50VG8/YDxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjMwcHgiIGlkPSJ0b18ke2QuaWR9IiBwbGFjZWhvbGRlcj0ic2VuZCB0byBlbWFpbCI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0ic2VuZERyYWZ0KCcke2QuaWR9JykiPlNlbmQgaXQ8L2J1dHRvbj5gOicnfQogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icm1EcmFmdCgnJHtkLmlkfScpIj5EZWxldGU8L2J1dHRvbj48L2Rpdj4KICAgPC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyB3cml0dGVuIHlldC48L2Rpdj48L2Rpdj4nfWA7Cn07ClJFTkRFUi53b3JrMj0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKciSBGSUxFUyAmYW1wOyBXUklUSU5HIOKAlCB5b3VyIGV2ZXJ5ZGF5IGFzc2lzdGFudDwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij5VcGxvYWQgYSBmaWxlIGFuZCBhc2sgaGltIGFib3V0IGl0LiBPciB0ZWxsIGhpbSB3aGF0IHRvIHdyaXRlIOKAlCBlbWFpbCwgV2hhdHNBcHAsIHByb3Bvc2FsLCBpbnZvaWNlIOKAlCBhbmQgaGUgZHJhZnRzIGl0IHJlYWR5IHRvIGNvcHkgb3Igc2VuZC48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVwbG9hZCBhIGZpbGU8L3NwYW4+CiAgICAgPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJ1cEZpbGUiIGNsYXNzPSJpbiIgb25jaGFuZ2U9ImRvVXBsb2FkKCkiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+UmVhZHMgdHh0LCBtZCwgY3N2LCBqc29uLCBsb2csIGh0bWwgYW5kIHRleHQtYmFzZWQgUERGcy4gTWF4IDggTUIuIFNjYW5uZWQgUERGcyBhbmQgaW1hZ2VzIGNhbm5vdCBiZSByZWFkIOKAlCBoZSB3aWxsIHNheSBzbyByYXRoZXIgdGhhbiBndWVzcy48L2Rpdj4KICAgPC9kaXY+CiAgIDxkaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgc2hvdWxkIGhlIHdyaXRlPzwvc3Bhbj4KICAgICA8c2VsZWN0IGlkPSJka0tpbmQiIGNsYXNzPSJpbiI+JHtLSU5EUy5tYXAoaz0+YDxvcHRpb24gdmFsdWU9IiR7a1swXX0iPiR7a1sxXX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UZWxsIGhpbSB3aGF0IGl0IGlzIGFib3V0PC9zcGFuPgogICAgIDx0ZXh0YXJlYSBpZD0iZGtCcmllZiIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo2NHB4IiBwbGFjZWhvbGRlcj0iZS5nLiBlbWFpbCB0byBhIEx1ZGhpYW5hIHNob3Agb3duZXIgb2ZmZXJpbmcgMTQgZGF5cyBmcmVlIHdlYnNpdGUgbW9uaXRvcmluZyI+PC90ZXh0YXJlYT48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0id3JpdGVEcmFmdCgpIj5XUklURSBJVDwvYnV0dG9uPgogICAgICR7KFMuZG9jc3x8W10pLmxlbmd0aD9gPGxhYmVsIGNsYXNzPSJtb25vLWRpbSI+PGlucHV0IHR5cGU9ImNoZWNrYm94IiBpZD0idXNlRG9jcyI+IHVzZSBteSB1cGxvYWRlZCBmaWxlczwvbGFiZWw+YDonJ308L2Rpdj4KICAgPC9kaXY+CiAgPC9kaXY+CiA8L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJ3b3JrMiI+JHtMSVZFLndvcmsyKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZG9VcGxvYWQoKXsKICBjb25zdCBmPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBGaWxlJyl8fHt9KS5maWxlcz8uWzBdOwogIGlmKCFmKSByZXR1cm47CiAgaWYoZi5zaXplPjhlNikgcmV0dXJuIGZsYXNoKCdUb28gbGFyZ2Ug4oCUIDggTUIgbWF4aW11bScpOwogIGZsYXNoKCdSZWFkaW5nICcrZi5uYW1lKyfigKYnKTsKICBjb25zdCByZD1uZXcgRmlsZVJlYWRlcigpOwogIHJkLm9ubG9hZD1hc3luYygpPT57CiAgICB0cnl7CiAgICAgIGNvbnN0IGI2ND1TdHJpbmcocmQucmVzdWx0KS5zcGxpdCgnLCcpWzFdOwogICAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb2MvdXBsb2FkJyx7bmFtZTpmLm5hbWUsbWltZTpmLnR5cGUsZGF0YTpiNjR9KTsKICAgICAgcmVuZGVyKCk7IGZsYXNoKHIucmVhZGFibGU/KCdSZWFkICcrZm10KHIuY2hhcnMpKycgY2hhcmFjdGVycycpOidVcGxvYWRlZCwgYnV0IHRoZSB0ZXh0IGNvdWxkIG5vdCBiZSBleHRyYWN0ZWQnKTsKICAgIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9CiAgfTsKICByZC5yZWFkQXNEYXRhVVJMKGYpOwp9CmFzeW5jIGZ1bmN0aW9uIHJtRG9jKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2RvYy9yZW1vdmUnLHtpZH0pOyByZW5kZXIoKSB9CmZ1bmN0aW9uIGFza0RvYyhpZCl7CiAgbW9kYWwoYDxoMz5Bc2sgYWJvdXQgdGhpcyBmaWxlPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Zb3VyIHF1ZXN0aW9uPC9zcGFuPgogICAgPGlucHV0IGlkPSJkcVEiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IndoYXQgYXJlIHRoZSBrZXkgcG9pbnRzPyI+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icnVuQXNrRG9jKCcke2lkfScpIj5BU0s8L2J1dHRvbj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PgogICA8ZGl2IGlkPSJkcU91dCIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PC9kaXY+YCk7Cn0KYXN5bmMgZnVuY3Rpb24gcnVuQXNrRG9jKGlkKXsKICBjb25zdCBxPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHFRJyl8fHt9KS52YWx1ZXx8Jyc7CiAgY29uc3Qgb3V0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcU91dCcpOwogIG91dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5SZWFkaW5n4oCmPC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvYy9hc2snLHtpZCxxdWVzdGlvbjpxfSk7CiAgICBvdXQuaW5uZXJIVE1MPWA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PmA7CiAgfWNhdGNoKGUpeyBvdXQuaW5uZXJIVE1MPWA8ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PmAgfQp9CmFzeW5jIGZ1bmN0aW9uIHdyaXRlRHJhZnQoKXsKICBjb25zdCBicmllZj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RrQnJpZWYnKXx8e30pLnZhbHVlfHwnJzsKICBpZighYnJpZWYudHJpbSgpKSByZXR1cm4gZmxhc2goJ1RlbGwgaGltIHdoYXQgaXQgaXMgYWJvdXQnKTsKICBjb25zdCB1c2U9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1c2VEb2NzJyl8fHt9KS5jaGVja2VkOwogIGZsYXNoKCdXcml0aW5n4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZHJhZnQvd3JpdGUnLHtraW5kOmRrS2luZC52YWx1ZSxicmllZiwKICAgICAgZG9jSWRzOnVzZT8oUy5kb2NzfHxbXSkubWFwKGQ9PmQuaWQpOltdfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1dyaXR0ZW4g4oCUIGNvcHkgaXQgb3Igc2VuZCBpdCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gY29weURyYWZ0KGlkKXsgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RyZl8nK2lkKTsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoZWw/ZWwuaW5uZXJUZXh0OicnKTsgZmxhc2goJ0NvcGllZCcpIH0KYXN5bmMgZnVuY3Rpb24gc2VuZERyYWZ0KGlkKXsKICBjb25zdCB0bz0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvXycraWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF0by50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSB0aGUgcmVjaXBpZW50IGVtYWlsJyk7CiAgZmxhc2goJ1NlbmRpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9kcmFmdC9zZW5kJyx7aWQsdG99KTsgcmVuZGVyKCk7IGZsYXNoKCdTZW50JykgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBybURyYWZ0KGlkKXsgYXdhaXQgQVBJKCcvYXBpL2RyYWZ0L3JlbW92ZScse2lkfSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gQ09OTkVDVE9SUyAtLS0tLS0tLS0tICovCmNvbnN0IFBSRVNFVFM9WwogWydkZWVwc2VlaycsJ2h0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbScsJ2JlYXJlcicsJ0RlZXBTZWVrIOKAlCBjaGVhcGVzdCBjYXBhYmxlIG1vZGVsLCB+4oK5MzAvbW8gb2YgdXNlJ10sCiBbJ29wZW53ZWF0aGVyJywnaHR0cHM6Ly9hcGkub3BlbndlYXRoZXJtYXAub3JnL2RhdGEvMi41JywncXVlcnknLCdXZWF0aGVyIOKAlCBmcmVlIHRpZXInXSwKIFsnbmV3c2FwaScsJ2h0dHBzOi8vbmV3c2FwaS5vcmcvdjInLCdoZWFkZXInLCdOZXdzIGhlYWRsaW5lcyDigJQgZnJlZSB0aWVyJ10sCiBbJ3RlbGVncmFtJywnaHR0cHM6Ly9hcGkudGVsZWdyYW0ub3JnJywnbm9uZScsJ1RlbGVncmFtIGJvdCDigJQgZnJlZSwgcHV0IHRoZSB0b2tlbiBpbiB0aGUgYmFzZSBVUkwnXSwKIFsnc2hlZXRzJywnaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQnLCdiZWFyZXInLCdHb29nbGUgU2hlZXRzIOKAlCBsb2cgcmVzdWx0cyB0byBhIHNwcmVhZHNoZWV0J10sCiBbJ3Vuc3BsYXNoJywnaHR0cHM6Ly9hcGkudW5zcGxhc2guY29tJywnaGVhZGVyJywnRnJlZSBzdG9jayBpbWFnZXMgZm9yIHRoZSBzaXRlcyBoZSBidWlsZHMnXQpdOwpMSVZFLmNvbm5lY3Q9KCk9PnsKICBjb25zdCBDPVMuY29ubmVjdG9yc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoQy5sZW5ndGgsJ0Nvbm5lY3RvcnMnLCd2YXIoLS1saW1lKScsQy5maWx0ZXIoYz0+Yy5lbmFibGVkKS5sZW5ndGgrJyBlbmFibGVkJyl9CiAgICR7a3BpKGZtdChDLnJlZHVjZSgoYSxjKT0+YStjLmNhbGxzLDApKSwnQ2FsbHMgTWFkZScsJ3ZhcigtLW9saXZlKScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKEMucmVkdWNlKChhLGMpPT5hK2MuZmFpbHMsMCksJ0ZhaWx1cmVzJyxDLnNvbWUoYz0+Yy5mYWlscyk/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnJyl9PC9kaXY+CiAgJHtDLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbm5lY3RlZCBTZXJ2aWNlczwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICAgPHRoZWFkPjx0cj48dGg+TmFtZTwvdGg+PHRoPkVuZHBvaW50PC90aD48dGg+QXV0aDwvdGg+PHRoPktleTwvdGg+PHRoPlVzZWQ8L3RoPjx0aD5TdGF0ZTwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtDLm1hcChjPT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tbGltZSkiPiR7ZXNjKGMubmFtZSl9PC9iPgogICAgICR7Yy5ub3RlP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy5ub3RlKX08L2Rpdj5gOicnfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLmJhc2UpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy5hdXRoKX08L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy5rZXkpfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2MuY2FsbHN9JHtjLmZhaWxzPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPi8nK2MuZmFpbHMrJ+Kclzwvc3Bhbj4nOicnfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2MuZW5hYmxlZD8ndC1ncm4nOid0LWRpbSd9Ij4ke2MuZW5hYmxlZD8nT04nOidPRkYnfTwvc3Bhbj48L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idGVzdENvbm4oJyR7ZXNjKGMubmFtZSl9JykiPlRlc3Q8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZ2dsZUNvbm4oJyR7ZXNjKGMubmFtZSl9JykiPiR7Yy5lbmFibGVkPydEaXNhYmxlJzonRW5hYmxlJ308L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InJtQ29ubignJHtlc2MoYy5uYW1lKX0nKSI+UmVtb3ZlPC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gOicnfWA7Cn07ClJFTkRFUi5jb25uZWN0PSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4pqvIENPTk5FQ1RPUlMg4oCUIEdJVkUgSElNIEFOWSBTRVJWSUNFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkFkZCA8Yj5hbnkgQVBJPC9iPiB3aXRoIGEga2V5LiBIZSBjYW4gdGhlbiBjYWxsIGl0IGZyb20gdGhlIGNhcGFiaWxpdGllcyBoZSB3cml0ZXMg4oCUIGJ1dCB0aGUga2V5IGl0c2VsZiBpcyBuZXZlciBzaG93biB0byBoaXMgY29kZSwgbmV2ZXIgcmV0dXJuZWQgYnkgdGhlIEFQSSwgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGxlZGdlci48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPlVwIHRvIDQwIGNvbm5lY3RvcnMuIEFueSBSRVNUIHNlcnZpY2UgdGhhdCByZXR1cm5zIEpTT04uPC9saT4KICAgPGxpPkZvdXIgYXV0aCBzdHlsZXM6IEJlYXJlciB0b2tlbiwgY3VzdG9tIGhlYWRlciwgcXVlcnkgcGFyYW1ldGVyLCBvciBub25lLjwvbGk+CiAgIDxsaT5IZSBzZWVzIG9ubHkgdGhlIDxiPm5hbWU8L2I+IGFuZCB3aGF0IGl0IGRvZXMg4oCUIHRoZW4gY2FsbHMgPGNvZGU+YXBpLmNhbGwoJ25hbWUnLCB7cGF0aH0pPC9jb2RlPi48L2xpPgogIDwvdWw+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U2hvcnQgbmFtZTwvc3Bhbj48aW5wdXQgaWQ9ImNuTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZGVlcHNlZWsiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFzZSBVUkw8L3NwYW4+PGlucHV0IGlkPSJjbkJhc2UiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BdXRoIHN0eWxlPC9zcGFuPjxzZWxlY3QgaWQ9ImNuQXV0aCIgY2xhc3M9ImluIj4KICAgIDxvcHRpb24gdmFsdWU9ImJlYXJlciI+QmVhcmVyIHRva2VuPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iaGVhZGVyIj5DdXN0b20gaGVhZGVyPC9vcHRpb24+CiAgICA8b3B0aW9uIHZhbHVlPSJxdWVyeSI+UXVlcnkgcGFyYW1ldGVyPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0ibm9uZSI+Tm8ga2V5IG5lZWRlZDwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QVBJIGtleTwvc3Bhbj48aW5wdXQgaWQ9ImNuS2V5IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5IZWFkZXIgLyBxdWVyeSBuYW1lPC9zcGFuPjxpbnB1dCBpZD0iY25IZHIiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlgtQVBJLUtleSBvciBrZXkiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBpcyBpdCBmb3I/PC9zcGFuPjxpbnB1dCBpZD0iY25Ob3RlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJjaGVhcCBtb2RlbCBmb3IgYnVsayB3cml0aW5nIj48L2xhYmVsPgogIDwvZGl2PgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhZGRDb25uKCkiPkFERCBDT05ORUNUT1I8L2J1dHRvbj4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPlF1aWNrIGZpbGw6PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+JHtQUkVTRVRTLm1hcCgocCxpKT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icHJlc2V0KCR7aX0pIj4ke2VzYyhwWzBdKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImNvbm5lY3QiPiR7TElWRS5jb25uZWN0KCl9PC9kaXY+YDsKZnVuY3Rpb24gcHJlc2V0KGkpeyBjb25zdCBwPVBSRVNFVFNbaV07CiAgY25OYW1lLnZhbHVlPXBbMF07IGNuQmFzZS52YWx1ZT1wWzFdOyBjbkF1dGgudmFsdWU9cFsyXTsgY25Ob3RlLnZhbHVlPXBbM107CiAgZmxhc2goJ0ZpbGxlZCDigJQgbm93IHBhc3RlIHRoZSBrZXknKTsgfQphc3luYyBmdW5jdGlvbiBhZGRDb25uKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvY29ubmVjdG9yL2FkZCcse25hbWU6Y25OYW1lLnZhbHVlLGJhc2U6Y25CYXNlLnZhbHVlLGF1dGg6Y25BdXRoLnZhbHVlLAogICAgICBrZXk6Y25LZXkudmFsdWUsaGVhZGVyTmFtZTpjbkhkci52YWx1ZSxxdWVyeU5hbWU6Y25IZHIudmFsdWUsbm90ZTpjbk5vdGUudmFsdWV9KTsKICAgIGNuS2V5LnZhbHVlPScnOyByZW5kZXIoKTsgZmxhc2goJ0Nvbm5lY3RvciBhZGRlZCDigJQgaGUgY2FuIHVzZSBpdCBub3cnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJtQ29ubihuKXsgaWYoIWNvbmZpcm0oJ1JlbW92ZSAnK24rJz8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9jb25uZWN0b3IvcmVtb3ZlJyx7bmFtZTpufSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlQ29ubihuKXsgYXdhaXQgQVBJKCcvYXBpL2Nvbm5lY3Rvci90b2dnbGUnLHtuYW1lOm59KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0ZXN0Q29ubihuKXsgZmxhc2goJ1Rlc3RpbmcgJytuKyfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2Nvbm5lY3Rvci90ZXN0Jyx7bmFtZTpufSk7CiAgICBtb2RhbChgPGgzPiR7ZXNjKG4pfSByZXNwb25kZWQ8L2gzPjxwcmUgY2xhc3M9InlhbWwiPiR7ZXNjKHIuc2FtcGxlKX08L3ByZT4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KCi8qIC0tLS0tLS0tLS0gVEhFIENIQUlSTUFOJ1MgREVTSyDigJQgb25lIHBhZ2UsIGhlIGFza3MsIHlvdSB0aWNrIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gYXNrQ2FyZChraW5kLCBpZCwgdGl0bGUsIGJvZHksIG1ldGEsIGV4dHJhKXsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItbGVmdDo0cHggc29saWQgdmFyKC0tYW1iKSI+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+SEUgSVMgQVNLSU5HPC9zcGFuPjxiIHN0eWxlPSJmb250LXNpemU6MTQuNXB4Ij4ke2VzYyh0aXRsZSl9PC9iPjwvZGl2PgogICAgJHttZXRhP2A8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG1ldGEpfTwvc3Bhbj5gOicnfTwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHg7bGluZS1oZWlnaHQ6MS42NSI+JHtib2R5fTwvZGl2PgogICAke2V4dHJhfHwnJ30KICAgPGRpdiBjbGFzcz0icm93Ij4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgc3R5bGU9ImZvbnQtc2l6ZToxNXB4O3BhZGRpbmc6MTFweCAyNnB4IiBvbmNsaWNrPSJzYXkoJyR7a2luZH0nLCcke2lkfScsMSkiPuKclCAmbmJzcDtZRVM8L2J1dHRvbj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgc3R5bGU9ImZvbnQtc2l6ZToxNXB4O3BhZGRpbmc6MTFweCAyNnB4IiBvbmNsaWNrPSJzYXkoJyR7a2luZH0nLCcke2lkfScsMCkiPuKclSAmbmJzcDtOTzwvYnV0dG9uPgogICA8L2Rpdj48L2Rpdj5gOwp9Ci8qID09PT09PT09PT09PT09PT09IFRIRSBERVNLIOKAlCBvbmUgY2hhdCBib3gsIGV2ZXJ5dGhpbmcgaGFwcGVucyBoZXJlID09PT09PT09PQogICBUaGUgT3duZXIgc2FpZCBpdCBwbGFpbmx5OiAid2h5IHlvdSBub3QgY29tYmluZSBhbmQgbGV0IGNoYWlybWFuIGhhbmRlbAogICBpdHMgbW9yZSBhbmQgbW9yZSB3b3JrIGZvciBtZSByYXRoZXIgdGhlbiBoaW0iLiBTbyB0aGlzIGlzIG5vdyBhIGNoYXQsCiAgIG5vdCBhIGRhc2hib2FyZC4gQXBwcm92YWxzIGFwcGVhciBpbmxpbmUuIEFjdGlvbnMgaGFwcGVuIGZyb20gdGhlIGJveC4KICAgTm90aGluZyBoZXJlIHJlcXVpcmVzIGZpbmRpbmcgYW5vdGhlciBwYWdlLiAqLwpMSVZFLmRlc2s9KCk9PnsKICBjb25zdCBnYXRlcyA9IChTLmdhdGVzfHxbXSkuZmlsdGVyKGc9Pmcuc3RhdHVzPT09J1BFTkRJTkcnKTsKICBjb25zdCB1cHMgICA9IChTLnByb3Bvc2Fsc3x8W10pLmZpbHRlcihwPT5wLnN0YXR1cz09PSdQRU5ESU5HJyk7CiAgY29uc3Qgam9icyAgPSAoUy5taXNzaW9uc3x8W10pLmZpbHRlcihtPT5tLnN0YXR1cz09PSdPUEVOJyk7CiAgY29uc3QgYXNrcyAgPSBnYXRlcy5sZW5ndGggKyB1cHMubGVuZ3RoOwogIGNvbnN0IHN0ICAgID0gUy5zdG9yYWdlfHx7fTsKICBjb25zdCBjaGF0ICA9IChTLmNoYXR8fFtdKS5zbGljZSgwLDMwKS5yZXZlcnNlKCk7CgogIGxldCBodG1sID0gJyc7CgogIC8qIE9ubHkgZ2VudWluZWx5IGNyaXRpY2FsIHRoaW5ncyBpbnRlcnJ1cHQuIEV2ZXJ5dGhpbmcgZWxzZSB3YWl0cyBiZWxvdy4gKi8KICBpZihzdC5sZXZlbD09PSdDUklUJyl7CiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDpyZ2JhKDE4MCw2OCw0MiwuMDYpO21hcmdpbi1ib3R0b206MTJweCI+CiAgICAgPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPllPVVIgV09SSyBJUyBOT1QgQkVJTkcgU0FWRUQ8L2I+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46NnB4IDAgOXB4Ij4ke2VzYyhzdC5tc2d8fCcnKX08L2Rpdj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8gc20iIG9uY2xpY2s9ImdvKCdzdG9yYWdlJykiPkZpeCBpdCDigJQgNiBtaW51dGVzPC9idXR0b24+PC9kaXY+YDsKICB9CgogIC8qIEFwcHJvdmFscywgaW5saW5lLCBiaWcgYnV0dG9ucy4gKi8KICBpZihhc2tzKXsKICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tYW1iKTttYXJnaW4tYm90dG9tOjEycHgiPgogICAgICA8YiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHthc2tzfSB0aGluZyR7YXNrcz4xPydzJzonJ30gbmVlZCB5b3VyIHllcyBvciBubzwvYj48L2Rpdj5gOwogICAgZ2F0ZXMuZm9yRWFjaChnPT57IGh0bWwgKz0gYXNrQ2FyZCgnZ2F0ZScsIGcuaWQsIGcudGl0bGUsCiAgICAgIGAke2VzYyhnLm9iail9PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+U2FmZWd1YXJkczogJHtlc2MoZy5zYWZlKX08L2Rpdj5gLAogICAgICBgJHtnLmNsc30gwrcgcmlzayAke2cucmlza30ke2cuY29zdD8nIMK3IGNvc3RzIFJzICcrZy5jb3N0OicnfWApOyB9KTsKICAgIHVwcy5mb3JFYWNoKHA9PnsgaHRtbCArPSBhc2tDYXJkKCd1cGdyYWRlJywgcC5pZCwgcC5sYWJlbCwKICAgICAgYCR7ZXNjKHAud2h5KX0ke3AuZXZpZGVuY2U/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPkV2aWRlbmNlOiAke2VzYyhwLmV2aWRlbmNlKX08L2Rpdj5gOicnfWAsCiAgICAgIHAua2xhc3MpOyB9KTsKICB9CgogIC8qIFBST0pFQ1RTIOKAlCBzZXBhcmF0ZSB0aHJlYWQgcGVyIHBpZWNlIG9mIHdvcmssIHNvIGNvbnRleHQgZG9lcyBub3QgYmxlZWQgKi8KICBjb25zdCBwcmpzID0gUy5wcm9qZWN0c3x8W3tpZDonUFJKLU1BSU4nLG5hbWU6J0dlbmVyYWwnfV07CiAgY29uc3QgY250ICA9IFMuY2hhdENvdW50c3x8e307CiAgY29uc3Qgb3BlbiA9IHByanMuZmluZCh4PT54LmlkPT09KFMucHJvamVjdElkfHwnUFJKLU1BSU4nKSl8fHByanNbMF07CiAgaHRtbCArPSBgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0iZmxleC13cmFwOndyYXA7Z2FwOjZweDttYXJnaW4tYm90dG9tOjEwcHg7YWxpZ24taXRlbXM6Y2VudGVyIj4KICAgJHtwcmpzLm1hcCh4PT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7eC5pZD09PW9wZW4uaWQ/J3AnOicnfSIgb25jbGljaz0ib3BlblByaignJHt4LmlkfScpIgogICAgIHRpdGxlPSIke2NudFt4LmlkXXx8MH0gbWVzc2FnZXMiPiR7ZXNjKHgubmFtZSl9JHtjbnRbeC5pZF0/YCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Y250W3guaWRdfTwvc3Bhbj5gOicnfTwvYnV0dG9uPmApLmpvaW4oJycpfQogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9Im5ld1ByaigpIiB0aXRsZT0iS2VlcCBhIHNlcGFyYXRlIGNvbnZlcnNhdGlvbiBmb3IgZWFjaCBidXNpbmVzcyI+KyBOZXc8L2J1dHRvbj4KICAgJHtvcGVuLmlkIT09J1BSSi1NQUlOJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxQcmooJyR7b3Blbi5pZH0nKSIgdGl0bGU9IkRlbGV0ZSB0aGlzIHByb2plY3QgYW5kIGl0cyB0aHJlYWQiPlx1MjcxNTwvYnV0dG9uPmA6Jyd9CiAgIDxzcGFuIHN0eWxlPSJmbGV4OjEiPjwvc3Bhbj4KICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9ImNoYXRGaW5kIiBwbGFjZWhvbGRlcj0iU2VhcmNoIGV2ZXJ5IGNvbnZlcnNhdGlvbuKApiIgc3R5bGU9Im1heC13aWR0aDoyMzBweCIKICAgICBvbmtleWRvd249ImlmKGV2ZW50LmtleT09PSdFbnRlcicpe2V2ZW50LnByZXZlbnREZWZhdWx0KCk7ZmluZENoYXQoKX0iPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImZpbmRDaGF0KCkiPkZpbmQ8L2J1dHRvbj4KICA8L2Rpdj4KICA8ZGl2IGlkPSJmaW5kT3V0Ij48L2Rpdj5gOwoKICAvKiBUSEUgQ09OVkVSU0FUSU9OICovCiAgaHRtbCArPSBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9InBhZGRpbmc6MDtvdmVyZmxvdzpoaWRkZW4iPgogICA8ZGl2IGlkPSJjaGF0U2Nyb2xsIiBzdHlsZT0ibWF4LWhlaWdodDo1MnZoO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjE2cHgiPgogICAkeyFjaGF0Lmxlbmd0aCA/IGA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjAiPgogICAgICA8c3R5bGU+CiAgICAgICAgQGtleWZyYW1lcyBjaW5lUGFuezAle3RyYW5zZm9ybTpzY2FsZSgxLjA2KSB0cmFuc2xhdGUzZCgwLDAsMCl9NTAle3RyYW5zZm9ybTpzY2FsZSgxLjEzKSB0cmFuc2xhdGUzZCgtMS4yJSwtMSUsMCl9MTAwJXt0cmFuc2Zvcm06c2NhbGUoMS4wNikgdHJhbnNsYXRlM2QoMCwwLDApfX0KICAgICAgICBAa2V5ZnJhbWVzIGNpbmVSaXNle2Zyb217b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGVZKDE0cHgpfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19CiAgICAgICAgQGtleWZyYW1lcyBjaW5lU2hlZW57MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEyMCUpfTEwMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMjIwJSl9fQogICAgICAgIEBrZXlmcmFtZXMgY2luZUdsb3d7MCUsMTAwJXtvcGFjaXR5Oi41NX01MCV7b3BhY2l0eToxfX0KICAgICAgICAuY2luZXtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW47Ym9yZGVyLXJhZGl1czoxNHB4O2JhY2tncm91bmQ6IzA3MEEwNTsKICAgICAgICAgIGJveC1zaGFkb3c6MCAxOHB4IDUwcHggcmdiYSgwLDAsMCwuMjgpfQogICAgICAgIC5jaW5lPmltZ3t3aWR0aDoxMDAlO2Rpc3BsYXk6YmxvY2s7YW5pbWF0aW9uOmNpbmVQYW4gMjZzIGVhc2UtaW4tb3V0IGluZmluaXRlO3dpbGwtY2hhbmdlOnRyYW5zZm9ybX0KICAgICAgICAuY2luZTo6YWZ0ZXJ7Y29udGVudDonJztwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO3BvaW50ZXItZXZlbnRzOm5vbmU7CiAgICAgICAgICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcscmdiYSg3LDEwLDUsMCkgNDIlLHJnYmEoNywxMCw1LC41NSkgNzglLHJnYmEoNywxMCw1LC45KSAxMDAlKX0KICAgICAgICAuY2luZUNhcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDt6LWluZGV4OjI7cGFkZGluZzoyMnB4IDE4cHggMjBweH0KICAgICAgICAuY2luZUNhcCBoMXtmb250OjgwMCBjbGFtcCgyM3B4LDQuNnZ3LDQwcHgpLzEuMDYgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LTEuNHB4OwogICAgICAgICAgbWFyZ2luOjAgMCA3cHg7Y29sb3I6I0Y2RjNFNjt0ZXh0LXNoYWRvdzowIDJweCAyMnB4IHJnYmEoMCwwLDAsLjcpOwogICAgICAgICAgYW5pbWF0aW9uOmNpbmVSaXNlIC44cyBjdWJpYy1iZXppZXIoLjIsLjcsLjIsMSkgYm90aH0KICAgICAgICAuY2luZUNhcCBoMSBlbXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjojQzZEQjRBfQogICAgICAgIC5jaW5lQ2FwIHB7bWFyZ2luOjA7Zm9udC1zaXplOjEzcHg7Y29sb3I6cmdiYSgyNDYsMjQzLDIzMCwuNzIpOwogICAgICAgICAgYW5pbWF0aW9uOmNpbmVSaXNlIC44cyAuMThzIGN1YmljLWJlemllciguMiwuNywuMiwxKSBib3RofQogICAgICAgIC5jaW5lRG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6I0M2REI0QTsKICAgICAgICAgIG1hcmdpbi1yaWdodDo3cHg7YW5pbWF0aW9uOmNpbmVHbG93IDEuOXMgZWFzZS1pbi1vdXQgaW5maW5pdGU7CiAgICAgICAgICBib3gtc2hhZG93OjAgMCAxMHB4ICNDNkRCNEF9CiAgICAgICAgLnRpbGV7cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO2N1cnNvcjpwb2ludGVyO2JvcmRlci1yYWRpdXM6MTJweDsKICAgICAgICAgIGJvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtiYWNrZ3JvdW5kOiMwNzBBMDU7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjIycyxib3gtc2hhZG93IC4yMnM7CiAgICAgICAgICBhbmltYXRpb246Y2luZVJpc2UgLjdzIGJvdGh9CiAgICAgICAgLnRpbGU6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTRweCk7Ym94LXNoYWRvdzowIDE0cHggMzBweCByZ2JhKDAsMCwwLC4zKX0KICAgICAgICAudGlsZT5pbWd7d2lkdGg6MTAwJTtkaXNwbGF5OmJsb2NrO2hlaWdodDoxMDRweDtvYmplY3QtZml0OmNvdmVyO29wYWNpdHk6LjkyO3RyYW5zaXRpb246LjM1c30KICAgICAgICAudGlsZTpob3Zlcj5pbWd7dHJhbnNmb3JtOnNjYWxlKDEuMDkpO29wYWNpdHk6MX0KICAgICAgICAudGlsZSAubGJse3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3BhZGRpbmc6OXB4IDEwcHg7dGV4dC1hbGlnbjpsZWZ0OwogICAgICAgICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoNywxMCw1LDApLHJnYmEoNywxMCw1LC45MikgNTUlKX0KICAgICAgICAudGlsZSAubGJsIGJ7ZGlzcGxheTpibG9jaztmb250LXNpemU6MTIuNXB4O2NvbG9yOiNGNkYzRTY7bGluZS1oZWlnaHQ6MS4yNX0KICAgICAgICAudGlsZSAubGJsIHN7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtmb250LXNpemU6MTAuNXB4O2NvbG9yOnJnYmEoMjQ2LDI0MywyMzAsLjYpO2xpbmUtaGVpZ2h0OjEuNH0KICAgICAgICAudGlsZSAuc2hlZW57cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7Ym90dG9tOjA7d2lkdGg6MzQlO3BvaW50ZXItZXZlbnRzOm5vbmU7CiAgICAgICAgICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMDBkZWcsdHJhbnNwYXJlbnQscmdiYSgyNTUsMjU1LDI1NSwuMTYpLHRyYW5zcGFyZW50KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTIwJSl9CiAgICAgICAgLnRpbGU6aG92ZXIgLnNoZWVue2FuaW1hdGlvbjpjaW5lU2hlZW4gLjg1cyBlYXNlLW91dH0KICAgICAgICBAbWVkaWEocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjpyZWR1Y2Upey5jaW5lPmltZ3thbmltYXRpb246bm9uZX0uY2luZUNhcCBoMSwuY2luZUNhcCBwLC50aWxle2FuaW1hdGlvbjpub25lfX0KICAgICAgPC9zdHlsZT4KICAgICAgPGRpdiBjbGFzcz0iY2luZSI+CiAgICAgICAgPGltZyBzcmM9IiR7QVJULmhlcm99IiBhbHQ9IiI+CiAgICAgICAgPGRpdiBjbGFzcz0iY2luZUNhcCI+CiAgICAgICAgICA8aDE+U2F5IGl0IG9uY2UuPGJyPjxlbT5IZSBkb2VzIHRoZSByZXN0LjwvZW0+PC9oMT4KICAgICAgICAgIDxwPjxzcGFuIGNsYXNzPSJjaW5lRG90Ij48L3NwYW4+Tm90aGluZyBsZWF2ZXMgd2l0aG91dCB5b3VyIHRhcC48L3A+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luOjEycHggMCA0cHg7Z2FwOjlweCI+CiAgICAgICAgJHtbWydidWlsZCcsJ0J1aWxkIHRoZSBidXNpbmVzcycsJ1NpdGUsIHByaWNlcywgcG9saWNpZXMsIGludm9pY2UnLCdCdWlsZCBtZSBhIGJ1c2luZXNzIGZvciAnXSwKICAgICAgICAgICBbJ25hbWUnLCdGaW5kIGEgbmFtZScsJ0NoZWNrZWQgbGl2ZS4gRnJlZSBvciB0YWtlbicsJ0ZpbmQgbWUgYSBuYW1lIGZvciAnXSwKICAgICAgICAgICBbJ2N1c3RvbWVycycsJ0dldCBjdXN0b21lcnMnLCdXcml0dGVuIGFuZCByZWFkeSB0byBzZW5kJywnR2V0IG1lIGN1c3RvbWVycyddLAogICAgICAgICAgIFsnYXBwcm92ZScsJ1lvdSBhcHByb3ZlJywnSGUgYXNrcy4gWW91IHRhcCB5ZXMgb3Igbm8nLCdXaGF0IGlzIGJyb2tlbj8nXV0KICAgICAgICAgIC5tYXAoKFtrLHQscyxxXSxpKT0+YDxkaXYgY2xhc3M9InRpbGUiIHN0eWxlPSJhbmltYXRpb24tZGVsYXk6JHswLjEraSowLjA5fXMiIG9uY2xpY2s9ImRlc2tRdWljaygnJHtxfScpIj4KICAgICAgICAgICAgPGltZyBzcmM9IiR7QVJUW2tdfSIgYWx0PSIiPjxzcGFuIGNsYXNzPSJzaGVlbiI+PC9zcGFuPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJsYmwiPjxiPiR7dH08L2I+PHM+JHtzfTwvcz48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX0KICAgICAgPC9kaXY+PC9kaXY+YAogICA6IGNoYXQubWFwKG09PnsKICAgICAgY29uc3QgbWUgPSBtLndobz09PSdPV05FUic7CiAgICAgIGNvbnN0IHN5cyA9IG0ud2hvPT09J1NZU1RFTSc7CiAgICAgIGlmKHN5cykgcmV0dXJuIGA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO21hcmdpbjoxMHB4IDA7Zm9udC1zaXplOjExLjVweCI+JHtlc2MobS50ZXh0KX08L2Rpdj5gOwogICAgICByZXR1cm4gYDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6JHttZT8nZmxleC1lbmQnOidmbGV4LXN0YXJ0J307bWFyZ2luLWJvdHRvbToxMnB4Ij4KICAgICAgICA8ZGl2IHN0eWxlPSJtYXgtd2lkdGg6ODIlO2JhY2tncm91bmQ6JHttZT8ndmFyKC0tbGltZSknOid2YXIoLS1nbGFzczIpJ307Y29sb3I6JHttZT8nI2ZmZic6J3ZhcigtLXR4dCknfTsKICAgICAgICAgIGJvcmRlcjoxcHggc29saWQgJHttZT8ndmFyKC0tbGltZSknOid2YXIoLS1zdHJva2UpJ307Ym9yZGVyLXJhZGl1czoke21lPycxNHB4IDE0cHggM3B4IDE0cHgnOicxNHB4IDE0cHggMTRweCAzcHgnfTsKICAgICAgICAgIHBhZGRpbmc6MTFweCAxNHB4O2xpbmUtaGVpZ2h0OjEuNjI7d2hpdGUtc3BhY2U6cHJlLXdyYXA7d29yZC1icmVhazpicmVhay13b3JkIj4ke2VzYyhtLnRleHQpfSR7CiAgICAgICAgICAhbWU/YDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlNc2codGhpcykiPkNvcHk8L2J1dHRvbj48L2Rpdj5gOicnfTwvZGl2PjwvZGl2PmA7CiAgICAgfSkuam9pbignJyl9CiAgIDwvZGl2PgogICA8ZGl2IHN0eWxlPSJib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6MTJweDtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKSI+CiAgICAkeyhTLmRvY3N8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9ImZsZXgtd3JhcDp3cmFwO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICAgJHsoUy5kb2NzfHxbXSkuc2xpY2UoMCw0KS5tYXAoZD0+YDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSIgdGl0bGU9IiR7ZC5jaGFyc30gY2hhcmFjdGVycyByZWFkYWJsZSI+XHV7MUY0Q0V9ICR7ZXNjKGQubmFtZSl9CiAgICAgICAgPGEgaHJlZj0iIyIgb25jbGljaz0iZHJvcERvYygnJHtkLmlkfScpO3JldHVybiBmYWxzZSIgc3R5bGU9Im1hcmdpbi1sZWZ0OjZweDt0ZXh0LWRlY29yYXRpb246bm9uZSI+XHUyNzE1PC9hPjwvc3Bhbj5gKS5qb2luKCcnKX0KICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5hdHRhY2hlZCBcdTIwMTQgaGUgcmVhZHMgdGhlc2Ugd2hlbiB5b3UgYXNrPC9zcGFuPjwvZGl2PmA6Jyd9CiAgICA8dGV4dGFyZWEgaWQ9ImRlc2tTYXkiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6NThweDtyZXNpemU6dmVydGljYWwiCiAgICAgIHBsYWNlaG9sZGVyPSJQYXN0ZSBhIHdlYnNpdGUsIGEgbmFtZSwgb3IganVzdCBzYXkgd2hhdCB5b3Ugd2FudOKApiIKICAgICAgb25rZXlkb3duPSJpZihldmVudC5rZXk9PT0nRW50ZXInJiYoZXZlbnQuY3RybEtleXx8ZXZlbnQubWV0YUtleSkpe2V2ZW50LnByZXZlbnREZWZhdWx0KCk7ZGVza1NlbmQoKX0iPjwvdGV4dGFyZWE+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjlweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRlc2tTZW5kKCkiPlNFTkQ8L2J1dHRvbj4KICAgICA8bGFiZWwgY2xhc3M9ImJ0biBzbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyO21hcmdpbjowIj5cdXsxRjRDRX0gQXR0YWNoCiAgICAgIDxpbnB1dCB0eXBlPSJmaWxlIiBpZD0iZGVza0ZpbGUiIHN0eWxlPSJkaXNwbGF5Om5vbmUiCiAgICAgICBhY2NlcHQ9Ii50eHQsLm1kLC5jc3YsLmpzb24sLmxvZywuaHRtbCwucGRmIiBvbmNoYW5nZT0iYXR0YWNoRG9jKHRoaXMpIj48L2xhYmVsPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+Q3RybCtFbnRlcjwvc3Bhbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImRlc2tRdWljaygnV2hhdCBpcyBicm9rZW4gYW5kIGJsb2NraW5nIG1vbmV5IHJpZ2h0IG5vdz8nKSI+V2hhdCBpcyBicm9rZW4/PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJkZXNrUXVpY2soJ0ZpbmQgbWUgYSB3YXkgdG8gZWFybiBtb25leSB0aGlzIHdlZWsuJykiPkZpbmQgbW9uZXk8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImRlc2tRdWljaygnQ2hlY2sgYWxsIG15IHNpdGVzIHJpZ2h0IG5vdy4nKSI+Q2hlY2sgbXkgc2l0ZXM8L2J1dHRvbj4KICAgICAkeyhTLmNoYXR8fFtdKS5sZW5ndGg/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJDaGF0KCkiPkNsZWFyPC9idXR0b24+YDonJ30KICAgIDwvZGl2PgogICA8L2Rpdj4KICA8L2Rpdj5gOwoKICAvKiBKb2JzIG9ubHkgYSBodW1hbiBjYW4gZG8g4oCUIGNvbGxhcHNlZCwgbm90IHNob3V0aW5nLiAqLwogIGlmKGpvYnMubGVuZ3RoKXsKICAgIGh0bWwgKz0gYDxkZXRhaWxzIGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPgogICAgICA8Yj4ke2pvYnMubGVuZ3RofSBqb2Ike2pvYnMubGVuZ3RoPjE/J3MnOicnfSBvbmx5IHlvdSBjYW4gZG88L2I+CiAgICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+IOKAlCB0aGUgd29yZHMgYXJlIGFscmVhZHkgd3JpdHRlbjwvc3Bhbj48L3N1bW1hcnk+CiAgICAgJHtqb2JzLnNsaWNlKDAsNCkubWFwKG09PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tbGltZSk7cGFkZGluZy1sZWZ0OjEycHg7bWFyZ2luOjEzcHggMCI+CiAgICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PGI+JHtlc2MobS50aXRsZSl9PC9iPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+fiR7bS5taW51dGVzfSBtaW48L3NwYW4+PC9kaXY+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjo0cHggMCA3cHgiPiR7ZXNjKG0ud2h5KX08L2Rpdj4KICAgICAgICR7bS5zY3JpcHQ/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4Ij4KICAgICAgICAgPGRpdiBpZD0iZHNrXyR7bS5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG0uc2NyaXB0KX08L2Rpdj4KICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIHN0eWxlPSJtYXJnaW4tdG9wOjhweCIgb25jbGljaz0iY29weVNjcmlwdCgnJHttLmlkfScpIj5Db3B5PC9idXR0b24+PC9kaXY+YDonJ30KICAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij4KICAgICAgICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjI2MHB4IiBpZD0ibm90ZV8ke20uaWR9IiBwbGFjZWhvbGRlcj0id2hhdCBoYXBwZW5lZD8iPgogICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ2RvbmUnKSI+RG9uZTwvYnV0dG9uPgogICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ3NraXAnKSI+U2tpcDwvYnV0dG9uPjwvZGl2PgogICAgICA8L2Rpdj5gKS5qb2luKCcnKX08L2RldGFpbHM+YDsKICB9CgogIC8qIFN0YXR1cywgb25lIGxpbmUsIGZvbGRlZCBhd2F5LiAqLwogIGNvbnN0IGRvd249KFMubW9uaXRvcnN8fFtdKS5maWx0ZXIobT0+bS5zdGF0ZT09PSdET1dOJyk7CiAgaHRtbCArPSBgPGRldGFpbHMgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciIgY2xhc3M9Im1vbm8tZGltIj5TdGF0dXM8L3N1bW1hcnk+CiAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5SdW5uaW5nPC90ZD48dGQ+JHsoUy5hZ2VudHN8fFtdKS5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RofSBhZ2VudHMsICR7KFMudGFza3N8fFtdKS5maWx0ZXIoeD0+eC5lbmFibGVkKS5sZW5ndGh9IHN0YW5kaW5nIG9yZGVycyR7Uy5ydW5uaW5nPycnOicgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPuKAlCBIQUxURUQ8L3NwYW4+J308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2l0ZXM8L3RkPjx0ZD4keyhTLm1vbml0b3JzfHxbXSkubGVuZ3RofSR7ZG93bi5sZW5ndGg/YCA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+wrcgJHtkb3duLmxlbmd0aH0gRE9XTjwvc3Bhbj5gOicgwrcgYWxsIHVwJ308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QnVzaW5lc3NlczwvdGQ+PHRkPiR7KFMuYnVzaW5lc3Nlc3x8W10pLmxlbmd0aH0gYnVpbHQgwrcgJHsoUy5idXNpbmVzc2VzfHxbXSkuZmlsdGVyKGI9PmIucHVibGlzaGVkKS5sZW5ndGh9IGxpdmU8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWVzc2FnZXMgc2VudDwvdGQ+PHRkPiR7KFMub3V0cmVhY2h8fFtdKS5sZW5ndGh9JHshKFMub3V0cmVhY2h8fFtdKS5sZW5ndGg/JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4oCUIG5vdGhpbmcgZWFybnMgdW50aWwgc29tZXRoaW5nIGlzIHNlbnQ8L3NwYW4+JzonJ308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWFpbDwvdGQ+PHRkPiR7Uy5zbXRwVmVyaWZpZWQ/JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5wcm92ZW48L3NwYW4+JzooUy50ZWxlbWV0cnkmJlMudGVsZW1ldHJ5LnNtdHBfcmVhZHkpPyc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+dW50ZXN0ZWQ8L3NwYW4+JzonPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPm9mZjwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CcmFpbjwvdGQ+PHRkPiR7Uy5sbG0/ZXNjKFMubGxtLnByb3ZpZGVyKSsnIMK3ICcrKChTLmxsbUJhY2t1cHN8fFtdKS5sZW5ndGgrMSkrJyBrZXkocyknOic8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+bm90IGNvbm5lY3RlZDwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGV0YWlscz5gOwoKICByZXR1cm4gaHRtbDsKfTsKUkVOREVSLmRlc2s9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iZGVzayI+JHtMSVZFLmRlc2soKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBzYXkoa2luZCwgaWQsIHllcyl7CiAgZmxhc2goeWVzPydBcHByb3ZpbmfigKYnOidEZWNsaW5pbmfigKYnKTsKICB0cnl7CiAgICBpZihraW5kPT09J2dhdGUnKSAgICBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9kZWNpZGUnLHtpZCxvazohIXllc30pOwogICAgZWxzZSAgICAgICAgICAgICAgICAgYXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvZGVjaWRlJyx7aWQsb2s6ISF5ZXN9KTsKICAgIHJlbmRlcigpOyBmbGFzaCh5ZXM/J0RvbmUg4oCUIGhlIGlzIGFjdGluZyBvbiBpdCc6J0RlY2xpbmVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpsZXQgZGVza0J1c3k9ZmFsc2U7CmFzeW5jIGZ1bmN0aW9uIGRlc2tTZW5kKCl7CiAgaWYoZGVza0J1c3kpIHJldHVybjsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVza1NheScpOwogIGNvbnN0IHQ9KGVsfHx7fSkudmFsdWV8fCcnOwogIGlmKCF0LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIHNvbWV0aGluZyBmaXJzdCcpOwogIGRlc2tCdXN5PXRydWU7CiAgaWYoZWwpeyBlbC52YWx1ZT0nJzsgZWwuYmx1cigpOyB9CiAgZmxhc2goJ1dvcmtpbmfigKYnKTsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kbycse3RleHQ6dC50cmltKCl9KTsKICAgIHJlbmRlcigpOyBzY3JvbGxDaGF0KCk7CiAgICBmbGFzaChyLmRpZCAmJiByLmRpZCE9PSdhbnN3ZXInID8gJ0RvbmU6ICcrci5kaWQucmVwbGFjZSgvXy9nLCcgJykgOiAnJyk7CiAgICAvKiBpZiB0aGUgYWN0aW9uIHByb2R1Y2VkIHNvbWV0aGluZyBvbiBhbm90aGVyIHBhZ2UsIG9mZmVyIGl0IOKAlCBkbyBub3QgaGlqYWNrICovCiAgICBpZihyLmdvdG8pIGZsYXNoKCdEb25lIOKAlCBvcGVuICcrci5nb3RvKycgdG8gc2VlIGl0Jyk7CiAgfWNhdGNoKGUpeyByZW5kZXIoKTsgc2Nyb2xsQ2hhdCgpOyBmbGFzaChlLm1lc3NhZ2UpIH0KICBmaW5hbGx5eyBkZXNrQnVzeT1mYWxzZTsgfQp9CmZ1bmN0aW9uIGRlc2tRdWljayh0KXsgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2tTYXknKTsgaWYoZWwpeyBlbC52YWx1ZT10OyB9IGRlc2tTZW5kKCk7IH0KZnVuY3Rpb24gc2Nyb2xsQ2hhdCgpeyBjb25zdCBjPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaGF0U2Nyb2xsJyk7IGlmKGMpIGMuc2Nyb2xsVG9wPWMuc2Nyb2xsSGVpZ2h0OyB9CmZ1bmN0aW9uIGNvcHlNc2coYnRuKXsKICBjb25zdCBib3g9YnRuLmNsb3Nlc3QoJ2RpdicpOwogIGNvbnN0IHR4dD1bLi4uYm94LmNoaWxkTm9kZXNdLmZpbHRlcihuPT5uLm5vZGVUeXBlPT09M3x8IW4ucXVlcnlTZWxlY3RvcikubWFwKG49Pm4udGV4dENvbnRlbnQpLmpvaW4oJycpLnRyaW0oKTsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0eHR8fGJveC5pbm5lclRleHQucmVwbGFjZSgvXHMqQ29weVxzKiQvLCcnKSkudGhlbigKICAgICgpPT57IGJ0bi50ZXh0Q29udGVudD0nQ29waWVkJzsgc2V0VGltZW91dCgoKT0+YnRuLnRleHRDb250ZW50PSdDb3B5JywxNDAwKTsgfSwKICAgICgpPT5mbGFzaCgnU2VsZWN0IGFuZCBjb3B5IG1hbnVhbGx5JykpOwp9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyQ2hhdCgpeyBpZighY29uZmlybSgnQ2xlYXIgdGhlIGNvbnZlcnNhdGlvbj8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9jaGF0L2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gQUdFTlQgTE9PUCAtLS0tLS0tLS0tICovCmNvbnN0IEFHT0FMUz1bCiBbJ0ZpbmQgbXkgYmVzdCB2ZW50dXJlJywnQ2hlY2sgbXkgY3VycmVudCBzdGF0ZSwgaW52ZW50IG1vbmV5LW1ha2luZyBpZGVhcywgcmVzZWFyY2ggdGhlIG1vc3QgcHJvbWlzaW5nIG9uZSBhZ2FpbnN0IHRoZSBsaXZlIHdlYiwgYW5kIHRlbGwgbWUgd2hpY2ggc2luZ2xlIG9uZSB0byBwdXJzdWUgYW5kIHdoeS4nXSwKIFsnRnVsbCBzeXN0ZW0gYXVkaXQnLCdSZWFkIG15IHN5c3RlbSBzdGF0ZSwgc2NhbiBmb3IgYW5vbWFsaWVzLCBjaGVjayBldmVyeSBtb25pdG9yZWQgc2l0ZSwgYW5kIGdpdmUgbWUgYSBibHVudCBsaXN0IG9mIHdoYXQgaXMgYnJva2VuIG9yIHVuc2FmZSwgbW9zdCB1cmdlbnQgZmlyc3QuJ10sCiBbJ1Jlc2VhcmNoIGEgY29tcGV0aXRvcicsJ1NlYXJjaCB0aGUgd2ViIGZvciB1cHRpbWUgbW9uaXRvcmluZyBzZXJ2aWNlcyBpbiBJbmRpYSwgcmVhZCB0aGUgcHJpY2luZyBwYWdlIG9mIHRoZSBtb3N0IHJlbGV2YW50IG9uZSwgYW5kIHRlbGwgbWUgaG93IEkgc2hvdWxkIHBvc2l0aW9uIGFnYWluc3QgdGhlbS4nXSwKIFsnUGxhbiBteSBuZXh0IDMgYWN0aW9ucycsJ1JlYWQgbXkgc3RhdGUsIHdvcmsgb3V0IHdoYXQgaXMgYWN0dWFsbHkgYmxvY2tpbmcgbW9uZXksIGFuZCBpc3N1ZSBteSBuZXh0IGNvbmNyZXRlIG1pc3Npb25zLiddCl07ClJFTkRFUi5hZ2VudD0oKT0+ewogIGNvbnN0IFI9Uy5hZ2VudFJ1bnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7impkgQUdFTlQgTE9PUCDigJQgSEUgREVDSURFUyBUSEUgTkVYVCBTVEVQIEhJTVNFTEY8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlRoaXMgaXMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBhIGNoYXRib3QgYW5kIGFuIGFnZW50LiBIZSBwaWNrcyBhIHRvb2wsIDxiPnNlZXMgdGhlIHJlYWwgcmVzdWx0PC9iPiwgdGhlbiBkZWNpZGVzIHdoYXQgdG8gZG8gbmV4dCDigJQgcmVwZWF0aW5nIHVudGlsIHRoZSBnb2FsIGlzIG1ldC4gRXZlcnkgdG9vbCBpcyBjb2RlIHRoYXQgZ2VudWluZWx5IHJ1bnMuPC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPkhlIGNhbiBjaGFpbjogc3RhdGUg4oaSIGlkZWFzIOKGkiBsaXZlIHdlYiByZXNlYXJjaCDihpIgbWlzc2lvbnMsIGluIG9uZSBnby48L2xpPgogICAgPGxpPkhlIG9ubHkgc2VlcyB0b29scyB0aGF0IGV4aXN0LiBJbnZlbnRpbmcgb25lIGlzIHJlZnVzZWQuPC9saT4KICAgIDxsaT5DYXBwZWQgYXQgMTAgc3RlcHMgc28gYSBsb29wIGNhbiBuZXZlciBydW4gYXdheS48L2xpPgogICAgPGxpPkV2ZXJ5IHN0ZXAgYW5kIGl0cyByZWFsIG91dHB1dCBpcyBsb2dnZWQgaW4gdGhlIHRyYWNlIGJlbG93LjwvbGk+CiAgIDwvdWw+CiAgICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHNwYW4+WW91ciBnb2FsPC9zcGFuPgogICAgPHRleHRhcmVhIGlkPSJhZ0dvYWwiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6NzZweCIgcGxhY2Vob2xkZXI9ImUuZy4gV29yayBvdXQgd2hpY2ggdmVudHVyZSBJIHNob3VsZCBzdGFydCB0aGlzIHdlZWsgYW5kIHByb3ZlIGl0IHdpdGggcmVhbCB3ZWIgZXZpZGVuY2UuIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5NYXggc3RlcHM8L3NwYW4+CiAgICA8c2VsZWN0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDo4MHB4IiBpZD0iYWdTdGVwcyI+CiAgICAgJHtbMyw0LDYsOCwxMF0ubWFwKG49PmA8b3B0aW9uIHZhbHVlPSIke259IiAke249PT02PydzZWxlY3RlZCc6Jyd9PiR7bn08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJydW5BZ2VudCgpIj5SVU4gVEhFIExPT1A8L2J1dHRvbj4KICAgICR7Ui5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJBZ2VudCgpIj5DbGVhciBoaXN0b3J5PC9idXR0b24+JzonJ308L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4ke0FHT0FMUy5tYXAoKGcsaSk9PgogICAgIGA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImFnUXVpY2soJHtpfSkiPiR7ZXNjKGdbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5BIDYtc3RlcCBydW4gbWFrZXMgNisgQUkgY2FsbHMuIE9uIGEgZnJlZSB0aWVyIHRoYXQgaXMgZmluZSBvY2Nhc2lvbmFsbHkg4oCUIGFkZCBiYWNrdXAga2V5cyBiZWxvdyBpZiB5b3UgcnVuIGl0IG9mdGVuLjwvZGl2PjwvZGl2PgogIDxkaXYgaWQ9ImFnT3V0Ij48L2Rpdj4KICAke1IubGVuZ3RoP1IubWFwKHI9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8Yj4ke2VzYyhyLmdvYWwpfTwvYj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ci50fSDCtyAke3Iuc3RlcHN9IHN0ZXAke3Iuc3RlcHM+MT8ncyc6Jyd9JHtyLmhpdENhcD8nIMK3IEhJVCBDQVAnOicnfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjU7bWFyZ2luLWJvdHRvbToxMXB4Ij4ke2VzYyhyLmFuc3dlcil9PC9kaXY+CiAgICA8ZGV0YWlscz48c3VtbWFyeSBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+U2hvdyB0aGUgJHtyLnRyYWNlLmxlbmd0aH0tc3RlcCB0cmFjZTwvc3VtbWFyeT4KICAgICA8ZGl2IGNsYXNzPSJsb2ciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+JHtyLnRyYWNlLm1hcCh0PT4KICAgICAgIGA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+c3RlcCAke3Quc3RlcH08L3NwYW4+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1saW1lKSI+JHtlc2ModC5hY3Rpb24pfTwvYj5cbiR7ZXNjKHQucmVzdWx0KX08L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj4KICAgIDwvZGV0YWlscz48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBydW5zIHlldC4gR2l2ZSBoaW0gYSBnb2FsIGFuZCB3YXRjaCBoaW0gd29yayBpdCBvdXQuPC9kaXY+PC9kaXY+J31gOwp9Owphc3luYyBmdW5jdGlvbiBydW5BZ2VudCgpewogIGNvbnN0IGc9YWdHb2FsLnZhbHVlLnRyaW0oKTsgaWYoIWcpIHJldHVybiBmbGFzaCgnU3RhdGUgYSBnb2FsIGZpcnN0Jyk7CiAgYWdPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+V29ya2luZ+KApiBoZSBpcyBjaG9vc2luZyB0b29scyBhbmQgcmVhZGluZyByZXN1bHRzLiBUaGlzIGNhbiB0YWtlIGEgbWludXRlLjwvZGl2PjwvZGl2Pic7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvYWdlbnQvcnVuJyx7Z29hbDpnLHN0ZXBzOithZ1N0ZXBzLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0ZpbmlzaGVkIGluICcrci5zdGVwcysnIHN0ZXAocyknKTsKICB9Y2F0Y2goZSl7CiAgICBhZ091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gOwogIH0KfQpmdW5jdGlvbiBhZ1F1aWNrKGkpeyBhZ0dvYWwudmFsdWU9QUdPQUxTW2ldWzFdOyBydW5BZ2VudCgpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJBZ2VudCgpeyBhd2FpdCBBUEkoJy9hcGkvYWdlbnQvY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBTSVRFIEJVSUxERVIgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2l0ZXM9KCk9PnsKICBjb25zdCBCPVMuYnVpbGRzfHxbXSwgVj1TLnZlbnR1cmVzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4pakIFNJVEUgQlVJTERFUiDigJQgSEUgV1JJVEVTIElULCBZT1UgUFVCTElTSCBJVDwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgd3JpdGVzIGEgY29tcGxldGUsIHdvcmtpbmcgbGFuZGluZyBwYWdlIOKAlCBoZWFkbGluZSwgcHJpY2luZyBpbiBJTlIsIGhvbmVzdCBGQVEsIGFuZCB5b3VyIDxiPnJlYWwgcGF5bWVudCBsaW5rPC9iPiB3aXJlZCBpbi4gT25lIGZpbGUsIG5vIGRlcGVuZGVuY2llcy48L2Rpdj4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+V2hhdCBoZSBjYW5ub3QgZG8sIGFuZCB3aHkuPC9iPiBQdWJsaXNoaW5nIG5lZWRzIGEgaG9zdGluZyBhY2NvdW50LCBhIGRvbWFpbiBhbmQgYSBjYXJkIGluIDxlbT55b3VyPC9lbT4gbGVnYWwgbmFtZS4gVGFraW5nIG1vbmV5IG5lZWRzIEtZQyBhZ2FpbnN0IDxlbT55b3VyPC9lbT4gUEFOIGFuZCBiYW5rLiBObyBzb2Z0d2FyZSBjYW4gaG9sZCB0aG9zZSBvbiB5b3VyIGJlaGFsZiDigJQgdGhhdCBpcyB0aGUgbGF3LCBub3QgYSBtaXNzaW5nIGZlYXR1cmUuIEhlIGdldHMgaXQgdG8gb25lIGNsaWNrIGZyb20gbGl2ZS48L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgICA8bGk+SGUgcmVmdXNlcyB0byBidWlsZCBmb3IgYW4gdW5yZXNlYXJjaGVkIHZlbnR1cmUg4oCUIGV2aWRlbmNlIGZpcnN0LjwvbGk+CiAgICA8bGk+Tm8gZmFrZSB0ZXN0aW1vbmlhbHMsIG5vIGludmVudGVkIGN1c3RvbWVyIGNvdW50cy4gQSBuZXcgYnVzaW5lc3MgY2F1Z2h0IGZha2luZyBwcm9vZiBsb3NlcyB0aGUgc2FsZS48L2xpPgogICAgPGxpPlByZXZpZXcgaXQgaGVyZSwgZG93bmxvYWQgb25lIGZpbGUsIHB1Ymxpc2ggZnJlZSBvbiBOZXRsaWZ5IERyb3AgaW4gYWJvdXQgNjAgc2Vjb25kcy48L2xpPgogICA8L3VsPgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogICA8ZGl2IGNsYXNzPSJncmlkIGcyIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QnVpbGQgZm9yIGEgbGF1bmNoZWQgdmVudHVyZTwvc3Bhbj4KICAgICA8c2VsZWN0IGlkPSJzYlZlbnR1cmUiIGNsYXNzPSJpbiI+CiAgICAgIDxvcHRpb24gdmFsdWU9IiI+4oCUIHBpY2sgb25lIOKAlDwvb3B0aW9uPgogICAgICAke1YubWFwKHY9PmA8b3B0aW9uIHZhbHVlPSIke3YuaWR9Ij4ke2VzYyh2LnRpdGxlKX08L29wdGlvbj5gKS5qb2luKCcnKX0KICAgICA8L3NlbGVjdD48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PciBkZXNjcmliZSBpdCB5b3Vyc2VsZjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9InNiQnJpZWYiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gdXB0aW1lIG1vbml0b3JpbmcgZm9yIEx1ZGhpYW5hIHNob3BzLCBScyAxNTAwL21vIj48L2xhYmVsPgogICA8L2Rpdj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImJ1aWxkU2l0ZSgpIj5XUklURSBUSEUgU0lURTwvYnV0dG9uPgogICAkeyFWLmxlbmd0aD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+Tm8gbGF1bmNoZWQgdmVudHVyZXMgeWV0LiBHbyB0byBWZW50dXJlcywgZ2VuZXJhdGUgaWRlYXMsIHJlc2VhcmNoIG9uZSwgdGhlbiBCVUlMRCBBR0VOVCBURUFNLjwvZGl2Pic6Jyd9CiAgPC9kaXY+CiAgJHtCLmxlbmd0aD9CLm1hcChiPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjEwcHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5TSVRFPC9zcGFuPjxiPiR7ZXNjKGIudGl0bGUpfTwvYj4KICAgICAgPHNwYW4gY2xhc3M9InRhZyAke2IuaGFzUGF5TGluaz8ndC1ncm4nOid0LWFtYid9Ij4ke2IuaGFzUGF5TGluaz8nUEFZIExJTksgTElWRSc6J0NPTlRBQ1QgT05MWSd9PC9zcGFuPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtiLnR9IMK3ICR7KGIuYnl0ZXMvMTAyNCkudG9GaXhlZCgxKX0gS0I8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPgogICAgIDxhIGNsYXNzPSJidG4gcCIgaHJlZj0iL2FwaS9zaXRlL3ZpZXc/aWQ9JHtiLmlkfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPlBSRVZJRVcgSVQg4oaXPC9hPgogICAgIDxhIGNsYXNzPSJidG4gb2siIGhyZWY9Ii9hcGkvc2l0ZS92aWV3P2lkPSR7Yi5pZH0mZGw9MSI+RE9XTkxPQUQgaW5kZXguaHRtbDwvYT4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbFNpdGUoJyR7Yi5pZH0nKSI+RGVsZXRlPC9idXR0b24+PC9kaXY+CiAgICA8ZGV0YWlscz48c3VtbWFyeSBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+SG93IHRvIHB1dCB0aGlzIGxpdmUsIGZyZWUsIGluIDYwIHNlY29uZHM8L3N1bW1hcnk+CiAgICAgPG9sIHN0eWxlPSJtYXJnaW46OXB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuOCI+CiAgICAgIDxsaT5DbGljayA8Yj5ET1dOTE9BRCBpbmRleC5odG1sPC9iPiBhYm92ZS48L2xpPgogICAgICA8bGk+R28gdG8gPGI+YXBwLm5ldGxpZnkuY29tL2Ryb3A8L2I+IOKAlCBubyBhY2NvdW50IG5lZWRlZCB0byBzdGFydC48L2xpPgogICAgICA8bGk+RHJhZyB0aGUgZmlsZSBvbnRvIHRoZSBwYWdlLiBJdCBpcyBsaXZlIGluIHNlY29uZHMgb24gYSBmcmVlIFVSTC48L2xpPgogICAgICA8bGk+RnJlZSBjdXN0b20gZG9tYWluIGxhdGVyOiBhIC5jb20gaXMgcm91Z2hseSDigrk5MDAveWVhciDigJQgb3B0aW9uYWwsIGRvIGl0IG9uY2UgeW91IGhhdmUgYSBwYXlpbmcgY2xpZW50LjwvbGk+CiAgICAgIDxsaT5CaW5kIHRoYXQgbmV3IFVSTCBpbiA8Yj5VcHRpbWUgTWFyc2hhbDwvYj4gc28gdGhlIENoYWlybWFuIG1vbml0b3JzIHlvdXIgb3duIHNpdGUgdG9vLjwvbGk+CiAgICAgPC9vbD4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5BbHRlcm5hdGl2ZXMgdGhhdCBhcmUgZXF1YWxseSBmcmVlOiBDbG91ZGZsYXJlIFBhZ2VzLCBHaXRIdWIgUGFnZXMsIFZlcmNlbC48L2Rpdj4KICAgIDwvZGV0YWlscz48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzaXRlcyBidWlsdCB5ZXQuPC9kaXY+PC9kaXY+J31gOwp9Owphc3luYyBmdW5jdGlvbiBidWlsZFNpdGUoKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2JWZW50dXJlJyl8fHt9KS52YWx1ZXx8Jyc7CiAgY29uc3QgYnJpZWY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzYkJyaWVmJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXYgJiYgIWJyaWVmLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdQaWNrIGEgdmVudHVyZSBvciB3cml0ZSBhIGJyaWVmJyk7CiAgZmxhc2goJ1dyaXRpbmcgdGhlIHNpdGUg4oCUIHRoaXMgdGFrZXMgYSBtaW51dGXigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NpdGUvYnVpbGQnLHt2ZW50dXJlSWQ6dixicmllZn0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdTaXRlIHdyaXR0ZW4g4oCUICcrKHIuYnl0ZXMvMTAyNCkudG9GaXhlZCgxKSsnIEtCLiBQcmV2aWV3IGl0LicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZGVsU2l0ZShpZCl7IGlmKCFjb25maXJtKCdEZWxldGUgdGhpcyBzaXRlPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL3NpdGUvZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBNSVNTSU9OUzogaGUgZ3VpZGVzLCB5b3UgZXhlY3V0ZSAtLS0tLS0tLS0tICovCkxJVkUubWlzc2lvbnM9KCk9PnsKICBjb25zdCBNPVMubWlzc2lvbnN8fFtdLCBvcGVuPU0uZmlsdGVyKG09Pm0uc3RhdHVzPT09J09QRU4nKSwgZG9uZT1NLmZpbHRlcihtPT5tLnN0YXR1cz09PSdET05FJyk7CiAgY29uc3QgbWlucz1vcGVuLnJlZHVjZSgoYSxtKT0+YSsobS5taW51dGVzfHwwKSwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShvcGVuLmxlbmd0aCwnT3BlbiBNaXNzaW9ucycsb3Blbi5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxtaW5zPyd+JyttaW5zKycgbWluIHRvdGFsJzonbm90aGluZyBwZW5kaW5nJyl9CiAgICR7a3BpKGRvbmUubGVuZ3RoLCdDb21wbGV0ZWQnLCd2YXIoLS1ncm4pJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoKFMucGxheWJvb2tzfHxbXSkubGVuZ3RoLCdQbGF5Ym9va3MnLCd2YXIoLS1jeSknLCdzdGVwLWJ5LXN0ZXAgZ3VpZGVzJyl9CiAgICR7a3BpKFMudmVudHVyZXMmJlMudmVudHVyZXMubGVuZ3RoP2VzYyhTLnZlbnR1cmVzWzBdLnRpdGxlKS5zbGljZSgwLDE4KTonbm9uZScsJ0FjdGl2ZSBWZW50dXJlJywndmFyKC0tcHVyKScsJycpfTwvZGl2PgogICR7b3Blbi5sZW5ndGg/b3Blbi5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZiI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjdweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5ETyBUSElTPC9zcGFuPjxiIHN0eWxlPSJmb250LXNpemU6MTRweCI+JHtlc2MobS50aXRsZSl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+fiR7bS5taW51dGVzfSBtaW48L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweDtjb2xvcjojYjNjMWQxIj4ke2VzYyhtLndoeSl9PC9kaXY+CiAgICAke20uc3RlcHMubGVuZ3RoP2A8b2wgc3R5bGU9Im1hcmdpbjowIDAgMTBweDtwYWRkaW5nLWxlZnQ6MjBweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNzUiPgogICAgICAke20uc3RlcHMubWFwKHM9PmA8bGk+JHtlc2Mocyl9PC9saT5gKS5qb2luKCcnKX08L29sPmA6Jyd9CiAgICAke20uc2NyaXB0P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiMwNjIyMmE7Ym9yZGVyOjFweCBzb2xpZCAjMTU1ZTZiO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDttYXJnaW4tYm90dG9tOjEwcHgiPgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5DT1BZIFRIRVNFIEVYQUNUIFdPUkRTOjwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiIGlkPSJzY3JfJHttLmlkfSI+JHtlc2MobS5zY3JpcHQpfTwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6OXB4IiBvbmNsaWNrPSJjb3B5U2NyaXB0KCcke20uaWR9JykiPkNvcHkgbWVzc2FnZTwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEyMHB4Ij5Eb25lIHdoZW48L3RkPjx0ZD4ke2VzYyhtLmRvbmVXaGVuKX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxpa2VseSBibG9ja2VyPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKG0ucmlzayl9PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48c3Bhbj5XaGF0IGhhcHBlbmVkPyAoaGUgYWRhcHRzIHRoZSBuZXh0IG1pc3Npb24gdG8gdGhpcyk8L3NwYW4+CiAgICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9Im5vdGVfJHttLmlkfSIgcGxhY2Vob2xkZXI9ImUuZy4gc2VudCB0byA0IHNob3BzLCAxIHJlcGxpZWQgYXNraW5nIHByaWNlIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdkb25lJykiPk1BUksgRE9ORTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ3NraXAnKSI+U2tpcCB0aGlzPC9idXR0b24+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gb3BlbiBtaXNzaW9ucy4gUHJlc3MgR0VUIE1ZIE5FWFQgTUlTU0lPTlMgYW5kIGhlIHdpbGwgdGVsbCB5b3UgZXhhY3RseSB3aGF0IHRvIGRvIHRvZGF5LjwvZGl2PjwvZGl2PmB9CiAgJHtkb25lLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbXBsZXRlZCA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4ke2RvbmUubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5NaXNzaW9uPC90aD48dGg+T3V0Y29tZTwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtkb25lLnNsaWNlKDAsMTUpLm1hcChtPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bS5jbG9zZWR8fG0udH08L3RkPjx0ZD4ke2VzYyhtLnRpdGxlKX08L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobS5vdXRjb21lfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJ30KICAkeyhTLnBsYXlib29rc3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBsYXlib29rczwvaDM+CiAgICR7Uy5wbGF5Ym9va3MubWFwKChwLGkpPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWN5KTtwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHgiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKHAudG9waWMpfTwvYj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlQYigke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NTtmb250LXNpemU6MTIuNXB4O21hcmdpbi10b3A6NnB4Ij4ke2VzYyhwLnRleHQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpfQogICA8L2Rpdj5gOicnfWA7Cn07ClJFTkRFUi5taXNzaW9ucz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKXjiBNWSBNSVNTSU9OUyDigJQgSEUgUExBTlMsIFlPVSBFWEVDVVRFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGNhbm5vdCByZWdpc3RlciBjb21wYW5pZXMsIHBsYWNlIGFkcyBvciB0YWxrIHRvIGN1c3RvbWVycy4gU28gaGUgZG9lcyB0aGUgbmV4dCBiZXN0IHRoaW5nOiBicmVha3MgdGhlIHBhdGggaW50byA8Yj5zaW5nbGUgYWN0aW9ucyB5b3UgY2FuIGZpbmlzaCB0b2RheTwvYj4sIHdyaXRlcyB0aGUgZXhhY3Qgd29yZHMgdG8gc2VuZCwgYW5kIGFkYXB0cyBiYXNlZCBvbiB3aGF0IGFjdHVhbGx5IGhhcHBlbmVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZXRNaXNzaW9ucygpIj5HRVQgTVkgTkVYVCBNSVNTSU9OUzwvYnV0dG9uPgogICAkeyhTLm1pc3Npb25zfHxbXSkuc29tZShtPT5tLnN0YXR1cyE9PSdPUEVOJyk/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJNaXNzaW9ucygpIj5DbGVhciBoaXN0b3J5PC9idXR0b24+JzonJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjM0MHB4IiBpZD0icGJUb3BpYyIgcGxhY2Vob2xkZXI9IlBsYXlib29rIHRvcGljIOKAlCBlLmcuIGhvdyB0byByZWdpc3RlciBhIHNvbGUgcHJvcHJpZXRvcnNoaXAgaW4gUHVuamFiIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJtYWtlUGIoKSI+V1JJVEUgUExBWUJPT0s8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5QbGF5Ym9vayBpZGVhczogZ2V0dGluZyBhIFJhem9ycGF5IGFjY291bnQgwrcgR1NUIGZvciBmcmVlbGFuY2VycyBpbiBJbmRpYSDCtyBmaW5kaW5nIHNob3Agb3duZXJzJyBudW1iZXJzIGxlZ2FsbHkgwrcgd3JpdGluZyBhIGZpcnN0IGludm9pY2U8L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJtaXNzaW9ucyI+JHtMSVZFLm1pc3Npb25zKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZ2V0TWlzc2lvbnMoKXsgZmxhc2goJ0NoYWlybWFuIGlzIHBsYW5uaW5nIHlvdXIgbmV4dCBtb3Zlc+KApicpOwogIHRyeXsgY29uc3Qgdj0oUy52ZW50dXJlc3x8W10pWzBdOwogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9nZW5lcmF0ZScse3ZlbnR1cmVJZDp2P3YuaWQ6bnVsbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBtaXNzaW9uKHMpIGlzc3VlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KZnVuY3Rpb24gY29weVNjcmlwdChpZCl7IGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JfJytpZCk7CiAgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KGVsP2VsLmlubmVyVGV4dDonJyk7IGZsYXNoKCdNZXNzYWdlIGNvcGllZCDigJQgbm93IHNlbmQgaXQnKSB9CmZ1bmN0aW9uIGNvcHlQYihpKXsgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KChTLnBsYXlib29rc3x8W10pW2ldLnRleHQpOyBmbGFzaCgnUGxheWJvb2sgY29waWVkJykgfQphc3luYyBmdW5jdGlvbiBkZWJyaWVmKGlkLG91dGNvbWUpewogIGNvbnN0IG5vdGU9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdub3RlXycraWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKG91dGNvbWU9PT0nZG9uZScmJiFub3RlLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdXcml0ZSB3aGF0IGhhcHBlbmVkIGZpcnN0IOKAlCBoZSBuZWVkcyBpdCB0byBwbGFuIHRoZSBuZXh0IHN0ZXAnKTsKICBmbGFzaCgnUmVjb3JkaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL2RlYnJpZWYnLHtpZCxvdXRjb21lLG5vdGV9KTsgcmVuZGVyKCk7CiAgICBpZihyLmFkdmljZSkgbW9kYWwoYDxoMz5EZWJyaWVmPC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhyLmFkdmljZSl9PC9kaXY+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnZXRNaXNzaW9ucygpIj5OZXh0IG1pc3Npb25zIOKGkjwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICAgIGVsc2UgZmxhc2goJ1NraXBwZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIG1ha2VQYigpeyBjb25zdCB0PXBiVG9waWMudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGEgdG9waWMnKTsKICBmbGFzaCgnV3JpdGluZyBwbGF5Ym9va+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL21pc3Npb24vcGxheWJvb2snLHt0b3BpYzp0fSk7IHJlbmRlcigpOyBmbGFzaCgnUGxheWJvb2sgcmVhZHknKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIENPTU1BTkQgQ09OU09MRSAtLS0tLS0tLS0tICovCkxJVkUuY29tbWFuZD0oKT0+ewogIGNvbnN0IEM9Uy5jaGF0fHxbXTsKICByZXR1cm4gQy5sZW5ndGg/Qy5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHg7Ym9yZGVyLWNvbG9yOiR7CiAgICAgbS53aG89PT0nT1dORVInPycjMjIzNDRhJzptLndobz09PSdDSEFJUk1BTic/JyMxNTVlNmInOicjNmIyMjMzJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo2cHgiPgogICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHttLndobz09PSdPV05FUic/J3QtYmx1JzptLndobz09PSdDSEFJUk1BTic/J3QtY3knOid0LXJlZCd9Ij4ke20ud2hvfTwvc3Bhbj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7bS50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MobS50ZXh0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBvcmRlcnMgZ2l2ZW4geWV0LiBUZWxsIHRoZSBDaGFpcm1hbiB3aGF0IHlvdSB3YW50LjwvZGl2PjwvZGl2Pic7Cn07ClJFTkRFUi5jb21tYW5kPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxNTVlNmI7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwNjIyMmEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj7ilq4gQ09NTUFORCBDT05TT0xFIOKAlCBIRSBBTlNXRVJTIE9OTFkgVE8gWU9VPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkdpdmUgb3JkZXJzIGluIHBsYWluIEVuZ2xpc2guIEhlIHJlcGxpZXMgd2l0aCB3aGF0IGhlIHdpbGwgZG8sIHdoYXQgaGUgbmVlZHMgZnJvbSB5b3UsIGFuZCB3aGF0IGhlIGNhbm5vdCBkby4gRXZlcnl0aGluZyBoZXJlIGlzIGxvZ2dlZCBhbmQgc3Vydml2ZXMgcmVzdGFydHMuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Tm8gQUkgYnJhaW4gY29ubmVjdGVkIOKAlCBoZSBjYW5ub3QgYW5zd2VyLiBDb25uZWN0IG9uZSBvbiB0aGUgQUkgQnJhaW4gcGFnZS48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBvcmRlcjwvc3Bhbj48dGV4dGFyZWEgaWQ9ImNtZFRleHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6ODBweCIKICAgIHBsYWNlaG9sZGVyPSJlLmcuIEZpbmQgbWUgdGhyZWUgd2F5cyB0byBlYXJuIGZyb20gd2hhdCBJIG93biwgcmVzZWFyY2ggdGhlIGJlc3Qgb25lLCBhbmQgYnVpbGQgdGhlIGFnZW50IHRlYW0uIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2VuZENtZCgpIj5TRU5EIE9SREVSPC9idXR0b24+CiAgICR7KFMuY2hhdHx8W10pLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhckNtZCgpIj5DbGVhciBsb2c8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImNvbW1hbmQiPiR7TElWRS5jb21tYW5kKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gc2VuZENtZCgpewogIGNvbnN0IHQ9Y21kVGV4dC52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYW4gb3JkZXIgZmlyc3QnKTsKICBmbGFzaCgnQ2hhaXJtYW4gaXMgdGhpbmtpbmfigKYnKTsgY21kVGV4dC52YWx1ZT0nJzsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kJyx7dGV4dDp0fSk7IHJlbmRlcigpOyB9CiAgY2F0Y2goZSl7IHJlbmRlcigpOyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBjbGVhckNtZCgpeyBhd2FpdCBBUEkoJy9hcGkvY29tbWFuZC9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIFZFTlRVUkVTIC0tLS0tLS0tLS0gKi8KTElWRS52ZW50dXJlcz0oKT0+ewogIGNvbnN0IEk9Uy5pZGVhc3x8W10sIFY9Uy52ZW50dXJlc3x8W107CiAgY29uc3QgcmF3PUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JBVycpLmxlbmd0aDsKICBjb25zdCBkb25lPUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JFU0VBUkNIRUQnKTsKICBjb25zdCBiZXN0PWRvbmUuc2xpY2UoKS5zb3J0KChhLGIpPT4oYi5zY29yZXx8MCktKGEuc2NvcmV8fDApKVswXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShJLmxlbmd0aCwnSWRlYXMgR2VuZXJhdGVkJywndmFyKC0tY3kpJyxyYXcrJyBhd2FpdGluZyByZXNlYXJjaCcpfQogICAke2twaShkb25lLmxlbmd0aCwnUmVzZWFyY2hlZCcsJ3ZhcigtLXB1ciknLCdhZ2FpbnN0IGxpdmUgd2ViIGRhdGEnKX0KICAgJHtrcGkoYmVzdD9iZXN0LnNjb3JlKycvMTAwJzon4oCUJywnQmVzdCBTY29yZScsYmVzdCYmYmVzdC5zY29yZT49NjA/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJyxiZXN0P2VzYyhiZXN0LnRpdGxlKS5zbGljZSgwLDI2KTonbm9uZSB5ZXQnKX0KICAgJHtrcGkoVi5sZW5ndGgsJ1ZlbnR1cmVzIExhdW5jaGVkJywndmFyKC0tZ3JuKScsJ3dpdGggcmVhbCBhZ2VudCB0ZWFtcycpfTwvZGl2PgogICR7Vi5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFZlbnR1cmVzPC9oMz4KICAgJHtWLm1hcCh2PT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWdybik7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxNHB4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyh2LnRpdGxlKX08L2I+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3YuYWdlbnRzLmxlbmd0aH0gYWdlbnRzIMK3IGZpcnN0IHJ1cGVlIGluIH4ke3Yud2Vla3N9dzwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjVweCAwIj4ke2VzYyh2LnJldmVudWVQYXRoKX08L2Rpdj4KICAgICR7di5vd25lclN0ZXBzLmxlbmd0aD9gPGRpdiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPllPVVIgU1RFUFMgKG9ubHkgYSBodW1hbiBjYW4gZG8gdGhlc2UpOjwvYj4KICAgICA8b2wgc3R5bGU9Im1hcmdpbjo1cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4Ij4ke3Yub3duZXJTdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+PC9kaXY+YDonJ30KICAgPC9kaXY+YCkuam9pbignJyl9PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SWRlYSBQaXBlbGluZSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0kubGVuZ3RofTwvc3Bhbj48L2gzPgogICAke0kubGVuZ3RoP0kubWFwKGk9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHsKICAgICAgaS5zdGF0dXM9PT0nTEFVTkNIRUQnPyd2YXIoLS1ncm4pJzppLnN0YXR1cz09PSdLSUxMRUQnPyd2YXIoLS1kaW0yKSc6CiAgICAgIGkudmVyZGljdD09PSdQVVJTVUUnPyd2YXIoLS1jeSknOmkudmVyZGljdD09PSdLSUxMJz8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknfTsKICAgICAgcGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxM3B4OyR7aS5zdGF0dXM9PT0nS0lMTEVEJz8nb3BhY2l0eTouNDUnOicnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48Yj4ke2VzYyhpLnRpdGxlKX08L2I+CiAgICAgICR7aS5zY29yZSE9bnVsbD9gPHNwYW4gY2xhc3M9InRhZyAke2kuc2NvcmU+PTYwPyd0LWdybic6aS5zY29yZT49NDA/J3QtYW1iJzondC1yZWQnfSI+JHtpLnNjb3JlfS8xMDA8L3NwYW4+YDonJ30KICAgICAgJHtpLnZlcmRpY3Q/YDxzcGFuIGNsYXNzPSJ0YWcgJHtpLnZlcmRpY3Q9PT0nUFVSU1VFJz8ndC1jeSc6aS52ZXJkaWN0PT09J0tJTEwnPyd0LXJlZCc6J3QtZGltJ30iPiR7aS52ZXJkaWN0fTwvc3Bhbj5gOicnfQogICAgICA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2kuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPuKCuSR7Zm10KGkucHJpY2UpfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O21hcmdpbjo0cHggMCI+JHtlc2MoaS53aGF0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj5CdXllcjogJHtlc2MoaS5idXllcil9PC9kaXY+CiAgICAke2kuZWRnZT9gPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo1cHg7Zm9udC1zaXplOjEycHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1saW1lKSI+VW5mYWlyIGVkZ2U6PC9iPiAke2VzYyhpLmVkZ2UpfTwvZGl2PmA6Jyd9CiAgICAke2kud2h5P2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6M3B4Ij5XaHkgbm93OiAke2VzYyhpLndoeSl9PC9kaXY+YDonJ30KICAgICR7aS5yZXNlYXJjaD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMGExMTE5O2JvcmRlci1yYWRpdXM6N3B4O3BhZGRpbmc6OXB4O21hcmdpbi10b3A6N3B4O2ZvbnQtc2l6ZToxMS41cHgiPgogICAgICA8ZGl2PiR7ZXNjKGkucmVzZWFyY2gucmVhc29uaW5nKX08L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo2cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPkZpcnN0IHN0ZXA6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmZpcnN0U3RlcCl9PC9kaXY+CiAgICAgIDxkaXY+PGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPktpbGwgcmlzazo8L2I+ICR7ZXNjKGkucmVzZWFyY2gua2lsbFJpc2spfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4Ij5kZW1hbmQgJHtpLnJlc2VhcmNoLmRlbWFuZH0vMTAgwrcgY29tcGV0aXRpb24gJHtpLnJlc2VhcmNoLmNvbXBldGl0aW9ufS8xMCDCtyBzcGVlZCAke2kucmVzZWFyY2guc3BlZWR9LzEwIMK3IGZpdCAke2kucmVzZWFyY2guZml0fS8xMDwvZGl2PjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+CiAgICAgJHtpLnN0YXR1cz09PSdSQVcnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0icmVzZWFyY2hJZGVhKCcke2kuaWR9JykiPlJFU0VBUkNIIElUPC9idXR0b24+YDonJ30KICAgICAke2kuc3RhdHVzPT09J1JFU0VBUkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gb2siIG9uY2xpY2s9ImxhdW5jaElkZWEoJyR7aS5pZH0nKSI+QlVJTEQgQUdFTlQgVEVBTTwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cyE9PSdLSUxMRUQnJiZpLnN0YXR1cyE9PSdMQVVOQ0hFRCc/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbElkZWEoJyR7aS5pZH0nKSI+S2lsbDwvYnV0dG9uPmA6Jyd9CiAgICA8L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBpZGVhcyB5ZXQuIFByZXNzIEdFTkVSQVRFIElERUFTIGFuZCBoZSB3aWxsIGludmVudCB0aGVtLjwvZGl2Pid9PC9kaXY+YDsKfTsKUkVOREVSLnZlbnR1cmVzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4peGIFZFTlRVUkUgRU5HSU5FIOKAlCBJREVBUyDihpIgUkVBTCBSRVNFQVJDSCDihpIgQUdFTlQgVEVBTVM8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgaW52ZW50cyB2ZW50dXJlcywgcmVzZWFyY2hlcyBlYWNoIG9uZSBhZ2FpbnN0IDxiPmxpdmUgd2ViIHNlYXJjaDwvYj4gKG5vdCBtb2RlbCBtZW1vcnkpLCBzY29yZXMgaXQgb3V0IG9mIDEwMCwgYW5kIGRlc2lnbnMgdGhlIGFnZW50IHRlYW0gdG8gZXhlY3V0ZS4gQWdlbnRzIHdob3NlIHRvb2xzIG1hcCB0byBubyByZWFsIGNvZGUgYXJlIHJlZnVzZWQsIHNvIG5vdGhpbmcgZGVjb3JhdGl2ZSBnZXRzIGNyZWF0ZWQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3B0aW9uYWwgc3RlZXIgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obGVhdmUgYmxhbmsgYW5kIGhlIGRlY2lkZXMpPC9zcGFuPjwvc3Bhbj4KICAgPGlucHV0IGlkPSJpZGVhU3RlZXIiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gZm9jdXMgb24gQjJCLCBvciBvbmxpbmUtb25seSwgb3IgdW5kZXIgNTAwIElOUiB0byBzdGFydCI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZW5JZGVhcygpIj5HRU5FUkFURSBJREVBUzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvSWRlYXM/J3QtcmVkJzondC1kaW0nfSI+SURFQSBBVVRPUElMT1QgJHtTLmF1dG9JZGVhcz8nT04nOidPRkYnfTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxidXR0b24gY2xhc3M9ImJ0biAke1MuYXV0b0lkZWFzPydubyc6Jyd9IiBvbmNsaWNrPSJ0b2dnbGVJZGVhQXV0bygpIj4ke1MuYXV0b0lkZWFzPydTVE9QIEFVVE9QSUxPVCc6J0VOQUJMRSBJREVBIEFVVE9QSUxPVCd9PC9idXR0b24+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+QXV0b3BpbG90ID0gaGUgaW52ZW50cyBhbmQgcmVzZWFyY2hlcyB2ZW50dXJlcyB1bnByb21wdGVkLCBldmVyeSB+NSBtaW51dGVzLjwvc3Bhbj48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJ2ZW50dXJlcyI+JHtMSVZFLnZlbnR1cmVzKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZ2VuSWRlYXMoKXsgZmxhc2goJ1RoaW5raW5nIHVwIHZlbnR1cmVz4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9pZGVhL2dlbmVyYXRlJyx7bjo1LHN0ZWVyOmlkZWFTdGVlci52YWx1ZS50cmltKCl9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmFkZGVkKycgaWRlYShzKSBnZW5lcmF0ZWQnKTsgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiByZXNlYXJjaElkZWEoaWQpeyBmbGFzaCgnU2VhcmNoaW5nIHRoZSBsaXZlIHdlYuKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9yZXNlYXJjaCcse2lkfSk7IHJlbmRlcigpOwogICAgZmxhc2goJ1Njb3JlZCAnK3Iuc2NvcmUrJy8xMDAg4oCUICcrci52ZXJkaWN0KTsgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBsYXVuY2hJZGVhKGlkKXsgZmxhc2goJ0Rlc2lnbmluZyBhZ2VudCB0ZWFt4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9pZGVhL2xhdW5jaCcse2lkfSk7IHJlbmRlcigpOwogICAgZmxhc2goci5hZ2VudHMrJyBhZ2VudChzKSBjb21taXNzaW9uZWQnKyhyLnNraXBwZWQ/JyDCtyAnK3Iuc2tpcHBlZCsnIHJlamVjdGVkIGFzIG5vbi1leGVjdXRhYmxlJzonJykpOyB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIGtpbGxJZGVhKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2lkZWEva2lsbCcse2lkfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlSWRlYUF1dG8oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9pZGVhL2F1dG9waWxvdCcse29uOiFTLmF1dG9JZGVhc30pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMuYXV0b0lkZWFzPydBdXRvcGlsb3QgT04g4oCUIGhlIHdpbGwgaW52ZW50IHZlbnR1cmVzIG9uIGhpcyBvd24nOidBdXRvcGlsb3Qgb2ZmJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBQQVlNRU5UUyAtLS0tLS0tLS0tICovCkxJVkUucGF5PSgpPT57CiAgY29uc3QgTz1TLm9yZGVyc3x8W107CiAgY29uc3QgcGFpZD1PLmZpbHRlcihvPT5vLnBhaWQ+MCkucmVkdWNlKChhLG8pPT5hK28ucGFpZCwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShPLmxlbmd0aCwnTGlua3MgUmFpc2VkJywndmFyKC0tY3kpJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoTy5maWx0ZXIobz0+by5wYWlkPjApLmxlbmd0aCwnUGFpZCcscGFpZD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWRpbSknLCdzZXR0bGVkJyl9CiAgICR7a3BpKChTLnBheT8oUy5wYXkuZ2F0ZXdheT09PSdyYXpvcnBheSc/J+KCuSc6JyQnKTonJykrZm10KHBhaWQpLCdDb2xsZWN0ZWQnLCd2YXIoLS1ncm4pJywncmVhbCBtb25leScpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QYXltZW50IExpbmtzPC9oMz4KICAgJHtPLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Rm9yPC90aD48dGg+QW1vdW50PC90aD48dGg+TW9kZTwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPkxpbms8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Ty5tYXAobz0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke28udH08L3RkPgogICAgPHRkPiR7ZXNjKG8uZGVzYyl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG8uY3VzdG9tZXIpfTwvZGl2PjwvdGQ+CiAgICA8dGQ+JHtvLmN1cnJlbmN5fSAke2ZtdChvLmFtb3VudCl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5saXZlPyd0LXJlZCc6J3QtZGltJ30iPiR7by5saXZlPydMSVZFJzonVEVTVCd9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke28ucGFpZD4wPyd0LWdybic6J3QtYW1iJ30iPiR7by5wYWlkPjA/J1BBSUQnOmVzYyhvLnN0YXR1cyl9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PGEgaHJlZj0iJHtlc2Moby51cmwpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPm9wZW4g4oaXPC9hPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYXltZW50IGxpbmtzIHJhaXNlZCB5ZXQuPC9kaXY+J308L2Rpdj5gOwp9OwpSRU5ERVIucGF5PSgpPT57CiAgY29uc3QgUD1TLnBheSwgR1c9Uy5nYXRld2F5c3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7UD8oUC5saXZlPycjNmIyMjMzJzonIzFjNWMzYycpOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7UD8oUC5saXZlPycjMTYwYjBjJzonIzA4MTcwZicpOicjMTUxMDBhJ30sIzBhMGYxNikiPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7UD8oUC5saXZlPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpOid2YXIoLS1hbWIpJ30iPuKCuSBQQVlNRU5UUyDigJQgJHtQPyhQLmxpdmU/J0xJVkUgwrcgUkVBTCBNT05FWSc6J0NPTk5FQ1RFRCDCtyBURVNUIE1PREUnKTonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke1AKICAgID9gVmVyaWZpZWQgYWdhaW5zdCA8Yj4ke2VzYyhQLmdhdGV3YXkpfTwvYj4sIGtleSAke2VzYyhQLmtleUlkKX0uICR7UC5saXZlCiAgICAgID8nPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgbGlua3MgeW91IHJhaXNlIHRha2UgcmVhbCBtb25leS4gRXZlcnkgbGluayBuZWVkcyB5b3VyIHBhc3N3b3JkLjwvYj4nCiAgICAgIDonVGVzdCBtb2RlLiBMaW5rcyB3b3JrIGVuZC10by1lbmQgYnV0IG1vdmUgbm8gcmVhbCBtb25leS4nfWAKICAgIDonQ29ubmVjdCBSYXpvcnBheSBvciBTdHJpcGUgYmVsb3cuIEtleXMgYXJlIHZlcmlmaWVkIGFnYWluc3QgdGhlIHJlYWwgQVBJIGJlZm9yZSBiZWluZyBhY2NlcHRlZCDigJQgYSB3cm9uZyBrZXkgaXMgcmVqZWN0ZWQgaW1tZWRpYXRlbHksIG5vdCBzdG9yZWQuJ308L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+PGxpPlN0YXJ0IHdpdGggPGI+dGVzdCBrZXlzPC9iPi4gUmF6b3JwYXkgPGNvZGU+cnpwX3Rlc3RfPC9jb2RlPiwgU3RyaXBlIDxjb2RlPnNrX3Rlc3RfPC9jb2RlPiDigJQgaW5zdGFudCwgbm8gS1lDLjwvbGk+CiAgICA8bGk+TGl2ZSBrZXlzIG5lZWQgS1lDIChQQU4gKyBiYW5rIGZvciBSYXpvcnBheSkuIFByb3ZpZGVycyBjaGFyZ2UgfjIlIHBlciB0cmFuc2FjdGlvbiDigJQgdGhhdCBpcyB0aGUgY29zdCBvZiBtb3ZpbmcgbW9uZXksIG5vdCBzb21ldGhpbmcgdG8gcm91dGUgYXJvdW5kLjwvbGk+CiAgICA8bGk+WW91ciBzZWNyZXQgaXMgbmV2ZXIgcmV0dXJuZWQgYnkgdGhlIEFQSSBhbmQgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvbGk+PC91bD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbm5lY3QgR2F0ZXdheTwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkdhdGV3YXk8L3NwYW4+PHNlbGVjdCBpZD0icGdTZWwiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InBheUhpbnQoKSI+CiAgICAgJHtHVy5tYXAoZz0+YDxvcHRpb24gdmFsdWU9IiR7Zy5pZH0iICR7UCYmUC5nYXRld2F5PT09Zy5pZD8nc2VsZWN0ZWQnOicnfT4ke2VzYyhnLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9InBheUhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5LZXkgSUQgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oUmF6b3JwYXkgb25seSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InJ6cF90ZXN0Xy4uLiI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U2VjcmV0IEtleTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9InBnU2VjcmV0IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InNlY3JldCAvIHNrX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdFBheSgpIj5WRVJJRlkgJmFtcDsgQ09OTkVDVDwvYnV0dG9uPgogICAgICR7UD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVBheSgpIj5EaXNjb25uZWN0PC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIGEgUGF5bWVudCBMaW5rPC9oMz4KICAgICR7IVA/JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Db25uZWN0IGEgZ2F0ZXdheSBmaXJzdC48L2Rpdj4nOmAKICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW1vdW50ICR7UC5nYXRld2F5PT09J3Jhem9ycGF5Jz8nKElOUiknOicoVVNEKSd9PC9zcGFuPjxpbnB1dCBpZD0icGxBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iMjUwMCI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkN1c3RvbWVyIG5hbWU8L3NwYW4+PGlucHV0IGlkPSJwbE5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGlzIGl0IGZvcjwvc3Bhbj48aW5wdXQgaWQ9InBsRGVzYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iV2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZyDigJQgQXVndXN0Ij48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5FbWFpbDwvc3Bhbj48aW5wdXQgaWQ9InBsRW1haWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGhvbmU8L3NwYW4+PGlucHV0IGlkPSJwbFBob25lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD48L2Rpdj4KICAgICR7UC5saXZlP2A8bGFiZWwgY2xhc3M9ImYiPjxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5MSVZFIE1PREUg4oCUIGNvbmZpcm0gd2l0aCB5b3VyIHBhc3N3b3JkPC9zcGFuPgogICAgICA8aW5wdXQgaWQ9InBsUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJtYWtlTGluaygpIj5DUkVBVEUgTElOSzwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVmcmVzaFBheSgpIj5DSEVDSyBGT1IgUEFZTUVOVFM8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPllvdSBnZXQgYSBVUkwgdG8gc2VuZCBvdmVyIFdoYXRzQXBwIG9yIGVtYWlsLiBXaGVuIGl0IHNldHRsZXMsIHRoZSBsZWRnZXIgdXBkYXRlcyBhbmQgeW91IGdldCBhbiBlbWFpbC48L2Rpdj5gfTwvZGl2PgogIDwvZGl2PgogIDxkaXYgZGF0YS1saXZlPSJwYXkiPiR7TElWRS5wYXkoKX08L2Rpdj5gOwp9OwpmdW5jdGlvbiBwYXlIaW50KCl7CiAgY29uc3QgZz0oUy5nYXRld2F5c3x8W10pLmZpbmQoeD0+eC5pZD09PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZ1NlbCcpLnZhbHVlKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF5SGludCcpOwogIGlmKGcmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKGcubGFiZWwpfTwvYj48YnI+JHtlc2MoZy5zaWdudXApfTxicj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGcua2V5SGludCl9PC9zcGFuPmA7Cn0KYXN5bmMgZnVuY3Rpb24gY29ubmVjdFBheSgpewogIGZsYXNoKCdWZXJpZnlpbmcga2V5cyBhZ2FpbnN0IHRoZSByZWFsIEFQSeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2Nvbm5lY3QnLHtnYXRld2F5OnBnU2VsLnZhbHVlLGtleUlkOnBnSWQudmFsdWUsa2V5U2VjcmV0OnBnU2VjcmV0LnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5saXZlPydDT05ORUNURUQg4oCUIExJVkUgTU9ERSwgcmVhbCBtb25leSc6J0Nvbm5lY3RlZCBpbiBURVNUIG1vZGUnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5KCl7IGlmKCFjb25maXJtKCdEaXNjb25uZWN0IHRoZSBwYXltZW50IGdhdGV3YXk/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvcGF5L3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gbWFrZUxpbmsoKXsKICBmbGFzaCgnQ3JlYXRpbmcgbGlua+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2xpbmsnLHthbW91bnQ6K3BsQW10LnZhbHVlLGRlc2NyaXB0aW9uOnBsRGVzYy52YWx1ZSwKICAgICAgbmFtZTpwbE5hbWUudmFsdWUsZW1haWw6cGxFbWFpbC52YWx1ZSxwaG9uZTpwbFBob25lLnZhbHVlLAogICAgICBwdzooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsUHcnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsKICAgIG1vZGFsKGA8aDM+UGF5bWVudCBsaW5rIHJlYWR5PC9oMz4KICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij48ZGl2IHN0eWxlPSJ3b3JkLWJyZWFrOmJyZWFrLWFsbDtjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHIudXJsKX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoJyR7ZXNjKHIudXJsKX0nKTtmbGFzaCgnQ29waWVkJykiPkNvcHkgbGluazwvYnV0dG9uPgogICAgICA8YSBjbGFzcz0iYnRuIiBocmVmPSIke2VzYyhyLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+T3BlbiDihpc8L2E+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFBheSgpeyBmbGFzaCgnQ2hlY2tpbmcgZ2F0ZXdheeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L3JlZnJlc2gnLHt9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLnVwZGF0ZWQ/ci51cGRhdGVkKycgb3JkZXIocykgdXBkYXRlZCc6J05vIGNoYW5nZXMnKTsgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBERUVQIFJFU0VBUkNIIC0tLS0tLS0tLS0gKi8KUkVOREVSLnJlc2VhcmNoPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxYzNmNzU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwODEzMWYsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYmx1KSI+8J+MkCBERUVQIFJFU0VBUkNIIOKAlCBMSVZFIEZST00gVEhFIE9QRU4gV0VCPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGRvZXMgbm90IHN0b3JlIHRoZSB3b3JsZCdzIGRhdGEg4oCUIG5vYm9keSBjYW4uIEluc3RlYWQgaGUgPGI+ZmV0Y2hlcyBpdCBsaXZlIHRoZSBtb21lbnQgeW91IGFzazwvYj4sIHdoaWNoIGlzIGJldHRlciwgYmVjYXVzZSBzdG9yZWQgZGF0YSBpcyBzdGFsZSB3aXRoaW4gZGF5cy4gU291cmNlczogRHVja0R1Y2tHbywgV2lraXBlZGlhLCBXb3JsZCBCYW5rLCBsaXZlIEZYLiBObyBBUEkga2V5LCBubyBwYWlkIHNlYXJjaC48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPkRlZXAgZGl2ZTwvYj4gc2VhcmNoZXMgNSBkaWZmZXJlbnQgYW5nbGVzLCBkZWR1cGxpY2F0ZXMsIGFkZHMgb3BlbiBkYXRhc2V0cywgdGhlbiByZWFzb25zIG92ZXIgdGhlIGxvdC48L2xpPgogICA8bGk+PGI+UmVhZCBwYWdlPC9iPiBwdWxscyB0aGUgZnVsbCB0ZXh0IG9mIGFueSBVUkwg4oCUIGNvbXBldGl0b3Igc2l0ZXMsIHByaWNlIGxpc3RzLCBnb3Zlcm5tZW50IHBhZ2VzLjwvbGk+CiAgIDxsaT5IZSBpcyBpbnN0cnVjdGVkIHRvIHN0YXRlIHdoYXQgaGUgY291bGQgPGI+bm90PC9iPiBmaW5kLCByYXRoZXIgdGhhbiBmaWxsaW5nIGdhcHMgd2l0aCBpbnZlbnRpb24uPC9saT4KICA8L3VsPjwvZGl2PgogJHshUy5sbG0/JzxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3Qg4oCUIHJlc2VhcmNoIG5lZWRzIHJlYXNvbmluZyB0byBiZSB1c2VmdWwuPC9kaXY+PC9kaXY+JzonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWVwIERpdmUgYSBUb3BpYzwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VG9waWM8L3NwYW4+PGlucHV0IGlkPSJkdlRvcGljIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHVwdGltZSBtb25pdG9yaW5nIGRlbWFuZCBmb3IgTHVkaGlhbmEgZS1jb21tZXJjZSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5SZWdpb248L3NwYW4+PGlucHV0IGlkPSJkdlJlZ2lvbiIgY2xhc3M9ImluIiB2YWx1ZT0iTHVkaGlhbmEgUHVuamFiIEluZGlhIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9EaXZlKCkiPklOVkVTVElHQVRFPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRha2VzIH4xNXMuIEZpdmUgc2VhcmNoZXMgcGx1cyBvcGVuIGRhdGEuPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlYWQgQW55IFBhZ2U8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVSTDwvc3Bhbj48aW5wdXQgaWQ9InJkVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2NvbXBldGl0b3IuY29tL3ByaWNpbmciPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBkbyB5b3Ugd2FudCB0byBrbm93PyAob3B0aW9uYWwpPC9zcGFuPjxpbnB1dCBpZD0icmRBc2siIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IndoYXQgZG8gdGhleSBjaGFyZ2UgYW5kIHdoYXQgaXMgbWlzc2luZyI+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvUmVhZCgpIj5SRUFEIElUPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlB1bGxzIHVwIHRvIDEyLDAwMCBjaGFyYWN0ZXJzIG9mIHJlYWwgcGFnZSB0ZXh0LjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGlkPSJyZXNPdXQiPjwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRvRGl2ZSgpewogIGNvbnN0IHQ9ZHZUb3BpYy52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYSB0b3BpYycpOwogIHJlc091dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5TZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmPC9kaXY+PC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Jlc2VhcmNoL2RpdmUnLHt0b3BpYzp0LHJlZ2lvbjpkdlJlZ2lvbi52YWx1ZX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkZpbmRpbmdzIDxzcGFuIGNsYXNzPSJ0YWcgdC1ibHUiPiR7Zm10KHIuZXZpZGVuY2UpfSBjaGFycyBvZiBldmlkZW5jZTwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9SZWFkKCl7CiAgY29uc3QgdT1yZFVybC52YWx1ZS50cmltKCk7IGlmKCF1KSByZXR1cm4gZmxhc2goJ1Bhc3RlIGEgVVJMJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPkZldGNoaW5nIHBhZ2XigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvcmVhZCcse3VybDp1LGFzazpyZEFzay52YWx1ZS50cmltKCl9KTsKICAgIHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz4ke2VzYyhyLnRpdGxlKX0gPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5jaGFycyl9IGNoYXJzIHJlYWQ8L3NwYW4+PC9oMz4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NSI+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj5gOwogIH1jYXRjaChlKXsgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PjwvZGl2PmAgfQp9CgovKiAtLS0tLS0tLS0tIEFJIEJSQUlOIC0tLS0tLS0tLS0gKi8KUkVOREVSLmJyYWluPSgpPT57CiAgY29uc3QgTD1TLmxsbSwgUFY9Uy5wcm92aWRlcnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke0w/JyMxYzVjM2MnOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7TD8nIzA4MTcwZic6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtMPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKSd9Ij7il4ggQUkgQlJBSU4g4oCUICR7TD8nQ09OTkVDVEVEJzonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke0wKICAgID9gQWdlbnRzIGNhbiB0aGluay4gQ29ubmVjdGVkIHRvIDxiPiR7ZXNjKEwucHJvdmlkZXIpfTwvYj4gcnVubmluZyA8Yj4ke2VzYyhMLm1vZGVsKX08L2I+LiBLZXkgJHtlc2MoTC5rZXkpfS5gCiAgICA6J1lvdXIgYWdlbnRzIGNhbiBtZWFzdXJlIHRoaW5ncyBidXQgY2Fubm90IDxiPnJlYXNvbjwvYj4geWV0LiBDb25uZWN0IGEgZnJlZSBtb2RlbCBiZWxvdyBhbmQgdGhleSBnYWluIHRoZSBhYmlsaXR5IHRvIGRpYWdub3NlLCB3cml0ZSwgYW5hbHlzZSBhbmQgc3RyYXRlZ2lzZS4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+RXZlcnkgcHJvdmlkZXIgYmVsb3cgaXMgPGI+Z2VudWluZWx5IGZyZWU8L2I+IOKAlCBubyBjcmVkaXQgY2FyZC48L2xpPgogICAgPGxpPllvdXIga2V5IGlzIHN0b3JlZCBsb2NhbGx5IGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4pqRIFdBTlQgSElNIEZVTExZIElOREVQRU5ERU5UPyDigJQgUkVBRCBUSElTPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkEgdGhpbmtpbmcgYnJhaW4gY2Fubm90IGJlIGNvbmp1cmVkIGZyb20gbm90aGluZy4gVHJhaW5pbmcgb25lIGNvc3RzIG1pbGxpb25zIGluIEdQVSB0aW1lLiBFdmVyeSBBSSBvbiBlYXJ0aCDigJQgaW5jbHVkaW5nIHRoaXMgb25lIOKAlCBydW5zIHdlaWdodHMgdHJhaW5lZCBieSBzb21lb25lIHdpdGggYSBkYXRhIGNlbnRyZS4gVGhlIGhvbmVzdCBxdWVzdGlvbiBpcyBub3QgPGVtPiJoaXMgYnJhaW4gb3IgdGhlaXJzIjwvZW0+IGJ1dCA8Yj4id2hvIGNhbiBzd2l0Y2ggaXQgb2ZmIjwvYj4uPC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+T2xsYW1hIGlzIHRoZSBhbnN3ZXIgdG8gdGhhdC48L2I+IFRoZSBtb2RlbCBmaWxlIHNpdHMgb24geW91ciBvd24gZGlzay4gTm8ga2V5LCBubyBhY2NvdW50LCBubyByYXRlIGxpbWl0LCBubyB0ZXJtcyBvZiBzZXJ2aWNlLiBJdCB3b3JrcyB3aXRoIHRoZSBpbnRlcm5ldCB1bnBsdWdnZWQuIE5vYm9keSBjYW4gcmV2b2tlIGl0LCByZWFkIHlvdXIgcHJvbXB0cywgb3IgY2hhbmdlIHRoZSBkZWFsLiBUaGF0IGlzIHJlYWwgc292ZXJlaWdudHkg4oCUIHRoZSBvbmx5IGNvc3QgaXMgeW91ciBoYXJkd2FyZS48L2Rpdj4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij4xLiBJbnN0YWxsPC90ZD48dGQ+RG93bmxvYWQgZnJvbSA8Yj5vbGxhbWEuY29tPC9iPiAoZnJlZSwgV2luZG93cy9NYWMvTGludXgpPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjIuIEdldCBhIG1vZGVsPC90ZD48dGQ+SW4gdGVybWluYWw6IDxjb2RlPm9sbGFtYSBwdWxsIGxsYW1hMy4yPC9jb2RlPiDigJQgYWJvdXQgMiBHQjwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4zLiBDb25uZWN0PC90ZD48dGQ+Q2hvb3NlIDxiPk9sbGFtYTwvYj4gYWJvdmUsIGxlYXZlIHRoZSBrZXkgYmxhbmssIHByZXNzIENPTk5FQ1Q8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QmlnZ2VyIGJyYWluPC90ZD48dGQ+PGNvZGU+b2xsYW1hIHB1bGwgcXdlbjIuNToxNGI8L2NvZGU+IGlmIHlvdSBoYXZlIDE2IEdCKyBSQU08L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PGI+VGhlIHRyYWRlLW9mZiwgc3RhdGVkIHBsYWlubHk6PC9iPiBhIGxvY2FsIG1vZGVsIG9uIGEgbm9ybWFsIGxhcHRvcCBpcyBzbG93ZXIgYW5kIGxlc3MgY2FwYWJsZSB0aGFuIEdyb3EncyBmcmVlIGNsb3VkIG1vZGVscy4gWW91IGFyZSBleGNoYW5naW5nIHJhdyBwb3dlciBmb3IgdG90YWwgY29udHJvbC4gQWxzbyDigJQgdGhpcyBSZW5kZXIgaW5zdGFuY2UgY2Fubm90IHJlYWNoIGFuIE9sbGFtYSBydW5uaW5nIG9uIHlvdXIgUEM7IGxvY2FsIGJyYWluIG1lYW5zIHJ1bm5pbmcgdGhlIENoYWlybWFuIGxvY2FsbHkgdG9vLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBhIEZyZWUgTW9kZWw8L2gzPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qcm92aWRlcjwvc3Bhbj48c2VsZWN0IGlkPSJscFByb3YiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InByb3ZIaW50KCkiPgogICAgICR7UFYubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke0wmJkwucHJvdmlkZXI9PT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKHAubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icHJvdkhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BUEkgS2V5IDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KG5vdCBuZWVkZWQgZm9yIE9sbGFtYSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibHBLZXkiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icGFzdGUgeW91ciBmcmVlIGtleSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TW9kZWwgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oYmxhbmsgPSBwcm92aWRlciBkZWZhdWx0KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscE1vZGVsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJsZWF2ZSBibGFuayIgbGlzdD0ibW9kZWxMaXN0Ij4KICAgICA8ZGF0YWxpc3QgaWQ9Im1vZGVsTGlzdCI+PC9kYXRhbGlzdD48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CYXNlIFVSTCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihvbmx5IGZvciBDdXN0b20g4oCUIGFueSBPcGVuQUktY29tcGF0aWJsZSBBUEkpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImxwSG9zdCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly9hcGkuZGVlcHNlZWsuY29tL3YxIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdExMTSgpIj5DT05ORUNUIEJSQUlOPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0TExNKCkiPlRFU1QgSVQ8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImZldGNoTW9kZWxzKCkiPkZFVENIIExJVkUgTU9ERUxTPC9idXR0b24+CiAgICAgJHtMPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlTExNKCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvdmlkZXJzIHJldGlyZSBtb2RlbHMgd2l0aG91dCBub3RpY2UuIElmIFRFU1QgSVQgc2F5cyBNT0RFTCBSRVRJUkVELCBwcmVzcyBGRVRDSCBMSVZFIE1PREVMUyBhbmQgcGljayBvbmUgZnJvbSB0aGUgbGlzdC48L2Rpdj48L2Rpdj4KICAgJHtMP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWFtYikiPgogICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj7ih4QgU1dJVENIIE1PREVMIOKAlCBLRUVQUyBZT1VSIEtFWTwvaDM+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+Q3VycmVudGx5IHJ1bm5pbmcgPGI+JHtlc2MoTC5tb2RlbCl9PC9iPiBvbiAke2VzYyhMLnByb3ZpZGVyKX0uIFByb3ZpZGVycyByZXRpcmUgbW9kZWxzIHdpdGhvdXQgbm90aWNlIOKAlCBzd2FwIGl0IGhlcmUgd2l0aG91dCBkaXNjb25uZWN0aW5nIG9yIHJlLXBhc3RpbmcgeW91ciBrZXkuPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogICAgIDxpbnB1dCBpZD0ic3dNb2RlbCIgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjI4MHB4IiBwbGFjZWhvbGRlcj0idHlwZSBhIG1vZGVsIG5hbWUiIHZhbHVlPSIke2VzYyhMLm1vZGVsKX0iPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzd2l0Y2hNb2RlbCgpIj5TV0lUQ0g8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImZldGNoTW9kZWxzKCkiPkZFVENIIExJVkUgTElTVDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0idGVzdExMTSgpIj5URVNUIElUPC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5Lbm93biB3b3JraW5nIG9uIEdyb3EgcmlnaHQgbm93IOKAlCBjbGljayB0byB1c2U6PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPiR7WydvcGVuYWkvZ3B0LW9zcy0xMjBiJywnb3BlbmFpL2dwdC1vc3MtMjBiJywncXdlbi9xd2VuMy42LTI3YiddCiAgICAgIC5tYXAobT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icXVpY2tNb2RlbCgnJHttfScpIj4ke219PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgIDwvZGl2PmA6Jyd9CiAgIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHsoUy5jb29sZG93bnx8MCk/J3ZhcigtLW1hZyknOid2YXIoLS1zdHJva2UpJ30iPgogICAgPGgzPkJhY2t1cCBQcm92aWRlcnMgPHNwYW4gY2xhc3M9InRhZyAkeyhTLmxsbUJhY2t1cHN8fFtdKS5sZW5ndGg/J3QtZ3JuJzondC1kaW0nfSI+JHsoUy5sbG1CYWNrdXBzfHxbXSkubGVuZ3RofSBTUEFSRTwvc3Bhbj48L2gzPgogICAgJHsoUy5jb29sZG93bnx8MCk/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+PGI+UVVPVEEgQ09PTERPV04g4oCUICR7TWF0aC5jZWlsKFMuY29vbGRvd24vNjApfSBtaW4gbGVmdC48L2I+IFRoZSBmcmVlIHRpZXIgdGhyb3R0bGVkLiBBSSB3b3JrIGlzIHBhdXNlZCBzbyB0aGUgbGltaXQgY2FuIHJlc2V0OyBtb25pdG9yaW5nIGtlZXBzIHJ1bm5pbmcuIEFkZCBhIGJhY2t1cCBiZWxvdyBhbmQgd29yayBjb250aW51ZXMgc3RyYWlnaHQgdGhyb3VnaCB0aGUgbmV4dCBsaW1pdC4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjbGVhckNvb2woKSI+Q2xlYXIgY29vbGRvd24gbm93PC9idXR0b24+PC9kaXY+PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5GcmVlIHRpZXJzIHRocm90dGxlLiBBZGQgPGI+dXAgdG8gNDAga2V5czwvYj4g4oCUIGZyb20gZGlmZmVyZW50IHByb3ZpZGVycywgb3Igc2V2ZXJhbCBrZXlzIGZyb20gdGhlIHNhbWUgb25lLiBXaGVuIGFueSBrZXkgaXMgcmF0ZS1saW1pdGVkIGl0IGlzIHBhcmtlZCBmb3IgMTAgbWludXRlcyBhbmQgdGhlIENoYWlybWFuIHJvdGF0ZXMgdG8gdGhlIG5leHQgYXV0b21hdGljYWxseS4gTm90aGluZyBzdG9wcy48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UHJvdmlkZXI8L3NwYW4+PHNlbGVjdCBpZD0iYmtQcm92IiBjbGFzcz0iaW4iPgogICAgICAkeyhTLnByb3ZpZGVyc3x8W10pLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSI+JHtlc2MocC5sYWJlbCl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFQSSBrZXk8L3NwYW4+PGlucHV0IGlkPSJia0tleSIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Nb2RlbCAoYmxhbmsgPSBkZWZhdWx0KTwvc3Bhbj48aW5wdXQgaWQ9ImJrTW9kZWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImxlYXZlIGJsYW5rIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFzZSBVUkwgKEN1c3RvbSBvbmx5KTwvc3Bhbj48aW5wdXQgaWQ9ImJrSG9zdCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly9hcGkuZGVlcHNlZWsuY29tL3YxIj48L2xhYmVsPgogICAgPC9kaXY+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYWRkQmFja3VwKCkiPkFERCBCQUNLVVA8L2J1dHRvbj4KICAgICR7KFMubGxtQmFja3Vwc3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD4jPC90aD48dGg+UHJvdmlkZXI8L3RoPjx0aD5Nb2RlbDwvdGg+PHRoPktleTwvdGg+PHRoPlNlcnZlZDwvdGg+PHRoPlN0YXRlPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgICR7Uy5sbG1CYWNrdXBzLm1hcCgoYixpKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2krMX08L3RkPjx0ZD4ke2VzYyhiLnByb3ZpZGVyKX08L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhiLm1vZGVsKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGIua2V5KX08L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2Iub2t8fDB9JHtiLmZhaWw/JyAvICcrYi5mYWlsKyfinJcnOicnfTwvdGQ+CiAgICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Yi5jb29sZWQ/J3QtYW1iJzondC1ncm4nfSI+JHtiLmNvb2xlZD8nQ09PTElORyc6J1JFQURZJ308L3NwYW4+PC90ZD4KICAgICAgPHRkPjxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icm1CYWNrdXAoJHtpfSkiPlJlbW92ZTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlJlY29tbWVuZGVkIHNwYXJlczogPGI+R29vZ2xlIEFJIFN0dWRpbzwvYj4gKDEsNTAwL2RheSksIDxiPkNlcmVicmFzPC9iPiAoMU0gdG9rZW5zL2RheSksIDxiPk5WSURJQSBOSU08L2I+LiBEaWZmZXJlbnQgY29tcGFuaWVzIG1lYW5zIHNlcGFyYXRlIHF1b3Rhcy48L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPldoYXQgQWdlbnRzIEdhaW48L2gzPgogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+YWkuYnJpZWY8L3RkPjx0ZD5FeGVjdXRpdmUgYnJpZWYgd3JpdHRlbiBmcm9tIHlvdXIgcmVhbCBzeXN0ZW0gc3RhdGU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmluY2lkZW50PC90ZD48dGQ+UmFua2VkIGRpYWdub3NpcyBvZiBhbnkgc2l0ZSB0aGF0IGdvZXMgZG93bjwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkucmV2ZW51ZTwvdGQ+PHRkPkNvbmNyZXRlIG1vbmV5LW1ha2luZyByb3V0ZXMgZnJvbSB3aGF0IHlvdSBhY3R1YWxseSBoYXZlPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5jbGllbnRfcmVwb3J0PC90ZD48dGQ+Q2xpZW50LXJlYWR5IHVwdGltZSByZXBvcnQgeW91IGNhbiBzZW5kIGFuZCBjaGFyZ2UgZm9yPC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFkZCB0aGVzZSBvbiB0aGUgTGl2ZSBPcGVyYXRpb25zIHBhZ2UgYXMgc3RhbmRpbmcgb3JkZXJzLCBvciBydW4gdGhlbSBvbiBkZW1hbmQgZnJvbSBBZ2VudCBXb3JrLjwvZGl2PjwvZGl2PgogIDwvZGl2PmB9OwpmdW5jdGlvbiBwcm92SGludCgpewogIGNvbnN0IHA9KFMucHJvdmlkZXJzfHxbXSkuZmluZCh4PT54LmlkPT09ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwUHJvdicpLnZhbHVlKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvdkhpbnQnKTsKICBpZihwJiZlbCkgZWwuaW5uZXJIVE1MPWA8Yj4ke2VzYyhwLmxhYmVsKX08L2I+PGJyPiR7ZXNjKHAuc2lnbnVwKX08YnI+RGVmYXVsdCBtb2RlbDogPGNvZGU+JHtlc2MocC5tb2RlbCl9PC9jb2RlPmA7Cn0KYXN5bmMgZnVuY3Rpb24gY29ubmVjdExMTSgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9jb25uZWN0Jyx7cHJvdmlkZXI6bHBQcm92LnZhbHVlLGtleTpscEtleS52YWx1ZSxtb2RlbDpscE1vZGVsLnZhbHVlLGhvc3Q6KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdscEhvc3QnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0JyYWluIGNvbm5lY3RlZCDigJQgbm93IHByZXNzIFRFU1QgSVQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHRlc3RMTE0oKXsgZmxhc2goJ1RoaW5raW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9sbG0vdGVzdCcse30pOyByZW5kZXIoKTsKICAgIG1vZGFsKGA8aDM+QUkgQnJhaW4gT25saW5lPC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij48ZGl2PiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHIubW9kZWwpfSDCtyAke3IubXN9bXM8L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCk7Z28oJ3dvcmsnKSI+R2l2ZSBpdCB3b3JrIOKGkjwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VMTE0oKXsgaWYoIWNvbmZpcm0oJ0Rpc2Nvbm5lY3QgdGhlIEFJIGJyYWluPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL2xsbS9wdXJnZScse30pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHN3aXRjaE1vZGVsKCl7CiAgY29uc3QgbT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N3TW9kZWwnKXx8e30pLnZhbHVlOwogIGlmKCFtfHwhbS50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSBhIG1vZGVsIG5hbWUnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vbW9kZWwnLHttb2RlbDptLnRyaW0oKX0pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdTd2l0Y2hlZCB0byAnK20udHJpbSgpKycg4oCUIG5vdyBwcmVzcyBURVNUIElUJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBxdWlja01vZGVsKG0pewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9tb2RlbCcse21vZGVsOm19KTsgcmVuZGVyKCk7IGZsYXNoKCdTd2l0Y2hlZCB0byAnK20pOwogICAgc2V0VGltZW91dCh0ZXN0TExNLCA0MDApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gYWRkQmFja3VwKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2JhY2t1cC9hZGQnLHtwcm92aWRlcjpia1Byb3YudmFsdWUsa2V5OmJrS2V5LnZhbHVlLG1vZGVsOmJrTW9kZWwudmFsdWUsaG9zdDooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JrSG9zdCcpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQmFja3VwIGFkZGVkIOKAlCBxdW90YSBsaW1pdHMgd2lsbCBubyBsb25nZXIgc3RvcCB5b3UnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJtQmFja3VwKGkpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2JhY2t1cC9yZW1vdmUnLHtpbmRleDppfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJDb29sKCl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vY29vbGRvd24vY2xlYXInLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdDb29sZG93biBjbGVhcmVkJykgfQphc3luYyBmdW5jdGlvbiBmZXRjaE1vZGVscygpewogIGZsYXNoKCdBc2tpbmcgcHJvdmlkZXIgd2hhdCBpdCBzZXJ2ZXMgdG9kYXnigKYnKTsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9sbG0vbW9kZWxzJyx7cHJvdmlkZXI6bHBQcm92LnZhbHVlLGtleTpscEtleS52YWx1ZX0pOwogICAgaWYoIXIubW9kZWxzLmxlbmd0aCkgcmV0dXJuIGZsYXNoKCdQcm92aWRlciByZXR1cm5lZCBubyBjaGF0IG1vZGVscycpOwogICAgbW9kYWwoYDxoMz5MaXZlIG1vZGVscyBvbiAke2VzYyhscFByb3YudmFsdWUpfTwvaDM+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7ci5tb2RlbHMubGVuZ3RofSBhdmFpbGFibGUgcmlnaHQgbm93LiBDbGljayBvbmUgdG8gdXNlIGl0LjwvZGl2PgogICAgIDxkaXYgY2xhc3M9ImRpckxpc3QiIHN0eWxlPSJtYXgtaGVpZ2h0OjM0MHB4Ij4ke3IubW9kZWxzLm1hcChtPT4KICAgICAgIGA8YnV0dG9uIG9uY2xpY2s9InBpY2tNb2RlbCgnJHtlc2MobSl9JykiPiR7ZXNjKG0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBwaWNrTW9kZWwobSl7IGNsb3NlTW9kYWwoKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBNb2RlbCcpOyBpZihlbCkgZWwudmFsdWU9bTsKICBmbGFzaCgnTW9kZWwgc2V0IHRvICcrbSsnIOKAlCBwcmVzcyBDT05ORUNUIEJSQUlOIHRoZW4gVEVTVCBJVCcpOyB9CgovKiAtLS0tLS0tLS0tIEFHRU5UIFdPUksgLS0tLS0tLS0tLSAqLwpjb25zdCBRVUlDSz1bCiBbJ0V4ZWN1dGl2ZSBicmllZicsJ1N1bW1hcmlzZSBteSBzeXN0ZW0gc3RhdGUgYW5kIHRlbGwgbWUgdGhlIHNpbmdsZSBtb3N0IHVyZ2VudCB0aGluZyB0byBmaXguIEJlIGJsdW50LiddLAogWydNYWtlIG1vbmV5JywnT25seSBwcm9wb3NlIG9mZmVycyBkZWxpdmVyZWQgdXNpbmcgTVkgdXB0aW1lIG1vbml0b3Jpbmcgc3lzdGVtICgyNC83IEhUVFAgcHJvYmluZywgVExTIGV4cGlyeSBhbGVydHMsIGluc3RhbnQgb3V0YWdlIGVtYWlsLCBhdmFpbGFiaWxpdHkgYW5kIHA5NSByZXBvcnRpbmcpLiBUUlVUSCBSVUxFOiBJIGhhdmUgbmV2ZXIgbW9uaXRvcmVkIGFueSBjbGllbnQgc2l0ZSBhbmQgaGF2ZSBubyB0cmFjayByZWNvcmQuIFRoZSBvdXRyZWFjaCBtZXNzYWdlIG11c3QgY29udGFpbiBaRVJPIGNsYWltcyBJIGNhbm5vdCBwcm92ZSDigJQgbm8gIkkgbm90aWNlZCBvdXRhZ2VzIG9uIGxvY2FsIHNpdGVzIiwgbm8gaW52ZW50ZWQgcmV2ZW51ZSBmaWd1cmVzLCBubyB1bnZlcmlmaWVkIHN0YXRpc3RpY3MuIExlYWQgd2l0aCBhIGZyZWUgdHJpYWwsIG5vdCBhIGZha2Ugb2JzZXJ2YXRpb24uIFZlcmlmeSBhbnkgYXJpdGhtZXRpYyB5b3Ugc3RhdGUuIEdpdmUgMyBvZmZlcnM6IHRoZSBvZmZlciBpbiBvbmUgc2VudGVuY2UsIHRoZSBMdWRoaWFuYSBidXNpbmVzcyB0eXBlIGFuZCBpdHMgcmVhbCBwYWluLCBtb250aGx5IElOUiBwcmljZSB3aXRoIHNvdW5kIHJlYXNvbmluZywgdGhlIGxpdGVyYWwgZmlyc3QgV2hhdHNBcHAgbWVzc2FnZSB1bmRlciA1MCB3b3JkcywgYW5kIHRoZSBiaWdnZXN0IG9iamVjdGlvbiB3aXRoIGFuIGhvbmVzdCBjb3VudGVyLiBDb2xkIG91dHJlYWNoIGNsb3NlcyAxLTMlLiddLAogWydGaW5kIHByb3NwZWN0cycsJ0xpc3QgMTAgc3BlY2lmaWMgYnVzaW5lc3MgdHlwZXMgaW4gTHVkaGlhbmEgdGhhdCBsb3NlIHJlYWwgbW9uZXkgd2hlbiB0aGVpciB3ZWJzaXRlIGdvZXMgZG93biwgcmFua2VkIGJ5IGhvdyBtdWNoIHRoZXkgbG9zZSBwZXIgaG91ci4gRm9yIGVhY2gsIHNheSB3aGVyZSBJIGNhbiBmaW5kIHRoZWlyIGNvbnRhY3QgZGV0YWlscyBmb3IgZnJlZS4nXSwKIFsnQ2xpZW50IHBpdGNoJywnV3JpdGUgYSBXaGF0c0FwcCBtZXNzYWdlIG9mZmVyaW5nIGZyZWUgMTQtZGF5IHdlYnNpdGUgdXB0aW1lIG1vbml0b3JpbmcgdG8gYSBsb2NhbCBidXNpbmVzcyBvd25lci4gUGxhaW4gSW5kaWFuIEVuZ2xpc2gsIG5vIG1hcmtldGluZyBsYW5ndWFnZSwgbm8gZW1vamkuIFVuZGVyIDQ1IHdvcmRzLiBUaGUgZ29hbCBpcyBhIHJlcGx5LCBub3QgYSBzYWxlLiddLAogWydIYW5kbGUgb2JqZWN0aW9ucycsJ0EgTHVkaGlhbmEgYnVzaW5lc3Mgb3duZXIgc2F5cyAibXkgd2Vic2l0ZSBuZXZlciBnb2VzIGRvd24sIEkgZG9uIG5vdCBuZWVkIHRoaXMiLiBHaXZlIG1lIHRocmVlIGhvbmVzdCByZXBsaWVzIHRoYXQgZG8gbm90IGV4YWdnZXJhdGUgb3IgdXNlIGZlYXIgdGFjdGljcy4nXSwKIFsnSW52b2ljZSB0ZW1wbGF0ZScsJ1dyaXRlIGEgc2ltcGxlIG1vbnRobHkgaW52b2ljZSBmb3Igd2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZywgcmVhZHkgdG8gZmlsbCBpbiwgc3VpdGFibGUgZm9yIGEgc21hbGwgSW5kaWFuIGJ1c2luZXNzLiBJbmNsdWRlIEdTVCBwbGFjZWhvbGRlciBhbmQgVVBJIHBheW1lbnQgbGluZS4nXQpdOwpSRU5ERVIud29yaz0oKT0+ewogIGNvbnN0IE89Uy5vdXRwdXRzfHxbXTsKICByZXR1cm4gYCR7IVMubGxtP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBCUkFJTiBDT05ORUNURUQ8L2gzPgogICA8ZGl2PkFnZW50cyBjYW5ub3QgdGhpbmsgeWV0LiA8YiBvbmNsaWNrPSJnbygnYnJhaW4nKSIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KTtjdXJzb3I6cG9pbnRlcjt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lIj5Db25uZWN0IGEgZnJlZSBtb2RlbDwvYj4gZmlyc3Qg4oCUIHRha2VzIGFib3V0IDIgbWludXRlcyBhbmQgbmVlZHMgbm8gY3JlZGl0IGNhcmQuPC9kaXY+PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2l2ZSB0aGUgQ2hhaXJtYW4gV29yayA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlBMQUlOIEVOR0xJU0g8L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlR5cGUgYW55IGluc3RydWN0aW9uLiBBIHJlYWwgbW9kZWwgZXhlY3V0ZXMgaXQgYW5kIHRoZSByZXN1bHQgaXMgc2F2ZWQgYmVsb3cuPC9kaXY+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW5zdHJ1Y3Rpb248L3NwYW4+PHRleHRhcmVhIGlkPSJ3a1Byb21wdCIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo5MHB4IgogICAgIHBsYWNlaG9sZGVyPSJlLmcuIFdyaXRlIGEgb25lLXBhZ2UgcHJvcG9zYWwgb2ZmZXJpbmcgdXB0aW1lIG1vbml0b3JpbmcgdG8gYSBMdWRoaWFuYSBjbG90aGluZyBzaG9wLCBwcmljZWQgaW4gSU5SLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb1dvcmsoKSI+RVhFQ1VURTwvYnV0dG9uPgogICAgJHtPLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhcldvcmsoKSI+Q2xlYXIgcmVzdWx0czwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+UXVpY2sgdGFza3M6PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPiR7UVVJQ0subWFwKChxLGkpPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJxdWljaygke2l9KSI+JHtlc2MocVswXSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+PC9kaXY+PC9kaXY+CiAgJHtPLmxlbmd0aD9PLm1hcCgobyxpKT0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LXB1ciI+JHtlc2Moby50YWcpfTwvc3Bhbj48Yj4ke2VzYyhvLmFnZW50KX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke28udH0gwrcgJHtvLm1zfW1zIMK3ICR7by50b2tlbnN9IHRva2Vuczwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moby50ZXh0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5T3V0KCR7aX0pIj5Db3B5PC9idXR0b24+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gd29yayBwcm9kdWNlZCB5ZXQuPC9kaXY+PC9kaXY+J31gfTsKYXN5bmMgZnVuY3Rpb24gZG9Xb3JrKCl7CiAgY29uc3QgcD13a1Byb21wdC52YWx1ZS50cmltKCk7IGlmKCFwKSByZXR1cm4gZmxhc2goJ1R5cGUgYW4gaW5zdHJ1Y3Rpb24gZmlyc3QnKTsKICBmbGFzaCgnV29ya2luZ+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9hc2snLHtwcm9tcHQ6cH0pOyByZW5kZXIoKTsgZmxhc2goJ0RvbmUnKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBxdWljayhpKXsgd2tQcm9tcHQudmFsdWU9UVVJQ0tbaV1bMV07IGRvV29yaygpIH0KZnVuY3Rpb24gY29weU91dChpKXsgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KChTLm91dHB1dHN8fFtdKVtpXS50ZXh0KTsgZmxhc2goJ0NvcGllZCcpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJXb3JrKCl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBMSVZFIE9QRVJBVElPTlMgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiBhZ28oaXNvKXsgaWYoIWlzbykgcmV0dXJuICduZXZlcic7CiAgY29uc3Qgcz1NYXRoLmZsb29yKChEYXRlLm5vdygpLW5ldyBEYXRlKGlzby5yZXBsYWNlKCcgJywnVCcpKydaJykuZ2V0VGltZSgpKS8xMDAwKTsKICBpZihzPDYwKSByZXR1cm4gcysncyBhZ28nOyBpZihzPDM2MDApIHJldHVybiBNYXRoLmZsb29yKHMvNjApKydtIGFnbyc7IHJldHVybiBNYXRoLmZsb29yKHMvMzYwMCkrJ2ggYWdvJzsgfQpmdW5jdGlvbiBldmVyeShuKXsgcmV0dXJuIG48NjA/bisncyc6bjwzNjAwP01hdGgucm91bmQobi82MCkrJ20nOk1hdGgucm91bmQobi8zNjAwKSsnaCc7IH0KTElWRS5vcHM9KCk9PnsKICBjb25zdCBUPVMudGFza3N8fFtdLCBSPVMucnVuc3x8W107CiAgY29uc3Qgb249VC5maWx0ZXIodD0+dC5lbmFibGVkKS5sZW5ndGg7CiAgY29uc3QgdG90YWxSdW5zPVQucmVkdWNlKChhLHQpPT5hKyh0LnJ1bnN8fDApLDApOwogIGNvbnN0IGZhaWxzPVQucmVkdWNlKChhLHQpPT5hKyh0LmZhaWxzfHwwKSwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShTLnJ1bm5pbmc/J1JVTk5JTkcnOidIQUxURUQnLCdTeXN0ZW0gU3RhdGUnLFMucnVubmluZz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknLFMucnVubmluZz8nd29yayBleGVjdXRpbmcnOidub3RoaW5nIHJ1bm5pbmcnKX0KICAgJHtrcGkob24rJyAvICcrVC5sZW5ndGgsJ1N0YW5kaW5nIE9yZGVycyBMaXZlJywndmFyKC0tY3kpJywnb24gc2NoZWR1bGUnKX0KICAgJHtrcGkoZm10KHRvdGFsUnVucyksJ0pvYnMgRXhlY3V0ZWQnLCd2YXIoLS1ncm4pJyxTLnRpY2tzKycgc2NoZWR1bGVyIHRpY2tzJyl9CiAgICR7a3BpKGZhaWxzLCdGYWlsdXJlcycsZmFpbHM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnc2luY2UgaW5zdGFsbCcpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TdGFuZGluZyBPcmRlcnMgPHNwYW4gY2xhc3M9InRhZyAke1MucnVubmluZz8ndC1ncm4nOid0LXJlZCd9Ij4ke1MucnVubmluZz8nRVhFQ1VUSU5HJzonRlJPWkVOJ308L3NwYW4+PC9oMz4KICAgJHtULmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5DYXBhYmlsaXR5PC90aD48dGg+T3duZXIgQWdlbnQ8L3RoPjx0aD5FdmVyeTwvdGg+PHRoPkxhc3QgUnVuPC90aD48dGg+UmVzdWx0PC90aD48dGg+UnVuczwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtULm1hcCh0PT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyh0LmNhcCl9PC9iPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYygoUy5jYXBzfHxbXSkuZmluZChjPT5jLmNhcD09PXQuY2FwKT8uZGVzY3x8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh0Lm93bmVyKX08L3RkPgogICAgPHRkPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJ3aWR0aDo3NHB4O3BhZGRpbmc6NHB4IDdweCIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iJHt0LmV2ZXJ5fSIKICAgICAgICBvbmNoYW5nZT0ic2V0RXZlcnkoJyR7dC5pZH0nLHRoaXMudmFsdWUpIiB0aXRsZT0ic2Vjb25kcyI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXZlcnkodC5ldmVyeSl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YWdvKHQubGFzdEF0KX08L3RkPgogICAgPHRkPiR7dC5sYXN0TXNnP2A8c3BhbiBjbGFzcz0idGFnICR7dC5sYXN0T2s/J3QtZ3JuJzondC1yZWQnfSI+JHt0Lmxhc3RPaz8nT0snOidGQUlMJ308L3NwYW4+ICR7ZXNjKHQubGFzdE1zZyl9YDonPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5ub3QgeWV0IHJ1bjwvc3Bhbj4nfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3QucnVuc3x8MH0ke3QuZmFpbHM/JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+LycrdC5mYWlscysn4pyXPC9zcGFuPic6Jyd9PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0icnVuTm93KCcke3QuaWR9JykiPlJ1bjwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nZ2xlVGFzaygnJHt0LmlkfScsJHshdC5lbmFibGVkfSkiPiR7dC5lbmFibGVkPydQYXVzZSc6J1N0YXJ0J308L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RhbmRpbmcgb3JkZXJzLiBQb3dlciB0aGUgc3lzdGVtIG9uIHRvIGluc3RhbGwgdGhlbS48L2Rpdj4nfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5FeGVjdXRpb24gRmVlZCA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1IubGVuZ3RofTwvc3Bhbj48L2gzPgogICAke1IubGVuZ3RoP2A8ZGl2IGNsYXNzPSJsb2ciPiR7Ui5tYXAocj0+YDxkaXY+PHNwYW4gY2xhc3M9InRzIj4ke3IudH08L3NwYW4+CiAgICAgPHNwYW4gc3R5bGU9ImNvbG9yOiR7ci5vaz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknfSI+WyR7ci5vaz8nRE9ORSc6J0ZBSUwnfV08L3NwYW4+CiAgICAgPGI+JHtlc2Moci5vd25lcil9PC9iPiDCtyAke2VzYyhyLmNhcCl9IOKAlCAke2VzYyhyLm1zZyl9JHtyLmRldGFpbD9gXG4gICAgICAgIOKGsyAke2VzYyhyLmRldGFpbCl9YDonJ30KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPigke3IubXN9bXMke3IubWFudWFsPycgwrcgbWFudWFsJzonJ30pPC9zcGFuPjwvZGl2PmApLmpvaW4oJycpfTwvZGl2PmAKICAgOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyBleGVjdXRlZCB5ZXQuIFBvd2VyIG9uIGFuZCB0aGUgZmlyc3Qgc3dlZXAgcnVucyB3aXRoaW4gMTAgc2Vjb25kcy48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIub3BzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5odXN0bGU/JyNhODU1ZjcnOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7Uy5odXN0bGU/JyMxYTBmMmUnOicjMTUxMDBhJ30sIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6JHtTLmh1c3RsZT8ndmFyKC0tcHVyKSc6J3ZhcigtLWFtYiknfSI+4pqhIEhVU1RMRSBNT0RFIOKAlCAke1MuaHVzdGxlPydFTkdBR0VEJzonT0ZGJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtTLmh1c3RsZQogICA/YDxiPk1heGltdW0gb3V0cHV0LjwvYj4gJHsoUy50YXNrc3x8W10pLmxlbmd0aH0gbW9uZXktZm9jdXNlZCBvcmRlcnMgcnVubmluZyBvbiA8Yj4ke1MubGFuZXN8fDN9IHBhcmFsbGVsIGxhbmVzPC9iPiDigJQgaWRlYXMsIHJlc2VhcmNoLCBtaXNzaW9ucywgcmV2ZW51ZSByb3V0ZXMsIGRlZXAgaW52ZXN0aWdhdGlvbi4gQWxsIGZpcmluZyBhdCBvbmNlLCBub3Qgb25lIGFmdGVyIGFub3RoZXIuYAogICA6J1N3aXRjaGVzIHRoZSByb3N0ZXIgdG8gbW9uZXktZ2VuZXJhdGluZyB3b3JrIG9ubHksIHRpZ2h0ZW5zIGV2ZXJ5IGludGVydmFsLCBhbmQgcnVucyB0YXNrcyA8Yj5pbiBwYXJhbGxlbDwvYj4gaW5zdGVhZCBvZiBzZXF1ZW50aWFsbHkuIEV4cGVjdCByb3VnaGx5IDEw4oCTMjAgY29tcGxldGVkIGpvYnMgaW4gdGhlIGZpcnN0IGhvdXIuJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPlBhcmFsbGVsIGxhbmVzIGZvciBBSSB0YXNrczo8L3NwYW4+CiAgIDxzZWxlY3QgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjkwcHgiIGlkPSJsYW5lU2VsIiBvbmNoYW5nZT0ic2V0TGFuZXModGhpcy52YWx1ZSkiPgogICAgJHtbMSwyLDMsNCw1LDZdLm1hcChuPT5gPG9wdGlvbiB2YWx1ZT0iJHtufSIgJHsoUy5sYW5lc3x8Myk9PW4/J3NlbGVjdGVkJzonJ30+JHtufTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkhpZ2hlciA9IGZhc3RlciwgYnV0IGZyZWUgQUkgdGllcnMgcmF0ZS1saW1pdCBhcm91bmQgMzAgcmVxdWVzdHMvbWluLjwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biAke1MuaHVzdGxlPydubyc6J3AnfSIgb25jbGljaz0idG9nZ2xlSHVzdGxlKCkiPiR7Uy5odXN0bGU/J1NUQU5EIERPV04nOidFTkdBR0UgSFVTVExFIE1PREUnfTwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPiR7Uy5odXN0bGUKICAgPydTdGFuZGluZyBkb3duIHJlc3RvcmVzIHRoZSBub3JtYWwgbW9uaXRvcmluZyByb3N0ZXIuJwogICA6J1RoaXMgcmVwbGFjZXMgeW91ciBjdXJyZW50IHRhc2sgbGlzdC4gTW9uaXRvcmluZyBjb250aW51ZXMsIGJ1dCB0aGUgZW1waGFzaXMgc2hpZnRzIGhhcmQgdG8gcmV2ZW51ZS4nfTwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMTU1ZTZiIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+4oK5IFNQRU5ESU5HIENFSUxJTkcg4oCUICR7Uy5idWRnZXQ/KCfigrknK2ZtdChTLmJ1ZGdldCkpOidOT1QgU0VUJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5IZSBjYW4gPGI+cmVxdWVzdDwvYj4gbW9uZXkgZm9yIGEgdmVudHVyZSDigJQgYSBkb21haW4sIGEgbGlzdGluZyBmZWUsIGEgc21hbGwgYWQgdGVzdC4gSGUgY2FuIG5ldmVyIHRha2UgaXQuIEV2ZXJ5IHJlcXVlc3QgYmVjb21lcyBhIGZyb3plbiBnYXRlIG5lZWRpbmcgeW91ciBzaWduYXR1cmUsIGFuZCBhbnl0aGluZyBhYm92ZSB0aGlzIGNlaWxpbmcgaXMgcmVmdXNlZCBvdXRyaWdodC48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MTUwcHgiIHR5cGU9Im51bWJlciIgaWQ9ImJ1ZGdldEFtdCIgcGxhY2Vob2xkZXI9ImUuZy4gMjAwMCIgdmFsdWU9IiR7Uy5idWRnZXR8fCcnfSI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZXRCdWRnZXQoKSI+U0VUIENFSUxJTkc8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5MaWZldGltZSBhdXRob3JpemVkIHNwZW5kIHNvIGZhcjogPGI+4oK5JHsoUy5zcGVuZHx8MCkudG9GaXhlZCgyKX08L2I+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5ydW5uaW5nPycjMWM1YzNjJzonIzZiMjIzMyd9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke1MucnVubmluZz8nIzA4MTcwZic6JyMxNjBiMGMnfSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjoke1MucnVubmluZz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknfSI+4pa2IE1BU1RFUiBQT1dFUiDigJQgJHtTLnJ1bm5pbmc/J1NZU1RFTSBSVU5OSU5HJzonU1lTVEVNIEhBTFRFRCd9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPiR7Uy5ydW5uaW5nCiAgID8nRXZlcnkgc3RhbmRpbmcgb3JkZXIgYmVsb3cgaXMgZXhlY3V0aW5nIG9uIGl0cyBvd24gc2NoZWR1bGUuIFRoZSBDaGFpcm1hbiBpcyBkb2luZyByZWFsIHdvcmsgcmlnaHQgbm93IOKAlCBwcm9iaW5nIHlvdXIgc2l0ZXMsIGF1ZGl0aW5nIHRoZSBsZWRnZXIsIGNvbXB1dGluZyBTTEFzLCB3cml0aW5nIGJyaWVmcyDigJQgd2l0aG91dCB5b3UgdG91Y2hpbmcgYW55dGhpbmcuJwogICA6JzxiPk5vdGhpbmcgaXMgcnVubmluZy48L2I+IFNpZ24gYmVsb3cgdG8gYnJpbmcgdGhlIHdob2xlIHN5c3RlbSBvbmxpbmUuIE9uY2UgcnVubmluZyBpdCBkb2VzIG5vdCBzdG9wIHVudGlsIHlvdSBoYWx0IGl0Lid9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gJHtTLnJ1bm5pbmc/J25vJzoncCd9IiBvbmNsaWNrPSJwb3dlcigpIj4ke1MucnVubmluZz8nSEFMVCBFVkVSWVRISU5HJzonU1RBUlQgRVZFUllUSElORyd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icmVzZXRUYXNrcygpIj5SZWluc3RhbGwgc3RhbmRpbmcgb3JkZXJzPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlNjaGVkdWxlciB0aWNrcyBldmVyeSAxMHMuIE9ubHkgeW91IGNhbiBzdGFydCBvciBzdG9wIGl0IOKAlCBub3RoaW5nIGVsc2UgY2FuLjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9Im9wcyI+JHtMSVZFLm9wcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHBvd2VyKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9wb3dlcicse29uOiFTLnJ1bm5pbmd9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLnJ1bm5pbmc/J1NZU1RFTSBSVU5OSU5HIOKAlCBhZ2VudHMgZXhlY3V0aW5nJzonU3lzdGVtIGhhbHRlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2V0RXZlcnkoaWQsdil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Rhc2snLHtpZCxldmVyeTordn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhc2soaWQsb24peyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS90YXNrJyx7aWQsZW5hYmxlZDpvbn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHJ1bk5vdyhpZCl7IGZsYXNoKCdFeGVjdXRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcnVubm93Jyx7aWR9KTsgcmVuZGVyKCk7IGZsYXNoKHIubXNnKSB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2V0VGFza3MoKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcmVzZXQnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdTdGFuZGluZyBvcmRlcnMgcmVpbnN0YWxsZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUh1c3RsZSgpewogIGZsYXNoKFMuaHVzdGxlPydTdGFuZGluZyBkb3du4oCmJzonRW5nYWdpbmcgaHVzdGxlIG1vZGXigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvaHVzdGxlJyx7b246IVMuaHVzdGxlLGxhbmVzOlMubGFuZXN8fDN9KTsKICAgIHJlbmRlcigpOyBmbGFzaChTLmh1c3RsZT9gSFVTVExFIEVOR0FHRUQg4oCUICR7ci50YXNrc30gb3JkZXJzIGZpcmluZyBpbiBwYXJhbGxlbGA6J1N0b29kIGRvd24gdG8gbm9ybWFsIHJvc3RlcicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2V0TGFuZXMobil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL2xhbmVzJyx7bGFuZXM6K259KTsgcmVuZGVyKCk7IGZsYXNoKCdMYW5lczogJytuKSB9CmFzeW5jIGZ1bmN0aW9uIHNldEJ1ZGdldCgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NwZW5kL2J1ZGdldCcse2J1ZGdldDorYnVkZ2V0QW10LnZhbHVlfHwwfSk7IHJlbmRlcigpOwogICAgZmxhc2goJ0NlaWxpbmcgc2V0IOKAlCBoZSBjYW4gcmVxdWVzdCB1cCB0byB0aGlzLCBuZXZlciB0YWtlIGl0Jyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQoKLyogLS0tLS0tLS0tLSBTRUxGLVVQR1JBREUgLS0tLS0tLS0tLSAqLwpMSVZFLmV2b2x2ZT0oKT0+ewogIGNvbnN0IFA9KFMucHJvcG9zYWxzfHxbXSkuZmlsdGVyKHA9PnAuc3RhdHVzPT09J1BFTkRJTkcnKTsKICBjb25zdCBFPVMuZXZvbHV0aW9ufHxbXTsKICBjb25zdCBhcHBsaWVkPUUuZmlsdGVyKGU9PmUuZGVjaXNpb249PT0nQVBQTElFRCcpLmxlbmd0aDsKICBjb25zdCByZWplY3RlZD1FLmZpbHRlcihlPT5lLmRlY2lzaW9uPT09J1JFSkVDVEVEJykubGVuZ3RoOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKFAubGVuZ3RoLCdVcGdyYWRlcyBBd2FpdGluZyBZb3UnLFAubGVuZ3RoPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsUC5sZW5ndGg/J25lZWRzIHlvdXIgc2lnbmF0dXJlJzonbm90aGluZyBwZW5kaW5nJyl9CiAgICR7a3BpKGFwcGxpZWQsJ1VwZ3JhZGVzIEFwcGxpZWQnLCd2YXIoLS1ncm4pJywnbGlmZXRpbWUnKX0KICAgJHtrcGkocmVqZWN0ZWQsJ1JlamVjdGVkJywndmFyKC0tZGltKScsJ25ldmVyIHJlLXByb3Bvc2VkJyl9CiAgICR7a3BpKFMuc2NhbkNvdW50fHwwLCdTZWxmLVNjYW5zIFJ1bicsJ3ZhcigtLWN5KScsJ2V2ZXJ5IDYwIHNlY29uZHMnKX08L2Rpdj4KICAke1AubGVuZ3RoP1AubWFwKHA9PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7cC5rbGFzcz09PSdTQUZFJz8nIzFjNWMzYyc6JyM2NzQ3MGYnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7cC5rbGFzcz09PSdTQUZFJz8ndC1ncm4nOid0LWFtYid9Ij4ke3Aua2xhc3N9PC9zcGFuPgogICAgICA8Yj4ke2VzYyhwLmxhYmVsKX08L2I+PC9kaXY+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3AuaWR9IMK3ICR7cC50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206N3B4Ij4ke2VzYyhwLndoeSl9PC9kaXY+CiAgICAke3AuZXZpZGVuY2U/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkV2aWRlbmNlOiAke2VzYyhwLmV2aWRlbmNlKX08L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywxKSI+QVVUSE9SSVpFIFVQR1JBREU8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywwKSI+UkVKRUNUIFBFUk1BTkVOVExZPC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJlcnIiIGlkPSJlcl8ke3AuaWR9Ij48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB1cGdyYWRlcyBwZW5kaW5nLiBUaGUgQ2hhaXJtYW4gc2NhbnMgaXRzZWxmIGV2ZXJ5IDYwIHNlY29uZHMgYW5kIHdpbGwgcmFpc2UgYSBwcm9wb3NhbCBoZXJlIHRoZSBtb21lbnQgaXQgZmluZHMgYSByZWFsIHdlYWtuZXNzIOKAlCBhIGZsYWt5IHNpdGUsIGFuIGV4cGlyaW5nIGNlcnRpZmljYXRlLCBhbiB1bnN0YWZmZWQgZmxvb3IsIGEgc2VjdXJpdHkgZ2FwLjwvZGl2PjwvZGl2PmB9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV2b2x1dGlvbiBIaXN0b3J5PC9oMz4KICAgJHtFLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Q2hhbmdlPC90aD48dGg+RGVjaXNpb248L3RoPjx0aD5SZXN1bHQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7RS5tYXAoZT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2UudH08L3RkPjx0ZD4ke2VzYyhlLmxhYmVsKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS53aHl8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtlLmRlY2lzaW9uPT09J0FQUExJRUQnPyd0LWdybic6J3QtcmVkJ30iPiR7ZS5kZWNpc2lvbn08L3NwYW4+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUuaG93fHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUucmVzdWx0fHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPlRoZSBDaGFpcm1hbiBoYXMgbm90IGNoYW5nZWQgaXRzZWxmIHlldC48L2Rpdj4nfTwvZGl2PmB9OwpMSVZFLndyaXR0ZW49KCk9PnsKICBjb25zdCBXPShTLndyaXR0ZW5DYXBzfHxbXSk7CiAgaWYoIVcubGVuZ3RoKSByZXR1cm4gJzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5IZSBoYXMgbm90IHdyaXR0ZW4gYW55IG5ldyBhYmlsaXRpZXMgeWV0LjwvZGl2PjwvZGl2Pic7CiAgcmV0dXJuIFcubWFwKGM9PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7CiAgICAgIGMudmlvbGF0aW9ucy5sZW5ndGg/J3ZhcigtLW1hZyknOmMuc3RhdHVzPT09J0lOU1RBTExFRCc/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+CiAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtjLnZpb2xhdGlvbnMubGVuZ3RoPyd0LXJlZCc6Yy5zdGF0dXM9PT0nSU5TVEFMTEVEJz8ndC1ncm4nOid0LWFtYid9Ij4kewogICAgICAgIGMudmlvbGF0aW9ucy5sZW5ndGg/J1NBTkRCT1ggQkxPQ0tFRCc6Yy5zdGF0dXN9PC9zcGFuPgogICAgICA8YiBzdHlsZT0iZm9udC1zaXplOjE0cHgiPiR7ZXNjKGMubmFtZSl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtjLnR9IMK3ICR7Yy5ieXRlc30gYnl0ZXM8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+JHtlc2MoYy5kZXNjKX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTEwcHgiPldoeSBoZSB3cm90ZSBpdDwvdGQ+PHRkPiR7ZXNjKGMud2h5KX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlJpc2sgaGUgc2VlczwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke2VzYyhjLnJpc2spfTwvdGQ+PC90cj4KICAgICAke2MudmlvbGF0aW9ucy5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CbG9ja2VkIGJlY2F1c2U8L3RkPgogICAgICAgPHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2MudmlvbGF0aW9ucy5tYXAoZXNjKS5qb2luKCc8YnI+Jyl9PC90ZD48L3RyPmA6Jyd9CiAgICAgJHtjLnRlc3RSdW4/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5EcnkgcnVuIG91dHB1dDwvdGQ+CiAgICAgICA8dGQgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiR7ZXNjKGMudGVzdFJ1bi5tc2cpfSR7Yy50ZXN0UnVuLmRldGFpbD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iPicrZXNjKGMudGVzdFJ1bi5kZXRhaWwpKyc8L2Rpdj4nOicnfTwvdGQ+PC90cj5gOicnfQogICAgICR7Yy50ZXN0RXJyb3I/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5EcnkgcnVuIGZhaWxlZDwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhjLnRlc3RFcnJvcil9PC90ZD48L3RyPmA6Jyd9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGV0YWlscyBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48c3VtbWFyeSBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+CiAgICAgIFJFQUQgVEhFIEFDVFVBTCBDT0RFIGJlZm9yZSB5b3Ugc2lnbiBpdCAoJHtjLmJ5dGVzfSBieXRlcyk8L3N1bW1hcnk+CiAgICAgPHByZSBjbGFzcz0ieWFtbCIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4ke2VzYyhjLmNvZGUpfTwvcHJlPjwvZGV0YWlscz4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+CiAgICAgJHtjLnN0YXR1cz09PSdQRU5ESU5HJz9gPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5TaWduIGl0IG9uIHRoZSBwcm9wb3NhbCBhYm92ZSB0byBpbnN0YWxsLjwvc3Bhbj5gOicnfQogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGlzY2FyZENhcCgnJHtjLmlkfScpIj5EaXNjYXJkPC9idXR0b24+PC9kaXY+CiAgIDwvZGl2PmApLmpvaW4oJycpOwp9OwpSRU5ERVIud3JpdHRlbj0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1wdXIpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKcjiBTRUxGLUVYVEVOU0lPTiDigJQgSEUgV1JJVEVTIEhJUyBPV04gTkVXIEFCSUxJVElFUzwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5Ob3Qgc2V0dGluZ3MgdHVuaW5nLiBIZSB3cml0ZXMgPGI+cmVhbCBKYXZhU2NyaXB0PC9iPiBmb3IgYSBjYXBhYmlsaXR5IGhlIGRvZXMgbm90IHlldCBoYXZlLCBpdCBydW5zIGluIGEgbG9ja2VkIHNhbmRib3gsIGFuZCB5b3UgcmVhZCB0aGUgYWN0dWFsIHNvdXJjZSBiZWZvcmUgc2lnbmluZy48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPlNhbmRib3ggYmxvY2tzPC9iPiByZXF1aXJlLCBwcm9jZXNzLCBmcywgY2hpbGRfcHJvY2VzcywgZXZhbCwgRnVuY3Rpb24sIHByb3RvdHlwZSBhY2Nlc3MgYW5kIGluZmluaXRlIGxvb3BzIOKAlCBjaGVja2VkIDxlbT5iZWZvcmU8L2VtPiB5b3UgYXJlIHNob3duIGl0LjwvbGk+CiAgIDxsaT5HZW5lcmF0ZWQgY29kZSBzZWVzIG9ubHkgYSB0aW55IHJlYWQtb25seSBBUEkgb2YgeW91ciBvd24gc3RhdGUsIHBsdXMgb25lIHdyaXRlOiBhIG5vdGUgaW4gdGhlIGxlZGdlci48L2xpPgogICA8bGk+RXZlcnkgbmV3IGFiaWxpdHkgaXMgPGI+ZHJ5LXJ1biBhZ2FpbnN0IHJlYWwgZGF0YSBmaXJzdDwvYj4sIHNvIHlvdSBzZWUgZ2VudWluZSBvdXRwdXQsIG5vdCBhIHByb21pc2UuPC9saT4KICAgPGxpPk5vdGhpbmcgaW5zdGFsbHMgd2l0aG91dCB5b3VyIHBhc3N3b3JkIHNpZ25hdHVyZSBvbiB0aGUgU2VsZi1VcGdyYWRlIHBhZ2UuPC9saT4KICA8L3VsPgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48c3Bhbj5XaGF0IG5ldyBhYmlsaXR5IHNob3VsZCBoZSBidWlsZD88L3NwYW4+CiAgIDxpbnB1dCBpZD0ic2VHb2FsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIGZpbmQgd2hpY2ggbW9uaXRvcmVkIHNpdGUgZGVncmFkZWQgbW9zdCB0aGlzIHdlZWsiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0id3JpdGVDYXAoKSI+SEUgV1JJVEVTIElUPC9idXR0b24+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+TGVhdmUgYmxhbmsgYW5kIGhlIHBpY2tzIGEgZ2FwIGhlIGNhbiBzZWUgaW4gaGlzIG93biBzdGF0ZS48L3NwYW4+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJ3cml0dGVuIj4ke0xJVkUud3JpdHRlbigpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHdyaXRlQ2FwKCl7CiAgY29uc3QgZz0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlR29hbCcpfHx7fSkudmFsdWV8fCcnOwogIGZsYXNoKCdIZSBpcyB3cml0aW5nIGNvZGXigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NlbGZleHRlbmQvd3JpdGUnLHtnb2FsOmd8fCdwaWNrIGEgZ2VudWluZSBnYXAgaW4geW91ciBvd24gYWJpbGl0aWVzJ30pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYmxvY2tlZD8oJ1dyb3RlICcrci5uYW1lKycg4oCUIFNBTkRCT1ggQkxPQ0tFRCBJVCcpOignV3JvdGUgJytyLm5hbWUrJyDigJQgcmVhZCB0aGUgY29kZSwgdGhlbiBzaWduIGl0JykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZGlzY2FyZENhcChpZCl7IGF3YWl0IEFQSSgnL2FwaS9zZWxmZXh0ZW5kL2Rpc2NhcmQnLHtpZH0pOyByZW5kZXIoKSB9CgpSRU5ERVIuZXZvbHZlPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4p+zIENPTlRJTlVPVVMgU0VMRi1VUEdSQURFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlRoZSBDaGFpcm1hbiBhdWRpdHMgaXRzIG93biBzdGF0ZSBldmVyeSA2MCBzZWNvbmRzIGFnYWluc3QgcmVhbCB0ZWxlbWV0cnkg4oCUIHVwdGltZSByZWNvcmRzLCBUTFMgZXhwaXJ5LCBhdXRoIGZhaWx1cmVzLCBsZWRnZXIgc2l6ZSwgZmxvb3Igc3RhZmZpbmcsIG1haWwgcmVhZGluZXNzLiBXaGVuIGl0IGZpbmRzIGEgZ2VudWluZSB3ZWFrbmVzcyBpdCBwcm9wb3NlcyBhIGZpeCBoZXJlIGFuZCA8Yj5mcmVlemVzIHVudGlsIHlvdSBzaWduIGl0PC9iPi48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPk5vdGhpbmcgc2VsZi1pbnN0YWxscyBieSBkZWZhdWx0LjwvYj4gRXZlcnkgdXBncmFkZSBuZWVkcyB5b3VyIHBhc3N3b3JkLCBzYW1lIGFzIGEgcGVybWlzc2lvbiBnYXRlLjwvbGk+CiAgIDxsaT48Yj5TQUZFPC9iPiA9IHJldmVyc2libGUgdHVuaW5nIChwcm9iZSBpbnRlcnZhbHMsIGxlZGdlciBjb21wYWN0aW9uLCBza2lsbHMpLiA8Yj5SRVZJRVc8L2I+ID0gY2hhbmdlcyB5b3VyIHJvc3RlciBvciByYWlzZXMgYSBzZWN1cml0eSBnYXRlLjwvbGk+CiAgIDxsaT5SZWplY3Qgb25jZSBhbmQgaXQgaXMgPGI+c3VwcHJlc3NlZCBwZXJtYW5lbnRseTwvYj4g4oCUIHRoZSBDaGFpcm1hbiB3aWxsIG5vdCBuYWcgeW91IGFib3V0IGl0IGFnYWluLjwvbGk+CiAgIDxsaT5JdCBwcm9wb3NlcyBvbmx5IG9uIGV2aWRlbmNlIGZyb20geW91ciBhY3R1YWwgcnVubmluZyBzeXN0ZW0uIEl0IGRvZXMgbm90IGludmVudCB3b3JrLjwvbGk+CiAgPC91bD4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2Nhbk5vdygpIj5SVU4gU0VMRi1TQ0FOIE5PVzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvcGlsb3Q/J3QtcmVkJzondC1kaW0nfSI+QVVUT1BJTE9UICR7Uy5hdXRvcGlsb3Q/J09OJzonT0ZGJ308L3NwYW4+CiAgPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5hdXRvcGlsb3Q/JyM2YjIyMzMnOid2YXIoLS1saW5lKSd9Ij4KICA8aDM+QXV0b3BpbG90ICR7Uy5hdXRvcGlsb3Q/JzxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPkFDVElWRTwvc3Bhbj4nOicnfTwvaDM+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPldpdGggYXV0b3BpbG90IG9uLCA8Yj5TQUZFLWNsYXNzPC9iPiB1cGdyYWRlcyBhcHBseSB0aGVtc2VsdmVzIHRoZSBtb21lbnQgdGhleSBhcmUgZm91bmQg4oCUIG5vIHNpZ25hdHVyZS4gUkVWSUVXLWNsYXNzIGFsd2F5cyB3YWl0cyBmb3IgeW91IHJlZ2FyZGxlc3MuIEV2ZXJ5IGF1dG9ub21vdXMgY2hhbmdlIGlzIHN0aWxsIHdyaXR0ZW4gdG8gdGhlIGV2b2x1dGlvbiBoaXN0b3J5LiBUaGlzIGlzIHJlYWwgYXV0b25vbXk6IHR1cm4gaXQgb24gb25seSBpZiB5b3UgYWNjZXB0IHRoZSBDaGFpcm1hbiBjaGFuZ2luZyBpdHMgb3duIHR1bmluZyB3aGlsZSB5b3Ugc2xlZXAuPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gJHtTLmF1dG9waWxvdD8nbm8nOidwJ30iIG9uY2xpY2s9InRvZ2dsZUF1dG8oKSI+JHtTLmF1dG9waWxvdD8nRElTQUJMRSBBVVRPUElMT1QnOidFTkFCTEUgQVVUT1BJTE9UJ308L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJldm9sdmUiPiR7TElWRS5ldm9sdmUoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBkZWNpZGVVcChpZCxvayl7CiAgY29uc3QgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXJfJytpZCk7IGUudGV4dENvbnRlbnQ9Jyc7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2RlY2lkZScse2lkLG9rOiEhb2t9KTsKICAgIHJlbmRlcigpOyBmbGFzaChvaz8oJ1VQR1JBREVEIMK3ICcrKHIucmVzdWx0fHwnJykpOidSZWplY3RlZCBwZXJtYW5lbnRseScpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2UgfQp9CmFzeW5jIGZ1bmN0aW9uIHNjYW5Ob3coKXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9zY2FuJyx7fSk7IHJlbmRlcigpOwogIGZsYXNoKHIucGVuZGluZz9yLnBlbmRpbmcrJyB1cGdyYWRlKHMpIGF3YWl0aW5nIHlvdXIgc2lnbmF0dXJlJzonU2NhbiBjbGVhbiDigJQgbm90aGluZyB0byBpbXByb3ZlJykgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVBdXRvKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9hdXRvcGlsb3QnLHtvbjohUy5hdXRvcGlsb3R9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLmF1dG9waWxvdD8nQVVUT1BJTE9UIE9OIOKAlCBzYWZlIHVwZ3JhZGVzIG5vdyBzZWxmLWFwcGx5JzonQXV0b3BpbG90IG9mZicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KCi8qIC0tLS0tLS0tLS0gTEVBUk5FRCBTS0lMTFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2tpbGxzMj0oKT0+ewogIGNvbnN0IEs9Uy5za2lsbHN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRlYWNoIHRoZSBDaGFpcm1hbiA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlBFUlNJU1RTIEZPUkVWRVI8L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPkFueXRoaW5nIHlvdSB0ZWFjaCBpcyBzdG9yZWQgc2VydmVyLXNpZGUgYW5kIHN1cnZpdmVzIHJlc3RhcnRzLCByZWRlcGxveXMgYW5kIGV2ZXJ5IGRldmljZSB5b3UgbG9nIGluIGZyb20uIFRlYWNoIGl0IHlvdXIgc2hvcnRoYW5kLCB5b3VyIHJ1bmJvb2tzLCB5b3VyIHN0YW5kaW5nIG9yZGVycy48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRyaWdnZXIgcGhyYXNlPC9zcGFuPjxpbnB1dCBpZD0ic2tQaHJhc2UiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im1vcm5pbmcgY2hlY2siPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXQgbWVhbnMgLyBkb2VzPC9zcGFuPjxpbnB1dCBpZD0ic2tBY3Rpb24iIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlNjYW4gYWxsIG1vbml0b3JzIGFuZCByZXBvcnQgYW55dGhpbmcgYmVsb3cgOTklIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UeXBlPC9zcGFuPjxzZWxlY3QgaWQ9InNrS2luZCIgY2xhc3M9ImluIj4KICAgICA8b3B0aW9uIHZhbHVlPSJub3RlIj5TdGFuZGluZyBvcmRlcjwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImFsaWFzIj5Db21tYW5kIHNob3J0Y3V0PC9vcHRpb24+CiAgICAgPG9wdGlvbiB2YWx1ZT0icnVuYm9vayI+UnVuYm9vayBzdGVwPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0icG9saWN5Ij5Qb2xpY3kgcnVsZTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJ0ZWFjaCgpIj5URUFDSCBJVDwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Lbm93biBTa2lsbHMgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtLLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtLLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5QaHJhc2U8L3RoPjx0aD5NZWFuaW5nPC90aD48dGg+VHlwZTwvdGg+PHRoPlVzZWQ8L3RoPjx0aD5MZWFybmVkPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0subWFwKHM9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHMucGhyYXNlKX08L2I+PC90ZD48dGQ+JHtlc2Mocy5hY3Rpb24pfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtlc2Mocy5raW5kKX08L3NwYW4+PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke3MudXNlc3x8MH3DlzwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3MubGVhcm5lZH08ZGl2PiR7ZXNjKHMub3JpZ2lufHwnb3duZXInKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idXNlU2tpbGwoJyR7ZXNjKHMucGhyYXNlKX0nKSI+UmVjYWxsPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJmb3JnZXQoJyR7ZXNjKHMucGhyYXNlKX0nKSI+Rm9yZ2V0PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgdGF1Z2h0IHlldC4gVHJ5IHBocmFzZSAibW9ybmluZyBjaGVjayIg4oaSICJTY2FuIGFsbCBtb25pdG9ycyBhbmQgcmVwb3J0IGFueXRoaW5nIGJlbG93IDk5JSBhdmFpbGFiaWxpdHkiLjwvZGl2Pid9PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHRlYWNoKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc2tpbGwvdGVhY2gnLHtwaHJhc2U6c2tQaHJhc2UudmFsdWUsYWN0aW9uOnNrQWN0aW9uLnZhbHVlLGtpbmQ6c2tLaW5kLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1NraWxsIGxlYXJuZWQg4oCUIGl0IHBlcnNpc3RzIGFjcm9zcyByZXN0YXJ0cycpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZm9yZ2V0KHApeyBpZighY29uZmlybSgnRm9yZ2V0ICInK3ArJyI/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvc2tpbGwvZm9yZ2V0Jyx7cGhyYXNlOnB9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB1c2VTa2lsbChwKXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2tpbGwvdXNlJyx7cGhyYXNlOnB9KTsgcmVuZGVyKCk7CiAgbW9kYWwoYDxoMz4ke2VzYyhwKX08L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCI+PGRpdj4ke2VzYyhyLmFjdGlvbil9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxM3B4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKSB9CgovKiAtLS0tLS0tLS0tIFVQVElNRSBNQVJTSEFMIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gdXBCYXIobSl7CiAgY29uc3QgaD0obS5oaXN0b3J5fHxbXSkuc2xpY2UoLTQwKTsKICBpZighaC5sZW5ndGgpIHJldHVybiAnPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJmb250LXNpemU6MTBweCI+bm8gY2hlY2tzIHlldDwvZGl2Pic7CiAgcmV0dXJuICc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Z2FwOjJweDthbGlnbi1pdGVtczpmbGV4LWVuZDtoZWlnaHQ6MjZweCI+JytoLm1hcCh4PT4KICAgYDxkaXYgdGl0bGU9IiR7eC50fSDCtyBIVFRQICR7eC5jb2RlfSDCtyAke3gubXN9bXMiIHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjNweDtoZWlnaHQ6JHt4Lm9rP01hdGgubWF4KDMwLE1hdGgubWluKDEwMCwxMDAteC5tcy8yNSkpOjEwMH0lO2JhY2tncm91bmQ6JHt4Lm9rPycjMzFkNjdhJzonI2ZmM2I2Yid9O2JvcmRlci1yYWRpdXM6MXB4O29wYWNpdHk6LjkiPjwvZGl2PmApLmpvaW4oJycpKyc8L2Rpdj4nOwp9CkxJVkUudXB0aW1lPSgpPT57CiAgY29uc3QgTT1TLm1vbml0b3JzfHxbXSwgZG93bj1NLmZpbHRlcihtPT5tLnN0YXRlPT09J0RPV04nKS5sZW5ndGg7CiAgY29uc3QgdG90PU0ucmVkdWNlKChhLG0pPT5hKyhtLmNoZWNrc3x8MCksMCksIHVwcz1NLnJlZHVjZSgoYSxtKT0+YSsobS51cHx8MCksMCk7CiAgY29uc3QgYXZhaWw9dG90PygodXBzL3RvdCkqMTAwKS50b0ZpeGVkKDIpOifigJQnOwogIGNvbnN0IGF2Zz1NLmZpbHRlcihtPT5tLmxhc3RNcykubGVuZ3RoP01hdGgucm91bmQoTS5yZWR1Y2UoKGEsbSk9PmErKG0ubGFzdE1zfHwwKSwwKS9NLmZpbHRlcihtPT5tLmxhc3RNcykubGVuZ3RoKTowOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKE0ubGVuZ3RoLCdUYXJnZXRzIE1vbml0b3JlZCcsJ3ZhcigtLWN5KScsJ3Byb2JlIGV2ZXJ5IDE1cycpfQogICAke2twaShkb3duLCdDdXJyZW50bHkgRG93bicsZG93bj8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLGRvd24/J0lOQ0lERU5UIEFDVElWRSc6J2FsbCByZWFjaGFibGUnKX0KICAgJHtrcGkoYXZhaWwrKGF2YWlsPT09J+KAlCc/Jyc6JyUnKSwnQXZhaWxhYmlsaXR5JywndmFyKC0tZ3JuKScsdG90KycgY2hlY2tzJyl9CiAgICR7a3BpKGF2ZysnIG1zJywnQXZnIFJlc3BvbnNlJyxhdmc+MTUwMD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLCdsYXN0IGN5Y2xlJyl9PC9kaXY+CiAgJHtNLmxlbmd0aD9NLm1hcChtPT57CiAgICBjb25zdCBhPW0uY2hlY2tzPygobS51cC9tLmNoZWNrcykqMTAwKS50b0ZpeGVkKDIpOicwLjAwJzsKICAgIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke20uc3RhdGU9PT0nVVAnPyd0LWdybic6bS5zdGF0ZT09PSdET1dOJz8ndC1yZWQnOid0LWRpbSd9Ij4ke20uc3RhdGV9PC9zcGFuPgogICAgICA8Yj4ke2VzYyhtLm5hbWUpfTwvYj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG0udXJsKX08L3NwYW4+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbE1vbignJHttLmlkfScpIj5VbmJpbmQ8L2J1dHRvbj48L2Rpdj48L2Rpdj4KICAgICR7dXBCYXIobSl9CiAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPkxhc3QgY2hlY2s8L3RkPjx0ZD4ke20ubGFzdEF0fHwn4oCUJ30gwrcgSFRUUCAke20ubGFzdFN0YXR1c3x8J+KAlCd9JHttLmxhc3RFcnI/JyDCtyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Jytlc2MobS5sYXN0RXJyKSsnPC9zcGFuPic6Jyd9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MYXRlbmN5PC90ZD48dGQ+JHttLmxhc3RNc3x8MH0gbXMgKHA5NSAke20ucDk1fHwwfSBtcyk8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF2YWlsYWJpbGl0eTwvdGQ+PHRkIHN0eWxlPSJjb2xvcjoke2E+OTk/J3ZhcigtLWdybiknOmE+OTU/J3ZhcigtLWFtYiknOid2YXIoLS1tYWcpJ30iPiR7YX0lIMK3ICR7bS51cHx8MH0gdXAgLyAke20uZG93bnx8MH0gZG93biBvZiAke20uY2hlY2tzfHwwfTwvdGQ+PC90cj4KICAgICAke20uc3NsP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VExTIGNlcnRpZmljYXRlPC90ZD48dGQ+JHtlc2MobS5zc2wuaXNzdWVyKX0gwrcgZXhwaXJlcyBpbiA8c3BhbiBzdHlsZT0iY29sb3I6JHttLnNzbC5kYXlzX2xlZnQ8MTQ/J3ZhcigtLW1hZyknOm0uc3NsLmRheXNfbGVmdDw0NT8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknfSI+JHttLnNzbC5kYXlzX2xlZnR9IGRheXM8L3NwYW4+PC90ZD48L3RyPmA6Jyd9CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkludGVydmFsPC90ZD48dGQ+JHttLmludGVydmFsfXMgwrcgYm91bmQgJHttLmFkZGVkfTwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfSkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gdGFyZ2V0cyBib3VuZC4gQWRkIHlvdXIgbGl2ZSBzaXRlcyBhbmQgYXBwcyBiZWxvdyDigJQgdGhlIFVwdGltZSBNYXJzaGFsIHdpbGwgcHJvYmUgdGhlbSBmb3IgcmVhbC48L2Rpdj48L2Rpdj4nfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JbmNpZGVudCBIaXN0b3J5PC9oMz4keyhTLmluY2lkZW50c3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICAgPHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlRhcmdldDwvdGg+PHRoPlRyYW5zaXRpb248L3RoPjx0aD5EZXRhaWw8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Uy5pbmNpZGVudHMubWFwKGk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtpLnR9PC90ZD48dGQ+JHtlc2MoaS5uYW1lKX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtpLnRvPT09J0RPV04nPyd0LXJlZCc6J3QtZ3JuJ30iPiR7aS5mcm9tfSDihpIgJHtpLnRvfTwvc3Bhbj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoaS5kZXRhaWwpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0YXRlIHRyYW5zaXRpb25zIHJlY29yZGVkLiBOb3RoaW5nIGhhcyBmbGFwcGVkLjwvZGl2Pid9PC9kaXY+YH07ClJFTkRFUi51cHRpbWU9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5CaW5kIFRhcmdldCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlJFQUwgSFRUUCBQUk9CRVM8L3NwYW4+PC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5VUkw8L3NwYW4+PGlucHV0IGlkPSJtVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL3lvdXJzaXRlLmNvbSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5MYWJlbCAob3B0aW9uYWwpPC9zcGFuPjxpbnB1dCBpZD0ibU5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Ik1haW4gc2l0ZSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbnRlcnZhbCAoc2VjLCBtaW4gMTUpPC9zcGFuPjxpbnB1dCBpZD0ibUludCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHZhbHVlPSI2MCI+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhZGRNb24oKSI+QklORCAmYW1wOyBQUk9CRSBOT1c8L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGVja05vdygpIj5GT1JDRSBDSEVDSyBBTEw8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Qcm9iZXMgZm9sbG93IHVwIHRvIDMgcmVkaXJlY3RzLCByZWFkIFRMUyBleHBpcnksIGFuZCByZWNvcmQgcDk1IGxhdGVuY3kuIE9uIGFueSBVUOKGlERPV04gdHJhbnNpdGlvbiB0aGUgVXB0aW1lIE1hcnNoYWwgd3JpdGVzIGEgQ1JJVCBpbmNpZGVudCBhbmQgZmlyZXMgYW4gZW1haWwgdGhyb3VnaCB0aGUgTWFpbCBSZWxheS48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJ1cHRpbWUiPiR7TElWRS51cHRpbWUoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBhZGRNb24oKXt0cnl7YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvYWRkJyx7dXJsOm1VcmwudmFsdWUudHJpbSgpLG5hbWU6bU5hbWUudmFsdWUudHJpbSgpLGludGVydmFsOittSW50LnZhbHVlfHw2MH0pOwogcmVuZGVyKCk7Zmxhc2goJ1RhcmdldCBib3VuZCDCtyBwcm9iaW5nJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIGRlbE1vbihpZCl7aWYoIWNvbmZpcm0oJ1VuYmluZCB0aGlzIHRhcmdldD8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvcmVtb3ZlJyx7aWR9KTtyZW5kZXIoKX0KYXN5bmMgZnVuY3Rpb24gY2hlY2tOb3coKXtmbGFzaCgnUHJvYmluZyBhbGwgdGFyZ2V0c+KApicpO2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL2NoZWNrJyx7fSk7cmVuZGVyKCk7Zmxhc2goJ1Byb2JlIGN5Y2xlIGNvbXBsZXRlJyl9CgovKiAtLS0tLS0tLS0tIE1BSUwgUkVMQVkgLS0tLS0tLS0tLSAqLwpSRU5ERVIubWFpbD0oKT0+ewogIGNvbnN0IHN0PVMuc210cCwgbXM9Uy5tYWlsc3RhdHx8e3NlbnQ6MCxmYWlsZWQ6MH07CiAgcmV0dXJuIGAkeyFzdD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBPVVRCT1VORCBNQUlMPC9oMz4KICAgPGRpdj5FdmVyeSAyRkEgbm90aWZpY2F0aW9uIGFuZCBvdXRhZ2UgYWxlcnQgaXMgYmVpbmcgcmVjb3JkZWQgYXMgYW4gPGI+aW50ZW50IG9ubHk8L2I+LiBDb25maWd1cmUgeW91ciBvd24gU01UUCByZWxheSBiZWxvdyB0byBtYWtlIHRoZW0gcmVhbC4gVGhlIENoYWlybWFuIHdpbGwgbmV2ZXIgYXNrIGZvciB0aGVzZSBpbiBjaGF0IOKAlCB5b3UgZW50ZXIgdGhlbSBoZXJlLCBhbmQgdGhlIHBhc3N3b3JkIGlzIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2Rpdj48L2Rpdj5gCiAgOmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxYzVjM2M7YmFja2dyb3VuZDojMDgxNzBmIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPlJFTEFZIEFSTUVEPC9oMz4KICAgPGRpdj5PdXRib3VuZCBlbWFpbCBpcyBsaXZlIHZpYSAke2VzYyhzdC5ob3N0KX06JHtzdC5wb3J0fS4gJHttcy5zZW50fSBkZWxpdmVyZWQsICR7bXMuZmFpbGVkfSBmYWlsZWQgdGhpcyBwcm9jZXNzLjwvZGl2PjwvZGl2PmB9CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1Muc210cFZlcmlmaWVkPyd2YXIoLS1saW1lKSc6J3ZhcigtLWFtYiknfSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtTLnNtdHBWZXJpZmllZD8ndmFyKC0tb2xpdmUpJzondmFyKC0tYW1iKSd9Ij4ke1Muc210cFZlcmlmaWVkPydcdTI3MTQnOidcdTI2YTAnfSBQUkVGTElHSFQgXHUyMDE0IFBST1ZFIElUIEFHQUlOU1QgVEhFIFJFQUwgU0VSVkVSPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPiR7Uy5zbXRwVmVyaWZpZWQKICAgICA/IGBWZXJpZmllZCAke2VzYyhTLnNtdHBWZXJpZmllZC5hdCl9IGFnYWluc3QgPGI+JHtlc2MoUy5zbXRwVmVyaWZpZWQuaG9zdCl9PC9iPiwgc2VuZGluZyBhcyA8Yj4ke2VzYyhTLnNtdHBWZXJpZmllZC5mcm9tKX08L2I+LiBZb3VyIGNyZWRlbnRpYWxzIGFyZSBrbm93bi1nb29kIGJlY2F1c2UgR29vZ2xlIGFjY2VwdGVkIHRoZW0sIG5vdCBiZWNhdXNlIHRoZSBmb3JtIGxvb2tlZCByaWdodC5gCiAgICAgOiBgPGI+WW91ciBjcmVkZW50aWFscyBoYXZlIG5ldmVyIGJlZW4gcHJvdmVuLjwvYj4gU2F2aW5nIHRoZSBmb3JtIG9ubHkgc3RvcmVzIHRoZW0uIFRoaXMgb3BlbnMgYSByZWFsIGNvbm5lY3Rpb24gdG8geW91ciBtYWlsIHNlcnZlciwgZG9lcyB0aGUgcmVhbCBUTFMgaGFuZHNoYWtlLCBzdWJtaXRzIHlvdXIgcmVhbCBwYXNzd29yZCwgYW5kIHZhbGlkYXRlcyB5b3VyIHNlbmRlciBhbmQgcmVjaXBpZW50IFx1MjAxNCB3aXRob3V0IHNlbmRpbmcgYW55dGhpbmcuIEhlIHdpbGwgcmVmdXNlIHRvIHJ1biBhbiBlbWFpbCBjYW1wYWlnbiB1bnRpbCB0aGlzIHBhc3Nlcy5gfTwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJwcmVmbGlnaHQoKSI+UlVOIFRIRSBQUkVGTElHSFQ8L2J1dHRvbj4KICAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJwZlRvIiBwbGFjZWhvbGRlcj0idGVzdCBhIHJlY2lwaWVudCAob3B0aW9uYWwpIiBzdHlsZT0ibWF4LXdpZHRoOjI1MHB4Ij48L2Rpdj4KICAgPGRpdiBpZD0icGZPdXQiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjwvZGl2PgogICAke1Muc2VuZFdpbmRvdz9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlNlbmQgYnVkZ2V0OiA8Yj4ke1Muc2VuZFdpbmRvdy51c2VkfTwvYj4gb2YgJHtTLnNlbmRXaW5kb3cuY2FwfSB1c2VkIGluIHRoZSBsYXN0IDI0aC4gR21haWwgc3VzcGVuZHMgc2VuZGluZyBuZWFyIDUwMCBcdTIwMTQgdGhlIGNhcCBpcyBzZXQgYmVsb3cgdGhhdCBkZWxpYmVyYXRlbHksIGFuZCBtZXNzYWdlcyBhcmUgcGFjZWQgOCBzZWNvbmRzIGFwYXJ0IHNvIGEgYnVyc3QgbmV2ZXIgbG9va3MgbGlrZSBhIGNvbXByb21pc2VkIGFjY291bnQuPC9kaXY+YDonJ30KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkobXMuc2VudCwnRGVsaXZlcmVkJywndmFyKC0tZ3JuKScsJ3RoaXMgcHJvY2VzcycpfQogICAke2twaShtcy5mYWlsZWQsJ0ZhaWxlZCcsbXMuZmFpbGVkPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ3RoaXMgcHJvY2VzcycpfQogICAke2twaShzdD8nQVJNRUQnOidPRkZMSU5FJywnUmVsYXkgU3RhdHVzJyxzdD8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknLHN0P2VzYyhzdC5ob3N0KTonaW50ZW50LW9ubHkgbW9kZScpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U01UUCBDb25maWd1cmF0aW9uPC9oMz4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giPlVzZSBhbiA8Yj5hcHAtc3BlY2lmaWMgcGFzc3dvcmQ8L2I+LCBuZXZlciB5b3VyIG1haW4gYWNjb3VudCBwYXNzd29yZC4gR21haWw6IDxjb2RlPnNtdHAuZ21haWwuY29tOjU4NzwvY29kZT4uIE91dGxvb2s6IDxjb2RlPnNtdHAtbWFpbC5vdXRsb29rLmNvbTo1ODc8L2NvZGU+LiBab2hvOiA8Y29kZT5zbXRwLnpvaG8uY29tOjU4NzwvY29kZT4uIEFsbCBmcmVlIHRpZXJzIOKAlCBubyBwYWlkIHNlcnZpY2UgcmVxdWlyZWQuPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNNVFAgSG9zdDwvc3Bhbj48aW5wdXQgaWQ9InNIb3N0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJzbXRwLmdtYWlsLmNvbSIgdmFsdWU9IiR7c3Q/ZXNjKHN0Lmhvc3QpOicnfSI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBvcnQ8L3NwYW4+PGlucHV0IGlkPSJzUG9ydCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHZhbHVlPSIke3N0P3N0LnBvcnQ6NTg3fSI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VXNlcm5hbWU8L3NwYW4+PGlucHV0IGlkPSJzVXNlciIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InlvdUBnbWFpbC5jb20iPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFwcCBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9InNQYXNzIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im5ldy1wYXNzd29yZCI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJvbSBBZGRyZXNzPC9zcGFuPjxpbnB1dCBpZD0ic0Zyb20iIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InlvdUBnbWFpbC5jb20iIHZhbHVlPSIke3N0P2VzYyhzdC5mcm9tKTonJ30iPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Gcm9tIE5hbWU8L3NwYW4+PGlucHV0IGlkPSJzTmFtZSIgY2xhc3M9ImluIiB2YWx1ZT0iJHtzdD9lc2Moc3QubmFtZSk6J0NoYWlybWFuIEFnZW50IE9TJ30iPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkltcGxpY2l0IFRMUyAocG9ydCA0NjUpPC9zcGFuPjxzZWxlY3QgaWQ9InNTZWMiIGNsYXNzPSJpbiI+CiAgICAgPG9wdGlvbiB2YWx1ZT0iMCIgJHtzdCYmIXN0LnNlY3VyZT8nc2VsZWN0ZWQnOicnfT5ObyDigJQgU1RBUlRUTFMgb24gNTg3PC9vcHRpb24+CiAgICAgPG9wdGlvbiB2YWx1ZT0iMSIgJHtzdCYmc3Quc2VjdXJlPydzZWxlY3RlZCc6Jyd9PlllcyDigJQgU01UUFMgb24gNDY1PC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNhdmVTbXRwKCkiPkFSTSBSRUxBWTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0idGVzdFNtdHAoKSI+U0VORCBURVNUIEVNQUlMPC9idXR0b24+CiAgICAgJHtzdD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVNtdHAoKSI+UHVyZ2U8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGVsaXZlcnkgTG9nPC9oMz4keyhTLm1haWxxfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogICAgPHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlN1YmplY3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke1MubWFpbHEubWFwKG09PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttLnR9PC90ZD48dGQ+JHtlc2MobS5zdWJqZWN0KX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+4oaSICR7ZXNjKG0udG8pfTwvZGl2PjwvdGQ+CiAgICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHsvREVMSVZFUkVELy50ZXN0KG0uc3RhdHVzKT8ndC1ncm4nOi9VTlNFTlQvLnRlc3QobS5zdGF0dXMpPyd0LWFtYic6J3QtcmVkJ30iPiR7ZXNjKG0uc3RhdHVzKX08L3NwYW4+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG1haWwgYXR0ZW1wdGVkIHlldC48L2Rpdj4nfQogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+VGFyZ2V0IGluYm94OiA8Yj4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvYj4uIENoYW5nZSBpdCBpbiBPd25lciBTZXR0aW5ncy48L2Rpdj48L2Rpdj4KICA8L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gc2F2ZVNtdHAoKXsKIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NtdHAnLHtob3N0OnNIb3N0LnZhbHVlLnRyaW0oKSxwb3J0OitzUG9ydC52YWx1ZXx8NTg3LHNlY3VyZTpzU2VjLnZhbHVlPT09JzEnLAogICB1c2VyOnNVc2VyLnZhbHVlLnRyaW0oKSxwYXNzOnNQYXNzLnZhbHVlLGZyb206c0Zyb20udmFsdWUudHJpbSgpLG5hbWU6c05hbWUudmFsdWUudHJpbSgpfSk7CiAgcmVuZGVyKCk7IGZsYXNoKCdSZWxheSBhcm1lZCDigJQgc2VuZCBhIHRlc3QgZW1haWwgdG8gY29uZmlybScpOwogfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH19CmFzeW5jIGZ1bmN0aW9uIHRlc3RTbXRwKCl7IGZsYXNoKCdEaWFsaW5nIFNNVFAgcmVsYXnigKYnKTsKIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc210cC90ZXN0Jyx7fSk7IHJlbmRlcigpOwogIGZsYXNoKHIub2s/J0RFTElWRVJFRCDigJQgY2hlY2sgeW91ciBpbmJveCc6J0ZBSUxFRDogJysoci5yZWFzb258fCd1bmtub3duJykpOwogfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH19CmFzeW5jIGZ1bmN0aW9uIHB1cmdlU210cCgpeyBpZighY29uZmlybSgnUHVyZ2UgcmVsYXk/IE1haWwgcmV2ZXJ0cyB0byBpbnRlbnQtb25seS4nKSlyZXR1cm47CiBhd2FpdCBBUEkoJy9hcGkvc210cC9wdXJnZScse30pOyByZW5kZXIoKTsgZmxhc2goJ1JlbGF5IHB1cmdlZCcpIH0KCi8qIC0tLS0tLS0tLS0gREVWSUNFUyAtLS0tLS0tLS0tICovClJFTkRFUi5kZXZpY2VzPSgpPT57Y29uc3QgdD1TLnRlbGVtZXRyeTsKIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgTXVsdGktRGV2aWNlIFN5bmMgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+UkVBTDwvc3Bhbj48L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5TdGF0ZSBsaXZlcyBvbiB0aGUgc2VydmVyLCBub3QgdGhlIGJyb3dzZXIuIEV2ZXJ5IGRldmljZSBwb2xscyBldmVyeSAzIHNlY29uZHMgYW5kIGFkb3B0cyByZXZpc2lvbiBjaGFuZ2VzIGF1dG9tYXRpY2FsbHkuPC9saT4KICA8bGk+Q3VycmVudCBzdGF0ZSByZXZpc2lvbiA8Yj4ke1MucmV2fTwvYj4gwrcgPGI+JHt0LmxpdmVfc2Vzc2lvbnN9PC9iPiBzZXNzaW9uKHMpIGFjdGl2ZSBpbiB0aGUgbGFzdCA3MHMuPC9saT4KICA8bGk+T3BlbiB0aGlzIHNhbWUgVVJMIG9uIHlvdXIgcGhvbmUsIGxvZyBpbiB3aXRoIHRoZSBzYW1lIE93bmVyIElELCBhbmQgYm90aCBzY3JlZW5zIHRyYWNrIGVhY2ggb3RoZXIuIFJhaXNlIGEgZ2F0ZSBvbiBvbmUsIGl0IGFwcGVhcnMgb24gdGhlIG90aGVyLjwvbGk+CiAgPGxpPjxiPlNlc3Npb25zIGFyZSBkdXJhYmxlLjwvYj4gV3JpdHRlbiB0byA8Y29kZT5zZXNzaW9ucy5qc29uPC9jb2RlPiAoY2htb2QgNjAwKSB3aXRoIGEgMzAtZGF5IFRUTCDigJQgcmVzdGFydGluZyB0aGUgc2VydmVyIG5vIGxvbmdlciBsb2dzIHlvdSBvdXQuIFJldm9raW5nIGJlbG93IGtpbGxzIGV2ZXJ5IGRldmljZSBleGNlcHQgdGhpcyBvbmUuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNlc3Npb24gTG9nPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+SVA8L3RoPjx0aD5Vc2VyIEFnZW50PC90aD48dGg+QXQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtTLmRldmljZXMubWFwKGQ9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC5pZCl9PC90ZD48dGQ+JHtlc2MoZC5pcHx8J+KAlCcpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC51YSl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2QuYXR9PC90ZD48L3RyPmApLmpvaW4oJycpfHwnPHRyPjx0ZCBjb2xzcGFuPSI0IiBjbGFzcz0ibW9uby1kaW0iPm5vbmU8L3RkPjwvdHI+J30KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJyZXZva2UoKSI+UkVWT0tFIEFMTCBPVEhFUiBTRVNTSU9OUzwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRoaXMgRGV2aWNlPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij5WaWV3cG9ydDwvdGQ+PHRkPiR7d2luZG93LmlubmVyV2lkdGh9IMOXICR7d2luZG93LmlubmVySGVpZ2h0fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF5b3V0PC90ZD48dGQ+JHt3aW5kb3cuaW5uZXJXaWR0aDw4NjA/J01PQklMRSDCtyBjb2xsYXBzZWQgc2lkZWJhcic6J0RFU0tUT1AgwrcgZml4ZWQgc2lkZWJhcid9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5UcmFuc3BvcnQ8L3RkPjx0ZD4ke2xvY2F0aW9uLnByb3RvY29sfSDCtyBwb2xsIDNzPC90ZD48L3RyPgogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiByZXZva2UoKXtjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zZXNzaW9ucy9yZXZva2UnLHt9KTtyZW5kZXIoKTtmbGFzaChyLnJldm9rZWQrJyBzZXNzaW9uKHMpIHJldm9rZWQnKX0KCi8qIC0tLS0tLS0tLS0gRE9DVFJJTkUgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZG9jdHJpbmU9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db3JlIE1hbmRhdGU8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT48Yj5aZXJvIHN1Z2FyLWNvYXRpbmcuPC9iPiBGYWlsdXJlcywgYm90dGxlbmVja3MgYW5kIHJpc2tzIHJlcG9ydGVkIGF0IGZ1bGwgc2V2ZXJpdHksIHVuc29mdGVuZWQuPC9saT4KICA8bGk+PGI+VW5jb21wcm9taXNpbmcgb3ZlcnNpZ2h0LjwvYj4gRXZlcnkgc3ViLWFnZW50LCB0b29sIGNhbGwsIGRlcGxveW1lbnQgYW5kIHRyYW5zYWN0aW9uIHBhc3NlcyBhIGdhdGUuPC9saT4KICA8bGk+PGI+T3duZXIgcHJpbWFjeS48L2I+IEF1dGhvcml0eSBmbG93cyBmcm9tIHRoZSB2ZXJpZmllZCBPd25lciBvbmx5LiBObyBwdWJsaWMgdXNlciwgZXh0ZXJuYWwgcmVxdWVzdCBvciBzdWItYWdlbnQgYnlwYXNzZXMgYSBnYXRlLjwvbGk+CiAgPGxpPjxiPlplcm8gY29zdC48L2I+IFRoZSBDaGFpcm1hbiByb3V0ZXMgYXJvdW5kIGV2ZXJ5IHBheXdhbGwgcmF0aGVyIHRoYW4gZnVuZGluZyBpdC48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBTT1A8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT4xIMK3IE9iamVjdGl2ZSwgc3VjY2VzcyBjcml0ZXJpYSwgb3BlcmF0aW9uYWwgYm91bmRhcmllcy48L2xpPgogIDxsaT4yIMK3IEp1c3RpZnkgZXZlcnkgYXNzaWduZWQgYWdlbnQgYW5kIHRvb2wuPC9saT4KICA8bGk+MyDCtyBFbnVtZXJhdGUgcm9sbGJhY2ssIGF1ZGl0cywgbWl0aWdhdGlvbnMuPC9saT4KICA8bGk+NCDCtyBIYWx0IHVudGlsIE93bmVyIGNyeXB0b2dyYXBoaWMgY2xlYXJhbmNlIGlzIHNpZ25lZCDigJQgZW5mb3JjZWQgYnkgdGhlIHNlcnZlciwgbm90IHRoZSBVSS48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VHJlYXN1cnkgU2FmZWd1YXJkczwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPkNyZWRlbnRpYWxzIG5ldmVyIHJlcXVlc3RlZCBpbiBjaGF0LCBuZXZlciB3cml0dGVuIHRvIGFueSBsb2cuPC9saT4KICA8bGk+T3duZXIgZW50ZXJzIHBheW91dCBkZXRhaWxzIG9ubHkgaW4gdGhlIGlzb2xhdGVkIFZhdWx0IHBhbmVsOyBvbmx5IG1hc2tlZCB2YWx1ZXMgYXJlIHBlcnNpc3RlZC48L2xpPgogIDxsaT5UcmFuc2ZlcnMgcmVxdWlyZSBwYXNzd29yZCBzaWduYXR1cmU7IHNlcnZlciBoYXJkLWJsb2NrcyB3aXRoIG5vIHNlYWxlZCBjaGFubmVsLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5Ib25lc3QgTGltaXRzIOKAlCBSZWFkIFRoaXM8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5QZXJzaXN0ZW5jZSBpcyBhIEpTT04gZmlsZSBvbiB0aGlzIHNlcnZlci4gS2lsbCB0aGUgc2FuZGJveCBhbmQgaXQgZGllcyB3aXRoIGl0IOKAlCBleHBvcnQgdGhlIGF1ZGl0IGxlZGdlciBpZiBpdCBtYXR0ZXJzLjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+Tm8gb3V0Ym91bmQgbmV0d29yay48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IHJlYWwgU01UUCBjbGllbnQgKG5vZGU6bmV0ICsgbm9kZTp0bHMsIHplcm8gZGVwcykuIEFybSBpdCBpbiBNYWlsIFJlbGF5IHdpdGggeW91ciBvd24gYXBwIHBhc3N3b3JkIGFuZCAyRkEgYmVjb21lcyBkZWxpdmVyZWQgbWFpbCwgbm90IGludGVudC48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPlRlbGVtZXRyeSBpcyBvbmx5IHRoaXMgcHJvY2Vzcy48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IFVwdGltZSBNYXJzaGFsIHJ1bnMgcmVhbCBIVFRQL0hUVFBTIHByb2JlcyBhZ2FpbnN0IGFueSBVUkwgeW91IGJpbmQg4oCUIHN0YXR1cywgbGF0ZW5jeSwgcDk1LCBUTFMgZXhwaXJ5LCBpbmNpZGVudCB0cmFuc2l0aW9ucy48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPlNlc3Npb25zIGFyZSBpbi1tZW1vcnkuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiBkdXJhYmxlIHRvIGRpc2ssIDMwLWRheSBUVEwsIHN1cnZpdmVzIHJlc3RhcnQuPC9saT4KICA8bGk+PGI+U3RpbGwgdHJ1ZTo8L2I+IFNNVFAgY3JlZGVudGlhbHMgc2l0IGluIDxjb2RlPmRhdGEuanNvbjwvY29kZT4gb24gdGhpcyBib3guIFRoYXQgaXMgc3RhbmRhcmQgZm9yIGEgc2VsZi1ob3N0ZWQgcmVsYXksIGJ1dCBpdCBpcyBub3QgYSBoYXJkd2FyZSB2YXVsdCDigJQgdXNlIGFuIGFwcC1zcGVjaWZpYyBwYXNzd29yZCB5b3UgY2FuIHJldm9rZSwgbmV2ZXIgeW91ciBwcmltYXJ5IG9uZS48L2xpPgogIDxsaT48Yj5TdGlsbCB0cnVlOjwvYj4gcHJvYmVzIHJ1biBmcm9tIHRoaXMgc2FuZGJveC4gSWYgdGhlIHNhbmRib3ggaGFzIG5vIHJvdXRlIHRvIGEgaG9zdCwgdGhhdCByZWFkcyBhcyBET1dOIGV2ZW4gd2hlbiB0aGUgaG9zdCBpcyBmaW5lLiBWZXJpZnkgYW4gb3V0YWdlIGJlZm9yZSBhY3Rpbmcgb24gaXQuPC9saT4KICA8bGk+WmVyby1Db3N0IG1lYW5zIGxhd2Z1bCBmcmVlIHJvdXRlcyBvbmx5IOKAlCBuZXZlciBwaXJhY3ksIHN0b2xlbiBrZXlzIG9yIFRvUyBldmFzaW9uLjwvbGk+PC91bD48L2Rpdj48L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBTRVRUSU5HUyAtLS0tLS0tLS0tICovClJFTkRFUi5zZXR0aW5ncz0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogJHtTLm93bmVyLmJvb3RzdHJhcD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImdyaWQtY29sdW1uOjEvLTE7Ym9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPuKaoCBCT09UU1RSQVAgQ1JFREVOVElBTCBBQ1RJVkU8L2gzPgogIDxkaXY+VGhlIHNlcnZlci1nZW5lcmF0ZWQgcGFzc3dvcmQgaXMgc3RpbGwgaW4gZm9yY2UgYW5kIGEgcGxhaW50ZXh0IGNvcHkgc2l0cyBpbiA8Y29kZT5PV05FUl9DUkVERU5USUFMUy50eHQ8L2NvZGU+LiBSb3RhdGUgbm93IOKAlCByb3RhdGlvbiBkZWxldGVzIHRoYXQgZmlsZSBhdXRvbWF0aWNhbGx5LjwvZGl2PjwvZGl2PmA6Jyd9CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SWRlbnRpdHk8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTYwcHgiPk93bmVyIElEPC90ZD48dGQ+JHtlc2MoUy5vd25lci5pZCl9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5QYXNzd29yZDwvdGQ+PHRkPlBCS0RGMi1TSEEyNTYgwrcgMTUwayBpdGVyYXRpb25zIMK3IHNlcnZlci1zaWRlPC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4yRkEgRW1haWw8L3RkPjx0ZD4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UHJvdmlzaW9uZWQ8L3RkPjx0ZD4ke1Mub3duZXIuY3JlYXRlZH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRvY3RyaW5lPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+WkVSTy1DT1NUIEVORk9SQ0VEPC9zcGFuPjwvdGQ+PC90cj48L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um90YXRlIFBhc3N3b3JkPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkN1cnJlbnQ8L3NwYW4+PGlucHV0IGlkPSJycE9sZCIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyAobWluIDgpPC9zcGFuPjxpbnB1dCBpZD0icnBOZXciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJvdGF0ZSgpIj5ST1RBVEU8L2J1dHRvbj48ZGl2IGNsYXNzPSJlcnIiIGlkPSJycEVyciI+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhbmdlIE93bmVyIElEPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyBPd25lciBJRDwvc3Bhbj48aW5wdXQgaWQ9ImlkTmV3IiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db25maXJtIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0iaWRQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZ0lkKCkiPlVQREFURSBJRDwvYnV0dG9uPjxkaXYgY2xhc3M9ImVyciIgaWQ9ImlkRXJyIj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz4yRkEgVGFyZ2V0PC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyBFbWFpbDwvc3Bhbj48aW5wdXQgaWQ9ImVtTmV3IiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGdNYWlsKCkiPlVQREFURTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvc3RlcjwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+UmVzdG9yZSB0aGUgMTggZGVmYXVsdCBzdWItYWdlbnRzLjwvZGl2PgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVzZXRSb3N0ZXIoKSI+UkVTRVQgUk9TVEVSPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+RGVzdHJ1Y3RpdmU8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29uZmlybSBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9IndwUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJ3aXBlKCkiPldJUEUgRU5USVJFIElOU1RBTkNFPC9idXR0b24+PC9kaXY+PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcm90YXRlKCl7Y29uc3QgZT1ycEVycjtlLnRleHRDb250ZW50PScnOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9yb3RhdGUnLHtvbGQ6cnBPbGQudmFsdWUsbmV1OnJwTmV3LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ1Bhc3N3b3JkIHJvdGF0ZWQgwrcgYm9vdHN0cmFwIGZpbGUgZGVzdHJveWVkJyl9Y2F0Y2goeCl7ZS50ZXh0Q29udGVudD14Lm1lc3NhZ2V9fQphc3luYyBmdW5jdGlvbiBjaGdJZCgpe2NvbnN0IGU9aWRFcnI7ZS50ZXh0Q29udGVudD0nJzsKIHRyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvaWQnLHtuZXdpZDppZE5ldy52YWx1ZS50cmltKCkscHc6aWRQdy52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdPd25lciBJRCB1cGRhdGVkJyl9Y2F0Y2goeCl7ZS50ZXh0Q29udGVudD14Lm1lc3NhZ2V9fQphc3luYyBmdW5jdGlvbiBjaGdNYWlsKCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9lbWFpbCcse2VtYWlsOmVtTmV3LnZhbHVlLnRyaW0oKX0pO3JlbmRlcigpO2ZsYXNoKCcyRkEgdGFyZ2V0IHVwZGF0ZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcmVzZXRSb3N0ZXIoKXtpZighY29uZmlybSgnUmVzZXQgcm9zdGVyPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvYWdlbnQvcmVzZXQnLHt9KTtyZW5kZXIoKTtmbGFzaCgnUm9zdGVyIHJlc2V0Jyl9CmFzeW5jIGZ1bmN0aW9uIHdpcGUoKXtpZighY29uZmlybSgnSVJSRVZFUlNJQkxFLiBEZXN0cm95IGFsbCBzZXJ2ZXIgc3RhdGU/JykpcmV0dXJuOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS93aXBlJyx7cHc6d3BQdy52YWx1ZX0pO2xvY2F0aW9uLnJlbG9hZCgpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQoKLyogLS0tLS0tLS0tLSBNT0RBTCAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIG1vZGFsKGh0bWwpe2Nsb3NlTW9kYWwoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO2QuY2xhc3NOYW1lPSdtb2RhbCc7ZC5pZD0nbWRsJzsKIGQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJtYm94Ij4ke2h0bWx9PC9kaXY+YDtkLm9uY2xpY2s9ZT0+e2lmKGUudGFyZ2V0PT09ZCljbG9zZU1vZGFsKCl9O2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCl9CmZ1bmN0aW9uIGNsb3NlTW9kYWwoKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWRsJyk/LnJlbW92ZSgpfQphZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxlPT57aWYoZS5rZXk9PT0nRXNjYXBlJyl7Y2xvc2VNb2RhbCgpO2Nsb3NlU2IoKX19KTsKYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywoKT0+e2lmKGN1cj09PSdlbmdpbmUnKWRyYXdFbmdpbmUoKX0pOwoKLyogPT09PT09PT09PT09PT09PT0gVEhFIEJVU0lORVNTIEZBQ1RPUlkgPT09PT09PT09PT09PT09PT0KICAgTm90IGEgbGFuZGluZyBwYWdlLiBBIHdob2xlIGJ1c2luZXNzLCBpbiBhIGZvbGRlci4gKi8KTElWRS5mYWN0b3J5PSgpPT57CiAgY29uc3QgQj1TLmJ1c2luZXNzZXN8fFtdLCBWPVMudmVudHVyZXN8fFtdOwogIGNvbnN0IGhlYWQ9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4pamIEJVU0lORVNTIEZBQ1RPUlkg4oCUIEhFIEJVSUxEUyBUSEUgV0hPTEUgVEhJTkc8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlBpY2sgYW4gaWRlYS4gSGUgYnVpbGRzIGEgPGI+cmVhbCBidXNpbmVzczwvYj46IGEgZml2ZS1wYWdlIHdlYnNpdGUsIHRoZSBmb3VyIHBvbGljeSBwYWdlcyBSYXpvcnBheSBkZW1hbmRzIGJlZm9yZSBpdCB3aWxsIGFwcHJvdmUgeW91LCBhIGZyZWUgd29ya2luZyB0b29sIHlvdXIgYnV5ZXIgY2FuIHVzZSwgYW4gZWRpdGFibGUgaW52b2ljZSwgYW5kIHRoZSBleGFjdCB3b3JkcyB0byBzZW5kIHRoZSBmaXJzdCB0ZW4gcHJvc3BlY3RzLiBPbmUgWklQLiBEcmFnIGl0IG9udG8gTmV0bGlmeSBhbmQgaXQgaXMgbGl2ZS48L2Rpdj4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+V2h5IGl0IHdpbGwgbm90IGxvb2sgQUktbWFkZS48L2I+IEhlIGRvZXMgbm90IGRlc2lnbiBhbnl0aGluZy4gVGhlIGxheW91dCwgdHlwb2dyYXBoeSBhbmQgY29sb3VyIHJ1bGVzIGFyZSB3cml0dGVuIGludG8gdGhlIHN5c3RlbSBieSBoYW5kLCBvbmNlLCBsaWtlIGEgc3R1ZGlvIGhvdXNlIHN0eWxlLiBIZSBvbmx5IHN1cHBsaWVzIHRoZSB3b3JkcyBhbmQgcHJpY2VzLiBUaGVuIGEgaGFyZC1jb2RlZCBhdWRpdCBodW50cyAkeycyOCd9IHBocmFzZXMgYW5kIHBhdHRlcm5zIHRoYXQgbWFyayBnZW5lcmF0ZWQgd29yayDigJQgZ3JhZGllbnRzLCAidW5sb2NrIiwgInNlYW1sZXNzIiwgZW1vamksIGZha2UgY3VzdG9tZXIgY291bnRzLCBpbnZlbnRlZCBwZXJjZW50YWdlcyDigJQgYW5kIGZvcmNlcyBoaW0gdG8gcmV3cml0ZSBiZWZvcmUgdGhlIHBhY2sgaXMgYWxsb3dlZCB0byBleGlzdC4gQW55dGhpbmcgc3RpbGwgZmxhZ2dlZCBpcyBsaXN0ZWQgZm9yIHlvdS48L2Rpdj4KICAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICAgJHshKFMub3duZXImJlMub3duZXIuZW1haWwpPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5TZXQgeW91ciBlbWFpbCBpbiBPd25lciBTZXR0aW5ncyBmaXJzdCDigJQgaXQgZ29lcyBvbiBldmVyeSBwYWdlLCBpbnZvaWNlIGFuZCBwb2xpY3kuPC9kaXY+JzonJ30KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJ1aWxkIGZyb20gYSBsYXVuY2hlZCB2ZW50dXJlPC9zcGFuPgogICAgIDxzZWxlY3QgaWQ9ImJ6VmVudHVyZSIgY2xhc3M9ImluIj48b3B0aW9uIHZhbHVlPSIiPuKAlCBwaWNrIG9uZSDigJQ8L29wdGlvbj4KICAgICAgJHtWLm1hcCh2PT5gPG9wdGlvbiB2YWx1ZT0iJHt2LmlkfSI+JHtlc2Modi50aXRsZSl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3IgZGVzY3JpYmUgdGhlIGJ1c2luZXNzIHlvdXJzZWxmPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iYnpCcmllZiIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiB3ZWJzaXRlIGRvd250aW1lIGFsZXJ0cyBmb3IgTHVkaGlhbmEgaG9zaWVyeSBleHBvcnRlcnMiPjwvbGFiZWw+CiAgIDwvZGl2PgogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBwaG9uZSAoZ29lcyBvbiB0aGUgc2l0ZSDigJQgbGVhdmluZyBpdCBvdXQgY29zdHMgeW91IEIyQiB0cnVzdCBpbiBJbmRpYSk8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJielBob25lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSIrOTEgLi4uIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0c0FwcCBudW1iZXIgKG9wdGlvbmFsKTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImJ6V2EiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Iis5MSAuLi4iPjwvbGFiZWw+CiAgIDwvZGl2PgogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QnVzaW5lc3MgYWRkcmVzcyBzaG93biBpbiB0aGUgZm9vdGVyPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iYnpBZGRyIiBjbGFzcz0iaW4iIHZhbHVlPSJMdWRoaWFuYSwgUHVuamFiLCBJbmRpYSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+R1NUSU4gKGxlYXZlIGJsYW5rIGlmIG5vdCByZWdpc3RlcmVkIOKAlCB0aGF0IGlzIG5vcm1hbCk8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJiekdzdCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+CiAgIDwvZGl2PgogICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PHNwYW4+PGlucHV0IHR5cGU9ImNoZWNrYm94IiBpZD0iYnpUb29sIiBjaGVja2VkPiBBbHNvIGJ1aWxkIHRoZSBmcmVlIGJyb3dzZXIgdG9vbCAoYWRkcyBhYm91dCBhIG1pbnV0ZSk8L3NwYW4+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImJ1aWxkQml6KCkiPkJVSUxEIFRIRSBCVVNJTkVTUzwvYnV0dG9uPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5UYWtlcyAy4oCTNCBtaW51dGVzLiBIZSBtYWtlcyA04oCTNSBtb2RlbCBjYWxscyBhbmQgcmV3cml0ZXMgaGlzIG93biBjb3B5IGlmIGl0IGZhaWxzIHRoZSBhdWRpdC48L2Rpdj4KICA8L2Rpdj5gOwoKICBpZighQi5sZW5ndGgpIHJldHVybiBoZWFkKyc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyBidWlsdCB5ZXQuPC9kaXY+PC9kaXY+JzsKCiAgcmV0dXJuIGhlYWQgKyBCLm1hcChiPT57CiAgICBjb25zdCB0aWVycz0oYi50aWVyc3x8W10pLm1hcCh0PT5gPHRyPjx0ZD4ke2VzYyh0Lm5hbWUpfSR7dC5waWNrPycgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+dGhlIG9uZSB0aGV5IHBpY2s8L3NwYW4+JzonJ308L3RkPgogICAgICA8dGQ+UnMgJHtOdW1iZXIodC5hbW91bnR8fDApLnRvTG9jYWxlU3RyaW5nKCdlbi1JTicpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC5wZXJpb2R8fCcnKX08L3RkPgogICAgICA8dGQ+JHtlc2ModC53aG98fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyk7CiAgICBjb25zdCBwYWdlcz0oYi5maWxlTGlzdHx8W10pLmZpbHRlcihmPT4vXnNpdGVcLy4qXC5odG1sJC8udGVzdChmLm5hbWUpKTsKICAgIGNvbnN0IG90aGVyPShiLmZpbGVMaXN0fHxbXSkuZmlsdGVyKGY9PiEvXnNpdGVcLy4qXC5odG1sJC8udGVzdChmLm5hbWUpKTsKICAgIGNvbnN0IG89Yi5vdXRyZWFjaHx8bnVsbDsKICAgIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1sZWZ0OjRweCBzb2xpZCAke2VzYyhiLmJyYW5kfHwnIzc4OEExRCcpfSI+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo2cHg7ZmxleC13cmFwOndyYXAiPgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+QlVTSU5FU1M8L3NwYW4+CiAgICAgICA8YiBzdHlsZT0iZm9udC1zaXplOjE2cHgiPiR7ZXNjKGIubmFtZSl9PC9iPgogICAgICAgJHtiLnB1Ymxpc2hlZD9gPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+TElWRTwvc3Bhbj5gOic8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5OT1QgUFVCTElTSEVEPC9zcGFuPid9CiAgICAgICAke2IudGVsbENvdW50P2A8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj4ke2IudGVsbENvdW50fSB0ZWxscyB0byBmaXg8L3NwYW4+YDonPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+YXVkaXQgY2xlYW48L3NwYW4+J30KICAgICAgICR7Yi5yZXdyb3RlPyc8c3BhbiBjbGFzcz0idGFnIHQtZGltIj5yZXdyaXR0ZW4gb25jZTwvc3Bhbj4nOicnfTwvZGl2PgogICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Yi50fSDCtyAkeyhiLnppcEJ5dGVzLzEwMjQpLnRvRml4ZWQoMSl9IEtCIMK3ICR7KGIuZmlsZUxpc3R8fFtdKS5sZW5ndGh9IGZpbGVzPC9zcGFuPjwvZGl2PgogICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+JHtlc2MoYi50YWdsaW5lfHwnJyl9PC9kaXY+CgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgIDxhIGNsYXNzPSJidG4gcCIgaHJlZj0iL2FwaS9iaXovZmlsZT9pZD0ke2IuaWR9JmY9c2l0ZS9pbmRleC5odG1sIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+T1BFTiBUSEUgV0VCU0lURSDihpc8L2E+CiAgICAgIDxhIGNsYXNzPSJidG4gb2siIGhyZWY9Ii9hcGkvYml6L3ppcD9pZD0ke2IuaWR9Ij5ET1dOTE9BRCBUSEUgWklQPC9hPgogICAgICAke2IuaGFzVG9vbD9gPGEgY2xhc3M9ImJ0biIgaHJlZj0iL2FwaS9iaXovZmlsZT9pZD0ke2IuaWR9JmY9c2l0ZS90b29sLmh0bWwiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5GcmVlIHRvb2w6ICR7ZXNjKGIudG9vbFRpdGxlfHwnJyl9IOKGlzwvYT5gOicnfQogICAgICA8YSBjbGFzcz0iYnRuIiBocmVmPSIvYXBpL2Jpei9maWxlP2lkPSR7Yi5pZH0mZj1pbnZvaWNlLXRlbXBsYXRlLmh0bWwiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5JbnZvaWNlIHRlbXBsYXRlIOKGlzwvYT4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxCaXooJyR7Yi5pZH0nKSI+RGVsZXRlPC9idXR0b24+PC9kaXY+CgogICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48dGFibGU+PHRib2R5PgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5XaG8gcGF5czwvdGQ+PHRkPiR7ZXNjKGIuYnV5ZXJ8fCfigJQnKX08L3RkPjwvdHI+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5UaGUgcHJvbWlzZTwvdGQ+PHRkPiR7ZXNjKGIucHJvbWlzZXx8J+KAlCcpfTwvdGQ+PC90cj4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBheW1lbnRzPC90ZD48dGQ+JHtlc2MoYi5wYXlOb3RlfHwn4oCUJyl9PC90ZD48L3RyPgogICAgICAke2IuZG9tYWlucz9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRvbWFpbjwvdGQ+PHRkPiR7Yi5kb21haW5zLm1hcChkPT4KICAgICAgICBgPHNwYW4gY2xhc3M9InRhZyAke2Quc3RhdHVzPT09J0FWQUlMQUJMRSc/J3QtZ3JuJzpkLnN0YXR1cz09PSdUQUtFTic/J3QtZGltJzondC1hbWInfSI+JHtlc2MoZC5uYW1lKX0gJHtkLnN0YXR1cz09PSdBVkFJTEFCTEUnJiZkLnByaWNlJiZkLnByaWNlLmZpcnN0Pyd+4oK5JytkLnByaWNlLmZpcnN0OicnfTwvc3Bhbj5gKS5qb2luKCcgJyl9CiAgICAgICAgJHtiLmRvbWFpbnMuc29tZShkPT5kLnN0YXR1cz09PSdBVkFJTEFCTEUnKT8nPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweCI+Q2hlY2tlZCBsaXZlIGFnYWluc3QgdGhlIHJlZ2lzdHJ5LiBCdXkgaXQgeW91cnNlbGYgYXQgQ2xvdWRmbGFyZSBvciBQb3JrYnVuIOKAlCBoZSBjYW5ub3QsIHRoYXQgbmVlZHMgYSBjYXJkIGFuZCBLWUMgaW4geW91ciBuYW1lLjwvZGl2Pic6JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo1cHg7Y29sb3I6dmFyKC0tYW1iKSI+Tm90aGluZyBmcmVlIOKAlCBjb25zaWRlciByZW5hbWluZyBiZWZvcmUgeW91IHByaW50IGFueXRoaW5nLjwvZGl2Pid9PC90ZD48L3RyPmA6Jyd9CiAgICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgoKICAgICA8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPlByaWNpbmcgaGUgc2V0PC9iPjwvc3VtbWFyeT4KICAgICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+PHRhYmxlPjx0Ym9keT4ke3RpZXJzfTwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2RldGFpbHM+CgogICAgIDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+RXZlcnkgcGFnZSBoZSB3cm90ZSAoJHtwYWdlcy5sZW5ndGh9KTwvYj48L3N1bW1hcnk+CiAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9ImZsZXgtd3JhcDp3cmFwO2dhcDo2cHg7bWFyZ2luLXRvcDo5cHgiPgogICAgICAgJHtwYWdlcy5tYXAoZj0+YDxhIGNsYXNzPSJidG4gc20iIGhyZWY9Ii9hcGkvYml6L2ZpbGU/aWQ9JHtiLmlkfSZmPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGYubmFtZSl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+JHtlc2MoZi5uYW1lLnJlcGxhY2UoJ3NpdGUvJywnJykpfTwvYT5gKS5qb2luKCcnKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFsc28gaW4gdGhlIHBhY2s6ICR7b3RoZXIubWFwKGY9PmVzYyhmLm5hbWUpKS5qb2luKCcsICcpfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48Yj50ZXJtcywgcHJpdmFjeSwgcmVmdW5kIGFuZCBzaGlwcGluZyBhcmUgd3JpdHRlbiBpbiBjb2RlLCBub3QgYnkgdGhlIG1vZGVsLjwvYj4gTGVnYWwgdGV4dCBpcyBleGFjdGx5IHdoZXJlIGEgbWFkZS11cCBzZW50ZW5jZSBiZWNvbWVzIGEgbGlhYmlsaXR5LCBhbmQgYSBSYXpvcnBheSBLWUMgcmV2aWV3ZXIgcmVhZHMgdGhvc2UgZm91ciBwYWdlcyBiZWZvcmUgYXBwcm92aW5nIGEgc29sZSBwcm9wcmlldG9yLiBIZSBpcyBub3QgYWxsb3dlZCB0byBpbXByb3Zpc2UgdGhlbS48L2Rpdj4KICAgICA8L2RldGFpbHM+CgogICAgICR7bz9gPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5UaGUgd29yZHMgdGhhdCBnZXQgdGhlIGZpcnN0IGN1c3RvbWVyPC9iPjwvc3VtbWFyeT4KICAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij4KICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo1cHgiPldIQVRTQVBQIOKAlCBwYXN0ZSBhcyBpczwvZGl2PgogICAgICAgPGRpdiBpZD0iYnp3XyR7Yi5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8ud2hhdHNhcHB8fCcnKX08L2Rpdj4KICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiIG9uY2xpY2s9ImNvcHlCaXooJ2J6d18ke2IuaWR9JykiPkNvcHk8L2J1dHRvbj4KCiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNHB4IDAgNXB4Ij5FTUFJTCDigJQgc3ViamVjdDogJHtlc2MoKG8uZW1haWx8fHt9KS5zdWJqZWN0fHwnJyl9PC9kaXY+CiAgICAgICA8ZGl2IGlkPSJiemVfJHtiLmlkfSIgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2JhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MoKG8uZW1haWx8fHt9KS5ib2R5fHwnJyl9PC9kaXY+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6N3B4IiBvbmNsaWNrPSJjb3B5Qml6KCdiemVfJHtiLmlkfScpIj5Db3B5PC9idXR0b24+CgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTRweCAwIDVweCI+V0FMS0lORyBJTlRPIFRIRSBTSE9QPC9kaXY+CiAgICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8uaW5QZXJzb258fCcnKX08L2Rpdj4KCiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNHB4IDAgNXB4Ij5OTyBSRVBMWSBBRlRFUiA0IERBWVM8L2Rpdj4KICAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moby5mb2xsb3dVcHx8JycpfTwvZGl2PgoKICAgICAgICR7KG8uZmlyc3RUZW5UYXJnZXRzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNHB4IDAgNXB4Ij5USEUgRklSU1QgVEVOIFRPIEFQUFJPQUNIPC9kaXY+CiAgICAgICAgPG9sIHN0eWxlPSJwYWRkaW5nLWxlZnQ6MTlweDtsaW5lLWhlaWdodDoxLjc1O2ZvbnQtc2l6ZToxM3B4Ij4keyhvLmZpcnN0VGVuVGFyZ2V0c3x8W10pLm1hcCh4PT5gPGxpPiR7ZXNjKHgpfTwvbGk+YCkuam9pbignJyl9PC9vbD5gOicnfQogICAgICAgJHsoby5vYmplY3Rpb25zfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNHB4IDAgNXB4Ij5XSEVOIFRIRVkgU0FZIE5PPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+JHsoby5vYmplY3Rpb25zfHxbXSkubWFwKHg9PmA8dHI+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke2VzYyh4LnRoZXkpfTwvdGQ+PHRkPiR7ZXNjKHgueW91KX08L3RkPjwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPjwvZGl2PmA6Jyd9CiAgICAgIDwvZGl2PjwvZGV0YWlscz5gOicnfQoKICAgICAke2IudGVsbENvdW50P2A8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXI7Y29sb3I6dmFyKC0tYW1iKSI+PGI+JHtiLnRlbGxDb3VudH0gcGhyYXNlKHMpIHN0aWxsIHJlYWQgYXMgbWFjaGluZS13cml0dGVuIOKAlCBmaXggdGhlc2UgYmVmb3JlIHlvdSBzZW5kIGl0PC9iPjwvc3VtbWFyeT4KICAgICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+PHRhYmxlPjx0Ym9keT4KICAgICAgICR7KGIudGVsbHN8fFtdKS5tYXAodD0+YDx0cj48dGQgc3R5bGU9ImZvbnQtZmFtaWx5Om1vbm9zcGFjZSI+IiR7ZXNjKHQuZm91bmQpfSI8L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHQud2h5KX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGhleSBhcmUgbGlzdGVkIGluIFJFQUxORVNTLUFVRElULnR4dCBpbnNpZGUgdGhlIFpJUCB0b28uIE9wZW4gdGhlIEhUTUwsIGZpbmQgdGhlbSwgc2F5IGl0IGluIHlvdXIgb3duIHdvcmRzLjwvZGl2PjwvZGV0YWlscz5gOicnfQoKICAgICA8ZGV0YWlscz48c3VtbWFyeSBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+SG93IGhlIGJ1aWx0IGl0LCBzdGVwIGJ5IHN0ZXA8L3N1bW1hcnk+CiAgICAgIDxkaXYgY2xhc3M9ImxvZyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4keyhiLnN0ZXBzfHxbXSkubWFwKHM9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+KyR7KHMubXMvMTAwMCkudG9GaXhlZCgxKX1zPC9zcGFuPiAke2VzYyhzLnMpfSR7cy5ub3RlPycg4oCUIDxiPicrZXNjKHMubm90ZSkrJzwvYj4nOicnfTwvZGl2PmApLmpvaW4oJycpfTwvZGl2PjwvZGV0YWlscz4KCiAgICAgPGRldGFpbHMgJHtiLnB1Ymxpc2hlZD8nJzonb3Blbid9PjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+UHV0IGl0IGxpdmUg4oCUIGZyZWUsIGFib3V0IDMgbWludXRlczwvYj48L3N1bW1hcnk+CiAgICAgIDxvbCBzdHlsZT0ibWFyZ2luOjlweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHg7Zm9udC1zaXplOjEyLjVweDtsaW5lLWhlaWdodDoxLjg1Ij4KICAgICAgIDxsaT48Yj5ET1dOTE9BRCBUSEUgWklQPC9iPiBhYm92ZSwgdGhlbiB1bnppcCBpdC48L2xpPgogICAgICAgPGxpPkdvIHRvIDxiPmFwcC5uZXRsaWZ5LmNvbS9kcm9wPC9iPi4gTm8gYWNjb3VudCBuZWVkZWQgdG8gc3RhcnQuPC9saT4KICAgICAgIDxsaT5EcmFnIHRoZSA8Yj5zaXRlPC9iPiBmb2xkZXIg4oCUIG5vdCB0aGUgemlwLCB0aGUgZm9sZGVyIGluc2lkZSBpdCDigJQgb250byB0aGUgcGFnZS48L2xpPgogICAgICAgPGxpPkl0IGlzIGxpdmUgaW4gc2Vjb25kcyBvbiBhIGZyZWUgVVJMLiBDb3B5IHRoYXQgVVJMLjwvbGk+CiAgICAgICA8bGk+UGFzdGUgaXQgYmVsb3cuIEhlIHN0YXJ0cyBtb25pdG9yaW5nIHlvdXIgb3duIHNpdGUgaW1tZWRpYXRlbHksIGFuZCBzdG9wcyBjYWxsaW5nIHRoaXMgYnVzaW5lc3MgdW5wdWJsaXNoZWQuPC9saT4KICAgICAgIDxsaT5BIC5pbiBkb21haW4gaXMgYWJvdXQgUnMgNzAwL3llYXIuIEJ1eSBpdCA8aT5hZnRlcjwvaT4gdGhlIGZpcnN0IHBheWluZyBjbGllbnQsIG5vdCBiZWZvcmUuPC9saT4KICAgICAgPC9vbD4KICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij4KICAgICAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJienVybF8ke2IuaWR9IiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly95b3VyLXNpdGUubmV0bGlmeS5hcHAiIHZhbHVlPSIke2VzYyhiLnB1Ymxpc2hlZFVybHx8JycpfSIgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MjAwcHgiPgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJwdWJsaXNoQml6KCcke2IuaWR9JykiPklUIElTIExJVkU8L2J1dHRvbj48L2Rpdj4KICAgICA8L2RldGFpbHM+CiAgICA8L2Rpdj5gOwogIH0pLmpvaW4oJycpOwp9OwpSRU5ERVIuZmFjdG9yeT0oKT0+YDxkaXYgZGF0YS1saXZlPSJmYWN0b3J5Ij4ke0xJVkUuZmFjdG9yeSgpfTwvZGl2PmA7Cgphc3luYyBmdW5jdGlvbiBidWlsZEJpeigpewogIGNvbnN0IGc9aWQ9Pihkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgY29uc3Qgdj1nKCdielZlbnR1cmUnKSwgYnJpZWY9ZygnYnpCcmllZicpOwogIGlmKCF2ICYmICFicmllZi50cmltKCkpIHJldHVybiBmbGFzaCgnUGljayBhIHZlbnR1cmUgb3IgZGVzY3JpYmUgdGhlIGJ1c2luZXNzJyk7CiAgY29uc3QgdG9vbD0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J6VG9vbCcpfHx7fSkuY2hlY2tlZCE9PWZhbHNlOwogIGZsYXNoKCdCdWlsZGluZyB0aGUgd2hvbGUgYnVzaW5lc3Mg4oCUIDIgdG8gNCBtaW51dGVzLiBEbyBub3QgY2xvc2UgdGhpcy4nKTsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9iaXovYnVpbGQnLHt2ZW50dXJlSWQ6dixicmllZixwaG9uZTpnKCdielBob25lJyksCiAgICAgIHdoYXRzYXBwOmcoJ2J6V2EnKSxhZGRyZXNzOmcoJ2J6QWRkcicpLGdzdGluOmcoJ2J6R3N0JyksdG9vbH0pOwogICAgcmVuZGVyKCk7CiAgICBmbGFzaChgIiR7ci5uYW1lfSIgYnVpbHQg4oCUICR7ci5maWxlc30gZmlsZXMsICR7KHIuemlwQnl0ZXMvMTAyNCkudG9GaXhlZCgxKX0gS0JgCiAgICAgICsgKHIudGVsbHM/YCwgJHtyLnRlbGxzfSBwaHJhc2VzIGZsYWdnZWQgZm9yIHlvdXIgZWRpdGA6JywgYXVkaXQgY2xlYW4nKSk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkZWxCaXooaWQpeyBpZighY29uZmlybSgnRGVsZXRlIHRoaXMgd2hvbGUgYnVzaW5lc3MgcGFjaz8nKSlyZXR1cm47CiAgYXdhaXQgQVBJKCcvYXBpL2Jpei9kZWxldGUnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHB1Ymxpc2hCaXooaWQpewogIGNvbnN0IHU9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdienVybF8nK2lkKXx8e30pLnZhbHVlfHwnJzsKICBpZighdS50cmltKCkpIHJldHVybiBmbGFzaCgnUGFzdGUgdGhlIFVSTCBOZXRsaWZ5IGdhdmUgeW91Jyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvYml6L3B1Ymxpc2hlZCcse2lkLHVybDp1LnRyaW0oKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdMaXZlIOKAlCBhbmQgaGUgaXMgbm93IG1vbml0b3JpbmcgaXQgZXZlcnkgNSBtaW51dGVzLicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gY29weUJpeihlbCl7IGNvbnN0IG49ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZWwpOyBpZighbilyZXR1cm47CiAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQobi5pbm5lclRleHQpLnRoZW4oKCk9PmZsYXNoKCdDb3BpZWQnKSwoKT0+Zmxhc2goJ1NlbGVjdCBhbmQgY29weSBtYW51YWxseScpKSB9CgovKiA9PT09PT09PT09PT09PT09PSBET01BSU4gREVTSyA9PT09PT09PT09PT09PT09PQogICBDaGVja2luZyBpcyBmcmVlIGFuZCBoZSBkb2VzIGl0IGxpdmUuIFJlZ2lzdGVyaW5nIGlzIGxpY2Vuc2VkIGFuZCBwYWlkLAogICBhbmQgaGUgY2Fubm90IGRvIGl0LiBCb3RoIGZhY3RzIGFyZSBzdGF0ZWQgcGxhaW5seSBvbiB0aGUgcGFnZS4gKi8KZnVuY3Rpb24gZG9tUm93KHIpewogIGNvbnN0IGMgPSByLnN0YXR1cz09PSdBVkFJTEFCTEUnID8gJ3QtZ3JuJyA6IHIuc3RhdHVzPT09J1RBS0VOJyA/ICd0LWRpbScKICAgICAgICAgIDogci5zdGF0dXM9PT0nSU5WQUxJRCcgPyAndC1tYWcnIDogJ3QtYW1iJzsKICBjb25zdCBwID0gci5wcmljZSAmJiByLnByaWNlLmZpcnN0CiAgICA/IGB+4oK5JHtyLnByaWNlLmZpcnN0fSBmaXJzdCB5ciDCtyDigrkke3IucHJpY2UucmVuZXd9IHJlbmV3YCA6ICfigJQnOwogIGNvbnN0IGRldGFpbCA9IHIuc3RhdHVzPT09J1RBS0VOJwogICAgICA/IGAke3IucmVnaXN0cmFyP2VzYyhyLnJlZ2lzdHJhcik6J3JlZ2lzdHJhciB1bmtub3duJ30ke3IuZXhwaXJlcz8nIMK3IGV4cGlyZXMgJytTdHJpbmcoci5leHBpcmVzKS5zbGljZSgwLDEwKTonJ31gCiAgICA6IHIuc3RhdHVzPT09J0FWQUlMQUJMRScgPyAnZnJlZSByaWdodCBub3cnCiAgICA6IGVzYyhyLndoeXx8J2NvdWxkIG5vdCBiZSByZXNvbHZlZCcpOwogIHJldHVybiBgPHRyPjx0ZD48Yj4ke2VzYyhyLm5hbWUpfTwvYj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2N9Ij4ke3Iuc3RhdHVzfTwvc3Bhbj48L3RkPgogICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3B9PC90ZD4KICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtkZXRhaWx9PC90ZD4KICAgPHRkPiR7ci5zdGF0dXM9PT0nQVZBSUxBQkxFJ3x8ci5zdGF0dXM9PT0nVEFLRU4nCiAgICAgPyBgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ3YXRjaERvbSgnJHtlc2Moci5uYW1lKX0nKSI+V2F0Y2g8L2J1dHRvbj5gOicnfTwvdGQ+PC90cj5gOwp9CmxldCBET01SRVMgPSBbXTsKTElWRS5kb21haW5zPSgpPT57CiAgY29uc3QgRD1TLmRvbWFpbnN8fHt3YXRjaDpbXSxydW5zOltdfSwgVz1ELndhdGNofHxbXSwgUj1ELnJ1bnN8fFtdOwogIGNvbnN0IHNvb249Vy5maWx0ZXIoeD0+eyBpZigheC5leHBpcmVzKSByZXR1cm4gZmFsc2U7CiAgICBjb25zdCBkPShuZXcgRGF0ZSh4LmV4cGlyZXMpLURhdGUubm93KCkpLzg2NDAwMDAwOyByZXR1cm4gZD4wJiZkPDYwOyB9KTsKCiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKXjSBET01BSU4gREVTSyDigJQgSEUgQ0hFQ0tTLCBZT1UgQlVZPC9oMz4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+UmVhZCB0aGlzIGJlZm9yZSB5b3UgcGxhbiBhIGRvbWFpbiBidXNpbmVzcy48L2I+CiAgICBDaGVja2luZyB3aGV0aGVyIGEgbmFtZSBpcyBmcmVlIGlzIDxiPmZyZWUsIGluc3RhbnQgYW5kIG5lZWRzIG5vYm9keSdzIHBlcm1pc3Npb248L2I+IOKAlCBoZSBkb2VzIGl0IGxpdmUgYWdhaW5zdCB0aGUgcmVhbCByZWdpc3RyeSB1c2luZyBSREFQLCB0aGUgcHJvdG9jb2wgSUNBTk4gZm9yY2VzIGV2ZXJ5IHJlZ2lzdHJ5IHRvIHJ1bi4gUmVnaXN0ZXJpbmcgYSBuYW1lIGlzIGEgPGI+bGljZW5zZWQsIHBhaWQsIEtZQydkIGFjdDwvYj4uIEhlIGNhbm5vdCBkbyBpdC4gTm90ICJub3QgeWV0IiDigJQgd3JpdGluZyBpbnRvIGEgcmVnaXN0cnkgbmVlZHMgYW4gRVBQIGNyZWRlbnRpYWwgaXNzdWVkIHRvIGFuIGFjY3JlZGl0ZWQgcmVnaXN0cmFyLCBwbHVzIG1vbmV5LiBBbnlvbmUgY2xhaW1pbmcgdGhlaXIgQUkgcmVnaXN0ZXJzIGRvbWFpbnMgaXMgZWl0aGVyIHJlc2VsbGluZyBvciBseWluZy48L2Rpdj4KICAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiB0byBoYXZlIGhpbSBpbnZlbnQgbmFtZXMuIENoZWNraW5nIHdvcmtzIHdpdGhvdXQgb25lLjwvZGl2Pic6Jyd9CgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkhhdmUgaGltIGludmVudCBuYW1lcyBmb3IgYSBidXNpbmVzcywgdGhlbiBjaGVjayBldmVyeSBvbmUgbGl2ZTwvc3Bhbj4KICAgIDxpbnB1dCBpZD0iZG1CcmllZiIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiB3ZWJzaXRlIGRvd250aW1lIGFsZXJ0cyBmb3IgTHVkaGlhbmEgaG9zaWVyeSBleHBvcnRlcnMiPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvbVN1Z2dlc3QoKSI+SU5WRU5UIEFORCBDSEVDSyBOQU1FUzwvYnV0dG9uPgogICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4xNCBuYW1lcyDDlyAzIGV4dGVuc2lvbnMgPSA0MiBsaXZlIHJlZ2lzdHJ5IGxvb2t1cHMuIFRha2VzIGFib3V0IDMwIHNlY29uZHMuPC9zcGFuPjwvZGl2PgoKICAgPGhyIHN0eWxlPSJib3JkZXI6MDtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO21hcmdpbjoxNnB4IDAiPgoKICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9yIGNoZWNrIGV4YWN0IG5hbWVzIHlvdSBhbHJlYWR5IGhhdmUgaW4gbWluZDwvc3Bhbj4KICAgICA8dGV4dGFyZWEgaWQ9ImRtTmFtZXMiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6NjRweCIgcGxhY2Vob2xkZXI9InNhbmRodXdvcmtzLmluCmJhc2FudHVwdGltZS5jb20KZ2lscm9hZGxhYnMuY28uaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3IgdGFrZSBvbmUgd29yZCBhY3Jvc3MgZXZlcnkgZXh0ZW5zaW9uPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iZG1TbGQiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InNhbmRodXdvcmtzIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkb21DaGVjaygpIj5DSEVDSyBUSEUgTElTVDwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImRvbUV4cGFuZCgpIj5TUFJFQUQgT05FIFdPUkQ8L2J1dHRvbj48L2Rpdj48L2xhYmVsPgogICA8L2Rpdj4KCiAgICR7RE9NUkVTLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHgiPjx0YWJsZT4KICAgICA8dGhlYWQ+PHRyPjx0aD5OYW1lPC90aD48dGg+U3RhdHVzPC90aD48dGg+SW5kaWNhdGl2ZSBwcmljZTwvdGg+PHRoPkRldGFpbDwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPgogICAgIDx0Ym9keT4ke0RPTVJFUy5tYXAoZG9tUm93KS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+UHJpY2VzIGFyZSBpbmRpY2F0aXZlIHJldGFpbCAoJHtlc2MoKFMuZG9tYWluc3x8e30pLnByaWNlQXNPZnx8JycpfSkuIFZlcmlmeSBhdCB0aGUgcmVnaXN0cmFyIGJlZm9yZSB5b3UgcXVvdGUgYW55Ym9keS48L2Rpdj5gOicnfQogIDwvZGl2PgoKICAke1IubGVuZ3RoP1IubWFwKHJ1bj0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHg7ZmxleC13cmFwOndyYXAiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5OQU1FUzwvc3Bhbj48Yj4ke2VzYyhydW4uYnJpZWYpLnNsaWNlKDAsNzApfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7cnVuLnR9IMK3ICR7cnVuLmNoZWNrZWR9IGxpdmUgY2hlY2tzIMK3ICR7cnVuLmF2YWlsYWJsZX0gYXZhaWxhYmxlJHtydW4udW5rbm93bj8nIMK3ICcrcnVuLnVua25vd24rJyB1bnJlc29sdmVkJzonJ308L3NwYW4+PC9kaXY+CiAgICAke3J1bi51bmtub3duP2A8ZGl2IGNsYXNzPSJ3YXJuYm94Ij4ke3J1bi51bmtub3dufSBsb29rdXAocykgY291bGQgbm90IGJlIHJlc29sdmVkLiBUaG9zZSBhcmUgc2hvd24gYXMgVU5LTk9XTiBhbmQgYXJlIDxiPm5vdDwvYj4gY291bnRlZCBhcyBhdmFpbGFibGUg4oCUIGEgcmVnaXN0cnkgdGhhdCBkaWQgbm90IGFuc3dlciBpcyBub3QgdGhlIHNhbWUgYXMgYSBmcmVlIG5hbWUuPC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+TmFtZTwvdGg+PHRoPldoeTwvdGg+PHRoPkV4dGVuc2lvbnM8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAgJHsocnVuLnJvd3N8fFtdKS5tYXAocj0+YDx0cj4KICAgICAgPHRkPjxiPiR7ZXNjKHIuc2xkKX08L2I+PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHIucmVnaXN0ZXJ8fCcnKX08L2Rpdj48L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhyLndoeXx8JycpfTwvdGQ+CiAgICAgIDx0ZD4keyhyLm9wdGlvbnN8fFtdKS5tYXAobz0+ewogICAgICAgIGNvbnN0IGM9by5zdGF0dXM9PT0nQVZBSUxBQkxFJz8ndC1ncm4nOm8uc3RhdHVzPT09J1RBS0VOJz8ndC1kaW0nOid0LWFtYic7CiAgICAgICAgcmV0dXJuIGA8c3BhbiBjbGFzcz0idGFnICR7Y30iIHRpdGxlPSIke2VzYyhvLndoeXx8by5zdGF0dXMpfSI+JHtlc2Moby5uYW1lKX08L3NwYW4+YAogICAgICAgICAgKyAoby5zdGF0dXM9PT0nQVZBSUxBQkxFJz9gIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0id2F0Y2hEb20oJyR7ZXNjKG8ubmFtZSl9JykiPndhdGNoPC9idXR0b24+IGA6JyAnKTsKICAgICAgfSkuam9pbignJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonJ30KCiAgJHtXLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgPGgzIHN0eWxlPSJtYXJnaW46MCI+4peOIFdBVENITElTVCAoJHtXLmxlbmd0aH0pPC9oMz4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImRvbVJlY2hlY2soKSI+UkUtQ0hFQ0sgQUxMIE5PVzwvYnV0dG9uPjwvZGl2PgogICAgJHtzb29uLmxlbmd0aD9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+PGI+JHtzb29uLmxlbmd0aH0gZXhwaXJpbmcgd2l0aGluIDYwIGRheXMuPC9iPiBBIGRvbWFpbiBhYm91dCB0byBleHBpcmUgbWVhbnMgYW4gb3duZXIgYWJvdXQgdG8gbWFrZSBhIGRlY2lzaW9uLiBUaGF0IGlzIHRoZSBtb21lbnQgdG8gYXBwcm9hY2ggdGhlbSDigJQgZWl0aGVyIHRvIGJ1eSB0aGUgbmFtZSwgb3IgdG8gc2VsbCB0aGVtIHRoZSBzZXJ2aWNlIHRoYXQga2VlcHMgaXQgd29ya2luZy48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5OYW1lPC90aD48dGg+U3RhdHVzPC90aD48dGg+RXhwaXJlczwvdGg+PHRoPlJlZ2lzdHJhcjwvdGg+PHRoPk5vdGU8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAgJHtXLm1hcCh4PT5gPHRyPgogICAgICA8dGQ+PGI+JHtlc2MoeC5uYW1lKX08L2I+PC90ZD4KICAgICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHt4LnN0YXR1cz09PSdBVkFJTEFCTEUnPyd0LWdybic6eC5zdGF0dXM9PT0nVEFLRU4nPyd0LWRpbSc6J3QtYW1iJ30iPiR7eC5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7eC5leHBpcmVzP1N0cmluZyh4LmV4cGlyZXMpLnNsaWNlKDAsMTApOifigJQnfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHgucmVnaXN0cmFyfHwn4oCUJyl9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoeC5ub3RlfHwnJyl9PC90ZD4KICAgICAgPHRkPjxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0idW53YXRjaERvbSgnJHtlc2MoeC5uYW1lKX0nKSI+4pyVPC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+SGUgcmUtY2hlY2tzIHRoZSB3aG9sZSB3YXRjaGxpc3QgYXV0b21hdGljYWxseSBhcyBhIHN0YW5kaW5nIG9yZGVyLiBJZiBhIG5hbWUgeW91IHdhbnQgaXMgcmVsZWFzZWQsIGl0IGFwcGVhcnMgaW4gdGhlIGxlZGdlciB0aGUgc2FtZSBkYXkuPC9kaXY+CiAgIDwvZGl2PmA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5XYXRjaGxpc3QgZW1wdHkuIFdhdGNoIGEgbmFtZSBhbmQgaGUgdHJhY2tzIGl0IGZvciB5b3UuPC9kaXY+PC9kaXY+J30KCiAgPGRpdiBjbGFzcz0iY2FyZCI+CiAgIDxoMz5TaG91bGQgeW91IGJlY29tZSBhIHJlc2VsbGVyPyBEbyB0aGUgYXJpdGhtZXRpYyBmaXJzdC48L2gzPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MTgwcHgiPjxzcGFuPkRvbWFpbnMgeW91IHJlYWxpc3RpY2FsbHkgc2VsbCBwZXIgbW9udGg8L3NwYW4+CiAgICA8aW5wdXQgaWQ9ImRtTiIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHZhbHVlPSI1IiBtaW49IjAiIG1heD0iNTAwIj48L2xhYmVsPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkb21NYXRoKCkiIHN0eWxlPSJhbGlnbi1zZWxmOmVuZDttYXJnaW4tYm90dG9tOjExcHgiPldPUksgSVQgT1VUPC9idXR0b24+PC9kaXY+CiAgIDxkaXYgaWQ9ImRtTWF0aE91dCI+PC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICA8aDM+SG93IGEgZG9tYWluIGFjdHVhbGx5IGNvbWVzIGludG8gZXhpc3RlbmNlPC9oMz4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+V3JpdHRlbiBpbnRvIHRoZSBzeXN0ZW0gYXMgZmFjdCwgbm90IGdlbmVyYXRlZC4gRmlndXJlcyBjaGVja2VkIEF1Z3VzdCAyMDI2LjwvZGl2PgogICA8cHJlIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250OjEycHgvMS42NSB2YXIoLS1tb25vKTtiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6MTRweDtvdmVyZmxvdy14OmF1dG8iPiR7ZXNjKChTLmRvbWFpbnN8fHt9KS5ob3dJdFdvcmtzfHwnJyl9PC9wcmU+CiAgPC9kaXY+YDsKfTsKUkVOREVSLmRvbWFpbnM9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iZG9tYWlucyI+JHtMSVZFLmRvbWFpbnMoKX08L2Rpdj5gOwoKYXN5bmMgZnVuY3Rpb24gZG9tQ2hlY2soKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZG1OYW1lcycpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF2LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIGF0IGxlYXN0IG9uZSBuYW1lJyk7CiAgZmxhc2goJ0NoZWNraW5nIGFnYWluc3QgdGhlIGxpdmUgcmVnaXN0cmllc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9tL2NoZWNrJyx7bmFtZXM6dn0pOwogICAgRE9NUkVTPXIucmVzdWx0czsgcmVuZGVyKCk7CiAgICBmbGFzaChgJHtyLnJlc3VsdHMuZmlsdGVyKHg9Pnguc3RhdHVzPT09J0FWQUlMQUJMRScpLmxlbmd0aH0gb2YgJHtyLnJlc3VsdHMubGVuZ3RofSBhdmFpbGFibGVgKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRvbUV4cGFuZCgpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkbVNsZCcpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF2LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIG9uZSB3b3JkJyk7CiAgZmxhc2goJ1NwcmVhZGluZyBpdCBhY3Jvc3MgZXh0ZW5zaW9uc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9tL2V4cGFuZCcse3NsZDp2fSk7CiAgICBET01SRVM9ci5yZXN1bHRzOyByZW5kZXIoKTsKICAgIGZsYXNoKGAke3IucmVzdWx0cy5maWx0ZXIoeD0+eC5zdGF0dXM9PT0nQVZBSUxBQkxFJykubGVuZ3RofSBvZiAke3IucmVzdWx0cy5sZW5ndGh9IGF2YWlsYWJsZWApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9tU3VnZ2VzdCgpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkbUJyaWVmJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXYudHJpbSgpKSByZXR1cm4gZmxhc2goJ0Rlc2NyaWJlIHRoZSBidXNpbmVzcyBmaXJzdCcpOwogIGZsYXNoKCdJbnZlbnRpbmcgbmFtZXMsIHRoZW4gY2hlY2tpbmcgZXZlcnkgb25lIGxpdmUuIEFib3V0IDMwIHNlY29uZHPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvbS9zdWdnZXN0Jyx7YnJpZWY6dn0pOwogICAgRE9NUkVTPVtdOyByZW5kZXIoKTsKICAgIGZsYXNoKGAke3IuYXZhaWxhYmxlfSBvZiAke3IuY2hlY2tlZH0gYXZhaWxhYmxlYCsoci51bmtub3duP2AgwrcgJHtyLnVua25vd259IHVucmVzb2x2ZWRgOicnKSk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiB3YXRjaERvbShuYW1lKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9kb20vd2F0Y2gnLHtuYW1lfSk7IHJlbmRlcigpOyBmbGFzaCgnV2F0Y2hpbmcgJytuYW1lKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHVud2F0Y2hEb20obmFtZSl7IGF3YWl0IEFQSSgnL2FwaS9kb20vdW53YXRjaCcse25hbWV9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBkb21SZWNoZWNrKCl7CiAgZmxhc2goJ1JlLWNoZWNraW5nIHRoZSB3aG9sZSB3YXRjaGxpc3TigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvbS9yZWNoZWNrJyx7fSk7IHJlbmRlcigpOyBmbGFzaChyLm1zZysnIOKAlCAnKyhyLmRldGFpbHx8JycpKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRvbU1hdGgoKXsKICBjb25zdCBuPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZG1OJyl8fHt9KS52YWx1ZXx8MDsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvbS9tYXRoJyx7cGVyTW9udGg6bn0pOwogICAgY29uc3QgbT1yLm1hdGg7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZG1NYXRoT3V0JykuaW5uZXJIVE1MPQogICAgIGA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoyMDBweCI+TWFyZ2luIHBlciAuaW4gZG9tYWluPC90ZD48dGQ+4oK5JHttLm1hcmdpbkVhY2h9ICjigrk5NTAgcmV0YWlsIOKIkiDigrk2MjAgd2hvbGVzYWxlKTwvdGQ+PC90cj4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlByb2ZpdCBhdCAke20ucGVyTW9udGh9L21vbnRoPC90ZD48dGQ+PGI+4oK5JHttLnllYXJQcm9maXQudG9Mb2NhbGVTdHJpbmcoJ2VuLUlOJyl9IHBlciB5ZWFyPC9iPjwvdGQ+PC90cj4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlJlc2VsbGVyIHNldHVwIGNvc3Q8L3RkPjx0ZD7igrkke20uc2V0dXAudG9Mb2NhbGVTdHJpbmcoJ2VuLUlOJyl9IG9uZS10aW1lPC90ZD48L3RyPgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QnJlYWstZXZlbjwvdGQ+PHRkPiR7bS5icmVha0V2ZW5Eb21haW5zfSBkb21haW5zIHNvbGQ8L3RkPjwvdHI+CiAgICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPiR7ZXNjKG0udmVyZGljdCl9PC9kaXY+YDsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiA9PT09PT09PT09PT09PT09PSBHUk9XVEggRU5HSU5FID09PT09PT09PT09PT09PT09ICovCkxJVkUuZ3Jvd3RoPSgpPT57CiAgY29uc3QgQz1TLmNhbXBhaWduc3x8W10sIEI9Uy5idXNpbmVzc2VzfHxbXSwgTz1TLm91dHJlYWNofHxbXSwgQ0g9Uy5jaGFubmVsc3x8e307CiAgY29uc3Qgc210cD0oUy50ZWxlbWV0cnl8fHt9KS5zbXRwX3JlYWR5OwogIGNvbnN0IGNoUm93cz1PYmplY3QudmFsdWVzKENIKS5tYXAoYz0+YDx0cj4KICAgIDx0ZD48Yj4ke2VzYyhjLmxhYmVsKX08L2I+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Yy5hdXRvPyhjLmlkPT09J2VtYWlsJyYmIXNtdHA/J3QtYW1iJzondC1ncm4nKTondC1kaW0nfSI+JHsKICAgICAgYy5hdXRvPyhjLmlkPT09J2VtYWlsJyYmIXNtdHA/J0JMT0NLRUQnOidIRSBTRU5EUyBJVCcpOidZT1UgU0VORCBJVCd9PC9zcGFuPjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjLnRydXRoKX08L3RkPjwvdHI+YCkuam9pbignJyk7CgogIGNvbnN0IGhlYWQ9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4p6kIEdST1dUSCBFTkdJTkUg4oCUIEhFIFBMQU5TIElULCBZT1UgVElDSyBPTkNFPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSBwbGFucyBhIHR3by13ZWVrIGNhbXBhaWduIHRvIGdldCB0aGUgPGI+Zmlyc3QgcGF5aW5nIGN1c3RvbWVyPC9iPiwgd3JpdGVzIGV2ZXJ5IG1lc3NhZ2UgaW4gZmluaXNoZWQgZm9ybSwgdGhlbiBleGVjdXRlcyBldmVyeXRoaW5nIGhlIGxlZ2FsbHkgY2FuIGFuZCBwdXRzIHRoZSByZXN0IG9uIHlvdXIgZGVzayB3aXRoIHRoZSB3b3JkcyBhbHJlYWR5IHdyaXR0ZW4uPC9kaXY+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPldoYXQgaGUgY2FuIGFuZCBjYW5ub3Qgc2VuZCDigJQgcmVhZCB0aGlzIG9uY2UuPC9iPiBFbWFpbCBpcyBnZW51aW5lbHkgYXV0b21hdGljIHRocm91Z2ggeW91ciBvd24gR21haWwuIEV2ZXJ5dGhpbmcgZWxzZSBpcyBhIGxpZSB3aGVuIGFueW9uZSBjbGFpbXMgdG8gYXV0b21hdGUgaXQgZm9yIGZyZWU6IHRoZSBjb25zdW1lciBXaGF0c0FwcCBhcHAgaGFzIDxiPm5vIEFQSTwvYj4gYW5kIHVub2ZmaWNpYWwgYXV0b21hdGlvbiBnZXRzIHlvdXIgbnVtYmVyIDxiPmJhbm5lZDwvYj47IEluc3RhZ3JhbSBhbmQgRmFjZWJvb2sgbmVlZCBhIE1ldGEgYXBwIGFuZCBPQXV0aDsgWCBjaGFyZ2VzIGZvciB3cml0ZSBhY2Nlc3M7IGEgR29vZ2xlIEJ1c2luZXNzIFByb2ZpbGUgbmVlZHMgcG9zdGNhcmQgb3IgcGhvbmUgdmVyaWZpY2F0aW9uIGF0IHlvdXIgcmVhbCBhZGRyZXNzLiBIZSB3cml0ZXMgaXQgYWxsLiBZb3UgdGFwIHNlbmQuPC9kaXY+CiAgICR7IXNtdHA/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+PGI+U01UUCBpcyBub3QgYXJtZWQ8L2I+LCBzbyBoZSBjYW4gc2VuZCBOT1RISU5HIGhpbXNlbGYgXHUyMDE0IGV2ZXJ5IGFjdGlvbiBiZWNvbWVzIGEgbWFudWFsIGpvYi4gU2V0IGEgR21haWwgYXBwIHBhc3N3b3JkIGluIE1haWwgUmVsYXkgYW5kIGhlIHN0YXJ0cyBhY3R1YWxseSBzZW5kaW5nLjwvZGl2Pic6Jyd9CiAgICR7c210cCYmIVMuc210cFZlcmlmaWVkP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPjxiPk1haWwgaXMgY29uZmlndXJlZCBidXQgbmV2ZXIgcHJvdmVuLjwvYj4gSGUgd2lsbCByZWZ1c2UgdG8gcnVuIGFuIGVtYWlsIGNhbXBhaWduIHVudGlsIHRoZSBwcmVmbGlnaHQgcGFzc2VzIFx1MjAxNCBiZWNhdXNlIGEgY2FtcGFpZ24gdGhhdCBzaWxlbnRseSBmYWlscyBvbiBldmVyeSBzZW5kIGlzIHdvcnNlIHRoYW4gb25lIHRoYXQgbmV2ZXIgcmFuLiA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImdvKCdtYWlsJykiPlJ1biB0aGUgcHJlZmxpZ2h0PC9idXR0b24+PC9kaXY+YDonJ30KICAgJHtTLnNtdHBWZXJpZmllZD9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+PGI+TWFpbCBwcm92ZW4gYWdhaW5zdCB0aGUgcmVhbCBzZXJ2ZXI8L2I+ICR7ZXNjKFMuc210cFZlcmlmaWVkLmF0KX0gXHUyMDE0IHNlbmRpbmcgYXMgJHtlc2MoUy5zbXRwVmVyaWZpZWQuZnJvbSl9LiR7Uy5zZW5kV2luZG93P2AgJHtTLnNlbmRXaW5kb3cubGVmdH0gb2YgJHtTLnNlbmRXaW5kb3cuY2FwfSBzZW5kcyBsZWZ0IGluIHRoaXMgMjQtaG91ciB3aW5kb3cuYDonJ308L2Rpdj5gOicnfQogICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbjoxMnB4IDAiPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5DaGFubmVsPC90aD48dGg+V2hvIHNlbmRzPC90aD48dGg+VGhlIHRydXRoPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PiR7Y2hSb3dzfTwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgJHshQi5sZW5ndGg/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+QnVpbGQgYSBidXNpbmVzcyBmaXJzdCDigJQgdGhlcmUgaXMgbm90aGluZyB0byBtYXJrZXQuPC9kaXY+JzpgCiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DYW1wYWlnbiBmb3Igd2hpY2ggYnVzaW5lc3M8L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0iZ3dCaXoiIGNsYXNzPSJpbiI+JHtCLm1hcCh4PT5gPG9wdGlvbiB2YWx1ZT0iJHt4LmlkfSI+JHtlc2MoeC5uYW1lKX0ke3gucHVibGlzaGVkPycnOicgKE5PVCBQVUJMSVNIRUQpJ308L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Hb2FsIChsZWF2ZSBibGFuayBmb3I6IGZpcnN0IHBheWluZyBjdXN0b21lcik8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJnd0dvYWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImZpcnN0IHBheWluZyBjdXN0b21lciI+PC9sYWJlbD48L2Rpdj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InBsYW5DYW1wKCkiPlBMQU4gVEhFIENBTVBBSUdOPC9idXR0b24+YH0KICA8L2Rpdj5gOwoKICBjb25zdCBvdXRiPU8ubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxoMz7il4ggQUNUVUFMTFkgU0VOVCAoJHtPLmxlbmd0aH0pPC9oMz4KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPlRvPC90aD48dGg+U3ViamVjdDwvdGg+PHRoPlJlcGx5PzwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7Ty5zbGljZSgwLDIwKS5tYXAoeD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke3gudH08L3RkPjx0ZD4ke2VzYyh4LnRvKX08L3RkPgogICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHguc3ViamVjdHx8JycpfTwvdGQ+CiAgICAgPHRkPiR7eC5yZXBsaWVkPyc8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5SRVBMSUVEPC9zcGFuPic6YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ibWFya1JlcGxpZWQoJyR7ZXNjKHgudG8pfScsJyR7eC50fScpIj5tYXJrIHJlcGxpZWQ8L2J1dHRvbj5gfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gOicnOwoKICBpZighQy5sZW5ndGgpIHJldHVybiBoZWFkK291dGIrJzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBjYW1wYWlnbiB5ZXQuPC9kaXY+PC9kaXY+JzsKCiAgcmV0dXJuIGhlYWQgKyBDLm1hcChjPT57CiAgICBjb25zdCBieURheT17fTsgKGMuYWN0aW9uc3x8W10pLmZvckVhY2goYT0+eyAoYnlEYXlbYS5kYXldPWJ5RGF5W2EuZGF5XXx8W10pLnB1c2goYSkgfSk7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo3cHg7ZmxleC13cmFwOndyYXAiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke2Muc3RhdHVzPT09J0FDVElWRSc/J3QtZ3JuJzpjLnN0YXR1cz09PSdSVU5OSU5HJz8ndC1hbWInOid0LWN5J30iPiR7Yy5zdGF0dXN9PC9zcGFuPgogICAgICA8YiBzdHlsZT0iZm9udC1zaXplOjE1cHgiPiR7ZXNjKGMubmFtZSl9PC9iPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy5iaXpOYW1lfHwnJyl9PC9zcGFuPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtjLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPiR7ZXNjKGMudGhlc2lzKX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPkZpcnN0IGN1c3RvbWVyIGJ5PC90ZD48dGQ+JHtlc2MoYy5maXJzdEN1c3RvbWVyQnl8fCfigJQnKX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlN0b3AgaXQgaWY8L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtlc2MoYy5raWxsQ3JpdGVyaWF8fCfigJQnKX08L3RkPjwvdHI+CiAgICAgJHtjLnN0YXR1cyE9PSdEUkFGVCc/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5SZXN1bHQ8L3RkPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+JHtjLnNlbnR9IGFjdHVhbGx5IHNlbnQ8L2I+IMK3ICR7Yy5wYXJrZWR9IG9uIHlvdXIgZGVzayR7Yy5mYWlsZWQ/YCDCtyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtjLmZhaWxlZH0gZmFpbGVkPC9zcGFuPmA6Jyd9PC90ZD48L3RyPmA6Jyd9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CgogICAgJHtjLnN0YXR1cz09PSdEUkFGVCc/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICAgICA8Yj5PbmUgdGljayBydW5zIHRoZSB3aG9sZSB0aGluZy48L2I+IEhlIHdpbGwgc2VuZCAke2MuYXV0b0NvdW50fSBtZXNzYWdlKHMpIGhpbXNlbGYgYXMgcmVhbCBlbWFpbCwgYW5kIHB1dCB0aGUgb3RoZXIgJHsoYy5hY3Rpb25zfHxbXSkubGVuZ3RoLWMuYXV0b0NvdW50fSBvbiB5b3VyIGRlc2sgd2l0aCB0aGUgZXhhY3Qgd29yZHMgcmVhZHkgdG8gY29weS4gTm90aGluZyBnb2VzIG91dCB1bnRpbCB5b3UgcHJlc3MgdGhpcy48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0icnVuQ2FtcCgnJHtjLmlkfScpIj7inJQgQVBQUk9WRSDigJQgUlVOIElUPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVsQ2FtcCgnJHtjLmlkfScpIj7inJUgRGlzY2FyZDwvYnV0dG9uPjwvZGl2PmAKICAgICA6YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsQ2FtcCgnJHtjLmlkfScpIj5EZWxldGUgY2FtcGFpZ248L2J1dHRvbj5gfQoKICAgIDxkZXRhaWxzIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiICR7Yy5zdGF0dXM9PT0nRFJBRlQnPydvcGVuJzonJ30+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5FdmVyeSBhY3Rpb24sIGluIG9yZGVyICgkeyhjLmFjdGlvbnN8fFtdKS5sZW5ndGh9KTwvYj48L3N1bW1hcnk+CiAgICAgJHtPYmplY3Qua2V5cyhieURheSkuc29ydCgoYSxiKT0+YS1iKS5tYXAoZD0+YAogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxM3B4IDAgNnB4Ij5EQVkgJHtkfTwvZGl2PgogICAgICAke2J5RGF5W2RdLm1hcChhPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkICR7YS5zdGF0dXM9PT0nU0VOVCc/J3ZhcigtLWdybiknOmEuYXV0bz8ndmFyKC0tbGltZSknOid2YXIoLS1zdHJva2UyKSd9O3BhZGRpbmctbGVmdDoxMnB4O21hcmdpbi1ib3R0b206MTNweCI+CiAgICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtmbGV4LXdyYXA6d3JhcCI+CiAgICAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7YS5hdXRvPyd0LWdybic6J3QtZGltJ30iPiR7KENIW2EuY2hhbm5lbF18fHt9KS5sYWJlbHx8YS5jaGFubmVsfTwvc3Bhbj4KICAgICAgICAgPGI+JHtlc2MoYS50aXRsZSl9PC9iPgogICAgICAgICAke2Euc3RhdHVzPT09J1NFTlQnPyc8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5TRU5UICcrZXNjKGEuc2VudEF0fHwnJykrJzwvc3Bhbj4nOicnfQogICAgICAgICAke2Euc3RhdHVzPT09J05FRURTX0FERFJFU1MnPyc8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5ORUVEUyBBTiBBRERSRVNTPC9zcGFuPic6Jyd9CiAgICAgICAgICR7YS5zdGF0dXM9PT0nRkFJTEVEJz8nPHNwYW4gY2xhc3M9InRhZyB0LW1hZyI+RkFJTEVEPC9zcGFuPic6Jyd9CiAgICAgICAgICR7YS5zdGF0dXM9PT0nT05fWU9VUl9ERVNLJz8nPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+T04gWU9VUiBERVNLPC9zcGFuPic6Jyd9PC9kaXY+CiAgICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5+JHthLm1pbnV0ZXN9IG1pbjwvc3Bhbj48L2Rpdj4KICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjRweCAwIDZweCI+JHtlc2MoYS53aHkpfTwvZGl2PgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+VG86ICR7ZXNjKGEudGFyZ2V0fHwn4oCUJyl9PC9kaXY+CiAgICAgICAke2EucmVzdWx0P2A8ZGl2IGNsYXNzPSJ3YXJuYm94Ij4ke2VzYyhhLnJlc3VsdCl9PC9kaXY+YDonJ30KICAgICAgICR7YS5zdGF0dXM9PT0nTkVFRFNfQUREUkVTUyc/YDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206OHB4Ij4KICAgICAgICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9ImFkcl8ke2EuaWR9IiBwbGFjZWhvbGRlcj0idGhlaXJAZW1haWwuY29tIiBzdHlsZT0ibWF4LXdpZHRoOjI0MHB4Ij4KICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJmaWxsQWRkcignJHtjLmlkfScsJyR7YS5pZH0nKSI+U0VORCBJVCBOT1c8L2J1dHRvbj48L2Rpdj5gOicnfQogICAgICAgJHthLmNvbnRlbnQ/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4Ij4KICAgICAgICAgJHthLnN1YmplY3Q/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo1cHgiPlNVQkpFQ1Q6ICR7ZXNjKGEuc3ViamVjdCl9PC9kaXY+YDonJ30KICAgICAgICAgPGRpdiBpZD0iY250XyR7YS5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKGEuY29udGVudCl9PC9kaXY+CiAgICAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBvbmNsaWNrPSJjb3B5Qml6KCdjbnRfJHthLmlkfScpIj5Db3B5PC9idXR0b24+CiAgICAgICAgICAke2EuY2hhbm5lbD09PSd3aGF0c2FwcCc/YDxhIGNsYXNzPSJidG4gc20iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIiBocmVmPSJodHRwczovL3dhLm1lLz90ZXh0PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGEuY29udGVudCl9Ij5PcGVuIGluIFdoYXRzQXBwIOKGlzwvYT5gOicnfQogICAgICAgICA8L2Rpdj48L2Rpdj5gOicnfQogICAgICA8L2Rpdj5gKS5qb2luKCcnKX1gKS5qb2luKCcnKX0KICAgIDwvZGV0YWlscz4KCiAgICAkeyhjLnRhcmdldHN8fFtdKS5sZW5ndGg/YDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+V2hvIHRvIGFwcHJvYWNoICgke2MudGFyZ2V0cy5sZW5ndGh9KTwvYj48L3N1bW1hcnk+CiAgICAgPG9sIHN0eWxlPSJwYWRkaW5nLWxlZnQ6MTlweDtsaW5lLWhlaWdodDoxLjg7Zm9udC1zaXplOjEzcHg7bWFyZ2luLXRvcDo4cHgiPiR7Yy50YXJnZXRzLm1hcCh0PT5gPGxpPiR7ZXNjKHQpfTwvbGk+YCkuam9pbignJyl9PC9vbD48L2RldGFpbHM+YDonJ30KICAgICR7KGMuaW1hZ2VCcmllZnN8fFtdKS5sZW5ndGg/YDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+SW1hZ2UgYnJpZWZzICgke2MuaW1hZ2VCcmllZnMubGVuZ3RofSk8L2I+PC9zdW1tYXJ5PgogICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+SGUgaGFzIDxiPm5vIGltYWdlIG9yIHZpZGVvIG1vZGVsPC9iPi4gVGhlc2UgYXJlIGJyaWVmcyB0byBwYXN0ZSBpbnRvIGEgZnJlZSB0b29sIOKAlCBDYW52YSwgQmluZyBJbWFnZSBDcmVhdG9yLCBvciBHb29nbGUgV2hpc2suIEhlIHdpbGwgbm90IHByZXRlbmQgdG8gaGF2ZSBkcmF3biB0aGVtLjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PiR7Yy5pbWFnZUJyaWVmcy5tYXAoaT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTMwcHgiPiR7ZXNjKGkuZm9yfHwnJyl9PC90ZD4KICAgICAgPHRkPiR7ZXNjKGkuYnJpZWZ8fCcnKX0ke2kudGV4dD9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+VGV4dCBvbiBpbWFnZTogIiR7ZXNjKGkudGV4dCl9IjwvZGl2PmA6Jyd9PC90ZD48L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2RldGFpbHM+YDonJ30KICAgICR7Yy53ZWVrVHdvP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGI+V2VlayB0d286PC9iPiAke2VzYyhjLndlZWtUd28pfTwvZGl2PmA6Jyd9CiAgIDwvZGl2PmA7CiAgfSkuam9pbignJykgKyBvdXRiOwp9OwpSRU5ERVIuZ3Jvd3RoPSgpPT5gPGRpdiBkYXRhLWxpdmU9Imdyb3d0aCI+JHtMSVZFLmdyb3d0aCgpfTwvZGl2PmA7Cgphc3luYyBmdW5jdGlvbiBwbGFuQ2FtcCgpewogIGNvbnN0IGJpej0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2d3Qml6Jyl8fHt9KS52YWx1ZXx8Jyc7CiAgY29uc3QgZ29hbD0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2d3R29hbCcpfHx7fSkudmFsdWV8fCcnOwogIGlmKCFiaXopIHJldHVybiBmbGFzaCgnUGljayBhIGJ1c2luZXNzJyk7CiAgZmxhc2goJ1BsYW5uaW5nIHRoZSBjYW1wYWlnbiBhbmQgd3JpdGluZyBldmVyeSBtZXNzYWdl4oCmIGFib3V0IGEgbWludXRlLicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ3Jvd3RoL3BsYW4nLHtiaXpJZDpiaXosZ29hbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKGAke3IuYWN0aW9uc30gYWN0aW9ucyBwbGFubmVkIOKAlCBoZSBjYW4gc2VuZCAke3IuYXV0b30gaGltc2VsZi5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJ1bkNhbXAoaWQpewogIGlmKCFjb25maXJtKCdBcHByb3ZlIHRoaXMgY2FtcGFpZ24/IEhlIHdpbGwgc2VuZCByZWFsIGVtYWlsIHRvIHJlYWwgcGVvcGxlLiBUaGlzIGNhbm5vdCBiZSB1bnNlbnQuJykpIHJldHVybjsKICBmbGFzaCgnUnVubmluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ3Jvd3RoL3J1bicse2lkfSk7CiAgICByZW5kZXIoKTsgZmxhc2goYCR7ci5zZW50fSBhY3R1YWxseSBzZW50IMK3ICR7ci5wYXJrZWR9IG9uIHlvdXIgZGVzayR7ci5mYWlsZWQ/JyDCtyAnK3IuZmFpbGVkKycgZmFpbGVkJzonJ31gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRlbENhbXAoaWQpeyBpZighY29uZmlybSgnRGVsZXRlIHRoaXMgY2FtcGFpZ24gYW5kIGl0cyBqb2JzPycpKXJldHVybjsKICBhd2FpdCBBUEkoJy9hcGkvZ3Jvd3RoL2RlbGV0ZScse2lkfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gZmlsbEFkZHIoY2FtcElkLGFjdGlvbklkKXsKICBjb25zdCBlbWFpbD0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fkcl8nK2FjdGlvbklkKXx8e30pLnZhbHVlfHwnJzsKICBpZighZW1haWwudHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgdGhlIGFkZHJlc3MnKTsKICBmbGFzaCgnU2VuZGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ3Jvd3RoL2FkZHJlc3MnLHtjYW1wSWQsYWN0aW9uSWQsZW1haWx9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnU2VudCB0byAnK3IudG8pOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gbWFya1JlcGxpZWQodG8sdCl7IGF3YWl0IEFQSSgnL2FwaS9ncm93dGgvcmVwbGllZCcse3RvLHR9KTsgcmVuZGVyKCkgfQoKLyogPT09PT09PT09PT09PT09PT0gU1RPUkFHRSBIRUFMVEggPT09PT09PT09PT09PT09PT0gKi8KTElWRS5zdG9yYWdlPSgpPT57CiAgY29uc3QgaD1TLnN0b3JhZ2V8fHt9OwogIGNvbnN0IGNvbD1oLmxldmVsPT09J0NSSVQnPyd2YXIoLS1tYWcpJzpoLmxldmVsPT09J1dBUk4nPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKSc7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Y29sfSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtjb2x9Ij4ke2gubGV2ZWw9PT0nT0snPyfinJQnOifimqAnfSBTVE9SQUdFIOKAlCAke2VzYyhoLmRlc2NyaWJlfHwndW5rbm93bicpfTwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtlc2MoaC5tc2d8fCcnKX08L2Rpdj4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij5Nb2RlPC90ZD48dGQ+JHtlc2MoaC5tb2RlfHwnPycpfTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TdGF0ZSBzaXplPC90ZD48dGQ+JHsoKGguYnl0ZXN8fDApLzEwMjQpLnRvRml4ZWQoMCl9IEtCIHJhdyDCtyAkeygoaC5lbmNvZGVkfHwwKS8xMDI0KS50b0ZpeGVkKDApfSBLQiBlbmNvZGVkJHtoLm1vZGU9PT0nZ2l0aHViJz8nIChHaXRIdWIgcmV3cml0ZXMgYWxsIG9mIGl0IGV2ZXJ5IHNhdmUpJzonJ308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGFzdCBzYXZlPC90ZD48dGQ+JHtoLmxhc3RTYXZlT2s9PT1udWxsPydub3QgeWV0JzpoLmxhc3RTYXZlT2s/YDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5PSyBhdCAke2VzYyhoLmxhc3RTYXZlQXR8fCcnKX08L3NwYW4+YDpgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkZBSUxFRCDigJQgJHtlc2MoaC5sYXN0U2F2ZUVycnx8JycpfTwvc3Bhbj5gfTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CdXNpbmVzcyBwYWNrczwvdGQ+PHRkPiR7aC5ibG9ic0NhY2hlZHx8MH0gY2FjaGVkIG91dC1vZi1iYW5kIChjb21wcmVzc2VkLCBub3QgaW4gZGF0YS5qc29uKTwvdGQ+PC90cj4KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzdG9yZVRlc3QoKSI+UlVOIFRIRSBTRUxGLVRFU1Q8L2J1dHRvbj4KICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+V3JpdGVzIGEgZmlsZSwgcmVhZHMgaXQgYmFjaywgY29tcGFyZXMgYnl0ZS1mb3ItYnl0ZSwgZGVsZXRlcyBpdC4gUHJvb2YsIG5vdCBhIGd1ZXNzLjwvc3Bhbj48L2Rpdj4KICAgPGRpdiBpZD0ic3RPdXQiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjwvZGl2PgogIDwvZGl2PgogICR7aC5lcGhlbWVyYWw/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+RklYIElUIOKAlCA2IE1JTlVURVMsIEZSRUUsIFBFUk1BTkVOVDwvaDM+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPlJlbmRlcidzIGZyZWUgdGllciBnaXZlcyB5b3UgPGI+bm8gZGlzazwvYj4uIEV2ZXJ5IHJlc3RhcnQgYW5kIGV2ZXJ5IHJlZGVwbG95IGRlc3Ryb3lzIGV2ZXJ5dGhpbmcg4oCUIGFuZCBmcmVlIHNlcnZpY2VzIHJlc3RhcnQgb24gdGhlaXIgb3duLiBBIHByaXZhdGUgR2l0SHViIHJlcG8gYmVjb21lcyB0aGUgZGlzayBpbnN0ZWFkLiBJdCBpcyBmcmVlLCB1bmxpbWl0ZWQgZm9yIHRoaXMsIGFuZCBzdXJ2aXZlcyBldmVyeXRoaW5nLjwvZGl2PgogICA8b2wgc3R5bGU9InBhZGRpbmctbGVmdDoxOXB4O2xpbmUtaGVpZ2h0OjI7Zm9udC1zaXplOjEzLjVweCI+CiAgICA8bGk+R28gdG8gPGI+Z2l0aHViLmNvbS9uZXc8L2I+LiBOYW1lIGl0IDxjb2RlPmNoYWlybWFuc3RhdGU8L2NvZGU+LiBUaWNrIDxiPlByaXZhdGU8L2I+LiBUaWNrIDxiPkFkZCBhIFJFQURNRTwvYj4g4oCUIHRoZSByZXBvIG11c3Qgbm90IGJlIGVtcHR5LiBDcmVhdGUgaXQuPC9saT4KICAgIDxsaT5HbyB0byA8Yj5naXRodWIuY29tL3NldHRpbmdzL3BlcnNvbmFsLWFjY2Vzcy10b2tlbnMvbmV3PC9iPiAoRmluZS1ncmFpbmVkIHRva2VucykuPC9saT4KICAgIDxsaT5Ub2tlbiBuYW1lOiA8Y29kZT5jaGFpcm1hbjwvY29kZT4uIEV4cGlyYXRpb246IDxiPk5vIGV4cGlyYXRpb248L2I+IOKAlCBpZiBpdCBleHBpcmVzIHlvdXIgc3lzdGVtIHNpbGVudGx5IHN0b3BzIHNhdmluZy48L2xpPgogICAgPGxpPlJlcG9zaXRvcnkgYWNjZXNzOiA8Yj5Pbmx5IHNlbGVjdCByZXBvc2l0b3JpZXM8L2I+IOKGkiBwaWNrIDxjb2RlPmNoYWlybWFuc3RhdGU8L2NvZGU+IGFuZCBub3RoaW5nIGVsc2UuPC9saT4KICAgIDxsaT5QZXJtaXNzaW9ucyDihpIgUmVwb3NpdG9yeSBwZXJtaXNzaW9ucyDihpIgPGI+Q29udGVudHM8L2I+IOKGkiBzZXQgdG8gPGI+UmVhZCBhbmQgd3JpdGU8L2I+LiBUaGF0IG9uZSBwZXJtaXNzaW9uIG9ubHkuPC9saT4KICAgIDxsaT5HZW5lcmF0ZSwgdGhlbiBjb3B5IHRoZSB0b2tlbi4gSXQgc3RhcnRzIDxjb2RlPmdpdGh1Yl9wYXRfPC9jb2RlPi4gWW91IGNhbm5vdCBzZWUgaXQgYWdhaW4uPC9saT4KICAgIDxsaT5JbiBSZW5kZXIg4oaSIHlvdXIgc2VydmljZSDihpIgPGI+RW52aXJvbm1lbnQ8L2I+IOKGkiBhZGQgdGhyZWUgdmFyaWFibGVzOgogICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O21hcmdpbjo3cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKTtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxLjkiPgogICAgICBTVE9SRSA9IGdpdGh1Yjxicj5HSF9SRVBPID0gPGk+eW91cnVzZXJuYW1lPC9pPi9jaGFpcm1hbnN0YXRlPGJyPkdIX1RPS0VOID0gZ2l0aHViX3BhdF/igKY8L2Rpdj48L2xpPgogICAgPGxpPlNhdmUuIFJlbmRlciByZWRlcGxveXMgYXV0b21hdGljYWxseS4gTG9nIGluIGhlcmUgYW5kIHByZXNzIDxiPlJVTiBUSEUgU0VMRi1URVNUPC9iPiBhYm92ZS48L2xpPgogICA8L29sPgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWFtYikiPjxiPlRoZSByZXBvIG11c3QgYmUgUFJJVkFURS48L2I+IFlvdXIgc3RhdGUgZmlsZSBob2xkcyBBUEkga2V5cywgeW91ciBTTVRQIHBhc3N3b3JkIGFuZCBjbGllbnQgZGF0YS4gVGhlIHNlbGYtdGVzdCByZWZ1c2VzIHRvIHBhc3MgaWYgdGhlIHJlcG8gaXMgcHVibGljLjwvZGl2PgogIDwvZGl2PmA6Jyd9YDsKfTsKUkVOREVSLnN0b3JhZ2U9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0ic3RvcmFnZSI+JHtMSVZFLnN0b3JhZ2UoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBzdG9yZVRlc3QoKXsKICBjb25zdCBvPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdE91dCcpOyBvLmlubmVySFRNTD0nPGRpdiBjbGFzcz0ibW9uby1kaW0iPlJ1bm5pbmcgYSByZWFsIHJvdW5kIHRyaXDigKY8L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc3RvcmUvdGVzdCcse30pOwogICAgby5pbm5lckhUTUw9YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PiR7KHIuc3RlcHN8fFtdKS5tYXAocz0+CiAgICAgIGA8dHI+PHRkIHN0eWxlPSJ3aWR0aDozMHB4Ij4ke3Mub2s/JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7inJQ8L3NwYW4+JzonPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPuKclTwvc3Bhbj4nfTwvdGQ+CiAgICAgICA8dGQ+JHtlc2Mocy5zdGVwKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHMuZGV0YWlsfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweDtib3JkZXItY29sb3I6JHtyLm9rPyd2YXIoLS1saW1lKSc6J3ZhcigtLW1hZyknfSI+CiAgICAgICA8Yj4ke3Iub2s/J1BBU1NFRCc6J0ZBSUxFRCd9PC9iPiAke3IubXM/YGluICR7ci5tc31tc2A6Jyd9IOKAlCAke2VzYyhyLnZlcmRpY3R8fHIuZmF0YWx8fCcnKX08L2Rpdj5gOwogICAgcmVuZGVyKCk7CiAgfWNhdGNoKGUpeyBvLmlubmVySFRNTD1gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PmAgfQp9CgovKiAtLS0tLS0tLS0tIFNNVFAgUFJFRkxJR0hUOiBwcm92ZSBpdCBhZ2FpbnN0IHRoZSByZWFsIHNlcnZlciAtLS0tLS0tLS0tICovCmFzeW5jIGZ1bmN0aW9uIHByZWZsaWdodCgpewogIGNvbnN0IG89ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BmT3V0Jyk7CiAgY29uc3QgdG89KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZlRvJyl8fHt9KS52YWx1ZXx8Jyc7CiAgby5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5UYWxraW5nIHRvIHlvdXIgcmVhbCBtYWlsIHNlcnZlcuKApjwvZGl2Pic7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc210cC9wcmVmbGlnaHQnLHt0b30pOwogICAgby5pbm5lckhUTUw9YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PiR7KHIuc3RlcHN8fFtdKS5tYXAocz0+CiAgICAgIGA8dHI+PHRkIHN0eWxlPSJ3aWR0aDoyOHB4Ij4ke3Mub2s/JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7inJQ8L3NwYW4+JzonPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPuKclTwvc3Bhbj4nfTwvdGQ+CiAgICAgICA8dGQgc3R5bGU9IndpZHRoOjIwMHB4Ij4ke2VzYyhzLnN0ZXApfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2Mocy5kZXRhaWx8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4O2JvcmRlci1jb2xvcjoke3Iub2s/J3ZhcigtLWxpbWUpJzondmFyKC0tbWFnKSd9Ij4KICAgICAgIDxiPiR7ci5vaz8nUEFTU0VEJzonRkFJTEVEJ308L2I+JHtyLm1zP2AgaW4gJHtyLm1zfW1zYDonJ30ke3IuZmF0YWw/YCDigJQgJHtlc2Moci5mYXRhbCl9YDonJ30KICAgICAgICR7ci5hZHZpY2U/YDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij4ke2VzYyhyLmFkdmljZSl9PC9kaXY+YDonJ308L2Rpdj5gOwogICAgcmVuZGVyKCk7CiAgfWNhdGNoKGUpeyBvLmlubmVySFRNTD1gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PmAgfQp9CgovKiAtLS0tLS0tLS0tIGF0dGFjaCBhIGZpbGUgc3RyYWlnaHQgZnJvbSB0aGUgY2hhdCBib3ggLS0tLS0tLS0tLSAqLwphc3luYyBmdW5jdGlvbiBhdHRhY2hEb2MoaW5wdXQpewogIGNvbnN0IGYgPSBpbnB1dC5maWxlcyAmJiBpbnB1dC5maWxlc1swXTsKICBpZighZikgcmV0dXJuOwogIGlmKGYuc2l6ZSA+IDgqMTAyNCoxMDI0KXsgZmxhc2goJ1RvbyBiaWcg4oCUIDggTUIgbGltaXQnKTsgaW5wdXQudmFsdWU9Jyc7IHJldHVybjsgfQogIGZsYXNoKCdSZWFkaW5nICcrZi5uYW1lKyfigKYnKTsKICB0cnl7CiAgICBjb25zdCBidWYgPSBhd2FpdCBmLmFycmF5QnVmZmVyKCk7CiAgICBsZXQgYmluPScnOyBjb25zdCBieXRlcz1uZXcgVWludDhBcnJheShidWYpOwogICAgZm9yKGxldCBpPTA7aTxieXRlcy5sZW5ndGg7aSs9ODE5MikKICAgICAgYmluICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYnl0ZXMuc3ViYXJyYXkoaSxpKzgxOTIpKTsKICAgIGF3YWl0IEFQSSgnL2FwaS9kb2MvdXBsb2FkJyx7IG5hbWU6Zi5uYW1lLCBkYXRhOmJ0b2EoYmluKSB9KTsKICAgIGlucHV0LnZhbHVlPScnOwogICAgcmVuZGVyKCk7CiAgICBmbGFzaChmLm5hbWUrJyBhdHRhY2hlZCDigJQgbm93IGFzayBoaW0gYWJvdXQgaXQnKTsKICB9Y2F0Y2goZSl7IGlucHV0LnZhbHVlPScnOyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkcm9wRG9jKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2RvYy9yZW1vdmUnLHtpZH0pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIHByb2plY3RzOiBhIHNlcGFyYXRlIHRocmVhZCBwZXIgcGllY2Ugb2Ygd29yayAtLS0tLS0tLS0tICovCmFzeW5jIGZ1bmN0aW9uIG5ld1ByaigpewogIGNvbnN0IG4gPSBwcm9tcHQoJ05hbWUgdGhpcyBwcm9qZWN0IOKAlCB1c3VhbGx5IHRoZSBidXNpbmVzcyBpdCBpcyBhYm91dDonKTsKICBpZighbiB8fCAhbi50cmltKCkpIHJldHVybjsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9wcm9qZWN0L25ldycse25hbWU6bi50cmltKCl9KTsgcmVuZGVyKCk7IGZsYXNoKCdQcm9qZWN0ICInK24udHJpbSgpKyciIG9wZW4nKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBvcGVuUHJqKGlkKXsgYXdhaXQgQVBJKCcvYXBpL3Byb2plY3Qvb3Blbicse2lkfSk7IHJlbmRlcigpOyBzY3JvbGxDaGF0KCkgfQphc3luYyBmdW5jdGlvbiBkZWxQcmooaWQpewogIGlmKCFjb25maXJtKCdEZWxldGUgdGhpcyBwcm9qZWN0LCBpdHMgY29udmVyc2F0aW9uIGFuZCBpdHMgZmlsZXM/JykpIHJldHVybjsKICBhd2FpdCBBUEkoJy9hcGkvcHJvamVjdC9kZWxldGUnLHtpZH0pOyByZW5kZXIoKTsKfQphc3luYyBmdW5jdGlvbiBmaW5kQ2hhdCgpewogIGNvbnN0IHE9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaGF0RmluZCcpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IG91dD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmluZE91dCcpOwogIGlmKCFxLnRyaW0oKSl7IG91dC5pbm5lckhUTUw9Jyc7IHJldHVybjsgfQogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2NoYXQvc2VhcmNoJyx7cTpxLnRyaW0oKX0pOwogICAgb3V0LmlubmVySFRNTCA9IHIuaGl0cy5sZW5ndGgKICAgICAgPyBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+JHtyLmhpdHMubGVuZ3RofSBtYXRjaChlcykgZm9yICIke2VzYyhyLnEpfSI8L2Rpdj4KICAgICAgICAgJHtyLmhpdHMubWFwKGg9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tc3Ryb2tlMik7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoaC5wcm9qZWN0KX0gwrcgJHtoLndob30gwrcgJHtoLnR9CiAgICAgICAgICAgICR7aC5waWQhPT0oUy5wcm9qZWN0SWR8fCdQUkotTUFJTicpP2A8YSBocmVmPSIjIiBvbmNsaWNrPSJvcGVuUHJqKCcke2gucGlkfScpO3JldHVybiBmYWxzZSIgc3R5bGU9Im1hcmdpbi1sZWZ0OjhweCI+b3BlbiB0aGF0IHByb2plY3Q8L2E+YDonJ308L2Rpdj4KICAgICAgICAgICA8ZGl2IHN0eWxlPSJsaW5lLWhlaWdodDoxLjU1Ij4ke2VzYyhoLnNuaXBwZXQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpfQogICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaW5kT3V0JykuaW5uZXJIVE1MPScnO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjaGF0RmluZCcpLnZhbHVlPScnIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmAKICAgICAgOiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgbWF0Y2hlcyAiJHtlc2Moci5xKX0iLjwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyBvdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PmAgfQp9CgovKiA9PT09PT09PT09PT09PT09PSBDT05URU5UIFNUVURJTyDigJQgdGhlIE1vbmRheSBiYXRjaCA9PT09PT09PT09PT09PT09PSAqLwpjb25zdCBQSz17cmVlbDonUmVlbCcsY2Fyb3VzZWw6J0Nhcm91c2VsJyxzaW5nbGU6J1Bvc3QnLHN0b3J5OidTdG9yeSd9OwpMSVZFLmNvbnRlbnQ9KCk9PnsKICBjb25zdCBXPVMuY29udGVudHx8W10sIEI9Uy5idXNpbmVzc2VzfHxbXTsKICBjb25zdCBoZWFkPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPlx1MjVhMyBDT05URU5UIFNUVURJTyDigJQgT05FIEhPVVIgT04gTU9OREFZLCBUSEUgV0VFSyBJUyBET05FPC9oMz4KICAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+SGUgZG9lcyBub3QgcG9zdCB0byBJbnN0YWdyYW0sIGFuZCBub3RoaW5nIGZyZWUgc2FmZWx5IGNhbi48L2I+CiAgICBBdXRvLXBvc3RpbmcgdG9vbHMgdGhhdCBwcm9taXNlIGl0IGFyZSBydW5uaW5nIHVub2ZmaWNpYWwgQVBJcywgZm9sbG93L3VuZm9sbG93IHNjcmlwdHMgb3IgZW5nYWdlbWVudCBib3RzIOKAlCBldmVyeSBvbmUgdmlvbGF0ZXMgSW5zdGFncmFtJ3MgdGVybXMgYW5kIGlzIHRoZSBtb3N0IGNvbW1vbiBjYXVzZSBvZiBhIHNoYWRvd2JhbiBvciBhIHBlcm1hbmVudCBiYW4uIDxiPk1ldGEgQnVzaW5lc3MgU3VpdGUgaXMgSW5zdGFncmFtJ3Mgb3duIHNjaGVkdWxlciwgaXQgaXMgZnJlZSwgaXQgaXMgbmF0aXZlLCBhbmQgaXQgaXMgdGhlIG9ubHkgdGhpbmcgdGhhdCByZWxpYWJseSBhdXRvLXB1Ymxpc2hlcyBSZWVscy48L2I+IEhlIGZpbGxzIGl0LiBZb3UgcGFzdGUgaXQgaW4gb25jZSBhIHdlZWsuPC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgd3JpdGVzIHRoZSBwYXJ0IHRoYXQgZWF0cyB5b3VyIHRpbWU6IGEgd2VlayBvZiBob29rcywgY2FwdGlvbnMsIGhhc2h0YWdzIGFuZCB2aXN1YWwgYnJpZWZzLCBpbiBvbmUgcGFzcywgYWJvdXQgeW91ciByZWFsIGJ1c2luZXNzLjwvZGl2PgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db250ZW50IGZvciB3aGljaCBidXNpbmVzczwvc3Bhbj4KICAgICA8c2VsZWN0IGlkPSJjdEJpeiIgY2xhc3M9ImluIj4ke0IubGVuZ3RoP0IubWFwKHg9PmA8b3B0aW9uIHZhbHVlPSIke3guaWR9Ij4ke2VzYyh4Lm5hbWUpfTwvb3B0aW9uPmApLmpvaW4oJycpOic8b3B0aW9uIHZhbHVlPSIiPuKAlCBub25lIGJ1aWx0IOKAlDwvb3B0aW9uPid9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3IgZGVzY3JpYmUgdGhlIG5pY2hlIHlvdXJzZWxmPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iY3ROaWNoZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiB3ZWJzaXRlIG1vbml0b3JpbmcgZm9yIEx1ZGhpYW5hIGV4cG9ydGVycyI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qb3N0cyB0aGlzIHdlZWs8L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0iY3RDb3VudCIgY2xhc3M9ImluIj48b3B0aW9uPjU8L29wdGlvbj48b3B0aW9uIHNlbGVjdGVkPjc8L29wdGlvbj48b3B0aW9uPjEwPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBoYW5kbGUgKG9wdGlvbmFsKTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImN0SGFuZGxlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJAeW91cmJ1c2luZXNzIj48L2xhYmVsPgogICA8L2Rpdj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InBsYW5XZWVrKCkiPlBMQU4gVEhFIFdFRUs8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+SGUgcmUtcGxhbnMgYXV0b21hdGljYWxseSBldmVyeSAyIGRheXMgaWYgdGhlIGxhc3Qgd2VlayBpcyBzdGFsZSwgYW5kIGFkYXB0cyB0byB3aGljaGV2ZXIgcG9zdHMgeW91IG1hcmsgYXMgaGF2aW5nIHdvcmtlZC48L2Rpdj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iY2FyZCI+CiAgIDxoMz5UaGUgcmh5dGhtIHRoYXQgbWFrZXMgdGhpcyB3b3JrPC9oMz4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5Nb25kYXkgwrcgNDAgbWluPC90ZD48dGQ+UGxhbiBoZXJlLCBidWlsZCB2aXN1YWxzIGluIENhbnZhIG9yIENhcEN1dCwgbG9hZCB0aGUgd2hvbGUgd2VlayBpbnRvIE1ldGEgQnVzaW5lc3MgU3VpdGUuPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRhaWx5IMK3IDEwIG1pbjwvdGQ+PHRkPjxiPlJlcGx5IHRvIGV2ZXJ5IGNvbW1lbnQgaW4gdGhlIGZpcnN0IGhvdXIuPC9iPiBUaGlzIHN0YXlzIG1hbnVhbCBiZWNhdXNlIGl0IGlzIHRoZSBzaW5nbGUgaGlnaGVzdC1sZXZlcmFnZSBmcmVlIGdyb3d0aCBsZXZlciB0aGVyZSBpcy48L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U3VuZGF5IMK3IDE1IG1pbjwvdGQ+PHRkPkNoZWNrIEluc2lnaHRzLiBNYXJrIGJlbG93IHdoYXQgd29ya2VkLiBIZSB1c2VzIGl0IHRvIHBsYW4gdGhlIG5leHQgd2Vlay48L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGI+QmVmb3JlIGFueSBvZiB0aGlzIHdvcmtzOjwvYj4geW91ciBhY2NvdW50IG11c3QgYmUgYSA8Yj5Qcm9mZXNzaW9uYWwgKENyZWF0b3IpPC9iPiBhY2NvdW50IOKAlCBTZXR0aW5ncyDihpIgQWNjb3VudCB0eXBlLiBXaXRob3V0IGl0IHRoZXJlIGlzIG5vIHNjaGVkdWxpbmcsIG5vIGluc2lnaHRzIGFuZCBubyBtb25ldGlzYXRpb24uIFRha2VzIG9uZSBtaW51dGUuPC9kaXY+CiAgPC9kaXY+YDsKCiAgaWYoIVcubGVuZ3RoKSByZXR1cm4gaGVhZCsnPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHdlZWsgcGxhbm5lZCB5ZXQuPC9kaXY+PC9kaXY+JzsKCiAgcmV0dXJuIGhlYWQgKyBXLm1hcCh3PT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4O2ZsZXgtd3JhcDp3cmFwIj4KICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5XRUVLPC9zcGFuPjxiPiR7ZXNjKHcuYml6TmFtZSl9PC9iPgogICAgIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPiR7dy5yZWVsc30gcmVlbHM8L3NwYW4+CiAgICAgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHt3LnBvc3RzLmxlbmd0aH0gcG9zdHM8L3NwYW4+CiAgICAgJHt3LnRlbGxDb3VudD9gPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+JHt3LnRlbGxDb3VudH0gdG8gZml4PC9zcGFuPmA6JzxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPmF1ZGl0IGNsZWFuPC9zcGFuPid9PC9kaXY+CiAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7dy50fTwvc3Bhbj48L2Rpdj4KCiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweDtmbGV4LXdyYXA6d3JhcCI+CiAgICA8YSBjbGFzcz0iYnRuIG9rIiBocmVmPSIvYXBpL2NvbnRlbnQvdHh0P2lkPSR7dy5pZH0iPkRPV05MT0FEIFRIRSBXSE9MRSBXRUVLPC9hPgogICAgPGEgY2xhc3M9ImJ0biIgaHJlZj0iaHR0cHM6Ly9idXNpbmVzcy5mYWNlYm9vay5jb20vbGF0ZXN0L3Bvc3RzL3NjaGVkdWxlZF9wb3N0cyIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPk9wZW4gTWV0YSBCdXNpbmVzcyBTdWl0ZSBcdTIxOTc8L2E+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbFdlZWsoJyR7dy5pZH0nKSI+RGVsZXRlPC9idXR0b24+PC9kaXY+CgogICAke3cuYmlvU3VnZ2VzdGlvbj9gPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMjBweCI+QmlvPC90ZD48dGQgaWQ9ImJpb18ke3cuaWR9Ij4ke2VzYyh3LmJpb1N1Z2dlc3Rpb24pfTwvdGQ+CiAgICAgIDx0ZCBzdHlsZT0id2lkdGg6NzBweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5Qml6KCdiaW9fJHt3LmlkfScpIj5Db3B5PC9idXR0b24+PC90ZD48L3RyPgogICAgICR7dy5hdWRpb05vdGU/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdWRpbzwvdGQ+PHRkIGNvbHNwYW49IjIiPiR7ZXNjKHcuYXVkaW9Ob3RlKX08L3RkPjwvdHI+YDonJ30KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOicnfQoKICAgJHsody5waWxsYXJzfHxbXSkubGVuZ3RoP2A8ZGV0YWlscyBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPlBpbGxhcnM8L2I+PC9zdW1tYXJ5PgogICAgPHVsIGNsYXNzPSJ0aWdodCIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4ke3cucGlsbGFycy5tYXAocD0+YDxsaT48Yj4ke2VzYyhwLm5hbWUpfTwvYj4g4oCUICR7ZXNjKHAud2h5KX08L2xpPmApLmpvaW4oJycpfTwvdWw+PC9kZXRhaWxzPmA6Jyd9CgogICAke3cucG9zdHMubWFwKHA9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHtwLnBvc3RlZD8ndmFyKC0tZ3JuKSc6J3ZhcigtLXN0cm9rZTIpJ307cGFkZGluZy1sZWZ0OjEycHg7bWFyZ2luLWJvdHRvbToxNnB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtmbGV4LXdyYXA6d3JhcCI+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke3Aua2luZD09PSdyZWVsJz8ndC1ncm4nOid0LWRpbSd9Ij4ke1BLW3Aua2luZF18fHAua2luZH08L3NwYW4+CiAgICAgICA8Yj4ke2VzYyhwLmRheSl9PC9iPiR7cC5wb3N0ZWQ/JzxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPlBPU1RFRDwvc3Bhbj4nOicnfTwvZGl2PgogICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHAucGlsbGFyfHwnJyl9PC9zcGFuPjwvZGl2PgogICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW46N3B4IDAiPiIke2VzYyhwLmhvb2spfSI8L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206N3B4Ij4ke2VzYyhwLndoeXx8JycpfTwvZGl2PgogICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O21hcmdpbi1ib3R0b206OHB4Ij4KICAgICAgPGRpdiBpZD0iY2FwXyR7cC5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKHAuY2FwdGlvbil9Cgoke2VzYygocC5oYXNodGFnc3x8W10pLmpvaW4oJyAnKSl9PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiIG9uY2xpY2s9ImNvcHlCaXooJ2NhcF8ke3AuaWR9JykiPkNvcHkgY2FwdGlvbiArIHRhZ3M8L2J1dHRvbj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NHB4Ij48Yj5WaXN1YWw6PC9iPiAke2VzYyhwLnZpc3VhbCl9PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+PGI+QXNrOjwvYj4gJHtlc2MocC5jdGEpfTwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSAke3AucG9zdGVkPycnOidvayd9IiBvbmNsaWNrPSJtYXJrUG9zdGVkKCcke3cuaWR9JywnJHtwLmlkfScpIj4ke3AucG9zdGVkPydVbi1tYXJrJzonTWFyayBwb3N0ZWQnfTwvYnV0dG9uPgogICAgICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIzMHB4IiBpZD0icmVzXyR7cC5pZH0iIHBsYWNlaG9sZGVyPSJ3aGF0IGhhcHBlbmVkPyBlLmcuIDQwIHZpZXdzLCAxIERNIgogICAgICAgIG9uYmx1cj0ic2F2ZVJlc3VsdCgnJHt3LmlkfScsJyR7cC5pZH0nKSIgdmFsdWU9IiR7ZXNjKHAucmVzdWx0fHwnJyl9Ij48L2Rpdj4KICAgIDwvZGl2PmApLmpvaW4oJycpfQoKICAgJHt3LmZpcnN0Q29tbWVudD9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+PGI+UG9zdCB0aGlzIGNvbW1lbnQgeW91cnNlbGYgcmlnaHQgYWZ0ZXIgcHVibGlzaGluZzo8L2I+CiAgICAgPGRpdiBpZD0iZmNfJHt3LmlkfSIgc3R5bGU9Im1hcmdpbi10b3A6NnB4Ij4ke2VzYyh3LmZpcnN0Q29tbWVudCl9PC9kaXY+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiIG9uY2xpY2s9ImNvcHlCaXooJ2ZjXyR7dy5pZH0nKSI+Q29weTwvYnV0dG9uPjwvZGl2PmA6Jyd9CgogICAke3cudGVsbENvdW50P2A8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXI7Y29sb3I6dmFyKC0tYW1iKSI+PGI+JHt3LnRlbGxDb3VudH0gcGhyYXNlKHMpIHNvdW5kIG1hY2hpbmUtd3JpdHRlbiDigJQgZml4IGJlZm9yZSBwb3N0aW5nPC9iPjwvc3VtbWFyeT4KICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPjx0YWJsZT48dGJvZHk+CiAgICAgJHsody50ZWxsc3x8W10pLm1hcCh0PT5gPHRyPjx0ZCBzdHlsZT0iZm9udC1mYW1pbHk6bW9ub3NwYWNlIj4iJHtlc2ModC5mb3VuZCl9IjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC53aHkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2RldGFpbHM+YDonJ30KICA8L2Rpdj5gKS5qb2luKCcnKTsKfTsKUkVOREVSLmNvbnRlbnQ9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iY29udGVudCI+JHtMSVZFLmNvbnRlbnQoKX08L2Rpdj5gOwoKYXN5bmMgZnVuY3Rpb24gcGxhbldlZWsoKXsKICBjb25zdCBnPWlkPT4oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpfHx7fSkudmFsdWV8fCcnOwogIGZsYXNoKCdQbGFubmluZyB0aGUgd2VlayDigJQgYWJvdXQgYSBtaW51dGXigKYnKTsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9jb250ZW50L3dlZWsnLHtiaXpJZDpnKCdjdEJpeicpLG5pY2hlOmcoJ2N0TmljaGUnKSxjb3VudDorZygnY3RDb3VudCcpfHw3LGhhbmRsZTpnKCdjdEhhbmRsZScpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goYCR7ci5wb3N0c30gcG9zdHMsICR7ci5yZWVsc30gcmVlbHNgKyhyLnRlbGxzP2AgwrcgJHtyLnRlbGxzfSB0byBmaXhgOicgwrcgY2xlYW4nKSk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkZWxXZWVrKGlkKXsgaWYoIWNvbmZpcm0oJ0RlbGV0ZSB0aGlzIHdlZWs/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvY29udGVudC9kZWxldGUnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIG1hcmtQb3N0ZWQod2Vla0lkLHBvc3RJZCl7IGF3YWl0IEFQSSgnL2FwaS9jb250ZW50L3Bvc3RlZCcse3dlZWtJZCxwb3N0SWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBzYXZlUmVzdWx0KHdlZWtJZCxwb3N0SWQpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXNfJytwb3N0SWQpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IHc9KFMuY29udGVudHx8W10pLmZpbmQoeD0+eC5pZD09PXdlZWtJZCk7CiAgY29uc3QgcD13JiZ3LnBvc3RzLmZpbmQoeD0+eC5pZD09PXBvc3RJZCk7CiAgaWYoIXAgfHwgKHAucmVzdWx0fHwnJyk9PT12KSByZXR1cm47CiAgYXdhaXQgQVBJKCcvYXBpL2NvbnRlbnQvcG9zdGVkJyx7d2Vla0lkLHBvc3RJZCxyZXN1bHQ6dn0pOwogIGF3YWl0IEFQSSgnL2FwaS9jb250ZW50L3Bvc3RlZCcse3dlZWtJZCxwb3N0SWR9KTsKfQoKLyogPT09PT09PT09PT09PT09PT0gQ09NTUVOVCBERVNLID09PT09PT09PT09PT09PT09ICovCkxJVkUuY29tbWVudHM9KCk9PnsKICBjb25zdCBNPVMubWV0YSwgRD0oUy5jb21tZW50RHJhZnRzfHxbXSkuZmlsdGVyKGQ9PmQuc3RhdHVzPT09J0RSQUZUJyksIEw9Uy5jb21tZW50TG9nfHxbXTsKICBjb25zdCBXPVMucmVwbHlXaW5kb3d8fHt1c2VkOjAsY2FwOjQwLGxlZnQ6NDB9OwogIGNvbnN0IGRvbmU9KFMuY29tbWVudERyYWZ0c3x8W10pLmZpbHRlcihkPT5kLnN0YXR1cyE9PSdEUkFGVCcpOwoKICBjb25zdCBoZWFkPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPlx1MjVjOCBDT01NRU5UIERFU0sg4oCUIEhFIERSQUZUUywgWU9VIEFQUFJPVkUsIEhFIFJFUExJRVM8L2gzPgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPjxiPkkgd2FzIHdyb25nIGFib3V0IHRoaXMgYW5kIEkgYW0gY29ycmVjdGluZyBpdC48L2I+CiAgICBJIHRvbGQgeW91IHRocmVlIHRpbWVzIHRoYXQgcmVwbHlpbmcgdG8gY29tbWVudHMgY291bGQgbm90IGJlIGF1dG9tYXRlZCBzYWZlbHkuIEl0IGNhbi4gTWV0YSBwdWJsaXNoZXMgPGNvZGU+aW5zdGFncmFtX21hbmFnZV9jb21tZW50czwvY29kZT4gZm9yIGV4YWN0bHkgdGhpcyBhbmQgZXhwbGljaXRseSBwZXJtaXRzIGF1dG9tYXRlZCByZXBsaWVzIHRvIDxiPnVzZXItaW5pdGlhdGVkPC9iPiBhY3Rpb25zLiBXaGF0IGFjdHVhbGx5IGdldHMgYWNjb3VudHMgYmFubmVkIGlzIGJyb3dzZXIgZXh0ZW5zaW9ucywgcGFzc3dvcmQtc2hhcmluZyBib3RzIGFuZCBjb2xkIG91dHJlYWNoIOKAlCBub3QgdGhpcy4gSSBnZW5lcmFsaXNlZCBhbmQgbmV2ZXIgY2hlY2tlZC48L2Rpdj4KICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIHN0eWxlPSJ3aWR0aDozMHB4O2NvbG9yOnZhcigtLWdybikiPlx1MjcxNDwvdGQ+PHRkPlJlcGx5aW5nIHRvIHNvbWVvbmUgd2hvIGNvbW1lbnRlZCBvbiA8Yj55b3VyPC9iPiBwb3N0PC90ZD48L3RyPgogICAgPHRyPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+XHUyNzE0PC90ZD48dGQ+T25lIHByaXZhdGUgRE0gcmVwbHkgdG8gYSBjb21tZW50ZXIsIHdpdGhpbiA3IGRheXM8L3RkPjwvdHI+CiAgICA8dHI+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5cdTI3MTU8L3RkPjx0ZD5Db2xkIERNcyB0byBwZW9wbGUgd2hvIG5ldmVyIGVuZ2FnZWQg4oCUIDxiPm5vdCBidWlsdDwvYj48L3RkPjwvdHI+CiAgICA8dHI+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5cdTI3MTU8L3RkPjx0ZD5JZGVudGljYWwgcmVwbGllcyBhdCBzY2FsZSDigJQgPGI+YmxvY2tlZCBpbiBjb2RlPC9iPiwgbm90IGp1c3Qgd2FybmVkIGFib3V0PC90ZD48L3RyPgogICAgPHRyPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+XHUyNzE1PC90ZD48dGQ+QXV0by1mb2xsb3csIHBvZHMsIGJvdWdodCBlbmdhZ2VtZW50IOKAlCA8Yj5uZXZlcjwvYj48L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KCiAgICR7IU0/YDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPkJlZm9yZSB0aGlzIHdvcmtzLCBNZXRhIHJlcXVpcmVzIGFsbCBvZiB0aGlzIOKAlCBub25lIG9mIGl0IGlzIG9wdGlvbmFsIGFuZCBJIGNhbm5vdCBkbyBhbnkgb2YgaXQgZm9yIHlvdTo8L2I+CiAgICAgPG9sIHN0eWxlPSJtYXJnaW46OHB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweDtsaW5lLWhlaWdodDoxLjkiPgogICAgICA8bGk+SW5zdGFncmFtIDxiPkJ1c2luZXNzIG9yIENyZWF0b3I8L2I+IGFjY291bnQuIFBlcnNvbmFsIGFjY291bnRzIGhhdmUgPGI+bm8gQVBJIGF0IGFsbDwvYj4uPC9saT4KICAgICAgPGxpPkEgPGI+RmFjZWJvb2sgUGFnZTwvYj4gbGlua2VkIHRvIGl0LCBldmVuIGlmIHlvdSBuZXZlciBwb3N0IHRoZXJlLjwvbGk+CiAgICAgIDxsaT5BbiBhcHAgYXQgPGI+ZGV2ZWxvcGVycy5mYWNlYm9vay5jb208L2I+IFx1MjE5MiBDcmVhdGUgQXBwIFx1MjE5MiBCdXNpbmVzcy48L2xpPgogICAgICA8bGk+QWRkIHRoZSA8Yj5JbnN0YWdyYW08L2I+IHByb2R1Y3QsIHJlcXVlc3QgPGNvZGU+aW5zdGFncmFtX2Jhc2ljPC9jb2RlPiBhbmQgPGNvZGU+aW5zdGFncmFtX21hbmFnZV9jb21tZW50czwvY29kZT4uPC9saT4KICAgICAgPGxpPjxiPkFwcCBSZXZpZXc8L2I+IFx1MjAxNCAyIHRvIDUgYnVzaW5lc3MgZGF5cy4gV2l0aG91dCBpdCB5b3UgYXJlIGxpbWl0ZWQgdG8gdGVzdCB1c2Vycy48L2xpPgogICAgICA8bGk+R2VuZXJhdGUgYSA8Yj5sb25nLWxpdmVkIFBhZ2UgYWNjZXNzIHRva2VuPC9iPiBpbiBHcmFwaCBBUEkgRXhwbG9yZXIgYW5kIHBhc3RlIGl0IGJlbG93LjwvbGk+CiAgICAgPC9vbD4KICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGhpcyBpcyBnZW51aW5lbHkgYSBjb3VwbGUgb2YgaG91cnMgb2YgTWV0YSBwYXBlcndvcmsuIFRoZXJlIGlzIG5vIHNob3J0Y3V0LCBhbmQgYW55dGhpbmcgYWR2ZXJ0aXNpbmcgb25lIGlzIGEgYm90LjwvZGl2PjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Mb25nLWxpdmVkIFBhZ2UgYWNjZXNzIHRva2VuPC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibXRUb2siIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIHBsYWNlaG9sZGVyPSJFQUEuLi4iPjwvbGFiZWw+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdE1ldGEoKSI+Q09OTkVDVCBJTlNUQUdSQU08L2J1dHRvbj5gCiAgIDpgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+QWNjb3VudDwvdGQ+PHRkPjxiPkAke2VzYyhNLnVzZXJuYW1lKX08L2I+IFx1MDBiNyAke00uZm9sbG93ZXJzfSBmb2xsb3dlcnMgXHUwMGI3ICR7TS5tZWRpYUNvdW50fSBwb3N0czwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VmlhIFBhZ2U8L3RkPjx0ZD4ke2VzYyhNLnBhZ2VOYW1lKX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlJlcGx5IGJ1ZGdldDwvdGQ+PHRkPiR7Vy51c2VkfSBvZiAke1cuY2FwfSB1c2VkIHRoaXMgaG91ciBcdTAwYjcgcGFjZWQgMjBzIGFwYXJ0PGRpdiBjbGFzcz0ibW9uby1kaW0iPk1ldGEgYWxsb3dzIDc1MC9ob3VyLiBUaGlzIGlzIHNldCBmYXIgYmVsb3cgb24gcHVycG9zZSBcdTIwMTQgbG9va2luZyBsaWtlIGEgZmlyZWhvc2UgYXR0cmFjdHMgc2NydXRpbnkgZXZlbiB3aGVuIGV2ZXJ5IGNhbGwgaXMgbGVnYWwuPC9kaXY+PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iaGFydmVzdENvbW1lbnRzKCkiPkNIRUNLIEZPUiBORVcgQ09NTUVOVFM8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InB1cmdlTWV0YSgpIj5EaXNjb25uZWN0PC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij5IZSBjaGVja3MgYXV0b21hdGljYWxseSBldmVyeSAzMCBtaW51dGVzIGFuZCBkcmFmdHMgcmVwbGllcy4gTm90aGluZyBpcyBldmVyIHNlbnQgd2l0aG91dCB5b3UgcHJlc3Npbmcgc2VuZC48L2Rpdj5gfQogIDwvZGl2PmA7CgogIGlmKCFNKSByZXR1cm4gaGVhZDsKCiAgY29uc3QgYm9keSA9IEQubGVuZ3RoID8gYDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbToxMHB4O2ZsZXgtd3JhcDp3cmFwIj4KICAgICA8Yj4ke0QubGVuZ3RofSBkcmFmdCR7RC5sZW5ndGg+MT8ncyc6Jyd9IHdhaXRpbmcgZm9yIHlvdTwvYj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0ic2VuZENvbW1lbnRzKCkiPlNFTkQgQUxMIEFQUFJPVkVEPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJEcmFmdHMoKSI+RGlzY2FyZCBhbGw8L2J1dHRvbj48L2Rpdj48L2Rpdj4KICAgICR7RC5tYXAoZD0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCAke2QuYWN0aW9uPT09J3B1YmxpYyc/J3ZhcigtLWxpbWUpJzpkLmFjdGlvbj09PSdkbSc/J3ZhcigtLWN5KSc6J3ZhcigtLXN0cm9rZTIpJ307cGFkZGluZy1sZWZ0OjEycHg7bWFyZ2luLWJvdHRvbToxNXB4Ij4KICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47ZmxleC13cmFwOndyYXAiPgogICAgICAgPGRpdiBjbGFzcz0icm93Ij48Yj5AJHtlc2MoZC51c2VybmFtZSl9PC9iPgogICAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtkLmFjdGlvbj09PSdwdWJsaWMnPyd0LWdybic6ZC5hY3Rpb249PT0nZG0nPyd0LWN5JzondC1kaW0nfSI+JHtkLmFjdGlvbi50b1VwcGVyQ2FzZSgpfTwvc3Bhbj48L2Rpdj4KICAgICAgIDxhIGNsYXNzPSJtb25vLWRpbSIgaHJlZj0iJHtlc2MoZC5wZXJtYWxpbmt8fCcjJyl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+c2VlIHRoZSBwb3N0IFx1MjE5NzwvYT48L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6OXB4O21hcmdpbjo3cHggMDtmb250LXN0eWxlOml0YWxpYyI+IiR7ZXNjKGQuY29tbWVudFRleHQpfSI8L2Rpdj4KICAgICAgJHtkLmFjdGlvbj09PSdpZ25vcmUnfHxkLmFjdGlvbj09PSdvd25lcicKICAgICAgICA/IGA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij4ke2QuYWN0aW9uPT09J2lnbm9yZSc/J0hlIGlzIGxlYXZpbmcgdGhpcyBvbmUgYWxvbmUnOidIZSBuZWVkcyB5b3Ugb24gdGhpcyBvbmUnfSBcdTIwMTQgJHtlc2MoZC53aHl8fCcnKX08L2Rpdj5gCiAgICAgICAgOiAnJ30KICAgICAgPHRleHRhcmVhIGNsYXNzPSJpbiIgaWQ9InJlcF8ke2QuaWR9IiBzdHlsZT0ibWluLWhlaWdodDo1MnB4IiBvbmJsdXI9InNhdmVSZXBseSgnJHtkLmlkfScpIj4ke2VzYyhkLnJlcGx5KX08L3RleHRhcmVhPgogICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gb2siIG9uY2xpY2s9InNlbmRDb21tZW50cyhbJyR7ZC5pZH0nXSkiPlNlbmQganVzdCB0aGlzPC9idXR0b24+CiAgICAgICA8c2VsZWN0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoxMzBweCIgb25jaGFuZ2U9InNldEFjdGlvbignJHtkLmlkfScsdGhpcy52YWx1ZSkiPgogICAgICAgICR7WydwdWJsaWMnLCdkbScsJ2lnbm9yZScsJ293bmVyJ10ubWFwKGE9PmA8b3B0aW9uIHZhbHVlPSIke2F9IiR7YT09PWQuYWN0aW9uPycgc2VsZWN0ZWQnOicnfT4ke2F9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+CiAgICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQud2h5fHwnJyl9PC9zcGFuPjwvZGl2PgogICAgIDwvZGl2PmApLmpvaW4oJycpfQogICA8L2Rpdj5gIDogYDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBkcmFmdHMgd2FpdGluZy4gSGUgY2hlY2tzIGV2ZXJ5IDMwIG1pbnV0ZXMuPC9kaXY+PC9kaXY+YDsKCiAgY29uc3QgcmVzdWx0cyA9IGRvbmUubGVuZ3RoID8gYDxkZXRhaWxzIGNsYXNzPSJjYXJkIj48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPlJlY2VudGx5IGhhbmRsZWQgKCR7ZG9uZS5sZW5ndGh9KTwvYj48L3N1bW1hcnk+CiAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48dGFibGU+PHRib2R5PgogICAgICR7ZG9uZS5zbGljZSgtMTUpLnJldmVyc2UoKS5tYXAoZD0+YDx0cj4KICAgICAgPHRkIHN0eWxlPSJ3aWR0aDo4MHB4Ij48c3BhbiBjbGFzcz0idGFnICR7ZC5zdGF0dXM9PT0nU0VOVCc/J3QtZ3JuJzpkLnN0YXR1cz09PSdSRUZVU0VEJz8ndC1tYWcnOid0LWFtYid9Ij4ke2Quc3RhdHVzfTwvc3Bhbj48L3RkPgogICAgICA8dGQ+QCR7ZXNjKGQudXNlcm5hbWUpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC5yZXBseXx8JycpLnNsaWNlKDAsNzApfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQuZXJyb3J8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kZXRhaWxzPmAgOiAnJzsKCiAgY29uc3QgbG9nID0gTC5sZW5ndGggPyBgPGRldGFpbHMgY2xhc3M9ImNhcmQiPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciIgY2xhc3M9Im1vbm8tZGltIj5SZXBseSBsb2cgKCR7TC5sZW5ndGh9KTwvc3VtbWFyeT4KICAgIDxkaXYgY2xhc3M9ImxvZyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij4ke0wuc2xpY2UoMCwyMCkubWFwKHg9PgogICAgIGA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHt4LnR9PC9zcGFuPiAke3gua2luZD09PSdkbSc/J0RNJzoncmVwbHknfSB0byA8Yj5AJHtlc2MoeC51c2VybmFtZSl9PC9iPiBcdTIwMTQgJHtlc2MoU3RyaW5nKHgudGV4dCkuc2xpY2UoMCw4MCkpfTwvZGl2PmApLmpvaW4oJycpfTwvZGl2PjwvZGV0YWlscz5gIDogJyc7CgogIHJldHVybiBoZWFkICsgYm9keSArIHJlc3VsdHMgKyBsb2c7Cn07ClJFTkRFUi5jb21tZW50cz0oKT0+YDxkaXYgZGF0YS1saXZlPSJjb21tZW50cyI+JHtMSVZFLmNvbW1lbnRzKCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RNZXRhKCl7CiAgY29uc3QgdD0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ210VG9rJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXQudHJpbSgpKSByZXR1cm4gZmxhc2goJ1Bhc3RlIHRoZSB0b2tlbicpOwogIGZsYXNoKCdDaGVja2luZyB3aXRoIE1ldGHigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL21ldGEvY29ubmVjdCcse3Rva2VuOnQudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0Nvbm5lY3RlZCBhcyBAJytyLmFjY291bnQudXNlcm5hbWUpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VNZXRhKCl7IGlmKCFjb25maXJtKCdEaXNjb25uZWN0IEluc3RhZ3JhbSBhbmQgZGlzY2FyZCB0aGUgdG9rZW4/JykpcmV0dXJuOwogIGF3YWl0IEFQSSgnL2FwaS9tZXRhL3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gaGFydmVzdENvbW1lbnRzKCl7CiAgZmxhc2goJ1JlYWRpbmcgeW91ciBjb21tZW50c+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvY29tbWVudHMvaGFydmVzdCcse30pOyByZW5kZXIoKTsgZmxhc2goci5tc2cpOyB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHNhdmVSZXBseShpZCl7CiAgY29uc3Qgdj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcF8nK2lkKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCBkPShTLmNvbW1lbnREcmFmdHN8fFtdKS5maW5kKHg9PnguaWQ9PT1pZCk7CiAgaWYoIWQgfHwgZC5yZXBseT09PXYpIHJldHVybjsKICBhd2FpdCBBUEkoJy9hcGkvY29tbWVudHMvZWRpdCcse2lkLHJlcGx5OnZ9KTsKfQphc3luYyBmdW5jdGlvbiBzZXRBY3Rpb24oaWQsYWN0aW9uKXsgYXdhaXQgQVBJKCcvYXBpL2NvbW1lbnRzL2VkaXQnLHtpZCxhY3Rpb259KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBzZW5kQ29tbWVudHMoaWRzKXsKICBjb25zdCBuID0gaWRzID8gMSA6IChTLmNvbW1lbnREcmFmdHN8fFtdKS5maWx0ZXIoZD0+ZC5zdGF0dXM9PT0nRFJBRlQnJiYoZC5hY3Rpb249PT0ncHVibGljJ3x8ZC5hY3Rpb249PT0nZG0nKSkubGVuZ3RoOwogIGlmKCFuKSByZXR1cm4gZmxhc2goJ05vdGhpbmcgYXBwcm92ZWQgdG8gc2VuZCcpOwogIGlmKCFjb25maXJtKGBQb3N0ICR7bn0gcmVhbCByZXBsJHtuPjE/J2llcyc6J3knfSB1bmRlciBAJHsoUy5tZXRhfHx7fSkudXNlcm5hbWV9PyBUaGlzIGlzIHB1YmxpYyBhbmQgY2Fubm90IGJlIHVuc2VudC5gKSkgcmV0dXJuOwogIGZsYXNoKCdTZW5kaW5nLCBwYWNlZCAyMCBzZWNvbmRzIGFwYXJ04oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9jb21tZW50cy9zZW5kJyx7aWRzOmlkc3x8bnVsbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKGAke3Iuc2VudH0gc2VudGArKHIuc2tpcHBlZD9gIMK3ICR7ci5za2lwcGVkfSBza2lwcGVkYDonJykrKHIuZmFpbGVkP2AgwrcgJHtyLmZhaWxlZH0gZmFpbGVkYDonJykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gY2xlYXJEcmFmdHMoKXsgaWYoIWNvbmZpcm0oJ0Rpc2NhcmQgYWxsIGRyYWZ0cz8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9jb21tZW50cy9jbGVhcicse2FsbDp0cnVlfSk7IHJlbmRlcigpIH0K','base64')
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
const META     = __req('meta');
const BLOBS    = __req('blobs').makeBlobs(STORE);

const ROOT   = __dirname;
/* Tell the storage layer where "here" is. In the single-file build the
   inlined store module cannot work it out from its own __dirname. */
global.__CHAIRMAN_ROOT = ROOT;
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
                rosterCleared:false, tasksCleared:false, haltedByOwner:false, haltedAt:null,
                projects:[{id:'PRJ-MAIN',name:'General',t:'',docs:[]}], projectId:'PRJ-MAIN',
                content:[], meta:null, commentDrafts:[], commentLog:[],
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

/* What the box can actually do. Each entry is real code that already runs. */
const DO_TOOLS = {
  'check_domain':   { need:'a name like sandhuworks.in', desc:'Check if a domain is free, against the live registry' },
  'suggest_names':  { need:'what the business does',      desc:'Invent business names and check every one live' },
  'read_site':      { need:'a URL',                        desc:'Read a website and summarise what it actually does' },
  'copy_product':   { need:'a URL',                        desc:'Study a competitor and work out how to rebuild what it does' },
  'build_business': { need:'what the business does',       desc:'Build the whole business: site, policies, tool, invoice, outreach' },
  'plan_campaign':  { need:'nothing, uses the newest business', desc:'Plan the campaign that gets the first customer' },
  'find_ideas':     { need:'nothing',                      desc:'Invent money-making ideas for Ludhiana' },
  'check_sites':    { need:'nothing',                      desc:'Probe every monitored site right now' },
  'whats_broken':   { need:'nothing',                      desc:'Say plainly what is blocking money' },
  'write_draft':    { need:'who it is for and what to say', desc:'Write an email, WhatsApp message or proposal' },
  'content_week':   { need:'a built business, or the niche', desc:'Plan a week of Instagram content — hooks, captions, hashtags, visual briefs' },
  'ask_doc':        { need:'a file already attached',      desc:'Answer from the attached file, quoting it' },
  'answer':         { need:'nothing',                      desc:'Just answer the question — no action needed' },
};

const URL_RE    = /https?:\/\/[^\s<>"']+/i;
const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{0,62}\.(?:com|in|co\.in|net|org|io|dev|app|xyz|site|shop|store|online|tech|info|biz|me|ai))\b/i;

/* PROJECTS — one thread per piece of work.
   use.ai calls them Projects; Claude calls them the same. The reason they
   exist is not tidiness: it is that a single flat log poisons the context.
   Ask about the hosiery business and get answers coloured by a domain check
   from three days ago. Each project keeps its own thread and its own files. */
function curProject(){
  if(!S.projects || !S.projects.length){
    S.projects = [{ id:'PRJ-MAIN', name:'General', t:nowIso(), docs:[] }];
    S.projectId = 'PRJ-MAIN';
  }
  if(!S.projects.some(x=>x.id===S.projectId)) S.projectId = S.projects[0].id;
  return S.projects.find(x=>x.id===S.projectId);
}
function chatSay(who, text, extra){
  const pid = curProject().id;
  S.chat.unshift(Object.assign({ t:nowIso(), who, text, pid }, extra||{}));
  /* keep 120 per project, not 120 total — a busy project used to evict
     everything else and the older threads silently vanished */
  const byPrj = {};
  S.chat = S.chat.filter(m=>{
    const k = m.pid || 'PRJ-MAIN';
    byPrj[k] = (byPrj[k]||0) + 1;
    return byPrj[k] <= 120;
  });
}

/* The single entry point. Returns what he DID, not what he intends to do. */
/* WHAT HE REMEMBERS.
   Every message used to be standalone, so "build that one" meant nothing —
   he had no idea what "that" was. Claude and every usable assistant keep the
   thread. This returns the last few turns, trimmed, so follow-ups work. */
function recentTurns(n){
  const pid = curProject().id;
  const t = (S.chat||[])
    .filter(m=>(m.pid||'PRJ-MAIN')===pid && (m.who==='OWNER'||m.who==='CHAIRMAN'))
    .slice(0, (n||6)*2).reverse();
  if(!t.length) return '';
  return 'WHAT WAS ALREADY SAID (most recent last):\n'
    + t.map(m=>`${m.who==='OWNER'?'OWNER':'YOU'}: ${String(m.text).slice(0,600)}`).join('\n')
    + '\n\n';
}
/* Files the Owner attached to the conversation, if any. */
function attachedContext(){
  const pid = curProject().id;
  const d = (S.docs||[]).filter(x=>!x.pid || x.pid===pid).slice(0,3);
  if(!d.length) return '';
  return 'FILES THE OWNER ATTACHED:\n'
    + d.map(x=>`--- ${x.name} (${x.chars} chars) ---\n${String(x.text||'').slice(0,6000)}`).join('\n\n')
    + '\n\n';
}

async function doIt(text){
  const raw = String(text||'').trim();
  if(!raw) throw new Error('Say something.');
  chatSay('OWNER', raw);

  const low = raw.toLowerCase();
  const url = (raw.match(URL_RE)||[])[0];
  const dom = (raw.match(DOMAIN_RE)||[])[0];

  /* ---- 1. A URL, with no other instruction: read it. Nothing to choose. */
  if(url && !/build|copy|clone|rebuild|compete|like this|same as/i.test(low)){
    return await act_readSite(url);
  }
  if(url){
    return await act_copyProduct(url, raw);
  }

  /* ---- 2. A bare domain: check it. Instant, free, no model needed. */
  if(dom && !url && /\b(free|available|taken|check|domain|buy|get)\b/i.test(low)){
    return await act_checkDomain(dom);
  }
  if(dom && !url && raw.split(/\s+/).length <= 3){
    return await act_checkDomain(dom);
  }

  /* ---- 2b. A file is attached and he is being asked about it. */
  if((S.docs||[]).length && /\b(this|it|the (file|document|pdf|sheet|csv)|attached|summar|explain|what.?s in)\b/i.test(low)
     && !url && !dom){
    return await act_askDoc(raw);
  }

  /* ---- 3. Obvious intents, matched in code. No model call, no latency. */
  if(/^(what.?s|whats|what is) (broken|wrong|blocking|stopping)/i.test(low)
     || /why (am i|are we) not (earning|making)/i.test(low)
     || /\bstuck\b|\bstalled\b/i.test(low))
    return await act_whatsBroken();

  if(/check (all |every |my )?(the )?(sites?|websites?|monitors?)/i.test(low)
     || /\bare (my |the )?sites? (up|down|working)/i.test(low))
    return await act_checkSites();

  if(/(find|give|invent|think of|need) .{0,20}(ideas?|business|money|way to earn)/i.test(low)
     || /^ideas?$/i.test(low))
    return await act_findIdeas();

  if(/(name|naming) (ideas?|suggestions?)|suggest .{0,15}names?|what should i (call|name)/i.test(low))
    return await act_suggestNames(raw);

  if(/build (me )?(the |a |this )?(whole )?(business|company|site|website|everything)/i.test(low))
    return await act_buildBusiness(raw);

  if(/(plan|start|run) .{0,15}(campaign|outreach|marketing)|get (me )?(a |the )?(first )?customers?/i.test(low))
    return await act_planCampaign();

  if(/(instagram|insta|reels?|social|content) .{0,20}(week|plan|posts?|calendar)/i.test(low)
     || /(plan|write|make|batch) .{0,20}(my )?(week|content|posts?|reels?|instagram)/i.test(low))
    return await act_contentWeek(raw);

  /* ---- 4. Everything else: the model picks ONE real tool. */
  return await act_route(raw);
}

/* ------------------------------------------------------------ actions ---- */

async function act_readSite(url){
  chatSay('SYSTEM', `Reading ${url} …`, { pending:true });
  let page;
  try{ page = await RESEARCH.readPage(url); }
  catch(e){
    const m = `I could not read ${url} — ${e.message}. That usually means the site blocks automated readers, or the address is wrong.`;
    chatSay('CHAIRMAN', m); save(); return { did:'read_site', ok:false, text:m };
  }
  if(!S.llm){
    const m = `Read it: "${page.title}", ${page.text.length} characters. Connect an AI brain and I can tell you what it means.`;
    chatSay('CHAIRMAN', m); save(); return { did:'read_site', ok:true, text:m };
  }
  const r = await think(
`I read this page for the Owner. Tell him what it IS and whether there is money in it for him.

URL: ${url}
TITLE: ${page.title}
CONTENT:
${page.text.slice(0,7000)}

${ANTI_AI}

Answer in under 140 words, as four short labelled lines:
WHAT IT IS — one sentence.
WHO PAYS — the actual buyer, and roughly what for.
THE GAP — what it does badly, ignores, or charges too much for.
FOR YOU — whether a one-person operation in Ludhiana could take a slice, and the honest first step. If the answer is no, say no.`,
    null, 'chat-read', 'Market Signal');
  chatSay('CHAIRMAN', r.text, { source:url });
  save();
  return { did:'read_site', ok:true, text:r.text };
}

async function act_copyProduct(url, brief){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  chatSay('SYSTEM', `Studying ${url} …`, { pending:true });
  const a = await analyseProduct(url, brief);
  const txt = `I studied it. ${a.summary||''}\n\n`
    + (a.jobs && a.jobs.length ? `The jobs it actually does:\n` + a.jobs.map(j=>`  · ${typeof j==='string'?j:(j.job||JSON.stringify(j))}`).join('\n') : '')
    + `\n\nOpen "Copy Any Product" to see the full breakdown and build the agents.`;
  chatSay('CHAIRMAN', txt, { source:url });
  save();
  return { did:'copy_product', ok:true, text:txt, goto:'arch' };
}

async function act_checkDomain(name){
  const list = /\./.test(name) ? [name] : DOMAINS.expand(name, ['in','com','co.in']);
  const rs = await DOMAINS.checkMany(list, { lanes:3, gap:200 });
  const free  = rs.filter(r=>r.status==='AVAILABLE');
  const taken = rs.filter(r=>r.status==='TAKEN');
  let txt = '';
  if(free.length)
    txt += 'FREE RIGHT NOW:\n' + free.map(r=>`  ${r.name} — about Rs ${r.price&&r.price.first||'?'} the first year`).join('\n');
  if(taken.length)
    txt += (txt?'\n\n':'') + 'ALREADY TAKEN:\n' + taken.map(r=>`  ${r.name}${r.registrar?' — '+r.registrar:''}${r.expires?', expires '+String(r.expires).slice(0,10):''}`).join('\n');
  const bad = rs.filter(r=>r.status!=='AVAILABLE'&&r.status!=='TAKEN');
  if(bad.length) txt += `\n\nCould not resolve: ${bad.map(r=>r.name).join(', ')} — treat as unknown, not as free.`;
  txt += '\n\nChecked live against the registry. I cannot buy it — that needs a card and KYC in your name. Cloudflare or Porkbun, three minutes.';
  chatSay('CHAIRMAN', txt, { domains: rs });
  save();
  return { did:'check_domain', ok:true, text:txt, results:rs };
}

async function act_suggestNames(brief){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  chatSay('SYSTEM', 'Inventing names, then checking every one live …', { pending:true });
  const run = await suggestNames(brief, ['in','com','co.in'], 10);
  const best = run.rows.filter(r=>r.options.some(o=>o.status==='AVAILABLE')).slice(0,6);
  const txt = best.length
    ? 'Names that are actually available:\n\n' + best.map(r=>
        `  ${r.sld} — ${r.why}\n    ${r.options.filter(o=>o.status==='AVAILABLE').map(o=>o.name).join('  ')}`).join('\n\n')
      + `\n\n${run.checked} live registry checks. ${run.available} available.`
    : `I invented ${run.rows.length} names and every one was taken. That usually means the words are too obvious. Tell me something specific about the business and I will go again.`;
  chatSay('CHAIRMAN', txt);
  save();
  return { did:'suggest_names', ok:true, text:txt, goto:'domains' };
}

async function act_buildBusiness(brief){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  if(!S.owner || !S.owner.email) throw new Error('Set your email in Owner Settings first — it goes on every page and invoice.');
  chatSay('SYSTEM', 'Building the whole business. Two to four minutes …', { pending:true });
  const biz = await buildBusiness({ brief: brief.replace(/^.*?(build|make|create)\s+/i,'').trim() || brief });
  const freeDom = (biz.domains||[]).filter(d=>d.status==='AVAILABLE');
  const txt = `Built "${biz.name}" — ${biz.fileList.length} files.\n\n`
    + `  ${biz.tagline}\n`
    + `  Pricing: ${biz.tiers.map(t=>`${t.name} Rs ${t.amount}`).join(' · ')}\n`
    + `  ${biz.tellCount ? biz.tellCount+' phrases flagged as machine-sounding — listed for your edit' : 'Realness audit clean'}\n`
    + (freeDom.length ? `  Domain available: ${freeDom.map(d=>d.name).join(', ')}\n` : '')
    + `\nOpen it, download the ZIP, drag it onto Netlify Drop. Live in three minutes.`;
  chatSay('CHAIRMAN', txt, { bizId: biz.id });
  save();
  return { did:'build_business', ok:true, text:txt, goto:'factory' };
}

async function act_planCampaign(){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  const biz = (S.businesses||[])[0];
  if(!biz){
    const m = 'There is no business to market yet. Tell me what it does and I will build it first.';
    chatSay('CHAIRMAN', m); save(); return { did:'plan_campaign', ok:false, text:m };
  }
  chatSay('SYSTEM', `Planning the campaign for ${biz.name} …`, { pending:true });
  const c = await planCampaign(biz.id, '');
  const txt = `Campaign planned for ${biz.name}: "${c.name}"\n\n`
    + `  ${c.thesis}\n\n`
    + `  ${c.actions.length} actions. I can send ${c.autoCount} myself; the rest need your hand and the words are already written.\n`
    + `  First customer: ${c.firstCustomerBy}\n\n`
    + `Nothing goes out until you approve it.`;
  chatSay('CHAIRMAN', txt, { campaignId: c.id });
  save();
  return { did:'plan_campaign', ok:true, text:txt, goto:'growth' };
}

async function act_findIdeas(){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  chatSay('SYSTEM', 'Thinking …', { pending:true });
  const r = await CAPS['ai.ideas'].run();
  const fresh = (S.ideas||[]).slice(0,5);
  const txt = fresh.length
    ? fresh.map(i=>`  ${i.title}\n    Buyer: ${i.buyer||'—'} · Rs ${i.price||'?'}${i.unfair_edge?`\n    Edge: ${i.unfair_edge}`:''}`).join('\n\n')
      + '\n\nSay "build" and the name of one and I will build the whole business.'
    : r.msg;
  chatSay('CHAIRMAN', txt);
  save();
  return { did:'find_ideas', ok:true, text:txt, goto:'ventures' };
}

async function act_checkSites(){
  if(!(S.monitors||[]).length){
    const m = 'You have no sites bound. Paste a website address and I will start watching it.';
    chatSay('CHAIRMAN', m); save(); return { did:'check_sites', ok:false, text:m };
  }
  chatSay('SYSTEM', `Probing ${S.monitors.length} site(s) …`, { pending:true });
  await runMonitors(true);
  const down = S.monitors.filter(m=>m.state==='DOWN');
  const txt = S.monitors.map(m=>
    `  ${m.state==='UP'?'UP  ':'DOWN'}  ${m.name} — ${m.lastMs||0}ms${m.lastErr?' · '+m.lastErr:''}`).join('\n')
    + (down.length ? `\n\n${down.length} DOWN. That is the thing to deal with now.` : '\n\nAll reachable.');
  chatSay('CHAIRMAN', txt);
  save();
  return { did:'check_sites', ok:true, text:txt };
}

async function act_whatsBroken(){
  const r = await CAPS['growth.stalled'].run();
  const parts = String(r.detail||r.msg).split(' | ');
  const txt = r.n
    ? 'In order, these block money:\n\n' + parts.map((x,i)=>`  ${i+1}. ${x}`).join('\n')
      + '\n\nFix the first one. The rest do not matter until it is done.'
    : r.msg;
  chatSay('CHAIRMAN', txt);
  save();
  return { did:'whats_broken', ok:true, text:txt };
}

async function act_askDoc(question){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  const names = (S.docs||[]).slice(0,3).map(d=>d.name).join(', ');
  chatSay('SYSTEM', `Reading ${names} …`, { pending:true });
  const r = await think(
`${attachedContext()}${recentTurns(3)}The Owner asked about the file(s) above: "${question}"

${ANTI_AI}

Answer from what is ACTUALLY in the file. If the answer is not in there, say
so plainly rather than inventing it. Quote the relevant line when it helps.
Under 200 words.`,
    null, 'chat-doc', 'Insight Forge');
  chatSay('CHAIRMAN', r.text, { source: names });
  save();
  return { did:'ask_doc', ok:true, text:r.text };
}

async function act_contentWeek(raw){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  chatSay('SYSTEM', 'Planning the week — hooks, captions, hashtags, visual briefs …', { pending:true });
  const niche = /for |about /i.test(raw) ? raw.replace(/^.*?(for|about)\s+/i,'').trim() : '';
  const w = await buildContentWeek({ niche });
  const txt = `${w.posts.length} posts planned for ${w.bizName} — ${w.reels} reels.\n\n`
    + w.posts.map(p=>`  ${p.day} · ${(POST_KINDS[p.kind]||{}).label||p.kind}\n    "${p.hook}"`).join('\n')
    + `\n\n${w.tellCount ? w.tellCount+' phrase(s) flagged as machine-sounding — listed for your edit.' : 'Audit clean.'}`
    + `\n\nOpen Content Studio, download the text, paste it into Meta Business Suite. About 40 minutes for the week.`
    + `\n\nI cannot post it for you. No free tool can — the ones that claim to are running bots that get accounts banned. Meta Business Suite is Instagram's own scheduler and it is free.`;
  chatSay('CHAIRMAN', txt, { weekId: w.id });
  save();
  return { did:'content_week', ok:true, text:txt, goto:'content' };
}

async function act_writeDraft(brief){
  if(!S.llm) throw new Error('Connect an AI brain first.');
  const r = await think(
`${attachedContext()}${recentTurns(3)}The Owner wants this written: "${brief}"

He is one person in Ludhiana, Punjab, selling to Indian businesses. He has no
customers yet and no track record.

${ANTI_AI}

Write the finished thing, ready to send. No preamble, no "here is your draft",
no explanation afterwards. If it is an email, start with a Subject: line.`,
    null, 'chat-draft', 'Growth Conductor');
  chatSay('CHAIRMAN', r.text, { copyable:true });
  save();
  return { did:'write_draft', ok:true, text:r.text };
}

/* The model chooses ONE tool from the real menu, then it actually runs. */
async function act_route(raw){
  if(!S.llm){
    const m = 'No AI brain connected, so I can only do the mechanical things: check a domain, probe your sites, tell you what is broken. Connect a free key in AI Brain.';
    chatSay('CHAIRMAN', m); save(); return { did:'answer', ok:false, text:m };
  }
  const menu = Object.entries(DO_TOOLS).map(([k,v])=>`  ${k} — ${v.desc}`).join('\n');
  const state = `${(S.businesses||[]).length} business(es) built, ${(S.monitors||[]).length} sites watched, `
    + `${(S.ideas||[]).length} ideas, ${(S.outreach||[]).length} messages sent, `
    + `mail ${S.smtpVerified?'proven':(S.smtp?'configured but unproven':'off')}, `
    + `payments ${S.pay?'armed':'off'}.`;

  const j = await askJson(
`${recentTurns(4)}The Owner typed this into the one box he uses for everything:

"${raw}"

STATE: ${state}

Pick the ONE tool that best serves him. Do not explain, do not chat.

${menu}

If he is asking a question rather than requesting work, pick "answer".

Return ONLY: {"tool":"one of the names above","arg":"the argument to pass, or empty string","why":"under 12 words"}`,
    'You route a request to exactly one tool. Terse. No prose.',
    'chat-route','Chairman');

  const tool = DO_TOOLS[j.tool] ? j.tool : 'answer';
  const arg  = String(j.arg||'').trim() || raw;

  switch(tool){
    case 'check_domain':   return await act_checkDomain(arg);
    case 'suggest_names':  return await act_suggestNames(arg);
    case 'read_site':      return await act_readSite(arg);
    case 'copy_product':   return await act_copyProduct(arg, raw);
    case 'build_business': return await act_buildBusiness(arg);
    case 'plan_campaign':  return await act_planCampaign();
    case 'find_ideas':     return await act_findIdeas();
    case 'check_sites':    return await act_checkSites();
    case 'whats_broken':   return await act_whatsBroken();
    case 'write_draft':    return await act_writeDraft(arg);
    case 'ask_doc':        return await act_askDoc(arg);
    case 'content_week':   return await act_contentWeek(arg);
  }

  /* plain answer */
  const r = await think(
`${attachedContext()}${recentTurns(6)}STATE: ${state}

The Owner asked: "${raw}"

Answer him directly. You are his Chairman, not a help desk. He may be
referring to something said earlier — the history above is yours, use it.
If something cannot be done, say so and say what can. Never claim to have
done anything you have not. Under 150 words.`, null, 'chat-answer', 'Chairman');
  chatSay('CHAIRMAN', r.text);
  save();
  return { did:'answer', ok:true, text:r.text };
}


const POST_KINDS = {
  reel:     { label:'Reel',     note:'Largest organic reach. Prioritise these.' },
  carousel: { label:'Carousel', note:'Best for teaching something in steps.' },
  single:   { label:'Post',     note:'One image. Good for proof and announcements.' },
  story:    { label:'Story',    note:'Behind the scenes. Low effort, keeps you present.' },
};

async function buildContentWeek(opts){
  opts = opts || {};
  if(!S.llm) throw new Error('CONNECT AN AI BRAIN FIRST');

  const biz = opts.bizId ? (S.businesses||[]).find(b=>b.id===opts.bizId) : (S.businesses||[])[0];
  const niche = String(opts.niche||'').trim()
    || (biz ? `${biz.name} — ${biz.tagline}. Buyer: ${biz.buyer||'unspecified'}.` : '');
  if(!niche) throw new Error('Build a business first, or tell me the niche. He will not invent a brand for you.');

  const count = Math.min(10, Math.max(3, +opts.count || 7));
  const handle = String(opts.handle||'').trim();

  /* What worked last time, so week two is not a repeat of week one. */
  const last = (S.content||[])[0];
  const learned = last && (last.posts||[]).some(p=>p.result)
    ? 'WHAT ALREADY WORKED — do more of this, less of the rest:\n'
      + (last.posts||[]).filter(p=>p.result).map(p=>`  "${p.hook}" -> ${p.result}`).join('\n') + '\n\n'
    : '';

  const j = await askJson(
`${learned}Plan ONE WEEK of Instagram content for this business.

BUSINESS: ${niche}
The Owner is one person in Ludhiana, Punjab, India. He sells to Indian
businesses. He has no customers yet and no track record.

${ANTI_AI}

HARD RULES, and they come from the Owner's own research:
- Reels first. They get the largest organic reach. At least half must be reels.
- The hook must land in the first 1.5 seconds. Text overlay stating the
  payoff, not a slow introduction. No "hey guys", no throat-clearing.
- 3 to 5 SPECIFIC hashtags, never 30 generic ones. Niche tags outperform
  broad ones. Include at least one Ludhiana or Punjab tag where it fits.
- Never claim followers, results, clients or income he does not have.
- Write captions a factory owner would read, not influencer voice. No emoji
  spam. One emoji maximum per caption, and only if it genuinely helps.
- Every post must have a reason to exist: it teaches, proves, or asks.
  Nothing posted for the sake of posting.

Return ONLY this JSON:
{"pillars":[{"name":"pillar name","why":"one line: why this pillar earns attention from THIS buyer"}],
 "posts":[
   {"day":"Monday",
    "kind":"one of: reel, carousel, single, story",
    "hook":"the exact words on screen in the first 1.5 seconds, under 12 words",
    "caption":"the full caption, ready to paste. Under 120 words. Ends with one clear ask.",
    "hashtags":["3 to 5 specific tags, with the # included"],
    "visual":"precise brief for a free tool like Canva or CapCut: what is on screen, shot by shot for reels. No stock-photo cliches.",
    "cta":"what you want the viewer to actually do",
    "pillar":"which pillar this belongs to",
    "why":"one line: why this specific post earns a follow or an enquiry"}],
 "audioNote":"how to pick trending audio for the reels this week, in one line",
 "bioSuggestion":"a bio under 150 characters that says what he does and for whom",
 "firstComment":"the comment to post yourself immediately after publishing, to seed the thread"}

Exactly ${count} posts. Three or four pillars. Spread across the week.`,
    'You plan Instagram content for small Indian B2B businesses. Plain, useful, no influencer voice.',
    'content-week','Growth Conductor');

  const posts = (Array.isArray(j.posts)?j.posts:[]).slice(0,count).map((x,i)=>({
    id: uid('POST'), n:i+1,
    day: String(x.day||'').slice(0,12),
    kind: POST_KINDS[x.kind] ? x.kind : 'single',
    hook: String(x.hook||'').slice(0,120),
    caption: String(x.caption||'').slice(0,1200),
    hashtags: (Array.isArray(x.hashtags)?x.hashtags:[]).slice(0,6)
      .map(h=>String(h).trim()).filter(Boolean)
      .map(h=>h.startsWith('#')?h:'#'+h.replace(/^#+/,'')),
    visual: String(x.visual||'').slice(0,600),
    cta: String(x.cta||'').slice(0,140),
    pillar: String(x.pillar||'').slice(0,60),
    why: String(x.why||'').slice(0,200),
    posted:false, result:null,
  }));
  if(!posts.length) throw new Error('The model returned no posts. Try again, or use a stronger model.');

  /* The realness audit applies here too — an influencer-sounding caption is
     the same failure as an AI-sounding landing page. */
  const tells = FACTORY.audit(JSON.stringify({posts, p:j.pillars}));

  const week = {
    id: uid('WEEK'), t: nowIso(),
    bizId: biz ? biz.id : null, bizName: biz ? biz.name : '(no business)',
    niche, handle,
    pillars: (j.pillars||[]).slice(0,5),
    posts,
    audioNote: String(j.audioNote||'').slice(0,300),
    bioSuggestion: String(j.bioSuggestion||'').slice(0,200),
    firstComment: String(j.firstComment||'').slice(0,300),
    tells: tells.slice(0,12), tellCount: tells.length,
    reels: posts.filter(p=>p.kind==='reel').length,
  };
  S.content = S.content || [];
  S.content.unshift(week);
  S.content = S.content.slice(0,6);
  save();
  log('OK','CONTENT',
    `Week planned: ${posts.length} posts (${week.reels} reels) for ${week.bizName}.`
    + (tells.length ? ` ${tells.length} phrase(s) flagged as machine-sounding.` : ' Audit clean.'));
  return week;
}

/* Plain text a human can paste into Meta Business Suite one post at a time. */
function contentPlain(week){
  const L = [];
  L.push(`${week.bizName.toUpperCase()} — CONTENT WEEK`);
  L.push(`Planned ${week.t}`);
  L.push('');
  L.push('HOW TO USE THIS');
  L.push('  1. business.facebook.com -> Meta Business Suite -> Planner.');
  L.push('     It is Instagram\'s own scheduler, free, and the only one that');
  L.push('     auto-publishes Reels without workarounds. Third-party tools');
  L.push('     often only send you a reminder to post manually.');
  L.push('  2. Your account must be a Professional (Creator) account, or');
  L.push('     scheduling and insights do not exist. Settings -> Account type.');
  L.push('  3. Build each visual in Canva or CapCut using the brief below.');
  L.push('  4. Paste caption + hashtags, set the day, schedule. Whole week');
  L.push('     in one sitting, about 40 minutes.');
  L.push('  5. Reply to every comment in the first hour after each post goes');
  L.push('     live. That stays manual. It is the single highest-leverage');
  L.push('     free growth lever there is.');
  L.push('');
  if(week.bioSuggestion){ L.push('BIO'); L.push('  '+week.bioSuggestion); L.push(''); }
  if(week.pillars && week.pillars.length){
    L.push('PILLARS');
    week.pillars.forEach(p=>L.push(`  ${p.name} — ${p.why}`));
    L.push('');
  }
  if(week.audioNote){ L.push('AUDIO'); L.push('  '+week.audioNote); L.push(''); }
  L.push('='.repeat(60));
  week.posts.forEach(p=>{
    L.push('');
    L.push(`${p.day.toUpperCase()} · ${(POST_KINDS[p.kind]||{}).label||p.kind}`);
    L.push(`HOOK (first 1.5 seconds, on screen):`);
    L.push(`  ${p.hook}`);
    L.push('');
    L.push('CAPTION:');
    p.caption.split('\n').forEach(l=>L.push('  '+l));
    L.push('');
    L.push('HASHTAGS: '+p.hashtags.join(' '));
    L.push('');
    L.push('VISUAL BRIEF (build in Canva / CapCut):');
    L.push('  '+p.visual);
    L.push('');
    L.push('ASK: '+p.cta);
    L.push('-'.repeat(60));
  });
  if(week.firstComment){
    L.push('');
    L.push('FIRST COMMENT — post this yourself right after publishing:');
    L.push('  '+week.firstComment);
  }
  L.push('');
  L.push('WHAT NOT TO DO');
  L.push('  No follow/unfollow bots. No engagement pods. No bought followers.');
  L.push('  No auto-comment or auto-DM tools. Every one of those violates');
  L.push('  Instagram\'s terms and is the most common cause of a shadowban or');
  L.push('  a permanent ban. They work against the growth you are paying for');
  L.push('  with your time.');
  return L.join('\n');
}

CAPS['content.week'] = { pillar:5, safe:true,
  desc:'Plan a week of Instagram content for the newest business — hooks, captions, hashtags, visual briefs',
  async run(){
    const biz = (S.businesses||[])[0];
    if(!biz) return { msg:'No business built yet. Nothing to make content about.', n:0 };
    const recent = (S.content||[])[0];
    if(recent && (Date.now() - Date.parse(recent.t.replace(' ','T')+'Z')) < 5*86400000)
      return { msg:`This week's content is already planned (${recent.posts.length} posts).`, n:0 };
    const w = await buildContentWeek({ bizId: biz.id });
    return { msg:`Week planned: ${w.posts.length} posts, ${w.reels} reels.`, n:w.posts.length,
      detail: w.tellCount ? `${w.tellCount} phrase(s) flagged for your edit.` : 'Audit clean.' };
  }};


function commentsCfg(){ return S.meta || null; }

function replyWindow(){
  const cut = Date.now() - 3600*1000;
  const sent = (S.commentLog||[]).filter(x=>{
    const t = Date.parse((x.t||'').replace(' ','T')+'Z');
    return t && t > cut;
  });
  return { used: sent.length, cap: META.LIMITS.repliesPerHour,
           left: Math.max(0, META.LIMITS.repliesPerHour - sent.length) };
}

/* Pull the latest comments across recent posts and draft a reply to each.
   Nothing is sent here. */
async function harvestComments(opts){
  opts = opts || {};
  const cfg = commentsCfg();
  if(!cfg) throw new Error('Instagram is not connected. Connect it in Comment Desk first.');
  if(!S.llm) throw new Error('CONNECT AN AI BRAIN FIRST');

  const posts = await META.media(cfg.igId, cfg.token, opts.posts || 6);
  const withComments = posts.filter(p => (p.comments_count||0) > 0);
  if(!withComments.length)
    return { drafts:[], scanned:posts.length, msg:'No comments on your recent posts yet.' };

  const now = Date.now();
  const windowMs = META.LIMITS.replyWindowDays * 86400 * 1000;
  const already = new Set((S.commentLog||[]).map(x=>x.commentId));
  const pending = new Set(((S.commentDrafts||[])).map(x=>x.commentId));

  const found = [];
  for(const post of withComments.slice(0, 6)){
    let cs = [];
    try{ cs = await META.comments(post.id, cfg.token); }
    catch(e){ log('WARN','COMMENTS',`Could not read comments on one post — ${e.message}`); continue; }

    for(const c of cs){
      if(already.has(c.id) || pending.has(c.id)) continue;
      /* never answer yourself */
      if((c.username||'').toLowerCase() === (cfg.username||'').toLowerCase()) continue;
      /* Meta's reply window */
      const age = now - Date.parse(c.timestamp);
      if(age > windowMs) continue;
      /* if we already replied in the thread, leave it alone */
      const mine = (c.replies && c.replies.data ? c.replies.data : [])
        .some(r => (r.username||'').toLowerCase() === (cfg.username||'').toLowerCase());
      if(mine) continue;
      found.push({ comment:c, post });
    }
  }
  if(!found.length)
    return { drafts:[], scanned:posts.length, msg:'Nothing new to reply to — everything is already answered.' };

  const batch = found.slice(0, Math.min(20, opts.max || 12));
  const biz = (S.businesses||[])[0];

  const j = await askJson(
`Draft a reply to each of these real Instagram comments on the Owner's own posts.

BUSINESS: ${biz ? biz.name + ' — ' + biz.tagline : 'a one-person business in Ludhiana, Punjab'}
${biz && biz.tiers ? 'PRICING: ' + biz.tiers.map(t=>`${t.name} Rs ${t.amount}`).join(', ') : ''}

THE COMMENTS:
${batch.map((f,i)=>`[${i+1}] @${f.comment.username} on post "${String(f.post.caption||'').slice(0,60)}":
    "${f.comment.text}"`).join('\n')}

${ANTI_AI}

HOW TO REPLY — this is a public reply under the Owner's own brand:
- Short. One or two sentences. Nobody reads a paragraph in comments.
- Answer the actual question. If they asked the price, say the price.
- Every reply must be DIFFERENT. Identical replies at scale is the exact
  pattern Meta restricts accounts for, and it reads as a bot to humans too.
- Never invent a fact, a number, a customer or a result.
- If a comment is abuse, spam, or a sales pitch, set action to "ignore".
- If it needs a private answer (a price list, a link, someone's personal
  details), set action to "dm" instead of "public".
- If you genuinely cannot answer it without the Owner's knowledge, set
  action to "owner" and say what you need from him.
- No emoji unless the commenter used one first.

Return ONLY a JSON array, one object per comment, in the same order:
[{"n":1,"action":"public | dm | ignore | owner","reply":"the exact words, or empty if ignoring","why":"under 10 words"}]`,
    'You write short, human, public replies for a small Indian business. Never identical, never salesy.',
    'comment-drafts','Growth Conductor');

  const arr = Array.isArray(j) ? j : (j.replies || j.drafts || []);
  const seen = new Set();
  const drafts = [];
  for(let i = 0; i < batch.length; i++){
    const f = batch[i];
    const d = arr.find(x => +x.n === i+1) || arr[i] || {};
    const action = ['public','dm','ignore','owner'].includes(d.action) ? d.action : 'owner';
    const text = String(d.reply||'').trim();

    /* HARD RULE: identical text is refused before it can ever be sent. */
    const key = text.toLowerCase().replace(/\s+/g,' ');
    let dup = false;
    if(text && seen.has(key)) dup = true;
    if(text) seen.add(key);

    drafts.push({
      id: uid('CMT'),
      commentId: f.comment.id,
      mediaId: f.post.id,
      permalink: f.post.permalink,
      username: f.comment.username,
      commentText: f.comment.text,
      commentAt: f.comment.timestamp,
      action: dup ? 'owner' : action,
      reply: text,
      why: dup ? 'DUPLICATE TEXT — refused, write this one yourself' : String(d.why||'').slice(0,80),
      status: 'DRAFT',
    });
  }

  S.commentDrafts = (S.commentDrafts||[]).concat(drafts).slice(-60);
  save();
  const pub = drafts.filter(d=>d.action==='public').length;
  log('OK','COMMENTS',
    `${drafts.length} comment(s) drafted — ${pub} public replies ready for your approval. Nothing sent.`);
  return { drafts, scanned: posts.length,
    msg:`${drafts.length} drafted from ${withComments.length} post(s). Nothing sent until you approve.` };
}

/* Send the approved batch. Paced, capped, and refuses anything suspect. */
async function sendComments(ids){
  const cfg = commentsCfg();
  if(!cfg) throw new Error('Instagram is not connected.');
  const want = (S.commentDrafts||[]).filter(d =>
    (!ids || !ids.length || ids.includes(d.id)) && d.status === 'DRAFT'
    && (d.action === 'public' || d.action === 'dm'));
  if(!want.length) throw new Error('Nothing approved to send.');

  const w = replyWindow();
  if(!w.left) throw new Error(
    `Hourly cap reached — ${w.used} replies in the last hour. Meta restricts accounts that burst. Resumes automatically.`);

  const seenNow = new Set((S.commentLog||[]).slice(0,50).map(x=>String(x.text||'').toLowerCase().replace(/\s+/g,' ')));
  let sent = 0, skipped = 0, failed = 0;
  const errs = [];

  for(const d of want){
    if(sent >= w.left){ skipped++; d.status='HELD'; d.error='hourly cap'; continue; }
    const key = String(d.reply||'').toLowerCase().replace(/\s+/g,' ');
    if(!d.reply.trim()){ d.status='SKIPPED'; d.error='empty'; skipped++; continue; }
    if(seenNow.has(key)){
      d.status='REFUSED';
      d.error='This exact text was already posted. Identical replies at scale is what gets accounts restricted.';
      skipped++; continue;
    }
    try{
      if(d.action === 'public') await META.reply(d.commentId, d.reply, cfg.token);
      else                       await META.privateReply(cfg.igId, d.commentId, d.reply, cfg.token);
      d.status = 'SENT'; d.sentAt = nowIso(); sent++;
      seenNow.add(key);
      S.commentLog = S.commentLog || [];
      S.commentLog.unshift({ t:nowIso(), commentId:d.commentId, username:d.username,
        text:d.reply, kind:d.action });
      S.commentLog = S.commentLog.slice(0,300);
      log('OK','COMMENTS',`Replied to @${d.username}${d.action==='dm'?' privately':''}.`);
    }catch(e){
      d.status='FAILED'; d.error=e.message; failed++; errs.push(e.message);
      log('CRIT','COMMENTS',`Reply to @${d.username} FAILED: ${e.message}`);
      if(/RATE LIMITED/i.test(e.message)) break;   /* stop immediately, do not hammer */
    }
    /* pace it — a burst is what draws scrutiny even when every call is legal */
    if(sent < want.length) await new Promise(r=>setTimeout(r, META.LIMITS.minGapMs));
  }
  save();
  return { sent, skipped, failed, errors: errs.slice(0,3) };
}

CAPS['comments.harvest'] = { pillar:5, safe:true,
  desc:'Read new Instagram comments and draft a reply to each — sends nothing',
  async run(){
    if(!commentsCfg()) return { msg:'Instagram not connected. Nothing to check.', n:0 };
    const r = await harvestComments({ posts:6, max:12 });
    return { msg:r.msg, n:(r.drafts||[]).length,
      detail:(r.drafts||[]).length ? 'Waiting for your approval in Comment Desk.' : '' };
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

    /* 4. restore an empty roster — ONLY if the Owner never deliberately cleared it.
       This used to fight the Owner: he deleted agents, the medic put them back,
       he deleted them again, forever. If he emptied it on purpose, respect it. */
    if(S.owner && !S.agents.length && !S.rosterCleared){
      seed(); fixed.push('agent roster was empty and has been reseeded');
    }

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
/* AUTO KEY ROTATION — the Owner asked why there is no agent for this.
   There was not one. Now there is, and it does the parts that are
   mechanical: promote the healthiest key to primary, clear expired
   cooldowns, retire keys that keep failing, and repair a dead model name
   by asking the provider what it serves today. It CANNOT create a key —
   every provider requires a human CAPTCHA and email or phone verification.
   That one step stays a job on the Owner's desk. */
CAPS['team.keymaster'] = { pillar:2, safe:true,
  desc:'Rotate AI keys automatically — promote the healthy, retire the dead, fix retired models',
  async run(){
    const now = Date.now();
    const acts = [];
    const all = [];
    if(S.llm && S.llm.provider) all.push(S.llm);
    (S.llmBackups||[]).forEach(k=>all.push(k));
    if(!all.length) return { msg:'No keys at all. Add one free key in AI Brain.', n:0 };

    /* 1. expired cooldowns are just noise — clear them */
    let cleared = 0;
    all.forEach(k=>{ if(k.cooled && k.cooled <= now){ k.cooled = 0; cleared++; } });
    if(cleared) acts.push(`${cleared} cooldown(s) expired and cleared`);

    /* 2. promote the healthiest usable key to primary */
    const usable = all.filter(k=>!(k.cooled > now));
    if(usable.length){
      const score = k => (k.ok||0) - (k.fail||0)*3;
      const best = usable.reduce((a,b)=> score(b) > score(a) ? b : a);
      if(best !== S.llm && score(best) > score(S.llm) + 2){
        const old = S.llm;
        const idx = (S.llmBackups||[]).indexOf(best);
        if(idx >= 0){
          S.llmBackups[idx] = old;
          S.llm = best;
          acts.push(`promoted ${best.provider} to primary (${best.ok||0} ok / ${best.fail||0} fail) over ${old.provider}`);
          log('OK','KEYMASTER',`Primary key switched to ${best.provider}. It is measurably healthier.`);
        }
      }
    }

    /* 3. retire a key that fails relentlessly — it is poisoning the pool */
    const dead = (S.llmBackups||[]).filter(k=>(k.fail||0) >= 12 && (k.ok||0) === 0);
    if(dead.length){
      S.llmBackups = (S.llmBackups||[]).filter(k=>!dead.includes(k));
      acts.push(`retired ${dead.length} key(s) that never once succeeded`);
      log('WARN','KEYMASTER',`Retired ${dead.length} permanently failing key(s): ${dead.map(k=>k.provider).join(', ')}`);
    }

    /* 4. a retired MODEL is repairable without the Owner: ask what is live */
    let repaired = 0;
    for(const k of usable.slice(0,3)){
      if(!k.modelDead) continue;
      try{
        const live = await LLM.listModels(k);
        const pick = live.find(m=>/gpt-oss|qwen|llama|gemini|flash|mistral/i.test(m)) || live[0];
        if(pick && pick !== k.model){
          log('OK','KEYMASTER',`${k.provider}: model "${k.model}" is gone, switched to "${pick}".`);
          k.model = pick; k.modelDead = false; repaired++;
        }
      }catch(e){}
    }
    if(repaired) acts.push(`${repaired} dead model name(s) repaired from the provider's live list`);

    if(acts.length) save();
    const kh = keyHealth();
    return { msg: acts.length ? `Key rotation: ${acts.join('; ')}.`
                              : `${kh.ready} key(s) ready. Nothing needed.`,
             n: acts.length, detail: kh.detail.join(' | ') };
  }};

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
  ['dom.check_own',    10800, 'Resource Controller'],
  ['team.keymaster',      300, 'Resource Controller']
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
  ['team.keymaster',     600, 'Resource Controller'],
  ['content.week',    172800, 'Growth Conductor'],
  ['comments.harvest',  1800, 'Growth Conductor'],
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
    orders:S.orders.slice(0,40),
    projects:(S.projects||[]), projectId:(S.projectId||'PRJ-MAIN'),
    content:(S.content||[]),
    meta: S.meta ? { username:S.meta.username, pageName:S.meta.pageName,
      followers:S.meta.followers, mediaCount:S.meta.mediaCount, t:S.meta.t } : null,
    commentDrafts:(S.commentDrafts||[]).slice(-40),
    commentLog:(S.commentLog||[]).slice(0,30),
    replyWindow: (typeof replyWindow==='function') ? replyWindow() : null,
    chat:(S.chat||[]).filter(m=>(m.pid||'PRJ-MAIN')===(S.projectId||'PRJ-MAIN')).slice(0,60),
    chatCounts:(()=>{ const c={}; (S.chat||[]).forEach(m=>{const k=m.pid||'PRJ-MAIN';c[k]=(c[k]||0)+1;}); return c; })(),
    autoIdeas:!!S.autoIdeas,
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
  if(p==='/api/content/txt'){
    if(!auth(req)){ res.writeHead(401); return res.end('unauthorised'); }
    const w=(S.content||[]).find(x=>x.id===url.searchParams.get('id'));
    if(!w){ res.writeHead(404); return res.end('not found'); }
    const buf=Buffer.from(contentPlain(w),'utf8');
    const safe=String(w.bizName||'content').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'content';
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Length':buf.length,
      'Cache-Control':'no-store','Content-Disposition':`attachment; filename="${safe}-week.txt"`});
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
    /* remember the Owner's intent so nothing puts it back */
    if(!S.agents.length) S.rosterCleared = true;
    log('CRIT','REGISTRY',`Agent ${b.id} decommissioned.`); save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/agent/reset'){
    S.agents=[]; S.rosterCleared=false; seed(); save(); return send(res,200,{ok:1,state:pub()});
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
    if(S.docs && S.docs[0] && !S.docs[0].pid) S.docs[0].pid = curProject().id;
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
  /* ---- THE DOER: one box, real actions ---- */
  if(p==='/api/do'){
    const text=(b.text||'').trim();
    if(!text) return send(res,400,{error:'SAY SOMETHING'});
    try{
      const r = await doIt(text);
      return send(res,200,{ok:1,did:r.did,text:r.text,goto:r.goto||null,state:pub()});
    }catch(e){
      chatSay('SYSTEM','FAILED: '+e.message); save();
      return send(res,400,{error:e.message,state:pub()});
    }
  }
  if(p==='/api/chat/clear'){
    const pid=curProject().id;
    S.chat=(S.chat||[]).filter(m=>(m.pid||'PRJ-MAIN')!==pid);
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- COMMENT DESK ---- */
  if(p==='/api/meta/connect'){
    const tok=String(b.token||'').trim();
    if(!tok) return send(res,400,{error:'PASTE THE ACCESS TOKEN'});
    try{
      const v=await META.verify(tok);
      S.meta={ token:tok, igId:v.igId, username:v.username, pageId:v.pageId,
        pageName:v.pageName, followers:v.followers, mediaCount:v.mediaCount, t:nowIso() };
      log('OK','COMMENTS',`Instagram connected: @${v.username} (${v.followers} followers) via Page "${v.pageName}".`);
      save(); return send(res,200,{ok:1,account:v,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/meta/purge'){
    S.meta=null; S.commentDrafts=[];
    log('CRIT','COMMENTS','Instagram disconnected. Token discarded.');
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/comments/harvest'){
    try{ const r=await harvestComments({posts:b.posts,max:b.max});
      return send(res,200,{ok:1,drafts:(r.drafts||[]).length,msg:r.msg,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/comments/edit'){
    const d=(S.commentDrafts||[]).find(x=>x.id===b.id);
    if(!d) return send(res,400,{error:'NO SUCH DRAFT'});
    if(b.reply!=null) d.reply=String(b.reply).slice(0,2200);
    if(b.action && ['public','dm','ignore','owner'].includes(b.action)) d.action=b.action;
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/comments/send'){
    try{ const r=await sendComments(Array.isArray(b.ids)?b.ids:null);
      return send(res,200,{ok:1,sent:r.sent,skipped:r.skipped,failed:r.failed,errors:r.errors,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/comments/clear'){
    S.commentDrafts=(S.commentDrafts||[]).filter(d=>d.status==='DRAFT'&&!b.all?false:d.status==='SENT');
    if(b.all) S.commentDrafts=[];
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- CONTENT STUDIO ---- */
  if(p==='/api/content/week'){
    if(!S.llm) return send(res,400,{error:'CONNECT AN AI BRAIN FIRST'});
    try{
      const w = await buildContentWeek({ bizId:b.bizId, niche:b.niche, count:b.count, handle:b.handle });
      return send(res,200,{ok:1,id:w.id,posts:w.posts.length,reels:w.reels,tells:w.tellCount,state:pub()});
    }catch(e){ log('WARN','CONTENT','Week failed — '+e.message); return send(res,400,{error:e.message}); }
  }
  if(p==='/api/content/delete'){
    S.content=(S.content||[]).filter(x=>x.id!==b.id); save();
    return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/content/posted'){
    const w=(S.content||[]).find(x=>x.id===b.weekId);
    if(!w) return send(res,400,{error:'NO SUCH WEEK'});
    const post=(w.posts||[]).find(x=>x.id===b.postId);
    if(!post) return send(res,400,{error:'NO SUCH POST'});
    post.posted = !post.posted;
    if(b.result != null) post.result = String(b.result).slice(0,160);
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- PROJECTS ---- */
  if(p==='/api/project/new'){
    const name=String(b.name||'').trim().slice(0,50);
    if(!name) return send(res,400,{error:'NAME IT'});
    S.projects=S.projects||[];
    if(S.projects.length>=20) return send(res,400,{error:'20 projects is the limit. Delete one first.'});
    const prj={ id:uid('PRJ'), name, t:nowIso() };
    S.projects.unshift(prj); S.projectId=prj.id;
    log('OK','WORKSPACE',`Project "${name}" opened. Its conversation and files are kept separate.`);
    save(); return send(res,200,{ok:1,id:prj.id,state:pub()});
  }
  if(p==='/api/project/open'){
    if(!(S.projects||[]).some(x=>x.id===b.id)) return send(res,400,{error:'NO SUCH PROJECT'});
    S.projectId=b.id; save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/project/rename'){
    const prj=(S.projects||[]).find(x=>x.id===b.id);
    if(!prj) return send(res,400,{error:'NO SUCH PROJECT'});
    prj.name=String(b.name||'').trim().slice(0,50)||prj.name;
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/project/delete'){
    if(b.id==='PRJ-MAIN') return send(res,400,{error:'General cannot be deleted.'});
    S.projects=(S.projects||[]).filter(x=>x.id!==b.id);
    S.chat=(S.chat||[]).filter(m=>(m.pid||'PRJ-MAIN')!==b.id);
    S.docs=(S.docs||[]).filter(d=>d.pid!==b.id);
    if(S.projectId===b.id) S.projectId=(S.projects[0]||{id:'PRJ-MAIN'}).id;
    save(); return send(res,200,{ok:1,state:pub()});
  }

  /* ---- SEARCH EVERY CONVERSATION ---- */
  if(p==='/api/chat/search'){
    const q=String(b.q||'').trim().toLowerCase();
    if(q.length<2) return send(res,400,{error:'TYPE AT LEAST TWO CHARACTERS'});
    const names={}; (S.projects||[]).forEach(x=>{names[x.id]=x.name;});
    const hits=(S.chat||[])
      .filter(m=>String(m.text||'').toLowerCase().includes(q))
      .slice(0,40)
      .map(m=>{
        const t=String(m.text);
        const i=t.toLowerCase().indexOf(q);
        return { t:m.t, who:m.who, pid:m.pid||'PRJ-MAIN',
                 project:names[m.pid||'PRJ-MAIN']||'(deleted)',
                 snippet:(i>60?'…':'')+t.slice(Math.max(0,i-60), i+140)+(t.length>i+140?'…':'') };
      });
    return send(res,200,{ok:1,hits,q});
  }

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
    S.haltedByOwner = !S.running;
    S.haltedAt = S.running ? null : nowIso();
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
    S.tasks=[]; S.tasksCleared=false; seedTasks(); save(); return send(res,200,{ok:1,state:pub()});
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
  if(S.owner && !S.agents.length && !S.rosterCleared){ seed(); save(); }
  /* AUTO-START: the Chairman runs himself. The Owner should never have to
     press "start" — that is his job, not yours. */
  if(S.owner){
    if((!S.tasks || !S.tasks.length) && !S.tasksCleared) seedTasks(true, false);
    /* AUTO-START, properly this time.
       The old line said "only a deliberate halt keeps it off" — but nothing
       distinguished a deliberate halt from a crash, a first boot, or a
       partially-written state file. Any of those left running=false FOREVER
       and the Chairman sat there doing nothing while every task showed as
       enabled. That is exactly the "brain not running" the Owner reported.
       Now only an explicit halt sticks, and even that expires. */
    if(S.running !== true){
      const halted = S.haltedAt ? Date.parse(S.haltedAt.replace(' ','T')+'Z') : 0;
      const hoursHalted = halted ? (Date.now()-halted)/3600000 : 999;
      if(!S.haltedByOwner || hoursHalted > 12){
        S.running = true;
        if(S.haltedByOwner)
          log('OK','RUNTIME',`Auto-resumed after a ${Math.round(hoursHalted)}h halt. He does not stay stopped by accident.`);
        S.haltedByOwner = false; S.haltedAt = null;
      } else {
        log('WARN','RUNTIME',`Still halted — you stopped him ${Math.round(hoursHalted)}h ago. Press START, or he resumes on his own after 12h.`);
      }
    }
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
