'use client';

import { CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, PlayCircle, Bot, Network, Workflow } from 'lucide-react';
import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  suppressErrorRendering: true,
});

function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      mermaid.parse(chart)
        .then(() => mermaid.render(id, chart))
        .then(({ svg }) => {
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        })
        .catch(() => {
          // Ignore parsing errors during streaming updates to prevent user disruption
        });
    }
  }, [chart]);

  return <div ref={ref} className="overflow-x-auto" />;
}

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
  state?:
    | 'result'
    | 'partial-call'
    | 'call'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'output-denied'
    | 'approval-requested'
    | 'approval-responded';
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
  };
}

export default function ToolView({
  invocation,
  onApprove,
  onReject,
  onAutoApproveAfter,
}: {
  invocation: ToolInvocation;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string, reason: string) => void;
  onAutoApproveAfter?: (approvalId: string) => void;
}) {
  const { toolName, args, result, state, approval } = invocation;
  const isComplete =
    state === 'result' ||
    state === 'output-available' ||
    state === 'output-error' ||
    state === 'output-denied';
  const [isExpanded, setIsExpanded] = useState(!isComplete);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Auto-collapse when complete
  useEffect(() => {
    if (isComplete) {
      setIsExpanded(false);
    }
  }, [isComplete]);

  useEffect(() => {
    if (state !== 'approval-requested') {
      setShowRejectInput(false);
      setRejectReason('');
    }
  }, [state]);

  if (!args) {
    return (
        <div className="my-2 p-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-mono text-gray-500 animate-pulse">
            Loading tool {toolName}...
        </div>
    );
  }

  if (toolName === 'create_subagent') {
    return (
      <div className="my-4 p-4 bg-white border-2 border-[var(--doraemon-blue)] rounded-xl shadow-[4px_4px_0px_var(--doraemon-blue)]">
        <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between font-bold text-[var(--doraemon-blue)] mb-1 hover:brightness-110 transition-all"
        >
            <div className="flex items-center gap-2">
                <Bot size={20} />
                <span>Created Sub-Agent: {args.name}</span>
            </div>
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
        
        {isExpanded && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-gray-600 text-xs bg-blue-50 p-3 rounded-lg border-2 border-blue-100 mb-2 prose prose-xs max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{args.system_prompt}</ReactMarkdown>
                </div>
            </div>
        )}
      </div>
    );
  }

  if (toolName === 'plan_subtask_graph') {
    const rawNodes = Array.isArray(args.nodes) ? args.nodes : [];
    const nodes = rawNodes.filter((n: any) => n && typeof n.task === 'string');
    let chart = 'graph TD\n';
    
    // Nodes
    const taskToId = new Map(nodes.map((n: any, i: number) => [n.task, `node${i}`]));
    
    nodes.forEach((node: any, i: number) => {
        const safeTaskName = node.task.replace(/["\n]/g, '');
        const id = `node${i}`;
        // Style based on status
        let style = '';
        if (node.status === 'completed') style = ':::completed';
        else if (node.status === 'in_progress') style = ':::inprogress';
        else style = ':::pending';
        
        chart += `    ${id}["${safeTaskName}"]${style}\n`;
    });

    // Edges
    nodes.forEach((node: any) => {
        if (node.dependencies) {
            node.dependencies.forEach((dep: string) => {
                const fromId = taskToId.get(dep);
                const toId = taskToId.get(node.task);
                if (fromId && toId) {
                    chart += `    ${fromId} --> ${toId}\n`;
                }
            });
        }
    });

    // Styles - Updated for Doraemon Theme
    chart += '    classDef completed fill:#ffffff,stroke:#0096E6,stroke-width:3px,color:#333;\n';
    chart += '    classDef inprogress fill:#FFD700,stroke:#333,stroke-width:3px,stroke-dasharray: 5 5,color:#333;\n';
    chart += '    classDef pending fill:#f0f0f0,stroke:#999,stroke-width:2px,stroke-dasharray: 2 2,color:#999;\n';

    return (
      <div className="my-4 p-4 bg-white border-2 border-[var(--doraemon-yellow)] rounded-xl shadow-[4px_4px_0px_var(--doraemon-yellow)]">
        <div className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
            <Network size={24} className="text-[var(--doraemon-yellow)]" />
            Execution Plan
        </div>
        <div className="bg-white p-4 rounded-xl border-2 border-gray-100 overflow-hidden">
            <Mermaid chart={chart} />
        </div>
        
        {state === 'approval-requested' && approval?.id && (
          <div className="mt-4 rounded-xl border-2 border-[var(--doraemon-red)] bg-red-50 p-4">
            <div className="font-bold text-[var(--doraemon-red)] mb-3 flex items-center gap-2">
                <Clock size={20} />
                Need Human Approval
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onApprove?.(approval.id)}
                className="doraemon-btn bg-green-500 text-white border-green-700 shadow-[2px_2px_0px_#15803d]"
              >
                Approve
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="doraemon-btn bg-white text-red-500 border-red-500 shadow-[2px_2px_0px_#ef4444]"
              >
                Reject
              </button>
              <button
                onClick={() => onAutoApproveAfter?.(approval.id)}
                className="doraemon-btn bg-gray-200 text-gray-700 border-gray-400 shadow-[2px_2px_0px_#6b7280]"
              >
                Auto Approve After
              </button>
            </div>
            
            {showRejectInput && (
              <div className="mt-4 bg-white p-3 rounded-xl border-2 border-red-200">
                <div className="text-gray-700 font-bold mb-2 text-sm">Reason for rejection:</div>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-300 p-3 text-sm text-gray-800 focus:outline-none focus:border-[var(--doraemon-red)] transition-colors"
                  rows={3}
                  placeholder="Tell me why..."
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!rejectReason.trim()) return;
                      onReject?.(approval.id, rejectReason.trim());
                      setShowRejectInput(false);
                      setRejectReason('');
                    }}
                    className="doraemon-btn bg-[var(--doraemon-red)] text-white border-red-800"
                  >
                    Confirm Reject
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectInput(false);
                      setRejectReason('');
                    }}
                    className="doraemon-btn bg-gray-200 text-gray-600 border-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (toolName === 'assign_task') {
      return (
          <div className="my-4 p-4 bg-white border-2 border-[var(--doraemon-red)] rounded-xl shadow-[4px_4px_0px_var(--doraemon-red)]">
              <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full flex items-center justify-between font-bold text-[var(--doraemon-red)] mb-1 hover:brightness-110 transition-colors"
              >
                  <div className="flex items-center gap-2">
                      <Workflow size={20} />
                      <span>Assigning Task: {args.task} → {args.agent}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {isExpanded && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-gray-600 text-xs bg-red-50 p-3 rounded-lg border-2 border-red-100 prose prose-xs max-w-none">
                          <strong className="block mb-1 text-[var(--doraemon-red)]">Prompt:</strong>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{args.prompt}</ReactMarkdown>
                      </div>
                  </div>
              )}
              
              {isComplete && result && (
                   <div className="mt-3 pt-3 border-t-2 border-red-100 text-xs text-gray-700 prose prose-xs max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof result === 'object' && result.result ? result.result : JSON.stringify(result)}
                      </ReactMarkdown>
                   </div>
              )}
          </div>
      );
  }

  // Fallback generic tool view
  return (
    <div className="my-4 p-4 bg-white border-2 border-gray-900 rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] text-sm font-mono">
      <div className="font-black text-gray-900 text-xs mb-2 uppercase tracking-widest flex items-center gap-2">
        <div className="w-3 h-3 bg-[var(--doraemon-blue)] rounded-full"></div>
        TOOL: {toolName}
      </div>
      <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200 overflow-x-auto text-xs">
        {JSON.stringify(args, null, 2)}
      </div>
      {isComplete && (
        <div className="mt-3 pt-2 border-t-2 border-gray-200 text-gray-500 text-xs">
           → {JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}
