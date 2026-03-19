import { ModuleNamespace } from 'vite/types/hot';

const publicModules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function getPublicModule(path: string): ModuleNamespace | null {
  const publicPath = `../public/${path}`;

  return publicPath in publicModules ? publicModules[publicPath] as ModuleNamespace : null;
}
