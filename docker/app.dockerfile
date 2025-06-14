# Usamos la imagen base
FROM urielch/opencv-nodejs:6.2.4

# Argumentos para recibir el ID de usuario y grupo
ARG UID=1000
ARG GID=1000

# Como root, modificamos el usuario/grupo 'node' para que coincida con nuestro host
RUN groupmod -o -g $GID node && \
    usermod -o -u $UID -g $GID node

# Como root, creamos el directorio de la aplicación y nos aseguramos de que
# el usuario 'node' sea el propietario. Esto es CRUCIAL para evitar problemas de permisos.
RUN mkdir -p /app && chown -R node:node /app

# Establecemos el directorio de trabajo
WORKDIR /app

# Ahora sí, cambiamos permanentemente al usuario 'node'
USER node

# Copiamos los archivos de manifiesto (serán propiedad de 'node' automáticamente)
COPY package.json package-lock.json* ./

# Instalamos las dependencias como el usuario 'node'
RUN npm remove @u4/opencv4nodejs || true
RUN npm install
RUN npm link @u4/opencv4nodejs

# Copiamos el resto del código fuente
COPY . .

# Exponemos el puerto
EXPOSE 5173

# Comando para iniciar el servidor de desarrollo
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]