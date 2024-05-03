export interface Store {
  read<T extends AnyObject>(): Promise<T>;
  write<T extends AnyObject>(newStore: T): Promise<T>;
}
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyObject = { [key: string]: any };
