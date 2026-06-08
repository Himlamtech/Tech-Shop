# TechShop Backend Feature Brief

Tài liệu này dùng để bàn giao cho team frontend mới. Mục tiêu là mô tả chính xác những gì backend hiện đang có, những màn hình frontend cần dựng để khai thác backend đó, và các hạng mục còn thiếu nếu muốn hệ thống vận hành chỉnh chu như một sản phẩm thật.

Lưu ý:
- Tài liệu này ưu tiên code thực tế đang có trong repo hơn là mockup cũ.
- Các route public bên ngoài đi qua gateway Nginx, ví dụ `/api/auth/login`, `/api/catalog/products/`, `/api/cart/current`.
- Backend hiện theo kiến trúc microservices: `identity`, `catalog`, `cart`, `order`, `payment`, `shipping`, `review`, `ai-service`.

## 1. Tóm tắt hệ thống

### Vai trò người dùng

| Role | Mô tả | Quyền chính |
|---|---|---|
| Guest | Khách chưa đăng nhập | Xem sản phẩm, xem danh mục, xem review, dùng AI chat giới hạn lượt |
| Customer | Khách mua hàng | Đăng nhập, xem hồ sơ, quản lý giỏ hàng, checkout, xem đơn, hủy đơn hợp lệ, viết review, xem vận chuyển |
| Staff | Nhân viên vận hành | Xem toàn bộ đơn, cập nhật trạng thái giao hàng |
| Admin | Quản trị | Quản lý user, catalog, category, import sản phẩm, xem stats, chạy segmentation AI |

### Các domain backend đang có thật

| Service | Chức năng thực tế đang có |
|---|---|
| Identity | Đăng ký, đăng nhập, refresh token, logout, lấy profile, admin xem danh sách user |
| Catalog | Danh sách sản phẩm, chi tiết sản phẩm, filter/search/sort, category tree, category products, tạo/sửa/xóa mềm sản phẩm, tạo category, import seed sản phẩm, validate sản phẩm bulk, admin stats |
| Cart | Lấy giỏ hiện tại, thêm sản phẩm, sửa số lượng, xóa sản phẩm khỏi giỏ |
| Order | Checkout, danh sách đơn, chi tiết đơn, hủy đơn, admin stats |
| Payment | Tạo payment transaction, giả lập success/failure, lưu lịch sử trạng thái |
| Shipping | Tạo shipment, cập nhật trạng thái shipment, tra cứu shipment theo order |
| Review | Tạo review, lấy danh sách review theo sản phẩm, tính rating trung bình |
| AI | Chatbot RAG, recommendation, sentiment analysis, classification, segmentation, healthcheck |

## 2. Danh sách tính năng frontend cần có

### 2.1 Khối xác thực và tài khoản

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| AUTH-01 | Đăng ký tài khoản | Guest | Có | `POST /api/auth/register` | Trả luôn `access_token`, `refresh_token`, `user` |
| AUTH-02 | Đăng nhập | Guest | Có | `POST /api/auth/login` | Login bằng `email` + `password` |
| AUTH-03 | Refresh phiên đăng nhập | Guest/Customer/Admin/Staff | Có | `POST /api/auth/refresh` | Có token rotation, frontend cần lưu refresh token cẩn thận |
| AUTH-04 | Đăng xuất | User đã đăng nhập | Có | `POST /api/auth/logout` | Logout theo refresh token |
| AUTH-05 | Xem thông tin tài khoản hiện tại | User đã đăng nhập | Có | `GET /api/auth/me` | Dùng để bootstrap session khi app load |
| AUTH-06 | Chặn đăng nhập khi nhập sai quá nhiều | Guest | Có | `POST /api/auth/login` | Backend lock account tạm thời sau nhiều lần sai |
| AUTH-07 | Danh sách user cho admin | Admin | Có | `GET /api/users/` | Nên làm màn user management tối thiểu là list/filter theo role/trạng thái |

