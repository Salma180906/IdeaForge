// Tracks requests that are taking a long time, so the app can say
// "the server is waking up" instead of looking frozen.
let slowCount = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(slowCount > 0));

export function slowStart() {
  const state = { flagged: false };
  state.timer = setTimeout(() => { state.flagged = true; slowCount += 1; emit(); }, 4000);
  return state;
}
export function slowEnd(state) {
  clearTimeout(state.timer);
  if (state.flagged) { slowCount = Math.max(0, slowCount - 1); emit(); }
}
export function subscribeSlow(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Counts requests that are in flight, for the thin loading bar at the top of the page.
let busyCount = 0;
const busyListeners = new Set();
const emitBusy = () => busyListeners.forEach((fn) => fn(busyCount > 0));
export function busyStart() { busyCount += 1; emitBusy(); }
export function busyEnd() { busyCount = Math.max(0, busyCount - 1); emitBusy(); }
export function subscribeBusy(fn) { busyListeners.add(fn); return () => busyListeners.delete(fn); }
