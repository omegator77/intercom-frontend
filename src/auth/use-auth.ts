import { createContext, useContext } from "react";
import { TMeResponse, TUserRole } from "../api/api";

export type TAuthState = {
  me: TMeResponse | null;
  loading: boolean;
};

export type TAuthContextValue = TAuthState & {
  isSuperAdmin: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  roleForProduction: (productionId: number) => TUserRole | null;
  hasProductionRole: (productionId: number, roles: TUserRole[]) => boolean;
};

export const AuthContext = createContext<TAuthContextValue>(
  {} as TAuthContextValue
);

export const useAuth = (): TAuthContextValue => useContext(AuthContext);