### 2.2 Catalog và browsing sản phẩm

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| CAT-01 | Trang danh sách sản phẩm | Guest trở lên | Có | `GET /api/catalog/products/` | Có pagination |
| CAT-02 | Tìm kiếm sản phẩm theo từ khóa | Guest trở lên | Có | `GET /api/catalog/products/?search=` | Search theo `name`, `description`, `brand` |
| CAT-03 | Lọc theo category | Guest trở lên | Có | `GET /api/catalog/products/?category=` | Dùng category `slug` |
| CAT-04 | Lọc theo brand | Guest trở lên | Có | `GET /api/catalog/products/?brand=` | So khớp brand |
| CAT-04A | Lọc theo trạng thái sản phẩm | Admin/Tooling/AI | Có | `GET /api/catalog/products/?status=active|inactive` | Hữu ích cho backoffice, import QA và internal services |
| CAT-05 | Lọc theo khoảng giá | Guest trở lên | Có | `GET /api/catalog/products/?min_price=&max_price=` | |
| CAT-06 | Lọc theo rating tối thiểu | Guest trở lên | Có | `GET /api/catalog/products/?min_rating=` | |
| CAT-07 | Sắp xếp sản phẩm | Guest trở lên | Có | `GET /api/catalog/products/?sort=price_asc|price_desc|rating|newest` | |
| CAT-08 | Xem chi tiết sản phẩm | Guest trở lên | Có | `GET /api/catalog/products/{id}/` | Có ảnh, category lồng, attributes, rating |
| CAT-09 | Xem cây category | Guest trở lên | Có | `GET /api/catalog/categories/` | Trả hierarchy tối đa 3 cấp |
| CAT-10 | Xem sản phẩm theo category | Guest trở lên | Có | `GET /api/catalog/categories/{slug}/products/` | Bao gồm cả subcategory |

### 2.3 Giỏ hàng

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| CART-01 | Xem giỏ hàng hiện tại | Customer | Có | `GET /api/cart/current` | Nếu chưa có cart backend tự tạo cart rỗng |
| CART-02 | Thêm sản phẩm vào giỏ | Customer | Có | `POST /api/cart/items` | Nhận `product_id`, `quantity` |
| CART-03 | Cập nhật số lượng item trong giỏ | Customer | Có | `PATCH /api/cart/items/{item_id}` | Validate stock theo catalog |
| CART-04 | Xóa item khỏi giỏ | Customer | Có | `DELETE /api/cart/items/{item_id}` | Trả cart mới sau xóa |
| CART-05 | Hiển thị subtotal | Customer | Có | `GET /api/cart/current` | Backend trả `subtotal` tính sẵn |

### 2.4 Checkout, đơn hàng, thanh toán, vận chuyển

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| ORD-01 | Checkout từ giỏ hàng | Customer | Có | `POST /api/orders/checkout` | Chỉ cần `shipping_address`; backend tự lấy cart, validate, tạo order, payment, shipment |
| ORD-02 | Xem danh sách đơn hàng của tôi | Customer | Có | `GET /api/orders/` | Customer chỉ thấy đơn của chính mình |
| ORD-03 | Xem chi tiết đơn hàng | Customer | Có | `GET /api/orders/{id}` | Có item snapshot và lịch sử trạng thái |
| ORD-04 | Hủy đơn | Customer | Có | `PATCH /api/orders/{id}/cancel` | Chỉ hủy được ở trạng thái hợp lệ |
| ORD-04A | Hoàn tất đơn sau khi đã giao | Customer/Staff/Admin | Có | `PATCH /api/orders/{id}/complete` | Dùng để đưa order sang `completed`, mở khóa flow review |
| ORD-05 | Xem toàn bộ đơn hàng | Staff/Admin | Có | `GET /api/orders/` | Staff/Admin thấy toàn bộ đơn |
| ORD-06 | Xem thống kê đơn hàng | Admin | Có | `GET /api/orders/stats` | Đi được trực tiếp qua gateway |
| PAY-01 | Payment transaction được tạo khi checkout | Customer | Có | backend gọi nội bộ | Frontend hiện chưa có route list payment riêng, chỉ thấy gián tiếp qua order flow |
| PAY-02 | Mô phỏng thanh toán thành công | Admin/QA/Dev | Có | `POST /api/payments/{payment_id}/simulate-success/` | Hữu ích cho màn test/ops nội bộ |
| PAY-03 | Mô phỏng thanh toán thất bại | Admin/QA/Dev | Có | `POST /api/payments/{payment_id}/simulate-failure/` | Hữu ích cho màn test/ops nội bộ |
| SHIP-01 | Shipment tự tạo sau payment success | Customer | Có | backend gọi nội bộ | Không cần frontend gọi khi checkout bình thường |
| SHIP-02 | Xem tracking theo order | Customer | Có | `GET /api/shipping/shipments/order/{order_id}/` | Dùng cho trang order tracking |
| SHIP-03 | Staff cập nhật trạng thái giao hàng | Staff | Có | `PATCH /api/shipping/shipments/{shipment_id}/status/` | Chỉ cho phép `processing -> shipping -> delivered` |

