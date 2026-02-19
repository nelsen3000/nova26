#!/bin/bash
# Continuous Monitoring Script for Nova26
# Run this periodically to validate codebase health

set -e

PROJECT_DIR="/Users/jonathannelsen/nova26"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/monitor_$TIMESTAMP.log"

echo "╔════════════════════════════════════════════════════════════╗" | tee -a "$LOG_FILE"
echo "║       NOVA26 Continuous Monitor - $TIMESTAMP        ║" | tee -a "$LOG_FILE"
echo "╚════════════════════════════════════════════════════════════╝" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# Test Suite
echo "▶ Running test suite..." | tee -a "$LOG_FILE"
if npx vitest run 2>&1 | tail -20 | tee -a "$LOG_FILE"; then
    TEST_STATUS="✅ PASS"
else
    TEST_STATUS="❌ FAIL"
fi

# TypeScript Check
echo "" | tee -a "$LOG_FILE"
echo "▶ TypeScript check..." | tee -a "$LOG_FILE"
if npx tsc --noEmit 2>&1 | tee -a "$LOG_FILE"; then
    TSC_STATUS="✅ PASS"
else
    TSC_STATUS="❌ FAIL"
fi

# Summary
echo "" | tee -a "$LOG_FILE"
echo "╔════════════════════════════════════════════════════════════╗" | tee -a "$LOG_FILE"
echo "║                      SUMMARY                               ║" | tee -a "$LOG_FILE"
echo "╠════════════════════════════════════════════════════════════╣" | tee -a "$LOG_FILE"
echo "║  Tests:    $TEST_STATUS                                      ║" | tee -a "$LOG_FILE"
echo "║  TypeScript: $TSC_STATUS                                  ║" | tee -a "$LOG_FILE"
echo "╚════════════════════════════════════════════════════════════╝" | tee -a "$LOG_FILE"

# Alert if failures
if [ "$TEST_STATUS" = "❌ FAIL" ] || [ "$TSC_STATUS" = "❌ FAIL" ]; then
    echo "🚨 ALERT: Build failures detected!" | tee -a "$LOG_FILE"
    exit 1
fi

echo "✅ All checks passed!" | tee -a "$LOG_FILE"
exit 0
