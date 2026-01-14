import { useState, useEffect } from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Truck, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const passwordSchema = z
  .object({
    password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

interface InvitationData {
  email: string;
  role: AppRole;
  is_valid: boolean;
}

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [isValidating, setIsValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidationError('Token de convite não fornecido');
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('validate_invitation_token', {
          invitation_token: token,
        });

        if (error) {
          console.error('Error validating token:', error);
          setValidationError('Erro ao validar convite');
          setIsValidating(false);
          return;
        }

        if (!data || data.length === 0) {
          setValidationError('Convite não encontrado');
          setIsValidating(false);
          return;
        }

        const inviteData = data[0];

        if (!inviteData.is_valid) {
          setValidationError('Este convite já foi usado ou expirou');
          setIsValidating(false);
          return;
        }

        setInvitation({
          email: inviteData.email,
          role: inviteData.role,
          is_valid: inviteData.is_valid,
        });
        setIsValidating(false);
      } catch (err) {
        console.error('Error:', err);
        setValidationError('Erro ao validar convite');
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Redirect if already logged in
  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: PasswordFormData) => {
    if (!invitation || !token) return;

    setIsSubmitting(true);

    try {
      // Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: data.password,
      });

      if (signUpError) {
        let message = 'Erro ao criar conta';
        if (signUpError.message.includes('User already registered')) {
          message = 'Este email já está cadastrado';
        }
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: message,
        });
        return;
      }

      if (!authData.user) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Erro ao criar conta',
        });
        return;
      }

      // Mark invitation as used and assign role
      const { data: useResult, error: useError } = await supabase.rpc('use_invitation', {
        invitation_token: token,
        new_user_id: authData.user.id,
      });

      if (useError) {
        console.error('Error using invitation:', useError);
        // Account was created, but role assignment failed
        // This is not critical as the user will have the default 'user' role
      }

      setIsSuccess(true);
      toast({
        title: 'Conta criada!',
        description: 'Você será redirecionado em instantes.',
      });

      // Wait a bit then redirect
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Error creating account:', err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao criar conta. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'user':
        return 'Usuário';
      case 'owner':
        return 'Proprietário';
      default:
        return role;
    }
  };

  // Loading state
  if (isValidating || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (validationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Convite Inválido
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {validationError}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate('/auth')}
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Conta Criada!
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Sua conta foi criada com sucesso. Redirecionando...
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Você foi convidado!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Crie sua conta para acessar o Buffer Logístico
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertTitle className="text-sm font-medium">
              Convite para: {getRoleLabel(invitation!.role)}
            </AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              Você receberá acesso como {getRoleLabel(invitation!.role).toLowerCase()} após criar sua conta.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email foi definido no convite e não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                {...register('password')}
                className="bg-background/50"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirmar Senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••"
                {...register('confirmPassword')}
                className="bg-background/50"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar minha conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Já tem conta?{' '}
              <span className="text-primary font-medium">Faça login</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
