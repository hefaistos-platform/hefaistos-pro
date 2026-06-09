import React, { useState, useEffect, useRef } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Button } from '../ui/Button';

const ADD_COMMENT_MUTATION = gql`
  mutation AddComment($graphId: UUID!, $message: String!) {
    addPlaybookComment(graphId: $graphId, message: $message) {
      comment {
        id
        message
        createdAt
        user { username }
      }
    }
  }
`;

interface ChatProps {
  playbookId: string;
  comments: any[];
  currentUser: string; // To align our own messages to the right
  refetch: () => void;
}

export const PlaybookChat: React.FC<ChatProps> = ({ playbookId, comments, currentUser, refetch }) => {
  const [message, setMessage] = useState('');
  const [addComment, { loading }] = useMutation(ADD_COMMENT_MUTATION);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await addComment({
        variables: { graphId: playbookId, message }
    });
    setMessage('');
    refetch(); // Refresh list
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      {/* 1. Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {comments.length === 0 && (
             <p className="text-center text-xs text-gray-400 mt-10">No messages yet. Start the discussion!</p>
         )}
         
         {comments.map((c) => {
             const isMe = c.user?.username === currentUser;
             return (
                 <div key={c.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3 rounded-lg text-sm shadow-sm ${
                         isMe 
                           ? 'bg-blue-600 text-white rounded-br-none' 
                           : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                     }`}>
                         {!isMe && (
                             <div className="text-[10px] font-bold text-gray-500 mb-1">
                                 {c.user?.username}
                             </div>
                         )}
                         <div className="whitespace-pre-wrap">{c.message}</div>
                         <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                             {new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                     </div>
                 </div>
             );
         })}
         <div ref={bottomRef} />
      </div>

      {/* 2. Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
         <div className="relative">
             <textarea 
                className="w-full p-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                rows={2}
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
             />
             <div className="absolute bottom-2 right-2">
                 <Button variant="primary" className="text-xs py-1 px-2" onClick={handleSend} disabled={loading || !message.trim()}>
                    Send
                 </Button>
             </div>
         </div>
         <p className="text-[10px] text-gray-400 mt-1 text-center">
            Visible to Analysts & Reviewers
         </p>
      </div>

    </div>
  );
};