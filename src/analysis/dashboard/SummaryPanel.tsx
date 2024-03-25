import {
  Badge, Box, Button, Card, Center, Group, Title, Grid, Container,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { IconTable } from '@tabler/icons-react';
import { DateRangePicker, DateRangePickerValue } from '@mantine/dates';
import Linechart from '../components/charts/Linechart';
import { SummaryPanelProps } from '../types';
import { ParticipantData } from '../../storage/types';

function SummaryPanel(props: SummaryPanelProps) {
  const { studyId, data } = props;
  const [rangeTime, setRangeTime] = useState<DateRangePickerValue | undefined>();
  const [completed, setCompleted] = useState<ParticipantData[]>([]);
  const [inprogress, setInprogress] = useState<ParticipantData[]>([]);

  useEffect(() => {
    if (data && data.length > 0) {
      setCompleted(data.filter((d) => d.sequence.components && d.sequence.components.length - Object.keys(d.answers).length <= 1));

      setInprogress(data.filter((d) => d.sequence.components && d.sequence.components.length - Object.keys(d.answers).length > 1));
    }
  }, [data]);

  const getCompletedStatsData = () => {
    if (completed) {
      const times:number[] = [];
      completed.forEach((completeData) => {
        const { answers } = completeData;
        let endTime = 0;
        for (const trialName in answers) {
          if (Object.prototype.hasOwnProperty.call(answers, trialName)) {
            endTime = Math.max(endTime, answers[trialName].endTime);
          }
        }
        times.push(endTime);
      });
      const sortedTimes = times.sort((a, b) => a - b);
      return sortedTimes.map((time, idx) => ({
        time,
        value: idx + 1,
      }));
    }

    return [];
  };

  return (
    <Container>
      {
                data && (
                <Card p="lg" shadow="md" withBorder>
                  <Title mb={10} order={3}>{studyId}</Title>

                  <Grid>
                    <Grid.Col span={8}>
                      <Group>
                        <Badge size="md" color="orange">
                          Total :
                          {completed.length + inprogress.length}
                        </Badge>
                        <Badge size="md" color="green">
                          Completed :
                          {completed.length}
                        </Badge>
                        <Badge size="md" color="cyan">
                          In Progress :
                          {inprogress.length}
                        </Badge>
                      </Group>
                    </Grid.Col>
                    <Grid.Col span={4}>
                      <Group>
                        <Button
                                    // disabled={!storageEngine?.isConnected()}
                          leftIcon={<IconTable />}
                          mt="1em"
                          mr="0.5em"
                        >
                          Download Tidy Data
                        </Button>

                      </Group>

                    </Grid.Col>

                  </Grid>

                  <Box m={10}>
                    <DateRangePicker
                      dropdownType="modal"
                      label="Time Filter"
                      placeholder="Pick dates range"
                      clearable
                      value={rangeTime}
                      onChange={setRangeTime}
                    />

                  </Box>

                  {/* <Center> */}
                  {/*    <Button mt={20} color="red" radius="xl" onClick={toggleTimefilter}> */}
                  {/*        Close */}
                  {/*    </Button> */}
                  {/* </Center> */}

                  {getCompletedStatsData().length >= 2
                    ? <Linechart domainH={[0, 100]} rangeH={[10, 200]} domainV={[0, 100]} rangeV={[10, 100]} data={getCompletedStatsData()} labelV="" labelH="" />
                    : (
                      <Box h={230} pt={20}>
                        <Center>
                          <Title order={5}>Not enough participants for chart</Title>

                        </Center>
                      </Box>
                    )}

                  {/* <Button disabled={data.length===0} color={'orange'} onClick={()=>setDeleteModalOpened(true)}>Delete All</Button> */}
                  {/* <Modal opened={deleteModalOpened} onClose={onModalClose} title="Delete All"> */}
                  {/*    <TextInput */}
                  {/*        placeholder="Type in Study ID" */}
                  {/*        label="To proceed, please type in the study ID. This operation will delete all data related to this study" */}
                  {/*        ref={modalInuptRef} */}
                  {/*        onChange={checkStudyIdInput} */}
                  {/*    /> */}
                  {/*    <Center> */}
                  {/*        <Button mt={10} disabled={!studyIdValid} color={'orange'} onClick={deleteAll}>Proceed</Button> */}
                  {/*    </Center> */}
                  {/* </Modal> */}

                </Card>
                )
            }
    </Container>

  );
}

export default SummaryPanel;
