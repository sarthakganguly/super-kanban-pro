# =============================================================================
# Kanban App — Development Container
# =============================================================================
# Multi-stage build:
#   deps  — installs all yarn dependencies (layer cached until package.json changes)
#   dev   — final image: system tools + Android SDK + source + node_modules
#
# After `docker compose up`:
#   - web service starts at http://192.168.1.100:8080
#   - test service runs the test suite on demand
#   - app service stays alive for shell / Metro / VS Code Remote
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps
# Install node_modules. This layer only rebuilds when a package.json changes.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps

WORKDIR /workspace

# Copy every package.json in the monorepo before any source code.
# Docker only reruns yarn install when these files change.
COPY package.json ./
COPY packages/types/package.json              packages/types/
COPY packages/utils/package.json              packages/utils/
COPY packages/store/package.json              packages/store/
COPY packages/database/package.json           packages/database/
COPY packages/services/package.json           packages/services/
COPY packages/ui/package.json                 packages/ui/
COPY packages/adapters/sqlite/package.json    packages/adapters/sqlite/
COPY packages/adapters/indexeddb/package.json packages/adapters/indexeddb/
COPY apps/mobile/package.json                 apps/mobile/
COPY apps/web/package.json                    apps/web/

# Install all workspace dependencies.
# --no-lockfile: no yarn.lock exists yet; yarn will create one inside the image.
# The lock file lives in the image layer — consistent installs on every build.
RUN yarn install --no-lockfile

# ---------------------------------------------------------------------------
# Stage 2: dev
# Full runtime image with system tools, Android SDK, source, and node_modules.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS dev

# ---------------------------------------------------------------------------
# System dependencies
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    openjdk-17-jdk-headless \
    curl \
    unzip \
    wget \
    ca-certificates \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Android SDK (command-line tools only)
# ---------------------------------------------------------------------------
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
         -O /tmp/cmdtools.zip && \
    unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools && \
    mv /tmp/cmdtools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm -rf /tmp/cmdtools.zip /tmp/cmdtools

RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true && \
    sdkmanager \
      "platform-tools" \
      "platforms;android-34" \
      "build-tools;34.0.0"

# ---------------------------------------------------------------------------
# React Native CLI (global)
# ---------------------------------------------------------------------------
RUN npm install -g react-native-cli@2.0.1 --no-audit --no-fund

# ---------------------------------------------------------------------------
# Copy node_modules from the deps stage
# ---------------------------------------------------------------------------
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules

# ---------------------------------------------------------------------------
# Copy full source code
# ---------------------------------------------------------------------------
COPY . .

# ---------------------------------------------------------------------------
# Expose ports
# ---------------------------------------------------------------------------
EXPOSE 8080
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001

# ---------------------------------------------------------------------------
# Default: start the web dev server (overridden per-service in compose)
# ---------------------------------------------------------------------------
CMD ["yarn", "web"]
