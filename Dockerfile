# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files from housing-data-app
COPY housing-data-app/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code from housing-data-app
COPY housing-data-app/ ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
