import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot } from 'lucide-react';
import { useMessages } from '../../hooks/useConversation';
import { useUIStore } from '../../store/uiStore';
import { buildMessageTree } from '../../lib/utils';
import { MessageBubble } from './MessageBubble';
import { SessionMeta } from './SessionMeta';
import { SubagentDrawer } from './SubagentDrawer';
import type { ContentBlock, Message } from '../../types';

interface Props {
  projectId: string;
  sessionId: string;
  targetMessageId?: string | null;
}

function buildToolResultsMap(messages: Message[]): Map<string, ContentBlock> {
  const map = new Map<string, ContentBlock>();
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        map.set(block.tool_use_id, block);
      }
    }
  }
  return map;
}

export function MessageThread({ projectId, sessionId, targetMessageId }: Props) {
  const { data, isLoading, error } = useMessages(projectId, sessionId);
  const { setOpenSubagent } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const messages = data ? buildMessageTree(data.messages) : [];
  const toolResults = buildToolResultsMap(messages);

  // Filter to only renderable messages
  const renderableMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant'
  );

  const virtualizer = useVirtualizer({
    count: renderableMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 10,
  });

  // On load: jump to the deep-linked message if present, otherwise scroll to bottom.
  useEffect(() => {
    if (renderableMessages.length === 0 || !scrollRef.current) return;

    if (targetMessageId) {
      const index = renderableMessages.findIndex((m) => m.uuid === targetMessageId);
      if (index !== -1) {
        const t = setTimeout(() => {
          virtualizer.scrollToIndex(index, { align: 'center' });
          setHighlightId(targetMessageId);
        }, 100);
        const clear = setTimeout(() => setHighlightId(null), 2400);
        return () => {
          clearTimeout(t);
          clearTimeout(clear);
        };
      }
    }

    const t = setTimeout(() => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderableMessages.length, targetMessageId]);

  const session = data?.session;
  const firstMsg = renderableMessages[0];

  return (
    <div className="flex flex-col h-full">
      <SessionMeta
        cwd={session?.cwd ?? firstMsg?.cwd}
        gitBranch={session?.gitBranch ?? firstMsg?.gitBranch}
        version={session?.version ?? firstMsg?.version}
        sessionStart={firstMsg?.timestamp}
        slug={session?.slug ?? firstMsg?.slug}
      />

      {/* Subagent bar */}
      {data?.subagentIds && data.subagentIds.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2 flex-wrap"
          style={{ background: 'rgba(168,85,247,0.05)', borderBottom: '1px solid rgba(168,85,247,0.15)' }}
        >
          <Bot size={12} style={{ color: '#a855f7' }} />
          <span className="text-xs" style={{ color: '#a855f7' }}>
            {data.subagentIds.length} subagent{data.subagentIds.length !== 1 ? 's' : ''}
          </span>
          {data.subagentIds.map((id) => (
            <button
              key={id}
              onClick={() => setOpenSubagent(id, sessionId, projectId)}
              className="chip hover:opacity-80 transition-opacity cursor-pointer"
              style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}
            >
              {id.slice(0, 8)}…
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="skeleton rounded-2xl" style={{ height: 60 + (i % 3) * 30, width: `${50 + (i % 3) * 15}%` }} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load messages</p>
          </div>
        )}

        {!isLoading && !error && (
          <div
            className="px-4 py-6"
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const msg = renderableMessages[vi.index];
              return (
                <div
                  key={msg.uuid}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                    padding: '0 0',
                    transition: 'box-shadow 0.3s ease, background 0.3s ease',
                    boxShadow: highlightId === msg.uuid ? '0 0 0 2px var(--accent, #a855f7)' : 'none',
                    borderRadius: highlightId === msg.uuid ? 4 : 0,
                  }}
                >
                  <MessageBubble
                    message={msg}
                    toolResults={toolResults}
                    onOpenSubagent={(agentId) => setOpenSubagent(agentId, sessionId, projectId)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !error && renderableMessages.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No messages in this session</p>
          </div>
        )}
      </div>

      <SubagentDrawer />
    </div>
  );
}
