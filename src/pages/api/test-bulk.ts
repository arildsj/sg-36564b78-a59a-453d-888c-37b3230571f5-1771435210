import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Immediate response - no async operations
  return res.status(200).json({
    success: true,
    message: "API route is working!",
    timestamp: new Date().toISOString()
  });
}