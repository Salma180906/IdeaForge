// One place for every call to the backend.
// Pages never use fetch directly, they call api.get / api.post / ...
import { slowStart, slowEnd, busyStart, busyEnd } from './status';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TIMEOUT_MS = 75000; // a sleeping free server can take about a minute to wake up

async function request(method, path, body) {
  const token = localStorage.getItem('ideaforge_token');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const slow = slowStart();
  busyStart();

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'The server took too long to answer. It may still be waking up, so try again in a moment.'
      : 'Cannot reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timeout);
    slowEnd(slow);
    busyEnd();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 while a token is stored means the session ended. (Wrong passwords at login are not that.)
    const isAuthForm = path.startsWith('/auth/login') || path.startsWith('/auth/register');
    if (res.status === 401 && token && !isAuthForm) {
      window.dispatchEvent(new CustomEvent('ideaforge:session-expired'));
    }
    const err = new Error(data.message || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b || {}),
  patch: (p, b) => request('PATCH', p, b || {}),
  delete: (p, b) => request('DELETE', p, b || {}),
};
