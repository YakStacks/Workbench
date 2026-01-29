"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Electron preload script
var electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('workbench', {
    getConfig: function () { return electron_1.ipcRenderer.invoke('config:get'); },
    setConfig: function (partial) { return electron_1.ipcRenderer.invoke('config:set', partial); },
    runTask: function (prompt) { return electron_1.ipcRenderer.invoke('task:run', prompt); },
    reloadPlugins: function () { return electron_1.ipcRenderer.invoke('plugins:reload'); },
    listTools: function () { return electron_1.ipcRenderer.invoke('tools:list'); },
    runTool: function (name, input) { return electron_1.ipcRenderer.invoke('tools:run', name, input); },
});
