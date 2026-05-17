/**
 * BOOK REVIEW API CLIENT
 * ======================
 * A robust client for interacting with the book review API.
 * Provides methods to fetch books by ISBN, author, title, and reviews.
 * 
 * @author Your Name
 * @version 2.0.0
 */

const axios = require('axios');

// ================================
// CONFIGURATION
// ================================

/**
 * Application configuration object
 * Supports environment variables for different deployment scenarios
 */
const config = {
  // Base URL - can be overridden by environment variable
  baseURL: process.env.BASE_URL || 'http://localhost:5000',
  
  // Request timeout in milliseconds (10 seconds)
  timeout: 10000,
  
  // Number of retry attempts for failed requests
  retries: 3,
  
  // Initial delay between retries (increases exponentially)
  retryDelay: 1000,
  
  // Enable debug logging when true
  debug: process.env.DEBUG === 'true'
};

// ================================
// LOGGING UTILITY
// ================================

/**
 * Simple logger for consistent output formatting
 * Helps with debugging and monitoring application behavior
 */
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
  debug: (msg, ...args) => config.debug && console.debug(`[DEBUG] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args)
};

// ================================
// AXIOS CLIENT SETUP
// ================================

/**
 * Pre-configured axios instance with default headers and timeout
 * This ensures consistent request behavior across all API calls
 */
const apiClient = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'BookReviewAPI-Client/1.0'
  }
});

// ================================
// RETRY MECHANISM
// ================================

/**
 * Implements exponential backoff retry logic for failed requests
 * 
 * Why retry? Network requests can fail temporarily due to:
 * - Network instability
 - Server load spikes
 * - Temporary connection drops
 * 
 * @param {Function} fn - Async function to execute with retry logic
 * @param {number} retries - Number of retry attempts (default from config)
 * @returns {Promise<any>} - Result of the function or throws last error
 */
async function withRetry(fn, retries = config.retries) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // First attempt or retry
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      
      if (isLastAttempt) {
        // No more retries, throw the error
        throw error;
      }
      
      // Calculate delay with exponential backoff: 1s, 2s, 4s, etc.
      const delay = config.retryDelay * Math.pow(2, attempt);
      logger.debug(`Retry ${attempt + 1}/${retries} after ${delay}ms due to: ${error.message}`);
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ================================
// CUSTOM ERROR CLASS
// ================================

/**
 * Custom error class for API-related errors
 * Provides structured error information for better debugging
 */
class APIError extends Error {
  /**
   * Create a new API error
   * @param {number} status - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {string} context - Context where error occurred
   * @param {Error|null} originalError - Original error for debugging
   */
  constructor(status, message, context, originalError = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.context = context;
    this.originalError = originalError;
    
    // Capture stack trace for debugging
    Error.captureStackTrace(this, APIError);
  }
}

// ================================
// ERROR HANDLER
// ================================

/**
 * Centralized error handling with detailed categorization
 * 
 * Why different error types? Each error type requires different:
 * - User messaging
 * - Recovery strategies
 * - Logging levels
 * 
 * @param {Error} error - The caught error object
 * @param {string} context - Description of what was being attempted
 * @throws {APIError} - Standardized API error
 */
function handleAxiosError(error, context = '') {
  let status = 500;
  let message = '';
  
  // Categorize error based on type
  // Connection refused means server is not running
  if (error.code === 'ECONNREFUSED') {
    status = 503; // Service Unavailable
    message = `Cannot connect to server at ${config.baseURL}. Please ensure the server is running on port 5000.`;
    logger.error(`Connection refused: ${config.baseURL}`);
  }
  
  // Request timeout - server took too long to respond
  else if (error.code === 'ECONNABORTED') {
    status = 408; // Request Timeout
    message = 'Request timed out after ' + (config.timeout / 1000) + ' seconds. The server might be under heavy load.';
    logger.warn(`Request timeout for: ${context}`);
  }
  
  // No response from server (network issues)
  else if (error.code === 'ENOTFOUND') {
    status = 503;
    message = `DNS lookup failed for ${config.baseURL}. Please check your network connection and URL.`;
    logger.error(`DNS error: ${config.baseURL}`);
  }
  
  // Handle HTTP response errors
  else if (error.response) {
    status = error.response.status;
    
    // Extract message from response, with fallbacks
    message = error.response.data?.message || 
              error.response.statusText || 
              'An error occurred';
    
    // Special handling for common HTTP status codes
    switch (status) {
      case 400:
        message = `Bad request: ${message}. Please check your input parameters.`;
        break;
      case 401:
        message = `Authentication required: ${message}. Please login first.`;
        break;
      case 403:
        message = `Access forbidden: ${message}. You don't have permission for this action.`;
        break;
      case 404:
        message = `Resource not found: ${message}. The requested data doesn't exist.`;
        break;
      case 429:
        message = `Too many requests: ${message}. Please wait before trying again.`;
        break;
      case 500:
      case 502:
      case 503:
        message = `Server error (${status}): ${message}. Please try again later.`;
        break;
      default:
        message = `HTTP ${status}: ${message}`;
    }
  }
  
  // Handle other errors (network, parsing, etc.)
  else if (error.message) {
    message = error.message;
  }
  
  // Fallback for unknown errors
  else {
    message = 'An unexpected error occurred. Please try again.';
  }
  
  // Log the error with appropriate level based on severity
  if (status >= 500) {
    logger.error(`${context}${message} (Status: ${status})`);
  } else if (status >= 400) {
    logger.warn(`${context}${message} (Status: ${status})`);
  } else {
    logger.debug(`${context}${message} (Status: ${status})`);
  }
  
  throw new APIError(status, message, context, error);
}

