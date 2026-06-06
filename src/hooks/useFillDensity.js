import { useState, useEffect } from "react";
import { runnersStore } from "../store/runnersStore";

export function useFillDensity() {
  const [density, setDensity] = useState(runnersStore.getDensity());

  useEffect(() => {
    return runnersStore.subscribeDensity(setDensity);
  }, []);

  return density;
}