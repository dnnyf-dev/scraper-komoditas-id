import { SEED } from './seed.js';
import { getAll } from './bi.js';

const CACHE_KEY = new Request('https://komoditas-id-cache.internal/state');
const DEFAULT_REFRESH = 10;
const TTL_SECONDS = 900;
const MIN_GAP_MS = 30000;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.FRONTEND_URL || '*').split(',').map(s => s.trim()).filter(Boolean);
  const allow = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
function json(data, request, env, status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(request,env)}});}
function initialState(){return {commodities:SEED.commodities.map(c=>({...c,history:[],last_updated:null,data_status:'seed'})),status:'cadangan',lastUpdated:null,lastAttempt:null,error:null};}
// Penyimpanan: pakai KV (binding STATE) bila ada. Cache API TIDAK bekerja di domain *.workers.dev,
// jadi tanpa KV data live tidak akan tersimpan antar-request.
let MEM=null;
async function readCache(env){if(env?.STATE){try{const v=await env.STATE.get('state','json');if(v)return v}catch{}}
  try{const r=await caches.default.match(CACHE_KEY);if(r)return await r.json()}catch{}
  return MEM;}
async function writeCache(state,env){MEM=state;if(env?.STATE){try{await env.STATE.put('state',JSON.stringify(state));return}catch{}}
  try{await caches.default.put(CACHE_KEY,new Response(JSON.stringify(state),{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${TTL_SECONDS}`}}));}catch{}}
function addHistory(c,price,now){if(!Array.isArray(c.history))c.history=[];const date=now.slice(0,10),last=c.history[c.history.length-1];if(last&&last.date===date)last.price=price;else c.history.push({date,price});if(c.history.length>30)c.history=c.history.slice(-30);}
function dailyChange(c,price){const today=new Date().toISOString().slice(0,10);const prev=[...(c.history||[])].reverse().find(h=>h.date!==today&&Number(h.price)>0);return prev?Number((((price-Number(prev.price))/Number(prev.price))*100).toFixed(2)):0;}
async function refresh(env,{force=false}={}){let state=await readCache(env)||initialState();
  if(!force&&state.lastAttempt&&Date.now()-Date.parse(state.lastAttempt)<MIN_GAP_MS)return {status:state.status,lastUpdated:state.lastUpdated,lastAttempt:state.lastAttempt,throttled:true};
  state.lastAttempt=new Date().toISOString();let liveCount=0;const failures={};const timeout=Math.max(3000,Number(env.BI_TIMEOUT_MS||12000));
  const res=await getAll(state.commodities.map(c=>c.id),timeout);const now=new Date().toISOString();
  for(const c of state.commodities){const p=res[c.id];if(!p?.ok){failures[c.id]=p?.error||'gagal';continue;}
    if(Array.isArray(p.series)&&p.series.length){c.history=p.series.slice(-30).map(h=>({date:h.date,price:h.price}));}else addHistory(c,p.price,now);
    c.price=p.price;c.change_pct=p.change_pct==null?dailyChange(c,p.price):p.change_pct;c.source='BI PIHPS (live)';c.location='Nasional';c.data_status='live';c.price_date=p.date;c.last_updated=now;liveCount++;}
  const failCount=Object.keys(failures).length;
  state.lastUpdated=liveCount?now:state.lastUpdated;state.status=liveCount?'aktif':'cadangan';
  state.error=liveCount?(failCount?`${failCount} komoditas gagal diperbarui.`:null):'Tidak ada harga live yang berhasil dibaca dari PIHPS.';
  state.failures=failures;state.refreshMinutes=Math.max(2,Number(env.REFRESH_MINUTES||DEFAULT_REFRESH));await writeCache(state,env);
  return {status:state.status,lastUpdated:state.lastUpdated,lastAttempt:state.lastAttempt,successCount:liveCount,failureCount:failCount,failures};
}
async function getState(env){return await readCache(env)||initialState();}
// Segarkan otomatis saat dibaca: belum pernah live -> tunggu sekali; basi -> refresh di latar belakang.
async function getFreshState(env,ctx){let s=await getState(env);
  const maxAge=Math.max(2,Number(env.REFRESH_MINUTES||DEFAULT_REFRESH))*60000;
  const age=s.lastUpdated?Date.now()-Date.parse(s.lastUpdated):Infinity;
  if(age===Infinity){try{await refresh(env);}catch{}s=await getState(env);}
  else if(age>maxAge){const p=refresh(env).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(p);}
  return s;}
export default {
  async fetch(request, env, ctx) {
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request,env)});
    const url=new URL(request.url), path=url.pathname;
    if(path==='/api/health'){const s=await getFreshState(env,ctx);return json({ok:true,status:s.status,lastUpdated:s.lastUpdated},request,env);}
    if(path==='/api/refresh'&&(request.method==='POST'||request.method==='GET')){try{return json(await refresh(env,{force:url.searchParams.get('force')==='1'}),request,env)}catch(e){return json({status:'cadangan',error:e.message},request,env,500);}}
    if(path==='/api/commodities'){const s=await getFreshState(env,ctx);return json({status:s.status,lastUpdated:s.lastUpdated,lastAttempt:s.lastAttempt,error:s.error,refreshMinutes:s.refreshMinutes||DEFAULT_REFRESH,data:s.commodities},request,env);}
    if(path==='/api/meta'){const s=await getFreshState(env,ctx);return json({status:s.status,lastUpdated:s.lastUpdated,lastAttempt:s.lastAttempt,error:s.error,refreshMinutes:s.refreshMinutes||DEFAULT_REFRESH,source:'PIHPS Nasional - Bank Indonesia'},request,env);}
    if(path.startsWith('/api/commodity/')){const id=decodeURIComponent(path.slice('/api/commodity/'.length)),s=await getState(env),c=s.commodities.find(x=>x.id===id);return c?json(c,request,env):json({error:'Komoditas tidak ditemukan'},request,env,404);}
    if(path==='/api/news')return json([{title:'Sumber harga: PIHPS Nasional Bank Indonesia',source:'Bank Indonesia',time:'live'},{title:'Data diperbarui otomatis oleh Cloudflare Worker',source:'KomoditasID',time:`${DEFAULT_REFRESH} menit`}],request,env);
    return json({error:'Not found'},request,env,404);
  },
  async scheduled(controller, env, ctx) { ctx.waitUntil(refresh(env,{force:true})); }
};
