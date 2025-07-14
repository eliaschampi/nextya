# Base stage with all system dependencies
FROM node:20-bookworm-slim AS base

# Install system dependencies for OpenCV and other native modules
# This needs to run as root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    python3 \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure environment for opencv4nodejs to use the system-installed library
ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1

# Set working directory
WORKDIR /app


# Development stage
FROM base AS development

# Copy package files for dependency installation.
# This improves Docker layer caching.
COPY package*.json ./

# Run npm install as root. This is crucial for two reasons:
# 1. To have permissions to install packages globally if needed.
# 2. To allow native modules like opencv4nodejs to build correctly.
# NOTE: We removed '--ignore-scripts' as opencv4nodejs likely needs its scripts to build.
RUN npm install

# Now, copy the rest of your application source code
COPY . .

# Fix permissions for volume mounts
# This ensures that when volumes are mounted, the container can still access the files
RUN chmod -R 755 /app

# Expose the port your app runs on
EXPOSE 5173

# The command to start the development server.
# This will run as the root user by default, which solves the volume mount permission issue.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]