
import React, { useState, useEffect, ChangeEvent } from 'react';
// Ensure JSX types are available
import type {} from 'react/jsx-runtime';

const TABS = ['Tasks', 'Models', 'Tools'] as const;
type Tab = typeof TABS[number];

type Tool = { name: string; inputSchema: any };

declare global {
  interface Window {
    workbench: any;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Tasks');
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontWeight: tab === t ? 'bold' : undefined }}>{t}</button>
        ))}
      </div>
      {tab === 'Tasks' && <TasksTab />}
      {tab === 'Models' && <ModelsTab />}
      {tab === 'Tools' && <ToolsTab />}
    </div>
  );
}

function TasksTab() {
  const [prompt, setPrompt] = useState('');
  const [taskType, setTaskType] = useState('writer_cheap');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <div>
        Task Type: <select value={taskType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTaskType(e.target.value)}>
          <option value="writer_cheap">writer_cheap</option>
          <option value="structurer">structurer</option>
          <option value="coder_cheap">coder_cheap</option>
          <option value="reviewer">reviewer</option>
        </select>
      </div>
      <textarea value={prompt} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={4} style={{ width: 400 }} />
      <br />
      <button onClick={async () => {
        setLoading(true);
        setOutput('');
        try {
          const res = await window.workbench.runTask(taskType, prompt);
          setOutput(res.content || JSON.stringify(res, null, 2));
        } catch (e: any) {
          setOutput(e.message);
        }
        setLoading(false);
      }}>Run</button>
      <div style={{ marginTop: 16, whiteSpace: 'pre-wrap', background: '#eee', padding: 8, minHeight: 80 }}>
        {loading ? 'Running...' : output}
      </div>
    </div>
  );
}

function ModelsTab() {
  const [config, setConfig] = useState<any>({});
  const [apiKey, setApiKey] = useState('');
  const [router, setRouter] = useState<any>({});
  useEffect(() => {
    window.workbench.getConfig().then((cfg: any) => {
      setConfig(cfg);
      setApiKey(cfg.openrouterApiKey || '');
      setRouter(cfg.router || {});
    });
  }, []);
  function save() {
    window.workbench.setConfig({ openrouterApiKey: apiKey, router });
  }
  return (
    <div>
      <div>OpenRouter API Key: <input value={apiKey} onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)} style={{ width: 300 }} /></div>
      <div style={{ marginTop: 8 }}>
        <b>Role → Model mapping</b>
        {['writer_cheap', 'structurer', 'coder_cheap', 'reviewer'].map(role => (
          <div key={role}>
            {role}: <input value={router[role]?.model || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouter({ ...router, [role]: { provider: 'openrouter', model: e.target.value } })} style={{ width: 200 }} />
          </div>
        ))}
      </div>
      <button style={{ marginTop: 8 }} onClick={save}>Save</button>
    </div>
  );
}

function ToolsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState('{}');
  const [output, setOutput] = useState('');
  // Dedicated fields for convertArtifact tool
  const [code, setCode] = useState('');
  const [toolName, setToolName] = useState('');
  const [description, setDescription] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [status, setStatus] = useState('');
  // Dynamic form values for schema-based tools
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  useEffect(() => {
    window.workbench.listTools().then(setTools);
  }, []);

  // Get the selected tool's schema
  const selectedTool = tools.find(t => t.name === selected);
  const isConvertArtifact = selected === 'workbench.convertArtifact';
  
  // Reset form values when tool changes
  useEffect(() => {
    setFormValues({});
    setOutput('');
    setStatus('');
  }, [selected]);

  const [isRunningLLM, setIsRunningLLM] = useState(false);

  // Build payload from form values or raw JSON
  function buildPayload() {
    if (isConvertArtifact) {
      const payload: any = { code };
      if (toolName.trim()) payload.toolName = toolName.trim();
      if (description.trim()) payload.description = description.trim();
      return payload;
    }
    // Use form values if we have a schema, otherwise parse JSON
    if (selectedTool?.inputSchema?.properties && Object.keys(formValues).length > 0) {
      return formValues;
    }
    return JSON.parse(input);
  }

  async function run() {
    try {
      const payload = buildPayload();
      const res = await window.workbench.runTool(selected, payload);
      setOutput(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setOutput(e.message);
    }
  }

  // Run tool AND send resulting prompt to LLM for full execution
  async function runWithLLM() {
    setIsRunningLLM(true);
    setStatus('Running tool...');
    setOutput('');
    try {
      const payload = buildPayload();
      
      // Step 1: Run the tool to get prompt + metadata
      const toolResult = await window.workbench.runTool(selected, payload);
      
      if (!toolResult.prompt) {
        setOutput('Tool did not return a prompt. Raw output:\n' + JSON.stringify(toolResult, null, 2));
        return;
      }
      
      setStatus('Sending to LLM...');
      
      // Step 2: Send prompt to LLM
      const llmResult = await window.workbench.runTask(
        toolResult.metadata?.suggestedRole || 'writer_cheap',
        toolResult.prompt
      );
      
      setStatus('✓ Complete');
      setOutput(llmResult.content);
      
    } catch (e: any) {
      setStatus('✗ Error');
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsRunningLLM(false);
    }
  }

  // Full conversion flow: generate prompt → LLM → save plugin
  async function convertAndSave() {
    if (!code.trim()) return;
    const pluginNameToUse = toolName.trim() || 'converted_tool';
    
    setIsConverting(true);
    setStatus('Generating conversion prompt...');
    setOutput('');
    
    try {
      // Step 1: Run the converter tool to get the prompt
      const payload: any = { code };
      if (toolName.trim()) payload.toolName = toolName.trim();
      if (description.trim()) payload.description = description.trim();
      
      const toolResult = await window.workbench.runTool('workbench.convertArtifact', payload);
      
      setStatus('Sending to LLM...');
      
      // Step 2: Send prompt to LLM via task runner
      const llmResult = await window.workbench.runTask(
        toolResult.metadata?.suggestedRole || 'coder_cheap',
        toolResult.prompt
      );
      
      setStatus('Saving tool...');
      
      // Step 3: Save the generated code as a tool
      const saveResult = await window.workbench.savePlugin(pluginNameToUse, llmResult.content);
      
      setStatus(`✓ Tool saved: ${saveResult.name}`);
      setOutput(`Tool created successfully!\n\nPath: ${saveResult.path}\n\n--- Generated Code ---\n${llmResult.content}`);
      
      // Refresh tools list
      const updatedTools = await window.workbench.listTools();
      setTools(updatedTools);
      
    } catch (e: any) {
      setStatus('✗ Error');
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <div>
      <div>Tools:</div>
      <ul>
        {tools.map(t => (
          <li key={t.name}>
            <button onClick={() => setSelected(t.name)} style={{ fontWeight: selected === t.name ? 'bold' : undefined }}>{t.name}</button>
          </li>
        ))}
      </ul>
      {selected && <>
        {isConvertArtifact ? (
          <div>
            <div style={{ marginBottom: 8 }}>
              <label>Tool Name (optional):<br />
                <input 
                  value={toolName} 
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setToolName(e.target.value)} 
                  placeholder="e.g., clinical.noteGenerator"
                  style={{ width: 300 }} 
                />
              </label>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Description (optional):<br />
                <input 
                  value={description} 
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} 
                  placeholder="Brief description of what the tool should do"
                  style={{ width: 400 }} 
                />
              </label>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Paste Code / Artifact:<br />
                <textarea 
                  value={code} 
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCode(e.target.value)} 
                  rows={10} 
                  style={{ width: 500, fontFamily: 'monospace' }} 
                  placeholder="Paste your React component, Claude artifact, or any code here..."
                />
              </label>
            </div>
          </div>
        ) : selectedTool?.inputSchema?.properties ? (
          // Dynamic form based on inputSchema
          <div style={{ marginBottom: 8 }}>
            {Object.entries(selectedTool.inputSchema.properties).map(([key, prop]: [string, any]) => {
              const isRequired = selectedTool.inputSchema.required?.includes(key);
              const label = `${key}${isRequired ? ' *' : ''}`;
              const isLongText = key.toLowerCase().includes('asam') || 
                                 key.toLowerCase().includes('content') || 
                                 key.toLowerCase().includes('text') ||
                                 key.toLowerCase().includes('previous') ||
                                 key.toLowerCase().includes('notes');
              
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                    {label}
                    {prop.description && <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8, fontSize: '0.9em' }}>({prop.description})</span>}
                  </label>
                  {prop.enum ? (
                    // Dropdown for enum types
                    <select
                      value={formValues[key] || ''}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormValues({ ...formValues, [key]: e.target.value })}
                      style={{ width: 300, padding: 6 }}
                    >
                      <option value="">Select...</option>
                      {prop.enum.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : isLongText ? (
                    // Textarea for long text fields
                    <textarea
                      value={formValues[key] || ''}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormValues({ ...formValues, [key]: e.target.value })}
                      rows={8}
                      style={{ width: 500, fontFamily: 'monospace', padding: 8 }}
                      placeholder={prop.description || `Enter ${key}...`}
                    />
                  ) : (
                    // Regular text input
                    <input
                      type="text"
                      value={formValues[key] || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, [key]: e.target.value })}
                      style={{ width: 400, padding: 6 }}
                      placeholder={prop.description || `Enter ${key}...`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Fallback to raw JSON for tools without schema
          <div>Input (JSON):<br /><textarea value={input} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)} rows={4} style={{ width: 400 }} /></div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={run}>Run Tool</button>
          <button 
            onClick={runWithLLM} 
            disabled={isRunningLLM}
            style={{ background: '#16a34a', color: 'white', padding: '4px 12px', border: 'none', borderRadius: 4, cursor: isRunningLLM ? 'wait' : 'pointer' }}
          >
            {isRunningLLM ? 'Running...' : 'Run with LLM'}
          </button>
          {isConvertArtifact && (
            <button 
              onClick={convertAndSave} 
              disabled={isConverting || !code.trim()}
              style={{ background: '#2563eb', color: 'white', padding: '4px 12px', border: 'none', borderRadius: 4, cursor: isConverting ? 'wait' : 'pointer' }}
            >
              {isConverting ? 'Converting...' : 'Convert & Save Tool'}
            </button>
          )}
          {status && <span style={{ color: status.startsWith('✓') ? 'green' : status.startsWith('✗') ? 'red' : '#666' }}>{status}</span>}
        </div>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#eee', padding: 8, maxHeight: 300, overflow: 'auto' }}>{output}</div>
      </>}
    </div>
  );
}
