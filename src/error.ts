import type { AxiosError } from "axios";

export const summarizeAxiosError = (error: AxiosError) => {
  return {
    message: error.message,
    request: {
      method: error.request?.method ?? error.request?._currentRequest.method,
      host: error.request?.host ?? error.request?._currentRequest.host,
      path: error.request?.path ?? error.request?._currentRequest.path,
    },
    response: {
      status: error.response?.status,
      statusText: error.response?.statusText,
      baseUrl: error.response?.config.baseURL,
      url: error.response?.config.url,
      params: error.response?.config.params,
    },
  };
};
