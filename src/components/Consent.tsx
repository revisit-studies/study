import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button, Group, TextInput } from '@mantine/core';
import { ConsentComponent, StudyConfig } from '../parser/types';

export default function Consent({ goToNextSection, currentStudySectionConfig, studyConfig}: { goToNextSection: () => void; currentStudySectionConfig: ConsentComponent; studyConfig: StudyConfig }) {
  const [consent, setConsent] = useState("");
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [isEnabled, setEnabled] = useState(false);
  const txtInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSignatureRequired(((studyConfig?.components.consent) as ConsentComponent)?.signatureRequired)
    setEnabled(((studyConfig?.components.consent) as ConsentComponent)?.signatureRequired ? true : false)
  }, [studyConfig]);

  useEffect(() => {
    fetch(currentStudySectionConfig.path)
      .then((response) => response.text())
      .then((text) =>  setConsent(text));
  }, []);

  const handleTextInput = () => {
    txtInput.current?.value.length ? setEnabled(false) : setEnabled(true);
  }

  const handleDeny = () => {
    window.close();
  }

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>
      {signatureRequired && (
        <Group position="left" spacing="xs">
          <TextInput ref={txtInput} placeholder={"Please sign your name"} onChange={handleTextInput} />
        </Group>
      )}        
      <Group
        position="left"
        spacing="xs"
        style={{ marginTop: 10 }}
      >
        <Button variant="subtle" onClick={handleDeny}>Deny</Button>
        <Button onClick={goToNextSection} disabled={isEnabled}>Accept</Button>
      </Group>
    </div>
  );
};
