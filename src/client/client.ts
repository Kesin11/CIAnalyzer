import axios, { AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import { ConcurrencyManager } from 'axios-concurrency'
import http from 'http'
import https from 'https'
import { Logger } from 'tslog'
import { ArgumentOptions } from '../arg_options'
import { summarizeAxiosError } from '../error'

export type Artifact = {
  path: string
  data: ArrayBuffer
}

export type CustomReportArtifact = Map<string, Artifact[]>

export const createAxios = (logger: Logger<unknown>, options: ArgumentOptions, config: AxiosRequestConfig) => {
  const axiosInstance = axios.create({
    // Default parameters
    timeout: 5000,
    httpAgent: (options.keepAlive) ? new http.Agent({ keepAlive: true }) : undefined,
    httpsAgent:(options.keepAlive) ? new https.Agent({ keepAlive: true }) : undefined,

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
        logger.error(summarizeAxiosError(error))
      }
    return Promise.reject(error)
  })

  if (options.maxConcurrentRequests) {
    ConcurrencyManager(axiosInstance, options.maxConcurrentRequests)
  }

  return axiosInstance
}

