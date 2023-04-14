import { useEffect, useMemo, useState } from 'react';
import { Button } from '@mantine/core';

import { parseStudyConfig } from '../parser/parser';
import { ConsentComponent, StudyConfig, TrialsComponent } from '../parser/types';

import Consent from '../components/Consent';
import TrialController from './TrialController';

import { useSelector, useDispatch } from 'react-redux'
import { nextSection, trrack, type RootState } from '../store/'


async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

export default function StudyController() {
  const dispatch = useDispatch()

  // Get the whole study config
  const [studyConfig, setStudyConfig] = useState<StudyConfig | null>(null);
  useEffect(() => {
    const fetchData = async () => setStudyConfig(await fetchStudyConfig('/src/configs/config-cleveland.hjson'));
    fetchData();
  }, [])

  const studySequence = useMemo(
    () => studyConfig !== null ? studyConfig.sequence : [],
    [studyConfig],
  )

  // Get the current study section and config for that section
  // const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndex = useSelector((state: RootState) => state.study.currentIndex)
  const currentStudySection = useMemo(
    () => currentIndex < studySequence.length ? studySequence[currentIndex] : 'endOfStudy',
    [currentIndex, studySequence],
  );
  const currentStudySectionConfig = useMemo(
    () => studyConfig !== null ? studyConfig.components[currentStudySection] : null,
    [studyConfig, currentStudySection],
  );

  // A helper function that will allow the components to move us to the next section
  function goToNextSection() {
    dispatch(nextSection());
  }

  function goToEnd() {
    setCurrentIndex(studySequence.length);
  }

  return (
    <div>
      { currentStudySection.includes('consent') && currentStudySectionConfig !== null && <Consent goToNextSection={ goToNextSection } goToEnd={ goToEnd } currentStudySectionConfig={ currentStudySectionConfig as ConsentComponent } /> }
      { currentStudySection.includes('training') && <div>training component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('practice') && <div>practice component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('attention') && <div>attention component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('trials') && <div><TrialController goToNextSection={goToNextSection} currentStudySectionConfig={currentStudySectionConfig as TrialsComponent} /></div> }
      { currentStudySection.includes('survey') && <div>survey component here <Button onClick={goToNextSection}>Accept</Button></div> }
      { currentStudySection.includes('endOfStudy') && <div>Thanks for completing the study</div> }
    </div>
  );
}
