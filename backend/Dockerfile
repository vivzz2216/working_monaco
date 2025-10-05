FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r dev && useradd -r -g dev dev
RUN mkdir -p /home/dev/workspace && chown -R dev:dev /home/dev

# Set working directory
WORKDIR /home/dev/workspace

# Switch to non-root user
USER dev

# Keep container running
CMD ["tail", "-f", "/dev/null"]
