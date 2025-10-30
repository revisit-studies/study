import {
  Suspense, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Box, Center, Loader, Text, Title,
} from '@mantine/core';
import { IconPlugConnectedX } from '@tabler/icons-react';
import { ResponseBlock } from '../components/response/ResponseBlock';
import { IframeController } from './IframeController';
import { ImageController } from './ImageController';
import { ReactComponentController } from './ReactComponentController';
import { MarkdownController } from './MarkdownController';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import {
  useCurrentComponent, useCurrentIdentifier, useCurrentStep, useStudyId,
} from '../routes/utils';
import { useStoredAnswer } from '../store/hooks/useStoredAnswer';
import { ReactMarkdownWrapper } from '../components/ReactMarkdownWrapper';
import { IndividualComponent } from '../parser/types';
import { useDisableBrowserBack } from '../utils/useDisableBrowserBack';
import { useStorageEngine } from '../storage/storageEngineHooks';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../store/store';
import { StudyEnd } from '../components/StudyEnd';
import { TrainingFailed } from '../components/TrainingFailed';
import { ResourceNotFound } from '../ResourceNotFound';
import { TimedOut } from '../components/TimedOut';
import { findBlockForStep } from '../utils/getSequenceFlatMap';
import { VegaController, VegaProvState } from './VegaController';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { VideoController } from './VideoController';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { useFetchStylesheet } from '../utils/fetchStylesheet';
import { ScreenRecordingReplay } from '../components/screenRecording/ScreenRecordingReplay';
import { useScreenRecordingContext } from '../store/hooks/useScreenRecording';
import { decryptIndex, encryptIndex } from '../utils/encryptDecryptIndex';
import { useRecordingConfig } from '../store/hooks/useRecordingConfig';

