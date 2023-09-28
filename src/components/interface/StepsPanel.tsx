import { Badge, Group } from '@mantine/core';
import { useCurrentStep } from '../../routes';
import { useAppSelector } from '../../store/store';
import { useNavigate, useParams } from 'react-router-dom';

export function StepsPanel() {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();

  const state = useAppSelector((state) => state.trrackedSlice);
  console.log(state);
  const { sequence } = useAppSelector((state) => state.trrackedSlice.orderConfig);

  return (
    <Group spacing="xs">
      {sequence.map((step) => (
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
      ))}
    </Group>
  );
}
