import { FilePlus2, History, Home, Settings, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navMain = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'History', href: '/reports', icon: History },
  { name: 'New report', href: '/report/new', icon: FilePlus2, isNew: true },
];

const navAccount = [{ name: 'Settings', href: '/settings', icon: Settings }];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  user?: { name?: string | null; email?: string | null } | null;
  menuButton?: React.ReactNode;
};

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function NavItem({
  item,
  onClose,
}: {
  item: {
    name: string;
    href: string;
    icon: React.ElementType;
    isNew?: boolean;
  };
  onClose: () => void;
}) {
  function spawnRipple(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'sb-ripple';
    ripple.style.left = `${e.clientX - rect.left - 35}px`;
    ripple.style.top = `${e.clientY - rect.top - 35}px`;
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  return (
    <NavLink
      to={item.href}
      onClick={(e) => {
        spawnRipple(e);
        onClose();
      }}
      style={{
        textDecoration: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      className={({ isActive }) => (isActive ? 'sb-link active' : 'sb-link')}
    >
      <item.icon size={16} className="sb-link-icon" aria-hidden="true" />
      <span style={{ flex: 1 }}>{item.name}</span>
    </NavLink>
  );
}

export function Sidebar({
  open,
  onClose,
  onLogout,
  user,
  menuButton,
}: SidebarProps) {
  const displayName = user?.name?.trim() || 'Full Name';
  const displayEmail = user?.email?.trim() || 'Email';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: '#0e0618',
          borderRight: '1px solid rgba(136,33,232,0.18)',
          boxShadow: '4px 0 40px rgba(136,33,232,0.10)',
        }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(136,33,232,0.09) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo */}
        <div
          style={{
            padding: '20px 16px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(136,33,232,0.10)',
          }}
        >
          <NavLink
            to="/dashboard"
            onClick={onClose}
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              flex: 1,
            }}
          >
            <img
              src="/kup50_logo.svg"
              alt=""
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                objectFit: 'contain',
                flexShrink: 0,
                animation: 'kup50-pulse 3s ease-in-out infinite',
              }}
            />
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#eae9fc',
                  lineHeight: 1.2,
                  letterSpacing: '0.03em',
                }}
              >
                KUP50
              </p>
              <p style={{ fontSize: 10, color: '#eae9fc', marginTop: 1 }}>
                Reporting workspace
              </p>
            </div>
          </NavLink>
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <span className="sb-group-label">Main</span>
          {navMain.map((item) => (
            <NavItem key={item.name} item={item} onClose={onClose} />
          ))}

          <span className="sb-group-label" style={{ marginTop: 6 }}>
            Account
          </span>
          {navAccount.map((item) => (
            <NavItem key={item.name} item={item} onClose={onClose} />
          ))}
        </nav>

        {/* User footer */}
        <div
          style={{
            borderTop: '1px solid rgba(136,33,232,0.10)',
          }}
        >
          <div
            className="flex h-16 items-center justify-between px-3"
            style={{ gap: 10 }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {menuButton}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(136,33,232,0.18)',
                  border: '1px solid rgba(136,33,232,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#8821e8',
                  flexShrink: 0,
                }}
              >
                {getInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="topbar-name truncate text-sm font-medium"
                  style={{
                    color: '#eae9fc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={displayName}
                >
                  {displayName}
                </p>
                <p
                  className="topbar-email truncate text-[10px]"
                  style={{
                    color: '#eae9fc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={displayEmail}
                >
                  {displayEmail}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="sb-icon-btn"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Styles */}
        <style>{`
          @keyframes kup50-pulse {
            0%   { box-shadow: 0 0 0 0 rgba(136,33,232,0.50); }
            65%  { box-shadow: 0 0 0 7px rgba(136,33,232,0); }
            100% { box-shadow: 0 0 0 0 rgba(136,33,232,0); }
          }

          .sb-group-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.10em;
            color: #eae9fc;
            padding: 10px 8px 4px;
            display: block;
          }

          .sb-link {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #eae9fc;
            transition: background 0.15s, color 0.15s;
            position: relative;
            overflow: hidden;
          }

          .sb-link::after {
            content: '';
            position: absolute;
            right: 0; top: 20%; bottom: 20%;
            width: 2.5px;
            border-radius: 2px 0 0 2px;
            background: #8821e8;
            transform: scaleY(0);
            transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          }

          .sb-link:hover {
            background: rgba(136,33,232,0.09);
            color: #eae9fc;
          }

          .sb-link.active {
            background: rgba(136,33,232,0.14);
            color: #eae9fc;
          }

          .sb-link.active::after {
            transform: scaleY(1);
          }

          .sb-link-icon {
            flex-shrink: 0;
            color: rgba(199,160,255,0.40);
            transition: color 0.15s, transform 0.18s;
          }

          .sb-link:hover .sb-link-icon {
            color: #8821e8;
            transform: translateX(1px);
          }

          .sb-link.active .sb-link-icon {
            color: #8821e8;
            animation: sb-icon-bounce 0.32s cubic-bezier(0.34,1.56,0.64,1);
          }

          @keyframes sb-icon-bounce {
            0%   { transform: scale(1); }
            45%  { transform: scale(1.28) rotate(-5deg); }
            100% { transform: scale(1); }
          }

          .sb-ripple {
            position: absolute;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: rgba(136,33,232,0.18);
            pointer-events: none;
            animation: sb-ripple-out 0.45s ease-out forwards;
          }

          @keyframes sb-ripple-out {
            from { transform: scale(0); opacity: 1; }
            to   { transform: scale(4); opacity: 0; }
          }

          .sb-icon-btn {
            width: 26px;
            height: 26px;
            border-radius: 6px;
            border: 1px solid rgba(136,33,232,0.15);
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(199,160,255,0.40);
            cursor: pointer;
            flex-shrink: 0;
            transition: background 0.15s, color 0.15s;
          }

          .sb-icon-btn:hover {
            background: rgba(136,33,232,0.14);
            color: #8821e8;
          }
        `}</style>
      </aside>
    </>
  );
}
