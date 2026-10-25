// The isolated e2e backend (in-memory MongoDB, mock AI) on the code-visualizer
// suite's own ports, so it can run beside the chat suite's (:5066 / :5197).
//   node e2e/support/viz-backend.mjs
process.env.E2E_BACKEND_PORT ||= '5067';
process.env.E2E_APP_ORIGIN ||= 'http://127.0.0.1:5196';
await import('./isolated-backend.mjs');
