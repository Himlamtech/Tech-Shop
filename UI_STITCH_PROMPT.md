# UI_STITCH_PROMPT.md

# Stitch Prompt — TechShop E-commerce UI

Copy toàn bộ prompt dưới đây vào Stitch để generate UI. Mục tiêu là sinh một giao diện e-commerce hiện đại, nhiều ảnh, có AI shopping assistant, đủ đẹp để demo và đưa vào report.

---

## Prompt

Design a premium, production-quality e-commerce website named **TechShop** for selling technology products and related lifestyle items.

The website must feel like a modern AI-powered shopping platform: clean, fast, visual, trustworthy, and optimized for conversion. The design should combine the polish of Apple-style product pages, the density of Shopee/Tiki-style commerce, and the intelligence of an AI assistant.

### Product positioning

TechShop sells:

- Smartphones
- Laptops
- Tablets
- Smart watches
- Audio devices
- Mobile accessories
- PC accessories
- Books / learning materials
- Fashion accessories
- Home appliances

### Visual style

Use a modern tech-commerce visual style:

- Clean white/light mode as default.
- Optional dark hero section with neon blue/purple accent.
- Rounded cards, soft shadows, glassmorphism only where useful.
- High-resolution product images.
- Clear product hierarchy: image → name → specs → price → rating → CTA.
- Premium but still practical for an online store.
- Use an 8px spacing grid.
- Desktop-first but fully responsive for mobile.

### Color palette

Use this palette:

- Primary: #2563EB or similar blue.
- Secondary: #7C3AED or similar purple.
- Success: #16A34A.
- Warning: #F59E0B.
- Danger: #DC2626.
- Background: #F8FAFC.
- Card: #FFFFFF.
- Text primary: #0F172A.
- Text secondary: #64748B.

### Typography

Use a modern sans-serif font. Suggested font style: Inter, SF Pro, or similar.

Text hierarchy:

- H1: bold, large, conversion-focused.
- H2: clear section titles.
- Product title: medium-semibold.
- Price: bold and visually dominant.
- Metadata/specs: smaller, muted.

### Global layout

Create these main areas:

1. Top announcement bar
   - Example: “Free shipping for orders over 2,000,000₫ | AI-powered product advice available 24/7”

2. Header / Navbar
   - Logo: TechShop
   - Search bar with placeholder: “Search laptops, phones, accessories...”
   - Category dropdown
   - AI Assistant button
   - Cart icon with item count
   - Login/Profile button

3. Main pages
   - Home page
   - Product listing page
   - Product detail page
   - Cart page
   - Checkout page
   - AI Chatbot page/drawer
   - Customer order tracking page
   - Admin dashboard overview

### Home page requirements

Design a strong homepage with:

1. Hero section
   - Headline: “Find the right tech faster with AI-powered shopping”
   - Subheadline: “Compare products, get personalized recommendations, and shop trusted devices in one place.”
   - CTA buttons: “Shop now”, “Ask AI Assistant”
   - Hero image area with floating cards for laptop, phone, headset.

2. Category shortcuts
   - Smartphones
   - Laptops
   - Tablets
   - Accessories
   - Smart Watches
   - Books
   - Fashion
   - Home Appliances

3. Featured products grid
   - 4 or 8 product cards.
   - Each card: image, category badge, product name, short specs, rating, stock status, price, add-to-cart button.

4. AI recommendation section
   - Title: “Recommended for you”
   - Subtitle: “Based on your browsing, cart, and similar customers.”
   - Product carousel.

5. Trust section
   - Genuine products
   - Warranty support
   - Fast shipping
   - Secure payment
   - AI product advisor

6. Review sentiment insight section
   - Example cards: “92% positive reviews for laptops”, “Top-rated accessories this week”.

### Product listing page

Create a full catalog page:

- Left sidebar filters:
  - Category
  - Brand
  - Price range
  - Rating
  - Stock status
  - Warranty
- Main product grid:
  - Sort dropdown: Popular, Newest, Price low to high, Rating.
  - Product cards with good image ratio.
- Search result header:
  - “Showing 128 products for laptops”
- AI suggestion chip:
  - “Need help choosing? Ask TechShop AI”

### Product detail page

Create a detailed product page:

