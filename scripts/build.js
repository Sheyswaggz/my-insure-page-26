/**
 * Production Build Script for Static Site
 * 
 * This script handles the complete build process for the insurance landing page:
 * - Creates dist/ directory structure
 * - Copies HTML files with validation
 * - Copies static assets (CSS, JS, images)
 * - Logs build metrics and file sizes
 * - Provides comprehensive error handling and recovery
 * 
 * @module scripts/build
 * @requires fs - Node.js file system module
 * @requires path - Node.js path module
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build configuration
const BUILD_CONFIG = {
  sourceDir: path.resolve(__dirname, '..', 'src'),
  distDir: path.resolve(__dirname, '..', 'dist'),
  assetDirs: ['css', 'js', 'images', 'fonts', 'assets'],
  htmlFiles: ['index.html'],
  startTime: Date.now(),
};

// Build statistics tracking
const buildStats = {
  filesProcessed: 0,
  totalSize: 0,
  errors: [],
  warnings: [],
  directories: [],
  files: [],
};

/**
 * Structured logging utility with timestamp and context
 * @param {string} level - Log level (INFO, WARN, ERROR, SUCCESS)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };

  const prefix = `[${timestamp}] [${level}]`;
  
  switch (level) {
    case 'ERROR':
      console.error(`${prefix} ${message}`, context.error ? `\n${context.error.stack}` : '');
      break;
    case 'WARN':
      console.warn(`${prefix} ${message}`);
      break;
    case 'SUCCESS':
      console.log(`${prefix} ✓ ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to ensure
 * @throws {Error} If directory creation fails
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      log('INFO', `Created directory: ${path.relative(process.cwd(), dirPath)}`);
      buildStats.directories.push(dirPath);
    }
  } catch (error) {
    const errorMsg = `Failed to create directory: ${dirPath}`;
    log('ERROR', errorMsg, { error });
    buildStats.errors.push({ path: dirPath, error: error.message });
    throw new Error(`${errorMsg}: ${error.message}`);
  }
}

/**
 * Copy file with error handling and statistics tracking
 * @param {string} source - Source file path
 * @param {string} destination - Destination file path
 * @returns {boolean} Success status
 */
function copyFileWithStats(source, destination) {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    ensureDirectoryExists(destDir);

    // Read source file
    const content = fs.readFileSync(source);
    
    // Write to destination
    fs.writeFileSync(destination, content, { mode: 0o644 });
    
    // Get file stats
    const stats = fs.statSync(destination);
    const relativePath = path.relative(BUILD_CONFIG.distDir, destination);
    
    buildStats.filesProcessed++;
    buildStats.totalSize += stats.size;
    buildStats.files.push({
      path: relativePath,
      size: stats.size,
      formattedSize: formatBytes(stats.size),
    });

    log('SUCCESS', `Copied: ${relativePath} (${formatBytes(stats.size)})`);
    return true;
  } catch (error) {
    const errorMsg = `Failed to copy file: ${source} -> ${destination}`;
    log('ERROR', errorMsg, { error });
    buildStats.errors.push({
      source,
      destination,
      error: error.message,
    });
    return false;
  }
}

/**
 * Recursively copy directory contents
 * @param {string} sourceDir - Source directory path
 * @param {string} destDir - Destination directory path
 * @returns {number} Number of files copied
 */
function copyDirectory(sourceDir, destDir) {
  let copiedCount = 0;

  try {
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      log('WARN', `Source directory does not exist: ${sourceDir}`);
      buildStats.warnings.push(`Directory not found: ${sourceDir}`);
      return 0;
    }

    // Ensure destination directory exists
    ensureDirectoryExists(destDir);

    // Read directory contents
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectories
        copiedCount += copyDirectory(sourcePath, destPath);
      } else if (entry.isFile()) {
        // Copy file
        if (copyFileWithStats(sourcePath, destPath)) {
          copiedCount++;
        }
      } else {
        log('WARN', `Skipping non-file/non-directory: ${sourcePath}`);
        buildStats.warnings.push(`Skipped: ${sourcePath}`);
      }
    }

    return copiedCount;
  } catch (error) {
    const errorMsg = `Failed to copy directory: ${sourceDir}`;
    log('ERROR', errorMsg, { error });
    buildStats.errors.push({
      directory: sourceDir,
      error: error.message,
    });
    return copiedCount;
  }
}

/**
 * Clean dist directory before build
 * @returns {boolean} Success status
 */
function cleanDistDirectory() {
  try {
    if (fs.existsSync(BUILD_CONFIG.distDir)) {
      log('INFO', 'Cleaning dist directory...');
      fs.rmSync(BUILD_CONFIG.distDir, { recursive: true, force: true });
      log('SUCCESS', 'Dist directory cleaned');
    }
    return true;
  } catch (error) {
    log('ERROR', 'Failed to clean dist directory', { error });
    buildStats.errors.push({
      operation: 'clean',
      error: error.message,
    });
    return false;
  }
}

