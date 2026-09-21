import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppFloat from "./WhatsAppFloat";

const Layout = () => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <WhatsAppFloat />
  </div>
);

export default Layout;
