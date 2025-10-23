# Introduction

This demo study illustrates how to integrate an **LLM-based chatbot** into the ReVISit platform to support users in understanding a data visualization interactively.

In this study, participants can ask questions about a visualization. The model provides contextual, streaming responses that evolve with the conversation while remaining lightweight and efficient. This study is developed with the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses), which is the new and recommended API by OpeAI.


## Features

### Context Management

The Responses API does not automatically remember context between turns (The Assistants API is stateful by default but will be [deprecated on August 26, 2026](https://platform.openai.com/docs/assistants/migration)). To achieve coherent multi-turn interactions, this demo implements a compact history strategy:

* Preserve recent turns: The last 5 messages (user and assistant) are included in each request. 
* Summarize older history: Earlier conversation parts are periodically summarized into a short summary by a lightweight GPT-4o-mini call. 
* Combined context: The system prompt, short summary, and recent messages are passed as input each time.

This balances memory continuity with low token cost.

### Streaming Responses

* Responses are streamed token by token for a smooth real-time interaction similar to ChatGPT in the browser.
* The front-end React component decodes incoming Server-Sent Events (SSE) from our OpenAI API proxy and updates the chat window dynamically.


### File Inputs

The chatbot accepts both data files and visual images:

* CSV file: The dataset associated with the visualization.
* PNG image: The chart image used for visual reference.

These files are sent as input_text and input_image entries in the input payload.


### System Prompt and Configuration
The system prompt defines the chatbot’s initial behavior and can be customized per study condition. Researchers can test different prompt by inputing it to the first question in the study, it will be passed to the chatbot.

### Provenance and Chat History

* Provenance of user interaction are all tracked by Trrack.
* The full chat history can be downloaded in a json as the study results.

## How to use it

### API key


### Parameters
