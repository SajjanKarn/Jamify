import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import Home from "./pages/Home";
import JamLobby from "./pages/JamLobby";
import JamRoom from "./pages/JamRoom";
import "./index.css";

function SearchPage() {
  // Search uses the same UI as Home but anchored at the /search route.
  return <Home />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<Home />} />
          <Route path="/jam" element={<JamLobby />} />
          <Route path="/jam/:roomId" element={<JamRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);