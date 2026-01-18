use crate::models::{ApiKey, CreateApiKeyResponse};
use crate::repositories::ApiKeyRepository;
use anyhow::{Context, Result};
use hex;
use rand::{distributions::Alphanumeric, Rng};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const TOKEN_LENGTH: usize = 64;
const MAX_RETRIES: usize = 3;

#[derive(Clone)]
pub struct ApiKeyService {
    repo: ApiKeyRepository,
}

impl ApiKeyService {
    pub fn new(repo: ApiKeyRepository) -> Self {
        Self { repo }
    }

    pub async fn create_api_key(
        &self,
        user_id: Uuid,
        name: Option<String>,
        scopes: Vec<String>,
    ) -> Result<CreateApiKeyResponse> {
        let scopes_str = scopes.join(",");
        
        for attempt in 1..=MAX_RETRIES {
            let token = self.generate_token();
            let token_hash = self.hash_token(&token);

            match self.repo.create(user_id, name.as_deref(), &token_hash, &scopes_str).await {
                Ok(api_key) => {
                    return Ok(CreateApiKeyResponse {
                        id: api_key.id,
                        token,
                    });
                }
                Err(e) if attempt < MAX_RETRIES && self.is_token_collision(&e) => {
                    // Token collision, retry with new token
                    continue;
                }
                Err(e) => {
                    return Err(e).context("Failed to create API key");
                }
            }
        }

        Err(anyhow::anyhow!("Failed to create API key after {} retries", MAX_RETRIES))
    }

    pub async fn verify_token(&self, token: &str) -> Result<Option<(Uuid, Vec<String>)>> {
        let token_hash = self.hash_token(token);
        
        if let Some(api_key) = self.repo.find_by_token_hash(&token_hash).await? {
            Ok(Some((api_key.user_id, api_key.scopes_as_vec())))
        } else {
            Ok(None)
        }
    }

    pub async fn list_user_api_keys(&self, user_id: Uuid) -> Result<Vec<ApiKey>> {
        self.repo.list_by_user(user_id).await
    }

    pub async fn revoke_api_key(&self, id: &str, user_id: Uuid) -> Result<bool> {
        self.repo.revoke(id, user_id).await
    }

    pub async fn delete_api_key(&self, id: &str, user_id: Uuid) -> Result<bool> {
        self.repo.delete(id, user_id).await
    }

    #[allow(dead_code)]
    pub async fn get_api_key(&self, id: &str, user_id: Uuid) -> Result<Option<ApiKey>> {
        self.repo.find_by_id(id, user_id).await
    }

    fn generate_token(&self) -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(TOKEN_LENGTH)
            .map(char::from)
            .collect()
    }

    fn hash_token(&self, token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        hex::encode(hasher.finalize())
    }

    fn is_token_collision(&self, error: &anyhow::Error) -> bool {
        let error_str = error.to_string().to_lowercase();
        error_str.contains("unique") && error_str.contains("token_hash")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateUser;
    use crate::repositories::UserRepository;
    use crate::tests_utils::setup_db;

    #[tokio::test]
    async fn test_create_and_verify_api_key() -> anyhow::Result<()> {
        let pool = setup_db().await;
        
        // Create test user
        let user_repo = UserRepository::new(pool.clone());
        let user = user_repo.create(CreateUser {
            twitch_id: "test123".to_string(),
            username: "testuser".to_string(),
            display_name: None,
            profile_image_url: None,
            email: None,
        }).await?;

        let api_key_repo = ApiKeyRepository::new(pool);
        let service = ApiKeyService::new(api_key_repo);

        // Create API key
        let response = service.create_api_key(
            user.id,
            Some("test key".to_string()),
            vec!["read".to_string(), "write".to_string()],
        ).await?;

        assert!(!response.token.is_empty());
        assert!(!response.id.is_empty());

        // Verify token
        let verification = service.verify_token(&response.token).await?;
        assert!(verification.is_some());
        
        let (verified_user_id, scopes) = verification.unwrap();
        assert_eq!(verified_user_id, user.id);
        assert_eq!(scopes, vec!["read".to_string(), "write".to_string()]);

        // List user API keys
        let keys = service.list_user_api_keys(user.id).await?;
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].id, response.id);

        // Revoke API key
        let revoked = service.revoke_api_key(&response.id, user.id).await?;
        assert!(revoked);

        // Verify revoked token doesn't work
        let verification = service.verify_token(&response.token).await?;
        assert!(verification.is_none());

        Ok(())
    }
}
