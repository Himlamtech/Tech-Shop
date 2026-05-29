# CODING_CONVENTION.md

# TechShop Coding Convention

## 1. Core Principles

- Code phải dễ đọc hơn là “ngầu”.
- Service boundary rõ, không cross-service DB access.
- API contract ổn định, versioned.
- Business logic không đặt bừa trong view.
- External calls phải có timeout.
- Errors phải predictable.
- Logs phải debug được khi chạy nhiều service.

## 2. Python/Django Standards

### 2.1 Python Version

Recommended:

```txt
Python 3.11+
Django 5.x or 4.2 LTS
Django REST Framework
```

### 2.2 Formatting

Use:

```bash
ruff check .
ruff format .
mypy .
pytest
```

Line length:

```txt
100 characters
```

### 2.3 Naming

| Type | Convention | Example |
|---|---|---|
| Python file | snake_case | `product_service.py` |
| Class | PascalCase | `ProductService` |
| Function | snake_case | `create_order` |
| Constant | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| API path | kebab-case or plural nouns | `/api/v1/products` |
| DB table | snake_case plural or Django default | `catalog_product` |
| Env var | UPPER_SNAKE_CASE | `CATALOG_SERVICE_URL` |

## 3. Django Service Structure

Each Django service should follow:

```txt
catalog-service/
├── manage.py
├── pyproject.toml
├── Dockerfile
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── apps/
│   ├── core/
│   │   ├── exceptions.py
│   │   ├── middleware.py
│   │   ├── pagination.py
│   │   ├── permissions.py
│   │   ├── responses.py
│   │   └── http_client.py
│   └── catalog/
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── services.py
│       ├── selectors.py
│       ├── repositories.py
│       ├── permissions.py
│       ├── tasks.py
│       ├── admin.py
│       └── tests/
└── requirements.txt
```

### 3.1 Responsibility per layer

| File | Responsibility |
|---|---|
| `models.py` | DB schema only, small model methods allowed |
| `serializers.py` | Input/output validation and representation |
| `views.py` | HTTP layer only, no heavy business logic |
| `services.py` | Write operations/business workflows |
| `selectors.py` | Read/query operations |
| `repositories.py` | Optional DB abstraction for complex persistence |
| `permissions.py` | RBAC rules |
| `tasks.py` | Async/background jobs/import jobs |

## 4. API Design Convention

### 4.1 Versioning

All service APIs:

```txt
/api/v1/...
```

Gateway can expose:

```txt
/api/catalog/products
```

but internal service must still keep v1.

### 4.2 Resource naming

Use plural nouns:

```txt
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/{id}
PATCH  /api/v1/products/{id}
DELETE /api/v1/products/{id}
```

Action endpoints allowed only for workflows:

```txt
POST /api/v1/orders/checkout
POST /api/v1/payments/{id}/simulate-success
POST /api/v1/products/import
```

### 4.3 Response envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_..."
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  },
  "meta": {
    "request_id": "req_..."
  }
}
```

### 4.4 Pagination

```txt
GET /api/v1/products?page=1&page_size=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 194,
      "total_pages": 10
    }
  }
}
```

## 5. Error Codes

Use stable machine-readable codes.

| Code | HTTP | Meaning |
|---|---:|---|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Role not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `PRODUCT_OUT_OF_STOCK` | 409 | Cannot add/order product |
| `PAYMENT_FAILED` | 402/409 | Payment failed |
| `SERVICE_UNAVAILABLE` | 503 | Downstream unavailable |
| `AI_NO_CONTEXT_FOUND` | 422 | RAG cannot retrieve enough context |

## 6. Inter-service HTTP Client

Never use raw `requests.get(...)` directly inside business logic.

Create shared wrapper:

```python
class ServiceClient:
    def __init__(self, base_url: str, timeout_seconds: float = 3.0):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def get(self, path: str, *, headers: dict | None = None, params: dict | None = None) -> dict:
        ...

    def post(self, path: str, *, headers: dict | None = None, json: dict | None = None) -> dict:
        ...
