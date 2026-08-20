import {
  Stack, Button, Popover,
  Loader,
} from '@mantine/core';
import { useState } from 'react';
import { Tag } from '../types';
import { AddTagDropdown } from './AddTagDropdown';

export function TagEditor({ createTagCallback, tags } : { createTagCallback : (tag: Tag) => void | Promise<void>, tags: Tag[] }) {
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);

  return (
    <Popover opened={addDialogOpen} onChange={setAddDialogOpen} trapFocus withinPortal={false}>
      <Stack justify="center">
        <Popover.Target>
          <Button style={{ width: '100%' }} variant="light" onClick={() => setAddDialogOpen((open) => !open)}>
            Create new tag
          </Button>
        </Popover.Target>
      </Stack>
      {tags
        ? (
          <Popover.Dropdown>
            <AddTagDropdown
              currentNames={tags.map((t) => t.name)}
              addTagCallback={async (t: Tag) => {
                await createTagCallback(t);
                setAddDialogOpen(false);
              }}
            />
          </Popover.Dropdown>
        ) : <Loader />}
    </Popover>
  );
}
