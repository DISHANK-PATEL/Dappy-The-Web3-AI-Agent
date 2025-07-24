import OpenAI from "openai";
import { Thread } from "openai/resources/beta/threads/threads";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { handleRunToolCalls } from "./handleRunToolCalls.js";

export async function performRun(
  run: Run,
  client: OpenAI,
  thread: Thread,
  statusCallback?: (msg: string) => void
) {
  if (statusCallback) statusCallback(`🚀 Performing run ${run.id}`);

  while (run.status === "requires_action") {
    if (statusCallback) statusCallback(`💾 Handling tool calls for run ${run.id}`);
    run = await handleRunToolCalls(run, client, thread, statusCallback);
  }

  if (run.status === 'failed') {
    const errorMessage = `I encountered an error: ${run.last_error?.message || 'Unknown error'}`;
    if (statusCallback) statusCallback(`❌ Run failed: ${errorMessage}`);
    await client.beta.threads.messages.create(thread.id, {
      role: 'assistant',
      content: errorMessage
    });
    return {
      type: 'text',
      text: {
        value: errorMessage,
        annotations: []
      }
    };
  }

  const messages = await client.beta.threads.messages.list(thread.id);
  const assistantMessage = messages.data.find(message => message.role === 'assistant');

  // Safely extract text from the first content block if it's a text block
  let assistantText = 'No response from assistant';
  if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
    const block = assistantMessage.content[0];
    if ('text' in block && block.text && typeof block.text.value === 'string') {
      assistantText = block.text.value;
    } else if ('image_file' in block) {
      assistantText = '[Image response]';
    }
  }
  if (statusCallback) statusCallback(`🚀 Assistant message: ${assistantText}`);

  return assistantMessage?.content[0] ||
    { type: 'text', text: { value: 'No response from assistant', annotations: [] } };
}
