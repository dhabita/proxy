# CloudFront 403 Blocking Issue

## Problem

Proxy server mendapat **403 Forbidden** error dari CloudFront ketika forward request ke TokoCrypto:

```
Path: /open/v1/market/ticker/24hr
Method: GET
🔄 Forwarding GET to: https://www.tokocrypto.com/open/v1/market/ticker/24hr
✅ Response from C: 403
Error: Bad request from CloudFront
```

## Root Cause

**CloudFront IP Blocking** - TokoCrypto menggunakan CloudFront yang kemungkinan:
1. **Whitelist IP tertentu saja**
2. **Block data center IPs** (termasuk IP proxy: 157.20.219.186)
3. **Detect dan block proxy servers**

## Attempts Made

### ✅ Commit 1: `4df4666` - Add User-Agent and Accept headers
```javascript
forwardHeaders['user-agent'] = 'Mozilla/5.0 (compatible; ProxyBot/1.0)';
forwardHeaders['accept'] = 'application/json, text/plain, */*';
```
**Result:** Still 403

### ✅ Commit 2: `ff2282e` - Add Origin and Referer headers
```javascript
forwardHeaders['origin'] = 'https://www.tokocrypto.com';
forwardHeaders['referer'] = 'https://www.tokocrypto.com/';
```
**Result:** Still 403

### ✅ Discovery: Wget Works But Proxy Forwarding Doesn't

**Test from proxy server:**
```bash
wget www.tokocrypto.com/open/v1/common/symbols
# Result: 200 OK - Success!
```

**Via proxy forwarding:**
```bash
curl https://proxy.dexratoken.com/open/v1/common/symbols
# Result: 403/451 - Blocked!
```

**Root Cause:** TokoCrypto detects and blocks proxy forwarding patterns but allows direct server requests.

### ✅ Commit 3: FINAL SOLUTION - Redesign as API Server

Changed proxy from "request forwarder" to "API server that makes its own requests" (like wget):

**Key Changes:**
- Create NEW headers for each request (don't forward client headers)
- Use browser-like User-Agent
- Only forward essential auth headers (X-MBX-APIKEY)
- Server makes requests as if it's the original client

**Result:** This should work because server IP can access TokoCrypto via wget

## Solutions

### Solution 1: Whitelist Proxy IP di TokoCrypto ⭐ RECOMMENDED

Contact TokoCrypto support untuk whitelist IP proxy server:

```
Proxy Server IP: 96.30.196.143
Cloudflare IP (detected): 157.20.219.186
Domain: proxy.dexratoken.com
Purpose: API access untuk crypto trading application
```

**Note:** Proxy menggunakan Cloudflare, jadi ada 2 IP:
- Real server IP: 96.30.196.143
- Cloudflare IP: 157.20.219.186

Whitelist KEDUA IP untuk memastikan akses berhasil.

**Steps:**
1. Login ke TokoCrypto account
2. Go to API Management / Settings
3. Find IP Whitelist section
4. Add IP: `157.20.219.186`
5. Save dan test kembali

### Solution 2: Gunakan Residential IP Proxy

CloudFront biasanya tidak block residential IPs. Options:

1. **VPS dengan Residential IP:**
   - Digital Ocean Droplet di residential network
   - Linode dengan residential IP
   - AWS EC2 dengan Elastic IP (tapi tetap mungkin di-block)

2. **Residential Proxy Service:**
   - Bright Data (Luminati)
   - Oxylabs
   - Smartproxy

### Solution 3: API Key Based Access (Instead of Proxy)

Jika IP whitelist tidak memungkinkan, pertimbangkan alternative:
- Gunakan direct connection dari application server
- Whitelist application server IP di TokoCrypto
- Skip proxy entirely

### Solution 4: Rotate Proxy IPs

Gunakan multiple proxy servers dengan different IPs dan rotate:
- Setup multiple proxy instances
- Load balance atau rotate requests
- Lebih complex tapi lebih resilient

## Testing After Deployment

Setelah deploy update terakhir (commit `ff2282e`):

```bash
# 1. Deploy
cd /path/to/proxy
git pull origin t
pm2 restart proxy-server  # atau systemctl restart proxy

# 2. Test
curl -s https://proxy.dexratoken.com/open/v1/common/time

# Expected SUCCESS:
# {"code":0,"msg":"Success","data":null,"timestamp":...}

# If still 403:
# Need to whitelist IP or use different solution
```

## Verification Commands

```bash
# Check proxy IP
curl -s https://api.ipify.org
# Should return: 157.20.219.186

# Test direct from proxy server
curl -s https://www.tokocrypto.com/open/v1/common/time
# If this works but proxy doesn't, it's header/config issue
# If this also 403, it's IP blocking

# Check proxy logs
pm2 logs proxy-server
# or
tail -f /var/log/proxy/access.log
```

## Next Steps

1. **Deploy commit `ff2282e`** and test
2. If still 403:
   - Contact TokoCrypto support untuk IP whitelist
   - Consider alternative solutions above
3. If success:
   - Document working configuration
   - Monitor for future blocks

## Alternative: Skip Proxy for TokoCrypto

Jika proxy tidak feasible, disable di API:

**File:** `api/.env`
```env
# Leave empty to use direct connection
TOKOCRYPTO_PROXY_URL=
```

Restart API server dan akan langsung connect ke TokoCrypto tanpa proxy.

## Contact Information

- **TokoCrypto Support:** support@tokocrypto.com
- **API Documentation:** https://www.tokocrypto.com/apidocs
- **Proxy Server IP:** 96.30.196.143
- **Cloudflare IP:** 157.20.219.186
- **Proxy Domain:** proxy.dexratoken.com
