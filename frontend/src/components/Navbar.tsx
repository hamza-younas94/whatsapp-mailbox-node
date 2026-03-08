import React, { useState, useRef, useEffect } from 'react';
import '@/styles/navbar.css';

type SessionState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'QR_READY' | 'INITIALIZING' | 'UNKNOWN';

interface NavbarProps {
  onLogout?: () => void;
  onSearch?: (query: string) => void;
  sessionStatus?: SessionState;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const coreItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard.html', icon: 'fa-tachometer-alt' },
  { label: 'Mailbox', href: '/', icon: 'fa-inbox' },
  { label: 'Contacts', href: '/contacts.html', icon: 'fa-address-book' },
  { label: 'Quick Replies', href: '/quick-replies.html', icon: 'fa-bolt' },
];

const marketingItems: NavItem[] = [
  { label: 'Broadcasts', href: '/broadcasts.html', icon: 'fa-bullhorn' },
  { label: 'Segments', href: '/segments.html', icon: 'fa-layer-group' },
  { label: 'Drip Campaigns', href: '/drip-campaigns.html', icon: 'fa-water' },
  { label: 'Automations', href: '/automation.html', icon: 'fa-robot' },
];

const businessItems: NavItem[] = [
  { label: 'Products', href: '/products.html', icon: 'fa-box' },
  { label: 'Invoices', href: '/invoices.html', icon: 'fa-file-invoice-dollar' },
  { label: 'Orders', href: '/orders.html', icon: 'fa-shopping-cart' },
  { label: 'Service Tickets', href: '/service-tickets.html', icon: 'fa-ticket' },
  { label: 'Appointments', href: '/appointments.html', icon: 'fa-calendar-check' },
  { label: 'Expenses', href: '/expenses.html', icon: 'fa-wallet' },
  { label: 'Subscriptions', href: '/subscriptions.html', icon: 'fa-sync' },
];

const crmItems: NavItem[] = [
  { label: 'Tags', href: '/tags.html', icon: 'fa-tags' },
  { label: 'Tasks', href: '/tasks.html', icon: 'fa-tasks' },
];

const endItems: NavItem[] = [
  { label: 'Analytics', href: '/analytics.html', icon: 'fa-chart-line' },
];

const statusLabels: Record<SessionState, string> = {
  CONNECTED: 'Connected',
  CONNECTING: 'Connecting...',
  DISCONNECTED: 'Disconnected',
  QR_READY: 'Scan QR',
  INITIALIZING: 'Starting...',
  UNKNOWN: 'Checking...',
};

const Navbar: React.FC<NavbarProps> = ({ onLogout, onSearch, sessionStatus = 'UNKNOWN' }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const toggleDropdown = (id: string) => {
    setOpenDropdown(prev => prev === id ? null : id);
  };

  const renderNavLink = (item: NavItem) => (
    <a key={item.href} href={item.href} className="navbar-link">
      <i className={`fas ${item.icon}`}></i>
      {item.label}
    </a>
  );

  const renderDropdown = (id: string, label: string, icon: string, items: NavItem[]) => (
    <div key={id} className="nav-dropdown-wrapper">
      <button
        className="navbar-link dropdown-trigger"
        onClick={() => toggleDropdown(id)}
      >
        <i className={`fas ${icon}`}></i>
        {label}
        <i className={`fas fa-chevron-down dropdown-arrow ${openDropdown === id ? 'open' : ''}`}></i>
      </button>
      {openDropdown === id && (
        <div className="nav-dropdown-menu">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="nav-dropdown-item">
              <i className={`fas ${item.icon}`}></i>
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-brand">
          <a href="/dashboard.html" className="navbar-logo">
            <div className="logo-icon-wrapper">
              <i className="fab fa-whatsapp logo-fa-icon"></i>
            </div>
            <span className="logo-text">WhatsApp Mailbox</span>
          </a>
        </div>

        {/* Navigation Links */}
        <div className="navbar-links" ref={navRef}>
          {coreItems.map(renderNavLink)}
          {renderDropdown('marketing', 'Marketing', 'fa-bullhorn', marketingItems)}
          {renderDropdown('business', 'Business', 'fa-briefcase', businessItems)}
          {crmItems.map(renderNavLink)}
          {endItems.map(renderNavLink)}
        </div>

        {/* Search */}
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

        {/* Right Actions */}
        <div className="navbar-actions">
          <div className={`status-indicator ${sessionStatus === 'CONNECTED' ? '' : 'status-warn'}`}>
            <span className={`status-dot ${sessionStatus === 'CONNECTED' ? 'active' : ''}`}></span>
            <span className="status-text">{statusLabels[sessionStatus]}</span>
          </div>

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

            {showMenu && (
              <div className="dropdown-menu">
                <a href="/qr-connect.html" className="menu-item">
                  <i className="fas fa-qrcode"></i>
                  <span>QR Connect</span>
                </a>
                <a href="/analytics.html" className="menu-item">
                  <i className="fas fa-chart-line"></i>
                  <span>Analytics</span>
                </a>
                <a href="/automation.html" className="menu-item">
                  <i className="fas fa-robot"></i>
                  <span>Automations</span>
                </a>
                <hr className="menu-divider" />
                <button className="menu-item logout-button" onClick={handleLogout}>
                  <i className="fas fa-sign-out-alt"></i>
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
