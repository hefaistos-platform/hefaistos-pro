# Frontend production image: build React app and serve with Nginx

# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* yarn.lock* ./
# Use legacy peer deps to tolerate React 19 peer dependency ranges
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm install --legacy-peer-deps; fi

# Copy source
COPY . ./

# Build static assets
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy build output to Nginx html directory
COPY --from=build /app/build /usr/share/nginx/html

# Add SPA-friendly Nginx config (fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Default Nginx image listens on 80; used by the proxy service
EXPOSE 80

# No custom config needed; Nginx will serve static files from /usr/share/nginx/html
# SPA fallback is provided via the copied nginx.conf.
