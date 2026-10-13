import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { useAuth } from "./auth-context";

type Lang = "en" | "hi";
type LangContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (en: string, hi: string) => string;
  pick: <T>(en: T, hi: T) => T;
};

const LangContext = createContext<LangContextType | null>(null);
const KEY = "sa_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const { user, setLanguage } = useAuth();

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem(KEY, "en");
      if (stored === "en" || stored === "hi") setLangState(stored);
    })();
  }, []);

  useEffect(() => {
    if (user?.language && user.language !== lang) {
      setLangState(user.language);
    }
  }, [user]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(KEY, l);
    if (user) setLanguage(l).catch(() => {});
  }, [user, setLanguage]);

  const toggle = useCallback(() => setLang(lang === "en" ? "hi" : "en"), [lang, setLang]);
  const t = useCallback((en: string, hi: string) => (lang === "hi" ? hi : en), [lang]);
  const pick = useCallback(<T,>(en: T, hi: T) => (lang === "hi" ? hi : en), [lang]);

  return <LangContext.Provider value={{ lang, setLang, toggle, t, pick }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be in LanguageProvider");
  return ctx;
}
