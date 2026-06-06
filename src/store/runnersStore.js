let runners = [];
let fillDensity = 18; // 기본 텍스트 간격 (px)
const listeners = new Set();
const densityListeners = new Set();

function notify() { listeners.forEach((fn) => fn([...runners])); }
function notifyDensity() { densityListeners.forEach((fn) => fn(fillDensity)); }

export const runnersStore = {
  getAll() { return [...runners]; },

  add(runner) {
    if (runners.find((r) => r.id === runner.id)) return;
    runners = [...runners, runner];
    notify();
  },

  remove(id) {
    runners = runners.filter((r) => r.id !== id);
    notify();
  },

  clear() { runners = []; notify(); },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // 밀도 관련
  getDensity() { return fillDensity; },

  setDensity(val) {
    fillDensity = Math.max(6, Math.min(60, val));
    notifyDensity();
  },

  subscribeDensity(fn) {
    densityListeners.add(fn);
    return () => densityListeners.delete(fn);
  },
};