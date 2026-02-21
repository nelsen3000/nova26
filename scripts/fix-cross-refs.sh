#!/bin/bash
# Build a lookup table of all pattern filenames -> their full paths
# Then fix broken references in all pattern files

declare -A FILE_LOOKUP

echo "Building file lookup table..."

# Index all .md pattern files in both knowledge bases
for f in $(find .nova/bistrolens-knowledge -name "*.md" -not -name "INDEX.md" -not -name "EXTRACTION-TASK-LIST.md" -not -name "EXTRACTION-SUMMARY.md"); do
  basename=$(basename "$f")
  # Store relative to .nova/
  FILE_LOOKUP["$basename"]="$f"
done

for f in $(find .nova/nova26-patterns -name "*.md" -not -name "INDEX.md" -not -name "EXTRACTION-TASK-LIST.md" -not -name ".gitkeep"); do
  basename=$(basename "$f")
  FILE_LOOKUP["$basename"]="$f"
done

echo "Indexed ${#FILE_LOOKUP[@]} pattern files."
echo ""

# Print the lookup for debugging
for key in "${!FILE_LOOKUP[@]}"; do
  echo "  $key -> ${FILE_LOOKUP[$key]}"
done | sort

echo ""
echo "=== Scanning for broken references ==="

FIXES=0

fix_file() {
  local file="$1"
  local dir=$(dirname "$file")
  local modified=0
  local tmpfile=$(mktemp)
  
  local in_related=0
  
  while IFS= read -r line || [ -n "$line" ]; do
    # Detect Related Patterns section
    if echo "$line" | grep -qi "^## Related Patterns"; then
      in_related=1
      echo "$line" >> "$tmpfile"
      continue
    fi
    # Exit section on next ## heading
    if [ "$in_related" -eq 1 ] && echo "$line" | grep -q "^## "; then
      in_related=0
      echo "$line" >> "$tmpfile"
      continue
    fi
    
    if [ "$in_related" -eq 1 ]; then
      newline="$line"
      # Extract all backtick-wrapped .md references
      refs=$(echo "$line" | grep -oE '`[^`]*\.md`' | sed 's/`//g')
      for ref in $refs; do
        # Check if this ref resolves
        resolved="$dir/$ref"
        resolved_norm=$(realpath --relative-to=. "$resolved" 2>/dev/null || echo "NOTFOUND")
        
        if [ ! -f "$resolved_norm" ] || [ "$resolved_norm" = "NOTFOUND" ]; then
          # Try to find the target file by basename
          target_basename=$(basename "$ref")
          target_path="${FILE_LOOKUP[$target_basename]}"
          
          if [ -n "$target_path" ] && [ -f "$target_path" ]; then
            # Compute relative path from current file's directory to target
            new_ref=$(realpath --relative-to="$dir" "$target_path")
            # Replace in the line
            escaped_ref=$(echo "$ref" | sed 's/[\/&]/\\&/g')
            escaped_new=$(echo "$new_ref" | sed 's/[\/&]/\\&/g')
            newline=$(echo "$newline" | sed "s|\`${escaped_ref}\`|\`${escaped_new}\`|")
            echo "FIX: $file: \`$ref\` -> \`$new_ref\`"
            FIXES=$((FIXES + 1))
            modified=1
          else
            echo "UNFIXABLE: $file: \`$ref\` (target basename '$target_basename' not found in any knowledge base)"
          fi
        fi
      done
      echo "$newline" >> "$tmpfile"
    else
      echo "$line" >> "$tmpfile"
    fi
  done < "$file"
  
  if [ "$modified" -eq 1 ]; then
    cp "$tmpfile" "$file"
  fi
  rm -f "$tmpfile"
}

# Fix BistroLens patterns
for f in $(find .nova/bistrolens-knowledge -name "*.md" -not -name "INDEX.md" -not -name "EXTRACTION-TASK-LIST.md" -not -name "EXTRACTION-SUMMARY.md" | sort); do
  fix_file "$f"
done

# Fix Nova26 patterns
for f in $(find .nova/nova26-patterns -name "*.md" -not -name "INDEX.md" -not -name "EXTRACTION-TASK-LIST.md" -not -name ".gitkeep" | sort); do
  fix_file "$f"
done

echo ""
echo "=== FIXES APPLIED: $FIXES ==="
