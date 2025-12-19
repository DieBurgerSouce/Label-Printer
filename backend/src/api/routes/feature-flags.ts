/**
 * Feature Flags API Routes
 * Endpoints for querying and managing feature flags
 */

import { Router } from 'express';
import {
  featureFlagsService,
  FEATURE_FLAGS,
  type FeatureFlagName,
} from '../../services/feature-flags-service';
import { isAuthenticated, requireRole } from '../../middleware/auth';

const router = Router();

/**
 * @openapi
 * /features:
 *   get:
 *     summary: Get all feature flags for current user
 *     tags: [Features]
 *     responses:
 *       200:
 *         description: Feature flags status
 */
router.get('/', (req, res) => {
  const userId = req.session?.userId;
  const flags = featureFlagsService.getAllFlags(userId);

  res.json({
    success: true,
    data: {
      flags,
      userId: userId || null,
    },
  });
});

/**
 * @openapi
 * /features/{flagName}:
 *   get:
 *     summary: Check if a specific feature is enabled
 *     tags: [Features]
 *     parameters:
 *       - name: flagName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feature flag status
 */
router.get('/:flagName', (req, res) => {
  const { flagName } = req.params;
  const userId = req.session?.userId;

  // Validate flag name
  if (!Object.values(FEATURE_FLAGS).includes(flagName as FeatureFlagName)) {
    return res.status(404).json({
      success: false,
      error: 'Unknown feature flag',
    });
  }

  const enabled = featureFlagsService.isFeatureEnabled(flagName as FeatureFlagName, userId);

  res.json({
    success: true,
    data: {
      name: flagName,
      enabled,
    },
  });
});

/**
 * @openapi
 * /features/admin/all:
 *   get:
 *     summary: Get detailed information about all feature flags (admin only)
 *     tags: [Features]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Detailed feature flags information
 */
router.get('/admin/all', isAuthenticated, requireRole('ADMIN'), (_req, res) => {
  const flags = featureFlagsService.getDetailedFlags();

  res.json({
    success: true,
    data: {
      flags,
      available: Object.values(FEATURE_FLAGS),
    },
  });
});

/**
 * @openapi
 * /features/admin/{flagName}:
 *   patch:
 *     summary: Update a feature flag (admin only)
 *     tags: [Features]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - name: flagName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               rolloutPercentage:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated feature flag
 */
router.patch('/admin/:flagName', isAuthenticated, requireRole('ADMIN'), (req, res) => {
  const { flagName } = req.params;
  const { enabled, rolloutPercentage, enabledForUsers, disabledForUsers } = req.body;

  // Validate flag name
  if (!Object.values(FEATURE_FLAGS).includes(flagName as FeatureFlagName)) {
    return res.status(404).json({
      success: false,
      error: 'Unknown feature flag',
    });
  }

  const updated = featureFlagsService.updateFlag(flagName as FeatureFlagName, {
    enabled,
    rolloutPercentage,
    enabledForUsers,
    disabledForUsers,
  });

  if (!updated) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update feature flag',
    });
  }

  res.json({
    success: true,
    data: updated,
  });
});

/**
 * @openapi
 * /features/user/override:
 *   post:
 *     summary: Set a user-specific feature override
 *     tags: [Features]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - flagName
 *               - enabled
 *             properties:
 *               flagName:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Override set successfully
 */
router.post('/user/override', isAuthenticated, (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const { flagName, enabled } = req.body;

  // Validate flag name
  if (!Object.values(FEATURE_FLAGS).includes(flagName as FeatureFlagName)) {
    return res.status(404).json({
      success: false,
      error: 'Unknown feature flag',
    });
  }

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean',
    });
  }

  featureFlagsService.setUserOverride(userId, flagName as FeatureFlagName, enabled);

  res.json({
    success: true,
    message: 'Feature override set',
    data: {
      flagName,
      enabled,
    },
  });
});

/**
 * @openapi
 * /features/user/override/{flagName}:
 *   delete:
 *     summary: Remove a user-specific feature override
 *     tags: [Features]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - name: flagName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Override removed
 */
router.delete('/user/override/:flagName', isAuthenticated, (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const { flagName } = req.params;

  // Validate flag name
  if (!Object.values(FEATURE_FLAGS).includes(flagName as FeatureFlagName)) {
    return res.status(404).json({
      success: false,
      error: 'Unknown feature flag',
    });
  }

  featureFlagsService.removeUserOverride(userId, flagName as FeatureFlagName);

  res.json({
    success: true,
    message: 'Feature override removed',
  });
});

export default router;
