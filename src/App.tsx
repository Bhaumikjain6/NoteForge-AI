import React from 'react';
import {
  AppLayout,
  ContentLayout,
  Container,
  Header,
} from '@cloudscape-design/components';
import VideoList from './components/VideoList';
import { VideoProvider } from './context/VideoContext';
import MeetingNotes from './components/MeetingNotes';

function App() {
  return (
    <VideoProvider>
      <AppLayout
        navigationHide
        toolsHide
        content={
          <ContentLayout
            header={
              <Header
                variant="h1"
                description="Transform your meeting recordings into intelligent, structured notes using AI"
              >
                NoteForge AI
              </Header>
            }
          >
            <Container>
              <VideoList />
            </Container>
            <Container>
              <MeetingNotes />
            </Container>
          </ContentLayout>
        }
      />
    </VideoProvider>
  );
}

export default App;
