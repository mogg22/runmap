import { useRef } from "react";

function computeBlockFn(block, mouse, zoom) {
  const now = performance.now();
  const dx = block.x - mouse.x;
  const dy = block.y - mouse.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const baseStrength = block.repulsionStrength ?? 40;
  const scaledStrength = baseStrength / zoom;

  // ← 반발 반경 축소: +80 → +30
  const radius = scaledStrength + 30 / zoom;

  let repelX = 0, repelY = 0;
  if (dist < radius && dist > 0) {
    const force = (1 - dist / radius) ** 2;
    // ← force 강도 0.5배로 축소
    repelX = (dx / dist) * force * scaledStrength * 0.5;
    repelY = (dy / dist) * force * scaledStrength * 0.5;
  }

  const targetX = block.baseX + repelX;
  const targetY = block.baseY + repelY;

  const spring = 0.1;
  const damping = 0.78;
  const velX = (block.velX ?? 0) * damping + (targetX - block.x) * spring;
  const velY = (block.velY ?? 0) * damping + (targetY - block.y) * spring;
  const vib = Math.sin(now * 0.005 + (block.vibration ?? 0)) * (block.vibration ?? 0);

  return {
    ...block,
    x: block.x + velX + vib,
    y: block.y + velY,
    velX,
    velY,
  };
}

function applyShockwaveFn(blocks, cx, cy, zoom, radius = 200) {
  // ← 충격파 범위도 줄임
  const scaledRadius = (radius * 0.6) / zoom;

  return blocks.map((b) => {
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < scaledRadius && dist > 0) {
      const force = (1 - dist / scaledRadius) * 8;  // 14 → 8
      return {
        ...b,
        velX: (b.velX ?? 0) + (dx / dist) * force,
        velY: (b.velY ?? 0) + (dy / dist) * force,
      };
    }
    return b;
  });
}

export function usePhysics() {
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const zoomRef  = useRef(1);

  function updateMouse(x, y) { mouseRef.current = { x, y }; }
  function updateZoom(z)     { zoomRef.current = z; }

  function computeBlock(block) {
    return computeBlockFn(block, mouseRef.current, zoomRef.current);
  }

  function applyShockwave(blocks, cx, cy) {
    return applyShockwaveFn(blocks, cx, cy, zoomRef.current);
  }

  return { mouseRef, updateMouse, updateZoom, computeBlock, applyShockwave };
}