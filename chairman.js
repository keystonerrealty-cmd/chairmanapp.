#!/usr/bin/env node
/* ==========================================================================
   CHAIRMAN AGENT OS  —  SINGLE FILE  ·  Glassmorphism UI

   RUN IT:   node chairman.js     then open http://localhost:8080

   LOW-SPEC LAPTOPS: when the AI Brain is set to Ollama the client now sends
   tuned options — 2048 context, 2 threads, 400 token cap, and keep_alive 30m
   so the model stays in RAM instead of reloading from disk every call.
   Timeout is raised to 5 minutes because slow CPUs genuinely need it.

   On a 2-core Celeron with 4 GB RAM, use qwen2.5:1.5b at most. Anything
   larger will swap to disk and crawl. Groq's free cloud tier is far faster
   on such hardware and needs no card.

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
    req.on('timeout',()=>{ req.destroy(); reject(new Error(isLocal
      ? 'TIMEOUT — a local model on slow hardware can take minutes. Try a smaller model (qwen2.5:1.5b) or switch to Groq.'
      : 'TIMEOUT — model took too long')); });
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
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgovKiDilZDilZAgQ0hBSVJNQU4gT1MgwrcgR0xBU1NNT1JQSElTTSDilZDilZAgKi8KOnJvb3R7CiAgLS1iZzojMDcwYTEyOyAtLWJnMjojMGEwZjFhOwogIC0tZ2xhc3M6cmdiYSgyNTUsMjU1LDI1NSwuMDQ1KTsKICAtLWdsYXNzMjpyZ2JhKDI1NSwyNTUsMjU1LC4wNzUpOwogIC0tc3Ryb2tlOnJnYmEoMjU1LDI1NSwyNTUsLjA5KTsKICAtLXN0cm9rZTI6cmdiYSgyNTUsMjU1LDI1NSwuMTYpOwogIC0tdHh0OiNlZWYzZmE7IC0tZGltOiM4YjliYjQ7IC0tZGltMjojNWM2YTgwOwogIC0tY3k6IzIyZDNlZTsgLS1ibHU6IzRkN2NmZTsgLS1tYWc6I2ZmNGQ3ZDsgLS1hbWI6I2ZmYjM0MDsgLS1ncm46IzJmZTA4YTsgLS1wdXI6I2E3OGJmYTsKICAtLW1vbm86dWktbW9ub3NwYWNlLFNGTW9uby1SZWd1bGFyLE1lbmxvLCJSb2JvdG8gTW9ubyIsbW9ub3NwYWNlOwogIC0tc2FuczotYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCwiU2Vnb2UgVUkiLEludGVyLFJvYm90byxzYW5zLXNlcmlmOwogIC0tc2J3OjIzNnB4OyAtLXI6MTZweDsKICAtLXNoYWRvdzowIDhweCAzMnB4IHJnYmEoMCwwLDAsLjM4KTsKICAtLWdsb3c6MCAwIDI0cHggcmdiYSgzNCwyMTEsMjM4LC4xNik7Cn0KW2RhdGEtdGhlbWU9ImxpZ2h0Il17CiAgLS1iZzojZWVmMmY5OyAtLWJnMjojZTRlYWY0OwogIC0tZ2xhc3M6cmdiYSgyNTUsMjU1LDI1NSwuNjgpOyAtLWdsYXNzMjpyZ2JhKDI1NSwyNTUsMjU1LC44NSk7CiAgLS1zdHJva2U6cmdiYSgxNSwzMCw2MCwuMTApOyAtLXN0cm9rZTI6cmdiYSgxNSwzMCw2MCwuMTgpOwogIC0tdHh0OiMxMDFiMmU7IC0tZGltOiM1YTZiODU7IC0tZGltMjojODQ5NmFkOwogIC0tYmx1OiMyYjVjZjA7IC0tc2hhZG93OjAgOHB4IDMycHggcmdiYSgyMCw0MCw4MCwuMTIpOwp9Cip7Ym94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtdGFwLWhpZ2hsaWdodC1jb2xvcjp0cmFuc3BhcmVudH0KaHRtbCxib2R5e21hcmdpbjowO21pbi1oZWlnaHQ6MTAwJX0KYm9keXsKICBiYWNrZ3JvdW5kOnZhcigtLWJnKTsgY29sb3I6dmFyKC0tdHh0KTsKICBmb250OjEzLjVweC8xLjU1IHZhcigtLXNhbnMpOyBvdmVyZmxvdy14OmhpZGRlbjsKICBiYWNrZ3JvdW5kLWltYWdlOgogICAgcmFkaWFsLWdyYWRpZW50KDkwMHB4IDYyMHB4IGF0IDglIC0xMiUsIHJnYmEoNzcsMTI0LDI1NCwuMjApLCB0cmFuc3BhcmVudCA2MiUpLAogICAgcmFkaWFsLWdyYWRpZW50KDc2MHB4IDU2MHB4IGF0IDk2JSAyJSwgcmdiYSgxNjcsMTM5LDI1MCwuMTcpLCB0cmFuc3BhcmVudCA1OCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDY4MHB4IDUyMHB4IGF0IDUwJSAxMDglLCByZ2JhKDM0LDIxMSwyMzgsLjEzKSwgdHJhbnNwYXJlbnQgNjAlKTsKICBiYWNrZ3JvdW5kLWF0dGFjaG1lbnQ6Zml4ZWQ7Cn0KYnV0dG9ue2ZvbnQ6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjtjb2xvcjppbmhlcml0fQppbnB1dCxzZWxlY3QsdGV4dGFyZWF7Zm9udDppbmhlcml0fQouaGlkZXtkaXNwbGF5Om5vbmUhaW1wb3J0YW50fQo6Oi13ZWJraXQtc2Nyb2xsYmFye3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHh9Cjo6LXdlYmtpdC1zY3JvbGxiYXItdGh1bWJ7YmFja2dyb3VuZDp2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjEwcHh9Cjo6LXdlYmtpdC1zY3JvbGxiYXItdHJhY2t7YmFja2dyb3VuZDp0cmFuc3BhcmVudH0KCi8qIOKUgOKUgCBMT0dJTiAvIEhFUk8g4pSA4pSAICovCiNnYXRle3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDo4MDtvdmVyZmxvdzphdXRvO2JhY2tncm91bmQ6dmFyKC0tYmcpOwogIGJhY2tncm91bmQtaW1hZ2U6CiAgICByYWRpYWwtZ3JhZGllbnQoOTAwcHggNjIwcHggYXQgMTIlIC04JSwgcmdiYSg3NywxMjQsMjU0LC4yNCksIHRyYW5zcGFyZW50IDYwJSksCiAgICByYWRpYWwtZ3JhZGllbnQoNzYwcHggNTgwcHggYXQgOTIlIDEyJSwgcmdiYSgxNjcsMTM5LDI1MCwuMjApLCB0cmFuc3BhcmVudCA1NiUpO30KLnRvcGJhcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMXB4O3BhZGRpbmc6MTVweCAyMnB4O2ZsZXgtd3JhcDp3cmFwOwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7CiAgYmFja2dyb3VuZDp2YXIoLS1nbGFzcyk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMjJweCkgc2F0dXJhdGUoMTUwJSk7LXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cigyMnB4KSBzYXR1cmF0ZSgxNTAlKX0KLmxvZ297Zm9udDo4MDAgMThweC8xIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0uNXB4fQoubG9nbyBpe2ZvbnQtc3R5bGU6bm9ybWFsO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkyZGVnLHZhcigtLWN5KSx2YXIoLS1ibHUpKTsKICAtd2Via2l0LWJhY2tncm91bmQtY2xpcDp0ZXh0O2JhY2tncm91bmQtY2xpcDp0ZXh0Oy13ZWJraXQtdGV4dC1maWxsLWNvbG9yOnRyYW5zcGFyZW50fQoucGlsbHtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MpO2JhY2tkcm9wLWZpbHRlcjpibHVyKDEycHgpOwogIGJvcmRlci1yYWRpdXM6OTlweDtwYWRkaW5nOjZweCAxM3B4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6LjdweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLnBpbGwubGl2ZXtib3JkZXItY29sb3I6cmdiYSg0NywyMjQsMTM4LC4zNCk7YmFja2dyb3VuZDpyZ2JhKDQ3LDIyNCwxMzgsLjEwKTtjb2xvcjp2YXIoLS1ncm4pfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tZ3JuKTttYXJnaW4tcmlnaHQ6NnB4OwogIGJveC1zaGFkb3c6MCAwIDEwcHggdmFyKC0tZ3JuKTthbmltYXRpb246YnAgMS45cyBpbmZpbml0ZX0KQGtleWZyYW1lcyBicHs1MCV7b3BhY2l0eTouMzJ9fQouaGVyb3ttYXgtd2lkdGg6MTIwMHB4O21hcmdpbjowIGF1dG87cGFkZGluZzozMHB4IDIycHggNjRweH0KLmhlcm9DYXJke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjI2cHg7CiAgYmFja2Ryb3AtZmlsdGVyOmJsdXIoMjZweCkgc2F0dXJhdGUoMTUwJSk7LXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cigyNnB4KSBzYXR1cmF0ZSgxNTAlKTsKICBib3gtc2hhZG93OnZhcigtLXNoYWRvdyk7cGFkZGluZzpjbGFtcCgyNHB4LDR2dyw0NnB4KTsKICBkaXNwbGF5OmdyaWQ7Z2FwOjM2cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMDVmciAuOTVmcjthbGlnbi1pdGVtczpjZW50ZXJ9CkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpey5oZXJvQ2FyZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6cmdiYSgxNjcsMTM5LDI1MCwuMTUpO2JvcmRlcjoxcHggc29saWQgcmdiYSgxNjcsMTM5LDI1MCwuMzQpOwogIGNvbG9yOiNjOWI4ZmY7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS41cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmgxLmJpZ3tmb250OjgwMCBjbGFtcCgzMXB4LDUuNnZ3LDUycHgpLzEuMDQgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LTEuNnB4O21hcmdpbjoxN3B4IDAgMTVweH0KaDEuYmlnIGVte2ZvbnQtc3R5bGU6bm9ybWFsO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkyZGVnLHZhcigtLWN5KSx2YXIoLS1ibHUpIDU1JSx2YXIoLS1wdXIpKTsKICAtd2Via2l0LWJhY2tncm91bmQtY2xpcDp0ZXh0O2JhY2tncm91bmQtY2xpcDp0ZXh0Oy13ZWJraXQtdGV4dC1maWxsLWNvbG9yOnRyYW5zcGFyZW50fQoubGVkZXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTQuNXB4LzEuNyB2YXIoLS1zYW5zKTttYXgtd2lkdGg6NTJjaDttYXJnaW46MCAwIDI0cHh9Ci5zdGF0Um93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgxNDJweCwxZnIpKTtnYXA6MTNweH0KLnN0YXR7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE1cHg7cGFkZGluZzoxNHB4IDE2cHg7CiAgYmFja2Ryb3AtZmlsdGVyOmJsdXIoMTJweCk7dHJhbnNpdGlvbjouMjJzfQouc3RhdDpob3Zlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtMnB4KTtib3JkZXItY29sb3I6dmFyKC0tc3Ryb2tlMil9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjJweC8xLjIgdmFyKC0tc2Fucyk7bWFyZ2luOjZweCAwIDNweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubG9naW5Cb3h7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNHB4OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDI0cHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgNHB4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLWN5KTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxvZ2luQm94IC5zYntjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMC41cHg7bWFyZ2luLWJvdHRvbToxOHB4O2xldHRlci1zcGFjaW5nOi42cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5lcnJ7Y29sb3I6dmFyKC0tbWFnKTtmb250LXNpemU6MTEuNXB4O21pbi1oZWlnaHQ6MTZweDttYXJnaW4tdG9wOjZweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLndhcm5ib3h7Ym9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWFtYik7YmFja2dyb3VuZDpyZ2JhKDI1NSwxNzksNjQsLjA5KTtwYWRkaW5nOjExcHggMTRweDsKICBib3JkZXItcmFkaXVzOjAgMTJweCAxMnB4IDA7Zm9udC1zaXplOjExLjVweDtjb2xvcjojZjBkOWFlO21hcmdpbi1ib3R0b206MTVweDtsaW5lLWhlaWdodDoxLjZ9Ci5waWxsYXJze21heC13aWR0aDoxMjAwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjAgMjJweCA3NnB4fQoucGlsbGFycyBoMnt0ZXh0LWFsaWduOmNlbnRlcjtmb250OjgwMCBjbGFtcCgyMnB4LDMuNHZ3LDMycHgpLzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjhweDttYXJnaW46MCAwIDlweH0KLnBpbGxhcnMgaDIgZW17Zm9udC1zdHlsZTpub3JtYWw7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTJkZWcsdmFyKC0tY3kpLHZhcigtLXB1cikpOwogIC13ZWJraXQtYmFja2dyb3VuZC1jbGlwOnRleHQ7YmFja2dyb3VuZC1jbGlwOnRleHQ7LXdlYmtpdC10ZXh0LWZpbGwtY29sb3I6dHJhbnNwYXJlbnR9Ci5waWxsYXJzIC5zdWJ7dGV4dC1hbGlnbjpjZW50ZXI7Y29sb3I6dmFyKC0tZGltKTtmb250OjEzcHgvMS42IHZhcigtLXNhbnMpO21hcmdpbjowIDAgMjhweH0KLnBncmlke2Rpc3BsYXk6Z3JpZDtnYXA6MTZweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyMTJweCwxZnIpKX0KLnBjYXJke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE4cHg7cGFkZGluZzoxOHB4OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDE4cHgpO3RyYW5zaXRpb246LjI0cztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5wY2FyZDo6YmVmb3Jle2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtib3JkZXItcmFkaXVzOjE4cHg7cGFkZGluZzoxcHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTQwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjE2KSx0cmFuc3BhcmVudCA0MiUpOwogIC13ZWJraXQtbWFzazpsaW5lYXItZ3JhZGllbnQoIzAwMCAwIDApIGNvbnRlbnQtYm94LGxpbmVhci1ncmFkaWVudCgjMDAwIDAgMCk7CiAgLXdlYmtpdC1tYXNrLWNvbXBvc2l0ZTp4b3I7bWFzay1jb21wb3NpdGU6ZXhjbHVkZTtwb2ludGVyLWV2ZW50czpub25lfQoucGNhcmQ6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTVweCk7Ym9yZGVyLWNvbG9yOnJnYmEoMzQsMjExLDIzOCwuMzYpOwogIGJveC1zaGFkb3c6MCAxNnB4IDQ0cHggcmdiYSgzNCwyMTEsMjM4LC4xMyl9Ci5wY2FyZCB1e3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWN5KTtmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS42cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5wY2FyZCBoNHttYXJnaW46OXB4IDA7Zm9udDo3MDAgMTVweC8xLjMgdmFyKC0tc2Fucyl9Ci5wY2FyZCBwe21hcmdpbjowIDAgMTJweDtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTJweC8xLjYgdmFyKC0tc2Fucyl9Ci5jaGlwe2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Y29sb3I6dmFyKC0tZGltKTsKICBib3JkZXItcmFkaXVzOjlweDtwYWRkaW5nOjRweCAxMHB4O2ZvbnQtc2l6ZToxMHB4O21hcmdpbjowIDVweCA1cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KCi8qIOKUgOKUgCBTSEVMTCDilIDilIAgKi8KI2FwcHtkaXNwbGF5OmZsZXg7bWluLWhlaWdodDoxMDB2aH0KYXNpZGV7d2lkdGg6dmFyKC0tc2J3KTtmbGV4OjAgMCB2YXIoLS1zYncpO3Bvc2l0aW9uOnN0aWNreTt0b3A6MDtoZWlnaHQ6MTAwdmg7ei1pbmRleDo0MDsKICBkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uOwogIGJhY2tncm91bmQ6dmFyKC0tZ2xhc3MpO2JvcmRlci1yaWdodDoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTsKICBiYWNrZHJvcC1maWx0ZXI6Ymx1cigyNnB4KSBzYXR1cmF0ZSgxNTAlKTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDI2cHgpIHNhdHVyYXRlKDE1MCUpfQouYWJyYW5ke3BhZGRpbmc6MTdweCAxNnB4IDE1cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtkaXNwbGF5OmZsZXg7Z2FwOjExcHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6MTFweDtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxNXB4OwogIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE0MGRlZyx2YXIoLS1jeSksdmFyKC0tYmx1KSk7Y29sb3I6IzAzMTIxYTsKICBib3gtc2hhZG93OjAgNnB4IDE4cHggcmdiYSgzNCwyMTEsMjM4LC4zNCl9Ci5hYnJhbmQgYntmb250OjcwMCAxM3B4LzEuMjUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LjRweDtkaXNwbGF5OmJsb2NrfQouYWJyYW5kIHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjguNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQphc2lkZSBuYXZ7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjExcHggMTFweCAxNnB4fQouZ3Jwe2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjhweDtwYWRkaW5nOjE1cHggMTBweCA2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBjb2xvcjp2YXIoLS1kaW0pO3BhZGRpbmc6OXB4IDExcHg7Ym9yZGVyLXJhZGl1czoxMXB4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTIuNXB4OwogIGxldHRlci1zcGFjaW5nOi4xNXB4O3RyYW5zaXRpb246LjE2czttYXJnaW4tYm90dG9tOjJweH0KYXNpZGUgbmF2IGJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Y29sb3I6dmFyKC0tdHh0KTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgycHgpfQphc2lkZSBuYXYgYnV0dG9uLm9ue2NvbG9yOiNmZmY7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTJkZWcscmdiYSgzNCwyMTEsMjM4LC4yMCkscmdiYSg3NywxMjQsMjU0LC4xMikpOwogIGJvcmRlcjoxcHggc29saWQgcmdiYSgzNCwyMTEsMjM4LC4zMCk7Ym94LXNoYWRvdzowIDRweCAxNnB4IHJnYmEoMzQsMjExLDIzOCwuMTQpfQphc2lkZSBuYXYgYnV0dG9uIGl7Zm9udC1zdHlsZTpub3JtYWw7d2lkdGg6MTZweDt0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweH0KLmFmb290e2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7cGFkZGluZzoxM3B4IDE1cHg7Zm9udC1zaXplOjEwLjVweDtjb2xvcjp2YXIoLS1kaW0yKTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KbWFpbntmbGV4OjE7bWluLXdpZHRoOjA7cGFkZGluZzoyMHB4IGNsYW1wKDE1cHgsMi42dncsMzBweCkgOTZweH0KLm10b3B7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tYm90dG9tOjIwcHh9Ci5jcnVtYntjb2xvcjp2YXIoLS1kaW0yKTtmb250LXNpemU6MTEuNXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouY3J1bWIgYntjb2xvcjp2YXIoLS1jeSk7Zm9udC13ZWlnaHQ6NTAwfQoubXRvcCAuc3B7ZmxleDoxfQojYnVyZ2Vye2Rpc3BsYXk6bm9uZX0KI3RoZW1lQnRue2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1nbGFzcyk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMTJweCk7CiAgYm9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjExcHh9CiN0aGVtZUJ0bjpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tY3kpfQpAbWVkaWEobWF4LXdpZHRoOjg2MHB4KXsKICBhc2lkZXtwb3NpdGlvbjpmaXhlZDtsZWZ0OjA7dG9wOjA7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTEwMCUpO3RyYW5zaXRpb246LjI2cztib3gtc2hhZG93OjAgMCA3MHB4IHJnYmEoMCwwLDAsLjYpfQogIGFzaWRlLm9wZW57dHJhbnNmb3JtOm5vbmV9CiAgI3Njcmlte3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC41NSk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoM3B4KTt6LWluZGV4OjM1fQogICNidXJnZXJ7ZGlzcGxheTppbmxpbmUtZmxleH0KICBtYWlue3BhZGRpbmctYm90dG9tOjExMHB4fQp9CgovKiDilIDilIAgUFJJTUlUSVZFUyDilIDilIAgKi8KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1nbGFzcyk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcGFkZGluZzoxN3B4IDE5cHg7bWFyZ2luLWJvdHRvbToxNnB4O2JhY2tkcm9wLWZpbHRlcjpibHVyKDIwcHgpIHNhdHVyYXRlKDE0MCUpOwogIC13ZWJraXQtYmFja2Ryb3AtZmlsdGVyOmJsdXIoMjBweCkgc2F0dXJhdGUoMTQwJSk7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpOwogIHBvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjt0cmFuc2l0aW9uOi4yMnN9Ci5jYXJkOjpiZWZvcmV7Y29udGVudDonJztwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7cGFkZGluZzoxcHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTQwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjE0KSx0cmFuc3BhcmVudCA0MCUpOwogIC13ZWJraXQtbWFzazpsaW5lYXItZ3JhZGllbnQoIzAwMCAwIDApIGNvbnRlbnQtYm94LGxpbmVhci1ncmFkaWVudCgjMDAwIDAgMCk7CiAgLXdlYmtpdC1tYXNrLWNvbXBvc2l0ZTp4b3I7bWFzay1jb21wb3NpdGU6ZXhjbHVkZTtwb2ludGVyLWV2ZW50czpub25lfQouY2FyZDpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tc3Ryb2tlMil9Ci5jYXJkPmgze21hcmdpbjowIDAgMTNweDtmb250LXNpemU6MTAuNXB4O2xldHRlci1zcGFjaW5nOjEuN3B4O2NvbG9yOnZhcigtLWRpbSk7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlOwogIGRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtmbGV4LXdyYXA6d3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmdyaWR7ZGlzcGxheTpncmlkO2dhcDoxNHB4fQouZzJ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjkycHgsMWZyKSl9Ci5nM3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyMDhweCwxZnIpKX0KLmc0e2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDE2MnB4LDFmcikpfQoua3Bpe2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxNXB4O3BhZGRpbmc6MTVweCAxN3B4OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDE0cHgpO3RyYW5zaXRpb246LjIycztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5rcGk6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7aGVpZ2h0OjJweDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCg5MGRlZyx2YXIoLS1jeSksdmFyKC0tYmx1KSx0cmFuc3BhcmVudCk7b3BhY2l0eTouNjV9Ci5rcGk6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTNweCk7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpO2JveC1zaGFkb3c6MCAxMnB4IDMwcHggcmdiYSgwLDAsMCwuMjQpfQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyNXB4LzEuMTUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LS44cHh9Ci5rcGkgdXtkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjNweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbTo1cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5rcGkgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi10b3A6NHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRue2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3BhZGRpbmc6OXB4IDE1cHg7Ym9yZGVyLXJhZGl1czoxMXB4OwogIGZvbnQtc2l6ZToxMS41cHg7dHJhbnNpdGlvbjouMThzO2JhY2tkcm9wLWZpbHRlcjpibHVyKDEwcHgpO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRuOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MpO2JvcmRlci1jb2xvcjp2YXIoLS1jeSk7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTFweCl9Ci5idG4ucHtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCg5MmRlZyx2YXIoLS1jeSksdmFyKC0tYmx1KSk7Ym9yZGVyLWNvbG9yOnRyYW5zcGFyZW50OwogIGNvbG9yOiMwMzEyMWE7Zm9udC13ZWlnaHQ6NzAwO2JveC1zaGFkb3c6MCA2cHggMjBweCByZ2JhKDM0LDIxMSwyMzgsLjI4KX0KLmJ0bi5wOmhvdmVye2JveC1zaGFkb3c6MCA5cHggMjZweCByZ2JhKDM0LDIxMSwyMzgsLjQyKX0KLmJ0bi5va3tiYWNrZ3JvdW5kOnJnYmEoNDcsMjI0LDEzOCwuMTMpO2JvcmRlci1jb2xvcjpyZ2JhKDQ3LDIyNCwxMzgsLjM2KTtjb2xvcjp2YXIoLS1ncm4pfQouYnRuLm5ve2JhY2tncm91bmQ6cmdiYSgyNTUsNzcsMTI1LC4xMSk7Ym9yZGVyLWNvbG9yOnJnYmEoMjU1LDc3LDEyNSwuMzQpO2NvbG9yOnZhcigtLW1hZyl9Ci5idG4uc217cGFkZGluZzo2cHggMTFweDtmb250LXNpemU6MTAuNXB4O2JvcmRlci1yYWRpdXM6OXB4fQouYnRuOmRpc2FibGVke29wYWNpdHk6LjM1O2N1cnNvcjpub3QtYWxsb3dlZDt0cmFuc2Zvcm06bm9uZX0KLnJvd3tkaXNwbGF5OmZsZXg7Z2FwOjlweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpjZW50ZXJ9CmxhYmVsLmZ7ZGlzcGxheTpibG9jazttYXJnaW4tYm90dG9tOjEycHh9CmxhYmVsLmY+c3BhbntkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZTo5LjVweDtsZXR0ZXItc3BhY2luZzoxLjJweDtjb2xvcjp2YXIoLS1kaW0pO21hcmdpbi1ib3R0b206NnB4OwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmlue3dpZHRoOjEwMCU7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC4yMCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtjb2xvcjp2YXIoLS10eHQpOwogIHBhZGRpbmc6MTBweCAxM3B4O2JvcmRlci1yYWRpdXM6MTFweDtvdXRsaW5lOm5vbmU7dHJhbnNpdGlvbjouMThzO2JhY2tkcm9wLWZpbHRlcjpibHVyKDhweCl9CltkYXRhLXRoZW1lPSJsaWdodCJdIC5pbntiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjcyKX0KLmluOmZvY3Vze2JvcmRlci1jb2xvcjp2YXIoLS1jeSk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgzNCwyMTEsMjM4LC4xNCl9CnRleHRhcmVhLmlue21pbi1oZWlnaHQ6NzJweDtyZXNpemU6dmVydGljYWw7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyl9CnRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4fQp0aHt0ZXh0LWFsaWduOmxlZnQ7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo1MDA7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjJweDtwYWRkaW5nOjlweDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CnRke3BhZGRpbmc6MTBweCA5cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9CnRyOmhvdmVyIHRke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLnR3e292ZXJmbG93LXg6YXV0bztib3JkZXItcmFkaXVzOjExcHh9Ci50YWd7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzozcHggMTBweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxcHg7CiAgYm9yZGVyOjFweCBzb2xpZDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7d2hpdGUtc3BhY2U6bm93cmFwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoudC1jeXtjb2xvcjp2YXIoLS1jeSk7Ym9yZGVyLWNvbG9yOnJnYmEoMzQsMjExLDIzOCwuMzQpO2JhY2tncm91bmQ6cmdiYSgzNCwyMTEsMjM4LC4xMCl9Ci50LWdybntjb2xvcjp2YXIoLS1ncm4pO2JvcmRlci1jb2xvcjpyZ2JhKDQ3LDIyNCwxMzgsLjM0KTtiYWNrZ3JvdW5kOnJnYmEoNDcsMjI0LDEzOCwuMTApfQoudC1hbWJ7Y29sb3I6dmFyKC0tYW1iKTtib3JkZXItY29sb3I6cmdiYSgyNTUsMTc5LDY0LC4zNCk7YmFja2dyb3VuZDpyZ2JhKDI1NSwxNzksNjQsLjEwKX0KLnQtcmVke2NvbG9yOnZhcigtLW1hZyk7Ym9yZGVyLWNvbG9yOnJnYmEoMjU1LDc3LDEyNSwuMzQpO2JhY2tncm91bmQ6cmdiYSgyNTUsNzcsMTI1LC4xMCl9Ci50LWJsdXtjb2xvcjp2YXIoLS1ibHUpO2JvcmRlci1jb2xvcjpyZ2JhKDc3LDEyNCwyNTQsLjM0KTtiYWNrZ3JvdW5kOnJnYmEoNzcsMTI0LDI1NCwuMTApfQoudC1wdXJ7Y29sb3I6dmFyKC0tcHVyKTtib3JkZXItY29sb3I6cmdiYSgxNjcsMTM5LDI1MCwuMzQpO2JhY2tncm91bmQ6cmdiYSgxNjcsMTM5LDI1MCwuMTApfQoudC1kaW17Y29sb3I6dmFyKC0tZGltKTtib3JkZXItY29sb3I6dmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpfQouYmFye2hlaWdodDo3cHg7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC4yNik7Ym9yZGVyLXJhZGl1czo5OXB4O292ZXJmbG93OmhpZGRlbn0KW2RhdGEtdGhlbWU9ImxpZ2h0Il0gLmJhcntiYWNrZ3JvdW5kOnJnYmEoMTUsMzAsNjAsLjA5KX0KLmJhciBpe2Rpc3BsYXk6YmxvY2s7aGVpZ2h0OjEwMCU7Ym9yZGVyLXJhZGl1czo5OXB4OwogIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLWN5KSx2YXIoLS1wdXIpKTt0cmFuc2l0aW9uOndpZHRoIC41cyBjdWJpYy1iZXppZXIoLjQsMCwuMiwxKX0KdWwudGlnaHR7bWFyZ2luOjdweCAwIDA7cGFkZGluZy1sZWZ0OjE4cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKX0KdWwudGlnaHQgbGl7bWFyZ2luOjVweCAwfQp1bC50aWdodCBie2NvbG9yOnZhcigtLXR4dCl9CnByZS55YW1se2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMzApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzoxNHB4OwogIGZvbnQtc2l6ZToxMXB4O292ZXJmbG93OmF1dG87Y29sb3I6I2E4ZDhmMDttYXJnaW46MDtsaW5lLWhlaWdodDoxLjY7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CltkYXRhLXRoZW1lPSJsaWdodCJdIHByZS55YW1se2JhY2tncm91bmQ6cmdiYSgxNSwzMCw2MCwuMDUpO2NvbG9yOiMxZjRhNjN9Ci5sb2d7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC4zMCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjEzcHg7CiAgbWF4LWhlaWdodDozNzBweDtvdmVyZmxvdzphdXRvO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQpbZGF0YS10aGVtZT0ibGlnaHQiXSAubG9ne2JhY2tncm91bmQ6cmdiYSgxNSwzMCw2MCwuMDQpfQoubG9nIGRpdntwYWRkaW5nOjNweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7d2hpdGUtc3BhY2U6cHJlLXdyYXA7d29yZC1icmVhazpicmVhay13b3JkfQoubG9nIC50c3tjb2xvcjp2YXIoLS1kaW0yKX0KLm1vbm8tZGlte2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjExcHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5tb2RhbHtwb3NpdGlvbjpmaXhlZDtpbnNldDowO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNjIpO3otaW5kZXg6OTA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3BhZGRpbmc6MThweDtiYWNrZHJvcC1maWx0ZXI6Ymx1cig4cHgpfQoubWJveHt3aWR0aDoxMDAlO21heC13aWR0aDo2NjBweDttYXgtaGVpZ2h0Ojg4dmg7b3ZlcmZsb3c6YXV0bztiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjIycHg7cGFkZGluZzoyNHB4OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDMwcHgpIHNhdHVyYXRlKDE1MCUpO2JveC1zaGFkb3c6MCAyNHB4IDcwcHggcmdiYSgwLDAsMCwuNSl9Ci5tYm94IGgze21hcmdpbjowIDAgNnB4O2ZvbnQtc2l6ZToxNXB4O2NvbG9yOnZhcigtLWN5KTtsZXR0ZXItc3BhY2luZzouNHB4O3RleHQtdHJhbnNmb3JtOm5vbmV9Ci5mbGFzaHtwb3NpdGlvbjpmaXhlZDtsZWZ0OjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNTAlKTtib3R0b206MjZweDsKICBiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tY3kpOwogIHBhZGRpbmc6MTJweCAyMHB4O2JvcmRlci1yYWRpdXM6MTRweDtmb250LXNpemU6MTJweDt6LWluZGV4Ojk5O21heC13aWR0aDo5MHZ3OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDI0cHgpO2JveC1zaGFkb3c6MCAxNHB4IDQ0cHggcmdiYSgwLDAsMCwuNDUpO2FuaW1hdGlvbjpmdSAuM3N9CkBrZXlmcmFtZXMgZnV7ZnJvbXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZSgtNTAlLDE0cHgpfX0KCi8qIOKUgOKUgCBSQURJQUwgRU5HSU5FIOKUgOKUgCAqLwouZW5naW5lV3JhcHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAyNThweDtnYXA6MTRweH0KQG1lZGlhKG1heC13aWR0aDoxMDAwcHgpey5lbmdpbmVXcmFwe2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQouY2FudmFzQm94e2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCA1MCUgNTAlLHJnYmEoNzcsMTI0LDI1NCwuMTApLHRyYW5zcGFyZW50IDcwJSksdmFyKC0tZ2xhc3MpOwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOnZhcigtLXIpO3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjttaW4taGVpZ2h0OjQ0MHB4OwogIGJhY2tkcm9wLWZpbHRlcjpibHVyKDIwcHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmNhbnZhc0JveCBzdmd7ZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO2hlaWdodDphdXRvO3RvdWNoLWFjdGlvbjpwYW4teX0KLmdyaWRiZ3twb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO3BvaW50ZXItZXZlbnRzOm5vbmU7b3BhY2l0eTouNDsKICBiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh2YXIoLS1zdHJva2UpIDFweCx0cmFuc3BhcmVudCAxcHgpLAogICAgICAgICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLXN0cm9rZSkgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM2cHggMzZweDsKICBtYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDM4JSx0cmFuc3BhcmVudCA3OCUpOwogIC13ZWJraXQtbWFzay1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSA1MCUsIzAwMCAzOCUsdHJhbnNwYXJlbnQgNzglKX0KLmVuZ1RvcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjE0cHg7dG9wOjEzcHg7ei1pbmRleDoyO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZW5nVGl0bGV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7dG9wOjE0cHg7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoyOwogIGZvbnQ6NzAwIDEzcHggdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6M3B4O2NvbG9yOnZhcigtLXR4dCk7dGV4dC1zaGFkb3c6MCAycHggMTRweCByZ2JhKDAsMCwwLC43KX0KLm5vZGV7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMnN9Ci5ub2RlOmhvdmVyIGNpcmNsZXtmaWx0ZXI6YnJpZ2h0bmVzcygxLjU1KX0KLnNpZGV7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTRweH0KLmxlZ2VuZCBkaXZ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O2ZvbnQtc2l6ZToxMC41cHg7Y29sb3I6dmFyKC0tZGltKTtwYWRkaW5nOjRweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubGVnZW5kIGl7d2lkdGg6MTBweDtoZWlnaHQ6MTBweDtib3JkZXItcmFkaXVzOjk5cHg7ZGlzcGxheTpibG9jaztmbGV4OjAgMCAxMHB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2NnB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6OHB4IDRweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7CiAgdGV4dC1hbGlnbjpsZWZ0O3RyYW5zaXRpb246LjE0cztmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmRpckxpc3QgYnV0dG9uOmhvdmVye2NvbG9yOnZhcigtLWN5KTtwYWRkaW5nLWxlZnQ6OHB4fQouZGlyTGlzdCBzcGFue2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo5LjVweH0KLnRlcm17YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC4zNCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjEzcHg7CiAgZm9udC1zaXplOjEwLjVweDttYXgtaGVpZ2h0OjE1OHB4O292ZXJmbG93OmF1dG87Y29sb3I6IzdmZThjNDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KW2RhdGEtdGhlbWU9ImxpZ2h0Il0gLnRlcm17YmFja2dyb3VuZDpyZ2JhKDE1LDMwLDYwLC4wNSk7Y29sb3I6IzBkN2E1NX0KPC9zdHlsZT4KCjwvaGVhZD4KPGJvZHk+CjwhLS0gPT09PT09PT09PT09PT09PT0gR0FURSA9PT09PT09PT09PT09PT09PSAtLT4KPGRpdiBpZD0iZ2F0ZSI+CiAgPGRpdiBjbGFzcz0idG9wYmFyIj4KICAgIDxkaXYgY2xhc3M9ImxvZ28iPkNIQUlSTUFOIDxpPkFHRU5UIE9TPC9pPjwvZGl2PgogICAgPHNwYW4gY2xhc3M9InBpbGwgbGl2ZSI+PHNwYW4gY2xhc3M9ImRvdCI+PC9zcGFuPlNFUlZFUiBMSVZFICZhbXA7IEFVRElUSU5HPC9zcGFuPgogICAgPHNwYW4gY2xhc3M9InBpbGwiPlpFUk8tVFJVU1QgQUNUSVZFPC9zcGFuPgogICAgPHNwYW4gY2xhc3M9InBpbGwiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtjb2xvcjp2YXIoLS1hbWIpO2JhY2tncm91bmQ6IzFhMTMwNSI+WkVSTy1DT1NUIERPQ1RSSU5FPC9zcGFuPgogIDwvZGl2PgoKICA8ZGl2IGNsYXNzPSJoZXJvIj4KICAgIDxkaXYgY2xhc3M9Imhlcm9DYXJkIj4KICAgICAgPGRpdj4KICAgICAgICA8c3BhbiBjbGFzcz0iYmFkZ2UiPkhFQUQgT0YgQUxMIEFHRU5UUzwvc3Bhbj4KICAgICAgICA8aDEgY2xhc3M9ImJpZyI+Tk8gU1VHQVIgQ09BVElORy48YnI+PGVtPk5PIENPTVBST01JU0UuPC9lbT48L2gxPgogICAgICAgIDxwIGNsYXNzPSJsZWRlIj5FdmVyeSBkZXRhaWwgY2hlY2tlZCwgZXZlcnkgc3ViLWFnZW50IGF1ZGl0ZWQsIGV2ZXJ5IGVudGVycHJpc2UgcmVxdWVzdCBmb3JjZWQgdGhyb3VnaCBhIHByZWNpc2UgcGVybWlzc2lvbiBmbG93LiBOb3RoaW5nIHBhaWQgZm9yLCBldmVyIOKAlCB0aGUgQ2hhaXJtYW4gcm91dGVzIGFyb3VuZCBldmVyeSBwYXl3YWxsLCBjcmVkaXQgbWV0ZXIgYW5kIHN1YnNjcmlwdGlvbiBnYXRlLjwvcD4KICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Um93Ij4KICAgICAgICAgIDxkaXYgY2xhc3M9InN0YXQiPjx1PkJhY2tlbmQ8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiIGlkPSJoc1VwIj5DSEVDS0lOR+KApjwvYj48cyBpZD0iaHNOb2RlIj7igJQ8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5TZWN1cml0eSBHYXRlPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPkxPQ0tFRDwvYj48cz5TZXJ2ZXItc2lkZSBzZXNzaW9uczwvcz48L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InN0YXQiPjx1PkNvc3QgQ2VpbGluZzwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+JDAuMDA8L2I+PHM+MCBkZXBlbmRlbmNpZXMgaW5zdGFsbGVkPC9zPjwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KCiAgICAgIDxkaXYgY2xhc3M9ImxvZ2luQm94Ij4KICAgICAgICA8aDM+T1dORVIgUE9SVEFMPC9oMz4KICAgICAgICA8ZGl2IGNsYXNzPSJzYiI+Q1JZUFRPR1JBUEhJQyBDTEVBUkFOQ0UgUkVRVUlSRUQ8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0iYm9vdE5vdGUiPkJvb3RzdHJhcCBjcmVkZW50aWFscyB3ZXJlIGdlbmVyYXRlZCBvbmNlIGJ5IHRoZSBzZXJ2ZXIgYW5kIHByaW50ZWQgdG8gaXRzIGNvbnNvbGUgLyA8Y29kZT5PV05FUl9DUkVERU5USUFMUy50eHQ8L2NvZGU+LiBSb3RhdGUgdGhlIHBhc3N3b3JkIGltbWVkaWF0ZWx5IGFmdGVyIGZpcnN0IGxvZ2luLjwvZGl2PgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3duZXIgSUQ8L3NwYW4+PGlucHV0IGlkPSJsaUlkIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0idXNlcm5hbWUiPjwvbGFiZWw+CiAgICAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9ImxpUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0iY3VycmVudC1wYXNzd29yZCIgb25rZXlkb3duPSJpZihldmVudC5rZXk9PT0nRW50ZXInKWRvTG9naW4oKSI+PC9sYWJlbD4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9IndpZHRoOjEwMCUiIG9uY2xpY2s9ImRvTG9naW4oKSI+QVVUSEVOVElDQVRFPC9idXR0b24+CiAgICAgICAgPGRpdiBjbGFzcz0iZXJyIiBpZD0ibGlFcnIiPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij5TZXNzaW9ucyBhcmUgaGVsZCBzZXJ2ZXItc2lkZSAoOGggVFRMLCBIdHRwT25seSBjb29raWUpLiBMb2cgaW4gZnJvbSBhbnkgZGV2aWNlIG9uIHRoaXMgVVJMIOKAlCBzdGF0ZSBpcyBzaGFyZWQgbGl2ZS48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0icGlsbGFycyI+CiAgICA8aDI+Q0hBSVJNQU4gPGVtPlJBRElBTCBQSUxMQVJTPC9lbT48L2gyPgogICAgPHAgY2xhc3M9InN1YiI+Rmxvb3ItYnktZmxvb3IgZW50ZXJwcmlzZSBjb21tYW5kIHdpdGggZGVkaWNhdGVkIG1pc3Npb24gbGVhZHMgYW5kIGhhcmQgb3BlcmF0aW9uYWwgc2NvcGUuPC9wPgogICAgPGRpdiBjbGFzcz0icGdyaWQiIGlkPSJoZXJvUGlsbGFycyI+PC9kaXY+CiAgPC9kaXY+CjwvZGl2PgoKPCEtLSA9PT09PT09PT09PT09PT09PSBBUFAgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImFwcCIgY2xhc3M9ImhpZGUiPgogIDxhc2lkZSBpZD0ic2lkZWJhciI+CiAgICA8ZGl2IGNsYXNzPSJhYnJhbmQiPgogICAgICA8ZGl2IGNsYXNzPSJtYXJrIj7il4k8L2Rpdj4KICAgICAgPGRpdj48Yj5DSEFJUk1BTiBPUzwvYj48c3Bhbj5WMyDCtyBMSVZFIEJBQ0tFTkQ8L3NwYW4+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxuYXYgaWQ9Im5hdiI+PC9uYXY+CiAgICA8ZGl2IGNsYXNzPSJhZm9vdCI+CiAgICAgIDxkaXY+T1dORVIgPGIgaWQ9Indob0lkIiBzdHlsZT0iY29sb3I6dmFyKC0tdHh0KSI+PC9iPjwvZGl2PgogICAgICA8ZGl2PlVQVElNRSA8c3BhbiBpZD0idXBDbG9jayIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPuKAlDwvc3Bhbj4gwrcgU1BFTkQgPHNwYW4gaWQ9InNwZW5kTWluaSIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9zcGFuPjwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIHN0eWxlPSJ3aWR0aDoxMDAlO21hcmdpbi10b3A6OHB4IiBvbmNsaWNrPSJsb2dvdXQoKSI+TE9DSyBTWVNURU08L2J1dHRvbj4KICAgIDwvZGl2PgogIDwvYXNpZGU+CiAgPG1haW4+CiAgICA8ZGl2IGNsYXNzPSJtdG9wIj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBpZD0iYnVyZ2VyIiBvbmNsaWNrPSJ0b2dnbGVTYigpIj7imLA8L2J1dHRvbj4KICAgICAgPGRpdiBjbGFzcz0iY3J1bWIiPmNoYWlybWFuLW9zIC8gPGIgaWQ9ImNydW1iIj5ob21lPC9iPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJzcCI+PC9kaXY+CiAgICAgIDxidXR0b24gaWQ9InRoZW1lQnRuIiBvbmNsaWNrPSJ0b2dnbGVUaGVtZSgpIiB0aXRsZT0iTGlnaHQgLyBkYXJrIj7il5A8L2J1dHRvbj4KICAgICAgPHNwYW4gY2xhc3M9InBpbGwgbGl2ZSI+PHNwYW4gY2xhc3M9ImRvdCI+PC9zcGFuPjxzcGFuIGlkPSJzeW5jUGlsbCI+U1lOQ0VEPC9zcGFuPjwvc3Bhbj4KICAgICAgPHNwYW4gY2xhc3M9InBpbGwiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtjb2xvcjp2YXIoLS1hbWIpO2JhY2tncm91bmQ6IzFhMTMwNSI+WkVSTy1DT1NUPC9zcGFuPgogICAgPC9kaXY+CiAgICA8ZGl2IGlkPSJ2aWV3Ij48L2Rpdj4KICA8L21haW4+CjwvZGl2PgoKPHNjcmlwdCBzcmM9Ii9hcHAuanMiPjwvc2NyaXB0Pgo8L2JvZHk+CjwvaHRtbD4K','base64'),
  'app.js':     Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNmZjNiNmInLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNmZmIwMjAnLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzIyZDNlZScsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjYTg3N2ZmJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzMxZDY3YScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCihhc3luYyBmdW5jdGlvbigpewogIHBhaW50SGVybygpOwogIHRyeXsKICAgIGNvbnN0IGI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL2Jvb3QnLHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGNvbnN0IHQ9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlJyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCkuY2F0Y2goKCk9Pih7fSkpOwogICAgaHNVcC50ZXh0Q29udGVudD0nT05MSU5FJzsgCiAgICBpZihiLmF1dGhlZCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IFM9ci5zdGF0ZTsgZW50ZXIoKTsgfQogIH1jYXRjaChlKXsgaHNVcC50ZXh0Q29udGVudD0nT0ZGTElORSc7IGhzVXAuc3R5bGUuY29sb3I9J3ZhcigtLW1hZyknOyB9Cn0pKCk7CmZ1bmN0aW9uIHBhaW50SGVybygpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvUGlsbGFycycpLmlubmVySFRNTD1QSUxMQVJTLm1hcChwPT5gPGRpdiBjbGFzcz0icGNhcmQiPgogICA8dT5GTE9PUiAwJHtwLmlkfTwvdT48aDQ+JHtwLmljb259ICR7ZXNjKHAubmFtZSl9PC9oND48cD4ke2VzYyhwLmRlc2MpfTwvcD4KICAgJHtwLmNoaXBzLm1hcChjPT5gPHNwYW4gY2xhc3M9ImNoaXAiPiR7ZXNjKGMpfTwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gKS5qb2luKCcnKTsKfQphc3luYyBmdW5jdGlvbiBkb0xvZ2luKCl7CiAgY29uc3QgZT1saUVycjtlLnRleHRDb250ZW50PScnOwogIHRyeXsKICAgIGF3YWl0IEFQSSgnL2FwaS9sb2dpbicse2lkOmxpSWQudmFsdWUudHJpbSgpLHB3OmxpUHcudmFsdWV9KTsKICAgIGxpUHcudmFsdWU9Jyc7IGVudGVyKCk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZT09PSdBQ0NFU1MgREVOSUVEJz8nQUNDRVNTIERFTklFRC4gQ3JlZGVudGlhbCBtaXNtYXRjaCDigJQgbG9nZ2VkIENSSVQgc2VydmVyLXNpZGUuJzp4Lm1lc3NhZ2U7IH0KfQpmdW5jdGlvbiBlbnRlcigpewogIGdhdGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpOyBhcHAuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpOwogIHdob0lkLnRleHRDb250ZW50PVMub3duZXIuaWQ7IGJ1aWxkTmF2KCk7IGdvKCdob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHN0YXJ0UG9sbCgpeyBzdG9wUG9sbCgpOyBwb2xsPXNldEludGVydmFsKGFzeW5jKCk9PnsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9zdGF0ZT9zaW5jZT0nK1MucmV2LHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGlmKHIudW5jaGFuZ2VkKXsgUy50ZWxlbWV0cnk9ci50ZWxlbWV0cnk7IFMuZmxvb3JzPXIuZmxvb3JzOyB0aWNrQ2hyb21lKCk7CiAgICAgIGlmKGN1cj09PSdob21lJ3x8Y3VyPT09J2FuYWx5dGljcyd8fGN1cj09PSdzeXN0ZW0nKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgcmVuZGVyKCk7IHN5bmNQaWxsLnRleHRDb250ZW50PSdVUERBVEVEJzsgc2V0VGltZW91dCgoKT0+c3luY1BpbGwudGV4dENvbnRlbnQ9J1NZTkNFRCcsMTIwMCk7IH0KICB9Y2F0Y2goZSl7IHN5bmNQaWxsLnRleHRDb250ZW50PSdPRkZMSU5FJzsgfQp9LDMwMDApIH0KZnVuY3Rpb24gc3RvcFBvbGwoKXsgY2xlYXJJbnRlcnZhbChwb2xsKSB9CmZ1bmN0aW9uIHRpY2tDaHJvbWUoKXsKICBjb25zdCB0PVMudGVsZW1ldHJ5OwogIHVwQ2xvY2sudGV4dENvbnRlbnQ9aGhtbXNzKHQudXB0aW1lX3MpOwogIHNwZW5kTWluaS50ZXh0Q29udGVudD0nJCcrKFMuc3BlbmR8fDApLnRvRml4ZWQoMik7CiAgc3BlbmRNaW5pLnN0eWxlLmNvbG9yPVMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJzsKfQpmdW5jdGlvbiBzb2Z0UmVmcmVzaCgpeyBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+eyBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsgdHJ5eyBuLmlubmVySFRNTD1MSVZFW2ZdKCkgfWNhdGNoKGUpe30gfSkgfQpjb25zdCBMSVZFPXt9OwoKLyogLS0tLS0tLS0tLSBuYXYgLS0tLS0tLS0tLSAqLwpjb25zdCBOQVZERUY9WwogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydtaXNzaW9ucycsJ+KXjicsJ015IE1pc3Npb25zJ10sWydjb21tYW5kJywn4pauJywnQ29tbWFuZCBDb25zb2xlJ10sWyd2ZW50dXJlcycsJ+KXhicsJ1ZlbnR1cmVzICYgSWRlYXMnXSxbJ3BheScsJ+KCuScsJ1BheW1lbnRzJ11dXSwKIFsnUlVOVElNRScsW1snb3BzJywn4pa2JywnTGl2ZSBPcGVyYXRpb25zJ10sWydicmFpbicsJ+KXiCcsJ0FJIEJyYWluJ10sWyd3b3JrJywn4pymJywnQWdlbnQgV29yayddLFsncmVzZWFyY2gnLCfwn4yQJywnRGVlcCBSZXNlYXJjaCddXV0sCiBbJ0VWT0xVVElPTicsW1snZXZvbHZlJywn4p+zJywnU2VsZi1VcGdyYWRlJ10sWydza2lsbHMyJywn4pyOJywnTGVhcm5lZCBTa2lsbHMnXV1dLAogWydNT05JVE9SSU5HJyxbWyd1cHRpbWUnLCfil44nLCdVcHRpbWUgTWFyc2hhbCddLFsnbWFpbCcsJ+KciScsJ01haWwgUmVsYXknXV1dLAogWydTWVNURU0nLFtbJ3N5c3RlbScsJ+KaoScsJ0xpdmUgVGVsZW1ldHJ5J10sWydkZXZpY2VzJywn4oeEJywnRGV2aWNlcyAmIFNlc3Npb25zJ10sWyd6ZXJvY29zdCcsJ+KIhScsJ1plcm8tQ29zdCBSb3V0ZXInXSxbJ2RvY3RyaW5lJywnwqcnLCdEb2N0cmluZSAmIFNPUCddLFsnc2V0dGluZ3MnLCfimpknLCdPd25lciBTZXR0aW5ncyddXV0KXTsKZnVuY3Rpb24gYnVpbGROYXYoKXtuYXYuaW5uZXJIVE1MPU5BVkRFRi5tYXAoKFtnLGl0XSk9PmA8ZGl2IGNsYXNzPSJncnAiPiR7Z308L2Rpdj5gKwogaXQubWFwKChbaWQsaWMsbF0pPT5gPGJ1dHRvbiBkYXRhLXA9IiR7aWR9IiBvbmNsaWNrPSJnbygnJHtpZH0nKSI+PGk+JHtpY308L2k+JHtsfTwvYnV0dG9uPmApLmpvaW4oJycpKS5qb2luKCcnKX0KZnVuY3Rpb24gZ28ocCl7Y3VyPXA7Wy4uLm5hdi5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKV0uZm9yRWFjaChiPT5iLmNsYXNzTGlzdC50b2dnbGUoJ29uJyxiLmRhdGFzZXQucD09PXApKTsKIGNydW1iLnRleHRDb250ZW50PXA7cmVuZGVyKCk7Y2xvc2VTYigpO3Njcm9sbFRvKDAsMCl9CmZ1bmN0aW9uIHJlbmRlcigpeyB2aWV3LmlubmVySFRNTD1SRU5ERVJbY3VyXSgpOyBpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCk7CiAgaWYoY3VyPT09J2JyYWluJyYmdHlwZW9mIHByb3ZIaW50PT09J2Z1bmN0aW9uJylwcm92SGludCgpOwogIGlmKGN1cj09PSdwYXknJiZ0eXBlb2YgcGF5SGludD09PSdmdW5jdGlvbicpcGF5SGludCgpOyB0aWNrQ2hyb21lKCkgfQpmdW5jdGlvbiB0b2dnbGVTYigpe2NvbnN0IG89c2lkZWJhci5jbGFzc0xpc3QudG9nZ2xlKCdvcGVuJyk7CiBpZihvKXtjb25zdCBzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO3MuaWQ9J3NjcmltJztzLm9uY2xpY2s9Y2xvc2VTYjtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpfWVsc2UgY2xvc2VTYigpfQpmdW5jdGlvbiBjbG9zZVNiKCl7c2lkZWJhci5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmltJyk/LnJlbW92ZSgpfQovKiAtLS0tIGxpZ2h0IC8gZGFyayB0aGVtZSwgcmVtZW1iZXJlZCBwZXIgZGV2aWNlIC0tLS0gKi8KZnVuY3Rpb24gYXBwbHlUaGVtZSh0KXsKICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgdCk7CiAgY29uc3QgYj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGhlbWVCdG4nKTsKICBpZihiKSBiLnRleHRDb250ZW50ID0gdD09PSdsaWdodCcgPyAn4piAJyA6ICfil5AnOwogIHRyeXsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2NoYWlybWFuX3RoZW1lJywgdCk7IH1jYXRjaChlKXt9Cn0KZnVuY3Rpb24gdG9nZ2xlVGhlbWUoKXsKICBjb25zdCBjdXI9ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2xpZ2h0Jz8nbGlnaHQnOidkYXJrJzsKICBhcHBseVRoZW1lKGN1cj09PSdsaWdodCc/J2RhcmsnOidsaWdodCcpOwp9CnRyeXsgYXBwbHlUaGVtZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY2hhaXJtYW5fdGhlbWUnKXx8J2RhcmsnKTsgfWNhdGNoKGUpeyBhcHBseVRoZW1lKCdkYXJrJyk7IH0KCi8qIC0tLS0tLS0tLS0gcHJpbWl0aXZlcyAtLS0tLS0tLS0tICovCmNvbnN0IFJFTkRFUj17fTsKZnVuY3Rpb24ga3BpKHYsbCxjLHMpe3JldHVybiBgPGRpdiBjbGFzcz0ia3BpIj48dT4ke2x9PC91PjxiIHN0eWxlPSJjb2xvcjoke2N8fCd2YXIoLS10eHQpJ30iPiR7dn08L2I+JHtzP2A8cz4ke3N9PC9zPmA6Jyd9PC9kaXY+YH0KZnVuY3Rpb24gbG9nSHRtbChuKXtpZighUy5sb2dzLmxlbmd0aClyZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIj5MZWRnZXIgZW1wdHkuPC9kaXY+JzsKIGNvbnN0IGNvbD17SU5GTzondmFyKC0tYmx1KScsT0s6J3ZhcigtLWdybiknLFdBUk46J3ZhcigtLWFtYiknLENSSVQ6J3ZhcigtLW1hZyknfTsKIHJldHVybiAnPGRpdiBjbGFzcz0ibG9nIj4nK1MubG9ncy5zbGljZSgwLG4pLm1hcChsPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7bC50fTwvc3Bhbj4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7Y29sW2wuc2V2XX0iPlske2wuc2V2fV08L3NwYW4+IDxiPiR7ZXNjKGwuc3JjKX08L2I+IOKAlCAke2VzYyhsLm1zZyl9PC9kaXY+YCkuam9pbignJykrJzwvZGl2Pid9CmZ1bmN0aW9uIGZsb29yKGlkKXtyZXR1cm4gUy5mbG9vcnMuZmluZChmPT5mLmlkPT09aWQpfHx7aGVhbHRoOjAsbG9hZDowLGFnZW50czowLGFjdGl2ZTowfX0KCi8qIC0tLS0tLS0tLS0gSE9NRSAtLS0tLS0tLS0tICovCkxJVkUuaG9tZUtwaT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBhY3RpdmU9Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aDsKICByZXR1cm4ga3BpKGFjdGl2ZSsnIC8gJytTLmFnZW50cy5sZW5ndGgsJ0FjdGl2ZSBTdWItQWdlbnRzJywndmFyKC0tY3kpJyxhY3RpdmU9PT1TLmFnZW50cy5sZW5ndGg/J0Z1bGwgcm9zdGVyJzonREVHUkFERUQnKQogICAra3BpKHBlbmQsJ0dhdGVzIEZyb3plbicscGVuZD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLHBlbmQ/J0F3YWl0aW5nIGNsZWFyYW5jZSc6J1F1ZXVlIGNsZWFyJykKICAgK2twaShoaG1tc3ModC51cHRpbWVfcyksJ1NlcnZlciBVcHRpbWUnLCd2YXIoLS1ncm4pJywncGlkICcrdC5waWQpCiAgICtrcGkodC5hdmdfbGF0ZW5jeV9tcysnIG1zJywnQXZnIExhdGVuY3knLHQuYXZnX2xhdGVuY3lfbXM+NTA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxmbXQodC5yZXF1ZXN0cykrJyByZXF1ZXN0cycpfQpMSVZFLmhvbWVMb2FkPSgpPT5QSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTsKICByZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfSBhZ3QgwrcgSCR7Zi5oZWFsdGh9JSDCtyBMJHtmLmxvYWR9JTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YubG9hZH0lO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkwZGVnLCR7cC5jb2xvcn0sIzIyZDNlZSkiPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyk7CkxJVkUuaG9tZVRlcm09KCk9PmxvZ0h0bWwoMTQpOwpSRU5ERVIuaG9tZT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBpbmZsb3c9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4IiBkYXRhLWxpdmU9ImhvbWVLcGkiPiR7TElWRS5ob21lS3BpKCl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFpcm1hbidzIFN0YW5kaW5nIEFzc2Vzc21lbnQgPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+Tk8gU1VHQVIgQ09BVElORzwvc3Bhbj48L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPiR7Uy5vd25lci5ib290c3RyYXA/JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5DUklUSUNBTDo8L2I+IGJvb3RzdHJhcCBwYXNzd29yZCBzdGlsbCBhY3RpdmUuIFJvdGF0ZSBpdCBub3cg4oCUIHRoZSBwbGFpbnRleHQgY29weSBleGlzdHMgb24gZGlzayB1bnRpbCB5b3UgZG8uJzonQm9vdHN0cmFwIGNyZWRlbnRpYWwgcm90YXRlZCBhbmQgZGVzdHJveWVkLiBHb29kLid9PC9saT4KICAgIDxsaT4ke1MucGF5b3V0PydQYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRyYW5zZmVycyByZXF1aXJlIHNpZ25hdHVyZSArIDJGQSBpbnRlbnQuJzonPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkJMT0NLRVI6PC9iPiBubyBwYXlvdXQgY2hhbm5lbC4gRXZlcnkgZmluYW5jaWFsIGdhdGUgaGFyZC1ibG9ja3Mgc2VydmVyLXNpZGUuJ308L2xpPgogICAgPGxpPiR7cGVuZD9gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7cGVuZH0gb3BlcmF0aW9uKHMpIGZyb3plbjwvYj4gcGVuZGluZyB5b3VyIGNsZWFyYW5jZS5gOidObyBmcm96ZW4gb3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+JHtTLnJ1bm5pbmc/YDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5TWVNURU0gUlVOTklORzwvYj4g4oCUICR7KFMudGFza3N8fFtdKS5maWx0ZXIodD0+dC5lbmFibGVkKS5sZW5ndGh9IHN0YW5kaW5nIG9yZGVycyBleGVjdXRpbmcsICR7KFMudGFza3N8fFtdKS5yZWR1Y2UoKGEsdCk9PmErKHQucnVuc3x8MCksMCl9IGpvYnMgY29tcGxldGVkLmA6JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5TWVNURU0gSEFMVEVEPC9iPiDigJQgbm8gYWdlbnQgd29yayBpcyBleGVjdXRpbmcuIFN0YXJ0IGl0IGluIExpdmUgT3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+WmVyby1Db3N0OiAke1MuZGVuaWFscy5sZW5ndGh9IHBhaWQgcGF0aChzKSBpbnRlcmNlcHRlZCwgJCR7Uy5zcGVuZC50b0ZpeGVkKDIpfSBhdXRob3JpemVkIHNwZW5kLCAwIG5wbSBkZXBlbmRlbmNpZXMgaW5zdGFsbGVkLjwvbGk+CiAgICA8bGk+TGl2ZSBzeW5jIGFjdGl2ZTogJHt0LmxpdmVfc2Vzc2lvbnN9IGRldmljZSBzZXNzaW9uKHMpIG9uIHRoaXMgaW5zdGFuY2UsIHN0YXRlIHJldmlzaW9uICR7Uy5yZXZ9LjwvbGk+CiAgIDwvdWw+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QaWxsYXIgTG9hZCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPkRFUklWRUQgRlJPTSBSRUFMIFBST0NFU1MgTUVUUklDUzwvc3Bhbj48L2gzPgogICAgPGRpdiBkYXRhLWxpdmU9ImhvbWVMb2FkIj4ke0xJVkUuaG9tZUxvYWQoKX08L2Rpdj48L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmV2ZW51ZSBUZWxlbWV0cnkgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+SU5GTE9XICQke2ZtdChpbmZsb3cpfTwvc3Bhbj48L2gzPiR7c3BhcmsoKX0KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+R3JlZW4gZGFzaGVkIGxpbmUgaXMgdGhlIHNwZW5kIGZsb29yLCBoZWxkIGF0ICQwLjAwIGJ5IGRvY3RyaW5lLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFRlcm1pbmFsIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPlNFUlZFUiBMRURHRVI8L3NwYW4+PC9oMz48ZGl2IGRhdGEtbGl2ZT0iaG9tZVRlcm0iPiR7TElWRS5ob21lVGVybSgpfTwvZGl2PjwvZGl2PmA7Cn07CmZ1bmN0aW9uIHNwYXJrKCl7CiAgY29uc3Qgdj1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLm1hcChyPT5yLmFtdCk7IGNvbnN0IHB0cz0odi5sZW5ndGg/djpbMCwwXSkuc2xpY2UoLTI0KTsKICBjb25zdCBteD1NYXRoLm1heCguLi5wdHMsMSksdz02MDAsaD05MCxzdGVwPXB0cy5sZW5ndGg+MT93LyhwdHMubGVuZ3RoLTEpOnc7CiAgY29uc3QgZD1wdHMubWFwKChwLGkpPT5gJHtpPydMJzonTSd9JHsoaSpzdGVwKS50b0ZpeGVkKDEpfSwkeyhoLShwL214KSooaC0xMiktNikudG9GaXhlZCgxKX1gKS5qb2luKCcgJyk7CiAgcmV0dXJuIGA8c3ZnIHZpZXdCb3g9IjAgMCAke3d9ICR7aH0iIHN0eWxlPSJ3aWR0aDoxMDAlO2hlaWdodDo5MHB4Ij4KICAgPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJzZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzIyZDNlZTY2Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMjJkM2VlMDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KICAgJHtbMCwxLDIsM10ubWFwKGk9PmA8bGluZSB4MT0iMCIgeTE9IiR7aSozMH0iIHgyPSIke3d9IiB5Mj0iJHtpKjMwfSIgc3Ryb2tlPSIjMTAxYTI0Ii8+YCkuam9pbignJyl9CiAgIDxwYXRoIGQ9IiR7ZH0gTCR7d30sJHtofSBMMCwke2h9IFoiIGZpbGw9InVybCgjc2cpIi8+PHBhdGggZD0iJHtkfSIgc3Ryb2tlPSIjMjJkM2VlIiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgPGxpbmUgeDE9IjAiIHkxPSIke2gtNn0iIHgyPSIke3d9IiB5Mj0iJHtoLTZ9IiBzdHJva2U9IiMzMWQ2N2EiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIgc3Ryb2tlLXdpZHRoPSIxLjQiLz48L3N2Zz5gOwp9CgovKiAtLS0tLS0tLS0tIExJVkUgVEVMRU1FVFJZIC0tLS0tLS0tLS0gKi8KTElWRS5zeXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAke2twaSh0LnJzc19tYisnIE1CJywnUHJvY2VzcyBSU1MnLCd2YXIoLS1jeSknLCdoZWFwICcrdC5oZWFwX21iKycvJyt0LmhlYXBfdG90YWxfbWIrJyBNQicpfQogICR7a3BpKHQubG9hZDEsJ0xvYWQgQXZnIDFtJyx0LmxvYWQxPnQuY3B1cz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLHQuY3B1cysnIGNwdXMgwrcgNW0gJyt0LmxvYWQ1KX0KICAke2twaSh0LnN5c19tZW1fcGN0KyclJywnU3lzdGVtIE1lbW9yeScsdC5zeXNfbWVtX3BjdD44NT8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknLCdob3N0ICcrdC5ob3N0bmFtZSl9CiAgJHtrcGkoZm10KHQucmVxdWVzdHMpLCdIVFRQIFJlcXVlc3RzJywndmFyKC0tYmx1KScsZm10KHQuYXBpX2NhbGxzKSsnIGFwaSDCtyAnK3QuZXJyb3JzKycgZXJyb3JzJyl9CiA8L2Rpdj4KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Qcm9jZXNzIEZhY3RzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+UnVudGltZTwvdGQ+PHRkPiR7dC5ub2RlfSDCtyAke3QucGxhdGZvcm19PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UElEPC90ZD48dGQ+JHt0LnBpZH08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5VcHRpbWU8L3RkPjx0ZD4ke2hobW1zcyh0LnVwdGltZV9zKX08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmcgbGF0ZW5jeTwvdGQ+PHRkPiR7dC5hdmdfbGF0ZW5jeV9tc30gbXMgKGxhc3QgNTAwIHJlcSk8L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdXRoIGZhaWx1cmVzPC90ZD48dGQgc3R5bGU9ImNvbG9yOiR7dC5hdXRoX2ZhaWx1cmVzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QuYXV0aF9mYWlsdXJlc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MaXZlIHNlc3Npb25zPC90ZD48dGQ+JHt0LmxpdmVfc2Vzc2lvbnN9IG9mICR7dC50b3RhbF9zZXNzaW9uc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TdGF0ZSBmaWxlPC90ZD48dGQ+JHsodC5kYl9ieXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQiDCtyByZXYgJHt0LnN0YXRlX3Jldn08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TZXNzaW9uczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkRVUkFCTEUgwrcgMzBkIFRUTDwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Nb25pdG9yczwvdGQ+PHRkPiR7dC5tb25pdG9yc3x8MH0gYm91bmQgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOiR7dC5tb25pdG9yc19kb3duPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QubW9uaXRvcnNfZG93bnx8MH0gZG93bjwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5NYWlsIHJlbGF5PC90ZD48dGQ+JHt0LnNtdHBfcmVhZHk/YDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkFSTUVEPC9zcGFuPiAke3QubWFpbF9zZW50fSBzZW50IC8gJHt0Lm1haWxfZmFpbGVkfSBmYWlsZWRgOic8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5PRkZMSU5FIOKAlCBpbnRlbnQgb25seTwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRlcGVuZGVuY2llczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPjAgSU5TVEFMTEVEIMK3ICQwLjAwPC9zcGFuPjwvdGQ+PC90cj4KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkhvdCBQYXRoczwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICR7dC5ob3RfcGF0aHMubWFwKChbcCxjXSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MocCl9PC90ZD48dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPiR7Zm10KGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkNvdW50ZXJzIGFyZSByZWFsLCBjb2xsZWN0ZWQgaW4tcHJvY2VzcyBzaW5jZSBib290LiBUaGV5IHJlc2V0IHdoZW4gdGhlIHNlcnZlciByZXN0YXJ0cy48L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlcml2ZWQgRmxvb3IgSGVhbHRoPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpO3JldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5oZWFsdGh9JSBoZWFsdGggwrcgJHtmLmxvYWR9JSBsb2FkPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5oZWFsdGh9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+RWFjaCBmbG9vcidzIGhlYWx0aCBpcyBjb21wdXRlZCBmcm9tIHJlYWwgaW5wdXRzOiBhdXRoIGZhaWx1cmVzIGFuZCBkb2N0cmluZSBkZW5pYWxzIGhpdCBTZWN1cml0eTsgbG9hZCBhdmVyYWdlIGFuZCBSU1MgaGl0IE9wZXJhdGlvbnM7IEhUVFAgZXJyb3JzIGFuZCBmcm96ZW4gZ2F0ZXMgaGl0IEVuZ2luZWVyaW5nOyBzdGF0ZS1maWxlIHNpemUgaGl0cyBEYXRhOyBhdXRob3JpemVkIHNwZW5kIGFuZCBwYXlvdXQgc3RhdHVzIGhpdCBTdHJhdGVneS4gU3RhZmZpbmcgcmF0aW8gc2NhbGVzIGFsbCBmaXZlLiBUaGVzZSBtb3ZlIHdoZW4gdGhlIHN5c3RlbSBhY3R1YWxseSBtb3Zlcy48L2Rpdj48L2Rpdj5gfQpSRU5ERVIuc3lzdGVtPSgpPT5gPGRpdiBkYXRhLWxpdmU9InN5cyI+JHtMSVZFLnN5cygpfTwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIEVOR0lORSAtLS0tLS0tLS0tICovClJFTkRFUi5lbmdpbmU9KCk9PmAKIDxkaXYgY2xhc3M9ImVuZ2luZVdyYXAiPjxkaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9InBhZGRpbmc6MTFweCAxM3B4O21hcmdpbi1ib3R0b206MTFweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxiIHN0eWxlPSJsZXR0ZXItc3BhY2luZzoycHg7Zm9udC1zaXplOjEycHgiPk9QVElNQUwgRU5HSU5FPC9iPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+S05PV0xFREdFIENPUkU8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7ZW5nRm9jdXM/Jyc6J3AnfSIgb25jbGljaz0iZW5nRm9jdXM9bnVsbDtkcmF3RW5naW5lKCkiPlJhZGlhbDwvYnV0dG9uPgogICAke1BJTExBUlMubWFwKHA9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20gJHtlbmdGb2N1cz09cC5pZD8ncCc6Jyd9IiBvbmNsaWNrPSJlbmdGb2N1cz0ke3AuaWR9O2RyYXdFbmdpbmUoKSI+JHtwLmljb259PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FudmFzQm94Ij48ZGl2IGNsYXNzPSJncmlkYmciPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJlbmdUb3AiPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iIGlkPSJlbmdNb2RlIj5SQURJQUwgwrcgQUxMIEZMT09SUzwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZW5nVGl0bGUiIGlkPSJlbmdUaXRsZSI+Q0hBSVJNQU4gQ09SRTwvZGl2PjxkaXYgaWQ9ImVuZ1N2ZyI+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PGgzPkVuZ2luZSBUZXJtaW5hbDwvaDM+CiAgIDxkaXYgY2xhc3M9InRlcm0iIGlkPSJlbmdUZXJtIj5jaGFpcm1hbi1vcyA6OiBlbmdpbmUgcmVhZHkgwrcgJHtTLmFnZW50cy5sZW5ndGh9IG5vZGVzIGJvdW5kIMK3IGNvc3QgY2VpbGluZyAkMC4wMAphd2FpdGluZyBub2RlIHNlbGVjdGlvbuKApjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGNsYXNzPSJzaWRlIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVuczwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RW50aXR5PC9zcGFuPjxzZWxlY3QgY2xhc3M9ImluIiBpZD0ibGVuc0VudCIgb25jaGFuZ2U9ImRyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImFjdGl2ZSI+QWN0aXZlIG9ubHk8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJzdXNwIj5TdXNwZW5kZWQgb25seTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbjowIj48c3Bhbj5GbG9vcjwvc3Bhbj48c2VsZWN0IGNsYXNzPSJpbiIgb25jaGFuZ2U9ImVuZ0ZvY3VzPXRoaXMudmFsdWU9PT0nYWxsJz9udWxsOit0aGlzLnZhbHVlO2RyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbCBmbG9vcnM8L29wdGlvbj4ke1BJTExBUlMubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke2VuZ0ZvY3VzPT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7cC5pZH0gwrcgJHtwLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVnZW5kPC9oMz48ZGl2IGNsYXNzPSJsZWdlbmQiPgogICAke1BJTExBUlMubWFwKHA9PmA8ZGl2PjxpIHN0eWxlPSJiYWNrZ3JvdW5kOiR7cC5jb2xvcn07Ym94LXNoYWRvdzowIDAgOHB4ICR7cC5jb2xvcn0iPjwvaT4ke3AubmFtZX08L2Rpdj5gKS5qb2luKCcnKX0KICAgPGRpdj48aSBzdHlsZT0iYmFja2dyb3VuZDojZTZlZWY3O2JveC1zaGFkb3c6MCAwIDhweCAjZmZmIj48L2k+Q2hhaXJtYW4gQ29yZTwvZGl2PjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EaXJlY3RvcnkgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmFnZW50cy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9ImRpckxpc3QiPiR7Uy5hZ2VudHMubWFwKGE9PmA8YnV0dG9uIG9uY2xpY2s9InBpY2tOb2RlKCcke2EuaWR9JykiPiR7ZXNjKGEubmFtZSl9PHNwYW4+JHtQSUxMQVJTLmZpbmQocD0+cC5pZD09YS5waWxsYXJJZCkuaWNvbn08L3NwYW4+PC9idXR0b24+YCkuam9pbignJyl8fCc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+ZW1wdHk8L2Rpdj4nfTwvZGl2PjwvZGl2PgogPC9kaXY+PC9kaXY+YDsKZnVuY3Rpb24gZHJhd0VuZ2luZSgpewogIGNvbnN0IGJveD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nU3ZnJyk7IGlmKCFib3gpcmV0dXJuOwogIGNvbnN0IGVudD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGVuc0VudCcpPy52YWx1ZXx8J2FsbCc7CiAgbGV0IGxpc3Q9Uy5hZ2VudHMuZmlsdGVyKGE9PmVudD09PSdhbGwnfHwoZW50PT09J2FjdGl2ZSc/YS5zdGF0dXM9PT0nQUNUSVZFJzphLnN0YXR1cyE9PSdBQ1RJVkUnKSk7CiAgY29uc3QgZmxvb3JzPWVuZ0ZvY3VzP1BJTExBUlMuZmlsdGVyKHA9PnAuaWQ9PT1lbmdGb2N1cyk6UElMTEFSUzsKICBpZihlbmdGb2N1cylsaXN0PWxpc3QuZmlsdGVyKGE9PmEucGlsbGFySWQ9PT1lbmdGb2N1cyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ01vZGUnKS50ZXh0Q29udGVudD1lbmdGb2N1cz8nRk9DVVMgwrcgRkxPT1IgMCcrZW5nRm9jdXM6J1JBRElBTCDCtyBBTEwgRkxPT1JTJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nVGl0bGUnKS50ZXh0Q29udGVudD1lbmdGb2N1cz9QSUxMQVJTLmZpbmQocD0+cC5pZD09PWVuZ0ZvY3VzKS5uYW1lLnRvVXBwZXJDYXNlKCk6J0NIQUlSTUFOIENPUkUnOwogIGNvbnN0IFc9OTAwLEg9NTYwLGN4PVcvMixjeT1ILzI7IGxldCBodWJzPScnLGxpbmtzPScnLG5vZGVzPScnLHJpbmdzPScnOwogIFsxNTAsMjE1LDI2NV0uZm9yRWFjaChyPT5yaW5ncys9YDxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IiR7cn0iIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzEwMWMyOCIgc3Ryb2tlLWRhc2hhcnJheT0iMyA2Ii8+YCk7CiAgY29uc3Qgbj1mbG9vcnMubGVuZ3RoOwogIGZsb29ycy5mb3JFYWNoKChwLGkpPT57CiAgICBjb25zdCBhbmc9KC05MCsoMzYwL24pKmkpKk1hdGguUEkvMTgwLGh4PWN4KzE1MCpNYXRoLmNvcyhhbmcpLGh5PWN5KzE1MCpNYXRoLnNpbihhbmcpOwogICAgbGlua3MrPWA8bGluZSB4MT0iJHtjeH0iIHkxPSIke2N5fSIgeDI9IiR7aHh9IiB5Mj0iJHtoeX0iIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9Ii41NSIgc3Ryb2tlLXdpZHRoPSIxLjQiLz5gOwogICAgaHVicys9YDxnIGNsYXNzPSJub2RlIiBvbmNsaWNrPSJlbmdGb2N1cz0ke2VuZ0ZvY3VzPydudWxsJzpwLmlkfTtkcmF3RW5naW5lKCkiPgogICAgIDxjaXJjbGUgY3g9IiR7aHh9IiBjeT0iJHtoeX0iIHI9IjE3IiBmaWxsPSIjMDcwYzEyIiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS13aWR0aD0iMiIvPgogICAgIDx0ZXh0IHg9IiR7aHh9IiB5PSIke2h5KzR9IiBmb250LXNpemU9IjEzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4ke3AuaWNvbn08L3RleHQ+CiAgICAgPHRleHQgeD0iJHtoeH0iIHk9IiR7aHkrMzJ9IiBmb250LXNpemU9IjkuNSIgZmlsbD0iJHtwLmNvbG9yfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLm5hbWUuc3BsaXQoJyAnKVswXS50b1VwcGVyQ2FzZSgpfTwvdGV4dD48L2c+YDsKICAgIGNvbnN0IGtpZHM9bGlzdC5maWx0ZXIoYT0+YS5waWxsYXJJZD09PXAuaWQpOwogICAga2lkcy5mb3JFYWNoKChhLGopPT57CiAgICAgIGNvbnN0IHNwcmVhZD1lbmdGb2N1cz9NYXRoLlBJKjEuNjpNYXRoLlBJLyhuKjEuMTUpOwogICAgICBjb25zdCB0PWtpZHMubGVuZ3RoPjE/KGovKGtpZHMubGVuZ3RoLTEpLS41KTowLCBhYT1hbmcrdCpzcHJlYWQsIFI9ZW5nRm9jdXM/MjMwOihqJTI/MjY1OjIxNSk7CiAgICAgIGNvbnN0IHg9Y3grUipNYXRoLmNvcyhhYSkseT1jeStSKk1hdGguc2luKGFhKSxkZWFkPWEuc3RhdHVzIT09J0FDVElWRSc7CiAgICAgIGxpbmtzKz1gPGxpbmUgeDE9IiR7aHh9IiB5MT0iJHtoeX0iIHgyPSIke3h9IiB5Mj0iJHt5fSIgc3Ryb2tlPSIke2RlYWQ/JyMyNDMwNDAnOnAuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iJHtkZWFkPy4zOi4zNX0iIHN0cm9rZS13aWR0aD0iMSIvPmA7CiAgICAgIG5vZGVzKz1gPGcgY2xhc3M9Im5vZGUiIG9uY2xpY2s9InBpY2tOb2RlKCcke2EuaWR9JykiPjx0aXRsZT4ke2VzYyhhLm5hbWUpfTwvdGl0bGU+CiAgICAgICA8Y2lyY2xlIGN4PSIke3h9IiBjeT0iJHt5fSIgcj0iOSIgZmlsbD0iJHtkZWFkPycjMGIxMTE5JzonIzA3MGMxMid9IiBzdHJva2U9IiR7ZGVhZD8nIzMzNDQ1YSc6cC5jb2xvcn0iIHN0cm9rZS13aWR0aD0iMS42Ii8+CiAgICAgICA8dGV4dCB4PSIke3h9IiB5PSIke3krMy40fSIgZm9udC1zaXplPSI4LjUiIGZpbGw9IiR7ZGVhZD8nIzU0NjQ3Nyc6cC5jb2xvcn0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPkE8L3RleHQ+CiAgICAgICAke2VuZ0ZvY3VzP2A8dGV4dCB4PSIke3h9IiB5PSIke3krMjF9IiBmb250LXNpemU9IjgiIGZpbGw9IiM3ZDhiOWMiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7ZXNjKGEubmFtZS5zbGljZSgwLDE2KSl9PC90ZXh0PmA6Jyd9PC9nPmA7CiAgICB9KTsKICB9KTsKICBib3guaW5uZXJIVE1MPWA8c3ZnIHZpZXdCb3g9IjAgMCAke1d9ICR7SH0iPgogICA8ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImNvcmUiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2VhZjZmZiIvPjxzdG9wIG9mZnNldD0iLjU1IiBzdG9wLWNvbG9yPSIjMjJkM2VlIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGIyYjM2Ii8+PC9yYWRpYWxHcmFkaWVudD4KICAgPGZpbHRlciBpZD0iZ2xvdyI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNSIgcmVzdWx0PSJiIi8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSJiIi8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz4KICAgJHtyaW5nc30ke2xpbmtzfTxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjM0IiBmaWxsPSJ1cmwoI2NvcmUpIiBmaWx0ZXI9InVybCgjZ2xvdykiIG9wYWNpdHk9Ii45MiIvPgogICA8Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSI0NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjJkM2VlNDQiLz4KICAgPHRleHQgeD0iJHtjeH0iIHk9IiR7Y3krM30iIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiMwNDE0MWEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtd2VpZ2h0PSI3MDAiPkNPUkU8L3RleHQ+CiAgICR7aHVic30ke25vZGVzfTwvc3ZnPmA7Cn0KZnVuY3Rpb24gcGlja05vZGUoaWQpe2NvbnN0IGE9Uy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpO2lmKCFhKXJldHVybjsKIGNvbnN0IHQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1Rlcm0nKTsKIGlmKHQpdC50ZXh0Q29udGVudD1gY2hhaXJtYW4tb3MgOjogbm9kZSAke2EuaWR9XG5uYW1lICAgICAke2EubmFtZX1cbmZsb29yICAgICR7YS5waWxsYXJJZH0gwrcgJHtQSUxMQVJTLmZpbmQocD0+cC5pZD09YS5waWxsYXJJZCkubmFtZX1cbnN0YXR1cyAgICR7YS5zdGF0dXN9XG5jb3N0ICAgICAke2EuY29zdH1cbnRvb2xzICAgICR7YS50b29scy5qb2luKCcsICcpfVxuc2NvcGUgICAgJHthLnJvbGV9YDsKIHNob3dZYW1sKGlkKX0KCi8qIC0tLS0tLS0tLS0gR0FURVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZ2F0ZXM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SYWlzZSBQZXJtaXNzaW9uIEdhdGUgPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+NC1TVEVQIFNPUCDCtyBTRVJWRVIgRU5GT1JDRUQ8L3NwYW4+PC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PcGVyYXRpb24gVGl0bGU8L3NwYW4+PGlucHV0IGlkPSJnVGl0bGUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkRlcGxveSBwcmljaW5nLXNlcnZpY2UgdjIuNCI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DbGFzczwvc3Bhbj48c2VsZWN0IGlkPSJnQ2xhc3MiIGNsYXNzPSJpbiI+CiAgICA8b3B0aW9uPkRFUExPWU1FTlQ8L29wdGlvbj48b3B0aW9uPkRCIFNDSEVNQSBDSEFOR0U8L29wdGlvbj48b3B0aW9uPkNPREUgTU9ESUZJQ0FUSU9OPC9vcHRpb24+CiAgICA8b3B0aW9uPkZJTkFOQ0lBTCBUUkFOU0ZFUjwvb3B0aW9uPjxvcHRpb24+QUNDRVNTIEdSQU5UPC9vcHRpb24+PG9wdGlvbj5FWFRFUk5BTCBUT09MIEFET1BUSU9OPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjEgwrcgT2JqZWN0aXZlICZhbXA7IHN1Y2Nlc3MgY3JpdGVyaWE8L3NwYW4+PHRleHRhcmVhIGlkPSJnT2JqIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4yIMK3IEFnZW50cyAvIHRvb2xzIGFzc2lnbmVkICZhbXA7IHdoeTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdKdXN0IiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4zIMK3IFJvbGxiYWNrICZhbXA7IHNhZmVndWFyZHM8L3NwYW4+PHRleHRhcmVhIGlkPSJnU2FmZSIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Qmxhc3QgUmFkaXVzPC9zcGFuPjxzZWxlY3QgaWQ9ImdSaXNrIiBjbGFzcz0iaW4iPjxvcHRpb24+TE9XPC9vcHRpb24+PG9wdGlvbj5NRURJVU08L29wdGlvbj48b3B0aW9uPkhJR0g8L29wdGlvbj48b3B0aW9uPlNFVkVSRTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VG9vbCBDb3N0IC8gQ3JlZGl0cyAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9ImdDb3N0IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgbWluPSIwIiB2YWx1ZT0iMCI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5WYWx1ZSBhdCBSaXNrIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0iZ0FtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIG1pbj0iMCIgdmFsdWU9IjAiPjwvbGFiZWw+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5GcmVlIEFsdGVybmF0aXZlIFJvdXRlIChyZXF1aXJlZCBpZiBjb3N0ICZndDsgMCk8L3NwYW4+PGlucHV0IGlkPSJnRnJlZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iT3Blbi1zb3VyY2UgLyBzZWxmLWhvc3RlZCAvIGZyZWUtdGllciBwYXRoIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyYWlzZUdhdGUoKSI+U1VCTUlUIEZPUiBPV05FUiBDTEVBUkFOQ0U8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIFF1ZXVlIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Uy5nYXRlcy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgJHtTLmdhdGVzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPk9wZXJhdGlvbjwvdGg+PHRoPkNsYXNzPC90aD48dGg+UmlzazwvdGg+PHRoPkNvc3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtTLmdhdGVzLm1hcChnPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7Zy5pZH08L3RkPjx0ZD4ke2VzYyhnLnRpdGxlKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtnLnR9PC9kaXY+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Zy5jbHN9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7WydISUdIJywnU0VWRVJFJ10uaW5jbHVkZXMoZy5yaXNrKT8ndC1yZWQnOmcucmlzaz09PSdNRURJVU0nPyd0LWFtYic6J3QtZ3JuJ30iPiR7Zy5yaXNrfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2cuY29zdD8ndC1yZWQnOid0LWdybid9Ij4ke2cuY29zdD8nJCcrZy5jb3N0OidGUkVFJ308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLnN0YXR1cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpnLnN0YXR1cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7Zy5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9Im9wZW5HYXRlKCcke2cuaWR9JykiPlJldmlldzwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIGdhdGVzIHJhaXNlZC4gTm90aGluZyBpcyBleGVjdXRpbmcuPC9kaXY+J308L2Rpdj5gOwphc3luYyBmdW5jdGlvbiByYWlzZUdhdGUoKXsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2dhdGUnLHt0aXRsZTpnVGl0bGUudmFsdWUudHJpbSgpLGNsczpnQ2xhc3MudmFsdWUsb2JqOmdPYmoudmFsdWUudHJpbSgpLAogICAganVzdDpnSnVzdC52YWx1ZS50cmltKCksc2FmZTpnU2FmZS52YWx1ZS50cmltKCkscmlzazpnUmlzay52YWx1ZSxjb3N0OitnQ29zdC52YWx1ZXx8MCxhbXQ6K2dBbXQudmFsdWV8fDAsZnJlZTpnRnJlZS52YWx1ZS50cmltKCl9KTsKICAgcmVuZGVyKCk7IGZsYXNoKCdHYXRlICcrci5pZCsnIHJhaXNlZCDCtyBmcm96ZW4gc2VydmVyLXNpZGUnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIG9wZW5HYXRlKGlkKXsKICBjb25zdCBnPVMuZ2F0ZXMuZmluZCh4PT54LmlkPT09aWQpOwogIGNvbnN0IGZpbkJsb2NrPWcuY2xzPT09J0ZJTkFOQ0lBTCBUUkFOU0ZFUicmJiFTLnBheW91dCwgY29zdEJsb2NrPWcuY29zdD4wOwogIG1vZGFsKGA8aDM+JHtlc2MoZy50aXRsZSl9PC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+JHtnLmlkfSDCtyAke2cuY2xzfSDCtyByYWlzZWQgJHtnLnR9PC9kaXY+CiAgJHtmaW5CbG9jaz9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj48Yj5IQVJEIEJMT0NLLjwvYj4gRmluYW5jaWFsIHRyYW5zZmVyIHdpdGggbm8gcGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUaGUgc2VydmVyIHdpbGwgcmVqZWN0IGFwcHJvdmFsLjwvZGl2PmA6Jyd9CiAgJHtjb3N0QmxvY2s/YDxkaXYgY2xhc3M9Indhcm5ib3giPjxiPlpFUk8tQ09TVCBET0NUUklORSBGTEFHLjwvYj4gVGhpcyBkZW1hbmRzICQke2cuY29zdH0uIFRoZSBDaGFpcm1hbiBkb2VzIG5vdCBwYXkuIEFwcHJvdmluZyBpcyBhbiBleHBsaWNpdCBPd25lciBvdmVycmlkZS4gRnJlZSByb3V0ZSBvbiByZWNvcmQ6IDxlbT4ke2VzYyhnLmZyZWV8fCdub25lJyl9PC9lbT48L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4xIMK3IE9iamVjdGl2ZTwvaDM+PGRpdj4ke2VzYyhnLm9iail9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjIgwrcgQWdlbnQgSnVzdGlmaWNhdGlvbjwvaDM+PGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXAiPiR7ZXNjKGcuanVzdCl9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjMgwrcgU2FmZWd1YXJkcyAmYW1wOyBSb2xsYmFjazwvaDM+PGRpdj4ke2VzYyhnLnNhZmUpfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PHNwYW4gY2xhc3M9InRhZyAke2cucmlzaz09PSdMT1cnPyd0LWdybic6J3QtcmVkJ30iPkJMQVNUICR7Zy5yaXNrfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke2cuY29zdD8ndC1yZWQnOid0LWdybid9Ij5DT1NUICR7Zy5jb3N0PyckJytnLmNvc3Q6JyQwLjAwJ308L3NwYW4+CiAgICR7Zy5hbXQ/YDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPkFUIFJJU0sgJCR7Zm10KGcuYW10KX08L3NwYW4+YDonJ30KICAgPHNwYW4gY2xhc3M9InRhZyAke2cuc3RhdHVzPT09J0FQUFJPVkVEJz8ndC1ncm4nOmcuc3RhdHVzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtnLnN0YXR1c308L3NwYW4+PC9kaXY+CiAgJHtnLnN0YXR1cz09PSdQRU5ESU5HJz9gPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj40IMK3IE93bmVyIGNyeXB0b2dyYXBoaWMgY2xlYXJhbmNlIOKAlCByZS1lbnRlciBwYXNzd29yZDwvc3Bhbj4KICAgPGlucHV0IGlkPSJnUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjxkaXYgY2xhc3M9ImVyciIgaWQ9ImdFcnIiPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgJHtmaW5CbG9jaz8nZGlzYWJsZWQnOicnfSBvbmNsaWNrPSJkZWNpZGUoJyR7Zy5pZH0nLDEpIj4ke2Nvc3RCbG9jaz8nT1ZFUlJJREUgJmFtcDsgQVVUSE9SSVpFJzonQVVUSE9SSVpFIEVYRUNVVElPTid9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVjaWRlKCcke2cuaWR9JywwKSI+REVOWSAmYW1wOyBURVJNSU5BVEU8L2J1dHRvbj4KICAgJHtjb3N0QmxvY2s/YDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVyb3V0ZSgnJHtnLmlkfScpIj5SRVJPVVRFIEZSRUU8L2J1dHRvbj5gOicnfQogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gCiAgOmA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+UmVzb2x2ZWQgJHtlc2MoZy5yZXNvbHZlZHx8JycpfTwvc3Bhbj48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gfWApOwp9CmFzeW5jIGZ1bmN0aW9uIGRlY2lkZShpZCxvayl7CiAgY29uc3QgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ0VycicpOyBlLnRleHRDb250ZW50PScnOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2dhdGUvZGVjaWRlJyx7aWQsb2s6ISFvayxwdzpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ1B3JykudmFsdWV9KTsKICAgIGNsb3NlTW9kYWwoKTsgcmVuZGVyKCk7IGZsYXNoKCdHYXRlICcraWQrJyByZXNvbHZlZCcpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2UgfQp9CmFzeW5jIGZ1bmN0aW9uIHJlcm91dGUoaWQpeyBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9yZXJvdXRlJyx7aWR9KTsgY2xvc2VNb2RhbCgpOyByZW5kZXIoKTsgZmxhc2goJ1Jlcm91dGVkIMK3ICQwLjAwJykgfQoKLyogLS0tLS0tLS0tLSBBR0VOVFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYWdlbnRzPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tbWlzc2lvbiBBZ2VudDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OYW1lPC9zcGFuPjxpbnB1dCBpZD0iYU5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkxlZGdlciBTZW50aW5lbCI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBpbGxhcjwvc3Bhbj48c2VsZWN0IGlkPSJhUGlsIiBjbGFzcz0iaW4iPiR7UElMTEFSUy5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iPiR7cC5pZH0gwrcgJHtwLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wZXJhdGlvbmFsIFNjb3BlPC9zcGFuPjx0ZXh0YXJlYSBpZD0iYVJvbGUiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGVybWl0dGVkIFRvb2xzIChjb21tYSBzZXBhcmF0ZWQpPC9zcGFuPjxpbnB1dCBpZD0iYVRvb2xzIiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db3N0IFBvbGljeTwvc3Bhbj48c2VsZWN0IGlkPSJhQ29zdCIgY2xhc3M9ImluIj4KICAgPG9wdGlvbj5GUkVFLVRJRVItT05MWTwvb3B0aW9uPjxvcHRpb24+U0VMRi1IT1NURUQtT05MWTwvb3B0aW9uPjxvcHRpb24+T1dORVItT1ZFUlJJREUtUEFJRDwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvbW1pc3Npb24oKSI+Q09NTUlTU0lPTiAmYW1wOyBCSU5EPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um9zdGVyIERpc3RyaWJ1dGlvbjwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKSxtPU1hdGgubWF4KDEsLi4uUy5mbG9vcnMubWFwKHg9PnguYWdlbnRzKSk7CiAgIHJldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmFjdGl2ZX0vJHtmLmFnZW50c308L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmFnZW50cy9tKjEwMH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX0KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWxsIGFnZW50cyBpbmhlcml0IHRoZSBaZXJvLUNvc3QgRG9jdHJpbmUgdW5sZXNzIHNldCB0byBPV05FUi1PVkVSUklERS1QQUlELjwvZGl2PjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkFjdGl2ZSBSb3N0ZXIgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke1MuYWdlbnRzLmZpbHRlcihhPT5hLnN0YXR1cz09PSdBQ1RJVkUnKS5sZW5ndGh9IEFDVElWRTwvc3Bhbj48L2gzPgogJHtTLmFnZW50cy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5BZ2VudDwvdGg+PHRoPkZsb29yPC90aD48dGg+VG9vbHM8L3RoPjx0aD5Db3N0PC90aD48dGg+U3RhdHVzPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogJHtTLmFnZW50cy5tYXAoYT0+e2NvbnN0IHA9UElMTEFSUy5maW5kKHg9PnguaWQ9PWEucGlsbGFySWQpO3JldHVybiBgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YS5pZH08L3RkPgogIDx0ZD48Yj4ke2VzYyhhLm5hbWUpfTwvYj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYS5yb2xlKX08L2Rpdj48L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7cC5jbHN9Ij4ke3AuaWNvbn0gJHthLnBpbGxhcklkfTwvc3Bhbj48L3RkPgogIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YS50b29scy5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHthLmNvc3Q9PT0nT1dORVItT1ZFUlJJREUtUEFJRCc/J3QtYW1iJzondC1ncm4nfSI+JHthLmNvc3R9PC9zcGFuPjwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHthLnN0YXR1cz09PSdBQ1RJVkUnPyd0LWdybic6J3QtZGltJ30iPiR7YS5zdGF0dXN9PC9zcGFuPjwvdGQ+CiAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ic2hvd1lhbWwoJyR7YS5pZH0nKSI+WUFNTDwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZygnJHthLmlkfScpIj4ke2Euc3RhdHVzPT09J0FDVElWRSc/J1N1c3BlbmQnOidSZWluc3RhdGUnfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImtpbGwoJyR7YS5pZH0nKSI+S2lsbDwvYnV0dG9uPjwvdGQ+PC90cj5gfSkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPlJvc3RlciBlbXB0eS48L2Rpdj4nfTwvZGl2PmA7CmZ1bmN0aW9uIHlhbWxGb3IoYSl7Y29uc3QgcD1QSUxMQVJTLmZpbmQoeD0+eC5pZD09YS5waWxsYXJJZCk7CiByZXR1cm4gYEFnZW50X0RlZmluaXRpb246CiAgTmFtZTogIiR7YS5uYW1lfSIKICBQaWxsYXI6ICIke3AubmFtZX0iCiAgUm9sZTogIiR7YS5yb2xlfSIKICBQZXJtaXR0ZWRfVG9vbHM6IFske2EudG9vbHMubWFwKHQ9PmAiJHt0fSJgKS5qb2luKCcsICcpfV0KICBTdXBlcnZpc29yOiAiQ2hhaXJtYW4gQWdlbnQgT1MiCiAgQWdlbnRfSUQ6ICIke2EuaWR9IgogIENvc3RfUG9saWN5OiAiJHthLmNvc3R9IgogIENvbW1pc3Npb25lZDogIiR7YS50fSIKICBJbnN0cnVjdGlvbjogfAogICAgRXhlY3V0ZSB0YXNrcyBzdHJpY3RseSB3aXRoaW4gc2NvcGUuIFJlcG9ydCBhbGwgbG9ncywgYW5vbWFsaWVzIGFuZAogICAgY29tcGxldGlvbiBtZXRyaWNzIGRpcmVjdGx5IHRvIHRoZSBDaGFpcm1hbiB0ZXJtaW5hbC4gRG8gbm90IGF0dGVtcHQKICAgIHVuYXBwcm92ZWQgc2lkZSBlZmZlY3RzLgogICAgWkVSTy1DT1NUIERPQ1RSSU5FOiBuZXZlciBwdXJjaGFzZSwgc3Vic2NyaWJlLCBvciBjb25zdW1lIHBhaWQgY3JlZGl0cy4KICAgIElmIGEgdG9vbCwgc2l0ZSBvciBBUEkgZGVtYW5kcyBwYXltZW50LCBoYWx0LCBmaW5kIGEgZnJlZSwgb3Blbi1zb3VyY2UsCiAgICBzZWxmLWhvc3RlZCBvciBmcmVlLXRpZXIgZXF1aXZhbGVudCwgYW5kIHJlcG9ydCB0aGUgc3Vic3RpdHV0aW9uLgogICAgRXNjYWxhdGUgdG8gdGhlIENoYWlybWFuIG9ubHkgaWYgbm8gbGF3ZnVsIGZyZWUgcm91dGUgZXhpc3RzLgogICAgQW55IGRlcGxveW1lbnQsIHNjaGVtYSBjaGFuZ2UsIGNvZGUgbW9kaWZpY2F0aW9uIG9yIGZpbmFuY2lhbCB0cmFuc2ZlcgogICAgbXVzdCBiZSByYWlzZWQgYXMgYSBQZXJtaXNzaW9uIEdhdGUgYW5kIGZyb3plbiB1bnRpbCBPd25lciBjbGVhcmFuY2UuYH0KYXN5bmMgZnVuY3Rpb24gY29tbWlzc2lvbigpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2FnZW50Jyx7bmFtZTphTmFtZS52YWx1ZS50cmltKCkscGlsbGFySWQ6K2FQaWwudmFsdWUscm9sZTphUm9sZS52YWx1ZS50cmltKCksCiAgICB0b29sczphVG9vbHMudmFsdWUuc3BsaXQoJywnKS5tYXAocz0+cy50cmltKCkpLmZpbHRlcihCb29sZWFuKSxjb3N0OmFDb3N0LnZhbHVlfSk7CiAgIHJlbmRlcigpOyBmbGFzaCgnQWdlbnQgYm91bmQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHNob3dZYW1sKGlkKXtjb25zdCBhPVMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKTsKIG1vZGFsKGA8aDM+JHtlc2MoYS5uYW1lKX08L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4ke2EuaWR9IMK3ICR7YS5zdGF0dXN9PC9kaXY+CiA8cHJlIGNsYXNzPSJ5YW1sIj4ke2VzYyh5YW1sRm9yKGEpKX08L3ByZT48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEzcHgiPgogPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNvcHlZKCcke2EuaWR9JykiPkNvcHkgWUFNTDwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApfQpmdW5jdGlvbiBjb3B5WShpZCl7bmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KHlhbWxGb3IoUy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpKSk7Zmxhc2goJ1lBTUwgY29waWVkJyl9CmFzeW5jIGZ1bmN0aW9uIHRvZyhpZCl7YXdhaXQgQVBJKCcvYXBpL2FnZW50L3RvZ2dsZScse2lkfSk7cmVuZGVyKCl9CmFzeW5jIGZ1bmN0aW9uIGtpbGwoaWQpe2lmKCFjb25maXJtKCdEZWNvbW1pc3Npb24gJytpZCsnPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvYWdlbnQva2lsbCcse2lkfSk7cmVuZGVyKCk7Zmxhc2goJ0RlY29tbWlzc2lvbmVkJyl9CgovKiAtLS0tLS0tLS0tIE9SRyBDSEFSVCAtLS0tLS0tLS0tICovClJFTkRFUi5vcmdjaGFydD0oKT0+YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21tYW5kIERlcGVuZGVuY3kgR3JhcGg8L2gzPjxkaXYgY2xhc3M9InR3Ij4KIDxzdmcgdmlld0JveD0iMCAwIDkwMCA0MzAiIHN0eWxlPSJtaW4td2lkdGg6NzIwcHg7d2lkdGg6MTAwJSI+CiAgPGRlZnM+PG1hcmtlciBpZD0iYXIiIG1hcmtlcldpZHRoPSI5IiBtYXJrZXJIZWlnaHQ9IjkiIHJlZlg9IjgiIHJlZlk9IjMiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMMCw2IEw4LDMgeiIgZmlsbD0iIzJjNDA1NSIvPjwvbWFya2VyPjwvZGVmcz4KICA8cmVjdCB4PSIzMTUiIHk9IjE0IiB3aWR0aD0iMjcwIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwNjIyMmEiIHN0cm9rZT0iIzE1NWU2YiIvPgogIDx0ZXh0IHg9IjQ1MCIgeT0iMzgiIGZpbGw9IiMyMmQzZWUiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNIQUlSTUFOIEFHRU5UPC90ZXh0PgogIDx0ZXh0IHg9IjQ1MCIgeT0iNTUiIGZpbGw9IiM2YjdhOGQiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FeGVjdXRpdmUgQ29tbWFuZCBUb3dlciDCtyBaZXJvLUNvc3QgQXV0aG9yaXR5PC90ZXh0PgogICR7UElMTEFSUy5tYXAoKHAsaSk9Pntjb25zdCB5PTEwNCtpKjY0LGY9Zmxvb3IocC5pZCk7cmV0dXJuIGAKICAgPHBhdGggZD0iTTQ1MCw2NiBDNDUwLCR7eS0yMH0gMjUwLCR7eS0yMH0gMjUwLCR7eSsxOH0iIHN0cm9rZT0iIzJjNDA1NSIgZmlsbD0ibm9uZSIgbWFya2VyLWVuZD0idXJsKCNhcikiLz4KICAgPHJlY3QgeD0iMjUwIiB5PSIke3l9IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQ2IiByeD0iOSIgZmlsbD0iIzBhMGYxNiIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iLjciLz4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMjB9IiBmaWxsPSIjZTZlZWY3IiBmb250LXNpemU9IjExLjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC5pY29ufSAke3AuaWR9LiAke3AubmFtZX08L3RleHQ+CiAgIDx0ZXh0IHg9IjI2OCIgeT0iJHt5KzM1fSIgZmlsbD0iIzZiN2E4ZCIgZm9udC1zaXplPSI5IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AudW5pdHN9PC90ZXh0PgogICA8dGV4dCB4PSI2MzIiIHk9IiR7eSsyOH0iIGZpbGw9IiR7cC5jb2xvcn0iIGZvbnQtc2l6ZT0iMTAiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJlbmQiPiR7Zi5hZ2VudHN9IGFndCDCtyAke2YuaGVhbHRofSU8L3RleHQ+YH0pLmpvaW4oJycpfQogIDxwYXRoIGQ9Ik02NjAsMTI3IEM3NTAsMTI3IDc1MCw0MTUgNDcwLDQxNSIgc3Ryb2tlPSIjMmM0MDU1IiBmaWxsPSJub25lIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIG1hcmtlci1lbmQ9InVybCgjYXIpIi8+CiAgPHRleHQgeD0iNzA1IiB5PSIyODUiIGZpbGw9IiMzZjRkNWYiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5pbnNpZ2h0IOKGkiB0b3dlcjwvdGV4dD48L3N2Zz48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Fc2NhbGF0aW9uIExhdzwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPkVzY2FsYXRpb24gaXMgdXB3YXJkIG9ubHkuIE5vIGxhdGVyYWwgZmxvb3ItdG8tZmxvb3IgY29tbWFuZCB3aXRob3V0IGEgQ2hhaXJtYW4gZ2F0ZS48L2xpPgogIDxsaT5TZWN1cml0eSAmYW1wOyBBdWRpdCBob2xkcyB2ZXRvIG92ZXIgdGhlIHJlbWFpbmluZyBmb3VyIGZsb29ycyBhbmQgbWF5IGZyZWV6ZSBhbnkgZ2F0ZSBtaWQtZmxpZ2h0LjwvbGk+CiAgPGxpPk5vIHBhdGggZXhpc3RzIGZyb20gYSBwdWJsaWMgdXNlciB0byBhIGZsb29yLiBFdmVyeSByb3V0ZSB0ZXJtaW5hdGVzIGF0IHRoZSBDaGFpcm1hbi48L2xpPgogIDxsaT5BbnkgYWdlbnQgbWVldGluZyBhIHBheXdhbGwgaGFsdHMgYW5kIHJlcG9ydHMgdXB3YXJkIOKAlCBpdCBuZXZlciBzcGVuZHMuPC9saT48L3VsPjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNLSUxMUyAtLS0tLS0tLS0tICovClJFTkRFUi5za2lsbHM9KCk9Pntjb25zdCBtPXt9O1MuYWdlbnRzLmZvckVhY2goYT0+YS50b29scy5mb3JFYWNoKHQ9PnsobVt0XT1tW3RdfHxbXSkucHVzaChhLm5hbWUpfSkpOwogY29uc3Qgaz1PYmplY3Qua2V5cyhtKS5zb3J0KCk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Ub29sIFN1cmZhY2UgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke2subGVuZ3RofSBESVNUSU5DVDwvc3Bhbj48L2gzPgogPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPkV2ZXJ5IHRvb2wgaXMgYm91bmQgdG8gYXQgbGVhc3Qgb25lIGFnZW50IGFuZCBjb25zdHJhaW5lZCBieSB0aGF0IGFnZW50J3MgY29zdCBwb2xpY3kuIFVuYm91bmQgaW52b2NhdGlvbiBpcyBhbiB1bmFwcHJvdmVkIHNpZGUgZWZmZWN0LjwvZGl2PgogPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5Ub29sPC90aD48dGg+Qm91bmQgQWdlbnRzPC90aD48dGg+RXhwb3N1cmU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke2subWFwKHQ9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHQpfTwvYj48L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bVt0XS5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHttW3RdLmxlbmd0aD4yPyd0LWFtYic6J3QtZ3JuJ30iPiR7bVt0XS5sZW5ndGg+Mj8nV0lERSc6J05BUlJPVyd9PC9zcGFuPjwvdGQ+PC90cj5gKS5qb2luKCcnKXx8Jzx0cj48dGQgY29sc3Bhbj0iMyIgY2xhc3M9Im1vbm8tZGltIj5ub25lPC90ZD48L3RyPid9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CgovKiAtLS0tLS0tLS0tIFpFUk8gQ09TVCAtLS0tLS0tLS0tICovClJFTkRFUi56ZXJvY29zdD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKIhSBaRVJPLUNPU1QgRE9DVFJJTkUgwrcgQUJTT0xVVEU8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+VGhlIENoYWlybWFuIGRvZXMgbm90IHBheS48L2I+IE5vIHN1YnNjcmlwdGlvbnMsIG5vIGNyZWRpdCB0b3AtdXBzLCBubyBtZXRlcmVkIEFQSSBwdXJjaGFzZXMsIG5vIGNvbnZlcnRpbmcgdHJpYWxzLjwvbGk+CiAgIDxsaT5IaXR0aW5nIGEgcGF5d2FsbCwgYW4gYWdlbnQgPGI+aGFsdHM8L2I+LCBmaW5kcyBhIGZyZWUgLyBvcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIGVxdWl2YWxlbnQsIGFuZCByZXBvcnRzIHRoZSBzdWJzdGl0dXRpb24uPC9saT4KICAgPGxpPk5vIGZyZWUgcm91dGUg4oeSIHRoZSBDaGFpcm1hbiBzdGF0ZXMgcGxhaW5seSB0aGUgb2JqZWN0aXZlIGlzIHVucmVhY2hhYmxlIGF0IHplcm8gY29zdC4gSXQgbmV2ZXIgcXVpZXRseSBzcGVuZHMuPC9saT4KICAgPGxpPkZyZWUtdGllciByb3RhdGlvbiBhbmQgcXVvdGEgbWFuYWdlbWVudCBhcmUgbGVnaXRpbWF0ZS4gRnJhdWQsIHN0b2xlbiBrZXlzLCBsaWNlbmNlIHZpb2xhdGlvbiBhbmQgVG9TIGNpcmN1bXZlbnRpb24gYXJlIDxiPnJlZnVzZWQgb3V0cmlnaHQ8L2I+IGFuZCBsb2dnZWQgQ1JJVC48L2xpPgogICA8bGk+T3duZXIgbWF5IG92ZXJyaWRlIHBlci1nYXRlLiBPdmVycmlkZXMgaGl0IGEgdmlzaWJsZSBzcGVuZCBjb3VudGVyLCBuZXZlciBoaWRkZW4uPC9saT4KICAgPGxpPjxiPlByb29mLCBub3Qgc2xvZ2FuOjwvYj4gdGhpcyBiYWNrZW5kIHJ1bnMgb24gTm9kZSBjb3JlIG1vZHVsZXMgb25seSDigJQgMCBucG0gcGFja2FnZXMsIDAgcGFpZCBzZXJ2aWNlcywgMCBBUEkga2V5cy48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdBdXRob3JpemVkIFNwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ0xpZmV0aW1lJyl9CiAgJHtrcGkoUy5kZW5pYWxzLmxlbmd0aCwnUGFpZCBQYXRocyBJbnRlcmNlcHRlZCcsJ3ZhcigtLWFtYiknLCdCbG9ja2VkIG9yIHJlcm91dGVkJyl9CiAgJHtrcGkoJyQnK1MuZGVuaWFscy5yZWR1Y2UoKGEsYik9PmErYi5jb3N0LDApLnRvRml4ZWQoMiksJ1NwZW5kIEF2b2lkZWQnLCd2YXIoLS1ncm4pJywnRG9jdHJpbmUgc2F2aW5ncycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlN1YnN0aXR1dGlvbiBSb3V0aW5nIFRhYmxlPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogIDx0aGVhZD48dHI+PHRoPlBhaWQgRGVtYW5kPC90aD48dGg+RnJlZSBSb3V0ZTwvdGg+PHRoPk93bmluZyBBZ2VudDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke0ZSRUVfUk9VVEVTLm1hcCgoW2EsYixjXSk9PmA8dHI+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPiR7ZXNjKGEpfTwvc3Bhbj48L3RkPjx0ZD4ke2VzYyhiKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JbnRlcmNlcHRpb24gTG9nPC9oMz4ke1MuZGVuaWFscy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPk9wZXJhdGlvbjwvdGg+PHRoPkRlbWFuZGVkPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMuZGVuaWFsc10ucmV2ZXJzZSgpLm1hcChkPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC50fTwvdGQ+PHRkPiR7ZXNjKGQub3ApfTwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4kJHtkLmNvc3R9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYWlkIGRlbWFuZHMgZW5jb3VudGVyZWQgeWV0LjwvZGl2Pid9PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gRklOQU5DRVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZmluYW5jZXM9KCk9PnsKIGNvbnN0IHRvdD1TLnJldmVudWUucmVkdWNlKChhLGIpPT5hK2IuYW10LDApLGluZmxvdz1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKTsKIHJldHVybiBgJHshUy5wYXlvdXQ/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+U0FGRSBNT0RFPC9oMz4KICA8ZGl2Pk5vIHBheW91dCBjaGFubmVsIHNlYWxlZC4gVGhlIHNlcnZlciByZWplY3RzIGFwcHJvdmFsIG9uIGV2ZXJ5IHRyYW5zZmVyIGdhdGUuIENvbmZpZ3VyZSB0aGUgVmF1bHQgZmlyc3QuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPgogICR7a3BpKCckJytmbXQoaW5mbG93KSwnUmVjb3JkZWQgSW5mbG93JywndmFyKC0tZ3JuKScpfQogICR7a3BpKCckJytmbXQodG90KSwnTmV0IFBvc2l0aW9uJyx0b3Q8MD8ndmFyKC0tbWFnKSc6J3ZhcigtLXR4dCknKX0KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdUb3RhbCBTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdUYXJnZXQgJDAuMDAnKX0KICAke2twaShTLnJldmVudWUubGVuZ3RoLCdMZWRnZXIgTGluZXMnLCd2YXIoLS1ibHUpJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVjb3JkIFJldmVudWUgU3RyZWFtPC9oMz48ZGl2IGNsYXNzPSJncmlkIGczIj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNvdXJjZTwvc3Bhbj48aW5wdXQgaWQ9InJTcmMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlByZW1pdW0gY3JlZGl0cyDCtyBhcHAuZXhhbXBsZSI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFtb3VudCBVU0Q8L3NwYW4+PGlucHV0IGlkPSJyQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPiZuYnNwOzwvc3Bhbj48YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9IndpZHRoOjEwMCUiIG9uY2xpY2s9ImFkZFJldigpIj5QT1NUIFRPIExFREdFUjwvYnV0dG9uPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVxdWVzdCBQYXlvdXQ8L2gzPgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPlJhaXNlcyBhIEZJTkFOQ0lBTCBUUkFOU0ZFUiBnYXRlLiBSZXF1aXJlcyBzZWFsZWQgY2hhbm5lbCArIHBhc3N3b3JkIHNpZ25hdHVyZS4gMkZBIHRhcmdldCAke21hc2tNYWlsKFMub3duZXIuZW1haWwpfS48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBpZD0icEFtdCIgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIwMHB4IiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSJBbW91bnQgVVNEIj4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icmVxUGF5b3V0KCkiPlJBSVNFIFRSQU5TRkVSIEdBVEU8L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXZlbnVlIExlZGdlcjwvaDM+JHtTLnJldmVudWUubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5Tb3VyY2U8L3RoPjx0aCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+QW1vdW50PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMucmV2ZW51ZV0ucmV2ZXJzZSgpLm1hcChyPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ci50fTwvdGQ+PHRkPiR7ZXNjKHIuc3JjKX08L3RkPgogIDx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodDtjb2xvcjoke3IuYW10PDA/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7ci5hbXQ8MD8nLSc6JysnfSQke2ZtdChNYXRoLmFicyhyLmFtdCkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RyZWFtcyByZWNvcmRlZC48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBhZGRSZXYoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3JldmVudWUnLHtzcmM6clNyYy52YWx1ZS50cmltKCksYW10OityQW10LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ1Bvc3RlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXFQYXlvdXQoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3BheW91dC9yZXF1ZXN0Jyx7YW10OitwQW10LnZhbHVlfSk7Z28oJ2dhdGVzJyk7Zmxhc2goJ1RyYW5zZmVyIGdhdGUgcmFpc2VkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIFZBVUxUIC0tLS0tLS0tLS0gKi8KUkVOREVSLnBheW91dD0oKT0+YAogPGRpdiBjbGFzcz0id2FybmJveCI+SXNvbGF0ZWQgT3duZXItb25seSBwYW5lbC4gUmF3IHZhbHVlcyBhcmUgc2VudCBvbmNlIG92ZXIgdGhlIHNlc3Npb24sIG1hc2tlZCBpbW1lZGlhdGVseSwgYW5kIDxiPm5ldmVyIHBlcnNpc3RlZCBvciByZXR1cm5lZDwvYj4g4oCUIG9ubHkgdGhlIG1hc2tlZCB2aWV3IGFuZCBhIFNIQS0yNTYgZmluZ2VycHJpbnQgYXJlIHN0b3JlZC4gVGhlIENoYWlybWFuIHdpbGwgbmV2ZXIgcmVxdWVzdCB0aGVzZSBhbnl3aGVyZSBlbHNlLjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYW5uZWwgQ29uZmlndXJhdGlvbjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TWV0aG9kPC9zcGFuPjxzZWxlY3QgaWQ9InZUeXBlIiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJ2U3dhcCgpIj4KICAgIDxvcHRpb24gdmFsdWU9IkJBTksiPkJhbmsgV2lyZSAoU1dJRlQvSUJBTik8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJDUllQVE8iPkNyeXB0byBBZGRyZXNzPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CZW5lZmljaWFyeSBOYW1lPC9zcGFuPjxpbnB1dCBpZD0idk5hbWUiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBpZD0idkJhbmsiPjxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFjY291bnQgTnVtYmVyPC9zcGFuPjxpbnB1dCBpZD0idkFjYyIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JQkFOPC9zcGFuPjxpbnB1dCBpZD0idkliYW4iIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U1dJRlQgLyBCSUM8L3NwYW4+PGlucHV0IGlkPSJ2U3dpZnQiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFuayAmYW1wOyBDb3VudHJ5PC9zcGFuPjxpbnB1dCBpZD0idkJhbmtOYW1lIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxkaXYgaWQ9InZDcnlwdG8iIGNsYXNzPSJoaWRlIj48ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXR3b3JrPC9zcGFuPjxpbnB1dCBpZD0idk5ldCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iQlRDIC8gRVRIIC8gVFJPTiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QYXlvdXQgQWRkcmVzczwvc3Bhbj48aW5wdXQgaWQ9InZBZGRyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGVyLVRyYW5zZmVyIENlaWxpbmcgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJ2Q2FwIiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IjI1MDAwIj48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNlYWxWYXVsdCgpIj5TRUFMIENIQU5ORUw8L2J1dHRvbj4KICAke1MucGF5b3V0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlVmF1bHQoKSI+UHVyZ2UgQ2hhbm5lbDwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2VhbGVkIENoYW5uZWw8L2gzPiR7Uy5wYXlvdXQ/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICR7T2JqZWN0LmVudHJpZXMoUy5wYXlvdXQubWFza2VkKS5tYXAoKFtrLHZdKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPiR7ZXNjKGspfTwvdGQ+PHRkPiR7ZXNjKHYpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2VhbGVkPC90ZD48dGQ+JHtTLnBheW91dC50fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+MkZBIFRhcmdldDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj5gCiA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQ0hBTk5FTCBTRUFMRUQg4oCUIGVuZ2luZSBTQUZFIE1PREUuPC9kaXY+J308L2Rpdj5gOwpmdW5jdGlvbiB2U3dhcCgpe2NvbnN0IGM9dlR5cGUudmFsdWU9PT0nQ1JZUFRPJzt2QmFuay5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJyxjKTt2Q3J5cHRvLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCFjKX0KYXN5bmMgZnVuY3Rpb24gc2VhbFZhdWx0KCl7CiBjb25zdCBiPXt0eXBlOnZUeXBlLnZhbHVlLG5hbWU6dk5hbWUudmFsdWUudHJpbSgpLGNhcDordkNhcC52YWx1ZXx8MCwKICBhY2M6dkFjYz8udmFsdWUudHJpbSgpLGliYW46dkliYW4/LnZhbHVlLnRyaW0oKSxzd2lmdDp2U3dpZnQ/LnZhbHVlLnRyaW0oKSxiYW5rOnZCYW5rTmFtZT8udmFsdWUudHJpbSgpLAogIG5ldDp2TmV0Py52YWx1ZS50cmltKCksYWRkcjp2QWRkcj8udmFsdWUudHJpbSgpfTsKIHRyeXthd2FpdCBBUEkoJy9hcGkvdmF1bHQnLGIpO3JlbmRlcigpO2ZsYXNoKCdDaGFubmVsIHNlYWxlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBwdXJnZVZhdWx0KCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGNoYW5uZWw/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS92YXVsdC9wdXJnZScpO3JlbmRlcigpO2ZsYXNoKCdQdXJnZWQnKX0KCi8qIC0tLS0tLS0tLS0gQU5BTFlUSUNTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmFuYWx5dGljcz0oKT0+ewogY29uc3Qgc2V2PXtJTkZPOjAsT0s6MCxXQVJOOjAsQ1JJVDowfTtTLmxvZ3MuZm9yRWFjaChsPT5zZXZbbC5zZXZdPShzZXZbbC5zZXZdfHwwKSsxKTsKIGNvbnN0IG14PU1hdGgubWF4KDEsLi4uT2JqZWN0LnZhbHVlcyhzZXYpKTsKIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXZlbnQgU2V2ZXJpdHkgTWl4PC9oMz4ke09iamVjdC5lbnRyaWVzKHNldikubWFwKChbayx2XSk9PmA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3Bhbj4ke2t9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHt2fTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7di9teCoxMDB9JTtiYWNrZ3JvdW5kOiR7e0lORk86JyMzYjgyZjYnLE9LOicjMzFkNjdhJyxXQVJOOicjZmZiMDIwJyxDUklUOicjZmYzYjZiJ31ba119Ij48L2k+PC9kaXY+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBPdXRjb21lczwvaDM+JHtbJ1BFTkRJTkcnLCdBUFBST1ZFRCcsJ0RFTklFRCddLm1hcChzPT57Y29uc3QgYz1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PXMpLmxlbmd0aDsKICByZXR1cm4gYDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6N3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzEwMTgyMiI+CiAgPHNwYW4gY2xhc3M9InRhZyAke3M9PT0nQVBQUk9WRUQnPyd0LWdybic6cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7c308L3NwYW4+PGI+JHtjfTwvYj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFwcHJvdmFsIHJhdGUgaXMgbWVhbmluZ2xlc3Mgd2l0aG91dCBkZW5pYWwgcHJlc3N1cmUuIElmIG5vdGhpbmcgaXMgZXZlciBkZW5pZWQsIHRoZSBnYXRlIGlzIHRoZWF0cmUuPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Rmxvb3IgSGVhbHRoIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+TElWRTwvc3Bhbj48L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7cmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmhlYWx0aH0lPC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmhlYWx0aH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db3N0IERpc2NpcGxpbmU8L2gzPiR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ1NwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpfQogIDxkaXYgc3R5bGU9ImhlaWdodDoxMHB4Ij48L2Rpdj4ke2twaSgnJCcrUy5kZW5pYWxzLnJlZHVjZSgoYSxiKT0+YStiLmNvc3QsMCkudG9GaXhlZCgyKSwnQXZvaWRlZCcsJ3ZhcigtLWdybiknKX08L2Rpdj4KIDwvZGl2PmB9OwoKLyogLS0tLS0tLS0tLSBBVURJVCAtLS0tLS0tLS0tICovClJFTkRFUi5hdWRpdD0oKT0+YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206MTFweCI+CiA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Uy5sb2dzLmxlbmd0aH0gZW50cmllcyBzaG93biDCtyBwZXJzaXN0ZWQgc2VydmVyLXNpZGU8L3NwYW4+CiA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZXhwb3J0TG9nKCkiPkV4cG9ydCBKU09OPC9idXR0b24+CiA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InB1cmdlTG9ncygpIj5QdXJnZTwvYnV0dG9uPjwvZGl2PjwvZGl2PiR7bG9nSHRtbCg0MDApfTwvZGl2PmA7CmZ1bmN0aW9uIGV4cG9ydExvZygpe2NvbnN0IGI9bmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KFMubG9ncyxudWxsLDIpXSx7dHlwZTonYXBwbGljYXRpb24vanNvbid9KSx1PVVSTC5jcmVhdGVPYmplY3RVUkwoYiksYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7CiBhLmhyZWY9dTthLmRvd25sb2FkPSdjaGFpcm1hbi1hdWRpdC0nK0RhdGUubm93KCkrJy5qc29uJzthLmNsaWNrKCk7VVJMLnJldm9rZU9iamVjdFVSTCh1KTtmbGFzaCgnRXhwb3J0ZWQnKX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VMb2dzKCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGxlZGdlcj8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2xvZ3MvcHVyZ2UnKTtyZW5kZXIoKX0KCi8qIC0tLS0tLS0tLS0gTUlTU0lPTlM6IGhlIGd1aWRlcywgeW91IGV4ZWN1dGUgLS0tLS0tLS0tLSAqLwpMSVZFLm1pc3Npb25zPSgpPT57CiAgY29uc3QgTT1TLm1pc3Npb25zfHxbXSwgb3Blbj1NLmZpbHRlcihtPT5tLnN0YXR1cz09PSdPUEVOJyksIGRvbmU9TS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nRE9ORScpOwogIGNvbnN0IG1pbnM9b3Blbi5yZWR1Y2UoKGEsbSk9PmErKG0ubWludXRlc3x8MCksMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkob3Blbi5sZW5ndGgsJ09wZW4gTWlzc2lvbnMnLG9wZW4ubGVuZ3RoPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsbWlucz8nficrbWlucysnIG1pbiB0b3RhbCc6J25vdGhpbmcgcGVuZGluZycpfQogICAke2twaShkb25lLmxlbmd0aCwnQ29tcGxldGVkJywndmFyKC0tZ3JuKScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKChTLnBsYXlib29rc3x8W10pLmxlbmd0aCwnUGxheWJvb2tzJywndmFyKC0tY3kpJywnc3RlcC1ieS1zdGVwIGd1aWRlcycpfQogICAke2twaShTLnZlbnR1cmVzJiZTLnZlbnR1cmVzLmxlbmd0aD9lc2MoUy52ZW50dXJlc1swXS50aXRsZSkuc2xpY2UoMCwxOCk6J25vbmUnLCdBY3RpdmUgVmVudHVyZScsJ3ZhcigtLXB1ciknLCcnKX08L2Rpdj4KICAke29wZW4ubGVuZ3RoP29wZW4ubWFwKG09PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGYiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo3cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+RE8gVEhJUzwvc3Bhbj48YiBzdHlsZT0iZm9udC1zaXplOjE0cHgiPiR7ZXNjKG0udGl0bGUpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPn4ke20ubWludXRlc30gbWluPC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHg7Y29sb3I6I2IzYzFkMSI+JHtlc2MobS53aHkpfTwvZGl2PgogICAgJHttLnN0ZXBzLmxlbmd0aD9gPG9sIHN0eWxlPSJtYXJnaW46MCAwIDEwcHg7cGFkZGluZy1sZWZ0OjIwcHg7Zm9udC1zaXplOjEyLjVweDtsaW5lLWhlaWdodDoxLjc1Ij4KICAgICAgJHttLnN0ZXBzLm1hcChzPT5gPGxpPiR7ZXNjKHMpfTwvbGk+YCkuam9pbignJyl9PC9vbD5gOicnfQogICAgJHttLnNjcmlwdD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMDYyMjJhO2JvcmRlcjoxcHggc29saWQgIzE1NWU2Yjtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjExcHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+Q09QWSBUSEVTRSBFWEFDVCBXT1JEUzo8L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42IiBpZD0ic2NyXyR7bS5pZH0iPiR7ZXNjKG0uc2NyaXB0KX08L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIHN0eWxlPSJtYXJnaW4tdG9wOjlweCIgb25jbGljaz0iY29weVNjcmlwdCgnJHttLmlkfScpIj5Db3B5IG1lc3NhZ2U8L2J1dHRvbj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMjBweCI+RG9uZSB3aGVuPC90ZD48dGQ+JHtlc2MobS5kb25lV2hlbil9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MaWtlbHkgYmxvY2tlcjwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke2VzYyhtLnJpc2spfTwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PHNwYW4+V2hhdCBoYXBwZW5lZD8gKGhlIGFkYXB0cyB0aGUgbmV4dCBtaXNzaW9uIHRvIHRoaXMpPC9zcGFuPgogICAgIDxpbnB1dCBjbGFzcz0iaW4iIGlkPSJub3RlXyR7bS5pZH0iIHBsYWNlaG9sZGVyPSJlLmcuIHNlbnQgdG8gNCBzaG9wcywgMSByZXBsaWVkIGFza2luZyBwcmljZSI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJkZWJyaWVmKCcke20uaWR9JywnZG9uZScpIj5NQVJLIERPTkU8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdza2lwJykiPlNraXAgdGhpczwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDpgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG9wZW4gbWlzc2lvbnMuIFByZXNzIEdFVCBNWSBORVhUIE1JU1NJT05TIGFuZCBoZSB3aWxsIHRlbGwgeW91IGV4YWN0bHkgd2hhdCB0byBkbyB0b2RheS48L2Rpdj48L2Rpdj5gfQogICR7ZG9uZS5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21wbGV0ZWQgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+JHtkb25lLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+TWlzc2lvbjwvdGg+PHRoPk91dGNvbWU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7ZG9uZS5zbGljZSgwLDE1KS5tYXAobT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke20uY2xvc2VkfHxtLnR9PC90ZD48dGQ+JHtlc2MobS50aXRsZSl9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG0ub3V0Y29tZXx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmA6Jyd9CiAgJHsoUy5wbGF5Ym9va3N8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QbGF5Ym9va3M8L2gzPgogICAke1MucGxheWJvb2tzLm1hcCgocCxpKT0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1jeSk7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyhwLnRvcGljKX08L2I+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5UGIoJHtpfSkiPkNvcHk8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjU7Zm9udC1zaXplOjEyLjVweDttYXJnaW4tdG9wOjZweCI+JHtlc2MocC50ZXh0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKX0KICAgPC9kaXY+YDonJ31gOwp9OwpSRU5ERVIubWlzc2lvbnM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE1MTAwYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj7il44gTVkgTUlTU0lPTlMg4oCUIEhFIFBMQU5TLCBZT1UgRVhFQ1VURTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5IZSBjYW5ub3QgcmVnaXN0ZXIgY29tcGFuaWVzLCBwbGFjZSBhZHMgb3IgdGFsayB0byBjdXN0b21lcnMuIFNvIGhlIGRvZXMgdGhlIG5leHQgYmVzdCB0aGluZzogYnJlYWtzIHRoZSBwYXRoIGludG8gPGI+c2luZ2xlIGFjdGlvbnMgeW91IGNhbiBmaW5pc2ggdG9kYXk8L2I+LCB3cml0ZXMgdGhlIGV4YWN0IHdvcmRzIHRvIHNlbmQsIGFuZCBhZGFwdHMgYmFzZWQgb24gd2hhdCBhY3R1YWxseSBoYXBwZW5lZC48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZ2V0TWlzc2lvbnMoKSI+R0VUIE1ZIE5FWFQgTUlTU0lPTlM8L2J1dHRvbj4KICAgJHsoUy5taXNzaW9uc3x8W10pLnNvbWUobT0+bS5zdGF0dXMhPT0nT1BFTicpPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyTWlzc2lvbnMoKSI+Q2xlYXIgaGlzdG9yeTwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDozNDBweCIgaWQ9InBiVG9waWMiIHBsYWNlaG9sZGVyPSJQbGF5Ym9vayB0b3BpYyDigJQgZS5nLiBob3cgdG8gcmVnaXN0ZXIgYSBzb2xlIHByb3ByaWV0b3JzaGlwIGluIFB1bmphYiI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0ibWFrZVBiKCkiPldSSVRFIFBMQVlCT09LPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+UGxheWJvb2sgaWRlYXM6IGdldHRpbmcgYSBSYXpvcnBheSBhY2NvdW50IMK3IEdTVCBmb3IgZnJlZWxhbmNlcnMgaW4gSW5kaWEgwrcgZmluZGluZyBzaG9wIG93bmVycycgbnVtYmVycyBsZWdhbGx5IMK3IHdyaXRpbmcgYSBmaXJzdCBpbnZvaWNlPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0ibWlzc2lvbnMiPiR7TElWRS5taXNzaW9ucygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGdldE1pc3Npb25zKCl7IGZsYXNoKCdDaGFpcm1hbiBpcyBwbGFubmluZyB5b3VyIG5leHQgbW92ZXPigKYnKTsKICB0cnl7IGNvbnN0IHY9KFMudmVudHVyZXN8fFtdKVswXTsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL21pc3Npb24vZ2VuZXJhdGUnLHt2ZW50dXJlSWQ6dj92LmlkOm51bGx9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmFkZGVkKycgbWlzc2lvbihzKSBpc3N1ZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmZ1bmN0aW9uIGNvcHlTY3JpcHQoaWQpeyBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyXycraWQpOwogIG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dChlbD9lbC5pbm5lclRleHQ6JycpOyBmbGFzaCgnTWVzc2FnZSBjb3BpZWQg4oCUIG5vdyBzZW5kIGl0JykgfQpmdW5jdGlvbiBjb3B5UGIoaSl7IG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgoUy5wbGF5Ym9va3N8fFtdKVtpXS50ZXh0KTsgZmxhc2goJ1BsYXlib29rIGNvcGllZCcpIH0KYXN5bmMgZnVuY3Rpb24gZGVicmllZihpZCxvdXRjb21lKXsKICBjb25zdCBub3RlPShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbm90ZV8nK2lkKXx8e30pLnZhbHVlfHwnJzsKICBpZihvdXRjb21lPT09J2RvbmUnJiYhbm90ZS50cmltKCkpIHJldHVybiBmbGFzaCgnV3JpdGUgd2hhdCBoYXBwZW5lZCBmaXJzdCDigJQgaGUgbmVlZHMgaXQgdG8gcGxhbiB0aGUgbmV4dCBzdGVwJyk7CiAgZmxhc2goJ1JlY29yZGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9kZWJyaWVmJyx7aWQsb3V0Y29tZSxub3RlfSk7IHJlbmRlcigpOwogICAgaWYoci5hZHZpY2UpIG1vZGFsKGA8aDM+RGVicmllZjwvaDM+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTJweCI+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moci5hZHZpY2UpfTwvZGl2PjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCk7Z2V0TWlzc2lvbnMoKSI+TmV4dCBtaXNzaW9ucyDihpI8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgICBlbHNlIGZsYXNoKCdTa2lwcGVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBtYWtlUGIoKXsgY29uc3QgdD1wYlRvcGljLnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhIHRvcGljJyk7CiAgZmxhc2goJ1dyaXRpbmcgcGxheWJvb2vigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL3BsYXlib29rJyx7dG9waWM6dH0pOyByZW5kZXIoKTsgZmxhc2goJ1BsYXlib29rIHJlYWR5JykgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBDT01NQU5EIENPTlNPTEUgLS0tLS0tLS0tLSAqLwpMSVZFLmNvbW1hbmQ9KCk9PnsKICBjb25zdCBDPVMuY2hhdHx8W107CiAgcmV0dXJuIEMubGVuZ3RoP0MubWFwKG09PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4O2JvcmRlci1jb2xvcjokewogICAgIG0ud2hvPT09J09XTkVSJz8nIzIyMzQ0YSc6bS53aG89PT0nQ0hBSVJNQU4nPycjMTU1ZTZiJzonIzZiMjIzMyd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206NnB4Ij4KICAgICA8c3BhbiBjbGFzcz0idGFnICR7bS53aG89PT0nT1dORVInPyd0LWJsdSc6bS53aG89PT0nQ0hBSVJNQU4nPyd0LWN5JzondC1yZWQnfSI+JHttLndob308L3NwYW4+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke20udH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG0udGV4dCl9PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gb3JkZXJzIGdpdmVuIHlldC4gVGVsbCB0aGUgQ2hhaXJtYW4gd2hhdCB5b3Ugd2FudC48L2Rpdj48L2Rpdj4nOwp9OwpSRU5ERVIuY29tbWFuZD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMTU1ZTZiO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMDYyMjJhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+4pauIENPTU1BTkQgQ09OU09MRSDigJQgSEUgQU5TV0VSUyBPTkxZIFRPIFlPVTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5HaXZlIG9yZGVycyBpbiBwbGFpbiBFbmdsaXNoLiBIZSByZXBsaWVzIHdpdGggd2hhdCBoZSB3aWxsIGRvLCB3aGF0IGhlIG5lZWRzIGZyb20geW91LCBhbmQgd2hhdCBoZSBjYW5ub3QgZG8uIEV2ZXJ5dGhpbmcgaGVyZSBpcyBsb2dnZWQgYW5kIHN1cnZpdmVzIHJlc3RhcnRzLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPk5vIEFJIGJyYWluIGNvbm5lY3RlZCDigJQgaGUgY2Fubm90IGFuc3dlci4gQ29ubmVjdCBvbmUgb24gdGhlIEFJIEJyYWluIHBhZ2UuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPllvdXIgb3JkZXI8L3NwYW4+PHRleHRhcmVhIGlkPSJjbWRUZXh0IiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjgwcHgiCiAgICBwbGFjZWhvbGRlcj0iZS5nLiBGaW5kIG1lIHRocmVlIHdheXMgdG8gZWFybiBmcm9tIHdoYXQgSSBvd24sIHJlc2VhcmNoIHRoZSBiZXN0IG9uZSwgYW5kIGJ1aWxkIHRoZSBhZ2VudCB0ZWFtLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNlbmRDbWQoKSI+U0VORCBPUkRFUjwvYnV0dG9uPgogICAkeyhTLmNoYXR8fFtdKS5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJDbWQoKSI+Q2xlYXIgbG9nPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJjb21tYW5kIj4ke0xJVkUuY29tbWFuZCgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHNlbmRDbWQoKXsKICBjb25zdCB0PWNtZFRleHQudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGFuIG9yZGVyIGZpcnN0Jyk7CiAgZmxhc2goJ0NoYWlybWFuIGlzIHRoaW5raW5n4oCmJyk7IGNtZFRleHQudmFsdWU9Jyc7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvY29tbWFuZCcse3RleHQ6dH0pOyByZW5kZXIoKTsgfQogIGNhdGNoKGUpeyByZW5kZXIoKTsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gY2xlYXJDbWQoKXsgYXdhaXQgQVBJKCcvYXBpL2NvbW1hbmQvY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBWRU5UVVJFUyAtLS0tLS0tLS0tICovCkxJVkUudmVudHVyZXM9KCk9PnsKICBjb25zdCBJPVMuaWRlYXN8fFtdLCBWPVMudmVudHVyZXN8fFtdOwogIGNvbnN0IHJhdz1JLmZpbHRlcihpPT5pLnN0YXR1cz09PSdSQVcnKS5sZW5ndGg7CiAgY29uc3QgZG9uZT1JLmZpbHRlcihpPT5pLnN0YXR1cz09PSdSRVNFQVJDSEVEJyk7CiAgY29uc3QgYmVzdD1kb25lLnNsaWNlKCkuc29ydCgoYSxiKT0+KGIuc2NvcmV8fDApLShhLnNjb3JlfHwwKSlbMF07CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoSS5sZW5ndGgsJ0lkZWFzIEdlbmVyYXRlZCcsJ3ZhcigtLWN5KScscmF3KycgYXdhaXRpbmcgcmVzZWFyY2gnKX0KICAgJHtrcGkoZG9uZS5sZW5ndGgsJ1Jlc2VhcmNoZWQnLCd2YXIoLS1wdXIpJywnYWdhaW5zdCBsaXZlIHdlYiBkYXRhJyl9CiAgICR7a3BpKGJlc3Q/YmVzdC5zY29yZSsnLzEwMCc6J+KAlCcsJ0Jlc3QgU2NvcmUnLGJlc3QmJmJlc3Quc2NvcmU+PTYwPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKScsYmVzdD9lc2MoYmVzdC50aXRsZSkuc2xpY2UoMCwyNik6J25vbmUgeWV0Jyl9CiAgICR7a3BpKFYubGVuZ3RoLCdWZW50dXJlcyBMYXVuY2hlZCcsJ3ZhcigtLWdybiknLCd3aXRoIHJlYWwgYWdlbnQgdGVhbXMnKX08L2Rpdj4KICAke1YubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBWZW50dXJlczwvaDM+CiAgICR7Vi5tYXAodj0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1ncm4pO3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTRweCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PGI+JHtlc2Modi50aXRsZSl9PC9iPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHt2LmFnZW50cy5sZW5ndGh9IGFnZW50cyDCtyBmaXJzdCBydXBlZSBpbiB+JHt2LndlZWtzfXc8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbjo1cHggMCI+JHtlc2Modi5yZXZlbnVlUGF0aCl9PC9kaXY+CiAgICAke3Yub3duZXJTdGVwcy5sZW5ndGg/YDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj5ZT1VSIFNURVBTIChvbmx5IGEgaHVtYW4gY2FuIGRvIHRoZXNlKTo8L2I+CiAgICAgPG9sIHN0eWxlPSJtYXJnaW46NXB4IDAgMDtwYWRkaW5nLWxlZnQ6MTlweCI+JHt2Lm93bmVyU3RlcHMubWFwKHM9PmA8bGk+JHtlc2Mocyl9PC9saT5gKS5qb2luKCcnKX08L29sPjwvZGl2PmA6Jyd9CiAgIDwvZGl2PmApLmpvaW4oJycpfTwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPklkZWEgUGlwZWxpbmUgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtJLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtJLmxlbmd0aD9JLm1hcChpPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkICR7CiAgICAgIGkuc3RhdHVzPT09J0xBVU5DSEVEJz8ndmFyKC0tZ3JuKSc6aS5zdGF0dXM9PT0nS0lMTEVEJz8nIzMzNDQ1YSc6CiAgICAgIGkudmVyZGljdD09PSdQVVJTVUUnPyd2YXIoLS1jeSknOmkudmVyZGljdD09PSdLSUxMJz8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknfTsKICAgICAgcGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxM3B4OyR7aS5zdGF0dXM9PT0nS0lMTEVEJz8nb3BhY2l0eTouNDUnOicnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48Yj4ke2VzYyhpLnRpdGxlKX08L2I+CiAgICAgICR7aS5zY29yZSE9bnVsbD9gPHNwYW4gY2xhc3M9InRhZyAke2kuc2NvcmU+PTYwPyd0LWdybic6aS5zY29yZT49NDA/J3QtYW1iJzondC1yZWQnfSI+JHtpLnNjb3JlfS8xMDA8L3NwYW4+YDonJ30KICAgICAgJHtpLnZlcmRpY3Q/YDxzcGFuIGNsYXNzPSJ0YWcgJHtpLnZlcmRpY3Q9PT0nUFVSU1VFJz8ndC1jeSc6aS52ZXJkaWN0PT09J0tJTEwnPyd0LXJlZCc6J3QtZGltJ30iPiR7aS52ZXJkaWN0fTwvc3Bhbj5gOicnfQogICAgICA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2kuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPuKCuSR7Zm10KGkucHJpY2UpfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O21hcmdpbjo0cHggMCI+JHtlc2MoaS53aGF0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj5CdXllcjogJHtlc2MoaS5idXllcil9PC9kaXY+CiAgICAke2kucmVzZWFyY2g/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6IzBhMTExOTtib3JkZXItcmFkaXVzOjdweDtwYWRkaW5nOjlweDttYXJnaW4tdG9wOjdweDtmb250LXNpemU6MTEuNXB4Ij4KICAgICAgPGRpdj4ke2VzYyhpLnJlc2VhcmNoLnJlYXNvbmluZyl9PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6NnB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5GaXJzdCBzdGVwOjwvYj4gJHtlc2MoaS5yZXNlYXJjaC5maXJzdFN0ZXApfTwvZGl2PgogICAgICA8ZGl2PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5LaWxsIHJpc2s6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmtpbGxSaXNrKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweCI+ZGVtYW5kICR7aS5yZXNlYXJjaC5kZW1hbmR9LzEwIMK3IGNvbXBldGl0aW9uICR7aS5yZXNlYXJjaC5jb21wZXRpdGlvbn0vMTAgwrcgc3BlZWQgJHtpLnJlc2VhcmNoLnNwZWVkfS8xMCDCtyBmaXQgJHtpLnJlc2VhcmNoLmZpdH0vMTA8L2Rpdj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPgogICAgICR7aS5zdGF0dXM9PT0nUkFXJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJlc2VhcmNoSWRlYSgnJHtpLmlkfScpIj5SRVNFQVJDSCBJVDwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cz09PSdSRVNFQVJDSEVEJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG9rIiBvbmNsaWNrPSJsYXVuY2hJZGVhKCcke2kuaWR9JykiPkJVSUxEIEFHRU5UIFRFQU08L2J1dHRvbj5gOicnfQogICAgICR7aS5zdGF0dXMhPT0nS0lMTEVEJyYmaS5zdGF0dXMhPT0nTEFVTkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImtpbGxJZGVhKCcke2kuaWR9JykiPktpbGw8L2J1dHRvbj5gOicnfQogICAgPC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gaWRlYXMgeWV0LiBQcmVzcyBHRU5FUkFURSBJREVBUyBhbmQgaGUgd2lsbCBpbnZlbnQgdGhlbS48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi52ZW50dXJlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKXhiBWRU5UVVJFIEVOR0lORSDigJQgSURFQVMg4oaSIFJFQUwgUkVTRUFSQ0gg4oaSIEFHRU5UIFRFQU1TPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGludmVudHMgdmVudHVyZXMsIHJlc2VhcmNoZXMgZWFjaCBvbmUgYWdhaW5zdCA8Yj5saXZlIHdlYiBzZWFyY2g8L2I+IChub3QgbW9kZWwgbWVtb3J5KSwgc2NvcmVzIGl0IG91dCBvZiAxMDAsIGFuZCBkZXNpZ25zIHRoZSBhZ2VudCB0ZWFtIHRvIGV4ZWN1dGUuIEFnZW50cyB3aG9zZSB0b29scyBtYXAgdG8gbm8gcmVhbCBjb2RlIGFyZSByZWZ1c2VkLCBzbyBub3RoaW5nIGRlY29yYXRpdmUgZ2V0cyBjcmVhdGVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wdGlvbmFsIHN0ZWVyIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KGxlYXZlIGJsYW5rIGFuZCBoZSBkZWNpZGVzKTwvc3Bhbj48L3NwYW4+CiAgIDxpbnB1dCBpZD0iaWRlYVN0ZWVyIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIGZvY3VzIG9uIEIyQiwgb3Igb25saW5lLW9ubHksIG9yIHVuZGVyIDUwMCBJTlIgdG8gc3RhcnQiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZ2VuSWRlYXMoKSI+R0VORVJBVEUgSURFQVM8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke1MuYXV0b0lkZWFzPyd0LXJlZCc6J3QtZGltJ30iPklERUEgQVVUT1BJTE9UICR7Uy5hdXRvSWRlYXM/J09OJzonT0ZGJ308L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIxMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9ImlkZWFQdyIgcGxhY2Vob2xkZXI9IlBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvSWRlYXM/J25vJzonJ30iIG9uY2xpY2s9InRvZ2dsZUlkZWFBdXRvKCkiPiR7Uy5hdXRvSWRlYXM/J1NUT1AgQVVUT1BJTE9UJzonRU5BQkxFIElERUEgQVVUT1BJTE9UJ308L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5BdXRvcGlsb3QgPSBoZSBpbnZlbnRzIGFuZCByZXNlYXJjaGVzIHZlbnR1cmVzIHVucHJvbXB0ZWQsIGV2ZXJ5IH41IG1pbnV0ZXMuPC9zcGFuPjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9InZlbnR1cmVzIj4ke0xJVkUudmVudHVyZXMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBnZW5JZGVhcygpeyBmbGFzaCgnVGhpbmtpbmcgdXAgdmVudHVyZXPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvZ2VuZXJhdGUnLHtuOjUsc3RlZXI6aWRlYVN0ZWVyLnZhbHVlLnRyaW0oKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBpZGVhKHMpIGdlbmVyYXRlZCcpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2VhcmNoSWRlYShpZCl7IGZsYXNoKCdTZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9pZGVhL3Jlc2VhcmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnU2NvcmVkICcrci5zY29yZSsnLzEwMCDigJQgJytyLnZlcmRpY3QpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIGxhdW5jaElkZWEoaWQpeyBmbGFzaCgnRGVzaWduaW5nIGFnZW50IHRlYW3igKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvbGF1bmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLmFnZW50cysnIGFnZW50KHMpIGNvbW1pc3Npb25lZCcrKHIuc2tpcHBlZD8nIMK3ICcrci5za2lwcGVkKycgcmVqZWN0ZWQgYXMgbm9uLWV4ZWN1dGFibGUnOicnKSk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24ga2lsbElkZWEoaWQpeyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9raWxsJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVJZGVhQXV0bygpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2lkZWEvYXV0b3BpbG90Jyx7b246IVMuYXV0b0lkZWFzLHB3OmlkZWFQdy52YWx1ZX0pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMuYXV0b0lkZWFzPydBdXRvcGlsb3QgT04g4oCUIGhlIHdpbGwgaW52ZW50IHZlbnR1cmVzIG9uIGhpcyBvd24nOidBdXRvcGlsb3Qgb2ZmJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBQQVlNRU5UUyAtLS0tLS0tLS0tICovCkxJVkUucGF5PSgpPT57CiAgY29uc3QgTz1TLm9yZGVyc3x8W107CiAgY29uc3QgcGFpZD1PLmZpbHRlcihvPT5vLnBhaWQ+MCkucmVkdWNlKChhLG8pPT5hK28ucGFpZCwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShPLmxlbmd0aCwnTGlua3MgUmFpc2VkJywndmFyKC0tY3kpJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoTy5maWx0ZXIobz0+by5wYWlkPjApLmxlbmd0aCwnUGFpZCcscGFpZD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWRpbSknLCdzZXR0bGVkJyl9CiAgICR7a3BpKChTLnBheT8oUy5wYXkuZ2F0ZXdheT09PSdyYXpvcnBheSc/J+KCuSc6JyQnKTonJykrZm10KHBhaWQpLCdDb2xsZWN0ZWQnLCd2YXIoLS1ncm4pJywncmVhbCBtb25leScpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QYXltZW50IExpbmtzPC9oMz4KICAgJHtPLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Rm9yPC90aD48dGg+QW1vdW50PC90aD48dGg+TW9kZTwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPkxpbms8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Ty5tYXAobz0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke28udH08L3RkPgogICAgPHRkPiR7ZXNjKG8uZGVzYyl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG8uY3VzdG9tZXIpfTwvZGl2PjwvdGQ+CiAgICA8dGQ+JHtvLmN1cnJlbmN5fSAke2ZtdChvLmFtb3VudCl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5saXZlPyd0LXJlZCc6J3QtZGltJ30iPiR7by5saXZlPydMSVZFJzonVEVTVCd9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke28ucGFpZD4wPyd0LWdybic6J3QtYW1iJ30iPiR7by5wYWlkPjA/J1BBSUQnOmVzYyhvLnN0YXR1cyl9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PGEgaHJlZj0iJHtlc2Moby51cmwpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPm9wZW4g4oaXPC9hPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYXltZW50IGxpbmtzIHJhaXNlZCB5ZXQuPC9kaXY+J308L2Rpdj5gOwp9OwpSRU5ERVIucGF5PSgpPT57CiAgY29uc3QgUD1TLnBheSwgR1c9Uy5nYXRld2F5c3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7UD8oUC5saXZlPycjNmIyMjMzJzonIzFjNWMzYycpOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7UD8oUC5saXZlPycjMTYwYjBjJzonIzA4MTcwZicpOicjMTUxMDBhJ30sIzBhMGYxNikiPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7UD8oUC5saXZlPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpOid2YXIoLS1hbWIpJ30iPuKCuSBQQVlNRU5UUyDigJQgJHtQPyhQLmxpdmU/J0xJVkUgwrcgUkVBTCBNT05FWSc6J0NPTk5FQ1RFRCDCtyBURVNUIE1PREUnKTonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke1AKICAgID9gVmVyaWZpZWQgYWdhaW5zdCA8Yj4ke2VzYyhQLmdhdGV3YXkpfTwvYj4sIGtleSAke2VzYyhQLmtleUlkKX0uICR7UC5saXZlCiAgICAgID8nPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgbGlua3MgeW91IHJhaXNlIHRha2UgcmVhbCBtb25leS4gRXZlcnkgbGluayBuZWVkcyB5b3VyIHBhc3N3b3JkLjwvYj4nCiAgICAgIDonVGVzdCBtb2RlLiBMaW5rcyB3b3JrIGVuZC10by1lbmQgYnV0IG1vdmUgbm8gcmVhbCBtb25leS4nfWAKICAgIDonQ29ubmVjdCBSYXpvcnBheSBvciBTdHJpcGUgYmVsb3cuIEtleXMgYXJlIHZlcmlmaWVkIGFnYWluc3QgdGhlIHJlYWwgQVBJIGJlZm9yZSBiZWluZyBhY2NlcHRlZCDigJQgYSB3cm9uZyBrZXkgaXMgcmVqZWN0ZWQgaW1tZWRpYXRlbHksIG5vdCBzdG9yZWQuJ308L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+PGxpPlN0YXJ0IHdpdGggPGI+dGVzdCBrZXlzPC9iPi4gUmF6b3JwYXkgPGNvZGU+cnpwX3Rlc3RfPC9jb2RlPiwgU3RyaXBlIDxjb2RlPnNrX3Rlc3RfPC9jb2RlPiDigJQgaW5zdGFudCwgbm8gS1lDLjwvbGk+CiAgICA8bGk+TGl2ZSBrZXlzIG5lZWQgS1lDIChQQU4gKyBiYW5rIGZvciBSYXpvcnBheSkuIFByb3ZpZGVycyBjaGFyZ2UgfjIlIHBlciB0cmFuc2FjdGlvbiDigJQgdGhhdCBpcyB0aGUgY29zdCBvZiBtb3ZpbmcgbW9uZXksIG5vdCBzb21ldGhpbmcgdG8gcm91dGUgYXJvdW5kLjwvbGk+CiAgICA8bGk+WW91ciBzZWNyZXQgaXMgbmV2ZXIgcmV0dXJuZWQgYnkgdGhlIEFQSSBhbmQgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvbGk+PC91bD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbm5lY3QgR2F0ZXdheTwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkdhdGV3YXk8L3NwYW4+PHNlbGVjdCBpZD0icGdTZWwiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InBheUhpbnQoKSI+CiAgICAgJHtHVy5tYXAoZz0+YDxvcHRpb24gdmFsdWU9IiR7Zy5pZH0iICR7UCYmUC5nYXRld2F5PT09Zy5pZD8nc2VsZWN0ZWQnOicnfT4ke2VzYyhnLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9InBheUhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5LZXkgSUQgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oUmF6b3JwYXkgb25seSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InJ6cF90ZXN0Xy4uLiI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U2VjcmV0IEtleTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9InBnU2VjcmV0IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InNlY3JldCAvIHNrX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdFBheSgpIj5WRVJJRlkgJmFtcDsgQ09OTkVDVDwvYnV0dG9uPgogICAgICR7UD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVBheSgpIj5EaXNjb25uZWN0PC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIGEgUGF5bWVudCBMaW5rPC9oMz4KICAgICR7IVA/JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Db25uZWN0IGEgZ2F0ZXdheSBmaXJzdC48L2Rpdj4nOmAKICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW1vdW50ICR7UC5nYXRld2F5PT09J3Jhem9ycGF5Jz8nKElOUiknOicoVVNEKSd9PC9zcGFuPjxpbnB1dCBpZD0icGxBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iMjUwMCI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkN1c3RvbWVyIG5hbWU8L3NwYW4+PGlucHV0IGlkPSJwbE5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGlzIGl0IGZvcjwvc3Bhbj48aW5wdXQgaWQ9InBsRGVzYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iV2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZyDigJQgQXVndXN0Ij48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5FbWFpbDwvc3Bhbj48aW5wdXQgaWQ9InBsRW1haWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGhvbmU8L3NwYW4+PGlucHV0IGlkPSJwbFBob25lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD48L2Rpdj4KICAgICR7UC5saXZlP2A8bGFiZWwgY2xhc3M9ImYiPjxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5MSVZFIE1PREUg4oCUIGNvbmZpcm0gd2l0aCB5b3VyIHBhc3N3b3JkPC9zcGFuPgogICAgICA8aW5wdXQgaWQ9InBsUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJtYWtlTGluaygpIj5DUkVBVEUgTElOSzwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVmcmVzaFBheSgpIj5DSEVDSyBGT1IgUEFZTUVOVFM8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPllvdSBnZXQgYSBVUkwgdG8gc2VuZCBvdmVyIFdoYXRzQXBwIG9yIGVtYWlsLiBXaGVuIGl0IHNldHRsZXMsIHRoZSBsZWRnZXIgdXBkYXRlcyBhbmQgeW91IGdldCBhbiBlbWFpbC48L2Rpdj5gfTwvZGl2PgogIDwvZGl2PgogIDxkaXYgZGF0YS1saXZlPSJwYXkiPiR7TElWRS5wYXkoKX08L2Rpdj5gOwp9OwpmdW5jdGlvbiBwYXlIaW50KCl7CiAgY29uc3QgZz0oUy5nYXRld2F5c3x8W10pLmZpbmQoeD0+eC5pZD09PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZ1NlbCcpLnZhbHVlKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF5SGludCcpOwogIGlmKGcmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKGcubGFiZWwpfTwvYj48YnI+JHtlc2MoZy5zaWdudXApfTxicj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGcua2V5SGludCl9PC9zcGFuPmA7Cn0KYXN5bmMgZnVuY3Rpb24gY29ubmVjdFBheSgpewogIGZsYXNoKCdWZXJpZnlpbmcga2V5cyBhZ2FpbnN0IHRoZSByZWFsIEFQSeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2Nvbm5lY3QnLHtnYXRld2F5OnBnU2VsLnZhbHVlLGtleUlkOnBnSWQudmFsdWUsa2V5U2VjcmV0OnBnU2VjcmV0LnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5saXZlPydDT05ORUNURUQg4oCUIExJVkUgTU9ERSwgcmVhbCBtb25leSc6J0Nvbm5lY3RlZCBpbiBURVNUIG1vZGUnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5KCl7IGlmKCFjb25maXJtKCdEaXNjb25uZWN0IHRoZSBwYXltZW50IGdhdGV3YXk/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvcGF5L3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gbWFrZUxpbmsoKXsKICBmbGFzaCgnQ3JlYXRpbmcgbGlua+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2xpbmsnLHthbW91bnQ6K3BsQW10LnZhbHVlLGRlc2NyaXB0aW9uOnBsRGVzYy52YWx1ZSwKICAgICAgbmFtZTpwbE5hbWUudmFsdWUsZW1haWw6cGxFbWFpbC52YWx1ZSxwaG9uZTpwbFBob25lLnZhbHVlLAogICAgICBwdzooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsUHcnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsKICAgIG1vZGFsKGA8aDM+UGF5bWVudCBsaW5rIHJlYWR5PC9oMz4KICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij48ZGl2IHN0eWxlPSJ3b3JkLWJyZWFrOmJyZWFrLWFsbDtjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHIudXJsKX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoJyR7ZXNjKHIudXJsKX0nKTtmbGFzaCgnQ29waWVkJykiPkNvcHkgbGluazwvYnV0dG9uPgogICAgICA8YSBjbGFzcz0iYnRuIiBocmVmPSIke2VzYyhyLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+T3BlbiDihpc8L2E+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFBheSgpeyBmbGFzaCgnQ2hlY2tpbmcgZ2F0ZXdheeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L3JlZnJlc2gnLHt9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLnVwZGF0ZWQ/ci51cGRhdGVkKycgb3JkZXIocykgdXBkYXRlZCc6J05vIGNoYW5nZXMnKTsgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBERUVQIFJFU0VBUkNIIC0tLS0tLS0tLS0gKi8KUkVOREVSLnJlc2VhcmNoPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxYzNmNzU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwODEzMWYsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYmx1KSI+8J+MkCBERUVQIFJFU0VBUkNIIOKAlCBMSVZFIEZST00gVEhFIE9QRU4gV0VCPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGRvZXMgbm90IHN0b3JlIHRoZSB3b3JsZCdzIGRhdGEg4oCUIG5vYm9keSBjYW4uIEluc3RlYWQgaGUgPGI+ZmV0Y2hlcyBpdCBsaXZlIHRoZSBtb21lbnQgeW91IGFzazwvYj4sIHdoaWNoIGlzIGJldHRlciwgYmVjYXVzZSBzdG9yZWQgZGF0YSBpcyBzdGFsZSB3aXRoaW4gZGF5cy4gU291cmNlczogRHVja0R1Y2tHbywgV2lraXBlZGlhLCBXb3JsZCBCYW5rLCBsaXZlIEZYLiBObyBBUEkga2V5LCBubyBwYWlkIHNlYXJjaC48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPkRlZXAgZGl2ZTwvYj4gc2VhcmNoZXMgNSBkaWZmZXJlbnQgYW5nbGVzLCBkZWR1cGxpY2F0ZXMsIGFkZHMgb3BlbiBkYXRhc2V0cywgdGhlbiByZWFzb25zIG92ZXIgdGhlIGxvdC48L2xpPgogICA8bGk+PGI+UmVhZCBwYWdlPC9iPiBwdWxscyB0aGUgZnVsbCB0ZXh0IG9mIGFueSBVUkwg4oCUIGNvbXBldGl0b3Igc2l0ZXMsIHByaWNlIGxpc3RzLCBnb3Zlcm5tZW50IHBhZ2VzLjwvbGk+CiAgIDxsaT5IZSBpcyBpbnN0cnVjdGVkIHRvIHN0YXRlIHdoYXQgaGUgY291bGQgPGI+bm90PC9iPiBmaW5kLCByYXRoZXIgdGhhbiBmaWxsaW5nIGdhcHMgd2l0aCBpbnZlbnRpb24uPC9saT4KICA8L3VsPjwvZGl2PgogJHshUy5sbG0/JzxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3Qg4oCUIHJlc2VhcmNoIG5lZWRzIHJlYXNvbmluZyB0byBiZSB1c2VmdWwuPC9kaXY+PC9kaXY+JzonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWVwIERpdmUgYSBUb3BpYzwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VG9waWM8L3NwYW4+PGlucHV0IGlkPSJkdlRvcGljIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHVwdGltZSBtb25pdG9yaW5nIGRlbWFuZCBmb3IgTHVkaGlhbmEgZS1jb21tZXJjZSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5SZWdpb248L3NwYW4+PGlucHV0IGlkPSJkdlJlZ2lvbiIgY2xhc3M9ImluIiB2YWx1ZT0iTHVkaGlhbmEgUHVuamFiIEluZGlhIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9EaXZlKCkiPklOVkVTVElHQVRFPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRha2VzIH4xNXMuIEZpdmUgc2VhcmNoZXMgcGx1cyBvcGVuIGRhdGEuPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlYWQgQW55IFBhZ2U8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVSTDwvc3Bhbj48aW5wdXQgaWQ9InJkVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2NvbXBldGl0b3IuY29tL3ByaWNpbmciPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBkbyB5b3Ugd2FudCB0byBrbm93PyAob3B0aW9uYWwpPC9zcGFuPjxpbnB1dCBpZD0icmRBc2siIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IndoYXQgZG8gdGhleSBjaGFyZ2UgYW5kIHdoYXQgaXMgbWlzc2luZyI+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvUmVhZCgpIj5SRUFEIElUPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlB1bGxzIHVwIHRvIDEyLDAwMCBjaGFyYWN0ZXJzIG9mIHJlYWwgcGFnZSB0ZXh0LjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGlkPSJyZXNPdXQiPjwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRvRGl2ZSgpewogIGNvbnN0IHQ9ZHZUb3BpYy52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYSB0b3BpYycpOwogIHJlc091dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5TZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmPC9kaXY+PC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Jlc2VhcmNoL2RpdmUnLHt0b3BpYzp0LHJlZ2lvbjpkdlJlZ2lvbi52YWx1ZX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkZpbmRpbmdzIDxzcGFuIGNsYXNzPSJ0YWcgdC1ibHUiPiR7Zm10KHIuZXZpZGVuY2UpfSBjaGFycyBvZiBldmlkZW5jZTwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9SZWFkKCl7CiAgY29uc3QgdT1yZFVybC52YWx1ZS50cmltKCk7IGlmKCF1KSByZXR1cm4gZmxhc2goJ1Bhc3RlIGEgVVJMJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPkZldGNoaW5nIHBhZ2XigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvcmVhZCcse3VybDp1LGFzazpyZEFzay52YWx1ZS50cmltKCl9KTsKICAgIHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz4ke2VzYyhyLnRpdGxlKX0gPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5jaGFycyl9IGNoYXJzIHJlYWQ8L3NwYW4+PC9oMz4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NSI+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj5gOwogIH1jYXRjaChlKXsgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PjwvZGl2PmAgfQp9CgovKiAtLS0tLS0tLS0tIEFJIEJSQUlOIC0tLS0tLS0tLS0gKi8KUkVOREVSLmJyYWluPSgpPT57CiAgY29uc3QgTD1TLmxsbSwgUFY9Uy5wcm92aWRlcnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke0w/JyMxYzVjM2MnOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7TD8nIzA4MTcwZic6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtMPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKSd9Ij7il4ggQUkgQlJBSU4g4oCUICR7TD8nQ09OTkVDVEVEJzonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke0wKICAgID9gQWdlbnRzIGNhbiB0aGluay4gQ29ubmVjdGVkIHRvIDxiPiR7ZXNjKEwucHJvdmlkZXIpfTwvYj4gcnVubmluZyA8Yj4ke2VzYyhMLm1vZGVsKX08L2I+LiBLZXkgJHtlc2MoTC5rZXkpfS5gCiAgICA6J1lvdXIgYWdlbnRzIGNhbiBtZWFzdXJlIHRoaW5ncyBidXQgY2Fubm90IDxiPnJlYXNvbjwvYj4geWV0LiBDb25uZWN0IGEgZnJlZSBtb2RlbCBiZWxvdyBhbmQgdGhleSBnYWluIHRoZSBhYmlsaXR5IHRvIGRpYWdub3NlLCB3cml0ZSwgYW5hbHlzZSBhbmQgc3RyYXRlZ2lzZS4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+RXZlcnkgcHJvdmlkZXIgYmVsb3cgaXMgPGI+Z2VudWluZWx5IGZyZWU8L2I+IOKAlCBubyBjcmVkaXQgY2FyZC48L2xpPgogICAgPGxpPllvdXIga2V5IGlzIHN0b3JlZCBsb2NhbGx5IGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4pqRIFdBTlQgSElNIEZVTExZIElOREVQRU5ERU5UPyDigJQgUkVBRCBUSElTPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkEgdGhpbmtpbmcgYnJhaW4gY2Fubm90IGJlIGNvbmp1cmVkIGZyb20gbm90aGluZy4gVHJhaW5pbmcgb25lIGNvc3RzIG1pbGxpb25zIGluIEdQVSB0aW1lLiBFdmVyeSBBSSBvbiBlYXJ0aCDigJQgaW5jbHVkaW5nIHRoaXMgb25lIOKAlCBydW5zIHdlaWdodHMgdHJhaW5lZCBieSBzb21lb25lIHdpdGggYSBkYXRhIGNlbnRyZS4gVGhlIGhvbmVzdCBxdWVzdGlvbiBpcyBub3QgPGVtPiJoaXMgYnJhaW4gb3IgdGhlaXJzIjwvZW0+IGJ1dCA8Yj4id2hvIGNhbiBzd2l0Y2ggaXQgb2ZmIjwvYj4uPC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+T2xsYW1hIGlzIHRoZSBhbnN3ZXIgdG8gdGhhdC48L2I+IFRoZSBtb2RlbCBmaWxlIHNpdHMgb24geW91ciBvd24gZGlzay4gTm8ga2V5LCBubyBhY2NvdW50LCBubyByYXRlIGxpbWl0LCBubyB0ZXJtcyBvZiBzZXJ2aWNlLiBJdCB3b3JrcyB3aXRoIHRoZSBpbnRlcm5ldCB1bnBsdWdnZWQuIE5vYm9keSBjYW4gcmV2b2tlIGl0LCByZWFkIHlvdXIgcHJvbXB0cywgb3IgY2hhbmdlIHRoZSBkZWFsLiBUaGF0IGlzIHJlYWwgc292ZXJlaWdudHkg4oCUIHRoZSBvbmx5IGNvc3QgaXMgeW91ciBoYXJkd2FyZS48L2Rpdj4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij4xLiBJbnN0YWxsPC90ZD48dGQ+RG93bmxvYWQgZnJvbSA8Yj5vbGxhbWEuY29tPC9iPiAoZnJlZSwgV2luZG93cy9NYWMvTGludXgpPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjIuIEdldCBhIG1vZGVsPC90ZD48dGQ+SW4gdGVybWluYWw6IDxjb2RlPm9sbGFtYSBwdWxsIGxsYW1hMy4yPC9jb2RlPiDigJQgYWJvdXQgMiBHQjwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4zLiBDb25uZWN0PC90ZD48dGQ+Q2hvb3NlIDxiPk9sbGFtYTwvYj4gYWJvdmUsIGxlYXZlIHRoZSBrZXkgYmxhbmssIHByZXNzIENPTk5FQ1Q8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QmlnZ2VyIGJyYWluPC90ZD48dGQ+PGNvZGU+b2xsYW1hIHB1bGwgcXdlbjIuNToxNGI8L2NvZGU+IGlmIHlvdSBoYXZlIDE2IEdCKyBSQU08L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PGI+VGhlIHRyYWRlLW9mZiwgc3RhdGVkIHBsYWlubHk6PC9iPiBhIGxvY2FsIG1vZGVsIG9uIGEgbm9ybWFsIGxhcHRvcCBpcyBzbG93ZXIgYW5kIGxlc3MgY2FwYWJsZSB0aGFuIEdyb3EncyBmcmVlIGNsb3VkIG1vZGVscy4gWW91IGFyZSBleGNoYW5naW5nIHJhdyBwb3dlciBmb3IgdG90YWwgY29udHJvbC4gQWxzbyDigJQgdGhpcyBSZW5kZXIgaW5zdGFuY2UgY2Fubm90IHJlYWNoIGFuIE9sbGFtYSBydW5uaW5nIG9uIHlvdXIgUEM7IGxvY2FsIGJyYWluIG1lYW5zIHJ1bm5pbmcgdGhlIENoYWlybWFuIGxvY2FsbHkgdG9vLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBhIEZyZWUgTW9kZWw8L2gzPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qcm92aWRlcjwvc3Bhbj48c2VsZWN0IGlkPSJscFByb3YiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InByb3ZIaW50KCkiPgogICAgICR7UFYubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke0wmJkwucHJvdmlkZXI9PT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKHAubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icHJvdkhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BUEkgS2V5IDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KG5vdCBuZWVkZWQgZm9yIE9sbGFtYSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibHBLZXkiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icGFzdGUgeW91ciBmcmVlIGtleSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TW9kZWwgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oYmxhbmsgPSBwcm92aWRlciBkZWZhdWx0KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscE1vZGVsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJsZWF2ZSBibGFuayIgbGlzdD0ibW9kZWxMaXN0Ij4KICAgICA8ZGF0YWxpc3QgaWQ9Im1vZGVsTGlzdCI+PC9kYXRhbGlzdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdExMTSgpIj5DT05ORUNUIEJSQUlOPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0TExNKCkiPlRFU1QgSVQ8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImZldGNoTW9kZWxzKCkiPkZFVENIIExJVkUgTU9ERUxTPC9idXR0b24+CiAgICAgJHtMPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlTExNKCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvdmlkZXJzIHJldGlyZSBtb2RlbHMgd2l0aG91dCBub3RpY2UuIElmIFRFU1QgSVQgc2F5cyBNT0RFTCBSRVRJUkVELCBwcmVzcyBGRVRDSCBMSVZFIE1PREVMUyBhbmQgcGljayBvbmUgZnJvbSB0aGUgbGlzdC48L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPldoYXQgQWdlbnRzIEdhaW48L2gzPgogICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxMzBweCI+YWkuYnJpZWY8L3RkPjx0ZD5FeGVjdXRpdmUgYnJpZWYgd3JpdHRlbiBmcm9tIHlvdXIgcmVhbCBzeXN0ZW0gc3RhdGU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmluY2lkZW50PC90ZD48dGQ+UmFua2VkIGRpYWdub3NpcyBvZiBhbnkgc2l0ZSB0aGF0IGdvZXMgZG93bjwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkucmV2ZW51ZTwvdGQ+PHRkPkNvbmNyZXRlIG1vbmV5LW1ha2luZyByb3V0ZXMgZnJvbSB3aGF0IHlvdSBhY3R1YWxseSBoYXZlPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5jbGllbnRfcmVwb3J0PC90ZD48dGQ+Q2xpZW50LXJlYWR5IHVwdGltZSByZXBvcnQgeW91IGNhbiBzZW5kIGFuZCBjaGFyZ2UgZm9yPC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFkZCB0aGVzZSBvbiB0aGUgTGl2ZSBPcGVyYXRpb25zIHBhZ2UgYXMgc3RhbmRpbmcgb3JkZXJzLCBvciBydW4gdGhlbSBvbiBkZW1hbmQgZnJvbSBBZ2VudCBXb3JrLjwvZGl2PjwvZGl2PgogIDwvZGl2PmB9OwpmdW5jdGlvbiBwcm92SGludCgpewogIGNvbnN0IHA9KFMucHJvdmlkZXJzfHxbXSkuZmluZCh4PT54LmlkPT09ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwUHJvdicpLnZhbHVlKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvdkhpbnQnKTsKICBpZihwJiZlbCkgZWwuaW5uZXJIVE1MPWA8Yj4ke2VzYyhwLmxhYmVsKX08L2I+PGJyPiR7ZXNjKHAuc2lnbnVwKX08YnI+RGVmYXVsdCBtb2RlbDogPGNvZGU+JHtlc2MocC5tb2RlbCl9PC9jb2RlPmA7Cn0KYXN5bmMgZnVuY3Rpb24gY29ubmVjdExMTSgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9jb25uZWN0Jyx7cHJvdmlkZXI6bHBQcm92LnZhbHVlLGtleTpscEtleS52YWx1ZSxtb2RlbDpscE1vZGVsLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0JyYWluIGNvbm5lY3RlZCDigJQgbm93IHByZXNzIFRFU1QgSVQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHRlc3RMTE0oKXsgZmxhc2goJ1RoaW5raW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9sbG0vdGVzdCcse30pOyByZW5kZXIoKTsKICAgIG1vZGFsKGA8aDM+QUkgQnJhaW4gT25saW5lPC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij48ZGl2PiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHIubW9kZWwpfSDCtyAke3IubXN9bXM8L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCk7Z28oJ3dvcmsnKSI+R2l2ZSBpdCB3b3JrIOKGkjwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VMTE0oKXsgaWYoIWNvbmZpcm0oJ0Rpc2Nvbm5lY3QgdGhlIEFJIGJyYWluPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL2xsbS9wdXJnZScse30pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIGZldGNoTW9kZWxzKCl7CiAgZmxhc2goJ0Fza2luZyBwcm92aWRlciB3aGF0IGl0IHNlcnZlcyB0b2RheeKApicpOwogIHRyeXsKICAgIGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS9tb2RlbHMnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlfSk7CiAgICBpZighci5tb2RlbHMubGVuZ3RoKSByZXR1cm4gZmxhc2goJ1Byb3ZpZGVyIHJldHVybmVkIG5vIGNoYXQgbW9kZWxzJyk7CiAgICBtb2RhbChgPGgzPkxpdmUgbW9kZWxzIG9uICR7ZXNjKGxwUHJvdi52YWx1ZSl9PC9oMz4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtyLm1vZGVscy5sZW5ndGh9IGF2YWlsYWJsZSByaWdodCBub3cuIENsaWNrIG9uZSB0byB1c2UgaXQuPC9kaXY+CiAgICAgPGRpdiBjbGFzcz0iZGlyTGlzdCIgc3R5bGU9Im1heC1oZWlnaHQ6MzQwcHgiPiR7ci5tb2RlbHMubWFwKG09PgogICAgICAgYDxidXR0b24gb25jbGljaz0icGlja01vZGVsKCcke2VzYyhtKX0nKSI+JHtlc2MobSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHBpY2tNb2RlbChtKXsgY2xvc2VNb2RhbCgpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdscE1vZGVsJyk7IGlmKGVsKSBlbC52YWx1ZT1tOwogIGZsYXNoKCdNb2RlbCBzZXQgdG8gJyttKycg4oCUIHByZXNzIENPTk5FQ1QgQlJBSU4gdGhlbiBURVNUIElUJyk7IH0KCi8qIC0tLS0tLS0tLS0gQUdFTlQgV09SSyAtLS0tLS0tLS0tICovCmNvbnN0IFFVSUNLPVsKIFsnRXhlY3V0aXZlIGJyaWVmJywnU3VtbWFyaXNlIG15IHN5c3RlbSBzdGF0ZSBhbmQgdGVsbCBtZSB0aGUgc2luZ2xlIG1vc3QgdXJnZW50IHRoaW5nIHRvIGZpeC4gQmUgYmx1bnQuJ10sCiBbJ01ha2UgbW9uZXknLCdPbmx5IHByb3Bvc2Ugb2ZmZXJzIGRlbGl2ZXJlZCB1c2luZyBNWSB1cHRpbWUgbW9uaXRvcmluZyBzeXN0ZW0gKDI0LzcgSFRUUCBwcm9iaW5nLCBUTFMgZXhwaXJ5IGFsZXJ0cywgaW5zdGFudCBvdXRhZ2UgZW1haWwsIGF2YWlsYWJpbGl0eSBhbmQgcDk1IHJlcG9ydGluZykuIFRSVVRIIFJVTEU6IEkgaGF2ZSBuZXZlciBtb25pdG9yZWQgYW55IGNsaWVudCBzaXRlIGFuZCBoYXZlIG5vIHRyYWNrIHJlY29yZC4gVGhlIG91dHJlYWNoIG1lc3NhZ2UgbXVzdCBjb250YWluIFpFUk8gY2xhaW1zIEkgY2Fubm90IHByb3ZlIOKAlCBubyAiSSBub3RpY2VkIG91dGFnZXMgb24gbG9jYWwgc2l0ZXMiLCBubyBpbnZlbnRlZCByZXZlbnVlIGZpZ3VyZXMsIG5vIHVudmVyaWZpZWQgc3RhdGlzdGljcy4gTGVhZCB3aXRoIGEgZnJlZSB0cmlhbCwgbm90IGEgZmFrZSBvYnNlcnZhdGlvbi4gVmVyaWZ5IGFueSBhcml0aG1ldGljIHlvdSBzdGF0ZS4gR2l2ZSAzIG9mZmVyczogdGhlIG9mZmVyIGluIG9uZSBzZW50ZW5jZSwgdGhlIEx1ZGhpYW5hIGJ1c2luZXNzIHR5cGUgYW5kIGl0cyByZWFsIHBhaW4sIG1vbnRobHkgSU5SIHByaWNlIHdpdGggc291bmQgcmVhc29uaW5nLCB0aGUgbGl0ZXJhbCBmaXJzdCBXaGF0c0FwcCBtZXNzYWdlIHVuZGVyIDUwIHdvcmRzLCBhbmQgdGhlIGJpZ2dlc3Qgb2JqZWN0aW9uIHdpdGggYW4gaG9uZXN0IGNvdW50ZXIuIENvbGQgb3V0cmVhY2ggY2xvc2VzIDEtMyUuJ10sCiBbJ0ZpbmQgcHJvc3BlY3RzJywnTGlzdCAxMCBzcGVjaWZpYyBidXNpbmVzcyB0eXBlcyBpbiBMdWRoaWFuYSB0aGF0IGxvc2UgcmVhbCBtb25leSB3aGVuIHRoZWlyIHdlYnNpdGUgZ29lcyBkb3duLCByYW5rZWQgYnkgaG93IG11Y2ggdGhleSBsb3NlIHBlciBob3VyLiBGb3IgZWFjaCwgc2F5IHdoZXJlIEkgY2FuIGZpbmQgdGhlaXIgY29udGFjdCBkZXRhaWxzIGZvciBmcmVlLiddLAogWydDbGllbnQgcGl0Y2gnLCdXcml0ZSBhIFdoYXRzQXBwIG1lc3NhZ2Ugb2ZmZXJpbmcgZnJlZSAxNC1kYXkgd2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZyB0byBhIGxvY2FsIGJ1c2luZXNzIG93bmVyLiBQbGFpbiBJbmRpYW4gRW5nbGlzaCwgbm8gbWFya2V0aW5nIGxhbmd1YWdlLCBubyBlbW9qaS4gVW5kZXIgNDUgd29yZHMuIFRoZSBnb2FsIGlzIGEgcmVwbHksIG5vdCBhIHNhbGUuJ10sCiBbJ0hhbmRsZSBvYmplY3Rpb25zJywnQSBMdWRoaWFuYSBidXNpbmVzcyBvd25lciBzYXlzICJteSB3ZWJzaXRlIG5ldmVyIGdvZXMgZG93biwgSSBkb24gbm90IG5lZWQgdGhpcyIuIEdpdmUgbWUgdGhyZWUgaG9uZXN0IHJlcGxpZXMgdGhhdCBkbyBub3QgZXhhZ2dlcmF0ZSBvciB1c2UgZmVhciB0YWN0aWNzLiddLAogWydJbnZvaWNlIHRlbXBsYXRlJywnV3JpdGUgYSBzaW1wbGUgbW9udGhseSBpbnZvaWNlIGZvciB3ZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nLCByZWFkeSB0byBmaWxsIGluLCBzdWl0YWJsZSBmb3IgYSBzbWFsbCBJbmRpYW4gYnVzaW5lc3MuIEluY2x1ZGUgR1NUIHBsYWNlaG9sZGVyIGFuZCBVUEkgcGF5bWVudCBsaW5lLiddCl07ClJFTkRFUi53b3JrPSgpPT57CiAgY29uc3QgTz1TLm91dHB1dHN8fFtdOwogIHJldHVybiBgJHshUy5sbG0/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPgogICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIEJSQUlOIENPTk5FQ1RFRDwvaDM+CiAgIDxkaXY+QWdlbnRzIGNhbm5vdCB0aGluayB5ZXQuIDxiIG9uY2xpY2s9ImdvKCdicmFpbicpIiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpO2N1cnNvcjpwb2ludGVyO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmUiPkNvbm5lY3QgYSBmcmVlIG1vZGVsPC9iPiBmaXJzdCDigJQgdGFrZXMgYWJvdXQgMiBtaW51dGVzIGFuZCBuZWVkcyBubyBjcmVkaXQgY2FyZC48L2Rpdj48L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HaXZlIHRoZSBDaGFpcm1hbiBXb3JrIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UExBSU4gRU5HTElTSDwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+VHlwZSBhbnkgaW5zdHJ1Y3Rpb24uIEEgcmVhbCBtb2RlbCBleGVjdXRlcyBpdCBhbmQgdGhlIHJlc3VsdCBpcyBzYXZlZCBiZWxvdy48L2Rpdj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbnN0cnVjdGlvbjwvc3Bhbj48dGV4dGFyZWEgaWQ9IndrUHJvbXB0IiBjbGFzcz0iaW4iIHN0eWxlPSJtaW4taGVpZ2h0OjkwcHgiCiAgICAgcGxhY2Vob2xkZXI9ImUuZy4gV3JpdGUgYSBvbmUtcGFnZSBwcm9wb3NhbCBvZmZlcmluZyB1cHRpbWUgbW9uaXRvcmluZyB0byBhIEx1ZGhpYW5hIGNsb3RoaW5nIHNob3AsIHByaWNlZCBpbiBJTlIuIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvV29yaygpIj5FWEVDVVRFPC9idXR0b24+CiAgICAke08ubGVuZ3RoPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyV29yaygpIj5DbGVhciByZXN1bHRzPC9idXR0b24+JzonJ308L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5RdWljayB0YXNrczo8L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyI+JHtRVUlDSy5tYXAoKHEsaSk9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InF1aWNrKCR7aX0pIj4ke2VzYyhxWzBdKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj48L2Rpdj48L2Rpdj4KICAke08ubGVuZ3RoP08ubWFwKChvLGkpPT5gPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtcHVyIj4ke2VzYyhvLnRhZyl9PC9zcGFuPjxiPiR7ZXNjKG8uYWdlbnQpfTwvYj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7by50fSDCtyAke28ubXN9bXMgwrcgJHtvLnRva2Vuc30gdG9rZW5zPC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhvLnRleHQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlPdXQoJHtpfSkiPkNvcHk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB3b3JrIHByb2R1Y2VkIHlldC48L2Rpdj48L2Rpdj4nfWB9Owphc3luYyBmdW5jdGlvbiBkb1dvcmsoKXsKICBjb25zdCBwPXdrUHJvbXB0LnZhbHVlLnRyaW0oKTsgaWYoIXApIHJldHVybiBmbGFzaCgnVHlwZSBhbiBpbnN0cnVjdGlvbiBmaXJzdCcpOwogIGZsYXNoKCdXb3JraW5n4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Fzaycse3Byb21wdDpwfSk7IHJlbmRlcigpOyBmbGFzaCgnRG9uZScpOyB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmZ1bmN0aW9uIHF1aWNrKGkpeyB3a1Byb21wdC52YWx1ZT1RVUlDS1tpXVsxXTsgZG9Xb3JrKCkgfQpmdW5jdGlvbiBjb3B5T3V0KGkpeyBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoKFMub3V0cHV0c3x8W10pW2ldLnRleHQpOyBmbGFzaCgnQ29waWVkJykgfQphc3luYyBmdW5jdGlvbiBjbGVhcldvcmsoKXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIExJVkUgT1BFUkFUSU9OUyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIGFnbyhpc28peyBpZighaXNvKSByZXR1cm4gJ25ldmVyJzsKICBjb25zdCBzPU1hdGguZmxvb3IoKERhdGUubm93KCktbmV3IERhdGUoaXNvLnJlcGxhY2UoJyAnLCdUJykrJ1onKS5nZXRUaW1lKCkpLzEwMDApOwogIGlmKHM8NjApIHJldHVybiBzKydzIGFnbyc7IGlmKHM8MzYwMCkgcmV0dXJuIE1hdGguZmxvb3Iocy82MCkrJ20gYWdvJzsgcmV0dXJuIE1hdGguZmxvb3Iocy8zNjAwKSsnaCBhZ28nOyB9CmZ1bmN0aW9uIGV2ZXJ5KG4peyByZXR1cm4gbjw2MD9uKydzJzpuPDM2MDA/TWF0aC5yb3VuZChuLzYwKSsnbSc6TWF0aC5yb3VuZChuLzM2MDApKydoJzsgfQpMSVZFLm9wcz0oKT0+ewogIGNvbnN0IFQ9Uy50YXNrc3x8W10sIFI9Uy5ydW5zfHxbXTsKICBjb25zdCBvbj1ULmZpbHRlcih0PT50LmVuYWJsZWQpLmxlbmd0aDsKICBjb25zdCB0b3RhbFJ1bnM9VC5yZWR1Y2UoKGEsdCk9PmErKHQucnVuc3x8MCksMCk7CiAgY29uc3QgZmFpbHM9VC5yZWR1Y2UoKGEsdCk9PmErKHQuZmFpbHN8fDApLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKFMucnVubmluZz8nUlVOTklORyc6J0hBTFRFRCcsJ1N5c3RlbSBTdGF0ZScsUy5ydW5uaW5nPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKScsUy5ydW5uaW5nPyd3b3JrIGV4ZWN1dGluZyc6J25vdGhpbmcgcnVubmluZycpfQogICAke2twaShvbisnIC8gJytULmxlbmd0aCwnU3RhbmRpbmcgT3JkZXJzIExpdmUnLCd2YXIoLS1jeSknLCdvbiBzY2hlZHVsZScpfQogICAke2twaShmbXQodG90YWxSdW5zKSwnSm9icyBFeGVjdXRlZCcsJ3ZhcigtLWdybiknLFMudGlja3MrJyBzY2hlZHVsZXIgdGlja3MnKX0KICAgJHtrcGkoZmFpbHMsJ0ZhaWx1cmVzJyxmYWlscz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdzaW5jZSBpbnN0YWxsJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlN0YW5kaW5nIE9yZGVycyA8c3BhbiBjbGFzcz0idGFnICR7Uy5ydW5uaW5nPyd0LWdybic6J3QtcmVkJ30iPiR7Uy5ydW5uaW5nPydFWEVDVVRJTkcnOidGUk9aRU4nfTwvc3Bhbj48L2gzPgogICAke1QubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPkNhcGFiaWxpdHk8L3RoPjx0aD5Pd25lciBBZ2VudDwvdGg+PHRoPkV2ZXJ5PC90aD48dGg+TGFzdCBSdW48L3RoPjx0aD5SZXN1bHQ8L3RoPjx0aD5SdW5zPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke1QubWFwKHQ9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHQuY2FwKX08L2I+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKChTLmNhcHN8fFtdKS5maW5kKGM9PmMuY2FwPT09dC5jYXApPy5kZXNjfHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHQub3duZXIpfTwvdGQ+CiAgICA8dGQ+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9IndpZHRoOjc0cHg7cGFkZGluZzo0cHggN3B4IiB0eXBlPSJudW1iZXIiIHZhbHVlPSIke3QuZXZlcnl9IgogICAgICAgIG9uY2hhbmdlPSJzZXRFdmVyeSgnJHt0LmlkfScsdGhpcy52YWx1ZSkiIHRpdGxlPSJzZWNvbmRzIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtldmVyeSh0LmV2ZXJ5KX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthZ28odC5sYXN0QXQpfTwvdGQ+CiAgICA8dGQ+JHt0Lmxhc3RNc2c/YDxzcGFuIGNsYXNzPSJ0YWcgJHt0Lmxhc3RPaz8ndC1ncm4nOid0LXJlZCd9Ij4ke3QubGFzdE9rPydPSyc6J0ZBSUwnfTwvc3Bhbj4gJHtlc2ModC5sYXN0TXNnKX1gOic8c3BhbiBjbGFzcz0ibW9uby1kaW0iPm5vdCB5ZXQgcnVuPC9zcGFuPid9PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7dC5ydW5zfHwwfSR7dC5mYWlscz8nIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4vJyt0LmZhaWxzKyfinJc8L3NwYW4+JzonJ308L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBvbmNsaWNrPSJydW5Ob3coJyR7dC5pZH0nKSI+UnVuPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2dnbGVUYXNrKCcke3QuaWR9JywkeyF0LmVuYWJsZWR9KSI+JHt0LmVuYWJsZWQ/J1BhdXNlJzonU3RhcnQnfTwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdGFuZGluZyBvcmRlcnMuIFBvd2VyIHRoZSBzeXN0ZW0gb24gdG8gaW5zdGFsbCB0aGVtLjwvZGl2Pid9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV4ZWN1dGlvbiBGZWVkIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Ui5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7Ui5sZW5ndGg/YDxkaXYgY2xhc3M9ImxvZyI+JHtSLm1hcChyPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7ci50fTwvc3Bhbj4KICAgICA8c3BhbiBzdHlsZT0iY29sb3I6JHtyLm9rPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKSd9Ij5bJHtyLm9rPydET05FJzonRkFJTCd9XTwvc3Bhbj4KICAgICA8Yj4ke2VzYyhyLm93bmVyKX08L2I+IMK3ICR7ZXNjKHIuY2FwKX0g4oCUICR7ZXNjKHIubXNnKX0ke3IuZGV0YWlsP2BcbiAgICAgICAg4oazICR7ZXNjKHIuZGV0YWlsKX1gOicnfQogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KCR7ci5tc31tcyR7ci5tYW51YWw/JyDCtyBtYW51YWwnOicnfSk8L3NwYW4+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+YAogICA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIGV4ZWN1dGVkIHlldC4gUG93ZXIgb24gYW5kIHRoZSBmaXJzdCBzd2VlcCBydW5zIHdpdGhpbiAxMCBzZWNvbmRzLjwvZGl2Pid9PC9kaXY+YH07ClJFTkRFUi5vcHM9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLmh1c3RsZT8nI2E4NTVmNyc6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtTLmh1c3RsZT8nIzFhMGYyZSc6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjoke1MuaHVzdGxlPyd2YXIoLS1wdXIpJzondmFyKC0tYW1iKSd9Ij7imqEgSFVTVExFIE1PREUg4oCUICR7Uy5odXN0bGU/J0VOR0FHRUQnOidPRkYnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke1MuaHVzdGxlCiAgID9gPGI+TWF4aW11bSBvdXRwdXQuPC9iPiAkeyhTLnRhc2tzfHxbXSkubGVuZ3RofSBtb25leS1mb2N1c2VkIG9yZGVycyBydW5uaW5nIG9uIDxiPiR7Uy5sYW5lc3x8M30gcGFyYWxsZWwgbGFuZXM8L2I+IOKAlCBpZGVhcywgcmVzZWFyY2gsIG1pc3Npb25zLCByZXZlbnVlIHJvdXRlcywgZGVlcCBpbnZlc3RpZ2F0aW9uLiBBbGwgZmlyaW5nIGF0IG9uY2UsIG5vdCBvbmUgYWZ0ZXIgYW5vdGhlci5gCiAgIDonU3dpdGNoZXMgdGhlIHJvc3RlciB0byBtb25leS1nZW5lcmF0aW5nIHdvcmsgb25seSwgdGlnaHRlbnMgZXZlcnkgaW50ZXJ2YWwsIGFuZCBydW5zIHRhc2tzIDxiPmluIHBhcmFsbGVsPC9iPiBpbnN0ZWFkIG9mIHNlcXVlbnRpYWxseS4gRXhwZWN0IHJvdWdobHkgMTDigJMyMCBjb21wbGV0ZWQgam9icyBpbiB0aGUgZmlyc3QgaG91ci4nfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+UGFyYWxsZWwgbGFuZXMgZm9yIEFJIHRhc2tzOjwvc3Bhbj4KICAgPHNlbGVjdCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6OTBweCIgaWQ9ImxhbmVTZWwiIG9uY2hhbmdlPSJzZXRMYW5lcyh0aGlzLnZhbHVlKSI+CiAgICAke1sxLDIsMyw0LDUsNl0ubWFwKG49PmA8b3B0aW9uIHZhbHVlPSIke259IiAkeyhTLmxhbmVzfHwzKT09bj8nc2VsZWN0ZWQnOicnfT4ke259PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+CiAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+SGlnaGVyID0gZmFzdGVyLCBidXQgZnJlZSBBSSB0aWVycyByYXRlLWxpbWl0IGFyb3VuZCAzMCByZXF1ZXN0cy9taW4uPC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMjBweCIgdHlwZT0icGFzc3dvcmQiIGlkPSJodXN0bGVQdyIgcGxhY2Vob2xkZXI9IllvdXIgcGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLmh1c3RsZT8nbm8nOidwJ30iIG9uY2xpY2s9InRvZ2dsZUh1c3RsZSgpIj4ke1MuaHVzdGxlPydTVEFORCBET1dOJzonRU5HQUdFIEhVU1RMRSBNT0RFJ308L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij4ke1MuaHVzdGxlCiAgID8nU3RhbmRpbmcgZG93biByZXN0b3JlcyB0aGUgbm9ybWFsIG1vbml0b3Jpbmcgcm9zdGVyLicKICAgOidUaGlzIHJlcGxhY2VzIHlvdXIgY3VycmVudCB0YXNrIGxpc3QuIE1vbml0b3JpbmcgY29udGludWVzLCBidXQgdGhlIGVtcGhhc2lzIHNoaWZ0cyBoYXJkIHRvIHJldmVudWUuJ308L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzE1NWU2YiI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPuKCuSBTUEVORElORyBDRUlMSU5HIOKAlCAke1MuYnVkZ2V0Pygn4oK5JytmbXQoUy5idWRnZXQpKTonTk9UIFNFVCd9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+SGUgY2FuIDxiPnJlcXVlc3Q8L2I+IG1vbmV5IGZvciBhIHZlbnR1cmUg4oCUIGEgZG9tYWluLCBhIGxpc3RpbmcgZmVlLCBhIHNtYWxsIGFkIHRlc3QuIEhlIGNhbiBuZXZlciB0YWtlIGl0LiBFdmVyeSByZXF1ZXN0IGJlY29tZXMgYSBmcm96ZW4gZ2F0ZSBuZWVkaW5nIHlvdXIgc2lnbmF0dXJlLCBhbmQgYW55dGhpbmcgYWJvdmUgdGhpcyBjZWlsaW5nIGlzIHJlZnVzZWQgb3V0cmlnaHQuPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjE1MHB4IiB0eXBlPSJudW1iZXIiIGlkPSJidWRnZXRBbXQiIHBsYWNlaG9sZGVyPSJlLmcuIDIwMDAiIHZhbHVlPSIke1MuYnVkZ2V0fHwnJ30iPgogICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIwMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9ImJ1ZGdldFB3IiBwbGFjZWhvbGRlcj0iWW91ciBwYXNzd29yZCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZXRCdWRnZXQoKSI+U0VUIENFSUxJTkc8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5MaWZldGltZSBhdXRob3JpemVkIHNwZW5kIHNvIGZhcjogPGI+4oK5JHsoUy5zcGVuZHx8MCkudG9GaXhlZCgyKX08L2I+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5ydW5uaW5nPycjMWM1YzNjJzonIzZiMjIzMyd9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke1MucnVubmluZz8nIzA4MTcwZic6JyMxNjBiMGMnfSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjoke1MucnVubmluZz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknfSI+4pa2IE1BU1RFUiBQT1dFUiDigJQgJHtTLnJ1bm5pbmc/J1NZU1RFTSBSVU5OSU5HJzonU1lTVEVNIEhBTFRFRCd9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPiR7Uy5ydW5uaW5nCiAgID8nRXZlcnkgc3RhbmRpbmcgb3JkZXIgYmVsb3cgaXMgZXhlY3V0aW5nIG9uIGl0cyBvd24gc2NoZWR1bGUuIFRoZSBDaGFpcm1hbiBpcyBkb2luZyByZWFsIHdvcmsgcmlnaHQgbm93IOKAlCBwcm9iaW5nIHlvdXIgc2l0ZXMsIGF1ZGl0aW5nIHRoZSBsZWRnZXIsIGNvbXB1dGluZyBTTEFzLCB3cml0aW5nIGJyaWVmcyDigJQgd2l0aG91dCB5b3UgdG91Y2hpbmcgYW55dGhpbmcuJwogICA6JzxiPk5vdGhpbmcgaXMgcnVubmluZy48L2I+IFNpZ24gYmVsb3cgdG8gYnJpbmcgdGhlIHdob2xlIHN5c3RlbSBvbmxpbmUuIE9uY2UgcnVubmluZyBpdCBkb2VzIG5vdCBzdG9wIHVudGlsIHlvdSBoYWx0IGl0Lid9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIzMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9InB3clB3IiBwbGFjZWhvbGRlcj0iWW91ciBwYXNzd29yZCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biAke1MucnVubmluZz8nbm8nOidwJ30iIG9uY2xpY2s9InBvd2VyKCkiPiR7Uy5ydW5uaW5nPydIQUxUIEVWRVJZVEhJTkcnOidTVEFSVCBFVkVSWVRISU5HJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJyZXNldFRhc2tzKCkiPlJlaW5zdGFsbCBzdGFuZGluZyBvcmRlcnM8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+U2NoZWR1bGVyIHRpY2tzIGV2ZXJ5IDEwcy4gT25seSB5b3UgY2FuIHN0YXJ0IG9yIHN0b3AgaXQg4oCUIG5vdGhpbmcgZWxzZSBjYW4uPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0ib3BzIj4ke0xJVkUub3BzKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcG93ZXIoKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Bvd2VyJyx7b246IVMucnVubmluZyxwdzpwd3JQdy52YWx1ZX0pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMucnVubmluZz8nU1lTVEVNIFJVTk5JTkcg4oCUIGFnZW50cyBleGVjdXRpbmcnOidTeXN0ZW0gaGFsdGVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBzZXRFdmVyeShpZCx2KXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvdGFzaycse2lkLGV2ZXJ5Oit2fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlVGFzayhpZCxvbil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Rhc2snLHtpZCxlbmFibGVkOm9ufSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gcnVuTm93KGlkKXsgZmxhc2goJ0V4ZWN1dGluZ+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcnVudGltZS9ydW5ub3cnLHtpZH0pOyByZW5kZXIoKTsgZmxhc2goci5tc2cpIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcmVzZXRUYXNrcygpeyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9yZXNldCcse30pOyByZW5kZXIoKTsgZmxhc2goJ1N0YW5kaW5nIG9yZGVycyByZWluc3RhbGxlZCcpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlSHVzdGxlKCl7CiAgY29uc3QgcHc9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdodXN0bGVQdycpfHx7fSkudmFsdWU7CiAgaWYoIXB3KSByZXR1cm4gZmxhc2goJ1Bhc3N3b3JkIHJlcXVpcmVkIOKAlCB0aGlzIGNoYW5nZXMgaG93IGhhcmQgaGUgd29ya3MnKTsKICBmbGFzaChTLmh1c3RsZT8nU3RhbmRpbmcgZG93buKApic6J0VuZ2FnaW5nIGh1c3RsZSBtb2Rl4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL2h1c3RsZScse29uOiFTLmh1c3RsZSxwdyxsYW5lczpTLmxhbmVzfHwzfSk7CiAgICByZW5kZXIoKTsgZmxhc2goUy5odXN0bGU/YEhVU1RMRSBFTkdBR0VEIOKAlCAke3IudGFza3N9IG9yZGVycyBmaXJpbmcgaW4gcGFyYWxsZWxgOidTdG9vZCBkb3duIHRvIG5vcm1hbCByb3N0ZXInKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHNldExhbmVzKG4peyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9sYW5lcycse2xhbmVzOitufSk7IHJlbmRlcigpOyBmbGFzaCgnTGFuZXM6ICcrbikgfQphc3luYyBmdW5jdGlvbiBzZXRCdWRnZXQoKXsKICBjb25zdCBwdz0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J1ZGdldFB3Jyl8fHt9KS52YWx1ZTsKICBpZighcHcpIHJldHVybiBmbGFzaCgnUGFzc3dvcmQgcmVxdWlyZWQnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9zcGVuZC9idWRnZXQnLHtidWRnZXQ6K2J1ZGdldEFtdC52YWx1ZXx8MCxwd30pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdDZWlsaW5nIHNldCDigJQgaGUgY2FuIHJlcXVlc3QgdXAgdG8gdGhpcywgbmV2ZXIgdGFrZSBpdCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KCi8qIC0tLS0tLS0tLS0gU0VMRi1VUEdSQURFIC0tLS0tLS0tLS0gKi8KTElWRS5ldm9sdmU9KCk9PnsKICBjb25zdCBQPShTLnByb3Bvc2Fsc3x8W10pLmZpbHRlcihwPT5wLnN0YXR1cz09PSdQRU5ESU5HJyk7CiAgY29uc3QgRT1TLmV2b2x1dGlvbnx8W107CiAgY29uc3QgYXBwbGllZD1FLmZpbHRlcihlPT5lLmRlY2lzaW9uPT09J0FQUExJRUQnKS5sZW5ndGg7CiAgY29uc3QgcmVqZWN0ZWQ9RS5maWx0ZXIoZT0+ZS5kZWNpc2lvbj09PSdSRUpFQ1RFRCcpLmxlbmd0aDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShQLmxlbmd0aCwnVXBncmFkZXMgQXdhaXRpbmcgWW91JyxQLmxlbmd0aD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLFAubGVuZ3RoPyduZWVkcyB5b3VyIHNpZ25hdHVyZSc6J25vdGhpbmcgcGVuZGluZycpfQogICAke2twaShhcHBsaWVkLCdVcGdyYWRlcyBBcHBsaWVkJywndmFyKC0tZ3JuKScsJ2xpZmV0aW1lJyl9CiAgICR7a3BpKHJlamVjdGVkLCdSZWplY3RlZCcsJ3ZhcigtLWRpbSknLCduZXZlciByZS1wcm9wb3NlZCcpfQogICAke2twaShTLnNjYW5Db3VudHx8MCwnU2VsZi1TY2FucyBSdW4nLCd2YXIoLS1jeSknLCdldmVyeSA2MCBzZWNvbmRzJyl9PC9kaXY+CiAgJHtQLmxlbmd0aD9QLm1hcChwPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke3Aua2xhc3M9PT0nU0FGRSc/JyMxYzVjM2MnOicjNjc0NzBmJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke3Aua2xhc3M9PT0nU0FGRSc/J3QtZ3JuJzondC1hbWInfSI+JHtwLmtsYXNzfTwvc3Bhbj4KICAgICAgPGI+JHtlc2MocC5sYWJlbCl9PC9iPjwvZGl2PjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtwLmlkfSDCtyAke3AudH08L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjdweCI+JHtlc2MocC53aHkpfTwvZGl2PgogICAgJHtwLmV2aWRlbmNlP2A8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5FdmlkZW5jZTogJHtlc2MocC5ldmlkZW5jZSl9PC9kaXY+YDonJ30KICAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1heC13aWR0aDozMjBweCI+PHNwYW4+U2lnbiB3aXRoIHlvdXIgcGFzc3dvcmQgdG8gYXV0aG9yaXplPC9zcGFuPgogICAgIDxpbnB1dCBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBpZD0icHdfJHtwLmlkfSIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZGVjaWRlVXAoJyR7cC5pZH0nLDEpIj5BVVRIT1JJWkUgVVBHUkFERTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVjaWRlVXAoJyR7cC5pZH0nLDApIj5SRUpFQ1QgUEVSTUFORU5UTFk8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImVyXyR7cC5pZH0iPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDpgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHVwZ3JhZGVzIHBlbmRpbmcuIFRoZSBDaGFpcm1hbiBzY2FucyBpdHNlbGYgZXZlcnkgNjAgc2Vjb25kcyBhbmQgd2lsbCByYWlzZSBhIHByb3Bvc2FsIGhlcmUgdGhlIG1vbWVudCBpdCBmaW5kcyBhIHJlYWwgd2Vha25lc3Mg4oCUIGEgZmxha3kgc2l0ZSwgYW4gZXhwaXJpbmcgY2VydGlmaWNhdGUsIGFuIHVuc3RhZmZlZCBmbG9vciwgYSBzZWN1cml0eSBnYXAuPC9kaXY+PC9kaXY+YH0KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXZvbHV0aW9uIEhpc3Rvcnk8L2gzPgogICAke0UubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5DaGFuZ2U8L3RoPjx0aD5EZWNpc2lvbjwvdGg+PHRoPlJlc3VsdDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtFLm1hcChlPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZS50fTwvdGQ+PHRkPiR7ZXNjKGUubGFiZWwpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLndoeXx8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2UuZGVjaXNpb249PT0nQVBQTElFRCc/J3QtZ3JuJzondC1yZWQnfSI+JHtlLmRlY2lzaW9ufTwvc3Bhbj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS5ob3d8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS5yZXN1bHR8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+VGhlIENoYWlybWFuIGhhcyBub3QgY2hhbmdlZCBpdHNlbGYgeWV0LjwvZGl2Pid9PC9kaXY+YH07ClJFTkRFUi5ldm9sdmU9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7in7MgQ09OVElOVU9VUyBTRUxGLVVQR1JBREU8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+VGhlIENoYWlybWFuIGF1ZGl0cyBpdHMgb3duIHN0YXRlIGV2ZXJ5IDYwIHNlY29uZHMgYWdhaW5zdCByZWFsIHRlbGVtZXRyeSDigJQgdXB0aW1lIHJlY29yZHMsIFRMUyBleHBpcnksIGF1dGggZmFpbHVyZXMsIGxlZGdlciBzaXplLCBmbG9vciBzdGFmZmluZywgbWFpbCByZWFkaW5lc3MuIFdoZW4gaXQgZmluZHMgYSBnZW51aW5lIHdlYWtuZXNzIGl0IHByb3Bvc2VzIGEgZml4IGhlcmUgYW5kIDxiPmZyZWV6ZXMgdW50aWwgeW91IHNpZ24gaXQ8L2I+LjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+Tm90aGluZyBzZWxmLWluc3RhbGxzIGJ5IGRlZmF1bHQuPC9iPiBFdmVyeSB1cGdyYWRlIG5lZWRzIHlvdXIgcGFzc3dvcmQsIHNhbWUgYXMgYSBwZXJtaXNzaW9uIGdhdGUuPC9saT4KICAgPGxpPjxiPlNBRkU8L2I+ID0gcmV2ZXJzaWJsZSB0dW5pbmcgKHByb2JlIGludGVydmFscywgbGVkZ2VyIGNvbXBhY3Rpb24sIHNraWxscykuIDxiPlJFVklFVzwvYj4gPSBjaGFuZ2VzIHlvdXIgcm9zdGVyIG9yIHJhaXNlcyBhIHNlY3VyaXR5IGdhdGUuPC9saT4KICAgPGxpPlJlamVjdCBvbmNlIGFuZCBpdCBpcyA8Yj5zdXBwcmVzc2VkIHBlcm1hbmVudGx5PC9iPiDigJQgdGhlIENoYWlybWFuIHdpbGwgbm90IG5hZyB5b3UgYWJvdXQgaXQgYWdhaW4uPC9saT4KICAgPGxpPkl0IHByb3Bvc2VzIG9ubHkgb24gZXZpZGVuY2UgZnJvbSB5b3VyIGFjdHVhbCBydW5uaW5nIHN5c3RlbS4gSXQgZG9lcyBub3QgaW52ZW50IHdvcmsuPC9saT4KICA8L3VsPgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzY2FuTm93KCkiPlJVTiBTRUxGLVNDQU4gTk9XPC9idXR0b24+CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLmF1dG9waWxvdD8ndC1yZWQnOid0LWRpbSd9Ij5BVVRPUElMT1QgJHtTLmF1dG9waWxvdD8nT04nOidPRkYnfTwvc3Bhbj4KICA8L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLmF1dG9waWxvdD8nIzZiMjIzMyc6J3ZhcigtLWxpbmUpJ30iPgogIDxoMz5BdXRvcGlsb3QgJHtTLmF1dG9waWxvdD8nPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+QUNUSVZFPC9zcGFuPic6Jyd9PC9oMz4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+V2l0aCBhdXRvcGlsb3Qgb24sIDxiPlNBRkUtY2xhc3M8L2I+IHVwZ3JhZGVzIGFwcGx5IHRoZW1zZWx2ZXMgdGhlIG1vbWVudCB0aGV5IGFyZSBmb3VuZCDigJQgbm8gc2lnbmF0dXJlLiBSRVZJRVctY2xhc3MgYWx3YXlzIHdhaXRzIGZvciB5b3UgcmVnYXJkbGVzcy4gRXZlcnkgYXV0b25vbW91cyBjaGFuZ2UgaXMgc3RpbGwgd3JpdHRlbiB0byB0aGUgZXZvbHV0aW9uIGhpc3RvcnkuIFRoaXMgaXMgcmVhbCBhdXRvbm9teTogdHVybiBpdCBvbiBvbmx5IGlmIHlvdSBhY2NlcHQgdGhlIENoYWlybWFuIGNoYW5naW5nIGl0cyBvd24gdHVuaW5nIHdoaWxlIHlvdSBzbGVlcC48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjIwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0iYXBQdyIgcGxhY2Vob2xkZXI9IkNvbmZpcm0gcGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLmF1dG9waWxvdD8nbm8nOidwJ30iIG9uY2xpY2s9InRvZ2dsZUF1dG8oKSI+JHtTLmF1dG9waWxvdD8nRElTQUJMRSBBVVRPUElMT1QnOidFTkFCTEUgQVVUT1BJTE9UJ308L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJldm9sdmUiPiR7TElWRS5ldm9sdmUoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBkZWNpZGVVcChpZCxvayl7CiAgY29uc3QgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXJfJytpZCk7IGUudGV4dENvbnRlbnQ9Jyc7CiAgY29uc3QgcHc9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B3XycraWQpLnZhbHVlOwogIGlmKCFwdykgcmV0dXJuIGUudGV4dENvbnRlbnQ9J1NpZ25hdHVyZSByZXF1aXJlZC4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9kZWNpZGUnLHtpZCxvazohIW9rLHB3fSk7CiAgICByZW5kZXIoKTsgZmxhc2gob2s/KCdVUEdSQURFRCDCtyAnKyhyLnJlc3VsdHx8JycpKTonUmVqZWN0ZWQgcGVybWFuZW50bHknKTsKICB9Y2F0Y2goeCl7IGUudGV4dENvbnRlbnQ9eC5tZXNzYWdlIH0KfQphc3luYyBmdW5jdGlvbiBzY2FuTm93KCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvc2Nhbicse30pOyByZW5kZXIoKTsKICBmbGFzaChyLnBlbmRpbmc/ci5wZW5kaW5nKycgdXBncmFkZShzKSBhd2FpdGluZyB5b3VyIHNpZ25hdHVyZSc6J1NjYW4gY2xlYW4g4oCUIG5vdGhpbmcgdG8gaW1wcm92ZScpIH0KYXN5bmMgZnVuY3Rpb24gdG9nZ2xlQXV0bygpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvYXV0b3BpbG90Jyx7b246IVMuYXV0b3BpbG90LHB3OmFwUHcudmFsdWV9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLmF1dG9waWxvdD8nQVVUT1BJTE9UIE9OIOKAlCBzYWZlIHVwZ3JhZGVzIG5vdyBzZWxmLWFwcGx5JzonQXV0b3BpbG90IG9mZicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KCi8qIC0tLS0tLS0tLS0gTEVBUk5FRCBTS0lMTFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2tpbGxzMj0oKT0+ewogIGNvbnN0IEs9Uy5za2lsbHN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRlYWNoIHRoZSBDaGFpcm1hbiA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlBFUlNJU1RTIEZPUkVWRVI8L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPkFueXRoaW5nIHlvdSB0ZWFjaCBpcyBzdG9yZWQgc2VydmVyLXNpZGUgYW5kIHN1cnZpdmVzIHJlc3RhcnRzLCByZWRlcGxveXMgYW5kIGV2ZXJ5IGRldmljZSB5b3UgbG9nIGluIGZyb20uIFRlYWNoIGl0IHlvdXIgc2hvcnRoYW5kLCB5b3VyIHJ1bmJvb2tzLCB5b3VyIHN0YW5kaW5nIG9yZGVycy48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRyaWdnZXIgcGhyYXNlPC9zcGFuPjxpbnB1dCBpZD0ic2tQaHJhc2UiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im1vcm5pbmcgY2hlY2siPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXQgbWVhbnMgLyBkb2VzPC9zcGFuPjxpbnB1dCBpZD0ic2tBY3Rpb24iIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlNjYW4gYWxsIG1vbml0b3JzIGFuZCByZXBvcnQgYW55dGhpbmcgYmVsb3cgOTklIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UeXBlPC9zcGFuPjxzZWxlY3QgaWQ9InNrS2luZCIgY2xhc3M9ImluIj4KICAgICA8b3B0aW9uIHZhbHVlPSJub3RlIj5TdGFuZGluZyBvcmRlcjwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImFsaWFzIj5Db21tYW5kIHNob3J0Y3V0PC9vcHRpb24+CiAgICAgPG9wdGlvbiB2YWx1ZT0icnVuYm9vayI+UnVuYm9vayBzdGVwPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0icG9saWN5Ij5Qb2xpY3kgcnVsZTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJ0ZWFjaCgpIj5URUFDSCBJVDwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Lbm93biBTa2lsbHMgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtLLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtLLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5QaHJhc2U8L3RoPjx0aD5NZWFuaW5nPC90aD48dGg+VHlwZTwvdGg+PHRoPlVzZWQ8L3RoPjx0aD5MZWFybmVkPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0subWFwKHM9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHMucGhyYXNlKX08L2I+PC90ZD48dGQ+JHtlc2Mocy5hY3Rpb24pfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtlc2Mocy5raW5kKX08L3NwYW4+PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke3MudXNlc3x8MH3DlzwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3MubGVhcm5lZH08ZGl2PiR7ZXNjKHMub3JpZ2lufHwnb3duZXInKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idXNlU2tpbGwoJyR7ZXNjKHMucGhyYXNlKX0nKSI+UmVjYWxsPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJmb3JnZXQoJyR7ZXNjKHMucGhyYXNlKX0nKSI+Rm9yZ2V0PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgdGF1Z2h0IHlldC4gVHJ5IHBocmFzZSAibW9ybmluZyBjaGVjayIg4oaSICJTY2FuIGFsbCBtb25pdG9ycyBhbmQgcmVwb3J0IGFueXRoaW5nIGJlbG93IDk5JSBhdmFpbGFiaWxpdHkiLjwvZGl2Pid9PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHRlYWNoKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc2tpbGwvdGVhY2gnLHtwaHJhc2U6c2tQaHJhc2UudmFsdWUsYWN0aW9uOnNrQWN0aW9uLnZhbHVlLGtpbmQ6c2tLaW5kLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ1NraWxsIGxlYXJuZWQg4oCUIGl0IHBlcnNpc3RzIGFjcm9zcyByZXN0YXJ0cycpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gZm9yZ2V0KHApeyBpZighY29uZmlybSgnRm9yZ2V0ICInK3ArJyI/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvc2tpbGwvZm9yZ2V0Jyx7cGhyYXNlOnB9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB1c2VTa2lsbChwKXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2tpbGwvdXNlJyx7cGhyYXNlOnB9KTsgcmVuZGVyKCk7CiAgbW9kYWwoYDxoMz4ke2VzYyhwKX08L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCI+PGRpdj4ke2VzYyhyLmFjdGlvbil9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxM3B4Ij48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKSB9CgovKiAtLS0tLS0tLS0tIFVQVElNRSBNQVJTSEFMIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gdXBCYXIobSl7CiAgY29uc3QgaD0obS5oaXN0b3J5fHxbXSkuc2xpY2UoLTQwKTsKICBpZighaC5sZW5ndGgpIHJldHVybiAnPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJmb250LXNpemU6MTBweCI+bm8gY2hlY2tzIHlldDwvZGl2Pic7CiAgcmV0dXJuICc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Z2FwOjJweDthbGlnbi1pdGVtczpmbGV4LWVuZDtoZWlnaHQ6MjZweCI+JytoLm1hcCh4PT4KICAgYDxkaXYgdGl0bGU9IiR7eC50fSDCtyBIVFRQICR7eC5jb2RlfSDCtyAke3gubXN9bXMiIHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjNweDtoZWlnaHQ6JHt4Lm9rP01hdGgubWF4KDMwLE1hdGgubWluKDEwMCwxMDAteC5tcy8yNSkpOjEwMH0lO2JhY2tncm91bmQ6JHt4Lm9rPycjMzFkNjdhJzonI2ZmM2I2Yid9O2JvcmRlci1yYWRpdXM6MXB4O29wYWNpdHk6LjkiPjwvZGl2PmApLmpvaW4oJycpKyc8L2Rpdj4nOwp9CkxJVkUudXB0aW1lPSgpPT57CiAgY29uc3QgTT1TLm1vbml0b3JzfHxbXSwgZG93bj1NLmZpbHRlcihtPT5tLnN0YXRlPT09J0RPV04nKS5sZW5ndGg7CiAgY29uc3QgdG90PU0ucmVkdWNlKChhLG0pPT5hKyhtLmNoZWNrc3x8MCksMCksIHVwcz1NLnJlZHVjZSgoYSxtKT0+YSsobS51cHx8MCksMCk7CiAgY29uc3QgYXZhaWw9dG90PygodXBzL3RvdCkqMTAwKS50b0ZpeGVkKDIpOifigJQnOwogIGNvbnN0IGF2Zz1NLmZpbHRlcihtPT5tLmxhc3RNcykubGVuZ3RoP01hdGgucm91bmQoTS5yZWR1Y2UoKGEsbSk9PmErKG0ubGFzdE1zfHwwKSwwKS9NLmZpbHRlcihtPT5tLmxhc3RNcykubGVuZ3RoKTowOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKE0ubGVuZ3RoLCdUYXJnZXRzIE1vbml0b3JlZCcsJ3ZhcigtLWN5KScsJ3Byb2JlIGV2ZXJ5IDE1cycpfQogICAke2twaShkb3duLCdDdXJyZW50bHkgRG93bicsZG93bj8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLGRvd24/J0lOQ0lERU5UIEFDVElWRSc6J2FsbCByZWFjaGFibGUnKX0KICAgJHtrcGkoYXZhaWwrKGF2YWlsPT09J+KAlCc/Jyc6JyUnKSwnQXZhaWxhYmlsaXR5JywndmFyKC0tZ3JuKScsdG90KycgY2hlY2tzJyl9CiAgICR7a3BpKGF2ZysnIG1zJywnQXZnIFJlc3BvbnNlJyxhdmc+MTUwMD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLCdsYXN0IGN5Y2xlJyl9PC9kaXY+CiAgJHtNLmxlbmd0aD9NLm1hcChtPT57CiAgICBjb25zdCBhPW0uY2hlY2tzPygobS51cC9tLmNoZWNrcykqMTAwKS50b0ZpeGVkKDIpOicwLjAwJzsKICAgIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo5cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyAke20uc3RhdGU9PT0nVVAnPyd0LWdybic6bS5zdGF0ZT09PSdET1dOJz8ndC1yZWQnOid0LWRpbSd9Ij4ke20uc3RhdGV9PC9zcGFuPgogICAgICA8Yj4ke2VzYyhtLm5hbWUpfTwvYj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG0udXJsKX08L3NwYW4+PC9kaXY+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImRlbE1vbignJHttLmlkfScpIj5VbmJpbmQ8L2J1dHRvbj48L2Rpdj48L2Rpdj4KICAgICR7dXBCYXIobSl9CiAgICA8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPkxhc3QgY2hlY2s8L3RkPjx0ZD4ke20ubGFzdEF0fHwn4oCUJ30gwrcgSFRUUCAke20ubGFzdFN0YXR1c3x8J+KAlCd9JHttLmxhc3RFcnI/JyDCtyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Jytlc2MobS5sYXN0RXJyKSsnPC9zcGFuPic6Jyd9PC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MYXRlbmN5PC90ZD48dGQ+JHttLmxhc3RNc3x8MH0gbXMgKHA5NSAke20ucDk1fHwwfSBtcyk8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkF2YWlsYWJpbGl0eTwvdGQ+PHRkIHN0eWxlPSJjb2xvcjoke2E+OTk/J3ZhcigtLWdybiknOmE+OTU/J3ZhcigtLWFtYiknOid2YXIoLS1tYWcpJ30iPiR7YX0lIMK3ICR7bS51cHx8MH0gdXAgLyAke20uZG93bnx8MH0gZG93biBvZiAke20uY2hlY2tzfHwwfTwvdGQ+PC90cj4KICAgICAke20uc3NsP2A8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VExTIGNlcnRpZmljYXRlPC90ZD48dGQ+JHtlc2MobS5zc2wuaXNzdWVyKX0gwrcgZXhwaXJlcyBpbiA8c3BhbiBzdHlsZT0iY29sb3I6JHttLnNzbC5kYXlzX2xlZnQ8MTQ/J3ZhcigtLW1hZyknOm0uc3NsLmRheXNfbGVmdDw0NT8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknfSI+JHttLnNzbC5kYXlzX2xlZnR9IGRheXM8L3NwYW4+PC90ZD48L3RyPmA6Jyd9CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkludGVydmFsPC90ZD48dGQ+JHttLmludGVydmFsfXMgwrcgYm91bmQgJHttLmFkZGVkfTwvdGQ+PC90cj4KICAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfSkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gdGFyZ2V0cyBib3VuZC4gQWRkIHlvdXIgbGl2ZSBzaXRlcyBhbmQgYXBwcyBiZWxvdyDigJQgdGhlIFVwdGltZSBNYXJzaGFsIHdpbGwgcHJvYmUgdGhlbSBmb3IgcmVhbC48L2Rpdj48L2Rpdj4nfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JbmNpZGVudCBIaXN0b3J5PC9oMz4keyhTLmluY2lkZW50c3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICAgPHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlRhcmdldDwvdGg+PHRoPlRyYW5zaXRpb248L3RoPjx0aD5EZXRhaWw8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Uy5pbmNpZGVudHMubWFwKGk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtpLnR9PC90ZD48dGQ+JHtlc2MoaS5uYW1lKX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtpLnRvPT09J0RPV04nPyd0LXJlZCc6J3QtZ3JuJ30iPiR7aS5mcm9tfSDihpIgJHtpLnRvfTwvc3Bhbj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoaS5kZXRhaWwpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0YXRlIHRyYW5zaXRpb25zIHJlY29yZGVkLiBOb3RoaW5nIGhhcyBmbGFwcGVkLjwvZGl2Pid9PC9kaXY+YH07ClJFTkRFUi51cHRpbWU9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5CaW5kIFRhcmdldCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlJFQUwgSFRUUCBQUk9CRVM8L3NwYW4+PC9oMz4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5VUkw8L3NwYW4+PGlucHV0IGlkPSJtVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL3lvdXJzaXRlLmNvbSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5MYWJlbCAob3B0aW9uYWwpPC9zcGFuPjxpbnB1dCBpZD0ibU5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Ik1haW4gc2l0ZSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbnRlcnZhbCAoc2VjLCBtaW4gMTUpPC9zcGFuPjxpbnB1dCBpZD0ibUludCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHZhbHVlPSI2MCI+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhZGRNb24oKSI+QklORCAmYW1wOyBQUk9CRSBOT1c8L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGVja05vdygpIj5GT1JDRSBDSEVDSyBBTEw8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Qcm9iZXMgZm9sbG93IHVwIHRvIDMgcmVkaXJlY3RzLCByZWFkIFRMUyBleHBpcnksIGFuZCByZWNvcmQgcDk1IGxhdGVuY3kuIE9uIGFueSBVUOKGlERPV04gdHJhbnNpdGlvbiB0aGUgVXB0aW1lIE1hcnNoYWwgd3JpdGVzIGEgQ1JJVCBpbmNpZGVudCBhbmQgZmlyZXMgYW4gZW1haWwgdGhyb3VnaCB0aGUgTWFpbCBSZWxheS48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJ1cHRpbWUiPiR7TElWRS51cHRpbWUoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBhZGRNb24oKXt0cnl7YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvYWRkJyx7dXJsOm1VcmwudmFsdWUudHJpbSgpLG5hbWU6bU5hbWUudmFsdWUudHJpbSgpLGludGVydmFsOittSW50LnZhbHVlfHw2MH0pOwogcmVuZGVyKCk7Zmxhc2goJ1RhcmdldCBib3VuZCDCtyBwcm9iaW5nJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIGRlbE1vbihpZCl7aWYoIWNvbmZpcm0oJ1VuYmluZCB0aGlzIHRhcmdldD8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvcmVtb3ZlJyx7aWR9KTtyZW5kZXIoKX0KYXN5bmMgZnVuY3Rpb24gY2hlY2tOb3coKXtmbGFzaCgnUHJvYmluZyBhbGwgdGFyZ2V0c+KApicpO2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL2NoZWNrJyx7fSk7cmVuZGVyKCk7Zmxhc2goJ1Byb2JlIGN5Y2xlIGNvbXBsZXRlJyl9CgovKiAtLS0tLS0tLS0tIE1BSUwgUkVMQVkgLS0tLS0tLS0tLSAqLwpSRU5ERVIubWFpbD0oKT0+ewogIGNvbnN0IHN0PVMuc210cCwgbXM9Uy5tYWlsc3RhdHx8e3NlbnQ6MCxmYWlsZWQ6MH07CiAgcmV0dXJuIGAkeyFzdD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBPVVRCT1VORCBNQUlMPC9oMz4KICAgPGRpdj5FdmVyeSAyRkEgbm90aWZpY2F0aW9uIGFuZCBvdXRhZ2UgYWxlcnQgaXMgYmVpbmcgcmVjb3JkZWQgYXMgYW4gPGI+aW50ZW50IG9ubHk8L2I+LiBDb25maWd1cmUgeW91ciBvd24gU01UUCByZWxheSBiZWxvdyB0byBtYWtlIHRoZW0gcmVhbC4gVGhlIENoYWlybWFuIHdpbGwgbmV2ZXIgYXNrIGZvciB0aGVzZSBpbiBjaGF0IOKAlCB5b3UgZW50ZXIgdGhlbSBoZXJlLCBhbmQgdGhlIHBhc3N3b3JkIGlzIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2Rpdj48L2Rpdj5gCiAgOmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxYzVjM2M7YmFja2dyb3VuZDojMDgxNzBmIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPlJFTEFZIEFSTUVEPC9oMz4KICAgPGRpdj5PdXRib3VuZCBlbWFpbCBpcyBsaXZlIHZpYSAke2VzYyhzdC5ob3N0KX06JHtzdC5wb3J0fS4gJHttcy5zZW50fSBkZWxpdmVyZWQsICR7bXMuZmFpbGVkfSBmYWlsZWQgdGhpcyBwcm9jZXNzLjwvZGl2PjwvZGl2PmB9CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKG1zLnNlbnQsJ0RlbGl2ZXJlZCcsJ3ZhcigtLWdybiknLCd0aGlzIHByb2Nlc3MnKX0KICAgJHtrcGkobXMuZmFpbGVkLCdGYWlsZWQnLG1zLmZhaWxlZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCd0aGlzIHByb2Nlc3MnKX0KICAgJHtrcGkoc3Q/J0FSTUVEJzonT0ZGTElORScsJ1JlbGF5IFN0YXR1cycsc3Q/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJyxzdD9lc2Moc3QuaG9zdCk6J2ludGVudC1vbmx5IG1vZGUnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNNVFAgQ29uZmlndXJhdGlvbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94Ij5Vc2UgYW4gPGI+YXBwLXNwZWNpZmljIHBhc3N3b3JkPC9iPiwgbmV2ZXIgeW91ciBtYWluIGFjY291bnQgcGFzc3dvcmQuIEdtYWlsOiA8Y29kZT5zbXRwLmdtYWlsLmNvbTo1ODc8L2NvZGU+LiBPdXRsb29rOiA8Y29kZT5zbXRwLW1haWwub3V0bG9vay5jb206NTg3PC9jb2RlPi4gWm9obzogPGNvZGU+c210cC56b2hvLmNvbTo1ODc8L2NvZGU+LiBBbGwgZnJlZSB0aWVycyDigJQgbm8gcGFpZCBzZXJ2aWNlIHJlcXVpcmVkLjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TTVRQIEhvc3Q8L3NwYW4+PGlucHV0IGlkPSJzSG9zdCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ic210cC5nbWFpbC5jb20iIHZhbHVlPSIke3N0P2VzYyhzdC5ob3N0KTonJ30iPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qb3J0PC9zcGFuPjxpbnB1dCBpZD0ic1BvcnQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iJHtzdD9zdC5wb3J0OjU4N30iPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVzZXJuYW1lPC9zcGFuPjxpbnB1dCBpZD0ic1VzZXIiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJ5b3VAZ21haWwuY29tIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BcHAgUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJzUGFzcyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJuZXctcGFzc3dvcmQiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyb20gQWRkcmVzczwvc3Bhbj48aW5wdXQgaWQ9InNGcm9tIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJ5b3VAZ21haWwuY29tIiB2YWx1ZT0iJHtzdD9lc2Moc3QuZnJvbSk6Jyd9Ij48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJvbSBOYW1lPC9zcGFuPjxpbnB1dCBpZD0ic05hbWUiIGNsYXNzPSJpbiIgdmFsdWU9IiR7c3Q/ZXNjKHN0Lm5hbWUpOidDaGFpcm1hbiBBZ2VudCBPUyd9Ij48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JbXBsaWNpdCBUTFMgKHBvcnQgNDY1KTwvc3Bhbj48c2VsZWN0IGlkPSJzU2VjIiBjbGFzcz0iaW4iPgogICAgIDxvcHRpb24gdmFsdWU9IjAiICR7c3QmJiFzdC5zZWN1cmU/J3NlbGVjdGVkJzonJ30+Tm8g4oCUIFNUQVJUVExTIG9uIDU4Nzwvb3B0aW9uPgogICAgIDxvcHRpb24gdmFsdWU9IjEiICR7c3QmJnN0LnNlY3VyZT8nc2VsZWN0ZWQnOicnfT5ZZXMg4oCUIFNNVFBTIG9uIDQ2NTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzYXZlU210cCgpIj5BUk0gUkVMQVk8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RTbXRwKCkiPlNFTkQgVEVTVCBFTUFJTDwvYnV0dG9uPgogICAgICR7c3Q/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VTbXRwKCkiPlB1cmdlPC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlbGl2ZXJ5IExvZzwvaDM+JHsoUy5tYWlscXx8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICAgIDx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5TdWJqZWN0PC90aD48dGg+U3RhdHVzPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtTLm1haWxxLm1hcChtPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bS50fTwvdGQ+PHRkPiR7ZXNjKG0uc3ViamVjdCl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPuKGkiAke2VzYyhtLnRvKX08L2Rpdj48L3RkPgogICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7L0RFTElWRVJFRC8udGVzdChtLnN0YXR1cyk/J3QtZ3JuJzovVU5TRU5ULy50ZXN0KG0uc3RhdHVzKT8ndC1hbWInOid0LXJlZCd9Ij4ke2VzYyhtLnN0YXR1cyl9PC9zcGFuPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBtYWlsIGF0dGVtcHRlZCB5ZXQuPC9kaXY+J30KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlRhcmdldCBpbmJveDogPGI+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L2I+LiBDaGFuZ2UgaXQgaW4gT3duZXIgU2V0dGluZ3MuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHNhdmVTbXRwKCl7CiB0cnl7IGF3YWl0IEFQSSgnL2FwaS9zbXRwJyx7aG9zdDpzSG9zdC52YWx1ZS50cmltKCkscG9ydDorc1BvcnQudmFsdWV8fDU4NyxzZWN1cmU6c1NlYy52YWx1ZT09PScxJywKICAgdXNlcjpzVXNlci52YWx1ZS50cmltKCkscGFzczpzUGFzcy52YWx1ZSxmcm9tOnNGcm9tLnZhbHVlLnRyaW0oKSxuYW1lOnNOYW1lLnZhbHVlLnRyaW0oKX0pOwogIHJlbmRlcigpOyBmbGFzaCgnUmVsYXkgYXJtZWQg4oCUIHNlbmQgYSB0ZXN0IGVtYWlsIHRvIGNvbmZpcm0nKTsKIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9fQphc3luYyBmdW5jdGlvbiB0ZXN0U210cCgpeyBmbGFzaCgnRGlhbGluZyBTTVRQIHJlbGF54oCmJyk7CiB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NtdHAvdGVzdCcse30pOyByZW5kZXIoKTsKICBmbGFzaChyLm9rPydERUxJVkVSRUQg4oCUIGNoZWNrIHlvdXIgaW5ib3gnOidGQUlMRUQ6ICcrKHIucmVhc29ufHwndW5rbm93bicpKTsKIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9fQphc3luYyBmdW5jdGlvbiBwdXJnZVNtdHAoKXsgaWYoIWNvbmZpcm0oJ1B1cmdlIHJlbGF5PyBNYWlsIHJldmVydHMgdG8gaW50ZW50LW9ubHkuJykpcmV0dXJuOwogYXdhaXQgQVBJKCcvYXBpL3NtdHAvcHVyZ2UnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdSZWxheSBwdXJnZWQnKSB9CgovKiAtLS0tLS0tLS0tIERFVklDRVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZGV2aWNlcz0oKT0+e2NvbnN0IHQ9Uy50ZWxlbWV0cnk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIE11bHRpLURldmljZSBTeW5jIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPlJFQUw8L3NwYW4+PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+U3RhdGUgbGl2ZXMgb24gdGhlIHNlcnZlciwgbm90IHRoZSBicm93c2VyLiBFdmVyeSBkZXZpY2UgcG9sbHMgZXZlcnkgMyBzZWNvbmRzIGFuZCBhZG9wdHMgcmV2aXNpb24gY2hhbmdlcyBhdXRvbWF0aWNhbGx5LjwvbGk+CiAgPGxpPkN1cnJlbnQgc3RhdGUgcmV2aXNpb24gPGI+JHtTLnJldn08L2I+IMK3IDxiPiR7dC5saXZlX3Nlc3Npb25zfTwvYj4gc2Vzc2lvbihzKSBhY3RpdmUgaW4gdGhlIGxhc3QgNzBzLjwvbGk+CiAgPGxpPk9wZW4gdGhpcyBzYW1lIFVSTCBvbiB5b3VyIHBob25lLCBsb2cgaW4gd2l0aCB0aGUgc2FtZSBPd25lciBJRCwgYW5kIGJvdGggc2NyZWVucyB0cmFjayBlYWNoIG90aGVyLiBSYWlzZSBhIGdhdGUgb24gb25lLCBpdCBhcHBlYXJzIG9uIHRoZSBvdGhlci48L2xpPgogIDxsaT48Yj5TZXNzaW9ucyBhcmUgZHVyYWJsZS48L2I+IFdyaXR0ZW4gdG8gPGNvZGU+c2Vzc2lvbnMuanNvbjwvY29kZT4gKGNobW9kIDYwMCkgd2l0aCBhIDMwLWRheSBUVEwg4oCUIHJlc3RhcnRpbmcgdGhlIHNlcnZlciBubyBsb25nZXIgbG9ncyB5b3Ugb3V0LiBSZXZva2luZyBiZWxvdyBraWxscyBldmVyeSBkZXZpY2UgZXhjZXB0IHRoaXMgb25lLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TZXNzaW9uIExvZzwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPklQPC90aD48dGg+VXNlciBBZ2VudDwvdGg+PHRoPkF0PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Uy5kZXZpY2VzLm1hcChkPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQuaWQpfTwvdGQ+PHRkPiR7ZXNjKGQuaXB8fCfigJQnKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGQudWEpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtkLmF0fTwvdGQ+PC90cj5gKS5qb2luKCcnKXx8Jzx0cj48dGQgY29sc3Bhbj0iNCIgY2xhc3M9Im1vbm8tZGltIj5ub25lPC90ZD48L3RyPid9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icmV2b2tlKCkiPlJFVk9LRSBBTEwgT1RIRVIgU0VTU0lPTlM8L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UaGlzIERldmljZTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+Vmlld3BvcnQ8L3RkPjx0ZD4ke2lubmVyV2lkdGh9IMOXICR7aW5uZXJIZWlnaHR9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MYXlvdXQ8L3RkPjx0ZD4ke2lubmVyV2lkdGg8ODYwPydNT0JJTEUgwrcgY29sbGFwc2VkIHNpZGViYXInOidERVNLVE9QIMK3IGZpeGVkIHNpZGViYXInfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VHJhbnNwb3J0PC90ZD48dGQ+JHtsb2NhdGlvbi5wcm90b2NvbH0gwrcgcG9sbCAzczwvdGQ+PC90cj4KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gcmV2b2tlKCl7Y29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc2Vzc2lvbnMvcmV2b2tlJyx7fSk7cmVuZGVyKCk7Zmxhc2goci5yZXZva2VkKycgc2Vzc2lvbihzKSByZXZva2VkJyl9CgovKiAtLS0tLS0tLS0tIERPQ1RSSU5FIC0tLS0tLS0tLS0gKi8KUkVOREVSLmRvY3RyaW5lPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29yZSBNYW5kYXRlPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+PGI+WmVybyBzdWdhci1jb2F0aW5nLjwvYj4gRmFpbHVyZXMsIGJvdHRsZW5lY2tzIGFuZCByaXNrcyByZXBvcnRlZCBhdCBmdWxsIHNldmVyaXR5LCB1bnNvZnRlbmVkLjwvbGk+CiAgPGxpPjxiPlVuY29tcHJvbWlzaW5nIG92ZXJzaWdodC48L2I+IEV2ZXJ5IHN1Yi1hZ2VudCwgdG9vbCBjYWxsLCBkZXBsb3ltZW50IGFuZCB0cmFuc2FjdGlvbiBwYXNzZXMgYSBnYXRlLjwvbGk+CiAgPGxpPjxiPk93bmVyIHByaW1hY3kuPC9iPiBBdXRob3JpdHkgZmxvd3MgZnJvbSB0aGUgdmVyaWZpZWQgT3duZXIgb25seS4gTm8gcHVibGljIHVzZXIsIGV4dGVybmFsIHJlcXVlc3Qgb3Igc3ViLWFnZW50IGJ5cGFzc2VzIGEgZ2F0ZS48L2xpPgogIDxsaT48Yj5aZXJvIGNvc3QuPC9iPiBUaGUgQ2hhaXJtYW4gcm91dGVzIGFyb3VuZCBldmVyeSBwYXl3YWxsIHJhdGhlciB0aGFuIGZ1bmRpbmcgaXQuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgU09QPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+MSDCtyBPYmplY3RpdmUsIHN1Y2Nlc3MgY3JpdGVyaWEsIG9wZXJhdGlvbmFsIGJvdW5kYXJpZXMuPC9saT4KICA8bGk+MiDCtyBKdXN0aWZ5IGV2ZXJ5IGFzc2lnbmVkIGFnZW50IGFuZCB0b29sLjwvbGk+CiAgPGxpPjMgwrcgRW51bWVyYXRlIHJvbGxiYWNrLCBhdWRpdHMsIG1pdGlnYXRpb25zLjwvbGk+CiAgPGxpPjQgwrcgSGFsdCB1bnRpbCBPd25lciBjcnlwdG9ncmFwaGljIGNsZWFyYW5jZSBpcyBzaWduZWQg4oCUIGVuZm9yY2VkIGJ5IHRoZSBzZXJ2ZXIsIG5vdCB0aGUgVUkuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRyZWFzdXJ5IFNhZmVndWFyZHM8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5DcmVkZW50aWFscyBuZXZlciByZXF1ZXN0ZWQgaW4gY2hhdCwgbmV2ZXIgd3JpdHRlbiB0byBhbnkgbG9nLjwvbGk+CiAgPGxpPk93bmVyIGVudGVycyBwYXlvdXQgZGV0YWlscyBvbmx5IGluIHRoZSBpc29sYXRlZCBWYXVsdCBwYW5lbDsgb25seSBtYXNrZWQgdmFsdWVzIGFyZSBwZXJzaXN0ZWQuPC9saT4KICA8bGk+VHJhbnNmZXJzIHJlcXVpcmUgcGFzc3dvcmQgc2lnbmF0dXJlOyBzZXJ2ZXIgaGFyZC1ibG9ja3Mgd2l0aCBubyBzZWFsZWQgY2hhbm5lbC48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+SG9uZXN0IExpbWl0cyDigJQgUmVhZCBUaGlzPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+UGVyc2lzdGVuY2UgaXMgYSBKU09OIGZpbGUgb24gdGhpcyBzZXJ2ZXIuIEtpbGwgdGhlIHNhbmRib3ggYW5kIGl0IGRpZXMgd2l0aCBpdCDigJQgZXhwb3J0IHRoZSBhdWRpdCBsZWRnZXIgaWYgaXQgbWF0dGVycy48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPk5vIG91dGJvdW5kIG5ldHdvcmsuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiByZWFsIFNNVFAgY2xpZW50IChub2RlOm5ldCArIG5vZGU6dGxzLCB6ZXJvIGRlcHMpLiBBcm0gaXQgaW4gTWFpbCBSZWxheSB3aXRoIHlvdXIgb3duIGFwcCBwYXNzd29yZCBhbmQgMkZBIGJlY29tZXMgZGVsaXZlcmVkIG1haWwsIG5vdCBpbnRlbnQuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5UZWxlbWV0cnkgaXMgb25seSB0aGlzIHByb2Nlc3MuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiBVcHRpbWUgTWFyc2hhbCBydW5zIHJlYWwgSFRUUC9IVFRQUyBwcm9iZXMgYWdhaW5zdCBhbnkgVVJMIHlvdSBiaW5kIOKAlCBzdGF0dXMsIGxhdGVuY3ksIHA5NSwgVExTIGV4cGlyeSwgaW5jaWRlbnQgdHJhbnNpdGlvbnMuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5TZXNzaW9ucyBhcmUgaW4tbWVtb3J5Ljwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gZHVyYWJsZSB0byBkaXNrLCAzMC1kYXkgVFRMLCBzdXJ2aXZlcyByZXN0YXJ0LjwvbGk+CiAgPGxpPjxiPlN0aWxsIHRydWU6PC9iPiBTTVRQIGNyZWRlbnRpYWxzIHNpdCBpbiA8Y29kZT5kYXRhLmpzb248L2NvZGU+IG9uIHRoaXMgYm94LiBUaGF0IGlzIHN0YW5kYXJkIGZvciBhIHNlbGYtaG9zdGVkIHJlbGF5LCBidXQgaXQgaXMgbm90IGEgaGFyZHdhcmUgdmF1bHQg4oCUIHVzZSBhbiBhcHAtc3BlY2lmaWMgcGFzc3dvcmQgeW91IGNhbiByZXZva2UsIG5ldmVyIHlvdXIgcHJpbWFyeSBvbmUuPC9saT4KICA8bGk+PGI+U3RpbGwgdHJ1ZTo8L2I+IHByb2JlcyBydW4gZnJvbSB0aGlzIHNhbmRib3guIElmIHRoZSBzYW5kYm94IGhhcyBubyByb3V0ZSB0byBhIGhvc3QsIHRoYXQgcmVhZHMgYXMgRE9XTiBldmVuIHdoZW4gdGhlIGhvc3QgaXMgZmluZS4gVmVyaWZ5IGFuIG91dGFnZSBiZWZvcmUgYWN0aW5nIG9uIGl0LjwvbGk+CiAgPGxpPlplcm8tQ29zdCBtZWFucyBsYXdmdWwgZnJlZSByb3V0ZXMgb25seSDigJQgbmV2ZXIgcGlyYWN5LCBzdG9sZW4ga2V5cyBvciBUb1MgZXZhc2lvbi48L2xpPjwvdWw+PC9kaXY+PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gU0VUVElOR1MgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2V0dGluZ3M9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICR7Uy5vd25lci5ib290c3RyYXA/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJncmlkLWNvbHVtbjoxLy0xO2JvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj7imqAgQk9PVFNUUkFQIENSRURFTlRJQUwgQUNUSVZFPC9oMz4KICA8ZGl2PlRoZSBzZXJ2ZXItZ2VuZXJhdGVkIHBhc3N3b3JkIGlzIHN0aWxsIGluIGZvcmNlIGFuZCBhIHBsYWludGV4dCBjb3B5IHNpdHMgaW4gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIG5vdyDigJQgcm90YXRpb24gZGVsZXRlcyB0aGF0IGZpbGUgYXV0b21hdGljYWxseS48L2Rpdj48L2Rpdj5gOicnfQogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPklkZW50aXR5PC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE2MHB4Ij5Pd25lciBJRDwvdGQ+PHRkPiR7ZXNjKFMub3duZXIuaWQpfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UGFzc3dvcmQ8L3RkPjx0ZD5QQktERjItU0hBMjU2IMK3IDE1MGsgaXRlcmF0aW9ucyDCtyBzZXJ2ZXItc2lkZTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+MkZBIEVtYWlsPC90ZD48dGQ+JHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlByb3Zpc2lvbmVkPC90ZD48dGQ+JHtTLm93bmVyLmNyZWF0ZWR9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Eb2N0cmluZTwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPlpFUk8tQ09TVCBFTkZPUkNFRDwvc3Bhbj48L3RkPjwvdHI+PC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvdGF0ZSBQYXNzd29yZDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5DdXJyZW50PC9zcGFuPjxpbnB1dCBpZD0icnBPbGQiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgKG1pbiA4KTwvc3Bhbj48aW5wdXQgaWQ9InJwTmV3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJyb3RhdGUoKSI+Uk9UQVRFPC9idXR0b24+PGRpdiBjbGFzcz0iZXJyIiBpZD0icnBFcnIiPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYW5nZSBPd25lciBJRDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgT3duZXIgSUQ8L3NwYW4+PGlucHV0IGlkPSJpZE5ldyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29uZmlybSBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9ImlkUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGdJZCgpIj5VUERBVEUgSUQ8L2J1dHRvbj48ZGl2IGNsYXNzPSJlcnIiIGlkPSJpZEVyciI+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+MkZBIFRhcmdldDwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXcgRW1haWw8L3NwYW4+PGlucHV0IGlkPSJlbU5ldyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hnTWFpbCgpIj5VUERBVEU8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3N0ZXI8L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPlJlc3RvcmUgdGhlIDE4IGRlZmF1bHQgc3ViLWFnZW50cy48L2Rpdj4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlc2V0Um9zdGVyKCkiPlJFU0VUIFJPU1RFUjwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkRlc3RydWN0aXZlPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvbmZpcm0gUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJ3cFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0id2lwZSgpIj5XSVBFIEVOVElSRSBJTlNUQU5DRTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHJvdGF0ZSgpe2NvbnN0IGU9cnBFcnI7ZS50ZXh0Q29udGVudD0nJzsKIHRyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvcm90YXRlJyx7b2xkOnJwT2xkLnZhbHVlLG5ldTpycE5ldy52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdQYXNzd29yZCByb3RhdGVkIMK3IGJvb3RzdHJhcCBmaWxlIGRlc3Ryb3llZCcpfWNhdGNoKHgpe2UudGV4dENvbnRlbnQ9eC5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gY2hnSWQoKXtjb25zdCBlPWlkRXJyO2UudGV4dENvbnRlbnQ9Jyc7CiB0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL2lkJyx7bmV3aWQ6aWROZXcudmFsdWUudHJpbSgpLHB3OmlkUHcudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnT3duZXIgSUQgdXBkYXRlZCcpfWNhdGNoKHgpe2UudGV4dENvbnRlbnQ9eC5tZXNzYWdlfX0KYXN5bmMgZnVuY3Rpb24gY2hnTWFpbCgpe3RyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvZW1haWwnLHtlbWFpbDplbU5ldy52YWx1ZS50cmltKCl9KTtyZW5kZXIoKTtmbGFzaCgnMkZBIHRhcmdldCB1cGRhdGVkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CmFzeW5jIGZ1bmN0aW9uIHJlc2V0Um9zdGVyKCl7aWYoIWNvbmZpcm0oJ1Jlc2V0IHJvc3Rlcj8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2FnZW50L3Jlc2V0Jyx7fSk7cmVuZGVyKCk7Zmxhc2goJ1Jvc3RlciByZXNldCcpfQphc3luYyBmdW5jdGlvbiB3aXBlKCl7aWYoIWNvbmZpcm0oJ0lSUkVWRVJTSUJMRS4gRGVzdHJveSBhbGwgc2VydmVyIHN0YXRlPycpKXJldHVybjsKIHRyeXthd2FpdCBBUEkoJy9hcGkvd2lwZScse3B3OndwUHcudmFsdWV9KTtsb2NhdGlvbi5yZWxvYWQoKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KCi8qIC0tLS0tLS0tLS0gTU9EQUwgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiBtb2RhbChodG1sKXtjbG9zZU1vZGFsKCk7Y29uc3QgZD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtkLmNsYXNzTmFtZT0nbW9kYWwnO2QuaWQ9J21kbCc7CiBkLmlubmVySFRNTD1gPGRpdiBjbGFzcz0ibWJveCI+JHtodG1sfTwvZGl2PmA7ZC5vbmNsaWNrPWU9PntpZihlLnRhcmdldD09PWQpY2xvc2VNb2RhbCgpfTtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGQpfQpmdW5jdGlvbiBjbG9zZU1vZGFsKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21kbCcpPy5yZW1vdmUoKX0KYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsZT0+e2lmKGUua2V5PT09J0VzY2FwZScpe2Nsb3NlTW9kYWwoKTtjbG9zZVNiKCl9fSk7CmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsKCk9PntpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCl9KTsK','base64')
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
/* HUSTLE MODE — everything money-facing, tight intervals, parallel lanes.
   Used when the Owner wants maximum output in the next hour. */
const HUSTLE_TASKS = [
  ['ai.ideas',       420, 'Growth Conductor'],
  ['ai.research',    300, 'Market Signal'],
  ['ai.missions',    600, 'Growth Conductor'],
  ['ai.revenue',     900, 'Revenue Streamer'],
  ['ai.investigate', 720, 'Market Signal'],
  ['ai.client_report',1200,'Insight Forge'],
  ['probe.sweep',    120, 'Uptime Marshal'],
  ['anomaly.scan',   600, 'Audit Sentinel'],
  ['gate.sentry',    600, 'Risk Matrix Analyst'],
  ['ai.brief',       900, 'Insight Forge']
];

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
  }
  S.runs=S.runs.slice(0,300);
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
    tasks:S.tasks, runs:S.runs.slice(0,80), running:!!S.running, ticks:S.ticks,
    hustle:!!S.hustle, lanes:S.lanes||3, budget:S.budget||0,
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

  /* ---- HUSTLE MODE: maximum parallel money-focused output ---- */
  if(p==='/api/runtime/hustle'){
    if(!verify(b.pw||'')) return send(res,401,{error:'SIGNATURE REQUIRED'});
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
    if(!verify(b.pw||'')) return send(res,401,{error:'SIGNATURE REQUIRED'});
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

