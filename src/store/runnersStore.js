/**
 * 전역 러너 상태 — 간단한 pub/sub 스토어
 * React 외부에서도 접근 가능하도록 별도 모듈로 분리
 */

let runners = [];
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn([...runners]));
}

export const runnersStore = {
  getAll() {
    return [...runners];
  },

  add(runner) {
    // 같은 id 중복 방지
    if (runners.find((r) => r.id === runner.id)) return;
    runners = [...runners, runner];
    notify();
  },

  remove(id) {
    runners = runners.filter((r) => r.id !== id);
    notify();
  },

  clear() {
    runners = [];
    notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn); // unsubscribe
  },
};