import React from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  TextContent,
  Alert,
  Button,
} from '@cloudscape-design/components';
import { useVideo } from '../context/VideoContext';
import './MeetingNotes.css';

export default function MeetingNotes() {
  const { selectedVideo } = useVideo();

  const handleCopyNotes = () => {
    if (selectedVideo?.notes) {
      navigator.clipboard.writeText(selectedVideo.notes)
        .then(() => {
          console.log('Notes copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy notes:', err);
        });
    }
  };

  if (!selectedVideo?.notes) {
    return (
      <Container header={<Header variant="h2">Meeting Notes</Header>}>
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <TextContent>
              <p>Select a completed video to view its notes</p>
            </TextContent>
          </SpaceBetween>
        </Box>
      </Container>
    );
  }

  // Parse the notes into sections and group them
  const sections = selectedVideo.notes
    .split('\n')
    .filter(line => line.trim() !== '')
    .reduce((acc, line) => {
      if (line.startsWith('#') || line.includes(':')) {
        acc.push({ header: line.replace('#', '').trim(), items: [] });
      } else if (acc.length > 0) {
        acc[acc.length - 1].items.push(line.trim());
      }
      return acc;
    }, [] as { header: string; items: string[] }[]);

  return (
    <Container 
      header={
        <Header
          variant="h2"
          description={`Notes from ${selectedVideo.name}`}
          actions={
            <Button 
              iconName="copy"
              onClick={handleCopyNotes}
              variant="normal"
            >
              Copy notes
            </Button>
          }
        >
          Meeting Notes
        </Header>
      }
    >
      <SpaceBetween size="m">
        <Alert type="info">
          These notes were automatically generated from the meeting transcript
        </Alert>
        <div className="notion-page">
          {sections.map((section, index) => (
            <div key={index} className="notion-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">📝</div>
                <h2>{section.header}</h2>
              </div>
              <div className="notion-content">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="notion-list-item">
                    <div className="notion-bullet">•</div>
                    <div className="notion-text">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SpaceBetween>
    </Container>
  );
} 