# Requirements Document

## Introduction

TechShop is a full-featured e-commerce platform for technology products built using Django microservices architecture with AI integration. The system comprises 8 backend services, an Nginx API gateway, and a React/Vite frontend. It supports the complete customer purchase journey (browse → search → product detail → AI chat → add to cart → checkout → payment → shipping) along with admin management capabilities and 5 AI/ML models for intelligent product advisory, recommendations, sentiment analysis, customer segmentation, and product classification.

## Glossary

- **Platform**: The complete TechShop e-commerce system including all services, gateway, frontend, and databases
- **Identity_Service**: The authentication and authorization service managing users, JWT tokens, and role-based access control using MySQL
- **Catalog_Service**: The service managing products, categories, inventory, and product images using PostgreSQL
- **Cart_Service**: The service managing shopping carts and cart items using PostgreSQL
- **Order_Service**: The service managing orders, order items, checkout workflow, and order lifecycle using PostgreSQL
- **Payment_Service**: The service simulating payment transactions using MySQL
- **Shipping_Service**: The service managing shipment creation and tracking using PostgreSQL
- **Review_Service**: The service managing product reviews and ratings using PostgreSQL
- **AI_Service**: The service hosting ML models, RAG chatbot, and recommendation engine using PostgreSQL with pgvector
- **Gateway**: The Nginx reverse proxy routing external requests to internal services
- **Frontend**: The React/Vite web application providing the user interface
- **Customer**: A registered user with the customer role who can browse, purchase, and review products
- **Admin**: A registered user with the admin role who can manage catalog, users, datasets, and AI models
- **Staff**: A registered user with the staff role who can manage orders and shipping
- **Guest**: An unauthenticated visitor who can browse the catalog and use limited chatbot features
- **JWT**: JSON Web Token used for stateless authentication across services
- **RBAC**: Role-Based Access Control enforcing permissions per user role
- **RAG**: Retrieval-Augmented Generation combining vector search with LLM for grounded answers
- **RFM**: Recency, Frequency, Monetary value analysis for customer segmentation
- **Price_Snapshot**: A frozen copy of product price and details stored at order creation time
- **Healthcheck_Endpoint**: An HTTP endpoint returning service liveness and readiness status
- **Service_Client**: The HTTP wrapper used for inter-service communication with timeout and header propagation

## Requirements

### Requirement 1: User Registration

**User Story:** As a guest, I want to register an account, so that I can access customer features like cart and checkout.

#### Acceptance Criteria

1. WHEN a guest submits registration data with a valid email address (maximum 254 characters, conforming to standard email format) and a password between 8 and 128 characters, THE Identity_Service SHALL create a new user account with the customer role and return access and refresh JWT tokens
2. IF a guest submits registration data with an email that already exists, THEN THE Identity_Service SHALL return a VALIDATION_ERROR response without creating a duplicate account
3. THE Identity_Service SHALL hash passwords using Django built-in hashers before storing them in the database
4. IF a guest submits registration data with a password shorter than 8 characters or longer than 128 characters, THEN THE Identity_Service SHALL return a VALIDATION_ERROR response indicating the password length requirement
5. IF a guest submits registration data with an email that does not conform to valid email format, THEN THE Identity_Service SHALL return a VALIDATION_ERROR response indicating the email format requirement

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in and receive tokens, so that I can access protected resources across all services.

#### Acceptance Criteria

1. WHEN a user submits valid email and password credentials, THE Identity_Service SHALL return an access token with an expiration time of 15 minutes and a refresh token with an expiration time of 7 days
2. WHEN a user submits invalid credentials, THE Identity_Service SHALL return an UNAUTHORIZED error response without revealing whether the email or password was incorrect
3. WHEN a user submits a valid refresh token, THE Identity_Service SHALL issue a new access token and a new refresh token, and invalidate the previously used refresh token
4. WHEN a user submits an expired or invalid refresh token, THE Identity_Service SHALL return an UNAUTHORIZED error response
5. THE Identity_Service SHALL include user_id, role, issuer, and exp (expiration timestamp) claims in the JWT access token payload
6. IF a user submits incorrect credentials 5 times consecutively within a 15-minute window, THEN THE Identity_Service SHALL reject further login attempts from that account for 15 minutes and return an error response indicating the account is temporarily locked

### Requirement 3: Role-Based Access Control

**User Story:** As a system administrator, I want to enforce role-based permissions, so that users can only access resources appropriate to their role.

#### Acceptance Criteria

