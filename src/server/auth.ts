import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import type { GetServerSidePropsContext } from "next";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";

import { env } from "@/env.mjs";
import { db } from "@/server/db";

export const ALLOWED_EMAILS = ["kiwihodl@proton.me", "rob@anchorwatch.com"];

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    signIn: async ({ user }) => {
      if (!user.email) {
        return false;
      }
      return ALLOWED_EMAILS.includes(user.email.trim().toLowerCase());
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  adapter: DrizzleAdapter(db),
  providers: [
    EmailProvider({
      server: {
        host: env.EMAIL_SERVER_HOST,
        port: Number(env.EMAIL_SERVER_PORT),
        auth: {
          user: env.EMAIL_SERVER_USER,
          pass: env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        const transport = nodemailer.createTransport(provider.server);
        const result = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Sign in to AnchorWatch",
          text: `Sign in to AnchorWatch by clicking this link: ${url}`,
          html: `<p>Sign in to AnchorWatch by clicking <a href="${url}">this link</a>.</p>`,
        });
        const failed = result.rejected.concat(result.pending).filter(Boolean);
        if (failed.length) {
          throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
        }

        console.log("SIGN IN LINK:", nodemailer.getTestMessageUrl(result));
      },
    }),
  ],
};

export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
