use crate::error::{AppError, Result};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce}; // 96-bit nonce
use base64::{engine::general_purpose, Engine as _};

/// Encrypt a string using AES-256-GCM with the provided key
pub fn encrypt_string(plaintext: &str, key: &str) -> Result<String> {
    if key.len() < 32 {
        return Err(AppError::Internal("Encryption key must be at least 32 bytes".to_string()));
    }

    let key_bytes = &key.as_bytes()[0..32];
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| AppError::Internal(format!("Failed to init cipher: {}", e)))?;

    let nonce_bytes = aes_gcm::Nonce::generate(&mut OsRng);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;

    // Store nonce + ciphertext together, base64-encoded
    let mut combined = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(combined))
}

/// Decrypt a string using AES-256-GCM with the provided key
pub fn decrypt_string(ciphertext_b64: &str, key: &str) -> Result<String> {
    if key.len() < 32 {
        return Err(AppError::Internal("Encryption key must be at least 32 bytes".to_string()));
    }

    let key_bytes = &key.as_bytes()[0..32];
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| AppError::Internal(format!("Failed to init cipher: {}", e)))?;

    let combined = general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| AppError::Internal(format!("Failed to decode ciphertext: {}", e)))?;

    if combined.len() < 12 {
        return Err(AppError::Internal("Ciphertext too short".to_string()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(format!("Decrypted data not valid UTF-8: {}", e)))
}


