import { Accordion, Container, Title } from '@mantine/core';
import { DataManagementAccordionItem } from './DataManagementAccordionItem';
import { RevisitModesAccordionItem } from './RevisitModesAccordionItem';
import { StageManagementAccordionItem } from './StageManagementAccordionItem';
import { ParticipantData } from '../../../storage/types';

export function ManageAccordion({ studyId, refresh }: { studyId: string, refresh: () => Promise<Record<number, ParticipantData>> }) {
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
        <Accordion.Item key="stageManagement" value="Stage Management">
          <Accordion.Control><Title order={5}>Stage Management</Title></Accordion.Control>
          <Accordion.Panel><StageManagementAccordionItem studyId={studyId} /></Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item key="dataManagement" value="Data Management">
          <Accordion.Control><Title order={5}>Data Management</Title></Accordion.Control>
          <Accordion.Panel>
            <DataManagementAccordionItem studyId={studyId} refresh={refresh} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Container>
  );
}
