const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const router = express.Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/ia/chat', async (req, res) => {
  const { prompt, context } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: context ? `${context}\n${prompt}` : prompt,
    });
    res.json({ response: response.text });
  } catch (err) {
    res.status(500).json({ error: 'Error en IA', details: err.message });
  }
});

module.exports = router;
