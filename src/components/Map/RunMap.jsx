import { useEffect, useRef, useCallback, useState } from "react";
import { useRunners } from "../../hooks/useRunners";
import { useHeatmap } from "../../hooks/useHeatmap";
import { usePhysics } from "../../hooks/usePhysics";
import { densityToBlockParams } from "../../utils/heatmap";
import { projectPath } from "../../utils/projection";
import { measureName, warmupNames } from "../../utils/pretextLayout";
import { ParticleSystem } from "../../utils/particleSystem";
import { animatePath } from "../../utils/pathAnimator";
import { detectOverlap } from "../../utils/overlapDetector";
import { computeBbox } from "../../utils/projection";
import "./RunMap.css";

const GRID_SIZE = 60;

function createCellBlocks(cell, runners, bbox) {
  const params = densityToBlockParams(cell.density);
  const cellRunners = runners.filter((r) =>
    r.points.some((pt) => {
      const col = Math.floor(
        ((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * GRID_SIZE
      );
      const row = Math.floor(
        ((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * GRID_SIZE
      );
      return col === cell.col && row === cell.row;
    })
  );

  return Array.from({ length: params.blockCount }, (_, i) => {
    const runner = cellRunners[i % Math.max(1, cellRunners.length)];
    const name = runner?.name ?? "runner";
    const { width, height } = measureName(name, params.fontSize);
    const angle = (i / Math.max(1, params.blockCount)) * Math.PI * 2;
    const r = cell.cellW * 0.25;
    const bx = cell.x + Math.cos(angle) * r;
    const by = cell.y + Math.sin(angle) * r;

    return {
      id: `${cell.row}-${cell.col}-${i}`,
      text: name,
      color: runner?.color ?? "#fff",
      baseX: bx, baseY: by,
      x: bx, y: by,
      velX: 0, velY: 0,
      fontSize: params.fontSize,
      opacity: 0,            // 0에서 시작 — 모프 등장
      targetOpacity: params.opacity,
      width, height,
      repulsionStrength: params.repulsionStrength,
      vibration: params.vibration,
      glowing: false,
    };
  });
}

export function RunMap() {
  const containerRef    = useRef(null);
  const routeCanvasRef  = useRef(null);   // 기존 경로 선 (누적)
  const animCanvasRef   = useRef(null);   // 드로잉 애니메이션 전용
  const particleCanvasRef = useRef(null); // 파티클 + 트레일
  const textLayerRef    = useRef(null);
  const nodesRef        = useRef([]);
  const blocksRef       = useRef([]);
  const rafRef          = useRef(null);
  const particleSysRef  = useRef(null);
  const prevRunnersRef  = useRef([]);     // 겹침 감지용 이전 러너 목록

  const zoomRef         = useRef(1);
  const panRef          = useRef({ x: 0, y: 0 });
  const isPanningRef    = useRef(false);
  const lastPanRef      = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  const runners = useRunners();
  const { bbox, cells } = useHeatmap(runners, size.w, size.h);
  const { updateMouse, updateZoom, computeBlock, applyShockwave } = usePhysics();

  const computeBlockRef   = useRef(computeBlock);
  const applyShockwaveRef = useRef(applyShockwave);
  useEffect(() => { computeBlockRef.current   = computeBlock;   }, [computeBlock]);
  useEffect(() => { applyShockwaveRef.current = applyShockwave; }, [applyShockwave]);

  // ── 1. 컨테이너 크기 감지 ────────────────────────────
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

  // ── 2. 파티클 시스템 초기화 ──────────────────────────
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas || size.w === 0) return;
    canvas.width  = size.w;
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

  // ── 3. 스크롤 줌 ─────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor   = e.deltaY > 0 ? 0.9 : 1.1;
      const rect     = el.getBoundingClientRect();
      const mx       = e.clientX - rect.left;
      const my       = e.clientY - rect.top;
      const prevZoom = zoomRef.current;
      const prevPan  = panRef.current;
      const nextZoom = Math.max(0.4, Math.min(10, prevZoom * factor));
      const nextPanX = mx - (mx - prevPan.x) * (nextZoom / prevZoom);
      const nextPanY = my - (my - prevPan.y) * (nextZoom / prevZoom);
      zoomRef.current = nextZoom;
      panRef.current  = { x: nextPanX, y: nextPanY };
      updateZoom(nextZoom);
      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [updateZoom]);

  // ── 4. Pretext warmup ────────────────────────────────
  useEffect(() => {
    if (runners.length > 0) warmupNames(runners.map((r) => r.name));
  }, [runners]);

  // ── 5. 새 러너 감지 → 드로잉 애니메이션 + 파티클 ────
  useEffect(() => {
    if (!bbox || size.w === 0) return;

    const prev = prevRunnersRef.current;
    const newRunners = runners.filter(
      (r) => !prev.find((p) => p.id === r.id)
    );

    for (const newRunner of newRunners) {
      const pts = projectPath(newRunner.points, bbox, size.w, size.h);
      const animCtx = animCanvasRef.current?.getContext("2d");

      // 겹침 감지
      const { hasOverlap, overlapKeys } = detectOverlap(
        newRunner, prev, bbox
      );

      if (hasOverlap && overlapKeys.length > 0) {
        // 겹치는 구간에서 파티클 폭발
        const overlapPoints = pts.filter((_, i) => {
          const pt = newRunner.points[i];
          if (!pt) return false;
          const col = Math.floor(
            ((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * 80
          );
          const row = Math.floor(
            ((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * 80
          );
          return overlapKeys.includes(`${col}_${row}`);
        });

        particleSysRef.current?.explodePath(
          overlapPoints, prev, newRunner.color
        );
      }

      // 경로 드로잉 애니메이션
      if (animCtx) {
        animCanvasRef.current.width  = size.w;
        animCanvasRef.current.height = size.h;
        animatePath(animCtx, pts, newRunner.color, 1800, () => {
          // 애니메이션 완료 → 누적 캔버스에 추가
          drawAllRoutes();
        });
      }
    }

    prevRunnersRef.current = [...runners];
  }, [runners, bbox, size]);

  // ── 6. 누적 경로 다시 그리기 ─────────────────────────
  const drawAllRoutes = useCallback(() => {
    const canvas = routeCanvasRef.current;
    if (!canvas || !bbox || size.w === 0) return;
    canvas.width  = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size.w, size.h);

    for (const runner of runners) {
      const pts = projectPath(runner.points, bbox, size.w, size.h);
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle  = runner.color;
      ctx.lineWidth    = 1;
      ctx.globalAlpha  = 0.18;
      ctx.stroke();
    }
  }, [runners, bbox, size]);

  useEffect(() => { drawAllRoutes(); }, [drawAllRoutes]);

  // ── 7. 텍스트 블록 초기화 ────────────────────────────
  useEffect(() => {
    const layer = textLayerRef.current;
    if (!bbox || cells.length === 0 || size.w === 0 || !layer) return;

    nodesRef.current.forEach((n) => n.remove());
    nodesRef.current = [];

    const allBlocks = cells.flatMap((cell) =>
      createCellBlocks(cell, runners, bbox)
    );
    blocksRef.current = allBlocks;

    allBlocks.forEach((block) => {
      const span = document.createElement("span");
      span.className        = "name-block";
      span.textContent      = block.text;
      span.style.fontSize   = `${block.fontSize}px`;
      span.style.color      = block.color;
      span.style.opacity    = "0";
      span.style.transition = "opacity 0.6s ease, text-shadow 0.3s ease";
      span.style.transform  = `translate(${block.x}px, ${block.y}px)`;
      layer.appendChild(span);
      nodesRef.current.push(span);

      // 모프 등장 — 살짝 딜레이 후 fade in
      const delay = Math.random() * 600;
      setTimeout(() => {
        span.style.opacity = block.targetOpacity;
      }, delay);
    });
  }, [cells, runners, bbox, size]);

  // ── 8. 물리 루프 + 글로우 ────────────────────────────
  useEffect(() => {
    const loop = () => {
      blocksRef.current = blocksRef.current.map(
        (block) => computeBlockRef.current(block)
      );

      const currentZoom = zoomRef.current;
      const mouse = { x: -9999, y: -9999 };

      blocksRef.current.forEach((block, i) => {
        const node = nodesRef.current[i];
        if (!node) return;

        node.style.transform = `translate(${block.x}px, ${block.y}px)`;
        const dynamicSize = block.fontSize / currentZoom;
        node.style.fontSize = `${dynamicSize}px`;

        // 글로우 — 밀도 높은 블록에 적용
        if (block.vibration > 1) {
          const intensity = block.vibration * 2;
          node.style.textShadow =
            `0 0 ${intensity}px ${block.color},
             0 0 ${intensity * 2}px ${block.color}88`;
        }
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── 이벤트 핸들러 ────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX    = e.clientX - rect.left;
    const rawY    = e.clientY - rect.top;
    const canvasX = (rawX - panRef.current.x) / zoomRef.current;
    const canvasY = (rawY - panRef.current.y) / zoomRef.current;
    updateMouse(canvasX, canvasY);

    // 커서 트레일 — 파티클 캔버스에 직접 추가
    particleSysRef.current?.addTrail(rawX, rawY, zoomRef.current);

    if (isPanningRef.current) {
      const dx = rawX - lastPanRef.current.x;
      const dy = rawY - lastPanRef.current.y;
      lastPanRef.current = { x: rawX, y: rawY };
      const next = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      panRef.current = next;
      setPan(next);
    }
  }, [updateMouse]);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      isPanningRef.current = true;
      lastPanRef.current   = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleClick = useCallback((e) => {
    if (isPanningRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const cy = (e.clientY - rect.top  - panRef.current.y) / zoomRef.current;

    // 물리 충격파
    blocksRef.current = applyShockwaveRef.current(blocksRef.current, cx, cy);

    // 클릭 지점에도 파티클 폭발 (현재 줌 좌표 그대로)
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const nearBlock = blocksRef.current.find((b) => {
      const bx = b.x * zoomRef.current + panRef.current.x;
      const by = b.y * zoomRef.current + panRef.current.y;
      return Math.hypot(bx - screenX, by - screenY) < 60;
    });
    particleSysRef.current?.explodeAt(
      screenX, screenY,
      nearBlock?.text ?? "run",
      nearBlock?.color ?? "#fff",
      10
    );
  }, []);

  const handleDblClick = useCallback(() => {
    zoomRef.current = 1;
    panRef.current  = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="run-map"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
    >
      {/* 줌/패닝 레이어 */}
      <div
        className="map-layer"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 누적 경로 선 */}
        <canvas ref={routeCanvasRef} className="route-canvas" />
        {/* 드로잉 애니메이션 전용 */}
        <canvas ref={animCanvasRef}  className="route-canvas" />
        {/* 텍스트 블록 */}
        <div ref={textLayerRef} className="text-layer" />
      </div>

      {/* 파티클 + 트레일 — 줌/패닝 밖 (화면 좌표계) */}
      <canvas ref={particleCanvasRef} className="particle-canvas" />

      {runners.length === 0 && (
        <div className="empty-hint">
          GPX 파일을 업로드하면<br />달린 경로가 이름으로 새겨집니다
        </div>
      )}
      {zoom !== 1 && (
        <div className="zoom-indicator">
          {Math.round(zoom * 100)}% · 더블클릭으로 리셋
        </div>
      )}
    </div>
  );
}