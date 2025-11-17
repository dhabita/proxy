const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = process.env.TARGET_URL; // URL pihak ketiga (C)

// ==================== ERROR MAPPING ====================
// Map TokoCrypto error codes to human-readable messages
const ERROR_MAP = {
  '-1': {
    type: 'AUTHENTICATION',
    category: 'AUTH_ERROR',
    message: 'Invalid API key or signature',
    suggestion: 'Check API credentials in TokoCrypto settings'
  },
  '-2': {
    type: 'INSUFFICIENT_BALANCE',
    category: 'BALANCE_ERROR',
    message: 'Insufficient funds',
    suggestion: 'Deposit more funds to your account'
  },
  '3203': {
    type: 'INVALID_PARAMETER',
    category: 'PARAM_ERROR',
    message: 'Incorrect order quantity',
    suggestion: 'Quantity must match stepSize precision'
  },
  '3204': {
    type: 'INVALID_PARAMETER',
    category: 'PARAM_ERROR',
    message: 'Minimum notional not met',
    suggestion: 'Increase order size to meet 20,000 IDR minimum'
  },
  '027037': {
    type: 'TOKOCRYPTO_ERROR',
    category: 'TOKOCRYPTO_ERROR',
    message: 'TokoCrypto internal error',
    suggestion: 'Check: API key active, account verified, IP whitelisted, sufficient balance'
  },
  '-1003': {
    type: 'RATE_LIMIT_EXCEEDED',
    category: 'RATE_LIMIT',
    message: 'Too many requests',
    suggestion: 'Wait 60 seconds before retrying'
  },
  '4001': {
    type: 'MARKET_CLOSED',
    category: 'MARKET_ERROR',
    message: 'Trading suspended',
    suggestion: 'Market maintenance in progress, try again later'
  },
  '4002': {
    type: 'INVALID_SYMBOL',
    category: 'MARKET_ERROR',
    message: 'Symbol not found',
    suggestion: 'Check available trading pairs at /open/v1/common/symbols'
  }
};

/**
 * Transform TokoCrypto error response to readable format
 */
function transformErrorResponse(tokoResponse) {
  const errorCode = tokoResponse.code?.toString() || tokoResponse.data?.code?.toString() || 'UNKNOWN';
  const errorMsg = tokoResponse.msg || tokoResponse.data?.errorData || '';

  // Get mapped error info
  const mapped = ERROR_MAP[errorCode] || {
    type: 'UNKNOWN',
    category: 'UNKNOWN_ERROR',
    message: `Unmapped error code: ${errorCode}`,
    suggestion: 'Contact support with this error code'
  };

  return {
    code: parseInt(errorCode) || -1,
    msg: `${mapped.category}: ${mapped.message}`,
    data: {
      status: "ERROR",
      type: mapped.type,
      code: errorCode,
      errorData: `${mapped.message}${errorMsg ? ' - ' + errorMsg : ''}`,
      details: {
        reason: errorMsg || `TokoCrypto error code ${errorCode}`,
        suggestion: mapped.suggestion,
        originalResponse: tokoResponse
      }
    },
    timestamp: Date.now()
  };
}

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

    // Check if TokoCrypto returned an error (even with 200 status)
    const isError = response.data &&
                    (response.data.code !== 0 && response.data.code !== undefined) ||
                    response.data.status === 'ERROR' ||
                    response.status !== 200;

    if (isError) {
      console.log('⚠️  Error response from TokoCrypto:', JSON.stringify(response.data));

      // Transform error to readable format
      const transformedError = transformErrorResponse(response.data);

      console.log('📤 Sending transformed error:', JSON.stringify(transformedError));

      // Send transformed error with original HTTP status
      res.status(response.status)
         .set({
           'Content-Type': 'application/json',
           'Access-Control-Allow-Origin': '*',
         })
         .json(transformedError);
    } else {
      // SUCCESS case - forward as-is
      console.log('📦 Success response preview:', JSON.stringify(response.data).substring(0, 200));

      res.status(response.status)
         .set({
           'Content-Type': response.headers['content-type'] || 'application/json',
           'Access-Control-Allow-Origin': '*',
         })
         .send(response.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.response) {
      // TokoCrypto responded with error - transform it
      console.error('📛 Error response:', error.response.status, JSON.stringify(error.response.data));

      const transformedError = transformErrorResponse(error.response.data);

      res.status(error.response.status)
         .set({ 'Content-Type': 'application/json' })
         .json(transformedError);
    } else if (error.request) {
      // Request made but no response - network error
      console.error('📛 No response from TokoCrypto');

      res.status(503).json({
        code: -9999,
        msg: 'PROXY_ERROR: Connection timeout',
        data: {
          status: 'ERROR',
          type: 'UPSTREAM_ERROR',
          code: 'PROXY_001',
          errorData: 'Could not reach TokoCrypto API servers',
          details: {
            reason: error.code === 'ETIMEDOUT' ? 'Connection timeout after 30 seconds' : 'Network error',
            suggestion: 'TokoCrypto may be experiencing issues. Try again later.'
          }
        },
        timestamp: Date.now()
      });
    } else {
      // Other errors - proxy internal error
      console.error('📛 Internal error:', error.message);

      res.status(500).json({
        code: -9999,
        msg: 'PROXY_ERROR: Internal server error',
        data: {
          status: 'ERROR',
          type: 'INTERNAL_ERROR',
          code: 'PROXY_002',
          errorData: `Proxy server error: ${error.message}`,
          details: {
            reason: error.message,
            suggestion: 'Contact system administrator'
          }
        },
        timestamp: Date.now()
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
