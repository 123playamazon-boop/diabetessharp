import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import { I18nProvider } from "./i18n/context";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
        <Toaster richColors closeButton position="top-right" />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
