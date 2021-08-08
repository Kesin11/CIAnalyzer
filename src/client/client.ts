import axios, { AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import { Logger } from 'tslog'

export type Artifact = {
  path: string
  data: ArrayBuffer
}

export type CustomReportArtifact = Map<string, Artifact[]>

export const createAxios = (logger: Logger, config: AxiosRequestConfig) => {
  const axiosInstance = axios.create({
    // Default parameters
    timeout: 5000,

    // Overwrite parameters
    ...config
  });
  axiosRetry(axiosInstance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay
  })

  const axiosRequestLogger = (req: AxiosRequestConfig) => {
    logger.debug(`${req.method?.toUpperCase()} ${req.url}`)
    logger.debug('request', {
      method: req.method?.toUpperCase(),
      baseUrl: req.baseURL,
      url: req.url,
      params: req.params,
    })
    return req
  }

  axiosInstance.interceptors.request.use(axiosRequestLogger)
  return axiosInstance
}

