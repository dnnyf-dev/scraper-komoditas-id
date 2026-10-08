// Scraper PIHPS Nasional (Bank Indonesia).
// Sumber utama: endpoint JSON yang dipakai halaman "Tabel Harga" PIHPS:
//   GET /hargapangan/WebSite/TabelHarga/GetGridDataDaerah
// Respons: { data: [ {no, name, level, "DD/MM/YYYY": "16,650", ...}, ... ] }
const API = 'https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataDaerah';
const REFERER = 'https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah';

// id internal (seed/frontend) -> id komoditas PIHPS + nama baris di tabel
export const COMMODITIES = {
  '1_3':   { com: 'com_3',  names: ['Beras Kualitas Medium I'] },
  '8_16':  { com: 'com_16', names: ['Cabai Rawit Merah'] },
  '7_13':  { com: 'com_13', names: ['Cabai Merah Besar'] },
  '3_8':   { com: 'com_8',  names: ['Daging Sapi Kualitas 1'] },
  '2_7':   { com: 'com_7',  names: ['Daging Ayam Ras Segar'] },
  '4_10':  { com: 'com_10', names: ['Telur Ayam Ras Segar'] },
  '5_11':  { com: 'com_11', names: ['Bawang Merah Ukuran Sedang'] },
  '6_12':  { com: 'com_12', names: ['Bawang Putih Ukuran Sedang'] },
  '9_18':  { com: 'com_18', names: ['Minyak Goreng Kemasan Bermerk 1'] },
  '10_21': { com: 'com_21', names: ['Gula Pasir Lokal'] }
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': REFERER
};

const pad = n => String(n).padStart(2, '0');
// BI memakai waktu WIB; hitung tanggal dalam UTC+7 agar tidak meleset di server UTC.
function wibDate(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const ddmmyyyyKey = k => /^\d{2}\/\d{2}\/\d{4}$/.test(k);
const sortKey = k => k.slice(6) + k.slice(3, 5) + k.slice(0, 2);
function toPrice(v) {
  const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

async function fetchJson(url, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { throw new Error('Respons bukan JSON (kemungkinan diblokir/halaman challenge)'); }
  } finally { clearTimeout(timer); }
}

// Ambil rangkaian harga harian satu komoditas, urut dari lama ke baru.
export function parseGrid(json, names) {
  const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : null;
  if (!rows) throw new Error('Format respons tidak dikenali');
  const wanted = names.map(norm);
  const row = rows.find(r => wanted.includes(norm(r.name))) ||
              rows.find(r => Number(r.level) === 2) || null;
  if (!row) throw new Error('Baris komoditas tidak ditemukan');
  const series = Object.keys(row).filter(ddmmyyyyKey).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .map(k => ({ date: `${k.slice(6)}-${k.slice(3, 5)}-${k.slice(0, 2)}`, price: toPrice(row[k]) }))
    .filter(p => p.price);
  if (!series.length) throw new Error('Tidak ada harga pada rentang tanggal');
  return series;
}

export function summarize(series) {
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const change_pct = prev ? Number((((last.price - prev.price) / prev.price) * 100).toFixed(2)) : null;
  return { price: last.price, change_pct, date: last.date, series, method: 'GetGridDataDaerah' };
}

// Satu komoditas, dengan retry dan jendela tanggal yang melebar bila data kosong.
export async function getLive(id, timeout = 12000) {
  const cfg = COMMODITIES[id];
  if (!cfg) throw new Error('Komoditas tidak dipetakan ke PIHPS');
  let lastErr;
  for (const [attempt, days] of [[0, 7], [1, 14]]) {
    try {
      const qs = new URLSearchParams({
        price_type_id: '1', comcat_id: cfg.com, province_id: '', regency_id: '', market_id: '',
        tipe_laporan: '1', start_date: wibDate(-days), end_date: wibDate(0), _: String(Date.now())
      });
      const json = await fetchJson(`${API}?${qs}`, timeout);
      return summarize(parseGrid(json, cfg.names));
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise(r => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

// Semua komoditas paralel; tidak pernah melempar, selalu mengembalikan {id: {ok, ...} | {ok:false, error}}.
export async function getAll(ids, timeout = 12000) {
  const out = {};
  await Promise.all(ids.map(async id => {
    try { out[id] = { ok: true, ...(await getLive(id, timeout)) }; }
    catch (e) { out[id] = { ok: false, error: String(e?.message || e) }; }
  }));
  return out;
}