/**
 * Copy HTML files from source to dist
 * @returns {number} Number of HTML files copied
 */
function copyHtmlFiles() {
  log('INFO', 'Copying HTML files...');
  let copiedCount = 0;

  for (const htmlFile of BUILD_CONFIG.htmlFiles) {
    const sourcePath = path.join(BUILD_CONFIG.sourceDir, htmlFile);
    const destPath = path.join(BUILD_CONFIG.distDir, htmlFile);

    if (!fs.existsSync(sourcePath)) {
      log('WARN', `HTML file not found: ${htmlFile}`);
      buildStats.warnings.push(`HTML file not found: ${htmlFile}`);
      continue;
    }

    if (copyFileWithStats(sourcePath, destPath)) {
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * Copy static asset directories
 * @returns {number} Total number of asset files copied
 */
function copyAssets() {
  log('INFO', 'Copying static assets...');
  let totalCopied = 0;

  for (const assetDir of BUILD_CONFIG.assetDirs) {
    const sourceDir = path.join(BUILD_CONFIG.sourceDir, assetDir);
    const destDir = path.join(BUILD_CONFIG.distDir, assetDir);

    log('INFO', `Processing asset directory: ${assetDir}`);
    const copiedCount = copyDirectory(sourceDir, destDir);
    
    if (copiedCount > 0) {
      log('SUCCESS', `Copied ${copiedCount} files from ${assetDir}/`);
    }
    
    totalCopied += copiedCount;
  }

  return totalCopied;
}

/**
 * Generate and log build summary
 */
function logBuildSummary() {
  const buildTime = Date.now() - BUILD_CONFIG.startTime;
  const buildTimeSeconds = (buildTime / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  log('INFO', 'BUILD SUMMARY');
  console.log('='.repeat(60));
  
  log('INFO', `Build Time: ${buildTimeSeconds}s`);
  log('INFO', `Files Processed: ${buildStats.filesProcessed}`);
  log('INFO', `Total Size: ${formatBytes(buildStats.totalSize)}`);
  log('INFO', `Directories Created: ${buildStats.directories.length}`);
  
  if (buildStats.warnings.length > 0) {
    console.log('\n' + '-'.repeat(60));
    log('WARN', `Warnings: ${buildStats.warnings.length}`);
    buildStats.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }

  if (buildStats.errors.length > 0) {
    console.log('\n' + '-'.repeat(60));
    log('ERROR', `Errors: ${buildStats.errors.length}`);
    buildStats.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${JSON.stringify(error, null, 2)}`);
    });
  }

  if (buildStats.files.length > 0) {
    console.log('\n' + '-'.repeat(60));
    log('INFO', 'Files in dist/');
    console.log('-'.repeat(60));
    buildStats.files.forEach((file) => {
      console.log(`  ${file.path.padEnd(40)} ${file.formattedSize.padStart(10)}`);
    });
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Main build process orchestration
 * @returns {Promise<number>} Exit code (0 for success, 1 for failure)
 */
async function build() {
  try {
    log('INFO', 'Starting build process...');
    log('INFO', `Source: ${BUILD_CONFIG.sourceDir}`);
    log('INFO', `Destination: ${BUILD_CONFIG.distDir}`);

    // Step 1: Clean dist directory
    if (!cleanDistDirectory()) {
      throw new Error('Failed to clean dist directory');
    }

    // Step 2: Create dist directory
    ensureDirectoryExists(BUILD_CONFIG.distDir);

    // Step 3: Copy HTML files
    const htmlCount = copyHtmlFiles();
    if (htmlCount === 0) {
      log('WARN', 'No HTML files were copied');
    }

    // Step 4: Copy static assets
    const assetCount = copyAssets();
    log('INFO', `Total asset files copied: ${assetCount}`);

    // Step 5: Generate build summary
    logBuildSummary();

    // Determine build status
    if (buildStats.errors.length > 0) {
      log('ERROR', 'Build completed with errors');
      return 1;
    } else if (buildStats.filesProcessed === 0) {
      log('WARN', 'Build completed but no files were processed');
      return 1;
    } else {
      log('SUCCESS', 'Build completed successfully!');
      return 0;
    }
  } catch (error) {
    log('ERROR', 'Build process failed', { error });
    console.error('\nBuild failed with error:', error.message);
    console.error(error.stack);
    return 1;
  }
}

/**
 * Entry point - Execute build and exit with appropriate code
 */
build()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    log('ERROR', 'Unhandled error in build process', { error });
    console.error('Fatal error:', error);
    process.exit(1);
  });