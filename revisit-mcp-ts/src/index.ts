import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import fs from 'fs/promises';
import yaml from 'yaml';
import {
  loadSchemas,
  validateGlobalConfig,
  validateStudyConfig
} from './utils';
import fs from 'fs';

const debugLogPath = "/Users/dyr429/Workspace/revisit-latest/.cursor/debug.log";

function debugLog(payload: Record<string, unknown>) {
  try {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/20547c30-f61e-4d2d-a5bf-8584288c671f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {
      fs.appendFileSync(debugLogPath, `${JSON.stringify(payload)}\n`);
    });
    // #endregion agent log
  } catch {
    fs.appendFileSync(debugLogPath, `${JSON.stringify(payload)}\n`);
  }
}

process.on("uncaughtException", (error) => {
  debugLog({
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "H7",
    location: "revisit-mcp-ts/index.ts:uncaughtException",
    message: "Uncaught exception",
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: Date.now()
  });
});

process.on("unhandledRejection", (reason) => {
  debugLog({
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "H7",
    location: "revisit-mcp-ts/index.ts:unhandledRejection",
    message: "Unhandled rejection",
    data: { reason: String(reason) },
    timestamp: Date.now()
  });
});

process.on("exit", (code) => {
  debugLog({
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "H7",
    location: "revisit-mcp-ts/index.ts:exit",
    message: "Process exiting",
    data: { code },
    timestamp: Date.now()
  });
});




const server = new McpServer({
  name: "RevisitMCP",
  description: "This server provides schemas, templates, examples, and functions to build empirical studies using the Revisit DSL",
  version: "1.0.0",
});

