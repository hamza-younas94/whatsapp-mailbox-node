// frontend/src/pages/BroadcastList.tsx
// List and manage all broadcasts

import React, { useState, useEffect } from 'react';
import './BroadcastList.css';

interface Broadcast {
  id: string;
  name: string;
  messageContent: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  scheduledFor?: string;
  sentAt?: string;
}

const BroadcastList: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'DRAFT' | 'SCHEDULED' | 'SENT'>('ALL');
  const [selectedBroadcast, setSelectedBroadcast] = useState<string | null>(null);

  useEffect(() => {
    fetchBroadcasts();
  }, [filter]);

  const fetchBroadcasts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const url = filter === 'ALL'
        ? '/api/v1/broadcasts-enhanced'
        : `/api/v1/broadcasts-enhanced?status=${filter}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setBroadcasts(data.data);
      }
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/broadcasts-enhanced/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        setBroadcasts(broadcasts.filter(b => b.id !== id));
        alert('Broadcast deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      alert('Error deleting broadcast');
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Are you sure you want to send this broadcast now?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/broadcasts-enhanced/${id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Broadcast sent successfully!');
        fetchBroadcasts();
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Error sending broadcast');
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      DRAFT: 'status-draft',
      SCHEDULED: 'status-scheduled',
      SENDING: 'status-sending',
      SENT: 'status-sent',
      CANCELLED: 'status-cancelled',
      FAILED: 'status-failed',
    };
    return <span className={`status-badge ${classes[status]}`}>{status}</span>;
  };

  const getDeliveryRate = (broadcast: Broadcast) => {
    if (broadcast.totalRecipients === 0) return 0;
    return ((broadcast.deliveredCount / broadcast.totalRecipients) * 100).toFixed(1);
  };

  const getReadRate = (broadcast: Broadcast) => {
    if (broadcast.deliveredCount === 0) return 0;
    return ((broadcast.readCount / broadcast.deliveredCount) * 100).toFixed(1);
  };

  return (
    <div className="broadcast-list-page">
      <div className="page-header">
        <div>
          <h1>Broadcasts</h1>
          <p className="page-subtitle">Manage and track your broadcast campaigns</p>
        </div>
        <button
          onClick={() => window.location.href = '/broadcast-creator.html'}
          className="btn-create"
        >
          + New Broadcast
        </button>
      </div>

      <div className="filter-tabs">
        {['ALL', 'DRAFT', 'SCHEDULED', 'SENT'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading broadcasts...</div>
      ) : broadcasts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📢</div>
          <h3>No broadcasts yet</h3>
          <p>Create your first broadcast to reach your audience</p>
          <button
            onClick={() => window.location.href = '/broadcast-creator.html'}
            className="btn-primary"
          >
            Create Broadcast
          </button>
        </div>
      ) : (
        <div className="broadcast-grid">
          {broadcasts.map(broadcast => (
            <div key={broadcast.id} className="broadcast-card">
              <div className="card-header">
                <h3 className="card-title">{broadcast.name}</h3>
                {getStatusBadge(broadcast.status)}
              </div>

              <div className="card-content">
                <p className="message-preview">
                  {broadcast.messageContent.substring(0, 100)}
                  {broadcast.messageContent.length > 100 && '...'}
                </p>

                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-label">Recipients</div>
                    <div className="stat-value">{broadcast.totalRecipients}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Sent</div>
                    <div className="stat-value">{broadcast.sentCount}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Delivered</div>
                    <div className="stat-value">
                      {broadcast.deliveredCount}
                      <span className="stat-percent">({getDeliveryRate(broadcast)}%)</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Read</div>
                    <div className="stat-value">
                      {broadcast.readCount}
                      <span className="stat-percent">({getReadRate(broadcast)}%)</span>
                    </div>
                  </div>
                </div>

                <div className="card-meta">
                  <span>Created {new Date(broadcast.createdAt).toLocaleDateString()}</span>
                  {broadcast.sentAt && (
                    <span> • Sent {new Date(broadcast.sentAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="card-actions">
                <button
                  onClick={() => window.location.href = `/broadcast-analytics.html?id=${broadcast.id}`}
                  className="btn-secondary btn-sm"
                >
                  📊 Analytics
                </button>
                {broadcast.status === 'DRAFT' && (
                  <button
                    onClick={() => handleSend(broadcast.id)}
                    className="btn-primary btn-sm"
                  >
                    Send Now
                  </button>
                )}
                {(broadcast.status === 'DRAFT' || broadcast.status === 'SCHEDULED') && (
                  <button
                    onClick={() => handleDelete(broadcast.id)}
                    className="btn-danger btn-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BroadcastList;
