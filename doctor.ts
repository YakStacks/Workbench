/**
 * Doctor Engine - V2.0 Trust Core
 * Comprehensive system diagnostics for Workbench
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

// ============================================================================
// TYPES
// ============================================================================

export interface DiagnosticResult {
  name: string;
  category: 'system' | 'process' | 'network' | 'security';
  status: 'PASS' | 'WARN' | 'FAIL';
  evidence: string;
  fixSteps?: string[];
  duration?: number;
}

export interface DoctorReport {
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

// ============================================================================
// DOCTOR ENGINE
// ============================================================================

export class DoctorEngine {
  private configDir: string;
  private appVersion: string;

  constructor(configDir: string, appVersion: string = '0.1.1') {
    this.configDir = configDir;
    this.appVersion = appVersion;
  }

  /**
   * Run all diagnostics and return a full report
   */
  async runAll(): Promise<DoctorReport> {
    const startTime = Date.now();
    const results: DiagnosticResult[] = [];

    // Run all checks
    results.push(await this.checkOsArch());
    results.push(await this.checkDiskSpace());
    results.push(await this.checkRam());
    results.push(await this.checkPermissions());
    results.push(await this.checkSpawnTest());
    results.push(await this.checkStdioCapture());
    results.push(await this.checkPathSanity());
    results.push(await this.checkLocalhostHealth());
    results.push(await this.checkProxyFirewall());
    
    // Windows-specific checks
    if (process.platform === 'win32') {
      results.push(await this.checkDefenderAv());
    }

    const summary = {
      pass: results.filter(r => r.status === 'PASS').length,
      warn: results.filter(r => r.status === 'WARN').length,
      fail: results.filter(r => r.status === 'FAIL').length,
    };

    return {
      timestamp: new Date().toISOString(),
      platform: `${os.platform()} ${os.release()} (${os.arch()})`,
      version: this.appVersion,
      results,
      summary,
    };
  }

  // --------------------------------------------------------------------------
  // INDIVIDUAL CHECKS
  // --------------------------------------------------------------------------

  /**
   * Check OS and Architecture
   */
  async checkOsArch(): Promise<DiagnosticResult> {
    const start = Date.now();
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();

    // Workbench currently supports Windows primarily
    const supportedPlatforms = ['win32', 'darwin', 'linux'];
    const supportedArch = ['x64', 'arm64'];

    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    const fixSteps: string[] = [];

    if (!supportedPlatforms.includes(platform)) {
      status = 'FAIL';
      fixSteps.push(`Platform "${platform}" is not officially supported`);
    }

    if (!supportedArch.includes(arch)) {
      status = 'WARN';
      fixSteps.push(`Architecture "${arch}" may have limited support`);
    }

    return {
      name: 'OS & Architecture',
      category: 'system',
      status,
      evidence: `${platform} ${release} (${arch})`,
      fixSteps: fixSteps.length > 0 ? fixSteps : undefined,
      duration: Date.now() - start,
    };
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace(): Promise<DiagnosticResult> {
    const start = Date.now();
    
    try {
      const appPath = this.configDir || os.homedir();
      let freeBytes = 0;
      let totalBytes = 0;

      if (process.platform === 'win32') {
        // Windows: use wmic
        const drive = path.parse(appPath).root.replace('\\', '');
        const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:csv`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n').filter(l => l.trim());
        if (lines.length >= 2) {
          const parts = lines[1].split(',');
          freeBytes = parseInt(parts[1]) || 0;
          totalBytes = parseInt(parts[2]) || 0;
        }
      } else {
        // Unix: use df
        const output = execSync(`df -k "${appPath}" | tail -1`, { encoding: 'utf-8' });
        const parts = output.trim().split(/\s+/);
        totalBytes = parseInt(parts[1]) * 1024;
        freeBytes = parseInt(parts[3]) * 1024;
      }

      const freeGB = freeBytes / (1024 * 1024 * 1024);
      const totalGB = totalBytes / (1024 * 1024 * 1024);

      let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
      const fixSteps: string[] = [];

      if (freeBytes < 100 * 1024 * 1024) { // < 100MB
        status = 'FAIL';
        fixSteps.push('Critical: Less than 100MB free disk space');
        fixSteps.push('Free up disk space immediately');
      } else if (freeBytes < 1024 * 1024 * 1024) { // < 1GB
        status = 'WARN';
        fixSteps.push('Low disk space (< 1GB free)');
        fixSteps.push('Consider freeing up disk space');
      }

      return {
        name: 'Disk Space',
        category: 'system',
        status,
        evidence: `${freeGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB`,
        fixSteps: fixSteps.length > 0 ? fixSteps : undefined,
        duration: Date.now() - start,
      };
    } catch (e: any) {
      return {
        name: 'Disk Space',
        category: 'system',
        status: 'WARN',
        evidence: `Could not check disk space: ${e.message}`,
        fixSteps: ['Disk space check failed - manual verification recommended'],
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Check RAM availability
   */
  async checkRam(): Promise<DiagnosticResult> {
    const start = Date.now();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = (usedMem / totalMem) * 100;

    const freeGB = freeMem / (1024 * 1024 * 1024);
    const totalGB = totalMem / (1024 * 1024 * 1024);

    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    const fixSteps: string[] = [];

    if (freeMem < 256 * 1024 * 1024) { // < 256MB
      status = 'FAIL';
      fixSteps.push('Critical: Less than 256MB RAM available');
      fixSteps.push('Close other applications to free memory');
    } else if (freeMem < 512 * 1024 * 1024) { // < 512MB
      status = 'WARN';
      fixSteps.push('Low available RAM (< 512MB)');
      fixSteps.push('Consider closing unused applications');
    }

    return {
      name: 'RAM Availability',
      category: 'system',
      status,
      evidence: `${freeGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB (${usedPercent.toFixed(0)}% used)`,
      fixSteps: fixSteps.length > 0 ? fixSteps : undefined,
      duration: Date.now() - start,
    };
  }

  /**
   * Check config directory permissions
   */
  async checkPermissions(): Promise<DiagnosticResult> {
    const start = Date.now();
    const testFile = path.join(this.configDir, '.doctor_test_' + Date.now());
    
    try {
      // Ensure config dir exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Try to write a test file
      fs.writeFileSync(testFile, 'test', 'utf-8');
      const content = fs.readFileSync(testFile, 'utf-8');
      fs.unlinkSync(testFile);

      if (content !== 'test') {
        throw new Error('Read content mismatch');
      }

      return {
        name: 'Config Directory Permissions',
        category: 'system',
        status: 'PASS',
        evidence: `Config dir writable: ${this.configDir}`,
        duration: Date.now() - start,
      };
    } catch (e: any) {
      return {
        name: 'Config Directory Permissions',
        category: 'system',
        status: 'FAIL',
        evidence: `Cannot write to config dir: ${e.message}`,
        fixSteps: [
          'Check folder permissions',
          `Ensure write access to: ${this.configDir}`,
          'Run as administrator if needed (Windows)',
        ],
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Test child process spawning
   */
  async checkSpawnTest(): Promise<DiagnosticResult> {
    const start = Date.now();

    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      const args = isWindows ? ['/c', 'echo spawn_test_ok'] : ['-c', 'echo spawn_test_ok'];

      try {
        const proc = spawn(shell, args, { timeout: 5000 });
        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => { stdout += data.toString(); });
        proc.stderr?.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
          if (code === 0 && stdout.includes('spawn_test_ok')) {
            resolve({
              name: 'Process Spawn Test',
              category: 'process',
              status: 'PASS',
              evidence: 'Child process spawned and captured output successfully',
              duration: Date.now() - start,
            });
          } else {
            resolve({
              name: 'Process Spawn Test',
              category: 'process',
              status: 'FAIL',
              evidence: `Spawn failed: exit code ${code}, stderr: ${stderr}`,
              fixSteps: [
                'Check if antivirus is blocking process creation',
                'Verify shell is accessible',
              ],
              duration: Date.now() - start,
            });
          }
        });

        proc.on('error', (err) => {
          resolve({
            name: 'Process Spawn Test',
            category: 'process',
            status: 'FAIL',
            evidence: `Spawn error: ${err.message}`,
            fixSteps: [
              'Check system permissions',
              'Verify shell executable exists',
              'Check if antivirus is blocking',
            ],
            duration: Date.now() - start,
          });
        });
      } catch (e: any) {
        resolve({
          name: 'Process Spawn Test',
          category: 'process',
          status: 'FAIL',
          evidence: `Exception: ${e.message}`,
          fixSteps: ['Check system configuration'],
          duration: Date.now() - start,
        });
      }
    });
  }

  /**
   * Test stdout/stderr capture sanity
   */
  async checkStdioCapture(): Promise<DiagnosticResult> {
    const start = Date.now();

    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/sh';
      // Echo to both stdout and stderr
      const cmd = isWindows 
        ? 'echo stdout_test & echo stderr_test 1>&2'
        : 'echo stdout_test && echo stderr_test >&2';
      const args = isWindows ? ['/c', cmd] : ['-c', cmd];

      try {
        const proc = spawn(shell, args, { timeout: 5000 });
        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => { stdout += data.toString(); });
        proc.stderr?.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', () => {
          const hasStdout = stdout.includes('stdout_test');
          const hasStderr = stderr.includes('stderr_test');

          if (hasStdout && hasStderr) {
            resolve({
              name: 'Stdio Capture',
              category: 'process',
              status: 'PASS',
              evidence: 'Both stdout and stderr captured correctly',
              duration: Date.now() - start,
            });
          } else {
            resolve({
              name: 'Stdio Capture',
              category: 'process',
              status: 'WARN',
              evidence: `Capture issue: stdout=${hasStdout}, stderr=${hasStderr}`,
              fixSteps: ['Output capture may be incomplete for some tools'],
              duration: Date.now() - start,
            });
          }
        });

        proc.on('error', (err) => {
          resolve({
            name: 'Stdio Capture',
            category: 'process',
            status: 'FAIL',
            evidence: `Error: ${err.message}`,
            duration: Date.now() - start,
          });
        });
      } catch (e: any) {
        resolve({
          name: 'Stdio Capture',
          category: 'process',
          status: 'FAIL',
          evidence: `Exception: ${e.message}`,
          duration: Date.now() - start,
        });
      }
    });
  }

  /**
   * Check PATH sanity - compare GUI vs shell PATH
   */
  async checkPathSanity(): Promise<DiagnosticResult> {
    const start = Date.now();
    const currentPath = process.env.PATH || '';
    const pathDirs = currentPath.split(path.delimiter);

    // Check for common required paths
    const issues: string[] = [];
    const isWindows = process.platform === 'win32';

    // Check if basic tools are accessible
    const testCommands = isWindows 
      ? ['where node', 'where npm']
      : ['which node', 'which npm'];

    let nodeFound = false;
    let npmFound = false;

    try {
      execSync(testCommands[0], { encoding: 'utf-8' });
      nodeFound = true;
    } catch { /* not found */ }

    try {
      execSync(testCommands[1], { encoding: 'utf-8' });
      npmFound = true;
    } catch { /* not found */ }

    if (!nodeFound) {
      issues.push('Node.js not found in PATH');
    }
    if (!npmFound) {
      issues.push('npm not found in PATH');
    }

    // Check for suspiciously short PATH
    if (pathDirs.length < 3) {
      issues.push('PATH has very few directories - may be incomplete');
    }

    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (issues.length > 0) {
      status = issues.some(i => i.includes('not found')) ? 'WARN' : 'WARN';
    }

    return {
      name: 'PATH Sanity',
      category: 'system',
      status,
      evidence: issues.length > 0 
        ? issues.join('; ') 
        : `PATH has ${pathDirs.length} directories, Node/npm accessible`,
      fixSteps: issues.length > 0 ? [
        'Ensure Node.js is installed and in PATH',
        'GUI apps may have different PATH than terminal',
        'Restart Workbench after PATH changes',
      ] : undefined,
      duration: Date.now() - start,
    };
  }

  /**
   * Check localhost networking
   */
  async checkLocalhostHealth(): Promise<DiagnosticResult> {
    const start = Date.now();

    return new Promise((resolve) => {
      // Try to bind an ephemeral port
      const server = net.createServer();

      server.on('error', (err: any) => {
        resolve({
          name: 'Localhost Network',
          category: 'network',
          status: 'FAIL',
          evidence: `Cannot bind localhost port: ${err.message}`,
          fixSteps: [
            'Check if firewall is blocking localhost',
            'Verify network stack is healthy',
            'Try: netsh winsock reset (Windows)',
          ],
          duration: Date.now() - start,
        });
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        const port = addr.port;

        // Now test connection to ourselves
        const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
          client.end();
          server.close();
          resolve({
            name: 'Localhost Network',
            category: 'network',
            status: 'PASS',
            evidence: `Bound and connected to localhost:${port}`,
            duration: Date.now() - start,
          });
        });

        client.on('error', (err) => {
          server.close();
          resolve({
            name: 'Localhost Network',
            category: 'network',
            status: 'WARN',
            evidence: `Bound port ${port} but loopback failed: ${err.message}`,
            fixSteps: ['Loopback connection issue detected'],
            duration: Date.now() - start,
          });
        });

        // Timeout
        setTimeout(() => {
          client.destroy();
          server.close();
          resolve({
            name: 'Localhost Network',
            category: 'network',
            status: 'WARN',
            evidence: 'Loopback connection timed out',
            fixSteps: ['Network may be slow or misconfigured'],
            duration: Date.now() - start,
          });
        }, 3000);
      });
    });
  }

  /**
   * Check for proxy/firewall configuration
   */
  async checkProxyFirewall(): Promise<DiagnosticResult> {
    const start = Date.now();
    const hints: string[] = [];

    // Check common proxy env vars
    const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY'];
    for (const v of proxyVars) {
      if (process.env[v]) {
        hints.push(`${v} is set`);
      }
    }

    // Windows-specific: check WinHTTP proxy
    if (process.platform === 'win32') {
      try {
        const output = execSync('netsh winhttp show proxy', { encoding: 'utf-8' });
        if (!output.includes('Direct access')) {
          hints.push('WinHTTP proxy configured');
        }
      } catch { /* ignore */ }
    }

    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (hints.length > 0) {
      status = 'WARN';
    }

    return {
      name: 'Proxy/Firewall',
      category: 'network',
      status,
      evidence: hints.length > 0 
        ? hints.join('; ') 
        : 'No proxy configuration detected',
      fixSteps: hints.length > 0 ? [
        'Proxy may affect network tool behavior',
        'Ensure proxy allows Workbench traffic',
      ] : undefined,
      duration: Date.now() - start,
    };
  }

  /**
   * Check Windows Defender / AV status
   */
  async checkDefenderAv(): Promise<DiagnosticResult> {
    const start = Date.now();
    const hints: string[] = [];

    try {
      // Check if Defender real-time protection is on
      const output = execSync(
        'powershell -Command "Get-MpPreference | Select-Object -ExpandProperty DisableRealtimeMonitoring"',
        { encoding: 'utf-8', timeout: 10000 }
      );
      
      if (output.trim() === 'False') {
        hints.push('Windows Defender real-time protection is ON');
      }
    } catch { 
      // PowerShell may not be available or MpPreference not accessible
      hints.push('Could not query Defender status');
    }

    // Check common AV exclusion needs
    const appPath = process.cwd();
    hints.push(`App path: Consider adding exclusion for ${appPath}`);

    return {
      name: 'Antivirus/Defender',
      category: 'security',
      status: 'WARN', // Always warn - AV can interfere
      evidence: hints.join('; '),
      fixSteps: [
        'If experiencing slowness, add Workbench folder to AV exclusions',
        'Defender may slow down process spawning',
      ],
      duration: Date.now() - start,
    };
  }

  // --------------------------------------------------------------------------
  // REPORT UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Sanitize a report for sharing (remove sensitive paths)
   */
  sanitizeReport(report: DoctorReport): DoctorReport {
    const username = os.userInfo().username;
    const homedir = os.homedir();
    
    const sanitize = (str: string): string => {
      return str
        .replace(new RegExp(username, 'gi'), '[USER]')
        .replace(new RegExp(homedir.replace(/\\/g, '\\\\'), 'gi'), '[HOME]')
        .replace(/[A-Za-z]:\\Users\\[^\\]+/gi, '[HOME]')
        .replace(/\/home\/[^\/]+/gi, '[HOME]')
        .replace(/\/Users\/[^\/]+/gi, '[HOME]');
    };

    return {
      ...report,
      platform: sanitize(report.platform),
      results: report.results.map(r => ({
        ...r,
        evidence: sanitize(r.evidence),
        fixSteps: r.fixSteps?.map(s => sanitize(s)),
      })),
    };
  }

  /**
   * Format report as plain text
   */
  formatReportText(report: DoctorReport, sanitize: boolean = false): string {
    const r = sanitize ? this.sanitizeReport(report) : report;
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                   WORKBENCH DOCTOR REPORT');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`Timestamp: ${r.timestamp}`);
    lines.push(`Platform:  ${r.platform}`);
    lines.push(`Version:   ${r.version}`);
    lines.push('');
    lines.push(`Summary: ${r.summary.pass} PASS | ${r.summary.warn} WARN | ${r.summary.fail} FAIL`);
    lines.push('───────────────────────────────────────────────────────────────');

    for (const result of r.results) {
      const icon = result.status === 'PASS' ? '✓' : result.status === 'WARN' ? '⚠' : '✗';
      lines.push(`[${icon}] ${result.name}: ${result.status}`);
      lines.push(`    ${result.evidence}`);
      if (result.fixSteps && result.fixSteps.length > 0) {
        lines.push('    Fix:');
        for (const step of result.fixSteps) {
          lines.push(`      → ${step}`);
        }
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    return lines.join('\n');
  }
}
