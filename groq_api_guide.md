# Groq API 100%使いこなしパーフェクトガイド

このガイドは、Groq APIを最大限に活用するための詳細な情報を提供することを目的としています。特に、高速推論の利点、利用可能なモデル、主要な機能、そして新しく追加された`compound-beta-mini`モデルに焦点を当てます。共同開発者の皆様がGroq APIの強力な機能を理解し、チャットボット開発に役立てるための一助となれば幸いです。

## 1. はじめに

Groq APIは、革新的なLPU™（Language Processing Unit）を活用した、非常に高速な言語モデル推論サービスです。従来のGPUベースのシステムと比較して、圧倒的な低レイテンシと高スループットを実現します。この高速性は、リアルタイム対話、複雑な推論チェーン、エージェント的なワークフローなど、多くのアプリケーションで重要な利点となります。

このガイドでは、Groq APIの基本的な使い方から、最新モデル`compound-beta-mini`を含む利用可能なモデル、そしてテキスト生成、推論、ビジョン、ツール利用といった主要機能までを網羅的に解説します。

## 2. Groq APIの基本

### APIキーの取得と認証

Groq APIを利用するには、まずGroq CloudコンソールでAPIキーを取得する必要があります。APIキーはアカウント設定の「Keys」ページで見つけることができます。

APIリクエストを行う際には、取得したAPIキーを認証情報として含める必要があります。通常、HTTPヘッダーの`Authorization`フィールドに`Bearer YOUR_GROQ_API_KEY`の形式で指定します。

### OpenAI互換性について

Groq APIは、OpenAIのクライアントライブラリとの高い互換性を持つように設計されています。これにより、既存のOpenAI APIを使用しているアプリケーションを容易にGroq APIに切り替えて、その高速性を試すことができます。

**OpenAIクライアントライブラリでの設定方法:**

OpenAIのPythonまたはJavaScriptライブラリを使用する場合、`api_key`パラメータにGroq APIキーを渡し、`base_url`を`https://api.groq.com/openai/v1`に変更するだけで利用できます。

```python
import os
import openai

client = openai.OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ.get("GROQ_API_KEY")
)
```

**現在非サポートの機能:**

OpenAI互換性は高いですが、一部の機能は現在サポートされていません。これには、テキスト補完における`logprobs`, `logit_bias`, `top_logprobs`, `messages[].name`、および`N`が1以外の場合、Temperature値が0の場合（`1e-8`に変換されます）、オーディオ転写・翻訳における`vtt`, `srt`形式などが含まれます。

### Groq SDKの利用

Groqは独自のPythonおよびTypeScriptライブラリも提供しており、これらを使用することが推奨されています。

**Pythonでの基本的なChat Completion例:**

```python
from groq import Groq

client = Groq()

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "あなたは親切なアシスタントです。"
        },
        {
            "role": "user",
            "content": "高速言語モデルの重要性について説明してください。",
        }
    ],
    model="llama-3.3-70b-versatile",
    temperature=0.5,
    max_completion_tokens=1024,
    top_p=1,
    stop=None,
    stream=False,
)

print(chat_completion.choices[0].message.content)
```

ストリーミングや非同期処理もサポートされています。詳細はGroqの公式ドキュメントを参照してください。

## 3. 利用可能なモデル

GroqCloudでは、様々な特性を持つモデルが提供されています。これらは「プロダクションモデル」、「プレビューモデル」、「プレビューシステム」に分類されます。

### モデルの種類

*   **プロダクションモデル:** 本番環境での使用を想定しており、速度、品質、信頼性の高い基準を満たしています。
*   **プレビューモデル:** 評価目的でのみ使用し、予告なく提供が終了する可能性があります。
*   **プレビューシステム:** 複数のモデルやツールを組み合わせてユーザーのクエリに回答するシステムです。

### 主要モデルの紹介

Groqで利用可能なモデルの一部を紹介します（2025年4月時点の情報に基づきます）。

