import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import Ajv from 'ajv';



// Load the actual JSON schemas from the Revisit project
let globalConfigSchema: any = null;
let studyConfigSchema: any = null;
let globalValidate: any = null;
let studyValidate: any = null;

async function loadSchemas() {
  try {
    const fs = await import('fs/promises');
    
    // Load global config schema
    const globalSchemaPath = path.join(__dirname, '..', '..', 'src', 'parser', 'GlobalConfigSchema.json');
    const globalSchemaContent = await fs.readFile(globalSchemaPath, 'utf-8');
    globalConfigSchema = JSON.parse(globalSchemaContent);
    
    // Load study config schema
    const studySchemaPath = path.join(__dirname, '..', '..', 'src', 'parser', 'StudyConfigSchema.json');
    const studySchemaContent = await fs.readFile(studySchemaPath, 'utf-8');
    studyConfigSchema = JSON.parse(studySchemaContent);
    
    // Initialize AJV validators
    const ajv1 = new Ajv();
    ajv1.addSchema(globalConfigSchema);
    globalValidate = ajv1.getSchema('#/definitions/GlobalConfig');
    
    const ajv2 = new Ajv();
    ajv2.addSchema(studyConfigSchema);
    studyValidate = ajv2.getSchema('#/definitions/StudyConfig');
    
  } catch (error) {
    console.error('Failed to load schemas:', error);
  }
}

// Validation function for global config (following Revisit's approach)
function validateGlobalConfig(data: any): { isValid: boolean; errors: any[] } {
  if (!globalValidate) {
    return { isValid: false, errors: [{ message: 'Schema not loaded' }] };
  }
  
  const schemaValid = globalValidate(data) as boolean;
  const schemaErrors = globalValidate.errors || [];
  
  // Additional custom validation (like Revisit's verifyGlobalConfig)
  const customErrors: any[] = [];
  if (data.configsList && data.configs) {
    data.configsList.forEach((configName: string) => {
      if (!data.configs[configName]) {
        customErrors.push({ 
          message: `Config ${configName} is not defined in configs object, but is present in configsList`,
          instancePath: '/configsList',
          params: { action: 'add the config to the configs object or remove it from configsList' }
        });
      }
    });
  }
  
  return {
    isValid: schemaValid && customErrors.length === 0,
    errors: [...schemaErrors, ...customErrors]
  };
}

// Helper function to check if a component is an inherited component
function isInheritedComponent(comp: any): boolean {
  return comp && typeof comp === 'object' && comp.baseComponent !== undefined;
}

// Helper function to check if a sequence is a dynamic block
function isDynamicBlock(sequence: any): boolean {
  return sequence && sequence.order === 'dynamic';
}

// Helper function to get flat map of components from sequence (including interruptions)
function getSequenceFlatMapWithInterruptions(sequence: any): string[] {
  const components: string[] = [];
  
  if (isDynamicBlock(sequence)) {
    return components; // Dynamic blocks can't be statically analyzed
  }
  
  if (!sequence.components || !Array.isArray(sequence.components)) {
    return components;
  }
  
  sequence.components.forEach((component: any) => {
    if (typeof component === 'string') {
      components.push(component);
    } else if (component && typeof component === 'object') {
      // Recursively handle nested blocks
      components.push(...getSequenceFlatMapWithInterruptions(component));
    }
  });
  
  // Handle interruptions
  if (sequence.interruptions && Array.isArray(sequence.interruptions)) {
    sequence.interruptions.forEach((interruption: any) => {
      if (interruption.components && Array.isArray(interruption.components)) {
        interruption.components.forEach((comp: any) => {
          if (typeof comp === 'string') {
            components.push(comp);
          }
        });
      }
    });
  }
  
  return components;
}

// Helper function to verify skip logic
function verifyStudySkip(
  sequence: any,
  skipTargets: string[] = [],
  errors: any[] = []
): string[] {
  if (isDynamicBlock(sequence)) {
    return skipTargets; // Can't verify skip logic for dynamic blocks
  }

  // Base case: empty sequence
  if (!sequence.components || sequence.components.length === 0) {
    errors.push({
      message: 'Sequence has an empty components array',
      instancePath: '/sequence/',
      params: { action: 'remove empty components block' },
    });
    return skipTargets;
  }

  // If the block has an ID, remove it from the skipTargets array
  if (sequence.id) {
    const idxToRemove = skipTargets
      .map((target, idx) => (target === sequence.id ? idx : null))
      .filter(idx => idx !== null);
    idxToRemove.forEach((idx, i) => {
      skipTargets.splice(idx - i, 1);
    });
  }

  // Process components
  sequence.components.forEach((component: any) => {
    if (typeof component === 'string') {
      // If the component is a string, check if it is in the skipTargets array
      const idxToRemove = skipTargets
        .map((target, idx) => (target === component ? idx : null))
        .filter(idx => idx !== null);
      idxToRemove.forEach((idx, i) => {
        skipTargets.splice(idx - i, 1);
      });
    } else if (component && typeof component === 'object') {
      // Recursive case: component is a block
      verifyStudySkip(component, skipTargets, errors);
    }
  });

  // If this block has a skip, add the skip.to component to the skipTargets array
  if (sequence.skip && Array.isArray(sequence.skip)) {
    sequence.skip.forEach((skip: any) => {
      if (skip.to && skip.to !== 'end') {
        skipTargets.push(skip.to);
      }
    });
  }

  return skipTargets;
}

