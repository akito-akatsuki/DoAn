import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { isMutualFollow } from "../lib/followCheck.js";

const router = express.Router();

/* =========================
   GET OR CREATE CONVERSATION
========================= */

router.post("/conversation", async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body); // 👈 ADD THIS

    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({
        error: "Missing users",
        debug: { user1, user2 },
      });
    }

    // find existing
    const { data: existing } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .in("user_id", [user1, user2]);

    if (existing && existing.length >= 2) {
      return res.json({
        conversationId: existing[0].conversation_id,
      });
    }

    // create conversation
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({
        user1_id: user1,
        user2_id: user2,
      })
      .select()
      .single();

    if (convError) {
      console.error("CONV ERROR:", convError);
      return res.status(500).json(convError);
    }

    // add members
    const { error: memberError } = await supabaseAdmin
      .from("conversation_members")
      .insert([
        { conversation_id: conv.id, user_id: user1 },
        { conversation_id: conv.id, user_id: user2 },
      ]);

    if (memberError) {
      console.error(memberError);
      return res.status(500).json(memberError);
    }

    return res.json({ conversationId: conv.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
/* =========================
   GET MESSAGES
========================= */
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId || conversationId === "undefined") {
      return res.status(400).json({ error: "Invalid conversationId" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) return res.status(400).json(error);

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json(err);
  }
});

/* =========================
   SEND MESSAGE
========================= */
router.post("/messages", async (req, res) => {
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

  res.json(data);
});

/* =========================
   SEND MESSAGE
========================= */
router.post("/messages", async (req, res) => {
  try {
    const { conversationId, senderId, content } = req.body;

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

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
