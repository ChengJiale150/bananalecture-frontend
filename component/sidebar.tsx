import { MessageSquare, Plus, Trash2, Edit2, Check, X, Settings, GraduationCap } from 'lucide-react';
import { useState } from 'react';

interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
}

interface SidebarProps {
  chats: ChatSummary[];
  currentChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export default function Sidebar({ chats, currentChatId, onSelect, onNew, onDelete, onRename }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = (chat: ChatSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const saveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="w-72 bg-[var(--doraemon-blue)] text-white flex flex-col h-screen border-r-4 border-gray-800 shadow-[4px_0px_0px_rgba(0,0,0,0.2)] z-10 relative">
      {/* Logo Section */}
      <div className="p-6 border-b-4 border-gray-800 bg-white text-gray-900 flex flex-col items-center justify-center gap-2">
        <div className="w-16 h-16 bg-[var(--doraemon-yellow)] rounded-full border-4 border-gray-900 flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <GraduationCap size={32} className="text-gray-900" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-center" style={{ textShadow: '2px 2px 0px #ddd' }}>
          Banana<br/>Lecture
        </h1>
      </div>

      <div className="p-4 border-b-4 border-gray-800 bg-[var(--doraemon-blue)]">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 doraemon-btn doraemon-btn-danger"
        >
          <Plus size={20} strokeWidth={3} />
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#e6f7ff]">
        {chats.length === 0 && (
            <div className="text-gray-500 font-bold text-sm text-center mt-8">No chats yet! Start a new adventure!</div>
        )}
        {[...chats].sort((a, b) => b.createdAt - a.createdAt).map(chat => (
          <div
            key={chat.id}
            className={`
              group flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all
              ${currentChatId === chat.id 
                ? 'bg-white border-gray-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' 
                : 'bg-white/80 border-transparent hover:border-gray-900 hover:shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'}
            `}
            onClick={() => onSelect(chat.id)}
          >
            <div className="flex items-center gap-3 overflow-hidden flex-1 text-gray-800">
              <MessageSquare size={16} className={`shrink-0 ${currentChatId === chat.id ? 'text-[var(--doraemon-blue)]' : 'text-gray-400'}`} />
              
              {editingId === chat.id ? (
                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                    <input 
                        className="bg-white text-gray-900 text-xs p-1 rounded w-full outline-none border-2 border-[var(--doraemon-blue)]"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') setEditingId(null);
                        }}
                    />
                    <button onClick={saveEdit} className="text-green-600 hover:text-green-500 bg-green-100 p-1 rounded border border-green-600"><Check size={14} /></button>
                    <button onClick={cancelEdit} className="text-red-600 hover:text-red-500 bg-red-100 p-1 rounded border border-red-600"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex flex-col overflow-hidden flex-1">
                    <span className={`text-sm truncate font-bold ${currentChatId === chat.id ? 'text-gray-900' : 'text-gray-600'}`} title={chat.title}>
                    {chat.title || 'Untitled Chat'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(chat.createdAt).toLocaleDateString()}
                    </span>
                </div>
              )}
            </div>
            
            {!editingId && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => startEditing(chat, e)}
                        className="p-1 hover:bg-blue-100 text-gray-500 rounded"
                        title="Rename chat"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(chat.id);
                        }}
                        className="p-1 hover:bg-red-100 text-gray-500 rounded"
                        title="Delete chat"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Configuration Section */}
      <div className="p-4 border-t-4 border-gray-800 bg-white text-gray-900">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Configuration</div>
        <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 border-2 border-transparent hover:border-gray-200 transition-colors">
                <span className="flex items-center gap-2 font-bold text-sm">
                    <Settings size={16} />
                    Settings
                </span>
            </button>
            <div className="flex items-center justify-between p-2">
                <span className="text-sm font-bold">Model</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300">GPT-4o</span>
            </div>
        </div>
      </div>
    </div>
  );
}