// ================================
// RESPONSE VALIDATION
// ================================

/**
 * Validates server response structure and data types
 * Prevents unexpected data shapes from breaking the application
 * 
 * @param {any} data - Response data from server
 * @param {string} expectedType - Expected data type ('object' or 'array')
 * @returns {any} - Validated data
 * @throws {Error} - If validation fails
 */
function validateResponse(data, expectedType = 'object') {
  // Check for null or undefined
  if (!data) {
    throw new Error('Server returned empty response. The requested resource might not exist.');
  }
  
  // Validate array type
  if (expectedType === 'array' && !Array.isArray(data)) {
    throw new Error(`Expected an array response but received: ${typeof data}. API endpoint may have changed.`);
  }
  
  // Validate object type (but not null, which is also an object in JS)
  if (expectedType === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    throw new Error(`Expected an object response but received: ${Array.isArray(data) ? 'array' : typeof data}`);
  }
  
  return data;
}

// ================================
// GENERIC REQUEST HANDLER
// ================================

/**
 * Generic request handler that combines retry logic, validation, and error handling
 * This reduces code duplication across all API methods
 * 
 * @param {string} url - API endpoint URL
 * @param {string|null} validator - Expected response type ('object', 'array', or null for no validation)
 * @returns {Promise<any>} - Response data or null for 404
 */
async function makeRequest(url, validator = null) {
  return withRetry(async () => {
    try {
      logger.debug(`Making API request: ${config.baseURL}${url}`);
      
      const response = await apiClient.get(url);
      
      // Log successful request for debugging
      logger.debug(`Request successful: ${url} (Status: ${response.status})`);
      
      // Validate response structure if validator is specified
      if (validator) {
        return validateResponse(response.data, validator);
      }
      
      return response.data;
      
    } catch (error) {
      // Special handling for 404 - return null instead of throwing
      // This allows graceful handling of "not found" scenarios
      if (error.response?.status === 404) {
        logger.debug(`Resource not found (404): ${url}`);
        return null;
      }
      throw error;
    }
  });
}

// ================================
// PUBLIC API METHODS
// ================================

/**
 * Fetch all books from the library
 * 
 * @returns {Promise<Object>} Object containing all books or empty result message
 * 
 * Example response:
 * {
 *   "1": { "title": "Book 1", "author": "Author 1" },
 *   "2": { "title": "Book 2", "author": "Author 2" }
 * }
 */
async function getAllBooks() {
  try {
    logger.info('Fetching all books from library');
    const books = await makeRequest('/');
    
    // Check if we got any books back
    if (!books || Object.keys(books).length === 0) {
      logger.info('No books found in the database');
      return {
        success: true,
        message: 'No books are currently available in the library.',
        count: 0,
        books: {}
      };
    }
    
    const bookCount = Object.keys(books).length;
    logger.info(`Successfully fetched ${bookCount} books`);
    
    return {
      success: true,
      message: `Found ${bookCount} book(s) in the library`,
      count: bookCount,
      books: books
    };
    
  } catch (error) {
    handleAxiosError(error, 'Failed to fetch all books: ');
  }
}

/**
 * Fetch a single book by its ISBN identifier
 * 
 * @param {string|number} isbn - The ISBN of the book to fetch
 * @returns {Promise<Object>} Book details or not found message
 * 
 * Example response:
 * {
 *   "success": true,
 *   "book": { "title": "Things Fall Apart", "author": "Chinua Achebe" }
 * }
 */
