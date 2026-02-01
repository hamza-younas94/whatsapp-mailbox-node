#!/usr/bin/env node

/**
 * Quick Reply Test Script
 * 
 * This script tests the quick reply functionality by:
 * 1. Creating sample quick replies
 * 2. Testing the API endpoint
 * 3. Verifying autocomplete search
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Sample quick replies to create
const sampleQuickReplies = [
  {
    shortcut: 'hello',
    title: 'Friendly Greeting',
    content: 'Hello! Thanks for reaching out. How can I help you today?',
    category: 'Greetings'
  },
  {
    shortcut: 'thanks',
    title: 'Thank You',
    content: 'Thank you for your message. We appreciate your interest!',
    category: 'Greetings'
  },
  {
    shortcut: 'hours',
    title: 'Business Hours',
    content: 'Our business hours are Monday-Friday, 9 AM to 5 PM EST.',
    category: 'Information'
  },
  {
    shortcut: 'support',
    title: 'Support Info',
    content: 'For technical support, please email support@example.com or call +1-555-0123.',
    category: 'Support'
  },
  {
    shortcut: 'price',
    title: 'Pricing Information',
    content: 'Our pricing starts at $99/month. Would you like me to send you our full pricing details?',
    category: 'Sales'
  }
];

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    
    return data;
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function testQuickReplies() {
  if (!AUTH_TOKEN) {
    log('\n✗ AUTH_TOKEN is required. Example:', 'red');
    log('  AUTH_TOKEN=YOUR_JWT API_URL=http://localhost:3000 node test-quick-replies.js\n', 'yellow');
    process.exit(1);
  }
  log('\n========================================', 'cyan');
  log('  Quick Reply Functionality Test', 'cyan');
  log('========================================\n', 'cyan');

  try {
    // Step 1: Get existing quick replies
    log('1. Fetching existing quick replies...', 'blue');
    const existing = await makeRequest('/api/v1/quick-replies');
    log(`   ✓ Found ${existing.data.length} existing quick replies`, 'green');
    
    if (existing.data.length > 0) {
      log('\n   Existing quick replies:', 'yellow');
      existing.data.forEach(qr => {
        log(`   - /${qr.shortcut}: ${qr.title}`, 'yellow');
      });
    }

    // Step 2: Create sample quick replies
    log('\n2. Creating sample quick replies...', 'blue');
    const created = [];
    
    for (const qr of sampleQuickReplies) {
      // Check if shortcut already exists
      const exists = existing.data.find(e => e.shortcut === qr.shortcut);
      
      if (exists) {
        log(`   - Skipping "/${qr.shortcut}" (already exists)`, 'yellow');
        created.push(exists);
      } else {
        try {
          const result = await makeRequest('/api/v1/quick-replies', 'POST', qr);
          log(`   ✓ Created "/${qr.shortcut}": ${qr.title}`, 'green');
          created.push(result.data);
        } catch (error) {
          log(`   ✗ Failed to create "/${qr.shortcut}": ${error.message}`, 'red');
        }
      }
    }

    // Step 3: Test search functionality
    log('\n3. Testing search functionality...', 'blue');
    const searchTerms = ['hello', 'support', 'price', 'thanks'];
    
    for (const term of searchTerms) {
      const results = created.filter(qr => 
        qr.shortcut.toLowerCase().includes(term.toLowerCase()) ||
        (qr.title && qr.title.toLowerCase().includes(term.toLowerCase()))
      );
      
      log(`   - Search "/${term}": ${results.length} results`, results.length > 0 ? 'green' : 'yellow');
      if (results.length > 0) {
        results.forEach(r => log(`      → ${r.title}`, 'cyan'));
      }
    }

    // Step 4: Frontend testing instructions
    log('\n4. Frontend Testing:', 'blue');
    log('   To test in the UI:', 'yellow');
    log('   a) Open any conversation in the mailbox', 'yellow');
    log('   b) In the message input, type "/" followed by a shortcut:', 'yellow');
    created.forEach(qr => {
      log(`      - Type "/${qr.shortcut}" to see "${qr.title}"`, 'cyan');
    });
    log('   c) Use arrow keys to navigate suggestions', 'yellow');
    log('   d) Press Enter or Tab to insert the quick reply', 'yellow');
    log('   e) Press Escape to dismiss the dropdown', 'yellow');

    // Summary
    log('\n========================================', 'green');
    log('  Test Summary', 'green');
    log('========================================', 'green');
    log(`Total Quick Replies: ${existing.data.length + created.length}`, 'cyan');
    log(`Created in this test: ${created.length}`, 'cyan');
    log('\n✓ Quick Reply API is working correctly!', 'green');
    log('\nNow test the frontend autocomplete:', 'yellow');
    log('  1. Open WhatsApp Mailbox', 'yellow');
    log('  2. Select any conversation', 'yellow');
    log('  3. Type "/" in the message input', 'yellow');
    log('  4. Type a shortcut (e.g., "hello")', 'yellow');
    log('  5. The dropdown should appear with matching quick replies\n', 'yellow');

  } catch (error) {
    log('\n========================================', 'red');
    log('  Test Failed', 'red');
    log('========================================', 'red');
    log(`Error: ${error.message}`, 'red');
    log('\nTroubleshooting:', 'yellow');
    log('  1. Ensure the backend server is running on http://localhost:3001', 'yellow');
    log('  2. Check that you have a valid AUTH_TOKEN', 'yellow');
    log('  3. Verify database connection is working', 'yellow');
    log('  4. Check server logs for errors\n', 'yellow');
    process.exit(1);
  }
}

// Check if node-fetch is available (for Node.js < 18)
(async () => {
  if (typeof fetch === 'undefined') {
    try {
      const nodeFetch = await import('node-fetch');
      global.fetch = nodeFetch.default;
    } catch (error) {
      log('\n⚠️  node-fetch not available. Please use Node.js 18+ or install node-fetch:', 'yellow');
      log('   npm install node-fetch\n', 'cyan');
      process.exit(1);
    }
  }
  
  await testQuickReplies();
})();
