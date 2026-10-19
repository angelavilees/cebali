import { useEffect, useState } from "react";
import MobileApp from "./MobileApp";

export default function App() {
  const [readingMode, setReadingMode] = useState(false);
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "app" || size.width <= 600) return <MobileApp />;
  const scale = Math.max(
    0.1,
    Math.min((size.width - 40) / 393, (size.height - 40) / 800, 1.15),
  );
  const appUrl = new URL(window.location.href);
  appUrl.searchParams.set("view", "app");
  return (
    <main className={`preview${readingMode ? ' is-reading' : ''}`}>
      <button className="preview-reading-toggle" aria-pressed={readingMode} onClick={() => setReadingMode(!readingMode)}>{readingMode ? 'Volver al teléfono' : 'Ampliar lectura'}</button>
      <div
        className="phone-size"
        style={readingMode ? { width: Math.min(size.width - 32, 560), height: Math.max(240, size.height - 92) } : { width: 393 * scale, height: 800 * scale }}
      >
        <div className="phone" style={{ transform: readingMode ? 'none' : `scale(${scale})` }}>
          <iframe
            className="phone-screen"
            src={appUrl.toString()}
            title="Aplicación Cebali"
          />
          <img
            className="phone-overlay"
            src={`${import.meta.env.BASE_URL}phone-frame.png`}
            alt=""
            draggable={false}
          />
        </div>
      </div>
    </main>
  );
}
