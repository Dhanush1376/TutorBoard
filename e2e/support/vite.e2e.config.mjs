// The client's own Vite config, without hot reload or file watching: other work
// editing client files must not reload the page in the middle of an e2e run.
import base from '../../client/vite.config.js';

export default {
  ...base,
  server: { ...base.server, hmr: false, watch: null },
};
