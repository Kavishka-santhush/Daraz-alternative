import { z } from 'zod';

export const registerBuyerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().min(7).max(20).optional(),
  referralCode: z.string().optional(),
});

export const registerSellerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().min(7).max(20),
  shopName: z.string().min(2).max(80),
  shopDescription: z.string().max(1000).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const forgotPasswordSchema = z.object({ email: z.string().email().toLowerCase() });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({ token: z.string().min(10) });

export const requestOtpSchema = z.object({ phone: z.string().min(7).max(20) });
export const verifyOtpSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().length(6),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type RegisterBuyerInput = z.infer<typeof registerBuyerSchema>;
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
