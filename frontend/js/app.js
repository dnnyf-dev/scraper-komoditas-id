const API = String(window.KOMODITAS_API_BASE || '/api').replace(/\/$/, '');
let commodities = [];
let selectedId = new URLSearchParams(location.search).get('id');
let resizeTimer;
let autoRefresh = localStorage.getItem('komoditas-auto-refresh') !== 'false';
let favorites = JSON.parse(localStorage.getItem('komoditas-favorites') || '[]');

const page = document.body.dataset.page || 'home';

function formatRupiah(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
function fmtDateLabel(s) { const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('id-ID', {day:'2-digit', month:'short'}); }
function escapeHtml(s) { const d=document.createElement('div'); d.textContent=String(s ?? ''); return d.innerHTML; }
function escapeAttr(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function fetchJson(url, options) {
  const opts = Object.assign({ cache: 'no-store' }, options || {});
  const r = await fetch(url, opts);
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function setActiveNav() {
  document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.page === page));
}

async function loadAll() {
  try {
    const [meta, data, news] = await Promise.all([
      fetchJson(`${API}/meta`), fetchJson(`${API}/commodities`), fetchJson(`${API}/news`).catch(()=>[])
    ]);
    commodities = Array.isArray(data.data) ? data.data : [];
    window.__komoditasLastSync = data.lastUpdated || meta.lastUpdated || null;
    if (!selectedId || !commodities.some(c=>c.id===selectedId)) selectedId = commodities[0]?.id || null;
    renderStatus(meta); renderDate();
    if (page === 'home') { renderStatCards(); renderChart(); renderLatestTable(); renderMovers(); renderNews(Array.isArray(news)?news:(news.data||[])); }
    if (page === 'commodities') { renderCategoryFilter(); renderMainTable(); }
    if (page === 'analysis') { renderAnalysisSelector(); renderChart(); renderAnalysisSummary(); }
    if (page === 'favorites') renderFavoritesPage();
    if (page === 'settings') updateSettingsUI();
  } catch(err) { console.error(err); renderStatus({status:'cadangan'}); showToast('Data belum bisa dimuat. Pastikan API Cloudflare Worker sedang berjalan.','error'); }
}

function renderStatus(meta) {
  const dot=document.getElementById('status-dot'), text=document.getElementById('status-text'), time=document.getElementById('status-time');
  if(!dot||!text||!time) return;
  dot.classList.toggle('cadangan',meta.status!=='aktif');
  text.textContent=meta.status==='aktif'?'Live BI':'Mode Cadangan';
  time.textContent=meta.lastUpdated
    ? 'Update server · '+new Date(meta.lastUpdated).toLocaleString('id-ID',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WIB'
    : 'Menunggu update live';
}
function renderDate(){ const e=document.getElementById('date-pill'); if(e)e.textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'short',year:'numeric'})+' · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+' WIB'; }

function renderStatCards(){ const el=document.getElementById('stat-row'); if(!el)return; el.innerHTML=commodities.slice(0,5).map(c=>`<button class="stat-card" data-id="${escapeAttr(c.id)}"><div class="stat-top">${commodityBadge(c,'md')}<p class="stat-name">${escapeHtml(c.name)}</p></div><p class="stat-price">${formatRupiah(c.price)}/kg</p><p class="stat-change ${Number(c.change_pct)>=0?'up':'down'}">${Number(c.change_pct)>=0?'↑':'↓'} ${Math.abs(Number(c.change_pct)||0).toFixed(2)}% <span class="stat-change-note">vs kemarin</span></p></button>`).join('');
  el.querySelectorAll('.stat-card').forEach(b=>b.onclick=()=>goAnalysis(b.dataset.id));
}
function goAnalysis(id){ location.href=`analysis.html?id=${encodeURIComponent(id)}`; }

function renderChart(){ const canvas=document.getElementById('trend-chart'), title=document.getElementById('chart-title'); if(!canvas||!title)return; const c=commodities.find(x=>x.id===selectedId)||commodities[0]; if(!c)return; title.textContent=c.name; drawTrendChart(canvas,(c.history||[]).slice(-7),c); }
function drawTrendChart(canvas,history,commodity){
  const rect=canvas.getBoundingClientRect(), dpr=Math.max(1,Math.min(devicePixelRatio||1,2)), width=Math.max(320,Math.floor(rect.width||700)), height=330;
  canvas.width=width*dpr; canvas.height=height*dpr; canvas.style.height=height+'px'; const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  if(!history.length){ctx.fillStyle='#8A8278';ctx.font='14px Arial';ctx.textAlign='center';ctx.fillText('Belum ada histori harga.',width/2,height/2);return;}
  const values=history.map(h=>Number(h.price)||0), min=Math.min(...values), max=Math.max(...values), spread=Math.max(max-min,max*.01,100), minY=min-spread*.25,maxY=max+spread*.25,pad={left:82,right:22,top:20,bottom:45},plotW=width-pad.left-pad.right,plotH=height-pad.top-pad.bottom,x=i=>pad.left+(history.length===1?plotW/2:i/(history.length-1)*plotW),y=v=>pad.top+(1-(v-minY)/(maxY-minY))*plotH;
  ctx.font='11px Arial';ctx.textAlign='right';ctx.textBaseline='middle';ctx.strokeStyle='#2E2820';ctx.fillStyle='#8A8278';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const v=minY+(maxY-minY)*i/4,py=y(v);ctx.beginPath();ctx.moveTo(pad.left,py);ctx.lineTo(width-pad.right,py);ctx.stroke();ctx.fillText(formatRupiah(v),pad.left-10,py);}
  ctx.textAlign='center';ctx.textBaseline='top';history.forEach((h,i)=>ctx.fillText(fmtDateLabel(h.date),x(i),height-pad.bottom+14));
  const pts=values.map((v,i)=>[x(i),y(v)]), grad=ctx.createLinearGradient(0,pad.top,0,height-pad.bottom);grad.addColorStop(0,'rgba(212,168,87,.25)');grad.addColorStop(1,'rgba(212,168,87,.01)');
  ctx.beginPath();ctx.moveTo(pts[0][0],height-pad.bottom);pts.forEach(p=>ctx.lineTo(p[0],p[1]));ctx.lineTo(pts.at(-1)[0],height-pad.bottom);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle='#D4A857';ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],4.5,0,Math.PI*2);ctx.fillStyle='#D4A857';ctx.fill();ctx.strokeStyle='#171310';ctx.lineWidth=2;ctx.stroke();});
  canvas.title=`${commodity.name}: ${formatRupiah(commodity.price)}/kg`;
}

