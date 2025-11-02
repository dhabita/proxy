# Static IP Proxy Server

Proxy server sederhana untuk meneruskan HTTP request dari backend dengan IP dinamis (A) ke pihak ketiga (C) melalui server dengan IP static (B).

## Flow

```
Backend A (IP Dinamis) -> Server B (IP Static/Proxy) -> Pihak Ketiga C
                       <-                             <-
```

Server B akan:
- Menerima request dari A
- Meneruskan request persis sama ke C
- Menerima response dari C
- Mengirim response persis sama kembali ke A

## Instalasi

### 1. Di Server B (IP Static)

```bash
# Clone atau copy file ke server
npm install

# Buat file .env
cp .env.example .env

# Edit .env dan isi dengan URL target
nano .env
```

### 2. Konfigurasi .env

```env
PORT=3000
TARGET_URL=https://api.pihakketiga.com/endpoint
```

### 3. Jalankan Server

```bash
# Production
npm start

# Development (dengan auto-reload)
npm run dev
```

## Penggunaan

### Dari Backend A

Ada 2 cara menggunakan proxy:

#### Cara 1: Endpoint `/proxy`

Kirim POST request ke `http://ip-server-b:3000/proxy`

```javascript
// Contoh menggunakan axios
const axios = require('axios');

const response = await axios.post('http://ip-server-b:3000/proxy', {
  // data yang ingin dikirim ke pihak ketiga
  key: 'value',
  data: 'your data'
}, {
  headers: {
    'Content-Type': 'application/json',
    // header lain yang dibutuhkan
  }
});

console.log(response.data); // response dari pihak ketiga
```

#### Cara 2: Endpoint `/proxy/*` (Lebih Fleksibel)

Untuk meneruskan dengan path tertentu:

```javascript
// Jika target C adalah: https://api.pihakketiga.com/v1/users
// Kirim request ke: http://ip-server-b:3000/proxy/v1/users

const response = await axios.post('http://ip-server-b:3000/proxy/v1/users', data);
```

### Health Check

```bash
curl http://ip-server-b:3000/health
```

## Contoh Lengkap

### Backend A (Node.js/Express)

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PROXY_URL = 'http://ip-server-b:3000/proxy';

app.post('/kirim-data', async (req, res) => {
  try {
    // Kirim request ke proxy (Server B)
    const response = await axios.post(PROXY_URL, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token'
      }
    });

    // Response dari pihak ketiga (C) akan sama persis
    res.json(response.data);

  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message
    });
  }
});

app.listen(8080, () => {
  console.log('Backend A running on port 8080');
});
```

### Backend A (PHP)

```php
<?php

$proxy_url = 'http://ip-server-b:3000/proxy';

$data = [
    'key' => 'value',
    'data' => 'your data'
];

$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    ]
];

$context  = stream_context_create($options);
$result = file_get_contents($proxy_url, false, $context);

echo $result; // Response dari pihak ketiga
?>
```

## Keamanan

Untuk production, tambahkan:

1. **API Key Authentication**
2. **Rate Limiting**
3. **HTTPS/SSL**
4. **IP Whitelist**

Contoh dengan API Key:

```javascript
// Di server.js, tambahkan middleware
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## Deploy

### Menggunakan PM2 (Recommended)

```bash
npm install -g pm2

# Start
pm2 start server.js --name proxy-server

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Menggunakan systemd

Buat file `/etc/systemd/system/proxy-server.service`:

```ini
[Unit]
Description=Static IP Proxy Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/proxy
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable proxy-server
sudo systemctl start proxy-server
```

## Logs

Server akan menampilkan log untuk setiap request:

```
📨 Incoming request from backend A
🔄 Forwarding to: https://api.pihakketiga.com
✅ Response from C: 200
```

## Troubleshooting

### Error: ECONNREFUSED

- Pastikan TARGET_URL benar
- Pastikan pihak ketiga (C) dapat diakses dari server B

### Error: 503 Service Unavailable

- Server C tidak merespons
- Cek koneksi internet di server B

### Request timeout

- Tambahkan timeout di axios config:

```javascript
const response = await axios({
  // ...
  timeout: 30000 // 30 detik
});
```

## License

MIT