### 2.5 Review và đánh giá

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| REV-01 | Viết review cho sản phẩm | Customer | Có | `POST /api/reviews/` | Chỉ review được nếu đã mua và đơn ở trạng thái `completed` |
| REV-02 | Mỗi user chỉ review 1 lần / 1 sản phẩm | Customer | Có | `POST /api/reviews/` | Backend chặn duplicate |
| REV-03 | Xem danh sách review theo sản phẩm | Guest trở lên | Có | `GET /api/reviews/product/{product_id}` | Có phân trang thủ công |
| REV-04 | Xem rating trung bình và tổng số review | Guest trở lên | Có | `GET /api/reviews/product/{product_id}` | Trả `average_rating`, `total_reviews` |
| REV-05 | Sentiment analysis cho review | Customer/Admin | Có | nội bộ qua AI service | Frontend có thể hiển thị `sentiment_label`, `sentiment_score`, `sentiment_status` |

### 2.6 AI features

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| AI-01 | Chatbot tư vấn sản phẩm bằng RAG | Guest/Customer | Có | `POST /api/ai/chat` | Guest bị giới hạn 10 lượt mỗi session; user đăng nhập không bị giới hạn |
| AI-02 | Chat có context sản phẩm hiện tại / cart | Guest/Customer | Có | `POST /api/ai/chat` | Có `context.current_product_id`, `context.cart_product_ids` |
| AI-03 | Recommendation theo user và context sản phẩm | Customer | Có | `GET /api/ai/recommendations?user_id=...&context_product_id=...` | Trả danh sách product IDs + lý do/score trong service response |
| AI-04 | Recommendation có lọc budget | Customer | Có | `GET /api/ai/recommendations?min_price=&max_price=` | |
| AI-05 | Sentiment analysis | Nội bộ / admin tool | Có | `POST /api/ai/sentiment` | Dùng chủ yếu bởi review-service |
| AI-06 | Product classification | Admin/tooling | Có | `POST /api/ai/classification` | Phù hợp màn import/catalog moderation |
| AI-07 | Chạy customer segmentation | Admin | Có | `POST /api/ai/segmentation/run` | Dùng cho admin analytics |

### 2.7 Admin backoffice

| Mã | Tính năng | Role | Backend support | API chính | Ghi chú cho frontend |
|---|---|---|---|---|---|
| ADM-01 | Dashboard thống kê catalog | Admin | Có | `GET /api/catalog/admin/stats` | Tổng sản phẩm, active, categories, count theo category |
| ADM-02 | Dashboard thống kê order | Admin | Có | `GET /api/orders/stats` | Tổng đơn, đơn theo trạng thái, tổng doanh thu paid/completed |
| ADM-03 | Tạo sản phẩm | Admin | Có | `POST /api/catalog/products/` | Có `image_urls`, `attributes` |
| ADM-04 | Sửa sản phẩm | Admin | Có | `PATCH /api/catalog/products/{id}/` | Có thể sửa giá, stock, brand, status, attributes |
| ADM-05 | Xóa mềm sản phẩm | Admin | Có | `DELETE /api/catalog/products/{id}/` | Chỉ set `status=inactive` |
| ADM-06 | Tạo category | Admin | Có | `POST /api/catalog/categories/` | Tối đa 3 cấp |
| ADM-07 | Import seed sản phẩm | Admin | Có | `POST /api/catalog/products/import/` | Hiện import từ DummyJSON |
| ADM-08 | Xem danh sách user | Admin | Có | `GET /api/users/users` hoặc `GET /api/users` | Nên có bảng user + pagination |
| ADM-09 | Chạy segmentation job | Admin | Có | `POST /api/ai/segmentation/run` | Nên có màn analytics riêng |
| ADM-10 | Màn ops để test payment/shipping flow | Admin/Staff | Nên có | Payment + Shipping APIs | Rất hữu ích cho demo và vận hành giả lập |

## 3. Các luồng người dùng cần dựng lại

### 3.1 Guest storefront

