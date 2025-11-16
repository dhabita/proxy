const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = process.env.TARGET_URL; // URL pihak ketiga (C)

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Proxy server is running' });
});

// Main proxy handler function
async function handleProxyRequest(req, res) {
  try {
    // Get the request path
    const requestPath = req.path;

    console.log('📨 Incoming request from backend');
    console.log('Path:', requestPath);
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Siapkan headers untuk diteruskan
    const forwardHeaders = { ...req.headers };

    // Hapus headers yang tidak perlu diteruskan
    delete forwardHeaders['host'];
    delete forwardHeaders['content-length'];

    // Hapus headers yang membawa informasi IP client asli
    // Agar request menggunakan IP server proxy sebagai source
    delete forwardHeaders['x-forwarded-for'];
    delete forwardHeaders['x-real-ip'];
    delete forwardHeaders['x-client-ip'];
    delete forwardHeaders['x-forwarded'];
    delete forwardHeaders['forwarded-for'];
    delete forwardHeaders['forwarded'];
    delete forwardHeaders['via'];

    // Ensure proper User-Agent for CloudFront compatibility
    if (!forwardHeaders['user-agent']) {
      forwardHeaders['user-agent'] = 'Mozilla/5.0 (compatible; ProxyBot/1.0)';
    }

    // Add Accept header if not present
    if (!forwardHeaders['accept']) {
      forwardHeaders['accept'] = 'application/json, text/plain, */*';
    }

    // Add Origin and Referer headers for CloudFront compatibility
    if (!forwardHeaders['origin']) {
      forwardHeaders['origin'] = 'https://www.tokocrypto.com';
    }
    if (!forwardHeaders['referer']) {
      forwardHeaders['referer'] = 'https://www.tokocrypto.com/';
    }

    // Build final URL - append the request path
    const finalUrl = `${TARGET_URL}${requestPath}`;

    // Kirim request ke pihak ketiga (C)
    console.log(`🔄 Forwarding ${req.method} to: ${finalUrl}`);

    const response = await axios({
      method: req.method,
      url: finalUrl,
      data: req.body,
      headers: forwardHeaders,
      maxRedirects: 5,
      validateStatus: () => true, // Terima semua status code
    });

    console.log('✅ Response from C:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    // Kirim response dari C kembali ke A dengan status code yang sama
    res.status(response.status)
       .set(response.headers)
       .send(response.data);

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.response) {
      // Server C merespons dengan error
      res.status(error.response.status)
         .set(error.response.headers)
         .send(error.response.data);
    } else if (error.request) {
      // Request dibuat tapi tidak ada response
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Tidak bisa terhubung ke target server',
        details: error.message
      });
    } else {
      // Error lainnya
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
}

// Proxy endpoint for /proxy path (backward compatibility)
app.post('/proxy', handleProxyRequest);

// Forward all other POST requests directly (transparent proxy)
app.post('*', handleProxyRequest);

// Forward all other methods if needed
app.all('*', async (req, res) => {
  // For non-POST, handle similarly
  if (req.path === '/health') {
    return; // Already handled above
  }
  await handleProxyRequest(req, res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`🎯 Target URL: ${TARGET_URL || 'NOT SET - Please set TARGET_URL in .env'}`);
  console.log(`📍 Flow: Backend A -> Server B (${PORT}) -> Target C`);
});
