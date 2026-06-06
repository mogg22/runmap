import { useEffect, useRef, useCallback, useState } from "react";
import { useRunners } from "../../hooks/useRunners";
import { useHeatmap } from "../../hooks/useHeatmap";
import { usePhysics } from "../../hooks/usePhysics";
import { useFillDensity } from "../../hooks/useFillDensity";
import { projectPath, projectPathKakao } from "../../utils/projection";
import { measureName, warmupNames } from "../../utils/pretextLayout";
import { ParticleSystem } from "../../utils/particleSystem";
import { detectOverlap } from "../../utils/overlapDetector";
import { isPointInPolygon, simplifyPath } from "../../utils/polygonFill";
import { runnersStore } from "../../store/runnersStore";
import "./RunMap.css";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function getPolygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return Math.abs(area / 2);
}

function getRunnerEmphasis(rank, total) {
  if (rank === 0) {
    return { rank, fontScale: 1.45, fontWeight: 850, opacity: 0.95, glow: 9, routeWidth: 3.2, routeAlpha: 0.9 };
  }
  if (rank === 1) {
    return { rank, fontScale: 1.25, fontWeight: 760, opacity: 0.86, glow: 5, routeWidth: 2.4, routeAlpha: 0.78 };
  }
  if (rank === 2) {
    return { rank, fontScale: 1.12, fontWeight: 680, opacity: 0.8, glow: 3, routeWidth: 1.9, routeAlpha: 0.68 };
  }

  const fade = total > 1 ? rank / (total - 1) : 0;
  return {
    rank,
    fontScale: clamp(1 - fade * 0.14, 0.86, 1),
    fontWeight: 520,
    opacity: clamp(0.72 - fade * 0.18, 0.48, 0.72),
    glow: 0,
    routeWidth: clamp(1.45 - fade * 0.35, 1, 1.45),
    routeAlpha: clamp(0.55 - fade * 0.18, 0.34, 0.55),
  };
}

function buildRunnerEmphasis(projectedEntries) {
  const ranked = projectedEntries
    .map(({ runner, pts }) => ({
      id: runner.id,
      area: pts.length >= 3 ? getPolygonArea(pts) : 0,
    }))
    .sort((a, b) => b.area - a.area);

  const emphasisById = new Map();
  ranked.forEach(({ id }, rank) => {
    emphasisById.set(id, getRunnerEmphasis(rank, ranked.length));
  });

  return emphasisById;
}

function makeBlock(runner, index, x, y, fontSize, textWidth, emphasis) {
  return {
    id: `fill-${runner.id}-${index}`,
    text: runner.name,
    color: runner.color,
    rank: emphasis.rank,
    baseX: x,
    baseY: y,
    x,
    y,
    velX: 0,
    velY: 0,
    fontSize,
    textWidth,
    fontWeight: emphasis.fontWeight,
    textShadow: emphasis.glow > 0 ? `0 0 ${emphasis.glow}px ${runner.color}` : "none",
    opacity: 0,
    targetOpacity: emphasis.opacity,
    repulsionStrength: 30,
    vibration: 0,
  };
}

