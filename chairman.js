#!/usr/bin/env node
/* ==========================================================================
   CHAIRMAN AGENT OS  —  SINGLE FILE  ·  Numero cream treasury theme

   RUN IT:   node chairman.js     then open http://localhost:8080

   LOOK: warm cream paper #EFEADF with off-white panels #FBF8F1, olive-lime
   #788A1D accents, sand hairline borders and warm-brown shadows. No cold
   white anywhere. Dark olive mode via the moon button, top right.

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
  'index.html': Buffer.from('PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA1MDcwYSI+Cjx0aXRsZT5DSEFJUk1BTiBBR0VOVCBPUyDCtyBMaXZlPC90aXRsZT4KPHN0eWxlPgovKiDilZDilZAgQ0hBSVJNQU4gT1MgwrcgTlVNRVJPIOKAlCB0cmVhc3VyeSBsaWdodCB0aGVtZSDilZDilZAgKi8KOnJvb3R7CiAgLyogbGlnaHQgaXMgdGhlIGRlZmF1bHQgbm93ICovCiAgLS1iZzojRUZFQURGOyAtLWJnMjojRTVERkQxOwogIC0tcGFuZWw6I0ZCRjhGMTsKICAtLWdsYXNzOiNGQkY4RjE7CiAgLS1nbGFzczI6I0Y1RjFFNzsKICAtLXN0cm9rZTojREVEN0M3OwogIC0tc3Ryb2tlMjojQzdCRkFCOwogIC0tdHh0OiMxODE1MDk7IC0tZGltOiM2RTY4NTc7IC0tZGltMjojOUM5Njg2OwoKICAtLWxpbWU6Izc4OEExRDsgICAgICAvKiBzaWduYXR1cmUgb2xpdmUtbGltZSAqLwogIC0tbGltZTI6IzhGQTMyNjsKICAtLW9saXZlOiMzOTQ2MDM7ICAgICAvKiBkZWVwIG9saXZlICovCiAgLS1pbms6IzA0MDUwMTsKCiAgLS1jeTojNzg4QTFEOyAtLWJsdTojNUM2RTFBOyAtLWdybjojNEY3QTJBOyAtLWFtYjojQTg4MDFCOwogIC0tbWFnOiNCNDQ0MkE7IC0tcHVyOiM2RTdBM0M7CgogIC0tbW9ubzp1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sIlJvYm90byBNb25vIixtb25vc3BhY2U7CiAgLS1zYW5zOi1hcHBsZS1zeXN0ZW0sQmxpbmtNYWNTeXN0ZW1Gb250LCJTZWdvZSBVSSIsSW50ZXIsUm9ib3RvLHNhbnMtc2VyaWY7CiAgLS1zYnc6MjM4cHg7IC0tcjoxNHB4OwogIC0tc2hhZG93OjAgMXB4IDJweCByZ2JhKDYwLDQ4LDIwLC4wNiksIDAgOHB4IDI0cHggcmdiYSg2MCw0OCwyMCwuMDYpOwogIC0tc2hhZG93MjowIDJweCA2cHggcmdiYSg2MCw0OCwyMCwuMDgpLCAwIDE2cHggNDBweCByZ2JhKDYwLDQ4LDIwLC4xMCk7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXXsKICAtLWJnOiMwQTBCMDY7IC0tYmcyOiMxMDEyMDg7CiAgLS1wYW5lbDojMTUxODBDOyAtLWdsYXNzOiMxNTE4MEM7IC0tZ2xhc3MyOiMxQjFGMEY7CiAgLS1zdHJva2U6IzI1MkExNjsgLS1zdHJva2UyOiMzNzQwMUY7CiAgLS10eHQ6I0YyRjNFQTsgLS1kaW06IzlBOUM4QTsgLS1kaW0yOiM2QTZENUM7CiAgLS1saW1lOiNBM0JCMkI7IC0tbGltZTI6I0I4RDEzNDsKICAtLWN5OiNBM0JCMkI7IC0tYmx1OiM4RkEzMjY7IC0tZ3JuOiM2RkJGNEE7IC0tYW1iOiNEOUE2MkI7CiAgLS1tYWc6I0UzNkI0RTsgLS1wdXI6IzlGQUU1RTsKICAtLXNoYWRvdzowIDFweCAycHggcmdiYSgwLDAsMCwuNCksIDAgOHB4IDI2cHggcmdiYSgwLDAsMCwuMzUpOwogIC0tc2hhZG93MjowIDJweCA4cHggcmdiYSgwLDAsMCwuNSksIDAgMThweCA0NnB4IHJnYmEoMCwwLDAsLjQ1KTsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnR9Cmh0bWwsYm9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMCV9CmJvZHl7CiAgYmFja2dyb3VuZDp2YXIoLS1iZyk7IGNvbG9yOnZhcigtLXR4dCk7CiAgZm9udDoxMy41cHgvMS41NSB2YXIoLS1zYW5zKTsgb3ZlcmZsb3cteDpoaWRkZW47CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMTAwcHggNzAwcHggYXQgODglIC0xNCUsIHJnYmEoMTIwLDEzOCwyOSwuMTMpLCB0cmFuc3BhcmVudCA2MCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDc2MHB4IDUyMHB4IGF0IDQlIDEwNCUsIHJnYmEoMTQwLDExMCw1MCwuMDkpLCB0cmFuc3BhcmVudCA2MiUpOwogIGJhY2tncm91bmQtYXR0YWNobWVudDpmaXhlZDsKfQpidXR0b257Zm9udDppbmhlcml0O2N1cnNvcjpwb2ludGVyO2NvbG9yOmluaGVyaXR9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtmb250OmluaGVyaXR9Ci5oaWRle2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6MTBweDtoZWlnaHQ6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOnZhcigtLXN0cm9rZTIpO2JvcmRlci1yYWRpdXM6MTBweH0KOjotd2Via2l0LXNjcm9sbGJhci10cmFja3tiYWNrZ3JvdW5kOnRyYW5zcGFyZW50fQoKLyog4pSA4pSAIExPR0lOIC8gSEVSTyDilIDilIAgKi8KI2dhdGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjgwO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1iZyk7CiAgYmFja2dyb3VuZC1pbWFnZToKICAgIHJhZGlhbC1ncmFkaWVudCgxMDAwcHggNjgwcHggYXQgODQlIC0xMCUsIHJnYmEoMTIwLDEzOCwyOSwuMTYpLCB0cmFuc3BhcmVudCA1OCUpLAogICAgcmFkaWFsLWdyYWRpZW50KDcyMHB4IDUyMHB4IGF0IDYlIDEwMCUsIHJnYmEoMTQwLDExMCw1MCwuMTApLCB0cmFuc3BhcmVudCA2MCUpO30KLnRvcGJhcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMXB4O3BhZGRpbmc6MTVweCAyNHB4O2ZsZXgtd3JhcDp3cmFwOwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9Ci5sb2dve2ZvbnQ6NzAwIDE4cHgvMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotLjVweH0KLmxvZ28gaXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGx7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Ym9yZGVyLXJhZGl1czo5OXB4OwogIHBhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzouN3B4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGlsbC5saXZle2JvcmRlci1jb2xvcjpyZ2JhKDEyMCwxMzgsMjksLjM2KTtiYWNrZ3JvdW5kOnJnYmEoMTIwLDEzOCwyOSwuMTApO2NvbG9yOnZhcigtLW9saXZlKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAucGlsbC5saXZle2NvbG9yOnZhcigtLWxpbWUpfQouZG90e2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tbGltZSk7CiAgbWFyZ2luLXJpZ2h0OjZweDtib3gtc2hhZG93OjAgMCAwIDNweCByZ2JhKDEyMCwxMzgsMjksLjE4KTthbmltYXRpb246YnAgMnMgaW5maW5pdGV9CkBrZXlmcmFtZXMgYnB7NTAle29wYWNpdHk6LjM1fX0KLmhlcm97bWF4LXdpZHRoOjEyMjBweDttYXJnaW46MCBhdXRvO3BhZGRpbmc6MzRweCAyNHB4IDY4cHh9Ci5oZXJvQ2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoyNHB4OwogIGJveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7cGFkZGluZzpjbGFtcCgyNnB4LDR2dyw1MHB4KTsKICBkaXNwbGF5OmdyaWQ7Z2FwOjM4cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMDVmciAuOTVmcjthbGlnbi1pdGVtczpjZW50ZXJ9CkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpey5oZXJvQ2FyZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDEyMCwxMzgsMjksLjMwKTsKICBjb2xvcjp2YXIoLS1vbGl2ZSk7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjk5cHg7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MS41cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdle2NvbG9yOnZhcigtLWxpbWUpfQpoMS5iaWd7Zm9udDo3MDAgY2xhbXAoMzJweCw1LjZ2dyw1NnB4KS8xLjAyIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0ycHg7bWFyZ2luOjE4cHggMCAxNnB4fQpoMS5iaWcgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tbGltZSl9Ci5sZWRle2NvbG9yOnZhcigtLWRpbSk7Zm9udDoxNXB4LzEuNyB2YXIoLS1zYW5zKTttYXgtd2lkdGg6NTJjaDttYXJnaW46MCAwIDI2cHh9Ci5zdGF0Um93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgxNDRweCwxZnIpKTtnYXA6MTJweH0KLnN0YXR7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxNXB4IDE3cHg7dHJhbnNpdGlvbjouMnN9Ci5zdGF0OmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1saW1lKTtib3gtc2hhZG93OnZhcigtLXNoYWRvdyl9Ci5zdGF0IHV7ZGlzcGxheTpibG9jazt0ZXh0LWRlY29yYXRpb246bm9uZTtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS4zcHg7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouc3RhdCBie2Rpc3BsYXk6YmxvY2s7Zm9udDo3MDAgMjRweC8xLjE1IHZhcigtLXNhbnMpO21hcmdpbjo3cHggMCAzcHg7bGV0dGVyLXNwYWNpbmc6LTFweH0KLnN0YXQgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubG9naW5Cb3h7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ2luQm94IGgze21hcmdpbjowIDAgNHB4O2ZvbnQtc2l6ZToxMi41cHg7bGV0dGVyLXNwYWNpbmc6MnB4O2NvbG9yOnZhcigtLW9saXZlKTtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubG9naW5Cb3ggaDN7Y29sb3I6dmFyKC0tbGltZSl9Ci5sb2dpbkJveCAuc2J7Y29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTAuNXB4O21hcmdpbi1ib3R0b206MThweDtsZXR0ZXItc3BhY2luZzouNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZXJye2NvbG9yOnZhcigtLW1hZyk7Zm9udC1zaXplOjExLjVweDttaW4taGVpZ2h0OjE2cHg7bWFyZ2luLXRvcDo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci53YXJuYm94e2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1hbWIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4wOCk7cGFkZGluZzoxMXB4IDE0cHg7CiAgYm9yZGVyLXJhZGl1czowIDEycHggMTJweCAwO2ZvbnQtc2l6ZToxMS41cHg7Y29sb3I6IzZCNTQxMDttYXJnaW4tYm90dG9tOjE1cHg7bGluZS1oZWlnaHQ6MS42fQpbZGF0YS10aGVtZT0iZGFyayJdIC53YXJuYm94e2NvbG9yOiNFMEMyNzF9Ci5waWxsYXJze21heC13aWR0aDoxMjIwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjAgMjRweCA4MHB4fQoucGlsbGFycyBoMnt0ZXh0LWFsaWduOmNlbnRlcjtmb250OjcwMCBjbGFtcCgyM3B4LDMuNHZ3LDM0cHgpLzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS4xcHg7bWFyZ2luOjAgMCAxMHB4fQoucGlsbGFycyBoMiBlbXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1saW1lKX0KLnBpbGxhcnMgLnN1Ynt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQ6MTMuNXB4LzEuNiB2YXIoLS1zYW5zKTttYXJnaW46MCAwIDMwcHh9Ci5wZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE2cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjE0cHgsMWZyKSl9Ci5wY2FyZHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MjBweDt0cmFuc2l0aW9uOi4yMnN9Ci5wY2FyZDpob3Zlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNHB4KTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLnBjYXJkIHV7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC1zaXplOjkuNXB4O2xldHRlci1zcGFjaW5nOjEuNnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoucGNhcmQgaDR7bWFyZ2luOjEwcHggMDtmb250OjcwMCAxNS41cHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi0uM3B4fQoucGNhcmQgcHttYXJnaW46MCAwIDEzcHg7Y29sb3I6dmFyKC0tZGltKTtmb250OjEycHgvMS42NSB2YXIoLS1zYW5zKX0KLmNoaXB7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtjb2xvcjp2YXIoLS1kaW0pOwogIGJvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEwcHg7bWFyZ2luOjAgNXB4IDVweCAwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoKLyog4pSA4pSAIFNIRUxMIOKUgOKUgCAqLwojYXBwe2Rpc3BsYXk6ZmxleDttaW4taGVpZ2h0OjEwMHZofQphc2lkZXt3aWR0aDp2YXIoLS1zYncpO2ZsZXg6MCAwIHZhcigtLXNidyk7cG9zaXRpb246c3RpY2t5O3RvcDowO2hlaWdodDoxMDB2aDt6LWluZGV4OjQwOwogIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCB2YXIoLS1zdHJva2UpfQouYWJyYW5ke3BhZGRpbmc6MThweCAxNnB4IDE2cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtkaXNwbGF5OmZsZXg7Z2FwOjExcHg7YWxpZ24taXRlbXM6Y2VudGVyfQoubWFya3t3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6MTBweDtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxNXB4OwogIGJhY2tncm91bmQ6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtib3gtc2hhZG93OjAgNHB4IDEycHggcmdiYSgxMjAsMTM4LDI5LC4zMCl9Ci5hYnJhbmQgYntmb250OjcwMCAxM3B4LzEuMjUgdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6LjJweDtkaXNwbGF5OmJsb2NrfQouYWJyYW5kIHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjguNXB4O2xldHRlci1zcGFjaW5nOjEuMnB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQphc2lkZSBuYXZ7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjEycHggMTJweCAxOHB4fQouZ3Jwe2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZTo4LjVweDtsZXR0ZXItc3BhY2luZzoxLjhweDtwYWRkaW5nOjE2cHggMTBweCA3cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CmFzaWRlIG5hdiBidXR0b257ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBjb2xvcjp2YXIoLS1kaW0pO3BhZGRpbmc6OXB4IDEycHg7Ym9yZGVyLXJhZGl1czoxMHB4O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTIuNXB4OwogIHRyYW5zaXRpb246LjE1czttYXJnaW4tYm90dG9tOjJweH0KYXNpZGUgbmF2IGJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWdsYXNzMik7Y29sb3I6dmFyKC0tdHh0KX0KYXNpZGUgbmF2IGJ1dHRvbi5vbntiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NjAwOwogIGJveC1zaGFkb3c6MCAzcHggMTBweCByZ2JhKDEyMCwxMzgsMjksLjI4KX0KYXNpZGUgbmF2IGJ1dHRvbiBpe2ZvbnQtc3R5bGU6bm9ybWFsO3dpZHRoOjE2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHh9Ci5hZm9vdHtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6MTRweCAxNnB4O2ZvbnQtc2l6ZToxMC41cHg7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Cm1haW57ZmxleDoxO21pbi13aWR0aDowO3BhZGRpbmc6MjJweCBjbGFtcCgxNnB4LDIuNnZ3LDMycHgpIDk2cHh9Ci5tdG9we2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjExcHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbToyMnB4fQouY3J1bWJ7Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjExLjVweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmNydW1iIGJ7Y29sb3I6dmFyKC0tbGltZSk7Zm9udC13ZWlnaHQ6NjAwfQoubXRvcCAuc3B7ZmxleDoxfQojYnVyZ2Vye2Rpc3BsYXk6bm9uZX0KI3RoZW1lQnRue2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyLXJhZGl1czo5OXB4O3BhZGRpbmc6NnB4IDEzcHg7Zm9udC1zaXplOjExcHh9CiN0aGVtZUJ0bjpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6dmFyKC0tbGltZSl9CkBtZWRpYShtYXgtd2lkdGg6ODYwcHgpewogIGFzaWRle3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtMTAwJSk7dHJhbnNpdGlvbjouMjRzO2JveC1zaGFkb3c6MCAwIDYwcHggcmdiYSg2MCw0OCwyMCwuMjgpfQogIGFzaWRlLm9wZW57dHJhbnNmb3JtOm5vbmV9CiAgI3Njcmlte3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDQ1LDM4LDE4LC4zNCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KTt6LWluZGV4OjM1fQogICNidXJnZXJ7ZGlzcGxheTppbmxpbmUtZmxleH0KICBtYWlue3BhZGRpbmctYm90dG9tOjExMHB4fQp9CgovKiDilIDilIAgUFJJTUlUSVZFUyDilIDilIAgKi8KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcGFkZGluZzoxOHB4IDIwcHg7bWFyZ2luLWJvdHRvbToxNnB4O2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KTt0cmFuc2l0aW9uOi4yc30KLmNhcmQ6aG92ZXJ7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cyKX0KLmNhcmQ+aDN7bWFyZ2luOjAgMCAxNHB4O2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6MS43cHg7Y29sb3I6dmFyKC0tZGltKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OXB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouZ3JpZHtkaXNwbGF5OmdyaWQ7Z2FwOjE0cHh9Ci5nMntncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZml0LG1pbm1heCgyOTJweCwxZnIpKX0KLmcze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KDIwOHB4LDFmcikpfQouZzR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTYycHgsMWZyKSl9Ci5rcGl7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjE3cHggMThweDsKICB0cmFuc2l0aW9uOi4ycztwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Ci5rcGk6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3RvcDowO2JvdHRvbTowO3dpZHRoOjNweDtiYWNrZ3JvdW5kOnZhcigtLWxpbWUpO29wYWNpdHk6Ljg1fQoua3BpOmhvdmVye3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0ycHgpO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93Mik7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpfQoua3BpIGJ7ZGlzcGxheTpibG9jaztmb250OjcwMCAyN3B4LzEuMSB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzotMS40cHh9Ci5rcGkgdXtkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjNweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbTo2cHg7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5rcGkgc3tkaXNwbGF5OmJsb2NrO3RleHQtZGVjb3JhdGlvbjpub25lO2NvbG9yOnZhcigtLWRpbTIpO2ZvbnQtc2l6ZToxMHB4O21hcmdpbi10b3A6NXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQouYnRue2JhY2tncm91bmQ6dmFyKC0tcGFuZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlMik7cGFkZGluZzo5cHggMTVweDtib3JkZXItcmFkaXVzOjEwcHg7CiAgZm9udC1zaXplOjExLjVweDt0cmFuc2l0aW9uOi4xNnM7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5idG46aG92ZXJ7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUpO2NvbG9yOnZhcigtLWxpbWUpfQouYnRuLnB7YmFja2dyb3VuZDp2YXIoLS1saW1lKTtib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo3MDA7CiAgYm94LXNoYWRvdzowIDNweCAxMHB4IHJnYmEoMTIwLDEzOCwyOSwuMjYpfQouYnRuLnA6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1saW1lMik7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbWUyKTtjb2xvcjojZmZmO2JveC1zaGFkb3c6MCA1cHggMTZweCByZ2JhKDEyMCwxMzgsMjksLjM0KX0KLmJ0bi5va3tiYWNrZ3JvdW5kOnJnYmEoNzksMTIyLDQyLC4xMCk7Ym9yZGVyLWNvbG9yOnJnYmEoNzksMTIyLDQyLC4zNCk7Y29sb3I6dmFyKC0tZ3JuKX0KLmJ0bi5ub3tiYWNrZ3JvdW5kOnJnYmEoMTgwLDY4LDQyLC4wOSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTgwLDY4LDQyLC4zMCk7Y29sb3I6dmFyKC0tbWFnKX0KLmJ0bi5zbXtwYWRkaW5nOjZweCAxMXB4O2ZvbnQtc2l6ZToxMC41cHg7Ym9yZGVyLXJhZGl1czo4cHh9Ci5idG46ZGlzYWJsZWR7b3BhY2l0eTouNDtjdXJzb3I6bm90LWFsbG93ZWQ7dHJhbnNmb3JtOm5vbmV9Ci5yb3d7ZGlzcGxheTpmbGV4O2dhcDo5cHg7ZmxleC13cmFwOndyYXA7YWxpZ24taXRlbXM6Y2VudGVyfQpsYWJlbC5me2Rpc3BsYXk6YmxvY2s7bWFyZ2luLWJvdHRvbToxM3B4fQpsYWJlbC5mPnNwYW57ZGlzcGxheTpibG9jaztmb250LXNpemU6OS41cHg7bGV0dGVyLXNwYWNpbmc6MS4ycHg7Y29sb3I6dmFyKC0tZGltKTttYXJnaW4tYm90dG9tOjZweDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9Ci5pbnt3aWR0aDoxMDAlO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO2NvbG9yOnZhcigtLXR4dCk7CiAgcGFkZGluZzoxMHB4IDEzcHg7Ym9yZGVyLXJhZGl1czoxMHB4O291dGxpbmU6bm9uZTt0cmFuc2l0aW9uOi4xNnN9Ci5pbjpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tbGltZSk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxMjAsMTM4LDI5LC4xNCk7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCl9CnRleHRhcmVhLmlue21pbi1oZWlnaHQ6NzRweDtyZXNpemU6dmVydGljYWw7Zm9udC1mYW1pbHk6dmFyKC0tc2Fucyl9CnRhYmxle3dpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4fQp0aHt0ZXh0LWFsaWduOmxlZnQ7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjlweDtsZXR0ZXItc3BhY2luZzoxLjJweDtwYWRkaW5nOjEwcHggOXB4OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLXN0cm9rZTIpO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyl9CnRke3BhZGRpbmc6MTFweCA5cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tc3Ryb2tlKTt2ZXJ0aWNhbC1hbGlnbjp0b3B9CnRyOmhvdmVyIHRke2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLnR3e292ZXJmbG93LXg6YXV0bztib3JkZXItcmFkaXVzOjEwcHh9Ci50YWd7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzozcHggMTBweDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOjFweDsKICBib3JkZXI6MXB4IHNvbGlkO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt3aGl0ZS1zcGFjZTpub3dyYXA7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC13ZWlnaHQ6NjAwfQoudC1jeXtjb2xvcjp2YXIoLS1vbGl2ZSk7Ym9yZGVyLWNvbG9yOnJnYmEoMTIwLDEzOCwyOSwuMzQpO2JhY2tncm91bmQ6cmdiYSgxMjAsMTM4LDI5LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtY3l7Y29sb3I6dmFyKC0tbGltZSl9Ci50LWdybntjb2xvcjojM0U2NTIyO2JvcmRlci1jb2xvcjpyZ2JhKDc5LDEyMiw0MiwuMzIpO2JhY2tncm91bmQ6cmdiYSg3OSwxMjIsNDIsLjExKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1ncm57Y29sb3I6IzdGRDA1QX0KLnQtYW1ie2NvbG9yOiM4QTY3MTI7Ym9yZGVyLWNvbG9yOnJnYmEoMTY4LDEyOCwyNywuMzIpO2JhY2tncm91bmQ6cmdiYSgxNjgsMTI4LDI3LC4xMSl9CltkYXRhLXRoZW1lPSJkYXJrIl0gLnQtYW1ie2NvbG9yOiNFMEI1NEF9Ci50LXJlZHtjb2xvcjojOUIzQTIzO2JvcmRlci1jb2xvcjpyZ2JhKDE4MCw2OCw0MiwuMzApO2JhY2tncm91bmQ6cmdiYSgxODAsNjgsNDIsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1yZWR7Y29sb3I6I0YwODY2Qn0KLnQtYmx1e2NvbG9yOiM0QTVBMTU7Ym9yZGVyLWNvbG9yOnJnYmEoOTIsMTEwLDI2LC4zMCk7YmFja2dyb3VuZDpyZ2JhKDkyLDExMCwyNiwuMTApfQpbZGF0YS10aGVtZT0iZGFyayJdIC50LWJsdXtjb2xvcjojQThCRTQ1fQoudC1wdXJ7Y29sb3I6IzU2NUYyRTtib3JkZXItY29sb3I6cmdiYSgxMTAsMTIyLDYwLC4zMCk7YmFja2dyb3VuZDpyZ2JhKDExMCwxMjIsNjAsLjEwKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudC1wdXJ7Y29sb3I6I0I0QzE3Nn0KLnQtZGlte2NvbG9yOnZhcigtLWRpbSk7Ym9yZGVyLWNvbG9yOnZhcigtLXN0cm9rZTIpO2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKX0KLmJhcntoZWlnaHQ6N3B4O2JhY2tncm91bmQ6dmFyKC0tYmcyKTtib3JkZXItcmFkaXVzOjk5cHg7b3ZlcmZsb3c6aGlkZGVufQouYmFyIGl7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTAwJTtib3JkZXItcmFkaXVzOjk5cHg7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tb2xpdmUpLHZhcigtLWxpbWUpKTt0cmFuc2l0aW9uOndpZHRoIC41cyBjdWJpYy1iZXppZXIoLjQsMCwuMiwxKX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFyIGl7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tbGltZSksdmFyKC0tbGltZTIpKX0KdWwudGlnaHR7bWFyZ2luOjdweCAwIDA7cGFkZGluZy1sZWZ0OjE4cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKX0KdWwudGlnaHQgbGl7bWFyZ2luOjVweCAwfQp1bC50aWdodCBie2NvbG9yOnZhcigtLXR4dCl9CnByZS55YW1se2JhY2tncm91bmQ6dmFyKC0tZ2xhc3MyKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLXN0cm9rZSk7Ym9yZGVyLXJhZGl1czoxMXB4O3BhZGRpbmc6MTRweDsKICBmb250LXNpemU6MTFweDtvdmVyZmxvdzphdXRvO2NvbG9yOiMzRTRBMTg7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MS42O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQpbZGF0YS10aGVtZT0iZGFyayJdIHByZS55YW1se2NvbG9yOiNCNEMxNzZ9Ci5sb2d7YmFja2dyb3VuZDp2YXIoLS1nbGFzczIpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tc3Ryb2tlKTtib3JkZXItcmFkaXVzOjExcHg7cGFkZGluZzoxM3B4OwogIG1heC1oZWlnaHQ6MzcwcHg7b3ZlcmZsb3c6YXV0bztmb250LXNpemU6MTFweDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxvZyBkaXZ7cGFkZGluZzozcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3doaXRlLXNwYWNlOnByZS13cmFwO3dvcmQtYnJlYWs6YnJlYWstd29yZH0KLmxvZyAudHN7Y29sb3I6dmFyKC0tZGltMil9Ci5tb25vLWRpbXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pfQoubW9kYWx7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoNDUsMzgsMTgsLjQyKTt6LWluZGV4OjkwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjE4cHg7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNXB4KX0KLm1ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6NjYwcHg7bWF4LWhlaWdodDo4OHZoO292ZXJmbG93OmF1dG87YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UyKTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzoyNnB4O2JveC1zaGFkb3c6MCAyNHB4IDcwcHggcmdiYSg2MCw0OCwyMCwuMjQpfQoubWJveCBoM3ttYXJnaW46MCAwIDZweDtmb250LXNpemU6MTVweDtjb2xvcjp2YXIoLS1vbGl2ZSk7bGV0dGVyLXNwYWNpbmc6LS4ycHg7dGV4dC10cmFuc2Zvcm06bm9uZX0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubWJveCBoM3tjb2xvcjp2YXIoLS1saW1lKX0KLmZsYXNoe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JvdHRvbToyNnB4O2JhY2tncm91bmQ6dmFyKC0taW5rKTsKICBjb2xvcjojRjRGNEYwO2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1saW1lKTtwYWRkaW5nOjEzcHggMjFweDtib3JkZXItcmFkaXVzOjEycHg7Zm9udC1zaXplOjEycHg7CiAgei1pbmRleDo5OTttYXgtd2lkdGg6OTB2dztib3gtc2hhZG93OjAgMTRweCA0NHB4IHJnYmEoNjAsNDgsMjAsLjMwKTthbmltYXRpb246ZnUgLjI4c30KQGtleWZyYW1lcyBmdXtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlKC01MCUsMTJweCl9fQoKLyog4pSA4pSAIFJBRElBTCBFTkdJTkUg4pSA4pSAICovCi5lbmdpbmVXcmFwe2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDI1OHB4O2dhcDoxNHB4fQpAbWVkaWEobWF4LXdpZHRoOjEwMDBweCl7LmVuZ2luZVdyYXB7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn19Ci5jYW52YXNCb3h7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6dmFyKC0tcik7CiAgcG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO21pbi1oZWlnaHQ6NDQwcHg7Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpfQouY2FudmFzQm94IHN2Z3tkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG87dG91Y2gtYWN0aW9uOnBhbi15fQouZ3JpZGJne3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTtvcGFjaXR5Oi41NTsKICBiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh2YXIoLS1zdHJva2UpIDFweCx0cmFuc3BhcmVudCAxcHgpLAogICAgICAgICAgICAgICAgICAgbGluZWFyLWdyYWRpZW50KDkwZGVnLHZhcigtLXN0cm9rZSkgMXB4LHRyYW5zcGFyZW50IDFweCk7CiAgYmFja2dyb3VuZC1zaXplOjM0cHggMzRweDsKICBtYXNrLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgNTAlIDUwJSwjMDAwIDQwJSx0cmFuc3BhcmVudCA3NiUpOwogIC13ZWJraXQtbWFzay1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSA1MCUsIzAwMCA0MCUsdHJhbnNwYXJlbnQgNzYlKX0KLmVuZ1RvcHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjE0cHg7dG9wOjEzcHg7ei1pbmRleDoyO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwfQouZW5nVGl0bGV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7dG9wOjE0cHg7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoyOwogIGZvbnQ6NzAwIDEzcHggdmFyKC0tc2Fucyk7bGV0dGVyLXNwYWNpbmc6Mi42cHg7Y29sb3I6dmFyKC0tdHh0KX0KLm5vZGV7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMThzfQoubm9kZTpob3ZlciBjaXJjbGV7ZmlsdGVyOmJyaWdodG5lc3MoMS4xNSl9Ci5zaWRle2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE0cHh9Ci5sZWdlbmQgZGl2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7cGFkZGluZzo0cHggMDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmxlZ2VuZCBpe3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7ZGlzcGxheTpibG9jaztmbGV4OjAgMCAxMHB4fQouZGlyTGlzdHttYXgtaGVpZ2h0OjI2NnB4O292ZXJmbG93OmF1dG99Ci5kaXJMaXN0IGJ1dHRvbntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6bm9uZTtib3JkZXI6MDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO3BhZGRpbmc6OHB4IDRweDtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLWRpbSk7CiAgdGV4dC1hbGlnbjpsZWZ0O3RyYW5zaXRpb246LjE0cztmb250LWZhbWlseTp2YXIoLS1tb25vKX0KLmRpckxpc3QgYnV0dG9uOmhvdmVye2NvbG9yOnZhcigtLWxpbWUpO3BhZGRpbmctbGVmdDo3cHh9Ci5kaXJMaXN0IHNwYW57Y29sb3I6dmFyKC0tZGltMik7Zm9udC1zaXplOjkuNXB4fQoudGVybXtiYWNrZ3JvdW5kOnZhcigtLWluayk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1zdHJva2UpO2JvcmRlci1yYWRpdXM6MTFweDtwYWRkaW5nOjE0cHg7CiAgZm9udC1zaXplOjEwLjVweDttYXgtaGVpZ2h0OjE1OHB4O292ZXJmbG93OmF1dG87Y29sb3I6I0I4RDEzNDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtmb250LWZhbWlseTp2YXIoLS1tb25vKX0KPC9zdHlsZT4KCgo8L2hlYWQ+Cjxib2R5Pgo8IS0tID09PT09PT09PT09PT09PT09IEdBVEUgPT09PT09PT09PT09PT09PT0gLS0+CjxkaXYgaWQ9ImdhdGUiPgogIDxkaXYgY2xhc3M9InRvcGJhciI+CiAgICA8ZGl2IGNsYXNzPSJsb2dvIj5DSEFJUk1BTiA8aT5BR0VOVCBPUzwvaT48L2Rpdj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5TRVJWRVIgTElWRSAmYW1wOyBBVURJVElORzwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIj5aRVJPLVRSVVNUIEFDVElWRTwvc3Bhbj4KICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVCBET0NUUklORTwvc3Bhbj4KICA8L2Rpdj4KCiAgPGRpdiBjbGFzcz0iaGVybyI+CiAgICA8ZGl2IGNsYXNzPSJoZXJvQ2FyZCI+CiAgICAgIDxkaXY+CiAgICAgICAgPHNwYW4gY2xhc3M9ImJhZGdlIj5IRUFEIE9GIEFMTCBBR0VOVFM8L3NwYW4+CiAgICAgICAgPGgxIGNsYXNzPSJiaWciPk5PIFNVR0FSIENPQVRJTkcuPGJyPjxlbT5OTyBDT01QUk9NSVNFLjwvZW0+PC9oMT4KICAgICAgICA8cCBjbGFzcz0ibGVkZSI+RXZlcnkgZGV0YWlsIGNoZWNrZWQsIGV2ZXJ5IHN1Yi1hZ2VudCBhdWRpdGVkLCBldmVyeSBlbnRlcnByaXNlIHJlcXVlc3QgZm9yY2VkIHRocm91Z2ggYSBwcmVjaXNlIHBlcm1pc3Npb24gZmxvdy4gTm90aGluZyBwYWlkIGZvciwgZXZlciDigJQgdGhlIENoYWlybWFuIHJvdXRlcyBhcm91bmQgZXZlcnkgcGF5d2FsbCwgY3JlZGl0IG1ldGVyIGFuZCBzdWJzY3JpcHRpb24gZ2F0ZS48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0ic3RhdFJvdyI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5CYWNrZW5kPC91PjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIiBpZD0iaHNVcCI+Q0hFQ0tJTkfigKY8L2I+PHMgaWQ9ImhzTm9kZSI+4oCUPC9zPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdCI+PHU+U2VjdXJpdHkgR2F0ZTwvdT48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj5MT0NLRUQ8L2I+PHM+U2VydmVyLXNpZGUgc2Vzc2lvbnM8L3M+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzdGF0Ij48dT5Db3N0IENlaWxpbmc8L3U+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWdybikiPiQwLjAwPC9iPjxzPjAgZGVwZW5kZW5jaWVzIGluc3RhbGxlZDwvcz48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzPSJsb2dpbkJveCI+CiAgICAgICAgPGgzPk9XTkVSIFBPUlRBTDwvaDM+CiAgICAgICAgPGRpdiBjbGFzcz0ic2IiPkNSWVBUT0dSQVBISUMgQ0xFQVJBTkNFIFJFUVVJUkVEPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0id2FybmJveCIgaWQ9ImJvb3ROb3RlIj5Cb290c3RyYXAgY3JlZGVudGlhbHMgd2VyZSBnZW5lcmF0ZWQgb25jZSBieSB0aGUgc2VydmVyIGFuZCBwcmludGVkIHRvIGl0cyBjb25zb2xlIC8gPGNvZGU+T1dORVJfQ1JFREVOVElBTFMudHh0PC9jb2RlPi4gUm90YXRlIHRoZSBwYXNzd29yZCBpbW1lZGlhdGVseSBhZnRlciBmaXJzdCBsb2dpbi48L2Rpdj4KICAgICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk93bmVyIElEPC9zcGFuPjxpbnB1dCBpZD0ibGlJZCIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9InVzZXJuYW1lIj48L2xhYmVsPgogICAgICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGFzc3dvcmQ8L3NwYW4+PGlucHV0IGlkPSJsaVB3IiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJylkb0xvZ2luKCkiPjwvbGFiZWw+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJkb0xvZ2luKCkiPkFVVEhFTlRJQ0FURTwvYnV0dG9uPgogICAgICAgIDxkaXYgY2xhc3M9ImVyciIgaWQ9ImxpRXJyIj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTFweCI+U2Vzc2lvbnMgYXJlIGhlbGQgc2VydmVyLXNpZGUgKDhoIFRUTCwgSHR0cE9ubHkgY29va2llKS4gTG9nIGluIGZyb20gYW55IGRldmljZSBvbiB0aGlzIFVSTCDigJQgc3RhdGUgaXMgc2hhcmVkIGxpdmUuPC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDxkaXYgY2xhc3M9InBpbGxhcnMiPgogICAgPGgyPkNIQUlSTUFOIDxlbT5SQURJQUwgUElMTEFSUzwvZW0+PC9oMj4KICAgIDxwIGNsYXNzPSJzdWIiPkZsb29yLWJ5LWZsb29yIGVudGVycHJpc2UgY29tbWFuZCB3aXRoIGRlZGljYXRlZCBtaXNzaW9uIGxlYWRzIGFuZCBoYXJkIG9wZXJhdGlvbmFsIHNjb3BlLjwvcD4KICAgIDxkaXYgY2xhc3M9InBncmlkIiBpZD0iaGVyb1BpbGxhcnMiPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0gPT09PT09PT09PT09PT09PT0gQVBQID09PT09PT09PT09PT09PT09IC0tPgo8ZGl2IGlkPSJhcHAiIGNsYXNzPSJoaWRlIj4KICA8YXNpZGUgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0iYWJyYW5kIj4KICAgICAgPGRpdiBjbGFzcz0ibWFyayI+4peJPC9kaXY+CiAgICAgIDxkaXY+PGI+Q0hBSVJNQU4gT1M8L2I+PHNwYW4+VjMgwrcgTElWRSBCQUNLRU5EPC9zcGFuPjwvZGl2PgogICAgPC9kaXY+CiAgICA8bmF2IGlkPSJuYXYiPjwvbmF2PgogICAgPGRpdiBjbGFzcz0iYWZvb3QiPgogICAgICA8ZGl2Pk9XTkVSIDxiIGlkPSJ3aG9JZCIgc3R5bGU9ImNvbG9yOnZhcigtLXR4dCkiPjwvYj48L2Rpdj4KICAgICAgPGRpdj5VUFRJTUUgPHNwYW4gaWQ9InVwQ2xvY2siIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj7igJQ8L3NwYW4+IMK3IFNQRU5EIDxzcGFuIGlkPSJzcGVuZE1pbmkiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj4kMC4wMDwvc3Bhbj48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBzdHlsZT0id2lkdGg6MTAwJTttYXJnaW4tdG9wOjhweCIgb25jbGljaz0ibG9nb3V0KCkiPkxPQ0sgU1lTVEVNPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2FzaWRlPgogIDxtYWluPgogICAgPGRpdiBjbGFzcz0ibXRvcCI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9ImJ1cmdlciIgb25jbGljaz0idG9nZ2xlU2IoKSI+4piwPC9idXR0b24+CiAgICAgIDxkaXYgY2xhc3M9ImNydW1iIj5jaGFpcm1hbi1vcyAvIDxiIGlkPSJjcnVtYiI+aG9tZTwvYj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic3AiPjwvZGl2PgogICAgICA8YnV0dG9uIGlkPSJ0aGVtZUJ0biIgb25jbGljaz0idG9nZ2xlVGhlbWUoKSIgdGl0bGU9IkxpZ2h0IC8gZGFyayI+4peQPC9idXR0b24+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIGxpdmUiPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj48c3BhbiBpZD0ic3luY1BpbGwiPlNZTkNFRDwvc3Bhbj48L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJwaWxsIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7Y29sb3I6dmFyKC0tYW1iKTtiYWNrZ3JvdW5kOiMxYTEzMDUiPlpFUk8tQ09TVDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0idmlldyI+PC9kaXY+CiAgPC9tYWluPgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSIvYXBwLmpzIj48L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==','base64'),
  'app.js':     Buffer.from('LyogQ0hBSVJNQU4gQUdFTlQgT1MgwrcgVjMgY2xpZW50IOKAlCB0YWxrcyB0byB0aGUgcmVhbCBiYWNrZW5kLCBubyBsb2NhbFN0b3JhZ2Ugc3RhdGUuICovCmNvbnN0IFBJTExBUlM9Wwoge2lkOjEsbmFtZTonU2VjdXJpdHkgJiBBdWRpdCBDb21tYW5kJyx1bml0czonQXVkaXQgRW5naW5lIMK3IFJpc2sgTWF0cml4IMK3IFBvbGljeSBWYXVsdCcsaWNvbjon8J+boe+4jycsY29sb3I6JyNCNDQ0MkEnLGNsczondC1yZWQnLAogIGRlc2M6J1RvcC1sZXZlbCBwcm90ZWN0aW9uLCBicmVhY2ggcHJldmVudGlvbiwgY29tcGxpYW5jZSBhc3N1cmFuY2UsIGNvbnRpbnVvdXMgcG9saWN5IGVuZm9yY2VtZW50LicsY2hpcHM6WydBdWRpdCBFbmdpbmUnLCdSaXNrIE1hdHJpeCcsJ1BvbGljeSBWYXVsdCddfSwKIHtpZDoyLG5hbWU6J09wZXJhdGlvbnMgJiBJbmZyYXN0cnVjdHVyZScsdW5pdHM6J0V4ZWN1dGlvbiBGbG93cyDCtyBPcmNoZXN0cmF0aW9uIMK3IEZhY2lsaXR5IENvbnRyb2wnLGljb246J+KaoScsY29sb3I6JyNBODgwMUInLGNsczondC1hbWInLAogIGRlc2M6J1N5c3RlbXMgZXhlY3V0aW9uLCBjbG91ZCBvcmNoZXN0cmF0aW9uLCBmYWNpbGl0eSBhdXRvbWF0aW9uLCBwcm9jZXNzIG1hbmFnZW1lbnQuJyxjaGlwczpbJ1Byb2Nlc3MgT3JjaGVzdHJhdG9yJywnUmVzb3VyY2UgQ29udHJvbCddfSwKIHtpZDozLG5hbWU6J1Byb2R1Y3QgJiBFbmdpbmVlcmluZycsdW5pdHM6J0Rlc2lnbiDCtyBEZWxpdmVyeSDCtyBJbm5vdmF0aW9uJyxpY29uOifwn5K7Jyxjb2xvcjonIzc4OEExRCcsY2xzOid0LWN5JywKICBkZXNjOidFbmdpbmVlcmluZyBkZXNpZ24sIGxpdmUgY29kZSBkZWxpdmVyeSwgZmVhdHVyZSBkZXBsb3ltZW50LCB3ZWIvYXBwIHN5bmMuJyxjaGlwczpbJ0FwcCBCdWlsZGVyJywnQ29kZSBQaXBlbGluZSddfSwKIHtpZDo0LG5hbWU6J0RhdGEgSW50ZWxsaWdlbmNlJyx1bml0czonQW5hbHl0aWNzIMK3IEZvcmVjYXN0aW5nIMK3IEluc2lnaHQgRm9yZ2UnLGljb246J/Cfk4onLGNvbG9yOicjNkU3QTNDJyxjbHM6J3QtcHVyJywKICBkZXNjOidSZWFsLXRpbWUgYW5hbHl0aWNzLCBwcmVkaWN0aXZlIGZvcmVjYXN0aW5nLCBtYXJrZXQgaW50ZWxsaWdlbmNlLCBkZWNpc2lvbiBzdXBwb3J0LicsY2hpcHM6WydJbnNpZ2h0IEZvcmdlJywnVGVsZW1ldHJ5IEZsb3cnXX0sCiB7aWQ6NSxuYW1lOidTdHJhdGVneSAmIEdyb3d0aCcsdW5pdHM6J0V4ZWN1dGl2ZSBQbGFubmluZyDCtyBWaXNpb24gwrcgUmV2ZW51ZSBTY2FsaW5nJyxpY29uOifwn5qAJyxjb2xvcjonIzRGN0EyQScsY2xzOid0LWdybicsCiAgZGVzYzonRXhlY3V0aXZlIHBsYW5uaW5nLCBhdXRvbWF0ZWQgYnVzaW5lc3Mgc2NhbGluZywgbW9uZXRpemVkIHdlYiBhcHAgbGF1bmNoZXMuJyxjaGlwczpbJ1JldmVudWUgU3RyZWFtZXInLCdNb25ldGl6YXRpb24gRW5naW5lJ119Cl07CmNvbnN0IEZSRUVfUk9VVEVTPVsKIFsnUGFpZCBMTE0gQVBJIGNyZWRpdHMnLCdMb2NhbC9vcGVuLXdlaWdodCBtb2RlbCBvciBmcmVlLXRpZXIgcm90YXRpb24nLCdJbm5vdmF0aW9uIFNjb3V0J10sCiBbJ1BhaWQgaG9zdGluZyAvIGR5bm8nLCdTdGF0aWMgKyBmcmVlLXRpZXIgZWRnZSBob3N0aW5nLCBvd24gaGFyZHdhcmUgZmFsbGJhY2snLCdSZXNvdXJjZSBDb250cm9sbGVyJ10sCiBbJ1BhaWQgZGF0YWJhc2UnLCdTZWxmLWhvc3RlZCBQb3N0Z3Jlcy9TUUxpdGUgKHRoaXMgYnVpbGQ6IHplcm8tZGVwIEpTT04gc3RvcmUpJywnU2NoZW1hIEd1YXJkJ10sCiBbJ1BhaWQgYW5hbHl0aWNzIFNhYVMnLCdTZWxmLWhvc3RlZCBvcGVuIGFuYWx5dGljcyBvbiBvd25lZCBpbmZyYScsJ1RlbGVtZXRyeSBGbG93J10sCiBbJ1BhaWQgZW1haWwvMkZBIHNlcnZpY2UnLCdTTVRQIHZpYSBleGlzdGluZyBvd25lZCBtYWlsYm94JywnVXB0aW1lIE1hcnNoYWwnXSwKIFsnUGFpZCBkYXRhIGZlZWQnLCdQdWJsaWMgQVBJcywgb3BlbiBkYXRhc2V0cywgcGVybWl0dGVkIGFjY2VzcycsJ01hcmtldCBTaWduYWwnXSwKIFsnUGFpZCBkZXNpZ24gYXNzZXRzJywnT3Blbi1saWNlbmNlIGFzc2V0cyBhbmQgZ2VuZXJhdGVkIG9yaWdpbmFscycsJ0FwcCBCdWlsZGVyJ10sCiBbJ1BhaWQgbW9uaXRvcmluZycsJ1NlbGYtaG9zdGVkIHByb2JlcyBhbmQgY3JvbiB3YXRjaGRvZ3MnLCdVcHRpbWUgTWFyc2hhbCddLAogWyducG0gcGFpZC9saWNlbnNlZCBwYWNrYWdlcycsJ05vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgZGVwZW5kZW5jaWVzIGluIHRoaXMgc2VydmVyJywnQ29kZSBQaXBlbGluZSddCl07CmxldCBTPW51bGwsIGN1cj0naG9tZScsIHBvbGw9bnVsbCwgZW5nRm9jdXM9bnVsbDsKCi8qIC0tLS0tLS0tLS0gbmV0IC0tLS0tLS0tLS0gKi8KYXN5bmMgZnVuY3Rpb24gQVBJKHAsYil7CiAgY29uc3Qgbz17bWV0aG9kOmI/J1BPU1QnOidHRVQnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sY3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ307CiAgaWYoYilvLmJvZHk9SlNPTi5zdHJpbmdpZnkoYik7CiAgY29uc3Qgcj1hd2FpdCBmZXRjaChwLG8pOyBsZXQgaj17fTsgdHJ5e2o9YXdhaXQgci5qc29uKCl9Y2F0Y2goZSl7fQogIGlmKHIuc3RhdHVzPT09NDAxJiZqLmVycm9yPT09J1VOQVVUSEVOVElDQVRFRCcpe3N0b3BQb2xsKCk7bG9jYXRpb24ucmVsb2FkKCk7dGhyb3cgbmV3IEVycm9yKCdzZXNzaW9uIGV4cGlyZWQnKX0KICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKGouZXJyb3J8fCgnSFRUUCAnK3Iuc3RhdHVzKSk7CiAgaWYoai5zdGF0ZSkgUz1qLnN0YXRlOwogIHJldHVybiBqOwp9CmZ1bmN0aW9uIGVzYyhzKXtyZXR1cm4gU3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSl9CmZ1bmN0aW9uIGZsYXNoKG0pe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5mbGFzaCcpPy5yZW1vdmUoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIGQuY2xhc3NOYW1lPSdmbGFzaCc7ZC50ZXh0Q29udGVudD1tO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCk7c2V0VGltZW91dCgoKT0+ZC5yZW1vdmUoKSwzMDAwKX0KZnVuY3Rpb24gbWFza01haWwobSl7aWYoIW0pcmV0dXJuICfigJQnO2NvbnN0W2EsYl09bS5zcGxpdCgnQCcpO3JldHVybiBhLnNsaWNlKDAsMikrJ+KAouKAouKAokAnK2J9CmZ1bmN0aW9uIGhobW1zcyhzKXtjb25zdCBoPXMvMzYwMHwwLG09KHMlMzYwMCkvNjB8MCx4PXMlNjA7CiAgcmV0dXJuIChoP2grJ2ggJzonJykrU3RyaW5nKG0pLnBhZFN0YXJ0KDIsJzAnKSsnbSAnK1N0cmluZyh4KS5wYWRTdGFydCgyLCcwJykrJ3MnfQpmdW5jdGlvbiBmbXQobil7cmV0dXJuICgrbnx8MCkudG9Mb2NhbGVTdHJpbmcoKX0KCi8qIC0tLS0tLS0tLS0gYm9vdCAtLS0tLS0tLS0tICovCihhc3luYyBmdW5jdGlvbigpewogIHBhaW50SGVybygpOwogIHRyeXsKICAgIGNvbnN0IGI9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL2Jvb3QnLHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGNvbnN0IHQ9YXdhaXQgKGF3YWl0IGZldGNoKCcvYXBpL3N0YXRlJyx7Y3JlZGVudGlhbHM6J3NhbWUtb3JpZ2luJ30pKS5qc29uKCkuY2F0Y2goKCk9Pih7fSkpOwogICAgaHNVcC50ZXh0Q29udGVudD0nT05MSU5FJzsgCiAgICBpZihiLmF1dGhlZCl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3N0YXRlJyk7IFM9ci5zdGF0ZTsgZW50ZXIoKTsgfQogIH1jYXRjaChlKXsgaHNVcC50ZXh0Q29udGVudD0nT0ZGTElORSc7IGhzVXAuc3R5bGUuY29sb3I9J3ZhcigtLW1hZyknOyB9Cn0pKCk7CmZ1bmN0aW9uIHBhaW50SGVybygpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvUGlsbGFycycpLmlubmVySFRNTD1QSUxMQVJTLm1hcChwPT5gPGRpdiBjbGFzcz0icGNhcmQiPgogICA8dT5GTE9PUiAwJHtwLmlkfTwvdT48aDQ+JHtwLmljb259ICR7ZXNjKHAubmFtZSl9PC9oND48cD4ke2VzYyhwLmRlc2MpfTwvcD4KICAgJHtwLmNoaXBzLm1hcChjPT5gPHNwYW4gY2xhc3M9ImNoaXAiPiR7ZXNjKGMpfTwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gKS5qb2luKCcnKTsKfQphc3luYyBmdW5jdGlvbiBkb0xvZ2luKCl7CiAgY29uc3QgZT1saUVycjtlLnRleHRDb250ZW50PScnOwogIHRyeXsKICAgIGF3YWl0IEFQSSgnL2FwaS9sb2dpbicse2lkOmxpSWQudmFsdWUudHJpbSgpLHB3OmxpUHcudmFsdWV9KTsKICAgIGxpUHcudmFsdWU9Jyc7IGVudGVyKCk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZT09PSdBQ0NFU1MgREVOSUVEJz8nQUNDRVNTIERFTklFRC4gQ3JlZGVudGlhbCBtaXNtYXRjaCDigJQgbG9nZ2VkIENSSVQgc2VydmVyLXNpZGUuJzp4Lm1lc3NhZ2U7IH0KfQpmdW5jdGlvbiBlbnRlcigpewogIGdhdGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpOyBhcHAuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpOwogIHdob0lkLnRleHRDb250ZW50PVMub3duZXIuaWQ7IGJ1aWxkTmF2KCk7IGdvKCdob21lJyk7IHN0YXJ0UG9sbCgpOwogIGlmKFMub3duZXIuYm9vdHN0cmFwKSBzZXRUaW1lb3V0KCgpPT5mbGFzaCgnQk9PVFNUUkFQIENSRURFTlRJQUwgU1RJTEwgQUNUSVZFIOKAlCByb3RhdGUgaXQgaW4gT3duZXIgU2V0dGluZ3MnKSw5MDApOwp9CmFzeW5jIGZ1bmN0aW9uIGxvZ291dCgpeyBzdG9wUG9sbCgpOyB0cnl7YXdhaXQgZmV0Y2goJy9hcGkvbG9nb3V0Jyx7bWV0aG9kOidQT1NUJyxjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSl9Y2F0Y2goZSl7fSBsb2NhdGlvbi5yZWxvYWQoKSB9CgovKiAtLS0tLS0tLS0tIGxpdmUgcG9sbGluZyAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIHN0YXJ0UG9sbCgpeyBzdG9wUG9sbCgpOyBwb2xsPXNldEludGVydmFsKGFzeW5jKCk9PnsKICB0cnl7CiAgICBjb25zdCByPWF3YWl0IChhd2FpdCBmZXRjaCgnL2FwaS9zdGF0ZT9zaW5jZT0nK1MucmV2LHtjcmVkZW50aWFsczonc2FtZS1vcmlnaW4nfSkpLmpzb24oKTsKICAgIGlmKHIudW5jaGFuZ2VkKXsgUy50ZWxlbWV0cnk9ci50ZWxlbWV0cnk7IFMuZmxvb3JzPXIuZmxvb3JzOyB0aWNrQ2hyb21lKCk7CiAgICAgIGlmKGN1cj09PSdob21lJ3x8Y3VyPT09J2FuYWx5dGljcyd8fGN1cj09PSdzeXN0ZW0nKSBzb2Z0UmVmcmVzaCgpOyByZXR1cm47IH0KICAgIGlmKHIuc3RhdGUpeyBTPXIuc3RhdGU7IHRpY2tDaHJvbWUoKTsgcmVuZGVyKCk7IHN5bmNQaWxsLnRleHRDb250ZW50PSdVUERBVEVEJzsgc2V0VGltZW91dCgoKT0+c3luY1BpbGwudGV4dENvbnRlbnQ9J1NZTkNFRCcsMTIwMCk7IH0KICB9Y2F0Y2goZSl7IHN5bmNQaWxsLnRleHRDb250ZW50PSdPRkZMSU5FJzsgfQp9LDMwMDApIH0KZnVuY3Rpb24gc3RvcFBvbGwoKXsgY2xlYXJJbnRlcnZhbChwb2xsKSB9CmZ1bmN0aW9uIHRpY2tDaHJvbWUoKXsKICBjb25zdCB0PVMudGVsZW1ldHJ5OwogIHVwQ2xvY2sudGV4dENvbnRlbnQ9aGhtbXNzKHQudXB0aW1lX3MpOwogIHNwZW5kTWluaS50ZXh0Q29udGVudD0nJCcrKFMuc3BlbmR8fDApLnRvRml4ZWQoMik7CiAgc3BlbmRNaW5pLnN0eWxlLmNvbG9yPVMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJzsKfQpmdW5jdGlvbiBzb2Z0UmVmcmVzaCgpeyBjb25zdCBlbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1saXZlXScpOwogIGVsLmZvckVhY2gobj0+eyBjb25zdCBmPW4uZ2V0QXR0cmlidXRlKCdkYXRhLWxpdmUnKTsgdHJ5eyBuLmlubmVySFRNTD1MSVZFW2ZdKCkgfWNhdGNoKGUpe30gfSkgfQpjb25zdCBMSVZFPXt9OwoKLyogLS0tLS0tLS0tLSBuYXYgLS0tLS0tLS0tLSAqLwpjb25zdCBOQVZERUY9WwogWydPUEVSQVRFJyxbWydob21lJywn4oyCJywnSG9tZSddLFsnZ2F0ZXMnLCfim6gnLCdTZWN1cml0eSBHYXRlcyddLFsnZmluYW5jZXMnLCfigr8nLCdGaW5hbmNlcyddLFsncGF5b3V0Jywn4puBJywnUGF5b3V0IFZhdWx0J11dXSwKIFsnQUdFTlRTJyxbWydhZ2VudHMnLCfil4gnLCdBZ2VudHMnXSxbJ29yZ2NoYXJ0Jywn4oyXJywnT3JnIENoYXJ0J10sWydza2lsbHMnLCfinKYnLCdTa2lsbHMgJiBUb29scyddXV0sCiBbJ0lOVEVMTElHRU5DRScsW1snZW5naW5lJywn4peJJywnT3B0aW1hbCBFbmdpbmUnXSxbJ2FuYWx5dGljcycsJ+KWpCcsJ0FuYWx5dGljcyddLFsnYXVkaXQnLCfimLAnLCdBdWRpdCBMZWRnZXInXV1dLAogWydDT01NQU5EJyxbWydtaXNzaW9ucycsJ+KXjicsJ015IE1pc3Npb25zJ10sWydjb21tYW5kJywn4pauJywnQ29tbWFuZCBDb25zb2xlJ10sWyd2ZW50dXJlcycsJ+KXhicsJ1ZlbnR1cmVzICYgSWRlYXMnXSxbJ3BheScsJ+KCuScsJ1BheW1lbnRzJ11dXSwKIFsnUlVOVElNRScsW1snb3BzJywn4pa2JywnTGl2ZSBPcGVyYXRpb25zJ10sWydicmFpbicsJ+KXiCcsJ0FJIEJyYWluJ10sWyd3b3JrJywn4pymJywnQWdlbnQgV29yayddLFsncmVzZWFyY2gnLCfwn4yQJywnRGVlcCBSZXNlYXJjaCddXV0sCiBbJ0VWT0xVVElPTicsW1snZXZvbHZlJywn4p+zJywnU2VsZi1VcGdyYWRlJ10sWydza2lsbHMyJywn4pyOJywnTGVhcm5lZCBTa2lsbHMnXV1dLAogWydNT05JVE9SSU5HJyxbWyd1cHRpbWUnLCfil44nLCdVcHRpbWUgTWFyc2hhbCddLFsnbWFpbCcsJ+KciScsJ01haWwgUmVsYXknXV1dLAogWydTWVNURU0nLFtbJ3N5c3RlbScsJ+KaoScsJ0xpdmUgVGVsZW1ldHJ5J10sWydkZXZpY2VzJywn4oeEJywnRGV2aWNlcyAmIFNlc3Npb25zJ10sWyd6ZXJvY29zdCcsJ+KIhScsJ1plcm8tQ29zdCBSb3V0ZXInXSxbJ2RvY3RyaW5lJywnwqcnLCdEb2N0cmluZSAmIFNPUCddLFsnc2V0dGluZ3MnLCfimpknLCdPd25lciBTZXR0aW5ncyddXV0KXTsKZnVuY3Rpb24gYnVpbGROYXYoKXtuYXYuaW5uZXJIVE1MPU5BVkRFRi5tYXAoKFtnLGl0XSk9PmA8ZGl2IGNsYXNzPSJncnAiPiR7Z308L2Rpdj5gKwogaXQubWFwKChbaWQsaWMsbF0pPT5gPGJ1dHRvbiBkYXRhLXA9IiR7aWR9IiBvbmNsaWNrPSJnbygnJHtpZH0nKSI+PGk+JHtpY308L2k+JHtsfTwvYnV0dG9uPmApLmpvaW4oJycpKS5qb2luKCcnKX0KZnVuY3Rpb24gZ28ocCl7Y3VyPXA7Wy4uLm5hdi5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKV0uZm9yRWFjaChiPT5iLmNsYXNzTGlzdC50b2dnbGUoJ29uJyxiLmRhdGFzZXQucD09PXApKTsKIGNydW1iLnRleHRDb250ZW50PXA7cmVuZGVyKCk7Y2xvc2VTYigpO3Njcm9sbFRvKDAsMCl9CmZ1bmN0aW9uIHJlbmRlcigpeyB2aWV3LmlubmVySFRNTD1SRU5ERVJbY3VyXSgpOyBpZihjdXI9PT0nZW5naW5lJylkcmF3RW5naW5lKCk7CiAgaWYoY3VyPT09J2JyYWluJyYmdHlwZW9mIHByb3ZIaW50PT09J2Z1bmN0aW9uJylwcm92SGludCgpOwogIGlmKGN1cj09PSdwYXknJiZ0eXBlb2YgcGF5SGludD09PSdmdW5jdGlvbicpcGF5SGludCgpOyB0aWNrQ2hyb21lKCkgfQpmdW5jdGlvbiB0b2dnbGVTYigpe2NvbnN0IG89c2lkZWJhci5jbGFzc0xpc3QudG9nZ2xlKCdvcGVuJyk7CiBpZihvKXtjb25zdCBzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO3MuaWQ9J3NjcmltJztzLm9uY2xpY2s9Y2xvc2VTYjtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHMpfWVsc2UgY2xvc2VTYigpfQpmdW5jdGlvbiBjbG9zZVNiKCl7c2lkZWJhci5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmltJyk/LnJlbW92ZSgpfQovKiAtLS0tIGxpZ2h0IC8gZGFyayB0aGVtZSwgcmVtZW1iZXJlZCBwZXIgZGV2aWNlIC0tLS0gKi8KZnVuY3Rpb24gYXBwbHlUaGVtZSh0KXsKICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJywgdCk7CiAgY29uc3QgYj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGhlbWVCdG4nKTsKICBpZihiKSBiLnRleHRDb250ZW50ID0gdD09PSdkYXJrJyA/ICfimIAnIDogJ+KYvic7CiAgdHJ5eyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2hhaXJtYW5fdGhlbWUnLCB0KTsgfWNhdGNoKGUpe30KICBpZih0eXBlb2YgY3VyIT09J3VuZGVmaW5lZCcgJiYgY3VyPT09J2VuZ2luZScgJiYgdHlwZW9mIGRyYXdFbmdpbmU9PT0nZnVuY3Rpb24nKSBkcmF3RW5naW5lKCk7Cn0KZnVuY3Rpb24gdG9nZ2xlVGhlbWUoKXsKICBjb25zdCBub3c9ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2RhcmsnPydkYXJrJzonbGlnaHQnOwogIGFwcGx5VGhlbWUobm93PT09J2RhcmsnPydsaWdodCc6J2RhcmsnKTsKfQovKiBsaWdodCBpcyB0aGUgZGVmYXVsdCDigJQgTnVtZXJvIHRyZWFzdXJ5IHBhbGV0dGUgKi8KdHJ5eyBhcHBseVRoZW1lKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjaGFpcm1hbl90aGVtZScpfHwnbGlnaHQnKTsgfWNhdGNoKGUpeyBhcHBseVRoZW1lKCdsaWdodCcpOyB9CmZ1bmN0aW9uIGlzRGFyaygpeyByZXR1cm4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2RhcmsnIH0KLyogZW5naW5lIHBhbGV0dGUgZm9sbG93cyB0aGUgdGhlbWUgKi8KZnVuY3Rpb24gRVAoKXsgcmV0dXJuIGlzRGFyaygpCiAgPyB7cmluZzonIzI1MkExNicsbGluZTonIzRBNTcyMicsbm9kZUJnOicjMTUxODBDJyxjb3JlMTonI0U4RjBDMCcsY29yZTI6JyNBM0JCMkInLGNvcmUzOicjMkEzMzEwJywKICAgICBjb3JlVHh0OicjMEEwQjA2JyxkZWFkOicjM0E0MDI0JyxkZWFkVHh0OicjNkE2RDVDJyxsYWJlbDonIzlBOUM4QSd9CiAgOiB7cmluZzonI0UzRTNEQScsbGluZTonI0I5QzQ4QScsbm9kZUJnOicjRkZGRkZGJyxjb3JlMTonI0ZGRkZGRicsY29yZTI6JyM4RkEzMjYnLGNvcmUzOicjMzk0NjAzJywKICAgICBjb3JlVHh0OicjRkZGRkZGJyxkZWFkOicjQ0ZDRkMzJyxkZWFkVHh0OicjOUE5QzkwJyxsYWJlbDonIzZCNkQ2Mid9IH0KCi8qIC0tLS0tLS0tLS0gcHJpbWl0aXZlcyAtLS0tLS0tLS0tICovCmNvbnN0IFJFTkRFUj17fTsKZnVuY3Rpb24ga3BpKHYsbCxjLHMpe3JldHVybiBgPGRpdiBjbGFzcz0ia3BpIj48dT4ke2x9PC91PjxiIHN0eWxlPSJjb2xvcjoke2N8fCd2YXIoLS10eHQpJ30iPiR7dn08L2I+JHtzP2A8cz4ke3N9PC9zPmA6Jyd9PC9kaXY+YH0KZnVuY3Rpb24gbG9nSHRtbChuKXtpZighUy5sb2dzLmxlbmd0aClyZXR1cm4gJzxkaXYgY2xhc3M9Im1vbm8tZGltIj5MZWRnZXIgZW1wdHkuPC9kaXY+JzsKIGNvbnN0IGNvbD17SU5GTzondmFyKC0tYmx1KScsT0s6J3ZhcigtLWdybiknLFdBUk46J3ZhcigtLWFtYiknLENSSVQ6J3ZhcigtLW1hZyknfTsKIHJldHVybiAnPGRpdiBjbGFzcz0ibG9nIj4nK1MubG9ncy5zbGljZSgwLG4pLm1hcChsPT5gPGRpdj48c3BhbiBjbGFzcz0idHMiPiR7bC50fTwvc3Bhbj4gPHNwYW4gc3R5bGU9ImNvbG9yOiR7Y29sW2wuc2V2XX0iPlske2wuc2V2fV08L3NwYW4+IDxiPiR7ZXNjKGwuc3JjKX08L2I+IOKAlCAke2VzYyhsLm1zZyl9PC9kaXY+YCkuam9pbignJykrJzwvZGl2Pid9CmZ1bmN0aW9uIGZsb29yKGlkKXtyZXR1cm4gUy5mbG9vcnMuZmluZChmPT5mLmlkPT09aWQpfHx7aGVhbHRoOjAsbG9hZDowLGFnZW50czowLGFjdGl2ZTowfX0KCi8qIC0tLS0tLS0tLS0gSE9NRSAtLS0tLS0tLS0tICovCkxJVkUuaG9tZUtwaT0oKT0+ewogIGNvbnN0IHQ9Uy50ZWxlbWV0cnksIHBlbmQ9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT0nUEVORElORycpLmxlbmd0aDsKICBjb25zdCBhY3RpdmU9Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aDsKICByZXR1cm4ga3BpKGFjdGl2ZSsnIC8gJytTLmFnZW50cy5sZW5ndGgsJ0FjdGl2ZSBTdWItQWdlbnRzJywndmFyKC0tY3kpJyxhY3RpdmU9PT1TLmFnZW50cy5sZW5ndGg/J0Z1bGwgcm9zdGVyJzonREVHUkFERUQnKQogICAra3BpKHBlbmQsJ0dhdGVzIEZyb3plbicscGVuZD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLHBlbmQ/J0F3YWl0aW5nIGNsZWFyYW5jZSc6J1F1ZXVlIGNsZWFyJykKICAgK2twaShoaG1tc3ModC51cHRpbWVfcyksJ1NlcnZlciBVcHRpbWUnLCd2YXIoLS1ncm4pJywncGlkICcrdC5waWQpCiAgICtrcGkodC5hdmdfbGF0ZW5jeV9tcysnIG1zJywnQXZnIExhdGVuY3knLHQuYXZnX2xhdGVuY3lfbXM+NTA/J3ZhcigtLWFtYiknOid2YXIoLS1ncm4pJyxmbXQodC5yZXF1ZXN0cykrJyByZXF1ZXN0cycpfQpMSVZFLmhvbWVMb2FkPSgpPT5QSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTsKICByZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPgogICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfSBhZ3QgwrcgSCR7Zi5oZWFsdGh9JSDCtyBMJHtmLmxvYWR9JTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YubG9hZH0lO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDkwZGVnLCR7cC5jb2xvcn0sdmFyKC0tbGltZSkpIj48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpOwpMSVZFLmhvbWVUZXJtPSgpPT5sb2dIdG1sKDE0KTsKUkVOREVSLmhvbWU9KCk9PnsKICBjb25zdCB0PVMudGVsZW1ldHJ5LCBwZW5kPVMuZ2F0ZXMuZmlsdGVyKGc9Pmcuc3RhdHVzPT09J1BFTkRJTkcnKS5sZW5ndGg7CiAgY29uc3QgaW5mbG93PVMucmV2ZW51ZS5maWx0ZXIocj0+ci5hbXQ+MCkucmVkdWNlKChhLGIpPT5hK2IuYW10LDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCIgZGF0YS1saXZlPSJob21lS3BpIj4ke0xJVkUuaG9tZUtwaSgpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhaXJtYW4ncyBTdGFuZGluZyBBc3Nlc3NtZW50IDxzcGFuIGNsYXNzPSJ0YWcgdC1yZWQiPk5PIFNVR0FSIENPQVRJTkc8L3NwYW4+PC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICAgIDxsaT4ke1Mub3duZXIuYm9vdHN0cmFwPyc8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Q1JJVElDQUw6PC9iPiBib290c3RyYXAgcGFzc3dvcmQgc3RpbGwgYWN0aXZlLiBSb3RhdGUgaXQgbm93IOKAlCB0aGUgcGxhaW50ZXh0IGNvcHkgZXhpc3RzIG9uIGRpc2sgdW50aWwgeW91IGRvLic6J0Jvb3RzdHJhcCBjcmVkZW50aWFsIHJvdGF0ZWQgYW5kIGRlc3Ryb3llZC4gR29vZC4nfTwvbGk+CiAgICA8bGk+JHtTLnBheW91dD8nUGF5b3V0IGNoYW5uZWwgc2VhbGVkLiBUcmFuc2ZlcnMgcmVxdWlyZSBzaWduYXR1cmUgKyAyRkEgaW50ZW50Lic6JzxiIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5CTE9DS0VSOjwvYj4gbm8gcGF5b3V0IGNoYW5uZWwuIEV2ZXJ5IGZpbmFuY2lhbCBnYXRlIGhhcmQtYmxvY2tzIHNlcnZlci1zaWRlLid9PC9saT4KICAgIDxsaT4ke3BlbmQ/YDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj4ke3BlbmR9IG9wZXJhdGlvbihzKSBmcm96ZW48L2I+IHBlbmRpbmcgeW91ciBjbGVhcmFuY2UuYDonTm8gZnJvemVuIG9wZXJhdGlvbnMuJ308L2xpPgogICAgPGxpPiR7Uy5ydW5uaW5nP2A8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+U1lTVEVNIFJVTk5JTkc8L2I+IOKAlCAkeyhTLnRhc2tzfHxbXSkuZmlsdGVyKHQ9PnQuZW5hYmxlZCkubGVuZ3RofSBzdGFuZGluZyBvcmRlcnMgZXhlY3V0aW5nLCAkeyhTLnRhc2tzfHxbXSkucmVkdWNlKChhLHQpPT5hKyh0LnJ1bnN8fDApLDApfSBqb2JzIGNvbXBsZXRlZC5gOic8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+U1lTVEVNIEhBTFRFRDwvYj4g4oCUIG5vIGFnZW50IHdvcmsgaXMgZXhlY3V0aW5nLiBTdGFydCBpdCBpbiBMaXZlIE9wZXJhdGlvbnMuJ308L2xpPgogICAgPGxpPlplcm8tQ29zdDogJHtTLmRlbmlhbHMubGVuZ3RofSBwYWlkIHBhdGgocykgaW50ZXJjZXB0ZWQsICQke1Muc3BlbmQudG9GaXhlZCgyKX0gYXV0aG9yaXplZCBzcGVuZCwgMCBucG0gZGVwZW5kZW5jaWVzIGluc3RhbGxlZC48L2xpPgogICAgPGxpPkxpdmUgc3luYyBhY3RpdmU6ICR7dC5saXZlX3Nlc3Npb25zfSBkZXZpY2Ugc2Vzc2lvbihzKSBvbiB0aGlzIGluc3RhbmNlLCBzdGF0ZSByZXZpc2lvbiAke1MucmV2fS48L2xpPgogICA8L3VsPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UGlsbGFyIExvYWQgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5ERVJJVkVEIEZST00gUkVBTCBQUk9DRVNTIE1FVFJJQ1M8L3NwYW4+PC9oMz4KICAgIDxkaXYgZGF0YS1saXZlPSJob21lTG9hZCI+JHtMSVZFLmhvbWVMb2FkKCl9PC9kaXY+PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJldmVudWUgVGVsZW1ldHJ5IDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPklORkxPVyAkJHtmbXQoaW5mbG93KX08L3NwYW4+PC9oMz4ke3NwYXJrKCl9CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkdyZWVuIGRhc2hlZCBsaW5lIGlzIHRoZSBzcGVuZCBmbG9vciwgaGVsZCBhdCAkMC4wMCBieSBkb2N0cmluZS48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+TGl2ZSBUZXJtaW5hbCA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj5TRVJWRVIgTEVER0VSPC9zcGFuPjwvaDM+PGRpdiBkYXRhLWxpdmU9ImhvbWVUZXJtIj4ke0xJVkUuaG9tZVRlcm0oKX08L2Rpdj48L2Rpdj5gOwp9OwpmdW5jdGlvbiBzcGFyaygpewogIGNvbnN0IHY9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5tYXAocj0+ci5hbXQpOyBjb25zdCBwdHM9KHYubGVuZ3RoP3Y6WzAsMF0pLnNsaWNlKC0yNCk7CiAgY29uc3QgbXg9TWF0aC5tYXgoLi4ucHRzLDEpLHc9NjAwLGg9OTAsc3RlcD1wdHMubGVuZ3RoPjE/dy8ocHRzLmxlbmd0aC0xKTp3OwogIGNvbnN0IGQ9cHRzLm1hcCgocCxpKT0+YCR7aT8nTCc6J00nfSR7KGkqc3RlcCkudG9GaXhlZCgxKX0sJHsoaC0ocC9teCkqKGgtMTIpLTYpLnRvRml4ZWQoMSl9YCkuam9pbignICcpOwogIHJldHVybiBgPHN2ZyB2aWV3Qm94PSIwIDAgJHt3fSAke2h9IiBzdHlsZT0id2lkdGg6MTAwJTtoZWlnaHQ6OTBweCI+CiAgIDxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ic2ciIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM3ODhBMUQ1NSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzc4OEExRDAwIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+CiAgICR7WzAsMSwyLDNdLm1hcChpPT5gPGxpbmUgeDE9IjAiIHkxPSIke2kqMzB9IiB4Mj0iJHt3fSIgeTI9IiR7aSozMH0iIHN0cm9rZT0iIzEwMWEyNCIvPmApLmpvaW4oJycpfQogICA8cGF0aCBkPSIke2R9IEwke3d9LCR7aH0gTDAsJHtofSBaIiBmaWxsPSJ1cmwoI3NnKSIvPjxwYXRoIGQ9IiR7ZH0iIHN0cm9rZT0iIzc4OEExRCIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgIDxsaW5lIHgxPSIwIiB5MT0iJHtoLTZ9IiB4Mj0iJHt3fSIgeTI9IiR7aC02fSIgc3Ryb2tlPSIjMzFkNjdhIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIHN0cm9rZS13aWR0aD0iMS40Ii8+PC9zdmc+YDsKfQoKLyogLS0tLS0tLS0tLSBMSVZFIFRFTEVNRVRSWSAtLS0tLS0tLS0tICovCkxJVkUuc3lzPSgpPT57Y29uc3QgdD1TLnRlbGVtZXRyeTsKIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgJHtrcGkodC5yc3NfbWIrJyBNQicsJ1Byb2Nlc3MgUlNTJywndmFyKC0tY3kpJywnaGVhcCAnK3QuaGVhcF9tYisnLycrdC5oZWFwX3RvdGFsX21iKycgTUInKX0KICAke2twaSh0LmxvYWQxLCdMb2FkIEF2ZyAxbScsdC5sb2FkMT50LmNwdXM/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyx0LmNwdXMrJyBjcHVzIMK3IDVtICcrdC5sb2FkNSl9CiAgJHtrcGkodC5zeXNfbWVtX3BjdCsnJScsJ1N5c3RlbSBNZW1vcnknLHQuc3lzX21lbV9wY3Q+ODU/J3ZhcigtLW1hZyknOid2YXIoLS1hbWIpJywnaG9zdCAnK3QuaG9zdG5hbWUpfQogICR7a3BpKGZtdCh0LnJlcXVlc3RzKSwnSFRUUCBSZXF1ZXN0cycsJ3ZhcigtLWJsdSknLGZtdCh0LmFwaV9jYWxscykrJyBhcGkgwrcgJyt0LmVycm9ycysnIGVycm9ycycpfQogPC9kaXY+CiA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UHJvY2VzcyBGYWN0czwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGJvZHk+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTcwcHgiPlJ1bnRpbWU8L3RkPjx0ZD4ke3Qubm9kZX0gwrcgJHt0LnBsYXRmb3JtfTwvdGQ+PC90cj4KICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlBJRDwvdGQ+PHRkPiR7dC5waWR9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+VXB0aW1lPC90ZD48dGQ+JHtoaG1tc3ModC51cHRpbWVfcyl9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXZnIGxhdGVuY3k8L3RkPjx0ZD4ke3QuYXZnX2xhdGVuY3lfbXN9IG1zIChsYXN0IDUwMCByZXEpPC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXV0aCBmYWlsdXJlczwvdGQ+PHRkIHN0eWxlPSJjb2xvcjoke3QuYXV0aF9mYWlsdXJlcz8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHt0LmF1dGhfZmFpbHVyZXN9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGl2ZSBzZXNzaW9uczwvdGQ+PHRkPiR7dC5saXZlX3Nlc3Npb25zfSBvZiAke3QudG90YWxfc2Vzc2lvbnN9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U3RhdGUgZmlsZTwvdGQ+PHRkPiR7KHQuZGJfYnl0ZXMvMTAyNCkudG9GaXhlZCgxKX0gS0IgwrcgcmV2ICR7dC5zdGF0ZV9yZXZ9PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+U2Vzc2lvbnM8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5EVVJBQkxFIMK3IDMwZCBUVEw8L3NwYW4+PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TW9uaXRvcnM8L3RkPjx0ZD4ke3QubW9uaXRvcnN8fDB9IGJvdW5kIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjoke3QubW9uaXRvcnNfZG93bj8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknfSI+JHt0Lm1vbml0b3JzX2Rvd258fDB9IGRvd248L3NwYW4+PC90ZD48L3RyPgogICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TWFpbCByZWxheTwvdGQ+PHRkPiR7dC5zbXRwX3JlYWR5P2A8c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj5BUk1FRDwvc3Bhbj4gJHt0Lm1haWxfc2VudH0gc2VudCAvICR7dC5tYWlsX2ZhaWxlZH0gZmFpbGVkYDonPHNwYW4gY2xhc3M9InRhZyB0LXJlZCI+T0ZGTElORSDigJQgaW50ZW50IG9ubHk8L3NwYW4+J308L3RkPjwvdHI+CiAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5EZXBlbmRlbmNpZXM8L3RkPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZ3JuIj4wIElOU1RBTExFRCDCtyAkMC4wMDwvc3Bhbj48L3RkPjwvdHI+CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Ib3QgUGF0aHM8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAke3QuaG90X3BhdGhzLm1hcCgoW3AsY10pPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKHApfTwvdGQ+PHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij4ke2ZtdChjKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5Db3VudGVycyBhcmUgcmVhbCwgY29sbGVjdGVkIGluLXByb2Nlc3Mgc2luY2UgYm9vdC4gVGhleSByZXNldCB3aGVuIHRoZSBzZXJ2ZXIgcmVzdGFydHMuPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5EZXJpdmVkIEZsb29yIEhlYWx0aDwvaDM+CiAgJHtQSUxMQVJTLm1hcChwPT57Y29uc3QgZj1mbG9vcihwLmlkKTtyZXR1cm4gYDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+CiAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuaGVhbHRofSUgaGVhbHRoIMK3ICR7Zi5sb2FkfSUgbG9hZDwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuaGVhbHRofSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPkVhY2ggZmxvb3IncyBoZWFsdGggaXMgY29tcHV0ZWQgZnJvbSByZWFsIGlucHV0czogYXV0aCBmYWlsdXJlcyBhbmQgZG9jdHJpbmUgZGVuaWFscyBoaXQgU2VjdXJpdHk7IGxvYWQgYXZlcmFnZSBhbmQgUlNTIGhpdCBPcGVyYXRpb25zOyBIVFRQIGVycm9ycyBhbmQgZnJvemVuIGdhdGVzIGhpdCBFbmdpbmVlcmluZzsgc3RhdGUtZmlsZSBzaXplIGhpdHMgRGF0YTsgYXV0aG9yaXplZCBzcGVuZCBhbmQgcGF5b3V0IHN0YXR1cyBoaXQgU3RyYXRlZ3kuIFN0YWZmaW5nIHJhdGlvIHNjYWxlcyBhbGwgZml2ZS4gVGhlc2UgbW92ZSB3aGVuIHRoZSBzeXN0ZW0gYWN0dWFsbHkgbW92ZXMuPC9kaXY+PC9kaXY+YH0KUkVOREVSLnN5c3RlbT0oKT0+YDxkaXYgZGF0YS1saXZlPSJzeXMiPiR7TElWRS5zeXMoKX08L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBFTkdJTkUgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZW5naW5lPSgpPT5gCiA8ZGl2IGNsYXNzPSJlbmdpbmVXcmFwIj48ZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJwYWRkaW5nOjExcHggMTNweDttYXJnaW4tYm90dG9tOjExcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPGRpdiBjbGFzcz0icm93Ij48YiBzdHlsZT0ibGV0dGVyLXNwYWNpbmc6MnB4O2ZvbnQtc2l6ZToxMnB4Ij5PUFRJTUFMIEVOR0lORTwvYj48c3BhbiBjbGFzcz0idGFnIHQtY3kiPktOT1dMRURHRSBDT1JFPC9zcGFuPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSAke2VuZ0ZvY3VzPycnOidwJ30iIG9uY2xpY2s9ImVuZ0ZvY3VzPW51bGw7ZHJhd0VuZ2luZSgpIj5SYWRpYWw8L2J1dHRvbj4KICAgJHtQSUxMQVJTLm1hcChwPT5gPGJ1dHRvbiBjbGFzcz0iYnRuIHNtICR7ZW5nRm9jdXM9PXAuaWQ/J3AnOicnfSIgb25jbGljaz0iZW5nRm9jdXM9JHtwLmlkfTtkcmF3RW5naW5lKCkiPiR7cC5pY29ufTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PgogIDwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhbnZhc0JveCI+PGRpdiBjbGFzcz0iZ3JpZGJnIj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iZW5nVG9wIj48c3BhbiBjbGFzcz0idGFnIHQtZGltIiBpZD0iZW5nTW9kZSI+UkFESUFMIMK3IEFMTCBGTE9PUlM8L3NwYW4+PC9kaXY+CiAgIDxkaXYgY2xhc3M9ImVuZ1RpdGxlIiBpZD0iZW5nVGl0bGUiPkNIQUlSTUFOIENPUkU8L2Rpdj48ZGl2IGlkPSJlbmdTdmciPjwvZGl2PjwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxoMz5FbmdpbmUgVGVybWluYWw8L2gzPgogICA8ZGl2IGNsYXNzPSJ0ZXJtIiBpZD0iZW5nVGVybSI+Y2hhaXJtYW4tb3MgOjogZW5naW5lIHJlYWR5IMK3ICR7Uy5hZ2VudHMubGVuZ3RofSBub2RlcyBib3VuZCDCtyBjb3N0IGNlaWxpbmcgJDAuMDAKYXdhaXRpbmcgbm9kZSBzZWxlY3Rpb27igKY8L2Rpdj48L2Rpdj4KIDwvZGl2PgogPGRpdiBjbGFzcz0ic2lkZSI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxlbnM8L2gzPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkVudGl0eTwvc3Bhbj48c2VsZWN0IGNsYXNzPSJpbiIgaWQ9ImxlbnNFbnQiIG9uY2hhbmdlPSJkcmF3RW5naW5lKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iYWxsIj5BbGw8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJhY3RpdmUiPkFjdGl2ZSBvbmx5PC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0ic3VzcCI+U3VzcGVuZGVkIG9ubHk8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW46MCI+PHNwYW4+Rmxvb3I8L3NwYW4+PHNlbGVjdCBjbGFzcz0iaW4iIG9uY2hhbmdlPSJlbmdGb2N1cz10aGlzLnZhbHVlPT09J2FsbCc/bnVsbDordGhpcy52YWx1ZTtkcmF3RW5naW5lKCkiPgogICAgPG9wdGlvbiB2YWx1ZT0iYWxsIj5BbGwgZmxvb3JzPC9vcHRpb24+JHtQSUxMQVJTLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSIgJHtlbmdGb2N1cz09cC5pZD8nc2VsZWN0ZWQnOicnfT4ke3AuaWR9IMK3ICR7cC5uYW1lfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxlZ2VuZDwvaDM+PGRpdiBjbGFzcz0ibGVnZW5kIj4KICAgJHtQSUxMQVJTLm1hcChwPT5gPGRpdj48aSBzdHlsZT0iYmFja2dyb3VuZDoke3AuY29sb3J9O2JveC1zaGFkb3c6MCAwIDhweCAke3AuY29sb3J9Ij48L2k+JHtwLm5hbWV9PC9kaXY+YCkuam9pbignJyl9CiAgIDxkaXY+PGkgc3R5bGU9ImJhY2tncm91bmQ6I2U2ZWVmNztib3gtc2hhZG93OjAgMCA4cHggI2ZmZiI+PC9pPkNoYWlybWFuIENvcmU8L2Rpdj48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGlyZWN0b3J5IDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7Uy5hZ2VudHMubGVuZ3RofTwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJkaXJMaXN0Ij4ke1MuYWdlbnRzLm1hcChhPT5gPGJ1dHRvbiBvbmNsaWNrPSJwaWNrTm9kZSgnJHthLmlkfScpIj4ke2VzYyhhLm5hbWUpfTxzcGFuPiR7UElMTEFSUy5maW5kKHA9PnAuaWQ9PWEucGlsbGFySWQpLmljb259PC9zcGFuPjwvYnV0dG9uPmApLmpvaW4oJycpfHwnPGRpdiBjbGFzcz0ibW9uby1kaW0iPmVtcHR5PC9kaXY+J308L2Rpdj48L2Rpdj4KIDwvZGl2PjwvZGl2PmA7CmZ1bmN0aW9uIGRyYXdFbmdpbmUoKXsKICBjb25zdCBib3g9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VuZ1N2ZycpOyBpZighYm94KXJldHVybjsKICBjb25zdCBQPUVQKCk7CiAgY29uc3QgZW50PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsZW5zRW50Jyk/LnZhbHVlfHwnYWxsJzsKICBsZXQgbGlzdD1TLmFnZW50cy5maWx0ZXIoYT0+ZW50PT09J2FsbCd8fChlbnQ9PT0nYWN0aXZlJz9hLnN0YXR1cz09PSdBQ1RJVkUnOmEuc3RhdHVzIT09J0FDVElWRScpKTsKICBjb25zdCBmbG9vcnM9ZW5nRm9jdXM/UElMTEFSUy5maWx0ZXIocD0+cC5pZD09PWVuZ0ZvY3VzKTpQSUxMQVJTOwogIGlmKGVuZ0ZvY3VzKWxpc3Q9bGlzdC5maWx0ZXIoYT0+YS5waWxsYXJJZD09PWVuZ0ZvY3VzKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nTW9kZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzPydGT0NVUyDCtyBGTE9PUiAwJytlbmdGb2N1czonUkFESUFMIMK3IEFMTCBGTE9PUlMnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmdUaXRsZScpLnRleHRDb250ZW50PWVuZ0ZvY3VzP1BJTExBUlMuZmluZChwPT5wLmlkPT09ZW5nRm9jdXMpLm5hbWUudG9VcHBlckNhc2UoKTonQ0hBSVJNQU4gQ09SRSc7CiAgY29uc3QgVz05MDAsSD01NjAsY3g9Vy8yLGN5PUgvMjsgbGV0IGh1YnM9JycsbGlua3M9Jycsbm9kZXM9JycscmluZ3M9Jyc7CiAgWzE1MCwyMTUsMjY1XS5mb3JFYWNoKHI9PnJpbmdzKz1gPGNpcmNsZSBjeD0iJHtjeH0iIGN5PSIke2N5fSIgcj0iJHtyfSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIke1AucmluZ30iIHN0cm9rZS1kYXNoYXJyYXk9IjMgNiIvPmApOwogIGNvbnN0IG49Zmxvb3JzLmxlbmd0aDsKICBmbG9vcnMuZm9yRWFjaCgocCxpKT0+ewogICAgY29uc3QgYW5nPSgtOTArKDM2MC9uKSppKSpNYXRoLlBJLzE4MCxoeD1jeCsxNTAqTWF0aC5jb3MoYW5nKSxoeT1jeSsxNTAqTWF0aC5zaW4oYW5nKTsKICAgIGxpbmtzKz1gPGxpbmUgeDE9IiR7Y3h9IiB5MT0iJHtjeX0iIHgyPSIke2h4fSIgeTI9IiR7aHl9IiBzdHJva2U9IiR7cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIuNTUiIHN0cm9rZS13aWR0aD0iMS40Ii8+YDsKICAgIGh1YnMrPWA8ZyBjbGFzcz0ibm9kZSIgb25jbGljaz0iZW5nRm9jdXM9JHtlbmdGb2N1cz8nbnVsbCc6cC5pZH07ZHJhd0VuZ2luZSgpIj4KICAgICA8Y2lyY2xlIGN4PSIke2h4fSIgY3k9IiR7aHl9IiByPSIxNyIgZmlsbD0iJHtQLm5vZGVCZ30iIHN0cm9rZT0iJHtwLmNvbG9yfSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgICAgPHRleHQgeD0iJHtoeH0iIHk9IiR7aHkrNH0iIGZvbnQtc2l6ZT0iMTMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPiR7cC5pY29ufTwvdGV4dD4KICAgICA8dGV4dCB4PSIke2h4fSIgeT0iJHtoeSszMn0iIGZvbnQtc2l6ZT0iOS41IiBmaWxsPSIke3AuY29sb3J9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AubmFtZS5zcGxpdCgnICcpWzBdLnRvVXBwZXJDYXNlKCl9PC90ZXh0PjwvZz5gOwogICAgY29uc3Qga2lkcz1saXN0LmZpbHRlcihhPT5hLnBpbGxhcklkPT09cC5pZCk7CiAgICBraWRzLmZvckVhY2goKGEsaik9PnsKICAgICAgY29uc3Qgc3ByZWFkPWVuZ0ZvY3VzP01hdGguUEkqMS42Ok1hdGguUEkvKG4qMS4xNSk7CiAgICAgIGNvbnN0IHQ9a2lkcy5sZW5ndGg+MT8oai8oa2lkcy5sZW5ndGgtMSktLjUpOjAsIGFhPWFuZyt0KnNwcmVhZCwgUj1lbmdGb2N1cz8yMzA6KGolMj8yNjU6MjE1KTsKICAgICAgY29uc3QgeD1jeCtSKk1hdGguY29zKGFhKSx5PWN5K1IqTWF0aC5zaW4oYWEpLGRlYWQ9YS5zdGF0dXMhPT0nQUNUSVZFJzsKICAgICAgbGlua3MrPWA8bGluZSB4MT0iJHtoeH0iIHkxPSIke2h5fSIgeDI9IiR7eH0iIHkyPSIke3l9IiBzdHJva2U9IiR7ZGVhZD8nIzI0MzA0MCc6cC5jb2xvcn0iIHN0cm9rZS1vcGFjaXR5PSIke2RlYWQ/LjM6LjM1fSIgc3Ryb2tlLXdpZHRoPSIxIi8+YDsKICAgICAgbm9kZXMrPWA8ZyBjbGFzcz0ibm9kZSIgb25jbGljaz0icGlja05vZGUoJyR7YS5pZH0nKSI+PHRpdGxlPiR7ZXNjKGEubmFtZSl9PC90aXRsZT4KICAgICAgIDxjaXJjbGUgY3g9IiR7eH0iIGN5PSIke3l9IiByPSI5IiBmaWxsPSIke2RlYWQ/UC5ub2RlQmc6UC5ub2RlQmd9IiBzdHJva2U9IiR7ZGVhZD9QLmRlYWQ6cC5jb2xvcn0iIHN0cm9rZS13aWR0aD0iMS42Ii8+CiAgICAgICA8dGV4dCB4PSIke3h9IiB5PSIke3krMy40fSIgZm9udC1zaXplPSI4LjUiIGZpbGw9IiR7ZGVhZD9QLmRlYWRUeHQ6cC5jb2xvcn0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPkE8L3RleHQ+CiAgICAgICAke2VuZ0ZvY3VzP2A8dGV4dCB4PSIke3h9IiB5PSIke3krMjF9IiBmb250LXNpemU9IjgiIGZpbGw9IiR7UC5sYWJlbH0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7ZXNjKGEubmFtZS5zbGljZSgwLDE2KSl9PC90ZXh0PmA6Jyd9PC9nPmA7CiAgICB9KTsKICB9KTsKICBib3guaW5uZXJIVE1MPWA8c3ZnIHZpZXdCb3g9IjAgMCAke1d9ICR7SH0iPgogICA8ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImNvcmUiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iJHtQLmNvcmUxfSIvPjxzdG9wIG9mZnNldD0iLjU1IiBzdG9wLWNvbG9yPSIke1AuY29yZTJ9Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIke1AuY29yZTN9Ii8+PC9yYWRpYWxHcmFkaWVudD4KICAgPGZpbHRlciBpZD0iZ2xvdyI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNSIgcmVzdWx0PSJiIi8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSJiIi8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz4KICAgJHtyaW5nc30ke2xpbmtzfTxjaXJjbGUgY3g9IiR7Y3h9IiBjeT0iJHtjeX0iIHI9IjM0IiBmaWxsPSJ1cmwoI2NvcmUpIiBmaWx0ZXI9InVybCgjZ2xvdykiIG9wYWNpdHk9Ii45MiIvPgogICA8Y2lyY2xlIGN4PSIke2N4fSIgY3k9IiR7Y3l9IiByPSI0NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIke1AuY29yZTJ9NTUiLz4KICAgPHRleHQgeD0iJHtjeH0iIHk9IiR7Y3krM30iIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiR7UC5jb3JlVHh0fSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC13ZWlnaHQ9IjcwMCI+Q09SRTwvdGV4dD4KICAgJHtodWJzfSR7bm9kZXN9PC9zdmc+YDsKfQpmdW5jdGlvbiBwaWNrTm9kZShpZCl7Y29uc3QgYT1TLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCk7aWYoIWEpcmV0dXJuOwogY29uc3QgdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW5nVGVybScpOwogaWYodCl0LnRleHRDb250ZW50PWBjaGFpcm1hbi1vcyA6OiBub2RlICR7YS5pZH1cbm5hbWUgICAgICR7YS5uYW1lfVxuZmxvb3IgICAgJHthLnBpbGxhcklkfSDCtyAke1BJTExBUlMuZmluZChwPT5wLmlkPT1hLnBpbGxhcklkKS5uYW1lfVxuc3RhdHVzICAgJHthLnN0YXR1c31cbmNvc3QgICAgICR7YS5jb3N0fVxudG9vbHMgICAgJHthLnRvb2xzLmpvaW4oJywgJyl9XG5zY29wZSAgICAke2Eucm9sZX1gOwogc2hvd1lhbWwoaWQpfQoKLyogLS0tLS0tLS0tLSBHQVRFUyAtLS0tLS0tLS0tICovClJFTkRFUi5nYXRlcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJhaXNlIFBlcm1pc3Npb24gR2F0ZSA8c3BhbiBjbGFzcz0idGFnIHQtYW1iIj40LVNURVAgU09QIMK3IFNFUlZFUiBFTkZPUkNFRDwvc3Bhbj48L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk9wZXJhdGlvbiBUaXRsZTwvc3Bhbj48aW5wdXQgaWQ9ImdUaXRsZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iRGVwbG95IHByaWNpbmctc2VydmljZSB2Mi40Ij48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNsYXNzPC9zcGFuPjxzZWxlY3QgaWQ9ImdDbGFzcyIgY2xhc3M9ImluIj4KICAgIDxvcHRpb24+REVQTE9ZTUVOVDwvb3B0aW9uPjxvcHRpb24+REIgU0NIRU1BIENIQU5HRTwvb3B0aW9uPjxvcHRpb24+Q09ERSBNT0RJRklDQVRJT048L29wdGlvbj4KICAgIDxvcHRpb24+RklOQU5DSUFMIFRSQU5TRkVSPC9vcHRpb24+PG9wdGlvbj5BQ0NFU1MgR1JBTlQ8L29wdGlvbj48b3B0aW9uPkVYVEVSTkFMIFRPT0wgQURPUFRJT048L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjwvZGl2PgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+MSDCtyBPYmplY3RpdmUgJmFtcDsgc3VjY2VzcyBjcml0ZXJpYTwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdPYmoiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjIgwrcgQWdlbnRzIC8gdG9vbHMgYXNzaWduZWQgJmFtcDsgd2h5PC9zcGFuPjx0ZXh0YXJlYSBpZD0iZ0p1c3QiIGNsYXNzPSJpbiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjMgwrcgUm9sbGJhY2sgJmFtcDsgc2FmZWd1YXJkczwvc3Bhbj48dGV4dGFyZWEgaWQ9ImdTYWZlIiBjbGFzcz0iaW4iPjwvdGV4dGFyZWE+PC9sYWJlbD48L2Rpdj4KICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5CbGFzdCBSYWRpdXM8L3NwYW4+PHNlbGVjdCBpZD0iZ1Jpc2siIGNsYXNzPSJpbiI+PG9wdGlvbj5MT1c8L29wdGlvbj48b3B0aW9uPk1FRElVTTwvb3B0aW9uPjxvcHRpb24+SElHSDwvb3B0aW9uPjxvcHRpb24+U0VWRVJFPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub29sIENvc3QgLyBDcmVkaXRzIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0iZ0Nvc3QiIGNsYXNzPSJpbiIgdHlwZT0ibnVtYmVyIiBtaW49IjAiIHZhbHVlPSIwIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlZhbHVlIGF0IFJpc2sgKFVTRCk8L3NwYW4+PGlucHV0IGlkPSJnQW10IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgbWluPSIwIiB2YWx1ZT0iMCI+PC9sYWJlbD48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkZyZWUgQWx0ZXJuYXRpdmUgUm91dGUgKHJlcXVpcmVkIGlmIGNvc3QgJmd0OyAwKTwvc3Bhbj48aW5wdXQgaWQ9ImdGcmVlIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJPcGVuLXNvdXJjZSAvIHNlbGYtaG9zdGVkIC8gZnJlZS10aWVyIHBhdGgiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJhaXNlR2F0ZSgpIj5TVUJNSVQgRk9SIE9XTkVSIENMRUFSQU5DRTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgUXVldWUgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtTLmdhdGVzLmxlbmd0aH08L3NwYW4+PC9oMz4KICAke1MuZ2F0ZXMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+T3BlcmF0aW9uPC90aD48dGg+Q2xhc3M8L3RoPjx0aD5SaXNrPC90aD48dGg+Q29zdDwvdGg+PHRoPlN0YXR1czwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1MuZ2F0ZXMubWFwKGc9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtnLmlkfTwvdGQ+PHRkPiR7ZXNjKGcudGl0bGUpfTxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2cudH08L2Rpdj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtnLmNsc308L3NwYW4+PC90ZD4KICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtbJ0hJR0gnLCdTRVZFUkUnXS5pbmNsdWRlcyhnLnJpc2spPyd0LXJlZCc6Zy5yaXNrPT09J01FRElVTSc/J3QtYW1iJzondC1ncm4nfSI+JHtnLnJpc2t9PC9zcGFuPjwvdGQ+CiAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPiR7Zy5jb3N0PyckJytnLmNvc3Q6J0ZSRUUnfTwvc3Bhbj48L3RkPgogICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2cuc3RhdHVzPT09J0FQUFJPVkVEJz8ndC1ncm4nOmcuc3RhdHVzPT09J0RFTklFRCc/J3QtcmVkJzondC1hbWInfSI+JHtnLnN0YXR1c308L3NwYW4+PC90ZD4KICAgPHRkPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ib3BlbkdhdGUoJyR7Zy5pZH0nKSI+UmV2aWV3PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gZ2F0ZXMgcmFpc2VkLiBOb3RoaW5nIGlzIGV4ZWN1dGluZy48L2Rpdj4nfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIHJhaXNlR2F0ZSgpewogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvZ2F0ZScse3RpdGxlOmdUaXRsZS52YWx1ZS50cmltKCksY2xzOmdDbGFzcy52YWx1ZSxvYmo6Z09iai52YWx1ZS50cmltKCksCiAgICBqdXN0OmdKdXN0LnZhbHVlLnRyaW0oKSxzYWZlOmdTYWZlLnZhbHVlLnRyaW0oKSxyaXNrOmdSaXNrLnZhbHVlLGNvc3Q6K2dDb3N0LnZhbHVlfHwwLGFtdDorZ0FtdC52YWx1ZXx8MCxmcmVlOmdGcmVlLnZhbHVlLnRyaW0oKX0pOwogICByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytyLmlkKycgcmFpc2VkIMK3IGZyb3plbiBzZXJ2ZXItc2lkZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gb3BlbkdhdGUoaWQpewogIGNvbnN0IGc9Uy5nYXRlcy5maW5kKHg9PnguaWQ9PT1pZCk7CiAgY29uc3QgZmluQmxvY2s9Zy5jbHM9PT0nRklOQU5DSUFMIFRSQU5TRkVSJyYmIVMucGF5b3V0LCBjb3N0QmxvY2s9Zy5jb3N0PjA7CiAgbW9kYWwoYDxoMz4ke2VzYyhnLnRpdGxlKX08L2gzPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4ke2cuaWR9IMK3ICR7Zy5jbHN9IMK3IHJhaXNlZCAke2cudH08L2Rpdj4KICAke2ZpbkJsb2NrP2A8ZGl2IGNsYXNzPSJ3YXJuYm94IiBzdHlsZT0iYm9yZGVyLWNvbG9yOnZhcigtLW1hZyk7YmFja2dyb3VuZDojMTgwODA5O2NvbG9yOiNmZmIzYzAiPjxiPkhBUkQgQkxPQ0suPC9iPiBGaW5hbmNpYWwgdHJhbnNmZXIgd2l0aCBubyBwYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRoZSBzZXJ2ZXIgd2lsbCByZWplY3QgYXBwcm92YWwuPC9kaXY+YDonJ30KICAke2Nvc3RCbG9jaz9gPGRpdiBjbGFzcz0id2FybmJveCI+PGI+WkVSTy1DT1NUIERPQ1RSSU5FIEZMQUcuPC9iPiBUaGlzIGRlbWFuZHMgJCR7Zy5jb3N0fS4gVGhlIENoYWlybWFuIGRvZXMgbm90IHBheS4gQXBwcm92aW5nIGlzIGFuIGV4cGxpY2l0IE93bmVyIG92ZXJyaWRlLiBGcmVlIHJvdXRlIG9uIHJlY29yZDogPGVtPiR7ZXNjKGcuZnJlZXx8J25vbmUnKX08L2VtPjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIDAgMTFweCI+PGgzPjEgwrcgT2JqZWN0aXZlPC9oMz48ZGl2PiR7ZXNjKGcub2JqKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MiDCtyBBZ2VudCBKdXN0aWZpY2F0aW9uPC9oMz48ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcCI+JHtlc2MoZy5qdXN0KX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjAgMCAxMXB4Ij48aDM+MyDCtyBTYWZlZ3VhcmRzICZhbXA7IFJvbGxiYWNrPC9oMz48ZGl2PiR7ZXNjKGcuc2FmZSl9PC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij48c3BhbiBjbGFzcz0idGFnICR7Zy5yaXNrPT09J0xPVyc/J3QtZ3JuJzondC1yZWQnfSI+QkxBU1QgJHtnLnJpc2t9PC9zcGFuPgogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5jb3N0Pyd0LXJlZCc6J3QtZ3JuJ30iPkNPU1QgJHtnLmNvc3Q/JyQnK2cuY29zdDonJDAuMDAnfTwvc3Bhbj4KICAgJHtnLmFtdD9gPHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+QVQgUklTSyAkJHtmbXQoZy5hbXQpfTwvc3Bhbj5gOicnfQogICA8c3BhbiBjbGFzcz0idGFnICR7Zy5zdGF0dXM9PT0nQVBQUk9WRUQnPyd0LWdybic6Zy5zdGF0dXM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke2cuc3RhdHVzfTwvc3Bhbj48L2Rpdj4KICAke2cuc3RhdHVzPT09J1BFTkRJTkcnP2A8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPjQgwrcgT3duZXIgY3J5cHRvZ3JhcGhpYyBjbGVhcmFuY2Ug4oCUIHJlLWVudGVyIHBhc3N3b3JkPC9zcGFuPgogICA8aW5wdXQgaWQ9ImdQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+PGRpdiBjbGFzcz0iZXJyIiBpZD0iZ0VyciI+PC9kaXY+CiAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiAke2ZpbkJsb2NrPydkaXNhYmxlZCc6Jyd9IG9uY2xpY2s9ImRlY2lkZSgnJHtnLmlkfScsMSkiPiR7Y29zdEJsb2NrPydPVkVSUklERSAmYW1wOyBBVVRIT1JJWkUnOidBVVRIT1JJWkUgRVhFQ1VUSU9OJ308L2J1dHRvbj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWNpZGUoJyR7Zy5pZH0nLDApIj5ERU5ZICZhbXA7IFRFUk1JTkFURTwvYnV0dG9uPgogICAke2Nvc3RCbG9jaz9gPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZXJvdXRlKCcke2cuaWR9JykiPlJFUk9VVEUgRlJFRTwvYnV0dG9uPmA6Jyd9CiAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmAKICA6YDxkaXYgY2xhc3M9InJvdyI+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj5SZXNvbHZlZCAke2VzYyhnLnJlc29sdmVkfHwnJyl9PC9zcGFuPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmB9YCk7Cn0KYXN5bmMgZnVuY3Rpb24gZGVjaWRlKGlkLG9rKXsKICBjb25zdCBlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnRXJyJyk7IGUudGV4dENvbnRlbnQ9Jyc7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvZ2F0ZS9kZWNpZGUnLHtpZCxvazohIW9rLHB3OmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnUHcnKS52YWx1ZX0pOwogICAgY2xvc2VNb2RhbCgpOyByZW5kZXIoKTsgZmxhc2goJ0dhdGUgJytpZCsnIHJlc29sdmVkJyk7CiAgfWNhdGNoKHgpeyBlLnRleHRDb250ZW50PXgubWVzc2FnZSB9Cn0KYXN5bmMgZnVuY3Rpb24gcmVyb3V0ZShpZCl7IGF3YWl0IEFQSSgnL2FwaS9nYXRlL3Jlcm91dGUnLHtpZH0pOyBjbG9zZU1vZGFsKCk7IHJlbmRlcigpOyBmbGFzaCgnUmVyb3V0ZWQgwrcgJDAuMDAnKSB9CgovKiAtLS0tLS0tLS0tIEFHRU5UUyAtLS0tLS0tLS0tICovClJFTkRFUi5hZ2VudHM9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db21taXNzaW9uIEFnZW50PC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5hbWU8L3NwYW4+PGlucHV0IGlkPSJhTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iTGVkZ2VyIFNlbnRpbmVsIj48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGlsbGFyPC9zcGFuPjxzZWxlY3QgaWQ9ImFQaWwiIGNsYXNzPSJpbiI+JHtQSUxMQVJTLm1hcChwPT5gPG9wdGlvbiB2YWx1ZT0iJHtwLmlkfSI+JHtwLmlkfSDCtyAke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3BlcmF0aW9uYWwgU2NvcGU8L3NwYW4+PHRleHRhcmVhIGlkPSJhUm9sZSIgY2xhc3M9ImluIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QZXJtaXR0ZWQgVG9vbHMgKGNvbW1hIHNlcGFyYXRlZCk8L3NwYW4+PGlucHV0IGlkPSJhVG9vbHMiIGNsYXNzPSJpbiI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkNvc3QgUG9saWN5PC9zcGFuPjxzZWxlY3QgaWQ9ImFDb3N0IiBjbGFzcz0iaW4iPgogICA8b3B0aW9uPkZSRUUtVElFUi1PTkxZPC9vcHRpb24+PG9wdGlvbj5TRUxGLUhPU1RFRC1PTkxZPC9vcHRpb24+PG9wdGlvbj5PV05FUi1PVkVSUklERS1QQUlEPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29tbWlzc2lvbigpIj5DT01NSVNTSU9OICZhbXA7IEJJTkQ8L2J1dHRvbj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Sb3N0ZXIgRGlzdHJpYnV0aW9uPC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpLG09TWF0aC5tYXgoMSwuLi5TLmZsb29ycy5tYXAoeD0+eC5hZ2VudHMpKTsKICAgcmV0dXJuIGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMS41cHgiPiR7cC5pY29ufSAke3AubmFtZX08L3NwYW4+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke2YuYWN0aXZlfS8ke2YuYWdlbnRzfTwvc3Bhbj48L2Rpdj4KICAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke2YuYWdlbnRzL20qMTAwfSU7YmFja2dyb3VuZDoke3AuY29sb3J9Ij48L2k+PC9kaXY+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BbGwgYWdlbnRzIGluaGVyaXQgdGhlIFplcm8tQ29zdCBEb2N0cmluZSB1bmxlc3Mgc2V0IHRvIE9XTkVSLU9WRVJSSURFLVBBSUQuPC9kaXY+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+QWN0aXZlIFJvc3RlciA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPiR7Uy5hZ2VudHMuZmlsdGVyKGE9PmEuc3RhdHVzPT09J0FDVElWRScpLmxlbmd0aH0gQUNUSVZFPC9zcGFuPjwvaDM+CiAke1MuYWdlbnRzLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5JRDwvdGg+PHRoPkFnZW50PC90aD48dGg+Rmxvb3I8L3RoPjx0aD5Ub29sczwvdGg+PHRoPkNvc3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAke1MuYWdlbnRzLm1hcChhPT57Y29uc3QgcD1QSUxMQVJTLmZpbmQoeD0+eC5pZD09YS5waWxsYXJJZCk7cmV0dXJuIGA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLmlkfTwvdGQ+CiAgPHRkPjxiPiR7ZXNjKGEubmFtZSl9PC9iPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhhLnJvbGUpfTwvZGl2PjwvdGQ+CiAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtwLmNsc30iPiR7cC5pY29ufSAke2EucGlsbGFySWR9PC9zcGFuPjwvdGQ+CiAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHthLnRvb2xzLm1hcChlc2MpLmpvaW4oJywgJyl9PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2EuY29zdD09PSdPV05FUi1PVkVSUklERS1QQUlEJz8ndC1hbWInOid0LWdybid9Ij4ke2EuY29zdH08L3NwYW4+PC90ZD4KICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2Euc3RhdHVzPT09J0FDVElWRSc/J3QtZ3JuJzondC1kaW0nfSI+JHthLnN0YXR1c308L3NwYW4+PC90ZD4KICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJzaG93WWFtbCgnJHthLmlkfScpIj5ZQU1MPC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0idG9nKCcke2EuaWR9JykiPiR7YS5zdGF0dXM9PT0nQUNUSVZFJz8nU3VzcGVuZCc6J1JlaW5zdGF0ZSd9PC9idXR0b24+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbCgnJHthLmlkfScpIj5LaWxsPC9idXR0b24+PC90ZD48L3RyPmB9KS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Um9zdGVyIGVtcHR5LjwvZGl2Pid9PC9kaXY+YDsKZnVuY3Rpb24geWFtbEZvcihhKXtjb25zdCBwPVBJTExBUlMuZmluZCh4PT54LmlkPT1hLnBpbGxhcklkKTsKIHJldHVybiBgQWdlbnRfRGVmaW5pdGlvbjoKICBOYW1lOiAiJHthLm5hbWV9IgogIFBpbGxhcjogIiR7cC5uYW1lfSIKICBSb2xlOiAiJHthLnJvbGV9IgogIFBlcm1pdHRlZF9Ub29sczogWyR7YS50b29scy5tYXAodD0+YCIke3R9ImApLmpvaW4oJywgJyl9XQogIFN1cGVydmlzb3I6ICJDaGFpcm1hbiBBZ2VudCBPUyIKICBBZ2VudF9JRDogIiR7YS5pZH0iCiAgQ29zdF9Qb2xpY3k6ICIke2EuY29zdH0iCiAgQ29tbWlzc2lvbmVkOiAiJHthLnR9IgogIEluc3RydWN0aW9uOiB8CiAgICBFeGVjdXRlIHRhc2tzIHN0cmljdGx5IHdpdGhpbiBzY29wZS4gUmVwb3J0IGFsbCBsb2dzLCBhbm9tYWxpZXMgYW5kCiAgICBjb21wbGV0aW9uIG1ldHJpY3MgZGlyZWN0bHkgdG8gdGhlIENoYWlybWFuIHRlcm1pbmFsLiBEbyBub3QgYXR0ZW1wdAogICAgdW5hcHByb3ZlZCBzaWRlIGVmZmVjdHMuCiAgICBaRVJPLUNPU1QgRE9DVFJJTkU6IG5ldmVyIHB1cmNoYXNlLCBzdWJzY3JpYmUsIG9yIGNvbnN1bWUgcGFpZCBjcmVkaXRzLgogICAgSWYgYSB0b29sLCBzaXRlIG9yIEFQSSBkZW1hbmRzIHBheW1lbnQsIGhhbHQsIGZpbmQgYSBmcmVlLCBvcGVuLXNvdXJjZSwKICAgIHNlbGYtaG9zdGVkIG9yIGZyZWUtdGllciBlcXVpdmFsZW50LCBhbmQgcmVwb3J0IHRoZSBzdWJzdGl0dXRpb24uCiAgICBFc2NhbGF0ZSB0byB0aGUgQ2hhaXJtYW4gb25seSBpZiBubyBsYXdmdWwgZnJlZSByb3V0ZSBleGlzdHMuCiAgICBBbnkgZGVwbG95bWVudCwgc2NoZW1hIGNoYW5nZSwgY29kZSBtb2RpZmljYXRpb24gb3IgZmluYW5jaWFsIHRyYW5zZmVyCiAgICBtdXN0IGJlIHJhaXNlZCBhcyBhIFBlcm1pc3Npb24gR2F0ZSBhbmQgZnJvemVuIHVudGlsIE93bmVyIGNsZWFyYW5jZS5gfQphc3luYyBmdW5jdGlvbiBjb21taXNzaW9uKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvYWdlbnQnLHtuYW1lOmFOYW1lLnZhbHVlLnRyaW0oKSxwaWxsYXJJZDorYVBpbC52YWx1ZSxyb2xlOmFSb2xlLnZhbHVlLnRyaW0oKSwKICAgIHRvb2xzOmFUb29scy52YWx1ZS5zcGxpdCgnLCcpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLGNvc3Q6YUNvc3QudmFsdWV9KTsKICAgcmVuZGVyKCk7IGZsYXNoKCdBZ2VudCBib3VuZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gc2hvd1lhbWwoaWQpe2NvbnN0IGE9Uy5hZ2VudHMuZmluZCh4PT54LmlkPT09aWQpOwogbW9kYWwoYDxoMz4ke2VzYyhhLm5hbWUpfTwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjExcHgiPiR7YS5pZH0gwrcgJHthLnN0YXR1c308L2Rpdj4KIDxwcmUgY2xhc3M9InlhbWwiPiR7ZXNjKHlhbWxGb3IoYSkpfTwvcHJlPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTNweCI+CiA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY29weVkoJyR7YS5pZH0nKSI+Q29weSBZQU1MPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCl9CmZ1bmN0aW9uIGNvcHlZKGlkKXtuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoeWFtbEZvcihTLmFnZW50cy5maW5kKHg9PnguaWQ9PT1pZCkpKTtmbGFzaCgnWUFNTCBjb3BpZWQnKX0KYXN5bmMgZnVuY3Rpb24gdG9nKGlkKXthd2FpdCBBUEkoJy9hcGkvYWdlbnQvdG9nZ2xlJyx7aWR9KTtyZW5kZXIoKX0KYXN5bmMgZnVuY3Rpb24ga2lsbChpZCl7aWYoIWNvbmZpcm0oJ0RlY29tbWlzc2lvbiAnK2lkKyc/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9hZ2VudC9raWxsJyx7aWR9KTtyZW5kZXIoKTtmbGFzaCgnRGVjb21taXNzaW9uZWQnKX0KCi8qIC0tLS0tLS0tLS0gT1JHIENIQVJUIC0tLS0tLS0tLS0gKi8KUkVOREVSLm9yZ2NoYXJ0PSgpPT5gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkNvbW1hbmQgRGVwZW5kZW5jeSBHcmFwaDwvaDM+PGRpdiBjbGFzcz0idHciPgogPHN2ZyB2aWV3Qm94PSIwIDAgOTAwIDQzMCIgc3R5bGU9Im1pbi13aWR0aDo3MjBweDt3aWR0aDoxMDAlIj4KICA8ZGVmcz48bWFya2VyIGlkPSJhciIgbWFya2VyV2lkdGg9IjkiIG1hcmtlckhlaWdodD0iOSIgcmVmWD0iOCIgcmVmWT0iMyIgb3JpZW50PSJhdXRvIj48cGF0aCBkPSJNMCwwIEwwLDYgTDgsMyB6IiBmaWxsPSJ2YXIoLS1zdHJva2UyKSIvPjwvbWFya2VyPjwvZGVmcz4KICA8cmVjdCB4PSIzMTUiIHk9IjE0IiB3aWR0aD0iMjcwIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9InZhcigtLWdsYXNzMikiIHN0cm9rZT0iIzc4OEExRCIvPgogIDx0ZXh0IHg9IjQ1MCIgeT0iMzgiIGZpbGw9IiM3ODhBMUQiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNIQUlSTUFOIEFHRU5UPC90ZXh0PgogIDx0ZXh0IHg9IjQ1MCIgeT0iNTUiIGZpbGw9IiM2QjZENjIiIGZvbnQtc2l6ZT0iOS41IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FeGVjdXRpdmUgQ29tbWFuZCBUb3dlciDCtyBaZXJvLUNvc3QgQXV0aG9yaXR5PC90ZXh0PgogICR7UElMTEFSUy5tYXAoKHAsaSk9Pntjb25zdCB5PTEwNCtpKjY0LGY9Zmxvb3IocC5pZCk7cmV0dXJuIGAKICAgPHBhdGggZD0iTTQ1MCw2NiBDNDUwLCR7eS0yMH0gMjUwLCR7eS0yMH0gMjUwLCR7eSsxOH0iIHN0cm9rZT0idmFyKC0tc3Ryb2tlMikiIGZpbGw9Im5vbmUiIG1hcmtlci1lbmQ9InVybCgjYXIpIi8+CiAgIDxyZWN0IHg9IjI1MCIgeT0iJHt5fSIgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0NiIgcng9IjkiIGZpbGw9InZhcigtLXBhbmVsKSIgc3Ryb2tlPSIke3AuY29sb3J9IiBzdHJva2Utb3BhY2l0eT0iLjciLz4KICAgPHRleHQgeD0iMjY4IiB5PSIke3krMjB9IiBmaWxsPSJ2YXIoLS10eHQpIiBmb250LXNpemU9IjExLjUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiPiR7cC5pY29ufSAke3AuaWR9LiAke3AubmFtZX08L3RleHQ+CiAgIDx0ZXh0IHg9IjI2OCIgeT0iJHt5KzM1fSIgZmlsbD0iIzZCNkQ2MiIgZm9udC1zaXplPSI5IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj4ke3AudW5pdHN9PC90ZXh0PgogICA8dGV4dCB4PSI2MzIiIHk9IiR7eSsyOH0iIGZpbGw9IiR7cC5jb2xvcn0iIGZvbnQtc2l6ZT0iMTAiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIHRleHQtYW5jaG9yPSJlbmQiPiR7Zi5hZ2VudHN9IGFndCDCtyAke2YuaGVhbHRofSU8L3RleHQ+YH0pLmpvaW4oJycpfQogIDxwYXRoIGQ9Ik02NjAsMTI3IEM3NTAsMTI3IDc1MCw0MTUgNDcwLDQxNSIgc3Ryb2tlPSJ2YXIoLS1zdHJva2UyKSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iNCA0IiBtYXJrZXItZW5kPSJ1cmwoI2FyKSIvPgogIDx0ZXh0IHg9IjcwNSIgeT0iMjg1IiBmaWxsPSIjOUE5QzkwIiBmb250LXNpemU9IjkuNSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+aW5zaWdodCDihpIgdG93ZXI8L3RleHQ+PC9zdmc+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXNjYWxhdGlvbiBMYXc8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5Fc2NhbGF0aW9uIGlzIHVwd2FyZCBvbmx5LiBObyBsYXRlcmFsIGZsb29yLXRvLWZsb29yIGNvbW1hbmQgd2l0aG91dCBhIENoYWlybWFuIGdhdGUuPC9saT4KICA8bGk+U2VjdXJpdHkgJmFtcDsgQXVkaXQgaG9sZHMgdmV0byBvdmVyIHRoZSByZW1haW5pbmcgZm91ciBmbG9vcnMgYW5kIG1heSBmcmVlemUgYW55IGdhdGUgbWlkLWZsaWdodC48L2xpPgogIDxsaT5ObyBwYXRoIGV4aXN0cyBmcm9tIGEgcHVibGljIHVzZXIgdG8gYSBmbG9vci4gRXZlcnkgcm91dGUgdGVybWluYXRlcyBhdCB0aGUgQ2hhaXJtYW4uPC9saT4KICA8bGk+QW55IGFnZW50IG1lZXRpbmcgYSBwYXl3YWxsIGhhbHRzIGFuZCByZXBvcnRzIHVwd2FyZCDigJQgaXQgbmV2ZXIgc3BlbmRzLjwvbGk+PC91bD48L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBTS0lMTFMgLS0tLS0tLS0tLSAqLwpSRU5ERVIuc2tpbGxzPSgpPT57Y29uc3QgbT17fTtTLmFnZW50cy5mb3JFYWNoKGE9PmEudG9vbHMuZm9yRWFjaCh0PT57KG1bdF09bVt0XXx8W10pLnB1c2goYS5uYW1lKX0pKTsKIGNvbnN0IGs9T2JqZWN0LmtleXMobSkuc29ydCgpOwogcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VG9vbCBTdXJmYWNlIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+JHtrLmxlbmd0aH0gRElTVElOQ1Q8L3NwYW4+PC9oMz4KIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMnB4Ij5FdmVyeSB0b29sIGlzIGJvdW5kIHRvIGF0IGxlYXN0IG9uZSBhZ2VudCBhbmQgY29uc3RyYWluZWQgYnkgdGhhdCBhZ2VudCdzIGNvc3QgcG9saWN5LiBVbmJvdW5kIGludm9jYXRpb24gaXMgYW4gdW5hcHByb3ZlZCBzaWRlIGVmZmVjdC48L2Rpdj4KIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+VG9vbDwvdGg+PHRoPkJvdW5kIEFnZW50czwvdGg+PHRoPkV4cG9zdXJlPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogJHtrLm1hcCh0PT5gPHRyPjx0ZD48YiBzdHlsZT0iY29sb3I6dmFyKC0tY3kpIj4ke2VzYyh0KX08L2I+PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke21bdF0ubWFwKGVzYykuam9pbignLCAnKX08L3RkPgogIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7bVt0XS5sZW5ndGg+Mj8ndC1hbWInOid0LWdybid9Ij4ke21bdF0ubGVuZ3RoPjI/J1dJREUnOidOQVJST1cnfTwvc3Bhbj48L3RkPjwvdHI+YCkuam9pbignJyl8fCc8dHI+PHRkIGNvbHNwYW49IjMiIGNsYXNzPSJtb25vLWRpbSI+bm9uZTwvdGQ+PC90cj4nfQogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9OwoKLyogLS0tLS0tLS0tLSBaRVJPIENPU1QgLS0tLS0tLS0tLSAqLwpSRU5ERVIuemVyb2Nvc3Q9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzY3NDcwZjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzE1MTAwYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1hbWIpIj7iiIUgWkVSTy1DT1NUIERPQ1RSSU5FIMK3IEFCU09MVVRFPC9oMz48dWwgY2xhc3M9InRpZ2h0Ij4KICAgPGxpPjxiPlRoZSBDaGFpcm1hbiBkb2VzIG5vdCBwYXkuPC9iPiBObyBzdWJzY3JpcHRpb25zLCBubyBjcmVkaXQgdG9wLXVwcywgbm8gbWV0ZXJlZCBBUEkgcHVyY2hhc2VzLCBubyBjb252ZXJ0aW5nIHRyaWFscy48L2xpPgogICA8bGk+SGl0dGluZyBhIHBheXdhbGwsIGFuIGFnZW50IDxiPmhhbHRzPC9iPiwgZmluZHMgYSBmcmVlIC8gb3Blbi1zb3VyY2UgLyBzZWxmLWhvc3RlZCAvIGZyZWUtdGllciBlcXVpdmFsZW50LCBhbmQgcmVwb3J0cyB0aGUgc3Vic3RpdHV0aW9uLjwvbGk+CiAgIDxsaT5ObyBmcmVlIHJvdXRlIOKHkiB0aGUgQ2hhaXJtYW4gc3RhdGVzIHBsYWlubHkgdGhlIG9iamVjdGl2ZSBpcyB1bnJlYWNoYWJsZSBhdCB6ZXJvIGNvc3QuIEl0IG5ldmVyIHF1aWV0bHkgc3BlbmRzLjwvbGk+CiAgIDxsaT5GcmVlLXRpZXIgcm90YXRpb24gYW5kIHF1b3RhIG1hbmFnZW1lbnQgYXJlIGxlZ2l0aW1hdGUuIEZyYXVkLCBzdG9sZW4ga2V5cywgbGljZW5jZSB2aW9sYXRpb24gYW5kIFRvUyBjaXJjdW12ZW50aW9uIGFyZSA8Yj5yZWZ1c2VkIG91dHJpZ2h0PC9iPiBhbmQgbG9nZ2VkIENSSVQuPC9saT4KICAgPGxpPk93bmVyIG1heSBvdmVycmlkZSBwZXItZ2F0ZS4gT3ZlcnJpZGVzIGhpdCBhIHZpc2libGUgc3BlbmQgY291bnRlciwgbmV2ZXIgaGlkZGVuLjwvbGk+CiAgIDxsaT48Yj5Qcm9vZiwgbm90IHNsb2dhbjo8L2I+IHRoaXMgYmFja2VuZCBydW5zIG9uIE5vZGUgY29yZSBtb2R1bGVzIG9ubHkg4oCUIDAgbnBtIHBhY2thZ2VzLCAwIHBhaWQgc2VydmljZXMsIDAgQVBJIGtleXMuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTRweCI+CiAgJHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnQXV0aG9yaXplZCBTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknLCdMaWZldGltZScpfQogICR7a3BpKFMuZGVuaWFscy5sZW5ndGgsJ1BhaWQgUGF0aHMgSW50ZXJjZXB0ZWQnLCd2YXIoLS1hbWIpJywnQmxvY2tlZCBvciByZXJvdXRlZCcpfQogICR7a3BpKCckJytTLmRlbmlhbHMucmVkdWNlKChhLGIpPT5hK2IuY29zdCwwKS50b0ZpeGVkKDIpLCdTcGVuZCBBdm9pZGVkJywndmFyKC0tZ3JuKScsJ0RvY3RyaW5lIHNhdmluZ3MnKX08L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5TdWJzdGl0dXRpb24gUm91dGluZyBUYWJsZTwvaDM+PGRpdiBjbGFzcz0idHciPjx0YWJsZT4KICA8dGhlYWQ+PHRyPjx0aD5QYWlkIERlbWFuZDwvdGg+PHRoPkZyZWUgUm91dGU8L3RoPjx0aD5Pd25pbmcgQWdlbnQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtGUkVFX1JPVVRFUy5tYXAoKFthLGIsY10pPT5gPHRyPjx0ZD48c3BhbiBjbGFzcz0idGFnIHQtcmVkIj4ke2VzYyhhKX08L3NwYW4+PC90ZD48dGQ+JHtlc2MoYil9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhjKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SW50ZXJjZXB0aW9uIExvZzwvaDM+JHtTLmRlbmlhbHMubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlRpbWU8L3RoPjx0aD5PcGVyYXRpb248L3RoPjx0aD5EZW1hbmRlZDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1suLi5TLmRlbmlhbHNdLnJldmVyc2UoKS5tYXAoZD0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2QudH08L3RkPjx0ZD4ke2VzYyhkLm9wKX08L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JCR7ZC5jb3N0fTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gcGFpZCBkZW1hbmRzIGVuY291bnRlcmVkIHlldC48L2Rpdj4nfTwvZGl2PmA7CgovKiAtLS0tLS0tLS0tIEZJTkFOQ0VTIC0tLS0tLS0tLS0gKi8KUkVOREVSLmZpbmFuY2VzPSgpPT57CiBjb25zdCB0b3Q9Uy5yZXZlbnVlLnJlZHVjZSgoYSxiKT0+YStiLmFtdCwwKSxpbmZsb3c9Uy5yZXZlbnVlLmZpbHRlcihyPT5yLmFtdD4wKS5yZWR1Y2UoKGEsYik9PmErYi5hbXQsMCk7CiByZXR1cm4gYCR7IVMucGF5b3V0P2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPlNBRkUgTU9ERTwvaDM+CiAgPGRpdj5ObyBwYXlvdXQgY2hhbm5lbCBzZWFsZWQuIFRoZSBzZXJ2ZXIgcmVqZWN0cyBhcHByb3ZhbCBvbiBldmVyeSB0cmFuc2ZlciBnYXRlLiBDb25maWd1cmUgdGhlIFZhdWx0IGZpcnN0LjwvZGl2PjwvZGl2PmA6Jyd9CiA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAke2twaSgnJCcrZm10KGluZmxvdyksJ1JlY29yZGVkIEluZmxvdycsJ3ZhcigtLWdybiknKX0KICAke2twaSgnJCcrZm10KHRvdCksJ05ldCBQb3NpdGlvbicsdG90PDA/J3ZhcigtLW1hZyknOid2YXIoLS10eHQpJyl9CiAgJHtrcGkoJyQnK1Muc3BlbmQudG9GaXhlZCgyKSwnVG90YWwgU3BlbmQnLFMuc3BlbmQ/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJywnVGFyZ2V0ICQwLjAwJyl9CiAgJHtrcGkoUy5yZXZlbnVlLmxlbmd0aCwnTGVkZ2VyIExpbmVzJywndmFyKC0tYmx1KScpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlY29yZCBSZXZlbnVlIFN0cmVhbTwvaDM+PGRpdiBjbGFzcz0iZ3JpZCBnMyI+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Tb3VyY2U8L3NwYW4+PGlucHV0IGlkPSJyU3JjIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJQcmVtaXVtIGNyZWRpdHMgwrcgYXBwLmV4YW1wbGUiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BbW91bnQgVVNEPC9zcGFuPjxpbnB1dCBpZD0ickFtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj4mbmJzcDs8L3NwYW4+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIHN0eWxlPSJ3aWR0aDoxMDAlIiBvbmNsaWNrPSJhZGRSZXYoKSI+UE9TVCBUTyBMRURHRVI8L2J1dHRvbj48L2xhYmVsPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJlcXVlc3QgUGF5b3V0PC9oMz4KICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5SYWlzZXMgYSBGSU5BTkNJQUwgVFJBTlNGRVIgZ2F0ZS4gUmVxdWlyZXMgc2VhbGVkIGNoYW5uZWwgKyBwYXNzd29yZCBzaWduYXR1cmUuIDJGQSB0YXJnZXQgJHttYXNrTWFpbChTLm93bmVyLmVtYWlsKX0uPC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgaWQ9InBBbXQiIGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMDBweCIgdHlwZT0ibnVtYmVyIiBwbGFjZWhvbGRlcj0iQW1vdW50IFVTRCI+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJlcVBheW91dCgpIj5SQUlTRSBUUkFOU0ZFUiBHQVRFPC9idXR0b24+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmV2ZW51ZSBMZWRnZXI8L2gzPiR7Uy5yZXZlbnVlLmxlbmd0aD9gPGRpdiBjbGFzcz0idHciPjx0YWJsZT48dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+U291cmNlPC90aD48dGggc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPkFtb3VudDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAke1suLi5TLnJldmVudWVdLnJldmVyc2UoKS5tYXAocj0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke3IudH08L3RkPjx0ZD4ke2VzYyhyLnNyYyl9PC90ZD4KICA8dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQ7Y29sb3I6JHtyLmFtdDwwPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKSd9Ij4ke3IuYW10PDA/Jy0nOicrJ30kJHtmbXQoTWF0aC5hYnMoci5hbXQpKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0cmVhbXMgcmVjb3JkZWQuPC9kaXY+J308L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gYWRkUmV2KCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9yZXZlbnVlJyx7c3JjOnJTcmMudmFsdWUudHJpbSgpLGFtdDorckFtdC52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdQb3N0ZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcmVxUGF5b3V0KCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9wYXlvdXQvcmVxdWVzdCcse2FtdDorcEFtdC52YWx1ZX0pO2dvKCdnYXRlcycpO2ZsYXNoKCdUcmFuc2ZlciBnYXRlIHJhaXNlZCcpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQoKLyogLS0tLS0tLS0tLSBWQVVMVCAtLS0tLS0tLS0tICovClJFTkRFUi5wYXlvdXQ9KCk9PmAKIDxkaXYgY2xhc3M9Indhcm5ib3giPklzb2xhdGVkIE93bmVyLW9ubHkgcGFuZWwuIFJhdyB2YWx1ZXMgYXJlIHNlbnQgb25jZSBvdmVyIHRoZSBzZXNzaW9uLCBtYXNrZWQgaW1tZWRpYXRlbHksIGFuZCA8Yj5uZXZlciBwZXJzaXN0ZWQgb3IgcmV0dXJuZWQ8L2I+IOKAlCBvbmx5IHRoZSBtYXNrZWQgdmlldyBhbmQgYSBTSEEtMjU2IGZpbmdlcnByaW50IGFyZSBzdG9yZWQuIFRoZSBDaGFpcm1hbiB3aWxsIG5ldmVyIHJlcXVlc3QgdGhlc2UgYW55d2hlcmUgZWxzZS48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5DaGFubmVsIENvbmZpZ3VyYXRpb248L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk1ldGhvZDwvc3Bhbj48c2VsZWN0IGlkPSJ2VHlwZSIgY2xhc3M9ImluIiBvbmNoYW5nZT0idlN3YXAoKSI+CiAgICA8b3B0aW9uIHZhbHVlPSJCQU5LIj5CYW5rIFdpcmUgKFNXSUZUL0lCQU4pPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iQ1JZUFRPIj5DcnlwdG8gQWRkcmVzczwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+QmVuZWZpY2lhcnkgTmFtZTwvc3Bhbj48aW5wdXQgaWQ9InZOYW1lIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPjwvZGl2PgogIDxkaXYgaWQ9InZCYW5rIj48ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BY2NvdW50IE51bWJlcjwvc3Bhbj48aW5wdXQgaWQ9InZBY2MiIGNsYXNzPSJpbiIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+SUJBTjwvc3Bhbj48aW5wdXQgaWQ9InZJYmFuIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNXSUZUIC8gQklDPC9zcGFuPjxpbnB1dCBpZD0idlN3aWZ0IiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkJhbmsgJmFtcDsgQ291bnRyeTwvc3Bhbj48aW5wdXQgaWQ9InZCYW5rTmFtZSIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj48L2Rpdj4KICA8ZGl2IGlkPSJ2Q3J5cHRvIiBjbGFzcz0iaGlkZSI+PGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+TmV0d29yazwvc3Bhbj48aW5wdXQgaWQ9InZOZXQiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9IkJUQyAvIEVUSCAvIFRST04iPjwvbGFiZWw+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+UGF5b3V0IEFkZHJlc3M8L3NwYW4+PGlucHV0IGlkPSJ2QWRkciIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD48L2Rpdj48L2Rpdj4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBlci1UcmFuc2ZlciBDZWlsaW5nIChVU0QpPC9zcGFuPjxpbnB1dCBpZD0idkNhcCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSIyNTAwMCI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZWFsVmF1bHQoKSI+U0VBTCBDSEFOTkVMPC9idXR0b24+CiAgJHtTLnBheW91dD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVZhdWx0KCkiPlB1cmdlIENoYW5uZWw8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNlYWxlZCBDaGFubmVsPC9oMz4ke1MucGF5b3V0P2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAke09iamVjdC5lbnRyaWVzKFMucGF5b3V0Lm1hc2tlZCkubWFwKChbayx2XSk9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij4ke2VzYyhrKX08L3RkPjx0ZD4ke2VzYyh2KX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPlNlYWxlZDwvdGQ+PHRkPiR7Uy5wYXlvdXQudH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjJGQSBUYXJnZXQ8L3RkPjx0ZD4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvdGQ+PC90cj48L3Rib2R5PjwvdGFibGU+PC9kaXY+YAogOic8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIENIQU5ORUwgU0VBTEVEIOKAlCBlbmdpbmUgU0FGRSBNT0RFLjwvZGl2Pid9PC9kaXY+YDsKZnVuY3Rpb24gdlN3YXAoKXtjb25zdCBjPXZUeXBlLnZhbHVlPT09J0NSWVBUTyc7dkJhbmsuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsYyk7dkNyeXB0by5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJywhYyl9CmFzeW5jIGZ1bmN0aW9uIHNlYWxWYXVsdCgpewogY29uc3QgYj17dHlwZTp2VHlwZS52YWx1ZSxuYW1lOnZOYW1lLnZhbHVlLnRyaW0oKSxjYXA6K3ZDYXAudmFsdWV8fDAsCiAgYWNjOnZBY2M/LnZhbHVlLnRyaW0oKSxpYmFuOnZJYmFuPy52YWx1ZS50cmltKCksc3dpZnQ6dlN3aWZ0Py52YWx1ZS50cmltKCksYmFuazp2QmFua05hbWU/LnZhbHVlLnRyaW0oKSwKICBuZXQ6dk5ldD8udmFsdWUudHJpbSgpLGFkZHI6dkFkZHI/LnZhbHVlLnRyaW0oKX07CiB0cnl7YXdhaXQgQVBJKCcvYXBpL3ZhdWx0JyxiKTtyZW5kZXIoKTtmbGFzaCgnQ2hhbm5lbCBzZWFsZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VWYXVsdCgpe2lmKCFjb25maXJtKCdQdXJnZSBjaGFubmVsPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvdmF1bHQvcHVyZ2UnKTtyZW5kZXIoKTtmbGFzaCgnUHVyZ2VkJyl9CgovKiAtLS0tLS0tLS0tIEFOQUxZVElDUyAtLS0tLS0tLS0tICovClJFTkRFUi5hbmFseXRpY3M9KCk9PnsKIGNvbnN0IHNldj17SU5GTzowLE9LOjAsV0FSTjowLENSSVQ6MH07Uy5sb2dzLmZvckVhY2gobD0+c2V2W2wuc2V2XT0oc2V2W2wuc2V2XXx8MCkrMSk7CiBjb25zdCBteD1NYXRoLm1heCgxLC4uLk9iamVjdC52YWx1ZXMoc2V2KSk7CiByZXR1cm4gYDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkV2ZW50IFNldmVyaXR5IE1peDwvaDM+JHtPYmplY3QuZW50cmllcyhzZXYpLm1hcCgoW2ssdl0pPT5gPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PHNwYW4+JHtrfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7dn08L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0iYmFyIiBzdHlsZT0ibWFyZ2luLXRvcDo0cHgiPjxpIHN0eWxlPSJ3aWR0aDoke3YvbXgqMTAwfSU7YmFja2dyb3VuZDoke3tJTkZPOicjM2I4MmY2JyxPSzonIzMxZDY3YScsV0FSTjonI2ZmYjAyMCcsQ1JJVDonI2ZmM2I2Yid9W2tdfSI+PC9pPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpfTwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdhdGUgT3V0Y29tZXM8L2gzPiR7WydQRU5ESU5HJywnQVBQUk9WRUQnLCdERU5JRUQnXS5tYXAocz0+e2NvbnN0IGM9Uy5nYXRlcy5maWx0ZXIoZz0+Zy5zdGF0dXM9PT1zKS5sZW5ndGg7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjdweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICMxMDE4MjIiPgogIDxzcGFuIGNsYXNzPSJ0YWcgJHtzPT09J0FQUFJPVkVEJz8ndC1ncm4nOnM9PT0nREVOSUVEJz8ndC1yZWQnOid0LWFtYid9Ij4ke3N9PC9zcGFuPjxiPiR7Y308L2I+PC9kaXY+YH0pLmpvaW4oJycpfQogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5BcHByb3ZhbCByYXRlIGlzIG1lYW5pbmdsZXNzIHdpdGhvdXQgZGVuaWFsIHByZXNzdXJlLiBJZiBub3RoaW5nIGlzIGV2ZXIgZGVuaWVkLCB0aGUgZ2F0ZSBpcyB0aGVhdHJlLjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkZsb29yIEhlYWx0aCA8c3BhbiBjbGFzcz0idGFnIHQtY3kiPkxJVkU8L3NwYW4+PC9oMz4KICAke1BJTExBUlMubWFwKHA9Pntjb25zdCBmPWZsb29yKHAuaWQpO3JldHVybiBgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExLjVweCI+JHtwLmljb259ICR7cC5uYW1lfTwvc3Bhbj48c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7Zi5oZWFsdGh9JTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXJnaW4tdG9wOjRweCI+PGkgc3R5bGU9IndpZHRoOiR7Zi5oZWFsdGh9JTtiYWNrZ3JvdW5kOiR7cC5jb2xvcn0iPjwvaT48L2Rpdj48L2Rpdj5gfSkuam9pbignJyl9PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29zdCBEaXNjaXBsaW5lPC9oMz4ke2twaSgnJCcrUy5zcGVuZC50b0ZpeGVkKDIpLCdTcGVuZCcsUy5zcGVuZD8ndmFyKC0tbWFnKSc6J3ZhcigtLWdybiknKX0KICA8ZGl2IHN0eWxlPSJoZWlnaHQ6MTBweCI+PC9kaXY+JHtrcGkoJyQnK1MuZGVuaWFscy5yZWR1Y2UoKGEsYik9PmErYi5jb3N0LDApLnRvRml4ZWQoMiksJ0F2b2lkZWQnLCd2YXIoLS1ncm4pJyl9PC9kaXY+CiA8L2Rpdj5gfTsKCi8qIC0tLS0tLS0tLS0gQVVESVQgLS0tLS0tLS0tLSAqLwpSRU5ERVIuYXVkaXQ9KCk9PmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjExcHgiPgogPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke1MubG9ncy5sZW5ndGh9IGVudHJpZXMgc2hvd24gwrcgcGVyc2lzdGVkIHNlcnZlci1zaWRlPC9zcGFuPgogPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9ImV4cG9ydExvZygpIj5FeHBvcnQgSlNPTjwvYnV0dG9uPgogPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJwdXJnZUxvZ3MoKSI+UHVyZ2U8L2J1dHRvbj48L2Rpdj48L2Rpdj4ke2xvZ0h0bWwoNDAwKX08L2Rpdj5gOwpmdW5jdGlvbiBleHBvcnRMb2coKXtjb25zdCBiPW5ldyBCbG9iKFtKU09OLnN0cmluZ2lmeShTLmxvZ3MsbnVsbCwyKV0se3R5cGU6J2FwcGxpY2F0aW9uL2pzb24nfSksdT1VUkwuY3JlYXRlT2JqZWN0VVJMKGIpLGE9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpOwogYS5ocmVmPXU7YS5kb3dubG9hZD0nY2hhaXJtYW4tYXVkaXQtJytEYXRlLm5vdygpKycuanNvbic7YS5jbGljaygpO1VSTC5yZXZva2VPYmplY3RVUkwodSk7Zmxhc2goJ0V4cG9ydGVkJyl9CmFzeW5jIGZ1bmN0aW9uIHB1cmdlTG9ncygpe2lmKCFjb25maXJtKCdQdXJnZSBsZWRnZXI/JykpcmV0dXJuO2F3YWl0IEFQSSgnL2FwaS9sb2dzL3B1cmdlJyk7cmVuZGVyKCl9CgovKiAtLS0tLS0tLS0tIE1JU1NJT05TOiBoZSBndWlkZXMsIHlvdSBleGVjdXRlIC0tLS0tLS0tLS0gKi8KTElWRS5taXNzaW9ucz0oKT0+ewogIGNvbnN0IE09Uy5taXNzaW9uc3x8W10sIG9wZW49TS5maWx0ZXIobT0+bS5zdGF0dXM9PT0nT1BFTicpLCBkb25lPU0uZmlsdGVyKG09Pm0uc3RhdHVzPT09J0RPTkUnKTsKICBjb25zdCBtaW5zPW9wZW4ucmVkdWNlKChhLG0pPT5hKyhtLm1pbnV0ZXN8fDApLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKG9wZW4ubGVuZ3RoLCdPcGVuIE1pc3Npb25zJyxvcGVuLmxlbmd0aD8ndmFyKC0tYW1iKSc6J3ZhcigtLWdybiknLG1pbnM/J34nK21pbnMrJyBtaW4gdG90YWwnOidub3RoaW5nIHBlbmRpbmcnKX0KICAgJHtrcGkoZG9uZS5sZW5ndGgsJ0NvbXBsZXRlZCcsJ3ZhcigtLWdybiknLCdsaWZldGltZScpfQogICAke2twaSgoUy5wbGF5Ym9va3N8fFtdKS5sZW5ndGgsJ1BsYXlib29rcycsJ3ZhcigtLWN5KScsJ3N0ZXAtYnktc3RlcCBndWlkZXMnKX0KICAgJHtrcGkoUy52ZW50dXJlcyYmUy52ZW50dXJlcy5sZW5ndGg/ZXNjKFMudmVudHVyZXNbMF0udGl0bGUpLnNsaWNlKDAsMTgpOidub25lJywnQWN0aXZlIFZlbnR1cmUnLCd2YXIoLS1wdXIpJywnJyl9PC9kaXY+CiAgJHtvcGVuLmxlbmd0aD9vcGVuLm1hcChtPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNjc0NzBmIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206N3B4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1hbWIiPkRPIFRISVM8L3NwYW4+PGIgc3R5bGU9ImZvbnQtc2l6ZToxNHB4Ij4ke2VzYyhtLnRpdGxlKX08L2I+PC9kaXY+CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5+JHttLm1pbnV0ZXN9IG1pbjwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4O2NvbG9yOiNiM2MxZDEiPiR7ZXNjKG0ud2h5KX08L2Rpdj4KICAgICR7bS5zdGVwcy5sZW5ndGg/YDxvbCBzdHlsZT0ibWFyZ2luOjAgMCAxMHB4O3BhZGRpbmctbGVmdDoyMHB4O2ZvbnQtc2l6ZToxMi41cHg7bGluZS1oZWlnaHQ6MS43NSI+CiAgICAgICR7bS5zdGVwcy5tYXAocz0+YDxsaT4ke2VzYyhzKX08L2xpPmApLmpvaW4oJycpfTwvb2w+YDonJ30KICAgICR7bS5zY3JpcHQ/YDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6IzA2MjIyYTtib3JkZXI6MXB4IHNvbGlkICMxNTVlNmI7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4O21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPkNPUFkgVEhFU0UgRVhBQ1QgV09SRFM6PC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNiIgaWQ9InNjcl8ke20uaWR9Ij4ke2VzYyhtLnNjcmlwdCl9PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBwIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiIG9uY2xpY2s9ImNvcHlTY3JpcHQoJyR7bS5pZH0nKSI+Q29weSBtZXNzYWdlPC9idXR0b24+PC9kaXY+YDonJ30KICAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTIwcHgiPkRvbmUgd2hlbjwvdGQ+PHRkPiR7ZXNjKG0uZG9uZVdoZW4pfTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+TGlrZWx5IGJsb2NrZXI8L3RkPjx0ZCBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+JHtlc2MobS5yaXNrKX08L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxzcGFuPldoYXQgaGFwcGVuZWQ/IChoZSBhZGFwdHMgdGhlIG5leHQgbWlzc2lvbiB0byB0aGlzKTwvc3Bhbj4KICAgICA8aW5wdXQgY2xhc3M9ImluIiBpZD0ibm90ZV8ke20uaWR9IiBwbGFjZWhvbGRlcj0iZS5nLiBzZW50IHRvIDQgc2hvcHMsIDEgcmVwbGllZCBhc2tpbmcgcHJpY2UiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0iZGVicmllZignJHttLmlkfScsJ2RvbmUnKSI+TUFSSyBET05FPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWJyaWVmKCcke20uaWR9Jywnc2tpcCcpIj5Ta2lwIHRoaXM8L2J1dHRvbj48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6YDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBvcGVuIG1pc3Npb25zLiBQcmVzcyBHRVQgTVkgTkVYVCBNSVNTSU9OUyBhbmQgaGUgd2lsbCB0ZWxsIHlvdSBleGFjdGx5IHdoYXQgdG8gZG8gdG9kYXkuPC9kaXY+PC9kaXY+YH0KICAke2RvbmUubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29tcGxldGVkIDxzcGFuIGNsYXNzPSJ0YWcgdC1ncm4iPiR7ZG9uZS5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPk1pc3Npb248L3RoPjx0aD5PdXRjb21lPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke2RvbmUuc2xpY2UoMCwxNSkubWFwKG09PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttLmNsb3NlZHx8bS50fTwvdGQ+PHRkPiR7ZXNjKG0udGl0bGUpfTwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhtLm91dGNvbWV8fCcnKX08L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj48L2Rpdj5gOicnfQogICR7KFMucGxheWJvb2tzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UGxheWJvb2tzPC9oMz4KICAgJHtTLnBsYXlib29rcy5tYXAoKHAsaSk9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tY3kpO3BhZGRpbmctbGVmdDoxMXB4O21hcmdpbi1ib3R0b206MTNweCI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiI+PGI+JHtlc2MocC50b3BpYyl9PC9iPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weVBiKCR7aX0pIj5Db3B5PC9idXR0b24+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1O2ZvbnQtc2l6ZToxMi41cHg7bWFyZ2luLXRvcDo2cHgiPiR7ZXNjKHAudGV4dCl9PC9kaXY+PC9kaXY+YCkuam9pbignJyl9CiAgIDwvZGl2PmA6Jyd9YDsKfTsKUkVOREVSLm1pc3Npb25zPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2NzQ3MGY7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNTEwMGEsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+4peOIE1ZIE1JU1NJT05TIOKAlCBIRSBQTEFOUywgWU9VIEVYRUNVVEU8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgY2Fubm90IHJlZ2lzdGVyIGNvbXBhbmllcywgcGxhY2UgYWRzIG9yIHRhbGsgdG8gY3VzdG9tZXJzLiBTbyBoZSBkb2VzIHRoZSBuZXh0IGJlc3QgdGhpbmc6IGJyZWFrcyB0aGUgcGF0aCBpbnRvIDxiPnNpbmdsZSBhY3Rpb25zIHlvdSBjYW4gZmluaXNoIHRvZGF5PC9iPiwgd3JpdGVzIHRoZSBleGFjdCB3b3JkcyB0byBzZW5kLCBhbmQgYWRhcHRzIGJhc2VkIG9uIHdoYXQgYWN0dWFsbHkgaGFwcGVuZWQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImdldE1pc3Npb25zKCkiPkdFVCBNWSBORVhUIE1JU1NJT05TPC9idXR0b24+CiAgICR7KFMubWlzc2lvbnN8fFtdKS5zb21lKG09Pm0uc3RhdHVzIT09J09QRU4nKT8nPGJ1dHRvbiBjbGFzcz0iYnRuIHNtIG5vIiBvbmNsaWNrPSJjbGVhck1pc3Npb25zKCkiPkNsZWFyIGhpc3Rvcnk8L2J1dHRvbj4nOicnfTwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+CiAgIDxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MzQwcHgiIGlkPSJwYlRvcGljIiBwbGFjZWhvbGRlcj0iUGxheWJvb2sgdG9waWMg4oCUIGUuZy4gaG93IHRvIHJlZ2lzdGVyIGEgc29sZSBwcm9wcmlldG9yc2hpcCBpbiBQdW5qYWIiPgogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9Im1ha2VQYigpIj5XUklURSBQTEFZQk9PSzwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPlBsYXlib29rIGlkZWFzOiBnZXR0aW5nIGEgUmF6b3JwYXkgYWNjb3VudCDCtyBHU1QgZm9yIGZyZWVsYW5jZXJzIGluIEluZGlhIMK3IGZpbmRpbmcgc2hvcCBvd25lcnMnIG51bWJlcnMgbGVnYWxseSDCtyB3cml0aW5nIGEgZmlyc3QgaW52b2ljZTwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9Im1pc3Npb25zIj4ke0xJVkUubWlzc2lvbnMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBnZXRNaXNzaW9ucygpeyBmbGFzaCgnQ2hhaXJtYW4gaXMgcGxhbm5pbmcgeW91ciBuZXh0IG1vdmVz4oCmJyk7CiAgdHJ5eyBjb25zdCB2PShTLnZlbnR1cmVzfHxbXSlbMF07CiAgICBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9taXNzaW9uL2dlbmVyYXRlJyx7dmVudHVyZUlkOnY/di5pZDpudWxsfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5hZGRlZCsnIG1pc3Npb24ocykgaXNzdWVkJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQpmdW5jdGlvbiBjb3B5U2NyaXB0KGlkKXsgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njcl8nK2lkKTsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoZWw/ZWwuaW5uZXJUZXh0OicnKTsgZmxhc2goJ01lc3NhZ2UgY29waWVkIOKAlCBub3cgc2VuZCBpdCcpIH0KZnVuY3Rpb24gY29weVBiKGkpeyBuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQoKFMucGxheWJvb2tzfHxbXSlbaV0udGV4dCk7IGZsYXNoKCdQbGF5Ym9vayBjb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGRlYnJpZWYoaWQsb3V0Y29tZSl7CiAgY29uc3Qgbm90ZT0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25vdGVfJytpZCl8fHt9KS52YWx1ZXx8Jyc7CiAgaWYob3V0Y29tZT09PSdkb25lJyYmIW5vdGUudHJpbSgpKSByZXR1cm4gZmxhc2goJ1dyaXRlIHdoYXQgaGFwcGVuZWQgZmlyc3Qg4oCUIGhlIG5lZWRzIGl0IHRvIHBsYW4gdGhlIG5leHQgc3RlcCcpOwogIGZsYXNoKCdSZWNvcmRpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL21pc3Npb24vZGVicmllZicse2lkLG91dGNvbWUsbm90ZX0pOyByZW5kZXIoKTsKICAgIGlmKHIuYWR2aWNlKSBtb2RhbChgPGgzPkRlYnJpZWY8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKHIuYWR2aWNlKX08L2Rpdj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iY2xvc2VNb2RhbCgpO2dldE1pc3Npb25zKCkiPk5leHQgbWlzc2lvbnMg4oaSPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogICAgZWxzZSBmbGFzaCgnU2tpcHBlZCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gbWFrZVBiKCl7IGNvbnN0IHQ9cGJUb3BpYy52YWx1ZS50cmltKCk7IGlmKCF0KSByZXR1cm4gZmxhc2goJ1R5cGUgYSB0b3BpYycpOwogIGZsYXNoKCdXcml0aW5nIHBsYXlib29r4oCmJyk7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbWlzc2lvbi9wbGF5Ym9vaycse3RvcGljOnR9KTsgcmVuZGVyKCk7IGZsYXNoKCdQbGF5Ym9vayByZWFkeScpIH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KCi8qIC0tLS0tLS0tLS0gQ09NTUFORCBDT05TT0xFIC0tLS0tLS0tLS0gKi8KTElWRS5jb21tYW5kPSgpPT57CiAgY29uc3QgQz1TLmNoYXR8fFtdOwogIHJldHVybiBDLmxlbmd0aD9DLm1hcChtPT5gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweDtib3JkZXItY29sb3I6JHsKICAgICBtLndobz09PSdPV05FUic/JyMyMjM0NGEnOm0ud2hvPT09J0NIQUlSTUFOJz8nIzE1NWU2Yic6JyM2YjIyMzMnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjZweCI+CiAgICAgPHNwYW4gY2xhc3M9InRhZyAke20ud2hvPT09J09XTkVSJz8ndC1ibHUnOm0ud2hvPT09J0NIQUlSTUFOJz8ndC1jeSc6J3QtcmVkJ30iPiR7bS53aG99PC9zcGFuPgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHttLnR9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0id2hpdGUtc3BhY2U6cHJlLXdyYXA7bGluZS1oZWlnaHQ6MS42Ij4ke2VzYyhtLnRleHQpfTwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG9yZGVycyBnaXZlbiB5ZXQuIFRlbGwgdGhlIENoYWlybWFuIHdoYXQgeW91IHdhbnQuPC9kaXY+PC9kaXY+JzsKfTsKUkVOREVSLmNvbW1hbmQ9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzE1NWU2YjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzA2MjIyYSwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPuKWriBDT01NQU5EIENPTlNPTEUg4oCUIEhFIEFOU1dFUlMgT05MWSBUTyBZT1U8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+R2l2ZSBvcmRlcnMgaW4gcGxhaW4gRW5nbGlzaC4gSGUgcmVwbGllcyB3aXRoIHdoYXQgaGUgd2lsbCBkbywgd2hhdCBoZSBuZWVkcyBmcm9tIHlvdSwgYW5kIHdoYXQgaGUgY2Fubm90IGRvLiBFdmVyeXRoaW5nIGhlcmUgaXMgbG9nZ2VkIGFuZCBzdXJ2aXZlcyByZXN0YXJ0cy48L2Rpdj4KICAkeyFTLmxsbT8nPGRpdiBjbGFzcz0id2FybmJveCIgc3R5bGU9ImJvcmRlci1jb2xvcjp2YXIoLS1tYWcpO2JhY2tncm91bmQ6IzE4MDgwOTtjb2xvcjojZmZiM2MwIj5ObyBBSSBicmFpbiBjb25uZWN0ZWQg4oCUIGhlIGNhbm5vdCBhbnN3ZXIuIENvbm5lY3Qgb25lIG9uIHRoZSBBSSBCcmFpbiBwYWdlLjwvZGl2Pic6Jyd9CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Zb3VyIG9yZGVyPC9zcGFuPjx0ZXh0YXJlYSBpZD0iY21kVGV4dCIgY2xhc3M9ImluIiBzdHlsZT0ibWluLWhlaWdodDo4MHB4IgogICAgcGxhY2Vob2xkZXI9ImUuZy4gRmluZCBtZSB0aHJlZSB3YXlzIHRvIGVhcm4gZnJvbSB3aGF0IEkgb3duLCByZXNlYXJjaCB0aGUgYmVzdCBvbmUsIGFuZCBidWlsZCB0aGUgYWdlbnQgdGVhbS4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJzZW5kQ21kKCkiPlNFTkQgT1JERVI8L2J1dHRvbj4KICAgJHsoUy5jaGF0fHxbXSkubGVuZ3RoPyc8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImNsZWFyQ21kKCkiPkNsZWFyIGxvZzwvYnV0dG9uPic6Jyd9PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0iY29tbWFuZCI+JHtMSVZFLmNvbW1hbmQoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBzZW5kQ21kKCl7CiAgY29uc3QgdD1jbWRUZXh0LnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhbiBvcmRlciBmaXJzdCcpOwogIGZsYXNoKCdDaGFpcm1hbiBpcyB0aGlua2luZ+KApicpOyBjbWRUZXh0LnZhbHVlPScnOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL2NvbW1hbmQnLHt0ZXh0OnR9KTsgcmVuZGVyKCk7IH0KICBjYXRjaChlKXsgcmVuZGVyKCk7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyQ21kKCl7IGF3YWl0IEFQSSgnL2FwaS9jb21tYW5kL2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gVkVOVFVSRVMgLS0tLS0tLS0tLSAqLwpMSVZFLnZlbnR1cmVzPSgpPT57CiAgY29uc3QgST1TLmlkZWFzfHxbXSwgVj1TLnZlbnR1cmVzfHxbXTsKICBjb25zdCByYXc9SS5maWx0ZXIoaT0+aS5zdGF0dXM9PT0nUkFXJykubGVuZ3RoOwogIGNvbnN0IGRvbmU9SS5maWx0ZXIoaT0+aS5zdGF0dXM9PT0nUkVTRUFSQ0hFRCcpOwogIGNvbnN0IGJlc3Q9ZG9uZS5zbGljZSgpLnNvcnQoKGEsYik9PihiLnNjb3JlfHwwKS0oYS5zY29yZXx8MCkpWzBdOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKEkubGVuZ3RoLCdJZGVhcyBHZW5lcmF0ZWQnLCd2YXIoLS1jeSknLHJhdysnIGF3YWl0aW5nIHJlc2VhcmNoJyl9CiAgICR7a3BpKGRvbmUubGVuZ3RoLCdSZXNlYXJjaGVkJywndmFyKC0tcHVyKScsJ2FnYWluc3QgbGl2ZSB3ZWIgZGF0YScpfQogICAke2twaShiZXN0P2Jlc3Quc2NvcmUrJy8xMDAnOifigJQnLCdCZXN0IFNjb3JlJyxiZXN0JiZiZXN0LnNjb3JlPj02MD8ndmFyKC0tZ3JuKSc6J3ZhcigtLWFtYiknLGJlc3Q/ZXNjKGJlc3QudGl0bGUpLnNsaWNlKDAsMjYpOidub25lIHlldCcpfQogICAke2twaShWLmxlbmd0aCwnVmVudHVyZXMgTGF1bmNoZWQnLCd2YXIoLS1ncm4pJywnd2l0aCByZWFsIGFnZW50IHRlYW1zJyl9PC9kaXY+CiAgJHtWLmxlbmd0aD9gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgVmVudHVyZXM8L2gzPgogICAke1YubWFwKHY9PmA8ZGl2IHN0eWxlPSJib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tZ3JuKTtwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjE0cHgiPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW4iPjxiPiR7ZXNjKHYudGl0bGUpfTwvYj4KICAgICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPiR7di5hZ2VudHMubGVuZ3RofSBhZ2VudHMgwrcgZmlyc3QgcnVwZWUgaW4gfiR7di53ZWVrc313PC9zcGFuPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW46NXB4IDAiPiR7ZXNjKHYucmV2ZW51ZVBhdGgpfTwvZGl2PgogICAgJHt2Lm93bmVyU3RlcHMubGVuZ3RoP2A8ZGl2IHN0eWxlPSJmb250LXNpemU6MTEuNXB4Ij48YiBzdHlsZT0iY29sb3I6dmFyKC0tYW1iKSI+WU9VUiBTVEVQUyAob25seSBhIGh1bWFuIGNhbiBkbyB0aGVzZSk6PC9iPgogICAgIDxvbCBzdHlsZT0ibWFyZ2luOjVweCAwIDA7cGFkZGluZy1sZWZ0OjE5cHgiPiR7di5vd25lclN0ZXBzLm1hcChzPT5gPGxpPiR7ZXNjKHMpfTwvbGk+YCkuam9pbignJyl9PC9vbD48L2Rpdj5gOicnfQogICA8L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gOicnfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5JZGVhIFBpcGVsaW5lIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7SS5sZW5ndGh9PC9zcGFuPjwvaDM+CiAgICR7SS5sZW5ndGg/SS5tYXAoaT0+YDxkaXYgc3R5bGU9ImJvcmRlci1sZWZ0OjNweCBzb2xpZCAkewogICAgICBpLnN0YXR1cz09PSdMQVVOQ0hFRCc/J3ZhcigtLWdybiknOmkuc3RhdHVzPT09J0tJTExFRCc/J3ZhcigtLWRpbTIpJzoKICAgICAgaS52ZXJkaWN0PT09J1BVUlNVRSc/J3ZhcigtLWN5KSc6aS52ZXJkaWN0PT09J0tJTEwnPyd2YXIoLS1tYWcpJzondmFyKC0tYW1iKSd9OwogICAgICBwYWRkaW5nLWxlZnQ6MTFweDttYXJnaW4tYm90dG9tOjEzcHg7JHtpLnN0YXR1cz09PSdLSUxMRUQnPydvcGFjaXR5Oi40NSc6Jyd9Ij4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxiPiR7ZXNjKGkudGl0bGUpfTwvYj4KICAgICAgJHtpLnNjb3JlIT1udWxsP2A8c3BhbiBjbGFzcz0idGFnICR7aS5zY29yZT49NjA/J3QtZ3JuJzppLnNjb3JlPj00MD8ndC1hbWInOid0LXJlZCd9Ij4ke2kuc2NvcmV9LzEwMDwvc3Bhbj5gOicnfQogICAgICAke2kudmVyZGljdD9gPHNwYW4gY2xhc3M9InRhZyAke2kudmVyZGljdD09PSdQVVJTVUUnPyd0LWN5JzppLnZlcmRpY3Q9PT0nS0lMTCc/J3QtcmVkJzondC1kaW0nfSI+JHtpLnZlcmRpY3R9PC9zcGFuPmA6Jyd9CiAgICAgIDxzcGFuIGNsYXNzPSJ0YWcgdC1kaW0iPiR7aS5zdGF0dXN9PC9zcGFuPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+4oK5JHtmbXQoaS5wcmljZSl9PC9zcGFuPjwvZGl2PgogICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7bWFyZ2luOjRweCAwIj4ke2VzYyhpLndoYXQpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iPkJ1eWVyOiAke2VzYyhpLmJ1eWVyKX08L2Rpdj4KICAgICR7aS5yZXNlYXJjaD9gPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMGExMTE5O2JvcmRlci1yYWRpdXM6N3B4O3BhZGRpbmc6OXB4O21hcmdpbi10b3A6N3B4O2ZvbnQtc2l6ZToxMS41cHgiPgogICAgICA8ZGl2PiR7ZXNjKGkucmVzZWFyY2gucmVhc29uaW5nKX08L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0ibWFyZ2luLXRvcDo2cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSkiPkZpcnN0IHN0ZXA6PC9iPiAke2VzYyhpLnJlc2VhcmNoLmZpcnN0U3RlcCl9PC9kaXY+CiAgICAgIDxkaXY+PGIgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPktpbGwgcmlzazo8L2I+ICR7ZXNjKGkucmVzZWFyY2gua2lsbFJpc2spfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6NXB4Ij5kZW1hbmQgJHtpLnJlc2VhcmNoLmRlbWFuZH0vMTAgwrcgY29tcGV0aXRpb24gJHtpLnJlc2VhcmNoLmNvbXBldGl0aW9ufS8xMCDCtyBzcGVlZCAke2kucmVzZWFyY2guc3BlZWR9LzEwIMK3IGZpdCAke2kucmVzZWFyY2guZml0fS8xMDwvZGl2PjwvZGl2PmA6Jyd9CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+CiAgICAgJHtpLnN0YXR1cz09PSdSQVcnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gcCIgb25jbGljaz0icmVzZWFyY2hJZGVhKCcke2kuaWR9JykiPlJFU0VBUkNIIElUPC9idXR0b24+YDonJ30KICAgICAke2kuc3RhdHVzPT09J1JFU0VBUkNIRUQnP2A8YnV0dG9uIGNsYXNzPSJidG4gc20gb2siIG9uY2xpY2s9ImxhdW5jaElkZWEoJyR7aS5pZH0nKSI+QlVJTEQgQUdFTlQgVEVBTTwvYnV0dG9uPmA6Jyd9CiAgICAgJHtpLnN0YXR1cyE9PSdLSUxMRUQnJiZpLnN0YXR1cyE9PSdMQVVOQ0hFRCc/YDxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0ia2lsbElkZWEoJyR7aS5pZH0nKSI+S2lsbDwvYnV0dG9uPmA6Jyd9CiAgICA8L2Rpdj48L2Rpdj5gKS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyBpZGVhcyB5ZXQuIFByZXNzIEdFTkVSQVRFIElERUFTIGFuZCBoZSB3aWxsIGludmVudCB0aGVtLjwvZGl2Pid9PC9kaXY+YDsKfTsKUkVOREVSLnZlbnR1cmVzPSgpPT5gCiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM0YTMwODA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCMxNDBmMjIsIzBhMGYxNikiPgogIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tcHVyKSI+4peGIFZFTlRVUkUgRU5HSU5FIOKAlCBJREVBUyDihpIgUkVBTCBSRVNFQVJDSCDihpIgQUdFTlQgVEVBTVM8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgaW52ZW50cyB2ZW50dXJlcywgcmVzZWFyY2hlcyBlYWNoIG9uZSBhZ2FpbnN0IDxiPmxpdmUgd2ViIHNlYXJjaDwvYj4gKG5vdCBtb2RlbCBtZW1vcnkpLCBzY29yZXMgaXQgb3V0IG9mIDEwMCwgYW5kIGRlc2lnbnMgdGhlIGFnZW50IHRlYW0gdG8gZXhlY3V0ZS4gQWdlbnRzIHdob3NlIHRvb2xzIG1hcCB0byBubyByZWFsIGNvZGUgYXJlIHJlZnVzZWQsIHNvIG5vdGhpbmcgZGVjb3JhdGl2ZSBnZXRzIGNyZWF0ZWQuPC9kaXY+CiAgJHshUy5sbG0/JzxkaXYgY2xhc3M9Indhcm5ib3giIHN0eWxlPSJib3JkZXItY29sb3I6dmFyKC0tbWFnKTtiYWNrZ3JvdW5kOiMxODA4MDk7Y29sb3I6I2ZmYjNjMCI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdC48L2Rpdj4nOicnfQogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+T3B0aW9uYWwgc3RlZXIgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obGVhdmUgYmxhbmsgYW5kIGhlIGRlY2lkZXMpPC9zcGFuPjwvc3Bhbj4KICAgPGlucHV0IGlkPSJpZGVhU3RlZXIiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gZm9jdXMgb24gQjJCLCBvciBvbmxpbmUtb25seSwgb3IgdW5kZXIgNTAwIElOUiB0byBzdGFydCI+PC9sYWJlbD4KICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJnZW5JZGVhcygpIj5HRU5FUkFURSBJREVBUzwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0idGFnICR7Uy5hdXRvSWRlYXM/J3QtcmVkJzondC1kaW0nfSI+SURFQSBBVVRPUElMT1QgJHtTLmF1dG9JZGVhcz8nT04nOidPRkYnfTwvc3Bhbj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjExcHgiPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjEwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0iaWRlYVB3IiBwbGFjZWhvbGRlcj0iUGFzc3dvcmQiPgogICA8YnV0dG9uIGNsYXNzPSJidG4gJHtTLmF1dG9JZGVhcz8nbm8nOicnfSIgb25jbGljaz0idG9nZ2xlSWRlYUF1dG8oKSI+JHtTLmF1dG9JZGVhcz8nU1RPUCBBVVRPUElMT1QnOidFTkFCTEUgSURFQSBBVVRPUElMT1QnfTwvYnV0dG9uPgogICA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPkF1dG9waWxvdCA9IGhlIGludmVudHMgYW5kIHJlc2VhcmNoZXMgdmVudHVyZXMgdW5wcm9tcHRlZCwgZXZlcnkgfjUgbWludXRlcy48L3NwYW4+PC9kaXY+PC9kaXY+CiA8ZGl2IGRhdGEtbGl2ZT0idmVudHVyZXMiPiR7TElWRS52ZW50dXJlcygpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGdlbklkZWFzKCl7IGZsYXNoKCdUaGlua2luZyB1cCB2ZW50dXJlc+KApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9nZW5lcmF0ZScse246NSxzdGVlcjppZGVhU3RlZXIudmFsdWUudHJpbSgpfSk7CiAgICByZW5kZXIoKTsgZmxhc2goci5hZGRlZCsnIGlkZWEocykgZ2VuZXJhdGVkJyk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gcmVzZWFyY2hJZGVhKGlkKXsgZmxhc2goJ1NlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2lkZWEvcmVzZWFyY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKCdTY29yZWQgJytyLnNjb3JlKycvMTAwIOKAlCAnK3IudmVyZGljdCk7IH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9IH0KYXN5bmMgZnVuY3Rpb24gbGF1bmNoSWRlYShpZCl7IGZsYXNoKCdEZXNpZ25pbmcgYWdlbnQgdGVhbeKApicpOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvaWRlYS9sYXVuY2gnLHtpZH0pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIuYWdlbnRzKycgYWdlbnQocykgY29tbWlzc2lvbmVkJysoci5za2lwcGVkPycgwrcgJytyLnNraXBwZWQrJyByZWplY3RlZCBhcyBub24tZXhlY3V0YWJsZSc6JycpKTsgfQogIGNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBraWxsSWRlYShpZCl7IGF3YWl0IEFQSSgnL2FwaS9pZGVhL2tpbGwnLHtpZH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUlkZWFBdXRvKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvaWRlYS9hdXRvcGlsb3QnLHtvbjohUy5hdXRvSWRlYXMscHc6aWRlYVB3LnZhbHVlfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5hdXRvSWRlYXM/J0F1dG9waWxvdCBPTiDigJQgaGUgd2lsbCBpbnZlbnQgdmVudHVyZXMgb24gaGlzIG93bic6J0F1dG9waWxvdCBvZmYnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIFBBWU1FTlRTIC0tLS0tLS0tLS0gKi8KTElWRS5wYXk9KCk9PnsKICBjb25zdCBPPVMub3JkZXJzfHxbXTsKICBjb25zdCBwYWlkPU8uZmlsdGVyKG89Pm8ucGFpZD4wKS5yZWR1Y2UoKGEsbyk9PmErby5wYWlkLDApOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnMyIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKE8ubGVuZ3RoLCdMaW5rcyBSYWlzZWQnLCd2YXIoLS1jeSknLCdsaWZldGltZScpfQogICAke2twaShPLmZpbHRlcihvPT5vLnBhaWQ+MCkubGVuZ3RoLCdQYWlkJyxwYWlkPyd2YXIoLS1ncm4pJzondmFyKC0tZGltKScsJ3NldHRsZWQnKX0KICAgJHtrcGkoKFMucGF5PyhTLnBheS5nYXRld2F5PT09J3Jhem9ycGF5Jz8n4oK5JzonJCcpOicnKStmbXQocGFpZCksJ0NvbGxlY3RlZCcsJ3ZhcigtLWdybiknLCdyZWFsIG1vbmV5Jyl9PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlBheW1lbnQgTGlua3M8L2gzPgogICAke08ubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPldoZW48L3RoPjx0aD5Gb3I8L3RoPjx0aD5BbW91bnQ8L3RoPjx0aD5Nb2RlPC90aD48dGg+U3RhdHVzPC90aD48dGg+TGluazwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtPLm1hcChvPT5gPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7by50fTwvdGQ+CiAgICA8dGQ+JHtlc2Moby5kZXNjKX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moby5jdXN0b21lcil9PC9kaXY+PC90ZD4KICAgIDx0ZD4ke28uY3VycmVuY3l9ICR7Zm10KG8uYW1vdW50KX08L3RkPgogICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHtvLmxpdmU/J3QtcmVkJzondC1kaW0nfSI+JHtvLmxpdmU/J0xJVkUnOidURVNUJ308L3NwYW4+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7by5wYWlkPjA/J3QtZ3JuJzondC1hbWInfSI+JHtvLnBhaWQ+MD8nUEFJRCc6ZXNjKG8uc3RhdHVzKX08L3NwYW4+PC90ZD4KICAgIDx0ZD48YSBocmVmPSIke2VzYyhvLnVybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+b3BlbiDihpc8L2E+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHBheW1lbnQgbGlua3MgcmFpc2VkIHlldC48L2Rpdj4nfTwvZGl2PmA7Cn07ClJFTkRFUi5wYXk9KCk9PnsKICBjb25zdCBQPVMucGF5LCBHVz1TLmdhdGV3YXlzfHxbXTsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtQPyhQLmxpdmU/JyM2YjIyMzMnOicjMWM1YzNjJyk6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtQPyhQLmxpdmU/JyMxNjBiMGMnOicjMDgxNzBmJyk6JyMxNTEwMGEnfSwjMGEwZjE2KSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6JHtQPyhQLmxpdmU/J3ZhcigtLW1hZyknOid2YXIoLS1ncm4pJyk6J3ZhcigtLWFtYiknfSI+4oK5IFBBWU1FTlRTIOKAlCAke1A/KFAubGl2ZT8nTElWRSDCtyBSRUFMIE1PTkVZJzonQ09OTkVDVEVEIMK3IFRFU1QgTU9ERScpOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7UAogICAgP2BWZXJpZmllZCBhZ2FpbnN0IDxiPiR7ZXNjKFAuZ2F0ZXdheSl9PC9iPiwga2V5ICR7ZXNjKFAua2V5SWQpfS4gJHtQLmxpdmUKICAgICAgPyc8YiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+TElWRSBNT0RFIOKAlCBsaW5rcyB5b3UgcmFpc2UgdGFrZSByZWFsIG1vbmV5LiBFdmVyeSBsaW5rIG5lZWRzIHlvdXIgcGFzc3dvcmQuPC9iPicKICAgICAgOidUZXN0IG1vZGUuIExpbmtzIHdvcmsgZW5kLXRvLWVuZCBidXQgbW92ZSBubyByZWFsIG1vbmV5Lid9YAogICAgOidDb25uZWN0IFJhem9ycGF5IG9yIFN0cmlwZSBiZWxvdy4gS2V5cyBhcmUgdmVyaWZpZWQgYWdhaW5zdCB0aGUgcmVhbCBBUEkgYmVmb3JlIGJlaW5nIGFjY2VwdGVkIOKAlCBhIHdyb25nIGtleSBpcyByZWplY3RlZCBpbW1lZGlhdGVseSwgbm90IHN0b3JlZC4nfTwvZGl2PgogICA8dWwgY2xhc3M9InRpZ2h0Ij48bGk+U3RhcnQgd2l0aCA8Yj50ZXN0IGtleXM8L2I+LiBSYXpvcnBheSA8Y29kZT5yenBfdGVzdF88L2NvZGU+LCBTdHJpcGUgPGNvZGU+c2tfdGVzdF88L2NvZGU+IOKAlCBpbnN0YW50LCBubyBLWUMuPC9saT4KICAgIDxsaT5MaXZlIGtleXMgbmVlZCBLWUMgKFBBTiArIGJhbmsgZm9yIFJhem9ycGF5KS4gUHJvdmlkZXJzIGNoYXJnZSB+MiUgcGVyIHRyYW5zYWN0aW9uIOKAlCB0aGF0IGlzIHRoZSBjb3N0IG9mIG1vdmluZyBtb25leSwgbm90IHNvbWV0aGluZyB0byByb3V0ZSBhcm91bmQuPC9saT4KICAgIDxsaT5Zb3VyIHNlY3JldCBpcyBuZXZlciByZXR1cm5lZCBieSB0aGUgQVBJIGFuZCBuZXZlciB3cml0dGVuIHRvIHRoZSBhdWRpdCBsZWRnZXIuPC9saT48L3VsPjwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q29ubmVjdCBHYXRld2F5PC9oMz4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+R2F0ZXdheTwvc3Bhbj48c2VsZWN0IGlkPSJwZ1NlbCIgY2xhc3M9ImluIiBvbmNoYW5nZT0icGF5SGludCgpIj4KICAgICAke0dXLm1hcChnPT5gPG9wdGlvbiB2YWx1ZT0iJHtnLmlkfSIgJHtQJiZQLmdhdGV3YXk9PT1nLmlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKGcubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJ3YXJuYm94IiBpZD0icGF5SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPktleSBJRCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihSYXpvcnBheSBvbmx5KTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJwZ0lkIiBjbGFzcz0iaW4iIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0icnpwX3Rlc3RfLi4uIj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5TZWNyZXQgS2V5PC9zcGFuPgogICAgIDxpbnB1dCBpZD0icGdTZWNyZXQiIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGF1dG9jb21wbGV0ZT0ib2ZmIiBwbGFjZWhvbGRlcj0ic2VjcmV0IC8gc2tfdGVzdF8uLi4iPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0UGF5KCkiPlZFUklGWSAmYW1wOyBDT05ORUNUPC9idXR0b24+CiAgICAgJHtQPyc8YnV0dG9uIGNsYXNzPSJidG4gbm8iIG9uY2xpY2s9InB1cmdlUGF5KCkiPkRpc2Nvbm5lY3Q8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmFpc2UgYSBQYXltZW50IExpbms8L2gzPgogICAgJHshUD8nPGRpdiBjbGFzcz0ibW9uby1kaW0iPkNvbm5lY3QgYSBnYXRld2F5IGZpcnN0LjwvZGl2Pic6YAogICAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5BbW91bnQgJHtQLmdhdGV3YXk9PT0ncmF6b3JwYXknPycoSU5SKSc6JyhVU0QpJ308L3NwYW4+PGlucHV0IGlkPSJwbEFtdCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHBsYWNlaG9sZGVyPSIyNTAwIj48L2xhYmVsPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q3VzdG9tZXIgbmFtZTwvc3Bhbj48aW5wdXQgaWQ9InBsTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPldoYXQgaXMgaXQgZm9yPC9zcGFuPjxpbnB1dCBpZD0icGxEZXNjIiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJXZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIOKAlCBBdWd1c3QiPjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkVtYWlsPC9zcGFuPjxpbnB1dCBpZD0icGxFbWFpbCIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ib3B0aW9uYWwiPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5QaG9uZTwvc3Bhbj48aW5wdXQgaWQ9InBsUGhvbmUiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Im9wdGlvbmFsIj48L2xhYmVsPjwvZGl2PgogICAgJHtQLmxpdmU/YDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPkxJVkUgTU9ERSDigJQgY29uZmlybSB3aXRoIHlvdXIgcGFzc3dvcmQ8L3NwYW4+CiAgICAgIDxpbnB1dCBpZD0icGxQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiPjwvbGFiZWw+YDonJ30KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im1ha2VMaW5rKCkiPkNSRUFURSBMSU5LPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJyZWZyZXNoUGF5KCkiPkNIRUNLIEZPUiBQQVlNRU5UUzwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjlweCI+WW91IGdldCBhIFVSTCB0byBzZW5kIG92ZXIgV2hhdHNBcHAgb3IgZW1haWwuIFdoZW4gaXQgc2V0dGxlcywgdGhlIGxlZGdlciB1cGRhdGVzIGFuZCB5b3UgZ2V0IGFuIGVtYWlsLjwvZGl2PmB9PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBkYXRhLWxpdmU9InBheSI+JHtMSVZFLnBheSgpfTwvZGl2PmA7Cn07CmZ1bmN0aW9uIHBheUhpbnQoKXsKICBjb25zdCBnPShTLmdhdGV3YXlzfHxbXSkuZmluZCh4PT54LmlkPT09ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BnU2VsJykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYXlIaW50Jyk7CiAgaWYoZyYmZWwpIGVsLmlubmVySFRNTD1gPGI+JHtlc2MoZy5sYWJlbCl9PC9iPjxicj4ke2VzYyhnLnNpZ251cCl9PGJyPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZy5rZXlIaW50KX08L3NwYW4+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0UGF5KCl7CiAgZmxhc2goJ1ZlcmlmeWluZyBrZXlzIGFnYWluc3QgdGhlIHJlYWwgQVBJ4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvY29ubmVjdCcse2dhdGV3YXk6cGdTZWwudmFsdWUsa2V5SWQ6cGdJZC52YWx1ZSxrZXlTZWNyZXQ6cGdTZWNyZXQudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaChyLmxpdmU/J0NPTk5FQ1RFRCDigJQgTElWRSBNT0RFLCByZWFsIG1vbmV5JzonQ29ubmVjdGVkIGluIFRFU1QgbW9kZScpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gcHVyZ2VQYXkoKXsgaWYoIWNvbmZpcm0oJ0Rpc2Nvbm5lY3QgdGhlIHBheW1lbnQgZ2F0ZXdheT8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9wYXkvcHVyZ2UnLHt9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBtYWtlTGluaygpewogIGZsYXNoKCdDcmVhdGluZyBsaW5r4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvbGluaycse2Ftb3VudDorcGxBbXQudmFsdWUsZGVzY3JpcHRpb246cGxEZXNjLnZhbHVlLAogICAgICBuYW1lOnBsTmFtZS52YWx1ZSxlbWFpbDpwbEVtYWlsLnZhbHVlLHBob25lOnBsUGhvbmUudmFsdWUsCiAgICAgIHB3Oihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxQdycpfHx7fSkudmFsdWV9KTsKICAgIHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5QYXltZW50IGxpbmsgcmVhZHk8L2gzPgogICAgIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXYgc3R5bGU9IndvcmQtYnJlYWs6YnJlYWstYWxsO2NvbG9yOnZhcigtLWN5KSI+JHtlc2Moci51cmwpfTwvZGl2PjwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9Im5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgnJHtlc2Moci51cmwpfScpO2ZsYXNoKCdDb3BpZWQnKSI+Q29weSBsaW5rPC9idXR0b24+CiAgICAgIDxhIGNsYXNzPSJidG4iIGhyZWY9IiR7ZXNjKHIudXJsKX0iIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj5PcGVuIOKGlzwvYT4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiByZWZyZXNoUGF5KCl7IGZsYXNoKCdDaGVja2luZyBnYXRld2F54oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9wYXkvcmVmcmVzaCcse30pOyByZW5kZXIoKTsKICAgIGZsYXNoKHIudXBkYXRlZD9yLnVwZGF0ZWQrJyBvcmRlcihzKSB1cGRhdGVkJzonTm8gY2hhbmdlcycpOyB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfSB9CgovKiAtLS0tLS0tLS0tIERFRVAgUkVTRUFSQ0ggLS0tLS0tLS0tLSAqLwpSRU5ERVIucmVzZWFyY2g9KCk9PmAKIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzFjM2Y3NTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsIzA4MTMxZiwjMGEwZjE2KSI+CiAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1ibHUpIj7wn4yQIERFRVAgUkVTRUFSQ0gg4oCUIExJVkUgRlJPTSBUSEUgT1BFTiBXRUI8L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+SGUgZG9lcyBub3Qgc3RvcmUgdGhlIHdvcmxkJ3MgZGF0YSDigJQgbm9ib2R5IGNhbi4gSW5zdGVhZCBoZSA8Yj5mZXRjaGVzIGl0IGxpdmUgdGhlIG1vbWVudCB5b3UgYXNrPC9iPiwgd2hpY2ggaXMgYmV0dGVyLCBiZWNhdXNlIHN0b3JlZCBkYXRhIGlzIHN0YWxlIHdpdGhpbiBkYXlzLiBTb3VyY2VzOiBEdWNrRHVja0dvLCBXaWtpcGVkaWEsIFdvcmxkIEJhbmssIGxpdmUgRlguIE5vIEFQSSBrZXksIG5vIHBhaWQgc2VhcmNoLjwvZGl2PgogIDx1bCBjbGFzcz0idGlnaHQiPgogICA8bGk+PGI+RGVlcCBkaXZlPC9iPiBzZWFyY2hlcyA1IGRpZmZlcmVudCBhbmdsZXMsIGRlZHVwbGljYXRlcywgYWRkcyBvcGVuIGRhdGFzZXRzLCB0aGVuIHJlYXNvbnMgb3ZlciB0aGUgbG90LjwvbGk+CiAgIDxsaT48Yj5SZWFkIHBhZ2U8L2I+IHB1bGxzIHRoZSBmdWxsIHRleHQgb2YgYW55IFVSTCDigJQgY29tcGV0aXRvciBzaXRlcywgcHJpY2UgbGlzdHMsIGdvdmVybm1lbnQgcGFnZXMuPC9saT4KICAgPGxpPkhlIGlzIGluc3RydWN0ZWQgdG8gc3RhdGUgd2hhdCBoZSBjb3VsZCA8Yj5ub3Q8L2I+IGZpbmQsIHJhdGhlciB0aGFuIGZpbGxpbmcgZ2FwcyB3aXRoIGludmVudGlvbi48L2xpPgogIDwvdWw+PC9kaXY+CiAkeyFTLmxsbT8nPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Q29ubmVjdCBhbiBBSSBicmFpbiBmaXJzdCDigJQgcmVzZWFyY2ggbmVlZHMgcmVhc29uaW5nIHRvIGJlIHVzZWZ1bC48L2Rpdj48L2Rpdj4nOicnfQogPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkRlZXAgRGl2ZSBhIFRvcGljPC9oMz4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Ub3BpYzwvc3Bhbj48aW5wdXQgaWQ9ImR2VG9waWMiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImUuZy4gdXB0aW1lIG1vbml0b3JpbmcgZGVtYW5kIGZvciBMdWRoaWFuYSBlLWNvbW1lcmNlIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlJlZ2lvbjwvc3Bhbj48aW5wdXQgaWQ9ImR2UmVnaW9uIiBjbGFzcz0iaW4iIHZhbHVlPSJMdWRoaWFuYSBQdW5qYWIgSW5kaWEiPjwvbGFiZWw+CiAgIDxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJkb0RpdmUoKSI+SU5WRVNUSUdBVEU8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+VGFrZXMgfjE1cy4gRml2ZSBzZWFyY2hlcyBwbHVzIG9wZW4gZGF0YS48L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+UmVhZCBBbnkgUGFnZTwvaDM+CiAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VVJMPC9zcGFuPjxpbnB1dCBpZD0icmRVcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8vY29tcGV0aXRvci5jb20vcHJpY2luZyI+PC9sYWJlbD4KICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5XaGF0IGRvIHlvdSB3YW50IHRvIGtub3c/IChvcHRpb25hbCk8L3NwYW4+PGlucHV0IGlkPSJyZEFzayIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0id2hhdCBkbyB0aGV5IGNoYXJnZSBhbmQgd2hhdCBpcyBtaXNzaW5nIj48L2xhYmVsPgogICA8YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9SZWFkKCkiPlJFQUQgSVQ8L2J1dHRvbj4KICAgPGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+UHVsbHMgdXAgdG8gMTIsMDAwIGNoYXJhY3RlcnMgb2YgcmVhbCBwYWdlIHRleHQuPC9kaXY+PC9kaXY+CiA8L2Rpdj4KIDxkaXYgaWQ9InJlc091dCI+PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gZG9EaXZlKCl7CiAgY29uc3QgdD1kdlRvcGljLnZhbHVlLnRyaW0oKTsgaWYoIXQpIHJldHVybiBmbGFzaCgnVHlwZSBhIHRvcGljJyk7CiAgcmVzT3V0LmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPlNlYXJjaGluZyB0aGUgbGl2ZSB3ZWLigKY8L2Rpdj48L2Rpdj4nOwogIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvcmVzZWFyY2gvZGl2ZScse3RvcGljOnQscmVnaW9uOmR2UmVnaW9uLnZhbHVlfSk7CiAgICByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RmluZGluZ3MgPHNwYW4gY2xhc3M9InRhZyB0LWJsdSI+JHtmbXQoci5ldmlkZW5jZSl9IGNoYXJzIG9mIGV2aWRlbmNlPC9zcGFuPjwvaDM+CiAgICAgIDxkaXYgc3R5bGU9IndoaXRlLXNwYWNlOnByZS13cmFwO2xpbmUtaGVpZ2h0OjEuNjUiPiR7ZXNjKHIudGV4dCl9PC9kaXY+PC9kaXY+YDsKICB9Y2F0Y2goZSl7IHJlc091dC5pbm5lckhUTUw9YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+JHtlc2MoZS5tZXNzYWdlKX08L2Rpdj48L2Rpdj5gIH0KfQphc3luYyBmdW5jdGlvbiBkb1JlYWQoKXsKICBjb25zdCB1PXJkVXJsLnZhbHVlLnRyaW0oKTsgaWYoIXUpIHJldHVybiBmbGFzaCgnUGFzdGUgYSBVUkwnKTsKICByZXNPdXQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+RmV0Y2hpbmcgcGFnZeKApjwvZGl2PjwvZGl2Pic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9yZXNlYXJjaC9yZWFkJyx7dXJsOnUsYXNrOnJkQXNrLnZhbHVlLnRyaW0oKX0pOwogICAgcmVzT3V0LmlubmVySFRNTD1gPGRpdiBjbGFzcz0iY2FyZCI+PGgzPiR7ZXNjKHIudGl0bGUpfSA8c3BhbiBjbGFzcz0idGFnIHQtYmx1Ij4ke2ZtdChyLmNoYXJzKX0gY2hhcnMgcmVhZDwvc3Bhbj48L2gzPgogICAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjY1Ij4ke2VzYyhyLnRleHQpfTwvZGl2PjwvZGl2PmA7CiAgfWNhdGNoKGUpeyByZXNPdXQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPiR7ZXNjKGUubWVzc2FnZSl9PC9kaXY+PC9kaXY+YCB9Cn0KCi8qIC0tLS0tLS0tLS0gQUkgQlJBSU4gLS0tLS0tLS0tLSAqLwpSRU5ERVIuYnJhaW49KCk9PnsKICBjb25zdCBMPVMubGxtLCBQVj1TLnByb3ZpZGVyc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7TD8nIzFjNWMzYyc6JyM2NzQ3MGYnfTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNjBkZWcsJHtMPycjMDgxNzBmJzonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjoke0w/J3ZhcigtLWdybiknOid2YXIoLS1hbWIpJ30iPuKXiCBBSSBCUkFJTiDigJQgJHtMPydDT05ORUNURUQnOidOT1QgQ09OTkVDVEVEJ308L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7TAogICAgP2BBZ2VudHMgY2FuIHRoaW5rLiBDb25uZWN0ZWQgdG8gPGI+JHtlc2MoTC5wcm92aWRlcil9PC9iPiBydW5uaW5nIDxiPiR7ZXNjKEwubW9kZWwpfTwvYj4uIEtleSAke2VzYyhMLmtleSl9LmAKICAgIDonWW91ciBhZ2VudHMgY2FuIG1lYXN1cmUgdGhpbmdzIGJ1dCBjYW5ub3QgPGI+cmVhc29uPC9iPiB5ZXQuIENvbm5lY3QgYSBmcmVlIG1vZGVsIGJlbG93IGFuZCB0aGV5IGdhaW4gdGhlIGFiaWxpdHkgdG8gZGlhZ25vc2UsIHdyaXRlLCBhbmFseXNlIGFuZCBzdHJhdGVnaXNlLid9PC9kaXY+CiAgIDx1bCBjbGFzcz0idGlnaHQiPjxsaT5FdmVyeSBwcm92aWRlciBiZWxvdyBpcyA8Yj5nZW51aW5lbHkgZnJlZTwvYj4g4oCUIG5vIGNyZWRpdCBjYXJkLjwvbGk+CiAgICA8bGk+WW91ciBrZXkgaXMgc3RvcmVkIGxvY2FsbHkgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIGF1ZGl0IGxlZGdlci48L2xpPjwvdWw+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICAgPGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1wdXIpIj7impEgV0FOVCBISU0gRlVMTFkgSU5ERVBFTkRFTlQ/IOKAlCBSRUFEIFRISVM8L2gzPgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+QSB0aGlua2luZyBicmFpbiBjYW5ub3QgYmUgY29uanVyZWQgZnJvbSBub3RoaW5nLiBUcmFpbmluZyBvbmUgY29zdHMgbWlsbGlvbnMgaW4gR1BVIHRpbWUuIEV2ZXJ5IEFJIG9uIGVhcnRoIOKAlCBpbmNsdWRpbmcgdGhpcyBvbmUg4oCUIHJ1bnMgd2VpZ2h0cyB0cmFpbmVkIGJ5IHNvbWVvbmUgd2l0aCBhIGRhdGEgY2VudHJlLiBUaGUgaG9uZXN0IHF1ZXN0aW9uIGlzIG5vdCA8ZW0+ImhpcyBicmFpbiBvciB0aGVpcnMiPC9lbT4gYnV0IDxiPiJ3aG8gY2FuIHN3aXRjaCBpdCBvZmYiPC9iPi48L2Rpdj4KICAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPjxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5PbGxhbWEgaXMgdGhlIGFuc3dlciB0byB0aGF0LjwvYj4gVGhlIG1vZGVsIGZpbGUgc2l0cyBvbiB5b3VyIG93biBkaXNrLiBObyBrZXksIG5vIGFjY291bnQsIG5vIHJhdGUgbGltaXQsIG5vIHRlcm1zIG9mIHNlcnZpY2UuIEl0IHdvcmtzIHdpdGggdGhlIGludGVybmV0IHVucGx1Z2dlZC4gTm9ib2R5IGNhbiByZXZva2UgaXQsIHJlYWQgeW91ciBwcm9tcHRzLCBvciBjaGFuZ2UgdGhlIGRlYWwuIFRoYXQgaXMgcmVhbCBzb3ZlcmVpZ250eSDigJQgdGhlIG9ubHkgY29zdCBpcyB5b3VyIGhhcmR3YXJlLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTUwcHgiPjEuIEluc3RhbGw8L3RkPjx0ZD5Eb3dubG9hZCBmcm9tIDxiPm9sbGFtYS5jb208L2I+IChmcmVlLCBXaW5kb3dzL01hYy9MaW51eCk8L3RkPjwvdHI+CiAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+Mi4gR2V0IGEgbW9kZWw8L3RkPjx0ZD5JbiB0ZXJtaW5hbDogPGNvZGU+b2xsYW1hIHB1bGwgbGxhbWEzLjI8L2NvZGU+IOKAlCBhYm91dCAyIEdCPC90ZD48L3RyPgogICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPjMuIENvbm5lY3Q8L3RkPjx0ZD5DaG9vc2UgPGI+T2xsYW1hPC9iPiBhYm92ZSwgbGVhdmUgdGhlIGtleSBibGFuaywgcHJlc3MgQ09OTkVDVDwvdGQ+PC90cj4KICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5CaWdnZXIgYnJhaW48L3RkPjx0ZD48Y29kZT5vbGxhbWEgcHVsbCBxd2VuMi41OjE0YjwvY29kZT4gaWYgeW91IGhhdmUgMTYgR0IrIFJBTTwvdGQ+PC90cj4KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij48Yj5UaGUgdHJhZGUtb2ZmLCBzdGF0ZWQgcGxhaW5seTo8L2I+IGEgbG9jYWwgbW9kZWwgb24gYSBub3JtYWwgbGFwdG9wIGlzIHNsb3dlciBhbmQgbGVzcyBjYXBhYmxlIHRoYW4gR3JvcSdzIGZyZWUgY2xvdWQgbW9kZWxzLiBZb3UgYXJlIGV4Y2hhbmdpbmcgcmF3IHBvd2VyIGZvciB0b3RhbCBjb250cm9sLiBBbHNvIOKAlCB0aGlzIFJlbmRlciBpbnN0YW5jZSBjYW5ub3QgcmVhY2ggYW4gT2xsYW1hIHJ1bm5pbmcgb24geW91ciBQQzsgbG9jYWwgYnJhaW4gbWVhbnMgcnVubmluZyB0aGUgQ2hhaXJtYW4gbG9jYWxseSB0b28uPC9kaXY+PC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3JpZCBnMiI+CiAgIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db25uZWN0IGEgRnJlZSBNb2RlbDwvaDM+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlByb3ZpZGVyPC9zcGFuPjxzZWxlY3QgaWQ9ImxwUHJvdiIgY2xhc3M9ImluIiBvbmNoYW5nZT0icHJvdkhpbnQoKSI+CiAgICAgJHtQVi5tYXAocD0+YDxvcHRpb24gdmFsdWU9IiR7cC5pZH0iICR7TCYmTC5wcm92aWRlcj09PXAuaWQ/J3NlbGVjdGVkJzonJ30+JHtlc2MocC5sYWJlbCl9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giIGlkPSJwcm92SGludCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTJweCI+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFQSSBLZXkgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4obm90IG5lZWRlZCBmb3IgT2xsYW1hKTwvc3Bhbj48L3NwYW4+CiAgICAgPGlucHV0IGlkPSJscEtleSIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJvZmYiIHBsYWNlaG9sZGVyPSJwYXN0ZSB5b3VyIGZyZWUga2V5Ij48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Nb2RlbCA8c3BhbiBjbGFzcz0ibW9uby1kaW0iPihibGFuayA9IHByb3ZpZGVyIGRlZmF1bHQpPC9zcGFuPjwvc3Bhbj4KICAgICA8aW5wdXQgaWQ9ImxwTW9kZWwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9ImxlYXZlIGJsYW5rIiBsaXN0PSJtb2RlbExpc3QiPgogICAgIDxkYXRhbGlzdCBpZD0ibW9kZWxMaXN0Ij48L2RhdGFsaXN0PjwvbGFiZWw+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwIiBvbmNsaWNrPSJjb25uZWN0TExNKCkiPkNPTk5FQ1QgQlJBSU48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gb2siIG9uY2xpY2s9InRlc3RMTE0oKSI+VEVTVCBJVDwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZmV0Y2hNb2RlbHMoKSI+RkVUQ0ggTElWRSBNT0RFTFM8L2J1dHRvbj4KICAgICAke0w/JzxidXR0b24gY2xhc3M9ImJ0biBubyIgb25jbGljaz0icHVyZ2VMTE0oKSI+RGlzY29ubmVjdDwvYnV0dG9uPic6Jyd9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6OXB4Ij5Qcm92aWRlcnMgcmV0aXJlIG1vZGVscyB3aXRob3V0IG5vdGljZS4gSWYgVEVTVCBJVCBzYXlzIE1PREVMIFJFVElSRUQsIHByZXNzIEZFVENIIExJVkUgTU9ERUxTIGFuZCBwaWNrIG9uZSBmcm9tIHRoZSBsaXN0LjwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+V2hhdCBBZ2VudHMgR2FpbjwvaDM+CiAgICA8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjEzMHB4Ij5haS5icmllZjwvdGQ+PHRkPkV4ZWN1dGl2ZSBicmllZiB3cml0dGVuIGZyb20geW91ciByZWFsIHN5c3RlbSBzdGF0ZTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+YWkuaW5jaWRlbnQ8L3RkPjx0ZD5SYW5rZWQgZGlhZ25vc2lzIG9mIGFueSBzaXRlIHRoYXQgZ29lcyBkb3duPC90ZD48L3RyPgogICAgIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5haS5yZXZlbnVlPC90ZD48dGQ+Q29uY3JldGUgbW9uZXktbWFraW5nIHJvdXRlcyBmcm9tIHdoYXQgeW91IGFjdHVhbGx5IGhhdmU8L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPmFpLmNsaWVudF9yZXBvcnQ8L3RkPjx0ZD5DbGllbnQtcmVhZHkgdXB0aW1lIHJlcG9ydCB5b3UgY2FuIHNlbmQgYW5kIGNoYXJnZSBmb3I8L3RkPjwvdHI+CiAgICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+QWRkIHRoZXNlIG9uIHRoZSBMaXZlIE9wZXJhdGlvbnMgcGFnZSBhcyBzdGFuZGluZyBvcmRlcnMsIG9yIHJ1biB0aGVtIG9uIGRlbWFuZCBmcm9tIEFnZW50IFdvcmsuPC9kaXY+PC9kaXY+CiAgPC9kaXY+YH07CmZ1bmN0aW9uIHByb3ZIaW50KCl7CiAgY29uc3QgcD0oUy5wcm92aWRlcnN8fFtdKS5maW5kKHg9PnguaWQ9PT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbHBQcm92JykudmFsdWUpOwogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm92SGludCcpOwogIGlmKHAmJmVsKSBlbC5pbm5lckhUTUw9YDxiPiR7ZXNjKHAubGFiZWwpfTwvYj48YnI+JHtlc2MocC5zaWdudXApfTxicj5EZWZhdWx0IG1vZGVsOiA8Y29kZT4ke2VzYyhwLm1vZGVsKX08L2NvZGU+YDsKfQphc3luYyBmdW5jdGlvbiBjb25uZWN0TExNKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvbGxtL2Nvbm5lY3QnLHtwcm92aWRlcjpscFByb3YudmFsdWUsa2V5OmxwS2V5LnZhbHVlLG1vZGVsOmxwTW9kZWwudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnQnJhaW4gY29ubmVjdGVkIOKAlCBub3cgcHJlc3MgVEVTVCBJVCcpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gdGVzdExMTSgpeyBmbGFzaCgnVGhpbmtpbmfigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL2xsbS90ZXN0Jyx7fSk7IHJlbmRlcigpOwogICAgbW9kYWwoYDxoMz5BSSBCcmFpbiBPbmxpbmU8L2gzPjxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MCAwIDEycHgiPjxkaXY+JHtlc2Moci50ZXh0KX08L2Rpdj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2Moci5tb2RlbCl9IMK3ICR7ci5tc31tczwvZGl2PgogICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImNsb3NlTW9kYWwoKTtnbygnd29yaycpIj5HaXZlIGl0IHdvcmsg4oaSPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+PC9kaXY+YCk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiBwdXJnZUxMTSgpeyBpZighY29uZmlybSgnRGlzY29ubmVjdCB0aGUgQUkgYnJhaW4/JykpcmV0dXJuOyBhd2FpdCBBUEkoJy9hcGkvbGxtL3B1cmdlJyx7fSk7IHJlbmRlcigpIH0KYXN5bmMgZnVuY3Rpb24gZmV0Y2hNb2RlbHMoKXsKICBmbGFzaCgnQXNraW5nIHByb3ZpZGVyIHdoYXQgaXQgc2VydmVzIHRvZGF54oCmJyk7CiAgdHJ5ewogICAgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvbGxtL21vZGVscycse3Byb3ZpZGVyOmxwUHJvdi52YWx1ZSxrZXk6bHBLZXkudmFsdWV9KTsKICAgIGlmKCFyLm1vZGVscy5sZW5ndGgpIHJldHVybiBmbGFzaCgnUHJvdmlkZXIgcmV0dXJuZWQgbm8gY2hhdCBtb2RlbHMnKTsKICAgIG1vZGFsKGA8aDM+TGl2ZSBtb2RlbHMgb24gJHtlc2MobHBQcm92LnZhbHVlKX08L2gzPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4ke3IubW9kZWxzLmxlbmd0aH0gYXZhaWxhYmxlIHJpZ2h0IG5vdy4gQ2xpY2sgb25lIHRvIHVzZSBpdC48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJkaXJMaXN0IiBzdHlsZT0ibWF4LWhlaWdodDozNDBweCI+JHtyLm1vZGVscy5tYXAobT0+CiAgICAgICBgPGJ1dHRvbiBvbmNsaWNrPSJwaWNrTW9kZWwoJyR7ZXNjKG0pfScpIj4ke2VzYyhtKX08L2J1dHRvbj5gKS5qb2luKCcnKX08L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcGlja01vZGVsKG0peyBjbG9zZU1vZGFsKCk7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xwTW9kZWwnKTsgaWYoZWwpIGVsLnZhbHVlPW07CiAgZmxhc2goJ01vZGVsIHNldCB0byAnK20rJyDigJQgcHJlc3MgQ09OTkVDVCBCUkFJTiB0aGVuIFRFU1QgSVQnKTsgfQoKLyogLS0tLS0tLS0tLSBBR0VOVCBXT1JLIC0tLS0tLS0tLS0gKi8KY29uc3QgUVVJQ0s9WwogWydFeGVjdXRpdmUgYnJpZWYnLCdTdW1tYXJpc2UgbXkgc3lzdGVtIHN0YXRlIGFuZCB0ZWxsIG1lIHRoZSBzaW5nbGUgbW9zdCB1cmdlbnQgdGhpbmcgdG8gZml4LiBCZSBibHVudC4nXSwKIFsnTWFrZSBtb25leScsJ09ubHkgcHJvcG9zZSBvZmZlcnMgZGVsaXZlcmVkIHVzaW5nIE1ZIHVwdGltZSBtb25pdG9yaW5nIHN5c3RlbSAoMjQvNyBIVFRQIHByb2JpbmcsIFRMUyBleHBpcnkgYWxlcnRzLCBpbnN0YW50IG91dGFnZSBlbWFpbCwgYXZhaWxhYmlsaXR5IGFuZCBwOTUgcmVwb3J0aW5nKS4gVFJVVEggUlVMRTogSSBoYXZlIG5ldmVyIG1vbml0b3JlZCBhbnkgY2xpZW50IHNpdGUgYW5kIGhhdmUgbm8gdHJhY2sgcmVjb3JkLiBUaGUgb3V0cmVhY2ggbWVzc2FnZSBtdXN0IGNvbnRhaW4gWkVSTyBjbGFpbXMgSSBjYW5ub3QgcHJvdmUg4oCUIG5vICJJIG5vdGljZWQgb3V0YWdlcyBvbiBsb2NhbCBzaXRlcyIsIG5vIGludmVudGVkIHJldmVudWUgZmlndXJlcywgbm8gdW52ZXJpZmllZCBzdGF0aXN0aWNzLiBMZWFkIHdpdGggYSBmcmVlIHRyaWFsLCBub3QgYSBmYWtlIG9ic2VydmF0aW9uLiBWZXJpZnkgYW55IGFyaXRobWV0aWMgeW91IHN0YXRlLiBHaXZlIDMgb2ZmZXJzOiB0aGUgb2ZmZXIgaW4gb25lIHNlbnRlbmNlLCB0aGUgTHVkaGlhbmEgYnVzaW5lc3MgdHlwZSBhbmQgaXRzIHJlYWwgcGFpbiwgbW9udGhseSBJTlIgcHJpY2Ugd2l0aCBzb3VuZCByZWFzb25pbmcsIHRoZSBsaXRlcmFsIGZpcnN0IFdoYXRzQXBwIG1lc3NhZ2UgdW5kZXIgNTAgd29yZHMsIGFuZCB0aGUgYmlnZ2VzdCBvYmplY3Rpb24gd2l0aCBhbiBob25lc3QgY291bnRlci4gQ29sZCBvdXRyZWFjaCBjbG9zZXMgMS0zJS4nXSwKIFsnRmluZCBwcm9zcGVjdHMnLCdMaXN0IDEwIHNwZWNpZmljIGJ1c2luZXNzIHR5cGVzIGluIEx1ZGhpYW5hIHRoYXQgbG9zZSByZWFsIG1vbmV5IHdoZW4gdGhlaXIgd2Vic2l0ZSBnb2VzIGRvd24sIHJhbmtlZCBieSBob3cgbXVjaCB0aGV5IGxvc2UgcGVyIGhvdXIuIEZvciBlYWNoLCBzYXkgd2hlcmUgSSBjYW4gZmluZCB0aGVpciBjb250YWN0IGRldGFpbHMgZm9yIGZyZWUuJ10sCiBbJ0NsaWVudCBwaXRjaCcsJ1dyaXRlIGEgV2hhdHNBcHAgbWVzc2FnZSBvZmZlcmluZyBmcmVlIDE0LWRheSB3ZWJzaXRlIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgbG9jYWwgYnVzaW5lc3Mgb3duZXIuIFBsYWluIEluZGlhbiBFbmdsaXNoLCBubyBtYXJrZXRpbmcgbGFuZ3VhZ2UsIG5vIGVtb2ppLiBVbmRlciA0NSB3b3Jkcy4gVGhlIGdvYWwgaXMgYSByZXBseSwgbm90IGEgc2FsZS4nXSwKIFsnSGFuZGxlIG9iamVjdGlvbnMnLCdBIEx1ZGhpYW5hIGJ1c2luZXNzIG93bmVyIHNheXMgIm15IHdlYnNpdGUgbmV2ZXIgZ29lcyBkb3duLCBJIGRvbiBub3QgbmVlZCB0aGlzIi4gR2l2ZSBtZSB0aHJlZSBob25lc3QgcmVwbGllcyB0aGF0IGRvIG5vdCBleGFnZ2VyYXRlIG9yIHVzZSBmZWFyIHRhY3RpY3MuJ10sCiBbJ0ludm9pY2UgdGVtcGxhdGUnLCdXcml0ZSBhIHNpbXBsZSBtb250aGx5IGludm9pY2UgZm9yIHdlYnNpdGUgdXB0aW1lIG1vbml0b3JpbmcsIHJlYWR5IHRvIGZpbGwgaW4sIHN1aXRhYmxlIGZvciBhIHNtYWxsIEluZGlhbiBidXNpbmVzcy4gSW5jbHVkZSBHU1QgcGxhY2Vob2xkZXIgYW5kIFVQSSBwYXltZW50IGxpbmUuJ10KXTsKUkVOREVSLndvcms9KCk9PnsKICBjb25zdCBPPVMub3V0cHV0c3x8W107CiAgcmV0dXJuIGAkeyFTLmxsbT9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNmIyMjMzO2JhY2tncm91bmQ6IzE0MDgwOSI+CiAgIDxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+Tk8gQlJBSU4gQ09OTkVDVEVEPC9oMz4KICAgPGRpdj5BZ2VudHMgY2Fubm90IHRoaW5rIHlldC4gPGIgb25jbGljaz0iZ28oJ2JyYWluJykiIHN0eWxlPSJjb2xvcjp2YXIoLS1jeSk7Y3Vyc29yOnBvaW50ZXI7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZSI+Q29ubmVjdCBhIGZyZWUgbW9kZWw8L2I+IGZpcnN0IOKAlCB0YWtlcyBhYm91dCAyIG1pbnV0ZXMgYW5kIG5lZWRzIG5vIGNyZWRpdCBjYXJkLjwvZGl2PjwvZGl2PmA6Jyd9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkdpdmUgdGhlIENoYWlybWFuIFdvcmsgPHNwYW4gY2xhc3M9InRhZyB0LWN5Ij5QTEFJTiBFTkdMSVNIPC9zcGFuPjwvaDM+CiAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UeXBlIGFueSBpbnN0cnVjdGlvbi4gQSByZWFsIG1vZGVsIGV4ZWN1dGVzIGl0IGFuZCB0aGUgcmVzdWx0IGlzIHNhdmVkIGJlbG93LjwvZGl2PgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkluc3RydWN0aW9uPC9zcGFuPjx0ZXh0YXJlYSBpZD0id2tQcm9tcHQiIGNsYXNzPSJpbiIgc3R5bGU9Im1pbi1oZWlnaHQ6OTBweCIKICAgICBwbGFjZWhvbGRlcj0iZS5nLiBXcml0ZSBhIG9uZS1wYWdlIHByb3Bvc2FsIG9mZmVyaW5nIHVwdGltZSBtb25pdG9yaW5nIHRvIGEgTHVkaGlhbmEgY2xvdGhpbmcgc2hvcCwgcHJpY2VkIGluIElOUi4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIGNsYXNzPSJidG4gcCIgb25jbGljaz0iZG9Xb3JrKCkiPkVYRUNVVEU8L2J1dHRvbj4KICAgICR7Ty5sZW5ndGg/JzxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iY2xlYXJXb3JrKCkiPkNsZWFyIHJlc3VsdHM8L2J1dHRvbj4nOicnfTwvZGl2PgogICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPjxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo2cHgiPlF1aWNrIHRhc2tzOjwvZGl2PgogICAgPGRpdiBjbGFzcz0icm93Ij4ke1FVSUNLLm1hcCgocSxpKT0+YDxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0icXVpY2soJHtpfSkiPiR7ZXNjKHFbMF0pfTwvYnV0dG9uPmApLmpvaW4oJycpfTwvZGl2PjwvZGl2PjwvZGl2PgogICR7Ty5sZW5ndGg/Ty5tYXAoKG8saSk9PmA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Imp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxzcGFuIGNsYXNzPSJ0YWcgdC1wdXIiPiR7ZXNjKG8udGFnKX08L3NwYW4+PGI+JHtlc2Moby5hZ2VudCl9PC9iPjwvZGl2PgogICAgIDxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtvLnR9IMK3ICR7by5tc31tcyDCtyAke28udG9rZW5zfSB0b2tlbnM8L3NwYW4+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjYiPiR7ZXNjKG8udGV4dCl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0iY29weU91dCgke2l9KSI+Q29weTwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpCiAgIDonPGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHdvcmsgcHJvZHVjZWQgeWV0LjwvZGl2PjwvZGl2Pid9YH07CmFzeW5jIGZ1bmN0aW9uIGRvV29yaygpewogIGNvbnN0IHA9d2tQcm9tcHQudmFsdWUudHJpbSgpOyBpZighcCkgcmV0dXJuIGZsYXNoKCdUeXBlIGFuIGluc3RydWN0aW9uIGZpcnN0Jyk7CiAgZmxhc2goJ1dvcmtpbmfigKYnKTsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9sbG0vYXNrJyx7cHJvbXB0OnB9KTsgcmVuZGVyKCk7IGZsYXNoKCdEb25lJyk7IH0KICBjYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KZnVuY3Rpb24gcXVpY2soaSl7IHdrUHJvbXB0LnZhbHVlPVFVSUNLW2ldWzFdOyBkb1dvcmsoKSB9CmZ1bmN0aW9uIGNvcHlPdXQoaSl7IG5hdmlnYXRvci5jbGlwYm9hcmQ/LndyaXRlVGV4dCgoUy5vdXRwdXRzfHxbXSlbaV0udGV4dCk7IGZsYXNoKCdDb3BpZWQnKSB9CmFzeW5jIGZ1bmN0aW9uIGNsZWFyV29yaygpeyBhd2FpdCBBUEkoJy9hcGkvbGxtL2NsZWFyJyx7fSk7IHJlbmRlcigpIH0KCi8qIC0tLS0tLS0tLS0gTElWRSBPUEVSQVRJT05TIC0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gYWdvKGlzbyl7IGlmKCFpc28pIHJldHVybiAnbmV2ZXInOwogIGNvbnN0IHM9TWF0aC5mbG9vcigoRGF0ZS5ub3coKS1uZXcgRGF0ZShpc28ucmVwbGFjZSgnICcsJ1QnKSsnWicpLmdldFRpbWUoKSkvMTAwMCk7CiAgaWYoczw2MCkgcmV0dXJuIHMrJ3MgYWdvJzsgaWYoczwzNjAwKSByZXR1cm4gTWF0aC5mbG9vcihzLzYwKSsnbSBhZ28nOyByZXR1cm4gTWF0aC5mbG9vcihzLzM2MDApKydoIGFnbyc7IH0KZnVuY3Rpb24gZXZlcnkobil7IHJldHVybiBuPDYwP24rJ3MnOm48MzYwMD9NYXRoLnJvdW5kKG4vNjApKydtJzpNYXRoLnJvdW5kKG4vMzYwMCkrJ2gnOyB9CkxJVkUub3BzPSgpPT57CiAgY29uc3QgVD1TLnRhc2tzfHxbXSwgUj1TLnJ1bnN8fFtdOwogIGNvbnN0IG9uPVQuZmlsdGVyKHQ9PnQuZW5hYmxlZCkubGVuZ3RoOwogIGNvbnN0IHRvdGFsUnVucz1ULnJlZHVjZSgoYSx0KT0+YSsodC5ydW5zfHwwKSwwKTsKICBjb25zdCBmYWlscz1ULnJlZHVjZSgoYSx0KT0+YSsodC5mYWlsc3x8MCksMCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoUy5ydW5uaW5nPydSVU5OSU5HJzonSEFMVEVEJywnU3lzdGVtIFN0YXRlJyxTLnJ1bm5pbmc/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJyxTLnJ1bm5pbmc/J3dvcmsgZXhlY3V0aW5nJzonbm90aGluZyBydW5uaW5nJyl9CiAgICR7a3BpKG9uKycgLyAnK1QubGVuZ3RoLCdTdGFuZGluZyBPcmRlcnMgTGl2ZScsJ3ZhcigtLWN5KScsJ29uIHNjaGVkdWxlJyl9CiAgICR7a3BpKGZtdCh0b3RhbFJ1bnMpLCdKb2JzIEV4ZWN1dGVkJywndmFyKC0tZ3JuKScsUy50aWNrcysnIHNjaGVkdWxlciB0aWNrcycpfQogICAke2twaShmYWlscywnRmFpbHVyZXMnLGZhaWxzPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ3NpbmNlIGluc3RhbGwnKX08L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U3RhbmRpbmcgT3JkZXJzIDxzcGFuIGNsYXNzPSJ0YWcgJHtTLnJ1bm5pbmc/J3QtZ3JuJzondC1yZWQnfSI+JHtTLnJ1bm5pbmc/J0VYRUNVVElORyc6J0ZST1pFTid9PC9zcGFuPjwvaDM+CiAgICR7VC5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+Q2FwYWJpbGl0eTwvdGg+PHRoPk93bmVyIEFnZW50PC90aD48dGg+RXZlcnk8L3RoPjx0aD5MYXN0IFJ1bjwvdGg+PHRoPlJlc3VsdDwvdGg+PHRoPlJ1bnM8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7VC5tYXAodD0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2ModC5jYXApfTwvYj4KICAgICA8ZGl2IGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoKFMuY2Fwc3x8W10pLmZpbmQoYz0+Yy5jYXA9PT10LmNhcCk/LmRlc2N8fCcnKX08L2Rpdj48L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2ModC5vd25lcil9PC90ZD4KICAgIDx0ZD48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0id2lkdGg6NzRweDtwYWRkaW5nOjRweCA3cHgiIHR5cGU9Im51bWJlciIgdmFsdWU9IiR7dC5ldmVyeX0iCiAgICAgICAgb25jaGFuZ2U9InNldEV2ZXJ5KCcke3QuaWR9Jyx0aGlzLnZhbHVlKSIgdGl0bGU9InNlY29uZHMiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2V2ZXJ5KHQuZXZlcnkpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2Fnbyh0Lmxhc3RBdCl9PC90ZD4KICAgIDx0ZD4ke3QubGFzdE1zZz9gPHNwYW4gY2xhc3M9InRhZyAke3QubGFzdE9rPyd0LWdybic6J3QtcmVkJ30iPiR7dC5sYXN0T2s/J09LJzonRkFJTCd9PC9zcGFuPiAke2VzYyh0Lmxhc3RNc2cpfWA6JzxzcGFuIGNsYXNzPSJtb25vLWRpbSI+bm90IHlldCBydW48L3NwYW4+J308L3RkPgogICAgPHRkIGNsYXNzPSJtb25vLWRpbSI+JHt0LnJ1bnN8fDB9JHt0LmZhaWxzPycgPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPi8nK3QuZmFpbHMrJ+Kclzwvc3Bhbj4nOicnfTwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIHAiIG9uY2xpY2s9InJ1bk5vdygnJHt0LmlkfScpIj5SdW48L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InRvZ2dsZVRhc2soJyR7dC5pZH0nLCR7IXQuZW5hYmxlZH0pIj4ke3QuZW5hYmxlZD8nUGF1c2UnOidTdGFydCd9PC9idXR0b24+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIHN0YW5kaW5nIG9yZGVycy4gUG93ZXIgdGhlIHN5c3RlbSBvbiB0byBpbnN0YWxsIHRoZW0uPC9kaXY+J308L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RXhlY3V0aW9uIEZlZWQgPHNwYW4gY2xhc3M9InRhZyB0LWRpbSI+JHtSLmxlbmd0aH08L3NwYW4+PC9oMz4KICAgJHtSLmxlbmd0aD9gPGRpdiBjbGFzcz0ibG9nIj4ke1IubWFwKHI9PmA8ZGl2PjxzcGFuIGNsYXNzPSJ0cyI+JHtyLnR9PC9zcGFuPgogICAgIDxzcGFuIHN0eWxlPSJjb2xvcjoke3Iub2s/J3ZhcigtLWdybiknOid2YXIoLS1tYWcpJ30iPlske3Iub2s/J0RPTkUnOidGQUlMJ31dPC9zcGFuPgogICAgIDxiPiR7ZXNjKHIub3duZXIpfTwvYj4gwrcgJHtlc2Moci5jYXApfSDigJQgJHtlc2Moci5tc2cpfSR7ci5kZXRhaWw/YFxuICAgICAgICDihrMgJHtlc2Moci5kZXRhaWwpfWA6Jyd9CiAgICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj4oJHtyLm1zfW1zJHtyLm1hbnVhbD8nIMK3IG1hbnVhbCc6Jyd9KTwvc3Bhbj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gCiAgIDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vdGhpbmcgZXhlY3V0ZWQgeWV0LiBQb3dlciBvbiBhbmQgdGhlIGZpcnN0IHN3ZWVwIHJ1bnMgd2l0aGluIDEwIHNlY29uZHMuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLm9wcz0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MuaHVzdGxlPycjYTg1NWY3JzonIzY3NDcwZid9O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywke1MuaHVzdGxlPycjMWEwZjJlJzonIzE1MTAwYSd9LCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOiR7Uy5odXN0bGU/J3ZhcigtLXB1ciknOid2YXIoLS1hbWIpJ30iPuKaoSBIVVNUTEUgTU9ERSDigJQgJHtTLmh1c3RsZT8nRU5HQUdFRCc6J09GRid9PC9oMz4KICA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPiR7Uy5odXN0bGUKICAgP2A8Yj5NYXhpbXVtIG91dHB1dC48L2I+ICR7KFMudGFza3N8fFtdKS5sZW5ndGh9IG1vbmV5LWZvY3VzZWQgb3JkZXJzIHJ1bm5pbmcgb24gPGI+JHtTLmxhbmVzfHwzfSBwYXJhbGxlbCBsYW5lczwvYj4g4oCUIGlkZWFzLCByZXNlYXJjaCwgbWlzc2lvbnMsIHJldmVudWUgcm91dGVzLCBkZWVwIGludmVzdGlnYXRpb24uIEFsbCBmaXJpbmcgYXQgb25jZSwgbm90IG9uZSBhZnRlciBhbm90aGVyLmAKICAgOidTd2l0Y2hlcyB0aGUgcm9zdGVyIHRvIG1vbmV5LWdlbmVyYXRpbmcgd29yayBvbmx5LCB0aWdodGVucyBldmVyeSBpbnRlcnZhbCwgYW5kIHJ1bnMgdGFza3MgPGI+aW4gcGFyYWxsZWw8L2I+IGluc3RlYWQgb2Ygc2VxdWVudGlhbGx5LiBFeHBlY3Qgcm91Z2hseSAxMOKAkzIwIGNvbXBsZXRlZCBqb2JzIGluIHRoZSBmaXJzdCBob3VyLid9PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5QYXJhbGxlbCBsYW5lcyBmb3IgQUkgdGFza3M6PC9zcGFuPgogICA8c2VsZWN0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDo5MHB4IiBpZD0ibGFuZVNlbCIgb25jaGFuZ2U9InNldExhbmVzKHRoaXMudmFsdWUpIj4KICAgICR7WzEsMiwzLDQsNSw2XS5tYXAobj0+YDxvcHRpb24gdmFsdWU9IiR7bn0iICR7KFMubGFuZXN8fDMpPT1uPydzZWxlY3RlZCc6Jyd9PiR7bn08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD4KICAgPHNwYW4gY2xhc3M9Im1vbm8tZGltIj5IaWdoZXIgPSBmYXN0ZXIsIGJ1dCBmcmVlIEFJIHRpZXJzIHJhdGUtbGltaXQgYXJvdW5kIDMwIHJlcXVlc3RzL21pbi48L3NwYW4+PC9kaXY+CiAgPGRpdiBjbGFzcz0icm93Ij48aW5wdXQgY2xhc3M9ImluIiBzdHlsZT0ibWF4LXdpZHRoOjIyMHB4IiB0eXBlPSJwYXNzd29yZCIgaWQ9Imh1c3RsZVB3IiBwbGFjZWhvbGRlcj0iWW91ciBwYXNzd29yZCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biAke1MuaHVzdGxlPydubyc6J3AnfSIgb25jbGljaz0idG9nZ2xlSHVzdGxlKCkiPiR7Uy5odXN0bGU/J1NUQU5EIERPV04nOidFTkdBR0UgSFVTVExFIE1PREUnfTwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPiR7Uy5odXN0bGUKICAgPydTdGFuZGluZyBkb3duIHJlc3RvcmVzIHRoZSBub3JtYWwgbW9uaXRvcmluZyByb3N0ZXIuJwogICA6J1RoaXMgcmVwbGFjZXMgeW91ciBjdXJyZW50IHRhc2sgbGlzdC4gTW9uaXRvcmluZyBjb250aW51ZXMsIGJ1dCB0aGUgZW1waGFzaXMgc2hpZnRzIGhhcmQgdG8gcmV2ZW51ZS4nfTwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojMTU1ZTZiIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+4oK5IFNQRU5ESU5HIENFSUxJTkcg4oCUICR7Uy5idWRnZXQ/KCfigrknK2ZtdChTLmJ1ZGdldCkpOidOT1QgU0VUJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206OXB4Ij5IZSBjYW4gPGI+cmVxdWVzdDwvYj4gbW9uZXkgZm9yIGEgdmVudHVyZSDigJQgYSBkb21haW4sIGEgbGlzdGluZyBmZWUsIGEgc21hbGwgYWQgdGVzdC4gSGUgY2FuIG5ldmVyIHRha2UgaXQuIEV2ZXJ5IHJlcXVlc3QgYmVjb21lcyBhIGZyb3plbiBnYXRlIG5lZWRpbmcgeW91ciBzaWduYXR1cmUsIGFuZCBhbnl0aGluZyBhYm92ZSB0aGlzIGNlaWxpbmcgaXMgcmVmdXNlZCBvdXRyaWdodC48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MTUwcHgiIHR5cGU9Im51bWJlciIgaWQ9ImJ1ZGdldEFtdCIgcGxhY2Vob2xkZXI9ImUuZy4gMjAwMCIgdmFsdWU9IiR7Uy5idWRnZXR8fCcnfSI+CiAgIDxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjAwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0iYnVkZ2V0UHciIHBsYWNlaG9sZGVyPSJZb3VyIHBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNldEJ1ZGdldCgpIj5TRVQgQ0VJTElORzwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo4cHgiPkxpZmV0aW1lIGF1dGhvcml6ZWQgc3BlbmQgc28gZmFyOiA8Yj7igrkkeyhTLnNwZW5kfHwwKS50b0ZpeGVkKDIpfTwvYj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6JHtTLnJ1bm5pbmc/JyMxYzVjM2MnOicjNmIyMjMzJ307YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTYwZGVnLCR7Uy5ydW5uaW5nPycjMDgxNzBmJzonIzE2MGIwYyd9LCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOiR7Uy5ydW5uaW5nPyd2YXIoLS1ncm4pJzondmFyKC0tbWFnKSd9Ij7ilrYgTUFTVEVSIFBPV0VSIOKAlCAke1MucnVubmluZz8nU1lTVEVNIFJVTk5JTkcnOidTWVNURU0gSEFMVEVEJ308L2gzPgogIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+JHtTLnJ1bm5pbmcKICAgPydFdmVyeSBzdGFuZGluZyBvcmRlciBiZWxvdyBpcyBleGVjdXRpbmcgb24gaXRzIG93biBzY2hlZHVsZS4gVGhlIENoYWlybWFuIGlzIGRvaW5nIHJlYWwgd29yayByaWdodCBub3cg4oCUIHByb2JpbmcgeW91ciBzaXRlcywgYXVkaXRpbmcgdGhlIGxlZGdlciwgY29tcHV0aW5nIFNMQXMsIHdyaXRpbmcgYnJpZWZzIOKAlCB3aXRob3V0IHlvdSB0b3VjaGluZyBhbnl0aGluZy4nCiAgIDonPGI+Tm90aGluZyBpcyBydW5uaW5nLjwvYj4gU2lnbiBiZWxvdyB0byBicmluZyB0aGUgd2hvbGUgc3lzdGVtIG9ubGluZS4gT25jZSBydW5uaW5nIGl0IGRvZXMgbm90IHN0b3AgdW50aWwgeW91IGhhbHQgaXQuJ308L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciPjxpbnB1dCBjbGFzcz0iaW4iIHN0eWxlPSJtYXgtd2lkdGg6MjMwcHgiIHR5cGU9InBhc3N3b3JkIiBpZD0icHdyUHciIHBsYWNlaG9sZGVyPSJZb3VyIHBhc3N3b3JkIj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuICR7Uy5ydW5uaW5nPydubyc6J3AnfSIgb25jbGljaz0icG93ZXIoKSI+JHtTLnJ1bm5pbmc/J0hBTFQgRVZFUllUSElORyc6J1NUQVJUIEVWRVJZVEhJTkcnfTwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4gc20iIG9uY2xpY2s9InJlc2V0VGFza3MoKSI+UmVpbnN0YWxsIHN0YW5kaW5nIG9yZGVyczwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij5TY2hlZHVsZXIgdGlja3MgZXZlcnkgMTBzLiBPbmx5IHlvdSBjYW4gc3RhcnQgb3Igc3RvcCBpdCDigJQgbm90aGluZyBlbHNlIGNhbi48L2Rpdj48L2Rpdj4KIDxkaXYgZGF0YS1saXZlPSJvcHMiPiR7TElWRS5vcHMoKX08L2Rpdj5gOwphc3luYyBmdW5jdGlvbiBwb3dlcigpewogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvcG93ZXInLHtvbjohUy5ydW5uaW5nLHB3OnB3clB3LnZhbHVlfSk7IHJlbmRlcigpOwogICAgZmxhc2goUy5ydW5uaW5nPydTWVNURU0gUlVOTklORyDigJQgYWdlbnRzIGV4ZWN1dGluZyc6J1N5c3RlbSBoYWx0ZWQnKTsKICB9Y2F0Y2goZSl7IGZsYXNoKGUubWVzc2FnZSkgfQp9CmFzeW5jIGZ1bmN0aW9uIHNldEV2ZXJ5KGlkLHYpeyBhd2FpdCBBUEkoJy9hcGkvcnVudGltZS90YXNrJyx7aWQsZXZlcnk6K3Z9KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVUYXNrKGlkLG9uKXsgYXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvdGFzaycse2lkLGVuYWJsZWQ6b259KTsgcmVuZGVyKCkgfQphc3luYyBmdW5jdGlvbiBydW5Ob3coaWQpeyBmbGFzaCgnRXhlY3V0aW5n4oCmJyk7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3J1bm5vdycse2lkfSk7IHJlbmRlcigpOyBmbGFzaChyLm1zZykgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0gfQphc3luYyBmdW5jdGlvbiByZXNldFRhc2tzKCl7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL3Jlc2V0Jyx7fSk7IHJlbmRlcigpOyBmbGFzaCgnU3RhbmRpbmcgb3JkZXJzIHJlaW5zdGFsbGVkJykgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVIdXN0bGUoKXsKICBjb25zdCBwdz0oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2h1c3RsZVB3Jyl8fHt9KS52YWx1ZTsKICBpZighcHcpIHJldHVybiBmbGFzaCgnUGFzc3dvcmQgcmVxdWlyZWQg4oCUIHRoaXMgY2hhbmdlcyBob3cgaGFyZCBoZSB3b3JrcycpOwogIGZsYXNoKFMuaHVzdGxlPydTdGFuZGluZyBkb3du4oCmJzonRW5nYWdpbmcgaHVzdGxlIG1vZGXigKYnKTsKICB0cnl7IGNvbnN0IHI9YXdhaXQgQVBJKCcvYXBpL3J1bnRpbWUvaHVzdGxlJyx7b246IVMuaHVzdGxlLHB3LGxhbmVzOlMubGFuZXN8fDN9KTsKICAgIHJlbmRlcigpOyBmbGFzaChTLmh1c3RsZT9gSFVTVExFIEVOR0FHRUQg4oCUICR7ci50YXNrc30gb3JkZXJzIGZpcmluZyBpbiBwYXJhbGxlbGA6J1N0b29kIGRvd24gdG8gbm9ybWFsIHJvc3RlcicpOwogIH1jYXRjaChlKXsgZmxhc2goZS5tZXNzYWdlKSB9Cn0KYXN5bmMgZnVuY3Rpb24gc2V0TGFuZXMobil7IGF3YWl0IEFQSSgnL2FwaS9ydW50aW1lL2xhbmVzJyx7bGFuZXM6K259KTsgcmVuZGVyKCk7IGZsYXNoKCdMYW5lczogJytuKSB9CmFzeW5jIGZ1bmN0aW9uIHNldEJ1ZGdldCgpewogIGNvbnN0IHB3PShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnVkZ2V0UHcnKXx8e30pLnZhbHVlOwogIGlmKCFwdykgcmV0dXJuIGZsYXNoKCdQYXNzd29yZCByZXF1aXJlZCcpOwogIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NwZW5kL2J1ZGdldCcse2J1ZGdldDorYnVkZ2V0QW10LnZhbHVlfHwwLHB3fSk7IHJlbmRlcigpOwogICAgZmxhc2goJ0NlaWxpbmcgc2V0IOKAlCBoZSBjYW4gcmVxdWVzdCB1cCB0byB0aGlzLCBuZXZlciB0YWtlIGl0Jyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQoKLyogLS0tLS0tLS0tLSBTRUxGLVVQR1JBREUgLS0tLS0tLS0tLSAqLwpMSVZFLmV2b2x2ZT0oKT0+ewogIGNvbnN0IFA9KFMucHJvcG9zYWxzfHxbXSkuZmlsdGVyKHA9PnAuc3RhdHVzPT09J1BFTkRJTkcnKTsKICBjb25zdCBFPVMuZXZvbHV0aW9ufHxbXTsKICBjb25zdCBhcHBsaWVkPUUuZmlsdGVyKGU9PmUuZGVjaXNpb249PT0nQVBQTElFRCcpLmxlbmd0aDsKICBjb25zdCByZWplY3RlZD1FLmZpbHRlcihlPT5lLmRlY2lzaW9uPT09J1JFSkVDVEVEJykubGVuZ3RoOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZ3JpZCBnNCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTNweCI+CiAgICR7a3BpKFAubGVuZ3RoLCdVcGdyYWRlcyBBd2FpdGluZyBZb3UnLFAubGVuZ3RoPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsUC5sZW5ndGg/J25lZWRzIHlvdXIgc2lnbmF0dXJlJzonbm90aGluZyBwZW5kaW5nJyl9CiAgICR7a3BpKGFwcGxpZWQsJ1VwZ3JhZGVzIEFwcGxpZWQnLCd2YXIoLS1ncm4pJywnbGlmZXRpbWUnKX0KICAgJHtrcGkocmVqZWN0ZWQsJ1JlamVjdGVkJywndmFyKC0tZGltKScsJ25ldmVyIHJlLXByb3Bvc2VkJyl9CiAgICR7a3BpKFMuc2NhbkNvdW50fHwwLCdTZWxmLVNjYW5zIFJ1bicsJ3ZhcigtLWN5KScsJ2V2ZXJ5IDYwIHNlY29uZHMnKX08L2Rpdj4KICAke1AubGVuZ3RoP1AubWFwKHA9PmA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiR7cC5rbGFzcz09PSdTQUZFJz8nIzFjNWMzYyc6JyM2NzQ3MGYnfSI+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7cC5rbGFzcz09PSdTQUZFJz8ndC1ncm4nOid0LWFtYid9Ij4ke3Aua2xhc3N9PC9zcGFuPgogICAgICA8Yj4ke2VzYyhwLmxhYmVsKX08L2I+PC9kaXY+PHNwYW4gY2xhc3M9Im1vbm8tZGltIj4ke3AuaWR9IMK3ICR7cC50fTwvc3Bhbj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206N3B4Ij4ke2VzYyhwLndoeSl9PC9kaXY+CiAgICAke3AuZXZpZGVuY2U/YDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo5cHgiPkV2aWRlbmNlOiAke2VzYyhwLmV2aWRlbmNlKX08L2Rpdj5gOicnfQogICAgPGxhYmVsIGNsYXNzPSJmIiBzdHlsZT0ibWF4LXdpZHRoOjMyMHB4Ij48c3Bhbj5TaWduIHdpdGggeW91ciBwYXNzd29yZCB0byBhdXRob3JpemU8L3NwYW4+CiAgICAgPGlucHV0IGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiIGlkPSJwd18ke3AuaWR9IiBhdXRvY29tcGxldGU9Im9mZiI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIG9rIiBvbmNsaWNrPSJkZWNpZGVVcCgnJHtwLmlkfScsMSkiPkFVVEhPUklaRSBVUEdSQURFPC9idXR0b24+CiAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJkZWNpZGVVcCgnJHtwLmlkfScsMCkiPlJFSkVDVCBQRVJNQU5FTlRMWTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZXJyIiBpZD0iZXJfJHtwLmlkfSI+PC9kaXY+PC9kaXY+YCkuam9pbignJykKICAgOmA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gdXBncmFkZXMgcGVuZGluZy4gVGhlIENoYWlybWFuIHNjYW5zIGl0c2VsZiBldmVyeSA2MCBzZWNvbmRzIGFuZCB3aWxsIHJhaXNlIGEgcHJvcG9zYWwgaGVyZSB0aGUgbW9tZW50IGl0IGZpbmRzIGEgcmVhbCB3ZWFrbmVzcyDigJQgYSBmbGFreSBzaXRlLCBhbiBleHBpcmluZyBjZXJ0aWZpY2F0ZSwgYW4gdW5zdGFmZmVkIGZsb29yLCBhIHNlY3VyaXR5IGdhcC48L2Rpdj48L2Rpdj5gfQogIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Fdm9sdXRpb24gSGlzdG9yeTwvaDM+CiAgICR7RS5sZW5ndGg/YDxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRoZWFkPjx0cj48dGg+V2hlbjwvdGg+PHRoPkNoYW5nZTwvdGg+PHRoPkRlY2lzaW9uPC90aD48dGg+UmVzdWx0PC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAke0UubWFwKGU9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlLnR9PC90ZD48dGQ+JHtlc2MoZS5sYWJlbCl9PGRpdiBjbGFzcz0ibW9uby1kaW0iPiR7ZXNjKGUud2h5fHwnJyl9PC9kaXY+PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnICR7ZS5kZWNpc2lvbj09PSdBUFBMSUVEJz8ndC1ncm4nOid0LXJlZCd9Ij4ke2UuZGVjaXNpb259PC9zcGFuPgogICAgIDxkaXYgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLmhvd3x8JycpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhlLnJlc3VsdHx8JycpfTwvdGQ+PC90cj5gKS5qb2luKCcnKX0KICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PmA6JzxkaXYgY2xhc3M9Im1vbm8tZGltIj5UaGUgQ2hhaXJtYW4gaGFzIG5vdCBjaGFuZ2VkIGl0c2VsZiB5ZXQuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLmV2b2x2ZT0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjojNGEzMDgwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMTQwZjIyLCMwYTBmMTYpIj4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLXB1cikiPuKfsyBDT05USU5VT1VTIFNFTEYtVVBHUkFERTwvaDM+CiAgPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5UaGUgQ2hhaXJtYW4gYXVkaXRzIGl0cyBvd24gc3RhdGUgZXZlcnkgNjAgc2Vjb25kcyBhZ2FpbnN0IHJlYWwgdGVsZW1ldHJ5IOKAlCB1cHRpbWUgcmVjb3JkcywgVExTIGV4cGlyeSwgYXV0aCBmYWlsdXJlcywgbGVkZ2VyIHNpemUsIGZsb29yIHN0YWZmaW5nLCBtYWlsIHJlYWRpbmVzcy4gV2hlbiBpdCBmaW5kcyBhIGdlbnVpbmUgd2Vha25lc3MgaXQgcHJvcG9zZXMgYSBmaXggaGVyZSBhbmQgPGI+ZnJlZXplcyB1bnRpbCB5b3Ugc2lnbiBpdDwvYj4uPC9kaXY+CiAgPHVsIGNsYXNzPSJ0aWdodCI+CiAgIDxsaT48Yj5Ob3RoaW5nIHNlbGYtaW5zdGFsbHMgYnkgZGVmYXVsdC48L2I+IEV2ZXJ5IHVwZ3JhZGUgbmVlZHMgeW91ciBwYXNzd29yZCwgc2FtZSBhcyBhIHBlcm1pc3Npb24gZ2F0ZS48L2xpPgogICA8bGk+PGI+U0FGRTwvYj4gPSByZXZlcnNpYmxlIHR1bmluZyAocHJvYmUgaW50ZXJ2YWxzLCBsZWRnZXIgY29tcGFjdGlvbiwgc2tpbGxzKS4gPGI+UkVWSUVXPC9iPiA9IGNoYW5nZXMgeW91ciByb3N0ZXIgb3IgcmFpc2VzIGEgc2VjdXJpdHkgZ2F0ZS48L2xpPgogICA8bGk+UmVqZWN0IG9uY2UgYW5kIGl0IGlzIDxiPnN1cHByZXNzZWQgcGVybWFuZW50bHk8L2I+IOKAlCB0aGUgQ2hhaXJtYW4gd2lsbCBub3QgbmFnIHlvdSBhYm91dCBpdCBhZ2Fpbi48L2xpPgogICA8bGk+SXQgcHJvcG9zZXMgb25seSBvbiBldmlkZW5jZSBmcm9tIHlvdXIgYWN0dWFsIHJ1bm5pbmcgc3lzdGVtLiBJdCBkb2VzIG5vdCBpbnZlbnQgd29yay48L2xpPgogIDwvdWw+CiAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNjYW5Ob3coKSI+UlVOIFNFTEYtU0NBTiBOT1c8L2J1dHRvbj4KICAgPHNwYW4gY2xhc3M9InRhZyAke1MuYXV0b3BpbG90Pyd0LXJlZCc6J3QtZGltJ30iPkFVVE9QSUxPVCAke1MuYXV0b3BpbG90PydPTic6J09GRid9PC9zcGFuPgogIDwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJvcmRlci1jb2xvcjoke1MuYXV0b3BpbG90PycjNmIyMjMzJzondmFyKC0tbGluZSknfSI+CiAgPGgzPkF1dG9waWxvdCAke1MuYXV0b3BpbG90Pyc8c3BhbiBjbGFzcz0idGFnIHQtcmVkIj5BQ1RJVkU8L3NwYW4+JzonJ308L2gzPgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij5XaXRoIGF1dG9waWxvdCBvbiwgPGI+U0FGRS1jbGFzczwvYj4gdXBncmFkZXMgYXBwbHkgdGhlbXNlbHZlcyB0aGUgbW9tZW50IHRoZXkgYXJlIGZvdW5kIOKAlCBubyBzaWduYXR1cmUuIFJFVklFVy1jbGFzcyBhbHdheXMgd2FpdHMgZm9yIHlvdSByZWdhcmRsZXNzLiBFdmVyeSBhdXRvbm9tb3VzIGNoYW5nZSBpcyBzdGlsbCB3cml0dGVuIHRvIHRoZSBldm9sdXRpb24gaGlzdG9yeS4gVGhpcyBpcyByZWFsIGF1dG9ub215OiB0dXJuIGl0IG9uIG9ubHkgaWYgeW91IGFjY2VwdCB0aGUgQ2hhaXJtYW4gY2hhbmdpbmcgaXRzIG93biB0dW5pbmcgd2hpbGUgeW91IHNsZWVwLjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGlucHV0IGNsYXNzPSJpbiIgc3R5bGU9Im1heC13aWR0aDoyMjBweCIgdHlwZT0icGFzc3dvcmQiIGlkPSJhcFB3IiBwbGFjZWhvbGRlcj0iQ29uZmlybSBwYXNzd29yZCI+CiAgIDxidXR0b24gY2xhc3M9ImJ0biAke1MuYXV0b3BpbG90Pydubyc6J3AnfSIgb25jbGljaz0idG9nZ2xlQXV0bygpIj4ke1MuYXV0b3BpbG90PydESVNBQkxFIEFVVE9QSUxPVCc6J0VOQUJMRSBBVVRPUElMT1QnfTwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9ImV2b2x2ZSI+JHtMSVZFLmV2b2x2ZSgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGRlY2lkZVVwKGlkLG9rKXsKICBjb25zdCBlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcl8nK2lkKTsgZS50ZXh0Q29udGVudD0nJzsKICBjb25zdCBwdz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHdfJytpZCkudmFsdWU7CiAgaWYoIXB3KSByZXR1cm4gZS50ZXh0Q29udGVudD0nU2lnbmF0dXJlIHJlcXVpcmVkLic7CiAgdHJ5eyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS91cGdyYWRlL2RlY2lkZScse2lkLG9rOiEhb2sscHd9KTsKICAgIHJlbmRlcigpOyBmbGFzaChvaz8oJ1VQR1JBREVEIMK3ICcrKHIucmVzdWx0fHwnJykpOidSZWplY3RlZCBwZXJtYW5lbnRseScpOwogIH1jYXRjaCh4KXsgZS50ZXh0Q29udGVudD14Lm1lc3NhZ2UgfQp9CmFzeW5jIGZ1bmN0aW9uIHNjYW5Ob3coKXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9zY2FuJyx7fSk7IHJlbmRlcigpOwogIGZsYXNoKHIucGVuZGluZz9yLnBlbmRpbmcrJyB1cGdyYWRlKHMpIGF3YWl0aW5nIHlvdXIgc2lnbmF0dXJlJzonU2NhbiBjbGVhbiDigJQgbm90aGluZyB0byBpbXByb3ZlJykgfQphc3luYyBmdW5jdGlvbiB0b2dnbGVBdXRvKCl7CiAgdHJ5eyBhd2FpdCBBUEkoJy9hcGkvdXBncmFkZS9hdXRvcGlsb3QnLHtvbjohUy5hdXRvcGlsb3QscHc6YXBQdy52YWx1ZX0pOyByZW5kZXIoKTsKICAgIGZsYXNoKFMuYXV0b3BpbG90PydBVVRPUElMT1QgT04g4oCUIHNhZmUgdXBncmFkZXMgbm93IHNlbGYtYXBwbHknOidBdXRvcGlsb3Qgb2ZmJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQoKLyogLS0tLS0tLS0tLSBMRUFSTkVEIFNLSUxMUyAtLS0tLS0tLS0tICovClJFTkRFUi5za2lsbHMyPSgpPT57CiAgY29uc3QgSz1TLnNraWxsc3x8W107CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VGVhY2ggdGhlIENoYWlybWFuIDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UEVSU0lTVFMgRk9SRVZFUjwvc3Bhbj48L2gzPgogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTFweCI+QW55dGhpbmcgeW91IHRlYWNoIGlzIHN0b3JlZCBzZXJ2ZXItc2lkZSBhbmQgc3Vydml2ZXMgcmVzdGFydHMsIHJlZGVwbG95cyBhbmQgZXZlcnkgZGV2aWNlIHlvdSBsb2cgaW4gZnJvbS4gVGVhY2ggaXQgeW91ciBzaG9ydGhhbmQsIHlvdXIgcnVuYm9va3MsIHlvdXIgc3RhbmRpbmcgb3JkZXJzLjwvZGl2PgogICA8ZGl2IGNsYXNzPSJncmlkIGczIj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VHJpZ2dlciBwaHJhc2U8L3NwYW4+PGlucHV0IGlkPSJza1BocmFzZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0ibW9ybmluZyBjaGVjayI+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+V2hhdCBpdCBtZWFucyAvIGRvZXM8L3NwYW4+PGlucHV0IGlkPSJza0FjdGlvbiIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iU2NhbiBhbGwgbW9uaXRvcnMgYW5kIHJlcG9ydCBhbnl0aGluZyBiZWxvdyA5OSUiPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlR5cGU8L3NwYW4+PHNlbGVjdCBpZD0ic2tLaW5kIiBjbGFzcz0iaW4iPgogICAgIDxvcHRpb24gdmFsdWU9Im5vdGUiPlN0YW5kaW5nIG9yZGVyPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iYWxpYXMiPkNvbW1hbmQgc2hvcnRjdXQ8L29wdGlvbj4KICAgICA8b3B0aW9uIHZhbHVlPSJydW5ib29rIj5SdW5ib29rIHN0ZXA8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJwb2xpY3kiPlBvbGljeSBydWxlPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj4KICAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InRlYWNoKCkiPlRFQUNIIElUPC9idXR0b24+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPktub3duIFNraWxscyA8c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke0subGVuZ3RofTwvc3Bhbj48L2gzPgogICAke0subGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlBocmFzZTwvdGg+PHRoPk1lYW5pbmc8L3RoPjx0aD5UeXBlPC90aD48dGg+VXNlZDwvdGg+PHRoPkxlYXJuZWQ8L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICR7Sy5tYXAocz0+YDx0cj48dGQ+PGIgc3R5bGU9ImNvbG9yOnZhcigtLWN5KSI+JHtlc2Mocy5waHJhc2UpfTwvYj48L3RkPjx0ZD4ke2VzYyhzLmFjdGlvbil9PC90ZD4KICAgIDx0ZD48c3BhbiBjbGFzcz0idGFnIHQtZGltIj4ke2VzYyhzLmtpbmQpfTwvc3Bhbj48L3RkPjx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7cy51c2VzfHwwfcOXPC90ZD4KICAgIDx0ZCBjbGFzcz0ibW9uby1kaW0iPiR7cy5sZWFybmVkfTxkaXY+JHtlc2Mocy5vcmlnaW58fCdvd25lcicpfTwvZGl2PjwvdGQ+CiAgICA8dGQgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHNtIiBvbmNsaWNrPSJ1c2VTa2lsbCgnJHtlc2Mocy5waHJhc2UpfScpIj5SZWNhbGw8L2J1dHRvbj4KICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gbm8iIG9uY2xpY2s9ImZvcmdldCgnJHtlc2Mocy5waHJhc2UpfScpIj5Gb3JnZXQ8L2J1dHRvbj48L3RkPjwvdHI+YCkuam9pbignJyl9CiAgIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm90aGluZyB0YXVnaHQgeWV0LiBUcnkgcGhyYXNlICJtb3JuaW5nIGNoZWNrIiDihpIgIlNjYW4gYWxsIG1vbml0b3JzIGFuZCByZXBvcnQgYW55dGhpbmcgYmVsb3cgOTklIGF2YWlsYWJpbGl0eSIuPC9kaXY+J308L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gdGVhY2goKXsKICB0cnl7IGF3YWl0IEFQSSgnL2FwaS9za2lsbC90ZWFjaCcse3BocmFzZTpza1BocmFzZS52YWx1ZSxhY3Rpb246c2tBY3Rpb24udmFsdWUsa2luZDpza0tpbmQudmFsdWV9KTsKICAgIHJlbmRlcigpOyBmbGFzaCgnU2tpbGwgbGVhcm5lZCDigJQgaXQgcGVyc2lzdHMgYWNyb3NzIHJlc3RhcnRzJyk7CiAgfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH0KfQphc3luYyBmdW5jdGlvbiBmb3JnZXQocCl7IGlmKCFjb25maXJtKCdGb3JnZXQgIicrcCsnIj8nKSlyZXR1cm47IGF3YWl0IEFQSSgnL2FwaS9za2lsbC9mb3JnZXQnLHtwaHJhc2U6cH0pOyByZW5kZXIoKSB9CmFzeW5jIGZ1bmN0aW9uIHVzZVNraWxsKHApeyBjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9za2lsbC91c2UnLHtwaHJhc2U6cH0pOyByZW5kZXIoKTsKICBtb2RhbChgPGgzPiR7ZXNjKHApfTwvaDM+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbjowIj48ZGl2PiR7ZXNjKHIuYWN0aW9uKX08L2Rpdj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEzcHgiPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY2xvc2VNb2RhbCgpIj5DbG9zZTwvYnV0dG9uPjwvZGl2PmApIH0KCi8qIC0tLS0tLS0tLS0gVVBUSU1FIE1BUlNIQUwgLS0tLS0tLS0tLSAqLwpmdW5jdGlvbiB1cEJhcihtKXsKICBjb25zdCBoPShtLmhpc3Rvcnl8fFtdKS5zbGljZSgtNDApOwogIGlmKCFoLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9ImZvbnQtc2l6ZToxMHB4Ij5ubyBjaGVja3MgeWV0PC9kaXY+JzsKICByZXR1cm4gJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6MnB4O2FsaWduLWl0ZW1zOmZsZXgtZW5kO2hlaWdodDoyNnB4Ij4nK2gubWFwKHg9PgogICBgPGRpdiB0aXRsZT0iJHt4LnR9IMK3IEhUVFAgJHt4LmNvZGV9IMK3ICR7eC5tc31tcyIgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6M3B4O2hlaWdodDoke3gub2s/TWF0aC5tYXgoMzAsTWF0aC5taW4oMTAwLDEwMC14Lm1zLzI1KSk6MTAwfSU7YmFja2dyb3VuZDoke3gub2s/JyMzMWQ2N2EnOicjZmYzYjZiJ307Ym9yZGVyLXJhZGl1czoxcHg7b3BhY2l0eTouOSI+PC9kaXY+YCkuam9pbignJykrJzwvZGl2Pic7Cn0KTElWRS51cHRpbWU9KCk9PnsKICBjb25zdCBNPVMubW9uaXRvcnN8fFtdLCBkb3duPU0uZmlsdGVyKG09Pm0uc3RhdGU9PT0nRE9XTicpLmxlbmd0aDsKICBjb25zdCB0b3Q9TS5yZWR1Y2UoKGEsbSk9PmErKG0uY2hlY2tzfHwwKSwwKSwgdXBzPU0ucmVkdWNlKChhLG0pPT5hKyhtLnVwfHwwKSwwKTsKICBjb25zdCBhdmFpbD10b3Q/KCh1cHMvdG90KSoxMDApLnRvRml4ZWQoMik6J+KAlCc7CiAgY29uc3QgYXZnPU0uZmlsdGVyKG09Pm0ubGFzdE1zKS5sZW5ndGg/TWF0aC5yb3VuZChNLnJlZHVjZSgoYSxtKT0+YSsobS5sYXN0TXN8fDApLDApL00uZmlsdGVyKG09Pm0ubGFzdE1zKS5sZW5ndGgpOjA7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJncmlkIGc0IiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkoTS5sZW5ndGgsJ1RhcmdldHMgTW9uaXRvcmVkJywndmFyKC0tY3kpJywncHJvYmUgZXZlcnkgMTVzJyl9CiAgICR7a3BpKGRvd24sJ0N1cnJlbnRseSBEb3duJyxkb3duPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsZG93bj8nSU5DSURFTlQgQUNUSVZFJzonYWxsIHJlYWNoYWJsZScpfQogICAke2twaShhdmFpbCsoYXZhaWw9PT0n4oCUJz8nJzonJScpLCdBdmFpbGFiaWxpdHknLCd2YXIoLS1ncm4pJyx0b3QrJyBjaGVja3MnKX0KICAgJHtrcGkoYXZnKycgbXMnLCdBdmcgUmVzcG9uc2UnLGF2Zz4xNTAwPyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKScsJ2xhc3QgY3ljbGUnKX08L2Rpdj4KICAke00ubGVuZ3RoP00ubWFwKG09PnsKICAgIGNvbnN0IGE9bS5jaGVja3M/KChtLnVwL20uY2hlY2tzKSoxMDApLnRvRml4ZWQoMik6JzAuMDAnOwogICAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJjYXJkIj48ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjlweCI+CiAgICAgPGRpdiBjbGFzcz0icm93Ij48c3BhbiBjbGFzcz0idGFnICR7bS5zdGF0ZT09PSdVUCc/J3QtZ3JuJzptLnN0YXRlPT09J0RPV04nPyd0LXJlZCc6J3QtZGltJ30iPiR7bS5zdGF0ZX08L3NwYW4+CiAgICAgIDxiPiR7ZXNjKG0ubmFtZSl9PC9iPjxzcGFuIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MobS51cmwpfTwvc3Bhbj48L2Rpdj4KICAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSBubyIgb25jbGljaz0iZGVsTW9uKCcke20uaWR9JykiPlVuYmluZDwvYnV0dG9uPjwvZGl2PjwvZGl2PgogICAgJHt1cEJhcihtKX0KICAgIDxkaXYgY2xhc3M9InR3IiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPjx0YWJsZT48dGJvZHk+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJ3aWR0aDoxNTBweCI+TGFzdCBjaGVjazwvdGQ+PHRkPiR7bS5sYXN0QXR8fCfigJQnfSDCtyBIVFRQICR7bS5sYXN0U3RhdHVzfHwn4oCUJ30ke20ubGFzdEVycj8nIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj4nK2VzYyhtLmxhc3RFcnIpKyc8L3NwYW4+JzonJ308L3RkPjwvdHI+CiAgICAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxhdGVuY3k8L3RkPjx0ZD4ke20ubGFzdE1zfHwwfSBtcyAocDk1ICR7bS5wOTV8fDB9IG1zKTwvdGQ+PC90cj4KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+QXZhaWxhYmlsaXR5PC90ZD48dGQgc3R5bGU9ImNvbG9yOiR7YT45OT8ndmFyKC0tZ3JuKSc6YT45NT8ndmFyKC0tYW1iKSc6J3ZhcigtLW1hZyknfSI+JHthfSUgwrcgJHttLnVwfHwwfSB1cCAvICR7bS5kb3dufHwwfSBkb3duIG9mICR7bS5jaGVja3N8fDB9PC90ZD48L3RyPgogICAgICR7bS5zc2w/YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5UTFMgY2VydGlmaWNhdGU8L3RkPjx0ZD4ke2VzYyhtLnNzbC5pc3N1ZXIpfSDCtyBleHBpcmVzIGluIDxzcGFuIHN0eWxlPSJjb2xvcjoke20uc3NsLmRheXNfbGVmdDwxND8ndmFyKC0tbWFnKSc6bS5zc2wuZGF5c19sZWZ0PDQ1Pyd2YXIoLS1hbWIpJzondmFyKC0tZ3JuKSd9Ij4ke20uc3NsLmRheXNfbGVmdH0gZGF5czwvc3Bhbj48L3RkPjwvdHI+YDonJ30KICAgICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+SW50ZXJ2YWw8L3RkPjx0ZD4ke20uaW50ZXJ2YWx9cyDCtyBib3VuZCAke20uYWRkZWR9PC90ZD48L3RyPgogICAgPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9KS5qb2luKCcnKQogICA6JzxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9Im1vbm8tZGltIj5ObyB0YXJnZXRzIGJvdW5kLiBBZGQgeW91ciBsaXZlIHNpdGVzIGFuZCBhcHBzIGJlbG93IOKAlCB0aGUgVXB0aW1lIE1hcnNoYWwgd2lsbCBwcm9iZSB0aGVtIGZvciByZWFsLjwvZGl2PjwvZGl2Pid9CiAgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkluY2lkZW50IEhpc3Rvcnk8L2gzPiR7KFMuaW5jaWRlbnRzfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogICA8dGhlYWQ+PHRyPjx0aD5UaW1lPC90aD48dGg+VGFyZ2V0PC90aD48dGg+VHJhbnNpdGlvbjwvdGg+PHRoPkRldGFpbDwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgJHtTLmluY2lkZW50cy5tYXAoaT0+YDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2kudH08L3RkPjx0ZD4ke2VzYyhpLm5hbWUpfTwvdGQ+CiAgICA8dGQ+PHNwYW4gY2xhc3M9InRhZyAke2kudG89PT0nRE9XTic/J3QtcmVkJzondC1ncm4nfSI+JHtpLmZyb219IOKGkiAke2kudG99PC9zcGFuPjwvdGQ+CiAgICA8dGQgY2xhc3M9Im1vbm8tZGltIj4ke2VzYyhpLmRldGFpbCl9PC90ZD48L3RyPmApLmpvaW4oJycpfQogIDwvdGJvZHk+PC90YWJsZT48L2Rpdj5gOic8ZGl2IGNsYXNzPSJtb25vLWRpbSI+Tm8gc3RhdGUgdHJhbnNpdGlvbnMgcmVjb3JkZWQuIE5vdGhpbmcgaGFzIGZsYXBwZWQuPC9kaXY+J308L2Rpdj5gfTsKUkVOREVSLnVwdGltZT0oKT0+YAogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkJpbmQgVGFyZ2V0IDxzcGFuIGNsYXNzPSJ0YWcgdC1jeSI+UkVBTCBIVFRQIFBST0JFUzwvc3Bhbj48L2gzPgogIDxkaXYgY2xhc3M9ImdyaWQgZzMiPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlVSTDwvc3Bhbj48aW5wdXQgaWQ9Im1VcmwiIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9Imh0dHBzOi8veW91cnNpdGUuY29tIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkxhYmVsIChvcHRpb25hbCk8L3NwYW4+PGlucHV0IGlkPSJtTmFtZSIgY2xhc3M9ImluIiBwbGFjZWhvbGRlcj0iTWFpbiBzaXRlIj48L2xhYmVsPgogICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkludGVydmFsIChzZWMsIG1pbiAxNSk8L3NwYW4+PGlucHV0IGlkPSJtSW50IiBjbGFzcz0iaW4iIHR5cGU9Im51bWJlciIgdmFsdWU9IjYwIj48L2xhYmVsPjwvZGl2PgogIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9ImFkZE1vbigpIj5CSU5EICZhbXA7IFBST0JFIE5PVzwvYnV0dG9uPgogICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZWNrTm93KCkiPkZPUkNFIENIRUNLIEFMTDwvYnV0dG9uPjwvZGl2PgogIDxkaXYgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0ibWFyZ2luLXRvcDo5cHgiPlByb2JlcyBmb2xsb3cgdXAgdG8gMyByZWRpcmVjdHMsIHJlYWQgVExTIGV4cGlyeSwgYW5kIHJlY29yZCBwOTUgbGF0ZW5jeS4gT24gYW55IFVQ4oaURE9XTiB0cmFuc2l0aW9uIHRoZSBVcHRpbWUgTWFyc2hhbCB3cml0ZXMgYSBDUklUIGluY2lkZW50IGFuZCBmaXJlcyBhbiBlbWFpbCB0aHJvdWdoIHRoZSBNYWlsIFJlbGF5LjwvZGl2PjwvZGl2PgogPGRpdiBkYXRhLWxpdmU9InVwdGltZSI+JHtMSVZFLnVwdGltZSgpfTwvZGl2PmA7CmFzeW5jIGZ1bmN0aW9uIGFkZE1vbigpe3RyeXthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9hZGQnLHt1cmw6bVVybC52YWx1ZS50cmltKCksbmFtZTptTmFtZS52YWx1ZS50cmltKCksaW50ZXJ2YWw6K21JbnQudmFsdWV8fDYwfSk7CiByZW5kZXIoKTtmbGFzaCgnVGFyZ2V0IGJvdW5kIMK3IHByb2JpbmcnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gZGVsTW9uKGlkKXtpZighY29uZmlybSgnVW5iaW5kIHRoaXMgdGFyZ2V0PycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvbW9uaXRvci9yZW1vdmUnLHtpZH0pO3JlbmRlcigpfQphc3luYyBmdW5jdGlvbiBjaGVja05vdygpe2ZsYXNoKCdQcm9iaW5nIGFsbCB0YXJnZXRz4oCmJyk7YXdhaXQgQVBJKCcvYXBpL21vbml0b3IvY2hlY2snLHt9KTtyZW5kZXIoKTtmbGFzaCgnUHJvYmUgY3ljbGUgY29tcGxldGUnKX0KCi8qIC0tLS0tLS0tLS0gTUFJTCBSRUxBWSAtLS0tLS0tLS0tICovClJFTkRFUi5tYWlsPSgpPT57CiAgY29uc3Qgc3Q9Uy5zbXRwLCBtcz1TLm1haWxzdGF0fHx7c2VudDowLGZhaWxlZDowfTsKICByZXR1cm4gYCR7IXN0P2A8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij48aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPk5PIE9VVEJPVU5EIE1BSUw8L2gzPgogICA8ZGl2PkV2ZXJ5IDJGQSBub3RpZmljYXRpb24gYW5kIG91dGFnZSBhbGVydCBpcyBiZWluZyByZWNvcmRlZCBhcyBhbiA8Yj5pbnRlbnQgb25seTwvYj4uIENvbmZpZ3VyZSB5b3VyIG93biBTTVRQIHJlbGF5IGJlbG93IHRvIG1ha2UgdGhlbSByZWFsLiBUaGUgQ2hhaXJtYW4gd2lsbCBuZXZlciBhc2sgZm9yIHRoZXNlIGluIGNoYXQg4oCUIHlvdSBlbnRlciB0aGVtIGhlcmUsIGFuZCB0aGUgcGFzc3dvcmQgaXMgbmV2ZXIgd3JpdHRlbiB0byB0aGUgYXVkaXQgbGVkZ2VyLjwvZGl2PjwvZGl2PmAKICA6YDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzFjNWMzYztiYWNrZ3JvdW5kOiMwODE3MGYiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+UkVMQVkgQVJNRUQ8L2gzPgogICA8ZGl2Pk91dGJvdW5kIGVtYWlsIGlzIGxpdmUgdmlhICR7ZXNjKHN0Lmhvc3QpfToke3N0LnBvcnR9LiAke21zLnNlbnR9IGRlbGl2ZXJlZCwgJHttcy5mYWlsZWR9IGZhaWxlZCB0aGlzIHByb2Nlc3MuPC9kaXY+PC9kaXY+YH0KICA8ZGl2IGNsYXNzPSJncmlkIGczIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxM3B4Ij4KICAgJHtrcGkobXMuc2VudCwnRGVsaXZlcmVkJywndmFyKC0tZ3JuKScsJ3RoaXMgcHJvY2VzcycpfQogICAke2twaShtcy5mYWlsZWQsJ0ZhaWxlZCcsbXMuZmFpbGVkPyd2YXIoLS1tYWcpJzondmFyKC0tZ3JuKScsJ3RoaXMgcHJvY2VzcycpfQogICAke2twaShzdD8nQVJNRUQnOidPRkZMSU5FJywnUmVsYXkgU3RhdHVzJyxzdD8ndmFyKC0tZ3JuKSc6J3ZhcigtLW1hZyknLHN0P2VzYyhzdC5ob3N0KTonaW50ZW50LW9ubHkgbW9kZScpfTwvZGl2PgogIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+U01UUCBDb25maWd1cmF0aW9uPC9oMz4KICAgIDxkaXYgY2xhc3M9Indhcm5ib3giPlVzZSBhbiA8Yj5hcHAtc3BlY2lmaWMgcGFzc3dvcmQ8L2I+LCBuZXZlciB5b3VyIG1haW4gYWNjb3VudCBwYXNzd29yZC4gR21haWw6IDxjb2RlPnNtdHAuZ21haWwuY29tOjU4NzwvY29kZT4uIE91dGxvb2s6IDxjb2RlPnNtdHAtbWFpbC5vdXRsb29rLmNvbTo1ODc8L2NvZGU+LiBab2hvOiA8Y29kZT5zbXRwLnpvaG8uY29tOjU4NzwvY29kZT4uIEFsbCBmcmVlIHRpZXJzIOKAlCBubyBwYWlkIHNlcnZpY2UgcmVxdWlyZWQuPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlNNVFAgSG9zdDwvc3Bhbj48aW5wdXQgaWQ9InNIb3N0IiBjbGFzcz0iaW4iIHBsYWNlaG9sZGVyPSJzbXRwLmdtYWlsLmNvbSIgdmFsdWU9IiR7c3Q/ZXNjKHN0Lmhvc3QpOicnfSI+PC9sYWJlbD4KICAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPlBvcnQ8L3NwYW4+PGlucHV0IGlkPSJzUG9ydCIgY2xhc3M9ImluIiB0eXBlPSJudW1iZXIiIHZhbHVlPSIke3N0P3N0LnBvcnQ6NTg3fSI+PC9sYWJlbD48L2Rpdj4KICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+VXNlcm5hbWU8L3NwYW4+PGlucHV0IGlkPSJzVXNlciIgY2xhc3M9ImluIiBhdXRvY29tcGxldGU9Im9mZiIgcGxhY2Vob2xkZXI9InlvdUBnbWFpbC5jb20iPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkFwcCBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9InNQYXNzIiBjbGFzcz0iaW4iIHR5cGU9InBhc3N3b3JkIiBhdXRvY29tcGxldGU9Im5ldy1wYXNzd29yZCI+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogICAgIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+RnJvbSBBZGRyZXNzPC9zcGFuPjxpbnB1dCBpZD0ic0Zyb20iIGNsYXNzPSJpbiIgcGxhY2Vob2xkZXI9InlvdUBnbWFpbC5jb20iIHZhbHVlPSIke3N0P2VzYyhzdC5mcm9tKTonJ30iPjwvbGFiZWw+CiAgICAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Gcm9tIE5hbWU8L3NwYW4+PGlucHV0IGlkPSJzTmFtZSIgY2xhc3M9ImluIiB2YWx1ZT0iJHtzdD9lc2Moc3QubmFtZSk6J0NoYWlybWFuIEFnZW50IE9TJ30iPjwvbGFiZWw+PC9kaXY+CiAgICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkltcGxpY2l0IFRMUyAocG9ydCA0NjUpPC9zcGFuPjxzZWxlY3QgaWQ9InNTZWMiIGNsYXNzPSJpbiI+CiAgICAgPG9wdGlvbiB2YWx1ZT0iMCIgJHtzdCYmIXN0LnNlY3VyZT8nc2VsZWN0ZWQnOicnfT5ObyDigJQgU1RBUlRUTFMgb24gNTg3PC9vcHRpb24+CiAgICAgPG9wdGlvbiB2YWx1ZT0iMSIgJHtzdCYmc3Quc2VjdXJlPydzZWxlY3RlZCc6Jyd9PlllcyDigJQgU01UUFMgb24gNDY1PC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgIDxkaXYgY2xhc3M9InJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InNhdmVTbXRwKCkiPkFSTSBSRUxBWTwvYnV0dG9uPgogICAgIDxidXR0b24gY2xhc3M9ImJ0biBvayIgb25jbGljaz0idGVzdFNtdHAoKSI+U0VORCBURVNUIEVNQUlMPC9idXR0b24+CiAgICAgJHtzdD8nPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJwdXJnZVNtdHAoKSI+UHVyZ2U8L2J1dHRvbj4nOicnfTwvZGl2PjwvZGl2PgogICA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+RGVsaXZlcnkgTG9nPC9oMz4keyhTLm1haWxxfHxbXSkubGVuZ3RoP2A8ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPgogICAgPHRoZWFkPjx0cj48dGg+VGltZTwvdGg+PHRoPlN1YmplY3Q8L3RoPjx0aD5TdGF0dXM8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke1MubWFpbHEubWFwKG09PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHttLnR9PC90ZD48dGQ+JHtlc2MobS5zdWJqZWN0KX08ZGl2IGNsYXNzPSJtb25vLWRpbSI+4oaSICR7ZXNjKG0udG8pfTwvZGl2PjwvdGQ+CiAgICAgPHRkPjxzcGFuIGNsYXNzPSJ0YWcgJHsvREVMSVZFUkVELy50ZXN0KG0uc3RhdHVzKT8ndC1ncm4nOi9VTlNFTlQvLnRlc3QobS5zdGF0dXMpPyd0LWFtYic6J3QtcmVkJ30iPiR7ZXNjKG0uc3RhdHVzKX08L3NwYW4+PC90ZD48L3RyPmApLmpvaW4oJycpfQogICA8L3Rib2R5PjwvdGFibGU+PC9kaXY+YDonPGRpdiBjbGFzcz0ibW9uby1kaW0iPk5vIG1haWwgYXR0ZW1wdGVkIHlldC48L2Rpdj4nfQogICA8ZGl2IGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+VGFyZ2V0IGluYm94OiA8Yj4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvYj4uIENoYW5nZSBpdCBpbiBPd25lciBTZXR0aW5ncy48L2Rpdj48L2Rpdj4KICA8L2Rpdj5gfTsKYXN5bmMgZnVuY3Rpb24gc2F2ZVNtdHAoKXsKIHRyeXsgYXdhaXQgQVBJKCcvYXBpL3NtdHAnLHtob3N0OnNIb3N0LnZhbHVlLnRyaW0oKSxwb3J0OitzUG9ydC52YWx1ZXx8NTg3LHNlY3VyZTpzU2VjLnZhbHVlPT09JzEnLAogICB1c2VyOnNVc2VyLnZhbHVlLnRyaW0oKSxwYXNzOnNQYXNzLnZhbHVlLGZyb206c0Zyb20udmFsdWUudHJpbSgpLG5hbWU6c05hbWUudmFsdWUudHJpbSgpfSk7CiAgcmVuZGVyKCk7IGZsYXNoKCdSZWxheSBhcm1lZCDigJQgc2VuZCBhIHRlc3QgZW1haWwgdG8gY29uZmlybScpOwogfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH19CmFzeW5jIGZ1bmN0aW9uIHRlc3RTbXRwKCl7IGZsYXNoKCdEaWFsaW5nIFNNVFAgcmVsYXnigKYnKTsKIHRyeXsgY29uc3Qgcj1hd2FpdCBBUEkoJy9hcGkvc210cC90ZXN0Jyx7fSk7IHJlbmRlcigpOwogIGZsYXNoKHIub2s/J0RFTElWRVJFRCDigJQgY2hlY2sgeW91ciBpbmJveCc6J0ZBSUxFRDogJysoci5yZWFzb258fCd1bmtub3duJykpOwogfWNhdGNoKGUpeyBmbGFzaChlLm1lc3NhZ2UpIH19CmFzeW5jIGZ1bmN0aW9uIHB1cmdlU210cCgpeyBpZighY29uZmlybSgnUHVyZ2UgcmVsYXk/IE1haWwgcmV2ZXJ0cyB0byBpbnRlbnQtb25seS4nKSlyZXR1cm47CiBhd2FpdCBBUEkoJy9hcGkvc210cC9wdXJnZScse30pOyByZW5kZXIoKTsgZmxhc2goJ1JlbGF5IHB1cmdlZCcpIH0KCi8qIC0tLS0tLS0tLS0gREVWSUNFUyAtLS0tLS0tLS0tICovClJFTkRFUi5kZXZpY2VzPSgpPT57Y29uc3QgdD1TLnRlbGVtZXRyeTsKIHJldHVybiBgPGRpdiBjbGFzcz0iY2FyZCI+PGgzPkxpdmUgTXVsdGktRGV2aWNlIFN5bmMgPHNwYW4gY2xhc3M9InRhZyB0LWdybiI+UkVBTDwvc3Bhbj48L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5TdGF0ZSBsaXZlcyBvbiB0aGUgc2VydmVyLCBub3QgdGhlIGJyb3dzZXIuIEV2ZXJ5IGRldmljZSBwb2xscyBldmVyeSAzIHNlY29uZHMgYW5kIGFkb3B0cyByZXZpc2lvbiBjaGFuZ2VzIGF1dG9tYXRpY2FsbHkuPC9saT4KICA8bGk+Q3VycmVudCBzdGF0ZSByZXZpc2lvbiA8Yj4ke1MucmV2fTwvYj4gwrcgPGI+JHt0LmxpdmVfc2Vzc2lvbnN9PC9iPiBzZXNzaW9uKHMpIGFjdGl2ZSBpbiB0aGUgbGFzdCA3MHMuPC9saT4KICA8bGk+T3BlbiB0aGlzIHNhbWUgVVJMIG9uIHlvdXIgcGhvbmUsIGxvZyBpbiB3aXRoIHRoZSBzYW1lIE93bmVyIElELCBhbmQgYm90aCBzY3JlZW5zIHRyYWNrIGVhY2ggb3RoZXIuIFJhaXNlIGEgZ2F0ZSBvbiBvbmUsIGl0IGFwcGVhcnMgb24gdGhlIG90aGVyLjwvbGk+CiAgPGxpPjxiPlNlc3Npb25zIGFyZSBkdXJhYmxlLjwvYj4gV3JpdHRlbiB0byA8Y29kZT5zZXNzaW9ucy5qc29uPC9jb2RlPiAoY2htb2QgNjAwKSB3aXRoIGEgMzAtZGF5IFRUTCDigJQgcmVzdGFydGluZyB0aGUgc2VydmVyIG5vIGxvbmdlciBsb2dzIHlvdSBvdXQuIFJldm9raW5nIGJlbG93IGtpbGxzIGV2ZXJ5IGRldmljZSBleGNlcHQgdGhpcyBvbmUuPC9saT48L3VsPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlNlc3Npb24gTG9nPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0aGVhZD48dHI+PHRoPklEPC90aD48dGg+SVA8L3RoPjx0aD5Vc2VyIEFnZW50PC90aD48dGg+QXQ8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgJHtTLmRldmljZXMubWFwKGQ9PmA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC5pZCl9PC90ZD48dGQ+JHtlc2MoZC5pcHx8J+KAlCcpfTwvdGQ+PHRkIGNsYXNzPSJtb25vLWRpbSI+JHtlc2MoZC51YSl9PC90ZD48dGQgY2xhc3M9Im1vbm8tZGltIj4ke2QuYXR9PC90ZD48L3RyPmApLmpvaW4oJycpfHwnPHRyPjx0ZCBjb2xzcGFuPSI0IiBjbGFzcz0ibW9uby1kaW0iPm5vbmU8L3RkPjwvdHI+J30KIDwvdGJvZHk+PC90YWJsZT48L2Rpdj4KIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJyZXZva2UoKSI+UkVWT0tFIEFMTCBPVEhFUiBTRVNTSU9OUzwvYnV0dG9uPjwvZGl2PjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlRoaXMgRGV2aWNlPC9oMz48ZGl2IGNsYXNzPSJ0dyI+PHRhYmxlPjx0Ym9keT4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSIgc3R5bGU9IndpZHRoOjE3MHB4Ij5WaWV3cG9ydDwvdGQ+PHRkPiR7aW5uZXJXaWR0aH0gw5cgJHtpbm5lckhlaWdodH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkxheW91dDwvdGQ+PHRkPiR7aW5uZXJXaWR0aDw4NjA/J01PQklMRSDCtyBjb2xsYXBzZWQgc2lkZWJhcic6J0RFU0tUT1AgwrcgZml4ZWQgc2lkZWJhcid9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5UcmFuc3BvcnQ8L3RkPjx0ZD4ke2xvY2F0aW9uLnByb3RvY29sfSDCtyBwb2xsIDNzPC90ZD48L3RyPgogPC90Ym9keT48L3RhYmxlPjwvZGl2PjwvZGl2PmB9Owphc3luYyBmdW5jdGlvbiByZXZva2UoKXtjb25zdCByPWF3YWl0IEFQSSgnL2FwaS9zZXNzaW9ucy9yZXZva2UnLHt9KTtyZW5kZXIoKTtmbGFzaChyLnJldm9rZWQrJyBzZXNzaW9uKHMpIHJldm9rZWQnKX0KCi8qIC0tLS0tLS0tLS0gRE9DVFJJTkUgLS0tLS0tLS0tLSAqLwpSRU5ERVIuZG9jdHJpbmU9KCk9PmA8ZGl2IGNsYXNzPSJncmlkIGcyIj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz5Db3JlIE1hbmRhdGU8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT48Yj5aZXJvIHN1Z2FyLWNvYXRpbmcuPC9iPiBGYWlsdXJlcywgYm90dGxlbmVja3MgYW5kIHJpc2tzIHJlcG9ydGVkIGF0IGZ1bGwgc2V2ZXJpdHksIHVuc29mdGVuZWQuPC9saT4KICA8bGk+PGI+VW5jb21wcm9taXNpbmcgb3ZlcnNpZ2h0LjwvYj4gRXZlcnkgc3ViLWFnZW50LCB0b29sIGNhbGwsIGRlcGxveW1lbnQgYW5kIHRyYW5zYWN0aW9uIHBhc3NlcyBhIGdhdGUuPC9saT4KICA8bGk+PGI+T3duZXIgcHJpbWFjeS48L2I+IEF1dGhvcml0eSBmbG93cyBmcm9tIHRoZSB2ZXJpZmllZCBPd25lciBvbmx5LiBObyBwdWJsaWMgdXNlciwgZXh0ZXJuYWwgcmVxdWVzdCBvciBzdWItYWdlbnQgYnlwYXNzZXMgYSBnYXRlLjwvbGk+CiAgPGxpPjxiPlplcm8gY29zdC48L2I+IFRoZSBDaGFpcm1hbiByb3V0ZXMgYXJvdW5kIGV2ZXJ5IHBheXdhbGwgcmF0aGVyIHRoYW4gZnVuZGluZyBpdC48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+R2F0ZSBTT1A8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT4xIMK3IE9iamVjdGl2ZSwgc3VjY2VzcyBjcml0ZXJpYSwgb3BlcmF0aW9uYWwgYm91bmRhcmllcy48L2xpPgogIDxsaT4yIMK3IEp1c3RpZnkgZXZlcnkgYXNzaWduZWQgYWdlbnQgYW5kIHRvb2wuPC9saT4KICA8bGk+MyDCtyBFbnVtZXJhdGUgcm9sbGJhY2ssIGF1ZGl0cywgbWl0aWdhdGlvbnMuPC9saT4KICA8bGk+NCDCtyBIYWx0IHVudGlsIE93bmVyIGNyeXB0b2dyYXBoaWMgY2xlYXJhbmNlIGlzIHNpZ25lZCDigJQgZW5mb3JjZWQgYnkgdGhlIHNlcnZlciwgbm90IHRoZSBVSS48L2xpPjwvdWw+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+VHJlYXN1cnkgU2FmZWd1YXJkczwvaDM+PHVsIGNsYXNzPSJ0aWdodCI+CiAgPGxpPkNyZWRlbnRpYWxzIG5ldmVyIHJlcXVlc3RlZCBpbiBjaGF0LCBuZXZlciB3cml0dGVuIHRvIGFueSBsb2cuPC9saT4KICA8bGk+T3duZXIgZW50ZXJzIHBheW91dCBkZXRhaWxzIG9ubHkgaW4gdGhlIGlzb2xhdGVkIFZhdWx0IHBhbmVsOyBvbmx5IG1hc2tlZCB2YWx1ZXMgYXJlIHBlcnNpc3RlZC48L2xpPgogIDxsaT5UcmFuc2ZlcnMgcmVxdWlyZSBwYXNzd29yZCBzaWduYXR1cmU7IHNlcnZlciBoYXJkLWJsb2NrcyB3aXRoIG5vIHNlYWxlZCBjaGFubmVsLjwvbGk+PC91bD48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJib3JkZXItY29sb3I6IzZiMjIzMyI+PGgzIHN0eWxlPSJjb2xvcjp2YXIoLS1tYWcpIj5Ib25lc3QgTGltaXRzIOKAlCBSZWFkIFRoaXM8L2gzPjx1bCBjbGFzcz0idGlnaHQiPgogIDxsaT5QZXJzaXN0ZW5jZSBpcyBhIEpTT04gZmlsZSBvbiB0aGlzIHNlcnZlci4gS2lsbCB0aGUgc2FuZGJveCBhbmQgaXQgZGllcyB3aXRoIGl0IOKAlCBleHBvcnQgdGhlIGF1ZGl0IGxlZGdlciBpZiBpdCBtYXR0ZXJzLjwvbGk+CiAgPGxpPjxzIHN0eWxlPSJjb2xvcjp2YXIoLS1kaW0yKSI+Tm8gb3V0Ym91bmQgbmV0d29yay48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IHJlYWwgU01UUCBjbGllbnQgKG5vZGU6bmV0ICsgbm9kZTp0bHMsIHplcm8gZGVwcykuIEFybSBpdCBpbiBNYWlsIFJlbGF5IHdpdGggeW91ciBvd24gYXBwIHBhc3N3b3JkIGFuZCAyRkEgYmVjb21lcyBkZWxpdmVyZWQgbWFpbCwgbm90IGludGVudC48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPlRlbGVtZXRyeSBpcyBvbmx5IHRoaXMgcHJvY2Vzcy48L3M+IDxiIHN0eWxlPSJjb2xvcjp2YXIoLS1ncm4pIj5GSVhFRDo8L2I+IFVwdGltZSBNYXJzaGFsIHJ1bnMgcmVhbCBIVFRQL0hUVFBTIHByb2JlcyBhZ2FpbnN0IGFueSBVUkwgeW91IGJpbmQg4oCUIHN0YXR1cywgbGF0ZW5jeSwgcDk1LCBUTFMgZXhwaXJ5LCBpbmNpZGVudCB0cmFuc2l0aW9ucy48L2xpPgogIDxsaT48cyBzdHlsZT0iY29sb3I6dmFyKC0tZGltMikiPlNlc3Npb25zIGFyZSBpbi1tZW1vcnkuPC9zPiA8YiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JuKSI+RklYRUQ6PC9iPiBkdXJhYmxlIHRvIGRpc2ssIDMwLWRheSBUVEwsIHN1cnZpdmVzIHJlc3RhcnQuPC9saT4KICA8bGk+PGI+U3RpbGwgdHJ1ZTo8L2I+IFNNVFAgY3JlZGVudGlhbHMgc2l0IGluIDxjb2RlPmRhdGEuanNvbjwvY29kZT4gb24gdGhpcyBib3guIFRoYXQgaXMgc3RhbmRhcmQgZm9yIGEgc2VsZi1ob3N0ZWQgcmVsYXksIGJ1dCBpdCBpcyBub3QgYSBoYXJkd2FyZSB2YXVsdCDigJQgdXNlIGFuIGFwcC1zcGVjaWZpYyBwYXNzd29yZCB5b3UgY2FuIHJldm9rZSwgbmV2ZXIgeW91ciBwcmltYXJ5IG9uZS48L2xpPgogIDxsaT48Yj5TdGlsbCB0cnVlOjwvYj4gcHJvYmVzIHJ1biBmcm9tIHRoaXMgc2FuZGJveC4gSWYgdGhlIHNhbmRib3ggaGFzIG5vIHJvdXRlIHRvIGEgaG9zdCwgdGhhdCByZWFkcyBhcyBET1dOIGV2ZW4gd2hlbiB0aGUgaG9zdCBpcyBmaW5lLiBWZXJpZnkgYW4gb3V0YWdlIGJlZm9yZSBhY3Rpbmcgb24gaXQuPC9saT4KICA8bGk+WmVyby1Db3N0IG1lYW5zIGxhd2Z1bCBmcmVlIHJvdXRlcyBvbmx5IOKAlCBuZXZlciBwaXJhY3ksIHN0b2xlbiBrZXlzIG9yIFRvUyBldmFzaW9uLjwvbGk+PC91bD48L2Rpdj48L2Rpdj5gOwoKLyogLS0tLS0tLS0tLSBTRVRUSU5HUyAtLS0tLS0tLS0tICovClJFTkRFUi5zZXR0aW5ncz0oKT0+YDxkaXYgY2xhc3M9ImdyaWQgZzIiPgogJHtTLm93bmVyLmJvb3RzdHJhcD9gPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImdyaWQtY29sdW1uOjEvLTE7Ym9yZGVyLWNvbG9yOiM2YjIyMzM7YmFja2dyb3VuZDojMTQwODA5Ij4KICA8aDMgc3R5bGU9ImNvbG9yOnZhcigtLW1hZykiPuKaoCBCT09UU1RSQVAgQ1JFREVOVElBTCBBQ1RJVkU8L2gzPgogIDxkaXY+VGhlIHNlcnZlci1nZW5lcmF0ZWQgcGFzc3dvcmQgaXMgc3RpbGwgaW4gZm9yY2UgYW5kIGEgcGxhaW50ZXh0IGNvcHkgc2l0cyBpbiA8Y29kZT5PV05FUl9DUkVERU5USUFMUy50eHQ8L2NvZGU+LiBSb3RhdGUgbm93IOKAlCByb3RhdGlvbiBkZWxldGVzIHRoYXQgZmlsZSBhdXRvbWF0aWNhbGx5LjwvZGl2PjwvZGl2PmA6Jyd9CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+SWRlbnRpdHk8L2gzPjxkaXYgY2xhc3M9InR3Ij48dGFibGU+PHRib2R5PgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIiBzdHlsZT0id2lkdGg6MTYwcHgiPk93bmVyIElEPC90ZD48dGQ+JHtlc2MoUy5vd25lci5pZCl9PC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj5QYXNzd29yZDwvdGQ+PHRkPlBCS0RGMi1TSEEyNTYgwrcgMTUwayBpdGVyYXRpb25zIMK3IHNlcnZlci1zaWRlPC90ZD48L3RyPgogIDx0cj48dGQgY2xhc3M9Im1vbm8tZGltIj4yRkEgRW1haWw8L3RkPjx0ZD4ke21hc2tNYWlsKFMub3duZXIuZW1haWwpfTwvdGQ+PC90cj4KICA8dHI+PHRkIGNsYXNzPSJtb25vLWRpbSI+UHJvdmlzaW9uZWQ8L3RkPjx0ZD4ke1Mub3duZXIuY3JlYXRlZH08L3RkPjwvdHI+CiAgPHRyPjx0ZCBjbGFzcz0ibW9uby1kaW0iPkRvY3RyaW5lPC90ZD48dGQ+PHNwYW4gY2xhc3M9InRhZyB0LWFtYiI+WkVSTy1DT1NUIEVORk9SQ0VEPC9zcGFuPjwvdGQ+PC90cj48L3Rib2R5PjwvdGFibGU+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Um90YXRlIFBhc3N3b3JkPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPkN1cnJlbnQ8L3NwYW4+PGlucHV0IGlkPSJycE9sZCIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyAobWluIDgpPC9zcGFuPjxpbnB1dCBpZD0icnBOZXciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIHAiIG9uY2xpY2s9InJvdGF0ZSgpIj5ST1RBVEU8L2J1dHRvbj48ZGl2IGNsYXNzPSJlcnIiIGlkPSJycEVyciI+PC9kaXY+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIj48aDM+Q2hhbmdlIE93bmVyIElEPC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyBPd25lciBJRDwvc3Bhbj48aW5wdXQgaWQ9ImlkTmV3IiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGxhYmVsIGNsYXNzPSJmIj48c3Bhbj5Db25maXJtIFBhc3N3b3JkPC9zcGFuPjxpbnB1dCBpZD0iaWRQdyIgY2xhc3M9ImluIiB0eXBlPSJwYXNzd29yZCI+PC9sYWJlbD4KICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9ImNoZ0lkKCkiPlVQREFURSBJRDwvYnV0dG9uPjxkaXYgY2xhc3M9ImVyciIgaWQ9ImlkRXJyIj48L2Rpdj48L2Rpdj4KIDxkaXYgY2xhc3M9ImNhcmQiPjxoMz4yRkEgVGFyZ2V0PC9oMz4KICA8bGFiZWwgY2xhc3M9ImYiPjxzcGFuPk5ldyBFbWFpbDwvc3Bhbj48aW5wdXQgaWQ9ImVtTmV3IiBjbGFzcz0iaW4iPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjaGdNYWlsKCkiPlVQREFURTwvYnV0dG9uPjwvZGl2PgogPGRpdiBjbGFzcz0iY2FyZCI+PGgzPlJvc3RlcjwvaDM+PGRpdiBjbGFzcz0ibW9uby1kaW0iIHN0eWxlPSJtYXJnaW4tYm90dG9tOjlweCI+UmVzdG9yZSB0aGUgMTggZGVmYXVsdCBzdWItYWdlbnRzLjwvZGl2PgogIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0icmVzZXRSb3N0ZXIoKSI+UkVTRVQgUk9TVEVSPC9idXR0b24+PC9kaXY+CiA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iYm9yZGVyLWNvbG9yOiM2YjIyMzMiPjxoMyBzdHlsZT0iY29sb3I6dmFyKC0tbWFnKSI+RGVzdHJ1Y3RpdmU8L2gzPgogIDxsYWJlbCBjbGFzcz0iZiI+PHNwYW4+Q29uZmlybSBQYXNzd29yZDwvc3Bhbj48aW5wdXQgaWQ9IndwUHciIGNsYXNzPSJpbiIgdHlwZT0icGFzc3dvcmQiPjwvbGFiZWw+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIG5vIiBvbmNsaWNrPSJ3aXBlKCkiPldJUEUgRU5USVJFIElOU1RBTkNFPC9idXR0b24+PC9kaXY+PC9kaXY+YDsKYXN5bmMgZnVuY3Rpb24gcm90YXRlKCl7Y29uc3QgZT1ycEVycjtlLnRleHRDb250ZW50PScnOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9yb3RhdGUnLHtvbGQ6cnBPbGQudmFsdWUsbmV1OnJwTmV3LnZhbHVlfSk7cmVuZGVyKCk7Zmxhc2goJ1Bhc3N3b3JkIHJvdGF0ZWQgwrcgYm9vdHN0cmFwIGZpbGUgZGVzdHJveWVkJyl9Y2F0Y2goeCl7ZS50ZXh0Q29udGVudD14Lm1lc3NhZ2V9fQphc3luYyBmdW5jdGlvbiBjaGdJZCgpe2NvbnN0IGU9aWRFcnI7ZS50ZXh0Q29udGVudD0nJzsKIHRyeXthd2FpdCBBUEkoJy9hcGkvb3duZXIvaWQnLHtuZXdpZDppZE5ldy52YWx1ZS50cmltKCkscHc6aWRQdy52YWx1ZX0pO3JlbmRlcigpO2ZsYXNoKCdPd25lciBJRCB1cGRhdGVkJyl9Y2F0Y2goeCl7ZS50ZXh0Q29udGVudD14Lm1lc3NhZ2V9fQphc3luYyBmdW5jdGlvbiBjaGdNYWlsKCl7dHJ5e2F3YWl0IEFQSSgnL2FwaS9vd25lci9lbWFpbCcse2VtYWlsOmVtTmV3LnZhbHVlLnRyaW0oKX0pO3JlbmRlcigpO2ZsYXNoKCcyRkEgdGFyZ2V0IHVwZGF0ZWQnKX1jYXRjaChlKXtmbGFzaChlLm1lc3NhZ2UpfX0KYXN5bmMgZnVuY3Rpb24gcmVzZXRSb3N0ZXIoKXtpZighY29uZmlybSgnUmVzZXQgcm9zdGVyPycpKXJldHVybjthd2FpdCBBUEkoJy9hcGkvYWdlbnQvcmVzZXQnLHt9KTtyZW5kZXIoKTtmbGFzaCgnUm9zdGVyIHJlc2V0Jyl9CmFzeW5jIGZ1bmN0aW9uIHdpcGUoKXtpZighY29uZmlybSgnSVJSRVZFUlNJQkxFLiBEZXN0cm95IGFsbCBzZXJ2ZXIgc3RhdGU/JykpcmV0dXJuOwogdHJ5e2F3YWl0IEFQSSgnL2FwaS93aXBlJyx7cHc6d3BQdy52YWx1ZX0pO2xvY2F0aW9uLnJlbG9hZCgpfWNhdGNoKGUpe2ZsYXNoKGUubWVzc2FnZSl9fQoKLyogLS0tLS0tLS0tLSBNT0RBTCAtLS0tLS0tLS0tICovCmZ1bmN0aW9uIG1vZGFsKGh0bWwpe2Nsb3NlTW9kYWwoKTtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO2QuY2xhc3NOYW1lPSdtb2RhbCc7ZC5pZD0nbWRsJzsKIGQuaW5uZXJIVE1MPWA8ZGl2IGNsYXNzPSJtYm94Ij4ke2h0bWx9PC9kaXY+YDtkLm9uY2xpY2s9ZT0+e2lmKGUudGFyZ2V0PT09ZCljbG9zZU1vZGFsKCl9O2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZCl9CmZ1bmN0aW9uIGNsb3NlTW9kYWwoKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWRsJyk/LnJlbW92ZSgpfQphZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxlPT57aWYoZS5rZXk9PT0nRXNjYXBlJyl7Y2xvc2VNb2RhbCgpO2Nsb3NlU2IoKX19KTsKYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywoKT0+e2lmKGN1cj09PSdlbmdpbmUnKWRyYXdFbmdpbmUoKX0pOwo=','base64')
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

