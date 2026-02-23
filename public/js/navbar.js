// Shared Navbar Component for WhatsApp Mailbox
// Include this script at the top of each HTML page

function createNavbar() {
    const currentPath = window.location.pathname;

    const coreItems = [
        { label: 'Messages', href: '/messages.html', icon: 'fa-comments' },
        { label: 'Contacts', href: '/contacts.html', icon: 'fa-address-book' },
        { label: 'Quick Replies', href: '/quick-replies.html', icon: 'fa-bolt' },
    ];

    const marketingItems = [
        { label: 'Broadcasts', href: '/broadcasts.html', icon: 'fa-bullhorn' },
        { label: 'Segments', href: '/segments.html', icon: 'fa-layer-group' },
        { label: 'Drip Campaigns', href: '/drip-campaigns.html', icon: 'fa-water' },
        { label: 'Automations', href: '/automation.html', icon: 'fa-robot' },
    ];

    const businessItems = [
        { label: 'Products', href: '/products.html', icon: 'fa-box' },
        { label: 'Invoices', href: '/invoices.html', icon: 'fa-file-invoice-dollar' },
        { label: 'Orders', href: '/orders.html', icon: 'fa-shopping-cart' },
        { label: 'Service Tickets', href: '/service-tickets.html', icon: 'fa-ticket' },
        { label: 'Appointments', href: '/appointments.html', icon: 'fa-calendar-check' },
        { label: 'Expenses', href: '/expenses.html', icon: 'fa-wallet' },
        { label: 'Subscriptions', href: '/subscriptions.html', icon: 'fa-sync' },
    ];

    const crmItems = [
        { label: 'Tags', href: '/tags.html', icon: 'fa-tags' },
        { label: 'Tasks', href: '/tasks.html', icon: 'fa-tasks' },
    ];

    const endItems = [
        { label: 'Analytics', href: '/analytics.html', icon: 'fa-chart-line' },
    ];

    const isActive = (href) => currentPath === href || currentPath.endsWith(href);
    const isDropdownActive = (items) => items.some(item => isActive(item.href));

    const makeLink = (item) => `
        <a href="${item.href}"
           class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${isActive(item.href)
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
            <i class="fas ${item.icon} mr-2 text-xs"></i>
            ${item.label}
        </a>`;

    const makeDropdownLink = (item) => `
        <a href="${item.href}"
           class="flex items-center px-4 py-2.5 text-sm transition-all
                  ${isActive(item.href)
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'}">
            <i class="fas ${item.icon} mr-3 text-xs w-4 text-center"></i>
            ${item.label}
        </a>`;

    const makeDropdown = (id, label, icon, items) => `
        <div class="relative" id="${id}Wrapper">
            <button onclick="toggleDropdown('${id}')"
                class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                       ${isDropdownActive(items)
                         ? 'bg-green-100 text-green-700'
                         : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
                <i class="fas ${icon} mr-2 text-xs"></i>
                ${label}
                <i class="fas fa-chevron-down ml-1.5 text-[10px]"></i>
            </button>
            <div id="${id}Menu" class="hidden absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border py-1.5 z-50">
                ${items.map(makeDropdownLink).join('')}
            </div>
        </div>`;

    const coreLinksHtml = coreItems.map(makeLink).join('');
    const marketingDropdown = makeDropdown('marketing', 'Marketing', 'fa-bullhorn', marketingItems);
    const businessDropdown = makeDropdown('business', 'Business', 'fa-briefcase', businessItems);
    const crmLinksHtml = crmItems.map(makeLink).join('');
    const endLinksHtml = endItems.map(makeLink).join('');

    // Mobile: flat list of all items
    const allItems = [...coreItems, ...marketingItems, ...businessItems, ...crmItems, ...endItems];
    const mobileLinksHtml = allItems.map(makeLink).join('');

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
                    <div class="hidden lg:flex items-center space-x-1 flex-1 justify-center mx-4">
                        ${coreLinksHtml}
                        ${marketingDropdown}
                        ${businessDropdown}
                        ${crmLinksHtml}
                        ${endLinksHtml}
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
                        ${mobileLinksHtml}
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

function toggleDropdown(id) {
    // Close all other dropdowns first
    document.querySelectorAll('[id$="Menu"]').forEach(menu => {
        if (menu.id !== id + 'Menu' && menu.id !== 'userMenu' && menu.id !== 'mobileMenu') {
            menu.classList.add('hidden');
        }
    });
    const menu = document.getElementById(id + 'Menu');
    menu.classList.toggle('hidden');
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
    const marketingMenu = document.getElementById('marketingMenu');
    const businessMenu = document.getElementById('businessMenu');

    if (userMenu && !e.target.closest('[onclick="toggleUserMenu()"]') && !e.target.closest('#userMenu')) {
        userMenu.classList.add('hidden');
    }
    if (marketingMenu && !e.target.closest('#marketingWrapper') && !e.target.closest('#marketingMenu')) {
        marketingMenu.classList.add('hidden');
    }
    if (businessMenu && !e.target.closest('#businessWrapper') && !e.target.closest('#businessMenu')) {
        businessMenu.classList.add('hidden');
    }
});

// Initialize navbar when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNavbar);
} else {
    createNavbar();
}
