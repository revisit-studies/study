import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button, Group, TextInput } from '@mantine/core';
import { ConsentComponent} from '../parser/types';
import { useDispatch } from "react-redux";
import { saveConsent } from "../store";

export default function Consent({ goToNextSection, goToEnd, currentStudySectionConfig}: { goToNextSection: () => void; goToEnd: () => void; currentStudySectionConfig: ConsentComponent; }) {
  const [consent, setConsent] = useState("");
  const signatureRequired = currentStudySectionConfig.signatureRequired;
  const [disableContinue, setDisableContinue] = useState(signatureRequired);
  const txtInput = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    fetch(currentStudySectionConfig.path)
      .then((response) => response.text())
      .then((text) =>  setConsent(text));
  }, []);

  const handleTextInput = () => setDisableContinue(txtInput.current?.value.length === 0);

  const handleNextSection = () => {
    dispatch(saveConsent({ signature : txtInput.current?.value, timestamp: Date.now() }));
    goToNextSection();
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
        <Button variant="subtle" onClick={goToEnd}>Deny</Button>
        <Button onClick={handleNextSection} disabled={disableContinue}>Accept</Button>
      </Group>
    </div>
  );
};
