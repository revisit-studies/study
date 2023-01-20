import { useEffect, useMemo, useState } from 'react';
import { Button } from '@mantine/core';

import { parseStudyConfig } from '../parser/parser';
import { StudyConfig } from '../parser/types';

import Consent from '../components/Consent';


async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

export default function StudyController() {
  const [studyConfig, setStudyConfig] = useState<StudyConfig | null>(null);
  useEffect(() => {
    const fetchData = async () => setStudyConfig(await fetchStudyConfig('/src/configs/config-demo.hjson'));
    fetchData();
  }, [])

  const studyFlow = useMemo(() => studyConfig !== null ? studyConfig.sequence : [])
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStudySection = useMemo(() => currentIndex < studyFlow.length ? studyFlow[currentIndex] : 'endOfStudy');
  function goToNextSection() {
    setCurrentIndex(currentIndex + 1);
  }


  return (
    <div>
      { currentStudySection.includes('consent') && <Consent goToNextSection={ goToNextSection }/> }
      { currentStudySection.includes('practice') && <div>practice component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('trials') && <div>trials component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('survey') && <div>survey component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('endOfStudy') && <div>Thanks for completing the study</div> }
    </div>
  );
}
