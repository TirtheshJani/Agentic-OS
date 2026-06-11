import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { shortTime } from '../../lib/utils';
import { ToolCallBlock } from './ToolCallBlock';
import { cn } from '../../lib/utils';
import type { Message, ContentBlock } from '../../types';

interface Props {
  message: Message;
  toolResults?: Map<string, ContentBlock>;
  onOpenSubagent?: (agentId: string) => void;
}

function getTextContent(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');
}

export function MessageBubble({ message, toolResults, onOpenSubagent }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // isMeta messages rendered as system notes
  if (message.isMeta) {
    const text = getTextContent(message.content);
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs italic px-4" style={{ color: 'var(--text-tertiary)' }}>
          {text || '(system)'}
        </span>
      </div>
    );
  }

  // Filter out result blocks from display (they're rendered inside ToolCallBlock)
  const displayBlocks = message.content.filter(
    (b) => b.type !== 'tool_result' && b.type !== 'advisor_tool_result'
  );

  const textContent = getTextContent(message.content);
  const toolUseBlocks = message.content.filter((b) => b.type === 'tool_use' || b.type === 'server_tool_use');

  if (isUser) {
    // User message: show only text content (tool results handled elsewhere)
    const userToolResults = message.content.filter((b) => b.type === 'tool_result');
    if (!textContent && userToolResults.length === 0) return null;

    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[75%]">
          {textContent && (
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {textContent}
            </div>
          )}
          <div className="text-right mt-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {shortTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="flex justify-start mb-4 animate-fade-in">
        <div className="max-w-[85%] w-full">
          <div
            className="px-4 py-3 rounded-2xl rounded-tl-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Text content */}
            {textContent && (
              <div className="prose-dark text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {textContent}
                </ReactMarkdown>
              </div>
            )}

            {/* Tool use blocks (including advisor server_tool_use) */}
            {toolUseBlocks.map((block) => {
              // For advisor blocks, find the matching advisor_tool_result
              const matchedResult = block.id
                ? (toolResults?.get(block.id) ?? message.content.find(
                    (b) => b.type === 'advisor_tool_result' && b.tool_use_id === block.id
                  ))
                : undefined;
              return (
                <ToolCallBlock
                  key={block.id}
                  toolBlock={block}
                  resultBlock={matchedResult}
                  onOpenSubagent={onOpenSubagent}
                />
              );
            })}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 pl-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {shortTime(message.timestamp)}
            </span>
            {message.model && (
              <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                {message.model.split('-').slice(0, 3).join('-')}
              </span>
            )}
            {message.usage && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                ↑{message.usage.input_tokens ?? 0} ↓{message.usage.output_tokens ?? 0}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
