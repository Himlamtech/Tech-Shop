# DEPLOYS.md

# TechShop Deployment Guide

## 1. Deployment Goal

Mục tiêu là deploy hệ thống theo kiểu **production-like** nhưng vẫn phù hợp bài tập lớn:

- Mỗi service chạy container riêng.
- Mỗi service có database riêng.
- Gateway làm entry point duy nhất.
- Có healthcheck, logs, migrations, seed data.
- Có thể demo bằng một lệnh `docker compose up -d`.

## 2. Deployment Topology

```txt
Internet / Browser
        ↓
Nginx Gateway :80
        ↓
Frontend + Backend APIs
        ↓
Django/FastAPI services
        ↓
MySQL/PostgreSQL databases per service
```

## 3. Docker Compose Services

Minimum services:

```txt
gateway
frontend
identity-service
catalog-service
cart-service
order-service
payment-service
shipping-service
review-service
ai-service
identity-mysql
payment-mysql
catalog-postgres
cart-postgres
order-postgres
shipping-postgres
review-postgres
ai-postgres
```

Optional:

```txt
redis
prometheus
grafana
loki
```

## 4. Network Design

Use internal Docker networks:

```yaml
networks:
  public:
  internal:
```

Rules:

- `gateway` joins `public` and `internal`.
- Services join `internal` only.
- Databases join `internal` only.
- Only gateway exposes port 80/443 to host.
- DB ports should not be exposed in production mode.

## 5. Volume Design

Use named volumes:

```yaml
volumes:
  identity_mysql_data:
  payment_mysql_data:
  catalog_postgres_data:
  cart_postgres_data:
  order_postgres_data:
  shipping_postgres_data:
  review_postgres_data:
  ai_postgres_data:
  grafana_data:
```

## 6. Example Compose Skeleton

```yaml
services:
  gateway:
    build: ./gateway
    ports:
      - "80:80"
    depends_on:
      - frontend
      - identity-service
      - catalog-service
      - cart-service
      - order-service
      - payment-service
      - shipping-service
      - review-service
      - ai-service
    networks:
      - public
      - internal

  identity-service:
    build: ./services/identity-service
    env_file: ./services/identity-service/.env
    depends_on:
      identity-mysql:
        condition: service_healthy
    networks:
      - internal
    restart: unless-stopped

  identity-mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: identity_db
      MYSQL_USER: techshop
      MYSQL_PASSWORD: techshop
      MYSQL_ROOT_PASSWORD: root
    volumes:
      - identity_mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - internal

  catalog-postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: catalog_db
      POSTGRES_USER: techshop
      POSTGRES_PASSWORD: techshop
    volumes:
      - catalog_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U techshop -d catalog_db"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - internal
```

## 7. Service Dockerfile — Django

Development/demo Dockerfile:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
```

For local hot reload, use override:

```yaml
command: python manage.py runserver 0.0.0.0:8000
volumes:
  - ./services/catalog-service:/app
```

## 8. Service Dockerfile — AI Service

FastAPI option:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 9. Environment Files

Each service has its own `.env`.

Example `catalog-service/.env`:

```env
APP_ENV=production
DEBUG=false
SECRET_KEY=change-me
DATABASE_URL=postgres://techshop:techshop@catalog-postgres:5432/catalog_db
JWT_PUBLIC_KEY=change-me
CATALOG_SERVICE_NAME=catalog-service
LOG_LEVEL=INFO
```

Example `payment-service/.env`:

```env
DATABASE_URL=mysql://techshop:techshop@payment-mysql:3306/payment_db
PAYMENT_SIMULATION_MODE=true
```

## 10. Migration Strategy

Run migrations after DB is healthy.

Manual:

```bash
docker compose exec identity-service python manage.py migrate
docker compose exec catalog-service python manage.py migrate
docker compose exec cart-service python manage.py migrate
docker compose exec order-service python manage.py migrate
docker compose exec payment-service python manage.py migrate
docker compose exec shipping-service python manage.py migrate
docker compose exec review-service python manage.py migrate
```

Seed products:

```bash
docker compose exec catalog-service python manage.py seed_products --source dummyjson --limit 100
```

Build AI index:

```bash
docker compose exec ai-service python -m app.jobs.ingest_catalog
```

Recommended script:

```bash
./infrastructure/scripts/migrate_all.sh
./infrastructure/scripts/seed_demo_data.sh
./infrastructure/scripts/build_ai_index.sh
```

## 11. Healthcheck Convention

Every service must provide:

```txt
GET /healthz -> process alive
GET /readyz  -> DB and required dependencies ready
```

Docker healthcheck example:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## 12. Nginx Gateway

Gateway responsibilities:

- Route frontend.
- Route APIs.
- Add request headers.
- Apply body size limit.
- Basic rate limit optional.

Example:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20m;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-ID $request_id;
    }

    location /api/catalog/ {
        proxy_pass http://catalog-service:8000/api/v1/;
        proxy_set_header X-Request-ID $request_id;
        proxy_set_header Authorization $http_authorization;
    }

    location /api/ai/ {
        proxy_pass http://ai-service:8000/api/v1/;
        proxy_read_timeout 120s;
        proxy_set_header X-Request-ID $request_id;
        proxy_set_header Authorization $http_authorization;
    }
}
```

