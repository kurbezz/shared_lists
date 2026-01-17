use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub twitch_id: String,
    pub username: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct TwitchTokenResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub refresh_token: Option<String>,
    #[allow(dead_code)]
    pub expires_in: i64,
    #[allow(dead_code)]
    pub token_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TwitchUser {
    pub id: String,
    pub login: String,
    pub display_name: String,
    pub profile_image_url: String,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TwitchUserResponse {
    pub data: Vec<TwitchUser>,
}
