# BUSINESS_ANALYSIS.md

# TechShop — Business Analysis

## 1. Executive Summary

TechShop là hệ thống e-commerce bán sản phẩm công nghệ và các nhóm sản phẩm liên quan như electronics, fashion accessories, books, home appliances. Hệ thống cần được xây dựng theo **Django + Microservices**, có **AI-Service** phục vụ tư vấn sản phẩm, recommendation, phân tích review và cá nhân hóa trải nghiệm.

Mục tiêu không phải chỉ làm demo CRUD, mà là một hệ thống có đủ business flow, data flow, service boundary, AI pipeline, deploy, logging và tài liệu để bảo vệ như một sản phẩm gần production.

## 2. Constraint từ khách hàng / môn học

| Nhóm | Yêu cầu bắt buộc | Cách xử lý trong TechShop |
|---|---|---|
| Backend | Django bắt buộc | Business services dùng Django REST Framework |
| Architecture | Microservice bắt buộc | Mỗi bounded context = 1 service |
| Database | Mỗi service có DB riêng | Database-per-service, không join cross-service |
| DB engine | 2 service dùng MySQL, còn lại PostgreSQL | `identity-service` và `payment-service` dùng MySQL; services còn lại dùng PostgreSQL |
| AI | 4 hoặc 5 model khác nhau | Chọn 5 model rõ nghiệp vụ: XGBoost, BERT/PhoBERT, KMeans, LSTM, RAG + LLM |
| Dataset | 5 bộ dataset | Tách theo product, review, behavior, transaction, FAQ/knowledge base |
| Product | Nhiều loại mặt hàng | Electronics, laptops, smartphones, tablets, accessories, fashion, books, home appliances |
| UI | Website bán hàng đẹp, nhiều ảnh | Frontend lấy image URL từ product catalog seed/API |
| Report | Có diagram và kết quả chạy | Tài liệu này định nghĩa đủ input cho class diagram, sequence, activity, deployment diagram |

## 3. Business Goals

1. Cho phép khách hàng xem, tìm kiếm, lọc và mua sản phẩm.
2. Cho phép admin/staff quản lý catalog, tồn kho, đơn hàng, thanh toán giả lập, vận chuyển.
3. Tích hợp AI để:
   - Tư vấn sản phẩm bằng chatbot.
   - Gợi ý sản phẩm theo hành vi.
   - Phân tích sentiment từ review.
   - Phân khúc khách hàng.
   - Phân loại sản phẩm tự động.
4. Có kiến trúc microservices đủ rõ để chứng minh các tiêu chí: scalability, maintainability, fault isolation, database-per-service.

## 4. Stakeholders

| Actor | Mục tiêu | Chức năng liên quan |
|---|---|---|
| Guest | Xem sản phẩm, tìm kiếm, hỏi chatbot | Product browsing, search, chatbot |
| Customer | Mua hàng, quản lý đơn, review | Auth, cart, checkout, order, review |
| Staff | Xử lý order và shipping | Order management, shipping update |
| Admin | Quản trị catalog, user, dữ liệu AI | Product CRUD, inventory, dataset import, AI job |
| System | Đồng bộ trạng thái giữa service | REST API, event, job, logging |
| AI Service | Sinh gợi ý và tư vấn | Recommendation, RAG, sentiment, segmentation |

## 5. Scope

### 5.1 In Scope — MVP bắt buộc

- Đăng ký, đăng nhập, JWT authentication.
- Role: `admin`, `staff`, `customer`.
- Product catalog nhiều category, có ảnh, giá, tồn kho, mô tả, rating.
- Product search/filter/sort.
- Product detail page.
- Cart: add/update/remove item.
- Checkout tạo order.
- Payment simulation: pending/success/failed.
- Shipping simulation: processing/shipping/delivered.
- AI chatbot hỏi đáp/tư vấn sản phẩm bằng RAG.
- Recommendation endpoint trả danh sách sản phẩm đề xuất.
- Admin import seed product data.
- Docker Compose chạy được toàn hệ thống.

### 5.2 In Scope — Nâng cao để ăn điểm

- Review service và sentiment analysis.
- Customer segmentation dashboard.
- Product classification khi import catalog.
- Event logging cho hành vi: view, search, add_to_cart, checkout.
- Hybrid recommendation score.
- Observability: structured log, healthcheck, Prometheus/Grafana.
- Report diagrams: use case, class, sequence, activity, deployment, data model.

