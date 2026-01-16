use crate::models::{
    Claims, CreateUser, TwitchTokenResponse, TwitchUser, TwitchUserResponse, User,
};
use crate::repositories::UserRepository;
use anyhow::{anyhow, Result};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use reqwest::Client;


pub struct AuthService {
    jwt_secret: String,
    client_id: String,
    client_secret: String,
    user_repository: UserRepository,
}

impl AuthService {
    pub fn new(
        jwt_secret: String,
        client_id: String,
        client_secret: String,
        user_repository: UserRepository,
    ) -> Self {
        Self {
            jwt_secret,
            client_id,
            client_secret,
            user_repository,
        }
    }

    pub fn create_jwt(&self, user: &User) -> Result<String> {
        let expiration = Utc::now()
            .checked_add_signed(chrono::Duration::days(7))
            .ok_or_else(|| anyhow!("Failed to calculate expiration"))?
            .timestamp() as usize;

        let claims = Claims {
            sub: user.id.to_string(),
            twitch_id: user.twitch_id.clone(),
            username: user.username.clone(),
            exp: expiration,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|e| anyhow!("Failed to create JWT: {}", e))
    }

    pub fn verify_jwt(&self, token: &str) -> Result<Claims> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|e| anyhow!("Failed to verify JWT: {}", e))
    }

    pub async fn exchange_code_for_token(
        &self,
        code: &str,
        redirect_uri: &str,
    ) -> Result<TwitchTokenResponse> {
        let client = Client::new();
        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ];

        let response = client
            .post("https://id.twitch.tv/oauth2/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_body = response.text().await?;
            return Err(anyhow!("Twitch token exchange failed: {}", error_body));
        }

        let token_response = response.json::<TwitchTokenResponse>().await?;
        Ok(token_response)
    }

    pub async fn get_twitch_user(&self, access_token: &str) -> Result<TwitchUser> {
        let client = Client::new();
        let response = client
            .get("https://api.twitch.tv/helix/users")
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Client-Id", &self.client_id)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_body = response.text().await?;
            return Err(anyhow!("Failed to get Twitch user info: {}", error_body));
        }

        let user_response = response.json::<TwitchUserResponse>().await?;

        user_response
            .data
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("No user data received from Twitch"))
    }

    pub async fn get_or_create_user(&self, twitch_user: TwitchUser) -> Result<User> {
        // Try to find existing user
        if let Some(_user) = self.user_repository.find_by_twitch_id(&twitch_user.id).await? {
            // Update user info
            return self
                .user_repository
                .update_twitch_info(
                    &twitch_user.id,
                    &twitch_user.login,
                    &twitch_user.display_name,
                    &twitch_user.profile_image_url,
                    twitch_user.email,
                )
                .await;
        }

        // Create new user
        let new_user = CreateUser {
            twitch_id: twitch_user.id,
            username: twitch_user.login,
            display_name: Some(twitch_user.display_name),
            profile_image_url: Some(twitch_user.profile_image_url),
            email: twitch_user.email,
        };

        self.user_repository.create(new_user).await
    }


}
