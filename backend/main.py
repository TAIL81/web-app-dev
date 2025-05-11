# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
import sys
# import signal # signal モジュールをインポート # 未使用のため削除
import logging # logging モジュールをインポート
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from pathlib import Path # pathlib をインポート
import aiofiles # aiofiles をインポート

import uvicorn
import traceback

# --- Logger Setup ---
logger = logging.getLogger(__name__) # ロガーを取得
logger.addHandler(logging.NullHandler()) # デフォルトではログ出力を抑制

# --- Global Variables ---
config: Dict[str, Any] = {} # アプリケーション全体の設定を保持
groq_client: Optional[Groq] = None # 初期化されたGroqクライアントを保持
api_key: Optional[str] = None # APIキーを保持 (デバッグ用、通常は不要)

# ★ executed_tools を reasoning に追加するかどうか (0: 無効, 1: 有効)
# APPEND_EXECUTED_TOOLS_TO_REASONING = 0 # このフラグは不要になったため削除
 
# --- FastAPI App Initialization ---
app = FastAPI(
    title="Groq Chat API Backend",
    description="Backend for the chat application using Groq API.",
    version="0.2.0", # バージョンアップ
)

# --- CORS Configuration ---
frontend_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3001").split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Constants ---
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese"
UPLOAD_DIR = Path(__file__).parent / "uploads" # アップロードディレクトリを定義
UPLOAD_DIR.mkdir(exist_ok=True) # アップロードディレクトリを作成

