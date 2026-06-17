/**
 * Tractor Ledger — Language Store
 * Default: Gujarati. Toggle to English via dashboard header.
 */

import { create } from 'zustand';
import { GU, EN } from '@/constants/gujarati';

type Language = 'gu' | 'en';

interface LanguageStore {
  language: Language;
  t: typeof GU;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: 'gu',
  t: GU,
  setLanguage: (lang) => set({ language: lang, t: lang === 'gu' ? GU : EN }),
  toggleLanguage: () => {
    const next = get().language === 'gu' ? 'en' : 'gu';
    set({ language: next, t: next === 'gu' ? GU : EN });
  },
}));
