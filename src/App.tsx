import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {} from 'react/jsx-runtime';
import { DEFAULT_FEATURE_FLAGS, FeatureFlags, mergeFeatureFlags } from './featureFlags';

const TABS = ['Chat', 'Tools', 'Running', 'Files', 'Chains', 'Settings'] as const;
type Tab = typeof TABS[number];

type Tool = { 
  name: string; 
  description?: string;
  inputSchema: any; 
  category: string;
  _sourceFolder?: string;
  _sourcePath?: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  timestamp: Date;
  isStreaming?: boolean;
};

type FileEntry = {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileEntry[];
};

type ChainPreset = {
  id: string;
  name: string;
  steps: { tool: string; input: any; outputKey: string }[];
};

declare global {
  interface Window {
    workbench: any;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const colors = {
  bg: '#0f0f0f',
  bgSecondary: '#1a1a1a',
  bgTertiary: '#252525',
  border: '#333',
  text: '#e5e5e5',
  textMuted: '#888',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

const styles = {
  app: { 
    display: 'flex', 
    flexDirection: 'column' as const, 
    height: '100vh', 
    background: colors.bg, 
    color: colors.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  baseFontSize: 14,
  header: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.bgSecondary,
    padding: '0 16px',
    gap: 4,
  },
  tab: {
    padding: '14px 24px',
    border: 'none',
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
    marginBottom: -1,
  },
  tabActive: {
    color: colors.text,
    borderBottomColor: colors.primary,
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
  },
  card: {
    background: colors.bgSecondary,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    padding: 16,
    marginBottom: 12,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    background: colors.bgTertiary,
    color: colors.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  buttonPrimary: { background: colors.primary, color: 'white' },
  buttonSuccess: { background: colors.success, color: 'white' },
  buttonDanger: { background: colors.danger, color: 'white' },
  buttonGhost: { background: 'transparent', color: colors.textMuted, border: `1px solid ${colors.border}` },
  label: { display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13, color: colors.textMuted },
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [tab, setTab] = useState<Tab>('Chat');
  const [tools, setTools] = useState<Tool[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chainPresets, setChainPresets] = useState<ChainPreset[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [showCrashRecovery, setShowCrashRecovery] = useState(false);
  const [interruptedRuns, setInterruptedRuns] = useState<any[]>([]);
  
  // Tool-in-chat state
  const [pendingTool, setPendingTool] = useState<{ tool: Tool; input: any } | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<{toolName: string, retry: () => void} | null>(null);

  // V2: Auto-doctor notification state
  const [autoDoctorReport, setAutoDoctorReport] = useState<any>(null);

  const onRequestPermission = useCallback((toolName: string, retry: () => void) => {
    setPermissionRequest({ toolName, retry });
  }, []);

  useEffect(() => {
    window.workbench.listTools().then(setTools);
    
    // Check for crash recovery
    window.workbench.runs.hasInterrupted().then((hasInterrupted: boolean) => {
      if (hasInterrupted) {
        window.workbench.runs.getInterrupted().then((runs: any[]) => {
          if (runs && runs.length > 0) {
            setInterruptedRuns(runs);
            setShowCrashRecovery(true);
          }
        });
      }
    });
    
    // Load chat history
    window.workbench.chat.load().then((result: any) => {
      if (result.success && result.history && result.history.length > 0) {
        setChatHistory(result.history);
      }
    });

    // V2: Listen for auto-doctor reports
    const unsubDoctor = window.workbench.doctor.onAutoReport((report: any) => {
      setAutoDoctorReport(report);
    });
    return () => { unsubDoctor(); };
    // Load saved presets and apply font settings
    window.workbench.getConfig().then((cfg: any) => {
      if (cfg.chainPresets) setChainPresets(cfg.chainPresets);
      setFeatureFlags(mergeFeatureFlags(cfg.featureFlags));
      // Apply saved font settings globally
      if (cfg.fontSize) {
        document.documentElement.style.fontSize = cfg.fontSize + 'px';
      }
      if (cfg.fontFamily) {
        document.documentElement.style.fontFamily = cfg.fontFamily;
      }
    });
  }, []);

  // Save chat history whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      window.workbench.chat.save(chatHistory);
    }
  }, [chatHistory]);

  const openToolInChat = (tool: Tool) => {
    setTab('Chat');
    setPendingTool({ tool, input: {} });
  };

  return (
    <div style={styles.app}>
      {/* V2: Auto-doctor notification banner */}
      {autoDoctorReport && (
        <DoctorNotificationBanner
          report={autoDoctorReport}
          onDismiss={() => setAutoDoctorReport(null)}
        />
      )}
      <div style={styles.header}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={styles.main}>
        {tab === 'Chat' && (
          <ChatTab 
            tools={tools} 
            history={chatHistory} 
            setHistory={setChatHistory}
            pendingTool={pendingTool}
            setPendingTool={setPendingTool}
            onRequestPermission={onRequestPermission}
          />
        )}
        {tab === 'Tools' && <ToolsTab tools={tools} onOpenInChat={openToolInChat} onRefresh={() => window.workbench.refreshTools().then(setTools)} onRequestPermission={onRequestPermission} featureFlags={featureFlags} />}
        {tab === 'Running' && <RunningTab featureFlags={featureFlags} />}
        {tab === 'Files' && <FilesTab />}
        {tab === 'Chains' && <ChainsTab tools={tools} presets={chainPresets} setPresets={setChainPresets} />}

        {tab === 'Settings' && <SettingsTab featureFlags={featureFlags} setFeatureFlags={setFeatureFlags} />}
      </div>
      {permissionRequest && (
        <PermissionPrompt 
          toolName={permissionRequest.toolName} 
          onAllow={() => {
            permissionRequest.retry();
            setPermissionRequest(null);
          }}
          onDeny={() => setPermissionRequest(null)}
          onClose={() => setPermissionRequest(null)}
        />
      )}
      
      {showCrashRecovery && interruptedRuns.length > 0 && (
        <CrashRecoveryModal 
          runs={interruptedRuns}
          onClose={() => {
            window.workbench.runs.clearInterrupted();
            setShowCrashRecovery(false);
            setInterruptedRuns([]);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// V2: TOOL APPROVAL GATE COMPONENT
// ============================================================================

function ToolApprovalGate({ tool, input, onInputChange, onApprove, onReject }: {
  tool: Tool;
  input: any;
  onInputChange: (values: any) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [riskInfo, setRiskInfo] = useState<any>(null);

  useEffect(() => {
    window.workbench.guardrails.assessRisk(tool.name, input)
      .then(setRiskInfo)
      .catch(() => setRiskInfo(null));
  }, [tool.name, JSON.stringify(input)]);

  const riskLevel = riskInfo?.riskLevel || 'medium';
  const riskColors: Record<string, string> = { low: colors.success, medium: colors.warning, high: colors.danger };
  const riskLabels: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };

  return (
    <div style={{ padding: 16, borderTop: `1px solid ${colors.border}`, background: colors.bgSecondary }}>
      {/* Header with risk indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Tool: {tool.name}</span>
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            background: (riskColors[riskLevel] || colors.warning) + '20',
            color: riskColors[riskLevel] || colors.warning,
          }}>
            {riskLabels[riskLevel] || 'Medium'} Risk
          </span>
        </div>
        <button onClick={onReject} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}>x</button>
      </div>

      {/* Action summary */}
      {riskInfo?.proposal?.summary && (
        <div style={{
          padding: '8px 12px',
          background: colors.bgTertiary,
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
          borderLeft: `3px solid ${riskColors[riskLevel] || colors.warning}`,
        }}>
          {riskInfo.proposal.summary}
        </div>
      )}

      {/* Input form */}
      <ToolInputForm
        tool={tool}
        values={input}
        onChange={onInputChange}
      />

      {/* Approve / Reject buttons */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          Approve & Run
        </button>
        <button
          onClick={onReject}
          style={{ ...styles.button, ...styles.buttonGhost }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// V2: AUTO-DOCTOR NOTIFICATION BANNER
// ============================================================================

function DoctorNotificationBanner({ report, onDismiss }: { report: any; onDismiss: () => void }) {
  if (!report) return null;

  return (
    <div style={{
      padding: '10px 16px',
      background: colors.warning + '20',
      borderBottom: `1px solid ${colors.warning}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Doctor Report Available</span>
        <span style={{ color: colors.textMuted }}>
          ({report.summary?.pass || 0} pass, {report.summary?.warn || 0} warn, {report.summary?.fail || 0} fail)
        </span>
        {report.triggerReason && (
          <span style={{ color: colors.textMuted, fontSize: 11 }}>
            | Triggered by: {report.triggerReason}
          </span>
        )}
      </div>
      <button onClick={onDismiss} style={{ ...styles.button, ...styles.buttonGhost, padding: '2px 8px', fontSize: 12 }}>
        Dismiss
      </button>
    </div>
  );
}

// ============================================================================
// V2: ASSET UPLOAD PANEL
// ============================================================================

function AssetPanel() {
  const [assets, setAssets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadAssets = useCallback(async () => {
    try {
      const result = await window.workbench.assets.list();
      setAssets(result.assets || []);
    } catch { setAssets([]); }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleUpload = async () => {
    setUploading(true);
    try {
      const result = await window.workbench.assets.upload();
      if (result?.success) {
        await loadAssets();
      }
    } catch (e: any) {
      console.error('Upload failed:', e.message);
    }
    setUploading(false);
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Delete this asset?')) return;
    await window.workbench.assets.delete(assetId);
    await loadAssets();
  };

  const handleExport = async (assetId: string) => {
    await window.workbench.assets.export(assetId);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Assets ({assets.length})</h3>
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      </div>

      {assets.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textMuted, padding: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>No assets uploaded</div>
          <div style={{ fontSize: 12 }}>Upload files to use them with tools via asset_id</div>
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {assets.map((asset: any) => (
            <div key={asset.asset_id} style={{
              padding: '8px 12px',
              borderRadius: 6,
              marginBottom: 6,
              background: colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13,
            }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.filename}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>
                  {asset.mime_type} | {formatSize(asset.size)} | {asset.asset_id}
                </div>
              </div>
              <button onClick={() => handleExport(asset.asset_id)} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px', fontSize: 11 }}>
                Export
              </button>
              <button onClick={() => handleDelete(asset.asset_id)} style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px', fontSize: 11 }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHAT TAB - Messenger Style with Tool Integration
// ============================================================================

function ChatTab({ 
  tools, 
  history, 
  setHistory, 
  pendingTool, 
  setPendingTool,
  onRequestPermission
}: { 
  tools: Tool[];
  history: Message[];
  setHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  pendingTool: { tool: Tool; input: any } | null;
  setPendingTool: React.Dispatch<React.SetStateAction<{ tool: Tool; input: any } | null>>;
  onRequestPermission: (toolName: string, retry: () => void) => void;
}) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [taskType, setTaskType] = useState('writer_cheap');
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [toolFilter, setToolFilter] = useState('');
  const [sessionCost, setSessionCost] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load costs on mount and update periodically
  useEffect(() => {
    const loadCosts = () => {
      window.workbench.costs.get().then(setSessionCost);
    };
    loadCosts();
    const interval = setInterval(loadCosts, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // Handle slash commands
  useEffect(() => {
    if (input.startsWith('/')) {
      setShowToolPicker(true);
      setToolFilter(input.slice(1));
    } else if (input === '' && !showToolPicker) {
      // Keep picker open if it was opened via button
    } else if (input.length > 0 && !input.startsWith('/')) {
      // Close if typing regular text (not from button)
      if (toolFilter === '') {
        // Only close if filter is empty (opened via button)
      }
    }
  }, [input]);

  // Update filter when picker is open
  useEffect(() => {
    if (showToolPicker && input.startsWith('/')) {
      setToolFilter(input.slice(1));
    }
  }, [input, showToolPicker]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    // Build conversation context
    const messages = [...history, userMsg].map(m => ({
      role: m.role === 'tool' ? 'assistant' : m.role,
      content: m.role === 'tool' 
        ? `[Tool: ${m.toolName}]\nInput: ${JSON.stringify(m.toolInput)}\nOutput: ${m.content}`
        : m.content
    }));

    // Create placeholder for assistant response
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setHistory(prev => [...prev, assistantMsg]);

    let fullResponse = '';
    
    try {
      await window.workbench.runTaskStream(taskType, messages.map(m => `${m.role}: ${m.content}`).join('\n\n'), {
        onChunk: (data: any) => {
          fullResponse = data.content;
          setHistory(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, content: data.content } : m
          ));
        },
        onDone: async (data: any) => {
          fullResponse = data.content;
          
          setHistory(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, content: data.content, isStreaming: false } : m
          ));
          
          // Auto-detect and offer to save plugin code
          const codeMatch = fullResponse.match(/```javascript\s*([\s\S]*?module\.exports\.register[\s\S]*?)```/);
          
          if (codeMatch) {
            const pluginCode = codeMatch[1].trim();
            const nameMatch = pluginCode.match(/name:\s*['"]([^'"]+)['"]/);
            
            if (nameMatch) {
              const toolName = nameMatch[1];
              const pluginFolder = toolName.replace(/\./g, '_');
              
              // Show auto-save suggestion
              const saveMsg: Message = {
                id: `msg_${Date.now()}_save`,
                role: 'system',
                content: `💾 Plugin code detected! Automatically saving to plugins/${pluginFolder}/index.js...`,
                timestamp: new Date(),
              };
              setHistory(prev => [...prev, saveMsg]);
              
              try {
                // Save the plugin
                await window.workbench.savePlugin(pluginFolder, pluginCode);
                
                // Update message
                setHistory(prev => prev.map(m => 
                  m.id === saveMsg.id 
                    ? { ...m, content: `✅ Plugin saved! Restart the app to load "${toolName}".` }
                    : m
                ));
              } catch (error: any) {
                setHistory(prev => prev.map(m => 
                  m.id === saveMsg.id 
                    ? { ...m, content: `❌ Failed to save: ${error.message}` }
                    : m
                ));
              }
            }
          }
          
          setIsStreaming(false);
        },
        onError: (data: any) => {
          const errorMessage = data.error || 'Unknown error';
          let userFriendlyError = errorMessage;
          
          // Make errors more user-friendly
          if (errorMessage.includes('No model configured')) {
            userFriendlyError = '⚠️ No model configured. Please go to Settings tab and configure a model for the selected role.';
          } else if (errorMessage.includes('No OpenRouter API key')) {
            userFriendlyError = '⚠️ No API key configured. Please go to Settings tab and add your OpenRouter API key.';
          } else if (errorMessage.includes('status code 400') || errorMessage.includes('status code 404')) {
            userFriendlyError = '⚠️ Invalid model or API request. Please check your Settings and ensure the model ID is correct.';
          }
          
          setHistory(prev => prev.map(m => 
            m.id === assistantMsgId ? { ...m, content: userFriendlyError, isStreaming: false } : m
          ));
          setIsStreaming(false);
        }
      });
    } catch (e: any) {
      setHistory(prev => prev.map(m => 
        m.id === assistantMsgId ? { ...m, content: `Error: ${e.message}`, isStreaming: false } : m
      ));
      setIsStreaming(false);
    }
  };

  const runToolInChat = async (tool: Tool, toolInput: any) => {
    // V2: Assess risk and show visible tool call info
    let riskInfo: any = null;
    try {
      riskInfo = await window.workbench.guardrails.assessRisk(tool.name, toolInput);
    } catch { /* guardrails not available */ }

    const riskLevel = riskInfo?.riskLevel || 'medium';
    const riskColors: Record<string, string> = { low: colors.success, medium: colors.warning, high: colors.danger };
    const riskLabels: Record<string, string> = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk' };

    // V2: Show tool call proposal in chat
    const proposalMsgId = `msg_${Date.now()}_proposal`;
    const proposalMsg: Message = {
      id: proposalMsgId,
      role: 'system',
      content: `Tool: ${tool.name}\nArguments: ${JSON.stringify(toolInput, null, 2)}\nRisk: ${riskLabels[riskLevel] || 'Unknown'}\n${riskInfo?.proposal?.summary || ''}`,
      timestamp: new Date(),
    };
    setHistory(prev => [...prev, proposalMsg]);

    const runningMsgId = `msg_${Date.now()}_running`;
    const runningMsg: Message = {
      id: runningMsgId,
      role: 'system',
      content: `Executing ${tool.name}...`,
      timestamp: new Date(),
    };
    setHistory(prev => [...prev, runningMsg]);
    setPendingTool(null);

    try {
      const result = await window.workbench.runTool(tool.name, toolInput);
      
      // Result is now standardized: { content, metadata?, error? }
      setHistory(prev => prev.filter(m => m.id !== runningMsgId));
      
      // Check if this tool returns a prompt that should be sent to LLM
      const hasPromptFlag = result.metadata?.suggestedRole || result.metadata?.note?.includes('LLM');
      const isPromptTool = hasPromptFlag || result.prompt;
      
      if (isPromptTool && !result.error) {
        // This is a prompt-based tool (like ASAM) - send to LLM automatically
        const promptText = result.prompt || (typeof result.content === 'string' ? result.content : null);
        
        if (promptText) {
          // Update status message
          setHistory(prev => [...prev, {
            id: `msg_${Date.now()}_llm`,
            role: 'system',
            content: `Processing through LLM (${result.metadata?.suggestedRole || 'writer_cheap'})...`,
            timestamp: new Date(),
          }]);
          
          // Send to LLM
          const llmResult = await window.workbench.runTask(
            result.metadata?.suggestedRole || 'writer_cheap',
            promptText
          );
          
          // Remove status and add final result
          setHistory(prev => prev.filter(m => !m.id.includes('_llm')));
          
          const toolMsg: Message = {
            id: `msg_${Date.now()}`,
            role: 'tool',
            content: llmResult.content,
            toolName: tool.name,
            toolInput: toolInput,
            toolOutput: llmResult,
            timestamp: new Date(),
          };
          setHistory(prev => [...prev, toolMsg]);
          return;
        }
      }
      
      // Standard tool output (not a prompt)
      let displayContent = '';
      if (typeof result.content === 'string') {
        displayContent = result.content;
      } else if (Array.isArray(result.content)) {
        displayContent = result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
      }
      
      // Check if there's an error
      if (result.error) {
        displayContent = `❌ Error: ${displayContent}`;
      }
      
      const toolMsg: Message = {
        id: `msg_${Date.now()}`,
        role: 'tool',
        content: displayContent,
        toolName: tool.name,
        toolInput: toolInput,
        toolOutput: result,
        timestamp: new Date(),
      };
      setHistory(prev => [...prev, toolMsg]);
      
    } catch (e: any) {
      if (e.message.includes('PERMISSION_REQUIRED:')) {
         const name = e.message.split('PERMISSION_REQUIRED:')[1].trim();
         onRequestPermission(name, () => runToolInChat(tool, toolInput));
         return;
      }
      // V2: Show structured error with recovery suggestions
      const errorContent = [
        `Error: ${e.message}`,
        '',
        'Suggested actions:',
        '- Check the tool input parameters',
        '- Run System Diagnostics (Settings > Doctor)',
        e.message.includes('loop') ? '- A failure loop was detected. Try a different approach.' : '',
        e.message.includes('sandbox') ? '- The file path is outside the workspace. Update Safe Paths in Settings.' : '',
        e.message.includes('guardrails') ? '- The command was blocked for safety. Review the command.' : '',
      ].filter(Boolean).join('\n');

      setHistory(prev => prev.map(m =>
        m.id === runningMsgId ? { ...m, content: errorContent } : m
      ));
    }
  };

  const selectToolFromPicker = (tool: Tool) => {
    setShowToolPicker(false);
    setInput('');
    setPendingTool({ tool, input: {} });
  };

  const clearChat = () => {
    setHistory([]);
    window.workbench.chat.clear();
  };

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(toolFilter.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {history.length === 0 && !pendingTool && (
          <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: 100 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Start a conversation</div>
            <div style={{ fontSize: 14 }}>Type a message or use /tool-name to run a tool</div>
          </div>
        )}
        
        {history.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Tool picker dropdown */}
      {showToolPicker && (
        <div style={{
          position: 'absolute',
          bottom: 130,
          left: 16,
          right: 16,
          maxHeight: 350,
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}` }}>
            <input
              type="text"
              placeholder="Search tools..."
              value={toolFilter}
              onChange={e => setToolFilter(e.target.value)}
              style={styles.input}
              autoFocus
            />
          </div>
          <div style={{ flex: 1, overflow: 'auto', maxHeight: 280 }}>
            {filteredTools.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: colors.textMuted }}>
                No tools found
              </div>
            ) : (
              filteredTools.slice(0, 15).map(tool => (
                <div
                  key={tool.name}
                  onClick={() => selectToolFromPicker(tool)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.bgTertiary)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{tool.name}</div>
                  {tool.description && (
                    <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{tool.description}</div>
                  )}
                </div>
              ))
            )}
          </div>
          <div style={{ padding: 8, borderTop: `1px solid ${colors.border}`, textAlign: 'right' }}>
            <button 
              onClick={() => { setShowToolPicker(false); setToolFilter(''); }}
              style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 12px', fontSize: 12 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pending tool form - V2 Approval Gate */}
      {pendingTool && (
        <ToolApprovalGate
          tool={pendingTool.tool}
          input={pendingTool.input}
          onInputChange={(values) => setPendingTool({ ...pendingTool, input: values })}
          onApprove={() => runToolInChat(pendingTool.tool, pendingTool.input)}
          onReject={() => setPendingTool(null)}
        />
      )}

      {/* Input area */}
      <div style={{ padding: 16, borderTop: `1px solid ${colors.border}`, background: colors.bgSecondary }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <select 
            value={taskType} 
            onChange={e => setTaskType(e.target.value)}
            style={{ ...styles.input, width: 140, padding: '6px 10px' }}
          >
            <option value="writer_cheap">Writer</option>
            <option value="structurer">Structurer</option>
            <option value="coder_cheap">Coder</option>
            <option value="reviewer">Reviewer</option>
          </select>
          {sessionCost && (
            <div style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto', marginRight: 8 }}>
              💰 ${sessionCost.total.toFixed(4)} ({sessionCost.requests} reqs)
            </div>
          )}
          <button onClick={clearChat} style={{ ...styles.button, ...styles.buttonGhost }}>Clear</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowToolPicker(!showToolPicker)}
            style={{ 
              ...styles.button, 
              ...styles.buttonGhost,
              padding: '10px 12px',
              fontSize: 18,
              background: showToolPicker ? colors.primary : 'transparent',
              color: showToolPicker ? 'white' : colors.textMuted,
            }}
            title="Select a tool"
          >
            🔧
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message... (/ for tools, Enter to send)"
            style={{ 
              ...styles.input, 
              flex: 1, 
              resize: 'none',
              minHeight: 44,
              maxHeight: 120,
            }}
            rows={1}
          />
          <button 
            onClick={sendMessage} 
            disabled={isStreaming || !input.trim()}
            style={{ 
              ...styles.button, 
              ...styles.buttonPrimary,
              opacity: isStreaming || !input.trim() ? 0.5 : 1,
            }}
          >
            {isStreaming ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: 12,
        background: isUser ? colors.primary : isTool ? colors.bgTertiary : isSystem ? 'transparent' : colors.bgSecondary,
        border: isTool ? `1px solid ${colors.border}` : isSystem ? 'none' : `1px solid ${colors.border}`,
        color: isSystem ? colors.textMuted : colors.text,
        fontStyle: isSystem ? 'italic' : 'normal',
      }}>
        {isTool && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            🔧 {message.toolName}
          </div>
        )}
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>
          {message.content}
          {message.isStreaming && <span style={{ opacity: 0.5 }}>▊</span>}
        </div>
        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {message.timestamp instanceof Date ? message.timestamp.toLocaleTimeString() : new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function ToolInputForm({ tool, values, onChange }: { tool: Tool; values: any; onChange: (v: any) => void }) {
  const props = tool.inputSchema?.properties || {};
  
  if (Object.keys(props).length === 0) {
    return <div style={{ color: colors.textMuted, fontSize: 13 }}>No parameters required</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Object.entries(props).map(([key, prop]: [string, any]) => {
        const isTextArea = key.toLowerCase().includes('content') || 
                          key.toLowerCase().includes('text') || 
                          key.toLowerCase().includes('asam') ||
                          key.toLowerCase().includes('previous') ||
                          key.toLowerCase().includes('code');
        return (
          <div key={key}>
            <label style={styles.label}>
              {key} {tool.inputSchema.required?.includes(key) && <span style={{ color: colors.danger }}>*</span>}
            </label>
            {prop.enum ? (
              <select
                value={values[key] || ''}
                onChange={e => onChange({ ...values, [key]: e.target.value })}
                style={styles.input}
              >
                <option value="">Select...</option>
                {prop.enum.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : prop.type === 'boolean' ? (
              <input
                type="checkbox"
                checked={values[key] || false}
                onChange={e => onChange({ ...values, [key]: e.target.checked })}
              />
            ) : isTextArea ? (
              <textarea
                value={values[key] || ''}
                onChange={e => onChange({ ...values, [key]: e.target.value })}
                style={{ ...styles.input, minHeight: 80, fontFamily: 'monospace' }}
                placeholder={prop.description}
              />
            ) : (
              <input
                type={prop.type === 'number' ? 'number' : 'text'}
                value={values[key] || ''}
                onChange={e => onChange({ ...values, [key]: prop.type === 'number' ? Number(e.target.value) : e.target.value })}
                style={styles.input}
                placeholder={prop.description}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TOOLS TAB
// ============================================================================

function ToolsTab({ tools, onOpenInChat, onRefresh, onRequestPermission, featureFlags }: { 
  tools: Tool[]; 
  onOpenInChat: (t: Tool) => void; 
  onRefresh: () => void;
  onRequestPermission: (toolName: string, retry: () => void) => void;
  featureFlags: FeatureFlags;
}) {
  const [selected, setSelected] = useState<Tool | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [toolCode, setToolCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [toolHealth, setToolHealth] = useState<any>(null);
  const [knownIssueInput, setKnownIssueInput] = useState('');
  const [diagnosticSuggestions, setDiagnosticSuggestions] = useState<any[]>([]);
  const [safeFixPreview, setSafeFixPreview] = useState<any>(null);
  const [safeFixLoading, setSafeFixLoading] = useState(false);

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.description?.toLowerCase().includes(filter.toLowerCase())
  );

  const categories = [...new Set(filteredTools.map(t => t.category))].sort();

  const selectTool = (tool: Tool) => {
    setSelected(tool);
    setFormValues({});
    setOutput('');
    setShowEditor(false);
    setToolCode('');
    setDiagnosticSuggestions([]);
    setSafeFixPreview(null);
  };

  const refreshToolHealth = async (toolName: string) => {
    if (!featureFlags.L_TOOL_HEALTH_SIGNALS) {
      setToolHealth(null);
      return;
    }
    try {
      const result = await window.workbench.toolHealth.get(toolName);
      setToolHealth(result);
    } catch {
      setToolHealth(null);
    }
  };

  useEffect(() => {
    if (!selected) {
      setToolHealth(null);
      return;
    }
    refreshToolHealth(selected.name);
  }, [selected, featureFlags.L_TOOL_HEALTH_SIGNALS]);

  const loadDiagnosticSuggestions = async (toolName: string, errorMessage: string) => {
    try {
      const result = await window.workbench.doctor.suggestFailure(toolName, errorMessage);
      setDiagnosticSuggestions(result?.suggestions || []);
    } catch {
      setDiagnosticSuggestions([]);
    }
  };

  const addKnownIssue = async () => {
    if (!selected || !knownIssueInput.trim()) return;
    const result = await window.workbench.toolHealth.addKnownIssue(
      selected.name,
      knownIssueInput.trim(),
    );
    if (result?.success) {
      setKnownIssueInput('');
      refreshToolHealth(selected.name);
    }
  };

  const removeKnownIssue = async (index: number) => {
    if (!selected) return;
    const result = await window.workbench.toolHealth.removeKnownIssue(
      selected.name,
      index,
    );
    if (result?.success) {
      refreshToolHealth(selected.name);
    }
  };

  const previewSafeFix = async (fixId: string) => {
    setSafeFixLoading(true);
    try {
      const result = await window.workbench.safeFix.preview(fixId);
      if (result?.success) {
        setSafeFixPreview(result);
      } else if (result?.error) {
        alert(result.error);
      }
    } finally {
      setSafeFixLoading(false);
    }
  };

  const applySafeFix = async () => {
    const token = safeFixPreview?.token;
    if (!token) return;
    const confirmed = confirm('Apply this safe fix? You can revert it manually in Settings.');
    if (!confirmed) return;
    const result = await window.workbench.safeFix.apply(token);
    if (!result?.success) {
      alert(result?.error || 'Failed to apply safe fix');
      return;
    }
    alert('Safe fix applied.');
    setSafeFixPreview(null);
  };

  const loadToolCode = async (tool: Tool) => {
    if (!tool._sourceFolder) {
      setToolCode('// Built-in tool - source code not available');
      return;
    }
    try {
      const fs = await window.workbench.runTool('builtin.readFile', { 
        path: tool._sourcePath || `plugins/${tool._sourceFolder}/index.js` 
      });
      if (fs.content) {
        setToolCode(fs.content);
      } else {
        setToolCode('// Failed to load tool code');
      }
    } catch (e: any) {
      if (e.message.includes('PERMISSION_REQUIRED:')) {
         const name = e.message.split('PERMISSION_REQUIRED:')[1].trim();
         onRequestPermission(name, () => loadToolCode(tool));
         return;
      }
      setToolCode(`// Error loading code: ${e.message}`);
    }
  };

  const saveToolCode = async () => {
    if (!selected?._sourceFolder || !toolCode) return;
    setSavingCode(true);
    try {
      await window.workbench.runTool('builtin.writeFile', {
        path: selected._sourcePath || `plugins/${selected._sourceFolder}/index.js`,
        content: toolCode
      });
      setShowEditor(false);
      onRefresh(); // Reload tools
    } catch (e: any) {
      if (e.message.includes('PERMISSION_REQUIRED:')) {
         const name = e.message.split('PERMISSION_REQUIRED:')[1].trim();
         onRequestPermission(name, () => saveToolCode());
         setSavingCode(false);
         return;
      }
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSavingCode(false);
    }
  };

  const deleteTool = async () => {
    if (!selected) return;
    if (selected.category === 'BUILTIN') {
      // should check category properly, but builtin tools usually don't have _sourceFolder anyway?
      // Actually v0.4.1 builtin tools might not have it.
      // Better check:
      alert('Cannot delete built-in tools');
      return;
    }
    if (!selected._sourceFolder) {
      alert('Cannot delete: source folder unknown');
      return;
    }
    const confirmed = confirm(`Delete tool "${selected.name}"? This cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await window.workbench.deletePlugin(selected._sourceFolder);
      onRefresh(); // Refresh tools list
      // Deselect
      // We need to pass a callback or manage state?
      // ToolsTab props: { tools, onOpenInChat, onRefresh }
      // It doesn't seem to control selection from outside.
      // But we can just refresh.
    } catch (e: any) {
      alert(`Error deleting: ${e.message}`);
    }
  };

  const runTool = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      if (testMode) {
        // Dry run - show what would be executed without actually running
        const dryRunOutput = {
          mode: 'TEST MODE (Dry Run)',
          tool: selected.name,
          input: formValues,
          note: 'Tool was NOT executed. This shows what would be sent.',
          inputSchema: selected.inputSchema
        };
        setOutput(JSON.stringify(dryRunOutput, null, 2));
      } else {
        const result = await window.workbench.runTool(selected.name, formValues);
        setOutput(JSON.stringify(result, null, 2));
        if (result?.error) {
          await loadDiagnosticSuggestions(selected.name, String(result.error));
        } else {
          setDiagnosticSuggestions([]);
        }
        await refreshToolHealth(selected.name);
      }
    } catch (e: any) {
      if (e.message.includes('PERMISSION_REQUIRED:')) {
         const name = e.message.split('PERMISSION_REQUIRED:')[1].trim();
         onRequestPermission(name, () => runTool());
         setLoading(false);
         return;
      }
      setOutput(`Error: ${e.message}`);
      await loadDiagnosticSuggestions(selected.name, String(e.message || e));
      await refreshToolHealth(selected.name);
    }
    setLoading(false);
  };

  const runWithLLM = async () => {
    if (!selected) return;
    setLoading(true);
    setOutput('Running tool...');
    try {
      const toolResult = await window.workbench.runTool(selected.name, formValues);
      
      // Check if tool returns a prompt (either in old 'prompt' field or new 'content' field)
      const promptText = toolResult.prompt || (typeof toolResult.content === 'string' ? toolResult.content : null);
      
      if (!promptText) {
        setOutput('Tool did not return a prompt suitable for LLM processing.\n\n' + JSON.stringify(toolResult, null, 2));
      } else {
        setOutput('Sending to LLM...');
        const llmResult = await window.workbench.runTask(
          toolResult.metadata?.suggestedRole || 'writer_cheap',
          promptText
        );
        setOutput(llmResult.content);
      }
      if (toolResult?.error) {
        await loadDiagnosticSuggestions(selected.name, String(toolResult.error));
      } else {
        setDiagnosticSuggestions([]);
      }
      await refreshToolHealth(selected.name);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      await loadDiagnosticSuggestions(selected.name, String(e.message || e));
      await refreshToolHealth(selected.name);
    }
    setLoading(false);
  };



  const canDelete = selected && selected.category !== 'builtin' && !selected.category.startsWith('mcp');

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 280, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12 }}>
          <input
            type="text"
            placeholder="Search tools..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
          {tools.length === 0 ? (
            <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40, padding: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No tools loaded</div>
              <div style={{ fontSize: 12 }}>Check plugins folder or refresh</div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40, padding: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 14 }}>No tools match your search</div>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
                  {cat} ({filteredTools.filter(t => t.category === cat).length})
                </div>
                {filteredTools.filter(t => t.category === cat).map(tool => (
                  <div
                    key={tool.name}
                    onClick={() => selectTool(tool)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderRadius: 6,
                      marginBottom: 2,
                      background: selected?.name === tool.name ? colors.primary : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{tool.name.split('.').pop()}</div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
          <button onClick={onRefresh} style={{ ...styles.button, ...styles.buttonGhost, width: '100%' }}>
            ↻ Refresh Tools
          </button>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {selected ? (
          <>
            <div style={{ ...styles.card }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{selected.name}</h2>
                  {selected.description && <p style={{ margin: 0, color: colors.textMuted }}>{selected.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onOpenInChat(selected)} style={{ ...styles.button, ...styles.buttonGhost }}>
                    💬 Chat
                  </button>
                  {canDelete && (
                    <>
                      <button 
                        onClick={() => {
                          setShowEditor(!showEditor);
                          if (!showEditor && !toolCode) loadToolCode(selected);
                        }}
                        style={{ ...styles.button, ...styles.buttonGhost }}
                      >
                        ✏️ Edit Code
                      </button>
                      <button 
                        onClick={deleteTool} 
                        disabled={deleting}
                        style={{ ...styles.button, ...styles.buttonDanger }}
                      >
                        {deleting ? '...' : '🗑 Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {featureFlags.L_TOOL_HEALTH_SIGNALS && (
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Tool Health Signals</h3>
                {toolHealth?.enabled ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
                      <StatCard label="Runs" value={toolHealth.totalRuns || 0} color={colors.textMuted} />
                      <StatCard label="OK" value={toolHealth.completed || 0} color={colors.success} />
                      <StatCard label="Failed" value={(toolHealth.failed || 0) + (toolHealth.killed || 0)} color={colors.danger} />
                      <StatCard label="Timeout" value={toolHealth.timedOut || 0} color={colors.warning} />
                    </div>

                    {toolHealth.mcpStatus && (
                      <div style={{
                        background: colors.bgTertiary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                        padding: 10,
                        marginBottom: 12,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          MCP Status: {toolHealth.mcpStatus.status.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 12, color: colors.textMuted }}>
                          {toolHealth.mcpStatus.detail} ({toolHealth.mcpStatus.transport})
                        </div>
                      </div>
                    )}

                    {toolHealth.frequentTimeout && (
                      <div style={{
                        background: `${colors.warning}20`,
                        border: `1px solid ${colors.warning}`,
                        borderRadius: 6,
                        padding: 10,
                        marginBottom: 12,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                          Frequently times out ({Math.round((toolHealth.timeoutRate || 0) * 100)}%)
                        </div>
                        {(toolHealth.timeoutHints || []).map((hint: string, idx: number) => (
                          <div key={`timeout-hint-${idx}`} style={{ fontSize: 12, color: colors.textMuted }}>
                            • {hint}
                          </div>
                        ))}
                      </div>
                    )}

                    {(toolHealth.knownIssues || []).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {(toolHealth.knownIssues || []).map((issue: string, idx: number) => (
                          <div key={`known-issue-${idx}`} style={{
                            background: `${colors.warning}20`,
                            border: `1px solid ${colors.warning}`,
                            borderRadius: 6,
                            padding: 8,
                            fontSize: 12,
                            marginBottom: 6,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}>
                            <span>{issue}</span>
                            <button
                              onClick={() => removeKnownIssue(idx)}
                              style={{ ...styles.button, ...styles.buttonGhost, padding: '2px 6px', fontSize: 11 }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={knownIssueInput}
                        onChange={(e) => setKnownIssueInput(e.target.value)}
                        placeholder="Add known issue note..."
                        style={styles.input}
                      />
                      <button onClick={addKnownIssue} style={{ ...styles.button, ...styles.buttonGhost }}>
                        Add
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: colors.textMuted }}>
                    Tool health signals are disabled by feature flag.
                  </div>
                )}
              </div>
            )}

            {diagnosticSuggestions.length > 0 && (
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Diagnostics</h3>
                {diagnosticSuggestions.map((suggestion: any, idx: number) => (
                  <div key={`diag-${idx}`} style={{
                    background: colors.bgTertiary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    padding: 10,
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      {suggestion.classifier}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                      {suggestion.explanation}
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      Doctor sections: {(suggestion.doctorSections || []).join(', ')}
                    </div>
                    {(suggestion.suggestions || []).map((hint: string, hintIdx: number) => (
                      <div key={`diag-hint-${idx}-${hintIdx}`} style={{ fontSize: 12, color: colors.textMuted }}>
                        • {hint}
                      </div>
                    ))}
                    {(suggestion.safeFixes || []).map((fix: any, fixIdx: number) => (
                      <button
                        key={`safe-fix-${idx}-${fixIdx}`}
                        onClick={() => previewSafeFix(fix.fixId)}
                        disabled={safeFixLoading}
                        style={{ ...styles.button, ...styles.buttonGhost, marginTop: 8, marginRight: 8 }}
                      >
                        {safeFixLoading ? 'Previewing...' : `Preview safe fix: ${fix.title}`}
                      </button>
                    ))}
                  </div>
                ))}

                {safeFixPreview?.preview && (
                  <div style={{
                    background: colors.bgTertiary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    padding: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Safe Fix Preview: {safeFixPreview.preview.title}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                      {safeFixPreview.preview.description}
                    </div>
                    <pre style={{
                      background: colors.bg,
                      padding: 10,
                      borderRadius: 6,
                      fontSize: 12,
                      overflow: 'auto',
                      marginBottom: 8,
                    }}>
                      {JSON.stringify(safeFixPreview.preview.changes, null, 2)}
                    </pre>
                    <button onClick={applySafeFix} style={{ ...styles.button, ...styles.buttonSuccess, marginRight: 8 }}>
                      Apply Safe Fix
                    </button>
                    <button onClick={() => setSafeFixPreview(null)} style={{ ...styles.button, ...styles.buttonGhost }}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {showEditor && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14 }}>Edit Tool Code</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={saveToolCode} 
                      disabled={savingCode || !selected?._sourceFolder}
                      style={{ ...styles.button, ...styles.buttonSuccess }}
                    >
                      {savingCode ? 'Saving...' : '💾 Save'}
                    </button>
                    <button onClick={() => setShowEditor(false)} style={{ ...styles.button, ...styles.buttonGhost }}>
                      Cancel
                    </button>
                  </div>
                </div>
                <textarea
                  value={toolCode}
                  onChange={e => setToolCode(e.target.value)}
                  style={{
                    ...styles.input,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    minHeight: 400,
                    width: '100%',
                  }}
                  placeholder="Loading code..."
                />
                {!selected?._sourceFolder && (
                  <div style={{ marginTop: 8, color: colors.warning, fontSize: 12 }}>
                    ⚠️ Built-in tools cannot be edited
                  </div>
                )}
              </div>
            )}

            <div style={styles.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Parameters</h3>
              <ToolInputForm tool={selected} values={formValues} onChange={setFormValues} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: 8, background: testMode ? colors.warning + '22' : 'transparent', borderRadius: 6 }}>
                <input 
                  type="checkbox" 
                  checked={testMode} 
                  onChange={e => setTestMode(e.target.checked)}
                  id="testMode"
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="testMode" style={{ cursor: 'pointer', fontSize: 13, color: testMode ? colors.warning : colors.textMuted }}>
                  🧪 Test Mode (dry run - don't actually execute)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={runTool} disabled={loading} style={{ ...styles.button, ...styles.buttonPrimary }}>
                  {loading ? 'Running...' : 'Run Tool'}
                </button>
                <div style={{ width: 8 }} />
                <button onClick={runWithLLM} disabled={loading} style={{ ...styles.button, ...styles.buttonSuccess }}>
                  Run with LLM
                </button>
                <div style={{ width: 8 }} />
                <button onClick={() => onOpenInChat(selected)} style={{ ...styles.button, ...styles.buttonGhost }}>
                  Open in Chat
                </button>
                {selected._sourceFolder && (
                  <>
                    <div style={{ width: 8 }} />
                    <button 
                      onClick={deleteTool} 
                      style={{ ...styles.button, background: '#dc2626', color: 'white' }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {output && (
              <div style={styles.card}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Output</h3>
                <pre style={{
                  margin: 0,
                  padding: 12,
                  background: colors.bg,
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 400,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}>{output}</pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: 100 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
            <div>Select a tool from the sidebar</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FILES TAB - File Browser with Editor
// ============================================================================

function FilesTab() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [safePaths, setSafePaths] = useState<string[]>([]);

  useEffect(() => {
    // Load configured safe paths
    window.workbench.getConfig().then((cfg: any) => {
      const paths = cfg.safePaths || [cfg.workingDir || ''];
      setSafePaths(paths.filter(Boolean));
      if (paths[0]) {
        loadDirectory(paths[0]);
      }
    });
  }, []);

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await window.workbench.runTool('builtin.listDir', { path: dirPath, recursive: false });
      setEntries(result.entries || []);
      setCurrentPath(result.path);
      setSelectedFile(null);
      setFileContent('');
    } catch (e: any) {
      setError(e.message);
      setEntries([]);
    }
    setLoading(false);
  };

  const openFile = async (filePath: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await window.workbench.runTool('builtin.readFile', { path: filePath });
      setSelectedFile(filePath);
      setFileContent(result.content);
      setOriginalContent(result.content);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      await window.workbench.runTool('builtin.writeFile', { path: selectedFile, content: fileContent });
      setOriginalContent(fileContent);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const navigateUp = () => {
    const parent = currentPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
    loadDirectory(parent);
  };

  const handleEntryClick = (entry: FileEntry) => {
    const fullPath = `${currentPath}/${entry.name}`.replace(/\/+/g, '/');
    if (entry.type === 'directory') {
      loadDirectory(fullPath);
    } else {
      openFile(fullPath);
    }
  };

  const isModified = fileContent !== originalContent;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* File browser */}
      <div style={{ width: 300, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
        {/* Path bar */}
        <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={navigateUp} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}>↑</button>
            <button onClick={() => loadDirectory(currentPath)} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}>↻</button>
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted, wordBreak: 'break-all' }}>
            {currentPath || 'No directory selected'}
          </div>
        </div>

        {/* Safe paths selector */}
        {safePaths.length > 0 && (
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
            <select 
              value={currentPath} 
              onChange={e => loadDirectory(e.target.value)}
              style={{ ...styles.input, padding: '6px 10px' }}
            >
              {safePaths.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: 12, color: colors.textMuted }}>Loading...</div>}
          {error && <div style={{ padding: 12, color: colors.danger }}>{error}</div>}
          {entries.map(entry => (
            <div
              key={entry.name}
              onClick={() => handleEntryClick(entry)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: selectedFile?.endsWith(entry.name) ? colors.bgTertiary : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.bgTertiary}
              onMouseLeave={e => e.currentTarget.style.background = selectedFile?.endsWith(entry.name) ? colors.bgTertiary : 'transparent'}
            >
              <span>{entry.type === 'directory' ? '📁' : '📄'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
              {entry.size !== undefined && (
                <span style={{ fontSize: 11, color: colors.textMuted }}>
                  {entry.size > 1024 ? `${(entry.size / 1024).toFixed(1)}K` : `${entry.size}B`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedFile ? (
          <>
            <div style={{ 
              padding: '8px 16px', 
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: colors.bgSecondary,
            }}>
              <div>
                <span style={{ fontWeight: 500 }}>{selectedFile.split(/[/\\]/).pop()}</span>
                {isModified && <span style={{ color: colors.warning, marginLeft: 8 }}>●</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={saveFile} 
                  disabled={!isModified || loading}
                  style={{ 
                    ...styles.button, 
                    ...styles.buttonSuccess, 
                    padding: '4px 12px',
                    opacity: !isModified ? 0.5 : 1,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              value={fileContent}
              onChange={e => setFileContent(e.target.value)}
              style={{
                flex: 1,
                padding: 16,
                background: colors.bg,
                color: colors.text,
                border: 'none',
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.5,
                outline: 'none',
              }}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <div>Select a file to edit</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CHAINS TAB with Presets
// ============================================================================

interface ChainStep {
  id: string;
  tool: string;
  input: Record<string, any>;
  outputKey: string;
}

function ChainsTab({ tools, presets, setPresets }: { 
  tools: Tool[]; 
  presets: ChainPreset[];
  setPresets: React.Dispatch<React.SetStateAction<ChainPreset[]>>;
}) {
  const [steps, setSteps] = useState<ChainStep[]>([]);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [presetName, setPresetName] = useState('');

  const addStep = () => {
    setSteps([...steps, {
      id: `step_${Date.now()}`,
      tool: tools[0]?.name || '',
      input: {},
      outputKey: `result${steps.length}`
    }]);
  };

  const updateStep = (id: string, updates: Partial<ChainStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const runChain = async () => {
    setLoading(true);
    setOutput('Running chain...\n\n');
    try {
      const chainSteps = steps.map(s => ({
        tool: s.tool,
        input: s.input,
        outputKey: s.outputKey
      }));
      const result = await window.workbench.runChain(chainSteps);
      
      // Format chain results with execution log
      let outputText = '';
      
      if (result.executionLog) {
        outputText += '📋 Execution Log:\n';
        result.executionLog.forEach((log: any) => {
          const statusIcon = log.status === 'success' ? '✅' : '❌';
          outputText += `${statusIcon} Step ${log.step}: ${log.tool} - ${log.status}\n`;
          if (log.error) {
            outputText += `   Error: ${log.error}\n`;
          }
        });
        outputText += '\n';
      }
      
      if (result.success === false) {
        outputText += `\n⚠️ Chain Failed at Step ${result.failedAt}\n`;
        outputText += `Error: ${result.error}\n\n`;
        outputText += 'Partial Results:\n';
        outputText += JSON.stringify(result.results, null, 2);
      } else {
        outputText += '✅ Chain Completed Successfully\n\n';
        outputText += 'Results:\n';
        outputText += JSON.stringify(result.results, null, 2);
      }
      
      setOutput(outputText);
    } catch (e: any) {
      setOutput(`❌ Chain Error: ${e.message}`);
    }
    setLoading(false);
  };

  const savePreset = async () => {
    if (!presetName.trim() || steps.length === 0) return;
    const newPreset: ChainPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      steps: steps.map(s => ({ tool: s.tool, input: s.input, outputKey: s.outputKey }))
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    await window.workbench.setConfig({ chainPresets: updated });
    setPresetName('');
  };

  const loadPreset = (preset: ChainPreset) => {
    setSteps(preset.steps.map((s, i) => ({ ...s, id: `step_${Date.now()}_${i}` })));
  };

  const deletePreset = async (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    await window.workbench.setConfig({ chainPresets: updated });
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Presets sidebar */}
      <div style={{ width: 250, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}` }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Saved Chains</h3>
          {presets.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>No saved chains yet</div>
          ) : (
            presets.map(preset => (
              <div key={preset.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 10px',
                background: colors.bgTertiary,
                borderRadius: 6,
                marginBottom: 6,
              }}>
                <span 
                  onClick={() => loadPreset(preset)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  {preset.name}
                </span>
                <button 
                  onClick={() => deletePreset(preset.id)}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chain builder */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Chain Builder</h3>
            <p style={{ margin: '4px 0 0', color: colors.textMuted, fontSize: 13 }}>
              Use {'{{outputKey}}'} or {'{{lastResult.field}}'} to reference previous results
            </p>
          </div>
          <button onClick={addStep} style={{ ...styles.button, ...styles.buttonPrimary }}>
            + Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <div style={{ textAlign: 'center', color: colors.textMuted, marginTop: 80, padding: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⛓️</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>No chain steps yet</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Build multi-step workflows by adding tool steps</div>
            <button onClick={addStep} style={{ ...styles.button, ...styles.buttonPrimary }}>
              + Add First Step
            </button>
          </div>
        ) : (
          <>
            {steps.map((step, index) => (
              <div key={step.id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>Step {index + 1}</span>
                  <button onClick={() => removeStep(step.id)} style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={styles.label}>Tool</label>
                    <select
                      value={step.tool}
                      onChange={e => updateStep(step.id, { tool: e.target.value, input: {} })}
                      style={styles.input}
                    >
                      {tools.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Output Key</label>
                    <input
                      value={step.outputKey}
                      onChange={e => updateStep(step.id, { outputKey: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Input (JSON)</label>
                  <textarea
                    value={JSON.stringify(step.input, null, 2)}
                    onChange={e => { try { updateStep(step.id, { input: JSON.parse(e.target.value) }); } catch {} }}
                    style={{ ...styles.input, minHeight: 80, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            ))}
          </>
        )}

        {steps.length > 0 && (
          <div style={{ ...styles.card, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={runChain} disabled={loading} style={{ ...styles.button, ...styles.buttonSuccess }}>
              {loading ? 'Running...' : '▶ Run Chain'}
            </button>
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Preset name..."
              style={{ ...styles.input, width: 200 }}
            />
            <button onClick={savePreset} disabled={!presetName.trim()} style={{ ...styles.button, ...styles.buttonGhost }}>
              Save as Preset
            </button>
          </div>
        )}

        {output && (
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Output</h3>
            <pre style={{ margin: 0, padding: 12, background: colors.bg, borderRadius: 6, overflow: 'auto', maxHeight: 300, fontSize: 13 }}>
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MCP TAB
// ============================================================================

function MCPTab({ onToolsChanged }: { onToolsChanged: () => void }) {
  const [servers, setServers] = useState<any[]>([]);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });
  const [loading, setLoading] = useState(false);

  const refreshServers = async () => {
    try {
      const list = await window.workbench.mcp.list();
      setServers(list);
    } catch (error: any) {
      console.error('Error refreshing MCP servers:', error);
      // Don't block UI on refresh failure
    }
  };

  useEffect(() => { refreshServers(); }, []);

  const addServer = async () => {
    if (!newServer.name || !newServer.command) return;
    setLoading(true);
    try {
      const args = newServer.args.split(' ').filter(a => a.trim());
      const result = await window.workbench.mcp.add({ name: newServer.name, command: newServer.command, args });
      if (result.success) {
        setNewServer({ name: '', command: '', args: '' });
        await refreshServers();
        onToolsChanged();
      } else {
        alert(`Failed to add server: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error adding server: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeServer = async (name: string) => {
    await window.workbench.mcp.remove(name);
    await refreshServers();
    onToolsChanged();
  };

  const reconnect = async (name: string) => {
    setLoading(true);
    try {
      await window.workbench.mcp.reconnect(name);
      await refreshServers();
      onToolsChanged();
    } catch (error: any) {
      alert(`Error reconnecting: ${error.message}`);
      await refreshServers(); // Refresh to show error state
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    connected: colors.success,
    connecting: colors.warning,
    disconnected: colors.textMuted,
    error: colors.danger
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add MCP Server</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={styles.label}>Name</label>
            <input 
              value={newServer.name} 
              onChange={e => setNewServer({ ...newServer, name: e.target.value })} 
              style={styles.input} 
              placeholder="filesystem"
              disabled={loading}
            />
          </div>
          <div>
            <label style={styles.label}>Command</label>
            <input 
              value={newServer.command} 
              onChange={e => setNewServer({ ...newServer, command: e.target.value })} 
              style={styles.input} 
              placeholder="npx"
              disabled={loading}
            />
          </div>
          <div>
            <label style={styles.label}>Arguments</label>
            <input 
              value={newServer.args} 
              onChange={e => setNewServer({ ...newServer, args: e.target.value })} 
              style={styles.input} 
              placeholder="-y @modelcontextprotocol/server-filesystem /path"
              disabled={loading}
            />
          </div>
          <button onClick={addServer} disabled={loading || !newServer.name || !newServer.command} style={{ ...styles.button, ...styles.buttonPrimary }}>
            {loading ? '⏳ Adding...' : 'Add'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Connected Servers</h3>
        {servers.length === 0 ? (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '32px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔌</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No MCP servers configured</div>
            <div style={{ fontSize: 12 }}>Add a server above to extend Workbench with MCP tools</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {servers.map(server => (
              <div key={server.name} style={{ background: colors.bgTertiary, borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{server.name}</strong>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: statusColors[server.status], color: 'white' }}>
                    {server.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                  {server.status === 'error' ? '❌ Connection failed' : 
                   server.status === 'disconnected' ? '⏸️ Offline - tools unavailable' :
                   server.status === 'connecting' ? '⏳ Connecting...' :
                   `✅ ${server.toolCount} tools available`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => reconnect(server.name)} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px', fontSize: 12 }}>Reconnect</button>
                  <button onClick={() => removeServer(server.name)} style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px', fontSize: 12 }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PERMISSION PROMPT - Modal for permission requests
// ============================================================================

// ============================================================================
// CRASH RECOVERY MODAL
// ============================================================================

function CrashRecoveryModal({ runs, onClose }: { runs: any[]; onClose: () => void }) {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div style={{ ...styles.card, maxWidth: 600, minWidth: 400 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 20, color: colors.warning }}>
            ⚠️ Workbench Closed Unexpectedly
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
            The following tools were running when Workbench closed:
          </p>
        </div>

        <div style={{ 
          maxHeight: 300, 
          overflow: 'auto', 
          background: colors.bgTertiary, 
          padding: 12, 
          borderRadius: 6,
          marginBottom: 16,
        }}>
          {runs.map((run, idx) => (
            <div 
              key={run.runId} 
              style={{ 
                padding: 12, 
                borderBottom: idx < runs.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                🔧 {run.toolName}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                Started: {new Date(run.startTime).toLocaleString()}
              </div>
              {run.toolInput && (
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontFamily: 'monospace' }}>
                  Input: {JSON.stringify(run.toolInput).slice(0, 100)}
                  {JSON.stringify(run.toolInput).length > 100 && '...'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          These runs have been marked as <span style={{ color: colors.danger, fontWeight: 600 }}>failed</span> due to the interruption. 
          You can view them in the <strong>Running</strong> tab's history.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={async () => {
              await window.workbench.runs.clearInterrupted();
              onClose();
            }}
            style={{ ...styles.button, ...styles.buttonGhost }}
          >
            Cleanup &amp; Dismiss
          </button>
          <button
            onClick={onClose}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PERMISSION TOOLS
// ============================================================================

interface PermissionAction {
  action: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

interface PermissionCategory {
  category: string;
  icon: string;
  actions: PermissionAction[];
}

interface ToolPermissionInfo {
  permissions: any;
  formatted: PermissionCategory[];
  isDestructive: boolean;
}

interface PermissionPromptProps {
  toolName: string;
  onAllow: (permanent: boolean) => void;
  onDeny: () => void;
  onClose: () => void;
}

function PermissionPrompt({ toolName, onAllow, onDeny, onClose }: PermissionPromptProps) {
  const [permissionInfo, setPermissionInfo] = useState<ToolPermissionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const info = await window.workbench.permissions.getToolPermissions(toolName);
        setPermissionInfo(info);
      } catch (e) {
        console.error('Failed to load permissions:', e);
      }
      setLoading(false);
    };
    loadPermissions();
  }, [toolName]);

  const handleAllow = async (permanent: boolean) => {
    if (!permissionInfo) return;
    setLoading(true);
    try {
      for (const cat of permissionInfo.formatted) {
        await window.workbench.permissions.grant(toolName, cat.category, permanent);
      }
      onAllow(permanent);
    } catch (e) {
      console.error("Failed to grant permissions:", e);
      onAllow(permanent);
    }
  };

  const riskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return colors.success;
      case 'medium': return colors.warning;
      case 'high': return colors.danger;
    }
  };

  const riskLabel = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'Low Risk';
      case 'medium': return 'Medium Risk';
      case 'high': return 'High Risk';
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div style={{ ...styles.card, maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 24 }}>⏳</div>
          <div>Loading permissions...</div>
        </div>
      </div>
    );
  }

  if (!permissionInfo) {
    // No permissions declared - still prompt with basic notice
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }} onClick={onClose}>
        <div style={{ ...styles.card, maxWidth: 400, minWidth: 300 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>🔐</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Permission Required</h3>
              <div style={{ fontSize: 13, color: colors.textMuted }}>{toolName}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
            This tool has no declared permissions. Allow it to run?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDeny} style={{ ...styles.button, flex: 1, background: colors.bgTertiary }}>Deny</button>
            <button onClick={() => onAllow(false)} style={{ ...styles.button, ...styles.buttonPrimary, flex: 1 }}>Allow Once</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }} onClick={onClose}>
      <div style={{ ...styles.card, maxWidth: 450, minWidth: 350 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 32 }}>🔐</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Permission Required</h3>
            <div style={{ fontSize: 13, color: colors.textMuted }}>{toolName}</div>
          </div>
        </div>

        {/* Destructive warning */}
        {permissionInfo.isDestructive && (
          <div style={{
            background: colors.danger + '20',
            border: `1px solid ${colors.danger}`,
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: colors.danger }}>
              This tool requires elevated privileges that could modify or delete data.
            </span>
          </div>
        )}

        {/* Permission list */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
            This tool requests the following permissions:
          </div>
          {permissionInfo.formatted.map((cat: PermissionCategory) => (
            <div key={cat.category} style={{
              background: colors.bgTertiary,
              borderRadius: 6,
              padding: 12,
              marginBottom: 8
            }}>
              <div style={{ fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{cat.icon}</span>
                <span style={{ textTransform: 'capitalize' }}>{cat.category}</span>
              </div>
              {cat.actions.map((action: PermissionAction) => (
                <div key={action.action} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12, padding: '4px 0', marginLeft: 24
                }}>
                  <span>{action.description}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: riskColor(action.risk) + '20', color: riskColor(action.risk)
                  }}>
                    {riskLabel(action.risk)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDeny} style={{ ...styles.button, flex: 1, background: colors.bgTertiary }}>
            Deny
          </button>
          <button onClick={() => handleAllow(false)} style={{ ...styles.button, ...styles.buttonPrimary, flex: 1 }}>
            Allow Once
          </button>
          <button onClick={() => handleAllow(true)} style={{ ...styles.button, ...styles.buttonSuccess, flex: 1 }}>
            Always Allow
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DOCTOR PANEL - System Diagnostics
// ============================================================================

interface DiagnosticResult {
  name: string;
  category: 'system' | 'process' | 'network' | 'security';
  status: 'PASS' | 'WARN' | 'FAIL';
  evidence: string;
  fixSteps?: string[];
  duration?: number;
}

interface DoctorReport {
  timestamp: string;
  platform: string;
  version: string;
  results: DiagnosticResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

function DoctorPanel() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.workbench.doctor.run();
      setReport(result);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const copyReport = async () => {
    try {
      const text = await window.workbench.doctor.getReportText(true);
      if (text) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e: any) {
      setError('Failed to copy: ' + e.message);
    }
  };

  const exportReport = async () => {
    try {
      await window.workbench.doctor.export(true);
    } catch (e: any) {
      setError('Failed to export: ' + e.message);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PASS': return '✅';
      case 'WARN': return '⚠️';
      case 'FAIL': return '❌';
      default: return '❓';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'PASS': return colors.success;
      case 'WARN': return colors.warning;
      case 'FAIL': return colors.danger;
      default: return colors.textMuted;
    }
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
        Run diagnostics to check system health and identify potential issues.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button 
          onClick={runDiagnostics} 
          disabled={loading}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          {loading ? '⏳ Running...' : '🩺 Run Diagnostics'}
        </button>
        {report && (
          <>
            <button 
              onClick={copyReport}
              style={{ ...styles.button, ...styles.buttonGhost }}
            >
              {copied ? '✓ Copied!' : '📋 Copy Report'}
            </button>
            <button 
              onClick={exportReport}
              style={{ ...styles.button, ...styles.buttonGhost }}
            >
              💾 Export
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ 
          padding: 12, 
          background: colors.danger + '20', 
          borderRadius: 6, 
          color: colors.danger,
          marginBottom: 12 
        }}>
          {error}
        </div>
      )}

      {report && (
        <div>
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            marginBottom: 12,
            padding: '8px 12px',
            background: colors.bgTertiary,
            borderRadius: 6
          }}>
            <span style={{ color: colors.success }}>✅ {report.summary.pass} Pass</span>
            <span style={{ color: colors.warning }}>⚠️ {report.summary.warn} Warn</span>
            <span style={{ color: colors.danger }}>❌ {report.summary.fail} Fail</span>
            <span style={{ color: colors.textMuted, marginLeft: 'auto', fontSize: 11 }}>
              v{report.version} • {new Date(report.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {report.results.map((result, idx) => (
              <div 
                key={idx}
                style={{ 
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: colors.bg,
                  borderRadius: 6,
                  borderLeft: `3px solid ${statusColor(result.status)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {statusIcon(result.status)} {result.name}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {result.evidence}
                    </div>
                  </div>
                  <span style={{ 
                    fontSize: 11, 
                    padding: '2px 6px', 
                    borderRadius: 4,
                    background: statusColor(result.status) + '20',
                    color: statusColor(result.status)
                  }}>
                    {result.status}
                  </span>
                </div>
                {result.fixSteps && result.fixSteps.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Suggested fixes:</div>
                    {result.fixSteps.map((step, i) => (
                      <div key={i} style={{ fontSize: 12, color: colors.text, marginLeft: 8 }}>
                        → {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div style={{ textAlign: 'center', color: colors.textMuted, padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13 }}>Click "Run Diagnostics" to check your system</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RUNNING TAB - Execution Tracking & Process Control
// ============================================================================

function RunningTab({ featureFlags }: { featureFlags: FeatureFlags }) {
  const [activeRuns, setActiveRuns] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubUpdate = window.workbench.runs.onUpdate((run: any) => {
      console.log('[RunningTab] Run update:', run);
      loadData();
    });
    
    const unsubStats = window.workbench.runs.onStatsUpdate((newStats: any) => {
      console.log('[RunningTab] Stats update:', newStats);
      setStats(newStats);
    });

    return () => {
      unsubUpdate();
      unsubStats();
    };
  }, []);

  const loadData = async () => {
    const [active, hist, st] = await Promise.all([
      window.workbench.runs.getActive(),
      window.workbench.runs.getHistory(50),
      window.workbench.runs.getStats(),
    ]);
    setActiveRuns(active);
    setHistory(hist);
    setStats(st);
  };

  const killRun = async (runId: string) => {
    await window.workbench.runs.kill(runId);
    loadData();
  };

  const clearHistory = async () => {
    await window.workbench.runs.clearHistory();
    loadData();
  };

  const exportRunBundle = async () => {
    setExportingBundle(true);
    try {
      const result = await window.workbench.runs.exportBundle(selectedRun?.runId);
      if (!result?.success && !result?.canceled) {
        alert(result?.error || 'Failed to export run bundle');
      }
    } finally {
      setExportingBundle(false);
    }
  };

  const timelineRuns = [...activeRuns, ...history]
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
    .slice(-100);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'queued': return '⏳';
      case 'running': return '▶️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'killed': return '🛑';
      case 'timed-out': return '⏱️';
      default: return '❓';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'queued': return colors.textMuted;
      case 'running': return colors.primary;
      case 'completed': return colors.success;
      case 'failed': return colors.danger;
      case 'killed': return colors.warning;
      case 'timed-out': return colors.warning;
      default: return colors.textMuted;
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      {/* Stats summary */}
      {stats && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>📊 Execution Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <StatCard label="Running" value={stats.running} color={colors.primary} />
            <StatCard label="Queued" value={stats.queued} color={colors.textMuted} />
            <StatCard label="Completed" value={stats.completed} color={colors.success} />
            <StatCard label="Failed" value={stats.failed} color={colors.danger} />
            <StatCard label="Killed" value={stats.killed} color={colors.warning} />
            <StatCard label="Timed Out" value={stats.timedOut} color={colors.warning} />
          </div>
        </div>
      )}

      {/* Active runs */}
      {activeRuns.length > 0 && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>▶️ Active Runs ({activeRuns.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeRuns.map(run => (
              <RunCard 
                key={run.runId} 
                run={run} 
                onKill={killRun}
                onSelect={setSelectedRun}
                isActive={true}
                getStateIcon={getStateIcon}
                getStateColor={getStateColor}
                formatDuration={formatDuration}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </div>
        </div>
      )}

      {/* No active runs */}
      {activeRuns.length === 0 && (
        <div style={{ ...styles.card, marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💤</div>
          <div style={{ color: colors.textMuted }}>No active runs</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            Tool executions will appear here when running
          </div>
        </div>
      )}

      {featureFlags.N_RUN_TIMELINE && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Run Timeline (Read-only)</h3>
          {timelineRuns.length === 0 ? (
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              No timeline events yet.
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              {timelineRuns.map((run) => (
                <div
                  key={`timeline-${run.runId}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderBottom: `1px solid ${colors.border}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: colors.textMuted }}>{formatTimestamp(run.startTime || Date.now())}</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.toolName}</div>
                  <div style={{ color: getStateColor(run.state), textTransform: 'uppercase', fontWeight: 600 }}>
                    {getStateIcon(run.state)} {run.state}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History toggle */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          style={{ ...styles.button, ...styles.buttonGhost }}
        >
          {showHistory ? 'v' : '>'} Run History ({history.length})
        </button>
        {showHistory && history.length > 0 && (
          <button 
            onClick={clearHistory}
            style={{ ...styles.button, ...styles.buttonGhost, marginLeft: 8 }}
          >
            Clear History
          </button>
        )}
        {featureFlags.N_EXPORT_RUN_BUNDLE && (
          <button
            onClick={exportRunBundle}
            disabled={exportingBundle}
            style={{ ...styles.button, ...styles.buttonGhost }}
          >
            {exportingBundle
              ? 'Exporting...'
              : selectedRun
                ? 'Export Selected Run Bundle'
                : 'Export Recent Run Bundle'}
          </button>
        )}
      </div>
      {/* History */}
      {showHistory && history.length > 0 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(run => (
              <RunCard 
                key={run.runId} 
                run={run} 
                onKill={killRun}
                onSelect={setSelectedRun}
                isActive={false}
                getStateIcon={getStateIcon}
                getStateColor={getStateColor}
                formatDuration={formatDuration}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </div>
        </div>
      )}

      {showHistory && history.length === 0 && (
        <div style={{ ...styles.card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📜</div>
          <div style={{ color: colors.textMuted }}>No run history</div>
        </div>
      )}

      {/* Run detail modal */}
      {selectedRun && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedRun(null)}
        >
          <div 
            style={{ 
              ...styles.card, 
              maxWidth: 700, 
              maxHeight: '80vh', 
              overflow: 'auto',
              margin: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {getStateIcon(selectedRun.state)} {selectedRun.toolName}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    const lines: string[] = [];
                    lines.push(`Tool: ${selectedRun.toolName}`);
                    lines.push(`State: ${selectedRun.state}`);
                    lines.push(`Started: ${new Date(selectedRun.startTime).toLocaleString()}`);
                    if (selectedRun.duration) lines.push(`Duration: ${formatDuration(selectedRun.duration)}`);
                    if (selectedRun.triggerSource) lines.push(`Trigger: ${selectedRun.triggerSource}`);
                    if (selectedRun.output) {
                      lines.push('\n--- Output ---');
                      lines.push(typeof selectedRun.output === 'string' ? selectedRun.output : JSON.stringify(selectedRun.output, null, 2));
                    }
                    if (selectedRun.error) {
                      lines.push('\n--- Error ---');
                      lines.push(selectedRun.error);
                    }
                    // Sanitize: redact paths that look like home dirs
                    let text = lines.join('\n');
                    try {
                      const redacted = await window.workbench.secrets.redact(text);
                      text = typeof redacted === 'string' ? redacted : text;
                    } catch { /* redaction best-effort */ }
                    await navigator.clipboard.writeText(text);
                    setLogsCopied(true);
                    setTimeout(() => setLogsCopied(false), 2000);
                  }}
                  style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}
                >
                  {logsCopied ? 'Copied!' : 'Copy Logs'}
                </button>
                {featureFlags.N_EXPORT_RUN_BUNDLE && (
                  <button
                    onClick={exportRunBundle}
                    disabled={exportingBundle}
                    style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}
                  >
                    {exportingBundle ? 'Exporting...' : 'Export Bundle'}
                  </button>
                )}
                <button onClick={() => setSelectedRun(null)} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}>X</button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...styles.label, marginBottom: 8 }}>Status</div>
              <div style={{ color: getStateColor(selectedRun.state), fontWeight: 600 }}>
                {selectedRun.state.toUpperCase()}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...styles.label, marginBottom: 8 }}>Duration</div>
              <div>{selectedRun.duration ? formatDuration(selectedRun.duration) : 'In progress...'}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...styles.label, marginBottom: 8 }}>Started</div>
              <div>{new Date(selectedRun.startTime).toLocaleString()}</div>
            </div>

            {selectedRun.triggerSource && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...styles.label, marginBottom: 8 }}>Triggered By</div>
                <div>{selectedRun.triggerSource}</div>
              </div>
            )}

            {selectedRun.toolInput && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...styles.label, marginBottom: 8 }}>Input</div>
                <pre style={{ 
                  background: colors.bgTertiary, 
                  padding: 12, 
                  borderRadius: 6, 
                  fontSize: 12, 
                  overflow: 'auto',
                  maxHeight: 200,
                }}>
                  {JSON.stringify(selectedRun.toolInput, null, 2)}
                </pre>
              </div>
            )}

            {selectedRun.output && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...styles.label, marginBottom: 8 }}>Output</div>
                <pre style={{ 
                  background: colors.bgTertiary, 
                  padding: 12, 
                  borderRadius: 6, 
                  fontSize: 12, 
                  overflow: 'auto',
                  maxHeight: 200,
                }}>
                  {typeof selectedRun.output === 'string' ? selectedRun.output : JSON.stringify(selectedRun.output, null, 2)}
                </pre>
              </div>
            )}

            {selectedRun.error && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...styles.label, marginBottom: 8 }}>Error</div>
                <div style={{ 
                  background: colors.bgTertiary, 
                  padding: 12, 
                  borderRadius: 6, 
                  fontSize: 12,
                  color: colors.danger,
                }}>
                  {selectedRun.error}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 12, background: colors.bgTertiary, borderRadius: 6 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function RunCard({ 
  run, 
  onKill, 
  onSelect, 
  isActive,
  getStateIcon,
  getStateColor,
  formatDuration,
  formatTimestamp,
}: { 
  run: any; 
  onKill: (id: string) => void;
  onSelect: (run: any) => void;
  isActive: boolean;
  getStateIcon: (state: string) => string;
  getStateColor: (state: string) => string;
  formatDuration: (ms: number) => string;
  formatTimestamp: (ts: number) => string;
}) {
  const elapsed = run.duration || (Date.now() - run.startTime);
  
  return (
    <div 
      style={{ 
        background: colors.bgTertiary, 
        padding: 12, 
        borderRadius: 6,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onClick={() => onSelect(run)}
      onMouseEnter={e => (e.currentTarget.style.borderColor = colors.primary)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {getStateIcon(run.state)} {run.toolName}
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>
            Started: {formatTimestamp(run.startTime)} • Duration: {formatDuration(elapsed)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 600, 
            color: getStateColor(run.state),
            textTransform: 'uppercase',
          }}>
            {run.state}
          </div>
          {isActive && run.state === 'running' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onKill(run.runId); }}
              style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px', fontSize: 11 }}
            >
              Kill
            </button>
          )}
        </div>
      </div>
      
      {run.lastOutputSnippet && (
        <div style={{ 
          fontSize: 11, 
          color: colors.textMuted, 
          fontFamily: 'monospace',
          background: colors.bg,
          padding: 6,
          borderRadius: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {run.lastOutputSnippet}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SETTINGS TAB
// ============================================================================

type Model = {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: { prompt: number; completion: number };
  per_million_prompt: string;
  per_million_completion: string;
};

function SettingsTab({ featureFlags, setFeatureFlags }: {
  featureFlags: FeatureFlags;
  setFeatureFlags: React.Dispatch<React.SetStateAction<FeatureFlags>>;
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [router, setRouter] = useState<Record<string, { model: string }>>({});
  const [workingDir, setWorkingDir] = useState('');
  const [pluginsDir, setPluginsDir] = useState('');
  const [safePaths, setSafePaths] = useState('');
  const [permissionProfiles, setPermissionProfiles] = useState('{}');
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('system-ui, -apple-system, sans-serif');
  const [saved, setSaved] = useState(false);
  
  // Model browser state
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState('');
  const [modelError, setModelError] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    window.workbench.getConfig().then((cfg: any) => {
      setApiKey(cfg.openrouterApiKey || '');
      setApiEndpoint(cfg.apiEndpoint || 'https://openrouter.ai/api/v1');
      setRouter(cfg.router || {});
      setWorkingDir(cfg.workingDir || '');
      setPluginsDir(cfg.pluginsDir || '');
      setSafePaths((cfg.safePaths || []).join('\n'));
      setPermissionProfiles(JSON.stringify(cfg.permissionProfiles || {}, null, 2));
      const size = cfg.fontSize || 14;
      setFontSize(size);
      document.documentElement.style.fontSize = size + 'px';
      const family = cfg.fontFamily || 'system-ui, -apple-system, sans-serif';
      setFontFamily(family);
      document.documentElement.style.fontFamily = family;
      setFeatureFlags(mergeFeatureFlags(cfg.featureFlags));
    });
  }, [setFeatureFlags]);

  const loadModels = async () => {
    setLoadingModels(true);
    setModelError('');
    try {
      const list = await window.workbench.models.list();
      setModels(list);
    } catch (e: any) {
      setModelError(e.message);
    }
    setLoadingModels(false);
  };

  const selectModelForRole = (modelId: string) => {
    if (!selectedRole) return;
    setRouter({ ...router, [selectedRole]: { model: modelId } });
    setSelectedRole(null);
  };

  const toggleFeatureFlag = (flag: keyof FeatureFlags) => {
    setFeatureFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  };

  const parsePermissionProfiles = (): Record<string, Record<string, string>> | null => {
    const raw = permissionProfiles.trim();
    if (!raw) return {};

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('Permission profiles must be valid JSON.');
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      alert('Permission profiles must be a JSON object keyed by tool name.');
      return null;
    }

    for (const [toolName, profile] of Object.entries(parsed)) {
      if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
        alert(`Invalid profile for ${toolName}. Expected an object of action -> allow|ask|deny.`);
        return null;
      }
      for (const [action, decision] of Object.entries(profile as Record<string, any>)) {
        if (!['allow', 'ask', 'deny'].includes(String(decision))) {
          alert(`Invalid decision "${decision}" for ${toolName}.${action}. Use allow, ask, or deny.`);
          return null;
        }
      }
    }

    return parsed as Record<string, Record<string, string>>;
  };

  const save = async () => {
    const parsedPermissionProfiles = parsePermissionProfiles();
    if (!parsedPermissionProfiles) return;

    await window.workbench.setConfig({
      openrouterApiKey: apiKey,
      apiEndpoint,
      router,
      workingDir,
      pluginsDir,
      safePaths: safePaths.split('\n').map(s => s.trim()).filter(Boolean),
      featureFlags,
      permissionProfiles: parsedPermissionProfiles,
      fontSize,
      fontFamily
    });
    document.documentElement.style.fontSize = fontSize + 'px';
    document.documentElement.style.fontFamily = fontFamily;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roles = ['writer_cheap', 'structurer', 'coder_cheap', 'reviewer'];

  const roleDescriptions: Record<string, string> = {
    writer_cheap: 'General writing and chat responses. Used for conversational interactions and content generation.',
    structurer: 'Organizes and structures data. Used for formatting, categorizing, and creating structured outputs.',
    coder_cheap: 'Code generation and technical tasks. Used when generating plugin code or technical implementations.',
    reviewer: 'Reviews and validates content. Used for quality checks, code reviews, and verification tasks.'
  };

  const filteredModels = models.filter(m => 
    m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
    m.name.toLowerCase().includes(modelFilter.toLowerCase())
  );

  const featureFlagRows: Array<{ key: keyof FeatureFlags; label: string; description: string }> = [
    {
      key: 'L_TOOL_HEALTH_SIGNALS',
      label: 'L: Tool Health Signals',
      description: 'Local run success/failure/timeout stats, MCP status hints, and known issue banners.',
    },
    {
      key: 'M_SMART_AUTO_DIAGNOSTICS',
      label: 'M: Smart Auto-Diagnostics',
      description: 'Failure pattern classification with Doctor section suggestions and safe-fix preview flow.',
    },
    {
      key: 'N_PERMISSION_PROFILES',
      label: 'N: Permission Profiles',
      description: 'Per-tool action profiles: allow/ask/deny hook on top of declared permissions.',
    },
    {
      key: 'N_RUN_TIMELINE',
      label: 'N: Run Timeline',
      description: 'Read-only run timeline in the Running tab.',
    },
    {
      key: 'N_EXPORT_RUN_BUNDLE',
      label: 'N: Export Run Bundle',
      description: 'Export run + doctor bundle as a local JSON file for issue reporting.',
    },
    {
      key: 'V2_GUARDRAILS',
      label: 'V2: Guardrails',
      description: 'Schema validation, path sandboxing, and dangerous command blocking for tool execution.',
    },
    {
      key: 'V2_ASSET_SYSTEM',
      label: 'V2: Asset System',
      description: 'File upload support with MIME validation, sandbox storage, and tool integration via asset_id.',
    },
    {
      key: 'V2_AUTO_DOCTOR',
      label: 'V2: Auto Doctor',
      description: 'Automatically trigger diagnostics on spawn failures, timeouts, and other qualifying errors.',
    },
    {
      key: 'V2_SESSION_LOGS',
      label: 'V2: Session Logs',
      description: 'Persistent session logs including tool runs, doctor reports, and execution history.',
    },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column - Config */}
        <div>
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>API Configuration</h3>
            <label style={styles.label}>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} style={styles.input} placeholder="sk-or-... or sk-..." />
            
            <label style={{ ...styles.label, marginTop: 12 }}>API Endpoint</label>
            <input 
              type="text" 
              value={apiEndpoint} 
              onChange={e => setApiEndpoint(e.target.value)} 
              style={styles.input} 
              placeholder="https://openrouter.ai/api/v1" 
            />
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              OpenRouter: https://openrouter.ai/api/v1 | OpenAI: https://api.openai.com/v1 | Azure: https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT
            </div>
            
            <label style={{ ...styles.label, marginTop: 12 }}>Base Font Size</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="range" 
                min="10" 
                max="20" 
                value={fontSize} 
                onChange={e => setFontSize(parseInt(e.target.value))} 
                style={{ flex: 1 }}
              />
              <input 
                type="number" 
                min="10" 
                max="20" 
                value={fontSize} 
                onChange={e => setFontSize(parseInt(e.target.value) || 14)} 
                style={{ ...styles.input, width: 60, padding: '4px 8px' }}
              />
              <span style={{ color: colors.textMuted, fontSize: 12 }}>px</span>
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              Adjust the base font size for the entire app (10-20px)
            </div>
            
            <label style={{ ...styles.label, marginTop: 12 }}>Font Family</label>
            <select 
              value={fontFamily} 
              onChange={e => setFontFamily(e.target.value)}
              style={styles.input}
            >
              <option value="system-ui, -apple-system, sans-serif">System Default</option>
              <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">Segoe UI</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="'Courier New', Courier, monospace">Courier New (Mono)</option>
              <option value="'Consolas', 'Monaco', monospace">Consolas (Mono)</option>
              <option value="'JetBrains Mono', 'Fira Code', monospace">JetBrains Mono</option>
              <option value="Georgia, 'Times New Roman', serif">Georgia (Serif)</option>
              <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
            </select>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              Choose the font family for the entire app
            </div>
            
            <div style={{ marginTop: 8 }}>
              <button 
                onClick={loadModels} 
                disabled={!apiKey || loadingModels}
                style={{ ...styles.button, ...styles.buttonGhost }}
              >
                {loadingModels ? 'Loading...' : '↻ Load Available Models'}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Model Routing</h3>
            <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
              Click a role to select from available models, or type a model ID directly.
            </p>
            
            <div style={{ 
              background: colors.bgTertiary, 
              padding: 12, 
              borderRadius: 6, 
              marginBottom: 16,
              border: `1px solid ${colors.border}`
            }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: colors.primary }}>Role Explanations:</h4>
              {roles.map(role => (
                <div key={`desc-${role}`} style={{ marginBottom: 8, fontSize: 12 }}>
                  <strong style={{ color: colors.text }}>{role}:</strong>{' '}
                  <span style={{ color: colors.textMuted }}>{roleDescriptions[role]}</span>
                </div>
              ))}
            </div>
            
            {roles.map(role => (
              <div key={role} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontWeight: 500, width: 120 }}>{role}</label>
                  <input
                    value={router[role]?.model || ''}
                    onChange={e => setRouter({ ...router, [role]: { model: e.target.value } })}
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="model-id"
                  />
                  <button
                    onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                    disabled={models.length === 0}
                    style={{ 
                      ...styles.button, 
                      ...(selectedRole === role ? styles.buttonPrimary : styles.buttonGhost),
                      padding: '6px 10px',
                      opacity: models.length === 0 ? 0.5 : 1,
                    }}
                  >
                    {selectedRole === role ? '✓' : '...'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Directories</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Working Directory</label>
              <input value={workingDir} onChange={e => setWorkingDir(e.target.value)} style={styles.input} placeholder="Default: User home" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Plugins Directory</label>
              <input value={pluginsDir} onChange={e => setPluginsDir(e.target.value)} style={styles.input} placeholder="Default: ./plugins" />
            </div>
            <div>
              <label style={styles.label}>Safe Paths for File Browser (one per line)</label>
              <textarea 
                value={safePaths} 
                onChange={e => setSafePaths(e.target.value)} 
                style={{ ...styles.input, minHeight: 80, fontFamily: 'monospace' }}
                placeholder="/home/user/documents&#10;/home/user/projects"
              />
            </div>
          </div>

          
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Feature Flags (Default OFF)</h3>
            {featureFlagRows.map((row) => (
              <label
                key={row.key}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  borderRadius: 6,
                  marginBottom: 8,
                  background: colors.bgTertiary,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={featureFlags[row.key]}
                    onChange={() => toggleFeatureFlag(row.key)}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginLeft: 24 }}>
                  {row.description}
                </div>
              </label>
            ))}
          </div>

          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Permission Profiles</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              JSON config for per-tool action decisions. Example: {`{"*":{"read":"allow","write":"ask"}}`}
            </div>
            <textarea
              value={permissionProfiles}
              onChange={e => setPermissionProfiles(e.target.value)}
              style={{ ...styles.input, minHeight: 140, fontFamily: 'monospace' }}
              placeholder='{"*":{"read":"allow","write":"ask"}}'
            />
            {!featureFlags.N_PERMISSION_PROFILES && (
              <div style={{ fontSize: 11, color: colors.warning, marginTop: 8 }}>
                Note: N_PERMISSION_PROFILES is currently off, so profiles are saved but not enforced.
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>🩺 System Diagnostics</h3>
            <DoctorPanel />
          </div>

          <AssetPanel />

          <div style={styles.card}>
            <button onClick={save} style={{ ...styles.button, ...styles.buttonSuccess }}>
              {saved ? '✓ Saved!' : 'Save Settings'}
            </button>
            <button onClick={() => window.workbench.reloadPlugins()} style={{ ...styles.button, ...styles.buttonGhost, marginLeft: 8 }}>
              Reload Plugins
            </button>
            <button
              onClick={async () => {
                try {
                  const result = await window.workbench.logs.exportSessionLog();
                  if (result?.success) {
                    alert(`Session log exported to: ${result.filePath}`);
                  }
                } catch (e: any) {
                  alert('Export failed: ' + e.message);
                }
              }}
              style={{ ...styles.button, ...styles.buttonGhost, marginLeft: 8 }}
            >
              Export Session Log
            </button>
          </div>

          <div style={{ ...styles.card, borderColor: colors.danger }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: colors.danger }}>Reset Workbench Data</h3>
            <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 12px' }}>
              Clear all run history, chat history, and permission policies. This cannot be undone.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to reset ALL Workbench data? This cannot be undone.')) return;
                try {
                  await window.workbench.runs.clearAll();
                  await window.workbench.chat.clear();
                  await window.workbench.permissions.resetAll();
                  alert('All data has been cleared. The app will reload.');
                  window.location.reload();
                } catch (e: any) {
                  alert('Reset failed: ' + e.message);
                }
              }}
              style={{ ...styles.button, ...styles.buttonDanger }}
            >
              Reset All Data
            </button>
          </div>
        </div>

        {/* Right column - Model Browser */}
        <div>
          <div style={{ ...styles.card, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Available Models 
                {models.length > 0 && <span style={{ fontWeight: 'normal', color: colors.textMuted }}> ({models.length})</span>}
              </h3>
              {selectedRole && (
                <span style={{ 
                  padding: '4px 10px', 
                  background: colors.primary, 
                  borderRadius: 12, 
                  fontSize: 12 
                }}>
                  Selecting for: {selectedRole}
                </span>
              )}
            </div>

            {modelError && (
              <div style={{ padding: 12, background: colors.danger + '20', borderRadius: 6, color: colors.danger, marginBottom: 12 }}>
                {modelError}
              </div>
            )}

            {models.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                  <div>Enter your API key and click "Load Available Models"</div>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Filter models..."
                  value={modelFilter}
                  onChange={e => setModelFilter(e.target.value)}
                  style={{ ...styles.input, marginBottom: 12 }}
                />
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {filteredModels.map(model => (
                    <div
                      key={model.id}
                      onClick={() => selectedRole && selectModelForRole(model.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        marginBottom: 6,
                        background: colors.bgTertiary,
                        cursor: selectedRole ? 'pointer' : 'default',
                        border: selectedRole ? `1px solid ${colors.border}` : '1px solid transparent',
                      }}
                      onMouseEnter={e => selectedRole && (e.currentTarget.style.borderColor = colors.primary)}
                      onMouseLeave={e => selectedRole && (e.currentTarget.style.borderColor = colors.border)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{model.name}</div>
                          <div style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' }}>{model.id}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 11 }}>
                          <div style={{ color: colors.success }}>${model.per_million_prompt}/M in</div>
                          <div style={{ color: colors.warning }}>${model.per_million_completion}/M out</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: colors.textMuted }}>
                        <span>📏 {(model.context_length / 1000).toFixed(0)}K ctx</span>
                        {roles.some(r => router[r]?.model === model.id) && (
                          <span style={{ color: colors.primary }}>
                            ✓ {roles.filter(r => router[r]?.model === model.id).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
