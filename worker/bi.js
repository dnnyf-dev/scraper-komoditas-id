const BASE_URL = 'https://www.bi.go.id/hargapangan/WebSite/Home';
const HOME_URL = 'https://www.bi.go.id/Hargapangan/Home';
const TABLE_URL = 'https://www.bi.go.id/Hargapangan/Tabelharga/Pasartradisionaldaerah';
const LABELS = {
  '1_3': ['Beras Kualitas Medium I', 'Beras Kualitas Medium II'],
  '8_16': ['Cabai Rawit Merah'],
  '7_13': ['Cabai Merah Besar'],
  '3_8': ['Daging Sapi Kualitas 1'],
  '2_7': ['Daging Ayam Ras Segar'],
  '4_10': ['Telur Ayam Ras Segar'],
  '5_11': ['Bawang Merah Ukuran Sedang'],
  '6_12': ['Bawang Putih Ukuran Sedang'],
  '9_18': ['Minyak Goreng Kemasan Bermerk 1', 'Minyak Goreng Kemasan Bermerk 2'],
  '10_21': ['Gula Pasir Lokal']
};
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; KomoditasID/Cloudflare-Workers)',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://www.bi.go.id/hargapangan/'
};
function todayDDMMYYYY() { const d=new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function cleanHtml(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();}
function parseRupiah(v){const m=String(v||'').match(/Rp\.?\s*([0-9][0-9.,]*)/i);if(!m)return null;const n=Number(m[1].replace(/[^\d]/g,''));return Number.isFinite(n)&&n>0?n:null;}
function parsePercent(t){const m=String(t||'').match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);if(!m)return null;const n=Number(m[1].replace(',','.'));return Number.isFinite(n)?n:null;}
async function getGridData(id, timeout){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
  try{const body=new URLSearchParams({price_type_id:'1',komoditas_id:id,province_id:'0',tipe_laporan_id:'1',tanggal:todayDDMMYYYY()});
    const r=await fetch(BASE_URL+'/GetGridData1',{method:'POST',headers:{...HEADERS,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body,signal:controller.signal,cache:'no-store'});
    if(!r.ok)return null; const j=await r.json(); const data=j?.data??j; return Array.isArray(data)?data:null;
  }catch{return null}finally{clearTimeout(timer)}
}
async function getHtml(url,timeout){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(url,{headers:{'User-Agent':HEADERS['User-Agent'],'Accept':'text/html,application/xhtml+xml'},signal:controller.signal,cache:'no-store'});return r.ok?await r.text():null}catch{return null}finally{clearTimeout(timer)}}
function parseSnapshot(html){if(!html)return null;const text=cleanHtml(html),out={};for(const [id,labels] of Object.entries(LABELS)){for(const label of labels){const pos=text.toLowerCase().indexOf(label.toLowerCase());if(pos<0)continue;const chunk=text.slice(pos,pos+1800),price=parseRupiah(chunk);if(price){out[id]={price,change_pct:parsePercent(chunk),method:'html'};break;}}}return Object.keys(out).length?out:null;}
function parseTable(html){if(!html)return null;const text=cleanHtml(html),out={};for(const [id,labels] of Object.entries(LABELS)){for(const label of labels){const pos=text.toLowerCase().indexOf(label.toLowerCase());if(pos<0)continue;const chunk=text.slice(pos,pos+900);const nums=[...chunk.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b/g)].map(m=>Number(m[0].replace(/[.,]/g,''))).filter(n=>n>=1000&&n<=10000000);if(nums.length){out[id]={price:nums[nums.length-1],change_pct:null,method:'table'};break;}}}return Object.keys(out).length?out:null;}
export async function getLive(id,timeout=12000){const grid=await getGridData(id,timeout);if(grid?.length){const row=grid[0]||{},raw=row.harga??row.Harga??row.price??row.Price,price=Number(String(raw??'').replace(/[^\d.-]/g,''));if(Number.isFinite(price)&&price>0){const pctRaw=row.perubahan??row.Perubahan??row.change_pct??row.ChangePct,pct=Number(String(pctRaw??'').replace(',','.').replace('%',''));return {price,change_pct:Number.isFinite(pct)?pct:null,method:'grid'};}}return null;}
export async function getFallbacks(timeout=12000){const [home,table]=await Promise.all([getHtml(HOME_URL,timeout),getHtml(TABLE_URL,timeout)]);return {home:parseSnapshot(home),table:parseTable(table)};}
