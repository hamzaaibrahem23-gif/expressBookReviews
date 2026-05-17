const axios = require('axios');

/**
 * Configuration object for the API client
 */
const config = {
  baseURL: process.env.BASE_URL || 'http://localhost:5000',
  timeout: 10000, // 10 seconds timeout
  retries: 3, // Number of retries for failed requests
  retryDelay: 1000 // Delay between retries in ms
};

/**
 * Logger utility for consistent logging
 */
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
  debug: (msg, ...args) => process.env.DEBUG === 'true' && console.debug(`[DEBUG] ${msg}`, ...args)
};

/**
 * Creates an axios instance with default configuration
 */
const apiClient = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Retry logic for failed requests
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retry attempts
 * @returns {Promise} - Result of the function
 */
async function withRetry(fn, retries = config.retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      if (isLastAttempt) throw error;
      
      logger.debug(`Retry attempt ${i + 1}/${retries} after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, config.retryDelay * (i + 1)));
    }
  }
}

/**
 * Centralized error handling with detailed context
 */
class APIError extends Error {
  constructor(status, message, context, originalError = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Enhanced error handler with better message formatting
 */
function handleAxiosError(error, context = '') {
  const status = error.response?.status || error.code === 'ECONNABORTED' ? 408 : 500;
  
  // Handle different error types
  let message = '';
  if (error.code === 'ECONNREFUSED') {
    message = `Cannot connect to server at ${config.baseURL}. Please ensure the server is running.`;
  } else if (error.code === 'ECONNABORTED') {
    message = 'Request timed out. The server might be slow or unresponsive.';
  } else if (error.response?.data?.message) {
    message = error.response.data.message;
  } else if (error.response?.statusText) {
    message = error.response.statusText;
  } else if (error.message) {
    message = error.message;
  } else {
    message = 'An unknown error occurred';
  }
  
  // Add HTTP status specific messages
  if (status === 404) {
    message = `Resource not found: ${message}`;
  } else if (status === 401) {
    message = `Authentication required: ${message}`;
  } else if (status === 403) {
    message = `Access forbidden: ${message}`;
  } else if (status >= 500) {
    message = `Server error (${status}): ${message}. Please try again later.`;
  }
  
  logger.error(`${context}${message} (Status: ${status})`);
  throw new APIError(status, message, context, error);
}

/**
 * Validate that the response contains valid data
 */
function validateResponse(data, expectedType = 'object') {
  if (!data) {
    throw new Error('Server returned empty response');
  }
  
  if (expectedType === 'array' && !Array.isArray(data)) {
    throw new Error('Expected array response but got different format');
  }
  
  if (expectedType === 'object' && (typeof data !== 'object' || data === null)) {
    throw new Error('Expected object response but got different format');
  }
  
  return data;
}

/**
 * Generic request handler with retry logic and validation
 */
async function makeRequest(url, validator = null) {
  return withRetry(async () => {
    try {
      logger.debug(`Making request to: ${url}`);
      const response = await apiClient.get(url);
      
      if (!response || !response.data) {
        throw new Error('Invalid response structure from server');
      }
      
      const data = validateResponse(response.data, validator);
      logger.debug(`Request successful: ${url} (Status: ${response.status})`);
      
      return data;
    } catch (error) {
      if (error.response?.status === 404) {
        // Return null for 404 to allow graceful handling
        return null;
      }
      throw error;
    }
  });
}

/**
 * Fetch all books from the server
 * @returns {Promise<Object>} - All books object
 */
async function getAllBooks() {
  try {
    const books = await makeRequest('/');
    
    if (!books || Object.keys(books).length === 0) {
      logger.info('No books found in the database');
      return { message: 'No books available', books: {} };
    }
    
    logger.info(`Successfully fetched ${Object.keys(books).length} books`);
    return books;
  } catch (error) {
    handleAxiosError(error, 'Failed to fetch all books: ');
  }
}

/**
 * Fetch a single book by ISBN
 * @param {string|number} isbn - Book ISBN
 * @returns {Promise<Object|null>} - Book object or null if not found
 */
async function getBookByISBN(isbn) {
  // Input validation
  if (!isbn) {
    throw new Error('ISBN is required. Please provide a valid ISBN.');
  }
  
  const isbnStr = String(isbn).trim();
  if (!isbnStr.match(/^[a-zA-Z0-9-]+$/)) {
    throw new Error('Invalid ISBN format. Use only letters, numbers, and hyphens.');
  }
  
  try {
    logger.info(`Searching for book with ISBN: ${isbnStr}`);
    const book = await makeRequest(`/isbn/${encodeURIComponent(isbnStr)}`);
    
    if (!book || Object.keys(book).length === 0) {
      logger.info(`No book found with ISBN: ${isbnStr}`);
      return {
        message: `No book found with ISBN ${isbnStr}`,
        book: null
      };
    }
    
    logger.info(`Successfully found book: ${book.title || 'Unknown title'}`);
    return book;
  } catch (error) {
    handleAxiosError(error, `Failed to fetch book with ISBN ${isbnStr}: `);
  }
}

/**
 * Fetch all books by a specific author
 * @param {string} author - Author name
 * @returns {Promise<Array>} - Array of books by the author
 */
async function getBooksByAuthor(author) {
  if (!author || typeof author !== 'string') {
    throw new Error('Author name is required and must be a string.');
  }
  
  const authorName = author.trim();
  if (authorName.length < 2) {
    throw new Error('Author name must be at least 2 characters long.');
  }
  
  try {
    logger.info(`Searching for books by author: ${authorName}`);
    const books = await makeRequest(`/author/${encodeURIComponent(authorName)}`, 'array');
    
    if (!books || books.length === 0) {
      logger.info(`No books found for author: ${authorName}`);
      return {
        message: `No books found by author "${authorName}"`,
        count: 0,
        books: []
      };
    }
    
    logger.info(`Found ${books.length} book(s) by ${authorName}`);
    return {
      message: `Found ${books.length} book(s) by ${authorName}`,
      count: books.length,
      books: books
    };
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books by author "${authorName}": `);
  }
}

