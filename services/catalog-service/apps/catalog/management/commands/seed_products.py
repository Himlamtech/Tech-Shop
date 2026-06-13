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
        "thumbnail": "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop",
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
        "thumbnail": "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=800&auto=format&fit=crop",
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
        "category": "Máy tính bảng",
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
        "category": "Máy tính bảng",
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
        "category": "Máy tính bảng",
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
    # ─── Tai nghe / Headphones & Earbuds ───
    {
        "sku": "AIRPODSP4-WHT",
        "name": "Apple AirPods Pro 4",
        "brand": "Apple",
        "category": "Tai nghe",
        "price": Decimal("7990000.00"),
        "stock": 45,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 312,
        "thumbnail": "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2",
        "images": [
            "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2",
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
        ],
        "description": "True wireless earbuds with industry-leading active noise cancellation, Transparency mode, and immersive Spatial Audio.",
        "attributes": {
            "driver": "Custom Apple H2 chip",
            "anc": "Active Noise Cancellation",
            "battery": "6h + 24h case",
            "connectivity": "Bluetooth 5.3",
            "water_resistance": "IP54",
        },
    },
    {
        "sku": "BUDS3PRO-BLK",
        "name": "Samsung Galaxy Buds3 Pro",
        "brand": "Samsung",
        "category": "Tai nghe",
        "price": Decimal("5490000.00"),
        "stock": 38,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 184,
        "thumbnail": "https://images.unsplash.com/photo-1631176093617-8bec83fd7d3f",
        "images": [
            "https://images.unsplash.com/photo-1631176093617-8bec83fd7d3f",
            "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2",
        ],
        "description": "Premium Galaxy earbuds with intelligent ANC, blade-style design, and seamless Galaxy ecosystem integration.",
        "attributes": {
            "driver": "11mm two-way",
            "anc": "360 Audio with Dolby Atmos",
            "battery": "6h + 21h case",
            "connectivity": "Bluetooth 5.4",
            "water_resistance": "IPX7",
        },
    },
    {
        "sku": "RDMI-BUDS5-BLU",
        "name": "Xiaomi Redmi Buds 5 Pro",
        "brand": "Xiaomi",
        "category": "Tai nghe",
        "price": Decimal("1990000.00"),
        "stock": 60,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 97,
        "thumbnail": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
        "images": [
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
            "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b",
        ],
        "description": "Affordable ANC earbuds with Hi-Res Audio certification, long battery life, and comfortable ergonomic fit.",
        "attributes": {
            "driver": "11mm dynamic",
            "anc": "46dB ANC",
            "battery": "9h + 28h case",
            "connectivity": "Bluetooth 5.4",
            "water_resistance": "IP54",
        },
    },
    {
        "sku": "ENCO-X3-WHT",
        "name": "OPPO Enco X3",
        "brand": "OPPO",
        "category": "Tai nghe",
        "price": Decimal("2990000.00"),
        "stock": 25,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 56,
        "thumbnail": "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2",
        "images": [
            "https://images.unsplash.com/photo-1606741965326-cb990ae01bb2",
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
        ],
        "description": "Premium TWS earbuds co-developed with Dynaudio, offering exceptional sound quality and ANC performance.",
        "attributes": {
            "driver": "11mm + 6mm dual driver",
            "anc": "Adaptive ANC up to 50dB",
            "battery": "7h + 27h case",
            "connectivity": "Bluetooth 5.4",
            "water_resistance": "IP54",
        },
    },
    {
        "sku": "WH1000XM6-BLK",
        "name": "Sony WH-1000XM6",
        "brand": "Sony",
        "category": "Tai nghe",
        "price": Decimal("9490000.00"),
        "stock": 18,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 241,
        "thumbnail": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
        "images": [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
            "https://images.unsplash.com/photo-1583394838336-acd977736f90",
        ],
        "description": "Industry-leading over-ear headphones with AI-powered noise cancellation and 30-hour battery life.",
        "attributes": {
            "driver": "30mm dynamic",
            "anc": "Auto NC Optimizer",
            "battery": "30h with ANC",
            "connectivity": "Bluetooth 5.3, 3.5mm",
            "codec": "LDAC, AAC, SBC",
        },
    },
    {
        "sku": "BUDS-A3S-BLK",
        "name": "Xiaomi Buds A3S",
        "brand": "Xiaomi",
        "category": "Tai nghe",
        "price": Decimal("790000.00"),
        "stock": 80,
        "status": "active",
        "rating_avg": Decimal("4.3"),
        "rating_count": 145,
        "thumbnail": "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b",
        "images": [
            "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b",
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
        ],
        "description": "Entry-level TWS earbuds with clear sound, 28h total battery and lightweight design for everyday use.",
        "attributes": {
            "driver": "10mm dynamic",
            "battery": "7h + 21h case",
            "connectivity": "Bluetooth 5.3",
            "water_resistance": "IP54",
        },
    },
    # ─── Sạc điện thoại / Chargers ───
    {
        "sku": "APPLE-67W-MAGSAFE",
        "name": "Apple MagSafe Charger 25W",
        "brand": "Apple",
        "category": "Sạc điện thoại",
        "price": Decimal("1190000.00"),
        "stock": 120,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 88,
        "thumbnail": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        "images": [
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        ],
        "description": "Official Apple MagSafe charger delivering 25W wireless charging for iPhone 16 series and later.",
        "attributes": {
            "power": "25W max",
            "type": "MagSafe wireless",
            "compatibility": "iPhone 12 and later",
            "cable_length": "1m USB-C",
        },
    },
    {
        "sku": "SAMSUNG-65W-PD",
        "name": "Samsung 65W Super Fast Charger",
        "brand": "Samsung",
        "category": "Sạc điện thoại",
        "price": Decimal("890000.00"),
        "stock": 95,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 67,
        "thumbnail": "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        "images": [
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        ],
        "description": "Official Samsung 65W PD charger for Galaxy S series and compatible USB-C devices.",
        "attributes": {
            "power": "65W PD",
            "ports": "1x USB-C",
            "protocol": "Super Fast Charging 2.0",
            "compatibility": "Galaxy S22+ and later",
        },
    },
    {
        "sku": "XIAOMI-120W-GAN",
        "name": "Xiaomi 120W GaN Charger",
        "brand": "Xiaomi",
        "category": "Sạc điện thoại",
        "price": Decimal("690000.00"),
        "stock": 75,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 203,
        "thumbnail": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        "images": [
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        ],
        "description": "Compact GaN charger with 120W output supporting Xiaomi HyperCharge and universal PD fast charging.",
        "attributes": {
            "power": "120W",
            "type": "GaN wired",
            "ports": "2x USB-C + 1x USB-A",
            "size": "Compact travel-friendly",
        },
    },
    {
        "sku": "OPPO-80W-SUPERVOOC",
        "name": "OPPO 80W SUPERVOOC Charger",
        "brand": "OPPO",
        "category": "Sạc điện thoại",
        "price": Decimal("490000.00"),
        "stock": 55,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 78,
        "thumbnail": "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        "images": [
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        ],
        "description": "Official OPPO SUPERVOOC 80W charger that charges compatible phones from 0 to 100% in about 30 minutes.",
        "attributes": {
            "power": "80W",
            "protocol": "SUPERVOOC",
            "compatibility": "OPPO, OnePlus, Realme",
            "cable": "USB-C cable included",
        },
    },
    {
        "sku": "ANKER-GAN-100W",
        "name": "Anker 100W GaN Prime Charger",
        "brand": "Anker",
        "category": "Sạc điện thoại",
        "price": Decimal("1190000.00"),
        "stock": 40,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 134,
        "thumbnail": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        "images": [
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        ],
        "description": "Universal 100W GaN charger with 3 ports, intelligent power distribution for laptop, phone, and tablet.",
        "attributes": {
            "power": "100W total",
            "type": "GaN III",
            "ports": "2x USB-C + 1x USB-A",
            "smart_detection": "Dynamic Power Distribution",
        },
    },
    # ─── Sạc dự phòng / Power Banks ───
    {
        "sku": "XIAOMI-PB-30000",
        "name": "Xiaomi 30000mAh Power Bank 3",
        "brand": "Xiaomi",
        "category": "Sạc dự phòng",
        "price": Decimal("1390000.00"),
        "stock": 48,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 189,
        "thumbnail": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
        "images": [
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        ],
        "description": "High-capacity 30000mAh power bank with 33W fast charge support and dual USB-C ports.",
        "attributes": {
            "capacity": "30000mAh",
            "output": "33W max (USB-C)",
            "ports": "2x USB-C + 1x USB-A",
            "weight": "630g",
        },
    },
    {
        "sku": "SAMSUNG-PB-25W-20K",
        "name": "Samsung 25W Wireless Power Bank 20000mAh",
        "brand": "Samsung",
        "category": "Sạc dự phòng",
        "price": Decimal("1890000.00"),
        "stock": 30,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 76,
        "thumbnail": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
        "images": [
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        ],
        "description": "Samsung power bank with Qi wireless charging, 25W PD, and sleek Galaxy design language.",
        "attributes": {
            "capacity": "20000mAh",
            "wireless": "15W Qi wireless output",
            "wired_output": "25W USB-C PD",
            "weight": "445g",
        },
    },
    {
        "sku": "ANKER-737-PB-26K",
        "name": "Anker 737 Power Bank 26800mAh",
        "brand": "Anker",
        "category": "Sạc dự phòng",
        "price": Decimal("2290000.00"),
        "stock": 22,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 108,
        "thumbnail": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
        "images": [
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        ],
        "description": "Premium 140W power bank with digital display, capable of fast-charging a laptop from 0 to 50% in 40 minutes.",
        "attributes": {
            "capacity": "26800mAh",
            "output": "140W max (USB-C)",
            "ports": "2x USB-C + 1x USB-A",
            "display": "Smart display showing wattage and charge %",
        },
    },
    {
        "sku": "XIAOMI-PB-M3-10K",
        "name": "Xiaomi Magnetic Wireless Power Bank 10000mAh",
        "brand": "Xiaomi",
        "category": "Sạc dự phòng",
        "price": Decimal("890000.00"),
        "stock": 65,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 143,
        "thumbnail": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
        "images": [
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
            "https://images.unsplash.com/photo-1601612628452-9e99ced43524",
        ],
        "description": "Slim magnetic wireless power bank compatible with MagSafe iPhone, featuring 10W wireless output.",
        "attributes": {
            "capacity": "10000mAh",
            "wireless": "10W MagSafe-compatible",
            "wired_output": "18W USB-C",
            "thickness": "15mm",
        },
    },
    {
        "sku": "OPPO-PB-80W-20K",
        "name": "OPPO 80W Power Bank 20000mAh",
        "brand": "OPPO",
        "category": "Sạc dự phòng",
        "price": Decimal("1290000.00"),
        "stock": 28,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 52,
        "thumbnail": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
        "images": [
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5",
            "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28",
        ],
        "description": "High-speed OPPO SUPERVOOC power bank delivering 80W to compatible devices and 18W PD for universal use.",
        "attributes": {
            "capacity": "20000mAh",
            "output": "80W SUPERVOOC",
            "universal": "18W USB-C PD",
            "ports": "1x USB-C + 1x USB-A",
        },
    },
    # ─── More Tablets ───
    {
        "sku": "OPPO-PAD3-256-GRY",
        "name": "OPPO Pad 3 256GB",
        "brand": "OPPO",
        "category": "Máy tính bảng",
        "price": Decimal("12990000.00"),
        "stock": 18,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 34,
        "thumbnail": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        "images": [
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
            "https://images.unsplash.com/photo-1587033411391-5d9e51cce126",
        ],
        "description": "Versatile Android tablet with 144Hz OLED display, stylus support, and 67W SuperVOOC charging.",
        "attributes": {
            "storage": "256GB",
            "display": "12.1-inch OLED 144Hz",
            "chip": "Dimensity 9300",
            "battery": "9510mAh 67W SUPERVOOC",
            "accessories": "Stylus support",
        },
    },
    {
        "sku": "RDMI-PAD7-256-BLU",
        "name": "Xiaomi Redmi Pad SE2 256GB",
        "brand": "Xiaomi",
        "category": "Máy tính bảng",
        "price": Decimal("8490000.00"),
        "stock": 35,
        "status": "active",
        "rating_avg": Decimal("4.4"),
        "rating_count": 61,
        "thumbnail": "https://images.unsplash.com/photo-1561154464-82e9adf32764",
        "images": [
            "https://images.unsplash.com/photo-1561154464-82e9adf32764",
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        ],
        "description": "Budget-friendly Redmi tablet with 90Hz display, solid battery, and lightweight aluminum design.",
        "attributes": {
            "storage": "256GB",
            "display": "11-inch 90Hz IPS LCD",
            "chip": "Snapdragon 680",
            "battery": "8000mAh",
            "color": "Graphite Blue",
        },
    },
    {
        "sku": "TABS10-256-SLV",
        "name": "Samsung Galaxy Tab S10 256GB",
        "brand": "Samsung",
        "category": "Máy tính bảng",
        "price": Decimal("22990000.00"),
        "stock": 14,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 58,
        "thumbnail": "https://images.unsplash.com/photo-1589739900243-4b52cd9dd4d8",
        "images": [
            "https://images.unsplash.com/photo-1589739900243-4b52cd9dd4d8",
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        ],
        "description": "Flagship Samsung tablet with Dynamic AMOLED display, S Pen, and Galaxy AI productivity features.",
        "attributes": {
            "storage": "256GB",
            "display": "11-inch Dynamic AMOLED 120Hz",
            "chip": "Snapdragon 8 Gen 3",
            "battery": "8000mAh 45W",
            "accessories": "S Pen included",
        },
    },
    {
        "sku": "IPAD-AIR-M3-128",
        "name": "iPad Air 11 M3 128GB",
        "brand": "Apple",
        "category": "Máy tính bảng",
        "price": Decimal("20990000.00"),
        "stock": 20,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 95,
        "thumbnail": "https://images.unsplash.com/photo-1587033411391-5d9e51cce126",
        "images": [
            "https://images.unsplash.com/photo-1587033411391-5d9e51cce126",
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
        ],
        "description": "Thin and powerful iPad Air with M3 chip, Liquid Retina display, and Apple Pencil Pro support.",
        "attributes": {
            "storage": "128GB",
            "display": "11-inch Liquid Retina",
            "chip": "Apple M3",
            "battery": "All-day battery",
            "accessories": "Apple Pencil Pro compatible",
        },
    },
    # ─── More Smartphones ───
    {
        "sku": "OPPO-F27PRO-256-BLK",
        "name": "OPPO Find X8 Pro 256GB",
        "brand": "OPPO",
        "category": "Smartphones",
        "price": Decimal("29990000.00"),
        "stock": 18,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 82,
        "thumbnail": "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1567581935884-3349723552ca?w=800&auto=format&fit=crop",
        ],
        "description": "OPPO flagship with Hasselblad periscope camera, ultra-fast charging, and premium build quality.",
        "attributes": {
            "storage": "256GB", "color": "Black", "display": "6.78-inch AMOLED 120Hz",
            "chip": "Dimensity 9400", "camera": "50MP triple Hasselblad", "battery": "5910mAh 80W",
        },
    },
    {
        "sku": "REALME-GT7PRO-512",
        "name": "Realme GT 7 Pro 512GB",
        "brand": "Realme",
        "category": "Smartphones",
        "price": Decimal("21990000.00"),
        "stock": 22,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 55,
        "thumbnail": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop",
        ],
        "description": "Performance flagship with Snapdragon 8 Elite, massive 6000mAh battery, and 120W ultra-fast charging.",
        "attributes": {
            "storage": "512GB", "display": "6.78-inch LTPO AMOLED 120Hz",
            "chip": "Snapdragon 8 Elite", "battery": "6000mAh 120W", "camera": "50MP triple",
        },
    },
    {
        "sku": "VIVO-X200PRO-512",
        "name": "Vivo X200 Pro 512GB",
        "brand": "Vivo",
        "category": "Smartphones",
        "price": Decimal("27990000.00"),
        "stock": 12,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 48,
        "thumbnail": "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1567581935884-3349723552ca?w=800&auto=format&fit=crop",
        ],
        "description": "Zeiss-tuned camera flagship with a 1-inch main sensor, exceptional low-light photography, and 90W charging.",
        "attributes": {
            "storage": "512GB", "display": "6.78-inch LTPO AMOLED",
            "chip": "Dimensity 9400", "camera": "50MP 1-inch Zeiss main", "battery": "6000mAh 90W",
        },
    },
    {
        "sku": "SGS24FE-256-GRN",
        "name": "Samsung Galaxy S24 FE 256GB",
        "brand": "Samsung",
        "category": "Smartphones",
        "price": Decimal("14990000.00"),
        "stock": 30,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 138,
        "thumbnail": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop",
        ],
        "description": "Galaxy AI at a mid-range price — great AMOLED display, versatile camera, and Samsung ecosystem integration.",
        "attributes": {
            "storage": "256GB", "color": "Green", "display": "6.7-inch Dynamic AMOLED 120Hz",
            "chip": "Exynos 2500", "camera": "50MP triple", "battery": "4700mAh 45W",
        },
    },
    {
        "sku": "XM14T-256-BLU",
        "name": "Xiaomi 14T 256GB",
        "brand": "Xiaomi",
        "category": "Smartphones",
        "price": Decimal("16990000.00"),
        "stock": 25,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 76,
        "thumbnail": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop",
        ],
        "description": "Mid-range Xiaomi with Leica-tuned cameras, clean HyperOS, and strong all-day battery.",
        "attributes": {
            "storage": "256GB", "color": "Titan Blue", "display": "6.67-inch AMOLED 144Hz",
            "chip": "Dimensity 8300-Ultra", "camera": "50MP Leica triple", "battery": "5000mAh 67W",
        },
    },
    # ─── More Laptops ───
    {
        "sku": "LENOVO-SLIM5-512",
        "name": "Lenovo IdeaPad Slim 5 512GB",
        "brand": "Lenovo",
        "category": "Laptops",
        "price": Decimal("19990000.00"),
        "stock": 14,
        "status": "active",
        "rating_avg": Decimal("4.4"),
        "rating_count": 67,
        "thumbnail": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop",
        ],
        "description": "Affordable thin-and-light laptop for students and everyday productivity with solid build quality.",
        "attributes": {
            "ram": "16GB", "storage": "512GB SSD", "display": "15.3-inch IPS FHD",
            "chip": "AMD Ryzen 7 8745H", "weight": "1.6kg", "battery": "15h",
        },
    },
    {
        "sku": "HP-ENVY16-1TB",
        "name": "HP Envy 16 1TB OLED",
        "brand": "HP",
        "category": "Laptops",
        "price": Decimal("38990000.00"),
        "stock": 8,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 41,
        "thumbnail": "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop",
        ],
        "description": "Premium HP creator laptop with OLED touch display, strong GPU, and excellent speakers for creative work.",
        "attributes": {
            "ram": "32GB DDR5", "storage": "1TB SSD", "display": "16-inch OLED 120Hz touch",
            "chip": "Intel Core Ultra 7 155H", "gpu": "NVIDIA RTX 4060", "weight": "2.1kg",
        },
    },
    {
        "sku": "ACER-SWIFT14-AI-512",
        "name": "Acer Swift 14 AI 512GB",
        "brand": "Acer",
        "category": "Laptops",
        "price": Decimal("23990000.00"),
        "stock": 11,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 29,
        "thumbnail": "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop",
        ],
        "description": "Copilot+ laptop optimized for AI workloads with long battery life and a sleek aluminum chassis.",
        "attributes": {
            "ram": "16GB LPDDR5X", "storage": "512GB SSD", "display": "14-inch 2.8K OLED",
            "chip": "Snapdragon X Elite", "weight": "1.38kg", "battery": "18h",
        },
    },
    # ─── Đồng hồ thông minh / Smartwatches ───
    {
        "sku": "AW-SERIES10-45-BLK",
        "name": "Apple Watch Series 10 45mm",
        "brand": "Apple",
        "category": "Đồng hồ thông minh",
        "price": Decimal("12990000.00"),
        "stock": 25,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 215,
        "thumbnail": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop",
        ],
        "description": "Thinnest Apple Watch ever with a larger Always-On display, advanced health sensors, and Apple Intelligence.",
        "attributes": {
            "display": "45mm Always-On Retina", "chip": "S10", "health": "ECG, SpO2, temperature",
            "battery": "18h", "water_resistance": "50m", "connectivity": "GPS + Cellular",
        },
    },
    {
        "sku": "AW-ULTRA2-49-TIT",
        "name": "Apple Watch Ultra 2 49mm",
        "brand": "Apple",
        "category": "Đồng hồ thông minh",
        "price": Decimal("23990000.00"),
        "stock": 10,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 87,
        "thumbnail": "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
        ],
        "description": "Built for extreme sports and adventure — titanium case, dual GPS, 60h battery, and depth sensor.",
        "attributes": {
            "display": "49mm micro-LED Always-On", "chip": "S9", "health": "ECG, SpO2, depth gauge",
            "battery": "60h Low Power Mode", "water_resistance": "100m", "build": "Titanium",
        },
    },
    {
        "sku": "SGW7-47-SLV",
        "name": "Samsung Galaxy Watch 7 47mm",
        "brand": "Samsung",
        "category": "Đồng hồ thông minh",
        "price": Decimal("8490000.00"),
        "stock": 30,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 143,
        "thumbnail": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
        ],
        "description": "Galaxy AI-powered watch with advanced sleep coaching, body composition analysis, and long battery life.",
        "attributes": {
            "display": "47mm Super AMOLED", "chip": "Exynos W1000", "health": "BioActive Sensor, ECG",
            "battery": "3 days", "water_resistance": "5ATM + IP68", "os": "Wear OS + One UI Watch 6",
        },
    },
    {
        "sku": "SGWULTRA-47-GRY",
        "name": "Samsung Galaxy Watch Ultra 47mm",
        "brand": "Samsung",
        "category": "Đồng hồ thông minh",
        "price": Decimal("13990000.00"),
        "stock": 15,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 62,
        "thumbnail": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop",
        ],
        "description": "Samsung's toughest watch with titanium body, dual GPS, 60h battery, and comprehensive adventure tracking.",
        "attributes": {
            "display": "47mm Super AMOLED", "health": "BioActive + ECG + altitude",
            "battery": "60h endurance mode", "build": "Titanium Grade 4",
            "water_resistance": "10ATM", "os": "Wear OS + One UI Watch 6",
        },
    },
    {
        "sku": "XM-W3-BLK",
        "name": "Xiaomi Watch S4 Sport",
        "brand": "Xiaomi",
        "category": "Đồng hồ thông minh",
        "price": Decimal("3990000.00"),
        "stock": 40,
        "status": "active",
        "rating_avg": Decimal("4.5"),
        "rating_count": 98,
        "thumbnail": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
        ],
        "description": "Feature-rich sport smartwatch with AMOLED display, GPS, 150+ workout modes, and 15-day battery.",
        "attributes": {
            "display": "1.43-inch AMOLED", "health": "SpO2, heart rate, stress",
            "battery": "15 days typical", "gps": "GPS + GLONASS",
            "water_resistance": "5ATM", "sports": "150+ modes",
        },
    },
    {
        "sku": "OPPO-WATCH4PRO-BLK",
        "name": "OPPO Watch 4 Pro",
        "brand": "OPPO",
        "category": "Đồng hồ thông minh",
        "price": Decimal("6490000.00"),
        "stock": 18,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 44,
        "thumbnail": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop",
        ],
        "description": "Premium OPPO smartwatch with Snapdragon W5+ chip, eSIM calling, and stylish rectangular design.",
        "attributes": {
            "display": "1.91-inch LTPO AMOLED", "chip": "Snapdragon W5+",
            "health": "ECG, SpO2, temperature", "battery": "4 days",
            "connectivity": "eSIM + Bluetooth 5.3", "os": "Wear OS 4",
        },
    },
    # ─── Cáp & Hub ───
    {
        "sku": "ANKER-HUB-7IN1",
        "name": "Anker 7-in-1 USB-C Hub",
        "brand": "Anker",
        "category": "Cáp & Hub",
        "price": Decimal("890000.00"),
        "stock": 55,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 312,
        "thumbnail": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
        ],
        "description": "Compact 7-in-1 USB-C hub with 4K HDMI, 100W PD, USB-A 3.0, SD and microSD card readers.",
        "attributes": {
            "ports": "HDMI 4K60 + 2x USB-A 3.0 + 2x USB-C + SD + microSD",
            "power_delivery": "100W PD passthrough",
            "hdmi": "4K@60Hz",
            "compatibility": "MacBook, iPad Pro, Windows laptops",
        },
    },
    {
        "sku": "CABLE-USBC-240W-2M",
        "name": "Anker USB-C 240W Cable 2m",
        "brand": "Anker",
        "category": "Cáp & Hub",
        "price": Decimal("390000.00"),
        "stock": 100,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 445,
        "thumbnail": "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        ],
        "description": "240W rated braided USB-C cable supporting fast charging for laptops, tablets, and phones.",
        "attributes": {
            "power": "240W max", "length": "2 meters",
            "data": "USB 3.2 Gen 2 (10Gbps)", "build": "Braided nylon",
        },
    },
    {
        "sku": "CABLE-LIGHTNING-MFI-1M",
        "name": "Apple MFi Lightning Cable 1m",
        "brand": "Apple",
        "category": "Cáp & Hub",
        "price": Decimal("490000.00"),
        "stock": 80,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 188,
        "thumbnail": "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        ],
        "description": "Official Apple MFi-certified Lightning cable, compatible with all Lightning iPhones and accessories.",
        "attributes": {
            "length": "1 meter", "connector": "Lightning to USB-C",
            "certification": "Apple MFi", "compatibility": "iPhone 5 to 15",
        },
    },
    {
        "sku": "HUB-THUNDERBOLT4-CALDIGIT",
        "name": "CalDigit TS4 Thunderbolt 4 Hub",
        "brand": "CalDigit",
        "category": "Cáp & Hub",
        "price": Decimal("5990000.00"),
        "stock": 10,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 76,
        "thumbnail": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
        ],
        "description": "Pro-grade Thunderbolt 4 hub with 18 ports, 98W charging, and 40Gbps throughput for creative professionals.",
        "attributes": {
            "ports": "3x TB4 + 5x USB-A + 3x USB-C + SD + audio + ethernet",
            "power": "98W host charging", "data": "40Gbps Thunderbolt 4",
            "display": "Dual 4K or single 8K", "compatibility": "macOS + Windows",
        },
    },
    {
        "sku": "CABLE-XIAOMI-120W-1M",
        "name": "Xiaomi 120W HyperCharge Cable 1m",
        "brand": "Xiaomi",
        "category": "Cáp & Hub",
        "price": Decimal("190000.00"),
        "stock": 150,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 523,
        "thumbnail": "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1625480859986-76e32cdc26c1?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        ],
        "description": "Official Xiaomi 120W certified USB-C cable designed for HyperCharge and compatible with universal PD.",
        "attributes": {
            "power": "120W certified", "length": "1 meter",
            "connector": "USB-C to USB-C", "build": "Kevlar-reinforced",
        },
    },
    # ─── Phụ kiện / Accessories ───
    {
        "sku": "CASE-IPH17PM-MAGSAFE-CLR",
        "name": "Apple MagSafe Clear Case iPhone 17 Pro Max",
        "brand": "Apple",
        "category": "Phụ kiện",
        "price": Decimal("1290000.00"),
        "stock": 60,
        "status": "active",
        "rating_avg": Decimal("4.6"),
        "rating_count": 234,
        "thumbnail": "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop",
        ],
        "description": "Official Apple MagSafe Clear Case — shows off iPhone's titanium design while adding MagSafe accessory support.",
        "attributes": {
            "compatibility": "iPhone 17 Pro Max",
            "material": "Polycarbonate",
            "feature": "MagSafe compatible",
            "protection": "Scratch-resistant coating",
        },
    },
    {
        "sku": "CASE-SGS25U-LEATHER-BLK",
        "name": "Spigen Leather Case Galaxy S25 Ultra",
        "brand": "Spigen",
        "category": "Phụ kiện",
        "price": Decimal("590000.00"),
        "stock": 45,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 167,
        "thumbnail": "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop",
        ],
        "description": "Premium genuine leather folio case with S Pen slot, card pockets, and precise cutouts for Galaxy S25 Ultra.",
        "attributes": {
            "compatibility": "Galaxy S25 Ultra",
            "material": "Genuine leather",
            "feature": "S Pen holder, card slots",
            "protection": "Military-grade drop protection",
        },
    },
    {
        "sku": "KBRD-MAGIC-MX-WHT",
        "name": "Apple Magic Keyboard with Touch ID",
        "brand": "Apple",
        "category": "Phụ kiện",
        "price": Decimal("2990000.00"),
        "stock": 30,
        "status": "active",
        "rating_avg": Decimal("4.8"),
        "rating_count": 128,
        "thumbnail": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop",
        ],
        "description": "Slim wireless keyboard with Touch ID sensor, scissor-switch keys, and seamless Apple device pairing.",
        "attributes": {
            "connectivity": "Bluetooth + USB-C", "feature": "Touch ID fingerprint",
            "battery": "1 month per charge", "compatibility": "Mac, iPad",
        },
    },
    {
        "sku": "MOUSE-MX-MASTER3S-BLK",
        "name": "Logitech MX Master 3S",
        "brand": "Logitech",
        "category": "Phụ kiện",
        "price": Decimal("2190000.00"),
        "stock": 35,
        "status": "active",
        "rating_avg": Decimal("4.9"),
        "rating_count": 387,
        "thumbnail": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
        ],
        "description": "Best-in-class productivity mouse with MagSpeed wheel, 8K DPI, and Logi Bolt USB receiver for multi-device.",
        "attributes": {
            "dpi": "200–8000 DPI", "connectivity": "Logi Bolt + Bluetooth",
            "battery": "70 days", "devices": "Connect up to 3", "scroll": "MagSpeed electromagnetic",
        },
    },
    {
        "sku": "STAND-MOPHIE-3IN1",
        "name": "mophie 3-in-1 MagSafe Charging Stand",
        "brand": "mophie",
        "category": "Phụ kiện",
        "price": Decimal("1990000.00"),
        "stock": 22,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 93,
        "thumbnail": "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
        ],
        "description": "3-in-1 wireless charging stand for iPhone (MagSafe), Apple Watch, and AirPods simultaneously.",
        "attributes": {
            "charging": "MagSafe 15W + Apple Watch fast + Qi 5W",
            "devices": "iPhone + Apple Watch + AirPods",
            "compatibility": "iPhone 12+, Apple Watch all series",
            "power_supply": "30W adapter included",
        },
    },
    {
        "sku": "SCREEN-SPIGEN-IPH17PM",
        "name": "Spigen GLAS.tR EZ Fit iPhone 17 Pro Max",
        "brand": "Spigen",
        "category": "Phụ kiện",
        "price": Decimal("290000.00"),
        "stock": 120,
        "status": "active",
        "rating_avg": Decimal("4.7"),
        "rating_count": 512,
        "thumbnail": "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop",
        "images": [
            "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1601972599748-46cfe36ea887?w=800&auto=format&fit=crop",
        ],
        "description": "9H tempered glass screen protector with EZ tray alignment frame for bubble-free installation.",
        "attributes": {
            "compatibility": "iPhone 17 Pro Max",
            "hardness": "9H tempered glass",
            "feature": "EZ alignment frame, 2-pack",
            "clarity": "99.99% transparency",
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
                "name": category_name,
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
