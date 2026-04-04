import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

// Custom adapter mapping for our schema
const adapter = DrizzleAdapter(db, {
  usersTable: users as any,
  accountsTable: accounts as any,
  sessionsTable: sessions as any,
  verificationTokensTable: verificationTokens as any,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/login",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user.length || !user[0].passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user[0].passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          image: user[0].image,
          role: user[0].role,
        };
      },
    }),
    Nodemailer({
      server: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.SMTP_FROM || "noreply@3dprintit.de",
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "customer";
      }

      // Handle session updates
      if (trigger === "update" && session) {
        token.name = session.name || token.name;
      }

      // Refresh role from DB periodically
      if (token.id && !user) {
        try {
          const dbUser = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);
          if (dbUser.length) {
            token.role = dbUser[0].role;
          }
        } catch {
          // Ignore DB errors during JWT refresh
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth, ensure role is set
      if (account?.provider === "google" && user.email) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (!existing.length) {
          // New user via Google — will be created by adapter
          return true;
        }
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // Send welcome email for new users
      if (user.email) {
        try {
          const { sendTemplateEmail } = await import("@/lib/email");
          await sendTemplateEmail(user.email, "welcome", {
            name: user.name || user.email,
          });
        } catch (e) {
          console.error("[Auth] Welcome email failed:", e);
        }
      }
    },
  },
});
