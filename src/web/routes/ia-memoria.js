const express = require('express');
const prisma = require('../../src/prisma');
const router = express.Router();

// Guardar frase clave
router.post('/ia/memoria', async (req, res) => {
  const { userId, rol, clave, valor } = req.body;
  try {
    const memoria = await prisma.iaMemoria.create({
      data: { userId, rol, clave, valor }
    });
    res.json(memoria);
  } catch (err) {
    res.status(500).json({ error: 'Error guardando memoria', details: err.message });
  }
});

// Consultar memoria por usuario
router.get('/ia/memoria/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const memorias = await prisma.iaMemoria.findMany({ where: { userId: Number(userId) } });
    res.json(memorias);
  } catch (err) {
    res.status(500).json({ error: 'Error consultando memoria', details: err.message });
  }
});

module.exports = router;
