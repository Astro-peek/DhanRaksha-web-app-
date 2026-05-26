import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import hi from '../i18n/hi.json';
import en from '../i18n/en.json';

const translations = { hi, en };

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const useLanguageStore = create(
  persist(
    (set, get) => ({
      language: 'hi',
      lang: 'hi', // alias for backward compatibility
      setLanguage: (lang) => set({ language: lang, lang }),
      toggle: () => {
        const next = get().language === 'en' ? 'hi' : 'en';
        set({ language: next, lang: next });
      },

      t: (key, replacements = {}) => {
        const lang = get().language;
        let value = getNestedValue(translations[lang], key);
        
        // Fallback to English if missing
        if (value === undefined || value === null) {
          value = getNestedValue(translations['en'], key);
        }
        
        // Fallback to key itself if not found anywhere
        if (value === undefined || value === null) {
          return key;
        }

        // Handle replacements (like {amount} or {rate})
        if (typeof value === 'string') {
          let replaced = value;
          Object.keys(replacements).forEach((k) => {
            replaced = replaced.replace(new RegExp(`\\{${k}\\}`, 'g'), replacements[k]);
          });
          return replaced;
        }

        return value;
      },
    }),
    {
      name: 'safekosh-language-storage',
      partialize: (state) => ({ language: state.language }),
    }
  )
);
export default useLanguageStore;
