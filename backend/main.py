# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
import sys
# import signal # signal モジュールをインポート # 未使用のため削除
import logging # logging モジュールをインポート
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

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
        for msg in request.messages: # main_chat の場合のみ実行される (他の purpose は現状ない)
                if isinstance(msg.content, str):
                    messages_for_api.append({"role": msg.role, "content": msg.content})
                    logger.debug(f"  - Role: {msg.role}, Content (first 100 chars): '{msg.content[:100]}...'")
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
