import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { AuthForm } from 'components/AuthForm';

export default function AuthPage() {
  const session = useSession();
  const router = useRouter();

  if (session) {
    router.push('/');
    return null;
  }

  return <AuthForm />;
}
