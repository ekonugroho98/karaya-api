# 🔌 Karaya API

Backend serverless API untuk aplikasi **Karaya Finance** — menyediakan harga emas live (Antam, UBS, Lotus, Galeri24) dan harga saham IDX live (via Yahoo Finance).

> Deploy ke Vercel secara gratis. Tidak butuh server.

---

## 📡 Endpoints

### Harga Emas

```
GET /api/gold/:brand
```

| Brand | Keterangan |
|-------|-----------|
| `antam` | Logam Mulia Antam (multi-kategori) |
| `ubs` | UBS Gold |
| `lotus` | Lotus Archi |
| `galeri24` | Galeri 24 |

**Contoh:**
```bash
curl https://your-api.vercel.app/api/gold/antam
curl https://your-api.vercel.app/api/gold/ubs
```

**Response:**
```json
{
  "brand": "antam",
  "tanggal": "2026-04-04",
  "scraped_at": "2026-04-04T10:00:00Z",
  "data": {
    "emas_batangan": [
      { "berat": "0.5 gr", "harga_jual": 950000, "harga_buyback": 820000 }
    ]
  }
}
```

---

### Harga Saham IDX

```
GET /api/stock/:ticker
```

**Contoh:**
```bash
curl https://your-api.vercel.app/api/stock/BBCA
curl https://your-api.vercel.app/api/stock/TLKM
```

**Response:**
```json
{
  "ticker": "BBCA",
  "symbol": "BBCA.JK",
  "price": 9350,
  "currency": "IDR",
  "change": 50,
  "change_pct": 0.54,
  "market_state": "REGULAR",
  "exchange": "IDX",
  "timestamp": "2026-04-04T10:00:00Z",
  "source": "Yahoo Finance"
}
```

> Ticker otomatis ditambahkan `.JK` (Jakarta Stock Exchange). Cukup kirim `BBCA`, bukan `BBCA.JK`.

---

## 🚀 Deploy ke Vercel

### 1. Fork & Clone

```bash
git clone https://github.com/USERNAME/karaya-api.git
cd karaya-api
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

Edit file `.env`:
```env
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> Service Role Key ada di Supabase Dashboard → Settings → API → **service_role** (bukan anon key)

### 3. Deploy

```bash
npm i -g vercel
vercel --prod
```

Atau connect repo GitHub di [vercel.com](https://vercel.com) dan tambahkan environment variables di **Settings → Environment Variables**.

---

## 🔧 Development Lokal

```bash
npm install
vercel dev   # Jalankan di localhost:3000
```

**Test endpoint:**
```bash
curl http://localhost:3000/api/gold/antam
curl http://localhost:3000/api/stock/BBCA
```

---

## 📁 Struktur

```
api/
├── gold/
│   ├── index.js       # GET /api/gold (list semua brand)
│   └── [brand].js     # GET /api/gold/:brand
└── stock/
    └── [ticker].js    # GET /api/stock/:ticker

lib/
└── sources/
    ├── antam.js       # Scraper Antam
    ├── ubs.js         # Scraper UBS
    ├── lotus.js       # Scraper Lotus Archi
    └── galeri24.js    # Scraper Galeri24

scrape.js              # Cron job: update harga ke Supabase
vercel.json            # Konfigurasi Vercel + cron schedule
```

---

## ⚙️ Cron Job (Auto Update Harga)

`vercel.json` sudah dikonfigurasi untuk menjalankan `scrape.js` secara otomatis setiap hari menggunakan Vercel Cron Jobs (gratis di hobby plan).

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi.