1. THE Platform SHALL support four user roles with decreasing privilege: admin, staff, customer, and guest (unauthenticated)
2. WHEN a request with a customer role token attempts to access an endpoint restricted to admin or staff roles, THE Gateway SHALL return a 403 FORBIDDEN error response with an error code indicating insufficient permissions
3. WHEN a request with a staff role token attempts to access a resource owned by a specific customer (identified by user_id in the resource path or payload) where the requesting user_id does not match the resource owner, THE Platform SHALL return a 403 FORBIDDEN error response
4. IF a request to a protected endpoint contains no token, an expired token, a malformed token, or a token with an invalid signature, THEN THE Platform SHALL return a 401 UNAUTHORIZED error response
5. THE Identity_Service SHALL issue JWT tokens signed with a private key, and each downstream service SHALL independently validate tokens using the corresponding shared public key without calling back to the Identity_Service
6. THE Platform SHALL allow unauthenticated (guest) access to public endpoints including product listing, product detail, and category browsing without requiring a JWT token
7. WHEN a user is assigned a role, THE Identity_Service SHALL include the role claim in the issued JWT token, and each service SHALL use this role claim to enforce endpoint-level access control

### Requirement 4: Product Catalog Management

**User Story:** As an admin, I want to manage the product catalog, so that customers can browse and purchase available technology products.

#### Acceptance Criteria

1. WHEN an admin submits a product creation request with name (1–255 characters), description (1–5000 characters), price (0.01 to 999,999,999.99), stock (0 to 999,999), category, brand (1–100 characters), and at least one image URL, THE Catalog_Service SHALL create the product and return the product details including the generated product ID
2. IF an admin submits a product creation request with any missing required field or a value outside its valid range, THEN THE Catalog_Service SHALL reject the request and return an error response indicating which fields failed validation
3. WHEN an admin updates a product's price or stock with values within valid ranges, THE Catalog_Service SHALL persist the changes and return the updated product with the new values reflected
4. WHEN an admin deletes a product, THE Catalog_Service SHALL mark the product as inactive rather than permanently removing it from the database
5. THE Catalog_Service SHALL store product images as URL references and support up to 20 images per product with exactly one image designated as primary
6. WHEN an admin triggers a product import from DummyJSON API, THE Catalog_Service SHALL fetch products, map DummyJSON fields (title to name, thumbnail to primary image, images array to additional images, price, stock, category, brand, description) and store them in the catalog database
7. IF the DummyJSON API is unreachable or returns an error during product import, THEN THE Catalog_Service SHALL abort the import and return an error response indicating the failure reason
8. IF a product being imported has the same SKU as an existing product, THEN THE Catalog_Service SHALL update the existing product's fields rather than creating a duplicate entry

### Requirement 5: Product Browsing and Search

**User Story:** As a customer, I want to browse, search, and filter products, so that I can find technology products that match my needs.

#### Acceptance Criteria

1. WHEN a user requests the product list, THE Catalog_Service SHALL return a paginated list of active products with name, price, rating, stock status, thumbnail URL, and category, using a default page size of 20 items and a maximum page size of 50 items
2. WHEN a user submits a keyword search query of at least 2 characters, THE Catalog_Service SHALL return products where the keyword partially matches the name, description, or brand fields, ranked by relevance
3. WHEN a user applies filters for category, brand, price range, or minimum rating, THE Catalog_Service SHALL return only products matching all specified filter criteria
4. WHEN a user requests sorting by price, rating, or newest, THE Catalog_Service SHALL return products ordered according to the specified sort parameter and direction (ascending or descending), defaulting to newest-first when no sort parameter is provided
5. WHEN a user requests a product detail by ID, THE Catalog_Service SHALL return the complete product information including all images, attributes, description, average rating, and review count
6. IF a user requests a product detail by an ID that does not exist or belongs to an inactive product, THEN THE Catalog_Service SHALL return an error response indicating the product was not found
7. WHEN a search or filter request matches no products, THE Catalog_Service SHALL return an empty list with a total count of zero and valid pagination metadata
8. THE Catalog_Service SHALL respond to product list and detail requests within 300 milliseconds under local deployment conditions

### Requirement 6: Category Management

**User Story:** As an admin, I want to organize products into categories, so that customers can navigate the catalog by product type.

#### Acceptance Criteria

