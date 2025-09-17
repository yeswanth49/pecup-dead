import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { NextAuthOptions } from 'next-auth';
import { createSupabaseAdmin } from '@/lib/supabase';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      // Always allow sign-in; we'll upsert profile on session callback
      return true;
    },
    async session({ session, token }) {
      try {
        const supabase = createSupabaseAdmin();
        const email = session.user?.email?.toLowerCase();
        const googleSub = (token?.sub as string) || (token as any)?.id || null;
        if (!email) return session;

        // Reconcile by google_sub when present; otherwise by email
        let targetId: string | null = null;
        if (googleSub) {
          const { data: bySub } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('google_sub', googleSub)
            .maybeSingle();
          if (bySub) {
            targetId = bySub.id;
            if (bySub.email?.toLowerCase() !== email) {
              await supabase.from('profiles').update({ email }).eq('id', targetId);
            }
          }
        }
        if (!targetId) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (byEmail) targetId = byEmail.id;
        }

        // Upsert if missing, attach google_sub if available
        if (!targetId) {
          await supabase.from('profiles').insert({ email, google_sub: googleSub || null }).select('id').maybeSingle();
        } else if (googleSub) {
          await supabase.from('profiles').update({ google_sub: googleSub }).eq('id', targetId);
        }
      } catch (e) {
        console.warn('profiles reconciliation failed:', e);
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
