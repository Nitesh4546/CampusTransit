const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  if (levels[level] <= levels[currentLevel]) {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, ...args);
    } else if (level === 'warn') {
      console.warn(prefix, ...args);
    } else {
      console.log(prefix, ...args);
    }
  }
}

export const logger = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args),
};
