import { createContext, useContext, useMemo, ReactNode } from 'react';
import es from './es.json';

type Messages = typeof es;

function resolve(messages: Messages, path: string): string | undefined {
  let current: unknown = messages;
  for (const part of path.split('.')) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export interface I18n {
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n>({ t: (key) => key });

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo<I18n>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      let text = resolve(es, key) ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    };
    return { t };
  }, []);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
