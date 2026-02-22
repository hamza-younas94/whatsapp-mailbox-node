// src/config/swagger.ts
// Swagger/OpenAPI configuration

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Business Mailbox API',
      version: '2.0.0',
      description: 'Professional WhatsApp Business CRM & Messaging Platform API',
      contact: { name: 'API Support' },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            perPage: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sku: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            cost: { type: 'number' },
            stockQuantity: { type: 'integer' },
            lowStockAlert: { type: 'integer' },
            isActive: { type: 'boolean' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoiceNumber: { type: 'string' },
            contactId: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'] },
            totalAmount: { type: 'number' },
            paidAmount: { type: 'number' },
            balanceAmount: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNumber: { type: 'string' },
            contactId: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] },
            orderType: { type: 'string', enum: ['DELIVERY', 'PICKUP', 'DINE_IN'] },
            totalAmount: { type: 'number' },
          },
        },
        ServiceTicket: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            ticketNumber: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          },
        },
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            appointmentDate: { type: 'string', format: 'date-time' },
            duration: { type: 'integer' },
            status: { type: 'string' },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category: { type: 'string' },
            amount: { type: 'number' },
            expenseDate: { type: 'string', format: 'date-time' },
          },
        },
        CustomerSubscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            planName: { type: 'string' },
            amount: { type: 'number' },
            billingCycle: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] },
            status: { type: 'string' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string' },
            priority: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Messages', description: 'Message management' },
      { name: 'Contacts', description: 'Contact management' },
      { name: 'Products', description: 'Product catalog & inventory' },
      { name: 'Invoices', description: 'Invoice & payment management' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Service Tickets', description: 'Service ticket management' },
      { name: 'Appointments', description: 'Appointment scheduling' },
      { name: 'Expenses', description: 'Expense tracking' },
      { name: 'Subscriptions', description: 'Customer subscription management' },
      { name: 'Tasks', description: 'Task management' },
      { name: 'Tags', description: 'Contact tagging' },
      { name: 'Auto-Tag Rules', description: 'Automatic tagging rules' },
      { name: 'Quick Replies', description: 'Quick reply templates' },
      { name: 'Broadcasts', description: 'Broadcast campaigns' },
      { name: 'Drip Campaigns', description: 'Drip campaign sequences' },
      { name: 'Analytics', description: 'Analytics & reporting' },
      { name: 'WhatsApp Web', description: 'WhatsApp Web session management' },
    ],
    paths: {
      // Products
      '/products': {
        get: { tags: ['Products'], summary: 'List products', parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'lowStock', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
        ], responses: { '200': { description: 'Product list' } } },
        post: { tags: ['Products'], summary: 'Create product', responses: { '201': { description: 'Product created' } } },
      },
      '/products/{id}': {
        get: { tags: ['Products'], summary: 'Get product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Product details' } } },
        put: { tags: ['Products'], summary: 'Update product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Product updated' } } },
        delete: { tags: ['Products'], summary: 'Delete product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Product deleted' } } },
      },
      // Invoices
      '/invoices': {
        get: { tags: ['Invoices'], summary: 'List invoices', responses: { '200': { description: 'Invoice list' } } },
        post: { tags: ['Invoices'], summary: 'Create invoice with items', responses: { '201': { description: 'Invoice created' } } },
      },
      '/invoices/{id}': {
        get: { tags: ['Invoices'], summary: 'Get invoice with items & payments', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice details' } } },
        put: { tags: ['Invoices'], summary: 'Update invoice', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice updated' } } },
        delete: { tags: ['Invoices'], summary: 'Delete invoice', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice deleted' } } },
      },
      '/invoices/{id}/payments': {
        get: { tags: ['Invoices'], summary: 'Get invoice payments', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Payment list' } } },
        post: { tags: ['Invoices'], summary: 'Record payment', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Payment recorded' } } },
      },
      // Orders
      '/orders': {
        get: { tags: ['Orders'], summary: 'List orders', responses: { '200': { description: 'Order list' } } },
        post: { tags: ['Orders'], summary: 'Create order (auto stock deduction)', responses: { '201': { description: 'Order created' } } },
      },
      '/orders/{id}': {
        get: { tags: ['Orders'], summary: 'Get order with items', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Order details' } } },
        put: { tags: ['Orders'], summary: 'Update order status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Order updated' } } },
        delete: { tags: ['Orders'], summary: 'Delete order', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Order deleted' } } },
      },
      // Service Tickets
      '/service-tickets': {
        get: { tags: ['Service Tickets'], summary: 'List service tickets', responses: { '200': { description: 'Ticket list' } } },
        post: { tags: ['Service Tickets'], summary: 'Create service ticket', responses: { '201': { description: 'Ticket created' } } },
      },
      '/service-tickets/{id}': {
        get: { tags: ['Service Tickets'], summary: 'Get ticket with updates & parts', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ticket details' } } },
        put: { tags: ['Service Tickets'], summary: 'Update ticket', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Ticket updated' } } },
      },
      // Appointments
      '/appointments': {
        get: { tags: ['Appointments'], summary: 'List appointments', responses: { '200': { description: 'Appointment list' } } },
        post: { tags: ['Appointments'], summary: 'Create appointment', responses: { '201': { description: 'Appointment created' } } },
      },
      // Expenses
      '/expenses': {
        get: { tags: ['Expenses'], summary: 'List expenses', responses: { '200': { description: 'Expense list' } } },
        post: { tags: ['Expenses'], summary: 'Create expense', responses: { '201': { description: 'Expense created' } } },
      },
      '/expenses/summary': {
        get: { tags: ['Expenses'], summary: 'Get expense summary by category', responses: { '200': { description: 'Expense summary' } } },
      },
      // Customer Subscriptions
      '/customer-subscriptions': {
        get: { tags: ['Subscriptions'], summary: 'List customer subscriptions', responses: { '200': { description: 'Subscription list' } } },
        post: { tags: ['Subscriptions'], summary: 'Create subscription', responses: { '201': { description: 'Subscription created' } } },
      },
      // Tasks
      '/tasks': {
        get: { tags: ['Tasks'], summary: 'List tasks', responses: { '200': { description: 'Task list' } } },
        post: { tags: ['Tasks'], summary: 'Create task', responses: { '201': { description: 'Task created' } } },
      },
      // Auto-Tag Rules
      '/auto-tag-rules': {
        get: { tags: ['Auto-Tag Rules'], summary: 'List auto-tag rules', responses: { '200': { description: 'Rule list' } } },
        post: { tags: ['Auto-Tag Rules'], summary: 'Create auto-tag rule', responses: { '201': { description: 'Rule created' } } },
      },
      '/auto-tag-rules/{id}/execute': {
        post: { tags: ['Auto-Tag Rules'], summary: 'Execute auto-tag rule manually', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Rule executed' } } },
      },
      // Bulk Operations
      '/contacts/bulk-tag': {
        post: { tags: ['Contacts'], summary: 'Bulk add tag to contacts', responses: { '200': { description: 'Tags applied' } } },
      },
      '/contacts/bulk-delete': {
        post: { tags: ['Contacts'], summary: 'Bulk delete contacts', responses: { '200': { description: 'Contacts deleted' } } },
      },
      '/contacts/duplicates': {
        get: { tags: ['Contacts'], summary: 'Find duplicate contacts', responses: { '200': { description: 'Duplicate groups' } } },
      },
      '/contacts/merge': {
        post: { tags: ['Contacts'], summary: 'Merge two contacts', responses: { '200': { description: 'Contacts merged' } } },
      },
    },
  },
  apis: [], // We defined paths inline above
};

export const swaggerSpec = swaggerJsdoc(options);
