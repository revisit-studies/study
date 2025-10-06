import React from 'react';
import {
  Group, Card, Text, Title, Grid, Badge, RingProgress,
} from '@mantine/core';
import { SequenceAssignment } from '../../../storage/engines/types';
import { ProgressHeatmap } from './ProgressHeatmap';

interface ParticipantSectionProps {
  title: string;
  titleColor: string;
  participants: Array<{
    assignment: SequenceAssignment;
    progress: number;
    isCompleted: boolean;
    isRejected: boolean;
  }>;
  showProgressHeatmap?: boolean;
  showDynamicBadge?: boolean;
  progressValue: (assignment: SequenceAssignment, progress: number) => number;
  progressColor: string;
  progressLabel: React.ComponentType<{ assignment: SequenceAssignment; progress: number }>;
}

export function ParticipantSection({
  title,
  titleColor,
  participants,
  showProgressHeatmap = false,
  showDynamicBadge = false,
  progressValue,
  progressColor,
  progressLabel,
}: ParticipantSectionProps) {
  return (
    <>
      <Title order={5} c={titleColor}>
        {title}
        {' '}
        (
        {participants.length}
        )
      </Title>
      {participants.length > 0 && (
        <Grid>
          {participants.map(({ assignment, progress }, index) => (
            <Grid.Col span={12} key={assignment.participantId || `${title.toLowerCase()}-${index}`}>
              <Card shadow="sm" padding="sm" radius="md" withBorder>
                <Group justify="space-between" align="center">
                  <div>
                    <Group gap="xs" align="center">
                      <Text fw={500} size="sm">
                        Participant:
                        {' '}
                        {assignment.participantId || `#${index + 1}`}
                      </Text>
                      {showDynamicBadge && assignment.isDynamic && (
                        <Badge size="xs" color="cyan">
                          DYNAMIC
                        </Badge>
                      )}
                    </Group>

                    <Text size="xs" c="dimmed">
                      Started:
                      {' '}
                      {new Date(assignment.createdTime).toLocaleString()}
                    </Text>
                  </div>

                  {showProgressHeatmap && (
                    <ProgressHeatmap
                      total={assignment.total}
                      answered={assignment.answered}
                      isDynamic={assignment.isDynamic}
                    />
                  )}

                  <RingProgress
                    size={60}
                    thickness={6}
                    sections={[{
                      value: progressValue(assignment, progress),
                      color: progressColor,
                    }]}
                    label={React.createElement(progressLabel, { assignment, progress })}
                  />
                </Group>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}
    </>
  );
}
