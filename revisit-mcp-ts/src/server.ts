import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from 'path';
import fs from 'fs/promises';

// Resolve the Revisit study repo root (this package lives at <root>/revisit-mcp-ts).
const STUDY_ROOT = path.resolve(__dirname, '..', '..');

async function getRevisitVersionTag(): Promise<string> {
  try {
    const globalRaw = await fs.readFile(path.resolve(STUDY_ROOT, 'public', 'global.json'), 'utf-8');
    const schemaUrl = JSON.parse(globalRaw)?.$schema;
    const schemaTag = typeof schemaUrl === 'string' ? schemaUrl.match(/\/(v\d+\.\d+\.\d+)\/src\/parser\//)?.[1] : undefined;
    if (schemaTag) {
      return schemaTag;
    }
  } catch {
    // Fall back to package.json below.
  }

  try {
    const packageRaw = await fs.readFile(path.resolve(STUDY_ROOT, 'package.json'), 'utf-8');
    const packageVersion = JSON.parse(packageRaw)?.version;
    if (packageVersion) {
      return `v${packageVersion}`;
    }
  } catch {
    // Fall back to the main branch schema.
  }
  return 'main';
}

export function createServer(): McpServer {
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
      const versionTag = await getRevisitVersionTag();
      const version = versionTag.startsWith('v') ? versionTag.slice(1) : versionTag;

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
      const schemaPath = path.resolve(STUDY_ROOT, 'src', 'parser', 'StudyConfigSchema.json');
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
      const typesPath = path.resolve(STUDY_ROOT, 'src', 'parser', 'types.ts');
      return {
        content: [{
          type: "text",
          text: typesPath
        }]
      };
    }
  );

  return server;
}
