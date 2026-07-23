import {
  ActionIcon, Box, Popover,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { useState } from 'react';
import { Tag } from '../types';
import { AddTagDropdown } from './AddTagDropdown';

export function EditTagPopover({
  tag, currentNames, editTagCallback,
}: {
  tag: Tag;
  currentNames: string[];
  editTagCallback: (oldTag: Tag, newTag: Tag) => void | Promise<void>;
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  return (
    <Box onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
    }}
    >
      <Popover opened={editDialogOpen} onChange={setEditDialogOpen} trapFocus withinPortal={false}>
        <Popover.Target>
          <ActionIcon
            aria-label={`Edit ${tag.name}`}
            variant="light"
            size="sm"
            onClick={() => setEditDialogOpen((open) => !open)}
          >
            <IconEdit />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <AddTagDropdown
            editTag
            currentNames={currentNames}
            addTagCallback={async (newTag: Tag) => {
              await editTagCallback(tag, newTag);
              setEditDialogOpen(false);
            }}
            editableTag={tag}
          />
        </Popover.Dropdown>
      </Popover>
    </Box>
  );
}
