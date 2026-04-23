import { Route, Switch } from "wouter";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Subscriptions from "./pages/Subscriptions";
import Billing from "./pages/Billing";
import Analytics from "./pages/Analytics";
import Tickets from "./pages/Tickets";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import "./styles.css";

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1e" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", minHeight: "100vh" }}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/billing" component={Billing} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/tickets" component={Tickets} />
          <Route path="/chat" component={Chat} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </main>
    </div>
  );
}
