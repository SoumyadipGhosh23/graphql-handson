import express from "express";
import { ApolloServer } from "@apollo/server";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { expressMiddleware } from "@apollo/server/express4";
import bodyParser from "body-parser"; // ✅ Corrected Import
const prisma = new PrismaClient();
const typeDefs = `
 type Book {
  id: ID!
  title: String!
  authors: [Author!]!
}

type Author {
  id: ID!
  name: String!
  rating: Float!
  books: [Book!]!
}

type Query {
  books: [Book]
  authors: [Author]
}

type Mutation {
  addBook(title: String!, authorIds: [ID!]!): Book
  addAuthor(name: String!, rating: Float!): Author
}

`;
const resolvers = {
    Query: {
        books: async () => {
            return await prisma.book.findMany({
                include: { authors: { include: { author: true } } },
            });
        },
        authors: async () => {
            return await prisma.author.findMany({
                include: { books: { include: { book: true } } },
            });
        },
    },
    Mutation: {
        addBook: async (_, { title, authorIds }) => {
            // Convert authorIds to numbers (if needed)
            const intAuthorIds = authorIds.map((id) => parseInt(id, 10));
            // Check if all authors exist
            const existingAuthors = await prisma.author.findMany({
                where: { id: { in: intAuthorIds } },
                select: { id: true },
            });
            const existingAuthorIds = existingAuthors.map(author => author.id);
            // Ensure all author IDs exist
            if (existingAuthorIds.length !== intAuthorIds.length) {
                throw new Error("One or more author IDs do not exist");
            }
            // Create the book and associate authors using the BookAuthor model
            return await prisma.book.create({
                data: {
                    title,
                    authors: {
                        create: existingAuthorIds.map(authorId => ({
                            author: { connect: { id: authorId } },
                        })),
                    },
                },
                include: {
                    authors: { include: { author: true } }, // Ensure authors are returned
                },
            });
        },
        addAuthor: async (_, { name, rating }) => {
            return await prisma.author.create({
                data: { name, rating },
                include: { books: { include: { book: true } } },
            });
        },
    },
    Book: {
        authors: async (parent) => {
            const bookAuthors = await prisma.bookAuthor.findMany({
                where: { bookId: parent.id },
                include: { author: true },
            });
            return bookAuthors.map((ba) => ba.author);
        },
    },
    Author: {
        books: async (parent) => {
            const authorBooks = await prisma.bookAuthor.findMany({
                where: { authorId: parent.id },
                include: { book: true },
            });
            return authorBooks.map((ab) => ab.book);
        },
    },
};
const app = express();
app.use(cors());
app.use(bodyParser.json()); // ✅ Corrected Usage
const server = new ApolloServer({ typeDefs, resolvers });
await server.start();
app.use("/graphql", expressMiddleware(server));
app.listen(4000, () => {
    console.log("🚀 Server running at http://localhost:4000/graphql");
});
