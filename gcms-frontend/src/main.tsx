import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initPersistentStateSync } from "./lib/persistentState";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

void initPersistentStateSync().catch((error) => {
  console.error("Persistent state sync failed during startup.", error);
});
