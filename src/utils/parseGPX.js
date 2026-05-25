/**
 * Apple Health GPX 파서
 * <extensions> 안의 speed 필드 포함
 */
export function parseGPX(xmlString, runnerName) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "application/xml");

  const error = xml.querySelector("parsererror");
  if (error) throw new Error("GPX 파싱 실패: " + error.textContent);

  const trkpts = Array.from(xml.querySelectorAll("trkpt"));
  if (trkpts.length === 0) throw new Error("trkpt 요소가 없습니다");

  const points = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    const ele = parseFloat(pt.querySelector("ele")?.textContent ?? "0");
    const time = new Date(pt.querySelector("time")?.textContent ?? 0).getTime();

    // Apple Health GPX extensions
    const speed = parseFloat(
      pt.querySelector("speed")?.textContent ?? "0"
    );

    return { lat, lon, ele, time, speed };
  });

  // 유효하지 않은 좌표 필터링
  const valid = points.filter(
    (p) => !isNaN(p.lat) && !isNaN(p.lon) && p.lat !== 0 && p.lon !== 0
  );

  if (valid.length === 0) throw new Error("유효한 좌표가 없습니다");

  return {
    id: crypto.randomUUID(),
    name: runnerName.trim() || "Anonymous",
    points: valid,
    uploadedAt: Date.now(),
    color: generateColor(runnerName),
  };
}

// 이름 기반 고유 색상 생성
function generateColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}