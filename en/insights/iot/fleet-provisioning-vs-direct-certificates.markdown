---
layout: insight
title: "Fleet Provisioning vs Direct Certificates: Choosing the Right AWS IoT Authentication Strategy"
permalink: /en/insights/iot/fleet-provisioning-vs-direct-certificates/
categories: [IoT, AWS, Security]
tags: [aws-iot, fleet-provisioning, direct-certificates, esp32, iot-authentication, certificates, scalability]
excerpt: "Compare AWS IoT Fleet Provisioning and Direct Certificate methods. Learn the pros, cons, and use cases to choose the right authentication strategy for your IoT project."
date: 2025-09-05
author: "Arash Kashi"
---

# Fleet Provisioning vs Direct Certificates: The Authentication Decision

When connecting IoT devices to AWS IoT Core, you have two main authentication approaches: **Fleet Provisioning** (automated certificate generation) and **Direct Certificate Provisioning** (pre-installed certificates). Think of it as the difference between a **hotel key card system** and **personal house keys**.

This comparison comes from real implementation experience with both approaches in ESP32-based locker control systems.

---

## Quick Comparison Table

| Aspect | Fleet Provisioning | Direct Certificates |
|--------|-------------------|-------------------|
| **Setup Complexity** | High (CBOR, CSR, templates) | Low (copy certificates) |
| **Scaling** | Excellent (1000s devices) | Manual (per-device work) |
| **Security** | High (unique per device) | High (if managed properly) |
| **Factory Setup** | One-time claim cert install | Per-device cert install |
| **Debugging** | Complex (multi-step flow) | Simple (direct connection) |
| **Certificate Management** | Automated via AWS | Manual via AWS CLI/Console |
| **First Connection** | Slower (provisioning flow) | Immediate |
| **Best For** | Mass production | Prototypes, small deployments |

---

## Fleet Provisioning: The Hotel Key Card System

Fleet Provisioning is like a hotel where every guest gets a unique key card automatically generated at check-in.

### How It Works

```mermaid
sequenceDiagram
    participant Factory as Factory
    participant Device as ESP32 Device  
    participant AWS as AWS IoT Core
    participant Registry as Thing Registry
    
    Factory->>Device: 1. Install claim credentials (shared)
    Device->>Device: 2. Generate unique device keys
    Device->>AWS: 3. Connect with claim credentials
    Device->>AWS: 4. Send CSR (Certificate Signing Request)
    AWS->>Registry: 5. Create Thing + Certificate
    AWS->>Device: 6. Return device certificate
    Device->>Device: 7. Store device certificate securely
    Device->>AWS: 8. Reconnect with device credentials
```

### Real Implementation Example

From our ESP32 locker controller implementation:

```c
// 1. Connect with claim credentials
esp_err_t fleet_provisioning_start(void) {
    // Use shared claim certificate to connect
    mqtt_connect_with_claim_credentials();
    
    // 2. Generate device key pair
    generate_device_key_pair();
    
    // 3. Create Certificate Signing Request
    create_csr_with_device_key();
    
    // 4. Send provisioning request via MQTT
    publish_provisioning_request();
    return ESP_OK;
}

// CBOR-encoded message sent to AWS
void publish_provisioning_request(void) {
    // Publish to: $aws/certificates/create/cbor
    cbor_encode_map(&encoder, 1);
    cbor_encode_text_string(&encoder, "certificateSigningRequest");
    cbor_encode_byte_string(&encoder, csr_der, csr_len);
}
```

### Pros of Fleet Provisioning

**🏭 Factory Efficiency**
- **One claim certificate** for thousands of devices
- No per-device certificate handling in factory
- Reduces manufacturing complexity and errors

**🔒 Enhanced Security**
- Each device gets **unique credentials**
- Claim certificates have **limited permissions** (can only provision)
- Device certificates can be **individually revoked**

**📈 Massive Scalability** 
- Deploy 10,000 devices with same factory process
- AWS handles certificate generation automatically
- No manual AWS CLI operations per device

**🎯 Professional Device Management**
- Automatic Thing creation in registry
- Consistent device naming and tagging
- Built-in device lifecycle management

### Cons of Fleet Provisioning

