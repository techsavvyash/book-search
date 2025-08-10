# Configuration

This directory contains configuration files for the book search project.

## Files

- `pytest.ini` - Pytest configuration for test discovery and coverage
- `render.yaml` - Deployment configuration for Render.com
- `apt-packages` - List of system packages required for deployment

## Usage

### Testing Configuration

The pytest configuration is automatically used when running tests:

```bash
pytest  # Uses config/pytest.ini via symlink
```

### Deployment Configuration

The render.yaml file is used for deployment on Render.com and other compatible platforms.

### System Dependencies

The apt-packages file lists system-level dependencies required for deployment.