/**
 * Template Types — define the shape of workspace templates.
 *
 * Templates allow the New Workspace wizard to create pre-configured
 * workspaces with seeded chat messages, artifacts, and auto-run actions.
 *
 * No `any`. Use `unknown` for flexible payloads.
 */

export type TemplateId =
  | "butler.session"
  | "maestro.session"
  | "doctor.runAndAttach"
  | "pipewrench.diagnose"
  | "note.blank";

export interface WorkspaceTemplate {
  id: TemplateId;
  /** Display title in the wizard UI. */
  title: string;
  /** Short description shown on the template card. */
  description: string;
  /** Must match a registered appId. */
  appId: string;
  /** Title assigned to the workspace on creation. */
  defaultWorkspaceTitle: string;

  /** Optional seed chat messages (injected into chatStore on create). */
  seedChat?: Array<
    | { role: "system" | "assistant" | "user"; content: string }
    | {
        role: "tool";
        toolName: string;
        status?: "requested" | "running" | "success" | "error";
        input?: unknown;
        output?: unknown;
      }
  >;

  /** Optional seed artifacts (injected into artifactStore on create). */
  seedArtifacts?: Array<{
    kind: "note" | "json" | "text";
    title: string;
    content: string;
  }>;

  /** Optional actions to run immediately after workspace is created/opened. */
  runOnCreate?: Array<
    { kind: "doctor" } | { kind: "tool"; toolName: string; input?: unknown }
  >;

  /** Which inner tab to activate when the workspace first opens. */
  defaultPane?: "chat" | "artifacts" | "runs";
}
