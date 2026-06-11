import { useState, useRef } from 'react';
import { Target, ChevronDown, ChevronRight, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useSessionGoals,
  useCreateMilestone,
  useToggleMilestone,
  useDeleteMilestone,
} from '../../hooks/useGoals';
import type { Goal, GoalStatus } from '../../types';

const STATUS_COLORS: Record<GoalStatus, string> = {
  active:    'var(--green-500)',
  paused:    'var(--orange-500)',
  completed: 'var(--steel-500)',
  cleared:   'var(--ds-neutral-500)',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  active:    'Active',
  paused:    'Paused',
  completed: 'Completed',
  cleared:   'Cleared',
};

interface MilestoneRowProps {
  projectId: string;
  sessionId: string;
  goalId: string;
  milestone: { id: string; text: string; completed: boolean };
}

function MilestoneRow({ projectId, sessionId, goalId, milestone }: MilestoneRowProps) {
  const toggle = useToggleMilestone(projectId, sessionId, goalId);
  const remove = useDeleteMilestone(projectId, sessionId, goalId);

  return (
    <div
      className="flex items-center gap-2 group"
      style={{ padding: '3px 0' }}
    >
      <button
        onClick={() => toggle.mutate(milestone.id)}
        style={{ color: milestone.completed ? 'var(--green-500)' : 'var(--text-tertiary)', flexShrink: 0 }}
        title={milestone.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {milestone.completed ? <CheckSquare size={14} /> : <Square size={14} />}
      </button>
      <span
        style={{
          flex: 1,
          fontSize: '12px',
          color: milestone.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
          textDecoration: milestone.completed ? 'line-through' : 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {milestone.text}
      </span>
      <button
        onClick={() => remove.mutate(milestone.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
        title="Remove milestone"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  projectId: string;
  sessionId: string;
}

function GoalCard({ goal, projectId, sessionId }: GoalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createMilestone = useCreateMilestone(projectId, sessionId, goal.id);

  const statusColor = STATUS_COLORS[goal.status];
  const total = goal.milestones.length;
  const done = goal.milestones.filter((m) => m.completed).length;

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const text = inputText.trim();
      if (text) {
        createMilestone.mutate(text, {
          onSuccess: () => {
            setInputText('');
            setAdding(false);
          },
        });
      }
    } else if (e.key === 'Escape') {
      setAdding(false);
      setInputText('');
    }
  }

  function openAdding() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div
      className="card"
      style={{ padding: '10px 12px', marginBottom: 8 }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="chip"
              style={{
                background: `color-mix(in oklch, ${statusColor} 15%, transparent)`,
                color: statusColor,
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: 2,
              }}
            >
              {STATUS_LABELS[goal.status]}
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
              }}
            >
              {goal.text}
            </span>
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: 'var(--border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${goal.progress}%`,
                      background: statusColor,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'var(--font-mono-ds)' }}>
                  {done}/{total}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {expanded && (
        <div style={{ paddingLeft: 20, marginTop: 6 }}>
          {goal.milestones.length === 0 && !adding && (
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 6px' }}>
              No milestones yet.
            </p>
          )}
          {goal.milestones.map((m) => (
            <MilestoneRow
              key={m.id}
              projectId={projectId}
              sessionId={sessionId}
              goalId={goal.id}
              milestone={m}
            />
          ))}

          {adding && (
            <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
              <Square size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                className="input-field"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="Milestone… (Enter to save, Esc to cancel)"
                style={{ flex: 1, fontSize: '12px', padding: '2px 6px', height: 26 }}
              />
            </div>
          )}

          {!adding && (
            <button
              onClick={openAdding}
              className="flex items-center gap-1.5 mt-1"
              style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
            >
              <Plus size={11} />
              Add milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SessionGoalPanelProps {
  projectId: string;
  sessionId: string;
}

export function SessionGoalPanel({ projectId, sessionId }: SessionGoalPanelProps) {
  const { data, isLoading } = useSessionGoals(projectId, sessionId);
  const goals = data?.goals ?? [];

  if (isLoading) return null;
  if (goals.length === 0) return null;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
        padding: '10px 16px',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ marginBottom: 8 }}
      >
        <Target size={13} style={{ color: 'var(--orange-500)' }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          Session Goals
        </span>
        <span
          className="chip"
          style={{ fontSize: '10px', padding: '1px 5px', borderRadius: 2 }}
        >
          {goals.length}
        </span>
      </div>
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          projectId={projectId}
          sessionId={sessionId}
        />
      ))}
    </div>
  );
}
