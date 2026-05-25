const GRID_SIZE = 60;

export function buildHeatmap(runners, bbox, width, height) {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => new Set())
  );

  for (const runner of runners) {
    for (const pt of runner.points) {
      const col = Math.floor(
        ((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * GRID_SIZE
      );
      const row = Math.floor(
        ((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * GRID_SIZE
      );
      const c = Math.max(0, Math.min(GRID_SIZE - 1, col));
      const r = Math.max(0, Math.min(GRID_SIZE - 1, row));
      grid[r][c].add(runner.id);
    }
  }

  const counts = grid.map((row) => row.map((cell) => cell.size));
  let maxCount = 1;
  for (const row of counts) for (const c of row) if (c > maxCount) maxCount = c;

  const cellW = width / GRID_SIZE;
  const cellH = height / GRID_SIZE;

  const cells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const count = counts[r][c];
      if (count === 0) continue;
      cells.push({
        row: r, col: c, count,
        density: count / maxCount,
        x: c * cellW + cellW / 2,
        y: r * cellH + cellH / 2,
        cellW, cellH,
      });
    }
  }

  return { cells, maxCount, gridSize: GRID_SIZE };
}

export function densityToBlockParams(density) {
  // 블록 수 대폭 줄임: 최대 2개
  const blockCount = density > 0.6 ? 2 : 1;

  return {
    blockCount,
    fontSize: Math.round(7 + density * 6),   // 7 ~ 13px
    opacity: 0.25 + density * 0.75,            // 0.25 ~ 1.0
    repulsionStrength: 40 + density * 100,     // 40 ~ 140px
    vibration: density * 2,                    // 0 ~ 2px
  };
}