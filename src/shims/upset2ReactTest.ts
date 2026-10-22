// Unit tests discover study assets without rendering the UpSet example.
export const getActions = () => ({});
export const initializeProvenanceTracking = (state: unknown) => ({ graph: { backend: state } });

export function process<T>(data: T): T {
  return data;
}

export function Upset() {
  return null;
}
