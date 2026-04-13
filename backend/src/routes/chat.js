import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/* =========================
   CREATE OR GET CONVERSATION
========================= */
router.post("/conversation", async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({ error: "Missing users" });
    }

    // tìm conversation đã tồn tại
    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .in("user_id", [user1, user2]);

    const countMap = {};
    members?.forEach((m) => {
      countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
    });

    const existingId = Object.keys(countMap).find((id) => countMap[id] >= 2);

    if (existingId) {
      return res.json({ conversationId: existingId });
    }

    // create conversation (TABLE chỉ cần id + created_at)
    const { data: conv, error } = await supabaseAdmin
      .from("conversations")
      .insert({})
      .select()
      .single();

    if (error) return res.status(500).json(error);

    // insert members
    await supabaseAdmin.from("conversation_members").insert([
      { conversation_id: conv.id, user_id: user1 },
      { conversation_id: conv.id, user_id: user2 },
    ]);

    return res.json({ conversationId: conv.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET MESSAGES
========================= */
router.get("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid conversationId" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) return res.status(400).json(error);

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   SEND MESSAGE (ONLY 1 ROUTE - FIXED)
========================= */
router.post("/messages", async (req, res) => {
  try {
    const { conversationId, senderId, content } = req.body;

    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      })
      .select()
      .single();

    if (error) return res.status(400).json(error);

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
