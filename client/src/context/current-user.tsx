import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

const STORAGE_KEY = "splitwise-lite:current-user-id";

type CurrentUserContextValue = {
  currentUserId: string | null;
  setCurrentUserId: (userId: string) => void;
  logout: () => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const setCurrentUserId = (userId: string) => {
    localStorage.setItem(STORAGE_KEY, userId);
    setCurrentUserIdState(userId);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUserIdState(null);
  };

  useEffect(() => {
    if (currentUserId) localStorage.setItem(STORAGE_KEY, currentUserId);
  }, [currentUserId]);

  return (
    <CurrentUserContext.Provider value={{ currentUserId, setCurrentUserId, logout }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}

/** For screens behind RequireAuth, where there's always a user. Throws rather than querying with an empty id. */
export function useCurrentUserId(): string {
  const { currentUserId } = useCurrentUser();
  if (!currentUserId) throw new Error("useCurrentUserId must be used behind RequireAuth");
  return currentUserId;
}

/** The logged-in user's record, plus the full user list it came from. */
export function useCurrentUserRecord() {
  const trpc = useTRPC();
  const { currentUserId } = useCurrentUser();
  const users = useQuery(trpc.users.list.queryOptions());
  return { ...users, users: users.data, user: users.data?.find((u) => u.id === currentUserId) };
}
