import { useCallback, useEffect, useState } from 'react';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreActions, useStoreDispatch } from '../store';
import { useIsAnalysis } from './useIsAnalysis';
import { AssetStatus } from '../types';
import { AsyncResourceStatus } from './useAsyncResource';

export function useAssetStatus(status: AssetStatus) {
  const identifier = useCurrentIdentifier();
  const storeDispatch = useStoreDispatch();
  const { setAssetStatus } = useStoreActions();
  const isAnalysis = useIsAnalysis();

  useEffect(() => {
    if (isAnalysis) return undefined;
    storeDispatch(setAssetStatus({ identifier, status }));
    return () => { storeDispatch(setAssetStatus({ identifier, status: 'loading' })); };
  }, [status, identifier, isAnalysis, setAssetStatus, storeDispatch]);
}

export function getAssetStatus(resourceStatus: AsyncResourceStatus, loadStatus: AssetStatus = 'ready'): AssetStatus {
  if (resourceStatus === 'missing' || resourceStatus === 'error' || loadStatus === 'error') return 'error';
  return resourceStatus === 'success' ? loadStatus : 'loading';
}

export function useAssetLoadStatus<T>(key: T) {
  const [result, setResult] = useState<{ key: T; status: AssetStatus }>({ key, status: 'loading' });
  // Reset before children mount; an effect could overwrite their ready callback.
  if (result.key !== key) {
    setResult({ key, status: 'loading' });
  }
  const onReady = useCallback(() => {
    setResult((current) => (current.key === key ? { key, status: 'ready' } : current));
  }, [key]);
  const onError = useCallback(() => {
    setResult((current) => (current.key === key ? { key, status: 'error' } : current));
  }, [key]);
  return { status: result.key === key ? result.status : 'loading', onReady, onError };
}
