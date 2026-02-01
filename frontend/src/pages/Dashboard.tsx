// frontend/src/pages/Dashboard.tsx
// Analytics dashboard with key metrics

import React, { useState, useEffect } from 'react';
import './Dashboard.css';

interface Metrics {
  totalMessages: number;
  totalContacts: number;
  activeConversations: number;
  responseTime: number;
  messagesChange: number;
  contactsChange: number;
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalMessages: 0,
    totalContacts: 0,
    activeConversations: 0,
    responseTime: 0,
    messagesChange: 0,
    contactsChange: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/analytics/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    change?: number;
    icon: string;
    color: string;
  }> = ({ title, value, change, icon, color }) => (
    <div className="metric-card">
      <div className="metric-icon" style={{ background: color }}>
        {icon}
      </div>
      <div className="metric-content">
        <div className="metric-title">{title}</div>
        <div className="metric-value">{value}</div>
        {change !== undefined && (
          <div className={`metric-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last week
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p className="dashboard-subtitle">Track your WhatsApp business performance</p>
        </div>
        <button onClick={fetchMetrics} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading metrics...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard
              title="Total Messages"
              value={metrics.totalMessages.toLocaleString()}
              change={metrics.messagesChange}
              icon="💬"
              color="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
            <MetricCard
              title="Total Contacts"
              value={metrics.totalContacts.toLocaleString()}
              change={metrics.contactsChange}
              icon="👥"
              color="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            />
            <MetricCard
              title="Active Conversations"
              value={metrics.activeConversations}
              icon="🗨️"
              color="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
            <MetricCard
              title="Avg Response Time"
              value={`${metrics.responseTime}m`}
              icon="⏱️"
              color="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
            />
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button onClick={() => window.location.href = '/broadcast-creator.html'} className="action-btn">
                  📢 New Broadcast
                </button>
                <button onClick={() => window.location.href = '/segment-builder.html'} className="action-btn">
                  🎯 Create Segment
                </button>
                <button onClick={() => window.location.href = '/quick-replies.html'} className="action-btn">
                  ⚡ Quick Replies
                </button>
                <button onClick={() => window.location.href = '/contacts.html'} className="action-btn">
                  📇 Contacts
                </button>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon">✉️</div>
                  <div className="activity-content">
                    <div className="activity-title">New message received</div>
                    <div className="activity-time">2 minutes ago</div>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon">📢</div>
                  <div className="activity-content">
                    <div className="activity-title">Broadcast sent to 150 contacts</div>
                    <div className="activity-time">1 hour ago</div>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon">👤</div>
                  <div className="activity-content">
                    <div className="activity-title">New contact added</div>
                    <div className="activity-time">3 hours ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
