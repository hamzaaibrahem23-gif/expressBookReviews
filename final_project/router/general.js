const axios = require('axios');

// Replace with your actual server URL
const BASE_URL = 'http://localhost:5000'; // or your deployed URL

// 1. Get all books
async function getAllBooks() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    console.log("All books:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching all books:", error.response?.data || error.message);
    throw error;
  }
}

// 2. Get book by ISBN
async function getBookByISBN(isbn) {
  try {
    const response = await axios.get(`${BASE_URL}/isbn/${isbn}`);
    console.log(`Book with ISBN ${isbn}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching book with ISBN ${isbn}:`, error.response?.data || error.message);
    throw error;
  }
}

// 3. Get books by author
async function getBooksByAuthor(author) {
  try {
    const response = await axios.get(`${BASE_URL}/author/${author}`);
    console.log(`Books by ${author}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching books by author ${author}:`, error.response?.data || error.message);
    throw error;
  }
}

// 4. Get books by title
async function getBooksByTitle(title) {
  try {
    const response = await axios.get(`${BASE_URL}/title/${title}`);
    console.log(`Books with title ${title}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching books with title ${title}:`, error.response?.data || error.message);
    throw error;
  }
}

// 5. Get reviews for a book (by ISBN)
async function getBookReviews(isbn) {
  try {
    const response = await axios.get(`${BASE_URL}/review/${isbn}`);
    console.log(`Reviews for ISBN ${isbn}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching reviews for ISBN ${isbn}:`, error.response?.data || error.message);
    throw error;
  }
}

// Example usage (remove or comment out in production)
async function main() {
  await getAllBooks();
  await getBookByISBN('1');
  await getBooksByAuthor('Chinua Achebe');
  await getBooksByTitle('Things Fall Apart');
  await getBookReviews('1');
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