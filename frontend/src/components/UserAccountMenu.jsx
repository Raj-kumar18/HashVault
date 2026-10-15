import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronDown } from 'lucide-react';

export default function UserAccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin':
        return 'bg-zinc-800 text-white font-semibold border-zinc-700';
      case 'Analyst':
        return 'bg-zinc-800 text-zinc-200 font-semibold border-zinc-700';
      case 'Viewer':
      default:
        return 'bg-zinc-900 text-zinc-300 border-zinc-800';
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2.5 h-9 pl-2 pr-3 bg-zinc-900 border-zinc-700 hover:border-zinc-600 text-zinc-100"
          id="btn-user-account-menu"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-zinc-800 text-white font-bold border border-zinc-700">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <span className="text-xs font-semibold max-w-[100px] truncate hidden sm:inline-block text-zinc-100">
            {user.name}
          </span>

          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRoleBadge(
              user.role
            )}`}
          >
            {user.role}
          </span>

          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-xl">
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white leading-none">
                {user.name}
              </span>
              <span
                className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${getRoleBadge(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>



        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 focus:text-red-300 focus:bg-red-950/40 cursor-pointer"
          id="btn-logout"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
