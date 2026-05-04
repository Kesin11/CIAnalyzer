import { minimatch } from "minimatch";
import type { Artifact } from "./artifact.ts";

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;
const UTF8_FILENAME_PATTERN = /filename\*\s*=\s*UTF-8''([^;]+)/i;
const FILENAME_PATTERN = /filename\s*=\s*([^;]+)/i;

export type GithubArtifactFormat = "zip" | "file";

function hasZipSignature(data: ArrayBuffer): boolean {
  const bytes = new Uint8Array(data);
  return ZIP_SIGNATURES.some((signature) => {
    return signature.every((byte, index) => bytes[index] === byte);
  });
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }

  return trimmed.slice(1, -1);
}

function getContentDispositionFilename(
  contentDisposition: string,
  pattern: RegExp,
): string | undefined {
  const filename = contentDisposition.match(pattern)?.[1];
  if (!filename) {
    return undefined;
  }

  return stripQuotes(filename);
}

function parseContentDispositionFilename(
  contentDisposition: string,
): string | undefined {
  const utf8Filename = getContentDispositionFilename(
    contentDisposition,
    UTF8_FILENAME_PATTERN,
  );
  if (utf8Filename) {
    return decodeURIComponent(utf8Filename);
  }

  return getContentDispositionFilename(contentDisposition, FILENAME_PATTERN);
}

/**
 * GitHub's artifact metadata and headers are not reliable enough to identify
 * whether a payload is really a ZIP, so inspect the payload bytes directly
 * before deciding whether it is safe to pass to AdmZip.
 */
export function detectGithubArtifactFormat(
  data: ArrayBuffer,
): GithubArtifactFormat {
  return hasZipSignature(data) ? "zip" : "file";
}

/**
 * Non-ZIP artifacts should still be matched against the existing path globs.
 * Prefer the download response filename because GitHub can return a more
 * specific name than the artifact's logical name from the listing API.
 */
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

/**
 * Reuse the current path-glob configuration for non-ZIP artifacts instead of
 * introducing a separate artifact-name config surface.
 */
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
