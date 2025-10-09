import {
  useState, useRef, useEffect, useMemo,
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
  Box,
} from '@mantine/core';
import { ChatMessage, ChatProvenanceState } from './types';
import { StimulusParams } from '../../../store/types';
import { Trrack } from '@trrack/core';
import { ActionCreatorWithPayload } from '@reduxjs/toolkit';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface(
  { modality, chartType, setAnswer, provenanceState, testSystemPrompt, onClose, trrack, actions, updateProvenanceState, modalOpened }:
  {
    modality: 'tactile' | 'text',
    chartType: 'violin-plot' | 'clustered-heatmap',
    setAnswer: StimulusParams<never>['setAnswer'],
    provenanceState?: ChatProvenanceState,
    testSystemPrompt?: string,
    onClose?: () => void,
    trrack: Trrack<{
        messages: never[];
        modalOpened: boolean;
    }, string>,
    actions: {
      updateMessages: ActionCreatorWithPayload<ChatMessage[], string>;
      modalOpened: ActionCreatorWithPayload<boolean, string>;
    },
    updateProvenanceState: (messages: unknown[], modalOpened: boolean) => void,
    modalOpened: boolean,
  },
) {


  // Define the system prompt
  const prePrompt = modality === 'tactile'
    ? `This is a tactile chart exploration session. You will be provided with tactile instructions to explore the chart.
    Please follow the tactile instructions carefully and ask the AI assistant any questions you have about the chart.
    
    IMPORTANT: You will receive both the CSV data and the visual image for the chart. Use them to:
    1. Analyze the CSV data to understand the underlying data structure, statistics, and relationships
    2. Interpret the visual image to understand how the data is represented graphically
    3. Combine both data and visual analysis to provide comprehensive, accurate answers
    4. When appropriate, suggest Python code examples for data analysis
    5. Help participants understand the connection between the raw data and the visual representation`
    : `This is a text-based learning session about ${chartType.replace('-', ' ')} charts.
    You will receive text instructions to help you understand the chart. Feel free to ask the AI assistant any questions you have about the chart.
    
    IMPORTANT: You will receive both the CSV data and the visual image for the chart. Use them to:
    1. Analyze the CSV data to understand the underlying data structure, statistics, and relationships
    2. Interpret the visual image to understand how the data is represented graphically
    3. Combine both data and visual analysis to provide comprehensive, accurate answers
    4. When appropriate, suggest Python code examples for data analysis
    5. Help participants understand the connection between the raw data and the visual representation`;

  const initialMessages: ChatMessage[] = useMemo(() => [
    {
      role: 'system',
      content: testSystemPrompt || `${prePrompt}`,
      timestamp: new Date().getTime(),
      display: false,
    },
  ], [chartType, prePrompt, testSystemPrompt]);

  // Local React states for chat history
  const [messages, setMessages] = useState<ChatMessage[]>([...initialMessages]);
  const [shortSummary, setShortSummary] = useState<string>(""); // short summary of the old conversation

  // Load existing provenance state
  useEffect(() => {
    if (provenanceState) {
      setMessages(provenanceState.messages);
    } else {
      setMessages([...initialMessages]);
    }
  }, [provenanceState, initialMessages]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);



    // ---------- Compact session memory ----------

    async function summarizeHistory(oldMessages: ChatMessage[]) {
      const summaryPrompt = `
      Summarize the following conversation between the user and assistant.
      Capture important facts, conclusions, and tone, but omit greetings or filler.
    
      Conversation:
      ${oldMessages.map(m => `${m.role}: ${m.content}`).join("\n")}
      `;
    
      const resp = await fetch(`${import.meta.env.VITE_OPENAI_API_URL}/v1/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [{ role: "system", content: [{ type: "input_text", text: summaryPrompt }] }],
          max_output_tokens: 250,
          temperature: 0.3,
        }),
      });
    
      const data = await resp.json();
      const text = data.output?.[0]?.content?.[0]?.text || "";
      setShortSummary(prev => prev ? `${prev}\n${text}` : text);
    }

    const getCompactContext = (msgList: ChatMessage[]) => {
      const recent = msgList.slice(-5);
      const context = [];
    
      context.push({
        role: "system",
        content: [{ type: "input_text", text: initialMessages[0].content }],
      });
    
      if (shortSummary) {
        context.push({
          role: "system",
          content: [{ type: "input_text", text: `Summary of earlier conversation:\n${shortSummary}` }],
        });
        console.log("shortSummary:", shortSummary);
      }
    
      recent.forEach((m) => {
        if (m.role === "assistant") {
          context.push({
            role: "assistant",
            content: [{ type: "output_text", text: m.content }],
          });
        } else {
          context.push({
            role: m.role,
            content: [{ type: "input_text", text: m.content }],
          });
        }
      });
    
      return context;
    };
    

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const headerHeight = 80; // Adjust this value to match your header's height in px
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  // handleSubmit(): Triggered when the user presses Enter or clicks Send.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!inputValue.trim() || isLoading) return;
  
    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().getTime(),
      display: true,
    };
  
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);
  
    try {
      // Load CSV data (small enough to inline)
      const csvResponse = await fetch(`/demo-llm-chatbot/data/${chartType}.csv`);
      const csvData = await csvResponse.text();
  
      // Build input for Responses API
      const inputPayload = [
        // Context
        ...getCompactContext(messages),
        // Current user turn (with CSV + image)
        {
          role: "user",
          content: [
            { type: "input_text", text: userMessage.content },
            {
              type: "input_text",
              text: `Here is the CSV data for the ${chartType}:\n\n${csvData}`,
            },
            {
              type: "input_image",
              file_id:
                chartType === "violin-plot"
                  ? "file-G2dZ13wc5eGeVUmg8Znb9S" // File ID for Violin Plot
                  : "file-RndV3st6F83sM7y9SKDDkW", // File ID for Clustered Heatmap
            },
          ],
        },
      ];
  
      const response = await fetch(
        `${import.meta.env.VITE_OPENAI_API_URL}/v1/responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            stream: true,
            input: inputPayload,
            temperature: 0.7,
            max_output_tokens: 100,
          }),
        }
      );
  
      
      if (!response.ok || !response.body) {
        throw new Error("Failed to start stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        display: true,
      };

      // Add assistant placeholder
      // setMessages((prev) => [...prev, assistantMessage]);

      let firstTokenSeen = false;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        console.log("RAW CHUNK:", chunk); // 👈 log what the proxy sends
      
      
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") return; // end of stream
            try {
              const parsed = JSON.parse(dataStr);
              console.log("PARSED SSE DATA:", parsed);
            
              if (parsed.type === "response.output_text.delta") {

                // first token arrived
                if (!firstTokenSeen) {
                  firstTokenSeen = true;
                  setIsLoading(false); // hide the loader "AI is thinking"

                  // create assistant message only when first token arrives
                  setMessages((prev) => [
                    ...prev,
                    { ...assistantMessage, content: parsed.delta },
                  ]);
                }
                assistantMessage.content += parsed.delta;
            
                // update React state live
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return [...prev.slice(0, -1), { ...last, content: assistantMessage.content }];
                  }
                  return prev;
                });
              }
            
              if (parsed.type === "response.output_text.done" || parsed.type === "response.output_item.done") {
                console.log("FINAL:", assistantMessage.content);
              }
            } catch (err) {
              console.warn("Failed to parse SSE line", dataStr, err);
            }            
          }
        }

      }
      

      // Add the new messages
      const fullMessages = [...messages, userMessage, assistantMessage];

      // Summarize older messages if chat too long
      if (fullMessages.length > 5) {
        const oldPart = fullMessages.slice(0, -6); // summarize older ones, keep last 6
        await summarizeHistory(oldPart);
      }
  
      trrack.apply("updateMessages", actions.updateMessages(fullMessages));
  
      // setAnswer({
      //   status: true,
      //   provenanceGraph: trrack.graph.backend,
      //   answers: {
      //     // messages: JSON.stringify([...messages, userMessage, assistantMessage]),
      //     messages: JSON.stringify(fullMessages),
      //   },
      // });
      updateProvenanceState(fullMessages, modalOpened);
  
    } catch (err) {
      console.error("Error getting LLM response:", err);
      setError(err instanceof Error ? err.message : "Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box mah="100%" p="md">
      <Divider my="sm" />
      {/* Messages Container */}
      <ScrollArea style={{ flex: 1, minHeight: rem(320), marginBottom: rem(16) }} offsetScrollbars>
        {messages.length === 0 ? (
          <Flex direction="column" align="center" justify="center" py="xl" style={{ color: '#6B7280' }}>
            <IconMessage size={48} style={{ opacity: 0.5, marginBottom: rem(12) }} />
            <Text size="lg" fw={500} mb={4}>Start a conversation</Text>
            <Text size="sm" color="dimmed">
              Ask me anything about
              {' '}
              {chartType.replace('-', ' ')}
              s!
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
                  components={{
                    p: ({ node, ...props }) => <Text size="sm" {...props} />,
                    li: ({ node, ...props }) => (
                      <li style={{ marginLeft: 16 }} {...props} />
                    ),
                    code: ({ inline, children, ...props }: any) => (
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
                    ),
                  }}
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
          onKeyPress={handleKeyPress}
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
      {/* Accessibility Info */}
      <Text mt="md" size="xs" color="dimmed">
        Press Enter to send, Shift+Enter for new line. All conversations are recorded for research purposes.
      </Text>
    </Box>
  );
}
