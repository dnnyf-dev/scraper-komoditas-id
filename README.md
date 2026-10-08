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
