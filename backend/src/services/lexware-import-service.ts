import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Lexware Import Service
 * Handles discovery, pairing, and orchestration of Lexware screenshot imports
 * Processes 38 articles (76 screenshots) from the Lexware export folder
 */

export interface ImagePair {
  articleNumber: string;
  screen1Path: string; // e.g., "1127.png"
  screen2Path: string; // e.g., "1127,2.png"
  status: 'valid' | 'missing_screen2' | 'missing_screen1' | 'invalid';
  screen1Exists: boolean;
  screen2Exists: boolean;
}

export interface ImportManifest {
  id: string;
  folderPath: string;
  totalFiles: number;
  totalPairs: number;
  validPairs: ImagePair[];
  incompletePairs: ImagePair[];
  invalidPairs: ImagePair[];
  createdAt: Date;
  stats: {
    complete: number;
    incomplete: number;
    invalid: number;
  };
}

export interface ValidationResult {
  pair: ImagePair;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class LexwareImportService {
  private readonly LEXWARE_FOLDER = 'C:\\Users\\benfi\\Documents\\Fehlende Artikel Lexware Bilder';
  private readonly SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

  /**
   * Discovers and groups screenshot files into article pairs
   * Expected pattern: articleNumber.png and articleNumber,2.png
   */
  async discoverImagePairs(folderPath?: string): Promise<ImagePair[]> {
    const targetFolder = folderPath || this.LEXWARE_FOLDER;
    console.log(`🔍 Discovering Lexware screenshots in: ${targetFolder}`);

    try {
      // Read all files in the directory
      const files = await fs.readdir(targetFolder);
      const imageFiles = files.filter((file) =>
        this.SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
      );

      console.log(`📁 Found ${imageFiles.length} total image files`);

      // Group files by article number
      const articleMap = new Map<string, { screen1?: string; screen2?: string }>();

      for (const file of imageFiles) {
        const fileName = path.basename(file, path.extname(file));

        if (fileName.endsWith(',2')) {
          // This is a second screenshot (e.g., "1127,2")
          const articleNumber = fileName.slice(0, -2); // Remove ",2"
          const existing = articleMap.get(articleNumber) || {};
          existing.screen2 = file;
          articleMap.set(articleNumber, existing);
        } else {
          // This is a first screenshot (e.g., "1127")
          const articleNumber = fileName;
          const existing = articleMap.get(articleNumber) || {};
          existing.screen1 = file;
          articleMap.set(articleNumber, existing);
        }
      }

      // Convert map to ImagePair array
      const pairs: ImagePair[] = [];

      for (const [articleNumber, screens] of articleMap.entries()) {
        const screen1Path = screens.screen1 ? path.join(targetFolder, screens.screen1) : '';
        const screen2Path = screens.screen2 ? path.join(targetFolder, screens.screen2) : '';

        // Check actual file existence
        const screen1Exists = screen1Path ? await this.fileExists(screen1Path) : false;
        const screen2Exists = screen2Path ? await this.fileExists(screen2Path) : false;

        let status: ImagePair['status'] = 'invalid';
        if (screen1Exists && screen2Exists) {
          status = 'valid';
        } else if (screen1Exists && !screen2Exists) {
          status = 'missing_screen2';
        } else if (!screen1Exists && screen2Exists) {
          status = 'missing_screen1';
        }

        pairs.push({
          articleNumber,
          screen1Path,
          screen2Path,
          status,
          screen1Exists,
          screen2Exists,
        });
      }

      // Sort by article number for consistent processing
      pairs.sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));

      console.log(`✅ Discovered ${pairs.length} article pairs:`);
      console.log(`   - Valid pairs: ${pairs.filter((p) => p.status === 'valid').length}`);
      console.log(
        `   - Missing screen2: ${pairs.filter((p) => p.status === 'missing_screen2').length}`
      );
      console.log(
        `   - Missing screen1: ${pairs.filter((p) => p.status === 'missing_screen1').length}`
      );
      console.log(`   - Invalid: ${pairs.filter((p) => p.status === 'invalid').length}`);

      return pairs;
    } catch (error) {
      console.error(`❌ Error discovering image pairs: ${error}`);
      throw error;
    }
  }

  /**
   * Validates discovered image pairs
   * Checks file existence, readability, and basic integrity
   */
  async validateImagePairs(pairs: ImagePair[]): Promise<ValidationResult[]> {
    console.log(`🔍 Validating ${pairs.length} image pairs...`);

    const results: ValidationResult[] = [];

    for (const pair of pairs) {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check article number format
      if (!pair.articleNumber || pair.articleNumber.length < 3) {
        errors.push(`Invalid article number: ${pair.articleNumber}`);
      }

      // Validate file paths
      if (pair.status === 'valid') {
        // Both files should exist for valid pairs
        if (!pair.screen1Exists) {
          errors.push(`Screen 1 file does not exist: ${pair.screen1Path}`);
        }
        if (!pair.screen2Exists) {
          errors.push(`Screen 2 file does not exist: ${pair.screen2Path}`);
        }
      } else if (pair.status === 'missing_screen2') {
        warnings.push(`Missing price screenshot (,2) for article ${pair.articleNumber}`);
        warnings.push('Will attempt to extract with limited data');
      } else if (pair.status === 'missing_screen1') {
        errors.push(`Missing main screenshot for article ${pair.articleNumber}`);
      }

      // Check file sizes (basic integrity check)
      if (pair.screen1Exists) {
        try {
          const stats = await fs.stat(pair.screen1Path);
          if (stats.size < 1000) {
            // Less than 1KB is suspicious
            warnings.push(`Screen 1 file seems too small: ${stats.size} bytes`);
          }
        } catch (err) {
          errors.push(`Cannot read screen 1 file: ${err}`);
        }
      }

      if (pair.screen2Exists) {
        try {
          const stats = await fs.stat(pair.screen2Path);
          if (stats.size < 1000) {
            warnings.push(`Screen 2 file seems too small: ${stats.size} bytes`);
          }
        } catch (err) {
          errors.push(`Cannot read screen 2 file: ${err}`);
        }
      }

      results.push({
        pair,
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    }

    // Summary statistics
    const validCount = results.filter((r) => r.isValid).length;
    const withWarnings = results.filter((r) => r.warnings.length > 0).length;
    const withErrors = results.filter((r) => r.errors.length > 0).length;

    console.log(`✅ Validation complete:`);
    console.log(`   - Valid: ${validCount}/${pairs.length}`);
    console.log(`   - With warnings: ${withWarnings}`);
    console.log(`   - With errors: ${withErrors}`);

    return results;
  }

  /**
   * Creates an import manifest for tracking and auditing
   */
  async createImportManifest(pairs: ImagePair[], folderPath?: string): Promise<ImportManifest> {
    const targetFolder = folderPath || this.LEXWARE_FOLDER;

    const manifest: ImportManifest = {
      id: uuidv4(),
      folderPath: targetFolder,
      totalFiles: pairs.reduce((count, pair) => {
        count += pair.screen1Exists ? 1 : 0;
        count += pair.screen2Exists ? 1 : 0;
        return count;
      }, 0),
      totalPairs: pairs.length,
      validPairs: pairs.filter((p) => p.status === 'valid'),
      incompletePairs: pairs.filter(
        (p) => p.status === 'missing_screen1' || p.status === 'missing_screen2'
      ),
      invalidPairs: pairs.filter((p) => p.status === 'invalid'),
      createdAt: new Date(),
      stats: {
        complete: pairs.filter((p) => p.status === 'valid').length,
        incomplete: pairs.filter(
          (p) => p.status === 'missing_screen1' || p.status === 'missing_screen2'
        ).length,
        invalid: pairs.filter((p) => p.status === 'invalid').length,
      },
    };

    console.log(`📋 Import Manifest Created:`);
    console.log(`   - ID: ${manifest.id}`);
    console.log(`   - Total Files: ${manifest.totalFiles}`);
    console.log(`   - Total Pairs: ${manifest.totalPairs}`);
    console.log(`   - Complete Pairs: ${manifest.stats.complete}`);
    console.log(`   - Incomplete Pairs: ${manifest.stats.incomplete}`);
    console.log(`   - Invalid Pairs: ${manifest.stats.invalid}`);

    return manifest;
  }

  /**
   * Helper method to check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed statistics about the import folder
   */
  async getFolderStatistics(folderPath?: string): Promise<{
    totalFiles: number;
    imageFiles: number;
    screen1Files: number;
    screen2Files: number;
    articleNumbers: string[];
    filesByExtension: Record<string, number>;
  }> {
    const targetFolder = folderPath || this.LEXWARE_FOLDER;

    try {
      const files = await fs.readdir(targetFolder);
      const imageFiles = files.filter((file) =>
        this.SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
      );

      const screen1Files = imageFiles.filter((f) => !f.includes(',2'));
      const screen2Files = imageFiles.filter((f) => f.includes(',2'));

      const articleNumbers = new Set<string>();
      for (const file of imageFiles) {
        const fileName = path.basename(file, path.extname(file));
        const articleNumber = fileName.endsWith(',2') ? fileName.slice(0, -2) : fileName;
        articleNumbers.add(articleNumber);
      }

      // Count files by extension
      const filesByExtension: Record<string, number> = {};
      for (const file of imageFiles) {
        const ext = path.extname(file).toLowerCase();
        filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
      }

      return {
        totalFiles: files.length,
        imageFiles: imageFiles.length,
        screen1Files: screen1Files.length,
        screen2Files: screen2Files.length,
        articleNumbers: Array.from(articleNumbers).sort(),
        filesByExtension,
      };
    } catch (error) {
      console.error(`❌ Error getting folder statistics: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance for use in other modules
const lexwareImportService = new LexwareImportService();
export default lexwareImportService;
