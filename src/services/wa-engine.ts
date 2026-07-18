// src/services/wa-engine.ts
//
// Selects the WhatsApp engine at runtime. Default is the legacy whatsapp-web.js engine;
// set WA_ENGINE=bridge to use the native whatsmeow bridge. Both expose the same interface
// + event shapes, so the rest of the app is engine-agnostic.

import { whatsappWebService } from './whatsapp-web.service';
import { whatsmeowAdapter } from './whatsmeow-adapter';

export const WA_ENGINE: 'bridge' | 'webjs' = process.env.WA_ENGINE === 'bridge' ? 'bridge' : 'webjs';

// Typed as `any` because the adapter implements the used subset, not the full concrete class.
export const waService: any = WA_ENGINE === 'bridge' ? whatsmeowAdapter : whatsappWebService;