1. THE Catalog_Service SHALL support a hierarchical category structure with parent-child relationships up to 3 levels deep
2. WHEN an admin creates a category with a name (1 to 100 characters) and optional parent category, THE Catalog_Service SHALL create the category and generate a slug containing only lowercase letters, digits, and hyphens derived from the category name
3. IF an admin creates a category with a name that already exists at the same hierarchy level, THEN THE Catalog_Service SHALL reject the request with an error message indicating a duplicate category name
4. IF an admin creates a category referencing a parent_id that does not exist, THEN THE Catalog_Service SHALL reject the request with an error message indicating an invalid parent category
5. WHEN a user requests the category list, THE Catalog_Service SHALL return all active categories including each category's id, name, slug, parent_id, and children list
6. WHEN a user requests products by category, THE Catalog_Service SHALL return all active products belonging to that category and its subcategories, paginated with a default page size of 20 items

### Requirement 7: Shopping Cart Management

**User Story:** As a customer, I want to manage items in my shopping cart, so that I can prepare my purchase before checkout.

#### Acceptance Criteria

1. WHEN a customer adds a product to the cart, THE Cart_Service SHALL call the Catalog_Service to verify the product is active and has stock greater than or equal to the requested quantity, and add the item to the cart with the specified quantity (default 1 if not provided)
2. IF the Catalog_Service reports the product is out of stock or inactive when a customer attempts to add it, THEN THE Cart_Service SHALL return a PRODUCT_OUT_OF_STOCK error response without modifying the cart
3. IF the Catalog_Service is unreachable or returns a timeout (within 3 seconds), THEN THE Cart_Service SHALL return a SERVICE_UNAVAILABLE error response without modifying the cart
4. WHEN a customer updates the quantity of a cart item, THE Cart_Service SHALL validate the requested quantity is between 1 and 99 inclusive and does not exceed available stock, and update the item quantity
5. IF the requested quantity exceeds available stock or is less than 1 when updating a cart item, THEN THE Cart_Service SHALL return a VALIDATION_ERROR response indicating the allowed range and current available stock, without modifying the cart
6. WHEN a customer removes an item from the cart, THE Cart_Service SHALL delete the cart item and return the updated cart
7. WHEN a customer requests their current cart, THE Cart_Service SHALL return all cart items including product_id, product name, product thumbnail URL, unit price, quantity, line total (unit price × quantity), and the cart subtotal (sum of all line totals)
8. THE Cart_Service SHALL associate each cart with exactly one authenticated customer using the user_id from the JWT token

### Requirement 8: Checkout and Order Creation

**User Story:** As a customer, I want to checkout my cart, so that I can place an order and proceed to payment.

#### Acceptance Criteria

1. WHEN a customer initiates checkout with a shipping address, THE Order_Service SHALL retrieve the current cart from Cart_Service within 5 seconds, validate all items against Catalog_Service (confirming each item is active, in-stock with sufficient quantity), and create an order with order items
2. THE Order_Service SHALL store a price snapshot for each order item including product name, SKU, unit price, image URL, and quantity at the time of order creation
3. IF a customer with an empty cart initiates checkout, THEN THE Order_Service SHALL return a VALIDATION_ERROR response without creating an order
4. IF a non-customer role user attempts checkout, THEN THE Order_Service SHALL return a FORBIDDEN error response
5. WHEN an order is created successfully, THE Order_Service SHALL set the initial order status to payment_pending and create a status history entry recording the transition to payment_pending
6. THE Order_Service SHALL calculate order totals where subtotal equals the sum of all order item line totals (unit_price multiplied by quantity), total_amount equals subtotal plus shipping_fee minus discount_amount, and each value is stored as a decimal with two decimal places
7. IF any cart item fails validation against Catalog_Service (product inactive, insufficient stock, or product not found), THEN THE Order_Service SHALL return a VALIDATION_ERROR response indicating which items failed validation, without creating an order
8. IF Cart_Service or Catalog_Service is unavailable or does not respond within 5 seconds, THEN THE Order_Service SHALL return a SERVICE_UNAVAILABLE error response without creating an order

### Requirement 9: Payment Simulation

**User Story:** As a customer, I want to complete payment for my order, so that my purchase can be processed and shipped.

#### Acceptance Criteria

