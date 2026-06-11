import { X, Bot } from 'lucide-react';
import { useSubagent } from '../../hooks/useConversation';
import { useUIStore } from '../../store/uiStore';
import { buildMessageTree } from '../../lib/utils';
import { MessageBubble } from './MessageBubble';
import type { ContentBlock } from '../../types';

export function SubagentDrawer() {
  const { openSubagentId, openSubagentSessionId, openSubagentProjectId, setOpenSubagent } = useUIStore();
  const { data, isLoading } = useSubagent(
    openSubagentProjectId ?? undefined,
    openSubagentSessionId ?? undefined,
    openSubagentId
  );

  if (!openSubagentId) return null;

  // Build tool results map
  const toolResults = new Map<string, ContentBlock>();
  if (data?.messages) {
    for (const msg of data.messages) {
      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          toolResults.set(block.tool_use_id, block);
        }
      }
    }
  }

  const messages = data ? buildMessageTree(data.messages) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={() => setOpenSubagent(null)}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col animate-slide-in-right"
        style={{
          width: 480,
          background: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Bot size={15} style={{ color: '#a855f7' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {data?.meta?.agentType ?? 'Subagent'}
            </div>
            {data?.meta?.description && (
              <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {data.meta.description}
              </div>
            )}
          </div>
          <button
            onClick={() => setOpenSubagent(null)}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
          >
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className="skeleton h-12 w-2/3 rounded-xl" />
                </div>
              ))}
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.uuid} message={msg} toolResults={toolResults} />
          ))}
        </div>
      </div>
    </>
  );
}
