import { guidanceGraph } from './guidanceGraph.js';
import { evaluationGraph } from './evaluationGraph.js';
import { visualEvalGraph } from './visualEvalGraph.js';
import { Logger } from '../utils/logging.js';
import type { Graph } from '@inworld/runtime/graph';
import type { GraphTypes } from '@inworld/runtime/common';

const logger = new Logger('InworldService');

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp?: number;
  userId?: string;
  [key: string]: unknown;
}

interface EvaluationScores {
  professionalism: number;
  friendliness: number;
  helpfulness: number;
}

interface ProcessTranscriptResult {
  transcript: TranscriptEntry;
  guidance: string;
  scores: EvaluationScores;
}

// Store transcript history
let transcriptHistory: TranscriptEntry[] = [];

// Store the graph instances globally to reuse them
let guidanceGraphInstance: Graph | null = null;
let evaluationGraphInstance: Graph | null = null;
let visualEvalGraphInstance: Graph | null = null;

/**
 * Get or create guidance graph instance
 */
function getGuidanceGraph(): Graph {
  if (!guidanceGraphInstance) {
    logger.debug('Creating new guidance graph instance');
    guidanceGraphInstance = guidanceGraph;
  }
  return guidanceGraphInstance;
}

/**
 * Get or create evaluation graph instance
 */
function getEvaluationGraph(): Graph {
  if (!evaluationGraphInstance) {
    logger.debug('Creating new evaluation graph instance');
    evaluationGraphInstance = evaluationGraph;
  }
  return evaluationGraphInstance;
}

/**
 * Get or create visual evaluation graph instance
 */
function getVisualEvalGraph(): Graph {
  if (!visualEvalGraphInstance) {
    logger.debug('Creating new visual evaluation graph instance');
    visualEvalGraphInstance = visualEvalGraph;
  }
  return visualEvalGraphInstance;
}

/**
 * Add a new transcript entry to history
 */
export function addTranscript(
  speaker: string,
  text: string,
  metadata: Record<string, unknown> = {}
): TranscriptEntry {
  const entry: TranscriptEntry = {
    speaker,
    text,
    timestamp: Date.now(),
    ...metadata,
  };

  transcriptHistory.push(entry);

  // Keep only last 50 entries to prevent memory issues
  if (transcriptHistory.length > 50) {
    transcriptHistory = transcriptHistory.slice(-50);
  }

  logger.debug(
    'Added transcript entry. Total entries:',
    transcriptHistory.length
  );
  return entry;
}

/**
 * Get the current transcript history
 */
export function getTranscriptHistory(): TranscriptEntry[] {
  return transcriptHistory;
}

/**
 * Clear transcript history
 */
export function clearTranscriptHistory(): void {
  transcriptHistory = [];
  logger.debug('Cleared transcript history');
}

/**
 * Get guidance based on transcript history
 */
export async function getGuidance(): Promise<string> {
  logger.debug('Getting guidance for transcript history');

  if (transcriptHistory.length === 0) {
    return 'Start speaking to receive guidance on your communication style.';
  }

  try {
    const activeGraph = getGuidanceGraph();
    logger.debug('Using guidance graph instance');

    // Create input for the graph
    const graphInput = { transcript: transcriptHistory };

    logger.debug(
      'Starting graph execution with',
      transcriptHistory.length,
      'entries'
    );
    const { outputStream } = await activeGraph.start(graphInput);

    if (!outputStream) {
      logger.error('No output stream returned from guidance graph');
      return 'Unable to generate guidance at this time.';
    }

    let guidanceText = '';
    let chunkCount = 0;

    // Process the output stream - collect ALL chunks until done
    for await (const result of outputStream) {
      chunkCount++;
      logger.debug(`Processing guidance chunk ${chunkCount}:`, {
        done: result?.done,
        hasData: !!result?.data,
      });

      if (result && result.processResponse) {
        await result.processResponse({
          Content: (response: GraphTypes.Content) => {
            logger.debug(
              `Guidance chunk ${chunkCount} content:`,
              response.content
            );
            // Accumulate content from all chunks
            if (response.content) {
              guidanceText += response.content;
            }
          },
          default: (data: unknown) => {
            logger.debug(
              `Guidance chunk ${chunkCount} unprocessed:`,
              (data as { constructor?: { name?: string } })?.constructor?.name
            );
          },
        });
      }

      // Check if this is the final chunk
      if (result?.done === true) {
        logger.debug('Guidance stream complete after', chunkCount, 'chunks');
        break;
      }
    }

    logger.info('Final guidance:', guidanceText);
    return (
      guidanceText ||
      'Keep up the good work! Continue being friendly, professional, and helpful.'
    );
  } catch (error) {
    logger.error('Error getting guidance:', error);
    return 'Unable to generate guidance at this time.';
  }
}

