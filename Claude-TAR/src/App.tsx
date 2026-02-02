import React, { useState, useEffect, useRef } from 'react';
import type {} from 'react/jsx-runtime';

const TABS = ['Chat', 'Tools', 'Chains', 'MCP', 'Settings'] as const;
type Tab = typeof TABS[number];

type Tool = { 
  name: string; 
  description?: string;
  inputSchema: any; 
  category: string;
};

declare global {
  interface Window {
    workbench: any;
  }
}

// Styles
const styles = {
  container: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 1200, margin: '0 auto' },
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #ddd', paddingBottom: 8 },
  tab: { padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px 4px 0 0' },
  tabActive: { background: '#2563eb', color: 'white' },
  card: { background: '#f8f9fa', borderRadius: 8, padding: 16, marginBottom: 16 },
  input: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', fontFamily: 'monospace', resize: 'vertical' as const, boxSizing: 'border-box' as const },
  button: { padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 500 },
  buttonPrimary: { background: '#2563eb', color: 'white' },
  buttonSuccess: { background: '#16a34a', color: 'white' },
  buttonDanger: { background: '#dc2626', color: 'white' },
  buttonSecondary: { background: '#6b7280', color: 'white' },
  output: { background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' as const, maxHeight: 400, overflow: 'auto' },
  label: { display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
};

export default function App() {
  const [tab, setTab] = useState<Tab>('Chat');
  
  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
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
      {tab === 'Chat' && <ChatTab />}
      {tab === 'Tools' && <ToolsTab />}
      {tab === 'Chains' && <ChainsTab />}
      {tab === 'MCP' && <MCPTab />}
      {tab === 'Settings' && <SettingsTab />}
    </div>
  );
}

// ============================================================================
// CHAT TAB - Streaming chat interface
// ============================================================================

function ChatTab() {
  const [prompt, setPrompt] = useState('');
  const [taskType, setTaskType] = useState('writer_cheap');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput('');

    try {
      if (streaming) {
        await window.workbench.runTaskStream(taskType, prompt, {
          onChunk: (data: any) => {
            setOutput(data.content);
            outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
          },
          onDone: (data: any) => {
            setOutput(data.content);
            setLoading(false);
          },
          onError: (data: any) => {
            setOutput(`Error: ${data.error}`);
            setLoading(false);
          }
        });
      } else {
        const res = await window.workbench.runTask(taskType, prompt);
        setOutput(res.content || JSON.stringify(res, null, 2));
        setLoading(false);
      }
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await window.workbench.runTool('builtin.clipboardWrite', { content: output });
  };

  const pasteFromClipboard = async () => {
    const result = await window.workbench.runTool('builtin.clipboardRead', {});
    setPrompt(result.content);
  };

  return (
    <div>
      <div style={{ ...styles.card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={styles.label}>Model Role</label>
          <select 
            value={taskType} 
            onChange={(e) => setTaskType(e.target.value)}
            style={{ ...styles.input, width: 160 }}
          >
            <option value="writer_cheap">Writer (Cheap)</option>
            <option value="structurer">Structurer</option>
            <option value="coder_cheap">Coder (Cheap)</option>
            <option value="reviewer">Reviewer</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={streaming} 
            onChange={(e) => setStreaming(e.target.checked)} 
          />
          Stream response
        </label>
        <button 
          onClick={pasteFromClipboard}
          style={{ ...styles.button, ...styles.buttonSecondary }}
        >
          📋 Paste from Clipboard
        </button>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Prompt</label>
        <textarea 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)} 
          rows={6} 
          style={styles.textarea}
          placeholder="Enter your prompt here..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            {loading ? '⏳ Running...' : '▶ Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {(output || loading) && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={styles.label}>Output {loading && '(streaming...)'}</label>
            {output && (
              <button onClick={copyToClipboard} style={{ ...styles.button, ...styles.buttonSecondary, padding: '4px 8px' }}>
                📋 Copy
              </button>
            )}
          </div>
          <div ref={outputRef} style={styles.output}>
            {output || 'Waiting for response...'}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TOOLS TAB - Browse and run tools
// ============================================================================

function ToolsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    window.workbench.listTools().then(setTools);
  }, []);

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.description?.toLowerCase().includes(filter.toLowerCase())
  );

  const categories = [...new Set(filteredTools.map(t => t.category))];

  const selectTool = (tool: Tool) => {
    setSelected(tool);
    setFormValues({});
    setOutput('');
  };

  const runTool = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const result = await window.workbench.runTool(selected.name, formValues);
      setOutput(JSON.stringify(result, null, 2));
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
      if (!toolResult.prompt) {
        setOutput('Tool did not return a prompt.\n\n' + JSON.stringify(toolResult, null, 2));
        setLoading(false);
        return;
      }
      setOutput('Sending to LLM...');
      const llmResult = await window.workbench.runTask(
        toolResult.metadata?.suggestedRole || 'writer_cheap',
        toolResult.prompt
      );
      setOutput(llmResult.content);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
      {/* Tool list sidebar */}
      <div>
        <input
          type="text"
          placeholder="Search tools..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...styles.input, marginBottom: 12 }}
        />
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
                {cat}
              </div>
              {filteredTools.filter(t => t.category === cat).map(tool => (
                <div
                  key={tool.name}
                  onClick={() => selectTool(tool)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    marginBottom: 2,
                    background: selected?.name === tool.name ? '#2563eb' : 'transparent',
                    color: selected?.name === tool.name ? 'white' : 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{tool.name.split('.').pop()}</div>
                  {tool.description && (
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                      {tool.description.slice(0, 60)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tool detail panel */}
      <div>
        {selected ? (
          <>
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 8px 0' }}>{selected.name}</h3>
              {selected.description && <p style={{ color: '#6b7280', margin: 0 }}>{selected.description}</p>}
            </div>

            <div style={styles.card}>
              <h4 style={{ margin: '0 0 12px 0' }}>Parameters</h4>
              {selected.inputSchema?.properties ? (
                Object.entries(selected.inputSchema.properties).map(([key, prop]: [string, any]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <label style={styles.label}>
                      {key} {selected.inputSchema.required?.includes(key) && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>
                    {prop.enum ? (
                      <select
                        value={formValues[key] || ''}
                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
                        style={styles.input}
                      >
                        <option value="">Select...</option>
                        {prop.enum.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : prop.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={formValues[key] || false}
                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.checked })}
                      />
                    ) : key.toLowerCase().includes('content') || key.toLowerCase().includes('text') || key.toLowerCase().includes('asam') || key.toLowerCase().includes('previous') ? (
                      <textarea
                        value={formValues[key] || ''}
                        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
                        rows={6}
                        style={styles.textarea}
                        placeholder={prop.description}
                      />
                    ) : (
                      <input
                        type={prop.type === 'number' ? 'number' : 'text'}
                        value={formValues[key] || ''}
                        onChange={(e) => setFormValues({ ...formValues, [key]: prop.type === 'number' ? Number(e.target.value) : e.target.value })}
                        style={styles.input}
                        placeholder={prop.description}
                      />
                    )}
                    {prop.description && <div style={styles.hint}>{prop.description}</div>}
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280' }}>No parameters required</div>
              )}
              
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={runTool} disabled={loading} style={{ ...styles.button, ...styles.buttonPrimary }}>
                  {loading ? 'Running...' : 'Run Tool'}
                </button>
                <button onClick={runWithLLM} disabled={loading} style={{ ...styles.button, ...styles.buttonSuccess }}>
                  Run with LLM
                </button>
              </div>
            </div>

            {output && (
              <div style={styles.card}>
                <label style={styles.label}>Output</label>
                <div style={styles.output}>{output}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...styles.card, textAlign: 'center', color: '#6b7280' }}>
            Select a tool from the list to view details and run it
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CHAINS TAB - Tool chaining
// ============================================================================

interface ChainStep {
  id: string;
  tool: string;
  input: Record<string, any>;
  outputKey: string;
}

function ChainsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [steps, setSteps] = useState<ChainStep[]>([]);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.workbench.listTools().then(setTools);
  }, []);

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

  return (
    <div>
      <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Tool Chain Builder</h3>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Chain tools together. Use {'{{outputKey}}'} to reference previous results.
          </p>
        </div>
        <button onClick={addStep} style={{ ...styles.button, ...styles.buttonPrimary }}>
          + Add Step
        </button>
      </div>

      {steps.map((step, index) => {
        const selectedTool = tools.find(t => t.name === step.tool);
        return (
          <div key={step.id} style={{ ...styles.card, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Step {index + 1}</span>
              <button 
                onClick={() => removeStep(step.id)}
                style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={styles.label}>Tool</label>
                <select
                  value={step.tool}
                  onChange={(e) => updateStep(step.id, { tool: e.target.value, input: {} })}
                  style={styles.input}
                >
                  {tools.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Output Key</label>
                <input
                  type="text"
                  value={step.outputKey}
                  onChange={(e) => updateStep(step.id, { outputKey: e.target.value })}
                  style={styles.input}
                  placeholder="resultName"
                />
              </div>
            </div>

            {selectedTool?.inputSchema?.properties && (
              <div>
                <label style={styles.label}>Input Parameters (JSON)</label>
                <textarea
                  value={JSON.stringify(step.input, null, 2)}
                  onChange={(e) => {
                    try {
                      updateStep(step.id, { input: JSON.parse(e.target.value) });
                    } catch {}
                  }}
                  rows={4}
                  style={styles.textarea}
                  placeholder={'{\n  "key": "value or {{previousResult}}"\n}'}
                />
                <div style={styles.hint}>
                  Available params: {Object.keys(selectedTool.inputSchema.properties).join(', ')}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {steps.length > 0 && (
        <div style={styles.card}>
          <button onClick={runChain} disabled={loading} style={{ ...styles.button, ...styles.buttonSuccess }}>
            {loading ? 'Running Chain...' : '▶ Run Chain'}
          </button>
        </div>
      )}

      {output && (
        <div style={styles.card}>
          <label style={styles.label}>Chain Output</label>
          <div style={styles.output}>{output}</div>
        </div>
      )}

      {steps.length === 0 && (
        <div style={{ ...styles.card, textAlign: 'center', color: '#6b7280' }}>
          <p>No steps yet. Click "Add Step" to build a tool chain.</p>
          <p style={{ fontSize: 13 }}>
            Example: Read file → Send to LLM → Write result → Copy to clipboard
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MCP TAB - MCP Server Management
// ============================================================================

function MCPTab() {
  const [servers, setServers] = useState<any[]>([]);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });
  const [loading, setLoading] = useState(false);

  const refreshServers = async () => {
    const list = await window.workbench.mcp.list();
    setServers(list);
  };

  useEffect(() => {
    refreshServers();
  }, []);

  const addServer = async () => {
    if (!newServer.name || !newServer.command) return;
    setLoading(true);
    const args = newServer.args.split(' ').filter(a => a.trim());
    const result = await window.workbench.mcp.add({
      name: newServer.name,
      command: newServer.command,
      args
    });
    if (result.success) {
      setNewServer({ name: '', command: '', args: '' });
      await refreshServers();
    } else {
      alert(`Failed to connect: ${result.error}`);
    }
    setLoading(false);
  };

  const removeServer = async (name: string) => {
    await window.workbench.mcp.remove(name);
    await refreshServers();
  };

  const reconnect = async (name: string) => {
    setLoading(true);
    await window.workbench.mcp.reconnect(name);
    await refreshServers();
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    connected: '#16a34a',
    connecting: '#ca8a04',
    disconnected: '#6b7280',
    error: '#dc2626'
  };

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px 0' }}>Add MCP Server</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              style={styles.input}
              placeholder="filesystem"
            />
          </div>
          <div>
            <label style={styles.label}>Command</label>
            <input
              type="text"
              value={newServer.command}
              onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
              style={styles.input}
              placeholder="npx"
            />
          </div>
          <div>
            <label style={styles.label}>Arguments</label>
            <input
              type="text"
              value={newServer.args}
              onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
              style={styles.input}
              placeholder="-y @modelcontextprotocol/server-filesystem /path"
            />
          </div>
          <button onClick={addServer} disabled={loading} style={{ ...styles.button, ...styles.buttonPrimary }}>
            {loading ? '...' : 'Add'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px 0' }}>Connected Servers</h3>
        {servers.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No MCP servers configured. Add one above.</p>
        ) : (
          <div style={styles.grid}>
            {servers.map(server => (
              <div key={server.name} style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{server.name}</strong>
                  <span style={{ ...styles.badge, background: statusColors[server.status], color: 'white' }}>
                    {server.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  {server.toolCount} tools available
                </div>
                {server.tools.length > 0 && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                    {server.tools.slice(0, 5).join(', ')}
                    {server.tools.length > 5 && ` +${server.tools.length - 5} more`}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => reconnect(server.name)} style={{ ...styles.button, ...styles.buttonSecondary, padding: '4px 8px', fontSize: 12 }}>
                    Reconnect
                  </button>
                  <button onClick={() => removeServer(server.name)} style={{ ...styles.button, ...styles.buttonDanger, padding: '4px 8px', fontSize: 12 }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h4 style={{ margin: '0 0 8px 0' }}>Popular MCP Servers</h4>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          <p><strong>Filesystem:</strong> npx -y @modelcontextprotocol/server-filesystem /path/to/dir</p>
          <p><strong>GitHub:</strong> npx -y @modelcontextprotocol/server-github</p>
          <p><strong>Brave Search:</strong> npx -y @modelcontextprotocol/server-brave-search</p>
          <p><strong>SQLite:</strong> npx -y @modelcontextprotocol/server-sqlite /path/to/db.sqlite</p>
          <p><strong>Memory:</strong> npx -y @modelcontextprotocol/server-memory</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB - API keys, model routing, working directory
// ============================================================================

function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [router, setRouter] = useState<Record<string, { model: string }>>({});
  const [workingDir, setWorkingDir] = useState('');
  const [pluginsDir, setPluginsDir] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.workbench.getConfig().then((cfg: any) => {
      setApiKey(cfg.openrouterApiKey || '');
      setRouter(cfg.router || {});
      setWorkingDir(cfg.workingDir || '');
      setPluginsDir(cfg.pluginsDir || '');
    });
  }, []);

  const save = async () => {
    await window.workbench.setConfig({
      openrouterApiKey: apiKey,
      router,
      workingDir,
      pluginsDir
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roles = ['writer_cheap', 'structurer', 'coder_cheap', 'reviewer'];

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px 0' }}>API Configuration</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={styles.label}>OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={styles.input}
            placeholder="sk-or-..."
          />
          <div style={styles.hint}>Get your key at openrouter.ai</div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px 0' }}>Model Routing</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Configure which models handle each task type. Use OpenRouter model IDs.
        </p>
        {roles.map(role => (
          <div key={role} style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'center' }}>
            <label style={{ fontWeight: 500 }}>{role}</label>
            <input
              type="text"
              value={router[role]?.model || ''}
              onChange={(e) => setRouter({ ...router, [role]: { model: e.target.value } })}
              style={styles.input}
              placeholder="anthropic/claude-3-haiku"
            />
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px 0' }}>Directories</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>Working Directory</label>
          <input
            type="text"
            value={workingDir}
            onChange={(e) => setWorkingDir(e.target.value)}
            style={styles.input}
            placeholder="Default: User home directory"
          />
          <div style={styles.hint}>Base path for relative file operations</div>
        </div>
        <div>
          <label style={styles.label}>Plugins Directory</label>
          <input
            type="text"
            value={pluginsDir}
            onChange={(e) => setPluginsDir(e.target.value)}
            style={styles.input}
            placeholder="Default: ./plugins"
          />
          <div style={styles.hint}>Where custom tool plugins are stored</div>
        </div>
      </div>

      <div style={styles.card}>
        <button onClick={save} style={{ ...styles.button, ...styles.buttonSuccess }}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
        <button 
          onClick={() => window.workbench.reloadPlugins()} 
          style={{ ...styles.button, ...styles.buttonSecondary, marginLeft: 8 }}
        >
          Reload Plugins
        </button>
      </div>
    </div>
  );
}