// Validation function for study config (following Revisit's approach)
function validateStudyConfig(data: any): { isValid: boolean; errors: any[] } {
  if (!studyValidate) {
    return { isValid: false, errors: [{ message: 'Schema not loaded' }] };
  }
  
  const schemaValid = studyValidate(data) as boolean;
  const schemaErrors = studyValidate.errors || [];
  
  // Additional custom validation (like Revisit's verifyStudyConfig)
  const customErrors: any[] = [];
  
  if (data.components && typeof data.components === 'object') {
    Object.entries(data.components).forEach(([componentName, component]: [string, any]) => {
      // Verify baseComponent is defined in baseComponents object
      if (isInheritedComponent(component) && !data.baseComponents?.[component.baseComponent]) {
        customErrors.push({
          message: `Base component \`${component.baseComponent}\` is not defined in baseComponents object`,
          instancePath: `/components/${componentName}`,
          params: { action: 'add the base component to the baseComponents object' },
        });
      }
    });
  }

  // Verify components are well defined in sequence
  if (data.sequence) {
    const usedComponents = getSequenceFlatMapWithInterruptions(data.sequence);
    
    usedComponents.forEach((componentName) => {
      // Verify component is defined in components object
      if (!data.components?.[componentName]) {
        const isBaseComponent = data.baseComponents?.[componentName];
        customErrors.push({
          message: isBaseComponent
            ? `Component \`${componentName}\` is a base component and cannot be used in the sequence`
            : `Component \`${componentName}\` is not defined in components object`,
          instancePath: '/sequence/',
          params: { action: 'add the component to the components object' },
        });
      }
    });
  }

  // Verify skip blocks are well defined
  if (data.sequence) {
    const missingSkipTargets = verifyStudySkip(data.sequence, [], customErrors);
    missingSkipTargets.forEach((skipTarget) => {
      customErrors.push({
        message: `Skip target \`${skipTarget}\` does not occur after the skip block it is used in`,
        instancePath: '/sequence/',
        params: { action: 'add the target to the sequence after the skip block' },
      });
    });
  }

  // Validate response types and their properties
  if (data.components && typeof data.components === 'object') {
    Object.entries(data.components).forEach(([componentName, component]: [string, any]) => {
      if (component.response && Array.isArray(component.response)) {
        component.response.forEach((response: any, responseIndex: number) => {
          const responsePath = `/components/${componentName}/response/${responseIndex}`;
          
          // Validate response type
          if (!response.type) {
            customErrors.push({
              message: 'Response must have a type',
              instancePath: responsePath,
              params: { action: 'specify a response type' },
            });
          }
          
          // Validate new response types
          if (response.type === 'textOnly') {
            // TextOnly responses don't need required fields
            if (response.required !== undefined) {
              customErrors.push({
                message: 'TextOnly responses cannot be required',
                instancePath: responsePath,
                params: { action: 'remove the required field from TextOnly response' },
              });
            }
          }
          
          // Validate matrix responses
          if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
            if (!response.answerOptions) {
              customErrors.push({
                message: 'Matrix responses must have answerOptions',
                instancePath: responsePath,
                params: { action: 'add answerOptions to matrix response' },
              });
            }
            if (!response.questionOptions || !Array.isArray(response.questionOptions)) {
              customErrors.push({
                message: 'Matrix responses must have questionOptions array',
                instancePath: responsePath,
                params: { action: 'add questionOptions array to matrix response' },
              });
            }
          }
          
          // Validate buttons responses
          if (response.type === 'buttons') {
            if (!response.options || !Array.isArray(response.options)) {
              customErrors.push({
                message: 'Buttons responses must have options array',
                instancePath: responsePath,
                params: { action: 'add options array to buttons response' },
              });
            }
          }
          
          // Validate slider responses
          if (response.type === 'slider') {
            if (!response.options || !Array.isArray(response.options)) {
              customErrors.push({
                message: 'Slider responses must have options array',
                instancePath: responsePath,
                params: { action: 'add options array to slider response' },
              });
            }
          }
        });
      }
    });
  }

  // Validate library usage if importedLibraries are present
  if (data.importedLibraries && Array.isArray(data.importedLibraries)) {
    data.importedLibraries.forEach((libraryName: string, index: number) => {
      if (typeof libraryName !== 'string' || !libraryName.trim()) {
        customErrors.push({
          message: 'Library name must be a non-empty string',
          instancePath: `/importedLibraries/${index}`,
          params: { action: 'provide a valid library name' },
        });
      }
    });
  }

  // Validate UI config enhancements
  if (data.uiConfig) {
    const uiConfig = data.uiConfig;
    
    // Validate screen recording requirements
    if (uiConfig.recordScreen && uiConfig.recordScreenFPS) {
      if (typeof uiConfig.recordScreenFPS !== 'number' || uiConfig.recordScreenFPS <= 0) {
        customErrors.push({
          message: 'recordScreenFPS must be a positive number',
          instancePath: '/uiConfig/recordScreenFPS',
          params: { action: 'provide a valid FPS value' },
        });
      }
    }
    
    // Validate screen size requirements
    if (uiConfig.minWidthSize && (typeof uiConfig.minWidthSize !== 'number' || uiConfig.minWidthSize <= 0)) {
      customErrors.push({
        message: 'minWidthSize must be a positive number',
        instancePath: '/uiConfig/minWidthSize',
        params: { action: 'provide a valid width size' },
      });
    }
    
    if (uiConfig.minHeightSize && (typeof uiConfig.minHeightSize !== 'number' || uiConfig.minHeightSize <= 0)) {
      customErrors.push({
        message: 'minHeightSize must be a positive number',
        instancePath: '/uiConfig/minHeightSize',
        params: { action: 'provide a valid height size' },
      });
    }
  }
  
  return {
    isValid: schemaValid && customErrors.length === 0,
    errors: [...schemaErrors, ...customErrors]
  };
}

