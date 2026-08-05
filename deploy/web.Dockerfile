FROM node:20-bookworm-slim AS student-build
WORKDIR /build/frontend-h5
COPY frontend-h5/package.json frontend-h5/package-lock.json ./
RUN npm ci
COPY frontend-h5/ ./
RUN npm run build

FROM node:20-bookworm-slim AS admin-build
WORKDIR /build/admin-web
ARG VITE_BASE_PATH=/admin/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
COPY admin-web/package.json admin-web/package-lock.json ./
RUN npm ci
COPY admin-web/ ./
RUN npm run build

FROM caddy:2.8-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=student-build /build/frontend-h5/dist /srv/student
COPY --from=admin-build /build/admin-web/dist /srv/admin