| MODEL ID                                       | DEVELOPER   | CONTEXT WINDOW (TOKENS) | MAX COMPLETION TOKENS | 特徴                                                                 |
| :--------------------------------------------- | :---------- | :---------------------- | :-------------------- | :------------------------------------------------------------------- |
| `gemma2-9b-it`                                 | Google      | 8,192                   | -                     | テキスト生成                                                         |
| `llama-3.3-70b-versatile`                      | Meta        | 128K                    | 32,768                | 多言語対応、高度な言語理解、コード生成、問題解決、Tool Use, JSON Mode |
| `llama-3.1-8b-instant`                         | Meta        | 128K                    | 8,192                 | テキスト生成、Tool Use, JSON Mode                                    |
| `llama-guard-3-8b`                             | Meta        | 8,192                   | -                     | コンテンツモデレーション                                             |
| `llama3-70b-8192`                              | Meta        | 8,192                   | -                     | テキスト生成                                                         |
| `llama3-8b-8192`                               | Meta        | 8,192                   | -                     | テキスト生成                                                         |
| `whisper-large-v3`                             | OpenAI      | -                       | -                     | 音声認識 (Speech to Text)                                            |
| `whisper-large-v3-turbo`                       | OpenAI      | -                       | -                     | 音声認識 (Speech to Text)                                            |
| `distil-whisper-large-v3-en`                   | HuggingFace | -                       | -                     | 音声認識 (Speech to Text)                                            |
| `allam-2-7b`                                   | SDAIA       | 4,096                   | -                     | テキスト生成                                                         |
| `deepseek-r1-distill-llama-70b`                | DeepSeek    | 128K                    | -                     | Reasoning                                                            |
| `meta-llama/llama-4-maverick-17b-128e-instruct`| Meta        | 131,072                 | 8192                  | マルチモーダル、Vision、Agentic Tooling、Tool Use, JSON Mode         |
| `meta-llama/llama-4-scout-17b-16e-instruct`    | Meta        | 131,072                 | 8192                  | マルチモーダル、Vision、Agentic Tooling、Tool Use, JSON Mode         |
| `mistral-saba-24b`                             | Mistral     | 32K                     | -                     | テキスト生成                                                         |
| `playai-tts`                                   | Playht, Inc | 10K                     | -                     | テキスト読み上げ (Text to Speech)                                    |
| `playai-tts-arabic`                            | Playht, Inc | 10K                     | -                     | テキスト読み上げ (Text to Speech) (アラビア語)                       |
| `qwen-qwq-32b`                                 | Alibaba Cloud| 128K                    | -                     | Reasoning, Tool Use, JSON Mode                                       |

### 新モデル: `compound-beta-mini`

`compound-beta-mini`は、Groqが提供する新しい「プレビューシステム」です。これは単なる言語モデルではなく、外部ツール（Web検索やコード実行）をインテリジェントに利用してユーザーのクエリに回答するAgentic Toolingシステムです。

**特徴:**

*   **Agentic Tooling:** 組み込みツール（Web検索、コード実行）を自律的に判断して使用します。
*   **単一ツール呼び出し:** `compound-beta`とは異なり、一度のリクエストで単一のツール呼び出しのみをサポートします。これにより、`compound-beta`よりも平均で3倍低いレイテンシを実現しています。
*   **低レイテンシ:** GroqのLPUによる高速推論と単一ツール呼び出しの特性により、非常に高速な応答が可能です。
*   **基盤モデル:** コアとなる推論には`Llama 4 Scout`を、ルーティングやツール利用の判断には`Llama 3.3 70B`を活用しています。
*   **RealtimeEvalベンチマーク:** 最新のイベントやライブデータに関する検索能力を測るRealtimeEvalベンチマークで、GPT-4oの検索プレビューモデルを大きく上回るパフォーマンスを示しています。

**Reasoningモデルとの関連性:**

`compound-beta-mini`は、ユーザーからのクエリに対して、内部的に「思考プロセス」としてどのツールを使用すべきかを判断し、その結果に基づいて「ユーザーへの回答」を生成します。このプロセスは、Reasoningモデルがステップバイステップの分析を行うのと似ており、モデルがどのように回答を導き出したかを理解する上で重要な側面です。特に、Web検索やコード実行といった外部情報を取り込むことで、より正確で最新の情報に基づいた回答が可能になります。

**ユースケース:**

*   **リアルタイムWeb検索:** 最新ニュース、株価、天気予報など、リアルタイム情報が必要なクエリに対して、組み込みのWeb検索ツール（Tavily利用）を自動的に使用して回答します。
*   **コード実行:** 簡単な計算やデータ操作、Pythonコードの実行を自然言語で行えます（E2B利用）。
*   **コード生成と技術タスク:** コード生成、デバッグ支援、技術的な問題解決に活用できます。

**利用上のベストプラクティス:**

*   **システムプロンプトの活用:** システムプロンプトを使用することで、モデルの振る舞いをより制御し、不適切な応答（false refusals）を減らすことができます。
*   **システムレベルの保護:** Llama Guardのようなシステムレベルの保護（入力フィルタリング、応答検証）を実装することを検討してください。
*   **安全対策:** 特定の専門分野や機密性の高いコンテンツを扱う場合は、適切な安全対策を講じてください。

### Llama 4 Scout 17B 16E Instruct

