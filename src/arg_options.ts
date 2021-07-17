type Argv = {
  [x: string]: unknown
}

export class ArgumentOptions {
  onlyServices?: string[]
  debug: boolean

  constructor(argv: Argv) {
    this.onlyServices = argv['only-services'] as string[]
    this.debug = argv['debug'] as boolean
  }
}