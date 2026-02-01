import React, { useState, useRef, useEffect } from 'react';
import '@/styles/navbar.css';

interface NavbarProps {
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogout, onSearch }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { label: 'Messages', href: '/messages.html' },
    { label: 'Contacts', href: '/contacts.html' },
    { label: 'Quick Replies', href: '/quick-replies.html' },
    { label: 'Broadcasts', href: '/broadcasts.html' },
    { label: 'Segments', href: '/segments.html' },
    { label: 'Automations', href: '/automation.html' },
    { label: 'Tags', href: '/tags.html' },
    { label: 'Analytics', href: '/analytics.html' },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    onLogout?.();
    window.location.href = '/login.html';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo and Title */}
        <div className="navbar-brand">
          <div className="navbar-logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004c-1.025 0-2.04-.312-2.922-.902L6.897 5.817l-2.6.52.532 2.505C4.047 9.863 3.71 11.382 3.71 13c0 4.495 3.657 8.143 8.156 8.143 2.193 0 4.263-.814 5.822-2.286 1.559-1.472 2.423-3.485 2.423-5.857 0-4.495-3.656-8.144-8.156-8.144zm6.615 13.751c-1.838 1.397-4.228 2.229-6.615 2.229-3.865 0-7.01-3.125-7.01-6.971 0-1.27.324-2.504.927-3.565l.05-.083 2.582-.514-.532 2.505c-.115.546-.174 1.11-.174 1.686 0 2.948 2.406 5.353 5.354 5.353.982 0 1.903-.281 2.685-.764l1.921.485-.494-2.352" />
            </svg>
            <span className="logo-text">WhatsApp Mailbox</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="navbar-links">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="navbar-link">
              {item.label}
            </a>
          ))}
        </div>

        {/* Center - Search Bar */}
        <div className="navbar-search">
          <div className={`search-container ${searchActive ? 'active' : ''}`}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearch}
              onFocus={() => setSearchActive(true)}
              onBlur={() => setSearchActive(!searchQuery)}
              className="search-input"
            />
          </div>
        </div>

        {/* Right - Menu */}
        <div className="navbar-actions">
          {/* Status indicator */}
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <span className="status-text">Connected</span>
          </div>

          {/* Menu Button */}
          <div className="menu-wrapper" ref={menuRef}>
            <button
              className="menu-button"
              onClick={() => setShowMenu(!showMenu)}
              title="Menu"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="dropdown-menu">
                <a href="#settings" className="menu-item">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l1.72-1.34c.15-.12.19-.34.1-.51l-1.63-2.83c-.12-.22-.37-.29-.59-.22l-2.03.81c-.42-.32-.9-.6-1.42-.8l-.38-2.15c-.04-.24-.24-.41-.48-.41h-3.26c-.24 0-.43.17-.47.41l-.38 2.15c-.52.2-1 .48-1.42.8l-2.03-.81c-.23-.09-.47 0-.59.22L2.74 8.87c-.1.17-.06.39.1.51l1.72 1.34c-.05.3-.07.62-.07.94s.02.64.07.94l-1.72 1.34c-.15.12-.19.34-.1.51l1.63 2.83c.12.22.37.29.59.22l2.03-.81c.42.32.9.6 1.42.8l.38 2.15c.05.24.24.41.48.41h3.26c.24 0 .44-.17.47-.41l.38-2.15c.52-.2 1-.48 1.42-.8l2.03.81c.23.09.47 0 .59-.22l1.63-2.83c.1-.17.06-.39-.1-.51l-1.72-1.34zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                  <span>Settings</span>
                </a>
                <a href="#help" className="menu-item">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>Help & Support</span>
                </a>
                <hr className="menu-divider" />
                <button className="menu-item logout-button" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
