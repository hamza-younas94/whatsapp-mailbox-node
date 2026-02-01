// Shared Navbar Component for WhatsApp Mailbox
// Include this script at the top of each HTML page

function createNavbar() {
    const currentPath = window.location.pathname;
    
    const navItems = [
        { label: 'Messages', href: '/messages.html', icon: 'fa-comments' },
        { label: 'Contacts', href: '/contacts.html', icon: 'fa-address-book' },
        { label: 'Quick Replies', href: '/quick-replies.html', icon: 'fa-bolt' },
        { label: 'Broadcasts', href: '/broadcasts.html', icon: 'fa-bullhorn' },
        { label: 'Segments', href: '/segments.html', icon: 'fa-layer-group' },
        { label: 'Drip Campaigns', href: '/drip-campaigns.html', icon: 'fa-water' },
        { label: 'Automations', href: '/automation.html', icon: 'fa-robot' },
        { label: 'Tags', href: '/tags.html', icon: 'fa-tags' },
        { label: 'Analytics', href: '/analytics.html', icon: 'fa-chart-line' },
    ];

    const isActive = (href) => currentPath === href || currentPath.endsWith(href);
    
    const navLinksHtml = navItems.map(item => `
        <a href="${item.href}" 
           class="nav-link flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive(item.href) 
                    ? 'bg-green-100 text-green-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
            <i class="fas ${item.icon} mr-2 text-xs"></i>
            ${item.label}
        </a>
    `).join('');

    const navbarHtml = `
        <nav class="navbar-main bg-white shadow-lg sticky top-0 z-40">
            <div class="max-w-full mx-auto px-4">
                <div class="flex items-center justify-between py-3">
                    <!-- Logo -->
                    <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                        <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                            <i class="fab fa-whatsapp text-white text-xl"></i>
                        </div>
                        <span class="font-bold text-xl text-gray-800 hidden sm:block">WhatsApp Mailbox</span>
                    </a>
                    
                    <!-- Navigation Links (Desktop) -->
                    <div class="hidden lg:flex items-center space-x-1 flex-1 justify-center mx-4 overflow-x-auto">
                        ${navLinksHtml}
                    </div>
                    
                    <!-- Right Side -->
                    <div class="flex items-center space-x-3">
                        <!-- Status -->
                        <div class="hidden md:flex items-center px-3 py-1.5 bg-green-50 rounded-full">
                            <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            <span class="text-xs text-green-700 font-medium">Connected</span>
                        </div>
                        
                        <!-- User Menu -->
                        <div class="relative">
                            <button onclick="toggleUserMenu()" class="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-all">
                                <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user text-gray-600"></i>
                                </div>
                                <i class="fas fa-chevron-down text-xs text-gray-500 hidden sm:block"></i>
                            </button>
                            <div id="userMenu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border py-2 z-50">
                                <a href="/qr-connect.html" class="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50">
                                    <i class="fas fa-qrcode mr-2 text-gray-400"></i>
                                    QR Connect
                                </a>
                                <hr class="my-2">
                                <button onclick="handleLogout()" class="w-full flex items-center px-4 py-2 text-red-600 hover:bg-red-50">
                                    <i class="fas fa-sign-out-alt mr-2"></i>
                                    Logout
                                </button>
                            </div>
                        </div>
                        
                        <!-- Mobile Menu Button -->
                        <button onclick="toggleMobileMenu()" class="lg:hidden p-2 rounded-lg hover:bg-gray-100">
                            <i class="fas fa-bars text-gray-600"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Mobile Navigation -->
                <div id="mobileMenu" class="hidden lg:hidden pb-4">
                    <div class="flex flex-wrap gap-2">
                        ${navLinksHtml}
                    </div>
                </div>
            </div>
        </nav>
    `;

    // Insert navbar at the beginning of body
    const navContainer = document.createElement('div');
    navContainer.innerHTML = navbarHtml;
    document.body.insertBefore(navContainer.firstElementChild, document.body.firstChild);
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.classList.toggle('hidden');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('hidden');
}

function handleLogout() {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (userMenu && !e.target.closest('[onclick="toggleUserMenu()"]') && !e.target.closest('#userMenu')) {
        userMenu.classList.add('hidden');
    }
});

// Initialize navbar when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNavbar);
} else {
    createNavbar();
}
