---
layout: insight
title: "What Are Public and Private Keys? A Simple Lock-and-Key Explanation"
permalink: /en/insights/iot/public-private-keys-explained/
categories: [IoT, Security, Cryptography]
tags: [public-key, private-key, cryptography, iot-security, encryption, rsa, ecc]
excerpt: "Learn how public and private keys work with simple math examples and real file formats. See actual RSA and ECC keys used in IoT devices."
date: 2025-09-02
author: "Arash Kashi"
---

# What Are Public and Private Keys? (With Real Examples)

Imagine you have a special mailbox where people can drop messages, but only **you** can read them. Let's see how this works mathematically and what it looks like in real IoT devices.

---

## Simple Math Example

Let's use tiny numbers to understand **RSA encryption**:

```
1. Choose two prime numbers: p=3, q=11
2. Calculate n = p×q = 3×11 = 33
3. Calculate φ(n) = (p-1)×(q-1) = 2×10 = 20
4. Choose e=3 (public exponent)
5. Find d=7 (private exponent, where e×d ≡ 1 mod 20)

Public Key:  (n=33, e=3)
Private Key: (n=33, d=7)
```

**Encrypting message "2":**
```
Encrypted = 2³ mod 33 = 8
Decrypted = 8⁷ mod 33 = 2 ✅
```

*Real RSA uses 2048-bit numbers — that's 617 digits long!*

---

## What Keys Look Like in Real Files

### **RSA Private Key (PEM format)**
```pem
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4qiw8PWe4Z7tZqQBz6oNnXX/jT9Hn3y8c3qLm7Xm5vW8...
(many more lines of Base64 encoded data)
-----END RSA PRIVATE KEY-----
```

### **Public Key (extracted from certificate)**
```pem
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4qiw8PWe4Z7tZqQB...
-----END PUBLIC KEY-----
```

### **ECC Key (used in ESP32 IoT devices)**
```pem
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIGxK9/q8Lw4zN8x7k3jR6vPx2Y5M9zX4qN8bHs2vL7k8oAoGCCqG
SM49AwEHoUQDQgAE4x7k2sQ9m6L8jR3wX5vPz2yN4k7M9hX2qP6bGt1uK5j3...
-----END EC PRIVATE KEY-----
```

---

## Real ESP32 Example

In your IoT project, you'll see files like:

```bash
/spiffs/
├── device_private_key.pem    # Your secret (2048 bits)
├── device_certificate.pem    # Contains public key
└── claim_certificate.pem     # Temporary credentials
```

**Loading keys in ESP32 code:**
```c
// PKCS#11 terminology
CK_OBJECT_HANDLE private_key_handle;
CK_OBJECT_HANDLE public_key_handle;

// Real function calls
esp_err_t load_key_pair() {
    return pkcs11_load_private_key(
        "/spiffs/device_private_key.pem",
        "Device Priv TLS Key"  // PKCS#11 label
    );
}
```

---

## Algorithm Comparison

| Algorithm | Key Size | Speed | Use Case |
|-----------|----------|-------|----------|
| **RSA-2048** | 2048 bits | Slower | Legacy systems |
| **ECC P-256** | 256 bits | Faster | Modern IoT (ESP32) |
| **ECC P-384** | 384 bits | Fast | High security |

**Why ECC for IoT?**
- Same security as RSA-2048 but with 256-bit keys
- Faster computation (important for battery life)
- Less memory usage (critical for microcontrollers)

---

## The Mathematical Relationship

```mermaid
graph LR
    A[Message: M] -->|Encrypt with Public Key| B[Ciphertext: C]
    B -->|Decrypt with Private Key| C[Message: M]
    
    D[Message: M] -->|Sign with Private Key| E[Signature: S]
    E -->|Verify with Public Key| F[Valid/Invalid]
```

**Encryption:** `Ciphertext = Message^e mod n`  
**Decryption:** `Message = Ciphertext^d mod n`

---

## Real-World Sizes

```
RSA-2048 Private Key File: ~1.7KB
RSA-2048 Public Key File:  ~294 bytes
ECC P-256 Private Key:     ~121 bytes
ECC P-256 Public Key:      ~91 bytes
```

**ESP32 Flash Usage:**
- Total certificate storage: ~4-6KB
- PKCS#11 metadata: ~2KB
- Perfect fit for IoT constraints

---

## Security Terminology

**Asymmetric Cryptography** = Public/Private key system  
**Key Exchange** = Sharing public keys safely  
**Key Derivation** = Generating keys from passwords  
**Key Escrow** = Backup copies for recovery  
**Key Rotation** = Regularly changing keys  

---

## What Happens When You Generate Keys

```bash
# OpenSSL command (what happens behind the scenes)
openssl ecparam -genkey -name prime256v1 -out private.pem
openssl ec -in private.pem -pubout -out public.pem
```

1. **Choose random number** (256 bits for ECC)
2. **Apply elliptic curve math** to generate key pair
3. **Encode in PEM format** (Base64 + headers)
4. **Store private key securely** in PKCS#11 storage

---

## Next Steps

- **Learn about [Digital Signatures →](/en/insights/iot/digital-signatures-explained/)** (how to prove authenticity)
- **Understand [Digital Certificates →](/en/insights/iot/digital-certificates-explained/)** (packaging public keys)

Now you know what those `.pem` files actually contain and why IoT devices prefer ECC over RSA!