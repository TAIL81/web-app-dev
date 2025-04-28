import { useState, useEffect, useRef } from 'react';

const useChat = () => {
  // --- State and Refs ---
  const initialMessages = [
    // システムプロンプトはバックエンドで追加されるため、フロントでは通常不要
    // { role: 'system', content: '...', hidden: true },
  ];
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [isExpanding, setIsExpanding] = useState(false); // プロンプト拡張用

  // --- Effects ---
  // メッセージリストが更新されたら一番下にスクロールする
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Core Functions ---

  /**
   * メッセージをAPIに送信する関数
   * バックエンドは content: str を期待するため、ファイル内容をテキスト化して結合する
   */
  const handleSend = async () => {
    // API未送信のユーザーメッセージ（ファイル添付プレースホルダー）を取得
    const pendingFileMessages = messages.filter(m => m.role === 'user' && m.isFileAttachment && !m.sentToApi);
    const currentInput = input.trim();

    // 送信する内容（テキスト入力または未送信ファイル）がない、またはローディング中は処理しない
    if ((!currentInput && pendingFileMessages.length === 0) || isLoading) {
      console.log("送信条件未達:", { currentInput, pendingFileMessages, isLoading });
      return;
    }

    setIsLoading(true);
    setError(null);

    // --- API送信用コンテンツ作成 ---
    let combinedContent = currentInput; // まずは現在のテキスト入力
    const filesToSend = pendingFileMessages.map(msg => msg.fileData).filter(Boolean); // 送信するファイル情報を抽出

    // ファイル内容をテキスト形式で combinedContent に追加
    if (filesToSend.length > 0) {
      const fileDescriptions = filesToSend.map(fileData => {
        if (fileData.type === 'image_url') {
          // 画像の場合: ファイル名を記述する (Base64は送らない)
          return `\n[添付画像: ${fileData.fileName || '名称不明'}]`;
        } else if (fileData.type === 'text') {
          // テキストファイルの場合: ファイル名と内容を含める
          // バックエンドやLLMのトークン制限を考慮し、長すぎる場合は省略するなどの工夫が必要な場合あり
          const MAX_TEXT_LENGTH = 2000; // 例: 最大2000文字に制限
          const truncatedText = fileData.text.length > MAX_TEXT_LENGTH
            ? fileData.text.substring(0, MAX_TEXT_LENGTH) + '... (省略)'
            : fileData.text;
          return `\n[添付ファイル: ${fileData.fileName || '名称不明'}]\n\`\`\`\n${truncatedText}\n\`\`\``;
        }
        return ''; // サポート外のタイプは無視
      }).join('');

      // 既存の入力とファイル説明を結合
      combinedContent += fileDescriptions;
    }

    // --- UI更新 ---
    let currentMessages = [...messages];
    // 現在のテキスト入力があれば、UI表示用のメッセージとして追加
    if (currentInput) {
      const newUserTextMessage = { role: 'user', content: currentInput, sentToApi: false };
      currentMessages.push(newUserTextMessage);
    }
    // ファイル添付のUIメッセージは handleFileSelect で追加済みのはず
    // 送信する内容が確定したので、UIメッセージの sentToApi フラグを更新
    const updatedMessages = currentMessages.map(msg =>
      msg.role === 'user' && !msg.sentToApi ? { ...msg, sentToApi: true } : msg
    );
    setMessages(updatedMessages); // UIを即時更新
    setInput(''); // テキストエリアをクリア

    // --- API送信準備 ---
    // APIに送信するメッセージリストを構築
    // 1. 過去のやり取り (UI更新前の messages 配列から取得)
    const pastMessagesForApi = messages // ★ UI更新前の messages を使う
      .filter(msg => !msg.hidden && msg.sentToApi === true && !msg.isFileAttachment) // 以前の送信で確定したメッセージ
      .map(msg => ({ role: msg.role, content: msg.content }));

    // 2. 今回送信するユーザーメッセージ（テキスト＋ファイル情報）
    let currentMessageForApi = null;
    if (combinedContent) {
      currentMessageForApi = { role: 'user', content: combinedContent };
    }

    // 結合
    const messagesForApi = [...pastMessagesForApi];
    if (currentMessageForApi) {
      messagesForApi.push(currentMessageForApi); // ★ 今回のメッセージを1回だけ追加
    }

    // combinedContent が空の場合は送信しない（通常は発生しないはず）
    if (!currentMessageForApi) {
      console.warn("送信するコンテンツが空です。");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Sending to API:", JSON.stringify({ messages: messagesForApi }, null, 2));

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForApi }), // バックエンドは { messages: [...] } を期待
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          errorData = await response.json();
          if (errorData && errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorDetail = errorData.detail.map(d => {
                const loc = d.loc ? d.loc.join(' -> ') : 'N/A';
                const msg = d.msg || 'No message';
                return `[${loc}]: ${msg}`;
              }).join('; ');
            } else if (typeof errorData.detail === 'string') {
              errorDetail = errorData.detail; // FastAPIからの直接的なエラーメッセージ
            } else {
              errorDetail = JSON.stringify(errorData.detail);
            }
          } else if (errorData) {
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      // APIからの応答をメッセージリストに追加
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning, // 思考プロセス
          tool_calls: data.tool_calls // ツール呼び出し
        },
      ]);
    } catch (err) {
      console.error("API処理エラー:", err);
      setError(`メッセージの送信に失敗しました: ${err.message}`);
      // エラー発生時、送信しようとしたメッセージの sentToApi フラグを戻す
      setMessages(prev => prev.map(msg =>
        (msg.role === 'user' && msg.sentToApi === true && (msg.content === currentInput || msg.isFileAttachment)) // 今回送信に関わったメッセージを戻す
          ? { ...msg, sentToApi: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * チャット履歴をクリアする関数
   */
  const handleClearChat = () => {
    if (window.confirm("チャット履歴をクリアしてもよろしいですか？")) {
      setMessages(initialMessages);
      setError(null);
      setIsLoading(false);
      setIsExpanding(false);
      setInput('');
    }
  };

  /**
   * ファイル選択時のハンドラ関数
   * UIにプレースホルダーメッセージを追加し、ファイルデータを保持する
   */
  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const fileReadPromises = Array.from(files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        const fileType = file.type;
        const fileName = file.name;

        reader.onload = (e) => {
          const fileContent = e.target.result;
          let fileData = null; // API送信用データ（handleSendでテキスト化される）
          let uiMessage = null; // UI表示用データ

          try {
            if (fileType.startsWith('image/')) {
              // 画像データは保持するが、APIにはファイル名のみ送る想定
              fileData = { type: "image_url", url: fileContent, fileName: fileName };
              uiMessage = { role: 'user', content: `[画像添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
            } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
              // テキストデータは保持
              fileData = { type: "text", text: fileContent, fileName: fileName };
              uiMessage = { role: 'user', content: `[ファイル添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
            } else {
              console.warn(`Unsupported file type: ${fileType} (${fileName})`);
              uiMessage = { role: 'user', content: `[サポート外ファイル: ${fileName}]`, isFileAttachment: false, error: `サポートされていないファイル形式です (${fileType})`, sentToApi: true };
            }
            resolve({ uiMessage });

          } catch (err) {
              console.error(`Error processing file ${fileName}:`, err);
              uiMessage = { role: 'user', content: `[ファイル処理エラー: ${fileName}]`, isFileAttachment: false, error: `ファイル処理中にエラー: ${err.message}`, sentToApi: true };
              resolve({ uiMessage });
          }
        };

        reader.onerror = (error) => {
          console.error(`File reading error for ${fileName}:`, error);
          const uiMessage = { role: 'user', content: `[ファイル読込エラー: ${fileName}]`, isFileAttachment: false, error: `ファイル読み込みエラーが発生しました。`, sentToApi: true };
          resolve({ uiMessage });
        };

        if (fileType.startsWith('image/')) {
          reader.readAsDataURL(file); // 画像は Base64
        } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
          reader.readAsText(file); // テキスト系はテキストとして読み込み
        } else {
          const uiMessage = { role: 'user', content: `[サポート外ファイル: ${fileName}]`, isFileAttachment: false, error: `サポートされていないファイル形式です (${fileType})`, sentToApi: true };
          resolve({ uiMessage });
        }
      });
    });

    try {
      const results = await Promise.all(fileReadPromises);
      const newUiMessages = results.map(result => result.uiMessage).filter(Boolean);
      if (newUiMessages.length > 0) {
          setMessages(prev => [...prev, ...newUiMessages]);
      }
    } catch (err) {
      console.error("Error processing files with Promise.all:", err);
      setError("ファイル処理中に予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false);
      if (event.target) {
          event.target.value = null;
      }
    }
  };


  // --- Return Values ---
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    messagesEndRef,
    handleSend,
    handleClearChat,
    handleFileSelect,
    isExpanding,      // プロンプト拡張用
    setIsExpanding,   // プロンプト拡張用
  };
};

export default useChat;
