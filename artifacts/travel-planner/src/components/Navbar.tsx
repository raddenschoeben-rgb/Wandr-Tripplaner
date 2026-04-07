import { Link, useLocation } from "wouter";
import { Map, Briefcase, Compass, Settings, User } from "lucide-react";
import { useUser, useAuth } from "@clerk/react";

export default function Navbar() {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const { isSignedIn } = useAuth();

  const isTrips = location.startsWith("/trips") || location === "/";
  const isExplore = location === "/explore";
  const isSettings = location === "/settings";

  return (
    <nav className="flex items-center justify-between px-5 py-3 bg-card border-b border-border shadow-xs z-20 relative" data-testid="navbar">
      <Link href="/trips" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <Compass className="w-5 h-5 text-primary" />
        <span className="font-semibold text-base tracking-tight text-foreground">Wandr</span>
      </Link>

      <div className="flex items-center gap-1">
        {isSignedIn ? (
          <>
            <Link
              href="/trips"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isTrips ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              data-testid="nav-my-trips"
            >
              <Briefcase className="w-4 h-4" />
              My Trips
            </Link>
            <Link
              href="/explore"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isExplore ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              data-testid="nav-explore"
            >
              <Map className="w-4 h-4" />
              Explore
            </Link>
            <div className="w-px h-5 bg-border mx-1" />
            <Link
              href="/settings"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isSettings ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              data-testid="nav-settings"
              title="Cài đặt"
            >
              <Settings className="w-4 h-4" />
            </Link>
            {isLoaded && user ? (
              <Link href="/settings" className="ml-1">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName ?? "Avatar"}
                    className="w-8 h-8 rounded-full object-cover border-2 border-border hover:border-primary transition-colors cursor-pointer"
                    title={user.fullName ?? user.username ?? "Tài khoản"}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border hover:border-primary transition-colors cursor-pointer">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </Link>
            ) : null}
          </>
        ) : (
          <Link
            href="/sign-in"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </nav>
  );
}