1. WHEN the Order_Service creates a payment request containing an order_id, total amount, and idempotency key, THE Payment_Service SHALL create a payment transaction record with status "pending" linked to the order by order_id
2. WHEN a payment simulation is triggered with a success outcome, THE Payment_Service SHALL update the transaction status from "pending" to "success" and return the updated status to the Order_Service via synchronous REST response
3. WHEN a payment simulation is triggered with a failed outcome, THE Payment_Service SHALL update the transaction status from "pending" to "failed" and return the updated status to the Order_Service via synchronous REST response
4. WHEN a payment succeeds, THE Order_Service SHALL update the order status to "paid" and create a status history entry recording the transition from the previous status to "paid"
5. WHEN a payment fails, THE Order_Service SHALL update the order status to "payment_failed" and create a status history entry recording the transition from the previous status to "payment_failed"
6. IF the Payment_Service receives a payment request with an idempotency key that matches an existing transaction for the same order, THEN THE Payment_Service SHALL return the existing transaction result without creating a duplicate transaction
7. IF the Payment_Service receives a payment request with a missing or empty order_id, total amount, or idempotency key, THEN THE Payment_Service SHALL reject the request with an error response indicating the missing fields
8. WHEN a payment transaction is created, THE Payment_Service SHALL record a payment status history entry for each status transition from "pending" to "success" or from "pending" to "failed"

### Requirement 10: Shipment Management

**User Story:** As a customer, I want to track my order shipment, so that I know when my purchase will arrive.

#### Acceptance Criteria

1. WHEN an order payment succeeds, THE Order_Service SHALL request shipment creation from the Shipping_Service with the order ID and shipping address
2. WHEN the Shipping_Service receives a shipment creation request, THE Shipping_Service SHALL create a shipment record with a unique tracking code of 8 to 20 alphanumeric characters and an initial status of "processing"
3. WHEN a staff member updates a shipment status, THE Shipping_Service SHALL transition the status only through the allowed forward transitions: "processing" to "shipping", and "shipping" to "delivered"
4. WHEN a customer requests shipment tracking for their order, THE Shipping_Service SHALL return the current shipment status, tracking code, and status history where each history entry includes the previous status, new status, and timestamp of the transition
5. IF a shipment status update request contains an invalid status transition, THEN THE Shipping_Service SHALL reject the request with a VALIDATION_ERROR response indicating the attempted transition is not allowed, and SHALL NOT modify the shipment record
6. IF the Shipping_Service is unavailable or fails to respond within 5 seconds when the Order_Service requests shipment creation, THEN THE Order_Service SHALL retain the order in "paid" status and retry shipment creation up to 3 times with a 2-second interval between attempts
7. IF a customer requests shipment tracking for an order that does not belong to them, THEN THE Shipping_Service SHALL return a FORBIDDEN error response and SHALL NOT disclose shipment details

### Requirement 11: Product Reviews

**User Story:** As a customer, I want to review products I have purchased, so that I can share my experience with other shoppers.

#### Acceptance Criteria

1. WHEN a customer submits a review for a product they have purchased, THE Review_Service SHALL store the review with an integer rating between 1 and 5 inclusive, comment text of 1 to 2000 characters, and a UTC timestamp
2. IF a customer attempts to submit a review for a product they have not purchased (no completed order containing that product exists), THEN THE Review_Service SHALL reject the request with a FORBIDDEN error response indicating the purchase requirement
3. IF a customer attempts to submit a second review for the same product, THEN THE Review_Service SHALL reject the request with a CONFLICT error response indicating that only one review per customer per product is permitted
4. WHEN a review is submitted, THE Review_Service SHALL call the AI_Service sentiment analysis endpoint and store the returned sentiment label and score alongside the review
5. IF the AI_Service sentiment analysis endpoint is unavailable or returns an error, THEN THE Review_Service SHALL store the review without sentiment data and mark the sentiment status as pending
6. WHEN a user requests reviews for a product, THE Review_Service SHALL return a paginated list of reviews sorted by most recent first, with a default page size of 10 and a maximum page size of 50, including rating, comment text, sentiment label, and submission timestamp for each review
7. THE Review_Service SHALL calculate and expose the average rating rounded to one decimal place and the total review count for each product, updated each time a review is created or deleted

### Requirement 12: AI RAG Chatbot

**User Story:** As a customer, I want to ask an AI assistant about products, so that I can get personalized product advice based on the current catalog and store policies.

#### Acceptance Criteria

