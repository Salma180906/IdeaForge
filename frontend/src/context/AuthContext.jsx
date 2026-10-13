import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const IDLE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000; // keep session active for up to 7 days of inactivity

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('ideaforge_token');
    setUser(null);
  }, []);

  // On page load, restore the login if a token is saved.
  useEffect(() => {
    if (!localStorage.getItem('ideaforge_token')) { setLoading(false); return; }
    api.get('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('ideaforge_token'))
      .finally(() => setLoading(false));
  }, []);

  // The server said the token is no longer valid (expired or tampered with).
  useEffect(() => {
    const onExpired = () => {
      if (!localStorage.getItem('ideaforge_token')) return;
      logout();
      toast.error('Your session has ended. Log in again to continue.');
    };
    window.addEventListener('ideaforge:session-expired', onExpired);
    return () => window.removeEventListener('ideaforge:session-expired', onExpired);
  }, [logout, toast]);

  // Idle timeout: protects a laptop that was left open.
  useEffect(() => {
    if (!user) return undefined;
    let lastActive = Date.now();
    const touch = () => { lastActive = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActive > IDLE_LIMIT_MS) {
        logout();
        toast.info('You were logged out after 30 minutes of inactivity.');
      }
    }, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [user, logout, toast]);

  const saveSession = (data) => {
    localStorage.setItem('ideaforge_token', data.token);
    setUser(data.user);
  };
  // Each of these either signs you in, or returns what the next step is (a code to type).
  const finish = (data) => {
    if (data.token) { saveSession(data); return { done: true }; }
    return data;
  };
  const login = async (email, password) => {
    try {
      return finish(await api.post('/auth/login', { email, password }));
    } catch (e) {
      if (e.data?.needsVerification) return { needsVerification: true, email: e.data.email };
      throw e;
    }
  };
  const register = async (name, email, password) => finish(await api.post('/auth/register', { name, email, password }));
  const verifyEmail = async (email, code) => finish(await api.post('/auth/verify-email', { email, code }));
  const loginWithCode = async (ticket, code) => finish(await api.post('/auth/login-otp', { ticket, code }));
  const loginWithTicket = async (ticket) => finish(await api.post('/auth/oauth/exchange', { ticket }));
  // After a password change the server sends a fresh token so this device stays signed in.
  const replaceToken = (token) => localStorage.setItem('ideaforge_token', token);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, verifyEmail, loginWithCode, loginWithTicket, replaceToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
