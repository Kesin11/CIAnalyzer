import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStore } from "../../src/store/local_store.ts";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Logger } from "tslog";

const createRandomStr = () => crypto.randomBytes(8).toString("hex");
const logger = new Logger({ type: "hidden" });

describe("LocalStore", () => {
  let storePath: string;
  let localStore: LocalStore;
  beforeEach(() => {
    storePath = path.join(os.tmpdir(), `${createRandomStr()}.json`);
    const configDir = path.dirname(storePath);
    localStore = new LocalStore(logger, "test", configDir, storePath);
  });
  afterEach(async () => {
    try {
      await fs.promises.access(storePath);
      await fs.promises.unlink(storePath);
    } catch {}
  });

  describe("read", () => {
    it("should return same object as writed JSON", async () => {
      const now = new Date();
      const lastRun = {
        "owner/repo": {
          lastRun: 1,
          updatedAt: now.toISOString(),
        },
      };
      await fs.promises.writeFile(storePath, JSON.stringify(lastRun));

      const actual = await localStore.read();
      expect(actual).toEqual(lastRun);
    });

    it("should return empty object when JSON was not found", async () => {
      const actual = await localStore.read();
      expect(actual).toEqual({});
    });
  });

  it("save", async () => {
    const now = new Date();
    const lastRun = {
      "owner/repo": {
        lastRun: 100,
        updatedAt: now,
      },
    };
    await localStore.write(lastRun);

    const readFile = await fs.promises.readFile(storePath);
    const actual = JSON.parse(readFile.toString());

    expect(actual).toStrictEqual({
      "owner/repo": {
        lastRun: 100,
        updatedAt: expect.anything(),
      },
    });
  });
});
