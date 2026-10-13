import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Landing from './pages/Landing';
import { Login, Register } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import Explore from './pages/Explore';
import IdeaDetail from './pages/IdeaDetail';
import IdeaForm from './pages/IdeaForm';
import MyIdeas from './pages/MyIdeas';
import Bookmarks from './pages/Bookmarks';
import Contributions from './pages/Contributions';
import Following from './pages/Following';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Security from './pages/Security';
import OAuthCallback from './pages/OAuthCallback';
import Privacy from './pages/Privacy';
import CookieBanner from './components/CookieBanner';
import ForgotPassword from './pages/ForgotPassword';
import OAuthSandbox from './pages/OAuthSandbox';

const Private = ({ children }) => <RequireAuth>{children}</RequireAuth>;

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/oauth/sandbox" element={<OAuthSandbox />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/forgot" element={<ForgotPassword />} />

        <Route element={<Layout />}>
          {/* Public browsing */}
          <Route path="/explore" element={<Explore />} />
          <Route path="/ideas/:id" element={<IdeaDetail />} />
          <Route path="/users/:id" element={<Profile />} />

          {/* Authenticated user routes */}
          <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
          <Route path="/my-ideas" element={<Private><MyIdeas /></Private>} />
          <Route path="/bookmarks" element={<Private><Bookmarks /></Private>} />
          <Route path="/create" element={<Private><IdeaForm /></Private>} />
          <Route path="/ideas/:id/edit" element={<Private><IdeaForm /></Private>} />
          <Route path="/contributions" element={<Private><Contributions /></Private>} />
          <Route path="/following" element={<Private><Following /></Private>} />
          <Route path="/notifications" element={<Private><Notifications /></Private>} />
          <Route path="/profile" element={<Private><Profile /></Private>} />
          <Route path="/security" element={<Private><Security /></Private>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieBanner />
    </>
  );
}
