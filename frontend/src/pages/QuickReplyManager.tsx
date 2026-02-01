import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, BarChart3, FolderOpen, Download, Upload } from 'lucide-react';
import './QuickReplyManager.css';

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut?: string;
  categoryId?: string;
  usageCount: number;
  lastUsedAt?: string;
  quickReplyCategory?: {
    id: string;
    name: string;
    color: string;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  _count?: { quickReplies: number };
}

export const QuickReplyManager: React.FC = () => {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuickReplies();
  }, []);

  const fetchQuickReplies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/quick-replies/enhanced', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setQuickReplies(data.quickReplies);
      setCategories(data.categories);
    } catch (error) {
      console.error('Failed to fetch quick replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quick reply?')) return;

    try {
      await fetch(`/api/v1/quick-replies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setQuickReplies(quickReplies.filter(qr => qr.id !== id));
    } catch (error) {
      console.error('Failed to delete quick reply:', error);
    }
  };

  const handleEdit = (quickReply: QuickReply) => {
    setEditingReply(quickReply);
    setShowCreateModal(true);
  };

  const filteredReplies = quickReplies.filter(qr => {
    const matchesSearch = qr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.shortcut?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || qr.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="quick-reply-manager">
      <div className="qr-header">
        <div className="qr-header-left">
          <h1>Quick Replies</h1>
          <span className="qr-count">{filteredReplies.length} replies</span>
        </div>
        <div className="qr-header-actions">
          <button className="btn-secondary" onClick={() => setShowCategoryModal(true)}>
            <FolderOpen size={20} /> Manage Categories
          </button>
          <button className="btn-primary" onClick={() => {
            setEditingReply(null);
            setShowCreateModal(true);
          }}>
            <Plus size={20} /> New Quick Reply
          </button>
        </div>
      </div>

      <div className="qr-filters">
        <div className="qr-search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search quick replies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="qr-category-filter">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="all">All Categories ({quickReplies.length})</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({quickReplies.filter(qr => qr.categoryId === cat.id).length})
              </option>
            ))}
          </select>
        </div>

        <div className="qr-view-toggle">
          <button className="btn-icon active">Grid</button>
          <button className="btn-icon">List</button>
        </div>
      </div>

      {loading ? (
        <div className="qr-loading">Loading quick replies...</div>
      ) : (
        <div className="qr-grid">
          {filteredReplies.map(qr => (
            <QuickReplyCard
              key={qr.id}
              quickReply={qr}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {filteredReplies.length === 0 && (
            <div className="qr-empty">
              <p>No quick replies found.</p>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                Create your first quick reply
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <QuickReplyModal
          quickReply={editingReply}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false);
            setEditingReply(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingReply(null);
            fetchQuickReplies();
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSave={() => {
            setShowCategoryModal(false);
            fetchQuickReplies();
          }}
        />
      )}
    </div>
  );
};

const QuickReplyCard: React.FC<{
  quickReply: QuickReply;
  onEdit: (qr: QuickReply) => void;
  onDelete: (id: string) => void;
}> = ({ quickReply, onEdit, onDelete }) => {
  return (
    <div className="qr-card">
      <div className="qr-card-header">
        <h3>{quickReply.title}</h3>
        <div className="qr-card-actions">
          <button onClick={() => onEdit(quickReply)} className="btn-icon">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(quickReply.id)} className="btn-icon btn-danger">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="qr-card-body">
        <p className="qr-content">{quickReply.content}</p>
      </div>
      
      <div className="qr-card-footer">
        <div className="qr-card-meta">
          {quickReply.shortcut && (
            <span className="qr-shortcut">/{quickReply.shortcut}</span>
          )}
          <span className="qr-usage">
            <BarChart3 size={14} /> {quickReply.usageCount} uses
          </span>
        </div>
        {quickReply.quickReplyCategory && (
          <span 
            className="qr-category-badge" 
            style={{ backgroundColor: quickReply.quickReplyCategory.color }}
          >
            {quickReply.quickReplyCategory.name}
          </span>
        )}
      </div>
    </div>
  );
};

const QuickReplyModal: React.FC<{
  quickReply: QuickReply | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}> = ({ quickReply, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: quickReply?.title || '',
    content: quickReply?.content || '',
    shortcut: quickReply?.shortcut || '',
    categoryId: quickReply?.categoryId || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = quickReply
        ? `/api/v1/quick-replies/${quickReply.id}`
        : '/api/v1/quick-replies';
      const method = quickReply ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      onSave();
    } catch (error) {
      console.error('Failed to save quick reply:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{quickReply ? 'Edit' : 'New'} Quick Reply</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Greeting Message"
              required
            />
          </div>

          <div className="form-group">
            <label>Message Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter your message here..."
              rows={5}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Shortcut</label>
              <input
                type="text"
                value={formData.shortcut}
                onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                placeholder="e.g., hello"
              />
              <small>Type /{formData.shortcut || 'shortcut'} in chat to use</small>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">No Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Quick Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CategoryModal: React.FC<{
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}> = ({ categories, onClose, onSave }) => {
  const [newCategory, setNewCategory] = useState({ name: '', color: '#3B82F6' });
  const [saving, setSaving] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategory.name) return;

    setSaving(true);
    try {
      await fetch('/api/v1/quick-replies/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newCategory),
      });
      setNewCategory({ name: '', color: '#3B82F6' });
      onSave();
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Categories</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        
        <div className="modal-body">
          <div className="category-form">
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="Category name"
            />
            <input
              type="color"
              value={newCategory.color}
              onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
            />
            <button onClick={handleAddCategory} disabled={saving} className="btn-primary">
              Add
            </button>
          </div>

          <div className="category-list">
            {categories.map(cat => (
              <div key={cat.id} className="category-item">
                <div className="category-color" style={{ backgroundColor: cat.color }} />
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickReplyManager;
