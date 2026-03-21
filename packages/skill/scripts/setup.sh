#!/bin/bash
# Setup script for Hookwing MCP server

set -e

echo "Setting up Hookwing MCP server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Install MCP server globally
echo "Installing @hookwing/mcp..."
npm install -g @hookwing/mcp

# Check for API key
if [ -z "$HOOKWING_API_KEY" ]; then
    echo ""
    echo "Setup complete! To use the MCP server, set your API key:"
    echo ""
    echo "  export HOOKWING_API_KEY=hk_your_key"
    echo ""
    echo "Or add it to your shell profile (~/.bashrc, ~/.zshrc):"
    echo "  echo 'export HOOKWING_API_KEY=hk_your_key' >> ~/.bashrc"
else
    echo "API key detected: ${HOOKWING_API_KEY:0:8}..."
fi

echo ""
echo "To start the MCP server: hookwing-mcp"
echo "For IDE integration, see: https://hookwing.com/docs"
