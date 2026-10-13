import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';
import AuthenticOAuthModal from '../components/AuthenticOAuthModal';

export default function OAuthSandbox() {
  const [params] = useSearchParams();
  const provider = params.get('provider') || 'google';
  const navigate = useNavigate();
  useDocumentTitle(`Sign in – ${provider === 'github' ? 'GitHub' : 'Google Accounts'}`);

  return (
    <AuthenticOAuthModal
      provider={provider}
      onClose={() => navigate('/login')}
    />
  );
}
