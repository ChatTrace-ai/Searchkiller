'use client';

import { useRef, useCallback } from 'react';
import Tree from 'react-d3-tree';
import { motion } from 'framer-motion';

interface MindMapNode {
  name: string;
  attributes?: {
    summary?: string;
    sources?: string[];
  };
  children?: MindMapNode[];
}

interface MindMapProps {
  data: MindMapNode | null;
  isStreaming: boolean;
}

export function MindMap({ data, isStreaming }: MindMapProps) {
  const treeContainer = useRef<HTMLDivElement>(null);

  const renderCustomNode = useCallback(({ nodeDatum }: { nodeDatum: any }) => (
    <g>
      <circle r={8} fill="#4285F4" />
      <text
        fill="#f5f5f7"
        x={15}
        dy=".35em"
        fontSize={12}
        fontWeight={500}
      >
        {nodeDatum.name}
      </text>
      {nodeDatum.attributes?.summary && (
        <text
          fill="#86868b"
          x={15}
          dy="1.8em"
          fontSize={10}
        >
          {nodeDatum.attributes.summary.substring(0, 40)}...
        </text>
      )}
    </g>
  ), []);

  const toTreeData = useCallback((node: MindMapNode): any => ({
    name: node.name,
    attributes: node.attributes
      ? { summary: node.attributes.summary ?? '', sources: (node.attributes.sources ?? []).join(', ') }
      : undefined,
    children: node.children?.map(toTreeData),
  }), []);

  if (!data && !isStreaming) return null;

  if (!data && isStreaming) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          className="text-gray-400"
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
      className="h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Tree
        data={toTreeData(data!)}
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
