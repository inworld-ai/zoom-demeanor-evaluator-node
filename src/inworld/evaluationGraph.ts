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

const logger = new Logger('EvaluationGraph');

const apiKey = process.env.INWORLD_API_KEY;
if (!apiKey) {
  throw new Error(
    'INWORLD_API_KEY environment variable is not set. Either add it to .env file in the root of the package or export it to the shell.'
  );
}

const evaluationPrompt = `## Task
You are evaluating someone's communication style based on a conversation transcript.

## Evaluation Criteria
Score each dimension from 1-10:
1. **Professionalism** (1=very unprofessional, 10=perfectly professional)
   - Appropriate language and tone
   - Maintains boundaries
   - Respectful communication
   
2. **Friendliness** (1=cold/hostile, 10=warm and approachable)
   - Warmth and approachability
   - Positive attitude
   - Personal connection without being overly familiar
   
3. **Helpfulness** (1=unhelpful/obstructive, 10=extremely helpful)
   - Provides value and solutions
   - Answers questions thoroughly
   - Goes above and beyond when appropriate

## Transcript
{% for entry in transcript %}
{{ entry.speaker }}: {{ entry.text }}{% endfor %}

## Instructions
Evaluate the most recent speaker's performance based on the entire conversation context.

You MUST return a valid JSON object in this exact format:
{"professionalism": X, "friendliness": Y, "helpfulness": Z}

Replace X, Y, Z with integer numbers from 1 to 10.
Do not include any other text, explanation, or formatting - ONLY the JSON object.`;

interface EvaluationInput {
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp?: number;
    [key: string]: unknown;
  }>;
}

const llm = new RemoteLLMChatNode({
  id: 'evaluation-llm',
  provider: 'openai',
  modelName: 'gpt-4.1-nano',
  textGenerationConfig: {
    maxNewTokens: 1000, // Increased from 50 to ensure JSON response fits
    temperature: 0.8, // Lower temperature for more consistent JSON output
  },
});

class TranscriptToEvaluationPromptNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: EvaluationInput
  ): Promise<GraphTypes.LLMChatRequest> {
    logger.debug('Processing input with transcript:', input.transcript);

    const renderedPrompt = await renderJinja(evaluationPrompt, {
      transcript: input.transcript || [],
    });

    logger.debug('Rendered prompt length:', renderedPrompt.length);

    const request = new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'system',
          content: renderedPrompt,
        },
        {
          role: 'user',
          content: 'Provide the evaluation scores as JSON.',
        },
      ],
    });

    logger.debug('Created LLM request');
    return request;
  }
}

const transcriptToPrompt = new TranscriptToEvaluationPromptNode({
  id: 'transcript-to-evaluation-prompt',
});

export const evaluationGraph = new GraphBuilder({
  id: 'evaluation-graph',
  apiKey,
})
  .addNode(llm)
  .addNode(transcriptToPrompt)
  .setStartNode(transcriptToPrompt)
  .addEdge(transcriptToPrompt, llm)
  .setEndNode(llm)
  .build();

logger.success('Built evaluation graph successfully');
