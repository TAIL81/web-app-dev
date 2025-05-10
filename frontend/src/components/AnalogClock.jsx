import React, { useEffect, useRef } from 'react'; // useState を削除
import './AnalogClock.css';

const AnalogClock = ({ isDarkMode, toggleDarkMode }) => { // props を受け取る
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const secRef = useRef(null);
  const containerRef = useRef(null);

  const setClock = () => {
    const day = new Date();
    const hh = day.getHours() * 30;
    const mm = day.getMinutes() * 6; // deg = 6
    const ss = day.getSeconds() * 6; // deg = 6

    if (hourRef.current) {
      hourRef.current.style.transform = `rotateZ(${hh + mm / 12}deg)`;
    }
    if (minRef.current) {
      minRef.current.style.transform = `rotateZ(${mm}deg)`;
    }
    if (secRef.current) {
      secRef.current.style.transform = `rotateZ(${ss}deg)`;
    }
  };

  useEffect(() => {
    setClock(); // 初期描画
    const intervalId = setInterval(setClock, 1000); // 1秒ごとに更新

    return () => clearInterval(intervalId); // クリーンアップ
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const currentTheme = isDarkMode ? 'dark' : 'light';
      // containerRef.current.setAttribute('data-theme', currentTheme); // 一時的にコメントアウトして影響を確認
      // CSS変数の設定は AnalogClock.css で行うため、ここでは style.setProperty を削除
    }
  }, [isDarkMode]); // isDarkMode に依存

  return (
    <div className="analog-clock-container" ref={containerRef}> {/* data-theme属性を削除 */}
      {/* <div className="page-header">Analog Clock</div> */}
      <div className="clock">
        <div className="hour" ref={hourRef}></div>
        <div className="min" ref={minRef}></div>
        <div className="sec" ref={secRef}></div>
      </div>
      {/* テーマ切り替えボタンは削除
      <div className="switch-cont">
        <button className="switch-btn" onClick={toggleDarkMode}>
          {isDarkMode ? 'Light' : 'Dark'}
        </button>
      </div>
      */}
    </div>
  );
}

export default AnalogClock;
