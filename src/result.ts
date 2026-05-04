export type Result<T, E> = Success<T, E> | Failure<T, E>;
export const success = <T, E>(value: T): Success<T, E> => new Success(value);
export const failure = <T, E>(value: E): Failure<T, E> => new Failure(value);

export class Success<T, E> {
  type = "success" as const;
  readonly value: T;
  constructor(value: T) {
    this.value = value;
  }
  isSuccess(): this is Success<T, E> {
    return true;
  }
  isFailure(): this is Failure<T, E> {
    return false;
  }
}

export class Failure<T, E> {
  type = "failure" as const;
  readonly value: E;
  constructor(value: E) {
    this.value = value;
  }
  isSuccess(): this is Success<T, E> {
    return false;
  }
  isFailure(): this is Failure<T, E> {
    return true;
  }
}
