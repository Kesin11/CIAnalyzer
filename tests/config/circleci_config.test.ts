import { describe, it, expect, beforeEach } from "vitest";
import { Logger } from "tslog";
import {
  CircleciConfig,
  parseConfig,
} from "../../src/config/circleci_config.ts";
import {
  validateConfig,
  type ValidatedYamlConfig,
} from "../../src/config/config.ts";

const logger = new Logger({ type: "hidden" });

describe("parseConfig", () => {
  describe("vcsType", () => {
    it("should github when value is repo string", () => {
      const config = {
        circleci: {
          repos: ["owner/repo"],
          version: 2 as const,
        },
      };

      const actual = parseConfig(validateConfig(logger, config));
      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            vcsType: "github",
            fullname: "github/owner/repo",
            customReports: [],
          },
        ],
        version: 2,
      });
    });

    it("should same as provides when value is object", () => {
      const config = {
        circleci: {
          repos: [{ name: "owner/repo", vcs_type: "bitbucket" }],
          version: 2 as const,
        },
      };

      const actual = parseConfig(validateConfig(logger, config));
      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            vcsType: "bitbucket",
            fullname: "bitbucket/owner/repo",
            customReports: [],
          },
        ],
        version: 2,
      });
    });

    it("should github when object vcs_type is null", () => {
      const config = {
        circleci: {
          repos: [{ name: "owner/repo" }],
          version: 2 as const,
        },
      };

      const actual = parseConfig(validateConfig(logger, config));
      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            vcsType: "github",
            fullname: "github/owner/repo",
            customReports: [],
          },
        ],
        version: 2,
      });
    });
  });

  describe("customReports", () => {
    const customReport = { name: "custom", paths: ["custom.json"] };

    it("that has not customReports", () => {
      const config = {
        circleci: {
          repos: [
            {
              name: "owner/repo",
            },
          ],
          version: 2 as const,
        },
      };

      const actual = parseConfig(validateConfig(logger, config));
      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            vcsType: "github",
            fullname: "github/owner/repo",
            customReports: [],
          },
        ],
        version: 2,
      });
    });

    it("that has customReports", () => {
      const config = {
        circleci: {
          repos: [
            {
              name: "owner/repo",
              customReports: [customReport],
            },
          ],
          version: 2 as const,
        },
      };

      const actual = parseConfig(validateConfig(logger, config));
      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            vcsType: "github",
            fullname: "github/owner/repo",
            customReports: [customReport],
          },
        ],
        version: 2,
      });
    });
  });

  describe("version", () => {
    describe("it valid according to the schema", () => {
      it("should 1 when version: 1(Number)", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
            version: 1 as const,
          },
        };

        const actual = parseConfig(validateConfig(logger, config));
        expect(actual!.version).toEqual(1);
      });

      it("should 2 when version: 2(Number)", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
            version: 2 as const,
          },
        };

        const actual = parseConfig(validateConfig(logger, config));
        expect(actual!.version).toEqual(2);
      });
    });

    describe("it invalid according to the schema", () => {
      it("should migrate to 1 when empty", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
          },
        } as ValidatedYamlConfig; // for testing cast;

        const actual = parseConfig(config);
        expect(actual!.version).toEqual(1);
      });

      it("should migrate to 1 when version: 1(String)", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
            version: "1",
          },
        } as unknown as ValidatedYamlConfig; // for testing cast;

        const actual = parseConfig(config);
        expect(actual!.version).toEqual(1);
      });

      it("should migrate to 2 when version: 2(String)", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
            version: "2",
          },
        } as unknown as ValidatedYamlConfig; // for testing cast;

        const actual = parseConfig(config);
        expect(actual!.version).toEqual(2);
      });

      it("should 1 when unknown value", () => {
        const config = {
          circleci: {
            repos: ["owner/repo"],
            version: "1000",
          },
        } as unknown as ValidatedYamlConfig; // for testing cast;

        const actual = parseConfig(config);
        expect(actual!.version).toEqual(1);
      });
    });
  });
});
