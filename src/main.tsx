import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a deploy, hashed chunk filenames change. A tab still open on the old
// build fails to load lazy chunks (404) — reload once to pick up the new build.
window.addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem("chunk-reload-at") ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem("chunk-reload-at", String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
