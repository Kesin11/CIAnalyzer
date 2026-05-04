import { describe, expect, it } from "vitest";
import {
  detectGithubArtifactFormat,
  resolveGithubArtifactPath,
} from "../../src/client/github_artifact.ts";

describe("github_artifact", () => {
  describe("detectGithubArtifactFormat", () => {
    it("detects zip payloads from their signature", () => {
      const data = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]).buffer;

      expect(detectGithubArtifactFormat(data)).toBe("zip");
    });

    it("treats non-zip payloads as files", () => {
      const data = Uint8Array.from([0x1f, 0x8b, 0x08, 0x00]).buffer;

      expect(detectGithubArtifactFormat(data)).toBe("file");
    });
  });

  describe("resolveGithubArtifactPath", () => {
    it("trims whitespace before removing surrounding quotes", () => {
      const headers = new Headers({
        "content-disposition": 'attachment; filename="artifact.zip" ',
      });

      expect(resolveGithubArtifactPath(headers, "fallback")).toBe(
        "artifact.zip",
      );
    });

    it("prefers filename* when GitHub returns a UTF-8 encoded filename", () => {
      const headers = new Headers({
        "content-disposition":
          "attachment; filename=fallback.txt; filename*=UTF-8''test%20results.xml",
      });

      expect(resolveGithubArtifactPath(headers, "fallback")).toBe(
        "test results.xml",
      );
    });

    it("removes surrounding quotes from UTF-8 encoded filenames", () => {
      const headers = new Headers({
        "content-disposition": `attachment; filename=fallback.txt; filename*=UTF-8''"test%20results.xml"`,
      });

      expect(resolveGithubArtifactPath(headers, "fallback")).toBe(
        "test results.xml",
      );
    });
  });
});
