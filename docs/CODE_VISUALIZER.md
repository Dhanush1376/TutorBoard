# Code walkthroughs (interactive code visualizer)

A learner asks about code; the answer's **Step through** button runs the program for real and
plays it back one step at a time: the current line, every variable in every call, the call tree,
memory and references, JavaScript's event loop, the output, and a tutor that explains a step from
the recorded facts. Lives inside the existing chat (no separate app, conversation or message).

## How a walkthrough is made

| Language | Runs where | How the steps are recorded | Mode shown to the learner |
|---|---|---|---|
| Python | Browser sandbox (Pyodide, CPython in WebAssembly) | `sys.settrace` (`client/src/visualizer/adapters/pythonTracer.py`) | Real run · traced line by line |
| JavaScript | Browser sandbox (Web Worker) | Source instrumented in the page, run in the worker on an observed event loop (`adapters/jsInstrument.js`, `jsRecorder.js`) | Real run · step markers added to your code |
| C, C++, Java | Judge0 sandbox (remote) | Source instrumented on the server (text only — never run there), compiled and run in Judge0 (`server/visualizer/`) | Real run · step markers added to your code |

Every run is real; no language falls back to a simulation (`mode: 'simulated'` exists in the format
but nothing produces it). What a trace can't show is listed in its notes (the ⓘ in the player).

**Shared trace format:** `client/src/visualizer/traceModel.js` (steps with line, event, every frame's
variables, output position; JavaScript steps also carry the event loop). One player and every view
read it, for all five languages.

## What the learner can do (`client/src/visualizer/ui/`)

- Play / pause / previous / next / first (reset) / last / replay, 0.5×–4× speed, a timeline slider
  (mouse or keyboard), current-line highlight in the editor.
- Click a line in the editor → the next time it runs. Lines that ran are marked; lines that never
  ran are dimmed.
- **Views:** Data (arrays with index pointers, grids, linked lists, trees, maps), Variables (click one
  for every value it held), Calls (recursion as a tree, with arguments and return values), Memory
  (variables → objects; shared objects; C/C++ pointers), Event loop (JavaScript: call stack, microtask
  queue, promise callbacks, timers, functions paused at `await`), Output, Ask (the tutor, at
  Simple / Normal / Deep).
- Under each step: what it did, and what happens next — including which way an `if` or loop went,
  read from where the next step lands.
- Change the program's input and run again (a new walkthrough for the new input).
- Answers to "step through / trace / line by line / what happens to the variables" questions get
  their Step through button highlighted; **Settings → Appearance → Open code walkthroughs
  automatically** opens it instead (`visualizer/intent.js`, `useWalkthroughSuggestions.js`).

## Security

**Browser (Python, JavaScript).** Code never runs in the page. `visualizer/sandbox/sandbox.js` opens
`/sandbox/js.html` or `/sandbox/python.html` in `<iframe sandbox="allow-scripts">` (no origin: no
cookies, no storage, every request cross-origin) and runs the program in a Web Worker created there.
The pages' Content-Security-Policy (inherited by the worker): JavaScript — no network at all
(fetch, XHR, WebSocket, `import()`, `importScripts`); Python — only the Pyodide CDN. The worker also
hides the network APIs. Limits: 1000 steps; 6 s (JavaScript) / 10 s (Python) wall clock, then the
worker is killed; timers capped at 200 runs. Verified in a real browser by
`e2e/codeVisualizer.spec.ts`, under the production headers too.

**Server (C, C++, Java).** The program is only rewritten as text on the TutorBoard server and runs in
Judge0, with explicit limits on every submission (`RUN_LIMITS` in
`server/controllers/compiler.controller.ts`): 5 s CPU, 10 s wall, 128 MB (Java 256 MB), 64 MB stack,
60 processes/threads, 1 MB of written files, **network off**. 500 steps / 700 KB of trace per run.
`server/tests/visualizer.live.test.ts` checks in the real sandbox: no network, none of TutorBoard's
secrets in the environment, runaway recursion and endless output stopped.

**Endpoints** (`server/routes/visualizer.routes.ts`, mounted before the upload routes): tracing and
explaining are open to guests (rate limited: `codeRunLimiter`, `strictGuestLimiter`, `aiRateLimiter`);
saving, reading, listing, updating and deleting need an account and only ever touch the caller's own
walkthroughs (404 otherwise). POSTs carry the CSRF token.

