import {
  Card,
  Flex,
  Text,
  Button,
  Loader,
  Divider,
  rem,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import { PREFIX } from '../../../utils/Prefix';
import { useStudyId } from '../../../routes/utils';
import { ReactMarkdownWrapper } from '../../../components/ReactMarkdownWrapper';

export default function InstructionsDisplay({ chartType, modality, onOpenChat }: {
  chartType: 'violin-plot' | 'clustered-heatmap';
  modality: 'tactile' | 'text';
  onOpenChat?: () => void;
}) {
  const studyId = useStudyId();

  const [instructions, setInstructions] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (chartType === 'clustered-heatmap') {
      setImageUrl(`${PREFIX}${studyId}/demo-llm-chatbot/assets/data/clustered-heatmap.png`);
    }
  }, [chartType, studyId]);

  useEffect(() => {
    const loadInstructions = async () => {
      try {
        setLoading(true);

        // Determine which instruction file to load
        const instructionType = modality === 'tactile' ? 'tactile' : 'text';
        const fileName = `${chartType}_instructions_${instructionType}.md`;

        // In production, this would fetch from an API
        // For now, we'll simulate loading the content
        const response = await fetch(`${PREFIX}${studyId}/assets/instructions/${fileName}`);

        if (!response.ok) {
          throw new Error(`Failed to load instructions: ${response.statusText}`);
        }

        const content = await response.text();
        setInstructions(content);
      } catch (err) {
        console.error('Error loading instructions:', err);
        setError('Failed to load instructions. Please try refreshing the page.');

        // Fallback to basic instructions
        if (modality === 'tactile') {
          setInstructions(`# ${chartType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} - Tactile Instructions

This is a tactile chart exploration session. You will be provided with tactile instructions to explore the chart.

## What to expect:
- Detailed tactile exploration steps
- Chart orientation guidance
- Data interpretation instructions
- Interactive exploration techniques

Please follow the tactile instructions carefully and ask the AI assistant any questions you have about the chart.`);
        } else {
          setInstructions(`# ${chartType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} - Text Instructions

This is a text-based learning session about ${chartType.replace('-', ' ')} charts.

## What you'll learn:
- Chart structure and components
- Data representation methods
- Interpretation techniques
- Key concepts and terminology

Read through the instructions and ask the AI assistant any questions you have about the chart.`);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInstructions();
  }, [chartType, modality, studyId]);

  if (loading) {
    return (
      <Card shadow="md" radius="lg" p="lg" withBorder>
        <Flex align="center" justify="center" py="xl" gap="md">
          <Loader size={32} color="blue" />
          <Text color="gray.6" size="md">Loading instructions...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card shadow="md" radius="lg" p="lg" withBorder>
        <Flex direction="column" align="center" justify="center" py="xl" gap="md">
          <Text color="red.6" size="md" mb={rem(8)}>{error}</Text>
          <Button variant="outline" color="blue" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <>
      <Flex direction="column" mb="md">
        <Flex justify="space-between" align="center">
          <div>
            <Text size="xl" fw={700}>
              {modality === 'tactile' ? 'Tactile Chart Instructions' : 'Chart Explanation'}
            </Text>
            <Text size="sm" c="dimmed">
              {modality === 'tactile'
                ? 'Follow these tactile exploration instructions to learn about the chart'
                : 'Read this explanation to understand the chart type'}
            </Text>
          </div>
          {onOpenChat && (
            <Button
              variant="outline"
              color="blue"
              onClick={onOpenChat}
              size="sm"
            >
              Press 'T' or click to open AI Chat
            </Button>
          )}
        </Flex>
      </Flex>
      <Divider mb="md" />
      <div style={{ maxWidth: '100%' }}>
        <ReactMarkdownWrapper text={instructions} />
      </div>
    </>
  );
}
