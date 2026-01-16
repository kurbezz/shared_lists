# Build stage
FROM rust:latest as builder

WORKDIR /app

# Copy manifests and source code
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/shared_lists_backend .
COPY --from=builder /app/migrations ./migrations

# Expose port
EXPOSE 8000

# Run the application
CMD ["./shared_lists_backend"]