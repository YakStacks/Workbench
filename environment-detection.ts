/**
 * Environment Detection and Messaging - V2.0
 * Detect system capabilities and provide clear messaging for supported/unsupported environments
 */

import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface EnvironmentInfo {
  platform: string;
  arch: string;
  osVersion: string;
  nodeVersion: string;
  electronVersion?: string;
  totalMemory: number;
  freeMemory: number;
  cpuCores: number;
  supported: boolean;
  risks: EnvironmentRisk[];
  capabilities: EnvironmentCapability[];
}

export interface EnvironmentRisk {
  level: 'info' | 'warning' | 'error';
  category: 'lockdown' | 'compatibility' | 'performance' | 'security';
  message: string;
  recommendation?: string;
}

export interface EnvironmentCapability {
  name: string;
  available: boolean;
  reason?: string;
}

// ============================================================================
// ENVIRONMENT DETECTOR
// ============================================================================

export class EnvironmentDetector {
  /**
   * Get comprehensive environment information
   */
  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    const info: EnvironmentInfo = {
      platform: process.platform,
      arch: process.arch,
      osVersion: os.release(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCores: os.cpus().length,
      supported: true,
      risks: [],
      capabilities: [],
    };

    // Check if platform is supported
    if (!this.isSupportedPlatform(info.platform)) {
      info.supported = false;
      info.risks.push({
        level: 'error',
        category: 'compatibility',
        message: `Platform ${info.platform} is not officially supported`,
        recommendation: 'Use Windows, macOS, or Linux',
      });
    }

    // Check if architecture is supported
    if (!this.isSupportedArchitecture(info.arch)) {
      info.supported = false;
      info.risks.push({
        level: 'error',
        category: 'compatibility',
        message: `Architecture ${info.arch} is not officially supported`,
        recommendation: 'Use x64 or arm64 architecture',
      });
    }

    // Detect lockdown environments
    const lockdownRisks = await this.detectLockdown();
    info.risks.push(...lockdownRisks);

    // Detect capabilities
    info.capabilities = await this.detectCapabilities();

    // Performance warnings
    if (info.freeMemory < 1024 * 1024 * 1024) { // Less than 1GB free
      info.risks.push({
        level: 'warning',
        category: 'performance',
        message: 'Low available memory detected',
        recommendation: 'Close other applications to improve performance',
      });
    }

    return info;
  }

  /**
   * Check if platform is supported
   */
  private isSupportedPlatform(platform: string): boolean {
    return ['win32', 'darwin', 'linux'].includes(platform);
  }

  /**
   * Check if architecture is supported
   */
  private isSupportedArchitecture(arch: string): boolean {
    return ['x64', 'arm64'].includes(arch);
  }

