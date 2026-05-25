/**
 * GPS 좌표 → 캔버스 픽셀 변환
 * 모든 러너 경로의 bbox를 기준으로 정규화
 */

export function computeBbox(runners) {
  if (runners.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const runner of runners) {
    for (const pt of runner.points) {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lon < minLon) minLon = pt.lon;
      if (pt.lon > maxLon) maxLon = pt.lon;
    }
  }

  // 여백 추가 (전체 범위의 10%)
  const latPad = (maxLat - minLat) * 0.1 || 0.001;
  const lonPad = (maxLon - minLon) * 0.1 || 0.001;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };
}

export function projectPoint(lat, lon, bbox, width, height) {
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * width;
  // lat은 위가 클수록 위쪽이므로 반전
  const y = ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * height;
  return { x, y };
}

// 경로 전체를 픽셀 배열로 변환
export function projectPath(points, bbox, width, height) {
  return points.map((pt) => projectPoint(pt.lat, pt.lon, bbox, width, height));
}