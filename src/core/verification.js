"use strict";
/**
 * Verification Layer - Structured tool result outcomes
 *
 * Phase 1: Wrap existing success/failure into PASS/FAIL structure
 * No new logic. No behavior changes. Just structured results.
 *
 * WARN semantics not introduced yet - only PASS/FAIL for Phase 1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVerification = createVerification;
exports.wrapToolResult = wrapToolResult;
exports.isVerifiedResult = isVerifiedResult;
exports.getVerificationStatus = getVerificationStatus;
/**
 * Create verification from existing success/failure result
 *
 * Phase 1: Simple mapping - no new logic
 * - success === true → PASS
 * - success === false → FAIL
 */
function createVerification(success, error, exitCode) {
    if (success) {
        return {
            status: 'PASS',
            reason: exitCode !== undefined ? "Exit code ".concat(exitCode) : undefined
        };
    }
    return {
        status: 'FAIL',
        reason: error || (exitCode !== undefined ? "Non-zero exit code: ".concat(exitCode) : 'Execution failed'),
        suggestion: error ? 'Check error details' : 'Check stderr for details'
    };
}
/**
 * Wrap existing tool result with verification
 *
 * Phase 1: Pure wrapper - preserves all existing fields
 */
function wrapToolResult(existingResult, toolName) {
    var success = existingResult.success !== false; // Default to true for backward compat
    return {
        // Add verification
        verification: createVerification(success, existingResult.error, existingResult.exitCode),
        // Preserve all existing fields
        success: success,
        output: existingResult.output,
        stdout: existingResult.stdout,
        stderr: existingResult.stderr,
        exitCode: existingResult.exitCode,
        error: existingResult.error,
        duration: existingResult.duration,
        // Metadata
        timestamp: Date.now(),
        toolName: toolName
    };
}
/**
 * Check if result is verified (has verification field)
 */
function isVerifiedResult(result) {
    return result && typeof result === 'object' && 'verification' in result;
}
/**
 * Extract verification status from any result format
 *
 * Handles both legacy (success: boolean) and new (verification: {...}) formats
 */
function getVerificationStatus(result) {
    if (isVerifiedResult(result)) {
        return result.verification.status;
    }
    // Legacy format
    return result.success !== false ? 'PASS' : 'FAIL';
}
