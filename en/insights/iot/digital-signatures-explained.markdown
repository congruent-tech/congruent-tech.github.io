---
layout: insight
title: "Digital Signatures Explained: How Devices Prove Their Identity"
permalink: /en/insights/iot/digital-signatures-explained/
categories: [IoT, Security, Cryptography]
tags: [digital-signatures, authentication, iot-security, cryptography, esp32]
excerpt: "Learn how digital signatures work with real math examples and code. See how IoT devices prove authenticity without revealing their private keys."
date: 2025-09-02
author: "Arash Kashi"
---

# Digital Signatures: The IoT Device's Handwritten Signature

Before reading this, make sure you understand [Public and Private Keys](/en/insights/iot/public-private-keys-explained/).

Think of a digital signature like a handwritten signature, but impossible to forge. Here's how your IoT device "signs" messages to prove it's really them.

---

## The Checkbook Analogy

**Traditional Signature:**
- You sign checks with your unique handwriting
- Bank recognizes your signature style
- Hard to forge, but not impossible

**Digital Signature:**
- Device "signs" with its private key (mathematical signature)
- AWS verifies with device's public key
- **Mathematically impossible to forge**

---

## Simple Math Example (RSA Signature)

Using our keys from the previous article:
```
Public Key:  (n=33, e=3)
Private Key: (n=33, d=7)
```

**Signing message "HELLO" (hash = 5):**
```
Signature = 5^7 mod 33 = 14
```

**Verification (anyone can do this):**
```
Original = 14^3 mod 33 = 5 ✅ Matches hash!
```

*If signature was forged, the math wouldn't work out.*

---

## What Signatures Look Like

### **Raw Signature (Binary)**
```
30 45 02 20 1a 2b 3c 4d 5e 6f 7a 8b 9c ad be cf
d0 e1 f2 03 14 25 36 47 58 69 7a 8b 9c ad be cf
02 21 00 9c ad be cf d0 e1 f2 03 14 25 36 47 58
69 7a 8b 1a 2b 3c 4d 5e 6f 7a 8b 9c ad be cf d0
```

### **Base64 Encoded (PEM format)**
```
MEUCIBorPE1eb3qLnK2+z9Dh8gMUJTZHWGl6i5ytvs/QAiEAnK2+z9Dh8gMUJTZH
WGl6ixorPE1eb3qLnK2+z9A=
```

### **In ESP32 Code**
```c
// ECDSA signature structure (real ESP32 code)
typedef struct {
    uint8_t r[32];  // First part of signature
    uint8_t s[32];  // Second part of signature  
} ecdsa_signature_t;

// Signing function
esp_err_t sign_message(const uint8_t* message, 
                      size_t message_len,
                      ecdsa_signature_t* signature) {
    return mbedtls_ecdsa_sign(&ctx, message, message_len, 
                             signature->r, signature->s);
}
```

---

## Hash Functions: Why We Don't Sign Raw Messages

**Problem:** RSA can only sign small numbers
- Message: "Turn on the lights in the living room" (too big!)
- Direct signing would be slow and inefficient

**Solution:** Hash the message first
```
Message → SHA-256 Hash → Sign Hash
```

**Real Example:**
```
Message: "unlock_door_123"
SHA-256: e7c0de4f2e8b4a5c9d1f...  (32 bytes)
Sign:    0x1a2b3c4d... (signature)
```

---

## Signature Algorithms Used in IoT

| Algorithm | Signature Size | Speed | Security |
|-----------|---------------|-------|----------|
| **RSA-2048** | 256 bytes | Slow | High |
| **ECDSA P-256** | 64 bytes | Fast | High |
| **ECDSA P-384** | 96 bytes | Fast | Very High |

**ESP32 Preference:** ECDSA P-256
- **4x smaller signatures** than RSA
- **10x faster** computation  
- Same security level

---

## Real IoT Signature Process

```mermaid
sequenceDiagram
    participant D as ESP32 Device
    participant A as AWS IoT Core
    
    D->>D: 1. Generate message hash
    D->>D: 2. Sign hash with private key  
    D->>A: 3. Send message + signature
    A->>A: 4. Hash received message
    A->>A: 5. Verify signature with public key
    A->>D: 6. Accept/Reject message
```

---

## Signature vs Encryption (Key Difference)

| Purpose | Signature | Encryption |
|---------|-----------|------------|
| **Goal** | Prove authenticity | Keep secret |
| **Key Used** | Private key signs | Public key encrypts |
| **Verification** | Public key verifies | Private key decrypts |
| **Anyone Can** | Verify signature | Encrypt messages |
| **Only Owner Can** | Create signature | Decrypt messages |

**Remember:** 
- **Signature = Private key creates, Public key verifies**
- **Encryption = Public key encrypts, Private key decrypts**

---

## Common IoT Signature Use Cases

### **Device Authentication**
```c
// Device proves it has the private key
char device_id[] = "esp32_livingroom_001";
uint8_t signature[64];
ecdsa_sign(device_id, strlen(device_id), signature);
```

### **Command Acknowledgment**
```c
// Confirm command was received
char ack[] = "door_unlocked_timestamp_1693737600";
ecdsa_sign(ack, strlen(ack), signature);
```

### **Firmware Verification**
```c
// Ensure firmware wasn't tampered with
uint8_t firmware_hash[32];
sha256(firmware_binary, firmware_size, firmware_hash);
// AWS signs this hash - device verifies signature
```

---

## What Can Go Wrong?

**❌ Weak Random Number Generation**
```c
// BAD: Predictable signatures
srand(1234);  // Always same seed
```

**✅ Proper Random Generation**
```c
// GOOD: Hardware random number generator
esp_fill_random(signature_nonce, 32);
```

**❌ Signing Without Hash**
- Vulnerable to chosen-message attacks
- Performance issues

**✅ Always Hash First**
```c
sha256(message, message_len, hash);
ecdsa_sign(hash, 32, signature);
```

---

## Terminology You'll Encounter

**DSA** = Digital Signature Algorithm  
**ECDSA** = Elliptic Curve DSA (faster version)  
**Message Digest** = Hash of the original message  
**Signature Verification** = Checking if signature is valid  
**Non-repudiation** = Signer can't deny they signed it  
**Hash-and-Sign** = Standard process (hash first, then sign)  

---

## File Extensions in IoT Projects

```bash
message.txt          # Original message
message.sha256       # Hash of message
message.sig          # Digital signature
certificate.pem      # Contains public key for verification
```

---

## Next Steps

- **Learn about [Digital Certificates →](/en/insights/iot/digital-certificates-explained/)** (how to bundle public keys)
- **Understand [PKCS#11 Storage →](/en/insights/iot/pkcs11-secure-storage-explained/)** (where private keys live)

Digital signatures are how your IoT device proves "Yes, this message really came from me" without revealing its secret private key!