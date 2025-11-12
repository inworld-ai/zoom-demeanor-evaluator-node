import 'dotenv/config';
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
  CustomNode,
  ProcessContext,
} from '@inworld/runtime/graph';
import { renderJinja } from '@inworld/runtime/primitives/llm';
import { Logger } from '../utils/logging.js';

const logger = new Logger('GuidanceGraph');

const apiKey = process.env.INWORLD_API_KEY;
if (!apiKey) {
  throw new Error(
    'INWORLD_API_KEY environment variable is not set. Either add it to .env file in the root of the package or export it to the shell.'
  );
}

const guidancePrompt = `## Task
You are a professional communication coach evaluating someone's communication style in real-time.

## Evaluation Criteria
The person should be:
1. **Friendly**: Warm, approachable, and personable without being overly familiar
2. **Professional**: Appropriate language, respectful tone, maintains boundaries
3. **Helpful**: Provides value, answers questions, offers solutions
4. **Not boring**: Engaging, dynamic, shows personality
5. **Not offensive**: Avoids inappropriate topics, respectful of all parties

## Transcript
{% for entry in transcript %}
{{ entry.speaker }}: {{ entry.text }}{% endfor %}

## Instructions
Based on the transcript above, provide brief, actionable guidance (1 sentence max).
- If they're doing well, acknowledge what they're doing right
- If they need improvement, give ONE specific suggestion
- Be encouraging and constructive
- Focus on the most important improvement they could make right now

Return ONLY your guidance text, no formatting or labels.`;

interface GuidanceInput {
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp?: number;
    [key: string]: unknown;
  }>;
}

const llm = new RemoteLLMChatNode({
  id: 'guidance-llm',
  provider: 'groq',
  modelName: 'openai/gpt-oss-120b',
  textGenerationConfig: { maxNewTokens: 500, temperature: 0.7 },
});

class TranscriptToGuidancePromptNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: GuidanceInput
  ): Promise<GraphTypes.LLMChatRequest> {
    const renderedPrompt = await renderJinja(guidancePrompt, {
      transcript: input.transcript || [],
    });

    return new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'system',
          content: renderedPrompt,
        },
      ],
    });
  }
}

const transcriptToPrompt = new TranscriptToGuidancePromptNode({
  id: 'transcript-to-guidance-prompt',
});

export const guidanceGraph = new GraphBuilder({ id: 'guidance-graph', apiKey })
  .addNode(llm)
  .addNode(transcriptToPrompt)
  .setStartNode(transcriptToPrompt)
  .addEdge(transcriptToPrompt, llm)
  .setEndNode(llm)
  .build();

logger.success('Built guidance graph successfully');
