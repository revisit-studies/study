import { Button, Group, TextInput } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { PREFIX } from '../App';
import { ConsentComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import {
  useAppDispatch,
  useAppSelector,
  useStoreActions,
  useStudySelector,
} from '../store';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { NextButton } from './NextButton';
export function useConsentConfig() {
  const currentStep = useCurrentStep();
  return useAppSelector((state) => {
    const { config } = state.study;

    if (!config || currentStep !== 'consent') return null;
    return config.components[currentStep] as ConsentComponent;
  });
}

function useConsentStore() {
  return useStudySelector().consent;
}

export default function Consent() {
  const { completeStep, saveConsent } = useStoreActions();

  const storedConsent = useConsentStore();

  const navigate = useNavigateWithParams();
  const [txtInput, setTxtInput] = useInputState(storedConsent?.signature || '');
  const dispatch = useAppDispatch();

  const [consent, setConsent] = useState<string | null>(null);

  const config = useConsentConfig();

  useEffect(() => {
    if (!config) return;

    fetch(`${PREFIX}${config.path}`)
      .then((response) => response.text())
      .then((text) => setConsent(text));
  }, [config]);

  const signatureRequired = config !== null ? config.signatureRequired : false;

  if (!consent) return <div>Loading...</div>;

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>
      {signatureRequired && (
        <Group position="left" spacing="xs">
          <TextInput
            disabled={Boolean(storedConsent)}
            value={txtInput}
            placeholder={'Please sign your name'}
            onChange={setTxtInput}
          />
        </Group>
      )}
      <Group position="left" spacing="xs" style={{ marginTop: 10 }}>
        <Button
          disabled={Boolean(storedConsent)}
          variant="subtle"
          onClick={() => navigate('/end')}
        >
          Deny
        </Button>
        <NextButton
          disabled={signatureRequired && txtInput.length === 0}
          label="Accept"
          process={() => {
            dispatch(completeStep('consent'));
            dispatch(
              saveConsent({
                signature: txtInput,
                timestamp: Date.now(),
              })
            );
          }}
        />
      </Group>
    </div>
  );
}
