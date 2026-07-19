import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import fs from 'fs/promises';
import { STUDY_ROOT, readStudyFile } from '../studyRoot';

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

export function registerInfoTools(server: McpServer): void {
  server.registerTool(
    'getversion',
    {
      title: 'Get Revisit Version',
      description: 'Get the version of Revisit framework',
      inputSchema: {},
    },
    async () => {
      const versionTag = await getRevisitVersionTag();
      const version = versionTag.startsWith('v') ? versionTag.slice(1) : versionTag;

      return {
        content: [{
          type: 'text',
          text: `Revisit Framework Version: ${version}`,
        }],
      };
    },
  );

  server.registerTool(
    'getcitation',
    {
      title: 'Get Revisit Citation',
      description: 'Get BibTeX citations for the reVISit papers (preferred: ReVISit 2 TVCG 2026; also the original VIS 2023 paper)',
      inputSchema: {},
    },
    async () => ({
      content: [{
        type: 'text',
        text: `@ARTICLE{revisit2,
  author={Cutler, Zach and Wilburn, Jack and Shrestha, Hilson and Ding, Yiren and Bollen, Brian and Nadib, Khandaker Abrar and He, Tingying and McNutt, Andrew and Harrison, Lane and Lex, Alexander},
  journal={IEEE Transactions on Visualization and Computer Graphics},
  title={ReVISit 2: A Full Experiment Life Cycle User Study Framework},
  year={2026},
  volume={32},
  number={1},
  pages={13-23},
  keywords={Surveys;Reproducibility of results;Data visualization;Visualization;Libraries;Browsers;Videos;Software;Instruments;Graphical user interfaces;User studies;crowdsourcing;visualization experiments},
  doi={10.1109/TVCG.2025.3633896}}

@INPROCEEDINGS{revisit,
  author={Ding, Yiren and Wilburn, Jack and Shrestha, Hilson and Ndlovu, Akim and Gadhave, Kiran and Nobre, Carolina and Lex, Alexander and Harrison, Lane},
  booktitle={2023 IEEE Visualization and Visual Analytics (VIS)},
  title={reVISit: Supporting Scalable Evaluation of Interactive Visualizations},
  year={2023},
  volume={},
  number={},
  pages={31-35},
  keywords={Training;Costs;Visual analytics;Data visualization;Data collection;Market research;Task analysis;Human-centered computing;Software prototype;Visualization systems and tools;Empirical Study},
  doi={10.1109/VIS54172.2023.00015}}`,
      }],
    }),
  );

  server.registerTool(
    'getconfigschema',
    {
      title: 'Get Config Schema',
      description: 'Get the contents of the Revisit study config JSON schema (src/parser/StudyConfigSchema.json)',
      inputSchema: {},
    },
    async () => {
      const schema = await readStudyFile('src', 'parser', 'StudyConfigSchema.json');
      return {
        content: [{
          type: 'text',
          text: schema,
        }],
      };
    },
  );

  server.registerTool(
    'gettypes',
    {
      title: 'Get Types Definition',
      description: 'Get the contents of the Revisit config TypeScript types (src/parser/types.ts)',
      inputSchema: {},
    },
    async () => {
      const types = await readStudyFile('src', 'parser', 'types.ts');
      return {
        content: [{
          type: 'text',
          text: types,
        }],
      };
    },
  );
}
