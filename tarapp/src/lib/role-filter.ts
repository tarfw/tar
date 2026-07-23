/**
 * Role Filter (CLAC - Channel-Led Access Control)
 * Parses team/members.md from S3 and checks user skills permissions.
 */

import { parseYamlFrontmatter } from './layout-engine';

export interface MemberConfig {
  email: string;
  role: string;
  platform?: string;
  channelId?: string;
  status: 'verified' | 'pending';
}

export interface RolePermissions {
  roles: Record<string, string[]>; // e.g. Staff -> [orders, inventory]
  members: MemberConfig[];
}

export function parseMembersConfig(markdownContent: string): RolePermissions {
  try {
    const { frontmatter } = parseYamlFrontmatter(markdownContent);
    return {
      roles: frontmatter.roles || {},
      members: frontmatter.members || [],
    };
  } catch (err) {
    console.warn('[RoleFilter] Failed to parse members.md:', err);
    return { roles: {}, members: [] };
  }
}

/**
 * Filter modules based on user email and S3 members configuration.
 */
export function filterModulesByRole(
  userEmail: string,
  allModules: string[],
  membersMarkdown: string | null
): string[] {
  if (!membersMarkdown) return allModules; // Default fallback if config not found

  const { roles, members } = parseMembersConfig(membersMarkdown);

  // Find member matching email
  const member = members.find(
    (m) => m.email.toLowerCase() === userEmail.toLowerCase() && m.status === 'verified'
  );

  if (!member) {
    // If not found in members configuration, default to guest access (empty or read-only/default)
    return [];
  }

  const allowedSkills = roles[member.role] || [];
  if (allowedSkills.includes('*')) {
    return allModules; // Admin gets access to all modules
  }

  return allModules.filter((mod) => allowedSkills.includes(mod));
}
