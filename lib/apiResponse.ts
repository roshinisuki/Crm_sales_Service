import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, message: string = "Success", status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

export function apiError(message: string = "An error occurred", status: number = 400, data: any = null) {
  return NextResponse.json(
    {
      success: false,
      message,
      data,
    },
    { status }
  );
}
