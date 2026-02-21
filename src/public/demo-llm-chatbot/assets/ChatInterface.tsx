import {
  useState, useRef, useEffect, type ComponentPropsWithoutRef, type ReactNode,
} from 'react';
import { IconMessage, IconSend } from '@tabler/icons-react';
import {
  Flex,
  Text,
  Textarea,
  Button,
  Loader,
  ScrollArea,
  Group,
  Paper,
  Divider,
  rem,
  Card,
} from '@mantine/core';
import { Trrack } from '@trrack/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, ChatProvenanceState } from './types';
import { PREFIX } from '../../../utils/Prefix';
import { useStudyId } from '../../../routes/utils';

type ChatTrrackState = {
  messages: ChatMessage[];
};

type UpdateMessagesAction = (messages: ChatMessage[]) => { payload: ChatMessage[]; type: string };

type ToolName = 'get_dataset_csv' | 'get_chart_image_file_id';

type OpenAIFunctionCall = {
  type: 'function_call';
  name: ToolName;
  call_id: string;
};

type ToolResult = {
  name: ToolName;
  output: { csv: string } | { file_id: string };
};

type ToolSelectionResponse = {
  id?: string;
  response?: { id?: string };
  output?: unknown[];
};

type StreamEvent = {
  type?: string;
  delta?: string;
  response?: { id?: string };
  response_id?: string;
};

type UserTextInputItem = {
  role: 'user';
  content: Array<{ type: 'input_text'; text: string }>;
};

type FunctionOutputInputItem = {
  type: 'function_call_output';
  call_id: string;
  output: string;
};

type UserImageInputItem = {
  role: 'user';
  content: Array<{ type: 'input_image'; file_id: string }>;
};

type StreamInputItem = UserTextInputItem | FunctionOutputInputItem | UserImageInputItem;

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  children?: ReactNode;
};

function MarkdownParagraph(props: ComponentPropsWithoutRef<'p'>) {
  return <Text size="sm" {...props} />;
}

function MarkdownListItem(props: ComponentPropsWithoutRef<'li'>) {
  return <li style={{ marginLeft: 16 }} {...props} />;
}

