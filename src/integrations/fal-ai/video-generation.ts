/**
 * fal.ai Integration for Nova26
 * Unified API for video generation models (Kling, LTX-Video, Wan, etc.)
 */

import { fal } from '@fal-ai/client';

// ============================================================================
// Configuration
// ============================================================================

// Initialize with API key from environment
const FAL_API_KEY = process.env.FAL_API_KEY;

if (FAL_API_KEY) {
  fal.config({
    credentials: FAL_API_KEY,
  });
}

// ============================================================================
// Video Generation Models
// ============================================================================

export const VIDEO_MODELS = {
  // Kling - High quality video generation
  KLING: {
    id: 'fal-ai/kling-video/v1/standard/text-to-video',
    description: 'Kling text-to-video model',
    maxDuration: 10,
    supportedResolutions: ['1080p', '720p', '480p'],
  },
  
  // LTX-Video - Fast generation
  LTX: {
    id: 'fal-ai/ltx-video',
    description: 'Lightning-fast video generation',
    maxDuration: 5,
    supportedResolutions: ['720p', '480p'],
  },
  
  // Wan - Open source alternative
  WAN: {
    id: 'fal-ai/wan/video-to-video',
    description: 'Wan video-to-video model',
    maxDuration: 8,
    supportedResolutions: ['720p', '480p'],
  },
  
  // Stable Video Diffusion
  SVD: {
    id: 'fal-ai/stable-video-diffusion',
    description: 'Stable Video Diffusion image-to-video',
    maxDuration: 4,
    supportedResolutions: ['576x1024', '512x896'],
  },
} as const;

export type VideoModel = keyof typeof VIDEO_MODELS;

// ============================================================================
// Types
// ============================================================================

export interface VideoGenerationRequest {
  prompt: string;
  model?: VideoModel;
  negativePrompt?: string;
  duration?: number;
  resolution?: string;
  seed?: number;
}

export interface VideoGenerationResult {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  seed?: number;
  prompt: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface VideoJobStatus {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: {
    video?: {
      url: string;
      content_type: string;
      file_name: string;
      file_size: number;
    };
    seed?: number;
  };
  error?: string;
}

// ============================================================================
// Video Generation Functions
// ============================================================================

/**
 * Generate a video from text prompt
 */
export async function generateVideo(
  request: VideoGenerationRequest
): Promise<VideoGenerationResult> {
  const model = request.model || 'KLING';
  const modelConfig = VIDEO_MODELS[model];
  
  try {
    // Submit generation request
    const { request_id } = await fal.queue.submit(modelConfig.id, {
      input: {
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        duration: request.duration || modelConfig.maxDuration,
        resolution: request.resolution || modelConfig.supportedResolutions[0],
        seed: request.seed,
      },
    });

    return {
      id: request_id,
      status: 'pending',
      prompt: request.prompt,
      createdAt: new Date(),
    };
  } catch (error) {
    throw new VideoGenerationError(
      `Failed to submit video generation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check status of a video generation job
 */
export async function checkVideoStatus(
  jobId: string,
  model: VideoModel = 'KLING'
): Promise<VideoJobStatus> {
  const modelConfig = VIDEO_MODELS[model];
  
  try {
    const status = await fal.queue.status(modelConfig.id, {
      requestId: jobId,
    });
    
    return status as VideoJobStatus;
  } catch (error) {
    throw new VideoGenerationError(
      `Failed to check video status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Wait for video generation to complete
 */
export async function waitForVideo(
  jobId: string,
  model: VideoModel = 'KLING',
  options: { pollInterval?: number; maxWaitTime?: number } = {}
): Promise<VideoGenerationResult> {
  const { pollInterval = 5000, maxWaitTime = 300000 } = options; // 5s default, 5min max
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkVideoStatus(jobId, model);
    
    if (status.status === 'COMPLETED') {
      return {
        id: jobId,
        status: 'completed',
        videoUrl: status.output?.video?.url,
        prompt: '', // Will be populated from original request
        createdAt: new Date(),
        completedAt: new Date(),
      };
    }
    
    if (status.status === 'FAILED') {
      return {
        id: jobId,
        status: 'failed',
        prompt: '',
        error: status.error,
        createdAt: new Date(),
      };
    }
    
    // Still in progress, wait and poll again
    await sleep(pollInterval);
  }
  
  throw new VideoGenerationError('Video generation timed out');
}

/**
 * Generate video with automatic polling
 */
export async function generateVideoAndWait(
  request: VideoGenerationRequest
): Promise<VideoGenerationResult> {
  const job = await generateVideo(request);
  const result = await waitForVideo(job.id, request.model);
  
  return {
    ...result,
    prompt: request.prompt,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface BatchVideoRequest {
  prompts: string[];
  model?: VideoModel;
  options?: Omit<VideoGenerationRequest, 'prompt'>;
}

export async function generateVideosBatch(
  request: BatchVideoRequest
): Promise<VideoGenerationResult[]> {
  // Submit all jobs in parallel
  const jobs = await Promise.all(
    request.prompts.map(prompt =>
      generateVideo({
        prompt,
        model: request.model,
        ...request.options,
      })
    )
  );
  
  // Wait for all to complete
  const results = await Promise.all(
    jobs.map((job, index) =>
      waitForVideo(job.id, request.model).then(result => ({
        ...result,
        prompt: request.prompts[index],
      }))
    )
  );
  
  return results;
}

// ============================================================================
// Content Templates (for Nova26 Video Content Engine)
// ============================================================================

export const VIDEO_TEMPLATES = {
  productDemo: (productName: string, features: string[]) => ({
    prompt: `Professional product demonstration video for ${productName}. ` +
      `Showcase features: ${features.join(', ')}. ` +
      'Clean modern aesthetic, smooth camera movements, high quality.',
    model: 'KLING' as VideoModel,
    duration: 10,
  }),
  
  tutorial: (topic: string, steps: number) => ({
    prompt: `Educational tutorial video about ${topic}. ` +
      `Step-by-step visual guide with ${steps} clear sections. ` +
      'Professional instructor, clear visuals, engaging presentation.',
    model: 'KLING' as VideoModel,
    duration: 8,
  }),
  
  socialMedia: (hook: string) => ({
    prompt: `Fast-paced social media video. Hook: "${hook}". ` +
      'Eye-catching visuals, trending style, energetic, viral potential.',
    model: 'LTX' as VideoModel,
    duration: 5,
  }),
  
  adCreative: (product: string, target: string) => ({
    prompt: `Advertisement for ${product} targeting ${target}. ` +
      'Professional commercial quality, compelling visuals, call to action.',
    model: 'KLING' as VideoModel,
    duration: 10,
  }),
};

// ============================================================================
// Error Handling
// ============================================================================

export class VideoGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoGenerationError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// Single video generation
const result = await generateVideoAndWait({
  prompt: 'A developer working on code in a modern office, cinematic lighting',
  model: 'KLING',
  duration: 10,
});

console.log(result.videoUrl);

// Batch generation
const batch = await generateVideosBatch({
  prompts: [
    'Product demo of a mobile app',
    'Tutorial on React hooks',
    'Social media ad for a new feature',
  ],
  model: 'LTX',
});

// Using templates
const productVideo = await generateVideoAndWait(
  VIDEO_TEMPLATES.productDemo('Nova26', [
    '21 AI agents',
    'Automatic quality gates',
    'TypeScript generation'
  ])
);

// Check status
const status = await checkVideoStatus(jobId);
console.log(status.status); // 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
*/
