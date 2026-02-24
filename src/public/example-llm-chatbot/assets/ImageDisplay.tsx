import {
  Card, Image, Text, Flex,
} from '@mantine/core';
import { PREFIX } from '../../../utils/Prefix';
import { useStudyId } from '../../../routes/utils';

export default function ImageDisplay() {
  const studyId = useStudyId();

  // Determine the image file name based on chart type
  const imageFileName = 'clustered-heatmap.png';
  const imagePath = `${PREFIX}${studyId}/assets/images/${imageFileName}`;

  return (
    <Card shadow="md" radius="lg" p="lg" withBorder mb="md">
      <Flex direction="column" gap="md">
        <Text size="lg" fw={600}>
          Clustered Heatmap
        </Text>
        <Text size="sm" c="dimmed">
          You can ask the AI assistant any questions about the chart in the chatbot on the right.
        </Text>
        <Image
          src={imagePath}
          alt="clustered heatmap chart"
          fit="contain"
          style={{
            maxHeight: '400px',
            width: '100%',
            objectFit: 'contain',
          }}
          fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+"
        />
      </Flex>
    </Card>
  );
}
