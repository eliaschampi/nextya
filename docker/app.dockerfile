# Base stage with OpenCV and Node.js
FROM urielch/opencv-nodejs:6.2.4 AS base

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
USER node

# Copy package files
COPY --chown=node:node package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY --chown=node:node . .

# Expose development port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production stage
FROM base AS production

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies and clean up
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Remove unnecessary files
RUN rm -rf src node_modules/**/*.{md,ts,map,h,c,cc,cpp,gyp,yml,txt} \
    node_modules/{@types,@eslint} \
    node_modules/**/{LICENSE,.github,.npmignore,LICENSE.txt,.travis.yml,.eslintrc,sponsors} \
    node_modules/*/{test,binding.gyp} && \
    find . -type f -empty -delete && \
    find . -type d -empty -delete

# Expose production port
EXPOSE 3000

# Start production server
CMD ["node", "build"]