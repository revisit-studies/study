import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import { 
  loadSchemas, 
  validateGlobalConfig, 
  validateStudyConfig 
} from './utils';




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
      {
        "path": "public/demo-click-accuracy-test",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/demo-dynamic",
        "stimuli": ["react-component"], 
        "sequence": ["dynamic"],
        "basecomponent": false,
        "response": ["buttons"],
        "features": []
      },
      {
        "path": "public/demo-html",
        "stimuli": ["website"],
        "sequence": ["fixed"], 
        "basecomponent": false,
        "response": ["numerical"],
        "features": []
      },
      {
        "path": "public/demo-html-input",
        "stimuli": ["website"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/demo-html-trrack",
        "stimuli": ["website"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-image",
        "stimuli": ["image"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["radio", "shortText"],
        "features": []
      },
      {
        "path": "public/demo-reaction-speed",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/demo-screen-recording",
        "stimuli": ["website"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["numerical"],
        "features": ["screen-recording", "audio-recording"]
      },
      {
        "path": "public/demo-style",
        "stimuli": ["markdown", "react-component", "image", "website", "vega", "video"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["textOnly", "shortText", "numerical", "longText", "likert", "matrix-radio", "buttons"],
        "features": ["styling", "external-stylesheets", "matrix-responses", "text-only-responses", "buttons-responses"]
      },
      {
        "path": "public/demo-survey",
        "stimuli": ["markdown"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["text", "radio", "checkbox"],
        "features": []
      },
      {
        "path": "public/demo-temperature-study",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-training",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-upset",
        "stimuli": ["vega"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-vega",
        "stimuli": ["vega"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-video",
        "stimuli": ["video"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/demo-video-slider",
        "stimuli": ["video"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["slider"],
        "features": []
      },
      {
        "path": "public/demo-yaml",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/example-brush-interactions",
        "stimuli": ["vega"],
        "sequence": ["fixed", "random"],
        "basecomponent": true,
        "response": [],
        "features": []
      },
      {
        "path": "public/example-cleveland",
        "stimuli": ["vega"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/example-mvnv",
        "stimuli": ["html"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/example-VLAT-full_fixed",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/example-VLAT-full-randomized",
        "stimuli": ["react-component"],
        "sequence": ["fixed", "random"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/example-VLAT-mini-randomized",
        "stimuli": ["react-component"],
        "sequence": ["fixed", "random"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": []
      },
      {
        "path": "public/html-stimuli/mvnv-study",
        "stimuli": ["html"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/library-beauvis",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": [],
        "features": [],
        "library": "beauvis"
      },
      {
        "path": "public/library-calvi",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": [],
        "features": [],
        "library": "calvi"
      },
      {
        "path": "public/library-color-blindness",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": [],
        "features": [],
        "library": "color-blindness"
      },
      {
        "path": "public/library-demographics",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["text", "radio", "checkbox"],
        "features": [],
        "library": "demographics"
      },
      {
        "path": "public/library-mic-check",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["audio"],
        "features": [],
        "library": "mic-check"
      },
      {
        "path": "public/library-mini-vlat",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": [],
        "library": "mini-vlat"
      },
      {
        "path": "public/library-nasa-tlx",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["slider"],
        "features": [],
        "library": "nasa-tlx"
      },
      {
        "path": "public/library-previs",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": [],
        "features": [],
        "library": "previs"
      },
      {
        "path": "public/library-sus",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["radio"],
        "features": [],
        "library": "sus"
      },
      {
        "path": "public/library-vlat",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": ["reactive"],
        "features": [],
        "library": "vlat"
      },
      {
        "path": "public/test-audio",
        "stimuli": ["vega"],
        "sequence": ["fixed"],
        "basecomponent": true,
        "response": [],
        "features": ["audio-recording"]
      },
      {
        "path": "public/test-library",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/test-likert-matrix",
        "stimuli": ["react-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": ["likert"],
        "features": []
      },
      {
        "path": "public/test-parser-errors",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/test-randomization",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed", "latinSquare"],
        "basecomponent": false,
        "response": [],
        "features": ["latin-square", "interruptions"]
      },
      {
        "path": "public/test-skip-logic",
        "stimuli": ["markdown"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": ["skip-logic", "interruptions"]
      },
      {
        "path": "public/test-step-logic",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/test-uncert",
        "stimuli": ["generic-web-component"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      },
      {
        "path": "public/tutorial",
        "stimuli": ["markdown"],
        "sequence": ["fixed"],
        "basecomponent": false,
        "response": [],
        "features": []
      }
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
        "audio-recording - Audio recording functionality",
        "latin-square - Latin square experimental design for balanced randomization",
        "matrix-responses - Matrix-style responses with rows and columns",
        "text-only-responses - Display-only text responses for instructions",
        "buttons-responses - Button-based responses with keyboard navigation",
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
  // Load schemas before starting the server
  await loadSchemas();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
