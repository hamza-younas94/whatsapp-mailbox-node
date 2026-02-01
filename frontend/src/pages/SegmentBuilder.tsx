// frontend/src/pages/SegmentBuilder.tsx
// Visual segment builder with live preview

import React, { useState, useEffect } from 'react';
import './SegmentBuilder.css';

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface PreviewData {
  count: number;
  preview: Array<{
    id: string;
    name: string;
    phoneNumber: string;
  }>;
}

const SegmentBuilder: React.FC = () => {
  const [segmentName, setSegmentName] = useState('');
  const [description, setDescription] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', field: 'name', operator: 'contains', value: '' }
  ]);
  const [previewData, setPreviewData] = useState<PreviewData>({ count: 0, preview: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fieldOptions = [
    { value: 'name', label: 'Name', type: 'string' },
    { value: 'phoneNumber', label: 'Phone Number', type: 'string' },
    { value: 'email', label: 'Email', type: 'string' },
    { value: 'createdAt', label: 'Created Date', type: 'date' },
  ];

  const operatorOptions: Record<string, Array<{ value: string; label: string }>> = {
    string: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does Not Contain' },
    ],
    date: [
      { value: 'equals', label: 'On' },
      { value: 'greater_than', label: 'After' },
      { value: 'less_than', label: 'Before' },
    ],
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (conditions.some(c => c.value)) {
        fetchPreview();
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [conditions, logic]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const criteria = {
        logic,
        conditions: conditions.filter(c => c.value).map(c => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      };

      const response = await fetch('/api/v1/segments-enhanced/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ criteria }),
      });

      const data = await response.json();
      if (data.success) {
        setPreviewData(data.data);
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    const newId = (Math.max(...conditions.map(c => parseInt(c.id)), 0) + 1).toString();
    setConditions([...conditions, { id: newId, field: 'name', operator: 'contains', value: '' }]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== id));
    }
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const handleFieldChange = (id: string, field: string) => {
    const fieldType = fieldOptions.find(f => f.value === field)?.type || 'string';
    const defaultOperator = operatorOptions[fieldType][0].value;
    updateCondition(id, { field, operator: defaultOperator, value: '' });
  };

  const handleSave = async () => {
    if (!segmentName.trim()) {
      alert('Please enter a segment name');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        name: segmentName,
        description: description || undefined,
        criteria: {
          logic,
          conditions: conditions.filter(c => c.value).map(c => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })),
        },
      };

      const response = await fetch('/api/v1/segments-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        alert('Segment created successfully!');
        window.location.href = '/segments.html';
      } else {
        alert('Error creating segment: ' + data.message);
      }
    } catch (error) {
      console.error('Error creating segment:', error);
      alert('Error creating segment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="segment-builder">
      <div className="builder-header">
        <h1>Segment Builder</h1>
        <button onClick={handleSave} className="btn-save" disabled={saving}>
          {saving ? 'Saving...' : 'Save Segment'}
        </button>
      </div>

      <div className="builder-content">
        <div className="builder-main">
          <div className="segment-info">
            <div className="form-group">
              <label>Segment Name *</label>
              <input
                type="text"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g., Active Customers"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this segment..."
                rows={2}
                className="form-textarea"
              />
            </div>
          </div>

          <div className="conditions-section">
            <div className="conditions-header">
              <h3>Conditions</h3>
              <div className="logic-toggle">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="AND"
                    checked={logic === 'AND'}
                    onChange={(e) => setLogic(e.target.value as 'AND')}
                  />
                  Match ALL conditions
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="OR"
                    checked={logic === 'OR'}
                    onChange={(e) => setLogic(e.target.value as 'OR')}
                  />
                  Match ANY condition
                </label>
              </div>
            </div>

            <div className="conditions-list">
              {conditions.map((condition, index) => {
                const field = fieldOptions.find(f => f.value === condition.field);
                const operators = field ? operatorOptions[field.type] : operatorOptions.string;

                return (
                  <div key={condition.id} className="condition-card">
                    <div className="condition-number">{index + 1}</div>
                    
                    <div className="condition-fields">
                      <select
                        value={condition.field}
                        onChange={(e) => handleFieldChange(condition.id, e.target.value)}
                        className="condition-select"
                      >
                        {fieldOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                        className="condition-select"
                      >
                        {operators.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type={field?.type === 'date' ? 'date' : 'text'}
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        placeholder="Enter value..."
                        className="condition-input"
                      />
                    </div>

                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="btn-remove"
                      disabled={conditions.length === 1}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <button onClick={addCondition} className="btn-add-condition">
              + Add Condition
            </button>
          </div>
        </div>

        <div className="builder-sidebar">
          <div className="preview-panel">
            <h3>Live Preview</h3>
            
            <div className="preview-count">
              <div className="count-label">Matching Contacts</div>
              <div className="count-value">
                {loading ? '...' : previewData.count.toLocaleString()}
              </div>
            </div>

            {previewData.preview.length > 0 && (
              <div className="preview-list">
                <div className="preview-list-header">Sample Contacts</div>
                {previewData.preview.map(contact => (
                  <div key={contact.id} className="preview-contact">
                    <div className="contact-name">{contact.name || 'Unknown'}</div>
                    <div className="contact-phone">{contact.phoneNumber}</div>
                  </div>
                ))}
                {previewData.count > previewData.preview.length && (
                  <div className="preview-more">
                    +{previewData.count - previewData.preview.length} more contacts
                  </div>
                )}
              </div>
            )}

            {!loading && previewData.count === 0 && (
              <div className="preview-empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">No contacts match these conditions</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentBuilder;
