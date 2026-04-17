require('dotenv').config();
const express = require('express');
const Note = require('../models/Note');
const auth = require('../middleware/auth');
const OpenAI = require('openai');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// GET all notes
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create note
router.post('/', auth, async (req, res) => {
  const { title, content } = req.body;
  try {
    const note = await Note.create({ userId: req.user.id, title, content });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update note
router.put('/:id', auth, async (req, res) => {
  const { title, content } = req.body;
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title, content },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE note
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST summarise note with AI
router.post('/:id/summarize', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-oss-120b/',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarises notes in 2-3 sentences.'
        },
        {
          role: 'user',
          content: `Summarise this note:\n\n${note.content}`
        }
      ],
      max_tokens: 150
    });

    if (!response.choices || response.choices.length === 0) {
  console.log('Bad response from OpenRouter:', JSON.stringify(response, null, 2));
  return res.status(500).json({ message: 'AI returned empty response' });
}

const summary = response.choices[0].message.content;
    note.summary = summary;
    await note.save();

    res.json({ summary });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'AI summarisation failed' });
  }
});

module.exports = router;