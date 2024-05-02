import { describe, it, expect, beforeEach } from "vitest";
import { parseConfig } from "../../src/config/bitrise_config";

describe("parseConfig", () => {
  describe("apps", () => {
    it("when only string", () => {
      const config = {
        bitrise: {
          apps: ["owner/app"],
        },
      };

      const actual = parseConfig(config);
      expect(actual).toEqual({
        apps: [
          {
            owner: "owner",
            title: "app",
            fullname: "owner/app",
            testGlob: [],
            customReports: [],
          },
        ],
      });
    });

    it("when object", () => {
      const config = {
        bitrise: {
          apps: [
            {
              name: "owner/app",
            },
          ],
        },
      };

      const actual = parseConfig(config);
      expect(actual).toEqual({
        apps: [
          {
            owner: "owner",
            title: "app",
            fullname: "owner/app",
            testGlob: [],
            customReports: [],
          },
        ],
      });
    });
  });
});
