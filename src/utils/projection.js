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

  const latPad = (maxLat - minLat) * 0.1 || 0.001;
  const lonPad = (maxLon - minLon) * 0.1 || 0.001;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };
}

export function projectPointKakao(lat, lon, map) {
  if (!map || !window.kakao?.maps) return null;

  try {
    const projection = map.getProjection();
    const latLng = new window.kakao.maps.LatLng(lat, lon);
    const point = projection.containerPointFromCoords(latLng);
    return { x: point.x, y: point.y };
  } catch {
    return null;
  }
}

export function projectPathKakao(points, map) {
  if (!map || !window.kakao?.maps) return [];
  return points
    .map((pt) => projectPointKakao(pt.lat, pt.lon, map))
    .filter(Boolean);
}

export function projectPoint(lat, lon, bbox, width, height) {
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * width;
  const y = ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * height;
  return { x, y };
}

export function projectPath(points, bbox, width, height) {
  return points.map((pt) => projectPoint(pt.lat, pt.lon, bbox, width, height));
}
