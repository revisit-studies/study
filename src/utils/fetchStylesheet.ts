import { useEffect } from 'react';
import { PREFIX } from './Prefix';

export const useFetchStylesheet = (stylesheetPath: string | undefined): void => {
  useEffect(() => {
    if (!stylesheetPath) {
      return () => {};
    }

    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = `${PREFIX}${stylesheetPath}`;
    link.dataset.stylesheetPath = stylesheetPath;

    document.head.appendChild(link);

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [stylesheetPath]);
};
