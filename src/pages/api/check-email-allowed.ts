import type { NextApiRequest, NextApiResponse } from "next";
import { ALLOWED_EMAILS } from "@/server/auth";

type ResponseData = {
  isAllowed: boolean;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | { message: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email } = req.body;

  if (typeof email !== "string") {
    return res.status(400).json({ message: "Email must be a string." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const isAllowed = ALLOWED_EMAILS.includes(cleanEmail);

  return res.status(200).json({ isAllowed });
}
