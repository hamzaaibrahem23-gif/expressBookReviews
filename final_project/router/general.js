const axios = require('axios');

/**
 * Base URL for the book‑review API.
 * This can be set to a local dev server or a deployed host.
 * Example: 'http://localhost:5000' for local development.
 */
const BASE_URL = 'http://localhost:5000'; // or your deployed URL

/**
 * Centralized error‑handling helper for Axios requests.
 * Extracts a meaningful message and status from the error object
 * and throws a standardized Error.
 *
 * @param {Error} error - The caught error (typically from axios).
 * @param {string} context - Optional prefix to describe the failing operation.
 * @throws {Error} - Formatted error with status and message.
 */
function handleAxiosError(error, context = '') {
  const message =
    error.response?.data?.message ||
    error.response?.statusText ||
    error.message ||
    'An unknown error occurred';

  const status = error.response?.status || 500;

  throw new Error(`[${status}] ${context}${message}`);
}

/**
 * Fetch all books from the server.
 *
 * @returns {Object} - The full books object as returned by the server.
 * @throws {Error} - If the request fails or the response is invalid.
 */
async function getAllBooks() {
  try {
    const response = await axios.get(`${BASE_URL}/`);

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error) {
    handleAxiosError(error, 'Failed to fetch all books: ');
  }
}

/**
 * Fetch a single book by its ISBN.
 *
 * @param {string|number} isbn - The ISBN (key) of the book.
 * @returns {Object} - The book object as returned by the server.
 * @throws {Error} - If input is invalid or the request fails.
 */
async function getBookByISBN(isbn) {
  if (!isbn || (typeof isbn !== 'string' && typeof isbn !== 'number')) {
    throw new Error('Invalid ISBN: must be a string or number');
  }

  try {
    const response = await axios.get(`${BASE_URL}/isbn/${isbn}`);

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error) {
    handleAxiosError(error, `Failed to fetch book with ISBN ${isbn}: `);
  }
}

/**
 * Fetch all books written by a given author.
 *
 * @param {string} author - The author name to search for.
 * @returns {Object[]} - Array of book objects matching the author.
 * @throws {Error} - If input is invalid or the request fails.
 */
async function getBooksByAuthor(author) {
  if (!author || typeof author !== 'string') {
    throw new Error('Invalid author: must be a non‑empty string');
  }

  try {
    const response = await axios.get(`${BASE_URL}/author/${author}`);

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books by author "${author}": `);
  }
}

/**
 * Fetch all books matching a given title.
 *
 * @param {string} title - The book title to search for.
 * @returns {Object[]} - Array of book objects matching the title.
 * @throws {Error} - If input is invalid or the request fails.
 */
async function getBooksByTitle(title) {
  if (!title || typeof title !== 'string') {
    throw new Error('Invalid title: must be a non‑empty string');
  }

  try {
    const response = await axios.get(`${BASE_URL}/title/${title}`);

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error) {
    handleAxiosError(error, `Failed to fetch books with title "${title}": `);
  }
}

/**
 * Fetch reviews for a specific book (by ISBN).
 *
 * @param {string|number} isbn - The ISBN (key) of the book.
 * @returns {Object} - The reviews object for that book.
 * @throws {Error} - If input is invalid or the request fails.
 */
async function getBookReviews(isbn) {
  if (!isbn || (typeof isbn !== 'string' && typeof isbn !== 'number')) {
    throw new Error('Invalid ISBN: must be a string or number');
  }

  try {
    const response = await axios.get(`${BASE_URL}/review/${isbn}`);

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    return response.data;
  } catch (error) {
    handleAxiosError(error, `Failed to fetch reviews for ISBN ${isbn}: `);
  }
}

/**
 * Example usage function to demonstrate the API calls.
 * This is typically commented out or removed in production.
 *
 * @async
 */
async function main() {
  try {
    const allBooks = await getAllBooks();
    console.log('All books:', allBooks);

    const book1 = await getBookByISBN('1');
    console.log('Book with ISBN 1:', book1);

    const chinuaBooks = await getBooksByAuthor('Chinua Achebe');
    console.log('Books by Chinua Achebe:', chinuaBooks);

    const thingsBook = await getBooksByTitle('Things Fall Apart');
    console.log('Book "Things Fall Apart":', thingsBook);

    const reviews = await getBookReviews('1');
    console.log('Reviews for ISBN 1:', reviews);
  } catch (error) {
    console.error('Main execution failed:', error.message);
  }
}

// Run `main()` only if this file is executed directly (not imported as a module).
if (require.main === module) {
  main();
}

/**
 * Exported public API of this module.
 *
 * Each function returns a Promise that resolves to the corresponding data
 * or rejects with a descriptive Error.
 *
 * @property {Function} getAllBooks - Get all books.
 * @property {Function} getBookByISBN - Get a book by ISBN.
 * @property {Function} getBooksByAuthor - Get books by author.
 * @property {Function} getBooksByTitle - Get books by title.
 * @property {Function} getBookReviews - Get reviews for a book (by ISBN).
 */
module.exports = {
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
  getBookReviews
};
