const GRID_SIZE = 40; // 60 → 40 (셀 크기 커져서 블록 간격 자연스럽게 벌어짐)

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
        runnerIds: [...grid[r][c]],
        x: c * cellW + cellW / 2,
        y: r * cellH + cellH / 2,
        cellW, cellH,
      });
    }
  }

  return { cells, maxCount, gridSize: GRID_SIZE };
}

export function computeRunnerDominance(runners, bbox) {
  if (!bbox || runners.length === 0) return {};

  const cellCount = {};
  const totalCells = new Set();

  for (const runner of runners) {
    const seen = new Set();
    for (const pt of runner.points) {
      const col = Math.floor(
        ((pt.lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * GRID_SIZE
      );
      const row = Math.floor(
        ((bbox.maxLat - pt.lat) / (bbox.maxLat - bbox.minLat)) * GRID_SIZE
      );
      const key = `${Math.max(0, Math.min(GRID_SIZE-1, col))}_${Math.max(0, Math.min(GRID_SIZE-1, row))}`;
      if (!seen.has(key)) {
        seen.add(key);
        totalCells.add(key);
        cellCount[runner.id] = (cellCount[runner.id] ?? 0) + 1;
      }
    }
  }

  const total = totalCells.size || 1;
  const dominance = {};
  for (const [id, count] of Object.entries(cellCount)) {
    dominance[id] = count / total;
  }
  return dominance;
}

export function densityToBlockParams(density, runnerDominance = 0) {
  const baseSize = 8 + density * 4;
  const dominanceScale = 1 + runnerDominance * 2.5;
  const fontSize = Math.min(Math.round(baseSize * dominanceScale), 40);

  const blockCount = 1;
  const scatterScale = 0.3 + (fontSize / 40) * 0.5;

  return {
    blockCount,
    fontSize,
    opacity: 0.3 + density * 0.7,
    repulsionStrength: 20 + density * 40,  // 50+density*80 → 20+density*40
    vibration: density * 1.5,
    scatterScale,
  };
}