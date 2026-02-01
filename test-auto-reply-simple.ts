// test-auto-reply-simple.ts
// Simple test script for the auto-reply matching logic

interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
  isActive: boolean;
  usageCount: number;
  usageTodayCount: number;
}

// Sample quick replies
const sampleQuickReplies: QuickReply[] = [
  {
    id: '1',
    shortcut: 'payment',
    content: 'We accept the following payment methods:\n• Cash on Delivery (COD)\n• Bank Transfer\n• Credit/Debit Cards\n• EasyPaisa / JazzCash\n\nWhich method works best for you?',
    isActive: true,
    usageCount: 0,
    usageTodayCount: 0,
  },
  {
    id: '2',
    shortcut: 'pricing',
    content: '🎉 Great news! We currently have the following offers:\n• 10% off on first purchase\n• Free shipping on orders over $50\n• Bulk discounts available\n\nWould you like more details?',
    isActive: true,
    usageCount: 0,
    usageTodayCount: 0,
  },
  {
    id: '3',
    shortcut: 'away',
    content: 'Hi! I\'m currently away from my desk. I\'ll respond to your message as soon as I return. Thank you for your patience! 🙏',
    isActive: true,
    usageCount: 0,
    usageTodayCount: 0,
  },
];

// Test cases
const testCases = [
  { message: 'payment', expectedShortcut: 'payment', description: 'Exact match' },
  { message: 'pricing', expectedShortcut: 'pricing', description: 'Exact match' },
  { message: 'payment kab tak send kro ga bhai', expectedShortcut: 'payment', description: 'Word in sentence' },
  { message: 'pricing details chahiye', expectedShortcut: 'pricing', description: 'Word in sentence' },
  { message: 'paymet', expectedShortcut: 'payment', description: 'Typo tolerance' },
  { message: 'Payment successful?', expectedShortcut: 'payment', description: 'Case insensitive' },
  { message: 'bhai payment ho gaya?', expectedShortcut: 'payment', description: 'Urdu + English mix' },
  { message: 'random text', expectedShortcut: null, description: 'No match' },
];

console.log('🧪 Testing Auto-Reply Matching Logic\n');
console.log('=' .repeat(80));
console.log('\nTest Messages:\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  // Simple matching logic demonstration
  const normalizedMessage = test.message.toLowerCase().trim();
  const messageWords = normalizedMessage.split(/\s+/);
  
  let matched: QuickReply | null = null;
  let matchType = 'none';
  
  // Try to find a match
  for (const reply of sampleQuickReplies) {
    if (!reply.isActive || !reply.shortcut) continue;
    
    const shortcut = reply.shortcut.toLowerCase().trim();
    
    // Exact match
    if (normalizedMessage === shortcut) {
      matched = reply;
      matchType = 'exact';
      break;
    }
    
    // Word match
    if (messageWords.includes(shortcut)) {
      matched = reply;
      matchType = 'word';
      break;
    }
    
    // Contains match
    if (normalizedMessage.includes(shortcut) || shortcut.includes(normalizedMessage)) {
      matched = reply;
      matchType = 'contains';
      break;
    }
  }
  
  const matchedShortcut = matched ? matched.shortcut : null;
  const success = matchedShortcut === test.expectedShortcut;
  
  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${test.description}`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${test.description}`);
  }
  
  console.log(`   Message: "${test.message}"`);
  console.log(`   Expected: ${test.expectedShortcut || 'no match'}`);
  console.log(`   Got: ${matchedShortcut || 'no match'}`);
  console.log(`   Match Type: ${matchType}`);
  console.log('');
});

console.log('=' .repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

console.log('\n📝 Key Features Demonstrated:\n');
console.log('  • Exact message matching');
console.log('  • Word-based matching in sentences');
console.log('  • Case insensitive matching');
console.log('  • Multi-language support (English + Urdu)');
console.log('  • Typo tolerance (with full implementation)');
console.log('  • Active status filtering');
console.log('');
console.log('📖 For complete documentation, see AUTO_REPLY_SYSTEM.md');
