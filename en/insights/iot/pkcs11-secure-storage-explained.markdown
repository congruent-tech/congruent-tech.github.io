---
layout: insight
title: "PKCS#11 Explained: The Safety Deposit Box for Cryptographic Keys"
permalink: /en/insights/iot/pkcs11-secure-storage-explained/
categories: [IoT, Security, Cryptography]
tags: [pkcs11, secure-storage, hardware-security, iot-keys, esp32, cryptoki]
excerpt: "Learn what PKCS#11 is and why IoT devices use it to store private keys securely. See real ESP32 code examples and understand the safety deposit box analogy."
date: 2025-09-02
author: "Arash Kashi"
---

# PKCS#11: The Safety Deposit Box for Your IoT Keys

Before reading this, understand [Private Keys](/en/insights/iot/public-private-keys-explained/) and [Digital Certificates](/en/insights/iot/digital-certificates-explained/).

PKCS#11 is like a **safety deposit box for cryptographic keys** — your private keys go in, but they can never be taken out in plaintext. Only operations (signing, decrypting) can be performed.

---

## The Safety Deposit Box Analogy

**Traditional Bank Safety Deposit Box:**
- You put valuables inside
- Bank keeps it secure
- You need two keys to open it
- Only you can access your box

**PKCS#11 "Crypto" Safety Deposit Box:**
- You put private keys inside  
- Hardware keeps them secure
- You need PIN + physical access
- Keys never leave the box — operations happen inside

---

## What is PKCS#11?

**PKCS#11** = **Public Key Cryptography Standards #11**
- Also called **"Cryptoki"** (Cryptographic Token Interface)
- Industry standard API for accessing crypto hardware
- Like USB driver — same interface for different hardware

```mermaid
graph TD
    A[Your IoT Application] --> B[PKCS#11 API]
    B --> C[Hardware Security Module]
    B --> D[Software Token]  
    B --> E[Smart Card]
    C --> F[Private Keys<br/>Never Extracted]
```

---

## ESP32 Implementation

ESP32 uses **NVS (Non-Volatile Storage)** as PKCS#11 backend:

```c
// PKCS#11 session handle (your safety deposit box key)
CK_SESSION_HANDLE session;

// Open the "bank" (initialize PKCS#11)
CK_RV rv = C_Initialize(NULL);
if (rv != CKR_OK) {
    ESP_LOGE("PKCS11", "Failed to initialize");
}

// Open your "safety deposit box"
CK_SLOT_ID slot = 0;
rv = C_OpenSession(slot, CKF_SERIAL_SESSION | CKF_RW_SESSION,
                   NULL, NULL, &session);
```

---

## Real File Locations in ESP32

```bash
# NVS Partition (binary format)
/dev/nvs_partition
├── pkcs11_prvkey_Device Priv TLS Key
├── pkcs11_pubkey_Device Pub TLS Key  
├── pkcs11_cert_Device Cert TLS
└── pkcs11_prvkey_Claim Priv TLS Key

# SPIFFS (PEM files - before importing)
/spiffs/
├── device_private_key.pem    # Imported to PKCS#11
├── device_certificate.pem    # Stored in PKCS#11
└── claim_certificate.pem     # Imported to PKCS#11
```

---

## PKCS#11 Object Labels (Your Key Tags)

Like labels on safety deposit boxes:

```c
// Standard labels used in IoT
#define DEVICE_PRIVATE_KEY_LABEL  "Device Priv TLS Key"
#define DEVICE_PUBLIC_KEY_LABEL   "Device Pub TLS Key"
#define DEVICE_CERTIFICATE_LABEL  "Device Cert TLS"
#define CLAIM_PRIVATE_KEY_LABEL   "Claim Priv TLS Key"
#define CLAIM_CERTIFICATE_LABEL   "Claim Cert TLS"

// Find objects by label
CK_OBJECT_HANDLE find_private_key() {
    CK_ATTRIBUTE template[] = {
        {CKA_CLASS, &private_key_class, sizeof(private_key_class)},
        {CKA_LABEL, DEVICE_PRIVATE_KEY_LABEL, strlen(DEVICE_PRIVATE_KEY_LABEL)}
    };
    
    CK_OBJECT_HANDLE key_handle;
    // Search for key with this label...
    return key_handle;
}
```

---

## PKCS#11 Operations (What You Can Do)

### **Store Private Key (Import)**
```c
esp_err_t store_private_key(const char* pem_data) {
    CK_ATTRIBUTE template[] = {
        {CKA_CLASS, &private_key_class, sizeof(private_key_class)},
        {CKA_KEY_TYPE, &key_type, sizeof(key_type)},
        {CKA_LABEL, DEVICE_PRIVATE_KEY_LABEL, strlen(DEVICE_PRIVATE_KEY_LABEL)},
        {CKA_PRIVATE, &true_val, sizeof(true_val)},
        {CKA_SIGN, &true_val, sizeof(true_val)}
    };
    
    CK_OBJECT_HANDLE key_handle;
    return C_CreateObject(session, template, 5, &key_handle);
}
```

