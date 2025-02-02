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
} from '@cloudscape-design/components';
import { useVideo } from '../context/VideoContext';
import { uploadToS3, startTranscriptionJob, pollTranscriptionStatus, deleteFromS3, getNotes } from '../services/aws';
import type { Video } from '../context/VideoContext';

export default function VideoList() {
  const { videos, setSelectedVideo, selectedVideo, addVideo, isLoading, updateVideoStatus, deleteVideo } = useVideo();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [meetingName, setMeetingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showNameError, setShowNameError] = useState(false);

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

  const handleDelete = async () => {
    if (!selectedVideo) return;
    
    try {
      await deleteFromS3(selectedVideo.id, selectedVideo.name);
      deleteVideo(selectedVideo.id);
      setSelectedVideo(null);
    } catch (error) {
      console.error('Failed to delete video:', error);
      // Optionally add error handling UI here
    }
  };

  const handleViewNotes = async (video: Video) => {
    try {
      const notes = await getNotes(video.id);
      updateVideoStatus(video.id, video.status, notes);
      setSelectedVideo({ ...video, notes });
    } catch (error) {
      console.error('Failed to get notes:', error);
      // Optionally add error handling UI here
    }
  };

  const columns = [
    {
      id: 'name',
      header: 'Video Name',
      cell: (item: Video) => item.name,
      sortingField: 'name',
    },
    {
      id: 'uploadDate',
      header: 'Upload Date',
      cell: (item: Video) => new Date(item.uploadDate).toLocaleString(),
      sortingField: 'uploadDate',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item: Video) => (
        <StatusIndicator type={
          item.status === 'completed' ? 'success' :
          item.status === 'processing' ? 'in-progress' :
          'error'
        }>
          {item.status}
        </StatusIndicator>
      ),
    }
  ];

  return (
    <>
      <Table
        loading={isLoading}
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setIsModalOpen(true)}>
                  Upload Video
                </Button>
                <Button 
                  onClick={() => selectedVideo && handleViewNotes(selectedVideo)}
                  disabled={!selectedVideo || selectedVideo.status !== 'completed'}
                  variant="normal"
                >
                  View Notes
                </Button>
                <Button 
                  onClick={handleDelete}
                  disabled={!selectedVideo}
                  variant="normal"
                >
                  Delete
                </Button>
              </SpaceBetween>
            }
          >
            Uploaded Videos
          </Header>
        }
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
        columnDefinitions={columns}
        items={videos}
        selectionType="single"
        selectedItems={selectedVideo ? [selectedVideo] : []}
        onSelectionChange={({ detail }) => 
          setSelectedVideo(detail.selectedItems[0] || null)
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