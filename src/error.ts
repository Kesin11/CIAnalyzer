import type { HttpError } from "./client/http_client.js";

export const summarizeHttpError = (error: HttpError) => {
  const { baseURL, url, params, method } = error.request;
  let host: string | undefined;
  let path: string | undefined;
  try {
    const absolute = /^https?:\/\//i.test(url)
      ? url
      : baseURL
        ? `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`
        : url;
    const parsed = new URL(absolute);
    host = parsed.host;
    path = parsed.pathname;
  } catch {
    host = undefined;
    path = url;
  }

  return {
    message: error.message,
    request: { method, host, path },
    response: {
      status: error.response?.status,
      statusText: error.response?.statusText,
      baseUrl: baseURL,
      url,
      params,
    },
  };
};
