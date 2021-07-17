type Argv = {
  [x: string]: unknown
}

export class ArgumentOptions {
  onlyServices?: string[]

  constructor(argv: Argv) {
    this.onlyServices = argv['only-services'] as string[]
  }
}