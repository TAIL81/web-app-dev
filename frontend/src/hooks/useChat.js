// d:\Users\onisi\Documents\web-app-dev\frontend\src\hooks\useChat.js
import { useState, useEffect, useRef, useCallback } from 'react';

// --- initialMessages をフックの外に定義 ---
// これにより参照が安定し、useCallback の依存配列の問題を回避
const initialMessages = [
  // 必要に応じて初期システムメッセージを追加できます
  // 例: { role: 'system', content: 'あなたは親切なアシスタントです。', hidden: true },
];

const useChat = () => {
  // --- State and Refs ---
  const [messages, setMessages] = useState(initialMessages); // 外部の initialMessages を初期値として使用
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null); // メッセージリストの末尾への参照
  const [isExpanding, setIsExpanding] = useState(false); // プロンプト拡張中フラグ

  // --- Effects ---
  // メッセージが更新されたときに一番下にスクロールする
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // messages 配列が変更されたときに実行

  // --- Core Functions ---

  /**
   * メッセージを送信する関数
   */
  const handleSend = useCallback(async () => {
    // API未送信のユーザーメッセージ（ファイル添付プレースホルダー）を取得
    const pendingFileMessages = messages.filter(m => m.role === 'user' && m.isFileAttachment && !m.sentToApi);
    const currentInput = input.trim(); // 入力テキストの前後の空白を除去

    // 送信する内容（テキスト入力または未送信ファイル）がない、またはローディング中は処理しない
    if ((!currentInput && pendingFileMessages.length === 0) || isLoading) {
      console.log("送信条件未達:", { currentInput, pendingFileMessages, isLoading });
      return; // 送信処理を中断
    }

    setIsLoading(true); // ローディング開始
    setError(null); // エラー表示をクリア

    // --- API送信用コンテンツ作成 ---
    let combinedContent = currentInput; // まずは現在のテキスト入力
    const filesToSend = pendingFileMessages.map(msg => msg.fileData).filter(Boolean); // 送信するファイル情報を抽出

    // ファイル内容をテキスト形式で combinedContent に追加
    if (filesToSend.length > 0) {
      const fileDescriptions = filesToSend.map(fileData => {
        if (fileData.type === 'image_url') {
          // 画像の場合はファイル名をテキストに追加 (Vision API 用ではない点に注意)
          return `\n[添付画像: ${fileData.fileName || '名称不明'}]`;
        } else if (fileData.type === 'text') {
          // テキストファイルの場合は内容を制限して追加
          const MAX_TEXT_LENGTH = 2000; // 最大文字数
          const truncatedText = fileData.text.length > MAX_TEXT_LENGTH
            ? fileData.text.substring(0, MAX_TEXT_LENGTH) + '... (省略)' // 長すぎる場合は省略
            : fileData.text;
          return `\n[添付ファイル: ${fileData.fileName || '名称不明'}]\n\`\`\`\n${truncatedText}\n\`\`\``; // Markdown形式で囲む
        }
        return ''; // サポート外のタイプは無視
      }).join('');
      combinedContent += fileDescriptions; // 結合
    }

    // --- UI更新 (送信前にユーザーメッセージを表示) ---
    let currentMessages = [...messages]; // 現在のメッセージリストをコピー
    if (currentInput) {
      // テキスト入力がある場合、新しいユーザーメッセージオブジェクトを作成
      const newUserTextMessage = { role: 'user', content: currentInput, sentToApi: false }; // sentToApi: false で未送信マーク
      currentMessages.push(newUserTextMessage);
    }
    // 未送信のユーザーメッセージ (テキストとファイル両方) に送信済みマークを付ける
    const updatedMessages = currentMessages.map(msg =>
      msg.role === 'user' && !msg.sentToApi ? { ...msg, sentToApi: true } : msg
    );
    setMessages(updatedMessages); // メッセージリストを更新
    setInput(''); // 入力欄をクリア

    // --- API送信準備 ---
    // APIに送信する過去のメッセージ履歴を作成 (非表示メッセージ、未送信ファイルを除く)
    const pastMessagesForApi = messages
      .filter(msg => !msg.hidden && msg.sentToApi === true && !msg.isFileAttachment)
      .map(msg => ({ role: msg.role, content: msg.content })); // APIが必要な形式に変換

    // 今回送信するユーザーメッセージを作成 (テキストとファイル説明を結合したもの)
    let currentMessageForApi = null;
    if (combinedContent) {
      currentMessageForApi = { role: 'user', content: combinedContent };
    }

    // 過去のメッセージと今回のメッセージを結合
    const messagesForApi = [...pastMessagesForApi];
    if (currentMessageForApi) {
      messagesForApi.push(currentMessageForApi);
    }

    // 送信するコンテンツがない場合は警告し、処理を終了
    if (!currentMessageForApi) {
      console.warn("送信するコンテンツが空です。");
      setIsLoading(false);
      return;
    }

    // --- API呼び出し ---
    try {
      console.log("Sending to API:", JSON.stringify({ messages: messagesForApi }, null, 2)); // 送信内容をログ出力 (デバッグ用)
      // 環境変数からバックエンドURLを取得、なければデフォルト値を使用
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/chat`, { // バックエンドのチャットAPIエンドポイント
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForApi }), // メッセージ履歴をJSON形式で送信
      });

      // --- レスポンス処理 ---
      if (!response.ok) {
        // エラーレスポンスの場合
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          // エラー詳細をJSONから取得試行
          errorData = await response.json();
          if (errorData && errorData.detail) {
            if (Array.isArray(errorData.detail)) { // FastAPIのバリデーションエラー形式
              errorDetail = errorData.detail.map(d => {
                const loc = d.loc ? d.loc.join(' -> ') : 'N/A';
                const msg = d.msg || 'No message';
                return `[${loc}]: ${msg}`;
              }).join('; ');
            } else if (typeof errorData.detail === 'string') { // 通常のエラーメッセージ
              errorDetail = errorData.detail;
            } else { // その他の形式
              errorDetail = JSON.stringify(errorData.detail);
            }
          } else if (errorData) { // detail がない場合でも、他の情報があれば表示
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          // JSON解析失敗時
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        throw new Error(errorDetail); // エラーを投げる
      }

      // 正常なレスポンスの場合
      const data = await response.json(); // 応答データをJSONとして解析
      // アシスタントの応答をメッセージリストに追加
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content, // メインの応答内容
          reasoning: data.reasoning, // Reasoning (あれば)
          tool_calls: data.tool_calls // Tool Calls (あれば)
        },
      ]);
    } catch (err) {
      // --- エラーハンドリング ---
      console.error("API処理エラー:", err);
      setError(`メッセージの送信に失敗しました: ${err.message}`); // エラーメッセージをUIに表示
      // 送信失敗したユーザーメッセージを未送信状態に戻す (再試行可能にするため)
      setMessages(prev => prev.map(msg =>
        (msg.role === 'user' && msg.sentToApi === true && (msg.content === currentInput || msg.isFileAttachment))
          ? { ...msg, sentToApi: false }
          : msg
      ));
    } finally {
      // --- 後処理 ---
      setIsLoading(false); // ローディング終了
    }
  }, [messages, input, isLoading]); // 依存配列: これらの値が変わると関数が再生成される

  /**
   * チャット履歴をクリアし、バックエンドに終了リクエストを送る関数
   */
  const handleClearChat = useCallback(async () => {
    // ユーザーに確認
    if (window.confirm("チャット履歴をクリアし、サーバーを終了してもよろしいですか？")) {
      // 1. フロントエンドの状態をリセット
      setMessages(initialMessages); // メッセージを初期状態に
      setError(null); // エラー表示をクリア
      setIsLoading(false); // ローディング状態をリセット
      setIsExpanding(false); // 拡張状態もリセット
      setInput(''); // 入力欄もクリア
      console.log('Chat history cleared locally.');

      // 2. バックエンドに終了リクエストを送信
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/exit`, { // バックエンドの終了APIエンドポイント
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // ボディは不要
        });

        // サーバーが即座に終了するため、正常応答が返るかは不確実
        if (response.ok) {
          console.log('Exit request sent successfully to backend.');
        } else {
          // サーバーが終了前にエラー応答した場合
          console.error('Failed to send exit request:', response.statusText);
          setError(`サーバー終了リクエストに失敗しました (${response.status})。サーバーは応答しない可能性があります。`);
        }
      } catch (error) {
        // ネットワークエラー (サーバーが応答前に終了した場合など)
        console.error('Error sending exit request:', error);
        // これが期待される動作の場合もある
        console.log('Backend might have shut down as requested.');
        // ユーザーへのエラー表示は必須ではないかもしれない
      }
    }
  }, []); // 依存配列は空 (外部の initialMessages は安定しているため)

  /**
   * ファイル選択イベントを処理する関数
   */
  const handleFileSelect = useCallback(async (event) => {
    const files = event.target.files; // 選択されたファイルリストを取得
    if (!files || files.length === 0) {
      return; // ファイルが選択されていなければ何もしない
    }

    setIsLoading(true); // ファイル処理中のローディング表示
    setError(null);

    // 各ファイルを非同期で読み込むための Promise 配列を作成
    const fileReadPromises = Array.from(files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader(); // ファイルリーダーを作成
        const fileType = file.type; // ファイルのMIMEタイプ
        const fileName = file.name; // ファイル名

        // ファイル読み込み完了時の処理
        reader.onload = (e) => {
          const fileContent = e.target.result; // 読み込んだ内容 (Data URL or Text)
          let fileData = null; // API送信用データ
          let uiMessage = null; // UI表示用メッセージ

          try {
            if (fileType.startsWith('image/')) {
              // 画像ファイルの場合
              fileData = { type: "image_url", url: fileContent, fileName: fileName }; // Data URL形式
              uiMessage = { role: 'user', content: `[画像添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
            } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
              // テキストファイル (または特定の拡張子) の場合
              fileData = { type: "text", text: fileContent, fileName: fileName }; // テキスト内容
              uiMessage = { role: 'user', content: `[ファイル添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
            } else {
              // サポート外のファイル形式
              console.warn(`Unsupported file type: ${fileType} (${fileName})`);
              uiMessage = { role: 'user', content: `[サポート外ファイル: ${fileName}]`, isFileAttachment: false, error: `サポートされていないファイル形式です (${fileType})`, sentToApi: true }; // エラーメッセージとして表示
            }
            resolve({ uiMessage }); // 処理結果を resolve

          } catch (err) {
              // ファイル処理中のエラー
              console.error(`Error processing file ${fileName}:`, err);
              uiMessage = { role: 'user', content: `[ファイル処理エラー: ${fileName}]`, isFileAttachment: false, error: `ファイル処理中にエラー: ${err.message}`, sentToApi: true };
              resolve({ uiMessage }); // エラー結果を resolve
          }
        };

        // ファイル読み込み失敗時の処理
        reader.onerror = (error) => {
          console.error(`File reading error for ${fileName}:`, error);
          const uiMessage = { role: 'user', content: `[ファイル読込エラー: ${fileName}]`, isFileAttachment: false, error: `ファイル読み込みエラーが発生しました。`, sentToApi: true };
          resolve({ uiMessage }); // エラー結果を resolve
        };

        // ファイル形式に応じて読み込み方法を選択
        if (fileType.startsWith('image/')) {
          reader.readAsDataURL(file); // 画像は Data URL として読み込む
        } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
          reader.readAsText(file); // テキストは Text として読み込む
        } else {
          // サポート外の場合は読み込まずにエラーメッセージを resolve
          const uiMessage = { role: 'user', content: `[サポート外ファイル: ${fileName}]`, isFileAttachment: false, error: `サポートされていないファイル形式です (${fileType})`, sentToApi: true };
          resolve({ uiMessage });
        }
      });
    });

    // すべてのファイルの読み込み・処理が完了するのを待つ
    try {
      const results = await Promise.all(fileReadPromises);
      const newUiMessages = results.map(result => result.uiMessage).filter(Boolean); // 結果からUIメッセージのみ抽出
      if (newUiMessages.length > 0) {
          // 新しいUIメッセージを既存のメッセージリストに追加
          setMessages(prev => [...prev, ...newUiMessages]);
      }
    } catch (err) {
      // Promise.all で予期せぬエラーが発生した場合
      console.error("Error processing files with Promise.all:", err);
      setError("ファイル処理中に予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false); // ローディング終了
      // input type="file" の値をリセットして、同じファイルを再度選択できるようにする
      if (event.target) {
          event.target.value = null;
      }
    }
  }, []); // 依存配列は空

  // --- Return Values ---
  // フックが外部に提供する値と関数
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    messagesEndRef,
    handleSend, // メッセージ送信関数
    handleClearChat, // チャットクリア＆終了関数
    handleFileSelect, // ファイル選択処理関数
    isExpanding,
    setIsExpanding,
  };
};

export default useChat;