async function getBookByISBN(isbn) {
  // ===== INPUT VALIDATION =====
  // Check if ISBN was provided
  if (!isbn) {
    throw new Error('ISBN is required. Please provide a valid ISBN to search for a book.');
  }
  
  // Convert to string and trim whitespace
  const isbnStr = String(isbn).trim();
  
  // Validate ISBN format (alphanumeric + hyphens, typical for ISBNs)
  // This prevents injection attacks and invalid queries
  if (!isbnStr.match(/^[a-zA-Z0-9-]+$/)) {
    throw new Error('Invalid ISBN format. ISBN should contain only letters, numbers, and hyphens. Example: "978-3-16-148410-0"');
  }
  
  // ===== API REQUEST =====
  try {
    logger.info(`Searching for book with ISBN: ${isbnStr}`);
    
    // Encode URI component to handle special characters safely
    const book = await makeRequest(`/isbn/${encodeURIComponent(isbnStr)}`);
    
    // Handle case where book doesn't exist
    if (!book || Object.keys(book).length === 0) {
      logger.info(`No book found with ISBN: ${isbnStr}`);
      return {
        success: false,
        message: `No book found with ISBN "${isbnStr}". Please check the ISBN and try again.`,
        book: null
      };
    }
    
    // Extract book title for logging (with fallback)
    const bookTitle = book.title || 'Unknown title';
    logger.info(`Successfully found book: ${bookTitle} (ISBN: ${isbnStr})`);
    
    return {
      success: true,
      message: `Book found successfully`,
      book: book
    };
    
  } catch (error) {
    handleAxiosError(error, `Failed to fetch book with ISBN ${isbnStr}: `);
  }
}

/**
 * Fetch all books written by a specific author
 * 
 * @param {string} author - Name of the author to search for
 * @returns {Promise<Object>} Array of books by the author or empty result
 * 
 * Example response:
 * {
 *   "success": true,
 *   "count": 2,
 *   "books": [ { "title": "Book 1" }, { "title": "Book 2" } ]
 * }
 */
async function getBooksByAuthor(author) {
  // ===== INPUT VALIDATION =====
  // Author name is required
  if (!author) {
    throw new Error('Author name is required. Please provide an author name to search for books.');
  }
  
  // Author name must be a string
  if (typeof author !== 'string') {
    throw new Error('Author name must be a string. Received: ' + typeof author);
  }
  
  // Trim whitespace and check minimum length
  const authorName = author.trim();
  if (authorName.length < 2) {
    throw new Error('Author name must be at least 2 characters long. Please provide a valid author name.');
  }
  
  // ===== API REQUEST =====
  try {
    logger.info(`Searching for books by author: "${authorName}"`);
    
    // Make request - validator expects array response
    const books = await makeRequest(`/author/${encodeURIComponent(authorName)}`, 'array');
    
    // Handle case when no books found (null from makeRequest or empty array)
    if (!books || books.length === 0) {
      logger.info(`No books found for author: "${authorName}"`);
      return {
        success: true, // Still success, just no results
        message: `No books found by author "${authorName}". Try checking the spelling or a different author.`,
        count: 0,
        books: []
      };
    }
    
    // Success - found books
    logger.info(`Found ${books.length} book(s) by ${authorName}`);
    return {
      success: true,
      message: `Found ${books.length} book(s) by "${authorName}"`,
      count: books.length,
      books: books
    };
    
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books by author "${authorName}": `);
  }
}

/**
 * Fetch books matching a title (partial match supported)
 * 
 * @param {string} title - Title of the book to search for
 * @returns {Promise<Object>} Array of matching books or empty result
 * 
 * Example response:
 * {
 *   "success": true,
 *   "count": 1,
 *   "books": [ { "title": "Things Fall Apart", "author": "Chinua Achebe" } ]
 * }
 */
async function getBooksByTitle(title) {
  // ===== INPUT VALIDATION =====
  if (!title) {
    throw new Error('Book title is required. Please provide a title to search for.');
  }
  
  if (typeof title !== 'string') {
    throw new Error('Book title must be a string. Received: ' + typeof title);
  }
  
  const bookTitle = title.trim();
  if (bookTitle.length === 0) {
    throw new Error('Book title cannot be empty. Please provide a valid title.');
  }
  
  // ===== API REQUEST =====
  try {
    logger.info(`Searching for books with title containing: "${bookTitle}"`);
    
    const books = await makeRequest(`/title/${encodeURIComponent(bookTitle)}`, 'array');
    
    // Handle no results
    if (!books || books.length === 0) {
      logger.info(`No books found with title containing: "${bookTitle}"`);
      return {
        success: true,
        message: `No books found with title matching "${bookTitle}". Try a different search term.`,
        count: 0,
        books: []
      };
    }
    
    logger.info(`Found ${books.length} book(s) matching title: "${bookTitle}"`);
    return {
      success: true,
      message: `Found ${books.length} book(s) matching "${bookTitle}"`,
      count: books.length,
      books: books
    };
    
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books with title "${bookTitle}": `);
  }
}

