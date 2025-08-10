"""
Setup script for the book_search_core library.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="book-search-core",
    version="1.0.0",
    author="Book Search Team",
    description="Hybrid story search library combining semantic and lexical ranking",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(include=["library", "library.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.9",
    install_requires=[
        "pandas>=1.3.0",
        "numpy>=1.21.0",
        "pinecone>=0.7.0",
        "fuzzywuzzy>=0.18.0",
        "python-levenshtein>=0.12.0",
        "scikit-learn>=1.0.0",
        "requests>=2.25.0",
        "google-generativeai>=0.3.0",
        "sarvamai>=0.1.0",
        "supabase>=2.0.0",
        "google-genai>=0.1.0",
    ],
    extras_require={
        "sentence-transformers": ["sentence-transformers>=2.0.0"],
        "dev": [
            "pytest>=6.0",
            "pytest-cov>=2.0",
            "black>=21.0",
            "flake8>=3.8",
            "mypy>=0.800",
        ],
    },
    entry_points={
        "console_scripts": [
            "book-search=library.cli:main",
        ],
    },
)
