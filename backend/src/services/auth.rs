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
            scopes: None,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::CreateUser;

    #[tokio::test]
    async fn test_jwt_creation_and_verification() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = AuthService::new(
            "test_secret_key".to_string(),
            "test_client_id".to_string(),
            "test_client_secret".to_string(),
            user_repo.clone(),
        );

        // Create a test user
        let user = user_repo
            .create(CreateUser {
                twitch_id: "twitch123".to_string(),
                username: "testuser".to_string(),
                display_name: Some("Test User".to_string()),
                profile_image_url: None,
                email: Some("test@example.com".to_string()),
            })
            .await?;

        // Create JWT
        let jwt = auth_service.create_jwt(&user)?;
        assert!(!jwt.is_empty());

        // Verify JWT
        let claims = auth_service.verify_jwt(&jwt)?;
        assert_eq!(claims.sub, user.id.to_string());
        assert_eq!(claims.twitch_id, user.twitch_id);
        assert_eq!(claims.username, user.username);

        Ok(())
    }

    #[tokio::test]
    async fn test_jwt_verification_fails_with_wrong_secret() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service1 = AuthService::new(
            "secret1".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo.clone(),
        );
        let auth_service2 = AuthService::new(
            "secret2".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo.clone(),
        );

        let user = user_repo
            .create(CreateUser {
                twitch_id: "tw456".to_string(),
                username: "user".to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await?;

        // Create JWT with service1
        let jwt = auth_service1.create_jwt(&user)?;

        // Try to verify with service2 (different secret)
        let result = auth_service2.verify_jwt(&jwt);
        assert!(result.is_err());

        Ok(())
    }

    #[tokio::test]
    async fn test_get_or_create_user_creates_new() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = AuthService::new(
            "secret".to_string(),
            "client".to_string(),
            "secret".to_string(),
            user_repo.clone(),
        );

        let twitch_user = TwitchUser {
            id: "tw789".to_string(),
            login: "newuser".to_string(),
            display_name: "New User".to_string(),
            profile_image_url: "http://image.url".to_string(),
            email: Some("new@example.com".to_string()),
        };

        // User should be created
        let user = auth_service.get_or_create_user(twitch_user.clone()).await?;
        assert_eq!(user.twitch_id, "tw789");
        assert_eq!(user.username, "newuser");

        Ok(())
    }

    #[tokio::test]
    async fn test_get_or_create_user_updates_existing() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = AuthService::new(
            "secret".to_string(),
            "client".to_string(),
            "secret".to_string(),
            user_repo.clone(),
        );

        // Create initial user
        let initial = user_repo
            .create(CreateUser {
                twitch_id: "tw999".to_string(),
                username: "oldname".to_string(),
                display_name: Some("Old Name".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        // Call get_or_create with updated info
        let twitch_user = TwitchUser {
            id: "tw999".to_string(),
            login: "newname".to_string(),
            display_name: "New Name".to_string(),
            profile_image_url: "http://new.image".to_string(),
            email: Some("updated@example.com".to_string()),
        };

        let user = auth_service.get_or_create_user(twitch_user).await?;
        
        // Should have same ID but updated info
        assert_eq!(user.id, initial.id);
        assert_eq!(user.username, "newname");
        assert_eq!(user.display_name.as_deref(), Some("New Name"));

        Ok(())
    }
}
