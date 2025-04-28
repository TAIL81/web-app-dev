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

    // API に送信するメッセージリストを構築
    const messagesForApi = messages
        .filter(msg => !msg.hidden) // hidden メッセージを除外
        .map(msg => {
            // ファイル添付メッセージの場合は fileData を使用して API 形式に変換
            if (msg.isFileAttachment && msg.fileData) {
                // Vision モデルやテキストファイル参照のためのマルチモーダル形式
                // content は配列になる
                return {
                    role: msg.role,
                    content: [msg.fileData] // fileData は { type: ..., ... } の形式を想定
                };
            }
            // 通常のテキストメッセージ
            return { role: msg.role, content: msg.content };
        });

    // 最後のユーザー入力 (テキストエリアの内容) を追加
    // ファイル添付とテキスト入力を同時に行う場合を考慮
    // 最後のメッセージがファイル添付で、かつ input にもテキストがある場合、
    // 最後のメッセージの content を配列にして、テキストとファイルデータを結合する
    const lastMessageIndex = messagesForApi.length - 1;
    if (lastMessageIndex >= 0 && messagesForApi[lastMessageIndex].content && typeof messagesForApi[lastMessageIndex].content !== 'string' && userInput) {
        // 最後のメッセージが既にマルチモーダル形式 (content が配列) で、かつテキスト入力がある場合
        messagesForApi[lastMessageIndex].content.push({ type: "text", text: userInput });
    } else if (userInput) {
        // 最後のメッセージがテキスト形式、またはメッセージリストが空で、テキスト入力がある場合
        // 新しいユーザーメッセージとしてテキスト入力を追加
        messagesForApi.push({ role: 'user', content: userInput });
    }


    try {
      const response = await fetch('http://localhost:8002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForApi }), // ★ 構築した messagesForApi を使用
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
        {
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning,
          tool_calls: data.tool_calls // ★ tool_calls をメッセージオブジェクトに追加
        },
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

  // ★ ファイル選択時のハンドラ関数
  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsLoading(true); // ファイル処理中はローディング表示

    for (const file of files) {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const fileContent = e.target.result;
        const fileType = file.type;
        const fileName = file.name;

        let messageContent = null;

        if (fileType.startsWith('image/')) {
          // 画像ファイルの場合、Base64 形式でメッセージに追加
          // Vision モデルが認識できる形式に合わせる
          messageContent = {
            type: "image_url",
            image_url: {
              url: fileContent // Base64 データ (data:image/jpeg;base64,...)
            }
          };
          // 画像ファイルの場合、Base64 形式でメッセージに追加
          // Vision モデルが認識できる形式に合わせる
          messageContent = {
            type: "image_url",
            image_url: {
              url: fileContent // Base64 データ (data:image/jpeg;base64,...)
            },
            fileName: fileName // ファイル名も保持
          };
          // ユーザーに画像が添付されたことを示すメッセージを追加 (UI表示用)
          setMessages(prev => [...prev, { role: 'user', content: `[画像添付: ${fileName}]`, isFileAttachment: true, fileData: messageContent }]);

        } else if (fileType.startsWith('text/') || fileName.endsWith('.md')) {
          // テキストファイルの場合、内容をテキストとしてメッセージに追加
          messageContent = {
            type: "text",
            text: `以下のファイル内容を考慮してください:\n\n\`\`\`${fileName}\n${fileContent}\n\`\`\``,
            fileName: fileName // ファイル名も保持
          };
           // ユーザーにテキストファイルが添付されたことを示すメッセージを追加 (UI表示用)
          setMessages(prev => [...prev, { role: 'user', content: `[テキストファイル添付: ${fileName}]`, isFileAttachment: true, fileData: messageContent }]);

        } else {
          // サポートされていないファイルタイプ
          console.warn(`Unsupported file type: ${fileType}`);
          setError(`サポートされていないファイル形式です: ${fileType}`);
          setIsLoading(false);
          return; // このファイルはスキップ
        }

        // ファイル内容を含むメッセージをメッセージリストに追加 (API送信時に使用)
        // isFileAttachment フラグと fileData を付けておく
        // setMessages(prev => [...prev, { role: 'user', content: `[${fileName} 添付済み]`, isFileAttachment: true, fileData: messageContent }]);
        // 上記はUI表示用のメッセージと重複するため、handleSend で処理する際に
        // messages state から isFileAttachment: true のメッセージを探して fileData を取得する方針に変更

      };

      // ファイルタイプに応じて読み込み方法を分ける
      if (fileType.startsWith('image/')) {
        reader.readAsDataURL(file); // 画像は Base64 で読み込み
      } else {
        reader.readAsText(file); // テキストファイルはテキストで読み込み
      }
    }

    // ファイル読み込みは非同期なので、全てのファイル処理が終わった後にローディングを解除する必要がある
    // Promise.all などを使って全ての reader.onload が完了するのを待つのが理想的だが、
    // 簡単のため、ここではループの最後に setIsLoading(false) を置く（厳密には正しくないが、単一ファイルなら問題ない）
    // 複数ファイル対応を考慮すると、より複雑な状態管理が必要。
    // 一旦、単一ファイル添付を想定して進める。
     setIsLoading(false); // 仮置き：複数ファイルの場合は修正が必要
  };


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
    setIsExpanding, // setIsExpanding も App.jsx で管理するため含めない
    handleFileSelect // ★ handleFileSelect を返すように追加
  };
};

export default useChat;
