import { NavLink, Text } from '@mantine/core';
import { ReactNode, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { deepCopy } from '../../utils/deepCopy';
import { useCurrentStep } from '../../routes';
import { OrderObject } from '../../parser/types';

const getFlatMap = (orderObj: OrderObject): string[] => orderObj.components.flatMap((component) => (typeof component === 'string' ? component : getFlatMap(component)));

const getVisibleChildComponent = (
  sequence: string[],
  orderObj: OrderObject,
) => {
  const flatObj = getFlatMap(orderObj);

  const visibleChild = flatObj.find((component) => sequence.indexOf(component) !== -1);

  return visibleChild;
};

export function StepsPanel({
  sequence,
  order,
}: {
  sequence: string[];
  order: OrderObject;
}) {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();
  const studyConfig = useStudyConfig();

  const newOrder = useMemo(() => {
    const nOrder = deepCopy(order);

    // reorder based on sequence
    nOrder.components.sort((a, b) => {
      const keyA = typeof a === 'string' ? a : getVisibleChildComponent(sequence, a);
      const keyB = typeof b === 'string' ? b : getVisibleChildComponent(sequence, b);
      const idxA = keyA ? sequence.indexOf(keyA) : 10000;
      const idxB = keyB ? sequence.indexOf(keyB) : 10000;
      return (idxA === -1 ? 10000 : idxA) - (idxB === -1 ? 10000 : idxB);
    });
    return nOrder;
  }, [order, sequence]);

  return (
    <div>
      {newOrder.components.map((step, idx) => {
        if (typeof step === 'string') {
          const task = step in studyConfig.components && studyConfig.components[step];
          return (
            <NavLink
              active={step === currentStep}
              key={idx}
              label={(
                <div
                  style={{ opacity: sequence.indexOf(step) === -1 ? '.3' : 1 }}
                >
                  {step === currentStep ? <strong>{step}</strong> : step}
                  {task && (
                    <div
                      style={{
                        marginLeft: '1rem',
                        color: '#000',
                        display: 'none',
                      }}
                    >
                      {task.description && (
                        <Text fw={900}>
                          Description:
                          {' '}
                          <Text fw={400} component="span">
                            {task.description}
                          </Text>
                        </Text>
                      )}
                      {task.meta && <Text fw={900}>Task Meta:</Text>}
                      {task.meta
                        && Object.keys(task.meta).map((key) => (
                          <Text key={key}>
                            {key}
                            :
                            {' '}
                            {(task.meta as Record<string, ReactNode>)[key]}
                          </Text>
                        ))}
                    </div>
                  )}
                </div>
              )}
              onClick={() => navigate(`/${studyId}/${step}`)}
            />
          );
        }
        return (
          <NavLink
            key={idx}
            label={(
              <div
                style={{
                  opacity: getVisibleChildComponent(sequence, step) ? 1 : 0.5,
                }}
              >
                Group:
                {' '}
                {step.order}
                {' '}
                {step.order === 'random' || step.order === 'latinSquare'}
                <IconArrowsShuffle size="15" />
              </div>
              )}
            defaultOpened
            childrenOffset={30}
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#fff',
            }}
          >
            <div style={{ borderLeft: '1px solid #e9ecef' }}>
              <StepsPanel order={step} sequence={sequence} />
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}
