import {
  Pill,
  Tooltip,
  isLightColor,
} from '@mantine/core';
import { Tag } from '../types';

export function Pills({ selectedTags, removeFunc }: { selectedTags: Tag[], removeFunc?: (s: string) => void }) {
  return selectedTags.map((tag) => {
    if (!tag || !tag.id) {
      return null;
    }
    return (
      <Tooltip key={tag.id} label={tag.name} withinPortal>
        <Pill
          style={{ width: '80px' }}
          withRemoveButton={!!removeFunc}
          styles={{ root: { backgroundColor: tag.color, color: isLightColor(tag.color) ? 'black' : 'white' } }}
          onRemove={() => (removeFunc ? removeFunc(tag.id) : null)}
        >
          {tag.name}
        </Pill>
      </Tooltip>
    );
  });
}
