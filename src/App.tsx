
import React, { useState, useEffect, ChangeEvent } from 'react';
// Ensure JSX types are available
import type {} from 'react/jsx-runtime';

const TABS = ['Tasks', 'Models', 'Plugins'] as const;
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
      {tab === 'Plugins' && <PluginsTab />}
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

function PluginsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState('{}');
  const [output, setOutput] = useState('');
  useEffect(() => {
    window.workbench.listTools().then(setTools);
  }, []);
  async function run() {
    try {
      const res = await window.workbench.runTool(selected, JSON.parse(input));
      setOutput(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setOutput(e.message);
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
        <div>Input (JSON):<br /><textarea value={input} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)} rows={4} style={{ width: 400 }} /></div>
        <button onClick={run}>Run Tool</button>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#eee', padding: 8 }}>{output}</div>
      </>}
    </div>
  );
}
