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

export async function generateNotes(transcript: string): Promise<string> {
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-v2',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      prompt: `\n\nHuman: Analyze this meeting transcript and create structured meeting notes. 
      
Identify and organize the following:
- Meeting Overview (date, attendees if mentioned)
- Key Points Discussed
- Important Decisions Made
- Action Items (with assigned owners if mentioned)
- Follow-up Tasks and Deadlines
- Notable Discussions or Concerns

Format the notes with clear headers and bullet points. Be concise but comprehensive.

Here's the transcript: ${transcript}

\n\nAssistant:`,
      max_tokens_to_sample: 2000,
      temperature: 0.3,
      anthropic_version: "bedrock-2023-05-31"
    }),
  }));

  // Convert Uint8Array to string and then parse JSON
  const responseText = new TextDecoder().decode(response.body);
  const responseBody = JSON.parse(responseText);
  return responseBody.completion;
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
    
    return JSON.parse(transcriptText).results.transcripts[0].transcript;
  } catch (error) {
    console.error('Error getting transcript:', error);
    throw error;
  }
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
      if (notes) return notes;
    } catch (error) {
      // Notes don't exist yet, continue to generate them
    }

    // If no existing notes, generate new ones
    const transcript = await getTranscriptFromS3(videoId);
    const notes = await generateNotes(transcript);
    
    // Store the generated notes
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `notes/${videoId}/notes.txt`,
      Body: notes,
      ContentType: 'text/plain'
    }));

    return notes;
  } catch (error) {
    console.error('Error getting/generating notes:', error);
    throw error;
  }
} 