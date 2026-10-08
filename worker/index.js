import { SEED } from './seed.js';
import { getLive, getFallbacks } from './bi.js';

const CACHE_KEY = new Request('https://komoditas-id-cache.internal/state');
const DEFAULT_REFRESH = 10;
const TTL_SECONDS = 900;

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
async function readCache(){const r=await caches.default.match(CACHE_KEY);if(!r)return null;try{return await r.json()}catch{return null}}
async function writeCache(state){await caches.default.put(CACHE_KEY,new Response(JSON.stringify(state),{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${TTL_SECONDS}`}}));}
function addHistory(c,price,now){if(!Array.isArray(c.history))c.history=[];const date=now.slice(0,10),last=c.history[c.history.length-1];if(last&&last.date===date)last.price=price;else c.history.push({date,price});if(c.history.length>30)c.history=c.history.slice(-30);}
function dailyChange(c,price){const today=new Date().toISOString().slice(0,10);const prev=[...(c.history||[])].reverse().find(h=>h.date!==today&&Number(h.price)>0);return prev?Number((((price-Number(prev.price))/Number(prev.price))*100).toFixed(2)):0;}
async function refresh(env){let state=await readCache()||initialState();state.lastAttempt=new Date().toISOString();let liveCount=0,failures=0;const timeout=Math.max(3000,Number(env.BI_TIMEOUT_MS||12000));
  const fallback=await getFallbacks(timeout);
  const results=await Promise.all(state.commodities.map(async c=>{let p=await getLive(c.id,timeout);if(!p&&fallback.home?.[c.id])p=fallback.home[c.id];if(!p&&fallback.table?.[c.id])p=fallback.table[c.id];return {c,p};}));
  const now=new Date().toISOString();
  for(const {c,p} of results){if(!p||!Number.isFinite(p.price)||p.price<=0){failures++;continue;}const price=Math.round(p.price);c.change_pct=p.change_pct==null?dailyChange(c,price):Number(Number(p.change_pct).toFixed(2));c.price=price;c.source='BI PIHPS (live)';c.data_status='live';c.last_updated=now;addHistory(c,price,now);liveCount++;}
  state.lastUpdated=liveCount?now:state.lastUpdated;state.status=liveCount?'aktif':'cadangan';state.error=liveCount?null:'Tidak ada harga live yang berhasil dibaca dari PIHPS.';state.refreshMinutes=Math.max(2,Number(env.REFRESH_MINUTES||DEFAULT_REFRESH));await writeCache(state);return {status:state.status,lastUpdated:state.lastUpdated,lastAttempt:state.lastAttempt,successCount:liveCount,failures};
}
async function getState(){return await readCache()||initialState();}
export default {
  async fetch(request, env) {
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request,env)});
    const url=new URL(request.url), path=url.pathname;
    if(path==='/api/health'){const s=await getState();return json({ok:true,status:s.status,lastUpdated:s.lastUpdated},request,env);}
    if(path==='/api/refresh'&&request.method==='POST'){try{return json(await refresh(env),request,env)}catch(e){return json({status:'cadangan',error:e.message},request,env);}}
    if(path==='/api/commodities'){const s=await getState();return json({status:s.status,lastUpdated:s.lastUpdated,lastAttempt:s.lastAttempt,error:s.error,refreshMinutes:s.refreshMinutes||DEFAULT_REFRESH,data:s.commodities},request,env);}
    if(path==='/api/meta'){const s=await getState();return json({status:s.status,lastUpdated:s.lastUpdated,lastAttempt:s.lastAttempt,error:s.error,refreshMinutes:s.refreshMinutes||DEFAULT_REFRESH,source:'PIHPS Nasional - Bank Indonesia'},request,env);}
    if(path.startsWith('/api/commodity/')){const id=decodeURIComponent(path.slice('/api/commodity/'.length)),s=await getState(),c=s.commodities.find(x=>x.id===id);return c?json(c,request,env):json({error:'Komoditas tidak ditemukan'},request,env,404);}
    if(path==='/api/news')return json([{title:'Sumber harga: PIHPS Nasional Bank Indonesia',source:'Bank Indonesia',time:'live'},{title:'Data diperbarui otomatis oleh Cloudflare Worker',source:'KomoditasID',time:`${DEFAULT_REFRESH} menit`}],request,env);
    return json({error:'Not found'},request,env,404);
  },
  async scheduled(controller, env, ctx) { ctx.waitUntil(refresh(env)); }
};
