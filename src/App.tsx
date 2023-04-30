import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import ConfigSwitcher from './components/ConfigSwitcher';
import { Shell } from './components/Shell';
import TrainingController from './controllers/TrainingController';
import { parseGlobalConfig } from './parser/parser';
import { GlobalConfig, Nullable } from './parser/types';

export const PREFIX = import.meta.env.PROD
  ? import.meta.env.VITE_BASE_PATH
  : '/';

async function fetchGlobalConfigArray() {
  const globalFile = await fetch(`${PREFIX}configs/global.hjson`);
  const configs = await globalFile.text();

  return parseGlobalConfig(configs);
}


const elements: Record<StudyComponent['type'], ReactNode> = {
  consent: (
    <>
      <Consent />
    </>
  ),
  training: (
    <>
      <TrainingController />
      <NextButton />
    </>
  ),
  practice:  <TrialPracticeController />,
  'attentionTest': (
    <>
      <div>attention test component goes here</div>
      <NextButton />
    </>
  ),
  trials: <TrialPracticeController />,
  survey: (
    <>
     <SurveyController />
    </>
  ),
  end: <StudyEnd />,
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
    globalConfig ? (
      <BrowserRouter basename={PREFIX}>
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
    ) : null
  );
}

function ShellWrapper(props: any) {
  const { studyId } = useParams();

  return <Shell key={studyId} {...props} />;
}
