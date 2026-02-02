import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {} from 'react/jsx-runtime';

const TABS = ['Chat', 'Tools', 'Files', 'Chains', 'MCP', 'Settings'] as const;
type Tab = typeof TABS[number];

type Tool = { 
  name: string; 
  description?: string;
  inputSchema: any; 
  category: string;
  _sourceFolder?: string;
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
  
  // Tool-in-chat state
  const [pendingTool, setPendingTool] = useState<{ tool: Tool; input: any } | null>(null);

  useEffect(() => {
    window.workbench.listTools().then(setTools);
    // Load saved presets
    window.workbench.getConfig().then((cfg: any) => {
      if (cfg.chainPresets) setChainPresets(cfg.chainPresets);
    });
  }, []);

  const openToolInChat = (tool: Tool) => {
    setTab('Chat');
    setPendingTool({ tool, input: {} });
  };

  return (
    <div style={styles.app}>
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
          />
        )}
        {tab === 'Tools' && <ToolsTab tools={tools} onOpenInChat={openToolInChat} onRefresh={() => window.workbench.refreshTools().then(setTools)} />}
        {tab === 'Files' && <FilesTab />}
        {tab === 'Chains' && <ChainsTab tools={tools} presets={chainPresets} setPresets={setChainPresets} />}
        {tab === 'MCP' && <MCPTab onToolsChanged={() => window.workbench.listTools().then(setTools)} />}
        {tab === 'Settings' && <SettingsTab />}
      </div>
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
  setPendingTool
}: { 
  tools: Tool[];
  history: Message[];
  setHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  pendingTool: { tool: Tool; input: any } | null;
  setPendingTool: React.Dispatch<React.SetStateAction<{ tool: Tool; input: any } | null>>;
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
    const runningMsgId = `msg_${Date.now()}_running`;
    const runningMsg: Message = {
      id: runningMsgId,
      role: 'system',
      content: `Running ${tool.name}...`,
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
      setHistory(prev => prev.map(m => 
        m.id === runningMsgId ? { ...m, content: `Error: ${e.message}` } : m
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

      {/* Pending tool form */}
      {pendingTool && (
        <div style={{ padding: 16, borderTop: `1px solid ${colors.border}`, background: colors.bgSecondary }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>🔧 {pendingTool.tool.name}</span>
            <button onClick={() => setPendingTool(null)} style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }}>✕</button>
          </div>
          <ToolInputForm 
            tool={pendingTool.tool} 
            values={pendingTool.input}
            onChange={(values) => setPendingTool({ ...pendingTool, input: values })}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button 
              onClick={() => runToolInChat(pendingTool.tool, pendingTool.input)}
              style={{ ...styles.button, ...styles.buttonPrimary }}
            >
              Run Tool
            </button>
            <button 
              onClick={() => setPendingTool(null)}
              style={{ ...styles.button, ...styles.buttonGhost }}
            >
              Cancel
            </button>
          </div>
        </div>
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
          {message.timestamp.toLocaleTimeString()}
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

function ToolsTab({ tools, onOpenInChat, onRefresh }: { tools: Tool[]; onOpenInChat: (t: Tool) => void; onRefresh: () => void }) {
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
  };

  const loadToolCode = async (tool: Tool) => {
    if (!tool._sourceFolder) {
      setToolCode('// Built-in tool - source code not available');
      return;
    }
    try {
      const fs = await window.workbench.runTool('builtin.readFile', { 
        path: `plugins/${tool._sourceFolder}/index.js` 
      });
      if (fs.content) {
        setToolCode(fs.content);
      } else {
        setToolCode('// Failed to load tool code');
      }
    } catch (e: any) {
      setToolCode(`// Error loading code: ${e.message}`);
    }
  };

  const saveToolCode = async () => {
    if (!selected?._sourceFolder || !toolCode) return;
    setSavingCode(true);
    try {
      await window.workbench.runTool('builtin.writeFile', {
        path: `plugins/${selected._sourceFolder}/index.js`,
        content: toolCode
      });
      setShowEditor(false);
      onRefresh(); // Reload tools
    } catch (e: any) {
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
      }
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
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
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
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
          {categories.map(cat => (
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
          ))}
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
    setOutput('Running chain...\n');
    try {
      const chainSteps = steps.map(s => ({
        tool: s.tool,
        input: s.input,
        outputKey: s.outputKey
      }));
      const result = await window.workbench.runChain(chainSteps);
      setOutput(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
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
    const list = await window.workbench.mcp.list();
    setServers(list);
  };

  useEffect(() => { refreshServers(); }, []);

  const addServer = async () => {
    if (!newServer.name || !newServer.command) return;
    setLoading(true);
    const args = newServer.args.split(' ').filter(a => a.trim());
    const result = await window.workbench.mcp.add({ name: newServer.name, command: newServer.command, args });
    if (result.success) {
      setNewServer({ name: '', command: '', args: '' });
      await refreshServers();
      onToolsChanged();
    } else {
      alert(`Failed: ${result.error}`);
    }
    setLoading(false);
  };

  const removeServer = async (name: string) => {
    await window.workbench.mcp.remove(name);
    await refreshServers();
    onToolsChanged();
  };

  const reconnect = async (name: string) => {
    setLoading(true);
    await window.workbench.mcp.reconnect(name);
    await refreshServers();
    onToolsChanged();
    setLoading(false);
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
            <input value={newServer.name} onChange={e => setNewServer({ ...newServer, name: e.target.value })} style={styles.input} placeholder="filesystem" />
          </div>
          <div>
            <label style={styles.label}>Command</label>
            <input value={newServer.command} onChange={e => setNewServer({ ...newServer, command: e.target.value })} style={styles.input} placeholder="npx" />
          </div>
          <div>
            <label style={styles.label}>Arguments</label>
            <input value={newServer.args} onChange={e => setNewServer({ ...newServer, args: e.target.value })} style={styles.input} placeholder="-y @modelcontextprotocol/server-filesystem /path" />
          </div>
          <button onClick={addServer} disabled={loading} style={{ ...styles.button, ...styles.buttonPrimary }}>
            {loading ? '...' : 'Add'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Connected Servers</h3>
        {servers.length === 0 ? (
          <div style={{ color: colors.textMuted }}>No MCP servers configured</div>
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
                <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>{server.toolCount} tools</div>
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

function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [router, setRouter] = useState<Record<string, { model: string }>>({});
  const [workingDir, setWorkingDir] = useState('');
  const [pluginsDir, setPluginsDir] = useState('');
  const [safePaths, setSafePaths] = useState('');
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
    });
  }, []);

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

  const save = async () => {
    await window.workbench.setConfig({
      openrouterApiKey: apiKey,
      apiEndpoint,
      router,
      workingDir,
      pluginsDir,
      safePaths: safePaths.split('\n').map(s => s.trim()).filter(Boolean)
    });
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
            <button onClick={save} style={{ ...styles.button, ...styles.buttonSuccess }}>
              {saved ? '✓ Saved!' : 'Save Settings'}
            </button>
            <button onClick={() => window.workbench.reloadPlugins()} style={{ ...styles.button, ...styles.buttonGhost, marginLeft: 8 }}>
              Reload Plugins
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