1. WHEN a user sends a product advisory message of 1 to 1000 characters, THE AI_Service SHALL retrieve the top 5 most relevant products and policy documents from the vector store by cosine similarity, generate a grounded answer using an LLM, and return the answer with referenced product IDs and document sources
2. THE AI_Service SHALL only recommend products that are active and currently in stock in the catalog by validating referenced product IDs against the Catalog_Service before including them in the response
3. IF no retrieved document exceeds a cosine similarity score of 0.5 for the user query, THEN THE AI_Service SHALL return an AI_NO_CONTEXT_FOUND error response rather than generating an ungrounded answer
4. THE AI_Service SHALL respond to chat requests within 5 seconds under local deployment conditions
5. WHEN the AI_Service generates a response, THE AI_Service SHALL include a grounded flag (true or false) and a hallucination risk level (low, medium, or high) in the response metadata
6. THE AI_Service SHALL ingest product catalog data and FAQ/policy documents as embeddings stored in PostgreSQL using pgvector
7. WHEN a user sends a message that is empty or exceeds 1000 characters, THE AI_Service SHALL return a VALIDATION_ERROR response without invoking the retrieval pipeline
8. THE AI_Service SHALL allow both authenticated customers and guest users to submit chat queries, where guest users are limited to 10 queries per session

### Requirement 13: AI Product Recommendations

**User Story:** As a customer, I want to receive personalized product recommendations, so that I can discover relevant products based on my browsing behavior and preferences.

#### Acceptance Criteria

1. WHEN a user requests recommendations with a user_id and optional context product_id, THE AI_Service SHALL return a ranked list of at most 10 recommended product IDs, each with a score between 0.0 and 1.0 and a recommendation reason label
2. THE AI_Service SHALL compute a hybrid recommendation score using the following weights: 0.30 sequence model score, 0.25 content similarity score, 0.20 collaborative behavior score, 0.15 popularity rating score, and 0.10 business rule score
3. THE AI_Service SHALL exclude inactive products and out-of-stock products from recommendation results
4. THE AI_Service SHALL exclude products already in the customer's cart from recommendations unless the product belongs to a different category than all cart items and is classified as an accessory or add-on in the catalog attributes
5. WHEN a user provides a budget constraint in the recommendation context, THE AI_Service SHALL filter recommendations to products whose price falls within the specified minimum and maximum price range
6. IF the user has fewer than 3 recorded product interactions, THEN THE AI_Service SHALL return recommendations based on popularity rating score and business rule score only, without sequence model or collaborative behavior scoring
7. THE AI_Service SHALL respond to recommendation requests within 1 second under local deployment conditions
8. IF the AI_Service cannot compute recommendations due to model unavailability or internal error, THEN THE AI_Service SHALL return a SERVICE_UNAVAILABLE error response with an empty recommendations list

### Requirement 14: AI Sentiment Analysis

**User Story:** As an admin, I want automated sentiment analysis of product reviews, so that I can monitor customer satisfaction and product quality.

#### Acceptance Criteria

1. WHEN the Review_Service submits review text to the sentiment endpoint, THE AI_Service SHALL return a sentiment label (positive, neutral, or negative) and a confidence score between 0.0 and 1.0
2. THE AI_Service SHALL use a BERT-family model (BERT, PhoBERT, or mBERT) for sentiment classification
3. THE AI_Service SHALL include the model version identifier in every sentiment analysis response
4. IF the AI_Service receives review text that is empty, contains only whitespace, or exceeds 5000 characters, THEN THE AI_Service SHALL return a VALIDATION_ERROR response indicating the specific validation failure
5. THE AI_Service SHALL complete sentiment analysis and return a response within 3 seconds of receiving the request

### Requirement 15: AI Customer Segmentation

**User Story:** As an admin, I want to segment customers based on purchasing behavior, so that I can understand customer groups and tailor marketing strategies.

#### Acceptance Criteria

1. WHEN an admin triggers customer segmentation, THE AI_Service SHALL compute RFM features (Recency in days since last purchase, Frequency as total number of orders, Monetary as total spend amount) from transaction data and assign each customer to a segment using KMeans clustering with 3 to 8 clusters determined by silhouette score optimization
2. THE AI_Service SHALL return segment assignments with segment ID, segment name (descriptive label such as "High-Value Loyal", "At-Risk", "New Customer"), and the RFM feature values used for clustering
3. THE AI_Service SHALL store segmentation results for use in recommendation scoring and admin dashboard display
4. IF the transaction dataset contains fewer than 30 customers with at least one completed order, THEN THE AI_Service SHALL return a VALIDATION_ERROR response indicating insufficient data for meaningful segmentation
5. WHEN segmentation completes successfully, THE AI_Service SHALL return the total number of customers segmented, the number of clusters created, and the silhouette score of the clustering result

### Requirement 16: AI Product Classification

**User Story:** As an admin, I want automatic product classification during catalog import, so that products are assigned to correct categories without manual effort.

#### Acceptance Criteria

