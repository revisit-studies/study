import { Badge, Divider, Group, Stack, Text } from '@mantine/core';
import { useCurrentStep } from '../../routes';
import { useNavigate, useParams } from 'react-router-dom';
import { OrderObject } from '../../parser/types';
import { IconArrowsShuffle } from '@tabler/icons-react';

export function StepsPanel({ order } : {order: OrderObject}) {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();

  return (
    <Stack spacing="xs">
      {order.components.map((step) => {
        if(typeof step === 'string') {
          return (
            <Group>
              <Badge
                key={step}
                style={{
                  cursor: 'pointer', 
                }}
                color={step === currentStep ? 'red' : 'blue'}
                onClick={() => navigate(`/${studyId}/${step}`)}
                size="xs"
              >
                {step}
              </Badge>
            </Group>
          );
        }
        else {
          return (
            <Stack spacing="xs">
              {/* <Divider style={{width: '100%'}}></Divider> */}
              {/* <Text size="xs">Random</Text> */}
              <Group spacing="xs" style={{width: '100%'}} noWrap align="center" position="center">
                {step.order === 'random' || step.order === 'latinSquare' ? <IconArrowsShuffle textAnchor='middle'/> : null}
                <Stack style={{width: '100%'}}>
                  <StepsPanel order={step}></StepsPanel>
                </Stack>
              </Group>
            </Stack>
          );
        }
      })}
    </Stack>
  );
}
