const express = require('express');
const router = express.Router();

router.get('/items', (req, res) => {
  res.json([]);
});

router.put('/item/:item_id', (req, res) => {
  res.sendStatus(200);
});

module.exports = router;
