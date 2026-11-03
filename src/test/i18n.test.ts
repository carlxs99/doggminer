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
