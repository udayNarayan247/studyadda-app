import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, saveToken, readToken, clearToken, setApiToken } from "./api";

WebBrowser.maybeCompleteAuthSession();

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: "student" | "admin";
  language: "en" | "hi";
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setLanguage: (lang: "en" | "hi") => Promise<void>;
  isGuest: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const processedSessionIds = useRef<Set<string>>(new Set());
  const capturedUrl = useRef<string | null>(null);

  const extractSessionId = (url: string): string | null => {
    const m = url.match(/[?#&]session_id=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const exchangeSessionId = useCallback(async (sessionId: string) => {
    if (processedSessionIds.current.has(sessionId)) return;
    processedSessionIds.current.add(sessionId);
    try {
      const res = await api<{ session_token: string; user: AuthUser }>("/auth/session", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
      await saveToken(res.session_token);
      setApiToken(res.session_token);
      setUser(res.user);
      setIsGuest(false);
    } catch (e) {
      console.log("session exchange failed", e);
    }
  }, []);

  // Check existing token on mount
  useEffect(() => {
    (async () => {
      try {
        // web: check URL for session_id first
        if (Platform.OS === "web") {
          const href = window.location.href;
          const sid = extractSessionId(href);
          if (sid) {
            await exchangeSessionId(sid);
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch {}
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const sid = extractSessionId(initial);
            if (sid) {
              await exchangeSessionId(sid);
              setLoading(false);
              return;
            }
          }
        }

        const stored = await readToken();
        if (stored) {
          setApiToken(stored);
          try {
            const u = await api<AuthUser>("/auth/me");
            setUser(u);
          } catch {
            setApiToken(null);
            await clearToken();
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [exchangeSessionId]);

  // Mobile deep-link listener
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      capturedUrl.current = url;
      const sid = extractSessionId(url);
      if (sid) exchangeSessionId(sid);
    });
    return () => sub.remove();
  }, [exchangeSessionId]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = null;
    if ((result as any).type === "success" && (result as any).url) url = (result as any).url;
    if (!url && capturedUrl.current) url = capturedUrl.current;
    if (!url) {
      const init = await Linking.getInitialURL();
      if (init) url = init;
    }
    if (url) {
      const sid = extractSessionId(url);
      if (sid) await exchangeSessionId(sid);
    }
  }, [exchangeSessionId]);

  const signInAsGuest = useCallback(() => {
    setIsGuest(true);
    setUser(null);
  }, []);

  const signOut = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    setApiToken(null);
    await clearToken();
    setUser(null);
    setIsGuest(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api<AuthUser>("/auth/me");
      setUser(u);
    } catch {}
  }, []);

  const setLanguage = useCallback(async (lang: "en" | "hi") => {
    if (user) {
      await api("/auth/language", { method: "POST", body: JSON.stringify({ language: lang }) });
      setUser({ ...user, language: lang });
    } else {
      // guest: still track locally
      setUser(null);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, signOut, refreshUser, setLanguage, isGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used in AuthProvider");
  return ctx;
}
