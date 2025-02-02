import React, { createContext, useState, useContext, useEffect } from 'react';
import { listVideos } from '../services/aws';

export interface Video {
  id: string;
  name: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  notes?: string;
  analysis?: {
    sentiment: string;
    actionItems: Array<{
      task: string;
      owner?: string;
      dueDate?: string;
      priority?: 'high' | 'medium' | 'low';
    }>;
    decisions: Array<{
      decision: string;
      context?: string;
      owner?: string;
    }>;
    insights: Array<string>;
  };
}

interface VideoContextType {
  selectedVideo: Video | null;
  videos: Video[];
  setSelectedVideo: (video: Video | null) => void;
  addVideo: (video: Video) => void;
  updateVideoStatus: (id: string, status: Video['status'], notes?: string) => void;
  isLoading: boolean;
  deleteVideo: (id: string) => void;
  isNotesLoading: boolean;
  setIsNotesLoading: (loading: boolean) => void;
  noteLoadingError: string | null;
  setNoteLoadingError: (error: string | null) => void;
}

export const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [noteLoadingError, setNoteLoadingError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const videosList = await listVideos();
        setVideos(videosList);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const addVideo = (video: Video) => {
    setVideos(prev => [...prev, video]);
  };

  const updateVideoStatus = (id: string, status: Video['status'], notes?: string) => {
    setVideos(prev => 
      prev.map(video => 
        video.id === id ? { ...video, status, notes } : video
      )
    );
  };

  const deleteVideo = (id: string) => {
    setVideos(prev => prev.filter(video => video.id !== id));
  };

  return (
    <VideoContext.Provider value={{
      selectedVideo,
      videos,
      setSelectedVideo,
      addVideo,
      updateVideoStatus,
      isLoading,
      deleteVideo,
      isNotesLoading,
      setIsNotesLoading,
      noteLoadingError,
      setNoteLoadingError
    }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
} 