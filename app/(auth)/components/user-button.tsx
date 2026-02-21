'use client';

import { useConvexAuth } from 'convex/react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface UserButtonProps {
  email?: string;
  name?: string;
  avatarUrl?: string;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  if (email) return email[0]?.toUpperCase() ?? 'U';
  return 'U';
}

export function UserButton({ email, name, avatarUrl }: UserButtonProps) {
  const { isLoading } = useConvexAuth();
  const router = useRouter();

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  const initials = getInitials(name, email);
  const displayName = name ?? email ?? 'User';

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {name && <p className="text-sm font-medium leading-none">{name}</p>}
            {email && (
              <p className="text-xs leading-none text-muted-foreground">{email}</p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/settings')}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push('/dashboard/settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