/**
 * Get evaluation scores based on transcript history
 */
export async function getEvaluationScores(): Promise<EvaluationScores> {
  logger.debug('Getting evaluation scores for transcript history');

  const defaultScores: EvaluationScores = {
    professionalism: 5,
    friendliness: 5,
    helpfulness: 5,
  };

  if (transcriptHistory.length === 0) {
    return defaultScores;
  }

  try {
    const activeGraph = getEvaluationGraph();
    logger.debug('Using evaluation graph instance');

    // Create input for the graph
    const graphInput = { transcript: transcriptHistory };

    logger.debug(
      'Starting evaluation graph execution with',
      transcriptHistory.length,
      'entries'
    );
    const { outputStream } = await activeGraph.start(graphInput);

    if (!outputStream) {
      logger.error('No output stream returned from evaluation graph');
      return defaultScores;
    }

    let scoresText = '';
    let chunkCount = 0;

    // Process the output stream - collect ALL chunks until done
    for await (const result of outputStream) {
      chunkCount++;
      logger.debug(`Processing evaluation chunk ${chunkCount}:`, {
        done: result?.done,
        hasData: !!result?.data,
        contentLength: (result?.data as { content?: string })?.content?.length,
      });

      if (result && result.processResponse) {
        await result.processResponse({
          Content: (response: GraphTypes.Content) => {
            logger.debug(
              `Evaluation chunk ${chunkCount} content:`,
              response.content
            );
            // Accumulate content from all chunks
            if (response.content) {
              scoresText += response.content;
            }
          },
          default: (data: unknown) => {
            logger.debug(
              `Evaluation chunk ${chunkCount} unprocessed:`,
              (data as { constructor?: { name?: string } })?.constructor?.name
            );
          },
        });
      } else if (
        result &&
        result.data &&
        (result.data as { content?: string }).content
      ) {
        // Direct access to content if processResponse is not available
        const content = (result.data as { content: string }).content;
        logger.debug(`Evaluation chunk ${chunkCount} direct content:`, content);
        if (content) {
          scoresText += content;
        }
      }

      // Check if this is the final chunk
      if (result?.done === true) {
        logger.debug('Evaluation stream complete after', chunkCount, 'chunks');
        break;
      }
    }

    logger.debug('Raw scores text:', scoresText);

    // Parse the JSON response
    if (scoresText) {
      try {
        const scores = JSON.parse(scoresText) as Partial<EvaluationScores>;
        logger.info('Parsed scores:', scores);

        // Validate and sanitize scores
        return {
          professionalism: Math.min(
            10,
            Math.max(1, scores.professionalism || 5)
          ),
          friendliness: Math.min(10, Math.max(1, scores.friendliness || 5)),
          helpfulness: Math.min(10, Math.max(1, scores.helpfulness || 5)),
        };
      } catch (parseError) {
        logger.error('Error parsing scores JSON:', parseError);
        return defaultScores;
      }
    }

    return defaultScores;
  } catch (error) {
    logger.error('Error getting evaluation scores:', error);
    return defaultScores;
  }
}

/**
 * Process transcript and get both guidance and scores
 */
