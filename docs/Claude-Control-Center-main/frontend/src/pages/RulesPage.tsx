import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { ShieldCheck, Plus, Trash2, ShieldOff } from 'lucide-react';
import { fetchRules, addRule, deleteRule } from '../api/rules';

function RuleList({
  title,
  icon: Icon,
  color,
  items,
  listType,
  onAdd,
  onDelete,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  items: string[];
  listType: 'allow' | 'deny';
  onAdd: (pattern: string) => void;
  onDelete: (index: number) => void;
}) {
  const [input, setInput] = useState('');

  function submit() {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <span
          className="chip ml-auto"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}
        >
          {items.length}
        </span>
      </div>

      <div className="space-y-2 min-h-[60px]">
        {items.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No rules</p>
        ) : (
          items.map((pattern, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            >
              <code className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {pattern}
              </code>
              <button
                className="p-1 rounded flex-shrink-0 transition-colors"
                onClick={() => onDelete(idx)}
                style={{ color: 'var(--text-tertiary)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 mt-1">
        <input
          className="input flex-1 text-xs font-mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={`e.g. ${listType === 'allow' ? 'Bash(git *)' : 'Bash(rm -rf *)'}`}
        />
        <button
          className="btn-primary flex items-center gap-1.5 text-xs px-3"
          onClick={submit}
          disabled={!input.trim()}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

export function RulesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.rules(), queryFn: fetchRules });

  const addMut = useMutation({
    mutationFn: ({ listType, pattern }: { listType: 'allow' | 'deny'; pattern: string }) =>
      addRule(listType, pattern),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules() }),
  });

  const deleteMut = useMutation({
    mutationFn: ({ listType, index }: { listType: 'allow' | 'deny'; index: number }) =>
      deleteRule(listType, index),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules() }),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="skeleton h-6 w-32 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5"><div className="skeleton h-32 w-full" /></div>
          <div className="card p-5"><div className="skeleton h-32 w-full" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Rules</h1>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Global permission rules from ~/.claude/settings.json
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RuleList
          title="Allow"
          icon={ShieldCheck}
          color="#4ade80"
          items={data?.allow ?? []}
          listType="allow"
          onAdd={(p) => addMut.mutate({ listType: 'allow', pattern: p })}
          onDelete={(i) => deleteMut.mutate({ listType: 'allow', index: i })}
        />
        <RuleList
          title="Deny"
          icon={ShieldOff}
          color="#f87171"
          items={data?.deny ?? []}
          listType="deny"
          onAdd={(p) => addMut.mutate({ listType: 'deny', pattern: p })}
          onDelete={(i) => deleteMut.mutate({ listType: 'deny', index: i })}
        />
      </div>
    </div>
  );
}
