import { Route, Routes } from "react-router";
import styles from "./App.module.css";
import SiteFooter from "./components/SiteFooter.jsx";
import CreateRoomPage from "./pages/CreateRoomPage.jsx";
import JoinRoomPage from "./pages/JoinRoomPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <div className={styles.shell}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/new" element={<CreateRoomPage />} />
        <Route path="/join/:code?" element={<JoinRoomPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SiteFooter />
    </div>
  );
}
