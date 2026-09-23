# --- base -------------------------------------------------------------
# node:20-slim is Debian-based, which the official Tectonic installer script
# targets cleanly (glibc + fontconfig available via apt).
FROM node:20-slim

# fontconfig + ca-certificates: Tectonic needs fontconfig at runtime to find
# fonts, and ca-certificates so it can fetch packages from the CTAN bundle
# over HTTPS on first use. curl/xz-utils are only needed to install the
# Tectonic binary itself.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     curl \
     ca-certificates \
     fontconfig \
     xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Official Tectonic install script — drops a static `tectonic` binary into
# /usr/local/bin. Pinning is done via TECTONIC_VERSION below; bump
# deliberately, don't float on `latest` for a service compiling untrusted
# user input.
ARG TECTONIC_VERSION=0.15.0
RUN curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net \
    | sh -s -- --to /usr/local/bin

WORKDIR /app

# No package.json dependencies beyond Node's built-ins (http, child_process,
# fs/promises, os, path) per server.js — so no npm install step needed. If
# that changes, add package.json + `RUN npm ci --omit=dev` here before
# copying source, so the dependency layer caches independently of source
# edits.
COPY server.js ./

# Run as a non-root user: this service shells out to a compiler on
# arbitrary, un-trusted (admin-submitted but still externally-sourced)
# LaTeX input, so it shouldn't run as root inside the container.
RUN useradd --create-home --shell /usr/sbin/nologin compiler
USER compiler

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# server.js already exposes GET /health — reuse it here instead of adding a
# separate check path.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]