1. WHEN a product is imported without a category assignment, THE AI_Service SHALL classify the product into an existing category in the Catalog_Service using an XGBoost or LightGBM model based on product title, description, brand, and attributes
2. THE AI_Service SHALL return the predicted category label, the corresponding category ID from the Catalog_Service, and a confidence score between 0.0 and 1.0 for each classification
3. WHEN the classification confidence score is at or above 0.5, THE AI_Service SHALL auto-assign the predicted category to the product
4. WHEN the classification confidence score is below 0.5, THE AI_Service SHALL set the product classification status to review_needed and include the predicted category as a suggestion without assigning it to the product
5. IF the classification model is unavailable or the product title and description are both empty, THEN THE AI_Service SHALL return a VALIDATION_ERROR response indicating the classification could not be performed and set the product classification status to review_needed

### Requirement 17: AI Sequence Recommendation

**User Story:** As a customer, I want recommendations based on my browsing sequence, so that I can discover products that naturally follow my shopping pattern.

#### Acceptance Criteria

1. WHEN the AI_Service receives a user's product interaction sequence containing at least 2 product interactions, THE AI_Service SHALL predict candidate next products using an LSTM or GRU sequence model and return at most 10 candidate product IDs ranked by predicted probability score
2. THE AI_Service SHALL train the sequence model on user behavior data including view, add-to-cart, and purchase events from the RetailRocket dataset
3. THE AI_Service SHALL exclude inactive products and out-of-stock products from the sequence recommendation results
4. IF the AI_Service receives a product interaction sequence containing fewer than 2 interactions, THEN THE AI_Service SHALL return a VALIDATION_ERROR response indicating insufficient interaction history
5. THE AI_Service SHALL return each candidate product with its predicted probability score as a decimal value between 0.0 and 1.0

### Requirement 18: Inter-Service Communication

**User Story:** As a developer, I want reliable inter-service communication, so that services can coordinate workflows without tight coupling.

#### Acceptance Criteria

1. THE Platform SHALL use a Service_Client wrapper for all inter-service HTTP calls with a default timeout of 3 seconds
2. THE Service_Client SHALL propagate Authorization and X-Request-ID headers on every outgoing request
3. IF a downstream service returns an HTTP 5xx response, refuses the connection, or does not respond within the configured timeout, THEN THE Service_Client SHALL return a SERVICE_UNAVAILABLE error response to the caller using the standard error envelope (success: false, error.code: "SERVICE_UNAVAILABLE")
4. THE Platform SHALL enforce that no service directly accesses another service's database; all cross-service data access SHALL occur through REST API calls
5. THE Service_Client SHALL log the target service name, request path, response status code, and duration in milliseconds for every inter-service call
6. IF a downstream service returns an HTTP 4xx error response, THEN THE Service_Client SHALL propagate the downstream error code and message to the caller without converting it to SERVICE_UNAVAILABLE
7. THE Service_Client SHALL not retry failed requests automatically; the calling service SHALL be responsible for implementing retry logic if needed for its specific workflow

### Requirement 19: API Response Format

**User Story:** As a frontend developer, I want consistent API responses, so that I can handle success and error cases uniformly across all services.

#### Acceptance Criteria

1. THE Platform SHALL wrap all successful API responses in an envelope containing success flag set to true, a data field, and a meta field with request_id
2. THE Platform SHALL wrap all error API responses in an envelope containing success flag set to false, an error object with code and message, and a meta field with request_id
3. THE Platform SHALL return paginated responses with page, page_size, total, and total_pages metadata for all list endpoints, with a default page_size of 20, a maximum page_size of 100, and a minimum page value of 1
4. THE Platform SHALL use stable machine-readable error codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, PRODUCT_OUT_OF_STOCK, PAYMENT_FAILED, SERVICE_UNAVAILABLE, AI_NO_CONTEXT_FOUND)
5. WHEN a VALIDATION_ERROR response is returned, THE Platform SHALL include a details array in the error object containing one entry per invalid field with the field name and a human-readable reason for rejection
6. IF a paginated list request specifies a page number greater than total_pages, THEN THE Platform SHALL return a successful response with an empty data array and the correct pagination metadata
7. WHEN an error response is returned, THE Platform SHALL use the corresponding HTTP status code: 401 for UNAUTHORIZED, 403 for FORBIDDEN, 404 for NOT_FOUND, 422 for VALIDATION_ERROR and PRODUCT_OUT_OF_STOCK, 502 for PAYMENT_FAILED, and 503 for SERVICE_UNAVAILABLE and AI_NO_CONTEXT_FOUND

### Requirement 20: Observability and Healthchecks

**User Story:** As a developer, I want structured logging and healthchecks, so that I can monitor system health and debug issues across services.

