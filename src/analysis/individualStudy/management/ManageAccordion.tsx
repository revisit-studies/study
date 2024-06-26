import { Accordion, Container, Title } from '@mantine/core';
import { DataManagementAccordionItem } from './DataManagementAccordionItem';
import { RevisitModesAccordionItem } from './RevisitModesAccordionItem';
import { useStorageEngine } from '../../../storage/storageEngineHooks';

export default function ManageAccordion({ studyId, refresh }: { studyId: string, refresh: () => Promise<void> }) {
  const { storageEngine } = useStorageEngine();

  return (
    <Container>
      <Accordion
        multiple
        variant="contained"
      >
        <Accordion.Item key="modes" value="ReVISit Modes">
          <Accordion.Control><Title order={5}>ReVISit Modes</Title></Accordion.Control>
          <Accordion.Panel><RevisitModesAccordionItem studyId={studyId} /></Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item key="dataManagement" value="Data Management">
          <Accordion.Control disabled={storageEngine?.getEngine() === 'localStorage'}><Title order={5}>Data Management</Title></Accordion.Control>
          <Accordion.Panel>
            {storageEngine?.getEngine() !== 'localStorage' && <DataManagementAccordionItem studyId={studyId} refresh={refresh} />}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Container>
  );
}
