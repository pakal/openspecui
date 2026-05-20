import { describe, expect, it } from 'vitest'
import { getCliArgs } from './argv.js'

describe('getCliArgs', () => {
  it('drops pnpm separator markers before yargs parsing', () => {
    expect(getCliArgs(['node', 'cli', '--', '--port', '3101', '--no-open'])).toEqual([
      '--port',
      '3101',
      '--no-open',
    ])
  })

  it('keeps ordinary arguments intact', () => {
    expect(getCliArgs(['node', 'cli', 'start', '.', '--port=3200'])).toEqual([
      'start',
      '.',
      '--port=3200',
    ])
  })
})
