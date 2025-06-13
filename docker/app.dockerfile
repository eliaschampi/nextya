# Clean SvelteKit + OpenCV development setup
FROM urielch/opencv-nodejs:6.2.4

# Set working directory
WORKDIR /app

# Set development environment
ENV NODE_ENV=development

# Copy package files
COPY package.json package-lock.json* ./

# Remove opencv4nodejs and reinstall clean
RUN npm remove @u4/opencv4nodejs || true
RUN npm install
RUN npm link @u4/opencv4nodejs

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