function renderLatestTable(){ const b=document.getElementById('latest-body');if(!b)return; b.innerHTML=[...commodities].slice(0,8).map(c=>`<tr><td><span class="commodity-cell">${commodityBadge(c,'sm')}<span>${escapeHtml(c.name)}</span></span></td><td>${formatRupiah(c.price)}/kg</td><td class="${Number(c.change_pct)>=0?'up-text':'down-text'}">${Number(c.change_pct)>=0?'↑':'↓'} ${Math.abs(Number(c.change_pct)||0).toFixed(2)}%</td><td>${escapeHtml(String(c.source||'-').replace(' (live)',''))}</td><td>${c.last_updated?new Date(c.last_updated).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`).join(''); }
function renderMovers(){ const e=document.getElementById('movers-list');if(!e)return; e.innerHTML=[...commodities].sort((a,b)=>Math.abs(Number(b.change_pct)||0)-Math.abs(Number(a.change_pct)||0)).slice(0,5).map(c=>`<li><span class="mover-name">${escapeHtml(c.name)}</span><span class="mover-change ${Number(c.change_pct)>=0?'up-text':'down-text'}">${Number(c.change_pct)>=0?'+':''}${Number(c.change_pct||0).toFixed(2)}% ${Number(c.change_pct)>=0?'↑':'↓'}</span></li>`).join(''); }
function renderNews(news){ const e=document.getElementById('news-list');if(!e)return;e.innerHTML=(Array.isArray(news)?news:[]).map(n=>`<li class="news-item"><div class="news-thumb">📰</div><div><p class="news-title">${escapeHtml(n.title||'')}</p><p class="news-meta">${escapeHtml(n.source||'')} · ${escapeHtml(n.time||'')}</p></div></li>`).join('')||'<li class="empty-state">Belum ada berita.</li>'; }