**🔧 Implementation Complexity**
```c
// Complex multi-stage process
typedef enum {
    FLEET_PROV_STATE_CLAIM_CONNECT,
    FLEET_PROV_STATE_GENERATE_KEYS, 
    FLEET_PROV_STATE_CREATE_CSR,
    FLEET_PROV_STATE_SEND_REQUEST,
    FLEET_PROV_STATE_RECEIVE_CERT,
    FLEET_PROV_STATE_DEVICE_CONNECT,
    FLEET_PROV_STATE_COMPLETE
} fleet_prov_state_t;
```

**🐛 Debugging Challenges**
- Multi-step process with many failure points
- CBOR encoding/decoding complexity
- Network timing dependencies
- Harder to isolate connection issues

**💾 Memory Requirements**
- Need to handle claim AND device certificates
- CBOR parsing libraries
- CSR generation libraries
- More complex state management

**⏱️ First Connection Delay**
- Provisioning flow adds 10-30 seconds on first boot
- Network dependent (can fail and retry)
- Not suitable for devices needing immediate connectivity

---

## Direct Certificates: The House Key Approach

Direct Certificate Provisioning is like having your own house key - unique, personal, and immediately usable.

### How It Works

```mermaid
sequenceDiagram
    participant Factory as Factory
    participant AWS as AWS CLI/Console
    participant Device as ESP32 Device
    participant IoTCore as AWS IoT Core
    
    AWS->>AWS: 1. Create Thing + Certificate
    AWS->>Factory: 2. Download device certificate files
    Factory->>Device: 3. Install certificate files
    Device->>IoTCore: 4. Connect immediately with device certs
    IoTCore->>Device: 5. Authenticate and establish MQTT
```

### Real Implementation Example

From our ESP32 locker controller:

```bash
# AWS CLI to create device credentials
./aws-iot-manage.sh create-device locker-controller-101

# Generates:
# - device.cert.pem (device certificate)  
# - device.private.key (device private key)
# - AmazonRootCA1.pem (root CA certificate)
```

```c
// Simple ESP32 connection code
esp_err_t aws_iot_direct_connect(void) {
    // Load certificates from SPIFFS
    cert_manager_config_t config = {
        .device_cert_path = "/spiffs/device.cert.pem",
        .device_key_path = "/spiffs/device.private.key", 
        .root_ca_path = "/spiffs/AmazonRootCA1.pem"
    };
    
    cert_manager_init(&config);
    
    // Connect directly - no provisioning flow needed
    return mqtt_connect_with_device_certificates();
}
```

### Pros of Direct Certificates

**⚡ Immediate Connection**
- Device connects instantly on first boot
- No multi-step provisioning flow
- Perfect for time-sensitive applications

**🔍 Simple Debugging**
- Single connection attempt
- Clear success/failure points  
- Easy to test with AWS CLI tools
- Standard TLS connection logs

**💾 Lower Memory Footprint**
- No CBOR libraries needed
- No CSR generation code
- Simpler certificate management
- Single MQTT connection state

**🛠️ Development Friendly**
- Quick prototyping and testing
- Easy certificate replacement
- Clear certificate expiry handling
- Standard ESP-IDF TLS libraries

### Cons of Direct Certificates

**🏭 Factory Complexity**
- Each device needs **unique certificate files**
- Manual certificate-to-device mapping
- Higher risk of factory errors
- More complex quality control

**📊 Scaling Challenges**
```bash
# Manual process for each device
for device in {101..150}; do
    ./aws-iot-manage.sh create-device locker-controller-${device}
    # Manual certificate installation per device
done
```

**🔐 Security Considerations**
- Certificates exist in **plain text** during manufacturing
- Risk of certificate reuse if process fails
- More complex certificate lifecycle management
- Harder to implement certificate rotation

**💼 Management Overhead**
- Manual AWS Thing creation
- Manual certificate tracking
- Manual revocation process
- No automated device registry updates

---

## Use Case Decision Matrix

### Choose Fleet Provisioning When:

**🏭 Mass Production (100+ devices)**
```
Volume: 1000+ devices
Factory: Automated assembly line  
Security: High (each device unique)
Timeline: Can invest in upfront development
```

**🔒 High Security Requirements**
- Financial services IoT devices
- Industrial control systems
- Medical device connectivity
- Government/defense applications

**📈 Long-term Scalability**
- Planning for thousands of devices
- Multiple product variants
- Global deployment strategy
- Professional device management needed

