// src/utils/avatar.ts
// Download and cache WhatsApp profile pictures locally

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import logger from '@utils/logger';

const AVATARS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

/**
 * Sanitize a chatId into a safe filename
 * e.g. "923001234567@c.us" -> "923001234567_c_us"
 */
function safeFilename(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Download a WhatsApp profile picture and save it locally.
 * Returns the local URL path (e.g. "/uploads/avatars/923001234567_c_us.jpg")
 * or null if download fails.
 */
export async function downloadAvatar(
  chatId: string,
  whatsappUrl: string,
): Promise<string | null> {
  if (!whatsappUrl || !chatId) return null;

  const filename = `${safeFilename(chatId)}.jpg`;
  const filepath = path.join(AVATARS_DIR, filename);
  const localUrl = `/uploads/avatars/${filename}`;

  try {
    await new Promise<void>((resolve, reject) => {
      const protocol = whatsappUrl.startsWith('https') ? https : http;
      const request = protocol.get(whatsappUrl, { timeout: 10000 }, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadAvatar(chatId, redirectUrl).then(() => resolve()).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('image')) {
          reject(new Error(`Not an image: ${contentType}`));
          return;
        }

        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          // Verify the file has content (not empty)
          const stats = fs.statSync(filepath);
          if (stats.size < 100) {
            fs.unlinkSync(filepath);
            reject(new Error('Downloaded file too small'));
          } else {
            resolve();
          }
        });

        fileStream.on('error', (err) => {
          fs.unlink(filepath, () => {}); // Cleanup
          reject(err);
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Timeout'));
      });
    });

    return localUrl;
  } catch (error) {
    logger.debug({ chatId, error }, 'Failed to download avatar');
    return null;
  }
}

/**
 * Check if a locally cached avatar exists for this chatId
 */
export function getLocalAvatar(chatId: string): string | null {
  const filename = `${safeFilename(chatId)}.jpg`;
  const filepath = path.join(AVATARS_DIR, filename);
  if (fs.existsSync(filepath)) {
    return `/uploads/avatars/${filename}`;
  }
  return null;
}
