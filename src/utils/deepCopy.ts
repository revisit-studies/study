export function deepCopy<T>(obj: T): T {
  try {
    return JSON.parse(
      JSON.stringify(obj, (_, v) => (v !== undefined ? v : null))
    );
  } catch (e) {
    console.log(obj);

    throw new Error('');
  }
}
