import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PREFIX as BASE_PREFIX } from '../App';
import { useCurrentStep } from '../routes';
import {
  updateResponseBlockValidation,
  useFlagsDispatch,
} from '../store/flags';
import { useNextStep } from '../store/hooks/useNextStep';
import {useStoreActions} from '../store';


const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '500px',
  width: '100%',
  border: 0,
  marginTop: '-50px'
};

type Props = {
  path: string;
  parameters?: Record<string, unknown>;
};

export default function IframeController({path, parameters}: Props) {
  const { saveTrialAnswer } = useStoreActions();

  const flagDispatch = useFlagsDispatch();
  const dispatch = useDispatch();

  const ref = useRef<HTMLIFrameElement>(null);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    []
  );

  const { trialId = null } = useParams<{ trialId: string }>();

  // navigation
  const currentStep = useCurrentStep();
  const navigate = useNavigate();
  const computedTo = useNextStep();
  const id = useLocation().pathname;


  const sendMessage = useCallback(
    (tag: string, message: unknown) => {
      ref.current?.contentWindow?.postMessage(
        {
          error: false,
          type: `${PREFIX}/${tag}`,
          iframeId,
          message,
        },
        '*'
      );
    },
    [ref, iframeId]
  );

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (typeof data === 'object' && trialId && iframeId === data.iframeId) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (parameters) {
              sendMessage('STUDY_DATA', parameters);
            }
            break;
          case `${PREFIX}/READY`:
            if (ref.current) {
              ref.current.style.height = `${data.message.documentHeight}px`;
            }
            break;
          case `${PREFIX}/ANSWERS`:
              flagDispatch(
                  updateResponseBlockValidation({
                      location: data.message.location,
                      trialId: id,
                      status: data.message.answer.length > 0,
                      answers: {
                          [`${id}/${data.message.taskID}`]: [
                              ...new Set([...data.message.answer]),
                          ],
                      },
                  })
              );
            break;


        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [
    flagDispatch,
    updateResponseBlockValidation,
    computedTo,
    currentStep,
    dispatch,
    iframeId,
    navigate,
    trialId,
    parameters,
    sendMessage,
    saveTrialAnswer,
  ]);

  //   saveTrialAnswer({
  //     trialName: currentStep,
  //     trialId,
  //     answer: { [`${id}/${trialId}`]: data.message },
  //   })
  
  return (
    <div >
      <iframe
        ref={ref}
        src={`${BASE_PREFIX}${path}?trialid=${trialId}&id=${iframeId}`}
        style={defaultStyle}
      ></iframe>
    </div>
  );
}
