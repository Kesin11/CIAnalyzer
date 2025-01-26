import { describe, it, expect, beforeEach } from "vitest";
import { parseConfig } from "../../src/config/github_config.ts";

describe("parseConfig", () => {
  it("when repos are string", () => {
    const config = {
      github: {
        repos: ["owner/repo"],
      },
    };
    const actual = parseConfig(config);

    expect(actual).toEqual({
      repos: [
        {
          owner: "owner",
          repo: "repo",
          fullname: "owner/repo",
          testGlob: [],
          customReports: [],
        },
      ],
    });
  });

  describe("when repos are object", () => {
    it("that has only name", () => {
      const config = {
        github: {
          repos: [
            {
              name: "owner/repo",
            },
          ],
        },
      };
      const actual = parseConfig(config);

      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            fullname: "owner/repo",
            testGlob: [],
            customReports: [],
          },
        ],
      });
    });

    it("that has tests", () => {
      const config = {
        github: {
          repos: [
            {
              name: "owner/repo",
              tests: ["**/*.xml"],
            },
          ],
        },
      };
      const actual = parseConfig(config);

      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            fullname: "owner/repo",
            testGlob: ["**/*.xml"],
            customReports: [],
          },
        ],
      });
    });

    it("that has customReports", () => {
      const customReport = { name: "custom", paths: ["custom.json"] };
      const config = {
        github: {
          repos: [
            {
              name: "owner/repo",
              customReports: [customReport],
            },
          ],
        },
      };
      const actual = parseConfig(config);

      expect(actual).toEqual({
        repos: [
          {
            owner: "owner",
            repo: "repo",
            fullname: "owner/repo",
            testGlob: [],
            customReports: [customReport],
          },
        ],
      });
    });
  });
});
