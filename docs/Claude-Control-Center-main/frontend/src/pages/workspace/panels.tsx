import { Mail, Calendar, CheckSquare, HardDrive, AlertCircle } from 'lucide-react';
import { relativeTime } from '../../lib/utils';
import type { GwsSnapshotSection } from '../../api/gws';

/** Normalise an API value into an array of records, tolerating object-wrapped lists. */
export function asArray(val: unknown): Record<string, unknown>[] {
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const first = Object.values(obj).find(Array.isArray);
    if (first) return first as Record<string, unknown>[];
  }
  return [];
}

export function SectionPanel({ title, icon: Icon, children, error, authError }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  error?: string;
  authError?: boolean;
}) {
  return (
    <div className="card flex flex-col" style={{ minHeight: 220 }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <Icon size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {authError ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: '#f87171' }}>
            <AlertCircle size={14} />
            <span>Auth error — re-run <code>gws gmail +triage</code> to refresh credentials</span>
          </div>
        ) : error ? (
          <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>{error}</div>
        ) : children}
      </div>
    </div>
  );
}

export function InboxPanel({ data }: { data?: GwsSnapshotSection }) {
  const items = asArray(data?.items);
  return (
    <SectionPanel title="Inbox" icon={Mail} error={data?.error} authError={data?.auth_error}>
      {items.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No unread messages</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((msg, i) => (
            <div key={i} className="py-1.5 px-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {String(msg.from ?? msg.sender ?? msg.subject ?? msg.id ?? '—')}
              </div>
              {Boolean(msg.subject) && Boolean(msg.from) && (
                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {String(msg.subject)}
                </div>
              )}
            </div>
          ))}
          {items.length > 8 && (
            <div className="text-xs text-center py-1" style={{ color: 'var(--text-tertiary)' }}>+{items.length - 8} more</div>
          )}
        </div>
      )}
    </SectionPanel>
  );
}

export function AgendaPanel({ data }: { data?: GwsSnapshotSection }) {
  const items = asArray(data?.items);
  return (
    <SectionPanel title="Today's Calendar" icon={Calendar} error={data?.error} authError={data?.auth_error}>
      {items.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No events today</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 6).map((ev, i) => {
            const start = ev.start as Record<string, string> | undefined;
            const time = start?.dateTime ? new Date(start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (start?.date ?? '');
            return (
              <div key={i} className="py-1.5 px-2 rounded flex gap-2" style={{ background: 'var(--bg-secondary)' }}>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--accent)', minWidth: 44 }}>{time}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{String(ev.summary ?? ev.title ?? '—')}</span>
              </div>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}

export function TasksPanel({ data }: { data?: GwsSnapshotSection }) {
  const items = asArray(data?.items);
  return (
    <SectionPanel title="Tasks" icon={CheckSquare} error={data?.error} authError={data?.auth_error}>
      {items.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No open tasks</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((task, i) => (
            <div key={i} className="py-1.5 px-2 rounded flex items-start gap-2" style={{ background: 'var(--bg-secondary)' }}>
              <CheckSquare size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{String(task.title ?? '—')}</div>
                {Boolean(task.due) && (
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Due {new Date(String(task.due)).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
          {items.length > 8 && (
            <div className="text-xs text-center py-1" style={{ color: 'var(--text-tertiary)' }}>+{items.length - 8} more</div>
          )}
        </div>
      )}
    </SectionPanel>
  );
}

export function DrivePanel({ data }: { data?: GwsSnapshotSection }) {
  const items = asArray(data?.items);
  return (
    <SectionPanel title="Recent Drive Files" icon={HardDrive} error={data?.error} authError={data?.auth_error}>
      {items.length === 0 ? (
        <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No recent files</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((file, i) => {
            const mime = String(file.mimeType ?? '');
            const typeLabel = mime.includes('spreadsheet') ? 'Sheet' : mime.includes('document') ? 'Doc' : mime.includes('presentation') ? 'Slides' : mime.includes('folder') ? 'Folder' : 'File';
            return (
              <div key={i} className="py-1.5 px-2 rounded flex items-center gap-2" style={{ background: 'var(--bg-secondary)' }}>
                <span
                  className="text-xs px-1 rounded flex-shrink-0"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontSize: 10 }}
                >
                  {typeLabel}
                </span>
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }}>{String(file.name ?? '—')}</span>
                {Boolean(file.modifiedTime) && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {relativeTime(String(file.modifiedTime))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}
