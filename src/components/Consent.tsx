import { Button, Group, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { ConsentComponent } from "../parser/types";
import { useCurrentStep } from "../routes";
import { completeStep, useAppDispatch, useAppSelector } from "../store";
import { useNavigateWithParams } from "../utils/useNavigateWithParams";
import { NextButton } from "./NextButton";

export function useConsentConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;

    if (!config || currentStep !== "consent") return null;
    return config.components[currentStep] as ConsentComponent;
  });
}

export default function Consent() {
  const navigate = useNavigateWithParams();
  const txtInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();

  const [consent, setConsent] = useState<string | null>(null);

  const config = useConsentConfig();

  useEffect(() => {
    if (!config) return;

    fetch(config.path)
      .then((response) => response.text())
      .then((text) => setConsent(text));
  }, [config]);

  const signatureRequired = config !== null ? config.signatureRequired : false;
  const [disableContinue, setDisableContinue] = useState(signatureRequired);

  const handleTextInput = () =>
    setDisableContinue(txtInput.current?.value.length === 0);

  if (!consent) return <div>Loading...</div>;

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>
      {signatureRequired && (
        <Group position="left" spacing="xs">
          <TextInput
            ref={txtInput}
            placeholder={"Please sign your name"}
            onChange={handleTextInput}
          />
        </Group>
      )}
      <Group position="left" spacing="xs" style={{ marginTop: 10 }}>
        <Button variant="subtle" onClick={() => navigate("/end")}>
          Deny
        </Button>
        <NextButton
          disabled={disableContinue}
          label="Accept"
          process={() => {
            dispatch(completeStep("consent"));
          }}
        />
      </Group>
    </div>
  );
}