/**
 * Fetch books by title
 * @param {string} title - Book title
 * @returns {Promise<Array>} - Array of matching books
 */
async function getBooksByTitle(title) {
  if (!title || typeof title !== 'string') {
    throw new Error('Book title is required and must be a string.');
  }
  
  const bookTitle = title.trim();
  if (bookTitle.length < 1) {
    throw new Error('Book title cannot be empty.');
  }
  
  try {
    logger.info(`Searching for books with title: ${bookTitle}`);
    const books = await makeRequest(`/title/${encodeURIComponent(bookTitle)}`, 'array');
    
    if (!books || books.length === 0) {
      logger.info(`No books found with title containing: ${bookTitle}`);
      return {
        message: `No books found with title matching "${bookTitle}"`,
        count: 0,
        books: []
      };
    }
    
    logger.info(`Found ${books.length} book(s) matching title: ${bookTitle}`);
    return {
      message: `Found ${books.length} book(s) matching "${bookTitle}"`,
      count: books.length,
      books: books
    };
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books with title "${bookTitle}": `);
  }
}

/**
 * Fetch reviews for a specific book
 * @param {string|number} isbn - Book ISBN
 * @returns {Promise<Object>} - Reviews object
 */
async function getBookReviews(isbn) {
  if (!isbn) {
    throw new Error('ISBN is required to fetch reviews.');
  }
  
  const isbnStr = String(isbn).trim();
  
  try {
    logger.info(`Fetching reviews for ISBN: ${isbnStr}`);
    const reviews = await makeRequest(`/review/${encodeURIComponent(isbnStr)}`);
    
    if (!reviews) {
      return {
        message: `No reviews found for book with ISBN ${isbnStr}`,
        reviews: {},
        hasReviews: false
      };
    }
    
    const reviewCount = reviews.reviews ? Object.keys(reviews.reviews).length : 
                       (typeof reviews === 'object' ? Object.keys(reviews).length : 0);
    
    if (reviewCount === 0) {
      logger.info(`No reviews available for ISBN: ${isbnStr}`);
      return {
        message: `This book has no reviews yet. Be the first to review!`,
        reviews: {},
        hasReviews: false
      };
    }
    
    logger.info(`Found ${reviewCount} review(s) for ISBN: ${isbnStr}`);
    return {
      message: `Found ${reviewCount} review(s) for this book`,
      reviewCount: reviewCount,
      reviews: reviews.reviews || reviews,
      hasReviews: true
    };
  } catch (error) {
    handleAxiosError(error, `Failed to fetch reviews for ISBN ${isbnStr}: `);
  }
}

/**
 * Batch operation: Fetch multiple books by their ISBNs
 * @param {Array} isbns - Array of ISBNs
 * @returns {Promise<Object>} - Results of batch fetch
 */
async function getBooksByMultipleISBNs(isbns) {
  if (!Array.isArray(isbns) || isbns.length === 0) {
    throw new Error('Please provide an array of ISBNs');
  }
  
  const results = {
    successful: [],
    failed: [],
    total: isbns.length
  };
  
  for (const isbn of isbns) {
    try {
      const book = await getBookByISBN(isbn);
      results.successful.push({ isbn, book });
    } catch (error) {
      results.failed.push({ isbn, error: error.message });
    }
  }
  
  logger.info(`Batch fetch complete: ${results.successful.length}/${results.total} successful`);
  return results;
}

/**
 * Main function for testing/demonstration
 */
async function main() {
  logger.info('Starting book API client demonstration...');
  logger.info(`API Base URL: ${config.baseURL}`);
  
  try {
    // Test 1: Get all books
    console.log('\n📚 TEST 1: Fetching all books...');
    const allBooks = await getAllBooks();
    console.log('Result:', JSON.stringify(allBooks, null, 2).substring(0, 500) + '...');
    
    // Test 2: Get book by ISBN
    console.log('\n📖 TEST 2: Fetching book by ISBN "1"...');
    const bookByISBN = await getBookByISBN('1');
    console.log('Result:', JSON.stringify(bookByISBN, null, 2));
    
    // Test 3: Search by author (with proper empty result handling)
    console.log('\n✍️ TEST 3: Fetching books by author "Chinua Achebe"...');
    const authorBooks = await getBooksByAuthor('Chinua Achebe');
    console.log('Result:', JSON.stringify(authorBooks, null, 2));
    
    // Test 4: Search by title
    console.log('\n🔍 TEST 4: Fetching books by title "Things Fall Apart"...');
    const titleBooks = await getBooksByTitle('Things Fall Apart');
    console.log('Result:', JSON.stringify(titleBooks, null, 2));
    
    // Test 5: Get book reviews
    console.log('\n⭐ TEST 5: Fetching reviews for ISBN "1"...');
    const reviews = await getBookReviews('1');
    console.log('Result:', JSON.stringify(reviews, null, 2));
    
    // Test 6: Edge case - non-existent author (demonstrates proper empty handling)
    console.log('\n❌ TEST 6: Testing non-existent author...');
    const nonExistentAuthor = await getBooksByAuthor('NonExistent Author XYZ');
    console.log('Result:', nonExistentAuthor);
    
    logger.info('\n✅ All tests completed successfully!');
    
  } catch (error) {
    logger.error('Main execution failed:', error.message);
    if (error.originalError) {
      logger.error('Original error:', error.originalError.message);
    }
    process.exit(1);
  }
}

// Run only if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

/**
 * Exported API with enhanced functionality
 */
module.exports = {
  // Core functions
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
  getBookReviews,
  
  // Additional utilities
  getBooksByMultipleISBNs,
  APIError,
  config
};
