export interface Store {
  read<T extends AnyObject>(): Promise<T>
  write<T extends AnyObject>(newStore: T): Promise<T>
}
export type AnyObject = {[key: string]: any}
