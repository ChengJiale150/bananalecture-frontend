import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

export default function ChatInput({
  status,
  onSubmit,
  stop,
  isCentered = false,
}: {
  status: string;
  onSubmit: (text: string) => void;
  stop?: () => void;
  isCentered?: boolean;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const minRows = isCentered ? 8 : 2;
  const maxHeight = isCentered ? 400 : 200;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [text, maxHeight]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim() === '') return;
    onSubmit(text);
    setText('');
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isCentered) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const containerClassName = isCentered
    ? 'w-full'
    : 'w-full pt-4 pb-6 px-4 bg-[#F0F8FF]';

  return (
    <div className={containerClassName}>
      <div className="max-w-3xl mx-auto relative flex items-end gap-3 p-3 border-2 border-gray-900 rounded-2xl bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] focus-within:translate-x-[-1px] focus-within:translate-y-[-1px] focus-within:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all">
        <textarea
          ref={textareaRef}
          style={{ maxHeight: `${maxHeight}px` }}
          className="flex-1 bg-transparent outline-none resize-none py-2 px-2 text-sm md:text-base font-medium text-gray-800 placeholder-gray-400 overflow-y-auto"
          placeholder="Ask Doraemon something..."
          disabled={status !== 'ready' && status !== 'submitted'} 
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={minRows}
        />
        
        {status === 'streaming' || status === 'submitted' ? (
          <button
            onClick={stop}
            className="p-3 rounded-xl bg-[var(--doraemon-red)] text-white border-2 border-gray-900 hover:brightness-110 active:scale-95 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            title="Stop generating"
          >
            <Square size={20} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => handleSubmit()}
            disabled={!text.trim() || status !== 'ready'}
            className="p-3 rounded-xl bg-[var(--doraemon-blue)] text-white border-2 border-gray-900 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            title="Send message"
          >
            <Send size={20} strokeWidth={3} />
          </button>
        )}
      </div>
      {!isCentered && (
        <div className="text-center text-xs font-bold text-gray-400 mt-3 uppercase tracking-wider">
          Doraemon Agent can make mistakes. Check important info!
        </div>
      )}
    </div>
  );
}
