# Introduction

This demo study illustrates how to integrate an **LLM-based chatbot** into the ReVISit platform.

In this demo study, participants can ask questions about a visualization in an LLM chatbot. The model provides contextual, streaming responses that evolve with the conversation while remaining lightweight and efficient.


## Features

This study is developed with the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses), which is the new and recommended API by OpenAI.

### Context Management

The Responses API does not automatically remember context between turns (the Assistants API is stateful by default but will be [deprecated on August 26, 2026](https://platform.openai.com/docs/assistants/migration)). To achieve coherent multi-turn interactions, this demo implements a compact history strategy:

* Preserve recent turns: The last 5 messages (user and assistant) are included in each request.
* Summarize older history: Earlier conversation parts are periodically summarized into a short summary by a lightweight `gpt-4o-mini` call.
* Combined context: The system prompt, short summary, and recent messages are passed as input each time.

This balances memory continuity with low token cost.

### Streaming Responses

* Responses are streamed token by token for a smooth real-time interaction similar to ChatGPT in the browser.
* The front-end React component decodes incoming Server-Sent Events (SSE) from the OpenAI API proxy and updates the chat window dynamically.


### File Inputs

The chatbot accepts both data files and visual images:

* CSV file: The dataset associated with the visualization.
* PNG image: The chart image used for visual reference.

In this example, the CSV file is sent inline as text, and the PNG image is sent via OpenAI file storage. The chatbot uses the OpenAI file system to provide structured file inputs: files (such as the chart image and data) are uploaded to OpenAI’s file storage and referenced in API calls using a `file_id` (e.g., `"file-8ppKBEn7v3HWDqRe1LLKCw"` for a specific image). This approach avoids re-sending large file content in every request, speeds up repeated access, and increases reliability compared to sending raw base64-encoded data. For each input, provide the corresponding `file_id` in the payload (see the [OpenAI File API documentation](https://platform.openai.com/docs/api-reference/files) for details).


### System Prompt and Configuration
The system prompt defines the chatbot’s initial behavior and can be customized per study condition. In this implementation it is set in `ChatInterface.tsx` as `prePrompt` and passed as the initial system message for every request. Researchers can test different prompts by editing that string.

### Provenance and Chat History

* Provenance of user interaction is tracked by Trrack.
* The full chat history can be downloaded as JSON in the study results.

## How to use it

### API key

We provide a proxy server for the OpenAI API ([https://github.com/visdesignlab/openai-api-proxy](https://github.com/visdesignlab/openai-api-proxy)).

Please configure your OpenAI API credentials there and deploy the server following the instructions in the repository.

In `.env`, set `VITE_OPENAI_API_URL` to your deployed proxy URL (for example, `https://your-proxy.example.com`).

### Customization

In `ChatInterface.tsx`, the most relevant customizable parameters are:

* Chart image (PNG file) and dataset (CSV file): Update the CSV fetch and the `file_id` used for the input image.
* `prePrompt`: Customize the system prompt that guides the chatbot’s responses.
* `model`: Choose any [OpenAI model](https://platform.openai.com/docs/models) (e.g., `gpt-4o`) to suit your research needs.
* `max_output_tokens`: Set the maximum length for LLM responses.
* `temperature`: Control the randomness and creativity of the LLM output (lower = more deterministic).
* Summarization settings: `summaryPrompt`, model, `temperature`, and `max_output_tokens` for the summarization step used in chat context compression.
* Context window sizes: How many messages to keep in memory before summarizing (e.g., keep last 5, summarize when >5).