/**
 * Fetch reviews for a specific book by ISBN
 * 
 * @param {string|number} isbn - ISBN of the book to get reviews for
 * @returns {Promise<Object>} Reviews object with count and details
 * 
 * Example response:
 * {
 *   "success": true,
 *   "hasReviews": true,
 *   "reviewCount": 2,
 *   "reviews": { "user1": "Great book!", "user2": "Loved it!" }
 * }
 */
async function getBookReviews(isbn) {
  // ===== INPUT VALIDATION =====
  if (!isbn) {
    throw new Error('ISBN is required to fetch book reviews. Please provide a valid ISBN.');
  }
  
  const isbnStr = String(isbn).trim();
  
  // ===== API REQUEST =====
  try {
    logger.info(`Fetching reviews for ISBN: ${isbnStr}`);
    
    const reviews = await makeRequest(`/review/${encodeURIComponent(isbnStr)}`);
    
    // Handle no reviews case
    if (!reviews) {
      logger.info(`No reviews found for ISBN: ${isbnStr}`);
      return {
        success: true,
        message: `No reviews found for book with ISBN "${isbnStr}". Be the first to review this book!`,
        hasReviews: false,
        reviewCount: 0,
        reviews: {}
      };
    }
    
    // Count reviews (handles different response structures)
    let reviewCount = 0;
    let reviewsData = {};
    
    // Check if reviews are nested under a 'reviews' property
    if (reviews.reviews && typeof reviews.reviews === 'object') {
      reviewCount = Object.keys(reviews.reviews).length;
      reviewsData = reviews.reviews;
    }
    // Or if reviews is directly the object
    else if (typeof reviews === 'object' && !Array.isArray(reviews)) {
      reviewCount = Object.keys(reviews).length;
      reviewsData = reviews;
    }
    
    if (reviewCount === 0) {
      return {
        success: true,
        message: `This book has no reviews yet. Be the first to write a review!`,
        hasReviews: false,
        reviewCount: 0,
        reviews: {}
      };
    }
    
    logger.info(`Found ${reviewCount} review(s) for ISBN: ${isbnStr}`);
    return {
      success: true,
      message: `Found ${reviewCount} review(s) for this book`,
      hasReviews: true,
      reviewCount: reviewCount,
      reviews: reviewsData
    };
    
  } catch (error) {
    handleAxiosError(error, `Failed to fetch reviews for ISBN ${isbnStr}: `);
  }
}

// ================================
// BATCH OPERATIONS (EXTRA FEATURE)
// ================================

/**
 * Fetch multiple books by their ISBNs in a single batch operation
 * Useful for getting multiple books efficiently
 * 
 * @param {string[]} isbns - Array of ISBN strings/numbers to fetch
 * @returns {Promise<Object>} Results grouped by success/failure
 * 
 * Example response:
 * {
 *   "total": 3,
 *   "successful": 2,
 *   "failed": 1,
 *   "results": { "successful": [...], "failed": [...] }
 * }
 */
async function getBooksByMultipleISBNs(isbns) {
  // Validate input
  if (!Array.isArray(isbns)) {
    throw new Error('Please provide an array of ISBNs. Example: ["123", "456", "789"]');
  }
  
  if (isbns.length === 0) {
    throw new Error('ISBNs array cannot be empty. Please provide at least one ISBN to fetch.');
  }
  
  if (isbns.length > 10) {
    logger.warn(`Batch request contains ${isbns.length} ISBNs. This may take a while.`);
  }
  
  logger.info(`Starting batch fetch for ${isbns.length} ISBN(s)`);
  
  // Track results
  const results = {
    total: isbns.length,
    successful: [],
    failed: [],
    successfulCount: 0,
    failedCount: 0
  };
  
  // Process each ISBN (sequentially to avoid overwhelming the server)
  for (let i = 0; i < isbns.length; i++) {
    const isbn = isbns[i];
    try {
      logger.debug(`Processing batch item ${i + 1}/${isbns.length}: ISBN ${isbn}`);
      const book = await getBookByISBN(isbn);
      
      if (book.success && book.book) {
        results.successful.push({ isbn, book: book.book });
        results.successfulCount++;
      } else {
        results.failed.push({ isbn, reason: book.message });
        results.failedCount++;
      }
    } catch (error) {
      results.failed.push({ isbn, reason: error.message });
      results.failedCount++;
    }
  }
  
  logger.info(`Batch fetch complete: ${results.successfulCount}/${results.total} successful`);
  
  return {
    success: results.failedCount === 0,
    message: `Fetched ${results.successfulCount} of ${results.total} books successfully`,
    ...results
  };
}

