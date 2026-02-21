#!/bin/bash
# Cross-reference validation script for both knowledge bases
# Scans all pattern .md files, extracts Related Patterns references, checks if targets exist

TOTAL_REFS=0
BROKEN_REFS=0
BROKEN_LIST=""

validate_refs_in_file() {
  local file="$1"
  local dir=$(dirname "$file")
  
  # Check if file has a Related Patterns section
  local in_related=false
  
  while IFS= read -r line; do
    # Detect Related Patterns section
    if echo "$line" | grep -qi "## Related Patterns"; then
      in_related=true
      continue
    fi
    
    # Stop at next section header
    if $in_related && echo "$line" | grep -q "^## "; then
      in_related=false
      continue
    fi
    
    if $in_related; then
      # Extract references in backtick format: `path/to/file.md`
      refs=$(echo "$line" | grep -oP '`[^`]*\.md`' | sed 's/`//g')
      
      # Also extract markdown link format: [text](path/to/file.md)  
      refs2=$(echo "$line" | grep -oP '\]\([^)]*\.md\)' | sed 's/\](\(.*\))/\1/')
      
      # Also extract See [path.md] format (square bracket references)
      refs3=$(echo "$line" | grep -oP '\[([^\]]*\.md)\]' | sed 's/\[\(.*\)\]/\1/' | grep -v '^http')
      
      all_refs="$refs $refs2 $refs3"
      
      for ref in $all_refs; do
        # Skip empty refs
        [ -z "$ref" ] && continue
        
        TOTAL_REFS=$((TOTAL_REFS + 1))
        
        # Try to resolve the reference
        resolved=false
        
        # Try relative to the file's directory
        if [ -f "$dir/$ref" ]; then
          resolved=true
        fi
        
        # Try relative to .nova/bistrolens-knowledge/
        if ! $resolved && [ -f ".nova/bistrolens-knowledge/$ref" ]; then
          resolved=true
        fi
        
        # Try relative to .nova/nova26-patterns/
        if ! $resolved && [ -f ".nova/nova26-patterns/$ref" ]; then
          resolved=true
        fi
        
        # Try relative to .nova/
        if ! $resolved && [ -f ".nova/$ref" ]; then
          resolved=true
        fi
        
        # Try as absolute path from repo root
        if ! $resolved && [ -f "$ref" ]; then
          resolved=true
        fi
        
        # Try stripping leading ../ and resolving
        if ! $resolved; then
          clean_ref=$(echo "$ref" | sed 's|^\.\./||g' | sed 's|^\.\./||g' | sed 's|^\.\./||g')
          if [ -f "$dir/$ref" ] 2>/dev/null; then
            resolved=true
          fi
          # Try from bistrolens root
          if [ -f ".nova/bistrolens-knowledge/$clean_ref" ]; then
            resolved=true
          fi
          # Try from nova26 root
          if [ -f ".nova/nova26-patterns/$clean_ref" ]; then
            resolved=true
          fi
        fi
        
        # Try resolving with realpath-like normalization
        if ! $resolved; then
          normalized=$(cd "$dir" 2>/dev/null && realpath -m --relative-to=. "$ref" 2>/dev/null)
          if [ -n "$normalized" ] && [ -f "$dir/$normalized" ]; then
            resolved=true
          fi
        fi
        
        if ! $resolved; then
          BROKEN_REFS=$((BROKEN_REFS + 1))
          BROKEN_LIST="$BROKEN_LIST\n  FILE: $file\n  REF:  $ref\n"
        fi
      done
    fi
  done < "$file"
}

echo "=== Cross-Reference Validation ==="
echo ""

# Find all .md pattern files in both knowledge bases (exclude INDEX, EXTRACTION, SUMMARY files)
for file in $(find .nova/bistrolens-knowledge .nova/nova26-patterns -name "*.md" -not -name "INDEX.md" -not -name "EXTRACTION-*.md" -not -name "EXTRACTION-SUMMARY.md" -not -name ".gitkeep" | sort); do
  validate_refs_in_file "$file"
done

echo "Total references checked: $TOTAL_REFS"
echo "Broken references found: $BROKEN_REFS"
echo ""

if [ $BROKEN_REFS -gt 0 ]; then
  echo "=== Broken References ==="
  echo -e "$BROKEN_LIST"
fi
