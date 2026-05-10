import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/api/client';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const DEMO_USERS = [
  { username: 'alice',   role: 'Admin',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { username: 'bob',     role: 'Reviewer',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { username: 'charlie', role: 'Submitter', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const { token } = await authApi.login(data);
      const session = await authApi.validate(token);
      const rolesData = await authApi.getUserRoles(session.user_id, token);
      const permissions =
        session.permissions?.length ?
          session.permissions
        : rolesData.roles.flatMap((r) => r.permissions);
      // Store the username the user typed — the backend doesn't return it in the JWT
      return { token, user: { ...session, username: data.username, permissions } };
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #002800 0%, #004010 55%, #006818 100%)' }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="inline-block bg-white rounded-xl px-4 py-2.5 shadow-lg">
            <img src="/logo.png" alt="NHIA" className="h-10 w-auto object-contain" />
          </div>
        </div>

        {/* Quote */}
        <div className="relative z-10 space-y-5">
          <div className="flex gap-1">
            {[1,2,3].map(i => <div key={i} className="h-1 w-8 rounded-full bg-white/30" />)}
          </div>
          <blockquote>
            <p className="text-xl xl:text-2xl font-semibold text-white leading-relaxed">
              Secure, traceable, and efficient document management for the National Health Insurance Authority.
            </p>
            <footer className="mt-3 text-sm text-white/50">NHIA Electronic Document Management System</footer>
          </blockquote>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { label: 'Documents', value: 'Managed' },
            { label: 'Tasks', value: 'Tracked' },
            { label: 'Audit Trail', value: 'Immutable' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/8 backdrop-blur-sm border border-white/10 p-4">
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/45 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <img src="/logo.png" alt="NHIA" className="h-9 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to access the system
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="username"
                  placeholder="Enter your username"
                  className="pl-9"
                  error={!!errors.username}
                  autoComplete="username"
                  autoFocus
                  {...register('username')}
                />
              </div>
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="pl-9 pr-10"
                  error={!!errors.password}
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
              Sign in to NHIA-EDMS
            </Button>
          </form>

          {/* Demo credentials */}
          {/* <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Demo accounts
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => {
                    setValue('username', u.username);
                    setValue('password', 'password123');
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 hover:bg-background border border-transparent hover:border-border transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.color}`}>
                      {u.role}
                    </span>
                    <span className="text-sm font-mono text-foreground">{u.username}</span>
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    Use →
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
              All accounts use password: <span className="font-mono">password123</span>
            </p>
          </div> */}
        </div>
      </div>
    </div>
  );
}
