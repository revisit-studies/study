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