server.registerTool("getversion",
  {
    title: "Get Revisit Version",
    description: "Get the version of Revisit framework",
    inputSchema: {}
  },
  async () => {
    const studyRoot = path.resolve(__dirname, '..', '..');
    const primaryPath = path.resolve(studyRoot, 'package.json');
    const fallbackPath = path.resolve(__dirname, '..', '..', 'package.json');
    let version = 'unknown';

    try {
      const raw = await fs.readFile(primaryPath, 'utf-8');
      version = JSON.parse(raw)?.version || version;
    } catch (primaryError) {
      try {
        const raw = await fs.readFile(fallbackPath, 'utf-8');
        version = JSON.parse(raw)?.version || version;
      } catch (fallbackError) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Unable to read Revisit version from package.json.\nPrimary: ${primaryPath}\nFallback: ${fallbackPath}`
          }]
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: `Revisit Framework Version: ${version}`
      }]
    };
  }
);



server.registerTool("getcitation",
  {
    title: "Get Revisit Citation",
    description: "Get the BibTeX citation for Revisit framework",
    inputSchema: {}
  },
  async () => {
    return {
      content: [{
        type: "text",
        text: `@INPROCEEDINGS{revisit,
  author={Ding, Yiren and Wilburn, Jack and Shrestha, Hilson and Ndlovu, Akim and Gadhave, Kiran and Nobre, Carolina and Lex, Alexander and Harrison, Lane},
  booktitle={2023 IEEE Visualization and Visual Analytics (VIS)},
  title={reVISit: Supporting Scalable Evaluation of Interactive Visualizations},
  year={2023},
  volume={},
  number={},
  pages={31-35},
  keywords={Training;Costs;Visual analytics;Data visualization;Data collection;Market research;Task analysis;Human-centered computing;Software prototype;Visualization systems and tools;Empirical Study},
  doi={10.1109/VIS54172.2023.00015}}`
      }]
    };
  }
);

server.registerTool("getconfigschema",
  {
    title: "Get Config Schema",
    description: "Get the path to Revisit config file schema",
    inputSchema: {}
  },
  async () => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'src', 'parser', 'StudyConfigSchema.json');
    return {
      content: [{
        type: "text",
        text: schemaPath
      }]
    };
  }
);

server.registerTool("gettypes",
  {
    title: "Get Types Definition",
    description: "Get the path to Revisit types definition file",
    inputSchema: {}
  },
  async () => {
    const typesPath = path.resolve(__dirname, '..', '..', 'src', 'parser', 'types.ts');
    return {
      content: [{
        type: "text",
        text: typesPath
      }]
    };
  }
);




server.registerTool("getstudytemplatemetadata",
  {
    title: "Get Study Template Metadata",
    description: "Get metadata for all available study templates",
    inputSchema: {}
  },
  async () => {
    const {
      templates,
      responseTypes,
      features,
      responseProperties
    } = await buildStudyTemplateMetadata();

    const responseTypesInfo = {
      newResponseTypes: responseTypes,
      enhancedFeatures: features,
      responseProperties
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          templates,
          newFeatures: responseTypesInfo
        }, null, 2)
      }]
    };
  }
);

type TemplateMetadata = {
  path: string;
  stimuli: string[];
  sequence: string[];
  basecomponent: boolean;
  response: string[];
  features: string[];
  library?: string;
};

const RESPONSE_PROPERTY_KEYS = [
  'withDivider',
  'withDontKnow',
  'stylesheetPath',
  'style',
  'horizontal',
  'withOther',
  'restartEnumeration'
];

async function buildStudyTemplateMetadata(): Promise<{
  templates: TemplateMetadata[];
  responseTypes: string[];
  features: string[];
  responseProperties: string[];
}> {
  const studyRoot = path.resolve(__dirname, '..', '..');
  const publicDir = path.resolve(studyRoot, 'public');
  const templates: TemplateMetadata[] = [];

  const responseTypes = new Set<string>();
  const featureFlags = new Set<string>();
  const responseProperties = new Set<string>();

  const candidateDirs: string[] = [];
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(publicDir, entry.name);
    if (entry.name === 'libraries') {
      const libraryEntries = await fs.readdir(entryPath, { withFileTypes: true });
      for (const libraryEntry of libraryEntries) {
        if (libraryEntry.isDirectory()) {
          candidateDirs.push(path.join(entryPath, libraryEntry.name));
        }
      }
      continue;
    }

    candidateDirs.push(entryPath);
  }

  for (const directory of candidateDirs) {
    const configPath = await findConfigFile(directory);
    if (!configPath) {
      continue;
    }

    const config = await parseConfig(configPath);
    if (!config || typeof config !== 'object') {
      continue;
    }

    const relativePath = path.relative(studyRoot, directory);
    const templatePath = relativePath.startsWith('public')
      ? relativePath
      : path.join('public', relativePath);

    const metadata = extractTemplateMetadata(config, templatePath, responseTypes, featureFlags, responseProperties);
    templates.push(metadata);
  }

  templates.sort((a, b) => a.path.localeCompare(b.path));

  return {
    templates,
    responseTypes: Array.from(responseTypes).sort(),
    features: Array.from(featureFlags).sort(),
    responseProperties: Array.from(responseProperties).sort()
  };
}

async function findConfigFile(directory: string): Promise<string | null> {
  const configCandidates = ['config.json', 'config.yaml', 'config.yml'];
  for (const fileName of configCandidates) {
    const filePath = path.join(directory, fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function parseConfig(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return yaml.parse(raw);
    }

    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function extractTemplateMetadata(
  config: any,
  templatePath: string,
  responseTypes: Set<string>,
  featureFlags: Set<string>,
  responseProperties: Set<string>
): TemplateMetadata {
  const stimuli = new Set<string>();
  const responses = new Set<string>();
  const features = new Set<string>();

  const components = config.components && typeof config.components === 'object' ? config.components : {};
  Object.values(components).forEach((component: any) => {
    if (!component || typeof component !== 'object') {
      return;
    }

    if (component.type && component.type !== 'questionnaire') {
      stimuli.add(component.type);
    }

    if (Array.isArray(component.response)) {
      component.response.forEach((response: any) => {
        if (!response || typeof response !== 'object') {
          return;
        }

        if (response.type) {
          responses.add(response.type);
          responseTypes.add(response.type);
        }

        RESPONSE_PROPERTY_KEYS.forEach((key) => {
          if (key in response) {
            responseProperties.add(key);
          }
        });
      });
    }
  });

  const sequenceOrders = new Set<string>();
  collectSequenceMetadata(config.sequence, sequenceOrders, features);

  if (config.importedLibraries && Array.isArray(config.importedLibraries) && config.importedLibraries.length > 0) {
    features.add('library-system');
  }

  if (findBooleanFlag(config, 'recordScreen')) {
    features.add('screen-recording');
  }

  if (findBooleanFlag(config, 'recordAudio')) {
    features.add('audio-recording');
  }

  if (findKey(config, 'stylesheetPath')) {
    features.add('external-stylesheets');
  }

  if (findKey(config, 'style')) {
    features.add('styling');
  }

  if (responses.has('matrix-radio') || responses.has('matrix-checkbox')) {
    features.add('matrix-responses');
  }

  if (responses.has('textOnly')) {
    features.add('text-only-responses');
  }

  if (responses.has('buttons')) {
    features.add('buttons-responses');
  }

  if (Array.from(responses).some((type) => type.startsWith('ranking-'))) {
    features.add('ranking-responses');
  }

  const basecomponent = Boolean(config.baseComponents && Object.keys(config.baseComponents).length > 0);

  const metadata: TemplateMetadata = {
    path: templatePath,
    stimuli: Array.from(stimuli).sort(),
    sequence: Array.from(sequenceOrders).sort(),
    basecomponent,
    response: Array.from(responses).sort(),
    features: Array.from(features).sort()
  };

  if (templatePath.includes('public/libraries/')) {
    metadata.library = templatePath.split('public/libraries/')[1]?.split('/')[0];
  } else if (templatePath.includes('public/library-')) {
    metadata.library = templatePath.split('public/library-')[1]?.split('/')[0];
  }

  features.forEach((feature) => featureFlags.add(feature));

  return metadata;
}

function collectSequenceMetadata(sequence: any, orders: Set<string>, features: Set<string>): void {
  if (!sequence || typeof sequence !== 'object') {
    return;
  }

  if (sequence.order) {
    orders.add(sequence.order);
    if (sequence.order === 'dynamic') {
      features.add('dynamic-blocks');
    }
    if (sequence.order === 'latinSquare') {
      features.add('latin-square');
    }
  }

  if (Array.isArray(sequence.skip) && sequence.skip.length > 0) {
    features.add('skip-logic');
  }

  if (Array.isArray(sequence.interruptions) && sequence.interruptions.length > 0) {
    features.add('interruptions');
    sequence.interruptions.forEach((interruption: any) => {
      collectSequenceMetadata(interruption, orders, features);
    });
  }

  if (Array.isArray(sequence.components)) {
    sequence.components.forEach((component: any) => {
      if (component && typeof component === 'object') {
        collectSequenceMetadata(component, orders, features);
      }
    });
  }
}

function findBooleanFlag(value: any, key: string): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (key in value && value[key] === true) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => findBooleanFlag(item, key));
  }

  return Object.values(value).some((item) => findBooleanFlag(item, key));
}

function findKey(value: any, key: string): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (key in value) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => findKey(item, key));
  }

  return Object.values(value).some((item) => findKey(item, key));
}


server.registerTool("generatestudyprompt",
  {
    title: "Generate Study Prompt",
    description: "Generate an enhanced prompt for creating a Revisit study based on user description",
    inputSchema: {
      description: z.string().describe("The user's study description")
    }
  },
  async ({ description }) => {
    const enhancedPrompt = `# 🎯 Task: Generate an Empirical Study using the Revisit Framework

You are tasked with generating a study configuration using the **Revisit Framework**. This involves creating a folder structure, DSL config file, and assets based on the user's description.
Check the study config schema first, then check a few template studies similar to the user's description based on their tags before starting to build the study.

---

## 📥 User's Study Description:
${description}

---

## 🧩 Before creating the study:
- Call "getconfigschema" to get the schema file location.
- Call "getstudytemplatemetadata" to retrieve existing study template metadata.
- Be sure to read a few templates that match closely to the user's requirement as references.

---

## 📁 Folder Structure & Files:
- Create a new folder under: \`public/\`
- Place the following inside that folder:
  - The generated config file (DSL format)
  - All related assets (e.g., JSON, images, etc.)

---

## 🆕 New Response Types Available:
- **textOnly**: Display-only text responses for instructions (cannot be required)
- **matrix-radio**: Matrix-style radio buttons with rows/columns (requires answerOptions and questionOptions)
- **matrix-checkbox**: Matrix-style checkboxes with rows/columns (requires answerOptions and questionOptions)
- **buttons**: Button-based responses with keyboard navigation (requires options array)

## 🆕 Enhanced Response Features:
- **withDivider**: Add trailing dividers to responses
- **withDontKnow**: Add "I don't know" option to responses
- **stylesheetPath**: External stylesheet support
- **style**: Inline CSS styling (React CSSProperties)
- **horizontal**: Horizontal layout for radio/checkbox
- **withOther**: "Other" option for radio/checkbox
- **restartEnumeration**: Restart question numbering (for textOnly)

## 🆕 Advanced Study Flow Features:
- **Skip Logic**: Use skip conditions for complex study flows
- **Interruptions**: Add deterministic or random breaks/attention checks
- **Dynamic Blocks**: Use function-based sequence generation
- **Library System**: Import and reuse components from external libraries

## ⚛️ React Component Support:
- If the study stimuli is a React component:
  - Create the React component under: \`src/public/\`
  - Use existing templates with react-component stimuli as reference
  - If the response type is reactive, in config file, the id in response need to be passed to react component use parameters for each trial. So taskid in all trials should be same as in response. 

---

## ⚛️ Important Notes:
- You can leave author and organization fields empty in the config file.
- You can create \`basecomponent\` if many components share common attributes, but **do not** put response attributes into \`basecomponent\`.
- "$schema", "uiconfig", "studymetadata", "components", and "sequence" are required for every config file.
- The chart generation function in chart generator MCP should return the URL of the image.
- For matrix responses, use predefined answer options like 'satisfaction5', 'satisfaction7', 'likely5', 'likely7' or provide custom arrays.

---

## 🧠 Final Integration:
- Use 'validatestudyconfig' tool to validate study config you generated.
- Don't forget to add the generated study to the **global config file** so it becomes accessible.
- Use 'validateglobalconfig' tool to validate global config.`;

    return {
      content: [{
        type: "text",
        text: enhancedPrompt
      }]
    };
  }
);



server.registerTool("validateglobalconfig",
  {
    title: "Global Config Validator",
    description: "Validate the global.json config file specifically",
    inputSchema: {}
  },
  async () => {
    try {
      const fs = await import('fs/promises');
      const filePath = path.join(__dirname, '..', '..', 'public', 'global.json');


      let fileContent: string;
      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
      } catch (readError) {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to read global config file '${filePath}': ${readError instanceof Error ? readError.message : 'Unknown error'}`
          }]
        };
      }

      let data: any;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to parse JSON from global config file '${filePath}': ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          }]
        };
      }

      // Validate global config structure
      const validationResult = validateGlobalConfig(data);

      if (validationResult.isValid) {
        // Additional checks specific to global config
        const configCount = Object.keys(data.configs || {}).length;
        const listCount = (data.configsList || []).length;

        return {
          content: [{
            type: "text",
            text: `✅ Global config file '${filePath}' is valid!\n\n📊 Summary:\n• Total configs defined: ${configCount}\n• Configs in list: ${listCount}\n• All configs properly referenced: ✅`
          }]
        };
      } else {
        const errorMessages = validationResult.errors.map(error => {
          if (error.instancePath && error.message) {
            return `You have an error at ${error.instancePath}: ${error.message}${error.params?.action ? ` - ${JSON.stringify(error.params)}` : ''}`;
          }
          return `• ${error.message || error}`;
        });

        return {
          content: [{
            type: "text",
            text: `❌ Global config file '${filePath}' validation failed:\n\n${errorMessages.join('\n')}`
          }]
        };
      }

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Global config validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.registerTool("validatestudyconfig",
  {
    title: "Study Config Validator",
    description: "Validate study config files",
    inputSchema: {
      filePath: z.string().describe("Path to the study config file to validate")
    }
  },
  async ({ filePath }) => {
    try {
      const fs = await import('fs/promises');

      // Resolve relative path from MCP project root
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', '..', filePath);

      let fileContent: string;
      try {
        fileContent = await fs.readFile(resolvedPath, 'utf-8');
      } catch (readError) {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to read study config file '${resolvedPath}': ${readError instanceof Error ? readError.message : 'Unknown error'}`
          }]
        };
      }

      let data: any;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to parse JSON from study config file '${filePath}': ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          }]
        };
      }

      // Validate study config structure
      const validationResult = validateStudyConfig(data);

      if (validationResult.isValid) {
        // Additional checks specific to study config
        const componentCount = Object.keys(data.components || {}).length;
        const baseComponentCount = Object.keys(data.baseComponents || {}).length;
        const importedLibrariesCount = (data.importedLibraries || []).length;

        return {
          content: [{
            type: "text",
            text: `✅ Study config file '${resolvedPath}' is valid!\n\n📊 Summary:\n• Components defined: ${componentCount}\n• Base components: ${baseComponentCount}\n• Imported libraries: ${importedLibrariesCount}\n• All required fields present: ✅`
          }]
        };
      } else {
        const errorMessages = validationResult.errors.map(error => {
          if (error.instancePath && error.message) {
            return `You have an error at ${error.instancePath}: ${error.message}${error.params?.action ? ` - ${JSON.stringify(error.params)}` : ''}`;
          }
          return `• ${error.message || error}`;
        });

        return {
          content: [{
            type: "text",
            text: `❌ Study config file '${resolvedPath}' validation failed:\n\nThere was an issue loading the study config. Please check the following issues:\n\n${errorMessages.join('\n')}`
          }]
        };
      }

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Study config validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);





(async () => {
  try {
    debugLog({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "revisit-mcp-ts/index.ts:startup",
      message: "MCP server starting",
      data: { nodeVersion: process.version, cwd: process.cwd(), argv: process.argv },
      timestamp: Date.now()
    });
    // Load schemas before starting the server
    debugLog({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "revisit-mcp-ts/index.ts:startup",
      message: "Loading schemas",
      data: {},
      timestamp: Date.now()
    });
    await loadSchemas();
    debugLog({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "revisit-mcp-ts/index.ts:startup",
      message: "Schemas loaded",
      data: {},
      timestamp: Date.now()
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    debugLog({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "revisit-mcp-ts/index.ts:startup",
      message: "MCP server connected",
      data: {},
      timestamp: Date.now()
    });
  } catch (error) {
    debugLog({
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "H7",
      location: "revisit-mcp-ts/index.ts:startup",
      message: "MCP server failed",
      data: { error: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now()
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to start Revisit MCP server: ${message}`);
    process.exit(1);
  }
})();
