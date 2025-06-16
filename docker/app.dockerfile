# Multi-stage build for better optimization
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    shadow

# Accept build arguments for user mapping
ARG USER_ID=1000
ARG GROUP_ID=1000

# Create user with matching host UID/GID
RUN if [ "$USER_ID" != "1000" ] || [ "$GROUP_ID" != "1000" ]; then \
        deluser node && \
        addgroup -g $GROUP_ID node && \
        adduser -D -u $USER_ID -G node node; \
    fi

# Set working directory
WORKDIR /app

# Change ownership to node user
RUN chown node:node /app

# Development stage
FROM base AS development

# Switch to node user
USER node

# Copy package files with correct ownership
COPY --chown=node:node package.json package-lock.json* ./

# Install all dependencies (including dev dependencies)
# Skip OpenCV for now to avoid compilation issues
RUN npm ci --ignore-scripts

# Copy source code with correct ownership
COPY --chown=node:node . .

# Expose the development port
EXPOSE 5173

# Start the development server with hot reload
CMD ["sh", "-c", "if [ ! -d node_modules ] || [ -z \"$(ls -A node_modules 2>/dev/null)\" ]; then echo '📦 Installing dependencies...' && npm ci --ignore-scripts; fi && echo '🚀 Starting development server...' && npm run dev -- --host 0.0.0.0"]

# Production stage
FROM base AS production

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose the production port
EXPOSE 3000

# Start the production server
CMD ["node", "build"]