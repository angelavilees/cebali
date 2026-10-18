import { useEffect, useState } from "react";
import MobileApp from "./MobileApp";

export default function App() {
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
    <main className="preview">
      <div
        className="phone-size"
        style={{ width: 393 * scale, height: 800 * scale }}
      >
        <div className="phone" style={{ transform: `scale(${scale})` }}>
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
