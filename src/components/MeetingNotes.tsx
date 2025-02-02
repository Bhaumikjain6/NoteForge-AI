import React from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  TextContent,
  Alert,
  Button,
  ColumnLayout,
  Badge,
  Spinner,
} from '@cloudscape-design/components';
import { useVideo } from '../context/VideoContext';
import './MeetingNotes.css';

export default function MeetingNotes() {
  const { selectedVideo, isNotesLoading, noteLoadingError } = useVideo();

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

  if (isNotesLoading) {
    return (
      <Container header={<Header variant="h2">Meeting Notes</Header>}>
        <Box textAlign="center" color="inherit" margin={{ vertical: 'xxl' }}>
          <SpaceBetween size="m" alignItems="center">
            <Spinner size="large" />
            <TextContent>
              <p>Generating meeting notes...</p>
            </TextContent>
          </SpaceBetween>
        </Box>
      </Container>
    );
  }

  if (noteLoadingError) {
    return (
      <Container header={<Header variant="h2">Meeting Notes</Header>}>
        <Alert type="error" header="Error generating notes">
          {noteLoadingError}
        </Alert>
      </Container>
    );
  }

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

  // Parse the notes into sections
  const sections = selectedVideo.notes
    .split('\n')
    .filter(line => line.trim() !== '')
    .reduce((acc, line) => {
      // Check for main section headers
      if (line.toUpperCase().includes('ACTION ITEMS:')) {
        acc.push({ header: 'ACTION ITEMS', items: [] });
      }
      else if (line.toUpperCase().includes('KEY DECISIONS:')) {
        acc.push({ header: 'KEY DECISIONS', items: [] });
      }
      else if (line.toUpperCase().endsWith(':')) {
        acc.push({ header: line.replace(':', '').trim(), items: [] });
      }
      // Add content to the current section
      else if (acc.length > 0) {
        const currentSection = acc[acc.length - 1];
        if (line.startsWith('•') || line.startsWith('-')) {
          // Clean up the line by removing bullet points and extra spaces
          const cleanedLine = line
            .replace(/^[•-]/, '')
            .trim()
            .replace(/\s+/g, ' ');
          currentSection.items.push(cleanedLine);
        } else if (line.trim().length > 0) {
          // Add non-empty lines that aren't bullets
          currentSection.items.push(line.trim());
        }
      }
      return acc;
    }, [] as { header: string; items: string[] }[]);

  const quickSummary = sections.find(s => s.header.toLowerCase().includes('quick summary'));
  const detailedSummary = sections.find(s => s.header.toLowerCase().includes('detailed summary'));
  const decisions = sections.find(s => s.header === 'KEY DECISIONS')?.items || [];
  // Filter out placeholder messages and empty items
  const filteredDecisions = decisions.filter(item => 
    item.trim() !== '' && 
    !item.toLowerCase().includes('[no clear') && 
    !item.toLowerCase().includes('no decisions') &&
    !item.toLowerCase().includes('[skip section')
  );
  const actionItems = sections.find(s => s.header === 'ACTION ITEMS')?.items || [];
  const blockers = sections.find(s => s.header.toLowerCase().includes('blocker'))?.items || [];

  // Helper function to check if an item is urgent
  function isUrgent(item: string): boolean {
    return item.toLowerCase().includes('[urgent]');
  }

  // Helper function to get the task description without the [URGENT] prefix
  function getTaskDescription(item: string): string {
    return item.replace(/\[urgent\]/i, '').trim();
  }

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
          {/* Quick Summary Section */}
          {quickSummary && (
            <div className="notion-block summary-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">💡</div>
                <h2>Quick Summary</h2>
              </div>
              <div className="notion-content summary-content">
                {quickSummary.items.map((item, idx) => (
                  <p key={idx} className="summary-text">{item}</p>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Summary Section */}
          {detailedSummary && (
            <div className="notion-block summary-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">📝</div>
                <h2>Detailed Summary</h2>
              </div>
              <div className="notion-content summary-content">
                {detailedSummary.items.map((item, idx) => (
                  <p key={idx} className="summary-text">{item}</p>
                ))}
              </div>
            </div>
          )}

          {/* Key Decisions Section */}
          {filteredDecisions.length > 0 && (
            <div className="notion-block decisions-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">⚡</div>
                <h2>Key Decisions</h2>
              </div>
              <div className="notion-content">
                {filteredDecisions.map((item, idx) => (
                  <div key={idx} className="decision-item">
                    <div className="decision-icon">🎯</div>
                    <div className="decision-text">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items Section */}
          {actionItems.length > 0 && (
            <div className="notion-block action-items-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">✅</div>
                <h2>Action Items</h2>
              </div>
              <div className="notion-content">
                {actionItems.map((item, idx) => (
                  <div key={idx} className="action-item">
                    {isUrgent(item) && <Badge color="red">URGENT</Badge>}
                    <div className="action-item-content">
                      <div className="action-item-task">{getTaskDescription(item)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers Section */}
          {blockers.length > 0 && (
            <div className="notion-block blockers-block">
              <div className="notion-heading">
                <div className="notion-heading-icon">🚧</div>
                <h2>Blockers</h2>
              </div>
              <div className="notion-content">
                {blockers.map((item, idx) => (
                  <div key={idx} className="blocker-item">
                    <div className="blocker-icon">⚠️</div>
                    <div className="blocker-text">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SpaceBetween>
    </Container>
  );
}

// Helper functions
function getSectionIcon(header: string): string {
  const headerLower = header.toLowerCase();
  if (headerLower.includes('overview')) return '📋';
  if (headerLower.includes('key points')) return '🔑';
  if (headerLower.includes('follow')) return '📅';
  if (headerLower.includes('sentiment')) return '🎯';
  return '📝';
}

function getPriority(item: string): string {
  if (item.toLowerCase().includes('urgent') || item.toLowerCase().includes('asap')) return 'High';
  if (item.toLowerCase().includes('soon')) return 'Medium';
  return 'Normal';
}

function getOwner(item: string): string | null {
  const match = item.match(/@(\w+)/);
  return match ? match[1] : null;
}

function getDueDate(item: string): string | null {
  const match = item.match(/by\s+([^,\.]+)/i);
  return match ? match[1] : null;
} 