import { z } from 'zod';
import { bitriseYamlSchema } from './bitrise_config';
import { circleciYamlSchema } from './circleci_config';
import { githubYamlSchema } from './github_config';
import { jenkinsYamlSchema } from './jenkins_config';
import { Logger } from 'tslog';

export const yamlSchema = z.object({
  github: githubYamlSchema.strict(),
  circleci: circleciYamlSchema.strict(),
  jenkins: jenkinsYamlSchema.strict(),
  bitrise: bitriseYamlSchema.strict(),
}).partial()
export type YamlConfig = z.infer<typeof yamlSchema>;
export type ValidatedYamlConfig = YamlConfig & {
  _configValidated: true
}

// Remove _errors: [] in nested properties for human readability
const formatErrorForLog = (error: z.ZodError): string =>  {
    return JSON.stringify(error.format(), (key: any, value: any) => {
      return (key === '_errors' && value.length === 0) ? undefined : value
    }, 2)
}

export const validateConfig = (logger: Logger<unknown>, config: YamlConfig, strict: boolean = false): ValidatedYamlConfig => {
  const parseResult = yamlSchema.safeParse(config)
  if (!parseResult.success) {
    if (strict === true) { throw new Error('Invalid config. Formatted zod error:\n' + formatErrorForLog(parseResult.error)) }
    else { logger.warn('Invalid config. Formatted zod error:\n', formatErrorForLog(parseResult.error)) }
  }
  return {
    ...config,
    _configValidated: true
  }
}
