/**
 * 경로 드로잉 애니메이션
 * Canvas stroke-dashoffset 방식으로 경로를 실시간으로 그림
 */
export function animatePath(ctx, points, color, duration = 1800, onComplete) {
  if (points.length < 2) { onComplete?.(); return; }

  // 전체 경로 길이 계산
  let totalLength = 0;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const len = Math.sqrt(dx*dx + dy*dy);
    totalLength += len;
    segments.push({ from: points[i-1], to: points[i], len });
  }

  const start = performance.now();

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeInOut
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - (-2 * progress + 2) ** 2 / 2;

    const drawLength = totalLength * eased;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();

    let drawn = 0;
    for (const seg of segments) {
      if (drawn >= drawLength) break;
      const remaining = drawLength - drawn;
      const ratio = Math.min(remaining / seg.len, 1);

      ctx.moveTo(seg.from.x, seg.from.y);
      ctx.lineTo(
        seg.from.x + (seg.to.x - seg.from.x) * ratio,
        seg.from.y + (seg.to.y - seg.from.y) * ratio,
      );
      drawn += seg.len;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  };

  requestAnimationFrame(tick);
}