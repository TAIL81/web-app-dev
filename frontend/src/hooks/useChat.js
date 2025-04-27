import { useState, useEffect, useRef } from 'react';

const useChat = () => {
  const initialMessages = [
    { role: 'system', content: 'Responding in fluent Japanese.', hidden: true },
  ];

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [isExpanding, setIsExpanding] = useState(false); // プロンプト拡張中かどうかの状態

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isExpanding) return;

    const userInput = input.trim();
    const lowerCaseInput = userInput.toLowerCase();

    const newUserMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    if (lowerCaseInput === 'quit' || lowerCaseInput === 'exit') {
      setMessages(prev => [...prev, { role: 'assistant', content: 'チャットを終了します。' }]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesForApi = messages
        .filter(msg => !msg.hidden)
        .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch('http://localhost:8002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messagesForApi, { role: 'user', content: userInput }] }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
        }
        throw new Error(`API エラー (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.content, reasoning: data.reasoning },
      ]);
    } catch (err) {
      console.error("API呼び出しエラー:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    if (window.confirm("チャット履歴をクリアしますか？")) {
      setMessages(initialMessages);
      setError(null);
      setIsLoading(false);
      setIsExpanding(false);
      setInput('');
    }
  };

  // isExpanding と handleExpandPrompt は App.jsx に残すか、別のフックに分けるか検討
  // 今回はチャットの主要ロジックとして useChat に含めず、App.jsx に残します。
  // 必要に応じて後で別のフックに分割します。

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    messagesEndRef,
    handleSend,
    handleKeyPress,
    handleClearChat,
    setError, // setError を追加
    isExpanding, // isExpanding は App.jsx で管理するため含めない
    setIsExpanding // setIsExpanding も App.jsx で管理するため含めない
  };
};

export default useChat;
