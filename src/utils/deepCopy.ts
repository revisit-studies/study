export function deepCopy<T>(obj: T): T {
  return structuredClone(obj);
}
