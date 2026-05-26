import { describe, expect, it } from 'vitest'
import { SUPPORTED_TRANSLATION_LANGUAGES } from './translation-languages'
import {
  TRANSLATION_TEST_SOURCE_SAMPLES,
  getTranslationTestSourceSample,
} from './translation-test-samples'

describe('translation test source samples', () => {
  it('defines a dedicated default sample for every supported translation language', () => {
    const supportedCodes = SUPPORTED_TRANSLATION_LANGUAGES.map((language) => language.code)
    const sampleCodes = Object.keys(TRANSLATION_TEST_SOURCE_SAMPLES)

    expect(sampleCodes.sort()).toEqual([...supportedCodes].sort())

    const englishSample = TRANSLATION_TEST_SOURCE_SAMPLES.en
    for (const code of supportedCodes) {
      const sample = getTranslationTestSourceSample(code)
      expect(sample.trim().length).toBeGreaterThan(0)
      if (code !== 'en') {
        expect(sample).not.toBe(englishSample)
      }
    }
  })

  it('normalizes regional tags before falling back to English for unknown languages', () => {
    expect(getTranslationTestSourceSample('zh-hant')).toBe(
      TRANSLATION_TEST_SOURCE_SAMPLES['zh-Hant']
    )
    expect(getTranslationTestSourceSample('pt-BR')).toBe(TRANSLATION_TEST_SOURCE_SAMPLES.pt)
    expect(getTranslationTestSourceSample('unknown')).toBe(TRANSLATION_TEST_SOURCE_SAMPLES.en)
  })
})
