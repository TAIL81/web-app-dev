import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // uuid をインポート

// --- 定数 ---
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'; // バックエンドAPIのURL
const SUPPORTED_TEXT_EXTENSIONS = /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i; // サポートするテキストファイルの拡張子正規表現

// --- 初期状態 ---
const initialMessages = []; // チャットの初期メッセージ (必要に応じて設定)

// --- ヘルパー関数 (ファイル処理) ---

/**
 * Fileオブジェクトを非同期で読み込み、テキスト内容またはエラーを返すPromiseを生成します。
 * テキストファイルのみをサポートします。
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<{fileData: {type: 'text', text: string, fileName: string}|null, error: string|null, fileName: string}>}
 *          読み込み結果。成功時は fileData にテキスト情報、失敗時は error にメッセージが含まれます。
 */
const readFileAsPromise = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const fileType = file.type;
    const fileName = file.name;

    // ファイル読み込み完了時の処理
    reader.onload = (e) => {
      const fileContent = e.target.result;
      let fileData = null;
      let error = null;
      try {
        // テキストベースのファイルの場合 (拡張子でも判定)
        if (fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName)) {
          fileData = { type: "text", text: fileContent, fileName: fileName };
        } else {
          error = `サポートされていないファイル形式です (${fileType})`;
        }
      } catch (err) {
        console.error(`Error processing file ${fileName}:`, err);
        error = `ファイル処理中にエラー: ${err.message}`;
      }
      resolve({ fileData, error, fileName });
    };

    // ファイル読み込みエラー時の処理
    reader.onerror = (err) => {
      console.error(`File reading error for ${fileName}:`, err);
      resolve({ fileData: null, error: 'ファイル読み込みエラーが発生しました。', fileName });
    };

    // テキストファイルとして読み込み開始 (サポート対象のみ)
    if (fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName)) {
      reader.readAsText(file); // テキストはテキストとして読み込む
    } else {
      // サポート外の場合はエラーとして即時解決
      resolve({ fileData: null, error: `サポートされていないファイル形式です (${fileType})`, fileName });
    }
  });
};

/**
 * ファイル読み込み結果からUI表示用のメッセージオブジェクトを生成します。
 * @param {{fileData: object|null, error: string|null, fileName: string}} result - readFileAsPromiseの解決値
 * @returns {object|null} UI表示に適したメッセージオブジェクト、または無効な場合はnull
 */