### 5.3 Out of Scope

- Thanh toán thật qua VNPay/MoMo.
- Giao hàng thật qua GHN/GHTK.
- Distributed tracing full OpenTelemetry nếu không đủ thời gian.
- Kubernetes production thật; chỉ đưa optional docs.

## 6. Domain Decomposition

| Bounded Context | Service | DB | DB Engine | Nhiệm vụ |
|---|---|---:|---|---|
| Identity & Access | `identity-service` | `identity_db` | MySQL | User, auth, JWT, RBAC |
| Product Catalog | `catalog-service` | `catalog_db` | PostgreSQL | Product, category, inventory, images |
| Cart | `cart-service` | `cart_db` | PostgreSQL | Cart, cart item |
| Ordering | `order-service` | `order_db` | PostgreSQL | Order, order item, lifecycle |
| Payment | `payment-service` | `payment_db` | MySQL | Payment transaction simulation |
| Shipping | `shipping-service` | `shipping_db` | PostgreSQL | Shipment, tracking status |
| Review | `review-service` | `review_db` | PostgreSQL | Review, rating, sentiment result |
| AI | `ai-service` | `ai_db` | PostgreSQL + pgvector | Models, embeddings, RAG, recommendations |
| Gateway | `gateway` | N/A | N/A | Nginx reverse proxy |
| Frontend | `web-app` | N/A | N/A | UI bán hàng và admin dashboard |

Decision: Không để service này đọc DB của service khác. Muốn lấy dữ liệu thì gọi API hoặc consume event.

## 7. Functional Requirements

### 7.1 Identity Service

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Customer đăng ký tài khoản | Must |
| AUTH-02 | User login nhận access/refresh token | Must |
| AUTH-03 | RBAC theo role admin/staff/customer | Must |
| AUTH-04 | Validate JWT cho internal service | Must |
| AUTH-05 | Admin xem danh sách user | Should |

### 7.2 Catalog Service

| ID | Requirement | Priority |
|---|---|---|
| CAT-01 | Admin tạo/sửa/xóa product | Must |
| CAT-02 | Hiển thị category tree | Must |
| CAT-03 | Product có nhiều image URL | Must |
| CAT-04 | Search theo keyword | Must |
| CAT-05 | Filter theo category, brand, price, rating | Must |
| CAT-06 | Update inventory sau khi order paid | Should |
| CAT-07 | Import product seed từ dataset/API | Must |

### 7.3 Cart Service

| ID | Requirement | Priority |
|---|---|---|
| CART-01 | Add product to cart | Must |
| CART-02 | Update quantity | Must |
| CART-03 | Remove item | Must |
| CART-04 | Validate product availability qua catalog API | Must |
| CART-05 | Clear cart sau checkout | Should |

### 7.4 Order Service

| ID | Requirement | Priority |
|---|---|---|
| ORD-01 | Create order from cart | Must |
| ORD-02 | Lưu snapshot product name, price tại thời điểm mua | Must |
| ORD-03 | Order status: created, payment_pending, paid, cancelled, shipped, completed | Must |
| ORD-04 | Gọi payment-service để tạo payment | Must |
| ORD-05 | Tạo shipping sau payment success | Must |

### 7.5 Payment Service

| ID | Requirement | Priority |
|---|---|---|
| PAY-01 | Create payment transaction | Must |
| PAY-02 | Simulate payment success/failed | Must |
| PAY-03 | Callback order-service cập nhật trạng thái | Should |
| PAY-04 | Idempotency key cho payment | Should |

### 7.6 Shipping Service

| ID | Requirement | Priority |
|---|---|---|
| SHIP-01 | Tạo shipment từ paid order | Must |
| SHIP-02 | Update status: processing, shipping, delivered | Must |
| SHIP-03 | Customer xem tracking | Should |

### 7.7 Review Service

| ID | Requirement | Priority |
|---|---|---|
| REV-01 | Customer review product đã mua | Should |
| REV-02 | Lưu rating/comment | Should |
| REV-03 | Gọi AI sentiment analysis | Should |
| REV-04 | Catalog hiển thị average rating | Could |

### 7.8 AI Service

