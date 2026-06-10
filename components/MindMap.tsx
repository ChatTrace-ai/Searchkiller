'use client';

import { useRef, useCallback } from 'react';
import Tree from 'react-d3-tree';
import { motion } from 'framer-motion';

interface MindMapNode {
  name: string;
  attributes?: {
    summary?: string;
    sources?: string[] | string;
  };
  children?: MindMapNode[];
}

/** Plain tree for react-d3-tree (it mutates nodes in place). */
interface D3TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: D3TreeNode[];
}

function toD3TreeNode(data: MindMapNode | null | undefined): D3TreeNode | null {
  if (!data || typeof data !== 'object') return null;

  const name =
    data.name != null && String(data.name).trim()
      ? String(data.name).trim()
      : '未命名节点';

  const node: D3TreeNode = { name };

  if (data.attributes) {
    node.attributes = {};
    if (data.attributes.summary) {
      node.attributes.summary = String(data.attributes.summary);
    }
    if (data.attributes.sources) {
      node.attributes.sources = Array.isArray(data.attributes.sources)
        ? data.attributes.sources.join(', ')
        : String(data.attributes.sources);
    }
  }

  const children = (data.children ?? [])
    .map(toD3TreeNode)
    .filter((child): child is D3TreeNode => child !== null);

  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

interface MindMapProps {
  data: MindMapNode | null;
  isStreaming: boolean;
}

export function MindMap({ data, isStreaming }: MindMapProps) {
  const treeContainer = useRef<HTMLDivElement>(null);
  const treeData = data ? toD3TreeNode(data) : null;
  const treeKey = treeData ? JSON.stringify(treeData) : 'empty';

  const renderCustomNode = useCallback(({ nodeDatum }: { nodeDatum: any }) => (
    <g>
      <circle r={8} fill="#4285F4" />
      <text
        fill="#1f2937"
        x={15}
        dy=".35em"
        fontSize={12}
        fontWeight={500}
      >
        {nodeDatum.name}
      </text>
      {nodeDatum.attributes?.summary && (
        <text
          fill="#64748b"
          x={15}
          dy="1.8em"
          fontSize={10}
        >
          {String(nodeDatum.attributes.summary).substring(0, 40)}...
        </text>
      )}
    </g>
  ), []);

  if (!data && !isStreaming) return null;

  if (!treeData || isStreaming) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50">
        <motion.div
          className="text-gray-500"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          正在构建思维导图...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={treeContainer}
      className="h-full w-full bg-zinc-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Tree
        key={treeKey}
        data={treeData}
        orientation="horizontal"
        pathFunc="step"
        translate={{ x: 80, y: 300 }}
        separation={{ siblings: 1.5, nonSiblings: 2 }}
        renderCustomNodeElement={renderCustomNode}
        transitionDuration={300}
      />
    </motion.div>
  );
}
