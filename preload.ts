// Electron preload script
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('workbench', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial: any) => ipcRenderer.invoke('config:set', partial),
    runTask: (taskType: string, prompt: string) => ipcRenderer.invoke('task:run', taskType, prompt),
  reloadPlugins: () => ipcRenderer.invoke('plugins:reload'),
  listTools: () => ipcRenderer.invoke('tools:list'),
  runTool: (name: string, input: any) => ipcRenderer.invoke('tools:run', name, input),
});
