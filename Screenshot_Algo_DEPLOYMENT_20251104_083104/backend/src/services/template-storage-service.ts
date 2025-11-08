/**
 * Template Storage Service
 * Manages storage and retrieval of rendering templates with atomic operations
 * Separate from template-engine.ts (which handles rendering) and label-template-service.ts (which handles visual editor templates)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { LabelTemplate } from '../types/template-types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Template summary for listing
 */
export interface TemplateSummary {
  id: string;
  name: string;
  version: string;
  width: number;
  height: number;
  layersCount: number;
}

/**
 * Template Storage Service
 * Singleton service for managing rendering templates with atomic operations
 */
class TemplateStorageService {
  private static instance: TemplateStorageService;
  private readonly templatesDir: string;
  private initialized: boolean = false;

  private constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TemplateStorageService {
    if (!TemplateStorageService.instance) {
      TemplateStorageService.instance = new TemplateStorageService();
    }
    return TemplateStorageService.instance;
  }

  /**
   * Initialize the service (ensure directory exists)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
      this.initialized = true;
      console.log(`✅ Rendering templates directory initialized: ${this.templatesDir}`);
    } catch (error: any) {
      console.error('❌ Failed to initialize rendering templates directory:', error);
      throw new Error(`Directory initialization failed: ${error.message}`);
    }
  }

  /**
   * Ensure service is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Validate template structure
   */
  public validateTemplate(template: any): ValidationResult {
    if (!template) {
      return { valid: false, error: 'Template object is required' };
    }

    if (!template.id || typeof template.id !== 'string') {
      return { valid: false, error: 'Template ID is required and must be a string' };
    }

    if (!template.name || typeof template.name !== 'string') {
      return { valid: false, error: 'Template name is required and must be a string' };
    }

    if (!template.version || typeof template.version !== 'string') {
      return { valid: false, error: 'Template version is required and must be a string' };
    }

    if (!template.dimensions) {
      return { valid: false, error: 'Template dimensions are required' };
    }

    if (typeof template.dimensions.width !== 'number' || template.dimensions.width <= 0) {
      return { valid: false, error: 'Template width must be a positive number' };
    }

    if (typeof template.dimensions.height !== 'number' || template.dimensions.height <= 0) {
      return { valid: false, error: 'Template height must be a positive number' };
    }

    if (!Array.isArray(template.layers)) {
      return { valid: false, error: 'Template layers must be an array' };
    }

    // Validate ID doesn't contain path traversal characters
    if (template.id.includes('..') || template.id.includes('/') || template.id.includes('\\')) {
      return { valid: false, error: 'Template ID contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Save a new template (fails if already exists)
   */
  public async createTemplate(template: LabelTemplate): Promise<LabelTemplate> {
    await this.ensureInitialized();

    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const filePath = path.join(this.templatesDir, `${template.id}.json`);

    // Check if template already exists
    try {
      await fs.access(filePath);
      throw new Error(`Template with ID "${template.id}" already exists`);
    } catch (error: any) {
      // ENOENT is expected - template doesn't exist yet
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Write template atomically
    await this.writeTemplateAtomic(filePath, template);

    console.log(`✅ Rendering template created: ${template.id} (${template.name})`);

    return template;
  }

  /**
   * Update an existing template (creates if doesn't exist)
   */
  public async updateTemplate(id: string, template: LabelTemplate): Promise<LabelTemplate> {
    await this.ensureInitialized();

    // Validate ID matches
    if (template.id !== id) {
      throw new Error(`URL ID "${id}" does not match template ID "${template.id}"`);
    }

    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const filePath = path.join(this.templatesDir, `${id}.json`);

    // Write template atomically
    await this.writeTemplateAtomic(filePath, template);

    console.log(`✅ Rendering template updated: ${template.id} (${template.name})`);

    return template;
  }

  /**
   * Get a specific template by ID
   */
  public async getTemplate(id: string): Promise<LabelTemplate> {
    await this.ensureInitialized();

    // Validate ID
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw new Error('Invalid template ID');
    }

    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const template = JSON.parse(content);
      return template;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template with ID "${id}" not found`);
      }
      throw error;
    }
  }

  /**
   * List all templates (summaries only)
   */
  public async listTemplates(): Promise<TemplateSummary[]> {
    await this.ensureInitialized();

    let files: string[];
    try {
      files = await fs.readdir(this.templatesDir);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const templates: (TemplateSummary | null)[] = await Promise.all(
      jsonFiles.map(async (file): Promise<TemplateSummary | null> => {
        try {
          const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
          const template = JSON.parse(content);
          return {
            id: template.id,
            name: template.name,
            version: template.version || '1.0.0',
            width: template.dimensions?.width || 0,
            height: template.dimensions?.height || 0,
            layersCount: template.layers?.length || 0,
          };
        } catch (error: any) {
          console.warn(`⚠️ Skipping corrupted template file: ${file}`, error.message);
          return null;
        }
      })
    );

    // Filter out any null values (corrupted files)
    return templates.filter((t): t is TemplateSummary => t !== null);
  }

  /**
   * Delete a template
   */
  public async deleteTemplate(id: string): Promise<void> {
    await this.ensureInitialized();

    // Validate ID
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw new Error('Invalid template ID');
    }

    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      await fs.unlink(filePath);
      console.log(`✅ Rendering template deleted: ${id}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template with ID "${id}" not found`);
      }
      throw error;
    }
  }

  /**
   * Check if a template exists
   */
  public async templateExists(id: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
      return false;
    }

    const filePath = path.join(this.templatesDir, `${id}.json`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write template to file atomically
   * Uses temp file + rename pattern to prevent corruption
   */
  private async writeTemplateAtomic(filePath: string, template: LabelTemplate): Promise<void> {
    const tempPath = `${filePath}.tmp.${randomUUID()}`;

    try {
      // Write to temp file first
      await fs.writeFile(tempPath, JSON.stringify(template, null, 2), 'utf-8');

      // Atomic rename (overwrites destination)
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Get templates directory path
   */
  public getTemplatesDirectory(): string {
    return this.templatesDir;
  }
}

// Export singleton instance
export default TemplateStorageService.getInstance();
