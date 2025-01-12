import fs from 'fs/promises';
import path from 'path';

const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

const logger = {
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  info: (message) => console.log(`[INFO] ${message}`)
};

/**
 * Invalidates the cache for a specific path or entirely
 * @param {string} [specificPath] - Optional path to invalidate specific cache entry
 * @returns {boolean} True if invalidation was successful, false otherwise
 * @throws {Error} If path normalization fails
 */
function invalidateCache(specificPath) {
  try {
    if (specificPath) {
      if (typeof specificPath !== 'string') {
        throw new TypeError('specificPath must be a string when provided');
      }
      const normalizedPath = path.normalize(specificPath);
      const deleted = cache.delete(normalizedPath);
      logger.info(`Cache invalidated for path: ${normalizedPath}`);
      return deleted;
    }
    
    const size = cache.size;
    cache.clear();
    logger.info('Full cache invalidation completed');
    return size > 0;
  } catch (error) {
    logger.error(`Cache invalidation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Helper function to filter and validate user items
 * @param {Object} item - User data item to validate
 * @returns {boolean} Whether the item is valid and meets criteria
 */
function isValidUserItem(item) {
  return (
    item &&
    typeof item === 'object' &&
    item.status === 'active' &&
    !isNaN(Number(item.score)) &&
    Number(item.score) > 75
  );
}

/**
 * Processes user data to filter active users with high scores
 * @param {Array<Object>} userData - Array of user objects
 * @returns {Array<Object>} Filtered and transformed user data
 * @throws {TypeError} If input is not an array
 */
function processUserData(userData) {
  if (!Array.isArray(userData)) {
    throw new TypeError('userData must be an array');
  }

  const cachedKey = JSON.stringify(userData);
  const cachedResult = cache.get(cachedKey);
  
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return cachedResult.data;
  }

  const processedData = userData
    .filter(isValidUserItem)
    .map(item => {
      if (!item.id || !item.name) {
        logger.error(`Invalid user data: missing required fields for user ${item.id || 'unknown'}`);
        return null;
      }

      try {
        return {
          id: item.id,
          name: item.name,
          score: Number(item.score),
          rank: calculateRank(Number(item.score))
        };
      } catch (error) {
        logger.error(`Error processing user ${item.id}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);

  cache.set(cachedKey, {
    data: processedData,
    timestamp: Date.now()
  });

  return processedData;
}

/**
 * Generates a report from the provided data with enhanced error handling and performance
 * @param {Array<Object>} data - Array of data entries
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.excludeInactive] - Whether to exclude inactive entries
 * @param {boolean} [options.includeMetrics] - Whether to include metrics
 * @param {string} [options.dateFormat] - Custom date format (default: 'YYYY-MM-DD')
 * @returns {Object} Generated report
 * @throws {TypeError} If data is not an array
 */
function generateReport(data, options = {}) {
  if (!Array.isArray(data)) {
    throw new TypeError('Data must be an array');
  }

  const cacheKey = `report_${JSON.stringify(data)}_${JSON.stringify(options)}`;
  const cachedReport = cache.get(cacheKey);
  
  if (cachedReport && Date.now() - cachedReport.timestamp < CACHE_TTL) {
    return cachedReport.data;
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalEntries: data.length,
    processedEntries: 0,
    skippedEntries: 0,
    entries: []
  };

  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    batch.forEach(item => {
      if (!item?.id || typeof item !== 'object') {
        logger.warn(`Skipping invalid item in report generation: ${JSON.stringify(item)}`);
        report.skippedEntries++;
        return;
      }

      if (options.excludeInactive && !item.active) {
        report.skippedEntries++;
        return;
      }

      try {
        const entry = {
          id: item.id,
          status: item.status || 'unknown',
          lastUpdated: item.updated ? formatDate(item.updated) : null
        };

        if (options.includeMetrics) {
          entry.metrics = calculateEngagement(item);
        }

        report.entries.push(entry);
        report.processedEntries++;
      } catch (error) {
        logger.error(`Error processing report entry ${item.id}: ${error.message}`);
        report.skippedEntries++;
      }
    });
  }

  cache.set(cacheKey, {
    data: report,
    timestamp: Date.now()
  });

  return report;
}

const ALLOWED_THEMES = ['light', 'dark', 'system'];
const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it'];

/**
 * Validates and sanitizes user preferences
 * @param {Object} preferences - Preferences object to validate
 * @returns {Object} Validated and sanitized preferences
 * @throws {Error} If preferences contain invalid values
 */
function validatePreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  const sanitized = {};
  const errors = [];

  // Theme validation
  if (preferences.theme && !ALLOWED_THEMES.includes(preferences.theme)) {
    errors.push(`Invalid theme: ${preferences.theme}. Allowed values: ${ALLOWED_THEMES.join(', ')}`);
    sanitized.theme = DEFAULT_PREFERENCES.theme;
  } else {
    sanitized.theme = preferences.theme || DEFAULT_PREFERENCES.theme;
  }

  // Notifications validation
  sanitized.notifications = Boolean(preferences.notifications);

  // Language validation
  if (preferences.language && !ALLOWED_LANGUAGES.includes(preferences.language)) {
    errors.push(`Invalid language: ${preferences.language}. Allowed values: ${ALLOWED_LANGUAGES.join(', ')}`);
    sanitized.language = DEFAULT_PREFERENCES.language;
  } else {
    sanitized.language = preferences.language || DEFAULT_PREFERENCES.language;
  }

  if (errors.length > 0) {
    logger.warn(`Preference validation warnings: ${errors.join('; ')}`);
  }

  return sanitized;
}

/**
 * Loads user preferences from file or cache with enhanced security and performance
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User preferences
 * @throws {TypeError} If userId is invalid
 */
async function loadUserPreferences(userId) {
  if (!userId || typeof userId !== 'string' || !userId.match(/^[a-zA-Z0-9_-]+$/)) {
    throw new TypeError('Invalid userId format');
  }

  const cacheKey = `prefs_${userId}`;
  const cachedPrefs = cache.get(cacheKey);
  
  if (cachedPrefs && Date.now() - cachedPrefs.timestamp < CACHE_TTL) {
    return cachedPrefs.data;
  }

  try {
    const sanitizedUserId = path.basename(userId);
    const prefsPath = path.join('data', 'preferences', `${sanitizedUserId}.json`);
    const stats = await fs.stat(prefsPath);
    
    if (cachedPrefs?.lastModified === stats.mtime.getTime()) {
      return cachedPrefs.data;
    }

    const data = await fs.readFile(prefsPath, 'utf8');
    const rawPreferences = JSON.parse(data);
    const preferences = validatePreferences(rawPreferences);
    
    cache.set(cacheKey, {
      data: preferences,
      timestamp: Date.now(),
      lastModified: stats.mtime.getTime()
    });
    
    return preferences;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info(`No preferences file found for user ${userId}, using defaults`);
      return { ...DEFAULT_PREFERENCES };
    }
    
    if (error instanceof SyntaxError) {
      logger.error(`Invalid JSON in preferences file for user ${userId}`);
      return { ...DEFAULT_PREFERENCES };
    }
    
    logger.error(`Error loading preferences for user ${userId}: ${error.message}`);
    throw error;
  }
}

export {
  readConfigFile,
  invalidateCache,
  processUserData,
  calculateRank,
  formatDate,
  generateReport,
  loadUserPreferences
};