import {
  afterAll, beforeAll, describe, expect, test,
} from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server';

const STUDY_ROOT = path.resolve(__dirname, '..', '..');

// End-to-end tests: exercise the tools through the MCP protocol using an in-memory transport,
// exactly as an MCP client (e.g. an agent) would call them.
describe('Revisit MCP server', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
  });

  async function callToolText(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    return content[0].text;
  }

  test('exposes all expected tools', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name).sort();
    expect(toolNames).toEqual([
      'getcitation',
      'getconfigschema',
      'gettypes',
      'getversion',
    ]);
  });

  test('getversion returns the version pinned by the global config schema', async () => {
    const globalConfig = JSON.parse(await fs.readFile(path.join(STUDY_ROOT, 'public', 'global.json'), 'utf-8'));
    const version = globalConfig.$schema.match(/\/v(\d+\.\d+\.\d+)\/src\/parser\//)[1];
    const text = await callToolText('getversion');
    expect(text).toBe(`Revisit Framework Version: ${version}`);
  });

  test('getcitation returns the BibTeX citation', async () => {
    const text = await callToolText('getcitation');
    expect(text).toContain('@INPROCEEDINGS{revisit');
    expect(text).toContain('doi={10.1109/VIS54172.2023.00015}');
  });

  test('getconfigschema returns an existing schema path', async () => {
    const text = await callToolText('getconfigschema');
    expect(text).toBe(path.join(STUDY_ROOT, 'src', 'parser', 'StudyConfigSchema.json'));
    await expect(fs.access(text)).resolves.toBeUndefined();
  });

  test('gettypes returns an existing types path', async () => {
    const text = await callToolText('gettypes');
    expect(text).toBe(path.join(STUDY_ROOT, 'src', 'parser', 'types.ts'));
    await expect(fs.access(text)).resolves.toBeUndefined();
  });
});
