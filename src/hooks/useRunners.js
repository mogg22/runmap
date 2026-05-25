import { useState, useEffect } from "react";
import { runnersStore } from "../store/runnersStore";

export function useRunners() {
  const [runners, setRunners] = useState(runnersStore.getAll());

  useEffect(() => {
    return runnersStore.subscribe(setRunners);
  }, []);

  return runners;
}