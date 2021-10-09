import axios, { AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import path from 'path'
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
  axiosInstance.interceptors.response.use((response) => {
      return response
    }, (error) => {
      if(axios.isAxiosError(error)) {
        logger.error({
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          method: error.request?.method,
          baseUrl: error.response?.config.baseURL,
          url: error.response?.config.url,
          params: error.response?.config.params
        })
      }
    return Promise.reject(error)
  })
  return axiosInstance
}

