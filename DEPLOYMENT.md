# Proxy Deployment Info

## Current Deployment

**URL:** https://proxy.dexratoken.com
**Server IP:** 96.30.196.143
**Cloudflare IP:** 157.20.219.186
**Port:** 80
**Target:** https://www.tokocrypto.com

## Status Check

```bash
curl https://proxy.dexratoken.com/health
```

Expected response:
```json
{"status":"OK","message":"Proxy server is running"}
```

## Configuration

File: `.env`

```env
PORT=80
TARGET_URL=https://www.tokocrypto.com
```

## Usage from API

Update `api/.env`:

```env
TOKOCRYPTO_PROXY_URL=https://proxy.dexratoken.com
```

## Flow

```
API (crypto-toko)
  → https://proxy.dexratoken.com
    → https://www.tokocrypto.com
      → https://proxy.dexratoken.com
        → API (crypto-toko)
```

## Benefits

1. **Static IP** - Proxy server has static IP for TokoCrypto whitelist
2. **Centralized** - Single point for all TokoCrypto API calls
3. **Monitoring** - Can monitor all API traffic
4. **Security** - API credentials still encrypted via HTTPS
5. **Flexibility** - Easy to switch proxy on/off via environment variable

## Branch

This proxy repository is on branch: `t`

```bash
git branch
# * t
```

## Maintenance

### Update Proxy Code

```bash
git checkout t
git pull origin t
npm install
# Restart proxy service
```

### Monitor Logs

Check server logs to see incoming requests from API and outgoing requests to TokoCrypto.

### SSL Certificate

Ensure SSL certificate for `proxy.dexratoken.com` is valid and auto-renewing.

## Security

- All traffic uses HTTPS
- No API keys stored in proxy
- Only forwards requests transparently
- Can add IP whitelist if needed
- Can add rate limiting if needed
