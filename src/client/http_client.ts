import { Agent, setGlobalDispatcher } from "undici";
import type { Logger } from "tslog";
import type { ArgumentOptions } from "../arg_options.js";
import { summarizeHttpError } from "../error.js";

export type RequestConfig = {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  responseType?: "json" | "arraybuffer" | "text";
  validateStatus?: (status: number) => boolean;
  signal?: AbortSignal;
  timeout?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: axios compat — callers narrow via generic
export type HttpResponse<T = any> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
};

type HttpBody = string | URLSearchParams | ArrayBuffer | Uint8Array;

export type InstanceConfig = {
  baseURL?: string;
  auth?: { username: string; password: string };
  headers?: Record<string, string>;
  timeout?: number;
};

export interface HttpClient {
  // biome-ignore lint/suspicious/noExplicitAny: axios compat
  get<T = any>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>;
  // biome-ignore lint/suspicious/noExplicitAny: axios compat
  post<T = any>(
    url: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<HttpResponse<T>>;
}

type HttpErrorRequest = {
  method: string;
  url: string;
  baseURL?: string;
  params?: Record<string, unknown>;
};

type HttpErrorResponse = { status: number; statusText: string };

export class HttpError extends Error {
  override readonly name = "HttpError";
  readonly request: HttpErrorRequest;
  readonly response?: HttpErrorResponse;
  constructor(init: {
    message: string;
    request: HttpErrorRequest;
    response?: HttpErrorResponse;
    cause?: unknown;
  }) {
    super(init.message, { cause: init.cause });
    this.request = init.request;
    this.response = init.response;
  }
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RETRY = 3;

let dispatcherConfigured = false;
const configureDispatcher = (options: ArgumentOptions): void => {
  if (dispatcherConfigured) return;
  if (!options.keepAlive && !options.maxConcurrentRequests) return;
  setGlobalDispatcher(
    new Agent({
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 600_000,
      connections: options.maxConcurrentRequests,
      pipelining: 0,
    }),
  );
  dispatcherConfigured = true;
};

const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

const joinUrl = (baseURL: string | undefined, url: string): string => {
  if (isAbsoluteUrl(url)) return url;
  if (!baseURL) return url;
  return `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
};

const buildQueryString = (params?: Record<string, unknown>): string => {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        usp.append(key, String(item));
      }
    } else {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs.length > 0 ? `?${qs}` : "";
};

const basicAuthHeader = (auth: {
  username: string;
  password: string;
}): string => {
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString(
    "base64",
  );
  return `Basic ${token}`;
};

const defaultValidateStatus = (status: number): boolean =>
  status >= 200 && status < 300;

const exponentialBackoffDelay = (attempt: number): number =>
  2 ** attempt * 100 + Math.floor(Math.random() * 100);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    const status = error.response?.status ?? 0;
    return status >= 500 || status === 429;
  }
  if (error instanceof TypeError) return true;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return true;
  }
  return false;
};

const encodeBody = (
  body: unknown,
): { body: HttpBody | null; contentType?: string } => {
  if (body === undefined || body === null) return { body: null };
  if (body instanceof URLSearchParams) return { body };
  if (
    body instanceof ArrayBuffer ||
    body instanceof Uint8Array ||
    typeof body === "string"
  ) {
    return { body };
  }
  return { body: JSON.stringify(body), contentType: "application/json" };
};

type InternalRequest = {
  method: string;
  url: string;
  baseURL?: string;
  params?: Record<string, unknown>;
  headers: Record<string, string>;
  body: HttpBody | null;
  responseType: "json" | "arraybuffer" | "text";
  validateStatus: (status: number) => boolean;
  timeout: number;
  userSignal?: AbortSignal;
};

const parseBody = async <T>(
  response: Response,
  responseType: "json" | "arraybuffer" | "text",
): Promise<T> => {
  const contentLength = response.headers.get("content-length");
  if (response.status === 204 || contentLength === "0") {
    return null as T;
  }
  switch (responseType) {
    case "arraybuffer":
      return (await response.arrayBuffer()) as T;
    case "text":
      return (await response.text()) as T;
    default:
      return (await response.json()) as T;
  }
};

const executeRequest = async <T>(
  req: InternalRequest,
  logger: Logger<unknown>,
): Promise<HttpResponse<T>> => {
  const fullUrl = `${joinUrl(req.baseURL, req.url)}${buildQueryString(req.params)}`;

  logger.debug(`${req.method} ${req.url}`);
  logger.debug("request", {
    method: req.method,
    baseUrl: req.baseURL,
    url: req.url,
    params: req.params,
  });

  const requestInfo: HttpErrorRequest = {
    method: req.method,
    url: req.url,
    baseURL: req.baseURL,
    params: req.params,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY + 1; attempt++) {
    const timeoutSignal = AbortSignal.timeout(req.timeout);
    const signal = req.userSignal
      ? AbortSignal.any([req.userSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(fullUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal,
      });

      if (!req.validateStatus(response.status)) {
        throw new HttpError({
          message: `Request failed with status code ${response.status}`,
          request: requestInfo,
          response: {
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      const data = await parseBody<T>(response, req.responseType);
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };
    } catch (error) {
      lastError = error;
      if (attempt <= MAX_RETRY && shouldRetry(error)) {
        await sleep(exponentialBackoffDelay(attempt));
        continue;
      }
      break;
    }
  }

  const wrapped =
    lastError instanceof HttpError
      ? lastError
      : new HttpError({
          message:
            lastError instanceof Error
              ? lastError.message
              : "Unknown HTTP error",
          request: requestInfo,
          cause: lastError,
        });
  logger.error(summarizeHttpError(wrapped));
  throw wrapped;
};

export const createHttpClient = (
  logger: Logger<unknown>,
  options: ArgumentOptions,
  config: InstanceConfig,
): HttpClient => {
  configureDispatcher(options);

  const instanceHeaders: Record<string, string> = { ...(config.headers ?? {}) };
  if (config.auth) {
    instanceHeaders.Authorization = basicAuthHeader(config.auth);
  }
  const instanceTimeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  const request = <T>(
    method: string,
    url: string,
    body: HttpBody | null,
    cfg: RequestConfig | undefined,
    extraHeaders?: Record<string, string>,
  ): Promise<HttpResponse<T>> => {
    const mergedHeaders: Record<string, string> = {
      ...instanceHeaders,
      ...(extraHeaders ?? {}),
      ...(cfg?.headers ?? {}),
    };
    return executeRequest<T>(
      {
        method,
        url,
        baseURL: config.baseURL,
        params: cfg?.params,
        headers: mergedHeaders,
        body,
        responseType: cfg?.responseType ?? "json",
        validateStatus: cfg?.validateStatus ?? defaultValidateStatus,
        timeout: cfg?.timeout ?? instanceTimeout,
        userSignal: cfg?.signal,
      },
      logger,
    );
  };

  return {
    // biome-ignore lint/suspicious/noExplicitAny: axios compat
    get: <T = any>(url: string, cfg?: RequestConfig) =>
      request<T>("GET", url, null, cfg),
    // biome-ignore lint/suspicious/noExplicitAny: axios compat
    post: <T = any>(url: string, body?: unknown, cfg?: RequestConfig) => {
      const encoded = encodeBody(body);
      const extraHeaders = encoded.contentType
        ? { "Content-Type": encoded.contentType }
        : undefined;
      return request<T>("POST", url, encoded.body, cfg, extraHeaders);
    },
  };
};
