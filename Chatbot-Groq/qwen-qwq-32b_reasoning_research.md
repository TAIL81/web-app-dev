# qwen-qwq-32b モデルと Reasoning Format に関する調査結果

*調査日: 2025-04-13*
*情報源: https://console.groq.com/docs/reasoning*

## 結論

- `qwen-qwq-32b` は Groq API において Reasoning 機能がサポートされているモデルの一つです。
- Reasoning の出力形式は `reasoning_format` パラメータで制御可能です。

## 詳細

### 対応モデル

以下のモデルが Reasoning に対応しています（ドキュメント記載時点）:
- `qwen-qwq-32b`
- `deepseek-r1-distill-qwen-32b`
- `deepseek-r1-distill-llama-70b`

### `reasoning_format` パラメータ

APIリクエスト時に `reasoning_format` パラメータを指定することで、モデルの思考プロセス（Reasoning）の出力形式を選択できます。

- **`parsed`**:
  - Reasoning部分をレスポンスJSON内の独立した `reasoning` フィールドに出力します。
  - レスポンスの `content` フィールドは最終的な回答のみとなり、簡潔になります。
- **`raw`** (デフォルト):
  - Reasoning部分を `<think>...</think>` タグで囲み、レスポンスの `content` フィールド内に直接含めて出力します。
- **`hidden`**:
  - Reasoning部分をレスポンスに含めず、最終的な回答のみを返します。

### 注意事項

- **JSONモード / Tool Use との併用:**
  - `json_mode` を有効にする場合や、`tools` パラメータで関数呼び出しなどを行う場合、`reasoning_format` に `raw` を指定することはできません。
  - これらのモードでは、`reasoning_format` は自動的に `parsed` または `hidden` として扱われます。
  - もし `raw` を明示的に指定してこれらのモードを使用すると、APIは400エラーを返します。

### プロンプトエンジニアリング（参考: DeepSeek-R1）

- システムプロンプトは避け、全ての指示をユーザーメッセージに含めることが推奨されます (DeepSeek-R1の場合。QwQ-32Bも同様の可能性あり)。
- Few-shotプロンプト（例を示すこと）は避け、Zero-shotプロンプト（例を示さないこと）のみを使用することが推奨されます (DeepSeek-R1の場合。QwQ-32Bも同様の可能性あり)。

## QwQ-32B 固有のベストプラクティス (2025-04-13時点)

*情報源: https://console.groq.com/docs/model/qwen-qwq-32b*

- **`reasoning_format` は `parsed` を推奨:**
  - QwQ-32Bの出力では、最初の `<think>` タグが欠落する場合があるため、`parsed` を使用することでこの問題を回避できます。
- **会話履歴の扱い:**
  - 複数ターンの会話では、過去の応答の思考内容（`<think>`タグの中身など）は履歴に含めず、最終的な回答 (`content`) のみを含めるようにします。
- **プロンプトでの指示:**
  - モデルは詳細なReasoningを出力する傾向があるため、必要に応じて簡潔な回答を求めるプロンプトを追加します。
  - Reasoning中に中国語の文字が出力されることがあるため、もしそれが問題となる場合は、中国語を避けるようにプロンプトで指示します。
- **パラメータ調整:**
  - `temperature=0.6`, `top_p=0.95` が推奨されます（繰り返しや幻覚を防ぐため）。
  - Reasoningが途中で切れないように、`max_completion_tokens` を十分に大きな値に設定します。
- **Tool Use:**
  - Tool Use（関数呼び出し）の能力が強力であるため、エージェント的なアプリケーションでの活用が推奨されます。
- **トラブルシューティング:**
  - 思考プロセスのみが出力され最終的な回答がない場合は、簡潔さを求めるプロンプトを試すか、クエリを再実行します。
