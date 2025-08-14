import { McpServer, ResourceTemplate  } from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';



// Validation schemas for config files
const GlobalConfigSchema = {
  type: "object",
  required: ["configsList", "configs"],
  properties: {
    configsList: {
      type: "array",
      items: { type: "string" }
    },
    configs: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
};

const StudyConfigSchema = {
  type: "object",
  required: ["$schema", "uiConfig", "studyMetadata", "components", "sequence"],
  properties: {
    $schema: { type: "string" },
    uiConfig: { type: "object" },
    studyMetadata: { type: "object" },
    components: { type: "object" },
    sequence: { type: "object" },
    baseComponents: { type: "object" },
    importedLibraries: {
      type: "array",
      items: { type: "string" }
    }
  }
};

// Validation function for global config
function validateGlobalConfig(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.configsList || !Array.isArray(data.configsList)) {
    errors.push("configsList must be an array");
  }
  
  if (!data.configs || typeof data.configs !== 'object') {
    errors.push("configs must be an object");
  }
  
  // Verify all configsList items exist in configs
  if (data.configsList && data.configs) {
    data.configsList.forEach((configName: string) => {
      if (!data.configs[configName]) {
        errors.push(`Config '${configName}' is not defined in configs object, but is present in configsList`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validation function for study config
function validateStudyConfig(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.$schema) errors.push("$schema is required");
  if (!data.uiConfig) errors.push("uiConfig is required");
  if (!data.studyMetadata) errors.push("studyMetadata is required");
  if (!data.components) errors.push("components is required");
  if (!data.sequence) errors.push("sequence is required");
  
  // Check components structure
  if (data.components && typeof data.components === 'object') {
    Object.entries(data.components).forEach(([name, component]: [string, any]) => {
      if (component.baseComponent && !data.baseComponents?.[component.baseComponent]) {
        errors.push(`Base component '${component.baseComponent}' is not defined in baseComponents object`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

const server = new McpServer({
  name: "RevisitMCP",
  description: "This server provide shemas, templates, examples and funcitons to build empirical study using revisit DSL",
  version: "1.0.0",
});

server.registerResource(
  "version",
  "revisit://version",
  {
    title: "Revisit Version",
    description: "The version of revisit",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "2.0.0"
    }]
  })
);



server.registerResource(
  "citation",
  "revisit://citation",
  {
    title: "Revisit Citation",
    description: "The BibTeX citation for Revisit",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
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
  })
);

server.registerResource(
  "Config Schema",
  "revisit://configschema",
  {
    title: "Revisit Config File Schema",
    description: "The Schema Definition of Revisit Config File",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "src/parser/StudyConfigSchema.json"
    }]
  })
);

server.registerResource(
  "Types",
  "revisit://types",
  {
    title: "Revisit Types defition",
    description: "The Types Definition of Revisit Config File",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "src/parser/types.ts"
    }]
  })
);




server.registerResource(
  "Template Study Metadata",
  "revisit://studytemplatemeta",
  {
    title: "Revisit Study Templates Metadata",
    description: "Get template study meta data.",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify([
            {"path": "public/demo-click-accuracy-test", "tags": ["stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: reactive"]},
            {"path": "public/demo-dynamic", "tags": ["stimuli: react-component", "sequence: dynamic", "basecomponent: false", "response: buttons"]},
            {"path": "public/demo-html", "tags": ["stimuli: website", "sequence: fixed", "basecomponent: false", "response: numerical"]},
            {"path": "public/demo-html-input", "tags": ["stimuli: website", "sequence: fixed", "basecomponent: true", "response: reactive"]},
            {"path": "public/demo-html-trrack", "tags": ["stimuli: website", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-image", "tags": ["stimuli: image", "sequence: fixed", "basecomponent: false", "response: radio, shortText"]},
            {"path": "public/demo-reaction-speed", "tags": ["stimuli: react-component", "sequence: fixed", "basecomponent: false", "response: reactive"]},
            {"path": "public/demo-survey", "tags": ["stimuli: markdown", "sequence: fixed", "basecomponent: false", "response: text, radio, checkbox"]},
            {"path": "public/demo-temperature-study", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-training", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-upset", "tags": ["stimuli: vega", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-vega", "tags": ["stimuli: vega", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-video", "tags": ["stimuli: video", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/demo-video-slider", "tags": ["stimuli: video", "sequence: fixed", "basecomponent: false", "response: slider"]},
            {"path": "public/demo-yaml", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/example-brush-interactions", "tags": ["stimuli: vega", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/example-cleveland", "tags": ["stimuli: vega", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/example-mvnv", "tags": ["stimuli: html", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/example-VLAT-full_fixed", "tags": ["stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: reactive"]},
            {"path": "public/example-VLAT-full-randomized", "tags": ["stimuli: react-component", "sequence: randomized", "basecomponent: true", "response: reactive"]},
            {"path": "public/example-VLAT-mini-randomized", "tags": ["stimuli: react-component", "sequence: randomized", "basecomponent: true", "response: reactive"]},
            {"path": "public/html-stimuli/mvnv-study", "tags": ["stimuli: html", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/library-beauvis", "tags": ["library: beauvis", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: none"]},
            {"path": "public/library-calvi", "tags": ["library: calvi", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: none"]},
            {"path": "public/library-color-blindness", "tags": ["library: color-blindness", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: none"]},
            {"path": "public/library-demographics", "tags": ["library: demographics", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: text, radio, checkbox"]},
            {"path": "public/library-mic-check", "tags": ["library: mic-check", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: audio"]},
            {"path": "public/library-mini-vlat", "tags": ["library: mini-vlat", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: reactive"]},
            {"path": "public/library-nasa-tlx", "tags": ["library: nasa-tlx", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: slider"]},
            {"path": "public/library-previs", "tags": ["library: previs", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: none"]},
            {"path": "public/library-sus", "tags": ["library: sus", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: radio"]},
            {"path": "public/library-vlat", "tags": ["library: vlat", "stimuli: react-component", "sequence: fixed", "basecomponent: true", "response: reactive"]},
            {"path": "public/test-audio", "tags": ["stimuli: audio", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/test-library", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/test-likert-matrix", "tags": ["stimuli: react-component", "sequence: fixed", "basecomponent: false", "response: likert"]},
            {"path": "public/test-parser-errors", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/test-randomization", "tags": ["stimuli: generic-web-component", "sequence: randomized", "basecomponent: false", "response: none"]},
            {"path": "public/test-skip-logic", "tags": ["stimuli: markdown", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/test-step-logic", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/test-uncert", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
            {"path": "public/tutorial", "tags": ["stimuli: markdown", "sequence: fixed", "basecomponent: false", "response: none"]}
        ])
      }]
  })
);


server.registerResource(
  "prompt enhancer",
  new ResourceTemplate("revisit://promptenhancer/{name}", { list: undefined }),
  { 
    title: "Prompt Enhancer",      // Display name for UI
    description: "Enahnce the study description"
  },
  async (uri, { description }) => ({
    contents: [{
      uri: uri.href,
                text: `
# 🎯 Task: Generate an Empirical Study using the Revisit Framework

You are tasked with generating a study configuration using the **Revisit Framework**. This involves creating a folder structure, DSL config file, and assets based on the user's description.
Check the study config schema first, then check a few template studies similar to the user's description based on their tags before starting to build the study.

---

## 📥 User's Study Description:
${description}

---

## 🧩 Before creating the study:
- Call "revisit://studyschema" to get the schema file location.
- Call "revisit://studytemplate" to retrieve existing study template metadata.
- Read a few templates that match the user's requirement as references.

---

## 📁 Folder Structure & Files:
- Create a new folder under: \`public/\`
- Place the following inside that folder:
  - The generated config file (DSL format)
  - All related assets (e.g., JSON, images, etc.)

---

## ⚛️ React Component Support:
- If the study stimuli is a React component:
  - Create the React component under: \`src/public/\`
  - Use existing templates with react-component stimuli as reference
  - If the response type is reactive,in config file, the id in response need to be passed to react component use parameters for each trial. So taskid in all trials should be same as in response. 

---

## ⚛️ Note:
- You can leave author and organization fields empty in the config file.
- You can create \`basecomponent\` if many components share common attributes, but **do not** put response attributes into \`basecomponent\`.
- "$schema", "uiconfig", "studymetadata", "components", and "sequence" are required for every config file.
- The chart generation function in chart generator MCP should return the URL of the image.

---

## 🧠 Final Integration:
- Use 'validateStudyConfig' tool to validate study config you generated.
- Don’t forget to add the generated study to the **global config file** so it becomes accessible.
- Use 'validateglobalconfig' tool to validate global config.
`
    }]
  })
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
        return {
          content: [{ 
            type: "text", 
            text: `❌ Global config file '${filePath}' validation failed:\n\n${validationResult.errors.map(error => `• ${error}`).join('\n')}`
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
      filePath: z.string()
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
        return {
          content: [{ 
            type: "text", 
            text: `❌ Study config file '${resolvedPath}' validation failed:\n\n${validationResult.errors.map(error => `• ${error}`).join('\n')}`
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
