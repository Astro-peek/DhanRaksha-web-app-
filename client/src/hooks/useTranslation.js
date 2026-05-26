import { useLanguageStore } from '../store/languageStore';

export default function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useLanguageStore((state) => state.t);

  return { t, language, setLanguage };
}
export { useTranslation };
