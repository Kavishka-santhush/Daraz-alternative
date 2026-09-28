/* Lightweight structured logger with level filtering and pretty dev output. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

const threshold: Level = (process.env.LOG_LEVEL as Level) ?? 'info';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, message: string, meta?: unknown) {
  if (order[level] < order[threshold]) return;
  const ts = new Date().toISOString();
  if (process.env.NODE_ENV === 'production') {
    const line = JSON.stringify({ ts, level, message, meta });
    // eslint-disable-next-line no-console
    console.log(line);
    return;
  }
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`${COLORS[level]}[${ts}] ${level.toUpperCase()}${RESET} ${message}`, meta ?? '');
}

export const logger = {
  debug: (m: string, meta?: unknown) => emit('debug', m, meta),
  info: (m: string, meta?: unknown) => emit('info', m, meta),
  warn: (m: string, meta?: unknown) => emit('warn', m, meta),
  error: (m: string, meta?: unknown) => emit('error', m, meta),
};

export default logger;
