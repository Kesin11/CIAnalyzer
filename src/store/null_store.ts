import type { Logger } from "tslog";
import type { Store, AnyObject } from "./store.js";

export class NullStore implements Store {
  #logger: Logger<unknown>;

  constructor(logger: Logger<unknown>) {
    this.#logger = logger.getSubLogger({ name: NullStore.name });
  }

  async read<T extends AnyObject>(): Promise<T> {
    this.#logger.info("Detect DEBUG mode, nothing is used instead.");
    return {} as T;
  }

  async write<T extends AnyObject>(newStore: T): Promise<T> {
    this.#logger.info("Detect DEBUG mode, skip saving lastRun.");
    return {} as T;
  }
}
