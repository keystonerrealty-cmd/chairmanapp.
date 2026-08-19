#!/usr/bin/env node
/* ==========================================================================
   CHAIRMAN AGENT OS  —  SINGLE FILE

   RUN IT:   node chairman.js     then open http://localhost:8080

   AGENT LOOP (new): the Chairman now picks a tool, SEES the real result,
   and decides the next step — repeating until the goal is met. This is the
   difference between a chatbot and an agent. 11 real tools, 10-step cap,
   full trace of every step and its genuine output.

   UNLIMITED KEYS: add up to 40 API keys across providers. A rate-limited
   key is parked for 10 minutes and the next one takes over automatically.

   HONEST NOTE: more tools does not equal more capability. What matters is
   the loop. Every tool listed is code that actually executes — the model
   is never shown a tool that does not exist, and inventing one is refused.

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
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgovKiDilZDilZAgQ0hBSVJNQU4gT1MgwrcgTlVNRVJPIOKAlCB0cmVhc3VyeSBsaWdodCB0aGVtZSDilZDilZAgKi8KOnJvb3R7CiAgLyogbGlnaHQgaXMgdGhlIGRlZmF1bHQgbm93ICovCiAgLS1iZzojRUZFQURGOyAtLWJnMjojRTVERkQxOwogIC0tcGFuZWw6I0ZCRjhGMTsKICAtLWdsYXNzOiNGQkY4RjE7CiAgLS1nbGFzczI6I0Y1RjFFNzsKICAtLXN0cm9rZTojREVEN0M3OwogIC0tc3Ryb2tlMjojQzdCRkFCOwogIC0tdHh0OiMxODE1MDk7IC0tZGltOiM2RTY4NTc7IC0tZGltMjojOUM5Njg2OwoKICAtLWxpbWU6Izc4OEExRDsgICAgICAvKiBzaWduYXR1cmUgb2xpdmUtbGltZSAqLwogIC0tbGltZTI6IzhGQTMyNjsKICAtLW9saXZlOiMzOTQ2MDM7ICAgICAvKiBkZWVwIG9saXZlICovCiAgLS1pbms6IzA0MDUwMTsKCiAgLS1jeTojNzg4QTFEOyAtLWJsdTojNUM2RTFBOyAtLWdybjojNEY3QTJBOyAtLWFtYjojQTg4MDFCOwogIC0tbWFnOiNCNDQ0MkE7IC0tcHVyOiM2RTdBM0M7CgogIC0tbW9ubzp1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sIlJvYm90byBNb25vIixtb25vc3BhY2U7CiAgLS1zYW5zOi1hcHBsZS1zeXN0ZW0sQmxpbmtNYWNTeXN0ZW1Gb250LCJTZWdvZSBVSSIsSW50ZXIsUm9ib3RvLHNhbnMtc2VyaWY7CiAgLS1zYnc6MjM4cHg7IC0tcjoxNHB4OwogIC0tc2hhZG93OjAgMXB4IDJweCByZ2JhKDYwLDQ4LDIwLC4wNiksIDAgOHB4IDI0cHggcmdiYSg2MCw0OCwyMCwuMDYpOwogIC0tc2hhZG93MjowIDJweCA2cHggcmdiYSg2MCw0OCwyMCwuMDgpLCAwIDE2cHggNDBweCByZ2JhKDYwLDQ4LDIwLC4xMCk7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXXsKICAtLWJnOiMwQTBCMDY7IC0tYmcyOiMxMDEyMDg7CiAgLS1wYW5lbDojMTUxODBDOyAtLWdsYXNzOiMxNTE4MEM7IC0tZ2xhc3MyOiMxQjFGMEY7CiAgLS1zdHJva2U6IzI1MkExNjsgLS1zdHJva2UyOiMzNzQwMUY7CiAgLS10eHQ6I0YyRjNFQTsgLS1kaW06IzlBOUM4QTsgLS1kaW0yOiM2QTZENUM7CiAgLS1saW1lOiNBM0JCMkI7IC0tbGltZTI6I0I4RDEzNDsKICAtLWN5OiNBM0JCMkI7IC0tYmx1OiM4RkEzMjY7IC0tZ3JuOiM2RkJGNEE7IC0tYW1iOiNEOUE2MkI7CiAgLS1tYWc6I0UzNkI0RTsgLS1wdXI6IzlGQUU1RTsKICAtLXNoYWRvdzowIDFweCAycHggcmdiYSgwLDAsMCwuNCksIDAgOHB4IDI2cHggcmdiYSgwLDAsMCwuMzUpOwogIC0tc2hhZG93MjowIDJweCA4cHggcmdiYSgwLDAsMCwuNSksIDAgMThweCA0NnB4IHJnYmEoMCwwLDAsLjQ1KTsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnR9Cmh0bWwsYm9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMCV9CmJvZHl7CiAgYmFja2dyb3VuZDp2YXIoLS1iZyk7IGNvbG9yOnZhcigtLXR4dCk7CiAgZm9udDoxMy41cHgvMS41NSB2YXIoLS1zYW5zKTsgb3ZlcmZsb3cteDpoaWRkZW47CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMTAwcHggNzAwcHggYXQgODglIC0xNCUsIHJnYmEoMTIwLDEzOCwyOSwuMTMpLCB0cmFuc3BhcmVudCA2MCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDc2MHB4IDUyMHB4IGF0IDQlIDEwNCUsIHJnYmEoMTQwLDExMCw1MCwuMDkpLCB0cmFuc3BhcmVudCA2MiUpOwogIGJhY2tncm91bmQtYXR0YWNobWVudDpmaXhlZDsKfQpidXR0b257Zm9udDppbmhlcml0O2N1cnNvcjpwb2ludGVyO2NvbG9yOmluaGVyaXR9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtmb250OmluaGVyaXR9Ci5oaWRle2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6MTBweDtoZWlnaHQ6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOnZhcigtLXN0cm9rZTIpO2JvcmRlci1yYWRpdXM6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10cmFja3tiYWNrZ3JvdW5kOnRyYW5zcGFyZW50fQoKLyog4pSA4pSAIExPR0lOIC8gSEVSTyDilIDilIAgKi8KI2dhdGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjgwO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1iZyk7CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMDAwcHggNjgwcHggYXQgODQlIC0xMCUsIHJnYmEoMTIwLDEzOCwyOSwuMTYpLCB0cmFuc3BhcmVudCA1OCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDcyMHB4IDUyMHB4IGF0IDYlIDEwMCUsIHJnYmEoMTQwLDExMCw1MCwuMTApLCB0cmFuc3BhcmVudCA2MCUpO30KLnRvcGJhcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMXB4O3BhZGRpbmc6MTVweCAyNHB4O2ZsZXgtd3JhcDp3cmFwOwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9Ci5sb2dve2ZvbnQ6NzAwIDE4cHgvMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjVweH0KLmxvZ28gaXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGx7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyLXJhZGl1czo5OXB4OwogIHBhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzouN3B4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGlsbC5saXZle2JvcmRlci1jb2xvcjpyZ2JhKDEyMCwxMzgsMjksLjM2KTtiYWNrZ3JvdW5kOnJnYmEoMTIwLDEzOCwyOSwuMTApO2NvbG9yOnZhcigtLW9saXZlKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAucGlsbC5saXZle2NvbG9yOnZhcigtLWxpbWUpfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tbGltZSk7CiAgbWFyZ2luLXJpZ2h0OjZweDtib3gtc2hhZG93OjAgMCAwIDNweCByZ2JhKDEyMCwxMzgsMjksLjE4KTthbmltYXRpb246YnAgMnMgaW5maW5pdGV9CkBrZXlmcmFtZXMgYnB7NTAle29wYWNpdHk6LjM1fX0KLmhlcm97bWF4LXdpZHRoOjEyMjBweDttYXJnaW46MCBhdXRvO3BhZGRpbmc6MzRweCAyNHB4IDY4cHh9Ci5oZXJvQ2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoyNHB4OwogIGJveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7cGFkZGluZzpjbGFtcCgyNnB4LDR2dyw1MHB4KTsKICBkaXNwbGF5OmdyaWQ7Z2FwOjM4cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMDVmciAuOTVmcjthbGlnbi1pdGVtczpjZW50ZXJ9CkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpey5oZXJvQ2FyZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDEyMCwxMzgsMjksLjMwKTsKICBjb2xvcjp2YXIoLS1vbGl2ZSk7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS41cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdle2NvbG9yOnZhcigtLWxpbWUpfQpoMS5iaWd7Zm9udDo3MDAgY2xhbXAoMzJweCw1LjZ2dyw1NnB4KS8xLjAyIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0ycHg7bWFyZ2luOjE4cHggMCAxNnB4fQpoMS5iaWcgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tbGltZSl9Ci5sZWRle2NvbG9yOnZhcigtLWRpbSk7Zm9udDoxNXB4LzEuNyB2YXIoLS1zYW5zKTttYXgtd2lkdGg6NTJjaDttYXJnaW46MCAwIDI2cHh9Ci5zdGF0Um93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgxNDRweCwxZnIpKTtnYXA6MTJweH0KLnN0YXR7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxNXB4IDE3cHg7dHJhbnNpdGlvbjouMnN9Ci5zdGF0OmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1saW1lKTtib3gtc2hhZG93OnZhcigtLXNoYWRvdyl9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjRweC8xLjE1IHZhcigtLXNhbnMpO21hcmdpbjo3cHggMCAzcHg7bGV0dGVyLXNwYWNpbmc6LTFweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubG9naW5Cb3h7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgNHB4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLW9saXZlKTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubG9naW5Cb3ggaDN7Y29sb3I6dmFyKC0tbGltZSl9Ci5sb2dpbkJveCAuc2J7Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTAuNXB4O21hcmdpbi1ib3R0b206MThweDtsZXR0ZXItc3BhY2luZzouNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZXJye2NvbG9yOnZhcigtLW1hZyk7Zm9udC1zaXplOjExLjVweDttaW4taGVpZ2h0OjE2cHg7bWFyZ2luLXRvcDo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci53YXJuYm94e2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1hbWIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4wOCk7cGFkZGluZzoxMXB4IDE0cHg7CiAgYm9yZGVyLXJhZGl1czowIDEycHggMTJweCAwO2ZvbnQtc2l6ZToxMS41cHg7Y29sb3I6IzZCNTQxMDttYXJnaW4tYm90dG9tOjE1cHg7bGluZS1oZWlnaHQ6MS42fQpbZGF0YS10aGVtZT0iZGFyayJdIC53YXJuYm94e2NvbG9yOiNFMEMyNzF9Ci5waWxsYXJze21heC13aWR0aDoxMjIwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjAgMjRweCA4MHB4fQoucGlsbGFycyBoMnt0ZXh0LWFsaWduOmNlbnRlcjtmb250OjcwMCBjbGFtcCgyM3B4LDMuNHZ3LDM0cHgpLzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS4xcHg7bWFyZ2luOjAgMCAxMHB4fQoucGlsbGFycyBoMiBlbXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGxhcnMgLnN1Ynt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTMuNXB4LzEuNiB2YXIoLS1zYW5zKTttYXJnaW46MCAwIDMwcHh9Ci5wZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE2cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjE0cHgsMWZyKSl9Ci5wY2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MjBweDt0cmFuc2l0aW9uOi4yMnN9Ci5wY2FyZDpob3Zlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNHB4KTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLnBjYXJkIHV7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC1zaXplOjkuNXB4O2xldHRlci1zcGFjaW5nOjEuNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGNhcmQgaDR7bWFyZ2luOjEwcHggMDtmb250OjcwMCAxNS41cHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0uM3B4fQoucGNhcmQgcHttYXJnaW46MCAwIDEzcHg7Y29sb3I6dmFyKC0tZGltKTtmb250OjEycHgvMS42NSB2YXIoLS1zYW5zKX0KLmNoaXB7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtjb2xvcjp2YXIoLS1kaW0pOwogIGJvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEwcHg7bWFyZ2luOjAgNXB4IDVweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoKLyog4pSA4pSAIFNIRUxMIOKUgOKUgCAqLwojYXBwe2Rpc3BsYXk6ZmxleDttaW4taGVpZ2h0OjEwMHZofQphc2lkZXt3aWR0aDp2YXIoLS1zYncpO2ZsZXg6MCAwIHZhcigtLXNidyk7cG9zaXRpb246c3RpY2t5O3RvcDowO2hlaWdodDoxMDB2aDt6LWluZGV4OjQwOwogIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCB2YXIoLS1zdHJva2UpfQouYWJyYW5ke3BhZGRpbmc6MThweCAxNnB4IDE2cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtkaXNwbGF5OmZsZXg7Z2FwOjExcHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6MTBweDtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxNXB4OwogIGJhY2tncm91bmQ6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtib3gtc2hhZG93OjAgNHB4IDEycHggcmdiYSgxMjAsMTM4LDI5LC4zMCl9Ci5hYnJhbmQgYntmb250OjcwMCAxM3B4LzEuMjUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LjJweDtkaXNwbGF5OmJsb2NrfQouYWJyYW5kIHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjguNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQphc2lkZSBuYXZ7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjEycHggMTJweCAxOHB4fQouZ3Jwe2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjhweDtwYWRkaW5nOjE2cHggMTBweCA3cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBjb2xvcjp2YXIoLS1kaW0pO3BhZGRpbmc6OXB4IDEycHg7Ym9yZGVyLXJhZGl1czoxMHB4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTIuNXB4OwogIHRyYW5zaXRpb246LjE1czttYXJnaW4tYm90dG9tOjJweH0KYXNpZGUgbmF2IGJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Y29sb3I6dmFyKC0tdHh0KX0KYXNpZGUgbmF2IGJ1dHRvbi5vbntiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NjAwOwogIGJveC1zaGFkb3c6MCAzcHggMTBweCByZ2JhKDEyMCwxMzgsMjksLjI4KX0KYXNpZGUgbmF2IGJ1dHRvbiBpe2ZvbnQtc3R5bGU6bm9ybWFsO3dpZHRoOjE2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHh9Ci5hZm9vdHtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6MTRweCAxNnB4O2ZvbnQtc2l6ZToxMC41cHg7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Cm1haW57ZmxleDoxO21pbi13aWR0aDowO3BhZGRpbmc6MjJweCBjbGFtcCgxNnB4LDIuNnZ3LDMycHgpIDk2cHh9Ci5tdG9we2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjExcHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbToyMnB4fQouY3J1bWJ7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjExLjVweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmNydW1iIGJ7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC13ZWlnaHQ6NjAwfQoubXRvcCAuc3B7ZmxleDoxfQojYnVyZ2Vye2Rpc3BsYXk6bm9uZX0KI3RoZW1lQnRue2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjExcHh9CiN0aGVtZUJ0bjpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6dmFyKC0tbGltZSl9CkBtZWRpYShtYXgtd2lkdGg6ODYwcHgpewogIGFzaWRle3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwJSk7dHJhbnNpdGlvbjouMjRzO2JveC1zaGFkb3c6MCAwIDYwcHggcmdiYSg2MCw0OCwyMCwuMjgpfQogIGFzaWRlLm9wZW57dHJhbnNmb3JtOm5vbmV9CiAgI3Njcmlte3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDQ1LDM4LDE4LC4zNCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KTt6LWluZGV4OjM1fQogICNidXJnZXJ7ZGlzcGxheTppbmxpbmUtZmxleH0KICBtYWlue3BhZGRpbmctYm90dG9tOjExMHB4fQp9CgovKiDilIDilIAgUFJJTUlUSVZFUyDilIDilIAgKi8KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcGFkZGluZzoxOHB4IDIwcHg7bWFyZ2luLWJvdHRvbToxNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KTt0cmFuc2l0aW9uOi4yc30KLmNhcmQ6aG92ZXJ7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLmNhcmQ+aDN7bWFyZ2luOjAgMCAxNHB4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7Y29sb3I6dmFyKC0tZGltKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE0cHh9Ci5nMntncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyOTJweCwxZnIpKX0KLmcze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDIwOHB4LDFmcikpfQouZzR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTYycHgsMWZyKSl9Ci5rcGl7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjE3cHggMThweDsKICB0cmFuc2l0aW9uOi4ycztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5rcGk6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3RvcDowO2JvdHRvbTowO3dpZHRoOjNweDtiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO29wYWNpdHk6Ljg1fQoua3BpOmhvdmVye3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0ycHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpfQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyN3B4LzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS40cHh9Ci5rcGkgdXtkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjNweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5rcGkgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi10b3A6NXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRue2JhY2tncm91bmQ6dmFyKC0tcGFuZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7cGFkZGluZzo5cHggMTVweDtib3JkZXItcmFkaXVzOjEwcHg7CiAgZm9udC1zaXplOjExLjVweDt0cmFuc2l0aW9uOi4xNnM7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5idG46aG92ZXJ7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUpO2NvbG9yOnZhcigtLWxpbWUpfQouYnRuLnB7YmFja2dyb3VuZDp2YXIoLS1saW1lKTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo3MDA7CiAgYm94LXNoYWRvdzowIDNweCAxMHB4IHJnYmEoMTIwLDEzOCwyOSwuMjYpfQouYnRuLnA6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1saW1lMik7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUyKTtjb2xvcjojZmZmO2JveC1zaGFkb3c6MCA1cHggMTZweCByZ2JhKDEyMCwxMzgsMjksLjM0KX0KLmJ0bi5va3tiYWNrZ3JvdW5kOnJnYmEoNzksMTIyLDQyLC4xMCk7Ym9yZGVyLWNvbG9yOnJnYmEoNzksMTIyLDQyLC4zNCk7Y29sb3I6dmFyKC0tZ3JuKX0KLmJ0bi5ub3tiYWNrZ3JvdW5kOnJnYmEoMTgwLDY4LDQyLC4wOSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTgwLDY4LDQyLC4zMCk7Y29sb3I6dmFyKC0tbWFnKX0KLmJ0bi5zbXtwYWRkaW5nOjZweCAxMXB4O2ZvbnQtc2l6ZToxMC41cHg7Ym9yZGVyLXJhZGl1czo4cHh9Ci5idG46ZGlzYWJsZWR7b3BhY2l0eTouNDtjdXJzb3I6bm90LWFsbG93ZWQ7dHJhbnNmb3JtOm5vbmV9Ci5yb3d7ZGlzcGxheTpmbGV4O2dhcDo5cHg7ZmxleC13cmFwOndyYXA7YWxpZ24taXRlbXM6Y2VudGVyfQpsYWJlbC5me2Rpc3BsYXk6YmxvY2s7bWFyZ2luLWJvdHRvbToxM3B4fQpsYWJlbC5mPnNwYW57ZGlzcGxheTpibG9jaztmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS4ycHg7Y29sb3I6dmFyKC0tZGltKTttYXJnaW4tYm90dG9tOjZweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5pbnt3aWR0aDoxMDAlO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO2NvbG9yOnZhcigtLXR4dCk7CiAgcGFkZGluZzoxMHB4IDEzcHg7Ym9yZGVyLXJhZGl1czoxMHB4O291dGxpbmU6bm9uZTt0cmFuc2l0aW9uOi4xNnN9Ci5pbjpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxMjAsMTM4LDI5LC4xNCk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9CnRleHRhcmVhLmlue21pbi1oZWlnaHQ6NzRweDtyZXNpemU6dmVydGljYWw7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyl9CnRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4fQp0aHt0ZXh0LWFsaWduOmxlZnQ7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjJweDtwYWRkaW5nOjEwcHggOXB4OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CnRke3BhZGRpbmc6MTFweCA5cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9CnRyOmhvdmVyIHRke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLnR3e292ZXJmbG93LXg6YXV0bztib3JkZXItcmFkaXVzOjEwcHh9Ci50YWd7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzozcHggMTBweDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjFweDsKICBib3JkZXI6MXB4IHNvbGlkO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC13ZWlnaHQ6NjAwfQoudC1jeXtjb2xvcjp2YXIoLS1vbGl2ZSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTIwLDEzOCwyOSwuMzQpO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtY3l7Y29sb3I6dmFyKC0tbGltZSl9Ci50LWdybntjb2xvcjojM0U2NTIyO2JvcmRlci1jb2xvcjpyZ2JhKDc5LDEyMiw0MiwuMzIpO2JhY2tncm91bmQ6cmdiYSg3OSwxMjIsNDIsLjExKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1ncm57Y29sb3I6IzdGRDA1QX0KLnQtYW1ie2NvbG9yOiM4QTY3MTI7Ym9yZGVyLWNvbG9yOnJnYmEoMTY4LDEyOCwyNywuMzIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtYW1ie2NvbG9yOiNFMEI1NEF9Ci50LXJlZHtjb2xvcjojOUIzQTIzO2JvcmRlci1jb2xvcjpyZ2JhKDE4MCw2OCw0MiwuMzApO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1yZWR7Y29sb3I6I0YwODY2Qn0KLnQtYmx1e2NvbG9yOiM0QTVBMTU7Ym9yZGVyLWNvbG9yOnJnYmEoOTIsMTEwLDI2LC4zMCk7YmFja2dyb3VuZDpyZ2JhKDkyLDExMCwyNiwuMTApfQpbZGF0YS10aGVtZT0iZGFyayJdIC50LWJsdXtjb2xvcjojQThCRTQ1fQoudC1wdXJ7Y29sb3I6IzU2NUYyRTtib3JkZXItY29sb3I6cmdiYSgxMTAsMTIyLDYwLC4zMCk7YmFja2dyb3VuZDpyZ2JhKDExMCwxMjIsNjAsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1wdXJ7Y29sb3I6I0I0QzE3Nn0KLnQtZGlte2NvbG9yOnZhcigtLWRpbSk7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLmJhcntoZWlnaHQ6N3B4O2JhY2tncm91bmQ6dmFyKC0tYmcyKTtib3JkZXItcmFkaXVzOjk5cHg7b3ZlcmZsb3c6aGlkZGVufQouYmFyIGl7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTAwJTtib3JkZXItcmFkaXVzOjk5cHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tb2xpdmUpLHZhcigtLWxpbWUpKTt0cmFuc2l0aW9uOndpZHRoIC41cyBjdWJpYy1iZXppZXIoLjQsMCwuMiwxKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFyIGl7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tbGltZSksdmFyKC0tbGltZTIpKX0KdWwudGlnaHR7bWFyZ2luOjdweCAwIDA7cGFkZGluZy1sZWZ0OjE4cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKX0KdWwudGlnaHQgbGl7bWFyZ2luOjVweCAwfQp1bC50aWdodCBie2NvbG9yOnZhcigtLXR4dCl9CnByZS55YW1se2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTRweDsKICBmb250LXNpemU6MTFweDtvdmVyZmxvdzphdXRvO2NvbG9yOiMzRTRBMTg7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MS42O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQpbZGF0YS10aGVtZT0iZGFyayJdIHByZS55YW1se2NvbG9yOiNCNEMxNzZ9Ci5sb2d7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjExcHg7cGFkZGluZzoxM3B4OwogIG1heC1oZWlnaHQ6MzcwcHg7b3ZlcmZsb3c6YXV0bztmb250LXNpemU6MTFweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxvZyBkaXZ7cGFkZGluZzozcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3doaXRlLXNwYWNlOnByZS13cmFwO3dvcmQtYnJlYWs6YnJlYWstd29yZH0KLmxvZyAudHN7Y29sb3I6dmFyKC0tZGltMil9Ci5tb25vLWRpbXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubW9kYWx7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoNDUsMzgsMTgsLjQyKTt6LWluZGV4OjkwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjE4cHg7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNXB4KX0KLm1ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6NjYwcHg7bWF4LWhlaWdodDo4OHZoO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6MCAyNHB4IDcwcHggcmdiYSg2MCw0OCwyMCwuMjQpfQoubWJveCBoM3ttYXJnaW46MCAwIDZweDtmb250LXNpemU6MTVweDtjb2xvcjp2YXIoLS1vbGl2ZSk7bGV0dGVyLXNwYWNpbmc6LS4ycHg7dGV4dC10cmFuc2Zvcm06bm9uZX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubWJveCBoM3tjb2xvcjp2YXIoLS1saW1lKX0KLmZsYXNoe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JvdHRvbToyNnB4O2JhY2tncm91bmQ6dmFyKC0taW5rKTsKICBjb2xvcjojRjRGNEYwO2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1saW1lKTtwYWRkaW5nOjEzcHggMjFweDtib3JkZXItcmFkaXVzOjEycHg7Zm9udC1zaXplOjEycHg7CiAgei1pbmRleDo5OTttYXgtd2lkdGg6OTB2dztib3gtc2hhZG93OjAgMTRweCA0NHB4IHJnYmEoNjAsNDgsMjAsLjMwKTthbmltYXRpb246ZnUgLjI4c30KQGtleWZyYW1lcyBmdXtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlKC01MCUsMTJweCl9fQoKLyog4pSA4pSAIFJBRElBTCBFTkdJTkUg4pSA4pSAICovCi5lbmdpbmVXcmFwe2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDI1OHB4O2dhcDoxNHB4fQpAbWVkaWEobWF4LXdpZHRoOjEwMDBweCl7LmVuZ2luZVdyYXB7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn19Ci5jYW52YXNCb3h7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO21pbi1oZWlnaHQ6NDQwcHg7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpfQouY2FudmFzQm94IHN2Z3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG87dG91Y2gtYWN0aW9uOnBhbi15fQouZ3JpZGJne3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTtvcGFjaXR5Oi41NTsKICBiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh2YXIoLS1zdHJva2UpIDFweCx0cmFuc3BhcmVudCAxcHgpLAogICAgICAgICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLXN0cm9rZSkgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM0cHggMzRweDsKICBtYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDQwJSx0cmFuc3BhcmVudCA3NiUpOwogIC13ZWJraXQtbWFzay1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSA1MCUsIzAwMCA0MCUsdHJhbnNwYXJlbnQgNzYlKX0KLmVuZ1RvcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjE0cHg7dG9wOjEzcHg7ei1pbmRleDoyO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZW5nVGl0bGV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7dG9wOjE0cHg7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoyOwogIGZvbnQ6NzAwIDEzcHggdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6Mi42cHg7Y29sb3I6dmFyKC0tdHh0KX0KLm5vZGV7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMThzfQoubm9kZTpob3ZlciBjaXJjbGV7ZmlsdGVyOmJyaWdodG5lc3MoMS4xNSl9Ci5zaWRle2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE0cHh9Ci5sZWdlbmQgZGl2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7cGFkZGluZzo0cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxlZ2VuZCBpe3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7ZGlzcGxheTpibG9jaztmbGV4OjAgMCAxMHB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2NnB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6OHB4IDRweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7CiAgdGV4dC1hbGlnbjpsZWZ0O3RyYW5zaXRpb246LjE0cztmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmRpckxpc3QgYnV0dG9uOmhvdmVye2NvbG9yOnZhcigtLWxpbWUpO3BhZGRpbmctbGVmdDo3cHh9Ci5kaXJMaXN0IHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjkuNXB4fQoudGVybXtiYWNrZ3JvdW5kOnZhcigtLWluayk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTFweDtwYWRkaW5nOjE0cHg7CiAgZm9udC1zaXplOjEwLjVweDttYXgtaGVpZ2h0OjE1OHB4O292ZXJmbG93OmF1dG87Y29sb3I6I0I4RDEzNDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KPC9zdHlsZT4KCgo8L2hlYWQ+Cjxib2R5Pgo8IS0tID09PT09PT09PT09PT09PT09IEdBVEUgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImdhdGUiPgogIDxkaXYgY2xhc3M9InRvcGJhciI+CiAgICA8ZGl2IGNsYXNzPSJsb2dvIj5DSEFJUk1BTiA8aT5BR0VOVCBPUzwvaT48L2Rpdj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5TRVJWRVIgTElWRSAmYW1wOyBBVURJVElORzwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIj5aRVJPLVRSVVNUIEFDVElWRTwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVCBET0NUUklORTwvc3Bhbj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iaGVybyI+CiAgICA8ZGl2IGNsYXNzPSJoZXJvQ2FyZCI+CiAgICAgIDxkaXY+CiAgICAgICAgPHNwYW4gY2xhc3M9ImJhZGdlIj5IRUFEIE9GIEFMTCBBR0VOVFM8L3NwYW4+CiAgICAgICAgPGgxIGNsYXNzPSJiaWciPk5PIFNVR0FSIENPQVRJTkcuPGJyPjxlbT5OTyBDT01QUk9NSVNFLjwvZW0+PC9oMT4KICAgICAgICA8cCBjbGFzcz0ibGVkZSI+RXZlcnkgZGV0YWlsIGNoZWNrZWQsIGV2ZXJ5IHN1Yi1hZ2VudCBhdWRpdGVkLCBldmVyeSBlbnRlcnByaXNlIHJlcXVlc3QgZm9yY2VkIHRocm91Z2ggYSBwcmVjaXNlIHBlcm1pc3Npb24gZmxvdy4gTm90aGluZyBwYWlkIGZvciwgZXZlciDigJQgdGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCwgY3JlZGl0IG1ldGVyIGFuZCBzdWJzY3JpcHRpb24gZ2F0ZS48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0ic3RhdFJvdyI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5CYWNrZW5kPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIiBpZD0iaHNVcCI+Q0hFQ0tJTkfigKY8L2I+PHMgaWQ9ImhzTm9kZSI+4oCUPC9zPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdCI+PHU+U2VjdXJpdHkgR2F0ZTwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5MT0NLRUQ8L2I+PHM+U2VydmVyLXNpZGUgc2Vzc2lvbnM8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5Db3N0IENlaWxpbmc8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9iPjxzPjAgZGVwZW5kZW5jaWVzIGluc3RhbGxlZDwvcz48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzPSJsb2dpbkJveCI+CiAgICAgICAgPGgzPk9XTkVSIFBPUlRBTDwvaDM+CiAgICAgICAgPGRpdiBjbGFzcz0ic2IiPkNSWVBUT0dSQVBISUMgQ0xFQVJBTkNFIFJFUVVJUkVEPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9ImJvb3ROb3RlIj5Cb290c3RyYXAgY3JlZGVudGlhbHMgd2VyZSBnZW5lcmF0ZWQgb25jZSBieSB0aGUgc2VydmVyIGFuZCBwcmludGVkIHRvIGl0cyBjb25zb2xlIC8gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIHRoZSBwYXNzd29yZCBpbW1lZGlhdGVseSBhZnRlciBmaXJzdCBsb2dpbi48L2Rpdj4KICAgICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0ibGlJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9InVzZXJuYW1lIj48L2xhYmVsPgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJsaVB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJylkb0xvZ2luKCkiPjwvbGFiZWw+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJkb0xvZ2luKCkiPkFVVEhFTlRJQ0FURTwvYnV0dG9uPgogICAgICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImxpRXJyIj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+U2Vzc2lvbnMgYXJlIGhlbGQgc2VydmVyLXNpZGUgKDhoIFRUTCwgSHR0cE9ubHkgY29va2llKS4gTG9nIGluIGZyb20gYW55IGRldmljZSBvbiB0aGlzIFVSTCDigJQgc3RhdGUgaXMgc2hhcmVkIGxpdmUuPC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9InBpbGxhcnMiPgogICAgPGgyPkNIQUlSTUFOIDxlbT5SQURJQUwgUElMTEFSUzwvZW0+PC9oMj4KICAgIDxwIGNsYXNzPSJzdWIiPkZsb29yLWJ5LWZsb29yIGVudGVycHJpc2UgY29tbWFuZCB3aXRoIGRlZGljYXRlZCBtaXNzaW9uIGxlYWRzIGFuZCBoYXJkIG9wZXJhdGlvbmFsIHNjb3BlLjwvcD4KICAgIDxkaXYgY2xhc3M9InBncmlkIiBpZD0iaGVyb1BpbGxhcnMiPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0gPT09PT09PT09PT09PT09PT0gQVBQID09PT09PT09PT09PT09PT09IC0tPgo8ZGl2IGlkPSJhcHAiIGNsYXNzPSJoaWRlIj4KICA8YXNpZGUgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0iYWJyYW5kIj4KICAgICAgPGRpdiBjbGFzcz0ibWFyayI+4peJPC9kaXY+CiAgICAgIDxkaXY+PGI+Q0hBSVJNQU4gT1M8L2I+PHNwYW4+VjMgwrcgTElWRSBCQUNLRU5EPC9zcGFuPjwvZGl2PgogICAgPC9kaXY+CiAgICA8bmF2IGlkPSJuYXYiPjwvbmF2PgogICAgPGRpdiBjbGFzcz0iYWZvb3QiPgogICAgICA8ZGl2Pk9XTkVSIDxiIGlkPSJ3aG9JZCIgc3R5bGU9ImNvbG9yOnZhcigtLXR4dCkiPjwvYj48L2Rpdj4KICAgICAgPGRpdj5VUFRJTUUgPHNwYW4gaWQ9InVwQ2xvY2siIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7igJQ8L3NwYW4+IMK3IFNQRU5EIDxzcGFuIGlkPSJzcGVuZE1pbmkiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4kMC4wMDwvc3Bhbj48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBzdHlsZT0id2lkdGg6MTAwJTttYXJnaW4tdG9wOjhweCIgb25jbGljaz0ibG9nb3V0KCkiPkxPQ0sgU1lTVEVNPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2FzaWRlPgogIDxtYWluPgogICAgPGRpdiBjbGFzcz0ibXRvcCI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9ImJ1cmdlciIgb25jbGljaz0idG9nZ2xlU2IoKSI+4piwPC9idXR0b24+CiAgICAgIDxkaXYgY2xhc3M9ImNydW1iIj5jaGFpcm1hbi1vcyAvIDxiIGlkPSJjcnVtYiI+aG9tZTwvYj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic3AiPjwvZGl2PgogICAgICA8YnV0dG9uIGlkPSJ0aGVtZUJ0biIgb25jbGljaz0idG9nZ2xlVGhlbWUoKSIgdGl0bGU9IkxpZ2h0IC8gZGFyayI+4peQPC9idXR0b24+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj48c3BhbiBpZD0ic3luY1BpbGwiPlNZTkNFRDwvc3Bhbj48L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0idmlldyI+PC9kaXY+CiAgPC9tYWluPgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSIvYXBwLmpzIj48L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==','base64'),
  'app.js':     Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNCNDQ0MkEnLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNBODgwMUInLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzc4OEExRCcsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjNkU3QTNDJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzRGN0EyQScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCihhc3luYyBmdW5jdGlvbigpewogIHBhaW50SGVybygpOwogIHRyeXsKICAgIGNvbnN0IGI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL2Jvb3QnLHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGNvbnN0IHQ9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlJyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCkuY2F0Y2goKCk9Pih7fSkpOwogICAgaHNVcC50ZXh0Q29udGVudD0nT05MSU5FJzsgCiAgICBpZihiLmF1dGhlZCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IFM9ci5zdGF0ZTsgZW50ZXIoKTsgfQogIH1jYXRjaChlKXsgaHNVcC50ZXh0Q29udGVudD0nT0ZGTElORSc7IGhzVXAuc3R5bGUuY29sb3I9J3ZhcigtLW1hZyknOyB9Cn0pKCk7CmZ1bmN0aW9uIHBhaW50SGVybygpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvUGlsbGFycycpLmlubmVySFRNTD1QSUxMQVJTLm1hcChwPT5gPGRpdiBjbGFzcz0icGNhcmQiPgogICA8dT5GTE9PUiAwJHtwLmlkfTwvdT48aDQ+JHtwLmljb259ICR7ZXNjKHAubmFtZSl9PC9oND48cD4ke2VzYyhwLmRlc2MpfTwvcD4KICAgJHtwLmNoaXBzLm1hcChjPT5gPHNwYW4gY2xhc3M9ImNoaXAiPiR7ZXNjKGMpfTwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gKS5qb2luKCcnKTsKfQphc3luYyBmdW5jdGlvbiBkb0xvZ2luKCl7CiAgY29uc3QgZT1saUVycjtlLnRleHRDb250ZW50PScnOwogIHRyeXsKICAgIGF3YWl0IEFQSSgnL2FwaS9sb2dpbicse2lkOmxpSWQudmFsdWUudHJpbSgpLHB3OmxpUHcudmFsdWV9KTsKICAgIGxpUHcudmFsdWU9Jyc7IGVudGVyKCk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZT09PSdBQ0NFU1MgREVOSUVEJz8nQUNDRVNTIERFTklFRC4gQ3JlZGVudGlhbCBtaXNtYXRjaCDigJQgbG9nZ2VkIENSSVQgc2VydmVyLXNpZGUuJzp4Lm1lc3NhZ2U7IH0KfQpmdW5jdGlvbiBlbnRlcigpewogIGdhdGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpOyBhcHAuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpOwogIHdob0lkLnRleHRDb250ZW50PVMub3duZXIuaWQ7IGJ1aWxkTmF2KCk7IGdvKCdob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHN0YXJ0UG9sbCgpeyBzdG9wUG9sbCgpOyBwb2xsPXNldEludGVydmFsKGFzeW5jKCk9PnsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9zdGF0ZT9zaW5jZT0nK1MucmV2LHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGlmKHIudW5jaGFuZ2VkKXsgUy50ZWxlbWV0cnk9ci50ZWxlbWV0cnk7IFMuZmxvb3JzPXIuZmxvb3JzOyB0aWNrQ2hyb21lKCk7CiAgICAgIGlmKGN1cj09PSdob21lJ3x8Y3VyPT09J2FuYWx5dGljcyd8fGN1cj09PSdzeXN0ZW0nKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgcmVuZGVyKCk7IHN5bmNQaWxsLnRleHRDb250ZW50PSdVUERBVEVEJzsgc2V0VGltZW91dCgoKT0+c3luY1BpbGwudGV4dENvbnRlbnQ9J1NZTkNFRCcsMTIwMCk7IH0KICB9Y2F0Y2goZSl7IHN5bmNQaWxsLnRleHRDb250ZW50PSdPRkZMSU5FJzsgfQp9LDMwMDApIH0KZnVuY3Rpb24gc3RvcFBvbGwoKXsgY2xlYXJJbnRlcnZhbChwb2xsKSB9CmZ1bmN0aW9uIHRpY2tDaHJvbWUoKXsKICBjb25zdCB0PVMudGVsZW1ldHJ5OwogIHVwQ2xvY2sudGV4dENvbnRlbnQ9aGhtbXNzKHQudXB0aW1lX3MpOwogIHNwZW5kTWluaS50ZXh0Q29udGVudD0nJCcrKFMuc3BlbmR8fDApLnRvRml4ZWQoMik7CiAgc3BlbmRNaW5pLnN0eWxlLmNvbG9yPVMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJzsKfQpmdW5jdGlvbiBzb2Z0UmVmcmVzaCgpeyBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+eyBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsgdHJ5eyBuLmlubmVySFRNTD1MSVZFW2ZdKCkgfWNhdGNoKGUpe30gfSkgfQpjb25zdCBMSVZFPXt9OwoKLyogLS0tLS0tLS0tLSBuYXYgLS0tLS0tLS0tLSAqLwpjb25zdCBOQVZERUY9WwogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydhZ2VudCcsJ+KamScsJ0FnZW50IExvb3AnXSxbJ21pc3Npb25zJywn4peOJywnTXkgTWlzc2lvbnMnXSxbJ2NvbW1hbmQnLCfilq4nLCdDb21tYW5kIENvbnNvbGUnXSxbJ3ZlbnR1cmVzJywn4peGJywnVmVudHVyZXMgJiBJZGVhcyddLFsncGF5Jywn4oK5JywnUGF5bWVudHMnXV1dLAogWydSVU5USU1FJyxbWydvcHMnLCfilrYnLCdMaXZlIE9wZXJhdGlvbnMnXSxbJ2JyYWluJywn4peIJywnQUkgQnJhaW4nXSxbJ3dvcmsnLCfinKYnLCdBZ2VudCBXb3JrJ10sWydyZXNlYXJjaCcsJ/CfjJAnLCdEZWVwIFJlc2VhcmNoJ11dXSwKIFsnRVZPTFVUSU9OJyxbWydldm9sdmUnLCfin7MnLCdTZWxmLVVwZ3JhZGUnXSxbJ3NraWxsczInLCfinI4nLCdMZWFybmVkIFNraWxscyddXV0sCiBbJ01PTklUT1JJTkcnLFtbJ3VwdGltZScsJ+KXjicsJ1VwdGltZSBNYXJzaGFsJ10sWydtYWlsJywn4pyJJywnTWFpbCBSZWxheSddXV0sCiBbJ1NZU1RFTScsW1snc3lzdGVtJywn4pqhJywnTGl2ZSBUZWxlbWV0cnknXSxbJ2RldmljZXMnLCfih4QnLCdEZXZpY2VzICYgU2Vzc2lvbnMnXSxbJ3plcm9jb3N0Jywn4oiFJywnWmVyby1Db3N0IFJvdXRlciddLFsnZG9jdHJpbmUnLCfCpycsJ0RvY3RyaW5lICYgU09QJ10sWydzZXR0aW5ncycsJ+KamScsJ093bmVyIFNldHRpbmdzJ11dXQpdOwpmdW5jdGlvbiBidWlsZE5hdigpe25hdi5pbm5lckhUTUw9TkFWREVGLm1hcCgoW2csaXRdKT0+YDxkaXYgY2xhc3M9ImdycCI+JHtnfTwvZGl2PmArCiBpdC5tYXAoKFtpZCxpYyxsXSk9PmA8YnV0dG9uIGRhdGEtcD0iJHtpZH0iIG9uY2xpY2s9ImdvKCcke2lkfScpIj48aT4ke2ljfTwvaT4ke2x9PC9idXR0b24+YCkuam9pbignJykpLmpvaW4oJycpfQpmdW5jdGlvbiBnbyhwKXtjdXI9cDtbLi4ubmF2LnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbicpXS5mb3JFYWNoKGI9PmIuY2xhc3NMaXN0LnRvZ2dsZSgnb24nLGIuZGF0YXNldC5wPT09cCkpOwogY3J1bWIudGV4dENvbnRlbnQ9cDtyZW5kZXIoKTtjbG9zZVNiKCk7c2Nyb2xsVG8oMCwwKX0KZnVuY3Rpb24gcmVuZGVyKCl7IHZpZXcuaW5uZXJIVE1MPVJFTkRFUltjdXJdKCk7IGlmKGN1cj09PSdlbmdpbmUnKWRyYXdFbmdpbmUoKTsKICBpZihjdXI9PT0nYnJhaW4nJiZ0eXBlb2YgcHJvdkhpbnQ9PT0nZnVuY3Rpb24nKXByb3ZIaW50KCk7CiAgaWYoY3VyPT09J3BheScmJnR5cGVvZiBwYXlIaW50PT09J2Z1bmN0aW9uJylwYXlIaW50KCk7IHRpY2tDaHJvbWUoKSB9CmZ1bmN0aW9uIHRvZ2dsZVNiKCl7Y29uc3Qgbz1zaWRlYmFyLmNsYXNzTGlzdC50b2dnbGUoJ29wZW4nKTsKIGlmKG8pe2NvbnN0IHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7cy5pZD0nc2NyaW0nO3Mub25jbGljaz1jbG9zZVNiO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocyl9ZWxzZSBjbG9zZVNiKCl9CmZ1bmN0aW9uIGNsb3NlU2IoKXtzaWRlYmFyLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyaW0nKT8ucmVtb3ZlKCl9Ci8qIC0tLS0gbGlnaHQgLyBkYXJrIHRoZW1lLCByZW1lbWJlcmVkIHBlciBkZXZpY2UgLS0tLSAqLwpmdW5jdGlvbiBhcHBseVRoZW1lKHQpewogIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCB0KTsKICBjb25zdCBiPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aGVtZUJ0bicpOwogIGlmKGIpIGIudGV4dENvbnRlbnQgPSB0PT09J2RhcmsnID8gJ+KYgCcgOiAn4pi+JzsKICB0cnl7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjaGFpcm1hbl90aGVtZScsIHQpOyB9Y2F0Y2goZSl7fQogIGlmKHR5cGVvZiBjdXIhPT0ndW5kZWZpbmVkJyAmJiBjdXI9PT0nZW5naW5lJyAmJiB0eXBlb2YgZHJhd0VuZ2luZT09PSdmdW5jdGlvbicpIGRyYXdFbmdpbmUoKTsKfQpmdW5jdGlvbiB0b2dnbGVUaGVtZSgpewogIGNvbnN0IG5vdz1kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJyk9PT0nZGFyayc/J2RhcmsnOidsaWdodCc7CiAgYXBwbHlUaGVtZShub3c9PT0nZGFyayc/J2xpZ2h0JzonZGFyaycpOwp9Ci8qIGxpZ2h0IGlzIHRoZSBkZWZhdWx0IOKAlCBOdW1lcm8gdHJlYXN1cnkgcGFsZXR0ZSAqLwp0cnl7IGFwcGx5VGhlbWUobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NoYWlybWFuX3RoZW1lJyl8fCdsaWdodCcpOyB9Y2F0Y2goZSl7IGFwcGx5VGhlbWUoJ2xpZ2h0Jyk7IH0KZnVuY3Rpb24gaXNEYXJrKCl7IHJldHVybiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJyk9PT0nZGFyaycgfQovKiBlbmdpbmUgcGFsZXR0ZSBmb2xsb3dzIHRoZSB0aGVtZSAqLwpmdW5jdGlvbiBFUCgpeyByZXR1cm4gaXNEYXJrKCkKICA/IHtyaW5nOicjMjUyQTE2JyxsaW5lOicjNEE1NzIyJyxub2RlQmc6JyMxNTE4MEMnLGNvcmUxOicjRThGMEMwJyxjb3JlMjonI0EzQkIyQicsY29yZTM6JyMyQTMzMTAnLAogICAgIGNvcmVUeHQ6JyMwQTBCMDYnLGRlYWQ6JyMzQTQwMjQnLGRlYWRUeHQ6JyM2QTZENUMnLGxhYmVsOicjOUE5QzhBJ30KICA6IHtyaW5nOicjRTNFM0RBJyxsaW5lOicjQjlDNDhBJyxub2RlQmc6JyNGRkZGRkYnLGNvcmUxOicjRkZGRkZGJyxjb3JlMjonIzhGQTMyNicsY29yZTM6JyMzOTQ2MDMnLAogICAgIGNvcmVUeHQ6JyNGRkZGRkYnLGRlYWQ6JyNDRkNGQzMnLGRlYWRUeHQ6JyM5QTlDOTAnLGxhYmVsOicjNkI2RDYyJ30gfQoKLyogLS0tLS0tLS0tLSBwcmltaXRpdmVzIC0tLS0tLS0tLS0gKi8KY29uc3QgUkVOREVSPXt9OwpmdW5jdGlvbiBrcGkodixsLGMscyl7cmV0dXJuIGA8ZGl2IGNsYXNzPSJrcGkiPjx1PiR7bH08L3U+PGIgc3R5bGU9ImNvbG9yOiR7Y3x8J3ZhcigtLXR4dCknfSI+JHt2fTwvYj4ke3M/YDxzPiR7c308L3M+YDonJ308L2Rpdj5gfQpmdW5jdGlvbiBsb2dIdG1sKG4pe2lmKCFTLmxvZ3MubGVuZ3RoKXJldHVybiAnPGRpdiBjbGFzcz0ibW9uby1kaW0iPkxlZGdlciBlbXB0eS48L2Rpdj4nOwogY29uc3QgY29sPXtJTkZPOid2YXIoLS1ibHUpJyxPSzondmFyKC0tZ3JuKScsV0FSTjondmFyKC0tYW1iKScsQ1JJVDondmFyKC0tbWFnKSd9OwogcmV0dXJuICc8ZGl2IGNsYXNzPSJsb2ciPicrUy5sb2dzLnNsaWNlKDAsbikubWFwKGw9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtsLnR9PC9zcGFuPiA8c3BhbiBzdHlsZT0iY29sb3I6JHtjb2xbbC5zZXZdfSI+WyR7bC5zZXZ9XTwvc3Bhbj4gPGI+JHtlc2MobC5zcmMpfTwvYj4g4oCUICR7ZXNjKGwubXNnKX08L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+J30KZnVuY3Rpb24gZmxvb3IoaWQpe3JldHVybiBTLmZsb29ycy5maW5kKGY9PmYuaWQ9PT1pZCl8fHtoZWFsdGg6MCxsb2FkOjAsYWdlbnRzOjAsYWN0aXZlOjB9fQoKLyogLS0tLS0tLS0tLSBIT01FIC0tLS0tLS0tLS0gKi8KTElWRS5ob21lS3BpPSgpPT57CiAgY29uc3QgdD1TLnRlbGVtZXRyeSwgcGVuZD1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PSdQRU5ESU5HJykubGVuZ3RoOwogIGNvbnN0IGFjdGl2ZT1TLmFnZW50cy5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RoOwogIHJldHVybiBrcGkoYWN0aXZlKycgLyAnK1MuYWdlbnRzLmxlbmd0aCwnQWN0aXZlIFN1Yi1BZ2VudHMnLCd2YXIoLS1jeSknLGFjdGl2ZT09PVMuYWdlbnRzLmxlbmd0aD8nRnVsbCByb3N0ZXInOidERUdSQURFRCcpCiAgICtrcGkocGVuZCwnR2F0ZXMgRnJvemVuJyxwZW5kPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScscGVuZD8nQXdhaXRpbmcgY2xlYXJhbmNlJzonUXVldWUgY2xlYXInKQogICAra3BpKGhobW1zcyh0LnVwdGltZV9zKSwnU2VydmVyIFVwdGltZScsJ3ZhcigtLWdybiknLCdwaWQgJyt0LnBpZCkKICAgK2twaSh0LmF2Z19sYXRlbmN5X21zKycgbXMnLCdBdmcgTGF0ZW5jeScsdC5hdmdfbGF0ZW5jeV9tcz41MD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLGZtdCh0LnJlcXVlc3RzKSsnIHJlcXVlc3RzJyl9CkxJVkUuaG9tZUxvYWQ9KCk9PlBJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpOwogIHJldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5hY3RpdmV9LyR7Zi5hZ2VudHN9IGFndCDCtyBIJHtmLmhlYWx0aH0lIMK3IEwke2YubG9hZH0lPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5sb2FkfSU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsJHtwLmNvbG9yfSx2YXIoLS1saW1lKSkiPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyk7CkxJVkUuaG9tZVRlcm09KCk9PmxvZ0h0bWwoMTQpOwpSRU5ERVIuaG9tZT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBpbmZsb3c9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4IiBkYXRhLWxpdmU9ImhvbWVLcGkiPiR7TElWRS5ob21lS3BpKCl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFpcm1hbidzIFN0YW5kaW5nIEFzc2Vzc21lbnQgPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+Tk8gU1VHQVIgQ09BVElORzwvc3Bhbj48L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPiR7Uy5vd25lci5ib290c3RyYXA/JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5DUklUSUNBTDo8L2I+IGJvb3RzdHJhcCBwYXNzd29yZCBzdGlsbCBhY3RpdmUuIFJvdGF0ZSBpdCBub3cg4oCUIHRoZSBwbGFpbnRleHQgY29weSBleGlzdHMgb24gZGlzayB1bnRpbCB5b3UgZG8uJzonQm9vdHN0cmFwIGNyZWRlbnRpYWwgcm90YXRlZCBhbmQgZGVzdHJveWVkLiBHb29kLid9PC9saT4KICAgIDxsaT4ke1MucGF5b3V0PydQYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRyYW5zZmVycyByZXF1aXJlIHNpZ25hdHVyZSArIDJGQSBpbnRlbnQuJzonPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkJMT0NLRVI6PC9iPiBubyBwYXlvdXQgY2hhbm5lbC4gRXZlcnkgZmluYW5jaWFsIGdhdGUgaGFyZC1ibG9ja3Mgc2VydmVyLXNpZGUuJ308L2xpPgogICAgPGxpPiR7cGVuZD9gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7cGVuZH0gb3BlcmF0aW9uKHMpIGZyb3plbjwvYj4gcGVuZGluZyB5b3VyIGNsZWFyYW5jZS5gOidObyBmcm96ZW4gb3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+JHtTLnJ1bm5pbmc/YDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5TWVNURU0gUlVOTklORzwvYj4g4oCUICR7KFMudGFza3N8fFtdKS5maWx0ZXIodD0+dC5lbmFibGVkKS5sZW5ndGh9IHN0YW5kaW5nIG9yZGVycyBleGVjdXRpbmcsICR7KFMudGFza3N8fFtdKS5yZWR1Y2UoKGEsdCk9PmErKHQucnVuc3x8MCksMCl9IGpvYnMgY29tcGxldGVkLmA6JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5TWVNURU0gSEFMVEVEPC9iPiDigJQgbm8gYWdlbnQgd29yayBpcyBleGVjdXRpbmcuIFN0YXJ0IGl0IGluIExpdmUgT3BlcmF0aW9ucy4nfTwvbGk+CiAgICA8bGk+WmVyby1Db3N0OiAke1MuZGVuaWFscy5sZW5ndGh9IHBhaWQgcGF0aChzKSBpbnRlcmNlcHRlZCwgJCR7Uy5zcGVuZC50b0ZpeGVkKDIpfSBhdXRob3JpemVkIHNwZW5kLCAwIG5wbSBkZXBlbmRlbmNpZXMgaW5zdGFsbGVkLjwvbGk+CiAgICA8bGk+TGl2ZSBzeW5jIGFjdGl2ZTogJHt0LmxpdmVfc2Vzc2lvbnN9IGRldmljZSBzZXNzaW9uKHMpIG9uIHRoaXMgaW5zdGFuY2UsIHN0YXRlIHJldmlzaW9uICR7Uy5yZXZ9LjwvbGk+CiAgIDwvdWw+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QaWxsYXIgTG9hZCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPkRFUklWRUQgRlJPTSBSRUFMIFBST0NFU1MgTUVUUklDUzwvc3Bhbj48L2gzPgogICAgPGRpdiBkYXRhLWxpdmU9ImhvbWVMb2FkIj4ke0xJVkUuaG9tZUxvYWQoKX08L2Rpdj48L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmV2ZW51ZSBUZWxlbWV0cnkgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+SU5GTE9XICQke2ZtdChpbmZsb3cpfTwvc3Bhbj48L2gzPiR7c3BhcmsoKX0KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+R3JlZW4gZGFzaGVkIGxpbmUgaXMgdGhlIHNwZW5kIGZsb29yLCBoZWxkIGF0ICQwLjAwIGJ5IGRvY3RyaW5lLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFRlcm1pbmFsIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPlNFUlZFUiBMRURHRVI8L3NwYW4+PC9oMz48ZGl2IGRhdGEtbGl2ZT0iaG9tZVRlcm0iPiR7TElWRS5ob21lVGVybSgpfTwvZGl2PjwvZGl2PmA7Cn07CmZ1bmN0aW9uIHNwYXJrKCl7CiAgY29uc3Qgdj1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLm1hcChyPT5yLmFtdCk7IGNvbnN0IHB0cz0odi5sZW5ndGg/djpbMCwwXSkuc2xpY2UoLTI0KTsKICBjb25zdCBteD1NYXRoLm1heCguLi5wdHMsMSksdz02MDAsaD05MCxzdGVwPXB0cy5sZW5ndGg+MT93LyhwdHMubGVuZ3RoLTEpOnc7CiAgY29uc3QgZD1wdHMubWFwKChwLGkpPT5gJHtpPydMJzonTSd9JHsoaSpzdGVwKS50b0ZpeGVkKDEpfSwkeyhoLShwL214KSooaC0xMiktNikudG9GaXhlZCgxKX1gKS5qb2luKCcgJyk7CiAgcmV0dXJuIGA8c3ZnIHZpZXdCb3g9IjAgMCAke3d9ICR7aH0iIHN0eWxlPSJ3aWR0aDoxMDAlO2hlaWdodDo5MHB4Ij4KICAgPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJzZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzc4OEExRDU1Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNzg4QTFEMDAiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz4KICAgJHtbMCwxLDIsM10ubWFwKGk9PmA8bGluZSB4MT0iMCIgeTE9IiR7aSozMH0iIHgyPSIke3d9IiB5Mj0iJHtpKjMwfSIgc3Ryb2tlPSIjMTAxYTI0Ii8+YCkuam9pbignJyl9CiAgIDxwYXRoIGQ9IiR7ZH0gTCR7d30sJHtofSBMMCwke2h9IFoiIGZpbGw9InVybCgjc2cpIi8+PHBhdGggZD0iJHtkfSIgc3Ryb2tlPSIjNzg4QTFEIiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgPGxpbmUgeDE9IjAiIHkxPSIke2gtNn0iIHgyPSIke3d9IiB5Mj0iJHtoLTZ9IiBzdHJva2U9IiMzMWQ2N2EiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIgc3Ryb2tlLXdpZHRoPSIxLjQiLz48L3N2Zz5gOwp9CgovKiAtLS0tLS0tLS0tIExJVkUgVEVMRU1FVFJZIC0tLS0tLS0tLS0gKi8KTElWRS5zeXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAke2twaSh0LnJzc19tYisnIE1CJywnUHJvY2VzcyBSU1MnLCd2YXIoLS1jeSknLCdoZWFwICcrdC5oZWFwX21iKycvJyt0LmhlYXBfdG90YWxfbWIrJyBNQicpfQogICR7a3BpKHQubG9hZDEsJ0xvYWQgQXZnIDFtJyx0LmxvYWQxPnQuY3B1cz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLHQuY3B1cysnIGNwdXMgwrcgNW0gJyt0LmxvYWQ1KX0KICAke2twaSh0LnN5c19tZW1fcGN0KyclJywnU3lzdGVtIE1lbW9yeScsdC5zeXNfbWVtX3BjdD44NT8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknLCdob3N0ICcrdC5ob3N0bmFtZSl9CiAgJHtrcGkoZm10KHQucmVxdWVzdHMpLCdIVFRQIFJlcXVlc3RzJywndmFyKC0tYmx1KScsZm10KHQuYXBpX2NhbGxzKSsnIGFwaSDCtyAnK3QuZXJyb3JzKycgZXJyb3JzJyl9CiA8L2Rpdj4KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Qcm9jZXNzIEZhY3RzPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNzBweCI+UnVudGltZTwvdGQ+PHRkPiR7dC5ub2RlfSDCtyAke3QucGxhdGZvcm19PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UElEPC90ZD48dGQ+JHt0LnBpZH08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5VcHRpbWU8L3RkPjx0ZD4ke2hobW1zcyh0LnVwdGltZV9zKX08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmcgbGF0ZW5jeTwvdGQ+PHRkPiR7dC5hdmdfbGF0ZW5jeV9tc30gbXMgKGxhc3QgNTAwIHJlcSk8L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdXRoIGZhaWx1cmVzPC90ZD48dGQgc3R5bGU9ImNvbG9yOiR7dC5hdXRoX2ZhaWx1cmVzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QuYXV0aF9mYWlsdXJlc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5MaXZlIHNlc3Npb25zPC90ZD48dGQ+JHt0LmxpdmVfc2Vzc2lvbnN9IG9mICR7dC50b3RhbF9zZXNzaW9uc308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TdGF0ZSBmaWxlPC90ZD48dGQ+JHsodC5kYl9ieXRlcy8xMDI0KS50b0ZpeGVkKDEpfSBLQiDCtyByZXYgJHt0LnN0YXRlX3Jldn08L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5TZXNzaW9uczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkRVUkFCTEUgwrcgMzBkIFRUTDwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Nb25pdG9yczwvdGQ+PHRkPiR7dC5tb25pdG9yc3x8MH0gYm91bmQgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOiR7dC5tb25pdG9yc19kb3duPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3QubW9uaXRvcnNfZG93bnx8MH0gZG93bjwvc3Bhbj48L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5NYWlsIHJlbGF5PC90ZD48dGQ+JHt0LnNtdHBfcmVhZHk/YDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPkFSTUVEPC9zcGFuPiAke3QubWFpbF9zZW50fSBzZW50IC8gJHt0Lm1haWxfZmFpbGVkfSBmYWlsZWRgOic8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5PRkZMSU5FIOKAlCBpbnRlbnQgb25seTwvc3Bhbj4nfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRlcGVuZGVuY2llczwvdGQ+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPjAgSU5TVEFMTEVEIMK3ICQwLjAwPC9zcGFuPjwvdGQ+PC90cj4KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkhvdCBQYXRoczwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICR7dC5ob3RfcGF0aHMubWFwKChbcCxjXSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MocCl9PC90ZD48dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPiR7Zm10KGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkNvdW50ZXJzIGFyZSByZWFsLCBjb2xsZWN0ZWQgaW4tcHJvY2VzcyBzaW5jZSBib290LiBUaGV5IHJlc2V0IHdoZW4gdGhlIHNlcnZlciByZXN0YXJ0cy48L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlcml2ZWQgRmxvb3IgSGVhbHRoPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpO3JldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5oZWFsdGh9JSBoZWFsdGggwrcgJHtmLmxvYWR9JSBsb2FkPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5oZWFsdGh9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+RWFjaCBmbG9vcidzIGhlYWx0aCBpcyBjb21wdXRlZCBmcm9tIHJlYWwgaW5wdXRzOiBhdXRoIGZhaWx1cmVzIGFuZCBkb2N0cmluZSBkZW5pYWxzIGhpdCBTZWN1cml0eTsgbG9hZCBhdmVyYWdlIGFuZCBSU1MgaGl0IE9wZXJhdGlvbnM7IEhUVFAgZXJyb3JzIGFuZCBmcm96ZW4gZ2F0ZXMgaGl0IEVuZ2luZWVyaW5nOyBzdGF0ZS1maWxlIHNpemUgaGl0cyBEYXRhOyBhdXRob3JpemVkIHNwZW5kIGFuZCBwYXlvdXQgc3RhdHVzIGhpdCBTdHJhdGVneS4gU3RhZmZpbmcgcmF0aW8gc2NhbGVzIGFsbCBmaXZlLiBUaGVzZSBtb3ZlIHdoZW4gdGhlIHN5c3RlbSBhY3R1YWxseSBtb3Zlcy48L2Rpdj48L2Rpdj5gfQpSRU5ERVIuc3lzdGVtPSgpPT5gPGRpdiBkYXRhLWxpdmU9InN5cyI+JHtMSVZFLnN5cygpfTwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIEVOR0lORSAtLS0tLS0tLS0tICovClJFTkRFUi5lbmdpbmU9KCk9PmAKIDxkaXYgY2xhc3M9ImVuZ2luZVdyYXAiPjxkaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9InBhZGRpbmc6MTFweCAxM3B4O21hcmdpbi1ib3R0b206MTFweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxiIHN0eWxlPSJsZXR0ZXItc3BhY2luZzoycHg7Zm9udC1zaXplOjEycHgiPk9QVElNQUwgRU5HSU5FPC9iPjxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+S05PV0xFREdFIENPUkU8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7ZW5nRm9jdXM/Jyc6J3AnfSIgb25jbGljaz0iZW5nRm9jdXM9bnVsbDtkcmF3RW5naW5lKCkiPlJhZGlhbDwvYnV0dG9uPgogICAke1BJTExBUlMubWFwKHA9PmA8YnV0dG9uIGNsYXNzPSJidG4gc20gJHtlbmdGb2N1cz09cC5pZD8ncCc6Jyd9IiBvbmNsaWNrPSJlbmdGb2N1cz0ke3AuaWR9O2RyYXdFbmdpbmUoKSI+JHtwLmljb259PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+CiAgPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FudmFzQm94Ij48ZGl2IGNsYXNzPSJncmlkYmciPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJlbmdUb3AiPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iIGlkPSJlbmdNb2RlIj5SQURJQUwgwrcgQUxMIEZMT09SUzwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZW5nVGl0bGUiIGlkPSJlbmdUaXRsZSI+Q0hBSVJNQU4gQ09SRTwvZGl2PjxkaXYgaWQ9ImVuZ1N2ZyI+PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+PGgzPkVuZ2luZSBUZXJtaW5hbDwvaDM+CiAgIDxkaXYgY2xhc3M9InRlcm0iIGlkPSJlbmdUZXJtIj5jaGFpcm1hbi1vcyA6OiBlbmdpbmUgcmVhZHkgwrcgJHtTLmFnZW50cy5sZW5ndGh9IG5vZGVzIGJvdW5kIMK3IGNvc3QgY2VpbGluZyAkMC4wMAphd2FpdGluZyBub2RlIHNlbGVjdGlvbuKApjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGNsYXNzPSJzaWRlIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVuczwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RW50aXR5PC9zcGFuPjxzZWxlY3QgY2xhc3M9ImluIiBpZD0ibGVuc0VudCIgb25jaGFuZ2U9ImRyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9ImFjdGl2ZSI+QWN0aXZlIG9ubHk8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJzdXNwIj5TdXNwZW5kZWQgb25seTwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbjowIj48c3Bhbj5GbG9vcjwvc3Bhbj48c2VsZWN0IGNsYXNzPSJpbiIgb25jaGFuZ2U9ImVuZ0ZvY3VzPXRoaXMudmFsdWU9PT0nYWxsJz9udWxsOit0aGlzLnZhbHVlO2RyYXdFbmdpbmUoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJhbGwiPkFsbCBmbG9vcnM8L29wdGlvbj4ke1BJTExBUlMubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke2VuZ0ZvY3VzPT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7cC5pZH0gwrcgJHtwLm5hbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGVnZW5kPC9oMz48ZGl2IGNsYXNzPSJsZWdlbmQiPgogICAke1BJTExBUlMubWFwKHA9PmA8ZGl2PjxpIHN0eWxlPSJiYWNrZ3JvdW5kOiR7cC5jb2xvcn07Ym94LXNoYWRvdzowIDAgOHB4ICR7cC5jb2xvcn0iPjwvaT4ke3AubmFtZX08L2Rpdj5gKS5qb2luKCcnKX0KICAgPGRpdj48aSBzdHlsZT0iYmFja2dyb3VuZDojZTZlZWY3O2JveC1zaGFkb3c6MCAwIDhweCAjZmZmIj48L2k+Q2hhaXJtYW4gQ29yZTwvZGl2PjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EaXJlY3RvcnkgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmFnZW50cy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9ImRpckxpc3QiPiR7Uy5hZ2VudHMubWFwKGE9PmA8YnV0dG9uIG9uY2xpY2s9InBpY2tOb2RlKCcke2EuaWR9JykiPiR7ZXNjKGEubmFtZSl9PHNwYW4+JHtQSUxMQVJTLmZpbmQocD0+cC5pZD09YS5waWxsYXJJZCkuaWNvbn08L3NwYW4+PC9idXR0b24+YCkuam9pbignJyl8fCc8ZGl2IGNsYXNzPSJtb25vLWRpbSI+ZW1wdHk8L2Rpdj4nfTwvZGl2PjwvZGl2PgogPC9kaXY+PC9kaXY+YDsKZnVuY3Rpb24gZHJhd0VuZ2luZSgpewogIGNvbnN0IGJveD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nU3ZnJyk7IGlmKCFib3gpcmV0dXJuOwogIGNvbnN0IFA9RVAoKTsKICBjb25zdCBlbnQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xlbnNFbnQnKT8udmFsdWV8fCdhbGwnOwogIGxldCBsaXN0PVMuYWdlbnRzLmZpbHRlcihhPT5lbnQ9PT0nYWxsJ3x8KGVudD09PSdhY3RpdmUnP2Euc3RhdHVzPT09J0FDVElWRSc6YS5zdGF0dXMhPT0nQUNUSVZFJykpOwogIGNvbnN0IGZsb29ycz1lbmdGb2N1cz9QSUxMQVJTLmZpbHRlcihwPT5wLmlkPT09ZW5nRm9jdXMpOlBJTExBUlM7CiAgaWYoZW5nRm9jdXMpbGlzdD1saXN0LmZpbHRlcihhPT5hLnBpbGxhcklkPT09ZW5nRm9jdXMpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdNb2RlJykudGV4dENvbnRlbnQ9ZW5nRm9jdXM/J0ZPQ1VTIMK3IEZMT09SIDAnK2VuZ0ZvY3VzOidSQURJQUwgwrcgQUxMIEZMT09SUyc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1RpdGxlJykudGV4dENvbnRlbnQ9ZW5nRm9jdXM/UElMTEFSUy5maW5kKHA9PnAuaWQ9PT1lbmdGb2N1cykubmFtZS50b1VwcGVyQ2FzZSgpOidDSEFJUk1BTiBDT1JFJzsKICBjb25zdCBXPTkwMCxIPTU2MCxjeD1XLzIsY3k9SC8yOyBsZXQgaHVicz0nJyxsaW5rcz0nJyxub2Rlcz0nJyxyaW5ncz0nJzsKICBbMTUwLDIxNSwyNjVdLmZvckVhY2gocj0+cmluZ3MrPWA8Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSIke3J9IiBmaWxsPSJub25lIiBzdHJva2U9IiR7UC5yaW5nfSIgc3Ryb2tlLWRhc2hhcnJheT0iMyA2Ii8+YCk7CiAgY29uc3Qgbj1mbG9vcnMubGVuZ3RoOwogIGZsb29ycy5mb3JFYWNoKChwLGkpPT57CiAgICBjb25zdCBhbmc9KC05MCsoMzYwL24pKmkpKk1hdGguUEkvMTgwLGh4PWN4KzE1MCpNYXRoLmNvcyhhbmcpLGh5PWN5KzE1MCpNYXRoLnNpbihhbmcpOwogICAgbGlua3MrPWA8bGluZSB4MT0iJHtjeH0iIHkxPSIke2N5fSIgeDI9IiR7aHh9IiB5Mj0iJHtoeX0iIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9Ii41NSIgc3Ryb2tlLXdpZHRoPSIxLjQiLz5gOwogICAgaHVicys9YDxnIGNsYXNzPSJub2RlIiBvbmNsaWNrPSJlbmdGb2N1cz0ke2VuZ0ZvY3VzPydudWxsJzpwLmlkfTtkcmF3RW5naW5lKCkiPgogICAgIDxjaXJjbGUgY3g9IiR7aHh9IiBjeT0iJHtoeX0iIHI9IjE3IiBmaWxsPSIke1Aubm9kZUJnfSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utd2lkdGg9IjIiLz4KICAgICA8dGV4dCB4PSIke2h4fSIgeT0iJHtoeSs0fSIgZm9udC1zaXplPSIxMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+JHtwLmljb259PC90ZXh0PgogICAgIDx0ZXh0IHg9IiR7aHh9IiB5PSIke2h5KzMyfSIgZm9udC1zaXplPSI5LjUiIGZpbGw9IiR7cC5jb2xvcn0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC5uYW1lLnNwbGl0KCcgJylbMF0udG9VcHBlckNhc2UoKX08L3RleHQ+PC9nPmA7CiAgICBjb25zdCBraWRzPWxpc3QuZmlsdGVyKGE9PmEucGlsbGFySWQ9PT1wLmlkKTsKICAgIGtpZHMuZm9yRWFjaCgoYSxqKT0+ewogICAgICBjb25zdCBzcHJlYWQ9ZW5nRm9jdXM/TWF0aC5QSSoxLjY6TWF0aC5QSS8obioxLjE1KTsKICAgICAgY29uc3QgdD1raWRzLmxlbmd0aD4xPyhqLyhraWRzLmxlbmd0aC0xKS0uNSk6MCwgYWE9YW5nK3Qqc3ByZWFkLCBSPWVuZ0ZvY3VzPzIzMDooaiUyPzI2NToyMTUpOwogICAgICBjb25zdCB4PWN4K1IqTWF0aC5jb3MoYWEpLHk9Y3krUipNYXRoLnNpbihhYSksZGVhZD1hLnN0YXR1cyE9PSdBQ1RJVkUnOwogICAgICBsaW5rcys9YDxsaW5lIHgxPSIke2h4fSIgeTE9IiR7aHl9IiB4Mj0iJHt4fSIgeTI9IiR7eX0iIHN0cm9rZT0iJHtkZWFkPycjMjQzMDQwJzpwLmNvbG9yfSIgc3Ryb2tlLW9wYWNpdHk9IiR7ZGVhZD8uMzouMzV9IiBzdHJva2Utd2lkdGg9IjEiLz5gOwogICAgICBub2Rlcys9YDxnIGNsYXNzPSJub2RlIiBvbmNsaWNrPSJwaWNrTm9kZSgnJHthLmlkfScpIj48dGl0bGU+JHtlc2MoYS5uYW1lKX08L3RpdGxlPgogICAgICAgPGNpcmNsZSBjeD0iJHt4fSIgY3k9IiR7eX0iIHI9IjkiIGZpbGw9IiR7ZGVhZD9QLm5vZGVCZzpQLm5vZGVCZ30iIHN0cm9rZT0iJHtkZWFkP1AuZGVhZDpwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIxLjYiLz4KICAgICAgIDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSszLjR9IiBmb250LXNpemU9IjguNSIgZmlsbD0iJHtkZWFkP1AuZGVhZFR4dDpwLmNvbG9yfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+QTwvdGV4dD4KICAgICAgICR7ZW5nRm9jdXM/YDx0ZXh0IHg9IiR7eH0iIHk9IiR7eSsyMX0iIGZvbnQtc2l6ZT0iOCIgZmlsbD0iJHtQLmxhYmVsfSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtlc2MoYS5uYW1lLnNsaWNlKDAsMTYpKX08L3RleHQ+YDonJ308L2c+YDsKICAgIH0pOwogIH0pOwogIGJveC5pbm5lckhUTUw9YDxzdmcgdmlld0JveD0iMCAwICR7V30gJHtIfSI+CiAgIDxkZWZzPjxyYWRpYWxHcmFkaWVudCBpZD0iY29yZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIke1AuY29yZTF9Ii8+PHN0b3Agb2Zmc2V0PSIuNTUiIHN0b3AtY29sb3I9IiR7UC5jb3JlMn0iLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiR7UC5jb3JlM30iLz48L3JhZGlhbEdyYWRpZW50PgogICA8ZmlsdGVyIGlkPSJnbG93Ij48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI1IiByZXN1bHQ9ImIiLz48ZmVNZXJnZT48ZmVNZXJnZU5vZGUgaW49ImIiLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PC9kZWZzPgogICAke3JpbmdzfSR7bGlua3N9PGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iMzQiIGZpbGw9InVybCgjY29yZSkiIGZpbHRlcj0idXJsKCNnbG93KSIgb3BhY2l0eT0iLjkyIi8+CiAgIDxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjQ2IiBmaWxsPSJub25lIiBzdHJva2U9IiR7UC5jb3JlMn01NSIvPgogICA8dGV4dCB4PSIke2N4fSIgeT0iJHtjeSszfSIgZm9udC1zaXplPSIxMCIgZmlsbD0iJHtQLmNvcmVUeHR9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXdlaWdodD0iNzAwIj5DT1JFPC90ZXh0PgogICAke2h1YnN9JHtub2Rlc308L3N2Zz5gOwp9CmZ1bmN0aW9uIHBpY2tOb2RlKGlkKXtjb25zdCBhPVMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKTtpZighYSlyZXR1cm47CiBjb25zdCB0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdUZXJtJyk7CiBpZih0KXQudGV4dENvbnRlbnQ9YGNoYWlybWFuLW9zIDo6IG5vZGUgJHthLmlkfVxubmFtZSAgICAgJHthLm5hbWV9XG5mbG9vciAgICAke2EucGlsbGFySWR9IMK3ICR7UElMTEFSUy5maW5kKHA9PnAuaWQ9PWEucGlsbGFySWQpLm5hbWV9XG5zdGF0dXMgICAke2Euc3RhdHVzfVxuY29zdCAgICAgJHthLmNvc3R9XG50b29scyAgICAke2EudG9vbHMuam9pbignLCAnKX1cbnNjb3BlICAgICR7YS5yb2xlfWA7CiBzaG93WWFtbChpZCl9CgovKiAtLS0tLS0tLS0tIEdBVEVTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmdhdGVzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmFpc2UgUGVybWlzc2lvbiBHYXRlIDxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPjQtU1RFUCBTT1AgwrcgU0VSVkVSIEVORk9SQ0VEPC9zcGFuPjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3BlcmF0aW9uIFRpdGxlPC9zcGFuPjxpbnB1dCBpZD0iZ1RpdGxlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJEZXBsb3kgcHJpY2luZy1zZXJ2aWNlIHYyLjQiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q2xhc3M8L3NwYW4+PHNlbGVjdCBpZD0iZ0NsYXNzIiBjbGFzcz0iaW4iPgogICAgPG9wdGlvbj5ERVBMT1lNRU5UPC9vcHRpb24+PG9wdGlvbj5EQiBTQ0hFTUEgQ0hBTkdFPC9vcHRpb24+PG9wdGlvbj5DT0RFIE1PRElGSUNBVElPTjwvb3B0aW9uPgogICAgPG9wdGlvbj5GSU5BTkNJQUwgVFJBTlNGRVI8L29wdGlvbj48b3B0aW9uPkFDQ0VTUyBHUkFOVDwvb3B0aW9uPjxvcHRpb24+RVhURVJOQUwgVE9PTCBBRE9QVElPTjwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4xIMK3IE9iamVjdGl2ZSAmYW1wOyBzdWNjZXNzIGNyaXRlcmlhPC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ09iaiIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MiDCtyBBZ2VudHMgLyB0b29scyBhc3NpZ25lZCAmYW1wOyB3aHk8L3NwYW4+PHRleHRhcmVhIGlkPSJnSnVzdCIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MyDCtyBSb2xsYmFjayAmYW1wOyBzYWZlZ3VhcmRzPC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ1NhZmUiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJsYXN0IFJhZGl1czwvc3Bhbj48c2VsZWN0IGlkPSJnUmlzayIgY2xhc3M9ImluIj48b3B0aW9uPkxPVzwvb3B0aW9uPjxvcHRpb24+TUVESVVNPC9vcHRpb24+PG9wdGlvbj5ISUdIPC9vcHRpb24+PG9wdGlvbj5TRVZFUkU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlRvb2wgQ29zdCAvIENyZWRpdHMgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJnQ29zdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIG1pbj0iMCIgdmFsdWU9IjAiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VmFsdWUgYXQgUmlzayAoVVNEKTwvc3Bhbj48aW5wdXQgaWQ9ImdBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPSIwIj48L2xhYmVsPjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJlZSBBbHRlcm5hdGl2ZSBSb3V0ZSAocmVxdWlyZWQgaWYgY29zdCAmZ3Q7IDApPC9zcGFuPjxpbnB1dCBpZD0iZ0ZyZWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Ik9wZW4tc291cmNlIC8gc2VsZi1ob3N0ZWQgLyBmcmVlLXRpZXIgcGF0aCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icmFpc2VHYXRlKCkiPlNVQk1JVCBGT1IgT1dORVIgQ0xFQVJBTkNFPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBRdWV1ZSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1MuZ2F0ZXMubGVuZ3RofTwvc3Bhbj48L2gzPgogICR7Uy5nYXRlcy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5PcGVyYXRpb248L3RoPjx0aD5DbGFzczwvdGg+PHRoPlJpc2s8L3RoPjx0aD5Db3N0PC90aD48dGg+U3RhdHVzPC90aD48dGg+PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Uy5nYXRlcy5tYXAoZz0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2cuaWR9PC90ZD48dGQ+JHtlc2MoZy50aXRsZSl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7Zy50fTwvZGl2PjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2cuY2xzfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke1snSElHSCcsJ1NFVkVSRSddLmluY2x1ZGVzKGcucmlzayk/J3QtcmVkJzpnLnJpc2s9PT0nTUVESVVNJz8ndC1hbWInOid0LWdybid9Ij4ke2cucmlza308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLmNvc3Q/J3QtcmVkJzondC1ncm4nfSI+JHtnLmNvc3Q/JyQnK2cuY29zdDonRlJFRSd9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Zy5zdGF0dXM9PT0nQVBQUk9WRUQnPyd0LWdybic6Zy5zdGF0dXM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke2cuc3RhdHVzfTwvc3Bhbj48L3RkPgogICA8dGQ+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJvcGVuR2F0ZSgnJHtnLmlkfScpIj5SZXZpZXc8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBnYXRlcyByYWlzZWQuIE5vdGhpbmcgaXMgZXhlY3V0aW5nLjwvZGl2Pid9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcmFpc2VHYXRlKCl7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9nYXRlJyx7dGl0bGU6Z1RpdGxlLnZhbHVlLnRyaW0oKSxjbHM6Z0NsYXNzLnZhbHVlLG9iajpnT2JqLnZhbHVlLnRyaW0oKSwKICAgIGp1c3Q6Z0p1c3QudmFsdWUudHJpbSgpLHNhZmU6Z1NhZmUudmFsdWUudHJpbSgpLHJpc2s6Z1Jpc2sudmFsdWUsY29zdDorZ0Nvc3QudmFsdWV8fDAsYW10OitnQW10LnZhbHVlfHwwLGZyZWU6Z0ZyZWUudmFsdWUudHJpbSgpfSk7CiAgIHJlbmRlcigpOyBmbGFzaCgnR2F0ZSAnK3IuaWQrJyByYWlzZWQgwrcgZnJvemVuIHNlcnZlci1zaWRlJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBvcGVuR2F0ZShpZCl7CiAgY29uc3QgZz1TLmdhdGVzLmZpbmQoeD0+eC5pZD09PWlkKTsKICBjb25zdCBmaW5CbG9jaz1nLmNscz09PSdGSU5BTkNJQUwgVFJBTlNGRVInJiYhUy5wYXlvdXQsIGNvc3RCbG9jaz1nLmNvc3Q+MDsKICBtb2RhbChgPGgzPiR7ZXNjKGcudGl0bGUpfTwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPiR7Zy5pZH0gwrcgJHtnLmNsc30gwrcgcmFpc2VkICR7Zy50fTwvZGl2PgogICR7ZmluQmxvY2s/YDxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+PGI+SEFSRCBCTE9DSy48L2I+IEZpbmFuY2lhbCB0cmFuc2ZlciB3aXRoIG5vIHBheW91dCBjaGFubmVsIHNlYWxlZC4gVGhlIHNlcnZlciB3aWxsIHJlamVjdCBhcHByb3ZhbC48L2Rpdj5gOicnfQogICR7Y29zdEJsb2NrP2A8ZGl2IGNsYXNzPSJ3YXJuYm94Ij48Yj5aRVJPLUNPU1QgRE9DVFJJTkUgRkxBRy48L2I+IFRoaXMgZGVtYW5kcyAkJHtnLmNvc3R9LiBUaGUgQ2hhaXJtYW4gZG9lcyBub3QgcGF5LiBBcHByb3ZpbmcgaXMgYW4gZXhwbGljaXQgT3duZXIgb3ZlcnJpZGUuIEZyZWUgcm91dGUgb24gcmVjb3JkOiA8ZW0+JHtlc2MoZy5mcmVlfHwnbm9uZScpfTwvZW0+PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MSDCtyBPYmplY3RpdmU8L2gzPjxkaXY+JHtlc2MoZy5vYmopfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4yIMK3IEFnZW50IEp1c3RpZmljYXRpb248L2gzPjxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwIj4ke2VzYyhnLmp1c3QpfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDExcHgiPjxoMz4zIMK3IFNhZmVndWFyZHMgJmFtcDsgUm9sbGJhY2s8L2gzPjxkaXY+JHtlc2MoZy5zYWZlKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjxzcGFuIGNsYXNzPSJ0YWcgJHtnLnJpc2s9PT0nTE9XJz8ndC1ncm4nOid0LXJlZCd9Ij5CTEFTVCAke2cucmlza308L3NwYW4+CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtnLmNvc3Q/J3QtcmVkJzondC1ncm4nfSI+Q09TVCAke2cuY29zdD8nJCcrZy5jb3N0OickMC4wMCd9PC9zcGFuPgogICAke2cuYW10P2A8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5BVCBSSVNLICQke2ZtdChnLmFtdCl9PC9zcGFuPmA6Jyd9CiAgIDxzcGFuIGNsYXNzPSJ0YWcgJHtnLnN0YXR1cz09PSdBUFBST1ZFRCc/J3QtZ3JuJzpnLnN0YXR1cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7Zy5zdGF0dXN9PC9zcGFuPjwvZGl2PgogICR7Zy5zdGF0dXM9PT0nUEVORElORyc/YDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+NCDCtyBPd25lciBjcnlwdG9ncmFwaGljIGNsZWFyYW5jZSDigJQgcmUtZW50ZXIgcGFzc3dvcmQ8L3NwYW4+CiAgIDxpbnB1dCBpZD0iZ1B3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48ZGl2IGNsYXNzPSJlcnIiIGlkPSJnRXJyIj48L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siICR7ZmluQmxvY2s/J2Rpc2FibGVkJzonJ30gb25jbGljaz0iZGVjaWRlKCcke2cuaWR9JywxKSI+JHtjb3N0QmxvY2s/J09WRVJSSURFICZhbXA7IEFVVEhPUklaRSc6J0FVVEhPUklaRSBFWEVDVVRJT04nfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlY2lkZSgnJHtnLmlkfScsMCkiPkRFTlkgJmFtcDsgVEVSTUlOQVRFPC9idXR0b24+CiAgICR7Y29zdEJsb2NrP2A8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlcm91dGUoJyR7Zy5pZH0nKSI+UkVST1VURSBGUkVFPC9idXR0b24+YDonJ30KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YAogIDpgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0ibW9uby1kaW0iPlJlc29sdmVkICR7ZXNjKGcucmVzb2x2ZWR8fCcnKX08L3NwYW4+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YH1gKTsKfQphc3luYyBmdW5jdGlvbiBkZWNpZGUoaWQsb2spewogIGNvbnN0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dFcnInKTsgZS50ZXh0Q29udGVudD0nJzsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9nYXRlL2RlY2lkZScse2lkLG9rOiEhb2sscHc6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dQdycpLnZhbHVlfSk7CiAgICBjbG9zZU1vZGFsKCk7IHJlbmRlcigpOyBmbGFzaCgnR2F0ZSAnK2lkKycgcmVzb2x2ZWQnKTsKICB9Y2F0Y2goeCl7IGUudGV4dENvbnRlbnQ9eC5tZXNzYWdlIH0KfQphc3luYyBmdW5jdGlvbiByZXJvdXRlKGlkKXsgYXdhaXQgQVBJKCcvYXBpL2dhdGUvcmVyb3V0ZScse2lkfSk7IGNsb3NlTW9kYWwoKTsgcmVuZGVyKCk7IGZsYXNoKCdSZXJvdXRlZCDCtyAkMC4wMCcpIH0KCi8qIC0tLS0tLS0tLS0gQUdFTlRTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmFnZW50cz0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbW1pc3Npb24gQWdlbnQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmFtZTwvc3Bhbj48aW5wdXQgaWQ9ImFOYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJMZWRnZXIgU2VudGluZWwiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QaWxsYXI8L3NwYW4+PHNlbGVjdCBpZD0iYVBpbCIgY2xhc3M9ImluIj4ke1BJTExBUlMubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9Ij4ke3AuaWR9IMK3ICR7cC5uYW1lfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5PcGVyYXRpb25hbCBTY29wZTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImFSb2xlIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBlcm1pdHRlZCBUb29scyAoY29tbWEgc2VwYXJhdGVkKTwvc3Bhbj48aW5wdXQgaWQ9ImFUb29scyIgY2xhc3M9ImluIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29zdCBQb2xpY3k8L3NwYW4+PHNlbGVjdCBpZD0iYUNvc3QiIGNsYXNzPSJpbiI+CiAgIDxvcHRpb24+RlJFRS1USUVSLU9OTFk8L29wdGlvbj48b3B0aW9uPlNFTEYtSE9TVEVELU9OTFk8L29wdGlvbj48b3B0aW9uPk9XTkVSLU9WRVJSSURFLVBBSUQ8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb21taXNzaW9uKCkiPkNPTU1JU1NJT04gJmFtcDsgQklORDwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvc3RlciBEaXN0cmlidXRpb248L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCksbT1NYXRoLm1heCgxLC4uLlMuZmxvb3JzLm1hcCh4PT54LmFnZW50cykpOwogICByZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5hY3RpdmV9LyR7Zi5hZ2VudHN9PC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5hZ2VudHMvbSoxMDB9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFsbCBhZ2VudHMgaW5oZXJpdCB0aGUgWmVyby1Db3N0IERvY3RyaW5lIHVubGVzcyBzZXQgdG8gT1dORVItT1ZFUlJJREUtUEFJRC48L2Rpdj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5BY3RpdmUgUm9zdGVyIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+JHtTLmFnZW50cy5maWx0ZXIoYT0+YS5zdGF0dXM9PT0nQUNUSVZFJykubGVuZ3RofSBBQ1RJVkU8L3NwYW4+PC9oMz4KICR7Uy5hZ2VudHMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+QWdlbnQ8L3RoPjx0aD5GbG9vcjwvdGg+PHRoPlRvb2xzPC90aD48dGg+Q29zdDwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICR7Uy5hZ2VudHMubWFwKGE9Pntjb25zdCBwPVBJTExBUlMuZmluZCh4PT54LmlkPT1hLnBpbGxhcklkKTtyZXR1cm4gYDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2EuaWR9PC90ZD4KICA8dGQ+PGI+JHtlc2MoYS5uYW1lKX08L2I+PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGEucm9sZSl9PC9kaXY+PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke3AuY2xzfSI+JHtwLmljb259ICR7YS5waWxsYXJJZH08L3NwYW4+PC90ZD4KICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2EudG9vbHMubWFwKGVzYykuam9pbignLCAnKX08L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7YS5jb3N0PT09J09XTkVSLU9WRVJSSURFLVBBSUQnPyd0LWFtYic6J3QtZ3JuJ30iPiR7YS5jb3N0fTwvc3Bhbj48L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7YS5zdGF0dXM9PT0nQUNUSVZFJz8ndC1ncm4nOid0LWRpbSd9Ij4ke2Euc3RhdHVzfTwvc3Bhbj48L3RkPgogIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InNob3dZYW1sKCcke2EuaWR9JykiPllBTUw8L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ0b2coJyR7YS5pZH0nKSI+JHthLnN0YXR1cz09PSdBQ1RJVkUnPydTdXNwZW5kJzonUmVpbnN0YXRlJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJraWxsKCcke2EuaWR9JykiPktpbGw8L2J1dHRvbj48L3RkPjwvdHI+YH0pLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Sb3N0ZXIgZW1wdHkuPC9kaXY+J308L2Rpdj5gOwpmdW5jdGlvbiB5YW1sRm9yKGEpe2NvbnN0IHA9UElMTEFSUy5maW5kKHg9PnguaWQ9PWEucGlsbGFySWQpOwogcmV0dXJuIGBBZ2VudF9EZWZpbml0aW9uOgogIE5hbWU6ICIke2EubmFtZX0iCiAgUGlsbGFyOiAiJHtwLm5hbWV9IgogIFJvbGU6ICIke2Eucm9sZX0iCiAgUGVybWl0dGVkX1Rvb2xzOiBbJHthLnRvb2xzLm1hcCh0PT5gIiR7dH0iYCkuam9pbignLCAnKX1dCiAgU3VwZXJ2aXNvcjogIkNoYWlybWFuIEFnZW50IE9TIgogIEFnZW50X0lEOiAiJHthLmlkfSIKICBDb3N0X1BvbGljeTogIiR7YS5jb3N0fSIKICBDb21taXNzaW9uZWQ6ICIke2EudH0iCiAgSW5zdHJ1Y3Rpb246IHwKICAgIEV4ZWN1dGUgdGFza3Mgc3RyaWN0bHkgd2l0aGluIHNjb3BlLiBSZXBvcnQgYWxsIGxvZ3MsIGFub21hbGllcyBhbmQKICAgIGNvbXBsZXRpb24gbWV0cmljcyBkaXJlY3RseSB0byB0aGUgQ2hhaXJtYW4gdGVybWluYWwuIERvIG5vdCBhdHRlbXB0CiAgICB1bmFwcHJvdmVkIHNpZGUgZWZmZWN0cy4KICAgIFpFUk8tQ09TVCBET0NUUklORTogbmV2ZXIgcHVyY2hhc2UsIHN1YnNjcmliZSwgb3IgY29uc3VtZSBwYWlkIGNyZWRpdHMuCiAgICBJZiBhIHRvb2wsIHNpdGUgb3IgQVBJIGRlbWFuZHMgcGF5bWVudCwgaGFsdCwgZmluZCBhIGZyZWUsIG9wZW4tc291cmNlLAogICAgc2VsZi1ob3N0ZWQgb3IgZnJlZS10aWVyIGVxdWl2YWxlbnQsIGFuZCByZXBvcnQgdGhlIHN1YnN0aXR1dGlvbi4KICAgIEVzY2FsYXRlIHRvIHRoZSBDaGFpcm1hbiBvbmx5IGlmIG5vIGxhd2Z1bCBmcmVlIHJvdXRlIGV4aXN0cy4KICAgIEFueSBkZXBsb3ltZW50LCBzY2hlbWEgY2hhbmdlLCBjb2RlIG1vZGlmaWNhdGlvbiBvciBmaW5hbmNpYWwgdHJhbnNmZXIKICAgIG11c3QgYmUgcmFpc2VkIGFzIGEgUGVybWlzc2lvbiBHYXRlIGFuZCBmcm96ZW4gdW50aWwgT3duZXIgY2xlYXJhbmNlLmB9CmFzeW5jIGZ1bmN0aW9uIGNvbW1pc3Npb24oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9hZ2VudCcse25hbWU6YU5hbWUudmFsdWUudHJpbSgpLHBpbGxhcklkOithUGlsLnZhbHVlLHJvbGU6YVJvbGUudmFsdWUudHJpbSgpLAogICAgdG9vbHM6YVRvb2xzLnZhbHVlLnNwbGl0KCcsJykubWFwKHM9PnMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbiksY29zdDphQ29zdC52YWx1ZX0pOwogICByZW5kZXIoKTsgZmxhc2goJ0FnZW50IGJvdW5kJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBzaG93WWFtbChpZCl7Y29uc3QgYT1TLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCk7CiBtb2RhbChgPGgzPiR7ZXNjKGEubmFtZSl9PC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+JHthLmlkfSDCtyAke2Euc3RhdHVzfTwvZGl2PgogPHByZSBjbGFzcz0ieWFtbCI+JHtlc2MoeWFtbEZvcihhKSl9PC9wcmU+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxM3B4Ij4KIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb3B5WSgnJHthLmlkfScpIj5Db3B5IFlBTUw8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKX0KZnVuY3Rpb24gY29weVkoaWQpe25hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCh5YW1sRm9yKFMuYWdlbnRzLmZpbmQoeD0+eC5pZD09PWlkKSkpO2ZsYXNoKCdZQU1MIGNvcGllZCcpfQphc3luYyBmdW5jdGlvbiB0b2coaWQpe2F3YWl0IEFQSSgnL2FwaS9hZ2VudC90b2dnbGUnLHtpZH0pO3JlbmRlcigpfQphc3luYyBmdW5jdGlvbiBraWxsKGlkKXtpZighY29uZmlybSgnRGVjb21taXNzaW9uICcraWQrJz8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2FnZW50L2tpbGwnLHtpZH0pO3JlbmRlcigpO2ZsYXNoKCdEZWNvbW1pc3Npb25lZCcpfQoKLyogLS0tLS0tLS0tLSBPUkcgQ0hBUlQgLS0tLS0tLS0tLSAqLwpSRU5ERVIub3JnY2hhcnQ9KCk9PmA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tbWFuZCBEZXBlbmRlbmN5IEdyYXBoPC9oMz48ZGl2IGNsYXNzPSJ0dyI+CiA8c3ZnIHZpZXdCb3g9IjAgMCA5MDAgNDMwIiBzdHlsZT0ibWluLXdpZHRoOjcyMHB4O3dpZHRoOjEwMCUiPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFyIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI4IiByZWZZPSIzIiBvcmllbnQ9ImF1dG8iPjxwYXRoIGQ9Ik0wLDAgTDAsNiBMOCwzIHoiIGZpbGw9InZhcigtLXN0cm9rZTIpIi8+PC9tYXJrZXI+PC9kZWZzPgogIDxyZWN0IHg9IjMxNSIgeT0iMTQiIHdpZHRoPSIyNzAiIGhlaWdodD0iNTIiIHJ4PSIxMCIgZmlsbD0idmFyKC0tZ2xhc3MyKSIgc3Ryb2tlPSIjNzg4QTFEIi8+CiAgPHRleHQgeD0iNDUwIiB5PSIzOCIgZmlsbD0iIzc4OEExRCIgZm9udC1zaXplPSIxMyIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q0hBSVJNQU4gQUdFTlQ8L3RleHQ+CiAgPHRleHQgeD0iNDUwIiB5PSI1NSIgZmlsbD0iIzZCNkQ2MiIgZm9udC1zaXplPSI5LjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkV4ZWN1dGl2ZSBDb21tYW5kIFRvd2VyIMK3IFplcm8tQ29zdCBBdXRob3JpdHk8L3RleHQ+CiAgJHtQSUxMQVJTLm1hcCgocCxpKT0+e2NvbnN0IHk9MTA0K2kqNjQsZj1mbG9vcihwLmlkKTtyZXR1cm4gYAogICA8cGF0aCBkPSJNNDUwLDY2IEM0NTAsJHt5LTIwfSAyNTAsJHt5LTIwfSAyNTAsJHt5KzE4fSIgc3Ryb2tlPSJ2YXIoLS1zdHJva2UyKSIgZmlsbD0ibm9uZSIgbWFya2VyLWVuZD0idXJsKCNhcikiLz4KICAgPHJlY3QgeD0iMjUwIiB5PSIke3l9IiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQ2IiByeD0iOSIgZmlsbD0idmFyKC0tcGFuZWwpIiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIuNyIvPgogICA8dGV4dCB4PSIyNjgiIHk9IiR7eSsyMH0iIGZpbGw9InZhcigtLXR4dCkiIGZvbnQtc2l6ZT0iMTEuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+JHtwLmljb259ICR7cC5pZH0uICR7cC5uYW1lfTwvdGV4dD4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMzV9IiBmaWxsPSIjNkI2RDYyIiBmb250LXNpemU9IjkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC51bml0c308L3RleHQ+CiAgIDx0ZXh0IHg9IjYzMiIgeT0iJHt5KzI4fSIgZmlsbD0iJHtwLmNvbG9yfSIgZm9udC1zaXplPSIxMCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgdGV4dC1hbmNob3I9ImVuZCI+JHtmLmFnZW50c30gYWd0IMK3ICR7Zi5oZWFsdGh9JTwvdGV4dD5gfSkuam9pbignJyl9CiAgPHBhdGggZD0iTTY2MCwxMjcgQzc1MCwxMjcgNzUwLDQxNSA0NzAsNDE1IiBzdHJva2U9InZhcigtLXN0cm9rZTIpIiBmaWxsPSJub25lIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIG1hcmtlci1lbmQ9InVybCgjYXIpIi8+CiAgPHRleHQgeD0iNzA1IiB5PSIyODUiIGZpbGw9IiM5QTlDOTAiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5pbnNpZ2h0IOKGkiB0b3dlcjwvdGV4dD48L3N2Zz48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Fc2NhbGF0aW9uIExhdzwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPkVzY2FsYXRpb24gaXMgdXB3YXJkIG9ubHkuIE5vIGxhdGVyYWwgZmxvb3ItdG8tZmxvb3IgY29tbWFuZCB3aXRob3V0IGEgQ2hhaXJtYW4gZ2F0ZS48L2xpPgogIDxsaT5TZWN1cml0eSAmYW1wOyBBdWRpdCBob2xkcyB2ZXRvIG92ZXIgdGhlIHJlbWFpbmluZyBmb3VyIGZsb29ycyBhbmQgbWF5IGZyZWV6ZSBhbnkgZ2F0ZSBtaWQtZmxpZ2h0LjwvbGk+CiAgPGxpPk5vIHBhdGggZXhpc3RzIGZyb20gYSBwdWJsaWMgdXNlciB0byBhIGZsb29yLiBFdmVyeSByb3V0ZSB0ZXJtaW5hdGVzIGF0IHRoZSBDaGFpcm1hbi48L2xpPgogIDxsaT5BbnkgYWdlbnQgbWVldGluZyBhIHBheXdhbGwgaGFsdHMgYW5kIHJlcG9ydHMgdXB3YXJkIOKAlCBpdCBuZXZlciBzcGVuZHMuPC9saT48L3VsPjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNLSUxMUyAtLS0tLS0tLS0tICovClJFTkRFUi5za2lsbHM9KCk9Pntjb25zdCBtPXt9O1MuYWdlbnRzLmZvckVhY2goYT0+YS50b29scy5mb3JFYWNoKHQ9PnsobVt0XT1tW3RdfHxbXSkucHVzaChhLm5hbWUpfSkpOwogY29uc3Qgaz1PYmplY3Qua2V5cyhtKS5zb3J0KCk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Ub29sIFN1cmZhY2UgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij4ke2subGVuZ3RofSBESVNUSU5DVDwvc3Bhbj48L2gzPgogPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPkV2ZXJ5IHRvb2wgaXMgYm91bmQgdG8gYXQgbGVhc3Qgb25lIGFnZW50IGFuZCBjb25zdHJhaW5lZCBieSB0aGF0IGFnZW50J3MgY29zdCBwb2xpY3kuIFVuYm91bmQgaW52b2NhdGlvbiBpcyBhbiB1bmFwcHJvdmVkIHNpZGUgZWZmZWN0LjwvZGl2PgogPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5Ub29sPC90aD48dGg+Qm91bmQgQWdlbnRzPC90aD48dGg+RXhwb3N1cmU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke2subWFwKHQ9PmA8dHI+PHRkPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHQpfTwvYj48L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bVt0XS5tYXAoZXNjKS5qb2luKCcsICcpfTwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHttW3RdLmxlbmd0aD4yPyd0LWFtYic6J3QtZ3JuJ30iPiR7bVt0XS5sZW5ndGg+Mj8nV0lERSc6J05BUlJPVyd9PC9zcGFuPjwvdGQ+PC90cj5gKS5qb2luKCcnKXx8Jzx0cj48dGQgY29sc3Bhbj0iMyIgY2xhc3M9Im1vbm8tZGltIj5ub25lPC90ZD48L3RyPid9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CgovKiAtLS0tLS0tLS0tIFpFUk8gQ09TVCAtLS0tLS0tLS0tICovClJFTkRFUi56ZXJvY29zdD0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKIhSBaRVJPLUNPU1QgRE9DVFJJTkUgwrcgQUJTT0xVVEU8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+VGhlIENoYWlybWFuIGRvZXMgbm90IHBheS48L2I+IE5vIHN1YnNjcmlwdGlvbnMsIG5vIGNyZWRpdCB0b3AtdXBzLCBubyBtZXRlcmVkIEFQSSBwdXJjaGFzZXMsIG5vIGNvbnZlcnRpbmcgdHJpYWxzLjwvbGk+CiAgIDxsaT5IaXR0aW5nIGEgcGF5d2FsbCwgYW4gYWdlbnQgPGI+aGFsdHM8L2I+LCBmaW5kcyBhIGZyZWUgLyBvcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIGVxdWl2YWxlbnQsIGFuZCByZXBvcnRzIHRoZSBzdWJzdGl0dXRpb24uPC9saT4KICAgPGxpPk5vIGZyZWUgcm91dGUg4oeSIHRoZSBDaGFpcm1hbiBzdGF0ZXMgcGxhaW5seSB0aGUgb2JqZWN0aXZlIGlzIHVucmVhY2hhYmxlIGF0IHplcm8gY29zdC4gSXQgbmV2ZXIgcXVpZXRseSBzcGVuZHMuPC9saT4KICAgPGxpPkZyZWUtdGllciByb3RhdGlvbiBhbmQgcXVvdGEgbWFuYWdlbWVudCBhcmUgbGVnaXRpbWF0ZS4gRnJhdWQsIHN0b2xlbiBrZXlzLCBsaWNlbmNlIHZpb2xhdGlvbiBhbmQgVG9TIGNpcmN1bXZlbnRpb24gYXJlIDxiPnJlZnVzZWQgb3V0cmlnaHQ8L2I+IGFuZCBsb2dnZWQgQ1JJVC48L2xpPgogICA8bGk+T3duZXIgbWF5IG92ZXJyaWRlIHBlci1nYXRlLiBPdmVycmlkZXMgaGl0IGEgdmlzaWJsZSBzcGVuZCBjb3VudGVyLCBuZXZlciBoaWRkZW4uPC9saT4KICAgPGxpPjxiPlByb29mLCBub3Qgc2xvZ2FuOjwvYj4gdGhpcyBiYWNrZW5kIHJ1bnMgb24gTm9kZSBjb3JlIG1vZHVsZXMgb25seSDigJQgMCBucG0gcGFja2FnZXMsIDAgcGFpZCBzZXJ2aWNlcywgMCBBUEkga2V5cy48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdBdXRob3JpemVkIFNwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ0xpZmV0aW1lJyl9CiAgJHtrcGkoUy5kZW5pYWxzLmxlbmd0aCwnUGFpZCBQYXRocyBJbnRlcmNlcHRlZCcsJ3ZhcigtLWFtYiknLCdCbG9ja2VkIG9yIHJlcm91dGVkJyl9CiAgJHtrcGkoJyQnK1MuZGVuaWFscy5yZWR1Y2UoKGEsYik9PmErYi5jb3N0LDApLnRvRml4ZWQoMiksJ1NwZW5kIEF2b2lkZWQnLCd2YXIoLS1ncm4pJywnRG9jdHJpbmUgc2F2aW5ncycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlN1YnN0aXR1dGlvbiBSb3V0aW5nIFRhYmxlPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogIDx0aGVhZD48dHI+PHRoPlBhaWQgRGVtYW5kPC90aD48dGg+RnJlZSBSb3V0ZTwvdGg+PHRoPk93bmluZyBBZ2VudDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke0ZSRUVfUk9VVEVTLm1hcCgoW2EsYixjXSk9PmA8dHI+PHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPiR7ZXNjKGEpfTwvc3Bhbj48L3RkPjx0ZD4ke2VzYyhiKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGMpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JbnRlcmNlcHRpb24gTG9nPC9oMz4ke1MuZGVuaWFscy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPk9wZXJhdGlvbjwvdGg+PHRoPkRlbWFuZGVkPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMuZGVuaWFsc10ucmV2ZXJzZSgpLm1hcChkPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC50fTwvdGQ+PHRkPiR7ZXNjKGQub3ApfTwvdGQ+PHRkIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4kJHtkLmNvc3R9PC90ZD48L3RyPmApLmpvaW4oJycpfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYWlkIGRlbWFuZHMgZW5jb3VudGVyZWQgeWV0LjwvZGl2Pid9PC9kaXY+YDsKCi8qIC0tLS0tLS0tLS0gRklOQU5DRVMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZmluYW5jZXM9KCk9PnsKIGNvbnN0IHRvdD1TLnJldmVudWUucmVkdWNlKChhLGIpPT5hK2IuYW10LDApLGluZmxvdz1TLnJldmVudWUuZmlsdGVyKHI9PnIuYW10PjApLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKTsKIHJldHVybiBgJHshUy5wYXlvdXQ/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+U0FGRSBNT0RFPC9oMz4KICA8ZGl2Pk5vIHBheW91dCBjaGFubmVsIHNlYWxlZC4gVGhlIHNlcnZlciByZWplY3RzIGFwcHJvdmFsIG9uIGV2ZXJ5IHRyYW5zZmVyIGdhdGUuIENvbmZpZ3VyZSB0aGUgVmF1bHQgZmlyc3QuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPgogICR7a3BpKCckJytmbXQoaW5mbG93KSwnUmVjb3JkZWQgSW5mbG93JywndmFyKC0tZ3JuKScpfQogICR7a3BpKCckJytmbXQodG90KSwnTmV0IFBvc2l0aW9uJyx0b3Q8MD8ndmFyKC0tbWFnKSc6J3ZhcigtLXR4dCknKX0KICAke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdUb3RhbCBTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdUYXJnZXQgJDAuMDAnKX0KICAke2twaShTLnJldmVudWUubGVuZ3RoLCdMZWRnZXIgTGluZXMnLCd2YXIoLS1ibHUpJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVjb3JkIFJldmVudWUgU3RyZWFtPC9oMz48ZGl2IGNsYXNzPSJncmlkIGczIj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNvdXJjZTwvc3Bhbj48aW5wdXQgaWQ9InJTcmMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IlByZW1pdW0gY3JlZGl0cyDCtyBhcHAuZXhhbXBsZSI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFtb3VudCBVU0Q8L3NwYW4+PGlucHV0IGlkPSJyQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPiZuYnNwOzwvc3Bhbj48YnV0dG9uIGNsYXNzPSJidG4gcCIgc3R5bGU9IndpZHRoOjEwMCUiIG9uY2xpY2s9ImFkZFJldigpIj5QT1NUIFRPIExFREdFUjwvYnV0dG9uPjwvbGFiZWw+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVxdWVzdCBQYXlvdXQ8L2gzPgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPlJhaXNlcyBhIEZJTkFOQ0lBTCBUUkFOU0ZFUiBnYXRlLiBSZXF1aXJlcyBzZWFsZWQgY2hhbm5lbCArIHBhc3N3b3JkIHNpZ25hdHVyZS4gMkZBIHRhcmdldCAke21hc2tNYWlsKFMub3duZXIuZW1haWwpfS48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBpZD0icEFtdCIgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIwMHB4IiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSJBbW91bnQgVVNEIj4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icmVxUGF5b3V0KCkiPlJBSVNFIFRSQU5TRkVSIEdBVEU8L2J1dHRvbj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5SZXZlbnVlIExlZGdlcjwvaDM+JHtTLnJldmVudWUubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5Tb3VyY2U8L3RoPjx0aCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+QW1vdW50PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICR7Wy4uLlMucmV2ZW51ZV0ucmV2ZXJzZSgpLm1hcChyPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ci50fTwvdGQ+PHRkPiR7ZXNjKHIuc3JjKX08L3RkPgogIDx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodDtjb2xvcjoke3IuYW10PDA/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJ30iPiR7ci5hbXQ8MD8nLSc6JysnfSQke2ZtdChNYXRoLmFicyhyLmFtdCkpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RyZWFtcyByZWNvcmRlZC48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBhZGRSZXYoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3JldmVudWUnLHtzcmM6clNyYy52YWx1ZS50cmltKCksYW10OityQW10LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ1Bvc3RlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXFQYXlvdXQoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL3BheW91dC9yZXF1ZXN0Jyx7YW10OitwQW10LnZhbHVlfSk7Z28oJ2dhdGVzJyk7Zmxhc2goJ1RyYW5zZmVyIGdhdGUgcmFpc2VkJyl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIFZBVUxUIC0tLS0tLS0tLS0gKi8KUkVOREVSLnBheW91dD0oKT0+YAogPGRpdiBjbGFzcz0id2FybmJveCI+SXNvbGF0ZWQgT3duZXItb25seSBwYW5lbC4gUmF3IHZhbHVlcyBhcmUgc2VudCBvbmNlIG92ZXIgdGhlIHNlc3Npb24sIG1hc2tlZCBpbW1lZGlhdGVseSwgYW5kIDxiPm5ldmVyIHBlcnNpc3RlZCBvciByZXR1cm5lZDwvYj4g4oCUIG9ubHkgdGhlIG1hc2tlZCB2aWV3IGFuZCBhIFNIQS0yNTYgZmluZ2VycHJpbnQgYXJlIHN0b3JlZC4gVGhlIENoYWlybWFuIHdpbGwgbmV2ZXIgcmVxdWVzdCB0aGVzZSBhbnl3aGVyZSBlbHNlLjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNoYW5uZWwgQ29uZmlndXJhdGlvbjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TWV0aG9kPC9zcGFuPjxzZWxlY3QgaWQ9InZUeXBlIiBjbGFzcz0iaW4iIG9uY2hhbmdlPSJ2U3dhcCgpIj4KICAgIDxvcHRpb24gdmFsdWU9IkJBTksiPkJhbmsgV2lyZSAoU1dJRlQvSUJBTik8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJDUllQVE8iPkNyeXB0byBBZGRyZXNzPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CZW5lZmljaWFyeSBOYW1lPC9zcGFuPjxpbnB1dCBpZD0idk5hbWUiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBpZD0idkJhbmsiPjxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFjY291bnQgTnVtYmVyPC9zcGFuPjxpbnB1dCBpZD0idkFjYyIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5JQkFOPC9zcGFuPjxpbnB1dCBpZD0idkliYW4iIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U1dJRlQgLyBCSUM8L3NwYW4+PGlucHV0IGlkPSJ2U3dpZnQiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmFuayAmYW1wOyBDb3VudHJ5PC9zcGFuPjxpbnB1dCBpZD0idkJhbmtOYW1lIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxkaXYgaWQ9InZDcnlwdG8iIGNsYXNzPSJoaWRlIj48ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5OZXR3b3JrPC9zcGFuPjxpbnB1dCBpZD0idk5ldCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iQlRDIC8gRVRIIC8gVFJPTiI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QYXlvdXQgQWRkcmVzczwvc3Bhbj48aW5wdXQgaWQ9InZBZGRyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGVyLVRyYW5zZmVyIENlaWxpbmcgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJ2Q2FwIiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IjI1MDAwIj48L2xhYmVsPgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNlYWxWYXVsdCgpIj5TRUFMIENIQU5ORUw8L2J1dHRvbj4KICAke1MucGF5b3V0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlVmF1bHQoKSI+UHVyZ2UgQ2hhbm5lbDwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2VhbGVkIENoYW5uZWw8L2gzPiR7Uy5wYXlvdXQ/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICR7T2JqZWN0LmVudHJpZXMoUy5wYXlvdXQubWFza2VkKS5tYXAoKFtrLHZdKT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPiR7ZXNjKGspfTwvdGQ+PHRkPiR7ZXNjKHYpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2VhbGVkPC90ZD48dGQ+JHtTLnBheW91dC50fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+MkZBIFRhcmdldDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj5gCiA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQ0hBTk5FTCBTRUFMRUQg4oCUIGVuZ2luZSBTQUZFIE1PREUuPC9kaXY+J308L2Rpdj5gOwpmdW5jdGlvbiB2U3dhcCgpe2NvbnN0IGM9dlR5cGUudmFsdWU9PT0nQ1JZUFRPJzt2QmFuay5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJyxjKTt2Q3J5cHRvLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCFjKX0KYXN5bmMgZnVuY3Rpb24gc2VhbFZhdWx0KCl7CiBjb25zdCBiPXt0eXBlOnZUeXBlLnZhbHVlLG5hbWU6dk5hbWUudmFsdWUudHJpbSgpLGNhcDordkNhcC52YWx1ZXx8MCwKICBhY2M6dkFjYz8udmFsdWUudHJpbSgpLGliYW46dkliYW4/LnZhbHVlLnRyaW0oKSxzd2lmdDp2U3dpZnQ/LnZhbHVlLnRyaW0oKSxiYW5rOnZCYW5rTmFtZT8udmFsdWUudHJpbSgpLAogIG5ldDp2TmV0Py52YWx1ZS50cmltKCksYWRkcjp2QWRkcj8udmFsdWUudHJpbSgpfTsKIHRyeXthd2FpdCBBUEkoJy9hcGkvdmF1bHQnLGIpO3JlbmRlcigpO2ZsYXNoKCdDaGFubmVsIHNlYWxlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBwdXJnZVZhdWx0KCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGNoYW5uZWw/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS92YXVsdC9wdXJnZScpO3JlbmRlcigpO2ZsYXNoKCdQdXJnZWQnKX0KCi8qIC0tLS0tLS0tLS0gQU5BTFlUSUNTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmFuYWx5dGljcz0oKT0+ewogY29uc3Qgc2V2PXtJTkZPOjAsT0s6MCxXQVJOOjAsQ1JJVDowfTtTLmxvZ3MuZm9yRWFjaChsPT5zZXZbbC5zZXZdPShzZXZbbC5zZXZdfHwwKSsxKTsKIGNvbnN0IG14PU1hdGgubWF4KDEsLi4uT2JqZWN0LnZhbHVlcyhzZXYpKTsKIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXZlbnQgU2V2ZXJpdHkgTWl4PC9oMz4ke09iamVjdC5lbnRyaWVzKHNldikubWFwKChbayx2XSk9PmA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3Bhbj4ke2t9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHt2fTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7di9teCoxMDB9JTtiYWNrZ3JvdW5kOiR7e0lORk86JyMzYjgyZjYnLE9LOicjMzFkNjdhJyxXQVJOOicjZmZiMDIwJyxDUklUOicjZmYzYjZiJ31ba119Ij48L2k+PC9kaXY+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBPdXRjb21lczwvaDM+JHtbJ1BFTkRJTkcnLCdBUFBST1ZFRCcsJ0RFTklFRCddLm1hcChzPT57Y29uc3QgYz1TLmdhdGVzLmZpbHRlcihnPT5nLnN0YXR1cz09PXMpLmxlbmd0aDsKICByZXR1cm4gYDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6N3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzEwMTgyMiI+CiAgPHNwYW4gY2xhc3M9InRhZyAke3M9PT0nQVBQUk9WRUQnPyd0LWdybic6cz09PSdERU5JRUQnPyd0LXJlZCc6J3QtYW1iJ30iPiR7c308L3NwYW4+PGI+JHtjfTwvYj48L2Rpdj5gfSkuam9pbignJyl9CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPkFwcHJvdmFsIHJhdGUgaXMgbWVhbmluZ2xlc3Mgd2l0aG91dCBkZW5pYWwgcHJlc3N1cmUuIElmIG5vdGhpbmcgaXMgZXZlciBkZW5pZWQsIHRoZSBnYXRlIGlzIHRoZWF0cmUuPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Rmxvb3IgSGVhbHRoIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+TElWRTwvc3Bhbj48L2gzPgogICR7UElMTEFSUy5tYXAocD0+e2NvbnN0IGY9Zmxvb3IocC5pZCk7cmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij4ke3AuaWNvbn0gJHtwLm5hbWV9PC9zcGFuPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtmLmhlYWx0aH0lPC9zcGFuPjwvZGl2PgogIDxkaXYgY2xhc3M9ImJhciIgc3R5bGU9Im1hcmdpbi10b3A6NHB4Ij48aSBzdHlsZT0id2lkdGg6JHtmLmhlYWx0aH0lO2JhY2tncm91bmQ6JHtwLmNvbG9yfSI+PC9pPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db3N0IERpc2NpcGxpbmU8L2gzPiR7a3BpKCckJytTLnNwZW5kLnRvRml4ZWQoMiksJ1NwZW5kJyxTLnNwZW5kPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpfQogIDxkaXYgc3R5bGU9ImhlaWdodDoxMHB4Ij48L2Rpdj4ke2twaSgnJCcrUy5kZW5pYWxzLnJlZHVjZSgoYSxiKT0+YStiLmNvc3QsMCkudG9GaXhlZCgyKSwnQXZvaWRlZCcsJ3ZhcigtLWdybiknKX08L2Rpdj4KIDwvZGl2PmB9OwoKLyogLS0tLS0tLS0tLSBBVURJVCAtLS0tLS0tLS0tICovClJFTkRFUi5hdWRpdD0oKT0+YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206MTFweCI+CiA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Uy5sb2dzLmxlbmd0aH0gZW50cmllcyBzaG93biDCtyBwZXJzaXN0ZWQgc2VydmVyLXNpZGU8L3NwYW4+CiA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iZXhwb3J0TG9nKCkiPkV4cG9ydCBKU09OPC9idXR0b24+CiA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9InB1cmdlTG9ncygpIj5QdXJnZTwvYnV0dG9uPjwvZGl2PjwvZGl2PiR7bG9nSHRtbCg0MDApfTwvZGl2PmA7CmZ1bmN0aW9uIGV4cG9ydExvZygpe2NvbnN0IGI9bmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KFMubG9ncyxudWxsLDIpXSx7dHlwZTonYXBwbGljYXRpb24vanNvbid9KSx1PVVSTC5jcmVhdGVPYmplY3RVUkwoYiksYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7CiBhLmhyZWY9dTthLmRvd25sb2FkPSdjaGFpcm1hbi1hdWRpdC0nK0RhdGUubm93KCkrJy5qc29uJzthLmNsaWNrKCk7VVJMLnJldm9rZU9iamVjdFVSTCh1KTtmbGFzaCgnRXhwb3J0ZWQnKX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VMb2dzKCl7aWYoIWNvbmZpcm0oJ1B1cmdlIGxlZGdlcj8nKSlyZXR1cm47YXdhaXQgQVBJKCcvYXBpL2xvZ3MvcHVyZ2UnKTtyZW5kZXIoKX0KCi8qIC0tLS0tLS0tLS0gQUdFTlQgTE9PUCAtLS0tLS0tLS0tICovCmNvbnN0IEFHT0FMUz1bCiBbJ0ZpbmQgbXkgYmVzdCB2ZW50dXJlJywnQ2hlY2sgbXkgY3VycmVudCBzdGF0ZSwgaW52ZW50IG1vbmV5LW1ha2luZyBpZGVhcywgcmVzZWFyY2ggdGhlIG1vc3QgcHJvbWlzaW5nIG9uZSBhZ2FpbnN0IHRoZSBsaXZlIHdlYiwgYW5kIHRlbGwgbWUgd2hpY2ggc2luZ2xlIG9uZSB0byBwdXJzdWUgYW5kIHdoeS4nXSwKIFsnRnVsbCBzeXN0ZW0gYXVkaXQnLCdSZWFkIG15IHN5c3RlbSBzdGF0ZSwgc2NhbiBmb3IgYW5vbWFsaWVzLCBjaGVjayBldmVyeSBtb25pdG9yZWQgc2l0ZSwgYW5kIGdpdmUgbWUgYSBibHVudCBsaXN0IG9mIHdoYXQgaXMgYnJva2VuIG9yIHVuc2FmZSwgbW9zdCB1cmdlbnQgZmlyc3QuJ10sCiBbJ1Jlc2VhcmNoIGEgY29tcGV0aXRvcicsJ1NlYXJjaCB0aGUgd2ViIGZvciB1cHRpbWUgbW9uaXRvcmluZyBzZXJ2aWNlcyBpbiBJbmRpYSwgcmVhZCB0aGUgcHJpY2luZyBwYWdlIG9mIHRoZSBtb3N0IHJlbGV2YW50IG9uZSwgYW5kIHRlbGwgbWUgaG93IEkgc2hvdWxkIHBvc2l0aW9uIGFnYWluc3QgdGhlbS4nXSwKIFsnUGxhbiBteSBuZXh0IDMgYWN0aW9ucycsJ1JlYWQgbXkgc3RhdGUsIHdvcmsgb3V0IHdoYXQgaXMgYWN0dWFsbHkgYmxvY2tpbmcgbW9uZXksIGFuZCBpc3N1ZSBteSBuZXh0IGNvbmNyZXRlIG1pc3Npb25zLiddCl07ClJFTkRFUi5hZ2VudD0oKT0+ewogIGNvbnN0IFI9Uy5hZ2VudFJ1bnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1saW1lKSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tb2xpdmUpIj7impkgQUdFTlQgTE9PUCDigJQgSEUgREVDSURFUyBUSEUgTkVYVCBTVEVQIEhJTVNFTEY8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlRoaXMgaXMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBhIGNoYXRib3QgYW5kIGFuIGFnZW50LiBIZSBwaWNrcyBhIHRvb2wsIDxiPnNlZXMgdGhlIHJlYWwgcmVzdWx0PC9iPiwgdGhlbiBkZWNpZGVzIHdoYXQgdG8gZG8gbmV4dCDigJQgcmVwZWF0aW5nIHVudGlsIHRoZSBnb2FsIGlzIG1ldC4gRXZlcnkgdG9vbCBpcyBjb2RlIHRoYXQgZ2VudWluZWx5IHJ1bnMuPC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPgogICAgPGxpPkhlIGNhbiBjaGFpbjogc3RhdGUg4oaSIGlkZWFzIOKGkiBsaXZlIHdlYiByZXNlYXJjaCDihpIgbWlzc2lvbnMsIGluIG9uZSBnby48L2xpPgogICAgPGxpPkhlIG9ubHkgc2VlcyB0b29scyB0aGF0IGV4aXN0LiBJbnZlbnRpbmcgb25lIGlzIHJlZnVzZWQuPC9saT4KICAgIDxsaT5DYXBwZWQgYXQgMTAgc3RlcHMgc28gYSBsb29wIGNhbiBuZXZlciBydW4gYXdheS48L2xpPgogICAgPGxpPkV2ZXJ5IHN0ZXAgYW5kIGl0cyByZWFsIG91dHB1dCBpcyBsb2dnZWQgaW4gdGhlIHRyYWNlIGJlbG93LjwvbGk+CiAgIDwvdWw+CiAgICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7bWFyZ2luLXRvcDoxMHB4Ij5Db25uZWN0IGFuIEFJIGJyYWluIGZpcnN0LjwvZGl2Pic6Jyd9CiAgIDxsYWJlbCBjbGFzcz0iZiIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHNwYW4+WW91ciBnb2FsPC9zcGFuPgogICAgPHRleHRhcmVhIGlkPSJhZ0dvYWwiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6NzZweCIgcGxhY2Vob2xkZXI9ImUuZy4gV29yayBvdXQgd2hpY2ggdmVudHVyZSBJIHNob3VsZCBzdGFydCB0aGlzIHdlZWsgYW5kIHByb3ZlIGl0IHdpdGggcmVhbCB3ZWIgZXZpZGVuY2UuIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5NYXggc3RlcHM8L3NwYW4+CiAgICA8c2VsZWN0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDo4MHB4IiBpZD0iYWdTdGVwcyI+CiAgICAgJHtbMyw0LDYsOCwxMF0ubWFwKG49PmA8b3B0aW9uIHZhbHVlPSIke259IiAke249PT02PydzZWxlY3RlZCc6Jyd9PiR7bn08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJydW5BZ2VudCgpIj5SVU4gVEhFIExPT1A8L2J1dHRvbj4KICAgICR7Ui5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJBZ2VudCgpIj5DbGVhciBoaXN0b3J5PC9idXR0b24+JzonJ308L2Rpdj4KICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4ke0FHT0FMUy5tYXAoKGcsaSk9PgogICAgIGA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImFnUXVpY2soJHtpfSkiPiR7ZXNjKGdbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5BIDYtc3RlcCBydW4gbWFrZXMgNisgQUkgY2FsbHMuIE9uIGEgZnJlZSB0aWVyIHRoYXQgaXMgZmluZSBvY2Nhc2lvbmFsbHkg4oCUIGFkZCBiYWNrdXAga2V5cyBiZWxvdyBpZiB5b3UgcnVuIGl0IG9mdGVuLjwvZGl2PjwvZGl2PgogIDxkaXYgaWQ9ImFnT3V0Ij48L2Rpdj4KICAke1IubGVuZ3RoP1IubWFwKHI9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8Yj4ke2VzYyhyLmdvYWwpfTwvYj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ci50fSDCtyAke3Iuc3RlcHN9IHN0ZXAke3Iuc3RlcHM+MT8ncyc6Jyd9JHtyLmhpdENhcD8nIMK3IEhJVCBDQVAnOicnfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjU7bWFyZ2luLWJvdHRvbToxMXB4Ij4ke2VzYyhyLmFuc3dlcil9PC9kaXY+CiAgICA8ZGV0YWlscz48c3VtbWFyeSBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlciI+U2hvdyB0aGUgJHtyLnRyYWNlLmxlbmd0aH0tc3RlcCB0cmFjZTwvc3VtbWFyeT4KICAgICA8ZGl2IGNsYXNzPSJsb2ciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+JHtyLnRyYWNlLm1hcCh0PT4KICAgICAgIGA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+c3RlcCAke3Quc3RlcH08L3NwYW4+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1saW1lKSI+JHtlc2ModC5hY3Rpb24pfTwvYj5cbiR7ZXNjKHQucmVzdWx0KX08L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj4KICAgIDwvZGV0YWlscz48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBydW5zIHlldC4gR2l2ZSBoaW0gYSBnb2FsIGFuZCB3YXRjaCBoaW0gd29yayBpdCBvdXQuPC9kaXY+PC9kaXY+J31gOwp9Owphc3luYyBmdW5jdGlvbiBydW5BZ2VudCgpewogIGNvbnN0IGc9YWdHb2FsLnZhbHVlLnRyaW0oKTsgaWYoIWcpIHJldHVybiBmbGFzaCgnU3RhdGUgYSBnb2FsIGZpcnN0Jyk7CiAgYWdPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+V29ya2luZ+KApiBoZSBpcyBjaG9vc2luZyB0b29scyBhbmQgcmVhZGluZyByZXN1bHRzLiBUaGlzIGNhbiB0YWtlIGEgbWludXRlLjwvZGl2PjwvZGl2Pic7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvYWdlbnQvcnVuJyx7Z29hbDpnLHN0ZXBzOithZ1N0ZXBzLnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goJ0ZpbmlzaGVkIGluICcrci5zdGVwcysnIHN0ZXAocyknKTsKICB9Y2F0Y2goZSl7CiAgICBhZ091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gOwogIH0KfQpmdW5jdGlvbiBhZ1F1aWNrKGkpeyBhZ0dvYWwudmFsdWU9QUdPQUxTW2ldWzFdOyBydW5BZ2VudCgpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJBZ2VudCgpeyBhd2FpdCBBUEkoJy9hcGkvYWdlbnQvY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBNSVNTSU9OUzogaGUgZ3VpZGVzLCB5b3UgZXhlY3V0ZSAtLS0tLS0tLS0tICovCkxJVkUubWlzc2lvbnM9KCk9PnsKICBjb25zdCBNPVMubWlzc2lvbnN8fFtdLCBvcGVuPU0uZmlsdGVyKG09Pm0uc3RhdHVzPT09J09QRU4nKSwgZG9uZT1NLmZpbHRlcihtPT5tLnN0YXR1cz09PSdET05FJyk7CiAgY29uc3QgbWlucz1vcGVuLnJlZHVjZSgoYSxtKT0+YSsobS5taW51dGVzfHwwKSwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShvcGVuLmxlbmd0aCwnT3BlbiBNaXNzaW9ucycsb3Blbi5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxtaW5zPyd+JyttaW5zKycgbWluIHRvdGFsJzonbm90aGluZyBwZW5kaW5nJyl9CiAgICR7a3BpKGRvbmUubGVuZ3RoLCdDb21wbGV0ZWQnLCd2YXIoLS1ncm4pJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoKFMucGxheWJvb2tzfHxbXSkubGVuZ3RoLCdQbGF5Ym9va3MnLCd2YXIoLS1jeSknLCdzdGVwLWJ5LXN0ZXAgZ3VpZGVzJyl9CiAgICR7a3BpKFMudmVudHVyZXMmJlMudmVudHVyZXMubGVuZ3RoP2VzYyhTLnZlbnR1cmVzWzBdLnRpdGxlKS5zbGljZSgwLDE4KTonbm9uZScsJ0FjdGl2ZSBWZW50dXJlJywndmFyKC0tcHVyKScsJycpfTwvZGl2PgogICR7b3Blbi5sZW5ndGg/b3Blbi5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZiI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjdweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5ETyBUSElTPC9zcGFuPjxiIHN0eWxlPSJmb250LXNpemU6MTRweCI+JHtlc2MobS50aXRsZSl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+fiR7bS5taW51dGVzfSBtaW48L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweDtjb2xvcjojYjNjMWQxIj4ke2VzYyhtLndoeSl9PC9kaXY+CiAgICAke20uc3RlcHMubGVuZ3RoP2A8b2wgc3R5bGU9Im1hcmdpbjowIDAgMTBweDtwYWRkaW5nLWxlZnQ6MjBweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuNzUiPgogICAgICAke20uc3RlcHMubWFwKHM9PmA8bGk+JHtlc2Mocyl9PC9saT5gKS5qb2luKCcnKX08L29sPmA6Jyd9CiAgICAke20uc2NyaXB0P2A8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiMwNjIyMmE7Ym9yZGVyOjFweCBzb2xpZCAjMTU1ZTZiO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTFweDttYXJnaW4tYm90dG9tOjEwcHgiPgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij5DT1BZIFRIRVNFIEVYQUNUIFdPUkRTOjwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiIGlkPSJzY3JfJHttLmlkfSI+JHtlc2MobS5zY3JpcHQpfTwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgc3R5bGU9Im1hcmdpbi10b3A6OXB4IiBvbmNsaWNrPSJjb3B5U2NyaXB0KCcke20uaWR9JykiPkNvcHkgbWVzc2FnZTwvYnV0dG9uPjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEyMHB4Ij5Eb25lIHdoZW48L3RkPjx0ZD4ke2VzYyhtLmRvbmVXaGVuKX08L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxpa2VseSBibG9ja2VyPC90ZD48dGQgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPiR7ZXNjKG0ucmlzayl9PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48c3Bhbj5XaGF0IGhhcHBlbmVkPyAoaGUgYWRhcHRzIHRoZSBuZXh0IG1pc3Npb24gdG8gdGhpcyk8L3NwYW4+CiAgICAgPGlucHV0IGNsYXNzPSJpbiIgaWQ9Im5vdGVfJHttLmlkfSIgcGxhY2Vob2xkZXI9ImUuZy4gc2VudCB0byA0IHNob3BzLCAxIHJlcGxpZWQgYXNraW5nIHByaWNlIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlYnJpZWYoJyR7bS5pZH0nLCdkb25lJykiPk1BUksgRE9ORTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ3NraXAnKSI+U2tpcCB0aGlzPC9idXR0b24+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gb3BlbiBtaXNzaW9ucy4gUHJlc3MgR0VUIE1ZIE5FWFQgTUlTU0lPTlMgYW5kIGhlIHdpbGwgdGVsbCB5b3UgZXhhY3RseSB3aGF0IHRvIGRvIHRvZGF5LjwvZGl2PjwvZGl2PmB9CiAgJHtkb25lLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbXBsZXRlZCA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4ke2RvbmUubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5NaXNzaW9uPC90aD48dGg+T3V0Y29tZTwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtkb25lLnNsaWNlKDAsMTUpLm1hcChtPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7bS5jbG9zZWR8fG0udH08L3RkPjx0ZD4ke2VzYyhtLnRpdGxlKX08L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobS5vdXRjb21lfHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YDonJ30KICAkeyhTLnBsYXlib29rc3x8W10pLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBsYXlib29rczwvaDM+CiAgICR7Uy5wbGF5Ym9va3MubWFwKChwLGkpPT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWN5KTtwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHgiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKHAudG9waWMpfTwvYj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNvcHlQYigke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NTtmb250LXNpemU6MTIuNXB4O21hcmdpbi10b3A6NnB4Ij4ke2VzYyhwLnRleHQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpfQogICA8L2Rpdj5gOicnfWA7Cn07ClJFTkRFUi5taXNzaW9ucz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTUxMDBhLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPuKXjiBNWSBNSVNTSU9OUyDigJQgSEUgUExBTlMsIFlPVSBFWEVDVVRFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGNhbm5vdCByZWdpc3RlciBjb21wYW5pZXMsIHBsYWNlIGFkcyBvciB0YWxrIHRvIGN1c3RvbWVycy4gU28gaGUgZG9lcyB0aGUgbmV4dCBiZXN0IHRoaW5nOiBicmVha3MgdGhlIHBhdGggaW50byA8Yj5zaW5nbGUgYWN0aW9ucyB5b3UgY2FuIGZpbmlzaCB0b2RheTwvYj4sIHdyaXRlcyB0aGUgZXhhY3Qgd29yZHMgdG8gc2VuZCwgYW5kIGFkYXB0cyBiYXNlZCBvbiB3aGF0IGFjdHVhbGx5IGhhcHBlbmVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZXRNaXNzaW9ucygpIj5HRVQgTVkgTkVYVCBNSVNTSU9OUzwvYnV0dG9uPgogICAkeyhTLm1pc3Npb25zfHxbXSkuc29tZShtPT5tLnN0YXR1cyE9PSdPUEVOJyk/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJNaXNzaW9ucygpIj5DbGVhciBoaXN0b3J5PC9idXR0b24+JzonJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjM0MHB4IiBpZD0icGJUb3BpYyIgcGxhY2Vob2xkZXI9IlBsYXlib29rIHRvcGljIOKAlCBlLmcuIGhvdyB0byByZWdpc3RlciBhIHNvbGUgcHJvcHJpZXRvcnNoaXAgaW4gUHVuamFiIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJtYWtlUGIoKSI+V1JJVEUgUExBWUJPT0s8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij5QbGF5Ym9vayBpZGVhczogZ2V0dGluZyBhIFJhem9ycGF5IGFjY291bnQgwrcgR1NUIGZvciBmcmVlbGFuY2VycyBpbiBJbmRpYSDCtyBmaW5kaW5nIHNob3Agb3duZXJzJyBudW1iZXJzIGxlZ2FsbHkgwrcgd3JpdGluZyBhIGZpcnN0IGludm9pY2U8L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJtaXNzaW9ucyI+JHtMSVZFLm1pc3Npb25zKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZ2V0TWlzc2lvbnMoKXsgZmxhc2goJ0NoYWlybWFuIGlzIHBsYW5uaW5nIHlvdXIgbmV4dCBtb3Zlc+KApicpOwogIHRyeXsgY29uc3Qgdj0oUy52ZW50dXJlc3x8W10pWzBdOwogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9nZW5lcmF0ZScse3ZlbnR1cmVJZDp2P3YuaWQ6bnVsbH0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBtaXNzaW9uKHMpIGlzc3VlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KZnVuY3Rpb24gY29weVNjcmlwdChpZCl7IGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JfJytpZCk7CiAgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KGVsP2VsLmlubmVyVGV4dDonJyk7IGZsYXNoKCdNZXNzYWdlIGNvcGllZCDigJQgbm93IHNlbmQgaXQnKSB9CmZ1bmN0aW9uIGNvcHlQYihpKXsgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KChTLnBsYXlib29rc3x8W10pW2ldLnRleHQpOyBmbGFzaCgnUGxheWJvb2sgY29waWVkJykgfQphc3luYyBmdW5jdGlvbiBkZWJyaWVmKGlkLG91dGNvbWUpewogIGNvbnN0IG5vdGU9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdub3RlXycraWQpfHx7fSkudmFsdWV8fCcnOwogIGlmKG91dGNvbWU9PT0nZG9uZScmJiFub3RlLnRyaW0oKSkgcmV0dXJuIGZsYXNoKCdXcml0ZSB3aGF0IGhhcHBlbmVkIGZpcnN0IOKAlCBoZSBuZWVkcyBpdCB0byBwbGFuIHRoZSBuZXh0IHN0ZXAnKTsKICBmbGFzaCgnUmVjb3JkaW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL2RlYnJpZWYnLHtpZCxvdXRjb21lLG5vdGV9KTsgcmVuZGVyKCk7CiAgICBpZihyLmFkdmljZSkgbW9kYWwoYDxoMz5EZWJyaWVmPC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhyLmFkdmljZSl9PC9kaXY+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnZXRNaXNzaW9ucygpIj5OZXh0IG1pc3Npb25zIOKGkjwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNsb3NlTW9kYWwoKSI+Q2xvc2U8L2J1dHRvbj48L2Rpdj5gKTsKICAgIGVsc2UgZmxhc2goJ1NraXBwZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIG1ha2VQYigpeyBjb25zdCB0PXBiVG9waWMudmFsdWUudHJpbSgpOyBpZighdCkgcmV0dXJuIGZsYXNoKCdUeXBlIGEgdG9waWMnKTsKICBmbGFzaCgnV3JpdGluZyBwbGF5Ym9va+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL21pc3Npb24vcGxheWJvb2snLHt0b3BpYzp0fSk7IHJlbmRlcigpOyBmbGFzaCgnUGxheWJvb2sgcmVhZHknKSB9CiAgY2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIENPTU1BTkQgQ09OU09MRSAtLS0tLS0tLS0tICovCkxJVkUuY29tbWFuZD0oKT0+ewogIGNvbnN0IEM9Uy5jaGF0fHxbXTsKICByZXR1cm4gQy5sZW5ndGg/Qy5tYXAobT0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHg7Ym9yZGVyLWNvbG9yOiR7CiAgICAgbS53aG89PT0nT1dORVInPycjMjIzNDRhJzptLndobz09PSdDSEFJUk1BTic/JyMxNTVlNmInOicjNmIyMjMzJ30iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo2cHgiPgogICAgIDxzcGFuIGNsYXNzPSJ0YWcgJHttLndobz09PSdPV05FUic/J3QtYmx1JzptLndobz09PSdDSEFJUk1BTic/J3QtY3knOid0LXJlZCd9Ij4ke20ud2hvfTwvc3Bhbj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7bS50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2MobS50ZXh0KX08L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBvcmRlcnMgZ2l2ZW4geWV0LiBUZWxsIHRoZSBDaGFpcm1hbiB3aGF0IHlvdSB3YW50LjwvZGl2PjwvZGl2Pic7Cn07ClJFTkRFUi5jb21tYW5kPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxNTVlNmI7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwNjIyMmEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj7ilq4gQ09NTUFORCBDT05TT0xFIOKAlCBIRSBBTlNXRVJTIE9OTFkgVE8gWU9VPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkdpdmUgb3JkZXJzIGluIHBsYWluIEVuZ2xpc2guIEhlIHJlcGxpZXMgd2l0aCB3aGF0IGhlIHdpbGwgZG8sIHdoYXQgaGUgbmVlZHMgZnJvbSB5b3UsIGFuZCB3aGF0IGhlIGNhbm5vdCBkby4gRXZlcnl0aGluZyBoZXJlIGlzIGxvZ2dlZCBhbmQgc3Vydml2ZXMgcmVzdGFydHMuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Tm8gQUkgYnJhaW4gY29ubmVjdGVkIOKAlCBoZSBjYW5ub3QgYW5zd2VyLiBDb25uZWN0IG9uZSBvbiB0aGUgQUkgQnJhaW4gcGFnZS48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+WW91ciBvcmRlcjwvc3Bhbj48dGV4dGFyZWEgaWQ9ImNtZFRleHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6ODBweCIKICAgIHBsYWNlaG9sZGVyPSJlLmcuIEZpbmQgbWUgdGhyZWUgd2F5cyB0byBlYXJuIGZyb20gd2hhdCBJIG93biwgcmVzZWFyY2ggdGhlIGJlc3Qgb25lLCBhbmQgYnVpbGQgdGhlIGFnZW50IHRlYW0uIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2VuZENtZCgpIj5TRU5EIE9SREVSPC9idXR0b24+CiAgICR7KFMuY2hhdHx8W10pLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhckNtZCgpIj5DbGVhciBsb2c8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImNvbW1hbmQiPiR7TElWRS5jb21tYW5kKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gc2VuZENtZCgpewogIGNvbnN0IHQ9Y21kVGV4dC52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYW4gb3JkZXIgZmlyc3QnKTsKICBmbGFzaCgnQ2hhaXJtYW4gaXMgdGhpbmtpbmfigKYnKTsgY21kVGV4dC52YWx1ZT0nJzsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kJyx7dGV4dDp0fSk7IHJlbmRlcigpOyB9CiAgY2F0Y2goZSl7IHJlbmRlcigpOyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBjbGVhckNtZCgpeyBhd2FpdCBBUEkoJy9hcGkvY29tbWFuZC9jbGVhcicse30pOyByZW5kZXIoKSB9CgovKiAtLS0tLS0tLS0tIFZFTlRVUkVTIC0tLS0tLS0tLS0gKi8KTElWRS52ZW50dXJlcz0oKT0+ewogIGNvbnN0IEk9Uy5pZGVhc3x8W10sIFY9Uy52ZW50dXJlc3x8W107CiAgY29uc3QgcmF3PUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JBVycpLmxlbmd0aDsKICBjb25zdCBkb25lPUkuZmlsdGVyKGk9Pmkuc3RhdHVzPT09J1JFU0VBUkNIRUQnKTsKICBjb25zdCBiZXN0PWRvbmUuc2xpY2UoKS5zb3J0KChhLGIpPT4oYi5zY29yZXx8MCktKGEuc2NvcmV8fDApKVswXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShJLmxlbmd0aCwnSWRlYXMgR2VuZXJhdGVkJywndmFyKC0tY3kpJyxyYXcrJyBhd2FpdGluZyByZXNlYXJjaCcpfQogICAke2twaShkb25lLmxlbmd0aCwnUmVzZWFyY2hlZCcsJ3ZhcigtLXB1ciknLCdhZ2FpbnN0IGxpdmUgd2ViIGRhdGEnKX0KICAgJHtrcGkoYmVzdD9iZXN0LnNjb3JlKycvMTAwJzon4oCUJywnQmVzdCBTY29yZScsYmVzdCYmYmVzdC5zY29yZT49NjA/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJyxiZXN0P2VzYyhiZXN0LnRpdGxlKS5zbGljZSgwLDI2KTonbm9uZSB5ZXQnKX0KICAgJHtrcGkoVi5sZW5ndGgsJ1ZlbnR1cmVzIExhdW5jaGVkJywndmFyKC0tZ3JuKScsJ3dpdGggcmVhbCBhZ2VudCB0ZWFtcycpfTwvZGl2PgogICR7Vi5sZW5ndGg/YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5MaXZlIFZlbnR1cmVzPC9oMz4KICAgJHtWLm1hcCh2PT5gPGRpdiBzdHlsZT0iYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLWdybik7cGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxNHB4Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48Yj4ke2VzYyh2LnRpdGxlKX08L2I+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3YuYWdlbnRzLmxlbmd0aH0gYWdlbnRzIMK3IGZpcnN0IHJ1cGVlIGluIH4ke3Yud2Vla3N9dzwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luOjVweCAwIj4ke2VzYyh2LnJldmVudWVQYXRoKX08L2Rpdj4KICAgICR7di5vd25lclN0ZXBzLmxlbmd0aD9gPGRpdiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWFtYikiPllPVVIgU1RFUFMgKG9ubHkgYSBodW1hbiBjYW4gZG8gdGhlc2UpOjwvYj4KICAgICA8b2wgc3R5bGU9Im1hcmdpbjo1cHggMCAwO3BhZGRpbmctbGVmdDoxOXB4Ij4ke3Yub3duZXJTdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+PC9kaXY+YDonJ30KICAgPC9kaXY+YCkuam9pbignJyl9PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SWRlYSBQaXBlbGluZSA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0kubGVuZ3RofTwvc3Bhbj48L2gzPgogICAke0kubGVuZ3RoP0kubWFwKGk9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgJHsKICAgICAgaS5zdGF0dXM9PT0nTEFVTkNIRUQnPyd2YXIoLS1ncm4pJzppLnN0YXR1cz09PSdLSUxMRUQnPyd2YXIoLS1kaW0yKSc6CiAgICAgIGkudmVyZGljdD09PSdQVVJTVUUnPyd2YXIoLS1jeSknOmkudmVyZGljdD09PSdLSUxMJz8ndmFyKC0tbWFnKSc6J3ZhcigtLWFtYiknfTsKICAgICAgcGFkZGluZy1sZWZ0OjExcHg7bWFyZ2luLWJvdHRvbToxM3B4OyR7aS5zdGF0dXM9PT0nS0lMTEVEJz8nb3BhY2l0eTouNDUnOicnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48Yj4ke2VzYyhpLnRpdGxlKX08L2I+CiAgICAgICR7aS5zY29yZSE9bnVsbD9gPHNwYW4gY2xhc3M9InRhZyAke2kuc2NvcmU+PTYwPyd0LWdybic6aS5zY29yZT49NDA/J3QtYW1iJzondC1yZWQnfSI+JHtpLnNjb3JlfS8xMDA8L3NwYW4+YDonJ30KICAgICAgJHtpLnZlcmRpY3Q/YDxzcGFuIGNsYXNzPSJ0YWcgJHtpLnZlcmRpY3Q9PT0nUFVSU1VFJz8ndC1jeSc6aS52ZXJkaWN0PT09J0tJTEwnPyd0LXJlZCc6J3QtZGltJ30iPiR7aS52ZXJkaWN0fTwvc3Bhbj5gOicnfQogICAgICA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2kuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPuKCuSR7Zm10KGkucHJpY2UpfTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O21hcmdpbjo0cHggMCI+JHtlc2MoaS53aGF0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj5CdXllcjogJHtlc2MoaS5idXllcil9PC9kaXY+CiAgICAke2kucmVzZWFyY2g/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6IzBhMTExOTtib3JkZXItcmFkaXVzOjdweDtwYWRkaW5nOjlweDttYXJnaW4tdG9wOjdweDtmb250LXNpemU6MTEuNXB4Ij4KICAgICAgPGRpdj4ke2VzYyhpLnJlc2VhcmNoLnJlYXNvbmluZyl9PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6NnB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5GaXJzdCBzdGVwOjwvYj4gJHtlc2MoaS5yZXNlYXJjaC5maXJzdFN0ZXApfTwvZGl2PgogICAgICA8ZGl2PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5LaWxsIHJpc2s6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmtpbGxSaXNrKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjVweCI+ZGVtYW5kICR7aS5yZXNlYXJjaC5kZW1hbmR9LzEwIMK3IGNvbXBldGl0aW9uICR7aS5yZXNlYXJjaC5jb21wZXRpdGlvbn0vMTAgwrcgc3BlZWQgJHtpLnJlc2VhcmNoLnNwZWVkfS8xMCDCtyBmaXQgJHtpLnJlc2VhcmNoLmZpdH0vMTA8L2Rpdj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPgogICAgICR7aS5zdGF0dXM9PT0nUkFXJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJlc2VhcmNoSWRlYSgnJHtpLmlkfScpIj5SRVNFQVJDSCBJVDwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cz09PSdSRVNFQVJDSEVEJz9gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG9rIiBvbmNsaWNrPSJsYXVuY2hJZGVhKCcke2kuaWR9JykiPkJVSUxEIEFHRU5UIFRFQU08L2J1dHRvbj5gOicnfQogICAgICR7aS5zdGF0dXMhPT0nS0lMTEVEJyYmaS5zdGF0dXMhPT0nTEFVTkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImtpbGxJZGVhKCcke2kuaWR9JykiPktpbGw8L2J1dHRvbj5gOicnfQogICAgPC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gaWRlYXMgeWV0LiBQcmVzcyBHRU5FUkFURSBJREVBUyBhbmQgaGUgd2lsbCBpbnZlbnQgdGhlbS48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi52ZW50dXJlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKXhiBWRU5UVVJFIEVOR0lORSDigJQgSURFQVMg4oaSIFJFQUwgUkVTRUFSQ0gg4oaSIEFHRU5UIFRFQU1TPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGludmVudHMgdmVudHVyZXMsIHJlc2VhcmNoZXMgZWFjaCBvbmUgYWdhaW5zdCA8Yj5saXZlIHdlYiBzZWFyY2g8L2I+IChub3QgbW9kZWwgbWVtb3J5KSwgc2NvcmVzIGl0IG91dCBvZiAxMDAsIGFuZCBkZXNpZ25zIHRoZSBhZ2VudCB0ZWFtIHRvIGV4ZWN1dGUuIEFnZW50cyB3aG9zZSB0b29scyBtYXAgdG8gbm8gcmVhbCBjb2RlIGFyZSByZWZ1c2VkLCBzbyBub3RoaW5nIGRlY29yYXRpdmUgZ2V0cyBjcmVhdGVkLjwvZGl2PgogICR7IVMubGxtPyc8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3QuPC9kaXY+JzonJ30KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wdGlvbmFsIHN0ZWVyIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KGxlYXZlIGJsYW5rIGFuZCBoZSBkZWNpZGVzKTwvc3Bhbj48L3NwYW4+CiAgIDxpbnB1dCBpZD0iaWRlYVN0ZWVyIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIGZvY3VzIG9uIEIyQiwgb3Igb25saW5lLW9ubHksIG9yIHVuZGVyIDUwMCBJTlIgdG8gc3RhcnQiPjwvbGFiZWw+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZ2VuSWRlYXMoKSI+R0VORVJBVEUgSURFQVM8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke1MuYXV0b0lkZWFzPyd0LXJlZCc6J3QtZGltJ30iPklERUEgQVVUT1BJTE9UICR7Uy5hdXRvSWRlYXM/J09OJzonT0ZGJ308L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMXB4Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIxMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9ImlkZWFQdyIgcGxhY2Vob2xkZXI9IlBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvSWRlYXM/J25vJzonJ30iIG9uY2xpY2s9InRvZ2dsZUlkZWFBdXRvKCkiPiR7Uy5hdXRvSWRlYXM/J1NUT1AgQVVUT1BJTE9UJzonRU5BQkxFIElERUEgQVVUT1BJTE9UJ308L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5BdXRvcGlsb3QgPSBoZSBpbnZlbnRzIGFuZCByZXNlYXJjaGVzIHZlbnR1cmVzIHVucHJvbXB0ZWQsIGV2ZXJ5IH41IG1pbnV0ZXMuPC9zcGFuPjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9InZlbnR1cmVzIj4ke0xJVkUudmVudHVyZXMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBnZW5JZGVhcygpeyBmbGFzaCgnVGhpbmtpbmcgdXAgdmVudHVyZXPigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvZ2VuZXJhdGUnLHtuOjUsc3RlZXI6aWRlYVN0ZWVyLnZhbHVlLnRyaW0oKX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKHIuYWRkZWQrJyBpZGVhKHMpIGdlbmVyYXRlZCcpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2VhcmNoSWRlYShpZCl7IGZsYXNoKCdTZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9pZGVhL3Jlc2VhcmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnU2NvcmVkICcrci5zY29yZSsnLzEwMCDigJQgJytyLnZlcmRpY3QpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIGxhdW5jaElkZWEoaWQpeyBmbGFzaCgnRGVzaWduaW5nIGFnZW50IHRlYW3igKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvbGF1bmNoJyx7aWR9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLmFnZW50cysnIGFnZW50KHMpIGNvbW1pc3Npb25lZCcrKHIuc2tpcHBlZD8nIMK3ICcrci5za2lwcGVkKycgcmVqZWN0ZWQgYXMgbm9uLWV4ZWN1dGFibGUnOicnKSk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24ga2lsbElkZWEoaWQpeyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9raWxsJyx7aWR9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVJZGVhQXV0bygpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2lkZWEvYXV0b3BpbG90Jyx7b246IVMuYXV0b0lkZWFzLHB3OmlkZWFQdy52YWx1ZX0pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMuYXV0b0lkZWFzPydBdXRvcGlsb3QgT04g4oCUIGhlIHdpbGwgaW52ZW50IHZlbnR1cmVzIG9uIGhpcyBvd24nOidBdXRvcGlsb3Qgb2ZmJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBQQVlNRU5UUyAtLS0tLS0tLS0tICovCkxJVkUucGF5PSgpPT57CiAgY29uc3QgTz1TLm9yZGVyc3x8W107CiAgY29uc3QgcGFpZD1PLmZpbHRlcihvPT5vLnBhaWQ+MCkucmVkdWNlKChhLG8pPT5hK28ucGFpZCwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShPLmxlbmd0aCwnTGlua3MgUmFpc2VkJywndmFyKC0tY3kpJywnbGlmZXRpbWUnKX0KICAgJHtrcGkoTy5maWx0ZXIobz0+by5wYWlkPjApLmxlbmd0aCwnUGFpZCcscGFpZD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWRpbSknLCdzZXR0bGVkJyl9CiAgICR7a3BpKChTLnBheT8oUy5wYXkuZ2F0ZXdheT09PSdyYXpvcnBheSc/J+KCuSc6JyQnKTonJykrZm10KHBhaWQpLCdDb2xsZWN0ZWQnLCd2YXIoLS1ncm4pJywncmVhbCBtb25leScpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5QYXltZW50IExpbmtzPC9oMz4KICAgJHtPLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Rm9yPC90aD48dGg+QW1vdW50PC90aD48dGg+TW9kZTwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPkxpbms8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Ty5tYXAobz0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke28udH08L3RkPgogICAgPHRkPiR7ZXNjKG8uZGVzYyl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKG8uY3VzdG9tZXIpfTwvZGl2PjwvdGQ+CiAgICA8dGQ+JHtvLmN1cnJlbmN5fSAke2ZtdChvLmFtb3VudCl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5saXZlPyd0LXJlZCc6J3QtZGltJ30iPiR7by5saXZlPydMSVZFJzonVEVTVCd9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke28ucGFpZD4wPyd0LWdybic6J3QtYW1iJ30iPiR7by5wYWlkPjA/J1BBSUQnOmVzYyhvLnN0YXR1cyl9PC9zcGFuPjwvdGQ+CiAgICA8dGQ+PGEgaHJlZj0iJHtlc2Moby51cmwpfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPm9wZW4g4oaXPC9hPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBwYXltZW50IGxpbmtzIHJhaXNlZCB5ZXQuPC9kaXY+J308L2Rpdj5gOwp9OwpSRU5ERVIucGF5PSgpPT57CiAgY29uc3QgUD1TLnBheSwgR1c9Uy5nYXRld2F5c3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7UD8oUC5saXZlPycjNmIyMjMzJzonIzFjNWMzYycpOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7UD8oUC5saXZlPycjMTYwYjBjJzonIzA4MTcwZicpOicjMTUxMDBhJ30sIzBhMGYxNikiPgogICA8aDMgc3R5bGU9ImNvbG9yOiR7UD8oUC5saXZlPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScpOid2YXIoLS1hbWIpJ30iPuKCuSBQQVlNRU5UUyDigJQgJHtQPyhQLmxpdmU/J0xJVkUgwrcgUkVBTCBNT05FWSc6J0NPTk5FQ1RFRCDCtyBURVNUIE1PREUnKTonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke1AKICAgID9gVmVyaWZpZWQgYWdhaW5zdCA8Yj4ke2VzYyhQLmdhdGV3YXkpfTwvYj4sIGtleSAke2VzYyhQLmtleUlkKX0uICR7UC5saXZlCiAgICAgID8nPGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgbGlua3MgeW91IHJhaXNlIHRha2UgcmVhbCBtb25leS4gRXZlcnkgbGluayBuZWVkcyB5b3VyIHBhc3N3b3JkLjwvYj4nCiAgICAgIDonVGVzdCBtb2RlLiBMaW5rcyB3b3JrIGVuZC10by1lbmQgYnV0IG1vdmUgbm8gcmVhbCBtb25leS4nfWAKICAgIDonQ29ubmVjdCBSYXpvcnBheSBvciBTdHJpcGUgYmVsb3cuIEtleXMgYXJlIHZlcmlmaWVkIGFnYWluc3QgdGhlIHJlYWwgQVBJIGJlZm9yZSBiZWluZyBhY2NlcHRlZCDigJQgYSB3cm9uZyBrZXkgaXMgcmVqZWN0ZWQgaW1tZWRpYXRlbHksIG5vdCBzdG9yZWQuJ308L2Rpdj4KICAgPHVsIGNsYXNzPSJ0aWdodCI+PGxpPlN0YXJ0IHdpdGggPGI+dGVzdCBrZXlzPC9iPi4gUmF6b3JwYXkgPGNvZGU+cnpwX3Rlc3RfPC9jb2RlPiwgU3RyaXBlIDxjb2RlPnNrX3Rlc3RfPC9jb2RlPiDigJQgaW5zdGFudCwgbm8gS1lDLjwvbGk+CiAgICA8bGk+TGl2ZSBrZXlzIG5lZWQgS1lDIChQQU4gKyBiYW5rIGZvciBSYXpvcnBheSkuIFByb3ZpZGVycyBjaGFyZ2UgfjIlIHBlciB0cmFuc2FjdGlvbiDigJQgdGhhdCBpcyB0aGUgY29zdCBvZiBtb3ZpbmcgbW9uZXksIG5vdCBzb21ldGhpbmcgdG8gcm91dGUgYXJvdW5kLjwvbGk+CiAgICA8bGk+WW91ciBzZWNyZXQgaXMgbmV2ZXIgcmV0dXJuZWQgYnkgdGhlIEFQSSBhbmQgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvbGk+PC91bD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbm5lY3QgR2F0ZXdheTwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkdhdGV3YXk8L3NwYW4+PHNlbGVjdCBpZD0icGdTZWwiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InBheUhpbnQoKSI+CiAgICAgJHtHVy5tYXAoZz0+YDxvcHRpb24gdmFsdWU9IiR7Zy5pZH0iICR7UCYmUC5nYXRld2F5PT09Zy5pZD8nc2VsZWN0ZWQnOicnfT4ke2VzYyhnLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9InBheUhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5LZXkgSUQgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oUmF6b3JwYXkgb25seSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InJ6cF90ZXN0Xy4uLiI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U2VjcmV0IEtleTwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9InBnU2VjcmV0IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InNlY3JldCAvIHNrX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdFBheSgpIj5WRVJJRlkgJmFtcDsgQ09OTkVDVDwvYnV0dG9uPgogICAgICR7UD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVBheSgpIj5EaXNjb25uZWN0PC9idXR0b24+JzonJ308L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIGEgUGF5bWVudCBMaW5rPC9oMz4KICAgICR7IVA/JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Db25uZWN0IGEgZ2F0ZXdheSBmaXJzdC48L2Rpdj4nOmAKICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QW1vdW50ICR7UC5nYXRld2F5PT09J3Jhem9ycGF5Jz8nKElOUiknOicoVVNEKSd9PC9zcGFuPjxpbnB1dCBpZD0icGxBbXQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iMjUwMCI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkN1c3RvbWVyIG5hbWU8L3NwYW4+PGlucHV0IGlkPSJwbE5hbWUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGlzIGl0IGZvcjwvc3Bhbj48aW5wdXQgaWQ9InBsRGVzYyIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iV2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZyDigJQgQXVndXN0Ij48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5FbWFpbDwvc3Bhbj48aW5wdXQgaWQ9InBsRW1haWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGhvbmU8L3NwYW4+PGlucHV0IGlkPSJwbFBob25lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJvcHRpb25hbCI+PC9sYWJlbD48L2Rpdj4KICAgICR7UC5saXZlP2A8bGFiZWwgY2xhc3M9ImYiPjxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5MSVZFIE1PREUg4oCUIGNvbmZpcm0gd2l0aCB5b3VyIHBhc3N3b3JkPC9zcGFuPgogICAgICA8aW5wdXQgaWQ9InBsUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJtYWtlTGluaygpIj5DUkVBVEUgTElOSzwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVmcmVzaFBheSgpIj5DSEVDSyBGT1IgUEFZTUVOVFM8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPllvdSBnZXQgYSBVUkwgdG8gc2VuZCBvdmVyIFdoYXRzQXBwIG9yIGVtYWlsLiBXaGVuIGl0IHNldHRsZXMsIHRoZSBsZWRnZXIgdXBkYXRlcyBhbmQgeW91IGdldCBhbiBlbWFpbC48L2Rpdj5gfTwvZGl2PgogIDwvZGl2PgogIDxkaXYgZGF0YS1saXZlPSJwYXkiPiR7TElWRS5wYXkoKX08L2Rpdj5gOwp9OwpmdW5jdGlvbiBwYXlIaW50KCl7CiAgY29uc3QgZz0oUy5nYXRld2F5c3x8W10pLmZpbmQoeD0+eC5pZD09PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZ1NlbCcpLnZhbHVlKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF5SGludCcpOwogIGlmKGcmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKGcubGFiZWwpfTwvYj48YnI+JHtlc2MoZy5zaWdudXApfTxicj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGcua2V5SGludCl9PC9zcGFuPmA7Cn0KYXN5bmMgZnVuY3Rpb24gY29ubmVjdFBheSgpewogIGZsYXNoKCdWZXJpZnlpbmcga2V5cyBhZ2FpbnN0IHRoZSByZWFsIEFQSeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2Nvbm5lY3QnLHtnYXRld2F5OnBnU2VsLnZhbHVlLGtleUlkOnBnSWQudmFsdWUsa2V5U2VjcmV0OnBnU2VjcmV0LnZhbHVlfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5saXZlPydDT05ORUNURUQg4oCUIExJVkUgTU9ERSwgcmVhbCBtb25leSc6J0Nvbm5lY3RlZCBpbiBURVNUIG1vZGUnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5KCl7IGlmKCFjb25maXJtKCdEaXNjb25uZWN0IHRoZSBwYXltZW50IGdhdGV3YXk/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvcGF5L3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gbWFrZUxpbmsoKXsKICBmbGFzaCgnQ3JlYXRpbmcgbGlua+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L2xpbmsnLHthbW91bnQ6K3BsQW10LnZhbHVlLGRlc2NyaXB0aW9uOnBsRGVzYy52YWx1ZSwKICAgICAgbmFtZTpwbE5hbWUudmFsdWUsZW1haWw6cGxFbWFpbC52YWx1ZSxwaG9uZTpwbFBob25lLnZhbHVlLAogICAgICBwdzooZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsUHcnKXx8e30pLnZhbHVlfSk7CiAgICByZW5kZXIoKTsKICAgIG1vZGFsKGA8aDM+UGF5bWVudCBsaW5rIHJlYWR5PC9oMz4KICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMnB4Ij48ZGl2IHN0eWxlPSJ3b3JkLWJyZWFrOmJyZWFrLWFsbDtjb2xvcjp2YXIoLS1jeSkiPiR7ZXNjKHIudXJsKX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoJyR7ZXNjKHIudXJsKX0nKTtmbGFzaCgnQ29waWVkJykiPkNvcHkgbGluazwvYnV0dG9uPgogICAgICA8YSBjbGFzcz0iYnRuIiBocmVmPSIke2VzYyhyLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+T3BlbiDihpc8L2E+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFBheSgpeyBmbGFzaCgnQ2hlY2tpbmcgZ2F0ZXdheeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcGF5L3JlZnJlc2gnLHt9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChyLnVwZGF0ZWQ/ci51cGRhdGVkKycgb3JkZXIocykgdXBkYXRlZCc6J05vIGNoYW5nZXMnKTsgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQoKLyogLS0tLS0tLS0tLSBERUVQIFJFU0VBUkNIIC0tLS0tLS0tLS0gKi8KUkVOREVSLnJlc2VhcmNoPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxYzNmNzU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMwODEzMWYsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYmx1KSI+8J+MkCBERUVQIFJFU0VBUkNIIOKAlCBMSVZFIEZST00gVEhFIE9QRU4gV0VCPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkhlIGRvZXMgbm90IHN0b3JlIHRoZSB3b3JsZCdzIGRhdGEg4oCUIG5vYm9keSBjYW4uIEluc3RlYWQgaGUgPGI+ZmV0Y2hlcyBpdCBsaXZlIHRoZSBtb21lbnQgeW91IGFzazwvYj4sIHdoaWNoIGlzIGJldHRlciwgYmVjYXVzZSBzdG9yZWQgZGF0YSBpcyBzdGFsZSB3aXRoaW4gZGF5cy4gU291cmNlczogRHVja0R1Y2tHbywgV2lraXBlZGlhLCBXb3JsZCBCYW5rLCBsaXZlIEZYLiBObyBBUEkga2V5LCBubyBwYWlkIHNlYXJjaC48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPkRlZXAgZGl2ZTwvYj4gc2VhcmNoZXMgNSBkaWZmZXJlbnQgYW5nbGVzLCBkZWR1cGxpY2F0ZXMsIGFkZHMgb3BlbiBkYXRhc2V0cywgdGhlbiByZWFzb25zIG92ZXIgdGhlIGxvdC48L2xpPgogICA8bGk+PGI+UmVhZCBwYWdlPC9iPiBwdWxscyB0aGUgZnVsbCB0ZXh0IG9mIGFueSBVUkwg4oCUIGNvbXBldGl0b3Igc2l0ZXMsIHByaWNlIGxpc3RzLCBnb3Zlcm5tZW50IHBhZ2VzLjwvbGk+CiAgIDxsaT5IZSBpcyBpbnN0cnVjdGVkIHRvIHN0YXRlIHdoYXQgaGUgY291bGQgPGI+bm90PC9iPiBmaW5kLCByYXRoZXIgdGhhbiBmaWxsaW5nIGdhcHMgd2l0aCBpbnZlbnRpb24uPC9saT4KICA8L3VsPjwvZGl2PgogJHshUy5sbG0/JzxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkNvbm5lY3QgYW4gQUkgYnJhaW4gZmlyc3Qg4oCUIHJlc2VhcmNoIG5lZWRzIHJlYXNvbmluZyB0byBiZSB1c2VmdWwuPC9kaXY+PC9kaXY+JzonJ30KIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWVwIERpdmUgYSBUb3BpYzwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VG9waWM8L3NwYW4+PGlucHV0IGlkPSJkdlRvcGljIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJlLmcuIHVwdGltZSBtb25pdG9yaW5nIGRlbWFuZCBmb3IgTHVkaGlhbmEgZS1jb21tZXJjZSI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5SZWdpb248L3NwYW4+PGlucHV0IGlkPSJkdlJlZ2lvbiIgY2xhc3M9ImluIiB2YWx1ZT0iTHVkaGlhbmEgUHVuamFiIEluZGlhIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9EaXZlKCkiPklOVkVTVElHQVRFPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlRha2VzIH4xNXMuIEZpdmUgc2VhcmNoZXMgcGx1cyBvcGVuIGRhdGEuPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlYWQgQW55IFBhZ2U8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVSTDwvc3Bhbj48aW5wdXQgaWQ9InJkVXJsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJodHRwczovL2NvbXBldGl0b3IuY29tL3ByaWNpbmciPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBkbyB5b3Ugd2FudCB0byBrbm93PyAob3B0aW9uYWwpPC9zcGFuPjxpbnB1dCBpZD0icmRBc2siIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IndoYXQgZG8gdGhleSBjaGFyZ2UgYW5kIHdoYXQgaXMgbWlzc2luZyI+PC9sYWJlbD4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImRvUmVhZCgpIj5SRUFEIElUPC9idXR0b24+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlB1bGxzIHVwIHRvIDEyLDAwMCBjaGFyYWN0ZXJzIG9mIHJlYWwgcGFnZSB0ZXh0LjwvZGl2PjwvZGl2PgogPC9kaXY+CiA8ZGl2IGlkPSJyZXNPdXQiPjwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRvRGl2ZSgpewogIGNvbnN0IHQ9ZHZUb3BpYy52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYSB0b3BpYycpOwogIHJlc091dC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5TZWFyY2hpbmcgdGhlIGxpdmUgd2Vi4oCmPC9kaXY+PC9kaXY+JzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Jlc2VhcmNoL2RpdmUnLHt0b3BpYzp0LHJlZ2lvbjpkdlJlZ2lvbi52YWx1ZX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkZpbmRpbmdzIDxzcGFuIGNsYXNzPSJ0YWcgdC1ibHUiPiR7Zm10KHIuZXZpZGVuY2UpfSBjaGFycyBvZiBldmlkZW5jZTwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KYXN5bmMgZnVuY3Rpb24gZG9SZWFkKCl7CiAgY29uc3QgdT1yZFVybC52YWx1ZS50cmltKCk7IGlmKCF1KSByZXR1cm4gZmxhc2goJ1Bhc3RlIGEgVVJMJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPkZldGNoaW5nIHBhZ2XigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvcmVhZCcse3VybDp1LGFzazpyZEFzay52YWx1ZS50cmltKCl9KTsKICAgIHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiPjxoMz4ke2VzYyhyLnRpdGxlKX0gPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5jaGFycyl9IGNoYXJzIHJlYWQ8L3NwYW4+PC9oMz4KICAgICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42NSI+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj5gOwogIH1jYXRjaChlKXsgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4ke2VzYyhlLm1lc3NhZ2UpfTwvZGl2PjwvZGl2PmAgfQp9CgovKiAtLS0tLS0tLS0tIEFJIEJSQUlOIC0tLS0tLS0tLS0gKi8KUkVOREVSLmJyYWluPSgpPT57CiAgY29uc3QgTD1TLmxsbSwgUFY9Uy5wcm92aWRlcnN8fFtdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke0w/JyMxYzVjM2MnOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7TD8nIzA4MTcwZic6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtMPyd2YXIoLS1ncm4pJzondmFyKC0tYW1iKSd9Ij7il4ggQUkgQlJBSU4g4oCUICR7TD8nQ09OTkVDVEVEJzonTk9UIENPTk5FQ1RFRCd9PC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke0wKICAgID9gQWdlbnRzIGNhbiB0aGluay4gQ29ubmVjdGVkIHRvIDxiPiR7ZXNjKEwucHJvdmlkZXIpfTwvYj4gcnVubmluZyA8Yj4ke2VzYyhMLm1vZGVsKX08L2I+LiBLZXkgJHtlc2MoTC5rZXkpfS5gCiAgICA6J1lvdXIgYWdlbnRzIGNhbiBtZWFzdXJlIHRoaW5ncyBidXQgY2Fubm90IDxiPnJlYXNvbjwvYj4geWV0LiBDb25uZWN0IGEgZnJlZSBtb2RlbCBiZWxvdyBhbmQgdGhleSBnYWluIHRoZSBhYmlsaXR5IHRvIGRpYWdub3NlLCB3cml0ZSwgYW5hbHlzZSBhbmQgc3RyYXRlZ2lzZS4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+RXZlcnkgcHJvdmlkZXIgYmVsb3cgaXMgPGI+Z2VudWluZWx5IGZyZWU8L2I+IOKAlCBubyBjcmVkaXQgY2FyZC48L2xpPgogICAgPGxpPllvdXIga2V5IGlzIHN0b3JlZCBsb2NhbGx5IGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzRhMzA4MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE0MGYyMiwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4pqRIFdBTlQgSElNIEZVTExZIElOREVQRU5ERU5UPyDigJQgUkVBRCBUSElTPC9oMz4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkEgdGhpbmtpbmcgYnJhaW4gY2Fubm90IGJlIGNvbmp1cmVkIGZyb20gbm90aGluZy4gVHJhaW5pbmcgb25lIGNvc3RzIG1pbGxpb25zIGluIEdQVSB0aW1lLiBFdmVyeSBBSSBvbiBlYXJ0aCDigJQgaW5jbHVkaW5nIHRoaXMgb25lIOKAlCBydW5zIHdlaWdodHMgdHJhaW5lZCBieSBzb21lb25lIHdpdGggYSBkYXRhIGNlbnRyZS4gVGhlIGhvbmVzdCBxdWVzdGlvbiBpcyBub3QgPGVtPiJoaXMgYnJhaW4gb3IgdGhlaXJzIjwvZW0+IGJ1dCA8Yj4id2hvIGNhbiBzd2l0Y2ggaXQgb2ZmIjwvYj4uPC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+T2xsYW1hIGlzIHRoZSBhbnN3ZXIgdG8gdGhhdC48L2I+IFRoZSBtb2RlbCBmaWxlIHNpdHMgb24geW91ciBvd24gZGlzay4gTm8ga2V5LCBubyBhY2NvdW50LCBubyByYXRlIGxpbWl0LCBubyB0ZXJtcyBvZiBzZXJ2aWNlLiBJdCB3b3JrcyB3aXRoIHRoZSBpbnRlcm5ldCB1bnBsdWdnZWQuIE5vYm9keSBjYW4gcmV2b2tlIGl0LCByZWFkIHlvdXIgcHJvbXB0cywgb3IgY2hhbmdlIHRoZSBkZWFsLiBUaGF0IGlzIHJlYWwgc292ZXJlaWdudHkg4oCUIHRoZSBvbmx5IGNvc3QgaXMgeW91ciBoYXJkd2FyZS48L2Rpdj4KICAgPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij4xLiBJbnN0YWxsPC90ZD48dGQ+RG93bmxvYWQgZnJvbSA8Yj5vbGxhbWEuY29tPC9iPiAoZnJlZSwgV2luZG93cy9NYWMvTGludXgpPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjIuIEdldCBhIG1vZGVsPC90ZD48dGQ+SW4gdGVybWluYWw6IDxjb2RlPm9sbGFtYSBwdWxsIGxsYW1hMy4yPC9jb2RlPiDigJQgYWJvdXQgMiBHQjwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4zLiBDb25uZWN0PC90ZD48dGQ+Q2hvb3NlIDxiPk9sbGFtYTwvYj4gYWJvdmUsIGxlYXZlIHRoZSBrZXkgYmxhbmssIHByZXNzIENPTk5FQ1Q8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QmlnZ2VyIGJyYWluPC90ZD48dGQ+PGNvZGU+b2xsYW1hIHB1bGwgcXdlbjIuNToxNGI8L2NvZGU+IGlmIHlvdSBoYXZlIDE2IEdCKyBSQU08L3RkPjwvdHI+CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PGI+VGhlIHRyYWRlLW9mZiwgc3RhdGVkIHBsYWlubHk6PC9iPiBhIGxvY2FsIG1vZGVsIG9uIGEgbm9ybWFsIGxhcHRvcCBpcyBzbG93ZXIgYW5kIGxlc3MgY2FwYWJsZSB0aGFuIEdyb3EncyBmcmVlIGNsb3VkIG1vZGVscy4gWW91IGFyZSBleGNoYW5naW5nIHJhdyBwb3dlciBmb3IgdG90YWwgY29udHJvbC4gQWxzbyDigJQgdGhpcyBSZW5kZXIgaW5zdGFuY2UgY2Fubm90IHJlYWNoIGFuIE9sbGFtYSBydW5uaW5nIG9uIHlvdXIgUEM7IGxvY2FsIGJyYWluIG1lYW5zIHJ1bm5pbmcgdGhlIENoYWlybWFuIGxvY2FsbHkgdG9vLjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBhIEZyZWUgTW9kZWw8L2gzPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qcm92aWRlcjwvc3Bhbj48c2VsZWN0IGlkPSJscFByb3YiIGNsYXNzPSJpbiIgb25jaGFuZ2U9InByb3ZIaW50KCkiPgogICAgICR7UFYubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9IiAke0wmJkwucHJvdmlkZXI9PT1wLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKHAubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icHJvdkhpbnQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEycHgiPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BUEkgS2V5IDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+KG5vdCBuZWVkZWQgZm9yIE9sbGFtYSk8L3NwYW4+PC9zcGFuPgogICAgIDxpbnB1dCBpZD0ibHBLZXkiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icGFzdGUgeW91ciBmcmVlIGtleSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TW9kZWwgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oYmxhbmsgPSBwcm92aWRlciBkZWZhdWx0KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscE1vZGVsIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJsZWF2ZSBibGFuayIgbGlzdD0ibW9kZWxMaXN0Ij4KICAgICA8ZGF0YWxpc3QgaWQ9Im1vZGVsTGlzdCI+PC9kYXRhbGlzdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29ubmVjdExMTSgpIj5DT05ORUNUIEJSQUlOPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0TExNKCkiPlRFU1QgSVQ8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImZldGNoTW9kZWxzKCkiPkZFVENIIExJVkUgTU9ERUxTPC9idXR0b24+CiAgICAgJHtMPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlTExNKCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvdmlkZXJzIHJldGlyZSBtb2RlbHMgd2l0aG91dCBub3RpY2UuIElmIFRFU1QgSVQgc2F5cyBNT0RFTCBSRVRJUkVELCBwcmVzcyBGRVRDSCBMSVZFIE1PREVMUyBhbmQgcGljayBvbmUgZnJvbSB0aGUgbGlzdC48L2Rpdj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjokeyhTLmNvb2xkb3dufHwwKT8ndmFyKC0tbWFnKSc6J3ZhcigtLXN0cm9rZSknfSI+CiAgICA8aDM+QmFja3VwIFByb3ZpZGVycyA8c3BhbiBjbGFzcz0idGFnICR7KFMubGxtQmFja3Vwc3x8W10pLmxlbmd0aD8ndC1ncm4nOid0LWRpbSd9Ij4keyhTLmxsbUJhY2t1cHN8fFtdKS5sZW5ndGh9IFNQQVJFPC9zcGFuPjwvaDM+CiAgICAkeyhTLmNvb2xkb3dufHwwKT9gPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpIj48Yj5RVU9UQSBDT09MRE9XTiDigJQgJHtNYXRoLmNlaWwoUy5jb29sZG93bi82MCl9IG1pbiBsZWZ0LjwvYj4gVGhlIGZyZWUgdGllciB0aHJvdHRsZWQuIEFJIHdvcmsgaXMgcGF1c2VkIHNvIHRoZSBsaW1pdCBjYW4gcmVzZXQ7IG1vbml0b3Jpbmcga2VlcHMgcnVubmluZy4gQWRkIGEgYmFja3VwIGJlbG93IGFuZCB3b3JrIGNvbnRpbnVlcyBzdHJhaWdodCB0aHJvdWdoIHRoZSBuZXh0IGxpbWl0LgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImNsZWFyQ29vbCgpIj5DbGVhciBjb29sZG93biBub3c8L2J1dHRvbj48L2Rpdj48L2Rpdj5gOicnfQogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPkZyZWUgdGllcnMgdGhyb3R0bGUuIEFkZCA8Yj51cCB0byA0MCBrZXlzPC9iPiDigJQgZnJvbSBkaWZmZXJlbnQgcHJvdmlkZXJzLCBvciBzZXZlcmFsIGtleXMgZnJvbSB0aGUgc2FtZSBvbmUuIFdoZW4gYW55IGtleSBpcyByYXRlLWxpbWl0ZWQgaXQgaXMgcGFya2VkIGZvciAxMCBtaW51dGVzIGFuZCB0aGUgQ2hhaXJtYW4gcm90YXRlcyB0byB0aGUgbmV4dCBhdXRvbWF0aWNhbGx5LiBOb3RoaW5nIHN0b3BzLjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Qcm92aWRlcjwvc3Bhbj48c2VsZWN0IGlkPSJia1Byb3YiIGNsYXNzPSJpbiI+CiAgICAgICR7KFMucHJvdmlkZXJzfHxbXSkubWFwKHA9PmA8b3B0aW9uIHZhbHVlPSIke3AuaWR9Ij4ke2VzYyhwLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QVBJIGtleTwvc3Bhbj48aW5wdXQgaWQ9ImJrS2V5IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk1vZGVsIChibGFuayA9IGRlZmF1bHQpPC9zcGFuPjxpbnB1dCBpZD0iYmtNb2RlbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ibGVhdmUgYmxhbmsiPjwvbGFiZWw+CiAgICA8L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJhZGRCYWNrdXAoKSI+QUREIEJBQ0tVUDwvYnV0dG9uPgogICAgJHsoUy5sbG1CYWNrdXBzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPiM8L3RoPjx0aD5Qcm92aWRlcjwvdGg+PHRoPk1vZGVsPC90aD48dGg+S2V5PC90aD48dGg+U2VydmVkPC90aD48dGg+U3RhdGU8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAgJHtTLmxsbUJhY2t1cHMubWFwKChiLGkpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7aSsxfTwvdGQ+PHRkPiR7ZXNjKGIucHJvdmlkZXIpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGIubW9kZWwpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoYi5rZXkpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7Yi5va3x8MH0ke2IuZmFpbD8nIC8gJytiLmZhaWwrJ+Kclyc6Jyd9PC90ZD4KICAgICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtiLmNvb2xlZD8ndC1hbWInOid0LWdybid9Ij4ke2IuY29vbGVkPydDT09MSU5HJzonUkVBRFknfTwvc3Bhbj48L3RkPgogICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJybUJhY2t1cCgke2l9KSI+UmVtb3ZlPC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+UmVjb21tZW5kZWQgc3BhcmVzOiA8Yj5Hb29nbGUgQUkgU3R1ZGlvPC9iPiAoMSw1MDAvZGF5KSwgPGI+Q2VyZWJyYXM8L2I+ICgxTSB0b2tlbnMvZGF5KSwgPGI+TlZJRElBIE5JTTwvYj4uIERpZmZlcmVudCBjb21wYW5pZXMgbWVhbnMgc2VwYXJhdGUgcXVvdGFzLjwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+V2hhdCBBZ2VudHMgR2FpbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5haS5icmllZjwvdGQ+PHRkPkV4ZWN1dGl2ZSBicmllZiB3cml0dGVuIGZyb20geW91ciByZWFsIHN5c3RlbSBzdGF0ZTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkuaW5jaWRlbnQ8L3RkPjx0ZD5SYW5rZWQgZGlhZ25vc2lzIG9mIGFueSBzaXRlIHRoYXQgZ29lcyBkb3duPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5yZXZlbnVlPC90ZD48dGQ+Q29uY3JldGUgbW9uZXktbWFraW5nIHJvdXRlcyBmcm9tIHdoYXQgeW91IGFjdHVhbGx5IGhhdmU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmNsaWVudF9yZXBvcnQ8L3RkPjx0ZD5DbGllbnQtcmVhZHkgdXB0aW1lIHJlcG9ydCB5b3UgY2FuIHNlbmQgYW5kIGNoYXJnZSBmb3I8L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWRkIHRoZXNlIG9uIHRoZSBMaXZlIE9wZXJhdGlvbnMgcGFnZSBhcyBzdGFuZGluZyBvcmRlcnMsIG9yIHJ1biB0aGVtIG9uIGRlbWFuZCBmcm9tIEFnZW50IFdvcmsuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmZ1bmN0aW9uIHByb3ZIaW50KCl7CiAgY29uc3QgcD0oUy5wcm92aWRlcnN8fFtdKS5maW5kKHg9PnguaWQ9PT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBQcm92JykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm92SGludCcpOwogIGlmKHAmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48YnI+JHtlc2MocC5zaWdudXApfTxicj5EZWZhdWx0IG1vZGVsOiA8Y29kZT4ke2VzYyhwLm1vZGVsKX08L2NvZGU+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0TExNKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Nvbm5lY3QnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlLG1vZGVsOmxwTW9kZWwudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQnJhaW4gY29ubmVjdGVkIOKAlCBub3cgcHJlc3MgVEVTVCBJVCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gdGVzdExMTSgpeyBmbGFzaCgnVGhpbmtpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS90ZXN0Jyx7fSk7IHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5BSSBCcmFpbiBPbmxpbmU8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXY+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5tb2RlbCl9IMK3ICR7ci5tc31tczwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnbygnd29yaycpIj5HaXZlIGl0IHdvcmsg4oaSPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBwdXJnZUxMTSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCB0aGUgQUkgYnJhaW4/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvbGxtL3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gYWRkQmFja3VwKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2JhY2t1cC9hZGQnLHtwcm92aWRlcjpia1Byb3YudmFsdWUsa2V5OmJrS2V5LnZhbHVlLG1vZGVsOmJrTW9kZWwudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQmFja3VwIGFkZGVkIOKAlCBxdW90YSBsaW1pdHMgd2lsbCBubyBsb25nZXIgc3RvcCB5b3UnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHJtQmFja3VwKGkpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2JhY2t1cC9yZW1vdmUnLHtpbmRleDppfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJDb29sKCl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vY29vbGRvd24vY2xlYXInLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdDb29sZG93biBjbGVhcmVkJykgfQphc3luYyBmdW5jdGlvbiBmZXRjaE1vZGVscygpewogIGZsYXNoKCdBc2tpbmcgcHJvdmlkZXIgd2hhdCBpdCBzZXJ2ZXMgdG9kYXnigKYnKTsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9sbG0vbW9kZWxzJyx7cHJvdmlkZXI6bHBQcm92LnZhbHVlLGtleTpscEtleS52YWx1ZX0pOwogICAgaWYoIXIubW9kZWxzLmxlbmd0aCkgcmV0dXJuIGZsYXNoKCdQcm92aWRlciByZXR1cm5lZCBubyBjaGF0IG1vZGVscycpOwogICAgbW9kYWwoYDxoMz5MaXZlIG1vZGVscyBvbiAke2VzYyhscFByb3YudmFsdWUpfTwvaDM+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7ci5tb2RlbHMubGVuZ3RofSBhdmFpbGFibGUgcmlnaHQgbm93LiBDbGljayBvbmUgdG8gdXNlIGl0LjwvZGl2PgogICAgIDxkaXYgY2xhc3M9ImRpckxpc3QiIHN0eWxlPSJtYXgtaGVpZ2h0OjM0MHB4Ij4ke3IubW9kZWxzLm1hcChtPT4KICAgICAgIGA8YnV0dG9uIG9uY2xpY2s9InBpY2tNb2RlbCgnJHtlc2MobSl9JykiPiR7ZXNjKG0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBwaWNrTW9kZWwobSl7IGNsb3NlTW9kYWwoKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBNb2RlbCcpOyBpZihlbCkgZWwudmFsdWU9bTsKICBmbGFzaCgnTW9kZWwgc2V0IHRvICcrbSsnIOKAlCBwcmVzcyBDT05ORUNUIEJSQUlOIHRoZW4gVEVTVCBJVCcpOyB9CgovKiAtLS0tLS0tLS0tIEFHRU5UIFdPUksgLS0tLS0tLS0tLSAqLwpjb25zdCBRVUlDSz1bCiBbJ0V4ZWN1dGl2ZSBicmllZicsJ1N1bW1hcmlzZSBteSBzeXN0ZW0gc3RhdGUgYW5kIHRlbGwgbWUgdGhlIHNpbmdsZSBtb3N0IHVyZ2VudCB0aGluZyB0byBmaXguIEJlIGJsdW50LiddLAogWydNYWtlIG1vbmV5JywnT25seSBwcm9wb3NlIG9mZmVycyBkZWxpdmVyZWQgdXNpbmcgTVkgdXB0aW1lIG1vbml0b3Jpbmcgc3lzdGVtICgyNC83IEhUVFAgcHJvYmluZywgVExTIGV4cGlyeSBhbGVydHMsIGluc3RhbnQgb3V0YWdlIGVtYWlsLCBhdmFpbGFiaWxpdHkgYW5kIHA5NSByZXBvcnRpbmcpLiBUUlVUSCBSVUxFOiBJIGhhdmUgbmV2ZXIgbW9uaXRvcmVkIGFueSBjbGllbnQgc2l0ZSBhbmQgaGF2ZSBubyB0cmFjayByZWNvcmQuIFRoZSBvdXRyZWFjaCBtZXNzYWdlIG11c3QgY29udGFpbiBaRVJPIGNsYWltcyBJIGNhbm5vdCBwcm92ZSDigJQgbm8gIkkgbm90aWNlZCBvdXRhZ2VzIG9uIGxvY2FsIHNpdGVzIiwgbm8gaW52ZW50ZWQgcmV2ZW51ZSBmaWd1cmVzLCBubyB1bnZlcmlmaWVkIHN0YXRpc3RpY3MuIExlYWQgd2l0aCBhIGZyZWUgdHJpYWwsIG5vdCBhIGZha2Ugb2JzZXJ2YXRpb24uIFZlcmlmeSBhbnkgYXJpdGhtZXRpYyB5b3Ugc3RhdGUuIEdpdmUgMyBvZmZlcnM6IHRoZSBvZmZlciBpbiBvbmUgc2VudGVuY2UsIHRoZSBMdWRoaWFuYSBidXNpbmVzcyB0eXBlIGFuZCBpdHMgcmVhbCBwYWluLCBtb250aGx5IElOUiBwcmljZSB3aXRoIHNvdW5kIHJlYXNvbmluZywgdGhlIGxpdGVyYWwgZmlyc3QgV2hhdHNBcHAgbWVzc2FnZSB1bmRlciA1MCB3b3JkcywgYW5kIHRoZSBiaWdnZXN0IG9iamVjdGlvbiB3aXRoIGFuIGhvbmVzdCBjb3VudGVyLiBDb2xkIG91dHJlYWNoIGNsb3NlcyAxLTMlLiddLAogWydGaW5kIHByb3NwZWN0cycsJ0xpc3QgMTAgc3BlY2lmaWMgYnVzaW5lc3MgdHlwZXMgaW4gTHVkaGlhbmEgdGhhdCBsb3NlIHJlYWwgbW9uZXkgd2hlbiB0aGVpciB3ZWJzaXRlIGdvZXMgZG93biwgcmFua2VkIGJ5IGhvdyBtdWNoIHRoZXkgbG9zZSBwZXIgaG91ci4gRm9yIGVhY2gsIHNheSB3aGVyZSBJIGNhbiBmaW5kIHRoZWlyIGNvbnRhY3QgZGV0YWlscyBmb3IgZnJlZS4nXSwKIFsnQ2xpZW50IHBpdGNoJywnV3JpdGUgYSBXaGF0c0FwcCBtZXNzYWdlIG9mZmVyaW5nIGZyZWUgMTQtZGF5IHdlYnNpdGUgdXB0aW1lIG1vbml0b3JpbmcgdG8gYSBsb2NhbCBidXNpbmVzcyBvd25lci4gUGxhaW4gSW5kaWFuIEVuZ2xpc2gsIG5vIG1hcmtldGluZyBsYW5ndWFnZSwgbm8gZW1vamkuIFVuZGVyIDQ1IHdvcmRzLiBUaGUgZ29hbCBpcyBhIHJlcGx5LCBub3QgYSBzYWxlLiddLAogWydIYW5kbGUgb2JqZWN0aW9ucycsJ0EgTHVkaGlhbmEgYnVzaW5lc3Mgb3duZXIgc2F5cyAibXkgd2Vic2l0ZSBuZXZlciBnb2VzIGRvd24sIEkgZG9uIG5vdCBuZWVkIHRoaXMiLiBHaXZlIG1lIHRocmVlIGhvbmVzdCByZXBsaWVzIHRoYXQgZG8gbm90IGV4YWdnZXJhdGUgb3IgdXNlIGZlYXIgdGFjdGljcy4nXSwKIFsnSW52b2ljZSB0ZW1wbGF0ZScsJ1dyaXRlIGEgc2ltcGxlIG1vbnRobHkgaW52b2ljZSBmb3Igd2Vic2l0ZSB1cHRpbWUgbW9uaXRvcmluZywgcmVhZHkgdG8gZmlsbCBpbiwgc3VpdGFibGUgZm9yIGEgc21hbGwgSW5kaWFuIGJ1c2luZXNzLiBJbmNsdWRlIEdTVCBwbGFjZWhvbGRlciBhbmQgVVBJIHBheW1lbnQgbGluZS4nXQpdOwpSRU5ERVIud29yaz0oKT0+ewogIGNvbnN0IE89Uy5vdXRwdXRzfHxbXTsKICByZXR1cm4gYCR7IVMubGxtP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5OTyBCUkFJTiBDT05ORUNURUQ8L2gzPgogICA8ZGl2PkFnZW50cyBjYW5ub3QgdGhpbmsgeWV0LiA8YiBvbmNsaWNrPSJnbygnYnJhaW4nKSIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KTtjdXJzb3I6cG9pbnRlcjt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lIj5Db25uZWN0IGEgZnJlZSBtb2RlbDwvYj4gZmlyc3Qg4oCUIHRha2VzIGFib3V0IDIgbWludXRlcyBhbmQgbmVlZHMgbm8gY3JlZGl0IGNhcmQuPC9kaXY+PC9kaXY+YDonJ30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2l2ZSB0aGUgQ2hhaXJtYW4gV29yayA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPlBMQUlOIEVOR0xJU0g8L3NwYW4+PC9oMz4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlR5cGUgYW55IGluc3RydWN0aW9uLiBBIHJlYWwgbW9kZWwgZXhlY3V0ZXMgaXQgYW5kIHRoZSByZXN1bHQgaXMgc2F2ZWQgYmVsb3cuPC9kaXY+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW5zdHJ1Y3Rpb248L3NwYW4+PHRleHRhcmVhIGlkPSJ3a1Byb21wdCIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo5MHB4IgogICAgIHBsYWNlaG9sZGVyPSJlLmcuIFdyaXRlIGEgb25lLXBhZ2UgcHJvcG9zYWwgb2ZmZXJpbmcgdXB0aW1lIG1vbml0b3JpbmcgdG8gYSBMdWRoaWFuYSBjbG90aGluZyBzaG9wLCBwcmljZWQgaW4gSU5SLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb1dvcmsoKSI+RVhFQ1VURTwvYnV0dG9uPgogICAgJHtPLmxlbmd0aD8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhcldvcmsoKSI+Q2xlYXIgcmVzdWx0czwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjZweCI+UXVpY2sgdGFza3M6PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPiR7UVVJQ0subWFwKChxLGkpPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJxdWljaygke2l9KSI+JHtlc2MocVswXSl9PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+PC9kaXY+PC9kaXY+CiAgJHtPLmxlbmd0aD9PLm1hcCgobyxpKT0+YDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLWJvdHRvbTo4cHgiPgogICAgIDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9InRhZyB0LXB1ciI+JHtlc2Moby50YWcpfTwvc3Bhbj48Yj4ke2VzYyhvLmFnZW50KX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke28udH0gwrcgJHtvLm1zfW1zIMK3ICR7by50b2tlbnN9IHRva2Vuczwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiI+JHtlc2Moby50ZXh0KX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJjb3B5T3V0KCR7aX0pIj5Db3B5PC9idXR0b24+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOic8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gd29yayBwcm9kdWNlZCB5ZXQuPC9kaXY+PC9kaXY+J31gfTsKYXN5bmMgZnVuY3Rpb24gZG9Xb3JrKCl7CiAgY29uc3QgcD13a1Byb21wdC52YWx1ZS50cmltKCk7IGlmKCFwKSByZXR1cm4gZmxhc2goJ1R5cGUgYW4gaW5zdHJ1Y3Rpb24gZmlyc3QnKTsKICBmbGFzaCgnV29ya2luZ+KApicpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2xsbS9hc2snLHtwcm9tcHQ6cH0pOyByZW5kZXIoKTsgZmxhc2goJ0RvbmUnKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQpmdW5jdGlvbiBxdWljayhpKXsgd2tQcm9tcHQudmFsdWU9UVVJQ0tbaV1bMV07IGRvV29yaygpIH0KZnVuY3Rpb24gY29weU91dChpKXsgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0KChTLm91dHB1dHN8fFtdKVtpXS50ZXh0KTsgZmxhc2goJ0NvcGllZCcpIH0KYXN5bmMgZnVuY3Rpb24gY2xlYXJXb3JrKCl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vY2xlYXInLHt9KTsgcmVuZGVyKCkgfQoKLyogLS0tLS0tLS0tLSBMSVZFIE9QRVJBVElPTlMgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiBhZ28oaXNvKXsgaWYoIWlzbykgcmV0dXJuICduZXZlcic7CiAgY29uc3Qgcz1NYXRoLmZsb29yKChEYXRlLm5vdygpLW5ldyBEYXRlKGlzby5yZXBsYWNlKCcgJywnVCcpKydaJykuZ2V0VGltZSgpKS8xMDAwKTsKICBpZihzPDYwKSByZXR1cm4gcysncyBhZ28nOyBpZihzPDM2MDApIHJldHVybiBNYXRoLmZsb29yKHMvNjApKydtIGFnbyc7IHJldHVybiBNYXRoLmZsb29yKHMvMzYwMCkrJ2ggYWdvJzsgfQpmdW5jdGlvbiBldmVyeShuKXsgcmV0dXJuIG48NjA/bisncyc6bjwzNjAwP01hdGgucm91bmQobi82MCkrJ20nOk1hdGgucm91bmQobi8zNjAwKSsnaCc7IH0KTElWRS5vcHM9KCk9PnsKICBjb25zdCBUPVMudGFza3N8fFtdLCBSPVMucnVuc3x8W107CiAgY29uc3Qgb249VC5maWx0ZXIodD0+dC5lbmFibGVkKS5sZW5ndGg7CiAgY29uc3QgdG90YWxSdW5zPVQucmVkdWNlKChhLHQpPT5hKyh0LnJ1bnN8fDApLDApOwogIGNvbnN0IGZhaWxzPVQucmVkdWNlKChhLHQpPT5hKyh0LmZhaWxzfHwwKSwwKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShTLnJ1bm5pbmc/J1JVTk5JTkcnOidIQUxURUQnLCdTeXN0ZW0gU3RhdGUnLFMucnVubmluZz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknLFMucnVubmluZz8nd29yayBleGVjdXRpbmcnOidub3RoaW5nIHJ1bm5pbmcnKX0KICAgJHtrcGkob24rJyAvICcrVC5sZW5ndGgsJ1N0YW5kaW5nIE9yZGVycyBMaXZlJywndmFyKC0tY3kpJywnb24gc2NoZWR1bGUnKX0KICAgJHtrcGkoZm10KHRvdGFsUnVucyksJ0pvYnMgRXhlY3V0ZWQnLCd2YXIoLS1ncm4pJyxTLnRpY2tzKycgc2NoZWR1bGVyIHRpY2tzJyl9CiAgICR7a3BpKGZhaWxzLCdGYWlsdXJlcycsZmFpbHM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnc2luY2UgaW5zdGFsbCcpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TdGFuZGluZyBPcmRlcnMgPHNwYW4gY2xhc3M9InRhZyAke1MucnVubmluZz8ndC1ncm4nOid0LXJlZCd9Ij4ke1MucnVubmluZz8nRVhFQ1VUSU5HJzonRlJPWkVOJ308L3NwYW4+PC9oMz4KICAgJHtULmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5DYXBhYmlsaXR5PC90aD48dGg+T3duZXIgQWdlbnQ8L3RoPjx0aD5FdmVyeTwvdGg+PHRoPkxhc3QgUnVuPC90aD48dGg+UmVzdWx0PC90aD48dGg+UnVuczwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtULm1hcCh0PT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyh0LmNhcCl9PC9iPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYygoUy5jYXBzfHxbXSkuZmluZChjPT5jLmNhcD09PXQuY2FwKT8uZGVzY3x8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyh0Lm93bmVyKX08L3RkPgogICAgPHRkPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJ3aWR0aDo3NHB4O3BhZGRpbmc6NHB4IDdweCIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iJHt0LmV2ZXJ5fSIKICAgICAgICBvbmNoYW5nZT0ic2V0RXZlcnkoJyR7dC5pZH0nLHRoaXMudmFsdWUpIiB0aXRsZT0ic2Vjb25kcyI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXZlcnkodC5ldmVyeSl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7YWdvKHQubGFzdEF0KX08L3RkPgogICAgPHRkPiR7dC5sYXN0TXNnP2A8c3BhbiBjbGFzcz0idGFnICR7dC5sYXN0T2s/J3QtZ3JuJzondC1yZWQnfSI+JHt0Lmxhc3RPaz8nT0snOidGQUlMJ308L3NwYW4+ICR7ZXNjKHQubGFzdE1zZyl9YDonPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5ub3QgeWV0IHJ1bjwvc3Bhbj4nfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke3QucnVuc3x8MH0ke3QuZmFpbHM/JyA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+LycrdC5mYWlscysn4pyXPC9zcGFuPic6Jyd9PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0icnVuTm93KCcke3QuaWR9JykiPlJ1bjwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nZ2xlVGFzaygnJHt0LmlkfScsJHshdC5lbmFibGVkfSkiPiR7dC5lbmFibGVkPydQYXVzZSc6J1N0YXJ0J308L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RhbmRpbmcgb3JkZXJzLiBQb3dlciB0aGUgc3lzdGVtIG9uIHRvIGluc3RhbGwgdGhlbS48L2Rpdj4nfTwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5FeGVjdXRpb24gRmVlZCA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke1IubGVuZ3RofTwvc3Bhbj48L2gzPgogICAke1IubGVuZ3RoP2A8ZGl2IGNsYXNzPSJsb2ciPiR7Ui5tYXAocj0+YDxkaXY+PHNwYW4gY2xhc3M9InRzIj4ke3IudH08L3NwYW4+CiAgICAgPHNwYW4gc3R5bGU9ImNvbG9yOiR7ci5vaz8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknfSI+WyR7ci5vaz8nRE9ORSc6J0ZBSUwnfV08L3NwYW4+CiAgICAgPGI+JHtlc2Moci5vd25lcil9PC9iPiDCtyAke2VzYyhyLmNhcCl9IOKAlCAke2VzYyhyLm1zZyl9JHtyLmRldGFpbD9gXG4gICAgICAgIOKGsyAke2VzYyhyLmRldGFpbCl9YDonJ30KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPigke3IubXN9bXMke3IubWFudWFsPycgwrcgbWFudWFsJzonJ30pPC9zcGFuPjwvZGl2PmApLmpvaW4oJycpfTwvZGl2PmAKICAgOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyBleGVjdXRlZCB5ZXQuIFBvd2VyIG9uIGFuZCB0aGUgZmlyc3Qgc3dlZXAgcnVucyB3aXRoaW4gMTAgc2Vjb25kcy48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIub3BzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5odXN0bGU/JyNhODU1ZjcnOicjNjc0NzBmJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7Uy5odXN0bGU/JyMxYTBmMmUnOicjMTUxMDBhJ30sIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6JHtTLmh1c3RsZT8ndmFyKC0tcHVyKSc6J3ZhcigtLWFtYiknfSI+4pqhIEhVU1RMRSBNT0RFIOKAlCAke1MuaHVzdGxlPydFTkdBR0VEJzonT0ZGJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+JHtTLmh1c3RsZQogICA/YDxiPk1heGltdW0gb3V0cHV0LjwvYj4gJHsoUy50YXNrc3x8W10pLmxlbmd0aH0gbW9uZXktZm9jdXNlZCBvcmRlcnMgcnVubmluZyBvbiA8Yj4ke1MubGFuZXN8fDN9IHBhcmFsbGVsIGxhbmVzPC9iPiDigJQgaWRlYXMsIHJlc2VhcmNoLCBtaXNzaW9ucywgcmV2ZW51ZSByb3V0ZXMsIGRlZXAgaW52ZXN0aWdhdGlvbi4gQWxsIGZpcmluZyBhdCBvbmNlLCBub3Qgb25lIGFmdGVyIGFub3RoZXIuYAogICA6J1N3aXRjaGVzIHRoZSByb3N0ZXIgdG8gbW9uZXktZ2VuZXJhdGluZyB3b3JrIG9ubHksIHRpZ2h0ZW5zIGV2ZXJ5IGludGVydmFsLCBhbmQgcnVucyB0YXNrcyA8Yj5pbiBwYXJhbGxlbDwvYj4gaW5zdGVhZCBvZiBzZXF1ZW50aWFsbHkuIEV4cGVjdCByb3VnaGx5IDEw4oCTMjAgY29tcGxldGVkIGpvYnMgaW4gdGhlIGZpcnN0IGhvdXIuJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPlBhcmFsbGVsIGxhbmVzIGZvciBBSSB0YXNrczo8L3NwYW4+CiAgIDxzZWxlY3QgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjkwcHgiIGlkPSJsYW5lU2VsIiBvbmNoYW5nZT0ic2V0TGFuZXModGhpcy52YWx1ZSkiPgogICAgJHtbMSwyLDMsNCw1LDZdLm1hcChuPT5gPG9wdGlvbiB2YWx1ZT0iJHtufSIgJHsoUy5sYW5lc3x8Myk9PW4/J3NlbGVjdGVkJzonJ30+JHtufTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkhpZ2hlciA9IGZhc3RlciwgYnV0IGZyZWUgQUkgdGllcnMgcmF0ZS1saW1pdCBhcm91bmQgMzAgcmVxdWVzdHMvbWluLjwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjIwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0iaHVzdGxlUHciIHBsYWNlaG9sZGVyPSJZb3VyIHBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5odXN0bGU/J25vJzoncCd9IiBvbmNsaWNrPSJ0b2dnbGVIdXN0bGUoKSI+JHtTLmh1c3RsZT8nU1RBTkQgRE9XTic6J0VOR0FHRSBIVVNUTEUgTU9ERSd9PC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+JHtTLmh1c3RsZQogICA/J1N0YW5kaW5nIGRvd24gcmVzdG9yZXMgdGhlIG5vcm1hbCBtb25pdG9yaW5nIHJvc3Rlci4nCiAgIDonVGhpcyByZXBsYWNlcyB5b3VyIGN1cnJlbnQgdGFzayBsaXN0LiBNb25pdG9yaW5nIGNvbnRpbnVlcywgYnV0IHRoZSBlbXBoYXNpcyBzaGlmdHMgaGFyZCB0byByZXZlbnVlLid9PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiMxNTVlNmIiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj7igrkgU1BFTkRJTkcgQ0VJTElORyDigJQgJHtTLmJ1ZGdldD8oJ+KCuScrZm10KFMuYnVkZ2V0KSk6J05PVCBTRVQnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkhlIGNhbiA8Yj5yZXF1ZXN0PC9iPiBtb25leSBmb3IgYSB2ZW50dXJlIOKAlCBhIGRvbWFpbiwgYSBsaXN0aW5nIGZlZSwgYSBzbWFsbCBhZCB0ZXN0LiBIZSBjYW4gbmV2ZXIgdGFrZSBpdC4gRXZlcnkgcmVxdWVzdCBiZWNvbWVzIGEgZnJvemVuIGdhdGUgbmVlZGluZyB5b3VyIHNpZ25hdHVyZSwgYW5kIGFueXRoaW5nIGFib3ZlIHRoaXMgY2VpbGluZyBpcyByZWZ1c2VkIG91dHJpZ2h0LjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoxNTBweCIgdHlwZT0ibnVtYmVyIiBpZD0iYnVkZ2V0QW10IiBwbGFjZWhvbGRlcj0iZS5nLiAyMDAwIiB2YWx1ZT0iJHtTLmJ1ZGdldHx8Jyd9Ij4KICAgPGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMDBweCIgdHlwZT0icGFzc3dvcmQiIGlkPSJidWRnZXRQdyIgcGxhY2Vob2xkZXI9IllvdXIgcGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2V0QnVkZ2V0KCkiPlNFVCBDRUlMSU5HPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+TGlmZXRpbWUgYXV0aG9yaXplZCBzcGVuZCBzbyBmYXI6IDxiPuKCuSR7KFMuc3BlbmR8fDApLnRvRml4ZWQoMil9PC9iPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MucnVubmluZz8nIzFjNWMzYyc6JyM2YjIyMzMnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtTLnJ1bm5pbmc/JyMwODE3MGYnOicjMTYwYjBjJ30sIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6JHtTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPuKWtiBNQVNURVIgUE9XRVIg4oCUICR7Uy5ydW5uaW5nPydTWVNURU0gUlVOTklORyc6J1NZU1RFTSBIQUxURUQnfTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij4ke1MucnVubmluZwogICA/J0V2ZXJ5IHN0YW5kaW5nIG9yZGVyIGJlbG93IGlzIGV4ZWN1dGluZyBvbiBpdHMgb3duIHNjaGVkdWxlLiBUaGUgQ2hhaXJtYW4gaXMgZG9pbmcgcmVhbCB3b3JrIHJpZ2h0IG5vdyDigJQgcHJvYmluZyB5b3VyIHNpdGVzLCBhdWRpdGluZyB0aGUgbGVkZ2VyLCBjb21wdXRpbmcgU0xBcywgd3JpdGluZyBicmllZnMg4oCUIHdpdGhvdXQgeW91IHRvdWNoaW5nIGFueXRoaW5nLicKICAgOic8Yj5Ob3RoaW5nIGlzIHJ1bm5pbmcuPC9iPiBTaWduIGJlbG93IHRvIGJyaW5nIHRoZSB3aG9sZSBzeXN0ZW0gb25saW5lLiBPbmNlIHJ1bm5pbmcgaXQgZG9lcyBub3Qgc3RvcCB1bnRpbCB5b3UgaGFsdCBpdC4nfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMzBweCIgdHlwZT0icGFzc3dvcmQiIGlkPSJwd3JQdyIgcGxhY2Vob2xkZXI9IllvdXIgcGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLnJ1bm5pbmc/J25vJzoncCd9IiBvbmNsaWNrPSJwb3dlcigpIj4ke1MucnVubmluZz8nSEFMVCBFVkVSWVRISU5HJzonU1RBUlQgRVZFUllUSElORyd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icmVzZXRUYXNrcygpIj5SZWluc3RhbGwgc3RhbmRpbmcgb3JkZXJzPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPlNjaGVkdWxlciB0aWNrcyBldmVyeSAxMHMuIE9ubHkgeW91IGNhbiBzdGFydCBvciBzdG9wIGl0IOKAlCBub3RoaW5nIGVsc2UgY2FuLjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9Im9wcyI+JHtMSVZFLm9wcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHBvd2VyKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS9wb3dlcicse29uOiFTLnJ1bm5pbmcscHc6cHdyUHcudmFsdWV9KTsgcmVuZGVyKCk7CiAgICBmbGFzaChTLnJ1bm5pbmc/J1NZU1RFTSBSVU5OSU5HIOKAlCBhZ2VudHMgZXhlY3V0aW5nJzonU3lzdGVtIGhhbHRlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2V0RXZlcnkoaWQsdil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Rhc2snLHtpZCxldmVyeTordn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhc2soaWQsb24peyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS90YXNrJyx7aWQsZW5hYmxlZDpvbn0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHJ1bk5vdyhpZCl7IGZsYXNoKCdFeGVjdXRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcnVubm93Jyx7aWR9KTsgcmVuZGVyKCk7IGZsYXNoKHIubXNnKSB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CmFzeW5jIGZ1bmN0aW9uIHJlc2V0VGFza3MoKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcmVzZXQnLHt9KTsgcmVuZGVyKCk7IGZsYXNoKCdTdGFuZGluZyBvcmRlcnMgcmVpbnN0YWxsZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUh1c3RsZSgpewogIGNvbnN0IHB3PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaHVzdGxlUHcnKXx8e30pLnZhbHVlOwogIGlmKCFwdykgcmV0dXJuIGZsYXNoKCdQYXNzd29yZCByZXF1aXJlZCDigJQgdGhpcyBjaGFuZ2VzIGhvdyBoYXJkIGhlIHdvcmtzJyk7CiAgZmxhc2goUy5odXN0bGU/J1N0YW5kaW5nIGRvd27igKYnOidFbmdhZ2luZyBodXN0bGUgbW9kZeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcnVudGltZS9odXN0bGUnLHtvbjohUy5odXN0bGUscHcsbGFuZXM6Uy5sYW5lc3x8M30pOwogICAgcmVuZGVyKCk7IGZsYXNoKFMuaHVzdGxlP2BIVVNUTEUgRU5HQUdFRCDigJQgJHtyLnRhc2tzfSBvcmRlcnMgZmlyaW5nIGluIHBhcmFsbGVsYDonU3Rvb2QgZG93biB0byBub3JtYWwgcm9zdGVyJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBzZXRMYW5lcyhuKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvbGFuZXMnLHtsYW5lczorbn0pOyByZW5kZXIoKTsgZmxhc2goJ0xhbmVzOiAnK24pIH0KYXN5bmMgZnVuY3Rpb24gc2V0QnVkZ2V0KCl7CiAgY29uc3QgcHc9KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidWRnZXRQdycpfHx7fSkudmFsdWU7CiAgaWYoIXB3KSByZXR1cm4gZmxhc2goJ1Bhc3N3b3JkIHJlcXVpcmVkJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc3BlbmQvYnVkZ2V0Jyx7YnVkZ2V0OitidWRnZXRBbXQudmFsdWV8fDAscHd9KTsgcmVuZGVyKCk7CiAgICBmbGFzaCgnQ2VpbGluZyBzZXQg4oCUIGhlIGNhbiByZXF1ZXN0IHVwIHRvIHRoaXMsIG5ldmVyIHRha2UgaXQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiAtLS0tLS0tLS0tIFNFTEYtVVBHUkFERSAtLS0tLS0tLS0tICovCkxJVkUuZXZvbHZlPSgpPT57CiAgY29uc3QgUD0oUy5wcm9wb3NhbHN8fFtdKS5maWx0ZXIocD0+cC5zdGF0dXM9PT0nUEVORElORycpOwogIGNvbnN0IEU9Uy5ldm9sdXRpb258fFtdOwogIGNvbnN0IGFwcGxpZWQ9RS5maWx0ZXIoZT0+ZS5kZWNpc2lvbj09PSdBUFBMSUVEJykubGVuZ3RoOwogIGNvbnN0IHJlamVjdGVkPUUuZmlsdGVyKGU9PmUuZGVjaXNpb249PT0nUkVKRUNURUQnKS5sZW5ndGg7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUC5sZW5ndGgsJ1VwZ3JhZGVzIEF3YWl0aW5nIFlvdScsUC5sZW5ndGg/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxQLmxlbmd0aD8nbmVlZHMgeW91ciBzaWduYXR1cmUnOidub3RoaW5nIHBlbmRpbmcnKX0KICAgJHtrcGkoYXBwbGllZCwnVXBncmFkZXMgQXBwbGllZCcsJ3ZhcigtLWdybiknLCdsaWZldGltZScpfQogICAke2twaShyZWplY3RlZCwnUmVqZWN0ZWQnLCd2YXIoLS1kaW0pJywnbmV2ZXIgcmUtcHJvcG9zZWQnKX0KICAgJHtrcGkoUy5zY2FuQ291bnR8fDAsJ1NlbGYtU2NhbnMgUnVuJywndmFyKC0tY3kpJywnZXZlcnkgNjAgc2Vjb25kcycpfTwvZGl2PgogICR7UC5sZW5ndGg/UC5tYXAocD0+YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtwLmtsYXNzPT09J1NBRkUnPycjMWM1YzNjJzonIzY3NDcwZid9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmtsYXNzPT09J1NBRkUnPyd0LWdybic6J3QtYW1iJ30iPiR7cC5rbGFzc308L3NwYW4+CiAgICAgIDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48L2Rpdj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7cC5pZH0gwrcgJHtwLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo3cHgiPiR7ZXNjKHAud2h5KX08L2Rpdj4KICAgICR7cC5ldmlkZW5jZT9gPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+RXZpZGVuY2U6ICR7ZXNjKHAuZXZpZGVuY2UpfTwvZGl2PmA6Jyd9CiAgICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXgtd2lkdGg6MzIwcHgiPjxzcGFuPlNpZ24gd2l0aCB5b3VyIHBhc3N3b3JkIHRvIGF1dGhvcml6ZTwvc3Bhbj4KICAgICA8aW5wdXQgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgaWQ9InB3XyR7cC5pZH0iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywxKSI+QVVUSE9SSVpFIFVQR1JBREU8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9ImRlY2lkZVVwKCcke3AuaWR9JywwKSI+UkVKRUNUIFBFUk1BTkVOVExZPC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJlcnIiIGlkPSJlcl8ke3AuaWR9Ij48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB1cGdyYWRlcyBwZW5kaW5nLiBUaGUgQ2hhaXJtYW4gc2NhbnMgaXRzZWxmIGV2ZXJ5IDYwIHNlY29uZHMgYW5kIHdpbGwgcmFpc2UgYSBwcm9wb3NhbCBoZXJlIHRoZSBtb21lbnQgaXQgZmluZHMgYSByZWFsIHdlYWtuZXNzIOKAlCBhIGZsYWt5IHNpdGUsIGFuIGV4cGlyaW5nIGNlcnRpZmljYXRlLCBhbiB1bnN0YWZmZWQgZmxvb3IsIGEgc2VjdXJpdHkgZ2FwLjwvZGl2PjwvZGl2PmB9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV2b2x1dGlvbiBIaXN0b3J5PC9oMz4KICAgJHtFLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5XaGVuPC90aD48dGg+Q2hhbmdlPC90aD48dGg+RGVjaXNpb248L3RoPjx0aD5SZXN1bHQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7RS5tYXAoZT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2UudH08L3RkPjx0ZD4ke2VzYyhlLmxhYmVsKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZS53aHl8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtlLmRlY2lzaW9uPT09J0FQUExJRUQnPyd0LWdybic6J3QtcmVkJ30iPiR7ZS5kZWNpc2lvbn08L3NwYW4+CiAgICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUuaG93fHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUucmVzdWx0fHwnJyl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPlRoZSBDaGFpcm1hbiBoYXMgbm90IGNoYW5nZWQgaXRzZWxmIHlldC48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIuZXZvbHZlPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4p+zIENPTlRJTlVPVVMgU0VMRi1VUEdSQURFPC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPlRoZSBDaGFpcm1hbiBhdWRpdHMgaXRzIG93biBzdGF0ZSBldmVyeSA2MCBzZWNvbmRzIGFnYWluc3QgcmVhbCB0ZWxlbWV0cnkg4oCUIHVwdGltZSByZWNvcmRzLCBUTFMgZXhwaXJ5LCBhdXRoIGZhaWx1cmVzLCBsZWRnZXIgc2l6ZSwgZmxvb3Igc3RhZmZpbmcsIG1haWwgcmVhZGluZXNzLiBXaGVuIGl0IGZpbmRzIGEgZ2VudWluZSB3ZWFrbmVzcyBpdCBwcm9wb3NlcyBhIGZpeCBoZXJlIGFuZCA8Yj5mcmVlemVzIHVudGlsIHlvdSBzaWduIGl0PC9iPi48L2Rpdj4KICA8dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPk5vdGhpbmcgc2VsZi1pbnN0YWxscyBieSBkZWZhdWx0LjwvYj4gRXZlcnkgdXBncmFkZSBuZWVkcyB5b3VyIHBhc3N3b3JkLCBzYW1lIGFzIGEgcGVybWlzc2lvbiBnYXRlLjwvbGk+CiAgIDxsaT48Yj5TQUZFPC9iPiA9IHJldmVyc2libGUgdHVuaW5nIChwcm9iZSBpbnRlcnZhbHMsIGxlZGdlciBjb21wYWN0aW9uLCBza2lsbHMpLiA8Yj5SRVZJRVc8L2I+ID0gY2hhbmdlcyB5b3VyIHJvc3RlciBvciByYWlzZXMgYSBzZWN1cml0eSBnYXRlLjwvbGk+CiAgIDxsaT5SZWplY3Qgb25jZSBhbmQgaXQgaXMgPGI+c3VwcHJlc3NlZCBwZXJtYW5lbnRseTwvYj4g4oCUIHRoZSBDaGFpcm1hbiB3aWxsIG5vdCBuYWcgeW91IGFib3V0IGl0IGFnYWluLjwvbGk+CiAgIDxsaT5JdCBwcm9wb3NlcyBvbmx5IG9uIGV2aWRlbmNlIGZyb20geW91ciBhY3R1YWwgcnVubmluZyBzeXN0ZW0uIEl0IGRvZXMgbm90IGludmVudCB3b3JrLjwvbGk+CiAgPC91bD4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2Nhbk5vdygpIj5SVU4gU0VMRi1TQ0FOIE5PVzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvcGlsb3Q/J3QtcmVkJzondC1kaW0nfSI+QVVUT1BJTE9UICR7Uy5hdXRvcGlsb3Q/J09OJzonT0ZGJ308L3NwYW4+CiAgPC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7Uy5hdXRvcGlsb3Q/JyM2YjIyMzMnOid2YXIoLS1saW5lKSd9Ij4KICA8aDM+QXV0b3BpbG90ICR7Uy5hdXRvcGlsb3Q/JzxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPkFDVElWRTwvc3Bhbj4nOicnfTwvaDM+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPldpdGggYXV0b3BpbG90IG9uLCA8Yj5TQUZFLWNsYXNzPC9iPiB1cGdyYWRlcyBhcHBseSB0aGVtc2VsdmVzIHRoZSBtb21lbnQgdGhleSBhcmUgZm91bmQg4oCUIG5vIHNpZ25hdHVyZS4gUkVWSUVXLWNsYXNzIGFsd2F5cyB3YWl0cyBmb3IgeW91IHJlZ2FyZGxlc3MuIEV2ZXJ5IGF1dG9ub21vdXMgY2hhbmdlIGlzIHN0aWxsIHdyaXR0ZW4gdG8gdGhlIGV2b2x1dGlvbiBoaXN0b3J5LiBUaGlzIGlzIHJlYWwgYXV0b25vbXk6IHR1cm4gaXQgb24gb25seSBpZiB5b3UgYWNjZXB0IHRoZSBDaGFpcm1hbiBjaGFuZ2luZyBpdHMgb3duIHR1bmluZyB3aGlsZSB5b3Ugc2xlZXAuPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIyMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9ImFwUHciIHBsYWNlaG9sZGVyPSJDb25maXJtIHBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5hdXRvcGlsb3Q/J25vJzoncCd9IiBvbmNsaWNrPSJ0b2dnbGVBdXRvKCkiPiR7Uy5hdXRvcGlsb3Q/J0RJU0FCTEUgQVVUT1BJTE9UJzonRU5BQkxFIEFVVE9QSUxPVCd9PC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iZXZvbHZlIj4ke0xJVkUuZXZvbHZlKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZGVjaWRlVXAoaWQsb2spewogIGNvbnN0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VyXycraWQpOyBlLnRleHRDb250ZW50PScnOwogIGNvbnN0IHB3PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwd18nK2lkKS52YWx1ZTsKICBpZighcHcpIHJldHVybiBlLnRleHRDb250ZW50PSdTaWduYXR1cmUgcmVxdWlyZWQuJzsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3VwZ3JhZGUvZGVjaWRlJyx7aWQsb2s6ISFvayxwd30pOwogICAgcmVuZGVyKCk7IGZsYXNoKG9rPygnVVBHUkFERUQgwrcgJysoci5yZXN1bHR8fCcnKSk6J1JlamVjdGVkIHBlcm1hbmVudGx5Jyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2Nhbk5vdygpeyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL3NjYW4nLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5wZW5kaW5nP3IucGVuZGluZysnIHVwZ3JhZGUocykgYXdhaXRpbmcgeW91ciBzaWduYXR1cmUnOidTY2FuIGNsZWFuIOKAlCBub3RoaW5nIHRvIGltcHJvdmUnKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUF1dG8oKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2F1dG9waWxvdCcse29uOiFTLmF1dG9waWxvdCxwdzphcFB3LnZhbHVlfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvcGlsb3Q/J0FVVE9QSUxPVCBPTiDigJQgc2FmZSB1cGdyYWRlcyBub3cgc2VsZi1hcHBseSc6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CgovKiAtLS0tLS0tLS0tIExFQVJORUQgU0tJTExTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNraWxsczI9KCk9PnsKICBjb25zdCBLPVMuc2tpbGxzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UZWFjaCB0aGUgQ2hhaXJtYW4gPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QRVJTSVNUUyBGT1JFVkVSPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMXB4Ij5Bbnl0aGluZyB5b3UgdGVhY2ggaXMgc3RvcmVkIHNlcnZlci1zaWRlIGFuZCBzdXJ2aXZlcyByZXN0YXJ0cywgcmVkZXBsb3lzIGFuZCBldmVyeSBkZXZpY2UgeW91IGxvZyBpbiBmcm9tLiBUZWFjaCBpdCB5b3VyIHNob3J0aGFuZCwgeW91ciBydW5ib29rcywgeW91ciBzdGFuZGluZyBvcmRlcnMuPC9kaXY+CiAgIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5UcmlnZ2VyIHBocmFzZTwvc3Bhbj48aW5wdXQgaWQ9InNrUGhyYXNlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJtb3JuaW5nIGNoZWNrIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGl0IG1lYW5zIC8gZG9lczwvc3Bhbj48aW5wdXQgaWQ9InNrQWN0aW9uIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJTY2FuIGFsbCBtb25pdG9ycyBhbmQgcmVwb3J0IGFueXRoaW5nIGJlbG93IDk5JSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VHlwZTwvc3Bhbj48c2VsZWN0IGlkPSJza0tpbmQiIGNsYXNzPSJpbiI+CiAgICAgPG9wdGlvbiB2YWx1ZT0ibm90ZSI+U3RhbmRpbmcgb3JkZXI8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJhbGlhcyI+Q29tbWFuZCBzaG9ydGN1dDwvb3B0aW9uPgogICAgIDxvcHRpb24gdmFsdWU9InJ1bmJvb2siPlJ1bmJvb2sgc3RlcDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9InBvbGljeSI+UG9saWN5IHJ1bGU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0idGVhY2goKSI+VEVBQ0ggSVQ8L2J1dHRvbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+S25vd24gU2tpbGxzIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Sy5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7Sy5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+UGhyYXNlPC90aD48dGg+TWVhbmluZzwvdGg+PHRoPlR5cGU8L3RoPjx0aD5Vc2VkPC90aD48dGg+TGVhcm5lZDwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtLLm1hcChzPT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyhzLnBocmFzZSl9PC9iPjwvdGQ+PHRkPiR7ZXNjKHMuYWN0aW9uKX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7ZXNjKHMua2luZCl9PC9zcGFuPjwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLnVzZXN8fDB9w5c8L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtzLmxlYXJuZWR9PGRpdj4ke2VzYyhzLm9yaWdpbnx8J293bmVyJyl9PC9kaXY+PC90ZD4KICAgIDx0ZCBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InVzZVNraWxsKCcke2VzYyhzLnBocmFzZSl9JykiPlJlY2FsbDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZm9yZ2V0KCcke2VzYyhzLnBocmFzZSl9JykiPkZvcmdldDwvYnV0dG9uPjwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5Ob3RoaW5nIHRhdWdodCB5ZXQuIFRyeSBwaHJhc2UgIm1vcm5pbmcgY2hlY2siIOKGkiAiU2NhbiBhbGwgbW9uaXRvcnMgYW5kIHJlcG9ydCBhbnl0aGluZyBiZWxvdyA5OSUgYXZhaWxhYmlsaXR5Ii48L2Rpdj4nfTwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiB0ZWFjaCgpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL3RlYWNoJyx7cGhyYXNlOnNrUGhyYXNlLnZhbHVlLGFjdGlvbjpza0FjdGlvbi52YWx1ZSxraW5kOnNrS2luZC52YWx1ZX0pOwogICAgcmVuZGVyKCk7IGZsYXNoKCdTa2lsbCBsZWFybmVkIOKAlCBpdCBwZXJzaXN0cyBhY3Jvc3MgcmVzdGFydHMnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGZvcmdldChwKXsgaWYoIWNvbmZpcm0oJ0ZvcmdldCAiJytwKyciPycpKXJldHVybjsgYXdhaXQgQVBJKCcvYXBpL3NraWxsL2ZvcmdldCcse3BocmFzZTpwfSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gdXNlU2tpbGwocCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3NraWxsL3VzZScse3BocmFzZTpwfSk7IHJlbmRlcigpOwogIG1vZGFsKGA8aDM+JHtlc2MocCl9PC9oMz48ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAiPjxkaXY+JHtlc2Moci5hY3Rpb24pfTwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCkgfQoKLyogLS0tLS0tLS0tLSBVUFRJTUUgTUFSU0hBTCAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHVwQmFyKG0pewogIGNvbnN0IGg9KG0uaGlzdG9yeXx8W10pLnNsaWNlKC00MCk7CiAgaWYoIWgubGVuZ3RoKSByZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0iZm9udC1zaXplOjEwcHgiPm5vIGNoZWNrcyB5ZXQ8L2Rpdj4nOwogIHJldHVybiAnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoycHg7YWxpZ24taXRlbXM6ZmxleC1lbmQ7aGVpZ2h0OjI2cHgiPicraC5tYXAoeD0+CiAgIGA8ZGl2IHRpdGxlPSIke3gudH0gwrcgSFRUUCAke3guY29kZX0gwrcgJHt4Lm1zfW1zIiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDozcHg7aGVpZ2h0OiR7eC5vaz9NYXRoLm1heCgzMCxNYXRoLm1pbigxMDAsMTAwLXgubXMvMjUpKToxMDB9JTtiYWNrZ3JvdW5kOiR7eC5vaz8nIzMxZDY3YSc6JyNmZjNiNmInfTtib3JkZXItcmFkaXVzOjFweDtvcGFjaXR5Oi45Ij48L2Rpdj5gKS5qb2luKCcnKSsnPC9kaXY+JzsKfQpMSVZFLnVwdGltZT0oKT0+ewogIGNvbnN0IE09Uy5tb25pdG9yc3x8W10sIGRvd249TS5maWx0ZXIobT0+bS5zdGF0ZT09PSdET1dOJykubGVuZ3RoOwogIGNvbnN0IHRvdD1NLnJlZHVjZSgoYSxtKT0+YSsobS5jaGVja3N8fDApLDApLCB1cHM9TS5yZWR1Y2UoKGEsbSk9PmErKG0udXB8fDApLDApOwogIGNvbnN0IGF2YWlsPXRvdD8oKHVwcy90b3QpKjEwMCkudG9GaXhlZCgyKTon4oCUJzsKICBjb25zdCBhdmc9TS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aD9NYXRoLnJvdW5kKE0ucmVkdWNlKChhLG0pPT5hKyhtLmxhc3RNc3x8MCksMCkvTS5maWx0ZXIobT0+bS5sYXN0TXMpLmxlbmd0aCk6MDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShNLmxlbmd0aCwnVGFyZ2V0cyBNb25pdG9yZWQnLCd2YXIoLS1jeSknLCdwcm9iZSBldmVyeSAxNXMnKX0KICAgJHtrcGkoZG93biwnQ3VycmVudGx5IERvd24nLGRvd24/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyxkb3duPydJTkNJREVOVCBBQ1RJVkUnOidhbGwgcmVhY2hhYmxlJyl9CiAgICR7a3BpKGF2YWlsKyhhdmFpbD09PSfigJQnPycnOiclJyksJ0F2YWlsYWJpbGl0eScsJ3ZhcigtLWdybiknLHRvdCsnIGNoZWNrcycpfQogICAke2twaShhdmcrJyBtcycsJ0F2ZyBSZXNwb25zZScsYXZnPjE1MDA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJywnbGFzdCBjeWNsZScpfTwvZGl2PgogICR7TS5sZW5ndGg/TS5tYXAobT0+ewogICAgY29uc3QgYT1tLmNoZWNrcz8oKG0udXAvbS5jaGVja3MpKjEwMCkudG9GaXhlZCgyKTonMC4wMCc7CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OXB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgJHttLnN0YXRlPT09J1VQJz8ndC1ncm4nOm0uc3RhdGU9PT0nRE9XTic/J3QtcmVkJzondC1kaW0nfSI+JHttLnN0YXRlfTwvc3Bhbj4KICAgICAgPGI+JHtlc2MobS5uYW1lKX08L2I+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtLnVybCl9PC9zcGFuPjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJkZWxNb24oJyR7bS5pZH0nKSI+VW5iaW5kPC9idXR0b24+PC9kaXY+PC9kaXY+CiAgICAke3VwQmFyKG0pfQogICAgPGRpdiBjbGFzcz0idHciIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE1MHB4Ij5MYXN0IGNoZWNrPC90ZD48dGQ+JHttLmxhc3RBdHx8J+KAlCd9IMK3IEhUVFAgJHttLmxhc3RTdGF0dXN8fCfigJQnfSR7bS5sYXN0RXJyPycgwrcgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPicrZXNjKG0ubGFzdEVycikrJzwvc3Bhbj4nOicnfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF0ZW5jeTwvdGQ+PHRkPiR7bS5sYXN0TXN8fDB9IG1zIChwOTUgJHttLnA5NXx8MH0gbXMpPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5BdmFpbGFiaWxpdHk8L3RkPjx0ZCBzdHlsZT0iY29sb3I6JHthPjk5Pyd2YXIoLS1ncm4pJzphPjk1Pyd2YXIoLS1hbWIpJzondmFyKC0tbWFnKSd9Ij4ke2F9JSDCtyAke20udXB8fDB9IHVwIC8gJHttLmRvd258fDB9IGRvd24gb2YgJHttLmNoZWNrc3x8MH08L3RkPjwvdHI+CiAgICAgJHttLnNzbD9gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRMUyBjZXJ0aWZpY2F0ZTwvdGQ+PHRkPiR7ZXNjKG0uc3NsLmlzc3Vlcil9IMK3IGV4cGlyZXMgaW4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7bS5zc2wuZGF5c19sZWZ0PDE0Pyd2YXIoLS1tYWcpJzptLnNzbC5kYXlzX2xlZnQ8NDU/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJ30iPiR7bS5zc2wuZGF5c19sZWZ0fSBkYXlzPC9zcGFuPjwvdGQ+PC90cj5gOicnfQogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5JbnRlcnZhbDwvdGQ+PHRkPiR7bS5pbnRlcnZhbH1zIMK3IGJvdW5kICR7bS5hZGRlZH08L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHRhcmdldHMgYm91bmQuIEFkZCB5b3VyIGxpdmUgc2l0ZXMgYW5kIGFwcHMgYmVsb3cg4oCUIHRoZSBVcHRpbWUgTWFyc2hhbCB3aWxsIHByb2JlIHRoZW0gZm9yIHJlYWwuPC9kaXY+PC9kaXY+J30KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SW5jaWRlbnQgSGlzdG9yeTwvaDM+JHsoUy5pbmNpZGVudHN8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgIDx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5UYXJnZXQ8L3RoPjx0aD5UcmFuc2l0aW9uPC90aD48dGg+RGV0YWlsPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke1MuaW5jaWRlbnRzLm1hcChpPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7aS50fTwvdGQ+PHRkPiR7ZXNjKGkubmFtZSl9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7aS50bz09PSdET1dOJz8ndC1yZWQnOid0LWdybid9Ij4ke2kuZnJvbX0g4oaSICR7aS50b308L3NwYW4+PC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGkuZGV0YWlsKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBzdGF0ZSB0cmFuc2l0aW9ucyByZWNvcmRlZC4gTm90aGluZyBoYXMgZmxhcHBlZC48L2Rpdj4nfTwvZGl2PmB9OwpSRU5ERVIudXB0aW1lPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QmluZCBUYXJnZXQgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5SRUFMIEhUVFAgUFJPQkVTPC9zcGFuPjwvaDM+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0ibVVybCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iaHR0cHM6Ly95b3Vyc2l0ZS5jb20iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TGFiZWwgKG9wdGlvbmFsKTwvc3Bhbj48aW5wdXQgaWQ9Im1OYW1lIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJNYWluIHNpdGUiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW50ZXJ2YWwgKHNlYywgbWluIDE1KTwvc3Bhbj48aW5wdXQgaWQ9Im1JbnQiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iNjAiPjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iYWRkTW9uKCkiPkJJTkQgJmFtcDsgUFJPQkUgTk9XPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hlY2tOb3coKSI+Rk9SQ0UgQ0hFQ0sgQUxMPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+UHJvYmVzIGZvbGxvdyB1cCB0byAzIHJlZGlyZWN0cywgcmVhZCBUTFMgZXhwaXJ5LCBhbmQgcmVjb3JkIHA5NSBsYXRlbmN5LiBPbiBhbnkgVVDihpRET1dOIHRyYW5zaXRpb24gdGhlIFVwdGltZSBNYXJzaGFsIHdyaXRlcyBhIENSSVQgaW5jaWRlbnQgYW5kIGZpcmVzIGFuIGVtYWlsIHRocm91Z2ggdGhlIE1haWwgUmVsYXkuPC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idXB0aW1lIj4ke0xJVkUudXB0aW1lKCl9PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gYWRkTW9uKCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL2FkZCcse3VybDptVXJsLnZhbHVlLnRyaW0oKSxuYW1lOm1OYW1lLnZhbHVlLnRyaW0oKSxpbnRlcnZhbDorbUludC52YWx1ZXx8NjB9KTsKIHJlbmRlcigpO2ZsYXNoKCdUYXJnZXQgYm91bmQgwrcgcHJvYmluZycpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiBkZWxNb24oaWQpe2lmKCFjb25maXJtKCdVbmJpbmQgdGhpcyB0YXJnZXQ/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9tb25pdG9yL3JlbW92ZScse2lkfSk7cmVuZGVyKCl9CmFzeW5jIGZ1bmN0aW9uIGNoZWNrTm93KCl7Zmxhc2goJ1Byb2JpbmcgYWxsIHRhcmdldHPigKYnKTthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9jaGVjaycse30pO3JlbmRlcigpO2ZsYXNoKCdQcm9iZSBjeWNsZSBjb21wbGV0ZScpfQoKLyogLS0tLS0tLS0tLSBNQUlMIFJFTEFZIC0tLS0tLS0tLS0gKi8KUkVOREVSLm1haWw9KCk9PnsKICBjb25zdCBzdD1TLnNtdHAsIG1zPVMubWFpbHN0YXR8fHtzZW50OjAsZmFpbGVkOjB9OwogIHJldHVybiBgJHshc3Q/YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gT1VUQk9VTkQgTUFJTDwvaDM+CiAgIDxkaXY+RXZlcnkgMkZBIG5vdGlmaWNhdGlvbiBhbmQgb3V0YWdlIGFsZXJ0IGlzIGJlaW5nIHJlY29yZGVkIGFzIGFuIDxiPmludGVudCBvbmx5PC9iPi4gQ29uZmlndXJlIHlvdXIgb3duIFNNVFAgcmVsYXkgYmVsb3cgdG8gbWFrZSB0aGVtIHJlYWwuIFRoZSBDaGFpcm1hbiB3aWxsIG5ldmVyIGFzayBmb3IgdGhlc2UgaW4gY2hhdCDigJQgeW91IGVudGVyIHRoZW0gaGVyZSwgYW5kIHRoZSBwYXNzd29yZCBpcyBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9kaXY+PC9kaXY+YAogIDpgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMWM1YzNjO2JhY2tncm91bmQ6IzA4MTcwZiI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5SRUxBWSBBUk1FRDwvaDM+CiAgIDxkaXY+T3V0Ym91bmQgZW1haWwgaXMgbGl2ZSB2aWEgJHtlc2Moc3QuaG9zdCl9OiR7c3QucG9ydH0uICR7bXMuc2VudH0gZGVsaXZlcmVkLCAke21zLmZhaWxlZH0gZmFpbGVkIHRoaXMgcHJvY2Vzcy48L2Rpdj48L2Rpdj5gfQogIDxkaXYgY2xhc3M9ImdyaWQgZzMiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjEzcHgiPgogICAke2twaShtcy5zZW50LCdEZWxpdmVyZWQnLCd2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKG1zLmZhaWxlZCwnRmFpbGVkJyxtcy5mYWlsZWQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywndGhpcyBwcm9jZXNzJyl9CiAgICR7a3BpKHN0PydBUk1FRCc6J09GRkxJTkUnLCdSZWxheSBTdGF0dXMnLHN0Pyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKScsc3Q/ZXNjKHN0Lmhvc3QpOidpbnRlbnQtb25seSBtb2RlJyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TTVRQIENvbmZpZ3VyYXRpb248L2gzPgogICAgPGRpdiBjbGFzcz0id2FybmJveCI+VXNlIGFuIDxiPmFwcC1zcGVjaWZpYyBwYXNzd29yZDwvYj4sIG5ldmVyIHlvdXIgbWFpbiBhY2NvdW50IHBhc3N3b3JkLiBHbWFpbDogPGNvZGU+c210cC5nbWFpbC5jb206NTg3PC9jb2RlPi4gT3V0bG9vazogPGNvZGU+c210cC1tYWlsLm91dGxvb2suY29tOjU4NzwvY29kZT4uIFpvaG86IDxjb2RlPnNtdHAuem9oby5jb206NTg3PC9jb2RlPi4gQWxsIGZyZWUgdGllcnMg4oCUIG5vIHBhaWQgc2VydmljZSByZXF1aXJlZC48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+U01UUCBIb3N0PC9zcGFuPjxpbnB1dCBpZD0ic0hvc3QiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InNtdHAuZ21haWwuY29tIiB2YWx1ZT0iJHtzdD9lc2Moc3QuaG9zdCk6Jyd9Ij48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UG9ydDwvc3Bhbj48aW5wdXQgaWQ9InNQb3J0IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7c3Q/c3QucG9ydDo1ODd9Ij48L2xhYmVsPjwvZGl2PgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Vc2VybmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNVc2VyIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QXBwIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0ic1Bhc3MiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ibmV3LXBhc3N3b3JkIj48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Gcm9tIEFkZHJlc3M8L3NwYW4+PGlucHV0IGlkPSJzRnJvbSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ieW91QGdtYWlsLmNvbSIgdmFsdWU9IiR7c3Q/ZXNjKHN0LmZyb20pOicnfSI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyb20gTmFtZTwvc3Bhbj48aW5wdXQgaWQ9InNOYW1lIiBjbGFzcz0iaW4iIHZhbHVlPSIke3N0P2VzYyhzdC5uYW1lKTonQ2hhaXJtYW4gQWdlbnQgT1MnfSI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SW1wbGljaXQgVExTIChwb3J0IDQ2NSk8L3NwYW4+PHNlbGVjdCBpZD0ic1NlYyIgY2xhc3M9ImluIj4KICAgICA8b3B0aW9uIHZhbHVlPSIwIiAke3N0JiYhc3Quc2VjdXJlPydzZWxlY3RlZCc6Jyd9Pk5vIOKAlCBTVEFSVFRMUyBvbiA1ODc8L29wdGlvbj4KICAgICA8b3B0aW9uIHZhbHVlPSIxIiAke3N0JiZzdC5zZWN1cmU/J3NlbGVjdGVkJzonJ30+WWVzIOKAlCBTTVRQUyBvbiA0NjU8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0ic2F2ZVNtdHAoKSI+QVJNIFJFTEFZPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJ0ZXN0U210cCgpIj5TRU5EIFRFU1QgRU1BSUw8L2J1dHRvbj4KICAgICAke3N0Pyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlU210cCgpIj5QdXJnZTwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZWxpdmVyeSBMb2c8L2gzPiR7KFMubWFpbHF8fFtdKS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+CiAgICA8dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+U3ViamVjdDwvdGg+PHRoPlN0YXR1czwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7Uy5tYWlscS5tYXAobT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke20udH08L3RkPjx0ZD4ke2VzYyhtLnN1YmplY3QpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj7ihpIgJHtlc2MobS50byl9PC9kaXY+PC90ZD4KICAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAkey9ERUxJVkVSRUQvLnRlc3QobS5zdGF0dXMpPyd0LWdybic6L1VOU0VOVC8udGVzdChtLnN0YXR1cyk/J3QtYW1iJzondC1yZWQnfSI+JHtlc2MobS5zdGF0dXMpfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gbWFpbCBhdHRlbXB0ZWQgeWV0LjwvZGl2Pid9CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5UYXJnZXQgaW5ib3g6IDxiPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC9iPi4gQ2hhbmdlIGl0IGluIE93bmVyIFNldHRpbmdzLjwvZGl2PjwvZGl2PgogIDwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiBzYXZlU210cCgpewogdHJ5eyBhd2FpdCBBUEkoJy9hcGkvc210cCcse2hvc3Q6c0hvc3QudmFsdWUudHJpbSgpLHBvcnQ6K3NQb3J0LnZhbHVlfHw1ODcsc2VjdXJlOnNTZWMudmFsdWU9PT0nMScsCiAgIHVzZXI6c1VzZXIudmFsdWUudHJpbSgpLHBhc3M6c1Bhc3MudmFsdWUsZnJvbTpzRnJvbS52YWx1ZS50cmltKCksbmFtZTpzTmFtZS52YWx1ZS50cmltKCl9KTsKICByZW5kZXIoKTsgZmxhc2goJ1JlbGF5IGFybWVkIOKAlCBzZW5kIGEgdGVzdCBlbWFpbCB0byBjb25maXJtJyk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gdGVzdFNtdHAoKXsgZmxhc2goJ0RpYWxpbmcgU01UUCByZWxheeKApicpOwogdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zbXRwL3Rlc3QnLHt9KTsgcmVuZGVyKCk7CiAgZmxhc2goci5vaz8nREVMSVZFUkVEIOKAlCBjaGVjayB5b3VyIGluYm94JzonRkFJTEVEOiAnKyhyLnJlYXNvbnx8J3Vua25vd24nKSk7CiB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VTbXRwKCl7IGlmKCFjb25maXJtKCdQdXJnZSByZWxheT8gTWFpbCByZXZlcnRzIHRvIGludGVudC1vbmx5LicpKXJldHVybjsKIGF3YWl0IEFQSSgnL2FwaS9zbXRwL3B1cmdlJyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnUmVsYXkgcHVyZ2VkJykgfQoKLyogLS0tLS0tLS0tLSBERVZJQ0VTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmRldmljZXM9KCk9Pntjb25zdCB0PVMudGVsZW1ldHJ5OwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBNdWx0aS1EZXZpY2UgU3luYyA8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5SRUFMPC9zcGFuPjwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlN0YXRlIGxpdmVzIG9uIHRoZSBzZXJ2ZXIsIG5vdCB0aGUgYnJvd3Nlci4gRXZlcnkgZGV2aWNlIHBvbGxzIGV2ZXJ5IDMgc2Vjb25kcyBhbmQgYWRvcHRzIHJldmlzaW9uIGNoYW5nZXMgYXV0b21hdGljYWxseS48L2xpPgogIDxsaT5DdXJyZW50IHN0YXRlIHJldmlzaW9uIDxiPiR7Uy5yZXZ9PC9iPiDCtyA8Yj4ke3QubGl2ZV9zZXNzaW9uc308L2I+IHNlc3Npb24ocykgYWN0aXZlIGluIHRoZSBsYXN0IDcwcy48L2xpPgogIDxsaT5PcGVuIHRoaXMgc2FtZSBVUkwgb24geW91ciBwaG9uZSwgbG9nIGluIHdpdGggdGhlIHNhbWUgT3duZXIgSUQsIGFuZCBib3RoIHNjcmVlbnMgdHJhY2sgZWFjaCBvdGhlci4gUmFpc2UgYSBnYXRlIG9uIG9uZSwgaXQgYXBwZWFycyBvbiB0aGUgb3RoZXIuPC9saT4KICA8bGk+PGI+U2Vzc2lvbnMgYXJlIGR1cmFibGUuPC9iPiBXcml0dGVuIHRvIDxjb2RlPnNlc3Npb25zLmpzb248L2NvZGU+IChjaG1vZCA2MDApIHdpdGggYSAzMC1kYXkgVFRMIOKAlCByZXN0YXJ0aW5nIHRoZSBzZXJ2ZXIgbm8gbG9uZ2VyIGxvZ3MgeW91IG91dC4gUmV2b2tpbmcgYmVsb3cga2lsbHMgZXZlcnkgZGV2aWNlIGV4Y2VwdCB0aGlzIG9uZS48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U2Vzc2lvbiBMb2c8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+SUQ8L3RoPjx0aD5JUDwvdGg+PHRoPlVzZXIgQWdlbnQ8L3RoPjx0aD5BdDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZGV2aWNlcy5tYXAoZD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLmlkKX08L3RkPjx0ZD4ke2VzYyhkLmlwfHwn4oCUJyl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhkLnVhKX08L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZC5hdH08L3RkPjwvdHI+YCkuam9pbignJyl8fCc8dHI+PHRkIGNvbHNwYW49IjQiIGNsYXNzPSJtb25vLWRpbSI+bm9uZTwvdGQ+PC90cj4nfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PgogPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InJldm9rZSgpIj5SRVZPS0UgQUxMIE9USEVSIFNFU1NJT05TPC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGhpcyBEZXZpY2U8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPlZpZXdwb3J0PC90ZD48dGQ+JHtpbm5lcldpZHRofSDDlyAke2lubmVySGVpZ2h0fTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGF5b3V0PC90ZD48dGQ+JHtpbm5lcldpZHRoPDg2MD8nTU9CSUxFIMK3IGNvbGxhcHNlZCBzaWRlYmFyJzonREVTS1RPUCDCtyBmaXhlZCBzaWRlYmFyJ308L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlRyYW5zcG9ydDwvdGQ+PHRkPiR7bG9jYXRpb24ucHJvdG9jb2x9IMK3IHBvbGwgM3M8L3RkPjwvdHI+CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+YH07CmFzeW5jIGZ1bmN0aW9uIHJldm9rZSgpe2NvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3Nlc3Npb25zL3Jldm9rZScse30pO3JlbmRlcigpO2ZsYXNoKHIucmV2b2tlZCsnIHNlc3Npb24ocykgcmV2b2tlZCcpfQoKLyogLS0tLS0tLS0tLSBET0NUUklORSAtLS0tLS0tLS0tICovClJFTkRFUi5kb2N0cmluZT0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvcmUgTWFuZGF0ZTwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjxiPlplcm8gc3VnYXItY29hdGluZy48L2I+IEZhaWx1cmVzLCBib3R0bGVuZWNrcyBhbmQgcmlza3MgcmVwb3J0ZWQgYXQgZnVsbCBzZXZlcml0eSwgdW5zb2Z0ZW5lZC48L2xpPgogIDxsaT48Yj5VbmNvbXByb21pc2luZyBvdmVyc2lnaHQuPC9iPiBFdmVyeSBzdWItYWdlbnQsIHRvb2wgY2FsbCwgZGVwbG95bWVudCBhbmQgdHJhbnNhY3Rpb24gcGFzc2VzIGEgZ2F0ZS48L2xpPgogIDxsaT48Yj5Pd25lciBwcmltYWN5LjwvYj4gQXV0aG9yaXR5IGZsb3dzIGZyb20gdGhlIHZlcmlmaWVkIE93bmVyIG9ubHkuIE5vIHB1YmxpYyB1c2VyLCBleHRlcm5hbCByZXF1ZXN0IG9yIHN1Yi1hZ2VudCBieXBhc3NlcyBhIGdhdGUuPC9saT4KICA8bGk+PGI+WmVybyBjb3N0LjwvYj4gVGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCByYXRoZXIgdGhhbiBmdW5kaW5nIGl0LjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5HYXRlIFNPUDwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPjEgwrcgT2JqZWN0aXZlLCBzdWNjZXNzIGNyaXRlcmlhLCBvcGVyYXRpb25hbCBib3VuZGFyaWVzLjwvbGk+CiAgPGxpPjIgwrcgSnVzdGlmeSBldmVyeSBhc3NpZ25lZCBhZ2VudCBhbmQgdG9vbC48L2xpPgogIDxsaT4zIMK3IEVudW1lcmF0ZSByb2xsYmFjaywgYXVkaXRzLCBtaXRpZ2F0aW9ucy48L2xpPgogIDxsaT40IMK3IEhhbHQgdW50aWwgT3duZXIgY3J5cHRvZ3JhcGhpYyBjbGVhcmFuY2UgaXMgc2lnbmVkIOKAlCBlbmZvcmNlZCBieSB0aGUgc2VydmVyLCBub3QgdGhlIFVJLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5UcmVhc3VyeSBTYWZlZ3VhcmRzPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICA8bGk+Q3JlZGVudGlhbHMgbmV2ZXIgcmVxdWVzdGVkIGluIGNoYXQsIG5ldmVyIHdyaXR0ZW4gdG8gYW55IGxvZy48L2xpPgogIDxsaT5Pd25lciBlbnRlcnMgcGF5b3V0IGRldGFpbHMgb25seSBpbiB0aGUgaXNvbGF0ZWQgVmF1bHQgcGFuZWw7IG9ubHkgbWFza2VkIHZhbHVlcyBhcmUgcGVyc2lzdGVkLjwvbGk+CiAgPGxpPlRyYW5zZmVycyByZXF1aXJlIHBhc3N3b3JkIHNpZ25hdHVyZTsgc2VydmVyIGhhcmQtYmxvY2tzIHdpdGggbm8gc2VhbGVkIGNoYW5uZWwuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzIj48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkhvbmVzdCBMaW1pdHMg4oCUIFJlYWQgVGhpczwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPlBlcnNpc3RlbmNlIGlzIGEgSlNPTiBmaWxlIG9uIHRoaXMgc2VydmVyLiBLaWxsIHRoZSBzYW5kYm94IGFuZCBpdCBkaWVzIHdpdGggaXQg4oCUIGV4cG9ydCB0aGUgYXVkaXQgbGVkZ2VyIGlmIGl0IG1hdHRlcnMuPC9saT4KICA8bGk+PHMgc3R5bGU9ImNvbG9yOnZhcigtLWRpbTIpIj5ObyBvdXRib3VuZCBuZXR3b3JrLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gcmVhbCBTTVRQIGNsaWVudCAobm9kZTpuZXQgKyBub2RlOnRscywgemVybyBkZXBzKS4gQXJtIGl0IGluIE1haWwgUmVsYXkgd2l0aCB5b3VyIG93biBhcHAgcGFzc3dvcmQgYW5kIDJGQSBiZWNvbWVzIGRlbGl2ZXJlZCBtYWlsLCBub3QgaW50ZW50LjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+VGVsZW1ldHJ5IGlzIG9ubHkgdGhpcyBwcm9jZXNzLjwvcz4gPGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPkZJWEVEOjwvYj4gVXB0aW1lIE1hcnNoYWwgcnVucyByZWFsIEhUVFAvSFRUUFMgcHJvYmVzIGFnYWluc3QgYW55IFVSTCB5b3UgYmluZCDigJQgc3RhdHVzLCBsYXRlbmN5LCBwOTUsIFRMUyBleHBpcnksIGluY2lkZW50IHRyYW5zaXRpb25zLjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+U2Vzc2lvbnMgYXJlIGluLW1lbW9yeS48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IGR1cmFibGUgdG8gZGlzaywgMzAtZGF5IFRUTCwgc3Vydml2ZXMgcmVzdGFydC48L2xpPgogIDxsaT48Yj5TdGlsbCB0cnVlOjwvYj4gU01UUCBjcmVkZW50aWFscyBzaXQgaW4gPGNvZGU+ZGF0YS5qc29uPC9jb2RlPiBvbiB0aGlzIGJveC4gVGhhdCBpcyBzdGFuZGFyZCBmb3IgYSBzZWxmLWhvc3RlZCByZWxheSwgYnV0IGl0IGlzIG5vdCBhIGhhcmR3YXJlIHZhdWx0IOKAlCB1c2UgYW4gYXBwLXNwZWNpZmljIHBhc3N3b3JkIHlvdSBjYW4gcmV2b2tlLCBuZXZlciB5b3VyIHByaW1hcnkgb25lLjwvbGk+CiAgPGxpPjxiPlN0aWxsIHRydWU6PC9iPiBwcm9iZXMgcnVuIGZyb20gdGhpcyBzYW5kYm94LiBJZiB0aGUgc2FuZGJveCBoYXMgbm8gcm91dGUgdG8gYSBob3N0LCB0aGF0IHJlYWRzIGFzIERPV04gZXZlbiB3aGVuIHRoZSBob3N0IGlzIGZpbmUuIFZlcmlmeSBhbiBvdXRhZ2UgYmVmb3JlIGFjdGluZyBvbiBpdC48L2xpPgogIDxsaT5aZXJvLUNvc3QgbWVhbnMgbGF3ZnVsIGZyZWUgcm91dGVzIG9ubHkg4oCUIG5ldmVyIHBpcmFjeSwgc3RvbGVuIGtleXMgb3IgVG9TIGV2YXNpb24uPC9saT48L3VsPjwvZGl2PjwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIFNFVFRJTkdTIC0tLS0tLS0tLS0gKi8KUkVOREVSLnNldHRpbmdzPSgpPT5gPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAke1Mub3duZXIuYm9vdHN0cmFwP2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iZ3JpZC1jb2x1bW46MS8tMTtib3JkZXItY29sb3I6IzZiMjIzMztiYWNrZ3JvdW5kOiMxNDA4MDkiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+4pqgIEJPT1RTVFJBUCBDUkVERU5USUFMIEFDVElWRTwvaDM+CiAgPGRpdj5UaGUgc2VydmVyLWdlbmVyYXRlZCBwYXNzd29yZCBpcyBzdGlsbCBpbiBmb3JjZSBhbmQgYSBwbGFpbnRleHQgY29weSBzaXRzIGluIDxjb2RlPk9XTkVSX0NSRURFTlRJQUxTLnR4dDwvY29kZT4uIFJvdGF0ZSBub3cg4oCUIHJvdGF0aW9uIGRlbGV0ZXMgdGhhdCBmaWxlIGF1dG9tYXRpY2FsbHkuPC9kaXY+PC9kaXY+YDonJ30KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JZGVudGl0eTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNjBweCI+T3duZXIgSUQ8L3RkPjx0ZD4ke2VzYyhTLm93bmVyLmlkKX08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBhc3N3b3JkPC90ZD48dGQ+UEJLREYyLVNIQTI1NiDCtyAxNTBrIGl0ZXJhdGlvbnMgwrcgc2VydmVyLXNpZGU8L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjJGQSBFbWFpbDwvdGQ+PHRkPiR7bWFza01haWwoUy5vd25lci5lbWFpbCl9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5Qcm92aXNpb25lZDwvdGQ+PHRkPiR7Uy5vd25lci5jcmVhdGVkfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+RG9jdHJpbmU8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtYW1iIj5aRVJPLUNPU1QgRU5GT1JDRUQ8L3NwYW4+PC90ZD48L3RyPjwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3RhdGUgUGFzc3dvcmQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VycmVudDwvc3Bhbj48aW5wdXQgaWQ9InJwT2xkIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IChtaW4gOCk8L3NwYW4+PGlucHV0IGlkPSJycE5ldyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0icm90YXRlKCkiPlJPVEFURTwvYnV0dG9uPjxkaXYgY2xhc3M9ImVyciIgaWQ9InJwRXJyIj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFuZ2UgT3duZXIgSUQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IE93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0iaWROZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvbmZpcm0gUGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJpZFB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIj48L2xhYmVsPgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2hnSWQoKSI+VVBEQVRFIElEPC9idXR0b24+PGRpdiBjbGFzcz0iZXJyIiBpZD0iaWRFcnIiPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPjJGQSBUYXJnZXQ8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV3IEVtYWlsPC9zcGFuPjxpbnB1dCBpZD0iZW1OZXciIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZ01haWwoKSI+VVBEQVRFPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um9zdGVyPC9oMz48ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5SZXN0b3JlIHRoZSAxOCBkZWZhdWx0IHN1Yi1hZ2VudHMuPC9kaXY+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXNldFJvc3RlcigpIj5SRVNFVCBST1NURVI8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5EZXN0cnVjdGl2ZTwvaDM+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db25maXJtIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0id3BQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9IndpcGUoKSI+V0lQRSBFTlRJUkUgSU5TVEFOQ0U8L2J1dHRvbj48L2Rpdj48L2Rpdj5gOwphc3luYyBmdW5jdGlvbiByb3RhdGUoKXtjb25zdCBlPXJwRXJyO2UudGV4dENvbnRlbnQ9Jyc7CiB0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL3JvdGF0ZScse29sZDpycE9sZC52YWx1ZSxuZXU6cnBOZXcudmFsdWV9KTtyZW5kZXIoKTtmbGFzaCgnUGFzc3dvcmQgcm90YXRlZCDCtyBib290c3RyYXAgZmlsZSBkZXN0cm95ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ0lkKCl7Y29uc3QgZT1pZEVycjtlLnRleHRDb250ZW50PScnOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9pZCcse25ld2lkOmlkTmV3LnZhbHVlLnRyaW0oKSxwdzppZFB3LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ093bmVyIElEIHVwZGF0ZWQnKX1jYXRjaCh4KXtlLnRleHRDb250ZW50PXgubWVzc2FnZX19CmFzeW5jIGZ1bmN0aW9uIGNoZ01haWwoKXt0cnl7YXdhaXQgQVBJKCcvYXBpL293bmVyL2VtYWlsJyx7ZW1haWw6ZW1OZXcudmFsdWUudHJpbSgpfSk7cmVuZGVyKCk7Zmxhc2goJzJGQSB0YXJnZXQgdXBkYXRlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQphc3luYyBmdW5jdGlvbiByZXNldFJvc3Rlcigpe2lmKCFjb25maXJtKCdSZXNldCByb3N0ZXI/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9yZXNldCcse30pO3JlbmRlcigpO2ZsYXNoKCdSb3N0ZXIgcmVzZXQnKX0KYXN5bmMgZnVuY3Rpb24gd2lwZSgpe2lmKCFjb25maXJtKCdJUlJFVkVSU0lCTEUuIERlc3Ryb3kgYWxsIHNlcnZlciBzdGF0ZT8nKSlyZXR1cm47CiB0cnl7YXdhaXQgQVBJKCcvYXBpL3dpcGUnLHtwdzp3cFB3LnZhbHVlfSk7bG9jYXRpb24ucmVsb2FkKCl9Y2F0Y2goZSl7Zmxhc2goZS5tZXNzYWdlKX19CgovKiAtLS0tLS0tLS0tIE1PREFMIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gbW9kYWwoaHRtbCl7Y2xvc2VNb2RhbCgpO2NvbnN0IGQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7ZC5jbGFzc05hbWU9J21vZGFsJztkLmlkPSdtZGwnOwogZC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9Im1ib3giPiR7aHRtbH08L2Rpdj5gO2Qub25jbGljaz1lPT57aWYoZS50YXJnZXQ9PT1kKWNsb3NlTW9kYWwoKX07ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkKX0KZnVuY3Rpb24gY2xvc2VNb2RhbCgpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZGwnKT8ucmVtb3ZlKCl9CmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGU9PntpZihlLmtleT09PSdFc2NhcGUnKXtjbG9zZU1vZGFsKCk7Y2xvc2VTYigpfX0pOwphZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCgpPT57aWYoY3VyPT09J2VuZ2luZScpZHJhd0VuZ2luZSgpfSk7Cg==','base64')
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

/* When a free tier throttles, stop hammering it. COOLDOWN blocks AI work
   for a while so the quota can recover instead of burning failed calls. */
