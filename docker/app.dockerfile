# Multi-stage build optimized for OpenCV and SvelteKit
FROM urielch/opencv-nodejs:6.2.4 AS base

# Install additional system dependencies for SvelteKit
RUN apt-get update && apt-get install -y \
    passwd \
    && rm -rf /var/lib/apt/lists/*

# Accept build arguments for user mapping
ARG USER_ID=1000
ARG GROUP_ID=1000

# Create user with matching host UID/GID (Debian style)
RUN if [ "$USER_ID" != "1000" ] || [ "$GROUP_ID" != "1000" ]; then \
        groupmod -g $GROUP_ID node 2>/dev/null || groupadd -g $GROUP_ID node && \
        usermod -u $USER_ID -g $GROUP_ID node 2>/dev/null || useradd -u $USER_ID -g $GROUP_ID -m -s /bin/bash node; \
    fi

# Set working directory
WORKDIR /app

# Change ownership to node user
RUN chown -R node:node /app

# Development stage
FROM base AS development

# Switch to node user
USER node

# Copy package files with correct ownership
COPY --chown=node:node package.docker.json package.json
COPY --chown=node:node package-lock.json* ./

# Install dependencies using Docker-specific package.json and link OpenCV
RUN npm remove @u4/opencv4nodejs 2>/dev/null || true && \
    npm install --force && \
    npm link @u4/opencv4nodejs

# Copy source code with correct ownership
COPY --chown=node:node . .

# Expose the development port
EXPOSE 5173

# Start the development server with hot reload
CMD ["sh", "-c", "echo '🔗 Linking OpenCV...' && npm link @u4/opencv4nodejs && echo '🚀 Starting development server...' && npm run dev -- --host 0.0.0.0"]

# Production stage
FROM base AS production

# Copy package files
COPY package.docker.json package.json
COPY package-lock.json* ./

# Install production dependencies with OpenCV linking
RUN npm remove @u4/opencv4nodejs 2>/dev/null || true && \
    npm ci --only=production --force && \
    npm link @u4/opencv4nodejs && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Clean up unnecessary files to reduce image size
RUN rm -rf src && \
    rm -rf node_modules/**/*.{md,ts,map,h,c,cc,cpp,gyp,yml,txt} && \
    rm -rf node_modules/{@types,@eslint} && \
    rm -rf node_modules/**/{LICENSE,.github,.npmignore,LICENSE.txt,.travis.yml,.eslintrc,sponsors} && \
    rm -rf node_modules/*/{test,binding.gyp} && \
    find . -type f -empty -delete && \
    find . -type d -empty -delete

# Expose the production port
EXPOSE 3000

# Start the production server
CMD ["node", "build"]