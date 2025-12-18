/**
 * Audit Service
 * Enterprise-grade audit logging for security and compliance
 *
 * Features:
 * - Non-blocking audit logging (won't break main flow on error)
 * - Request context capture (IP, User-Agent, Request ID)
 * - Structured logging for all entity operations
 * - Query helpers for audit trail analysis
 */

import { prisma } from '../lib/prisma';
import { AuditAction, Prisma } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Request context for audit logging
 */
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Parameters for creating an audit log entry
 */
export interface AuditLogParams {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Query parameters for audit log retrieval
 */
export interface AuditQueryParams {
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Audit Service class
 */
export class AuditService {
  private context: AuditContext;

  constructor(context: AuditContext = {}) {
    this.context = context;
  }

  /**
   * Create a new audit service instance with request context
   */
  static withContext(context: AuditContext): AuditService {
    return new AuditService(context);
  }

  /**
   * Log an audit event (non-blocking)
   * Errors are logged but don't propagate to avoid breaking main flow
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: this.context.userId,
          userEmail: this.context.userEmail,
          ipAddress: this.context.ipAddress,
          userAgent: this.context.userAgent,
          requestId: this.context.requestId,
          oldValues: params.oldValues as Prisma.InputJsonValue,
          newValues: params.newValues as Prisma.InputJsonValue,
          metadata: params.metadata as Prisma.InputJsonValue,
          success: params.success ?? true,
          errorMessage: params.errorMessage,
        },
      });

      logger.debug('Audit log created', {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: this.context.userId,
      });
    } catch (error) {
      // Don't throw - audit failures shouldn't break main flow
      logger.error('Failed to create audit log', {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========================================
  // Authentication Events
  // ========================================

  async logLoginSuccess(userId: string, email: string): Promise<void> {
    await this.log({
      action: AuditAction.LOGIN_SUCCESS,
      entityType: 'User',
      entityId: userId,
      newValues: { email },
    });
  }

  async logLoginFailed(email: string, reason: string): Promise<void> {
    await this.log({
      action: AuditAction.LOGIN_FAILED,
      entityType: 'User',
      metadata: { email, reason },
      success: false,
      errorMessage: reason,
    });
  }

  async logLogout(userId: string, email: string): Promise<void> {
    await this.log({
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      metadata: { email },
    });
  }

  async logRegister(userId: string, email: string): Promise<void> {
    await this.log({
      action: AuditAction.REGISTER,
      entityType: 'User',
      entityId: userId,
      newValues: { email },
    });
  }

  async logPasswordChange(userId: string): Promise<void> {
    await this.log({
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: userId,
    });
  }

  async logAccountLocked(email: string, attempts: number): Promise<void> {
    await this.log({
      action: AuditAction.ACCOUNT_LOCKED,
      entityType: 'User',
      metadata: { email, attempts },
      success: false,
      errorMessage: `Account locked after ${attempts} failed attempts`,
    });
  }

  // ========================================
  // User Management Events
  // ========================================

  async logUserRoleChange(userId: string, oldRole: string, newRole: string): Promise<void> {
    await this.log({
      action: AuditAction.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: userId,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
    });
  }

  async logUserDeactivate(userId: string): Promise<void> {
    await this.log({
      action: AuditAction.USER_DEACTIVATE,
      entityType: 'User',
      entityId: userId,
    });
  }

  // ========================================
  // Label Events
  // ========================================

  async logLabelCreate(labelId: string, templateId: string): Promise<void> {
    await this.log({
      action: AuditAction.LABEL_CREATE,
      entityType: 'Label',
      entityId: labelId,
      newValues: { templateId },
    });
  }

  async logLabelUpdate(labelId: string, changes: Record<string, unknown>): Promise<void> {
    await this.log({
      action: AuditAction.LABEL_UPDATE,
      entityType: 'Label',
      entityId: labelId,
      newValues: changes,
    });
  }

  async logLabelDelete(labelId: string): Promise<void> {
    await this.log({
      action: AuditAction.LABEL_DELETE,
      entityType: 'Label',
      entityId: labelId,
    });
  }

  async logLabelRender(labelId: string, success: boolean, error?: string): Promise<void> {
    await this.log({
      action: AuditAction.LABEL_RENDER,
      entityType: 'Label',
      entityId: labelId,
      success,
      errorMessage: error,
    });
  }

  // ========================================
  // Template Events
  // ========================================

  async logTemplateCreate(templateId: string, name: string): Promise<void> {
    await this.log({
      action: AuditAction.TEMPLATE_CREATE,
      entityType: 'Template',
      entityId: templateId,
      newValues: { name },
    });
  }

  async logTemplateUpdate(templateId: string, changes: Record<string, unknown>): Promise<void> {
    await this.log({
      action: AuditAction.TEMPLATE_UPDATE,
      entityType: 'Template',
      entityId: templateId,
      newValues: changes,
    });
  }

  async logTemplateDelete(templateId: string): Promise<void> {
    await this.log({
      action: AuditAction.TEMPLATE_DELETE,
      entityType: 'Template',
      entityId: templateId,
    });
  }

  // ========================================
  // Crawl Events
  // ========================================

  async logCrawlStart(crawlJobId: string, targetUrl: string): Promise<void> {
    await this.log({
      action: AuditAction.CRAWL_START,
      entityType: 'CrawlJob',
      entityId: crawlJobId,
      newValues: { targetUrl },
    });
  }

  async logCrawlComplete(
    crawlJobId: string,
    stats: { productsFound: number; productsScraped: number }
  ): Promise<void> {
    await this.log({
      action: AuditAction.CRAWL_COMPLETE,
      entityType: 'CrawlJob',
      entityId: crawlJobId,
      newValues: stats,
    });
  }

  async logCrawlFailed(crawlJobId: string, error: string): Promise<void> {
    await this.log({
      action: AuditAction.CRAWL_FAILED,
      entityType: 'CrawlJob',
      entityId: crawlJobId,
      success: false,
      errorMessage: error,
    });
  }

  // ========================================
  // Query Methods
  // ========================================

  /**
   * Query audit logs with filters
   */
  static async query(params: AuditQueryParams) {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;
    if (params.userId) where.userId = params.userId;
    if (params.success !== undefined) where.success = params.success;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit history for a specific entity
   */
  static async getEntityHistory(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get recent security events (logins, failures, role changes)
   */
  static async getSecurityEvents(since: Date, limit = 100) {
    return prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            AuditAction.LOGIN_SUCCESS,
            AuditAction.LOGIN_FAILED,
            AuditAction.LOGOUT,
            AuditAction.PASSWORD_CHANGE,
            AuditAction.ACCOUNT_LOCKED,
            AuditAction.USER_ROLE_CHANGE,
            AuditAction.USER_DEACTIVATE,
          ],
        },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get failed operations (for monitoring/alerting)
   */
  static async getFailedOperations(since: Date, limit = 100) {
    return prisma.auditLog.findMany({
      where: {
        success: false,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get user activity history
   */
  static async getUserActivity(userId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Cleanup old audit logs (retention policy)
   * Default: Keep logs for 90 days
   */
  static async cleanup(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info('Audit log cleanup completed', {
      retentionDays,
      deletedCount: result.count,
    });

    return result.count;
  }
}

/**
 * Create audit context from Express request
 */
export function createAuditContextFromRequest(req: {
  user?: { id: string; email: string };
  ip?: string;
  headers?: { 'user-agent'?: string; 'x-request-id'?: string };
}): AuditContext {
  return {
    userId: req.user?.id,
    userEmail: req.user?.email,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'],
    requestId: req.headers?.['x-request-id'],
  };
}

/**
 * Express middleware to attach audit service to request
 */
export function auditMiddleware(
  req: Express.Request & { auditService?: AuditService },
  _res: Express.Response,
  next: () => void
): void {
  const context = createAuditContextFromRequest(
    req as Parameters<typeof createAuditContextFromRequest>[0]
  );
  req.auditService = AuditService.withContext(context);
  next();
}

export default AuditService;
