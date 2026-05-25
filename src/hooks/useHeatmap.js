import { useMemo } from "react";
import { computeBbox } from "../utils/projection";
import { buildHeatmap } from "../utils/heatmap";

export function useHeatmap(runners, width, height) {
  return useMemo(() => {
    if (runners.length === 0 || width === 0 || height === 0) {
      return { bbox: null, cells: [], maxCount: 0 };
    }

    const bbox = computeBbox(runners);
    const { cells, maxCount } = buildHeatmap(runners, bbox, width, height);

    return { bbox, cells, maxCount };
  }, [runners, width, height]);
}