declare module "axios-concurrency" {
  import { Axios } from "axios"

  export function ConcurrencyManager(axios: Axios, MAX_CONCURRENT?: number): Instance
  type Instance = {
    detach: () => void
  }
}