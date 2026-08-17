import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { UI_COPY, type CopyKey, type Language } from "@/lib/localization";

type LocalizedCopy = Record<CopyKey, string>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  copy: LocalizedCopy;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): Language {
  const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
  if (requestedLanguage === "ar" || requestedLanguage === "en") return requestedLanguage;
  return (localStorage.getItem("portfolio-language") as Language) || "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem("portfolio-language", language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    copy: UI_COPY[language],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
