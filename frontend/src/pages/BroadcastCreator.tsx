// frontend/src/pages/BroadcastCreator.tsx
// Comprehensive broadcast creation wizard

import React, { useState, useEffect } from 'react';
import './BroadcastCreator.css';

interface Segment {
  id: string;
  name: string;
  contactCount?: number;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

type Step = 'message' | 'recipients' | 'schedule' | 'review';
type RecipientType = 'ALL' | 'SEGMENT' | 'TAG' | 'MANUAL';

const BroadcastCreator: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('message');
  const [name, setName] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [messageType, setMessageType] = useState<'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('TEXT');
  const [mediaUrl, setMediaUrl] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('ALL');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [sendNow, setSendNow] = useState(true);
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [loading, setLoading] = useState(false);

  const steps = [
    { id: 'message', label: 'Message', icon: '✉️' },
    { id: 'recipients', label: 'Recipients', icon: '👥' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'review', label: 'Review', icon: '✓' },
  ];

  useEffect(() => {
    fetchSegments();
    fetchTags();
    fetchContacts();
  }, []);

  useEffect(() => {
    calculateRecipients();
  }, [recipientType, selectedSegments, selectedTags, selectedContacts]);

  const fetchSegments = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/segments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setSegments(data.data);
    } catch (error) {
      console.error('Error fetching segments:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/tags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setTags(data.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setContacts(data.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const calculateRecipients = () => {
    let count = 0;
    if (recipientType === 'ALL') {
      count = contacts.length;
    } else if (recipientType === 'SEGMENT') {
      const selectedSegmentData = segments.filter(s => selectedSegments.includes(s.id));
      count = selectedSegmentData.reduce((sum, s) => sum + (s.contactCount || 0), 0);
    } else if (recipientType === 'TAG') {
      count = selectedTags.length * 10; // Simplified estimate
    } else if (recipientType === 'MANUAL') {
      count = selectedContacts.length;
    }
    setEstimatedRecipients(count);
  };

  const handleNext = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id as Step);
    }
  };

  const handlePrevious = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id as Step);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        name,
        messageContent,
        messageType,
        mediaUrl: mediaUrl || undefined,
        scheduledFor: sendNow ? undefined : scheduledFor,
        priority,
        recipientType,
        segmentIds: recipientType === 'SEGMENT' ? selectedSegments : undefined,
        tagIds: recipientType === 'TAG' ? selectedTags : undefined,
        contactIds: recipientType === 'MANUAL' ? selectedContacts : undefined,
      };

      const response = await fetch('/api/v1/broadcasts-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        if (sendNow) {
          // Send immediately
          await fetch(`/api/v1/broadcasts-enhanced/${data.data.id}/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          alert('Broadcast sent successfully!');
        } else {
          alert('Broadcast scheduled successfully!');
        }
        window.location.href = '/broadcasts.html';
      } else {
        alert('Error creating broadcast: ' + data.message);
      }
    } catch (error) {
      console.error('Error creating broadcast:', error);
      alert('Error creating broadcast');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`step-item ${currentStep === step.id ? 'active' : ''} ${
            steps.findIndex(s => s.id === currentStep) > index ? 'completed' : ''
          }`}
        >
          <div className="step-icon">{step.icon}</div>
          <div className="step-label">{step.label}</div>
        </div>
      ))}
    </div>
  );

  const renderMessageStep = () => (
    <div className="step-content">
      <h2>Create Your Message</h2>
      
      <div className="form-group">
        <label>Broadcast Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Weekly Newsletter"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Message Type *</label>
        <div className="radio-group">
          {['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(type => (
            <label key={type} className="radio-label">
              <input
                type="radio"
                value={type}
                checked={messageType === type}
                onChange={(e) => setMessageType(e.target.value as any)}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {messageType !== 'TEXT' && (
        <div className="form-group">
          <label>Media URL</label>
          <input
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="form-input"
          />
        </div>
      )}

      <div className="form-group">
        <label>Message Content *</label>
        <textarea
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          placeholder="Type your message here..."
          rows={6}
          className="form-textarea"
        />
        <div className="character-count">{messageContent.length} characters</div>
      </div>
    </div>
  );

  const renderRecipientsStep = () => (
    <div className="step-content">
      <h2>Select Recipients</h2>

      <div className="form-group">
        <label>Recipient Type *</label>
        <select
          value={recipientType}
          onChange={(e) => setRecipientType(e.target.value as RecipientType)}
          className="form-select"
        >
          <option value="ALL">All Contacts</option>
          <option value="SEGMENT">By Segment</option>
          <option value="TAG">By Tag</option>
          <option value="MANUAL">Manual Selection</option>
        </select>
      </div>

      {recipientType === 'SEGMENT' && (
        <div className="form-group">
          <label>Select Segments</label>
          <div className="checkbox-group">
            {segments.map(segment => (
              <label key={segment.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedSegments.includes(segment.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSegments([...selectedSegments, segment.id]);
                    } else {
                      setSelectedSegments(selectedSegments.filter(id => id !== segment.id));
                    }
                  }}
                />
                {segment.name} ({segment.contactCount || 0} contacts)
              </label>
            ))}
          </div>
        </div>
      )}

      {recipientType === 'TAG' && (
        <div className="form-group">
          <label>Select Tags</label>
          <div className="checkbox-group">
            {tags.map(tag => (
              <label key={tag.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTags([...selectedTags, tag.id]);
                    } else {
                      setSelectedTags(selectedTags.filter(id => id !== tag.id));
                    }
                  }}
                />
                <span className="tag-badge" style={{ backgroundColor: tag.color || '#ccc' }}>
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {recipientType === 'MANUAL' && (
        <div className="form-group">
          <label>Select Contacts</label>
          <div className="contact-list">
            {contacts.slice(0, 50).map(contact => (
              <label key={contact.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedContacts.includes(contact.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    } else {
                      setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                    }
                  }}
                />
                {contact.name || contact.phoneNumber}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="recipient-summary">
        Estimated Recipients: <strong>{estimatedRecipients}</strong>
      </div>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="step-content">
      <h2>Schedule Broadcast</h2>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={(e) => setSendNow(e.target.checked)}
          />
          Send immediately
        </label>
      </div>

      {!sendNow && (
        <div className="form-group">
          <label>Schedule For</label>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="form-input"
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
      )}

      <div className="form-group">
        <label>Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as any)}
          className="form-select"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="step-content">
      <h2>Review & Send</h2>

      <div className="review-section">
        <h3>Broadcast Details</h3>
        <div className="review-item">
          <span className="review-label">Name:</span>
          <span className="review-value">{name}</span>
        </div>
        <div className="review-item">
          <span className="review-label">Type:</span>
          <span className="review-value">{messageType}</span>
        </div>
        <div className="review-item">
          <span className="review-label">Message:</span>
          <span className="review-value">{messageContent.substring(0, 100)}...</span>
        </div>
      </div>

      <div className="review-section">
        <h3>Recipients</h3>
        <div className="review-item">
          <span className="review-label">Type:</span>
          <span className="review-value">{recipientType}</span>
        </div>
        <div className="review-item">
          <span className="review-label">Count:</span>
          <span className="review-value">{estimatedRecipients}</span>
        </div>
      </div>

      <div className="review-section">
        <h3>Schedule</h3>
        <div className="review-item">
          <span className="review-label">Send Time:</span>
          <span className="review-value">{sendNow ? 'Immediately' : scheduledFor}</span>
        </div>
        <div className="review-item">
          <span className="review-label">Priority:</span>
          <span className="review-value">{priority}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="broadcast-creator">
      <div className="creator-header">
        <h1>Create Broadcast</h1>
      </div>

      {renderStepIndicator()}

      <div className="creator-body">
        {currentStep === 'message' && renderMessageStep()}
        {currentStep === 'recipients' && renderRecipientsStep()}
        {currentStep === 'schedule' && renderScheduleStep()}
        {currentStep === 'review' && renderReviewStep()}
      </div>

      <div className="creator-footer">
        <button
          onClick={handlePrevious}
          className="btn btn-secondary"
          disabled={currentStep === 'message'}
        >
          ← Previous
        </button>
        
        {currentStep !== 'review' ? (
          <button onClick={handleNext} className="btn btn-primary">
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="btn btn-success"
            disabled={loading || !name || !messageContent}
          >
            {loading ? 'Creating...' : sendNow ? 'Send Now' : 'Schedule Broadcast'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BroadcastCreator;
