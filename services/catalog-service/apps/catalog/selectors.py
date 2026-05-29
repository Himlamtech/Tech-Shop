"""
Selectors (read/query operations) for the Catalog Service.

Contains all query logic for products and categories, keeping views thin.
Uses select_related and prefetch_related for efficient database access.
"""

from django.db.models import Q

from apps.catalog.models import Category, Product, ProductImage


def get_product_list(filters: dict):
    """
    Return a filtered, sorted QuerySet of active products.

    Args:
        filters: Validated dict from ProductFilterSerializer containing:
            - search: keyword search (partial match on name, description, brand)
            - category: category slug filter
            - brand: brand name filter
            - min_price: minimum price
            - max_price: maximum price
            - min_rating: minimum average rating
            - sort: sort option (price_asc, price_desc, rating, newest)

    Returns:
        QuerySet of Product objects with category prefetched.
    """
    queryset = Product.objects.filter(status="active").select_related("category").prefetch_related("images")

    # Keyword search across name, description, brand
    search = filters.get("search")
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(description__icontains=search)
            | Q(brand__icontains=search)
        )

    # Category filter by slug
    category_slug = filters.get("category")
    if category_slug:
        # Include products from the category and its subcategories
        try:
            category = Category.objects.get(slug=category_slug, is_active=True)
            category_ids = _get_category_and_descendant_ids(category)
            queryset = queryset.filter(category_id__in=category_ids)
        except Category.DoesNotExist:
            queryset = queryset.none()

    # Brand filter
    brand = filters.get("brand")
    if brand:
        queryset = queryset.filter(brand__iexact=brand)

    # Price range filters
    min_price = filters.get("min_price")
    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)

    max_price = filters.get("max_price")
    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)

    # Minimum rating filter
    min_rating = filters.get("min_rating")
    if min_rating is not None:
        queryset = queryset.filter(rating_avg__gte=min_rating)

    # Sorting
    sort = filters.get("sort", "newest")
    sort_mapping = {
        "price_asc": "price",
        "price_desc": "-price",
        "rating": "-rating_avg",
        "newest": "-created_at",
    }
    queryset = queryset.order_by(sort_mapping.get(sort, "-created_at"))

    return queryset


def get_product_detail(product_id):
    """
    Return a single active product with prefetched images and category.

    Args:
        product_id: UUID of the product.

    Returns:
        Product instance or None if not found/inactive.
    """
    try:
        return (
            Product.objects.select_related("category")
            .prefetch_related("images")
            .get(id=product_id, status="active")
        )
    except Product.DoesNotExist:
        return None


def get_categories_tree():
    """
    Return root-level active categories with nested children.

    Returns:
        QuerySet of root Category objects (level=1, is_active=True)
        with children prefetched.
    """
    return (
        Category.objects.filter(is_active=True, level=1)
        .prefetch_related("children", "children__children")
        .order_by("name")
    )


def get_products_by_category(category_slug):
    """
    Return active products belonging to a category and all its subcategories.

    Args:
        category_slug: Slug of the category.

    Returns:
        Tuple of (QuerySet of Products, Category instance) or (None, None) if not found.
    """
    try:
        category = Category.objects.get(slug=category_slug, is_active=True)
    except Category.DoesNotExist:
        return None, None

    category_ids = _get_category_and_descendant_ids(category)

    queryset = (
        Product.objects.filter(status="active", category_id__in=category_ids)
        .select_related("category")
        .prefetch_related("images")
        .order_by("-created_at")
    )

    return queryset, category


def validate_products_bulk(product_ids):
    """
    Validate a list of product IDs for availability (used by Cart/Order services).

    Args:
        product_ids: List of UUID strings.

    Returns:
        List of dicts with validation results per product:
        [
            {
                "product_id": "...",
                "valid": True/False,
                "name": "...",
                "price": "...",
                "stock": ...,
                "image_url": "...",
                "reason": None or "not_found" / "inactive" / "out_of_stock"
            }
        ]
    """
    results = []

    # Fetch all products in one query
    products = (
        Product.objects.filter(id__in=product_ids)
        .select_related("category")
        .prefetch_related("images")
    )
    product_map = {str(p.id): p for p in products}

    for pid in product_ids:
        pid_str = str(pid)
        product = product_map.get(pid_str)

        if product is None:
            results.append({
                "product_id": pid_str,
                "valid": False,
                "name": None,
                "price": None,
                "stock": None,
                "image_url": None,
                "reason": "not_found",
            })
        elif product.status != "active":
            results.append({
                "product_id": pid_str,
                "valid": False,
                "name": product.name,
                "price": str(product.price),
                "stock": product.stock,
                "image_url": _get_primary_image_url(product),
                "reason": "inactive",
            })
        elif product.stock <= 0:
            results.append({
                "product_id": pid_str,
                "valid": False,
                "name": product.name,
                "price": str(product.price),
                "stock": product.stock,
                "image_url": _get_primary_image_url(product),
                "reason": "out_of_stock",
            })
        else:
            results.append({
                "product_id": pid_str,
                "valid": True,
                "name": product.name,
                "price": str(product.price),
                "stock": product.stock,
                "image_url": _get_primary_image_url(product),
                "reason": None,
            })

    return results


# =============================================================================
# Private Helpers
# =============================================================================


def _get_category_and_descendant_ids(category):
    """
    Recursively collect IDs of a category and all its descendants.

    Args:
        category: Category instance.

    Returns:
        List of UUIDs including the category itself and all children/grandchildren.
    """
    ids = [category.id]
    children = Category.objects.filter(parent=category, is_active=True)
    for child in children:
        ids.append(child.id)
        grandchildren = Category.objects.filter(parent=child, is_active=True)
        for grandchild in grandchildren:
            ids.append(grandchild.id)
    return ids


def _get_primary_image_url(product):
    """Get the primary image URL for a product, or the first image, or None."""
    images = product.images.all()
    for img in images:
        if img.is_primary:
            return img.image_url
    if images:
        return images[0].image_url
    return None
