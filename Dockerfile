# syntax=docker/dockerfile:1

# Stage 1: build the frontend to static files (dist/).
FROM node:22-alpine AS frontend
WORKDIR /app

# HOSTED=true hides the operator-only F1TV controls and routes layout storage
# to each visitor's browser. Leave false for a private single-user instance.
ARG HOSTED=false
ENV HOSTED=${HOSTED}

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts eslint.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: python runtime that serves the API and the built frontend.
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt certifi

COPY server ./server
COPY --from=frontend /app/dist ./dist

# Same-process serving: uvicorn binds all interfaces inside the container and
# serves both the page and /api on one port. Never opens a browser.
ENV HOST=0.0.0.0 \
    PORT=8000 \
    F1_NO_BROWSER=1 \
    FASTF1_CACHE_DIR=/data/cache

EXPOSE 8000
WORKDIR /app/server
CMD ["python", "launcher.py"]
