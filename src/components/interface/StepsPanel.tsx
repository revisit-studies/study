import { NavLink, Text } from '@mantine/core';
import { useCurrentStep } from '../../routes';
import { useNavigate, useParams } from 'react-router-dom';
import { OrderObject } from '../../parser/types';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { ReactNode } from 'react';

export function StepsPanel({ order }: { order: OrderObject }) {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();
  const studyConfig = useStudyConfig();

  return (
    <div>
      {order.components.map((step, idx) => {
        if (typeof step === 'string') {
          const task =
            step in studyConfig.components && studyConfig.components[step];
          return (
            <NavLink
              active={step === currentStep}
              key={idx}
              label={
                <div>
                  {step === currentStep ? <strong>{step}</strong> : step}
                  {task && (
                    <div style={{ marginLeft: '1rem', color: '#000' }}>
                      {task.description && (
                        <Text fw={900}>
                          Description:{' '}
                          <Text fw={400} component="span">
                            {task.description}
                          </Text>
                        </Text>
                      )}
                      {task.meta && <Text fw={900}>Task Meta:</Text>}
                      {task.meta &&
                        Object.keys(task.meta).map((key) => {
                          return (
                            <Text key={key}>
                              {key}:{' '}
                              {(task.meta as Record<string, ReactNode>)[key]}
                            </Text>
                          );
                        })}
                    </div>
                  )}
                </div>
              }
              onClick={() => navigate(`/${studyId}/${step}`)}
            />
          );
        } else {
          return (
            <NavLink
              key={idx}
              label={
                <>
                  Group: {step.order}{' '}
                  {step.order === 'random' || step.order === 'latinSquare'}
                  <IconArrowsShuffle size="15"/>
                </>
              }
              defaultOpened
              childrenOffset={30}
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: '#fff',
              }}
            >
              <div style={{ borderLeft: '1px solid #e9ecef' }}>
                <StepsPanel order={step}></StepsPanel>
              </div>
            </NavLink>
          );
        }
      })}
    </div>
  );
}
