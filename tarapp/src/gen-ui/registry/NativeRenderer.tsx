/**
 * NativeRenderer — replaces WorkspaceCanvas switches.
 * Uses ComponentRegistry for dynamic rendering.
 */

import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { getComponent, hasComponent, type SectionProps } from './ComponentRegistry';
import './builtins'; // Register all built-ins
import type { UINode, UIPlan } from '../types';

interface NativeRendererProps {
  plan: UIPlan;
  designTokens: SectionProps['designTokens'];
  data?: Record<string, any[]>;
  onExecuteAction?: (actionName: string, params: Record<string, any>) => Promise<any>;
}

function renderNode(
  node: UINode,
  designTokens: SectionProps['designTokens'],
  data?: Record<string, any[]>,
  onExecuteAction?: SectionProps['onExecuteAction']
): React.ReactNode {
  // Unknown type = silent skip, never crash
  if (!hasComponent(node.type)) {
    console.warn(`[NativeRenderer] Unknown component type: ${node.type}`);
    return null;
  }

  const entry = getComponent(node.type);
  if (!entry) return null;

  const Component = entry.component;

  // Resolve bindings to data
  const resolvedData: any[] = [];
  if (node.bindings) {
    for (const [key, binding] of Object.entries(node.bindings)) {
      const resourceData = data?.[binding.resource] || [];
      if (Array.isArray(resourceData)) {
        resolvedData.push(...resourceData);
      }
    }
  }

  // Resolve action bindings
  const actionProps: Record<string, any> = {};
  if (node.actions) {
    for (const [key, actionBinding] of Object.entries(node.actions)) {
      actionProps[key] = actionBinding.action;
    }
  }

  return (
    <Component
      type={node.type}
      props={{ ...node.props, ...actionProps, actions: node.actions ? Object.entries(node.actions).map(([k, v]) => ({ name: v.action, label: k })) : undefined }}
      designTokens={designTokens}
      data={resolvedData}
      onExecuteAction={onExecuteAction}
    />
  );
}

export default function NativeRenderer({
  plan,
  designTokens,
  data = {},
  onExecuteAction,
}: NativeRendererProps) {
  // Find the first route (or the one matching current path)
  const route = plan.routes[0];

  if (!route) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 14 }}>No layout available</Text>
      </View>
    );
  }

  return (
    <View>
      {route.nodes.map((node) => (
        <View key={node.id}>
          {renderNode(node, designTokens, data, onExecuteAction)}
        </View>
      ))}
    </View>
  );
}
