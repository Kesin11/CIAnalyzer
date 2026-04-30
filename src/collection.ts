type ValueSelector<T, V> = keyof T | ((item: T) => V);

function getValue<T, V>(item: T, selector: ValueSelector<T, V>): V {
  if (typeof selector === "function") return selector(item);
  return item[selector] as V;
}

function toComparable(value: number | string | Date): number | string {
  if (value instanceof Date) return value.getTime();
  return value;
}

export function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

export function sumBy<T>(
  items: readonly T[],
  selector: ValueSelector<T, number | null | undefined>,
): number {
  return items.reduce((sum, item) => sum + (getValue(item, selector) ?? 0), 0);
}

export function min<T extends number | Date>(
  items: readonly T[],
): T | undefined {
  return minBy(items, (item) => item);
}

export function max<T extends number | Date>(
  items: readonly T[],
): T | undefined {
  return maxBy(items, (item) => item);
}

export function minBy<T, V extends number | string | Date>(
  items: readonly T[],
  selector: ValueSelector<T, V>,
): T | undefined {
  let selected: T | undefined;
  let selectedValue: number | string | undefined;

  for (const item of items) {
    const value = toComparable(getValue(item, selector));

    if (selectedValue === undefined) {
      selected = item;
      selectedValue = value;
      continue;
    }

    if (value < selectedValue) {
      selected = item;
      selectedValue = value;
    }
  }

  return selected;
}

export function maxBy<T, V extends number | string | Date>(
  items: readonly T[],
  selector: ValueSelector<T, V>,
): T | undefined {
  let selected: T | undefined;
  let selectedValue: number | string | undefined;

  for (const item of items) {
    const value = toComparable(getValue(item, selector));

    if (selectedValue === undefined) {
      selected = item;
      selectedValue = value;
      continue;
    }

    if (value > selectedValue) {
      selected = item;
      selectedValue = value;
    }
  }

  return selected;
}

export function sortBy<T, V extends number | string | Date>(
  items: readonly T[],
  selector: ValueSelector<T, V>,
): T[] {
  return [...items].sort((a, b) => {
    const aValue = toComparable(getValue(a, selector));
    const bValue = toComparable(getValue(b, selector));
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
    return 0;
  });
}

export function groupBy<T>(
  items: readonly T[],
  selector: ValueSelector<T, PropertyKey>,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const key = String(getValue(item, selector));
    groups[key] ??= [];
    groups[key].push(item);
  }

  return groups;
}

export function dropWhile<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): T[] {
  const index = items.findIndex((item) => !predicate(item));
  return index === -1 ? [] : items.slice(index);
}

export function takeWhile<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): T[] {
  const index = items.findIndex((item) => !predicate(item));
  return index === -1 ? [...items] : items.slice(0, index);
}

export function round(value: number, precision = 0): number {
  return Number(`${Math.round(Number(`${value}e${precision}`))}e-${precision}`);
}