// current active stimuli presented to the user
export function ComponentController() {
  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const studyId = useStudyId();

  const stepConfig = studyConfig.components[currentComponent];
  const { storageEngine } = useStorageEngine();

  const answers = useStoreSelector((store) => store.answers);
  const audioStream = useRef<MediaRecorder | null>(null);
  const analysisCanPlayScreenRecording = useStoreSelector((state) => state.analysisCanPlayScreenRecording);

  const { setIsRecording, setAnalysisCanPlayScreenRecording } = useStoreActions();

  const analysisProvState = useStoreSelector((state) => state.analysisProvState.stimulus);

  const screenCaptureTrialName = useRef<string | null>(null);

  const identifier = useCurrentIdentifier();

  const navigate = useNavigate();

  const {
    studyHasScreenRecording, studyHasAudioRecording, currentComponentHasAudioRecording, currentComponentHasScreenRecording,
  } = useRecordingConfig();

  const {
    isMediaCapturing, stopScreenCapture, startScreenRecording, stopScreenRecording, combinedMediaRecorder: screenRecordingStream,
  } = useScreenRecordingContext();

  const isAnalysis = useIsAnalysis();

  // If we have a trial, use that config to render the right component else use the step
  const status = useStoredAnswer();
  const sequence = useStoreSelector((state) => state.sequence);
  const modes = useStoreSelector((state) => state.modes);

  const [searchParams] = useSearchParams();

  const storePartId = useStoreSelector((state) => state.participantId);
  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);

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

  // For study that does not involve screen recording
  useEffect(() => {
    if (!studyConfig || studyHasScreenRecording || !studyHasAudioRecording || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
      return;
    }

    if (audioStream.current) {
      audioStream.current.stream.getTracks().forEach((track) => { track.stop(); audioStream.current?.stream.removeTrack(track); });
      audioStream.current.stream.getAudioTracks().forEach((track) => { track.stop(); audioStream.current?.stream.removeTrack(track); });
      audioStream.current.stop();
      audioStream.current = null;
    }

    if ((stepConfig && !currentComponentHasAudioRecording) || currentComponent === 'end') {
      storeDispatch(setIsRecording(false));
    } else {
      navigator.mediaDevices.getUserMedia({
        audio: true,
      }).then((s) => {
        const recorder = new MediaRecorder(s);
        audioStream.current = recorder;

        let chunks : Blob[] = [];

        recorder.addEventListener('start', () => {
          chunks = [];
        });

        recorder.addEventListener('dataavailable', (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        });

        const trialName = identifier;
        recorder.addEventListener('stop', () => {
          const { mimeType } = recorder;
          const blob = new Blob(chunks, { type: mimeType });
          storageEngine?.saveAudioRecording(blob, trialName);
        });

        audioStream.current.start();
        storeDispatch(setIsRecording(true));
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording]);

  // For study involving screen recording
  useEffect(() => {
    if (!studyConfig || !(studyHasScreenRecording) || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
      return;
    }

    if (screenRecordingStream.current) {
      stopScreenRecording();
      screenCaptureTrialName.current = null;
    }

    if (currentComponent !== 'end' && isMediaCapturing && screenCaptureTrialName.current !== identifier && (currentComponentHasAudioRecording || currentComponentHasScreenRecording)) {
      screenCaptureTrialName.current = identifier;
      startScreenRecording(identifier);
    }

    if (currentComponent === 'end') {
      stopScreenCapture();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording, currentComponentHasScreenRecording, isMediaCapturing]);

  // Find current block, if it has an ID, add it as a participant tag
  const [blockForStep, setBlockForStep] = useState<string[]>([]);
  const prevBlockForStepRef = useRef<string[]>([]);
  useEffect(() => {
    if (isAnalysis) {
      return;
    }
    async function updateBlockForStep() {
      // Get all nested block IDs
      const blockIds = findBlockForStep(sequence, currentStep)
        ?.map((block) => block.currentBlock.id)
        .filter((blockId) => blockId !== undefined) as string[] | undefined || [];
      setBlockForStep(blockIds);
    }

    async function addParticipantTag() {
      const prevBlockForStep = prevBlockForStepRef.current;

      // Check if blockForStep has actually changed
      const hasChanged = JSON.stringify(prevBlockForStep) !== JSON.stringify(blockForStep);

      if (hasChanged && blockForStep.length > 0 && storageEngine) {
        await storageEngine.addParticipantTags(blockForStep);
      }

      // Update the ref with the current value
      prevBlockForStepRef.current = blockForStep;
    }

    updateBlockForStep().then(addParticipantTag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, storageEngine, sequence]);

  const currentIdentifier = useCurrentIdentifier();
  const currentConfig = useMemo(() => {
    const toReturn = currentComponent && currentComponent !== 'end' && !currentComponent.startsWith('__') && studyComponentToIndividualComponent(stepConfig, studyConfig) as IndividualComponent;
    if (typeof toReturn === 'object') {
      const funcParams = answers[currentIdentifier]?.parameters;
      const funcCorrectAnswer = answers[currentIdentifier]?.correctAnswer;

      return {
        ...toReturn,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: funcParams || (toReturn as any).parameters || {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        correctAnswer: funcCorrectAnswer || (toReturn as any).correctAnswer || undefined,
      };
    }
    return toReturn as unknown as IndividualComponent;
  }, [answers, currentComponent, currentIdentifier, stepConfig, studyConfig]);

  useEffect(() => {
    // Assume that screen recording video exists.
    // The value is set to false from ScreenRecordingReplay component if video starts after stimulus start time.
    storeDispatch(setAnalysisCanPlayScreenRecording(true));
  }, [currentStep, setAnalysisCanPlayScreenRecording, storeDispatch]);

  useFetchStylesheet(currentConfig?.stylesheetPath);

  const { funcIndex } = useParams();

  // Automatically forward a user to their last completed trial if they are returning to the study
  useEffect(() => {
    if (status && status.endTime > 0 && !isAnalysis && !modes.studyNavigatorEnabled && currentComponent !== 'end' && !currentComponent.startsWith('__') && typeof currentStep === 'number') {
      let lastAnsweredTrialOrder = '0';
      Object.values(answers).forEach((a) => {
        if (a.endTime > 0) {
          lastAnsweredTrialOrder = a.trialOrder;
        }
      });
      const [trialOrderIndex, trialOrderFuncIndex] = lastAnsweredTrialOrder.split('_');
      const indexNumber = Number(trialOrderIndex);
      const funcIndexNumber = trialOrderFuncIndex ? Number(trialOrderFuncIndex) : undefined;

      if (indexNumber > currentStep || (indexNumber === currentStep && funcIndexNumber !== undefined && funcIndex !== undefined && funcIndexNumber > Number(decryptIndex(funcIndex)))) {
        navigate(`/${studyId}/${encryptIndex(indexNumber)}${funcIndexNumber !== undefined ? `/${encryptIndex(funcIndexNumber)}` : ''}`);
      }
    }
  }, [answers, currentComponent, currentStep, funcIndex, isAnalysis, modes.studyNavigatorEnabled, navigate, status, studyId]);

  // We're not using hooks below here, so we can return early if we're at the end of the study.
  // This avoids issues with the component config being undefined for the end of the study.
  if (currentComponent === 'end') {
    return <StudyEnd />;
  }

  if (currentComponent === '__dynamicLoading') {
    return null;
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

  if (!storageEngine?.isConnected()) {
    return (
      <Center style={{ height: '80vh', flexDirection: 'column', textAlign: 'center' }}>
        <IconPlugConnectedX size={48} stroke={1.5} color="orange" />
        <Title mt="md" order={4}>Database Disconnected</Title>
        <Text mt="md">Please check your network connection or disable your adblocker for this site, then refresh the page.</Text>
      </Center>
    );
  }

  if (participantId && storePartId !== participantId) {
    return (
      <Center style={{ height: '80vh' }}>
        <Loader />
      </Center>
    );
  }
  const instruction = currentConfig?.instruction || '';
  const instructionLocation = currentConfig.instructionLocation ?? studyConfig.uiConfig.instructionLocation ?? 'sidebar';
  const instructionInSideBar = instructionLocation === 'sidebar';

  if (studyHasScreenRecording && isAnalysis && analysisCanPlayScreenRecording) return <ScreenRecordingReplay key={`${currentStep}-stimulus`} />;

  return (
    <>
      {instructionLocation === 'aboveStimulus' && <ReactMarkdownWrapper text={instruction} />}
      <ResponseBlock
        key={`${currentStep}-above-response-block`}
        status={status}
        config={currentConfig}
        location="aboveStimulus"
      />
      <Box
        id={currentComponent}
        className={currentConfig.type}
        style={{
          width: '100%',
          display: 'flex',
          flexGrow: currentConfig.type === 'website' ? 1 : undefined,
          flexDirection: 'column',
          ...currentConfig.style,
        }}
      >
        <Suspense key={`${currentStep}-stimulus`} fallback={<div>Loading...</div>}>
          <>
            {currentConfig.type === 'markdown' && <MarkdownController currentConfig={currentConfig} />}
            {currentConfig.type === 'website' && <IframeController currentConfig={currentConfig} provState={analysisProvState} answers={answers} />}
            {currentConfig.type === 'image' && <ImageController currentConfig={currentConfig} />}
            {currentConfig.type === 'react-component' && <ReactComponentController currentConfig={currentConfig} provState={analysisProvState} answers={answers} />}
            {currentConfig.type === 'vega' && <VegaController currentConfig={currentConfig} provState={analysisProvState as VegaProvState} />}
            {currentConfig.type === 'video' && <VideoController currentConfig={currentConfig} />}
          </>
        </Suspense>
      </Box>

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