- Left: image gallery with thumbnails.
- Right: product info:
  - Product title
  - Brand/category
  - Rating and number of reviews
  - Price and discount
  - Stock status
  - Key specs as chips
  - Quantity selector
  - Buttons: Add to cart, Buy now, Ask AI about this product
- Below:
  - Description
  - Specifications table
  - Customer reviews
  - AI sentiment summary
  - Similar products / frequently bought together

### AI Chatbot UI

Design an AI shopping assistant:

- Can be a floating drawer and a full page.
- Header: “TechShop AI Assistant”
- Small note: “Answers are based on current catalog, reviews, and store policies.”
- Suggested prompts:
  - “Recommend a laptop for AI learning under 20M VND”
  - “Compare iPhone and Samsung for photography”
  - “Which headphones are best for online meetings?”
- Chat bubbles:
  - User message
  - AI response
  - Product recommendation cards embedded inside assistant response
- AI response product card includes:
  - Image
  - Name
  - Price
  - Reason to recommend
  - CTA: View product

### Cart page

Cart page must include:

- List of cart items with image, name, specs, price, quantity, subtotal.
- Order summary:
  - Subtotal
  - Shipping fee
  - Discount
  - Total
- CTA: Proceed to checkout
- Recommendation block: “You may also like”

### Checkout page

Checkout page:

- Shipping address form.
- Payment method selector:
  - COD
  - Bank transfer simulation
  - Credit card simulation
- Order summary.
- Place order button.
- Payment status component: pending/success/failed.

### Customer order tracking

Create an order tracking page:

- Order ID
- Current status timeline:
  - Created
  - Payment pending
  - Paid
  - Processing shipment
  - Shipping
  - Delivered
- Items purchased
- Shipping address
- Payment summary

### Admin dashboard

Create admin dashboard pages/components:

1. Overview cards
   - Revenue
   - Orders
   - Products
   - Customers
   - AI recommendations served

2. Product management table
   - Product image
   - Name
   - Category
   - Price
   - Stock
   - Status
   - Actions

3. AI dashboard
   - Model status cards:
     - Product classification
     - Sentiment analysis
     - Customer segmentation
     - Sequence recommendation
     - RAG chatbot
   - Dataset import panel
   - Recent AI queries table

4. Order management table
   - Order ID
   - Customer
   - Total
   - Payment status
   - Shipping status
   - Actions

### Component requirements

Generate reusable components:

- ProductCard
- CategoryCard
- SearchBar
- FilterSidebar
- RatingStars
- PriceTag
- StockBadge
- AddToCartButton
- AIChatDrawer
- RecommendationCarousel
- OrderStatusTimeline
- AdminMetricCard
- DataTable

### Data placeholders

Use product data shape like:

```json
{
  "id": 122,
  "name": "iPhone 15 Pro Max",
  "category": "Smartphones",
  "brand": "Apple",
  "price": 28990000,
  "originalPrice": 32990000,
  "rating": 4.8,
  "reviewCount": 128,
  "stock": 12,
  "thumbnailUrl": "https://cdn.dummyjson.com/product-images/...",
  "imageUrls": ["https://cdn.dummyjson.com/product-images/..."],
  "specs": ["256GB", "Titanium", "A17 Pro", "6.7 inch"],
  "aiReason": "Best for photography and long-term software support."
}
```

### UX requirements

- Every primary CTA must be visually obvious.
- Product cards must not feel empty even when image is missing; use fallback placeholder.
- The AI assistant must look integrated into shopping, not like a generic chatbot.
- Use skeleton loading states for product grid and chat response.
- Use empty states for cart, search results, and recommendation list.
- Use error states for payment failed and service unavailable.
- Make mobile layout clean: product grid becomes 2 columns or 1 column, filters become bottom sheet.

### Deliverable expectation

Generate a polished, responsive UI design with all key screens and reusable components. Prioritize visual quality, product images, conversion flow, and AI-shopping differentiation.

---

## Integration Notes for Developer

Sau khi Stitch generate UI:

1. Map product cards với `catalog-service` response.
2. Map cart với `cart-service`.
3. Map checkout với `order-service` + `payment-service`.
4. Map chatbot với `ai-service /chat`.
5. Map recommendation carousel với `ai-service /recommendations` sau đó hydrate product details qua `catalog-service`.

