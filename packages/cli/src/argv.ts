import { hideBin } from 'yargs/helpers'

export function getCliArgs(argv: string[]): string[] {
  return hideBin(argv).filter((arg) => arg !== '--')
}
