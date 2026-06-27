# Use official lightweight Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing bytecode and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

# Copy project files
COPY pyproject.toml README.md /app/
COPY src /app/src
COPY web /app/web
COPY data /app/data
COPY server.py /app/server.py

# Install package dependencies
RUN pip install --no-cache-dir -e .

# Expose server port
EXPOSE 8000

# Command to launch PulseRoute AI REST server & Web Dashboard
CMD ["python", "server.py"]
