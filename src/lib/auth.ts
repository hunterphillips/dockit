import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "repo read:user" } },
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token as JWT & { accessToken?: string };
    },
    session({ session, token }: { session: Session; token: JWT & { accessToken?: string } }) {
      (session as Session & { accessToken?: string }).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export async function getToken(): Promise<string> {
  const session = (await auth()) as (Session & { accessToken?: string }) | null;
  if (!session?.accessToken) {
    throw new Error("Unauthorized");
  }
  return session.accessToken;
}