  /**
   * Detect corporate lockdown or restricted environments
   */
  private async detectLockdown(): Promise<EnvironmentRisk[]> {
    const risks: EnvironmentRisk[] = [];

    // Check for restricted network access
    try {
      const hasInternet = await this.checkInternetAccess();
      if (!hasInternet) {
        risks.push({
          level: 'warning',
          category: 'lockdown',
          message: 'Limited or no internet access detected',
          recommendation: 'Some network-dependent tools may not work',
        });
      }
    } catch (error) {
      // Unable to check, assume it's okay
    }

    // Check for filesystem restrictions (Windows specific)
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync('powershell -Command "Get-ExecutionPolicy"');
        const policy = stdout.trim();
        if (policy === 'Restricted' || policy === 'AllSigned') {
          risks.push({
            level: 'warning',
            category: 'lockdown',
            message: `PowerShell execution policy is restrictive: ${policy}`,
            recommendation: 'Some process execution features may be limited',
          });
        }
      } catch (error) {
        // Can't check, skip
      }
    }

    // Check for write access to app directory
    try {
      const hasWriteAccess = await this.checkWriteAccess(process.cwd());
      if (!hasWriteAccess) {
        risks.push({
          level: 'warning',
          category: 'lockdown',
          message: 'Limited write access to application directory',
          recommendation: 'Some features may be restricted',
        });
      }
    } catch (error) {
      // Skip if can't check
    }

    return risks;
  }

  /**
   * Detect available capabilities
   */
  private async detectCapabilities(): Promise<EnvironmentCapability[]> {
    const capabilities: EnvironmentCapability[] = [];

    // OS Keychain / Secure Storage
    try {
      const { safeStorage } = require('electron');
      capabilities.push({
        name: 'Secure Storage',
        available: safeStorage.isEncryptionAvailable(),
        reason: safeStorage.isEncryptionAvailable() ? 
          'OS-level encryption available' : 
          'OS-level encryption not available',
      });
    } catch (error) {
      capabilities.push({
        name: 'Secure Storage',
        available: false,
        reason: 'Electron safeStorage not available',
      });
    }

    // Network Access
    capabilities.push({
      name: 'Network Access',
      available: await this.checkInternetAccess(),
      reason: await this.checkInternetAccess() ? 'Internet accessible' : 'No internet access',
    });

    // Process Execution
    capabilities.push({
      name: 'Process Execution',
      available: await this.checkProcessExecution(),
      reason: await this.checkProcessExecution() ? 
        'Can spawn child processes' : 
        'Process execution restricted',
    });

    return capabilities;
  }

  /**
   * Check internet access
   */
  private async checkInternetAccess(): Promise<boolean> {
    try {
      const https = require('https');
      return new Promise((resolve) => {
        const req = https.get('https://www.google.com', { timeout: 5000 }, (res: any) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Check write access to a directory
   */
  private async checkWriteAccess(dir: string): Promise<boolean> {
    try {
      const fs = require('fs').promises;
      const testFile = require('path').join(dir, '.write-test-' + Date.now());
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we can execute child processes
   */
  private async checkProcessExecution(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        const cmd = process.platform === 'win32' ? 'echo test' : 'echo test';
        exec(cmd, { timeout: 2000 }, (error: any, stdout: any) => {
          resolve(!error && stdout.includes('test'));
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Format environment info for display
   */
  formatEnvironmentInfo(info: EnvironmentInfo): string {
    let output = `**Environment Information**\n\n`;
    
    output += `**System:**\n`;
    output += `- Platform: ${info.platform}\n`;
    output += `- Architecture: ${info.arch}\n`;
    output += `- OS Version: ${info.osVersion}\n`;
    output += `- Node: ${info.nodeVersion}\n`;
    if (info.electronVersion) {
      output += `- Electron: ${info.electronVersion}\n`;
    }
    output += '\n';

    output += `**Resources:**\n`;
    output += `- CPU Cores: ${info.cpuCores}\n`;
    output += `- Total Memory: ${(info.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    output += `- Free Memory: ${(info.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    output += '\n';

    output += `**Status:** ${info.supported ? '✅ Supported' : '❌ Unsupported'}\n\n`;

    if (info.capabilities.length > 0) {
      output += `**Capabilities:**\n`;
      info.capabilities.forEach(cap => {
        const icon = cap.available ? '✅' : '❌';
        output += `${icon} ${cap.name}`;
        if (cap.reason) {
          output += ` - ${cap.reason}`;
        }
        output += '\n';
      });
      output += '\n';
    }

    if (info.risks.length > 0) {
      output += `**Environment Risks:**\n`;
      info.risks.forEach(risk => {
        const icon = risk.level === 'error' ? '❌' : 
                     risk.level === 'warning' ? '⚠️' : 'ℹ️';
        output += `${icon} **${risk.category}:** ${risk.message}\n`;
        if (risk.recommendation) {
          output += `   💡 ${risk.recommendation}\n`;
        }
      });
      output += '\n';
    }

    return output;
  }

  /**
   * Get a friendly unsupported environment message
   */
  getUnsupportedMessage(info: EnvironmentInfo): string {
    let message = `**⚠️ Unsupported Environment Detected**\n\n`;
    message += `Workbench may not function properly on this system.\n\n`;

    const errors = info.risks.filter(r => r.level === 'error');
    if (errors.length > 0) {
      message += `**Issues:**\n`;
      errors.forEach(err => {
        message += `- ${err.message}\n`;
        if (err.recommendation) {
          message += `  ${err.recommendation}\n`;
        }
      });
    }

    message += `\n**Supported Platforms:** Windows (x64), macOS (x64/arm64), Linux (x64)\n`;
    message += `\nYou can continue, but some features may not work as expected.`;

    return message;
  }

  /**
   * Get lockdown warning message
   */
  getLockdownWarning(info: EnvironmentInfo): string | null {
    const lockdownRisks = info.risks.filter(r => r.category === 'lockdown');
    if (lockdownRisks.length === 0) {
      return null;
    }

    let message = `**🔒 Corporate Environment Detected**\n\n`;
    message += `Some restrictions have been detected on this system:\n\n`;

    lockdownRisks.forEach(risk => {
      message += `- ${risk.message}\n`;
    });

    message += `\nThese restrictions may limit certain features. Check with your IT department if you need additional access.`;

    return message;
  }
}