#### Acceptance Criteria

1. THE Platform SHALL expose a GET /healthz endpoint on every service that returns HTTP 200 with a JSON body containing a status field set to "ok" when the process is running, and HTTP 503 with status field set to "unavailable" when the process is not healthy
2. THE Platform SHALL expose a GET /readyz endpoint on every service that returns HTTP 200 with a JSON body containing a status field set to "ready" when the service's database connection and required downstream dependencies are reachable, and HTTP 503 with status set to "not_ready" and a checks array listing each failed dependency when any dependency is unreachable
3. THE Platform SHALL emit every structured log entry as a single-line JSON object containing the fields: timestamp (ISO 8601 format), level (one of DEBUG, INFO, WARNING, ERROR), service (service name), request_id, user_id (or null for unauthenticated requests), method (HTTP method), path, status_code, and duration_ms
4. THE Platform SHALL generate a unique request_id prefixed with "req_" for each incoming request at the Gateway, pass it to downstream services via the X-Request-ID HTTP header, and include it in all log entries and API response meta fields for that request
5. IF a service receives a request without an X-Request-ID header from a non-Gateway caller, THEN THE Platform SHALL generate a new request_id and use it for all logging and response metadata for that request

### Requirement 21: Deployment and Infrastructure

**User Story:** As a developer, I want the entire system deployable with a single command, so that I can run and demo the platform locally without manual setup.

#### Acceptance Criteria

1. WHEN the developer runs `docker compose up`, THE Platform SHALL start all services (identity, catalog, cart, order, payment, shipping, review, ai), all databases (2 MySQL, 6 PostgreSQL), the Nginx gateway, and the frontend, reaching a state where all containers report healthy or running status within 180 seconds
2. THE Platform SHALL use database-per-service with 2 MySQL instances (identity_db, payment_db) and 6 PostgreSQL instances (catalog_db, cart_db, order_db, shipping_db, review_db, ai_db)
3. THE Platform SHALL configure Docker healthchecks for all database containers with an interval of no more than 10 seconds, a timeout of no more than 5 seconds, and a maximum of 10 retries, and each application service SHALL declare a depends_on condition of service_healthy on its database container
4. THE Platform SHALL use named Docker volumes for all database data persistence so that data survives container restarts without requiring re-seeding
5. THE Platform SHALL expose only port 80 on the host through the Gateway container; no other service or database container SHALL publish ports to the host
6. THE Platform SHALL define at least two Docker networks: a public network joined by the gateway, and an internal network joined by all services and databases, so that only the gateway is reachable from outside the Docker environment
7. THE Platform SHALL configure each application service container with a healthcheck that verifies the service process is responding on its internal port, using an interval of no more than 10 seconds and a maximum of 5 retries

### Requirement 22: Frontend User Interface

**User Story:** As a customer, I want a modern and intuitive shopping interface, so that I can browse products, interact with the AI assistant, and complete purchases seamlessly.

#### Acceptance Criteria

1. THE Frontend SHALL display a homepage with hero section, category shortcuts (8 categories), featured products grid (4 to 8 products), AI recommendation carousel (up to 10 products), and trust indicators (genuine products, warranty, fast shipping, secure payment, AI advisor)
2. THE Frontend SHALL display a product listing page with sidebar filters (category, brand, price range, rating), sort options (popular, newest, price ascending, price descending, rating), and a paginated product grid displaying 12 products per page
3. THE Frontend SHALL display a product detail page with image gallery, specifications, price, stock status, add-to-cart button, and AI assistant integration
4. THE Frontend SHALL provide an AI chatbot interface (drawer or full page) with 3 to 5 suggested prompts, chat bubbles distinguishing user messages from AI responses, and up to 5 embedded product recommendation cards within each assistant response
5. THE Frontend SHALL display a cart page with item list, quantity controls, order summary, and proceed-to-checkout button
6. THE Frontend SHALL display a checkout page with shipping address form, payment method selector, order summary, and payment status feedback
7. THE Frontend SHALL display an order tracking page with status timeline (created, payment_pending, paid, shipping, delivered), items purchased, and shipping details
8. THE Frontend SHALL provide an admin dashboard with overview metrics, product management table, AI model status cards, and order management table
9. THE Frontend SHALL display skeleton loading placeholders for product grids and chat responses while API requests are pending, display an empty state message when a collection contains zero items, and display an error state with a retry option when an API request returns a non-success response
10. IF a product image URL fails to load, THEN THE Frontend SHALL render a fallback placeholder image of the same dimensions as the expected product image
11. THE Frontend SHALL adapt layout for viewports below 768px by rendering the product grid in a 2-column or 1-column layout and converting sidebar filters into a bottom sheet or collapsible panel

