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

COPY package*.json ./

# we can remove --ignore-scripts when docker builds correctly or npm rebuild @u4/opencv4nodejs
RUN npm install --ignore-scripts

COPY . .

# Expose the port your app runs on
EXPOSE 5173

# The command to start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]