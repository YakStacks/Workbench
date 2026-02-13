/**
 * Workbench Core - Runtime Foundation
 * 
 * Core responsibilities:
 * - Tool contract enforcement
 * - Execution orchestration via Runners
 * - Verification
 * - Policy enforcement (future)
 * - Event emission (future)
 * - Doctor diagnostics (future)
 * 
 * Core does NOT:
 * - Implement specific tools
 * - Contain UI logic
 * - Depend on application features
 * - Hardcode language implementations
 */

export {
  // Runner system
  Runner,
  ShellRunner,
  RunnerRegistry,
  runnerRegistry,
  
  // Types
  ToolSpec,
  ExecutionPlan,
  ExecutionResult,
  VerificationOutcome,
} from './runner';

export {
  // Verification system
  VerificationStatus,
  VerifiedToolResult,
  createVerification,
  wrapToolResult,
  isVerifiedResult,
  getVerificationStatus,
} from './verification';
