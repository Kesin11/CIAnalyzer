import axios, { AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'

export type Artifact = {
  path: string
  data: ArrayBuffer
}

export type CustomReportArtifact = Map<string, Artifact[]>

export const createAxios = (config: AxiosRequestConfig) => {
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

  if (process.env['CI_ANALYZER_DEBUG']) {
    axiosInstance.interceptors.request.use(axiosRequestLogger)
  }
  return axiosInstance
}

const axiosRequestLogger = (req: AxiosRequestConfig) => {
  console.debug(`${req.method?.toUpperCase()} ${req.url}`)
  console.debug('request', {
    method: req.method?.toUpperCase(),
    baseUrl: req.baseURL,
    url: req.url,
    params: req.params,
  })
  return req
}
