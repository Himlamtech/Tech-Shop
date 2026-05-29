# PROJECT.md

# TechShop Project Guide

## 1. Project Overview

TechShop là website bán đồ công nghệ theo kiến trúc microservices, backend chính bằng Django REST Framework, tích hợp AI-Service cho recommendation, sentiment analysis, customer segmentation, product classification và RAG chatbot.

System phải đạt 3 mục tiêu:

1. **Chạy được demo end-to-end:** browse → cart → checkout → payment → shipping → AI chat.
2. **Đúng yêu cầu môn học:** Django, microservices, database-per-service, 2 MySQL + PostgreSQL, AI models, datasets, diagrams.
3. **Production-like:** service boundary rõ, logs, healthcheck, Docker, deploy docs, coding convention.

## 2. Repository Structure

```txt
techshop/
├── README.md
├── PROJECT.md
├── BUSINESS_ANALYSIS.md
├── ARCHITECTURE.md
├── CODING_CONVENTION.md
├── DEPLOYS.md
├── .env.example
├── docker-compose.yml
├── gateway/
│   ├── nginx.conf
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   └── src/
├── services/
│   ├── identity-service/
│   ├── catalog-service/
│   ├── cart-service/
│   ├── order-service/
│   ├── payment-service/
│   ├── shipping-service/
│   ├── review-service/
│   └── ai-service/
├── infrastructure/
│   ├── prometheus/
│   ├── grafana/
│   └── scripts/
├── datasets/
│   ├── raw/
│   ├── processed/
│   └── README.md
└── docs/
    ├── diagrams/
    ├── screenshots/
    └── report-notes/
```

## 3. Service Stack

| Service | Framework | DB | Engine | Port | Responsibility |
|---|---|---|---|---:|---|
| gateway | Nginx | N/A | N/A | 80 | API routing, static routing |
| frontend | React/Next/Vite | N/A | N/A | 3000 | Web UI |
| identity-service | Django DRF | identity_db | MySQL | 8001 | Auth, users, RBAC |
| catalog-service | Django DRF | catalog_db | PostgreSQL | 8002 | Products, categories, inventory, images |
| cart-service | Django DRF | cart_db | PostgreSQL | 8003 | Cart and cart items |
| order-service | Django DRF | order_db | PostgreSQL | 8004 | Orders and order lifecycle |
| payment-service | Django DRF | payment_db | MySQL | 8005 | Payment simulation |
| shipping-service | Django DRF | shipping_db | PostgreSQL | 8006 | Shipment tracking |
| review-service | Django DRF | review_db | PostgreSQL | 8007 | Reviews and ratings |
| ai-service | FastAPI or Django DRF wrapper | ai_db | PostgreSQL + pgvector | 8010 | ML/RAG/recommendation |

Note: Nếu giảng viên bắt buộc mọi service đều Django, hãy triển khai `ai-service` bằng Django DRF và tách phần inference thành Python modules. Nếu được phép như tài liệu mẫu, FastAPI hợp lý hơn cho AI inference.

## 4. Database Rule

Hard rule:

```txt
A service can only access its own database.
```

Allowed:

- `order-service` gọi `cart-service` qua REST.
- `order-service` gọi `payment-service` qua REST.
- `ai-service` gọi `catalog-service` qua REST hoặc dùng catalog snapshot được sync.

Not allowed:

- `order-service` query trực tiếp `catalog_db`.
- `cart-service` join trực tiếp `product` table.
- `ai-service` đọc tất cả DB bằng connection string.

## 5. Environment Variables

Use `.env` per service.

Common:

```env
APP_ENV=development
DEBUG=true
SECRET_KEY=change-me
ALLOWED_HOSTS=localhost,127.0.0.1
JWT_PUBLIC_KEY=...
JWT_ISSUER=techshop.identity
LOG_LEVEL=INFO
```

Service URL config:

```env
IDENTITY_SERVICE_URL=http://identity-service:8000
CATALOG_SERVICE_URL=http://catalog-service:8000
CART_SERVICE_URL=http://cart-service:8000
ORDER_SERVICE_URL=http://order-service:8000
PAYMENT_SERVICE_URL=http://payment-service:8000
SHIPPING_SERVICE_URL=http://shipping-service:8000
AI_SERVICE_URL=http://ai-service:8000
```

## 6. API Prefix Convention

Gateway routes:

