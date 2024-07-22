import React, { useCallback, useEffect, useMemo } from 'react';
import {
  IconArrowBack, IconCirclePlus, IconPencil, IconNotebook, IconWritingSign, IconMail,
} from '@tabler/icons-react';
import {
  Title, ScrollArea, Badge, Input, ActionIcon, Tooltip, Divider, Box, Modal, Textarea, Button,
} from '@mantine/core';
import { useFocusTrap } from '@mantine/hooks';
import style from './sumsifter.module.css';
import Markdown from './Markdown';

interface SourceProps {
  sourceList: { id: string; text: string }[];
  activeSourceId: string | null;
  onSourceBadgePositionChange: (badgeLeft: number, badgeTop: number) => void;
  onAddToSummary: (text: string, prompt: string) => void;
}

function Source({
  sourceList, activeSourceId, onSourceBadgePositionChange, onAddToSummary,
}: SourceProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLSpanElement | null>(null);
  const [positionTop, setPositionTop] = React.useState(0);
  const [positionLeft, setPositionLeft] = React.useState(0);
  const [userSelection, setUserSelection] = React.useState<string | null>(null);
  const [userSelectionRect, setUserSelectionRect] = React.useState<DOMRect | null>(null);
  const [sourceQuery, setSourceQuery] = React.useState<string>('');
  const [highlightClientRects, setHighlightClientRects] = React.useState<DOMRect[] | null>(null);
  const [popupVisible, setPopupVisible] = React.useState(false);
  const [issues, setIssues] = React.useState<Array<Record<string, string>>>([]);
  const [issuesModalVisible, setIssuesModalVisible] = React.useState(false);
  const [emailContent, setEmailContent] = React.useState<string | null>(null);
  const [emailModalVisible, setEmailModalVisible] = React.useState(false);

  useEffect(() => {
    if (ref.current) {
      const element = ref.current;
      const handleScroll = () => {
        if (element && activeRef.current) {
          setPositionLeft(element.getBoundingClientRect().left);
          setPositionTop(activeRef.current.getBoundingClientRect().top);
          onSourceBadgePositionChange(element.getBoundingClientRect().left, activeRef.current.getBoundingClientRect().top);
        }
      };
      element.addEventListener('scroll', handleScroll);

      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
    return () => { };
  }, [ref, onSourceBadgePositionChange]);

  const handleActiveRefChange = useCallback((e: HTMLDivElement | null) => {
    activeRef.current = e;
  }, []);

  useEffect(() => {
    if (ref.current) {
      const element = ref.current;
      const handleMouseUp = () => {
        const selection = window.getSelection();
        if (selection && selection.toString() !== '') {
          setUserSelection(selection.toString());
          setUserSelectionRect(selection.getRangeAt(0).getBoundingClientRect());

          const range = selection.getRangeAt(0);
          setHighlightClientRects(Array.from(range.getClientRects()).map((rect) => (
            new DOMRect(
              rect.left - (contentRef.current?.getBoundingClientRect().left || 0),
              rect.top - (contentRef.current?.getBoundingClientRect().top || 0),
              rect.width,
              rect.height,
            )
          )));
        }
      };

      element.addEventListener('mouseup', handleMouseUp);
      return () => {
        element.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return () => { };
  }, [ref]);

  useEffect(() => {
    if (highlightClientRects) {
      const removeHighlight = () => {
        setHighlightClientRects(null);
        setUserSelection(null);
        setSourceQuery('');
      };
      window.addEventListener('mousedown', removeHighlight);
      return () => {
        window.removeEventListener('mousedown', removeHighlight);
      };
    }
    return () => { };
  }, [highlightClientRects]);

  useEffect(() => {
    if (ref.current && activeRef.current) {
      const element = ref.current;
      setPositionLeft(element.getBoundingClientRect().left);
      setPositionTop(activeRef.current.getBoundingClientRect().top);
      onSourceBadgePositionChange(element.getBoundingClientRect().left, activeRef.current.getBoundingClientRect().top);
    }
  }, [activeSourceId, onSourceBadgePositionChange]);

  const userSelectionActionBox = useMemo(() => ({
    top: (userSelectionRect?.top || 0) - (contentRef.current?.getBoundingClientRect().top || 0),
    left: 0,
    bottom: (userSelectionRect?.bottom || 0) - (contentRef.current?.getBoundingClientRect().top || 0),
  }), [userSelectionRect, contentRef]);

  const handleAddToSummary = useCallback(() => {
    onAddToSummary(userSelection || '', 'Include this to the summary.');
    setUserSelection(null);
    setHighlightClientRects(null);
  }, [userSelection, onAddToSummary]);

  const handleMakeDescriptive = useCallback(() => {
    onAddToSummary(userSelection || '', 'Include this to the summary and make this more descriptive.');
    setUserSelection(null);
    setHighlightClientRects(null);
  }, [userSelection, onAddToSummary]);

  const handleCreateTicket = useCallback(() => {
    setPopupVisible(true);
    setHighlightClientRects(null);
  }, []);

  const handleCreateEmail = useCallback(async () => {
    if (userSelection) {
      const response = await fetch('http://127.0.0.1:5000/summaries/generate-email/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: '04d08ca8-e8e0-4612-83f5-65bcefcc6b28',
          documentId: '2024 Problem Book_sumsifter_short_2.docx', // Example documentId, replace with actual
          promptType: 'general',
          sourceTargetText: null,
          summaryTargetText: null,
          prompt: userSelection,
        }),
      });

      const data = await response.json();
      setEmailContent(data.emailContent);
      setEmailModalVisible(true);
    }
  }, [userSelection]);

  const handleSourceQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceQuery(event.target.value);
  }, []);

  const handleSourceQueryKeyUp = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onAddToSummary(userSelection || '', sourceQuery);
      setSourceQuery('');
      setUserSelection(null);
      setHighlightClientRects(null);
    }
  }, [sourceQuery, userSelection, onAddToSummary]);

  const handleFormSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issue = event.currentTarget.issue.value;
    const documentTitle = event.currentTarget.documentTitle.value;
    const summary = event.currentTarget.summary.value;
    const description = event.currentTarget.description.value;
    const priority = event.currentTarget.priority.value;

    const newIssue = {
      issue,
      documentTitle,
      summary,
      description,
      priority,
    };

    setIssues((prevIssues) => [...prevIssues, newIssue]);
    setPopupVisible(false);
  }, []);

  const handlePrintIssues = useCallback(() => {
    setIssuesModalVisible(true);
  }, [issues]);

  return (
    <>
      <ScrollArea style={{ height: 'calc(100vh - 110px)' }} pos="relative" viewportRef={ref}>
        <div ref={contentRef} style={{ position: 'relative' }}>
          {highlightClientRects && (
            <div className={style.textHighlightContainer}>
              {highlightClientRects.map((rect, index) => (
                <div
                  key={index}
                  className={style.textHighlight}
                  style={{
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ))}
            </div>
          )}

          <Title order={2}>Source Document</Title>

          <Box pos="relative">
            <Markdown
              data={sourceList}
              activeId={activeSourceId}
              activeSourceId={null}
              onActiveRefChange={handleActiveRefChange}
            />
          </Box>

          {userSelection && (
            <div
              className={style.sourceContextPopup}
              style={{
                top: userSelectionActionBox.bottom,
                left: userSelectionActionBox.left,
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
            >
              <Tooltip label="Include in summary" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
                <ActionIcon variant="transparent" size="md" color="gray" onClick={handleAddToSummary}>
                  <IconCirclePlus />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Make it descriptive" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
                <ActionIcon variant="transparent" size="md" color="gray" onClick={handleMakeDescriptive}>
                  <IconPencil />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add to Custom Notes" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
                <ActionIcon variant="transparent" size="md" color="gray" onClick={handleCreateTicket}>
                  <IconWritingSign />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Open Custom Notes" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
                <ActionIcon variant="transparent" size="md" color="gray" onClick={handlePrintIssues}>
                  <IconNotebook />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Create Email" position="bottom" arrowOffset={50} arrowSize={8} withArrow>
                <ActionIcon variant="transparent" size="md" color="gray" onClick={handleCreateEmail}>
                  <IconMail />
                </ActionIcon>
              </Tooltip>
              <Divider orientation="vertical" />
              <Input
                ref={focusTrapRef}
                size="xs"
                value={sourceQuery}
                onChange={handleSourceQueryChange}
                onKeyUp={handleSourceQueryKeyUp}
                flex={1}
                ml={4}
                placeholder="What do you want to do with this selection?"
                rightSection={
                  sourceQuery.length ? (
                    <IconArrowBack
                      color="var(--mantine-color-gray-5)"
                    />
                  ) : null
                }
              />
            </div>
          )}

          {activeSourceId && (
            <>
              <Badge
                key={activeSourceId}
                className={style.sourceItemBadge}
                color="blue.5"
                style={{
                  position: 'fixed',
                  left: positionLeft - 10,
                  top: positionTop,
                  transform: 'translate(-100%, 0)',
                }}
              >
                {activeSourceId}
              </Badge>
              <div style={{
                position: 'fixed',
                left: positionLeft - 10,
                top: positionTop + 16,
                backgroundColor: 'var(--mantine-color-blue-5)',
                height: 2,
                width: 4,
              }}
              />
            </>
          )}
        </div>
      </ScrollArea>

      <Modal
        opened={popupVisible}
        onClose={() => setPopupVisible(false)}
        title="Create a Ticket"
      >
        <form onSubmit={handleFormSubmit}>
          <label htmlFor="issue">Topic:</label>
          <select id="issue" name="issue" required>
            <option value="technicalReview">Technical Review</option>
            <option value="translationReview">Translation Support from Language Analyst</option>
          </select>

          <label htmlFor="documentTitle">Document Title:</label>
          <input type="text" id="documentTitle" name="documentTitle" required />

          <label htmlFor="summary">Summary:</label>
          <input type="text" id="summary" name="summary" required />

          <label htmlFor="description">Text of Interest:</label>
          <textarea id="description" name="description" rows="6" required defaultValue={userSelection || ''} />

          <label htmlFor="priority">Priority Level:</label>
          <select id="priority" name="priority" required>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button type="submit">Create</Button>
            <Button type="button" onClick={() => setPopupVisible(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        opened={issuesModalVisible}
        onClose={() => setIssuesModalVisible(false)}
        title="Collected Issues"
      >
        <Textarea
          readOnly
          value={issues.map((issue, index) => (
            `Issue ${index + 1}:
            Issue Type: ${issue.issue}
            Document Title: ${issue.documentTitle}
            Summary: ${issue.summary}
            Description: ${issue.description}
            Priority: ${issue.priority}`
          )).join('\n\n')}
          rows={10}
          style={{ width: '100%' }}
        />
        <Button onClick={() => setIssuesModalVisible(false)}>Close</Button>
      </Modal>

      <Modal
        opened={emailModalVisible}
        onClose={() => setEmailModalVisible(false)}
        title="AI Generated Email Content"
      >
        <Textarea
          readOnly
          value={emailContent || ''}
          rows={20}
          style={{ width: '100%' }}
        />
        <Button onClick={() => setEmailModalVisible(false)}>Close</Button>
      </Modal>
    </>
  );
}

export default Source;
