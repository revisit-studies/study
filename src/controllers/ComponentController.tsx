import {
  Suspense, useEffect, useMemo, useRef, useState,
} from 'react';
import merge from 'lodash.merge';
import ResponseBlock from '../components/response/ResponseBlock';
import IframeController from './IframeController';
import ImageController from './ImageController';
import ReactComponentController from './ReactComponentController';
import MarkdownController from './MarkdownController';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
import { useStoredAnswer } from '../store/hooks/useStoredAnswer';
import ReactMarkdownWrapper from '../components/ReactMarkdownWrapper';
import { isInheritedComponent } from '../parser/utils';
import { IndividualComponent } from '../parser/types';
import { useDisableBrowserBack } from '../utils/useDisableBrowserBack';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StudyEnd } from '../components/StudyEnd';
import { TrainingFailed } from '../components/TrainingFailed';
import ResourceNotFound from '../ResourceNotFound';
import { TimedOut } from '../components/TimedOut';
import { findBlockForStep } from '../utils/getSequenceFlatMap';

// current active stimuli presented to the user
export default function ComponentController() {
  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent() || 'Notfound';
  const stepConfig = studyConfig.components[currentComponent];
  const { storageEngine } = useStorageEngine();

  const audioStream = useRef<MediaRecorder | null>(null);

  const [prevTrialName, setPrevTrialName] = useState<string | null>(null);

  const { setIsRecording } = useStoreActions();

  // If we have a trial, use that config to render the right component else use the step
  const status = useStoredAnswer();

  // Disable browser back button from all stimuli
  useDisableBrowserBack();

  // Check if we have issues connecting to the database, if so show alert modal
  const storeDispatch = useStoreDispatch();
  const { setAlertModal } = useStoreActions();
  useEffect(() => {
    if (storageEngine?.getEngine() !== import.meta.env.VITE_STORAGE_ENGINE) {
      storeDispatch(setAlertModal({
        show: true,
        message: `There was an issue connecting to the ${import.meta.env.VITE_STORAGE_ENGINE} database. This could be caused by a network issue or your adblocker. If you are using an adblocker, please disable it for this website and refresh.`,
      }));
    }
  }, [setAlertModal, storageEngine, storeDispatch]);

  useEffect(() => {
    if (!studyConfig || !studyConfig.recordStudyAudio || !storageEngine || storageEngine.getEngine() !== 'firebase') {
      return;
    }

    if (audioStream.current && prevTrialName) {
      // storageEngine.saveAudio(audioStream.current, prevTrialName);
    }

    if (audioStream.current) {
      audioStream.current.stream.getTracks().forEach((track) => { track.stop(); audioStream.current?.stream.removeTrack(track); });
      audioStream.current.stream.getAudioTracks().forEach((track) => { track.stop(); audioStream.current?.stream.removeTrack(track); });
      audioStream.current.stop();
      audioStream.current = null;

      // setAudioStream(null);
    }

    if ((stepConfig && stepConfig.recordAudio !== undefined && !stepConfig.recordAudio) || currentComponent === 'end') {
      setPrevTrialName(null);
      storeDispatch(setIsRecording(false));
    } else {
      navigator.mediaDevices.getUserMedia({
        audio: true,
      }).then((s) => {
        const recorder = new MediaRecorder(s);
        audioStream.current = recorder;

        // audioStream.current.start();

        storeDispatch(setIsRecording(true));

        // setPrevTrialName(`${currentComponent}_${currentStep}`);

        return recorder;
      });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, currentStep]);

  // Find current block, if it has an ID, add it as a participant tag
  const [blockForStep, setBlockForStep] = useState<string[]>([]);
  useEffect(() => {
    async function getBlockForStep() {
      const participantData = await storageEngine?.getParticipantData();
      if (participantData) {
        // Get all nested block IDs
        const blockIds = findBlockForStep(participantData.sequence, currentStep)?.map((block) => block.currentBlock.id).filter((blockId) => blockId !== undefined) as string[] | undefined || [];
        setBlockForStep(blockIds);
      }
    }
    getBlockForStep();
  }, [currentStep, storageEngine]);
  useEffect(() => {
    async function addParticipantTag() {
      if (blockForStep && storageEngine) {
        storageEngine.addParticipantTags(blockForStep);
      }
    }
    addParticipantTag();
  }, [blockForStep, storageEngine]);

  const currentConfig = useMemo(() => (currentComponent !== 'end' && isInheritedComponent(stepConfig) && studyConfig.baseComponents ? merge({}, studyConfig.baseComponents?.[stepConfig.baseComponent], stepConfig) as IndividualComponent : stepConfig as IndividualComponent), [stepConfig, studyConfig]);

  // We're not using hooks below here, so we can return early if we're at the end of the study.
  // This avoids issues with the component config being undefined for the end of the study.
  if (currentComponent === 'end') {
    return <StudyEnd />;
  }

  // Handle failed training
  if (currentComponent === '__trainingFailed') {
    return <TrainingFailed />;
  }

  // Handle timed out participants
  if (currentComponent === '__timedOut') {
    return <TimedOut />;
  }

  if (currentComponent === 'Notfound') {
    return <ResourceNotFound email={studyConfig.uiConfig.contactEmail} />;
  }

  const instruction = (currentConfig.instruction || '');
  const { instructionLocation } = currentConfig;
  const instructionInSideBar = studyConfig.uiConfig.sidebar && (instructionLocation === 'sidebar' || instructionLocation === undefined);

  return (
    <>
      {instructionLocation === 'aboveStimulus' && <ReactMarkdownWrapper text={instruction} />}
      <ResponseBlock
        key={`${currentStep}-above-response-block`}
        status={status}
        config={currentConfig}
        location="aboveStimulus"
      />

      <Suspense key={`${currentStep}-stimulus`} fallback={<div>Loading...</div>}>
        {currentConfig.type === 'markdown' && <MarkdownController currentConfig={currentConfig} />}
        {currentConfig.type === 'website' && <IframeController currentConfig={currentConfig} />}
        {currentConfig.type === 'image' && <ImageController currentConfig={currentConfig} />}
        {currentConfig.type === 'react-component' && <ReactComponentController currentConfig={currentConfig} />}
      </Suspense>

      {(instructionLocation === 'belowStimulus' || (instructionLocation === undefined && !instructionInSideBar)) && <ReactMarkdownWrapper text={instruction} />}
      <ResponseBlock
        key={`${currentStep}-below-response-block`}
        status={status}
        config={currentConfig}
        location="belowStimulus"
      />
    </>
  );
}
