import { describe, expect, it } from 'vitest'
import {
  checkLocalDirectionalModelLanguagePair,
  inferLocalDirectionalModelLanguagePair,
} from './translation-language-pair.js'

describe('local translation language-pair laws', () => {
  it('infers opus-mt language direction from local model ids', () => {
    expect(inferLocalDirectionalModelLanguagePair('onnx-community/opus-mt-en-zh')).toEqual({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })
    expect(inferLocalDirectionalModelLanguagePair('Xenova/opus-mt-no-de')).toEqual({
      sourceLanguage: 'no',
      targetLanguage: 'de',
    })
  })

  it('leaves multilingual or unknown model ids unrestricted', () => {
    expect(inferLocalDirectionalModelLanguagePair('Xenova/nllb-200-distilled-600M')).toBeNull()
    expect(inferLocalDirectionalModelLanguagePair('custom/local-model')).toBeNull()
  })

  it('rejects target languages that conflict with a directional local model', () => {
    expect(
      checkLocalDirectionalModelLanguagePair({
        model: 'onnx-community/opus-mt-en-zh',
        targetLanguage: 'de',
      })
    ).toEqual({
      supported: false,
      expected: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      },
      message:
        'Selected local model supports en -> zh, but document translation is configured for target de.',
    })
  })

  it('rejects detected source languages that conflict with a directional local model', () => {
    expect(
      checkLocalDirectionalModelLanguagePair({
        model: 'onnx-community/opus-mt-en-zh',
        sourceLanguage: 'de',
        targetLanguage: 'zh-CN',
      })
    ).toEqual({
      supported: false,
      expected: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      },
      message:
        'Selected local model supports en -> zh, but document segment was detected as de -> zh-CN.',
    })
  })
})
