#!/usr/bin/env node
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add these to your environment:\n");
console.log("# .env.local (client — public key only)");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
console.log("# Supabase → Edge Functions → Secrets (server — never commit private key)");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:your-email@example.com");
