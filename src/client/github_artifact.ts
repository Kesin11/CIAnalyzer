import { minimatch } from "minimatch";
import type { Artifact } from "./artifact.js";

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;

export type GithubArtifactFormat = "zip" | "file";

function hasZipSignature(data: ArrayBuffer): boolean {
  const bytes = new Uint8Array(data);
  return ZIP_SIGNATURES.some((signature) => {
    return signature.every((byte, index) => bytes[index] === byte);
  });
}

function stripQuotes(value: string): string {
  return value.replace(/^"(.*)"$/, "$1").trim();
}

function parseContentDispositionFilename(
  contentDisposition: string,
): string | undefined {
  const utf8FilenameMatch = contentDisposition.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i,
  );
  if (utf8FilenameMatch?.[1]) {
    return decodeURIComponent(stripQuotes(utf8FilenameMatch[1]));
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
  if (filenameMatch?.[1]) {
    return stripQuotes(filenameMatch[1]);
  }

  return undefined;
}

export function detectGithubArtifactFormat(
  data: ArrayBuffer,
): GithubArtifactFormat {
  return hasZipSignature(data) ? "zip" : "file";
}

export function resolveGithubArtifactPath(
  headers: Headers,
  fallbackName: string,
): string {
  const contentDisposition = headers.get("content-disposition");
  if (!contentDisposition) return fallbackName;

  return parseContentDispositionFilename(contentDisposition) ?? fallbackName;
}

function matchesGithubArtifactPath(path: string, globs: string[]): boolean {
  return globs.some((glob) => minimatch(path, glob));
}

export function toDirectArtifact(
  path: string,
  data: ArrayBuffer,
  globs: string[],
): Artifact | undefined {
  if (!matchesGithubArtifactPath(path, globs)) return undefined;
  return {
    path,
    data,
  };
}
