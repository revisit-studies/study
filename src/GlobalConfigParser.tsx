import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ConfigSwitcher from './components/ConfigSwitcher';
import { Shell } from './components/Shell';
import { parseGlobalConfig, parseStudyConfig } from './parser/parser';
import { GlobalConfig, Nullable, StudyConfig } from './parser/types';
import { AnalysisInterface } from './analysis/AnalysisInterface';
import { PREFIX } from './utils/Prefix';
import { ProtectedRoute } from './ProtectedRoute';
import { Login } from './Login';
import { AuthProvider } from './store/hooks/useAuth';

async function fetchGlobalConfigArray() {
  const globalFile = await fetch(`${PREFIX}global.json`);
  const configs = await globalFile.text();
  return parseGlobalConfig(configs);
}

async function fetchStudyConfigs(globalConfig: GlobalConfig) {
  const studyConfigs: { [key: string]: StudyConfig } = {};
  const urls = globalConfig.configsList.map(
    (configId) => `${PREFIX}${globalConfig.configs[configId].path}`,
  );

  const res = await Promise.all(urls.map((u) => fetch(u)))
    .then((responses) => Promise.all(responses.map((_res) => _res.text())))
    .then((responses) => Promise.all(responses.map((_res, idx) => parseStudyConfig(_res, globalConfig.configsList[idx]))));

  globalConfig.configsList.forEach((configId, idx) => {
    studyConfigs[configId] = res[idx];
  });
  return studyConfigs;
}

export function GlobalConfigParser() {
  const [globalConfig, setGlobalConfig] = useState<Nullable<GlobalConfig>>(null);
  const [studyConfigs, setStudyConfigs] = useState<Record<string, StudyConfig>>({});

  useEffect(() => {
    async function fetchData() {
      if (globalConfig) {
        setStudyConfigs(await fetchStudyConfigs(globalConfig));
      }
    }
    fetchData();
  }, [globalConfig]);

  useEffect(() => {
    if (globalConfig) return;

    fetchGlobalConfigArray().then((gc) => {
      setGlobalConfig(gc);
    });
  }, [globalConfig]);

  return globalConfig ? (
    <BrowserRouter basename={PREFIX}>
      <AuthProvider globalConfig={globalConfig}>
        <Routes>
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <ConfigSwitcher
                  globalConfig={globalConfig}
                  studyConfigs={studyConfigs}
                />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/:studyId/*"
            element={<Shell globalConfig={globalConfig} />}
          />
          <Route
            path="/analysis/:page"
            element={(
              <ProtectedRoute>
                <AnalysisInterface
                  globalConfig={globalConfig}
                />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/login"
            element={(
              <Login />
            )}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  ) : null;
}
