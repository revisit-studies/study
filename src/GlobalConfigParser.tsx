import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ModalsProvider } from '@mantine/modals';
import { AppShell } from '@mantine/core';
import { ConfigSwitcher } from './components/ConfigSwitcher';
import { Shell } from './components/Shell';
import { parseGlobalConfig } from './parser/parser';
import {
  GlobalConfig, Nullable, ParsedConfig, StudyConfig,
} from './parser/types';
import { StudyAnalysisTabs } from './analysis/individualStudy/StudyAnalysisTabs';
import { PREFIX } from './utils/Prefix';
import { ProtectedRoute } from './ProtectedRoute';
import { Login } from './Login';
import { AuthProvider } from './store/hooks/useAuth';
import { GlobalSettings } from './components/settings/GlobalSettings';
import { NavigateWithParams } from './utils/NavigateWithParams';
import { AppHeader } from './analysis/interface/AppHeader';
import { fetchStudyConfigs } from './utils/fetchConfig';
import { initializeStorageEngine } from './storage/initialize';
import { useStorageEngine } from './storage/storageEngineHooks';
import { PageTitle } from './utils/PageTitle';
import { isCloudStorageEngine } from './storage/engines/utils';

async function fetchGlobalConfigArray() {
  console.warn('[ReVISit][GlobalConfig] Fetching global.json', {
    url: `${PREFIX}global.json`,
    prod: import.meta.env.PROD,
  });
  const globalFile = await fetch(`${PREFIX}global.json`);
  console.warn('[ReVISit][GlobalConfig] global.json response received', {
    ok: globalFile.ok,
    status: globalFile.status,
    statusText: globalFile.statusText,
  });
  const configs = await globalFile.text();
  const parsedConfig = parseGlobalConfig(configs);
  console.warn('[ReVISit][GlobalConfig] Parsed global config', {
    configCount: parsedConfig.configsList.length,
  });

  // Hide test studies in production to avoid loading intentionally broken test configs.
  if (!import.meta.env.PROD) {
    return parsedConfig;
  }

  return {
    ...parsedConfig,
    configsList: parsedConfig.configsList.filter((configId) => !parsedConfig.configs[configId]?.test),
  };
}

export function GlobalConfigParser() {
  const [globalConfig, setGlobalConfig] = useState<Nullable<GlobalConfig>>(null);
  const [studyConfigs, setStudyConfigs] = useState<Record<string, ParsedConfig<StudyConfig> | null>>({});

  useEffect(() => {
    async function fetchData() {
      if (globalConfig) {
        console.warn('[ReVISit][GlobalConfig] Fetching study configs', {
          studyCount: globalConfig.configsList.length,
        });
        setStudyConfigs(await fetchStudyConfigs(globalConfig));
        console.warn('[ReVISit][GlobalConfig] Study configs fetched');
      }
    }
    fetchData();
  }, [globalConfig]);

  useEffect(() => {
    if (globalConfig) return;

    console.warn('[ReVISit][GlobalConfig] Starting initial global config load');
    fetchGlobalConfigArray().then((gc) => {
      console.warn('[ReVISit][GlobalConfig] Initial global config load complete');
      setGlobalConfig(gc);
    }).catch((error) => {
      console.error('[ReVISit][GlobalConfig] Initial global config load failed', error);
    });
  }, [globalConfig]);

  // Initialize storage engine
  const { storageEngine, setStorageEngine } = useStorageEngine();
  useEffect(() => {
    if (storageEngine !== undefined) return;

    async function fn() {
      console.warn('[ReVISit][StorageInit] Starting storage engine initialization');
      const _storageEngine = await initializeStorageEngine();
      console.warn('[ReVISit][StorageInit] Storage engine initialization complete', {
        engine: _storageEngine?.getEngine?.(),
      });
      setStorageEngine(_storageEngine);
    }
    fn().catch((error) => {
      console.error('[ReVISit][StorageInit] Storage engine initialization failed', error);
    });
  }, [setStorageEngine, storageEngine]);

  const analysisProtectedCallback = async (studyId:string) => {
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      const modes = await storageEngine.getModes(studyId);
      if (modes.analyticsInterfacePubliclyAccessible) {
        // If accessible, disable
        return false;
      }
      // If not accessible, enable protection
      return true;
    }
    return false;
  };

  return globalConfig ? (
    <BrowserRouter basename={PREFIX}>
      <AuthProvider>
        <ModalsProvider>
          <Routes>
            <Route
              path="/"
              element={(
                <>
                  <PageTitle title="ReVISit | Home" />
                  <AppShell
                    padding="md"
                    header={{ height: 70 }}
                  >
                    <AppHeader studyIds={globalConfig.configsList} />
                    <ConfigSwitcher
                      globalConfig={globalConfig}
                      studyConfigs={studyConfigs}
                    />
                  </AppShell>
                </>
            )}
            />
            <Route
              path="/:studyId/*"
              element={(
                <>
                  <PageTitle title="ReVISit | Study" />
                  <Shell globalConfig={globalConfig} />
                </>
                )}
            />
            <Route
              path="/analysis/stats/:studyId/:analysisTab/:trialId?"
              element={(
                <>
                  <PageTitle title="ReVISit | Analysis" />
                  <ProtectedRoute paramToCheck="studyId" paramCallback={analysisProtectedCallback}>
                    <AppShell
                      padding="md"
                      header={{ height: 70 }}
                    >
                      <StudyAnalysisTabs
                        globalConfig={globalConfig}
                      />
                    </AppShell>
                  </ProtectedRoute>
                </>
            )}
            />
            <Route
              path="/analysis/stats/:studyId"
              element={<NavigateWithParams to="./summary" replace />}
            />
            <Route
              path="/settings"
              element={(
                <ProtectedRoute>
                  <PageTitle title="ReVISit | Settings" />
                  <AppShell
                    padding="md"
                    header={{ height: 70 }}
                  >
                    <AppHeader studyIds={globalConfig.configsList} />
                    <AppShell.Main>
                      <GlobalSettings />
                    </AppShell.Main>
                  </AppShell>
                </ProtectedRoute>
            )}
            />
            <Route
              path="/login"
              element={(
                <>
                  <PageTitle title="ReVISit | Login" />
                  <AppShell
                    padding="md"
                    header={{ height: 70 }}
                  >
                    <AppHeader studyIds={globalConfig.configsList} />

                    <AppShell.Main>
                      <Login />
                    </AppShell.Main>
                  </AppShell>
                </>
            )}
            />
          </Routes>
        </ModalsProvider>
      </AuthProvider>
    </BrowserRouter>
  ) : null;
}
