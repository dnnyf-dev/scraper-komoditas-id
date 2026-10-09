# Komoditas ID

Web monitoring harga komoditas Indonesia dengan **Netlify + Cloudflare Workers**.

- **Frontend:** Netlify
- **Backend/API:** Cloudflare Workers
- **Data harga:** PIHPS Bank Indonesia
- **Update:** otomatis melalui Cron Trigger + polling frontend
- **Health check:** `/api/health`

```text
PIHPS → Cloudflare Worker → Netlify
```

> Realtime berarti website menampilkan data terbaru yang tersedia dari PIHPS. Jika PIHPS belum memperbarui data, harga tetap menggunakan data terakhir yang tersedia.


## Endpoint refresh & penyimpanan data

- `/api/refresh` menerima **GET dan POST** (dibatasi 1x per 30 detik; tambah `?force=1` untuk memaksa). Respons memuat `successCount`, `failureCount`, dan `failures` per komoditas untuk debugging.
- Scraper memakai endpoint JSON PIHPS `TabelHarga/GetGridDataDaerah` (rata-rata nasional, 7-14 hari terakhir) sehingga riwayat harga ikut terisi.
- Buat KV namespace `STATE` (lihat `wrangler.jsonc`) agar hasil scraping persisten. Tanpa KV, data hanya hidup di memori isolate dan bisa kembali ke seed.

## Dashboard UI refresh (Market Terminal)

The frontend now uses a denser market-terminal layout: a compact KPI row, price-intelligence chart, market signals/source panel, and a full-width latest-price board. Desktop grids use constrained min-width tracks to avoid pushing panels off-screen; tables scroll within their own wrapper on narrow screens. The global home search filters the visible market board. Existing Worker/API routes and data contracts are unchanged.

To test locally, serve the `frontend/` directory with a local static server and configure `frontend/js/runtime-config.js` to point at your deployed Worker API if needed. Opening the HTML directly from `file://` may not work with API fetches.
