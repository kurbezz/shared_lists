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
use crate::repositories::{ListRepository, PageRepository, UserRepository};
use crate::routes::{
    auth_router, lists_router, pages_router, public_router, users_router, AuthRouterState,
    ListsRouterState, PagesRouterState, PublicRouterState, UsersRouterState,
};
use crate::services::AuthService;
use axum::{middleware as axum_middleware, Router};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
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
    tracing::info!("Database URL: {}", config.database_url);
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

    // Create auth service
    let auth_service = Arc::new(AuthService::new(
        config.jwt_secret.clone(),
        config.twitch_client_id.clone(),
        config.twitch_client_secret.clone(),
        (*user_repo).clone(),
    ));

    // Setup CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
        .layer(axum_middleware::from_fn_with_state(
            AuthState {
                auth_service: auth_service.clone(),
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
        .layer(cors);

    // Start server
    let listener = tokio::net::TcpListener::bind(&config.server_addr()).await?;
    tracing::info!("Server listening on {}", config.server_addr());

    axum::serve(listener, app).await?;

    Ok(())
}
