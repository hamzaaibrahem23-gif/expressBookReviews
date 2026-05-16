const axios = require('axios');

// Replace with your actual server URL
const BASE_URL = 'http://localhost:5000'; // or your deployed URL

// Error utility
function handleAxiosError(error, context = '') {
  const message = error.response?.data?.message ||
                  error.response?.statusText ||
                  error.message ||
                  'An unknown error occurred';

  const status = error.response?.status || 500;

  throw new Error(`[${status}] ${context}${message}`);
}

// 1. Get all books
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

// 2. Get book by ISBN
async function getBookByISBN(isbn) {
  if (!isbn || typeof isbn !== 'string' && typeof isbn !== 'number') {
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

// 3. Get books by author
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

// 4. Get books by title
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

// 5. Get reviews for a book (by ISBN)
async function getBookReviews(isbn) {
  if (!isbn || typeof isbn !== 'string' && typeof isbn !== 'number') {
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

// Example usage (remove or comment out in production)
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

if (require.main === module) {
  main();
}

module.exports = {
  getAllBooks,
  getBookByISBN,
  getBooksByAuthor,
  getBooksByTitle,
  getBookReviews
};