// ================================
// TEST / DEMONSTRATION FUNCTION
// ================================

/**
 * Demonstration function showing how to use the API client
 * Runs comprehensive tests of all functionality
 * Only executes when this file is run directly (not imported)
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 BOOK REVIEW API CLIENT - TEST SUITE');
  console.log('='.repeat(60));
  logger.info(`API Base URL: ${config.baseURL}`);
  logger.info(`Debug mode: ${config.debug ? 'ON' : 'OFF'}`);
  
  try {
    // TEST 1: Get all books
    console.log('\n📖 TEST 1: Fetching all books...');
    const allBooks = await getAllBooks();
    console.log(`✓ ${allBooks.message}`);
    if (allBooks.count > 0) {
      console.log(`  Sample book: ${Object.keys(allBooks.books)[0]}`);
    }
    
    // TEST 2: Get book by ISBN
    console.log('\n🔍 TEST 2: Fetching book by ISBN "1"...');
    const bookByISBN = await getBookByISBN('1');
    if (bookByISBN.success) {
      console.log(`✓ ${bookByISBN.message}`);
      if (bookByISBN.book) {
        console.log(`  Title: ${bookByISBN.book.title || 'N/A'}`);
        console.log(`  Author: ${bookByISBN.book.author || 'N/A'}`);
      }
    } else {
      console.log(`ℹ ${bookByISBN.message}`);
    }
    
    // TEST 3: Search by author
    console.log('\n✍️ TEST 3: Fetching books by author "Chinua Achebe"...');
    const authorBooks = await getBooksByAuthor('Chinua Achebe');
    console.log(`✓ ${authorBooks.message}`);
    if (authorBooks.count > 0 && authorBooks.books[0]) {
      console.log(`  First book: ${authorBooks.books[0].title || 'N/A'}`);
    }
    
    // TEST 4: Search by title
    console.log('\n🔎 TEST 4: Fetching books by title "Things Fall Apart"...');
    const titleBooks = await getBooksByTitle('Things Fall Apart');
    console.log(`✓ ${titleBooks.message}`);
    
    // TEST 5: Get book reviews
    console.log('\n⭐ TEST 5: Fetching reviews for ISBN "1"...');
    const reviews = await getBookReviews('1');
    console.log(`✓ ${reviews.message}`);
    if (reviews.hasReviews) {
      console.log(`  Number of reviews: ${reviews.reviewCount}`);
      const firstReviewer = Object.keys(reviews.reviews)[0];
      if (firstReviewer) {
        console.log(`  Sample review from ${firstReviewer}: "${reviews.reviews[firstReviewer]}"`);
      }
    }
    
    // TEST 6: Edge case - non-existent author (demonstrates graceful handling)
    console.log('\n❌ TEST 6: Testing non-existent author (graceful handling)...');
    const nonExistentAuthor = await getBooksByAuthor('ThisAuthorDoesNotExistXYZ123');
    console.log(`✓ ${nonExistentAuthor.message}`);
    console.log(`  Count: ${nonExistentAuthor.count}`);
    
    // TEST 7: Edge case - invalid ISBN format
    console.log('\n⚠️ TEST 7: Testing invalid ISBN format...');
    try {
      await getBookByISBN('invalid@#$%');
    } catch (error) {
      console.log(`✓ Properly rejected invalid ISBN: ${error.message}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n💡 Pro tip: Set DEBUG=true environment variable for detailed logging');
    console.log('💡 Example: DEBUG=true node book-api.js\n');
    
  } catch (error) {
    logger.error('\n❌ Test suite failed:', error.message);
    if (error.originalError) {
      logger.error('Original error:', error.originalError.message);
    }
    process.exit(1);
  }
}

// ================================
// MODULE EXPORTS
// ================================

/**
 * Execute main() only when this file is run directly
 * This allows the file to be both a library and a test script
 */
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in main():', error);
    process.exit(1);
  });
}

/**
 * Public API Exports
 * These functions are available when importing this module
 * 
 * @example
 * const { getAllBooks, getBookByISBN } = require('./book-api');
 * const books = await getAllBooks();
 */
module.exports = {
  // Core API methods
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
  getBookReviews,
  
  // Utility methods
  getBooksByMultipleISBNs,
  
  // Exported for advanced use cases
  APIError,
  config
};
