import { MessageSquare } from 'lucide-react';
import { ProjectList } from '../components/conversation/ProjectList';

export function ConversationsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Conversations
        </h1>
      </div>
      <ProjectList />
    </div>
  );
}
