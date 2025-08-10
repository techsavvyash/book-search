#!/bin/bash

echo "🚀 Setting up Children's Literature Analysis Server..."

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun is installed"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Google Gemini API Configuration (preferred name)
GOOGLE_API_KEY=your_google_api_key_here

# Alternative API key name (for backward compatibility)
# GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000

# Optional: Enable debug logging
DEBUG=true
EOF
    echo "⚠️  Please update .env file with your actual Google API key"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your GOOGLE_API_KEY in the .env file"
echo "2. Run: bun run dev"
echo "3. Server will be available at http://localhost:3000"
echo "" 