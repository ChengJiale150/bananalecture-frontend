import { tool } from 'ai';
import { z } from 'zod';
import { mutateChat } from '@/lib/chat-store';

const SPECIAL_AGENT_NAME = '__self__';

export const GraphNodeSchema = z.object({
  task: z.string().describe('Unique description of the task. Acts as the identifier for the node.'),
  dependencies: z.array(z.string()).describe('List of predecessor tasks that must be completed before this task starts'),
  status: z.enum(['in_progress', 'pending', 'completed']).describe('Status of the task'),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export function createPlannerTools(chatId: string) {
  const createSubAgentTool = tool({
    description: 'Create a custom sub-agent with specific system prompt and name for reuse.',
    inputSchema: z.object({
      name: z.string().describe('Unique name for this agent configuration'),
      system_prompt: z.string().describe("System prompt defining the agent's role"),
    }),
    async execute({ name, system_prompt }) {
      if (name === SPECIAL_AGENT_NAME) {
        return `Agent name '${SPECIAL_AGENT_NAME}' is reserved for self-delegation.`;
      }

      const action = await mutateChat(chatId, chat => {
        const subAgents = chat.subAgents ?? [];
        const existingIndex = subAgents.findIndex(a => a.name === name);

        if (existingIndex >= 0) {
          const incoming = typeof system_prompt === 'string' ? system_prompt.trim() : '';
          const current =
            typeof subAgents[existingIndex]?.system_prompt === 'string' ? subAgents[existingIndex].system_prompt.trim() : '';

          if (incoming && incoming !== current) {
            subAgents[existingIndex] = { name, system_prompt };
            return { result: 'updated' as const, chat: { ...chat, subAgents } };
          }
          return { result: 'reused' as const };
        }

        subAgents.push({ name, system_prompt });
        return { result: 'created' as const, chat: { ...chat, subAgents } };
      });

      if (action === 'created') return `Sub-agent '${name}' created successfully.`;
      if (action === 'updated') return `Sub-agent '${name}' updated successfully.`;
      return `Sub-agent '${name}' reused.`;
    },
  });

  const planSubtaskGraphTool = tool({
    description: 'Plan or update the subtask dependency graph. The graph defines the topology of tasks.',
    inputSchema: z.object({
      nodes: z.array(GraphNodeSchema),
    }),
    needsApproval: (_input, { experimental_context }) =>
      !Boolean((experimental_context as { autoApprove?: boolean } | undefined)?.autoApprove),
    async execute({ nodes }) {
      if (!nodes || nodes.length === 0) {
        return mutateChat(chatId, chat => ({
          result: 'Subtask Graph Cleared.',
          chat: { ...chat, graph: [] },
        }));
      }

      return mutateChat(chatId, chat => {
        // 1. Verify correctness
        const nodeTasks = new Set<string>();
        for (const node of nodes) {
            if (nodeTasks.has(node.task)) {
                return { result: `Error: Duplicate task '${node.task}' found.` };
            }
            nodeTasks.add(node.task);
        }

        // Check dependencies
        const nodeMap = new Map(nodes.map(n => [n.task, n]));
        for (const node of nodes) {
            for (const depTask of node.dependencies) {
                if (!nodeMap.has(depTask)) {
                    return { result: `Error: Task '${node.task}' depends on non-existent task '${depTask}'.` };
                }
                if (depTask === node.task) {
                    return { result: `Error: Task '${node.task}' cannot depend on itself.` };
                }
            }
        }

        // Check for status consistency
        for (const node of nodes) {
            if (node.status === 'in_progress') {
                for (const depTask of node.dependencies) {
                    const depNode = nodeMap.get(depTask);
                    if (depNode?.status !== 'completed') {
                         return { result: `Error: Cannot start task '${node.task}' because dependency '${depTask}' is not completed.` };
                    }
                }
            }
        }

        return { result: 'Subtask Graph Updated!', chat: { ...chat, graph: nodes } };
      });
    },
  });

  const assignTaskTool = tool({
    description: 'Launch a new agent to execute a specific task from the plan.',
    inputSchema: z.object({
      agent: z.string().describe('Specify which created agent to use'),
      task: z.string().describe('The task name from the plan to execute'),
      prompt: z.string().describe('The detailed instructions for the agent to perform the task'),
    }),
    async execute({ agent, task, prompt }) {
      return mutateChat(chatId, chat => {
          const graph = chat.graph || [];
          const taskNode = graph.find(n => n.task === task);
          if (!taskNode) {
              return { result: `Error: Task '${task}' not found in the planned graph. Please plan the task first.` };
          }

          const subAgents = chat.subAgents || [];
          const agentConfig = subAgents.find(a => a.name === agent);
          if (!agentConfig && agent !== SPECIAL_AGENT_NAME) {
               const available = subAgents.map(a => a.name);
               return { result: `Error: Agent '${agent}' not found. Available agents: ${available}` };
          }

          // Fixed mock result as requested
          return { result: `[Mock Result] Task **${task}** executed by agent *${agent}* successfully.` };
      });
    }
  });

  return {
    create_subagent: createSubAgentTool,
    plan_subtask_graph: planSubtaskGraphTool,
    assign_task: assignTaskTool,
  };
}
