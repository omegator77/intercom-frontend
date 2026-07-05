import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../auth/use-auth";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { me, loading } = useAuth();

  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;

  return children;
};
