import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/apiResponse";

export async function POST() {
  const response = apiSuccess(null, "Logged out successfully");
  
  // Clear the authentication cookie
  response.cookies.set({
    name: "token",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
