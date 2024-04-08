import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ConfigSwitcher from './components/ConfigSwitcher';
import { Shell } from './components/Shell';
import { parseGlobalConfig, parseStudyConfig } from './parser/parser';
import { GlobalConfig, Nullable, StudyConfig } from './parser/types';
import { AnalysisInterface } from './analysis/AnalysisInterface';
import { PREFIX } from './utils/Prefix';
import { ProtectedRoute, User } from './ProtectedRoute';
import { Login } from './Login';
import { StorageEngine } from './storage/engines/StorageEngine';

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

export function GlobalConfigParser({ storageEngine } : { storageEngine:StorageEngine|undefined }) {
  const [globalConfig, setGlobalConfig] = useState<Nullable<GlobalConfig>>(null);
  const [studyConfigs, setStudyConfigs] = useState<Record<string, StudyConfig>>({});

  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [user, setUser] = useState<User|undefined>(undefined);

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
      <Routes>
        <Route path="/" element={<ProtectedRoute user={user} isAuth={isAuth} />}>
          <Route
            path="/"
            element={(
              <ConfigSwitcher
                globalConfig={globalConfig}
                studyConfigs={studyConfigs}
              />
            )}
          />
        </Route>
        <Route
          path="/:studyId/*"
          element={<Shell globalConfig={globalConfig} />}
        />

        <Route
          path="/analysis/:page"
          element={<AnalysisInterface globalConfig={globalConfig} />}
        />
        <Route
          path="/login"
          element={(
            <Login
              storageEngine={storageEngine}
              user={user}
              setUser={setUser}
              isAuth={isAuth}
              setIsAuth={setIsAuth}
            />
          )}
        />
      </Routes>
    </BrowserRouter>
  ) : null;
}
