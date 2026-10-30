import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enAccess from './locales/en/access.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enNavigation from './locales/en/navigation.json'
import enValidation from './locales/en/validation.json'

export const supportedLanguages = ['en'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      auth: enAuth,
      validation: enValidation,
      common: enCommon,
      navigation: enNavigation,
      access: enAccess,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...supportedLanguages],
  ns: ['common', 'auth', 'validation', 'navigation', 'access'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

function applyDocumentLanguage(language: string) {
  const base = language.split('-')[0]
  document.documentElement.lang = supportedLanguages.includes(base as SupportedLanguage) ? base : 'en'
}

applyDocumentLanguage(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', applyDocumentLanguage)

export default i18n