### Choose Direct Certificates When:

**🔬 Prototyping & Development**
```c
// Quick test setup
#define DEVICE_COUNT 5
#define DEVELOPMENT_BUILD
```

**🏢 Small to Medium Deployments (<100 devices)**
- Office building sensors
- Retail store systems
- Small industrial installations
- University research projects

**⚡ Immediate Connectivity Required**
- Emergency response systems
- Real-time monitoring devices
- Time-critical applications
- Simple device replacement scenarios

**🛠️ Development Phase**
- Proof of concept projects
- Beta testing programs
- Certificate testing and validation
- Debugging connectivity issues

---

## Implementation Recommendations

### For Fleet Provisioning

```c
// Recommended architecture
typedef struct {
    fleet_prov_state_t state;
    char claim_cert_path[64];
    char device_cert_path[64]; 
    uint32_t retry_count;
    bool provisioning_complete;
} fleet_prov_context_t;

// Implement robust state machine
esp_err_t fleet_prov_state_machine(fleet_prov_context_t *ctx) {
    switch(ctx->state) {
        case FLEET_PROV_STATE_CLAIM_CONNECT:
            return handle_claim_connection(ctx);
        case FLEET_PROV_STATE_GENERATE_KEYS:
            return handle_key_generation(ctx);
        // ... handle all states with error recovery
    }
}
```

### For Direct Certificates  

```c
// Recommended certificate management
typedef struct {
    char device_cert[2048];
    char device_key[2048];
    char root_ca[2048];
    time_t cert_expiry;
    bool cert_valid;
} direct_cert_context_t;

// Simple validation and connection
esp_err_t direct_cert_connect(direct_cert_context_t *ctx) {
    if (!validate_certificate_expiry(ctx)) {
        return ESP_ERR_INVALID_STATE;
    }
    return mqtt_connect_with_certs(ctx);
}
```

---

## Security Best Practices

### Fleet Provisioning Security

1. **Claim Certificate Restrictions**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow", 
    "Action": [
      "iot:Connect",
      "iot:Subscribe",
      "iot:Publish"
    ],
    "Resource": [
      "arn:aws:iot:*:*:topic/$aws/certificates/*",
      "arn:aws:iot:*:*:topic/$aws/provisioning-templates/*"
    ]
  }]
}
```

2. **Device Certificate Full Access**
- Only after successful provisioning
- Individual certificate revocation capability
- Proper Thing registry management

### Direct Certificate Security

1. **Factory Security**
- Encrypt certificate storage during manufacturing
- Implement certificate-to-device audit trail
- Secure certificate transfer protocols

2. **Device Security**  
- Use secure storage (NVS encryption)
- Implement certificate validation
- Monitor certificate expiry dates

---

## Cost Analysis

### Fleet Provisioning Costs

**Development Phase:**
- Higher initial development cost (complex implementation)
- CBOR library integration
- State machine development and testing

**Operational Phase:**
- Lower per-device manufacturing cost
- Reduced factory complexity
- Automated certificate management

### Direct Certificate Costs

**Development Phase:**
- Lower initial development cost (simple implementation)
- Standard TLS implementation
- Faster time to market

**Operational Phase:**
- Higher per-device manufacturing cost
- Manual certificate management overhead  
- Scaling limitations

---

## Conclusion

The choice between Fleet Provisioning and Direct Certificates depends on your specific use case:

- **Fleet Provisioning**: Best for mass production, high security requirements, and long-term scalability
- **Direct Certificates**: Ideal for prototyping, small deployments, and scenarios requiring immediate connectivity

For our locker controller project, we successfully implemented **Direct Certificates** for rapid development and testing, with the flexibility to migrate to Fleet Provisioning for production deployment.

Both approaches are valid AWS IoT authentication strategies - choose based on your project scale, security requirements, and development timeline.

---

## Related Articles

- [AWS IoT Fleet Provisioning Flow](/en/insights/iot/aws-iot-fleet-provisioning-flow/)
- [Certificate Signing Requests Explained](/en/insights/iot/certificate-signing-requests-explained/) 
- [Claim vs Device Credentials](/en/insights/iot/claim-device-credentials-explained/)
- [TLS Handshake in IoT](/en/insights/iot/tls-handshake-iot-explained/)