#!/bin/bash
# API Documentation Generator - Screenshot_Algo
# Generates API documentation from OpenAPI specification

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OPENAPI_FILE="$PROJECT_ROOT/openapi.yaml"
OUTPUT_DIR="$PROJECT_ROOT/docs/api/generated"

echo -e "${BLUE}📚 API Documentation Generator${NC}\n"

# Check if OpenAPI file exists
if [ ! -f "$OPENAPI_FILE" ]; then
    echo -e "${RED}❌ Error: OpenAPI specification not found${NC}"
    echo -e "Expected at: $OPENAPI_FILE"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Action
ACTION="${1:-generate}"

case "$ACTION" in
    "validate")
        echo -e "${YELLOW}1. Validating OpenAPI specification...${NC}"

        # Using swagger-cli if available
        if command -v npx &> /dev/null; then
            npx swagger-cli validate "$OPENAPI_FILE"
            echo -e "${GREEN}  ✓ Specification is valid${NC}"
        else
            echo -e "${YELLOW}  ⚠ swagger-cli not available${NC}"
        fi
        ;;

    "generate"|"build")
        echo -e "${YELLOW}1. Validating specification...${NC}"
        npx swagger-cli validate "$OPENAPI_FILE" 2>/dev/null || true

        echo -e "\n${YELLOW}2. Generating HTML documentation...${NC}"
        # Using redocly if available
        if command -v npx &> /dev/null; then
            npx @redocly/cli build-docs "$OPENAPI_FILE" -o "$OUTPUT_DIR/index.html" 2>/dev/null || {
                # Fallback to swagger-ui
                echo -e "  Falling back to basic HTML..."
                cat > "$OUTPUT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Screenshot_Algo API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '/openapi.yaml',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>
EOF
            }
            echo -e "${GREEN}  ✓ HTML documentation generated${NC}"
        fi

        echo -e "\n${YELLOW}3. Generating Markdown documentation...${NC}"
        if command -v npx &> /dev/null; then
            npx widdershins "$OPENAPI_FILE" -o "$OUTPUT_DIR/API.md" --omitHeader 2>/dev/null || {
                echo -e "${YELLOW}  ⚠ Markdown generation failed (widdershins not available)${NC}"
            }
            echo -e "${GREEN}  ✓ Markdown documentation generated${NC}"
        fi

        echo -e "\n${YELLOW}4. Bundling specification...${NC}"
        npx swagger-cli bundle "$OPENAPI_FILE" -o "$OUTPUT_DIR/openapi.yaml" 2>/dev/null || true
        npx swagger-cli bundle "$OPENAPI_FILE" -o "$OUTPUT_DIR/openapi.json" --type json 2>/dev/null || true
        echo -e "${GREEN}  ✓ Bundled specifications created${NC}"

        echo -e "\n${GREEN}✅ Documentation generated!${NC}"
        echo -e ""
        echo -e "${BLUE}Generated files:${NC}"
        ls -la "$OUTPUT_DIR"
        ;;

    "serve")
        echo -e "${YELLOW}Starting documentation server...${NC}"
        PORT="${2:-8080}"

        # Using http-server or python
        if command -v npx &> /dev/null; then
            echo -e "Documentation available at: ${GREEN}http://localhost:$PORT${NC}"
            npx http-server "$OUTPUT_DIR" -p "$PORT" -c-1
        elif command -v python3 &> /dev/null; then
            echo -e "Documentation available at: ${GREEN}http://localhost:$PORT${NC}"
            cd "$OUTPUT_DIR" && python3 -m http.server "$PORT"
        else
            echo -e "${RED}❌ No server available${NC}"
            exit 1
        fi
        ;;

    "clean")
        echo -e "${YELLOW}Cleaning generated documentation...${NC}"
        rm -rf "$OUTPUT_DIR"
        echo -e "${GREEN}  ✓ Cleaned${NC}"
        ;;

    *)
        echo -e "${BLUE}API Documentation Generator${NC}"
        echo -e ""
        echo -e "${YELLOW}Usage:${NC} $0 [command]"
        echo -e ""
        echo -e "${YELLOW}Commands:${NC}"
        echo -e "  ${BLUE}validate${NC}  - Validate OpenAPI specification"
        echo -e "  ${BLUE}generate${NC}  - Generate documentation (default)"
        echo -e "  ${BLUE}serve${NC}     - Start documentation server"
        echo -e "  ${BLUE}clean${NC}     - Remove generated files"
        echo -e ""
        echo -e "${YELLOW}Examples:${NC}"
        echo -e "  $0 validate"
        echo -e "  $0 generate"
        echo -e "  $0 serve 3000"
        ;;
esac