**Traces can't be faked as real runs.** The server signs every C/C++/Java trace it produces (HMAC,
`server/visualizer/traceProof.ts`); saving one requires an untouched signature. Python and JavaScript
traces are recorded in the learner's own browser, so they are saved marked `provenance: 'browser'`.
Every saved step must point inside its program and output; each language may only claim the mode it
really runs in.

## Saved walkthroughs (`server/models/CodeVisualization.js`)

One per user + chat session + message + program (`sourceHash` of language, code and input): opening
the same code again reuses it; changed code or input is a different walkthrough. Stores the trace,
provenance, how the run ended, the step the learner is on (restored on reopen), and the tutor's
follow-ups. Guests keep their last 8 in the browser.

**Retention:** deleted with their chat session, with "wipe cloud data", and with the account; each
user keeps their most recent 300 (older ones are pruned on save). No migration is needed (MongoDB;
new fields have defaults).

## Configuration

| Variable | Needed for | Notes |
|---|---|---|
| `JUDGE0_HOST` | C, C++, Java | e.g. `judge0-ce.p.rapidapi.com`; development defaults to the public `ce.judge0.com` |
| `JUDGE0_API_KEY` | C, C++, Java in production | Without it, production refuses to run compiled code |
| `JUDGE0_PROTOCOL` | self-hosted Judge0 | `http` or `https` (default) |
| `VISUALIZER_TRACE_SECRET` | signing traces | Optional; falls back to `JWT_SECRET`. Without either, C/C++/Java walkthroughs can't be saved |

## Deployment

1. Set `JUDGE0_HOST` / `JUDGE0_API_KEY` on the server (Render).
2. Deploy the client with the updated `vercel.json`: the sandbox pages get their own headers
   (`X-Frame-Options: SAMEORIGIN`, their own CSP in the page), and the app's CSP now allows the code
   editor (Monaco) from its CDN, its blob workers, same-origin frames, and the inline theme script
   (by hash). Before this, the production CSP blocked the code editor's loader and blob workers.
3. Run the e2e suite against the production build: `VIZ_PROD=1 npx playwright test -c playwright.viz.config.ts`.

## Tests

| Command | What |
|---|---|
| `cd client && npx vitest run src/visualizer` | trace format, JS tracer and event loop, Python tracer (CPython), analysis (calls, history, branches, memory), intent, sandbox page policies, player UI, five-language conformance (Python, JS) |
| `cd server && npx vitest run tests/visualizer*.ts` | instrumentation, parsing, endpoints, signatures, saving rules, retention, deletion cascade |
| `cd server && VISUALIZER_LIVE=1 npx vitest run tests/visualizer.live.test.ts` | real Judge0 runs: C, C++, Java conformance, errors, sandbox limits |
| `npx playwright test -c playwright.viz.config.ts` | the learner's journey (guest on desktop and mobile, signed-in save and reopen, C/C++/Java, browser sandbox); `VIZ_PROD=1` for the production build and headers |

The conformance programs (`client/src/visualizer/__tests__/conformance.js`) are the same bubble sort
and failing program in every language, checked for: variables, a condition both ways, a loop, a call
and its return value, an array changing, the sorted result, a runtime error at its line, and the
program's real end and output.

## Known limits

- Python: a list comprehension or generator expression runs as one step. Pyodide downloads (~6 s)
  the first time; packages beyond the standard library aren't available (no network in the sandbox).
- JavaScript: only an object's own data fields are shown (getters aren't run). Promise callbacks are
  shown from registration to when they run — the engine doesn't reveal the moment one is queued.
  Timers run in event-loop order on a simulated clock.
- C/C++: a variable appears once it has a value; pointers are followed only when their memory could
  be read (otherwise the address is shown); lambda bodies run as one step. A program using something
  the instrumenter can't follow still runs, showing only its output (said so plainly).
- Java: a variable appears once Java counts it as assigned; static fields aren't shown.
- The tutor's explanations come from the configured AI provider; with none available the
  walkthrough still works fully, without the Ask tab's answers.
- Not built: complexity/performance explanations and concept diagrams as artifact types; RAG context
  in the step tutor (the vector store is disabled in this environment).
