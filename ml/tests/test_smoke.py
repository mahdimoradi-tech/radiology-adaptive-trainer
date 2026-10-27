"""Smoke test for ML environment."""

import sys


def test_python_version():
    """Verify running on Python 3.12."""
    assert sys.version_info.major == 3
    assert sys.version_info.minor == 12
