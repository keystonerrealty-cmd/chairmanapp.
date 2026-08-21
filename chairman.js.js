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
  'app.js': Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNCNDQ0MkEnLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNBODgwMUInLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzc4OEExRCcsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjNkU3QTNDJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzRGN0EyQScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCi8qIEJPT1Qg4oCUIGV2ZXJ5IHN0ZXAgaXNvbGF0ZWQuCiAgIFRoaXMgdXNlZCB0byBiZSBvbmUgdHJ5L2NhdGNoIGFyb3VuZCBldmVyeXRoaW5nLiBJZiBBTlkgc3RlcCB0aHJldyDigJQKICAgYSBtaXNzaW5nIGVsZW1lbnQsIGEgYmFkIHN0YXRlIHNoYXBlLCBvbmUgYnJva2VuIHJlbmRlciDigJQgdGhlIHdob2xlCiAgIGFwcCBkaWVkIHNpbGVudGx5IGFuZCB5b3UgZ290IGEgYmxhbmsgc2NyZWVuIHdpdGggbm8gZXhwbGFuYXRpb24uCiAgIFRoYXQgaXMgdGhlICJicmFpbiBub3QgcnVubmluZyIgYnVnLiBOb3cgZWFjaCBzdGVwIGZhaWxzIG9uIGl0cyBvd24KICAgYW5kIHNheXMgc28gb24gc2NyZWVuIGluc3RlYWQgb2YgdmFuaXNoaW5nLiAqLwpmdW5jdGlvbiBib290RmFpbChtc2csIGRldGFpbCl7CiAgdHJ5ewogICAgY29uc3Qgdj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlldycpfHxkb2N1bWVudC5ib2R5OwogICAgdi5pbm5lckhUTUw9YDxkaXYgc3R5bGU9Im1heC13aWR0aDo1NjBweDttYXJnaW46NDBweCBhdXRvO3BhZGRpbmc6MjJweDsKICAgICAgYmFja2dyb3VuZDojRkJGOEYxO2JvcmRlcjoxcHggc29saWQgI0I0NDQyQTtib3JkZXItcmFkaXVzOjE0cHg7CiAgICAgIGZvbnQ6MTRweC8xLjYgLWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxSb2JvdG8sc2Fucy1zZXJpZjtjb2xvcjojMTgxNTA5Ij4KICAgICAgPGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNCNDQ0MkE7bWFyZ2luLWJvdHRvbTo4cHgiPiR7bXNnfTwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJmb250LWZhbWlseTp1aS1tb25vc3BhY2UsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMnB4O2JhY2tncm91bmQ6I0Y1RjFFNzsKICAgICAgICBib3JkZXI6MXB4IHNvbGlkICNERUQ3Qzc7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4O21hcmdpbi1ib3R0b206MTJweDsKICAgICAgICB3aGl0ZS1zcGFjZTpwcmUtd3JhcDt3b3JkLWJyZWFrOmJyZWFrLXdvcmQiPiR7U3RyaW5nKGRldGFpbHx8JycpLnNsaWNlKDAsNDAwKX08L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0iY29sb3I6IzZFNjg1NzttYXJnaW4tYm90dG9tOjEycHgiPlRoZSBzZXJ2ZXIgaXMgcHJvYmFibHkgZmluZSBcdTIwMTQgdGhpcyBpcyB0aGUgcGFnZSBmYWlsaW5nIHRvIGRyYXcuCiAgICAgICBUcnkgYSBoYXJkIHJlZnJlc2ggZmlyc3QuIElmIGl0IGtlZXBzIGhhcHBlbmluZywgdGhpcyBleGFjdCB0ZXh0IGlzIHdoYXQgdG8gcmVwb3J0LjwvZGl2PgogICAgICA8YnV0dG9uIG9uY2xpY2s9ImxvY2F0aW9uLnJlbG9hZCgpIiBzdHlsZT0iYmFja2dyb3VuZDojNzg4QTFEO2NvbG9yOiNmZmY7Ym9yZGVyOjA7CiAgICAgICAgYm9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoxMHB4IDE4cHg7Zm9udDppbmhlcml0O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlciI+UmVsb2FkPC9idXR0b24+CiAgICAgIDxidXR0b24gb25jbGljaz0iZG9jdW1lbnQuY29va2llPSdjb3M9OyBQYXRoPS87IE1heC1BZ2U9MCc7bG9jYXRpb24ucmVsb2FkKCkiCiAgICAgICAgc3R5bGU9ImJhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Ym9yZGVyOjFweCBzb2xpZCAjREVEN0M3O2JvcmRlci1yYWRpdXM6OXB4OwogICAgICAgIHBhZGRpbmc6MTBweCAxOHB4O2ZvbnQ6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjttYXJnaW4tbGVmdDo4cHgiPkxvZyBvdXQgYW5kIHJldHJ5PC9idXR0b24+CiAgICA8L2Rpdj5gOwogIH1jYXRjaChlKXsgLyogbm90aGluZyBsZWZ0IHRvIGRyYXcgb24gKi8gfQp9CndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGV2PT57CiAgaWYoIXdpbmRvdy5fX2Jvb3RlZCkgYm9vdEZhaWwoJ1RoZSBwYWdlIGhpdCBhbiBlcnJvciB3aGlsZSBsb2FkaW5nLicsIGV2Lm1lc3NhZ2UrJyBcdTIwMTQgJysoZXYuZmlsZW5hbWV8fCcnKSsnOicrKGV2LmxpbmVub3x8JycpKTsKfSk7CgooYXN5bmMgZnVuY3Rpb24oKXsKICB0cnl7IHBhaW50SGVybygpOyB9Y2F0Y2goZSl7IGNvbnNvbGUuZXJyb3IoJ2hlcm8gcGFpbnQgZmFpbGVkJywgZSk7IH0KCiAgbGV0IGI9e307CiAgdHJ5ewogICAgYiA9IGF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9ib290Jyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCk7CiAgICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaHNVcCcpOyBpZihlbCkgZWwudGV4dENvbnRlbnQ9J09OTElORSc7CiAgfWNhdGNoKGUpewogICAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hzVXAnKTsKICAgIGlmKGVsKXsgZWwudGV4dENvbnRlbnQ9J09GRkxJTkUnOyBlbC5zdHlsZS5jb2xvcj0ndmFyKC0tbWFnKSc7IH0KICAgIHJldHVybiBib290RmFpbCgnQ2Fubm90IHJlYWNoIHRoZSBzZXJ2ZXIuJywgZS5tZXNzYWdlKTsKICB9CgogIGlmKCFiLmF1dGhlZCl7IHdpbmRvdy5fX2Jvb3RlZD10cnVlOyByZXR1cm47IH0gICAvKiBzaG93IHRoZSBsb2dpbiBzY3JlZW4gKi8KCiAgbGV0IHI7CiAgdHJ5eyByID0gYXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IH0KICBjYXRjaChlKXsgcmV0dXJuIGJvb3RGYWlsKCdTaWduZWQgaW4sIGJ1dCBjb3VsZCBub3QgbG9hZCB5b3VyIGRhdGEuJywgZS5tZXNzYWdlKTsgfQoKICBpZighciB8fCAhci5zdGF0ZSkgcmV0dXJuIGJvb3RGYWlsKCdUaGUgc2VydmVyIHJldHVybmVkIG5vIHN0YXRlLicsIEpTT04uc3RyaW5naWZ5KHJ8fHt9KS5zbGljZSgwLDIwMCkpOwogIFMgPSByLnN0YXRlOwoKICB0cnl7IGVudGVyKCk7IHdpbmRvdy5fX2Jvb3RlZD10cnVlOyB9CiAgY2F0Y2goZSl7IGJvb3RGYWlsKCdZb3VyIGRhdGEgbG9hZGVkLCBidXQgdGhlIHNjcmVlbiBmYWlsZWQgdG8gZHJhdy4nLCBlLm1lc3NhZ2UrJ1xuXG4nKyhlLnN0YWNrfHwnJykuc3BsaXQoJ1xuJykuc2xpY2UoMCwzKS5qb2luKCdcbicpKTsgfQp9KSgpOwpmdW5jdGlvbiBwYWludEhlcm8oKXsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVyb1BpbGxhcnMnKS5pbm5lckhUTUw9UElMTEFSUy5tYXAocD0+YDxkaXYgY2xhc3M9InBjYXJkIj4KICAgPHU+RkxPT1IgMCR7cC5pZH08L3U+PGg0PiR7cC5pY29ufSAke2VzYyhwLm5hbWUpfTwvaDQ+PHA+JHtlc2MocC5kZXNjKX08L3A+CiAgICR7cC5jaGlwcy5tYXAoYz0+YDxzcGFuIGNsYXNzPSJjaGlwIj4ke2VzYyhjKX08L3NwYW4+YCkuam9pbignJyl9PC9kaXY+YCkuam9pbignJyk7Cn0KYXN5bmMgZnVuY3Rpb24gZG9Mb2dpbigpewogIGNvbnN0IGU9bGlFcnI7ZS50ZXh0Q29udGVudD0nJzsKICB0cnl7CiAgICBhd2FpdCBBUEkoJy9hcGkvbG9naW4nLHtpZDpsaUlkLnZhbHVlLnRyaW0oKSxwdzpsaVB3LnZhbHVlfSk7CiAgICBsaVB3LnZhbHVlPScnOyBlbnRlcigpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2U9PT0nQUNDRVNTIERFTklFRCc/J0FDQ0VTUyBERU5JRUQuIENyZWRlbnRpYWwgbWlzbWF0Y2gg4oCUIGxvZ2dlZCBDUklUIHNlcnZlci1zaWRlLic6eC5tZXNzYWdlOyB9Cn0KZnVuY3Rpb24gZW50ZXIoKXsKICBnYXRlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTsgYXBwLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTsKICB3aG9JZC50ZXh0Q29udGVudD1TLm93bmVyLmlkOyBidWlsZE5hdigpOyBnbyhTSU1QTEU/J2Rlc2snOidob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCi8qIFRIRSBCVUcgVEhBVCBNQURFIFlPVSBXUklURSBJTiBOT1RFUEFELgogICBFdmVyeSAzIHNlY29uZHMgdGhpcyBjYWxsZWQgcmVuZGVyKCksIHdoaWNoIGRvZXMgdmlldy5pbm5lckhUTUwgPSAuLi4KICAgVGhhdCBkZXN0cm95cyBhbmQgcmVidWlsZHMgZXZlcnkgaW5wdXQgYW5kIHRleHRhcmVhIG9uIHRoZSBwYWdlLiBJZiB5b3UKICAgd2VyZSBtaWQtc2VudGVuY2UsIHlvdXIgdGV4dCB3YXMgZ29uZS4gVGhhdCBpcyB3aHkgdHlwaW5nIHdlbnQgYmxhbmsuCgogICBGaXgsIGluIHRocmVlIHBhcnRzOgogICAxLiBJZiB5b3UgYXJlIHR5cGluZyBpbiBBTlkgZmllbGQsIHRoZSByZXBhaW50IGlzIERFRkVSUkVELCBub3Qgc2tpcHBlZC4KICAgMi4gQW55IGZpZWxkIHdpdGggdGV4dCBpbiBpdCBpcyBuZXZlciB3aXBlZCwgZXZlbiB1bmZvY3VzZWQuCiAgIDMuIEN1cnNvciBwb3NpdGlvbiBhbmQgc2Nyb2xsIGFyZSByZXN0b3JlZCB3aGVuIGEgcmVwYWludCBkb2VzIGhhcHBlbi4gKi8KZnVuY3Rpb24gaXNUeXBpbmcoKXsKICBjb25zdCBhID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDsKICBpZighYSkgcmV0dXJuIGZhbHNlOwogIGNvbnN0IHRhZyA9IChhLnRhZ05hbWV8fCcnKS50b0xvd2VyQ2FzZSgpOwogIHJldHVybiB0YWc9PT0naW5wdXQnIHx8IHRhZz09PSd0ZXh0YXJlYScgfHwgdGFnPT09J3NlbGVjdCcgfHwgYS5pc0NvbnRlbnRFZGl0YWJsZTsKfQpsZXQgZGlydHlTdGF0ZSA9IGZhbHNlOwpmdW5jdGlvbiBzYWZlUmVuZGVyKCl7CiAgaWYoaXNUeXBpbmcoKSl7IGRpcnR5U3RhdGUgPSB0cnVlOyByZXR1cm47IH0gICAvKiBjb21lIGJhY2sgd2hlbiB0aGV5IHN0b3AgKi8KICBjb25zdCBzY3JvbGwgPSB3aW5kb3cuc2Nyb2xsWTsKICByZW5kZXIoKTsKICB3aW5kb3cuc2Nyb2xsVG8oMCwgc2Nyb2xsKTsKICBkaXJ0eVN0YXRlID0gZmFsc2U7Cn0KLyogV2hlbiB5b3UgY2xpY2sgYXdheSBvciBzdG9wIHR5cGluZywgYXBwbHkgYW55dGhpbmcgdGhhdCB3YXMgd2FpdGluZy4gKi8KZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCAoKT0+eyBzZXRUaW1lb3V0KCgpPT57IGlmKGRpcnR5U3RhdGUgJiYgIWlzVHlwaW5nKCkpIHNhZmVSZW5kZXIoKTsgfSwgMjUwKTsgfSk7CgpmdW5jdGlvbiBzdGFydFBvbGwoKXsgc3RvcFBvbGwoKTsgcG9sbD1zZXRJbnRlcnZhbChhc3luYygpPT57CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCAoYXdhaXQgZmV0Y2goJy9hcGkvc3RhdGU/c2luY2U9JytTLnJldix7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCk7CiAgICBpZihyLnVuY2hhbmdlZCl7IFMudGVsZW1ldHJ5PXIudGVsZW1ldHJ5OyBTLmZsb29ycz1yLmZsb29yczsgdGlja0Nocm9tZSgpOwogICAgICBpZighaXNUeXBpbmcoKSAmJiAoY3VyPT09J2hvbWUnfHxjdXI9PT0nYW5hbHl0aWNzJ3x8Y3VyPT09J3N5c3RlbScpKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgc2FmZVJlbmRlcigpOwogICAgICBzeW5jUGlsbC50ZXh0Q29udGVudCA9IGRpcnR5U3RhdGUgPyAnUEFVU0VEIOKAlCBZT1UgQVJFIFRZUElORycgOiAnVVBEQVRFRCc7CiAgICAgIHNldFRpbWVvdXQoKCk9PnsgaWYoIWRpcnR5U3RhdGUpIHN5bmNQaWxsLnRleHRDb250ZW50PSdTWU5DRUQnOyB9LDEyMDApOyB9CiAgfWNhdGNoKGUpeyBzeW5jUGlsbC50ZXh0Q29udGVudD0nT0ZGTElORSc7IH0KfSw1MDAwKSB9CmZ1bmN0aW9uIHN0b3BQb2xsKCl7IGNsZWFySW50ZXJ2YWwocG9sbCkgfQpmdW5jdGlvbiB0aWNrQ2hyb21lKCl7CiAgY29uc3QgdD1TLnRlbGVtZXRyeTsKICB1cENsb2NrLnRleHRDb250ZW50PWhobW1zcyh0LnVwdGltZV9zKTsKICBzcGVuZE1pbmkudGV4dENvbnRlbnQ9JyQnKyhTLnNwZW5kfHwwKS50b0ZpeGVkKDIpOwogIHNwZW5kTWluaS5zdHlsZS5jb2xvcj1TLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSc7Cn0KZnVuY3Rpb24gc29mdFJlZnJlc2goKXsKICBpZihpc1R5cGluZygpKSB7IGRpcnR5U3RhdGUgPSB0cnVlOyByZXR1cm47IH0KICBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+ewogICAgLyogbmV2ZXIgYmxvdyBhd2F5IGEgc2VjdGlvbiB0aGF0IGNvbnRhaW5zIHRleHQgdGhlIE93bmVyIGhhcyBlbnRlcmVkICovCiAgICBjb25zdCBmaWxsZWQgPSBbLi4ubi5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCx0ZXh0YXJlYScpXS5zb21lKGk9PmkudmFsdWUgJiYgaS52YWx1ZS50cmltKCkpOwogICAgaWYoZmlsbGVkKSByZXR1cm47CiAgICBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsKICAgIHRyeXsgbi5pbm5lckhUTUw9TElWRVtmXSgpIH1jYXRjaChlKXt9CiAgfSk7Cn0KY29uc3QgTElWRT17fTsKLyogUGl4ZWwgYXJ0LCBpbmxpbmVkIGFzIGRhdGEgVVJJcyBzbyBpdCB3b3JrcyB3aXRoIG5vIG5ldHdvcmsgYXQgYWxsLiAqLwpjb25zdCBBUlQ9eyJoZXJvIjogIi9hcnQvaGVyby5qcGciLCAiYnVpbGQiOiAiL2FydC9idWlsZC5qcGciLCAibmFtZSI6ICIvYXJ0L25hbWUuanBnIiwgImN1c3RvbWVycyI6ICIvYXJ0L2N1c3RvbWVycy5qcGciLCAiYXBwcm92ZSI6ICIvYXJ0L2FwcHJvdmUuanBnIn07CgovKiAtLS0tLS0tLS0tIG5hdiAtLS0tLS0tLS0tICovCi8qIFNJTVBMRSBNT0RFIGlzIHRoZSBkZWZhdWx0OiBvbmUgcGFnZSB3aGVyZSBoZSBhc2tzLCB5b3UgdGljay4KICAgRXZlcnl0aGluZyBlbHNlIGlzIHN0aWxsIHRoZXJlLCBvbmUgY2xpY2sgYXdheSwgZm9yIHdoZW4geW91IHdhbnQgaXQuICovCmNvbnN0IE5BVl9TSU1QTEU9WwogWycnLFtbJ2Rlc2snLCdcdTI1YzknLCdDaGFpcm1hbiddLFsnZmFjdG9yeScsJ1x1MjVhNicsJ015IEJ1c2luZXNzZXMnXSxbJ2dyb3d0aCcsJ1x1MjdhNCcsJ0N1c3RvbWVycyddLFsnY29udGVudCcsJ1x1MjVhMycsJ0NvbnRlbnQnXSxbJ2NvbW1lbnRzJywnXHUyNWM4JywnQ29tbWVudHMnXSxbJ3NraWxsczMnLCdcdTI3MjYnLCdTa2lsbHMnXV1dLAogWydJRiBZT1UgV0FOVCBJVCcsW1snbW9yZScsJ+KLrycsJ0V2ZXJ5dGhpbmcgRWxzZSddXV0KXTsKY29uc3QgTkFWREVGPVsKIFsnJyxbWydkZXNrJywn4peJJywnVGhlIENoYWlybWFuJ11dXSwKIFsnT1BFUkFURScsW1snaG9tZScsJ+KMgicsJ0hvbWUnXSxbJ2dhdGVzJywn4puoJywnU2VjdXJpdHkgR2F0ZXMnXSxbJ2ZpbmFuY2VzJywn4oK/JywnRmluYW5jZXMnXSxbJ3BheW91dCcsJ+KbgScsJ1BheW91dCBWYXVsdCddXV0sCiBbJ0FHRU5UUycsW1snYWdlbnRzJywn4peIJywnQWdlbnRzJ10sWydvcmdjaGFydCcsJ+KMlycsJ09yZyBDaGFydCddLFsnc2tpbGxzJywn4pymJywnU2tpbGxzICYgVG9vbHMnXV1dLAogWydJTlRFTExJR0VOQ0UnLFtbJ2VuZ2luZScsJ+KXiScsJ09wdGltYWwgRW5naW5lJ10sWydhbmFseXRpY3MnLCfilqQnLCdBbmFseXRpY3MnXSxbJ2F1ZGl0Jywn4piwJywnQXVkaXQgTGVkZ2VyJ11dXSwKIFsnQ09NTUFORCcsW1snYWdlbnQnLCfimpknLCdBZ2VudCBMb29wJ10sWyd3b3JrMicsJ+KciScsJ0ZpbGVzICYgV3JpdGluZyddLFsnbWlzc2lvbnMnLCfil44nLCdNeSBNaXNzaW9ucyddLFsnY29tbWFuZCcsJ+KWricsJ0NvbW1hbmQgQ29uc29sZSddLFsndmVudHVyZXMnLCfil4YnLCdWZW50dXJlcyAmIElkZWFzJ10sWydmYWN0b3J5Jywn4pamJywnQnVzaW5lc3MgRmFjdG9yeSddLFsnc2l0ZXMnLCfilqQnLCdRdWljayBMYW5kaW5nIFBhZ2UnXSxbJ2RvbWFpbnMnLCfil40nLCdEb21haW4gRGVzayddLFsnZ3Jvd3RoJywn4p6kJywnR3Jvd3RoIEVuZ2luZSddLFsnY29udGVudCcsJ+KWoycsJ0NvbnRlbnQgU3R1ZGlvJ10sWydjb21tZW50cycsJ+KXiCcsJ0NvbW1lbnQgRGVzayddLFsnc2tpbGxzMycsJ+KcpicsJ1NraWxscyddLFsncGF5Jywn4oK5JywnUGF5bWVudHMnXV1dLAogWydSVU5USU1FJyxbWydvcHMnLCfilrYnLCdMaXZlIE9wZXJhdGlvbnMnXSxbJ2JyYWluJywn4peIJywnQUkgQnJhaW4nXSxbJ3dvcmsnLCfinKYnLCdBZ2VudCBXb3JrJ10sWydyZXNlYXJjaCcsJ/CfjJAnLCdEZWVwIFJlc2VhcmNoJ11dXSwKIFsnRVZPTFVUSU9OJyxbWydldm9sdmUnLCfin7MnLCdTZWxmLVVwZ3JhZGUnXSxbJ2FyY2gnLCfip4knLCdDb3B5IEFueSBQcm9kdWN0J10sWyd3cml0dGVuJywn4pyOJywnSGUgV3JpdGVzIENvZGUnXSxbJ2Nvbm5lY3QnLCfimq8nLCdDb25uZWN0b3JzJ10sWydza2lsbHMyJywn4peHJywnTGVhcm5lZCBTa2lsbHMnXV1dLAogWydNT05JVE9SSU5HJyxbWyd1cHRpbWUnLCfil44nLCdVcHRpbWUgTWFyc2hhbCddLFsnbWFpbCcsJ+KciScsJ01haWwgUmVsYXknXV1dLAogWydTWVNURU0nLFtbJ3N5c3RlbScsJ+KaoScsJ0xpdmUgVGVsZW1ldHJ5J10sWydzdG9yYWdlJywn4puBJywnU3RvcmFnZSBIZWFsdGgnXSxbJ2RldmljZXMnLCfih4QnLCdEZXZpY2VzICYgU2Vzc2lvbnMnXSxbJ3plcm9jb3N0Jywn4oiFJywnWmVyby1Db3N0IFJvdXRlciddLFsnZG9jdHJpbmUnLCfCpycsJ0RvY3RyaW5lICYgU09QJ10sWydzZXR0aW5ncycsJ+KamScsJ093bmVyIFNldHRpbmdzJ11dXQpdOwpsZXQgU0lNUExFID0gKCgpPT57IHRyeXsgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjaGFpcm1hbl9zaW1wbGUnKSE9PScwJyB9Y2F0Y2goZSl7IHJldHVybiB0cnVlIH0gfSkoKTsKZnVuY3Rpb24gdG9nZ2xlU2ltcGxlKCl7IFNJTVBMRT0hU0lNUExFOwogIHRyeXsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2NoYWlybWFuX3NpbXBsZScsIFNJTVBMRT8nMSc6JzAnKSB9Y2F0Y2goZSl7fQogIGJ1aWxkTmF2KCk7IGdvKFNJTVBMRT8nZGVzayc6J2hvbWUnKTsgfQpmdW5jdGlvbiBidWlsZE5hdigpewogIGNvbnN0IHNyYyA9IFNJTVBMRSA/IE5BVl9TSU1QTEUgOiBOQVZERUY7CiAgbmF2LmlubmVySFRNTCA9IHNyYy5tYXAoKFtnLGl0XSk9PihnP2A8ZGl2IGNsYXNzPSJncnAiPiR7Z308L2Rpdj5gOicnKSsKICAgaXQubWFwKChbaWQsaWMsbF0pPT5gPGJ1dHRvbiBkYXRhLXA9IiR7aWR9IiBvbmNsaWNrPSIke2lkPT09J21vcmUnPyd0b2dnbGVTaW1wbGUoKSc6YGdvKCcke2lkfScpYH0iPjxpPiR7aWN9PC9pPiR7bH08L2J1dHRvbj5gKS5qb2luKCcnKSkuam9pbignJykKICAgKyAoU0lNUExFPycnOmA8ZGl2IGNsYXNzPSJncnAiPlZJRVc8L2Rpdj48YnV0dG9uIG9uY2xpY2s9InRvZ2dsZVNpbXBsZSgpIj48aT7il4k8L2k+QmFjayB0byBTaW1wbGU8L2J1dHRvbj5gKTsKfQpmdW5jdGlvbiBnbyhwKXtjdXI9cDtbLi4ubmF2LnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpXS5mb3JFYWNoKGI9PmIuY2xhc3NMaXN0LnRvZ2dsZSgnb24nLGIuZGF0YXNldC5wPT09cCkpOwogY3J1bWIudGV4dENvbnRlbnQ9cDtyZW5kZXIoKTtjbG9zZVNiKCk7c2Nyb2xsVG8oMCwwKX0KZnVuY3Rpb24gcmVuZGVyKCl7CiAgLyogT25lIGJyb2tlbiBwYWdlIG11c3Qgbm90IHRha2UgdGhlIHdob2xlIGFwcCB3aXRoIGl0LiAqLwogIGlmKCFSRU5ERVJbY3VyXSl7IGN1ciA9IFNJTVBMRSA/ICdkZXNrJyA6ICdob21lJzsgfQogIHRyeXsgdmlldy5pbm5lckhUTUw9UkVOREVSW2N1cl0oKTsgfQogIGNhdGNoKGUpewogICAgY29uc29sZS5lcnJvcigncmVuZGVyICcrY3VyKycgZmFpbGVkJywgZSk7CiAgICB2aWV3LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj4KICAgICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5UaGlzIHBhZ2UgZmFpbGVkIHRvIGRyYXc8L2gzPgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5FdmVyeXRoaW5nIGVsc2Ugc3RpbGwgd29ya3MgXHUyMDE0IHRoZSByZXN0IG9mIHRoZSBhcHAgaXMgZmluZS48L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0iZm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjEycHg7YmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTsKICAgICAgICBib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7d2hpdGUtc3BhY2U6cHJlLXdyYXAiPiR7ZXNjKGN1cil9OiAke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCIgb25jbGljaz0iZ28oJ2Rlc2snKSI+QmFjayB0byB0aGUgQ2hhaXJtYW48L2J1dHRvbj48L2Rpdj5gOwogIH0KICBpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCk7CiAgaWYoY3VyPT09J2JyYWluJyYmdHlwZW9mIHByb3ZIaW50PT09J2Z1bmN0aW9uJylwcm92SGludCgpOwogIGlmKGN1cj09PSdwYXknJiZ0eXBlb2YgcGF5SGludD09PSdmdW5jdGlvbicpcGF5SGludCgpOyB0aWNrQ2hyb21lKCkgfQpmdW5jdGlvbiB0b2dnbGVTYigpe2NvbnN0IG89c2lkZWJhci5jbGFzc0xpc3QudG9nZ2xlKCdvcGVuJyk7CiBpZihvKXtjb25zdCBzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO3MuaWQ9J3NjcmltJztzLm9uY2xpY2s9Y2xvc2VTYjtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpfWVsc2UgY2xvc2VTYigpfQpmdW5jdGlvbiBjbG9zZVNiKCl7c2lkZWJhci5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmltJyk/LnJlbW92ZSgpfQovKiAtLS0tIGxpZ2h0IC8gZGFyayB0aGVtZSwgcmVtZW1iZXJlZCBwZXIgZGV2aWNlIC0tLS0gKi8KZnVuY3Rpb24gYXBwbHlUaGVtZSh0KXsKICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgdCk7CiAgY29uc3QgYj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGhlbWVCdG4nKTsKICBpZihiKSBiLnRleHRDb250ZW50ID0gdD09PSdkYXJrJyA/ICfimIAnIDogJ+KYvic7CiAgdHJ5eyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2hhaXJtYW5fdGhlbWUnLCB0KTsgfWNhdGNoKGUpe30KICBpZih0eXBlb2YgY3VyIT09J3VuZGVmaW5lZCcgJiYgY3VyPT09J2VuZ2luZScgJiYgdHlwZW9mIGRyYXdFbmdpbmU9PT0nZnVuY3Rpb24nKSBkcmF3RW5naW5lKCk7Cn0KZnVuY3Rpb24gdG9nZ2xlVGhlbWUoKXsKICBjb25zdCBub3c9ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2RhcmsnPydkYXJrJzonbGlnaHQnOwogIGFwcGx5VGhlbWUobm93PT09J2RhcmsnPydsaWdodCc6J2RhcmsnKTsKfQovKiBsaWdodCBpcyB0aGUgZGVmYXVsdCDigJQgTnVtZXJvIHRyZWFzdXJ5IHBhbGV0dGUgKi8KdHJ5eyBhcHBseVRoZW1lKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjaGFpcm1hbl90aGVtZScpfHwnbGlnaHQnKTsgfWNhdGNoKGUpeyBhcHBseVRoZW1lKCdsaWdodCcpOyB9CmZ1bmN0aW9uIGlzRGFyaygpeyByZXR1cm4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2RhcmsnIH0KLyogZW5naW5lIHBhbGV0dGUgZm9sbG93cyB0aGUgdGhlbWUgKi8KZnVuY3Rpb24gRVAoKXsgcmV0dXJuIGlzRGFyaygpCiAgPyB7cmluZzonIzI1MkExNicsbGluZTonIzRBNTcyMicsbm9kZUJnOicjMTUxODBDJyxjb3JlMTonI0U4RjBDMCcsY29yZTI6JyNBM0JCMkInLGNvcmUzOicjMkEzMzEwJywKICAgICBjb3JlVHh0OicjMEEwQjA2JyxkZWFkOicjM0E0MDI0JyxkZWFkVHh0OicjNkE2RDVDJyxsYWJlbDonIzlBOUM4QSd9CiAgOiB7cmluZzonI0UzRTNEQScsbGluZTonI0I5QzQ4QScsbm9kZUJnOicjRkZGRkZGJyxjb3JlMTonI0ZGRkZGRicsY29yZTI6JyM4RkEzMjYnLGNvcmUzOicjMzk0NjAzJywKICAgICBjb3JlVHh0OicjRkZGRkZGJyxkZWFkOicjQ0ZDRkMzJyxkZWFkVHh0OicjOUE5QzkwJyxsYWJlbDonIzZCNkQ2Mid9IH0KCi8qIC0tLS0tLS0tLS0gcHJpbWl0aXZlcyAtLS0tLS0tLS0tICovCmNvbnN0IFJFTkRFUj17fTsKZnVuY3Rpb24ga3BpKHYsbCxjLHMpe3JldHVybiBgPGRpdiBjbGFzcz0ia3BpIj48dT4ke2x9PC91PjxiIHN0eWxlPSJjb2xvcjoke2N8fCd2YXIoLS10eHQpJ30iPiR7dn08L2I+JHtzP2A8cz4ke3N9PC9zPmA6Jyd9PC9kaXY+YH0KZnVuY3Rpb24gbG9nSHRtbChuKXtpZighUy5sb2dzLmxlbmd0aClyZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIj5MZWRnZXIgZW1wdHkuPC9kaXY+JzsKIGNvbnN0IGNvbD17SU5GTzondmFyKC0tYmx1KScsT0s6J3ZhcigtLWdybiknLFdBUk46J3ZhcigtLWFtYiknLENSSVQ6J3ZhcigtLW1hZyknfTsKIHJldHVybiAnPGRpdiBjbGFzcz0ibG9nIj4nK1MubG9ncy5zbGljZSgwLG4pLm1hcChsPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7bC50fTwvc3Bhbj4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7Y29sW2wuc2V2XX0iPlske2wuc2V2fV08L3NwYW4+IDxiPiR7ZXNjKGwuc3JjKX08L2I+IOKAlCAke2VzYyhsLm1zZyl9PC9kaXY+YCkuam9pbignJykrJzwvZGl2Pid9CmZ1bmN0aW9uIGZsb29yKGlkKXtyZXR1cm4gUy5mbG9vcnMuZmluZChmPT5mLmlkPT09aWQpfHx7aGVhbHRoOjAsbG9hZDowLGFnZW50czowLGFjdGl2ZTowfX0KCi8qIC0tLS0tLS0tLS0gSE9NRSAtLS0tLS0tLS0tICovCkxJVkUuaG9tZUtwaT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBhY3RpdmU9Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aDsKICByZXR1cm4ga3BpKGFjdGl2ZSsnIC8gJytTLmFnZW50cy5sZW5ndGgsJ0FjdGl2ZSBTdWItQWdlbnRzJywndmFyKC0tY3kpJyxhY3RpdmU9PT1TLmFnZW50cy5sZW5ndGg/J0Z1bGwgcm9zdGVyJzonREVHUkFERUQnKQogICAra3BpKHBlbmQsJ0dhdGVzIEZyb3plbicscGVuZD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLHBlbmQ/J0F3YWl0aW5nIGNsZWFyYW5jZSc6J1F1ZXVlIGNsZWFyJykKICAgK2twaShoaG1tc3ModC51cHRpbWVfcyksJ1NlcnZlciBVcHRpbWUnLCd2YXIoLS1ncm4pJywncGlkICcrdC5waWQpCiAgICtrcGkodC5hdmdfbGF0ZW5jeV9tcysnIG1zJywnQXZnIExhdGVuY3knLHQuYXZnX2xhdGVuY3lfbXM+NTA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxmbXQodC5yZXF1ZXN0cykrJyByZXF1ZXN0cycpfQpMSVZFLmhvbWVMb2FkPSgpPT5QSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTsKICByZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfSBhZ3QgwrcgSCR7Zi5oZWFsdGh9JSDCtyBMJHtmLmxvYWR9JTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YubG9hZH0lO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkwZGVnLCR7cC5jb2xvcn0sdmFyKC0tbGltZSkpIj48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpOwpMSVZFLmhvbWVUZXJtPSgpPT5sb2dIdG1sKDE0KTsKUkVOREVSLmhvbWU9KCk9PnsKICBjb25zdCB0PVMudGVsZW1ldHJ5LCBwZW5kPVMuZ2F0ZXMuZmlsdGVyKGc9Pmcuc3RhdHVzPT09J1BFTkRJTkcnKS5sZW5ndGg7CiAgY29uc3QgaW5mbG93PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkucmVkdWNlKChhLGIpPT5hK2IuYW10LDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCIgZGF0YS1saXZlPSJob21lS3BpIj4ke0xJVkUuaG9tZUtwaSgpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhaXJtYW4ncyBTdGFuZGluZyBBc3Nlc3NtZW50IDxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPk5PIFNVR0FSIENPQVRJTkc8L3NwYW4+PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICAgIDxsaT4ke1Mub3duZXIuYm9vdHN0cmFwPyc8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Q1JJVElDQUw6PC9iPiBib290c3RyYXAgcGFzc3dvcmQgc3RpbGwgYWN0aXZlLiBSb3RhdGUgaXQgbm93IOKAlCB0aGUgcGxhaW50ZXh0IGNvcHkgZXhpc3RzIG9uIGRpc2sgdW50aWwgeW91IGRvLic6J0Jvb3RzdHJhcCBjcmVkZW50aWFsIHJvdGF0ZWQgYW5kIGRlc3Ryb3llZC4gR29vZC4nfTwvbGk+CiAgICA8bGk+JHtTLnBheW91dD8nUGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUcmFuc2ZlcnMgcmVxdWlyZSBzaWduYXR1cmUgKyAyRkEgaW50ZW50Lic6JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5CTE9DS0VSOjwvYj4gbm8gcGF5b3V0IGNoYW5uZWwuIEV2ZXJ5IGZpbmFuY2lhbCBnYXRlIGhhcmQtYmxvY2tzIHNlcnZlci1zaWRlLid9PC9saT4KICAgIDxsaT4ke3BlbmQ/YDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke3BlbmR9IG9wZXJhdGlvbihzKSBmcm96ZW48L2I+IHBlbmRpbmcgeW91ciBjbGVhcmFuY2UuYDonTm8gZnJvemVuIG9wZXJhdGlvbnMuJ308L2xpPgogICAgPGxpPiR7Uy5ydW5uaW5nP2A8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+U1lTVEVNIFJVTk5JTkc8L2I+IOKAlCAkeyhTLnRhc2tzfHxbXSkuZmlsdGVyKHQ9PnQuZW5hYmxlZCkubGVuZ3RofSBzdGFuZGluZyBvcmRlcnMgZXhlY3V0aW5nLCAkeyhTLnRhc2tzfHxbXSkucmVkdWNlKChhLHQpPT5hKyh0LnJ1bnN8fDApLDApfSBqb2JzIGNvbXBsZXRlZC5gOic8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+U1lTVEVNIEhBTFRFRDwvYj4g4oCUIG5vIGFnZW50IHdvcmsgaXMgZXhlY3V0aW5nLiBTdGFydCBpdCBpbiBMaXZlIE9wZXJhdGlvbnMuJ308L2xpPgogICAgPGxpPlplcm8tQ29zdDogJHtTLmRlbmlhbHMubGVuZ3RofSBwYWlkIHBhdGgocykgaW50ZXJjZXB0ZWQsICQke1Muc3BlbmQudG9GaXhlZCgyKX0gYXV0aG9yaXplZCBzcGVuZCwgMCBucG0gZGVwZW5kZW5jaWVzIGluc3RhbGxlZC48L2xpPgogICAgPGxpPkxpdmUgc3luYyBhY3RpdmU6ICR7dC5saXZlX3Nlc3Npb25zfSBkZXZpY2Ugc2Vzc2lvbihzKSBvbiB0aGlzIGluc3RhbmNlLCBzdGF0ZSByZXZpc2lvbiAke1MucmV2fS48L2xpPgogICA8L3VsPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UGlsbGFyIExvYWQgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5ERVJJVkVEIEZST00gUkVBTCBQUk9DRVNTIE1FVFJJQ1M8L3NwYW4+PC9oMz4KICAgIDxkaXYgZGF0YS1saXZlPSJob21lTG9hZCI+JHtMSVZFLmhvbWVMb2FkKCl9PC9kaXY+PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJldmVudWUgVGVsZW1ldHJ5IDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPklORkxPVyAkJHtmbXQoaW5mbG93KX08L3NwYW4+PC9oMz4ke3NwYXJrKCl9CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkdyZWVuIGRhc2hlZCBsaW5lIGlzIHRoZSBzcGVuZCBmbG9vciwgaGVsZCBhdCAkMC4wMCBieSBkb2N0cmluZS48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBUZXJtaW5hbCA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj5TRVJWRVIgTEVER0VSPC9zcGFuPjwvaDM+PGRpdiBkYXRhLWxpdmU9ImhvbWVUZXJtIj4ke0xJVkUuaG9tZVRlcm0oKX08L2Rpdj48L2Rpdj5gOwp9OwpmdW5jdGlvbiBzcGFyaygpewogIGNvbnN0IHY9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5tYXAocj0+ci5hbXQpOyBjb25zdCBwdHM9KHYubGVuZ3RoP3Y6WzAsMF0pLnNsaWNlKC0yNCk7CiAgY29uc3QgbXg9TWF0aC5tYXgoLi4ucHRzLDEpLHc9NjAwLGg9OTAsc3RlcD1wdHMubGVuZ3RoPjE/dy8ocHRzLmxlbmd0aC0xKTp3OwogIGNvbnN0IGQ9cHRzLm1hcCgocCxpKT0+YCR7aT8nTCc6J00nfSR7KGkqc3RlcCkudG9GaXhlZCgxKX0sJHsoaC0ocC9teCkqKGgtMTIpLTYpLnRvRml4ZWQoMSl9YCkuam9pbignICcpOwogIHJldHVybiBgPHN2ZyB2aWV3Qm94PSIwIDAgJHt3fSAke2h9IiBzdHlsZT0id2lkdGg6MTAwJTtoZWlnaHQ6OTBweCI+CiAgIDxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ic2ciIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM3ODhBMUQ1NSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzc4OEExRDAwIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+CiAgICR7WzAsMSwyLDNdLm1hcChpPT5gPGxpbmUgeDE9IjAiIHkxPSIke2kqMzB9IiB4Mj0iJHt3fSIgeTI9IiR7aSozMH0iIHN0cm9rZT0iIzEwMWEyNCIvPmApLmpvaW4oJycpfQogICA8cGF0aCBkPSIke2R9IEwke3d9LCR7aH0gTDAsJHtofSBaIiBmaWxsPSJ1cmwoI3NnKSIvPjxwYXRoIGQ9IiR7ZH0iIHN0cm9rZT0iIzc4OEExRCIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgIDxsaW5lIHgxPSIwIiB5MT0iJHtoLTZ9IiB4Mj0iJHt3fSIgeTI9IiR7aC02fSIgc3Ryb2tlPSIjMzFkNjdhIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIHN0cm9rZS13aWR0aD0iMS40Ii8+PC9zdmc+YDsKfQoKLyogLS0tLS0tLS0tLSBMSVZFIFRFTEVNRVRSWSAtLS0tLS0tLS0tICovCkxJVkUuc3lzPSgpPT57Y29uc3QgdD1TLnRlbGVtZXRyeTsKIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgJHtrcGkodC5yc3NfbWIrJyBNQicsJ1Byb2Nlc3MgUlNTJywndmFyKC0tY3kpJywnaGVhcCAnK3QuaGVhcF9tYisnLycrdC5oZWFwX3RvdGFsX21iKycgTUInKX0KICAke2twaSh0LmxvYWQxLCdMb2FkIEF2ZyAxbScsdC5sb2FkMT50LmNwdXM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyx0LmNwdXMrJyBjcHVzIMK3IDVtICcrdC5sb2FkNSl9CiAgJHtrcGkodC5zeXNfbWVtX3BjdCsnJScsJ1N5c3RlbSBNZW1vcnknLHQuc3lzX21lbV9wY3Q+ODU/J3ZhcigtLW1hZyknOid2YXIoLS1hbWIpJywnaG9zdCAnK3QuaG9zdG5hbWUpfQogICR7a3BpKGZtdCh0LnJlcXVlc3RzKSwnSFRUUCBSZXF1ZXN0cycsJ3ZhcigtLWJsdSknLGZtdCh0LmFwaV9jYWxscykrJyBhcGkgwrcgJyt0LmVycm9ycysnIGVycm9ycycpfQogPC9kaXY+CiA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UHJvY2VzcyBGYWN0czwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPlJ1bnRpbWU8L3RkPjx0ZD4ke3Qubm9kZX0gwrcgJHt0LnBsYXRmb3JtfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBJRDwvdGQ+PHRkPiR7dC5waWR9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VXB0aW1lPC90ZD48dGQ+JHtoaG1tc3ModC51cHRpbWVfcyl9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXZnIGxhdGVuY3k8L3RkPjx0ZD4ke3QuYXZnX2xhdGVuY3lfbXN9IG1zIChsYXN0IDUwMCByZXEpPC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXV0aCBmYWlsdXJlczwvdGQ+PHRkIHN0eWxlPSJjb2xvcjoke3QuYXV0aF9mYWlsdXJlcz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHt0LmF1dGhfZmFpbHVyZXN9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGl2ZSBzZXNzaW9uczwvdGQ+PHRkPiR7dC5saXZlX3Nlc3Npb25zfSBvZiAke3QudG90YWxfc2Vzc2lvbnN9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U3RhdGUgZmlsZTwvdGQ+PHRkPiR7KHQuZGJfYnl0ZXMvMTAyNCkudG9GaXhlZCgxKX0gS0IgwrcgcmV2ICR7dC5zdGF0ZV9yZXZ9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2Vzc2lvbnM8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5EVVJBQkxFIMK3IDMwZCBUVEw8L3NwYW4+PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TW9uaXRvcnM8L3RkPjx0ZD4ke3QubW9uaXRvcnN8fDB9IGJvdW5kIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjoke3QubW9uaXRvcnNfZG93bj8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHt0Lm1vbml0b3JzX2Rvd258fDB9IGRvd248L3NwYW4+PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWFpbCByZWxheTwvdGQ+PHRkPiR7dC5zbXRwX3JlYWR5P2A8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5BUk1FRDwvc3Bhbj4gJHt0Lm1haWxfc2VudH0gc2VudCAvICR7dC5tYWlsX2ZhaWxlZH0gZmFpbGVkYDonPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+T0ZGTElORSDigJQgaW50ZW50IG9ubHk8L3NwYW4+J308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5EZXBlbmRlbmNpZXM8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4wIElOU1RBTExFRCDCtyAkMC4wMDwvc3Bhbj48L3RkPjwvdHI+CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Ib3QgUGF0aHM8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAke3QuaG90X3BhdGhzLm1hcCgoW3AsY10pPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHApfTwvdGQ+PHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij4ke2ZtdChjKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5Db3VudGVycyBhcmUgcmVhbCwgY29sbGVjdGVkIGluLXByb2Nlc3Mgc2luY2UgYm9vdC4gVGhleSByZXNldCB3aGVuIHRoZSBzZXJ2ZXIgcmVzdGFydHMuPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZXJpdmVkIEZsb29yIEhlYWx0aDwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTtyZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuaGVhbHRofSUgaGVhbHRoIMK3ICR7Zi5sb2FkfSUgbG9hZDwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuaGVhbHRofSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPkVhY2ggZmxvb3IncyBoZWFsdGggaXMgY29tcHV0ZWQgZnJvbSByZWFsIGlucHV0czogYXV0aCBmYWlsdXJlcyBhbmQgZG9jdHJpbmUgZGVuaWFscyBoaXQgU2VjdXJpdHk7IGxvYWQgYXZlcmFnZSBhbmQgUlNTIGhpdCBPcGVyYXRpb25zOyBIVFRQIGVycm9ycyBhbmQgZnJvemVuIGdhdGVzIGhpdCBFbmdpbmVlcmluZzsgc3RhdGUtZmlsZSBzaXplIGhpdHMgRGF0YTsgYXV0aG9yaXplZCBzcGVuZCBhbmQgcGF5b3V0IHN0YXR1cyBoaXQgU3RyYXRlZ3kuIFN0YWZmaW5nIHJhdGlvIHNjYWxlcyBhbGwgZml2ZS4gVGhlc2UgbW92ZSB3aGVuIHRoZSBzeXN0ZW0gYWN0dWFsbHkgbW92ZXMuPC9kaXY+PC9kaXY+YH0KUkVOREVSLnN5c3RlbT0oKT0+YDxkaXYgZGF0YS1saXZlPSJzeXMiPiR7TElWRS5zeXMoKX08L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBFTkdJTkUgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZW5naW5lPSgpPT5gCiA8ZGl2IGNsYXNzPSJlbmdpbmVXcmFwIj48ZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJwYWRkaW5nOjExcHggMTNweDttYXJnaW4tYm90dG9tOjExcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPGRpdiBjbGFzcz0icm93Ij48YiBzdHlsZT0ibGV0dGVyLXNwYWNpbmc6MnB4O2ZvbnQtc2l6ZToxMnB4Ij5PUFRJTUFMIEVOR0lORTwvYj48c3BhbiBjbGFzcz0idGFnIHQtY3kiPktOT1dMRURHRSBDT1JFPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSAke2VuZ0ZvY3VzPycnOidwJ30iIG9uY2xpY2s9ImVuZ0ZvY3VzPW51bGw7ZHJhd0VuZ2luZSgpIj5SYWRpYWw8L2J1dHRvbj4KICAgJHtQSUxMQVJTLm1hcChwPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7ZW5nRm9jdXM9PXAuaWQ/J3AnOicnfSIgb25jbGljaz0iZW5nRm9jdXM9JHtwLmlkfTtkcmF3RW5naW5lKCkiPiR7cC5pY29ufTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogIDwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhbnZhc0JveCI+PGRpdiBjbGFzcz0iZ3JpZGJnIj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZW5nVG9wIj48c3BhbiBjbGFzcz0idGFnIHQtZGltIiBpZD0iZW5nTW9kZSI+UkFESUFMIMK3IEFMTCBGTE9PUlM8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImVuZ1RpdGxlIiBpZD0iZW5nVGl0bGUiPkNIQUlSTUFOIENPUkU8L2Rpdj48ZGl2IGlkPSJlbmdTdmciPjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxoMz5FbmdpbmUgVGVybWluYWw8L2gzPgogICA8ZGl2IGNsYXNzPSJ0ZXJtIiBpZD0iZW5nVGVybSI+Y2hhaXJtYW4tb3MgOjogZW5naW5lIHJlYWR5IMK3ICR7Uy5hZ2VudHMubGVuZ3RofSBub2RlcyBib3VuZCDCtyBjb3N0IGNlaWxpbmcgJDAuMDAKYXdhaXRpbmcgbm9kZSBzZWxlY3Rpb27igKY8L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBjbGFzcz0ic2lkZSI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxlbnM8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkVudGl0eTwvc3Bhbj48c2VsZWN0IGNsYXNzPSJpbiIgaWQ9ImxlbnNFbnQiIG9uY2hhbmdlPSJkcmF3RW5naW5lKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iYWxsIj5BbGw8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJhY3RpdmUiPkFjdGl2ZSBvbmx5PC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0ic3VzcCI+U3VzcGVuZGVkIG9ubHk8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW46MCI+PHNwYW4+Rmxvb3I8L3NwYW4+PHNlbGVjdCBjbGFzcz0iaW4iIG9uY2hhbmdlPSJlbmdGb2N1cz10aGlzLnZhbHVlPT09J2FsbCc/bnVsbDordGhpcy52YWx1ZTtkcmF3RW5naW5lKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iYWxsIj5BbGwgZmxvb3JzPC9vcHRpb24+JHtQSUxMQVJTLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSIgJHtlbmdGb2N1cz09cC5pZD8nc2VsZWN0ZWQnOicnfT4ke3AuaWR9IMK3ICR7cC5uYW1lfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxlZ2VuZDwvaDM+PGRpdiBjbGFzcz0ibGVnZW5kIj4KICAgJHtQSUxMQVJTLm1hcChwPT5gPGRpdj48aSBzdHlsZT0iYmFja2dyb3VuZDoke3AuY29sb3J9O2JveC1zaGFkb3c6MCAwIDhweCAke3AuY29sb3J9Ij48L2k+JHtwLm5hbWV9PC9kaXY+YCkuam9pbignJyl9CiAgIDxkaXY+PGkgc3R5bGU9ImJhY2tncm91bmQ6I2U2ZWVmNztib3gtc2hhZG93OjAgMCA4cHggI2ZmZiI+PC9pPkNoYWlybWFuIENvcmU8L2Rpdj48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGlyZWN0b3J5IDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Uy5hZ2VudHMubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJkaXJMaXN0Ij4ke1MuYWdlbnRzLm1hcChhPT5gPGJ1dHRvbiBvbmNsaWNrPSJwaWNrTm9kZSgnJHthLmlkfScpIj4ke2VzYyhhLm5hbWUpfTxzcGFuPiR7UElMTEFSUy5maW5kKHA9PnAuaWQ9PWEucGlsbGFySWQpLmljb259PC9zcGFuPjwvYnV0dG9uPmApLmpvaW4oJycpfHwnPGRpdiBjbGFzcz0ibW9uby1kaW0iPmVtcHR5PC9kaXY+J308L2Rpdj48L2Rpdj4KIDwvZGl2PjwvZGl2PmA7CmZ1bmN0aW9uIGRyYXdFbmdpbmUoKXsKICBjb25zdCBib3g9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1N2ZycpOyBpZighYm94KXJldHVybjsKICBjb25zdCBQPUVQKCk7CiAgY29uc3QgZW50PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsZW5zRW50Jyk/LnZhbHVlfHwnYWxsJzsKICBsZXQgbGlzdD1TLmFnZW50cy5maWx0ZXIoYT0+ZW50PT09J2FsbCd8fChlbnQ9PT0nYWN0aXZlJz9hLnN0YXR1cz09PSdBQ1RJVkUnOmEuc3RhdHVzIT09J0FDVElWRScpKTsKICBjb25zdCBmbG9vcnM9ZW5nRm9jdXM/UElMTEFSUy5maWx0ZXIocD0+cC5pZD09PWVuZ0ZvY3VzKTpQSUxMQVJTOwogIGlmKGVuZ0ZvY3VzKWxpc3Q9bGlzdC5maWx0ZXIoYT0+YS5waWxsYXJJZD09PWVuZ0ZvY3VzKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nTW9kZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzPydGT0NVUyDCtyBGTE9PUiAwJytlbmdGb2N1czonUkFESUFMIMK3IEFMTCBGTE9PUlMnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdUaXRsZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzP1BJTExBUlMuZmluZChwPT5wLmlkPT09ZW5nRm9jdXMpLm5hbWUudG9VcHBlckNhc2UoKTonQ0hBSVJNQU4gQ09SRSc7CiAgY29uc3QgVz05MDAsSD01NjAsY3g9Vy8yLGN5PUgvMjsgbGV0IGh1YnM9JycsbGlua3M9Jycsbm9kZXM9JycscmluZ3M9Jyc7CiAgWzE1MCwyMTUsMjY1XS5mb3JFYWNoKHI9PnJpbmdzKz1gPGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iJHtyfSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIke1AucmluZ30iIHN0cm9rZS1kYXNoYXJyYXk9IjMgNiIvPmApOwogIGNvbnN0IG49Zmxvb3JzLmxlbmd0aDsKICBmbG9vcnMuZm9yRWFjaCgocCxpKT0+ewogICAgY29uc3QgYW5nPSgtOTArKDM2MC9uKSppKSpNYXRoLlBJLzE4MCxoeD1jeCsxNTAqTWF0aC5jb3MoYW5nKSxoeT1jeSsxNTAqTWF0aC5zaW4oYW5nKTsKICAgIGxpbmtzKz1gPGxpbmUgeDE9IiR7Y3h9IiB5MT0iJHtjeX0iIHgyPSIke2h4fSIgeTI9IiR7aHl9IiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIuNTUiIHN0cm9rZS13aWR0aD0iMS40Ii8+YDsKICAgIGh1YnMrPWA8ZyBjbGFzcz0ibm9kZSIgb25jbGljaz0iZW5nRm9jdXM9JHtlbmdGb2N1cz8nbnVsbCc6cC5pZH07ZHJhd0VuZ2luZSgpIj4KICAgICA8Y2lyY2xlIGN4PSIke2h4fSIgY3k9IiR7aHl9IiByPSIxNyIgZmlsbD0iJHtQLm5vZGVCZ30iIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgPHRleHQgeD0iJHtoeH0iIHk9IiR7aHkrNH0iIGZvbnQtc2l6ZT0iMTMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPiR7cC5pY29ufTwvdGV4dD4KICAgICA8dGV4dCB4PSIke2h4fSIgeT0iJHtoeSszMn0iIGZvbnQtc2l6ZT0iOS41IiBmaWxsPSIke3AuY29sb3J9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AubmFtZS5zcGxpdCgnICcpWzBdLnRvVXBwZXJDYXNlKCl9PC90ZXh0PjwvZz5gOwogICAgY29uc3Qga2lkcz1saXN0LmZpbHRlcihhPT5hLnBpbGxhcklkPT09cC5pZCk7CiAgICBraWRzLmZvckVhY2goKGEsaik9PnsKICAgICAgY29uc3Qgc3ByZWFkPWVuZ0ZvY3VzP01hdGguUEkqMS42Ok1hdGguUEkvKG4qMS4xNSk7CiAgICAgIGNvbnN0IHQ9a2lkcy5sZW5ndGg+MT8oai8oa2lkcy5sZW5ndGgtMSktLjUpOjAsIGFhPWFuZyt0KnNwcmVhZCwgUj1lbmdGb2N1cz8yMzA6KGolMj8yNjU6MjE1KTsKICAgICAgY29uc3QgeD1jeCtSKk1hdGguY29zKGFhKSx5PWN5K1IqTWF0aC5zaW4oYWEpLGRlYWQ9YS5zdGF0dXMhPT0nQUNUSVZFJzsKICAgICAgbGlua3MrPWA8bGluZSB4MT0iJHtoeH0iIHkxPSIke2h5fSIgeDI9IiR7eH0iIHkyPSIke3l9IiBzdHJva2U9IiR7ZGVhZD8nIzI0MzA0MCc6cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIke2RlYWQ/LjM6LjM1fSIgc3Ryb2tlLXdpZHRoPSIxIi8+YDsKICAgICAgbm9kZXMrPWA8ZyBjbGFzcz0ibm9kZSIgb25jbGljaz0icGlja05vZGUoJyR7YS5pZH0nKSI+PHRpdGxlPiR7ZXNjKGEubmFtZSl9PC90aXRsZT4KICAgICAgIDxjaXJjbGUgY3g9IiR7eH0iIGN5PSIke3l9IiByPSI5IiBmaWxsPSIke2RlYWQ/UC5ub2RlQmc6UC5ub2RlQmd9IiBzdHJva2U9IiR7ZGVhZD9QLmRlYWQ6cC5jb2xvcn0iIHN0cm9rZS13aWR0aD0iMS42Ii8+CiAgICAgICA8dGV4dCB4PSIke3h9IiB5PSIke3krMy40fSIgZm9udC1zaXplPSI4LjUiIGZpbGw9IiR7ZGVhZD9QLmRlYWRUeHQ6cC5jb2xvcn0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPkE8L3RleHQ+CiAgICAgICAke2VuZ0ZvY3VzP2A8dGV4dCB4PSIke3h9IiB5PSIke3krMjF9IiBmb250LXNpemU9IjgiIGZpbGw9IiR7UC5sYWJlbH0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7ZXNjKGEubmFtZS5zbGljZSgwLDE2KSl9PC90ZXh0PmA6Jyd9PC9nPmA7CiAgICB9KTsKICB9KTsKICBib3guaW5uZXJIVE1MPWA8c3ZnIHZpZXdCb3g9IjAgMCAke1d9ICR7SH0iPgogICA8ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImNvcmUiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iJHtQLmNvcmUxfSIvPjxzdG9wIG9mZnNldD0iLjU1IiBzdG9wLWNvbG9yPSIke1AuY29yZTJ9Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIke1AuY29yZTN9Ii8+PC9yYWRpYWxHcmFkaWVudD4KICAgPGZpbHRlciBpZD0iZ2xvdyI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNSIgcmVzdWx0PSJiIi8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSJiIi8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz4KICAgJHtyaW5nc30ke2xpbmtzfTxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjM0IiBmaWxsPSJ1cmwoI2NvcmUpIiBmaWx0ZXI9InVybCgjZ2xvdykiIG9wYWNpdHk9Ii45MiIvPgogICA8Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSI0NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIke1AuY29yZTJ9NTUiLz4KICAgPHRleHQgeD0iJHtjeH0iIHk9IiR7Y3krM30iIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiR7UC5jb3JlVHh0fSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC13ZWlnaHQ9IjcwMCI+Q09SRTwvdGV4dD4KICAgJHtodWJzfSR7bm9kZXN9PC9zdmc+YDsKfQpmdW5jdGlvbiBwaWNrTm9kZShpZCl7Y29uc3QgYT1TLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCk7aWYoIWEpcmV0dXJuOwogY29uc3QgdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nVGVybScpOwogaWYodCl0LnRleHRDb250ZW50PWBjaGFpcm1hbi1vcyA6OiBub2RlICR7YS5pZH1cbm5hbWUgICAgICR7YS5uYW1lfVxuZmxvb3IgICAgJHthLnBpbGxhcklkfSDCtyAke1BJTExBUlMuZmluZChwPT5wLmlkPT1hLnBpbGxhcklkKS5uYW1lfVxuc3RhdHVzICAgJHthLnN0YXR1c31cbmNvc3QgICAgICR7YS5jb3N0fVxudG9vbHMgICAgJHthLnRvb2xzLmpvaW4oJywgJyl9XG5zY29wZSAgICAke2Eucm9sZX1gOwogc2hvd1lhbWwoaWQpfQoKLyogLS0tLS0tLS0tLSBHQVRFUyAtLS0tLS0tLS0tICovClJFTkRFUi5nYXRlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIFBlcm1pc3Npb24gR2F0ZSA8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj40LVNURVAgU09QIMK3IFNFUlZFUiBFTkZPUkNFRDwvc3Bhbj48L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wZXJhdGlvbiBUaXRsZTwvc3Bhbj48aW5wdXQgaWQ9ImdUaXRsZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iRGVwbG95IHByaWNpbmctc2VydmljZSB2Mi40Ij48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNsYXNzPC9zcGFuPjxzZWxlY3QgaWQ9ImdDbGFzcyIgY2xhc3M9ImluIj4KICAgIDxvcHRpb24+REVQTE9ZTUVOVDwvb3B0aW9uPjxvcHRpb24+REIgU0NIRU1BIENIQU5HRTwvb3B0aW9uPjxvcHRpb24+Q09ERSBNT0RJRklDQVRJT048L29wdGlvbj4KICAgIDxvcHRpb24+RklOQU5DSUFMIFRSQU5TRkVSPC9vcHRpb24+PG9wdGlvbj5BQ0NFU1MgR1JBTlQ8L29wdGlvbj48b3B0aW9uPkVYVEVSTkFMIFRPT0wgQURPUFRJT048L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MSDCtyBPYmplY3RpdmUgJmFtcDsgc3VjY2VzcyBjcml0ZXJpYTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdPYmoiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjIgwrcgQWdlbnRzIC8gdG9vbHMgYXNzaWduZWQgJmFtcDsgd2h5PC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ0p1c3QiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjMgwrcgUm9sbGJhY2sgJmFtcDsgc2FmZWd1YXJkczwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdTYWZlIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CbGFzdCBSYWRpdXM8L3NwYW4+PHNlbGVjdCBpZD0iZ1Jpc2siIGNsYXNzPSJpbiI+PG9wdGlvbj5MT1c8L29wdGlvbj48b3B0aW9uPk1FRElVTTwvb3B0aW9uPjxvcHRpb24+SElHSDwvb3B0aW9uPjxvcHRpb24+U0VWRVJFPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub29sIENvc3QgLyBDcmVkaXRzIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0iZ0Nvc3QiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPSIwIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlZhbHVlIGF0IFJpc2sgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJnQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgbWluPSIwIiB2YWx1ZT0iMCI+PC9sYWJlbD48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyZWUgQWx0ZXJuYXRpdmUgUm91dGUgKHJlcXVpcmVkIGlmIGNvc3QgJmd0OyAwKTwvc3Bhbj48aW5wdXQgaWQ9ImdGcmVlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJPcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIHBhdGgiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJhaXNlR2F0ZSgpIj5TVUJNSVQgRk9SIE9XTkVSIENMRUFSQU5DRTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgUXVldWUgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmdhdGVzLmxlbmd0aH08L3NwYW4+PC9oMz4KICAke1MuZ2F0ZXMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+T3BlcmF0aW9uPC90aD48dGg+Q2xhc3M8L3RoPjx0aD5SaXNrPC90aD48dGg+Q29zdDwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZ2F0ZXMubWFwKGc9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtnLmlkfTwvdGQ+PHRkPiR7ZXNjKGcudGl0bGUpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2cudH08L2Rpdj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtnLmNsc308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtbJ0hJR0gnLCdTRVZFUkUnXS5pbmNsdWRlcyhnLnJpc2spPyd0LXJlZCc6Zy5yaXNrPT09J01FRElVTSc/J3QtYW1iJzondC1ncm4nfSI+JHtnLnJpc2t9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPiR7Zy5jb3N0PyckJytnLmNvc3Q6J0ZSRUUnfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2cuc3RhdHVzPT09J0FQUFJPVkVEJz8ndC1ncm4nOmcuc3RhdHVzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtnLnN0YXR1c308L3NwYW4+PC90ZD4KICAgPHRkPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ib3BlbkdhdGUoJyR7Zy5pZH0nKSI+UmV2aWV3PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gZ2F0ZXMgcmFpc2VkLiBOb3RoaW5nIGlzIGV4ZWN1dGluZy48L2Rpdj4nfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHJhaXNlR2F0ZSgpewogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ2F0ZScse3RpdGxlOmdUaXRsZS52YWx1ZS50cmltKCksY2xzOmdDbGFzcy52YWx1ZSxvYmo6Z09iai52YWx1ZS50cmltKCksCiAgICBqdXN0OmdKdXN0LnZhbHVlLnRyaW0oKSxzYWZlOmdTYWZlLnZhbHVlLnRyaW0oKSxyaXNrOmdSaXNrLnZhbHVlLGNvc3Q6K2dDb3N0LnZhbHVlfHwwLGFtdDorZ0FtdC52YWx1ZXx8MCxmcmVlOmdGcmVlLnZhbHVlLnRyaW0oKX0pOwogICByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytyLmlkKycgcmFpc2VkIMK3IGZyb3plbiBzZXJ2ZXItc2lkZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gb3BlbkdhdGUoaWQpewogIGNvbnN0IGc9Uy5nYXRlcy5maW5kKHg9PnguaWQ9PT1pZCk7CiAgY29uc3QgZmluQmxvY2s9Zy5jbHM9PT0nRklOQU5DSUFMIFRSQU5TRkVSJyYmIVMucGF5b3V0LCBjb3N0QmxvY2s9Zy5jb3N0PjA7CiAgbW9kYWwoYDxoMz4ke2VzYyhnLnRpdGxlKX08L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4ke2cuaWR9IMK3ICR7Zy5jbHN9IMK3IHJhaXNlZCAke2cudH08L2Rpdj4KICAke2ZpbkJsb2NrP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPjxiPkhBUkQgQkxPQ0suPC9iPiBGaW5hbmNpYWwgdHJhbnNmZXIgd2l0aCBubyBwYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRoZSBzZXJ2ZXIgd2lsbCByZWplY3QgYXBwcm92YWwuPC9kaXY+YDonJ30KICAke2Nvc3RCbG9jaz9gPGRpdiBjbGFzcz0id2FybmJveCI+PGI+WkVSTy1DT1NUIERPQ1RSSU5FIEZMQUcuPC9iPiBUaGlzIGRlbWFuZHMgJCR7Zy5jb3N0fS4gVGhlIENoYWlybWFuIGRvZXMgbm90IHBheS4gQXBwcm92aW5nIGlzIGFuIGV4cGxpY2l0IE93bmVyIG92ZXJyaWRlLiBGcmVlIHJvdXRlIG9uIHJlY29yZDogPGVtPiR7ZXNjKGcuZnJlZXx8J25vbmUnKX08L2VtPjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjEgwrcgT2JqZWN0aXZlPC9oMz48ZGl2PiR7ZXNjKGcub2JqKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MiDCtyBBZ2VudCBKdXN0aWZpY2F0aW9uPC9oMz48ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcCI+JHtlc2MoZy5qdXN0KX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MyDCtyBTYWZlZ3VhcmRzICZhbXA7IFJvbGxiYWNrPC9oMz48ZGl2PiR7ZXNjKGcuc2FmZSl9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48c3BhbiBjbGFzcz0idGFnICR7Zy5yaXNrPT09J0xPVyc/J3QtZ3JuJzondC1yZWQnfSI+QkxBU1QgJHtnLnJpc2t9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPkNPU1QgJHtnLmNvc3Q/JyQnK2cuY29zdDonJDAuMDAnfTwvc3Bhbj4KICAgJHtnLmFtdD9gPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+QVQgUklTSyAkJHtmbXQoZy5hbXQpfTwvc3Bhbj5gOicnfQogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5zdGF0dXM9PT0nQVBQUk9WRUQnPyd0LWdybic6Zy5zdGF0dXM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke2cuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAke2cuc3RhdHVzPT09J1BFTkRJTkcnP2A8ZGl2IGNsYXNzPSJlcnIiIGlkPSJnRXJyIj48L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siICR7ZmluQmxvY2s/J2Rpc2FibGVkJzonJ30gb25jbGljaz0iZGVjaWRlKCcke2cuaWR9JywxKSI+JHtjb3N0QmxvY2s/J09WRVJSSURFICZhbXA7IEFVVEhPUklaRSc6J0FVVEhPUklaRSBFWEVDVVRJT04nfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlY2lkZSgnJHtnLmlkfScsMCkiPkRFTlkgJmFtcDsgVEVSTUlOQVRFPC9idXR0b24+CiAgICR7Y29zdEJsb2NrP2A8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlcm91dGUoJyR7Zy5pZH0nKSI+UkVST1VURSBGUkVFPC9idXR0b24+YDonJ30KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YAogIDpgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0ibW9uby1kaW0iPlJlc29sdmVkICR7ZXNjKGcucmVzb2x2ZWR8fCcnKX08L3NwYW4+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YH1gKTsKfQphc3luYyBmdW5jdGlvbiBkZWNpZGUoaWQsb2spewogIGNvbnN0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dFcnInKTsgZS50ZXh0Q29udGVudD0nJzsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9nYXRlL2RlY2lkZScse2lkLG9rOiEhb2t9KTsKICAgIGNsb3NlTW9kYWwoKTsgcmVuZGVyKCk7IGZsYXNoKCdHYXRlICcraWQrJyByZXNvbHZlZCcpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2UgfQp9CmFzeW5jIGZ1bmN0aW9uIHJlcm91dGUoaWQpeyBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9yZXJvdXRlJyx7aWR9KTsgY2xvc2VNb2RhbCgpOyByZW5kZXIoKTsgZmxhc2goJ1Jlcm91dGVkIMK3ICQwLjAwJykgfQoKLyogLS0tLS0tLS0tLSBBR0VOVFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYWdlbnRzPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tbWlzc2lvbiBBZ2VudDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OYW1lPC9zcGFuPjxpbnB1dCBpZD0iYU5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkxlZGdlciBTZW50aW5lbCI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBpbGxhcjwvc3Bhbj48c2VsZWN0IGlkPSJhUGlsIiBjbGFzcz0iaW4iPiR7UElMTEFSUy5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iPiR7cC5pZH0gwrcgJHtwLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wZXJhdGlvbmFsIFNjb3BlPC9zcGFuPjx0ZXh0YXJlYSBpZD0iYVJvbGUiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGVybWl0dGVkIFRvb2xzIChjb21tYSBzZXBhcmF0ZWQpPC9zcGFuPjxpbnB1dCBpZD0iYVRvb2xzIiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db3N0IFBvbGljeTwvc3Bhbj48c2VsZWN0IGlkPSJhQ29zdCIgY2xhc3M9ImluIj4KICAgPG9wdGlvbj5GUkVFLVRJRVItT05MWTwvb3B0aW9uPjxvcHRpb24+U0VMRi1IT1NURUQtT05MWTwvb3B0aW9uPjxvcHRpb24+T1dORVItT1ZFUlJJREUtUEFJRDwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvbW1pc3Npb24oKSI+Q09NTUlTU0lPTiAmYW1wOyBCSU5EPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um9zdGVyIERpc3RyaWJ1dGlvbjwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKSxtPU1hdGgubWF4KDEsLi4uUy5mbG9vcnMubWFwKHg9PnguYWdlbnRzKSk7CiAgIHJldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmFjdGl2ZX0vJHtmLmFnZW50c308L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmFnZW50cy9tKjEwMH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWxsIGFnZW50cyBpbmhlcml0IHRoZSBaZXJvLUNvc3QgRG9jdHJpbmUgdW5sZXNzIHNldCB0byBPV05FUi1PVkVSUklERS1QQUlELjwvZGl2PjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkFjdGl2ZSBSb3N0ZXIgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke1MuYWdlbnRzLmZpbHRlcihhPT5hLnN0YXR1cz09PSdBQ1RJVkUnKS5sZW5ndGh9IEFDVElWRTwvc3Bhbj48L2gzPgogJHtTLmFnZW50cy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5BZ2VudDwvdGg+PHRoPkZsb29yPC90aD48dGg+VG9vbHM8L3RoPjx0aD5Db3N0PC90aD48dGg+U3RhdHVzPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogJHtTLmFnZW50cy5tYXAoYT0+e2NvbnN0IHA9UElMTEFSUy5maW5kKHg9PnguaWQ9PWEucGlsbGFySWQpO3JldHVybiBgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YS5pZH08L3RkPgogIDx0ZD48Yj4ke2VzYyhhLm5hbWUpfTwvYj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYS5yb2xlKX08L2Rpdj48L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7cC5jbHN9Ij4ke3AuaWNvbn0gJHthLnBpbGxhcklkfTwvc3Bhbj48L3RkPgogIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YS50b29scy5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHthLmNvc3Q9PT0nT1dORVItT1ZFUlJJREUtUEFJRCc/J3QtYW1iJzondC1ncm4nfSI+JHthLmNvc3R9PC9zcGFuPjwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHthLnN0YXR1cz09PSdBQ1RJVkUnPyd0LWdybic6J3QtZGltJ30iPiR7YS5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ic2hvd1lhbWwoJyR7YS5pZH0nKSI+WUFNTDwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZygnJHthLmlkfScpIj4ke2Euc3RhdHVzPT09J0FDVElWRSc/J1N1c3BlbmQnOidSZWluc3RhdGUnfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImtpbGwoJyR7YS5pZH0nKSI+S2lsbDwvYnV0dG9uPjwvdGQ+PC90cj5gfSkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPlJvc3RlciBlbXB0eS48L2Rpdj4nfTwvZGl2PmA7CmZ1bmN0aW9uIHlhbWxGb3IoYSl7Y29uc3QgcD1QSUxMQVJTLmZpbmQoeD0+eC5pZD09YS5waWxsYXJJZCk7CiByZXR1cm4gYEFnZW50X0RlZmluaXRpb246CiAgTmFtZTogIiR7YS5uYW1lfSIKICBQaWxsYXI6ICIke3AubmFtZX0iCiAgUm9sZTogIiR7YS5yb2xlfSIKICBQZXJtaXR0ZWRfVG9vbHM6IFske2EudG9vbHMubWFwKHQ9PmAiJHt0fSJgKS5qb2luKCcsICcpfV0KICBTdXBlcnZpc29yOiAiQ2hhaXJtYW4gQWdlbnQgT1MiCiAgQWdlbnRfSUQ6ICIke2EuaWR9IgogIENvc3RfUG9saWN5OiAiJHthLmNvc3R9IgogIENvbW1pc3Npb25lZDogIiR7YS50fSIKICBJbnN0cnVjdGlvbjogfAogICAgRXhlY3V0ZSB0YXNrcyBzdHJpY3RseSB3aXRoaW4gc2NvcGUuIFJlcG9ydCBhbGwgbG9ncywgYW5vbWFsaWVzIGFuZAogICAgY29tcGxldGlvbiBtZXRyaWNzIGRpcmVjdGx5IHRvIHRoZSBDaGFpcm1hbiB0ZXJtaW5hbC4gRG8gbm90IGF0dGVtcHQKICAgIHVuYXBwcm92ZWQgc2lkZSBlZmZlY3RzLgogICAgWkVSTy1DT1NUIERPQ1RSSU5FOiBuZXZlciBwdXJjaGFzZSwgc3Vic2NyaWJlLCBvciBjb25zdW1lIHBhaWQgY3JlZGl0cy4KICAgIElmIGEgdG9vbCwgc2l0ZSBvciBBUEkgZGVtYW5kcyBwYXltZW50LCBoYWx0LCBmaW5kIGEgZnJlZSwgb3Blbi1zb3VyY2UsCiAgICBzZWxmLWhvc3RlZCBvciBmcmVlLXRpZXIgZXF1aXZhbGVudCwgYW5kIHJlcG9ydCB0aGUgc3Vic3RpdHV0aW9uLgogICAgRXNjYWxhdGUgdG8gdGhlIENoYWlybWFuIG9ubHkgaWYgbm8gbGF3ZnVsIGZyZWUgcm91dGUgZXhpc3RzLgogICAgQW55IGRlcGxveW1lbnQsIHNjaGVtYSBjaGFuZ2UsIGNvZGUgbW9kaWZpY2F0aW9uIG9yIGZpbmFuY2lhbCB0cmFuc2ZlcgogICAgbXVzdCBiZSByYWlzZWQgYXMgYSBQZXJtaXNzaW9uIEdhdGUgYW5kIGZyb3plbiB1bnRpbCBPd25lciBjbGVhcmFuY2UuYH0KYXN5bmMgZnVuY3Rpb24gY29tbWlzc2lvbigpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2FnZW50Jyx7bmFtZTphTmFtZS52YWx1ZS50cmltKCkscGlsbGFySWQ6K2FQaWwudmFsdWUscm9sZTphUm9sZS52YWx1ZS50cmltKCksCiAgICB0b29sczphVG9vbHMudmFsdWUuc3BsaXQoJywnKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKSxjb3N0OmFDb3N0LnZhbHVlfSk7CiAgIHJlbmRlcigpOyBmbGFzaCgnQWdlbnQgYm91bmQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHNob3dZYW1sKGlkKXtjb25zdCBhPVMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKTsKIG1vZGFsKGA8aDM+JHtlc2MoYS5uYW1lKX08L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4ke2EuaWR9IMK3ICR7YS5zdGF0dXN9PC9kaXY+CiA8cHJlIGNsYXNzPSJ5YW1sIj4ke2VzYyh5YW1sRm9yKGEpKX08L3ByZT48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEzcHgiPgogPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvcHlZKCcke2EuaWR9JykiPkNvcHkgWUFNTDwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApfQpmdW5jdGlvbiBjb3B5WShpZCl7bmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KHlhbWxGb3IoUy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpKSk7Zmxhc2goJ1lBTUwgY29waWVkJyl9CmFzeW5jIGZ1bmN0aW9uIHRvZyhpZCl7YXdhaXQgQVBJKCcvYXBpL2FnZW50L3RvZ2dsZScse2lkfSk7cmVuZGVyKCl9CmFzeW5jIGZ1bmN0aW9uIGtpbGwoaWQpe2lmKCFjb25maXJtKCdEZWNvbW1pc3Npb24gJytpZCsnPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvYWdlbnQva2lsbCcse2lkfSk7cmVuZGVyKCk7Zmxhc2goJ0RlY29tbWlzc2lvbmVkJyl9CgovKiAtLS0tLS0tLS0tIE9SRyBDSEFSVCAtLS0tLS0tLS0tICovClJFTkRFUi5vcmdjaGFydD0oKT0+YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21tYW5kIERlcGVuZGVuY3kgR3JhcGg8L2gzPjxkaXYgY2xhc3M9InR3Ij4KIDxzdmcgdmlld0JveD0iMCAwIDkwMCA0MzAiIHN0eWxlPSJtaW4td2lkdGg6NzIwcHg7d2lkdGg6MTAwJSI+CiAgPGRlZnM+PG1hcmtlciBpZD0iYXIiIG1hcmtlcldpZHRoPSI5IiBtYXJrZXJIZWlnaHQ9IjkiIHJlZlg9IjgiIHJlZlk9IjMiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMMCw2IEw4LDMgeiIgZmlsbD0idmFyKC0tc3Ryb2tlMikiLz48L21hcmtlcj48L2RlZnM+CiAgPHJlY3QgeD0iMzE1IiB5PSIxNCIgd2lkdGg9IjI3MCIgaGVpZ2h0PSI1MiIgcng9IjEwIiBmaWxsPSJ2YXIoLS1nbGFzczIpIiBzdHJva2U9IiM3ODhBMUQiLz4KICA8dGV4dCB4PSI0NTAiIHk9IjM4IiBmaWxsPSIjNzg4QTFEIiBmb250LXNpemU9IjEzIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5DSEFJUk1BTiBBR0VOVDwvdGV4dD4KICA8dGV4dCB4PSI0NTAiIHk9IjU1IiBmaWxsPSIjNkI2RDYyIiBmb250LXNpemU9IjkuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RXhlY3V0aXZlIENvbW1hbmQgVG93ZXIgwrcgWmVyby1Db3N0IEF1dGhvcml0eTwvdGV4dD4KICAke1BJTExBUlMubWFwKChwLGkpPT57Y29uc3QgeT0xMDQraSo2NCxmPWZsb29yKHAuaWQpO3JldHVybiBgCiAgIDxwYXRoIGQ9Ik00NTAsNjYgQzQ1MCwke3ktMjB9IDI1MCwke3ktMjB9IDI1MCwke3krMTh9IiBzdHJva2U9InZhcigtLXN0cm9rZTIpIiBmaWxsPSJub25lIiBtYXJrZXItZW5kPSJ1cmwoI2FyKSIvPgogICA8cmVjdCB4PSIyNTAiIHk9IiR7eX0iIHdpZHRoPSI0MDAiIGhlaWdodD0iNDYiIHJ4PSI5IiBmaWxsPSJ2YXIoLS1wYW5lbCkiIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9Ii43Ii8+CiAgIDx0ZXh0IHg9IjI2OCIgeT0iJHt5KzIwfSIgZmlsbD0idmFyKC0tdHh0KSIgZm9udC1zaXplPSIxMS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AuaWNvbn0gJHtwLmlkfS4gJHtwLm5hbWV9PC90ZXh0PgogICA8dGV4dCB4PSIyNjgiIHk9IiR7eSszNX0iIGZpbGw9IiM2QjZENjIiIGZvbnQtc2l6ZT0iOSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLnVuaXRzfTwvdGV4dD4KICAgPHRleHQgeD0iNjMyIiB5PSIke3krMjh9IiBmaWxsPSIke3AuY29sb3J9IiBmb250LXNpemU9IjEwIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiB0ZXh0LWFuY2hvcj0iZW5kIj4ke2YuYWdlbnRzfSBhZ3QgwrcgJHtmLmhlYWx0aH0lPC90ZXh0PmB9KS5qb2luKCcnKX0KICA8cGF0aCBkPSJNNjYwLDEyNyBDNzUwLDEyNyA3NTAsNDE1IDQ3MCw0MTUiIHN0cm9rZT0idmFyKC0tc3Ryb2tlMikiIGZpbGw9Im5vbmUiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIgbWFya2VyLWVuZD0idXJsKCNhcikiLz4KICA8dGV4dCB4PSI3MDUiIHk9IjI4NSIgZmlsbD0iIzlBOUM5MCIgZm9udC1zaXplPSI5LjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPmluc2lnaHQg4oaSIHRvd2VyPC90ZXh0Pjwvc3ZnPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkVzY2FsYXRpb24gTGF3PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+RXNjYWxhdGlvbiBpcyB1cHdhcmQgb25seS4gTm8gbGF0ZXJhbCBmbG9vci10by1mbG9vciBjb21tYW5kIHdpdGhvdXQgYSBDaGFpcm1hbiBnYXRlLjwvbGk+CiAgPGxpPlNlY3VyaXR5ICZhbXA7IEF1ZGl0IGhvbGRzIHZldG8gb3ZlciB0aGUgcmVtYWluaW5nIGZvdXIgZmxvb3JzIGFuZCBtYXkgZnJlZXplIGFueSBnYXRlIG1pZC1mbGlnaHQuPC9saT4KICA8bGk+Tm8gcGF0aCBleGlzdHMgZnJvbSBhIHB1YmxpYyB1c2VyIHRvIGEgZmxvb3IuIEV2ZXJ5IHJvdXRlIHRlcm1pbmF0ZXMgYXQgdGhlIENoYWlybWFuLjwvbGk+CiAgPGxpPkFueSBhZ2VudCBtZWV0aW5nIGEgcGF5d2FsbCBoYWx0cyBhbmQgcmVwb3J0cyB1cHdhcmQg4oCUIGl0IG5ldmVyIHNwZW5kcy48L2xpPjwvdWw+PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gU0tJTExTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNraWxscz0oKT0+e2NvbnN0IG09e307Uy5hZ2VudHMuZm9yRWFjaChhPT5hLnRvb2xzLmZvckVhY2godD0+eyhtW3RdPW1bdF18fFtdKS5wdXNoKGEubmFtZSl9KSk7CiBjb25zdCBrPU9iamVjdC5rZXlzKG0pLnNvcnQoKTsKIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRvb2wgU3VyZmFjZSA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7ay5sZW5ndGh9IERJU1RJTkNUPC9zcGFuPjwvaDM+CiA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+RXZlcnkgdG9vbCBpcyBib3VuZCB0byBhdCBsZWFzdCBvbmUgYWdlbnQgYW5kIGNvbnN0cmFpbmVkIGJ5IHRoYXQgYWdlbnQncyBjb3N0IHBvbGljeS4gVW5ib3VuZCBpbnZvY2F0aW9uIGlzIGFuIHVuYXBwcm92ZWQgc2lkZSBlZmZlY3QuPC9kaXY+CiA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRvb2w8L3RoPjx0aD5Cb3VuZCBBZ2VudHM8L3RoPjx0aD5FeHBvc3VyZTwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICR7ay5tYXAodD0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2ModCl9PC9iPjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttW3RdLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke21bdF0ubGVuZ3RoPjI/J3QtYW1iJzondC1ncm4nfSI+JHttW3RdLmxlbmd0aD4yPydXSURFJzonTkFSUk9XJ308L3NwYW4+PC90ZD48L3RyPmApLmpvaW4oJycpfHwnPHRyPjx0ZCBjb2xzcGFuPSIzIiBjbGFzcz0ibW9uby1kaW0iPm5vbmU8L3RkPjwvdHI+J30KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfTsKCi8qIC0tLS0tLS0tLS0gWkVSTyBDT1NUIC0tLS0tLS0tLS0gKi8KUkVOREVSLnplcm9jb3N0PSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNTEwMGEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4oiFIFpFUk8tQ09TVCBET0NUUklORSDCtyBBQlNPTFVURTwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5UaGUgQ2hhaXJtYW4gZG9lcyBub3QgcGF5LjwvYj4gTm8gc3Vic2NyaXB0aW9ucywgbm8gY3JlZGl0IHRvcC11cHMsIG5vIG1ldGVyZWQgQVBJIHB1cmNoYXNlcywgbm8gY29udmVydGluZyB0cmlhbHMuPC9saT4KICAgPGxpPkhpdHRpbmcgYSBwYXl3YWxsLCBhbiBhZ2VudCA8Yj5oYWx0czwvYj4sIGZpbmRzIGEgZnJlZSAvIG9wZW4tc291cmNlIC8gc2VsZi1ob3N0ZWQgLyBmcmVlLXRpZXIgZXF1aXZhbGVudCwgYW5kIHJlcG9ydHMgdGhlIHN1YnN0aXR1dGlvbi48L2xpPgogICA8bGk+Tm8gZnJlZSByb3V0ZSDih5IgdGhlIENoYWlybWFuIHN0YXRlcyBwbGFpbmx5IHRoZSBvYmplY3RpdmUgaXMgdW5yZWFjaGFibGUgYXQgemVybyBjb3N0LiBJdCBuZXZlciBxdWlldGx5IHNwZW5kcy48L2xpPgogICA8bGk+RnJlZS10aWVyIHJvdGF0aW9uIGFuZCBxdW90YSBtYW5hZ2VtZW50IGFyZSBsZWdpdGltYXRlLiBGcmF1ZCwgc3RvbGVuIGtleXMsIGxpY2VuY2UgdmlvbGF0aW9uIGFuZCBUb1MgY2lyY3VtdmVudGlvbiBhcmUgPGI+cmVmdXNlZCBvdXRyaWdodDwvYj4gYW5kIGxvZ2dlZCBDUklULjwvbGk+CiAgIDxsaT5Pd25lciBtYXkgb3ZlcnJpZGUgcGVyLWdhdGUuIE92ZXJyaWRlcyBoaXQgYSB2aXNpYmxlIHNwZW5kIGNvdW50ZXIsIG5ldmVyIGhpZGRlbi48L2xpPgogICA8bGk+PGI+UHJvb2YsIG5vdCBzbG9nYW46PC9iPiB0aGlzIGJhY2tlbmQgcnVucyBvbiBOb2RlIGNvcmUgbW9kdWxlcyBvbmx5IOKAlCAwIG5wbSBwYWNrYWdlcywgMCBwYWlkIHNlcnZpY2VzLCAwIEFQSSBrZXlzLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPgogICR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ0F1dGhvcml6ZWQgU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnTGlmZXRpbWUnKX0KICAke2twaShTLmRlbmlhbHMubGVuZ3RoLCdQYWlkIFBhdGhzIEludGVyY2VwdGVkJywndmFyKC0tYW1iKScsJ0Jsb2NrZWQgb3IgcmVyb3V0ZWQnKX0KICAke2twaSgnJCcrUy5kZW5pYWxzLnJlZHVjZSgoYSxiKT0+YStiLmNvc3QsMCkudG9GaXhlZCgyKSwnU3BlbmQgQXZvaWRlZCcsJ3ZhcigtLWdybiknLCdEb2N0cmluZSBzYXZpbmdzJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U3Vic3RpdHV0aW9uIFJvdXRpbmcgVGFibGU8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgPHRoZWFkPjx0cj48dGg+UGFpZCBEZW1hbmQ8L3RoPjx0aD5GcmVlIFJvdXRlPC90aD48dGg+T3duaW5nIEFnZW50PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7RlJFRV9ST1VURVMubWFwKChbYSxiLGNdKT0+YDx0cj48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+JHtlc2MoYSl9PC9zcGFuPjwvdGQ+PHRkPiR7ZXNjKGIpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkludGVyY2VwdGlvbiBMb2c8L2gzPiR7Uy5kZW5pYWxzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+T3BlcmF0aW9uPC90aD48dGg+RGVtYW5kZWQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtbLi4uUy5kZW5pYWxzXS5yZXZlcnNlKCkubWFwKGQ9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtkLnR9PC90ZD48dGQ+JHtlc2MoZC5vcCl9PC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiQke2QuY29zdH08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHBhaWQgZGVtYW5kcyBlbmNvdW50ZXJlZCB5ZXQuPC9kaXY+J308L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBGSU5BTkNFUyAtLS0tLS0tLS0tICovClJFTkRFUi5maW5hbmNlcz0oKT0+ewogY29uc3QgdG90PVMucmV2ZW51ZS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCksaW5mbG93PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkucmVkdWNlKChhLGIpPT5hK2IuYW10LDApOwogcmV0dXJuIGAkeyFTLnBheW91dD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5TQUZFIE1PREU8L2gzPgogIDxkaXY+Tm8gcGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUaGUgc2VydmVyIHJlamVjdHMgYXBwcm92YWwgb24gZXZlcnkgdHJhbnNmZXIgZ2F0ZS4gQ29uZmlndXJlIHRoZSBWYXVsdCBmaXJzdC48L2Rpdj48L2Rpdj5gOicnfQogPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCI+CiAgJHtrcGkoJyQnK2ZtdChpbmZsb3cpLCdSZWNvcmRlZCBJbmZsb3cnLCd2YXIoLS1ncm4pJyl9CiAgJHtrcGkoJyQnK2ZtdCh0b3QpLCdOZXQgUG9zaXRpb24nLHRvdDwwPyd2YXIoLS1tYWcpJzondmFyKC0tdHh0KScpfQogICR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ1RvdGFsIFNwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ1RhcmdldCAkMC4wMCcpfQogICR7a3BpKFMucmV2ZW51ZS5sZW5ndGgsJ0xlZGdlciBMaW5lcycsJ3ZhcigtLWJsdSknKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZWNvcmQgUmV2ZW51ZSBTdHJlYW08L2gzPjxkaXYgY2xhc3M9ImdyaWQgZzMiPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U291cmNlPC9zcGFuPjxpbnB1dCBpZD0iclNyYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iUHJlbWl1bSBjcmVkaXRzIMK3IGFwcC5leGFtcGxlIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW1vdW50IFVTRDwvc3Bhbj48aW5wdXQgaWQ9InJBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Jm5ic3A7PC9zcGFuPjxidXR0b24gY2xhc3M9ImJ0biBwIiBzdHlsZT0id2lkdGg6MTAwJSIgb25jbGljaz0iYWRkUmV2KCkiPlBPU1QgVE8gTEVER0VSPC9idXR0b24+PC9sYWJlbD48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXF1ZXN0IFBheW91dDwvaDM+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+UmFpc2VzIGEgRklOQU5DSUFMIFRSQU5TRkVSIGdhdGUuIFJlcXVpcmVzIHNlYWxlZCBjaGFubmVsICsgcGFzc3dvcmQgc2lnbmF0dXJlLiAyRkEgdGFyZ2V0ICR7bWFza01haWwoUy5vd25lci5lbWFpbCl9LjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGlkPSJwQW10IiBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjAwcHgiIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IkFtb3VudCBVU0QiPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyZXFQYXlvdXQoKSI+UkFJU0UgVFJBTlNGRVIgR0FURTwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJldmVudWUgTGVkZ2VyPC9oMz4ke1MucmV2ZW51ZS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlNvdXJjZTwvdGg+PHRoIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij5BbW91bnQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtbLi4uUy5yZXZlbnVlXS5yZXZlcnNlKCkubWFwKHI9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtyLnR9PC90ZD48dGQ+JHtlc2Moci5zcmMpfTwvdGQ+CiAgPHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0O2NvbG9yOiR7ci5hbXQ8MD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHtyLmFtdDwwPyctJzonKyd9JCR7Zm10KE1hdGguYWJzKHIuYW10KSl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdHJlYW1zIHJlY29yZGVkLjwvZGl2Pid9PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIGFkZFJldigpe3RyeXthd2FpdCBBUEkoJy9hcGkvcmV2ZW51ZScse3NyYzpyU3JjLnZhbHVlLnRyaW0oKSxhbXQ6K3JBbXQudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnUG9zdGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHJlcVBheW91dCgpe3RyeXthd2FpdCBBUEkoJy9hcGkvcGF5b3V0L3JlcXVlc3QnLHthbXQ6K3BBbXQudmFsdWV9KTtnbygnZ2F0ZXMnKTtmbGFzaCgnVHJhbnNmZXIgZ2F0ZSByYWlzZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KCi8qIC0tLS0tLS0tLS0gVkFVTFQgLS0tLS0tLS0tLSAqLwpSRU5ERVIucGF5b3V0PSgpPT5gCiA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5Jc29sYXRlZCBPd25lci1vbmx5IHBhbmVsLiBSYXcgdmFsdWVzIGFyZSBzZW50IG9uY2Ugb3ZlciB0aGUgc2Vzc2lvbiwgbWFza2VkIGltbWVkaWF0ZWx5LCBhbmQgPGI+bmV2ZXIgcGVyc2lzdGVkIG9yIHJldHVybmVkPC9iPiDigJQgb25seSB0aGUgbWFza2VkIHZpZXcgYW5kIGEgU0hBLTI1NiBmaW5nZXJwcmludCBhcmUgc3RvcmVkLiBUaGUgQ2hhaXJtYW4gd2lsbCBuZXZlciByZXF1ZXN0IHRoZXNlIGFueXdoZXJlIGVsc2UuPC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhbm5lbCBDb25maWd1cmF0aW9uPC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5NZXRob2Q8L3NwYW4+PHNlbGVjdCBpZD0idlR5cGUiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InZTd2FwKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iQkFOSyI+QmFuayBXaXJlIChTV0lGVC9JQkFOKTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IkNSWVBUTyI+Q3J5cHRvIEFkZHJlc3M8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJlbmVmaWNpYXJ5IE5hbWU8L3NwYW4+PGlucHV0IGlkPSJ2TmFtZSIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGlkPSJ2QmFuayI+PGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QWNjb3VudCBOdW1iZXI8L3NwYW4+PGlucHV0IGlkPSJ2QWNjIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPklCQU48L3NwYW4+PGlucHV0IGlkPSJ2SWJhbiIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TV0lGVCAvIEJJQzwvc3Bhbj48aW5wdXQgaWQ9InZTd2lmdCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CYW5rICZhbXA7IENvdW50cnk8L3NwYW4+PGlucHV0IGlkPSJ2QmFua05hbWUiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiAgPGRpdiBpZD0idkNyeXB0byIgY2xhc3M9ImhpZGUiPjxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldHdvcms8L3NwYW4+PGlucHV0IGlkPSJ2TmV0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJCVEMgLyBFVEggLyBUUk9OIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBheW91dCBBZGRyZXNzPC9zcGFuPjxpbnB1dCBpZD0idkFkZHIiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QZXItVHJhbnNmZXIgQ2VpbGluZyAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9InZDYXAiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iMjUwMDAiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2VhbFZhdWx0KCkiPlNFQUwgQ0hBTk5FTDwvYnV0dG9uPgogICR7Uy5wYXlvdXQ/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VWYXVsdCgpIj5QdXJnZSBDaGFubmVsPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TZWFsZWQgQ2hhbm5lbDwvaDM+JHtTLnBheW91dD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgJHtPYmplY3QuZW50cmllcyhTLnBheW91dC5tYXNrZWQpLm1hcCgoW2ssdl0pPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+JHtlc2Moayl9PC90ZD48dGQ+JHtlc2Modil9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TZWFsZWQ8L3RkPjx0ZD4ke1MucGF5b3V0LnR9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4yRkEgVGFyZ2V0PC90ZD48dGQ+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L3RkPjwvdHI+PC90Ym9keT48L3RhYmxlPjwvZGl2PmAKIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBDSEFOTkVMIFNFQUxFRCDigJQgZW5naW5lIFNBRkUgTU9ERS48L2Rpdj4nfTwvZGl2PmA7CmZ1bmN0aW9uIHZTd2FwKCl7Y29uc3QgYz12VHlwZS52YWx1ZT09PSdDUllQVE8nO3ZCYW5rLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLGMpO3ZDcnlwdG8uY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsIWMpfQphc3luYyBmdW5jdGlvbiBzZWFsVmF1bHQoKXsKIGNvbnN0IGI9e3R5cGU6dlR5cGUudmFsdWUsbmFtZTp2TmFtZS52YWx1ZS50cmltKCksY2FwOit2Q2FwLnZhbHVlfHwwLAogIGFjYzp2QWNjPy52YWx1ZS50cmltKCksaWJhbjp2SWJhbj8udmFsdWUudHJpbSgpLHN3aWZ0OnZTd2lmdD8udmFsdWUudHJpbSgpLGJhbms6dkJhbmtOYW1lPy52YWx1ZS50cmltKCksCiAgbmV0OnZOZXQ/LnZhbHVlLnRyaW0oKSxhZGRyOnZBZGRyPy52YWx1ZS50cmltKCl9OwogdHJ5e2F3YWl0IEFQSSgnL2FwaS92YXVsdCcsYik7cmVuZGVyKCk7Zmxhc2goJ0NoYW5uZWwgc2VhbGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHB1cmdlVmF1bHQoKXtpZighY29uZmlybSgnUHVyZ2UgY2hhbm5lbD8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL3ZhdWx0L3B1cmdlJyk7cmVuZGVyKCk7Zmxhc2goJ1B1cmdlZCcpfQoKLyogLS0tLS0tLS0tLSBBTkFMWVRJQ1MgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYW5hbHl0aWNzPSgpPT57CiBjb25zdCBzZXY9e0lORk86MCxPSzowLFdBUk46MCxDUklUOjB9O1MubG9ncy5mb3JFYWNoKGw9PnNldltsLnNldl09KHNldltsLnNldl18fDApKzEpOwogY29uc3QgbXg9TWF0aC5tYXgoMSwuLi5PYmplY3QudmFsdWVzKHNldikpOwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5FdmVudCBTZXZlcml0eSBNaXg8L2gzPiR7T2JqZWN0LmVudHJpZXMoc2V2KS5tYXAoKFtrLHZdKT0+YDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxzcGFuPiR7a308L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3Z9PC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHt2L214KjEwMH0lO2JhY2tncm91bmQ6JHt7SU5GTzonIzNiODJmNicsT0s6JyMzMWQ2N2EnLFdBUk46JyNmZmIwMjAnLENSSVQ6JyNmZjNiNmInfVtrXX0iPjwvaT48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIE91dGNvbWVzPC9oMz4ke1snUEVORElORycsJ0FQUFJPVkVEJywnREVOSUVEJ10ubWFwKHM9Pntjb25zdCBjPVMuZ2F0ZXMuZmlsdGVyKGc9Pmcuc3RhdHVzPT09cykubGVuZ3RoOwogIHJldHVybiBgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47cGFkZGluZzo3cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMTAxODIyIj4KICA8c3BhbiBjbGFzcz0idGFnICR7cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtzfTwvc3Bhbj48Yj4ke2N9PC9iPjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QXBwcm92YWwgcmF0ZSBpcyBtZWFuaW5nbGVzcyB3aXRob3V0IGRlbmlhbCBwcmVzc3VyZS4gSWYgbm90aGluZyBpcyBldmVyIGRlbmllZCwgdGhlIGdhdGUgaXMgdGhlYXRyZS48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5GbG9vciBIZWFsdGggPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5MSVZFPC9zcGFuPjwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTtyZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuaGVhbHRofSU8L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuaGVhbHRofSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvc3QgRGlzY2lwbGluZTwvaDM+JHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyl9CiAgPGRpdiBzdHlsZT0iaGVpZ2h0OjEwcHgiPjwvZGl2PiR7a3BpKCckJytTLmRlbmlhbHMucmVkdWNlKChhLGIpPT5hK2IuY29zdCwwKS50b0ZpeGVkKDIpLCdBdm9pZGVkJywndmFyKC0tZ3JuKScpfTwvZGl2PgogPC9kaXY+YH07CgovKiAtLS0tLS0tLS0tIEFVRElUIC0tLS0tLS0tLS0gKi8KUkVOREVSLmF1ZGl0PSgpPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbToxMXB4Ij4KIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtTLmxvZ3MubGVuZ3RofSBlbnRyaWVzIHNob3duIMK3IHBlcnNpc3RlZCBzZXJ2ZXItc2lkZTwvc3Bhbj4KIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJleHBvcnRMb2coKSI+RXhwb3J0IEpTT048L2J1dHRvbj4KIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icHVyZ2VMb2dzKCkiPlB1cmdlPC9idXR0b24+PC9kaXY+PC9kaXY+JHtsb2dIdG1sKDQwMCl9PC9kaXY+YDsKZnVuY3Rpb24gZXhwb3J0TG9nKCl7Y29uc3QgYj1uZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkoUy5sb2dzLG51bGwsMildLHt0eXBlOidhcHBsaWNhdGlvbi9qc29uJ30pLHU9VVJMLmNyZWF0ZU9iamVjdFVSTChiKSxhPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTsKIGEuaHJlZj11O2EuZG93bmxvYWQ9J2NoYWlybWFuLWF1ZGl0LScrRGF0ZS5ub3coKSsnLmpzb24nO2EuY2xpY2soKTtVUkwucmV2b2tlT2JqZWN0VVJMKHUpO2ZsYXNoKCdFeHBvcnRlZCcpfQphc3luYyBmdW5jdGlvbiBwdXJnZUxvZ3MoKXtpZighY29uZmlybSgnUHVyZ2UgbGVkZ2VyPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvbG9ncy9wdXJnZScpO3JlbmRlcigpfQoKLyogLS0tLS0tLS0tLSBBUkNISVRFQ1Q6IHN0dWR5IGEgcHJvZHVjdCwgcmVidWlsZCB0aGUgY2FwYWJpbGl0eSAtLS0tLS0tLS0tICovCkxJVkUuYXJjaD0oKT0+ewogIGNvbnN0IEE9Uy5hbmFseXNlc3x8W10sIEM9Uy5jcmV3c3x8W107CiAgaWYoIUEubGVuZ3RoKSByZXR1cm4gJzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIHN0dWRpZWQgeWV0LiBQYXN0ZSBhIFVSTCBhYm92ZS48L2Rpdj48L2Rpdj4nOwogIHJldHVybiBBLm1hcChhPT57CiAgICBjb25zdCBjcmV3PUMuZmluZChjPT5jLmFuYWx5c2lzSWQ9PT1hLmlkKTsKICAgIGNvbnN0IHZjID0gYS52ZXJkaWN0PT09J1JFQlVJTERBQkxFJz8ndC1ncm4nOmEudmVyZGljdD09PSdQQVJUSUFMJz8ndC1hbWInOid0LXJlZCc7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHthLnZlcmRpY3Q9PT0nUkVCVUlMREFCTEUnPyd2YXIoLS1saW1lKSc6CiAgICAgICAgYS52ZXJkaWN0PT09J1BBUlRJQUwnPyd2YXIoLS1hbWIpJzondmFyKC0tbWFnKSd9Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke3ZjfSI+JHtlc2MoYS52ZXJkaWN0KX08L3NwYW4+CiAgICAgICA8Yj4ke2VzYyhhLnVybCl9PC9iPjwvZGl2PgogICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7YS50fSR7YS5wYWdlUmVhZD8nJzonIMK3IHBhZ2Ugbm90IHJlYWRhYmxlJ308L3NwYW4+PC9kaXY+CiAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48Yj5XaGF0IGl0IGRvZXM6PC9iPiAke2VzYyhhLmRvZXMpfTwvZGl2PgogICAgICR7YS5qb2JzLmxlbmd0aD9gPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJtb25vLWRpbSI+VEhFIEpPQlMgSVQgUEVSRk9STVM8L2Rpdj4KICAgICAgIDxvbCBzdHlsZT0ibWFyZ2luOjVweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHg7Zm9udC1zaXplOjEyLjVweDtsaW5lLWhlaWdodDoxLjciPgogICAgICAgJHthLmpvYnMubWFwKGo9PmA8bGk+JHtlc2Moail9PC9saT5gKS5qb2luKCcnKX08L29sPjwvZGl2PmA6Jyd9CiAgICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgICR7YS5yZXVzZS5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPkFnZW50cyBoZSBhbHJlYWR5IGhhczwvdGQ+CiAgICAgICAgPHRkPiR7YS5yZXVzZS5tYXAocj0+YDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPiR7ZXNjKHIuY2FwKX08L3NwYW4+IDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5mb3IpfTwvc3Bhbj5gKS5qb2luKCc8YnI+Jyl9PC90ZD48L3RyPmA6Jyd9CiAgICAgICR7YS5idWlsZC5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5NdXN0IGJlIHdyaXR0ZW48L3RkPgogICAgICAgIDx0ZD4ke2EuYnVpbGQubWFwKGI9PmA8Yj4ke2VzYyhiLm5hbWUpfTwvYj4g4oCUICR7ZXNjKGIuZGVzYyl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGIud2h5X25lZWRlZHx8JycpfTwvZGl2PmApLmpvaW4oJzxicj4nKX08L3RkPjwvdHI+YDonJ30KICAgICAgJHthLm5lZWRzQ29ubmVjdG9yLmxlbmd0aD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk5lZWRzIGEgY29ubmVjdG9yPC90ZD4KICAgICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2EubmVlZHNDb25uZWN0b3IubWFwKGVzYykuam9pbignLCAnKX08L3RkPjwvdHI+YDonJ30KICAgICAgJHthLmNhbm5vdERvLmxlbmd0aD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkhvbmVzdGx5IGNhbm5vdCBkbzwvdGQ+CiAgICAgICAgPHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2EuY2Fubm90RG8ubWFwKGVzYykuam9pbignPGJyPicpfTwvdGQ+PC90cj5gOicnfQogICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICAke2Eubm90ZT9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGI+SGlzIHZlcmRpY3Q6PC9iPiAke2VzYyhhLm5vdGUpfTwvZGl2PmA6Jyd9CiAgICAgJHtjcmV3P2A8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjExcHg7cGFkZGluZzoxMXB4O2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXItcmFkaXVzOjExcHgiPgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPkNSRVcgQVNTRU1CTEVEPC9kaXY+CiAgICAgICA8ZGl2PiR7Y3Jldy5yZXVzZS5sZW5ndGh9IGV4aXN0aW5nIGFnZW50KHMpIHJldXNlZCR7Y3Jldy5idWlsdC5sZW5ndGg/YCwgJHtjcmV3LmJ1aWx0Lmxlbmd0aH0gbmV3IHdyaXR0ZW46IDxiPiR7Y3Jldy5idWlsdC5tYXAoZXNjKS5qb2luKCcsICcpfTwvYj5gOicnfTwvZGl2PgogICAgICAgJHtjcmV3LmJ1aWx0Lmxlbmd0aD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweCI+TmV3IG9uZXMgYXJlIHdhaXRpbmcgZm9yIHlvdXIgdGljayBvbiBUaGUgQ2hhaXJtYW4gcGFnZS48L2Rpdj4nOicnfQogICAgICAgJHtjcmV3LnNraXBwZWQubGVuZ3RoP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYik7bWFyZ2luLXRvcDo1cHgiPlNraXBwZWQ6ICR7Y3Jldy5za2lwcGVkLm1hcChlc2MpLmpvaW4oJzsgJyl9PC9kaXY+YDonJ30KICAgICAgPC9kaXY+YDpgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij4KICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhc3NlbWJsZSgnJHthLmlkfScpIj5CVUlMRCBUSEUgQ1JFVzwvYnV0dG9uPgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybUFuYWx5c2lzKCcke2EuaWR9JykiPkRpc2NhcmQ8L2J1dHRvbj48L2Rpdj5gfQogICAgPC9kaXY+YDsKICB9KS5qb2luKCcnKTsKfTsKUkVOREVSLmFyY2g9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7ip4kgQ09QWSBBTlkgUFJPRFVDVCDigJQgdGhlIGxlZ2FsIHdheTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5QYXN0ZSBhbnkgd2Vic2l0ZSBvciB0b29sLiBIZSByZWFkcyBpdCwgd29ya3Mgb3V0IDxiPnRoZSBqb2IgaXQgZG9lczwvYj4sIHRoZW4gcmVidWlsZHMgdGhhdCBjYXBhYmlsaXR5IGZyb20gaGlzIG93biBhZ2VudHMg4oCUIHJldXNpbmcgd2hhdCBoZSBoYXMsIHdyaXRpbmcgb25seSB3aGF0IGlzIG1pc3NpbmcuPC9kaXY+CiAgPGRpdiBjbGFzcz0id2FybmJveCI+PGI+SGUgcmVidWlsZHMgdGhlIG91dGNvbWUsIG5ldmVyIHRoZSBjb2RlLjwvYj4gQ29weWluZyBzb21lb25lJ3Mgc291cmNlIGlzIHBpcmFjeSBhbmQgZ2V0cyB5b3Ugc3VlZC4gQnVpbGRpbmcgYSB0b29sIHRoYXQgZG9lcyB0aGUgc2FtZSBqb2IgaXMgaG93IGV2ZXJ5IGNvbXBldGl0b3IgaW4gaGlzdG9yeSBoYXMgYmVlbiBtYWRlIOKAlCBjb21wbGV0ZWx5IGxlZ2FsLCBhbmQgaXQgbWVhbnMgeW91IG93biB3aGF0IHlvdSBidWlsZC48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPlJldXNlcyBleGlzdGluZyBhZ2VudHMgZmlyc3QuIEhlIG9ubHkgd3JpdGVzIG5ldyBjb2RlIHdoZW4gbm90aGluZyBjb3ZlcnMgdGhlIGpvYi48L2xpPgogICA8bGk+QWdlbnRzIHdvcmsgYWNyb3NzIGpvYnMsIGxpa2Ugc3RhZmYgbW92aW5nIGJldHdlZW4gYnJhbmNoZXMuPC9saT4KICAgPGxpPkhlIHN0YXRlcyBwbGFpbmx5IHdoYXQgPGI+Y2Fubm90PC9iPiBiZSByZWJ1aWx0IGZyZWUg4oCUIEdQVXMsIGxpY2VuY2VzLCBkYXRhc2V0cywgaHVtYW4ganVkZ2VtZW50LjwvbGk+CiAgPC91bD4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxkaXYgY2xhc3M9ImdyaWQgZzIiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldlYnNpdGUgb3IgcHJvZHVjdDwvc3Bhbj4KICAgIDxpbnB1dCBpZD0iYXJVcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vdXB0aW1lcm9ib3QuY29tIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFueXRoaW5nIGhlIHNob3VsZCBrbm93IChvcHRpb25hbCk8L3NwYW4+CiAgICA8aW5wdXQgaWQ9ImFySGludCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iSSBvbmx5IGNhcmUgYWJvdXQgdGhlIGFsZXJ0aW5nIHBhcnQiPjwvbGFiZWw+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYW5hbHlzZSgpIj5TVFVEWSBJVDwvYnV0dG9uPgogICAke1snaHR0cHM6Ly91cHRpbWVyb2JvdC5jb20nLCdodHRwczovL21haWxjaGltcC5jb20nLCdodHRwczovL2J1ZmZlci5jb20nLCdodHRwczovL2NhbGVuZGx5LmNvbSddCiAgICAgLm1hcCh1PT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJhclVybC52YWx1ZT0nJHt1fSc7YW5hbHlzZSgpIj4ke3UucmVwbGFjZSgnaHR0cHM6Ly8nLCcnKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5UYWtlcyBhYm91dCAzMCBzZWNvbmRzIOKAlCBoZSByZWFkcyB0aGVpciBwYWdlIGFuZCBzZWFyY2hlcyB3aGF0IHVzZXJzIHNheS48L2Rpdj4KIDwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImFyY2giPiR7TElWRS5hcmNoKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gYW5hbHlzZSgpewogIGNvbnN0IHU9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhclVybCcpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF1LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdQYXN0ZSBhIFVSTCBmaXJzdCcpOwogIGZsYXNoKCdTdHVkeWluZyBpdCDigJQgcmVhZGluZyB0aGVpciBwYWdlIGFuZCBzZWFyY2hpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2FyY2hpdGVjdC9hbmFseXNlJyx7dXJsOnUsaGludDooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FySGludCcpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnVmVyZGljdDogJytyLnZlcmRpY3QpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gYXNzZW1ibGUoaWQpewogIGZsYXNoKCdCdWlsZGluZyB0aGUgY3JldyDigJQgd3JpdGluZyBhbnkgbWlzc2luZyBhZ2VudHPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2FyY2hpdGVjdC9hc3NlbWJsZScse2lkfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5yZXVzZWQrJyByZXVzZWQsICcrci5idWlsdCsnIHdyaXR0ZW4nKyhyLmJ1aWx0Pycg4oCUIHRpY2sgdGhlbSB0byBpbnN0YWxsJzonJykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcm1BbmFseXNpcyhpZCl7IGF3YWl0IEFQSSgnL2FwaS9hcmNoaXRlY3QvcmVtb3ZlJyx7aWR9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBXT1JLU1BBQ0U6IGZpbGVzIGluLCB3cml0aW5nIG91dCAtLS0tLS0tLS0tICovCmNvbnN0IEtJTkRTPVtbJ2VtYWlsJywnRW1haWwnXSxbJ3doYXRzYXBwJywnV2hhdHNBcHAnXSxbJ3JlcGx5JywnUmVwbHkgdG8gYSBtZXNzYWdlJ10sCiAgICAgICAgICAgICBbJ3Byb3Bvc2FsJywnUHJvcG9zYWwnXSxbJ2ludm9pY2UnLCdJbnZvaWNlJ10sWydzdW1tYXJ5JywnU3VtbWFyeSddLFsnZG9jJywnRG9jdW1lbnQnXV07CkxJVkUud29yazI9KCk9PnsKICBjb25zdCBEPVMuZG9jc3x8W10sIFI9Uy5kcmFmdHN8fFtdOwogIHJldHVybiBgJHtELmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPllvdXIgRmlsZXMgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtELmxlbmd0aH08L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5GaWxlPC90aD48dGg+UmVhZDwvdGg+PHRoPlNpemU8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7RC5tYXAoZD0+YDx0cj48dGQ+PGI+JHtlc2MoZC5uYW1lKX08L2I+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQucHJldmlldykuc2xpY2UoMCw5MCl94oCmPC9kaXY+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7ZC5yZWFkYWJsZT8ndC1ncm4nOid0LWFtYid9Ij4ke2QucmVhZGFibGU/Zm10KGQuY2hhcnMpKycgY2hhcnMnOidOT1QgUkVBREFCTEUnfTwvc3Bhbj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHsoZC5zaXplLzEwMjQpLnRvRml4ZWQoMCl9IEtCPC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0iYXNrRG9jKCcke2QuaWR9JykiPkFzayBhYm91dCBpdDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icm1Eb2MoJyR7ZC5pZH0nKSI+UmVtb3ZlPC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJ30KICAke1IubGVuZ3RoP1IubWFwKGQ9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+JHtlc2MoZC5raW5kKX08L3NwYW4+PGI+JHtlc2MoZC5icmllZil9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtkLnR9JHtkLnNlbnRUbz8nIMK3IFNFTlQgdG8gJytlc2MoZC5zZW50VG8pOicnfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgaWQ9ImRyZl8ke2QuaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS43O2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTsKICAgICAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTFweDtwYWRkaW5nOjE0cHgiPiR7ZXNjKGQudGV4dCl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb3B5RHJhZnQoJyR7ZC5pZH0nKSI+Q29weTwvYnV0dG9uPgogICAgICR7ZC5raW5kPT09J2VtYWlsJyYmIWQuc2VudFRvP2A8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIzMHB4IiBpZD0idG9fJHtkLmlkfSIgcGxhY2Vob2xkZXI9InNlbmQgdG8gZW1haWwiPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InNlbmREcmFmdCgnJHtkLmlkfScpIj5TZW5kIGl0PC9idXR0b24+YDonJ30KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InJtRHJhZnQoJyR7ZC5pZH0nKSI+RGVsZXRlPC9idXR0b24+PC9kaXY+CiAgIDwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgd3JpdHRlbiB5ZXQuPC9kaXY+PC9kaXY+J31gOwp9OwpSRU5ERVIud29yazI9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7inIkgRklMRVMgJmFtcDsgV1JJVElORyDigJQgeW91ciBldmVyeWRheSBhc3Npc3RhbnQ8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+VXBsb2FkIGEgZmlsZSBhbmQgYXNrIGhpbSBhYm91dCBpdC4gT3IgdGVsbCBoaW0gd2hhdCB0byB3cml0ZSDigJQgZW1haWwsIFdoYXRzQXBwLCBwcm9wb3NhbCwgaW52b2ljZSDigJQgYW5kIGhlIGRyYWZ0cyBpdCByZWFkeSB0byBjb3B5IG9yIHNlbmQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5VcGxvYWQgYSBmaWxlPC9zcGFuPgogICAgIDxpbnB1dCB0eXBlPSJmaWxlIiBpZD0idXBGaWxlIiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJkb1VwbG9hZCgpIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPlJlYWRzIHR4dCwgbWQsIGNzdiwganNvbiwgbG9nLCBodG1sIGFuZCB0ZXh0LWJhc2VkIFBERnMuIE1heCA4IE1CLiBTY2FubmVkIFBERnMgYW5kIGltYWdlcyBjYW5ub3QgYmUgcmVhZCDigJQgaGUgd2lsbCBzYXkgc28gcmF0aGVyIHRoYW4gZ3Vlc3MuPC9kaXY+CiAgIDwvZGl2PgogICA8ZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IHNob3VsZCBoZSB3cml0ZT88L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0iZGtLaW5kIiBjbGFzcz0iaW4iPiR7S0lORFMubWFwKGs9PmA8b3B0aW9uIHZhbHVlPSIke2tbMF19Ij4ke2tbMV19PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VGVsbCBoaW0gd2hhdCBpdCBpcyBhYm91dDwvc3Bhbj4KICAgICA8dGV4dGFyZWEgaWQ9ImRrQnJpZWYiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6NjRweCIgcGxhY2Vob2xkZXI9ImUuZy4gZW1haWwgdG8gYSBMdWRoaWFuYSBzaG9wIG93bmVyIG9mZmVyaW5nIDE0IGRheXMgZnJlZSB3ZWJzaXRlIG1vbml0b3JpbmciPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9IndyaXRlRHJhZnQoKSI+V1JJVEUgSVQ8L2J1dHRvbj4KICAgICAkeyhTLmRvY3N8fFtdKS5sZW5ndGg/YDxsYWJlbCBjbGFzcz0ibW9uby1kaW0iPjxpbnB1dCB0eXBlPSJjaGVja2JveCIgaWQ9InVzZURvY3MiPiB1c2UgbXkgdXBsb2FkZWQgZmlsZXM8L2xhYmVsPmA6Jyd9PC9kaXY+CiAgIDwvZGl2PgogIDwvZGl2PgogPC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0id29yazIiPiR7TElWRS53b3JrMigpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRvVXBsb2FkKCl7CiAgY29uc3QgZj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwRmlsZScpfHx7fSkuZmlsZXM/LlswXTsKICBpZighZikgcmV0dXJuOwogIGlmKGYuc2l6ZT44ZTYpIHJldHVybiBmbGFzaCgnVG9vIGxhcmdlIOKAlCA4IE1CIG1heGltdW0nKTsKICBmbGFzaCgnUmVhZGluZyAnK2YubmFtZSsn4oCmJyk7CiAgY29uc3QgcmQ9bmV3IEZpbGVSZWFkZXIoKTsKICByZC5vbmxvYWQ9YXN5bmMoKT0+ewogICAgdHJ5ewogICAgICBjb25zdCBiNjQ9U3RyaW5nKHJkLnJlc3VsdCkuc3BsaXQoJywnKVsxXTsKICAgICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG9jL3VwbG9hZCcse25hbWU6Zi5uYW1lLG1pbWU6Zi50eXBlLGRhdGE6YjY0fSk7CiAgICAgIHJlbmRlcigpOyBmbGFzaChyLnJlYWRhYmxlPygnUmVhZCAnK2ZtdChyLmNoYXJzKSsnIGNoYXJhY3RlcnMnKTonVXBsb2FkZWQsIGJ1dCB0aGUgdGV4dCBjb3VsZCBub3QgYmUgZXh0cmFjdGVkJyk7CiAgICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQogIH07CiAgcmQucmVhZEFzRGF0YVVSTChmKTsKfQphc3luYyBmdW5jdGlvbiBybURvYyhpZCl7IGF3YWl0IEFQSSgnL2FwaS9kb2MvcmVtb3ZlJyx7aWR9KTsgcmVuZGVyKCkgfQpmdW5jdGlvbiBhc2tEb2MoaWQpewogIG1vZGFsKGA8aDM+QXNrIGFib3V0IHRoaXMgZmlsZTwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBxdWVzdGlvbjwvc3Bhbj4KICAgIDxpbnB1dCBpZD0iZHFRIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJ3aGF0IGFyZSB0aGUga2V5IHBvaW50cz8iPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJ1bkFza0RvYygnJHtpZH0nKSI+QVNLPC9idXR0b24+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj4KICAgPGRpdiBpZD0iZHFPdXQiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjwvZGl2PmApOwp9CmFzeW5jIGZ1bmN0aW9uIHJ1bkFza0RvYyhpZCl7CiAgY29uc3QgcT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RxUScpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IG91dD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHFPdXQnKTsKICBvdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+UmVhZGluZ+KApjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb2MvYXNrJyx7aWQscXVlc3Rpb246cX0pOwogICAgb3V0LmlubmVySFRNTD1gPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NSI+JHtlc2Moci50ZXh0KX08L2Rpdj5gOwogIH1jYXRjaChlKXsgb3V0LmlubmVySFRNTD1gPGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj5gIH0KfQphc3luYyBmdW5jdGlvbiB3cml0ZURyYWZ0KCl7CiAgY29uc3QgYnJpZWY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdka0JyaWVmJyl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIWJyaWVmLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUZWxsIGhpbSB3aGF0IGl0IGlzIGFib3V0Jyk7CiAgY29uc3QgdXNlPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXNlRG9jcycpfHx7fSkuY2hlY2tlZDsKICBmbGFzaCgnV3JpdGluZ+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2RyYWZ0L3dyaXRlJyx7a2luZDpka0tpbmQudmFsdWUsYnJpZWYsCiAgICAgIGRvY0lkczp1c2U/KFMuZG9jc3x8W10pLm1hcChkPT5kLmlkKTpbXX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdXcml0dGVuIOKAlCBjb3B5IGl0IG9yIHNlbmQgaXQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIGNvcHlEcmFmdChpZCl7IGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcmZfJytpZCk7CiAgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KGVsP2VsLmlubmVyVGV4dDonJyk7IGZsYXNoKCdDb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIHNlbmREcmFmdChpZCl7CiAgY29uc3QgdG89KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b18nK2lkKXx8e30pLnZhbHVlfHwnJzsKICBpZighdG8udHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgdGhlIHJlY2lwaWVudCBlbWFpbCcpOwogIGZsYXNoKCdTZW5kaW5n4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZHJhZnQvc2VuZCcse2lkLHRvfSk7IHJlbmRlcigpOyBmbGFzaCgnU2VudCcpIH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcm1EcmFmdChpZCl7IGF3YWl0IEFQSSgnL2FwaS9kcmFmdC9yZW1vdmUnLHtpZH0pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIENPTk5FQ1RPUlMgLS0tLS0tLS0tLSAqLwpjb25zdCBQUkVTRVRTPVsKIFsnZGVlcHNlZWsnLCdodHRwczovL2FwaS5kZWVwc2Vlay5jb20nLCdiZWFyZXInLCdEZWVwU2VlayDigJQgY2hlYXBlc3QgY2FwYWJsZSBtb2RlbCwgfuKCuTMwL21vIG9mIHVzZSddLAogWydvcGVud2VhdGhlcicsJ2h0dHBzOi8vYXBpLm9wZW53ZWF0aGVybWFwLm9yZy9kYXRhLzIuNScsJ3F1ZXJ5JywnV2VhdGhlciDigJQgZnJlZSB0aWVyJ10sCiBbJ25ld3NhcGknLCdodHRwczovL25ld3NhcGkub3JnL3YyJywnaGVhZGVyJywnTmV3cyBoZWFkbGluZXMg4oCUIGZyZWUgdGllciddLAogWyd0ZWxlZ3JhbScsJ2h0dHBzOi8vYXBpLnRlbGVncmFtLm9yZycsJ25vbmUnLCdUZWxlZ3JhbSBib3Qg4oCUIGZyZWUsIHB1dCB0aGUgdG9rZW4gaW4gdGhlIGJhc2UgVVJMJ10sCiBbJ3NoZWV0cycsJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0JywnYmVhcmVyJywnR29vZ2xlIFNoZWV0cyDigJQgbG9nIHJlc3VsdHMgdG8gYSBzcHJlYWRzaGVldCddLAogWyd1bnNwbGFzaCcsJ2h0dHBzOi8vYXBpLnVuc3BsYXNoLmNvbScsJ2hlYWRlcicsJ0ZyZWUgc3RvY2sgaW1hZ2VzIGZvciB0aGUgc2l0ZXMgaGUgYnVpbGRzJ10KXTsKTElWRS5jb25uZWN0PSgpPT57CiAgY29uc3QgQz1TLmNvbm5lY3RvcnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKEMubGVuZ3RoLCdDb25uZWN0b3JzJywndmFyKC0tbGltZSknLEMuZmlsdGVyKGM9PmMuZW5hYmxlZCkubGVuZ3RoKycgZW5hYmxlZCcpfQogICAke2twaShmbXQoQy5yZWR1Y2UoKGEsYyk9PmErYy5jYWxscywwKSksJ0NhbGxzIE1hZGUnLCd2YXIoLS1vbGl2ZSknLCdsaWZldGltZScpfQogICAke2twaShDLnJlZHVjZSgoYSxjKT0+YStjLmZhaWxzLDApLCdGYWlsdXJlcycsQy5zb21lKGM9PmMuZmFpbHMpPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJycpfTwvZGl2PgogICR7Qy5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db25uZWN0ZWQgU2VydmljZXM8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgIDx0aGVhZD48dHI+PHRoPk5hbWU8L3RoPjx0aD5FbmRwb2ludDwvdGg+PHRoPkF1dGg8L3RoPjx0aD5LZXk8L3RoPjx0aD5Vc2VkPC90aD48dGg+U3RhdGU8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Qy5tYXAoYz0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWxpbWUpIj4ke2VzYyhjLm5hbWUpfTwvYj4KICAgICAke2Mubm90ZT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMubm90ZSl9PC9kaXY+YDonJ308L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy5iYXNlKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMuYXV0aCl9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMua2V5KX08L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtjLmNhbGxzfSR7Yy5mYWlscz8nIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4vJytjLmZhaWxzKyfinJc8L3NwYW4+JzonJ308L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtjLmVuYWJsZWQ/J3QtZ3JuJzondC1kaW0nfSI+JHtjLmVuYWJsZWQ/J09OJzonT0ZGJ308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRlc3RDb25uKCcke2VzYyhjLm5hbWUpfScpIj5UZXN0PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2dnbGVDb25uKCcke2VzYyhjLm5hbWUpfScpIj4ke2MuZW5hYmxlZD8nRGlzYWJsZSc6J0VuYWJsZSd9PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybUNvbm4oJyR7ZXNjKGMubmFtZSl9JykiPlJlbW92ZTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJ31gOwp9OwpSRU5ERVIuY29ubmVjdD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKaryBDT05ORUNUT1JTIOKAlCBHSVZFIEhJTSBBTlkgU0VSVklDRTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5BZGQgPGI+YW55IEFQSTwvYj4gd2l0aCBhIGtleS4gSGUgY2FuIHRoZW4gY2FsbCBpdCBmcm9tIHRoZSBjYXBhYmlsaXRpZXMgaGUgd3JpdGVzIOKAlCBidXQgdGhlIGtleSBpdHNlbGYgaXMgbmV2ZXIgc2hvd24gdG8gaGlzIGNvZGUsIG5ldmVyIHJldHVybmVkIGJ5IHRoZSBBUEksIGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBsZWRnZXIuPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT5VcCB0byA0MCBjb25uZWN0b3JzLiBBbnkgUkVTVCBzZXJ2aWNlIHRoYXQgcmV0dXJucyBKU09OLjwvbGk+CiAgIDxsaT5Gb3VyIGF1dGggc3R5bGVzOiBCZWFyZXIgdG9rZW4sIGN1c3RvbSBoZWFkZXIsIHF1ZXJ5IHBhcmFtZXRlciwgb3Igbm9uZS48L2xpPgogICA8bGk+SGUgc2VlcyBvbmx5IHRoZSA8Yj5uYW1lPC9iPiBhbmQgd2hhdCBpdCBkb2VzIOKAlCB0aGVuIGNhbGxzIDxjb2RlPmFwaS5jYWxsKCduYW1lJywge3BhdGh9KTwvY29kZT4uPC9saT4KICA8L3VsPgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNob3J0IG5hbWU8L3NwYW4+PGlucHV0IGlkPSJjbk5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImRlZXBzZWVrIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJhc2UgVVJMPC9zcGFuPjxpbnB1dCBpZD0iY25CYXNlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2FwaS5kZWVwc2Vlay5jb20iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QXV0aCBzdHlsZTwvc3Bhbj48c2VsZWN0IGlkPSJjbkF1dGgiIGNsYXNzPSJpbiI+CiAgICA8b3B0aW9uIHZhbHVlPSJiZWFyZXIiPkJlYXJlciB0b2tlbjwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImhlYWRlciI+Q3VzdG9tIGhlYWRlcjwvb3B0aW9uPgogICAgPG9wdGlvbiB2YWx1ZT0icXVlcnkiPlF1ZXJ5IHBhcmFtZXRlcjwvb3B0aW9uPjxvcHRpb24gdmFsdWU9Im5vbmUiPk5vIGtleSBuZWVkZWQ8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFQSSBrZXk8L3NwYW4+PGlucHV0IGlkPSJjbktleSIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SGVhZGVyIC8gcXVlcnkgbmFtZTwvc3Bhbj48aW5wdXQgaWQ9ImNuSGRyIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJYLUFQSS1LZXkgb3Iga2V5Ij48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXMgaXQgZm9yPzwvc3Bhbj48aW5wdXQgaWQ9ImNuTm90ZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iY2hlYXAgbW9kZWwgZm9yIGJ1bGsgd3JpdGluZyI+PC9sYWJlbD4KICA8L2Rpdj4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYWRkQ29ubigpIj5BREQgQ09OTkVDVE9SPC9idXR0b24+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5RdWljayBmaWxsOjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPiR7UFJFU0VUUy5tYXAoKHAsaSk9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InByZXNldCgke2l9KSI+JHtlc2MocFswXSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJjb25uZWN0Ij4ke0xJVkUuY29ubmVjdCgpfTwvZGl2PmA7CmZ1bmN0aW9uIHByZXNldChpKXsgY29uc3QgcD1QUkVTRVRTW2ldOwogIGNuTmFtZS52YWx1ZT1wWzBdOyBjbkJhc2UudmFsdWU9cFsxXTsgY25BdXRoLnZhbHVlPXBbMl07IGNuTm90ZS52YWx1ZT1wWzNdOwogIGZsYXNoKCdGaWxsZWQg4oCUIG5vdyBwYXN0ZSB0aGUga2V5Jyk7IH0KYXN5bmMgZnVuY3Rpb24gYWRkQ29ubigpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2Nvbm5lY3Rvci9hZGQnLHtuYW1lOmNuTmFtZS52YWx1ZSxiYXNlOmNuQmFzZS52YWx1ZSxhdXRoOmNuQXV0aC52YWx1ZSwKICAgICAga2V5OmNuS2V5LnZhbHVlLGhlYWRlck5hbWU6Y25IZHIudmFsdWUscXVlcnlOYW1lOmNuSGRyLnZhbHVlLG5vdGU6Y25Ob3RlLnZhbHVlfSk7CiAgICBjbktleS52YWx1ZT0nJzsgcmVuZGVyKCk7IGZsYXNoKCdDb25uZWN0b3IgYWRkZWQg4oCUIGhlIGNhbiB1c2UgaXQgbm93Jyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBybUNvbm4obil7IGlmKCFjb25maXJtKCdSZW1vdmUgJytuKyc/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvY29ubmVjdG9yL3JlbW92ZScse25hbWU6bn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUNvbm4obil7IGF3YWl0IEFQSSgnL2FwaS9jb25uZWN0b3IvdG9nZ2xlJyx7bmFtZTpufSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdGVzdENvbm4obil7IGZsYXNoKCdUZXN0aW5nICcrbisn4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9jb25uZWN0b3IvdGVzdCcse25hbWU6bn0pOwogICAgbW9kYWwoYDxoMz4ke2VzYyhuKX0gcmVzcG9uZGVkPC9oMz48cHJlIGNsYXNzPSJ5YW1sIj4ke2VzYyhyLnNhbXBsZSl9PC9wcmU+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIFRIRSBDSEFJUk1BTidTIERFU0sg4oCUIG9uZSBwYWdlLCBoZSBhc2tzLCB5b3UgdGljayAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIGFza0NhcmQoa2luZCwgaWQsIHRpdGxlLCBib2R5LCBtZXRhLCBleHRyYSl7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWxlZnQ6NHB4IHNvbGlkIHZhcigtLWFtYikiPgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPkhFIElTIEFTS0lORzwvc3Bhbj48YiBzdHlsZT0iZm9udC1zaXplOjE0LjVweCI+JHtlc2ModGl0bGUpfTwvYj48L2Rpdj4KICAgICR7bWV0YT9gPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtZXRhKX08L3NwYW4+YDonJ308L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4O2xpbmUtaGVpZ2h0OjEuNjUiPiR7Ym9keX08L2Rpdj4KICAgJHtleHRyYXx8Jyd9CiAgIDxkaXYgY2xhc3M9InJvdyI+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIHN0eWxlPSJmb250LXNpemU6MTVweDtwYWRkaW5nOjExcHggMjZweCIgb25jbGljaz0ic2F5KCcke2tpbmR9JywnJHtpZH0nLDEpIj7inJQgJm5ic3A7WUVTPC9idXR0b24+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIHN0eWxlPSJmb250LXNpemU6MTVweDtwYWRkaW5nOjExcHggMjZweCIgb25jbGljaz0ic2F5KCcke2tpbmR9JywnJHtpZH0nLDApIj7inJUgJm5ic3A7Tk88L2J1dHRvbj4KICAgPC9kaXY+PC9kaXY+YDsKfQovKiA9PT09PT09PT09PT09PT09PSBUSEUgREVTSyDigJQgb25lIGNoYXQgYm94LCBldmVyeXRoaW5nIGhhcHBlbnMgaGVyZSA9PT09PT09PT0KICAgVGhlIE93bmVyIHNhaWQgaXQgcGxhaW5seTogIndoeSB5b3Ugbm90IGNvbWJpbmUgYW5kIGxldCBjaGFpcm1hbiBoYW5kZWwKICAgaXRzIG1vcmUgYW5kIG1vcmUgd29yayBmb3IgbWUgcmF0aGVyIHRoZW4gaGltIi4gU28gdGhpcyBpcyBub3cgYSBjaGF0LAogICBub3QgYSBkYXNoYm9hcmQuIEFwcHJvdmFscyBhcHBlYXIgaW5saW5lLiBBY3Rpb25zIGhhcHBlbiBmcm9tIHRoZSBib3guCiAgIE5vdGhpbmcgaGVyZSByZXF1aXJlcyBmaW5kaW5nIGFub3RoZXIgcGFnZS4gKi8KTElWRS5kZXNrPSgpPT57CiAgY29uc3QgZ2F0ZXMgPSAoUy5nYXRlc3x8W10pLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJyk7CiAgY29uc3QgdXBzICAgPSAoUy5wcm9wb3NhbHN8fFtdKS5maWx0ZXIocD0+cC5zdGF0dXM9PT0nUEVORElORycpOwogIGNvbnN0IGpvYnMgID0gKFMubWlzc2lvbnN8fFtdKS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nT1BFTicpOwogIGNvbnN0IGFza3MgID0gZ2F0ZXMubGVuZ3RoICsgdXBzLmxlbmd0aDsKICBjb25zdCBzdCAgICA9IFMuc3RvcmFnZXx8e307CiAgY29uc3QgY2hhdCAgPSAoUy5jaGF0fHxbXSkuc2xpY2UoMCwzMCkucmV2ZXJzZSgpOwoKICBsZXQgaHRtbCA9ICcnOwoKICAvKiBPbmx5IGdlbnVpbmVseSBjcml0aWNhbCB0aGluZ3MgaW50ZXJydXB0LiBFdmVyeXRoaW5nIGVsc2Ugd2FpdHMgYmVsb3cuICovCiAgaWYoc3QubGV2ZWw9PT0nQ1JJVCcpewogICAgaHRtbCArPSBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjA2KTttYXJnaW4tYm90dG9tOjEycHgiPgogICAgIDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5ZT1VSIFdPUksgSVMgTk9UIEJFSU5HIFNBVkVEPC9iPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjZweCAwIDlweCI+JHtlc2Moc3QubXNnfHwnJyl9PC9kaXY+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIHNtIiBvbmNsaWNrPSJnbygnc3RvcmFnZScpIj5GaXggaXQg4oCUIDYgbWludXRlczwvYnV0dG9uPjwvZGl2PmA7CiAgfQoKICAvKiBBcHByb3ZhbHMsIGlubGluZSwgYmlnIGJ1dHRvbnMuICovCiAgaWYoYXNrcyl7CiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWFtYik7bWFyZ2luLWJvdHRvbToxMnB4Ij4KICAgICAgPGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7YXNrc30gdGhpbmcke2Fza3M+MT8ncyc6Jyd9IG5lZWQgeW91ciB5ZXMgb3Igbm88L2I+PC9kaXY+YDsKICAgIGdhdGVzLmZvckVhY2goZz0+eyBodG1sICs9IGFza0NhcmQoJ2dhdGUnLCBnLmlkLCBnLnRpdGxlLAogICAgICBgJHtlc2MoZy5vYmopfTxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPlNhZmVndWFyZHM6ICR7ZXNjKGcuc2FmZSl9PC9kaXY+YCwKICAgICAgYCR7Zy5jbHN9IMK3IHJpc2sgJHtnLnJpc2t9JHtnLmNvc3Q/JyDCtyBjb3N0cyBScyAnK2cuY29zdDonJ31gKTsgfSk7CiAgICB1cHMuZm9yRWFjaChwPT57IGh0bWwgKz0gYXNrQ2FyZCgndXBncmFkZScsIHAuaWQsIHAubGFiZWwsCiAgICAgIGAke2VzYyhwLndoeSl9JHtwLmV2aWRlbmNlP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6N3B4Ij5FdmlkZW5jZTogJHtlc2MocC5ldmlkZW5jZSl9PC9kaXY+YDonJ31gLAogICAgICBwLmtsYXNzKTsgfSk7CiAgfQoKICAvKiBQUk9KRUNUUyDigJQgc2VwYXJhdGUgdGhyZWFkIHBlciBwaWVjZSBvZiB3b3JrLCBzbyBjb250ZXh0IGRvZXMgbm90IGJsZWVkICovCiAgY29uc3QgcHJqcyA9IFMucHJvamVjdHN8fFt7aWQ6J1BSSi1NQUlOJyxuYW1lOidHZW5lcmFsJ31dOwogIGNvbnN0IGNudCAgPSBTLmNoYXRDb3VudHN8fHt9OwogIGNvbnN0IG9wZW4gPSBwcmpzLmZpbmQoeD0+eC5pZD09PShTLnByb2plY3RJZHx8J1BSSi1NQUlOJykpfHxwcmpzWzBdOwogIGh0bWwgKz0gYDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9ImZsZXgtd3JhcDp3cmFwO2dhcDo2cHg7bWFyZ2luLWJvdHRvbToxMHB4O2FsaWduLWl0ZW1zOmNlbnRlciI+CiAgICR7cHJqcy5tYXAoeD0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSAke3guaWQ9PT1vcGVuLmlkPydwJzonJ30iIG9uY2xpY2s9Im9wZW5QcmooJyR7eC5pZH0nKSIKICAgICB0aXRsZT0iJHtjbnRbeC5pZF18fDB9IG1lc3NhZ2VzIj4ke2VzYyh4Lm5hbWUpfSR7Y250W3guaWRdP2AgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2NudFt4LmlkXX08L3NwYW4+YDonJ308L2J1dHRvbj5gKS5qb2luKCcnKX0KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJuZXdQcmooKSIgdGl0bGU9IktlZXAgYSBzZXBhcmF0ZSBjb252ZXJzYXRpb24gZm9yIGVhY2ggYnVzaW5lc3MiPisgTmV3PC9idXR0b24+CiAgICR7b3Blbi5pZCE9PSdQUkotTUFJTic/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsUHJqKCcke29wZW4uaWR9JykiIHRpdGxlPSJEZWxldGUgdGhpcyBwcm9qZWN0IGFuZCBpdHMgdGhyZWFkIj5cdTI3MTU8L2J1dHRvbj5gOicnfQogICA8c3BhbiBzdHlsZT0iZmxleDoxIj48L3NwYW4+CiAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJjaGF0RmluZCIgcGxhY2Vob2xkZXI9IlNlYXJjaCBldmVyeSBjb252ZXJzYXRpb27igKYiIHN0eWxlPSJtYXgtd2lkdGg6MjMwcHgiCiAgICAgb25rZXlkb3duPSJpZihldmVudC5rZXk9PT0nRW50ZXInKXtldmVudC5wcmV2ZW50RGVmYXVsdCgpO2ZpbmRDaGF0KCl9Ij4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJmaW5kQ2hhdCgpIj5GaW5kPC9idXR0b24+CiAgPC9kaXY+CiAgPGRpdiBpZD0iZmluZE91dCI+PC9kaXY+YDsKCiAgLyogVEhFIENPTlZFUlNBVElPTiAqLwogIGh0bWwgKz0gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJwYWRkaW5nOjA7b3ZlcmZsb3c6aGlkZGVuIj4KICAgPGRpdiBpZD0iY2hhdFNjcm9sbCIgc3R5bGU9Im1heC1oZWlnaHQ6NTJ2aDtvdmVyZmxvdy15OmF1dG87cGFkZGluZzoxNnB4Ij4KICAgJHshY2hhdC5sZW5ndGggPyBgPGRpdiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzowIj4KICAgICAgPHN0eWxlPgogICAgICAgIEBrZXlmcmFtZXMgY2luZVBhbnswJXt0cmFuc2Zvcm06c2NhbGUoMS4wNikgdHJhbnNsYXRlM2QoMCwwLDApfTUwJXt0cmFuc2Zvcm06c2NhbGUoMS4xMykgdHJhbnNsYXRlM2QoLTEuMiUsLTElLDApfTEwMCV7dHJhbnNmb3JtOnNjYWxlKDEuMDYpIHRyYW5zbGF0ZTNkKDAsMCwwKX19CiAgICAgICAgQGtleWZyYW1lcyBjaW5lUmlzZXtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWSgxNHB4KX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fQogICAgICAgIEBrZXlmcmFtZXMgY2luZVNoZWVuezAle3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0xMjAlKX0xMDAle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDIyMCUpfX0KICAgICAgICBAa2V5ZnJhbWVzIGNpbmVHbG93ezAlLDEwMCV7b3BhY2l0eTouNTV9NTAle29wYWNpdHk6MX19CiAgICAgICAgLmNpbmV7cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO2JvcmRlci1yYWRpdXM6MTRweDtiYWNrZ3JvdW5kOiMwNzBBMDU7CiAgICAgICAgICBib3gtc2hhZG93OjAgMThweCA1MHB4IHJnYmEoMCwwLDAsLjI4KX0KICAgICAgICAuY2luZT5pbWd7d2lkdGg6MTAwJTtkaXNwbGF5OmJsb2NrO2FuaW1hdGlvbjpjaW5lUGFuIDI2cyBlYXNlLWluLW91dCBpbmZpbml0ZTt3aWxsLWNoYW5nZTp0cmFuc2Zvcm19CiAgICAgICAgLmNpbmU6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtwb2ludGVyLWV2ZW50czpub25lOwogICAgICAgICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoNywxMCw1LDApIDQyJSxyZ2JhKDcsMTAsNSwuNTUpIDc4JSxyZ2JhKDcsMTAsNSwuOSkgMTAwJSl9CiAgICAgICAgLmNpbmVDYXB7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjA7ei1pbmRleDoyO3BhZGRpbmc6MjJweCAxOHB4IDIwcHh9CiAgICAgICAgLmNpbmVDYXAgaDF7Zm9udDo4MDAgY2xhbXAoMjNweCw0LjZ2dyw0MHB4KS8xLjA2IHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0xLjRweDsKICAgICAgICAgIG1hcmdpbjowIDAgN3B4O2NvbG9yOiNGNkYzRTY7dGV4dC1zaGFkb3c6MCAycHggMjJweCByZ2JhKDAsMCwwLC43KTsKICAgICAgICAgIGFuaW1hdGlvbjpjaW5lUmlzZSAuOHMgY3ViaWMtYmV6aWVyKC4yLC43LC4yLDEpIGJvdGh9CiAgICAgICAgLmNpbmVDYXAgaDEgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6I0M2REI0QX0KICAgICAgICAuY2luZUNhcCBwe21hcmdpbjowO2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnJnYmEoMjQ2LDI0MywyMzAsLjcyKTsKICAgICAgICAgIGFuaW1hdGlvbjpjaW5lUmlzZSAuOHMgLjE4cyBjdWJpYy1iZXppZXIoLjIsLjcsLjIsMSkgYm90aH0KICAgICAgICAuY2luZURvdHtkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDo2cHg7aGVpZ2h0OjZweDtib3JkZXItcmFkaXVzOjlweDtiYWNrZ3JvdW5kOiNDNkRCNEE7CiAgICAgICAgICBtYXJnaW4tcmlnaHQ6N3B4O2FuaW1hdGlvbjpjaW5lR2xvdyAxLjlzIGVhc2UtaW4tb3V0IGluZmluaXRlOwogICAgICAgICAgYm94LXNoYWRvdzowIDAgMTBweCAjQzZEQjRBfQogICAgICAgIC50aWxle3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjtjdXJzb3I6cG9pbnRlcjtib3JkZXItcmFkaXVzOjEycHg7CiAgICAgICAgICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7YmFja2dyb3VuZDojMDcwQTA1O3RyYW5zaXRpb246dHJhbnNmb3JtIC4yMnMsYm94LXNoYWRvdyAuMjJzOwogICAgICAgICAgYW5pbWF0aW9uOmNpbmVSaXNlIC43cyBib3RofQogICAgICAgIC50aWxlOmhvdmVye3RyYW5zZm9ybTp0cmFuc2xhdGVZKC00cHgpO2JveC1zaGFkb3c6MCAxNHB4IDMwcHggcmdiYSgwLDAsMCwuMyl9CiAgICAgICAgLnRpbGU+aW1ne3dpZHRoOjEwMCU7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTA0cHg7b2JqZWN0LWZpdDpjb3ZlcjtvcGFjaXR5Oi45Mjt0cmFuc2l0aW9uOi4zNXN9CiAgICAgICAgLnRpbGU6aG92ZXI+aW1ne3RyYW5zZm9ybTpzY2FsZSgxLjA5KTtvcGFjaXR5OjF9CiAgICAgICAgLnRpbGUgLmxibHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDtwYWRkaW5nOjlweCAxMHB4O3RleHQtYWxpZ246bGVmdDsKICAgICAgICAgIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZyxyZ2JhKDcsMTAsNSwwKSxyZ2JhKDcsMTAsNSwuOTIpIDU1JSl9CiAgICAgICAgLnRpbGUgLmxibCBie2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjEyLjVweDtjb2xvcjojRjZGM0U2O2xpbmUtaGVpZ2h0OjEuMjV9CiAgICAgICAgLnRpbGUgLmxibCBze2Rpc3BsYXk6YmxvY2s7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Zm9udC1zaXplOjEwLjVweDtjb2xvcjpyZ2JhKDI0NiwyNDMsMjMwLC42KTtsaW5lLWhlaWdodDoxLjR9CiAgICAgICAgLnRpbGUgLnNoZWVue3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2JvdHRvbTowO3dpZHRoOjM0JTtwb2ludGVyLWV2ZW50czpub25lOwogICAgICAgICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTAwZGVnLHRyYW5zcGFyZW50LHJnYmEoMjU1LDI1NSwyNTUsLjE2KSx0cmFuc3BhcmVudCk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEyMCUpfQogICAgICAgIC50aWxlOmhvdmVyIC5zaGVlbnthbmltYXRpb246Y2luZVNoZWVuIC44NXMgZWFzZS1vdXR9CiAgICAgICAgQG1lZGlhKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246cmVkdWNlKXsuY2luZT5pbWd7YW5pbWF0aW9uOm5vbmV9LmNpbmVDYXAgaDEsLmNpbmVDYXAgcCwudGlsZXthbmltYXRpb246bm9uZX19CiAgICAgIDwvc3R5bGU+CiAgICAgIDxkaXYgY2xhc3M9ImNpbmUiPgogICAgICAgIDxpbWcgc3JjPSIke0FSVC5oZXJvfSIgYWx0PSIiIHdpZHRoPSI5NjAiIGhlaWdodD0iNTIzIiBkZWNvZGluZz0iYXN5bmMiIGZldGNocHJpb3JpdHk9ImhpZ2giPgogICAgICAgIDxkaXYgY2xhc3M9ImNpbmVDYXAiPgogICAgICAgICAgPGgxPlNheSBpdCBvbmNlLjxicj48ZW0+SGUgZG9lcyB0aGUgcmVzdC48L2VtPjwvaDE+CiAgICAgICAgICA8cD48c3BhbiBjbGFzcz0iY2luZURvdCI+PC9zcGFuPk5vdGhpbmcgbGVhdmVzIHdpdGhvdXQgeW91ciB0YXAuPC9wPgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbjoxMnB4IDAgNHB4O2dhcDo5cHgiPgogICAgICAgICR7W1snYnVpbGQnLCdCdWlsZCB0aGUgYnVzaW5lc3MnLCdTaXRlLCBwcmljZXMsIHBvbGljaWVzLCBpbnZvaWNlJywnQnVpbGQgbWUgYSBidXNpbmVzcyBmb3IgJ10sCiAgICAgICAgICAgWyduYW1lJywnRmluZCBhIG5hbWUnLCdDaGVja2VkIGxpdmUuIEZyZWUgb3IgdGFrZW4nLCdGaW5kIG1lIGEgbmFtZSBmb3IgJ10sCiAgICAgICAgICAgWydjdXN0b21lcnMnLCdHZXQgY3VzdG9tZXJzJywnV3JpdHRlbiBhbmQgcmVhZHkgdG8gc2VuZCcsJ0dldCBtZSBjdXN0b21lcnMnXSwKICAgICAgICAgICBbJ2FwcHJvdmUnLCdZb3UgYXBwcm92ZScsJ0hlIGFza3MuIFlvdSB0YXAgeWVzIG9yIG5vJywnV2hhdCBpcyBicm9rZW4/J11dCiAgICAgICAgICAubWFwKChbayx0LHMscV0saSk9PmA8ZGl2IGNsYXNzPSJ0aWxlIiBzdHlsZT0iYW5pbWF0aW9uLWRlbGF5OiR7MC4xK2kqMC4wOX1zIiBvbmNsaWNrPSJkZXNrUXVpY2soJyR7cX0nKSI+CiAgICAgICAgICAgIDxpbWcgc3JjPSIke0FSVFtrXX0iIGFsdD0iIiB3aWR0aD0iNDIwIiBoZWlnaHQ9IjIyOSIgbG9hZGluZz0ibGF6eSIgZGVjb2Rpbmc9ImFzeW5jIj48c3BhbiBjbGFzcz0ic2hlZW4iPjwvc3Bhbj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibGJsIj48Yj4ke3R9PC9iPjxzPiR7c308L3M+PC9kaXY+PC9kaXY+YCkuam9pbignJyl9CiAgICAgIDwvZGl2PjwvZGl2PmAKICAgOiBjaGF0Lm1hcChtPT57CiAgICAgIGNvbnN0IG1lID0gbS53aG89PT0nT1dORVInOwogICAgICBjb25zdCBzeXMgPSBtLndobz09PSdTWVNURU0nOwogICAgICBpZihzeXMpIHJldHVybiBgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46MTBweCAwO2ZvbnQtc2l6ZToxMS41cHgiPiR7ZXNjKG0udGV4dCl9PC9kaXY+YDsKICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OiR7bWU/J2ZsZXgtZW5kJzonZmxleC1zdGFydCd9O21hcmdpbi1ib3R0b206MTJweCI+CiAgICAgICAgPGRpdiBzdHlsZT0ibWF4LXdpZHRoOjgyJTtiYWNrZ3JvdW5kOiR7bWU/J3ZhcigtLWxpbWUpJzondmFyKC0tZ2xhc3MyKSd9O2NvbG9yOiR7bWU/JyNmZmYnOid2YXIoLS10eHQpJ307CiAgICAgICAgICBib3JkZXI6MXB4IHNvbGlkICR7bWU/J3ZhcigtLWxpbWUpJzondmFyKC0tc3Ryb2tlKSd9O2JvcmRlci1yYWRpdXM6JHttZT8nMTRweCAxNHB4IDNweCAxNHB4JzonMTRweCAxNHB4IDE0cHggM3B4J307CiAgICAgICAgICBwYWRkaW5nOjExcHggMTRweDtsaW5lLWhlaWdodDoxLjYyO3doaXRlLXNwYWNlOnByZS13cmFwO3dvcmQtYnJlYWs6YnJlYWstd29yZCI+JHtlc2MobS50ZXh0KX0kewogICAgICAgICAgIW1lP2A8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5TXNnKHRoaXMpIj5Db3B5PC9idXR0b24+PC9kaXY+YDonJ308L2Rpdj48L2Rpdj5gOwogICAgIH0pLmpvaW4oJycpfQogICA8L2Rpdj4KICAgPGRpdiBzdHlsZT0iYm9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtwYWRkaW5nOjEycHg7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCkiPgogICAgJHsoUy5kb2NzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJmbGV4LXdyYXA6d3JhcDttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgICR7KFMuZG9jc3x8W10pLnNsaWNlKDAsNCkubWFwKGQ9PmA8c3BhbiBjbGFzcz0idGFnIHQtY3kiIHRpdGxlPSIke2QuY2hhcnN9IGNoYXJhY3RlcnMgcmVhZGFibGUiPlx1ezFGNENFfSAke2VzYyhkLm5hbWUpfQogICAgICAgIDxhIGhyZWY9IiMiIG9uY2xpY2s9ImRyb3BEb2MoJyR7ZC5pZH0nKTtyZXR1cm4gZmFsc2UiIHN0eWxlPSJtYXJnaW4tbGVmdDo2cHg7dGV4dC1kZWNvcmF0aW9uOm5vbmUiPlx1MjcxNTwvYT48L3NwYW4+YCkuam9pbignJyl9CiAgICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+YXR0YWNoZWQgXHUyMDE0IGhlIHJlYWRzIHRoZXNlIHdoZW4geW91IGFzazwvc3Bhbj48L2Rpdj5gOicnfQogICAgPHRleHRhcmVhIGlkPSJkZXNrU2F5IiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjU4cHg7cmVzaXplOnZlcnRpY2FsIgogICAgICBwbGFjZWhvbGRlcj0iUGFzdGUgYSB3ZWJzaXRlLCBhIG5hbWUsIG9yIGp1c3Qgc2F5IHdoYXQgeW91IHdhbnTigKYiCiAgICAgIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJyYmKGV2ZW50LmN0cmxLZXl8fGV2ZW50Lm1ldGFLZXkpKXtldmVudC5wcmV2ZW50RGVmYXVsdCgpO2Rlc2tTZW5kKCl9Ij48L3RleHRhcmVhPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo5cHg7ZmxleC13cmFwOndyYXAiPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkZXNrU2VuZCgpIj5TRU5EPC9idXR0b24+CiAgICAgPGxhYmVsIGNsYXNzPSJidG4gc20iIHN0eWxlPSJjdXJzb3I6cG9pbnRlcjttYXJnaW46MCI+XHV7MUY0Q0V9IEF0dGFjaAogICAgICA8aW5wdXQgdHlwZT0iZmlsZSIgaWQ9ImRlc2tGaWxlIiBzdHlsZT0iZGlzcGxheTpub25lIgogICAgICAgYWNjZXB0PSIudHh0LC5tZCwuY3N2LC5qc29uLC5sb2csLmh0bWwsLnBkZiIgb25jaGFuZ2U9ImF0dGFjaERvYyh0aGlzKSI+PC9sYWJlbD4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkN0cmwrRW50ZXI8L3NwYW4+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJkZXNrUXVpY2soJ1doYXQgaXMgYnJva2VuIGFuZCBibG9ja2luZyBtb25leSByaWdodCBub3c/JykiPldoYXQgaXMgYnJva2VuPzwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZGVza1F1aWNrKCdGaW5kIG1lIGEgd2F5IHRvIGVhcm4gbW9uZXkgdGhpcyB3ZWVrLicpIj5GaW5kIG1vbmV5PC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJkZXNrUXVpY2soJ0NoZWNrIGFsbCBteSBzaXRlcyByaWdodCBub3cuJykiPkNoZWNrIG15IHNpdGVzPC9idXR0b24+CiAgICAgJHsoUy5jaGF0fHxbXSkubGVuZ3RoP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyQ2hhdCgpIj5DbGVhcjwvYnV0dG9uPmA6Jyd9CiAgICA8L2Rpdj4KICAgPC9kaXY+CiAgPC9kaXY+YDsKCiAgLyogSm9icyBvbmx5IGEgaHVtYW4gY2FuIGRvIOKAlCBjb2xsYXBzZWQsIG5vdCBzaG91dGluZy4gKi8KICBpZihqb2JzLmxlbmd0aCl7CiAgICBodG1sICs9IGA8ZGV0YWlscyBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj4KICAgICAgPGI+JHtqb2JzLmxlbmd0aH0gam9iJHtqb2JzLmxlbmd0aD4xPydzJzonJ30gb25seSB5b3UgY2FuIGRvPC9iPgogICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiDigJQgdGhlIHdvcmRzIGFyZSBhbHJlYWR5IHdyaXR0ZW48L3NwYW4+PC9zdW1tYXJ5PgogICAgICR7am9icy5zbGljZSgwLDQpLm1hcChtPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWxpbWUpO3BhZGRpbmctbGVmdDoxMnB4O21hcmdpbjoxM3B4IDAiPgogICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKG0udGl0bGUpfTwvYj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPn4ke20ubWludXRlc30gbWluPC9zcGFuPjwvZGl2PgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46NHB4IDAgN3B4Ij4ke2VzYyhtLndoeSl9PC9kaXY+CiAgICAgICAke20uc2NyaXB0P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCI+CiAgICAgICAgIDxkaXYgaWQ9ImRza18ke20uaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhtLnNjcmlwdCl9PC9kaXY+CiAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiIG9uY2xpY2s9ImNvcHlTY3JpcHQoJyR7bS5pZH0nKSI+Q29weTwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+CiAgICAgICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyNjBweCIgaWQ9Im5vdGVfJHttLmlkfSIgcGxhY2Vob2xkZXI9IndoYXQgaGFwcGVuZWQ/Ij4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdkb25lJykiPkRvbmU8L2J1dHRvbj4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdza2lwJykiPlNraXA8L2J1dHRvbj48L2Rpdj4KICAgICAgPC9kaXY+YCkuam9pbignJyl9PC9kZXRhaWxzPmA7CiAgfQoKICAvKiBTdGF0dXMsIG9uZSBsaW5lLCBmb2xkZWQgYXdheS4gKi8KICBjb25zdCBkb3duPShTLm1vbml0b3JzfHxbXSkuZmlsdGVyKG09Pm0uc3RhdGU9PT0nRE9XTicpOwogIGh0bWwgKz0gYDxkZXRhaWxzIGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiIGNsYXNzPSJtb25vLWRpbSI+U3RhdHVzPC9zdW1tYXJ5PgogICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48dGFibGU+PHRib2R5PgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+UnVubmluZzwvdGQ+PHRkPiR7KFMuYWdlbnRzfHxbXSkuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aH0gYWdlbnRzLCAkeyhTLnRhc2tzfHxbXSkuZmlsdGVyKHg9PnguZW5hYmxlZCkubGVuZ3RofSBzdGFuZGluZyBvcmRlcnMke1MucnVubmluZz8nJzonIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7igJQgSEFMVEVEPC9zcGFuPid9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlNpdGVzPC90ZD48dGQ+JHsoUy5tb25pdG9yc3x8W10pLmxlbmd0aH0ke2Rvd24ubGVuZ3RoP2AgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPsK3ICR7ZG93bi5sZW5ndGh9IERPV048L3NwYW4+YDonIMK3IGFsbCB1cCd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJ1c2luZXNzZXM8L3RkPjx0ZD4keyhTLmJ1c2luZXNzZXN8fFtdKS5sZW5ndGh9IGJ1aWx0IMK3ICR7KFMuYnVzaW5lc3Nlc3x8W10pLmZpbHRlcihiPT5iLnB1Ymxpc2hlZCkubGVuZ3RofSBsaXZlPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1lc3NhZ2VzIHNlbnQ8L3RkPjx0ZD4keyhTLm91dHJlYWNofHxbXSkubGVuZ3RofSR7IShTLm91dHJlYWNofHxbXSkubGVuZ3RoPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKAlCBub3RoaW5nIGVhcm5zIHVudGlsIHNvbWV0aGluZyBpcyBzZW50PC9zcGFuPic6Jyd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1haWw8L3RkPjx0ZD4ke1Muc210cFZlcmlmaWVkPyc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+cHJvdmVuPC9zcGFuPic6KFMudGVsZW1ldHJ5JiZTLnRlbGVtZXRyeS5zbXRwX3JlYWR5KT8nPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPnVudGVzdGVkPC9zcGFuPic6JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5vZmY8L3NwYW4+J308L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QnJhaW48L3RkPjx0ZD4ke1MubGxtP2VzYyhTLmxsbS5wcm92aWRlcikrJyDCtyAnKygoUy5sbG1CYWNrdXBzfHxbXSkubGVuZ3RoKzEpKycga2V5KHMpJzonPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPm5vdCBjb25uZWN0ZWQ8L3NwYW4+J308L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2RldGFpbHM+YDsKCiAgcmV0dXJuIGh0bWw7Cn07ClJFTkRFUi5kZXNrPSgpPT5gPGRpdiBkYXRhLWxpdmU9ImRlc2siPiR7TElWRS5kZXNrKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gc2F5KGtpbmQsIGlkLCB5ZXMpewogIGZsYXNoKHllcz8nQXBwcm92aW5n4oCmJzonRGVjbGluaW5n4oCmJyk7CiAgdHJ5ewogICAgaWYoa2luZD09PSdnYXRlJykgICAgYXdhaXQgQVBJKCcvYXBpL2dhdGUvZGVjaWRlJyx7aWQsb2s6ISF5ZXN9KTsKICAgIGVsc2UgICAgICAgICAgICAgICAgIGF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2RlY2lkZScse2lkLG9rOiEheWVzfSk7CiAgICByZW5kZXIoKTsgZmxhc2goeWVzPydEb25lIOKAlCBoZSBpcyBhY3Rpbmcgb24gaXQnOidEZWNsaW5lZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KbGV0IGRlc2tCdXN5PWZhbHNlOwphc3luYyBmdW5jdGlvbiBkZXNrU2VuZCgpewogIGlmKGRlc2tCdXN5KSByZXR1cm47CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2tTYXknKTsKICBjb25zdCB0PShlbHx8e30pLnZhbHVlfHwnJzsKICBpZighdC50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSBzb21ldGhpbmcgZmlyc3QnKTsKICBkZXNrQnVzeT10cnVlOwogIGlmKGVsKXsgZWwudmFsdWU9Jyc7IGVsLmJsdXIoKTsgfQogIGZsYXNoKCdXb3JraW5n4oCmJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZG8nLHt0ZXh0OnQudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgc2Nyb2xsQ2hhdCgpOwogICAgZmxhc2goci5kaWQgJiYgci5kaWQhPT0nYW5zd2VyJyA/ICdEb25lOiAnK3IuZGlkLnJlcGxhY2UoL18vZywnICcpIDogJycpOwogICAgLyogaWYgdGhlIGFjdGlvbiBwcm9kdWNlZCBzb21ldGhpbmcgb24gYW5vdGhlciBwYWdlLCBvZmZlciBpdCDigJQgZG8gbm90IGhpamFjayAqLwogICAgaWYoci5nb3RvKSBmbGFzaCgnRG9uZSDigJQgb3BlbiAnK3IuZ290bysnIHRvIHNlZSBpdCcpOwogIH1jYXRjaChlKXsgcmVuZGVyKCk7IHNjcm9sbENoYXQoKTsgZmxhc2goZS5tZXNzYWdlKSB9CiAgZmluYWxseXsgZGVza0J1c3k9ZmFsc2U7IH0KfQpmdW5jdGlvbiBkZXNrUXVpY2sodCl7IGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXNrU2F5Jyk7IGlmKGVsKXsgZWwudmFsdWU9dDsgfSBkZXNrU2VuZCgpOyB9CmZ1bmN0aW9uIHNjcm9sbENoYXQoKXsgY29uc3QgYz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhdFNjcm9sbCcpOyBpZihjKSBjLnNjcm9sbFRvcD1jLnNjcm9sbEhlaWdodDsgfQpmdW5jdGlvbiBjb3B5TXNnKGJ0bil7CiAgY29uc3QgYm94PWJ0bi5jbG9zZXN0KCdkaXYnKTsKICBjb25zdCB0eHQ9Wy4uLmJveC5jaGlsZE5vZGVzXS5maWx0ZXIobj0+bi5ub2RlVHlwZT09PTN8fCFuLnF1ZXJ5U2VsZWN0b3IpLm1hcChuPT5uLnRleHRDb250ZW50KS5qb2luKCcnKS50cmltKCk7CiAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodHh0fHxib3guaW5uZXJUZXh0LnJlcGxhY2UoL1xzKkNvcHlccyokLywnJykpLnRoZW4oCiAgICAoKT0+eyBidG4udGV4dENvbnRlbnQ9J0NvcGllZCc7IHNldFRpbWVvdXQoKCk9PmJ0bi50ZXh0Q29udGVudD0nQ29weScsMTQwMCk7IH0sCiAgICAoKT0+Zmxhc2goJ1NlbGVjdCBhbmQgY29weSBtYW51YWxseScpKTsKfQphc3luYyBmdW5jdGlvbiBjbGVhckNoYXQoKXsgaWYoIWNvbmZpcm0oJ0NsZWFyIHRoZSBjb252ZXJzYXRpb24/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvY2hhdC9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIEFHRU5UIExPT1AgLS0tLS0tLS0tLSAqLwpjb25zdCBBR09BTFM9WwogWydGaW5kIG15IGJlc3QgdmVudHVyZScsJ0NoZWNrIG15IGN1cnJlbnQgc3RhdGUsIGludmVudCBtb25leS1tYWtpbmcgaWRlYXMsIHJlc2VhcmNoIHRoZSBtb3N0IHByb21pc2luZyBvbmUgYWdhaW5zdCB0aGUgbGl2ZSB3ZWIsIGFuZCB0ZWxsIG1lIHdoaWNoIHNpbmdsZSBvbmUgdG8gcHVyc3VlIGFuZCB3aHkuJ10sCiBbJ0Z1bGwgc3lzdGVtIGF1ZGl0JywnUmVhZCBteSBzeXN0ZW0gc3RhdGUsIHNjYW4gZm9yIGFub21hbGllcywgY2hlY2sgZXZlcnkgbW9uaXRvcmVkIHNpdGUsIGFuZCBnaXZlIG1lIGEgYmx1bnQgbGlzdCBvZiB3aGF0IGlzIGJyb2tlbiBvciB1bnNhZmUsIG1vc3QgdXJnZW50IGZpcnN0LiddLAogWydSZXNlYXJjaCBhIGNvbXBldGl0b3InLCdTZWFyY2ggdGhlIHdlYiBmb3IgdXB0aW1lIG1vbml0b3Jpbmcgc2VydmljZXMgaW4gSW5kaWEsIHJlYWQgdGhlIHByaWNpbmcgcGFnZSBvZiB0aGUgbW9zdCByZWxldmFudCBvbmUsIGFuZCB0ZWxsIG1lIGhvdyBJIHNob3VsZCBwb3NpdGlvbiBhZ2FpbnN0IHRoZW0uJ10sCiBbJ1BsYW4gbXkgbmV4dCAzIGFjdGlvbnMnLCdSZWFkIG15IHN0YXRlLCB3b3JrIG91dCB3aGF0IGlzIGFjdHVhbGx5IGJsb2NraW5nIG1vbmV5LCBhbmQgaXNzdWUgbXkgbmV4dCBjb25jcmV0ZSBtaXNzaW9ucy4nXQpdOwpSRU5ERVIuYWdlbnQ9KCk9PnsKICBjb25zdCBSPVMuYWdlbnRSdW5zfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW9saXZlKSI+4pqZIEFHRU5UIExPT1Ag4oCUIEhFIERFQ0lERVMgVEhFIE5FWFQgU1RFUCBISU1TRUxGPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UaGlzIGlzIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gYSBjaGF0Ym90IGFuZCBhbiBhZ2VudC4gSGUgcGlja3MgYSB0b29sLCA8Yj5zZWVzIHRoZSByZWFsIHJlc3VsdDwvYj4sIHRoZW4gZGVjaWRlcyB3aGF0IHRvIGRvIG5leHQg4oCUIHJlcGVhdGluZyB1bnRpbCB0aGUgZ29hbCBpcyBtZXQuIEV2ZXJ5IHRvb2wgaXMgY29kZSB0aGF0IGdlbnVpbmVseSBydW5zLjwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgIDxsaT5IZSBjYW4gY2hhaW46IHN0YXRlIOKGkiBpZGVhcyDihpIgbGl2ZSB3ZWIgcmVzZWFyY2gg4oaSIG1pc3Npb25zLCBpbiBvbmUgZ28uPC9saT4KICAgIDxsaT5IZSBvbmx5IHNlZXMgdG9vbHMgdGhhdCBleGlzdC4gSW52ZW50aW5nIG9uZSBpcyByZWZ1c2VkLjwvbGk+CiAgICA8bGk+Q2FwcGVkIGF0IDEwIHN0ZXBzIHNvIGEgbG9vcCBjYW4gbmV2ZXIgcnVuIGF3YXkuPC9saT4KICAgIDxsaT5FdmVyeSBzdGVwIGFuZCBpdHMgcmVhbCBvdXRwdXQgaXMgbG9nZ2VkIGluIHRoZSB0cmFjZSBiZWxvdy48L2xpPgogICA8L3VsPgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxzcGFuPllvdXIgZ29hbDwvc3Bhbj4KICAgIDx0ZXh0YXJlYSBpZD0iYWdHb2FsIiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0Ojc2cHgiIHBsYWNlaG9sZGVyPSJlLmcuIFdvcmsgb3V0IHdoaWNoIHZlbnR1cmUgSSBzaG91bGQgc3RhcnQgdGhpcyB3ZWVrIGFuZCBwcm92ZSBpdCB3aXRoIHJlYWwgd2ViIGV2aWRlbmNlLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+TWF4IHN0ZXBzPC9zcGFuPgogICAgPHNlbGVjdCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6ODBweCIgaWQ9ImFnU3RlcHMiPgogICAgICR7WzMsNCw2LDgsMTBdLm1hcChuPT5gPG9wdGlvbiB2YWx1ZT0iJHtufSIgJHtuPT09Nj8nc2VsZWN0ZWQnOicnfT4ke259PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icnVuQWdlbnQoKSI+UlVOIFRIRSBMT09QPC9idXR0b24+CiAgICAke1IubGVuZ3RoPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyQWdlbnQoKSI+Q2xlYXIgaGlzdG9yeTwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+JHtBR09BTFMubWFwKChnLGkpPT4KICAgICBgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJhZ1F1aWNrKCR7aX0pIj4ke2VzYyhnWzBdKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+QSA2LXN0ZXAgcnVuIG1ha2VzIDYrIEFJIGNhbGxzLiBPbiBhIGZyZWUgdGllciB0aGF0IGlzIGZpbmUgb2NjYXNpb25hbGx5IOKAlCBhZGQgYmFja3VwIGtleXMgYmVsb3cgaWYgeW91IHJ1biBpdCBvZnRlbi48L2Rpdj48L2Rpdj4KICA8ZGl2IGlkPSJhZ091dCI+PC9kaXY+CiAgJHtSLmxlbmd0aD9SLm1hcChyPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgPGI+JHtlc2Moci5nb2FsKX08L2I+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3IudH0gwrcgJHtyLnN0ZXBzfSBzdGVwJHtyLnN0ZXBzPjE/J3MnOicnfSR7ci5oaXRDYXA/JyDCtyBISVQgQ0FQJzonJ308L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1O21hcmdpbi1ib3R0b206MTFweCI+JHtlc2Moci5hbnN3ZXIpfTwvZGl2PgogICAgPGRldGFpbHM+PHN1bW1hcnkgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPlNob3cgdGhlICR7ci50cmFjZS5sZW5ndGh9LXN0ZXAgdHJhY2U8L3N1bW1hcnk+CiAgICAgPGRpdiBjbGFzcz0ibG9nIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPiR7ci50cmFjZS5tYXAodD0+CiAgICAgICBgPGRpdj48c3BhbiBjbGFzcz0idHMiPnN0ZXAgJHt0LnN0ZXB9PC9zcGFuPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tbGltZSkiPiR7ZXNjKHQuYWN0aW9uKX08L2I+XG4ke2VzYyh0LnJlc3VsdCl9PC9kaXY+YCkuam9pbignJyl9PC9kaXY+CiAgICA8L2RldGFpbHM+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gcnVucyB5ZXQuIEdpdmUgaGltIGEgZ29hbCBhbmQgd2F0Y2ggaGltIHdvcmsgaXQgb3V0LjwvZGl2PjwvZGl2Pid9YDsKfTsKYXN5bmMgZnVuY3Rpb24gcnVuQWdlbnQoKXsKICBjb25zdCBnPWFnR29hbC52YWx1ZS50cmltKCk7IGlmKCFnKSByZXR1cm4gZmxhc2goJ1N0YXRlIGEgZ29hbCBmaXJzdCcpOwogIGFnT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPldvcmtpbmfigKYgaGUgaXMgY2hvb3NpbmcgdG9vbHMgYW5kIHJlYWRpbmcgcmVzdWx0cy4gVGhpcyBjYW4gdGFrZSBhIG1pbnV0ZS48L2Rpdj48L2Rpdj4nOwogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2FnZW50L3J1bicse2dvYWw6ZyxzdGVwczorYWdTdGVwcy52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdGaW5pc2hlZCBpbiAnK3Iuc3RlcHMrJyBzdGVwKHMpJyk7CiAgfWNhdGNoKGUpewogICAgYWdPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YDsKICB9Cn0KZnVuY3Rpb24gYWdRdWljayhpKXsgYWdHb2FsLnZhbHVlPUFHT0FMU1tpXVsxXTsgcnVuQWdlbnQoKSB9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyQWdlbnQoKXsgYXdhaXQgQVBJKCcvYXBpL2FnZW50L2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gU0lURSBCVUlMREVSIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNpdGVzPSgpPT57CiAgY29uc3QgQj1TLmJ1aWxkc3x8W10sIFY9Uy52ZW50dXJlc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKWpCBTSVRFIEJVSUxERVIg4oCUIEhFIFdSSVRFUyBJVCwgWU9VIFBVQkxJU0ggSVQ8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIHdyaXRlcyBhIGNvbXBsZXRlLCB3b3JraW5nIGxhbmRpbmcgcGFnZSDigJQgaGVhZGxpbmUsIHByaWNpbmcgaW4gSU5SLCBob25lc3QgRkFRLCBhbmQgeW91ciA8Yj5yZWFsIHBheW1lbnQgbGluazwvYj4gd2lyZWQgaW4uIE9uZSBmaWxlLCBubyBkZXBlbmRlbmNpZXMuPC9kaXY+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPldoYXQgaGUgY2Fubm90IGRvLCBhbmQgd2h5LjwvYj4gUHVibGlzaGluZyBuZWVkcyBhIGhvc3RpbmcgYWNjb3VudCwgYSBkb21haW4gYW5kIGEgY2FyZCBpbiA8ZW0+eW91cjwvZW0+IGxlZ2FsIG5hbWUuIFRha2luZyBtb25leSBuZWVkcyBLWUMgYWdhaW5zdCA8ZW0+eW91cjwvZW0+IFBBTiBhbmQgYmFuay4gTm8gc29mdHdhcmUgY2FuIGhvbGQgdGhvc2Ugb24geW91ciBiZWhhbGYg4oCUIHRoYXQgaXMgdGhlIGxhdywgbm90IGEgbWlzc2luZyBmZWF0dXJlLiBIZSBnZXRzIGl0IHRvIG9uZSBjbGljayBmcm9tIGxpdmUuPC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPkhlIHJlZnVzZXMgdG8gYnVpbGQgZm9yIGFuIHVucmVzZWFyY2hlZCB2ZW50dXJlIOKAlCBldmlkZW5jZSBmaXJzdC48L2xpPgogICAgPGxpPk5vIGZha2UgdGVzdGltb25pYWxzLCBubyBpbnZlbnRlZCBjdXN0b21lciBjb3VudHMuIEEgbmV3IGJ1c2luZXNzIGNhdWdodCBmYWtpbmcgcHJvb2YgbG9zZXMgdGhlIHNhbGUuPC9saT4KICAgIDxsaT5QcmV2aWV3IGl0IGhlcmUsIGRvd25sb2FkIG9uZSBmaWxlLCBwdWJsaXNoIGZyZWUgb24gTmV0bGlmeSBEcm9wIGluIGFib3V0IDYwIHNlY29uZHMuPC9saT4KICAgPC91bD4KICAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTttYXJnaW4tdG9wOjEwcHgiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJ1aWxkIGZvciBhIGxhdW5jaGVkIHZlbnR1cmU8L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0ic2JWZW50dXJlIiBjbGFzcz0iaW4iPgogICAgICA8b3B0aW9uIHZhbHVlPSIiPuKAlCBwaWNrIG9uZSDigJQ8L29wdGlvbj4KICAgICAgJHtWLm1hcCh2PT5gPG9wdGlvbiB2YWx1ZT0iJHt2LmlkfSI+JHtlc2Modi50aXRsZSl9PC9vcHRpb24+YCkuam9pbignJyl9CiAgICAgPC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3IgZGVzY3JpYmUgaXQgeW91cnNlbGY8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJzYkJyaWVmIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHVwdGltZSBtb25pdG9yaW5nIGZvciBMdWRoaWFuYSBzaG9wcywgUnMgMTUwMC9tbyI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJidWlsZFNpdGUoKSI+V1JJVEUgVEhFIFNJVEU8L2J1dHRvbj4KICAgJHshVi5sZW5ndGg/JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPk5vIGxhdW5jaGVkIHZlbnR1cmVzIHlldC4gR28gdG8gVmVudHVyZXMsIGdlbmVyYXRlIGlkZWFzLCByZXNlYXJjaCBvbmUsIHRoZW4gQlVJTEQgQUdFTlQgVEVBTS48L2Rpdj4nOicnfQogIDwvZGl2PgogICR7Qi5sZW5ndGg/Qi5tYXAoYj0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+U0lURTwvc3Bhbj48Yj4ke2VzYyhiLnRpdGxlKX08L2I+CiAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtiLmhhc1BheUxpbms/J3QtZ3JuJzondC1hbWInfSI+JHtiLmhhc1BheUxpbms/J1BBWSBMSU5LIExJVkUnOidDT05UQUNUIE9OTFknfTwvc3Bhbj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Yi50fSDCtyAkeyhiLmJ5dGVzLzEwMjQpLnRvRml4ZWQoMSl9IEtCPC9zcGFuPjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4KICAgICA8YSBjbGFzcz0iYnRuIHAiIGhyZWY9Ii9hcGkvc2l0ZS92aWV3P2lkPSR7Yi5pZH0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5QUkVWSUVXIElUIOKGlzwvYT4KICAgICA8YSBjbGFzcz0iYnRuIG9rIiBocmVmPSIvYXBpL3NpdGUvdmlldz9pZD0ke2IuaWR9JmRsPTEiPkRPV05MT0FEIGluZGV4Lmh0bWw8L2E+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxTaXRlKCcke2IuaWR9JykiPkRlbGV0ZTwvYnV0dG9uPjwvZGl2PgogICAgPGRldGFpbHM+PHN1bW1hcnkgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPkhvdyB0byBwdXQgdGhpcyBsaXZlLCBmcmVlLCBpbiA2MCBzZWNvbmRzPC9zdW1tYXJ5PgogICAgIDxvbCBzdHlsZT0ibWFyZ2luOjlweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHg7Zm9udC1zaXplOjEyLjVweDtsaW5lLWhlaWdodDoxLjgiPgogICAgICA8bGk+Q2xpY2sgPGI+RE9XTkxPQUQgaW5kZXguaHRtbDwvYj4gYWJvdmUuPC9saT4KICAgICAgPGxpPkdvIHRvIDxiPmFwcC5uZXRsaWZ5LmNvbS9kcm9wPC9iPiDigJQgbm8gYWNjb3VudCBuZWVkZWQgdG8gc3RhcnQuPC9saT4KICAgICAgPGxpPkRyYWcgdGhlIGZpbGUgb250byB0aGUgcGFnZS4gSXQgaXMgbGl2ZSBpbiBzZWNvbmRzIG9uIGEgZnJlZSBVUkwuPC9saT4KICAgICAgPGxpPkZyZWUgY3VzdG9tIGRvbWFpbiBsYXRlcjogYSAuY29tIGlzIHJvdWdobHkg4oK5OTAwL3llYXIg4oCUIG9wdGlvbmFsLCBkbyBpdCBvbmNlIHlvdSBoYXZlIGEgcGF5aW5nIGNsaWVudC48L2xpPgogICAgICA8bGk+QmluZCB0aGF0IG5ldyBVUkwgaW4gPGI+VXB0aW1lIE1hcnNoYWw8L2I+IHNvIHRoZSBDaGFpcm1hbiBtb25pdG9ycyB5b3VyIG93biBzaXRlIHRvby48L2xpPgogICAgIDwvb2w+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+QWx0ZXJuYXRpdmVzIHRoYXQgYXJlIGVxdWFsbHkgZnJlZTogQ2xvdWRmbGFyZSBQYWdlcywgR2l0SHViIFBhZ2VzLCBWZXJjZWwuPC9kaXY+CiAgICA8L2RldGFpbHM+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc2l0ZXMgYnVpbHQgeWV0LjwvZGl2PjwvZGl2Pid9YDsKfTsKYXN5bmMgZnVuY3Rpb24gYnVpbGRTaXRlKCl7CiAgY29uc3Qgdj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NiVmVudHVyZScpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IGJyaWVmPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2JCcmllZicpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF2ICYmICFicmllZi50cmltKCkpIHJldHVybiBmbGFzaCgnUGljayBhIHZlbnR1cmUgb3Igd3JpdGUgYSBicmllZicpOwogIGZsYXNoKCdXcml0aW5nIHRoZSBzaXRlIOKAlCB0aGlzIHRha2VzIGEgbWludXRl4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zaXRlL2J1aWxkJyx7dmVudHVyZUlkOnYsYnJpZWZ9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnU2l0ZSB3cml0dGVuIOKAlCAnKyhyLmJ5dGVzLzEwMjQpLnRvRml4ZWQoMSkrJyBLQi4gUHJldmlldyBpdC4nKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRlbFNpdGUoaWQpeyBpZighY29uZmlybSgnRGVsZXRlIHRoaXMgc2l0ZT8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9zaXRlL2RlbGV0ZScse2lkfSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gTUlTU0lPTlM6IGhlIGd1aWRlcywgeW91IGV4ZWN1dGUgLS0tLS0tLS0tLSAqLwpMSVZFLm1pc3Npb25zPSgpPT57CiAgY29uc3QgTT1TLm1pc3Npb25zfHxbXSwgb3Blbj1NLmZpbHRlcihtPT5tLnN0YXR1cz09PSdPUEVOJyksIGRvbmU9TS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nRE9ORScpOwogIGNvbnN0IG1pbnM9b3Blbi5yZWR1Y2UoKGEsbSk9PmErKG0ubWludXRlc3x8MCksMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkob3Blbi5sZW5ndGgsJ09wZW4gTWlzc2lvbnMnLG9wZW4ubGVuZ3RoPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsbWlucz8nficrbWlucysnIG1pbiB0b3RhbCc6J25vdGhpbmcgcGVuZGluZycpfQogICAke2twaShkb25lLmxlbmd0aCwnQ29tcGxldGVkJywndmFyKC0tZ3JuKScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKChTLnBsYXlib29rc3x8W10pLmxlbmd0aCwnUGxheWJvb2tzJywndmFyKC0tY3kpJywnc3RlcC1ieS1zdGVwIGd1aWRlcycpfQogICAke2twaShTLnZlbnR1cmVzJiZTLnZlbnR1cmVzLmxlbmd0aD9lc2MoUy52ZW50dXJlc1swXS50aXRsZSkuc2xpY2UoMCwxOCk6J25vbmUnLCdBY3RpdmUgVmVudHVyZScsJ3ZhcigtLXB1ciknLCcnKX08L2Rpdj4KICAke29wZW4ubGVuZ3RoP29wZW4ubWFwKG09PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGYiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo3cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+RE8gVEhJUzwvc3Bhbj48YiBzdHlsZT0iZm9udC1zaXplOjE0cHgiPiR7ZXNjKG0udGl0bGUpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPn4ke20ubWludXRlc30gbWluPC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHg7Y29sb3I6I2IzYzFkMSI+JHtlc2MobS53aHkpfTwvZGl2PgogICAgJHttLnN0ZXBzLmxlbmd0aD9gPG9sIHN0eWxlPSJtYXJnaW46MCAwIDEwcHg7cGFkZGluZy1sZWZ0OjIwcHg7Zm9udC1zaXplOjEyLjVweDtsaW5lLWhlaWdodDoxLjc1Ij4KICAgICAgJHttLnN0ZXBzLm1hcChzPT5gPGxpPiR7ZXNjKHMpfTwvbGk+YCkuam9pbignJyl9PC9vbD5gOicnfQogICAgJHttLnNjcmlwdD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMDYyMjJhO2JvcmRlcjoxcHggc29saWQgIzE1NWU2Yjtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+Q09QWSBUSEVTRSBFWEFDVCBXT1JEUzo8L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42IiBpZD0ic2NyXyR7bS5pZH0iPiR7ZXNjKG0uc2NyaXB0KX08L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIHN0eWxlPSJtYXJnaW4tdG9wOjlweCIgb25jbGljaz0iY29weVNjcmlwdCgnJHttLmlkfScpIj5Db3B5IG1lc3NhZ2U8L2J1dHRvbj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMjBweCI+RG9uZSB3aGVuPC90ZD48dGQ+JHtlc2MobS5kb25lV2hlbil9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MaWtlbHkgYmxvY2tlcjwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke2VzYyhtLnJpc2spfTwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PHNwYW4+V2hhdCBoYXBwZW5lZD8gKGhlIGFkYXB0cyB0aGUgbmV4dCBtaXNzaW9uIHRvIHRoaXMpPC9zcGFuPgogICAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJub3RlXyR7bS5pZH0iIHBsYWNlaG9sZGVyPSJlLmcuIHNlbnQgdG8gNCBzaG9wcywgMSByZXBsaWVkIGFza2luZyBwcmljZSI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJkZWJyaWVmKCcke20uaWR9JywnZG9uZScpIj5NQVJLIERPTkU8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdza2lwJykiPlNraXAgdGhpczwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDpgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG9wZW4gbWlzc2lvbnMuIFByZXNzIEdFVCBNWSBORVhUIE1JU1NJT05TIGFuZCBoZSB3aWxsIHRlbGwgeW91IGV4YWN0bHkgd2hhdCB0byBkbyB0b2RheS48L2Rpdj48L2Rpdj5gfQogICR7ZG9uZS5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21wbGV0ZWQgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+JHtkb25lLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+TWlzc2lvbjwvdGg+PHRoPk91dGNvbWU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7ZG9uZS5zbGljZSgwLDE1KS5tYXAobT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke20uY2xvc2VkfHxtLnR9PC90ZD48dGQ+JHtlc2MobS50aXRsZSl9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG0ub3V0Y29tZXx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmA6Jyd9CiAgJHsoUy5wbGF5Ym9va3N8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QbGF5Ym9va3M8L2gzPgogICAke1MucGxheWJvb2tzLm1hcCgocCxpKT0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1jeSk7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyhwLnRvcGljKX08L2I+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5UGIoJHtpfSkiPkNvcHk8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjU7Zm9udC1zaXplOjEyLjVweDttYXJnaW4tdG9wOjZweCI+JHtlc2MocC50ZXh0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX0KICAgPC9kaXY+YDonJ31gOwp9OwpSRU5ERVIubWlzc2lvbnM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE1MTAwYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj7il44gTVkgTUlTU0lPTlMg4oCUIEhFIFBMQU5TLCBZT1UgRVhFQ1VURTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSBjYW5ub3QgcmVnaXN0ZXIgY29tcGFuaWVzLCBwbGFjZSBhZHMgb3IgdGFsayB0byBjdXN0b21lcnMuIFNvIGhlIGRvZXMgdGhlIG5leHQgYmVzdCB0aGluZzogYnJlYWtzIHRoZSBwYXRoIGludG8gPGI+c2luZ2xlIGFjdGlvbnMgeW91IGNhbiBmaW5pc2ggdG9kYXk8L2I+LCB3cml0ZXMgdGhlIGV4YWN0IHdvcmRzIHRvIHNlbmQsIGFuZCBhZGFwdHMgYmFzZWQgb24gd2hhdCBhY3R1YWxseSBoYXBwZW5lZC48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZ2V0TWlzc2lvbnMoKSI+R0VUIE1ZIE5FWFQgTUlTU0lPTlM8L2J1dHRvbj4KICAgJHsoUy5taXNzaW9uc3x8W10pLnNvbWUobT0+bS5zdGF0dXMhPT0nT1BFTicpPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyTWlzc2lvbnMoKSI+Q2xlYXIgaGlzdG9yeTwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDozNDBweCIgaWQ9InBiVG9waWMiIHBsYWNlaG9sZGVyPSJQbGF5Ym9vayB0b3BpYyDigJQgZS5nLiBob3cgdG8gcmVnaXN0ZXIgYSBzb2xlIHByb3ByaWV0b3JzaGlwIGluIFB1bmphYiI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0ibWFrZVBiKCkiPldSSVRFIFBMQVlCT09LPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+UGxheWJvb2sgaWRlYXM6IGdldHRpbmcgYSBSYXpvcnBheSBhY2NvdW50IMK3IEdTVCBmb3IgZnJlZWxhbmNlcnMgaW4gSW5kaWEgwrcgZmluZGluZyBzaG9wIG93bmVycycgbnVtYmVycyBsZWdhbGx5IMK3IHdyaXRpbmcgYSBmaXJzdCBpbnZvaWNlPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0ibWlzc2lvbnMiPiR7TElWRS5taXNzaW9ucygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGdldE1pc3Npb25zKCl7IGZsYXNoKCdDaGFpcm1hbiBpcyBwbGFubmluZyB5b3VyIG5leHQgbW92ZXPigKYnKTsKICB0cnl7IGNvbnN0IHY9KFMudmVudHVyZXN8fFtdKVswXTsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL21pc3Npb24vZ2VuZXJhdGUnLHt2ZW50dXJlSWQ6dj92LmlkOm51bGx9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmFkZGVkKycgbWlzc2lvbihzKSBpc3N1ZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmZ1bmN0aW9uIGNvcHlTY3JpcHQoaWQpeyBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyXycraWQpOwogIG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dChlbD9lbC5pbm5lclRleHQ6JycpOyBmbGFzaCgnTWVzc2FnZSBjb3BpZWQg4oCUIG5vdyBzZW5kIGl0JykgfQpmdW5jdGlvbiBjb3B5UGIoaSl7IG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgoUy5wbGF5Ym9va3N8fFtdKVtpXS50ZXh0KTsgZmxhc2goJ1BsYXlib29rIGNvcGllZCcpIH0KYXN5bmMgZnVuY3Rpb24gZGVicmllZihpZCxvdXRjb21lKXsKICBjb25zdCBub3RlPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbm90ZV8nK2lkKXx8e30pLnZhbHVlfHwnJzsKICBpZihvdXRjb21lPT09J2RvbmUnJiYhbm90ZS50cmltKCkpIHJldHVybiBmbGFzaCgnV3JpdGUgd2hhdCBoYXBwZW5lZCBmaXJzdCDigJQgaGUgbmVlZHMgaXQgdG8gcGxhbiB0aGUgbmV4dCBzdGVwJyk7CiAgZmxhc2goJ1JlY29yZGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9kZWJyaWVmJyx7aWQsb3V0Y29tZSxub3RlfSk7IHJlbmRlcigpOwogICAgaWYoci5hZHZpY2UpIG1vZGFsKGA8aDM+RGVicmllZjwvaDM+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTJweCI+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moci5hZHZpY2UpfTwvZGl2PjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCk7Z2V0TWlzc2lvbnMoKSI+TmV4dCBtaXNzaW9ucyDihpI8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgICBlbHNlIGZsYXNoKCdTa2lwcGVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBtYWtlUGIoKXsgY29uc3QgdD1wYlRvcGljLnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhIHRvcGljJyk7CiAgZmxhc2goJ1dyaXRpbmcgcGxheWJvb2vigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL3BsYXlib29rJyx7dG9waWM6dH0pOyByZW5kZXIoKTsgZmxhc2goJ1BsYXlib29rIHJlYWR5JykgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBDT01NQU5EIENPTlNPTEUgLS0tLS0tLS0tLSAqLwpMSVZFLmNvbW1hbmQ9KCk9PnsKICBjb25zdCBDPVMuY2hhdHx8W107CiAgcmV0dXJuIEMubGVuZ3RoP0MubWFwKG09PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4O2JvcmRlci1jb2xvcjokewogICAgIG0ud2hvPT09J09XTkVSJz8nIzIyMzQ0YSc6bS53aG89PT0nQ0hBSVJNQU4nPycjMTU1ZTZiJzonIzZiMjIzMyd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206NnB4Ij4KICAgICA8c3BhbiBjbGFzcz0idGFnICR7bS53aG89PT0nT1dORVInPyd0LWJsdSc6bS53aG89PT0nQ0hBSVJNQU4nPyd0LWN5JzondC1yZWQnfSI+JHttLndob308L3NwYW4+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke20udH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG0udGV4dCl9PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gb3JkZXJzIGdpdmVuIHlldC4gVGVsbCB0aGUgQ2hhaXJtYW4gd2hhdCB5b3Ugd2FudC48L2Rpdj48L2Rpdj4nOwp9OwpSRU5ERVIuY29tbWFuZD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMTU1ZTZiO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMDYyMjJhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+4pauIENPTU1BTkQgQ09OU09MRSDigJQgSEUgQU5TV0VSUyBPTkxZIFRPIFlPVTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5HaXZlIG9yZGVycyBpbiBwbGFpbiBFbmdsaXNoLiBIZSByZXBsaWVzIHdpdGggd2hhdCBoZSB3aWxsIGRvLCB3aGF0IGhlIG5lZWRzIGZyb20geW91LCBhbmQgd2hhdCBoZSBjYW5ub3QgZG8uIEV2ZXJ5dGhpbmcgaGVyZSBpcyBsb2dnZWQgYW5kIHN1cnZpdmVzIHJlc3RhcnRzLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPk5vIEFJIGJyYWluIGNvbm5lY3RlZCDigJQgaGUgY2Fubm90IGFuc3dlci4gQ29ubmVjdCBvbmUgb24gdGhlIEFJIEJyYWluIHBhZ2UuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPllvdXIgb3JkZXI8L3NwYW4+PHRleHRhcmVhIGlkPSJjbWRUZXh0IiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjgwcHgiCiAgICBwbGFjZWhvbGRlcj0iZS5nLiBGaW5kIG1lIHRocmVlIHdheXMgdG8gZWFybiBmcm9tIHdoYXQgSSBvd24sIHJlc2VhcmNoIHRoZSBiZXN0IG9uZSwgYW5kIGJ1aWxkIHRoZSBhZ2VudCB0ZWFtLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNlbmRDbWQoKSI+U0VORCBPUkRFUjwvYnV0dG9uPgogICAkeyhTLmNoYXR8fFtdKS5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJDbWQoKSI+Q2xlYXIgbG9nPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJjb21tYW5kIj4ke0xJVkUuY29tbWFuZCgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHNlbmRDbWQoKXsKICBjb25zdCB0PWNtZFRleHQudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGFuIG9yZGVyIGZpcnN0Jyk7CiAgZmxhc2goJ0NoYWlybWFuIGlzIHRoaW5raW5n4oCmJyk7IGNtZFRleHQudmFsdWU9Jyc7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvY29tbWFuZCcse3RleHQ6dH0pOyByZW5kZXIoKTsgfQogIGNhdGNoKGUpeyByZW5kZXIoKTsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gY2xlYXJDbWQoKXsgYXdhaXQgQVBJKCcvYXBpL2NvbW1hbmQvY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBWRU5UVVJFUyAtLS0tLS0tLS0tICovCkxJVkUudmVudHVyZXM9KCk9PnsKICBjb25zdCBJPVMuaWRlYXN8fFtdLCBWPVMudmVudHVyZXN8fFtdOwogIGNvbnN0IHJhdz1JLmZpbHRlcihpPT5pLnN0YXR1cz09PSdSQVcnKS5sZW5ndGg7CiAgY29uc3QgZG9uZT1JLmZpbHRlcihpPT5pLnN0YXR1cz09PSdSRVNFQVJDSEVEJyk7CiAgY29uc3QgYmVzdD1kb25lLnNsaWNlKCkuc29ydCgoYSxiKT0+KGIuc2NvcmV8fDApLShhLnNjb3JlfHwwKSlbMF07CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoSS5sZW5ndGgsJ0lkZWFzIEdlbmVyYXRlZCcsJ3ZhcigtLWN5KScscmF3KycgYXdhaXRpbmcgcmVzZWFyY2gnKX0KICAgJHtrcGkoZG9uZS5sZW5ndGgsJ1Jlc2VhcmNoZWQnLCd2YXIoLS1wdXIpJywnYWdhaW5zdCBsaXZlIHdlYiBkYXRhJyl9CiAgICR7a3BpKGJlc3Q/YmVzdC5zY29yZSsnLzEwMCc6J+KAlCcsJ0Jlc3QgU2NvcmUnLGJlc3QmJmJlc3Quc2NvcmU+PTYwPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKScsYmVzdD9lc2MoYmVzdC50aXRsZSkuc2xpY2UoMCwyNik6J25vbmUgeWV0Jyl9CiAgICR7a3BpKFYubGVuZ3RoLCdWZW50dXJlcyBMYXVuY2hlZCcsJ3ZhcigtLWdybiknLCd3aXRoIHJlYWwgYWdlbnQgdGVhbXMnKX08L2Rpdj4KICAke1YubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBWZW50dXJlczwvaDM+CiAgICR7Vi5tYXAodj0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1ncm4pO3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTRweCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PGI+JHtlc2Modi50aXRsZSl9PC9iPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHt2LmFnZW50cy5sZW5ndGh9IGFnZW50cyDCtyBmaXJzdCBydXBlZSBpbiB+JHt2LndlZWtzfXc8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjo1cHggMCI+JHtlc2Modi5yZXZlbnVlUGF0aCl9PC9kaXY+CiAgICAke3Yub3duZXJTdGVwcy5sZW5ndGg/YDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj5ZT1VSIFNURVBTIChvbmx5IGEgaHVtYW4gY2FuIGRvIHRoZXNlKTo8L2I+CiAgICAgPG9sIHN0eWxlPSJtYXJnaW46NXB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweCI+JHt2Lm93bmVyU3RlcHMubWFwKHM9PmA8bGk+JHtlc2Mocyl9PC9saT5gKS5qb2luKCcnKX08L29sPjwvZGl2PmA6Jyd9CiAgIDwvZGl2PmApLmpvaW4oJycpfTwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPklkZWEgUGlwZWxpbmUgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtJLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtJLmxlbmd0aD9JLm1hcChpPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkICR7CiAgICAgIGkuc3RhdHVzPT09J0xBVU5DSEVEJz8ndmFyKC0tZ3JuKSc6aS5zdGF0dXM9PT0nS0lMTEVEJz8ndmFyKC0tZGltMiknOgogICAgICBpLnZlcmRpY3Q9PT0nUFVSU1VFJz8ndmFyKC0tY3kpJzppLnZlcmRpY3Q9PT0nS0lMTCc/J3ZhcigtLW1hZyknOid2YXIoLS1hbWIpJ307CiAgICAgIHBhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTNweDske2kuc3RhdHVzPT09J0tJTExFRCc/J29wYWNpdHk6LjQ1JzonJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGI+JHtlc2MoaS50aXRsZSl9PC9iPgogICAgICAke2kuc2NvcmUhPW51bGw/YDxzcGFuIGNsYXNzPSJ0YWcgJHtpLnNjb3JlPj02MD8ndC1ncm4nOmkuc2NvcmU+PTQwPyd0LWFtYic6J3QtcmVkJ30iPiR7aS5zY29yZX0vMTAwPC9zcGFuPmA6Jyd9CiAgICAgICR7aS52ZXJkaWN0P2A8c3BhbiBjbGFzcz0idGFnICR7aS52ZXJkaWN0PT09J1BVUlNVRSc/J3QtY3knOmkudmVyZGljdD09PSdLSUxMJz8ndC1yZWQnOid0LWRpbSd9Ij4ke2kudmVyZGljdH08L3NwYW4+YDonJ30KICAgICAgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtpLnN0YXR1c308L3NwYW4+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj7igrkke2ZtdChpLnByaWNlKX08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDttYXJnaW46NHB4IDAiPiR7ZXNjKGkud2hhdCl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+QnV5ZXI6ICR7ZXNjKGkuYnV5ZXIpfTwvZGl2PgogICAgJHtpLmVkZ2U/YDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6NXB4O2ZvbnQtc2l6ZToxMnB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tbGltZSkiPlVuZmFpciBlZGdlOjwvYj4gJHtlc2MoaS5lZGdlKX08L2Rpdj5gOicnfQogICAgJHtpLndoeT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjNweCI+V2h5IG5vdzogJHtlc2MoaS53aHkpfTwvZGl2PmA6Jyd9CiAgICAke2kucmVzZWFyY2g/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6IzBhMTExOTtib3JkZXItcmFkaXVzOjdweDtwYWRkaW5nOjlweDttYXJnaW4tdG9wOjdweDtmb250LXNpemU6MTEuNXB4Ij4KICAgICAgPGRpdj4ke2VzYyhpLnJlc2VhcmNoLnJlYXNvbmluZyl9PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6NnB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5GaXJzdCBzdGVwOjwvYj4gJHtlc2MoaS5yZXNlYXJjaC5maXJzdFN0ZXApfTwvZGl2PgogICAgICA8ZGl2PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5LaWxsIHJpc2s6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmtpbGxSaXNrKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweCI+ZGVtYW5kICR7aS5yZXNlYXJjaC5kZW1hbmR9LzEwIMK3IGNvbXBldGl0aW9uICR7aS5yZXNlYXJjaC5jb21wZXRpdGlvbn0vMTAgwrcgc3BlZWQgJHtpLnJlc2VhcmNoLnNwZWVkfS8xMCDCtyBmaXQgJHtpLnJlc2VhcmNoLmZpdH0vMTA8L2Rpdj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPgogICAgICR7aS5zdGF0dXM9PT0nUkFXJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJlc2VhcmNoSWRlYSgnJHtpLmlkfScpIj5SRVNFQVJDSCBJVDwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cz09PSdSRVNFQVJDSEVEJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG9rIiBvbmNsaWNrPSJsYXVuY2hJZGVhKCcke2kuaWR9JykiPkJVSUxEIEFHRU5UIFRFQU08L2J1dHRvbj5gOicnfQogICAgICR7aS5zdGF0dXMhPT0nS0lMTEVEJyYmaS5zdGF0dXMhPT0nTEFVTkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImtpbGxJZGVhKCcke2kuaWR9JykiPktpbGw8L2J1dHRvbj5gOicnfQogICAgPC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gaWRlYXMgeWV0LiBQcmVzcyBHRU5FUkFURSBJREVBUyBhbmQgaGUgd2lsbCBpbnZlbnQgdGhlbS48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi52ZW50dXJlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKXhiBWRU5UVVJFIEVOR0lORSDigJQgSURFQVMg4oaSIFJFQUwgUkVTRUFSQ0gg4oaSIEFHRU5UIFRFQU1TPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGludmVudHMgdmVudHVyZXMsIHJlc2VhcmNoZXMgZWFjaCBvbmUgYWdhaW5zdCA8Yj5saXZlIHdlYiBzZWFyY2g8L2I+IChub3QgbW9kZWwgbWVtb3J5KSwgc2NvcmVzIGl0IG91dCBvZiAxMDAsIGFuZCBkZXNpZ25zIHRoZSBhZ2VudCB0ZWFtIHRvIGV4ZWN1dGUuIEFnZW50cyB3aG9zZSB0b29scyBtYXAgdG8gbm8gcmVhbCBjb2RlIGFyZSByZWZ1c2VkLCBzbyBub3RoaW5nIGRlY29yYXRpdmUgZ2V0cyBjcmVhdGVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wdGlvbmFsIHN0ZWVyIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KGxlYXZlIGJsYW5rIGFuZCBoZSBkZWNpZGVzKTwvc3Bhbj48L3NwYW4+CiAgIDxpbnB1dCBpZD0iaWRlYVN0ZWVyIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIGZvY3VzIG9uIEIyQiwgb3Igb25saW5lLW9ubHksIG9yIHVuZGVyIDUwMCBJTlIgdG8gc3RhcnQiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZ2VuSWRlYXMoKSI+R0VORVJBVEUgSURFQVM8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke1MuYXV0b0lkZWFzPyd0LXJlZCc6J3QtZGltJ30iPklERUEgQVVUT1BJTE9UICR7Uy5hdXRvSWRlYXM/J09OJzonT0ZGJ308L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48YnV0dG9uIGNsYXNzPSJidG4gJHtTLmF1dG9JZGVhcz8nbm8nOicnfSIgb25jbGljaz0idG9nZ2xlSWRlYUF1dG8oKSI+JHtTLmF1dG9JZGVhcz8nU1RPUCBBVVRPUElMT1QnOidFTkFCTEUgSURFQSBBVVRPUElMT1QnfTwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkF1dG9waWxvdCA9IGhlIGludmVudHMgYW5kIHJlc2VhcmNoZXMgdmVudHVyZXMgdW5wcm9tcHRlZCwgZXZlcnkgfjUgbWludXRlcy48L3NwYW4+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idmVudHVyZXMiPiR7TElWRS52ZW50dXJlcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGdlbklkZWFzKCl7IGZsYXNoKCdUaGlua2luZyB1cCB2ZW50dXJlc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9nZW5lcmF0ZScse246NSxzdGVlcjppZGVhU3RlZXIudmFsdWUudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5hZGRlZCsnIGlkZWEocykgZ2VuZXJhdGVkJyk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcmVzZWFyY2hJZGVhKGlkKXsgZmxhc2goJ1NlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvcmVzZWFyY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdTY29yZWQgJytyLnNjb3JlKycvMTAwIOKAlCAnK3IudmVyZGljdCk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gbGF1bmNoSWRlYShpZCl7IGZsYXNoKCdEZXNpZ25pbmcgYWdlbnQgdGVhbeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9sYXVuY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIuYWdlbnRzKycgYWdlbnQocykgY29tbWlzc2lvbmVkJysoci5za2lwcGVkPycgwrcgJytyLnNraXBwZWQrJyByZWplY3RlZCBhcyBub24tZXhlY3V0YWJsZSc6JycpKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBraWxsSWRlYShpZCl7IGF3YWl0IEFQSSgnL2FwaS9pZGVhL2tpbGwnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUlkZWFBdXRvKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9hdXRvcGlsb3QnLHtvbjohUy5hdXRvSWRlYXN9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLmF1dG9JZGVhcz8nQXV0b3BpbG90IE9OIOKAlCBoZSB3aWxsIGludmVudCB2ZW50dXJlcyBvbiBoaXMgb3duJzonQXV0b3BpbG90IG9mZicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KCi8qIC0tLS0tLS0tLS0gUEFZTUVOVFMgLS0tLS0tLS0tLSAqLwpMSVZFLnBheT0oKT0+ewogIGNvbnN0IE89Uy5vcmRlcnN8fFtdOwogIGNvbnN0IHBhaWQ9Ty5maWx0ZXIobz0+by5wYWlkPjApLnJlZHVjZSgoYSxvKT0+YStvLnBhaWQsMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoTy5sZW5ndGgsJ0xpbmtzIFJhaXNlZCcsJ3ZhcigtLWN5KScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKE8uZmlsdGVyKG89Pm8ucGFpZD4wKS5sZW5ndGgsJ1BhaWQnLHBhaWQ/J3ZhcigtLWdybiknOid2YXIoLS1kaW0pJywnc2V0dGxlZCcpfQogICAke2twaSgoUy5wYXk/KFMucGF5LmdhdGV3YXk9PT0ncmF6b3JwYXknPyfigrknOickJyk6JycpK2ZtdChwYWlkKSwnQ29sbGVjdGVkJywndmFyKC0tZ3JuKScsJ3JlYWwgbW9uZXknKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UGF5bWVudCBMaW5rczwvaDM+CiAgICR7Ty5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPkZvcjwvdGg+PHRoPkFtb3VudDwvdGg+PHRoPk1vZGU8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD5MaW5rPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke08ubWFwKG89PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtvLnR9PC90ZD4KICAgIDx0ZD4ke2VzYyhvLmRlc2MpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhvLmN1c3RvbWVyKX08L2Rpdj48L3RkPgogICAgPHRkPiR7by5jdXJyZW5jeX0gJHtmbXQoby5hbW91bnQpfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke28ubGl2ZT8ndC1yZWQnOid0LWRpbSd9Ij4ke28ubGl2ZT8nTElWRSc6J1RFU1QnfTwvc3Bhbj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtvLnBhaWQ+MD8ndC1ncm4nOid0LWFtYid9Ij4ke28ucGFpZD4wPydQQUlEJzplc2Moby5zdGF0dXMpfTwvc3Bhbj48L3RkPgogICAgPHRkPjxhIGhyZWY9IiR7ZXNjKG8udXJsKX0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5vcGVuIOKGlzwvYT48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gcGF5bWVudCBsaW5rcyByYWlzZWQgeWV0LjwvZGl2Pid9PC9kaXY+YDsKfTsKUkVOREVSLnBheT0oKT0+ewogIGNvbnN0IFA9Uy5wYXksIEdXPVMuZ2F0ZXdheXN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1A/KFAubGl2ZT8nIzZiMjIzMyc6JyMxYzVjM2MnKTonIzY3NDcwZid9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke1A/KFAubGl2ZT8nIzE2MGIwYyc6JyMwODE3MGYnKTonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjoke1A/KFAubGl2ZT8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknKTondmFyKC0tYW1iKSd9Ij7igrkgUEFZTUVOVFMg4oCUICR7UD8oUC5saXZlPydMSVZFIMK3IFJFQUwgTU9ORVknOidDT05ORUNURUQgwrcgVEVTVCBNT0RFJyk6J05PVCBDT05ORUNURUQnfTwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtQCiAgICA/YFZlcmlmaWVkIGFnYWluc3QgPGI+JHtlc2MoUC5nYXRld2F5KX08L2I+LCBrZXkgJHtlc2MoUC5rZXlJZCl9LiAke1AubGl2ZQogICAgICA/JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5MSVZFIE1PREUg4oCUIGxpbmtzIHlvdSByYWlzZSB0YWtlIHJlYWwgbW9uZXkuIEV2ZXJ5IGxpbmsgbmVlZHMgeW91ciBwYXNzd29yZC48L2I+JwogICAgICA6J1Rlc3QgbW9kZS4gTGlua3Mgd29yayBlbmQtdG8tZW5kIGJ1dCBtb3ZlIG5vIHJlYWwgbW9uZXkuJ31gCiAgICA6J0Nvbm5lY3QgUmF6b3JwYXkgb3IgU3RyaXBlIGJlbG93LiBLZXlzIGFyZSB2ZXJpZmllZCBhZ2FpbnN0IHRoZSByZWFsIEFQSSBiZWZvcmUgYmVpbmcgYWNjZXB0ZWQg4oCUIGEgd3Jvbmcga2V5IGlzIHJlamVjdGVkIGltbWVkaWF0ZWx5LCBub3Qgc3RvcmVkLid9PC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPjxsaT5TdGFydCB3aXRoIDxiPnRlc3Qga2V5czwvYj4uIFJhem9ycGF5IDxjb2RlPnJ6cF90ZXN0XzwvY29kZT4sIFN0cmlwZSA8Y29kZT5za190ZXN0XzwvY29kZT4g4oCUIGluc3RhbnQsIG5vIEtZQy48L2xpPgogICAgPGxpPkxpdmUga2V5cyBuZWVkIEtZQyAoUEFOICsgYmFuayBmb3IgUmF6b3JwYXkpLiBQcm92aWRlcnMgY2hhcmdlIH4yJSBwZXIgdHJhbnNhY3Rpb24g4oCUIHRoYXQgaXMgdGhlIGNvc3Qgb2YgbW92aW5nIG1vbmV5LCBub3Qgc29tZXRoaW5nIHRvIHJvdXRlIGFyb3VuZC48L2xpPgogICAgPGxpPllvdXIgc2VjcmV0IGlzIG5ldmVyIHJldHVybmVkIGJ5IHRoZSBBUEkgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2xpPjwvdWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db25uZWN0IEdhdGV3YXk8L2gzPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5HYXRld2F5PC9zcGFuPjxzZWxlY3QgaWQ9InBnU2VsIiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJwYXlIaW50KCkiPgogICAgICR7R1cubWFwKGc9PmA8b3B0aW9uIHZhbHVlPSIke2cuaWR9IiAke1AmJlAuZ2F0ZXdheT09PWcuaWQ/J3NlbGVjdGVkJzonJ30+JHtlc2MoZy5sYWJlbCl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIGlkPSJwYXlIaW50IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+S2V5IElEIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KFJhem9ycGF5IG9ubHkpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9InBnSWQiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJyenBfdGVzdF8uLi4iPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNlY3JldCBLZXk8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJwZ1NlY3JldCIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJzZWNyZXQgLyBza190ZXN0Xy4uLiI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvbm5lY3RQYXkoKSI+VkVSSUZZICZhbXA7IENPTk5FQ1Q8L2J1dHRvbj4KICAgICAke1A/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VQYXkoKSI+RGlzY29ubmVjdDwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SYWlzZSBhIFBheW1lbnQgTGluazwvaDM+CiAgICAkeyFQPyc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Q29ubmVjdCBhIGdhdGV3YXkgZmlyc3QuPC9kaXY+JzpgCiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFtb3VudCAke1AuZ2F0ZXdheT09PSdyYXpvcnBheSc/JyhJTlIpJzonKFVTRCknfTwvc3Bhbj48aW5wdXQgaWQ9InBsQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IjI1MDAiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DdXN0b21lciBuYW1lPC9zcGFuPjxpbnB1dCBpZD0icGxOYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBpcyBpdCBmb3I8L3NwYW4+PGlucHV0IGlkPSJwbERlc2MiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IldlYnNpdGUgdXB0aW1lIG1vbml0b3Jpbmcg4oCUIEF1Z3VzdCI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RW1haWw8L3NwYW4+PGlucHV0IGlkPSJwbEVtYWlsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBob25lPC9zcGFuPjxpbnB1dCBpZD0icGxQaG9uZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+PC9kaXY+CiAgICAke1AubGl2ZT9gPGxhYmVsIGNsYXNzPSJmIj48c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+TElWRSBNT0RFIOKAlCBjb25maXJtIHdpdGggeW91ciBwYXNzd29yZDwvc3Bhbj4KICAgICAgPGlucHV0IGlkPSJwbFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD5gOicnfQogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ibWFrZUxpbmsoKSI+Q1JFQVRFIExJTks8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlZnJlc2hQYXkoKSI+Q0hFQ0sgRk9SIFBBWU1FTlRTPC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Zb3UgZ2V0IGEgVVJMIHRvIHNlbmQgb3ZlciBXaGF0c0FwcCBvciBlbWFpbC4gV2hlbiBpdCBzZXR0bGVzLCB0aGUgbGVkZ2VyIHVwZGF0ZXMgYW5kIHlvdSBnZXQgYW4gZW1haWwuPC9kaXY+YH08L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGRhdGEtbGl2ZT0icGF5Ij4ke0xJVkUucGF5KCl9PC9kaXY+YDsKfTsKZnVuY3Rpb24gcGF5SGludCgpewogIGNvbnN0IGc9KFMuZ2F0ZXdheXN8fFtdKS5maW5kKHg9PnguaWQ9PT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGdTZWwnKS52YWx1ZSk7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BheUhpbnQnKTsKICBpZihnJiZlbCkgZWwuaW5uZXJIVE1MPWA8Yj4ke2VzYyhnLmxhYmVsKX08L2I+PGJyPiR7ZXNjKGcuc2lnbnVwKX08YnI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhnLmtleUhpbnQpfTwvc3Bhbj5gOwp9CmFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RQYXkoKXsKICBmbGFzaCgnVmVyaWZ5aW5nIGtleXMgYWdhaW5zdCB0aGUgcmVhbCBBUEnigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3BheS9jb25uZWN0Jyx7Z2F0ZXdheTpwZ1NlbC52YWx1ZSxrZXlJZDpwZ0lkLnZhbHVlLGtleVNlY3JldDpwZ1NlY3JldC52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIubGl2ZT8nQ09OTkVDVEVEIOKAlCBMSVZFIE1PREUsIHJlYWwgbW9uZXknOidDb25uZWN0ZWQgaW4gVEVTVCBtb2RlJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBwdXJnZVBheSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCB0aGUgcGF5bWVudCBnYXRld2F5PycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL3BheS9wdXJnZScse30pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIG1ha2VMaW5rKCl7CiAgZmxhc2goJ0NyZWF0aW5nIGxpbmvigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3BheS9saW5rJyx7YW1vdW50OitwbEFtdC52YWx1ZSxkZXNjcmlwdGlvbjpwbERlc2MudmFsdWUsCiAgICAgIG5hbWU6cGxOYW1lLnZhbHVlLGVtYWlsOnBsRW1haWwudmFsdWUscGhvbmU6cGxQaG9uZS52YWx1ZSwKICAgICAgcHc6KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbFB3Jyl8fHt9KS52YWx1ZX0pOwogICAgcmVuZGVyKCk7CiAgICBtb2RhbChgPGgzPlBheW1lbnQgbGluayByZWFkeTwvaDM+CiAgICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTJweCI+PGRpdiBzdHlsZT0id29yZC1icmVhazpicmVhay1hbGw7Y29sb3I6dmFyKC0tY3kpIj4ke2VzYyhyLnVybCl9PC9kaXY+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ibmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KCcke2VzYyhyLnVybCl9Jyk7Zmxhc2goJ0NvcGllZCcpIj5Db3B5IGxpbms8L2J1dHRvbj4KICAgICAgPGEgY2xhc3M9ImJ0biIgaHJlZj0iJHtlc2Moci51cmwpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPk9wZW4g4oaXPC9hPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hQYXkoKXsgZmxhc2goJ0NoZWNraW5nIGdhdGV3YXnigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3BheS9yZWZyZXNoJyx7fSk7IHJlbmRlcigpOwogICAgZmxhc2goci51cGRhdGVkP3IudXBkYXRlZCsnIG9yZGVyKHMpIHVwZGF0ZWQnOidObyBjaGFuZ2VzJyk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KCi8qIC0tLS0tLS0tLS0gREVFUCBSRVNFQVJDSCAtLS0tLS0tLS0tICovClJFTkRFUi5yZXNlYXJjaD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMWMzZjc1O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMDgxMzFmLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWJsdSkiPvCfjJAgREVFUCBSRVNFQVJDSCDigJQgTElWRSBGUk9NIFRIRSBPUEVOIFdFQjwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSBkb2VzIG5vdCBzdG9yZSB0aGUgd29ybGQncyBkYXRhIOKAlCBub2JvZHkgY2FuLiBJbnN0ZWFkIGhlIDxiPmZldGNoZXMgaXQgbGl2ZSB0aGUgbW9tZW50IHlvdSBhc2s8L2I+LCB3aGljaCBpcyBiZXR0ZXIsIGJlY2F1c2Ugc3RvcmVkIGRhdGEgaXMgc3RhbGUgd2l0aGluIGRheXMuIFNvdXJjZXM6IER1Y2tEdWNrR28sIFdpa2lwZWRpYSwgV29ybGQgQmFuaywgbGl2ZSBGWC4gTm8gQVBJIGtleSwgbm8gcGFpZCBzZWFyY2guPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5EZWVwIGRpdmU8L2I+IHNlYXJjaGVzIDUgZGlmZmVyZW50IGFuZ2xlcywgZGVkdXBsaWNhdGVzLCBhZGRzIG9wZW4gZGF0YXNldHMsIHRoZW4gcmVhc29ucyBvdmVyIHRoZSBsb3QuPC9saT4KICAgPGxpPjxiPlJlYWQgcGFnZTwvYj4gcHVsbHMgdGhlIGZ1bGwgdGV4dCBvZiBhbnkgVVJMIOKAlCBjb21wZXRpdG9yIHNpdGVzLCBwcmljZSBsaXN0cywgZ292ZXJubWVudCBwYWdlcy48L2xpPgogICA8bGk+SGUgaXMgaW5zdHJ1Y3RlZCB0byBzdGF0ZSB3aGF0IGhlIGNvdWxkIDxiPm5vdDwvYj4gZmluZCwgcmF0aGVyIHRoYW4gZmlsbGluZyBnYXBzIHdpdGggaW52ZW50aW9uLjwvbGk+CiAgPC91bD48L2Rpdj4KICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0IOKAlCByZXNlYXJjaCBuZWVkcyByZWFzb25pbmcgdG8gYmUgdXNlZnVsLjwvZGl2PjwvZGl2Pic6Jyd9CiA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGVlcCBEaXZlIGEgVG9waWM8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRvcGljPC9zcGFuPjxpbnB1dCBpZD0iZHZUb3BpYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiB1cHRpbWUgbW9uaXRvcmluZyBkZW1hbmQgZm9yIEx1ZGhpYW5hIGUtY29tbWVyY2UiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UmVnaW9uPC9zcGFuPjxpbnB1dCBpZD0iZHZSZWdpb24iIGNsYXNzPSJpbiIgdmFsdWU9Ikx1ZGhpYW5hIFB1bmphYiBJbmRpYSI+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvRGl2ZSgpIj5JTlZFU1RJR0FURTwvYnV0dG9uPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5UYWtlcyB+MTVzLiBGaXZlIHNlYXJjaGVzIHBsdXMgb3BlbiBkYXRhLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZWFkIEFueSBQYWdlPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5VUkw8L3NwYW4+PGlucHV0IGlkPSJyZFVybCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly9jb21wZXRpdG9yLmNvbS9wcmljaW5nIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgZG8geW91IHdhbnQgdG8ga25vdz8gKG9wdGlvbmFsKTwvc3Bhbj48aW5wdXQgaWQ9InJkQXNrIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJ3aGF0IGRvIHRoZXkgY2hhcmdlIGFuZCB3aGF0IGlzIG1pc3NpbmciPjwvbGFiZWw+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb1JlYWQoKSI+UkVBRCBJVDwvYnV0dG9uPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5QdWxscyB1cCB0byAxMiwwMDAgY2hhcmFjdGVycyBvZiByZWFsIHBhZ2UgdGV4dC48L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBpZD0icmVzT3V0Ij48L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBkb0RpdmUoKXsKICBjb25zdCB0PWR2VG9waWMudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGEgdG9waWMnKTsKICByZXNPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+U2VhcmNoaW5nIHRoZSBsaXZlIHdlYuKApjwvZGl2PjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9yZXNlYXJjaC9kaXZlJyx7dG9waWM6dCxyZWdpb246ZHZSZWdpb24udmFsdWV9KTsKICAgIHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5GaW5kaW5ncyA8c3BhbiBjbGFzcz0idGFnIHQtYmx1Ij4ke2ZtdChyLmV2aWRlbmNlKX0gY2hhcnMgb2YgZXZpZGVuY2U8L3NwYW4+PC9oMz4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NSI+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj5gOwogIH1jYXRjaChlKXsgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PjwvZGl2PmAgfQp9CmFzeW5jIGZ1bmN0aW9uIGRvUmVhZCgpewogIGNvbnN0IHU9cmRVcmwudmFsdWUudHJpbSgpOyBpZighdSkgcmV0dXJuIGZsYXNoKCdQYXN0ZSBhIFVSTCcpOwogIHJlc091dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5GZXRjaGluZyBwYWdl4oCmPC9kaXY+PC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Jlc2VhcmNoL3JlYWQnLHt1cmw6dSxhc2s6cmRBc2sudmFsdWUudHJpbSgpfSk7CiAgICByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+JHtlc2Moci50aXRsZSl9IDxzcGFuIGNsYXNzPSJ0YWcgdC1ibHUiPiR7Zm10KHIuY2hhcnMpfSBjaGFycyByZWFkPC9zcGFuPjwvaDM+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjUiPiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+YDsKICB9Y2F0Y2goZSl7IHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gIH0KfQoKLyogLS0tLS0tLS0tLSBBSSBCUkFJTiAtLS0tLS0tLS0tICovClJFTkRFUi5icmFpbj0oKT0+ewogIGNvbnN0IEw9Uy5sbG0sIFBWPVMucHJvdmlkZXJzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtMPycjMWM1YzNjJzonIzY3NDcwZid9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke0w/JyMwODE3MGYnOicjMTUxMDBhJ30sIzBhMGYxNikiPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7TD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWFtYiknfSI+4peIIEFJIEJSQUlOIOKAlCAke0w/J0NPTk5FQ1RFRCc6J05PVCBDT05ORUNURUQnfTwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtMCiAgICA/YEFnZW50cyBjYW4gdGhpbmsuIENvbm5lY3RlZCB0byA8Yj4ke2VzYyhMLnByb3ZpZGVyKX08L2I+IHJ1bm5pbmcgPGI+JHtlc2MoTC5tb2RlbCl9PC9iPi4gS2V5ICR7ZXNjKEwua2V5KX0uYAogICAgOidZb3VyIGFnZW50cyBjYW4gbWVhc3VyZSB0aGluZ3MgYnV0IGNhbm5vdCA8Yj5yZWFzb248L2I+IHlldC4gQ29ubmVjdCBhIGZyZWUgbW9kZWwgYmVsb3cgYW5kIHRoZXkgZ2FpbiB0aGUgYWJpbGl0eSB0byBkaWFnbm9zZSwgd3JpdGUsIGFuYWx5c2UgYW5kIHN0cmF0ZWdpc2UuJ308L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+PGxpPkV2ZXJ5IHByb3ZpZGVyIGJlbG93IGlzIDxiPmdlbnVpbmVseSBmcmVlPC9iPiDigJQgbm8gY3JlZGl0IGNhcmQuPC9saT4KICAgIDxsaT5Zb3VyIGtleSBpcyBzdG9yZWQgbG9jYWxseSBhbmQgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvbGk+PC91bD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKakSBXQU5UIEhJTSBGVUxMWSBJTkRFUEVOREVOVD8g4oCUIFJFQUQgVEhJUzwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5BIHRoaW5raW5nIGJyYWluIGNhbm5vdCBiZSBjb25qdXJlZCBmcm9tIG5vdGhpbmcuIFRyYWluaW5nIG9uZSBjb3N0cyBtaWxsaW9ucyBpbiBHUFUgdGltZS4gRXZlcnkgQUkgb24gZWFydGgg4oCUIGluY2x1ZGluZyB0aGlzIG9uZSDigJQgcnVucyB3ZWlnaHRzIHRyYWluZWQgYnkgc29tZW9uZSB3aXRoIGEgZGF0YSBjZW50cmUuIFRoZSBob25lc3QgcXVlc3Rpb24gaXMgbm90IDxlbT4iaGlzIGJyYWluIG9yIHRoZWlycyI8L2VtPiBidXQgPGI+IndobyBjYW4gc3dpdGNoIGl0IG9mZiI8L2I+LjwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPk9sbGFtYSBpcyB0aGUgYW5zd2VyIHRvIHRoYXQuPC9iPiBUaGUgbW9kZWwgZmlsZSBzaXRzIG9uIHlvdXIgb3duIGRpc2suIE5vIGtleSwgbm8gYWNjb3VudCwgbm8gcmF0ZSBsaW1pdCwgbm8gdGVybXMgb2Ygc2VydmljZS4gSXQgd29ya3Mgd2l0aCB0aGUgaW50ZXJuZXQgdW5wbHVnZ2VkLiBOb2JvZHkgY2FuIHJldm9rZSBpdCwgcmVhZCB5b3VyIHByb21wdHMsIG9yIGNoYW5nZSB0aGUgZGVhbC4gVGhhdCBpcyByZWFsIHNvdmVyZWlnbnR5IOKAlCB0aGUgb25seSBjb3N0IGlzIHlvdXIgaGFyZHdhcmUuPC9kaXY+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+MS4gSW5zdGFsbDwvdGQ+PHRkPkRvd25sb2FkIGZyb20gPGI+b2xsYW1hLmNvbTwvYj4gKGZyZWUsIFdpbmRvd3MvTWFjL0xpbnV4KTwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4yLiBHZXQgYSBtb2RlbDwvdGQ+PHRkPkluIHRlcm1pbmFsOiA8Y29kZT5vbGxhbWEgcHVsbCBsbGFtYTMuMjwvY29kZT4g4oCUIGFib3V0IDIgR0I8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+My4gQ29ubmVjdDwvdGQ+PHRkPkNob29zZSA8Yj5PbGxhbWE8L2I+IGFib3ZlLCBsZWF2ZSB0aGUga2V5IGJsYW5rLCBwcmVzcyBDT05ORUNUPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJpZ2dlciBicmFpbjwvdGQ+PHRkPjxjb2RlPm9sbGFtYSBwdWxsIHF3ZW4yLjU6MTRiPC9jb2RlPiBpZiB5b3UgaGF2ZSAxNiBHQisgUkFNPC90ZD48L3RyPgogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPjxiPlRoZSB0cmFkZS1vZmYsIHN0YXRlZCBwbGFpbmx5OjwvYj4gYSBsb2NhbCBtb2RlbCBvbiBhIG5vcm1hbCBsYXB0b3AgaXMgc2xvd2VyIGFuZCBsZXNzIGNhcGFibGUgdGhhbiBHcm9xJ3MgZnJlZSBjbG91ZCBtb2RlbHMuIFlvdSBhcmUgZXhjaGFuZ2luZyByYXcgcG93ZXIgZm9yIHRvdGFsIGNvbnRyb2wuIEFsc28g4oCUIHRoaXMgUmVuZGVyIGluc3RhbmNlIGNhbm5vdCByZWFjaCBhbiBPbGxhbWEgcnVubmluZyBvbiB5b3VyIFBDOyBsb2NhbCBicmFpbiBtZWFucyBydW5uaW5nIHRoZSBDaGFpcm1hbiBsb2NhbGx5IHRvby48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbm5lY3QgYSBGcmVlIE1vZGVsPC9oMz4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UHJvdmlkZXI8L3NwYW4+PHNlbGVjdCBpZD0ibHBQcm92IiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJwcm92SGludCgpIj4KICAgICAke1BWLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSIgJHtMJiZMLnByb3ZpZGVyPT09cC5pZD8nc2VsZWN0ZWQnOicnfT4ke2VzYyhwLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9InByb3ZIaW50IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QVBJIEtleSA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihub3QgbmVlZGVkIGZvciBPbGxhbWEpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImxwS2V5IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InBhc3RlIHlvdXIgZnJlZSBrZXkiPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk1vZGVsIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KGJsYW5rID0gcHJvdmlkZXIgZGVmYXVsdCk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibHBNb2RlbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ibGVhdmUgYmxhbmsiIGxpc3Q9Im1vZGVsTGlzdCI+CiAgICAgPGRhdGFsaXN0IGlkPSJtb2RlbExpc3QiPjwvZGF0YWxpc3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFzZSBVUkwgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ob25seSBmb3IgQ3VzdG9tIOKAlCBhbnkgT3BlbkFJLWNvbXBhdGlibGUgQVBJKTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscEhvc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbS92MSI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvbm5lY3RMTE0oKSI+Q09OTkVDVCBCUkFJTjwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0idGVzdExMTSgpIj5URVNUIElUPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJmZXRjaE1vZGVscygpIj5GRVRDSCBMSVZFIE1PREVMUzwvYnV0dG9uPgogICAgICR7TD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZUxMTSgpIj5EaXNjb25uZWN0PC9idXR0b24+JzonJ308L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPlByb3ZpZGVycyByZXRpcmUgbW9kZWxzIHdpdGhvdXQgbm90aWNlLiBJZiBURVNUIElUIHNheXMgTU9ERUwgUkVUSVJFRCwgcHJlc3MgRkVUQ0ggTElWRSBNT0RFTFMgYW5kIHBpY2sgb25lIGZyb20gdGhlIGxpc3QuPC9kaXY+PC9kaXY+CiAgICR7TD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1hbWIpIj4KICAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4oeEIFNXSVRDSCBNT0RFTCDigJQgS0VFUFMgWU9VUiBLRVk8L2gzPgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkN1cnJlbnRseSBydW5uaW5nIDxiPiR7ZXNjKEwubW9kZWwpfTwvYj4gb24gJHtlc2MoTC5wcm92aWRlcil9LiBQcm92aWRlcnMgcmV0aXJlIG1vZGVscyB3aXRob3V0IG5vdGljZSDigJQgc3dhcCBpdCBoZXJlIHdpdGhvdXQgZGlzY29ubmVjdGluZyBvciByZS1wYXN0aW5nIHlvdXIga2V5LjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICA8aW5wdXQgaWQ9InN3TW9kZWwiIGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyODBweCIgcGxhY2Vob2xkZXI9InR5cGUgYSBtb2RlbCBuYW1lIiB2YWx1ZT0iJHtlc2MoTC5tb2RlbCl9Ij4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic3dpdGNoTW9kZWwoKSI+U1dJVENIPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJmZXRjaE1vZGVscygpIj5GRVRDSCBMSVZFIExJU1Q8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RMTE0oKSI+VEVTVCBJVDwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+S25vd24gd29ya2luZyBvbiBHcm9xIHJpZ2h0IG5vdyDigJQgY2xpY2sgdG8gdXNlOjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93Ij4ke1snb3BlbmFpL2dwdC1vc3MtMTIwYicsJ29wZW5haS9ncHQtb3NzLTIwYicsJ3F3ZW4vcXdlbjMuNi0yN2InXQogICAgICAubWFwKG09PmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InF1aWNrTW9kZWwoJyR7bX0nKSI+JHttfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogICA8L2Rpdj5gOicnfQogICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7KFMuY29vbGRvd258fDApPyd2YXIoLS1tYWcpJzondmFyKC0tc3Ryb2tlKSd9Ij4KICAgIDxoMz5CYWNrdXAgUHJvdmlkZXJzIDxzcGFuIGNsYXNzPSJ0YWcgJHsoUy5sbG1CYWNrdXBzfHxbXSkubGVuZ3RoPyd0LWdybic6J3QtZGltJ30iPiR7KFMubGxtQmFja3Vwc3x8W10pLmxlbmd0aH0gU1BBUkU8L3NwYW4+PC9oMz4KICAgICR7KFMuY29vbGRvd258fDApP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPjxiPlFVT1RBIENPT0xET1dOIOKAlCAke01hdGguY2VpbChTLmNvb2xkb3duLzYwKX0gbWluIGxlZnQuPC9iPiBUaGUgZnJlZSB0aWVyIHRocm90dGxlZC4gQUkgd29yayBpcyBwYXVzZWQgc28gdGhlIGxpbWl0IGNhbiByZXNldDsgbW9uaXRvcmluZyBrZWVwcyBydW5uaW5nLiBBZGQgYSBiYWNrdXAgYmVsb3cgYW5kIHdvcmsgY29udGludWVzIHN0cmFpZ2h0IHRocm91Z2ggdGhlIG5leHQgbGltaXQuCiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY2xlYXJDb29sKCkiPkNsZWFyIGNvb2xkb3duIG5vdzwvYnV0dG9uPjwvZGl2PjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+RnJlZSB0aWVycyB0aHJvdHRsZS4gQWRkIDxiPnVwIHRvIDQwIGtleXM8L2I+IOKAlCBmcm9tIGRpZmZlcmVudCBwcm92aWRlcnMsIG9yIHNldmVyYWwga2V5cyBmcm9tIHRoZSBzYW1lIG9uZS4gV2hlbiBhbnkga2V5IGlzIHJhdGUtbGltaXRlZCBpdCBpcyBwYXJrZWQgZm9yIDEwIG1pbnV0ZXMgYW5kIHRoZSBDaGFpcm1hbiByb3RhdGVzIHRvIHRoZSBuZXh0IGF1dG9tYXRpY2FsbHkuIE5vdGhpbmcgc3RvcHMuPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlByb3ZpZGVyPC9zcGFuPjxzZWxlY3QgaWQ9ImJrUHJvdiIgY2xhc3M9ImluIj4KICAgICAgJHsoUy5wcm92aWRlcnN8fFtdKS5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iPiR7ZXNjKHAubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BUEkga2V5PC9zcGFuPjxpbnB1dCBpZD0iYmtLZXkiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TW9kZWwgKGJsYW5rID0gZGVmYXVsdCk8L3NwYW4+PGlucHV0IGlkPSJia01vZGVsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJsZWF2ZSBibGFuayI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJhc2UgVVJMIChDdXN0b20gb25seSk8L3NwYW4+PGlucHV0IGlkPSJia0hvc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vYXBpLmRlZXBzZWVrLmNvbS92MSI+PC9sYWJlbD4KICAgIDwvZGl2PgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFkZEJhY2t1cCgpIj5BREQgQkFDS1VQPC9idXR0b24+CiAgICAkeyhTLmxsbUJhY2t1cHN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+IzwvdGg+PHRoPlByb3ZpZGVyPC90aD48dGg+TW9kZWw8L3RoPjx0aD5LZXk8L3RoPjx0aD5TZXJ2ZWQ8L3RoPjx0aD5TdGF0ZTwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICAke1MubGxtQmFja3Vwcy5tYXAoKGIsaSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtpKzF9PC90ZD48dGQ+JHtlc2MoYi5wcm92aWRlcil9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYi5tb2RlbCl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhiLmtleSl9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtiLm9rfHwwfSR7Yi5mYWlsPycgLyAnK2IuZmFpbCsn4pyXJzonJ308L3RkPgogICAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2IuY29vbGVkPyd0LWFtYic6J3QtZ3JuJ30iPiR7Yi5jb29sZWQ/J0NPT0xJTkcnOidSRUFEWSd9PC9zcGFuPjwvdGQ+CiAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InJtQmFja3VwKCR7aX0pIj5SZW1vdmU8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5SZWNvbW1lbmRlZCBzcGFyZXM6IDxiPkdvb2dsZSBBSSBTdHVkaW88L2I+ICgxLDUwMC9kYXkpLCA8Yj5DZXJlYnJhczwvYj4gKDFNIHRva2Vucy9kYXkpLCA8Yj5OVklESUEgTklNPC9iPi4gRGlmZmVyZW50IGNvbXBhbmllcyBtZWFucyBzZXBhcmF0ZSBxdW90YXMuPC9kaXY+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5XaGF0IEFnZW50cyBHYWluPC9oMz4KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTMwcHgiPmFpLmJyaWVmPC90ZD48dGQ+RXhlY3V0aXZlIGJyaWVmIHdyaXR0ZW4gZnJvbSB5b3VyIHJlYWwgc3lzdGVtIHN0YXRlPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5pbmNpZGVudDwvdGQ+PHRkPlJhbmtlZCBkaWFnbm9zaXMgb2YgYW55IHNpdGUgdGhhdCBnb2VzIGRvd248L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLnJldmVudWU8L3RkPjx0ZD5Db25jcmV0ZSBtb25leS1tYWtpbmcgcm91dGVzIGZyb20gd2hhdCB5b3UgYWN0dWFsbHkgaGF2ZTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkuY2xpZW50X3JlcG9ydDwvdGQ+PHRkPkNsaWVudC1yZWFkeSB1cHRpbWUgcmVwb3J0IHlvdSBjYW4gc2VuZCBhbmQgY2hhcmdlIGZvcjwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BZGQgdGhlc2Ugb24gdGhlIExpdmUgT3BlcmF0aW9ucyBwYWdlIGFzIHN0YW5kaW5nIG9yZGVycywgb3IgcnVuIHRoZW0gb24gZGVtYW5kIGZyb20gQWdlbnQgV29yay48L2Rpdj48L2Rpdj4KICA8L2Rpdj5gfTsKZnVuY3Rpb24gcHJvdkhpbnQoKXsKICBjb25zdCBwPShTLnByb3ZpZGVyc3x8W10pLmZpbmQoeD0+eC5pZD09PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdscFByb3YnKS52YWx1ZSk7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb3ZIaW50Jyk7CiAgaWYocCYmZWwpIGVsLmlubmVySFRNTD1gPGI+JHtlc2MocC5sYWJlbCl9PC9iPjxicj4ke2VzYyhwLnNpZ251cCl9PGJyPkRlZmF1bHQgbW9kZWw6IDxjb2RlPiR7ZXNjKHAubW9kZWwpfTwvY29kZT5gOwp9CmFzeW5jIGZ1bmN0aW9uIGNvbm5lY3RMTE0oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vY29ubmVjdCcse3Byb3ZpZGVyOmxwUHJvdi52YWx1ZSxrZXk6bHBLZXkudmFsdWUsbW9kZWw6bHBNb2RlbC52YWx1ZSxob3N0Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBIb3N0Jyl8fHt9KS52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdCcmFpbiBjb25uZWN0ZWQg4oCUIG5vdyBwcmVzcyBURVNUIElUJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiB0ZXN0TExNKCl7IGZsYXNoKCdUaGlua2luZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbGxtL3Rlc3QnLHt9KTsgcmVuZGVyKCk7CiAgICBtb2RhbChgPGgzPkFJIEJyYWluIE9ubGluZTwvaDM+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTJweCI+PGRpdj4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhyLm1vZGVsKX0gwrcgJHtyLm1zfW1zPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY2xvc2VNb2RhbCgpO2dvKCd3b3JrJykiPkdpdmUgaXQgd29yayDihpI8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlTExNKCl7IGlmKCFjb25maXJtKCdEaXNjb25uZWN0IHRoZSBBSSBicmFpbj8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9sbG0vcHVyZ2UnLHt9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBzd2l0Y2hNb2RlbCgpewogIGNvbnN0IG09KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzd01vZGVsJyl8fHt9KS52YWx1ZTsKICBpZighbXx8IW0udHJpbSgpKSByZXR1cm4gZmxhc2goJ1R5cGUgYSBtb2RlbCBuYW1lJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL21vZGVsJyx7bW9kZWw6bS50cmltKCl9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnU3dpdGNoZWQgdG8gJyttLnRyaW0oKSsnIOKAlCBub3cgcHJlc3MgVEVTVCBJVCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcXVpY2tNb2RlbChtKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vbW9kZWwnLHttb2RlbDptfSk7IHJlbmRlcigpOyBmbGFzaCgnU3dpdGNoZWQgdG8gJyttKTsKICAgIHNldFRpbWVvdXQodGVzdExMTSwgNDAwKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGFkZEJhY2t1cCgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9iYWNrdXAvYWRkJyx7cHJvdmlkZXI6YmtQcm92LnZhbHVlLGtleTpia0tleS52YWx1ZSxtb2RlbDpia01vZGVsLnZhbHVlLGhvc3Q6KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdia0hvc3QnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0JhY2t1cCBhZGRlZCDigJQgcXVvdGEgbGltaXRzIHdpbGwgbm8gbG9uZ2VyIHN0b3AgeW91Jyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBybUJhY2t1cChpKXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9iYWNrdXAvcmVtb3ZlJyx7aW5kZXg6aX0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyQ29vbCgpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Nvb2xkb3duL2NsZWFyJyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnQ29vbGRvd24gY2xlYXJlZCcpIH0KYXN5bmMgZnVuY3Rpb24gZmV0Y2hNb2RlbHMoKXsKICBmbGFzaCgnQXNraW5nIHByb3ZpZGVyIHdoYXQgaXQgc2VydmVzIHRvZGF54oCmJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbGxtL21vZGVscycse3Byb3ZpZGVyOmxwUHJvdi52YWx1ZSxrZXk6bHBLZXkudmFsdWV9KTsKICAgIGlmKCFyLm1vZGVscy5sZW5ndGgpIHJldHVybiBmbGFzaCgnUHJvdmlkZXIgcmV0dXJuZWQgbm8gY2hhdCBtb2RlbHMnKTsKICAgIG1vZGFsKGA8aDM+TGl2ZSBtb2RlbHMgb24gJHtlc2MobHBQcm92LnZhbHVlKX08L2gzPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke3IubW9kZWxzLmxlbmd0aH0gYXZhaWxhYmxlIHJpZ2h0IG5vdy4gQ2xpY2sgb25lIHRvIHVzZSBpdC48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJkaXJMaXN0IiBzdHlsZT0ibWF4LWhlaWdodDozNDBweCI+JHtyLm1vZGVscy5tYXAobT0+CiAgICAgICBgPGJ1dHRvbiBvbmNsaWNrPSJwaWNrTW9kZWwoJyR7ZXNjKG0pfScpIj4ke2VzYyhtKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcGlja01vZGVsKG0peyBjbG9zZU1vZGFsKCk7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwTW9kZWwnKTsgaWYoZWwpIGVsLnZhbHVlPW07CiAgZmxhc2goJ01vZGVsIHNldCB0byAnK20rJyDigJQgcHJlc3MgQ09OTkVDVCBCUkFJTiB0aGVuIFRFU1QgSVQnKTsgfQoKLyogLS0tLS0tLS0tLSBBR0VOVCBXT1JLIC0tLS0tLS0tLS0gKi8KY29uc3QgUVVJQ0s9WwogWydFeGVjdXRpdmUgYnJpZWYnLCdTdW1tYXJpc2UgbXkgc3lzdGVtIHN0YXRlIGFuZCB0ZWxsIG1lIHRoZSBzaW5nbGUgbW9zdCB1cmdlbnQgdGhpbmcgdG8gZml4LiBCZSBibHVudC4nXSwKIFsnTWFrZSBtb25leScsJ09ubHkgcHJvcG9zZSBvZmZlcnMgZGVsaXZlcmVkIHVzaW5nIE1ZIHVwdGltZSBtb25pdG9yaW5nIHN5c3RlbSAoMjQvNyBIVFRQIHByb2JpbmcsIFRMUyBleHBpcnkgYWxlcnRzLCBpbnN0YW50IG91dGFnZSBlbWFpbCwgYXZhaWxhYmlsaXR5IGFuZCBwOTUgcmVwb3J0aW5nKS4gVFJVVEggUlVMRTogSSBoYXZlIG5ldmVyIG1vbml0b3JlZCBhbnkgY2xpZW50IHNpdGUgYW5kIGhhdmUgbm8gdHJhY2sgcmVjb3JkLiBUaGUgb3V0cmVhY2ggbWVzc2FnZSBtdXN0IGNvbnRhaW4gWkVSTyBjbGFpbXMgSSBjYW5ub3QgcHJvdmUg4oCUIG5vICJJIG5vdGljZWQgb3V0YWdlcyBvbiBsb2NhbCBzaXRlcyIsIG5vIGludmVudGVkIHJldmVudWUgZmlndXJlcywgbm8gdW52ZXJpZmllZCBzdGF0aXN0aWNzLiBMZWFkIHdpdGggYSBmcmVlIHRyaWFsLCBub3QgYSBmYWtlIG9ic2VydmF0aW9uLiBWZXJpZnkgYW55IGFyaXRobWV0aWMgeW91IHN0YXRlLiBHaXZlIDMgb2ZmZXJzOiB0aGUgb2ZmZXIgaW4gb25lIHNlbnRlbmNlLCB0aGUgTHVkaGlhbmEgYnVzaW5lc3MgdHlwZSBhbmQgaXRzIHJlYWwgcGFpbiwgbW9udGhseSBJTlIgcHJpY2Ugd2l0aCBzb3VuZCByZWFzb25pbmcsIHRoZSBsaXRlcmFsIGZpcnN0IFdoYXRzQXBwIG1lc3NhZ2UgdW5kZXIgNTAgd29yZHMsIGFuZCB0aGUgYmlnZ2VzdCBvYmplY3Rpb24gd2l0aCBhbiBob25lc3QgY291bnRlci4gQ29sZCBvdXRyZWFjaCBjbG9zZXMgMS0zJS4nXSwKIFsnRmluZCBwcm9zcGVjdHMnLCdMaXN0IDEwIHNwZWNpZmljIGJ1c2luZXNzIHR5cGVzIGluIEx1ZGhpYW5hIHRoYXQgbG9zZSByZWFsIG1vbmV5IHdoZW4gdGhlaXIgd2Vic2l0ZSBnb2VzIGRvd24sIHJhbmtlZCBieSBob3cgbXVjaCB0aGV5IGxvc2UgcGVyIGhvdXIuIEZvciBlYWNoLCBzYXkgd2hlcmUgSSBjYW4gZmluZCB0aGVpciBjb250YWN0IGRldGFpbHMgZm9yIGZyZWUuJ10sCiBbJ0NsaWVudCBwaXRjaCcsJ1dyaXRlIGEgV2hhdHNBcHAgbWVzc2FnZSBvZmZlcmluZyBmcmVlIDE0LWRheSB3ZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgbG9jYWwgYnVzaW5lc3Mgb3duZXIuIFBsYWluIEluZGlhbiBFbmdsaXNoLCBubyBtYXJrZXRpbmcgbGFuZ3VhZ2UsIG5vIGVtb2ppLiBVbmRlciA0NSB3b3Jkcy4gVGhlIGdvYWwgaXMgYSByZXBseSwgbm90IGEgc2FsZS4nXSwKIFsnSGFuZGxlIG9iamVjdGlvbnMnLCdBIEx1ZGhpYW5hIGJ1c2luZXNzIG93bmVyIHNheXMgIm15IHdlYnNpdGUgbmV2ZXIgZ29lcyBkb3duLCBJIGRvbiBub3QgbmVlZCB0aGlzIi4gR2l2ZSBtZSB0aHJlZSBob25lc3QgcmVwbGllcyB0aGF0IGRvIG5vdCBleGFnZ2VyYXRlIG9yIHVzZSBmZWFyIHRhY3RpY3MuJ10sCiBbJ0ludm9pY2UgdGVtcGxhdGUnLCdXcml0ZSBhIHNpbXBsZSBtb250aGx5IGludm9pY2UgZm9yIHdlYnNpdGUgdXB0aW1lIG1vbml0b3JpbmcsIHJlYWR5IHRvIGZpbGwgaW4sIHN1aXRhYmxlIGZvciBhIHNtYWxsIEluZGlhbiBidXNpbmVzcy4gSW5jbHVkZSBHU1QgcGxhY2Vob2xkZXIgYW5kIFVQSSBwYXltZW50IGxpbmUuJ10KXTsKUkVOREVSLndvcms9KCk9PnsKICBjb25zdCBPPVMub3V0cHV0c3x8W107CiAgcmV0dXJuIGAkeyFTLmxsbT9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQlJBSU4gQ09OTkVDVEVEPC9oMz4KICAgPGRpdj5BZ2VudHMgY2Fubm90IHRoaW5rIHlldC4gPGIgb25jbGljaz0iZ28oJ2JyYWluJykiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSk7Y3Vyc29yOnBvaW50ZXI7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZSI+Q29ubmVjdCBhIGZyZWUgbW9kZWw8L2I+IGZpcnN0IOKAlCB0YWtlcyBhYm91dCAyIG1pbnV0ZXMgYW5kIG5lZWRzIG5vIGNyZWRpdCBjYXJkLjwvZGl2PjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdpdmUgdGhlIENoYWlybWFuIFdvcmsgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QTEFJTiBFTkdMSVNIPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UeXBlIGFueSBpbnN0cnVjdGlvbi4gQSByZWFsIG1vZGVsIGV4ZWN1dGVzIGl0IGFuZCB0aGUgcmVzdWx0IGlzIHNhdmVkIGJlbG93LjwvZGl2PgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkluc3RydWN0aW9uPC9zcGFuPjx0ZXh0YXJlYSBpZD0id2tQcm9tcHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6OTBweCIKICAgICBwbGFjZWhvbGRlcj0iZS5nLiBXcml0ZSBhIG9uZS1wYWdlIHByb3Bvc2FsIG9mZmVyaW5nIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgTHVkaGlhbmEgY2xvdGhpbmcgc2hvcCwgcHJpY2VkIGluIElOUi4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9Xb3JrKCkiPkVYRUNVVEU8L2J1dHRvbj4KICAgICR7Ty5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJXb3JrKCkiPkNsZWFyIHJlc3VsdHM8L2J1dHRvbj4nOicnfTwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPlF1aWNrIHRhc2tzOjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93Ij4ke1FVSUNLLm1hcCgocSxpKT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icXVpY2soJHtpfSkiPiR7ZXNjKHFbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PjwvZGl2PjwvZGl2PgogICR7Ty5sZW5ndGg/Ty5tYXAoKG8saSk9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1wdXIiPiR7ZXNjKG8udGFnKX08L3NwYW4+PGI+JHtlc2Moby5hZ2VudCl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtvLnR9IMK3ICR7by5tc31tcyDCtyAke28udG9rZW5zfSB0b2tlbnM8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8udGV4dCl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weU91dCgke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHdvcmsgcHJvZHVjZWQgeWV0LjwvZGl2PjwvZGl2Pid9YH07CmFzeW5jIGZ1bmN0aW9uIGRvV29yaygpewogIGNvbnN0IHA9d2tQcm9tcHQudmFsdWUudHJpbSgpOyBpZighcCkgcmV0dXJuIGZsYXNoKCdUeXBlIGFuIGluc3RydWN0aW9uIGZpcnN0Jyk7CiAgZmxhc2goJ1dvcmtpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vYXNrJyx7cHJvbXB0OnB9KTsgcmVuZGVyKCk7IGZsYXNoKCdEb25lJyk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcXVpY2soaSl7IHdrUHJvbXB0LnZhbHVlPVFVSUNLW2ldWzFdOyBkb1dvcmsoKSB9CmZ1bmN0aW9uIGNvcHlPdXQoaSl7IG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgoUy5vdXRwdXRzfHxbXSlbaV0udGV4dCk7IGZsYXNoKCdDb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyV29yaygpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gTElWRSBPUEVSQVRJT05TIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gYWdvKGlzbyl7IGlmKCFpc28pIHJldHVybiAnbmV2ZXInOwogIGNvbnN0IHM9TWF0aC5mbG9vcigoRGF0ZS5ub3coKS1uZXcgRGF0ZShpc28ucmVwbGFjZSgnICcsJ1QnKSsnWicpLmdldFRpbWUoKSkvMTAwMCk7CiAgaWYoczw2MCkgcmV0dXJuIHMrJ3MgYWdvJzsgaWYoczwzNjAwKSByZXR1cm4gTWF0aC5mbG9vcihzLzYwKSsnbSBhZ28nOyByZXR1cm4gTWF0aC5mbG9vcihzLzM2MDApKydoIGFnbyc7IH0KZnVuY3Rpb24gZXZlcnkobil7IHJldHVybiBuPDYwP24rJ3MnOm48MzYwMD9NYXRoLnJvdW5kKG4vNjApKydtJzpNYXRoLnJvdW5kKG4vMzYwMCkrJ2gnOyB9CkxJVkUub3BzPSgpPT57CiAgY29uc3QgVD1TLnRhc2tzfHxbXSwgUj1TLnJ1bnN8fFtdOwogIGNvbnN0IG9uPVQuZmlsdGVyKHQ9PnQuZW5hYmxlZCkubGVuZ3RoOwogIGNvbnN0IHRvdGFsUnVucz1ULnJlZHVjZSgoYSx0KT0+YSsodC5ydW5zfHwwKSwwKTsKICBjb25zdCBmYWlscz1ULnJlZHVjZSgoYSx0KT0+YSsodC5mYWlsc3x8MCksMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUy5ydW5uaW5nPydSVU5OSU5HJzonSEFMVEVEJywnU3lzdGVtIFN0YXRlJyxTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJyxTLnJ1bm5pbmc/J3dvcmsgZXhlY3V0aW5nJzonbm90aGluZyBydW5uaW5nJyl9CiAgICR7a3BpKG9uKycgLyAnK1QubGVuZ3RoLCdTdGFuZGluZyBPcmRlcnMgTGl2ZScsJ3ZhcigtLWN5KScsJ29uIHNjaGVkdWxlJyl9CiAgICR7a3BpKGZtdCh0b3RhbFJ1bnMpLCdKb2JzIEV4ZWN1dGVkJywndmFyKC0tZ3JuKScsUy50aWNrcysnIHNjaGVkdWxlciB0aWNrcycpfQogICAke2twaShmYWlscywnRmFpbHVyZXMnLGZhaWxzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ3NpbmNlIGluc3RhbGwnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U3RhbmRpbmcgT3JkZXJzIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLnJ1bm5pbmc/J3QtZ3JuJzondC1yZWQnfSI+JHtTLnJ1bm5pbmc/J0VYRUNVVElORyc6J0ZST1pFTid9PC9zcGFuPjwvaDM+CiAgICR7VC5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+Q2FwYWJpbGl0eTwvdGg+PHRoPk93bmVyIEFnZW50PC90aD48dGg+RXZlcnk8L3RoPjx0aD5MYXN0IFJ1bjwvdGg+PHRoPlJlc3VsdDwvdGg+PHRoPlJ1bnM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7VC5tYXAodD0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2ModC5jYXApfTwvYj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoKFMuY2Fwc3x8W10pLmZpbmQoYz0+Yy5jYXA9PT10LmNhcCk/LmRlc2N8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC5vd25lcil9PC90ZD4KICAgIDx0ZD48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0id2lkdGg6NzRweDtwYWRkaW5nOjRweCA3cHgiIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7dC5ldmVyeX0iCiAgICAgICAgb25jaGFuZ2U9InNldEV2ZXJ5KCcke3QuaWR9Jyx0aGlzLnZhbHVlKSIgdGl0bGU9InNlY29uZHMiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2V2ZXJ5KHQuZXZlcnkpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2Fnbyh0Lmxhc3RBdCl9PC90ZD4KICAgIDx0ZD4ke3QubGFzdE1zZz9gPHNwYW4gY2xhc3M9InRhZyAke3QubGFzdE9rPyd0LWdybic6J3QtcmVkJ30iPiR7dC5sYXN0T2s/J09LJzonRkFJTCd9PC9zcGFuPiAke2VzYyh0Lmxhc3RNc2cpfWA6JzxzcGFuIGNsYXNzPSJtb25vLWRpbSI+bm90IHlldCBydW48L3NwYW4+J308L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHt0LnJ1bnN8fDB9JHt0LmZhaWxzPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPi8nK3QuZmFpbHMrJ+Kclzwvc3Bhbj4nOicnfTwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJ1bk5vdygnJHt0LmlkfScpIj5SdW48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZ2dsZVRhc2soJyR7dC5pZH0nLCR7IXQuZW5hYmxlZH0pIj4ke3QuZW5hYmxlZD8nUGF1c2UnOidTdGFydCd9PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0YW5kaW5nIG9yZGVycy4gUG93ZXIgdGhlIHN5c3RlbSBvbiB0byBpbnN0YWxsIHRoZW0uPC9kaXY+J308L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXhlY3V0aW9uIEZlZWQgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtSLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtSLmxlbmd0aD9gPGRpdiBjbGFzcz0ibG9nIj4ke1IubWFwKHI9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtyLnR9PC9zcGFuPgogICAgIDxzcGFuIHN0eWxlPSJjb2xvcjoke3Iub2s/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPlske3Iub2s/J0RPTkUnOidGQUlMJ31dPC9zcGFuPgogICAgIDxiPiR7ZXNjKHIub3duZXIpfTwvYj4gwrcgJHtlc2Moci5jYXApfSDigJQgJHtlc2Moci5tc2cpfSR7ci5kZXRhaWw/YFxuICAgICAgICDihrMgJHtlc2Moci5kZXRhaWwpfWA6Jyd9CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oJHtyLm1zfW1zJHtyLm1hbnVhbD8nIMK3IG1hbnVhbCc6Jyd9KTwvc3Bhbj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gCiAgIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgZXhlY3V0ZWQgeWV0LiBQb3dlciBvbiBhbmQgdGhlIGZpcnN0IHN3ZWVwIHJ1bnMgd2l0aGluIDEwIHNlY29uZHMuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLm9wcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MuaHVzdGxlPycjYTg1NWY3JzonIzY3NDcwZid9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke1MuaHVzdGxlPycjMWEwZjJlJzonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOiR7Uy5odXN0bGU/J3ZhcigtLXB1ciknOid2YXIoLS1hbWIpJ30iPuKaoSBIVVNUTEUgTU9ERSDigJQgJHtTLmh1c3RsZT8nRU5HQUdFRCc6J09GRid9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7Uy5odXN0bGUKICAgP2A8Yj5NYXhpbXVtIG91dHB1dC48L2I+ICR7KFMudGFza3N8fFtdKS5sZW5ndGh9IG1vbmV5LWZvY3VzZWQgb3JkZXJzIHJ1bm5pbmcgb24gPGI+JHtTLmxhbmVzfHwzfSBwYXJhbGxlbCBsYW5lczwvYj4g4oCUIGlkZWFzLCByZXNlYXJjaCwgbWlzc2lvbnMsIHJldmVudWUgcm91dGVzLCBkZWVwIGludmVzdGlnYXRpb24uIEFsbCBmaXJpbmcgYXQgb25jZSwgbm90IG9uZSBhZnRlciBhbm90aGVyLmAKICAgOidTd2l0Y2hlcyB0aGUgcm9zdGVyIHRvIG1vbmV5LWdlbmVyYXRpbmcgd29yayBvbmx5LCB0aWdodGVucyBldmVyeSBpbnRlcnZhbCwgYW5kIHJ1bnMgdGFza3MgPGI+aW4gcGFyYWxsZWw8L2I+IGluc3RlYWQgb2Ygc2VxdWVudGlhbGx5LiBFeHBlY3Qgcm91Z2hseSAxMOKAkzIwIGNvbXBsZXRlZCBqb2JzIGluIHRoZSBmaXJzdCBob3VyLid9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5QYXJhbGxlbCBsYW5lcyBmb3IgQUkgdGFza3M6PC9zcGFuPgogICA8c2VsZWN0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDo5MHB4IiBpZD0ibGFuZVNlbCIgb25jaGFuZ2U9InNldExhbmVzKHRoaXMudmFsdWUpIj4KICAgICR7WzEsMiwzLDQsNSw2XS5tYXAobj0+YDxvcHRpb24gdmFsdWU9IiR7bn0iICR7KFMubGFuZXN8fDMpPT1uPydzZWxlY3RlZCc6Jyd9PiR7bn08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5IaWdoZXIgPSBmYXN0ZXIsIGJ1dCBmcmVlIEFJIHRpZXJzIHJhdGUtbGltaXQgYXJvdW5kIDMwIHJlcXVlc3RzL21pbi48L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gJHtTLmh1c3RsZT8nbm8nOidwJ30iIG9uY2xpY2s9InRvZ2dsZUh1c3RsZSgpIj4ke1MuaHVzdGxlPydTVEFORCBET1dOJzonRU5HQUdFIEhVU1RMRSBNT0RFJ308L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij4ke1MuaHVzdGxlCiAgID8nU3RhbmRpbmcgZG93biByZXN0b3JlcyB0aGUgbm9ybWFsIG1vbml0b3Jpbmcgcm9zdGVyLicKICAgOidUaGlzIHJlcGxhY2VzIHlvdXIgY3VycmVudCB0YXNrIGxpc3QuIE1vbml0b3JpbmcgY29udGludWVzLCBidXQgdGhlIGVtcGhhc2lzIHNoaWZ0cyBoYXJkIHRvIHJldmVudWUuJ308L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzE1NWU2YiI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPuKCuSBTUEVORElORyBDRUlMSU5HIOKAlCAke1MuYnVkZ2V0Pygn4oK5JytmbXQoUy5idWRnZXQpKTonTk9UIFNFVCd9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+SGUgY2FuIDxiPnJlcXVlc3Q8L2I+IG1vbmV5IGZvciBhIHZlbnR1cmUg4oCUIGEgZG9tYWluLCBhIGxpc3RpbmcgZmVlLCBhIHNtYWxsIGFkIHRlc3QuIEhlIGNhbiBuZXZlciB0YWtlIGl0LiBFdmVyeSByZXF1ZXN0IGJlY29tZXMgYSBmcm96ZW4gZ2F0ZSBuZWVkaW5nIHlvdXIgc2lnbmF0dXJlLCBhbmQgYW55dGhpbmcgYWJvdmUgdGhpcyBjZWlsaW5nIGlzIHJlZnVzZWQgb3V0cmlnaHQuPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjE1MHB4IiB0eXBlPSJudW1iZXIiIGlkPSJidWRnZXRBbXQiIHBsYWNlaG9sZGVyPSJlLmcuIDIwMDAiIHZhbHVlPSIke1MuYnVkZ2V0fHwnJ30iPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2V0QnVkZ2V0KCkiPlNFVCBDRUlMSU5HPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+TGlmZXRpbWUgYXV0aG9yaXplZCBzcGVuZCBzbyBmYXI6IDxiPuKCuSR7KFMuc3BlbmR8fDApLnRvRml4ZWQoMil9PC9iPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MucnVubmluZz8nIzFjNWMzYyc6JyM2YjIyMzMnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtTLnJ1bm5pbmc/JyMwODE3MGYnOicjMTYwYjBjJ30sIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6JHtTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPuKWtiBNQVNURVIgUE9XRVIg4oCUICR7Uy5ydW5uaW5nPydTWVNURU0gUlVOTklORyc6J1NZU1RFTSBIQUxURUQnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4ke1MucnVubmluZwogICA/J0V2ZXJ5IHN0YW5kaW5nIG9yZGVyIGJlbG93IGlzIGV4ZWN1dGluZyBvbiBpdHMgb3duIHNjaGVkdWxlLiBUaGUgQ2hhaXJtYW4gaXMgZG9pbmcgcmVhbCB3b3JrIHJpZ2h0IG5vdyDigJQgcHJvYmluZyB5b3VyIHNpdGVzLCBhdWRpdGluZyB0aGUgbGVkZ2VyLCBjb21wdXRpbmcgU0xBcywgd3JpdGluZyBicmllZnMg4oCUIHdpdGhvdXQgeW91IHRvdWNoaW5nIGFueXRoaW5nLicKICAgOic8Yj5Ob3RoaW5nIGlzIHJ1bm5pbmcuPC9iPiBTaWduIGJlbG93IHRvIGJyaW5nIHRoZSB3aG9sZSBzeXN0ZW0gb25saW5lLiBPbmNlIHJ1bm5pbmcgaXQgZG9lcyBub3Qgc3RvcCB1bnRpbCB5b3UgaGFsdCBpdC4nfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5ydW5uaW5nPydubyc6J3AnfSIgb25jbGljaz0icG93ZXIoKSI+JHtTLnJ1bm5pbmc/J0hBTFQgRVZFUllUSElORyc6J1NUQVJUIEVWRVJZVEhJTkcnfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InJlc2V0VGFza3MoKSI+UmVpbnN0YWxsIHN0YW5kaW5nIG9yZGVyczwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5TY2hlZHVsZXIgdGlja3MgZXZlcnkgMTBzLiBPbmx5IHlvdSBjYW4gc3RhcnQgb3Igc3RvcCBpdCDigJQgbm90aGluZyBlbHNlIGNhbi48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJvcHMiPiR7TElWRS5vcHMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBwb3dlcigpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcG93ZXInLHtvbjohUy5ydW5uaW5nfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5ydW5uaW5nPydTWVNURU0gUlVOTklORyDigJQgYWdlbnRzIGV4ZWN1dGluZyc6J1N5c3RlbSBoYWx0ZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHNldEV2ZXJ5KGlkLHYpeyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS90YXNrJyx7aWQsZXZlcnk6K3Z9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVUYXNrKGlkLG9uKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvdGFzaycse2lkLGVuYWJsZWQ6b259KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBydW5Ob3coaWQpeyBmbGFzaCgnRXhlY3V0aW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3J1bm5vdycse2lkfSk7IHJlbmRlcigpOyBmbGFzaChyLm1zZykgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiByZXNldFRhc2tzKCl7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Jlc2V0Jyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnU3RhbmRpbmcgb3JkZXJzIHJlaW5zdGFsbGVkJykgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVIdXN0bGUoKXsKICBmbGFzaChTLmh1c3RsZT8nU3RhbmRpbmcgZG93buKApic6J0VuZ2FnaW5nIGh1c3RsZSBtb2Rl4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL2h1c3RsZScse29uOiFTLmh1c3RsZSxsYW5lczpTLmxhbmVzfHwzfSk7CiAgICByZW5kZXIoKTsgZmxhc2goUy5odXN0bGU/YEhVU1RMRSBFTkdBR0VEIOKAlCAke3IudGFza3N9IG9yZGVycyBmaXJpbmcgaW4gcGFyYWxsZWxgOidTdG9vZCBkb3duIHRvIG5vcm1hbCByb3N0ZXInKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHNldExhbmVzKG4peyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9sYW5lcycse2xhbmVzOitufSk7IHJlbmRlcigpOyBmbGFzaCgnTGFuZXM6ICcrbikgfQphc3luYyBmdW5jdGlvbiBzZXRCdWRnZXQoKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9zcGVuZC9idWRnZXQnLHtidWRnZXQ6K2J1ZGdldEFtdC52YWx1ZXx8MH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdDZWlsaW5nIHNldCDigJQgaGUgY2FuIHJlcXVlc3QgdXAgdG8gdGhpcywgbmV2ZXIgdGFrZSBpdCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KCi8qIC0tLS0tLS0tLS0gU0VMRi1VUEdSQURFIC0tLS0tLS0tLS0gKi8KTElWRS5ldm9sdmU9KCk9PnsKICBjb25zdCBQPShTLnByb3Bvc2Fsc3x8W10pLmZpbHRlcihwPT5wLnN0YXR1cz09PSdQRU5ESU5HJyk7CiAgY29uc3QgRT1TLmV2b2x1dGlvbnx8W107CiAgY29uc3QgYXBwbGllZD1FLmZpbHRlcihlPT5lLmRlY2lzaW9uPT09J0FQUExJRUQnKS5sZW5ndGg7CiAgY29uc3QgcmVqZWN0ZWQ9RS5maWx0ZXIoZT0+ZS5kZWNpc2lvbj09PSdSRUpFQ1RFRCcpLmxlbmd0aDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShQLmxlbmd0aCwnVXBncmFkZXMgQXdhaXRpbmcgWW91JyxQLmxlbmd0aD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLFAubGVuZ3RoPyduZWVkcyB5b3VyIHNpZ25hdHVyZSc6J25vdGhpbmcgcGVuZGluZycpfQogICAke2twaShhcHBsaWVkLCdVcGdyYWRlcyBBcHBsaWVkJywndmFyKC0tZ3JuKScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKHJlamVjdGVkLCdSZWplY3RlZCcsJ3ZhcigtLWRpbSknLCduZXZlciByZS1wcm9wb3NlZCcpfQogICAke2twaShTLnNjYW5Db3VudHx8MCwnU2VsZi1TY2FucyBSdW4nLCd2YXIoLS1jeSknLCdldmVyeSA2MCBzZWNvbmRzJyl9PC9kaXY+CiAgJHtQLmxlbmd0aD9QLm1hcChwPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke3Aua2xhc3M9PT0nU0FGRSc/JyMxYzVjM2MnOicjNjc0NzBmJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke3Aua2xhc3M9PT0nU0FGRSc/J3QtZ3JuJzondC1hbWInfSI+JHtwLmtsYXNzfTwvc3Bhbj4KICAgICAgPGI+JHtlc2MocC5sYWJlbCl9PC9iPjwvZGl2PjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtwLmlkfSDCtyAke3AudH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjdweCI+JHtlc2MocC53aHkpfTwvZGl2PgogICAgJHtwLmV2aWRlbmNlP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5FdmlkZW5jZTogJHtlc2MocC5ldmlkZW5jZSl9PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJkZWNpZGVVcCgnJHtwLmlkfScsMSkiPkFVVEhPUklaRSBVUEdSQURFPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWNpZGVVcCgnJHtwLmlkfScsMCkiPlJFSkVDVCBQRVJNQU5FTlRMWTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZXJyIiBpZD0iZXJfJHtwLmlkfSI+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gdXBncmFkZXMgcGVuZGluZy4gVGhlIENoYWlybWFuIHNjYW5zIGl0c2VsZiBldmVyeSA2MCBzZWNvbmRzIGFuZCB3aWxsIHJhaXNlIGEgcHJvcG9zYWwgaGVyZSB0aGUgbW9tZW50IGl0IGZpbmRzIGEgcmVhbCB3ZWFrbmVzcyDigJQgYSBmbGFreSBzaXRlLCBhbiBleHBpcmluZyBjZXJ0aWZpY2F0ZSwgYW4gdW5zdGFmZmVkIGZsb29yLCBhIHNlY3VyaXR5IGdhcC48L2Rpdj48L2Rpdj5gfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Fdm9sdXRpb24gSGlzdG9yeTwvaDM+CiAgICR7RS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPkNoYW5nZTwvdGg+PHRoPkRlY2lzaW9uPC90aD48dGg+UmVzdWx0PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0UubWFwKGU9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlLnR9PC90ZD48dGQ+JHtlc2MoZS5sYWJlbCl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUud2h5fHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7ZS5kZWNpc2lvbj09PSdBUFBMSUVEJz8ndC1ncm4nOid0LXJlZCd9Ij4ke2UuZGVjaXNpb259PC9zcGFuPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLmhvd3x8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLnJlc3VsdHx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5UaGUgQ2hhaXJtYW4gaGFzIG5vdCBjaGFuZ2VkIGl0c2VsZiB5ZXQuPC9kaXY+J308L2Rpdj5gfTsKTElWRS53cml0dGVuPSgpPT57CiAgY29uc3QgVz0oUy53cml0dGVuQ2Fwc3x8W10pOwogIGlmKCFXLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+SGUgaGFzIG5vdCB3cml0dGVuIGFueSBuZXcgYWJpbGl0aWVzIHlldC48L2Rpdj48L2Rpdj4nOwogIHJldHVybiBXLm1hcChjPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjokewogICAgICBjLnZpb2xhdGlvbnMubGVuZ3RoPyd2YXIoLS1tYWcpJzpjLnN0YXR1cz09PSdJTlNUQUxMRUQnPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKSd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPgogICAgICA8c3BhbiBjbGFzcz0idGFnICR7Yy52aW9sYXRpb25zLmxlbmd0aD8ndC1yZWQnOmMuc3RhdHVzPT09J0lOU1RBTExFRCc/J3QtZ3JuJzondC1hbWInfSI+JHsKICAgICAgICBjLnZpb2xhdGlvbnMubGVuZ3RoPydTQU5EQk9YIEJMT0NLRUQnOmMuc3RhdHVzfTwvc3Bhbj4KICAgICAgPGIgc3R5bGU9ImZvbnQtc2l6ZToxNHB4Ij4ke2VzYyhjLm5hbWUpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Yy50fSDCtyAke2MuYnl0ZXN9IGJ5dGVzPC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPiR7ZXNjKGMuZGVzYyl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjExMHB4Ij5XaHkgaGUgd3JvdGUgaXQ8L3RkPjx0ZD4ke2VzYyhjLndoeSl9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5SaXNrIGhlIHNlZXM8L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtlc2MoYy5yaXNrKX08L3RkPjwvdHI+CiAgICAgJHtjLnZpb2xhdGlvbnMubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QmxvY2tlZCBiZWNhdXNlPC90ZD4KICAgICAgIDx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtjLnZpb2xhdGlvbnMubWFwKGVzYykuam9pbignPGJyPicpfTwvdGQ+PC90cj5gOicnfQogICAgICR7Yy50ZXN0UnVuP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RHJ5IHJ1biBvdXRwdXQ8L3RkPgogICAgICAgPHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4ke2VzYyhjLnRlc3RSdW4ubXNnKX0ke2MudGVzdFJ1bi5kZXRhaWw/JzxkaXYgY2xhc3M9Im1vbm8tZGltIj4nK2VzYyhjLnRlc3RSdW4uZGV0YWlsKSsnPC9kaXY+JzonJ308L3RkPjwvdHI+YDonJ30KICAgICAke2MudGVzdEVycm9yP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RHJ5IHJ1biBmYWlsZWQ8L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoYy50ZXN0RXJyb3IpfTwvdGQ+PC90cj5gOicnfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGRldGFpbHMgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PHN1bW1hcnkgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPgogICAgICBSRUFEIFRIRSBBQ1RVQUwgQ09ERSBiZWZvcmUgeW91IHNpZ24gaXQgKCR7Yy5ieXRlc30gYnl0ZXMpPC9zdW1tYXJ5PgogICAgIDxwcmUgY2xhc3M9InlhbWwiIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+JHtlc2MoYy5jb2RlKX08L3ByZT48L2RldGFpbHM+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPgogICAgICR7Yy5zdGF0dXM9PT0nUEVORElORyc/YDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+U2lnbiBpdCBvbiB0aGUgcHJvcG9zYWwgYWJvdmUgdG8gaW5zdGFsbC48L3NwYW4+YDonJ30KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRpc2NhcmRDYXAoJyR7Yy5pZH0nKSI+RGlzY2FyZDwvYnV0dG9uPjwvZGl2PgogICA8L2Rpdj5gKS5qb2luKCcnKTsKfTsKUkVOREVSLndyaXR0ZW49KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tcHVyKSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7inI4gU0VMRi1FWFRFTlNJT04g4oCUIEhFIFdSSVRFUyBISVMgT1dOIE5FVyBBQklMSVRJRVM8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+Tm90IHNldHRpbmdzIHR1bmluZy4gSGUgd3JpdGVzIDxiPnJlYWwgSmF2YVNjcmlwdDwvYj4gZm9yIGEgY2FwYWJpbGl0eSBoZSBkb2VzIG5vdCB5ZXQgaGF2ZSwgaXQgcnVucyBpbiBhIGxvY2tlZCBzYW5kYm94LCBhbmQgeW91IHJlYWQgdGhlIGFjdHVhbCBzb3VyY2UgYmVmb3JlIHNpZ25pbmcuPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5TYW5kYm94IGJsb2NrczwvYj4gcmVxdWlyZSwgcHJvY2VzcywgZnMsIGNoaWxkX3Byb2Nlc3MsIGV2YWwsIEZ1bmN0aW9uLCBwcm90b3R5cGUgYWNjZXNzIGFuZCBpbmZpbml0ZSBsb29wcyDigJQgY2hlY2tlZCA8ZW0+YmVmb3JlPC9lbT4geW91IGFyZSBzaG93biBpdC48L2xpPgogICA8bGk+R2VuZXJhdGVkIGNvZGUgc2VlcyBvbmx5IGEgdGlueSByZWFkLW9ubHkgQVBJIG9mIHlvdXIgb3duIHN0YXRlLCBwbHVzIG9uZSB3cml0ZTogYSBub3RlIGluIHRoZSBsZWRnZXIuPC9saT4KICAgPGxpPkV2ZXJ5IG5ldyBhYmlsaXR5IGlzIDxiPmRyeS1ydW4gYWdhaW5zdCByZWFsIGRhdGEgZmlyc3Q8L2I+LCBzbyB5b3Ugc2VlIGdlbnVpbmUgb3V0cHV0LCBub3QgYSBwcm9taXNlLjwvbGk+CiAgIDxsaT5Ob3RoaW5nIGluc3RhbGxzIHdpdGhvdXQgeW91ciBwYXNzd29yZCBzaWduYXR1cmUgb24gdGhlIFNlbGYtVXBncmFkZSBwYWdlLjwvbGk+CiAgPC91bD4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHNwYW4+V2hhdCBuZXcgYWJpbGl0eSBzaG91bGQgaGUgYnVpbGQ/PC9zcGFuPgogICA8aW5wdXQgaWQ9InNlR29hbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iZS5nLiBmaW5kIHdoaWNoIG1vbml0b3JlZCBzaXRlIGRlZ3JhZGVkIG1vc3QgdGhpcyB3ZWVrIj48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9IndyaXRlQ2FwKCkiPkhFIFdSSVRFUyBJVDwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkxlYXZlIGJsYW5rIGFuZCBoZSBwaWNrcyBhIGdhcCBoZSBjYW4gc2VlIGluIGhpcyBvd24gc3RhdGUuPC9zcGFuPjwvZGl2PgogPC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0id3JpdHRlbiI+JHtMSVZFLndyaXR0ZW4oKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiB3cml0ZUNhcCgpewogIGNvbnN0IGc9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZUdvYWwnKXx8e30pLnZhbHVlfHwnJzsKICBmbGFzaCgnSGUgaXMgd3JpdGluZyBjb2Rl4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zZWxmZXh0ZW5kL3dyaXRlJyx7Z29hbDpnfHwncGljayBhIGdlbnVpbmUgZ2FwIGluIHlvdXIgb3duIGFiaWxpdGllcyd9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmJsb2NrZWQ/KCdXcm90ZSAnK3IubmFtZSsnIOKAlCBTQU5EQk9YIEJMT0NLRUQgSVQnKTooJ1dyb3RlICcrci5uYW1lKycg4oCUIHJlYWQgdGhlIGNvZGUsIHRoZW4gc2lnbiBpdCcpKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRpc2NhcmRDYXAoaWQpeyBhd2FpdCBBUEkoJy9hcGkvc2VsZmV4dGVuZC9kaXNjYXJkJyx7aWR9KTsgcmVuZGVyKCkgfQoKUkVOREVSLmV2b2x2ZT0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKfsyBDT05USU5VT1VTIFNFTEYtVVBHUkFERTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UaGUgQ2hhaXJtYW4gYXVkaXRzIGl0cyBvd24gc3RhdGUgZXZlcnkgNjAgc2Vjb25kcyBhZ2FpbnN0IHJlYWwgdGVsZW1ldHJ5IOKAlCB1cHRpbWUgcmVjb3JkcywgVExTIGV4cGlyeSwgYXV0aCBmYWlsdXJlcywgbGVkZ2VyIHNpemUsIGZsb29yIHN0YWZmaW5nLCBtYWlsIHJlYWRpbmVzcy4gV2hlbiBpdCBmaW5kcyBhIGdlbnVpbmUgd2Vha25lc3MgaXQgcHJvcG9zZXMgYSBmaXggaGVyZSBhbmQgPGI+ZnJlZXplcyB1bnRpbCB5b3Ugc2lnbiBpdDwvYj4uPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5Ob3RoaW5nIHNlbGYtaW5zdGFsbHMgYnkgZGVmYXVsdC48L2I+IEV2ZXJ5IHVwZ3JhZGUgbmVlZHMgeW91ciBwYXNzd29yZCwgc2FtZSBhcyBhIHBlcm1pc3Npb24gZ2F0ZS48L2xpPgogICA8bGk+PGI+U0FGRTwvYj4gPSByZXZlcnNpYmxlIHR1bmluZyAocHJvYmUgaW50ZXJ2YWxzLCBsZWRnZXIgY29tcGFjdGlvbiwgc2tpbGxzKS4gPGI+UkVWSUVXPC9iPiA9IGNoYW5nZXMgeW91ciByb3N0ZXIgb3IgcmFpc2VzIGEgc2VjdXJpdHkgZ2F0ZS48L2xpPgogICA8bGk+UmVqZWN0IG9uY2UgYW5kIGl0IGlzIDxiPnN1cHByZXNzZWQgcGVybWFuZW50bHk8L2I+IOKAlCB0aGUgQ2hhaXJtYW4gd2lsbCBub3QgbmFnIHlvdSBhYm91dCBpdCBhZ2Fpbi48L2xpPgogICA8bGk+SXQgcHJvcG9zZXMgb25seSBvbiBldmlkZW5jZSBmcm9tIHlvdXIgYWN0dWFsIHJ1bm5pbmcgc3lzdGVtLiBJdCBkb2VzIG5vdCBpbnZlbnQgd29yay48L2xpPgogIDwvdWw+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNjYW5Ob3coKSI+UlVOIFNFTEYtU0NBTiBOT1c8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke1MuYXV0b3BpbG90Pyd0LXJlZCc6J3QtZGltJ30iPkFVVE9QSUxPVCAke1MuYXV0b3BpbG90PydPTic6J09GRid9PC9zcGFuPgogIDwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MuYXV0b3BpbG90PycjNmIyMjMzJzondmFyKC0tbGluZSknfSI+CiAgPGgzPkF1dG9waWxvdCAke1MuYXV0b3BpbG90Pyc8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5BQ1RJVkU8L3NwYW4+JzonJ308L2gzPgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5XaXRoIGF1dG9waWxvdCBvbiwgPGI+U0FGRS1jbGFzczwvYj4gdXBncmFkZXMgYXBwbHkgdGhlbXNlbHZlcyB0aGUgbW9tZW50IHRoZXkgYXJlIGZvdW5kIOKAlCBubyBzaWduYXR1cmUuIFJFVklFVy1jbGFzcyBhbHdheXMgd2FpdHMgZm9yIHlvdSByZWdhcmRsZXNzLiBFdmVyeSBhdXRvbm9tb3VzIGNoYW5nZSBpcyBzdGlsbCB3cml0dGVuIHRvIHRoZSBldm9sdXRpb24gaGlzdG9yeS4gVGhpcyBpcyByZWFsIGF1dG9ub215OiB0dXJuIGl0IG9uIG9ubHkgaWYgeW91IGFjY2VwdCB0aGUgQ2hhaXJtYW4gY2hhbmdpbmcgaXRzIG93biB0dW5pbmcgd2hpbGUgeW91IHNsZWVwLjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvcGlsb3Q/J25vJzoncCd9IiBvbmNsaWNrPSJ0b2dnbGVBdXRvKCkiPiR7Uy5hdXRvcGlsb3Q/J0RJU0FCTEUgQVVUT1BJTE9UJzonRU5BQkxFIEFVVE9QSUxPVCd9PC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iZXZvbHZlIj4ke0xJVkUuZXZvbHZlKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZGVjaWRlVXAoaWQsb2spewogIGNvbnN0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VyXycraWQpOyBlLnRleHRDb250ZW50PScnOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9kZWNpZGUnLHtpZCxvazohIW9rfSk7CiAgICByZW5kZXIoKTsgZmxhc2gob2s/KCdVUEdSQURFRCDCtyAnKyhyLnJlc3VsdHx8JycpKTonUmVqZWN0ZWQgcGVybWFuZW50bHknKTsKICB9Y2F0Y2goeCl7IGUudGV4dENvbnRlbnQ9eC5tZXNzYWdlIH0KfQphc3luYyBmdW5jdGlvbiBzY2FuTm93KCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvc2Nhbicse30pOyByZW5kZXIoKTsKICBmbGFzaChyLnBlbmRpbmc/ci5wZW5kaW5nKycgdXBncmFkZShzKSBhd2FpdGluZyB5b3VyIHNpZ25hdHVyZSc6J1NjYW4gY2xlYW4g4oCUIG5vdGhpbmcgdG8gaW1wcm92ZScpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlQXV0bygpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvYXV0b3BpbG90Jyx7b246IVMuYXV0b3BpbG90fSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvcGlsb3Q/J0FVVE9QSUxPVCBPTiDigJQgc2FmZSB1cGdyYWRlcyBub3cgc2VsZi1hcHBseSc6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiAtLS0tLS0tLS0tIExFQVJORUQgU0tJTExTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNraWxsczI9KCk9PnsKICBjb25zdCBLPVMuc2tpbGxzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UZWFjaCB0aGUgQ2hhaXJtYW4gPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QRVJTSVNUUyBGT1JFVkVSPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij5Bbnl0aGluZyB5b3UgdGVhY2ggaXMgc3RvcmVkIHNlcnZlci1zaWRlIGFuZCBzdXJ2aXZlcyByZXN0YXJ0cywgcmVkZXBsb3lzIGFuZCBldmVyeSBkZXZpY2UgeW91IGxvZyBpbiBmcm9tLiBUZWFjaCBpdCB5b3VyIHNob3J0aGFuZCwgeW91ciBydW5ib29rcywgeW91ciBzdGFuZGluZyBvcmRlcnMuPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UcmlnZ2VyIHBocmFzZTwvc3Bhbj48aW5wdXQgaWQ9InNrUGhyYXNlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJtb3JuaW5nIGNoZWNrIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGl0IG1lYW5zIC8gZG9lczwvc3Bhbj48aW5wdXQgaWQ9InNrQWN0aW9uIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJTY2FuIGFsbCBtb25pdG9ycyBhbmQgcmVwb3J0IGFueXRoaW5nIGJlbG93IDk5JSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VHlwZTwvc3Bhbj48c2VsZWN0IGlkPSJza0tpbmQiIGNsYXNzPSJpbiI+CiAgICAgPG9wdGlvbiB2YWx1ZT0ibm90ZSI+U3RhbmRpbmcgb3JkZXI8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJhbGlhcyI+Q29tbWFuZCBzaG9ydGN1dDwvb3B0aW9uPgogICAgIDxvcHRpb24gdmFsdWU9InJ1bmJvb2siPlJ1bmJvb2sgc3RlcDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9InBvbGljeSI+UG9saWN5IHJ1bGU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0idGVhY2goKSI+VEVBQ0ggSVQ8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+S25vd24gU2tpbGxzIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Sy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7Sy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+UGhyYXNlPC90aD48dGg+TWVhbmluZzwvdGg+PHRoPlR5cGU8L3RoPjx0aD5Vc2VkPC90aD48dGg+TGVhcm5lZDwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtLLm1hcChzPT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyhzLnBocmFzZSl9PC9iPjwvdGQ+PHRkPiR7ZXNjKHMuYWN0aW9uKX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7ZXNjKHMua2luZCl9PC9zcGFuPjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLnVzZXN8fDB9w5c8L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLmxlYXJuZWR9PGRpdj4ke2VzYyhzLm9yaWdpbnx8J293bmVyJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InVzZVNraWxsKCcke2VzYyhzLnBocmFzZSl9JykiPlJlY2FsbDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZm9yZ2V0KCcke2VzYyhzLnBocmFzZSl9JykiPkZvcmdldDwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIHRhdWdodCB5ZXQuIFRyeSBwaHJhc2UgIm1vcm5pbmcgY2hlY2siIOKGkiAiU2NhbiBhbGwgbW9uaXRvcnMgYW5kIHJlcG9ydCBhbnl0aGluZyBiZWxvdyA5OSUgYXZhaWxhYmlsaXR5Ii48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiB0ZWFjaCgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL3RlYWNoJyx7cGhyYXNlOnNrUGhyYXNlLnZhbHVlLGFjdGlvbjpza0FjdGlvbi52YWx1ZSxraW5kOnNrS2luZC52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdTa2lsbCBsZWFybmVkIOKAlCBpdCBwZXJzaXN0cyBhY3Jvc3MgcmVzdGFydHMnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGZvcmdldChwKXsgaWYoIWNvbmZpcm0oJ0ZvcmdldCAiJytwKyciPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL2ZvcmdldCcse3BocmFzZTpwfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdXNlU2tpbGwocCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NraWxsL3VzZScse3BocmFzZTpwfSk7IHJlbmRlcigpOwogIG1vZGFsKGA8aDM+JHtlc2MocCl9PC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAiPjxkaXY+JHtlc2Moci5hY3Rpb24pfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCkgfQoKLyogLS0tLS0tLS0tLSBVUFRJTUUgTUFSU0hBTCAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHVwQmFyKG0pewogIGNvbnN0IGg9KG0uaGlzdG9yeXx8W10pLnNsaWNlKC00MCk7CiAgaWYoIWgubGVuZ3RoKSByZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iZm9udC1zaXplOjEwcHgiPm5vIGNoZWNrcyB5ZXQ8L2Rpdj4nOwogIHJldHVybiAnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoycHg7YWxpZ24taXRlbXM6ZmxleC1lbmQ7aGVpZ2h0OjI2cHgiPicraC5tYXAoeD0+CiAgIGA8ZGl2IHRpdGxlPSIke3gudH0gwrcgSFRUUCAke3guY29kZX0gwrcgJHt4Lm1zfW1zIiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDozcHg7aGVpZ2h0OiR7eC5vaz9NYXRoLm1heCgzMCxNYXRoLm1pbigxMDAsMTAwLXgubXMvMjUpKToxMDB9JTtiYWNrZ3JvdW5kOiR7eC5vaz8nIzMxZDY3YSc6JyNmZjNiNmInfTtib3JkZXItcmFkaXVzOjFweDtvcGFjaXR5Oi45Ij48L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+JzsKfQpMSVZFLnVwdGltZT0oKT0+ewogIGNvbnN0IE09Uy5tb25pdG9yc3x8W10sIGRvd249TS5maWx0ZXIobT0+bS5zdGF0ZT09PSdET1dOJykubGVuZ3RoOwogIGNvbnN0IHRvdD1NLnJlZHVjZSgoYSxtKT0+YSsobS5jaGVja3N8fDApLDApLCB1cHM9TS5yZWR1Y2UoKGEsbSk9PmErKG0udXB8fDApLDApOwogIGNvbnN0IGF2YWlsPXRvdD8oKHVwcy90b3QpKjEwMCkudG9GaXhlZCgyKTon4oCUJzsKICBjb25zdCBhdmc9TS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aD9NYXRoLnJvdW5kKE0ucmVkdWNlKChhLG0pPT5hKyhtLmxhc3RNc3x8MCksMCkvTS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aCk6MDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShNLmxlbmd0aCwnVGFyZ2V0cyBNb25pdG9yZWQnLCd2YXIoLS1jeSknLCdwcm9iZSBldmVyeSAxNXMnKX0KICAgJHtrcGkoZG93biwnQ3VycmVudGx5IERvd24nLGRvd24/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyxkb3duPydJTkNJREVOVCBBQ1RJVkUnOidhbGwgcmVhY2hhYmxlJyl9CiAgICR7a3BpKGF2YWlsKyhhdmFpbD09PSfigJQnPycnOiclJyksJ0F2YWlsYWJpbGl0eScsJ3ZhcigtLWdybiknLHRvdCsnIGNoZWNrcycpfQogICAke2twaShhdmcrJyBtcycsJ0F2ZyBSZXNwb25zZScsYXZnPjE1MDA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJywnbGFzdCBjeWNsZScpfTwvZGl2PgogICR7TS5sZW5ndGg/TS5tYXAobT0+ewogICAgY29uc3QgYT1tLmNoZWNrcz8oKG0udXAvbS5jaGVja3MpKjEwMCkudG9GaXhlZCgyKTonMC4wMCc7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHttLnN0YXRlPT09J1VQJz8ndC1ncm4nOm0uc3RhdGU9PT0nRE9XTic/J3QtcmVkJzondC1kaW0nfSI+JHttLnN0YXRlfTwvc3Bhbj4KICAgICAgPGI+JHtlc2MobS5uYW1lKX08L2I+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtLnVybCl9PC9zcGFuPjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxNb24oJyR7bS5pZH0nKSI+VW5iaW5kPC9idXR0b24+PC9kaXY+PC9kaXY+CiAgICAke3VwQmFyKG0pfQogICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5MYXN0IGNoZWNrPC90ZD48dGQ+JHttLmxhc3RBdHx8J+KAlCd9IMK3IEhUVFAgJHttLmxhc3RTdGF0dXN8fCfigJQnfSR7bS5sYXN0RXJyPycgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPicrZXNjKG0ubGFzdEVycikrJzwvc3Bhbj4nOicnfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF0ZW5jeTwvdGQ+PHRkPiR7bS5sYXN0TXN8fDB9IG1zIChwOTUgJHttLnA5NXx8MH0gbXMpPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmFpbGFiaWxpdHk8L3RkPjx0ZCBzdHlsZT0iY29sb3I6JHthPjk5Pyd2YXIoLS1ncm4pJzphPjk1Pyd2YXIoLS1hbWIpJzondmFyKC0tbWFnKSd9Ij4ke2F9JSDCtyAke20udXB8fDB9IHVwIC8gJHttLmRvd258fDB9IGRvd24gb2YgJHttLmNoZWNrc3x8MH08L3RkPjwvdHI+CiAgICAgJHttLnNzbD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRMUyBjZXJ0aWZpY2F0ZTwvdGQ+PHRkPiR7ZXNjKG0uc3NsLmlzc3Vlcil9IMK3IGV4cGlyZXMgaW4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7bS5zc2wuZGF5c19sZWZ0PDE0Pyd2YXIoLS1tYWcpJzptLnNzbC5kYXlzX2xlZnQ8NDU/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJ30iPiR7bS5zc2wuZGF5c19sZWZ0fSBkYXlzPC9zcGFuPjwvdGQ+PC90cj5gOicnfQogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5JbnRlcnZhbDwvdGQ+PHRkPiR7bS5pbnRlcnZhbH1zIMK3IGJvdW5kICR7bS5hZGRlZH08L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHRhcmdldHMgYm91bmQuIEFkZCB5b3VyIGxpdmUgc2l0ZXMgYW5kIGFwcHMgYmVsb3cg4oCUIHRoZSBVcHRpbWUgTWFyc2hhbCB3aWxsIHByb2JlIHRoZW0gZm9yIHJlYWwuPC9kaXY+PC9kaXY+J30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SW5jaWRlbnQgSGlzdG9yeTwvaDM+JHsoUy5pbmNpZGVudHN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgIDx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5UYXJnZXQ8L3RoPjx0aD5UcmFuc2l0aW9uPC90aD48dGg+RGV0YWlsPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke1MuaW5jaWRlbnRzLm1hcChpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7aS50fTwvdGQ+PHRkPiR7ZXNjKGkubmFtZSl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7aS50bz09PSdET1dOJz8ndC1yZWQnOid0LWdybid9Ij4ke2kuZnJvbX0g4oaSICR7aS50b308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGkuZGV0YWlsKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdGF0ZSB0cmFuc2l0aW9ucyByZWNvcmRlZC4gTm90aGluZyBoYXMgZmxhcHBlZC48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIudXB0aW1lPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QmluZCBUYXJnZXQgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5SRUFMIEhUVFAgUFJPQkVTPC9zcGFuPjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0ibVVybCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly95b3Vyc2l0ZS5jb20iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TGFiZWwgKG9wdGlvbmFsKTwvc3Bhbj48aW5wdXQgaWQ9Im1OYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJNYWluIHNpdGUiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW50ZXJ2YWwgKHNlYywgbWluIDE1KTwvc3Bhbj48aW5wdXQgaWQ9Im1JbnQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iNjAiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYWRkTW9uKCkiPkJJTkQgJmFtcDsgUFJPQkUgTk9XPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hlY2tOb3coKSI+Rk9SQ0UgQ0hFQ0sgQUxMPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvYmVzIGZvbGxvdyB1cCB0byAzIHJlZGlyZWN0cywgcmVhZCBUTFMgZXhwaXJ5LCBhbmQgcmVjb3JkIHA5NSBsYXRlbmN5LiBPbiBhbnkgVVDihpRET1dOIHRyYW5zaXRpb24gdGhlIFVwdGltZSBNYXJzaGFsIHdyaXRlcyBhIENSSVQgaW5jaWRlbnQgYW5kIGZpcmVzIGFuIGVtYWlsIHRocm91Z2ggdGhlIE1haWwgUmVsYXkuPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idXB0aW1lIj4ke0xJVkUudXB0aW1lKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gYWRkTW9uKCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL2FkZCcse3VybDptVXJsLnZhbHVlLnRyaW0oKSxuYW1lOm1OYW1lLnZhbHVlLnRyaW0oKSxpbnRlcnZhbDorbUludC52YWx1ZXx8NjB9KTsKIHJlbmRlcigpO2ZsYXNoKCdUYXJnZXQgYm91bmQgwrcgcHJvYmluZycpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBkZWxNb24oaWQpe2lmKCFjb25maXJtKCdVbmJpbmQgdGhpcyB0YXJnZXQ/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL3JlbW92ZScse2lkfSk7cmVuZGVyKCl9CmFzeW5jIGZ1bmN0aW9uIGNoZWNrTm93KCl7Zmxhc2goJ1Byb2JpbmcgYWxsIHRhcmdldHPigKYnKTthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9jaGVjaycse30pO3JlbmRlcigpO2ZsYXNoKCdQcm9iZSBjeWNsZSBjb21wbGV0ZScpfQoKLyogLS0tLS0tLS0tLSBNQUlMIFJFTEFZIC0tLS0tLS0tLS0gKi8KUkVOREVSLm1haWw9KCk9PnsKICBjb25zdCBzdD1TLnNtdHAsIG1zPVMubWFpbHN0YXR8fHtzZW50OjAsZmFpbGVkOjB9OwogIHJldHVybiBgJHshc3Q/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gT1VUQk9VTkQgTUFJTDwvaDM+CiAgIDxkaXY+RXZlcnkgMkZBIG5vdGlmaWNhdGlvbiBhbmQgb3V0YWdlIGFsZXJ0IGlzIGJlaW5nIHJlY29yZGVkIGFzIGFuIDxiPmludGVudCBvbmx5PC9iPi4gQ29uZmlndXJlIHlvdXIgb3duIFNNVFAgcmVsYXkgYmVsb3cgdG8gbWFrZSB0aGVtIHJlYWwuIFRoZSBDaGFpcm1hbiB3aWxsIG5ldmVyIGFzayBmb3IgdGhlc2UgaW4gY2hhdCDigJQgeW91IGVudGVyIHRoZW0gaGVyZSwgYW5kIHRoZSBwYXNzd29yZCBpcyBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9kaXY+PC9kaXY+YAogIDpgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMWM1YzNjO2JhY2tncm91bmQ6IzA4MTcwZiI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5SRUxBWSBBUk1FRDwvaDM+CiAgIDxkaXY+T3V0Ym91bmQgZW1haWwgaXMgbGl2ZSB2aWEgJHtlc2Moc3QuaG9zdCl9OiR7c3QucG9ydH0uICR7bXMuc2VudH0gZGVsaXZlcmVkLCAke21zLmZhaWxlZH0gZmFpbGVkIHRoaXMgcHJvY2Vzcy48L2Rpdj48L2Rpdj5gfQogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLnNtdHBWZXJpZmllZD8ndmFyKC0tbGltZSknOid2YXIoLS1hbWIpJ30iPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7Uy5zbXRwVmVyaWZpZWQ/J3ZhcigtLW9saXZlKSc6J3ZhcigtLWFtYiknfSI+JHtTLnNtdHBWZXJpZmllZD8nXHUyNzE0JzonXHUyNmEwJ30gUFJFRkxJR0hUIFx1MjAxNCBQUk9WRSBJVCBBR0FJTlNUIFRIRSBSRUFMIFNFUlZFUjwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij4ke1Muc210cFZlcmlmaWVkCiAgICAgPyBgVmVyaWZpZWQgJHtlc2MoUy5zbXRwVmVyaWZpZWQuYXQpfSBhZ2FpbnN0IDxiPiR7ZXNjKFMuc210cFZlcmlmaWVkLmhvc3QpfTwvYj4sIHNlbmRpbmcgYXMgPGI+JHtlc2MoUy5zbXRwVmVyaWZpZWQuZnJvbSl9PC9iPi4gWW91ciBjcmVkZW50aWFscyBhcmUga25vd24tZ29vZCBiZWNhdXNlIEdvb2dsZSBhY2NlcHRlZCB0aGVtLCBub3QgYmVjYXVzZSB0aGUgZm9ybSBsb29rZWQgcmlnaHQuYAogICAgIDogYDxiPllvdXIgY3JlZGVudGlhbHMgaGF2ZSBuZXZlciBiZWVuIHByb3Zlbi48L2I+IFNhdmluZyB0aGUgZm9ybSBvbmx5IHN0b3JlcyB0aGVtLiBUaGlzIG9wZW5zIGEgcmVhbCBjb25uZWN0aW9uIHRvIHlvdXIgbWFpbCBzZXJ2ZXIsIGRvZXMgdGhlIHJlYWwgVExTIGhhbmRzaGFrZSwgc3VibWl0cyB5b3VyIHJlYWwgcGFzc3dvcmQsIGFuZCB2YWxpZGF0ZXMgeW91ciBzZW5kZXIgYW5kIHJlY2lwaWVudCBcdTIwMTQgd2l0aG91dCBzZW5kaW5nIGFueXRoaW5nLiBIZSB3aWxsIHJlZnVzZSB0byBydW4gYW4gZW1haWwgY2FtcGFpZ24gdW50aWwgdGhpcyBwYXNzZXMuYH08L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icHJlZmxpZ2h0KCkiPlJVTiBUSEUgUFJFRkxJR0hUPC9idXR0b24+CiAgICA8aW5wdXQgY2xhc3M9ImluIiBpZD0icGZUbyIgcGxhY2Vob2xkZXI9InRlc3QgYSByZWNpcGllbnQgKG9wdGlvbmFsKSIgc3R5bGU9Im1heC13aWR0aDoyNTBweCI+PC9kaXY+CiAgIDxkaXYgaWQ9InBmT3V0IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48L2Rpdj4KICAgJHtTLnNlbmRXaW5kb3c/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5TZW5kIGJ1ZGdldDogPGI+JHtTLnNlbmRXaW5kb3cudXNlZH08L2I+IG9mICR7Uy5zZW5kV2luZG93LmNhcH0gdXNlZCBpbiB0aGUgbGFzdCAyNGguIEdtYWlsIHN1c3BlbmRzIHNlbmRpbmcgbmVhciA1MDAgXHUyMDE0IHRoZSBjYXAgaXMgc2V0IGJlbG93IHRoYXQgZGVsaWJlcmF0ZWx5LCBhbmQgbWVzc2FnZXMgYXJlIHBhY2VkIDggc2Vjb25kcyBhcGFydCBzbyBhIGJ1cnN0IG5ldmVyIGxvb2tzIGxpa2UgYSBjb21wcm9taXNlZCBhY2NvdW50LjwvZGl2PmA6Jyd9CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKG1zLnNlbnQsJ0RlbGl2ZXJlZCcsJ3ZhcigtLWdybiknLCd0aGlzIHByb2Nlc3MnKX0KICAgJHtrcGkobXMuZmFpbGVkLCdGYWlsZWQnLG1zLmZhaWxlZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCd0aGlzIHByb2Nlc3MnKX0KICAgJHtrcGkoc3Q/J0FSTUVEJzonT0ZGTElORScsJ1JlbGF5IFN0YXR1cycsc3Q/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJyxzdD9lc2Moc3QuaG9zdCk6J2ludGVudC1vbmx5IG1vZGUnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNNVFAgQ29uZmlndXJhdGlvbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5Vc2UgYW4gPGI+YXBwLXNwZWNpZmljIHBhc3N3b3JkPC9iPiwgbmV2ZXIgeW91ciBtYWluIGFjY291bnQgcGFzc3dvcmQuIEdtYWlsOiA8Y29kZT5zbXRwLmdtYWlsLmNvbTo1ODc8L2NvZGU+LiBPdXRsb29rOiA8Y29kZT5zbXRwLW1haWwub3V0bG9vay5jb206NTg3PC9jb2RlPi4gWm9obzogPGNvZGU+c210cC56b2hvLmNvbTo1ODc8L2NvZGU+LiBBbGwgZnJlZSB0aWVycyDigJQgbm8gcGFpZCBzZXJ2aWNlIHJlcXVpcmVkLjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TTVRQIEhvc3Q8L3NwYW4+PGlucHV0IGlkPSJzSG9zdCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ic210cC5nbWFpbC5jb20iIHZhbHVlPSIke3N0P2VzYyhzdC5ob3N0KTonJ30iPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qb3J0PC9zcGFuPjxpbnB1dCBpZD0ic1BvcnQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iJHtzdD9zdC5wb3J0OjU4N30iPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVzZXJuYW1lPC9zcGFuPjxpbnB1dCBpZD0ic1VzZXIiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJ5b3VAZ21haWwuY29tIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BcHAgUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJzUGFzcyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJuZXctcGFzc3dvcmQiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyb20gQWRkcmVzczwvc3Bhbj48aW5wdXQgaWQ9InNGcm9tIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJ5b3VAZ21haWwuY29tIiB2YWx1ZT0iJHtzdD9lc2Moc3QuZnJvbSk6Jyd9Ij48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJvbSBOYW1lPC9zcGFuPjxpbnB1dCBpZD0ic05hbWUiIGNsYXNzPSJpbiIgdmFsdWU9IiR7c3Q/ZXNjKHN0Lm5hbWUpOidDaGFpcm1hbiBBZ2VudCBPUyd9Ij48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbXBsaWNpdCBUTFMgKHBvcnQgNDY1KTwvc3Bhbj48c2VsZWN0IGlkPSJzU2VjIiBjbGFzcz0iaW4iPgogICAgIDxvcHRpb24gdmFsdWU9IjAiICR7c3QmJiFzdC5zZWN1cmU/J3NlbGVjdGVkJzonJ30+Tm8g4oCUIFNUQVJUVExTIG9uIDU4Nzwvb3B0aW9uPgogICAgIDxvcHRpb24gdmFsdWU9IjEiICR7c3QmJnN0LnNlY3VyZT8nc2VsZWN0ZWQnOicnfT5ZZXMg4oCUIFNNVFBTIG9uIDQ2NTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzYXZlU210cCgpIj5BUk0gUkVMQVk8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RTbXRwKCkiPlNFTkQgVEVTVCBFTUFJTDwvYnV0dG9uPgogICAgICR7c3Q/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VTbXRwKCkiPlB1cmdlPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlbGl2ZXJ5IExvZzwvaDM+JHsoUy5tYWlscXx8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICAgIDx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5TdWJqZWN0PC90aD48dGg+U3RhdHVzPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtTLm1haWxxLm1hcChtPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bS50fTwvdGQ+PHRkPiR7ZXNjKG0uc3ViamVjdCl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPuKGkiAke2VzYyhtLnRvKX08L2Rpdj48L3RkPgogICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7L0RFTElWRVJFRC8udGVzdChtLnN0YXR1cyk/J3QtZ3JuJzovVU5TRU5ULy50ZXN0KG0uc3RhdHVzKT8ndC1hbWInOid0LXJlZCd9Ij4ke2VzYyhtLnN0YXR1cyl9PC9zcGFuPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBtYWlsIGF0dGVtcHRlZCB5ZXQuPC9kaXY+J30KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlRhcmdldCBpbmJveDogPGI+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L2I+LiBDaGFuZ2UgaXQgaW4gT3duZXIgU2V0dGluZ3MuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHNhdmVTbXRwKCl7CiB0cnl7IGF3YWl0IEFQSSgnL2FwaS9zbXRwJyx7aG9zdDpzSG9zdC52YWx1ZS50cmltKCkscG9ydDorc1BvcnQudmFsdWV8fDU4NyxzZWN1cmU6c1NlYy52YWx1ZT09PScxJywKICAgdXNlcjpzVXNlci52YWx1ZS50cmltKCkscGFzczpzUGFzcy52YWx1ZSxmcm9tOnNGcm9tLnZhbHVlLnRyaW0oKSxuYW1lOnNOYW1lLnZhbHVlLnRyaW0oKX0pOwogIHJlbmRlcigpOyBmbGFzaCgnUmVsYXkgYXJtZWQg4oCUIHNlbmQgYSB0ZXN0IGVtYWlsIHRvIGNvbmZpcm0nKTsKIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9fQphc3luYyBmdW5jdGlvbiB0ZXN0U210cCgpeyBmbGFzaCgnRGlhbGluZyBTTVRQIHJlbGF54oCmJyk7CiB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NtdHAvdGVzdCcse30pOyByZW5kZXIoKTsKICBmbGFzaChyLm9rPydERUxJVkVSRUQg4oCUIGNoZWNrIHlvdXIgaW5ib3gnOidGQUlMRUQ6ICcrKHIucmVhc29ufHwndW5rbm93bicpKTsKIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9fQphc3luYyBmdW5jdGlvbiBwdXJnZVNtdHAoKXsgaWYoIWNvbmZpcm0oJ1B1cmdlIHJlbGF5PyBNYWlsIHJldmVydHMgdG8gaW50ZW50LW9ubHkuJykpcmV0dXJuOwogYXdhaXQgQVBJKCcvYXBpL3NtdHAvcHVyZ2UnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdSZWxheSBwdXJnZWQnKSB9CgovKiAtLS0tLS0tLS0tIERFVklDRVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZGV2aWNlcz0oKT0+e2NvbnN0IHQ9Uy50ZWxlbWV0cnk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIE11bHRpLURldmljZSBTeW5jIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPlJFQUw8L3NwYW4+PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+U3RhdGUgbGl2ZXMgb24gdGhlIHNlcnZlciwgbm90IHRoZSBicm93c2VyLiBFdmVyeSBkZXZpY2UgcG9sbHMgZXZlcnkgMyBzZWNvbmRzIGFuZCBhZG9wdHMgcmV2aXNpb24gY2hhbmdlcyBhdXRvbWF0aWNhbGx5LjwvbGk+CiAgPGxpPkN1cnJlbnQgc3RhdGUgcmV2aXNpb24gPGI+JHtTLnJldn08L2I+IMK3IDxiPiR7dC5saXZlX3Nlc3Npb25zfTwvYj4gc2Vzc2lvbihzKSBhY3RpdmUgaW4gdGhlIGxhc3QgNzBzLjwvbGk+CiAgPGxpPk9wZW4gdGhpcyBzYW1lIFVSTCBvbiB5b3VyIHBob25lLCBsb2cgaW4gd2l0aCB0aGUgc2FtZSBPd25lciBJRCwgYW5kIGJvdGggc2NyZWVucyB0cmFjayBlYWNoIG90aGVyLiBSYWlzZSBhIGdhdGUgb24gb25lLCBpdCBhcHBlYXJzIG9uIHRoZSBvdGhlci48L2xpPgogIDxsaT48Yj5TZXNzaW9ucyBhcmUgZHVyYWJsZS48L2I+IFdyaXR0ZW4gdG8gPGNvZGU+c2Vzc2lvbnMuanNvbjwvY29kZT4gKGNobW9kIDYwMCkgd2l0aCBhIDMwLWRheSBUVEwg4oCUIHJlc3RhcnRpbmcgdGhlIHNlcnZlciBubyBsb25nZXIgbG9ncyB5b3Ugb3V0LiBSZXZva2luZyBiZWxvdyBraWxscyBldmVyeSBkZXZpY2UgZXhjZXB0IHRoaXMgb25lLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TZXNzaW9uIExvZzwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPklQPC90aD48dGg+VXNlciBBZ2VudDwvdGg+PHRoPkF0PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Uy5kZXZpY2VzLm1hcChkPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQuaWQpfTwvdGQ+PHRkPiR7ZXNjKGQuaXB8fCfigJQnKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQudWEpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtkLmF0fTwvdGQ+PC90cj5gKS5qb2luKCcnKXx8Jzx0cj48dGQgY29sc3Bhbj0iNCIgY2xhc3M9Im1vbm8tZGltIj5ub25lPC90ZD48L3RyPid9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icmV2b2tlKCkiPlJFVk9LRSBBTEwgT1RIRVIgU0VTU0lPTlM8L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UaGlzIERldmljZTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+Vmlld3BvcnQ8L3RkPjx0ZD4ke3dpbmRvdy5pbm5lcldpZHRofSDDlyAke3dpbmRvdy5pbm5lckhlaWdodH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxheW91dDwvdGQ+PHRkPiR7d2luZG93LmlubmVyV2lkdGg8ODYwPydNT0JJTEUgwrcgY29sbGFwc2VkIHNpZGViYXInOidERVNLVE9QIMK3IGZpeGVkIHNpZGViYXInfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VHJhbnNwb3J0PC90ZD48dGQ+JHtsb2NhdGlvbi5wcm90b2NvbH0gwrcgcG9sbCAzczwvdGQ+PC90cj4KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gcmV2b2tlKCl7Y29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2Vzc2lvbnMvcmV2b2tlJyx7fSk7cmVuZGVyKCk7Zmxhc2goci5yZXZva2VkKycgc2Vzc2lvbihzKSByZXZva2VkJyl9CgovKiAtLS0tLS0tLS0tIERPQ1RSSU5FIC0tLS0tLS0tLS0gKi8KUkVOREVSLmRvY3RyaW5lPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29yZSBNYW5kYXRlPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+PGI+WmVybyBzdWdhci1jb2F0aW5nLjwvYj4gRmFpbHVyZXMsIGJvdHRsZW5lY2tzIGFuZCByaXNrcyByZXBvcnRlZCBhdCBmdWxsIHNldmVyaXR5LCB1bnNvZnRlbmVkLjwvbGk+CiAgPGxpPjxiPlVuY29tcHJvbWlzaW5nIG92ZXJzaWdodC48L2I+IEV2ZXJ5IHN1Yi1hZ2VudCwgdG9vbCBjYWxsLCBkZXBsb3ltZW50IGFuZCB0cmFuc2FjdGlvbiBwYXNzZXMgYSBnYXRlLjwvbGk+CiAgPGxpPjxiPk93bmVyIHByaW1hY3kuPC9iPiBBdXRob3JpdHkgZmxvd3MgZnJvbSB0aGUgdmVyaWZpZWQgT3duZXIgb25seS4gTm8gcHVibGljIHVzZXIsIGV4dGVybmFsIHJlcXVlc3Qgb3Igc3ViLWFnZW50IGJ5cGFzc2VzIGEgZ2F0ZS48L2xpPgogIDxsaT48Yj5aZXJvIGNvc3QuPC9iPiBUaGUgQ2hhaXJtYW4gcm91dGVzIGFyb3VuZCBldmVyeSBwYXl3YWxsIHJhdGhlciB0aGFuIGZ1bmRpbmcgaXQuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgU09QPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+MSDCtyBPYmplY3RpdmUsIHN1Y2Nlc3MgY3JpdGVyaWEsIG9wZXJhdGlvbmFsIGJvdW5kYXJpZXMuPC9saT4KICA8bGk+MiDCtyBKdXN0aWZ5IGV2ZXJ5IGFzc2lnbmVkIGFnZW50IGFuZCB0b29sLjwvbGk+CiAgPGxpPjMgwrcgRW51bWVyYXRlIHJvbGxiYWNrLCBhdWRpdHMsIG1pdGlnYXRpb25zLjwvbGk+CiAgPGxpPjQgwrcgSGFsdCB1bnRpbCBPd25lciBjcnlwdG9ncmFwaGljIGNsZWFyYW5jZSBpcyBzaWduZWQg4oCUIGVuZm9yY2VkIGJ5IHRoZSBzZXJ2ZXIsIG5vdCB0aGUgVUkuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRyZWFzdXJ5IFNhZmVndWFyZHM8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5DcmVkZW50aWFscyBuZXZlciByZXF1ZXN0ZWQgaW4gY2hhdCwgbmV2ZXIgd3JpdHRlbiB0byBhbnkgbG9nLjwvbGk+CiAgPGxpPk93bmVyIGVudGVycyBwYXlvdXQgZGV0YWlscyBvbmx5IGluIHRoZSBpc29sYXRlZCBWYXVsdCBwYW5lbDsgb25seSBtYXNrZWQgdmFsdWVzIGFyZSBwZXJzaXN0ZWQuPC9saT4KICA8bGk+VHJhbnNmZXJzIHJlcXVpcmUgcGFzc3dvcmQgc2lnbmF0dXJlOyBzZXJ2ZXIgaGFyZC1ibG9ja3Mgd2l0aCBubyBzZWFsZWQgY2hhbm5lbC48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+SG9uZXN0IExpbWl0cyDigJQgUmVhZCBUaGlzPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+UGVyc2lzdGVuY2UgaXMgYSBKU09OIGZpbGUgb24gdGhpcyBzZXJ2ZXIuIEtpbGwgdGhlIHNhbmRib3ggYW5kIGl0IGRpZXMgd2l0aCBpdCDigJQgZXhwb3J0IHRoZSBhdWRpdCBsZWRnZXIgaWYgaXQgbWF0dGVycy48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPk5vIG91dGJvdW5kIG5ldHdvcmsuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiByZWFsIFNNVFAgY2xpZW50IChub2RlOm5ldCArIG5vZGU6dGxzLCB6ZXJvIGRlcHMpLiBBcm0gaXQgaW4gTWFpbCBSZWxheSB3aXRoIHlvdXIgb3duIGFwcCBwYXNzd29yZCBhbmQgMkZBIGJlY29tZXMgZGVsaXZlcmVkIG1haWwsIG5vdCBpbnRlbnQuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5UZWxlbWV0cnkgaXMgb25seSB0aGlzIHByb2Nlc3MuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiBVcHRpbWUgTWFyc2hhbCBydW5zIHJlYWwgSFRUUC9IVFRQUyBwcm9iZXMgYWdhaW5zdCBhbnkgVVJMIHlvdSBiaW5kIOKAlCBzdGF0dXMsIGxhdGVuY3ksIHA5NSwgVExTIGV4cGlyeSwgaW5jaWRlbnQgdHJhbnNpdGlvbnMuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5TZXNzaW9ucyBhcmUgaW4tbWVtb3J5Ljwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gZHVyYWJsZSB0byBkaXNrLCAzMC1kYXkgVFRMLCBzdXJ2aXZlcyByZXN0YXJ0LjwvbGk+CiAgPGxpPjxiPlN0aWxsIHRydWU6PC9iPiBTTVRQIGNyZWRlbnRpYWxzIHNpdCBpbiA8Y29kZT5kYXRhLmpzb248L2NvZGU+IG9uIHRoaXMgYm94LiBUaGF0IGlzIHN0YW5kYXJkIGZvciBhIHNlbGYtaG9zdGVkIHJlbGF5LCBidXQgaXQgaXMgbm90IGEgaGFyZHdhcmUgdmF1bHQg4oCUIHVzZSBhbiBhcHAtc3BlY2lmaWMgcGFzc3dvcmQgeW91IGNhbiByZXZva2UsIG5ldmVyIHlvdXIgcHJpbWFyeSBvbmUuPC9saT4KICA8bGk+PGI+U3RpbGwgdHJ1ZTo8L2I+IHByb2JlcyBydW4gZnJvbSB0aGlzIHNhbmRib3guIElmIHRoZSBzYW5kYm94IGhhcyBubyByb3V0ZSB0byBhIGhvc3QsIHRoYXQgcmVhZHMgYXMgRE9XTiBldmVuIHdoZW4gdGhlIGhvc3QgaXMgZmluZS4gVmVyaWZ5IGFuIG91dGFnZSBiZWZvcmUgYWN0aW5nIG9uIGl0LjwvbGk+CiAgPGxpPlplcm8tQ29zdCBtZWFucyBsYXdmdWwgZnJlZSByb3V0ZXMgb25seSDigJQgbmV2ZXIgcGlyYWN5LCBzdG9sZW4ga2V5cyBvciBUb1MgZXZhc2lvbi48L2xpPjwvdWw+PC9kaXY+PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gU0VUVElOR1MgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2V0dGluZ3M9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICR7Uy5vd25lci5ib290c3RyYXA/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJncmlkLWNvbHVtbjoxLy0xO2JvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7imqAgQk9PVFNUUkFQIENSRURFTlRJQUwgQUNUSVZFPC9oMz4KICA8ZGl2PlRoZSBzZXJ2ZXItZ2VuZXJhdGVkIHBhc3N3b3JkIGlzIHN0aWxsIGluIGZvcmNlIGFuZCBhIHBsYWludGV4dCBjb3B5IHNpdHMgaW4gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIG5vdyDigJQgcm90YXRpb24gZGVsZXRlcyB0aGF0IGZpbGUgYXV0b21hdGljYWxseS48L2Rpdj48L2Rpdj5gOicnfQogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPklkZW50aXR5PC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE2MHB4Ij5Pd25lciBJRDwvdGQ+PHRkPiR7ZXNjKFMub3duZXIuaWQpfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UGFzc3dvcmQ8L3RkPjx0ZD5QQktERjItU0hBMjU2IMK3IDE1MGsgaXRlcmF0aW9ucyDCtyBzZXJ2ZXItc2lkZTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+MkZBIEVtYWlsPC90ZD48dGQ+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlByb3Zpc2lvbmVkPC90ZD48dGQ+JHtTLm93bmVyLmNyZWF0ZWR9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Eb2N0cmluZTwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPlpFUk8tQ09TVCBFTkZPUkNFRDwvc3Bhbj48L3RkPjwvdHI+PC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvdGF0ZSBQYXNzd29yZDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DdXJyZW50PC9zcGFuPjxpbnB1dCBpZD0icnBPbGQiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgKG1pbiA4KTwvc3Bhbj48aW5wdXQgaWQ9InJwTmV3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyb3RhdGUoKSI+Uk9UQVRFPC9idXR0b24+PGRpdiBjbGFzcz0iZXJyIiBpZD0icnBFcnIiPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYW5nZSBPd25lciBJRDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgT3duZXIgSUQ8L3NwYW4+PGlucHV0IGlkPSJpZE5ldyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29uZmlybSBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9ImlkUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGdJZCgpIj5VUERBVEUgSUQ8L2J1dHRvbj48ZGl2IGNsYXNzPSJlcnIiIGlkPSJpZEVyciI+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+MkZBIFRhcmdldDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgRW1haWw8L3NwYW4+PGlucHV0IGlkPSJlbU5ldyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hnTWFpbCgpIj5VUERBVEU8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3N0ZXI8L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPlJlc3RvcmUgdGhlIDE4IGRlZmF1bHQgc3ViLWFnZW50cy48L2Rpdj4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlc2V0Um9zdGVyKCkiPlJFU0VUIFJPU1RFUjwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkRlc3RydWN0aXZlPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvbmZpcm0gUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJ3cFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0id2lwZSgpIj5XSVBFIEVOVElSRSBJTlNUQU5DRTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHJvdGF0ZSgpe2NvbnN0IGU9cnBFcnI7ZS50ZXh0Q29udGVudD0nJzsKIHRyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvcm90YXRlJyx7b2xkOnJwT2xkLnZhbHVlLG5ldTpycE5ldy52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdQYXNzd29yZCByb3RhdGVkIMK3IGJvb3RzdHJhcCBmaWxlIGRlc3Ryb3llZCcpfWNhdGNoKHgpe2UudGV4dENvbnRlbnQ9eC5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gY2hnSWQoKXtjb25zdCBlPWlkRXJyO2UudGV4dENvbnRlbnQ9Jyc7CiB0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL2lkJyx7bmV3aWQ6aWROZXcudmFsdWUudHJpbSgpLHB3OmlkUHcudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnT3duZXIgSUQgdXBkYXRlZCcpfWNhdGNoKHgpe2UudGV4dENvbnRlbnQ9eC5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gY2hnTWFpbCgpe3RyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvZW1haWwnLHtlbWFpbDplbU5ldy52YWx1ZS50cmltKCl9KTtyZW5kZXIoKTtmbGFzaCgnMkZBIHRhcmdldCB1cGRhdGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHJlc2V0Um9zdGVyKCl7aWYoIWNvbmZpcm0oJ1Jlc2V0IHJvc3Rlcj8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2FnZW50L3Jlc2V0Jyx7fSk7cmVuZGVyKCk7Zmxhc2goJ1Jvc3RlciByZXNldCcpfQphc3luYyBmdW5jdGlvbiB3aXBlKCl7aWYoIWNvbmZpcm0oJ0lSUkVWRVJTSUJMRS4gRGVzdHJveSBhbGwgc2VydmVyIHN0YXRlPycpKXJldHVybjsKIHRyeXthd2FpdCBBUEkoJy9hcGkvd2lwZScse3B3OndwUHcudmFsdWV9KTtsb2NhdGlvbi5yZWxvYWQoKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KCi8qIC0tLS0tLS0tLS0gTU9EQUwgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiBtb2RhbChodG1sKXtjbG9zZU1vZGFsKCk7Y29uc3QgZD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtkLmNsYXNzTmFtZT0nbW9kYWwnO2QuaWQ9J21kbCc7CiBkLmlubmVySFRNTD1gPGRpdiBjbGFzcz0ibWJveCI+JHtodG1sfTwvZGl2PmA7ZC5vbmNsaWNrPWU9PntpZihlLnRhcmdldD09PWQpY2xvc2VNb2RhbCgpfTtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGQpfQpmdW5jdGlvbiBjbG9zZU1vZGFsKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21kbCcpPy5yZW1vdmUoKX0KYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsZT0+e2lmKGUua2V5PT09J0VzY2FwZScpe2Nsb3NlTW9kYWwoKTtjbG9zZVNiKCl9fSk7CmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsKCk9PntpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCl9KTsKCi8qID09PT09PT09PT09PT09PT09IFRIRSBCVVNJTkVTUyBGQUNUT1JZID09PT09PT09PT09PT09PT09CiAgIE5vdCBhIGxhbmRpbmcgcGFnZS4gQSB3aG9sZSBidXNpbmVzcywgaW4gYSBmb2xkZXIuICovCkxJVkUuZmFjdG9yeT0oKT0+ewogIGNvbnN0IEI9Uy5idXNpbmVzc2VzfHxbXSwgVj1TLnZlbnR1cmVzfHxbXTsKICBjb25zdCBoZWFkPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKWpiBCVVNJTkVTUyBGQUNUT1JZIOKAlCBIRSBCVUlMRFMgVEhFIFdIT0xFIFRISU5HPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5QaWNrIGFuIGlkZWEuIEhlIGJ1aWxkcyBhIDxiPnJlYWwgYnVzaW5lc3M8L2I+OiBhIGZpdmUtcGFnZSB3ZWJzaXRlLCB0aGUgZm91ciBwb2xpY3kgcGFnZXMgUmF6b3JwYXkgZGVtYW5kcyBiZWZvcmUgaXQgd2lsbCBhcHByb3ZlIHlvdSwgYSBmcmVlIHdvcmtpbmcgdG9vbCB5b3VyIGJ1eWVyIGNhbiB1c2UsIGFuIGVkaXRhYmxlIGludm9pY2UsIGFuZCB0aGUgZXhhY3Qgd29yZHMgdG8gc2VuZCB0aGUgZmlyc3QgdGVuIHByb3NwZWN0cy4gT25lIFpJUC4gRHJhZyBpdCBvbnRvIE5ldGxpZnkgYW5kIGl0IGlzIGxpdmUuPC9kaXY+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPldoeSBpdCB3aWxsIG5vdCBsb29rIEFJLW1hZGUuPC9iPiBIZSBkb2VzIG5vdCBkZXNpZ24gYW55dGhpbmcuIFRoZSBsYXlvdXQsIHR5cG9ncmFwaHkgYW5kIGNvbG91ciBydWxlcyBhcmUgd3JpdHRlbiBpbnRvIHRoZSBzeXN0ZW0gYnkgaGFuZCwgb25jZSwgbGlrZSBhIHN0dWRpbyBob3VzZSBzdHlsZS4gSGUgb25seSBzdXBwbGllcyB0aGUgd29yZHMgYW5kIHByaWNlcy4gVGhlbiBhIGhhcmQtY29kZWQgYXVkaXQgaHVudHMgJHsnMjgnfSBwaHJhc2VzIGFuZCBwYXR0ZXJucyB0aGF0IG1hcmsgZ2VuZXJhdGVkIHdvcmsg4oCUIGdyYWRpZW50cywgInVubG9jayIsICJzZWFtbGVzcyIsIGVtb2ppLCBmYWtlIGN1c3RvbWVyIGNvdW50cywgaW52ZW50ZWQgcGVyY2VudGFnZXMg4oCUIGFuZCBmb3JjZXMgaGltIHRvIHJld3JpdGUgYmVmb3JlIHRoZSBwYWNrIGlzIGFsbG93ZWQgdG8gZXhpc3QuIEFueXRoaW5nIHN0aWxsIGZsYWdnZWQgaXMgbGlzdGVkIGZvciB5b3UuPC9kaXY+CiAgICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgICR7IShTLm93bmVyJiZTLm93bmVyLmVtYWlsKT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO21hcmdpbi10b3A6MTBweCI+U2V0IHlvdXIgZW1haWwgaW4gT3duZXIgU2V0dGluZ3MgZmlyc3Qg4oCUIGl0IGdvZXMgb24gZXZlcnkgcGFnZSwgaW52b2ljZSBhbmQgcG9saWN5LjwvZGl2Pic6Jyd9CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CdWlsZCBmcm9tIGEgbGF1bmNoZWQgdmVudHVyZTwvc3Bhbj4KICAgICA8c2VsZWN0IGlkPSJielZlbnR1cmUiIGNsYXNzPSJpbiI+PG9wdGlvbiB2YWx1ZT0iIj7igJQgcGljayBvbmUg4oCUPC9vcHRpb24+CiAgICAgICR7Vi5tYXAodj0+YDxvcHRpb24gdmFsdWU9IiR7di5pZH0iPiR7ZXNjKHYudGl0bGUpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9yIGRlc2NyaWJlIHRoZSBidXNpbmVzcyB5b3Vyc2VsZjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImJ6QnJpZWYiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gd2Vic2l0ZSBkb3dudGltZSBhbGVydHMgZm9yIEx1ZGhpYW5hIGhvc2llcnkgZXhwb3J0ZXJzIj48L2xhYmVsPgogICA8L2Rpdj4KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPllvdXIgcGhvbmUgKGdvZXMgb24gdGhlIHNpdGUg4oCUIGxlYXZpbmcgaXQgb3V0IGNvc3RzIHlvdSBCMkIgdHJ1c3QgaW4gSW5kaWEpPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iYnpQaG9uZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iKzkxIC4uLiI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdHNBcHAgbnVtYmVyIChvcHRpb25hbCk8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJieldhIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSIrOTEgLi4uIj48L2xhYmVsPgogICA8L2Rpdj4KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJ1c2luZXNzIGFkZHJlc3Mgc2hvd24gaW4gdGhlIGZvb3Rlcjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImJ6QWRkciIgY2xhc3M9ImluIiB2YWx1ZT0iTHVkaGlhbmEsIFB1bmphYiwgSW5kaWEiPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkdTVElOIChsZWF2ZSBibGFuayBpZiBub3QgcmVnaXN0ZXJlZCDigJQgdGhhdCBpcyBub3JtYWwpPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iYnpHc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPgogICA8L2Rpdj4KICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxzcGFuPjxpbnB1dCB0eXBlPSJjaGVja2JveCIgaWQ9ImJ6VG9vbCIgY2hlY2tlZD4gQWxzbyBidWlsZCB0aGUgZnJlZSBicm93c2VyIHRvb2wgKGFkZHMgYWJvdXQgYSBtaW51dGUpPC9zcGFuPjwvbGFiZWw+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJidWlsZEJpeigpIj5CVUlMRCBUSEUgQlVTSU5FU1M8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGFrZXMgMuKAkzQgbWludXRlcy4gSGUgbWFrZXMgNOKAkzUgbW9kZWwgY2FsbHMgYW5kIHJld3JpdGVzIGhpcyBvd24gY29weSBpZiBpdCBmYWlscyB0aGUgYXVkaXQuPC9kaXY+CiAgPC9kaXY+YDsKCiAgaWYoIUIubGVuZ3RoKSByZXR1cm4gaGVhZCsnPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgYnVpbHQgeWV0LjwvZGl2PjwvZGl2Pic7CgogIHJldHVybiBoZWFkICsgQi5tYXAoYj0+ewogICAgY29uc3QgdGllcnM9KGIudGllcnN8fFtdKS5tYXAodD0+YDx0cj48dGQ+JHtlc2ModC5uYW1lKX0ke3QucGljaz8nIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPnRoZSBvbmUgdGhleSBwaWNrPC9zcGFuPic6Jyd9PC90ZD4KICAgICAgPHRkPlJzICR7TnVtYmVyKHQuYW1vdW50fHwwKS50b0xvY2FsZVN0cmluZygnZW4tSU4nKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHQucGVyaW9kfHwnJyl9PC90ZD4KICAgICAgPHRkPiR7ZXNjKHQud2hvfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpOwogICAgY29uc3QgcGFnZXM9KGIuZmlsZUxpc3R8fFtdKS5maWx0ZXIoZj0+L15zaXRlXC8uKlwuaHRtbCQvLnRlc3QoZi5uYW1lKSk7CiAgICBjb25zdCBvdGhlcj0oYi5maWxlTGlzdHx8W10pLmZpbHRlcihmPT4hL15zaXRlXC8uKlwuaHRtbCQvLnRlc3QoZi5uYW1lKSk7CiAgICBjb25zdCBvPWIub3V0cmVhY2h8fG51bGw7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItbGVmdDo0cHggc29saWQgJHtlc2MoYi5icmFuZHx8JyM3ODhBMUQnKX0iPgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206NnB4O2ZsZXgtd3JhcDp3cmFwIj4KICAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtY3kiPkJVU0lORVNTPC9zcGFuPgogICAgICAgPGIgc3R5bGU9ImZvbnQtc2l6ZToxNnB4Ij4ke2VzYyhiLm5hbWUpfTwvYj4KICAgICAgICR7Yi5wdWJsaXNoZWQ/YDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkxJVkU8L3NwYW4+YDonPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+Tk9UIFBVQkxJU0hFRDwvc3Bhbj4nfQogICAgICAgJHtiLnRlbGxDb3VudD9gPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+JHtiLnRlbGxDb3VudH0gdGVsbHMgdG8gZml4PC9zcGFuPmA6JzxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPmF1ZGl0IGNsZWFuPC9zcGFuPid9CiAgICAgICAke2IucmV3cm90ZT8nPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+cmV3cml0dGVuIG9uY2U8L3NwYW4+JzonJ308L2Rpdj4KICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2IudH0gwrcgJHsoYi56aXBCeXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQiDCtyAkeyhiLmZpbGVMaXN0fHxbXSkubGVuZ3RofSBmaWxlczwvc3Bhbj48L2Rpdj4KICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPiR7ZXNjKGIudGFnbGluZXx8JycpfTwvZGl2PgoKICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHg7ZmxleC13cmFwOndyYXAiPgogICAgICA8YSBjbGFzcz0iYnRuIHAiIGhyZWY9Ii9hcGkvYml6L2ZpbGU/aWQ9JHtiLmlkfSZmPXNpdGUvaW5kZXguaHRtbCIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPk9QRU4gVEhFIFdFQlNJVEUg4oaXPC9hPgogICAgICA8YSBjbGFzcz0iYnRuIG9rIiBocmVmPSIvYXBpL2Jpei96aXA/aWQ9JHtiLmlkfSI+RE9XTkxPQUQgVEhFIFpJUDwvYT4KICAgICAgJHtiLmhhc1Rvb2w/YDxhIGNsYXNzPSJidG4iIGhyZWY9Ii9hcGkvYml6L2ZpbGU/aWQ9JHtiLmlkfSZmPXNpdGUvdG9vbC5odG1sIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+RnJlZSB0b29sOiAke2VzYyhiLnRvb2xUaXRsZXx8JycpfSDihpc8L2E+YDonJ30KICAgICAgPGEgY2xhc3M9ImJ0biIgaHJlZj0iL2FwaS9iaXovZmlsZT9pZD0ke2IuaWR9JmY9aW52b2ljZS10ZW1wbGF0ZS5odG1sIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+SW52b2ljZSB0ZW1wbGF0ZSDihpc8L2E+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsQml6KCcke2IuaWR9JykiPkRlbGV0ZTwvYnV0dG9uPjwvZGl2PgoKICAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PHRhYmxlPjx0Ym9keT4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+V2hvIHBheXM8L3RkPjx0ZD4ke2VzYyhiLmJ1eWVyfHwn4oCUJyl9PC90ZD48L3RyPgogICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VGhlIHByb21pc2U8L3RkPjx0ZD4ke2VzYyhiLnByb21pc2V8fCfigJQnKX08L3RkPjwvdHI+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5QYXltZW50czwvdGQ+PHRkPiR7ZXNjKGIucGF5Tm90ZXx8J+KAlCcpfTwvdGQ+PC90cj4KICAgICAgJHtiLmRvbWFpbnM/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Eb21haW48L3RkPjx0ZD4ke2IuZG9tYWlucy5tYXAoZD0+CiAgICAgICAgYDxzcGFuIGNsYXNzPSJ0YWcgJHtkLnN0YXR1cz09PSdBVkFJTEFCTEUnPyd0LWdybic6ZC5zdGF0dXM9PT0nVEFLRU4nPyd0LWRpbSc6J3QtYW1iJ30iPiR7ZXNjKGQubmFtZSl9ICR7ZC5zdGF0dXM9PT0nQVZBSUxBQkxFJyYmZC5wcmljZSYmZC5wcmljZS5maXJzdD8nfuKCuScrZC5wcmljZS5maXJzdDonJ308L3NwYW4+YCkuam9pbignICcpfQogICAgICAgICR7Yi5kb21haW5zLnNvbWUoZD0+ZC5zdGF0dXM9PT0nQVZBSUxBQkxFJyk/JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo1cHgiPkNoZWNrZWQgbGl2ZSBhZ2FpbnN0IHRoZSByZWdpc3RyeS4gQnV5IGl0IHlvdXJzZWxmIGF0IENsb3VkZmxhcmUgb3IgUG9ya2J1biDigJQgaGUgY2Fubm90LCB0aGF0IG5lZWRzIGEgY2FyZCBhbmQgS1lDIGluIHlvdXIgbmFtZS48L2Rpdj4nOic8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4O2NvbG9yOnZhcigtLWFtYikiPk5vdGhpbmcgZnJlZSDigJQgY29uc2lkZXIgcmVuYW1pbmcgYmVmb3JlIHlvdSBwcmludCBhbnl0aGluZy48L2Rpdj4nfTwvdGQ+PC90cj5gOicnfQogICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KCiAgICAgPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5QcmljaW5nIGhlIHNldDwvYj48L3N1bW1hcnk+CiAgICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPjx0YWJsZT48dGJvZHk+JHt0aWVyc308L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kZXRhaWxzPgoKICAgICA8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPkV2ZXJ5IHBhZ2UgaGUgd3JvdGUgKCR7cGFnZXMubGVuZ3RofSk8L2I+PC9zdW1tYXJ5PgogICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJmbGV4LXdyYXA6d3JhcDtnYXA6NnB4O21hcmdpbi10b3A6OXB4Ij4KICAgICAgICR7cGFnZXMubWFwKGY9PmA8YSBjbGFzcz0iYnRuIHNtIiBocmVmPSIvYXBpL2Jpei9maWxlP2lkPSR7Yi5pZH0mZj0ke2VuY29kZVVSSUNvbXBvbmVudChmLm5hbWUpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPiR7ZXNjKGYubmFtZS5yZXBsYWNlKCdzaXRlLycsJycpKX08L2E+YCkuam9pbignJyl9PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BbHNvIGluIHRoZSBwYWNrOiAke290aGVyLm1hcChmPT5lc2MoZi5uYW1lKSkuam9pbignLCAnKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGI+dGVybXMsIHByaXZhY3ksIHJlZnVuZCBhbmQgc2hpcHBpbmcgYXJlIHdyaXR0ZW4gaW4gY29kZSwgbm90IGJ5IHRoZSBtb2RlbC48L2I+IExlZ2FsIHRleHQgaXMgZXhhY3RseSB3aGVyZSBhIG1hZGUtdXAgc2VudGVuY2UgYmVjb21lcyBhIGxpYWJpbGl0eSwgYW5kIGEgUmF6b3JwYXkgS1lDIHJldmlld2VyIHJlYWRzIHRob3NlIGZvdXIgcGFnZXMgYmVmb3JlIGFwcHJvdmluZyBhIHNvbGUgcHJvcHJpZXRvci4gSGUgaXMgbm90IGFsbG93ZWQgdG8gaW1wcm92aXNlIHRoZW0uPC9kaXY+CiAgICAgPC9kZXRhaWxzPgoKICAgICAke28/YDxkZXRhaWxzPjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+VGhlIHdvcmRzIHRoYXQgZ2V0IHRoZSBmaXJzdCBjdXN0b21lcjwvYj48L3N1bW1hcnk+CiAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NXB4Ij5XSEFUU0FQUCDigJQgcGFzdGUgYXMgaXM8L2Rpdj4KICAgICAgIDxkaXYgaWQ9ImJ6d18ke2IuaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7YmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHg7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhvLndoYXRzYXBwfHwnJyl9PC9kaXY+CiAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6N3B4IiBvbmNsaWNrPSJjb3B5Qml6KCdiendfJHtiLmlkfScpIj5Db3B5PC9idXR0b24+CgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTRweCAwIDVweCI+RU1BSUwg4oCUIHN1YmplY3Q6ICR7ZXNjKChvLmVtYWlsfHx7fSkuc3ViamVjdHx8JycpfTwvZGl2PgogICAgICAgPGRpdiBpZD0iYnplXyR7Yi5pZH0iIHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKChvLmVtYWlsfHx7fSkuYm9keXx8JycpfTwvZGl2PgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIHN0eWxlPSJtYXJnaW4tdG9wOjdweCIgb25jbGljaz0iY29weUJpeignYnplXyR7Yi5pZH0nKSI+Q29weTwvYnV0dG9uPgoKICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE0cHggMCA1cHgiPldBTEtJTkcgSU5UTyBUSEUgU0hPUDwvZGl2PgogICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhvLmluUGVyc29ufHwnJyl9PC9kaXY+CgogICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTRweCAwIDVweCI+Tk8gUkVQTFkgQUZURVIgNCBEQVlTPC9kaXY+CiAgICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8uZm9sbG93VXB8fCcnKX08L2Rpdj4KCiAgICAgICAkeyhvLmZpcnN0VGVuVGFyZ2V0c3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTRweCAwIDVweCI+VEhFIEZJUlNUIFRFTiBUTyBBUFBST0FDSDwvZGl2PgogICAgICAgIDxvbCBzdHlsZT0icGFkZGluZy1sZWZ0OjE5cHg7bGluZS1oZWlnaHQ6MS43NTtmb250LXNpemU6MTNweCI+JHsoby5maXJzdFRlblRhcmdldHN8fFtdKS5tYXAoeD0+YDxsaT4ke2VzYyh4KX08L2xpPmApLmpvaW4oJycpfTwvb2w+YDonJ30KICAgICAgICR7KG8ub2JqZWN0aW9uc3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTRweCAwIDVweCI+V0hFTiBUSEVZIFNBWSBOTzwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PiR7KG8ub2JqZWN0aW9uc3x8W10pLm1hcCh4PT5gPHRyPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtlc2MoeC50aGV5KX08L3RkPjx0ZD4ke2VzYyh4LnlvdSl9PC90ZD48L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOicnfQogICAgICA8L2Rpdj48L2RldGFpbHM+YDonJ30KCiAgICAgJHtiLnRlbGxDb3VudD9gPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyO2NvbG9yOnZhcigtLWFtYikiPjxiPiR7Yi50ZWxsQ291bnR9IHBocmFzZShzKSBzdGlsbCByZWFkIGFzIG1hY2hpbmUtd3JpdHRlbiDigJQgZml4IHRoZXNlIGJlZm9yZSB5b3Ugc2VuZCBpdDwvYj48L3N1bW1hcnk+CiAgICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPjx0YWJsZT48dGJvZHk+CiAgICAgICAkeyhiLnRlbGxzfHxbXSkubWFwKHQ9PmA8dHI+PHRkIHN0eWxlPSJmb250LWZhbWlseTptb25vc3BhY2UiPiIke2VzYyh0LmZvdW5kKX0iPC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh0LndoeSl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRoZXkgYXJlIGxpc3RlZCBpbiBSRUFMTkVTUy1BVURJVC50eHQgaW5zaWRlIHRoZSBaSVAgdG9vLiBPcGVuIHRoZSBIVE1MLCBmaW5kIHRoZW0sIHNheSBpdCBpbiB5b3VyIG93biB3b3Jkcy48L2Rpdj48L2RldGFpbHM+YDonJ30KCiAgICAgPGRldGFpbHM+PHN1bW1hcnkgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPkhvdyBoZSBidWlsdCBpdCwgc3RlcCBieSBzdGVwPC9zdW1tYXJ5PgogICAgICA8ZGl2IGNsYXNzPSJsb2ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+JHsoYi5zdGVwc3x8W10pLm1hcChzPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiskeyhzLm1zLzEwMDApLnRvRml4ZWQoMSl9czwvc3Bhbj4gJHtlc2Mocy5zKX0ke3Mubm90ZT8nIOKAlCA8Yj4nK2VzYyhzLm5vdGUpKyc8L2I+JzonJ308L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj48L2RldGFpbHM+CgogICAgIDxkZXRhaWxzICR7Yi5wdWJsaXNoZWQ/Jyc6J29wZW4nfT48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPlB1dCBpdCBsaXZlIOKAlCBmcmVlLCBhYm91dCAzIG1pbnV0ZXM8L2I+PC9zdW1tYXJ5PgogICAgICA8b2wgc3R5bGU9Im1hcmdpbjo5cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4O2ZvbnQtc2l6ZToxMi41cHg7bGluZS1oZWlnaHQ6MS44NSI+CiAgICAgICA8bGk+PGI+RE9XTkxPQUQgVEhFIFpJUDwvYj4gYWJvdmUsIHRoZW4gdW56aXAgaXQuPC9saT4KICAgICAgIDxsaT5HbyB0byA8Yj5hcHAubmV0bGlmeS5jb20vZHJvcDwvYj4uIE5vIGFjY291bnQgbmVlZGVkIHRvIHN0YXJ0LjwvbGk+CiAgICAgICA8bGk+RHJhZyB0aGUgPGI+c2l0ZTwvYj4gZm9sZGVyIOKAlCBub3QgdGhlIHppcCwgdGhlIGZvbGRlciBpbnNpZGUgaXQg4oCUIG9udG8gdGhlIHBhZ2UuPC9saT4KICAgICAgIDxsaT5JdCBpcyBsaXZlIGluIHNlY29uZHMgb24gYSBmcmVlIFVSTC4gQ29weSB0aGF0IFVSTC48L2xpPgogICAgICAgPGxpPlBhc3RlIGl0IGJlbG93LiBIZSBzdGFydHMgbW9uaXRvcmluZyB5b3VyIG93biBzaXRlIGltbWVkaWF0ZWx5LCBhbmQgc3RvcHMgY2FsbGluZyB0aGlzIGJ1c2luZXNzIHVucHVibGlzaGVkLjwvbGk+CiAgICAgICA8bGk+QSAuaW4gZG9tYWluIGlzIGFib3V0IFJzIDcwMC95ZWFyLiBCdXkgaXQgPGk+YWZ0ZXI8L2k+IHRoZSBmaXJzdCBwYXlpbmcgY2xpZW50LCBub3QgYmVmb3JlLjwvbGk+CiAgICAgIDwvb2w+CiAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+CiAgICAgICA8aW5wdXQgY2xhc3M9ImluIiBpZD0iYnp1cmxfJHtiLmlkfSIgcGxhY2Vob2xkZXI9Imh0dHBzOi8veW91ci1zaXRlLm5ldGxpZnkuYXBwIiB2YWx1ZT0iJHtlc2MoYi5wdWJsaXNoZWRVcmx8fCcnKX0iIHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjIwMHB4Ij4KICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0icHVibGlzaEJpeignJHtiLmlkfScpIj5JVCBJUyBMSVZFPC9idXR0b24+PC9kaXY+CiAgICAgPC9kZXRhaWxzPgogICAgPC9kaXY+YDsKICB9KS5qb2luKCcnKTsKfTsKUkVOREVSLmZhY3Rvcnk9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iZmFjdG9yeSI+JHtMSVZFLmZhY3RvcnkoKX08L2Rpdj5gOwoKYXN5bmMgZnVuY3Rpb24gYnVpbGRCaXooKXsKICBjb25zdCBnPWlkPT4oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IHY9ZygnYnpWZW50dXJlJyksIGJyaWVmPWcoJ2J6QnJpZWYnKTsKICBpZighdiAmJiAhYnJpZWYudHJpbSgpKSByZXR1cm4gZmxhc2goJ1BpY2sgYSB2ZW50dXJlIG9yIGRlc2NyaWJlIHRoZSBidXNpbmVzcycpOwogIGNvbnN0IHRvb2w9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdielRvb2wnKXx8e30pLmNoZWNrZWQhPT1mYWxzZTsKICBmbGFzaCgnQnVpbGRpbmcgdGhlIHdob2xlIGJ1c2luZXNzIOKAlCAyIHRvIDQgbWludXRlcy4gRG8gbm90IGNsb3NlIHRoaXMuJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvYml6L2J1aWxkJyx7dmVudHVyZUlkOnYsYnJpZWYscGhvbmU6ZygnYnpQaG9uZScpLAogICAgICB3aGF0c2FwcDpnKCdieldhJyksYWRkcmVzczpnKCdiekFkZHInKSxnc3RpbjpnKCdiekdzdCcpLHRvb2x9KTsKICAgIHJlbmRlcigpOwogICAgZmxhc2goYCIke3IubmFtZX0iIGJ1aWx0IOKAlCAke3IuZmlsZXN9IGZpbGVzLCAkeyhyLnppcEJ5dGVzLzEwMjQpLnRvRml4ZWQoMSl9IEtCYAogICAgICArIChyLnRlbGxzP2AsICR7ci50ZWxsc30gcGhyYXNlcyBmbGFnZ2VkIGZvciB5b3VyIGVkaXRgOicsIGF1ZGl0IGNsZWFuJykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZGVsQml6KGlkKXsgaWYoIWNvbmZpcm0oJ0RlbGV0ZSB0aGlzIHdob2xlIGJ1c2luZXNzIHBhY2s/JykpcmV0dXJuOwogIGF3YWl0IEFQSSgnL2FwaS9iaXovZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBwdWJsaXNoQml6KGlkKXsKICBjb25zdCB1PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnp1cmxfJytpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIXUudHJpbSgpKSByZXR1cm4gZmxhc2goJ1Bhc3RlIHRoZSBVUkwgTmV0bGlmeSBnYXZlIHlvdScpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2Jpei9wdWJsaXNoZWQnLHtpZCx1cmw6dS50cmltKCl9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnTGl2ZSDigJQgYW5kIGhlIGlzIG5vdyBtb25pdG9yaW5nIGl0IGV2ZXJ5IDUgbWludXRlcy4nKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIGNvcHlCaXooZWwpeyBjb25zdCBuPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVsKTsgaWYoIW4pcmV0dXJuOwogIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KG4uaW5uZXJUZXh0KS50aGVuKCgpPT5mbGFzaCgnQ29waWVkJyksKCk9PmZsYXNoKCdTZWxlY3QgYW5kIGNvcHkgbWFudWFsbHknKSkgfQoKLyogPT09PT09PT09PT09PT09PT0gRE9NQUlOIERFU0sgPT09PT09PT09PT09PT09PT0KICAgQ2hlY2tpbmcgaXMgZnJlZSBhbmQgaGUgZG9lcyBpdCBsaXZlLiBSZWdpc3RlcmluZyBpcyBsaWNlbnNlZCBhbmQgcGFpZCwKICAgYW5kIGhlIGNhbm5vdCBkbyBpdC4gQm90aCBmYWN0cyBhcmUgc3RhdGVkIHBsYWlubHkgb24gdGhlIHBhZ2UuICovCmZ1bmN0aW9uIGRvbVJvdyhyKXsKICBjb25zdCBjID0gci5zdGF0dXM9PT0nQVZBSUxBQkxFJyA/ICd0LWdybicgOiByLnN0YXR1cz09PSdUQUtFTicgPyAndC1kaW0nCiAgICAgICAgICA6IHIuc3RhdHVzPT09J0lOVkFMSUQnID8gJ3QtbWFnJyA6ICd0LWFtYic7CiAgY29uc3QgcCA9IHIucHJpY2UgJiYgci5wcmljZS5maXJzdAogICAgPyBgfuKCuSR7ci5wcmljZS5maXJzdH0gZmlyc3QgeXIgwrcg4oK5JHtyLnByaWNlLnJlbmV3fSByZW5ld2AgOiAn4oCUJzsKICBjb25zdCBkZXRhaWwgPSByLnN0YXR1cz09PSdUQUtFTicKICAgICAgPyBgJHtyLnJlZ2lzdHJhcj9lc2Moci5yZWdpc3RyYXIpOidyZWdpc3RyYXIgdW5rbm93bid9JHtyLmV4cGlyZXM/JyDCtyBleHBpcmVzICcrU3RyaW5nKHIuZXhwaXJlcykuc2xpY2UoMCwxMCk6Jyd9YAogICAgOiByLnN0YXR1cz09PSdBVkFJTEFCTEUnID8gJ2ZyZWUgcmlnaHQgbm93JwogICAgOiBlc2Moci53aHl8fCdjb3VsZCBub3QgYmUgcmVzb2x2ZWQnKTsKICByZXR1cm4gYDx0cj48dGQ+PGI+JHtlc2Moci5uYW1lKX08L2I+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtjfSI+JHtyLnN0YXR1c308L3NwYW4+PC90ZD4KICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtwfTwvdGQ+CiAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZGV0YWlsfTwvdGQ+CiAgIDx0ZD4ke3Iuc3RhdHVzPT09J0FWQUlMQUJMRSd8fHIuc3RhdHVzPT09J1RBS0VOJwogICAgID8gYDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0id2F0Y2hEb20oJyR7ZXNjKHIubmFtZSl9JykiPldhdGNoPC9idXR0b24+YDonJ308L3RkPjwvdHI+YDsKfQpsZXQgRE9NUkVTID0gW107CkxJVkUuZG9tYWlucz0oKT0+ewogIGNvbnN0IEQ9Uy5kb21haW5zfHx7d2F0Y2g6W10scnVuczpbXX0sIFc9RC53YXRjaHx8W10sIFI9RC5ydW5zfHxbXTsKICBjb25zdCBzb29uPVcuZmlsdGVyKHg9PnsgaWYoIXguZXhwaXJlcykgcmV0dXJuIGZhbHNlOwogICAgY29uc3QgZD0obmV3IERhdGUoeC5leHBpcmVzKS1EYXRlLm5vdygpKS84NjQwMDAwMDsgcmV0dXJuIGQ+MCYmZDw2MDsgfSk7CgogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7il40gRE9NQUlOIERFU0sg4oCUIEhFIENIRUNLUywgWU9VIEJVWTwvaDM+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPlJlYWQgdGhpcyBiZWZvcmUgeW91IHBsYW4gYSBkb21haW4gYnVzaW5lc3MuPC9iPgogICAgQ2hlY2tpbmcgd2hldGhlciBhIG5hbWUgaXMgZnJlZSBpcyA8Yj5mcmVlLCBpbnN0YW50IGFuZCBuZWVkcyBub2JvZHkncyBwZXJtaXNzaW9uPC9iPiDigJQgaGUgZG9lcyBpdCBsaXZlIGFnYWluc3QgdGhlIHJlYWwgcmVnaXN0cnkgdXNpbmcgUkRBUCwgdGhlIHByb3RvY29sIElDQU5OIGZvcmNlcyBldmVyeSByZWdpc3RyeSB0byBydW4uIFJlZ2lzdGVyaW5nIGEgbmFtZSBpcyBhIDxiPmxpY2Vuc2VkLCBwYWlkLCBLWUMnZCBhY3Q8L2I+LiBIZSBjYW5ub3QgZG8gaXQuIE5vdCAibm90IHlldCIg4oCUIHdyaXRpbmcgaW50byBhIHJlZ2lzdHJ5IG5lZWRzIGFuIEVQUCBjcmVkZW50aWFsIGlzc3VlZCB0byBhbiBhY2NyZWRpdGVkIHJlZ2lzdHJhciwgcGx1cyBtb25leS4gQW55b25lIGNsYWltaW5nIHRoZWlyIEFJIHJlZ2lzdGVycyBkb21haW5zIGlzIGVpdGhlciByZXNlbGxpbmcgb3IgbHlpbmcuPC9kaXY+CiAgICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPkNvbm5lY3QgYW4gQUkgYnJhaW4gdG8gaGF2ZSBoaW0gaW52ZW50IG5hbWVzLiBDaGVja2luZyB3b3JrcyB3aXRob3V0IG9uZS48L2Rpdj4nOicnfQoKICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5IYXZlIGhpbSBpbnZlbnQgbmFtZXMgZm9yIGEgYnVzaW5lc3MsIHRoZW4gY2hlY2sgZXZlcnkgb25lIGxpdmU8L3NwYW4+CiAgICA8aW5wdXQgaWQ9ImRtQnJpZWYiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gd2Vic2l0ZSBkb3dudGltZSBhbGVydHMgZm9yIEx1ZGhpYW5hIGhvc2llcnkgZXhwb3J0ZXJzIj48L2xhYmVsPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb21TdWdnZXN0KCkiPklOVkVOVCBBTkQgQ0hFQ0sgTkFNRVM8L2J1dHRvbj4KICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+MTQgbmFtZXMgw5cgMyBleHRlbnNpb25zID0gNDIgbGl2ZSByZWdpc3RyeSBsb29rdXBzLiBUYWtlcyBhYm91dCAzMCBzZWNvbmRzLjwvc3Bhbj48L2Rpdj4KCiAgIDxociBzdHlsZT0iYm9yZGVyOjA7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTttYXJnaW46MTZweCAwIj4KCiAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PciBjaGVjayBleGFjdCBuYW1lcyB5b3UgYWxyZWFkeSBoYXZlIGluIG1pbmQ8L3NwYW4+CiAgICAgPHRleHRhcmVhIGlkPSJkbU5hbWVzIiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjY0cHgiIHBsYWNlaG9sZGVyPSJzYW5kaHV3b3Jrcy5pbgpiYXNhbnR1cHRpbWUuY29tCmdpbHJvYWRsYWJzLmNvLmluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9yIHRha2Ugb25lIHdvcmQgYWNyb3NzIGV2ZXJ5IGV4dGVuc2lvbjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImRtU2xkIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJzYW5kaHV3b3JrcyI+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZG9tQ2hlY2soKSI+Q0hFQ0sgVEhFIExJU1Q8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkb21FeHBhbmQoKSI+U1BSRUFEIE9ORSBXT1JEPC9idXR0b24+PC9kaXY+PC9sYWJlbD4KICAgPC9kaXY+CgogICAke0RPTVJFUy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDoxNHB4Ij48dGFibGU+CiAgICAgPHRoZWFkPjx0cj48dGg+TmFtZTwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPkluZGljYXRpdmUgcHJpY2U8L3RoPjx0aD5EZXRhaWw8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD4KICAgICA8dGJvZHk+JHtET01SRVMubWFwKGRvbVJvdykuam9pbignJyl9PC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPlByaWNlcyBhcmUgaW5kaWNhdGl2ZSByZXRhaWwgKCR7ZXNjKChTLmRvbWFpbnN8fHt9KS5wcmljZUFzT2Z8fCcnKX0pLiBWZXJpZnkgYXQgdGhlIHJlZ2lzdHJhciBiZWZvcmUgeW91IHF1b3RlIGFueWJvZHkuPC9kaXY+YDonJ30KICA8L2Rpdj4KCiAgJHtSLmxlbmd0aD9SLm1hcChydW49PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4O2ZsZXgtd3JhcDp3cmFwIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+TkFNRVM8L3NwYW4+PGI+JHtlc2MocnVuLmJyaWVmKS5zbGljZSgwLDcwKX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3J1bi50fSDCtyAke3J1bi5jaGVja2VkfSBsaXZlIGNoZWNrcyDCtyAke3J1bi5hdmFpbGFibGV9IGF2YWlsYWJsZSR7cnVuLnVua25vd24/JyDCtyAnK3J1bi51bmtub3duKycgdW5yZXNvbHZlZCc6Jyd9PC9zcGFuPjwvZGl2PgogICAgJHtydW4udW5rbm93bj9gPGRpdiBjbGFzcz0id2FybmJveCI+JHtydW4udW5rbm93bn0gbG9va3VwKHMpIGNvdWxkIG5vdCBiZSByZXNvbHZlZC4gVGhvc2UgYXJlIHNob3duIGFzIFVOS05PV04gYW5kIGFyZSA8Yj5ub3Q8L2I+IGNvdW50ZWQgYXMgYXZhaWxhYmxlIOKAlCBhIHJlZ2lzdHJ5IHRoYXQgZGlkIG5vdCBhbnN3ZXIgaXMgbm90IHRoZSBzYW1lIGFzIGEgZnJlZSBuYW1lLjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPk5hbWU8L3RoPjx0aD5XaHk8L3RoPjx0aD5FeHRlbnNpb25zPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgICR7KHJ1bi5yb3dzfHxbXSkubWFwKHI9PmA8dHI+CiAgICAgIDx0ZD48Yj4ke2VzYyhyLnNsZCl9PC9iPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhyLnJlZ2lzdGVyfHwnJyl9PC9kaXY+PC90ZD4KICAgICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci53aHl8fCcnKX08L3RkPgogICAgICA8dGQ+JHsoci5vcHRpb25zfHxbXSkubWFwKG89PnsKICAgICAgICBjb25zdCBjPW8uc3RhdHVzPT09J0FWQUlMQUJMRSc/J3QtZ3JuJzpvLnN0YXR1cz09PSdUQUtFTic/J3QtZGltJzondC1hbWInOwogICAgICAgIHJldHVybiBgPHNwYW4gY2xhc3M9InRhZyAke2N9IiB0aXRsZT0iJHtlc2Moby53aHl8fG8uc3RhdHVzKX0iPiR7ZXNjKG8ubmFtZSl9PC9zcGFuPmAKICAgICAgICAgICsgKG8uc3RhdHVzPT09J0FWQUlMQUJMRSc/YCA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9IndhdGNoRG9tKCcke2VzYyhvLm5hbWUpfScpIj53YXRjaDwvYnV0dG9uPiBgOicgJyk7CiAgICAgIH0pLmpvaW4oJycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6Jyd9CgogICR7Vy5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgIDxoMyBzdHlsZT0ibWFyZ2luOjAiPuKXjiBXQVRDSExJU1QgKCR7Vy5sZW5ndGh9KTwvaDM+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJkb21SZWNoZWNrKCkiPlJFLUNIRUNLIEFMTCBOT1c8L2J1dHRvbj48L2Rpdj4KICAgICR7c29vbi5sZW5ndGg/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPjxiPiR7c29vbi5sZW5ndGh9IGV4cGlyaW5nIHdpdGhpbiA2MCBkYXlzLjwvYj4gQSBkb21haW4gYWJvdXQgdG8gZXhwaXJlIG1lYW5zIGFuIG93bmVyIGFib3V0IHRvIG1ha2UgYSBkZWNpc2lvbi4gVGhhdCBpcyB0aGUgbW9tZW50IHRvIGFwcHJvYWNoIHRoZW0g4oCUIGVpdGhlciB0byBidXkgdGhlIG5hbWUsIG9yIHRvIHNlbGwgdGhlbSB0aGUgc2VydmljZSB0aGF0IGtlZXBzIGl0IHdvcmtpbmcuPC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+TmFtZTwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPkV4cGlyZXM8L3RoPjx0aD5SZWdpc3RyYXI8L3RoPjx0aD5Ob3RlPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgICR7Vy5tYXAoeD0+YDx0cj4KICAgICAgPHRkPjxiPiR7ZXNjKHgubmFtZSl9PC9iPjwvdGQ+CiAgICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7eC5zdGF0dXM9PT0nQVZBSUxBQkxFJz8ndC1ncm4nOnguc3RhdHVzPT09J1RBS0VOJz8ndC1kaW0nOid0LWFtYid9Ij4ke3guc3RhdHVzfTwvc3Bhbj48L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3guZXhwaXJlcz9TdHJpbmcoeC5leHBpcmVzKS5zbGljZSgwLDEwKTon4oCUJ308L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh4LnJlZ2lzdHJhcnx8J+KAlCcpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHgubm90ZXx8JycpfTwvdGQ+CiAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InVud2F0Y2hEb20oJyR7ZXNjKHgubmFtZSl9JykiPuKclTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkhlIHJlLWNoZWNrcyB0aGUgd2hvbGUgd2F0Y2hsaXN0IGF1dG9tYXRpY2FsbHkgYXMgYSBzdGFuZGluZyBvcmRlci4gSWYgYSBuYW1lIHlvdSB3YW50IGlzIHJlbGVhc2VkLCBpdCBhcHBlYXJzIGluIHRoZSBsZWRnZXIgdGhlIHNhbWUgZGF5LjwvZGl2PgogICA8L2Rpdj5gOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+V2F0Y2hsaXN0IGVtcHR5LiBXYXRjaCBhIG5hbWUgYW5kIGhlIHRyYWNrcyBpdCBmb3IgeW91LjwvZGl2PjwvZGl2Pid9CgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICA8aDM+U2hvdWxkIHlvdSBiZWNvbWUgYSByZXNlbGxlcj8gRG8gdGhlIGFyaXRobWV0aWMgZmlyc3QuPC9oMz4KICAgPGRpdiBjbGFzcz0icm93Ij48bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjE4MHB4Ij48c3Bhbj5Eb21haW5zIHlvdSByZWFsaXN0aWNhbGx5IHNlbGwgcGVyIG1vbnRoPC9zcGFuPgogICAgPGlucHV0IGlkPSJkbU4iIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iNSIgbWluPSIwIiBtYXg9IjUwMCI+PC9sYWJlbD4KICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZG9tTWF0aCgpIiBzdHlsZT0iYWxpZ24tc2VsZjplbmQ7bWFyZ2luLWJvdHRvbToxMXB4Ij5XT1JLIElUIE9VVDwvYnV0dG9uPjwvZGl2PgogICA8ZGl2IGlkPSJkbU1hdGhPdXQiPjwvZGl2PgogIDwvZGl2PgoKICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgPGgzPkhvdyBhIGRvbWFpbiBhY3R1YWxseSBjb21lcyBpbnRvIGV4aXN0ZW5jZTwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPldyaXR0ZW4gaW50byB0aGUgc3lzdGVtIGFzIGZhY3QsIG5vdCBnZW5lcmF0ZWQuIEZpZ3VyZXMgY2hlY2tlZCBBdWd1c3QgMjAyNi48L2Rpdj4KICAgPHByZSBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7Zm9udDoxMnB4LzEuNjUgdmFyKC0tbW9ubyk7YmFja2dyb3VuZDp2YXIoLS1pbnApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tYnJkKTtib3JkZXItcmFkaXVzOjlweDtwYWRkaW5nOjE0cHg7b3ZlcmZsb3cteDphdXRvIj4ke2VzYygoUy5kb21haW5zfHx7fSkuaG93SXRXb3Jrc3x8JycpfTwvcHJlPgogIDwvZGl2PmA7Cn07ClJFTkRFUi5kb21haW5zPSgpPT5gPGRpdiBkYXRhLWxpdmU9ImRvbWFpbnMiPiR7TElWRS5kb21haW5zKCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIGRvbUNoZWNrKCl7CiAgY29uc3Qgdj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RtTmFtZXMnKXx8e30pLnZhbHVlfHwnJzsKICBpZighdi50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSBhdCBsZWFzdCBvbmUgbmFtZScpOwogIGZsYXNoKCdDaGVja2luZyBhZ2FpbnN0IHRoZSBsaXZlIHJlZ2lzdHJpZXPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvbS9jaGVjaycse25hbWVzOnZ9KTsKICAgIERPTVJFUz1yLnJlc3VsdHM7IHJlbmRlcigpOwogICAgZmxhc2goYCR7ci5yZXN1bHRzLmZpbHRlcih4PT54LnN0YXR1cz09PSdBVkFJTEFCTEUnKS5sZW5ndGh9IG9mICR7ci5yZXN1bHRzLmxlbmd0aH0gYXZhaWxhYmxlYCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkb21FeHBhbmQoKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZG1TbGQnKXx8e30pLnZhbHVlfHwnJzsKICBpZighdi50cmltKCkpIHJldHVybiBmbGFzaCgnVHlwZSBvbmUgd29yZCcpOwogIGZsYXNoKCdTcHJlYWRpbmcgaXQgYWNyb3NzIGV4dGVuc2lvbnPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2RvbS9leHBhbmQnLHtzbGQ6dn0pOwogICAgRE9NUkVTPXIucmVzdWx0czsgcmVuZGVyKCk7CiAgICBmbGFzaChgJHtyLnJlc3VsdHMuZmlsdGVyKHg9Pnguc3RhdHVzPT09J0FWQUlMQUJMRScpLmxlbmd0aH0gb2YgJHtyLnJlc3VsdHMubGVuZ3RofSBhdmFpbGFibGVgKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGRvbVN1Z2dlc3QoKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZG1CcmllZicpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF2LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdEZXNjcmliZSB0aGUgYnVzaW5lc3MgZmlyc3QnKTsKICBmbGFzaCgnSW52ZW50aW5nIG5hbWVzLCB0aGVuIGNoZWNraW5nIGV2ZXJ5IG9uZSBsaXZlLiBBYm91dCAzMCBzZWNvbmRz4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb20vc3VnZ2VzdCcse2JyaWVmOnZ9KTsKICAgIERPTVJFUz1bXTsgcmVuZGVyKCk7CiAgICBmbGFzaChgJHtyLmF2YWlsYWJsZX0gb2YgJHtyLmNoZWNrZWR9IGF2YWlsYWJsZWArKHIudW5rbm93bj9gIMK3ICR7ci51bmtub3dufSB1bnJlc29sdmVkYDonJykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gd2F0Y2hEb20obmFtZSl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZG9tL3dhdGNoJyx7bmFtZX0pOyByZW5kZXIoKTsgZmxhc2goJ1dhdGNoaW5nICcrbmFtZSkgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiB1bndhdGNoRG9tKG5hbWUpeyBhd2FpdCBBUEkoJy9hcGkvZG9tL3Vud2F0Y2gnLHtuYW1lfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gZG9tUmVjaGVjaygpewogIGZsYXNoKCdSZS1jaGVja2luZyB0aGUgd2hvbGUgd2F0Y2hsaXN04oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb20vcmVjaGVjaycse30pOyByZW5kZXIoKTsgZmxhc2goci5tc2crJyDigJQgJysoci5kZXRhaWx8fCcnKSkgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkb21NYXRoKCl7CiAgY29uc3Qgbj0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RtTicpfHx7fSkudmFsdWV8fDA7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9kb20vbWF0aCcse3Blck1vbnRoOm59KTsKICAgIGNvbnN0IG09ci5tYXRoOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RtTWF0aE91dCcpLmlubmVySFRNTD0KICAgICBgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MjAwcHgiPk1hcmdpbiBwZXIgLmluIGRvbWFpbjwvdGQ+PHRkPuKCuSR7bS5tYXJnaW5FYWNofSAo4oK5OTUwIHJldGFpbCDiiJIg4oK5NjIwIHdob2xlc2FsZSk8L3RkPjwvdHI+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Qcm9maXQgYXQgJHttLnBlck1vbnRofS9tb250aDwvdGQ+PHRkPjxiPuKCuSR7bS55ZWFyUHJvZml0LnRvTG9jYWxlU3RyaW5nKCdlbi1JTicpfSBwZXIgeWVhcjwvYj48L3RkPjwvdHI+CiAgICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5SZXNlbGxlciBzZXR1cCBjb3N0PC90ZD48dGQ+4oK5JHttLnNldHVwLnRvTG9jYWxlU3RyaW5nKCdlbi1JTicpfSBvbmUtdGltZTwvdGQ+PC90cj4KICAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkJyZWFrLWV2ZW48L3RkPjx0ZD4ke20uYnJlYWtFdmVuRG9tYWluc30gZG9tYWlucyBzb2xkPC90ZD48L3RyPgogICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij4ke2VzYyhtLnZlcmRpY3QpfTwvZGl2PmA7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQoKLyogPT09PT09PT09PT09PT09PT0gR1JPV1RIIEVOR0lORSA9PT09PT09PT09PT09PT09PSAqLwpMSVZFLmdyb3d0aD0oKT0+ewogIGNvbnN0IEM9Uy5jYW1wYWlnbnN8fFtdLCBCPVMuYnVzaW5lc3Nlc3x8W10sIE89Uy5vdXRyZWFjaHx8W10sIENIPVMuY2hhbm5lbHN8fHt9OwogIGNvbnN0IHNtdHA9KFMudGVsZW1ldHJ5fHx7fSkuc210cF9yZWFkeTsKICBjb25zdCBjaFJvd3M9T2JqZWN0LnZhbHVlcyhDSCkubWFwKGM9PmA8dHI+CiAgICA8dGQ+PGI+JHtlc2MoYy5sYWJlbCl9PC9iPjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2MuYXV0bz8oYy5pZD09PSdlbWFpbCcmJiFzbXRwPyd0LWFtYic6J3QtZ3JuJyk6J3QtZGltJ30iPiR7CiAgICAgIGMuYXV0bz8oYy5pZD09PSdlbWFpbCcmJiFzbXRwPydCTE9DS0VEJzonSEUgU0VORFMgSVQnKTonWU9VIFNFTkQgSVQnfTwvc3Bhbj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYy50cnV0aCl9PC90ZD48L3RyPmApLmpvaW4oJycpOwoKICBjb25zdCBoZWFkPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1vbGl2ZSkiPuKepCBHUk9XVEggRU5HSU5FIOKAlCBIRSBQTEFOUyBJVCwgWU9VIFRJQ0sgT05DRTwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgcGxhbnMgYSB0d28td2VlayBjYW1wYWlnbiB0byBnZXQgdGhlIDxiPmZpcnN0IHBheWluZyBjdXN0b21lcjwvYj4sIHdyaXRlcyBldmVyeSBtZXNzYWdlIGluIGZpbmlzaGVkIGZvcm0sIHRoZW4gZXhlY3V0ZXMgZXZlcnl0aGluZyBoZSBsZWdhbGx5IGNhbiBhbmQgcHV0cyB0aGUgcmVzdCBvbiB5b3VyIGRlc2sgd2l0aCB0aGUgd29yZHMgYWxyZWFkeSB3cml0dGVuLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5XaGF0IGhlIGNhbiBhbmQgY2Fubm90IHNlbmQg4oCUIHJlYWQgdGhpcyBvbmNlLjwvYj4gRW1haWwgaXMgZ2VudWluZWx5IGF1dG9tYXRpYyB0aHJvdWdoIHlvdXIgb3duIEdtYWlsLiBFdmVyeXRoaW5nIGVsc2UgaXMgYSBsaWUgd2hlbiBhbnlvbmUgY2xhaW1zIHRvIGF1dG9tYXRlIGl0IGZvciBmcmVlOiB0aGUgY29uc3VtZXIgV2hhdHNBcHAgYXBwIGhhcyA8Yj5ubyBBUEk8L2I+IGFuZCB1bm9mZmljaWFsIGF1dG9tYXRpb24gZ2V0cyB5b3VyIG51bWJlciA8Yj5iYW5uZWQ8L2I+OyBJbnN0YWdyYW0gYW5kIEZhY2Vib29rIG5lZWQgYSBNZXRhIGFwcCBhbmQgT0F1dGg7IFggY2hhcmdlcyBmb3Igd3JpdGUgYWNjZXNzOyBhIEdvb2dsZSBCdXNpbmVzcyBQcm9maWxlIG5lZWRzIHBvc3RjYXJkIG9yIHBob25lIHZlcmlmaWNhdGlvbiBhdCB5b3VyIHJlYWwgYWRkcmVzcy4gSGUgd3JpdGVzIGl0IGFsbC4gWW91IHRhcCBzZW5kLjwvZGl2PgogICAkeyFzbXRwPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPjxiPlNNVFAgaXMgbm90IGFybWVkPC9iPiwgc28gaGUgY2FuIHNlbmQgTk9USElORyBoaW1zZWxmIFx1MjAxNCBldmVyeSBhY3Rpb24gYmVjb21lcyBhIG1hbnVhbCBqb2IuIFNldCBhIEdtYWlsIGFwcCBwYXNzd29yZCBpbiBNYWlsIFJlbGF5IGFuZCBoZSBzdGFydHMgYWN0dWFsbHkgc2VuZGluZy48L2Rpdj4nOicnfQogICAke3NtdHAmJiFTLnNtdHBWZXJpZmllZD9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48Yj5NYWlsIGlzIGNvbmZpZ3VyZWQgYnV0IG5ldmVyIHByb3Zlbi48L2I+IEhlIHdpbGwgcmVmdXNlIHRvIHJ1biBhbiBlbWFpbCBjYW1wYWlnbiB1bnRpbCB0aGUgcHJlZmxpZ2h0IHBhc3NlcyBcdTIwMTQgYmVjYXVzZSBhIGNhbXBhaWduIHRoYXQgc2lsZW50bHkgZmFpbHMgb24gZXZlcnkgc2VuZCBpcyB3b3JzZSB0aGFuIG9uZSB0aGF0IG5ldmVyIHJhbi4gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJnbygnbWFpbCcpIj5SdW4gdGhlIHByZWZsaWdodDwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICR7Uy5zbXRwVmVyaWZpZWQ/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPjxiPk1haWwgcHJvdmVuIGFnYWluc3QgdGhlIHJlYWwgc2VydmVyPC9iPiAke2VzYyhTLnNtdHBWZXJpZmllZC5hdCl9IFx1MjAxNCBzZW5kaW5nIGFzICR7ZXNjKFMuc210cFZlcmlmaWVkLmZyb20pfS4ke1Muc2VuZFdpbmRvdz9gICR7Uy5zZW5kV2luZG93LmxlZnR9IG9mICR7Uy5zZW5kV2luZG93LmNhcH0gc2VuZHMgbGVmdCBpbiB0aGlzIDI0LWhvdXIgd2luZG93LmA6Jyd9PC9kaXY+YDonJ30KICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW46MTJweCAwIj48dGFibGU+PHRoZWFkPjx0cj48dGg+Q2hhbm5lbDwvdGg+PHRoPldobyBzZW5kczwvdGg+PHRoPlRoZSB0cnV0aDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4ke2NoUm93c308L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICR7IUIubGVuZ3RoPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPkJ1aWxkIGEgYnVzaW5lc3MgZmlyc3Qg4oCUIHRoZXJlIGlzIG5vdGhpbmcgdG8gbWFya2V0LjwvZGl2Pic6YAogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q2FtcGFpZ24gZm9yIHdoaWNoIGJ1c2luZXNzPC9zcGFuPgogICAgIDxzZWxlY3QgaWQ9Imd3Qml6IiBjbGFzcz0iaW4iPiR7Qi5tYXAoeD0+YDxvcHRpb24gdmFsdWU9IiR7eC5pZH0iPiR7ZXNjKHgubmFtZSl9JHt4LnB1Ymxpc2hlZD8nJzonIChOT1QgUFVCTElTSEVEKSd9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+R29hbCAobGVhdmUgYmxhbmsgZm9yOiBmaXJzdCBwYXlpbmcgY3VzdG9tZXIpPC9zcGFuPgogICAgIDxpbnB1dCBpZD0iZ3dHb2FsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJmaXJzdCBwYXlpbmcgY3VzdG9tZXIiPjwvbGFiZWw+PC9kaXY+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJwbGFuQ2FtcCgpIj5QTEFOIFRIRSBDQU1QQUlHTjwvYnV0dG9uPmB9CiAgPC9kaXY+YDsKCiAgY29uc3Qgb3V0Yj1PLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8aDM+4peIIEFDVFVBTExZIFNFTlQgKCR7Ty5sZW5ndGh9KTwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5UbzwvdGg+PHRoPlN1YmplY3Q8L3RoPjx0aD5SZXBseT88L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke08uc2xpY2UoMCwyMCkubWFwKHg9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHt4LnR9PC90ZD48dGQ+JHtlc2MoeC50byl9PC90ZD4KICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh4LnN1YmplY3R8fCcnKX08L3RkPgogICAgIDx0ZD4ke3gucmVwbGllZD8nPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+UkVQTElFRDwvc3Bhbj4nOmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9Im1hcmtSZXBsaWVkKCcke2VzYyh4LnRvKX0nLCcke3gudH0nKSI+bWFyayByZXBsaWVkPC9idXR0b24+YH08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJzsKCiAgaWYoIUMubGVuZ3RoKSByZXR1cm4gaGVhZCtvdXRiKyc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gY2FtcGFpZ24geWV0LjwvZGl2PjwvZGl2Pic7CgogIHJldHVybiBoZWFkICsgQy5tYXAoYz0+ewogICAgY29uc3QgYnlEYXk9e307IChjLmFjdGlvbnN8fFtdKS5mb3JFYWNoKGE9PnsgKGJ5RGF5W2EuZGF5XT1ieURheVthLmRheV18fFtdKS5wdXNoKGEpIH0pOwogICAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206N3B4O2ZsZXgtd3JhcDp3cmFwIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHtjLnN0YXR1cz09PSdBQ1RJVkUnPyd0LWdybic6Yy5zdGF0dXM9PT0nUlVOTklORyc/J3QtYW1iJzondC1jeSd9Ij4ke2Muc3RhdHVzfTwvc3Bhbj4KICAgICAgPGIgc3R5bGU9ImZvbnQtc2l6ZToxNXB4Ij4ke2VzYyhjLm5hbWUpfTwvYj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMuYml6TmFtZXx8JycpfTwvc3Bhbj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Yy50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij4ke2VzYyhjLnRoZXNpcyl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5GaXJzdCBjdXN0b21lciBieTwvdGQ+PHRkPiR7ZXNjKGMuZmlyc3RDdXN0b21lckJ5fHwn4oCUJyl9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TdG9wIGl0IGlmPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKGMua2lsbENyaXRlcmlhfHwn4oCUJyl9PC90ZD48L3RyPgogICAgICR7Yy5zdGF0dXMhPT0nRFJBRlQnP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UmVzdWx0PC90ZD48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiR7Yy5zZW50fSBhY3R1YWxseSBzZW50PC9iPiDCtyAke2MucGFya2VkfSBvbiB5b3VyIGRlc2ske2MuZmFpbGVkP2AgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7Yy5mYWlsZWR9IGZhaWxlZDwvc3Bhbj5gOicnfTwvdGQ+PC90cj5gOicnfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgoKICAgICR7Yy5zdGF0dXM9PT0nRFJBRlQnP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLWxpbWUpIj4KICAgICAgPGI+T25lIHRpY2sgcnVucyB0aGUgd2hvbGUgdGhpbmcuPC9iPiBIZSB3aWxsIHNlbmQgJHtjLmF1dG9Db3VudH0gbWVzc2FnZShzKSBoaW1zZWxmIGFzIHJlYWwgZW1haWwsIGFuZCBwdXQgdGhlIG90aGVyICR7KGMuYWN0aW9uc3x8W10pLmxlbmd0aC1jLmF1dG9Db3VudH0gb24geW91ciBkZXNrIHdpdGggdGhlIGV4YWN0IHdvcmRzIHJlYWR5IHRvIGNvcHkuIE5vdGhpbmcgZ29lcyBvdXQgdW50aWwgeW91IHByZXNzIHRoaXMuPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InJ1bkNhbXAoJyR7Yy5pZH0nKSI+4pyUIEFQUFJPVkUg4oCUIFJVTiBJVDwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlbENhbXAoJyR7Yy5pZH0nKSI+4pyVIERpc2NhcmQ8L2J1dHRvbj48L2Rpdj5gCiAgICAgOmA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbENhbXAoJyR7Yy5pZH0nKSI+RGVsZXRlIGNhbXBhaWduPC9idXR0b24+YH0KCiAgICA8ZGV0YWlscyBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4IiAke2Muc3RhdHVzPT09J0RSQUZUJz8nb3Blbic6Jyd9PjxzdW1tYXJ5IHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+PGI+RXZlcnkgYWN0aW9uLCBpbiBvcmRlciAoJHsoYy5hY3Rpb25zfHxbXSkubGVuZ3RofSk8L2I+PC9zdW1tYXJ5PgogICAgICR7T2JqZWN0LmtleXMoYnlEYXkpLnNvcnQoKGEsYik9PmEtYikubWFwKGQ9PmAKICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46MTNweCAwIDZweCI+REFZICR7ZH08L2Rpdj4KICAgICAgJHtieURheVtkXS5tYXAoYT0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCAke2Euc3RhdHVzPT09J1NFTlQnPyd2YXIoLS1ncm4pJzphLmF1dG8/J3ZhcigtLWxpbWUpJzondmFyKC0tc3Ryb2tlMiknfTtwYWRkaW5nLWxlZnQ6MTJweDttYXJnaW4tYm90dG9tOjEzcHgiPgogICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47ZmxleC13cmFwOndyYXAiPgogICAgICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke2EuYXV0bz8ndC1ncm4nOid0LWRpbSd9Ij4keyhDSFthLmNoYW5uZWxdfHx7fSkubGFiZWx8fGEuY2hhbm5lbH08L3NwYW4+CiAgICAgICAgIDxiPiR7ZXNjKGEudGl0bGUpfTwvYj4KICAgICAgICAgJHthLnN0YXR1cz09PSdTRU5UJz8nPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+U0VOVCAnK2VzYyhhLnNlbnRBdHx8JycpKyc8L3NwYW4+JzonJ30KICAgICAgICAgJHthLnN0YXR1cz09PSdORUVEU19BRERSRVNTJz8nPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+TkVFRFMgQU4gQUREUkVTUzwvc3Bhbj4nOicnfQogICAgICAgICAke2Euc3RhdHVzPT09J0ZBSUxFRCc/JzxzcGFuIGNsYXNzPSJ0YWcgdC1tYWciPkZBSUxFRDwvc3Bhbj4nOicnfQogICAgICAgICAke2Euc3RhdHVzPT09J09OX1lPVVJfREVTSyc/JzxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPk9OIFlPVVIgREVTSzwvc3Bhbj4nOicnfTwvZGl2PgogICAgICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+fiR7YS5taW51dGVzfSBtaW48L3NwYW4+PC9kaXY+CiAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjo0cHggMCA2cHgiPiR7ZXNjKGEud2h5KX08L2Rpdj4KICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPlRvOiAke2VzYyhhLnRhcmdldHx8J+KAlCcpfTwvZGl2PgogICAgICAgJHthLnJlc3VsdD9gPGRpdiBjbGFzcz0id2FybmJveCI+JHtlc2MoYS5yZXN1bHQpfTwvZGl2PmA6Jyd9CiAgICAgICAke2Euc3RhdHVzPT09J05FRURTX0FERFJFU1MnP2A8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+CiAgICAgICAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJhZHJfJHthLmlkfSIgcGxhY2Vob2xkZXI9InRoZWlyQGVtYWlsLmNvbSIgc3R5bGU9Im1heC13aWR0aDoyNDBweCI+CiAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZmlsbEFkZHIoJyR7Yy5pZH0nLCcke2EuaWR9JykiPlNFTkQgSVQgTk9XPC9idXR0b24+PC9kaXY+YDonJ30KICAgICAgICR7YS5jb250ZW50P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweCI+CiAgICAgICAgICR7YS5zdWJqZWN0P2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NXB4Ij5TVUJKRUNUOiAke2VzYyhhLnN1YmplY3QpfTwvZGl2PmA6Jyd9CiAgICAgICAgIDxkaXYgaWQ9ImNudF8ke2EuaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhhLmNvbnRlbnQpfTwvZGl2PgogICAgICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0iY29weUJpeignY250XyR7YS5pZH0nKSI+Q29weTwvYnV0dG9uPgogICAgICAgICAgJHthLmNoYW5uZWw9PT0nd2hhdHNhcHAnP2A8YSBjbGFzcz0iYnRuIHNtIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgaHJlZj0iaHR0cHM6Ly93YS5tZS8/dGV4dD0ke2VuY29kZVVSSUNvbXBvbmVudChhLmNvbnRlbnQpfSI+T3BlbiBpbiBXaGF0c0FwcCDihpc8L2E+YDonJ30KICAgICAgICAgPC9kaXY+PC9kaXY+YDonJ30KICAgICAgPC9kaXY+YCkuam9pbignJyl9YCkuam9pbignJyl9CiAgICA8L2RldGFpbHM+CgogICAgJHsoYy50YXJnZXRzfHxbXSkubGVuZ3RoP2A8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPldobyB0byBhcHByb2FjaCAoJHtjLnRhcmdldHMubGVuZ3RofSk8L2I+PC9zdW1tYXJ5PgogICAgIDxvbCBzdHlsZT0icGFkZGluZy1sZWZ0OjE5cHg7bGluZS1oZWlnaHQ6MS44O2ZvbnQtc2l6ZToxM3B4O21hcmdpbi10b3A6OHB4Ij4ke2MudGFyZ2V0cy5tYXAodD0+YDxsaT4ke2VzYyh0KX08L2xpPmApLmpvaW4oJycpfTwvb2w+PC9kZXRhaWxzPmA6Jyd9CiAgICAkeyhjLmltYWdlQnJpZWZzfHxbXSkubGVuZ3RoP2A8ZGV0YWlscz48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiPjxiPkltYWdlIGJyaWVmcyAoJHtjLmltYWdlQnJpZWZzLmxlbmd0aH0pPC9iPjwvc3VtbWFyeT4KICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkhlIGhhcyA8Yj5ubyBpbWFnZSBvciB2aWRlbyBtb2RlbDwvYj4uIFRoZXNlIGFyZSBicmllZnMgdG8gcGFzdGUgaW50byBhIGZyZWUgdG9vbCDigJQgQ2FudmEsIEJpbmcgSW1hZ2UgQ3JlYXRvciwgb3IgR29vZ2xlIFdoaXNrLiBIZSB3aWxsIG5vdCBwcmV0ZW5kIHRvIGhhdmUgZHJhd24gdGhlbS48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4ke2MuaW1hZ2VCcmllZnMubWFwKGk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij4ke2VzYyhpLmZvcnx8JycpfTwvdGQ+CiAgICAgIDx0ZD4ke2VzYyhpLmJyaWVmfHwnJyl9JHtpLnRleHQ/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPlRleHQgb24gaW1hZ2U6ICIke2VzYyhpLnRleHQpfSI8L2Rpdj5gOicnfTwvdGQ+PC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kZXRhaWxzPmA6Jyd9CiAgICAke2Mud2Vla1R3bz9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxiPldlZWsgdHdvOjwvYj4gJHtlc2MoYy53ZWVrVHdvKX08L2Rpdj5gOicnfQogICA8L2Rpdj5gOwogIH0pLmpvaW4oJycpICsgb3V0YjsKfTsKUkVOREVSLmdyb3d0aD0oKT0+YDxkaXYgZGF0YS1saXZlPSJncm93dGgiPiR7TElWRS5ncm93dGgoKX08L2Rpdj5gOwoKYXN5bmMgZnVuY3Rpb24gcGxhbkNhbXAoKXsKICBjb25zdCBiaXo9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnd0JpeicpfHx7fSkudmFsdWV8fCcnOwogIGNvbnN0IGdvYWw9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnd0dvYWwnKXx8e30pLnZhbHVlfHwnJzsKICBpZighYml6KSByZXR1cm4gZmxhc2goJ1BpY2sgYSBidXNpbmVzcycpOwogIGZsYXNoKCdQbGFubmluZyB0aGUgY2FtcGFpZ24gYW5kIHdyaXRpbmcgZXZlcnkgbWVzc2FnZeKApiBhYm91dCBhIG1pbnV0ZS4nKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2dyb3d0aC9wbGFuJyx7Yml6SWQ6Yml6LGdvYWx9KTsKICAgIHJlbmRlcigpOyBmbGFzaChgJHtyLmFjdGlvbnN9IGFjdGlvbnMgcGxhbm5lZCDigJQgaGUgY2FuIHNlbmQgJHtyLmF1dG99IGhpbXNlbGYuYCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBydW5DYW1wKGlkKXsKICBpZighY29uZmlybSgnQXBwcm92ZSB0aGlzIGNhbXBhaWduPyBIZSB3aWxsIHNlbmQgcmVhbCBlbWFpbCB0byByZWFsIHBlb3BsZS4gVGhpcyBjYW5ub3QgYmUgdW5zZW50LicpKSByZXR1cm47CiAgZmxhc2goJ1J1bm5pbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2dyb3d0aC9ydW4nLHtpZH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKGAke3Iuc2VudH0gYWN0dWFsbHkgc2VudCDCtyAke3IucGFya2VkfSBvbiB5b3VyIGRlc2ske3IuZmFpbGVkPycgwrcgJytyLmZhaWxlZCsnIGZhaWxlZCc6Jyd9YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBkZWxDYW1wKGlkKXsgaWYoIWNvbmZpcm0oJ0RlbGV0ZSB0aGlzIGNhbXBhaWduIGFuZCBpdHMgam9icz8nKSlyZXR1cm47CiAgYXdhaXQgQVBJKCcvYXBpL2dyb3d0aC9kZWxldGUnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIGZpbGxBZGRyKGNhbXBJZCxhY3Rpb25JZCl7CiAgY29uc3QgZW1haWw9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhZHJfJythY3Rpb25JZCl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYoIWVtYWlsLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdUeXBlIHRoZSBhZGRyZXNzJyk7CiAgZmxhc2goJ1NlbmRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2dyb3d0aC9hZGRyZXNzJyx7Y2FtcElkLGFjdGlvbklkLGVtYWlsfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1NlbnQgdG8gJytyLnRvKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIG1hcmtSZXBsaWVkKHRvLHQpeyBhd2FpdCBBUEkoJy9hcGkvZ3Jvd3RoL3JlcGxpZWQnLHt0byx0fSk7IHJlbmRlcigpIH0KCi8qID09PT09PT09PT09PT09PT09IFNUT1JBR0UgSEVBTFRIID09PT09PT09PT09PT09PT09ICovCkxJVkUuc3RvcmFnZT0oKT0+ewogIGNvbnN0IGg9Uy5zdG9yYWdlfHx7fTsKICBjb25zdCBjb2w9aC5sZXZlbD09PSdDUklUJz8ndmFyKC0tbWFnKSc6aC5sZXZlbD09PSdXQVJOJz8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke2NvbH0iPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7Y29sfSI+JHtoLmxldmVsPT09J09LJz8n4pyUJzon4pqgJ30gU1RPUkFHRSDigJQgJHtlc2MoaC5kZXNjcmliZXx8J3Vua25vd24nKX08L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7ZXNjKGgubXNnfHwnJyl9PC9kaXY+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+TW9kZTwvdGQ+PHRkPiR7ZXNjKGgubW9kZXx8Jz8nKX08L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U3RhdGUgc2l6ZTwvdGQ+PHRkPiR7KChoLmJ5dGVzfHwwKS8xMDI0KS50b0ZpeGVkKDApfSBLQiByYXcgwrcgJHsoKGguZW5jb2RlZHx8MCkvMTAyNCkudG9GaXhlZCgwKX0gS0IgZW5jb2RlZCR7aC5tb2RlPT09J2dpdGh1Yic/JyAoR2l0SHViIHJld3JpdGVzIGFsbCBvZiBpdCBldmVyeSBzYXZlKSc6Jyd9PC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxhc3Qgc2F2ZTwvdGQ+PHRkPiR7aC5sYXN0U2F2ZU9rPT09bnVsbD8nbm90IHlldCc6aC5sYXN0U2F2ZU9rP2A8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+T0sgYXQgJHtlc2MoaC5sYXN0U2F2ZUF0fHwnJyl9PC9zcGFuPmA6YDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5GQUlMRUQg4oCUICR7ZXNjKGgubGFzdFNhdmVFcnJ8fCcnKX08L3NwYW4+YH08L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QnVzaW5lc3MgcGFja3M8L3RkPjx0ZD4ke2guYmxvYnNDYWNoZWR8fDB9IGNhY2hlZCBvdXQtb2YtYmFuZCAoY29tcHJlc3NlZCwgbm90IGluIGRhdGEuanNvbik8L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic3RvcmVUZXN0KCkiPlJVTiBUSEUgU0VMRi1URVNUPC9idXR0b24+CiAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPldyaXRlcyBhIGZpbGUsIHJlYWRzIGl0IGJhY2ssIGNvbXBhcmVzIGJ5dGUtZm9yLWJ5dGUsIGRlbGV0ZXMgaXQuIFByb29mLCBub3QgYSBndWVzcy48L3NwYW4+PC9kaXY+CiAgIDxkaXYgaWQ9InN0T3V0IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48L2Rpdj4KICA8L2Rpdj4KICAke2guZXBoZW1lcmFsP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZykiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkZJWCBJVCDigJQgNiBNSU5VVEVTLCBGUkVFLCBQRVJNQU5FTlQ8L2gzPgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5SZW5kZXIncyBmcmVlIHRpZXIgZ2l2ZXMgeW91IDxiPm5vIGRpc2s8L2I+LiBFdmVyeSByZXN0YXJ0IGFuZCBldmVyeSByZWRlcGxveSBkZXN0cm95cyBldmVyeXRoaW5nIOKAlCBhbmQgZnJlZSBzZXJ2aWNlcyByZXN0YXJ0IG9uIHRoZWlyIG93bi4gQSBwcml2YXRlIEdpdEh1YiByZXBvIGJlY29tZXMgdGhlIGRpc2sgaW5zdGVhZC4gSXQgaXMgZnJlZSwgdW5saW1pdGVkIGZvciB0aGlzLCBhbmQgc3Vydml2ZXMgZXZlcnl0aGluZy48L2Rpdj4KICAgPG9sIHN0eWxlPSJwYWRkaW5nLWxlZnQ6MTlweDtsaW5lLWhlaWdodDoyO2ZvbnQtc2l6ZToxMy41cHgiPgogICAgPGxpPkdvIHRvIDxiPmdpdGh1Yi5jb20vbmV3PC9iPi4gTmFtZSBpdCA8Y29kZT5jaGFpcm1hbnN0YXRlPC9jb2RlPi4gVGljayA8Yj5Qcml2YXRlPC9iPi4gVGljayA8Yj5BZGQgYSBSRUFETUU8L2I+IOKAlCB0aGUgcmVwbyBtdXN0IG5vdCBiZSBlbXB0eS4gQ3JlYXRlIGl0LjwvbGk+CiAgICA8bGk+R28gdG8gPGI+Z2l0aHViLmNvbS9zZXR0aW5ncy9wZXJzb25hbC1hY2Nlc3MtdG9rZW5zL25ldzwvYj4gKEZpbmUtZ3JhaW5lZCB0b2tlbnMpLjwvbGk+CiAgICA8bGk+VG9rZW4gbmFtZTogPGNvZGU+Y2hhaXJtYW48L2NvZGU+LiBFeHBpcmF0aW9uOiA8Yj5ObyBleHBpcmF0aW9uPC9iPiDigJQgaWYgaXQgZXhwaXJlcyB5b3VyIHN5c3RlbSBzaWxlbnRseSBzdG9wcyBzYXZpbmcuPC9saT4KICAgIDxsaT5SZXBvc2l0b3J5IGFjY2VzczogPGI+T25seSBzZWxlY3QgcmVwb3NpdG9yaWVzPC9iPiDihpIgcGljayA8Y29kZT5jaGFpcm1hbnN0YXRlPC9jb2RlPiBhbmQgbm90aGluZyBlbHNlLjwvbGk+CiAgICA8bGk+UGVybWlzc2lvbnMg4oaSIFJlcG9zaXRvcnkgcGVybWlzc2lvbnMg4oaSIDxiPkNvbnRlbnRzPC9iPiDihpIgc2V0IHRvIDxiPlJlYWQgYW5kIHdyaXRlPC9iPi4gVGhhdCBvbmUgcGVybWlzc2lvbiBvbmx5LjwvbGk+CiAgICA8bGk+R2VuZXJhdGUsIHRoZW4gY29weSB0aGUgdG9rZW4uIEl0IHN0YXJ0cyA8Y29kZT5naXRodWJfcGF0XzwvY29kZT4uIFlvdSBjYW5ub3Qgc2VlIGl0IGFnYWluLjwvbGk+CiAgICA8bGk+SW4gUmVuZGVyIOKGkiB5b3VyIHNlcnZpY2Ug4oaSIDxiPkVudmlyb25tZW50PC9iPiDihpIgYWRkIHRocmVlIHZhcmlhYmxlczoKICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDttYXJnaW46N3B4IDA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjEycHg7bGluZS1oZWlnaHQ6MS45Ij4KICAgICAgU1RPUkUgPSBnaXRodWI8YnI+R0hfUkVQTyA9IDxpPnlvdXJ1c2VybmFtZTwvaT4vY2hhaXJtYW5zdGF0ZTxicj5HSF9UT0tFTiA9IGdpdGh1Yl9wYXRf4oCmPC9kaXY+PC9saT4KICAgIDxsaT5TYXZlLiBSZW5kZXIgcmVkZXBsb3lzIGF1dG9tYXRpY2FsbHkuIExvZyBpbiBoZXJlIGFuZCBwcmVzcyA8Yj5SVU4gVEhFIFNFTEYtVEVTVDwvYj4gYWJvdmUuPC9saT4KICAgPC9vbD4KICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1hbWIpIj48Yj5UaGUgcmVwbyBtdXN0IGJlIFBSSVZBVEUuPC9iPiBZb3VyIHN0YXRlIGZpbGUgaG9sZHMgQVBJIGtleXMsIHlvdXIgU01UUCBwYXNzd29yZCBhbmQgY2xpZW50IGRhdGEuIFRoZSBzZWxmLXRlc3QgcmVmdXNlcyB0byBwYXNzIGlmIHRoZSByZXBvIGlzIHB1YmxpYy48L2Rpdj4KICA8L2Rpdj5gOicnfWA7Cn07ClJFTkRFUi5zdG9yYWdlPSgpPT5gPGRpdiBkYXRhLWxpdmU9InN0b3JhZ2UiPiR7TElWRS5zdG9yYWdlKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gc3RvcmVUZXN0KCl7CiAgY29uc3Qgbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RPdXQnKTsgby5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5SdW5uaW5nIGEgcmVhbCByb3VuZCB0cmlw4oCmPC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0b3JlL3Rlc3QnLHt9KTsKICAgIG8uaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4keyhyLnN0ZXBzfHxbXSkubWFwKHM9PgogICAgICBgPHRyPjx0ZCBzdHlsZT0id2lkdGg6MzBweCI+JHtzLm9rPyc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+4pyUPC9zcGFuPic6JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7inJU8L3NwYW4+J308L3RkPgogICAgICAgPHRkPiR7ZXNjKHMuc3RlcCl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhzLmRldGFpbHx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHg7Ym9yZGVyLWNvbG9yOiR7ci5vaz8ndmFyKC0tbGltZSknOid2YXIoLS1tYWcpJ30iPgogICAgICAgPGI+JHtyLm9rPydQQVNTRUQnOidGQUlMRUQnfTwvYj4gJHtyLm1zP2BpbiAke3IubXN9bXNgOicnfSDigJQgJHtlc2Moci52ZXJkaWN0fHxyLmZhdGFsfHwnJyl9PC9kaXY+YDsKICAgIHJlbmRlcigpOwogIH1jYXRjaChlKXsgby5pbm5lckhUTUw9YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj5gIH0KfQoKLyogLS0tLS0tLS0tLSBTTVRQIFBSRUZMSUdIVDogcHJvdmUgaXQgYWdhaW5zdCB0aGUgcmVhbCBzZXJ2ZXIgLS0tLS0tLS0tLSAqLwphc3luYyBmdW5jdGlvbiBwcmVmbGlnaHQoKXsKICBjb25zdCBvPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZk91dCcpOwogIGNvbnN0IHRvPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGZUbycpfHx7fSkudmFsdWV8fCcnOwogIG8uaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+VGFsa2luZyB0byB5b3VyIHJlYWwgbWFpbCBzZXJ2ZXLigKY8L2Rpdj4nOwogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NtdHAvcHJlZmxpZ2h0Jyx7dG99KTsKICAgIG8uaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4keyhyLnN0ZXBzfHxbXSkubWFwKHM9PgogICAgICBgPHRyPjx0ZCBzdHlsZT0id2lkdGg6MjhweCI+JHtzLm9rPyc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+4pyUPC9zcGFuPic6JzxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7inJU8L3NwYW4+J308L3RkPgogICAgICAgPHRkIHN0eWxlPSJ3aWR0aDoyMDBweCI+JHtlc2Mocy5zdGVwKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHMuZGV0YWlsfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweDtib3JkZXItY29sb3I6JHtyLm9rPyd2YXIoLS1saW1lKSc6J3ZhcigtLW1hZyknfSI+CiAgICAgICA8Yj4ke3Iub2s/J1BBU1NFRCc6J0ZBSUxFRCd9PC9iPiR7ci5tcz9gIGluICR7ci5tc31tc2A6Jyd9JHtyLmZhdGFsP2Ag4oCUICR7ZXNjKHIuZmF0YWwpfWA6Jyd9CiAgICAgICAke3IuYWR2aWNlP2A8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+JHtlc2Moci5hZHZpY2UpfTwvZGl2PmA6Jyd9PC9kaXY+YDsKICAgIHJlbmRlcigpOwogIH1jYXRjaChlKXsgby5pbm5lckhUTUw9YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj5gIH0KfQoKLyogLS0tLS0tLS0tLSBhdHRhY2ggYSBmaWxlIHN0cmFpZ2h0IGZyb20gdGhlIGNoYXQgYm94IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gYXR0YWNoRG9jKGlucHV0KXsKICBjb25zdCBmID0gaW5wdXQuZmlsZXMgJiYgaW5wdXQuZmlsZXNbMF07CiAgaWYoIWYpIHJldHVybjsKICBpZihmLnNpemUgPiA4KjEwMjQqMTAyNCl7IGZsYXNoKCdUb28gYmlnIOKAlCA4IE1CIGxpbWl0Jyk7IGlucHV0LnZhbHVlPScnOyByZXR1cm47IH0KICBmbGFzaCgnUmVhZGluZyAnK2YubmFtZSsn4oCmJyk7CiAgdHJ5ewogICAgY29uc3QgYnVmID0gYXdhaXQgZi5hcnJheUJ1ZmZlcigpOwogICAgbGV0IGJpbj0nJzsgY29uc3QgYnl0ZXM9bmV3IFVpbnQ4QXJyYXkoYnVmKTsKICAgIGZvcihsZXQgaT0wO2k8Ynl0ZXMubGVuZ3RoO2krPTgxOTIpCiAgICAgIGJpbiArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGJ5dGVzLnN1YmFycmF5KGksaSs4MTkyKSk7CiAgICBhd2FpdCBBUEkoJy9hcGkvZG9jL3VwbG9hZCcseyBuYW1lOmYubmFtZSwgZGF0YTpidG9hKGJpbikgfSk7CiAgICBpbnB1dC52YWx1ZT0nJzsKICAgIHJlbmRlcigpOwogICAgZmxhc2goZi5uYW1lKycgYXR0YWNoZWQg4oCUIG5vdyBhc2sgaGltIGFib3V0IGl0Jyk7CiAgfWNhdGNoKGUpeyBpbnB1dC52YWx1ZT0nJzsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZHJvcERvYyhpZCl7IGF3YWl0IEFQSSgnL2FwaS9kb2MvcmVtb3ZlJyx7aWR9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBwcm9qZWN0czogYSBzZXBhcmF0ZSB0aHJlYWQgcGVyIHBpZWNlIG9mIHdvcmsgLS0tLS0tLS0tLSAqLwphc3luYyBmdW5jdGlvbiBuZXdQcmooKXsKICBjb25zdCBuID0gcHJvbXB0KCdOYW1lIHRoaXMgcHJvamVjdCDigJQgdXN1YWxseSB0aGUgYnVzaW5lc3MgaXQgaXMgYWJvdXQ6Jyk7CiAgaWYoIW4gfHwgIW4udHJpbSgpKSByZXR1cm47CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvcHJvamVjdC9uZXcnLHtuYW1lOm4udHJpbSgpfSk7IHJlbmRlcigpOyBmbGFzaCgnUHJvamVjdCAiJytuLnRyaW0oKSsnIiBvcGVuJyk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gb3BlblByaihpZCl7IGF3YWl0IEFQSSgnL2FwaS9wcm9qZWN0L29wZW4nLHtpZH0pOyByZW5kZXIoKTsgc2Nyb2xsQ2hhdCgpIH0KYXN5bmMgZnVuY3Rpb24gZGVsUHJqKGlkKXsKICBpZighY29uZmlybSgnRGVsZXRlIHRoaXMgcHJvamVjdCwgaXRzIGNvbnZlcnNhdGlvbiBhbmQgaXRzIGZpbGVzPycpKSByZXR1cm47CiAgYXdhaXQgQVBJKCcvYXBpL3Byb2plY3QvZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCk7Cn0KYXN5bmMgZnVuY3Rpb24gZmluZENoYXQoKXsKICBjb25zdCBxPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhdEZpbmQnKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCBvdXQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpbmRPdXQnKTsKICBpZighcS50cmltKCkpeyBvdXQuaW5uZXJIVE1MPScnOyByZXR1cm47IH0KICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9jaGF0L3NlYXJjaCcse3E6cS50cmltKCl9KTsKICAgIG91dC5pbm5lckhUTUwgPSByLmhpdHMubGVuZ3RoCiAgICAgID8gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPiR7ci5oaXRzLmxlbmd0aH0gbWF0Y2goZXMpIGZvciAiJHtlc2Moci5xKX0iPC9kaXY+CiAgICAgICAgICR7ci5oaXRzLm1hcChoPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGgucHJvamVjdCl9IMK3ICR7aC53aG99IMK3ICR7aC50fQogICAgICAgICAgICAke2gucGlkIT09KFMucHJvamVjdElkfHwnUFJKLU1BSU4nKT9gPGEgaHJlZj0iIyIgb25jbGljaz0ib3BlblByaignJHtoLnBpZH0nKTtyZXR1cm4gZmFsc2UiIHN0eWxlPSJtYXJnaW4tbGVmdDo4cHgiPm9wZW4gdGhhdCBwcm9qZWN0PC9hPmA6Jyd9PC9kaXY+CiAgICAgICAgICAgPGRpdiBzdHlsZT0ibGluZS1oZWlnaHQ6MS41NSI+JHtlc2MoaC5zbmlwcGV0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX0KICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmluZE91dCcpLmlubmVySFRNTD0nJztkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhdEZpbmQnKS52YWx1ZT0nJyI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gCiAgICAgIDogYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIG1hdGNoZXMgIiR7ZXNjKHIucSl9Ii48L2Rpdj48L2Rpdj5gOwogIH1jYXRjaChlKXsgb3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0id2FybmJveCI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj5gIH0KfQoKLyogPT09PT09PT09PT09PT09PT0gQ09OVEVOVCBTVFVESU8g4oCUIHRoZSBNb25kYXkgYmF0Y2ggPT09PT09PT09PT09PT09PT0gKi8KY29uc3QgUEs9e3JlZWw6J1JlZWwnLGNhcm91c2VsOidDYXJvdXNlbCcsc2luZ2xlOidQb3N0JyxzdG9yeTonU3RvcnknfTsKTElWRS5jb250ZW50PSgpPT57CiAgY29uc3QgVz1TLmNvbnRlbnR8fFtdLCBCPVMuYnVzaW5lc3Nlc3x8W107CiAgY29uc3QgaGVhZD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj5cdTI1YTMgQ09OVEVOVCBTVFVESU8g4oCUIE9ORSBIT1VSIE9OIE1PTkRBWSwgVEhFIFdFRUsgSVMgRE9ORTwvaDM+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPkhlIGRvZXMgbm90IHBvc3QgdG8gSW5zdGFncmFtLCBhbmQgbm90aGluZyBmcmVlIHNhZmVseSBjYW4uPC9iPgogICAgQXV0by1wb3N0aW5nIHRvb2xzIHRoYXQgcHJvbWlzZSBpdCBhcmUgcnVubmluZyB1bm9mZmljaWFsIEFQSXMsIGZvbGxvdy91bmZvbGxvdyBzY3JpcHRzIG9yIGVuZ2FnZW1lbnQgYm90cyDigJQgZXZlcnkgb25lIHZpb2xhdGVzIEluc3RhZ3JhbSdzIHRlcm1zIGFuZCBpcyB0aGUgbW9zdCBjb21tb24gY2F1c2Ugb2YgYSBzaGFkb3diYW4gb3IgYSBwZXJtYW5lbnQgYmFuLiA8Yj5NZXRhIEJ1c2luZXNzIFN1aXRlIGlzIEluc3RhZ3JhbSdzIG93biBzY2hlZHVsZXIsIGl0IGlzIGZyZWUsIGl0IGlzIG5hdGl2ZSwgYW5kIGl0IGlzIHRoZSBvbmx5IHRoaW5nIHRoYXQgcmVsaWFibHkgYXV0by1wdWJsaXNoZXMgUmVlbHMuPC9iPiBIZSBmaWxscyBpdC4gWW91IHBhc3RlIGl0IGluIG9uY2UgYSB3ZWVrLjwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIHdyaXRlcyB0aGUgcGFydCB0aGF0IGVhdHMgeW91ciB0aW1lOiBhIHdlZWsgb2YgaG9va3MsIGNhcHRpb25zLCBoYXNodGFncyBhbmQgdmlzdWFsIGJyaWVmcywgaW4gb25lIHBhc3MsIGFib3V0IHlvdXIgcmVhbCBidXNpbmVzcy48L2Rpdj4KICAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29udGVudCBmb3Igd2hpY2ggYnVzaW5lc3M8L3NwYW4+CiAgICAgPHNlbGVjdCBpZD0iY3RCaXoiIGNsYXNzPSJpbiI+JHtCLmxlbmd0aD9CLm1hcCh4PT5gPG9wdGlvbiB2YWx1ZT0iJHt4LmlkfSI+JHtlc2MoeC5uYW1lKX08L29wdGlvbj5gKS5qb2luKCcnKTonPG9wdGlvbiB2YWx1ZT0iIj7igJQgbm9uZSBidWlsdCDigJQ8L29wdGlvbj4nfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9yIGRlc2NyaWJlIHRoZSBuaWNoZSB5b3Vyc2VsZjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImN0TmljaGUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gd2Vic2l0ZSBtb25pdG9yaW5nIGZvciBMdWRoaWFuYSBleHBvcnRlcnMiPjwvbGFiZWw+CiAgIDwvZGl2PgogICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UG9zdHMgdGhpcyB3ZWVrPC9zcGFuPgogICAgIDxzZWxlY3QgaWQ9ImN0Q291bnQiIGNsYXNzPSJpbiI+PG9wdGlvbj41PC9vcHRpb24+PG9wdGlvbiBzZWxlY3RlZD43PC9vcHRpb24+PG9wdGlvbj4xMDwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPllvdXIgaGFuZGxlIChvcHRpb25hbCk8L3NwYW4+CiAgICAgPGlucHV0IGlkPSJjdEhhbmRsZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iQHlvdXJidXNpbmVzcyI+PC9sYWJlbD4KICAgPC9kaXY+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJwbGFuV2VlaygpIj5QTEFOIFRIRSBXRUVLPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkhlIHJlLXBsYW5zIGF1dG9tYXRpY2FsbHkgZXZlcnkgMiBkYXlzIGlmIHRoZSBsYXN0IHdlZWsgaXMgc3RhbGUsIGFuZCBhZGFwdHMgdG8gd2hpY2hldmVyIHBvc3RzIHlvdSBtYXJrIGFzIGhhdmluZyB3b3JrZWQuPC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICA8aDM+VGhlIHJoeXRobSB0aGF0IG1ha2VzIHRoaXMgd29yazwvaDM+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+TW9uZGF5IMK3IDQwIG1pbjwvdGQ+PHRkPlBsYW4gaGVyZSwgYnVpbGQgdmlzdWFscyBpbiBDYW52YSBvciBDYXBDdXQsIGxvYWQgdGhlIHdob2xlIHdlZWsgaW50byBNZXRhIEJ1c2luZXNzIFN1aXRlLjwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5EYWlseSDCtyAxMCBtaW48L3RkPjx0ZD48Yj5SZXBseSB0byBldmVyeSBjb21tZW50IGluIHRoZSBmaXJzdCBob3VyLjwvYj4gVGhpcyBzdGF5cyBtYW51YWwgYmVjYXVzZSBpdCBpcyB0aGUgc2luZ2xlIGhpZ2hlc3QtbGV2ZXJhZ2UgZnJlZSBncm93dGggbGV2ZXIgdGhlcmUgaXMuPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlN1bmRheSDCtyAxNSBtaW48L3RkPjx0ZD5DaGVjayBJbnNpZ2h0cy4gTWFyayBiZWxvdyB3aGF0IHdvcmtlZC4gSGUgdXNlcyBpdCB0byBwbGFuIHRoZSBuZXh0IHdlZWsuPC90ZD48L3RyPgogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgIDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxiPkJlZm9yZSBhbnkgb2YgdGhpcyB3b3Jrczo8L2I+IHlvdXIgYWNjb3VudCBtdXN0IGJlIGEgPGI+UHJvZmVzc2lvbmFsIChDcmVhdG9yKTwvYj4gYWNjb3VudCDigJQgU2V0dGluZ3Mg4oaSIEFjY291bnQgdHlwZS4gV2l0aG91dCBpdCB0aGVyZSBpcyBubyBzY2hlZHVsaW5nLCBubyBpbnNpZ2h0cyBhbmQgbm8gbW9uZXRpc2F0aW9uLiBUYWtlcyBvbmUgbWludXRlLjwvZGl2PgogIDwvZGl2PmA7CgogIGlmKCFXLmxlbmd0aCkgcmV0dXJuIGhlYWQrJzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB3ZWVrIHBsYW5uZWQgeWV0LjwvZGl2PjwvZGl2Pic7CgogIHJldHVybiBoZWFkICsgVy5tYXAodz0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweDtmbGV4LXdyYXA6d3JhcCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+V0VFSzwvc3Bhbj48Yj4ke2VzYyh3LmJpek5hbWUpfTwvYj4KICAgICA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4ke3cucmVlbHN9IHJlZWxzPC9zcGFuPgogICAgIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7dy5wb3N0cy5sZW5ndGh9IHBvc3RzPC9zcGFuPgogICAgICR7dy50ZWxsQ291bnQ/YDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPiR7dy50ZWxsQ291bnR9IHRvIGZpeDwvc3Bhbj5gOic8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5hdWRpdCBjbGVhbjwvc3Bhbj4nfTwvZGl2PgogICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3cudH08L3NwYW4+PC9kaXY+CgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHg7ZmxleC13cmFwOndyYXAiPgogICAgPGEgY2xhc3M9ImJ0biBvayIgaHJlZj0iL2FwaS9jb250ZW50L3R4dD9pZD0ke3cuaWR9Ij5ET1dOTE9BRCBUSEUgV0hPTEUgV0VFSzwvYT4KICAgIDxhIGNsYXNzPSJidG4iIGhyZWY9Imh0dHBzOi8vYnVzaW5lc3MuZmFjZWJvb2suY29tL2xhdGVzdC9wb3N0cy9zY2hlZHVsZWRfcG9zdHMiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5PcGVuIE1ldGEgQnVzaW5lc3MgU3VpdGUgXHUyMTk3PC9hPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxXZWVrKCcke3cuaWR9JykiPkRlbGV0ZTwvYnV0dG9uPjwvZGl2PgoKICAgJHt3LmJpb1N1Z2dlc3Rpb24/YDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTIwcHgiPkJpbzwvdGQ+PHRkIGlkPSJiaW9fJHt3LmlkfSI+JHtlc2Mody5iaW9TdWdnZXN0aW9uKX08L3RkPgogICAgICA8dGQgc3R5bGU9IndpZHRoOjcwcHgiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weUJpeignYmlvXyR7dy5pZH0nKSI+Q29weTwvYnV0dG9uPjwvdGQ+PC90cj4KICAgICAke3cuYXVkaW9Ob3RlP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXVkaW88L3RkPjx0ZCBjb2xzcGFuPSIyIj4ke2VzYyh3LmF1ZGlvTm90ZSl9PC90ZD48L3RyPmA6Jyd9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonJ30KCiAgICR7KHcucGlsbGFyc3x8W10pLmxlbmd0aD9gPGRldGFpbHMgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5QaWxsYXJzPC9iPjwvc3VtbWFyeT4KICAgIDx1bCBjbGFzcz0idGlnaHQiIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+JHt3LnBpbGxhcnMubWFwKHA9PmA8bGk+PGI+JHtlc2MocC5uYW1lKX08L2I+IOKAlCAke2VzYyhwLndoeSl9PC9saT5gKS5qb2luKCcnKX08L3VsPjwvZGV0YWlscz5gOicnfQoKICAgJHt3LnBvc3RzLm1hcChwPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkICR7cC5wb3N0ZWQ/J3ZhcigtLWdybiknOid2YXIoLS1zdHJva2UyKSd9O3BhZGRpbmctbGVmdDoxMnB4O21hcmdpbi1ib3R0b206MTZweCI+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47ZmxleC13cmFwOndyYXAiPgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmtpbmQ9PT0ncmVlbCc/J3QtZ3JuJzondC1kaW0nfSI+JHtQS1twLmtpbmRdfHxwLmtpbmR9PC9zcGFuPgogICAgICAgPGI+JHtlc2MocC5kYXkpfTwvYj4ke3AucG9zdGVkPyc8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5QT1NURUQ8L3NwYW4+JzonJ308L2Rpdj4KICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhwLnBpbGxhcnx8JycpfTwvc3Bhbj48L2Rpdj4KICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTVweDtmb250LXdlaWdodDo2MDA7bWFyZ2luOjdweCAwIj4iJHtlc2MocC5ob29rKX0iPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjdweCI+JHtlc2MocC53aHl8fCcnKX08L2Rpdj4KICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWlucCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1icmQpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgIDxkaXYgaWQ9ImNhcF8ke3AuaWR9IiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhwLmNhcHRpb24pfQoKJHtlc2MoKHAuaGFzaHRhZ3N8fFtdKS5qb2luKCcgJykpfTwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6OHB4IiBvbmNsaWNrPSJjb3B5Qml6KCdjYXBfJHtwLmlkfScpIj5Db3B5IGNhcHRpb24gKyB0YWdzPC9idXR0b24+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjRweCI+PGI+VmlzdWFsOjwvYj4gJHtlc2MocC52aXN1YWwpfTwvZGl2PgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPjxiPkFzazo8L2I+ICR7ZXNjKHAuY3RhKX08L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gJHtwLnBvc3RlZD8nJzonb2snfSIgb25jbGljaz0ibWFya1Bvc3RlZCgnJHt3LmlkfScsJyR7cC5pZH0nKSI+JHtwLnBvc3RlZD8nVW4tbWFyayc6J01hcmsgcG9zdGVkJ308L2J1dHRvbj4KICAgICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMzBweCIgaWQ9InJlc18ke3AuaWR9IiBwbGFjZWhvbGRlcj0id2hhdCBoYXBwZW5lZD8gZS5nLiA0MCB2aWV3cywgMSBETSIKICAgICAgICBvbmJsdXI9InNhdmVSZXN1bHQoJyR7dy5pZH0nLCcke3AuaWR9JykiIHZhbHVlPSIke2VzYyhwLnJlc3VsdHx8JycpfSI+PC9kaXY+CiAgICA8L2Rpdj5gKS5qb2luKCcnKX0KCiAgICR7dy5maXJzdENvbW1lbnQ/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbGltZSkiPjxiPlBvc3QgdGhpcyBjb21tZW50IHlvdXJzZWxmIHJpZ2h0IGFmdGVyIHB1Ymxpc2hpbmc6PC9iPgogICAgIDxkaXYgaWQ9ImZjXyR7dy5pZH0iIHN0eWxlPSJtYXJnaW4tdG9wOjZweCI+JHtlc2Mody5maXJzdENvbW1lbnQpfTwvZGl2PgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgc3R5bGU9Im1hcmdpbi10b3A6N3B4IiBvbmNsaWNrPSJjb3B5Qml6KCdmY18ke3cuaWR9JykiPkNvcHk8L2J1dHRvbj48L2Rpdj5gOicnfQoKICAgJHt3LnRlbGxDb3VudD9gPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyO2NvbG9yOnZhcigtLWFtYikiPjxiPiR7dy50ZWxsQ291bnR9IHBocmFzZShzKSBzb3VuZCBtYWNoaW5lLXdyaXR0ZW4g4oCUIGZpeCBiZWZvcmUgcG9zdGluZzwvYj48L3N1bW1hcnk+CiAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48dGFibGU+PHRib2R5PgogICAgICR7KHcudGVsbHN8fFtdKS5tYXAodD0+YDx0cj48dGQgc3R5bGU9ImZvbnQtZmFtaWx5Om1vbm9zcGFjZSI+IiR7ZXNjKHQuZm91bmQpfSI8L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHQud2h5KX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kZXRhaWxzPmA6Jyd9CiAgPC9kaXY+YCkuam9pbignJyk7Cn07ClJFTkRFUi5jb250ZW50PSgpPT5gPGRpdiBkYXRhLWxpdmU9ImNvbnRlbnQiPiR7TElWRS5jb250ZW50KCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIHBsYW5XZWVrKCl7CiAgY29uc3QgZz1pZD0+KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKXx8e30pLnZhbHVlfHwnJzsKICBmbGFzaCgnUGxhbm5pbmcgdGhlIHdlZWsg4oCUIGFib3V0IGEgbWludXRl4oCmJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvY29udGVudC93ZWVrJyx7Yml6SWQ6ZygnY3RCaXonKSxuaWNoZTpnKCdjdE5pY2hlJyksY291bnQ6K2coJ2N0Q291bnQnKXx8NyxoYW5kbGU6ZygnY3RIYW5kbGUnKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKGAke3IucG9zdHN9IHBvc3RzLCAke3IucmVlbHN9IHJlZWxzYCsoci50ZWxscz9gIMK3ICR7ci50ZWxsc30gdG8gZml4YDonIMK3IGNsZWFuJykpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZGVsV2VlayhpZCl7IGlmKCFjb25maXJtKCdEZWxldGUgdGhpcyB3ZWVrPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL2NvbnRlbnQvZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBtYXJrUG9zdGVkKHdlZWtJZCxwb3N0SWQpeyBhd2FpdCBBUEkoJy9hcGkvY29udGVudC9wb3N0ZWQnLHt3ZWVrSWQscG9zdElkfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gc2F2ZVJlc3VsdCh3ZWVrSWQscG9zdElkKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzXycrcG9zdElkKXx8e30pLnZhbHVlfHwnJzsKICBjb25zdCB3PShTLmNvbnRlbnR8fFtdKS5maW5kKHg9PnguaWQ9PT13ZWVrSWQpOwogIGNvbnN0IHA9dyYmdy5wb3N0cy5maW5kKHg9PnguaWQ9PT1wb3N0SWQpOwogIGlmKCFwIHx8IChwLnJlc3VsdHx8JycpPT09dikgcmV0dXJuOwogIGF3YWl0IEFQSSgnL2FwaS9jb250ZW50L3Bvc3RlZCcse3dlZWtJZCxwb3N0SWQscmVzdWx0OnZ9KTsKICBhd2FpdCBBUEkoJy9hcGkvY29udGVudC9wb3N0ZWQnLHt3ZWVrSWQscG9zdElkfSk7Cn0KCi8qID09PT09PT09PT09PT09PT09IENPTU1FTlQgREVTSyA9PT09PT09PT09PT09PT09PSAqLwpMSVZFLmNvbW1lbnRzPSgpPT57CiAgY29uc3QgTT1TLm1ldGEsIEQ9KFMuY29tbWVudERyYWZ0c3x8W10pLmZpbHRlcihkPT5kLnN0YXR1cz09PSdEUkFGVCcpLCBMPVMuY29tbWVudExvZ3x8W107CiAgY29uc3QgVz1TLnJlcGx5V2luZG93fHx7dXNlZDowLGNhcDo0MCxsZWZ0OjQwfTsKICBjb25zdCBkb25lPShTLmNvbW1lbnREcmFmdHN8fFtdKS5maWx0ZXIoZD0+ZC5zdGF0dXMhPT0nRFJBRlQnKTsKCiAgY29uc3QgaGVhZD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj5cdTI1YzggQ09NTUVOVCBERVNLIOKAlCBIRSBEUkFGVFMsIFlPVSBBUFBST1ZFLCBIRSBSRVBMSUVTPC9oMz4KICAgPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48Yj5JIHdhcyB3cm9uZyBhYm91dCB0aGlzIGFuZCBJIGFtIGNvcnJlY3RpbmcgaXQuPC9iPgogICAgSSB0b2xkIHlvdSB0aHJlZSB0aW1lcyB0aGF0IHJlcGx5aW5nIHRvIGNvbW1lbnRzIGNvdWxkIG5vdCBiZSBhdXRvbWF0ZWQgc2FmZWx5LiBJdCBjYW4uIE1ldGEgcHVibGlzaGVzIDxjb2RlPmluc3RhZ3JhbV9tYW5hZ2VfY29tbWVudHM8L2NvZGU+IGZvciBleGFjdGx5IHRoaXMgYW5kIGV4cGxpY2l0bHkgcGVybWl0cyBhdXRvbWF0ZWQgcmVwbGllcyB0byA8Yj51c2VyLWluaXRpYXRlZDwvYj4gYWN0aW9ucy4gV2hhdCBhY3R1YWxseSBnZXRzIGFjY291bnRzIGJhbm5lZCBpcyBicm93c2VyIGV4dGVuc2lvbnMsIHBhc3N3b3JkLXNoYXJpbmcgYm90cyBhbmQgY29sZCBvdXRyZWFjaCDigJQgbm90IHRoaXMuIEkgZ2VuZXJhbGlzZWQgYW5kIG5ldmVyIGNoZWNrZWQuPC9kaXY+CiAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij48dGFibGU+PHRib2R5PgogICAgPHRyPjx0ZCBzdHlsZT0id2lkdGg6MzBweDtjb2xvcjp2YXIoLS1ncm4pIj5cdTI3MTQ8L3RkPjx0ZD5SZXBseWluZyB0byBzb21lb25lIHdobyBjb21tZW50ZWQgb24gPGI+eW91cjwvYj4gcG9zdDwvdGQ+PC90cj4KICAgIDx0cj48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPlx1MjcxNDwvdGQ+PHRkPk9uZSBwcml2YXRlIERNIHJlcGx5IHRvIGEgY29tbWVudGVyLCB3aXRoaW4gNyBkYXlzPC90ZD48L3RyPgogICAgPHRyPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+XHUyNzE1PC90ZD48dGQ+Q29sZCBETXMgdG8gcGVvcGxlIHdobyBuZXZlciBlbmdhZ2VkIOKAlCA8Yj5ub3QgYnVpbHQ8L2I+PC90ZD48L3RyPgogICAgPHRyPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+XHUyNzE1PC90ZD48dGQ+SWRlbnRpY2FsIHJlcGxpZXMgYXQgc2NhbGUg4oCUIDxiPmJsb2NrZWQgaW4gY29kZTwvYj4sIG5vdCBqdXN0IHdhcm5lZCBhYm91dDwvdGQ+PC90cj4KICAgIDx0cj48dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlx1MjcxNTwvdGQ+PHRkPkF1dG8tZm9sbG93LCBwb2RzLCBib3VnaHQgZW5nYWdlbWVudCDigJQgPGI+bmV2ZXI8L2I+PC90ZD48L3RyPgogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CgogICAkeyFNP2A8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5CZWZvcmUgdGhpcyB3b3JrcywgTWV0YSByZXF1aXJlcyBhbGwgb2YgdGhpcyDigJQgbm9uZSBvZiBpdCBpcyBvcHRpb25hbCBhbmQgSSBjYW5ub3QgZG8gYW55IG9mIGl0IGZvciB5b3U6PC9iPgogICAgIDxvbCBzdHlsZT0ibWFyZ2luOjhweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHg7bGluZS1oZWlnaHQ6MS45Ij4KICAgICAgPGxpPkluc3RhZ3JhbSA8Yj5CdXNpbmVzcyBvciBDcmVhdG9yPC9iPiBhY2NvdW50LiBQZXJzb25hbCBhY2NvdW50cyBoYXZlIDxiPm5vIEFQSSBhdCBhbGw8L2I+LjwvbGk+CiAgICAgIDxsaT5BIDxiPkZhY2Vib29rIFBhZ2U8L2I+IGxpbmtlZCB0byBpdCwgZXZlbiBpZiB5b3UgbmV2ZXIgcG9zdCB0aGVyZS48L2xpPgogICAgICA8bGk+QW4gYXBwIGF0IDxiPmRldmVsb3BlcnMuZmFjZWJvb2suY29tPC9iPiBcdTIxOTIgQ3JlYXRlIEFwcCBcdTIxOTIgQnVzaW5lc3MuPC9saT4KICAgICAgPGxpPkFkZCB0aGUgPGI+SW5zdGFncmFtPC9iPiBwcm9kdWN0LCByZXF1ZXN0IDxjb2RlPmluc3RhZ3JhbV9iYXNpYzwvY29kZT4gYW5kIDxjb2RlPmluc3RhZ3JhbV9tYW5hZ2VfY29tbWVudHM8L2NvZGU+LjwvbGk+CiAgICAgIDxsaT48Yj5BcHAgUmV2aWV3PC9iPiBcdTIwMTQgMiB0byA1IGJ1c2luZXNzIGRheXMuIFdpdGhvdXQgaXQgeW91IGFyZSBsaW1pdGVkIHRvIHRlc3QgdXNlcnMuPC9saT4KICAgICAgPGxpPkdlbmVyYXRlIGEgPGI+bG9uZy1saXZlZCBQYWdlIGFjY2VzcyB0b2tlbjwvYj4gaW4gR3JhcGggQVBJIEV4cGxvcmVyIGFuZCBwYXN0ZSBpdCBiZWxvdy48L2xpPgogICAgIDwvb2w+CiAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRoaXMgaXMgZ2VudWluZWx5IGEgY291cGxlIG9mIGhvdXJzIG9mIE1ldGEgcGFwZXJ3b3JrLiBUaGVyZSBpcyBubyBzaG9ydGN1dCwgYW5kIGFueXRoaW5nIGFkdmVydGlzaW5nIG9uZSBpcyBhIGJvdC48L2Rpdj48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TG9uZy1saXZlZCBQYWdlIGFjY2VzcyB0b2tlbjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9Im10VG9rIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBwbGFjZWhvbGRlcj0iRUFBLi4uIj48L2xhYmVsPgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvbm5lY3RNZXRhKCkiPkNPTk5FQ1QgSU5TVEFHUkFNPC9idXR0b24+YAogICA6YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTMwcHgiPkFjY291bnQ8L3RkPjx0ZD48Yj5AJHtlc2MoTS51c2VybmFtZSl9PC9iPiBcdTAwYjcgJHtNLmZvbGxvd2Vyc30gZm9sbG93ZXJzIFx1MDBiNyAke00ubWVkaWFDb3VudH0gcG9zdHM8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlZpYSBQYWdlPC90ZD48dGQ+JHtlc2MoTS5wYWdlTmFtZSl9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5SZXBseSBidWRnZXQ8L3RkPjx0ZD4ke1cudXNlZH0gb2YgJHtXLmNhcH0gdXNlZCB0aGlzIGhvdXIgXHUwMGI3IHBhY2VkIDIwcyBhcGFydDxkaXYgY2xhc3M9Im1vbm8tZGltIj5NZXRhIGFsbG93cyA3NTAvaG91ci4gVGhpcyBpcyBzZXQgZmFyIGJlbG93IG9uIHB1cnBvc2UgXHUyMDE0IGxvb2tpbmcgbGlrZSBhIGZpcmVob3NlIGF0dHJhY3RzIHNjcnV0aW55IGV2ZW4gd2hlbiBldmVyeSBjYWxsIGlzIGxlZ2FsLjwvZGl2PjwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImhhcnZlc3RDb21tZW50cygpIj5DSEVDSyBGT1IgTkVXIENPTU1FTlRTPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJwdXJnZU1ldGEoKSI+RGlzY29ubmVjdDwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+SGUgY2hlY2tzIGF1dG9tYXRpY2FsbHkgZXZlcnkgMzAgbWludXRlcyBhbmQgZHJhZnRzIHJlcGxpZXMuIE5vdGhpbmcgaXMgZXZlciBzZW50IHdpdGhvdXQgeW91IHByZXNzaW5nIHNlbmQuPC9kaXY+YH0KICA8L2Rpdj5gOwoKICBpZighTSkgcmV0dXJuIGhlYWQ7CgogIGNvbnN0IGJvZHkgPSBELmxlbmd0aCA/IGA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206MTBweDtmbGV4LXdyYXA6d3JhcCI+CiAgICAgPGI+JHtELmxlbmd0aH0gZHJhZnQke0QubGVuZ3RoPjE/J3MnOicnfSB3YWl0aW5nIGZvciB5b3U8L2I+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InNlbmRDb21tZW50cygpIj5TRU5EIEFMTCBBUFBST1ZFRDwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyRHJhZnRzKCkiPkRpc2NhcmQgYWxsPC9idXR0b24+PC9kaXY+PC9kaXY+CiAgICAke0QubWFwKGQ9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHtkLmFjdGlvbj09PSdwdWJsaWMnPyd2YXIoLS1saW1lKSc6ZC5hY3Rpb249PT0nZG0nPyd2YXIoLS1jeSknOid2YXIoLS1zdHJva2UyKSd9O3BhZGRpbmctbGVmdDoxMnB4O21hcmdpbi1ib3R0b206MTVweCI+CiAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2ZsZXgtd3JhcDp3cmFwIj4KICAgICAgIDxkaXYgY2xhc3M9InJvdyI+PGI+QCR7ZXNjKGQudXNlcm5hbWUpfTwvYj4KICAgICAgICA8c3BhbiBjbGFzcz0idGFnICR7ZC5hY3Rpb249PT0ncHVibGljJz8ndC1ncm4nOmQuYWN0aW9uPT09J2RtJz8ndC1jeSc6J3QtZGltJ30iPiR7ZC5hY3Rpb24udG9VcHBlckNhc2UoKX08L3NwYW4+PC9kaXY+CiAgICAgICA8YSBjbGFzcz0ibW9uby1kaW0iIGhyZWY9IiR7ZXNjKGQucGVybWFsaW5rfHwnIycpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPnNlZSB0aGUgcG9zdCBcdTIxOTc8L2E+PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjlweDttYXJnaW46N3B4IDA7Zm9udC1zdHlsZTppdGFsaWMiPiIke2VzYyhkLmNvbW1lbnRUZXh0KX0iPC9kaXY+CiAgICAgICR7ZC5hY3Rpb249PT0naWdub3JlJ3x8ZC5hY3Rpb249PT0nb3duZXInCiAgICAgICAgPyBgPGRpdiBjbGFzcz0id2FybmJveCI+JHtkLmFjdGlvbj09PSdpZ25vcmUnPydIZSBpcyBsZWF2aW5nIHRoaXMgb25lIGFsb25lJzonSGUgbmVlZHMgeW91IG9uIHRoaXMgb25lJ30gXHUyMDE0ICR7ZXNjKGQud2h5fHwnJyl9PC9kaXY+YAogICAgICAgIDogJyd9CiAgICAgIDx0ZXh0YXJlYSBjbGFzcz0iaW4iIGlkPSJyZXBfJHtkLmlkfSIgc3R5bGU9Im1pbi1oZWlnaHQ6NTJweCIgb25ibHVyPSJzYXZlUmVwbHkoJyR7ZC5pZH0nKSI+JHtlc2MoZC5yZXBseSl9PC90ZXh0YXJlYT4KICAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo3cHgiPgogICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG9rIiBvbmNsaWNrPSJzZW5kQ29tbWVudHMoWycke2QuaWR9J10pIj5TZW5kIGp1c3QgdGhpczwvYnV0dG9uPgogICAgICAgPHNlbGVjdCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MTMwcHgiIG9uY2hhbmdlPSJzZXRBY3Rpb24oJyR7ZC5pZH0nLHRoaXMudmFsdWUpIj4KICAgICAgICAke1sncHVibGljJywnZG0nLCdpZ25vcmUnLCdvd25lciddLm1hcChhPT5gPG9wdGlvbiB2YWx1ZT0iJHthfSIke2E9PT1kLmFjdGlvbj8nIHNlbGVjdGVkJzonJ30+JHthfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PgogICAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLndoeXx8JycpfTwvc3Bhbj48L2Rpdj4KICAgICA8L2Rpdj5gKS5qb2luKCcnKX0KICAgPC9kaXY+YCA6IGA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gZHJhZnRzIHdhaXRpbmcuIEhlIGNoZWNrcyBldmVyeSAzMCBtaW51dGVzLjwvZGl2PjwvZGl2PmA7CgogIGNvbnN0IHJlc3VsdHMgPSBkb25lLmxlbmd0aCA/IGA8ZGV0YWlscyBjbGFzcz0iY2FyZCI+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIj48Yj5SZWNlbnRseSBoYW5kbGVkICgke2RvbmUubGVuZ3RofSk8L2I+PC9zdW1tYXJ5PgogICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PHRhYmxlPjx0Ym9keT4KICAgICAke2RvbmUuc2xpY2UoLTE1KS5yZXZlcnNlKCkubWFwKGQ9PmA8dHI+CiAgICAgIDx0ZCBzdHlsZT0id2lkdGg6ODBweCI+PHNwYW4gY2xhc3M9InRhZyAke2Quc3RhdHVzPT09J1NFTlQnPyd0LWdybic6ZC5zdGF0dXM9PT0nUkVGVVNFRCc/J3QtbWFnJzondC1hbWInfSI+JHtkLnN0YXR1c308L3NwYW4+PC90ZD4KICAgICAgPHRkPkAke2VzYyhkLnVzZXJuYW1lKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQucmVwbHl8fCcnKS5zbGljZSgwLDcwKX08L3RkPgogICAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLmVycm9yfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGV0YWlscz5gIDogJyc7CgogIGNvbnN0IGxvZyA9IEwubGVuZ3RoID8gYDxkZXRhaWxzIGNsYXNzPSJjYXJkIj48c3VtbWFyeSBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiIGNsYXNzPSJtb25vLWRpbSI+UmVwbHkgbG9nICgke0wubGVuZ3RofSk8L3N1bW1hcnk+CiAgICA8ZGl2IGNsYXNzPSJsb2ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+JHtMLnNsaWNlKDAsMjApLm1hcCh4PT4KICAgICBgPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7eC50fTwvc3Bhbj4gJHt4LmtpbmQ9PT0nZG0nPydETSc6J3JlcGx5J30gdG8gPGI+QCR7ZXNjKHgudXNlcm5hbWUpfTwvYj4gXHUyMDE0ICR7ZXNjKFN0cmluZyh4LnRleHQpLnNsaWNlKDAsODApKX08L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj48L2RldGFpbHM+YCA6ICcnOwoKICByZXR1cm4gaGVhZCArIGJvZHkgKyByZXN1bHRzICsgbG9nOwp9OwpSRU5ERVIuY29tbWVudHM9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0iY29tbWVudHMiPiR7TElWRS5jb21tZW50cygpfTwvZGl2PmA7Cgphc3luYyBmdW5jdGlvbiBjb25uZWN0TWV0YSgpewogIGNvbnN0IHQ9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtdFRvaycpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF0LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdQYXN0ZSB0aGUgdG9rZW4nKTsKICBmbGFzaCgnQ2hlY2tpbmcgd2l0aCBNZXRh4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9tZXRhL2Nvbm5lY3QnLHt0b2tlbjp0LnRyaW0oKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdDb25uZWN0ZWQgYXMgQCcrci5hY2NvdW50LnVzZXJuYW1lKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlTWV0YSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCBJbnN0YWdyYW0gYW5kIGRpc2NhcmQgdGhlIHRva2VuPycpKXJldHVybjsKICBhd2FpdCBBUEkoJy9hcGkvbWV0YS9wdXJnZScse30pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIGhhcnZlc3RDb21tZW50cygpewogIGZsYXNoKCdSZWFkaW5nIHlvdXIgY29tbWVudHPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2NvbW1lbnRzL2hhcnZlc3QnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKHIubXNnKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBzYXZlUmVwbHkoaWQpewogIGNvbnN0IHY9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXBfJytpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgY29uc3QgZD0oUy5jb21tZW50RHJhZnRzfHxbXSkuZmluZCh4PT54LmlkPT09aWQpOwogIGlmKCFkIHx8IGQucmVwbHk9PT12KSByZXR1cm47CiAgYXdhaXQgQVBJKCcvYXBpL2NvbW1lbnRzL2VkaXQnLHtpZCxyZXBseTp2fSk7Cn0KYXN5bmMgZnVuY3Rpb24gc2V0QWN0aW9uKGlkLGFjdGlvbil7IGF3YWl0IEFQSSgnL2FwaS9jb21tZW50cy9lZGl0Jyx7aWQsYWN0aW9ufSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gc2VuZENvbW1lbnRzKGlkcyl7CiAgY29uc3QgbiA9IGlkcyA/IDEgOiAoUy5jb21tZW50RHJhZnRzfHxbXSkuZmlsdGVyKGQ9PmQuc3RhdHVzPT09J0RSQUZUJyYmKGQuYWN0aW9uPT09J3B1YmxpYyd8fGQuYWN0aW9uPT09J2RtJykpLmxlbmd0aDsKICBpZighbikgcmV0dXJuIGZsYXNoKCdOb3RoaW5nIGFwcHJvdmVkIHRvIHNlbmQnKTsKICBpZighY29uZmlybShgUG9zdCAke259IHJlYWwgcmVwbCR7bj4xPydpZXMnOid5J30gdW5kZXIgQCR7KFMubWV0YXx8e30pLnVzZXJuYW1lfT8gVGhpcyBpcyBwdWJsaWMgYW5kIGNhbm5vdCBiZSB1bnNlbnQuYCkpIHJldHVybjsKICBmbGFzaCgnU2VuZGluZywgcGFjZWQgMjAgc2Vjb25kcyBhcGFydOKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvY29tbWVudHMvc2VuZCcse2lkczppZHN8fG51bGx9KTsKICAgIHJlbmRlcigpOyBmbGFzaChgJHtyLnNlbnR9IHNlbnRgKyhyLnNraXBwZWQ/YCDCtyAke3Iuc2tpcHBlZH0gc2tpcHBlZGA6JycpKyhyLmZhaWxlZD9gIMK3ICR7ci5mYWlsZWR9IGZhaWxlZGA6JycpKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyRHJhZnRzKCl7IGlmKCFjb25maXJtKCdEaXNjYXJkIGFsbCBkcmFmdHM/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvY29tbWVudHMvY2xlYXInLHthbGw6dHJ1ZX0pOyByZW5kZXIoKSB9CgovKiA9PT09PT09PT09PT09PT09PSBTS0lMTFMgPT09PT09PT09PT09PT09PT0gKi8KTElWRS5za2lsbHM9KCk9PnsKICBjb25zdCBTSz1TLnNraWxsc3x8W10sIFI9Uy5za2lsbFJ1bnN8fFtdOwogIGNvbnN0IG1pbmU9U0suZmlsdGVyKHM9PiFzLmJ1aWx0aW4pLCBzdGQ9U0suZmlsdGVyKHM9PnMuYnVpbHRpbik7CiAgY29uc3QgY2FyZD0ocyk9PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkICR7cy5idWlsdGluPyd2YXIoLS1saW1lKSc6J3ZhcigtLWN5KSd9Ij4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbTo2cHgiPgogICAgPGRpdiBjbGFzcz0icm93Ij48YiBzdHlsZT0iZm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOjEzLjVweCI+JHtlc2Mocy5uYW1lKX08L2I+CiAgICAgJHtzLmJ1aWx0aW4/JzxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPkJVSUxUIElOPC9zcGFuPicKICAgICAgIDpgPHNwYW4gY2xhc3M9InRhZyAke3MuZW5hYmxlZD8ndC1ncm4nOid0LWFtYid9Ij4ke3MuZW5hYmxlZD8nT04gQSBDQURFTkNFJzonTUFOVUFMIE9OTFknfTwvc3Bhbj5gfQogICAgICR7cy5jYWRlbmNlP2A8c3BhbiBjbGFzcz0ibW9uby1kaW0iPmV2ZXJ5ICR7cy5jYWRlbmNlPj04NjQwMD9NYXRoLnJvdW5kKHMuY2FkZW5jZS84NjQwMCkrJ2QnOk1hdGgucm91bmQocy5jYWRlbmNlLzM2MDApKydoJ308L3NwYW4+YDonJ308L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJ1blNraWxsKCcke3MuaWR9JykiPlJVTjwvYnV0dG9uPgogICAgICR7IXMuYnVpbHRpbj9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2dnbGVTa2lsbCgnJHtzLmlkfScpIj4ke3MuZW5hYmxlZD8nU3dpdGNoIG9mZic6J0VuYWJsZSd9PC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsU2tpbGwoJyR7cy5pZH0nKSI+XHUyNzE1PC9idXR0b24+YDonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPiR7ZXNjKHMuZGVzY3JpcHRpb24pfTwvZGl2PgogICAke3Mud2hlbj9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+PGI+V2hlbjo8L2I+ICR7ZXNjKHMud2hlbil9PC9kaXY+YDonJ30KICAgPGRldGFpbHM+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIiBjbGFzcz0ibW9uby1kaW0iPlRoZSBtZXRob2Q8L3N1bW1hcnk+CiAgICA8b2wgc3R5bGU9Im1hcmdpbjo4cHggMDtwYWRkaW5nLWxlZnQ6MTlweDtsaW5lLWhlaWdodDoxLjc1O2ZvbnQtc2l6ZToxMi41cHgiPgogICAgICR7KHMuc3RlcHN8fFtdKS5tYXAoeD0+YDxsaT4ke2VzYyh4KX08L2xpPmApLmpvaW4oJycpfTwvb2w+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjExMHB4Ij5SZWFkczwvdGQ+PHRkPiR7KHMuc291cmNlc3x8W10pLm1hcCh4PT5gPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtlc2MoeCl9PC9zcGFuPmApLmpvaW4oJyAnKXx8J1x1MjAxNCd9PC90ZD48L3RyPgogICAgICR7KHMuYXBwcm92YWxzfHxbXSkubGVuZ3RoP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TmV2ZXIgd2l0aG91dCB5b3U8L3RkPjx0ZD4keyhzLmFwcHJvdmFsc3x8W10pLm1hcChlc2MpLmpvaW4oJzxicj4nKX08L3RkPjwvdHI+YDonJ30KICAgICAkeyhzLnN0b3B8fFtdKS5sZW5ndGg/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+U3RvcHMgYW5kIGFza3M8L3RkPjx0ZD4keyhzLnN0b3B8fFtdKS5tYXAoZXNjKS5qb2luKCc8YnI+Jyl9PC90ZD48L3RyPmA6Jyd9CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kZXRhaWxzPgogIDwvZGl2PmA7CgogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj5cdTI3MjYgU0tJTExTIFx1MjAxNCBNRVRIT0RTLCBOT1QgQU5TV0VSUzwvaDM+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+QSBza2lsbCBpcyBhIHN0b3JlZCB3YXkgb2Ygd29ya2luZzogd2hhdCBpdCByZWFkcywgdGhlIHN0ZXBzIGluIG9yZGVyLCB3aGF0IGl0IG11c3QgPGI+bmV2ZXI8L2I+IGRvIHdpdGhvdXQgeW91LCBhbmQgd2hlbiBpdCBtdXN0IDxiPnN0b3AgYW5kIGFkbWl0IGl0IGRvZXMgbm90IGtub3c8L2I+LiBIZSBmb2xsb3dzIHRoZSBtZXRob2QgZXhhY3RseSBcdTIwMTQgaXQgaXMgbm90IGEgcHJvbXB0IGhlIGNhbiB3YW5kZXIgYXdheSBmcm9tLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5FdmVyeSBza2lsbCByZXR1cm5zIDxiPnRoZSBleGNlcHRpb25zIG9ubHk8L2I+IFx1MjAxNCB3aGF0IG5lZWRzIGF0dGVudGlvbi4gTmV2ZXIgYSBzdW1tYXJ5IG9mIGV2ZXJ5dGhpbmcuIEEgc2tpbGwgdGhhdCBmaW5kcyBub3RoaW5nIHNheXMgb25lIGxpbmUgYW5kIHN0b3BzLjwvZGl2PgogICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj5Db25uZWN0IGFuIEFJIGJyYWluIHRvIHJ1biBza2lsbHMuPC9kaXY+JzonJ30KICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48c3Bhbj5IYXZlIGhpbSB3cml0ZSBhIG5ldyBza2lsbCBmcm9tIHNvbWV0aGluZyB0aGF0IGFscmVhZHkgd29ya2VkPC9zcGFuPgogICAgPGlucHV0IGlkPSJza0JyaWVmIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIGNoZWNrIGV2ZXJ5IE1vbmRheSB3aGljaCBjbGllbnRzIGhhdmUgbm90IHBhaWQgYW5kIGRyYWZ0IHRoZSBjaGFzZSI+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9IndyaXRlU2tpbGwoKSI+V1JJVEUgQSBORVcgU0tJTEw8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjdweCI+TmV3IHNraWxscyBhcmUgY3JlYXRlZCA8Yj5zd2l0Y2hlZCBvZmY8L2I+LiBZb3UgZW5hYmxlIHRoZW0uPC9kaXY+CiAgPC9kaXY+CgogICR7Ui5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MYXN0IHJ1bjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjdweCI+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke2VzYyhSWzBdLnNraWxsKX08L3NwYW4+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke1JbMF0udH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1O2JhY2tncm91bmQ6dmFyKC0taW5wKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJyZCk7CiAgICAgIGJvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6MTJweCIgaWQ9InNrb3V0Ij4ke2VzYyhSWzBdLnRleHQpfTwvZGl2PgogICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiIG9uY2xpY2s9ImNvcHlCaXooJ3Nrb3V0JykiPkNvcHk8L2J1dHRvbj4KICAgICR7Ui5sZW5ndGg+MT9gPGRldGFpbHMgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PHN1bW1hcnkgc3R5bGU9ImN1cnNvcjpwb2ludGVyIiBjbGFzcz0ibW9uby1kaW0iPkVhcmxpZXIgcnVucyAoJHtSLmxlbmd0aC0xfSk8L3N1bW1hcnk+CiAgICAgICR7Ui5zbGljZSgxKS5tYXAoeD0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjJweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtwYWRkaW5nLWxlZnQ6MTBweDttYXJnaW46MTBweCAwIj4KICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoeC5za2lsbCl9IFx1MDBiNyAke3gudH08L2Rpdj4KICAgICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MoeC50ZXh0KS5zbGljZSgwLDQwMCl9PC9kaXY+PC9kaXY+YCkuam9pbignJyl9CiAgICAgPC9kZXRhaWxzPmA6Jyd9CiAgIDwvZGl2PmA6Jyd9CgogICR7bWluZS5sZW5ndGg/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjE2cHggMCA4cHgiPkhJUyBPV04gKCR7bWluZS5sZW5ndGh9KTwvZGl2PiR7bWluZS5tYXAoY2FyZCkuam9pbignJyl9YDonJ30KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjoxNnB4IDAgOHB4Ij5CVUlMVCBJTiAoJHtzdGQubGVuZ3RofSk8L2Rpdj4KICAke3N0ZC5tYXAoY2FyZCkuam9pbignJyl9YDsKfTsKUkVOREVSLnNraWxsczM9KCk9PmA8ZGl2IGRhdGEtbGl2ZT0ic2tpbGxzIj4ke0xJVkUuc2tpbGxzKCl9PC9kaXY+YDsKCmFzeW5jIGZ1bmN0aW9uIHJ1blNraWxsKGlkKXsKICBmbGFzaCgnUnVubmluZyB0aGUgbWV0aG9kXHUyMDI2Jyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9za2lsbC9ydW4nLHtpZH0pOyByZW5kZXIoKTsgZmxhc2goJ1JhbiAnK3Iuc2tpbGwpOyB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHdyaXRlU2tpbGwoKXsKICBjb25zdCB2PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2tCcmllZicpfHx7fSkudmFsdWV8fCcnOwogIGlmKCF2LnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdEZXNjcmliZSB3aGF0IGl0IHNob3VsZCBkbycpOwogIGZsYXNoKCdXcml0aW5nIHRoZSBtZXRob2RcdTIwMjYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NraWxsL3dyaXRlJyx7YnJpZWY6di50cmltKCl9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnV3JvdGUgIicrci5uYW1lKyciIFx1MjAxNCBzd2l0Y2hlZCBvZmYgdW50aWwgeW91IGVuYWJsZSBpdC4nKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVNraWxsKGlkKXsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL3RvZ2dsZScse2lkfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gZGVsU2tpbGwoaWQpeyBpZighY29uZmlybSgnRGVsZXRlIHRoaXMgc2tpbGw/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvc2tpbGwvZGVsZXRlJyx7aWR9KTsgcmVuZGVyKCkgfQo=','base64'),
  'art/approve.jpg': Buffer.from('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','base64'),
  'art/build.jpg': Buffer.from('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','base64'),
  'art/customers.jpg': Buffer.from('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','base64'),
  'art/hero.jpg': Buffer.from('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','base64'),
  'art/name.jpg': Buffer.from('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','base64')
};

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

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
                skillsOwn:[], skillRuns:[],
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


const SKILL_LIBRARY = [
  {
    id:'SK-LOOPS', name:'close-open-loops', builtin:true,
    description:'Find promises, unanswered messages, and work that has stalled between systems. '
      +'Use when things are slipping. Do NOT use to rebuild every thread.',
    when:'Weekly, or when you feel behind.',
    steps:[
      'Read the outreach log, missions, campaigns and gates.',
      'Find: messages sent with no reply after 4+ days; missions open more than a week; '
        +'gates waiting on the Owner; businesses built but never published.',
      'For each one, decide if it is genuinely open or already resolved elsewhere.',
      'Return only the exceptions, ordered by what costs money first.',
      'Propose the smallest next action for each. Never invent a deadline.'
    ],
    sources:['outreach','missions','campaigns','gates','businesses','monitors'],
    approvals:['Nothing is sent or changed. This produces a list only.'],
    stop:['If a commitment is ambiguous, say so rather than guessing an owner or date.'],
    cadence:604800,
  },
  {
    id:'SK-INBOX', name:'triage-what-matters', builtin:true,
    description:'Sort what is actually waiting on you from what looks urgent. '
      +'Use when the desk feels full. Do NOT treat unread as important.',
    when:'Daily, ten minutes.',
    steps:[
      'Gather pending gates, open missions, comment drafts, and unreplied outreach.',
      'Rank by consequence: money at risk, then a person waiting, then everything else.',
      'Group anything that is the same underlying item.',
      'Say plainly which items need the Owner personally and which he can ignore today.'
    ],
    sources:['gates','missions','commentDrafts','outreach'],
    approvals:['No replies are sent. Drafts stay drafts.'],
    stop:['If a thread was already answered, leave it out rather than flagging it.'],
    cadence:86400,
  },
  {
    id:'SK-AUDIT', name:'audit-a-live-site', builtin:true,
    description:'Test a real website end to end and report what is broken with evidence. '
      +'Use before selling monitoring to someone, or on your own site after a change.',
    when:'Before any outreach that claims you checked their site.',
    steps:[
      'Fetch the page and record status, load time, redirects and TLS expiry.',
      'Note anything a buyer would see: slow load, expired certificate, error page.',
      'State clearly what was checked and what was NOT.',
      'Never claim a fault you did not observe. Evidence or silence.'
    ],
    sources:['probe','monitors'],
    approvals:['Read-only. Nothing is changed on anyone else\u2019s site, ever.'],
    stop:['If the site cannot be reached, that is UNKNOWN, not DOWN. Say which.'],
    cadence:0,
  },
  {
    id:'SK-FIND', name:'find-new-customers', builtin:true,
    description:'Find prospects who fit for a REASON, from the live web. '
      +'Use when you need people to sell to. Do NOT use to pad a list to a target number.',
    when:'When the pipeline is empty. Run it with what you sell, or a place.',
    steps:[
      'Search the live web for the kind of business named in the request.',
      'For each one found, state the evidence that it fits — a real detail, not a guess.',
      'Check it against businesses and outreach already on file. Flag anyone already contacted.',
      'Say plainly which are strong, which are borderline, and which you could not verify.',
      'If too few meet the bar, say so and offer a wider criterion. Never pad the list.'
    ],
    sources:['web','businesses','outreach'],
    query:'hosiery exporters Ludhiana with website contact',
    approvals:['Nobody is contacted. This finds and qualifies only.'],
    stop:['Never invent a company, a website, a phone number or an email. '
         +'If a detail was not found, mark it NOT FOUND.',
          'A public listing does not mean they want to hear from you. Do not imply interest.'],
    cadence:0,
  },
  {
    id:'SK-PITCH', name:'build-a-pitch-deck', builtin:true,
    description:'Turn what you actually have into a short deck for one specific buyer. '
      +'Use before a real meeting. Do NOT use to make a generic company deck nobody asked for.',
    when:'When someone has agreed to look at what you do.',
    steps:[
      'Establish the audience and the ONE decision the deck should get.',
      'Lead with the conclusion, then the evidence. Never build up to it.',
      'Use only what is real: the actual price, the actual service, the actual guarantee.',
      'Where you have no proof, say what you will do instead of claiming a result.',
      'Return the slides as text, one slide per block, ready to put into Canva or Slides.'
    ],
    sources:['businesses','orders','monitors','outreach'],
    approvals:['Produces text only. Nothing is sent to anyone.'],
    stop:['If there is no business built yet, refuse — there is nothing honest to pitch.',
          'Never invent a customer, a testimonial, a logo or a result.'],
    cadence:0,
  },
  {
    id:'SK-PIPE', name:'review-the-pipeline', builtin:true,
    description:'Look at everything in flight and say where the money actually is. '
      +'Use weekly. Do NOT use as a status report — it returns decisions, not a summary.',
    when:'Every Monday, before you decide what to work on.',
    steps:[
      'Read orders, outreach, campaigns and businesses together.',
      'Find: links raised but never paid; people who replied and were not followed up; '
        +'businesses built but never published.',
      'Rank by rupees at risk, then by how long it has been sitting.',
      'For each, give the one next action. Never more than one.',
      'Say plainly if the pipeline is empty rather than dressing it up.'
    ],
    sources:['orders','outreach','campaigns','businesses'],
    approvals:['Nothing is sent or changed.'],
    stop:['If payment status is unclear from the gateway, say UNKNOWN rather than '
         +'assuming unpaid and chasing someone who already paid.'],
    cadence:604800,
  },
  {
    id:'SK-HANDOVER', name:'make-it-repeatable', builtin:true,
    description:'Turn something that worked once into a method that runs every time. '
      +'Use after a real accepted result. Do NOT use to write process docs for untested ideas.',
    when:'After something works and you want it to keep working.',
    steps:[
      'Identify the workflow and the result that was actually accepted.',
      'Separate the durable method from the one-off details.',
      'Write it as a skill: trigger, sources, steps, approvals, stop conditions.',
      'Run it once on a real case and correct it from what breaks.',
      'Only then put it on a cadence.'
    ],
    sources:['runs','campaigns','businesses','chat'],
    approvals:['A new skill is proposed, never enabled without the Owner.'],
    stop:['If there is no accepted example yet, refuse and say so.'],
    cadence:0,
  },
];

function allSkills(){
  const own = S.skillsOwn || [];
  return SKILL_LIBRARY.concat(own);
}
function findSkill(id){ return allSkills().find(s=>s.id===id); }

/* Run a skill. The method is real: the sources are read from actual state,
   and the model is given the skill's own steps and constraints. */
async function runSkill(id, note){
  const sk = findSkill(id);
  if(!sk) throw new Error('No such skill.');
  if(!S.llm) throw new Error('CONNECT AN AI BRAIN FIRST');

  /* Gather ONLY the sources the skill declares. A skill that says it reads
     monitors does not get to read the mail queue. */
  const src = {};
  const g = {
    outreach:   ()=> (S.outreach||[]).slice(0,40),
    missions:   ()=> (S.missions||[]).filter(m=>m.status==='OPEN').slice(0,20),
    campaigns:  ()=> (S.campaigns||[]).slice(0,5).map(c=>({name:c.name,status:c.status,
                       sent:c.sent,parked:c.parked,actions:(c.actions||[]).length})),
    gates:      ()=> (S.gates||[]).filter(x=>x.status==='PENDING').slice(0,20),
    businesses: ()=> (S.businesses||[]).map(b=>({name:b.name,published:b.published,
                       url:b.publishedUrl,tiers:(b.tiers||[]).map(t=>t.name+' Rs '+t.amount)})),
    monitors:   ()=> (S.monitors||[]).map(m=>({name:m.name,url:m.url,state:m.state,
                       ms:m.lastMs,err:m.lastErr,ssl:m.ssl&&m.ssl.days_left})),
    commentDrafts:()=>(S.commentDrafts||[]).filter(d=>d.status==='DRAFT').slice(0,20),
    runs:       ()=> (S.runs||[]).slice(0,25),
    chat:       ()=> (S.chat||[]).slice(0,20).map(m=>({who:m.who,text:String(m.text).slice(0,200)})),
    probe:      ()=> (S.monitors||[]).map(m=>({url:m.url,state:m.state,ms:m.lastMs})),
    orders:     ()=> (S.orders||[]).slice(0,30).map(o=>({t:o.t,amount:o.amount,
                       desc:o.desc,customer:o.customer,status:o.status,paid:o.paid,live:o.live})),
    content:    ()=> (S.content||[])[0] ? {posts:((S.content[0].posts)||[]).map(x=>
                       ({day:x.day,kind:x.kind,hook:x.hook,posted:x.posted,result:x.result}))} : {},
  };
  for(const key of (sk.sources||[])) if(g[key]) src[key] = g[key]();

  /* LIVE SOURCES — a skill that declares 'web' or 'domains' actually goes out
     and looks. Without this, "find new customers" could only re-read what the
     Owner already had, which finds nobody. These are slow, so they are opt-in
     per skill and capped. */
  if((sk.sources||[]).includes('web') && sk.query){
    try{
      const q = String(note||sk.query).slice(0,160);
      src.webSearch = await RESEARCH.search(q);
      log('INFO','SKILLS',`"${sk.name}" searched the live web for: ${q}`);
    }catch(e){ src.webSearch = { error:'Live search failed: '+e.message }; }
  }
  if((sk.sources||[]).includes('page') && note && /^https?:\/\//i.test(note.trim())){
    try{
      const pg = await RESEARCH.readPage(note.trim());
      src.page = { url:note.trim(), title:pg.title, text:String(pg.text).slice(0,6000) };
    }catch(e){ src.page = { error:'Could not read that page: '+e.message }; }
  }

  const empty = Object.values(src).every(v => !v || !v.length);
  if(empty && !note)
    return { skill:sk.name, text:'Nothing to work with yet — every source this skill reads is empty. '
      + 'It needs real activity first: monitors bound, messages sent, or a business built.', n:0 };

  const r = await think(
`You are running a stored skill. Follow ITS method, not your own.

SKILL: ${sk.name}
PURPOSE: ${sk.description}

THE METHOD — follow these in order:
${(sk.steps||[]).map((s,i)=>`  ${i+1}. ${s}`).join('\n')}

HARD CONSTRAINTS:
${(sk.approvals||[]).map(a=>'  · '+a).join('\n')}

STOP AND SAY SO IF:
${(sk.stop||[]).map(a=>'  · '+a).join('\n')}

THE REAL DATA, and this is all you have:
${JSON.stringify(src, null, 1).slice(0, 9000)}
${note ? '\nTHE OWNER ADDED: '+note : ''}

${ANTI_AI}

Return the exception list only — the things that need attention. Not a summary
of everything. If nothing needs attention, say that in one line and stop.
Order by what costs money first. Under 250 words.`,
    'You execute a stored method exactly. Terse. Exceptions only, never a transcript.',
    'skill-'+sk.id, 'Growth Conductor');

  S.skillRuns = S.skillRuns || [];
  S.skillRuns.unshift({ id:uid('SKR'), t:nowIso(), skillId:sk.id, skill:sk.name,
    text:r.text, note:note||'' });
  S.skillRuns = S.skillRuns.slice(0,30);
  save();
  log('OK','SKILLS',`Ran "${sk.name}".`);
  return { skill:sk.name, text:r.text, n:1 };
}

/* He writes a new skill from something that already worked. */
async function writeSkill(brief){
  if(!S.llm) throw new Error('CONNECT AN AI BRAIN FIRST');
  const known = allSkills().map(s=>s.name).join(', ');
  const j = await askJson(
`Write a new reusable SKILL for the Chairman, in the same shape as the ones
he already has.

WHAT THE OWNER WANTS IT TO DO: ${brief}

SKILLS THAT ALREADY EXIST (do not duplicate): ${known}

AVAILABLE SOURCES — a skill may only declare sources from this list:
  outreach, missions, campaigns, gates, businesses, monitors,
  commentDrafts, runs, chat, probe, orders, content,
  web   (searches the LIVE internet — only for skills that must FIND something new)
  page  (reads one URL the Owner supplies when running it)

${ANTI_AI}

A GOOD SKILL, and this is the whole point:
- The description says when to use it AND when NOT to.
- The steps are a method, not a wish. Each one is something checkable.
- It names what must never happen without the Owner's approval.
- It names the conditions where it must STOP and admit uncertainty.
- It returns exceptions, never a summary of everything.

Return ONLY this JSON:
{"name":"lowercase-hyphenated-name",
 "description":"when to use it, and explicitly when not to",
 "when":"the trigger, in plain words",
 "steps":["4 to 6 concrete steps"],
 "sources":["only from the list above"],
 "approvals":["what must never happen without the Owner"],
 "stop":["conditions that halt it and ask"],
 "cadenceHours":0}`,
    'You write precise, restrained operating methods. No fluff.',
    'skill-write','Growth Conductor');

  const ok = ['outreach','missions','campaigns','gates','businesses','monitors',
              'commentDrafts','runs','chat','probe','orders','content','web','page'];
  const sk = {
    id: uid('SK'), builtin:false, t: nowIso(),
    name: String(j.name||'new-skill').toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,40),
    description: String(j.description||'').slice(0,300),
    when: String(j.when||'').slice(0,140),
    steps: (j.steps||[]).slice(0,8).map(x=>String(x).slice(0,240)),
    sources: (j.sources||[]).filter(x=>ok.includes(x)).slice(0,6),
    approvals: (j.approvals||[]).slice(0,4).map(x=>String(x).slice(0,200)),
    stop: (j.stop||[]).slice(0,4).map(x=>String(x).slice(0,200)),
    cadence: Math.max(0, Math.min(2592000, Math.round((+j.cadenceHours||0)*3600))),
    enabled: false,   /* NEVER auto-enabled. The Owner turns it on. */
  };
  if(!sk.steps.length) throw new Error('The model wrote a skill with no method. Try again.');
  if(!sk.sources.length) sk.sources = ['runs'];

  S.skillsOwn = S.skillsOwn || [];
  S.skillsOwn.unshift(sk);
  S.skillsOwn = S.skillsOwn.slice(0,20);
  save();
  log('OK','SKILLS',`He wrote a new skill: "${sk.name}". It is OFF until you enable it.`);
  return sk;
}

CAPS['skills.cadence'] = { pillar:5, safe:true,
  desc:'Run any skill whose cadence is due',
  async run(){
    const due = allSkills().filter(s=>{
      if(!s.cadence) return false;
      if(s.builtin ? false : !s.enabled) return false;
      const last = (S.skillRuns||[]).find(r=>r.skillId===s.id);
      if(!last) return true;
      return (Date.now() - Date.parse(last.t.replace(' ','T')+'Z')) > s.cadence*1000;
    });
    if(!due.length) return { msg:'No skill is due.', n:0 };
    const done = [];
    for(const s of due.slice(0,2)){
      try{ await runSkill(s.id); done.push(s.name); }
      catch(e){ log('WARN','SKILLS',`${s.name} failed: ${e.message}`); }
    }
    return { msg: done.length ? `Ran ${done.join(', ')}.` : 'Skills were due but all failed.',
             n: done.length };
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
  ['skills.cadence',    3600, 'Growth Conductor'],
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
    skills: (typeof allSkills==='function') ? allSkills() : [],
    skillRuns:(S.skillRuns||[]).slice(0,12),
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

  if(p==='/api/boot'){
    if(BOOT_PHASE!=='ready')
      return send(res,503,{ booting:true, phase:BOOT_PHASE, error:BOOT_ERROR,
        hint: BOOT_PHASE==='store-failed'
          ? 'Storage is unreachable, so the system will not start with a blank identity. '
            + 'Check GH_TOKEN and GH_REPO in your host\'s environment settings.'
          : 'Still loading your data. Refresh in a moment.' });
    return send(res,200,{ provisioned: !!S.owner, authed: !!auth(req) });
  }

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
    /* Render polls this. It must answer instantly and tell the truth about
       which phase boot is in, so a storage fault is visible in seconds
       instead of after a 15-minute hang. */
    if(BOOT_PHASE!=='ready'){
      const code = BOOT_PHASE==='store-failed' ? 503 : 200;
      return send(res,code,{ ok:BOOT_PHASE==='ready', phase:BOOT_PHASE,
        error:BOOT_ERROR,
        hint: BOOT_PHASE==='store-failed'
          ? 'Storage is unreachable. Check GH_TOKEN, GH_REPO, and that the private repo exists.'
          : 'Loading state — this takes a moment on first boot.' });
    }
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

  /* ---- SKILLS ---- */
  if(p==='/api/skill/run'){
    try{ const r=await runSkill(b.id, (b.note||'').trim());
      return send(res,200,{ok:1,skill:r.skill,text:r.text,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/skill/write'){
    if(!(b.brief||'').trim()) return send(res,400,{error:'DESCRIBE WHAT IT SHOULD DO'});
    try{ const sk=await writeSkill(b.brief.trim());
      return send(res,200,{ok:1,id:sk.id,name:sk.name,state:pub()});
    }catch(e){ return send(res,400,{error:e.message}); }
  }
  if(p==='/api/skill/toggle'){
    const sk=(S.skillsOwn||[]).find(x=>x.id===b.id);
    if(!sk) return send(res,400,{error:'BUILT-IN SKILLS CANNOT BE DISABLED'});
    sk.enabled=!sk.enabled;
    log('OK','SKILLS',`"${sk.name}" ${sk.enabled?'ENABLED on its cadence':'switched off'}.`);
    save(); return send(res,200,{ok:1,state:pub()});
  }
  if(p==='/api/skill/delete'){
    S.skillsOwn=(S.skillsOwn||[]).filter(x=>x.id!==b.id); save();
    return send(res,200,{ok:1,state:pub()});
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
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
/* WHY THIS CHANGED — the Owner said deploys and loads took far too long.
   He was right, and it was not Render's fault:

     · Every asset went out UNCOMPRESSED. app.js is 360 KB; gzipped it is
       about a quarter of that. On a phone on Indian mobile data that is
       the difference between a snappy load and a long stare at nothing.
     · Every asset was 'Cache-Control: no-store', so the ENTIRE payload
       re-downloaded on every single page view and every wake-from-sleep.
       Nothing was ever reused.

   Now: gzip once, keep it in memory, and let the browser cache it against
   a content hash. The HTML stays uncached so a new build is picked up
   instantly; the heavy JS is cached hard because its URL changes when it
   changes. */
const _gz = new Map();
function serve(res,name,req){
  const d = __ASSETS[name] || __ASSETS['index.html'];
  sendAsset(res, d, path.extname(name) || '.html', req);
}
function sendAsset(res, buf, ext, req){
  const type = MIME[ext] || 'application/octet-stream';
  const tag  = '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0,16) + '"';
  /* the shell must never be cached, or a new build is invisible */
  const shell = ext === '.html';
  const cache = shell ? 'no-cache' : 'public, max-age=86400, must-revalidate';

  if(req && req.headers['if-none-match'] === tag){
    res.writeHead(304, { 'ETag':tag, 'Cache-Control':cache });
    return res.end();
  }
  const wantsGz = /\bgzip\b/.test((req && req.headers['accept-encoding']) || '')
                  && /javascript|html|css|json|svg/.test(type);
  let body = buf, enc = null;
  if(wantsGz){
    if(!_gz.has(tag)) _gz.set(tag, zlib.gzipSync(buf, { level:8 }));
    body = _gz.get(tag); enc = 'gzip';
  }
  const h = { 'Content-Type':type, 'Content-Length':body.length,
    'Cache-Control':cache, 'ETag':tag, 'Vary':'Accept-Encoding',
    'X-Frame-Options':'ALLOWALL', 'Content-Security-Policy':'frame-ancestors *' };
  if(enc) h['Content-Encoding'] = enc;
  res.writeHead(200, h);
  res.end(body);
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
    serve(res, __ASSETS[f] ? f : 'index.html', req);
  }catch(e){ T.err++; console.error('ERR',e.message); send(res,500,{error:'INTERNAL'}); }
});

/* ---------- async init: hydrate state from whichever store is configured ---------- */
/* HOW LONG THE DEPLOY TAKES — and why it used to hang.

   The port used to open LAST, after three GitHub API calls. Render decides a
   deploy has succeeded by waiting for the port to open. So if GitHub was slow,
   rate-limited, or the token was wrong, no port ever opened and Render sat
   there until it gave up. The Owner's own deploy log shows it: twelve deploys
   at 25-40 seconds, then one at 15m43s that FAILED.

   Worse, a bad token called process.exit(1) — which Render reads as a crash
   and retries, so the same 15 minutes happen again.

   Fixed: the port opens FIRST, in milliseconds. State loads behind it. Until
   the state is in, the app serves a plain "starting" response instead of
   pretending to be ready, and /api/health reports the real phase. */
let BOOT_PHASE = 'starting';
let BOOT_ERROR = null;

(async function init(){
  const line='════════════════════════════════════════════════════════';

  /* 1. OPEN THE PORT IMMEDIATELY. Render is satisfied; the deploy is done. */
  await new Promise(r => server.listen(PORT,'0.0.0.0',r));
  console.log('[boot] listening on '+PORT+' — loading state…');

  /* 2. Load state behind the open port. Slow storage delays readiness,
        never the deploy. */
  const t0 = Date.now();
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
    console.log('[boot] state loaded in '+(Date.now()-t0)+'ms');
  }catch(e){
    /* Do NOT exit. Exiting makes Render retry the whole slow deploy, and it
       still would not tell the Owner what is wrong. Stay up, refuse to serve
       a blank identity, and say exactly what to fix. */
    BOOT_PHASE = 'store-failed';
    BOOT_ERROR = e.message;
    console.error(line);
    console.error(' STORAGE UNREACHABLE: '+e.message);
    console.error(' The server is UP so you can read this, but it will not start');
    console.error(' with a blank identity — that would orphan your owner account.');
    console.error(' Check GH_TOKEN, GH_REPO and that the repo exists and is private.');
    console.error(line);
    return;   /* stays listening, reports the fault on /api/health */
  }

  BOOT_PHASE = 'ready';
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

  {
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
  }
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