// Load schemas on startup
loadSchemas();

const server = new McpServer({
  name: "RevisitMCP",
  description: "This server provide shemas, templates, examples and funcitons to build empirical study using revisit DSL",
  version: "1.0.0",
});

server.registerTool("getversion",
  {
    title: "Get Revisit Version",
    description: "Get the version of Revisit framework",
    inputSchema: {}
  },
  async () => {
    return {
      content: [{ 
        type: "text", 
        text: "Revisit Framework Version: 2.0.0"
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
    return {
      content: [{ 
        type: "text", 
        text: "src/parser/StudyConfigSchema.json"
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
    return {
      content: [{ 
        type: "text", 
        text: "src/parser/types.ts"
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
    const templateData = [
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
      {"path": "public/test-skip-logic", "tags": ["stimuli: markdown", "sequence: fixed", "basecomponent: false", "response: none", "features: skip-logic"]},
      {"path": "public/test-step-logic", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
      {"path": "public/test-uncert", "tags": ["stimuli: generic-web-component", "sequence: fixed", "basecomponent: false", "response: none"]},
      {"path": "public/tutorial", "tags": ["stimuli: markdown", "sequence: fixed", "basecomponent: false", "response: none"]}
    ];
    
    // Add information about new response types and features
    const responseTypesInfo = {
      "newResponseTypes": [
        "textOnly - Display-only text responses for instructions",
        "matrix-radio - Matrix-style radio button responses with rows/columns", 
        "matrix-checkbox - Matrix-style checkbox responses with rows/columns",
        "buttons - Button-based responses with keyboard navigation"
      ],
      "enhancedFeatures": [
        "skip-logic - Advanced skip conditions for complex study flows",
        "interruptions - Deterministic and random breaks/attention checks",
        "dynamic-blocks - Function-based sequence generation",
        "library-system - Import and reuse components from external libraries",
        "styling - CSS styling and external stylesheet support",
        "screen-recording - Audio and screen recording capabilities",
        "enhanced-ui - New UI options like screen size requirements"
      ],
      "responseProperties": [
        "withDivider - Add trailing dividers to responses",
        "withDontKnow - Add 'I don't know' option to responses", 
        "stylesheetPath - External stylesheet support",
        "style - Inline CSS styling",
        "horizontal - Horizontal layout for radio/checkbox",
        "withOther - 'Other' option for radio/checkbox",
        "restartEnumeration - Restart question numbering"
      ]
    };
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          templates: templateData,
          newFeatures: responseTypesInfo
        }, null, 2)
      }]
    };
  }
);


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
- Read a few templates that match the user's requirement as references.

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
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
