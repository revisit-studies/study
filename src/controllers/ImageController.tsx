import { Image } from '@mantine/core';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';

export function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const url = useMemo(() => {
    if (templatedPath === undefined) {
      return undefined;
    }
    if (templatedPath.startsWith('http')) {
      return templatedPath;
    }
    return `${PREFIX}${templatedPath}`;
  }, [templatedPath]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    // While the path is templated inside a dynamic block, url is undefined until the block's
    // current iteration resolves — don't fetch an asset built from the wrong iteration.
    if (url === undefined) {
      setLoading(true);
      setAssetFound(false);
      setLoadedUrl(undefined);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setAssetFound(false);
    setLoadedUrl(undefined);

    async function fetchImage(assetUrl: string) {
      try {
        let asset = await getStaticAssetByPath(assetUrl);
        asset = asset?.includes('File not found') ? undefined : asset;
        if (cancelled) return;
        setAssetFound(!!asset);
        setLoadedUrl(assetUrl);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setAssetFound(false);
        setLoadedUrl(assetUrl);
        setLoading(false);
      }
    }

    fetchImage(url);
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (url === undefined || templatedPath === undefined) {
    return null;
  }

  const currentUrlLoaded = loadedUrl === url;

  return loading || !currentUrlLoaded
    ? <Image mx="auto" src={url} />
    : assetFound
      ? <Image mx="auto" src={url} />
      : <ResourceNotFound path={templatedPath} />;
}