| ID | Requirement | Model | Priority |
|---|---|---|---|
| AI-01 | Product classification khi import catalog | XGBoost/LightGBM | Must |
| AI-02 | Sentiment analysis review | BERT/PhoBERT/mBERT | Must |
| AI-03 | Customer segmentation | KMeans over RFM/action features | Must |
| AI-04 | Sequence recommendation | LSTM/GRU | Must |
| AI-05 | Chatbot tư vấn sản phẩm | RAG + LLM + Embedding | Must |
| AI-06 | Hybrid recommendation score | Weighted ranker | Should |

## 8. Non-functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Availability | Local demo ổn định, service fail không kéo sập toàn hệ | Dùng healthcheck và restart policy |
| Latency | Catalog API < 300ms local; AI chat < 5s demo | AI có cache/context limit |
| Scalability | Scale được từng service | Stateless Django services |
| Security | JWT, RBAC, env secrets | Không commit secret |
| Maintainability | Service boundary rõ, code convention thống nhất | Docs + folder structure |
| Observability | Log JSON, request_id, healthcheck | Optional Grafana |
| Data ownership | DB riêng từng service | Cấm foreign key cross-service |
| Reliability | Timeout/retry khi service gọi nhau | HTTP client wrapper |
| Auditability | Order/payment/shipping có status history | Useful for report |

## 9. Core Use Cases

### UC-01 — Customer mua hàng

**Actor:** Customer  
**Precondition:** Customer đã login, catalog có product còn hàng.  
**Main flow:**

1. Customer vào homepage.
2. Frontend gọi `catalog-service` lấy products.
3. Customer filter/search sản phẩm.
4. Customer mở product detail.
5. Frontend gửi event `view_product` sang `ai-service` hoặc `event endpoint`.
6. Customer add product to cart.
7. `cart-service` validate product qua `catalog-service`.
8. Customer checkout.
9. `order-service` lấy cart, tạo order và order items snapshot.
10. `order-service` gọi `payment-service` tạo payment.
11. Payment success.
12. `order-service` cập nhật order = paid.
13. `shipping-service` tạo shipment.
14. Customer xem order tracking.

**Acceptance criteria:** tạo được order, payment, shipment; status thay đổi đúng; cart được clear hoặc marked checked out.

### UC-02 — Admin import product catalog

1. Admin login.
2. Admin vào dashboard import data.
3. Chọn source: DummyJSON/API/CSV.
4. Backend fetch/parse products.
5. AI classify category nếu thiếu category.
6. Catalog lưu product + image URLs.
7. Frontend hiển thị products có ảnh đúng.

**Acceptance criteria:** ít nhất 50 sản phẩm có title, price, category, stock, thumbnail, description.

### UC-03 — Chatbot tư vấn sản phẩm

1. Customer hỏi: “Tôi cần laptop học AI dưới 20 triệu”.
2. AI service normalize query.
3. Retrieve product candidates từ vector store/product embeddings.
4. Rerank theo price/category/rating/stock.
5. LLM sinh câu trả lời có 3–5 sản phẩm, lý do, warning nếu hết hàng.
6. Frontend render product cards ngay trong chat.

**Acceptance criteria:** chatbot trả lời dựa trên catalog thật, có product_id/link, không hallucinate sản phẩm không tồn tại.

### UC-04 — Recommendation list

1. Customer xem product hoặc add to cart.
2. Frontend gọi `/ai/recommendations?user_id=&context_product_id=`.
3. AI service combine score:
   - LSTM sequence score.
   - Category/graph similarity score.
   - Text similarity score.
   - Popularity/rating score.
4. Trả danh sách product IDs.
5. Frontend gọi catalog để hydrate product card.

**Acceptance criteria:** recommendation có product tồn tại, không recommend sản phẩm hết hàng, response < 1s với cache.

### UC-05 — Review sentiment

1. Customer viết review.
2. Review service lưu comment.
3. Review service gọi AI sentiment model.
4. Lưu sentiment label/score.
5. Admin dashboard xem phân tích sentiment theo category/product.

**Acceptance criteria:** mỗi review có sentiment `positive/neutral/negative`, score và timestamp.

## 10. Data Requirements

### 10.1 Product Catalog

Minimum fields:

```json
{
  "id": 122,
  "sku": "TECH-IP-122",
  "name": "iPhone 15 Pro Max",
  "slug": "iphone-15-pro-max",
  "description": "...",
  "category": "smartphones",
  "brand": "Apple",
  "price": 28990000,
  "stock": 20,
  "rating_avg": 4.7,
  "thumbnail_url": "https://...",
  "image_urls": ["https://..."],
  "attributes": {"storage": "256GB", "color": "Natural Titanium"}
}
```

