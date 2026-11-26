import { z } from "zod";

/**
 * Public configuration, validated once at module load. NEXT_PUBLIC_* values are inlined at build
 * time, so they must be referenced literally (not via process.env[key]).
 */
const publicSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(20),
});

export const publicEnv = publicSchema.parse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
