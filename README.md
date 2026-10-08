# KomoditasID

Dashboard pemantauan harga komoditas pangan Indonesia. Data diambil otomatis dari **PIHPS Nasional (Bank Indonesia)** oleh Cloudflare Worker, lalu ditampilkan di frontend statis yang di-host di Netlify.

![Status](https://img.shields.io/badge/data-PIHPS%20BI-blue)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-orange)
![Frontend](https://img.shields.io/badge/frontend-Netlify-00C7B7)
![License](https://img.shields.io/badge/license-MIT-green)

## Fitur

- Harga terbaru 10 komoditas utama: beras, cabai, daging, telur, bawang, minyak goreng, dan gula.
- Persentase perubahan harga dan grafik tren harian.
- Halaman Data Komoditas, Grafik & Analisis, Favorit, dan Pengaturan.
- Pembaruan otomatis: terjadwal (cron) dan saat data dinilai basi.
- Mode cadangan: jika sumber tidak dapat diakses, tampilan memakai data seed dan menandainya dengan jelas.

## Arsitektur

```
PIHPS Nasional (BI)
        │  JSON  (TabelHarga/GetGridDataDaerah)
        ▼
Cloudflare Worker ──► Workers KV (penyimpanan state)
        │  REST  (/api/*)
        ▼
Frontend statis (Netlify)
```

| Lapisan | Teknologi |
| --- | --- |
| Frontend | HTML, CSS, JavaScript (tanpa framework) |
| Backend / API | Cloudflare Workers |
| Penyimpanan | Workers KV (binding `STATE`) |
| Hosting frontend | Netlify |
| Sumber data | PIHPS Nasional, Bank Indonesia |

## Struktur Proyek

```
.
├── frontend/            # Situs statis (dipublikasikan oleh Netlify)
│   ├── *.html
│   ├── css/
│   └── js/              # app.js, icons.js, runtime-config.js (dibuat saat build)
├── worker/
│   ├── index.js         # Router API, cron, cache, refresh
│   ├── bi.js            # Scraper PIHPS
│   └── seed.js          # Data cadangan
├── scripts/
│   └── netlify-build.js # Menulis alamat API ke runtime-config.js
├── netlify.toml
├── wrangler.jsonc
└── .env.example
```

## Endpoint API

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/health` | Status layanan |
| GET | `/api/commodities` | Daftar komoditas beserta harga dan riwayat |
| GET | `/api/commodity/:id` | Detail satu komoditas |
| GET | `/api/meta` | Status sumber, waktu pembaruan, interval refresh |
| GET / POST | `/api/refresh` | Menjalankan pengambilan data. Dibatasi 1x per 30 detik. Tambahkan `?force=1` untuk memaksa |
| GET | `/api/news` | Informasi sumber data |

Respons `/api/refresh` memuat `successCount`, `failureCount`, dan `failures` per komoditas untuk memudahkan diagnosis.

## Cara Kerja Pembaruan Data

1. **Cron** Cloudflare memanggil Worker setiap 10 menit.
2. Saat ada permintaan ke `/api/commodities`, `/api/meta`, atau `/api/health`, Worker memeriksa umur data. Jika lebih dari `REFRESH_MINUTES`, pembaruan berjalan di latar belakang. Jika belum pernah ada data live, Worker menunggu satu kali pengambilan.
3. Untuk tiap komoditas, Worker memanggil `GetGridDataDaerah` untuk rentang 7 hari (diperlebar menjadi 14 hari bila kosong), mengambil harga terbaru, menghitung perubahan terhadap hari sebelumnya, dan menyimpan riwayat.
4. Hasil disimpan di KV. Kegagalan satu komoditas tidak memengaruhi yang lain.

> Harga PIHPS diperbarui sekali sehari oleh Bank Indonesia, dan nilainya adalah rata-rata nasional pasar tradisional. Frekuensi cron yang tinggi menjaga data tetap segar, tetapi tidak membuat harga berubah lebih sering dari sumbernya.

## Menjalankan Sendiri

### Prasyarat

- Akun Cloudflare dan Netlify
- Node.js 18 atau lebih baru
- Repositori ini di GitHub

### 1. Backend (Cloudflare Worker)

```bash
npm install -g wrangler
wrangler login

# Buat KV namespace, lalu salin id yang muncul
wrangler kv namespace create STATE
```

Tambahkan binding di `wrangler.jsonc`:

```jsonc
{
  "name": "nama-worker-anda",
  "main": "worker/index.js",
  "compatibility_date": "2026-10-07",
  "workers_dev": true,
  "kv_namespaces": [{ "binding": "STATE", "id": "ID_KV_ANDA" }],
  "triggers": { "crons": ["*/10 * * * *"] }
}
```

Deploy:

```bash
wrangler deploy
```

Isi data pertama kali dan periksa hasilnya:

```
https://NAMA-WORKER.workers.dev/api/refresh?force=1
```

Respons dengan `"successCount": 10` berarti seluruh komoditas berhasil dibaca.

> Cache API Cloudflare tidak berfungsi pada domain `*.workers.dev`. Karena itu KV wajib dikonfigurasi agar data tidak hilang antar-permintaan.

### 2. Frontend (Netlify)

1. Impor repositori ke Netlify (**Add new project → Import an existing project**).
2. Pengaturan build (sudah ada di `netlify.toml`):
   - Build command: `node scripts/netlify-build.js`
   - Publish directory: `frontend`
3. Tambahkan variabel lingkungan:

   | Key | Value |
   | --- | --- |
   | `API_BASE_URL` | `https://NAMA-WORKER.workers.dev` (tanpa `/` atau `/api` di akhir) |

4. Deploy. Script build menulis `frontend/js/runtime-config.js` sehingga frontend tahu alamat API.

### Variabel Opsional di Worker

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `REFRESH_MINUTES` | `10` | Umur data sebelum dianggap basi |
| `BI_TIMEOUT_MS` | `12000` | Batas waktu permintaan ke PIHPS |

## Pengembangan Lokal

```bash
npx wrangler dev          # Worker di http://localhost:8787
```

Untuk frontend, buat `frontend/js/runtime-config.js` berisi:

```js
window.KOMODITAS_API_BASE = 'http://localhost:8787/api';
```

lalu sajikan folder `frontend` dengan server statis apa pun, misalnya `npx serve frontend`.

## Pemecahan Masalah

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| `Not found` saat membuka `/refresh` | Alamat kurang `/api` | Gunakan `/api/refresh` |
| Tabel kosong, muncul "Data belum bisa dimuat" | `runtime-config.js` kosong atau tidak dimuat | Pastikan `API_BASE_URL` terisi, setiap halaman memuat `js/runtime-config.js`, lalu deploy ulang |
| Data kembali ke seed setelah beberapa saat | KV belum terpasang | Buat KV `STATE` dan tambahkan binding di `wrangler.jsonc` |
| `successCount` 0 | PIHPS tidak dapat diakses atau formatnya berubah | Periksa isi `failures` pada respons `/api/refresh` |
| Build Netlify gagal | `API_BASE_URL` kosong atau tidak valid, atau `scripts/netlify-build.js` berubah | Isi ulang variabel dan pulihkan script dari riwayat Git |

## Sumber Data dan Catatan

Data harga bersumber dari [PIHPS Nasional](https://www.bi.go.id/hargapangan) milik Bank Indonesia. Proyek ini tidak berafiliasi dengan Bank Indonesia. Harga yang ditampilkan adalah rata-rata nasional pasar tradisional dan hanya untuk informasi, bukan acuan transaksi. Gunakan sumber dengan wajar dan patuhi ketentuan layanan penyedia data.

## Lisensi

[MIT](LICENSE)
