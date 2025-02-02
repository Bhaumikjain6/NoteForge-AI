import React, { useState, useEffect } from 'react';
import {
  Table,
  Box,
  StatusIndicator,
  Header,
  Button,
  Modal,
  SpaceBetween,
  FileUpload,
  Input,
  FormField,
  StatusIndicatorProps,
} from '@cloudscape-design/components';
import { useVideo } from '../context/VideoContext';
import { uploadToS3, startTranscriptionJob, pollTranscriptionStatus, deleteFromS3, getNotes } from '../services/aws';
import type { Video } from '../context/VideoContext';

export default function VideoList() {
  const { videos, setSelectedVideo, selectedVideo, addVideo, isLoading, updateVideoStatus, deleteVideo, setIsNotesLoading, setNoteLoadingError } = useVideo();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [meetingName, setMeetingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showNameError, setShowNameError] = useState(false);

  const selectedItems = React.useState<Video[]>([]);
  
  const handleUpload = async () => {
    if (!file || !meetingName.trim()) {
      setShowNameError(true);
      return;
    }

    setIsUploading(true);
    try {
      const videoId = await uploadToS3(meetingName.trim(), file);
      
      // Close modal first
      setIsModalOpen(false);
      setFile(null);
      setMeetingName('');
      setShowNameError(false);
      
      // Add video with initial processing status
      addVideo({
        id: videoId,
        name: meetingName.trim(),
        uploadDate: new Date().toISOString(),
        status: 'processing'
      });

      // Start transcription with both videoId and fileName
      await startTranscriptionJob(videoId, meetingName.trim());
      
      // Start polling for status updates
      pollTranscriptionStatus(videoId, (status) => {
        updateVideoStatus(videoId, status);
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
    }
  };

  const handleModalDismiss = () => {
    setIsModalOpen(false);
    setFile(null);
    setMeetingName('');
    setShowNameError(false);
  };

  const handleDelete = async (video: Video | null) => {
    if (!video) return;
    
    try {
      await deleteFromS3(video.id, video.name);
      deleteVideo(video.id);
      setSelectedVideo(null);
    } catch (error) {
      console.error('Failed to delete video:', error);
      // Optionally add error handling UI here
    }
  };

  const handleViewNotes = async (video: Video) => {
    try {
      setIsNotesLoading(true);
      setNoteLoadingError(null);
      const notes = await getNotes(video.id);
      setSelectedVideo({ ...video, notes });
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNoteLoadingError('Failed to generate notes. Please try again.');
    } finally {
      setIsNotesLoading(false);
    }
  };

  const tableDefinition = {
    header: <Header 
      variant="h2" 
      counter={`(${videos.length})`}
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            onClick={() => handleViewNotes(selectedItems[0][0])}
            disabled={selectedItems[0].length !== 1 || selectedItems[0][0]?.status !== 'completed'}
            iconName="status-info"
          >
            View Notes
          </Button>
          <Button
            onClick={() => handleDelete(selectedItems[0][0])}
            disabled={selectedItems[0].length !== 1}
            iconName="remove"
          >
            Delete
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            iconName="upload"
          >
            Upload Video
          </Button>
        </SpaceBetween>
      }
    >
      Videos
    </Header>,
    columnDefinitions: [
      {
        id: 'name',
        header: 'Name',
        cell: (item: Video) => item.name,
        sortingField: 'name'
      },
      {
        id: 'uploadDate',
        header: 'Upload Date',
        cell: (item: Video) => new Date(item.uploadDate).toLocaleDateString(),
        sortingField: 'uploadDate'
      },
      {
        id: 'status',
        header: 'Status',
        cell: (item: Video) => (
          <StatusIndicator type={getStatusType(item.status)}>
            {item.status}
          </StatusIndicator>
        )
      }
    ],
    selectionType: "single" as const,
    onSelectionChange: ({ detail }: { detail: { selectedItems: Video[] } }) => {
      selectedItems[1](detail.selectedItems);
    },
    selectedItems: selectedItems[0]
  };

  return (
    <>
      <Table
        {...tableDefinition}
        items={videos}
        loading={isLoading}
        loadingText="Loading videos..."
        trackBy="id"
        empty={
          <Box
            margin={{ vertical: "xs" }}
            textAlign="center"
            color="inherit"
          >
            <SpaceBetween size="m">
              <p>No Videos Uploaded. Please upload a video to get started.</p>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={isModalOpen}
        onDismiss={handleModalDismiss}
        header="Upload Video"
      >
        <SpaceBetween size="m">
          <FormField 
            label="Meeting Name" 
            errorText={showNameError && meetingName.trim() === '' ? 'Meeting name is required' : undefined}
          >
            <Input
              value={meetingName}
              onChange={({ detail }) => {
                setMeetingName(detail.value);
                if (showNameError) setShowNameError(false);
              }}
              placeholder="Enter meeting name"
            />
          </FormField>
          <Box>Upload a meeting recording to generate notes</Box>
          <FileUpload
            onChange={({ detail }) => setFile(detail.value[0])}
            value={file ? [file] : []}
            i18nStrings={{
              dropzoneText: () => "Drop video file here",
              uploadButtonText: () => "Choose video file",
            }}
            accept="video/*"
            multiple={false}
          />
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              onClick={handleUpload}
              loading={isUploading}
              disabled={!file || !meetingName.trim()}
              variant="primary"
            >
              Upload and Process
            </Button>
            <Button onClick={handleModalDismiss}>
              Cancel
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
    </>
  );
}

// Helper function to determine status indicator type
function getStatusType(status: string): StatusIndicatorProps.Type {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'in-progress';
    case 'failed':
      return 'error';
    default:
      return 'pending';
  }
} 