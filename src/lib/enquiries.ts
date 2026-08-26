"use server";

import { prisma } from "./db";
import type { EnquiryState } from "./enquiry-state";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 1000;

async function record(
  source: string,
  formData: FormData,
  successMessage: string,
): Promise<EnquiryState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const message = String(formData.get("message") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (message.length > MAX_MESSAGE) {
    return { status: "error", message: "Keep it under 1000 characters." };
  }

  try {
    await prisma.enquiry.create({
      data: { email, message: message || null, source },
    });
  } catch (error) {
    console.error(`[enquiry] ${source} failed`, error);
    return {
      status: "error",
      message: "Could not save that just now - please try again.",
    };
  }

  return { status: "success", message: successMessage };
}

export async function joinWaitlist(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  return record(
    "pricing-waitlist",
    formData,
    "You are on the list. We will email you when the Managed tier ships.",
  );
}

export async function sendContactMessage(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  return record(
    "faq-contact",
    formData,
    "Thanks - your question is saved and we will reply by email.",
  );
}
