"""
Property-based tests for Review Service.

Uses hypothesis to verify review uniqueness constraint.
"""

import uuid

from django.db import IntegrityError, transaction
from hypothesis import assume, given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.review.models import Review


class OneReviewPerCustomerPerProductPropertyTest(TestCase):
    """
    Property 17: Review Uniqueness Constraint

    Verify unique constraint on (user_id, product_id) prevents duplicate reviews.

    **Validates: Requirements 11.3**
    """

    @given(
        rating_1=st.integers(min_value=1, max_value=5),
        rating_2=st.integers(min_value=1, max_value=5),
        comment_1=st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=("L", "N", "Z"),
        )),
        comment_2=st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=("L", "N", "Z"),
        )),
    )
    @settings(max_examples=50)
    def test_duplicate_review_for_same_user_product_rejected(
        self, rating_1, rating_2, comment_1, comment_2
    ):
        """
        For any user_id and product_id combination, creating a second review
        must raise an IntegrityError due to the unique constraint on
        (user_id, product_id).
        """
        user_id = uuid.uuid4()
        product_id = uuid.uuid4()

        # Create first review — should succeed
        review_1 = Review.objects.create(
            user_id=user_id,
            product_id=product_id,
            rating=rating_1,
            comment=comment_1,
        )
        self.assertIsNotNone(review_1.id)

        # Attempt to create second review for same user+product — must fail
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Review.objects.create(
                    user_id=user_id,
                    product_id=product_id,
                    rating=rating_2,
                    comment=comment_2,
                )

        # Verify only one review exists
        review_count = Review.objects.filter(
            user_id=user_id, product_id=product_id
        ).count()
        self.assertEqual(review_count, 1)

    @given(
        user_id=st.uuids(),
        product_id_1=st.uuids(),
        product_id_2=st.uuids(),
        rating=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=50)
    def test_same_user_can_review_different_products(
        self, user_id, product_id_1, product_id_2, rating
    ):
        """
        For any user, they can submit reviews for different products
        without violating the unique constraint.
        """
        assume(product_id_1 != product_id_2)

        # Clean up any existing reviews for these combinations
        Review.objects.filter(
            user_id=user_id, product_id__in=[product_id_1, product_id_2]
        ).delete()

        # Create reviews for different products — both should succeed
        review_1 = Review.objects.create(
            user_id=user_id,
            product_id=product_id_1,
            rating=rating,
            comment="Great product 1",
        )
        review_2 = Review.objects.create(
            user_id=user_id,
            product_id=product_id_2,
            rating=rating,
            comment="Great product 2",
        )

        self.assertIsNotNone(review_1.id)
        self.assertIsNotNone(review_2.id)
        self.assertNotEqual(review_1.id, review_2.id)

    @given(
        user_id_1=st.uuids(),
        user_id_2=st.uuids(),
        rating=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=50)
    def test_different_users_can_review_same_product(
        self, user_id_1, user_id_2, rating
    ):
        """
        For any two distinct users, both can review the same product
        without violating the unique constraint.
        """
        assume(user_id_1 != user_id_2)

        product_id = uuid.uuid4()

        # Clean up
        Review.objects.filter(
            user_id__in=[user_id_1, user_id_2], product_id=product_id
        ).delete()

        # Both reviews should succeed
        review_1 = Review.objects.create(
            user_id=user_id_1,
            product_id=product_id,
            rating=rating,
            comment="User 1 review",
        )
        review_2 = Review.objects.create(
            user_id=user_id_2,
            product_id=product_id,
            rating=rating,
            comment="User 2 review",
        )

        self.assertIsNotNone(review_1.id)
        self.assertIsNotNone(review_2.id)
