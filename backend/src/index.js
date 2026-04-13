import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import postsRouter from "./routes/posts.js";
import authRouter from "./routes/auth.js";
import commentsRouter from "./routes/comments.js";
import deleteRoute from "./routes/delete.js";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/posts", postsRouter);
app.use("/auth", authRouter);
app.use("/comments", commentsRouter);
app.use("/posts", deleteRoute);
app.use("/chat", chatRouter);

app.listen(process.env.PORT || 5000, () => {
  console.log(
    "🔥 Server running on http://localhost:" + (process.env.PORT || 5000),
  );
});
