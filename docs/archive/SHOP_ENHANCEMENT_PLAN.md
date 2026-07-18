# Shop Management System - Enhancement Plan

## Current Issues
1. **Tags not displaying** - Fixed by converting sidebar to modal with proper data loading
2. **Need comprehensive shop features** - Products, categories, inventory, customers (without invoicing/transactions)

## Recommended Enhancements for All Types of Shops

### 1. Product Management System

#### Product Features:
- **Product Categories** - Multi-level categorization (Electronics > Phones > Samsung)
- **Product Variants** - Size, color, material options with different prices
- **Product Images** - Multiple images per product with primary image
- **Barcode/SKU Management** - Auto-generate or manual entry
- **Inventory Tracking** - Real-time stock levels, low stock alerts
- **Bulk Import/Export** - CSV upload for mass product addition
- **Product Bundles** - Group products together (combo deals)
- **Product Tags** - Searchable tags (featured, bestseller, new arrival)

#### Pricing Features:
- **Price History** - Track price changes over time
- **Bulk Pricing** - Wholesale pricing tiers
- **Discount Rules** - Percentage or fixed amount discounts
- **Special Offers** - Time-limited promotions

### 2. Customer Management (No Invoicing)

#### Customer Database:
- **Customer Profiles** - Name, phone, email, address
- **Purchase History** - List of products bought (no invoicing)
- **Customer Notes** - Important information about preferences
- **Customer Groups** - VIP, wholesale, retail, frequent buyer
- **Loyalty Points** - Simple point system (optional)
- **Wishlist** - Products customer is interested in

#### Communication:
- **WhatsApp Integration** - Send catalog via WhatsApp
- **Broadcast Lists** - Send promotions to customer groups
- **Order Confirmations** - Simple confirmation messages
- **Follow-up Messages** - Post-purchase follow-up

### 3. Catalog Management

#### Catalog Features:
- **Digital Catalog** - Beautiful product showcase
- **Share via WhatsApp** - Direct sharing to customers
- **Catalog Categories** - Organized browsing experience
- **Search & Filter** - Quick product discovery
- **QR Code** - Generate catalog QR codes
- **Price Lists** - Printable price sheets

### 4. Inventory Management

#### Stock Features:
- **Stock Levels** - Current quantity tracking
- **Stock Adjustments** - Manual add/remove stock
- **Low Stock Alerts** - Automatic notifications
- **Stock History** - Track changes over time
- **Multi-location** - Track stock across warehouses/stores
- **Stock Transfer** - Move stock between locations

### 5. Order Management (Simple, No Invoicing)

#### Order Features:
- **Quick Order Entry** - Add products to order via WhatsApp
- **Order Status** - Pending, Confirmed, Packed, Shipped, Delivered
- **Order Notes** - Special instructions
- **Order History** - Customer's past orders
- **Order Search** - Find orders quickly
- **Delivery Tracking** - Simple status updates

### 6. Analytics & Reports

#### Basic Reports:
- **Product Performance** - Best/worst sellers
- **Stock Report** - Current inventory status
- **Customer Report** - Top customers, new customers
- **Sales Summary** - Daily/weekly/monthly totals (quantity-based)
- **Category Performance** - Which categories sell best
- **Low Stock Report** - Products needing restock

### 7. Shop Settings

#### Configuration:
- **Shop Profile** - Name, logo, contact details
- **Multiple Shops** - Manage multiple stores/locations
- **Categories Management** - Create/edit/delete categories
- **Tax Settings** - Optional tax calculations
- **Currency Settings** - Set default currency
- **Business Hours** - Operating hours

### 8. WhatsApp Integration Enhancements

#### Features:
- **Product Catalog Sharing** - Send product cards via WhatsApp
- **Quick Order** - "Order Product X" command
- **Stock Inquiry** - Check product availability
- **Price Inquiry** - Quick price checks
- **Image Recognition** - Customer sends product image to inquire
- **Voice Notes** - Accept voice orders (transcribe)
- **Location Sharing** - Delivery address via WhatsApp