let COOLDOWN_UNTIL = 0;
function coolingDown(){ return Date.now() < COOLDOWN_UNTIL; }
function coolFor(mins){
  COOLDOWN_UNTIL = Date.now() + mins*60000;
  log('WARN','AI BRAIN',`Free tier quota hit. AI work paused ${mins} min so the limit can reset. Monitoring continues.`);
}

async function think(prompt, sys, tag, agent){
  if(!S.llm||!S.llm.provider) throw new Error('No AI brain connected. Connect a free model in the AI Brain page.');
  if(coolingDown()){
    const left = Math.ceil((COOLDOWN_UNTIL-Date.now())/60000);
    throw new Error(`QUOTA COOLDOWN — ${left} min remaining. Add a backup provider in AI Brain to keep working through limits.`);
  }
  /* rotate: skip any key still cooling from its own rate limit */
  const now = Date.now();
  const pool = (S.llmBackups||[]).filter(k=>!(k.cooled>now));
  let r;
  try{
    r = await LLM.chatFailover(S.llm, pool, [
      {role:'system', content: sys||SYS_CHAIRMAN},
      {role:'user', content: prompt}
    ]);
  }catch(e){
    if(/RATE LIMIT|429|quota|exhaust|too many/i.test(e.message)){
      /* park every key in the pool for 10 min, then pause AI work */
      pool.forEach(k=>{ k.cooled = now + 10*60000; k.fail=(k.fail||0)+1; });
      save(); coolFor(15);
    }
    throw e;
  }
  if(r.usedBackup){
    const used = pool.find(k=>k.provider===r.usedProvider);
    if(used) used.ok=(used.ok||0)+1;
    log('WARN','AI BRAIN',`Primary throttled — served by backup "${r.usedProvider}". ${pool.length} key(s) still available.`);
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
    let out;
    try{ out = await runTool(tool, arg); }
    catch(e){ out = 'TOOL FAILED: '+e.message; }

    trace.push({step, action:tool+(arg?' '+arg.slice(0,60):''), result:String(out).slice(0,400)});
    scratch += `\nStep ${step}: ran ${tool} ${arg}\nResult: ${String(out).slice(0,1400)}\n`;
    log('OK','AGENT LOOP',`step ${step}: ${tool} → ${String(out).slice(0,90)}`);
  }

  return { answer:`Stopped after ${cap} steps without finishing. Progress is in the trace below.`,
           trace, steps:cap, hitCap:true };
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
  ['ai.brief',       1800, 'Insight Forge']
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
    llmBackups:(S.llmBackups||[]).map(b=>({provider:b.provider,model:b.model,key:mask(b.key),
      ok:b.ok||0,fail:b.fail||0,cooled:(b.cooled||0)>Date.now()})),
    agentRuns:(S.agentRuns||[]).slice(0,12),
    cooldown: coolingDown() ? Math.ceil((COOLDOWN_UNTIL-Date.now())/1000) : 0,
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
    if(!P.nokey && !(b.key||'').trim())
      return send(res,400,{error:'API key required for '+P.label+'. '+P.signup});
    S.llmBackups = S.llmBackups || [];
    if(S.llmBackups.length >= 40) return send(res,400,{error:'MAXIMUM 40 KEYS'});
    S.llmBackups.push({ provider:b.provider, key:(b.key||'').trim(),
      model:(b.model||'').trim()||P.model, t:nowIso(), ok:0, fail:0, cooled:0 });
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

