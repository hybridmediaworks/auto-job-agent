"""
backend/app/providers/factory.py

Factory for creating and managing job provider instances.

Provides a centralized registry for all job providers with dynamic
registration support. New providers can be added at runtime without
modifying existing code.
"""

from typing import Dict, Type, Any, List

from .base import BaseJobProvider


class ProviderFactory:
    """
    Factory for creating job provider instances.

    Maintains a registry of available providers and creates instances
    with appropriate configuration.

    Usage:
        # Register a provider
        ProviderFactory.register_provider("linkedin", LinkedInProvider)

        # Create instance
        provider = ProviderFactory.create("indeed", api_key="...", config={...})

        # Get all registered providers
        providers = ProviderFactory.get_registered_providers()
    """

    # Registry of provider name -> provider class
    _providers: Dict[str, Type[BaseJobProvider]] = {}

    @classmethod
    def register_provider(cls, name: str, provider_class: Type[BaseJobProvider]) -> None:
        """
        Register a new job provider.

        Args:
            name: Provider name (lowercase, e.g., "indeed", "glassdoor")
            provider_class: Provider class that inherits from BaseJobProvider

        Raises:
            TypeError: If provider_class doesn't inherit from BaseJobProvider
            ValueError: If provider name is already registered

        Example:
            ProviderFactory.register_provider("linkedin", LinkedInProvider)
        """
        if not issubclass(provider_class, BaseJobProvider):
            raise TypeError(
                f"{provider_class.__name__} must inherit from BaseJobProvider"
            )

        name_lower = name.lower()
        cls._providers[name_lower] = provider_class

    @classmethod
    def unregister_provider(cls, name: str) -> None:
        """
        Unregister a job provider.

        Args:
            name: Provider name to remove

        Raises:
            ValueError: If provider not found
        """
        name_lower = name.lower()

        if name_lower not in cls._providers:
            raise ValueError(f"Provider '{name}' is not registered")

        del cls._providers[name_lower]

    @classmethod
    def create(
        cls,
        provider_name: str,
        api_key: str,
        config: Dict[str, Any] = None
    ) -> BaseJobProvider:
        """
        Create an instance of a registered provider.

        Args:
            provider_name: Name of provider to instantiate
            api_key: API key for the provider
            config: Optional provider-specific configuration

        Returns:
            Initialized provider instance

        Raises:
            ValueError: If provider not found in registry

        Example:
            provider = ProviderFactory.create(
                "indeed",
                api_key="your-rapidapi-key",
                config={"page_size": 20}
            )
            jobs = await provider.search_jobs("WordPress Developer", "Remote")
        """
        name_lower = provider_name.lower()

        if name_lower not in cls._providers:
            available = ", ".join(cls._providers.keys())
            raise ValueError(
                f"Unknown provider: '{provider_name}'. "
                f"Available providers: {available}"
            )

        provider_class = cls._providers[name_lower]
        return provider_class(api_key=api_key, config=config or {})

    @classmethod
    def get_registered_providers(cls) -> List[str]:
        """
        Get list of all registered provider names.

        Returns:
            List of provider names (lowercase)

        Example:
            >>> ProviderFactory.get_registered_providers()
            ['indeed', 'glassdoor', 'ziprecruiter']
        """
        return list(cls._providers.keys())

    @classmethod
    def is_registered(cls, provider_name: str) -> bool:
        """
        Check if a provider is registered.

        Args:
            provider_name: Provider name to check

        Returns:
            True if registered, False otherwise

        Example:
            if ProviderFactory.is_registered("indeed"):
                provider = ProviderFactory.create("indeed", api_key)
        """
        return provider_name.lower() in cls._providers

    @classmethod
    def clear_registry(cls) -> None:
        """
        Clear all registered providers.

        Useful for testing or resetting the factory state.
        """
        cls._providers.clear()
