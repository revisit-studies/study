import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button, Group, TextInput } from '@mantine/core';
import { ConsentComponent, StudyConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

export default function Consent({ goToNextSection, currentStudySectionConfig }: { goToNextSection: () => void; currentStudySectionConfig: ConsentComponent }) {
  const [consent, setConsent] = useState("");
  const [showText, setShowText] = useState(false);

  // Get the whole study config
  const [studyConfig, setStudyConfig] = useState<StudyConfig | null>(null);
  useEffect(() => {
    const fetchData = async () => setStudyConfig(await fetchStudyConfig('/src/configs/config-cleveland.hjson'));
    fetchData();
  }, [])

  useEffect(() => {
    setShowText(((studyConfig?.components.consent) as ConsentComponent)?.signature)
  }, [studyConfig]);

  useEffect(() => {
    fetch(currentStudySectionConfig.path)
      .then((response) => response.text())
      .then((text) =>  setConsent(text));
  }, []);

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>
      {showText && (
        <Group position="left" spacing="xs">
          <TextInput placeholder={"Please sign your name"} />
        </Group>
      )}        
      <Group
        position="left"
        spacing="xs"
        style={{ marginTop: 10 }}
      >
        <Button variant="subtle">Deny</Button>
        <Button onClick={goToNextSection}>Accept</Button>
      </Group>
    </div>
  );
};
