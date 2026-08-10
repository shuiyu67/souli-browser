/**
 * 工具函数库 - 搜哩浏览器
 * 提供HTML解析、URL处理、数据存储等核心功能
 */

// ==================== 常量定义 ====================

const HTML_ENTITY_MAP = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&#x2F;': '/', '&#x60;': '`', '&#x3D;': '=',
  '&copy;': '©', '&reg;': '®', '&trade;': '™', '&#34;': '"'
};

const TAGS_TO_REMOVE = [
  'script', 'style', 'noscript', 'iframe', 'canvas', 'svg',
  'video', 'audio', 'embed', 'object', 'applet', 'meta', 'link'
];

// ==================== HTML处理 ====================

export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/&[a-zA-Z0-9#]+;/g, entity => HTML_ENTITY_MAP[entity] || entity);
}

export function cleanHtmlText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-zA-Z0-9#]+;/g, entity => HTML_ENTITY_MAP[entity] || entity)
    .replace(/\s+/g, ' ')
    .trim();
}

export function preprocessHtml(html) {
  if (!html) return '';
  let content = html;
  
  // 移除危险标签
  TAGS_TO_REMOVE.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*\\/?>`, 'gi');
    content = content.replace(regex, ' ');
  });
  
  // 移除注释
  content = content.replace(/<!--[\s\S]*?-->/g, ' ');
  
  // 提取body内容
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch?.[1] || content;
}

export function extractTitle(html) {
  if (!html) return '';
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : '';
}

// ==================== 内联元素解析 ====================

export function parseInlineElements(text, baseUrl) {
  if (!text) return [];

  const parts = [];
  let lastIndex = 0;
  // 按原文顺序扫描内联标签（a/strong/b/em/i/span/font），保留片段原始顺序（行内混排前提）
  const regex = /<(a|strong|b|em|i|span|font)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const t = cleanHtmlText(text.slice(lastIndex, m.index));
      if (t) parts.push({ type: 'text', text: t });
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const t = cleanHtmlText(inner);
    if (!t) { lastIndex = m.index + m[0].length; continue; }
    if (tag === 'a') {
      const url = (attrs.match(/href=["']([^"']+)["']/i) || [])[1] || '';
      if (!url) parts.push({ type: 'text', text: t });
      else parts.push({ type: 'a', text: t, url: resolveUrl(url, baseUrl) });
    } else if (tag === 'strong' || tag === 'b') {
      parts.push({ type: 'strong', text: t });
    } else if (tag === 'em' || tag === 'i') {
      parts.push({ type: 'em', text: t });
    } else if (tag === 'span' || tag === 'font') {
      const color = (attrs.match(/color=["']?([^"'>]+)["']?/i) || [])[1] || '';
      parts.push({ type: 'text', text: t, color: normalizeColor(color) });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    const t = cleanHtmlText(text.slice(lastIndex));
    if (t) parts.push({ type: 'text', text: t });
  }
  return parts;
}

// 把常见 CSS 颜色名/十六进制归一化，便于运行时内联 style 使用
export function normalizeColor(color) {
  if (!color) return '';
  color = color.trim().toLowerCase();
  const NAMED = {
    red: '#ff3b30', green: '#34c759', blue: '#0a84ff', yellow: '#ffcc00',
    orange: '#ff9500', purple: '#af52de', gray: '#8e8e93', grey: '#8e8e93',
    black: '#000000', white: '#ffffff', pink: '#ff2d55', cyan: '#32ade6'
  };
  if (NAMED[color]) return NAMED[color];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(color)) return color;
  if (/^rgb/.test(color)) return color;
  return '';
}

// ==================== URL处理 ====================

export function getBaseUrl(url) {
  if (!url) return '';
  try {
    const match = url.match(/^(https?:\/\/[^\/]+)/i);
    return match ? match[1] : url;
  } catch (e) {
    return url;
  }
}

export function resolveUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return baseUrl + url;
  return baseUrl + '/' + url;
}

export function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim().toLowerCase();
  return (url.startsWith('http://') || url.startsWith('https://')) 
    ? url 
    : 'https://' + url;
}

export function formatDisplayUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
}

export function isValidUrl(url) {
  return url && /^(https?:\/\/)?([\w-]+\.)+[\w-]+/.test(url);
}

// ==================== 数据存储 ====================

export function getStorageData(storage, key) {
  return new Promise((resolve) => {
    storage.get({
      key,
      success: (data) => {
        try { resolve(JSON.parse(data || '[]')); } 
        catch (e) { resolve([]); }
      },
      fail: () => resolve([])
    });
  });
}

export function setStorageData(storage, key, value) {
  return new Promise((resolve) => {
    storage.set({
      key,
      value: JSON.stringify(value),
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

// ==================== 工具函数 ====================

export function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function showToast(page, msg, duration = 2000) {
  page.toastMsg = msg;
  page.showToast = true;
  setTimeout(() => page.showToast = false, duration);
}

// ==================== 导出 ====================

export default {
  decodeHtmlEntities,
  cleanHtmlText,
  preprocessHtml,
  extractTitle,
  parseInlineElements,
  getBaseUrl,
  resolveUrl,
  normalizeUrl,
  formatDisplayUrl,
  isValidUrl,
  getStorageData,
  setStorageData,
  debounce,
  throttle,
  truncateText,
  generateId,
  showToast
};
