import { AxiosRequestConfig } from "axios"

export const axiosRequestLogger = (req: AxiosRequestConfig) => {
  console.debug(`${req.method?.toUpperCase()} ${req.url}`)
  console.debug('request', {
    method: req.method?.toUpperCase(),
    baseUrl: req.baseURL,
    url: req.url,
    params: req.params,
  })
  return req
}
