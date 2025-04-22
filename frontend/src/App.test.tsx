import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App.jsx'; // テスト対象は App.jsx
// import '@testing-library/jest-dom'; // setupTests.ts に書くのが推奨

test('renders chat bot header', () => { // テストの説明を修正
  render(<App />);
  // "Groq チャットボット" というテキストを持つ要素を探す (大文字小文字区別なし)
  const headerElement = screen.getByText(/Groq チャットボット/i);
  expect(headerElement).toBeInTheDocument(); // 要素が存在することを確認
});

// 他にも、入力欄や送信ボタンが存在するかのテストを追加することもできます
test('renders input field and send button', () => {
  render(<App />);
  const inputElement = screen.getByPlaceholderText(/メッセージを入力/i);
  const sendButton = screen.getByRole('button', { name: /送信/i }); // aria-label を利用

  expect(inputElement).toBeInTheDocument();
  expect(sendButton).toBeInTheDocument();
});
