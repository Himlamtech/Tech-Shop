"""
Management command to seed products into the catalog database.

Usage:
    python manage.py seed_products
    python manage.py seed_products --source dummyjson --limit 50
    python manage.py seed_products --source showroom
"""

import sys
from decimal import Decimal

import requests
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.catalog.models import Category, Product, ProductImage

DUMMYJSON_API_URL = "https://dummyjson.com/products"
DEFAULT_LIMIT = 30
MIN_LIMIT = 1
MAX_LIMIT = 194
REQUEST_TIMEOUT = 30
VND_MULTIPLIER = 1_000_000

SHOWROOM_PRODUCTS = [
    {
        "sku": "IPH17PM-256-BLK",
        "name": "iPhone 17 Pro Max 256GB",
        "brand": "Apple",
        "category": "Smartphones",
        "price": Decimal("39990000.00"),
        "stock": 15,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 128,
        "thumbnail": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
        "images": [
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
            "https://images.unsplash.com/photo-1592750475338-74b7b21085ab",
        ],
        "description": "Flagship iPhone with titanium frame, A19 Pro-class performance, pro camera system, and all-day battery tuned for premium users.",
        "attributes": {
            "storage": "256GB",
            "color": "Titan Black",
            "display": "6.9-inch LTPO OLED 120Hz",
            "chip": "Apple A19 Pro",
            "camera": "48MP + 48MP ultrawide + periscope telephoto",
            "battery": "5100mAh",
        },
    },
    {
        "sku": "IPH17AIR-256-GRY",
        "name": "iPhone 17 Air 256GB",
        "brand": "Apple",
        "category": "Smartphones",
        "price": Decimal("31990000.00"),
        "stock": 18,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 64,
        "thumbnail": "https://images.unsplash.com/photo-1567581935884-3349723552ca",
        "images": [
            "https://images.unsplash.com/photo-1567581935884-3349723552ca",
            "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5",
        ],
        "description": "A thinner premium iPhone focused on lightweight design, long battery life, and top-tier everyday performance.",
        "attributes": {
            "storage": "256GB",
            "color": "Graphite",
            "display": "6.6-inch OLED 120Hz",
            "chip": "Apple A19",
            "camera": "48MP Fusion",
            "battery": "4700mAh",
        },
    },
    {
        "sku": "XM17PRO-512-SLV",
        "name": "Xiaomi 17 Pro 512GB",
        "brand": "Xiaomi",
        "category": "Smartphones",
        "price": Decimal("24990000.00"),
        "stock": 20,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 91,
        "thumbnail": "https://images.unsplash.com/photo-1598327105666-5b89351aff97",
        "images": [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97",
            "https://images.unsplash.com/photo-1580910051074-3eb694886505",
        ],
        "description": "Premium Xiaomi flagship with Leica-tuned cameras, fast charging, and Snapdragon-class performance for power users.",
        "attributes": {
            "storage": "512GB",
            "color": "Silver",
            "display": "6.8-inch AMOLED 120Hz",
            "chip": "Snapdragon 8 Elite",
            "camera": "50MP triple camera with 1-inch main sensor",
            "battery": "5400mAh",
        },
    },
    {
        "sku": "SGS25U-512-TI",
        "name": "Galaxy S25 Ultra 512GB",
        "brand": "Samsung",
        "category": "Smartphones",
        "price": Decimal("35990000.00"),
        "stock": 14,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 119,
        "thumbnail": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf",
        "images": [
            "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf",
            "https://images.unsplash.com/photo-1585060544812-6b45742d762f",
        ],
        "description": "Samsung ultra flagship with S Pen, advanced Galaxy AI features, and a versatile zoom camera system.",
        "attributes": {
            "storage": "512GB",
            "color": "Titanium Gray",
            "display": "6.8-inch Dynamic AMOLED 2X",
            "chip": "Snapdragon 8 Elite for Galaxy",
            "camera": "200MP main + periscope zoom",
            "battery": "5000mAh",
        },
    },
    {
        "sku": "SGFOLD8-512-NVY",
        "name": "Galaxy Z Fold 8 512GB",
        "brand": "Samsung",
        "category": "Smartphones",
        "price": Decimal("46990000.00"),
        "stock": 8,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 57,
        "thumbnail": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf",
        "images": [
            "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf",
            "https://images.unsplash.com/photo-1565849904461-04a58ad377e0",
        ],
        "description": "Foldable flagship built for multitasking, creators, and business users who want a tablet-like phone experience.",
        "attributes": {
            "storage": "512GB",
            "color": "Navy",
            "display": "7.9-inch foldable AMOLED + 6.5-inch cover display",
            "chip": "Snapdragon 8 Elite for Galaxy",
            "camera": "50MP triple camera",
            "battery": "4800mAh",
        },
    },
    {
        "sku": "PIX10PRO-256-OBS",
        "name": "Pixel 10 Pro 256GB",
        "brand": "Google",
        "category": "Smartphones",
        "price": Decimal("28990000.00"),
        "stock": 11,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 43,
        "thumbnail": "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd",
        "images": [
            "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd",
            "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c",
        ],
        "description": "Google flagship focused on clean Android, top computational photography, and AI-first user experience.",
        "attributes": {
            "storage": "256GB",
            "color": "Obsidian",
            "display": "6.7-inch LTPO OLED",
            "chip": "Google Tensor G5",
            "camera": "50MP main + advanced AI image stack",
            "battery": "5000mAh",
        },
    },
    {
        "sku": "OP13U-512-WHT",
        "name": "OnePlus 13 Ultra 512GB",
        "brand": "OnePlus",
        "category": "Smartphones",
        "price": Decimal("27990000.00"),
        "stock": 0,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 38,
        "thumbnail": "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2",
        "images": [
            "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2",
            "https://images.unsplash.com/photo-1583573636246-18cb2246697f",
        ],
        "description": "Performance-centric Android flagship with ultra-fast charging and an enthusiast-grade display.",
        "attributes": {
            "storage": "512GB",
            "color": "Arctic White",
            "display": "6.82-inch AMOLED 120Hz",
            "chip": "Snapdragon 8 Elite",
            "camera": "50MP triple Hasselblad-tuned setup",
            "battery": "5500mAh",
        },
    },
    {
        "sku": "MBPM5MAX-16-SLV",
        "name": "MacBook Pro 16 M5 Max",
        "brand": "Apple",
        "category": "Laptops",
        "price": Decimal("89990000.00"),
        "stock": 6,
        "status": "active",
        "rating_avg": Decimal("5.0"),
        "rating_count": 77,
        "thumbnail": "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
        "images": [
            "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        ],
        "description": "Top-end creator laptop with M5 Max silicon, mini-LED display, huge battery, and elite sustained performance.",
        "attributes": {
            "ram": "48GB unified memory",
            "storage": "1TB SSD",
            "display": "16.2-inch Liquid Retina XDR",
            "chip": "Apple M5 Max",
            "gpu": "40-core GPU",
            "weight": "2.1kg",
        },
    },
    {
        "sku": "MBA15M4-512-SKY",
        "name": "MacBook Air 15 M4 512GB",
        "brand": "Apple",
        "category": "Laptops",
        "price": Decimal("42990000.00"),
        "stock": 16,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 102,
        "thumbnail": "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
        "images": [
            "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        ],
        "description": "Thin and elegant laptop for productivity, travel, and all-day battery life with Apple silicon efficiency.",
        "attributes": {
            "ram": "16GB unified memory",
            "storage": "512GB SSD",
            "display": "15.3-inch Liquid Retina",
            "chip": "Apple M4",
            "weight": "1.5kg",
            "color": "Sky Blue",
        },
    },
    {
        "sku": "ASZ16AI-4070",
        "name": "ASUS ROG Zephyrus G16 AI RTX 5070",
        "brand": "ASUS",
        "category": "Laptops",
        "price": Decimal("65990000.00"),
        "stock": 9,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 52,
        "thumbnail": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        "images": [
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
            "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2",
        ],
        "description": "Premium gaming and creator laptop with RTX graphics, OLED screen, and AI acceleration for modern workflows.",
        "attributes": {
            "ram": "32GB LPDDR5X",
            "storage": "1TB SSD",
            "display": "16-inch OLED 240Hz",
            "chip": "Intel Core Ultra 9",
            "gpu": "NVIDIA GeForce RTX 5070",
            "weight": "1.95kg",
        },
    },
    {
        "sku": "XPS14U-1TB-PLT",
        "name": "Dell XPS 14 Ultra 1TB",
        "brand": "Dell",
        "category": "Laptops",
        "price": Decimal("54990000.00"),
        "stock": 7,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 34,
        "thumbnail": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        "images": [
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
            "https://images.unsplash.com/photo-1515879218367-8466d910aaa4",
        ],
        "description": "High-end Windows ultrabook with edge-to-edge design, OLED display, and strong portable productivity performance.",
        "attributes": {
            "ram": "32GB",
            "storage": "1TB SSD",
            "display": "14.5-inch OLED",
            "chip": "Intel Core Ultra 7",
            "gpu": "NVIDIA RTX 4050",
            "weight": "1.7kg",
        },
    },
    {
        "sku": "SURF7-512-PLT",
        "name": "Surface Laptop 7 512GB",
        "brand": "Microsoft",
        "category": "Laptops",
        "price": Decimal("38990000.00"),
        "stock": 5,
        "status": "inactive",
        "rating_avg": Decimal("4.5"),
        "rating_count": 21,
        "thumbnail": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        "images": [
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
            "https://images.unsplash.com/photo-1518770660439-4636190af475",
        ],
        "description": "Copilot+ PC focused on battery life and AI-assisted productivity in a premium thin-and-light form factor.",
        "attributes": {
            "ram": "16GB",
            "storage": "512GB SSD",
            "display": "13.8-inch PixelSense",
            "chip": "Snapdragon X Elite",
            "weight": "1.35kg",
        },
    },
    {
        "sku": "IPADM5-13-WHT",
        "name": "iPad Pro 13 M5",
        "brand": "Apple",
        "category": "Tablets",
        "price": Decimal("42990000.00"),
        "stock": 12,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 88,
        "thumbnail": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        "images": [
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
            "https://images.unsplash.com/photo-1587033411391-5d9e51cce126",
        ],
        "description": "Pro-grade tablet with OLED display, desktop-class chip, and premium accessory ecosystem for creatives.",
        "attributes": {
            "storage": "512GB",
            "display": "13-inch Ultra Retina XDR",
            "chip": "Apple M5",
            "camera": "12MP",
            "battery": "All-day battery",
            "connectivity": "Wi-Fi 7",
        },
    },
    {
        "sku": "TABS10U-512-GRY",
        "name": "Galaxy Tab S10 Ultra 512GB",
        "brand": "Samsung",
        "category": "Tablets",
        "price": Decimal("36990000.00"),
        "stock": 10,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 49,
        "thumbnail": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        "images": [
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
            "https://images.unsplash.com/photo-1589739900243-4b52cd9dd4d8",
        ],
        "description": "Large-screen Android tablet for entertainment, note-taking, and productivity with included S Pen support.",
        "attributes": {
            "storage": "512GB",
            "display": "14.6-inch AMOLED 120Hz",
            "chip": "Snapdragon 8 Gen Elite",
            "battery": "11200mAh",
            "accessories": "S Pen included",
        },
    },
    {
        "sku": "PAD7PRO-512-BLU",
        "name": "Xiaomi Pad 7 Pro 512GB",
        "brand": "Xiaomi",
        "category": "Tablets",
        "price": Decimal("18990000.00"),
        "stock": 22,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 27,
        "thumbnail": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        "images": [
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
            "https://images.unsplash.com/photo-1561154464-82e9adf32764",
        ],
        "description": "Value premium Android tablet with strong performance, solid speakers, and excellent price-to-spec ratio.",
        "attributes": {
            "storage": "512GB",
            "display": "12.1-inch 144Hz LCD",
            "chip": "Snapdragon 8s Gen 4",
            "battery": "10000mAh",
            "color": "Blue",
        },
    },
]


class Command(BaseCommand):
    help = "Seed products into the catalog database from curated showroom data or DummyJSON."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=DEFAULT_LIMIT,
            help=f"Number of products to fetch from DummyJSON (range {MIN_LIMIT}-{MAX_LIMIT}, default {DEFAULT_LIMIT})",
        )
        parser.add_argument(
            "--source",
            type=str,
            default="dummyjson",
            choices=["dummyjson", "showroom"],
            help='Data source to fetch from ("dummyjson" or "showroom")',
        )

    def handle(self, *args, **options):
        source = options["source"]
        limit = options["limit"]

        self.stdout.write(f"Seeding products from {source}...")

        if source == "dummyjson":
            if limit < MIN_LIMIT or limit > MAX_LIMIT:
                self.stderr.write(
                    self.style.ERROR(
                        f"Error: --limit must be between {MIN_LIMIT} and {MAX_LIMIT}. Got {limit}."
                    )
                )
                sys.exit(1)

            self._seed_from_dummyjson(limit)
            return

        self._seed_from_showroom()

    def _seed_from_showroom(self):
        created_count = 0
        updated_count = 0

        for item in SHOWROOM_PRODUCTS:
            result = self._upsert_curated_product(item)
            if result == "created":
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created_count}, Updated {updated_count} showroom products"
            )
        )

    def _seed_from_dummyjson(self, limit):
        url = f"{DUMMYJSON_API_URL}?limit={limit}"

        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.exceptions.ConnectionError:
            self.stderr.write(
                self.style.ERROR(
                    f"Error: Unable to connect to DummyJSON API at {DUMMYJSON_API_URL}. "
                    "Please check your network connection."
                )
            )
            sys.exit(1)
        except requests.exceptions.Timeout:
            self.stderr.write(
                self.style.ERROR(
                    f"Error: Request to DummyJSON API timed out after {REQUEST_TIMEOUT} seconds."
                )
            )
            sys.exit(1)
        except requests.exceptions.HTTPError as e:
            self.stderr.write(
                self.style.ERROR(
                    f"Error: DummyJSON API returned HTTP {e.response.status_code}."
                )
            )
            sys.exit(1)
        except requests.exceptions.RequestException as e:
            self.stderr.write(
                self.style.ERROR(
                    f"Error: Failed to fetch from DummyJSON API: {e}"
                )
            )
            sys.exit(1)

        data = response.json()
        products = data.get("products", [])

        if not products:
            self.stdout.write(self.style.WARNING("No products returned from API."))
            return

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for item in products:
            try:
                result = self._process_dummyjson_product(item)
                if result == "created":
                    created_count += 1
                elif result == "updated":
                    updated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                self.stderr.write(
                    self.style.WARNING(
                        f"Warning: Failed to process product '{item.get('title', 'unknown')}': {e}"
                    )
                )
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created_count}, Updated {updated_count}, Skipped {skipped_count} products"
            )
        )

    def _process_dummyjson_product(self, item):
        product_id = item.get("id")
        if product_id is None:
            return "skipped"

        sku = f"TECH-{product_id:04d}"
        category = self._get_or_create_category(item.get("category", "uncategorized"))
        name = item.get("title", "")[:255]
        slug = self._build_unique_slug(name, sku)

        payload = {
            "sku": sku,
            "name": name,
            "slug": slug,
            "description": item.get("description", "")[:5000],
            "price": item.get("price", 0) * VND_MULTIPLIER,
            "stock": min(item.get("stock", 0), 999999),
            "brand": item.get("brand", "Unknown")[:100],
            "category": category,
            "status": "active",
            "attributes": {
                "source": "dummyjson",
                "discount_percentage": item.get("discountPercentage"),
                "warranty_information": item.get("warrantyInformation"),
            },
            "rating_avg": self._normalize_rating(item.get("rating", 4.2)),
            "rating_count": int(item.get("reviews", []).__len__() if isinstance(item.get("reviews"), list) else 12),
        }

        existing_product = Product.objects.filter(sku=sku).first()
        if existing_product:
            self._update_product(existing_product, payload)
            self._sync_product_images(existing_product, item.get("thumbnail", ""), item.get("images", []))
            return "updated"

        product = Product.objects.create(**payload)
        self._sync_product_images(product, item.get("thumbnail", ""), item.get("images", []))
        return "created"

    def _upsert_curated_product(self, item):
        category = self._get_or_create_category(item["category"])
        sku = item["sku"]
        slug = self._build_unique_slug(item["name"], sku)

        payload = {
            "sku": sku,
            "name": item["name"],
            "slug": slug,
            "description": item["description"],
            "price": item["price"],
            "stock": item["stock"],
            "brand": item["brand"],
            "category": category,
            "status": item.get("status", "active"),
            "attributes": item.get("attributes") or {"source": "showroom"},
            "rating_avg": item.get("rating_avg", Decimal("4.7")),
            "rating_count": item.get("rating_count", 25),
        }

        existing_product = Product.objects.filter(sku=sku).first()
        if existing_product:
            self._update_product(existing_product, payload)
            self._sync_product_images(existing_product, item.get("thumbnail", ""), item.get("images", []))
            return "updated"

        product = Product.objects.create(**payload)
        self._sync_product_images(product, item.get("thumbnail", ""), item.get("images", []))
        return "created"

    def _get_or_create_category(self, category_name):
        slug = slugify(category_name)
        if not slug:
            slug = "uncategorized"
            category_name = "Uncategorized"

        category, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={
                "name": category_name.title(),
                "level": 1,
                "is_active": True,
            },
        )
        return category

    def _build_unique_slug(self, name, sku):
        slug = slugify(name)
        if Product.objects.filter(slug=slug).exclude(sku=sku).exists():
            return f"{slug}-{sku.lower()}"
        return slug

    def _update_product(self, product, payload):
        for field, value in payload.items():
            setattr(product, field, value)
        product.save()

    def _normalize_rating(self, rating):
        try:
            value = Decimal(str(rating))
        except Exception:
            return Decimal("4.2")

        if value < Decimal("0.0"):
            return Decimal("0.0")
        if value > Decimal("5.0"):
            return Decimal("5.0")
        return value.quantize(Decimal("0.1"))

    def _sync_product_images(self, product, thumbnail, images):
        ProductImage.objects.filter(product=product).delete()

        ordered_urls = []
        if thumbnail:
            ordered_urls.append(thumbnail)
        for img_url in images:
            if img_url and img_url not in ordered_urls:
                ordered_urls.append(img_url)

        for index, img_url in enumerate(ordered_urls[:20]):
            ProductImage.objects.create(
                product=product,
                image_url=img_url,
                is_primary=(index == 0),
                sort_order=index,
            )
