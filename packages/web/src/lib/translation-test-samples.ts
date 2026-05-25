import type { TranslationLanguageCode } from './translation-languages'

export const DEFAULT_TRANSLATION_TEST_SOURCE_LANGUAGE = 'en' satisfies TranslationLanguageCode

export const TRANSLATION_TEST_SOURCE_SAMPLES = {
  ar: 'هذه جملة قصيرة لاختبار الترجمة.',
  bg: 'Това е кратко изречение за тестване на превода.',
  bn: 'এটি অনুবাদ পরীক্ষা করার জন্য একটি ছোট বাক্য।',
  cs: 'Toto je krátká věta pro otestování překladu.',
  da: 'Dette er en kort sætning til at teste oversættelsen.',
  de: 'Dies ist ein kurzer Satz zum Testen der Übersetzung.',
  el: 'Αυτή είναι μια σύντομη πρόταση για τη δοκιμή της μετάφρασης.',
  en: 'My name is Sarah and I live in London.',
  es: 'Esta es una frase corta para probar la traducción.',
  fi: 'Tämä on lyhyt lause käännöksen testaamiseen.',
  fr: 'Ceci est une courte phrase pour tester la traduction.',
  hi: 'यह अनुवाद का परीक्षण करने के लिए एक छोटा वाक्य है।',
  hr: 'Ovo je kratka rečenica za testiranje prijevoda.',
  hu: 'Ez egy rövid mondat a fordítás teszteléséhez.',
  id: 'Ini adalah kalimat singkat untuk menguji terjemahan.',
  it: 'Questa è una breve frase per testare la traduzione.',
  iw: 'זהו משפט קצר לבדיקת התרגום.',
  ja: 'これは翻訳エンジンを確認するための短い文です。',
  kn: 'ಇದು ಅನುವಾದವನ್ನು ಪರೀಕ್ಷಿಸಲು ಒಂದು ಚಿಕ್ಕ ವಾಕ್ಯವಾಗಿದೆ.',
  ko: '이 문장은 번역 엔진을 확인하기 위한 짧은 문장입니다.',
  lt: 'Tai trumpas sakinys vertimui patikrinti.',
  mr: 'हे भाषांतर तपासण्यासाठी एक छोटे वाक्य आहे.',
  nl: 'Dit is een korte zin om de vertaling te testen.',
  no: 'Dette er en liten oversettelsestest fra norsk til tysk.',
  pl: 'To jest krótkie zdanie do przetestowania tłumaczenia.',
  pt: 'Esta é uma frase curta para testar a tradução.',
  ro: 'Aceasta este o propoziție scurtă pentru a testa traducerea.',
  ru: 'Это короткое предложение для проверки перевода.',
  sk: 'Toto je krátka veta na otestovanie prekladu.',
  sl: 'To je kratek stavek za preizkus prevoda.',
  sv: 'Det här är en kort mening för att testa översättningen.',
  ta: 'இது மொழிபெயர்ப்பைச் சோதிக்க ஒரு குறுகிய வாக்கியம்.',
  te: 'ఇది అనువాదాన్ని పరీక్షించడానికి ఒక చిన్న వాక్యం.',
  th: 'นี่คือประโยคสั้น ๆ สำหรับทดสอบการแปล.',
  tr: 'Bu, çeviriyi test etmek için kısa bir cümledir.',
  uk: 'Це коротке речення для перевірки перекладу.',
  vi: 'Đây là một câu ngắn để kiểm tra bản dịch.',
  zh: '这是一句用于验证翻译引擎的短句。',
  'zh-Hant': '這是一句用來驗證翻譯引擎的短句。',
} satisfies Record<TranslationLanguageCode, string>

const TRANSLATION_TEST_SOURCE_SAMPLE_BY_NORMALIZED_CODE = new Map(
  Object.entries(TRANSLATION_TEST_SOURCE_SAMPLES).map(([code, sample]) => [
    code.toLowerCase(),
    sample,
  ])
)

export function getTranslationTestSourceSample(sourceLanguage: string): string {
  const normalized = sourceLanguage.trim().toLowerCase()
  const primary = normalized.split(/[-_]/, 1)[0] ?? normalized
  return (
    TRANSLATION_TEST_SOURCE_SAMPLE_BY_NORMALIZED_CODE.get(normalized) ??
    TRANSLATION_TEST_SOURCE_SAMPLE_BY_NORMALIZED_CODE.get(primary) ??
    TRANSLATION_TEST_SOURCE_SAMPLES[DEFAULT_TRANSLATION_TEST_SOURCE_LANGUAGE]
  )
}
