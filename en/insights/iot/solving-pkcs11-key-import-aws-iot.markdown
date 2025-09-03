---
layout: insight
title: "Solving PKCS#11 Key Import Issues in AWS IoT Fleet Provisioning"
permalink: /en/insights/iot/solving-pkcs11-key-import-aws-iot/
categories: [IoT, Security, AWS]
tags: [esp32, pkcs11, aws-iot, fleet-provisioning, mbedtls, embedded]
excerpt: "We hit a persistent PKCS#11 error when importing AWS claim certificates for ESP32 Fleet Provisioning. Here's how understanding the fundamental difference between internal key generation and external key import led to an elegant solution."
date: 2025-09-03
author: "Arash Kashi"
---

# Solving PKCS#11 Key Import Issues in AWS IoT Fleet Provisioning

Working on ESP32-C6 firmware for a smart locker controller, we ran into a stubborn `CKR_ATTRIBUTE_VALUE_INVALID` error when trying to import AWS claim certificates into PKCS#11 secure storage. After multiple failed attempts at parameter formatting, the solution came from understanding a fundamental design principle.

---

## The Problem: Import vs. Generation

AWS IoT Fleet Provisioning uses a two-tier authentication system:
- **Claim certificates**: Temporary RSA credentials (external, provided by AWS)
- **Device certificates**: Permanent ECDSA credentials (internal, generated on-device)

Our ESP32 firmware needed to:
1. Store AWS-provided claim certificates in PKCS#11
2. Generate device keys internally using PKCS#11
3. Use claim certs to request permanent device certificates from AWS

Simple enough, right?

---

## The Persistent Error

```
E (4053) device_provisioning: ❌ PKCS#11 error: 0x00000012 (CKR_ATTRIBUTE_VALUE_INVALID)
E (4063) device_provisioning: 💡 Failed to store RSA private key in secure storage
```

This `CKR_ATTRIBUTE_VALUE_INVALID` error appeared whenever we tried to import the external RSA claim keys into PKCS#11 storage.

---

## Our Failed Attempts

### 1. **RSA Parameter Formatting**
We suspected the 2048-bit RSA parameters weren't formatted correctly:

```c
// Tried fixing public exponent alignment
unsigned char compactExponent[] = {0x01, 0x00, 0x01};
pubExpTemplate.pValue = compactExponent;
pubExpTemplate.ulValueLen = sizeof(compactExponent);
```

**Result**: Same error.

### 2. **Minimal Templates**
Maybe we were providing too many RSA parameters:

```c
// Stripped down to only essential attributes
CK_ATTRIBUTE privateKeyTemplate[] = {
    {CKA_CLASS, &privateKeyClass, sizeof(privateKeyClass)},
    {CKA_MODULUS, modulus, modulusLen},
    {CKA_PRIVATE_EXPONENT, privateExponent, privateExponentLen}
};
```

**Result**: Same error.

### 3. **Parameter Padding Investigation**
We even examined the raw modulus and private exponent for alignment issues.

**Result**: Parameters looked correct, but same error persisted.

---

## The Breakthrough Insight

The user made a crucial observation: **"is that we can not push an object in PKCS#11 and the keys should be created inside of them?"**

This hit the nail on the head. PKCS#11 is fundamentally designed for:
- **Internal key generation** (using `C_GenerateKeyPair`)
- **Cryptographic operations on internally-managed keys**

It's **not designed** for importing external keys, especially complex ones like RSA private keys with multiple parameters.

---

## The Elegant Solution: Hybrid Approach

Instead of forcing external keys into PKCS#11, we implemented a hybrid approach:

### Device Keys → PKCS#11 (Internal Generation)
```c
// Generate ECDSA P-256 device keys internally in PKCS#11
CK_MECHANISM mechanism = {CKM_EC_KEY_PAIR_GEN, NULL, 0};
CK_OBJECT_HANDLE privateKey, publicKey;

result = C_GenerateKeyPair(session, &mechanism, publicKeyTemplate, 
                          publicTemplateCount, privateKeyTemplate, 
                          privateTemplateCount, &publicKey, &privateKey);
```

