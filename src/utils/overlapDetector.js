/**
 * 새 러너 경로가 기존 경로와 겹치는지 감지
 * 겹침 셀 비율이 threshold 이상이면 파티클 트리거
 */
export function detectOverlap(newRunner, existingRunners, bbox, threshold = 0.15) {
  if (existingRunners.length === 0) return { hasOverlap: false, overlapCells: [] };

  const GRID = 80;
  const newCells = new Set();
  const existingCells = new Set();

  const toKey = (pt) => {
    const col = Math.floor(
      ((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * GRID
    );
    const row = Math.floor(
      ((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * GRID
    );
    return `${Math.max(0, Math.min(GRID-1, col))}_${Math.max(0, Math.min(GRID-1, row))}`;
  };

  for (const pt of newRunner.points) newCells.add(toKey(pt));
  for (const r of existingRunners) {
    for (const pt of r.points) existingCells.add(toKey(pt));
  }

  const overlapKeys = [...newCells].filter((k) => existingCells.has(k));
  const ratio = overlapKeys.length / newCells.size;

  return {
    hasOverlap: ratio >= threshold,
    overlapRatio: ratio,
    overlapKeys,
  };
}