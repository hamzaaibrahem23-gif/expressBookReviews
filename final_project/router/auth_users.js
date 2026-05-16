const express = require('express');
const jwt = require('jsonwebtoken');
let books = require("./booksdb.js");
const regd_users = express.Router();

let users = [
    { username: "hamza", password: "secret123" }
];

const isValid = (username)=>{ //returns boolean
//write code to check is the username is valid
}

const authenticatedUser = (username,password)=>{ //returns boolean
//write code to check if username and password match the one we have in records.
}

//only registered users can login
regd_users.post("/login", (req,res) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username: user.username },
    "fakedSecretKey",   // In practice use env var like process.env.JWT_SECRET
    { expiresIn: "1h" }
  );

  return res.status(200).json({
    message: "User successfully logged in",
    token: token
  });
});

// Add a book review
regd_users.put("/auth/review/:isbn", (req, res) => {
  const isbn = req.params.isbn;
  const review = req.body.review;
  const username = req.user.username;  // from JWT middleware

  if (!books[isbn]) {
    return res.status(404).json({ message: "Book not found" });
  }

  const book = books[isbn];

  if (!review) {
    return res.status(400).json({ message: "Review text is required" });
  }

  if (book.reviews[username]) {
    book.reviews[username] = review;
    return res.status(200).json({
      message: "Review modified successfully",
      reviews: book.reviews
    });
  }
  else {
    book.reviews[username] = review;
    return res.status(200).json({
      message: "Review added successfully",
      reviews: book.reviews
    });
  }
});

regd_users.delete("/auth/review/:isbn", (req, res) => {
  const isbn = req.params.isbn;
  const username = req.user.username;

  if (!books[isbn]) {
    return res.status(404).json({ message: "Book not found" });
  }
  const book = books[isbn];

  if (!book.reviews[username]) {
    return res.status(404).json({ message: "You have no review for this book" });
  }


  return res.status(200).json({
    message: "Review deleted successfully",
    reviews: book.reviews
  });
});

module.exports.authenticated = regd_users;
module.exports.isValid = isValid;
module.exports.users = users;
