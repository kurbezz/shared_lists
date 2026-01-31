mod config;
mod error;
mod middleware;
mod models;
mod repositories;
mod routes;
mod services;

// Test-only helpers
#[cfg(test)]
mod tests_utils;

use crate::config::Config;
use crate::middleware::{auth_middleware, AuthState};
use crate::repositories::{ListRepository, PageRepository, UserRepository, ApiKeyRepository};
use crate::routes::{
    auth_router, lists_router, pages_router, public_router, users_router, api_keys_router, AuthRouterState,
    ListsRouterState, PagesRouterState, PublicRouterState, UsersRouterState, ApiKeysRouterState,
};
use crate::services::{AuthService, ApiKeyService};
use axum::{middleware as axum_middleware, Router};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use axum::http::HeaderValue;
use url::Url;
use axum::http::Method;
use axum::http::header::{AUTHORIZATION, ACCEPT, CONTENT_TYPE, STRICT_TRANSPORT_SECURITY, X_FRAME_OPTIONS, X_CONTENT_TYPE_OPTIONS, CONTENT_SECURITY_POLICY, REFERRER_POLICY};
use tower_http::cors::{Any, CorsLayer};
use tower_http::set_header::SetResponseHeaderLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "shared_lists_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded");
    // Do not log sensitive configuration like full database URLs or secrets.
    tracing::info!("Redirect URI: {}", config.twitch_redirect_uri);
    tracing::info!("Frontend URL: {}", config.frontend_url);

    // Setup database connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await?;
    tracing::info!("Database connection established");

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database migrations completed");

    // Initialize repositories
    let user_repo = Arc::new(UserRepository::new(pool.clone()));
    let page_repo = Arc::new(PageRepository::new(pool.clone()));
    let list_repo = Arc::new(ListRepository::new(pool.clone()));
    let api_key_repo = Arc::new(ApiKeyRepository::new(pool.clone()));

    // Create auth service
    let auth_service = Arc::new(AuthService::new(
        config.jwt_secret.clone(),
        config.twitch_client_id.clone(),
        config.twitch_client_secret.clone(),
        (*user_repo).clone(),
    ));

    let api_key_service = Arc::new(ApiKeyService::new((*api_key_repo).clone()));

    // Setup CORS — restrict allowed origin to the configured frontend URL when possible.
    // Limit allowed methods and headers to reduce attack surface.
    // If FRONTEND_URL is invalid, fall back to allowing any origin (with a warning).
    // Parse frontend URL and extract origin (scheme://host[:port]).
    // When a concrete origin is available, enable credentials so httpOnly cookies are sent by browsers.
    let cors = match Url::parse(&config.frontend_url) {
        Ok(parsed) => {
            if let Some(host) = parsed.host_str() {
                let origin = if let Some(port) = parsed.port() {
                    format!("{}://{}:{}", parsed.scheme(), host, port)
                } else {
                    format!("{}://{}", parsed.scheme(), host)
                };

                match HeaderValue::from_str(&origin) {
                    Ok(origin_hv) => CorsLayer::new()
                        .allow_origin(origin_hv)
                        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
                        .allow_headers(vec![AUTHORIZATION, CONTENT_TYPE, ACCEPT])
                        .allow_credentials(true),
                    Err(_) => {
                        tracing::warn!("Parsed frontend origin '{}' is not a valid header value — falling back to allow Any origin", origin);
                        CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any)
                    }
                }
            } else {
                tracing::warn!("FRONTEND_URL '{}' does not contain a hostname — falling back to allow Any origin", config.frontend_url);
                CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any)
            }
        }
        Err(_) => {
            tracing::warn!("FRONTEND_URL is not a valid URL: '{}' — falling back to allow Any origin", config.frontend_url);
            CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any)
        }
    };

    // Auth routes (no auth middleware)
    let auth_routes = auth_router(AuthRouterState {
        auth_service: auth_service.clone(),
        twitch_client_id: config.twitch_client_id.clone(),
        redirect_uri: config.twitch_redirect_uri.clone(),
        frontend_url: config.frontend_url.clone(),
    });

    // Protected routes (with auth middleware)
    let protected_routes = Router::new()
        .merge(pages_router(PagesRouterState {
            page_repo: page_repo.clone(),
        }))
        .merge(lists_router(ListsRouterState {
            list_repo: list_repo.clone(),
            page_repo: page_repo.clone(),
        }))
        .merge(users_router(UsersRouterState {
            user_repo: user_repo.clone(),
        }))
        .merge(api_keys_router(ApiKeysRouterState {
            api_key_service: api_key_service.clone(),
        }))
        .layer(axum_middleware::from_fn_with_state(
            AuthState {
                auth_service: auth_service.clone(),
                api_key_service: api_key_service.clone(),
                user_repo: user_repo.clone(),
            },
            auth_middleware,
        ));

    // Public routes (no auth middleware)
    let public_routes = public_router(PublicRouterState {
        page_repo: page_repo.clone(),
        list_repo: list_repo.clone(),
    });

    // Main app
    let app = Router::new()
        .nest("/api/auth", auth_routes)
        .nest("/api", public_routes)
        .nest("/api", protected_routes)
        .layer(cors)
        // Security response headers
        .layer(SetResponseHeaderLayer::overriding(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=63072000; includeSubDomains; preload"),
        ))
        .layer(SetResponseHeaderLayer::overriding(X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(SetResponseHeaderLayer::overriding(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::overriding(REFERRER_POLICY, HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::overriding(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:;"),
        ));

    // Start server
    let listener = tokio::net::TcpListener::bind(&config.server_addr()).await?;
    tracing::info!("Server listening on {}", config.server_addr());

    axum::serve(listener, app).await?;

    Ok(())
}
