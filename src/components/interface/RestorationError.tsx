import { Alert, Button } from '@mantine/core';

export function RestorationError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert color="red" title="Your saved work could not be restored" role="alert">
      Your earlier work has been kept. Please retry before continuing.
      <Button onClick={onRetry} mt="sm">Retry restoration</Button>
    </Alert>
  );
}
