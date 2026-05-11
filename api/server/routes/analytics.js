const express = require('express');
const { createInteractionAnalyticsHandlers } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const { createInteraction, getInteractionSummary, getInteractions } = require('~/models');

const router = express.Router();

router.use(requireJwtAuth);

const handlers = createInteractionAnalyticsHandlers({
  createInteraction,
  getInteractionSummary,
  getInteractions,
});

router.get('/summary', handlers.getSummary);
router.get('/interactions', handlers.getInteractions);
router.post('/mock-interaction', handlers.postMockInteraction);

module.exports = router;
