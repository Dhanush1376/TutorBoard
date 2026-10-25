/* Body of the JavaScript step-through worker. Not a module: visualizer/sandbox
   builds the worker from jsRecorder.js's text (which defines runInstrumented)
   followed by this file's text, and runs it inside the sandboxed iframe.
   The program arrives already instrumented (jsInstrument.js runs in the page:
   parsing is safe, running is not). */
/* global runInstrumented */
self.onmessage = async (e) => {
  const { code, maxSteps } = e.data || {};
  const result = await runInstrumented(code, { maxSteps });
  self.postMessage({ type: 'trace', result });
};
