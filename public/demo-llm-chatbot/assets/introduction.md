# Introduction

This demo study illustrates how to integrate an **LLM-based chatbot** into the ReVISit platform. In this demo, participants can ask questions about a visualization through the chatbot. The model returns contextual, streaming responses that evolve over the course of the conversation, while remaining lightweight and efficient.

Below, we describe the chatbot’s features and explain how to set up and customize it. Researchers can use this demo as a template to build their own chatbots and adapt them to their study needs.

## Features

This study is developed with the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses), which is the new and recommended API by OpenAI.

### Context Management

The Responses API does not automatically remember context between turns (the Assistants API is stateful by default but will be [deprecated on August 26, 2026](https://platform.openai.com/docs/assistants/migration)). To achieve coherent multi-turn interactions, this demo implements a compact history strategy:

* Preserve recent turns: The last 5 messages (user and assistant) are included in each request.
* Summarize older history: Earlier conversation parts are periodically summarized into a short summary by a lightweight `gpt-4o-mini` call.
* Combined context: The system prompt, short summary, and recent messages are passed as input each time.

This balances memory continuity with low token cost.

### Streaming Responses

In this study, we stream model outputs token by token to create a smooth, real-time interaction similar to ChatGPT in the browser. In the OpenAI Responses API, streaming means the model returns output incrementally (token-by-token or chunk-by-chunk) as it is generated, rather than waiting to send the full response at the end. This reduces perceived latency because users see text immediately, and it enables real-time UI features such as typing indicators, live summaries, and partial results while the remaining output is still being generated.

See OpenAI [Streaming API responses](https://platform.openai.com/docs/guides/streaming-responses?api-mode=chat) for details.

### File Inputs

The chatbot accepts both data files and visual images:

* CSV file: The dataset associated with the visualization.
* PNG image: The chart image used for visual reference.

In this example, the CSV file is sent inline as text, and the PNG image is sent via OpenAI file storage. The chatbot uses the OpenAI file system to provide structured file inputs: files (such as the chart image and data) are uploaded to OpenAI’s file storage and referenced in API calls using a `file_id` (e.g., `"file-8ppKBEn7v3HWDqRe1LLKCw"` for a specific image). This approach avoids re-sending large file content in every request, speeds up repeated access, and increases reliability compared to sending raw base64-encoded data. For each input, provide the corresponding `file_id` in the payload (see the [OpenAI File API documentation](https://platform.openai.com/docs/api-reference/files) for details).


### System Prompt and Configuration
The system prompt defines the chatbot’s initial behavior and can be customized per study condition. In this implementation it is set in `ChatInterface.tsx` as `prePrompt` and passed as the initial system message for every request. Researchers can test different prompts by editing that string.

### Provenance and Chat History

* Provenance of user interaction is tracked by Trrack. Researchers can review all participant interactions in the participant reply interface.
* The full chat history can be downloaded in the study results.

## How to use it

### API key

We provide a proxy server for the OpenAI API ([https://github.com/visdesignlab/openai-api-proxy](https://github.com/visdesignlab/openai-api-proxy)).

Please configure your OpenAI API credentials there and deploy the server following the instructions in the repository.

To use our proxy server, you need to  set `VITE_OPENAI_API_URL` in  `.env`.
For the production version of the study, set `VITE_OPENAI_API_URL="https://github.com/visdesignlab/openai-api-proxy"`. For the local version of the study, set `VITE_OPENAI_API_URL="http://localhost:3000"`.

### Customization

In `ChatInterface.tsx`, the most relevant customizable parameters are:

* Chart image (PNG file) and dataset (CSV file)
* `prePrompt`: Customize the system prompt that guides the chatbot’s responses.
* `model`: Choose any [OpenAI model](https://platform.openai.com/docs/models) (e.g., `gpt-4o`) to suit your research needs.
* `max_output_tokens`: Set the maximum length for LLM responses.
* `temperature`: Control the randomness and creativity of the LLM output (lower = more deterministic).
* Summarization settings: `summaryPrompt`, `model`, `temperature`, and `max_output_tokens` for the summarization step used in chat context compression.
* Context window sizes: How many messages to keep in memory before summarizing (e.g., keep last 5, summarize when >5).
