# Introduction

This demo study shows how to use an LLM-based chatbot in a reVISit study. Participants can ask questions about a clustered heatmap, and the chatbot responds with streaming text. When a question needs exact data values or visual details, the chatbot can request the dataset or the chart image through tools.

All of the input and output is tracked by trrack, so you can analyze how participants interact with the chatbot and what information they request. You could also combine this with audio or screen capture to run a remote unmoderated study.

Below we describe what makes the chatbot good for studies, the core features, and how to customize it.

## Relevant Files:

https://github.com/revisit-studies/study/blob/main/public/example-llm-chatbot/config.json

* [The Config](https://github.com/revisit-studies/study/blob/main/public/example-llm-chatbot/config.json)
* [The React Files](https://github.com/revisit-studies/study/tree/main/src/public/example-llm-chatbot)

## Features

This study uses the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses).

### Conversation Memory

Conversation memory is how the model stays aware of prior turns. In the Responses API, you can link turns by sending `previous_response_id`.

In this chatbot, each request includes `previous_response_id` from the prior response when available. This keeps the chat continuous without sending the full history, which keeps the code and payload small.

Learn more: [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state/)

### Streaming Responses

Streaming returns the reply in small chunks as it is generated. This reduces perceived latency and makes the interface feel responsive.

To enable this, we set `stream: true` for the main answer request and render tokens as they arrive.

Learn more: [Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses/)

### Tool Calls: Send the chart image and dataset only when needed

Tool calling lets the model ask the app to run functions (tools) and then use the results in its answer.

In this study, the model requests the image or the dataset only when a question requires exact values or visual details. This keeps most turns fast and avoids unnecessary data transfer. We expose two tools:
* `get_dataset_csv`: loads the CSV file and returns it as text.
* `get_chart_image_file_id`: returns a pre-uploaded OpenAI `file_id` for the chart image.

To call tools, we use a two-step request flow. A short planning call asks whether tools are needed, and a second call delivers the final answer with the tool results.

Learn more: [Function calling](https://platform.openai.com/docs/guides/function-calling)

### Provenance and Results are Recorded

* Interaction provenance is tracked by Trrack and visible in the participant reply interface.
* You can download the full chat history as JSON or CSV.

## Usage / Customization

### Set up the API Key

We use a proxy server to keep API keys off the client. Use the provided proxy:
[https://github.com/visdesignlab/openai-api-proxy](https://github.com/visdesignlab/openai-api-proxy)

Follow that repo to set your OpenAI API key and deploy the proxy.

In `.env`, set `VITE_OPENAI_API_URL`:
* Local development: `VITE_OPENAI_API_URL="http://localhost:3000"`
* Production: `VITE_OPENAI_API_URL=https://apps.vdl.sci.utah.edu/openai-proxy`

### Request Payloads (what we send to the API)

The Responses API expects a JSON payload, which is the request body sent in `fetch(..., { body: JSON.stringify({ ... }) })` in `ChatInterface.tsx`. In other words, every field inside that JSON object (such as `model`, `instructions`, `tools`, `input`, and so on) is a payload parameter. In this demo, the payload shape is designed to be easy to reason about and to keep data transfer minimal.

There are two requests in this chatbot: a small tool-selection call and a streaming answer call.

**Shared fields (both calls):**
* `model`: which model to use (`gpt-5.2`).
* `instructions`: the system prompt plus tool-use rules.
* `tools` and `tool_choice`: the two available tools and `auto` selection.
* `previous_response_id` (when available): links to the previous turn so the model has conversation memory without sending the full history.

**Tool-selection call (small and focused):**
* `input`: an array with one user item, where content is typed as `input_text`.
* `stream: false`, `max_output_tokens: 64`, and `temperature: 0` to keep the response short and focused on tool requests.

**Streaming answer call (no tools needed):**
* `input`: the same user item as above.
* `stream: true` and `max_output_tokens: 1600` to stream the assistant reply.

**Streaming answer call (tools requested):**
* `input`: an array of `function_call_output` items, one per tool call.
* For the chart image, we also append a user item whose content is `input_image` with the `file_id`.
* The streaming call uses `previous_response_id` from the tool-selection response so the model can continue the same turn.

This layout keeps the payload explicit and predictable: user text is always `input_text`, tool results are always `function_call_output`, and images are passed as `input_image` only when needed.

### Customize the Chatbot

All key settings live in `ChatInterface.tsx`. These are the most relevant parameters:

**Change the assistant behavior (system prompt):**
Edit `prePrompt` and `toolPolicy` to control how the assistant responds and when it should use tools.

Learn more: [System instructions](https://platform.openai.com/docs/guides/responses#system-instructions)

**Change the model:**
Update `model` (currently `gpt-5.2`) in both the tool-selection request and the streaming request.

Learn more: [Model list](https://platform.openai.com/docs/models)

**Change response length and style:**
* `max_output_tokens`: maximum reply length.
* `temperature`: creativity level.

Learn more: [Responses API parameters](https://platform.openai.com/docs/api-reference/responses)

**Change the data or chart image:**
* Dataset: replace `assets/data/clustered-heatmap.csv` to your dataset.
* Chart image: replace the OpenAI `file_id` to your image returned by `get_chart_image_file_id`.

Learn more: [Files API](https://platform.openai.com/docs/api-reference/files)
