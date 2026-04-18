require('dotenv').config();
const express = require('express');
const Note = require('../models/Note');
const auth = require('../middleware/auth');

const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

// POST summarise note with Gemini
router.post('/:id/summarize', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    console.log('Summarising:', note.title);
    console.log('API Key:', process.env.GEMINI_API_KEY ? 'loaded' : 'MISSING');

    const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: `Summarise the following note in 2-3 clear sentences:\n\n${note.content}`
});

console.log('Full response:', JSON.stringify(response, null, 2)); // ADD THIS

const summary = response.candidates[0].content.parts[0].text;

    console.log('Summary:', summary);

    note.summary = summary;
    await note.save();

    res.json({ summary });

  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;