## 13. Production-like Startup Flow

```bash
cp .env.example .env
cp services/catalog-service/.env.example services/catalog-service/.env
# repeat for services

docker compose build
docker compose up -d

docker compose ps

docker compose exec identity-service python manage.py migrate
docker compose exec catalog-service python manage.py migrate
# repeat

docker compose exec catalog-service python manage.py seed_products --source dummyjson --limit 100
docker compose exec ai-service python -m app.jobs.ingest_catalog
```

## 14. Logs

View all logs:

```bash
docker compose logs -f
```

View one service:

```bash
docker compose logs -f catalog-service
```

Check errors:

```bash
docker compose logs --tail=200 gateway
docker compose logs --tail=200 ai-service
```

## 15. Backup and Restore

### PostgreSQL backup

```bash
docker compose exec catalog-postgres pg_dump -U techshop catalog_db > backups/catalog_db.sql
```

### PostgreSQL restore

```bash
cat backups/catalog_db.sql | docker compose exec -T catalog-postgres psql -U techshop -d catalog_db
```

### MySQL backup

```bash
docker compose exec identity-mysql mysqldump -u techshop -ptechshop identity_db > backups/identity_db.sql
```

## 16. Monitoring

Minimum:

- Docker logs.
- Service healthchecks.
- Nginx access logs.

Better:

- Prometheus scrapes `/metrics`.
- Grafana dashboard.
- Loki for logs.

Metrics to expose:

```txt
http_requests_total
http_request_duration_seconds
service_errors_total
orders_created_total
payments_success_total
ai_chat_requests_total
ai_recommendation_requests_total
```

## 17. CI/CD Plan

Minimum GitHub Actions:

```txt
on push:
  - ruff check
  - ruff format --check
  - pytest
  - docker compose build
```

Production-like:

```txt
main branch:
  - test
  - build images
  - push to registry
  - ssh deploy server
  - docker compose pull
  - docker compose up -d
  - run migrations
  - healthcheck
```

## 18. Security Checklist

- [ ] `.env` not committed.
- [ ] `DEBUG=false` in deploy mode.
- [ ] DB ports not public.
- [ ] Gateway only public entry.
- [ ] JWT secret/public key configured.
- [ ] Admin APIs require admin role.
- [ ] CORS restricted.
- [ ] Logs do not contain password/token.
- [ ] AI API has request size limit.
- [ ] Rate limit chatbot endpoint if public.

## 19. Rollback Plan

For demo:

```bash
docker compose down
git checkout <previous-working-commit>
docker compose up -d --build
```

For DB rollback:

- Prefer forward migration.
- Keep SQL backups before major schema change.
- For demo, named volumes can be reset:

```bash
docker compose down -v
```

Warning: this deletes DB data.

## 20. Demo Deployment Checklist

Before presentation:

- [ ] `docker compose ps` all healthy.
- [ ] Homepage loads.
- [ ] Product images load.
- [ ] Login works.
- [ ] Add to cart works.
- [ ] Checkout works.
- [ ] Payment simulation success works.
- [ ] Shipping status visible.
- [ ] AI chatbot returns grounded products.
- [ ] Admin dashboard visible.
- [ ] Logs available for proof.
- [ ] Screenshots saved into `docs/screenshots/`.

