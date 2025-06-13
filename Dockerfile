# Usamos una imagen base ligera
FROM oven/bun:1-alpine

# Install system dependencies for opencv4nodejs
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cmake \
    opencv-dev \
    pkgconfig

# Directorio de trabajo
WORKDIR /app

# Copiamos dependencias primero
COPY package.json bun.lockb ./
RUN npm run install

# Puerto de la app (Vite dev server)
EXPOSE 5173

# Comando para desarrollo
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
