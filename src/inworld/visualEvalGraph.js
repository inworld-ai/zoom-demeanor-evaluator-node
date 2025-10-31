import 'dotenv/config';
import { 
  GraphBuilder, 
  GraphTypes, 
  RemoteLLMChatNode, 
  CustomNode
} from "@inworld/runtime/graph";
import { Logger } from '../utils/logging.js';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('VisualEvalGraph');

const apiKey = process.env.INWORLD_API_KEY;
if (!apiKey) {
  throw new Error(
    "INWORLD_API_KEY environment variable is not set. Either add it to .env file in the root of the package or export it to the shell."
  );
}

const visualEvaluationPrompt = `You are evaluating the visual appearance and presentation of a person in a video call. 

## Evaluation Focus Areas
1. **Professional Appearance**: Appropriate attire, grooming, and overall presentation
2. **Environment**: Background setting, lighting quality, camera angle
3. **Body Language**: Posture, gestures, facial expressions
4. **Engagement**: Eye contact with camera, attentiveness, energy level
5. **Technical Setup**: Video quality, framing, stability

## Instructions
Provide brief, constructive feedback (1-2 sentences max) about the person's visual presentation.
- Be encouraging and respectful
- Focus on what matters most for professional communication
- If everything looks good, acknowledge that
- If improvements could be made, suggest ONE specific, actionable change
- Never comment on physical attributes beyond professional presentation

Return ONLY your feedback text, no formatting or labels.`;

// Using GPT-4 Vision model for image analysis
const llm = new RemoteLLMChatNode({
  id: "visual-eval-llm",
  provider: "openai",
  modelName: "gpt-4.1",  // Model that supports vision
  textGenerationConfig: { 
    maxNewTokens: 200,
    temperature: 0.7
  }
});

class ImageToEvaluationPromptNode extends CustomNode {
  async process(_context, input) {
    logger.debug('Processing image input:', input.imagePath || 'No image path provided');
    
    // Read the image file if path is provided
    let imageDataUrl = null;
    if (input.imagePath) {
      try {
        // Read image as base64
        const imageBuffer = await fs.readFile(input.imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = input.imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        imageDataUrl = `data:${mimeType};base64,${base64Image}`;
        logger.debug('Successfully read image file, base64 length:', base64Image.length);
      } catch (error) {
        logger.error('Error reading image file:', error);
        throw error;
      }
    } else if (input.imageUrl) {
      imageDataUrl = input.imageUrl;
      logger.debug('Using provided image URL');
    }
    
    if (!imageDataUrl) {
      throw new Error('No image data provided');
    }
    
    // Create multimodal message with image - ensure the structure matches OpenAI's expected format
    const userContent = [
      {
        type: 'text',
        text: 'Please provide feedback on the visual appearance of this agent in the video call.'
      },
      {
        type: 'image',
        image_url: {
          url: imageDataUrl,
          detail: 'low'  // Using 'low' for faster processing
        }
      }
    ];
    
    // Log to verify the content structure
    logger.debug('User content structure:', JSON.stringify(userContent, (key, value) => {
      if (key === 'url' && value && value.length > 100) {
        return value.substring(0, 100) + '...[truncated]';
      }
      return value;
    }, 2));
    
    const messages = [
      {
        role: 'system',
        content: visualEvaluationPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ];
    
    const request = new GraphTypes.LLMChatRequest({
      messages: messages
    });
    
    logger.debug('Created multimodal LLM request with image');
    return request;
  }
}

const imageToPrompt = new ImageToEvaluationPromptNode({
  id: "image-to-visual-prompt"
});

export const visualEvalGraph = new GraphBuilder({ id: 'visual-eval-graph', apiKey })
  .addNode(llm)
  .addNode(imageToPrompt)
  .setStartNode(imageToPrompt)
  .addEdge(imageToPrompt, llm)
  .setEndNode(llm)
  .build();

logger.success('Built visual evaluation graph successfully');
