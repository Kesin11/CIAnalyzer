import path from "node:path";
import { parseArgs } from "node:util";
import type { ParseArgsOptionsConfig } from "node:util";

type Argv = {
  [x: string]: unknown;
};

type CliToken =
  | {
      kind: "option";
      index: number;
      name: string;
      rawName: string;
      value: string | undefined;
      inlineValue: boolean | undefined;
    }
  | { kind: "positional"; index: number; value: string }
  | { kind: "option-terminator"; index: number };
type OptionToken = Extract<CliToken, { kind: "option" }>;
type PositionalToken = Extract<CliToken, { kind: "positional" }>;

const defaultConfigPath = "./ci_analyzer.yaml";

const optionDescriptions = [
  {
    names: "-c, --config",
    value: "<path>",
    description: "Path to config yaml",
    defaultValue: defaultConfigPath,
  },
  {
    names: "-v, --verbose",
    description: "Enable debug log level. Repeatable, e.g. -vv",
  },
  {
    names: "--debug",
    description: "Enable debug mode",
    defaultValue: "false",
  },
  {
    names: "--only-services",
    value: "<services...>",
    description:
      "Exec only selected services. ex: --only-services circleci github",
  },
  {
    names: "--only-exporters",
    value: "<exporters...>",
    description:
      "Export data using only selected exporters. ex: --only-exporters local",
  },
  {
    names: "--keepalive",
    description: "Enable http/https keepalive",
    defaultValue: "true",
  },
  {
    names: "--max-concurrent-requests",
    value: "<number>",
    description:
      "Limit http request concurrency per service. When set 0, disable concurrency limit",
    defaultValue: "10",
  },
  {
    names: "--force-save-last-run",
    description:
      "Save last run state even when errors occur during data collection",
    defaultValue: "false",
  },
  {
    names: "--help",
    description: "Show help",
  },
  {
    names: "--version",
    description: "Show version number",
  },
];

type ParsedArgs = {
  values: Argv;
  positionals: string[];
  tokens: CliToken[];
};

const optionConfig: ParseArgsOptionsConfig = {
  config: {
    type: "string",
    short: "c",
    default: defaultConfigPath,
  },
  verbose: {
    type: "boolean",
    short: "v",
    multiple: true,
    default: [],
  },
  debug: {
    type: "boolean",
    default: false,
  },
  "only-services": {
    type: "string",
    multiple: true,
  },
  "only-exporters": {
    type: "string",
    multiple: true,
  },
  keepalive: {
    type: "boolean",
    default: true,
  },
  "max-concurrent-requests": {
    type: "string",
    default: "10",
  },
  "force-save-last-run": {
    type: "boolean",
    default: false,
  },
  help: {
    type: "boolean",
    default: false,
  },
  version: {
    type: "boolean",
    default: false,
  },
} as const;

export const createHelpMessage = (): string => {
  const optionRows = optionDescriptions.map((option) => {
    const optionLabel = [option.names, option.value].filter(Boolean).join(" ");
    const description = option.defaultValue
      ? `${option.description} [default: ${option.defaultValue}]`
      : option.description;

    return { optionLabel, description };
  });
  const optionColumnWidth = Math.max(
    ...optionRows.map((row) => row.optionLabel.length),
  );
  const optionLines = optionRows
    .map(
      (row) =>
        `  ${row.optionLabel.padEnd(optionColumnWidth)}  ${row.description}`,
    )
    .join("\n");

  return [
    "ci_analyzer [workflow]",
    "",
    "Collect workflow data from CI services",
    "",
    "Options:",
    optionLines,
    "",
  ].join("\n");
};

const normalizeArrayOption = (
  parsedArgs: ParsedArgs,
  optionName: string,
): Set<number> => {
  const optionTokens = parsedArgs.tokens.filter(
    (token): token is OptionToken =>
      token.kind === "option" && token.name === optionName,
  );
  if (optionTokens.length === 0) {
    parsedArgs.values[optionName] = undefined;
    return new Set();
  }

  const values: string[] = [];
  const consumedPositionalIndexes = new Set<number>();
  for (const token of optionTokens) {
    if (typeof token.value === "string") {
      values.push(token.value);
    }

    const index = parsedArgs.tokens.indexOf(token);

    for (const nextToken of parsedArgs.tokens.slice(index + 1)) {
      if (nextToken.kind !== "positional") {
        break;
      }

      values.push(nextToken.value);
      consumedPositionalIndexes.add(nextToken.index);
    }
  }

  parsedArgs.values[optionName] = values;
  return consumedPositionalIndexes;
};

const normalizeVerboseOption = (argv: Argv) => {
  const verboseValues = argv.verbose;
  argv.v = Array.isArray(verboseValues) ? verboseValues.length : 0;
};

const normalizeConfigOption = (argv: Argv) => {
  argv.c = argv.config;
};

const normalizeMaxConcurrentRequestsOption = (argv: Argv) => {
  const value = argv["max-concurrent-requests"];
  if (typeof value !== "string") {
    argv["max-concurrent-requests"] = 10;
    return;
  }

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new TypeError(
      `Invalid value for --max-concurrent-requests: ${value}. Expected a non-negative integer.`,
    );
  }

  argv["max-concurrent-requests"] = numericValue;
};

const validatePositionals = (positionals: string[]) => {
  const unsupportedPositionals = positionals.filter(
    (positional) => positional !== "workflow",
  );
  if (unsupportedPositionals.length > 0) {
    throw new TypeError(
      `Unknown argument: ${unsupportedPositionals.join(" ")}`,
    );
  }
};

export const parseCliArgs = (args = process.argv.slice(2)): Argv => {
  const parsedArgs = parseArgs({
    args,
    options: optionConfig,
    strict: true,
    allowPositionals: true,
    allowNegative: true,
    tokens: true,
  }) as ParsedArgs;

  const arrayOptionPositionalIndexes = new Set([
    ...normalizeArrayOption(parsedArgs, "only-services"),
    ...normalizeArrayOption(parsedArgs, "only-exporters"),
  ]);
  const commandPositionals = parsedArgs.tokens
    .filter(
      (token): token is PositionalToken =>
        token.kind === "positional" &&
        !arrayOptionPositionalIndexes.has(token.index),
    )
    .map((token) => token.value);
  validatePositionals(commandPositionals);

  normalizeVerboseOption(parsedArgs.values);
  normalizeConfigOption(parsedArgs.values);
  normalizeMaxConcurrentRequestsOption(parsedArgs.values);

  return parsedArgs.values;
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
