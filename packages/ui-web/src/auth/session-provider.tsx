"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatar: { url: string } | null;
  roles: string[];
  status: string;
}
interface SessionValue {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
}
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