```

Required behavior:

- Timeout default 3s.
- Propagate `Authorization` and `X-Request-ID`.
- Convert downstream error into internal exception.
- Log service name, path, status, duration.

## 7. Transaction Convention

Use DB transaction around local writes only:

```python
from django.db import transaction

with transaction.atomic():
    order = Order.objects.create(...)
    OrderItem.objects.bulk_create(...)
```

Do not hold local transaction while waiting too long for downstream service. For checkout demo it is acceptable, but prefer:

1. Create local order.
2. Commit.
3. Call payment.
4. Update status.

## 8. Status Transition Convention

Define allowed transitions explicitly.

Example order status:

```python
ORDER_TRANSITIONS = {
    "created": {"payment_pending", "cancelled"},
    "payment_pending": {"paid", "payment_failed", "cancelled"},
    "paid": {"shipping", "cancelled"},
    "shipping": {"completed"},
    "payment_failed": {"payment_pending", "cancelled"},
}
```

Every transition should create status history.

## 9. Security Convention

- Never commit `.env`.
- Never log password/token/raw secret.
- Password hashing via Django built-in hashers.
- Validate JWT in every protected service.
- Admin APIs require `admin` role.
- Staff APIs require `staff` or `admin`.
- Customer APIs require owner check: user can only access own cart/order.
- Use CORS only for known frontend origin.

## 10. Logging Convention

Every log entry should contain:

```txt
timestamp, level, service, request_id, user_id, method, path, status_code, duration_ms
```

Example:

```python
logger.info(
    "product_listed",
    extra={
        "request_id": request.id,
        "user_id": str(request.user.id) if request.user.is_authenticated else None,
        "category": category_slug,
        "duration_ms": duration_ms,
    },
)
```

## 11. Testing Convention

Minimum tests per service:

```txt
tests/
├── test_models.py
├── test_serializers.py
├── test_api.py
└── test_services.py
```

Must test:

- Auth success/failure.
- Product list/detail.
- Cart add/update/remove.
- Checkout success.
- Payment failed path.
- Unauthorized access.
- Service unavailable handling.

## 12. Migration Convention

- Every schema change must have migration.
- Do not manually edit DB schema in container.
- Seed data should be a Django management command.

Example:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py seed_products --source dummyjson --limit 100
```

## 13. AI Service Code Structure

If FastAPI:

```txt
ai-service/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── chat.py
│   │   ├── recommendations.py
│   │   ├── sentiment.py
│   │   └── models.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── errors.py
│   ├── application/
│   │   ├── rag_service.py
│   │   ├── recommendation_service.py
│   │   ├── sentiment_service.py
│   │   └── segmentation_service.py
│   ├── infrastructure/
│   │   ├── db/
│   │   ├── llm/
│   │   ├── embeddings/
│   │   └── catalog_client.py
│   └── ml/
│       ├── product_classifier/
│       ├── sentiment/
│       ├── segmentation/
│       ├── sequence_model/
│       └── rag/
└── tests/
```

If Django-only:

```txt
ai-service/apps/ai/
├── models.py
├── serializers.py
├── views.py
├── services.py
├── pipelines/
├── ml/
└── tasks.py
```

## 14. Frontend Convention

Recommended structure:

```txt
frontend/src/
├── app/
├── components/
│   ├── product/
│   ├── cart/
│   ├── checkout/
│   ├── ai/
│   └── admin/
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── format.ts
├── pages/
└── types/
```

Rules:

- API calls only through `api-client`.
- Currency formatting centralized.
- Product card must support missing image fallback.
- Chatbot response can render product IDs by hydrating from catalog API.

## 15. Commit Convention

Use Conventional Commits:

```txt
feat(catalog): add product import command
fix(cart): validate stock before add item
docs(architecture): add checkout sequence diagram
chore(devops): add healthcheck for services
test(order): add checkout integration test
```

## 16. Vibe Coding Guardrails

When using AI coding tools:

1. Give it one service/task at a time.
2. Paste relevant docs section first.
3. Require it to preserve API response envelope.
4. Require tests for generated code.
5. Reject cross-service DB access.
6. Reject hardcoded secrets.
7. Reject “mock everything” if feature needs real DB/API.
8. Run Docker Compose after each vertical slice.

