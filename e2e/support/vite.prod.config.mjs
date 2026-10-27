// The client's production build, served the way Vercel serves it: every header
// rule in vercel.json applied (in order, a later rule winning a header), and /api
// proxied to the isolated backend. Lets e2e tests run under the real production
// Content-Security-Policy.
import fs from 'node:fs';
import base from '../../client/vite.config.js';

const vercel = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const rules = (vercel.headers || []).map((r) => ({ match: new RegExp(`^${r.source}$`), headers: r.headers }));

const vercelHeaders = {
  name: 'vercel-headers',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '/').split('?')[0];
      for (const rule of rules) if (rule.match.test(path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
      next();
    });
  },
};

export default {
  ...base,
  plugins: [...(base.plugins || []), vercelHeaders],
  preview: { proxy: base.server.proxy },
};
