use crate::error::{AppError, FieldError};
use regex::Regex;

// Validation limits
pub const TITLE_MIN: usize = 1;
pub const TITLE_MAX: usize = 200;
pub const DESCRIPTION_MAX: usize = 2000;
pub const ITEM_CONTENT_MIN: usize = 1;
pub const ITEM_CONTENT_MAX: usize = 2000;
pub const USERNAME_MIN: usize = 3;
pub const USERNAME_MAX: usize = 32;
pub const DISPLAY_NAME_MAX: usize = 64;
pub const API_KEY_NAME_MAX: usize = 100;

fn trim(s: &str) -> String {
    s.trim().to_string()
}

pub fn validate_title(input: &str) -> Result<String, AppError> {
    let v = trim(input);
    let len = v.chars().count();
    if len < TITLE_MIN || len > TITLE_MAX {
        return Err(AppError::Validation(vec![FieldError {
            field: "title".to_string(),
            message: format!("Title must be between {} and {} characters", TITLE_MIN, TITLE_MAX),
        }]));
    }
    Ok(v)
}

pub fn validate_description(input: &Option<String>) -> Result<Option<String>, AppError> {
    if let Some(s) = input {
        let v = trim(s);
        let len = v.chars().count();
        if len > DESCRIPTION_MAX {
            return Err(AppError::Validation(vec![FieldError {
                field: "description".to_string(),
                message: format!("Description must be at most {} characters", DESCRIPTION_MAX),
            }]));
        }
        return Ok(Some(v));
    }
    Ok(None)
}

pub fn validate_item_content(input: &str) -> Result<String, AppError> {
    let v = trim(input);
    let len = v.chars().count();
    if len < ITEM_CONTENT_MIN || len > ITEM_CONTENT_MAX {
        return Err(AppError::Validation(vec![FieldError {
            field: "content".to_string(),
            message: format!("Item content must be between {} and {} characters", ITEM_CONTENT_MIN, ITEM_CONTENT_MAX),
        }]));
    }
    Ok(v)
}

pub fn validate_username(input: &str) -> Result<String, AppError> {
    let v = trim(input);
    let len = v.chars().count();
    if len < USERNAME_MIN || len > USERNAME_MAX {
        return Err(AppError::Validation(vec![FieldError {
            field: "username".to_string(),
            message: format!("Username must be between {} and {} characters", USERNAME_MIN, USERNAME_MAX),
        }]));
    }
    let re = Regex::new(r"^[A-Za-z0-9_.-]+$").unwrap();
    if !re.is_match(&v) {
        return Err(AppError::Validation(vec![FieldError {
            field: "username".to_string(),
            message: "Username contains invalid characters".to_string(),
        }]));
    }
    Ok(v)
}

pub fn validate_display_name(input: &Option<String>) -> Result<Option<String>, AppError> {
    if let Some(s) = input {
        let v = trim(s);
        let len = v.chars().count();
        if len > DISPLAY_NAME_MAX {
            return Err(AppError::Validation(vec![FieldError {
                field: "display_name".to_string(),
                message: format!("Display name must be at most {} characters", DISPLAY_NAME_MAX),
            }]));
        }
        return Ok(Some(v));
    }
    Ok(None)
}

pub fn validate_public_slug(input: &str) -> Result<String, AppError> {
    let v = trim(input);
    let re = Regex::new(r"^[a-z0-9-]{3,50}$").unwrap();
    if !re.is_match(&v) {
        return Err(AppError::Validation(vec![FieldError {
            field: "public_slug".to_string(),
            message: "Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only".to_string(),
        }]));
    }
    Ok(v)
}

pub fn validate_api_key_name(input: &Option<String>) -> Result<Option<String>, AppError> {
    if let Some(s) = input {
        let v = trim(s);
        let len = v.chars().count();
        if len > API_KEY_NAME_MAX {
            return Err(AppError::Validation(vec![FieldError {
                field: "name".to_string(),
                message: format!("API key name must be at most {} characters", API_KEY_NAME_MAX),
            }]));
        }
        return Ok(Some(v));
    }
    Ok(None)
}

pub fn validate_scopes(scopes: &Vec<String>) -> Result<Vec<String>, AppError> {
    if scopes.is_empty() {
        return Err(AppError::Validation(vec![FieldError {
            field: "scopes".to_string(),
            message: "At least one scope must be provided".to_string(),
        }]));
    }
    let re = Regex::new(r"^[a-z]+$").unwrap();
    let mut out = Vec::new();
    for s in scopes.iter() {
        let v = trim(s);
        if !re.is_match(&v) {
            return Err(AppError::Validation(vec![FieldError {
                field: "scopes".to_string(),
                message: format!("Invalid scope: {}", s),
            }]));
        }
        out.push(v);
    }
    Ok(out)
}
