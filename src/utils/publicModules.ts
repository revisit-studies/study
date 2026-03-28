import {
  useEffect, useState,
} from 'react';

const publicModules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
);

const publicModuleCache = new Map<string, Promise<unknown | null>>();

function getPublicModulePath(path: string) {
  return `../public/${path}`;
}

export async function loadPublicModule(path: string): Promise<unknown | null> {
  const publicPath = getPublicModulePath(path);
  const moduleLoader = publicModules[publicPath];

  if (!moduleLoader) {
    return null;
  }

  const cachedModule = publicModuleCache.get(publicPath);
  if (cachedModule) {
    return cachedModule;
  }

  const modulePromise = moduleLoader().then((module) => module as unknown);
  publicModuleCache.set(publicPath, modulePromise);

  return modulePromise;
}

export function usePublicModule<T>(path: string) {
  const [module, setModule] = useState<T | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    setModule(null);
    setLoadFailed(false);

    loadPublicModule(path)
      .then((loadedModule) => {
        if (!isMounted || !loadedModule) {
          if (isMounted && !loadedModule) {
            setLoadFailed(true);
          }
          return;
        }

        setModule(loadedModule as T);
      })
      .catch(() => {
        if (isMounted) {
          setLoadFailed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [path]);

  return {
    module,
    loadFailed,
  };
}
