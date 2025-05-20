#!/bin/bash

# Check if input is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <hex_color>"
    echo "Example: $0 #FF00FF or $0 FF00FF"
    exit 1
fi

# Remove # if present
hex=${1#"#"}

# Validate hex length
if [ ${#hex} -ne 6 ]; then
    echo "Error: Hex color must be 6 characters long (RRGGBB)"
    exit 1
fi

# Convert hex to RGB
r=$((16#${hex:0:2}))
g=$((16#${hex:2:2}))
b=$((16#${hex:4:2}))

echo "RGB: $r, $g, $b"