1. Homepage hoặc product listing.
2. Search, filter, sort.
3. Product detail.
4. Category browsing.
5. Review list của sản phẩm.
6. AI chatbot cho tư vấn trước mua.
7. CTA chuyển sang đăng ký/đăng nhập trước khi thêm vào giỏ.

### 3.2 Customer commerce flow

1. Đăng ký hoặc đăng nhập.
2. Duyệt catalog.
3. Add to cart.
4. Xem cart và chỉnh quantity.
5. Checkout với địa chỉ giao hàng.
6. Xem order list.
7. Xem order detail.
8. Theo dõi shipment.
9. Hủy đơn nếu còn hợp lệ.
10. Hoàn tất đơn sau khi giao xong.
11. Review sản phẩm sau khi đơn hoàn tất.

### 3.3 Staff/Admin operations

1. Xem toàn bộ orders.
2. Xem order detail.
3. Cập nhật shipment status.
4. Quản lý catalog và category.
5. Import seed products.
6. Xem stats catalog và order.
7. Quản lý user ở mức tối thiểu.
8. Chạy AI segmentation.
9. Dùng màn mô phỏng payment/shipping cho demo.

## 4. Mô tả chi tiết các màn frontend nên có

| Nhóm màn | Màn hình nên có | Mức độ |
|---|---|---|
| Public storefront | Home, product listing, product detail, category page, search result page | Bắt buộc |
| Auth | Register, login, session bootstrap, logout | Bắt buộc |
| Customer | Cart page, checkout page, order list, order detail, shipment tracking, review form | Bắt buộc |
| AI | Chat widget/page, recommendation rail ở listing/detail/cart | Bắt buộc |
| Admin | Dashboard, product management, category management, import products, user list, order monitoring | Bắt buộc |
| Staff ops | Shipment management / order operations | Nên có |
| QA/ops | Payment simulation panel, service health panel | Nên có |

## 5. Những gì backend đang làm thật mà frontend phải hiểu đúng

### Authentication

- Hệ thống dùng JWT access token và refresh token.
- `register` và `login` đều trả token ngay.
- Có cơ chế refresh token rotation.
- Có lock account tạm thời nếu login sai nhiều lần.

### Cart

- Cart gắn với `user_id`, không phải guest cart.
- Add item sẽ validate sản phẩm qua catalog service.
- Nếu add lại cùng một product, backend update quantity chứ không tạo thêm dòng mới.
- Sau checkout thành công, cart hiện được clear tự động.

### Order

- Checkout là orchestration thật, không phải tạo order mock.
- Order giữ snapshot tên, SKU, ảnh, giá tại thời điểm mua.
- Có status history đầy đủ.
- Payment success sẽ tạo shipment và đẩy order sang `shipping`.
- Có endpoint hoàn tất đơn để chuyển `shipping -> completed`.
- Trạng thái chính: `created`, `payment_pending`, `paid`, `payment_failed`, `shipping`, `completed`, `cancelled`.

### Payment

- Payment hiện là giả lập, không tích hợp cổng thanh toán thật.
- Có idempotency key để tránh tạo trùng transaction.

### Shipping

- Shipment tạo sau payment success.
- Trạng thái chỉ đi xuôi: `processing -> shipping -> delivered`.

### Review

- Review chỉ cho phép nếu customer đã mua sản phẩm đó trong order `completed`.
- Review sẽ gọi AI sentiment, nếu AI fail thì review vẫn được tạo với `sentiment_status = pending`.

### AI

- Chatbot có session-limit với guest.
- Recommendation cần `user_id` và có thể tận dụng context sản phẩm đang xem.
- Segmentation là admin-only.

## 6. Những điểm còn thiếu nếu muốn frontend làm “hệ thống thật” hơn

Đây là phần quan trọng để trao đổi với team frontend và cũng là danh sách nâng cấp backend nên cân nhắc tiếp theo.

