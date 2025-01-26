import { describe, it, expect, beforeEach } from "vitest";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { CircleciClientV2 } from "../../src/client/circleci_client_v2.ts";

const logger = new Logger({ type: "hidden" });
const options = new ArgumentOptions({
  c: "./dummy.yaml",
});

describe("CircleciClient", () => {
  describe("new() with baseUrl", () => {
    it("should OK when undefined", async () => {
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options);
      }).toBeTruthy();
    });

    it("should OK when /api", async () => {
      const baseUrl = "https://circleci.com/api";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toBeTruthy();
    });

    it("should OK when /api/", async () => {
      const baseUrl = "https://circleci.com/api/";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toBeTruthy();
    });

    it("should throw when /api/v1.1", async () => {
      const baseUrl = "https://circleci.com/api/v1.1";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toThrow();
    });

    it("should throw when /api/v2", async () => {
      const baseUrl = "https://circleci.com/api/v2";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toThrow();
    });
  });
});
