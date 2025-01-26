import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BitriseAnalyzer } from "../../src/analyzer/bitrise_analyzer.ts";
import type { BuildLogResponse } from "../../src/client/bitrise_client.ts";

describe("BitriseAnalyzer", () => {
  let analyzer: BitriseAnalyzer;
  beforeEach(() => {
    analyzer = new BitriseAnalyzer();
  });

  describe("parseBuildLog", () => {
    it("has error step", async () => {
      const fixturePath = path.join(
        __dirname,
        "..",
        "fixture",
        "bitrise_build_log",
        "failed.json",
      );
      const buildLogResponse = JSON.parse(
        await fs.promises.readFile(fixturePath, { encoding: "utf8" }),
      ) as BuildLogResponse;

      const expected = [
        { name: "activate-ssh-key", duration: "7.28 sec" },
        { name: "git-clone@4", duration: "8.22 sec" },
        { name: "flutter-installer", duration: "1.5 min" },
        { name: "flutter-analyze", duration: "45.71 sec" },
        { name: "flutter-test", duration: "32.41 sec" },
        { name: "flutter-build (exit code: 1)", duration: "4.1 min" },
        { name: "deploy-to-bitrise-io", duration: "30.23 sec" },
      ];

      const actual = analyzer.parseBuildLog(buildLogResponse);
      expect(actual).toEqual(expected);
    });

    it("has int sec duration", async () => {
      const fixturePath = path.join(
        __dirname,
        "..",
        "fixture",
        "bitrise_build_log",
        "int_sec.json",
      );
      const buildLogResponse = JSON.parse(
        await fs.promises.readFile(fixturePath, { encoding: "utf8" }),
      ) as BuildLogResponse;

      const expected = [
        { name: "activate-ssh-key", duration: "5.05 sec" },
        { name: "git-clone@4.0.14", duration: "6.92 sec" },
        { name: "flutter-installer", duration: "181 sec" },
        { name: "flutter-analyze", duration: "40 sec" },
        { name: "flutter-test", duration: "25 sec" },
        { name: "flutter-build", duration: "299 sec" },
        { name: "DeployGate Upload apk", duration: "6.90 sec" },
        { name: "DeployGate Upload ipa (exit code: 1)", duration: "4.18 sec" },
        { name: "deploy-to-bitrise-io", duration: "20 sec" },
      ];

      const actual = analyzer.parseBuildLog(buildLogResponse);
      expect(actual).toEqual(expected);
    });

    it("summary table get across multiple log chunks", async () => {
      const fixturePath = path.join(
        __dirname,
        "..",
        "fixture",
        "bitrise_build_log",
        "long_summary.json",
      );
      const buildLogResponse = JSON.parse(
        await fs.promises.readFile(fixturePath, { encoding: "utf8" }),
      ) as BuildLogResponse;

      const actual = analyzer.parseBuildLog(buildLogResponse);
      expect(actual.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe("detectStepMilisec", () => {
    it("sec int", () => {
      const actual = analyzer.detectStepMilisec("15 sec");
      expect(actual).toEqual(15000);
    });

    it("sec float", () => {
      const actual = analyzer.detectStepMilisec("1.5 sec");
      expect(actual).toEqual(1500);
    });

    it("min int", () => {
      const actual = analyzer.detectStepMilisec("1 min");
      expect(actual).toEqual(60000);
    });

    it("min float", () => {
      const actual = analyzer.detectStepMilisec("1.5 min");
      expect(actual).toEqual(90000);
    });
  });

  describe("detectStepName", () => {
    it("it has only step name", () => {
      const actual = analyzer.detectStepName("git-clone");
      expect(actual).toEqual("git-clone");
    });

    it("it has version", () => {
      const actual = analyzer.detectStepName("git-clone@4");
      expect(actual).toEqual("git-clone@4");
    });

    it('it has "exit code: 1"', () => {
      const actual = analyzer.detectStepName("git-clone (exit code: 1)");
      expect(actual).toEqual("git-clone");
    });

    it("it has bracket in step name", () => {
      const actual = analyzer.detectStepName("git (test) clone");
      expect(actual).toEqual("git (test) clone");
    });

    it("it has bracket in end of step name", () => {
      const actual = analyzer.detectStepName("git-clone(test)");
      expect(actual).toEqual("git-clone(test)");
    });
  });

  describe("detectStepStatus", () => {
    it("it has only step name", () => {
      const actual = analyzer.detectStepStatus("git-clone");
      expect(actual).toEqual("SUCCESS");
    });
    it('it has "exit code: 1"', () => {
      const actual = analyzer.detectStepStatus("git-clone (exit code: 1)");
      expect(actual).toEqual("FAILURE");
    });
  });
});
