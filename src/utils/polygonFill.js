/**
 * GPX 경로를 폴리곤으로 변환하고
 * 내부에 균일한 격자 포인트 생성
 */

// 점이 폴리곤 내부에 있는지 판단 (Ray casting)
export function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 경로 폴리곤 내부에 격자 포인트 생성
 * density: 격자 간격 (px) — 작을수록 촘촘
 */
export function generateFillPoints(polygon, canvasW, canvasH, density = 20) {
  if (polygon.length < 3) return [];

  // bbox
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const points = [];
  for (let y = minY + density / 2; y < maxY; y += density) {
    for (let x = minX + density / 2; x < maxX; x += density) {
      if (isPointInPolygon(x, y, polygon)) {
        // 약간의 랜덤 오프셋으로 격자 느낌 제거
        points.push({
          x: x + (Math.random() - 0.5) * density * 0.3,
          y: y + (Math.random() - 0.5) * density * 0.3,
        });
      }
    }
  }
  return points;
}

/**
 * GPX 포인트 배열을 단순화 (Douglas-Peucker)
 * 폴리곤 계산용 — 4071개 전부 쓰면 너무 무거움
 */
export function simplifyPath(points, tolerance = 3) {
  if (points.length <= 2) return points;

  const sqSegDist = (p, p1, p2) => {
    let x = p1.x, y = p1.y;
    let dx = p2.x - x, dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = p2.x; y = p2.y; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p.x - x; dy = p.y - y;
    return dx * dx + dy * dy;
  };

  const simplifyDp = (pts, first, last, sqTolerance, result) => {
    let maxSqDist = sqTolerance;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(pts[i], pts[first], pts[last]);
      if (d > maxSqDist) { maxSqDist = d; index = i; }
    }
    if (index !== -1) {
      if (index - first > 1) simplifyDp(pts, first, index, sqTolerance, result);
      result.push(pts[index]);
      if (last - index > 1) simplifyDp(pts, index, last, sqTolerance, result);
    }
  };

  const result = [points[0]];
  simplifyDp(points, 0, points.length - 1, tolerance * tolerance, result);
  result.push(points[points.length - 1]);
  return result;
}