Metaのマルチモーダルモデルで、テキストと画像の理解が可能です。170億パラメータのMixture-of-Experts (MoE) アーキテクチャ（16エキスパート）を持ち、マルチモーダルタスクで高い性能を発揮します。

**特徴:**

*   **マルチモーダル:** テキストと画像の両方を入力として処理できます。
*   **Vision:** 画像認識、画像に関する推論、キャプション生成、OCRなどが可能です。
*   **Tool Use & JSON Mode:** カスタムツールの利用やJSON形式での出力に対応しています。
*   **長文コンテキスト:** 10Mトークン（プレビューでは128Kに制限）のコンテキストウィンドウを持ち、長文の理解や対話履歴の維持に優れています。
*   **多言語対応:** 12言語をサポートします。

**ユースケース:**

*   マルチモーダルアシスタント、コード生成、長文コンテキストを必要とするアプリケーションなど。

### Qwen QwQ 32B (参考情報)

Alibaba Cloudが開発したモデルで、Groq APIではReasoning機能に対応しています。

**Reasoningモデルとしての利用:**

Reasoningモデルは、ステップバイステップの分析、論理的推論、構造化された思考を必要とする複雑な問題解決タスクに優れています。Groqの高速推論により、これらのモデルはリアルタイムでの推論能力を提供します。

`reasoning_format`パラメータを使用することで、モデルの思考プロセスをどのように出力に含めるかを制御できます。

*   `parsed`: Reasoningを独立したフィールドに出力。
*   `raw` (デフォルト): Reasoningを`<think>...</think>`タグで囲んでコンテンツに含める。
*   `hidden`: Reasoningを出力に含めない。

**注意点:** JSONモードやTool Useと`raw`形式は併用できません。

## 4. 主要機能の詳細

### テキスト/チャット補完

ユーザーからのメッセージに基づいてテキストを生成する基本的な機能です。システムメッセージ、ユーザーメッセージ、アシスタントメッセージのやり取りを通じて対話を行います。

*   **JSONモード:** レスポンスを有効なJSON形式にすることを保証します。`response_format: {"type": "json_object"}`を設定し、システムプロンプトでJSON構造を記述します。
*   **Streaming:** レスポンスを逐次受け取ることができます。`stream=True`を設定します。
*   **Stop Sequence:** 特定の文字列が出力されたら生成を停止するように設定できます。
*   **Async処理:** 非同期でのAPI呼び出しが可能です。

### Reasoning

Reasoningモデル（`qwen-qwq-32b`, `deepseek-r1-distill-llama-70b`など）は、複雑な問題に対して段階的な思考プロセスを経て回答を生成します。

*   **`reasoning_format`の活用:** モデルの思考プロセスを可視化することで、デバッグやモデルの判断過程の理解に役立ちます。
*   **パフォーマンス最適化:** Temperatureを0.5-0.7の範囲に設定し、`max_completion_tokens`をタスクの複雑さに応じて調整することが推奨されます。DeepSeek-R1では、システムプロンプトを避け、全ての指示をユーザーメッセージに含めることが推奨されています。

### Vision

`meta-llama/llama-4-scout-17b-16e-instruct`や`meta-llama/llama-4-maverick-17b-128e-instruct`のようなマルチモーダルモデルで利用可能な機能です。画像を入力として与え、画像の内容に関する質問応答やキャプション生成などを行います。

*   **画像入力方法:** 画像はURLまたはBase64エンコードされた文字列として入力できます。
*   **他の機能との連携:** Vision対応モデルはTool Use、JSON Mode、Multi-turn会話もサポートしており、画像の内容に基づいてツールを使用したり、構造化された情報を抽出したり、画像について継続的な対話を行ったりすることが可能です。
*   **ユースケース:** アクセシビリティアプリケーション（画像の説明生成）、Eコマースの商品説明生成、多言語画像分析など。

### Agentic Tooling

`compound-beta`および`compound-beta-mini`システムで提供される機能です。モデル自身がユーザーのクエリを解釈し、必要に応じて組み込みツール（Web検索、コード実行）を呼び出して回答を生成します。

*   **compound-beta vs compound-beta-mini:** `compound-beta`は複数ツールの並列呼び出しをサポートするのに対し、`compound-beta-mini`は単一ツール呼び出しに特化しており、低レイテンシが特徴です。
*   **組み込みツール:**
    *   **Web Search (Tavily):** 最新情報が必要な場合に自動的にWeb検索を行います。
    *   **Code Execution (E2B):** Pythonコードの実行をサポートします。
*   **活用方法:** リアルタイム情報の取得、計算、コードのデバッグ支援などに役立ちます。