function centerChip(box,chip){ if(!box||!chip)return; const left=chip.offsetLeft-(box.clientWidth-chip.offsetWidth)/2; box.scrollTo({left:Math.max(0,left),behavior:'smooth'}); }
function renderCategoryFilter(){ const box=document.getElementById('filter-category');if(!box)return;const cats=[...new Set(commodities.map(c=>c.category).filter(Boolean))];const cur=box.dataset.value||'all';
  box.innerHTML=['all',...cats].map(v=>`<button type="button" class="chip chip-plain${v===cur?' active':''}" role="tab" aria-selected="${v===cur}" data-value="${escapeAttr(v)}">${v==='all'?'Semua':escapeHtml(v)}</button>`).join('');
  box.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;box.dataset.value=b.dataset.value;box.querySelectorAll('.chip').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',on);});centerChip(box,b);renderMainTable();}; }
function renderMainTable(){ const s=document.getElementById('filter-category'),q=document.getElementById('search-input'),b=document.getElementById('list-body');if(!s||!q||!b)return;const cat=s.dataset.value||'all',term=q.value.trim().toLowerCase();const filtered=commodities.filter(c=>(cat==='all'||c.category===cat)&&(!term||c.name.toLowerCase().includes(term)||String(c.category||'').toLowerCase().includes(term)));b.innerHTML=filtered.map((c,i)=>`<tr><td>${i+1}</td><td><span class="commodity-cell">${commodityBadge(c,'sm')}<span>${escapeHtml(c.name)}</span></span></td><td><span class="cat-pill">${escapeHtml(c.category||'-')}</span></td><td>${formatRupiah(c.price)}/kg</td><td class="${Number(c.change_pct)>=0?'up-text':'down-text'}">${Number(c.change_pct)>=0?'↑':'↓'} ${Math.abs(Number(c.change_pct)||0).toFixed(2)}%</td><td>${escapeHtml(c.location||'-')}</td><td class="actions-cell"><button class="favorite-btn ${favorites.includes(c.id)?'is-favorite':''}" data-fav-id="${escapeAttr(c.id)}">${favorites.includes(c.id)?'★':'☆'}</button><button class="view-btn" data-id="${escapeAttr(c.id)}">Lihat →</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">Tidak ada komoditas yang cocok.</td></tr>';
  b.querySelectorAll('.view-btn').forEach(x=>x.onclick=()=>goAnalysis(x.dataset.id));b.querySelectorAll('.favorite-btn').forEach(x=>x.onclick=()=>toggleFavorite(x.dataset.favId)); }
function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('komoditas-favorites',JSON.stringify(favorites));renderMainTable();renderFavoritesPage();showToast(favorites.includes(id)?'Ditambahkan ke favorit.':'Dihapus dari favorit.');}
function renderFavoritesPage(){ const e=document.getElementById('favorites-list'),count=document.getElementById('favorite-count');if(!e)return;const items=commodities.filter(c=>favorites.includes(c.id));if(count)count.textContent=`${items.length} komoditas`;e.innerHTML=items.map(c=>`<button class="favorite-card" data-id="${escapeAttr(c.id)}">${commodityBadge(c,'lg')}<span><strong>${escapeHtml(c.name)}</strong><small>${formatRupiah(c.price)}/kg · ${Number(c.change_pct||0)>=0?'+':''}${Number(c.change_pct||0).toFixed(2)}%</small></span></button>`).join('')||'<div class="empty-state">Belum ada favorit. Buka Data Komoditas untuk menambahkan.</div>';e.querySelectorAll('.favorite-card').forEach(x=>x.onclick=()=>goAnalysis(x.dataset.id)); }

function renderAnalysisSelector(){ const box=document.getElementById('analysis-select');if(!box)return;
  const paint=()=>{box.innerHTML=commodities.map(c=>`<button type="button" class="chip${c.id===selectedId?' active':''}" role="tab" aria-selected="${c.id===selectedId}" data-id="${escapeAttr(c.id)}">${commodityBadge(c,'sm')}<span>${escapeHtml(c.name)}</span></button>`).join('');};
  if(!selectedId)selectedId=commodities[0]?.id||null; paint();
  centerChip(box,box.querySelector('.chip.active'));
  box.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;selectedId=b.dataset.id;box.querySelectorAll('.chip').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',on);});centerChip(box,b);history.replaceState({},'',`analysis.html?id=${encodeURIComponent(selectedId)}`);renderChart();renderAnalysisSummary();}; }
function renderAnalysisSummary(){ const c=commodities.find(x=>x.id===selectedId)||commodities[0],e=document.getElementById('analysis-summary');if(!e||!c)return;const change=Number(c.change_pct)||0;e.innerHTML=`<div class="analysis-metric"><span>Harga terbaru</span><strong>${formatRupiah(c.price)}/kg</strong></div><div class="analysis-metric"><span>Perubahan harian</span><strong class="${change>=0?'up-text':'down-text'}">${change>=0?'+':''}${change.toFixed(2)}%</strong></div><div class="analysis-metric"><span>Kategori</span><strong>${escapeHtml(c.category||'-')}</strong></div><div class="analysis-metric"><span>Lokasi</span><strong>${escapeHtml(c.location||'-')}</strong></div>`; }

function updateSettingsUI(){const c=document.getElementById('auto-refresh-toggle');if(c)c.checked=autoRefresh;}
function setupEvents(){
  document.getElementById('search-input')?.addEventListener('input',renderMainTable);document.getElementById('filter-category')?.addEventListener('change',renderMainTable);
  document.getElementById('refresh-btn')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;const old=b.innerHTML;b.textContent='Memuat...';try{await fetchJson(`${API}/refresh`,{method:'POST'});await loadAll();showToast('Data berhasil diperbarui.');}catch(err){showToast('Refresh gagal.','error');}finally{b.disabled=false;b.innerHTML=old;}});
  document.getElementById('auto-refresh-toggle')?.addEventListener('change',e=>{autoRefresh=e.target.checked;localStorage.setItem('komoditas-auto-refresh',String(autoRefresh));showToast(autoRefresh?'Auto-refresh diaktifkan.':'Auto-refresh dimatikan.');});
  document.getElementById('reset-favorites')?.addEventListener('click',()=>{favorites=[];localStorage.setItem('komoditas-favorites','[]');renderFavoritesPage();showToast('Favorit berhasil direset.');});
  document.getElementById('profile-btn')?.addEventListener('click',()=>location.href='profile.html');
  document.querySelectorAll('[data-go]').forEach(x=>x.addEventListener('click',()=>location.href=x.dataset.go));
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderChart,150);});
}
function showToast(message,type='success'){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}t.textContent=message;t.className=type;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.className='',2600);}

setActiveNav();setupEvents();loadAll();setInterval(()=>{if(autoRefresh&&!document.hidden)loadAll();},60000);
