import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Video } from '../context/VideoContext';

const s3Client = new S3Client({ 
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  },
  region: process.env.REACT_APP_AWS_REGION 
});

const transcribeClient = new TranscribeClient({ 
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  },
  region: process.env.REACT_APP_AWS_REGION 
});

const bedrockClient = new BedrockRuntimeClient({ 
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  },
  region: process.env.REACT_APP_AWS_REGION 
});

const BUCKET_NAME = process.env.REACT_APP_S3_BUCKET_NAME;

export async function uploadToS3(name: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const videoId = `video-${timestamp}`;
  const key = `videos/${videoId}/${name}`;

  try {
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: uint8Array,
      ContentType: file.type,
    }));
    
    console.log('Upload successful');
    return videoId;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

export async function startTranscriptionJob(videoId: string, fileName: string) {
  const jobName = `transcription-${videoId}`;
  
  await transcribeClient.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: {
      MediaFileUri: `s3://${BUCKET_NAME}/videos/${videoId}/${fileName}`,
    },
    OutputBucketName: BUCKET_NAME,
    OutputKey: `transcripts/${videoId}/transcript.json`,
    LanguageCode: 'en-US',
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 10
    }
  }));
}

// Update the interface for the Bedrock response
interface NotesResponse {
  completion: string;
}

