FROM node:20-bookworm-slim

FROM base AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config python3 libopencv-dev \
    && rm -rf /var/lib/apt/lists/*

ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1

WORKDIR /app
RUN /app
USER node

COPY --chown=node:node package*.json ./
RUN npm install --ignore-scripts

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]