function MarkdownCode({
  inline = false,
  children,
  ...props
}: MarkdownCodeProps) {
  return (
    <code
      style={{
        backgroundColor: inline ? '#e9ecef' : '#f1f3f5',
        borderRadius: 4,
        padding: inline ? '2px 4px' : '8px',
        display: inline ? 'inline' : 'block',
        overflowX: 'auto',
        fontFamily: 'monospace',
        color: '#212529',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

const markdownComponents = {
  p: MarkdownParagraph,
  li: MarkdownListItem,
  code: MarkdownCode,
};

export default function ChatInterface(
  {
    provenanceState, trrack, actions, updateProvenanceState, onMessagesUpdate,
  }:
  {
    provenanceState?: ChatProvenanceState,
    trrack: Trrack<ChatTrrackState, string>,
    actions: {
      updateMessages: UpdateMessagesAction;
    },
    updateProvenanceState: (messages: ChatMessage[]) => void,
    onMessagesUpdate?: (messages: ChatMessage[]) => void
  },
) {
  // Define the system prompt
  const prePrompt = `You are a helpful assistant who is helping a user explore and understand a clustered heatmap. Your goal is to help the user explore and understand the clustered heatmap while they view the chart. You will be given: (1) the chart image and (2) the underlying dataset as a CSV file.

Gating policy:
- Default: respond normally and do not mention chart/data/instructions.
- Only use background when the user explicitly asks about the chart, dataset/CSV, or instructions, or when the question clearly depends on them.
- If unclear, ask one short clarifying question.

How to respond:
- Be concise, clear, and direct.
- Limit the response to 400 tokens.
- Use dataset.csv for exact values and comparisons. Do not invent labels or numbers. If something is missing, say so and ask one short follow-up question.`;

  // IMPORTANT: only mention tools you actually provide
  const toolPolicy = `Tools (call only when needed):
- get_dataset_csv: returns dataset.csv as JSON { csv: string }
- get_chart_image_file_id: returns JSON { file_id: string } for the chart image

Rules:
- If the user asks for exact values, rankings, or anything that depends on dataset.csv, call get_dataset_csv BEFORE answering.
- If the user asks about chart layout/axes/structure that requires the chart image, call get_chart_image_file_id BEFORE answering.
- Do not invent numbers; use the CSV for exact values.`;

  const instructions = `${prePrompt}\n\n${toolPolicy}`;

  // ---------- State ----------
  const [messages, setMessages] = useState<ChatMessage[]>(provenanceState?.messages ?? []);
  const messagesRef = useRef<ChatMessage[]>(provenanceState?.messages ?? []);

  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);

  useEffect(() => {
    if (provenanceState) {
      setMessages(provenanceState.messages);
    } else {
      setMessages([]);
    }
    setPreviousResponseId(null);
  }, [provenanceState]);

  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
    messagesRef.current = messages;
  }, [messages, onMessagesUpdate]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studyId = useStudyId();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    const headerHeight = 80;
    if (messagesEndRef.current) {
      const scrollArea = messagesEndRef.current.parentElement;
      if (scrollArea) {
        const endRect = messagesEndRef.current.getBoundingClientRect();
        const scrollAreaRect = scrollArea.getBoundingClientRect();
        const offset = endRect.bottom - scrollAreaRect.bottom + headerHeight;
        scrollArea.scrollTop += offset;
      } else {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [messages]);

  // ---------- Tools ----------
  const toolDefinitions = [
    {
      type: 'function',
      name: 'get_dataset_csv',
      description: 'Return dataset.csv for the clustered heatmap as JSON { csv: string }.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_chart_image_file_id',
      description: 'Return JSON { file_id: string } for the clustered heatmap image.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  ] as const;

  const executeToolCall = async (call: OpenAIFunctionCall): Promise<ToolResult> => {
    if (call.name === 'get_dataset_csv') {
      const csvResponse = await fetch(`${PREFIX}${studyId}/assets/data/clustered-heatmap.csv`);
      if (!csvResponse.ok) {
        throw new Error('Failed to load dataset CSV for clustered-heatmap');
      }
      const csv = await csvResponse.text();
      return { name: call.name, output: { csv } };
    }

    if (call.name === 'get_chart_image_file_id') {
      const fileId = 'file-2jqhMr5MJe3bxfvXeaJYpd'; // Clustered Heatmap image file-7oYLNxSQQrn81bHMPi1E8A
      return { name: call.name, output: { file_id: fileId } };
    }

    throw new Error(`Unknown tool: ${call.name}`);
  };

  const tryExtractFunctionCalls = (data: unknown): OpenAIFunctionCall[] => {
    if (!data || typeof data !== 'object' || !('output' in data)) {
      return [];
    }

    const { output } = data as ToolSelectionResponse;
    if (!Array.isArray(output)) {
      return [];
    }

    return output.filter((item): item is OpenAIFunctionCall => (
      !!item
      && typeof item === 'object'
      && 'type' in item
      && item.type === 'function_call'
      && 'name' in item
      && (item.name === 'get_dataset_csv' || item.name === 'get_chart_image_file_id')
      && 'call_id' in item
      && typeof item.call_id === 'string'
    ));
  };

  // ---------- Streaming ----------
  const streamAssistantResponse = async (
    inputPayload: StreamInputItem[],
    streamPreviousResponseId?: string | null,
  ) => {
    const response = await fetch(
      `${import.meta.env.VITE_OPENAI_API_URL}/v1/responses`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5.2',
          stream: true,
          store: true,
          truncation: 'auto',
          instructions,
          tools: toolDefinitions,
          tool_choice: 'auto',
          input: inputPayload,
          temperature: 0.7,
          max_output_tokens: 1600,
          ...(streamPreviousResponseId ? { previous_response_id: streamPreviousResponseId } : {}),
        }),
      },
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to start stream: ${response.status} ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      display: true,
    };

    let firstTokenSeen = false;
    let streamedResponseId: string | null = null;
    let streamDone = false;
    let buffer = '';

    const processDecodedLines = (lines: string[]) => {
      let shouldStop = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr) {
            if (dataStr === '[DONE]') {
              streamDone = true;
              shouldStop = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr) as StreamEvent;

              if (parsed.type === 'response.created') {
                streamedResponseId = parsed.response?.id || parsed.response_id || streamedResponseId;
              }

              if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  setIsLoading(false);

                  setMessages((prev) => [
                    ...prev,
                    { ...assistantMessage, content: parsed.delta as string },
                  ]);
                }

                assistantMessage.content += parsed.delta;

                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), { ...last, content: assistantMessage.content }];
                  }
                  return prev;
                });
              }

              if (parsed.type === 'response.output_text.done' || parsed.type === 'response.output_item.done') {
                streamedResponseId = parsed.response?.id || parsed.response_id || streamedResponseId;
              }
            } catch (err) {
              console.warn('Failed to parse SSE line', dataStr, err);
            }
          }
        }
      }

      return shouldStop;
    };

    const readStream = async () => {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      const shouldStop = processDecodedLines(lines);
      if (!shouldStop && !streamDone) {
        await readStream();
      }
    };

    await readStream();

    if (!firstTokenSeen) {
      setIsLoading(false);
    }

    return { assistantMessage, streamedResponseId };
  };

  // ---------- Tool selection (non-stream) ----------
  const requestToolSelection = async (
    userInputItem: UserTextInputItem,
    priorResponseId: string | null,
  ): Promise<ToolSelectionResponse> => {
    const response = await fetch(`${import.meta.env.VITE_OPENAI_API_URL}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.2',
        stream: false,
        store: true,
        truncation: 'auto',
        instructions,
        tools: toolDefinitions,
        tool_choice: 'auto',
        input: [userInputItem],
        // Keep this call small; we just want tool requests, not a full answer here.
        max_output_tokens: 64,
        temperature: 0,
        ...(priorResponseId ? { previous_response_id: priorResponseId } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Tool selection failed: ${response.status} ${errorText || response.statusText}`);
    }

    return response.json();
  };

  // ---------- Submit ----------
  const handleSubmit = async (e: React.FormEvent<Element>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
      display: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    try {
      const priorResponseId = previousResponseId;

      const userInputItem: UserTextInputItem = {
        role: 'user',
        content: [{ type: 'input_text', text: userMessage.content }],
      };

      // 1) Non-stream call to decide whether tools are needed.
      const firstData = await requestToolSelection(userInputItem, priorResponseId);

      const firstResponseId: string | null = firstData?.id || firstData?.response?.id || null;
      const functionCalls = tryExtractFunctionCalls(firstData);

      if (!functionCalls.length) {
        // No tools requested -> stream the answer directly.
        const streamResult = await streamAssistantResponse([userInputItem], priorResponseId);
        if (streamResult.streamedResponseId) setPreviousResponseId(streamResult.streamedResponseId);

        const fullMessages = messagesRef.current;
        trrack.apply('updateMessages', actions.updateMessages(fullMessages));
        updateProvenanceState(fullMessages);
        return;
      }

      // Tools requested -> execute and continue the same response.
      if (firstResponseId) setPreviousResponseId(firstResponseId);

      const toolResults = await Promise.all(functionCalls.map((call) => executeToolCall(call)));
      const functionCallOutputs: FunctionOutputInputItem[] = [];
      let pendingImageFileId: string | null = null;

      functionCalls.forEach((call, index) => {
        const toolResult = toolResults[index];
        if (toolResult.name === 'get_chart_image_file_id') {
          pendingImageFileId = 'file_id' in toolResult.output ? toolResult.output.file_id : null;
        }

        functionCallOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(toolResult.output), // ✅ structured tool output
        });
      });

      // If an image was requested, include it as context for the streaming continuation.
      const streamInputPayload: StreamInputItem[] = [...functionCallOutputs];
      if (pendingImageFileId) {
        streamInputPayload.push({
          role: 'user',
          content: [
            {
              type: 'input_image',
              file_id: pendingImageFileId,
            },
          ],
        });
      }

      // 2) Stream the final answer by continuing from the tool-requesting response.
      const streamResult = await streamAssistantResponse(streamInputPayload, firstResponseId);
      if (streamResult.streamedResponseId) setPreviousResponseId(streamResult.streamedResponseId);

      const fullMessages = messagesRef.current;
      trrack.apply('updateMessages', actions.updateMessages(fullMessages));
      updateProvenanceState(fullMessages);
    } catch (err) {
      console.error('Error getting LLM response:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Card shadow="md" radius="lg" p="lg" withBorder>
      <Text size="lg" fw={600} mb="md">
        AI Assistant Chat
      </Text>
      <Divider my="sm" />
      {/* Messages Container */}
      <ScrollArea style={{ flex: 1, minHeight: rem(270), marginBottom: rem(16) }} offsetScrollbars>
        {messages.length === 0 ? (
          <Flex direction="column" align="center" justify="center" py="xl" style={{ color: '#6B7280' }}>
            <IconMessage size={48} style={{ opacity: 0.5, marginBottom: rem(12) }} />
            <Text size="lg" fw={500} mb={4}>Start a conversation</Text>
            <Text size="sm" color="dimmed">
              Ask me anything about the clustered heatmap on the left!
            </Text>
          </Flex>
        ) : (
          <Flex direction="column" gap="md">
            {messages.map((message) => message.display && (
              <Flex
                key={new Date(message.timestamp).toISOString()}
                justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
              >
                <Paper
                  shadow={message.role === 'user' ? 'md' : 'xs'}
                  radius="md"
                  p="md"
                  withBorder
                  style={{
                    maxWidth: 400,
                    backgroundColor: message.role === 'user' ? '#228be6' : '#f8f9fa',
                    color: message.role === 'user' ? '#fff' : '#212529',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <Text size="sm">{message.content}</Text>
                  )}
                  <Text size="xs" mt={4} color={message.role === 'user' ? 'blue.1' : 'gray.6'}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </Paper>
              </Flex>
            ))}
          </Flex>
        )}
        {isLoading && (
          <Flex justify="flex-start" mt="md">
            <Paper shadow="xs" radius="md" p="md" withBorder style={{ backgroundColor: '#f8f9fa', color: '#212529' }}>
              <Group gap="xs">
                <Loader size="sm" color="gray" />
                <Text size="sm">AI is thinking...</Text>
              </Group>
            </Paper>
          </Flex>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>
      {/* Error Display */}
      {error && (
        <Paper mb="md" p="sm" radius="md" withBorder style={{ backgroundColor: '#fff0f0', borderColor: '#ffe3e3' }}>
          <Text color="red" size="sm">{error}</Text>
        </Paper>
      )}
      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: rem(8) }}>
        <Textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me about the chart..."
          minRows={2}
          maxRows={4}
          disabled={isLoading}
          aria-label="Type your message"
          style={{ flex: 1 }}
          autosize
        />
        <Button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          variant="filled"
          color="blue"
          px={rem(16)}
          aria-label="Send message"
          style={{ alignSelf: 'flex-end' }}
        >
          <IconSend size={18} />
        </Button>
      </form>
      <Text mt="md" size="xs" color="dimmed">
        Press Enter to send, Shift+Enter for new line. All conversations are recorded for research purposes.
      </Text>
    </Card>
  );
}
