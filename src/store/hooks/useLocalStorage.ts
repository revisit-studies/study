import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLocalStorage(keyName:string, defaultValue:any) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const value = window.localStorage.getItem(keyName);
      if (value) {
        return JSON.parse(value);
      }
      window.localStorage.setItem(keyName, JSON.stringify(defaultValue));
      return defaultValue;
    } catch (err) {
      return defaultValue;
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setValue = (newValue:any) => {
    try {
      window.localStorage.setItem(keyName, JSON.stringify(newValue));
    } catch (err) {
      console.error(err);
    }
    setStoredValue(newValue);
  };
  return [storedValue, setValue];
}
