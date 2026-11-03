import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Languages, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { detectLang, LANGS, LOCALE, setCurrentLang, translate, type Key, type Lang, type Vars } from '@/lib/i18n';
import { haptic } from '@/lib/dogg';

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
// Reuse one context across hot reloads so provider and consumers never disagree.
const g = globalThis as { __doggLang?: React.Context<Ctx | null> };
const LangContext = g.__doggLang ??= createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  // Server and first client render use Spanish; the saved / Telegram language is applied after hydration.
  const [lang, setLangState] = useState<Lang>('es');
  useEffect(() => { const l = detectLang(); setCurrentLang(l); setLangState(l); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<Ctx>(() => ({ lang, setLang: (l: Lang) => { setCurrentLang(l); try { localStorage.setItem('dogg-lang', l); } catch { /* storage blocked */ } setLangState(l); } }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext) ?? { lang: 'es' as Lang, setLang: () => {} }; }

/** Translator bound to the chosen language; components using it re-render when the language changes. */
export function useT() {
  const { lang } = useLang();
  return useMemo(() => Object.assign((key: Key, vars?: Vars) => translate(lang, key, vars), { lang, locale: LOCALE[lang] }), [lang]);
}

/** Header language switcher: ES / EN / RU. */
export function LangSwitcher() {
  const { lang, setLang } = useLang();
  const t = useT();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="lang-switch" aria-label={t('lang.label')}><Languages /><span>{lang.toUpperCase()}</span></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="lang-menu">{LANGS.map(l => <DropdownMenuItem key={l.id} onSelect={() => { haptic(); setLang(l.id); }}><span className="lang-code">{l.label}</span>{l.name}{lang === l.id && <Check className="ml-auto" />}</DropdownMenuItem>)}</DropdownMenuContent>
  </DropdownMenu>;
}
