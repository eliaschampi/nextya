# --- Base Stage ---
# We'll create our own base image to use a more recent version of Node.js
# while still having OpenCV available for the `@u4/opencv4nodejs` package.
# We are using Node.js 20 LTS (Bookworm) as it's a stable, long-term support release.
FROM node:20-bookworm-slim AS base

# Install OpenCV development libraries required by @u4/opencv4nodejs,
# along with build-essential and cmake which are often needed for native modules.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    python3 \
    libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

# Tell opencv4nodejs to use the system-installed OpenCV and not build its own
ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1

# Set build arguments for user mapping
ARG USER_ID=1000
ARG GROUP_ID=1000

# Adjust node user to match host UID/GID if different
RUN if [ "$USER_ID" != "1000" ] || [ "$GROUP_ID" != "1000" ]; then \
        groupmod -g $GROUP_ID node 2>/dev/null || groupadd -g $GROUP_ID node && \
        usermod -u $USER_ID -g $GROUP_ID node 2>/dev/null || useradd -u $USER_ID -g $GROUP_ID -m -s /bin/bash node; \
    fi

# Set working directory and ownership
WORKDIR /app
RUN chown -R node:node /app

# Development stage
FROM base AS development

# Copy package files
COPY --chown=node:node package.json ./

# Install dependencies as node user
USER node
RUN npm install

# Copy source code
COPY --chown=node:node . .

# Expose development port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production dependencies stage
FROM base AS dependencies

# Copy package files
COPY --chown=node:node package.json ./

# Install only production dependencies
USER node
RUN npm install --production && \
    npm cache clean --force

# Production build stage
FROM base AS builder

# Copy package files and install all dependencies for build
COPY --chown=node:node package.json ./
USER node
RUN npm install

# Copy source code and build
COPY --chown=node:node . .
RUN npm run build

# Final production stage
FROM base AS production

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Clean up unnecessary files in node_modules
USER node
RUN find node_modules -type f -name "*.md" -delete && \
    find node_modules -type f -name "*.ts" -delete && \
    find node_modules -type f -name "*.map" -delete && \
    find node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true

# Expose production port
EXPOSE 3000

# Start production server
CMD ["node", "build"]