function createFillBlocks(runner, projectedPoints, fillDensity, zoom, emphasis) {
  if (projectedPoints.length < 3) return [];

  const tolerance = 0.05 / Math.max(zoom, 0.1);
  const polygon = simplifyPath(projectedPoints, tolerance);
  if (polygon.length < 3) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const area = getPolygonArea(polygon);
  const areaFontSize = clamp(Math.sqrt(area) * 0.03, 4, 20);
  const widthFontSize = clamp(width / Math.max(runner.name.length, 1), 4, areaFontSize);
  const fontSize = Math.min(
    areaFontSize * emphasis.fontScale,
    widthFontSize,
    Math.max(4, fillDensity * 0.7 * emphasis.fontScale),
  );
  const measured = measureName(runner.name, fontSize);
  const textWidth = measured.width ?? runner.name.length * fontSize * 0.6;
  const stepX = Math.max(textWidth * 0.9, fontSize * 1.2);
  const stepY = Math.max(fontSize * 0.9, 4);

  if (width < stepX || height < stepY * 1.5) {
    const blocks = [];
    let dist = 0;
    for (let i = 1; i < projectedPoints.length; i++) {
      const prev = projectedPoints[i - 1];
      const curr = projectedPoints[i];
      dist += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (dist >= stepX) {
        dist = 0;
        blocks.push(makeBlock(runner, i, curr.x, curr.y, fontSize, textWidth, emphasis));
      }
    }
    return blocks;
  }

  const blocks = [];
  let index = 0;
  let row = 0;
  for (let y = minY + stepY / 2; y < maxY; y += stepY) {
    const rowOffset = row % 2 === 0 ? 0 : stepX * 0.45;
    for (let x = minX + textWidth / 2 + rowOffset; x < maxX - textWidth / 2; x += stepX) {
      const leftX = x - textWidth / 2;
      const rightX = x + textWidth / 2;
      if (
        isPointInPolygon(x, y, polygon) &&
        isPointInPolygon(leftX, y, polygon) &&
        isPointInPolygon(rightX, y, polygon)
      ) {
        blocks.push(makeBlock(runner, index, x, y, fontSize, textWidth, emphasis));
        index++;
      }
    }
    row++;
  }

  return blocks;
}

function fitRunnerBounds(map, runner) {
  if (!runner.points?.length) return;

  const bounds =
    new window.kakao.maps.LatLngBounds();

  runner.points.forEach((p) => {
    bounds.extend(
      new window.kakao.maps.LatLng(
        p.lat,
        p.lon
      )
    );
  });

  map.setBounds(bounds);
}

