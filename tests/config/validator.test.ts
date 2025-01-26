import { describe, it, expect, beforeEach } from "vitest";
import { Logger } from "tslog";
import {
  type ValidatedYamlConfig,
  validateConfig,
} from "../../src/config/config";

const logger = new Logger({ type: "hidden" });

describe("validateConfig", () => {
  describe("when valid", () => {
    it("should return the validated config with ValidatedYamlConfig types", () => {
      const config = {
        github: {
          repos: ["owner/repo"],
        },
      };

      const validatedConfig = validateConfig(logger, config, true);

      expect(validatedConfig).toEqual({
        ...config,
        _configValidated: true,
      } as ValidatedYamlConfig);
    });
  });

  describe("when invalid", () => {
    it("has extra property", () => {
      const config = {
        github: {
          foobar: true, // extra property
          repos: ["owner/repo"],
        },
      };

      expect(() => validateConfig(logger, config, true)).toThrow();
    });

    it("has lacking required property", () => {
      const config = {
        github: {
          repos: [
            {
              // name: "owner/repo",
              tests: ["**/*.xml"],
            },
          ],
        },
      } as any;

      expect(() => validateConfig(logger, config, true)).toThrow();
    });

    it("has wrong types", () => {
      const config = {
        github: {
          repos: [
            {
              name: 12, // Invalid types
            },
          ],
        },
      } as any;
      expect(() => validateConfig(logger, config, true)).toThrow();
    });
  });
});
