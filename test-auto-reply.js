// test-auto-reply.js
// Test script for the new auto-reply system

const { autoReplyService } = require('./dist/services/auto-reply.service');

// Sample quick replies
const sampleQuickReplies = [
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
  {
    id: '4',
    shortcut: 'hello greeting',
    content: 'Hello! Thanks for reaching out. How can I help you today?',
    isActive: true,
    usageCount: 0,
    usageTodayCount: 0,
  },
];

// Test cases
const testCases = [
  // Exact matches
  { message: 'payment', expected: 'payment', type: 'exact' },
  { message: 'pricing', expected: 'pricing', type: 'exact' },
  
  // Word matches
  { message: 'payment kab tak send kro ga bhai', expected: 'payment', type: 'exact/contains' },
  { message: 'pricing details chahiye', expected: 'pricing', type: 'exact/contains' },
  { message: 'hello bhai', expected: 'hello greeting', type: 'keyword' },
  
  // Typo tolerance (fuzzy)
  { message: 'paymet', expected: 'payment', type: 'fuzzy' },
  { message: 'pricng', expected: 'pricing', type: 'fuzzy' },
  
  // Context awareness
  { message: 'Payment successful?', expected: 'payment', type: 'exact/contains' },
  { message: 'bhai payment ho gaya?', expected: 'payment', type: 'keyword' },
  { message: 'kya pricing me discount hai', expected: 'pricing', type: 'keyword' },
  
  // Should not match
  { message: 'random text that matches nothing', expected: null, type: 'none' },
  { message: 'abc xyz', expected: null, type: 'none' },
];

console.log('🧪 Testing Auto-Reply System\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  const result = autoReplyService.findBestMatch(testCase.message, sampleQuickReplies);
  
  const matched = result ? result.reply.shortcut : null;
  const success = matched === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ Test ${i + 1}: PASS`);
  } else {
    failed++;
    console.log(`❌ Test ${i + 1}: FAIL`);
  }
  
  console.log(`   Message: "${testCase.message}"`);
  console.log(`   Expected: ${testCase.expected || 'no match'}`);
  console.log(`   Got: ${matched || 'no match'}`);
  
  if (result) {
    console.log(`   Match Type: ${result.matchType}`);
    console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
  }
  
  console.log('');
}

console.log('=' .repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

// Test rate limiting
console.log('\n🧪 Testing Rate Limiting\n');
console.log('=' .repeat(80));

const context = {
  userId: 'test-user',
  contactId: 'test-contact',
  conversationId: 'test-conv',
  messageText: 'payment',
  timestamp: Date.now(),
};

async function testRateLimiting() {
  console.log('Test 1: First message should trigger auto-reply');
  const result1 = await autoReplyService.processAutoReply(context, sampleQuickReplies);
  console.log(result1 ? '✅ Auto-reply triggered' : '❌ No auto-reply');
  if (result1) {
    console.log(`   Shortcut: ${result1.reply.shortcut}`);
    console.log(`   Score: ${(result1.score * 100).toFixed(1)}%`);
  }
  
  console.log('\nTest 2: Immediate second message should be rate-limited');
  context.timestamp = Date.now(); // < 5 seconds
  const result2 = await autoReplyService.processAutoReply(context, sampleQuickReplies);
  console.log(result2 ? '❌ Auto-reply triggered (should be blocked)' : '✅ Correctly rate-limited');
  
  console.log('\nTest 3: After 5+ seconds, should trigger again');
  await new Promise(resolve => setTimeout(resolve, 5100)); // Wait 5.1 seconds
  context.timestamp = Date.now();
  const result3 = await autoReplyService.processAutoReply(context, sampleQuickReplies);
  console.log(result3 ? '✅ Auto-reply triggered after delay' : '❌ Should have triggered');
  if (result3) {
    console.log(`   Shortcut: ${result3.reply.shortcut}`);
  }
}

testRateLimiting().then(() => {
  console.log('\n' + '=' .repeat(80));
  console.log('\n✅ All tests completed!');
  console.log('\n📖 For more information, see AUTO_REPLY_SYSTEM.md');
});
