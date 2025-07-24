import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { tools } from './tools/allTools.js';
import OpenAI from 'openai';
import { createAssistant } from './openai/createAssistant.js';
import { createThread } from './openai/createThread.js';
import { createRun } from './openai/createRun.js';
import { performRun } from './openai/performRun.js';
import multer from 'multer';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('Onchain Agent API is running.');
});

app.post('/api/tool', async (req, res) => {
  const { tool, params } = req.body;
  if (!tool || typeof tool !== 'string' || !(tool in tools)) {
    return res.status(400).json({ error: 'Unknown or missing tool.' });
  }
  try {
    const result = await tools[tool].handler(params || {});
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let assistantPromise: Promise<any> | null = null;

// Helper to get or create the assistant instance
async function getAssistant() {
  if (!assistantPromise) assistantPromise = createAssistant(openaiClient);
  return assistantPromise;
}

// In-memory status tracking for each run
const runStatus: Record<string, string[]> = {};

app.post('/api/chat', async (req, res) => {
  const { message, threadId } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try {
    const assistant = await getAssistant();
    let thread;
    if (threadId) {
      thread = await openaiClient.beta.threads.retrieve(threadId);
    } else {
      thread = await createThread(openaiClient);
    }
    // Add user message to thread
    await openaiClient.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message
    });
    // Create and perform the run
    const run = await createRun(openaiClient, thread, assistant.id);
    runStatus[run.id] = [];
    runStatus[run.id].push(`🚀 Performing run ${run.id}`);
    // Patch performRun to accept a status callback
    const result = await performRun(run, openaiClient, thread, (statusMsg) => {
      runStatus[run.id].push(statusMsg);
    });
    let reply = '';
    if (result?.type === 'text') {
      reply = result.text.value;
    } else if (typeof result === 'string') {
      reply = result;
    } else {
      reply = 'No response.';
    }
    runStatus[run.id].push(`🚀 Assistant message: ${reply}`);
    res.json({ reply, threadId: thread.id, runId: run.id, assistantId: assistant.id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Status endpoint
app.get('/api/chat/status', (req, res) => {
  const { runId } = req.query;
  res.json({ status: runStatus[runId as string] || [] });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const result = await tools.upload_to_ipfs.handler({ filePath: req.file.path });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Onchain Agent API server listening on http://localhost:${PORT}`);
}); 