import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@/api/client";
import { App } from "@/App";
import "@/styles/tokens.css";
import "@/styles/base.css";

const root = document.getElementById("root");
if (!root) throw new Error("AFK could not find its page root.");

createRoot(root).render(
  <StrictMode>
    <App client={createClient({ token: window.afkToken })} />
  </StrictMode>,
);
