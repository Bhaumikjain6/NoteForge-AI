import React, { useState } from 'react';
import {
  FileUpload,
  SpaceBetween,
  Button,
  Box,
} from '@cloudscape-design/components';
import { useVideo } from '../context/VideoContext';
import { uploadToS3, startTranscriptionJob } from '../services/aws';

export default function VideoUploader() {
  // const [file, setFile] = useState<File | null>(null);
  // const { addVideo } = useVideo();
  // const [isUploading, setIsUploading] = useState(false);

  // const handleUpload = async () => {
  //   if (!file) return;

  //   setIsUploading(true);
  //   try {
  //     // Upload to S3
  //     const videoId = await uploadToS3("test", file);
      
  //     // Add to videos list
  //     addVideo({
  //       id: videoId,
  //       name: file.name,
  //       uploadDate: new Date().toISOString(),
  //       status: 'processing'
  //     });

  //     // Start transcription
  //     await startTranscriptionJob(videoId);
      
  //   } catch (error) {
  //     console.error('Upload failed:', error);
  //   } finally {
  //     setIsUploading(false);
  //     setFile(null);
  //   }
  // };

  // return (
  //   <SpaceBetween size="m">
  //     <Box>Upload a meeting recording to generate notes</Box>
  //     <FileUpload
  //       onChange={({ detail }) => setFile(detail.value[0])}
  //       value={file ? [file] : []}
  //       i18nStrings={{
  //         dropzoneText: () => "Drop video file here",
  //         uploadButtonText :  () => "Choose video file",
  //       }}
  //       accept="video/*"
  //       multiple={false}
  //     />
  //     <Button 
  //       onClick={handleUpload}
  //       loading={isUploading}
  //       disabled={!file}
  //     >
  //       Upload and Process
  //     </Button>
  //   </SpaceBetween>
  // );
} 