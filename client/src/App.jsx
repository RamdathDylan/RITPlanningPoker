import { Route, Routes } from "react-router";
import styles from "./App.module.css";
import SiteFooter from "./components/SiteFooter.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import CreateRoomPage from "./pages/CreateRoomPage.jsx";
import JoinRoomPage from "./pages/JoinRoomPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

export default function App() {
  return (
    <div className={styles.shell}>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/new" element={<CreateRoomPage />} />
        <Route path="/join/:code?" element={<JoinRoomPage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SiteFooter />
    </div>
  );
}
