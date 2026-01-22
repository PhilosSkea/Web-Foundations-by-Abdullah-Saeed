/**
 * PROTECTED ARTICLES ROUTE
 * 
 * SECURITY: Only authenticated users with active subscription can:
 * - View article metadata
 * - Download/view PDFs
 * - Access premium content
 * 
 * This ensures:
 * - PDFs are not publicly accessible
 * - Direct URL access is blocked
 * - Access is verified server-side on every request
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireSubscription } from '../middleware/auth.js';
import { db } from '../models/user.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(__dirname, '../..', 'pdfs');

// SECURITY: Whitelist of allowed files
const ALLOWED_FILES = new Map([
  ['health-wellness.pdf', 'Health and Wellness Guide'],
  ['article-1.pdf', 'Article 1: Advanced Topics']
  // Add more as needed
]);

/**
 * GET /api/articles/public
 * Get list of articles (public endpoint, no subscription required)
 * Shows limited preview info
 */
router.get('/public', (req, res) => {
  try {
    const articles = [
      {
        id: 'article-1',
        title: 'Welcome to Berlin-Benz',
        type: 'text',
        preview: 'Read about our premium content collection...',
        requiresSubscription: false
      },
      {
        id: 'article-2',
        title: 'Premium Article: Advanced Strategies',
        type: 'pdf',
        preview: 'Unlock exclusive PDF content',
        requiresSubscription: true
      },
      {
        id: 'article-3',
        title: 'Premium Article: Complete Guide',
        type: 'pdf',
        preview: 'Detailed PDF guide for subscribers',
        requiresSubscription: true
      }
    ];

    res.json({ articles });
  } catch (error) {
    console.error('Articles error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch articles'
    });
  }
});

/**
 * GET /api/articles/subscribed
 * Get articles available to authenticated users
 * Requires active subscription
 */
router.get('/subscribed', requireAuth, requireSubscription, async (req, res) => {
  try {
    const user = await db.users.findById(req.userId);
    const subscriptions = await db.subscriptions.findActiveByUserId(req.userId);

    if (subscriptions.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No active subscription'
      });
    }

    const articles = [
      {
        id: 'pdf-1',
        title: 'Health and Wellness Comprehensive Guide',
        type: 'pdf',
        fileName: 'health-wellness.pdf',
        size: '2.3 MB',
        url: '/api/articles/download/health-wellness.pdf'
      },
      {
        id: 'pdf-2',
        title: 'Advanced Strategies Document',
        type: 'pdf',
        fileName: 'article-1.pdf',
        size: '1.8 MB',
        url: '/api/articles/download/article-1.pdf'
      }
    ];

    await db.audit.log(req.userId, 'articles_accessed', {
      ip: req.ip,
      count: articles.length
    });

    res.json({
      user: user.name,
      subscription: subscriptions[0],
      articles
    });
  } catch (error) {
    console.error('Subscribed articles error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to fetch articles'
    });
  }
});

/**
 * GET /api/articles/download/:filename
 * Download or view a PDF
 * 
 * SECURITY:
 * ✅ Only authenticated users with subscription
 * ✅ Filename validated against whitelist (prevent path traversal)
 * ✅ Server serves file, not direct URL access
 * ✅ Download logged for audit trail
 */
router.get('/download/:filename', requireAuth, requireSubscription, async (req, res) => {
  try {
    const filename = req.params.filename;

    // SECURITY: Validate filename against whitelist
    if (!ALLOWED_FILES.has(filename)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'File not found'
      });
    }

    // SECURITY: Prevent path traversal attacks
    const filepath = path.join(PDF_DIR, filename);
    if (!filepath.startsWith(PDF_DIR)) {
      console.error(`⚠️ Path traversal attempt: ${filepath}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Check file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'File not found'
      });
    }

    // AUDIT LOG
    await db.audit.log(req.userId, 'pdf_download', {
      filename,
      fileSize: fs.statSync(filepath).size,
      ip: req.ip
    });

    // SERVE FILE
    const fileSize = fs.statSync(filepath).size;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileSize);
    
    // Don't cache (each user gets fresh copy)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Server Error',
          message: 'Unable to download file'
        });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to download file'
    });
  }
});

/**
 * GET /api/articles/verify
 * Check if user has access to articles
 * Used by frontend to show/hide premium content
 */
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const subscriptions = await db.subscriptions.findActiveByUserId(req.userId);
    const hasAccess = subscriptions.length > 0;

    res.json({
      hasAccess,
      subscription: hasAccess ? {
        planId: subscriptions[0].plan_id,
        expiresAt: subscriptions[0].expires_at
      } : null
    });
  } catch (error) {
    console.error('Verify access error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to verify access'
    });
  }
});

export default router;
