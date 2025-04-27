import { useState, useEffect, useRef } from 'react';

const useChat = () => {
  // メッセージの初期状態を変数として定義 (クリア時に再利用するため)
  const initialMessages = [
    { role: 'system', content: 'Responding in fluent Japanese.', hidden: true },
  ];

  const [messages, setMessages] = useState(initialMessages); // 初期値を initialMessages に変更
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
    if (!input.trim() || isLoading || isExpanding) return; // 拡張中も送信不可に

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

  // --- チャットクリア処理 ---
  const handleClearChat = () => {
    if (window.confirm("チャット履歴をクリアしますか？")) {
      setMessages(initialMessages);
      setError(null);
      setIsLoading(false);
      setIsExpanding(false); // 拡張中状態もリセット
      setInput('');
    }
  };
  // --- /チャットクリア処理 ---

  // --- ▼▼▼ プロンプト拡張ボタンのハンドラー (修正版) ▼▼▼ ---
  const handleExpandPrompt = async () => {
    const currentInput = input.trim();
    if (!currentInput || isLoading || isExpanding) return;

    setIsExpanding(true);
    setError(null);

    try {
      // --- メタプロンプトの指示内容を修正 ---
      const metaPrompt = `
以下のユーザー入力を、より明確で詳細な一つの質問文または指示文に書き換えてください。
元の質問や指示の意図は変えずに、より多くの情報が得られるような形にしてください。
応答は書き換えた文のみとし、追加の説明や質問は含めないでください。

ユーザー入力: ${currentInput}

書き換え後の文:
      `.trim();
      // --- メタプロンプトここまで ---

      // --- デバッグ用にコンソールに出力 (任意) ---
      // console.log("送信するメタプロンプト:", metaPrompt);
      // ---

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: metaPrompt }],
          temperature: 0.5, // 少し創造性を抑える
          max_tokens: 150,  // 拡張後の長さを調整
          stream: false
        })
      });

      if (!response.ok) {
        // エラーレスポンスの形式に合わせて調整
        let errorDetail = `APIエラー (${response.status})`;
        try {
          const errorData = await response.json();
          // LM Studioのエラー形式に合わせてキーを調整する必要があるかもしれません
          errorDetail = errorData.error?.message || errorData.detail || JSON.stringify(errorData) || errorDetail;
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
          errorDetail = `${errorDetail} (詳細取得失敗)`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();

      // --- レスポンス処理の修正 (ラベル変更に対応) ---
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const expandedPrompt = data.choices[0].message.content
          .replace(/^書き換え後の文:\s*/i, '') // ラベルを '書き換え後の文:' に変更
          .trim();

        if (expandedPrompt) {
          setInput(expandedPrompt);
        } else {
          console.warn("拡張後のプロンプトが空です。");
          // 必要であればユーザーに通知
          setError("プロンプトの拡張に失敗しました（結果が空）。");
        }
      } else {
        console.error("API応答の形式が不正です:", data);
        throw new Error("プロンプト拡張に失敗しました (不正な応答形式)。");
      }
      // --- レスポンス処理ここまで ---

    } catch (err) {
      console.error("プロンプト拡張エラー:", err);
      setError(err.message || "不明なエラーが発生しました。"); // エラーメッセージが空の場合のフォールバック
    } finally {
      setIsExpanding(false);
    }
  };
  // --- ▲▲▲ プロンプト拡張ボタンのハンドラーここまで ▲▲▲ ---

  return {
    messages,
    input,
    isLoading,
    error,
    messagesEndRef,
    isExpanding,
    setInput,
    handleSend,
    handleKeyPress,
    handleClearChat,
    handleExpandPrompt,
  };
};

export default useChat;
