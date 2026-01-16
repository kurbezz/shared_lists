use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub jwt_secret: String,
    pub twitch_client_id: String,
    pub twitch_client_secret: String,
    pub twitch_redirect_uri: String,
    pub frontend_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        // Load .env file if it exists
        dotenvy::dotenv().ok();

        let config = config::Config::builder()
            // Support loading from environment variables
            // This will look for variables like DATABASE_URL, TWITCH_REDIRECT_URI, etc.
            .add_source(config::Environment::default().convert_case(config::Case::UpperSnake))
            .build()?;

        config.try_deserialize()
    }

    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}
