import { Button, Group } from "@mantine/core";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { ConsentComponent } from "../parser/types";
import { useCurrentStep } from "../routes";
import { completeStep, useAppDispatch, useAppSelector } from "../store";
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
  const dispatch = useAppDispatch();

  const [consent, setConsent] = useState<string | null>(null);

  const config = useConsentConfig();

  useEffect(() => {
    if (!config) return;

    fetch(config.path)
      .then((response) => response.text())
      .then((text) => setConsent(text));
  }, [config]);

  if (!consent) return <div>Loading...</div>;

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>

      <Group position="right" spacing="xs">
        <Button variant="subtle">Deny</Button>
        <NextButton
          label="Accept"
          process={() => {
            dispatch(completeStep("consent"));
          }}
        />
      </Group>
    </div>
  );
}
