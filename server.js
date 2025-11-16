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

// Main API handler - acts as API server, not proxy forwarder
// Makes requests as if this server is the client (like wget does)
async function handleProxyRequest(req, res) {
  try {
    // Get the request path and query string
    const requestPath = req.path;
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';

    console.log('📨 Incoming request from backend');
    console.log('Path:', requestPath);
    console.log('Query:', queryString);
    console.log('Method:', req.method);

    // Build final URL - append the request path and query
    const finalUrl = queryString
      ? `${TARGET_URL}${requestPath}?${queryString}`
      : `${TARGET_URL}${requestPath}`;

    // Create NEW headers as if THIS server is making the request
    // NOT forwarding client headers - this is key to avoid detection
    const apiHeaders = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    };

    // Only forward essential API authentication headers if present
    // These are needed for TokoCrypto API authentication
    if (req.headers['x-mbx-apikey']) {
      apiHeaders['X-MBX-APIKEY'] = req.headers['x-mbx-apikey'];
    }

    // Keep Content-Type if present (for POST/PUT requests)
    if (req.headers['content-type']) {
      apiHeaders['Content-Type'] = req.headers['content-type'];
    }

    // Prepare request body if present
    let requestData = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && Object.keys(req.body).length > 0) {
        // For form data
        if (apiHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
          requestData = new URLSearchParams(req.body).toString();
        } else {
          requestData = req.body;
        }
      }
    }

    // Make request as if THIS server is the client (like wget)
    console.log(`🌐 Making ${req.method} request to: ${finalUrl}`);
    console.log('🔑 Auth headers:', req.headers['x-mbx-apikey'] ? 'Present' : 'Not present');

    const response = await axios({
      method: req.method,
      url: finalUrl,
      data: requestData,
      headers: apiHeaders,
      maxRedirects: 5,
      validateStatus: () => true, // Accept all status codes
      timeout: 30000, // 30 second timeout
    });

    console.log('✅ Response status:', response.status);
    if (response.status === 200) {
      console.log('📦 Response data preview:', JSON.stringify(response.data).substring(0, 200));
    } else {
      console.log('⚠️  Response data:', JSON.stringify(response.data));
    }

    // Send response back to client
    res.status(response.status)
       .set({
         'Content-Type': response.headers['content-type'] || 'application/json',
         'Access-Control-Allow-Origin': '*',
       })
       .send(response.data);

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.response) {
      // TokoCrypto responded with error
      console.error('📛 Error response:', error.response.status, JSON.stringify(error.response.data));
      res.status(error.response.status)
         .set({ 'Content-Type': 'application/json' })
         .send(error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('📛 No response from TokoCrypto');
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Cannot connect to TokoCrypto API',
        details: error.message
      });
    } else {
      // Other errors
      console.error('📛 Internal error:', error.message);
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
