import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API, TUserRole } from "../api/api";
import { AuthContext, TAuthContextValue, TAuthState } from "./use-auth";

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TAuthState>({ me: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const me = await API.me();
      setState({ me, loading: false });
    } catch {
      setState({ me: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await API.logout();
    } finally {
      setState({ me: null, loading: false });
    }
  }, []);

  const roleForProduction = useCallback(
    (productionId: number) =>
      state.me?.memberships.find((m) => m.productionId === productionId)
        ?.role ?? null,
    [state.me]
  );

  const isSuperAdmin = !!state.me?.user.isSuperAdmin;

  const hasProductionRole = useCallback(
    (productionId: number, roles: TUserRole[]): boolean => {
      if (isSuperAdmin) return true;
      const role = roleForProduction(productionId);
      return !!role && roles.includes(role);
    },
    [isSuperAdmin, roleForProduction]
  );

  const value = useMemo<TAuthContextValue>(
    () => ({
      ...state,
      isSuperAdmin,
      refresh,
      logout,
      roleForProduction,
      hasProductionRole,
    }),
    [state, isSuperAdmin, refresh, logout, roleForProduction, hasProductionRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
