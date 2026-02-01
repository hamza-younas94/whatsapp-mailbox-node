# Architecture & Design Patterns

## System Architecture

```
┌─────────────────┐
│   Client        │
│   (Browser)     │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────────────────┐
│    Express.js Server        │
├─────────────────────────────┤
│  Routes / Controllers       │ ◄── Request Handling
│  Middleware (Auth, Validation)
└──────────┬──────────────────┘
           │
           ├──────────────────┬──────────────┐
           │                  │              │
           ▼                  ▼              ▼
    ┌─────────────┐  ┌──────────────┐  ┌─────────┐
    │   Service   │  │ Cache/Queue  │  │ Logger  │
    │   Layer     │  │ (Redis)      │  │ (Pino)  │
    └──────┬──────┘  └──────────────┘  └─────────┘
           │
           ▼
    ┌─────────────────────┐
    │  Repository Pattern │ ◄── Data Abstraction
    │  (Data Access)      │
    └──────────┬──────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
    ┌────────┐  ┌────────────┐
    │ MySQL  │  │ WhatsApp   │
    │Database│  │    API     │
    └────────┘  └────────────┘
```

## SOLID Principles Implementation

### 1. Single Responsibility Principle (SRP)

Each class has ONE reason to change:

```typescript
// ✅ Good: Each class has single responsibility
class MessageRepository {
  // Only handles data access for messages
}

class MessageService {
  // Only handles business logic for messages
}

class MessageController {
  // Only handles HTTP request/response
}

// ❌ Bad: Mixed responsibilities
class MessageManager {
  // Database operations
  // Business logic
  // HTTP handling
}
```

### 2. Open/Closed Principle (OCP)

Open for extension, closed for modification:

```typescript
// ✅ Good: Easy to extend without modifying
abstract class BaseRepository<T> {
  abstract modelName: keyof PrismaClient;
  // Common CRUD operations
}

class MessageRepository extends BaseRepository<Message> {
  // Extend with message-specific logic
}

// ❌ Bad: Must modify class to add new features
class Repository {
  if (type === 'message') { ... }
  if (type === 'contact') { ... }
  // Must add more if statements
}
```

### 3. Liskov Substitution Principle (LSP)

Subtypes must be substitutable for their base types:

```typescript
// ✅ Good: Repository interfaces are interchangeable
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  create(data: unknown): Promise<T>;
}

class MessageRepository implements IRepository<Message> { }
class ContactRepository implements IRepository<Contact> { }

// Usage: Works with any IRepository implementation
function useRepository<T>(repo: IRepository<T>) { }
```

### 4. Interface Segregation Principle (ISP)

Clients should depend on specific interfaces:

```typescript
// ✅ Good: Specific interfaces
interface IMessageRepository {
  findByConversation(conversationId: string): Promise<Message[]>;
  findByWaMessageId(waMessageId: string): Promise<Message | null>;
}

interface IContactRepository {
  findByPhoneNumber(phoneNumber: string): Promise<Contact | null>;
  search(filters: ContactFilters): Promise<Contact[]>;
}

// ❌ Bad: Fat interface
interface IRepository {
  // All possible operations for all entities
  findByConversation()
  findByPhoneNumber()
  findByWaMessageId()
  search()
  // ...100 more methods
}
```

### 5. Dependency Inversion Principle (DIP)

Depend on abstractions, not concrete implementations:

```typescript
// ✅ Good: Depends on abstract repository
class MessageService {
  constructor(private messageRepository: IMessageRepository) {}
  
  async sendMessage(input: CreateMessageInput): Promise<Message> {
    // Use repository interface
  }
}

// Easy to test with mock
const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
};

const service = new MessageService(mockRepository);

// ❌ Bad: Tightly coupled to concrete class
class MessageService {
  private repo = new MessageRepository(); // Hard to test!
}
```

## Design Patterns

### 1. Repository Pattern

**Purpose**: Abstract database operations

```typescript
// Interface defines contract
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  create(data: unknown): Promise<T>;
  update(id: string, data: unknown): Promise<T>;
  delete(id: string): Promise<T>;
}

// Base implementation
abstract class BaseRepository<T> implements IRepository<T> {
  // Common CRUD logic
}

// Specialized implementations
class MessageRepository extends BaseRepository<Message> {
  // Message-specific queries
  async findByWaMessageId(waMessageId: string): Promise<Message | null> {
    return this.prisma.message.findUnique({ where: { waMessageId } });
  }
}
```

**Benefits**:
- ✅ Decouple business logic from data access
- ✅ Easy to mock for testing
- ✅ Swap database without changing service logic
- ✅ Consistent data access patterns

### 2. Service Layer Pattern

**Purpose**: Encapsulate business logic

