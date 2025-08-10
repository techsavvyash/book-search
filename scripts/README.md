# Scripts

This directory contains utility scripts for the book search project.

## Files

- `modifiedHierarcy.py` - DSPy-based story meta-tag generation script
- `download_all_pdfs.sh` - Shell script for downloading PDF files

## Usage

### Meta-tag Generation

```bash
# Basic usage
python scripts/modifiedHierarcy.py

# With Chain of Thought reasoning
python scripts/modifiedHierarcy.py --cot

# Custom stories folder
python scripts/modifiedHierarcy.py --folder /path/to/stories --cot

# Process specific number of stories
python scripts/modifiedHierarcy.py --num_rows 10
```

### PDF Download

```bash
chmod +x scripts/download_all_pdfs.sh
./scripts/download_all_pdfs.sh
```
