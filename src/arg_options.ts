import path from "node:path";

type Argv = {
  [x: string]: unknown;
};

export class ArgumentOptions {
  onlyServices?: string[];
  debug: boolean;
  configPath: string;
  configDir: string;
  onlyExporters?: string[];
  logLevel: 2 | 3; // tslog log level: "debug" | "info"
  keepAlive: boolean;
  maxConcurrentRequests?: number;
  forceSaveLastRun: boolean;

  constructor(argv: Argv) {
    this.configPath = path.resolve(argv.c as string);
    this.onlyServices = argv["only-services"] as string[];
    this.debug = !!(argv.debug || process.env.CI_ANALYZER_DEBUG);
    this.configDir = path.dirname(this.configPath);
    this.onlyExporters = argv["only-exporters"] as string[];
    this.logLevel = (argv.v as number) > 0 ? 2 : 3;
    this.keepAlive = argv.keepalive as boolean;
    this.maxConcurrentRequests =
      (argv["max-concurrent-requests"] as number) > 0
        ? (argv["max-concurrent-requests"] as number)
        : undefined; // When user set 0, yargs parse to undefined
    this.forceSaveLastRun = argv["force-save-last-run"] as boolean;
  }
}
