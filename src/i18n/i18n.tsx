import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MESSAGES, type Lang, type MessageKey } from "./messages";

const STORAGE_KEY = "feedla.language";
const DEFAULT_LANG: Lang = "en";

export type TranslateFn = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nValue | null>(null);

const isLang = (value: string | null): value is Lang =>
  value === "en" || value === "zh-Hant";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isLang(stored)) setLangState(stored);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = MESSAGES[lang];
    const t: TranslateFn = (key, params) => {
      let text: string = dictionary[key];
      if (params) {
        for (const [name, replacement] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return text;
    };
    return { lang, setLang, t };
  }, [lang, setLang]);

  // Wait for the stored language so the first paint is not in the wrong language.
  if (!ready) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
}
