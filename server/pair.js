/**
 * 交易对（pair）编解码工具
 * ---------------------------------------------------------------
 * URL 中的交易对形如 "SPARK/USDT"，含斜杠，不能直接作为单个 path segment。
 * 约定：
 *   - 路由使用 Express 的 "/*pair" 贪婪匹配（兼容含斜杠的交易对）
 *   - 对外（前端 / API 返回）一律用原始带斜杠形式，如 "SPARK/USDT"
 *   - 本工具提供 normalize（去掉首尾分隔符）与 encode/decode 用于日志
 * ---------------------------------------------------------------
 */

/** 标准化：去掉因 /*pair 匹配产生的首尾斜杠/空格 */
export function normalize(pair) {
  if (!pair) return '';
  return String(pair).trim().replace(/^\/+|\/+$/g, '').toUpperCase();
}

/** 判断是否为合法交易对（形如 BASE/QUOTE，两部分） */
export function isValid(pair) {
  const parts = normalize(pair).split('/');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/** 编码为 URL-safe（前端可选使用；后端用 /*pair 故非必需，保留供扩展） */
export function encode(pair) {
  return normalize(pair).replace('/', '%2F');
}

/** 解码 */
export function decode(pair) {
  return normalize(pair).replace('%2F', '/');
}

export default { normalize, isValid, encode, decode };
