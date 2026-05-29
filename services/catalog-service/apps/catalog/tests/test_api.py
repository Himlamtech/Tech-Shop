"""
Unit tests for Catalog Service API endpoints.

Tests: list, detail, search, filter, sort, pagination, admin CRUD,
product import, and permissions.
"""

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, ProductImage


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductListAPITests(TestCase):
    """Tests for GET /api/v1/products/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name="Electronics", slug="electronics"
        )
        # Create test products
        for i in range(5):
            product = Product.objects.create(
                sku=f"LIST-{i:03d}",
                name=f"Product {i}",
                slug=f"product-{i}",
                price=Decimal(f"{(i + 1) * 10}.00"),
                stock=10 + i,
                brand="TestBrand",
                category=self.category,
                rating_avg=Decimal(f"{i}.0"),
            )
            ProductImage.objects.create(
                product=product,
                image_url=f"https://example.com/img{i}.jpg",
                is_primary=True,
                sort_order=0,
            )

    def test_list_products_success(self):
        """GET /api/v1/products/ should return paginated product list."""
        response = self.client.get("/api/v1/products/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 5)

    def test_list_products_pagination(self):
        """Pagination should limit results per page."""
        response = self.client.get("/api/v1/products/?page_size=2&page=1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]), 2)
        self.assertIn("pagination", data["meta"])

    def test_search_products(self):
        """Search should filter products by name."""
        response = self.client.get("/api/v1/products/?search=Product 1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data["data"]), 1)

    def test_filter_by_brand(self):
        """Filter by brand should return matching products."""
        response = self.client.get("/api/v1/products/?brand=TestBrand")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]), 5)

    def test_filter_by_price_range(self):
        """Filter by min/max price should return products in range."""
        response = self.client.get("/api/v1/products/?min_price=20&max_price=40")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for item in data["data"]:
            price = Decimal(item["price"])
            self.assertGreaterEqual(price, Decimal("20"))
            self.assertLessEqual(price, Decimal("40"))

    def test_sort_by_price_asc(self):
        """Sort by price ascending should order correctly."""
        response = self.client.get("/api/v1/products/?sort=price_asc")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        prices = [Decimal(item["price"]) for item in data["data"]]
        self.assertEqual(prices, sorted(prices))

    def test_sort_by_price_desc(self):
        """Sort by price descending should order correctly."""
        response = self.client.get("/api/v1/products/?sort=price_desc")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        prices = [Decimal(item["price"]) for item in data["data"]]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_filter_by_category(self):
        """Filter by category slug should return matching products."""
        response = self.client.get("/api/v1/products/?category=electronics")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]), 5)

    def test_invalid_filter_params(self):
        """Invalid filter params should return 422 error."""
        response = self.client.get("/api/v1/products/?min_price=abc")
        self.assertEqual(response.status_code, 422)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductDetailAPITests(TestCase):
    """Tests for GET /api/v1/products/{id}/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name="Electronics", slug="electronics"
        )
        self.product = Product.objects.create(
            sku="DETAIL-001",
            name="Detail Product",
            slug="detail-product",
            price=Decimal("199.99"),
            stock=50,
            brand="DetailBrand",
            category=self.category,
            description="A detailed product description.",
        )
        ProductImage.objects.create(
            product=self.product,
            image_url="https://example.com/detail.jpg",
            is_primary=True,
            sort_order=0,
        )

    def test_get_product_detail_success(self):
        """GET /api/v1/products/{id}/ should return full product detail."""
        response = self.client.get(f"/api/v1/products/{self.product.id}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["name"], "Detail Product")
        self.assertEqual(data["data"]["description"], "A detailed product description.")
        self.assertIn("images", data["data"])
        self.assertIn("category", data["data"])

    def test_get_product_not_found(self):
        """GET /api/v1/products/{id}/ with invalid ID should return 404."""
        fake_id = uuid.uuid4()
        response = self.client.get(f"/api/v1/products/{fake_id}/")
        self.assertEqual(response.status_code, 404)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductAdminCRUDTests(TestCase):
    """Tests for admin product CRUD operations."""

    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name="Electronics", slug="electronics"
        )

    def _set_admin_auth(self):
        """Simulate admin authentication via middleware attributes."""
        # Patch the middleware to set admin user
        self.client.defaults["HTTP_X_USER_ID"] = str(uuid.uuid4())
        self.client.defaults["HTTP_X_USER_ROLE"] = "admin"

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_product_as_admin(self, mock_jwt):
        """POST /api/v1/products/ as admin should create product."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        payload = {
            "name": "New Product",
            "description": "A new product description",
            "price": "49.99",
            "stock": 100,
            "brand": "NewBrand",
            "category_id": str(self.category.id),
            "image_urls": ["https://example.com/new.jpg"],
        }
        response = self.client.post(
            "/api/v1/products/", data=payload, format="json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["name"], "New Product")

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_update_product_as_admin(self, mock_jwt):
        """PATCH /api/v1/products/{id}/ as admin should update product."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        product = Product.objects.create(
            sku="UPD-001",
            name="Old Name",
            slug="old-name",
            price=Decimal("30.00"),
            stock=10,
            brand="Brand",
            category=self.category,
        )
        response = self.client.patch(
            f"/api/v1/products/{product.id}/",
            data={"name": "Updated Name", "price": "35.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["name"], "Updated Name")

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_delete_product_soft_delete(self, mock_jwt):
        """DELETE /api/v1/products/{id}/ should soft-delete (set inactive)."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        product = Product.objects.create(
            sku="DEL-001",
            name="To Delete",
            slug="to-delete",
            price=Decimal("10.00"),
            stock=5,
            brand="Brand",
            category=self.category,
        )
        response = self.client.delete(f"/api/v1/products/{product.id}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "inactive")

        product.refresh_from_db()
        self.assertEqual(product.status, "inactive")

    def test_create_product_unauthenticated(self):
        """POST /api/v1/products/ without auth should return 401."""
        payload = {
            "name": "Unauthorized",
            "description": "Should fail",
            "price": "10.00",
            "stock": 1,
            "brand": "Brand",
            "category_id": str(self.category.id),
            "image_urls": ["https://example.com/img.jpg"],
        }
        response = self.client.post(
            "/api/v1/products/", data=payload, format="json"
        )
        self.assertIn(response.status_code, [401, 403])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_product_as_customer_forbidden(self, mock_jwt):
        """POST /api/v1/products/ as customer should return 403."""

        def set_customer(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

        payload = {
            "name": "Forbidden",
            "description": "Should fail",
            "price": "10.00",
            "stock": 1,
            "brand": "Brand",
            "category_id": str(self.category.id),
            "image_urls": ["https://example.com/img.jpg"],
        }
        response = self.client.post(
            "/api/v1/products/", data=payload, format="json"
        )
        self.assertEqual(response.status_code, 403)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductImportAPITests(TestCase):
    """Tests for POST /api/v1/products/import/ endpoint."""

    def setUp(self):
        self.client = APIClient()

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.catalog.views.call_command")
    def test_import_products_success(self, mock_call_command, mock_jwt):
        """Admin can trigger product import."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        response = self.client.post(
            "/api/v1/products/import/",
            data={"limit": 10},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        mock_call_command.assert_called_once_with("seed_products", limit=10)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_import_products_invalid_limit(self, mock_jwt):
        """Import with invalid limit should return 422."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        response = self.client.post(
            "/api/v1/products/import/",
            data={"limit": 0},
            format="json",
        )
        self.assertEqual(response.status_code, 422)

    def test_import_products_unauthenticated(self):
        """Import without auth should return 401."""
        response = self.client.post(
            "/api/v1/products/import/",
            data={"limit": 10},
            format="json",
        )
        self.assertIn(response.status_code, [401, 403])


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class CategoryAPITests(TestCase):
    """Tests for category API endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.root_category = Category.objects.create(
            name="Electronics", slug="electronics"
        )
        self.child_category = Category.objects.create(
            name="Phones", slug="phones", parent=self.root_category
        )

    def test_list_categories(self):
        """GET /api/v1/categories/ should return category tree."""
        response = self.client.get("/api/v1/categories/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_category_as_admin(self, mock_jwt):
        """POST /api/v1/categories/ as admin should create category."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        payload = {"name": "Tablets"}
        response = self.client.post(
            "/api/v1/categories/", data=payload, format="json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["data"]["name"], "Tablets")

    def test_category_products(self):
        """GET /api/v1/categories/{slug}/products/ should return products."""
        Product.objects.create(
            sku="CAT-001",
            name="Phone Product",
            slug="phone-product",
            price=Decimal("299.99"),
            stock=20,
            brand="PhoneBrand",
            category=self.child_category,
        )
        response = self.client.get("/api/v1/categories/electronics/products/")
        self.assertEqual(response.status_code, 200)

    def test_category_products_not_found(self):
        """GET /api/v1/categories/{slug}/products/ with invalid slug returns 404."""
        response = self.client.get("/api/v1/categories/nonexistent/products/")
        self.assertEqual(response.status_code, 404)
