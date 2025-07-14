# Base stage for development
FROM node:20-bookworm-slim AS base

# Install system dependencies for OpenCV and native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    python3 \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure OpenCV to use system installation
ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1

# Set working directory
WORKDIR /app
RUN chown -R node:node /app

# Development stage
FROM base AS development

# Copy package files
COPY --chown=node:node package.json ./

# Switch to node user and install dependencies
USER node
RUN npm install

# Copy source code
COPY --chown=node:node . .

# Expose development port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]