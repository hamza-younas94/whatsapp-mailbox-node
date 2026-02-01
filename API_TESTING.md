# API Testing Guide

Quick reference for testing all API endpoints.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

All endpoints (except `/health`) require JWT authentication.

### Get Token
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "SecurePass123!",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Save the returned `token` for subsequent requests.

## Quick Replies

### Create Quick Reply
```bash
curl -X POST http://localhost:3000/api/v1/quick-replies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shortcut": "/hello",
    "message": "Hello! How can I help you today?",
    "category": "greetings"
  }'
```

### List Quick Replies
```bash
curl -X GET http://localhost:3000/api/v1/quick-replies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search Quick Replies
```bash
curl -X GET "http://localhost:3000/api/v1/quick-replies/search?q=hello" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Quick Reply
```bash
curl -X PUT http://localhost:3000/api/v1/quick-replies/REPLY_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi there! How may I assist you?"
  }'
```

### Delete Quick Reply
```bash
curl -X DELETE http://localhost:3000/api/v1/quick-replies/REPLY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Tags

### Create Tag
```bash
curl -X POST http://localhost:3000/api/v1/tags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Customer",
    "color": "#FF5733"
  }'
```

### List Tags
```bash
curl -X GET http://localhost:3000/api/v1/tags \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Add Tag to Contact
```bash
curl -X POST http://localhost:3000/api/v1/tags/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "CONTACT_ID",
    "tagId": "TAG_ID"
  }'
```

### Remove Tag from Contact
```bash
curl -X DELETE http://localhost:3000/api/v1/tags/contacts/CONTACT_ID/TAG_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Contacts

### Create Contact
```bash
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "email": "john@example.com"
  }'
```

### List Contacts
```bash
curl -X GET http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Contact
```bash
curl -X GET http://localhost:3000/api/v1/contacts/CONTACT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Contact
```bash
curl -X PUT http://localhost:3000/api/v1/contacts/CONTACT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith"
  }'
```

## Messages

### Send Message
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Hello from the API!"
  }'
```

### Send Message with Media
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Check out this image!",
    "mediaUrl": "https://example.com/image.jpg",
    "mediaType": "IMAGE"
  }'
```

### List Messages
```bash
curl -X GET http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Message
```bash
curl -X GET http://localhost:3000/api/v1/messages/MESSAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Broadcasts

### Create Broadcast
```bash
curl -X POST http://localhost:3000/api/v1/broadcasts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Newsletter",
    "message": "Hello! Here are this week updates...",
    "segmentId": "SEGMENT_ID"
  }'
```

### List Broadcasts
```bash
curl -X GET http://localhost:3000/api/v1/broadcasts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Broadcast Immediately
```bash
curl -X POST http://localhost:3000/api/v1/broadcasts/BROADCAST_ID/send \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Schedule Broadcast
```bash
curl -X POST http://localhost:3000/api/v1/broadcasts/BROADCAST_ID/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleTime": "2024-01-15T10:00:00Z"
  }'
```

### Cancel Broadcast
```bash
curl -X POST http://localhost:3000/api/v1/broadcasts/BROADCAST_ID/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Automations

### Create Automation
```bash
curl -X POST http://localhost:3000/api/v1/automations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Message",
    "triggerType": "TAG_ADDED",
    "triggerValue": "new_customer",
    "actions": [
      {
        "type": "SEND_MESSAGE",
        "value": "Welcome to our service!"
      },
      {
        "type": "WAIT",
        "delay": 3600
      },
      {
        "type": "SEND_MESSAGE",
        "value": "How are you finding our service so far?"
      }
    ],
    "isActive": true
  }'
```

### List Automations
```bash
curl -X GET http://localhost:3000/api/v1/automations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Automation
```bash
curl -X PUT http://localhost:3000/api/v1/automations/AUTO_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Welcome Message"
  }'
```

### Toggle Automation
```bash
curl -X PATCH http://localhost:3000/api/v1/automations/AUTO_ID/toggle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

### Delete Automation
```bash
curl -X DELETE http://localhost:3000/api/v1/automations/AUTO_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Analytics

### Get Statistics
```bash
curl -X GET http://localhost:3000/api/v1/analytics/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Statistics with Date Range
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/stats?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Message Trends
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/trends?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Health Check

```bash
curl -X GET http://localhost:3000/health
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid token
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `INTERNAL_SERVER_ERROR` - Server error

## Success Responses

All successful responses follow this format:

```json
{
  "success": true,
  "data": { /* response data */ }
}
```

Or for actions without data:

```json
{
  "success": true,
  "message": "Action completed successfully"
}
```

## Rate Limiting

Broadcasts are rate-limited to 10 messages/second to comply with WhatsApp API limits.

## Pagination

List endpoints support pagination:

```bash
curl -X GET "http://localhost:3000/api/v1/contacts?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response includes pagination metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Testing Tips

1. **Save your token**: Export it as an environment variable:
   ```bash
   export TOKEN="your_jwt_token_here"
   curl -H "Authorization: Bearer $TOKEN" ...
   ```

2. **Use jq for pretty JSON**:
   ```bash
   curl ... | jq '.'
   ```

3. **Test in order**:
   - Create contacts first
   - Create tags
   - Add tags to contacts
   - Create segments
   - Create broadcasts
   - Create automations

4. **Check logs**: Monitor server logs for detailed error information:
   ```bash
   npm run dev
   ```

5. **Use Postman/Thunder Client**: Import these curl commands for easier testing

## Example Workflow

1. Register/Login to get token
2. Create contacts
3. Create tags (e.g., "VIP", "New Customer")
4. Tag contacts
5. Create quick replies
6. Create automation (welcome message on tag)
7. Create broadcast campaign
8. Check analytics

## WebSocket (Coming Soon)

Real-time message updates will be available via WebSocket connection.

## Additional Resources

- API Documentation: [Swagger/OpenAPI] (coming soon)
- Postman Collection: (coming soon)
- Frontend Integration Examples: (coming soon)
