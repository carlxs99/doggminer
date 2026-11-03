// Tiny i18n: Spanish is the source dictionary; English and Russian must define every key (checked by TypeScript).
import { es } from './i18n/es';
import { en } from './i18n/en';
import { ru } from './i18n/ru';

export type Lang = 'es' | 'en' | 'ru';
export type Key = keyof typeof es;
export type Vars = Record<string, string | number>;
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'es', label: 'ES', name: 'Español' },
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'ru', label: 'RU', name: 'Русский' },
];
export const LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-GB', ru: 'ru-RU' };
const DICTS: Record<Lang, Record<Key, string>> = { es, en, ru };

let current: Lang = 'es';
/** Set by the language provider; lets non-React code (toasts, thrown errors) speak the chosen language. */
export function setCurrentLang(lang: Lang) { current = lang; }
export function currentLang() { return current; }
export const isKey = (k: string): k is Key => k in es;

export function translate(lang: Lang, key: Key, vars?: Vars) {
  const s = DICTS[lang][key] ?? es[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? `{${v}}`)) : s;
}
/** Global translator in the current language (for toasts and errors outside React render). */
export const t = (key: Key, vars?: Vars) => translate(current, key, vars);
/** Translates a stored label if it is a dictionary key; otherwise returns it as written (e.g. a task title). */
export const tLabel = (label: string, lang: Lang = current) => isKey(label) ? translate(lang, label) : label;

/** Best initial language: saved choice, then the Telegram/device language. */
export function detectLang(): Lang {
  try { const saved = localStorage.getItem('dogg-lang'); if (saved === 'es' || saved === 'en' || saved === 'ru') return saved; } catch { /* storage blocked */ }
  const code = ((window.Telegram?.WebApp?.initDataUnsafe?.user as { language_code?: string } | undefined)?.language_code ?? navigator.language ?? 'es').toLowerCase();
  if (code.startsWith('ru') || code.startsWith('uk') || code.startsWith('be') || code.startsWith('kk')) return 'ru';
  if (code.startsWith('es')) return 'es';
  return code.startsWith('en') ? 'en' : 'es';
}

// Server messages are written in Spanish; map the known ones to dictionary keys (capture groups become {n}).
const SERVER: [RegExp, Key][] = [
  [/^Abre de nuevo la mini app/i, 'err.reopen'],
  [/^Abre la app desde Telegram/i, 'err.openTelegram'],
  [/bot todavía no está configurado/i, 'err.botNotConfigured'],
  [/^Ya tienes un turno activo/i, 'err.shiftActive'],
  [/^El turno todavía no ha terminado/i, 'err.shiftNotDone'],
  [/^Necesitas ([\d.,]+) \$DOGG entre tu wallet/i, 'err.needHold'],
  [/^Minero no válido/i, 'err.badMiner'],
  [/^Conecta tu wallet antes de retirar/i, 'err.connectToWithdraw'],
  [/^Verifica tu wallet comprando/i, 'err.verifyToWithdraw'],
  [/^El retiro mínimo es/i, 'err.minWithdraw'],
  [/^Saldo insuficiente: necesitas ([\d.,]+)/i, 'err.insufficient'],
  [/^Ya viste los 10 anuncios/i, 'err.adsCap'],
  [/^Demasiados intentos de anuncio/i, 'err.adsTooMany'],
  [/^Anuncio no encontrado/i, 'err.adNotFound'],
  [/^No tienes recompensas de referidos/i, 'err.noRefRewards'],
  [/^Conecta y vincula tu wallet TON primero/i, 'err.linkWalletFirst'],
  [/^Aún no vemos tu compra: llevas ([\d.,]+)/i, 'err.noPurchase'],
  [/^Esta compra ya verificó otra cuenta/i, 'err.purchaseUsed'],
  [/^No se pudo comprobar tu compra/i, 'err.purchaseCheck'],
  [/^La firma caducó/i, 'err.proofExpired'],
  [/^Firma de otro dominio/i, 'err.proofDomain'],
  [/^No se pudo comprobar la clave de tu wallet/i, 'err.walletKey'],
  [/^La firma de la wallet no es válida/i, 'err.proofInvalid'],
  [/^Esta wallet ya está vinculada a otra cuenta/i, 'err.walletTaken'],
  [/^Falta configurar la verificación de wallets/i, 'err.proofNotConfigured'],
  [/^No se pudo leer tu saldo de \$DOGG/i, 'err.holdRead'],
  [/^Esta tarea ya no está disponible/i, 'err.taskGone'],
  [/^Primero abre la tarea/i, 'err.taskOpenFirst'],
  [/^Ya cobraste esta tarea/i, 'err.taskDone'],
  [/^Espera 10 segundos con el bot abierto/i, 'err.taskWait'],
  [/^Aún no te vemos en el canal/i, 'err.notInChannel'],
  [/^Aún no te vemos en el grupo/i, 'err.notInGroup'],
  [/^Aún no te vemos dentro/i, 'err.notInChat'],
  [/^No se pudo comprobar tu suscripción/i, 'err.memberCheck'],
  [/^Esta tarea no está bien configurada/i, 'err.taskMisconfigured'],
  [/^No autorizado/i, 'err.notAdmin'],
  [/^El enlace debe ser de Telegram/i, 'err.adminLink'],
  [/^Para un enlace privado/i, 'err.adminPrivate'],
  [/^El bot no encuentra ese canal o grupo/i, 'err.adminNotFound'],
  [/^El bot tiene que ser administrador/i, 'err.adminBotNotAdmin'],
  [/^Ese chat es un grupo, no un canal/i, 'err.adminIsGroup'],
  [/^Ese chat es un canal, no un grupo/i, 'err.adminIsChannel'],
  [/^El enlace de un bot debe ser/i, 'err.adminBotLink'],
  [/^El saldo no puede quedar negativo \(tiene ([\d.,]+)\)/i, 'err.adminNegative'],
  [/^Usuario no encontrado/i, 'err.adminNoUser'],
  [/^Este retiro ya está cerrado/i, 'err.adminWdClosed'],
];
export function translateServer(raw: string): string | null {
  for (const [re, key] of SERVER) { const m = re.exec(raw); if (m) return t(key, { n: m[1] ?? '' }); }
  return null;
}
