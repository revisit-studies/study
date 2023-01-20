import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button, Group } from '@mantine/core';

export default function Consent({ goToNextSection }: { goToNextSection: () => void }) {
  const [consent, setConsent] = useState("");

  useEffect(() => {
    fetch("src/markdowns/Consent.md")
      .then((response) => response.text())
      .then((text) =>  setConsent(text));
  }, []);

  return (
    <div>
      <ReactMarkdown>{consent}</ReactMarkdown>

      <Group
        position="right"
        spacing="xs"
        mt="xl"
      >
        <Button variant="subtle">Deny</Button>
        <Button onClick={goToNextSection}>Accept</Button>
      </Group>
    </div>
  );
};
