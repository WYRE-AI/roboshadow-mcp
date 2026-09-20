import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { IDENTITY_TOOLS, handleIdentityTool, isIdentityTool } from './identity.js';
import { MFA_TOOLS, handleMfaTool, isMfaTool } from './mfa.js';
import { VSCANNER_TOOLS, handleVscannerTool, isVscannerTool } from './vscanner.js';
import { APPLICATION_TOOLS, handleApplicationTool, isApplicationTool } from './applications.js';
import { DEVICE_TOOLS, handleDeviceTool, isDeviceTool } from './devices.js';
import { ANTIVIRUS_TOOLS, handleAntivirusTool, isAntivirusTool } from './antivirus.js';
import { FIREWALL_TOOLS, handleFirewallTool, isFirewallTool } from './firewall.js';
import { DISK_TOOLS, handleDiskTool, isDiskTool } from './disks.js';
import { HARDWARE_TOOLS, handleHardwareTool, isHardwareTool } from './hardware.js';
import { SERVICE_TOOLS, handleServiceTool, isServiceTool } from './services.js';
import { UPDATE_TOOLS, handleUpdateTool, isUpdateTool } from './updates.js';
import { VULNERABILITY_TOOLS, handleVulnerabilityTool, isVulnerabilityTool } from './vulnerabilities.js';
import { REMEDIATION_TOOLS, handleRemediationTool, isRemediationTool } from './remediation.js';
import type { CallToolResult } from './types.js';

export const ALL_TOOLS: Tool[] = [
  ...IDENTITY_TOOLS,
  ...MFA_TOOLS,
  ...VSCANNER_TOOLS,
  ...APPLICATION_TOOLS,
  ...DEVICE_TOOLS,
  ...ANTIVIRUS_TOOLS,
  ...FIREWALL_TOOLS,
  ...DISK_TOOLS,
  ...HARDWARE_TOOLS,
  ...SERVICE_TOOLS,
  ...UPDATE_TOOLS,
  ...VULNERABILITY_TOOLS,
  ...REMEDIATION_TOOLS,
];

export async function dispatchToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (isIdentityTool(name)) return handleIdentityTool(name, args);
  if (isMfaTool(name)) return handleMfaTool(name, args);
  if (isVscannerTool(name)) return handleVscannerTool(name, args);
  if (isApplicationTool(name)) return handleApplicationTool(name, args);
  if (isDeviceTool(name)) return handleDeviceTool(name, args);
  if (isAntivirusTool(name)) return handleAntivirusTool(name, args);
  if (isFirewallTool(name)) return handleFirewallTool(name, args);
  if (isDiskTool(name)) return handleDiskTool(name, args);
  if (isHardwareTool(name)) return handleHardwareTool(name, args);
  if (isServiceTool(name)) return handleServiceTool(name, args);
  if (isUpdateTool(name)) return handleUpdateTool(name, args);
  if (isVulnerabilityTool(name)) return handleVulnerabilityTool(name, args);
  if (isRemediationTool(name)) return handleRemediationTool(name, args);
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}
