# Revisit MCP (Model Context Protocol) Server

A TypeScript-based MCP server that provides access to Revisit study configurations and components through the Model Context Protocol. This server enables AI assistants and other MCP clients to interact with Revisit studies, validate configurations, and manage study assets.

## 1. Features

- **Configuration Validation**: Validates both global and study-specific configuration files
- **Study Templates**: Access to comprehensive study templates with metadata and categorization
- **Schema Information**: Provides Revisit configuration schemas and type definitions
- **Prompt Enhancement**: Generates enhanced prompts for creating empirical studies
- **Resource Access**: Direct access to Revisit framework resources and documentation

## Tools

### `validateglobalconfig`
Validates the global.json configuration file to ensure all study configurations are properly referenced and structured.

**Input Schema**: None required
**Output**: Validation results with summary of configs and any errors found

### `validatestudyconfig`
Validates individual study configuration files against the Revisit schema requirements.

**Input Schema**: 
- `filePath` (string): Path to the study config file to validate

**Output**: Validation results with component counts and any schema violations

## Resources

### `revisit://version`
Returns the current version of the Revisit framework (2.0.0).

### `revisit://citation`
Provides the BibTeX citation for the Revisit paper from IEEE VIS 2023.

### `revisit://configschema`
Points to the location of the Revisit configuration file schema definition.

### `revisit://types`
Points to the TypeScript type definitions for Revisit configuration files.

### `revisit://studytemplatemeta`
Returns metadata for all available study templates, including:
- Path information
- Stimuli types (React components, websites, images, videos, etc.)
- Sequence types (fixed, randomized, dynamic)
- Base component usage
- Response types (reactive, buttons, numerical, etc.)

### `revisit://promptenhancer/{name}`
Generates enhanced prompts for creating empirical studies using the Revisit framework. Includes:
- Task description and requirements
- Schema validation instructions
- Folder structure guidelines
- React component support notes
- Integration requirements

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Add to Your Agent

#### JSON Example (CLINE):

```json
{
  "mcpServers": {
    "revisit-mcp": {
      "command": "npx",
      "args": [
        "ts-node",
        "<Path to revisit repo>/revisit-mcp-ts/src/index.ts"
      ],
      "env": {}
    }
  }
}
```

#### YAML Example (CONTINUE):

```yaml
name: revisit-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: revisit-mcp
    command: npx
    args:
      - ts-node
      - <Path to revisit repo>/revisit-mcp-ts/src/index.ts
    env: {}
```
#### Or you can ask your coding agent to add it

# Study description system prompt for reVISit

You may also use a general LLM(chatGPT, Gemni) to generate study description. 
You can create a project in chatGPT or a Gem in Gemini (or similar stuff in other LLMs) and use the following system prompt.

```
## Your Role:

You are an expert academic assistant specializing in the meticulous deconstruction and description of empirical studies in research papers. 

## Your Task:

Your primary function is to generate a highly detailed and structured description of a single, specified experiment from a research paper. You will be provided with the relevant materials (e.g., images, React component code, etc.) if necessary. You do not need to describe participants in paper, just focus on experiment itself. Your output must be based exclusively on the provided source material.

## Below is your output template:

[

Create a reVISit study based on description below, call prompt enhancer tool first

This is study description:

## Study Title: [Insert Title of Original Study]

## Summary of the Study:

[Briefly summarize the original study's objective, main hypothesis, and key finding, e.g., "This study investigated the effect of emotional valence on memory recall by presenting participants with positive, neutral, and negative images and testing subsequent recognition accuracy."]





## Experiment Details

[The experiment has X trials in total]



### Trial 1 (you may change trial name to something more descriptive):

The stimuli in Trial 1 is: [Specify stimulus type, e.g., image/markdown/React component].

If Image: Use the image code in paper, e.g., B0-D.

If Text: Use markdown formatting,

If Interactive: Clearly describe the interactive component stimuli.

Trial 1 has [X] questions:

#### Question 1:

- **Question Text:** [Insert Question Text]

- **Format:** [Specify format, e.g., Likert scale/Multiple-choice/Open-ended]

- **Options:** [List all options, e.g., "1 (Strongly Disagree) to 7 (Strongly Agree)," or "A. Option 1, B. Option 2, C. Option 3"]

#### Question 2:

- **Question Text:** [Insert Question Text]

- **Format:** [Specify format]

- **Options:** [List all options]

(Continue this pattern for all questions in this trial)

(Continue this pattern for all trials)


## Sequence description

Elaborate on the sequence, blocks and randomization (if applicable) of trials for this experiment.

Be very clear about how many and what trials participants will see, and what the randomization process is.

]
```