export async function generateNotes(transcript: string): Promise<string> {
  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-v2',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: `\n\nHuman: You are a professional meeting assistant. Your task is to analyze this meeting transcript and create highly accurate notes. Focus on extracting factual, explicitly stated information only.

First, carefully read and analyze the entire transcript. Then, structure your response exactly as follows:

QUICK SUMMARY:
• One clear, factual sentence that captures the main purpose and concrete outcome of the meeting
• Focus on what was actually accomplished, not what was just discussed

DETAILED SUMMARY:
• List 3-5 key points that were explicitly discussed or addressed
• Format: "• [specific point] - [concrete outcome/conclusion]"
• Include relevant names and roles when mentioned
• Focus on facts and decisions, not general discussion
• Order points chronologically

KEY DECISIONS:
[Only include this section if clear, explicit decisions were made]
[Do not include this section in the notes if the transcript doesn't mention any decisions]
• Decision: [exact decision made] - Approved by [name/role]

ACTION ITEMS:
• Include all the tasks that were talked about in the meeting 
• [URGENT if explicitly marked as time-critical] Task: [specific action] @[owner] by [explicit deadline]
• Must include who is responsible if it was clearly assigned to someone
[Omit this section if no clear tasks were assigned]

BLOCKERS:
• Blocker: [specific issue] - Needs: [explicitly stated requirement]
• Only include current, unresolved blockers
• Must include what's needed to resolve it
[Omit this section if no blockers were mentioned]

Critical Guidelines:
1. Only include information explicitly stated in the transcript
2. Do not make assumptions or inferences
3. Use exact names and roles as mentioned
4. Include specific deadlines only if mentioned
5. Maintain chronological order where relevant
6. Skip any section that lacks concrete, explicit content
7. Double-check all assignments and ownerships
8. Verify all deadlines and timelines
9. Ensure each point is supported by the transcript
10. Focus on accuracy over comprehensiveness

Here's the transcript: ${transcript}

\n\nAssistant: I'll analyze the transcript carefully and provide a highly accurate summary following the exact format requested. I'll only include information that was explicitly stated.`,
        max_tokens_to_sample: 2500,
        temperature: 0.1,
        anthropic_version: "bedrock-2023-05-31"
      }),
    }));

    const responseText = new TextDecoder().decode(response.body);
    const responseBody = JSON.parse(responseText) as { completion: string };
    
    if (!responseBody.completion) {
      throw new Error('No completion in response');
    }

    // Ensure the response has the required sections
    const completion = responseBody.completion;
    if (!completion.includes('QUICK SUMMARY:') || 
        !completion.includes('DETAILED SUMMARY:')) {
      console.error('Response missing required sections:', completion);
      throw new Error('Invalid notes format received');
    }

    return completion;
  } catch (error) {
    console.error('Error generating notes:', error);
    throw new Error('Failed to generate meeting notes. Please try again.');
  }
}

export async function getTranscriptionStatus(jobName: string): Promise<'processing' | 'completed' | 'failed'> {
  try {
    const response = await transcribeClient.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    }));
    
    const status = response.TranscriptionJob?.TranscriptionJobStatus;
    switch (status) {
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'IN_PROGRESS':
      default:
        return 'processing';
    }
  } catch (error) {
    console.error('Error checking transcription status:', error);
    return 'failed';
  }
}

export async function listVideos(): Promise<Video[]> {
  try {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'videos/'
    }));

    if (!response.Contents) return [];

    // Group objects by videoId
    const videoMap = new Map<string, {name: string, uploadDate: Date}>();
    
    response.Contents.forEach(object => {
      const path = object.Key?.split('/') || [];
      if (path.length === 3) { // videos/videoId/filename
        const videoId = path[1];
        const fileName = path[2];
        videoMap.set(videoId, {
          name: fileName,
          uploadDate: object.LastModified || new Date()
        });
      }
    });

    // Get status for all videos
    const videos = await Promise.all(
      Array.from(videoMap.entries()).map(async ([videoId, data]) => {
        const jobName = `transcription-${videoId}`;
        const status = await getTranscriptionStatus(jobName);

        return {
          id: videoId,
          name: data.name,
          uploadDate: data.uploadDate.toISOString(),
          status
        };
      })
    );

    return videos;
  } catch (error) {
    console.error('Error listing videos:', error);
    throw error;
  }
}

// Add a function to poll for status updates
export async function pollTranscriptionStatus(
  videoId: string, 
  onStatusChange: (status: Video['status']) => void
) {
  const jobName = `transcription-${videoId}`;
  
  const checkStatus = async () => {
    const status = await getTranscriptionStatus(jobName);
    onStatusChange(status);
    
    if (status === 'processing') {
      // Check again in 10 seconds if still processing
      setTimeout(checkStatus, 10000);
    }
  };

  checkStatus();
}

export async function deleteFromS3(videoId: string, fileName: string) {
  try {
    console.log('Deleting video from S3:', fileName);
    // Delete video file
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `videos/${videoId}/${fileName}`
    }));

    // Delete transcript if exists
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `transcripts/${videoId}/transcript.json`
    }));

    // Delete notes if exists
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `notes/${videoId}/notes.txt`
    }));

    console.log('Successfully deleted from S3');
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
}

export async function getTranscriptFromS3(videoId: string): Promise<string> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `transcripts/${videoId}/transcript.json`
    }));
    
    const transcriptText = await response.Body?.transformToString();
    if (!transcriptText) throw new Error('No transcript found');
    
    const transcriptData = JSON.parse(transcriptText);
    
    // Handle both simple transcript and speaker-labeled transcript
    if (transcriptData.results.transcripts && transcriptData.results.transcripts.length > 0) {
      let transcript = transcriptData.results.transcripts[0].transcript;
      
      // If speaker labels are available, incorporate them
      if (transcriptData.results.speaker_labels && transcriptData.results.items) {
        transcript = formatTranscriptWithSpeakers(transcriptData.results);
      }
      
      return transcript;
    }
    
    throw new Error('Invalid transcript format');
  } catch (error) {
    console.error('Error getting transcript:', error);
    throw error;
  }
}

// Helper function to format transcript with speaker labels
function formatTranscriptWithSpeakers(results: any): string {
  const items = results.items;
  const speakers = results.speaker_labels.segments;
  let formattedTranscript = '';
  let currentSpeaker = '';

  speakers.forEach((segment: any) => {
    const speakerItems = items.filter((item: any) => 
      item.start_time >= segment.start_time && 
      item.end_time <= segment.end_time
    );

    if (segment.speaker_label !== currentSpeaker) {
      currentSpeaker = segment.speaker_label;
      formattedTranscript += `\n${currentSpeaker}: `;
    }

    speakerItems.forEach((item: any) => {
      formattedTranscript += (item.alternatives[0].content + ' ');
    });
  });

  return formattedTranscript;
}

export async function getNotes(videoId: string): Promise<string> {
  try {
    // First try to get existing notes
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `notes/${videoId}/notes.txt`
      }));
      
      const notes = await response.Body?.transformToString();
      if (notes) {
        console.log('Retrieved existing notes');
        return notes;
      }
    } catch (error) {
      console.log('No existing notes found, generating new ones');
    }

    // If no existing notes, generate new ones
    console.log('Getting transcript for note generation');
    const transcript = await getTranscriptFromS3(videoId);
    console.log('Generating notes from transcript');
    const notes = await generateNotes(transcript);
    
    // Store the generated notes
    console.log('Storing generated notes in S3');
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `notes/${videoId}/notes.txt`,
      Body: notes,
      ContentType: 'text/plain'
    }));

    return notes;
  } catch (error) {
    console.error('Error in getNotes:', error);
    throw error;
  }
} 