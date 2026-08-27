/**
 * 统一日志模块（带时间戳 + 级别，可扩展为远程上报）
 */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT = process.env.LOG_LEVEL || 'info';

function fmt(level, args) {
  const ts = new Date().toISOString();
  return [`[${ts}] [${level}]`, ...args];
}

export default {
  debug: (...a) => CURRENT >= LEVELS.debug && console.debug(...fmt('debug', a)),
  info: (...a) => CURRENT >= LEVELS.info && console.info(...fmt('info', a)),
  warn: (...a) => CURRENT >= LEVELS.warn && console.warn(...fmt('warn', a)),
  error: (...a) => console.error(...fmt('error', a)),
};
