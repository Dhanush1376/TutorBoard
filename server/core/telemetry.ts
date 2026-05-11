/**
 * telemetry.ts — Enterprise Observability v8.0
 * 
 * Initializes OpenTelemetry with OTLP exporter for deep tracing.
 * Integrates with Sentry for error reporting.
 * 
 * Uses dynamic imports to prevent startup crashes if OTel packages are misconfigured.
 */

const SERVICE_NAME = 'tutorboard-backend';

export const initTelemetry = async () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Telemetry] Skipping OTel init in non-prod environment');
    return;
  }

  try {
    console.log('[Telemetry] Loading OpenTelemetry modules...');
    
    // Dynamic imports to handle ESM/CJS interop and missing packages safely
    const [
      { NodeSDK },
      { getNodeAutoInstrumentations },
      { OTLPTraceExporter },
      resources,
      semanticConventions,
      Sentry
    ] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/auto-instrumentations-node'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@sentry/node')
    ]);

    const Resource = (resources as any).Resource || (resources as any).default?.Resource;
    const SemanticResourceAttributes = (semanticConventions as any).SemanticResourceAttributes || (semanticConventions as any).default?.SemanticResourceAttributes;

    console.log('[Telemetry] Initializing OpenTelemetry SDK...');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    console.log('✅ [Telemetry] OpenTelemetry Active.');

    // Sentry Integration
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
      });
      console.log('✅ [Telemetry] Sentry initialized');
    }

    // NOTE: SDK shutdown is handled by the centralized graceful shutdown in main.ts.
    // Do NOT register a separate SIGTERM handler here — it would race with server shutdown.

  } catch (err: any) {
    console.warn(`⚠️ [Telemetry] Failed to initialize observability stack: ${err.message}`);
    // Non-critical: allow app to continue without telemetry
  }
};
