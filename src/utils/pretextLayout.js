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

export function measureName(name, fontSize) {
  // fontSize가 비정상이면 폴백
  if (!fontSize || fontSize <= 0 || isNaN(fontSize)) {
    return { width: name.length * 8, height: 14 };
  }

  const font = `${fontSize}px "Courier New", monospace`;
  try {
    const prep = getPrepSeg(name, font);
    const { maxLineWidth } = measureLineStats(prep, 9999);

    // maxLineWidth가 0이거나 비정상이면 폴백
    if (!maxLineWidth || maxLineWidth <= 0 || maxLineWidth > 2000) {
      return { width: name.length * fontSize * 0.6, height: fontSize * 1.3 };
    }

    return {
      width: maxLineWidth + 4,
      height: fontSize * 1.4,
    };
  } catch {
    // Pretext 실패 시 문자 수 기반 추정
    return {
      width: name.length * fontSize * 0.6,
      height: fontSize * 1.4,
    };
  }
}

export function warmupNames(names, fontSizes = [8, 10, 12, 14, 16, 20, 24, 32, 40]) {
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