const createFileUiMessage = (result) => {
  const { fileData, error, fileName } = result;
  if (error) {
    // エラーメッセージを生成 (UI表示用、APIには送信しない)
    return { id: uuidv4(), role: 'user', content: `[ファイル処理エラー: ${fileName}]`, isFileAttachment: false, error: error, sentToApi: true };
  } else if (fileData?.type === 'text') {
    // テキストファイル添付メッセージを生成 (UI表示用、API未送信状態)
    return { id: uuidv4(), role: 'user', content: `[ファイル添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
  }
  return null; // 有効なメッセージが生成されなかった場合
};


// --- メインフック ---
const useChat = () => {
  // --- StateとRef ---
  const [messages, setMessages] = useState(initialMessages); // チャットメッセージ配列
  const [input, setInput] = useState(''); // テキスト入力欄
  const [isLoading, setIsLoading] = useState(false); // ローディング状態 (API通信など)
  const [error, setError] = useState(null); // エラーメッセージ表示用
  const messagesEndRef = useRef(null); // チャット末尾への自動スクロール用Ref
  const [isExpanding, setIsExpanding] = useState(false); // 翻訳などの拡張処理中フラグ
  const [availableModels, setAvailableModels] = useState([]); // 利用可能なモデルIDリスト
  const [selectedModel, setSelectedModel] = useState(''); // 選択中のモデルID
  const [isModelsLoading, setIsModelsLoading] = useState(true); // モデルリスト取得中のローディング状態

  // --- Effect ---
  // メッセージリストが更新されたら最下部へスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // コンポーネントマウント時に利用可能なモデルリストを取得
  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true); // ローディング開始
      setError(null); // 既存のエラーをクリア
      try {
        const response = await fetch(`${BACKEND_URL}/api/models`); // 新しいエンドポイントを叩く
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models); // 取得したモデルIDリストをセット
          setSelectedModel(data.models[0]); // リストの最初のモデルをデフォルト選択
        } else { // モデルリストが空の場合
          console.warn("No available models received from backend or list is empty.");
          setAvailableModels([]); // 利用可能なモデルがない場合は空リスト
          setSelectedModel(''); // 選択も空に
          // setError("利用可能なAIモデルが見つかりませんでした。");
        }
      } catch (err) {
        console.error("Error fetching available models:", err);
        setError("利用可能なAIモデルの取得中にエラーが発生しました。");
        setAvailableModels([]); // エラー時も空リスト
        setSelectedModel(''); // エラー時は選択なし
      } finally {
        setIsModelsLoading(false); // ローディング終了
      }
    };

    fetchModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時に一度だけ実行

  // --- ヘルパー関数 (メッセージ送信ロジック) ---

  /**
   * テキスト入力と保留中のファイル添付からAPI送信用コンテンツ文字列を構築します。
   * ファイル内容は全文含めます。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<object>} pendingFileMessages - API未送信のファイル添付UIメッセージ
   * @returns {string} API送信用コンテンツ文字列
   */
  const buildCombinedContent = (textInput, pendingFileMessages) => {
    let combinedContent = textInput;
    // API未送信のファイルメッセージからファイルデータを抽出
    const filesToSend = pendingFileMessages.map(msg => msg.fileData).filter(Boolean);

    if (filesToSend.length > 0) {
      // ファイル情報をマークダウン形式で結合
      const fileDescriptions = filesToSend.map(fileData => {
        if (fileData.type === 'text') {
          // テキストファイルの内容をコードブロックとして追加
          return `\n[添付ファイル: ${fileData.fileName || '名称不明'}]\n\`\`\`\n${fileData.text}\n\`\`\``;
        }
        return ''; // 未知のタイプは無視
      }).join('');
      combinedContent += fileDescriptions; // テキスト入力の後ろに追加
    }
    return combinedContent;
  };

  /**
   * API送信直前にUIを更新します。
   * 新しいユーザーメッセージ(テキスト/ファイル)を追加し、送信対象のメッセージの sentToApi フラグを true にします。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<object>} pendingFileMessages - API未送信のファイル添付UIメッセージ
   * @param {Array<object>} currentMessages - 現在のメッセージ配列
   * @param {Function} setMessages - messages state 更新関数
   * @returns {Array<object>} UI更新後のメッセージ配列
   */
  const updateUiBeforeSend = (textInput, pendingFileMessages, currentMessages, setMessages) => {
    let updatedMessages = [...currentMessages];
    // テキスト入力があれば、新しいユーザーメッセージとして追加
    if (textInput) {
      const newUserTextMessage = { id: uuidv4(), role: 'user', content: textInput, sentToApi: false }; // IDを追加
      updatedMessages.push(newUserTextMessage);
    }
    // 今回送信するテキストメッセージとファイル添付メッセージの sentToApi フラグを true に更新
    const finalMessages = updatedMessages.map(msg =>
      (msg.role === 'user' && !msg.sentToApi && (msg.content === textInput || pendingFileMessages.some(pfm => pfm.fileData === msg.fileData)))
        ? { ...msg, sentToApi: true } // 送信済みフラグを立てる
        : msg
    );
    setMessages(finalMessages); // UIを即時更新
    return finalMessages; // 更新後のメッセージ配列を返す (API準備用)
  };

  /**
   * APIに送信するためのメッセージ履歴配列を準備します (履歴件数制限あり)。
   * @param {Array<object>} pastMessagesOnly - 過去のメッセージのみを含む配列 (今回のユーザー入力は除外済み)
   * @param {string} combinedContent - buildCombinedContentで生成された今回のユーザー入力コンテンツ
   * @returns {Array<object>} API送信用に整形されたメッセージ配列 (role, content のみ)
   */
  const prepareApiMessages = (pastMessagesOnly, combinedContent) => {
    const MAX_HISTORY_PAIRS = 5; // 保持する会話の往復数
    const MAX_API_MESSAGES = MAX_HISTORY_PAIRS * 2; // APIに含める最大メッセージ数

    // API履歴に含める過去メッセージをフィルタリング
    const relevantPastMessages = pastMessagesOnly.filter(msg => {
      if (msg.hidden) return false; // 非表示は除外

      if (msg.role === 'user') {
        // ユーザーメッセージ: ファイル添付メッセージ自体は履歴に含めない
        return !msg.isFileAttachment;
      } else if (msg.role === 'assistant') {
        // アシスタントメッセージ: content が文字列であれば含める
        return typeof msg.content === 'string';
      }
      return false; // その他のロールは除外
    });

    // 最新のメッセージから指定件数分を取得
    const limitedPastMessages = relevantPastMessages.slice(-MAX_API_MESSAGES);
    // APIに必要な形式 (role, content) にマッピング
    const pastMessagesForApi = limitedPastMessages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // 今回のユーザー入力をAPI形式で作成
    let currentMessageForApi = null;
    if (combinedContent) {
      currentMessageForApi = { role: 'user', content: combinedContent };
    }

    // 過去の履歴と今回の入力を結合
    const messagesForApi = [...pastMessagesForApi];
    if (currentMessageForApi) {
      messagesForApi.push(currentMessageForApi);
    }
    // --- デバッグログも変更なし ---
    if (process.env.NODE_ENV === 'development') {
        console.log(`prepareApiMessages: Sending ${messagesForApi.length} messages (Limit: ${MAX_API_MESSAGES} past + 1 current max)`);
        // console.log("Messages for API:", JSON.stringify(messagesForApi, null, 2));
    }

    return messagesForApi;
  };

  /**
   * API呼び出しでエラーが発生した場合の処理。
   * エラーメッセージをUIに表示し、送信試行したメッセージを未送信状態に戻します。
   * @param {Error} error - 発生したエラーオブジェクト
   * @param {Function} setError - error state 更新関数
   * @param {Function} setMessages - messages state 更新関数
   * @param {string} originalTextInput - 送信試行したテキスト入力
   * @param {Array<object>} originalPendingFiles - 送信試行したファイル添付UIメッセージ
   */
  const handleApiError = (error, setError, setMessages, originalTextInput, originalPendingFiles) => {
    console.error("API処理エラー:", error);
    let userFriendlyError = `メッセージの送信に失敗しました。`;
    if (error.message) {
        userFriendlyError += ` 詳細: ${error.message}`;
    }
    setError(userFriendlyError); // エラーメッセージをUIに表示

    // 送信に失敗したメッセージの sentToApi フラグを false に戻す (再送信可能にする)
    setMessages(prev => prev.map(msg => {
      // 今回送信しようとしたテキストメッセージか？
      const isFailedText = msg.role === 'user' && msg.sentToApi === true && msg.content === originalTextInput && !msg.isFileAttachment;
      // 今回送信しようとしたファイル添付メッセージか？
      const isFailedFile = msg.role === 'user' && msg.sentToApi === true && msg.isFileAttachment && originalPendingFiles.some(pfm => pfm.fileData === msg.fileData);
      // 該当すれば sentToApi を false に戻す
      if (isFailedText || isFailedFile) {
        return { ...msg, sentToApi: false };
      }
      return msg;
    }));
  };


  // --- コア関数 ---

  /**
   * メッセージ送信処理のメイン関数。
   * テキスト入力と未送信ファイルを結合し、APIに送信して応答を処理します。
   */
  const handleSend = useCallback(async () => {
    // API未送信のファイル添付メッセージを取得
    const pendingFileMessages = messages.filter(m => m.role === 'user' && m.isFileAttachment && !m.sentToApi);
    // 現在のテキスト入力 (前後の空白を除去)
    const currentInput = input.trim();

    // 送信条件チェック: 入力もファイルもなく、処理中でもなく、モデル未選択/ロード中でもないこと
    if ((!currentInput && pendingFileMessages.length === 0) || isLoading || isModelsLoading || !selectedModel) {
      if (process.env.NODE_ENV === 'development') {
        console.log("送信条件未達:", { currentInput, pendingFileMessages: pendingFileMessages.length, isLoading, isModelsLoading, selectedModel });
      }
      // モデルがまだロードされていない、または選択されていない場合のエラー表示
      if (!isLoading && (isModelsLoading || !selectedModel)) {
          setError("送信前にモデルを選択してください (ロード中または利用不可)。");
      }
      return; // 送信しない
    }

    setIsLoading(true); // ローディング開始
    setError(null); // エラー表示をクリア

    // 1. API送信用コンテンツ作成 (テキスト + ファイル内容)
    const combinedContent = buildCombinedContent(currentInput, pendingFileMessages);

    // 2. UI更新 (ユーザーメッセージ追加、送信済みフラグ更新)
    //    updateUiBeforeSend は更新後のメッセージ配列を返す
    const updatedMessages = updateUiBeforeSend(currentInput, pendingFileMessages, messages, setMessages);
    setInput(''); // 入力欄をクリア

    // 3. API送信準備 (API用のメッセージ履歴作成)
    //    prepareApiMessages に渡すための「過去の」メッセージ配列を作成する
    //    (updatedMessages から、今回 sentToApi=true になったメッセージを除外する)
    const messagesForHistoryPreparation = updatedMessages.filter(msg => {
      const isCurrentTextMessage = msg.role === 'user' && msg.sentToApi === true && !msg.isFileAttachment && msg.content === currentInput;
      const isCurrentFileMessage = msg.role === 'user' && msg.sentToApi === true && msg.isFileAttachment && pendingFileMessages.some(pfm => pfm.fileData === msg.fileData);
      // 今回のテキスト/ファイルメッセージで「ない」ものを履歴準備用に残す
      return !(isCurrentTextMessage || isCurrentFileMessage);
    });
    // 過去メッセージと今回のコンテンツからAPI送信用配列を作成
    const messagesForApi = prepareApiMessages(messagesForHistoryPreparation, combinedContent);

    // 送信するユーザーコンテンツがない場合は異常系 (通常発生しないはず)
    if (!messagesForApi.some(m => m.role === 'user')) {
       console.warn("送信するユーザーコンテンツがありません。UIをロールバックします。");
       setIsLoading(false);
       setMessages(messages); // メッセージ履歴を送信前の状態に戻す
       setInput(currentInput); // 入力欄を送信前の状態に戻す
       return;
    }

    // 4. API呼び出し & 応答処理
    try {
      // APIリクエストボディ
      const requestBody = {
        messages: messagesForApi,
        purpose: 'main_chat', // メインチャットであることを示す
        model_name: selectedModel, // 選択中のモデル名を送信
      };

      // 開発モード時にリクエスト内容をコンソールに出力
      if (process.env.NODE_ENV === 'development') {
        console.log("Sending to API:", JSON.stringify(requestBody, null, 2));
      }

      // バックエンドAPIにPOSTリクエスト
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // API応答エラーハンドリング
      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          // エラーレスポンスのJSONを解析試行
          errorData = await response.json();
          if (errorData && errorData.detail) {
            // FastAPIのバリデーションエラーなどの詳細情報を取得
            if (Array.isArray(errorData.detail)) {
              errorDetail = errorData.detail.map(d => `[${d.loc?.join('->') || 'N/A'}]: ${d.msg || 'No message'}`).join('; ');
            } else if (typeof errorData.detail === 'string') {
              errorDetail = errorData.detail;
            } else {
              errorDetail = JSON.stringify(errorData.detail); // 文字列以外はJSON化
            }
          } else if (errorData) {
            // その他のJSONエラー
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          // JSON解析失敗時のフォールバック
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        // エラーオブジェクトを作成してスロー
        const error = new Error(errorDetail);
        error.responseDetails = errorData; // 付加情報として保持
        throw error;
      }

      // 5. API成功時のUI更新 (アシスタントの応答を追加)
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(), // IDを追加
          role: 'assistant',
          content: data.content, // 応答メッセージ本文
          reasoning: data.reasoning, // reasoning情報 (あれば)
          tool_calls: data.tool_calls // tool_calls情報があれば追加
        },
      ]);

    } catch (err) {
      // 6. APIエラー時の処理 (エラー表示、UIロールバック)
      handleApiError(err, setError, setMessages, currentInput, pendingFileMessages);
    } finally {
      setIsLoading(false); // ローディング終了
    }
  // 依存配列: これらの値が変更されたら関数を再生成
  }, [messages, input, isLoading, selectedModel, isModelsLoading, setMessages, setError, setInput]);

  /**
   * チャット履歴をクリアする関数 (フロントエンドの状態のみクリア)。
   */
  const handleClearChat = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
        console.log('useChat: handleClearChat called');
    }
    // 確認ダイアログは App.jsx 側で必要なら実装
    setMessages(initialMessages); // メッセージ履歴を初期状態に戻す
    setError(null); // エラー表示をクリア
    setIsLoading(false); // ローディング状態をリセット
    setIsExpanding(false); // 拡張状態をリセット
    setInput(''); // 入力欄をクリア
  // 依存配列: state setter は通常不変だが明示
  }, [setMessages, setError, setIsLoading, setIsExpanding, setInput]);

  /**
   * ファイル選択 `<input type="file">` の変更イベントを処理する関数。
   * 選択されたファイルを読み込み、UIメッセージとして追加します。
   * @param {React.ChangeEvent<HTMLInputElement>} event - input要素のchangeイベント
   */
  const handleFileSelect = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return; // ファイル未選択時は何もしない

    setIsLoading(true); // ローディング開始
    setError(null); // エラー表示をクリア

    // 選択された全てのファイルを非同期で読み込む
    const fileReadPromises = Array.from(files).map(readFileAsPromise);

    try {
      // 全てのファイル読み込み完了を待つ
      const results = await Promise.all(fileReadPromises);
      // 読み込み結果からUI用メッセージを生成 (エラー含む)
      const newUiMessages = results.map(createFileUiMessage).filter(Boolean); // nullを除外
      // 新しいメッセージを既存のメッセージに追加
      if (newUiMessages.length > 0) {
        setMessages(prev => [...prev, ...newUiMessages]);
      }
    } catch (err) {
      // Promise.all 自体のエラー (通常はreadFileAsPromise内で処理されるはず)
      console.error("Error processing files with Promise.all:", err);
      setError("ファイル処理中に予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false); // ローディング終了
      // input[type=file] の値をリセットし、同じファイルを連続で選択できるようにする
      if (event.target) {
        event.target.value = null;
      }
    }
  // 依存配列
  }, [setMessages, setIsLoading, setError]);

  // --- フックの戻り値 ---
  // フックが外部に提供する値と関数
  return {
    messages,           // チャットメッセージ配列
    input,              // 入力欄の内容
    setInput,           // input state 更新関数
    isLoading,          // ローディング状態 (API通信、ファイル処理など)
    error,              // エラーメッセージ
    setError,           // error state 更新関数
    messagesEndRef,     // 自動スクロール用Ref
    handleSend,         // メッセージ送信関数
    handleClearChat,    // チャットクリア関数
    handleFileSelect,   // ファイル選択処理関数
    isExpanding,        // プロンプト拡張中フラグ
    setIsExpanding,     // isExpanding state 更新関数
    selectedModel,      // 選択中のモデルID
    setSelectedModel,   // selectedModel state 更新関数
    availableModels,    // 利用可能なモデルIDリスト
    isModelsLoading,    // モデルリスト取得中のローディング状態
  };
};

export default useChat; // フックをエクスポート