```typescript
// Service handles all business rules
class MessageService {
  constructor(
    private messageRepository: IMessageRepository,
    private whatsAppService: IWhatsAppService,
  ) {}

  async sendMessage(userId: string, input: CreateMessageInput): Promise<Message> {
    // 1. Validate input
    // 2. Check authorization
    // 3. Create message in DB
    // 4. Send via WhatsApp API
    // 5. Update status
    // 6. Log activity
  }
}

// Controller delegates to service
class MessageController {
  constructor(private messageService: MessageService) {}

  sendMessage = async (req: Request, res: Response) => {
    const message = await this.messageService.sendMessage(
      req.user.id,
      req.body,
    );
    res.json(message);
  };
}
```

**Benefits**:
- ✅ Single place for business logic
- ✅ Reusable across controllers
- ✅ Easy to test in isolation
- ✅ Clear separation of concerns

### 3. Dependency Injection

**Purpose**: Loosely couple components

```typescript
// Constructor injection
class MessageService {
  constructor(
    private messageRepository: IMessageRepository,
    private whatsAppService: IWhatsAppService,
  ) {}
}

// Factory pattern to create instances
function createMessageService(): MessageService {
  const prisma = getPrismaClient();
  const repository = new MessageRepository(prisma);
  const whatsAppService = new WhatsAppService();
  return new MessageService(repository, whatsAppService);
}

// Route setup with DI
const messageService = createMessageService();
const messageController = new MessageController(messageService);

router.post('/messages', messageController.sendMessage);
```

**Benefits**:
- ✅ Easy to test (inject mocks)
- ✅ Flexible configurations
- ✅ Swap implementations
- ✅ Better code reusability

### 4. Factory Pattern

**Purpose**: Create objects without specifying exact classes

```typescript
interface IRepository<T> {
  // ...
}

class RepositoryFactory {
  static create<T>(model: string, prisma: PrismaClient): IRepository<T> {
    switch (model) {
      case 'message':
        return new MessageRepository(prisma) as any;
      case 'contact':
        return new ContactRepository(prisma) as any;
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }
}

// Usage
const messageRepo = RepositoryFactory.create('message', prisma);
```

### 5. Adapter Pattern

**Purpose**: Integrate external services

```typescript
// External WhatsApp API
class WhatsAppService {
  async sendMessage(to: string, text: string): Promise<Response> {
    // Call WhatsApp HTTP API
    return axios.post('https://api.whatsapp.com/...');
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    // Download media from WhatsApp
  }
}

// Service adapts WhatsApp to our domain
class MessageService {
  async sendMessage(userId: string, input: CreateMessageInput) {
    // Business logic
    await this.whatsAppService.sendMessage(
      input.contactId,
      input.content,
    );
  }
}
```

## Data Flow

### Sending a Message

```
HTTP Request
     │
     ▼
┌─────────────────────────────────┐
│ Express Route Handler           │
│ POST /api/v1/messages           │
└────────────┬────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Middleware Pipeline                  │
│ 1. Auth Middleware (verify JWT)     │
│ 2. Validation (Zod schema)          │
│ 3. Error handling                    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ MessageController                    │
│ - Extract request data              │
│ - Call service                      │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ MessageService (Business Logic)      │
│ 1. Validate message length          │
│ 2. Create message in DB (PENDING)   │
│ 3. Send via WhatsApp API            │
│ 4. Update status (SENT/FAILED)      │
│ 5. Log activity                     │
└────────────┬─────────────────────────┘
             │
             ├──────────────┬─────────────────┐
             ▼              ▼                 ▼
      ┌──────────────┐ ┌──────────────┐ ┌────────────┐
      │ Message Repo │ │ WhatsApp API │ │ Logger     │
      │ (Database)   │ │              │ │            │
      └──────────────┘ └──────────────┘ └────────────┘
             │
             ▼
      ┌──────────────┐
      │ MySQL        │
      │ (Prisma ORM) │
      └──────────────┘
```

## Testing Strategy

### Unit Tests (Services)

```typescript
describe('MessageService', () => {
  it('should send message and update status', async () => {
    // Mock dependencies
    const mockRepository = {
      create: jest.fn().mockResolvedValue(message),
      update: jest.fn().mockResolvedValue(updatedMessage),
    };

    const mockWhatsAppService = {
      sendMessage: jest.fn().mockResolvedValue({ messageId: 'wa123' }),
    };

    const service = new MessageService(mockRepository, mockWhatsAppService);

    // Test
    const result = await service.sendMessage('user1', input);

    // Assert
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockWhatsAppService.sendMessage).toHaveBeenCalled();
    expect(result.status).toBe('SENT');
  });
});
```

### Integration Tests (API)

```typescript
describe('POST /api/v1/messages', () => {
  it('should send message and return 201', async () => {
    const response = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contactId: 'contact1',
        content: 'Hello',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeDefined();
  });
});
```

## Error Handling

```typescript
// Custom error hierarchy
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) { }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

// Middleware handles all errors
app.use((error: Error, req, res, next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
    });
  } else {
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});
```

---

**This architecture ensures**:
- ✅ Maintainability
- ✅ Testability
- ✅ Scalability
- ✅ Type safety
- ✅ Clear separation of concerns
