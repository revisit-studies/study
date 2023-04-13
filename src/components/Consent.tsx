import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button, Group } from '@mantine/core';

import { ConsentComponent } from '../parser/types';

export default function Consent({ goToNextSection, currentStudySectionConfig }: { goToNextSection: () => void; currentStudySectionConfig: ConsentComponent }) {
  const [consent, setConsent] = useState("");

  useEffect(() => {
    fetch(currentStudySectionConfig.path)
      .then((response) => response.text())
      .then((text) =>  setConsent(text));
  }, []);

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>

      <Group
        position="right"
        spacing="xs"
      >
        <Button variant="subtle">Deny</Button>
        <Button onClick={goToNextSection}>Accept</Button>
      </Group>
    </div>
  );
};