### Tool Use（カスタムツール）

Groq APIでは、ユーザーが独自のツール（関数や外部APIなど）を定義し、モデルに提供することで、モデルがそのツールを呼び出して特定のタスクを実行できるようになります。これはOpenAIのTool Use機能と互換性があります。

*   **仕組み:**
    1.  APIリクエストにツールの定義を含めます。
    2.  モデルはユーザーのクエリとツールの定義を評価し、ツールが必要かどうかを判断します。
    3.  ツールが必要な場合、モデルはツール呼び出しに必要な引数を含むレスポンスを生成します。
    4.  アプリケーション側でモデルからのツール呼び出し情報を受け取り、実際のツールコードを実行します。
    5.  ツール実行結果をモデルにフィードバックとして渡し、モデルはそれに基づいて最終的な回答を生成します。
*   **対応モデル:** `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `meta-llama/llama-4-scout-17b-16e-instruct`, `meta-llama/llama-4-maverick-17b-128e-instruct`, `qwen-qwq-32b`, `deepseek-r1-distill-llama-70b`などがTool Useをサポートしています。
*   **ツールの定義:** ツールの`name`, `description`, `parameters`（JSON Schema形式）を定義します。
*   **Tool Call Response:** モデルがツールを呼び出すと、レスポンスに`tool_calls`オブジェクトが含まれます。
*   **Routing System:** ユーザーのクエリ内容に応じて、Tool Useモデルと汎用モデルを使い分けるルーティングシステムを実装することが推奨されます。
*   **Parallel Tool Use:** 複数のツールを同時に呼び出すことが可能です。
*   **Structured Outputs (Instructorライブラリ):** Instructorライブラリを使用すると、モデルの出力がPydanticモデルなどの定義済みスキーマに厳密に従うように強制でき、Tool Useのパラメータ抽出などをより安全かつ容易に行えます。
*   **Streaming Tool Use:** ツール呼び出しの結果をストリーミングで受け取ることができます。
*   **ベストプラクティス:** 詳細なツール説明を提供する、Instructorライブラリを使用する、Tool Useに特化したモデル（Llama 3.3 70B Versatileなど）を使用する、ルーティングシステムを実装する、エラーハンドリングを行うなどが挙げられます。

## 5. レート制限

Groq APIには、サービスの安定性、公平なアクセス、および悪用からの保護を目的としたレート制限があります。レート制限は組織レベルで適用され、以下の指標で測定されます。

*   **RPM:** Requests per minute (1分あたりのリクエスト数)
*   **RPD:** Requests per day (1日あたりのリクエスト数)
*   **TPM:** Tokens per minute (1分あたりのトークン数)
*   **TPD:** Tokens per day (1日あたりのトークン数)
*   **ASH:** Audio seconds per hour (1時間あたりのオーディオ秒数)
*   **ASD:** Audio seconds per day (1日あたりのオーディオ秒数)

Free TierおよびDeveloper Tierにおけるモデルごとの具体的な制限値は、Groq Cloudコンソールの「Limits」ページで確認できます。例えば、`compound-beta-mini`はFree TierでRPM 15、RPD 200、TPM 70,000の制限があります。

APIレスポンスヘッダーには、`x-ratelimit-limit-requests` (RPD), `x-ratelimit-limit-tokens` (TPM), `x-ratelimit-remaining-requests` (RPDの残り), `x-ratelimit-remaining-tokens` (TPMの残り), `x-ratelimit-reset-requests` (RPDのリセットまでの時間), `x-ratelimit-reset-tokens` (TPMのリセットまでの時間) といったレート制限情報が含まれます。

レート制限を超過すると、APIは`429 Too Many Requests`のHTTPステータスコードを返します。この際、`retry-after`ヘッダーに再試行までの秒数が含まれる場合があります。

## 6. まとめ

Groq APIは、その驚異的な高速性により、これまでのLLMアプリケーションでは難しかったリアルタイムでの高度な機能を実現します。テキスト生成、複雑な推論、画像理解、そしてAgentic ToolingやカスタムTool Useといった強力な機能を活用することで、よりインテリジェントで応答性の高いチャットボットやアプリケーションを開発することが可能です。

特に`compound-beta-mini`のような新しいシステムは、組み込みツールを自律的に使用することで開発の手間を省きつつ、最新情報に基づいた回答やコード実行能力を提供します。

このガイドが、皆様がGroq APIの可能性を最大限に引き出し、「Groq API 100%使いこなし」を実現するための一助となれば幸いです。公式ドキュメントやGroq API Cookbookなども参考に、ぜひ様々な機能を試してみてください。
