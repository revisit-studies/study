import { Badge, Group, Stack } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { useCurrentStep } from '../../routes';
import { OrderObject } from '../../parser/types';

export function StepsPanel({ order }: { order: OrderObject }) {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();

  return (
    <Stack spacing="xs">
      {order.components.map((step, idx) => {
        if (typeof step === 'string') {
          return (
            <Group key={idx}>
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
        return (
          <Stack spacing="xs" key={idx}>
            <Group
              spacing="xs"
              style={{ width: '100%' }}
              noWrap
              align="center"
              position="center"
            >
              {step.order === 'random' || step.order === 'latinSquare' ? (
                <IconArrowsShuffle textAnchor="middle" />
              ) : null}
              <Stack style={{ width: '100%' }}>
                <StepsPanel order={step} />
              </Stack>
            </Group>
          </Stack>
        );
      })}
    </Stack>
  );
}
