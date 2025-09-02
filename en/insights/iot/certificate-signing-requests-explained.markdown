---
layout: insight
title: "Certificate Signing Requests (CSR): How IoT Devices Apply for ID Cards"
permalink: /en/insights/iot/certificate-signing-requests-explained/
categories: [IoT, Security, Cryptography]
tags: [csr, certificate-signing-request, x509, iot-provisioning, esp32, aws-iot]
excerpt: "Learn what a CSR is with real examples and code. See how IoT devices create application forms to request certificates from AWS IoT Core."
date: 2025-09-02
author: "Arash Kashi"
---

# Certificate Signing Requests: Your Device's Application Form

Before reading this, understand [Public Keys](/en/insights/iot/public-private-keys-explained/), [Digital Certificates](/en/insights/iot/digital-certificates-explained/), and [PKCS#11](/en/insights/iot/pkcs11-secure-storage-explained/).

A **Certificate Signing Request (CSR)** is like a **job application form** that your IoT device fills out to request an official ID certificate from AWS.

---

## The Job Application Analogy

**Getting a Job:**
1. Fill out application form with your info
2. Submit to HR department
3. HR verifies information
4. HR issues employee badge

**Getting a Certificate:**
1. Create CSR with device info + public key
2. Submit to Certificate Authority (AWS)  
3. AWS verifies CSR signature
4. AWS issues signed certificate

---

## What's Inside a CSR?

```
CERTIFICATE SIGNING REQUEST:
┌─────────────────────────────────────────────┐
│ Device Name: CN=ESP32-LivingRoom-001        │
│ Organization: O=CongruentTech               │
│ Country: C=US                               │
│ Public Key: 04 1a 2b 3c 4d 5e 6f...        │
│ Signature Algorithm: ecdsa-with-SHA256      │  
│                                             │
│ --- SIGNED BY DEVICE'S PRIVATE KEY ---      │
│ 30 45 02 20 7a 8b 9c ad be cf...           │
│ (Proves device owns the private key)        │
└─────────────────────────────────────────────┘
```

**Key Point:** CSR contains **public key** and is signed with **private key** to prove ownership.

---

## Real CSR Example (PEM format)

```pem
-----BEGIN CERTIFICATE REQUEST-----
MIIBVTCBvwIBADBTMQswCQYDVQQGEwJVUzEWMBQGA1UECgwNQ29uZ3J1ZW50VGVj
aDEsMCoGA1UEAwwjRVNQMzItTGl2aW5nUm9vbS0wMDEuY29uZ3J1ZW50dGVjaC5p
bzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABNcY1LGpKhJr4s+1Kzg4Fv1fD8Zx
XnGhJ7j8H4rP6h9sL5fJQV/HdWp2L5cUcGzH8c7CdGnJ7j8Ty6GpKhJr4s+jADAe
BgkqhkiG9w0BCQEWEWFyYXNoQGNvbmdydWVudC5pbzAKBggqhkjOPQQDAgNIADBF
AiEA5c7CdGnJ7j8Ty6GpKhJr4s+1Kzg4Fv1fD8ZxXnGhJ7gCIB3j8H4rP6h9sL5f
JQVHWJD4f8P5X1GzH8c7CdGnJ7j8
-----END CERTIFICATE REQUEST-----
```

This Base64 blob contains the **application form** in X.509 CSR format.

---

## CSR Generation Process

```mermaid
sequenceDiagram
    participant App as IoT Application
    participant P11 as PKCS#11
    participant File as File System
    
    App->>P11: 1. Generate key pair
    P11->>P11: 2. Store private key securely
    App->>P11: 3. Create CSR with public key
    P11->>P11: 4. Sign CSR with private key
    P11->>App: 5. Return CSR
    App->>File: 6. Save CSR to file
```

---

## Real ESP32 Code Example

### **Generate Key Pair and CSR**
```c
esp_err_t generate_csr() {
    CK_SESSION_HANDLE session;
    CK_OBJECT_HANDLE private_key, public_key;
    
    // 1. Generate ECDSA P-256 key pair in PKCS#11
    CK_MECHANISM mechanism = {CKM_EC_KEY_PAIR_GEN, NULL, 0};
    CK_RV rv = C_GenerateKeyPair(session, &mechanism,
                                public_template, 3,
                                private_template, 5,
                                &public_key, &private_key);
    
    // 2. Create CSR using the key pair  
    char csr_buffer[2048];
    size_t csr_length;
    
    esp_err_t ret = generate_device_csr(session, public_key, private_key,
                                       csr_buffer, sizeof(csr_buffer), 
                                       &csr_length);
                                       
    // 3. Save CSR to file
    FILE* csr_file = fopen("/spiffs/device_csr.pem", "w");
    fwrite(csr_buffer, 1, csr_length, csr_file);
    fclose(csr_file);
    
    return ret;
}
```

### **CSR Subject Information**
```c
// What goes in the "application form"
typedef struct {
    char* country;           // "US"
    char* organization;      // "CongruentTech"
    char* common_name;       // "ESP32-LivingRoom-001"
    char* email;            // "arash@congruenttech.io"
} csr_subject_t;

csr_subject_t subject = {
    .country = "US",
    .organization = "CongruentTech",
    .common_name = get_device_serial_number(),
    .email = "arash@congruenttech.io"
};
```

---

## CSR vs Certificate vs Private Key

| Item | Purpose | Contains | Signed By |
|------|---------|----------|-----------|
| **Private Key** | Keep secret | Random number | Nobody |
| **CSR** | Request certificate | Public key + identity | Device's private key |
| **Certificate** | Prove identity | Public key + identity | CA's private key |

**Flow:** Private Key → generates → CSR → becomes → Certificate

---

## CSR Fields Decoded

```bash
# View CSR contents with OpenSSL
openssl req -in device_csr.pem -text -noout
```

**Output explanation:**
```
Certificate Request:
    Data:
        Version: 1 (0x0)
        Subject: CN=ESP32-LivingRoom-001, O=CongruentTech, C=US
        Subject Public Key Info:
            Public Key Algorithm: id-ecPublicKey
                Public-Key: (256 bit)
                pub: 
                    04:1a:2b:3c:4d:5e:6f:7a:8b:9c:ad:be:cf:d0:e1:
                    f2:03:14:25:36:47:58:69:7a:8b:1c:2d:3e:4f:60:
                    71:82:93:a4:b5:c6:d7:e8:f9:0a:1b:2c:3d:4e:5f:
                    70:81:92:a3:b4:c5:d6:e7:f8:09:1a:2b
                ASN1 OID: prime256v1
                NIST CURVE: P-256
    Attributes:
        (none)
    Signature Algorithm: ecdsa-with-SHA256
         30:45:02:20:7a:8b:9c:ad:be:cf:d0:e1:f2:03:14:25:36:47:
         58:69:7a:8b:1c:2d:3e:4f:60:71:82:93:a4:b5:c6:d7:e8:f9:
         02:21:00:0a:1b:2c:3d:4e:5f:70:81:92:a3:b4:c5:d6:e7:f8:
         09:1a:2b:3c:4d:5e:6f:7a:8b:9c:ad:be:cf:d0:e1:f2:03:14
```

---

## Common CSR Attributes

### **Standard Fields**
```c
CN = Common Name (device identifier)
O  = Organization (company name)  
OU = Organizational Unit (department)
C  = Country (2-letter code)
ST = State/Province
L  = Locality (city)
```

### **IoT-Specific Extensions**
```c
// AWS IoT Fleet Provisioning
subjectAltName = DNS:esp32-livingroom-001.iot.congruenttech.io
keyUsage = digitalSignature, keyAgreement
extendedKeyUsage = clientAuth
```

---

## CSR Creation Methods

### **Method 1: OpenSSL Command Line**
```bash
# Generate private key
openssl ecparam -genkey -name prime256v1 -out device_key.pem

# Create CSR
openssl req -new -key device_key.pem -out device_csr.pem \
    -subj "/C=US/O=CongruentTech/CN=ESP32-LivingRoom-001"
```

### **Method 2: ESP32 Runtime Generation**
```c
// Generate everything on-device during first boot
esp_err_t first_boot_provisioning() {
    if (!device_has_certificate()) {
        generate_keys_and_csr();
        send_csr_to_aws();
        wait_for_certificate();
        store_certificate();
    }
}
```

---

## CSR File Sizes

```
ECC P-256 CSR:     ~800 bytes
RSA-2048 CSR:      ~1.2KB
CSR + metadata:    ~1.5KB total
```

**ESP32 Storage:**
```bash
/spiffs/provisioning/
├── device_csr.pem         # 800 bytes
├── device_private_key.pem # 1.1KB (before PKCS#11 import)
└── aws_response.json      # Certificate from AWS
```

---

## CSR Security Considerations

### **✅ Good Practices**
```c
// Generate keys on-device (not pre-generated)
generate_keys_in_pkcs11();

// Use strong subject information
subject.common_name = get_unique_device_id();

// Sign with device's own private key
sign_csr_with_device_key();
```

### **❌ Security Issues**
```c
// BAD: Shared private keys across devices
load_common_private_key();  // Same key for all devices!

// BAD: Predictable serial numbers  
sprintf(serial, "DEVICE-%d", 1);  // Easy to guess

// BAD: Missing verification
// Always verify CSR signature before sending
```

---

## AWS IoT Fleet Provisioning CSR Flow

```mermaid
graph TD
    A[ESP32 Generates Keys] --> B[Create CSR]
    B --> C[Sign CSR with Private Key]
    C --> D[Send CSR to AWS IoT]
    D --> E[AWS Validates CSR Signature]
    E --> F[AWS Generates Certificate]
    F --> G[Device Receives Certificate]
    G --> H[Verify Certificate Public Key]
```

---

## Debugging CSR Issues

### **Invalid Signature**
```
Error: CSR signature verification failed
```
**Solution:** Ensure CSR is signed with correct private key

### **Malformed Subject**
```
Error: Invalid DN (Distinguished Name)
```
**Solution:** Check subject field formatting

### **Wrong Key Type**
```
Error: Unsupported public key algorithm
```
**Solution:** Use ECC P-256 for AWS IoT

---

## Next Steps

- **Learn about [TLS Handshake →](/en/insights/iot/tls-handshake-iot-explained/)** (using your new certificate)
- **Understand [Claim Credentials →](/en/insights/iot/claim-device-credentials-explained/)** (temporary vs permanent)

A CSR is your device's **job application** — it contains your public key and proves you own the matching private key. AWS reviews the application and issues your official certificate!