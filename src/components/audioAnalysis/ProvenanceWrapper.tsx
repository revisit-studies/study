import { AppShell, Stack } from '@mantine/core';
import { AnalysisPopout } from './AnalysisPopout';
import ComponentController from '../../controllers/ComponentController';

export function ProvenanceWrapper() {
  return (
    <Stack>
      <div>
        <AppShell.Main p="sm">
          <AnalysisPopout />
        </AppShell.Main>
      </div>
      <ComponentController />
    </Stack>
  );
}