## Database Schema Updates Needed

### New Tables:

```sql
-- Product Categories
CREATE TABLE ProductCategory (
  id            String    @id @default(cuid())
  name          String
  description   String?
  parentId      String?   -- For nested categories
  parent        ProductCategory? @relation("CategoryHierarchy", fields: [parentId])
  children      ProductCategory[] @relation("CategoryHierarchy")
  imageUrl      String?
  displayOrder  Int       @default(0)
  isActive      Boolean   @default(true)
  shopId        String
  shop          Shop      @relation(fields: [shopId])
  products      Product[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
)

-- Product Variants
CREATE TABLE ProductVariant (
  id          String    @id @default(cuid())
  productId   String
  product     Product   @relation(fields: [productId])
  name        String    -- "Red, Large"
  sku         String?   @unique
  price       Decimal
  stock       Int       @default(0)
  attributes  Json      -- { color: "red", size: "large" }
  imageUrl    String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
)

-- Product Images
CREATE TABLE ProductImage (
  id          String    @id @default(cuid())
  productId   String
  product     Product   @relation(fields: [productId])
  url         String
  altText     String?
  isPrimary   Boolean   @default(false)
  displayOrder Int      @default(0)
  createdAt   DateTime  @default(now())
)

-- Customer
CREATE TABLE Customer (
  id              String    @id @default(cuid())
  shopId          String
  shop            Shop      @relation(fields: [shopId])
  contactId       String?   -- Link to WhatsApp contact
  contact         Contact?  @relation(fields: [contactId])
  name            String
  phone           String
  email           String?
  address         String?
  city            String?
  notes           String?
  group           String    @default("retail") -- retail, wholesale, vip
  loyaltyPoints   Int       @default(0)
  totalPurchases  Int       @default(0)
  lastPurchaseAt  DateTime?
  isActive        Boolean   @default(true)
  tags            String[]  -- searchable tags
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
)

-- Simple Order (No invoicing)
CREATE TABLE SimpleOrder (
  id            String    @id @default(cuid())
  orderNumber   String    @unique  -- ORD-000001
  shopId        String
  shop          Shop      @relation(fields: [shopId])
  customerId    String
  customer      Customer  @relation(fields: [customerId])
  status        OrderStatus @default(PENDING)
  items         OrderItem[]
  totalAmount   Decimal
  notes         String?
  deliveryAddress String?
  deliveryDate  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
)

-- Stock Movement
CREATE TABLE StockMovement (
  id          String    @id @default(cuid())
  productId   String
  product     Product   @relation(fields: [productId])
  variantId   String?
  variant     ProductVariant? @relation(fields: [variantId])
  type        MovementType  -- IN, OUT, ADJUSTMENT, TRANSFER
  quantity    Int
  reason      String?
  reference   String?   -- Order number, supplier, etc
  location    String?   -- Warehouse, Store 1, etc
  createdBy   String
  user        User      @relation(fields: [createdBy])
  createdAt   DateTime  @default(now())
)

-- Product Bundle
CREATE TABLE ProductBundle (
  id          String    @id @default(cuid())
  name        String
  description String?
  shopId      String
  shop        Shop      @relation(fields: [shopId])
  products    BundleItem[]
  price       Decimal   -- Bundle price (usually discounted)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
)

CREATE TABLE BundleItem (
  id          String    @id @default(cuid())
  bundleId    String
  bundle      ProductBundle @relation(fields: [bundleId])
  productId   String
  product     Product   @relation(fields: [productId])
  quantity    Int       @default(1)
)
```

## Implementation Priority

### Phase 1 (Week 1-2): Core Features
1. ✅ Product categories (nested)
2. ✅ Product variants (size, color)
3. ✅ Product images (multiple)
4. ✅ Customer management (basic)
5. ✅ Simple orders (no invoicing)

### Phase 2 (Week 3-4): Enhanced Features
1. Stock movement tracking
2. Low stock alerts
3. Product bundles
4. Catalog generation
5. WhatsApp catalog sharing