### 10.2 Image Strategy

Production-like strategy:

1. Product source phải có `thumbnail_url` và `image_urls`.
2. Không lưu ảnh dạng base64 trong DB.
3. DB chỉ lưu URL hoặc object key.
4. Với demo nhanh, seed từ API/dataset có image URLs.
5. Với production thật, ảnh nên được mirror về object storage/CDN để tránh link ngoài chết.

Recommended seed source:

```bash
curl "https://dummyjson.com/products/category/smartphones?limit=20"
curl "https://dummyjson.com/products/category/laptops?limit=20"
curl "https://dummyjson.com/products/category/tablets?limit=20"
curl "https://dummyjson.com/products/category/mobile-accessories?limit=20"
```

Lấy `thumbnail` và `images[]` để lưu vào catalog DB.

## 11. Dataset Plan

| Dataset | Mục đích | Service dùng | Model liên quan |
|---|---|---|---|
| DummyJSON Products | Product seed, image URL, category, price, reviews mẫu | catalog-service | Product classification, RAG corpus |
| Amazon Reviews 2023 / UCSD | Product metadata, reviews, item-user links | ai-service/review-service | RAG, recommendation, sentiment |
| RetailRocket Ecommerce Dataset | User behavior: view, addtocart, transaction | ai-service | LSTM/sequence recommendation |
| UCI Online Retail | Transactions, customer/order behavior | order-service/ai-service | KMeans/RFM segmentation |
| Self-built TechShop FAQ | Chính sách bảo hành, đổi trả, shipping, payment | ai-service | RAG chatbot |

Note: FAQ tự xây là hợp lý vì chatbot cần knowledge nội bộ. Nếu dataset được tạo bằng AI, chỉ tính là một bộ; vì vậy nên dùng 4 public datasets + 1 self-built FAQ là an toàn.

## 12. Business Rules

| Rule | Description |
|---|---|
| BR-01 | Chỉ customer mới được checkout |
| BR-02 | Admin/staff không dùng cart mua hàng trong admin UI |
| BR-03 | Product hết hàng không được add to cart |
| BR-04 | Order phải lưu snapshot price, không phụ thuộc giá catalog sau này |
| BR-05 | Payment success mới tạo shipment |
| BR-06 | Review chỉ hợp lệ nếu user đã mua product |
| BR-07 | AI chatbot chỉ được recommend product đang active và còn hàng |
| BR-08 | Không service nào đọc trực tiếp DB của service khác |

## 13. MVP Acceptance Checklist

- [ ] Docker Compose up được gateway, frontend, 7+ services, DBs.
- [ ] Có ít nhất 2 MySQL DB và các DB còn lại PostgreSQL.
- [ ] Homepage hiển thị product cards có ảnh.
- [ ] Product detail có image gallery, price, stock, AI recommendations.
- [ ] Cart/checkout/order/payment/shipping chạy end-to-end.
- [ ] AI chatbot trả lời có product thật từ catalog.
- [ ] Có 5 model/pipeline AI được trình bày và ít nhất 2 model có kết quả thử nghiệm.
- [ ] Có 5 dataset/data source được mô tả rõ.
- [ ] Có sequence/activity/class/data/deployment diagram để đưa vào report.
- [ ] Logs có request_id và healthcheck cho service.

## 14. Risk Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| Quá nhiều service làm không kịp | High | Ưu tiên vertical slice: catalog → cart → order → payment → shipping |
| AI quá nặng | High | Dùng pretrained/simple baseline; train offline; API trả kết quả cached |
| Dataset không khớp schema | Medium | Viết import adapter, normalize về canonical schema |
| Image URL lỗi | Medium | Seed từ source có `thumbnail/images`; có fallback placeholder |
| Cross-service transaction phức tạp | Medium | Dùng saga đơn giản + status transition |
| Debug microservices khó | Medium | Standard log format + healthcheck + gateway routing rõ |

## 15. Recommended Build Order

1. Chuẩn hóa repo và Docker Compose.
2. Làm catalog-service + seed product có ảnh.
3. Làm frontend homepage/product detail.
4. Làm identity-service + JWT.
5. Làm cart/order/payment/shipping full flow.
6. Làm ai-service RAG chatbot đọc catalog.
7. Làm recommendation endpoint đơn giản.
8. Thêm review sentiment + segmentation.
9. Hoàn thiện diagrams/report/screenshots.

