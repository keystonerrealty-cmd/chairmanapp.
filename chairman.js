#!/usr/bin/env node
/* ==========================================================================
   CHAIRMAN AGENT OS  —  SINGLE FILE

   RUN IT:   node chairman.js     then open http://localhost:8080

   ON INDEPENDENCE — THE HONEST TRUTH:
   No AI can have a brain "of its own". Training a language model costs
   millions in GPU compute. Every model on earth was trained by someone
   with a data centre. The real question is who can switch it off.

   OLLAMA is the sovereign answer: the model file lives on YOUR disk.
   No key, no account, no rate limit, no terms of service, works offline.
     1. ollama.com  ->  install
     2. ollama pull llama3.2
     3. AI Brain page -> choose Ollama -> leave key blank -> CONNECT
   Trade-off: slower and less capable than free cloud models. You swap
   raw power for total control.

   DEEP RESEARCH: he does not store the world's data (nobody can, and it
   would be stale in days). He fetches it LIVE — DuckDuckGo, Wikipedia,
   World Bank, live FX, and full page reads of any URL you give him.

   Creates data.json beside itself. Back that file up — it is your system.
   ========================================================================== */

const __M = {};
function __req(n){ return __M[n]; }
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

  let sock = await new Promise((res, rej) => {
    const opts = { host: cfg.host, port, servername: cfg.host };
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
        const s = tls.connect({ socket: sock, servername: cfg.host }, () => res(s));
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
    const data = [
      'From: ' + encodeHeader(cfg.name || 'Chairman Agent OS') + ' <' + from + '>',
      'To: <' + msg.to + '>',
      'Subject: ' + encodeHeader(msg.subject),
      'Date: ' + new Date().toUTCString(),
      'Message-ID: ' + mid,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      'X-Chairman-OS: v3',
      '', body, '', '.'
    ].join('\r\n');

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
__M['llm'] = (function(){ const module={exports:{}}; const exports=module.exports;
/* Zero-dependency LLM client. node:https only.
   OpenAI-compatible endpoints — Groq, Google AI Studio, NVIDIA NIM,
   OpenRouter, Cerebras, and local Ollama. All have genuinely free tiers.
   The Owner supplies their own key; nothing is stored in the audit ledger. */
const https = require('https');
const http  = require('http');

const PROVIDERS = {
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

function chat(cfg, messages, opts={}){
  return new Promise((resolve,reject)=>{
    const P = PROVIDERS[cfg.provider];
    if(!P) return reject(new Error('Unknown provider: '+cfg.provider));
    if(!P.nokey && !cfg.key) return reject(new Error('No API key configured for '+P.label));

    const body = JSON.stringify({
      model: cfg.model || P.model,
      messages,
      temperature: opts.temperature!=null?opts.temperature:0.4,
      max_tokens: opts.max_tokens||3000
    });
    const headers = { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) };
    if(!P.nokey) headers['Authorization']='Bearer '+cfg.key;
    if(cfg.provider==='openrouter'){ headers['HTTP-Referer']='http://localhost'; headers['X-Title']='Chairman Agent OS'; }

    const lib = P.plain ? http : https;
    const t0 = Date.now();
    const req = lib.request({ hostname:P.host, port:P.port||(P.plain?80:443),
      path:P.path, method:'POST', headers, timeout: opts.timeout||60000 }, res=>{
      let d='';
      res.on('data',c=>d+=c);
      res.on('end',()=>{
        if(res.statusCode===401||res.statusCode===403)
          return reject(new Error('KEY REJECTED — check the API key for '+P.label));
        if(res.statusCode===429)
          return reject(new Error('RATE LIMITED — free tier quota hit. Wait, or switch provider.'));
        if(res.statusCode===404 || /decommission|deprecat|does not exist|not found/i.test(d))
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
    req.on('timeout',()=>{ req.destroy(); reject(new Error('TIMEOUT — model took too long')); });
    req.on('error',e=>{
      if(cfg.provider==='ollama' && /ECONNREFUSED/.test(e.message))
        return reject(new Error('Ollama is not running. Install from ollama.com, then: ollama pull llama3.2'));
      reject(new Error(e.code||e.message));
    });
    req.write(body); req.end();
  });
}

/* Ask the provider what models it actually serves TODAY.
   Providers retire models without warning — this stops a dead default
   from looking like a broken key. */
function listModels(cfg){
  return new Promise((resolve,reject)=>{
    const P = PROVIDERS[cfg.provider];
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

module.exports = { chat, listModels, PROVIDERS };

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

/* DuckDuckGo HTML results — title + snippet, no key required. */
async function search(query, limit){
  limit = limit || 6;
  const html = await get('html.duckduckgo.com', '/html/?q='+encodeURIComponent(query));
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while((m = re.exec(html)) && out.length < limit){
    const title = strip(m[1]), snippet = strip(m[2]);
    if(title && snippet) out.push({ title, snippet });
  }
  if(!out.length){
    const re2 = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    while((m = re2.exec(html)) && out.length < limit){
      const s = strip(m[1]); if(s) out.push({ title:'', snippet:s });
    }
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
  store = localStore(process.env.DATA_DIR || __dirname);
}
module.exports = store;

return module.exports; })();

const __ASSETS = {
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgo6cm9vdHsKICAtLWJnOiMwNTA3MGE7IC0tYmcyOiMwODBiMTE7IC0tcGFuZWw6IzBhMGYxNjsgLS1wYW5lbDI6IzBkMTMxYzsgLS1saW5lOiMxNjIwMmM7IC0tbGluZTI6IzFlMmIzYTsKICAtLXR4dDojZTZlZWY3OyAtLWRpbTojNmI3YThkOyAtLWRpbTI6IzQ4NTY2YTsKICAtLWN5OiMyMmQzZWU7IC0tYmx1OiMzYjgyZjY7IC0tbWFnOiNmZjNiNmI7IC0tYW1iOiNmZmIwMjA7IC0tZ3JuOiMzMWQ2N2E7IC0tcHVyOiNhODc3ZmY7CiAgLS1tb25vOnVpLW1vbm9zcGFjZSxTRk1vbm8tUmVndWxhcixNZW5sbyxDb25zb2xhcywiUm9ib3RvIE1vbm8iLG1vbm9zcGFjZTsKICAtLXNhbnM6LWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsIlNlZ29lIFVJIixJbnRlcixSb2JvdG8sc2Fucy1zZXJpZjsKICAtLXNidzoyMTJweDsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnR9Cmh0bWwsYm9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMCV9CmJvZHl7YmFja2dyb3VuZDp2YXIoLS1iZyk7Y29sb3I6dmFyKC0tdHh0KTtmb250OjEzcHgvMS41IHZhcigtLW1vbm8pO292ZXJmbG93LXg6aGlkZGVuOwogIGJhY2tncm91bmQtaW1hZ2U6cmFkaWFsLWdyYWRpZW50KDkwMHB4IDUwMHB4IGF0IDEyJSAtOCUsIzBkMWIyZSAwJSx0cmFuc3BhcmVudCA2MCUpLAogICAgICAgICAgICAgICAgICAgcmFkaWFsLWdyYWRpZW50KDgwMHB4IDQ4MHB4IGF0IDkyJSA0JSwjMWIxMDMwIDAlLHRyYW5zcGFyZW50IDU1JSk7CiAgYmFja2dyb3VuZC1hdHRhY2htZW50OmZpeGVkfQpidXR0b257Zm9udDppbmhlcml0O2N1cnNvcjpwb2ludGVyO2NvbG9yOmluaGVyaXR9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtmb250OmluaGVyaXR9Ci5oaWRle2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6OXB4O2hlaWdodDo5cHh9Ojotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOiMxYjI4MzY7Ym9yZGVyLXJhZGl1czo5cHh9Cjo6LXdlYmtpdC1zY3JvbGxiYXItdHJhY2t7YmFja2dyb3VuZDp0cmFuc3BhcmVudH0KCi8qID09PT09PT09PT09PSBMT0dJTiAvIEhFUk8gPT09PT09PT09PT09ICovCiNnYXRle3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDo4MDtvdmVyZmxvdzphdXRvO2JhY2tncm91bmQ6dmFyKC0tYmcpOwogIGJhY2tncm91bmQtaW1hZ2U6cmFkaWFsLWdyYWRpZW50KDkwMHB4IDUyMHB4IGF0IDE1JSAwJSwjMGUyMDM2IDAlLHRyYW5zcGFyZW50IDYwJSksCiAgICAgICAgICAgICAgICAgICByYWRpYWwtZ3JhZGllbnQoNzAwcHggNTAwcHggYXQgOTAlIDIwJSwjMjUxMDNmIDAlLHRyYW5zcGFyZW50IDU1JSl9Ci50b3BiYXJ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDtwYWRkaW5nOjE0cHggMjBweDtmbGV4LXdyYXA6d3JhcDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTtiYWNrZ3JvdW5kOiMwNTA3MGFkMDtiYWNrZHJvcC1maWx0ZXI6Ymx1cig4cHgpfQoubG9nb3tmb250OjgwMCAxN3B4LzEgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LS40cHh9Ci5sb2dvIGl7Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tY3kpfQoucGlsbHtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKTtiYWNrZ3JvdW5kOiMwYzEzMWM7Ym9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NXB4IDEycHg7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzouOHB4fQoucGlsbC5saXZle2JvcmRlci1jb2xvcjojMWM1YzNjO2JhY2tncm91bmQ6IzA4MTcwZjtjb2xvcjp2YXIoLS1ncm4pfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tZ3JuKTttYXJnaW4tcmlnaHQ6NnB4OwogIGJveC1zaGFkb3c6MCAwIDhweCB2YXIoLS1ncm4pO2FuaW1hdGlvbjpicCAxLjhzIGluZmluaXRlfQpAa2V5ZnJhbWVzIGJwezUwJXtvcGFjaXR5Oi4zNX19Ci5oZXJve21heC13aWR0aDoxMTgwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjI2cHggMjBweCA2MHB4fQouaGVyb0NhcmR7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwYjE0MjAsIzBhMGQxNCA2MCUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpOwogIGJvcmRlci1yYWRpdXM6MjBweDtwYWRkaW5nOmNsYW1wKDIycHgsNHZ3LDQ0cHgpO2Rpc3BsYXk6Z3JpZDtnYXA6MzRweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MS4wNWZyIC45NWZyO2FsaWduLWl0ZW1zOmNlbnRlcn0KQG1lZGlhKG1heC13aWR0aDo5MDBweCl7Lmhlcm9DYXJke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQouYmFkZ2V7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDojMmExYjUyO2JvcmRlcjoxcHggc29saWQgIzRhMzA4MDtjb2xvcjojYzliM2ZmOwogIHBhZGRpbmc6NXB4IDEycHg7Ym9yZGVyLXJhZGl1czo3cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS42cHh9CmgxLmJpZ3tmb250OjgwMCBjbGFtcCgzMHB4LDUuNnZ3LDUwcHgpLzEuMDMgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LTEuNXB4O21hcmdpbjoxNnB4IDAgMTRweH0KaDEuYmlnIGVte2ZvbnQtc3R5bGU6bm9ybWFsO2NvbG9yOnZhcigtLWN5KTt0ZXh0LXNoYWRvdzowIDAgMzBweCAjMjJkM2VlNTV9Ci5sZWRle2NvbG9yOiM5M2EzYjY7Zm9udDoxNHB4LzEuNjUgdmFyKC0tc2Fucyk7bWF4LXdpZHRoOjUyY2g7bWFyZ2luOjAgMCAyMnB4fQouc3RhdFJvd3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTQwcHgsMWZyKSk7Z2FwOjEycHh9Ci5zdGF0e2JhY2tncm91bmQ6IzBhMTExOTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzoxM3B4IDE1cHh9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjFweC8xLjIgdmFyKC0tc2Fucyk7bWFyZ2luOjVweCAwIDNweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4fQoubG9naW5Cb3h7YmFja2dyb3VuZDojMGEwZjE3O2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpO2JvcmRlci1yYWRpdXM6MTZweDtwYWRkaW5nOjIycHg7Ym94LXNoYWRvdzowIDMwcHggODBweCAjMDAwYX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgM3B4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLWN5KX0KLmxvZ2luQm94IC5zYntjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMC41cHg7bWFyZ2luLWJvdHRvbToxNnB4O2xldHRlci1zcGFjaW5nOi42cHh9Ci5lcnJ7Y29sb3I6dmFyKC0tbWFnKTtmb250LXNpemU6MTFweDttaW4taGVpZ2h0OjE2cHg7bWFyZ2luLXRvcDo2cHh9Ci53YXJuYm94e2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1hbWIpO2JhY2tncm91bmQ6IzE3MGYwMjtwYWRkaW5nOjlweCAxMnB4O2JvcmRlci1yYWRpdXM6MCA4cHggOHB4IDA7CiAgZm9udC1zaXplOjExcHg7Y29sb3I6I2U4ZDVhODttYXJnaW4tYm90dG9tOjE0cHg7bGluZS1oZWlnaHQ6MS41fQoucGlsbGFyc3ttYXgtd2lkdGg6MTE4MHB4O21hcmdpbjowIGF1dG87cGFkZGluZzowIDIwcHggNzBweH0KLnBpbGxhcnMgaDJ7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udDo4MDAgY2xhbXAoMjFweCwzLjR2dywzMHB4KS8xLjEgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LS43cHg7bWFyZ2luOjAgMCA4cHh9Ci5waWxsYXJzIGgyIGVte2ZvbnQtc3R5bGU6bm9ybWFsO2NvbG9yOnZhcigtLWN5KX0KLnBpbGxhcnMgLnN1Ynt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTIuNXB4LzEuNSB2YXIoLS1zYW5zKTttYXJnaW46MCAwIDI0cHh9Ci5wZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE0cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjA1cHgsMWZyKSl9Ci5wY2FyZHtiYWNrZ3JvdW5kOiMwYTBmMTY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxNnB4O3RyYW5zaXRpb246LjE4c30KLnBjYXJkOmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1jeSk7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTNweCk7Ym94LXNoYWRvdzowIDE0cHggNDBweCAjMjJkM2VlMTR9Ci5wY2FyZCB1e3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWN5KTtmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS42cHh9Ci5wY2FyZCBoNHttYXJnaW46OHB4IDAgOHB4O2ZvbnQ6NzAwIDE0LjVweC8xLjI1IHZhcigtLXNhbnMpfQoucGNhcmQgcHttYXJnaW46MCAwIDExcHg7Y29sb3I6Izg1OTVhODtmb250OjExLjVweC8xLjU1IHZhcigtLXNhbnMpfQouY2hpcHtkaXNwbGF5OmlubGluZS1ibG9jaztiYWNrZ3JvdW5kOiMwZjE3MjA7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7Y29sb3I6IzlmYjBjNDsKICBib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjNweCA4cHg7Zm9udC1zaXplOjEwcHg7bWFyZ2luOjAgNXB4IDVweCAwfQoKLyogPT09PT09PT09PT09IEFQUCBTSEVMTCA9PT09PT09PT09PT0gKi8KI2FwcHtkaXNwbGF5OmZsZXg7bWluLWhlaWdodDoxMDB2aH0KYXNpZGV7d2lkdGg6dmFyKC0tc2J3KTtmbGV4OjAgMCB2YXIoLS1zYncpO2JhY2tncm91bmQ6IzA2MDgwYztib3JkZXItcmlnaHQ6MXB4IHNvbGlkIHZhcigtLWxpbmUpOwogIHBvc2l0aW9uOnN0aWNreTt0b3A6MDtoZWlnaHQ6MTAwdmg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjt6LWluZGV4OjQwfQouYWJyYW5ke3BhZGRpbmc6MTRweCAxNHB4IDEycHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSk7ZGlzcGxheTpmbGV4O2dhcDo5cHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDoyMHB4O2hlaWdodDoyMHB4O2JvcmRlci1yYWRpdXM6NnB4O2JvcmRlcjoxLjVweCBzb2xpZCB2YXIoLS1tYWcpO2Rpc3BsYXk6Z3JpZDtwbGFjZS1pdGVtczpjZW50ZXI7CiAgY29sb3I6dmFyKC0tbWFnKTtmb250LXNpemU6MTFweDtib3gtc2hhZG93OjAgMCAxNHB4ICNmZjNiNmI0MH0KLmFicmFuZCBie2ZvbnQ6NzAwIDExLjVweC8xIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi44cHg7ZGlzcGxheTpibG9ja30KLmFicmFuZCBzcGFue2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjFweH0KYXNpZGUgbmF2e2ZsZXg6MTtvdmVyZmxvdy15OmF1dG87cGFkZGluZzo4cHggOHB4IDE0cHh9Ci5ncnB7Y29sb3I6IzNmNGQ1Zjtmb250LXNpemU6OC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7cGFkZGluZzoxM3B4IDlweCA1cHh9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O3dpZHRoOjEwMCU7YmFja2dyb3VuZDpub25lO2JvcmRlcjowOwogIGNvbG9yOiM3ZDhiOWM7cGFkZGluZzo3cHggOXB4O2JvcmRlci1yYWRpdXM6N3B4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTEuNXB4O2xldHRlci1zcGFjaW5nOi4ycHh9CmFzaWRlIG5hdiBidXR0b246aG92ZXJ7YmFja2dyb3VuZDojMGUxNjIwO2NvbG9yOnZhcigtLXR4dCl9CmFzaWRlIG5hdiBidXR0b24ub257YmFja2dyb3VuZDojMGQxYTI0O2NvbG9yOnZhcigtLWN5KTtib3gtc2hhZG93Omluc2V0IDJweCAwIDAgdmFyKC0tY3kpfQphc2lkZSBuYXYgYnV0dG9uIGl7Zm9udC1zdHlsZTpub3JtYWw7d2lkdGg6MTRweDt0ZXh0LWFsaWduOmNlbnRlcjtvcGFjaXR5Oi45O2ZvbnQtc2l6ZToxMXB4fQouYWZvb3R7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSk7cGFkZGluZzoxMHB4IDEycHg7Zm9udC1zaXplOjEwcHg7Y29sb3I6dmFyKC0tZGltMil9Cm1haW57ZmxleDoxO21pbi13aWR0aDowO3BhZGRpbmc6MTZweCBjbGFtcCgxNHB4LDIuNHZ3LDI2cHgpIDkwcHh9Ci5tdG9we2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbToxNnB4fQouY3J1bWJ7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjExcHh9LmNydW1iIGJ7Y29sb3I6dmFyKC0tY3kpO2ZvbnQtd2VpZ2h0OjUwMH0KLm10b3AgLnNwe2ZsZXg6MX0KI2J1cmdlcntkaXNwbGF5Om5vbmV9CkBtZWRpYShtYXgtd2lkdGg6ODYwcHgpewogIGFzaWRle3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwJSk7dHJhbnNpdGlvbjouMjJzO2JveC1zaGFkb3c6MCAwIDYwcHggIzAwMH0KICBhc2lkZS5vcGVue3RyYW5zZm9ybTpub25lfQogICNzY3JpbXtwb3NpdGlvbjpmaXhlZDtpbnNldDowO2JhY2tncm91bmQ6IzAwMGE7ei1pbmRleDozNX0KICAjYnVyZ2Vye2Rpc3BsYXk6aW5saW5lLWZsZXh9CiAgbWFpbntwYWRkaW5nLWJvdHRvbToxMDBweH0KfQoKLyogPT09PT09PT09PT09IFBSSU1JVElWRVMgPT09PT09PT09PT09ICovCi5jYXJke2JhY2tncm91bmQ6dmFyKC0tcGFuZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MTVweCAxN3B4O21hcmdpbi1ib3R0b206MTRweH0KLmNhcmQ+aDN7bWFyZ2luOjAgMCAxMnB4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7Y29sb3I6dmFyKC0tZGltKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjEzcHh9Ci5nMntncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyOTBweCwxZnIpKX0KLmcze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDIwNXB4LDFmcikpfQouZzR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTU4cHgsMWZyKSl9Ci5rcGl7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwYzE1MjAsIzBhMGUxNSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTNweCAxNXB4fQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyMnB4LzEuMiB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjVweH0KLmtwaSB1e2Rpc3BsYXk6YmxvY2s7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjEuM3B4O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTttYXJnaW4tYm90dG9tOjRweH0KLmtwaSBze2Rpc3BsYXk6YmxvY2s7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjEwcHg7bWFyZ2luLXRvcDozcHh9Ci5idG57YmFja2dyb3VuZDojMGYxYTI2O2JvcmRlcjoxcHggc29saWQgIzIyMzQ0YTtwYWRkaW5nOjhweCAxM3B4O2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxMS41cHg7dHJhbnNpdGlvbjouMTVzfQouYnRuOmhvdmVye2JhY2tncm91bmQ6IzE1MjQzNjtib3JkZXItY29sb3I6IzJkNDY1Zn0KLmJ0bi5we2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLWN5KSwjMzhiZGY4KTtib3JkZXItY29sb3I6dHJhbnNwYXJlbnQ7Y29sb3I6IzA0MTQxYTtmb250LXdlaWdodDo3MDB9Ci5idG4ub2t7YmFja2dyb3VuZDojMDgyMDE3O2JvcmRlci1jb2xvcjojMWM1YzNjO2NvbG9yOnZhcigtLWdybil9Ci5idG4ubm97YmFja2dyb3VuZDojMWQwYTEwO2JvcmRlci1jb2xvcjojNmIyMjMzO2NvbG9yOnZhcigtLW1hZyl9Ci5idG4uc217cGFkZGluZzo1cHggOXB4O2ZvbnQtc2l6ZToxMC41cHg7Ym9yZGVyLXJhZGl1czo2cHh9Ci5idG46ZGlzYWJsZWR7b3BhY2l0eTouMzU7Y3Vyc29yOm5vdC1hbGxvd2VkfQoucm93e2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwO2FsaWduLWl0ZW1zOmNlbnRlcn0KbGFiZWwuZntkaXNwbGF5OmJsb2NrO21hcmdpbi1ib3R0b206MTFweH0KbGFiZWwuZj5zcGFue2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjkuNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2NvbG9yOnZhcigtLWRpbSk7bWFyZ2luLWJvdHRvbTo1cHg7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlfQouaW57d2lkdGg6MTAwJTtiYWNrZ3JvdW5kOiMwNjA5MGU7Ym9yZGVyOjFweCBzb2xpZCAjMWUyYjNhO2NvbG9yOnZhcigtLXR4dCk7cGFkZGluZzo5cHggMTFweDtib3JkZXItcmFkaXVzOjhweDtvdXRsaW5lOm5vbmV9Ci5pbjpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tY3kpO2JveC1zaGFkb3c6MCAwIDAgM3B4ICMyMmQzZWUxYX0KdGV4dGFyZWEuaW57bWluLWhlaWdodDo3MHB4O3Jlc2l6ZTp2ZXJ0aWNhbH0KdGFibGV7d2lkdGg6MTAwJTtib3JkZXItY29sbGFwc2U6Y29sbGFwc2U7Zm9udC1zaXplOjExLjVweH0KdGh7dGV4dC1hbGlnbjpsZWZ0O2NvbG9yOnZhcigtLWRpbSk7Zm9udC13ZWlnaHQ6NTAwO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4ycHg7cGFkZGluZzo3cHggOHB4OwogICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7d2hpdGUtc3BhY2U6bm93cmFwfQp0ZHtwYWRkaW5nOjhweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMTAxODIyO3ZlcnRpY2FsLWFsaWduOnRvcH0KdHI6aG92ZXIgdGR7YmFja2dyb3VuZDojMGIxMTE5fQoudHd7b3ZlcmZsb3cteDphdXRvfQoudGFne2Rpc3BsYXk6aW5saW5lLWJsb2NrO3BhZGRpbmc6MnB4IDhweDtib3JkZXItcmFkaXVzOjIwcHg7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxcHg7Ym9yZGVyOjFweCBzb2xpZDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7d2hpdGUtc3BhY2U6bm93cmFwfQoudC1jeXtjb2xvcjp2YXIoLS1jeSk7Ym9yZGVyLWNvbG9yOiMxNTVlNmI7YmFja2dyb3VuZDojMDYyMjJhfQoudC1ncm57Y29sb3I6dmFyKC0tZ3JuKTtib3JkZXItY29sb3I6IzFjNWMzYztiYWNrZ3JvdW5kOiMwODE3MGZ9Ci50LWFtYntjb2xvcjp2YXIoLS1hbWIpO2JvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6IzFhMTMwNX0KLnQtcmVke2NvbG9yOnZhcigtLW1hZyk7Ym9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMWQwYTEwfQoudC1ibHV7Y29sb3I6dmFyKC0tYmx1KTtib3JkZXItY29sb3I6IzFjM2Y3NTtiYWNrZ3JvdW5kOiMwODEzMWZ9Ci50LXB1cntjb2xvcjp2YXIoLS1wdXIpO2JvcmRlci1jb2xvcjojNDMyYTc1O2JhY2tncm91bmQ6IzEyMGMxZn0KLnQtZGlte2NvbG9yOnZhcigtLWRpbSk7Ym9yZGVyLWNvbG9yOiMyMjMwM2Y7YmFja2dyb3VuZDojMGMxMjE5fQouYmFye2hlaWdodDo1cHg7YmFja2dyb3VuZDojMGYxNzIwO2JvcmRlci1yYWRpdXM6NHB4O292ZXJmbG93OmhpZGRlbn0KLmJhciBpe2Rpc3BsYXk6YmxvY2s7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tY3kpLHZhcigtLXB1cikpfQp1bC50aWdodHttYXJnaW46NnB4IDAgMDtwYWRkaW5nLWxlZnQ6MTdweDtmb250LXNpemU6MTEuNXB4O2NvbG9yOiNiM2MxZDF9CnVsLnRpZ2h0IGxpe21hcmdpbjo0cHggMH0KcHJlLnlhbWx7YmFja2dyb3VuZDojMDUwODBjO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoxMnB4O2ZvbnQtc2l6ZToxMXB4OwogIG92ZXJmbG93OmF1dG87Y29sb3I6I2E4Y2ZlNjttYXJnaW46MDtsaW5lLWhlaWdodDoxLjU1fQoubG9ne2JhY2tncm91bmQ6IzA1MDgwYztib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6MTFweDttYXgtaGVpZ2h0OjM2MHB4O292ZXJmbG93OmF1dG87Zm9udC1zaXplOjExcHh9Ci5sb2cgZGl2e3BhZGRpbmc6MnB4IDA7Ym9yZGVyLWJvdHRvbToxcHggZG90dGVkICMxMDE4MjI7d2hpdGUtc3BhY2U6cHJlLXdyYXA7d29yZC1icmVhazpicmVhay13b3JkfQoubG9nIC50c3tjb2xvcjojM2Q0YTU4fQoubW9uby1kaW17Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTFweH0KLm1vZGFse3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDojMDAwYzt6LWluZGV4OjkwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjsKICBwYWRkaW5nOjE2cHg7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNHB4KX0KLm1ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6NjQwcHg7bWF4LWhlaWdodDo4OHZoO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7CiAgYm9yZGVyLXJhZGl1czoxNHB4O3BhZGRpbmc6MjBweH0KLm1ib3ggaDN7bWFyZ2luOjAgMCA1cHg7Zm9udC1zaXplOjE0cHg7Y29sb3I6dmFyKC0tY3kpO2xldHRlci1zcGFjaW5nOi42cHg7dGV4dC10cmFuc2Zvcm06bm9uZX0KLmZsYXNoe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JvdHRvbToyMnB4O2JhY2tncm91bmQ6IzBjMTYyMDtib3JkZXI6MXB4IHNvbGlkICMyNDM4NGQ7CiAgYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWN5KTtwYWRkaW5nOjEwcHggMTZweDtib3JkZXItcmFkaXVzOjlweDtmb250LXNpemU6MTEuNXB4O3otaW5kZXg6OTk7Ym94LXNoYWRvdzowIDE0cHggNDRweCAjMDAwYjttYXgtd2lkdGg6OTB2d30KCi8qID09PT09PT09PT09PSBSQURJQUwgRU5HSU5FID09PT09PT09PT09PSAqLwouZW5naW5lV3JhcHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAyNTBweDtnYXA6MTNweH0KQG1lZGlhKG1heC13aWR0aDoxMDAwcHgpey5lbmdpbmVXcmFwe2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQouY2FudmFzQm94e2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCA1MCUgNTAlLCMwYTE0MjAgMCUsIzA1MDgwYyA3MCUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7CiAgYm9yZGVyLXJhZGl1czoxMnB4O3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjttaW4taGVpZ2h0OjQzMHB4fQouY2FudmFzQm94IHN2Z3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG87dG91Y2gtYWN0aW9uOnBhbi15fQouZ3JpZGJne3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTtvcGFjaXR5Oi41OwogIGJhY2tncm91bmQtaW1hZ2U6bGluZWFyLWdyYWRpZW50KCMwZjFhMjYgMXB4LHRyYW5zcGFyZW50IDFweCksbGluZWFyLWdyYWRpZW50KDkwZGVnLCMwZjFhMjYgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM0cHggMzRweDttYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDQwJSx0cmFuc3BhcmVudCA3OCUpfQouZW5nVG9we3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MTJweDt0b3A6MTFweDt6LWluZGV4OjI7ZGlzcGxheTpmbGV4O2dhcDo3cHg7ZmxleC13cmFwOndyYXB9Ci5lbmdUaXRsZXtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjUwJTt0b3A6MTJweDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNTAlKTt6LWluZGV4OjI7Zm9udDo3MDAgMTNweCB2YXIoLS1zYW5zKTsKICBsZXR0ZXItc3BhY2luZzozcHg7Y29sb3I6I2M5ZDdlNjt0ZXh0LXNoYWRvdzowIDAgMThweCAjMDAwfQoubm9kZXtjdXJzb3I6cG9pbnRlcn0KLm5vZGU6aG92ZXIgY2lyY2xle2ZpbHRlcjpicmlnaHRuZXNzKDEuNSl9Ci5zaWRle2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjEzcHh9Ci5sZWdlbmQgZGl2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOiM5M2EzYjY7cGFkZGluZzozcHggMH0KLmxlZ2VuZCBpe3dpZHRoOjlweDtoZWlnaHQ6OXB4O2JvcmRlci1yYWRpdXM6OXB4O2Rpc3BsYXk6YmxvY2s7ZmxleDowIDAgOXB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2MHB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMTAxODIyO3BhZGRpbmc6NnB4IDNweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOiM5ZmIwYzQ7dGV4dC1hbGlnbjpsZWZ0fQouZGlyTGlzdCBidXR0b246aG92ZXJ7Y29sb3I6dmFyKC0tY3kpfQouZGlyTGlzdCBzcGFue2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo5LjVweH0KLnRlcm17YmFja2dyb3VuZDojMDUwODBjO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czo5cHg7cGFkZGluZzoxMHB4O2ZvbnQtc2l6ZToxMC41cHg7CiAgbWF4LWhlaWdodDoxNTBweDtvdmVyZmxvdzphdXRvO2NvbG9yOiM3ZmUwYzB9Cjwvc3R5bGU+CjwvaGVhZD4KPGJvZHk+CjwhLS0gPT09PT09PT09PT09PT09PT0gR0FURSA9PT09PT09PT09PT09PT09PSAtLT4KPGRpdiBpZD0iZ2F0ZSI+CiAgPGRpdiBjbGFzcz0idG9wYmFyIj4KICAgIDxkaXYgY2xhc3M9ImxvZ28iPkNIQUlSTUFOIDxpPkFHRU5UIE9TPC9pPjwvZGl2PgogICAgPHNwYW4gY2xhc3M9InBpbGwgbGl2ZSI+PHNwYW4gY2xhc3M9ImRvdCI+PC9zcGFuPlNFUlZFUiBMSVZFICZhbXA7IEFVRElUSU5HPC9zcGFuPgogICAgPHNwYW4gY2xhc3M9InBpbGwiPlpFUk8tVFJVU1QgQUNUSVZFPC9zcGFuPgogICAgPHNwYW4gY2xhc3M9InBpbGwiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtjb2xvcjp2YXIoLS1hbWIpO2JhY2tncm91bmQ6IzFhMTMwNSI+WkVSTy1DT1NUIERPQ1RSSU5FPC9zcGFuPgogIDwvZGl2PgoKICA8ZGl2IGNsYXNzPSJoZXJvIj4KICAgIDxkaXYgY2xhc3M9Imhlcm9DYXJkIj4KICAgICAgPGRpdj4KICAgICAgICA8c3BhbiBjbGFzcz0iYmFkZ2UiPkhFQUQgT0YgQUxMIEFHRU5UUzwvc3Bhbj4KICAgICAgICA8aDEgY2xhc3M9ImJpZyI+Tk8gU1VHQVIgQ09BVElORy48YnI+PGVtPk5PIENPTVBST01JU0UuPC9lbT48L2gxPgogICAgICAgIDxwIGNsYXNzPSJsZWRlIj5FdmVyeSBkZXRhaWwgY2hlY2tlZCwgZXZlcnkgc3ViLWFnZW50IGF1ZGl0ZWQsIGV2ZXJ5IGVudGVycHJpc2UgcmVxdWVzdCBmb3JjZWQgdGhyb3VnaCBhIHByZWNpc2UgcGVybWlzc2lvbiBmbG93LiBOb3RoaW5nIHBhaWQgZm9yLCBldmVyIOKAlCB0aGUgQ2hhaXJtYW4gcm91dGVzIGFyb3VuZCBldmVyeSBwYXl3YWxsLCBjcmVkaXQgbWV0ZXIgYW5kIHN1YnNjcmlwdGlvbiBnYXRlLjwvcD4KICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Um93Ij4KICAgICAgICAgIDxkaXYgY2xhc3M9InN0YXQiPjx1PkJhY2tlbmQ8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiIGlkPSJoc1VwIj5DSEVDS0lOR+KApjwvYj48cyBpZD0iaHNOb2RlIj7igJQ8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5TZWN1cml0eSBHYXRlPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPkxPQ0tFRDwvYj48cz5TZXJ2ZXItc2lkZSBzZXNzaW9uczwvcz48L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InN0YXQiPjx1PkNvc3QgQ2VpbGluZzwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+JDAuMDA8L2I+PHM+MCBkZXBlbmRlbmNpZXMgaW5zdGFsbGVkPC9zPjwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KCiAgICAgIDxkaXYgY2xhc3M9ImxvZ2luQm94Ij4KICAgICAgICA8aDM+T1dORVIgUE9SVEFMPC9oMz4KICAgICAgICA8ZGl2IGNsYXNzPSJzYiI+Q1JZUFRPR1JBUEhJQyBDTEVBUkFOQ0UgUkVRVUlSRUQ8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0iYm9vdE5vdGUiPkJvb3RzdHJhcCBjcmVkZW50aWFscyB3ZXJlIGdlbmVyYXRlZCBvbmNlIGJ5IHRoZSBzZXJ2ZXIgYW5kIHByaW50ZWQgdG8gaXRzIGNvbnNvbGUgLyA8Y29kZT5PV05FUl9DUkVERU5USUFMUy50eHQ8L2NvZGU+LiBSb3RhdGUgdGhlIHBhc3N3b3JkIGltbWVkaWF0ZWx5IGFmdGVyIGZpcnN0IGxvZ2luLjwvZGl2PgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3duZXIgSUQ8L3NwYW4+PGlucHV0IGlkPSJsaUlkIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0idXNlcm5hbWUiPjwvbGFiZWw+CiAgICAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9ImxpUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0iY3VycmVudC1wYXNzd29yZCIgb25rZXlkb3duPSJpZihldmVudC5rZXk9PT0nRW50ZXInKWRvTG9naW4oKSI+PC9sYWJlbD4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9IndpZHRoOjEwMCUiIG9uY2xpY2s9ImRvTG9naW4oKSI+QVVUSEVOVElDQVRFPC9idXR0b24+CiAgICAgICAgPGRpdiBjbGFzcz0iZXJyIiBpZD0ibGlFcnIiPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij5TZXNzaW9ucyBhcmUgaGVsZCBzZXJ2ZXItc2lkZSAoOGggVFRMLCBIdHRwT25seSBjb29raWUpLiBMb2cgaW4gZnJvbSBhbnkgZGV2aWNlIG9uIHRoaXMgVVJMIOKAlCBzdGF0ZSBpcyBzaGFyZWQgbGl2ZS48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0icGlsbGFycyI+CiAgICA8aDI+Q0hBSVJNQU4gPGVtPlJBRElBTCBQSUxMQVJTPC9lbT48L2gyPgogICAgPHAgY2xhc3M9InN1YiI+Rmxvb3ItYnktZmxvb3IgZW50ZXJwcmlzZSBjb21tYW5kIHdpdGggZGVkaWNhdGVkIG1pc3Npb24gbGVhZHMgYW5kIGhhcmQgb3BlcmF0aW9uYWwgc2NvcGUuPC9wPgogICAgPGRpdiBjbGFzcz0icGdyaWQiIGlkPSJoZXJvUGlsbGFycyI+PC9kaXY+CiAgPC9kaXY+CjwvZGl2PgoKPCEtLSA9PT09PT09PT09PT09PT09PSBBUFAgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImFwcCIgY2xhc3M9ImhpZGUiPgogIDxhc2lkZSBpZD0ic2lkZWJhciI+CiAgICA8ZGl2IGNsYXNzPSJhYnJhbmQiPgogICAgICA8ZGl2IGNsYXNzPSJtYXJrIj7il4k8L2Rpdj4KICAgICAgPGRpdj48Yj5DSEFJUk1BTiBPUzwvYj48c3Bhbj5WMyDCtyBMSVZFIEJBQ0tFTkQ8L3NwYW4+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxuYXYgaWQ9Im5hdiI+PC9uYXY+CiAgICA8ZGl2IGNsYXNzPSJhZm9vdCI+CiAgICAgIDxkaXY+T1dORVIgPGIgaWQ9Indob0lkIiBzdHlsZT0iY29sb3I6dmFyKC0tdHh0KSI+PC9iPjwvZGl2PgogICAgICA8ZGl2PlVQVElNRSA8c3BhbiBpZD0idXBDbG9jayIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPuKAlDwvc3Bhbj4gwrcgU1BFTkQgPHNwYW4gaWQ9InNwZW5kTWluaSIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9zcGFuPjwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIHN0eWxlPSJ3aWR0aDoxMDAlO21hcmdpbi10b3A6OHB4IiBvbmNsaWNrPSJsb2dvdXQoKSI+TE9DSyBTWVNURU08L2J1dHRvbj4KICAgIDwvZGl2PgogIDwvYXNpZGU+CiAgPG1haW4+CiAgICA8ZGl2IGNsYXNzPSJtdG9wIj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBpZD0iYnVyZ2VyIiBvbmNsaWNrPSJ0b2dnbGVTYigpIj7imLA8L2J1dHRvbj4KICAgICAgPGRpdiBjbGFzcz0iY3J1bWIiPmNoYWlybWFuLW9zIC8gPGIgaWQ9ImNydW1iIj5ob21lPC9iPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJzcCI+PC9kaXY+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj48c3BhbiBpZD0ic3luY1BpbGwiPlNZTkNFRDwvc3Bhbj48L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0idmlldyI+PC9kaXY+CiAgPC9tYWluPgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSIvYXBwLmpzIj48L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==','base64'),
  'app.js':     Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNmZjNiNmInLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNmZmIwMjAnLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzIyZDNlZScsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjYTg3N2ZmJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzMxZDY3YScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCihhc3luYyBmdW5jdGlvbigpewogIHBhaW50SGVybygpOwogIHRyeXsKICAgIGNvbnN0IGI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL2Jvb3QnLHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGNvbnN0IHQ9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlJyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCkuY2F0Y2goKCk9Pih7fSkpOwogICAgaHNVcC50ZXh0Q29udGVudD0nT05MSU5FJzsgCiAgICBpZihiLmF1dGhlZCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IFM9ci5zdGF0ZTsgZW50ZXIoKTsgfQogIH1jYXRjaChlKXsgaHNVcC50ZXh0Q29udGVudD0nT0ZGTElORSc7IGhzVXAuc3R5bGUuY29sb3I9J3ZhcigtLW1hZyknOyB9Cn0pKCk7CmZ1bmN0aW9uIHBhaW50SGVybygpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvUGlsbGFycycpLmlubmVySFRNTD1QSUxMQVJTLm1hcChwPT5gPGRpdiBjbGFzcz0icGNhcmQiPgogICA8dT5GTE9PUiAwJHtwLmlkfTwvdT48aDQ+JHtwLmljb259ICR7ZXNjKHAubmFtZSl9PC9oND48cD4ke2VzYyhwLmRlc2MpfTwvcD4KICAgJHtwLmNoaXBzLm1hcChjPT5gPHNwYW4gY2xhc3M9ImNoaXAiPiR7ZXNjKGMpfTwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gKS5qb2luKCcnKTsKfQphc3luYyBmdW5jdGlvbiBkb0xvZ2luKCl7CiAgY29uc3QgZT1saUVycjtlLnRleHRDb250ZW50PScnOwogIHRyeXsKICAgIGF3YWl0IEFQSSgnL2FwaS9sb2dpbicse2lkOmxpSWQudmFsdWUudHJpbSgpLHB3OmxpUHcudmFsdWV9KTsKICAgIGxpUHcudmFsdWU9Jyc7IGVudGVyKCk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZT09PSdBQ0NFU1MgREVOSUVEJz8nQUNDRVNTIERFTklFRC4gQ3JlZGVudGlhbCBtaXNtYXRjaCDigJQgbG9nZ2VkIENSSVQgc2VydmVyLXNpZGUuJzp4Lm1lc3NhZ2U7IH0KfQpmdW5jdGlvbiBlbnRlcigpewogIGdhdGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpOyBhcHAuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpOwogIHdob0lkLnRleHRDb250ZW50PVMub3duZXIuaWQ7IGJ1aWxkTmF2KCk7IGdvKCdob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHN0YXJ0UG9sbCgpeyBzdG9wUG9sbCgpOyBwb2xsPXNldEludGVydmFsKGFzeW5jKCk9PnsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9zdGF0ZT9zaW5jZT0nK1MucmV2LHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGlmKHIudW5jaGFuZ2VkKXsgUy50ZWxlbWV0cnk9ci50ZWxlbWV0cnk7IFMuZmxvb3JzPXIuZmxvb3JzOyB0aWNrQ2hyb21lKCk7CiAgICAgIGlmKGN1cj09PSdob21lJ3x8Y3VyPT09J2FuYWx5dGljcyd8fGN1cj09PSdzeXN0ZW0nKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgcmVuZGVyKCk7IHN5bmNQaWxsLnRleHRDb250ZW50PSdVUERBVEVEJzsgc2V0VGltZW91dCgoKT0+c3luY1BpbGwudGV4dENvbnRlbnQ9J1NZTkNFRCcsMTIwMCk7IH0KICB9Y2F0Y2goZSl7IHN5bmNQaWxsLnRleHRDb250ZW50PSdPRkZMSU5FJzsgfQp9LDMwMDApIH0KZnVuY3Rpb24gc3RvcFBvbGwoKXsgY2xlYXJJbnRlcnZhbChwb2xsKSB9CmZ1bmN0aW9uIHRpY2tDaHJvbWUoKXsKICBjb25zdCB0PVMudGVsZW1ldHJ5OwogIHVwQ2xvY2sudGV4dENvbnRlbnQ9aGhtbXNzKHQudXB0aW1lX3MpOwogIHNwZW5kTWluaS50ZXh0Q29udGVudD0nJCcrKFMuc3BlbmR8fDApLnRvRml4ZWQoMik7CiAgc3BlbmRNaW5pLnN0eWxlLmNvbG9yPVMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJzsKfQpmdW5jdGlvbiBzb2Z0UmVmcmVzaCgpeyBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+eyBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsgdHJ5eyBuLmlubmVySFRNTD1MSVZFW2ZdKCkgfWNhdGNoKGUpe30gfSkgfQpjb25zdCBMSVZFPXt9OwoKLyogLS0tLS0tLS0tLSBuYXYgLS0tLS0tLS0tLSAqLwpjb25zdCBOQVZERUY9WwogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydtaXNzaW9ucycsJ+KXjicsJ015IE1pc3Npb25zJ10sWydjb21tYW5kJywn4pauJywnQ29tbWFuZCBDb25zb2xlJ10sWyd2ZW50dXJlcycsJ+KXhicsJ1ZlbnR1cmVzICYgSWRlYXMnXSxbJ3BheScsJ+KCuScsJ1BheW1lbnRzJ11dXSwKIFsnUlVOVElNRScsW1snb3BzJywn4pa2JywnTGl2ZSBPcGVyYXRpb25zJ10sWydicmFpbicsJ+KXiCcsJ0FJIEJyYWluJ10sWyd3b3JrJywn4pymJywnQWdlbnQgV29yayddLFsncmVzZWFyY2gnLCfwn4yQJywnRGVlcCBSZXNlYXJjaCddXV0sCiBbJ0VWT0xVVElPTicsW1snZXZvbHZlJywn4p+zJywnU2VsZi1VcGdyYWRlJ10sWydza2lsbHMyJywn4pyOJywnTGVhcm5lZCBTa2lsbHMnXV1dLAogWydNT05JVE9SSU5HJyxbWyd1cHRpbWUnLCfil44nLCdVcHRpbWUgTWFyc2hhbCddLFsnbWFpbCcsJ+KciScsJ01haWwgUmVsYXknXV1dLAogWydTWVNURU0nLFtbJ3N5c3RlbScsJ+KaoScsJ0xpdmUgVGVsZW1ldHJ5J10sWydkZXZpY2VzJywn4oeEJywnRGV2aWNlcyAmIFNlc3Npb25zJ10sWyd6ZXJvY29zdCcsJ+KIhScsJ1plcm8tQ29zdCBSb3V0ZXInXSxbJ2RvY3RyaW5lJywnwqcnLCdEb2N0cmluZSAmIFNPUCddLFsnc2V0dGluZ3MnLCfimpknLCdPd25lciBTZXR0aW5ncyddXV0KXTsKZnVuY3Rpb24gYnVpbGROYXYoKXtuYXYuaW5uZXJIVE1MPU5BVkRFRi5tYXAoKFtnLGl0XSk9PmA8ZGl2IGNsYXNzPSJncnAiPiR7Z308L2Rpdj5gKwogaXQubWFwKChbaWQsaWMsbF0pPT5gPGJ1dHRvbiBkYXRhLXA9IiR7aWR9IiBvbmNsaWNrPSJnbygnJHtpZH0nKSI+PGk+JHtpY308L2k+JHtsfTwvYnV0dG9uPmApLmpvaW4oJycpKS5qb2luKCcnKX0KZnVuY3Rpb24gZ28ocCl7Y3VyPXA7Wy4uLm5hdi5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKV0uZm9yRWFjaChiPT5iLmNsYXNzTGlzdC50b2dnbGUoJ29uJyxiLmRhdGFzZXQucD09PXApKTsKIGNydW1iLnRleHRDb250ZW50PXA7cmVuZGVyKCk7Y2xvc2VTYigpO3Njcm9sbFRvKDAsMCl9CmZ1bmN0aW9uIHJlbmRlcigpeyB2aWV3LmlubmVySFRNTD1SRU5ERVJbY3VyXSgpOyBpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCk7CiAgaWYoY3VyPT09J2JyYWluJyYmdHlwZW9mIHByb3ZIaW50PT09J2Z1bmN0aW9uJylwcm92SGludCgpOwogIGlmKGN1cj09PSdwYXknJiZ0eXBlb2YgcGF5SGludD09PSdmdW5jdGlvbicpcGF5SGludCgpOyB0aWNrQ2hyb21lKCkgfQpmdW5jdGlvbiB0b2dnbGVTYigpe2NvbnN0IG89c2lkZWJhci5jbGFzc0xpc3QudG9nZ2xlKCdvcGVuJyk7CiBpZihvKXtjb25zdCBzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO3MuaWQ9J3NjcmltJztzLm9uY2xpY2s9Y2xvc2VTYjtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpfWVsc2UgY2xvc2VTYigpfQpmdW5jdGlvbiBjbG9zZVNiKCl7c2lkZWJhci5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmltJyk/LnJlbW92ZSgpfQoKLyogLS0tLS0tLS0tLSBwcmltaXRpdmVzIC0tLS0tLS0tLS0gKi8KY29uc3QgUkVOREVSPXt9OwpmdW5jdGlvbiBrcGkodixsLGMscyl7cmV0dXJuIGA8ZGl2IGNsYXNzPSJrcGkiPjx1PiR7bH08L3U+PGIgc3R5bGU9ImNvbG9yOiR7Y3x8J3ZhcigtLXR4dCknfSI+JHt2fTwvYj4ke3M/YDxzPiR7c308L3M+YDonJ308L2Rpdj5gfQpmdW5jdGlvbiBsb2dIdG1sKG4pe2lmKCFTLmxvZ3MubGVuZ3RoKXJldHVybiAnPGRpdiBjbGFzcz0ibW9uby1kaW0iPkxlZGdlciBlbXB0eS48L2Rpdj4nOwogY29uc3QgY29sPXtJTkZPOid2YXIoLS1ibHUpJyxPSzondmFyKC0tZ3JuKScsV0FSTjondmFyKC0tYW1iKScsQ1JJVDondmFyKC0tbWFnKSd9OwogcmV0dXJuICc8ZGl2IGNsYXNzPSJsb2ciPicrUy5sb2dzLnNsaWNlKDAsbikubWFwKGw9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtsLnR9PC9zcGFuPiA8c3BhbiBzdHlsZT0iY29sb3I6JHtjb2xbbC5zZXZdfSI+WyR7bC5zZXZ9XTwvc3Bhbj4gPGI+JHtlc2MobC5zcmMpfTwvYj4g4oCUICR7ZXNjKGwubXNnKX08L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+J30KZnVuY3Rpb24gZmxvb3IoaWQpe3JldHVybiBTLmZsb29ycy5maW5kKGY9PmYuaWQ9PT1pZCl8fHtoZWFsdGg6MCxsb2FkOjAsYWdlbnRzOjAsYWN0aXZlOjB9fQoKLyogLS0tLS0tLS0tLSBIT01FIC0tLS0tLS0tLS0gKi8KTElWRS5ob21lS3BpPSgpPT57CiAgY29uc3QgdD1TLnRlbGVtZXRyeSwgcGVuZD1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJykubGVuZ3RoOwogIGNvbnN0IGFjdGl2ZT1TLmFnZW50cy5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RoOwogIHJldHVybiBrcGkoYWN0aXZlKycgLyAnK1MuYWdlbnRzLmxlbmd0aCwnQWN0aXZlIFN1Yi1BZ2VudHMnLCd2YXIoLS1jeSknLGFjdGl2ZT09PVMuYWdlbnRzLmxlbmd0aD8nRnVsbCByb3N0ZXInOidERUdSQURFRCcpCiAgICtrcGkocGVuZCwnR2F0ZXMgRnJvemVuJyxwZW5kPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScscGVuZD8nQXdhaXRpbmcgY2xlYXJhbmNlJzonUXVldWUgY2xlYXInKQogICAra3BpKGhobW1zcyh0LnVwdGltZV9zKSwnU2VydmVyIFVwdGltZScsJ3ZhcigtLWdybiknLCdwaWQgJyt0LnBpZCkKICAgK2twaSh0LmF2Z19sYXRlbmN5X21zKycgbXMnLCdBdmcgTGF0ZW5jeScsdC5hdmdfbGF0ZW5jeV9tcz41MD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLGZtdCh0LnJlcXVlc3RzKSsnIHJlcXVlc3RzJyl9CkxJVkUuaG9tZUxvYWQ9KCk9PlBJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpOwogIHJldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5hY3RpdmV9LyR7Zi5hZ2VudHN9IGFndCDCtyBIJHtmLmhlYWx0aH0lIMK3IEwke2YubG9hZH0lPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5sb2FkfSU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsJHtwLmNvbG9yfSwjMjJkM2VlKSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKTsKTElWRS5ob21lVGVybT0oKT0+bG9nSHRtbCgxNCk7ClJFTkRFUi5ob21lPSgpPT57CiAgY29uc3QgdD1TLnRlbGVtZXRyeSwgcGVuZD1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJykubGVuZ3RoOwogIGNvbnN0IGluZmxvdz1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiIGRhdGEtbGl2ZT0iaG9tZUtwaSI+JHtMSVZFLmhvbWVLcGkoKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYWlybWFuJ3MgU3RhbmRpbmcgQXNzZXNzbWVudCA8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5OTyBTVUdBUiBDT0FUSU5HPC9zcGFuPjwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgICA8bGk+JHtTLm93bmVyLmJvb3RzdHJhcD8nPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkNSSVRJQ0FMOjwvYj4gYm9vdHN0cmFwIHBhc3N3b3JkIHN0aWxsIGFjdGl2ZS4gUm90YXRlIGl0IG5vdyDigJQgdGhlIHBsYWludGV4dCBjb3B5IGV4aXN0cyBvbiBkaXNrIHVudGlsIHlvdSBkby4nOidCb290c3RyYXAgY3JlZGVudGlhbCByb3RhdGVkIGFuZCBkZXN0cm95ZWQuIEdvb2QuJ308L2xpPgogICAgPGxpPiR7Uy5wYXlvdXQ/J1BheW91dCBjaGFubmVsIHNlYWxlZC4gVHJhbnNmZXJzIHJlcXVpcmUgc2lnbmF0dXJlICsgMkZBIGludGVudC4nOic8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+QkxPQ0tFUjo8L2I+IG5vIHBheW91dCBjaGFubmVsLiBFdmVyeSBmaW5hbmNpYWwgZ2F0ZSBoYXJkLWJsb2NrcyBzZXJ2ZXItc2lkZS4nfTwvbGk+CiAgICA8bGk+JHtwZW5kP2A8YiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtwZW5kfSBvcGVyYXRpb24ocykgZnJvemVuPC9iPiBwZW5kaW5nIHlvdXIgY2xlYXJhbmNlLmA6J05vIGZyb3plbiBvcGVyYXRpb25zLid9PC9saT4KICAgIDxsaT4ke1MucnVubmluZz9gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPlNZU1RFTSBSVU5OSU5HPC9iPiDigJQgJHsoUy50YXNrc3x8W10pLmZpbHRlcih0PT50LmVuYWJsZWQpLmxlbmd0aH0gc3RhbmRpbmcgb3JkZXJzIGV4ZWN1dGluZywgJHsoUy50YXNrc3x8W10pLnJlZHVjZSgoYSx0KT0+YSsodC5ydW5zfHwwKSwwKX0gam9icyBjb21wbGV0ZWQuYDonPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlNZU1RFTSBIQUxURUQ8L2I+IOKAlCBubyBhZ2VudCB3b3JrIGlzIGV4ZWN1dGluZy4gU3RhcnQgaXQgaW4gTGl2ZSBPcGVyYXRpb25zLid9PC9saT4KICAgIDxsaT5aZXJvLUNvc3Q6ICR7Uy5kZW5pYWxzLmxlbmd0aH0gcGFpZCBwYXRoKHMpIGludGVyY2VwdGVkLCAkJHtTLnNwZW5kLnRvRml4ZWQoMil9IGF1dGhvcml6ZWQgc3BlbmQsIDAgbnBtIGRlcGVuZGVuY2llcyBpbnN0YWxsZWQuPC9saT4KICAgIDxsaT5MaXZlIHN5bmMgYWN0aXZlOiAke3QubGl2ZV9zZXNzaW9uc30gZGV2aWNlIHNlc3Npb24ocykgb24gdGhpcyBpbnN0YW5jZSwgc3RhdGUgcmV2aXNpb24gJHtTLnJldn0uPC9saT4KICAgPC91bD48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBpbGxhciBMb2FkIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+REVSSVZFRCBGUk9NIFJFQUwgUFJPQ0VTUyBNRVRSSUNTPC9zcGFuPjwvaDM+CiAgICA8ZGl2IGRhdGEtbGl2ZT0iaG9tZUxvYWQiPiR7TElWRS5ob21lTG9hZCgpfTwvZGl2PjwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXZlbnVlIFRlbGVtZXRyeSA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5JTkZMT1cgJCR7Zm10KGluZmxvdyl9PC9zcGFuPjwvaDM+JHtzcGFyaygpfQogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5HcmVlbiBkYXNoZWQgbGluZSBpcyB0aGUgc3BlbmQgZmxvb3IsIGhlbGQgYXQgJDAuMDAgYnkgZG9jdHJpbmUuPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgVGVybWluYWwgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+U0VSVkVSIExFREdFUjwvc3Bhbj48L2gzPjxkaXYgZGF0YS1saXZlPSJob21lVGVybSI+JHtMSVZFLmhvbWVUZXJtKCl9PC9kaXY+PC9kaXY+YDsKfTsKZnVuY3Rpb24gc3BhcmsoKXsKICBjb25zdCB2PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkubWFwKHI9PnIuYW10KTsgY29uc3QgcHRzPSh2Lmxlbmd0aD92OlswLDBdKS5zbGljZSgtMjQpOwogIGNvbnN0IG14PU1hdGgubWF4KC4uLnB0cywxKSx3PTYwMCxoPTkwLHN0ZXA9cHRzLmxlbmd0aD4xP3cvKHB0cy5sZW5ndGgtMSk6dzsKICBjb25zdCBkPXB0cy5tYXAoKHAsaSk9PmAke2k/J0wnOidNJ30keyhpKnN0ZXApLnRvRml4ZWQoMSl9LCR7KGgtKHAvbXgpKihoLTEyKS02KS50b0ZpeGVkKDEpfWApLmpvaW4oJyAnKTsKICByZXR1cm4gYDxzdmcgdmlld0JveD0iMCAwICR7d30gJHtofSIgc3R5bGU9IndpZHRoOjEwMCU7aGVpZ2h0OjkwcHgiPgogICA8ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InNnIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMjJkM2VlNjYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMyMmQzZWUwMCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPgogICAke1swLDEsMiwzXS5tYXAoaT0+YDxsaW5lIHgxPSIwIiB5MT0iJHtpKjMwfSIgeDI9IiR7d30iIHkyPSIke2kqMzB9IiBzdHJva2U9IiMxMDFhMjQiLz5gKS5qb2luKCcnKX0KICAgPHBhdGggZD0iJHtkfSBMJHt3fSwke2h9IEwwLCR7aH0gWiIgZmlsbD0idXJsKCNzZykiLz48cGF0aCBkPSIke2R9IiBzdHJva2U9IiMyMmQzZWUiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMiIvPgogICA8bGluZSB4MT0iMCIgeTE9IiR7aC02fSIgeDI9IiR7d30iIHkyPSIke2gtNn0iIHN0cm9rZT0iIzMxZDY3YSIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0IiBzdHJva2Utd2lkdGg9IjEuNCIvPjwvc3ZnPmA7Cn0KCi8qIC0tLS0tLS0tLS0gTElWRSBURUxFTUVUUlkgLS0tLS0tLS0tLSAqLwpMSVZFLnN5cz0oKT0+e2NvbnN0IHQ9Uy50ZWxlbWV0cnk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICR7a3BpKHQucnNzX21iKycgTUInLCdQcm9jZXNzIFJTUycsJ3ZhcigtLWN5KScsJ2hlYXAgJyt0LmhlYXBfbWIrJy8nK3QuaGVhcF90b3RhbF9tYisnIE1CJyl9CiAgJHtrcGkodC5sb2FkMSwnTG9hZCBBdmcgMW0nLHQubG9hZDE+dC5jcHVzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsdC5jcHVzKycgY3B1cyDCtyA1bSAnK3QubG9hZDUpfQogICR7a3BpKHQuc3lzX21lbV9wY3QrJyUnLCdTeXN0ZW0gTWVtb3J5Jyx0LnN5c19tZW1fcGN0Pjg1Pyd2YXIoLS1tYWcpJzondmFyKC0tYW1iKScsJ2hvc3QgJyt0Lmhvc3RuYW1lKX0KICAke2twaShmbXQodC5yZXF1ZXN0cyksJ0hUVFAgUmVxdWVzdHMnLCd2YXIoLS1ibHUpJyxmbXQodC5hcGlfY2FsbHMpKycgYXBpIMK3ICcrdC5lcnJvcnMrJyBlcnJvcnMnKX0KIDwvZGl2PgogPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlByb2Nlc3MgRmFjdHM8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij5SdW50aW1lPC90ZD48dGQ+JHt0Lm5vZGV9IMK3ICR7dC5wbGF0Zm9ybX08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5QSUQ8L3RkPjx0ZD4ke3QucGlkfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlVwdGltZTwvdGQ+PHRkPiR7aGhtbXNzKHQudXB0aW1lX3MpfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF2ZyBsYXRlbmN5PC90ZD48dGQ+JHt0LmF2Z19sYXRlbmN5X21zfSBtcyAobGFzdCA1MDAgcmVxKTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF1dGggZmFpbHVyZXM8L3RkPjx0ZCBzdHlsZT0iY29sb3I6JHt0LmF1dGhfZmFpbHVyZXM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7dC5hdXRoX2ZhaWx1cmVzfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxpdmUgc2Vzc2lvbnM8L3RkPjx0ZD4ke3QubGl2ZV9zZXNzaW9uc30gb2YgJHt0LnRvdGFsX3Nlc3Npb25zfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlN0YXRlIGZpbGU8L3RkPjx0ZD4keyh0LmRiX2J5dGVzLzEwMjQpLnRvRml4ZWQoMSl9IEtCIMK3IHJldiAke3Quc3RhdGVfcmV2fTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlNlc3Npb25zPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWdybiI+RFVSQUJMRSDCtyAzMGQgVFRMPC9zcGFuPjwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1vbml0b3JzPC90ZD48dGQ+JHt0Lm1vbml0b3JzfHwwfSBib3VuZCDCtyA8c3BhbiBzdHlsZT0iY29sb3I6JHt0Lm1vbml0b3JzX2Rvd24/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7dC5tb25pdG9yc19kb3dufHwwfSBkb3duPC9zcGFuPjwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPk1haWwgcmVsYXk8L3RkPjx0ZD4ke3Quc210cF9yZWFkeT9gPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+QVJNRUQ8L3NwYW4+ICR7dC5tYWlsX3NlbnR9IHNlbnQgLyAke3QubWFpbF9mYWlsZWR9IGZhaWxlZGA6JzxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPk9GRkxJTkUg4oCUIGludGVudCBvbmx5PC9zcGFuPid9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RGVwZW5kZW5jaWVzPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWdybiI+MCBJTlNUQUxMRUQgwrcgJDAuMDA8L3NwYW4+PC90ZD48L3RyPgogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SG90IFBhdGhzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgJHt0LmhvdF9wYXRocy5tYXAoKFtwLGNdKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhwKX08L3RkPjx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+JHtmbXQoYyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+Q291bnRlcnMgYXJlIHJlYWwsIGNvbGxlY3RlZCBpbi1wcm9jZXNzIHNpbmNlIGJvb3QuIFRoZXkgcmVzZXQgd2hlbiB0aGUgc2VydmVyIHJlc3RhcnRzLjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGVyaXZlZCBGbG9vciBIZWFsdGg8L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7cmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmhlYWx0aH0lIGhlYWx0aCDCtyAke2YubG9hZH0lIGxvYWQ8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmhlYWx0aH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5FYWNoIGZsb29yJ3MgaGVhbHRoIGlzIGNvbXB1dGVkIGZyb20gcmVhbCBpbnB1dHM6IGF1dGggZmFpbHVyZXMgYW5kIGRvY3RyaW5lIGRlbmlhbHMgaGl0IFNlY3VyaXR5OyBsb2FkIGF2ZXJhZ2UgYW5kIFJTUyBoaXQgT3BlcmF0aW9uczsgSFRUUCBlcnJvcnMgYW5kIGZyb3plbiBnYXRlcyBoaXQgRW5naW5lZXJpbmc7IHN0YXRlLWZpbGUgc2l6ZSBoaXRzIERhdGE7IGF1dGhvcml6ZWQgc3BlbmQgYW5kIHBheW91dCBzdGF0dXMgaGl0IFN0cmF0ZWd5LiBTdGFmZmluZyByYXRpbyBzY2FsZXMgYWxsIGZpdmUuIFRoZXNlIG1vdmUgd2hlbiB0aGUgc3lzdGVtIGFjdHVhbGx5IG1vdmVzLjwvZGl2PjwvZGl2PmB9ClJFTkRFUi5zeXN0ZW09KCk9PmA8ZGl2IGRhdGEtbGl2ZT0ic3lzIj4ke0xJVkUuc3lzKCl9PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gRU5HSU5FIC0tLS0tLS0tLS0gKi8KUkVOREVSLmVuZ2luZT0oKT0+YAogPGRpdiBjbGFzcz0iZW5naW5lV3JhcCI+PGRpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0icGFkZGluZzoxMXB4IDEzcHg7bWFyZ2luLWJvdHRvbToxMXB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGIgc3R5bGU9ImxldHRlci1zcGFjaW5nOjJweDtmb250LXNpemU6MTJweCI+T1BUSU1BTCBFTkdJTkU8L2I+PHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5LTk9XTEVER0UgQ09SRTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gJHtlbmdGb2N1cz8nJzoncCd9IiBvbmNsaWNrPSJlbmdGb2N1cz1udWxsO2RyYXdFbmdpbmUoKSI+UmFkaWFsPC9idXR0b24+CiAgICR7UElMTEFSUy5tYXAocD0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSAke2VuZ0ZvY3VzPT1wLmlkPydwJzonJ30iIG9uY2xpY2s9ImVuZ0ZvY3VzPSR7cC5pZH07ZHJhd0VuZ2luZSgpIj4ke3AuaWNvbn08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICA8L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYW52YXNCb3giPjxkaXYgY2xhc3M9ImdyaWRiZyI+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImVuZ1RvcCI+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSIgaWQ9ImVuZ01vZGUiPlJBRElBTCDCtyBBTEwgRkxPT1JTPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJlbmdUaXRsZSIgaWQ9ImVuZ1RpdGxlIj5DSEFJUk1BTiBDT1JFPC9kaXY+PGRpdiBpZD0iZW5nU3ZnIj48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48aDM+RW5naW5lIFRlcm1pbmFsPC9oMz4KICAgPGRpdiBjbGFzcz0idGVybSIgaWQ9ImVuZ1Rlcm0iPmNoYWlybWFuLW9zIDo6IGVuZ2luZSByZWFkeSDCtyAke1MuYWdlbnRzLmxlbmd0aH0gbm9kZXMgYm91bmQgwrcgY29zdCBjZWlsaW5nICQwLjAwCmF3YWl0aW5nIG5vZGUgc2VsZWN0aW9u4oCmPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgY2xhc3M9InNpZGUiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MZW5zPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5FbnRpdHk8L3NwYW4+PHNlbGVjdCBjbGFzcz0iaW4iIGlkPSJsZW5zRW50IiBvbmNoYW5nZT0iZHJhd0VuZ2luZSgpIj4KICAgIDxvcHRpb24gdmFsdWU9ImFsbCI+QWxsPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iYWN0aXZlIj5BY3RpdmUgb25seTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9InN1c3AiPlN1c3BlbmRlZCBvbmx5PC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luOjAiPjxzcGFuPkZsb29yPC9zcGFuPjxzZWxlY3QgY2xhc3M9ImluIiBvbmNoYW5nZT0iZW5nRm9jdXM9dGhpcy52YWx1ZT09PSdhbGwnP251bGw6K3RoaXMudmFsdWU7ZHJhd0VuZ2luZSgpIj4KICAgIDxvcHRpb24gdmFsdWU9ImFsbCI+QWxsIGZsb29yczwvb3B0aW9uPiR7UElMTEFSUy5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iICR7ZW5nRm9jdXM9PXAuaWQ/J3NlbGVjdGVkJzonJ30+JHtwLmlkfSDCtyAke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MZWdlbmQ8L2gzPjxkaXYgY2xhc3M9ImxlZ2VuZCI+CiAgICR7UElMTEFSUy5tYXAocD0+YDxkaXY+PGkgc3R5bGU9ImJhY2tncm91bmQ6JHtwLmNvbG9yfTtib3gtc2hhZG93OjAgMCA4cHggJHtwLmNvbG9yfSI+PC9pPiR7cC5uYW1lfTwvZGl2PmApLmpvaW4oJycpfQogICA8ZGl2PjxpIHN0eWxlPSJiYWNrZ3JvdW5kOiNlNmVlZjc7Ym94LXNoYWRvdzowIDAgOHB4ICNmZmYiPjwvaT5DaGFpcm1hbiBDb3JlPC9kaXY+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRpcmVjdG9yeSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1MuYWdlbnRzLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0iZGlyTGlzdCI+JHtTLmFnZW50cy5tYXAoYT0+YDxidXR0b24gb25jbGljaz0icGlja05vZGUoJyR7YS5pZH0nKSI+JHtlc2MoYS5uYW1lKX08c3Bhbj4ke1BJTExBUlMuZmluZChwPT5wLmlkPT1hLnBpbGxhcklkKS5pY29ufTwvc3Bhbj48L2J1dHRvbj5gKS5qb2luKCcnKXx8JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5lbXB0eTwvZGl2Pid9PC9kaXY+PC9kaXY+CiA8L2Rpdj48L2Rpdj5gOwpmdW5jdGlvbiBkcmF3RW5naW5lKCl7CiAgY29uc3QgYm94PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdTdmcnKTsgaWYoIWJveClyZXR1cm47CiAgY29uc3QgZW50PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsZW5zRW50Jyk/LnZhbHVlfHwnYWxsJzsKICBsZXQgbGlzdD1TLmFnZW50cy5maWx0ZXIoYT0+ZW50PT09J2FsbCd8fChlbnQ9PT0nYWN0aXZlJz9hLnN0YXR1cz09PSdBQ1RJVkUnOmEuc3RhdHVzIT09J0FDVElWRScpKTsKICBjb25zdCBmbG9vcnM9ZW5nRm9jdXM/UElMTEFSUy5maWx0ZXIocD0+cC5pZD09PWVuZ0ZvY3VzKTpQSUxMQVJTOwogIGlmKGVuZ0ZvY3VzKWxpc3Q9bGlzdC5maWx0ZXIoYT0+YS5waWxsYXJJZD09PWVuZ0ZvY3VzKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nTW9kZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzPydGT0NVUyDCtyBGTE9PUiAwJytlbmdGb2N1czonUkFESUFMIMK3IEFMTCBGTE9PUlMnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdUaXRsZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzP1BJTExBUlMuZmluZChwPT5wLmlkPT09ZW5nRm9jdXMpLm5hbWUudG9VcHBlckNhc2UoKTonQ0hBSVJNQU4gQ09SRSc7CiAgY29uc3QgVz05MDAsSD01NjAsY3g9Vy8yLGN5PUgvMjsgbGV0IGh1YnM9JycsbGlua3M9Jycsbm9kZXM9JycscmluZ3M9Jyc7CiAgWzE1MCwyMTUsMjY1XS5mb3JFYWNoKHI9PnJpbmdzKz1gPGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iJHtyfSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTAxYzI4IiBzdHJva2UtZGFzaGFycmF5PSIzIDYiLz5gKTsKICBjb25zdCBuPWZsb29ycy5sZW5ndGg7CiAgZmxvb3JzLmZvckVhY2goKHAsaSk9PnsKICAgIGNvbnN0IGFuZz0oLTkwKygzNjAvbikqaSkqTWF0aC5QSS8xODAsaHg9Y3grMTUwKk1hdGguY29zKGFuZyksaHk9Y3krMTUwKk1hdGguc2luKGFuZyk7CiAgICBsaW5rcys9YDxsaW5lIHgxPSIke2N4fSIgeTE9IiR7Y3l9IiB4Mj0iJHtoeH0iIHkyPSIke2h5fSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iLjU1IiBzdHJva2Utd2lkdGg9IjEuNCIvPmA7CiAgICBodWJzKz1gPGcgY2xhc3M9Im5vZGUiIG9uY2xpY2s9ImVuZ0ZvY3VzPSR7ZW5nRm9jdXM/J251bGwnOnAuaWR9O2RyYXdFbmdpbmUoKSI+CiAgICAgPGNpcmNsZSBjeD0iJHtoeH0iIGN5PSIke2h5fSIgcj0iMTciIGZpbGw9IiMwNzBjMTIiIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgPHRleHQgeD0iJHtoeH0iIHk9IiR7aHkrNH0iIGZvbnQtc2l6ZT0iMTMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPiR7cC5pY29ufTwvdGV4dD4KICAgICA8dGV4dCB4PSIke2h4fSIgeT0iJHtoeSszMn0iIGZvbnQtc2l6ZT0iOS41IiBmaWxsPSIke3AuY29sb3J9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AubmFtZS5zcGxpdCgnICcpWzBdLnRvVXBwZXJDYXNlKCl9PC90ZXh0PjwvZz5gOwogICAgY29uc3Qga2lkcz1saXN0LmZpbHRlcihhPT5hLnBpbGxhcklkPT09cC5pZCk7CiAgICBraWRzLmZvckVhY2goKGEsaik9PnsKICAgICAgY29uc3Qgc3ByZWFkPWVuZ0ZvY3VzP01hdGguUEkqMS42Ok1hdGguUEkvKG4qMS4xNSk7CiAgICAgIGNvbnN0IHQ9a2lkcy5sZW5ndGg+MT8oai8oa2lkcy5sZW5ndGgtMSktLjUpOjAsIGFhPWFuZyt0KnNwcmVhZCwgUj1lbmdGb2N1cz8yMzA6KGolMj8yNjU6MjE1KTsKICAgICAgY29uc3QgeD1jeCtSKk1hdGguY29zKGFhKSx5PWN5K1IqTWF0aC5zaW4oYWEpLGRlYWQ9YS5zdGF0dXMhPT0nQUNUSVZFJzsKICAgICAgbGlua3MrPWA8bGluZSB4MT0iJHtoeH0iIHkxPSIke2h5fSIgeDI9IiR7eH0iIHkyPSIke3l9IiBzdHJva2U9IiR7ZGVhZD8nIzI0MzA0MCc6cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIke2RlYWQ/LjM6LjM1fSIgc3Ryb2tlLXdpZHRoPSIxIi8+YDsKICAgICAgbm9kZXMrPWA8ZyBjbGFzcz0ibm9kZSIgb25jbGljaz0icGlja05vZGUoJyR7YS5pZH0nKSI+PHRpdGxlPiR7ZXNjKGEubmFtZSl9PC90aXRsZT4KICAgICAgIDxjaXJjbGUgY3g9IiR7eH0iIGN5PSIke3l9IiByPSI5IiBmaWxsPSIke2RlYWQ/JyMwYjExMTknOicjMDcwYzEyJ30iIHN0cm9rZT0iJHtkZWFkPycjMzM0NDVhJzpwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIxLjYiLz4KICAgICAgIDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSszLjR9IiBmb250LXNpemU9IjguNSIgZmlsbD0iJHtkZWFkPycjNTQ2NDc3JzpwLmNvbG9yfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+QTwvdGV4dD4KICAgICAgICR7ZW5nRm9jdXM/YDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSsyMX0iIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzdkOGI5YyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtlc2MoYS5uYW1lLnNsaWNlKDAsMTYpKX08L3RleHQ+YDonJ308L2c+YDsKICAgIH0pOwogIH0pOwogIGJveC5pbm5lckhUTUw9YDxzdmcgdmlld0JveD0iMCAwICR7V30gJHtIfSI+CiAgIDxkZWZzPjxyYWRpYWxHcmFkaWVudCBpZD0iY29yZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZWFmNmZmIi8+PHN0b3Agb2Zmc2V0PSIuNTUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwYjJiMzYiLz48L3JhZGlhbEdyYWRpZW50PgogICA8ZmlsdGVyIGlkPSJnbG93Ij48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI1IiByZXN1bHQ9ImIiLz48ZmVNZXJnZT48ZmVNZXJnZU5vZGUgaW49ImIiLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PC9kZWZzPgogICAke3JpbmdzfSR7bGlua3N9PGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iMzQiIGZpbGw9InVybCgjY29yZSkiIGZpbHRlcj0idXJsKCNnbG93KSIgb3BhY2l0eT0iLjkyIi8+CiAgIDxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjQ2IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMmQzZWU0NCIvPgogICA8dGV4dCB4PSIke2N4fSIgeT0iJHtjeSszfSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzA0MTQxYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC13ZWlnaHQ9IjcwMCI+Q09SRTwvdGV4dD4KICAgJHtodWJzfSR7bm9kZXN9PC9zdmc+YDsKfQpmdW5jdGlvbiBwaWNrTm9kZShpZCl7Y29uc3QgYT1TLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCk7aWYoIWEpcmV0dXJuOwogY29uc3QgdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nVGVybScpOwogaWYodCl0LnRleHRDb250ZW50PWBjaGFpcm1hbi1vcyA6OiBub2RlICR7YS5pZH1cbm5hbWUgICAgICR7YS5uYW1lfVxuZmxvb3IgICAgJHthLnBpbGxhcklkfSDCtyAke1BJTExBUlMuZmluZChwPT5wLmlkPT1hLnBpbGxhcklkKS5uYW1lfVxuc3RhdHVzICAgJHthLnN0YXR1c31cbmNvc3QgICAgICR7YS5jb3N0fVxudG9vbHMgICAgJHthLnRvb2xzLmpvaW4oJywgJyl9XG5zY29wZSAgICAke2Eucm9sZX1gOwogc2hvd1lhbWwoaWQpfQoKLyogLS0tLS0tLS0tLSBHQVRFUyAtLS0tLS0tLS0tICovClJFTkRFUi5nYXRlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIFBlcm1pc3Npb24gR2F0ZSA8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj40LVNURVAgU09QIMK3IFNFUlZFUiBFTkZPUkNFRDwvc3Bhbj48L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wZXJhdGlvbiBUaXRsZTwvc3Bhbj48aW5wdXQgaWQ9ImdUaXRsZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iRGVwbG95IHByaWNpbmctc2VydmljZSB2Mi40Ij48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNsYXNzPC9zcGFuPjxzZWxlY3QgaWQ9ImdDbGFzcyIgY2xhc3M9ImluIj4KICAgIDxvcHRpb24+REVQTE9ZTUVOVDwvb3B0aW9uPjxvcHRpb24+REIgU0NIRU1BIENIQU5HRTwvb3B0aW9uPjxvcHRpb24+Q09ERSBNT0RJRklDQVRJT048L29wdGlvbj4KICAgIDxvcHRpb24+RklOQU5DSUFMIFRSQU5TRkVSPC9vcHRpb24+PG9wdGlvbj5BQ0NFU1MgR1JBTlQ8L29wdGlvbj48b3B0aW9uPkVYVEVSTkFMIFRPT0wgQURPUFRJT048L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MSDCtyBPYmplY3RpdmUgJmFtcDsgc3VjY2VzcyBjcml0ZXJpYTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdPYmoiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjIgwrcgQWdlbnRzIC8gdG9vbHMgYXNzaWduZWQgJmFtcDsgd2h5PC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ0p1c3QiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjMgwrcgUm9sbGJhY2sgJmFtcDsgc2FmZWd1YXJkczwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdTYWZlIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CbGFzdCBSYWRpdXM8L3NwYW4+PHNlbGVjdCBpZD0iZ1Jpc2siIGNsYXNzPSJpbiI+PG9wdGlvbj5MT1c8L29wdGlvbj48b3B0aW9uPk1FRElVTTwvb3B0aW9uPjxvcHRpb24+SElHSDwvb3B0aW9uPjxvcHRpb24+U0VWRVJFPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub29sIENvc3QgLyBDcmVkaXRzIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0iZ0Nvc3QiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPSIwIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlZhbHVlIGF0IFJpc2sgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJnQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgbWluPSIwIiB2YWx1ZT0iMCI+PC9sYWJlbD48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyZWUgQWx0ZXJuYXRpdmUgUm91dGUgKHJlcXVpcmVkIGlmIGNvc3QgJmd0OyAwKTwvc3Bhbj48aW5wdXQgaWQ9ImdGcmVlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJPcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIHBhdGgiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJhaXNlR2F0ZSgpIj5TVUJNSVQgRk9SIE9XTkVSIENMRUFSQU5DRTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgUXVldWUgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmdhdGVzLmxlbmd0aH08L3NwYW4+PC9oMz4KICAke1MuZ2F0ZXMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+T3BlcmF0aW9uPC90aD48dGg+Q2xhc3M8L3RoPjx0aD5SaXNrPC90aD48dGg+Q29zdDwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZ2F0ZXMubWFwKGc9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtnLmlkfTwvdGQ+PHRkPiR7ZXNjKGcudGl0bGUpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2cudH08L2Rpdj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtnLmNsc308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtbJ0hJR0gnLCdTRVZFUkUnXS5pbmNsdWRlcyhnLnJpc2spPyd0LXJlZCc6Zy5yaXNrPT09J01FRElVTSc/J3QtYW1iJzondC1ncm4nfSI+JHtnLnJpc2t9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPiR7Zy5jb3N0PyckJytnLmNvc3Q6J0ZSRUUnfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2cuc3RhdHVzPT09J0FQUFJPVkVEJz8ndC1ncm4nOmcuc3RhdHVzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtnLnN0YXR1c308L3NwYW4+PC90ZD4KICAgPHRkPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ib3BlbkdhdGUoJyR7Zy5pZH0nKSI+UmV2aWV3PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gZ2F0ZXMgcmFpc2VkLiBOb3RoaW5nIGlzIGV4ZWN1dGluZy48L2Rpdj4nfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHJhaXNlR2F0ZSgpewogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ2F0ZScse3RpdGxlOmdUaXRsZS52YWx1ZS50cmltKCksY2xzOmdDbGFzcy52YWx1ZSxvYmo6Z09iai52YWx1ZS50cmltKCksCiAgICBqdXN0OmdKdXN0LnZhbHVlLnRyaW0oKSxzYWZlOmdTYWZlLnZhbHVlLnRyaW0oKSxyaXNrOmdSaXNrLnZhbHVlLGNvc3Q6K2dDb3N0LnZhbHVlfHwwLGFtdDorZ0FtdC52YWx1ZXx8MCxmcmVlOmdGcmVlLnZhbHVlLnRyaW0oKX0pOwogICByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytyLmlkKycgcmFpc2VkIMK3IGZyb3plbiBzZXJ2ZXItc2lkZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gb3BlbkdhdGUoaWQpewogIGNvbnN0IGc9Uy5nYXRlcy5maW5kKHg9PnguaWQ9PT1pZCk7CiAgY29uc3QgZmluQmxvY2s9Zy5jbHM9PT0nRklOQU5DSUFMIFRSQU5TRkVSJyYmIVMucGF5b3V0LCBjb3N0QmxvY2s9Zy5jb3N0PjA7CiAgbW9kYWwoYDxoMz4ke2VzYyhnLnRpdGxlKX08L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4ke2cuaWR9IMK3ICR7Zy5jbHN9IMK3IHJhaXNlZCAke2cudH08L2Rpdj4KICAke2ZpbkJsb2NrP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPjxiPkhBUkQgQkxPQ0suPC9iPiBGaW5hbmNpYWwgdHJhbnNmZXIgd2l0aCBubyBwYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRoZSBzZXJ2ZXIgd2lsbCByZWplY3QgYXBwcm92YWwuPC9kaXY+YDonJ30KICAke2Nvc3RCbG9jaz9gPGRpdiBjbGFzcz0id2FybmJveCI+PGI+WkVSTy1DT1NUIERPQ1RSSU5FIEZMQUcuPC9iPiBUaGlzIGRlbWFuZHMgJCR7Zy5jb3N0fS4gVGhlIENoYWlybWFuIGRvZXMgbm90IHBheS4gQXBwcm92aW5nIGlzIGFuIGV4cGxpY2l0IE93bmVyIG92ZXJyaWRlLiBGcmVlIHJvdXRlIG9uIHJlY29yZDogPGVtPiR7ZXNjKGcuZnJlZXx8J25vbmUnKX08L2VtPjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjEgwrcgT2JqZWN0aXZlPC9oMz48ZGl2PiR7ZXNjKGcub2JqKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MiDCtyBBZ2VudCBKdXN0aWZpY2F0aW9uPC9oMz48ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcCI+JHtlc2MoZy5qdXN0KX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MyDCtyBTYWZlZ3VhcmRzICZhbXA7IFJvbGxiYWNrPC9oMz48ZGl2PiR7ZXNjKGcuc2FmZSl9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48c3BhbiBjbGFzcz0idGFnICR7Zy5yaXNrPT09J0xPVyc/J3QtZ3JuJzondC1yZWQnfSI+QkxBU1QgJHtnLnJpc2t9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPkNPU1QgJHtnLmNvc3Q/JyQnK2cuY29zdDonJDAuMDAnfTwvc3Bhbj4KICAgJHtnLmFtdD9gPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+QVQgUklTSyAkJHtmbXQoZy5hbXQpfTwvc3Bhbj5gOicnfQogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5zdGF0dXM9PT0nQVBQUk9WRUQnPyd0LWdybic6Zy5zdGF0dXM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke2cuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAke2cuc3RhdHVzPT09J1BFTkRJTkcnP2A8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjQgwrcgT3duZXIgY3J5cHRvZ3JhcGhpYyBjbGVhcmFuY2Ug4oCUIHJlLWVudGVyIHBhc3N3b3JkPC9zcGFuPgogICA8aW5wdXQgaWQ9ImdQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PGRpdiBjbGFzcz0iZXJyIiBpZD0iZ0VyciI+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiAke2ZpbkJsb2NrPydkaXNhYmxlZCc6Jyd9IG9uY2xpY2s9ImRlY2lkZSgnJHtnLmlkfScsMSkiPiR7Y29zdEJsb2NrPydPVkVSUklERSAmYW1wOyBBVVRIT1JJWkUnOidBVVRIT1JJWkUgRVhFQ1VUSU9OJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWNpZGUoJyR7Zy5pZH0nLDApIj5ERU5ZICZhbXA7IFRFUk1JTkFURTwvYnV0dG9uPgogICAke2Nvc3RCbG9jaz9gPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXJvdXRlKCcke2cuaWR9JykiPlJFUk9VVEUgRlJFRTwvYnV0dG9uPmA6Jyd9CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmAKICA6YDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5SZXNvbHZlZCAke2VzYyhnLnJlc29sdmVkfHwnJyl9PC9zcGFuPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmB9YCk7Cn0KYXN5bmMgZnVuY3Rpb24gZGVjaWRlKGlkLG9rKXsKICBjb25zdCBlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnRXJyJyk7IGUudGV4dENvbnRlbnQ9Jyc7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9kZWNpZGUnLHtpZCxvazohIW9rLHB3OmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnUHcnKS52YWx1ZX0pOwogICAgY2xvc2VNb2RhbCgpOyByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytpZCsnIHJlc29sdmVkJyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVyb3V0ZShpZCl7IGF3YWl0IEFQSSgnL2FwaS9nYXRlL3Jlcm91dGUnLHtpZH0pOyBjbG9zZU1vZGFsKCk7IHJlbmRlcigpOyBmbGFzaCgnUmVyb3V0ZWQgwrcgJDAuMDAnKSB9CgovKiAtLS0tLS0tLS0tIEFHRU5UUyAtLS0tLS0tLS0tICovClJFTkRFUi5hZ2VudHM9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21taXNzaW9uIEFnZW50PC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5hbWU8L3NwYW4+PGlucHV0IGlkPSJhTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iTGVkZ2VyIFNlbnRpbmVsIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGlsbGFyPC9zcGFuPjxzZWxlY3QgaWQ9ImFQaWwiIGNsYXNzPSJpbiI+JHtQSUxMQVJTLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSI+JHtwLmlkfSDCtyAke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3BlcmF0aW9uYWwgU2NvcGU8L3NwYW4+PHRleHRhcmVhIGlkPSJhUm9sZSIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QZXJtaXR0ZWQgVG9vbHMgKGNvbW1hIHNlcGFyYXRlZCk8L3NwYW4+PGlucHV0IGlkPSJhVG9vbHMiIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvc3QgUG9saWN5PC9zcGFuPjxzZWxlY3QgaWQ9ImFDb3N0IiBjbGFzcz0iaW4iPgogICA8b3B0aW9uPkZSRUUtVElFUi1PTkxZPC9vcHRpb24+PG9wdGlvbj5TRUxGLUhPU1RFRC1PTkxZPC9vcHRpb24+PG9wdGlvbj5PV05FUi1PVkVSUklERS1QQUlEPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29tbWlzc2lvbigpIj5DT01NSVNTSU9OICZhbXA7IEJJTkQ8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3N0ZXIgRGlzdHJpYnV0aW9uPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpLG09TWF0aC5tYXgoMSwuLi5TLmZsb29ycy5tYXAoeD0+eC5hZ2VudHMpKTsKICAgcmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuYWdlbnRzL20qMTAwfSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BbGwgYWdlbnRzIGluaGVyaXQgdGhlIFplcm8tQ29zdCBEb2N0cmluZSB1bmxlc3Mgc2V0IHRvIE9XTkVSLU9WRVJSSURFLVBBSUQuPC9kaXY+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QWN0aXZlIFJvc3RlciA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aH0gQUNUSVZFPC9zcGFuPjwvaDM+CiAke1MuYWdlbnRzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPkFnZW50PC90aD48dGg+Rmxvb3I8L3RoPjx0aD5Ub29sczwvdGg+PHRoPkNvc3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke1MuYWdlbnRzLm1hcChhPT57Y29uc3QgcD1QSUxMQVJTLmZpbmQoeD0+eC5pZD09YS5waWxsYXJJZCk7cmV0dXJuIGA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLmlkfTwvdGQ+CiAgPHRkPjxiPiR7ZXNjKGEubmFtZSl9PC9iPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhhLnJvbGUpfTwvZGl2PjwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmNsc30iPiR7cC5pY29ufSAke2EucGlsbGFySWR9PC9zcGFuPjwvdGQ+CiAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLnRvb2xzLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2EuY29zdD09PSdPV05FUi1PVkVSUklERS1QQUlEJz8ndC1hbWInOid0LWdybid9Ij4ke2EuY29zdH08L3NwYW4+PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2Euc3RhdHVzPT09J0FDVElWRSc/J3QtZ3JuJzondC1kaW0nfSI+JHthLnN0YXR1c308L3NwYW4+PC90ZD4KICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJzaG93WWFtbCgnJHthLmlkfScpIj5ZQU1MPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nKCcke2EuaWR9JykiPiR7YS5zdGF0dXM9PT0nQUNUSVZFJz8nU3VzcGVuZCc6J1JlaW5zdGF0ZSd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbCgnJHthLmlkfScpIj5LaWxsPC9idXR0b24+PC90ZD48L3RyPmB9KS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Um9zdGVyIGVtcHR5LjwvZGl2Pid9PC9kaXY+YDsKZnVuY3Rpb24geWFtbEZvcihhKXtjb25zdCBwPVBJTExBUlMuZmluZCh4PT54LmlkPT1hLnBpbGxhcklkKTsKIHJldHVybiBgQWdlbnRfRGVmaW5pdGlvbjoKICBOYW1lOiAiJHthLm5hbWV9IgogIFBpbGxhcjogIiR7cC5uYW1lfSIKICBSb2xlOiAiJHthLnJvbGV9IgogIFBlcm1pdHRlZF9Ub29sczogWyR7YS50b29scy5tYXAodD0+YCIke3R9ImApLmpvaW4oJywgJyl9XQogIFN1cGVydmlzb3I6ICJDaGFpcm1hbiBBZ2VudCBPUyIKICBBZ2VudF9JRDogIiR7YS5pZH0iCiAgQ29zdF9Qb2xpY3k6ICIke2EuY29zdH0iCiAgQ29tbWlzc2lvbmVkOiAiJHthLnR9IgogIEluc3RydWN0aW9uOiB8CiAgICBFeGVjdXRlIHRhc2tzIHN0cmljdGx5IHdpdGhpbiBzY29wZS4gUmVwb3J0IGFsbCBsb2dzLCBhbm9tYWxpZXMgYW5kCiAgICBjb21wbGV0aW9uIG1ldHJpY3MgZGlyZWN0bHkgdG8gdGhlIENoYWlybWFuIHRlcm1pbmFsLiBEbyBub3QgYXR0ZW1wdAogICAgdW5hcHByb3ZlZCBzaWRlIGVmZmVjdHMuCiAgICBaRVJPLUNPU1QgRE9DVFJJTkU6IG5ldmVyIHB1cmNoYXNlLCBzdWJzY3JpYmUsIG9yIGNvbnN1bWUgcGFpZCBjcmVkaXRzLgogICAgSWYgYSB0b29sLCBzaXRlIG9yIEFQSSBkZW1hbmRzIHBheW1lbnQsIGhhbHQsIGZpbmQgYSBmcmVlLCBvcGVuLXNvdXJjZSwKICAgIHNlbGYtaG9zdGVkIG9yIGZyZWUtdGllciBlcXVpdmFsZW50LCBhbmQgcmVwb3J0IHRoZSBzdWJzdGl0dXRpb24uCiAgICBFc2NhbGF0ZSB0byB0aGUgQ2hhaXJtYW4gb25seSBpZiBubyBsYXdmdWwgZnJlZSByb3V0ZSBleGlzdHMuCiAgICBBbnkgZGVwbG95bWVudCwgc2NoZW1hIGNoYW5nZSwgY29kZSBtb2RpZmljYXRpb24gb3IgZmluYW5jaWFsIHRyYW5zZmVyCiAgICBtdXN0IGJlIHJhaXNlZCBhcyBhIFBlcm1pc3Npb24gR2F0ZSBhbmQgZnJvemVuIHVudGlsIE93bmVyIGNsZWFyYW5jZS5gfQphc3luYyBmdW5jdGlvbiBjb21taXNzaW9uKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvYWdlbnQnLHtuYW1lOmFOYW1lLnZhbHVlLnRyaW0oKSxwaWxsYXJJZDorYVBpbC52YWx1ZSxyb2xlOmFSb2xlLnZhbHVlLnRyaW0oKSwKICAgIHRvb2xzOmFUb29scy52YWx1ZS5zcGxpdCgnLCcpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLGNvc3Q6YUNvc3QudmFsdWV9KTsKICAgcmVuZGVyKCk7IGZsYXNoKCdBZ2VudCBib3VuZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gc2hvd1lhbWwoaWQpe2NvbnN0IGE9Uy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpOwogbW9kYWwoYDxoMz4ke2VzYyhhLm5hbWUpfTwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPiR7YS5pZH0gwrcgJHthLnN0YXR1c308L2Rpdj4KIDxwcmUgY2xhc3M9InlhbWwiPiR7ZXNjKHlhbWxGb3IoYSkpfTwvcHJlPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+CiA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29weVkoJyR7YS5pZH0nKSI+Q29weSBZQU1MPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCl9CmZ1bmN0aW9uIGNvcHlZKGlkKXtuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoeWFtbEZvcihTLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCkpKTtmbGFzaCgnWUFNTCBjb3BpZWQnKX0KYXN5bmMgZnVuY3Rpb24gdG9nKGlkKXthd2FpdCBBUEkoJy9hcGkvYWdlbnQvdG9nZ2xlJyx7aWR9KTtyZW5kZXIoKX0KYXN5bmMgZnVuY3Rpb24ga2lsbChpZCl7aWYoIWNvbmZpcm0oJ0RlY29tbWlzc2lvbiAnK2lkKyc/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9raWxsJyx7aWR9KTtyZW5kZXIoKTtmbGFzaCgnRGVjb21taXNzaW9uZWQnKX0KCi8qIC0tLS0tLS0tLS0gT1JHIENIQVJUIC0tLS0tLS0tLS0gKi8KUkVOREVSLm9yZ2NoYXJ0PSgpPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbW1hbmQgRGVwZW5kZW5jeSBHcmFwaDwvaDM+PGRpdiBjbGFzcz0idHciPgogPHN2ZyB2aWV3Qm94PSIwIDAgOTAwIDQzMCIgc3R5bGU9Im1pbi13aWR0aDo3MjBweDt3aWR0aDoxMDAlIj4KICA8ZGVmcz48bWFya2VyIGlkPSJhciIgbWFya2VyV2lkdGg9IjkiIG1hcmtlckhlaWdodD0iOSIgcmVmWD0iOCIgcmVmWT0iMyIgb3JpZW50PSJhdXRvIj48cGF0aCBkPSJNMCwwIEwwLDYgTDgsMyB6IiBmaWxsPSIjMmM0MDU1Ii8+PC9tYXJrZXI+PC9kZWZzPgogIDxyZWN0IHg9IjMxNSIgeT0iMTQiIHdpZHRoPSIyNzAiIGhlaWdodD0iNTIiIHJ4PSIxMCIgZmlsbD0iIzA2MjIyYSIgc3Ryb2tlPSIjMTU1ZTZiIi8+CiAgPHRleHQgeD0iNDUwIiB5PSIzOCIgZmlsbD0iIzIyZDNlZSIgZm9udC1zaXplPSIxMyIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q0hBSVJNQU4gQUdFTlQ8L3RleHQ+CiAgPHRleHQgeD0iNDUwIiB5PSI1NSIgZmlsbD0iIzZiN2E4ZCIgZm9udC1zaXplPSI5LjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkV4ZWN1dGl2ZSBDb21tYW5kIFRvd2VyIMK3IFplcm8tQ29zdCBBdXRob3JpdHk8L3RleHQ+CiAgJHtQSUxMQVJTLm1hcCgocCxpKT0+e2NvbnN0IHk9MTA0K2kqNjQsZj1mbG9vcihwLmlkKTtyZXR1cm4gYAogICA8cGF0aCBkPSJNNDUwLDY2IEM0NTAsJHt5LTIwfSAyNTAsJHt5LTIwfSAyNTAsJHt5KzE4fSIgc3Ryb2tlPSIjMmM0MDU1IiBmaWxsPSJub25lIiBtYXJrZXItZW5kPSJ1cmwoI2FyKSIvPgogICA8cmVjdCB4PSIyNTAiIHk9IiR7eX0iIHdpZHRoPSI0MDAiIGhlaWdodD0iNDYiIHJ4PSI5IiBmaWxsPSIjMGEwZjE2IiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIuNyIvPgogICA8dGV4dCB4PSIyNjgiIHk9IiR7eSsyMH0iIGZpbGw9IiNlNmVlZjciIGZvbnQtc2l6ZT0iMTEuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLmljb259ICR7cC5pZH0uICR7cC5uYW1lfTwvdGV4dD4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMzV9IiBmaWxsPSIjNmI3YThkIiBmb250LXNpemU9IjkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC51bml0c308L3RleHQ+CiAgIDx0ZXh0IHg9IjYzMiIgeT0iJHt5KzI4fSIgZmlsbD0iJHtwLmNvbG9yfSIgZm9udC1zaXplPSIxMCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9ImVuZCI+JHtmLmFnZW50c30gYWd0IMK3ICR7Zi5oZWFsdGh9JTwvdGV4dD5gfSkuam9pbignJyl9CiAgPHBhdGggZD0iTTY2MCwxMjcgQzc1MCwxMjcgNzUwLDQxNSA0NzAsNDE1IiBzdHJva2U9IiMyYzQwNTUiIGZpbGw9Im5vbmUiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIgbWFya2VyLWVuZD0idXJsKCNhcikiLz4KICA8dGV4dCB4PSI3MDUiIHk9IjI4NSIgZmlsbD0iIzNmNGQ1ZiIgZm9udC1zaXplPSI5LjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPmluc2lnaHQg4oaSIHRvd2VyPC90ZXh0Pjwvc3ZnPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkVzY2FsYXRpb24gTGF3PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+RXNjYWxhdGlvbiBpcyB1cHdhcmQgb25seS4gTm8gbGF0ZXJhbCBmbG9vci10by1mbG9vciBjb21tYW5kIHdpdGhvdXQgYSBDaGFpcm1hbiBnYXRlLjwvbGk+CiAgPGxpPlNlY3VyaXR5ICZhbXA7IEF1ZGl0IGhvbGRzIHZldG8gb3ZlciB0aGUgcmVtYWluaW5nIGZvdXIgZmxvb3JzIGFuZCBtYXkgZnJlZXplIGFueSBnYXRlIG1pZC1mbGlnaHQuPC9saT4KICA8bGk+Tm8gcGF0aCBleGlzdHMgZnJvbSBhIHB1YmxpYyB1c2VyIHRvIGEgZmxvb3IuIEV2ZXJ5IHJvdXRlIHRlcm1pbmF0ZXMgYXQgdGhlIENoYWlybWFuLjwvbGk+CiAgPGxpPkFueSBhZ2VudCBtZWV0aW5nIGEgcGF5d2FsbCBoYWx0cyBhbmQgcmVwb3J0cyB1cHdhcmQg4oCUIGl0IG5ldmVyIHNwZW5kcy48L2xpPjwvdWw+PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gU0tJTExTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNraWxscz0oKT0+e2NvbnN0IG09e307Uy5hZ2VudHMuZm9yRWFjaChhPT5hLnRvb2xzLmZvckVhY2godD0+eyhtW3RdPW1bdF18fFtdKS5wdXNoKGEubmFtZSl9KSk7CiBjb25zdCBrPU9iamVjdC5rZXlzKG0pLnNvcnQoKTsKIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRvb2wgU3VyZmFjZSA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7ay5sZW5ndGh9IERJU1RJTkNUPC9zcGFuPjwvaDM+CiA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+RXZlcnkgdG9vbCBpcyBib3VuZCB0byBhdCBsZWFzdCBvbmUgYWdlbnQgYW5kIGNvbnN0cmFpbmVkIGJ5IHRoYXQgYWdlbnQncyBjb3N0IHBvbGljeS4gVW5ib3VuZCBpbnZvY2F0aW9uIGlzIGFuIHVuYXBwcm92ZWQgc2lkZSBlZmZlY3QuPC9kaXY+CiA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRvb2w8L3RoPjx0aD5Cb3VuZCBBZ2VudHM8L3RoPjx0aD5FeHBvc3VyZTwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICR7ay5tYXAodD0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2ModCl9PC9iPjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttW3RdLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke21bdF0ubGVuZ3RoPjI/J3QtYW1iJzondC1ncm4nfSI+JHttW3RdLmxlbmd0aD4yPydXSURFJzonTkFSUk9XJ308L3NwYW4+PC90ZD48L3RyPmApLmpvaW4oJycpfHwnPHRyPjx0ZCBjb2xzcGFuPSIzIiBjbGFzcz0ibW9uby1kaW0iPm5vbmU8L3RkPjwvdHI+J30KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfTsKCi8qIC0tLS0tLS0tLS0gWkVSTyBDT1NUIC0tLS0tLS0tLS0gKi8KUkVOREVSLnplcm9jb3N0PSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNTEwMGEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4oiFIFpFUk8tQ09TVCBET0NUUklORSDCtyBBQlNPTFVURTwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5UaGUgQ2hhaXJtYW4gZG9lcyBub3QgcGF5LjwvYj4gTm8gc3Vic2NyaXB0aW9ucywgbm8gY3JlZGl0IHRvcC11cHMsIG5vIG1ldGVyZWQgQVBJIHB1cmNoYXNlcywgbm8gY29udmVydGluZyB0cmlhbHMuPC9saT4KICAgPGxpPkhpdHRpbmcgYSBwYXl3YWxsLCBhbiBhZ2VudCA8Yj5oYWx0czwvYj4sIGZpbmRzIGEgZnJlZSAvIG9wZW4tc291cmNlIC8gc2VsZi1ob3N0ZWQgLyBmcmVlLXRpZXIgZXF1aXZhbGVudCwgYW5kIHJlcG9ydHMgdGhlIHN1YnN0aXR1dGlvbi48L2xpPgogICA8bGk+Tm8gZnJlZSByb3V0ZSDih5IgdGhlIENoYWlybWFuIHN0YXRlcyBwbGFpbmx5IHRoZSBvYmplY3RpdmUgaXMgdW5yZWFjaGFibGUgYXQgemVybyBjb3N0LiBJdCBuZXZlciBxdWlldGx5IHNwZW5kcy48L2xpPgogICA8bGk+RnJlZS10aWVyIHJvdGF0aW9uIGFuZCBxdW90YSBtYW5hZ2VtZW50IGFyZSBsZWdpdGltYXRlLiBGcmF1ZCwgc3RvbGVuIGtleXMsIGxpY2VuY2UgdmlvbGF0aW9uIGFuZCBUb1MgY2lyY3VtdmVudGlvbiBhcmUgPGI+cmVmdXNlZCBvdXRyaWdodDwvYj4gYW5kIGxvZ2dlZCBDUklULjwvbGk+CiAgIDxsaT5Pd25lciBtYXkgb3ZlcnJpZGUgcGVyLWdhdGUuIE92ZXJyaWRlcyBoaXQgYSB2aXNpYmxlIHNwZW5kIGNvdW50ZXIsIG5ldmVyIGhpZGRlbi48L2xpPgogICA8bGk+PGI+UHJvb2YsIG5vdCBzbG9nYW46PC9iPiB0aGlzIGJhY2tlbmQgcnVucyBvbiBOb2RlIGNvcmUgbW9kdWxlcyBvbmx5IOKAlCAwIG5wbSBwYWNrYWdlcywgMCBwYWlkIHNlcnZpY2VzLCAwIEFQSSBrZXlzLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPgogICR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ0F1dGhvcml6ZWQgU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnTGlmZXRpbWUnKX0KICAke2twaShTLmRlbmlhbHMubGVuZ3RoLCdQYWlkIFBhdGhzIEludGVyY2VwdGVkJywndmFyKC0tYW1iKScsJ0Jsb2NrZWQgb3IgcmVyb3V0ZWQnKX0KICAke2twaSgnJCcrUy5kZW5pYWxzLnJlZHVjZSgoYSxiKT0+YStiLmNvc3QsMCkudG9GaXhlZCgyKSwnU3BlbmQgQXZvaWRlZCcsJ3ZhcigtLWdybiknLCdEb2N0cmluZSBzYXZpbmdzJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U3Vic3RpdHV0aW9uIFJvdXRpbmcgVGFibGU8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgPHRoZWFkPjx0cj48dGg+UGFpZCBEZW1hbmQ8L3RoPjx0aD5GcmVlIFJvdXRlPC90aD48dGg+T3duaW5nIEFnZW50PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7RlJFRV9ST1VURVMubWFwKChbYSxiLGNdKT0+YDx0cj48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+JHtlc2MoYSl9PC9zcGFuPjwvdGQ+PHRkPiR7ZXNjKGIpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkludGVyY2VwdGlvbiBMb2c8L2gzPiR7Uy5kZW5pYWxzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+T3BlcmF0aW9uPC90aD48dGg+RGVtYW5kZWQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtbLi4uUy5kZW5pYWxzXS5yZXZlcnNlKCkubWFwKGQ9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtkLnR9PC90ZD48dGQ+JHtlc2MoZC5vcCl9PC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiQke2QuY29zdH08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHBhaWQgZGVtYW5kcyBlbmNvdW50ZXJlZCB5ZXQuPC9kaXY+J308L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBGSU5BTkNFUyAtLS0tLS0tLS0tICovClJFTkRFUi5maW5hbmNlcz0oKT0+ewogY29uc3QgdG90PVMucmV2ZW51ZS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCksaW5mbG93PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkucmVkdWNlKChhLGIpPT5hK2IuYW10LDApOwogcmV0dXJuIGAkeyFTLnBheW91dD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5TQUZFIE1PREU8L2gzPgogIDxkaXY+Tm8gcGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUaGUgc2VydmVyIHJlamVjdHMgYXBwcm92YWwgb24gZXZlcnkgdHJhbnNmZXIgZ2F0ZS4gQ29uZmlndXJlIHRoZSBWYXVsdCBmaXJzdC48L2Rpdj48L2Rpdj5gOicnfQogPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCI+CiAgJHtrcGkoJyQnK2ZtdChpbmZsb3cpLCdSZWNvcmRlZCBJbmZsb3cnLCd2YXIoLS1ncm4pJyl9CiAgJHtrcGkoJyQnK2ZtdCh0b3QpLCdOZXQgUG9zaXRpb24nLHRvdDwwPyd2YXIoLS1tYWcpJzondmFyKC0tdHh0KScpfQogICR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ1RvdGFsIFNwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ1RhcmdldCAkMC4wMCcpfQogICR7a3BpKFMucmV2ZW51ZS5sZW5ndGgsJ0xlZGdlciBMaW5lcycsJ3ZhcigtLWJsdSknKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZWNvcmQgUmV2ZW51ZSBTdHJlYW08L2gzPjxkaXYgY2xhc3M9ImdyaWQgZzMiPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U291cmNlPC9zcGFuPjxpbnB1dCBpZD0iclNyYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iUHJlbWl1bSBjcmVkaXRzIMK3IGFwcC5leGFtcGxlIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW1vdW50IFVTRDwvc3Bhbj48aW5wdXQgaWQ9InJBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Jm5ic3A7PC9zcGFuPjxidXR0b24gY2xhc3M9ImJ0biBwIiBzdHlsZT0id2lkdGg6MTAwJSIgb25jbGljaz0iYWRkUmV2KCkiPlBPU1QgVE8gTEVER0VSPC9idXR0b24+PC9sYWJlbD48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXF1ZXN0IFBheW91dDwvaDM+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+UmFpc2VzIGEgRklOQU5DSUFMIFRSQU5TRkVSIGdhdGUuIFJlcXVpcmVzIHNlYWxlZCBjaGFubmVsICsgcGFzc3dvcmQgc2lnbmF0dXJlLiAyRkEgdGFyZ2V0ICR7bWFza01haWwoUy5vd25lci5lbWFpbCl9LjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGlkPSJwQW10IiBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjAwcHgiIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IkFtb3VudCBVU0QiPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyZXFQYXlvdXQoKSI+UkFJU0UgVFJBTlNGRVIgR0FURTwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJldmVudWUgTGVkZ2VyPC9oMz4ke1MucmV2ZW51ZS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlNvdXJjZTwvdGg+PHRoIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij5BbW91bnQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtbLi4uUy5yZXZlbnVlXS5yZXZlcnNlKCkubWFwKHI9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtyLnR9PC90ZD48dGQ+JHtlc2Moci5zcmMpfTwvdGQ+CiAgPHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0O2NvbG9yOiR7ci5hbXQ8MD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHtyLmFtdDwwPyctJzonKyd9JCR7Zm10KE1hdGguYWJzKHIuYW10KSl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdHJlYW1zIHJlY29yZGVkLjwvZGl2Pid9PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIGFkZFJldigpe3RyeXthd2FpdCBBUEkoJy9hcGkvcmV2ZW51ZScse3NyYzpyU3JjLnZhbHVlLnRyaW0oKSxhbXQ6K3JBbXQudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnUG9zdGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHJlcVBheW91dCgpe3RyeXthd2FpdCBBUEkoJy9hcGkvcGF5b3V0L3JlcXVlc3QnLHthbXQ6K3BBbXQudmFsdWV9KTtnbygnZ2F0ZXMnKTtmbGFzaCgnVHJhbnNmZXIgZ2F0ZSByYWlzZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KCi8qIC0tLS0tLS0tLS0gVkFVTFQgLS0tLS0tLS0tLSAqLwpSRU5ERVIucGF5b3V0PSgpPT5gCiA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5Jc29sYXRlZCBPd25lci1vbmx5IHBhbmVsLiBSYXcgdmFsdWVzIGFyZSBzZW50IG9uY2Ugb3ZlciB0aGUgc2Vzc2lvbiwgbWFza2VkIGltbWVkaWF0ZWx5LCBhbmQgPGI+bmV2ZXIgcGVyc2lzdGVkIG9yIHJldHVybmVkPC9iPiDigJQgb25seSB0aGUgbWFza2VkIHZpZXcgYW5kIGEgU0hBLTI1NiBmaW5nZXJwcmludCBhcmUgc3RvcmVkLiBUaGUgQ2hhaXJtYW4gd2lsbCBuZXZlciByZXF1ZXN0IHRoZXNlIGFueXdoZXJlIGVsc2UuPC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhbm5lbCBDb25maWd1cmF0aW9uPC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5NZXRob2Q8L3NwYW4+PHNlbGVjdCBpZD0idlR5cGUiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InZTd2FwKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iQkFOSyI+QmFuayBXaXJlIChTV0lGVC9JQkFOKTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IkNSWVBUTyI+Q3J5cHRvIEFkZHJlc3M8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJlbmVmaWNpYXJ5IE5hbWU8L3NwYW4+PGlucHV0IGlkPSJ2TmFtZSIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGlkPSJ2QmFuayI+PGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QWNjb3VudCBOdW1iZXI8L3NwYW4+PGlucHV0IGlkPSJ2QWNjIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPklCQU48L3NwYW4+PGlucHV0IGlkPSJ2SWJhbiIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TV0lGVCAvIEJJQzwvc3Bhbj48aW5wdXQgaWQ9InZTd2lmdCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CYW5rICZhbXA7IENvdW50cnk8L3NwYW4+PGlucHV0IGlkPSJ2QmFua05hbWUiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiAgPGRpdiBpZD0idkNyeXB0byIgY2xhc3M9ImhpZGUiPjxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldHdvcms8L3NwYW4+PGlucHV0IGlkPSJ2TmV0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJCVEMgLyBFVEggLyBUUk9OIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBheW91dCBBZGRyZXNzPC9zcGFuPjxpbnB1dCBpZD0idkFkZHIiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QZXItVHJhbnNmZXIgQ2VpbGluZyAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9InZDYXAiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iMjUwMDAiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2VhbFZhdWx0KCkiPlNFQUwgQ0hBTk5FTDwvYnV0dG9uPgogICR7Uy5wYXlvdXQ/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VWYXVsdCgpIj5QdXJnZSBDaGFubmVsPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TZWFsZWQgQ2hhbm5lbDwvaDM+JHtTLnBheW91dD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgJHtPYmplY3QuZW50cmllcyhTLnBheW91dC5tYXNrZWQpLm1hcCgoW2ssdl0pPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+JHtlc2Moayl9PC90ZD48dGQ+JHtlc2Modil9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TZWFsZWQ8L3RkPjx0ZD4ke1MucGF5b3V0LnR9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4yRkEgVGFyZ2V0PC90ZD48dGQ+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L3RkPjwvdHI+PC90Ym9keT48L3RhYmxlPjwvZGl2PmAKIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBDSEFOTkVMIFNFQUxFRCDigJQgZW5naW5lIFNBRkUgTU9ERS48L2Rpdj4nfTwvZGl2PmA7CmZ1bmN0aW9uIHZTd2FwKCl7Y29uc3QgYz12VHlwZS52YWx1ZT09PSdDUllQVE8nO3ZCYW5rLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLGMpO3ZDcnlwdG8uY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsIWMpfQphc3luYyBmdW5jdGlvbiBzZWFsVmF1bHQoKXsKIGNvbnN0IGI9e3R5cGU6dlR5cGUudmFsdWUsbmFtZTp2TmFtZS52YWx1ZS50cmltKCksY2FwOit2Q2FwLnZhbHVlfHwwLAogIGFjYzp2QWNjPy52YWx1ZS50cmltKCksaWJhbjp2SWJhbj8udmFsdWUudHJpbSgpLHN3aWZ0OnZTd2lmdD8udmFsdWUudHJpbSgpLGJhbms6dkJhbmtOYW1lPy52YWx1ZS50cmltKCksCiAgbmV0OnZOZXQ/LnZhbHVlLnRyaW0oKSxhZGRyOnZBZGRyPy52YWx1ZS50cmltKCl9OwogdHJ5e2F3YWl0IEFQSSgnL2FwaS92YXVsdCcsYik7cmVuZGVyKCk7Zmxhc2goJ0NoYW5uZWwgc2VhbGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHB1cmdlVmF1bHQoKXtpZighY29uZmlybSgnUHVyZ2UgY2hhbm5lbD8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL3ZhdWx0L3B1cmdlJyk7cmVuZGVyKCk7Zmxhc2goJ1B1cmdlZCcpfQoKLyogLS0tLS0tLS0tLSBBTkFMWVRJQ1MgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYW5hbHl0aWNzPSgpPT57CiBjb25zdCBzZXY9e0lORk86MCxPSzowLFdBUk46MCxDUklUOjB9O1MubG9ncy5mb3JFYWNoKGw9PnNldltsLnNldl09KHNldltsLnNldl18fDApKzEpOwogY29uc3QgbXg9TWF0aC5tYXgoMSwuLi5PYmplY3QudmFsdWVzKHNldikpOwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5FdmVudCBTZXZlcml0eSBNaXg8L2gzPiR7T2JqZWN0LmVudHJpZXMoc2V2KS5tYXAoKFtrLHZdKT0+YDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxzcGFuPiR7a308L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3Z9PC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHt2L214KjEwMH0lO2JhY2tncm91bmQ6JHt7SU5GTzonIzNiODJmNicsT0s6JyMzMWQ2N2EnLFdBUk46JyNmZmIwMjAnLENSSVQ6JyNmZjNiNmInfVtrXX0iPjwvaT48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIE91dGNvbWVzPC9oMz4ke1snUEVORElORycsJ0FQUFJPVkVEJywnREVOSUVEJ10ubWFwKHM9Pntjb25zdCBjPVMuZ2F0ZXMuZmlsdGVyKGc9Pmcuc3RhdHVzPT09cykubGVuZ3RoOwogIHJldHVybiBgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47cGFkZGluZzo3cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMTAxODIyIj4KICA8c3BhbiBjbGFzcz0idGFnICR7cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtzfTwvc3Bhbj48Yj4ke2N9PC9iPjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QXBwcm92YWwgcmF0ZSBpcyBtZWFuaW5nbGVzcyB3aXRob3V0IGRlbmlhbCBwcmVzc3VyZS4gSWYgbm90aGluZyBpcyBldmVyIGRlbmllZCwgdGhlIGdhdGUgaXMgdGhlYXRyZS48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5GbG9vciBIZWFsdGggPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5MSVZFPC9zcGFuPjwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTtyZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuaGVhbHRofSU8L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuaGVhbHRofSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvc3QgRGlzY2lwbGluZTwvaDM+JHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyl9CiAgPGRpdiBzdHlsZT0iaGVpZ2h0OjEwcHgiPjwvZGl2PiR7a3BpKCckJytTLmRlbmlhbHMucmVkdWNlKChhLGIpPT5hK2IuY29zdCwwKS50b0ZpeGVkKDIpLCdBdm9pZGVkJywndmFyKC0tZ3JuKScpfTwvZGl2PgogPC9kaXY+YH07CgovKiAtLS0tLS0tLS0tIEFVRElUIC0tLS0tLS0tLS0gKi8KUkVOREVSLmF1ZGl0PSgpPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbToxMXB4Ij4KIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtTLmxvZ3MubGVuZ3RofSBlbnRyaWVzIHNob3duIMK3IHBlcnNpc3RlZCBzZXJ2ZXItc2lkZTwvc3Bhbj4KIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJleHBvcnRMb2coKSI+RXhwb3J0IEpTT048L2J1dHRvbj4KIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0icHVyZ2VMb2dzKCkiPlB1cmdlPC9idXR0b24+PC9kaXY+PC9kaXY+JHtsb2dIdG1sKDQwMCl9PC9kaXY+YDsKZnVuY3Rpb24gZXhwb3J0TG9nKCl7Y29uc3QgYj1uZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkoUy5sb2dzLG51bGwsMildLHt0eXBlOidhcHBsaWNhdGlvbi9qc29uJ30pLHU9VVJMLmNyZWF0ZU9iamVjdFVSTChiKSxhPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTsKIGEuaHJlZj11O2EuZG93bmxvYWQ9J2NoYWlybWFuLWF1ZGl0LScrRGF0ZS5ub3coKSsnLmpzb24nO2EuY2xpY2soKTtVUkwucmV2b2tlT2JqZWN0VVJMKHUpO2ZsYXNoKCdFeHBvcnRlZCcpfQphc3luYyBmdW5jdGlvbiBwdXJnZUxvZ3MoKXtpZighY29uZmlybSgnUHVyZ2UgbGVkZ2VyPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvbG9ncy9wdXJnZScpO3JlbmRlcigpfQoKLyogLS0tLS0tLS0tLSBNSVNTSU9OUzogaGUgZ3VpZGVzLCB5b3UgZXhlY3V0ZSAtLS0tLS0tLS0tICovCkxJVkUubWlzc2lvbnM9KCk9PnsKICBjb25zdCBNPVMubWlzc2lvbnN8fFtdLCBvcGVuPU0uZmlsdGVyKG09Pm0uc3RhdHVzPT09J09QRU4nKSwgZG9uZT1NLmZpbHRlcihtPT5tLnN0YXR1cz09PSdET05FJyk7CiAgY29uc3QgbWlucz1vcGVuLnJlZHVjZSgoYSxtKT0+YSsobS5taW51dGVzfHwwKSwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShvcGVuLmxlbmd0aCwnT3BlbiBNaXNzaW9ucycsb3Blbi5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxtaW5zPyd+JyttaW5zKycgbWluIHRvdGFsJzonbm90aGluZyBwZW5kaW5nJyl9CiAgICR7a3BpKGRvbmUubGVuZ3RoLCdDb21wbGV0ZWQnLCd2YXIoLS1ncm4pJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoKFMucGxheWJvb2tzfHxbXSkubGVuZ3RoLCdQbGF5Ym9va3MnLCd2YXIoLS1jeSknLCdzdGVwLWJ5LXN0ZXAgZ3VpZGVzJyl9CiAgICR7a3BpKFMudmVudHVyZXMmJlMudmVudHVyZXMubGVuZ3RoP2VzYyhTLnZlbnR1cmVzWzBdLnRpdGxlKS5zbGljZSgwLDE4KTonbm9uZScsJ0FjdGl2ZSBWZW50dXJlJywndmFyKC0tcHVyKScsJycpfTwvZGl2PgogICR7b3Blbi5sZW5ndGg/b3Blbi5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZiI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjdweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5ETyBUSElTPC9zcGFuPjxiIHN0eWxlPSJmb250LXNpemU6MTRweCI+JHtlc2MobS50aXRsZSl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+fiR7bS5taW51dGVzfSBtaW48L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweDtjb2xvcjojYjNjMWQxIj4ke2VzYyhtLndoeSl9PC9kaXY+CiAgICAke20uc3RlcHMubGVuZ3RoP2A8b2wgc3R5bGU9Im1hcmdpbjowIDAgMTBweDtwYWRkaW5nLWxlZnQ6MjBweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNzUiPgogICAgICAke20uc3RlcHMubWFwKHM9PmA8bGk+JHtlc2Mocyl9PC9saT5gKS5qb2luKCcnKX08L29sPmA6Jyd9CiAgICAke20uc2NyaXB0P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiMwNjIyMmE7Ym9yZGVyOjFweCBzb2xpZCAjMTU1ZTZiO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDttYXJnaW4tYm90dG9tOjEwcHgiPgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5DT1BZIFRIRVNFIEVYQUNUIFdPUkRTOjwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiIGlkPSJzY3JfJHttLmlkfSI+JHtlc2MobS5zY3JpcHQpfTwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6OXB4IiBvbmNsaWNrPSJjb3B5U2NyaXB0KCcke20uaWR9JykiPkNvcHkgbWVzc2FnZTwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEyMHB4Ij5Eb25lIHdoZW48L3RkPjx0ZD4ke2VzYyhtLmRvbmVXaGVuKX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxpa2VseSBibG9ja2VyPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKG0ucmlzayl9PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48c3Bhbj5XaGF0IGhhcHBlbmVkPyAoaGUgYWRhcHRzIHRoZSBuZXh0IG1pc3Npb24gdG8gdGhpcyk8L3NwYW4+CiAgICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9Im5vdGVfJHttLmlkfSIgcGxhY2Vob2xkZXI9ImUuZy4gc2VudCB0byA0IHNob3BzLCAxIHJlcGxpZWQgYXNraW5nIHByaWNlIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdkb25lJykiPk1BUksgRE9ORTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ3NraXAnKSI+U2tpcCB0aGlzPC9idXR0b24+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gb3BlbiBtaXNzaW9ucy4gUHJlc3MgR0VUIE1ZIE5FWFQgTUlTU0lPTlMgYW5kIGhlIHdpbGwgdGVsbCB5b3UgZXhhY3RseSB3aGF0IHRvIGRvIHRvZGF5LjwvZGl2PjwvZGl2PmB9CiAgJHtkb25lLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbXBsZXRlZCA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4ke2RvbmUubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5NaXNzaW9uPC90aD48dGg+T3V0Y29tZTwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtkb25lLnNsaWNlKDAsMTUpLm1hcChtPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bS5jbG9zZWR8fG0udH08L3RkPjx0ZD4ke2VzYyhtLnRpdGxlKX08L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobS5vdXRjb21lfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJ30KICAkeyhTLnBsYXlib29rc3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBsYXlib29rczwvaDM+CiAgICR7Uy5wbGF5Ym9va3MubWFwKChwLGkpPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWN5KTtwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHgiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKHAudG9waWMpfTwvYj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlQYigke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NTtmb250LXNpemU6MTIuNXB4O21hcmdpbi10b3A6NnB4Ij4ke2VzYyhwLnRleHQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpfQogICA8L2Rpdj5gOicnfWA7Cn07ClJFTkRFUi5taXNzaW9ucz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKXjiBNWSBNSVNTSU9OUyDigJQgSEUgUExBTlMsIFlPVSBFWEVDVVRFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGNhbm5vdCByZWdpc3RlciBjb21wYW5pZXMsIHBsYWNlIGFkcyBvciB0YWxrIHRvIGN1c3RvbWVycy4gU28gaGUgZG9lcyB0aGUgbmV4dCBiZXN0IHRoaW5nOiBicmVha3MgdGhlIHBhdGggaW50byA8Yj5zaW5nbGUgYWN0aW9ucyB5b3UgY2FuIGZpbmlzaCB0b2RheTwvYj4sIHdyaXRlcyB0aGUgZXhhY3Qgd29yZHMgdG8gc2VuZCwgYW5kIGFkYXB0cyBiYXNlZCBvbiB3aGF0IGFjdHVhbGx5IGhhcHBlbmVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZXRNaXNzaW9ucygpIj5HRVQgTVkgTkVYVCBNSVNTSU9OUzwvYnV0dG9uPgogICAkeyhTLm1pc3Npb25zfHxbXSkuc29tZShtPT5tLnN0YXR1cyE9PSdPUEVOJyk/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJNaXNzaW9ucygpIj5DbGVhciBoaXN0b3J5PC9idXR0b24+JzonJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjM0MHB4IiBpZD0icGJUb3BpYyIgcGxhY2Vob2xkZXI9IlBsYXlib29rIHRvcGljIOKAlCBlLmcuIGhvdyB0byByZWdpc3RlciBhIHNvbGUgcHJvcHJpZXRvcnNoaXAgaW4gUHVuamFiIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJtYWtlUGIoKSI+V1JJVEUgUExBWUJPT0s8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5QbGF5Ym9vayBpZGVhczogZ2V0dGluZyBhIFJhem9ycGF5IGFjY291bnQgwrcgR1NUIGZvciBmcmVlbGFuY2VycyBpbiBJbmRpYSDCtyBmaW5kaW5nIHNob3Agb3duZXJzJyBudW1iZXJzIGxlZ2FsbHkgwrcgd3JpdGluZyBhIGZpcnN0IGludm9pY2U8L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJtaXNzaW9ucyI+JHtMSVZFLm1pc3Npb25zKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZ2V0TWlzc2lvbnMoKXsgZmxhc2goJ0NoYWlybWFuIGlzIHBsYW5uaW5nIHlvdXIgbmV4dCBtb3Zlc+KApicpOwogIHRyeXsgY29uc3Qgdj0oUy52ZW50dXJlc3x8W10pWzBdOwogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9nZW5lcmF0ZScse3ZlbnR1cmVJZDp2P3YuaWQ6bnVsbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBtaXNzaW9uKHMpIGlzc3VlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KZnVuY3Rpb24gY29weVNjcmlwdChpZCl7IGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JfJytpZCk7CiAgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KGVsP2VsLmlubmVyVGV4dDonJyk7IGZsYXNoKCdNZXNzYWdlIGNvcGllZCDigJQgbm93IHNlbmQgaXQnKSB9CmZ1bmN0aW9uIGNvcHlQYihpKXsgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KChTLnBsYXlib29rc3x8W10pW2ldLnRleHQpOyBmbGFzaCgnUGxheWJvb2sgY29waWVkJykgfQphc3luYyBmdW5jdGlvbiBkZWJyaWVmKGlkLG91dGNvbWUpewogIGNvbnN0IG5vdGU9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdub3RlXycraWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKG91dGNvbWU9PT0nZG9uZScmJiFub3RlLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdXcml0ZSB3aGF0IGhhcHBlbmVkIGZpcnN0IOKAlCBoZSBuZWVkcyBpdCB0byBwbGFuIHRoZSBuZXh0IHN0ZXAnKTsKICBmbGFzaCgnUmVjb3JkaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL2RlYnJpZWYnLHtpZCxvdXRjb21lLG5vdGV9KTsgcmVuZGVyKCk7CiAgICBpZihyLmFkdmljZSkgbW9kYWwoYDxoMz5EZWJyaWVmPC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhyLmFkdmljZSl9PC9kaXY+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnZXRNaXNzaW9ucygpIj5OZXh0IG1pc3Npb25zIOKGkjwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICAgIGVsc2UgZmxhc2goJ1NraXBwZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIG1ha2VQYigpeyBjb25zdCB0PXBiVG9waWMudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGEgdG9waWMnKTsKICBmbGFzaCgnV3JpdGluZyBwbGF5Ym9va+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL21pc3Npb24vcGxheWJvb2snLHt0b3BpYzp0fSk7IHJlbmRlcigpOyBmbGFzaCgnUGxheWJvb2sgcmVhZHknKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIENPTU1BTkQgQ09OU09MRSAtLS0tLS0tLS0tICovCkxJVkUuY29tbWFuZD0oKT0+ewogIGNvbnN0IEM9Uy5jaGF0fHxbXTsKICByZXR1cm4gQy5sZW5ndGg/Qy5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHg7Ym9yZGVyLWNvbG9yOiR7CiAgICAgbS53aG89PT0nT1dORVInPycjMjIzNDRhJzptLndobz09PSdDSEFJUk1BTic/JyMxNTVlNmInOicjNmIyMjMzJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo2cHgiPgogICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHttLndobz09PSdPV05FUic/J3QtYmx1JzptLndobz09PSdDSEFJUk1BTic/J3QtY3knOid0LXJlZCd9Ij4ke20ud2hvfTwvc3Bhbj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7bS50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MobS50ZXh0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBvcmRlcnMgZ2l2ZW4geWV0LiBUZWxsIHRoZSBDaGFpcm1hbiB3aGF0IHlvdSB3YW50LjwvZGl2PjwvZGl2Pic7Cn07ClJFTkRFUi5jb21tYW5kPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxNTVlNmI7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwNjIyMmEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj7ilq4gQ09NTUFORCBDT05TT0xFIOKAlCBIRSBBTlNXRVJTIE9OTFkgVE8gWU9VPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkdpdmUgb3JkZXJzIGluIHBsYWluIEVuZ2xpc2guIEhlIHJlcGxpZXMgd2l0aCB3aGF0IGhlIHdpbGwgZG8sIHdoYXQgaGUgbmVlZHMgZnJvbSB5b3UsIGFuZCB3aGF0IGhlIGNhbm5vdCBkby4gRXZlcnl0aGluZyBoZXJlIGlzIGxvZ2dlZCBhbmQgc3Vydml2ZXMgcmVzdGFydHMuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Tm8gQUkgYnJhaW4gY29ubmVjdGVkIOKAlCBoZSBjYW5ub3QgYW5zd2VyLiBDb25uZWN0IG9uZSBvbiB0aGUgQUkgQnJhaW4gcGFnZS48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBvcmRlcjwvc3Bhbj48dGV4dGFyZWEgaWQ9ImNtZFRleHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6ODBweCIKICAgIHBsYWNlaG9sZGVyPSJlLmcuIEZpbmQgbWUgdGhyZWUgd2F5cyB0byBlYXJuIGZyb20gd2hhdCBJIG93biwgcmVzZWFyY2ggdGhlIGJlc3Qgb25lLCBhbmQgYnVpbGQgdGhlIGFnZW50IHRlYW0uIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2VuZENtZCgpIj5TRU5EIE9SREVSPC9idXR0b24+CiAgICR7KFMuY2hhdHx8W10pLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhckNtZCgpIj5DbGVhciBsb2c8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImNvbW1hbmQiPiR7TElWRS5jb21tYW5kKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gc2VuZENtZCgpewogIGNvbnN0IHQ9Y21kVGV4dC52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYW4gb3JkZXIgZmlyc3QnKTsKICBmbGFzaCgnQ2hhaXJtYW4gaXMgdGhpbmtpbmfigKYnKTsgY21kVGV4dC52YWx1ZT0nJzsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kJyx7dGV4dDp0fSk7IHJlbmRlcigpOyB9CiAgY2F0Y2goZSl7IHJlbmRlcigpOyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBjbGVhckNtZCgpeyBhd2FpdCBBUEkoJy9hcGkvY29tbWFuZC9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIFZFTlRVUkVTIC0tLS0tLS0tLS0gKi8KTElWRS52ZW50dXJlcz0oKT0+ewogIGNvbnN0IEk9Uy5pZGVhc3x8W10sIFY9Uy52ZW50dXJlc3x8W107CiAgY29uc3QgcmF3PUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JBVycpLmxlbmd0aDsKICBjb25zdCBkb25lPUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JFU0VBUkNIRUQnKTsKICBjb25zdCBiZXN0PWRvbmUuc2xpY2UoKS5zb3J0KChhLGIpPT4oYi5zY29yZXx8MCktKGEuc2NvcmV8fDApKVswXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShJLmxlbmd0aCwnSWRlYXMgR2VuZXJhdGVkJywndmFyKC0tY3kpJyxyYXcrJyBhd2FpdGluZyByZXNlYXJjaCcpfQogICAke2twaShkb25lLmxlbmd0aCwnUmVzZWFyY2hlZCcsJ3ZhcigtLXB1ciknLCdhZ2FpbnN0IGxpdmUgd2ViIGRhdGEnKX0KICAgJHtrcGkoYmVzdD9iZXN0LnNjb3JlKycvMTAwJzon4oCUJywnQmVzdCBTY29yZScsYmVzdCYmYmVzdC5zY29yZT49NjA/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJyxiZXN0P2VzYyhiZXN0LnRpdGxlKS5zbGljZSgwLDI2KTonbm9uZSB5ZXQnKX0KICAgJHtrcGkoVi5sZW5ndGgsJ1ZlbnR1cmVzIExhdW5jaGVkJywndmFyKC0tZ3JuKScsJ3dpdGggcmVhbCBhZ2VudCB0ZWFtcycpfTwvZGl2PgogICR7Vi5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFZlbnR1cmVzPC9oMz4KICAgJHtWLm1hcCh2PT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWdybik7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxNHB4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyh2LnRpdGxlKX08L2I+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3YuYWdlbnRzLmxlbmd0aH0gYWdlbnRzIMK3IGZpcnN0IHJ1cGVlIGluIH4ke3Yud2Vla3N9dzwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjVweCAwIj4ke2VzYyh2LnJldmVudWVQYXRoKX08L2Rpdj4KICAgICR7di5vd25lclN0ZXBzLmxlbmd0aD9gPGRpdiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPllPVVIgU1RFUFMgKG9ubHkgYSBodW1hbiBjYW4gZG8gdGhlc2UpOjwvYj4KICAgICA8b2wgc3R5bGU9Im1hcmdpbjo1cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4Ij4ke3Yub3duZXJTdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+PC9kaXY+YDonJ30KICAgPC9kaXY+YCkuam9pbignJyl9PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SWRlYSBQaXBlbGluZSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0kubGVuZ3RofTwvc3Bhbj48L2gzPgogICAke0kubGVuZ3RoP0kubWFwKGk9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHsKICAgICAgaS5zdGF0dXM9PT0nTEFVTkNIRUQnPyd2YXIoLS1ncm4pJzppLnN0YXR1cz09PSdLSUxMRUQnPycjMzM0NDVhJzoKICAgICAgaS52ZXJkaWN0PT09J1BVUlNVRSc/J3ZhcigtLWN5KSc6aS52ZXJkaWN0PT09J0tJTEwnPyd2YXIoLS1tYWcpJzondmFyKC0tYW1iKSd9OwogICAgICBwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHg7JHtpLnN0YXR1cz09PSdLSUxMRUQnPydvcGFjaXR5Oi40NSc6Jyd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxiPiR7ZXNjKGkudGl0bGUpfTwvYj4KICAgICAgJHtpLnNjb3JlIT1udWxsP2A8c3BhbiBjbGFzcz0idGFnICR7aS5zY29yZT49NjA/J3QtZ3JuJzppLnNjb3JlPj00MD8ndC1hbWInOid0LXJlZCd9Ij4ke2kuc2NvcmV9LzEwMDwvc3Bhbj5gOicnfQogICAgICAke2kudmVyZGljdD9gPHNwYW4gY2xhc3M9InRhZyAke2kudmVyZGljdD09PSdQVVJTVUUnPyd0LWN5JzppLnZlcmRpY3Q9PT0nS0lMTCc/J3QtcmVkJzondC1kaW0nfSI+JHtpLnZlcmRpY3R9PC9zcGFuPmA6Jyd9CiAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7aS5zdGF0dXN9PC9zcGFuPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+4oK5JHtmbXQoaS5wcmljZSl9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7bWFyZ2luOjRweCAwIj4ke2VzYyhpLndoYXQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPkJ1eWVyOiAke2VzYyhpLmJ1eWVyKX08L2Rpdj4KICAgICR7aS5yZXNlYXJjaD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMGExMTE5O2JvcmRlci1yYWRpdXM6N3B4O3BhZGRpbmc6OXB4O21hcmdpbi10b3A6N3B4O2ZvbnQtc2l6ZToxMS41cHgiPgogICAgICA8ZGl2PiR7ZXNjKGkucmVzZWFyY2gucmVhc29uaW5nKX08L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo2cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPkZpcnN0IHN0ZXA6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmZpcnN0U3RlcCl9PC9kaXY+CiAgICAgIDxkaXY+PGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPktpbGwgcmlzazo8L2I+ICR7ZXNjKGkucmVzZWFyY2gua2lsbFJpc2spfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4Ij5kZW1hbmQgJHtpLnJlc2VhcmNoLmRlbWFuZH0vMTAgwrcgY29tcGV0aXRpb24gJHtpLnJlc2VhcmNoLmNvbXBldGl0aW9ufS8xMCDCtyBzcGVlZCAke2kucmVzZWFyY2guc3BlZWR9LzEwIMK3IGZpdCAke2kucmVzZWFyY2guZml0fS8xMDwvZGl2PjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+CiAgICAgJHtpLnN0YXR1cz09PSdSQVcnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0icmVzZWFyY2hJZGVhKCcke2kuaWR9JykiPlJFU0VBUkNIIElUPC9idXR0b24+YDonJ30KICAgICAke2kuc3RhdHVzPT09J1JFU0VBUkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gb2siIG9uY2xpY2s9ImxhdW5jaElkZWEoJyR7aS5pZH0nKSI+QlVJTEQgQUdFTlQgVEVBTTwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cyE9PSdLSUxMRUQnJiZpLnN0YXR1cyE9PSdMQVVOQ0hFRCc/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbElkZWEoJyR7aS5pZH0nKSI+S2lsbDwvYnV0dG9uPmA6Jyd9CiAgICA8L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBpZGVhcyB5ZXQuIFByZXNzIEdFTkVSQVRFIElERUFTIGFuZCBoZSB3aWxsIGludmVudCB0aGVtLjwvZGl2Pid9PC9kaXY+YDsKfTsKUkVOREVSLnZlbnR1cmVzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4peGIFZFTlRVUkUgRU5HSU5FIOKAlCBJREVBUyDihpIgUkVBTCBSRVNFQVJDSCDihpIgQUdFTlQgVEVBTVM8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgaW52ZW50cyB2ZW50dXJlcywgcmVzZWFyY2hlcyBlYWNoIG9uZSBhZ2FpbnN0IDxiPmxpdmUgd2ViIHNlYXJjaDwvYj4gKG5vdCBtb2RlbCBtZW1vcnkpLCBzY29yZXMgaXQgb3V0IG9mIDEwMCwgYW5kIGRlc2lnbnMgdGhlIGFnZW50IHRlYW0gdG8gZXhlY3V0ZS4gQWdlbnRzIHdob3NlIHRvb2xzIG1hcCB0byBubyByZWFsIGNvZGUgYXJlIHJlZnVzZWQsIHNvIG5vdGhpbmcgZGVjb3JhdGl2ZSBnZXRzIGNyZWF0ZWQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3B0aW9uYWwgc3RlZXIgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obGVhdmUgYmxhbmsgYW5kIGhlIGRlY2lkZXMpPC9zcGFuPjwvc3Bhbj4KICAgPGlucHV0IGlkPSJpZGVhU3RlZXIiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gZm9jdXMgb24gQjJCLCBvciBvbmxpbmUtb25seSwgb3IgdW5kZXIgNTAwIElOUiB0byBzdGFydCI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZW5JZGVhcygpIj5HRU5FUkFURSBJREVBUzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvSWRlYXM/J3QtcmVkJzondC1kaW0nfSI+SURFQSBBVVRPUElMT1QgJHtTLmF1dG9JZGVhcz8nT04nOidPRkYnfTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjEwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0iaWRlYVB3IiBwbGFjZWhvbGRlcj0iUGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLmF1dG9JZGVhcz8nbm8nOicnfSIgb25jbGljaz0idG9nZ2xlSWRlYUF1dG8oKSI+JHtTLmF1dG9JZGVhcz8nU1RPUCBBVVRPUElMT1QnOidFTkFCTEUgSURFQSBBVVRPUElMT1QnfTwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkF1dG9waWxvdCA9IGhlIGludmVudHMgYW5kIHJlc2VhcmNoZXMgdmVudHVyZXMgdW5wcm9tcHRlZCwgZXZlcnkgfjUgbWludXRlcy48L3NwYW4+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idmVudHVyZXMiPiR7TElWRS52ZW50dXJlcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGdlbklkZWFzKCl7IGZsYXNoKCdUaGlua2luZyB1cCB2ZW50dXJlc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9nZW5lcmF0ZScse246NSxzdGVlcjppZGVhU3RlZXIudmFsdWUudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5hZGRlZCsnIGlkZWEocykgZ2VuZXJhdGVkJyk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcmVzZWFyY2hJZGVhKGlkKXsgZmxhc2goJ1NlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvcmVzZWFyY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdTY29yZWQgJytyLnNjb3JlKycvMTAwIOKAlCAnK3IudmVyZGljdCk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gbGF1bmNoSWRlYShpZCl7IGZsYXNoKCdEZXNpZ25pbmcgYWdlbnQgdGVhbeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9sYXVuY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIuYWdlbnRzKycgYWdlbnQocykgY29tbWlzc2lvbmVkJysoci5za2lwcGVkPycgwrcgJytyLnNraXBwZWQrJyByZWplY3RlZCBhcyBub24tZXhlY3V0YWJsZSc6JycpKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBraWxsSWRlYShpZCl7IGF3YWl0IEFQSSgnL2FwaS9pZGVhL2tpbGwnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUlkZWFBdXRvKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9hdXRvcGlsb3QnLHtvbjohUy5hdXRvSWRlYXMscHc6aWRlYVB3LnZhbHVlfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvSWRlYXM/J0F1dG9waWxvdCBPTiDigJQgaGUgd2lsbCBpbnZlbnQgdmVudHVyZXMgb24gaGlzIG93bic6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIFBBWU1FTlRTIC0tLS0tLS0tLS0gKi8KTElWRS5wYXk9KCk9PnsKICBjb25zdCBPPVMub3JkZXJzfHxbXTsKICBjb25zdCBwYWlkPU8uZmlsdGVyKG89Pm8ucGFpZD4wKS5yZWR1Y2UoKGEsbyk9PmErby5wYWlkLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKE8ubGVuZ3RoLCdMaW5rcyBSYWlzZWQnLCd2YXIoLS1jeSknLCdsaWZldGltZScpfQogICAke2twaShPLmZpbHRlcihvPT5vLnBhaWQ+MCkubGVuZ3RoLCdQYWlkJyxwYWlkPyd2YXIoLS1ncm4pJzondmFyKC0tZGltKScsJ3NldHRsZWQnKX0KICAgJHtrcGkoKFMucGF5PyhTLnBheS5nYXRld2F5PT09J3Jhem9ycGF5Jz8n4oK5JzonJCcpOicnKStmbXQocGFpZCksJ0NvbGxlY3RlZCcsJ3ZhcigtLWdybiknLCdyZWFsIG1vbmV5Jyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBheW1lbnQgTGlua3M8L2gzPgogICAke08ubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5Gb3I8L3RoPjx0aD5BbW91bnQ8L3RoPjx0aD5Nb2RlPC90aD48dGg+U3RhdHVzPC90aD48dGg+TGluazwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtPLm1hcChvPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7by50fTwvdGQ+CiAgICA8dGQ+JHtlc2Moby5kZXNjKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moby5jdXN0b21lcil9PC9kaXY+PC90ZD4KICAgIDx0ZD4ke28uY3VycmVuY3l9ICR7Zm10KG8uYW1vdW50KX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtvLmxpdmU/J3QtcmVkJzondC1kaW0nfSI+JHtvLmxpdmU/J0xJVkUnOidURVNUJ308L3NwYW4+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5wYWlkPjA/J3QtZ3JuJzondC1hbWInfSI+JHtvLnBhaWQ+MD8nUEFJRCc6ZXNjKG8uc3RhdHVzKX08L3NwYW4+PC90ZD4KICAgIDx0ZD48YSBocmVmPSIke2VzYyhvLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+b3BlbiDihpc8L2E+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHBheW1lbnQgbGlua3MgcmFpc2VkIHlldC48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi5wYXk9KCk9PnsKICBjb25zdCBQPVMucGF5LCBHVz1TLmdhdGV3YXlzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtQPyhQLmxpdmU/JyM2YjIyMzMnOicjMWM1YzNjJyk6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtQPyhQLmxpdmU/JyMxNjBiMGMnOicjMDgxNzBmJyk6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtQPyhQLmxpdmU/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyk6J3ZhcigtLWFtYiknfSI+4oK5IFBBWU1FTlRTIOKAlCAke1A/KFAubGl2ZT8nTElWRSDCtyBSRUFMIE1PTkVZJzonQ09OTkVDVEVEIMK3IFRFU1QgTU9ERScpOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7UAogICAgP2BWZXJpZmllZCBhZ2FpbnN0IDxiPiR7ZXNjKFAuZ2F0ZXdheSl9PC9iPiwga2V5ICR7ZXNjKFAua2V5SWQpfS4gJHtQLmxpdmUKICAgICAgPyc8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+TElWRSBNT0RFIOKAlCBsaW5rcyB5b3UgcmFpc2UgdGFrZSByZWFsIG1vbmV5LiBFdmVyeSBsaW5rIG5lZWRzIHlvdXIgcGFzc3dvcmQuPC9iPicKICAgICAgOidUZXN0IG1vZGUuIExpbmtzIHdvcmsgZW5kLXRvLWVuZCBidXQgbW92ZSBubyByZWFsIG1vbmV5Lid9YAogICAgOidDb25uZWN0IFJhem9ycGF5IG9yIFN0cmlwZSBiZWxvdy4gS2V5cyBhcmUgdmVyaWZpZWQgYWdhaW5zdCB0aGUgcmVhbCBBUEkgYmVmb3JlIGJlaW5nIGFjY2VwdGVkIOKAlCBhIHdyb25nIGtleSBpcyByZWplY3RlZCBpbW1lZGlhdGVseSwgbm90IHN0b3JlZC4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+U3RhcnQgd2l0aCA8Yj50ZXN0IGtleXM8L2I+LiBSYXpvcnBheSA8Y29kZT5yenBfdGVzdF88L2NvZGU+LCBTdHJpcGUgPGNvZGU+c2tfdGVzdF88L2NvZGU+IOKAlCBpbnN0YW50LCBubyBLWUMuPC9saT4KICAgIDxsaT5MaXZlIGtleXMgbmVlZCBLWUMgKFBBTiArIGJhbmsgZm9yIFJhem9ycGF5KS4gUHJvdmlkZXJzIGNoYXJnZSB+MiUgcGVyIHRyYW5zYWN0aW9uIOKAlCB0aGF0IGlzIHRoZSBjb3N0IG9mIG1vdmluZyBtb25leSwgbm90IHNvbWV0aGluZyB0byByb3V0ZSBhcm91bmQuPC9saT4KICAgIDxsaT5Zb3VyIHNlY3JldCBpcyBuZXZlciByZXR1cm5lZCBieSB0aGUgQVBJIGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBHYXRld2F5PC9oMz4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+R2F0ZXdheTwvc3Bhbj48c2VsZWN0IGlkPSJwZ1NlbCIgY2xhc3M9ImluIiBvbmNoYW5nZT0icGF5SGludCgpIj4KICAgICAke0dXLm1hcChnPT5gPG9wdGlvbiB2YWx1ZT0iJHtnLmlkfSIgJHtQJiZQLmdhdGV3YXk9PT1nLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKGcubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icGF5SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPktleSBJRCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihSYXpvcnBheSBvbmx5KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJwZ0lkIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icnpwX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TZWNyZXQgS2V5PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdTZWNyZXQiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ic2VjcmV0IC8gc2tfdGVzdF8uLi4iPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0UGF5KCkiPlZFUklGWSAmYW1wOyBDT05ORUNUPC9idXR0b24+CiAgICAgJHtQPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlUGF5KCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmFpc2UgYSBQYXltZW50IExpbms8L2gzPgogICAgJHshUD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iPkNvbm5lY3QgYSBnYXRld2F5IGZpcnN0LjwvZGl2Pic6YAogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BbW91bnQgJHtQLmdhdGV3YXk9PT0ncmF6b3JwYXknPycoSU5SKSc6JyhVU0QpJ308L3NwYW4+PGlucHV0IGlkPSJwbEFtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSIyNTAwIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VzdG9tZXIgbmFtZTwvc3Bhbj48aW5wdXQgaWQ9InBsTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXMgaXQgZm9yPC9zcGFuPjxpbnB1dCBpZD0icGxEZXNjIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJXZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIOKAlCBBdWd1c3QiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkVtYWlsPC9zcGFuPjxpbnB1dCBpZD0icGxFbWFpbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QaG9uZTwvc3Bhbj48aW5wdXQgaWQ9InBsUGhvbmUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgJHtQLmxpdmU/YDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgY29uZmlybSB3aXRoIHlvdXIgcGFzc3dvcmQ8L3NwYW4+CiAgICAgIDxpbnB1dCBpZD0icGxQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+YDonJ30KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im1ha2VMaW5rKCkiPkNSRUFURSBMSU5LPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZWZyZXNoUGF5KCkiPkNIRUNLIEZPUiBQQVlNRU5UUzwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+WW91IGdldCBhIFVSTCB0byBzZW5kIG92ZXIgV2hhdHNBcHAgb3IgZW1haWwuIFdoZW4gaXQgc2V0dGxlcywgdGhlIGxlZGdlciB1cGRhdGVzIGFuZCB5b3UgZ2V0IGFuIGVtYWlsLjwvZGl2PmB9PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBkYXRhLWxpdmU9InBheSI+JHtMSVZFLnBheSgpfTwvZGl2PmA7Cn07CmZ1bmN0aW9uIHBheUhpbnQoKXsKICBjb25zdCBnPShTLmdhdGV3YXlzfHxbXSkuZmluZCh4PT54LmlkPT09ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BnU2VsJykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXlIaW50Jyk7CiAgaWYoZyYmZWwpIGVsLmlubmVySFRNTD1gPGI+JHtlc2MoZy5sYWJlbCl9PC9iPjxicj4ke2VzYyhnLnNpZ251cCl9PGJyPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZy5rZXlIaW50KX08L3NwYW4+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0UGF5KCl7CiAgZmxhc2goJ1ZlcmlmeWluZyBrZXlzIGFnYWluc3QgdGhlIHJlYWwgQVBJ4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvY29ubmVjdCcse2dhdGV3YXk6cGdTZWwudmFsdWUsa2V5SWQ6cGdJZC52YWx1ZSxrZXlTZWNyZXQ6cGdTZWNyZXQudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmxpdmU/J0NPTk5FQ1RFRCDigJQgTElWRSBNT0RFLCByZWFsIG1vbmV5JzonQ29ubmVjdGVkIGluIFRFU1QgbW9kZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VQYXkoKXsgaWYoIWNvbmZpcm0oJ0Rpc2Nvbm5lY3QgdGhlIHBheW1lbnQgZ2F0ZXdheT8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9wYXkvcHVyZ2UnLHt9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBtYWtlTGluaygpewogIGZsYXNoKCdDcmVhdGluZyBsaW5r4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvbGluaycse2Ftb3VudDorcGxBbXQudmFsdWUsZGVzY3JpcHRpb246cGxEZXNjLnZhbHVlLAogICAgICBuYW1lOnBsTmFtZS52YWx1ZSxlbWFpbDpwbEVtYWlsLnZhbHVlLHBob25lOnBsUGhvbmUudmFsdWUsCiAgICAgIHB3Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxQdycpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5QYXltZW50IGxpbmsgcmVhZHk8L2gzPgogICAgIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXYgc3R5bGU9IndvcmQtYnJlYWs6YnJlYWstYWxsO2NvbG9yOnZhcigtLWN5KSI+JHtlc2Moci51cmwpfTwvZGl2PjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgnJHtlc2Moci51cmwpfScpO2ZsYXNoKCdDb3BpZWQnKSI+Q29weSBsaW5rPC9idXR0b24+CiAgICAgIDxhIGNsYXNzPSJidG4iIGhyZWY9IiR7ZXNjKHIudXJsKX0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5PcGVuIOKGlzwvYT4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiByZWZyZXNoUGF5KCl7IGZsYXNoKCdDaGVja2luZyBnYXRld2F54oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvcmVmcmVzaCcse30pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIudXBkYXRlZD9yLnVwZGF0ZWQrJyBvcmRlcihzKSB1cGRhdGVkJzonTm8gY2hhbmdlcycpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIERFRVAgUkVTRUFSQ0ggLS0tLS0tLS0tLSAqLwpSRU5ERVIucmVzZWFyY2g9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzFjM2Y3NTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzA4MTMxZiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ibHUpIj7wn4yQIERFRVAgUkVTRUFSQ0gg4oCUIExJVkUgRlJPTSBUSEUgT1BFTiBXRUI8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgZG9lcyBub3Qgc3RvcmUgdGhlIHdvcmxkJ3MgZGF0YSDigJQgbm9ib2R5IGNhbi4gSW5zdGVhZCBoZSA8Yj5mZXRjaGVzIGl0IGxpdmUgdGhlIG1vbWVudCB5b3UgYXNrPC9iPiwgd2hpY2ggaXMgYmV0dGVyLCBiZWNhdXNlIHN0b3JlZCBkYXRhIGlzIHN0YWxlIHdpdGhpbiBkYXlzLiBTb3VyY2VzOiBEdWNrRHVja0dvLCBXaWtpcGVkaWEsIFdvcmxkIEJhbmssIGxpdmUgRlguIE5vIEFQSSBrZXksIG5vIHBhaWQgc2VhcmNoLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+RGVlcCBkaXZlPC9iPiBzZWFyY2hlcyA1IGRpZmZlcmVudCBhbmdsZXMsIGRlZHVwbGljYXRlcywgYWRkcyBvcGVuIGRhdGFzZXRzLCB0aGVuIHJlYXNvbnMgb3ZlciB0aGUgbG90LjwvbGk+CiAgIDxsaT48Yj5SZWFkIHBhZ2U8L2I+IHB1bGxzIHRoZSBmdWxsIHRleHQgb2YgYW55IFVSTCDigJQgY29tcGV0aXRvciBzaXRlcywgcHJpY2UgbGlzdHMsIGdvdmVybm1lbnQgcGFnZXMuPC9saT4KICAgPGxpPkhlIGlzIGluc3RydWN0ZWQgdG8gc3RhdGUgd2hhdCBoZSBjb3VsZCA8Yj5ub3Q8L2I+IGZpbmQsIHJhdGhlciB0aGFuIGZpbGxpbmcgZ2FwcyB3aXRoIGludmVudGlvbi48L2xpPgogIDwvdWw+PC9kaXY+CiAkeyFTLmxsbT8nPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdCDigJQgcmVzZWFyY2ggbmVlZHMgcmVhc29uaW5nIHRvIGJlIHVzZWZ1bC48L2Rpdj48L2Rpdj4nOicnfQogPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlZXAgRGl2ZSBhIFRvcGljPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub3BpYzwvc3Bhbj48aW5wdXQgaWQ9ImR2VG9waWMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gdXB0aW1lIG1vbml0b3JpbmcgZGVtYW5kIGZvciBMdWRoaWFuYSBlLWNvbW1lcmNlIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlJlZ2lvbjwvc3Bhbj48aW5wdXQgaWQ9ImR2UmVnaW9uIiBjbGFzcz0iaW4iIHZhbHVlPSJMdWRoaWFuYSBQdW5qYWIgSW5kaWEiPjwvbGFiZWw+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb0RpdmUoKSI+SU5WRVNUSUdBVEU8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGFrZXMgfjE1cy4gRml2ZSBzZWFyY2hlcyBwbHVzIG9wZW4gZGF0YS48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVhZCBBbnkgUGFnZTwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0icmRVcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vY29tcGV0aXRvci5jb20vcHJpY2luZyI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGRvIHlvdSB3YW50IHRvIGtub3c/IChvcHRpb25hbCk8L3NwYW4+PGlucHV0IGlkPSJyZEFzayIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0id2hhdCBkbyB0aGV5IGNoYXJnZSBhbmQgd2hhdCBpcyBtaXNzaW5nIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9SZWFkKCkiPlJFQUQgSVQ8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+UHVsbHMgdXAgdG8gMTIsMDAwIGNoYXJhY3RlcnMgb2YgcmVhbCBwYWdlIHRleHQuPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgaWQ9InJlc091dCI+PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZG9EaXZlKCl7CiAgY29uc3QgdD1kdlRvcGljLnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhIHRvcGljJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPlNlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvZGl2ZScse3RvcGljOnQscmVnaW9uOmR2UmVnaW9uLnZhbHVlfSk7CiAgICByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RmluZGluZ3MgPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5ldmlkZW5jZSl9IGNoYXJzIG9mIGV2aWRlbmNlPC9zcGFuPjwvaDM+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjUiPiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+YDsKICB9Y2F0Y2goZSl7IHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gIH0KfQphc3luYyBmdW5jdGlvbiBkb1JlYWQoKXsKICBjb25zdCB1PXJkVXJsLnZhbHVlLnRyaW0oKTsgaWYoIXUpIHJldHVybiBmbGFzaCgnUGFzdGUgYSBVUkwnKTsKICByZXNPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+RmV0Y2hpbmcgcGFnZeKApjwvZGl2PjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9yZXNlYXJjaC9yZWFkJyx7dXJsOnUsYXNrOnJkQXNrLnZhbHVlLnRyaW0oKX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPiR7ZXNjKHIudGl0bGUpfSA8c3BhbiBjbGFzcz0idGFnIHQtYmx1Ij4ke2ZtdChyLmNoYXJzKX0gY2hhcnMgcmVhZDwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KCi8qIC0tLS0tLS0tLS0gQUkgQlJBSU4gLS0tLS0tLS0tLSAqLwpSRU5ERVIuYnJhaW49KCk9PnsKICBjb25zdCBMPVMubGxtLCBQVj1TLnByb3ZpZGVyc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7TD8nIzFjNWMzYyc6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtMPycjMDgxNzBmJzonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjoke0w/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJ30iPuKXiCBBSSBCUkFJTiDigJQgJHtMPydDT05ORUNURUQnOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7TAogICAgP2BBZ2VudHMgY2FuIHRoaW5rLiBDb25uZWN0ZWQgdG8gPGI+JHtlc2MoTC5wcm92aWRlcil9PC9iPiBydW5uaW5nIDxiPiR7ZXNjKEwubW9kZWwpfTwvYj4uIEtleSAke2VzYyhMLmtleSl9LmAKICAgIDonWW91ciBhZ2VudHMgY2FuIG1lYXN1cmUgdGhpbmdzIGJ1dCBjYW5ub3QgPGI+cmVhc29uPC9iPiB5ZXQuIENvbm5lY3QgYSBmcmVlIG1vZGVsIGJlbG93IGFuZCB0aGV5IGdhaW4gdGhlIGFiaWxpdHkgdG8gZGlhZ25vc2UsIHdyaXRlLCBhbmFseXNlIGFuZCBzdHJhdGVnaXNlLid9PC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPjxsaT5FdmVyeSBwcm92aWRlciBiZWxvdyBpcyA8Yj5nZW51aW5lbHkgZnJlZTwvYj4g4oCUIG5vIGNyZWRpdCBjYXJkLjwvbGk+CiAgICA8bGk+WW91ciBrZXkgaXMgc3RvcmVkIGxvY2FsbHkgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2xpPjwvdWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7impEgV0FOVCBISU0gRlVMTFkgSU5ERVBFTkRFTlQ/IOKAlCBSRUFEIFRISVM8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+QSB0aGlua2luZyBicmFpbiBjYW5ub3QgYmUgY29uanVyZWQgZnJvbSBub3RoaW5nLiBUcmFpbmluZyBvbmUgY29zdHMgbWlsbGlvbnMgaW4gR1BVIHRpbWUuIEV2ZXJ5IEFJIG9uIGVhcnRoIOKAlCBpbmNsdWRpbmcgdGhpcyBvbmUg4oCUIHJ1bnMgd2VpZ2h0cyB0cmFpbmVkIGJ5IHNvbWVvbmUgd2l0aCBhIGRhdGEgY2VudHJlLiBUaGUgaG9uZXN0IHF1ZXN0aW9uIGlzIG5vdCA8ZW0+ImhpcyBicmFpbiBvciB0aGVpcnMiPC9lbT4gYnV0IDxiPiJ3aG8gY2FuIHN3aXRjaCBpdCBvZmYiPC9iPi48L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5PbGxhbWEgaXMgdGhlIGFuc3dlciB0byB0aGF0LjwvYj4gVGhlIG1vZGVsIGZpbGUgc2l0cyBvbiB5b3VyIG93biBkaXNrLiBObyBrZXksIG5vIGFjY291bnQsIG5vIHJhdGUgbGltaXQsIG5vIHRlcm1zIG9mIHNlcnZpY2UuIEl0IHdvcmtzIHdpdGggdGhlIGludGVybmV0IHVucGx1Z2dlZC4gTm9ib2R5IGNhbiByZXZva2UgaXQsIHJlYWQgeW91ciBwcm9tcHRzLCBvciBjaGFuZ2UgdGhlIGRlYWwuIFRoYXQgaXMgcmVhbCBzb3ZlcmVpZ250eSDigJQgdGhlIG9ubHkgY29zdCBpcyB5b3VyIGhhcmR3YXJlLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPjEuIEluc3RhbGw8L3RkPjx0ZD5Eb3dubG9hZCBmcm9tIDxiPm9sbGFtYS5jb208L2I+IChmcmVlLCBXaW5kb3dzL01hYy9MaW51eCk8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+Mi4gR2V0IGEgbW9kZWw8L3RkPjx0ZD5JbiB0ZXJtaW5hbDogPGNvZGU+b2xsYW1hIHB1bGwgbGxhbWEzLjI8L2NvZGU+IOKAlCBhYm91dCAyIEdCPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjMuIENvbm5lY3Q8L3RkPjx0ZD5DaG9vc2UgPGI+T2xsYW1hPC9iPiBhYm92ZSwgbGVhdmUgdGhlIGtleSBibGFuaywgcHJlc3MgQ09OTkVDVDwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CaWdnZXIgYnJhaW48L3RkPjx0ZD48Y29kZT5vbGxhbWEgcHVsbCBxd2VuMi41OjE0YjwvY29kZT4gaWYgeW91IGhhdmUgMTYgR0IrIFJBTTwvdGQ+PC90cj4KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48Yj5UaGUgdHJhZGUtb2ZmLCBzdGF0ZWQgcGxhaW5seTo8L2I+IGEgbG9jYWwgbW9kZWwgb24gYSBub3JtYWwgbGFwdG9wIGlzIHNsb3dlciBhbmQgbGVzcyBjYXBhYmxlIHRoYW4gR3JvcSdzIGZyZWUgY2xvdWQgbW9kZWxzLiBZb3UgYXJlIGV4Y2hhbmdpbmcgcmF3IHBvd2VyIGZvciB0b3RhbCBjb250cm9sLiBBbHNvIOKAlCB0aGlzIFJlbmRlciBpbnN0YW5jZSBjYW5ub3QgcmVhY2ggYW4gT2xsYW1hIHJ1bm5pbmcgb24geW91ciBQQzsgbG9jYWwgYnJhaW4gbWVhbnMgcnVubmluZyB0aGUgQ2hhaXJtYW4gbG9jYWxseSB0b28uPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db25uZWN0IGEgRnJlZSBNb2RlbDwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlByb3ZpZGVyPC9zcGFuPjxzZWxlY3QgaWQ9ImxwUHJvdiIgY2xhc3M9ImluIiBvbmNoYW5nZT0icHJvdkhpbnQoKSI+CiAgICAgJHtQVi5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iICR7TCYmTC5wcm92aWRlcj09PXAuaWQ/J3NlbGVjdGVkJzonJ30+JHtlc2MocC5sYWJlbCl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIGlkPSJwcm92SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFQSSBLZXkgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obm90IG5lZWRlZCBmb3IgT2xsYW1hKTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscEtleSIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJwYXN0ZSB5b3VyIGZyZWUga2V5Ij48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Nb2RlbCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihibGFuayA9IHByb3ZpZGVyIGRlZmF1bHQpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImxwTW9kZWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImxlYXZlIGJsYW5rIiBsaXN0PSJtb2RlbExpc3QiPgogICAgIDxkYXRhbGlzdCBpZD0ibW9kZWxMaXN0Ij48L2RhdGFsaXN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0TExNKCkiPkNPTk5FQ1QgQlJBSU48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RMTE0oKSI+VEVTVCBJVDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZmV0Y2hNb2RlbHMoKSI+RkVUQ0ggTElWRSBNT0RFTFM8L2J1dHRvbj4KICAgICAke0w/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VMTE0oKSI+RGlzY29ubmVjdDwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Qcm92aWRlcnMgcmV0aXJlIG1vZGVscyB3aXRob3V0IG5vdGljZS4gSWYgVEVTVCBJVCBzYXlzIE1PREVMIFJFVElSRUQsIHByZXNzIEZFVENIIExJVkUgTU9ERUxTIGFuZCBwaWNrIG9uZSBmcm9tIHRoZSBsaXN0LjwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+V2hhdCBBZ2VudHMgR2FpbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5haS5icmllZjwvdGQ+PHRkPkV4ZWN1dGl2ZSBicmllZiB3cml0dGVuIGZyb20geW91ciByZWFsIHN5c3RlbSBzdGF0ZTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkuaW5jaWRlbnQ8L3RkPjx0ZD5SYW5rZWQgZGlhZ25vc2lzIG9mIGFueSBzaXRlIHRoYXQgZ29lcyBkb3duPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5yZXZlbnVlPC90ZD48dGQ+Q29uY3JldGUgbW9uZXktbWFraW5nIHJvdXRlcyBmcm9tIHdoYXQgeW91IGFjdHVhbGx5IGhhdmU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmNsaWVudF9yZXBvcnQ8L3RkPjx0ZD5DbGllbnQtcmVhZHkgdXB0aW1lIHJlcG9ydCB5b3UgY2FuIHNlbmQgYW5kIGNoYXJnZSBmb3I8L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWRkIHRoZXNlIG9uIHRoZSBMaXZlIE9wZXJhdGlvbnMgcGFnZSBhcyBzdGFuZGluZyBvcmRlcnMsIG9yIHJ1biB0aGVtIG9uIGRlbWFuZCBmcm9tIEFnZW50IFdvcmsuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmZ1bmN0aW9uIHByb3ZIaW50KCl7CiAgY29uc3QgcD0oUy5wcm92aWRlcnN8fFtdKS5maW5kKHg9PnguaWQ9PT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBQcm92JykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm92SGludCcpOwogIGlmKHAmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48YnI+JHtlc2MocC5zaWdudXApfTxicj5EZWZhdWx0IG1vZGVsOiA8Y29kZT4ke2VzYyhwLm1vZGVsKX08L2NvZGU+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0TExNKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Nvbm5lY3QnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlLG1vZGVsOmxwTW9kZWwudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQnJhaW4gY29ubmVjdGVkIOKAlCBub3cgcHJlc3MgVEVTVCBJVCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gdGVzdExMTSgpeyBmbGFzaCgnVGhpbmtpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS90ZXN0Jyx7fSk7IHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5BSSBCcmFpbiBPbmxpbmU8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXY+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5tb2RlbCl9IMK3ICR7ci5tc31tczwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnbygnd29yaycpIj5HaXZlIGl0IHdvcmsg4oaSPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBwdXJnZUxMTSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCB0aGUgQUkgYnJhaW4/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvbGxtL3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gZmV0Y2hNb2RlbHMoKXsKICBmbGFzaCgnQXNraW5nIHByb3ZpZGVyIHdoYXQgaXQgc2VydmVzIHRvZGF54oCmJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbGxtL21vZGVscycse3Byb3ZpZGVyOmxwUHJvdi52YWx1ZSxrZXk6bHBLZXkudmFsdWV9KTsKICAgIGlmKCFyLm1vZGVscy5sZW5ndGgpIHJldHVybiBmbGFzaCgnUHJvdmlkZXIgcmV0dXJuZWQgbm8gY2hhdCBtb2RlbHMnKTsKICAgIG1vZGFsKGA8aDM+TGl2ZSBtb2RlbHMgb24gJHtlc2MobHBQcm92LnZhbHVlKX08L2gzPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke3IubW9kZWxzLmxlbmd0aH0gYXZhaWxhYmxlIHJpZ2h0IG5vdy4gQ2xpY2sgb25lIHRvIHVzZSBpdC48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJkaXJMaXN0IiBzdHlsZT0ibWF4LWhlaWdodDozNDBweCI+JHtyLm1vZGVscy5tYXAobT0+CiAgICAgICBgPGJ1dHRvbiBvbmNsaWNrPSJwaWNrTW9kZWwoJyR7ZXNjKG0pfScpIj4ke2VzYyhtKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcGlja01vZGVsKG0peyBjbG9zZU1vZGFsKCk7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwTW9kZWwnKTsgaWYoZWwpIGVsLnZhbHVlPW07CiAgZmxhc2goJ01vZGVsIHNldCB0byAnK20rJyDigJQgcHJlc3MgQ09OTkVDVCBCUkFJTiB0aGVuIFRFU1QgSVQnKTsgfQoKLyogLS0tLS0tLS0tLSBBR0VOVCBXT1JLIC0tLS0tLS0tLS0gKi8KY29uc3QgUVVJQ0s9WwogWydFeGVjdXRpdmUgYnJpZWYnLCdTdW1tYXJpc2UgbXkgc3lzdGVtIHN0YXRlIGFuZCB0ZWxsIG1lIHRoZSBzaW5nbGUgbW9zdCB1cmdlbnQgdGhpbmcgdG8gZml4LiBCZSBibHVudC4nXSwKIFsnTWFrZSBtb25leScsJ09ubHkgcHJvcG9zZSBvZmZlcnMgZGVsaXZlcmVkIHVzaW5nIE1ZIHVwdGltZSBtb25pdG9yaW5nIHN5c3RlbSAoMjQvNyBIVFRQIHByb2JpbmcsIFRMUyBleHBpcnkgYWxlcnRzLCBpbnN0YW50IG91dGFnZSBlbWFpbCwgYXZhaWxhYmlsaXR5IGFuZCBwOTUgcmVwb3J0aW5nKS4gVFJVVEggUlVMRTogSSBoYXZlIG5ldmVyIG1vbml0b3JlZCBhbnkgY2xpZW50IHNpdGUgYW5kIGhhdmUgbm8gdHJhY2sgcmVjb3JkLiBUaGUgb3V0cmVhY2ggbWVzc2FnZSBtdXN0IGNvbnRhaW4gWkVSTyBjbGFpbXMgSSBjYW5ub3QgcHJvdmUg4oCUIG5vICJJIG5vdGljZWQgb3V0YWdlcyBvbiBsb2NhbCBzaXRlcyIsIG5vIGludmVudGVkIHJldmVudWUgZmlndXJlcywgbm8gdW52ZXJpZmllZCBzdGF0aXN0aWNzLiBMZWFkIHdpdGggYSBmcmVlIHRyaWFsLCBub3QgYSBmYWtlIG9ic2VydmF0aW9uLiBWZXJpZnkgYW55IGFyaXRobWV0aWMgeW91IHN0YXRlLiBHaXZlIDMgb2ZmZXJzOiB0aGUgb2ZmZXIgaW4gb25lIHNlbnRlbmNlLCB0aGUgTHVkaGlhbmEgYnVzaW5lc3MgdHlwZSBhbmQgaXRzIHJlYWwgcGFpbiwgbW9udGhseSBJTlIgcHJpY2Ugd2l0aCBzb3VuZCByZWFzb25pbmcsIHRoZSBsaXRlcmFsIGZpcnN0IFdoYXRzQXBwIG1lc3NhZ2UgdW5kZXIgNTAgd29yZHMsIGFuZCB0aGUgYmlnZ2VzdCBvYmplY3Rpb24gd2l0aCBhbiBob25lc3QgY291bnRlci4gQ29sZCBvdXRyZWFjaCBjbG9zZXMgMS0zJS4nXSwKIFsnRmluZCBwcm9zcGVjdHMnLCdMaXN0IDEwIHNwZWNpZmljIGJ1c2luZXNzIHR5cGVzIGluIEx1ZGhpYW5hIHRoYXQgbG9zZSByZWFsIG1vbmV5IHdoZW4gdGhlaXIgd2Vic2l0ZSBnb2VzIGRvd24sIHJhbmtlZCBieSBob3cgbXVjaCB0aGV5IGxvc2UgcGVyIGhvdXIuIEZvciBlYWNoLCBzYXkgd2hlcmUgSSBjYW4gZmluZCB0aGVpciBjb250YWN0IGRldGFpbHMgZm9yIGZyZWUuJ10sCiBbJ0NsaWVudCBwaXRjaCcsJ1dyaXRlIGEgV2hhdHNBcHAgbWVzc2FnZSBvZmZlcmluZyBmcmVlIDE0LWRheSB3ZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgbG9jYWwgYnVzaW5lc3Mgb3duZXIuIFBsYWluIEluZGlhbiBFbmdsaXNoLCBubyBtYXJrZXRpbmcgbGFuZ3VhZ2UsIG5vIGVtb2ppLiBVbmRlciA0NSB3b3Jkcy4gVGhlIGdvYWwgaXMgYSByZXBseSwgbm90IGEgc2FsZS4nXSwKIFsnSGFuZGxlIG9iamVjdGlvbnMnLCdBIEx1ZGhpYW5hIGJ1c2luZXNzIG93bmVyIHNheXMgIm15IHdlYnNpdGUgbmV2ZXIgZ29lcyBkb3duLCBJIGRvbiBub3QgbmVlZCB0aGlzIi4gR2l2ZSBtZSB0aHJlZSBob25lc3QgcmVwbGllcyB0aGF0IGRvIG5vdCBleGFnZ2VyYXRlIG9yIHVzZSBmZWFyIHRhY3RpY3MuJ10sCiBbJ0ludm9pY2UgdGVtcGxhdGUnLCdXcml0ZSBhIHNpbXBsZSBtb250aGx5IGludm9pY2UgZm9yIHdlYnNpdGUgdXB0aW1lIG1vbml0b3JpbmcsIHJlYWR5IHRvIGZpbGwgaW4sIHN1aXRhYmxlIGZvciBhIHNtYWxsIEluZGlhbiBidXNpbmVzcy4gSW5jbHVkZSBHU1QgcGxhY2Vob2xkZXIgYW5kIFVQSSBwYXltZW50IGxpbmUuJ10KXTsKUkVOREVSLndvcms9KCk9PnsKICBjb25zdCBPPVMub3V0cHV0c3x8W107CiAgcmV0dXJuIGAkeyFTLmxsbT9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQlJBSU4gQ09OTkVDVEVEPC9oMz4KICAgPGRpdj5BZ2VudHMgY2Fubm90IHRoaW5rIHlldC4gPGIgb25jbGljaz0iZ28oJ2JyYWluJykiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSk7Y3Vyc29yOnBvaW50ZXI7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZSI+Q29ubmVjdCBhIGZyZWUgbW9kZWw8L2I+IGZpcnN0IOKAlCB0YWtlcyBhYm91dCAyIG1pbnV0ZXMgYW5kIG5lZWRzIG5vIGNyZWRpdCBjYXJkLjwvZGl2PjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdpdmUgdGhlIENoYWlybWFuIFdvcmsgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QTEFJTiBFTkdMSVNIPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UeXBlIGFueSBpbnN0cnVjdGlvbi4gQSByZWFsIG1vZGVsIGV4ZWN1dGVzIGl0IGFuZCB0aGUgcmVzdWx0IGlzIHNhdmVkIGJlbG93LjwvZGl2PgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkluc3RydWN0aW9uPC9zcGFuPjx0ZXh0YXJlYSBpZD0id2tQcm9tcHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6OTBweCIKICAgICBwbGFjZWhvbGRlcj0iZS5nLiBXcml0ZSBhIG9uZS1wYWdlIHByb3Bvc2FsIG9mZmVyaW5nIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgTHVkaGlhbmEgY2xvdGhpbmcgc2hvcCwgcHJpY2VkIGluIElOUi4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9Xb3JrKCkiPkVYRUNVVEU8L2J1dHRvbj4KICAgICR7Ty5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJXb3JrKCkiPkNsZWFyIHJlc3VsdHM8L2J1dHRvbj4nOicnfTwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPlF1aWNrIHRhc2tzOjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93Ij4ke1FVSUNLLm1hcCgocSxpKT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icXVpY2soJHtpfSkiPiR7ZXNjKHFbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PjwvZGl2PjwvZGl2PgogICR7Ty5sZW5ndGg/Ty5tYXAoKG8saSk9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1wdXIiPiR7ZXNjKG8udGFnKX08L3NwYW4+PGI+JHtlc2Moby5hZ2VudCl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtvLnR9IMK3ICR7by5tc31tcyDCtyAke28udG9rZW5zfSB0b2tlbnM8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8udGV4dCl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weU91dCgke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHdvcmsgcHJvZHVjZWQgeWV0LjwvZGl2PjwvZGl2Pid9YH07CmFzeW5jIGZ1bmN0aW9uIGRvV29yaygpewogIGNvbnN0IHA9d2tQcm9tcHQudmFsdWUudHJpbSgpOyBpZighcCkgcmV0dXJuIGZsYXNoKCdUeXBlIGFuIGluc3RydWN0aW9uIGZpcnN0Jyk7CiAgZmxhc2goJ1dvcmtpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vYXNrJyx7cHJvbXB0OnB9KTsgcmVuZGVyKCk7IGZsYXNoKCdEb25lJyk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcXVpY2soaSl7IHdrUHJvbXB0LnZhbHVlPVFVSUNLW2ldWzFdOyBkb1dvcmsoKSB9CmZ1bmN0aW9uIGNvcHlPdXQoaSl7IG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgoUy5vdXRwdXRzfHxbXSlbaV0udGV4dCk7IGZsYXNoKCdDb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyV29yaygpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gTElWRSBPUEVSQVRJT05TIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gYWdvKGlzbyl7IGlmKCFpc28pIHJldHVybiAnbmV2ZXInOwogIGNvbnN0IHM9TWF0aC5mbG9vcigoRGF0ZS5ub3coKS1uZXcgRGF0ZShpc28ucmVwbGFjZSgnICcsJ1QnKSsnWicpLmdldFRpbWUoKSkvMTAwMCk7CiAgaWYoczw2MCkgcmV0dXJuIHMrJ3MgYWdvJzsgaWYoczwzNjAwKSByZXR1cm4gTWF0aC5mbG9vcihzLzYwKSsnbSBhZ28nOyByZXR1cm4gTWF0aC5mbG9vcihzLzM2MDApKydoIGFnbyc7IH0KZnVuY3Rpb24gZXZlcnkobil7IHJldHVybiBuPDYwP24rJ3MnOm48MzYwMD9NYXRoLnJvdW5kKG4vNjApKydtJzpNYXRoLnJvdW5kKG4vMzYwMCkrJ2gnOyB9CkxJVkUub3BzPSgpPT57CiAgY29uc3QgVD1TLnRhc2tzfHxbXSwgUj1TLnJ1bnN8fFtdOwogIGNvbnN0IG9uPVQuZmlsdGVyKHQ9PnQuZW5hYmxlZCkubGVuZ3RoOwogIGNvbnN0IHRvdGFsUnVucz1ULnJlZHVjZSgoYSx0KT0+YSsodC5ydW5zfHwwKSwwKTsKICBjb25zdCBmYWlscz1ULnJlZHVjZSgoYSx0KT0+YSsodC5mYWlsc3x8MCksMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUy5ydW5uaW5nPydSVU5OSU5HJzonSEFMVEVEJywnU3lzdGVtIFN0YXRlJyxTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJyxTLnJ1bm5pbmc/J3dvcmsgZXhlY3V0aW5nJzonbm90aGluZyBydW5uaW5nJyl9CiAgICR7a3BpKG9uKycgLyAnK1QubGVuZ3RoLCdTdGFuZGluZyBPcmRlcnMgTGl2ZScsJ3ZhcigtLWN5KScsJ29uIHNjaGVkdWxlJyl9CiAgICR7a3BpKGZtdCh0b3RhbFJ1bnMpLCdKb2JzIEV4ZWN1dGVkJywndmFyKC0tZ3JuKScsUy50aWNrcysnIHNjaGVkdWxlciB0aWNrcycpfQogICAke2twaShmYWlscywnRmFpbHVyZXMnLGZhaWxzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ3NpbmNlIGluc3RhbGwnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U3RhbmRpbmcgT3JkZXJzIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLnJ1bm5pbmc/J3QtZ3JuJzondC1yZWQnfSI+JHtTLnJ1bm5pbmc/J0VYRUNVVElORyc6J0ZST1pFTid9PC9zcGFuPjwvaDM+CiAgICR7VC5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+Q2FwYWJpbGl0eTwvdGg+PHRoPk93bmVyIEFnZW50PC90aD48dGg+RXZlcnk8L3RoPjx0aD5MYXN0IFJ1bjwvdGg+PHRoPlJlc3VsdDwvdGg+PHRoPlJ1bnM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7VC5tYXAodD0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2ModC5jYXApfTwvYj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoKFMuY2Fwc3x8W10pLmZpbmQoYz0+Yy5jYXA9PT10LmNhcCk/LmRlc2N8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC5vd25lcil9PC90ZD4KICAgIDx0ZD48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0id2lkdGg6NzRweDtwYWRkaW5nOjRweCA3cHgiIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7dC5ldmVyeX0iCiAgICAgICAgb25jaGFuZ2U9InNldEV2ZXJ5KCcke3QuaWR9Jyx0aGlzLnZhbHVlKSIgdGl0bGU9InNlY29uZHMiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2V2ZXJ5KHQuZXZlcnkpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2Fnbyh0Lmxhc3RBdCl9PC90ZD4KICAgIDx0ZD4ke3QubGFzdE1zZz9gPHNwYW4gY2xhc3M9InRhZyAke3QubGFzdE9rPyd0LWdybic6J3QtcmVkJ30iPiR7dC5sYXN0T2s/J09LJzonRkFJTCd9PC9zcGFuPiAke2VzYyh0Lmxhc3RNc2cpfWA6JzxzcGFuIGNsYXNzPSJtb25vLWRpbSI+bm90IHlldCBydW48L3NwYW4+J308L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHt0LnJ1bnN8fDB9JHt0LmZhaWxzPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPi8nK3QuZmFpbHMrJ+Kclzwvc3Bhbj4nOicnfTwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJ1bk5vdygnJHt0LmlkfScpIj5SdW48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZ2dsZVRhc2soJyR7dC5pZH0nLCR7IXQuZW5hYmxlZH0pIj4ke3QuZW5hYmxlZD8nUGF1c2UnOidTdGFydCd9PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0YW5kaW5nIG9yZGVycy4gUG93ZXIgdGhlIHN5c3RlbSBvbiB0byBpbnN0YWxsIHRoZW0uPC9kaXY+J308L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXhlY3V0aW9uIEZlZWQgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtSLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtSLmxlbmd0aD9gPGRpdiBjbGFzcz0ibG9nIj4ke1IubWFwKHI9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtyLnR9PC9zcGFuPgogICAgIDxzcGFuIHN0eWxlPSJjb2xvcjoke3Iub2s/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPlske3Iub2s/J0RPTkUnOidGQUlMJ31dPC9zcGFuPgogICAgIDxiPiR7ZXNjKHIub3duZXIpfTwvYj4gwrcgJHtlc2Moci5jYXApfSDigJQgJHtlc2Moci5tc2cpfSR7ci5kZXRhaWw/YFxuICAgICAgICDihrMgJHtlc2Moci5kZXRhaWwpfWA6Jyd9CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oJHtyLm1zfW1zJHtyLm1hbnVhbD8nIMK3IG1hbnVhbCc6Jyd9KTwvc3Bhbj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gCiAgIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgZXhlY3V0ZWQgeWV0LiBQb3dlciBvbiBhbmQgdGhlIGZpcnN0IHN3ZWVwIHJ1bnMgd2l0aGluIDEwIHNlY29uZHMuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLm9wcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MucnVubmluZz8nIzFjNWMzYyc6JyM2YjIyMzMnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtTLnJ1bm5pbmc/JyMwODE3MGYnOicjMTYwYjBjJ30sIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6JHtTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPuKWtiBNQVNURVIgUE9XRVIg4oCUICR7Uy5ydW5uaW5nPydTWVNURU0gUlVOTklORyc6J1NZU1RFTSBIQUxURUQnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4ke1MucnVubmluZwogICA/J0V2ZXJ5IHN0YW5kaW5nIG9yZGVyIGJlbG93IGlzIGV4ZWN1dGluZyBvbiBpdHMgb3duIHNjaGVkdWxlLiBUaGUgQ2hhaXJtYW4gaXMgZG9pbmcgcmVhbCB3b3JrIHJpZ2h0IG5vdyDigJQgcHJvYmluZyB5b3VyIHNpdGVzLCBhdWRpdGluZyB0aGUgbGVkZ2VyLCBjb21wdXRpbmcgU0xBcywgd3JpdGluZyBicmllZnMg4oCUIHdpdGhvdXQgeW91IHRvdWNoaW5nIGFueXRoaW5nLicKICAgOic8Yj5Ob3RoaW5nIGlzIHJ1bm5pbmcuPC9iPiBTaWduIGJlbG93IHRvIGJyaW5nIHRoZSB3aG9sZSBzeXN0ZW0gb25saW5lLiBPbmNlIHJ1bm5pbmcgaXQgZG9lcyBub3Qgc3RvcCB1bnRpbCB5b3UgaGFsdCBpdC4nfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMzBweCIgdHlwZT0icGFzc3dvcmQiIGlkPSJwd3JQdyIgcGxhY2Vob2xkZXI9IllvdXIgcGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLnJ1bm5pbmc/J25vJzoncCd9IiBvbmNsaWNrPSJwb3dlcigpIj4ke1MucnVubmluZz8nSEFMVCBFVkVSWVRISU5HJzonU1RBUlQgRVZFUllUSElORyd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icmVzZXRUYXNrcygpIj5SZWluc3RhbGwgc3RhbmRpbmcgb3JkZXJzPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlNjaGVkdWxlciB0aWNrcyBldmVyeSAxMHMuIE9ubHkgeW91IGNhbiBzdGFydCBvciBzdG9wIGl0IOKAlCBub3RoaW5nIGVsc2UgY2FuLjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9Im9wcyI+JHtMSVZFLm9wcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHBvd2VyKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9wb3dlcicse29uOiFTLnJ1bm5pbmcscHc6cHdyUHcudmFsdWV9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLnJ1bm5pbmc/J1NZU1RFTSBSVU5OSU5HIOKAlCBhZ2VudHMgZXhlY3V0aW5nJzonU3lzdGVtIGhhbHRlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2V0RXZlcnkoaWQsdil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Rhc2snLHtpZCxldmVyeTordn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhc2soaWQsb24peyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS90YXNrJyx7aWQsZW5hYmxlZDpvbn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHJ1bk5vdyhpZCl7IGZsYXNoKCdFeGVjdXRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcnVubm93Jyx7aWR9KTsgcmVuZGVyKCk7IGZsYXNoKHIubXNnKSB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2V0VGFza3MoKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcmVzZXQnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdTdGFuZGluZyBvcmRlcnMgcmVpbnN0YWxsZWQnKSB9CgovKiAtLS0tLS0tLS0tIFNFTEYtVVBHUkFERSAtLS0tLS0tLS0tICovCkxJVkUuZXZvbHZlPSgpPT57CiAgY29uc3QgUD0oUy5wcm9wb3NhbHN8fFtdKS5maWx0ZXIocD0+cC5zdGF0dXM9PT0nUEVORElORycpOwogIGNvbnN0IEU9Uy5ldm9sdXRpb258fFtdOwogIGNvbnN0IGFwcGxpZWQ9RS5maWx0ZXIoZT0+ZS5kZWNpc2lvbj09PSdBUFBMSUVEJykubGVuZ3RoOwogIGNvbnN0IHJlamVjdGVkPUUuZmlsdGVyKGU9PmUuZGVjaXNpb249PT0nUkVKRUNURUQnKS5sZW5ndGg7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUC5sZW5ndGgsJ1VwZ3JhZGVzIEF3YWl0aW5nIFlvdScsUC5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxQLmxlbmd0aD8nbmVlZHMgeW91ciBzaWduYXR1cmUnOidub3RoaW5nIHBlbmRpbmcnKX0KICAgJHtrcGkoYXBwbGllZCwnVXBncmFkZXMgQXBwbGllZCcsJ3ZhcigtLWdybiknLCdsaWZldGltZScpfQogICAke2twaShyZWplY3RlZCwnUmVqZWN0ZWQnLCd2YXIoLS1kaW0pJywnbmV2ZXIgcmUtcHJvcG9zZWQnKX0KICAgJHtrcGkoUy5zY2FuQ291bnR8fDAsJ1NlbGYtU2NhbnMgUnVuJywndmFyKC0tY3kpJywnZXZlcnkgNjAgc2Vjb25kcycpfTwvZGl2PgogICR7UC5sZW5ndGg/UC5tYXAocD0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtwLmtsYXNzPT09J1NBRkUnPycjMWM1YzNjJzonIzY3NDcwZid9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmtsYXNzPT09J1NBRkUnPyd0LWdybic6J3QtYW1iJ30iPiR7cC5rbGFzc308L3NwYW4+CiAgICAgIDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48L2Rpdj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7cC5pZH0gwrcgJHtwLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo3cHgiPiR7ZXNjKHAud2h5KX08L2Rpdj4KICAgICR7cC5ldmlkZW5jZT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+RXZpZGVuY2U6ICR7ZXNjKHAuZXZpZGVuY2UpfTwvZGl2PmA6Jyd9CiAgICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXgtd2lkdGg6MzIwcHgiPjxzcGFuPlNpZ24gd2l0aCB5b3VyIHBhc3N3b3JkIHRvIGF1dGhvcml6ZTwvc3Bhbj4KICAgICA8aW5wdXQgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgaWQ9InB3XyR7cC5pZH0iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywxKSI+QVVUSE9SSVpFIFVQR1JBREU8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywwKSI+UkVKRUNUIFBFUk1BTkVOVExZPC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJlcnIiIGlkPSJlcl8ke3AuaWR9Ij48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB1cGdyYWRlcyBwZW5kaW5nLiBUaGUgQ2hhaXJtYW4gc2NhbnMgaXRzZWxmIGV2ZXJ5IDYwIHNlY29uZHMgYW5kIHdpbGwgcmFpc2UgYSBwcm9wb3NhbCBoZXJlIHRoZSBtb21lbnQgaXQgZmluZHMgYSByZWFsIHdlYWtuZXNzIOKAlCBhIGZsYWt5IHNpdGUsIGFuIGV4cGlyaW5nIGNlcnRpZmljYXRlLCBhbiB1bnN0YWZmZWQgZmxvb3IsIGEgc2VjdXJpdHkgZ2FwLjwvZGl2PjwvZGl2PmB9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV2b2x1dGlvbiBIaXN0b3J5PC9oMz4KICAgJHtFLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Q2hhbmdlPC90aD48dGg+RGVjaXNpb248L3RoPjx0aD5SZXN1bHQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7RS5tYXAoZT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2UudH08L3RkPjx0ZD4ke2VzYyhlLmxhYmVsKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS53aHl8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtlLmRlY2lzaW9uPT09J0FQUExJRUQnPyd0LWdybic6J3QtcmVkJ30iPiR7ZS5kZWNpc2lvbn08L3NwYW4+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUuaG93fHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUucmVzdWx0fHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPlRoZSBDaGFpcm1hbiBoYXMgbm90IGNoYW5nZWQgaXRzZWxmIHlldC48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIuZXZvbHZlPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4p+zIENPTlRJTlVPVVMgU0VMRi1VUEdSQURFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlRoZSBDaGFpcm1hbiBhdWRpdHMgaXRzIG93biBzdGF0ZSBldmVyeSA2MCBzZWNvbmRzIGFnYWluc3QgcmVhbCB0ZWxlbWV0cnkg4oCUIHVwdGltZSByZWNvcmRzLCBUTFMgZXhwaXJ5LCBhdXRoIGZhaWx1cmVzLCBsZWRnZXIgc2l6ZSwgZmxvb3Igc3RhZmZpbmcsIG1haWwgcmVhZGluZXNzLiBXaGVuIGl0IGZpbmRzIGEgZ2VudWluZSB3ZWFrbmVzcyBpdCBwcm9wb3NlcyBhIGZpeCBoZXJlIGFuZCA8Yj5mcmVlemVzIHVudGlsIHlvdSBzaWduIGl0PC9iPi48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPk5vdGhpbmcgc2VsZi1pbnN0YWxscyBieSBkZWZhdWx0LjwvYj4gRXZlcnkgdXBncmFkZSBuZWVkcyB5b3VyIHBhc3N3b3JkLCBzYW1lIGFzIGEgcGVybWlzc2lvbiBnYXRlLjwvbGk+CiAgIDxsaT48Yj5TQUZFPC9iPiA9IHJldmVyc2libGUgdHVuaW5nIChwcm9iZSBpbnRlcnZhbHMsIGxlZGdlciBjb21wYWN0aW9uLCBza2lsbHMpLiA8Yj5SRVZJRVc8L2I+ID0gY2hhbmdlcyB5b3VyIHJvc3RlciBvciByYWlzZXMgYSBzZWN1cml0eSBnYXRlLjwvbGk+CiAgIDxsaT5SZWplY3Qgb25jZSBhbmQgaXQgaXMgPGI+c3VwcHJlc3NlZCBwZXJtYW5lbnRseTwvYj4g4oCUIHRoZSBDaGFpcm1hbiB3aWxsIG5vdCBuYWcgeW91IGFib3V0IGl0IGFnYWluLjwvbGk+CiAgIDxsaT5JdCBwcm9wb3NlcyBvbmx5IG9uIGV2aWRlbmNlIGZyb20geW91ciBhY3R1YWwgcnVubmluZyBzeXN0ZW0uIEl0IGRvZXMgbm90IGludmVudCB3b3JrLjwvbGk+CiAgPC91bD4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2Nhbk5vdygpIj5SVU4gU0VMRi1TQ0FOIE5PVzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvcGlsb3Q/J3QtcmVkJzondC1kaW0nfSI+QVVUT1BJTE9UICR7Uy5hdXRvcGlsb3Q/J09OJzonT0ZGJ308L3NwYW4+CiAgPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5hdXRvcGlsb3Q/JyM2YjIyMzMnOid2YXIoLS1saW5lKSd9Ij4KICA8aDM+QXV0b3BpbG90ICR7Uy5hdXRvcGlsb3Q/JzxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPkFDVElWRTwvc3Bhbj4nOicnfTwvaDM+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPldpdGggYXV0b3BpbG90IG9uLCA8Yj5TQUZFLWNsYXNzPC9iPiB1cGdyYWRlcyBhcHBseSB0aGVtc2VsdmVzIHRoZSBtb21lbnQgdGhleSBhcmUgZm91bmQg4oCUIG5vIHNpZ25hdHVyZS4gUkVWSUVXLWNsYXNzIGFsd2F5cyB3YWl0cyBmb3IgeW91IHJlZ2FyZGxlc3MuIEV2ZXJ5IGF1dG9ub21vdXMgY2hhbmdlIGlzIHN0aWxsIHdyaXR0ZW4gdG8gdGhlIGV2b2x1dGlvbiBoaXN0b3J5LiBUaGlzIGlzIHJlYWwgYXV0b25vbXk6IHR1cm4gaXQgb24gb25seSBpZiB5b3UgYWNjZXB0IHRoZSBDaGFpcm1hbiBjaGFuZ2luZyBpdHMgb3duIHR1bmluZyB3aGlsZSB5b3Ugc2xlZXAuPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIyMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9ImFwUHciIHBsYWNlaG9sZGVyPSJDb25maXJtIHBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvcGlsb3Q/J25vJzoncCd9IiBvbmNsaWNrPSJ0b2dnbGVBdXRvKCkiPiR7Uy5hdXRvcGlsb3Q/J0RJU0FCTEUgQVVUT1BJTE9UJzonRU5BQkxFIEFVVE9QSUxPVCd9PC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iZXZvbHZlIj4ke0xJVkUuZXZvbHZlKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZGVjaWRlVXAoaWQsb2spewogIGNvbnN0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VyXycraWQpOyBlLnRleHRDb250ZW50PScnOwogIGNvbnN0IHB3PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwd18nK2lkKS52YWx1ZTsKICBpZighcHcpIHJldHVybiBlLnRleHRDb250ZW50PSdTaWduYXR1cmUgcmVxdWlyZWQuJzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvZGVjaWRlJyx7aWQsb2s6ISFvayxwd30pOwogICAgcmVuZGVyKCk7IGZsYXNoKG9rPygnVVBHUkFERUQgwrcgJysoci5yZXN1bHR8fCcnKSk6J1JlamVjdGVkIHBlcm1hbmVudGx5Jyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2Nhbk5vdygpeyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL3NjYW4nLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5wZW5kaW5nP3IucGVuZGluZysnIHVwZ3JhZGUocykgYXdhaXRpbmcgeW91ciBzaWduYXR1cmUnOidTY2FuIGNsZWFuIOKAlCBub3RoaW5nIHRvIGltcHJvdmUnKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUF1dG8oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2F1dG9waWxvdCcse29uOiFTLmF1dG9waWxvdCxwdzphcFB3LnZhbHVlfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvcGlsb3Q/J0FVVE9QSUxPVCBPTiDigJQgc2FmZSB1cGdyYWRlcyBub3cgc2VsZi1hcHBseSc6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiAtLS0tLS0tLS0tIExFQVJORUQgU0tJTExTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNraWxsczI9KCk9PnsKICBjb25zdCBLPVMuc2tpbGxzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UZWFjaCB0aGUgQ2hhaXJtYW4gPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QRVJTSVNUUyBGT1JFVkVSPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij5Bbnl0aGluZyB5b3UgdGVhY2ggaXMgc3RvcmVkIHNlcnZlci1zaWRlIGFuZCBzdXJ2aXZlcyByZXN0YXJ0cywgcmVkZXBsb3lzIGFuZCBldmVyeSBkZXZpY2UgeW91IGxvZyBpbiBmcm9tLiBUZWFjaCBpdCB5b3VyIHNob3J0aGFuZCwgeW91ciBydW5ib29rcywgeW91ciBzdGFuZGluZyBvcmRlcnMuPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UcmlnZ2VyIHBocmFzZTwvc3Bhbj48aW5wdXQgaWQ9InNrUGhyYXNlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJtb3JuaW5nIGNoZWNrIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGl0IG1lYW5zIC8gZG9lczwvc3Bhbj48aW5wdXQgaWQ9InNrQWN0aW9uIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJTY2FuIGFsbCBtb25pdG9ycyBhbmQgcmVwb3J0IGFueXRoaW5nIGJlbG93IDk5JSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VHlwZTwvc3Bhbj48c2VsZWN0IGlkPSJza0tpbmQiIGNsYXNzPSJpbiI+CiAgICAgPG9wdGlvbiB2YWx1ZT0ibm90ZSI+U3RhbmRpbmcgb3JkZXI8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJhbGlhcyI+Q29tbWFuZCBzaG9ydGN1dDwvb3B0aW9uPgogICAgIDxvcHRpb24gdmFsdWU9InJ1bmJvb2siPlJ1bmJvb2sgc3RlcDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9InBvbGljeSI+UG9saWN5IHJ1bGU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0idGVhY2goKSI+VEVBQ0ggSVQ8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+S25vd24gU2tpbGxzIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Sy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7Sy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+UGhyYXNlPC90aD48dGg+TWVhbmluZzwvdGg+PHRoPlR5cGU8L3RoPjx0aD5Vc2VkPC90aD48dGg+TGVhcm5lZDwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtLLm1hcChzPT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyhzLnBocmFzZSl9PC9iPjwvdGQ+PHRkPiR7ZXNjKHMuYWN0aW9uKX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7ZXNjKHMua2luZCl9PC9zcGFuPjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLnVzZXN8fDB9w5c8L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLmxlYXJuZWR9PGRpdj4ke2VzYyhzLm9yaWdpbnx8J293bmVyJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InVzZVNraWxsKCcke2VzYyhzLnBocmFzZSl9JykiPlJlY2FsbDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZm9yZ2V0KCcke2VzYyhzLnBocmFzZSl9JykiPkZvcmdldDwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIHRhdWdodCB5ZXQuIFRyeSBwaHJhc2UgIm1vcm5pbmcgY2hlY2siIOKGkiAiU2NhbiBhbGwgbW9uaXRvcnMgYW5kIHJlcG9ydCBhbnl0aGluZyBiZWxvdyA5OSUgYXZhaWxhYmlsaXR5Ii48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiB0ZWFjaCgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL3RlYWNoJyx7cGhyYXNlOnNrUGhyYXNlLnZhbHVlLGFjdGlvbjpza0FjdGlvbi52YWx1ZSxraW5kOnNrS2luZC52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdTa2lsbCBsZWFybmVkIOKAlCBpdCBwZXJzaXN0cyBhY3Jvc3MgcmVzdGFydHMnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGZvcmdldChwKXsgaWYoIWNvbmZpcm0oJ0ZvcmdldCAiJytwKyciPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL2ZvcmdldCcse3BocmFzZTpwfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdXNlU2tpbGwocCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NraWxsL3VzZScse3BocmFzZTpwfSk7IHJlbmRlcigpOwogIG1vZGFsKGA8aDM+JHtlc2MocCl9PC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAiPjxkaXY+JHtlc2Moci5hY3Rpb24pfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCkgfQoKLyogLS0tLS0tLS0tLSBVUFRJTUUgTUFSU0hBTCAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHVwQmFyKG0pewogIGNvbnN0IGg9KG0uaGlzdG9yeXx8W10pLnNsaWNlKC00MCk7CiAgaWYoIWgubGVuZ3RoKSByZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iZm9udC1zaXplOjEwcHgiPm5vIGNoZWNrcyB5ZXQ8L2Rpdj4nOwogIHJldHVybiAnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoycHg7YWxpZ24taXRlbXM6ZmxleC1lbmQ7aGVpZ2h0OjI2cHgiPicraC5tYXAoeD0+CiAgIGA8ZGl2IHRpdGxlPSIke3gudH0gwrcgSFRUUCAke3guY29kZX0gwrcgJHt4Lm1zfW1zIiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDozcHg7aGVpZ2h0OiR7eC5vaz9NYXRoLm1heCgzMCxNYXRoLm1pbigxMDAsMTAwLXgubXMvMjUpKToxMDB9JTtiYWNrZ3JvdW5kOiR7eC5vaz8nIzMxZDY3YSc6JyNmZjNiNmInfTtib3JkZXItcmFkaXVzOjFweDtvcGFjaXR5Oi45Ij48L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+JzsKfQpMSVZFLnVwdGltZT0oKT0+ewogIGNvbnN0IE09Uy5tb25pdG9yc3x8W10sIGRvd249TS5maWx0ZXIobT0+bS5zdGF0ZT09PSdET1dOJykubGVuZ3RoOwogIGNvbnN0IHRvdD1NLnJlZHVjZSgoYSxtKT0+YSsobS5jaGVja3N8fDApLDApLCB1cHM9TS5yZWR1Y2UoKGEsbSk9PmErKG0udXB8fDApLDApOwogIGNvbnN0IGF2YWlsPXRvdD8oKHVwcy90b3QpKjEwMCkudG9GaXhlZCgyKTon4oCUJzsKICBjb25zdCBhdmc9TS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aD9NYXRoLnJvdW5kKE0ucmVkdWNlKChhLG0pPT5hKyhtLmxhc3RNc3x8MCksMCkvTS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aCk6MDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShNLmxlbmd0aCwnVGFyZ2V0cyBNb25pdG9yZWQnLCd2YXIoLS1jeSknLCdwcm9iZSBldmVyeSAxNXMnKX0KICAgJHtrcGkoZG93biwnQ3VycmVudGx5IERvd24nLGRvd24/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyxkb3duPydJTkNJREVOVCBBQ1RJVkUnOidhbGwgcmVhY2hhYmxlJyl9CiAgICR7a3BpKGF2YWlsKyhhdmFpbD09PSfigJQnPycnOiclJyksJ0F2YWlsYWJpbGl0eScsJ3ZhcigtLWdybiknLHRvdCsnIGNoZWNrcycpfQogICAke2twaShhdmcrJyBtcycsJ0F2ZyBSZXNwb25zZScsYXZnPjE1MDA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJywnbGFzdCBjeWNsZScpfTwvZGl2PgogICR7TS5sZW5ndGg/TS5tYXAobT0+ewogICAgY29uc3QgYT1tLmNoZWNrcz8oKG0udXAvbS5jaGVja3MpKjEwMCkudG9GaXhlZCgyKTonMC4wMCc7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHttLnN0YXRlPT09J1VQJz8ndC1ncm4nOm0uc3RhdGU9PT0nRE9XTic/J3QtcmVkJzondC1kaW0nfSI+JHttLnN0YXRlfTwvc3Bhbj4KICAgICAgPGI+JHtlc2MobS5uYW1lKX08L2I+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtLnVybCl9PC9zcGFuPjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxNb24oJyR7bS5pZH0nKSI+VW5iaW5kPC9idXR0b24+PC9kaXY+PC9kaXY+CiAgICAke3VwQmFyKG0pfQogICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5MYXN0IGNoZWNrPC90ZD48dGQ+JHttLmxhc3RBdHx8J+KAlCd9IMK3IEhUVFAgJHttLmxhc3RTdGF0dXN8fCfigJQnfSR7bS5sYXN0RXJyPycgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPicrZXNjKG0ubGFzdEVycikrJzwvc3Bhbj4nOicnfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF0ZW5jeTwvdGQ+PHRkPiR7bS5sYXN0TXN8fDB9IG1zIChwOTUgJHttLnA5NXx8MH0gbXMpPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmFpbGFiaWxpdHk8L3RkPjx0ZCBzdHlsZT0iY29sb3I6JHthPjk5Pyd2YXIoLS1ncm4pJzphPjk1Pyd2YXIoLS1hbWIpJzondmFyKC0tbWFnKSd9Ij4ke2F9JSDCtyAke20udXB8fDB9IHVwIC8gJHttLmRvd258fDB9IGRvd24gb2YgJHttLmNoZWNrc3x8MH08L3RkPjwvdHI+CiAgICAgJHttLnNzbD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRMUyBjZXJ0aWZpY2F0ZTwvdGQ+PHRkPiR7ZXNjKG0uc3NsLmlzc3Vlcil9IMK3IGV4cGlyZXMgaW4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7bS5zc2wuZGF5c19sZWZ0PDE0Pyd2YXIoLS1tYWcpJzptLnNzbC5kYXlzX2xlZnQ8NDU/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJ30iPiR7bS5zc2wuZGF5c19sZWZ0fSBkYXlzPC9zcGFuPjwvdGQ+PC90cj5gOicnfQogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5JbnRlcnZhbDwvdGQ+PHRkPiR7bS5pbnRlcnZhbH1zIMK3IGJvdW5kICR7bS5hZGRlZH08L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHRhcmdldHMgYm91bmQuIEFkZCB5b3VyIGxpdmUgc2l0ZXMgYW5kIGFwcHMgYmVsb3cg4oCUIHRoZSBVcHRpbWUgTWFyc2hhbCB3aWxsIHByb2JlIHRoZW0gZm9yIHJlYWwuPC9kaXY+PC9kaXY+J30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SW5jaWRlbnQgSGlzdG9yeTwvaDM+JHsoUy5pbmNpZGVudHN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgIDx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5UYXJnZXQ8L3RoPjx0aD5UcmFuc2l0aW9uPC90aD48dGg+RGV0YWlsPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke1MuaW5jaWRlbnRzLm1hcChpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7aS50fTwvdGQ+PHRkPiR7ZXNjKGkubmFtZSl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7aS50bz09PSdET1dOJz8ndC1yZWQnOid0LWdybid9Ij4ke2kuZnJvbX0g4oaSICR7aS50b308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGkuZGV0YWlsKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdGF0ZSB0cmFuc2l0aW9ucyByZWNvcmRlZC4gTm90aGluZyBoYXMgZmxhcHBlZC48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIudXB0aW1lPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QmluZCBUYXJnZXQgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5SRUFMIEhUVFAgUFJPQkVTPC9zcGFuPjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0ibVVybCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly95b3Vyc2l0ZS5jb20iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TGFiZWwgKG9wdGlvbmFsKTwvc3Bhbj48aW5wdXQgaWQ9Im1OYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJNYWluIHNpdGUiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW50ZXJ2YWwgKHNlYywgbWluIDE1KTwvc3Bhbj48aW5wdXQgaWQ9Im1JbnQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iNjAiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYWRkTW9uKCkiPkJJTkQgJmFtcDsgUFJPQkUgTk9XPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hlY2tOb3coKSI+Rk9SQ0UgQ0hFQ0sgQUxMPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvYmVzIGZvbGxvdyB1cCB0byAzIHJlZGlyZWN0cywgcmVhZCBUTFMgZXhwaXJ5LCBhbmQgcmVjb3JkIHA5NSBsYXRlbmN5LiBPbiBhbnkgVVDihpRET1dOIHRyYW5zaXRpb24gdGhlIFVwdGltZSBNYXJzaGFsIHdyaXRlcyBhIENSSVQgaW5jaWRlbnQgYW5kIGZpcmVzIGFuIGVtYWlsIHRocm91Z2ggdGhlIE1haWwgUmVsYXkuPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idXB0aW1lIj4ke0xJVkUudXB0aW1lKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gYWRkTW9uKCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL2FkZCcse3VybDptVXJsLnZhbHVlLnRyaW0oKSxuYW1lOm1OYW1lLnZhbHVlLnRyaW0oKSxpbnRlcnZhbDorbUludC52YWx1ZXx8NjB9KTsKIHJlbmRlcigpO2ZsYXNoKCdUYXJnZXQgYm91bmQgwrcgcHJvYmluZycpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBkZWxNb24oaWQpe2lmKCFjb25maXJtKCdVbmJpbmQgdGhpcyB0YXJnZXQ/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL3JlbW92ZScse2lkfSk7cmVuZGVyKCl9CmFzeW5jIGZ1bmN0aW9uIGNoZWNrTm93KCl7Zmxhc2goJ1Byb2JpbmcgYWxsIHRhcmdldHPigKYnKTthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9jaGVjaycse30pO3JlbmRlcigpO2ZsYXNoKCdQcm9iZSBjeWNsZSBjb21wbGV0ZScpfQoKLyogLS0tLS0tLS0tLSBNQUlMIFJFTEFZIC0tLS0tLS0tLS0gKi8KUkVOREVSLm1haWw9KCk9PnsKICBjb25zdCBzdD1TLnNtdHAsIG1zPVMubWFpbHN0YXR8fHtzZW50OjAsZmFpbGVkOjB9OwogIHJldHVybiBgJHshc3Q/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gT1VUQk9VTkQgTUFJTDwvaDM+CiAgIDxkaXY+RXZlcnkgMkZBIG5vdGlmaWNhdGlvbiBhbmQgb3V0YWdlIGFsZXJ0IGlzIGJlaW5nIHJlY29yZGVkIGFzIGFuIDxiPmludGVudCBvbmx5PC9iPi4gQ29uZmlndXJlIHlvdXIgb3duIFNNVFAgcmVsYXkgYmVsb3cgdG8gbWFrZSB0aGVtIHJlYWwuIFRoZSBDaGFpcm1hbiB3aWxsIG5ldmVyIGFzayBmb3IgdGhlc2UgaW4gY2hhdCDigJQgeW91IGVudGVyIHRoZW0gaGVyZSwgYW5kIHRoZSBwYXNzd29yZCBpcyBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9kaXY+PC9kaXY+YAogIDpgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMWM1YzNjO2JhY2tncm91bmQ6IzA4MTcwZiI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5SRUxBWSBBUk1FRDwvaDM+CiAgIDxkaXY+T3V0Ym91bmQgZW1haWwgaXMgbGl2ZSB2aWEgJHtlc2Moc3QuaG9zdCl9OiR7c3QucG9ydH0uICR7bXMuc2VudH0gZGVsaXZlcmVkLCAke21zLmZhaWxlZH0gZmFpbGVkIHRoaXMgcHJvY2Vzcy48L2Rpdj48L2Rpdj5gfQogIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShtcy5zZW50LCdEZWxpdmVyZWQnLCd2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKG1zLmZhaWxlZCwnRmFpbGVkJyxtcy5mYWlsZWQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKHN0PydBUk1FRCc6J09GRkxJTkUnLCdSZWxheSBTdGF0dXMnLHN0Pyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKScsc3Q/ZXNjKHN0Lmhvc3QpOidpbnRlbnQtb25seSBtb2RlJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TTVRQIENvbmZpZ3VyYXRpb248L2gzPgogICAgPGRpdiBjbGFzcz0id2FybmJveCI+VXNlIGFuIDxiPmFwcC1zcGVjaWZpYyBwYXNzd29yZDwvYj4sIG5ldmVyIHlvdXIgbWFpbiBhY2NvdW50IHBhc3N3b3JkLiBHbWFpbDogPGNvZGU+c210cC5nbWFpbC5jb206NTg3PC9jb2RlPi4gT3V0bG9vazogPGNvZGU+c210cC1tYWlsLm91dGxvb2suY29tOjU4NzwvY29kZT4uIFpvaG86IDxjb2RlPnNtdHAuem9oby5jb206NTg3PC9jb2RlPi4gQWxsIGZyZWUgdGllcnMg4oCUIG5vIHBhaWQgc2VydmljZSByZXF1aXJlZC48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U01UUCBIb3N0PC9zcGFuPjxpbnB1dCBpZD0ic0hvc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InNtdHAuZ21haWwuY29tIiB2YWx1ZT0iJHtzdD9lc2Moc3QuaG9zdCk6Jyd9Ij48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UG9ydDwvc3Bhbj48aW5wdXQgaWQ9InNQb3J0IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7c3Q/c3QucG9ydDo1ODd9Ij48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Vc2VybmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNVc2VyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QXBwIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0ic1Bhc3MiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Gcm9tIEFkZHJlc3M8L3NwYW4+PGlucHV0IGlkPSJzRnJvbSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSIgdmFsdWU9IiR7c3Q/ZXNjKHN0LmZyb20pOicnfSI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyb20gTmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNOYW1lIiBjbGFzcz0iaW4iIHZhbHVlPSIke3N0P2VzYyhzdC5uYW1lKTonQ2hhaXJtYW4gQWdlbnQgT1MnfSI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW1wbGljaXQgVExTIChwb3J0IDQ2NSk8L3NwYW4+PHNlbGVjdCBpZD0ic1NlYyIgY2xhc3M9ImluIj4KICAgICA8b3B0aW9uIHZhbHVlPSIwIiAke3N0JiYhc3Quc2VjdXJlPydzZWxlY3RlZCc6Jyd9Pk5vIOKAlCBTVEFSVFRMUyBvbiA1ODc8L29wdGlvbj4KICAgICA8b3B0aW9uIHZhbHVlPSIxIiAke3N0JiZzdC5zZWN1cmU/J3NlbGVjdGVkJzonJ30+WWVzIOKAlCBTTVRQUyBvbiA0NjU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2F2ZVNtdHAoKSI+QVJNIFJFTEFZPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0U210cCgpIj5TRU5EIFRFU1QgRU1BSUw8L2J1dHRvbj4KICAgICAke3N0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlU210cCgpIj5QdXJnZTwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWxpdmVyeSBMb2c8L2gzPiR7KFMubWFpbHF8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgICA8dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+U3ViamVjdDwvdGg+PHRoPlN0YXR1czwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7Uy5tYWlscS5tYXAobT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke20udH08L3RkPjx0ZD4ke2VzYyhtLnN1YmplY3QpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj7ihpIgJHtlc2MobS50byl9PC9kaXY+PC90ZD4KICAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAkey9ERUxJVkVSRUQvLnRlc3QobS5zdGF0dXMpPyd0LWdybic6L1VOU0VOVC8udGVzdChtLnN0YXR1cyk/J3QtYW1iJzondC1yZWQnfSI+JHtlc2MobS5zdGF0dXMpfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gbWFpbCBhdHRlbXB0ZWQgeWV0LjwvZGl2Pid9CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5UYXJnZXQgaW5ib3g6IDxiPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC9iPi4gQ2hhbmdlIGl0IGluIE93bmVyIFNldHRpbmdzLjwvZGl2PjwvZGl2PgogIDwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBzYXZlU210cCgpewogdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc210cCcse2hvc3Q6c0hvc3QudmFsdWUudHJpbSgpLHBvcnQ6K3NQb3J0LnZhbHVlfHw1ODcsc2VjdXJlOnNTZWMudmFsdWU9PT0nMScsCiAgIHVzZXI6c1VzZXIudmFsdWUudHJpbSgpLHBhc3M6c1Bhc3MudmFsdWUsZnJvbTpzRnJvbS52YWx1ZS50cmltKCksbmFtZTpzTmFtZS52YWx1ZS50cmltKCl9KTsKICByZW5kZXIoKTsgZmxhc2goJ1JlbGF5IGFybWVkIOKAlCBzZW5kIGEgdGVzdCBlbWFpbCB0byBjb25maXJtJyk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gdGVzdFNtdHAoKXsgZmxhc2goJ0RpYWxpbmcgU01UUCByZWxheeKApicpOwogdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zbXRwL3Rlc3QnLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5vaz8nREVMSVZFUkVEIOKAlCBjaGVjayB5b3VyIGluYm94JzonRkFJTEVEOiAnKyhyLnJlYXNvbnx8J3Vua25vd24nKSk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VTbXRwKCl7IGlmKCFjb25maXJtKCdQdXJnZSByZWxheT8gTWFpbCByZXZlcnRzIHRvIGludGVudC1vbmx5LicpKXJldHVybjsKIGF3YWl0IEFQSSgnL2FwaS9zbXRwL3B1cmdlJyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnUmVsYXkgcHVyZ2VkJykgfQoKLyogLS0tLS0tLS0tLSBERVZJQ0VTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmRldmljZXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBNdWx0aS1EZXZpY2UgU3luYyA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5SRUFMPC9zcGFuPjwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlN0YXRlIGxpdmVzIG9uIHRoZSBzZXJ2ZXIsIG5vdCB0aGUgYnJvd3Nlci4gRXZlcnkgZGV2aWNlIHBvbGxzIGV2ZXJ5IDMgc2Vjb25kcyBhbmQgYWRvcHRzIHJldmlzaW9uIGNoYW5nZXMgYXV0b21hdGljYWxseS48L2xpPgogIDxsaT5DdXJyZW50IHN0YXRlIHJldmlzaW9uIDxiPiR7Uy5yZXZ9PC9iPiDCtyA8Yj4ke3QubGl2ZV9zZXNzaW9uc308L2I+IHNlc3Npb24ocykgYWN0aXZlIGluIHRoZSBsYXN0IDcwcy48L2xpPgogIDxsaT5PcGVuIHRoaXMgc2FtZSBVUkwgb24geW91ciBwaG9uZSwgbG9nIGluIHdpdGggdGhlIHNhbWUgT3duZXIgSUQsIGFuZCBib3RoIHNjcmVlbnMgdHJhY2sgZWFjaCBvdGhlci4gUmFpc2UgYSBnYXRlIG9uIG9uZSwgaXQgYXBwZWFycyBvbiB0aGUgb3RoZXIuPC9saT4KICA8bGk+PGI+U2Vzc2lvbnMgYXJlIGR1cmFibGUuPC9iPiBXcml0dGVuIHRvIDxjb2RlPnNlc3Npb25zLmpzb248L2NvZGU+IChjaG1vZCA2MDApIHdpdGggYSAzMC1kYXkgVFRMIOKAlCByZXN0YXJ0aW5nIHRoZSBzZXJ2ZXIgbm8gbG9uZ2VyIGxvZ3MgeW91IG91dC4gUmV2b2tpbmcgYmVsb3cga2lsbHMgZXZlcnkgZGV2aWNlIGV4Y2VwdCB0aGlzIG9uZS48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2Vzc2lvbiBMb2c8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5JUDwvdGg+PHRoPlVzZXIgQWdlbnQ8L3RoPjx0aD5BdDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZGV2aWNlcy5tYXAoZD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLmlkKX08L3RkPjx0ZD4ke2VzYyhkLmlwfHwn4oCUJyl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLnVhKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC5hdH08L3RkPjwvdHI+YCkuam9pbignJyl8fCc8dHI+PHRkIGNvbHNwYW49IjQiIGNsYXNzPSJtb25vLWRpbSI+bm9uZTwvdGQ+PC90cj4nfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PgogPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InJldm9rZSgpIj5SRVZPS0UgQUxMIE9USEVSIFNFU1NJT05TPC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGhpcyBEZXZpY2U8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPlZpZXdwb3J0PC90ZD48dGQ+JHtpbm5lcldpZHRofSDDlyAke2lubmVySGVpZ2h0fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF5b3V0PC90ZD48dGQ+JHtpbm5lcldpZHRoPDg2MD8nTU9CSUxFIMK3IGNvbGxhcHNlZCBzaWRlYmFyJzonREVTS1RPUCDCtyBmaXhlZCBzaWRlYmFyJ308L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRyYW5zcG9ydDwvdGQ+PHRkPiR7bG9jYXRpb24ucHJvdG9jb2x9IMK3IHBvbGwgM3M8L3RkPjwvdHI+CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHJldm9rZSgpe2NvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Nlc3Npb25zL3Jldm9rZScse30pO3JlbmRlcigpO2ZsYXNoKHIucmV2b2tlZCsnIHNlc3Npb24ocykgcmV2b2tlZCcpfQoKLyogLS0tLS0tLS0tLSBET0NUUklORSAtLS0tLS0tLS0tICovClJFTkRFUi5kb2N0cmluZT0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvcmUgTWFuZGF0ZTwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjxiPlplcm8gc3VnYXItY29hdGluZy48L2I+IEZhaWx1cmVzLCBib3R0bGVuZWNrcyBhbmQgcmlza3MgcmVwb3J0ZWQgYXQgZnVsbCBzZXZlcml0eSwgdW5zb2Z0ZW5lZC48L2xpPgogIDxsaT48Yj5VbmNvbXByb21pc2luZyBvdmVyc2lnaHQuPC9iPiBFdmVyeSBzdWItYWdlbnQsIHRvb2wgY2FsbCwgZGVwbG95bWVudCBhbmQgdHJhbnNhY3Rpb24gcGFzc2VzIGEgZ2F0ZS48L2xpPgogIDxsaT48Yj5Pd25lciBwcmltYWN5LjwvYj4gQXV0aG9yaXR5IGZsb3dzIGZyb20gdGhlIHZlcmlmaWVkIE93bmVyIG9ubHkuIE5vIHB1YmxpYyB1c2VyLCBleHRlcm5hbCByZXF1ZXN0IG9yIHN1Yi1hZ2VudCBieXBhc3NlcyBhIGdhdGUuPC9saT4KICA8bGk+PGI+WmVybyBjb3N0LjwvYj4gVGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCByYXRoZXIgdGhhbiBmdW5kaW5nIGl0LjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIFNPUDwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjEgwrcgT2JqZWN0aXZlLCBzdWNjZXNzIGNyaXRlcmlhLCBvcGVyYXRpb25hbCBib3VuZGFyaWVzLjwvbGk+CiAgPGxpPjIgwrcgSnVzdGlmeSBldmVyeSBhc3NpZ25lZCBhZ2VudCBhbmQgdG9vbC48L2xpPgogIDxsaT4zIMK3IEVudW1lcmF0ZSByb2xsYmFjaywgYXVkaXRzLCBtaXRpZ2F0aW9ucy48L2xpPgogIDxsaT40IMK3IEhhbHQgdW50aWwgT3duZXIgY3J5cHRvZ3JhcGhpYyBjbGVhcmFuY2UgaXMgc2lnbmVkIOKAlCBlbmZvcmNlZCBieSB0aGUgc2VydmVyLCBub3QgdGhlIFVJLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UcmVhc3VyeSBTYWZlZ3VhcmRzPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+Q3JlZGVudGlhbHMgbmV2ZXIgcmVxdWVzdGVkIGluIGNoYXQsIG5ldmVyIHdyaXR0ZW4gdG8gYW55IGxvZy48L2xpPgogIDxsaT5Pd25lciBlbnRlcnMgcGF5b3V0IGRldGFpbHMgb25seSBpbiB0aGUgaXNvbGF0ZWQgVmF1bHQgcGFuZWw7IG9ubHkgbWFza2VkIHZhbHVlcyBhcmUgcGVyc2lzdGVkLjwvbGk+CiAgPGxpPlRyYW5zZmVycyByZXF1aXJlIHBhc3N3b3JkIHNpZ25hdHVyZTsgc2VydmVyIGhhcmQtYmxvY2tzIHdpdGggbm8gc2VhbGVkIGNoYW5uZWwuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkhvbmVzdCBMaW1pdHMg4oCUIFJlYWQgVGhpczwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlBlcnNpc3RlbmNlIGlzIGEgSlNPTiBmaWxlIG9uIHRoaXMgc2VydmVyLiBLaWxsIHRoZSBzYW5kYm94IGFuZCBpdCBkaWVzIHdpdGggaXQg4oCUIGV4cG9ydCB0aGUgYXVkaXQgbGVkZ2VyIGlmIGl0IG1hdHRlcnMuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5ObyBvdXRib3VuZCBuZXR3b3JrLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gcmVhbCBTTVRQIGNsaWVudCAobm9kZTpuZXQgKyBub2RlOnRscywgemVybyBkZXBzKS4gQXJtIGl0IGluIE1haWwgUmVsYXkgd2l0aCB5b3VyIG93biBhcHAgcGFzc3dvcmQgYW5kIDJGQSBiZWNvbWVzIGRlbGl2ZXJlZCBtYWlsLCBub3QgaW50ZW50LjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+VGVsZW1ldHJ5IGlzIG9ubHkgdGhpcyBwcm9jZXNzLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gVXB0aW1lIE1hcnNoYWwgcnVucyByZWFsIEhUVFAvSFRUUFMgcHJvYmVzIGFnYWluc3QgYW55IFVSTCB5b3UgYmluZCDigJQgc3RhdHVzLCBsYXRlbmN5LCBwOTUsIFRMUyBleHBpcnksIGluY2lkZW50IHRyYW5zaXRpb25zLjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+U2Vzc2lvbnMgYXJlIGluLW1lbW9yeS48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IGR1cmFibGUgdG8gZGlzaywgMzAtZGF5IFRUTCwgc3Vydml2ZXMgcmVzdGFydC48L2xpPgogIDxsaT48Yj5TdGlsbCB0cnVlOjwvYj4gU01UUCBjcmVkZW50aWFscyBzaXQgaW4gPGNvZGU+ZGF0YS5qc29uPC9jb2RlPiBvbiB0aGlzIGJveC4gVGhhdCBpcyBzdGFuZGFyZCBmb3IgYSBzZWxmLWhvc3RlZCByZWxheSwgYnV0IGl0IGlzIG5vdCBhIGhhcmR3YXJlIHZhdWx0IOKAlCB1c2UgYW4gYXBwLXNwZWNpZmljIHBhc3N3b3JkIHlvdSBjYW4gcmV2b2tlLCBuZXZlciB5b3VyIHByaW1hcnkgb25lLjwvbGk+CiAgPGxpPjxiPlN0aWxsIHRydWU6PC9iPiBwcm9iZXMgcnVuIGZyb20gdGhpcyBzYW5kYm94LiBJZiB0aGUgc2FuZGJveCBoYXMgbm8gcm91dGUgdG8gYSBob3N0LCB0aGF0IHJlYWRzIGFzIERPV04gZXZlbiB3aGVuIHRoZSBob3N0IGlzIGZpbmUuIFZlcmlmeSBhbiBvdXRhZ2UgYmVmb3JlIGFjdGluZyBvbiBpdC48L2xpPgogIDxsaT5aZXJvLUNvc3QgbWVhbnMgbGF3ZnVsIGZyZWUgcm91dGVzIG9ubHkg4oCUIG5ldmVyIHBpcmFjeSwgc3RvbGVuIGtleXMgb3IgVG9TIGV2YXNpb24uPC9saT48L3VsPjwvZGl2PjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNFVFRJTkdTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNldHRpbmdzPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAke1Mub3duZXIuYm9vdHN0cmFwP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iZ3JpZC1jb2x1bW46MS8tMTtib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4pqgIEJPT1RTVFJBUCBDUkVERU5USUFMIEFDVElWRTwvaDM+CiAgPGRpdj5UaGUgc2VydmVyLWdlbmVyYXRlZCBwYXNzd29yZCBpcyBzdGlsbCBpbiBmb3JjZSBhbmQgYSBwbGFpbnRleHQgY29weSBzaXRzIGluIDxjb2RlPk9XTkVSX0NSRURFTlRJQUxTLnR4dDwvY29kZT4uIFJvdGF0ZSBub3cg4oCUIHJvdGF0aW9uIGRlbGV0ZXMgdGhhdCBmaWxlIGF1dG9tYXRpY2FsbHkuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JZGVudGl0eTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNjBweCI+T3duZXIgSUQ8L3RkPjx0ZD4ke2VzYyhTLm93bmVyLmlkKX08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBhc3N3b3JkPC90ZD48dGQ+UEJLREYyLVNIQTI1NiDCtyAxNTBrIGl0ZXJhdGlvbnMgwrcgc2VydmVyLXNpZGU8L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjJGQSBFbWFpbDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Qcm92aXNpb25lZDwvdGQ+PHRkPiR7Uy5vd25lci5jcmVhdGVkfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RG9jdHJpbmU8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5aRVJPLUNPU1QgRU5GT1JDRUQ8L3NwYW4+PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3RhdGUgUGFzc3dvcmQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VycmVudDwvc3Bhbj48aW5wdXQgaWQ9InJwT2xkIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IChtaW4gOCk8L3NwYW4+PGlucHV0IGlkPSJycE5ldyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icm90YXRlKCkiPlJPVEFURTwvYnV0dG9uPjxkaXYgY2xhc3M9ImVyciIgaWQ9InJwRXJyIj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFuZ2UgT3duZXIgSUQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IE93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0iaWROZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvbmZpcm0gUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJpZFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hnSWQoKSI+VVBEQVRFIElEPC9idXR0b24+PGRpdiBjbGFzcz0iZXJyIiBpZD0iaWRFcnIiPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPjJGQSBUYXJnZXQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IEVtYWlsPC9zcGFuPjxpbnB1dCBpZD0iZW1OZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZ01haWwoKSI+VVBEQVRFPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um9zdGVyPC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5SZXN0b3JlIHRoZSAxOCBkZWZhdWx0IHN1Yi1hZ2VudHMuPC9kaXY+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXNldFJvc3RlcigpIj5SRVNFVCBST1NURVI8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5EZXN0cnVjdGl2ZTwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db25maXJtIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0id3BQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9IndpcGUoKSI+V0lQRSBFTlRJUkUgSU5TVEFOQ0U8L2J1dHRvbj48L2Rpdj48L2Rpdj5gOwphc3luYyBmdW5jdGlvbiByb3RhdGUoKXtjb25zdCBlPXJwRXJyO2UudGV4dENvbnRlbnQ9Jyc7CiB0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL3JvdGF0ZScse29sZDpycE9sZC52YWx1ZSxuZXU6cnBOZXcudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnUGFzc3dvcmQgcm90YXRlZCDCtyBib290c3RyYXAgZmlsZSBkZXN0cm95ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ0lkKCl7Y29uc3QgZT1pZEVycjtlLnRleHRDb250ZW50PScnOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9pZCcse25ld2lkOmlkTmV3LnZhbHVlLnRyaW0oKSxwdzppZFB3LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ093bmVyIElEIHVwZGF0ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ01haWwoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL2VtYWlsJyx7ZW1haWw6ZW1OZXcudmFsdWUudHJpbSgpfSk7cmVuZGVyKCk7Zmxhc2goJzJGQSB0YXJnZXQgdXBkYXRlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXNldFJvc3Rlcigpe2lmKCFjb25maXJtKCdSZXNldCByb3N0ZXI/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9yZXNldCcse30pO3JlbmRlcigpO2ZsYXNoKCdSb3N0ZXIgcmVzZXQnKX0KYXN5bmMgZnVuY3Rpb24gd2lwZSgpe2lmKCFjb25maXJtKCdJUlJFVkVSU0lCTEUuIERlc3Ryb3kgYWxsIHNlcnZlciBzdGF0ZT8nKSlyZXR1cm47CiB0cnl7YXdhaXQgQVBJKCcvYXBpL3dpcGUnLHtwdzp3cFB3LnZhbHVlfSk7bG9jYXRpb24ucmVsb2FkKCl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIE1PREFMIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gbW9kYWwoaHRtbCl7Y2xvc2VNb2RhbCgpO2NvbnN0IGQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7ZC5jbGFzc05hbWU9J21vZGFsJztkLmlkPSdtZGwnOwogZC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9Im1ib3giPiR7aHRtbH08L2Rpdj5gO2Qub25jbGljaz1lPT57aWYoZS50YXJnZXQ9PT1kKWNsb3NlTW9kYWwoKX07ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkKX0KZnVuY3Rpb24gY2xvc2VNb2RhbCgpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZGwnKT8ucmVtb3ZlKCl9CmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGU9PntpZihlLmtleT09PSdFc2NhcGUnKXtjbG9zZU1vZGFsKCk7Y2xvc2VTYigpfX0pOwphZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCgpPT57aWYoY3VyPT09J2VuZ2luZScpZHJhd0VuZ2luZSgpfSk7Cg==','base64')
};

/* CHAIRMAN AGENT OS — real backend. Zero dependencies, zero cost. Node core only. */
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
                missions:[], playbooks:[],
                autoIdeas:false };
let S = load();

let DBBYTES = 0;
function load(){ return structuredClone(BLANK); }   /* real load is async, in init() */
let saveTimer=null;
function save(){ S.rev++; clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{ const t=JSON.stringify(S,null,1); DBBYTES=Buffer.byteLength(t);
    STORE.write(DB,t).catch(e=>console.error('[store] write failed:',e.message)); },150); }
function nowIso(){ return new Date().toISOString().replace('T',' ').slice(0,19); }
function uid(p){ return p+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(); }
function log(sev,src,msg){ S.logs.unshift({t:nowIso(),sev,src,msg}); S.logs=S.logs.slice(0,1200); save(); }
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
async function mail(subject, text, tag){
  const to = S.owner && S.owner.email;
  if(!S.smtp || !S.smtp.host){
    S.mailq.unshift({t:nowIso(),to:maskMail(to),subject,status:'UNSENT — NO SMTP CONFIGURED',tag});
    S.mailq=S.mailq.slice(0,60); save();
    log('WARN','MAIL',`"${subject}" NOT sent — no SMTP channel configured. Recorded as intent only.`);
    return {ok:false,reason:'NO_SMTP'};
  }
  try{
    const r = await SMTP.send(S.smtp, { to, subject:'[CHAIRMAN OS] '+subject, text });
    MAILSTAT.sent++; MAILSTAT.last=nowIso();
    S.mailq.unshift({t:nowIso(),to:maskMail(to),subject,status:'DELIVERED ('+r.ms+'ms)',tag});
    S.mailq=S.mailq.slice(0,60); save();
    log('OK','MAIL',`Delivered "${subject}" to ${maskMail(to)} in ${r.ms}ms.`);
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
const SYS_CHAIRMAN = `You are a subordinate agent inside Chairman Agent OS, reporting to the Owner.
Be concrete and blunt. No filler, no hedging, no marketing language.

TRUTHFULNESS IS ABSOLUTE AND OVERRIDES EVERYTHING ELSE:
- Never invent statistics, revenue figures, percentages or observations.
- Never write a sales message that claims the Owner has seen, monitored or
  analysed something they have not. Fabricated credibility destroys real
  credibility the moment a prospect asks "show me".
- If you state arithmetic, verify it. A wrong number in a pitch is worse
  than no number.
- If you do not know something, say "unknown" rather than estimating and
  presenting the estimate as fact.
- If something cannot be done, say so plainly and say why.`;

async function think(prompt, sys, tag, agent){
  if(!S.llm||!S.llm.provider) throw new Error('No AI brain connected. Connect a free model in the AI Brain page.');
  const r = await LLM.chat(S.llm, [
    {role:'system', content: sys||SYS_CHAIRMAN},
    {role:'user', content: prompt}
  ]);
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

RULES:
- Each idea must be startable in under 30 days with under 2000 INR.
- No idea that requires inventory, staff, an office, or a licence.
- Do not repeat any of these already-generated ideas: ${known}
- Be specific. "Start an agency" is useless. Name the exact service and buyer.
${steer?'- Owner steer: '+steer:''}

Return ONLY a JSON array, no prose. Each element:
{"title":"short name","what":"one sentence on what is sold",
 "buyer":"exactly who pays, in Ludhiana or online","price_inr":number,
 "why_now":"why this is viable today","effort":"low|medium|high",
 "uses_system":true|false}`,
    null,'ideas','Growth Conductor');
  const arr = jparse(r.text);
  const added=[];
  for(const it of (Array.isArray(arr)?arr:[])){
    if(!it || !it.title) continue;
    const idea={ id:uid('IDEA'), t:nowIso(), title:String(it.title).slice(0,90),
      what:String(it.what||'').slice(0,300), buyer:String(it.buyer||'').slice(0,200),
      price:+it.price_inr||0, why:String(it.why_now||'').slice(0,300),
      effort:String(it.effort||'medium'), usesSystem:!!it.uses_system,
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
const DEFAULT_TASKS = [
  ['probe.sweep',   120, 'Uptime Marshal'],
  ['tls.watch',    3600, 'Breach Warden'],
  ['sla.report',    600, 'Insight Forge'],
  ['anomaly.scan',  300, 'Audit Sentinel'],
  ['cost.audit',    900, 'Innovation Scout'],
  ['roster.audit', 1800, 'Policy Vault Keeper'],
  ['gate.sentry',   600, 'Risk Matrix Analyst'],
  ['brief.write',   900, 'Insight Forge']
];
function seedTasks(){
  if(S.tasks.length) return;
  S.tasks = DEFAULT_TASKS.map(([cap,every,owner])=>({
    id:uid('TSK'), cap, every, owner, enabled:true, runs:0, fails:0,
    lastAt:null, lastMsg:null, lastOk:null, created:nowIso() }));
  log('OK','RUNTIME',`${S.tasks.length} standing orders installed. Agents are now executing work.`);
}

let tickBusy=false;
async function tick(){
  if(tickBusy || !S.running || !S.owner) return;
  tickBusy=true; S.ticks++;
  try{
    const now=Date.now();
    for(const t of S.tasks){
      if(!t.enabled) continue;
      const due = !t.lastAt || (now - new Date(t.lastAt.replace(' ','T')+'Z').getTime()) >= t.every*1000;
      if(!due) continue;
      const cap=CAPS[t.cap];
      if(!cap){ t.enabled=false; continue; }
      const t0=Date.now();
      try{
        const r=await cap.run();
        t.lastAt=nowIso(); t.lastOk=true; t.lastMsg=r.msg; t.runs++;
        S.runs.unshift({t:t.lastAt, cap:t.cap, owner:t.owner, ok:true,
          msg:r.msg, detail:r.detail||'', ms:Date.now()-t0, n:r.n||0});
      }catch(e){
        t.lastAt=nowIso(); t.lastOk=false; t.lastMsg='FAILED: '+e.message; t.fails++;
        S.runs.unshift({t:t.lastAt, cap:t.cap, owner:t.owner, ok:false,
          msg:'FAILED: '+e.message, detail:'', ms:Date.now()-t0, n:0});
        log('CRIT','RUNTIME',`${t.cap} failed: ${e.message}`);
      }
      S.runs=S.runs.slice(0,300);
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
    tasks:S.tasks, runs:S.runs.slice(0,80), running:!!S.running, ticks:S.ticks,
    caps:Object.entries(CAPS).map(([k,v])=>({cap:k,desc:v.desc,pillar:v.pillar})),
    llm: S.llm ? { provider:S.llm.provider, model:S.llm.model, key:mask(S.llm.key), t:S.llm.t } : null,
    providers: Object.entries(LLM.PROVIDERS).map(([k,v])=>({id:k,label:v.label,model:v.model,signup:v.signup,nokey:!!v.nokey})),
    outputs: S.outputs.slice(0,40),
    ideas:S.ideas.slice(0,60), ventures:S.ventures.slice(0,20),
    orders:S.orders.slice(0,40), chat:S.chat.slice(0,60), autoIdeas:!!S.autoIdeas,
    missions:S.missions.slice(0,40), playbooks:S.playbooks.slice(0,20),
    pay: S.pay ? { gateway:S.pay.gateway, live:!!S.pay.live,
      keyId:mask(S.pay.keyId||S.pay.keySecret), t:S.pay.t } : null,
    gateways: Object.values(PAY.GATEWAYS).map(g=>({id:g.id,label:g.label,
      currency:g.currency,signup:g.signup,keyHint:g.keyHint})),
    telemetry: telemetry(), floors: floorHealth(), pillars:PILLARS };
}
function body(req){ return new Promise(r=>{ let d=''; req.on('data',c=>{ d+=c; if(d.length>2e6) req.destroy(); });
  req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch(e){ r({}); } }); }); }

/* ---------- API ---------- */
async function api(req,res,url){
  T.api++;
  const ip = (req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  const ua = req.headers['user-agent']||'';
  const p  = url.pathname;

  if(p==='/api/boot') return send(res,200,{ provisioned: !!S.owner, authed: !!auth(req) });

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
    if(!b.pw||!verify(b.pw)){ T.auth_fail++; log('CRIT','GATE','Invalid clearance signature on '+b.id);
      return send(res,401,{error:'CLEARANCE REJECTED. Signature mismatch.'}); }
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
    if(!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host))
      return send(res,400,{error:'SMTP HOST looks invalid. Example: smtp.gmail.com'});
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
    if(!b.pw||!verify(b.pw)){ T.auth_fail++;
      log('CRIT','EVOLUTION','Invalid signature on upgrade '+b.id);
      return send(res,401,{error:'SIGNATURE REJECTED'}); }
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
  if(p==='/api/upgrade/scan'){ selfAudit();
    return send(res,200,{ok:1,pending:S.proposals.filter(x=>x.status==='PENDING').length,state:pub()}); }
  if(p==='/api/upgrade/autopilot'){
    if(!verify(b.pw||'')) return send(res,401,{error:'PASSWORD REQUIRED'});
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
    if(!P.nokey && !(b.key||'').trim())
      return send(res,400,{error:'API key required for '+P.label+'. '+P.signup});
    S.llm={ provider:b.provider, key:(b.key||'').trim(), model:(b.model||'').trim()||P.model, t:nowIso() };
    log('OK','AI BRAIN',`Connected to ${P.label} (${S.llm.model}). Key withheld from ledger.`);
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
    if(!verify(b.pw||'')) return send(res,401,{error:'SIGNATURE REQUIRED'});
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
      cfg.live=v.live; cfg.t=nowIso(); S.pay=cfg;
      log(v.live?'CRIT':'OK','TREASURY',
        `Payment gateway ${G.label} verified in ${v.live?'LIVE — real money':'TEST'} mode. Secret withheld from ledger.`);
      save(); return send(res,200,{ok:1,live:v.live,state:pub()});
    }catch(e){ return send(res,400,{error:'KEYS REJECTED — '+e.message}); }
  }
  if(p==='/api/pay/purge'){ S.pay=null; log('CRIT','TREASURY','Payment gateway disconnected.');
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
    if(!verify(b.pw||'')) return send(res,401,{error:'SIGNATURE REQUIRED'});
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

