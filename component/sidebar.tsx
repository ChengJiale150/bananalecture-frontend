import { MessageSquare, Plus, Trash2, Edit2, Check, X, Settings, GraduationCap, User, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(true);

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
    <div className={`${isExpanded ? 'w-72' : 'w-20'} bg-[var(--doraemon-blue)] text-white flex flex-col h-screen border-r-4 border-gray-800 shadow-[4px_0px_0px_rgba(0,0,0,0.2)] z-10 relative transition-all duration-300`}>
      {/* Logo Section */}
      <div className={`${isExpanded ? 'p-6' : 'p-4'} border-b-4 border-gray-800 bg-white text-gray-900 flex flex-row items-center justify-center gap-4`}>
        <div className="w-12 h-12 bg-[var(--doraemon-yellow)] rounded-full border-4 border-gray-900 flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <GraduationCap size={isExpanded ? 28 : 20} className="text-gray-900" />
        </div>
        {isExpanded && (
          <h1 className="text-xl font-black tracking-tight" style={{ textShadow: '2px 2px 0px #ddd' }}>
            Banana Lecture
          </h1>
        )}
      </div>

      <div className={`${isExpanded ? 'p-4' : 'p-2'} border-b-4 border-gray-800 bg-[var(--doraemon-blue)]`}>
        <button
          onClick={onNew}
          className={`w-full flex items-center justify-center gap-2 doraemon-btn doraemon-btn-danger ${isExpanded ? '' : 'aspect-square'}`}
          title={isExpanded ? '' : 'New Project'}
        >
          <Plus size={20} strokeWidth={3} />
          {isExpanded && <span>New Project</span>}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#e6f7ff]">
        {chats.length === 0 && isExpanded && (
            <div className="text-gray-500 font-bold text-sm text-center mt-8">No projects yet!</div>
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
            title={isExpanded ? chat.title : ''}
          >
            <div className={`flex items-center gap-3 overflow-hidden flex-1 text-gray-800 ${!isExpanded ? 'justify-center' : ''}`}>
              <MessageSquare size={18} className={`shrink-0 ${currentChatId === chat.id ? 'text-[var(--doraemon-blue)]' : 'text-gray-400'}`} />
              
              {isExpanded && (editingId === chat.id ? (
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
                    {chat.title || 'Untitled'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(chat.createdAt).toLocaleDateString()}
                    </span>
                </div>
              ))}
            </div>
            
            {isExpanded && !editingId && (
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
      {isExpanded && (
        <div className="p-4 border-t-4 border-gray-800 bg-white text-gray-900">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Configuration</div>
          <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 border-2 border-transparent hover:border-gray-200 transition-colors">
                  <span className="flex items-center gap-2 font-bold text-sm">
                      <Settings size={16} />
                      Settings
                  </span>
              </button>
          </div>
        </div>
      )}
      
      {/* User Section */}
      <div className={`${isExpanded ? 'p-4' : 'p-2'} border-t-4 border-gray-800 bg-gray-50 text-gray-900`}>
        <button className={`w-full flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} p-3 rounded-xl hover:bg-white border-2 border-transparent hover:border-gray-300 transition-all shadow-sm`}>
            <span className={`flex items-center ${isExpanded ? 'gap-3' : ''} font-bold text-sm`}>
                <div className="w-8 h-8 bg-[var(--doraemon-blue)] rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                </div>
                {isExpanded && <span>User</span>}
            </span>
        </button>
      </div>
      
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border-2 border-gray-800 rounded-r-lg shadow-lg hover:bg-gray-50 transition-colors flex items-center justify-center z-20"
      >
        {isExpanded ? <ChevronLeft size={14} className="text-gray-700" /> : <ChevronRight size={14} className="text-gray-700" />}
      </button>
    </div>
  );
}
