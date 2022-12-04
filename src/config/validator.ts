import { z } from 'zod';
import { bitriseYamlSchema } from './bitrise_config';
import { circleciYamlSchema } from './circleci_config';
import { githubYamlSchema } from './github_config';
import { jenkinsYamlSchema } from './jenkins_config';

export const yamlSchema = z.object({
  github: githubYamlSchema.optional(),
  circleci: circleciYamlSchema.optional(),
  jenkins: jenkinsYamlSchema.optional(),
  bitrise: bitriseYamlSchema.optional(),
})
export type YamlConfig = z.infer<typeof yamlSchema>;
