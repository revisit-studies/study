import {
  Stack, Button, Popover,
  Loader,
} from '@mantine/core';
import { useState } from 'react';
import { Tag } from '../types';
import { AddTagDropdown } from './AddTagDropdown';

export function TagEditor({ createTagCallback, tags } : { createTagCallback : (tag: Tag) => void, tags: Tag[] }) {
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);

  return (
    <Popover trapFocus withinPortal={false}>
      <Stack justify="center">
        <Popover.Target>
          <Button style={{ width: '100%' }} variant="light" onClick={() => setAddDialogOpen(!addDialogOpen)}>
            Create new tag
          </Button>
        </Popover.Target>
      </Stack>
      {tags
        ? (
          <Popover.Dropdown>
            <AddTagDropdown currentNames={tags.map((t) => t.name)} addTagCallback={(t: Tag) => { setAddDialogOpen(false); createTagCallback(t); }} />
          </Popover.Dropdown>
        ) : <Loader />}
    </Popover>
  );
}
