"""
LLM-based analyzer for anomaly detection reports using Ollama or Replicate.
Provides natural language analysis, authenticity assessment, and detailed insights.
"""

import json
import logging
import os
import time
from typing import Dict, Optional, Tuple

try:
    import ollama  # type: ignore
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    logger.warning("Ollama package not available")

try:
    import replicate  # type: ignore
    REPLICATE_AVAILABLE = True
except ImportError:
    REPLICATE_AVAILABLE = False
    logger.warning("Replicate package not available")

from utils.prompt_templates import generate_prompt

logger = logging.getLogger(__name__)


class OllamaConnectionError(Exception):
    """Raised when Ollama service is unavailable."""
    pass


class ReplicateConnectionError(Exception):
    """Raised when Replicate service is unavailable."""
    pass


class OllamaClient:
    """Client for communicating with local Ollama service."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 2
    ):
        """
        Initialize Ollama client.

        Args:
            base_url: Ollama API base URL (default: http://localhost:11434)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        self.base_url = base_url or os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = ollama.Client(host=self.base_url)

    def check_health(self) -> bool:
        """
        Check if Ollama service is running and accessible.

        Returns:
            True if service is healthy, False otherwise
        """
        try:
            # Try to list models as a health check
            self.client.list()
            return True
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    def generate(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0
    ) -> str:
        """
        Generate a response from Ollama.

        Args:
            model: Model name (e.g., 'llama3.2:latest')
            system_prompt: System prompt for the model
            user_prompt: User prompt with the task
            temperature: Sampling temperature (0.0 for deterministic)

        Returns:
            Generated text response

        Raises:
            OllamaConnectionError: If Ollama is unavailable
            Exception: For other errors
        """
        for attempt in range(self.max_retries + 1):
            try:
                logger.info(f"Generating response with model {model} (attempt {attempt + 1})")

                response = self.client.chat(
                    model=model,
                    messages=[
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': user_prompt}
                    ],
                    options={
                        'temperature': temperature,
                        'num_predict': 2000,  # Max tokens to generate
                    }
                )

                return response['message']['content']

            except Exception as e:
                error_msg = str(e).lower()

                # Check if it's a connection error
                if 'connection' in error_msg or 'refused' in error_msg:
                    if attempt < self.max_retries:
                        wait_time = 2 ** attempt  # Exponential backoff
                        logger.warning(f"Connection failed, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise OllamaConnectionError(
                            "Could not connect to Ollama service. "
                            f"Please ensure Ollama is running at {self.base_url}"
                        )

                # Check if model doesn't exist
                elif 'not found' in error_msg or 'pull' in error_msg:
                    raise Exception(
                        f"Model '{model}' not found. "
                        f"Please run: ollama pull {model}"
                    )

                # Other errors
                else:
                    if attempt < self.max_retries:
                        logger.warning(f"Error occurred: {e}, retrying...")
                        time.sleep(1)
                        continue
                    else:
                        raise

        # Should never reach here
        raise Exception("Max retries exceeded")


class ReplicateClient:
    """Client for communicating with Replicate API."""

    def __init__(
        self,
        api_token: Optional[str] = None,
        timeout: int = 60,
        max_retries: int = 2
    ):
        """
        Initialize Replicate client.

        Args:
            api_token: Replicate API token (default: from REPLICATE_API_TOKEN env)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        if not REPLICATE_AVAILABLE:
            raise ImportError("Replicate package not installed. Run: pip install replicate")

        self.api_token = api_token or os.getenv('REPLICATE_API_TOKEN')
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN environment variable is required")

        self.timeout = timeout
        self.max_retries = max_retries

        # Set API token for replicate
        os.environ['REPLICATE_API_TOKEN'] = self.api_token

    def generate(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.0
    ) -> str:
        """
        Generate a response from Replicate.

        Args:
            model: Model identifier (e.g., 'meta/llama-3.2-3b-instruct')
            system_prompt: System prompt for the model
            user_prompt: User prompt with the task
            temperature: Sampling temperature (0.0 for deterministic)

        Returns:
            Generated text response

        Raises:
            ReplicateConnectionError: If Replicate API is unavailable
            Exception: For other errors
        """
        for attempt in range(self.max_retries + 1):
            try:
                logger.info(f"Generating response with Replicate model {model} (attempt {attempt + 1})")

                # Combine system and user prompts
                full_prompt = f"{system_prompt}\n\n{user_prompt}"

                # Run the model
                output = replicate.run(
                    model,
                    input={
                        "prompt": full_prompt,
                        "temperature": temperature,
                        "max_tokens": 2000,
                        "top_p": 0.9,
                    }
                )

                # Replicate returns an iterator, join the output
                if hasattr(output, '__iter__') and not isinstance(output, str):
                    response = "".join(output)
                else:
                    response = str(output)

                return response

            except Exception as e:
                error_msg = str(e).lower()

                # Check if it's an authentication error
                if 'unauthorized' in error_msg or 'authentication' in error_msg:
                    raise ReplicateConnectionError(
                        "Authentication failed. Please check your REPLICATE_API_TOKEN"
                    )

                # Check if it's a rate limit error
                elif 'rate limit' in error_msg or 'quota' in error_msg:
                    if attempt < self.max_retries:
                        wait_time = 2 ** attempt
                        logger.warning(f"Rate limited, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise ReplicateConnectionError(
                            "Rate limit exceeded. Please try again later."
                        )

                # Check if it's a connection error
                elif 'connection' in error_msg or 'timeout' in error_msg:
                    if attempt < self.max_retries:
                        wait_time = 2 ** attempt
                        logger.warning(f"Connection failed, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise ReplicateConnectionError(
                            "Could not connect to Replicate API. Please check your internet connection."
                        )

                # Other errors
                else:
                    if attempt < self.max_retries:
                        logger.warning(f"Error occurred: {e}, retrying...")
                        time.sleep(1)
                        continue
                    else:
                        raise

        # Should never reach here
        raise Exception("Max retries exceeded")


def parse_llm_response(raw_response: str) -> Dict:
    """
    Parse and validate LLM JSON response.

    Args:
        raw_response: Raw text response from LLM

    Returns:
        Parsed and validated analysis dictionary

    Raises:
        ValueError: If response cannot be parsed
    """
    try:
        # Try to extract JSON from response
        # Sometimes LLMs add markdown formatting
        response = raw_response.strip()

        # Remove markdown code blocks if present
        if response.startswith('```json'):
            response = response[7:]
        elif response.startswith('```'):
            response = response[3:]

        if response.endswith('```'):
            response = response[:-3]

        response = response.strip()

        # Parse JSON
        data = json.loads(response)

        # Validate required fields
        required_fields = ['summary', 'authenticity_assessment', 'detailed_insights', 'risk_factors']
        missing_fields = [f for f in required_fields if f not in data]

        if missing_fields:
            logger.warning(f"LLM response missing fields: {missing_fields}")
            # Fill in missing fields with defaults
            if 'summary' not in data:
                data['summary'] = "Analysis completed but summary not available."
            if 'authenticity_assessment' not in data:
                data['authenticity_assessment'] = {
                    'confidence_score': 0.5,
                    'verdict': 'suspicious',
                    'reasoning': 'Insufficient data for assessment'
                }
            if 'detailed_insights' not in data:
                data['detailed_insights'] = []
            if 'risk_factors' not in data:
                data['risk_factors'] = []

        # Validate authenticity_assessment structure
        auth = data['authenticity_assessment']
        if 'confidence_score' not in auth:
            auth['confidence_score'] = 0.5
        if 'verdict' not in auth:
            auth['verdict'] = 'suspicious'
        if 'reasoning' not in auth:
            auth['reasoning'] = 'Assessment reasoning not provided'

        # Ensure lists are actually lists
        if not isinstance(data['detailed_insights'], list):
            data['detailed_insights'] = [str(data['detailed_insights'])]
        if not isinstance(data['risk_factors'], list):
            data['risk_factors'] = []

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}")
        logger.debug(f"Raw response: {raw_response[:500]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"Error parsing LLM response: {e}")
        raise


def get_fallback_analysis() -> Dict:
    """
    Get a fallback analysis when LLM is unavailable.

    Returns:
        Basic analysis dictionary
    """
    return {
        'summary': 'LLM analysis unavailable. Please review the technical anomaly report manually.',
        'authenticity_assessment': {
            'confidence_score': 0.0,
            'verdict': 'suspicious',
            'reasoning': 'Automated analysis unavailable - manual review required'
        },
        'detailed_insights': [
            'LLM service is currently unavailable',
            'Please review the anomaly breakdown and problematic objects manually',
            'Consider re-running analysis when LLM service is available'
        ],
        'risk_factors': []
    }


def analyze_anomaly_report(
    report_data: Dict,
    model: Optional[str] = None,
    ollama_client: Optional[OllamaClient] = None,
    replicate_client: Optional[ReplicateClient] = None,
    provider: Optional[str] = None
) -> Tuple[Dict, Dict]:
    """
    Analyze an anomaly report using LLM (Ollama or Replicate).

    Args:
        report_data: Dictionary containing the anomaly report
        model: Model name (provider-specific format)
        ollama_client: Optional OllamaClient instance
        replicate_client: Optional ReplicateClient instance
        provider: 'ollama' or 'replicate' (default: from LLM_PROVIDER env or 'ollama')

    Returns:
        Tuple of (analysis_result, metadata)
        - analysis_result: Dict with summary, authenticity_assessment, insights, risk_factors
        - metadata: Dict with model_used, processing_time_ms, provider, etc.

    Raises:
        OllamaConnectionError: If Ollama service is unavailable
        ReplicateConnectionError: If Replicate service is unavailable
        ValueError: If report data is invalid or LLM response cannot be parsed
    """
    start_time = time.time()

    # Determine provider
    if provider is None:
        provider = os.getenv('LLM_PROVIDER', 'ollama').lower()

    logger.info(f"Using LLM provider: {provider}")

    # Validate report structure
    if 'user_friendly_summary' not in report_data:
        raise ValueError("Invalid report: missing 'user_friendly_summary' field")

    # Generate prompts
    try:
        system_prompt, user_prompt = generate_prompt(report_data)
    except Exception as e:
        logger.error(f"Failed to generate prompts: {e}")
        raise ValueError(f"Could not format report data: {e}")

    # Use Replicate
    if provider == 'replicate':
        if not REPLICATE_AVAILABLE:
            raise ImportError("Replicate package not installed. Run: pip install replicate")

        # Get model name (Replicate format: owner/model:version)
        if model is None:
            model = os.getenv('REPLICATE_MODEL', 'meta/llama-3.2-3b-instruct')

        # Create client if not provided
        if replicate_client is None:
            timeout = int(os.getenv('REPLICATE_TIMEOUT', '60'))
            replicate_client = ReplicateClient(timeout=timeout)

        # Generate analysis
        try:
            raw_response = replicate_client.generate(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.0
            )

            analysis = parse_llm_response(raw_response)

        except ReplicateConnectionError:
            raise

        except Exception as e:
            logger.error(f"Replicate analysis failed: {e}")
            raise Exception(f"Replicate LLM analysis failed: {e}")

    # Use Ollama
    elif provider == 'ollama':
        if not OLLAMA_AVAILABLE:
            raise ImportError("Ollama package not installed. Run: pip install ollama")

        # Get model name
        if model is None:
            model = os.getenv('OLLAMA_MODEL', 'llama3.2:latest')

        # Create client if not provided
        if ollama_client is None:
            timeout = int(os.getenv('OLLAMA_TIMEOUT', '30'))
            ollama_client = OllamaClient(timeout=timeout)

        # Check service health
        if not ollama_client.check_health():
            raise OllamaConnectionError(
                "Ollama service is not running or not accessible. "
                f"Please ensure Ollama is running at {ollama_client.base_url}"
            )

        # Generate analysis
        try:
            raw_response = ollama_client.generate(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.0
            )

            analysis = parse_llm_response(raw_response)

        except OllamaConnectionError:
            raise

        except Exception as e:
            logger.error(f"Ollama analysis failed: {e}")

            # Try fallback model
            fallback_model = 'llama3.1:latest'
            if model != fallback_model:
                logger.info(f"Attempting fallback to {fallback_model}")
                try:
                    raw_response = ollama_client.generate(
                        model=fallback_model,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        temperature=0.0
                    )
                    analysis = parse_llm_response(raw_response)
                    model = fallback_model
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {fallback_error}")
                    raise Exception(f"LLM analysis failed: {e}. Fallback also failed: {fallback_error}")
            else:
                raise

    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Use 'ollama' or 'replicate'")

    # Calculate processing time
    processing_time_ms = int((time.time() - start_time) * 1000)

    # Create metadata
    metadata = {
        'model_used': model,
        'provider': provider,
        'processing_time_ms': processing_time_ms,
        'analysis_timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }

    logger.info(f"LLM analysis completed in {processing_time_ms}ms using {provider}/{model}")

    return analysis, metadata
