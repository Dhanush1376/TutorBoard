# Cloudflare CDN Configuration

To optimize global asset distribution and enhance security, follow these settings in the Cloudflare Dashboard:

## 1. DNS Settings
- Ensure the `A` or `CNAME` records for your domain are **Proxied** (Orange cloud icon).

## 2. SSL/TLS
- **Mode**: Full (Strict)
- **Edge Certificates**: Always Use HTTPS = On
- **Minimum TLS Version**: 1.2

## 3. Caching
- **Browser Cache TTL**: 4 hours
- **Crawler Hints**: On
- **Tiered Cache**: On
- **Page Rules**:
  - `*example.com/assets/*`: Cache Everything, Edge Cache TTL: 7 days

## 4. Security
- **WAF**: Enable default managed rules.
- **Bot Fight Mode**: On
- **HSTS**: Enable with subdomains and preload.

## 5. Optimization
- **Brotli**: On
- **Early Hints**: On
- **Rocket Loader**: Off (Can interfere with React/Vite hydration)

## 6. Server Headers
The server is configured to trust Cloudflare IPs and handle `X-Forwarded-For` correctly.

```javascript
// server/app.js
app.set('trust proxy', true);
```
