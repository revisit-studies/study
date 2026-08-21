import { useCallback, useEffect, useState } from 'react';
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
import { shouldProtectAnalysisRoute } from './utils/analysisRouteAccess';
import { StartupErrorScreen } from './components/StartupErrorScreen';

async function fetchGlobalConfigArray() {
  const globalFile = await fetch(`${PREFIX}global.json`);
  const configs = await globalFile.text();
  return parseGlobalConfig(configs);
}

function HomeRoute({
  globalConfig,
  onStartupError,
}: {
  globalConfig: GlobalConfig;
  onStartupError: (error: unknown) => void;
}) {
  const [studyConfigs, setStudyConfigs] = useState<Record<string, ParsedConfig<StudyConfig> | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchData(currentGlobalConfig: GlobalConfig) {
      const configs = await fetchStudyConfigs(currentGlobalConfig);
      if (!cancelled) {
        setStudyConfigs(configs);
      }
    }

    fetchData(globalConfig).catch((error) => {
      console.error('Error loading study configs:', error);
      if (!cancelled) {
        onStartupError(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [globalConfig, onStartupError]);

  return (
    <>
      <PageTitle title="ReVISit | Home" />
      <AppShell
        padding="md"
        header={{ height: 70 }}
      >
        <AppHeader studyIds={globalConfig.configsList} studyConfigs={studyConfigs} />
        <ConfigSwitcher
          globalConfig={globalConfig}
          studyConfigs={studyConfigs}
        />
      </AppShell>
    </>
  );
}

export function GlobalConfigParser() {
  const [globalConfig, setGlobalConfig] = useState<Nullable<GlobalConfig>>(null);
  const [startupError, setStartupError] = useState<{ error: unknown } | null>(null);
  const handleStartupError = useCallback((error: unknown) => {
    setStartupError({ error });
  }, []);

  useEffect(() => {
    if (globalConfig) {
      return undefined;
    }

    let cancelled = false;

    fetchGlobalConfigArray()
      .then((gc) => {
        if (!cancelled) {
          setGlobalConfig(gc);
        }
      })
      .catch((error) => {
        console.error('Error loading global config:', error);
        if (!cancelled) {
          setStartupError({ error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [globalConfig]);

  // Initialize storage engine
  const { storageEngine, setStorageEngine } = useStorageEngine();
  useEffect(() => {
    if (storageEngine !== undefined) {
      return undefined;
    }

    let cancelled = false;

    initializeStorageEngine()
      .then((_storageEngine) => {
        if (!cancelled) {
          setStorageEngine(_storageEngine);
        }
      })
      .catch((error) => {
        console.error('Error initializing storage engine:', error);
        if (!cancelled) {
          setStartupError({ error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setStorageEngine, storageEngine]);

  const analysisProtectedCallback = async (studyId: string) => {
    if (!globalConfig) {
      return false;
    }

    return shouldProtectAnalysisRoute(studyId, globalConfig, storageEngine);
  };

  if (startupError) {
    return <StartupErrorScreen error={startupError.error} />;
  }

  return globalConfig ? (
    <BrowserRouter basename={PREFIX}>
      <AuthProvider>
        <ModalsProvider>
          <Routes>
            <Route
              path="/"
              element={(
                <HomeRoute
                  globalConfig={globalConfig}
                  onStartupError={handleStartupError}
                />
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
              path="/analysis"
              element={<NavigateWithParams to="/analysis/stats/" replace />}
            />
            <Route
              path="/analysis/stats"
              element={(
                <>
                  <PageTitle title="ReVISit | Analysis" />
                  <AppShell
                    padding="md"
                    header={{ height: 70 }}
                  >
                    <StudyAnalysisTabs
                      globalConfig={globalConfig}
                    />
                  </AppShell>
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
