"""
Unit tests for Catalog Service models.

Tests model constraints: price range, stock range, slug uniqueness, category level.
"""

import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase, override_settings

from apps.catalog.models import Category, Product, ProductImage


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class CategoryModelTests(TestCase):
    """Tests for the Category model."""

    def test_create_root_category(self):
        """Root category should have level=1 and no parent."""
        category = Category.objects.create(name="Electronics", slug="electronics")
        self.assertEqual(category.level, 1)
        self.assertIsNone(category.parent)
        self.assertTrue(category.is_active)

    def test_auto_slug_generation(self):
        """Slug should be auto-generated from name if not provided."""
        category = Category(name="Smart Phones")
        category.save()
        self.assertEqual(category.slug, "smart-phones")

    def test_child_category_level(self):
        """Child category should have parent.level + 1."""
        parent = Category.objects.create(name="Electronics", slug="electronics")
        child = Category.objects.create(
            name="Phones", slug="phones", parent=parent
        )
        self.assertEqual(child.level, 2)

    def test_grandchild_category_level(self):
        """Third-level category should have level=3."""
        root = Category.objects.create(name="Electronics", slug="electronics")
        child = Category.objects.create(name="Phones", slug="phones", parent=root)
        grandchild = Category.objects.create(
            name="Smartphones", slug="smartphones", parent=child
        )
        self.assertEqual(grandchild.level, 3)

    def test_max_depth_validation(self):
        """Category depth cannot exceed 3 levels."""
        root = Category.objects.create(name="L1", slug="l1")
        child = Category.objects.create(name="L2", slug="l2", parent=root)
        grandchild = Category.objects.create(name="L3", slug="l3", parent=child)

        too_deep = Category(name="L4", slug="l4", parent=grandchild)
        with self.assertRaises(ValidationError):
            too_deep.clean()

    def test_slug_uniqueness(self):
        """Slug must be unique across categories."""
        Category.objects.create(name="Electronics", slug="electronics")
        with self.assertRaises(IntegrityError):
            Category.objects.create(name="Electronics 2", slug="electronics")

    def test_category_str(self):
        """String representation should return the name."""
        category = Category.objects.create(name="Laptops", slug="laptops")
        self.assertEqual(str(category), "Laptops")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductModelTests(TestCase):
    """Tests for the Product model."""

    def setUp(self):
        self.category = Category.objects.create(
            name="Electronics", slug="electronics"
        )

    def test_create_product_success(self):
        """Product creation with valid data should succeed."""
        product = Product.objects.create(
            sku="TEST-001",
            name="Test Product",
            price=Decimal("99.99"),
            stock=100,
            brand="TestBrand",
            category=self.category,
        )
        self.assertEqual(product.status, "active")
        self.assertEqual(product.rating_avg, Decimal("0.0"))
        self.assertEqual(product.rating_count, 0)

    def test_auto_slug_generation(self):
        """Slug should be auto-generated from name."""
        product = Product(
            sku="TEST-002",
            name="My Great Product",
            price=Decimal("49.99"),
            stock=10,
            brand="Brand",
            category=self.category,
        )
        product.save()
        self.assertEqual(product.slug, "my-great-product")

    def test_slug_uniqueness_with_sku_fallback(self):
        """Duplicate slug should append SKU for uniqueness."""
        Product.objects.create(
            sku="SKU-001",
            name="Widget",
            slug="widget",
            price=Decimal("10.00"),
            stock=5,
            brand="Brand",
            category=self.category,
        )
        product2 = Product(
            sku="SKU-002",
            name="Widget",
            price=Decimal("20.00"),
            stock=10,
            brand="Brand",
            category=self.category,
        )
        product2.save()
        self.assertEqual(product2.slug, "widget-sku-002")

    def test_sku_uniqueness(self):
        """SKU must be unique."""
        Product.objects.create(
            sku="UNIQUE-SKU",
            name="Product 1",
            slug="product-1",
            price=Decimal("10.00"),
            stock=5,
            brand="Brand",
            category=self.category,
        )
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                sku="UNIQUE-SKU",
                name="Product 2",
                slug="product-2",
                price=Decimal("20.00"),
                stock=10,
                brand="Brand",
                category=self.category,
            )

    def test_price_min_validator(self):
        """Price must be at least 0.01."""
        product = Product(
            sku="TEST-PRICE",
            name="Cheap",
            slug="cheap",
            price=Decimal("0.00"),
            stock=1,
            brand="Brand",
            category=self.category,
        )
        with self.assertRaises(ValidationError):
            product.full_clean()

    def test_price_max_validator(self):
        """Price must not exceed 999999999.99."""
        product = Product(
            sku="TEST-PRICE-MAX",
            name="Expensive",
            slug="expensive",
            price=Decimal("9999999999.99"),
            stock=1,
            brand="Brand",
            category=self.category,
        )
        with self.assertRaises(ValidationError):
            product.full_clean()

    def test_stock_max_validator(self):
        """Stock must not exceed 999999."""
        product = Product(
            sku="TEST-STOCK",
            name="Overstocked",
            slug="overstocked",
            price=Decimal("10.00"),
            stock=1000000,
            brand="Brand",
            category=self.category,
        )
        with self.assertRaises(ValidationError):
            product.full_clean()

    def test_product_str(self):
        """String representation should return the name."""
        product = Product.objects.create(
            sku="STR-001",
            name="Display Product",
            slug="display-product",
            price=Decimal("25.00"),
            stock=10,
            brand="Brand",
            category=self.category,
        )
        self.assertEqual(str(product), "Display Product")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ProductImageModelTests(TestCase):
    """Tests for the ProductImage model."""

    def setUp(self):
        self.category = Category.objects.create(
            name="Electronics", slug="electronics"
        )
        self.product = Product.objects.create(
            sku="IMG-001",
            name="Image Product",
            slug="image-product",
            price=Decimal("50.00"),
            stock=10,
            brand="Brand",
            category=self.category,
        )

    def test_create_image(self):
        """Creating a product image should succeed."""
        image = ProductImage.objects.create(
            product=self.product,
            image_url="https://example.com/image.jpg",
            is_primary=True,
            sort_order=0,
        )
        self.assertTrue(image.is_primary)
        self.assertEqual(image.sort_order, 0)

    def test_unique_primary_image_per_product(self):
        """Only one primary image per product is allowed."""
        ProductImage.objects.create(
            product=self.product,
            image_url="https://example.com/img1.jpg",
            is_primary=True,
            sort_order=0,
        )
        with self.assertRaises(IntegrityError):
            ProductImage.objects.create(
                product=self.product,
                image_url="https://example.com/img2.jpg",
                is_primary=True,
                sort_order=1,
            )

    def test_max_images_count(self):
        """A product should track image count correctly for limit enforcement."""
        for i in range(20):
            ProductImage.objects.create(
                product=self.product,
                image_url=f"https://example.com/img{i}.jpg",
                is_primary=False,
                sort_order=i,
            )
        # Verify 20 images exist
        count = ProductImage.objects.filter(product=self.product).count()
        self.assertEqual(count, 20)
        # The ProductCreateSerializer enforces max_length=20 for image_urls
        # at the API level, preventing more than 20 images per product
