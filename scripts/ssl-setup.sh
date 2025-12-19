#!/bin/bash
# SSL/TLS Certificate Setup Script - Screenshot_Algo
# Generates self-signed certificates for local development

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CERT_DIR="./certs"
DOMAIN="${1:-localhost}"
DAYS_VALID=365
KEY_SIZE=2048

echo -e "${BLUE}🔐 SSL/TLS Certificate Setup${NC}\n"

# Check for OpenSSL
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ Error: OpenSSL is not installed${NC}"
    echo -e "Install with: brew install openssl (macOS) or apt install openssl (Linux)"
    exit 1
fi

# Create certificates directory
mkdir -p "$CERT_DIR"

echo -e "${YELLOW}1. Generating CA (Certificate Authority)...${NC}"

# Generate CA private key
openssl genrsa -out "$CERT_DIR/ca.key" $KEY_SIZE 2>/dev/null

# Generate CA certificate
openssl req -x509 -new -nodes \
    -key "$CERT_DIR/ca.key" \
    -sha256 \
    -days $DAYS_VALID \
    -out "$CERT_DIR/ca.crt" \
    -subj "/C=DE/ST=State/L=City/O=Screenshot_Algo Dev/CN=Screenshot_Algo CA"

echo -e "${GREEN}  ✓ CA certificate generated${NC}"

echo -e "\n${YELLOW}2. Generating Server Certificate...${NC}"

# Generate server private key
openssl genrsa -out "$CERT_DIR/server.key" $KEY_SIZE 2>/dev/null

# Create certificate signing request (CSR)
openssl req -new \
    -key "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.csr" \
    -subj "/C=DE/ST=State/L=City/O=Screenshot_Algo/CN=$DOMAIN"

# Create certificate extension file
cat > "$CERT_DIR/server.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate server certificate signed by CA
openssl x509 -req \
    -in "$CERT_DIR/server.csr" \
    -CA "$CERT_DIR/ca.crt" \
    -CAkey "$CERT_DIR/ca.key" \
    -CAcreateserial \
    -out "$CERT_DIR/server.crt" \
    -days $DAYS_VALID \
    -sha256 \
    -extfile "$CERT_DIR/server.ext" 2>/dev/null

echo -e "${GREEN}  ✓ Server certificate generated${NC}"

echo -e "\n${YELLOW}3. Creating combined files...${NC}"

# Create combined PEM file
cat "$CERT_DIR/server.crt" "$CERT_DIR/ca.crt" > "$CERT_DIR/server.pem"

# Create PKCS12 file (for browsers/Java)
openssl pkcs12 -export \
    -out "$CERT_DIR/server.p12" \
    -inkey "$CERT_DIR/server.key" \
    -in "$CERT_DIR/server.crt" \
    -certfile "$CERT_DIR/ca.crt" \
    -passout pass:changeit 2>/dev/null

echo -e "${GREEN}  ✓ Combined files created${NC}"

# Clean up temporary files
rm -f "$CERT_DIR/server.csr" "$CERT_DIR/server.ext" "$CERT_DIR/ca.srl"

echo -e "\n${YELLOW}4. Setting permissions...${NC}"
chmod 600 "$CERT_DIR"/*.key
chmod 644 "$CERT_DIR"/*.crt "$CERT_DIR"/*.pem
echo -e "${GREEN}  ✓ Permissions set${NC}"

echo -e "\n${GREEN}✅ SSL certificates generated successfully!${NC}"
echo -e ""
echo -e "${BLUE}Generated files in $CERT_DIR/:${NC}"
echo -e "  • ${YELLOW}ca.key${NC}      - CA private key"
echo -e "  • ${YELLOW}ca.crt${NC}      - CA certificate"
echo -e "  • ${YELLOW}server.key${NC}  - Server private key"
echo -e "  • ${YELLOW}server.crt${NC}  - Server certificate"
echo -e "  • ${YELLOW}server.pem${NC}  - Combined certificate chain"
echo -e "  • ${YELLOW}server.p12${NC}  - PKCS12 bundle (password: changeit)"
echo -e ""
echo -e "${BLUE}Usage in Node.js:${NC}"
echo -e "  const https = require('https');"
echo -e "  const fs = require('fs');"
echo -e ""
echo -e "  const options = {"
echo -e "    key: fs.readFileSync('$CERT_DIR/server.key'),"
echo -e "    cert: fs.readFileSync('$CERT_DIR/server.crt'),"
echo -e "    ca: fs.readFileSync('$CERT_DIR/ca.crt')"
echo -e "  };"
echo -e ""
echo -e "${BLUE}To trust the CA (macOS):${NC}"
echo -e "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/ca.crt"
echo -e ""
echo -e "${YELLOW}⚠ Note: These certificates are for development only!${NC}"