### Requirement 23: Order Status Lifecycle

**User Story:** As a system operator, I want explicit order status transitions, so that orders follow a predictable lifecycle and invalid transitions are prevented.

#### Acceptance Criteria

1. THE Order_Service SHALL support the following order statuses: created, payment_pending, paid, payment_failed, shipping, completed, cancelled
2. THE Order_Service SHALL enforce allowed status transitions: created may transition to payment_pending or cancelled; payment_pending may transition to paid, payment_failed, or cancelled; paid may transition to shipping or cancelled; shipping may transition to completed; payment_failed may transition to payment_pending or cancelled; completed and cancelled SHALL be terminal statuses with no outgoing transitions
3. WHEN an order status transition occurs, THE Order_Service SHALL create a status history entry recording the from_status, to_status, reason (optional, maximum 500 characters), and timestamp
4. IF an invalid status transition is requested, THEN THE Order_Service SHALL return a VALIDATION_ERROR response indicating the current status and the rejected target status, without modifying the order status
5. IF a status transition request is received for an order that is concurrently being transitioned, THEN THE Order_Service SHALL reject the second request with a VALIDATION_ERROR response to prevent conflicting state changes
6. WHEN a status transition is requested by a user, THE Order_Service SHALL verify that the requesting user has the appropriate role: system-initiated transitions (payment results, shipment updates) SHALL be accepted from authorized services; manual cancellation SHALL be accepted from the order-owning customer, staff, or admin roles

### Requirement 24: Data Seeding and Dataset Integration

**User Story:** As a developer, I want automated data seeding from external datasets, so that the platform has realistic product and behavioral data for demo and AI model training.

#### Acceptance Criteria

1. THE Catalog_Service SHALL provide a management command to seed products from the DummyJSON API with a configurable limit parameter defaulting to 30 and accepting values between 1 and 194
2. THE AI_Service SHALL provide a management command to ingest the Amazon Reviews 2023/UCSD dataset that parses review records and stores processed entries for sentiment model training and RAG corpus enrichment, reporting the total number of records ingested upon completion
3. THE AI_Service SHALL provide a management command to ingest the RetailRocket Ecommerce Dataset that parses user interaction events and stores processed sequences for sequence recommendation model training, reporting the total number of sequences generated upon completion
4. THE AI_Service SHALL provide a management command to ingest the UCI Online Retail dataset that parses transaction records and stores processed entries for customer segmentation RFM analysis, reporting the total number of customer records processed upon completion
5. THE AI_Service SHALL provide a management command to ingest the self-built TechShop FAQ knowledge base that parses FAQ documents, generates embeddings, and stores them in pgvector for RAG chatbot policy grounding, reporting the total number of documents embedded upon completion
6. IF an external dataset source is unreachable or the dataset file is not found at the expected path, THEN THE seeding command SHALL exit with a non-zero status code and output an error message indicating the source that failed
7. WHEN a seeding command is executed and matching records already exist in the database, THE service SHALL skip duplicate records rather than creating duplicates, ensuring the command is idempotent
8. WHEN a seeding command completes successfully, THE service SHALL exit with a zero status code and output a summary indicating the number of records created and the number of records skipped

### Requirement 25: Security

**User Story:** As a system administrator, I want the platform to follow secure coding practices, so that user data and system integrity are protected.

#### Acceptance Criteria

1. THE Platform SHALL store all secrets (database credentials, JWT keys, API keys) in environment variables and exclude .env files from version control via .gitignore
2. THE Platform SHALL restrict CORS to known frontend origins only and reject cross-origin requests from disallowed origins by omitting the Access-Control-Allow-Origin response header
3. THE Platform SHALL enforce that admin API endpoints require the admin role and staff API endpoints require staff or admin role
4. IF a customer attempts to access a cart, order, or review belonging to a different user, THEN THE Platform SHALL return a FORBIDDEN error response without disclosing the existence of the requested resource
5. THE Platform SHALL configure DEBUG mode as false in deployment configuration to prevent stack trace and internal state exposure in error responses
6. IF a request body exceeds 20 megabytes, THEN THE Gateway SHALL reject the request and return an error response indicating the payload size limit has been exceeded
7. THE Identity_Service SHALL issue access tokens with a maximum expiration time of 60 minutes and refresh tokens with a maximum expiration time of 7 days