### Phase 3 (Week 5-6): Advanced Features
1. Bulk import/export
2. Analytics dashboard
3. Multi-location inventory
4. Loyalty points system
5. Advanced search & filters

### Phase 4 (Week 7-8): Integration & Polish
1. WhatsApp order automation
2. Image recognition for products
3. Voice note transcription
4. QR code generation
5. Mobile-friendly interfaces

## API Endpoints Needed

```typescript
// Categories
POST   /api/v1/categories
GET    /api/v1/categories/:shopId
PUT    /api/v1/categories/:id
DELETE /api/v1/categories/:id
GET    /api/v1/categories/:id/products

// Enhanced Products
GET    /api/v1/products/:id/variants
POST   /api/v1/products/:id/variants
PUT    /api/v1/products/:productId/variants/:id
DELETE /api/v1/products/:productId/variants/:id
POST   /api/v1/products/:id/images
DELETE /api/v1/products/:productId/images/:imageId

// Customers
POST   /api/v1/customers
GET    /api/v1/customers/:shopId
GET    /api/v1/customers/:id
PUT    /api/v1/customers/:id
DELETE /api/v1/customers/:id
GET    /api/v1/customers/:id/orders
POST   /api/v1/customers/:id/points  // Add loyalty points

// Simple Orders
POST   /api/v1/orders
GET    /api/v1/orders/:shopId
GET    /api/v1/orders/:id
PUT    /api/v1/orders/:id/status
DELETE /api/v1/orders/:id

// Stock Management
POST   /api/v1/stock/movement
GET    /api/v1/stock/movements/:productId
GET    /api/v1/stock/low-stock/:shopId
POST   /api/v1/stock/adjust

// Catalog
GET    /api/v1/catalog/:shopId
POST   /api/v1/catalog/:shopId/share  // Share via WhatsApp
GET    /api/v1/catalog/:shopId/qrcode

// Bundles
POST   /api/v1/bundles
GET    /api/v1/bundles/:shopId
PUT    /api/v1/bundles/:id
DELETE /api/v1/bundles/:id

// Analytics
GET    /api/v1/analytics/products/bestsellers/:shopId
GET    /api/v1/analytics/stock/summary/:shopId
GET    /api/v1/analytics/customers/top/:shopId
GET    /api/v1/analytics/sales/summary/:shopId
```

## UI Components Needed

### 1. Product Management UI
- Product list with grid/table view
- Product form with image upload
- Category tree view
- Variant manager
- Bulk actions (import, export, delete)

### 2. Customer Management UI
- Customer list with filters
- Customer profile modal
- Purchase history view
- Customer groups management
- Quick actions (tag, message, note)

### 3. Order Management UI
- Order list with status filters
- Quick order entry form
- Order details modal
- Status update buttons
- Print order summary

### 4. Catalog UI
- Product catalog viewer
- Category navigation
- Search & filters
- Share buttons (WhatsApp, link)
- QR code generator

### 5. Inventory UI
- Stock level dashboard
- Low stock alerts
- Stock adjustment form
- Stock movement history
- Location selector

### 6. Analytics Dashboard
- Sales charts (quantity, not money)
- Product performance
- Customer insights
- Stock status overview
- Quick stats cards

## Next Steps

1. **Review & Approve** - Confirm these enhancements match your needs
2. **Prioritize Features** - Select Phase 1 features to implement first
3. **Database Migration** - Create new tables for categories, customers, etc
4. **API Development** - Build backend services
5. **UI Development** - Create frontend components
6. **Testing** - Test with real shop data
7. **Deploy** - Roll out to production

## Questions to Consider

1. Do you want multi-location inventory tracking?
2. Should customers have login access or just admins?
3. Do you need barcode scanning support?
4. Should we support multiple currencies?
5. Do you want automated WhatsApp messages for orders?
6. Should products have expiry dates (for food/pharmacy)?
7. Do you need supplier management?
8. Should we track product returns/exchanges?

Let me know which features you want to implement first!
