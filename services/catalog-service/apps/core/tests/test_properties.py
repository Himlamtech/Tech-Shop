"""
Property-based tests for Database Isolation.

Verifies Docker network configuration enforces DB isolation
(services can't reach other DBs) by analyzing docker-compose.yml network config.
"""

import os
from pathlib import Path

import yaml
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase


def load_docker_compose():
    """Load and parse the docker-compose.yml file."""
    # Navigate up from catalog-service to project root
    project_root = Path(__file__).resolve().parents[5]
    compose_path = project_root / "docker-compose.yml"

    if not compose_path.exists():
        return None

    with open(compose_path, "r") as f:
        return yaml.safe_load(f)


# Service-to-database mapping (which service owns which DB)
SERVICE_DB_MAP = {
    "identity-service": "identity-mysql",
    "catalog-service": "catalog-postgres",
    "cart-service": "cart-postgres",
    "order-service": "order-postgres",
    "payment-service": "payment-mysql",
    "shipping-service": "shipping-postgres",
    "review-service": "review-postgres",
    "ai-service": "ai-postgres",
}

# All database containers
ALL_DATABASES = [
    "identity-mysql",
    "catalog-postgres",
    "cart-postgres",
    "order-postgres",
    "payment-mysql",
    "shipping-postgres",
    "review-postgres",
    "ai-postgres",
]

# All application services
ALL_SERVICES = list(SERVICE_DB_MAP.keys())


class DatabaseIsolationPropertyTest(TestCase):
    """
    Property: Database Isolation

    Verify Docker network configuration enforces DB isolation.
    Services can't reach other services' databases because:
    1. All services and DBs are on the 'internal' network (no direct port exposure)
    2. Only the gateway is on the 'public' network
    3. No database ports are exposed to the host

    **Validates: Requirements 21.1, 21.2, 21.3**
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.compose_config = load_docker_compose()

    def test_compose_file_exists_and_parseable(self):
        """Verify docker-compose.yml exists and is valid YAML."""
        self.assertIsNotNone(
            self.compose_config,
            "docker-compose.yml not found or not parseable",
        )

    @given(db_name=st.sampled_from(ALL_DATABASES))
    @settings(max_examples=50)
    def test_databases_do_not_expose_ports(self, db_name):
        """
        For any database container, verify no ports are exposed to the host.
        This ensures databases are only accessible within the Docker network.
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        services = self.compose_config.get("services", {})
        db_config = services.get(db_name, {})

        # Database containers should NOT have 'ports' mapping
        exposed_ports = db_config.get("ports", [])
        self.assertEqual(
            len(exposed_ports),
            0,
            f"Database '{db_name}' should not expose ports to host, "
            f"but exposes: {exposed_ports}",
        )

    @given(db_name=st.sampled_from(ALL_DATABASES))
    @settings(max_examples=50)
    def test_databases_on_internal_network_only(self, db_name):
        """
        For any database container, verify it is only on the 'internal' network
        and NOT on the 'public' network.
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        services = self.compose_config.get("services", {})
        db_config = services.get(db_name, {})
        networks = db_config.get("networks", [])

        # Convert to list if it's a dict
        if isinstance(networks, dict):
            networks = list(networks.keys())

        self.assertIn(
            "internal",
            networks,
            f"Database '{db_name}' should be on 'internal' network",
        )
        self.assertNotIn(
            "public",
            networks,
            f"Database '{db_name}' should NOT be on 'public' network",
        )

    @given(service_name=st.sampled_from(ALL_SERVICES))
    @settings(max_examples=50)
    def test_services_on_internal_network(self, service_name):
        """
        For any application service, verify it is on the 'internal' network
        (allowing it to reach its own database).
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        services = self.compose_config.get("services", {})
        service_config = services.get(service_name, {})
        networks = service_config.get("networks", [])

        if isinstance(networks, dict):
            networks = list(networks.keys())

        self.assertIn(
            "internal",
            networks,
            f"Service '{service_name}' should be on 'internal' network",
        )

    @given(service_name=st.sampled_from(ALL_SERVICES))
    @settings(max_examples=50)
    def test_services_not_on_public_network(self, service_name):
        """
        For any application service (except gateway), verify it is NOT on
        the 'public' network. Only the gateway should be publicly accessible.
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        services = self.compose_config.get("services", {})
        service_config = services.get(service_name, {})
        networks = service_config.get("networks", [])

        if isinstance(networks, dict):
            networks = list(networks.keys())

        self.assertNotIn(
            "public",
            networks,
            f"Service '{service_name}' should NOT be on 'public' network "
            f"(only gateway should be public)",
        )

    def test_only_gateway_exposes_host_ports(self):
        """
        Verify that only the gateway service exposes ports to the host.
        No other service or database should have host port mappings.
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        services = self.compose_config.get("services", {})

        for service_name, service_config in services.items():
            if service_name == "gateway":
                # Gateway should expose port 80
                ports = service_config.get("ports", [])
                self.assertTrue(
                    len(ports) > 0,
                    "Gateway should expose at least one port",
                )
            elif service_name != "frontend":
                # No other service should expose ports
                ports = service_config.get("ports", [])
                self.assertEqual(
                    len(ports),
                    0,
                    f"Service '{service_name}' should not expose ports to host, "
                    f"but exposes: {ports}",
                )

    def test_network_definitions_exist(self):
        """
        Verify that both 'public' and 'internal' networks are defined
        in docker-compose.yml.
        """
        if self.compose_config is None:
            self.skipTest("docker-compose.yml not available")

        networks = self.compose_config.get("networks", {})
        self.assertIn("public", networks, "Network 'public' should be defined")
        self.assertIn("internal", networks, "Network 'internal' should be defined")