### Claim Keys → MbedTLS Direct (External Import)
```c
// Load claim credentials directly with MbedTLS
typedef struct {
    mbedtls_x509_crt claim_cert;
    mbedtls_pk_context claim_key;
    bool initialized;
} claim_credentials_t;

// Parse directly without PKCS#11
mbedtls_x509_crt_parse(&credentials->claim_cert, cert_buffer, cert_len + 1);
mbedtls_pk_parse_key(&credentials->claim_key, key_buffer, key_len + 1, 
                     NULL, 0, NULL, NULL);
```

---

## Why This Works Better

### 1. **Follows Design Intent**
- PKCS#11 handles what it's designed for: internal key generation
- MbedTLS handles external key parsing naturally

### 2. **Better Security Model**
- Device keys never leave secure hardware storage
- Claim keys are temporary and can be handled in regular memory

### 3. **Cleaner Architecture**
```
┌─────────────────┐    ┌─────────────────┐
│   Claim Keys    │    │  Device Keys    │
│   (External)    │    │  (Internal)     │
│                 │    │                 │
│  ┌─────────────┐│    │ ┌─────────────┐ │
│  │   MbedTLS   ││    │ │   PKCS#11   │ │
│  │   Direct    ││    │ │  Secure     │ │
│  │   Loading   ││    │ │  Storage    │ │
│  └─────────────┘│    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘
      ↓                        ↓
  AWS Fleet            Device Certificate
  Provisioning         Signing & Storage
```

---

## The Fix in Action

### Before: Persistent Errors
```
E (4053) device_provisioning: ❌ PKCS#11 error: 0x00000012
E (4063) device_provisioning: Failed RSA parameter formatting attempts
E (4073) device_provisioning: CRT parameter issues
E (4083) device_provisioning: Multiple template variations failed
```

### After: Clean Success
```
I (7050) device_provisioning: ✅ Claim certificate parsed successfully
I (7130) device_provisioning: ✅ Claim private key parsed successfully
I (7140) device_provisioning: 🔑 Key type: RSA (correct for AWS claim credentials)
I (7160) device_provisioning: 🎉 Claim credentials loaded successfully with MbedTLS!
```

---

## Lessons Learned

### 1. **Understand the Tool's Purpose**
PKCS#11 isn't a general-purpose key storage system. It's a cryptographic token interface designed for hardware security modules and internal key generation.

### 2. **Don't Force Square Pegs into Round Holes**
When a tool repeatedly resists your approach, step back and question whether you're using it correctly.

### 3. **Hybrid Approaches Are Often Better**
Using the right tool for each job (PKCS#11 for secure generation, MbedTLS for external parsing) created a more robust solution than trying to make one tool do everything.

### 4. **Security Models Matter**
The hybrid approach actually improved our security posture:
- Device keys stay in hardware security
- Claim keys have appropriate (temporary) handling

---

## Final Architecture

Our final AWS IoT Fleet Provisioning flow:

1. **WiFi Connection** → Basic connectivity established
2. **PKCS#11 Init** → Secure storage system ready  
3. **Device Key Generation** → ECDSA P-256 keys in secure storage
4. **Claim Credentials Loading** → MbedTLS direct parsing
5. **MQTT Provisioning** → Uses hybrid credential approach
6. **Certificate Exchange** → Secure device certificate obtained

The key insight: **Use each tool for what it's designed to do, rather than trying to make one tool handle everything.**

---

## Impact

This solution eliminated the persistent `CKR_ATTRIBUTE_VALUE_INVALID` errors and created a more maintainable, secure architecture for ESP32 AWS IoT integration. The hybrid approach is now part of our standard IoT device provisioning pattern.