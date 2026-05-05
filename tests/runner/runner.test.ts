import { describe, expect, it, vi } from "vitest";
import { CompositRunner } from "../../src/runner/runner.ts";

describe("CompositRunner", () => {
  it("logs GCP API style errors without relying on ApiError", () => {
    const logger = {
      error: vi.fn(),
    };
    const runner = new CompositRunner(
      logger as never,
      {} as never,
      {} as never,
    );

    const error = Object.assign(new Error("permission denied"), {
      code: 403,
      response: {
        body: "permission denied",
      },
    });

    runner.handlingError(error);

    expect(logger.error).toHaveBeenCalledWith(
      "Catch GCloud Error. Please check 'gcloud' auth status or your permission.",
    );
    expect(logger.error).toHaveBeenCalledWith("permission denied");
    expect(logger.error).toHaveBeenCalledWith(error.stack);
  });
});
