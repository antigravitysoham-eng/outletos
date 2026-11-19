import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, openStream, closeStream, setCurrency } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: !!getToken(), user: null, branches: [], group: '' });
  const [branch, setBranchState] = useState(() => { try { return localStorage.getItem('branch') || 'all'; } catch { return 'all'; } });

  const logout = useCallback(() => {
    setToken(null); closeStream();
    setState({ loading: false, user: null, branches: [], group: '' });
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const me = await api('/me');
      setCurrency(me.instance?.currency);
      setState({ loading: false, user: me.user, branches: me.branches, group: me.group, instance: me.instance || {}, modules: me.modules || null, setup: me.setup || null });
      openStream();
    } catch { logout(); }
  }, [logout]);

  useEffect(() => { setUnauthorizedHandler(logout); if (getToken()) loadMe(); }, [loadMe, logout]);

  const login = async (username, password) => {
    const { token } = await api('/auth/login', { method: 'POST', body: { username, password } });
    setToken(token);
    await loadMe();
  };

  const setBranch = (b) => { setBranchState(b); try { localStorage.setItem('branch', b); } catch { /* ignore */ } };
  // Keep the selected branch inside the user's scope
  const effectiveBranch = state.branches.length === 1 ? state.branches[0].id
    : branch === 'all' || state.branches.some((b) => b.id === branch) ? branch : 'all';

  const value = useMemo(() => ({
    ...state, login, logout, branch: effectiveBranch, setBranch,
    can: (perm) => !!state.user?.perms.includes(perm),
    branchName: (id) => state.branches.find((b) => b.id === id)?.name ?? id,
  }), [state, effectiveBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
/** Query-string fragment for the current branch filter */
export const useBranchQuery = () => { const { branch } = useAuth(); return branch && branch !== 'all' ? `branch=${branch}` : ''; };
