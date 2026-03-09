#!/bin/bash

# SeMSe 2.0 - Environment Backup Script
# Creates a timestamped backup of .env.local

echo "🔄 Starting backup process..."
echo ""

# 1. Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local not found in project root"
    exit 1
fi

echo "✅ Found .env.local"
echo ""

# 2. Create timestamped backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE=".env.local.backup.$TIMESTAMP"

echo "📦 Creating backup: $BACKUP_FILE"
cp .env.local "$BACKUP_FILE"

# 3. Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    echo "✅ Backup created successfully!"
    echo ""
    
    # Show file info
    echo "📊 Backup details:"
    ls -lh "$BACKUP_FILE"
    echo ""
    
    # Show content for copying to password vault
    echo "📋 Backup content (copy this to your password vault):"
    echo "=================================================="
    cat "$BACKUP_FILE"
    echo "=================================================="
    echo ""
    
    # List all backups
    echo "📚 All existing backups:"
    ls -lh .env.local.backup.* 2>/dev/null || echo "No previous backups found"
    echo ""
    
    echo "✨ Backup complete!"
    echo ""
    echo "⚠️  IMPORTANT: Copy the content above to 1Password/secure vault"
    echo "💡 TIP: You can delete old backups with: rm .env.local.backup.YYYYMMDD_HHMMSS"
else
    echo "❌ Error: Backup failed"
    exit 1
fi