import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { userService } from "@/services/userService";
import {
  Inbox,
  Users,
  Settings,
  Shield,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Home,
  MessageSquare,
  Cog,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
  { href: "/inbox", label: "Samtaler", icon: <Inbox className="h-5 w-5" /> },
  { href: "/sending", label: "Send melding", icon: <Send className="h-5 w-5" /> },
  { href: "/contacts", label: "Kontakter", icon: <Users className="h-5 w-5" /> },
  { href: "/simulate", label: "Simulering", icon: <MessageSquare className="h-5 w-5" /> },
  { href: "/admin", label: "Admin", icon: <Settings className="h-5 w-5" /> },
  { href: "/settings", label: "Innstillinger", icon: <Cog className="h-5 w-5" /> },
];

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [demoUser, setDemoUser] = useState<any>(null);

  useEffect(() => {
    // Check if we are in demo mode
    const impersonated = userService.getImpersonatedUser();
    setDemoUser(impersonated);
  }, []);

  const handleExitDemo = () => {
    userService.setImpersonatedUser(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Skip to content link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:top-0 focus:left-0"
      >
        Hopp til hovedinnhold
      </a>

      {/* Demo Mode Banner */}
      {demoUser && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-1 text-center text-sm font-medium flex justify-center items-center gap-4">
          <span>
            🎭 DEMO MODE: Du ser nå systemet som <strong>{demoUser.name}</strong>
          </span>
          <button 
            onClick={handleExitDemo}
            className="bg-black/20 hover:bg-black/30 px-3 py-0.5 rounded text-xs transition-colors"
          >
            Avslutt demo
          </button>
        </div>
      )}

      {/* Mobile Header */}
      <header className={cn("md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm", demoUser && "mt-8")}>
        <div className="font-bold text-xl text-primary">SeMSe</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Lukk meny" : "Åpne meny"}
          className="h-12 w-12"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 transform bg-card border-r transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen flex flex-col md:w-64",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          demoUser && "mt-8 md:mt-0 pt-0"
        )}
      >
        <div className={cn("p-6 border-b", demoUser && "md:pt-10")}>
          <h1 className="text-2xl font-bold text-primary tracking-tight">SeMSe</h1>
          <p className="text-sm text-muted-foreground mt-1">FairGateway</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-lg text-base md:text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary min-h-[48px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[48px] text-base md:text-sm"
            onClick={() => console.log("Logout clicked")}
          >
            <LogOut className="h-5 w-5" />
            Logg ut
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}