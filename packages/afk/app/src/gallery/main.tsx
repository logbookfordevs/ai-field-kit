import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Gallery } from "@/gallery/Gallery";
import "@/styles/tokens.css";
import "@/styles/base.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><Gallery /></StrictMode>);
