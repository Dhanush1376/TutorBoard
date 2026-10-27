import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../hooks/useAuth';
import { oauthErrorMessage } from './authMessages';

/**
 * Where "connect Google/GitHub" comes back to (/settings?linked=… or ?error=…):
 * refresh the account, open Settings → Account in the workspace and say what happened.
 */
export default function SettingsLanding() {
  const location = useLocation();
  const { refreshUser, isAuthResolved, user } = useAuth();

  useEffect(() => {
    if (!isAuthResolved) return;
    const params = new URLSearchParams(location.search);
    const { showToast, setOverlay, setSettingsActiveSection } = useTutorStore.getState();
    const linked = params.get('linked');
    const error = params.get('error');
    if (linked) {
      refreshUser?.().catch(() => {});
      showToast({ message: `${linked === 'google' ? 'Google' : 'GitHub'} is now connected to your account.`, type: 'success' });
    } else if (error) {
      showToast({ message: oauthErrorMessage(error, params.get('provider')), type: 'error' });
    }
    setSettingsActiveSection?.('account');
    setOverlay?.('settings');
  }, [isAuthResolved, location.search, refreshUser]);

  if (!isAuthResolved) return null;
  return <Navigate to={user && !user.isGuest ? '/session' : '/login'} replace />;
}
