type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase() as LogLevel;
const activeLevel = LEVEL_WEIGHT[configuredLevel] ? configuredLevel : 'info';

export interface LogContext {
  subsystem?: string;
  phase?: string;
  requestId?: string;
  [key: string]: unknown;
}

function serializeContext(context: LogContext = {}) {
  const pairs = Object.entries({
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
    ...context,
  }).filter(([, value]) => value !== undefined && value !== null);

  return pairs.map(([key, value]) => `${key}=${String(value)}`).join(' ');
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[activeLevel]) return;

  const isProd = process.env.NODE_ENV === 'production';
  const timestamp = new Date().toISOString();
  
  if (isProd) {
    // Structured JSON logging for production (Logflare, Datadog, ELK)
    const logObject = {
      timestamp,
      level: level.toUpperCase(),
      message,
      pid: process.pid,
      ...context,
    };
    const line = JSON.stringify(logObject);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    // Human-readable logging for development
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message} ${serializeContext(context)}`.trim();
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

export function childLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) => logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) => logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext) => logger.error(message, { ...defaultContext, ...context }),
  };
}
