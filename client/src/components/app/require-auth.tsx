import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/context/current-user";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUserId } = useCurrentUser();
  if (!currentUserId) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
