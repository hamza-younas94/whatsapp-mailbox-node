# Shop System Integration Guide

## Overview
The shop system is fully integrated with WhatsApp Mailbox and connects seamlessly with contacts, messages, and other modules.

## Access Points

### 1. **Web Interface**
- **URL**: `http://152.42.216.141:3000/shops.html`
- **Navigation**: Click "Shops" in the main navigation bar
- **Features**:
  - View all your shops
  - Manage products with real-time stock tracking
  - Customer database linked to WhatsApp contacts
  - Sales transactions with payment tracking
  - Analytics dashboard

### 2. **API Endpoints**
All endpoints require authentication token in header: `Authorization: Bearer <token>`

#### **Shops**
```bash
# Create shop
POST /api/v1/shops
{
  "name": "My Hardware Store",
  "type": "PHYSICAL",  // PHYSICAL, ONLINE, or BOTH
  "currency": "PKR",
  "taxRate": 5,
  "phone": "+923001234567",
  "address": "123 Main Street, Karachi"
}

# Get all shops
GET /api/v1/shops

# Get shop details
GET /api/v1/shops/:shopId
```

#### **Products**
```bash
# Create product
POST /api/v1/products
{
  "shopId": "shop_id_here",
  "name": "iPhone 15 Pro Max",
  "sku": "IP15PM-256",
  "price": 450000,
  "cost": 420000,
  "stock": 10,
  "lowStockThreshold": 3,
  "unit": "pcs",
  "categoryId": "category_id_here"
}

# Get products by shop
GET /api/v1/products/shop/:shopId
GET /api/v1/products/shop/:shopId?category=xyz&search=iphone

# Update product
PUT /api/v1/products/:productId
```

#### **Customers**
```bash
# Create customer (auto-linked to WhatsApp contact)
POST /api/v1/customers
{
  "shopId": "shop_id_here",
  "name": "Ahmed Ali",
  "phone": "+923001234567",
  "email": "ahmed@example.com",
  "contactId": "contact_id_from_whatsapp",  // Optional
  "customerGroup": "wholesale"  // retail, wholesale, vip
}

# Get customers by shop
GET /api/v1/customers/shop/:shopId

# Get customer details
GET /api/v1/customers/:customerId
```

#### **Sales Transactions**
```bash
# Create transaction
POST /api/v1/transactions
{
  "shopId": "shop_id_here",
  "customerId": "customer_id_here",
  "items": [
    {
      "productId": "product_id_here",
      "quantity": 2,
      "unitPrice": 450000,
      "discount": 10000
    }
  ],
  "discountAmount": 0,
  "taxAmount": 0,
  "notes": "Urgent delivery",
  "deliveryAddress": "Customer's office"
}

# Get transactions
GET /api/v1/transactions/shop/:shopId
GET /api/v1/transactions/shop/:shopId?status=CONFIRMED&startDate=2026-01-01&endDate=2026-01-31

# Update transaction status
PUT /api/v1/transactions/:txnId/status
{
  "status": "COMPLETED"  // PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED
}
```

#### **Categories**
```bash
# Create category
POST /api/v1/categories
{
  "shopId": "shop_id_here",
  "name": "Electronics",
  "description": "Electronic items and gadgets",
  "parentId": null  // For nested categories
}

# Get categories
GET /api/v1/categories/shop/:shopId
```

#### **Analytics**
```bash
# Get shop analytics
GET /api/v1/analytics/shop/:shopId

Response:
{
  "success": true,
  "data": {
    "totalSales": 1500000,
    "totalOrders": 45,
    "totalProducts": 120,
    "totalCustomers": 67,
    "lowStockProducts": [...]
  }
}
```

## Integration with Other Modules

### 1. **WhatsApp Contacts Integration**
- **Link customers to contacts**: Every customer can be linked to a WhatsApp contact
- **Auto-create customers**: When a contact orders, automatically create a customer record
- **Sync contact info**: Phone numbers, names, and profile pictures sync between systems

```javascript
// Example: Create customer from WhatsApp contact
const contact = await prisma.contact.findUnique({ where: { phoneNumber } });
const customer = await prisma.customer.create({
  data: {
    shopId: shopId,
    contactId: contact.id,
    name: contact.name,
    phone: contact.phoneNumber,
  }
});
```

