import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import ConfigSwitcher from './components/ConfigSwitcher';
import { Shell } from './components/Shell';

import { parseGlobalConfig } from './parser/parser';
import { GlobalConfig } from './parser/types';
import { Nullable } from './utils/nullable';

async function fetchGlobalConfigArray() {
  const globalFile = await fetch('/configs/global.hjson');
  const configs = await globalFile.text();

  return parseGlobalConfig(configs);
}

export type StudyConfigJSON = {
  title: string;
  path: string;
  url: string;
  description: string;
};

export default function AppShellDemo() {
  const [globalConfig, setGlobalConfig] =
    useState<Nullable<GlobalConfig>>(null);

  useEffect(() => {
    if (globalConfig) return;

    fetchGlobalConfigArray().then((gc) => {
      setGlobalConfig(gc);
    });
  }, [globalConfig]);

  return (
    globalConfig && (
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<ConfigSwitcher globalConfig={globalConfig} />}
          />
          <Route
            path="/:studyId/*"
            element={<ShellWrapper globalConfig={globalConfig} />}
          />
        </Routes>
      </BrowserRouter>
    )
  );
}

function ShellWrapper(props: any) {
  const { studyId } = useParams();

  return <Shell key={studyId} {...props} />;
}
