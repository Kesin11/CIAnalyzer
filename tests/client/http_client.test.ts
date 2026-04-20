import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { createHttpClient, HttpError } from "../../src/client/http_client.ts";

const logger = new Logger({ type: "hidden" });
const options = new ArgumentOptions({ c: "./dummy.yaml" });

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

let server: http.Server;
let origin: string;
let handler: Handler = () => {};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.statusCode = 500;
      res.end(String(err));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  handler = () => {};
});

describe("createHttpClient", () => {
  describe("URL joining", () => {
    it("joins baseURL and a relative URL without duplicate slashes", async () => {
      handler = (req, res) => {
        expect(req.url).toBe("/api/v1.1/project/github/owner/repo");
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      };
      const client = createHttpClient(logger, options, {
        baseURL: `${origin}/api/v1.1`,
      });
      const res = await client.get("project/github/owner/repo");
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ ok: true });
    });

    it("dedupes when baseURL has a trailing slash and url has a leading slash", async () => {
      handler = (req, res) => {
        expect(req.url).toBe("/api/apps/abc/builds");
        res.end("{}");
      };
      const client = createHttpClient(logger, options, {
        baseURL: `${origin}/api/`,
      });
      const res = await client.get("/apps/abc/builds");
      expect(res.status).toBe(200);
    });

    it("passes absolute URLs through and ignores baseURL", async () => {
      handler = (req, res) => {
        expect(req.url).toBe("/artifacts/data.zip");
        res.end("{}");
      };
      const client = createHttpClient(logger, options, {
        baseURL: "https://other.test/api",
      });
      const res = await client.get(`${origin}/artifacts/data.zip`);
      expect(res.status).toBe(200);
    });
  });

  describe("params serialization", () => {
    it("drops undefined and null values from the query string", async () => {
      handler = (req, res) => {
        expect(req.url).toBe("/api?limit=100&shallow=true");
        res.end("{}");
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      await client.get("api", {
        params: {
          limit: 100,
          shallow: true,
          "page-token": undefined,
          cursor: null,
        },
      });
    });

    it("expands arrays into repeated keys", async () => {
      handler = (req, res) => {
        expect(req.url).toBe("/api?tag=a&tag=b");
        res.end("{}");
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      await client.get("api", { params: { tag: ["a", "b"] } });
    });
  });

  describe("authorization header", () => {
    it("generates a Basic auth header from auth credentials", async () => {
      const expected = `Basic ${Buffer.from("user:pass").toString("base64")}`;
      handler = (req, res) => {
        expect(req.headers.authorization).toBe(expected);
        res.end("{}");
      };
      const client = createHttpClient(logger, options, {
        baseURL: origin,
        auth: { username: "user", password: "pass" },
      });
      const res = await client.get("api");
      expect(res.status).toBe(200);
    });
  });

  describe("validateStatus", () => {
    it("treats the response as a success when a custom validateStatus returns true", async () => {
      handler = (_req, res) => {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "Unauthorized" }));
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      const res = await client.get("v2/me", {
        validateStatus: (s) => (s >= 200 && s < 300) || s === 401,
      });
      expect(res.status).toBe(401);
    });

    it("throws HttpError on 4xx by default", async () => {
      handler = (_req, res) => {
        res.statusCode = 404;
        res.end("{}");
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      await expect(client.get("api")).rejects.toBeInstanceOf(HttpError);
    });
  });

  describe("responseType", () => {
    it("returns an ArrayBuffer when responseType is 'arraybuffer'", async () => {
      const bytes = Buffer.from([1, 2, 3, 4]);
      handler = (_req, res) => {
        res.setHeader("content-type", "application/octet-stream");
        res.end(bytes);
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      const res = await client.get<ArrayBuffer>("bin", {
        responseType: "arraybuffer",
      });
      expect(res.data).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(res.data)).toEqual(new Uint8Array(bytes));
    });
  });

  describe("retries", () => {
    it("retries 500 responses up to 3 times", async () => {
      let count = 0;
      handler = (_req, res) => {
        count++;
        if (count < 3) {
          res.statusCode = 500;
          res.end("{}");
          return;
        }
        res.end(JSON.stringify({ ok: true }));
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      const res = await client.get("api");
      expect(res.status).toBe(200);
      expect(count).toBe(3);
    });

    it("does not retry 400 responses", async () => {
      let count = 0;
      handler = (_req, res) => {
        count++;
        res.statusCode = 400;
        res.end("{}");
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      await expect(client.get("api")).rejects.toSatisfy(
        (e) => e instanceof HttpError && e.response?.status === 400,
      );
      expect(count).toBe(1);
    });

    it("does not retry statuses allowed by validateStatus", async () => {
      let count = 0;
      handler = (_req, res) => {
        count++;
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "allowed" }));
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      const res = await client.get("api", {
        validateStatus: (s) => s === 401 || (s >= 200 && s < 300),
      });
      expect(res.status).toBe(401);
      expect(count).toBe(1);
    });
  });

  describe("error wrapping", () => {
    it("wraps network errors into HttpError", async () => {
      handler = (_req, res) => {
        res.destroy();
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      await expect(client.get("api")).rejects.toBeInstanceOf(HttpError);
    });

    it("includes request details on HttpError", async () => {
      handler = (_req, res) => {
        res.statusCode = 403;
        res.end("{}");
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      try {
        await client.get("api", { params: { foo: "bar" } });
        expect.fail("should throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        const err = e as HttpError;
        expect(err.request.method).toBe("GET");
        expect(err.request.url).toBe("api");
        expect(err.request.baseURL).toBe(origin);
        expect(err.request.params).toEqual({ foo: "bar" });
        expect(err.response?.status).toBe(403);
      }
    });
  });

  describe("POST", () => {
    it("sends a URLSearchParams body", async () => {
      handler = async (req, res) => {
        expect(req.method).toBe("POST");
        expect(req.headers["content-type"]).toMatch(
          /application\/x-www-form-urlencoded/,
        );
        const body = await readBody(req);
        expect(body).toBe("script=println");
        res.end(JSON.stringify({ ok: true }));
      };
      const client = createHttpClient(logger, options, { baseURL: origin });
      const body = new URLSearchParams({ script: "println" });
      const res = await client.post("scriptText", body);
      expect(res.status).toBe(200);
    });
  });
});