### 2. **WhatsApp Messaging Integration**
Use shop data to send automated messages:

```javascript
// Send order confirmation via WhatsApp
const transaction = await createTransaction(...);
await whatsappService.sendMessage({
  to: customer.phone,
  text: `Order confirmed! Transaction #${transaction.transactionNumber}
  
Total: PKR ${transaction.finalAmount}
Items: ${transaction.items.length}

We'll notify you when it's ready for delivery.`
});
```

### 3. **Automations Integration**
Create automated workflows for shop events:

- **Low stock alerts**: When product.stock <= lowStockThreshold
- **Order confirmations**: Auto-send WhatsApp message after transaction created
- **Payment reminders**: Send reminders for unpaid transactions
- **Delivery updates**: Notify customers when order status changes

```javascript
// Example automation trigger
if (product.stock <= product.lowStockThreshold) {
  await whatsappService.sendMessage({
    to: shopOwner.phone,
    text: `🚨 Low Stock Alert!
    
Product: ${product.name}
Current Stock: ${product.stock} ${product.unit}
Threshold: ${product.lowStockThreshold}`
  });
}
```

### 4. **Broadcasts Integration**
Send promotional messages to customers:

```javascript
// Get all customers for a shop
const customers = await prisma.customer.findMany({
  where: { shopId: shopId, isActive: true }
});

// Create broadcast
await whatsappService.createBroadcast({
  recipients: customers.map(c => c.phone),
  message: `🎉 New Year Sale!
  
50% OFF on all electronics
Valid until Jan 15
Visit: ${shop.website}`
});
```

### 5. **Analytics Integration**
Shop metrics feed into main analytics dashboard:

- **Revenue tracking**: Daily, weekly, monthly sales
- **Product performance**: Best sellers, slow movers
- **Customer insights**: Top customers, repeat purchase rate
- **Inventory health**: Stock turnover, low stock items

### 6. **Tags Integration**
Tag customers based on shop behavior:

```javascript
// Tag VIP customers (total purchases > 100,000)
if (customer.totalPurchases > 100000) {
  await prisma.tagOnContact.create({
    data: {
      contactId: customer.contactId,
      tag: { connect: { name: 'VIP Customer' } }
    }
  });
}
```

## Use Cases

### **Hardware Shop**
- Track inventory of tools, materials, equipment
- Manage wholesale vs retail customers
- Auto-reorder when stock low
- Send WhatsApp invoices with product details

### **Computer Shop**
- Categorize products: Laptops, Desktops, Accessories
- Track serial numbers in metadata
- Warranty management
- Build custom PCs (using variants)

### **Online Store**
- Multi-location inventory
- Delivery address tracking
- Payment gateway integration
- Order status updates via WhatsApp

## Quick Start

1. **Create your first shop**:
   ```bash
   curl -X POST http://152.42.216.141:3000/api/v1/shops \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My Shop",
       "type": "PHYSICAL",
       "currency": "PKR"
     }'
   ```

2. **Access the shop management UI**:
   - Go to http://152.42.216.141:3000/shops.html
   - Login with your credentials
   - Click "Add Shop" to get started

3. **Add products**: Use the Products tab to add your inventory

4. **Create customers**: Link WhatsApp contacts as customers

5. **Record sales**: Create transactions and track payments

## Database Schema

```
Shop
├── Products (with categories, variants, images)
├── Customers (linked to WhatsApp contacts)
└── SalesTransactions
    └── TransactionItems (order line items)

Product
├── Stock tracking
├── Low stock threshold
└── StockMovements (audit trail)

Customer
├── Contact information
├── Purchase history
└── Loyalty points
```

## Best Practices

1. **Always set low stock thresholds** to get automatic alerts
2. **Link customers to contacts** for seamless WhatsApp integration
3. **Use categories** to organize large product catalogs
4. **Track stock movements** for audit trail
5. **Set up automations** for order confirmations and delivery updates
6. **Use customer groups** (retail/wholesale/vip) for targeted promotions
7. **Regular backups** of transaction data

## Next Steps

- Set up automated order confirmations
- Create WhatsApp catalog from products
- Build customer loyalty program
- Integrate payment gateway
- Add barcode scanning for POS
- Generate sales reports
- Set up multi-user access with roles

---

**Need Help?** The shop system is fully integrated with all existing modules. Start by creating a shop, then add products and customers!
