import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Truck, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'login' | 'signup' | 'forgot';

const authSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
});

const forgotSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
});

type AuthFormData = z.infer<typeof authSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();

  const authForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onAuthSubmit = async (data: AuthFormData) => {
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          let message = 'Erro ao fazer login';
          if (error.message.includes('Invalid login credentials')) {
            message = 'Email ou senha incorretos';
          } else if (error.message.includes('Email not confirmed')) {
            message = 'Email não confirmado. Verifique sua caixa de entrada.';
          }
          toast({ variant: 'destructive', title: 'Erro', description: message });
          return;
        }
        toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
      } else {
        const { error } = await signUp(data.email, data.password);
        if (error) {
          let message = 'Erro ao criar conta';
          if (error.message.includes('User already registered')) {
            message = 'Este email já está cadastrado';
          } else if (error.message.includes('Password should be')) {
            message = 'Senha deve ter no mínimo 6 caracteres';
          }
          toast({ variant: 'destructive', title: 'Erro', description: message });
          return;
        }
        toast({ title: 'Conta criada!', description: 'Você será redirecionado automaticamente.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotSubmit = async (data: ForgotFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao enviar email de recuperação.' });
        return;
      }
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
      setMode('login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    authForm.reset();
    forgotForm.reset();
  };

  const getDescription = () => {
    if (mode === 'login') return 'Faça login para continuar';
    if (mode === 'signup') return 'Crie sua conta';
    return 'Informe seu email para recuperar a senha';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Buffer Logístico
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {getDescription()}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'forgot' ? (
            <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-foreground">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  {...forgotForm.register('email')}
                  className="bg-background/50"
                />
                {forgotForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{forgotForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : 'Enviar link de recuperação'}
              </Button>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => switchMode('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={authForm.handleSubmit(onAuthSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" {...authForm.register('email')} className="bg-background/50" />
                  {authForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{authForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Senha</Label>
                  <Input id="password" type="password" placeholder="••••••" {...authForm.register('password')} className="bg-background/50" />
                  {authForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{authForm.formState.errors.password.message}</p>
                  )}
                </div>
                {mode === 'login' && (
                  <div className="text-right">
                    <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Esqueceu sua senha?
                    </button>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</>
                  ) : (mode === 'login' ? 'Entrar' : 'Criar conta')}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {mode === 'login' ? (
                    <>Não tem conta? <span className="text-primary font-medium">Cadastre-se</span></>
                  ) : (
                    <>Já tem conta? <span className="text-primary font-medium">Faça login</span></>
                  )}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