```txt
/api/auth/*       -> identity-service
/api/users/*      -> identity-service
/api/catalog/*    -> catalog-service
/api/cart/*       -> cart-service
/api/orders/*     -> order-service
/api/payments/*   -> payment-service
/api/shipping/*   -> shipping-service
/api/reviews/*    -> review-service
/api/ai/*         -> ai-service
```

Internal service routes should still be versioned:

```txt
/api/v1/products
/api/v1/cart
/api/v1/orders
```

Gateway may expose clean external path while services keep versioned APIs.

## 7. AI Model Plan

| Model | Business Function | Input | Output | Priority |
|---|---|---|---|---|
| XGBoost/LightGBM | Product classification | title, description, brand, attributes | category label | Must |
| BERT/PhoBERT/mBERT | Sentiment analysis | review text | sentiment label + score | Must |
| KMeans | Customer segmentation | RFM/action features | segment id/name | Must |
| LSTM/GRU | Next-product recommendation | sequence of product/action IDs | candidate product IDs | Must |
| RAG + LLM | Product advisory chatbot | user query + retrieved products/policies | grounded answer | Must |

Optional:

- Collaborative filtering baseline using implicit ALS/SVD.
- Hybrid ranker combining model scores.

## 8. Dataset Plan

| Dataset | Source Type | Usage |
|---|---|---|
| DummyJSON Products | Public API | Product seed, image URL, mock reviews |
| Amazon Reviews 2023 / UCSD | Public research dataset | Reviews, metadata, product relations |
| RetailRocket Ecommerce Dataset | Public Kaggle dataset | User behavior: view/addtocart/transaction |
| UCI Online Retail | Public UCI dataset | Transaction/RFM/customer segmentation |
| TechShop FAQ | Self-built internal knowledge base | RAG policies: warranty, shipping, return, payment |

## 9. Development Phases

### Phase 0 — Repo stabilization

- Create service folders.
- Add Docker Compose.
- Add `.env.example`.
- Add healthcheck endpoint for every service.
- Add gateway route skeleton.

### Phase 1 — Catalog first

Goal: Fix “data chưa hiển thị lên hệ thống”.

Tasks:

- Implement category/product/product_image models.
- Add seed command from DummyJSON or CSV.
- Add product list/detail/search/filter APIs.
- Add frontend homepage/product listing/product detail.
- Show real image URLs.

Definition of done:

- Homepage shows at least 50 products with images.
- Product detail page opens.
- Filter by category works.

### Phase 2 — Auth + customer journey

- Implement register/login/refresh.
- Add frontend login state.
- Implement cart.
- Implement checkout and order creation.
- Implement payment simulation.
- Implement shipping status.

Definition of done:

- Customer can complete full purchase flow.

### Phase 3 — AI RAG Chatbot

Goal: Fix “chưa chạy Chat RAG”.

- Export product catalog as AI documents.
- Generate embeddings.
- Store embeddings in `ai_db` with pgvector.
- Implement `/api/ai/chat`.
- Return product IDs in answer metadata.
- Frontend renders product cards inside chat.

Definition of done:

- User asks product advice and receives grounded answer with products from catalog.

### Phase 4 — AI models for scoring/report

- Product classifier baseline.
- Sentiment classifier baseline.
- KMeans segmentation over transactions.
- LSTM/GRU sequence recommendation.
- Comparison charts for report.

Definition of done:

- Report has model structure, data sample, training result, comparison chart, analysis.

### Phase 5 — Admin + report assets

- Admin dashboard.
- Screenshots.
- Diagrams.
- Deployment documentation.

## 10. Standard API Response

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_...",
    "pagination": {}
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found",
    "details": {}
  },
  "meta": {
    "request_id": "req_..."
  }
}
```

## 11. Vertical Slice Demo Script

For final demo:

1. Open homepage.
2. Search “laptop”.
3. Open laptop detail.
4. Ask AI: “Laptop này có phù hợp học AI không?”
5. Add to cart.
6. Checkout.
7. Payment success.
8. Show order status.
9. Admin dashboard shows new order.
10. Show AI dashboard/model outputs.

## 12. Done Criteria

A feature is done only when:

- API implemented.
- Serializer/schema clear.
- DB migration exists.
- Unit/API test basic exists.
- Logs have request_id.
- Docker service runs.
- Frontend integration works or API is documented.
- Screenshot can be used in report.

