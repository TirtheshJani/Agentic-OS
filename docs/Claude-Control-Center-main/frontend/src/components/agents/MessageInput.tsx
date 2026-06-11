import { useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="flex-1 px-3 py-2 rounded-md text-sm"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
        placeholder="Send a message..."
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className={cn(
          'p-2 rounded-md transition-all',
          (!text.trim() || disabled) && 'opacity-40 pointer-events-none'
        )}
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        <Send size={14} />
      </button>
    </form>
  );
}