| Nhóm | Hiện trạng | Khuyến nghị để hệ thống chỉnh chu hơn |
|---|---|---|
| Guest cart / wishlist | Chưa có guest cart thật, chưa có wishlist backend | Nếu muốn trải nghiệm thương mại điện tử tốt hơn, nên bổ sung guest cart, merge cart sau login, wishlist/favorites thật |
| User profile | Mới có `me`, chưa có cập nhật profile, đổi mật khẩu, địa chỉ sổ địa chỉ | Nên bổ sung profile management đầy đủ |
| Admin user management | Mới có list user | Nên thêm activate/deactivate, đổi role, xem chi tiết user |
| Payment visibility | Chưa có endpoint public/admin để list/get payment transaction | Nên thêm để frontend ops/admin theo dõi payment tốt hơn |
| Shipping ownership | Ownership check hiện còn phụ thuộc context header/gateway | Nên siết chặt thêm ở backend nếu đưa vào production-like demo |
| Product management | Chưa có list admin riêng với filter sâu cho backoffice | Nên làm admin product table với filter stock/status/brand/category |
| Review moderation | Chưa có admin review moderation | Nên có list/hide/delete review nếu muốn vận hành thật |
| Search experience | Search hiện là text search cơ bản | Có thể nâng cấp autocomplete, suggest, recent searches |
| Checkout data | Mới có `shipping_address` dạng text | Nên tách recipient name, phone, ward/district/city, notes |
| Coupons / promotions | Chưa có | Có thể thêm nếu cần trải nghiệm thương mại điện tử hoàn chỉnh |
| Inventory reservation | Chưa có reserve stock khi checkout/payment pending | Hiện đủ cho demo, nhưng chưa production-like |
| Notifications | Chưa có email/SMS/in-app notifications | Nên thêm nếu cần hành trình hoàn chỉnh |
| Analytics dashboard | Mới có stats cơ bản | Nên có dashboard doanh thu, top products, review trends, segment insights |

## 7. Đề xuất scope frontend mới

### Phase 1: Bắt buộc để chạy trơn tru

| Nhóm | Màn cần làm |
|---|---|
| Public | Home, product list, product detail, category, search/filter |
| Auth | Register, login, logout, bootstrap session |
| Customer | Cart, checkout, order list/detail, shipment tracking |
| Review | Review list + review form |
| AI | Chatbot + recommendation blocks |
| Admin | Dashboard, product CRUD, category CRUD, import products, user list, order overview |

### Phase 2: Nâng chất lượng demo và vận hành

| Nhóm | Màn cần làm |
|---|---|
| Staff ops | Shipment status management |
| QA/Ops | Payment simulation panel |
| AI admin | Segmentation dashboard, classification helper |
| UX polish | Empty states, unauthorized states, loading/error handling, responsive mobile |

## 8. Danh sách API công khai team frontend sẽ dùng nhiều nhất

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Catalog

- `GET /api/catalog/products/`
- `GET /api/catalog/products/{id}/`
- `GET /api/catalog/categories/`
- `GET /api/catalog/categories/{slug}/products/`
- `POST /api/catalog/products/` (admin)
- `PATCH /api/catalog/products/{id}/` (admin)
- `DELETE /api/catalog/products/{id}/` (admin)
- `POST /api/catalog/categories/` (admin)
- `POST /api/catalog/products/import/` (admin)
- `GET /api/catalog/admin/stats` (admin)

### Cart

- `GET /api/cart/current`
- `POST /api/cart/items`
- `PATCH /api/cart/items/{item_id}`
- `DELETE /api/cart/items/{item_id}`

### Orders

- `POST /api/orders/checkout`
- `GET /api/orders/`
- `GET /api/orders/{id}`
- `PATCH /api/orders/{id}/cancel`
- `PATCH /api/orders/{id}/complete`
- `GET /api/orders/stats` (admin)

### Shipping

- `GET /api/shipping/shipments/order/{order_id}/`
- `PATCH /api/shipping/shipments/{shipment_id}/status/` (staff)

### Reviews

- `POST /api/reviews/`
- `GET /api/reviews/product/{product_id}`

### AI

- `POST /api/ai/chat`
- `GET /api/ai/recommendations`
- `POST /api/ai/segmentation/run` (admin)

## 9. Kết luận ngắn cho team frontend mới

Backend hiện tại không còn ở mức mock đơn giản nữa. Nó đã có đủ xương sống để dựng một website thương mại điện tử có auth, catalog, cart, checkout, order lifecycle, shipping, review và AI features. Team frontend mới nên xem đây là một hệ thống commerce thật ở mức demo-production, không phải landing page.

Nếu cần ưu tiên triển khai nhanh, hãy build lại frontend theo 3 cụm chính:

1. Storefront cho guest/customer.
2. Customer self-service cho cart, checkout, orders, reviews.
3. Admin/staff backoffice cho catalog, orders, shipping và AI analytics.
