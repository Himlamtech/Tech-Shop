"""
Property-based tests for Cart Service.

Uses hypothesis to verify cart invariants across randomized inputs.
"""

import uuid
from unittest.mock import patch

from django.db import IntegrityError
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.cart.models import Cart, CartItem
from apps.cart.services import CartService
from apps.core.exceptions import ProductOutOfStockError


class CartProductConsistencyPropertyTest(TestCase):
    """
    Property 3: Cart-Product Consistency

    Verify that CartItem can only reference active, in-stock products at time of addition.
    Use hypothesis to generate random (stock, quantity) pairs and verify the constraint.

    **Validates: Requirements 7.1, 7.2**
    """

    def setUp(self):
        self.user_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())

    @given(
        stock=st.integers(min_value=0, max_value=999999),
        quantity=st.integers(min_value=1, max_value=99),
    )
    @settings(max_examples=50)
    def test_cart_item_only_added_when_product_active_and_in_stock(
        self, stock, quantity
    ):
        """
        For any (stock, quantity) pair:
        - If product is active AND quantity <= stock, add succeeds
        - If product is inactive OR quantity > stock, add is rejected
        """
        # Clean up from previous hypothesis iterations
        Cart.objects.filter(user_id=self.user_id).delete()

        service = CartService(authorization_header="Bearer test-token")

        # Case 1: Product is active and has sufficient stock
        if quantity <= stock and stock > 0:
            mock_response = {
                "data": [
                    {
                        "product_id": self.product_id,
                        "valid": True,
                        "name": "Test Product",
                        "price": "29.99",
                        "stock": stock,
                        "image_url": "http://example.com/img.jpg",
                    }
                ]
            }
            with patch.object(
                service._catalog_client, "post", return_value=mock_response
            ):
                result = service.add_item(self.user_id, self.product_id, quantity)
                # Verify item was added to cart
                self.assertTrue(len(result["items"]) > 0)
                added_item = next(
                    (i for i in result["items"] if i["product_id"] == self.product_id),
                    None,
                )
                self.assertIsNotNone(added_item)
                self.assertEqual(added_item["quantity"], quantity)

        # Case 2: Product is inactive or insufficient stock
        else:
            mock_response = {
                "data": [
                    {
                        "product_id": self.product_id,
                        "valid": False,
                        "reason": "out_of_stock",
                    }
                ]
            }
            with patch.object(
                service._catalog_client, "post", return_value=mock_response
            ):
                with self.assertRaises(ProductOutOfStockError):
                    service.add_item(self.user_id, self.product_id, quantity)

    @given(
        stock=st.integers(min_value=1, max_value=999999),
        quantity=st.integers(min_value=1, max_value=99),
    )
    @settings(max_examples=50)
    def test_cart_rejects_inactive_product(self, stock, quantity):
        """
        For any stock/quantity combination, if the product is inactive,
        the cart addition must be rejected regardless of stock level.
        """
        Cart.objects.filter(user_id=self.user_id).delete()

        service = CartService(authorization_header="Bearer test-token")

        mock_response = {
            "data": [
                {
                    "product_id": self.product_id,
                    "valid": False,
                    "reason": "inactive",
                }
            ]
        }
        with patch.object(
            service._catalog_client, "post", return_value=mock_response
        ):
            with self.assertRaises(ProductOutOfStockError):
                service.add_item(self.user_id, self.product_id, quantity)

        # Verify no cart item was created
        cart_exists = Cart.objects.filter(user_id=self.user_id).exists()
        if cart_exists:
            cart = Cart.objects.get(user_id=self.user_id)
            self.assertEqual(cart.items.count(), 0)


class OneCartPerCustomerPropertyTest(TestCase):
    """
    Property 4: One Cart Per Customer

    Verify unique constraint on Cart.user_id prevents multiple carts per customer.

    **Validates: Requirements 7.8**
    """

    @given(user_id=st.uuids())
    @settings(max_examples=50)
    def test_unique_constraint_prevents_duplicate_carts(self, user_id):
        """
        For any user_id, attempting to create a second cart with the same
        user_id must raise an IntegrityError due to the unique constraint.
        """
        # Clean up from previous hypothesis iterations
        Cart.objects.filter(user_id=user_id).delete()

        # Create first cart — should succeed
        cart1 = Cart.objects.create(user_id=user_id)
        self.assertIsNotNone(cart1.id)

        # Attempt to create second cart with same user_id — must fail
        with self.assertRaises(IntegrityError):
            Cart.objects.create(user_id=user_id)

    @given(
        user_id_1=st.uuids(),
        user_id_2=st.uuids(),
    )
    @settings(max_examples=50)
    def test_different_users_can_have_separate_carts(self, user_id_1, user_id_2):
        """
        For any two distinct user_ids, each can have their own cart
        without violating the unique constraint.
        """
        from hypothesis import assume

        assume(user_id_1 != user_id_2)

        # Clean up
        Cart.objects.filter(user_id__in=[user_id_1, user_id_2]).delete()

        # Both carts should be created successfully
        cart1 = Cart.objects.create(user_id=user_id_1)
        cart2 = Cart.objects.create(user_id=user_id_2)

        self.assertIsNotNone(cart1.id)
        self.assertIsNotNone(cart2.id)
        self.assertNotEqual(cart1.id, cart2.id)
        self.assertEqual(Cart.objects.filter(user_id=user_id_1).count(), 1)
        self.assertEqual(Cart.objects.filter(user_id=user_id_2).count(), 1)