# --- Configuration Loading (Modified for Startup) ---
def load_config_on_startup():
    """
    設定ファイルを読み込む関数 (起動時専用)。
    エラー発生時はサーバー起動を中止させるため RuntimeError を送出。
    """
    global config # グローバル変数を更新
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            loaded_config = json.load(f)
            logger.info(f"設定ファイルを読み込みました: {CONFIG_FILE}")

            # --- 主要な設定セクションの存在確認 ---
            if "main_chat" not in loaded_config:
                logger.warning(f"設定ファイルに 'main_chat' セクションが見つかりません。デフォルト値を使用します。")
                loaded_config["main_chat"] = {} # 空の辞書で初期化

            # --- reasoning_supported_models のデフォルト値設定 (main_chat のみ) ---
            if "reasoning_supported_models" not in loaded_config.get("main_chat", {}):
                 logger.info("'main_chat' セクションに 'reasoning_supported_models' が見つかりません。空リストを設定します。")
                 loaded_config["main_chat"]["reasoning_supported_models"] = []

            config = loaded_config # グローバル変数に格納
            return config # 呼び出し元でも使えるように返す (必須ではない)

    except FileNotFoundError:
        logger.error(f"致命的エラー: 設定ファイル '{CONFIG_FILE}' が見つかりません。")
        raise RuntimeError(f"設定ファイル '{CONFIG_FILE}' が見つかりません。")
    except json.JSONDecodeError as e:
        logger.error(f"致命的エラー: 設定ファイル '{CONFIG_FILE}' の形式が正しくありません。詳細: {e}")
        raise RuntimeError(f"設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
    except Exception as e:
        logger.error(f"致命的エラー: 設定ファイルの読み込み中に予期せぬエラーが発生しました: {type(e).__name__}")
        logger.exception("設定ファイル読み込み中のエラー詳細:")
        raise RuntimeError(f"設定ファイルの読み込み中にエラー: {e}")

# --- Startup Event Handler ---
@app.on_event("startup")
async def startup_event():
    """
    アプリケーション起動時に実行されるイベントハンドラ。
    設定の読み込み、APIキーの取得、Groqクライアントの初期化を行う。
    """
    global config, groq_client, api_key # グローバル変数を参照・更新
    logger.info("--- Application Startup Sequence ---")
    try:
        # 1. 設定ファイルの読み込み
        logger.debug("1. 設定ファイルを読み込んでいます...")
        load_config_on_startup() # グローバル変数 config が更新される
        logger.debug("   設定ファイルの読み込み完了。")

        # 2. APIキーの取得 (環境変数からのみ)
        logger.debug("2. Groq API キーを環境変数から取得しています (GROQ_API_KEY)...")
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            logger.error("致命的エラー: 環境変数 'GROQ_API_KEY' が設定されていません。")
            raise RuntimeError("Groq API キーが環境変数 'GROQ_API_KEY' に設定されていません。")
        logger.debug("   API キー取得完了。")

        # 3. Groqクライアントの初期化
        logger.debug("3. Groq クライアントを初期化しています...")
        groq_client = Groq(api_key=api_key)
        # 簡単な接続テスト (オプション) - 起動時に認証エラーを検知しやすくする
        try:
            groq_client.models.list() # モデルリスト取得を試みる
            logger.info("   Groq クライアント初期化および接続テスト完了。") # 接続テスト成功はINFO
        except AuthenticationError as auth_err:
            logger.error(f"致命的エラー: Groq API 認証エラー (起動時): {auth_err}")
            raise RuntimeError(f"Groq API 認証エラー。提供された API キーが無効です: {auth_err}") from auth_err
        except APIConnectionError as conn_err:
             logger.warning(f"Groq API への接続テストに失敗しました (起動時): {conn_err}")
             logger.debug("   ネットワーク接続を確認してください。サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # 詳細情報はDEBUG
        except GroqError as ge:
             logger.warning(f"Groq クライアント初期化中に予期せぬ Groq エラーが発生しました: {ge}")
             logger.debug("   サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # 詳細情報はDEBUG
        except Exception as e:
             logger.warning(f"Groq クライアント初期化中に予期せぬエラーが発生しました: {type(e).__name__} - {e}")
             logger.exception("Groq クライアント初期化中のエラー詳細:")
             logger.debug("   サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # 詳細情報はDEBUG


        logger.info("--- Application Startup Complete ---")

    except RuntimeError as e:
        # 起動シーケンス中の致命的エラー (設定ファイル、APIキー、初期認証)
        logger.error(f"アプリケーションの起動に失敗しました: {e}")
        raise e
    except Exception as e:
        # その他の予期せぬエラー
        logger.error(f"アプリケーションの起動中に予期せぬエラーが発生しました: {type(e).__name__} - {e}")
        logger.exception("予期せぬ起動時エラーの詳細:")
        raise RuntimeError(f"予期せぬ起動時エラー: {e}") from e


# --- Pydantic Models (変更なし) ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    purpose: Optional[str] = "main_chat"
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_completion_tokens: Optional[int] = None

class ToolCallFunction(BaseModel):
    name: str
    arguments: str

class ToolCall(BaseModel):
    type: str = "function"
    function: ToolCallFunction

# ★ ExecutedTool に対応する Pydantic モデルを追加
class ExecutedToolModel(BaseModel):
    arguments: Optional[str] = None # JSON 文字列の場合がある
    index: Optional[int] = None
    type: Optional[str] = None # 'search' など
    output: Optional[str] = None

class ChatResponse(BaseModel):
    content: str
    reasoning: Optional[Any] = None
    tool_calls: Optional[List[ToolCall]] = None
    # ★ executed_tools の型を修正
    executed_tools: Optional[List[ExecutedToolModel]] = None
# ★ モデルリスト取得用のレスポンスモデルを追加
class ModelListResponse(BaseModel):
    models: List[str]

# --- API Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handles chat requests. Uses pre-initialized config and Groq client.
    Selects configuration based on 'purpose'.
    Allows overriding parameters for 'main_chat'.
    """
    global config, groq_client # グローバル変数を参照

    # --- クライアントが初期化されているか確認 (念のため) ---
    if not groq_client:
        logger.error("Groq クライアントが利用できません (初期化に失敗したか、まだ完了していません)。")
        raise HTTPException(status_code=503, detail="Groq クライアントが利用できません。サーバーが正しく起動していない可能性があります。")

    logger.info(f"--- New Request Received (Purpose: {request.purpose}) ---") # リクエスト受信はINFO

    # --- purpose に基づいて設定を選択 ---
    if request.purpose == "main_chat":
        settings_key = "main_chat"
        logger.debug("Using 'main_chat' settings from config.json") # 設定詳細はDEBUG
    else:
        logger.warning(f"不明な purpose '{request.purpose}' が指定されました。'main_chat' 設定を使用します。")
        settings_key = "main_chat"

    # グローバル config から設定を取得
    if settings_key not in config or not isinstance(config[settings_key], dict):
         logger.error(f"設定 '{settings_key}' が見つからないか、無効です。")
         raise HTTPException(status_code=500, detail=f"サーバー設定エラー: '{settings_key}' の設定が見つかりません。")

    current_settings = config[settings_key]

    # --- パラメータの決定 ---
    model_name = current_settings.get("model_name", "llama-3.1-8b-instant")
    temperature = current_settings.get("temperature", 0.7)
    max_tokens = current_settings.get("max_completion_tokens", 1024)
    system_prompt_content = current_settings.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    top_p = current_settings.get("top_p", 0.95)
    stream = current_settings.get("stream", False)
    reasoning_supported_models = config.get("main_chat", {}).get("reasoning_supported_models", [])

    # メインチャットの場合のみリクエストボディで上書き
    if request.purpose == "main_chat":
        logger.debug("Checking for overrides from request body (main_chat only)...") # 詳細情報はDEBUG
        if request.model_name:
            model_name = request.model_name
            logger.debug(f"  - Overriding model_name: {model_name}")
        if request.temperature is not None:
            temperature = request.temperature
            logger.debug(f"  - Overriding temperature: {temperature}")
        if request.max_completion_tokens:
            max_tokens = request.max_completion_tokens
            logger.debug(f"  - Overriding max_completion_tokens: {max_tokens}")

    logger.debug(f"System Prompt (first 100 chars): '{system_prompt_content[:100]}...'") # プロンプト詳細はDEBUG
    logger.info(f"Using Model: {model_name}") # 使用モデルはINFO

    try:
        messages_for_api = []
        if system_prompt_content:
            messages_for_api.append({"role": "system", "content": system_prompt_content})
            logger.debug("Added system prompt.") # システムプロンプト追加はDEBUG

        logger.debug("Processing messages:") # メッセージ処理開始はDEBUG
        import re # 正規表現モジュールをインポート
        for msg in request.messages:
            processed_content = msg.content
            if isinstance(msg.content, str):
                # ファイル添付情報を検索 (例: "[添付ファイル: test.txt (パス: uploads/test.txt)]")
                # この正規表現はフロントエンドの実装と一致させる必要がある
                file_attachment_pattern = r"\[添付ファイル: (.+?) \(パス: (.+?)\)\]"
                attachments = re.findall(file_attachment_pattern, msg.content)
                
                file_contents_for_api = []
                processed_content_without_placeholders = msg.content

                for filename, filepath_str in attachments:
                    filepath = Path(filepath_str)
                    # UPLOAD_DIR からの相対パスであることを確認し、セキュリティのために UPLOAD_DIR 内に限定する
                    # Path(filepath_str) が絶対パスの場合や、UPLOAD_DIR 外を指す場合はエラーとするか、無視する
                    # ここでは UPLOAD_DIR からの相対パスとして扱う (フロントエンドがそのように送信する前提)
                    # 実際には UPLOAD_DIR / Path(filepath_str).name のようにファイル名だけを使う方が安全
                    
                    # より安全なファイルパスの構築 (UPLOAD_DIR を基準とする)
                    # フロントエンドからは saved_path (UPLOAD_DIRからの相対パスまたは絶対パス) が送られてくる
                    # ここでは UPLOAD_DIR と filepath_str (saved_path) を結合するが、
                    # filepath_str が絶対パスの場合はそれが優先される。
                    # セキュリティのため、filepath が UPLOAD_DIR の中にあることを確認する。
                    
                    # フロントエンドは saved_path として UPLOAD_DIR からのフルパスを送ってくる想定
                    # 例: "d:/Users/onisi/Documents/web-app-dev/backend/uploads/filename.txt"
                    # なので、Path(filepath_str) で直接絶対パスとして扱える
                    
                    # ただし、フロントエンドの buildCombinedContent では (パス: ${info.saved_path}) としており、
                    # info.saved_path は /api/upload から返る saved_path (絶対パス)
                    
                    absolute_filepath = Path(filepath_str)

                    # セキュリティチェック: ファイルが UPLOAD_DIR 内にあることを確認
                    if not absolute_filepath.is_file() or not str(absolute_filepath.resolve()).startswith(str(UPLOAD_DIR.resolve())):
                        logger.warning(f"添付ファイルへのアクセスが無効か、許可されていません: {filepath_str}")
                        # 添付ファイル情報を示すプレースホルダーをメッセージから削除 (またはエラーメッセージに置換)
                        placeholder_to_remove = f"[添付ファイル: {filename} (パス: {filepath_str})]"
                        processed_content_without_placeholders = processed_content_without_placeholders.replace(placeholder_to_remove, f"[添付ファイル '{filename}' は処理できませんでした]")
                        continue

                    try:
                        async with aiofiles.open(absolute_filepath, 'r', encoding='utf-8') as f_content:
                            content_text = await f_content.read()
                            file_contents_for_api.append(f"\n--- 添付ファイル: {filename} ---\n{content_text}\n--- 添付ファイル終了: {filename} ---")
                        logger.debug(f"  - Attached file content read: {filename}")
                        # 添付ファイル情報を示すプレースホルダーをメッセージから削除
                        placeholder_to_remove = f"[添付ファイル: {filename} (パス: {filepath_str})]"
                        processed_content_without_placeholders = processed_content_without_placeholders.replace(placeholder_to_remove, "").strip()

                    except FileNotFoundError:
                        logger.error(f"添付ファイルが見つかりません: {absolute_filepath}")
                        placeholder_to_remove = f"[添付ファイル: {filename} (パス: {filepath_str})]"
                        processed_content_without_placeholders = processed_content_without_placeholders.replace(placeholder_to_remove, f"[添付ファイル '{filename}' は見つかりませんでした]")
                    except Exception as e:
                        logger.error(f"添付ファイルの読み込み中にエラー ({absolute_filepath}): {e}")
                        placeholder_to_remove = f"[添付ファイル: {filename} (パス: {filepath_str})]"
                        processed_content_without_placeholders = processed_content_without_placeholders.replace(placeholder_to_remove, f"[添付ファイル '{filename}' の読み込みエラー]")
                
                # 元のメッセージテキストと、読み込んだファイル内容を結合
                final_content_for_api = processed_content_without_placeholders
                if file_contents_for_api:
                    final_content_for_api += "\n" + "\n".join(file_contents_for_api)
                
                messages_for_api.append({"role": msg.role, "content": final_content_for_api.strip()})
                logger.debug(f"  - Role: {msg.role}, Processed Content (first 100 chars): '{final_content_for_api.strip()[:100]}...'")

            else:
                logger.warning(f"Received non-string content (type: {type(msg.content)}). Skipping. Role: {msg.role}")
                pass

        api_params = {
            "messages": messages_for_api,
            "model": model_name,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": stream,
        }
        logger.debug(f"API Parameters (excluding messages): { {k: v for k, v in api_params.items() if k != 'messages'} }") # APIパラメータ詳細はDEBUG

        # Reasoning Format の設定
        if model_name in reasoning_supported_models and settings_key == "main_chat":
            reasoning_format_value = config.get("main_chat", {}).get("reasoning_format", "parsed")
            if reasoning_format_value in ["parsed", "raw", "hidden"]:
                 api_params["reasoning_format"] = reasoning_format_value
                 logger.debug(f"Reasoning Format: {reasoning_format_value}") # Reasoning FormatはDEBUG
            else:
                 api_params["reasoning_format"] = "parsed"
                 logger.warning(f"Invalid reasoning_format ('{reasoning_format_value}') in config. Using 'parsed'.")

        start_time = time.time()

        logger.info("Calling Groq API...") # API呼び出し開始はINFO
        completion = groq_client.chat.completions.create(**api_params)
        end_time = time.time()
        logger.info(f"Groq API call finished in {end_time - start_time:.2f} seconds.") # API呼び出し完了はINFO

        response_message = completion.choices[0].message
        original_reasoning_data = getattr(response_message, 'reasoning', None) # 元の reasoning データを取得 (これはオブジェクトまたは辞書であると想定)
        tool_calls_content = getattr(response_message, 'tool_calls', None)
        raw_executed_tools = getattr(response_message, 'executed_tools', None)

        # reasoning データから各要素を抽出
        reasoning_text = None
        plan_text = None
        criticism_text = None

        if isinstance(original_reasoning_data, dict): # Groqのreasoningが辞書の場合
            thoughts = original_reasoning_data.get("thoughts", {})
            reasoning_text = thoughts.get("reasoning")
            plan_text = thoughts.get("plan")
            criticism_text = thoughts.get("criticism")
        elif hasattr(original_reasoning_data, 'thoughts'): # Groqのreasoningがオブジェクトの場合
            thoughts = getattr(original_reasoning_data, 'thoughts', None)
            if thoughts:
                reasoning_text = getattr(thoughts, 'reasoning', None)
                plan_text = getattr(thoughts, 'plan', None)
                criticism_text = getattr(thoughts, 'criticism', None)
        elif isinstance(original_reasoning_data, str): # 単純な文字列の場合 (フォールバック)
            reasoning_text = original_reasoning_data


        executed_tools_for_response: Optional[List[ExecutedToolModel]] = None
        if raw_executed_tools:
            executed_tools_for_response = []
            for tool in raw_executed_tools:
                try:
                    validated_tool = ExecutedToolModel(
                        arguments=getattr(tool, 'arguments', None),
                        index=getattr(tool, 'index', None),
                        type=getattr(tool, 'type', None),
                        output=getattr(tool, 'output', None)
                    )
                    executed_tools_for_response.append(validated_tool)
                except Exception as validation_error:
                    logger.warning(f"ExecutedTool のバリデーション中にエラー: {validation_error}")

        response_data = ChatResponse(
            content=response_message.content or "",
            reasoning=reasoning_text, # 抽出した reasoning テキスト
            plan=plan_text,           # 抽出した plan テキスト
            criticism=criticism_text, # 抽出した criticism テキスト
            tool_calls=[ToolCall.model_validate(tc.model_dump()) for tc in tool_calls_content] if tool_calls_content else None,
            executed_tools=executed_tools_for_response
        )

        logger.info("--- Response Sent ---") # レスポンス送信はINFO
        return response_data

    # --- エラーハンドリング (リクエスト処理中のエラー) ---
    except AuthenticationError as e:
        logger.error(f"Groq API 認証エラー (runtime): {e}")
        raise HTTPException(status_code=401, detail="Groq API 認証エラー: API キーを確認してください。")
    except RateLimitError as e:
        logger.error(f"レート制限に達しました: {e}")
        raise HTTPException(status_code=429, detail="Groq API のレート制限に達しました。しばらく待ってから再試行してください。")
    except APIConnectionError as e:
        logger.error(f"Groq API 接続エラー: {e}")
        raise HTTPException(status_code=503, detail="Groq API 接続エラー: ネットワークまたはGroqサービスを確認してください。")
    except BadRequestError as e:
        error_details = str(e)
        error_response = getattr(e, 'response', None)
        if error_response:
            try:
                error_body = error_response.json()
                error_details = error_body.get('error', {}).get('message', str(e))
            except Exception:
                pass # エラーメッセージ抽出失敗時は元のエラーメッセージを使用
        logger.error(f"Groq BadRequestError details: {error_details}")
        raise HTTPException(status_code=400, detail=f"リクエストエラー: {error_details}")
    except GroqError as e:
        logger.error(f"Groq API エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API エラー: {str(e)}")
    except HTTPException as e:
        raise e # FastAPI が投げる HTTPException はそのまま再送出
    except Exception as e:
        logger.error(f"予期せぬサーバーエラーが発生しました: {type(e).__name__}")
        logger.exception("予期せぬサーバーエラーの詳細:")
        raise HTTPException(status_code=500, detail=f"予期せぬサーバーエラーが発生しました。")

# ★ 新しいエンドポイント: 利用可能なモデルリストを取得
@app.get("/api/models", response_model=ModelListResponse)
async def get_available_models():
    """
    設定ファイルから利用可能なモデルIDのリストを返します。
    """
    global config # グローバル設定を参照
    try:
        # config.json の main_chat セクションから available_model_ids を取得
        # 見つからない場合は空リストをデフォルトとする
        model_ids = config.get("main_chat", {}).get("available_model_ids", [])

        if not model_ids:
             logger.warning("設定ファイルに利用可能なモデルIDリスト ('main_chat.available_model_ids') が見つからないか空です。")
             # フォールバックとしてデフォルトモデルのみを含むリストを返すことも検討可能
             default_model = config.get("main_chat", {}).get("model_name")
             if default_model:
                 logger.info(f"フォールバックとしてデフォルトモデル '{default_model}' を返します。") # フォールバック動作はINFO
                 model_ids = [default_model] # デフォルトモデルのみ返す

        logger.debug(f"利用可能なモデルリストを返します: {model_ids}") # 返すリスト詳細はDEBUG
        return ModelListResponse(models=model_ids)
    except Exception as e:
        logger.error(f"利用可能なモデルリストの取得中にエラーが発生しました: {e}")
        logger.exception("モデルリスト取得エラーの詳細:")
        # エラーが発生した場合、空リストを返すか、500エラーを返すか選択
        # ここでは空リストを返すことで、フロントエンドが「利用可能なモデルなし」と表示できるようにする
        return ModelListResponse(models=[])
        # または raise HTTPException(status_code=500, detail="Failed to retrieve available models.")

# --- File Upload Endpoint ---
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Handles single file uploads.
    Saves the file to the UPLOAD_DIR using pathlib and aiofiles.
    Applies validation for file size and type based on config.json.
    """
    global config # グローバル設定を参照
    upload_settings = config.get("file_upload", {})
    max_size_mb = upload_settings.get("max_size_mb", 10) # デフォルト10MB
    allowed_types = upload_settings.get("allowed_types", []) # デフォルト空リスト (全て許可しない)
    
    # ファイルサイズのバリデーション
    # UploadFile.size は FastAPI 0.100.0 以降で利用可能。それ以前は file.file.seek(0, 2) などで取得。
    # ここでは FastAPI が比較的新しいバージョンであることを期待。
    # もし古い場合は、content = await file.read() の後に len(content) でチェックする。
    # ただし、大きなファイルをメモリに読み込むことになるため、ストリーミング処理が望ましい。
    # ここでは簡潔さのため、まず全体を読み込んでからサイズチェックを行う。
    
    content = await file.read() # 先に内容を読み込む
    file_size_bytes = len(content)
    max_size_bytes = max_size_mb * 1024 * 1024

    if file_size_bytes > max_size_bytes:
        logger.warning(f"ファイルサイズ超過: {file.filename} ({file_size_bytes} bytes > {max_size_bytes} bytes)")
        raise HTTPException(
            status_code=413, # Payload Too Large
            detail=f"ファイルサイズが大きすぎます。最大 {max_size_mb}MB までです。"
        )

    # ファイルタイプのバリデーション
    if allowed_types and file.content_type not in allowed_types:
        logger.warning(f"許可されないファイルタイプ: {file.filename} ({file.content_type})")
        raise HTTPException(
            status_code=415, # Unsupported Media Type
            detail=f"許可されていないファイルタイプです。許可されているタイプ: {', '.join(allowed_types)}"
        )

    try:
        # UPLOAD_DIR は config からも取得できるようにする (オプション)
        # upload_dir_name = upload_settings.get("upload_dir", "uploads")
        # current_upload_dir = Path(__file__).parent / upload_dir_name
        # current_upload_dir.mkdir(exist_ok=True)
        # file_path = current_upload_dir / file.filename
        # 上記は UPLOAD_DIR がグローバル定数として定義されているため、ここでは UPLOAD_DIR を直接使用

        file_path = UPLOAD_DIR / file.filename
        
        # ファイル名が衝突する場合の処理 (例: タイムスタンプを付与)
        # ここでは単純に上書きするが、必要に応じて変更
        # count = 0
        # original_stem = file_path.stem
        # original_suffix = file_path.suffix
        # while file_path.exists():
        #     count += 1
        #     file_path = UPLOAD_DIR / f"{original_stem}_{count}{original_suffix}"

        async with aiofiles.open(file_path, 'wb') as buffer:
            # content は既に読み込み済みなので、それを書き込む
            await buffer.write(content)
            
        logger.info(f"ファイルがアップロードされました: {file.filename} -> {file_path}")
        return {"filename": file.filename, "saved_path": str(file_path), "message": "ファイルが正常にアップロードされました。"}
    except Exception as e:
        logger.error(f"ファイルアップロード中にエラーが発生しました ({file.filename}): {e}")
        logger.exception("ファイルアップロードエラーの詳細:")
        raise HTTPException(status_code=500, detail=f"ファイルアップロード中にエラーが発生しました: {e}")

# --- File Management Utilities (using pathlib) ---
def cleanup_old_uploads(days: int = 7):
    """
    指定された日数より古いアップロードファイルを削除します。
    この関数は同期的に動作するため、バックグラウンドタスクで実行することを推奨します。
    """
    global config
    upload_settings = config.get("file_upload", {})
    # UPLOAD_DIR はグローバル定数を使用
    # upload_dir_name = upload_settings.get("upload_dir", "uploads")
    # current_upload_dir = Path(__file__).parent / upload_dir_name
    
    if not UPLOAD_DIR.exists():
        logger.info(f"アップロードディレクトリ {UPLOAD_DIR} が存在しないため、クリーンアップをスキップします。")
        return

    cutoff_time = time.time() - (days * 86400) # days を秒に変換
    cleaned_files_count = 0
    cleaned_dirs_count = 0

    logger.info(f"{days}日以上古いファイルのクリーンアップを開始します ({UPLOAD_DIR})...")
    try:
        for item in UPLOAD_DIR.iterdir(): # UPLOAD_DIR 直下のアイテムをイテレート
            try:
                item_stat = item.stat()
                if item_stat.st_mtime < cutoff_time:
                    if item.is_file():
                        item.unlink()
                        logger.debug(f"古いファイルを削除しました: {item}")
                        cleaned_files_count += 1
                    elif item.is_dir():
                        # shutil.rmtree は同期的なので、非同期コンテキストで使う場合は注意
                        # ここでは同期関数内なので問題ない
                        import shutil # ここでインポート
                        shutil.rmtree(item)
                        logger.debug(f"古いディレクトリを削除しました: {item}")
                        cleaned_dirs_count += 1
            except FileNotFoundError:
                logger.warning(f"クリーンアップ中にファイルが見つかりませんでした (おそらく並行して削除された): {item}")
            except Exception as e:
                logger.error(f"ファイル/ディレクトリ ({item}) のクリーンアップ中にエラー: {e}")
        logger.info(f"クリーンアップ完了。削除されたファイル数: {cleaned_files_count}, 削除されたディレクトリ数: {cleaned_dirs_count}")
    except Exception as e:
        logger.error(f"アップロードディレクトリ ({UPLOAD_DIR}) のイテレーション中にエラー: {e}")

# BackgroundTasks に追加する例 (FastAPI の BackgroundTasks を利用)
# async def some_request_handler(background_tasks: BackgroundTasks):
#     # ... 他の処理 ...
#     background_tasks.add_task(cleanup_old_uploads, days=7)
#     return {"message": "Cleanup task added to background"}


# --- Root Endpoint (変更なし) ---
@app.get("/")
async def root():
    """ Health check endpoint """
    status = "running"
    details = "FastAPI backend for Groq Chat is running."
    if not groq_client:
        status = "degraded"
        details = "FastAPI backend is running, but Groq client initialization failed or is pending."
    return {"status": status, "message": details}

# --- Server Execution (変更なし) ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload_flag = os.getenv("RELOAD", "true").lower() == "true"

    # --- Logging Configuration for __main__ ---
    # 環境変数 LOG_LEVEL からログレベルを取得、デフォルトは INFO
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # ルートロガーから NullHandler を削除 (もしあれば)
    # この段階でハンドラを再設定するため、NullHandler は不要
    for handler in logging.getLogger().handlers:
        if isinstance(handler, logging.NullHandler):
            logging.getLogger().removeHandler(handler)
            
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True # 他のライブラリによって設定されていても上書き
    )
    # --- End Logging Configuration ---

    logger.info(f"バックエンドサーバーを http://{host}:{port} で起動します...")
    logger.info(f"ログレベル: {logging.getLevelName(logger.getEffectiveLevel())}")
    logger.info(f"リロード: {'有効' if reload_flag else '無効'}")
    logger.info(f"フロントエンドオリジン許可: {frontend_origins}")


    # Uvicorn をプログラム的に起動
    # access_log=False は指定しない (アクセスログは残す)
    uvicorn.run(
        "main:app", # アプリケーションの場所
        host=host,
        port=port,
        reload=reload_flag,
        log_config=None # Uvicorn のデフォルトロガー設定を無効化し、FastAPI/カスタムロガーに委ねる
    )
