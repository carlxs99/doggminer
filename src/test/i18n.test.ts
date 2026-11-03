import { afterEach, describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
import { ru } from '@/lib/i18n/ru';
import { setCurrentLang, translate, translateServer } from '@/lib/i18n';

afterEach(() => setCurrentLang('es'));

describe('i18n', () => {
  it('English and Russian translate every Spanish text', () => {
    for (const dict of [en, ru] as Record<string, string>[]) {
      const missing = Object.keys(es).filter(k => !dict[k]?.trim());
      expect(missing).toEqual([]);
    }
  });

  it('fills in numbers in each language', () => {
    expect(translate('es', 'mine.level', { n: 7 })).toContain('7');
    expect(translate('ru', 'mine.level', { n: 7 })).toContain('7');
    expect(translate('ru', 'mine.level', { n: 7 })).not.toBe(translate('es', 'mine.level', { n: 7 }));
  });

  it('shows server errors in the chosen language', () => {
    setCurrentLang('en');
    expect(translateServer('Saldo insuficiente: necesitas 1.070 $DOGG')).toBe(translate('en', 'err.insufficient', { n: '1.070' }));
    expect(translateServer('mensaje desconocido')).toBeNull();
  });
});

describe('initial language', () => {
  it('uses Spanish and Russian when the player speaks them', async () => {
    const { langFromCode } = await import('@/lib/i18n');
    expect(langFromCode('es')).toBe('es');
    expect(langFromCode('es-MX')).toBe('es');
    expect(langFromCode('ru')).toBe('ru');
    expect(langFromCode('uk')).toBe('ru');
  });
  it('falls back to English when the language is unknown or missing', async () => {
    const { langFromCode } = await import('@/lib/i18n');
    expect(langFromCode('de')).toBe('en');
    expect(langFromCode('pt-BR')).toBe('en');
    expect(langFromCode('')).toBe('en');
    expect(langFromCode(undefined)).toBe('en');
    expect(langFromCode('en-US')).toBe('en');
  });
});
