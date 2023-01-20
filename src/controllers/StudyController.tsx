import { useMemo, useState } from 'react';
import { Button } from '@mantine/core';

import { parseStudyConfig } from '../parser/parser';

import Consent from '../components/Consent';


async function fetchStudyConfig(configLocation: string, setStudyConfig: React.Dispatch<React.SetStateAction<string | null>>) {
  const config = await (await fetch(configLocation)).text();
  setStudyConfig(JSON.stringify(parseStudyConfig(config)))
}

export default function StudyController() {
  const [studyConfig, setStudyConfig] = useState<string | null>(null);
  fetchStudyConfig('/src/configs/cleveland-config.hjson', setStudyConfig);

  const studyFlow = ['consent1', 'practice1', 'trials1', 'survey1', 'practice2', 'trials2', 'survey2'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStudySection = useMemo(() => currentIndex < studyFlow.length ? studyFlow[currentIndex] : 'endOfStudy');
  function goToNextSection() {
    setCurrentIndex(currentIndex + 1);
  }


  return (
    <div>
      <div>current study config {studyConfig}</div>
      { currentStudySection.includes('consent') && <Consent goToNextSection={ goToNextSection }/> }
      { currentStudySection.includes('practice') && <div>practice component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('trials') && <div>trials component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('survey') && <div>survey component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('endOfStudy') && <div>Thanks for completing the study</div> }
    </div>
  );
}