### **Sign Message (Private Key Never Leaves)**
```c
esp_err_t sign_message(const uint8_t* message, size_t msg_len, 
                      uint8_t* signature, size_t* sig_len) {
    CK_OBJECT_HANDLE key_handle = find_private_key();
    
    // Key stays in PKCS#11 — only signature comes out
    return C_Sign(session, (CK_BYTE_PTR)message, msg_len,
                  signature, sig_len);
}
```

### **Generate Key Pair (Born in the Safe)**
```c
esp_err_t generate_device_keys() {
    CK_MECHANISM mechanism = {CKM_EC_KEY_PAIR_GEN, NULL, 0};
    
    CK_OBJECT_HANDLE public_key, private_key;
    
    // Keys generated inside PKCS#11 — private key never extracted
    return C_GenerateKeyPair(session, &mechanism,
                            public_template, pub_attr_count,
                            private_template, priv_attr_count,
                            &public_key, &private_key);
}
```

---

## Security Benefits

### **Hardware-Backed Security**
```
Regular File Storage:
Private Key → [RAM] → Application can read → ❌ RISKY

PKCS#11 Storage:  
Private Key → [Secure Partition] → Only operations → ✅ SECURE
```

### **Attack Resistance**
- **Memory dumps** can't extract keys
- **Malware** can't steal key material
- **Physical attacks** need specialized equipment
- **Debug interfaces** can't access keys

---

## What PKCS#11 Functions Look Like

```c
// The "C_" prefix means PKCS#11 standard function
CK_RV C_Initialize(CK_VOID_PTR pInitArgs);
CK_RV C_OpenSession(CK_SLOT_ID slotID, CK_FLAGS flags, ...);
CK_RV C_CreateObject(CK_SESSION_HANDLE hSession, ...);
CK_RV C_Sign(CK_SESSION_HANDLE hSession, ...);
CK_RV C_Verify(CK_SESSION_HANDLE hSession, ...);
CK_RV C_Encrypt(CK_SESSION_HANDLE hSession, ...);
CK_RV C_Decrypt(CK_SESSION_HANDLE hSession, ...);
CK_RV C_GenerateKeyPair(CK_SESSION_HANDLE hSession, ...);
```

**Return Values:**
- `CKR_OK` = Success
- `CKR_OBJECT_HANDLE_INVALID` = Key not found
- `CKR_PIN_INVALID` = Wrong authentication
- `CKR_DEVICE_MEMORY` = Storage full

---

## ESP32 vs Hardware Security Module (HSM)

| Feature | ESP32 NVS | Hardware HSM |
|---------|-----------|--------------|
| **Security** | Good | Excellent |
| **Cost** | $2-5 | $100-1000 |
| **Speed** | Fast | Very Fast |
| **Tamper Resistance** | Basic | Military Grade |
| **Certification** | None | FIPS 140-2 |
| **IoT Suitability** | ✅ Perfect | ❌ Overkill |

---

## Common PKCS#11 Terminology

**Token** = The secure storage device (ESP32's NVS partition)  
**Slot** = Physical or logical connector to token  
**Session** = Active connection to perform operations  
**Object** = Keys, certificates stored in token  
**Handle** = Reference number to find objects  
**Template** = Attributes describing what you want to store/find  

---

## Debugging PKCS#11 Issues

### **Key Not Found**
```c
if (key_handle == CK_INVALID_HANDLE) {
    ESP_LOGE("PKCS11", "Private key not found - check label");
}
```

### **Storage Full**
```c
if (rv == CKR_DEVICE_MEMORY) {
    ESP_LOGE("PKCS11", "NVS partition full - erase and reflash");
}
```

### **List All Objects**
```c
void debug_list_objects() {
    CK_OBJECT_HANDLE objects[10];
    CK_ULONG count;
    
    C_FindObjectsInit(session, NULL, 0);
    C_FindObjects(session, objects, 10, &count);
    
    ESP_LOGI("PKCS11", "Found %lu objects", count);
}
```

---

## Memory Usage

```c
// Typical ESP32 PKCS#11 memory usage
NVS Partition: 32KB (configured in partition table)
├── Private Keys: ~2KB total
├── Certificates: ~4KB total  
├── Public Keys: ~1KB total
└── Metadata: ~1KB
         Free: ~24KB
```

---

## Next Steps

- **Learn about [Certificate Signing Requests →](/en/insights/iot/certificate-signing-requests-explained/)** (how to get certificates)
- **Understand [TLS Handshake →](/en/insights/iot/tls-handshake-iot-explained/)** (using PKCS#11 keys)

PKCS#11 is your **crypto safety deposit box** — keys go in securely, operations happen inside, but secrets never come out. Perfect for protecting IoT device identity!