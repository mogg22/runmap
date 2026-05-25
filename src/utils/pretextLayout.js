import {
  prepare,
  layout,
  prepareWithSegments,
  measureLineStats,
} from "@chenglou/pretext";

const cache = new Map();

function getPrep(text, font) {
  const key = `${text}||${font}`;
  if (!cache.has(key)) cache.set(key, prepare(text, font));
  return cache.get(key);
}

function getPrepSeg(text, font) {
  const key = `seg||${text}||${font}`;
  if (!cache.has(key)) cache.set(key, prepareWithSegments(text, font));
  return cache.get(key);
}

// 이름 텍스트의 실제 너비 계산 (DOM 접근 없음)
export function measureName(name, fontSize) {
  const font = `${fontSize}px "Courier New", monospace`;
  try {
    const prep = getPrepSeg(name, font);
    const { maxLineWidth } = measureLineStats(prep, 9999);
    return { width: maxLineWidth + 4, height: fontSize * 1.3 };
  } catch {
    return { width: name.length * fontSize * 0.6, height: fontSize * 1.3 };
  }
}

// 텍스트 풀 warmup
export function warmupNames(names, fontSizes = [10, 12, 14, 16, 18, 20, 22, 24]) {
  let count = 0;
  for (const name of names) {
    for (const size of fontSizes) {
      const font = `${size}px "Courier New", monospace`;
      try {
        getPrep(name, font);
        getPrepSeg(name, font);
        count++;
      } catch {}
    }
  }
  console.log(`[Pretext] warmup: ${count}개 캐시`);
}

export function clearCache() {
  cache.clear();
}