export function RunMap() {
  const containerRef = useRef(null);
  const routeCanvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const mapRef = useRef(null);
  const textLayerRef = useRef(null);
  const nodesRef = useRef([]);
  const blocksRef = useRef([]);
  const rafRef = useRef(null);
  const particleSysRef = useRef(null);
  const prevRunnersRef = useRef([]);
  const drawAllRoutesRef = useRef(null);
  const rebuildBlocksRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const zoomRef = useRef(1);
  const skipNextClickRef = useRef(false);
  const overlayDragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [densityDisplay, setDensityDisplay] = useState(null);
  const densityTimerRef = useRef(null);
  const [topRunners, setTopRunners] = useState([]);

  const runners = useRunners();
  const { bbox } = useHeatmap(runners, size.w, size.h);
  const fillDensity = useFillDensity();
  const { updateMouse, updateZoom, computeBlock, applyShockwave } = usePhysics();

  const computeBlockRef = useRef(computeBlock);
  const applyShockwaveRef = useRef(applyShockwave);
  useEffect(() => { computeBlockRef.current = computeBlock; }, [computeBlock]);
  useEffect(() => { applyShockwaveRef.current = applyShockwave; }, [applyShockwave]);

  const setOverlayTransform = useCallback(({ dx = 0, dy = 0, scale = 1, originX = 0, originY = 0 } = {}) => {
    const transform = dx === 0 && dy === 0 && scale === 1
      ? ""
      : `translate(${dx}px, ${dy}px) scale(${scale})`;
    const origin = `${originX}px ${originY}px`;

    for (const node of [routeCanvasRef.current, textLayerRef.current]) {
      if (!node) continue;
      node.style.transform = transform;
      node.style.transformOrigin = origin;
    }
  }, []);

  const syncMapOverlays = useCallback(({ animateText = false } = {}) => {
    setOverlayTransform();
    drawAllRoutesRef.current?.();
    rebuildBlocksRef.current?.({ animate: animateText });
  }, [setOverlayTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || kakaoMapRef.current) return undefined;

    let intervalId = null;
    let map = null;
    const handlers = [];
    let redrawRaf = null;

    const scheduleRedraw = ({ animateText = false } = {}) => {
      if (redrawRaf) cancelAnimationFrame(redrawRaf);
      redrawRaf = requestAnimationFrame(() => {
        if (map) {
          const nextZoom = 2 ** (5 - map.getLevel());
          zoomRef.current = nextZoom;
          updateZoom(nextZoom);
          setZoom(nextZoom);
        }
        if (overlayDragRef.current.active) return;
        syncMapOverlays({ animateText });
      });
    };

    const init = () => {
      if (!window.kakao?.maps || kakaoMapRef.current) return;

      map = new window.kakao.maps.Map(el, {
        center: new window.kakao.maps.LatLng(37.498, 126.845),
        level: 5,
      });

      map.setDraggable(true);
      map.setZoomable(true);
      kakaoMapRef.current = map;

      for (const eventName of ["center_changed", "zoom_changed", "bounds_changed", "drag", "dragend", "idle"]) {
        const handler = () => scheduleRedraw();
        window.kakao.maps.event.addListener(map, eventName, handler);
        handlers.push([eventName, handler]);
      }

      const dragStartHandler = () => {
        skipNextClickRef.current = true;
      };
      window.kakao.maps.event.addListener(map, "dragstart", dragStartHandler);
      handlers.push(["dragstart", dragStartHandler]);

      scheduleRedraw({ animateText: true });
    };

    if (window.kakao?.maps) {
      init();
    } else {
      intervalId = setInterval(init, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (redrawRaf) cancelAnimationFrame(redrawRaf);
      if (map && window.kakao?.maps) {
        handlers.forEach(([eventName, handler]) => {
          window.kakao.maps.event.removeListener(map, eventName, handler);
        });
      }
    };
  }, [syncMapOverlays, updateZoom]);

  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || runners.length === 0) return;

    fitRunnerBounds(
      map,
      runners[runners.length - 1]
    );
  }, [runners]);

  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas || size.w === 0) return undefined;

    canvas.width = size.w;
    canvas.height = size.h;

    if (!particleSysRef.current) {
      particleSysRef.current = new ParticleSystem(canvas);
      particleSysRef.current.start();
    } else {
      particleSysRef.current.resize(size.w, size.h);
    }

    return () => {
      particleSysRef.current?.stop();
      particleSysRef.current = null;
    };
  }, [size]);

  useEffect(() => {
    if (runners.length > 0) warmupNames(runners.map((r) => r.name));
  }, [runners]);

  const drawAllRoutes = useCallback(() => {
    const canvas = routeCanvasRef.current;
    const kakaoMap = kakaoMapRef.current;
    if (!canvas || size.w === 0) return;

    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size.w, size.h);

    const projectedEntries = runners
      .map((runner) => ({
        runner,
        pts: kakaoMap && window.kakao?.maps
          ? projectPathKakao(runner.points, kakaoMap)
          : bbox ? projectPath(runner.points, bbox, size.w, size.h) : [],
      }))
      .filter(({ pts }) => pts.length >= 2);
    const emphasisById = buildRunnerEmphasis(projectedEntries);

    setTopRunners(getTopRunnerRanking(projectedEntries));

    function getTopRunnerRanking(projectedEntries) {
      return projectedEntries
        .map(({ runner, pts }) => ({
          id: runner.id,
          name: runner.name,
          color: runner.color,
          area: pts.length >= 3 ? getPolygonArea(pts) : 0,
        }))
        .sort((a, b) => b.area - a.area)
        .slice(0, 3);
    }

    for (const { runner, pts } of projectedEntries) {
      const emphasis = emphasisById.get(runner.id) ?? getRunnerEmphasis(0, 1);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = runner.color;
      ctx.lineWidth = emphasis.routeWidth;
      ctx.globalAlpha = emphasis.routeAlpha;
      ctx.stroke();
    }
  }, [runners, bbox, size]);

  useEffect(() => { drawAllRoutesRef.current = drawAllRoutes; }, [drawAllRoutes]);
  useEffect(() => { drawAllRoutes(); }, [drawAllRoutes]);

  const rebuildBlocks = useCallback(({ animate = true } = {}) => {
    const layer = textLayerRef.current;
    const kakaoMap = kakaoMapRef.current;
    if (size.w === 0 || !layer || runners.length === 0) return;

    nodesRef.current.forEach((n) => n.remove());
    nodesRef.current = [];

    const allBlocks = [];
    const currentZoom = zoomRef.current;
    const effectiveDensity = fillDensity / Math.max(currentZoom, 0.1);

    const projectedEntries = runners
      .map((runner) => ({
        runner,
        pts: kakaoMap && window.kakao?.maps
          ? projectPathKakao(runner.points, kakaoMap)
          : bbox ? projectPath(runner.points, bbox, size.w, size.h) : [],
      }))
      .filter(({ pts }) => pts.length >= 2);
    const emphasisById = buildRunnerEmphasis(projectedEntries);

    for (const { runner, pts } of projectedEntries) {
      const emphasis = emphasisById.get(runner.id) ?? getRunnerEmphasis(0, 1);
      allBlocks.push(...createFillBlocks(runner, pts, effectiveDensity, currentZoom, emphasis));
    }

    blocksRef.current = allBlocks;

    allBlocks.forEach((block) => {
      const span = document.createElement("span");
      span.className = "name-block";
      span.textContent = block.text;
      span.style.fontSize = `${block.fontSize}px`;
      span.style.fontWeight = `${block.fontWeight}`;
      span.style.color = block.color;
      span.style.textShadow = block.textShadow;
      span.style.opacity = animate ? "0" : `${block.targetOpacity}`;
      span.style.transition = animate ? "opacity 0.4s ease" : "none";
      span.style.transform = `translate(${block.x - block.textWidth / 2}px, ${block.y - block.fontSize / 2}px)`;
      layer.appendChild(span);
      nodesRef.current.push(span);
      if (animate) {
        setTimeout(() => { span.style.opacity = block.targetOpacity; }, Math.random() * 400);
      }
    });
  }, [runners, bbox, size, fillDensity]);

  useEffect(() => { rebuildBlocksRef.current = rebuildBlocks; }, [rebuildBlocks]);
  useEffect(() => { rebuildBlocks(); }, [rebuildBlocks, zoom]);

  useEffect(() => {
    if (size.w === 0) return;

    const prev = prevRunnersRef.current;
    const newRunners = runners.filter((r) => !prev.find((p) => p.id === r.id));

    for (const newRunner of newRunners) {
      if (!bbox) continue;

      const pts = projectPath(newRunner.points, bbox, size.w, size.h);
      const { hasOverlap, overlapKeys } = detectOverlap(newRunner, prev, bbox);

      if (hasOverlap && overlapKeys.length > 0) {
        const overlapPoints = pts.filter((_, i) => {
          const pt = newRunner.points[i];
          if (!pt) return false;
          const col = Math.floor(((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * 80);
          const row = Math.floor(((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * 80);
          return overlapKeys.includes(`${col}_${row}`);
        });
        particleSysRef.current?.explodePath(overlapPoints, prev, newRunner.color);
      }
    }

    const latestRunner = newRunners.at(-1);

    if (
      latestRunner &&
      kakaoMapRef.current &&
      window.kakao?.maps
    ) {
      fitRunnerBounds(
        kakaoMapRef.current,
        latestRunner
      );
    }

    prevRunnersRef.current = [...runners];
    setTimeout(() => {
      drawAllRoutesRef.current?.();
      rebuildBlocksRef.current?.();
    }, 200);
  }, [runners, bbox, size]);

  useEffect(() => {
    const loop = () => {
      blocksRef.current = blocksRef.current.map((block) => computeBlockRef.current(block));
      blocksRef.current.forEach((block, i) => {
        const node = nodesRef.current[i];
        if (!node) return;
        node.style.transform = `translate(${block.x - block.textWidth / 2}px, ${block.y - block.fontSize / 2}px)`;
        node.style.fontSize = `${block.fontSize}px`;
      });
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    if (overlayDragRef.current.active) {
      const dx = e.clientX - overlayDragRef.current.startX;
      const dy = e.clientY - overlayDragRef.current.startY;
      overlayDragRef.current.dx = dx;
      overlayDragRef.current.dy = dy;
      overlayDragRef.current.moved = Math.hypot(dx, dy) > 2;
      setOverlayTransform({ dx, dy });
    }

    updateMouse(rawX, rawY);
    particleSysRef.current?.addTrail(rawX, rawY, zoomRef.current);
  }, [setOverlayTransform, updateMouse]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;

    overlayDragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
    };
  }, []);

  const finishOverlayDrag = useCallback(() => {
    if (!overlayDragRef.current.active) return;

    const didMove = overlayDragRef.current.moved;
    overlayDragRef.current.active = false;
    overlayDragRef.current.dx = 0;
    overlayDragRef.current.dy = 0;

    if (didMove) {
      skipNextClickRef.current = true;
      requestAnimationFrame(() => syncMapOverlays());
      setTimeout(() => syncMapOverlays(), 80);
      setTimeout(() => syncMapOverlays(), 220);
    } else {
      setOverlayTransform();
    }
  }, [setOverlayTransform, syncMapOverlays]);

  const handleWheelCapture = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 2 : -2;
      runnersStore.setDensity(runnersStore.getDensity() + delta);
      setDensityDisplay(runnersStore.getDensity());
      clearTimeout(densityTimerRef.current);
      densityTimerRef.current = setTimeout(() => setDensityDisplay(null), 1500);
      return;
    }

    const originX = e.clientX - rect.left;
    const originY = e.clientY - rect.top;
    const scale = e.deltaY < 0 ? 2 : 0.5;

    setOverlayTransform({ scale, originX, originY });
    setTimeout(() => syncMapOverlays(), 90);
    setTimeout(() => syncMapOverlays(), 220);
    setTimeout(() => syncMapOverlays(), 420);
  }, [setOverlayTransform, syncMapOverlays]);

  const handleClick = useCallback((e) => {
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    blocksRef.current = applyShockwaveRef.current(blocksRef.current, cx, cy);

    const near = blocksRef.current.find((b) => Math.hypot(b.x - cx, b.y - cy) < 60);
    particleSysRef.current?.explodeAt(cx, cy, near?.text ?? "run", near?.color ?? "#fff", 10);
  }, []);

  const handleDblClick = useCallback(() => {
    const map = kakaoMapRef.current;
    if (map && runners[0]?.points[0] && window.kakao?.maps) {
      const first = runners[0].points[0];
      map.setCenter(new window.kakao.maps.LatLng(first.lat, first.lon));
      map.setLevel(5);
    }
  }, [runners]);

  return (
    <div
      ref={containerRef}
      className="run-map"
      onMouseDownCapture={handleMouseDown}
      onMouseMoveCapture={handleMouseMove}
      onMouseUpCapture={finishOverlayDrag}
      onWheelCapture={handleWheelCapture}
      onMouseLeave={finishOverlayDrag}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
    >
      <div className="map-layer">
        <div ref={mapRef} className="kakao-map-bg" />
        <canvas ref={routeCanvasRef} className="route-canvas" />
        <div ref={textLayerRef} className="text-layer" />
      </div>

      <canvas ref={particleCanvasRef} className="particle-canvas" />

      <div className="runner-ranking">
        <div className="runner-ranking-title">
          TOP RUNNERS
        </div>

        {topRunners.map((runner, index) => (
          <div
            key={runner.id}
            className="runner-ranking-item"
            style={{
              color: runner.color,
            }}
          >
            <span className="runner-rank-number">
              #{index + 1}
            </span>

            <span className="runner-rank-name">
              {runner.name}
            </span>
          </div>
        ))}
      </div>

      {densityDisplay !== null && (
        <div className="density-indicator">
          Text density {densityDisplay}px
          <div className="density-hint">Ctrl + wheel</div>
        </div>
      )}

      {runners.length === 0 && (
        <div className="empty-hint">
          Upload a GPX file.
          <br />
          Running routes will be filled with names.
        </div>
      )}

      {zoom !== 1 && (
        <div className="zoom-indicator">
          {Math.round(zoom * 100)}% - double click to reset
        </div>
      )}
    </div>
  );
}