export async function processTranscript(
  speaker: string,
  text: string,
  metadata: Record<string, unknown> = {}
): Promise<ProcessTranscriptResult> {
  logger.debug('Processing transcript from', speaker);

  // Add to transcript history
  const entry = addTranscript(speaker, text, metadata);

  // Run guidance and scores in parallel
  const [guidance, scores] = await Promise.all([
    getGuidance(),
    getEvaluationScores(),
  ]);

  logger.info('Processing results - Guidance:', guidance, 'Scores:', scores);

  return {
    transcript: entry,
    guidance,
    scores,
  };
}

/**
 * Process visual evaluation for an image
 */
export async function processVisualEvaluation(
  imagePath: string
): Promise<string> {
  logger.debug('Processing visual evaluation for image:', imagePath);

  try {
    const activeGraph = getVisualEvalGraph();
    logger.debug('Using visual evaluation graph instance');

    // Create input for the graph
    const graphInput = { imagePath: imagePath };

    logger.debug('Starting visual evaluation graph execution');
    const { outputStream } = await activeGraph.start(graphInput);

    if (!outputStream) {
      logger.error('No output stream returned from visual evaluation graph');
      return 'Unable to analyze visual appearance at this time.';
    }

    let feedbackText = '';
    let chunkCount = 0;

    // Process the output stream
    for await (const result of outputStream) {
      chunkCount++;
      logger.debug(`Processing visual eval chunk ${chunkCount}:`, {
        done: result?.done,
        hasData: !!result?.data,
      });

      if (result && result.processResponse) {
        await result.processResponse({
          Content: (response: GraphTypes.Content) => {
            logger.debug(
              `Visual eval chunk ${chunkCount} content:`,
              response.content
            );
            if (response.content) {
              feedbackText += response.content;
            }
          },
          default: (data: unknown) => {
            logger.debug(
              `Visual eval chunk ${chunkCount} unprocessed:`,
              (data as { constructor?: { name?: string } })?.constructor?.name
            );
          },
        });
      }

      if (result?.done === true) {
        logger.debug(
          'Visual evaluation stream complete after',
          chunkCount,
          'chunks'
        );
        break;
      }
    }

    logger.info('Visual evaluation feedback:', feedbackText);
    return (
      feedbackText ||
      'Your visual presentation looks professional. Keep up the good work!'
    );
  } catch (error) {
    logger.error('Error processing visual evaluation:', error);
    return 'Unable to analyze visual appearance at this time.';
  }
}

/**
 * Cleanup and stop all graph instances
 * Call this on process exit to ensure proper cleanup
 */
export async function cleanup(): Promise<void> {
  logger.info('Starting cleanup of Inworld graph instances...');

  try {
    // Stop guidance graph if it exists
    if (guidanceGraphInstance && 'stop' in guidanceGraphInstance) {
      try {
        logger.debug('Stopping guidance graph instance');
        await (guidanceGraphInstance as { stop: () => Promise<void> }).stop();
      } catch (error) {
        logger.debug('Error stopping guidance graph (non-fatal):', error);
      }
      guidanceGraphInstance = null;
    }

    // Stop evaluation graph if it exists
    if (evaluationGraphInstance && 'stop' in evaluationGraphInstance) {
      try {
        logger.debug('Stopping evaluation graph instance');
        await (evaluationGraphInstance as { stop: () => Promise<void> }).stop();
      } catch (error) {
        logger.debug('Error stopping evaluation graph (non-fatal):', error);
      }
      evaluationGraphInstance = null;
    }

    // Stop visual evaluation graph if it exists
    if (visualEvalGraphInstance && 'stop' in visualEvalGraphInstance) {
      try {
        logger.debug('Stopping visual evaluation graph instance');
        await (visualEvalGraphInstance as { stop: () => Promise<void> }).stop();
      } catch (error) {
        logger.debug('Error stopping visual evaluation graph (non-fatal):', error);
      }
      visualEvalGraphInstance = null;
    }

    // Clear transcript history
    clearTranscriptHistory();

    logger.success('Cleanup completed successfully');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Export cleanup as cleanupInworld for backward compatibility
export { cleanup as cleanupInworld };
