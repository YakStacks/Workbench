// Electron preload script
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('workbench', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial: any) => ipcRenderer.invoke('config:set', partial),
  runTask: (args: any) => ipcRenderer.invoke('task:run', args),
  reloadPlugins: () => ipcRenderer.invoke('plugins:reload'),
  listTools: () => ipcRenderer.invoke('tools:list'),
  runTool: (name: string, input: any) => ipcRenderer.invoke('tools:run', name, input),
});
