# Proxy Redesign - Act as API Server, Not Forwarder

## Problem

Proxy was configured as a transparent forwarder, which TokoCrypto's CloudFront detected and blocked with 403/451 errors.

**Discovery:** Running `wget` directly from proxy server returns **200 OK**, proving the server IP CAN access TokoCrypto. But forwarding requests through the proxy application failed.

## Root Cause

TokoCrypto CloudFront detects proxy forwarding patterns:
- Forwarded headers (X-Forwarded-For, Via, etc.)
- Proxy-like User-Agent strings
- Headers that indicate request came from another client

## Solution: Redesign as API Server

Changed the proxy to **act as an API server** that makes its own requests (like `wget` does), NOT as a request forwarder.

### Key Changes in server.js

**Before (Proxy Forwarder):**
```javascript
// Forward client headers
const forwardHeaders = { ...req.headers };
delete forwardHeaders['host'];
// ... still forwarding most client headers
```

**After (API Server):**
```javascript
// Create NEW headers as if THIS server is making the request
const apiHeaders = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

// Only forward essential auth headers
if (req.headers['x-mbx-apikey']) {
  apiHeaders['X-MBX-APIKEY'] = req.headers['x-mbx-apikey'];
}
```

### What This Achieves

1. **Mimics Direct Browser/Wget Request**
   - Fresh headers for each request
   - Browser-like User-Agent
   - No forwarding/proxy indicators

2. **Preserves Authentication**
   - Still forwards X-MBX-APIKEY for authenticated endpoints
   - Maintains request path and query string
   - Preserves request body for POST/PUT

3. **Avoids Detection**
   - No X-Forwarded-* headers
   - No Via headers
   - No proxy-related headers
   - Appears as if server itself is the client

## Testing After Deploy

```bash
# 1. Deploy to proxy server
cd /path/to/proxy
git checkout t
git pull origin t
npm install
# Restart service (pm2/systemctl)

# 2. Test endpoints
curl https://proxy.dexratoken.com/health
# Expected: {"status":"OK","message":"Proxy server is running"}

curl https://proxy.dexratoken.com/open/v1/common/time
# Expected: {"code":0,"msg":"Success","data":null,"timestamp":...}

curl https://proxy.dexratoken.com/open/v1/common/symbols
# Expected: {"code":0,"msg":"Success","data":[...]}
```

## Why This Should Work

1. ✅ Proxy server IP can access TokoCrypto (proven by wget)
2. ✅ Server makes requests as original client (not forwarding)
3. ✅ Uses browser-like headers (not proxy-like)
4. ✅ No forwarding indicators in headers
5. ✅ Still maintains API authentication

## Flow

```
Client API (crypto-toko)
  ↓ (sends: path, query, auth headers)
Proxy Server (proxy.dexratoken.com)
  ↓ (creates NEW request with fresh headers, like wget)
TokoCrypto API (www.tokocrypto.com)
  ↓ (sees direct request from proxy server IP)
Proxy Server
  ↓ (returns response)
Client API
```

**Key difference:** TokoCrypto sees the proxy server as the original client, not as a forwarder.
